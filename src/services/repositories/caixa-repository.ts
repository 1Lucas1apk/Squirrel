import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc as fsUpdateDoc,
  deleteDoc,
  addDoc,
  onSnapshot,
  query,
} from "firebase/firestore";
import {
  DataSnapshot,
  get,
  onValue,
  push,
  ref,
  set,
  update as rtdbUpdate,
} from "firebase/database";
import { onAuthStateChanged } from "firebase/auth";

import {
  DividaCliente,
  LembreteFantasma,
  StatusConferencia,
  TipoFantasma,
  TotaisTurno,
  Transacao,
  Turno,
  ContagemCedulas,
  LogAlteracao
} from "../../types/domain";
import { getFirestoreDb, getFirebaseAuth } from "../firebase/client";
import { getRealtimeDatabase } from "../firebase/realtime";

export type Unsubscribe = () => void;

function isLegacy(id: string) {
  return id.startsWith("-");
}

async function getUserIdAsync(): Promise<string> {
  const auth = getFirebaseAuth();
  if (auth.currentUser) return auth.currentUser.uid;

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      unsub();
      reject(new Error("Timeout esperando autenticação"));
    }, 8000);

    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        clearTimeout(timeout);
        unsub();
        resolve(user.uid);
      }
    });
  });
}

function toMoney(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round((parsed + Number.EPSILON) * 100) / 100;
}

// -------------------------
// MAPPERS (Unificados)
// -------------------------
function mapTurno(id: string, data: any): Turno {
  const metadados = data.metadados || {};
  const totais = data.totais || {};
  const contagem = data.contagem_cedulas || null;

  return {
    id,
    caixaId: data.caixa_id ? String(data.caixa_id) : undefined,
    operadorId: data.operador_id ? String(data.operador_id) : undefined,
    dataReferencia: String(data.data_referencia || ""),
    statusTurno: data.status_turn || data.status_turno || "aberto",
    ajusteManualSobra: Number(data.ajuste_manual_sobra || 0),
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
      sistema: Number(totais.sistema || 0),
      sobra: Number(totais.sobra || 0),
      gavetaFisico: Number(totais.gaveta_fisico || 0),
      especieEnvelope: Number(totais.especie_envelope || 0),
      pixRepasse: Number(totais.pix_repasse || 0),
      pixNoCaixa: Number(totais.pix_no_caixa || 0),
      pixDiretoLoja: Number(totais.pix_direto_loja || 0),
    },
    criadoEm: Number(metadados.criado_em || Date.now()),
    atualizadoEm: Number(metadados.atualizado_em || Date.now()),
    repassado: Boolean(data.repassado),
    notaDia: data.nota_dia ? String(data.nota_dia) : undefined,
  };
}

function mapTransacao(id: string, item: any): Transacao {
  return {
    id,
    clientLocalId: item.client_local_id ? String(item.client_local_id) : undefined,
    timestamp: Number(item.timestamp || 0),
    naturezaOperacao: item.natureza_operacao || "pagamento",
    categoria: item.categoria || "dinheiro",
    descricao: String(item.descricao || ""),
    codigoContrato: item.codigo_contrato ? String(item.codigo_contrato) : undefined,
    valorSistema: toMoney(item.valor_sistema),
    valorRecebidoFisico: toMoney(item.valor_recebido_fisico),
    trocoSobra: toMoney(item.troco_sobra),
    statusConferencia: item.status_conferencia || "pendente",
    justificativaTexto: item.justificativa_texto || null,
    transacaoVinculadaId: item.transacao_vinculada_id ? String(item.transacao_vinculada_id) : undefined,
  };
}

function mapFantasma(id: string, item: any): LembreteFantasma {
  return {
    id,
    clientLocalId: item.client_local_id ? String(item.client_local_id) : undefined,
    timestamp: Number(item.timestamp || 0),
    tipo: item.tipo || "outro",
    pessoa: item.pessoa ? String(item.pessoa) : undefined,
    descricao: String(item.descricao || ""),
    valorReferencia: toMoney(item.valor_referencia),
    impactaPixRepasse: Boolean(item.impacta_pix_repasse),
    destinoPix: item.destino_pix ? String(item.destino_pix) : undefined,
    transacaoVinculadaId: item.transacao_vinculada_id ? String(item.transacao_vinculada_id) : undefined,
    resolvido: Boolean(item.resolvido),
    comprovadoPix: Boolean(item.comprovado_pix),
  };
}

