import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { getFirestoreDb } from './firebase/client';
import { collection, doc, setDoc, getDoc, getDocs } from 'firebase/firestore';

export async function salvarPushTokenUsuario(userId: string, pushToken: string, username?: string): Promise<void> {
  if (!userId || !pushToken) return;
  try {
    const db = getFirestoreDb();
    const cleanUser = username ? username.toLowerCase().replace(/^@/, "").trim() : "";

    // Salva pelo UID do Firebase (chave primária)
    await setDoc(doc(db, `chat_push_tokens/${userId}`), {
      userId,
      username: cleanUser || userId,
      pushToken,
      updatedAt: Date.now(),
      platform: Platform.OS
    }, { merge: true });

    // Salva também pelo @username (índice secundário) para busca rápida
    if (cleanUser && cleanUser !== userId.toLowerCase()) {
      await setDoc(doc(db, `chat_push_tokens/${cleanUser}`), {
        userId,
        username: cleanUser,
        pushToken,
        updatedAt: Date.now(),
        platform: Platform.OS
      }, { merge: true });
    }
  } catch (e) {
    console.log("[PushService] Erro ao salvar push token no Firestore:", e);
  }
}

/**
 * Busca tokens push de forma RÁPIDA, ROBUSTA e INFALÍVEL.
 * Lê a coleção 'chat_push_tokens' e faz correspondência segura por UID, @username e ID do documento.
 */
export async function obterPushTokensUsuarios(userIdsOrTags?: string[]): Promise<string[]> {
  try {
    const db = getFirestoreDb();
    const colRef = collection(db, 'chat_push_tokens');
    const snap = await getDocs(colRef);
    const tokens: string[] = [];

    if (!userIdsOrTags || userIdsOrTags.length === 0) {
      snap.docs.forEach(d => {
        const tok = d.data()?.pushToken;
        if (tok) tokens.push(tok);
      });
      return Array.from(new Set(tokens));
    }

    const cleanTargets = userIdsOrTags
      .map(u => String(u || "").toLowerCase().replace(/^@/, "").trim())
      .filter(Boolean);

    snap.docs.forEach(docSnap => {
      const data = docSnap.data();
      const docId = docSnap.id.toLowerCase().replace(/^@/, "").trim();
      const tokenUserId = (data.userId || "").toLowerCase().trim();
      const tokenUsername = (data.username || "").toLowerCase().replace(/^@/, "").trim();

      if (data?.pushToken) {
        const matches = cleanTargets.some(target => 
          target === docId || target === tokenUserId || target === tokenUsername
        );
        if (matches) {
          tokens.push(data.pushToken);
        }
      }
    });

    return Array.from(new Set(tokens));
  } catch (e) {
    console.log("[PushService] Erro ao obter push tokens:", e);
    return [];
  }
}

/**
 * Envia push notification via Expo Push API → Google FCM/APNs
 * Funciona tanto do mobile quanto do web (o fetch é universal)
 */
export async function enviarPushNotificationParaUsuarios({
  destinatarioIds,
  remetenteId,
  remetenteNome,
  remetenteUsername,
  texto,
  isMural,
  imagemAnexa
}: {
  destinatarioIds?: string[];
  remetenteId: string;
  remetenteNome: string;
  remetenteUsername?: string;
  texto?: string;
  isMural?: boolean;
  imagemAnexa?: boolean;
}): Promise<void> {
  // NÃO bloqueia por Platform.OS — web também pode disparar push para outros dispositivos
  try {
    let targetTokens: string[] = [];

    if (destinatarioIds && destinatarioIds.length > 0) {
      targetTokens = await obterPushTokensUsuarios(destinatarioIds);
    } else {
      // Para o Mural: envia para todos exceto o próprio autor
      const allTokens = await obterPushTokensUsuarios();
      // Remove tokens do próprio remetente
      const myKeys = [remetenteId];
      if (remetenteUsername) {
        const cleanRU = remetenteUsername.toLowerCase().replace(/^@/, "").trim();
        if (cleanRU && cleanRU !== remetenteId.toLowerCase()) myKeys.push(cleanRU);
      }
      const myTokens = await obterPushTokensUsuarios(myKeys);
      targetTokens = allTokens.filter(t => !myTokens.includes(t));
    }

    if (targetTokens.length === 0) return;

    const title = isMural ? `📢 ${remetenteNome} no Mural` : `💬 ${remetenteNome}`;
    const body = imagemAnexa 
      ? "📷 Enviou uma foto" 
      : (texto ? (texto.length > 80 ? texto.substring(0, 77) + "..." : texto) : "Nova mensagem recebida");

    const messages = targetTokens.map(token => ({
      to: token,
      sound: 'default',
      priority: 'high' as const,
      _displayInForeground: true,
      title,
      body,
      channelId: 'chat-messages',
      badge: 1,
      data: {
        type: 'chat_message',
        remetenteId,
        remetenteNome,
        isMural: Boolean(isMural),
      }
    }));

    if (Platform.OS === 'web') {
      // Navegadores web bloqueiam requisições diretas ao exp.host por política de CORS
      console.log("[PushService] Push gerado no ambiente Web — ignorando envio direto de navegador (CORS)");
      return;
    }

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    const resText = await response.text();
    console.log("[PushService] Resposta Expo Push API:", response.status, resText);
  } catch (e) {
    console.log("[PushService] Erro ao enviar push notification:", e);
  }
}

