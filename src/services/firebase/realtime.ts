import { getDatabase, ref, setPersistenceEnabled } from "firebase/database";

import { getFirebaseApp } from "./client";

export function getRealtimeDatabase() {
  const db = getDatabase(getFirebaseApp());
  // Habilita persistência no disco para modo offline robusto
  try {
    setPersistenceEnabled(db, true);
  } catch (e) {
    console.log("Persistência offline já configurada ou erro ao ativar.");
  }
  return db;
}

export function turnosRef() {
  return ref(getRealtimeDatabase(), "turnos");
}

export function transacoesTurnoRef(turnoId: string) {
  return ref(getRealtimeDatabase(), `transacoes/${turnoId}`);
}

export function fantasmasTurnoRef(turnoId: string) {
  return ref(getRealtimeDatabase(), `fantasmas_lembretes/${turnoId}`);
}
