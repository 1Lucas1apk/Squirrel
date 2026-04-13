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

import {
  LembreteFantasma,
  StatusConferencia,
  TipoFantasma,
  TotaisTurno,
  Transacao,
  Turno,
} from "../../types/domain";
import { getRealtimeDatabase } from "../firebase/realtime";

interface AddTransacaoInput {
  naturezaOperacao: Transacao["naturezaOperacao"];
  categoria: Transacao["categoria"];
  descricao: string;
  valorSistema: number;
  valorRecebidoFisico: number;
  trocoSobra: number;
  justificativaTexto?: string | null;
}

interface AddFantasmaInput {
  tipo: TipoFantasma;
  descricao: string;
  valorReferencia: number;
  impactaPixRepasse: boolean;
}

function toMoney(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.round((parsed + Number.EPSILON) * 100) / 100;
}

function mapTurno(id: string, data: Record<string, unknown>): Turno {
  const metadados = (data.metadados as Record<string, number> | undefined) ?? {};
  const totais = (data.totais as Record<string, number> | undefined) ?? {};
  return {
    id,
    dataReferencia: String(data.data_referencia ?? ""),
    statusTurno: (data.status_turno as Turno["statusTurno"]) ?? "aberto",
    ajusteManualSobra: Number(data.ajuste_manual_sobra ?? 0),
    totais: {
      sistema: Number(totais.sistema ?? 0),
      sobra: Number(totais.sobra ?? 0),
      gavetaFisico: Number(totais.gaveta_fisico ?? 0),
      especieEnvelope: Number(totais.especie_envelope ?? 0),
      pixRepasse: Number(totais.pix_repasse ?? 0),
    },
    criadoEm: Number(metadados.criado_em ?? Date.now()),
    atualizadoEm: Number(metadados.atualizado_em ?? Date.now()),
  };
}

function mapTransacoes(snapshot: DataSnapshot): Transacao[] {
  const normalizeCategoria = (value: unknown): Transacao["categoria"] => {
    if (value === "entrada") {
      return "entrada_prestacao";
    }
    const allowed: Transacao["categoria"][] = [
      "dinheiro",
      "entrada_prestacao",
      "compra_vista",
      "gar",
      "multiplo",
      "sangria",
      "cancelamento",
    ];
    if (allowed.includes(value as Transacao["categoria"])) {
      return value as Transacao["categoria"];
    }
    return "dinheiro";
  };

  const raw = (snapshot.val() as Record<string, Record<string, unknown>> | null) ?? {};
  return Object.entries(raw)
    .map(([id, item]) => ({
      id,
      timestamp: Number(item.timestamp ?? 0),
      naturezaOperacao: (item.natureza_operacao as Transacao["naturezaOperacao"]) ?? "pagamento",
      categoria: normalizeCategoria(item.categoria),
      descricao: String(item.descricao ?? ""),
      valorSistema: toMoney(item.valor_sistema),
      valorRecebidoFisico: toMoney(item.valor_recebido_fisico),
      trocoSobra: toMoney(item.troco_sobra),
      statusConferencia: (item.status_conferencia as StatusConferencia) ?? "pendente",
      justificativaTexto: (item.justificativa_texto as string | null | undefined) ?? null,
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
      descricao: String(item.descricao ?? ""),
      valorReferencia: toMoney(item.valor_referencia),
      impactaPixRepasse: Boolean(item.impacta_pix_repasse),
      resolvido: Boolean(item.resolvido),
      comprovadoPix: Boolean(item.comprovado_pix),
    }))
    .sort((a, b) => b.timestamp - a.timestamp);
}