function mapLog(id: string, item: any, transacaoId?: string): LogAlteracao {
  return {
    id,
    transacaoId: transacaoId || item.transacaoId || "",
    timestamp: Number(item.timestamp || 0),
    valorAntigo: toMoney(item.valorAntigo),
    valorNovo: toMoney(item.valorNovo),
    campoAlterado: String(item.campoAlterado || ""),
    motivo: item.motivo ? String(item.motivo) : undefined,
  };
}

// -------------------------
// REPOSITORY METHODS
// -------------------------

export async function criarNovoTurno(dataReferencia: string): Promise<Turno> {
  const uid = await getUserIdAsync();
  const db = getFirestoreDb();
  const timestamp = Date.now();
  
  // Caixas NOVOS são criados exclusivamente no Firestore
  const newTurnoRef = doc(collection(db, `users/${uid}/turnos`));
  await setDoc(newTurnoRef, {
    data_referencia: dataReferencia,
    status_turno: "aberto",
    ajuste_manual_sobra: 0,
    metadados: { criado_em: timestamp, atualizado_em: timestamp },
  });
  
  return mapTurno(newTurnoRef.id, {
    data_referencia: dataReferencia,
    status_turno: "aberto",
    ajuste_manual_sobra: 0,
    metadados: { criado_em: timestamp, atualizado_em: timestamp },
  });
}

export async function buscarUltimoTurnoAberto(): Promise<Turno | null> {
  // Lista todos e pega o último
  const turnos = await listarTurnosRecentes();
  const abertos = turnos.filter(t => t.statusTurno === "aberto");
  return abertos[0] || null;
}

export async function listarTurnosRecentes(): Promise<Turno[]> {
  const uid = await getUserIdAsync();
  const dbFS = getFirestoreDb();
  const dbRTDB = getRealtimeDatabase();
  
  const allTurnos: Turno[] = [];

  // Busca do Firestore (Novos)
  try {
    const fsSnap = await getDocs(collection(dbFS, `users/${uid}/turnos`));
    fsSnap.docs.forEach(d => allTurnos.push(mapTurno(d.id, d.data())));
  } catch (e) {
    console.warn("Erro ao buscar turnos do Firestore", e);
  }

  // Busca do Realtime (Legados)
  try {
    const rtSnap = await get(ref(dbRTDB, `users/${uid}/turnos`));
    const raw = (rtSnap.val() as Record<string, any>) || {};
    Object.entries(raw).forEach(([id, data]) => {
      allTurnos.push(mapTurno(id, data));
    });
  } catch (e) {
    console.warn("Erro ao buscar turnos do RTDB", e);
  }

  return allTurnos.sort((a, b) => {
    // Ordena por data decrescente e por criadoEm se forem da mesma data
    if (b.dataReferencia !== a.dataReferencia) {
      return b.dataReferencia.localeCompare(a.dataReferencia);
    }
    return b.criadoEm - a.criadoEm;
  });
}

export async function buscarTurnoPorId(turnoId: string): Promise<Turno | null> {
  const uid = await getUserIdAsync();
  if (isLegacy(turnoId)) {
    const snapshot = await get(ref(getRealtimeDatabase(), `users/${uid}/turnos/${turnoId}`));
    return snapshot.exists() ? mapTurno(turnoId, snapshot.val()) : null;
  } else {
    const docSnap = await getDoc(doc(getFirestoreDb(), `users/${uid}/turnos/${turnoId}`));
    return docSnap.exists() ? mapTurno(turnoId, docSnap.data()) : null;
  }
}

