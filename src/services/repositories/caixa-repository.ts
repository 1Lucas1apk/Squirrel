import {
  collection,
  doc,
  getDoc,
  getDocs,
  getDocsFromCache,
  setDoc,
  updateDoc as fsUpdateDoc,
  deleteDoc,
  addDoc,
  onSnapshot,
  query,
  where,
  limit,
  writeBatch,
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
  LogAlteracao,
  RegistroPOS,
  RegistroConvenio,
  LedgerEvent
} from "../../types/domain";
import { getFirestoreDb, getFirebaseAuth } from "../firebase/client";
import { getRealtimeDatabase } from "../firebase/realtime";
import { getUid, saveUid } from "../auth-storage";
import { getDeviceIdAsync, getNextSequence } from "../device-service";

export type Unsubscribe = () => void;

function isLegacy(id: string) {
  return id.startsWith("-");
}

export async function getUserIdAsync(): Promise<string> {
  const auth = getFirebaseAuth();
  if (auth.currentUser?.uid) return auth.currentUser.uid;

  // Fallback 1: UID salvo no SecureStore (0ms de resposta offline imediata!)
  const storedUid = await getUid();
  if (storedUid) {
    return storedUid;
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      unsub();
      reject(new Error("Timeout esperando autenticação. Nenhum UID em cache."));
    }, 2000);

    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        clearTimeout(timeout);
        unsub();
        void saveUid(user.uid);
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
  const contagem = data.contagem_cedulas || data.contagemCedulas || null;

  return {
    id,
    caixaId: data.caixa_id || data.caixaId ? String(data.caixa_id || data.caixaId) : undefined,
    operadorId: data.operador_id || data.operadorId ? String(data.operador_id || data.operadorId) : undefined,
    dataReferencia: String(data.data_referencia || data.dataReferencia || ""),
    statusTurno: data.status_turn || data.status_turno || data.statusTurno || "aberto",
    ajusteManualSobra: Number(data.ajuste_manual_sobra || data.ajusteManualSobra || 0),
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
      gavetaFisico: Number(totais.gaveta_fisico || totais.gavetaFisico || 0),
      especieEnvelope: Number(totais.especie_envelope || totais.especieEnvelope || 0),
      pixRepasse: Number(totais.pix_repasse || totais.pixRepasse || 0),
      pixNoCaixa: Number(totais.pix_no_caixa || totais.pixNoCaixa || 0),
      pixDiretoLoja: Number(totais.pix_direto_loja || totais.pixDiretoLoja || 0),
      totalPOS: Number(totais.total_pos || totais.totalPOS || 0),
      totalConvenio: Number(totais.total_convenio || totais.totalConvenio || 0),
    },
    criadoEm: Number(metadados.criado_em || data.criadoEm || Date.now()),
    atualizadoEm: Number(metadados.atualizado_em || data.atualizadoEm || Date.now()),
    repassado: Boolean(data.repassado),
    notaDia: data.nota_dia || data.notaDia ? String(data.nota_dia || data.notaDia) : undefined,
    posRelatorioTotal: data.pos_relatorio_total !== undefined ? Number(data.pos_relatorio_total) : data.posRelatorioTotal !== undefined ? Number(data.posRelatorioTotal) : undefined,
    excluido: Boolean(data.excluido),
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

function mapRegistroPOS(id: string, item: any): RegistroPOS {
  return {
    id,
    timestamp: Number(item.timestamp || 0),
    tipo: item.tipo || "cartao",
    descricao: String(item.descricao || ""),
    valor: toMoney(item.valor),
    statusConferencia: item.status_conferencia || "pendente",
  };
}

