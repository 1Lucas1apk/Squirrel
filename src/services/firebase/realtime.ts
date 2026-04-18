import { getDatabase, ref } from "firebase/database";

import { getFirebaseApp } from "./client";

export function getRealtimeDatabase() {
  const db = getDatabase(getFirebaseApp());
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