// OUVINTES (DUAL)
export function ouvirTurno(turnoId: string, onData: (turno: Turno) => void): Unsubscribe {
  let isUnsubscribed = false;
  getUserIdAsync().then(uid => {
    if (isUnsubscribed) return;
    if (isLegacy(turnoId)) {
      onValue(ref(getRealtimeDatabase(), `users/${uid}/turnos/${turnoId}`), (snap) => {
        if (snap.exists()) onData(mapTurno(turnoId, snap.val()));
      });
    } else {
      onSnapshot(doc(getFirestoreDb(), `users/${uid}/turnos/${turnoId}`), (snap) => {
        if (snap.exists()) onData(mapTurno(turnoId, snap.data()));
      });
    }
  });
  return () => { isUnsubscribed = true; };
}

export function ouvirTransacoes(turnoId: string, onData: (transacoes: Transacao[]) => void): Unsubscribe {
  let isUnsubscribed = false;
  getUserIdAsync().then(uid => {
    if (isUnsubscribed) return;
    if (isLegacy(turnoId)) {
      onValue(ref(getRealtimeDatabase(), `users/${uid}/transacoes/${turnoId}`), (snap) => {
        const raw = snap.val() || {};
        const arr = Object.entries(raw).map(([id, data]) => mapTransacao(id, data));
        onData(arr.sort((a, b) => b.timestamp - a.timestamp));
      });
    } else {
      const q = query(collection(getFirestoreDb(), `users/${uid}/turnos/${turnoId}/transacoes`));
      onSnapshot(q, (snap) => {
        const arr = snap.docs.map(d => mapTransacao(d.id, d.data()));
        onData(arr.sort((a, b) => b.timestamp - a.timestamp));
      });
    }
  });
  return () => { isUnsubscribed = true; };
}

export function ouvirFantasmas(turnoId: string, onData: (fantasmas: LembreteFantasma[]) => void): Unsubscribe {
  let isUnsubscribed = false;
  getUserIdAsync().then(uid => {
    if (isUnsubscribed) return;
    if (isLegacy(turnoId)) {
      onValue(ref(getRealtimeDatabase(), `users/${uid}/fantasmas_lembretes/${turnoId}`), (snap) => {
        const raw = snap.val() || {};
        const arr = Object.entries(raw).map(([id, data]) => mapFantasma(id, data));
        onData(arr.sort((a, b) => b.timestamp - a.timestamp));
      });
    } else {
      const q = query(collection(getFirestoreDb(), `users/${uid}/turnos/${turnoId}/fantasmas_lembretes`));
      onSnapshot(q, (snap) => {
        const arr = snap.docs.map(d => mapFantasma(d.id, d.data()));
        onData(arr.sort((a, b) => b.timestamp - a.timestamp));
      });
    }
  });
  return () => { isUnsubscribed = true; };
}

export function ouvirLogsAuditoria(turnoId: string, onData: (logs: LogAlteracao[]) => void): Unsubscribe {
  let isUnsubscribed = false;
  getUserIdAsync().then(uid => {
    if (isUnsubscribed) return;
    if (isLegacy(turnoId)) {
      onValue(ref(getRealtimeDatabase(), `users/${uid}/logs_auditoria/${turnoId}`), (snap) => {
        const raw = snap.val() || {};
        const arr: LogAlteracao[] = [];
        Object.entries(raw).forEach(([tId, logsObj]: [string, any]) => {
          Object.entries(logsObj).forEach(([id, data]) => arr.push(mapLog(id, data, tId)));
        });
        onData(arr.sort((a, b) => b.timestamp - a.timestamp));
      });
    } else {
      const q = query(collection(getFirestoreDb(), `users/${uid}/turnos/${turnoId}/logs_auditoria`));
      onSnapshot(q, (snap) => {
        const arr = snap.docs.map(d => mapLog(d.id, d.data()));
        onData(arr.sort((a, b) => b.timestamp - a.timestamp));
      });
    }
  });
  return () => { isUnsubscribed = true; };
}

// -------------------------
// ESCRITAS (Roteadas pelo ID)
// -------------------------

export async function salvarAjusteSobra(turnoId: string, ajuste: number): Promise<void> {
  const uid = await getUserIdAsync();
  const tsKey = isLegacy(turnoId) ? "metadados/atualizado_em" : "metadados.atualizado_em";
  const payload = { ajuste_manual_sobra: ajuste, [tsKey]: Date.now() };
  if (isLegacy(turnoId)) await rtdbUpdate(ref(getRealtimeDatabase(), `users/${uid}/turnos/${turnoId}`), payload);
  else await fsUpdateDoc(doc(getFirestoreDb(), `users/${uid}/turnos/${turnoId}`), payload);
}

