import { useEffect, useMemo, useState, useRef } from "react";
import { hasFirebaseConfig } from "../config/env";
import { calcularTotaisTurno } from "../features/fechamento/calculos";
import {
  adicionarFantasma,
  adicionarTransacao,
  adicionarDivida, // NOVO
  alternarDivida, // NOVO
  removerDivida, // NOVO
  ouvirDividas, // NOVO
  atualizarConferenciaTransacao,
  atualizarFantasmaCompleto,
  buscarTurnoPorId,
  buscarUltimoTurnoAberto,
  criarNovoTurno,
  editarTransacao,
  atualizarStatusTurno, // ADICIONADO
  listarTurnosRecentes,
  ouvirFantasmas,
  ouvirTransacoes,
  ouvirTurno,
  removerFantasma,
  removerTransacao,
  removerTurnoTotal,
  salvarAjusteSobra,
  salvarTotaisTurno,
} from "../services/repositories/caixa-repository";
import { LembreteFantasma, Transacao, Turno, DividaCliente } from "../types/domain";
import { getTodayReferenceDate } from "../utils/date";

export function useCaixaSeguro() {
  const [turno, setTurno] = useState<Turno | null>(null);
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [fantasmas, setFantasmas] = useState<LembreteFantasma[]>([]);
  const [dividas, setDividas] = useState<DividaCliente[]>([]); // NOVO
  const [historicoTurnos, setHistoricoTurnos] = useState<Turno[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!turno?.id) return;
    const unsubTurno = ouvirTurno(turno.id, setTurno);
    const unsubTransacoes = ouvirTransacoes(turno.id, setTransacoes);
    const unsubFantasmas = ouvirFantasmas(turno.id, setFantasmas);
    const unsubDividas = ouvirDividas(turno.id, setDividas); // NOVO

    return () => {
      unsubTurno();
      unsubTransacoes();
      unsubFantasmas();
      unsubDividas();
    };
  }, [turno?.id]);

  const totais = useMemo(
    () => calcularTotaisTurno(transacoes, fantasmas, turno?.ajusteManualSobra ?? 0),
    [transacoes, fantasmas, turno?.ajusteManualSobra]
  );

  useEffect(() => {
    if (!turno?.id) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      const current = turno.totais;
      if (totais.sistema !== current.sistema || totais.sobra !== current.sobra || totais.gavetaFisico !== current.gavetaFisico) {
        void salvarTotaisTurno(turno.id, totais);
      }
    }, 3000); 
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [totais]);

  async function iniciarNovoDia() {
    setLoading(true);
    try { const created = await criarNovoTurno(getTodayReferenceDate()); setTurno(created); } catch (err) { setError("Erro ao iniciar dia."); } finally { setLoading(false); }
  }

  async function continuarDiaAnterior() {
    setLoading(true);
    try { const openTurno = await buscarUltimoTurnoAberto(); if (openTurno) setTurno(openTurno); else setError("Nenhum turno aberto."); } catch (err) { setError("Erro ao carregar turno."); } finally { setLoading(false); }
  }

  async function carregarHistoricoTurnos() {
    setLoading(true);
    try { const list = await listarTurnosRecentes(); setHistoricoTurnos(list); } finally { setLoading(false); }
  }

  async function abrirTurnoPorId(turnoId: string) {
    setLoading(true);
    try { const found = await buscarTurnoPorId(turnoId); if (found) setTurno(found); } finally { setLoading(false); }
  }

  return {
    turno, transacoes, fantasmas, dividas, historicoTurnos, totais, loading, error,
    iniciarNovoDia, continuarDiaAnterior, carregarHistoricoTurnos, abrirTurnoPorId,
    // NOVO: Ações de Turno
    fecharTurno: () => turno && atualizarStatusTurno(turno.id, "fechado"),
    reabrirTurno: () => turno && atualizarStatusTurno(turno.id, "aberto"),
    excluirTurno: (id: string) => removerTurnoTotal(id),
    definirAjusteSobra: (v: number) => turno && salvarAjusteSobra(turno.id, v),
    criarTransacao: (i: any) => turno && adicionarTransacao(turno.id, i),
    excluirTransacao: (id: string) => turno && removerTransacao(turno.id, id),
    editarLançamento: (id: string, i: any) => turno && editarTransacao(turno.id, id, i),
    alternarConferencia: (t: Transacao) => turno && atualizarConferenciaTransacao(turno.id, t.id, t.statusConferencia === "pendente" ? "confirmada" : "pendente"),
    criarFantasma: (i: any) => turno && adicionarFantasma(turno.id, i),
    excluirFantasma: (id: string) => turno && removerFantasma(turno.id, id),
    alternarFantasmaResolvido: (f: LembreteFantasma) => turno && atualizarFantasmaCompleto(turno.id, f.id, { resolvido: !f.resolvido }),
    alternarFantasmaComprovado: (f: LembreteFantasma) => turno && atualizarFantasmaCompleto(turno.id, f.id, { comprovado_pix: !f.comprovadoPix }),
    // NOVO: Ações de Dívidas
    criarDivida: (i: any) => turno && adicionarDivida(turno.id, i),
    excluirDivida: (id: string) => turno && removerDivida(turno.id, id),
    alternarDividaStatus: (d: DividaCliente) => turno && alternarDivida(turno.id, d.id, !d.resolvido),
  };
}
