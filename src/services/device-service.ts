import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { createMMKV } from "react-native-mmkv";

const KEY_DEVICE_ID = "@squirrel_persistent_device_id";
const KEY_LOCAL_SEQUENCE = "@squirrel_local_sequence";

const isWeb = Platform.OS === "web";
const storage = isWeb ? null : createMMKV({ id: "squirrel-storage" });

let cachedDeviceId: string | null = null;
let currentSequence = 0;

// Inicializa a sequência a partir do MMKV / Storage
try {
  if (isWeb) {
    const saved = localStorage.getItem(KEY_LOCAL_SEQUENCE);
    currentSequence = saved ? Number(saved) : 0;
  } else {
    currentSequence = storage?.getNumber(KEY_LOCAL_SEQUENCE) || 0;
  }
} catch {
  currentSequence = 0;
}

/**
 * Retorna o ID único e persistente deste dispositivo físico.
 * Gerado uma única vez na instalação do aplicativo e mantido no SecureStore.
 */
export async function getDeviceIdAsync(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId;

  try {
    if (Platform.OS === "web") {
      let devId = localStorage.getItem(KEY_DEVICE_ID);
      if (!devId) {
        devId = `dev_web_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        localStorage.setItem(KEY_DEVICE_ID, devId);
      }
      cachedDeviceId = devId;
      return devId;
    }

    let devId = await SecureStore.getItemAsync(KEY_DEVICE_ID);
    if (!devId) {
      devId = `dev_${Platform.OS}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      await SecureStore.setItemAsync(KEY_DEVICE_ID, devId);
    }
    cachedDeviceId = devId;
    return devId;
  } catch (err) {
    console.log("[DeviceService] Erro ao recuperar Device ID:", err);
    return `dev_fallback_${Date.now()}`;
  }
}

/**
 * Retorna o próximo número de sequência local monotônico deste aparelho
 * Persistido no armazenamento síncrono para garantir que nunca retroceda após restart.
 */
export function getNextSequence(): number {
  currentSequence += 1;
  try {
    if (isWeb) {
      localStorage.setItem(KEY_LOCAL_SEQUENCE, String(currentSequence));
    } else {
      storage?.set(KEY_LOCAL_SEQUENCE, currentSequence);
    }
  } catch {}
  return currentSequence;
}