function mapRegistroConvenio(id: string, item: any): RegistroConvenio {
  return {
    id,
    timestamp: Number(item.timestamp || 0),
    nome: String(item.nome || ""),
    valor: toMoney(item.valor),
    descricao: item.descricao ? String(item.descricao) : undefined,
    statusConferencia: item.status_conferencia || "pendente",
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
  try {
    const uid = await getUserIdAsync();
    const dbFS = getFirestoreDb();
    const colRef = collection(dbFS, `users/${uid}/turnos`);
    
    // Busca direta ultra-rápida (Lê apenas 1 documento aberto em vez de centenas de dias antigos)
    const q = query(colRef, where("statusTurno", "==", "aberto"), limit(1));
    const snap = await Promise.race([
      getDocs(q),
      new Promise<any>((_, rej) => setTimeout(() => rej(new Error("timeout")), 1500))
    ]).catch(() => getDocsFromCache(q).catch(() => null));

    if (snap && !snap.empty) {
      const d = snap.docs[0];
      return mapTurno(d.id, d.data());
    }
  } catch (e) {
    console.warn("[caixa-repo] Erro na busca rápida do turno aberto:", e);
  }
  return null;
}

export async function listarTurnosRecentes(): Promise<Turno[]> {
  const uid = await getUserIdAsync();
  const dbFS = getFirestoreDb();
  const dbRTDB = getRealtimeDatabase();

  const allTurnos: Turno[] = [];

  // Busca do Firestore (Novos)
  try {
    const colRef = collection(dbFS, `users/${uid}/turnos`);
    let fsSnap;
    try {
      // Tenta buscar do servidor com timeout de 3 segundos
      fsSnap = await Promise.race([
        getDocs(colRef),
        new Promise<any>((_, rej) => setTimeout(() => rej(new Error("timeout")), 3000))
      ]);
    } catch (err) {
      // Se a internet falhar ou estiver muito lenta, força a leitura do cache offline local
      fsSnap = await getDocsFromCache(colRef);
    }
    fsSnap.docs.forEach((d: any) => {
      const mapped = mapTurno(d.id, d.data());
      if (mapped.dataReferencia && mapped.dataReferencia.trim().length >= 8) {
        allTurnos.push(mapped);
      }
    });
  } catch (e) {
    console.warn("Erro ao buscar turnos do Firestore", e);
  }

  // Busca do Realtime (Legados)
  try {
    const rtSnap = await Promise.race([
      get(ref(dbRTDB, `users/${uid}/turnos`)),
      new Promise<any>((_, rej) => setTimeout(() => rej(new Error("rtdb_timeout")), 1000))
    ]);
    const raw = (rtSnap?.val() as Record<string, any>) || {};
    Object.entries(raw).forEach(([id, data]) => {
      const mapped = mapTurno(id, data);
      if (mapped.dataReferencia && mapped.dataReferencia.trim().length >= 8) {
        allTurnos.push(mapped);
      }
    });
  } catch (e) {
    // RTDB offline ou timeout (ignora silenciosamente)
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
    try {
      const snapshot = await Promise.race([
        get(ref(getRealtimeDatabase(), `users/${uid}/turnos/${turnoId}`)),
        new Promise<any>((_, rej) => setTimeout(() => rej(new Error("timeout")), 1000))
      ]);
      return snapshot && snapshot.exists() ? mapTurno(turnoId, snapshot.val()) : null;
    } catch {
      return null;
    }
  } else {
    const docRef = doc(getFirestoreDb(), `users/${uid}/turnos/${turnoId}`);
    let docSnap: any;
    try {
      docSnap = await Promise.race([
        getDoc(docRef),
        new Promise<any>((_, rej) => setTimeout(() => rej(new Error("timeout")), 1200))
      ]);
    } catch {
      docSnap = await getDoc(docRef).catch(() => null);
    }
    return docSnap && docSnap.exists() ? mapTurno(turnoId, docSnap.data()) : null;
  }
}

// OUVINTES (DUAL)
export function ouvirTurno(turnoId: string, onData: (turno: Turno) => void): Unsubscribe {
  let isUnsubscribed = false;
  let firebaseUnsub: Unsubscribe | null = null;
  getUserIdAsync().then(uid => {
    if (isUnsubscribed) return;
    if (isLegacy(turnoId)) {
      firebaseUnsub = onValue(ref(getRealtimeDatabase(), `users/${uid}/turnos/${turnoId}`), (snap) => {
        if (snap.exists() && !isUnsubscribed) onData(mapTurno(turnoId, snap.val()));
      });
    } else {
      firebaseUnsub = onSnapshot(doc(getFirestoreDb(), `users/${uid}/turnos/${turnoId}`), (snap) => {
        if (snap.exists() && !isUnsubscribed) onData(mapTurno(turnoId, snap.data()));
      });
    }
  });
  return () => {
    isUnsubscribed = true;
    if (firebaseUnsub) firebaseUnsub();
  };
}

export function ouvirTransacoes(turnoId: string, onData: (transacoes: Transacao[], isSuspectEmpty?: boolean) => void): Unsubscribe {
  let isUnsubscribed = false;
  let firebaseUnsub: Unsubscribe | null = null;
  getUserIdAsync().then(uid => {
    if (isUnsubscribed) return;
    if (isLegacy(turnoId)) {
      firebaseUnsub = onValue(ref(getRealtimeDatabase(), `users/${uid}/transacoes/${turnoId}`), (snap) => {
        if (isUnsubscribed) return;
        const raw = snap.val() || {};
        const arr = Object.entries(raw).map(([id, data]) => mapTransacao(id, data));
        onData(arr.sort((a, b) => b.timestamp - a.timestamp), false);
      });
    } else {
      const q = query(collection(getFirestoreDb(), `users/${uid}/turnos/${turnoId}/transacoes`));
      firebaseUnsub = onSnapshot(q, { includeMetadataChanges: true }, (snap) => {
        if (isUnsubscribed) return;
        const isSuspectEmpty = snap.metadata.fromCache && !snap.metadata.hasPendingWrites && snap.empty;
        const arr = snap.docs.map(d => mapTransacao(d.id, d.data()));
        onData(arr.sort((a, b) => b.timestamp - a.timestamp), isSuspectEmpty);
      });
    }
  });
  return () => {
    isUnsubscribed = true;
    if (firebaseUnsub) firebaseUnsub();
  };
}

export function ouvirFantasmas(turnoId: string, onData: (fantasmas: LembreteFantasma[], isSuspectEmpty?: boolean) => void): Unsubscribe {
  let isUnsubscribed = false;
  let firebaseUnsub: Unsubscribe | null = null;
  getUserIdAsync().then(uid => {
    if (isUnsubscribed) return;
    if (isLegacy(turnoId)) {
      firebaseUnsub = onValue(ref(getRealtimeDatabase(), `users/${uid}/fantasmas_lembretes/${turnoId}`), (snap) => {
        if (isUnsubscribed) return;
        const raw = snap.val() || {};
        const arr = Object.entries(raw).map(([id, data]) => mapFantasma(id, data));
        onData(arr.sort((a, b) => b.timestamp - a.timestamp), false);
      });
    } else {
      const q = query(collection(getFirestoreDb(), `users/${uid}/turnos/${turnoId}/fantasmas_lembretes`));
      firebaseUnsub = onSnapshot(q, { includeMetadataChanges: true }, (snap) => {
        if (isUnsubscribed) return;
        const isSuspectEmpty = snap.metadata.fromCache && !snap.metadata.hasPendingWrites && snap.empty;
        const arr = snap.docs.map(d => mapFantasma(d.id, d.data()));
        onData(arr.sort((a, b) => b.timestamp - a.timestamp), isSuspectEmpty);
      });
    }
  });
  return () => {
    isUnsubscribed = true;
    if (firebaseUnsub) firebaseUnsub();
  };
}

export function ouvirLogsAuditoria(turnoId: string, onData: (logs: LogAlteracao[]) => void): Unsubscribe {
  let isUnsubscribed = false;
  let firebaseUnsub: Unsubscribe | null = null;
  getUserIdAsync().then(uid => {
    if (isUnsubscribed) return;
    if (isLegacy(turnoId)) {
      firebaseUnsub = onValue(ref(getRealtimeDatabase(), `users/${uid}/logs_auditoria/${turnoId}`), (snap) => {
        if (isUnsubscribed) return;
        const raw = snap.val() || {};
        const arr: LogAlteracao[] = [];
        Object.entries(raw).forEach(([tId, logsObj]: [string, any]) => {
          Object.entries(logsObj).forEach(([id, data]) => arr.push(mapLog(id, data, tId)));
        });
        onData(arr.sort((a, b) => b.timestamp - a.timestamp));
      });
    } else {
      const q = query(collection(getFirestoreDb(), `users/${uid}/turnos/${turnoId}/logs_auditoria`));
      firebaseUnsub = onSnapshot(q, (snap) => {
        if (isUnsubscribed) return;
        const arr = snap.docs.map(d => mapLog(d.id, d.data()));
        onData(arr.sort((a, b) => b.timestamp - a.timestamp));
      });
    }
  });
  return () => {
    isUnsubscribed = true;
    if (firebaseUnsub) firebaseUnsub();
  };
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
      pix_no_caixa: totais.pixNoCaixa, pix_direto_loja: totais.pixDiretoLoja,
      total_pos: totais.totalPOS, total_convenio: totais.totalConvenio
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

function cleanUndefinedPayload(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(cleanUndefinedPayload);
  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      clean[k] = typeof v === "object" && v !== null ? cleanUndefinedPayload(v) : v;
    }
  }
  return clean;
}

