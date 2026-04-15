import {
  DataSnapshot,
  Unsubscribe,
  get,
  onValue,
  push,
  ref,
  set,
  update,
} from "firebase/database";
import { getAuth } from "firebase/auth";

import {
  DividaCliente,
  LembreteFantasma,
  StatusConferencia,
  TipoFantasma,
  TotaisTurno,
  Transacao,
  Turno,
  ContagemCedulas
} from "../../types/domain";
import { getRealtimeDatabase } from "../firebase/realtime";
import { getFirebaseApp } from "../firebase/client";

function getUserId(): string {
  const auth = getAuth(getFirebaseApp());
  return auth.currentUser?.uid || "unauthenticated";
}

interface AddTransacaoInput {
  naturezaOperacao: Transacao["naturezaOperacao"];
  categoria: Transacao["categoria"];
  descricao: string;
  codigoContrato?: string;
  valorSistema: number;
  valorRecebidoFisico: number;
  trocoSobra: number;
  statusConferencia: StatusConferencia;
  justificativaTexto?: string | null;
  transacaoVinculadaId?: string | null;
}

function toMoney(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round((parsed + Number.EPSILON) * 100) / 100;
}

function mapTurno(id: string, data: Record<string, unknown>): Turno {
  const metadados = (data.metadados as Record<string, number> | undefined) ?? {};
  const totais = (data.totais as Record<string, number> | undefined) ?? {};
  const contagem = (data.contagem_cedulas as Record<string, number> | undefined) ?? null;

  return {
    id,
    caixaId: data.caixa_id ? String(data.caixa_id) : undefined,
    operadorId: data.operador_id ? String(data.operador_id) : undefined,
    dataReferencia: String(data.data_referencia ?? ""),
    statusTurno: (data.status_turn as Turno["statusTurno"]) ?? (data.status_turno as Turno["statusTurno"]) ?? "aberto",
    ajusteManualSobra: Number(data.ajuste_manual_sobra ?? 0),
    contagem: contagem ? {
      n100: Number(contagem.n100 || 0),
      n50: Number(contagem.n50 || 0),
      n20: Number(contagem.n20 || 0),
      n10: Number(contagem.n10 || 0),
      n5: Number(contagem.n5 || 0),
      n2: Number(contagem.n2 || 0),
      moedas: Number(contagem.moedas || 0),
    } : undefined,
    totais: {
      sistema: Number(totais.sistema ?? 0),
      sobra: Number(totais.sobra ?? 0),
      gavetaFisico: Number(totais.gaveta_fisico ?? 0),
      especieEnvelope: Number(totais.especie_envelope ?? 0),
      pixRepasse: Number(totais.pix_repasse ?? 0),
    },
    criadoEm: Number(metadados.criado_em ?? Date.now()),
    atualizadoEm: Number(metadados.atualizado_em ?? Date.now()),
    repassado: Boolean(data.repassado),
  };
}

function mapTransacoes(snapshot: DataSnapshot): Transacao[] {
  const raw = (snapshot.val() as Record<string, Record<string, unknown>> | null) ?? {};
  return Object.entries(raw)
    .map(([id, item]) => ({
      id,
      timestamp: Number(item.timestamp ?? 0),
      naturezaOperacao: (item.natureza_operacao as Transacao["naturezaOperacao"]) ?? "pagamento",
      categoria: (item.categoria as Transacao["categoria"]) ?? "dinheiro",
      descricao: String(item.descricao ?? ""),
      codigoContrato: item.codigo_contrato ? String(item.codigo_contrato) : undefined,
      valorSistema: toMoney(item.valor_sistema),
      valorRecebidoFisico: toMoney(item.valor_recebido_fisico),
      trocoSobra: toMoney(item.troco_sobra),
      statusConferencia: (item.status_conferencia as StatusConferencia) ?? "pendente",
      justificativaTexto: (item.justificativa_texto as string | null | undefined) ?? null,
      transacaoVinculadaId: item.transacao_vinculada_id ? String(item.transacao_vinculada_id) : undefined,
    }))
    .sort((a, b) => b.timestamp - a.timestamp);
}

function mapDividas(snapshot: DataSnapshot): DividaCliente[] {
  const raw = (snapshot.val() as Record<string, Record<string, unknown>> | null) ?? {};
  return Object.entries(raw)
    .map(([id, item]) => ({
      id,
      cliente: String(item.cliente ?? "Desconhecido"),
      valor: toMoney(item.valor),
      descricao: String(item.descricao ?? ""),
      resolvido: Boolean(item.resolvido),
      timestamp: Number(item.timestamp ?? 0),
    }))
    .sort((a, b) => b.timestamp - a.timestamp);
}