export async function salvarNotaDia(turnoId: string, texto: string): Promise<void> {
  const uid = await getUserIdAsync();
  const tsKey = isLegacy(turnoId) ? "metadados/atualizado_em" : "metadados.atualizado_em";
  const payload = { nota_dia: texto, [tsKey]: Date.now() };
  if (isLegacy(turnoId)) await rtdbUpdate(ref(getRealtimeDatabase(), `users/${uid}/turnos/${turnoId}`), payload);
  else await fsUpdateDoc(doc(getFirestoreDb(), `users/${uid}/turnos/${turnoId}`), payload);
}

export async function salvarTotaisTurno(turnoId: string, totais: TotaisTurno): Promise<void> {
  const uid = await getUserIdAsync();
  const tsKey = isLegacy(turnoId) ? "metadados/atualizado_em" : "metadados.atualizado_em";
  const payload = { 
    totais: { 
      sistema: totais.sistema, sobra: totais.sobra, gaveta_fisico: totais.gavetaFisico, 
      especie_envelope: totais.especieEnvelope, pix_repasse: totais.pixRepasse,
      pix_no_caixa: totais.pixNoCaixa, pix_direto_loja: totais.pixDiretoLoja
    }, 
    [tsKey]: Date.now() 
  };
  if (isLegacy(turnoId)) await rtdbUpdate(ref(getRealtimeDatabase(), `users/${uid}/turnos/${turnoId}`), payload);
  else await fsUpdateDoc(doc(getFirestoreDb(), `users/${uid}/turnos/${turnoId}`), payload);
}

export async function salvarContagemCedulas(turnoId: string, contagem: ContagemCedulas): Promise<void> {
  const uid = await getUserIdAsync();
  const tsKey = isLegacy(turnoId) ? "metadados/atualizado_em" : "metadados.atualizado_em";
  const payload = { contagem_cedulas: contagem, [tsKey]: Date.now() };
  if (isLegacy(turnoId)) await rtdbUpdate(ref(getRealtimeDatabase(), `users/${uid}/turnos/${turnoId}`), payload);
  else await fsUpdateDoc(doc(getFirestoreDb(), `users/${uid}/turnos/${turnoId}`), payload);
}

export async function atualizarIdentificacao(turnoId: string, caixaId: string, operadorId: string): Promise<void> {
  const uid = await getUserIdAsync();
  const tsKey = isLegacy(turnoId) ? "metadados/atualizado_em" : "metadados.atualizado_em";
  const payload = { caixa_id: caixaId, operador_id: operadorId, [tsKey]: Date.now() };
  if (isLegacy(turnoId)) await rtdbUpdate(ref(getRealtimeDatabase(), `users/${uid}/turnos/${turnoId}`), payload);
  else await fsUpdateDoc(doc(getFirestoreDb(), `users/${uid}/turnos/${turnoId}`), payload);
}

export async function adicionarTransacao(turnoId: string, input: any): Promise<string> {
  const uid = await getUserIdAsync();
  const payload = {
    client_local_id: input.clientLocalId || null,
    timestamp: Date.now(),
    natureza_operacao: input.naturezaOperacao,
    categoria: input.categoria,
    descricao: input.descricao,
    codigo_contrato: input.codigoContrato || null,
    valor_sistema: input.valorSistema,
    valor_recebido_fisico: input.valorRecebidoFisico,
    troco_sobra: input.trocoSobra,
    status_conferencia: input.statusConferencia || "pendente",
    justificativa_texto: input.justificativaTexto ?? null,
    transacao_vinculada_id: input.transacaoVinculadaId || null,
  };

  if (isLegacy(turnoId)) {
    const created = push(ref(getRealtimeDatabase(), `users/${uid}/transacoes/${turnoId}`));
    await set(created, payload);
    return created.key as string;
  } else {
    const created = doc(collection(getFirestoreDb(), `users/${uid}/turnos/${turnoId}/transacoes`));
    await setDoc(created, payload);
    return created.id;
  }
}

