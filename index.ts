import { registerRootComponent } from 'expo';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import App from './App';
import "./src/styles/global.css";

import { initDebugLogger } from './src/services/debug-logger';

// Inicializa o capturador de diagnóstico em tempo real (captura eventos sem travar a CPU)
initDebugLogger(false);

// Configuração do Notification Handler e Canais no entry point para funcionar com o app fechado e em segundo plano
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('chat-messages', {
      name: 'Mensagens do Chat',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#6366f1',
      enableLights: true,
      enableVibrate: true,
      showBadge: true,
      sound: 'default'
    }).catch(() => {});
  }
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