function mapFantasmas(snapshot: DataSnapshot): LembreteFantasma[] {
  const raw = (snapshot.val() as Record<string, Record<string, unknown>> | null) ?? {};
  return Object.entries(raw)
    .map(([id, item]) => ({
      id,
      timestamp: Number(item.timestamp ?? 0),
      tipo: (item.tipo as TipoFantasma) ?? "outro",
      pessoa: item.pessoa ? String(item.pessoa) : undefined,
      descricao: String(item.descricao ?? ""),
      valorReferencia: toMoney(item.valor_referencia),
      impactaPixRepasse: Boolean(item.impacta_pix_repasse),
      destinoPix: item.destino_pix ? String(item.destino_pix) : undefined,
      transacaoVinculadaId: item.transacao_vinculada_id ? String(item.transacao_vinculada_id) : undefined,
      resolvido: Boolean(item.resolvido),
      comprovadoPix: Boolean(item.comprovado_pix),
    }))
    .sort((a, b) => b.timestamp - a.timestamp);
}

// ---------------------------------------------------------
// NOVO: MIGRAÇÃO DE DADOS LEGADOS
// ---------------------------------------------------------
export async function migrarDadosAntigos(): Promise<void> {
  const uid = getUserId();
  if (uid === "unauthenticated") return;
  const db = getRealtimeDatabase();

  const turnosLegacy = await get(ref(db, "turnos"));
  if (!turnosLegacy.exists()) return; // Não há dados legados para migrar

  console.log("Iniciando migração de dados...");
  const updates: Record<string, any> = {};

  const tSnapshot = turnosLegacy.val();
  for (const turnoId in tSnapshot) {
    updates[`users/${uid}/turnos/${turnoId}`] = tSnapshot[turnoId];
  }

  const transacoesLegacy = await get(ref(db, "transacoes"));
  if (transacoesLegacy.exists()) {
    const trSnapshot = transacoesLegacy.val();
    for (const turnoId in trSnapshot) {
      updates[`users/${uid}/transacoes/${turnoId}`] = trSnapshot[turnoId];
    }
  }

  const fantasmasLegacy = await get(ref(db, "fantasmas_lembretes"));
  if (fantasmasLegacy.exists()) {
    const faSnapshot = fantasmasLegacy.val();
    for (const turnoId in faSnapshot) {
      updates[`users/${uid}/fantasmas_lembretes/${turnoId}`] = faSnapshot[turnoId];
    }
  }

  const dividasLegacy = await get(ref(db, "dividas_clientes"));
  if (dividasLegacy.exists()) {
    const diSnapshot = dividasLegacy.val();
    for (const turnoId in diSnapshot) {
      updates[`users/${uid}/dividas_clientes/${turnoId}`] = diSnapshot[turnoId];
    }
  }

  // Deleta do root para não duplicar e marca como migrado
  updates["turnos"] = null;
  updates["transacoes"] = null;
  updates["fantasmas_lembretes"] = null;
  updates["dividas_clientes"] = null;

  await update(ref(db), updates);
  console.log("Migração concluída com sucesso!");
}

export async function criarNovoTurno(dataReferencia: string): Promise<Turno> {
  const db = getRealtimeDatabase();
  const root = ref(db, `users/${getUserId()}/turnos`);
  const created = push(root);
  const timestamp = Date.now();
  await set(created, {
    data_referencia: dataReferencia,
    status_turno: "aberto",
    ajuste_manual_sobra: 0,
    metadados: { criado_em: timestamp, atualizado_em: timestamp },
  });
  return { id: created.key as string, dataReferencia, statusTurno: "aberto", ajusteManualSobra: 0, totais: { sistema: 0, sobra: 0, gavetaFisico: 0, especieEnvelope: 0, pixRepasse: 0, pixDiretoLoja: 0, pixNoCaixa: 0 }, criadoEm: timestamp, atualizadoEm: timestamp };
}

export async function buscarUltimoTurnoAberto(): Promise<Turno | null> {
  const db = getRealtimeDatabase();
  const snapshot = await get(ref(db, `users/${getUserId()}/turnos`));
  const raw = (snapshot.val() as Record<string, Record<string, unknown>> | null) ?? {};
  const abertos = Object.entries(raw).map(([id, data]) => mapTurno(id, data)).filter((item) => item.statusTurno === "aberto").sort((a, b) => b.criadoEm - a.criadoEm);
  return abertos[0] ?? null;
}

