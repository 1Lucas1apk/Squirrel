import { useEffect, useState, useMemo, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import * as Notifications from 'expo-notifications';
import { useChatStore } from "../store/chat-store";
import { 
  ouvirMensagensChat, 
  enviarMensagemChat, 
  marcarMensagemComoLida,
  ouvirPresenca,
  registrarCaixaEOnline
} from "../services/repositories/chat-repository";
import { useAppSettings } from "./use-app-settings";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function useChat() {
  const { mensagens, setMensagens } = useChatStore();
  const { settings } = useAppSettings();
  
  const pairingCode = settings.chatPairingCode?.trim();
  const operatorName = settings.chatOperatorName?.trim() || "Desconhecido";
  
  // O ID do usuário no chat agora é ESTRITAMENTE o nome dele.
  // Isso impede duplicações e garante total independência do "Caixa" ou "Turno".
  const chatUserId = operatorName.toLowerCase().replace(/[^a-z0-9]/g, "");

  const [lastMsgCount, setLastMsgCount] = useState(0);
  const isFirstLoad = useRef(true);

  // Pedir permissão de notificação (Expo Notifications - Funciona nativo no App)
  useEffect(() => {
    async function requestPermissions() {
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') {
        await Notifications.requestPermissionsAsync();
      }
    }
    requestPermissions();
  }, []);

  // Notificações de Novas Mensagens
  useEffect(() => {
    if (mensagens.length === 0) return;
    
    if (isFirstLoad.current) {
      setLastMsgCount(mensagens.length);
      isFirstLoad.current = false;
      return;
    }

    if (mensagens.length > lastMsgCount) {
      const novas = mensagens.slice(lastMsgCount);
      novas.forEach(msg => {
        if (msg.remetenteId !== chatUserId && !msg.apagadaEm) {
          Notifications.scheduleNotificationAsync({
            content: {
              title: `Mensagem de ${msg.remetenteNome}`,
              body: msg.texto,
            },
            trigger: null,
          });
        }
      });
      setLastMsgCount(mensagens.length);
    } else if (mensagens.length < lastMsgCount) {
      // Ajusta caso alguma mensagem seja apagada definitivamente
      setLastMsgCount(mensagens.length);
    }
  }, [mensagens, chatUserId, lastMsgCount]);

  // 1. Registrar Presença e Ouvir Mensagens
  useEffect(() => {
    if (!pairingCode || !chatUserId || operatorName === "Desconhecido") return;

    // Registra presença usando o próprio nome (slug) como ID
    registrarCaixaEOnline(chatUserId, operatorName, pairingCode).catch(console.error);

    // Ouve mensagens deste grupo de pareamento
    const unsub = ouvirMensagensChat(pairingCode, (msgs) => {
      setMensagens(msgs);
    });

    return () => unsub();
  }, [pairingCode, chatUserId, operatorName, setMensagens]);

  const enviarMensagem = async (texto: string, destinatarioId?: string) => {
    if (!chatUserId || !pairingCode) return;
    await enviarMensagemChat({
      remetenteId: chatUserId,
      remetenteNome: operatorName,
      destinatarioId,
      texto
    }, pairingCode);
  };

  const apagarMensagem = async (mensagemId: string) => {
    if (!pairingCode) return;
    const { apagarMensagemChat } = await import("../services/repositories/chat-repository");
    await apagarMensagemChat(mensagemId, pairingCode);
  };

  const editarMensagem = async (mensagemId: string, novoTexto: string) => {
    if (!pairingCode) return;
    const { editarMensagemChat } = await import("../services/repositories/chat-repository");
    await editarMensagemChat(mensagemId, novoTexto, pairingCode);
  };

  const removerFantasma = async (fantasmaId: string) => {
    if (!pairingCode) return;
    const { removerPresencaMorta } = await import("../services/repositories/chat-repository");
    await removerPresencaMorta(pairingCode, fantasmaId);
  };

  const marcarComoLida = async (mensagemId: string) => {
    if (!chatUserId || !pairingCode) return;
    await marcarMensagemComoLida(mensagemId, chatUserId, pairingCode);
  };

  const naoLidas = useMemo(() => {
    if (!chatUserId) return [];
    return mensagens.filter(m => 
      m.remetenteId !== chatUserId && 
      !m.lidasPor.includes(chatUserId) &&
      (!m.destinatarioId || m.destinatarioId === chatUserId)
    );
  }, [mensagens, chatUserId]);

  const mensagensMural = useMemo(() => mensagens.filter(m => !m.destinatarioId), [mensagens]);

  // 3. Ouvir Todos os Contatos e Presença
  const [contatos, setContatos] = useState<{id: string, nome: string}[]>([]);
  const [onlineIds, setOnlineIds] = useState<string[]>([]);

  useEffect(() => {
    if (!pairingCode) {
      setContatos([]);
      setOnlineIds([]);
      return;
    }
    
    // Ouve TODOS os contatos (offline e online) registrados no Firestore
    const { ouvirContatos, ouvirPresenca } = require("../services/repositories/chat-repository");
    
    const unsubContatos = ouvirContatos(pairingCode, (lista: any[]) => {
      // Auto-limpeza de fantasmas antigos (com UUIDs gerados aleatoriamente)
      lista.forEach(c => {
        const expectedId = c.nome.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (c.id !== expectedId) {
          const { removerPresencaMorta } = require("../services/repositories/chat-repository");
          removerPresencaMorta(pairingCode, c.id).catch(console.error);
        }
      });

      // Filtra apenas os válidos e remove o próprio usuário
      const validos = lista.filter(c => c.id === c.nome.toLowerCase().replace(/[^a-z0-9]/g, ""));
      setContatos(validos.filter((c: any) => c.id !== chatUserId));
    });

    // Ouve quem está ONLINE no momento
    const unsubPresenca = ouvirPresenca(pairingCode, (onlineCaixas: any[]) => {
      setOnlineIds(onlineCaixas.map(c => c.id));
    });

    return () => {
      unsubContatos();
      unsubPresenca();
    };
  }, [pairingCode, chatUserId]);

  const caixasAtivos = useMemo(() => {
    return contatos.map(c => ({
      ...c,
      isOnline: onlineIds.includes(c.id)
    }));
  }, [contatos, onlineIds]);

  return {
    mensagens,
    mensagensMural,
    naoLidas,
    caixasAtivos,
    meuCaixaId: chatUserId,
    operatorName,
    enviarMensagem,
    apagarMensagem,
    editarMensagem,
    removerFantasma,
    marcarComoLida,
    hasPairingCode: !!pairingCode && operatorName !== "Desconhecido"
  };
}
