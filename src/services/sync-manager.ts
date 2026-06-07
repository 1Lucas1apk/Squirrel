import {
  adicionarTransacao,
  editarTransacao,
  removerTransacao,
  adicionarFantasma,
  atualizarFantasmaCompleto,
  removerFantasma,
  atualizarStatusTurno,
  salvarTotaisTurno,
  registrarLogAlteracao
} from "./repositories/caixa-repository";
import { getOfflineQueue, saveOfflineQueue, QueuedAction } from "./local-storage";

export interface SyncStatus {
  isProcessing: boolean;
  pendingCount: number;
  nextRetryAt: number | null;
  lastError: string | null;
  lastSyncedAt: number | null;
  queue: QueuedAction[];
}

class SyncManager {
  private isProcessing = false;
  private listeners: ((isProcessing: boolean) => void)[] = [];
  private statusListeners: ((status: SyncStatus) => void)[] = [];
  private lastError: string | null = null;
  private lastSyncedAt: number | null = null;

  subscribe(listener: (isProcessing: boolean) => void) {
    this.listeners.push(listener);
    listener(this.isProcessing);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  subscribeStatus(listener: (status: SyncStatus) => void) {
    this.statusListeners.push(listener);
    void this.notifyStatus();
    return () => {
      this.statusListeners = this.statusListeners.filter((l) => l !== listener);
    };
  }

  private notifyProcessing() {
    this.listeners.forEach(l => l(this.isProcessing));
  }

  private async notifyStatus() {
    const queue = await getOfflineQueue();
    const nextRetryAt = queue.length > 0
      ? Math.min(...queue.map((item) => item.nextRetryAt ?? 0).filter((value) => value > 0))
      : 0;
    const status: SyncStatus = {
      isProcessing: this.isProcessing,
      pendingCount: queue.length,
      nextRetryAt: nextRetryAt > 0 ? nextRetryAt : null,
      lastError: this.lastError,
      lastSyncedAt: this.lastSyncedAt,
      queue,
    };
    this.statusListeners.forEach((listener) => listener(status));
  }

  private async notify() {
    this.notifyProcessing();
    await this.notifyStatus();
  }

  async getStatusSnapshot(): Promise<SyncStatus> {
    const queue = await getOfflineQueue();
    const nextRetryAt = queue.length > 0
      ? Math.min(...queue.map((item) => item.nextRetryAt ?? 0).filter((value) => value > 0))
      : 0;
    return {
      isProcessing: this.isProcessing,
      pendingCount: queue.length,
      nextRetryAt: nextRetryAt > 0 ? nextRetryAt : null,
      lastError: this.lastError,
      lastSyncedAt: this.lastSyncedAt,
      queue,
    };
  }

  private async rewriteQueueIds(oldId: string, newId: string) {
    if (!oldId || !newId) return;
    const queue = await getOfflineQueue();
    let changed = false;
    const updated = queue.map(a => {
      if (a.payload?.id === oldId) {
        changed = true;
        return { ...a, payload: { ...a.payload, id: newId } };
      }
      if (a.payload?.transacaoId === oldId) {
        changed = true;
        return { ...a, payload: { ...a.payload, transacaoId: newId } };
      }
      return a;
    });
    if (changed) {
      await saveOfflineQueue(updated);
    }
  }

  async removeQueuedAction(actionId: string) {
    const queue = await getOfflineQueue();
    const next = queue.filter((item) => item.id !== actionId);
    await saveOfflineQueue(next);
    await this.notifyStatus();
  }

  async upsertQueuedAction(action: QueuedAction) {
    const queue = await getOfflineQueue();
    const filtered = queue.filter((item) => item.id !== action.id);
    filtered.unshift({
      ...action,
      attempts: action.attempts ?? 0,
      nextRetryAt: action.nextRetryAt ?? 0,
    });
    await saveOfflineQueue(filtered);
    await this.notifyStatus();
    void this.processQueue();
  }

  clearLastError() {
    this.lastError = null;
    void this.notifyStatus();
  }

  async queueAction(action: Omit<QueuedAction, "id" | "timestamp">) {
    const newAction: QueuedAction = {
      ...action,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
      attempts: 0,
      nextRetryAt: 0,
    };

    const queue = await getOfflineQueue();
    queue.push(newAction);
    await saveOfflineQueue(queue);
    await this.notifyStatus();
    
    // Tentamos processar imediatamente
    void this.processQueue();
  }

  async processQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;
    await this.notify();

    try {
      const queue = await getOfflineQueue();
      if (queue.length === 0) {
        this.isProcessing = false;
        await this.notify();
        return;
      }

      console.log(`[SyncManager] Processando fila de ${queue.length} ações...`);

      const remainingActions: QueuedAction[] = [];
      const now = Date.now();
      let syncedAny = false;

      for (const action of queue) {
        if ((action.nextRetryAt ?? 0) > now) {
          remainingActions.push(action);
          continue;
        }

        try {
          await this.withTimeout(this.executeAction(action), 8000, "sync/timeout");
          syncedAny = true;
        } catch (e) {
          console.error(`[SyncManager] Falha ao sincronizar ação ${action.type}:`, e);
          const attempts = (action.attempts ?? 0) + 1;
          const backoffMs = Math.min(60_000, 1000 * 2 ** Math.min(attempts, 6));
          const errorMessage = e instanceof Error ? e.message : String(e);
          this.lastError = `Falha ao sincronizar: ${errorMessage}`;
          remainingActions.push({
            ...action,
            attempts,
            nextRetryAt: Date.now() + backoffMs,
            lastError: errorMessage,
          });
          // Se falhou por rede, paramos o processamento do resto da fila para manter a ordem
          break;
        }
      }

      // Atualiza a fila apenas com o que sobrou
      // Nota: Precisamos reler a fila caso novas ações tenham sido adicionadas durante o processamento
      const currentQueue = await getOfflineQueue();
      const newQueue = [...remainingActions, ...currentQueue.filter(a => !queue.find(qa => qa.id === a.id))];
      await saveOfflineQueue(newQueue);
      if (syncedAny) {
        this.lastSyncedAt = Date.now();
        this.lastError = null;
      }
      await this.notifyStatus();

    } finally {
      this.isProcessing = false;
      await this.notify();
    }
  }