export async function listarTurnosRecentes(): Promise<Turno[]> {
  const snapshot = await get(ref(getRealtimeDatabase(), `users/${getUserId()}/turnos`));
  const raw = (snapshot.val() as Record<string, Record<string, unknown>> | null) ?? {};
  return Object.entries(raw)
    .map(([id, data]) => mapTurno(id, data))
    .sort((a, b) => b.dataReferencia.localeCompare(a.dataReferencia));
}

export async function buscarTurnoPorId(turnoId: string): Promise<Turno | null> {
  const snapshot = await get(ref(getRealtimeDatabase(), `users/${getUserId()}/turnos/${turnoId}`));
  const raw = snapshot.val() as Record<string, unknown> | null;
  return raw ? mapTurno(turnoId, raw) : null;
}

export function ouvirTurno(turnoId: string, onData: (turno: Turno) => void): Unsubscribe {
  return onValue(ref(getRealtimeDatabase(), `users/${getUserId()}/turnos/${turnoId}`), (snapshot) => {
    const raw = snapshot.val() as Record<string, unknown> | null;
    if (raw) onData(mapTurno(turnoId, raw));
  });
}

export function ouvirTransacoes(turnoId: string, onData: (transacoes: Transacao[]) => void): Unsubscribe {
  return onValue(ref(getRealtimeDatabase(), `users/${getUserId()}/transacoes/${turnoId}`), (snapshot) => onData(mapTransacoes(snapshot)));
}

export function ouvirFantasmas(turnoId: string, onData: (fantasmas: LembreteFantasma[]) => void): Unsubscribe {
  return onValue(ref(getRealtimeDatabase(), `users/${getUserId()}/fantasmas_lembretes/${turnoId}`), (snapshot) => onData(mapFantasmas(snapshot)));
}

export function ouvirDividas(turnoId: string, onData: (dividas: DividaCliente[]) => void): Unsubscribe {
  return onValue(ref(getRealtimeDatabase(), `users/${getUserId()}/dividas_clientes/${turnoId}`), (snapshot) => onData(mapDividas(snapshot)));
}

export async function salvarAjusteSobra(turnoId: string, ajuste: number): Promise<void> {
  await update(ref(getRealtimeDatabase(), `users/${getUserId()}/turnos/${turnoId}`), { ajuste_manual_sobra: ajuste, "metadados/atualizado_em": Date.now() });
}

export async function salvarTotaisTurno(turnoId: string, totais: TotaisTurno): Promise<void> {
  await update(ref(getRealtimeDatabase(), `users/${getUserId()}/turnos/${turnoId}`), { 
    totais: { sistema: totais.sistema, sobra: totais.sobra, gaveta_fisico: totais.gavetaFisico, especie_envelope: totais.especieEnvelope, pix_repasse: totais.pixRepasse }, 
    "metadados/atualizado_em": Date.now() 
  });
}

// NOVO: Salvar contagem de notas
export async function salvarContagemCedulas(turnoId: string, contagem: ContagemCedulas): Promise<void> {
  await update(ref(getRealtimeDatabase(), `users/${getUserId()}/turnos/${turnoId}`), { 
    contagem_cedulas: contagem,
    "metadados/atualizado_em": Date.now() 
  });
}

// NOVO: Atualizar Identificação
export async function atualizarIdentificacao(turnoId: string, caixaId: string, operadorId: string): Promise<void> {
  await update(ref(getRealtimeDatabase(), `users/${getUserId()}/turnos/${turnoId}`), { 
    caixa_id: caixaId,
    operador_id: operadorId,
    "metadados/atualizado_em": Date.now() 
  });
}

export async function adicionarTransacao(turnoId: string, input: AddTransacaoInput): Promise<void> {
  const created = push(ref(getRealtimeDatabase(), `users/${getUserId()}/transacoes/${turnoId}`));
  await set(created, {
    timestamp: Date.now(),
    natureza_operacao: input.naturezaOperacao,
    categoria: input.categoria,
    descricao: input.descricao,
    codigo_contrato: input.codigoContrato || null,
    valor_sistema: input.valorSistema,
    valor_recebido_fisico: input.valorRecebidoFisico,
    troco_sobra: input.trocoSobra,
    status_conferencia: "pendente",
    justificativa_texto: input.justificativaTexto ?? null,
  });
}

export async function editarTransacao(turnoId: string, id: string, input: any): Promise<void> {
  const payload: Record<string, any> = {
    natureza_operacao: input.naturezaOperacao,
    categoria: input.categoria,
    descricao: input.descricao,
    codigo_contrato: input.codigoContrato || null,
    valor_sistema: input.valorSistema,
    valor_recebido_fisico: input.valorRecebidoFisico,
    troco_sobra: input.trocoSobra,
    justificativa_texto: input.justificativaTexto || null,
    transacao_vinculada_id: input.transacaoVinculadaId || null,
  };
  await update(ref(getRealtimeDatabase(), `users/${getUserId()}/transacoes/${turnoId}/${id}`), payload);
}

