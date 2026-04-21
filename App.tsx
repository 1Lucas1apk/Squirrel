import { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { View, ActivityIndicator, Text, Pressable, Platform } from "react-native";
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ShieldCheck, Lock } from "lucide-react-native";

import { MainScreen } from "./src/screens/main-screen";
import { LoginScreen } from "./src/screens/login-screen";
import { useAuth } from "./src/hooks/use-auth";
import { requestNotificationPermissions } from "./src/services/notifications";

function RootNavigator() {
  const { user, loading: authLoading } = useAuth();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);
  const [checkingBiometrics, setCheckingBiometrics] = useState(true);

  useEffect(() => {
    // 1. Permissões básicas
    if (Platform.OS !== 'web') {
      void requestNotificationPermissions();
    }
    
    // 2. Lógica de desbloqueio
    void (async () => {
      try {
        const saved = await AsyncStorage.getItem('@squirrel_app_settings');
        if (saved) {
          const settings = JSON.parse(saved);
          const bioEnabled = !!settings.biometricsEnabled && Platform.OS !== 'web';
          setBiometricsEnabled(bioEnabled);
          
          if (bioEnabled && user) {
            // Se houver usuário logado, tentamos biometria
            await handleBiometricAuth();
          } else {
            setIsAuthenticated(true);
          }
        } else {
          setIsAuthenticated(true);
        }
      } catch (e) {
        setIsAuthenticated(true);
      } finally {
        setCheckingBiometrics(false);
      }
    })();
  }, [user?.uid]);

  const handleBiometricAuth = async () => {
    if (Platform.OS === 'web') {
      setIsAuthenticated(true);
      return;
    }

    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (hasHardware && isEnrolled) {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Acesse o Squirrel',
          fallbackLabel: 'Usar senha',
          cancelLabel: 'Cancelar',
        });

        if (result.success) {
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
        }
      } else {
        setIsAuthenticated(true);
      }
    } catch (e) {
      console.error(e);
      setIsAuthenticated(true);
    }
  };

  // Se o Firebase ainda estiver carregando a persistência, esperamos
  if (authLoading) {
    return (
      <View className="flex-1 bg-ink-950 items-center justify-center">
        <ActivityIndicator color="#f4f4f5" size="large" />
      </View>
    );
  }

  // Tela de bloqueio biométrico (se ativa)
  if (user && biometricsEnabled && !isAuthenticated && !checkingBiometrics) {
    return (
      <View className="flex-1 bg-ink-950 items-center justify-center px-8">
        <View className="h-24 w-24 items-center justify-center rounded-[40px] bg-zinc-800 mb-8 border border-zinc-700">
          <Lock size={40} color="#f4f4f5" />
        </View>
        <Text className="text-2xl font-black text-white uppercase text-center mb-2">App Bloqueado</Text>
        <Text className="text-zinc-500 font-bold text-center mb-12 uppercase text-[10px] tracking-widest leading-4">
          A autenticação biométrica está ativa para sua segurança.
        </Text>
        <Pressable 
          onPress={handleBiometricAuth}
          className="bg-zinc-100 px-12 py-5 rounded-3xl flex-row items-center gap-3 active:bg-zinc-300"
        >
          <ShieldCheck size={20} color="#09090b" />
          <Text className="font-black uppercase text-zinc-950">Desbloquear</Text>
        </Pressable>
      </View>
    );
  }

  // Se logado e biometria passou, entra. Senão, login.
  return user ? <MainScreen /> : <LoginScreen />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <RootNavigator />
    </SafeAreaProvider>
  );
}
