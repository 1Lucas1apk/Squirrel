import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import * as Notifications from 'expo-notifications';
import * as Haptics from "expo-haptics";
import { useChatStore } from "../store/chat-store";
import { 
  ouvirMensagensChat, 
  enviarMensagemChat, 
  apagarMensagemChat,
  excluirMensagemPermanenteChat,
  editarMensagemChat,
  desafixarAvisoMural,
  alternarFixarMensagemMuralChat,
  registrarPresencaUsuario,
  ouvirPresencaUsuarios,
  ouvirPerfilUsuario,
  obterPerfilUsuario,
  buscarUsuarioPorTag,
  salvarContatoUsuario,
  ouvirContatosUsuario,
  verificarDisponibilidadeUsername,
  alterarUsernameComSeguranca,
  removerContatoUsuario,
  limparUsuarioAntigo,
  limparMuralGeralChat,
  limparTodasMensagensChat,
  atualizarStatusAdminUsuario,
  marcarMensagemComoLidaChat,
  marcarConversaComoLidaChat,
  alternarReacaoMensagemChat,
  atualizarEstadoJogoChat,
  DEV_UID,
  DEV_EMAIL
} from "../services/repositories/chat-repository";
import { getFirebaseAuth } from "../services/firebase/client";
import { useAppSettings } from "./use-app-settings";
import { useAuth } from "./use-auth";
import { MensagemChat, ChatContact, TipoJogoChat, JogoChatPayload } from "../types/domain";
import { criarPartidaJogoDaVelha, processarJogadaVelha, reiniciarPartidaVelha } from "../services/games/jogo-da-velha-service";
import { criarPartidaQuatroEmLinha, processarJogadaQuatroLinha, reiniciarPartidaQuatroEmLinha } from "../services/games/quatro-em-linha-service";
import { criarPartidaBatalhaNaval, processarTiroBatalhaNaval, reiniciarPartidaBatalhaNaval } from "../services/games/batalha-naval-service";
import { criarPartidaTermo, processarPalpiteTermo, reiniciarPartidaTermo } from "../services/games/termo-service";
import { 
  criarPartidaForca, 
  processarChuteLetraForca, 
  processarChutePalavraInteiraForca, 
  adicionarDicaCriadorForca, 
  acionarPedidoDicaForca, 
  revelarLetraCriadorForca 
} from "../services/games/forca-service";
import { 
  criarPartidaStop, 
  submeterRespostasStop as execSubmeterRespostasStop, 
  alternarValidacaoItemStop, 
  finalizarRodadaStop as execFinalizarRodadaStop, 
  reiniciarPartidaStop 
} from "../services/games/stop-service";
import { StopRespostas, ValidacaoStop } from "../types/domain";
import { ensureNotificationHandler } from "../services/notifications";
import { salvarPushTokenUsuario, enviarPushNotificationParaUsuarios } from "../services/push-notification-service";
import { carregarHistoricoDoDisco, mesclarMensagensDiscoComNuvem, salvarHistoricoNoDisco } from "../services/chat-disk-storage";

import { ADMIN_MASTER_PIN } from "../config/env";

const ADMIN_PIN_KEY = "@squirrel_admin_auth";

// Cache global de IDs de mensagens já notificadas para impedir alertas duplicados ou atrasados
const notifiedMessageIds = new Set<string>();
let isInitialSyncDone = false;

// Controle de subscrição única ao Firestore
let isChatSubscribed = false;
let globalUnsubMsg: (() => void) | null = null;
let globalUnsubPresenca: (() => void) | null = null;
let globalUnsubContatos: (() => void) | null = null;
let lastSubscribedUserId: string | null = null;

export function isMessageInDirectChat(
  m: MensagemChat,
  myUserId: string,
  myUsername: string,
  contact: { id: string; username?: string }
): boolean {
  if (!m.destinatarioId) return false;

  const myCleanUid = (myUserId || "").toLowerCase().trim();
  const myCleanUser = (myUsername || "").toLowerCase().replace(/^@/, "").trim();

  const cCleanId = (contact.id || "").toLowerCase().trim();
  const cCleanUser = (contact.username || "").toLowerCase().replace(/^@/, "").trim();

  const msgRemetente = (m.remetenteId || "").toLowerCase().trim();
  const msgRemetenteUser = (m.remetenteUsername || "").toLowerCase().replace(/^@/, "").trim();
  const msgDest = (m.destinatarioId || "").toLowerCase().replace(/^@/, "").trim();

  // Remetente sou EU?
  const isSenderMe = Boolean(
    (myCleanUid && msgRemetente === myCleanUid) ||
    (myCleanUser && (msgRemetente === myCleanUser || msgRemetenteUser === myCleanUser))
  );

  // Remetente é o CONTATO?
  const isSenderContact = Boolean(
    (cCleanId && msgRemetente === cCleanId) ||
    (cCleanUser && (msgRemetente === cCleanUser || msgRemetenteUser === cCleanUser))
  );

  // Destinatário é o CONTATO?
  const isDestContact = Boolean(
    (cCleanId && msgDest === cCleanId) ||
    (cCleanUser && msgDest === cCleanUser)
  );

  // Destinatário sou EU?
  const isDestMe = Boolean(
    (myCleanUid && msgDest === myCleanUid) ||
    (myCleanUser && msgDest === myCleanUser)
  );

  return Boolean((isSenderMe && isDestContact) || (isSenderContact && isDestMe));
}

