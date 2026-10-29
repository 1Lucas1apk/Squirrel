import { Platform } from "react-native";

export type LogLevel = "log" | "info" | "warn" | "error";

export interface LogItem {
  id: string;
  timestamp: number;
  timeStr: string;
  level: LogLevel;
  tag?: string;
  message: string;
  stack?: string;
}

type LogListener = (logs: LogItem[]) => void;

const MAX_LOGS = 250;
const logsBuffer: LogItem[] = [];
const listeners = new Set<LogListener>();

let isIntercepted = false;
let debugModeActive = false;

// Preserva métodos originais do console
const originalConsole = {
  log: console.log.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  debug: console.debug ? console.debug.bind(console) : console.log.bind(console),
};

function formatTime(d: Date): string {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  return `${hh}:${mm}:${ss}.${ms}`;
}

function safeStringify(arg: any): string {
  if (arg === null) return "null";
  if (arg === undefined) return "undefined";
  if (typeof arg === "string") return arg;
  if (typeof arg === "number" || typeof arg === "boolean") return String(arg);
  if (arg instanceof Error) return `${arg.name}: ${arg.message}\n${arg.stack || ""}`;
  try {
    return JSON.stringify(arg);
  } catch {
    return String(arg);
  }
}

export function addLogEntry(level: LogLevel, ...args: any[]): void {
  const now = new Date();
  const timeStr = formatTime(now);
  const rawMessage = args.map(safeStringify).join(" ");
  // Trunca mensagens gigantes para no máximo 1200 caracteres, impedindo vazamento de RAM
  const message = rawMessage.length > 1200 ? rawMessage.substring(0, 1200) + " ...[TRUNCADO]" : rawMessage;
  
  let stack: string | undefined;
  for (const a of args) {
    if (a instanceof Error && a.stack) {
      stack = a.stack.length > 1000 ? a.stack.substring(0, 1000) + " ...[TRUNCADO]" : a.stack;
      break;
    }
  }

  // Detecta tags comuns (ex: [Caixa], [Firestore], [Chat], [GoogleDriveDirect])
  let tag: string | undefined;
  const tagMatch = message.match(/^\[([A-Za-z0-9_-]+)\]/);
  if (tagMatch) {
    tag = tagMatch[1];
  }

  const item: LogItem = {
    id: `log_${now.getTime()}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: now.getTime(),
    timeStr,
    level,
    tag,
    message,
    stack,
  };

  logsBuffer.push(item);
  if (logsBuffer.length > MAX_LOGS) {
    logsBuffer.shift();
  }

  // Notifica ouvintes ativos (ex: tela de diagnóstico aberta)
  if (listeners.size > 0) {
    const copy = [...logsBuffer];
    listeners.forEach((cb) => {
      try {
        cb(copy);
      } catch {}
    });
  }
}

/**
 * Inicializa a interceptação de console para capturar todos os logs da aplicação
 */
export function initDebugLogger(enableDebugOutput = false): void {
  debugModeActive = enableDebugOutput;

  if (isIntercepted) return;
  isIntercepted = true;

  console.log = (...args: any[]) => {
    addLogEntry("log", ...args);
    if (__DEV__ || debugModeActive) {
      originalConsole.log(...args);
    }
  };

  console.info = (...args: any[]) => {
    addLogEntry("info", ...args);
    if (__DEV__ || debugModeActive) {
      originalConsole.info(...args);
    }
  };

  console.warn = (...args: any[]) => {
    addLogEntry("warn", ...args);
    originalConsole.warn(...args);
  };

  console.error = (...args: any[]) => {
    addLogEntry("error", ...args);
    originalConsole.error(...args);
  };

  addLogEntry("info", `[SISTEMA] DebugLogger inicializado. Plataforma: ${Platform.OS} | Modo: ${__DEV__ ? "DEV" : "PROD"}`);
}

export function setDebugModeActive(active: boolean): void {
  debugModeActive = active;
  addLogEntry("info", `[DEPURAÇÃO] Modo depuração ${active ? "ATIVADO" : "DESATIVADO"}`);
}

export function isDebugModeActive(): boolean {
  return debugModeActive;
}

export function getLogs(): LogItem[] {
  return [...logsBuffer];
}

export function clearLogs(): void {
  logsBuffer.length = 0;
  if (listeners.size > 0) {
    listeners.forEach((cb) => cb([]));
  }
}

export function subscribeLogs(listener: LogListener): () => void {
  listeners.add(listener);
  listener([...logsBuffer]);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Formata os logs em texto puro com cabeçalho de diagnóstico pronto para copiar e colar
 */
export function formatLogsForExport(extraInfo?: Record<string, string>): string {
  const lines: string[] = [];
  lines.push("========================================");
  lines.push("📋 RELATÓRIO DE DEPURAÇÃO - SQUIRREL APP");
  lines.push(`Gerado em: ${new Date().toLocaleString("pt-BR")}`);
  lines.push(`Plataforma: ${Platform.OS}`);
  lines.push(`Ambiente: ${__DEV__ ? "Desenvolvimento" : "Produção"}`);
  
  if (extraInfo) {
    lines.push("--- INFORMAÇÕES DE CONTEXTO ---");
    for (const [k, v] of Object.entries(extraInfo)) {
      lines.push(`${k}: ${v}`);
    }
  }

  lines.push("========================================");
  lines.push(`Total de eventos capturados: ${logsBuffer.length}`);
  lines.push("----------------------------------------");

  if (logsBuffer.length === 0) {
    lines.push("Nenhum log registrado até o momento.");
  } else {
    for (const log of logsBuffer) {
      const levelUpper = log.level.toUpperCase().padEnd(5, " ");
      lines.push(`[${log.timeStr}] [${levelUpper}] ${log.message}`);
      if (log.stack) {
        lines.push(`   Stack: ${log.stack}`);
      }
    }
  }

  lines.push("========================================");
  lines.push("FIM DO RELATÓRIO");
  return lines.join("\n");
}