export async function publicarEventoLedger(turnoId: string, evento: LedgerEvent): Promise<void> {
  try {
    const uid = await getUserIdAsync();
    const db = getFirestoreDb();
    const eventRef = doc(db, `users/${uid}/turnos/${turnoId}/ledger_eventos/${evento.id}`);
    const payload = cleanUndefinedPayload({
      ...evento,
      sincronizadoEmServer: Date.now(),
    });
    await setDoc(eventRef, payload);
  } catch (err) {
    console.log("[LedgerRepo] Erro ao publicar evento de ledger:", err);
  }
}

export function ouvirEventosLedger(turnoId: string, onData: (eventos: LedgerEvent[]) => void): Unsubscribe {
  const db = getFirestoreDb();
  let unsubDb: (() => void) | null = null;

  void getUserIdAsync().then(uid => {
    const q = query(collection(db, `users/${uid}/turnos/${turnoId}/ledger_eventos`));
    unsubDb = onSnapshot(q, (snap) => {
      const arr = snap.docs.map(d => ({ id: d.id, ...d.data() } as LedgerEvent));
      onData(arr);
    }, (err) => {
      console.log("[LedgerRepo] Erro ao ouvir eventos:", err);
    });
  });

  return () => {
    unsubDb?.();
  };
}

export async function adicionarTransacao(turnoId: string, input: any): Promise<string> {
  const uid = await getUserIdAsync();
  const deviceId = await getDeviceIdAsync();
  const sequence = getNextSequence();
  const now = Date.now();

  const payload = {
    client_local_id: input.clientLocalId || null,
    timestamp: now,
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
    device_id: deviceId,
    versao: 1,
  };

  let txId: string;
  if (isLegacy(turnoId)) {
    const created = push(ref(getRealtimeDatabase(), `users/${uid}/transacoes/${turnoId}`));
    await set(created, payload);
    txId = created.key as string;
  } else {
    const created = doc(collection(getFirestoreDb(), `users/${uid}/turnos/${turnoId}/transacoes`));
    await setDoc(created, payload);
    txId = created.id;
  }

  // Emite evento imutável no Ledger
  const eventId = `ev_${now}_${Math.random().toString(36).substring(2, 7)}`;
  void publicarEventoLedger(turnoId, {
    id: eventId,
    turnoId,
    transacaoId: txId,
    tipo: input.categoria === "sangria" ? "SANGRIA" : (input.categoria === "suprimento" ? "SUPRIMENTO" : "CRIACAO_TRANSACAO"),
    naturezaOperacao: input.naturezaOperacao,
    categoria: input.categoria,
    descricao: input.descricao,
    codigoContrato: input.codigoContrato,
    valorSistema: input.valorSistema,
    valorRecebidoFisico: input.valorRecebidoFisico,
    trocoSobra: input.trocoSobra,
    justificativaTexto: input.justificativaTexto,
    operadorId: uid,
    operadorNome: input.operadorNome || "Operador",
    deviceId,
    sequence,
    criadoEmDevice: now,
  });

  return txId;
}