export async function removerTransacao(turnoId: string, id: string): Promise<void> {
  await set(ref(getRealtimeDatabase(), `users/${getUserId()}/transacoes/${turnoId}/${id}`), null);
}

export async function adicionarFantasma(turnoId: string, input: any): Promise<void> {
  const created = push(ref(getRealtimeDatabase(), `users/${getUserId()}/fantasmas_lembretes/${turnoId}`));
  await set(created, {
    tipo: input.tipo,
    pessoa: input.pessoa || null,
    descricao: input.descricao || null,
    valor_referencia: input.valorReferencia,
    impacta_pix_repasse: input.impactaPixRepasse,
    destino_pix: input.destinoPix || null,
    transacao_vinculada_id: input.transacaoVinculadaId || null,
    timestamp: Date.now(),
    resolvido: false,
    comprovado_pix: false
  });
}

export async function atualizarFantasmaCompleto(turnoId: string, id: string, changes: any): Promise<void> {
  const payload: Record<string, any> = {};
  if (changes.tipo) payload.tipo = changes.tipo;
  if (changes.pessoa !== undefined) payload.pessoa = changes.pessoa;
  if (changes.descricao !== undefined) payload.descricao = changes.descricao;
  if (changes.valorReferencia !== undefined) payload.valor_referencia = changes.valorReferencia;
  if (changes.impactaPixRepasse !== undefined) payload.impacta_pix_repasse = changes.impactaPixRepasse;
  if (changes.destinoPix !== undefined) payload.destino_pix = changes.destinoPix;
  if (changes.transacaoVinculadaId !== undefined) payload.transacao_vinculada_id = changes.transacaoVinculadaId;
  if (changes.resolvido !== undefined) payload.resolvido = changes.resolvido;
  if (changes.comprovado_pix !== undefined) payload.comprovado_pix = changes.comprovado_pix;

  await update(ref(getRealtimeDatabase(), `users/${getUserId()}/fantasmas_lembretes/${turnoId}/${id}`), payload);
}

export async function removerFantasma(turnoId: string, id: string): Promise<void> {
  await set(ref(getRealtimeDatabase(), `users/${getUserId()}/fantasmas_lembretes/${turnoId}/${id}`), null);
}

export async function adicionarDivida(turnoId: string, input: any): Promise<void> {
  const created = push(ref(getRealtimeDatabase(), `users/${getUserId()}/dividas_clientes/${turnoId}`));
  await set(created, { ...input, timestamp: Date.now(), resolvido: false });
}

export async function alternarDivida(turnoId: string, id: string, resolvido: boolean): Promise<void> {
  await update(ref(getRealtimeDatabase(), `users/${getUserId()}/dividas_clientes/${turnoId}/${id}`), { resolvido });
}

export async function removerDivida(turnoId: string, id: string): Promise<void> {
  await set(ref(getRealtimeDatabase(), `users/${getUserId()}/dividas_clientes/${turnoId}/${id}`), null);
}

export async function atualizarStatusTurno(turnoId: string, status: "aberto" | "fechado"): Promise<void> {
  await update(ref(getRealtimeDatabase(), `users/${getUserId()}/turnos/${turnoId}`), {
    status_turno: status,
    "metadados/atualizado_em": Date.now(),
  });
}

export async function atualizarStatusRepasse(turnoId: string, repassado: boolean): Promise<void> {
  await update(ref(getRealtimeDatabase(), `users/${getUserId()}/turnos/${turnoId}`), {
    repassado,
    "metadados/atualizado_em": Date.now(),
  });
}

export async function removerTurnoTotal(turnoId: string): Promise<void> {
  const db = getRealtimeDatabase();
  await Promise.all([
    set(ref(db, `users/${getUserId()}/turnos/${turnoId}`), null),
    set(ref(db, `users/${getUserId()}/transacoes/${turnoId}`), null),
    set(ref(db, `users/${getUserId()}/fantasmas_lembretes/${turnoId}`), null),
    set(ref(db, `users/${getUserId()}/dividas_clientes/${turnoId}`), null),
  ]);
}

export async function atualizarConferenciaTransacao(turnoId: string, id: string, status: string): Promise<void> {
  await update(ref(getRealtimeDatabase(), `users/${getUserId()}/transacoes/${turnoId}/${id}`), { status_conferencia: status });
}