export async function editarTransacao(turnoId: string, id: string, input: any): Promise<void> {
  const uid = await getUserIdAsync();
  const payload: Record<string, any> = {};
  if (input.naturezaOperacao !== undefined) payload.natureza_operacao = input.naturezaOperacao;
  if (input.categoria !== undefined) payload.categoria = input.categoria;
  if (input.descricao !== undefined) payload.descricao = input.descricao;
  if (input.codigoContrato !== undefined) payload.codigo_contrato = input.codigoContrato || null;
  if (input.valorSistema !== undefined) payload.valor_sistema = input.valorSistema;
  if (input.valorRecebidoFisico !== undefined) payload.valor_recebido_fisico = input.valorRecebidoFisico;
  if (input.trocoSobra !== undefined) payload.troco_sobra = input.trocoSobra;
  if (input.statusConferencia !== undefined) payload.status_conferencia = input.statusConferencia;
  if (input.justificativaTexto !== undefined) payload.justificativa_texto = input.justificativaTexto || null;
  if (input.transacaoVinculadaId !== undefined) payload.transacao_vinculada_id = input.transacaoVinculadaId || null;

  if (isLegacy(turnoId)) await rtdbUpdate(ref(getRealtimeDatabase(), `users/${uid}/transacoes/${turnoId}/${id}`), payload);
  else await fsUpdateDoc(doc(getFirestoreDb(), `users/${uid}/turnos/${turnoId}/transacoes/${id}`), payload);
}

export async function removerTransacao(turnoId: string, id: string): Promise<void> {
  const uid = await getUserIdAsync();
  if (isLegacy(turnoId)) {
    await Promise.all([
      set(ref(getRealtimeDatabase(), `users/${uid}/transacoes/${turnoId}/${id}`), null),
      set(ref(getRealtimeDatabase(), `users/${uid}/logs_auditoria/${turnoId}/${id}`), null)
    ]);
  } else {
    await deleteDoc(doc(getFirestoreDb(), `users/${uid}/turnos/${turnoId}/transacoes/${id}`));
    // No firestore, audioria é flat, não precisamos apagar aqui se não quisermos, ou podemos fazer uma query e apagar
  }
}

export async function adicionarFantasma(turnoId: string, input: any): Promise<string> {
  const uid = await getUserIdAsync();
  const payload = {
    client_local_id: input.clientLocalId || null,
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
  };

  if (isLegacy(turnoId)) {
    const created = push(ref(getRealtimeDatabase(), `users/${uid}/fantasmas_lembretes/${turnoId}`));
    await set(created, payload);
    return created.key as string;
  } else {
    const created = doc(collection(getFirestoreDb(), `users/${uid}/turnos/${turnoId}/fantasmas_lembretes`));
    await setDoc(created, payload);
    return created.id;
  }
}

export async function atualizarFantasmaCompleto(turnoId: string, id: string, changes: any): Promise<void> {
  const uid = await getUserIdAsync();
  const payload: Record<string, any> = {};
  if (changes.tipo) payload.tipo = changes.tipo;
  if (changes.pessoa !== undefined) payload.pessoa = changes.pessoa;
  if (changes.descricao !== undefined) payload.descricao = changes.descricao;
  if (changes.valorReferencia !== undefined) payload.valor_referencia = changes.valorReferencia;
  if (changes.impactaPixRepasse !== undefined) payload.impacta_pix_repasse = changes.impactaPixRepasse;
  if (changes.destinoPix !== undefined) payload.destino_pix = changes.destinoPix;
  if (changes.transacaoVinculadaId !== undefined) payload.transacao_vinculada_id = changes.transacaoVinculadaId;
  if (changes.resolvido !== undefined) payload.resolvido = changes.resolvido;
  if (changes.comprovadoPix !== undefined) payload.comprovado_pix = changes.comprovadoPix;

  if (isLegacy(turnoId)) await rtdbUpdate(ref(getRealtimeDatabase(), `users/${uid}/fantasmas_lembretes/${turnoId}/${id}`), payload);
  else await fsUpdateDoc(doc(getFirestoreDb(), `users/${uid}/turnos/${turnoId}/fantasmas_lembretes/${id}`), payload);
}