export async function editarTransacao(turnoId: string, id: string, input: any): Promise<void> {
  const uid = await getUserIdAsync();
  const deviceId = await getDeviceIdAsync();
  const sequence = getNextSequence();
  const now = Date.now();

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
  payload.versao = (input.versao || 1) + 1;
  payload.device_id = deviceId;
  payload.atualizado_em = now;

  if (isLegacy(turnoId)) await rtdbUpdate(ref(getRealtimeDatabase(), `users/${uid}/transacoes/${turnoId}/${id}`), payload);
  else await fsUpdateDoc(doc(getFirestoreDb(), `users/${uid}/turnos/${turnoId}/transacoes/${id}`), payload);

  // Emite evento imutável de edição no Ledger com baseVersion para detecção de conflitos causais
  const eventId = `ev_edit_${now}_${Math.random().toString(36).substring(2, 7)}`;
  void publicarEventoLedger(turnoId, {
    id: eventId,
    turnoId,
    transacaoId: id,
    tipo: "EDICAO_TRANSACAO",
    naturezaOperacao: input.naturezaOperacao,
    categoria: input.categoria,
    descricao: input.descricao,
    valorSistema: input.valorSistema,
    valorRecebidoFisico: input.valorRecebidoFisico,
    trocoSobra: input.trocoSobra,
    operadorId: uid,
    operadorNome: input.operadorNome || "Operador",
    deviceId,
    sequence,
    baseVersion: input.baseVersion || input.versao || 1,
    criadoEmDevice: now,
    motivo: input.motivo || "Edição no caixa",
  });
}

export async function removerTransacao(turnoId: string, id: string, motivo?: string): Promise<void> {
  const uid = await getUserIdAsync();
  const deviceId = await getDeviceIdAsync();
  const sequence = getNextSequence();
  const now = Date.now();

  if (isLegacy(turnoId)) {
    await Promise.all([
      set(ref(getRealtimeDatabase(), `users/${uid}/transacoes/${turnoId}/${id}`), null),
      set(ref(getRealtimeDatabase(), `users/${uid}/logs_auditoria/${turnoId}/${id}`), null)
    ]);
  } else {
    await deleteDoc(doc(getFirestoreDb(), `users/${uid}/turnos/${turnoId}/transacoes/${id}`));
  }

  // Emite evento imutável de cancelamento no Ledger
  const eventId = `ev_del_${now}_${Math.random().toString(36).substring(2, 7)}`;
  void publicarEventoLedger(turnoId, {
    id: eventId,
    turnoId,
    transacaoId: id,
    tipo: "CANCELAMENTO_TRANSACAO",
    operadorId: uid,
    operadorNome: "Operador",
    deviceId,
    sequence,
    criadoEmDevice: now,
    motivo: motivo || "Remoção de transação",
  });
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
    resolvido: input.resolvido !== undefined ? Boolean(input.resolvido) : false,
    comprovado_pix: input.comprovadoPix !== undefined ? Boolean(input.comprovadoPix) : false
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
    await rtdbUpdate(ref(getRealtimeDatabase(), `users/${uid}/turnos/${turnoId}`), { excluido: true });
  } else {
    // Soft delete: apenas marca como excluído
    await fsUpdateDoc(doc(getFirestoreDb(), `users/${uid}/turnos/${turnoId}`), { excluido: true });
  }
}

export async function deletarTurnoPermanente(turnoId: string): Promise<void> {
  const uid = await getUserIdAsync();
  if (isLegacy(turnoId)) {
    const db = getRealtimeDatabase();
    await set(ref(db, `users/${uid}/turnos/${turnoId}`), null);
    await set(ref(db, `users/${uid}/transacoes/${turnoId}`), null);
    await set(ref(db, `users/${uid}/fantasmas_lembretes/${turnoId}`), null);
    await set(ref(db, `users/${uid}/registros_pos/${turnoId}`), null);
    await set(ref(db, `users/${uid}/registros_convenio/${turnoId}`), null);
    await set(ref(db, `users/${uid}/logs_auditoria/${turnoId}`), null);
    await set(ref(db, `users/${uid}/ledger_eventos/${turnoId}`), null);
  } else {
    const db = getFirestoreDb();

    // 1. Deleta os documentos das subcoleções primeiro (com chunking seguro de até 400 itens por batch)
    const subcollections = ["transacoes", "fantasmas_lembretes", "registros_pos", "registros_convenio", "ledger_eventos", "logs_auditoria"];
    for (const col of subcollections) {
      try {
        const snap = await getDocs(collection(db, `users/${uid}/turnos/${turnoId}/${col}`));
        if (!snap.empty) {
          const docs = snap.docs;
          const CHUNK_SIZE = 400;
          for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
            const chunk = docs.slice(i, i + CHUNK_SIZE);
            const batch = writeBatch(db);
            chunk.forEach(docSnap => batch.delete(docSnap.ref));
            await batch.commit();
          }
        }
      } catch (err) {
        console.warn(`Erro ao limpar subcolecao ${col}:`, err);
      }
    }

    // 2. Apaga o documento principal do turno após limpar todos os filhos
    await deleteDoc(doc(db, `users/${uid}/turnos/${turnoId}`));
  }
}


