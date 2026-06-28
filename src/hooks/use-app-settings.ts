import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  chatPairingCode: string;
}

const SETTINGS_KEY = '@squirrel_app_settings';

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>({
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
    chatPairingCode: ''
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const saved = await AsyncStorage.getItem(SETTINGS_KEY);
      if (saved) {
        // Faz o merge das configs antigas com as novas (caso a pessoa já tenha configs salvas sem a nova propriedade)
        const parsed = JSON.parse(saved);
        setSettings(prev => ({ ...prev, ...parsed }));
      }
    } catch (e) {
      console.error("Erro ao carregar ajustes", e);
    } finally {
      setLoading(false);
    }
  }

  async function updateSettings(newSettings: Partial<AppSettings>) {
    try {
      const updated = { ...settings, ...newSettings };
      setSettings(updated);
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error("Erro ao salvar ajustes", e);
    }
  }

  return { settings, updateSettings, loading };
}