export async function criarNovoTurno(dataReferencia: string): Promise<Turno> {
  const db = getRealtimeDatabase();
  const root = ref(db, "turnos");
  const created = push(root);
  const timestamp = Date.now();

  await set(created, {
    data_referencia: dataReferencia,
    status_turno: "aberto",
    ajuste_manual_sobra: 0,
    metadados: {
      criado_em: timestamp,
      atualizado_em: timestamp,
    },
  });

  return {
    id: created.key as string,
    dataReferencia,
    statusTurno: "aberto",
    ajusteManualSobra: 0,
    totais: {
      sistema: 0,
      sobra: 0,
      especieEnvelope: 0,
      pixRepasse: 0,
    },
    criadoEm: timestamp,
    atualizadoEm: timestamp,
  };
}

export async function buscarUltimoTurnoAberto(): Promise<Turno | null> {
  const db = getRealtimeDatabase();
  const snapshot = await get(ref(db, "turnos"));
  const raw = (snapshot.val() as Record<string, Record<string, unknown>> | null) ?? {};
  const abertos = Object.entries(raw)
    .map(([id, data]) => mapTurno(id, data))
    .filter((item) => item.statusTurno === "aberto")
    .sort((a, b) => b.atualizadoEm - a.atualizadoEm);

  return abertos[0] ?? null;
}

export async function listarTurnosRecentes(): Promise<Turno[]> {
  const db = getRealtimeDatabase();
  const snapshot = await get(ref(db, "turnos"));
  const raw = (snapshot.val() as Record<string, Record<string, unknown>> | null) ?? {};
  return Object.entries(raw)
    .map(([id, data]) => mapTurno(id, data))
    .sort((a, b) => b.atualizadoEm - a.atualizadoEm);
}

export async function buscarTurnoPorId(turnoId: string): Promise<Turno | null> {
  const snapshot = await get(ref(getRealtimeDatabase(), `turnos/${turnoId}`));
  const raw = snapshot.val() as Record<string, unknown> | null;
  if (!raw) {
    return null;
  }
  return mapTurno(turnoId, raw);
}

export function ouvirTurno(turnoId: string, onData: (turno: Turno) => void): Unsubscribe {
  return onValue(ref(getRealtimeDatabase(), `turnos/${turnoId}`), (snapshot) => {
    const raw = snapshot.val() as Record<string, unknown> | null;
    if (!raw) {
      return;
    }
    onData(mapTurno(turnoId, raw));
  });
}

export function ouvirTransacoes(
  turnoId: string,
  onData: (transacoes: Transacao[]) => void
): Unsubscribe {
  return onValue(ref(getRealtimeDatabase(), `transacoes/${turnoId}`), (snapshot) => {
    onData(mapTransacoes(snapshot));
  });
}

export function ouvirFantasmas(
  turnoId: string,
  onData: (fantasmas: LembreteFantasma[]) => void
): Unsubscribe {
  return onValue(ref(getRealtimeDatabase(), `fantasmas_lembretes/${turnoId}`), (snapshot) => {
    onData(mapFantasmas(snapshot));
  });
}

export async function salvarAjusteSobra(turnoId: string, ajuste: number): Promise<void> {
  await update(ref(getRealtimeDatabase(), `turnos/${turnoId}`), {
    ajuste_manual_sobra: ajuste,
    "metadados/atualizado_em": Date.now(),
  });
}

export async function salvarTotaisTurno(turnoId: string, totais: TotaisTurno): Promise<void> {
  await update(ref(getRealtimeDatabase(), `turnos/${turnoId}`), {
    totais: {
      sistema: totais.sistema,
      sobra: totais.sobra,
      gaveta_fisico: totais.gavetaFisico,
      especie_envelope: totais.especieEnvelope,
      pix_repasse: totais.pixRepasse,
    },
    "metadados/atualizado_em": Date.now(),
  });
}

export async function adicionarTransacao(
  turnoId: string,
  input: AddTransacaoInput
): Promise<void> {
  const created = push(ref(getRealtimeDatabase(), `transacoes/${turnoId}`));
  await set(created, {
    timestamp: Date.now(),
    natureza_operacao: input.naturezaOperacao,
    categoria: input.categoria,
    descricao: input.descricao,
    valor_sistema: input.valorSistema,
    valor_recebido_fisico: input.valorRecebidoFisico,
    troco_sobra: input.trocoSobra,
    status_conferencia: "pendente",
    justificativa_texto: input.justificativaTexto ?? null,
  });
}