export async function restaurarTurnoExcluido(turnoId: string): Promise<void> {
  const uid = await getUserIdAsync();
  if (isLegacy(turnoId)) {
    await rtdbUpdate(ref(getRealtimeDatabase(), `users/${uid}/turnos/${turnoId}`), { excluido: false });
  } else {
    await fsUpdateDoc(doc(getFirestoreDb(), `users/${uid}/turnos/${turnoId}`), { excluido: false });
  }
}

export async function atualizarConferenciaTransacao(turnoId: string, id: string, status: string): Promise<void> {
  const uid = await getUserIdAsync();
  if (isLegacy(turnoId)) await rtdbUpdate(ref(getRealtimeDatabase(), `users/${uid}/transacoes/${turnoId}/${id}`), { status_conferencia: status });
  else await fsUpdateDoc(doc(getFirestoreDb(), `users/${uid}/turnos/${turnoId}/transacoes/${id}`), { status_conferencia: status });
}

export async function atualizarConferenciaPOS(turnoId: string, id: string, status: string): Promise<void> {
  const uid = await getUserIdAsync();
  if (isLegacy(turnoId)) await rtdbUpdate(ref(getRealtimeDatabase(), `users/${uid}/registros_pos/${turnoId}/${id}`), { status_conferencia: status });
  else await fsUpdateDoc(doc(getFirestoreDb(), `users/${uid}/turnos/${turnoId}/registros_pos/${id}`), { status_conferencia: status });
}

export async function atualizarConferenciaConvenio(turnoId: string, id: string, status: string): Promise<void> {
  const uid = await getUserIdAsync();
  if (isLegacy(turnoId)) await rtdbUpdate(ref(getRealtimeDatabase(), `users/${uid}/registros_convenio/${turnoId}/${id}`), { status_conferencia: status });
  else await fsUpdateDoc(doc(getFirestoreDb(), `users/${uid}/turnos/${turnoId}/registros_convenio/${id}`), { status_conferencia: status });
}

export async function vincularRegistrosRepository(
  turnoId: string,
  transacaoId: string,
  fantasmaId: string
) {
  const uid = await getUserIdAsync();
  const db = getFirestoreDb();
  const timestamp = Date.now();

  const legacy = isLegacy(turnoId);
  const payloadT = { transacao_vinculada_id: fantasmaId, atualizado_em: timestamp };
  if (legacy) await rtdbUpdate(ref(getRealtimeDatabase(), `users/${uid}/transacoes/${turnoId}/${transacaoId}`), payloadT);
  else await fsUpdateDoc(doc(db, `users/${uid}/turnos/${turnoId}/transacoes/${transacaoId}`), payloadT);

  const payloadF = { transacao_vinculada_id: transacaoId, resolvido: true, comprovado_pix: true, atualizado_em: timestamp };
  if (legacy) await rtdbUpdate(ref(getRealtimeDatabase(), `users/${uid}/fantasmas_lembretes/${turnoId}/${fantasmaId}`), payloadF);
  else await fsUpdateDoc(doc(db, `users/${uid}/turnos/${turnoId}/fantasmas_lembretes/${fantasmaId}`), payloadF);
}

export async function salvarRelatorioPOSTotal(turnoId: string, valor: number): Promise<void> {
  const uid = await getUserIdAsync();
  const tsKey = isLegacy(turnoId) ? "metadados/atualizado_em" : "metadados.atualizado_em";
  const payload = { pos_relatorio_total: valor, [tsKey]: Date.now() };
  if (isLegacy(turnoId)) await rtdbUpdate(ref(getRealtimeDatabase(), `users/${uid}/turnos/${turnoId}`), payload);
  else await fsUpdateDoc(doc(getFirestoreDb(), `users/${uid}/turnos/${turnoId}`), payload);
}

// OUVINTES NOVOS
export function ouvirRegistrosPOS(turnoId: string, onData: (registros: RegistroPOS[], isSuspectEmpty?: boolean) => void): Unsubscribe {
  let isUnsubscribed = false;
  let firebaseUnsub: Unsubscribe | null = null;
  getUserIdAsync().then(uid => {
    if (isUnsubscribed) return;
    if (isLegacy(turnoId)) {
      firebaseUnsub = onValue(ref(getRealtimeDatabase(), `users/${uid}/registros_pos/${turnoId}`), (snap) => {
        if (isUnsubscribed) return;
        const raw = snap.val() || {};
        const arr = Object.entries(raw).map(([id, data]) => mapRegistroPOS(id, data));
        onData(arr.sort((a, b) => b.timestamp - a.timestamp), false);
      });
    } else {
      const q = query(collection(getFirestoreDb(), `users/${uid}/turnos/${turnoId}/registros_pos`));
      firebaseUnsub = onSnapshot(q, { includeMetadataChanges: true }, (snap) => {
        if (isUnsubscribed) return;
        const isSuspectEmpty = snap.metadata.fromCache && !snap.metadata.hasPendingWrites && snap.empty;
        const arr = snap.docs.map(d => mapRegistroPOS(d.id, d.data()));
        onData(arr.sort((a, b) => b.timestamp - a.timestamp), isSuspectEmpty);
      });
    }
  });
  return () => {
    isUnsubscribed = true;
    if (firebaseUnsub) firebaseUnsub();
  };
}