export async function removerFantasma(turnoId: string, id: string): Promise<void> {
  const uid = await getUserIdAsync();
  if (isLegacy(turnoId)) await set(ref(getRealtimeDatabase(), `users/${uid}/fantasmas_lembretes/${turnoId}/${id}`), null);
  else await deleteDoc(doc(getFirestoreDb(), `users/${uid}/turnos/${turnoId}/fantasmas_lembretes/${id}`));
}

export async function registrarLogAlteracao(turnoId: string, transacaoId: string, log: Omit<LogAlteracao, "id" | "timestamp" | "transacaoId">): Promise<void> {
  const uid = await getUserIdAsync();
  const payload = {
    transacaoId,
    ...log,
    timestamp: Date.now(),
  };

  if (isLegacy(turnoId)) {
    const created = push(ref(getRealtimeDatabase(), `users/${uid}/logs_auditoria/${turnoId}/${transacaoId}`));
    await set(created, payload);
  } else {
    await addDoc(collection(getFirestoreDb(), `users/${uid}/turnos/${turnoId}/logs_auditoria`), payload);
  }
}

export async function atualizarStatusTurno(
  turnoId: string, 
  status: "aberto" | "fechado", 
  extra?: { bateuFisico?: boolean; observacoes?: string }
): Promise<void> {
  const uid = await getUserIdAsync();
  const tsKey = isLegacy(turnoId) ? "metadados/atualizado_em" : "metadados.atualizado_em";
  const payload: Record<string, any> = {
    status_turno: status,
    [tsKey]: Date.now(),
  };

  if (extra) {
    if (extra.bateuFisico !== undefined) payload.bateu_fisico = extra.bateuFisico;
    if (extra.observacoes !== undefined) payload.observacoes_fechamento = extra.observacoes;
  }

  if (isLegacy(turnoId)) await rtdbUpdate(ref(getRealtimeDatabase(), `users/${uid}/turnos/${turnoId}`), payload);
  else await fsUpdateDoc(doc(getFirestoreDb(), `users/${uid}/turnos/${turnoId}`), payload);
}

export async function atualizarStatusRepasse(turnoId: string, repassado: boolean): Promise<void> {
  const uid = await getUserIdAsync();
  const tsKey = isLegacy(turnoId) ? "metadados/atualizado_em" : "metadados.atualizado_em";
  const payload = { repassado, [tsKey]: Date.now() };
  if (isLegacy(turnoId)) await rtdbUpdate(ref(getRealtimeDatabase(), `users/${uid}/turnos/${turnoId}`), payload);
  else await fsUpdateDoc(doc(getFirestoreDb(), `users/${uid}/turnos/${turnoId}`), payload);
}

export async function removerTurnoTotal(turnoId: string): Promise<void> {
  const uid = await getUserIdAsync();
  if (isLegacy(turnoId)) {
    await Promise.all([
      set(ref(getRealtimeDatabase(), `users/${uid}/turnos/${turnoId}`), null),
      set(ref(getRealtimeDatabase(), `users/${uid}/transacoes/${turnoId}`), null),
      set(ref(getRealtimeDatabase(), `users/${uid}/fantasmas_lembretes/${turnoId}`), null),
      set(ref(getRealtimeDatabase(), `users/${uid}/logs_auditoria/${turnoId}`), null),
    ]);
  } else {
    // Delete subcollections? No need strictly for testing, but let's delete the doc
    await deleteDoc(doc(getFirestoreDb(), `users/${uid}/turnos/${turnoId}`));
  }
}

export async function atualizarConferenciaTransacao(turnoId: string, id: string, status: string): Promise<void> {
  const uid = await getUserIdAsync();
  if (isLegacy(turnoId)) await rtdbUpdate(ref(getRealtimeDatabase(), `users/${uid}/transacoes/${turnoId}/${id}`), { status_conferencia: status });
  else await fsUpdateDoc(doc(getFirestoreDb(), `users/${uid}/turnos/${turnoId}/transacoes/${id}`), { status_conferencia: status });
}

export async function migrarDadosAntigos(): Promise<void> {}