export interface DiagnosticResult {
  permissionGranted: boolean;
  permissionStatus: string;
  channelConfigured: boolean;
  pushToken: string | null;
  localNotificationSent: boolean;
  remotePushSent: boolean;
  error?: string;
}

export async function testarDiagnosticoNotificacoes(
  userId: string,
  username: string
): Promise<DiagnosticResult> {
  const result: DiagnosticResult = {
    permissionGranted: false,
    permissionStatus: 'unknown',
    channelConfigured: false,
    pushToken: null,
    localNotificationSent: false,
    remotePushSent: false,
  };

  if (Platform.OS === 'web') {
    result.error = 'Notificações push não são suportadas no navegador Web.';
    return result;
  }

  try {
    // 1. Configurar Canal Android
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('chat-messages', {
        name: 'Mensagens do Chat',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#6366f1',
        enableLights: true,
        enableVibrate: true,
        showBadge: true,
        sound: 'default'
      });
      result.channelConfigured = true;
    } else {
      result.channelConfigured = true;
    }

    // 2. Checar e Solicitar Permissões
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    result.permissionStatus = finalStatus;
    result.permissionGranted = finalStatus === 'granted';

    if (finalStatus !== 'granted') {
      result.error = 'Permissão de notificações negada nas configurações do Android.';
      return result;
    }

    // 3. Obter Push Token
    try {
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: '3e30c56d-b460-467e-ad91-93c5826990cf'
      });
      result.pushToken = tokenData.data;
      if (tokenData.data && userId) {
        await salvarPushTokenUsuario(userId, tokenData.data, username);
      }
    } catch (tokenErr: any) {
      console.log('[Diagnostic] Erro ao obter push token:', tokenErr);
      result.error = `Erro ao obter Push Token: ${tokenErr?.message || tokenErr}`;
    }

    // 4. Disparar Notificação Local Instantânea
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🐿️ Squirrel — Teste de Notificação',
          body: 'Seu dispositivo está 100% configurado para receber mensagens em segundo plano!',
          sound: true,
          priority: Notifications.AndroidNotificationPriority.MAX,
          ...(Platform.OS === 'android' ? { channelId: 'chat-messages' } : {}),
          data: { type: 'test_notification' }
        },
        trigger: null
      });
      result.localNotificationSent = true;
    } catch (localErr: any) {
      console.log('[Diagnostic] Erro ao enviar notificação local:', localErr);
    }

    // 5. Enviar Push Remoto via Expo API se tiver token
    if (result.pushToken) {
      try {
        const response = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Accept-encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify([{
            to: result.pushToken,
            sound: 'default',
            priority: 'high',
            _displayInForeground: true,
            title: '🐿️ Squirrel Push Remoto (FCM)',
            body: 'Push de segundo plano funcionando perfeitamente!',
            channelId: 'chat-messages',
            data: { type: 'remote_test' }
          }]),
        });
        result.remotePushSent = response.ok;
      } catch (pushErr: any) {
        console.log('[Diagnostic] Erro ao disparar push remoto:', pushErr);
      }
    }

    return result;
  } catch (err: any) {
    result.error = err?.message || 'Erro inesperado no diagnóstico';
    return result;
  }
}