  private withTimeout<T>(promise: Promise<T>, timeoutMs: number, code: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(code)), timeoutMs);
      promise
        .then((value) => {
          clearTimeout(timer);
          resolve(value);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  private async executeAction(action: QueuedAction) {
    const { type, payload } = action;
    switch (type) {
      case "ADD_TRANSACAO": {
        const idT = await adicionarTransacao(payload.turnoId, payload.input);
        await this.rewriteQueueIds(payload.localId, idT);
        break;
      }
      case "EDIT_TRANSACAO":
        await editarTransacao(payload.turnoId, payload.id, payload.input);
        break;
      case "REMOVE_TRANSACAO":
        await removerTransacao(payload.turnoId, payload.id);
        break;
      case "ADD_FANTASMA": {
        const idF = await adicionarFantasma(payload.turnoId, payload.input);
        await this.rewriteQueueIds(payload.localId, idF);
        break;
      }
      case "EDIT_FANTASMA":
        await atualizarFantasmaCompleto(payload.turnoId, payload.id, payload.input);
        break;
      case "REMOVE_FANTASMA":
        await removerFantasma(payload.turnoId, payload.id);
        break;
      case "UPDATE_TURNO_STATUS":
        await atualizarStatusTurno(payload.turnoId, payload.status, payload.extra);
        break;
      case "SAVE_TOTAIS":
        await salvarTotaisTurno(payload.turnoId, payload.totais);
        break;
      case "ADD_LOG":
        await registrarLogAlteracao(payload.turnoId, payload.transacaoId, payload.log);
        break;
    }
  }
}

export const syncManager = new SyncManager();