export function ouvirRegistrosConvenio(turnoId: string, onData: (registros: RegistroConvenio[], isSuspectEmpty?: boolean) => void): Unsubscribe {
  let isUnsubscribed = false;
  let firebaseUnsub: Unsubscribe | null = null;
  getUserIdAsync().then(uid => {
    if (isUnsubscribed) return;
    if (isLegacy(turnoId)) {
      firebaseUnsub = onValue(ref(getRealtimeDatabase(), `users/${uid}/registros_convenio/${turnoId}`), (snap) => {
        if (isUnsubscribed) return;
        const raw = snap.val() || {};
        const arr = Object.entries(raw).map(([id, data]) => mapRegistroConvenio(id, data));
        onData(arr.sort((a, b) => b.timestamp - a.timestamp), false);
      });
    } else {
      const q = query(collection(getFirestoreDb(), `users/${uid}/turnos/${turnoId}/registros_convenio`));
      firebaseUnsub = onSnapshot(q, { includeMetadataChanges: true }, (snap) => {
        if (isUnsubscribed) return;
        const isSuspectEmpty = snap.metadata.fromCache && !snap.metadata.hasPendingWrites && snap.empty;
        const arr = snap.docs.map(d => mapRegistroConvenio(d.id, d.data()));
        onData(arr.sort((a, b) => b.timestamp - a.timestamp), isSuspectEmpty);
      });
    }
  });
  return () => {
    isUnsubscribed = true;
    if (firebaseUnsub) firebaseUnsub();
  };
}

// CRUD POS
export async function adicionarRegistroPOS(turnoId: string, input: Omit<RegistroPOS, 'id' | 'timestamp'>): Promise<string> {
  const uid = await getUserIdAsync();
  const payload = {
    tipo: input.tipo,
    descricao: input.descricao,
    valor: input.valor,
    timestamp: Date.now()
  };
  if (isLegacy(turnoId)) {
    const created = push(ref(getRealtimeDatabase(), `users/${uid}/registros_pos/${turnoId}`));
    await set(created, payload);
    return created.key as string;
  } else {
    const created = doc(collection(getFirestoreDb(), `users/${uid}/turnos/${turnoId}/registros_pos`));
    await setDoc(created, payload);
    return created.id;
  }
}

export async function editarRegistroPOS(turnoId: string, id: string, input: Partial<Omit<RegistroPOS, 'id' | 'timestamp'>>): Promise<void> {
  const uid = await getUserIdAsync();
  const payload: Record<string, any> = {};
  if (input.tipo !== undefined) payload.tipo = input.tipo;
  if (input.descricao !== undefined) payload.descricao = input.descricao;
  if (input.valor !== undefined) payload.valor = input.valor;

  if (isLegacy(turnoId)) await rtdbUpdate(ref(getRealtimeDatabase(), `users/${uid}/registros_pos/${turnoId}/${id}`), payload);
  else await fsUpdateDoc(doc(getFirestoreDb(), `users/${uid}/turnos/${turnoId}/registros_pos/${id}`), payload);
}

export async function removerRegistroPOS(turnoId: string, id: string): Promise<void> {
  const uid = await getUserIdAsync();
  if (isLegacy(turnoId)) await set(ref(getRealtimeDatabase(), `users/${uid}/registros_pos/${turnoId}/${id}`), null);
  else await deleteDoc(doc(getFirestoreDb(), `users/${uid}/turnos/${turnoId}/registros_pos/${id}`));
}

// CRUD CONVENIO
export async function adicionarConvenio(turnoId: string, input: Omit<RegistroConvenio, 'id' | 'timestamp'>): Promise<string> {
  const uid = await getUserIdAsync();
  const payload = {
    nome: input.nome,
    valor: input.valor,
    descricao: input.descricao || null,
    timestamp: Date.now()
  };
  if (isLegacy(turnoId)) {
    const created = push(ref(getRealtimeDatabase(), `users/${uid}/registros_convenio/${turnoId}`));
    await set(created, payload);
    return created.key as string;
  } else {
    const created = doc(collection(getFirestoreDb(), `users/${uid}/turnos/${turnoId}/registros_convenio`));
    await setDoc(created, payload);
    return created.id;
  }
}

export async function editarConvenio(turnoId: string, id: string, input: Partial<Omit<RegistroConvenio, 'id' | 'timestamp'>>): Promise<void> {
  const uid = await getUserIdAsync();
  const payload: Record<string, any> = {};
  if (input.nome !== undefined) payload.nome = input.nome;
  if (input.valor !== undefined) payload.valor = input.valor;
  if (input.descricao !== undefined) payload.descricao = input.descricao || null;

  if (isLegacy(turnoId)) await rtdbUpdate(ref(getRealtimeDatabase(), `users/${uid}/registros_convenio/${turnoId}/${id}`), payload);
  else await fsUpdateDoc(doc(getFirestoreDb(), `users/${uid}/turnos/${turnoId}/registros_convenio/${id}`), payload);
}