export async function atualizarConferenciaTransacao(
  turnoId: string,
  transacaoId: string,
  status: StatusConferencia
): Promise<void> {
  await update(ref(getRealtimeDatabase(), `transacoes/${turnoId}/${transacaoId}`), {
    status_conferencia: status,
  });
}

export async function adicionarFantasma(turnoId: string, input: AddFantasmaInput): Promise<void> {
  const created = push(ref(getRealtimeDatabase(), `fantasmas_lembretes/${turnoId}`));
  await set(created, {
    timestamp: Date.now(),
    tipo: input.tipo,
    pessoa: input.pessoa ?? null,
    descricao: input.descricao,
    valor_referencia: input.valorReferencia,
    impacta_pix_repasse: input.impactaPixRepasse,
    resolvido: false,
    comprovado_pix: false,
  });
}

export async function removerTransacao(turnoId: string, transacaoId: string): Promise<void> {
  const db = getRealtimeDatabase();
  await set(ref(db, `transacoes/${turnoId}/${transacaoId}`), null);
}

export async function editarTransacao(
  turnoId: string,
  transacaoId: string,
  changes: Partial<AddTransacaoInput>
): Promise<void> {
  const db = getRealtimeDatabase();
  const payload: Record<string, any> = {};
  if (changes.categoria) payload.categoria = changes.categoria;
  if (changes.descricao !== undefined) payload.descricao = changes.descricao;
  if (changes.valorSistema !== undefined) payload.valor_sistema = changes.valorSistema;
  if (changes.valorRecebidoFisico !== undefined) payload.valor_recebido_fisico = changes.valorRecebidoFisico;
  if (changes.trocoSobra !== undefined) payload.troco_sobra = changes.trocoSobra;
  if (changes.justificativaTexto !== undefined) payload.justificativa_texto = changes.justificativaTexto;
  
  await update(ref(db, `transacoes/${turnoId}/${transacaoId}`), payload);
}

export async function removerFantasma(turnoId: string, fantasmaId: string): Promise<void> {
  const db = getRealtimeDatabase();
  await set(ref(db, `fantasmas_lembretes/${turnoId}/${fantasmaId}`), null);
}

export async function removerTurnoTotal(turnoId: string): Promise<void> {
  const db = getRealtimeDatabase();
  // Remove o turno e todos os registros vinculados a ele
  await Promise.all([
    set(ref(db, `turnos/${turnoId}`), null),
    set(ref(db, `transacoes/${turnoId}`), null),
    set(ref(db, `fantasmas_lembretes/${turnoId}`), null),
  ]);
}

export async function atualizarFantasmaCompleto(
  turnoId: string,
  fantasmaId: string,
  changes: Partial<AddFantasmaInput & { resolvido: boolean; comprovado_pix: boolean }>
): Promise<void> {
  const payload: Record<string, any> = {};
  if (changes.tipo) payload.tipo = changes.tipo;
  if (changes.pessoa !== undefined) payload.pessoa = changes.pessoa;
  if (changes.descricao !== undefined) payload.descricao = changes.descricao;
  if (changes.valorReferencia !== undefined) payload.valor_referencia = changes.valorReferencia;
  if (changes.impactaPixRepasse !== undefined) payload.impacta_pix_repasse = changes.impactaPixRepasse;
  if (changes.resolvido !== undefined) payload.resolvido = changes.resolvido;
  if (changes.comprovado_pix !== undefined) payload.comprovado_pix = changes.comprovado_pix;
  
  await update(ref(getRealtimeDatabase(), `fantasmas_lembretes/${turnoId}/${fantasmaId}`), payload);
}
