import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type HapticIntensity = 'light' | 'medium' | 'heavy';

interface AppSettings {
  hapticsEnabled: boolean;
  hapticIntensity: HapticIntensity;
  fechamentoSemana: string; // Ex: "17:00"
  fechamentoSabado: string; // Ex: "12:00"
}

const SETTINGS_KEY = '@squirrel_app_settings';

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>({
    hapticsEnabled: true,
    hapticIntensity: 'light',
    fechamentoSemana: '17:00',
    fechamentoSabado: '12:00',
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const saved = await AsyncStorage.getItem(SETTINGS_KEY);
      if (saved) {
        setSettings(JSON.parse(saved));
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