export async function removerConvenio(turnoId: string, id: string): Promise<void> {
  const uid = await getUserIdAsync();
  if (isLegacy(turnoId)) await set(ref(getRealtimeDatabase(), `users/${uid}/registros_convenio/${turnoId}/${id}`), null);
  else await deleteDoc(doc(getFirestoreDb(), `users/${uid}/turnos/${turnoId}/registros_convenio/${id}`));
}

export async function migrarDadosAntigos(): Promise<void> { }

export async function atualizarTurnoAtivoConta(turnoId: string): Promise<void> {
  try {
    const uid = await getUserIdAsync();
    const docRef = doc(getFirestoreDb(), `users/${uid}`);
    await setDoc(docRef, { activeTurnoId: turnoId }, { merge: true });
  } catch (e) {
    console.error("Erro ao sincronizar dia ativo:", e);
  }
}

export function ouvirTurnoAtivoConta(callback: (turnoId: string | null) => void): Unsubscribe {
  let unsub: Unsubscribe | null = null;
  getUserIdAsync().then(uid => {
    const docRef = doc(getFirestoreDb(), `users/${uid}`);
    unsub = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data?.activeTurnoId) {
          callback(data.activeTurnoId);
        }
      }
    });
  }).catch(e => console.error("Erro ao ouvir dia ativo:", e));

  return () => {
    if (unsub) unsub();
  };
}

// ==================== RESTAURAÇÃO (CTRL+Z) ====================
export async function restaurarSnapshotNuvem(
  currentState: {
    turnoId: string,
    transacoes: Transacao[],
    fantasmas: LembreteFantasma[],
    registrosPOS: RegistroPOS[],
    registrosConvenio: RegistroConvenio[]
  },
  snapshot: any
) {
  const uid = await getUserIdAsync();
  const db = getFirestoreDb();
  const batch = writeBatch(db);
  const turnoRef = doc(db, `users/${uid}/turnos/${currentState.turnoId}`);

  // 1. Restaura dados principais do turno no formato DTO
  batch.set(turnoRef, {
    status_turno: snapshot.turno.statusTurno,
    data_referencia: snapshot.turno.dataReferencia,
    ajuste_manual_sobra: snapshot.turno.ajusteManualSobra ?? 0,
    totais: snapshot.turno.totais,
    pos_relatorio_total: snapshot.turno.posRelatorioTotal ?? 0,
    nota_dia: snapshot.turno.notaDia || "",
    excluido: snapshot.turno.excluido || false,
    metadados: {
      criado_em: snapshot.turno.criadoEm,
      atualizado_em: snapshot.turno.atualizadoEm,
    }
  });

  // 2. Helper para diffing: apaga o que foi criado depois e recria o que foi apagado/editado
  const syncCollection = (
    colName: string,
    currentItems: any[],
    snapshotItems: any[],
    mapToDTO: (item: any) => any
  ) => {
    const snapIds = new Set(snapshotItems.map(x => x.id));

    // Deletar os que existem no estado atual mas não existiam no snapshot
    for (const item of currentItems) {
      if (!snapIds.has(item.id)) {
        batch.delete(doc(db, `users/${uid}/turnos/${currentState.turnoId}/${colName}`, item.id));
      }
    }

    // Inserir ou atualizar os que existem no snapshot no formato correto (DTO)
    for (const item of snapshotItems) {
      if (item.id) {
        batch.set(doc(db, `users/${uid}/turnos/${currentState.turnoId}/${colName}`, item.id), mapToDTO(item));
      }
    }
  };

  syncCollection("transacoes", currentState.transacoes, snapshot.transacoes, (t: Transacao) => ({
    timestamp: t.timestamp,
    natureza_operacao: t.naturezaOperacao,
    categoria: t.categoria,
    descricao: t.descricao || "",
    valor_sistema: t.valorSistema || 0,
    valor_recebido_fisico: t.valorRecebidoFisico || 0,
    troco_sobra: t.trocoSobra || 0,
    status_conferencia: t.statusConferencia || "pendente",
    codigo_contrato: t.codigoContrato || null,
    justificativa_texto: t.justificativaTexto || null,
    transacao_vinculada_id: t.transacaoVinculadaId || null,
    client_local_id: t.clientLocalId || null
  }));

  syncCollection("fantasmas_lembretes", currentState.fantasmas, snapshot.fantasmas, (f: LembreteFantasma) => ({
    client_local_id: f.clientLocalId || null,
    timestamp: f.timestamp,
    tipo: f.tipo || "outro",
    pessoa: f.pessoa || "",
    descricao: f.descricao || "",
    valor_referencia: f.valorReferencia || 0,
    impacta_pix_repasse: Boolean(f.impactaPixRepasse),
    destino_pix: f.destinoPix || null,
    transacao_vinculada_id: f.transacaoVinculadaId || null,
    resolvido: Boolean(f.resolvido),
    comprovado_pix: Boolean(f.comprovadoPix)
  }));

  syncCollection("registros_pos", currentState.registrosPOS, snapshot.registrosPOS || [], (r: RegistroPOS) => ({
    timestamp: r.timestamp,
    tipo: r.tipo || "cartao",
    valor: r.valor || 0,
    descricao: r.descricao || "",
    status_conferencia: r.statusConferencia || "pendente"
  }));

  syncCollection("registros_convenio", currentState.registrosConvenio, snapshot.registrosConvenio || [], (r: RegistroConvenio) => ({
    timestamp: r.timestamp,
    nome: r.nome || "",
    valor: r.valor || 0,
    descricao: r.descricao || "",
    status_conferencia: r.statusConferencia || "pendente"
  }));

  // Executa toda a restauração de forma atômica (tudo ou nada)
  await batch.commit();
}