export function useChat() {
  const { 
    mensagens, 
    setMensagens, 
    contatos, 
    setContatos, 
    presencas, 
    setPresencas,
    myProfile,
    setMyProfile,
    isAdmin,
    setIsAdmin,
    activeChatId,
    setActiveChatId
  } = useChatStore();

  const { user } = useAuth();
  
  // ID do usuário autenticado no Firebase (ou fallback limpo)
  const myUserId = user?.uid || (user?.email ? user.email.replace(/[^a-zA-Z0-9]/g, "_") : "local-session");

  // Fallbacks estritamente baseados na conta ATUALMENTE conectada (sem contaminação de outros usuários)
  const currentEmail = user?.email || "";
  const currentEmailPrefix = currentEmail 
    ? currentEmail.split("@")[0].toLowerCase().replace(/[^a-z0-9_]/g, "") 
    : "";
  const fallbackUsername = currentEmailPrefix || (user?.uid ? `user_${user.uid.substring(0, 6)}` : "usuario");
  const fallbackDisplayName = currentEmail ? currentEmail.split("@")[0] : "Operador";

  // Cache local INTELIGENTE por usuário (para render inicial rápido sem conflito entre contas)
  const USER_PROFILE_KEY = `@squirrel_user_profile_${myUserId}`;
  const [localUserCache, setLocalUserCache] = useState<{ displayName: string; username: string; cargo: string; photoUrl?: string } | null>(null);

  useEffect(() => {
    if (!myUserId || myUserId === "local-session") return;
    AsyncStorage.getItem(USER_PROFILE_KEY).then(raw => {
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === "object") {
            setLocalUserCache(parsed);
          }
        } catch {}
      }
    }).catch(() => {});
  }, [myUserId, USER_PROFILE_KEY]);

  // Reseta o perfil e cache em memória quando o usuário autenticado mudar
  useEffect(() => {
    if (!myUserId || myUserId === "local-session") return;
    const current = useChatStore.getState().myProfile;
    if (current && current.userId && current.userId !== myUserId) {
      useChatStore.getState().setMyProfile(null);
      setLocalUserCache(null);
    }
  }, [myUserId]);

  // FONTE ABSOLUTA DA VERDADE: Firestore (myProfile)
  // Fallbacks em cascata: myProfile (Firestore) -> localUserCache (deste UID) -> email atual
  const isProfileMatch = Boolean(myProfile && (!myProfile.userId || myProfile.userId === myUserId));
  const validProfile = isProfileMatch ? myProfile : null;
  const operatorName = validProfile?.displayName || localUserCache?.displayName || fallbackDisplayName;
  const myUsername = (validProfile?.username || localUserCache?.username || fallbackUsername).replace(/^@/, "").toLowerCase();
  const operatorCargo = validProfile?.cargo || localUserCache?.cargo || (isAdmin ? "admin" : "atendente");
  const myPhotoUrl = validProfile ? (validProfile.photoUrl || undefined) : (localUserCache?.photoUrl || undefined);
  const operatorRecado = validProfile?.recado || (localUserCache as any)?.recado || "";
  const operatorStatusPreset = validProfile?.statusPreset || (localUserCache as any)?.statusPreset || "disponivel";

  const myUserIdRef = useRef(myUserId);
  myUserIdRef.current = myUserId;

  // Mensagens ocultas localmente ("Apagar para mim") - Sincronizado Globalmente pelo Zustand
  const HIDDEN_LOCAL_KEY = "@squirrel_hidden_local_msgs";
  const hiddenLocalIds = useChatStore((s) => s.hiddenLocalIds);
  const setHiddenLocalIds = useChatStore((s) => s.setHiddenLocalIds);

  // Contatos removidos pelo usuário
  const REMOVED_CONTACTS_KEY = "@squirrel_removed_contacts";
  const [removedContactIds, setRemovedContactIds] = useState<string[]>([]);

  useEffect(() => {
    async function loadStoredData() {
      try {
        const rawHidden = await AsyncStorage.getItem(HIDDEN_LOCAL_KEY);
        if (rawHidden) {
          const parsed = JSON.parse(rawHidden);
          if (parsed && typeof parsed === "object") {
            setHiddenLocalIds(parsed);
          }
        }

        const rawRemoved = await AsyncStorage.getItem(REMOVED_CONTACTS_KEY);
        if (rawRemoved) setRemovedContactIds(JSON.parse(rawRemoved));

        // Carrega histórico completo direto do DISCO FÍSICO (0ms de espera offline)
        const discoMsgs = await carregarHistoricoDoDisco();
        if (discoMsgs && discoMsgs.length > 0) {
          useChatStore.getState().setMensagens(discoMsgs);
        }
      } catch {}
    }
    loadStoredData();
  }, [setHiddenLocalIds]);

  // Admin status é determinado EXCLUSIVAMENTE pelo Firestore via ouvirPerfilUsuario (abaixo).
  // NÃO carregamos de AsyncStorage no boot para evitar sobrescrever revogações.

  // Pedir permissão e configurar canais de notificação + Registro de Push Token
  useEffect(() => {
    async function setupNotifications() {
      try {
        if (Platform.OS !== 'web') {
          await ensureNotificationHandler();
          const { status: existingStatus } = await Notifications.getPermissionsAsync();
          let finalStatus = existingStatus;
          if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
          }
          if (finalStatus === 'granted' && myUserId && myUserId !== "local-session") {
            try {
              const tokenData = await Notifications.getExpoPushTokenAsync({
                projectId: "3e30c56d-b460-467e-ad91-93c5826990cf"
              });
              if (tokenData?.data) {
                await salvarPushTokenUsuario(myUserId, tokenData.data, myUsername);
              }
            } catch (tokenErr) {
              console.log("[PushToken] Registro automático do token:", tokenErr);
            }
          }
        }
      } catch {}
    }
    setupNotifications();
  }, [myUserId, myUsername]);

  // 0. Sincronizar perfil da nuvem em tempo real (Fonte Absoluta da Verdade: Firestore)
  useEffect(() => {
    if (!myUserId || myUserId === "local-session") return;

    const unsub = ouvirPerfilUsuario(myUserId, (cloudProfile) => {
      const isCloudAdmin = Boolean(cloudProfile.isAdmin);
      setIsAdmin(isCloudAdmin);

      const auth = getFirebaseAuth();
      const currentAuthEmail = (auth.currentUser?.email || "").toLowerCase().trim();
      const isOfficialDev = (myUserId === DEV_UID) || (currentAuthEmail === DEV_EMAIL);
      const cRaw = (cloudProfile.cargo || "").toLowerCase().trim();
      const isDevCargo = isOfficialDev && (cRaw === "dev" || cRaw === "desenvolvedor" || cRaw === "developer");
      const resolvedCargo = isDevCargo 
        ? "dev" 
        : (isCloudAdmin ? "admin" : (cloudProfile.cargo === "admin" || cloudProfile.cargo === "dev" ? "atendente" : (cloudProfile.cargo || "atendente")));

      const resolvedPhotoUrl = cloudProfile.photoUrl !== undefined 
        ? cloudProfile.photoUrl 
        : ((localUserCache as any)?.photoUrl || useChatStore.getState().myProfile?.photoUrl || null);

      const resolvedRecado = cloudProfile.recado !== undefined
        ? cloudProfile.recado
        : ((localUserCache as any)?.recado || useChatStore.getState().myProfile?.recado || null);

      const resolvedStatusPreset = cloudProfile.statusPreset !== undefined
        ? cloudProfile.statusPreset
        : ((localUserCache as any)?.statusPreset || useChatStore.getState().myProfile?.statusPreset || "disponivel");

      const currentSaved = useChatStore.getState().myProfile;
      const resolvedDisplayName = cloudProfile.displayName 
        || currentSaved?.displayName 
        || localUserCache?.displayName 
        || fallbackDisplayName;
      const resolvedUsername = cloudProfile.username 
        || currentSaved?.username 
        || localUserCache?.username 
        || fallbackUsername;

      const updatedProfile = {
        userId: myUserId,
        displayName: resolvedDisplayName,
        username: resolvedUsername,
        cargo: resolvedCargo,
        isAdmin: isCloudAdmin,
        photoUrl: resolvedPhotoUrl,
        recado: resolvedRecado,
        statusPreset: resolvedStatusPreset
      };

      setMyProfile(updatedProfile);

      // Salva no cache local inteligente indexado pelo UID deste usuário específico
      AsyncStorage.setItem(USER_PROFILE_KEY, JSON.stringify(updatedProfile)).catch(() => {});

      if (isCloudAdmin) {
        AsyncStorage.setItem(ADMIN_PIN_KEY, "true").catch(() => {});
      } else {
        AsyncStorage.removeItem(ADMIN_PIN_KEY).catch(() => {});
      }
    });

    return () => unsub();
  }, [myUserId, fallbackDisplayName, fallbackUsername, USER_PROFILE_KEY, setIsAdmin, setMyProfile]);

  // Refs estáveis para heartbeat (evitam re-runs desnecessários do useEffect)
  const operatorNameRef = useRef(operatorName);
  operatorNameRef.current = operatorName;
  const myUsernameRef = useRef(myUsername);
  myUsernameRef.current = myUsername;

  // 1. Registrar Presença e Ouvir Mensagens & Presenças com Subscrição Singleton
  useEffect(() => {
    if (!myUserId || myUserId === "local-session") return;

    const runHeartbeat = () => {
      registrarPresencaUsuario(
        myUserId, 
        myUsernameRef.current, 
        operatorNameRef.current, 
        true,
        user?.email || undefined
      ).catch(console.error);
    };

    runHeartbeat();
    limparUsuarioAntigo("usuario").catch(() => {});

    // Heartbeat de presença a cada 60s
    const interval = setInterval(runHeartbeat, 60000);

    // Configurar subscrições únicas ao Firestore (sem conexões duplicadas)
    if (!isChatSubscribed || lastSubscribedUserId !== myUserId) {
      globalUnsubMsg?.();
      globalUnsubPresenca?.();
      globalUnsubContatos?.();

      lastSubscribedUserId = myUserId;
      isChatSubscribed = true;

      // Ouvir Mensagens em tempo real com Mesclagem Automática no Disco
      globalUnsubMsg = ouvirMensagensChat(async (msgs) => {
        const mensagensUnificadas = await mesclarMensagensDiscoComNuvem(msgs);
        useChatStore.getState().setMensagens(mensagensUnificadas);

        // Na primeira carga, popula o cache com as mensagens antigas sem disparar alertas
        if (!isInitialSyncDone) {
          mensagensUnificadas.forEach((m) => notifiedMessageIds.add(m.id));
          isInitialSyncDone = true;
          return;
        }

        // Previne vazamento de memória mantendo apenas os 150 IDs mais recentes
        if (notifiedMessageIds.size > 300) {
          const arr = Array.from(notifiedMessageIds).slice(-150);
          notifiedMessageIds.clear();
          arr.forEach((id) => notifiedMessageIds.add(id));
        }

        if (Platform.OS === 'web') return;

        // Disparo imediato e deduplicado de notificação (apenas mensagens novas de outros usuários)
        const currentUserId = myUserIdRef.current;
        msgs.forEach((msg) => {
          if (!notifiedMessageIds.has(msg.id)) {
            notifiedMessageIds.add(msg.id);

            if (msg.remetenteId !== currentUserId && !msg.apagadaEm) {
              const senderTag = msg.remetenteUsername ? `@${msg.remetenteUsername}` : "";
              const senderTitle = msg.remetenteNome
                ? (senderTag ? `${msg.remetenteNome} (${senderTag})` : msg.remetenteNome)
                : (senderTag || "Nova Mensagem");

              Notifications.scheduleNotificationAsync({
                content: {
                  title: senderTitle,
                  body: msg.imagemBase64 ? "📷 Enviou uma foto no chat" : (msg.texto || "Nova mensagem recebida"),
                  data: {
                    type: "chat_message",
                    remetenteId: msg.remetenteId,
                    remetenteUsername: msg.remetenteUsername,
                    remetenteNome: msg.remetenteNome,
                    destinatarioId: msg.destinatarioId,
                    isMural: !msg.destinatarioId,
                  },
                  sound: true,
                  priority: Notifications.AndroidNotificationPriority.MAX,
                  ...(Platform.OS === 'android' ? { channelId: 'chat-messages' } : {}),
                },
                trigger: null,
              }).catch(console.error);
            }
          }
        });
      });

      // Ouvir Presenças em tempo real
      globalUnsubPresenca = ouvirPresencaUsuarios((users) => {
        useChatStore.getState().setPresencas(users);
      });

      // Ouvir Contatos do Usuário
      globalUnsubContatos = ouvirContatosUsuario(myUserId, (contacts) => {
        useChatStore.getState().setContatos(contacts);
      });
    }

    return () => {
      clearInterval(interval);
    };
  }, [myUserId]);

  // Mensagens do Mural Geral (todas as mensagens globais, respeitando apagar para mim)
  const mensagensMural = useMemo(() => {
    return mensagens.filter(m => !m.destinatarioId && !hiddenLocalIds[m.id]);
  }, [mensagens, hiddenLocalIds]);

  // Recados Raiz do Mural Geral (apenas os tópicos principais, sem subrespostas de threads)
  const mensagensMuralRoots = useMemo(() => {
    return mensagensMural.filter(m => !m.parentId && !hiddenLocalIds[m.id]);
  }, [mensagensMural, hiddenLocalIds]);

  // Obter todas as mensagens de um Subchat / Thread específica
  const getThreadMessages = useCallback((parentId: string) => {
    return mensagensMural
      .filter(m => m.parentId === parentId && !hiddenLocalIds[m.id])
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [mensagensMural, hiddenLocalIds]);

  // Obter informações resumidas de uma Thread (contagem, última resposta, avatares)
  const getThreadInfo = useCallback((parentId: string) => {
    const replies = mensagensMural
      .filter(m => m.parentId === parentId && !m.apagadaEm && !hiddenLocalIds[m.id])
      .sort((a, b) => a.timestamp - b.timestamp);
    const count = replies.length;
    const lastReply = count > 0 ? replies[count - 1] : undefined;
    const participants = Array.from(
      new Set(
        replies.map(r => r.remetenteUsername || r.remetenteNome || "op").filter(Boolean)
      )
    );
    return { count, lastReply, participants };
  }, [mensagensMural, hiddenLocalIds]);

  // Aviso Fixado no Topo do Mural (apenas ativos não apagados nem ocultos)
  const avisoFixadoMural = useMemo(() => {
    return mensagensMuralRoots.slice().reverse().find(m => m.isPinned && !m.apagadaEm && !hiddenLocalIds[m.id]) || null;
  }, [mensagensMuralRoots, hiddenLocalIds]);

  // Função para garantir que o próprio usuário NUNCA apareça na lista de contatos
  const isMe = (c: { id?: string; username?: string }) => {
    const cUser = (c.username || "").toLowerCase().replace(/^@/, "").trim();
    const cId = (c.id || "").toLowerCase().trim();
    const myUser = myUsername.toLowerCase().replace(/^@/, "").trim();
    const myUid = (user?.uid || "").toLowerCase().trim();
    const myCurId = (myUserId || "").toLowerCase().trim();

    return (
      (cUser && myUser && cUser === myUser) ||
      (cId && myUser && cId === myUser) ||
      (myUid && cId && cId === myUid) ||
      (myCurId && cId && cId === myCurId)
    );
  };

  // Lista de Contatos: Quem eu adicionei, quem me mandou mensagem e colegas ativos da loja
  const contatosCompletos = useMemo(() => {
    const map = new Map<string, ChatContact>();

    // 1. Contatos adicionados explicitamente pelo usuário
    contatos.forEach(c => {
      if (!isMe(c)) {
        map.set(c.id, { ...c });
      }
    });

    // 2. Operadores da equipe conectados no Firestore (Presenças em Tempo Real)
    presencas.forEach(p => {
      if (!isMe(p)) {
        const existing = map.get(p.id);
        if (!existing) {
          map.set(p.id, {
            id: p.id,
            username: p.username,
            displayName: p.displayName,
            cargo: p.cargo,
            isAdmin: p.isAdmin,
            photoUrl: p.photoUrl,
            recado: p.recado,
            statusPreset: p.statusPreset,
            isOnline: p.isOnline,
            lastSeen: p.lastSeen
          });
        }
      }
    });

    // 3. Usuários que enviaram mensagem privada para mim (ou para quem enviei)
    // Helper: verifica se um ID/username já está no mapa (UID ou @tag)
    const findExistingKey = (id: string, username?: string): string | null => {
      const cleanId = id.toLowerCase().trim();
      const cleanUser = username ? username.toLowerCase().replace(/^@/, "").trim() : "";
      for (const [key, val] of map) {
        const kLow = key.toLowerCase().trim();
        const vUser = (val.username || "").toLowerCase().replace(/^@/, "").trim();
        if (kLow === cleanId || kLow === cleanUser || 
            (cleanId && vUser === cleanId) || 
            (cleanUser && vUser === cleanUser) ||
            (cleanUser && kLow === cleanUser)) {
          return key;
        }
      }
      return null;
    };

    mensagens.forEach(m => {
      if (m.destinatarioId && !m.apagadaEm) {
        const msgRemetente = (m.remetenteId || "").toLowerCase().trim();
        const msgRemetenteUser = (m.remetenteUsername || "").toLowerCase().replace(/^@/, "").trim();

        const myCleanUid = (myUserId || "").toLowerCase().trim();
        const myCleanUser = (myUsername || "").toLowerCase().replace(/^@/, "").trim();

        const isSenderMe = 
          (myCleanUid && msgRemetente === myCleanUid) ||
          (myCleanUser && (msgRemetente === myCleanUser || msgRemetenteUser === myCleanUser));

        const otherId = isSenderMe ? m.destinatarioId : m.remetenteId;
        const otherUser = isSenderMe ? (m.destinatarioId || "") : (m.remetenteUsername || m.remetenteId);
        const otherName = isSenderMe ? (m.destinatarioId || "") : (m.remetenteNome || "Contato");

        if (otherId && !isMe({ id: otherId, username: otherUser })) {
          // Verificar se já existe no mapa com qualquer variante de ID/username
          const existingKey = findExistingKey(otherId, otherUser);
          if (!existingKey) {
            map.set(otherId, {
              id: otherId,
              username: otherUser,
              displayName: otherName,
            });
          }
        }
      }
    });

    // 4. Indexação O(P) das Presenças por UID e por Username para lookup instantâneo O(1)
    const presenceByUid = new Map<string, typeof presencas[0]>();
    const presenceByUsername = new Map<string, typeof presencas[0]>();
    presencas.forEach(p => {
      if (p.id) presenceByUid.set(p.id.toLowerCase().trim(), p);
      if (p.username) presenceByUsername.set(p.username.toLowerCase().replace(/^@/, "").trim(), p);
    });

    // 5. Indexação O(M) das Mensagens Privadas em um ÚNICO passe para todos os contatos
    const myCleanUid = (myUserId || "").toLowerCase().trim();
    const myCleanUser = (myUsername || "").toLowerCase().replace(/^@/, "").trim();

    // Map: targetKey -> { lastMsg?: MensagemChat, lastTime?: number, unread: number }
    const contactStatsMap = new Map<string, { lastValida?: MensagemChat; lastTime?: number; unread: number }>();

    const getStats = (key: string) => {
      let st = contactStatsMap.get(key);
      if (!st) {
        st = { unread: 0 };
        contactStatsMap.set(key, st);
      }
      return st;
    };

    mensagens.forEach(m => {
      if (!m.destinatarioId || hiddenLocalIds[m.id]) return;

      const msgRemetente = (m.remetenteId || "").toLowerCase().trim();
      const msgRemetenteUser = (m.remetenteUsername || "").toLowerCase().replace(/^@/, "").trim();
      const msgDest = (m.destinatarioId || "").toLowerCase().replace(/^@/, "").trim();

      const isSenderMe = 
        (myCleanUid && msgRemetente === myCleanUid) ||
        (myCleanUser && (msgRemetente === myCleanUser || msgRemetenteUser === myCleanUser));

      const isDestMe = 
        (myCleanUid && msgDest === myCleanUid) ||
        (myCleanUser && msgDest === myCleanUser);

      let targetKey: string | null = null;
      let isIncoming = false;

      if (isSenderMe) {
        targetKey = msgDest;
      } else if (isDestMe) {
        targetKey = msgRemetente || msgRemetenteUser;
        isIncoming = true;
      }

      if (targetKey) {
        const stats = getStats(targetKey);
        if (m.timestamp && (!stats.lastTime || m.timestamp > stats.lastTime)) {
          stats.lastTime = m.timestamp;
        }
        if (!m.apagadaEm) {
          if (!stats.lastValida || (m.timestamp || 0) >= (stats.lastValida.timestamp || 0)) {
            stats.lastValida = m;
          }
          const isRead = 
            (myUserId && m.lidasPor?.includes(myUserId)) || 
            (myUsername && m.lidasPor?.includes(myUsername)) ||
            (myCleanUid && m.lidasPor?.some(lp => lp.toLowerCase() === myCleanUid)) ||
            (myCleanUser && m.lidasPor?.some(lp => lp.toLowerCase().replace(/^@/, "") === myCleanUser));

          if (isIncoming && !isRead) {
            stats.unread += 1;
          }
        }
      }
    });

    // 6. Mescla O(C) dos contatos com lookup O(1) de estatísticas e presenças
    const removedSet = new Set(removedContactIds.map(id => id.toLowerCase().replace(/^@/, "").trim()));

    const result = Array.from(map.values())
      .filter(c => {
        const cleanU = (c.username || "").toLowerCase().replace(/^@/, "").trim();
        const cleanCId = (c.id || "").toLowerCase().trim();
        return !removedSet.has(cleanCId) && (!cleanU || !removedSet.has(cleanU));
      })
      .map(c => {
        const cleanU = (c.username || "").toLowerCase().replace(/^@/, "").trim();
        const cleanCId = (c.id || "").toLowerCase().trim();

        // O(1) Presence Lookup
        const pData = presenceByUid.get(cleanCId) || (cleanU ? presenceByUsername.get(cleanU) : undefined);

        // O(1) Message Stats Lookup
        const statsId = contactStatsMap.get(cleanCId);
        const statsUser = cleanU ? contactStatsMap.get(cleanU) : undefined;

        const unread = Math.max(statsId?.unread || 0, statsUser?.unread || 0);
        const lastTime = Math.max(statsId?.lastTime || 0, statsUser?.lastTime || 0) || undefined;
        
        let lastValida = statsId?.lastValida;
        if (statsUser?.lastValida && (!lastValida || (statsUser.lastValida.timestamp || 0) > (lastValida.timestamp || 0))) {
          lastValida = statsUser.lastValida;
        }

        let lastMessagePreview: string | undefined = undefined;
        if (lastValida) {
          lastMessagePreview = lastValida.imagemBase64 ? "📷 Foto" : lastValida.texto;
        }

        // Se pData existe, ele é a autoridade viva do Firestore
        const isContactAdmin = pData !== undefined 
          ? Boolean(pData.isAdmin) 
          : Boolean(c.isAdmin);
        
        const isOfficialDevContact = c.id === "ShKPy9xuGUeVTy8vFN1tLYdG2P63" || cleanU === "dev";
        const rawCargo = (pData?.cargo || c.cargo || "").toLowerCase().trim();
        const isDevContact = isOfficialDevContact && (rawCargo === "dev" || rawCargo === "desenvolvedor" || cleanU === "dev");
        const contactCargo = isDevContact 
          ? "dev" 
          : (isContactAdmin ? "admin" : (rawCargo && rawCargo !== "admin" && rawCargo !== "dev" ? rawCargo : "atendente"));

        return {
          ...c,
          displayName: pData?.displayName || c.displayName || c.username,
          username: pData?.username || c.username,
          isAdmin: isContactAdmin,
          cargo: contactCargo,
          photoUrl: pData?.photoUrl || c.photoUrl,
          recado: pData?.recado || c.recado,
          statusPreset: pData?.statusPreset || c.statusPreset || "disponivel",
          isOnline: pData?.isOnline ?? false,
          lastSeen: pData?.lastSeen ?? c.lastSeen,
          lastMessage: lastMessagePreview,
          lastMessageTime: lastTime,
          unreadCount: unread,
        };
      });

    return result.sort((a, b) => {
      if (a.isOnline && !b.isOnline) return -1;
      if (!a.isOnline && b.isOnline) return 1;
      return (b.lastMessageTime || 0) - (a.lastMessageTime || 0);
    });
  }, [contatos, presencas, mensagens, myUserId, myUsername, removedContactIds, hiddenLocalIds]);

  const totalNaoLidas = useMemo(() => {
    return mensagens.filter(m => m.remetenteId !== myUserId && !m.lidasPor.includes(myUserId) && !m.apagadaEm).length;
  }, [mensagens, myUserId]);

  // Ações do Chat
  const enviarMensagem = async (
    texto: string, 
    destinatarioId?: string, 
    imagemBase64?: string, 
    isPinned?: boolean,
    replyTo?: MensagemChat["replyTo"],
    parentId?: string,
    destinatarioUsername?: string,
    jogo?: JogoChatPayload
  ) => {
    if (!myUserId || myUserId === "local-session") return;
    const nome = operatorName;
    const username = myUsername;
    const cargo = operatorCargo;

    await enviarMensagemChat({
      remetenteId: myUserId,
      remetenteNome: nome,
      remetenteUsername: username,
      remetenteCargo: cargo,
      remetentePhotoUrl: myPhotoUrl || undefined,
      remetenteRecado: operatorRecado || undefined,
      remetenteStatusPreset: operatorStatusPreset || undefined,
      destinatarioId,
      texto,
      imagemBase64,
      isPinned: Boolean(isPinned && isAdmin),
      replyTo,
      parentId,
      jogo: jogo || undefined,
    });

    // Disparar Push Notification via Expo API → FCM (funciona com app fechado)
    const targets = [destinatarioId, destinatarioUsername].filter(Boolean) as string[];
    enviarPushNotificationParaUsuarios({
      destinatarioIds: targets.length > 0 ? targets : undefined,
      remetenteId: myUserId,
      remetenteNome: nome,
      remetenteUsername: username,
      texto,
      isMural: !destinatarioId,
      imagemAnexa: Boolean(imagemBase64)
    }).catch(() => {});
  };

  const alternarReacao = async (mensagemId: string, emoji: string) => {
    if (!myUserId || !mensagemId || !emoji) return;

    if (Platform.OS !== "web") {
      try {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    }

    // 1. Atualização OTIMISTA INSTANTÂNEA em memória (0ms de resposta na tela)
    const currentList = useChatStore.getState().mensagens;
    const updated = currentList.map(m => {
      if (m.id !== mensagemId) return m;
      const currentReacoes = { ...(m.reacoes || {}) };
      const currentUsers = [...(currentReacoes[emoji] || [])];

      let nextUsers: string[];
      if (currentUsers.includes(myUserId)) {
        // Remove a reação
        nextUsers = currentUsers.filter(u => u !== myUserId);
      } else {
        // Adiciona a reação
        nextUsers = [...currentUsers, myUserId];
      }

      if (nextUsers.length > 0) {
        currentReacoes[emoji] = nextUsers;
      } else {
        delete currentReacoes[emoji];
      }

      return { ...m, reacoes: currentReacoes };
    });

    setMensagens(updated);
    void salvarHistoricoNoDisco(updated);

    // 2. Persistência no Firestore
    try {
      await alternarReacaoMensagemChat(mensagemId, emoji, myUserId);
    } catch (err) {
      console.log("[Chat] Erro ao sincronizar reação com a nuvem:", err);
    }
  };

  const apagarMensagem = async (mensagemId: string) => {
    const updated = mensagens.map(m => m.id === mensagemId ? { ...m, apagadaEm: Date.now() } : m);
    setMensagens(updated);
    void salvarHistoricoNoDisco(updated);
    await apagarMensagemChat(mensagemId);
  };

  const excluirMensagemPermanente = async (mensagemId: string) => {
    const updated = mensagens.filter(m => m.id !== mensagemId);
    setMensagens(updated);
    void salvarHistoricoNoDisco(updated);
    await excluirMensagemPermanenteChat(mensagemId);
  };

  const apagarParaMim = async (mensagemId: string) => {
    if (!mensagemId) return;
    setHiddenLocalIds((prev) => {
      const updated = { ...prev, [mensagemId]: true };
      AsyncStorage.setItem(HIDDEN_LOCAL_KEY, JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  };

  const editarMensagem = async (mensagemId: string, novoTexto: string) => {
    const updated = mensagens.map(m => m.id === mensagemId ? { ...m, texto: novoTexto, editadaEm: Date.now() } : m);
    setMensagens(updated);
    void salvarHistoricoNoDisco(updated);
    await editarMensagemChat(mensagemId, novoTexto);
  };

  const desafixarAviso = async (mensagemId: string) => {
    await desafixarAvisoMural(mensagemId);
  };

  const marcarComoLida = async (mensagemId: string) => {
    if (!myUserId || !mensagemId) return;
    await marcarMensagemComoLidaChat(mensagemId, myUserId);
  };

  const marcarConversaComoLida = async (remetenteId: string, remetenteUsername?: string) => {
    if (!myUserId || !remetenteId) return;

    // 1. Atualização Otimista Imediata em Memória (0ms) - zera o contador de não lidas no ato!
    const cleanRId = (remetenteId || "").toLowerCase().trim();
    const cleanRUser = (remetenteUsername || "").toLowerCase().replace(/^@/, "").trim();
    const myCleanUid = (myUserId || "").toLowerCase().trim();
    const myCleanUser = (myUsername || "").toLowerCase().replace(/^@/, "").trim();

    const currentMsgs = useChatStore.getState().mensagens;
    let hasChanges = false;
    const updated = currentMsgs.map(m => {
      if (!m.destinatarioId) return m;

      const mRem = (m.remetenteId || "").toLowerCase().trim();
      const mRemU = (m.remetenteUsername || "").toLowerCase().replace(/^@/, "").trim();
      const mDest = (m.destinatarioId || "").toLowerCase().replace(/^@/, "").trim();

      const isFromContact = (cleanRId && mRem === cleanRId) || (cleanRUser && (mRem === cleanRUser || mRemU === cleanRUser));
      const isToMe = (myCleanUid && mDest === myCleanUid) || (myCleanUser && mDest === myCleanUser);

      if (isFromContact && isToMe) {
        const lidas = m.lidasPor || [];
        const isRead = 
          lidas.includes(myUserId) || 
          (myUsername && lidas.includes(myUsername)) ||
          (myCleanUid && lidas.some(lp => lp.toLowerCase() === myCleanUid)) ||
          (myCleanUser && lidas.some(lp => lp.toLowerCase().replace(/^@/, "") === myCleanUser));

        if (!isRead) {
          hasChanges = true;
          return {
            ...m,
            lidasPor: [...lidas, myUserId, ...(myUsername ? [myUsername] : [])]
          };
        }
      }
      return m;
    });

    if (hasChanges) {
      useChatStore.getState().setMensagens(updated);
      void salvarHistoricoNoDisco(updated);
    }

    // 2. Persiste no Firestore
    await marcarConversaComoLidaChat(remetenteId, myUserId, myUsername, remetenteUsername);
  };

  const adicionarContatoPorTag = async (tag: string): Promise<{ success: boolean; contact?: ChatContact; error?: string }> => {
    try {
      const clean = tag.replace(/^@/, "").toLowerCase().trim();
      if (!clean) return { success: false, error: "Digite uma tag válida." };
      if (clean === myUsername) return { success: false, error: "Você não pode adicionar a sua própria tag." };

      const found = await buscarUsuarioPorTag(clean);
      if (!found) {
        return { success: false, error: `Usuário @${clean} não encontrado.` };
      }

      // Se havia sido removido anteriormente, reativa
      const updatedRemoved = removedContactIds.filter(id => id !== found.id && id !== clean);
      setRemovedContactIds(updatedRemoved);
      await AsyncStorage.setItem(REMOVED_CONTACTS_KEY, JSON.stringify(updatedRemoved)).catch(() => {});

      await salvarContatoUsuario(myUserId, found);
      useChatStore.getState().setContatos([
        ...useChatStore.getState().contatos.filter(c => c.id !== found.id),
        found
      ]);
      return { success: true, contact: found };
    } catch (e: any) {
      return { success: false, error: e.message || "Erro ao adicionar contato." };
    }
  };

  const checarDisponibilidadeTag = async (tag: string) => {
    const clean = tag.replace(/^@/, "").toLowerCase().trim();
    if (!clean) return { disponivel: false, motivo: "Tag inválida" };
    return await verificarDisponibilidadeUsername(clean, myUserId);
  };

  const atualizarMeuPerfil = async (
    novoNome: string, 
    novoUsername: string,
    novoCargo?: string,
    photoUrl?: string | null,
    recado?: string | null,
    statusPreset?: string | null
  ): Promise<{ success: boolean; error?: string; cleanUsername?: string }> => {
    try {
      const finalCargo = novoCargo || operatorCargo || (isAdmin ? "admin" : "atendente");
      const res = await alterarUsernameComSeguranca(
        myUserId,
        myUsername,
        novoUsername,
        novoNome,
        isAdmin,
        finalCargo,
        photoUrl,
        recado,
        statusPreset
      );

      if (!res.success) {
        return res;
      }

      const cleanUser = res.cleanUsername || novoUsername.replace(/^@/, "").toLowerCase().trim();
      const updatedProfile = {
        displayName: novoNome.trim() || cleanUser,
        username: cleanUser,
        cargo: finalCargo,
        isAdmin,
        photoUrl: photoUrl !== undefined ? (photoUrl ? photoUrl : null) : (myProfile?.photoUrl || null),
        recado: recado !== undefined ? (recado ? recado.trim() : null) : (myProfile?.recado || null),
        statusPreset: statusPreset !== undefined ? (statusPreset ? statusPreset.trim() : null) : (myProfile?.statusPreset || "disponivel")
      };

      setMyProfile(updatedProfile);
      await AsyncStorage.setItem(USER_PROFILE_KEY, JSON.stringify(updatedProfile)).catch(() => {});

      return res;
    } catch (e: any) {
      return { success: false, error: e.message || "Erro ao salvar perfil." };
    }
  };

  const removerContato = async (contatoId: string) => {
    const targetContact = contatos.find(c => c.id === contatoId);
    const cleanU = targetContact?.username ? targetContact.username.toLowerCase().replace(/^@/, "").trim() : "";
    const updatedRemoved = Array.from(new Set([...removedContactIds, contatoId, cleanU].filter(Boolean)));
    setRemovedContactIds(updatedRemoved);
    await AsyncStorage.setItem(REMOVED_CONTACTS_KEY, JSON.stringify(updatedRemoved)).catch(() => {});

    useChatStore.getState().setContatos(
      useChatStore.getState().contatos.filter(c => c.id !== contatoId)
    );
    await removerContatoUsuario(myUserId, contatoId);
  };

  const alternarFixarMensagem = async (mensagemId: string, isPinned: boolean) => {
    if (!isAdmin) return;
    setMensagens(
      mensagens.map(m => m.id === mensagemId ? { ...m, isPinned } : m)
    );
    await alternarFixarMensagemMuralChat(mensagemId, isPinned);
  };

  const alternarAdminUsuario = async (userId: string, targetIsAdmin: boolean) => {
    if (!isAdmin && userId !== myUserId) return;
    await atualizarStatusAdminUsuario(userId, targetIsAdmin);
    if (userId === myUserId && !targetIsAdmin) {
      setIsAdmin(false);
      if (myProfile) {
        setMyProfile({ ...myProfile, isAdmin: false, cargo: "operador" });
      }
      await AsyncStorage.removeItem(ADMIN_PIN_KEY);
    }
  };

  const autenticarPinMestre = async (pin: string): Promise<boolean> => {
    const cleanPin = pin.trim();
    if (ADMIN_MASTER_PIN && cleanPin === ADMIN_MASTER_PIN) {
      setIsAdmin(true);
      await atualizarStatusAdminUsuario(myUserId, true);
      if (myProfile) {
        setMyProfile({ ...myProfile, isAdmin: true, cargo: "admin" });
      }
      await AsyncStorage.setItem(ADMIN_PIN_KEY, "true");
      return true;
    }
    return false;
  };

  const limparMuralGeral = async () => {
    return await limparMuralGeralChat();
  };

  const limparTodasMensagens = async () => {
    return await limparTodasMensagensChat();
  };

  const iniciarJogo = async (
    destinatario: ChatContact, 
    tipo: TipoJogoChat = "velha", 
    customPalavra?: string, 
    customDica?: string,
    customTema?: string
  ) => {
    if (!myUserId || !destinatario) return;

    // Revezamento Inteligente: verifica se já existia jogo anterior deste tipo nesta conversa
    const currentMsgs = useChatStore.getState().mensagens;
    const jogosAnteriores = currentMsgs
      .filter(m => m.jogo && m.jogo.tipo === tipo && isMessageInDirectChat(m, myUserId, myUsername, destinatario))
      .sort((a, b) => b.timestamp - a.timestamp);

    let primeiroAJogarId = myUserId;
    if (jogosAnteriores.length > 0 && jogosAnteriores[0].jogo) {
      const ultimoJogo = jogosAnteriores[0].jogo;
      const ultimoIniciador = ultimoJogo.quemIniciouId || ultimoJogo.jogador1Id;
      // Revezamento justo: alterna quem dá a 1ª jogada!
      primeiroAJogarId = (ultimoIniciador === myUserId) ? destinatario.id : myUserId;
    }

    let payloadJogo: JogoChatPayload;
    const nomeJogo = tipo === "stop"
      ? "Stop! Adedonha"
      : tipo === "termo_versus"
      ? "Termo Versus"
      : tipo === "batalha_naval" 
      ? "Batalha Naval" 
      : tipo === "quatro_linha" 
      ? "4 em Linha" 
      : tipo === "forca"
      ? "Jogo da Forca"
      : "Jogo da Velha";

    if (tipo === "stop") {
      payloadJogo = criarPartidaStop(
        myUserId,
        operatorName || myUsername || "Jogador 1",
        myUsername,
        destinatario.id,
        destinatario.displayName || destinatario.username || "Jogador 2",
        destinatario.username
      );
    } else if (tipo === "forca") {
      payloadJogo = criarPartidaForca(
        myUserId,
        operatorName || myUsername || "Jogador 1",
        myUsername,
        destinatario.id,
        destinatario.displayName || destinatario.username || "Jogador 2",
        destinatario.username,
        customPalavra,
        customTema,
        customDica
      );
    } else if (tipo === "termo_versus") {
      payloadJogo = criarPartidaTermo(
        myUserId,
        operatorName || myUsername || "Jogador 1",
        myUsername,
        destinatario.id,
        destinatario.displayName || destinatario.username || "Jogador 2",
        destinatario.username,
        customPalavra,
        customDica
      );
    } else if (tipo === "batalha_naval") {
      payloadJogo = criarPartidaBatalhaNaval(
        myUserId,
        operatorName || myUsername || "Jogador 1",
        myUsername,
        destinatario.id,
        destinatario.displayName || destinatario.username || "Jogador 2",
        destinatario.username,
        primeiroAJogarId
      );
    } else if (tipo === "quatro_linha") {
      payloadJogo = criarPartidaQuatroEmLinha(
        myUserId,
        operatorName || myUsername || "Jogador 1",
        myUsername,
        destinatario.id,
        destinatario.displayName || destinatario.username || "Jogador 2",
        destinatario.username,
        primeiroAJogarId
      );
    } else {
      payloadJogo = criarPartidaJogoDaVelha(
        myUserId,
        operatorName || myUsername || "Jogador 1",
        myUsername,
        destinatario.id,
        destinatario.displayName || destinatario.username || "Jogador 2",
        destinatario.username,
        primeiroAJogarId
      );
    }

    await enviarMensagem(
      `🎮 Desafio no ${nomeJogo} contra @${destinatario.username || destinatario.displayName}!`,
      destinatario.id,
      undefined,
      false,
      undefined,
      undefined,
      destinatario.username,
      payloadJogo
    );
  };

  const jogarVelha = async (mensagemId: string, posicao: number): Promise<{ sucesso: boolean; erro?: string }> => {
    const currentMsgs = useChatStore.getState().mensagens;
    const msg = currentMsgs.find(m => m.id === mensagemId);
    if (!msg || !msg.jogo) return { sucesso: false, erro: "Jogo não encontrado." };

    const resultado = processarJogadaVelha(msg.jogo, posicao, myUserId, myUsername);
    if (!resultado.sucesso || !resultado.novoPayload) {
      return { sucesso: false, erro: resultado.erro };
    }

    // 1. Atualização Otimista Imediata em Memória (0ms)
    const updated = currentMsgs.map(m => m.id === mensagemId ? { ...m, jogo: resultado.novoPayload } : m);
    useChatStore.getState().setMensagens(updated);
    void salvarHistoricoNoDisco(updated);

    // 2. Persistência na Nuvem
    try {
      await atualizarEstadoJogoChat(mensagemId, resultado.novoPayload);
    } catch (e) {
      console.warn("[ChatGame] Erro ao sincronizar jogada:", e);
    }

    return { sucesso: true };
  };

  const jogarQuatroEmLinha = async (mensagemId: string, coluna: number): Promise<{ sucesso: boolean; erro?: string }> => {
    const currentMsgs = useChatStore.getState().mensagens;
    const msg = currentMsgs.find(m => m.id === mensagemId);
    if (!msg || !msg.jogo) return { sucesso: false, erro: "Jogo não encontrado." };

    const resultado = processarJogadaQuatroLinha(msg.jogo, coluna, myUserId, myUsername);
    if (!resultado.sucesso || !resultado.novoPayload) {
      return { sucesso: false, erro: resultado.erro };
    }

    // 1. Atualização Otimista Imediata em Memória (0ms)
    const updated = currentMsgs.map(m => m.id === mensagemId ? { ...m, jogo: resultado.novoPayload } : m);
    useChatStore.getState().setMensagens(updated);
    void salvarHistoricoNoDisco(updated);

    // 2. Persistência na Nuvem
    try {
      await atualizarEstadoJogoChat(mensagemId, resultado.novoPayload);
    } catch (e) {
      console.warn("[ChatGame] Erro ao sincronizar jogada 4 em linha:", e);
    }

    return { sucesso: true };
  };

  const dispararBatalhaNaval = async (mensagemId: string, index: number): Promise<{ sucesso: boolean; erro?: string }> => {
    const currentMsgs = useChatStore.getState().mensagens;
    const msg = currentMsgs.find(m => m.id === mensagemId);
    if (!msg || !msg.jogo) return { sucesso: false, erro: "Jogo não encontrado." };

    const resultado = processarTiroBatalhaNaval(msg.jogo, index, myUserId, myUsername);
    if (!resultado.sucesso || !resultado.novoPayload) {
      return { sucesso: false, erro: resultado.erro };
    }

    // 1. Atualização Otimista Imediata em Memória (0ms)
    const updated = currentMsgs.map(m => m.id === mensagemId ? { ...m, jogo: resultado.novoPayload } : m);
    useChatStore.getState().setMensagens(updated);
    void salvarHistoricoNoDisco(updated);

    // 2. Persistência na Nuvem
    try {
      await atualizarEstadoJogoChat(mensagemId, resultado.novoPayload);
    } catch (e) {
      console.warn("[ChatGame] Erro ao sincronizar tiro batalha naval:", e);
    }

    return { sucesso: true };
  };

  const jogarTermoVersus = async (mensagemId: string, palpite: string): Promise<{ sucesso: boolean; erro?: string }> => {
    const currentMsgs = useChatStore.getState().mensagens;
    const msg = currentMsgs.find(m => m.id === mensagemId);
    if (!msg || !msg.jogo) return { sucesso: false, erro: "Jogo não encontrado." };

    const resultado = processarPalpiteTermo(msg.jogo, palpite, myUserId, myUsername);
    if (!resultado.sucesso || !resultado.novoPayload) {
      return { sucesso: false, erro: resultado.erro };
    }

    // 1. Atualização Otimista Imediata em Memória (0ms)
    const updated = currentMsgs.map(m => m.id === mensagemId ? { ...m, jogo: resultado.novoPayload } : m);
    useChatStore.getState().setMensagens(updated);
    void salvarHistoricoNoDisco(updated);

    // 2. Persistência na Nuvem
    try {
      await atualizarEstadoJogoChat(mensagemId, resultado.novoPayload);
    } catch (e) {
      console.warn("[ChatGame] Erro ao sincronizar palpite termo:", e);
    }

    return { sucesso: true };
  };

  const chutarLetraForca = async (mensagemId: string, letra: string): Promise<{ sucesso: boolean; erro?: string }> => {
    const currentMsgs = useChatStore.getState().mensagens;
    const msg = currentMsgs.find(m => m.id === mensagemId);
    if (!msg || !msg.jogo) return { sucesso: false, erro: "Jogo não encontrado." };

    const resultado = processarChuteLetraForca(msg.jogo, letra, myUserId, myUsername);
    if (!resultado.sucesso || !resultado.novoPayload) {
      return { sucesso: false, erro: resultado.erro };
    }

    const updated = currentMsgs.map(m => m.id === mensagemId ? { ...m, jogo: resultado.novoPayload } : m);
    useChatStore.getState().setMensagens(updated);
    void salvarHistoricoNoDisco(updated);

    try {
      await atualizarEstadoJogoChat(mensagemId, resultado.novoPayload);
    } catch (e) {
      console.warn("[ChatGame] Erro ao sincronizar forca:", e);
    }

    return { sucesso: true };
  };

  const chutarPalavraForca = async (mensagemId: string, palavra: string): Promise<{ sucesso: boolean; erro?: string }> => {
    const currentMsgs = useChatStore.getState().mensagens;
    const msg = currentMsgs.find(m => m.id === mensagemId);
    if (!msg || !msg.jogo) return { sucesso: false, erro: "Jogo não encontrado." };

    const resultado = processarChutePalavraInteiraForca(msg.jogo, palavra, myUserId, myUsername);
    if (!resultado.sucesso || !resultado.novoPayload) {
      return { sucesso: false, erro: resultado.erro };
    }

    const updated = currentMsgs.map(m => m.id === mensagemId ? { ...m, jogo: resultado.novoPayload } : m);
    useChatStore.getState().setMensagens(updated);
    void salvarHistoricoNoDisco(updated);

    try {
      await atualizarEstadoJogoChat(mensagemId, resultado.novoPayload);
    } catch (e) {
      console.warn("[ChatGame] Erro ao sincronizar forca:", e);
    }

    return { sucesso: true };
  };

  const adicionarDicaForca = async (mensagemId: string, dica: string): Promise<{ sucesso: boolean; erro?: string }> => {
    const currentMsgs = useChatStore.getState().mensagens;
    const msg = currentMsgs.find(m => m.id === mensagemId);
    if (!msg || !msg.jogo) return { sucesso: false, erro: "Jogo não encontrado." };

    const resultado = adicionarDicaCriadorForca(msg.jogo, dica, myUserId, myUsername);
    if (!resultado.sucesso || !resultado.novoPayload) {
      return { sucesso: false, erro: resultado.erro };
    }

    const updated = currentMsgs.map(m => m.id === mensagemId ? { ...m, jogo: resultado.novoPayload } : m);
    useChatStore.getState().setMensagens(updated);
    void salvarHistoricoNoDisco(updated);

    try {
      await atualizarEstadoJogoChat(mensagemId, resultado.novoPayload);
    } catch (e) {
      console.warn("[ChatGame] Erro ao sincronizar dica forca:", e);
    }

    return { sucesso: true };
  };

  const pedirDicaForca = async (mensagemId: string): Promise<{ sucesso: boolean; erro?: string }> => {
    const currentMsgs = useChatStore.getState().mensagens;
    const msg = currentMsgs.find(m => m.id === mensagemId);
    if (!msg || !msg.jogo) return { sucesso: false, erro: "Jogo não encontrado." };

    const resultado = acionarPedidoDicaForca(msg.jogo, myUserId, myUsername);
    if (!resultado.sucesso || !resultado.novoPayload) {
      return { sucesso: false, erro: resultado.erro };
    }

    const updated = currentMsgs.map(m => m.id === mensagemId ? { ...m, jogo: resultado.novoPayload } : m);
    useChatStore.getState().setMensagens(updated);
    void salvarHistoricoNoDisco(updated);

    try {
      await atualizarEstadoJogoChat(mensagemId, resultado.novoPayload);
    } catch (e) {
      console.warn("[ChatGame] Erro ao sincronizar SOS forca:", e);
    }

    return { sucesso: true };
  };

  const revelarLetraForca = async (mensagemId: string): Promise<{ sucesso: boolean; erro?: string }> => {
    const currentMsgs = useChatStore.getState().mensagens;
    const msg = currentMsgs.find(m => m.id === mensagemId);
    if (!msg || !msg.jogo) return { sucesso: false, erro: "Jogo não encontrado." };

    const resultado = revelarLetraCriadorForca(msg.jogo, myUserId, myUsername);
    if (!resultado.sucesso || !resultado.novoPayload) {
      return { sucesso: false, erro: resultado.erro };
    }

    const updated = currentMsgs.map(m => m.id === mensagemId ? { ...m, jogo: resultado.novoPayload } : m);
    useChatStore.getState().setMensagens(updated);
    void salvarHistoricoNoDisco(updated);

    try {
      await atualizarEstadoJogoChat(mensagemId, resultado.novoPayload);
    } catch (e) {
      console.warn("[ChatGame] Erro ao sincronizar revelar letra:", e);
    }

    return { sucesso: true };
  };

  const submeterRespostasStop = async (mensagemId: string, respostas: StopRespostas, acionouStop: boolean): Promise<{ sucesso: boolean; erro?: string }> => {
    if (!myUserId) return { sucesso: false, erro: "Usuário não autenticado." };
    const currentMsgs = useChatStore.getState().mensagens;
    const msg = currentMsgs.find(m => m.id === mensagemId);
    if (!msg || !msg.jogo || msg.jogo.tipo !== "stop") return { sucesso: false, erro: "Partida de Stop não encontrada." };

    const resultado = execSubmeterRespostasStop(msg.jogo, myUserId, respostas, acionouStop);
    if (!resultado.sucesso) return resultado;

    // 1. Otimista (0ms)
    const updated = currentMsgs.map(m => m.id === mensagemId ? { ...m, jogo: resultado.payload } : m);
    useChatStore.getState().setMensagens(updated);
    void salvarHistoricoNoDisco(updated);

    // 2. Nuvem
    try {
      await atualizarEstadoJogoChat(mensagemId, resultado.payload);
    } catch (e) {
      console.warn("[ChatGame] Erro ao submeter respostas do Stop:", e);
    }

    return { sucesso: true };
  };

  const alternarValidacaoStop = async (mensagemId: string, alvoJogador: "j1" | "j2", categoria: keyof ValidacaoStop): Promise<{ sucesso: boolean; erro?: string }> => {
    const currentMsgs = useChatStore.getState().mensagens;
    const msg = currentMsgs.find(m => m.id === mensagemId);
    if (!msg || !msg.jogo || msg.jogo.tipo !== "stop") return { sucesso: false, erro: "Partida de Stop não encontrada." };

    const resultado = alternarValidacaoItemStop(msg.jogo, alvoJogador, categoria);
    if (!resultado.sucesso) return { sucesso: false };

    // 1. Otimista (0ms)
    const updated = currentMsgs.map(m => m.id === mensagemId ? { ...m, jogo: resultado.payload } : m);
    useChatStore.getState().setMensagens(updated);
    void salvarHistoricoNoDisco(updated);

    // 2. Nuvem
    try {
      await atualizarEstadoJogoChat(mensagemId, resultado.payload);
    } catch (e) {
      console.warn("[ChatGame] Erro ao alternar validação:", e);
    }

    return { sucesso: true };
  };

  const finalizarRodadaStop = async (mensagemId: string): Promise<{ sucesso: boolean; erro?: string }> => {
    const currentMsgs = useChatStore.getState().mensagens;
    const msg = currentMsgs.find(m => m.id === mensagemId);
    if (!msg || !msg.jogo || msg.jogo.tipo !== "stop") return { sucesso: false, erro: "Partida de Stop não encontrada." };

    const resultado = execFinalizarRodadaStop(msg.jogo);
    if (!resultado.sucesso) return { sucesso: false };

    // 1. Otimista (0ms)
    const updated = currentMsgs.map(m => m.id === mensagemId ? { ...m, jogo: resultado.payload } : m);
    useChatStore.getState().setMensagens(updated);
    void salvarHistoricoNoDisco(updated);

    // 2. Nuvem
    try {
      await atualizarEstadoJogoChat(mensagemId, resultado.payload);
    } catch (e) {
      console.warn("[ChatGame] Erro ao finalizar rodada de Stop:", e);
    }

    return { sucesso: true };
  };

  const reiniciarJogo = async (mensagemId: string, customPalavra?: string, customDica?: string): Promise<{ sucesso: boolean; erro?: string }> => {
    const currentMsgs = useChatStore.getState().mensagens;
    const msg = currentMsgs.find(m => m.id === mensagemId);
    if (!msg || !msg.jogo) return { sucesso: false, erro: "Jogo não encontrado." };

    const novoPayload = msg.jogo.tipo === "stop"
      ? reiniciarPartidaStop(msg.jogo)
      : msg.jogo.tipo === "termo_versus"
      ? reiniciarPartidaTermo(msg.jogo, customPalavra, customDica)
      : msg.jogo.tipo === "forca"
      ? criarPartidaForca(
          msg.jogo.jogador1Id,
          msg.jogo.jogador1Nome,
          msg.jogo.jogador1Username,
          msg.jogo.jogador2Id,
          msg.jogo.jogador2Nome,
          msg.jogo.jogador2Username,
          customPalavra,
          customDica
        )
      : msg.jogo.tipo === "batalha_naval"
      ? reiniciarPartidaBatalhaNaval(msg.jogo)
      : msg.jogo.tipo === "quatro_linha"
      ? reiniciarPartidaQuatroEmLinha(msg.jogo)
      : reiniciarPartidaVelha(msg.jogo);

    // 1. Otimista (0ms)
    const updated = currentMsgs.map(m => m.id === mensagemId ? { ...m, jogo: novoPayload } : m);
    useChatStore.getState().setMensagens(updated);
    void salvarHistoricoNoDisco(updated);

    // 2. Nuvem
    try {
      await atualizarEstadoJogoChat(mensagemId, novoPayload);
    } catch (e) {
      console.warn("[ChatGame] Erro ao reiniciar partida:", e);
    }

    return { sucesso: true };
  };

  return {
    mensagens,
    mensagensMural,
    mensagensMuralRoots,
    getThreadMessages,
    getThreadInfo,
    avisoFixadoMural,
    contatos: contatosCompletos,
    presencas,
    totalNaoLidas,
    myUserId,
    myUsername,
    myPhotoUrl,
    operatorName,
    operatorCargo,
    operatorRecado,
    operatorStatusPreset,
    isAdmin,
    activeChatId,
    setActiveChatId,
    hiddenLocalIds,
    enviarMensagem,
    alternarReacao,
    apagarMensagem,
    apagarParaMim,
    excluirMensagemPermanente,
    editarMensagem,
    desafixarAviso,
    alternarFixarMensagem,
    alternarAdminUsuario,
    marcarComoLida,
    marcarConversaComoLida,
    adicionarContatoPorTag,
    removerContato,
    checarDisponibilidadeTag,
    atualizarMeuPerfil,
    autenticarPinMestre,
    limparMuralGeral,
    limparTodasMensagens,
    iniciarJogo,
    jogarVelha,
    jogarQuatroEmLinha,
    dispararBatalhaNaval,
    jogarTermoVersus,
    chutarLetraForca,
    chutarPalavraForca,
    adicionarDicaForca,
    pedirDicaForca,
    revelarLetraForca,
    submeterRespostasStop,
    alternarValidacaoStop,
    finalizarRodadaStop,
    reiniciarJogo,
  };
}
