import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setDebugModeActive } from '../services/debug-logger';

export type HapticIntensity = 'light' | 'medium' | 'heavy';
export type MoneyInputMode = 'rtl' | 'manual';

interface AppSettings {
  hapticsEnabled: boolean;
  hapticIntensity: HapticIntensity;
  fechamentoSemana: string; // Ex: "17:00"
  fechamentoSabado: string; // Ex: "12:00"
  biometricsEnabled: boolean;
  moneyInputMode: MoneyInputMode;
  posEnabled: boolean;
  convenioEnabled: boolean;
  gasDoPovoValorPadrao: number;
  chatOperatorName: string;
  chatOperatorCargo: string;
  chatPairingCode: string;
  searchEnabled: boolean;
  painelLayout: 'grid' | 'stack';
  fontScale: 'compact' | 'normal' | 'large';
  indicadoresStyle: 'dock' | 'focus' | 'rows';
  debugModeEnabled: boolean;
}

const SETTINGS_KEY = '@squirrel_app_settings';

interface AppSettingsStore {
  settings: AppSettings;
  loading: boolean;
  loadSettings: () => Promise<void>;
  updateSettings: (newSettings: Partial<AppSettings>) => Promise<void>;
}

export const useAppSettings = create<AppSettingsStore>((set, get) => ({
  settings: {
    hapticsEnabled: true,
    hapticIntensity: 'light',
    fechamentoSemana: '17:00',
    fechamentoSabado: '12:00',
    biometricsEnabled: false,
    moneyInputMode: 'rtl',
    posEnabled: false,
    convenioEnabled: false,
    gasDoPovoValorPadrao: 120.36,
    chatOperatorName: '',
    chatOperatorCargo: 'operador',
    chatPairingCode: '',
    searchEnabled: false,
    painelLayout: 'stack',
    fontScale: 'normal',
    indicadoresStyle: 'dock',
    debugModeEnabled: false
  },
  loading: true,
  
  loadSettings: async () => {
    try {
      const saved = await AsyncStorage.getItem(SETTINGS_KEY);
      if (saved) {
        // Faz o merge das configs do dispositivo (sem contaminar com dados de identidade de usuário)
        const parsed = JSON.parse(saved);
        delete parsed.chatOperatorName;
        delete parsed.chatPairingCode;
        delete parsed.chatOperatorCargo;
        set((state) => ({ settings: { ...state.settings, ...parsed } }));
        if (typeof parsed.debugModeEnabled === "boolean") {
          setDebugModeActive(parsed.debugModeEnabled);
        }
      }
    } catch (e) {
      console.error("Erro ao carregar ajustes", e);
    } finally {
      set({ loading: false });
    }
  },

  updateSettings: async (newSettings: Partial<AppSettings>) => {
    try {
      const { settings } = get();
      const updated = { ...settings, ...newSettings };
      set({ settings: updated });
      if (typeof newSettings.debugModeEnabled === "boolean") {
        setDebugModeActive(newSettings.debugModeEnabled);
      }
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error("Erro ao salvar ajustes", e);
    }
  }
}));

// Inicia o carregamento assim que o módulo é importado
useAppSettings.getState().loadSettings();