/** Importa um turno completo com todas as coleções filhas para a nuvem de forma atômica */
export async function importarBackupCompletoNuvem(
  turno: Turno,
  transacoes: Transacao[],
  fantasmas: LembreteFantasma[],
  logs: LogAlteracao[] = [],
  registrosPOS: RegistroPOS[] = [],
  registrosConvenio: RegistroConvenio[] = []
): Promise<void> {
  const uid = await getUserIdAsync();
  const db = getFirestoreDb();
  const batch = writeBatch(db);
  const turnoRef = doc(db, `users/${uid}/turnos/${turno.id}`);

  // 1. Grava documento principal do Turno
  batch.set(turnoRef, {
    status_turno: turno.statusTurno || "aberto",
    data_referencia: turno.dataReferencia,
    ajuste_manual_sobra: turno.ajusteManualSobra ?? 0,
    totais: turno.totais || null,
    pos_relatorio_total: (turno as any).posRelatorioTotal ?? 0,
    nota_dia: (turno as any).notaDia || "",
    excluido: turno.excluido || false,
    repassado: turno.repassado || false,
    metadados: {
      criado_em: turno.criadoEm || Date.now(),
      atualizado_em: Date.now(),
    }
  }, { merge: true });

  // 2. Grava Transações
  for (const t of transacoes) {
    const txId = t.id || doc(collection(db, `users/${uid}/turnos/${turno.id}/transacoes`)).id;
    const txRef = doc(db, `users/${uid}/turnos/${turno.id}/transacoes/${txId}`);
    batch.set(txRef, {
      timestamp: t.timestamp || Date.now(),
      natureza_operacao: t.naturezaOperacao || "pagamento",
      categoria: t.categoria || "dinheiro",
      descricao: t.descricao || "",
      valor_sistema: t.valorSistema ?? 0,
      valor_recebido_fisico: t.valorRecebidoFisico ?? 0,
      troco_sobra: t.trocoSobra ?? 0,
      status_conferencia: t.statusConferencia || "pendente",
      codigo_contrato: (t as any).codigoContrato || (t as any).contrato || null,
      justificativa_texto: t.justificativaTexto || null,
      transacao_vinculada_id: t.transacaoVinculadaId || null,
      client_local_id: t.clientLocalId || null
    }, { merge: true });
  }

  // 3. Grava Fantasmas (Notas)
  for (const f of fantasmas) {
    const fId = f.id || doc(collection(db, `users/${uid}/turnos/${turno.id}/fantasmas_lembretes`)).id;
    const fRef = doc(db, `users/${uid}/turnos/${turno.id}/fantasmas_lembretes/${fId}`);
    batch.set(fRef, {
      client_local_id: f.clientLocalId || null,
      timestamp: f.timestamp || Date.now(),
      tipo: f.tipo || "outro",
      pessoa: f.pessoa || "",
      descricao: f.descricao || "",
      valor_referencia: f.valorReferencia ?? 0,
      impacta_pix_repasse: Boolean(f.impactaPixRepasse),
      destino_pix: f.destinoPix || null,
      transacao_vinculada_id: f.transacaoVinculadaId || null,
      resolvido: Boolean(f.resolvido),
      comprovado_pix: Boolean(f.comprovadoPix)
    }, { merge: true });
  }

  // 4. Grava Registros POS (se houver)
  for (const r of registrosPOS) {
    const rId = r.id || doc(collection(db, `users/${uid}/turnos/${turno.id}/registros_pos`)).id;
    const rRef = doc(db, `users/${uid}/turnos/${turno.id}/registros_pos/${rId}`);
    batch.set(rRef, {
      timestamp: r.timestamp || Date.now(),
      tipo: r.tipo || "cartao",
      valor: r.valor ?? 0,
      descricao: r.descricao || "",
      status_conferencia: r.statusConferencia || "pendente"
    }, { merge: true });
  }

  // 5. Grava Registros Convênio (se houver)
  for (const c of registrosConvenio) {
    const cId = c.id || doc(collection(db, `users/${uid}/turnos/${turno.id}/registros_convenio`)).id;
    const cRef = doc(db, `users/${uid}/turnos/${turno.id}/registros_convenio/${cId}`);
    batch.set(cRef, {
      timestamp: c.timestamp || Date.now(),
      nome: c.nome || "",
      valor: c.valor ?? 0,
      descricao: c.descricao || "",
      status_conferencia: c.statusConferencia || "pendente"
    }, { merge: true });
  }

  await batch.commit();
}
