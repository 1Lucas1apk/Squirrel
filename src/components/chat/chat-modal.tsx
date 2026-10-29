import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { 
  View, 
  Text, 
  Pressable, 
  TextInput, 
  FlatList, 
  KeyboardAvoidingView, 
  Platform, 
  Modal, 
  Image, 
  ScrollView, 
  Dimensions, 
  ActivityIndicator, 
  Clipboard,
  Keyboard,
  Animated,
  PanResponder
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { 
  X, 
  Send, 
  Camera, 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  Crown, 
  Briefcase, 
  Tag, 
  Bike, 
  Terminal,
  Zap, 
  Delete, 
  Pin, 
  PinOff, 
  Copy, 
  Search, 
  Check, 
  CheckCheck, 
  CheckSquare, 
  Image as ImageIcon, 
  Maximize2, 
  ShieldCheck, 
  MessageSquare, 
  Megaphone, 
  UserPlus, 
  UserCheck, 
  Edit2, 
  Trash2, 
  AlertTriangle, 
  Info, 
  Eye, 
  Smile, 
  HelpCircle,
  CornerDownRight, 
  CornerDownLeft, 
  MessageCircle, 
  Heart, 
  Sparkles,
  Coffee,
  Lock,
  Gamepad2
} from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { useChat, isMessageInDirectChat } from "../../hooks/use-chat";
import { useAppSettings } from "../../hooks/use-app-settings";
import { ChatContact, MensagemChat } from "../../types/domain";
import { uploadImagemParaServidor } from "../../services/media-upload-service";
import { formatGoogleDriveThumbnailUrl, cacheDriveImage } from "../../services/google-drive-direct-service";
import { CustomToast, ToastConfig } from "../common/custom-toast";
import { ProfileModal } from "../dashboard/profile-modal";
import { PixelArcadeUploadCard } from "./pixel-arcade-upload-card";
import { HeartPopOverlay } from "./heart-pop-overlay";
import { AdvancedPhotoViewer, PhotoViewerMeta } from "./advanced-photo-viewer";
import { LinkPreview } from "./link-preview";
import { JogoDaVelhaCard } from "./games/jogo-da-velha-card";
import { QuatroEmLinhaCard } from "./games/quatro-em-linha-card";
import { BatalhaNavalCard } from "./games/batalha-naval-card";
import { TermoCard } from "./games/termo-card";
import { ForcaCard } from "./games/forca-card";
import { StopCard } from "./games/stop-card";
import { GamesHubModal } from "./games/games-hub-modal";
import { DEV_UID, DEV_EMAIL } from "../../services/repositories/chat-repository";

interface SwipeableMessageRowProps {
  item: MensagemChat;
  isMe: boolean;
  onSwipeReply: () => void;
  onLongPress: () => void;
  children: React.ReactNode;
}

function SwipeableMessageRow({
  item,
  isMe,
  onSwipeReply,
  onLongPress,
  children
}: SwipeableMessageRowProps) {
  const pan = useRef(new Animated.Value(0)).current;
  const iconScale = useRef(new Animated.Value(0)).current;
  const isTriggered = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        const isHorizontal = Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5;
        if (isMe) {
          // Minha mensagem: Arrastar para a DIREITA (dx > 12)
          return gestureState.dx > 12 && isHorizontal;
        } else {
          // Mensagem dele: Arrastar para a ESQUERDA (dx < -12)
          return gestureState.dx < -12 && isHorizontal;
        }
      },
      onPanResponderGrant: () => {
        isTriggered.current = false;
      },
      onPanResponderMove: (_, gestureState) => {
        if (isMe) {
          if (gestureState.dx > 0) {
            const limitedDx = Math.min(75, gestureState.dx * 0.75);
            pan.setValue(limitedDx);
            const progress = Math.min(1, limitedDx / 45);
            iconScale.setValue(progress);

            if (limitedDx >= 45 && !isTriggered.current) {
              isTriggered.current = true;
              if (Platform.OS !== "web") {
                try {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                } catch {}
              }
            } else if (limitedDx < 45 && isTriggered.current) {
              isTriggered.current = false;
            }
          }
        } else {
          if (gestureState.dx < 0) {
            const limitedDx = Math.max(-75, gestureState.dx * 0.75);
            pan.setValue(limitedDx);
            const progress = Math.min(1, Math.abs(limitedDx) / 45);
            iconScale.setValue(progress);

            if (Math.abs(limitedDx) >= 45 && !isTriggered.current) {
              isTriggered.current = true;
              if (Platform.OS !== "web") {
                try {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                } catch {}
              }
            } else if (Math.abs(limitedDx) < 45 && isTriggered.current) {
              isTriggered.current = false;
            }
          }
        }
      },
      onPanResponderRelease: () => {
        const triggered = isTriggered.current;
        Animated.parallel([
          Animated.spring(pan, { toValue: 0, useNativeDriver: true, bounciness: 6 }),
          Animated.spring(iconScale, { toValue: 0, useNativeDriver: true })
        ]).start();

        if (triggered) {
          onSwipeReply();
        }
      }
    })
  ).current;

  if ((Platform.OS as string) === "web") {
    return (
      <View className={`w-full relative flex-row items-center overflow-hidden my-0.5 ${isMe ? "justify-end" : "justify-start"}`}>
        <View className={`max-w-[84%] flex-col ${isMe ? "items-end" : "items-start"}`}>
          {children}
        </View>
      </View>
    );
  }

  return (
    <View className={`w-full relative flex-row items-center overflow-hidden my-0.5 ${isMe ? "justify-end" : "justify-start"}`}>
      {/* Ícone revelado à ESQUERDA (quando eu puxo minha mensagem para a direita) */}
      {isMe && (
        <Animated.View
          style={{
            position: "absolute",
            left: 10,
            opacity: iconScale,
            transform: [{ scale: iconScale }]
          }}
          className="h-8 w-8 rounded-full bg-indigo-600/30 border border-indigo-500/50 items-center justify-center pointer-events-none"
        >
          <CornerDownLeft size={16} color="#818cf8" strokeWidth={2.5} />
        </Animated.View>
      )}

      {/* Ícone revelado à DIREITA (quando eu puxo a mensagem dele para a esquerda) */}
      {!isMe && (
        <Animated.View
          style={{
            position: "absolute",
            right: 10,
            opacity: iconScale,
            transform: [{ scale: iconScale }]
          }}
          className="h-8 w-8 rounded-full bg-indigo-600/30 border border-indigo-500/50 items-center justify-center pointer-events-none"
        >
          <CornerDownRight size={16} color="#818cf8" strokeWidth={2.5} />
        </Animated.View>
      )}

      {/* Bolha da Mensagem com Animação Pan */}
      <Animated.View
        {...panResponder.panHandlers}
        style={{ transform: [{ translateX: pan }] }}
        className={`max-w-[84%] flex-col ${isMe ? "items-end" : "items-start"}`}
      >
        {children}
      </Animated.View>
    </View>
  );
}

interface ChatModalProps {
  visible: boolean;
  onClose: () => void;
}

function ChatModalComponent({ visible, onClose }: ChatModalProps) {
  const { 
    mensagens, 
    mensagensMural, 
    mensagensMuralRoots,
    getThreadMessages,
    getThreadInfo,
    avisoFixadoMural,
    contatos, 
    presencas,
    myUserId, 
    myUsername, 
    myPhotoUrl,
    operatorName,
    operatorCargo,
    operatorRecado,
    operatorStatusPreset,
    isAdmin,
    hiddenLocalIds,
    enviarMensagem, 
    apagarMensagem,
    apagarParaMim,
    excluirMensagemPermanente,
    editarMensagem,
    desafixarAviso,
    alternarFixarMensagem,
    alternarAdminUsuario,
    marcarConversaComoLida,
    alternarReacao,
    adicionarContatoPorTag,
    removerContato,
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
    reiniciarJogo
  } = useChat();

  const [modalJogosVisible, setModalJogosVisible] = useState(false);
  const [termoCustomVisible, setTermoCustomVisible] = useState(false);
  const [customPalavraInput, setCustomPalavraInput] = useState("");
  const [customDicaInput, setCustomDicaInput] = useState("");

  const [forcaCustomVisible, setForcaCustomVisible] = useState(false);
  const [forcaPalavraInput, setForcaPalavraInput] = useState("");
  const [forcaTemaInput, setForcaTemaInput] = useState("");
  const [forcaDicaInput, setForcaDicaInput] = useState("");

  // Abas e Navegação
  const [activeTab, setActiveTab] = useState<"direto" | "mural">("direto");
  const [activeContact, setActiveContact] = useState<ChatContact | null>(null);

  // Subchats / Threads do Discord no Mural
  const [activeThreadRootId, setActiveThreadRootId] = useState<string | null>(null);
  const activeThreadRoot = useMemo(() => {
    return activeThreadRootId ? mensagens.find(m => m.id === activeThreadRootId) || null : null;
  }, [activeThreadRootId, mensagens]);
  const setActiveThreadRoot = (m: MensagemChat | null) => setActiveThreadRootId(m ? m.id : null);
  const [textoThread, setTextoThread] = useState("");

  // Estados de Input
  const [textoMensagem, setTextoMensagem] = useState("");
  const [textoMural, setTextoMural] = useState("");
  const [fixarNoMural, setFixarNoMural] = useState(false);
  const [replyingToMural, setReplyingToMural] = useState<MensagemChat | null>(null);
  const [reactionPickerMsgId, setReactionPickerMsgId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  // Fila de Anexos Pendentes com Mini Prévia e X (Estilo Discord / WhatsApp)
  type AnexoPendente = { id: string; uri: string; base64?: string };
  const [anexosDireto, setAnexosDireto] = useState<AnexoPendente[]>([]);
  const [anexosMural, setAnexosMural] = useState<AnexoPendente[]>([]);
  const [anexosThread, setAnexosThread] = useState<AnexoPendente[]>([]);

  const [activeUploads, setActiveUploads] = useState<{
    id: string;
    uri: string;
    progress: number;
    phase: string;
    dest: "direto" | "mural";
  }[]>([]);

  // Reações e Gestos Interativos
  const [heartPopMsgId, setHeartPopMsgId] = useState<string | null>(null);
  const lastTapTimes = useRef<Record<string, number>>({});
  const adminTapTimes = useRef<{ id: string; count: number; lastTime: number }>({ id: "", count: 0, lastTime: 0 });

  // Modais de Auditoria e Detalhes
  const [whoReactedModal, setWhoReactedModal] = useState<{
    visible: boolean;
    emoji: string;
    msg: MensagemChat | null;
  }>({ visible: false, emoji: "❤️", msg: null });

  const [adminSeenByModal, setAdminSeenByModal] = useState<{
    visible: boolean;
    msg: MensagemChat | null;
  }>({ visible: false, msg: null });

  // Modais Auxiliares
  const [modalAddVisible, setModalAddVisible] = useState(false);
  const [inputTagBusca, setInputTagBusca] = useState("");
  const [searchedUser, setSearchedUser] = useState<ChatContact | null>(null);
  const [isSearchingUser, setIsSearchingUser] = useState(false);

  const { settings } = useAppSettings();

  const [modalEditProfileVisible, setModalEditProfileVisible] = useState(false);
  const [viewingUserProfile, setViewingUserProfile] = useState<ChatContact | null>(null);

  const [modalQrVisible, setModalQrVisible] = useState(false);
  const [modalPinVisible, setModalPinVisible] = useState(false);
  const [pinValue, setPinValue] = useState("");
  const pinInputRef = useRef<TextInput>(null);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [fullscreenImagesList, setFullscreenImagesList] = useState<string[]>([]);
  const [fullscreenInitialIndex, setFullscreenInitialIndex] = useState(0);
  const [fullscreenMeta, setFullscreenMeta] = useState<PhotoViewerMeta | null>(null);

  const handleAbrirFoto = (uri: string, meta?: PhotoViewerMeta, allPhotos?: string[], initialIdx?: number) => {
    setFullscreenImage(uri);
    setFullscreenImagesList(allPhotos && allPhotos.length > 0 ? allPhotos : [uri]);
    setFullscreenInitialIndex(initialIdx || 0);
    setFullscreenMeta(meta || null);
  };
  
  // Modo Secreto e Mensagens Apagadas
  const [secretMode, setSecretMode] = useState(false);
  const [editingMsg, setEditingMsg] = useState<{ id: string; texto: string; isMural?: boolean } | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<MensagemChat | null>(null);
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(new Set());
  const [replyingToDirect, setReplyingToDirect] = useState<MensagemChat | null>(null);
  const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null);
  const directInputRef = useRef<TextInput>(null);
  const muralFlatListRef = useRef<FlatList>(null);

  const copiarTextoParaClipboard = async (texto: string, label: string = "Texto copiado!") => {
    try {
      if (Platform.OS === "web") {
        await navigator.clipboard.writeText(texto);
      } else {
        Clipboard.setString(texto);
      }
      if (Platform.OS !== "web") {
        try {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {}
      }
      setToast({ type: "success", title: "Copiado", message: label });
    } catch {
      setToast({ type: "info", title: "Copiado", message: label });
    }
  };

  const copiarMinhaTag = () => {
    copiarTextoParaClipboard(`@${myUsername}`, "Sua tag @username foi copiada!");
  };

  const scrollToMessage = (targetMsgId: string) => {
    const index = mensagensInvertidas.findIndex(m => m.id === targetMsgId);
    if (index !== -1) {
      flatListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
      setHighlightedMsgId(targetMsgId);
      if (Platform.OS !== "web") {
        try {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } catch {}
      }
      setTimeout(() => setHighlightedMsgId(null), 1400);
    }
  };

  const [modalDelete, setModalDelete] = useState<{
    visible: boolean;
    step: 1 | 2;
    isPermanent: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    visible: false,
    step: 1,
    isPermanent: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  const [toast, setToast] = useState<ToastConfig | null>(null);

  const solicitarExclusao = (title: string, message: string, onConfirm: () => void) => {
    setModalDelete({
      visible: true,
      step: 1,
      isPermanent: false,
      title,
      message,
      onConfirm,
    });
  };

  const solicitarPurgaPermanenteAdmin = (msgId: string) => {
    setModalDelete({
      visible: true,
      step: 1,
      isPermanent: true,
      title: "Purga Permanente do Banco",
      message: "Esta ação apagará fisicamente o documento desta mensagem do banco de dados para todos os usuários.",
      onConfirm: () => excluirMensagemPermanente(msgId),
    });
  };

  // Gesto Secreto de 5 Toques no Avatar -> EXCLUSIVO PARA PIN ADMIN
  const avatarTapCount = useRef(0);
  const avatarTapTimer = useRef<NodeJS.Timeout | null>(null);

  const flatListRef = useRef<FlatList>(null);
  const insets = useSafeAreaInsets();
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const handleKeyboardShow = (e: any) => {
      const h = e?.endCoordinates?.height;
      if (typeof h === "number" && h > 0) {
        setKeyboardHeight(h);
      }
    };

    const handleKeyboardHide = () => {
      setKeyboardHeight(0);
    };

    const showSub1 = Keyboard.addListener("keyboardDidShow", handleKeyboardShow);
    const showSub2 = Keyboard.addListener("keyboardWillShow", handleKeyboardShow);
    const hideSub1 = Keyboard.addListener("keyboardDidHide", handleKeyboardHide);
    const hideSub2 = Keyboard.addListener("keyboardWillHide", handleKeyboardHide);

    return () => {
      showSub1.remove();
      showSub2.remove();
      hideSub1.remove();
      hideSub2.remove();
    };
  }, []);

  // Contato Ativo com Presença e Status Atualizados em Tempo Real
  const currentActiveContact = useMemo(() => {
    if (!activeContact) return null;
    const live = contatos.find(c => c.id === activeContact.id || (c.username && activeContact.username && c.username.toLowerCase() === activeContact.username.toLowerCase()));
    return live ? { ...activeContact, ...live } : activeContact;
  }, [activeContact, contatos]);

  // Filtrar conversas da aba ativa (Casamento bidirecional por UID e @username)
  const mensagensConversaAtiva = useMemo(() => {
    if (!activeContact) return [];
    return mensagens.filter(m => 
      isMessageInDirectChat(m, myUserId, myUsername, activeContact) &&
      (secretMode || !hiddenLocalIds[m.id])
    );
  }, [mensagens, activeContact, myUserId, myUsername, secretMode, hiddenLocalIds]);

  // Lista invertida nativa para FlatList inverted={true} (padrão WhatsApp/Telegram)
  // O índice 0 é a mensagem mais recente na base da tela, iniciando em 0ms sem necessidade de scrollToEnd
  const mensagensInvertidas = useMemo(() => {
    return [...mensagensConversaAtiva].reverse();
  }, [mensagensConversaAtiva]);

  // Lista do Mural Invertida Nativa (Virtualizada com FlatList inverted={true}, 0ms para abrir)
  const mensagensMuralFiltradas = useMemo(() => {
    return mensagensMural.filter(
      m => !m.isPinned && (!avisoFixadoMural || m.id !== avisoFixadoMural.id) && (secretMode || !hiddenLocalIds[m.id])
    );
  }, [mensagensMural, avisoFixadoMural, secretMode, hiddenLocalIds]);

  const mensagensMuralInvertidas = useMemo(() => {
    return [...mensagensMuralFiltradas].reverse();
  }, [mensagensMuralFiltradas]);

  // Limpar seleção múltipla ao trocar de aba, contato ou fechar o modal
  useEffect(() => {
    setSelectedMessageIds(new Set());
  }, [activeContact?.id, activeTab, visible]);

  // Marcar mensagens recebidas como lidas imediatamente ao entrar na conversa (somente se houver não-lidas)
  useEffect(() => {
    if (activeContact?.id && myUserId) {
      const hasUnread = mensagensConversaAtiva.some(
        m => m.remetenteId !== myUserId && (!m.lidasPor || !m.lidasPor.includes(myUserId))
      );
      if (hasUnread) {
        void marcarConversaComoLida(activeContact.id, activeContact.username);
      }
    }
  }, [activeContact?.id, mensagensConversaAtiva, myUserId]);

  const contatosFiltrados = useMemo(() => {
    const myUser = myUsername.toLowerCase().replace(/^@/, "").trim();
    const myCurId = (myUserId || "").toLowerCase().trim();
    const query = searchQuery.toLowerCase();

    return contatos.filter(c => {
      const cUser = (c.username || "").toLowerCase().replace(/^@/, "").trim();
      const cId = (c.id || "").toLowerCase().trim();

      if (cUser === myUser || cId === myUser || (myCurId && cId === myCurId)) {
        return false;
      }

      return (
        c.displayName.toLowerCase().includes(query) ||
        c.username.toLowerCase().includes(query)
      );
    });
  }, [contatos, myUsername, myUserId, searchQuery]);

  const liveContact = useMemo(() => {
    if (!activeContact) return null;
    return contatos.find(c => 
      c.id === activeContact.id || 
      (activeContact.username && c.username?.toLowerCase().replace(/^@/, "") === activeContact.username.toLowerCase().replace(/^@/, ""))
    ) || activeContact;
  }, [activeContact, contatos]);

  // Gesto Secreto de 5 Toques no Avatar -> EXCLUSIVO PARA PIN ADMIN
  const handleAvatarTap = () => {
    avatarTapCount.current += 1;
    if (avatarTapTimer.current) clearTimeout(avatarTapTimer.current);
    avatarTapTimer.current = setTimeout(() => { avatarTapCount.current = 0; }, 2000);

    if (avatarTapCount.current >= 5) {
      avatarTapCount.current = 0;
      setPinValue("");
      setModalPinVisible(true);
      setTimeout(() => pinInputRef.current?.focus(), 200);
    }
  };

  // Gesto Secreto de 4 Toques no Botão de Enviar -> ATIVA / DESATIVA MODO SECRETO
  const sendTapCount = useRef(0);
  const sendTapTimer = useRef<NodeJS.Timeout | null>(null);
  // Gesto Secreto de 4 Toques no Botão de Enviar -> ATIVA / DESATIVA MODO SECRETO (EXCLUSIVO ADMIN)
  const handleSecretSendTap = () => {
    sendTapCount.current += 1;
    if (sendTapTimer.current) clearTimeout(sendTapTimer.current);
    sendTapTimer.current = setTimeout(() => { sendTapCount.current = 0; }, 1500);

    if (sendTapCount.current >= 4) {
      sendTapCount.current = 0;
      if (!isAdmin) {
        setToast({
          type: "warning",
          title: "Acesso Restrito",
          message: "O Modo Secreto e a Purga de dados exigem autoridade de Administrador."
        });
        return;
      }
      setSecretMode(prev => {
        const next = !prev;
        setToast({
          type: next ? "warning" : "info",
          title: next ? "Modo Secreto Ativado 👁️" : "Modo Secreto Desativado",
          message: next ? "Visualização de mensagens apagadas e Purga Física liberadas." : "Modo de visualização padrão restaurado."
        });
        return next;
      });
    }
  };

  // Badges de Cargos dos Operadores com Ícones Lucide
  const renderCargoBadge = (cargo?: string, isAdminUser?: boolean) => {
    const c = (cargo || "").toLowerCase().trim();
    if (c === "dev" || c === "desenvolvedor" || c === "developer" || c.includes("dev")) {
      return (
        <View className="flex-row items-center gap-1 rounded px-1.5 py-0.2 border bg-cyan-500/20 border-cyan-400/50">
          <Terminal size={8.5} color="#38bdf8" />
          <Text className="text-[8px] font-black uppercase tracking-wider text-cyan-300">DEV</Text>
        </View>
      );
    }

    const isActuallyAdmin = Boolean(isAdminUser || c === "admin");
    if (isActuallyAdmin) {
      return (
        <View className="flex-row items-center gap-1 rounded px-1.5 py-0.2 border bg-amber-500/15 border-amber-500/35">
          <Crown size={8.5} color="#f59e0b" />
          <Text className="text-[8px] font-black uppercase tracking-wider text-amber-300">ADMIN</Text>
        </View>
      );
    }

    if (c === "gerente") {
      return (
        <View className="flex-row items-center gap-1 rounded px-1.5 py-0.2 border bg-sky-500/15 border-sky-500/35">
          <Briefcase size={8.5} color="#38bdf8" />
          <Text className="text-[8px] font-black uppercase tracking-wider text-sky-300">GERENTE</Text>
        </View>
      );
    }
    if (c === "vendedor") {
      return (
        <View className="flex-row items-center gap-1 rounded px-1.5 py-0.2 border bg-emerald-500/15 border-emerald-500/35">
          <Tag size={8.5} color="#34d399" />
          <Text className="text-[8px] font-black uppercase tracking-wider text-emerald-300">VENDEDOR</Text>
        </View>
      );
    }
    if (c === "entregador") {
      return (
        <View className="flex-row items-center gap-1 rounded px-1.5 py-0.2 border bg-orange-500/15 border-orange-500/35">
          <Bike size={8.5} color="#fb923c" />
          <Text className="text-[8px] font-black uppercase tracking-wider text-orange-300">ENTREGADOR</Text>
        </View>
      );
    }

    return (
      <View className="flex-row items-center gap-1 rounded px-1.5 py-0.2 border bg-purple-500/15 border-purple-500/35">
        <UserCheck size={8.5} color="#c084fc" />
        <Text className="text-[8px] font-black uppercase tracking-wider text-purple-300">ATENDENTE</Text>
      </View>
    );
  };

  // Badges de Status Operacional dos Operadores
  const renderStatusPresetBadge = (statusPreset?: string) => {
    const s = (statusPreset || "disponivel").toLowerCase();
    if (s === "fechamento") {
      return (
        <View className="flex-row items-center gap-1 rounded px-1.5 py-0.2 border bg-amber-500/15 border-amber-500/35">
          <Lock size={8.5} color="#fbbf24" />
          <Text className="text-[8px] font-black uppercase tracking-wider text-amber-300">FECHANDO</Text>
        </View>
      );
    }
    if (s === "pausa") {
      return (
        <View className="flex-row items-center gap-1 rounded px-1.5 py-0.2 border bg-sky-500/15 border-sky-500/35">
          <Coffee size={8.5} color="#38bdf8" />
          <Text className="text-[8px] font-black uppercase tracking-wider text-sky-300">EM PAUSA</Text>
        </View>
      );
    }
    if (s === "foco") {
      return (
        <View className="flex-row items-center gap-1 rounded px-1.5 py-0.2 border bg-purple-500/15 border-purple-500/35">
          <Sparkles size={8.5} color="#c084fc" />
          <Text className="text-[8px] font-black uppercase tracking-wider text-purple-300">FOCO TOTAL</Text>
        </View>
      );
    }
    return (
      <View className="flex-row items-center gap-1 rounded px-1.5 py-0.2 border bg-emerald-500/15 border-emerald-500/35">
        <Zap size={8.5} color="#34d399" />
        <Text className="text-[8px] font-black uppercase tracking-wider text-emerald-300">DISPONÍVEL</Text>
      </View>
    );
  };



  // Helper para Resolver Nome e Username de Operador (sem exibir IDs brutos)
  const getOperatorDisplay = (
    uid: string, 
    fallbackUsername?: string, 
    fallbackName?: string, 
    fallbackCargo?: string
  ) => {
    if (!uid && !fallbackUsername) {
      return { displayName: "Atendente", username: "atendente", initials: "AT", cargo: "atendente", isAdmin: false };
    }

    const cleanUid = (uid || "").toLowerCase().replace(/^@/, "").trim();
    const cleanUname = (fallbackUsername || "").toLowerCase().replace(/^@/, "").trim();
    const isCurrentMe = cleanUid === myUserId.toLowerCase() || 
      (myUsername && (cleanUid === myUsername.toLowerCase() || cleanUname === myUsername.toLowerCase()));

    if (isCurrentMe) {
      const isMyRoleAdmin = Boolean(isAdmin);
      const isOfficialDevMe = myUserId === DEV_UID || (myUsername?.toLowerCase() === "dev" && myUserId === DEV_UID);
      const isMyDev = isOfficialDevMe && (operatorCargo?.toLowerCase() === "dev" || operatorCargo?.toLowerCase() === "desenvolvedor" || myUsername?.toLowerCase() === "dev");
      const myRole = isMyDev ? "dev" : (isMyRoleAdmin ? "admin" : (operatorCargo && operatorCargo !== "admin" && operatorCargo !== "dev" ? operatorCargo : "atendente"));
      return { 
        displayName: `${operatorName} (Você)`, 
        username: myUsername, 
        initials: (operatorName || "AT").substring(0, 2).toUpperCase(),
        cargo: myRole,
        isAdmin: isMyRoleAdmin,
        photoUrl: myPhotoUrl || null,
        recado: operatorRecado || null,
        statusPreset: operatorStatusPreset || "disponivel"
      };
    }

    const matchPresenca = presencas.find(p => {
      const pId = (p.id || "").toLowerCase().replace(/^@/, "").trim();
      const pU = (p.username || "").toLowerCase().replace(/^@/, "").trim();
      return (
        pId === cleanUid || 
        (cleanUname && pU === cleanUname) || 
        (cleanUid && pU === cleanUid) ||
        (cleanUname && pId === cleanUname)
      );
    });

    const matchContato = contatos.find(c => {
      const cId = (c.id || "").toLowerCase().replace(/^@/, "").trim();
      const cU = (c.username || "").toLowerCase().replace(/^@/, "").trim();
      return (
        cId === cleanUid || 
        (cleanUname && cU === cleanUname) || 
        (cleanUid && cU === cleanUid) ||
        (cleanUname && cId === cleanUname)
      );
    });

    let isTargetAdmin = false;
    let resolvedCargo = "atendente";
    let resName = "Atendente";
    let resUser = cleanUname || uid;
    let resPhotoUrl: string | null = null;
    let resRecado: string | null = null;
    let resStatusPreset: string | null = null;

    if (matchPresenca) {
      isTargetAdmin = Boolean(matchPresenca.isAdmin);
      const isOfficialDevP = matchPresenca.id === DEV_UID || ((matchPresenca.username || "").toLowerCase() === "dev" && matchPresenca.id === DEV_UID);
      const cP = (matchPresenca.cargo || "").toLowerCase().trim();
      const isDevP = isOfficialDevP && (cP === "dev" || cP === "desenvolvedor" || (matchPresenca.username || "").toLowerCase() === "dev");
      resolvedCargo = isDevP ? "dev" : (isTargetAdmin ? "admin" : (matchPresenca.cargo && matchPresenca.cargo !== "admin" && matchPresenca.cargo !== "dev" ? matchPresenca.cargo : "atendente"));
      resName = matchPresenca.displayName || matchContato?.displayName || fallbackName || cleanUname || "Atendente";
      resUser = matchPresenca.username || matchContato?.username || cleanUname || uid;
      resPhotoUrl = matchPresenca.photoUrl || matchContato?.photoUrl || null;
      resRecado = matchPresenca.recado || matchContato?.recado || null;
      resStatusPreset = matchPresenca.statusPreset || matchContato?.statusPreset || null;
    } else if (matchContato) {
      isTargetAdmin = Boolean(matchContato.isAdmin);
      const isOfficialDevC = matchContato.id === DEV_UID || ((matchContato.username || "").toLowerCase() === "dev" && matchContato.id === DEV_UID);
      const cC = (matchContato.cargo || "").toLowerCase().trim();
      const isDevC = isOfficialDevC && (cC === "dev" || cC === "desenvolvedor" || (matchContato.username || "").toLowerCase() === "dev");
      resolvedCargo = isDevC ? "dev" : (isTargetAdmin ? "admin" : (matchContato.cargo && matchContato.cargo !== "admin" && matchContato.cargo !== "dev" ? matchContato.cargo : "atendente"));
      resName = matchContato.displayName || fallbackName || cleanUname || "Atendente";
      resUser = matchContato.username || cleanUname || uid;
      resPhotoUrl = matchContato.photoUrl || null;
      resRecado = matchContato.recado || null;
      resStatusPreset = matchContato.statusPreset || null;
    } else {
      isTargetAdmin = Boolean(fallbackCargo?.toLowerCase() === "admin");
      const isOfficialDevF = (cleanUid === DEV_UID.toLowerCase()) || (cleanUname === "dev" && cleanUid === DEV_UID.toLowerCase());
      const cF = (fallbackCargo || "").toLowerCase().trim();
      const isDevF = isOfficialDevF && (cF === "dev" || cF === "desenvolvedor" || cleanUname === "dev");
      resolvedCargo = isDevF ? "dev" : (isTargetAdmin ? "admin" : (fallbackCargo && fallbackCargo !== "dev" ? fallbackCargo : "atendente"));
      resName = fallbackName || cleanUname || "Atendente";
      resUser = cleanUname || uid;
    }

    return {
      displayName: resName,
      username: resUser,
      initials: (resName || "AT").substring(0, 2).toUpperCase(),
      cargo: resolvedCargo,
      isAdmin: isTargetAdmin,
      photoUrl: resPhotoUrl,
      recado: resRecado,
      statusPreset: resStatusPreset
    };
  };

  // Helper para Parsear Coleção de Múltiplas Imagens (JSON Array ou URL única)
  const parseImagensColecao = (imgData?: string): string[] => {
    if (!imgData) return [];
    const trimmed = imgData.trim();
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed.filter(Boolean);
      } catch {}
    }
    return [imgData];
  };

  // Renderizador de Coleção / Grade de Fotos Estilo Post de Rede Social / WhatsApp
  const renderImageCollage = (
    imgData: string,
    meta: { senderName?: string; senderUsername?: string; timestamp?: number; caption?: string },
    isMural: boolean = false
  ) => {
    const fotos = parseImagensColecao(imgData);
    if (fotos.length === 0) return null;

    // Caso 1: Apenas 1 Foto (Nunca espremida, proporção perfeita)
    if (fotos.length === 1) {
      if (isMural) {
        return (
          <Pressable 
            onPress={() => handleAbrirFoto(fotos[0], meta, fotos, 0)}
            className="w-full mb-2.5 rounded-2xl overflow-hidden border border-zinc-700/60 bg-[#12121c] active:opacity-95 shadow-lg"
          >
            <Image 
              source={{ uri: formatGoogleDriveThumbnailUrl(fotos[0]) }}
              style={{ width: "100%", height: 240, borderRadius: 16 }}
              resizeMode="cover"
            />
            <View className="absolute bottom-2.5 right-2.5 px-2.5 py-1 rounded-md bg-black/80 flex-row items-center gap-1.5 border border-white/10 shadow-md">
              <Maximize2 size={11} color="#ffffff" />
              <Text className="text-[10.5px] font-mono text-white font-bold">Ver Foto</Text>
            </View>
          </Pressable>
        );
      }

      // No Chat Direto (PV): largura fixa de 240px para manter o balão firme e bonito
      return (
        <Pressable 
          onPress={() => handleAbrirFoto(fotos[0], meta, fotos, 0)}
          className="rounded-2xl overflow-hidden mb-1.5 border border-zinc-700/60 bg-[#12121c] active:opacity-95 shadow-md"
          style={{ width: 240, height: 185 }}
        >
          <Image 
            source={{ uri: formatGoogleDriveThumbnailUrl(fotos[0]) }}
            style={{ width: 240, height: 185, borderRadius: 16 }}
            resizeMode="cover"
          />
          <View className="absolute bottom-2 right-2 px-2.5 py-1 rounded-md bg-black/80 flex-row items-center gap-1.5 border border-white/10 shadow-sm">
            <Maximize2 size={11} color="#ffffff" />
            <Text className="text-[10px] font-mono text-white font-bold">Ver Foto</Text>
          </View>
        </Pressable>
      );
    }

    // Caso 2: 2 Fotos Lado a Lado (50% / 50%)
    if (fotos.length === 2) {
      if (isMural) {
        return (
          <View className="flex-row gap-1.5 w-full mb-2.5">
            {fotos.map((url, idx) => (
              <Pressable 
                key={idx}
                onPress={() => handleAbrirFoto(url, meta, fotos, idx)}
                className="flex-1 rounded-2xl overflow-hidden border border-zinc-700/50 bg-[#12121c] active:opacity-90 shadow-md"
              >
                <Image 
                  source={{ uri: formatGoogleDriveThumbnailUrl(url) }}
                  style={{ width: "100%", height: 160 }}
                  resizeMode="cover"
                />
              </Pressable>
            ))}
          </View>
        );
      }

      return (
        <View className="flex-row gap-1.5 mb-1.5" style={{ width: 240 }}>
          {fotos.map((url, idx) => (
            <Pressable 
              key={idx}
              onPress={() => handleAbrirFoto(url, meta, fotos, idx)}
              className="flex-1 rounded-xl overflow-hidden border border-zinc-700/50 bg-[#12121c] active:opacity-90"
            >
              <Image 
                source={{ uri: formatGoogleDriveThumbnailUrl(url) }}
                style={{ width: "100%", height: 135 }}
                resizeMode="cover"
              />
            </Pressable>
          ))}
        </View>
      );
    }

    // Caso 3: 3 Fotos (1 Grande + 2 Empilhadas)
    if (fotos.length === 3) {
      if (isMural) {
        return (
          <View className="flex-row gap-1.5 w-full mb-2.5">
            <Pressable 
              onPress={() => handleAbrirFoto(fotos[0], meta, fotos, 0)}
              className="flex-1 rounded-2xl overflow-hidden border border-zinc-700/50 bg-[#12121c] active:opacity-90 shadow-md"
            >
              <Image 
                source={{ uri: formatGoogleDriveThumbnailUrl(fotos[0]) }}
                style={{ width: "100%", height: 200 }}
                resizeMode="cover"
              />
            </Pressable>
            <View className="flex-1 gap-1.5">
              {fotos.slice(1, 3).map((url, idx) => (
                <Pressable 
                  key={idx}
                  onPress={() => handleAbrirFoto(url, meta, fotos, idx + 1)}
                  className="flex-1 rounded-2xl overflow-hidden border border-zinc-700/50 bg-[#12121c] active:opacity-90 shadow-md"
                >
                  <Image 
                    source={{ uri: formatGoogleDriveThumbnailUrl(url) }}
                    style={{ width: "100%", height: 96 }}
                    resizeMode="cover"
                  />
                </Pressable>
              ))}
            </View>
          </View>
        );
      }

      return (
        <View className="flex-row gap-1.5 mb-1.5" style={{ width: 240 }}>
          <Pressable 
            onPress={() => handleAbrirFoto(fotos[0], meta, fotos, 0)}
            className="flex-1 rounded-xl overflow-hidden border border-zinc-700/50 bg-[#12121c] active:opacity-90"
          >
            <Image 
              source={{ uri: formatGoogleDriveThumbnailUrl(fotos[0]) }}
              style={{ width: "100%", height: 175 }}
              resizeMode="cover"
            />
          </Pressable>
          <View className="flex-1 gap-1.5">
            {fotos.slice(1, 3).map((url, idx) => (
              <Pressable 
                key={idx}
                onPress={() => handleAbrirFoto(url, meta, fotos, idx + 1)}
                className="flex-1 rounded-xl overflow-hidden border border-zinc-700/50 bg-[#12121c] active:opacity-90"
              >
                <Image 
                  source={{ uri: formatGoogleDriveThumbnailUrl(url) }}
                  style={{ width: "100%", height: 84 }}
                  resizeMode="cover"
                />
              </Pressable>
            ))}
          </View>
        </View>
      );
    }

    // Caso 4: 4 ou Mais Fotos (Grade 2x2 com Overlay +N)
    const primeiras4 = fotos.slice(0, 4);
    const restantes = fotos.length - 4;

    if (isMural) {
      return (
        <View className="flex-col gap-1.5 w-full mb-2.5">
          {/* Linha 1 */}
          <View className="flex-row gap-1.5">
            {primeiras4.slice(0, 2).map((url, idx) => (
              <Pressable 
                key={idx}
                onPress={() => handleAbrirFoto(url, meta, fotos, idx)}
                className="flex-1 rounded-2xl overflow-hidden border border-zinc-700/50 bg-[#12121c] active:opacity-90 shadow-md"
              >
                <Image 
                  source={{ uri: formatGoogleDriveThumbnailUrl(url) }}
                  style={{ width: "100%", height: 130 }}
                  resizeMode="cover"
                />
              </Pressable>
            ))}
          </View>

          {/* Linha 2 */}
          <View className="flex-row gap-1.5">
            {primeiras4.slice(2, 4).map((url, idx) => {
              const isUltima = idx === 1;
              const temMais = isUltima && restantes > 0;

              return (
                <Pressable 
                  key={idx}
                  onPress={() => handleAbrirFoto(url, meta, fotos, idx + 2)}
                  className="flex-1 rounded-2xl overflow-hidden border border-zinc-700/50 bg-[#12121c] relative active:opacity-90 shadow-md"
                >
                  <Image 
                    source={{ uri: formatGoogleDriveThumbnailUrl(url) }}
                    style={{ width: "100%", height: 130 }}
                    resizeMode="cover"
                  />
                  {temMais && (
                    <View className="absolute inset-0 bg-black/80 items-center justify-center">
                      <Text className="text-white font-black text-xl font-mono">+{restantes + 1}</Text>
                      <Text className="text-zinc-300 text-[10px] font-bold uppercase tracking-wider">Fotos</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>
      );
    }

    return (
      <View className="flex-col gap-1.5 mb-1.5" style={{ width: 240 }}>
        {/* Linha 1 */}
        <View className="flex-row gap-1.5">
          {primeiras4.slice(0, 2).map((url, idx) => (
            <Pressable 
              key={idx}
              onPress={() => handleAbrirFoto(url, meta, fotos, idx)}
              className="flex-1 rounded-xl overflow-hidden border border-zinc-700/50 bg-[#12121c] active:opacity-90"
            >
              <Image 
                source={{ uri: formatGoogleDriveThumbnailUrl(url) }}
                style={{ width: "100%", height: 110 }}
                resizeMode="cover"
              />
            </Pressable>
          ))}
        </View>

        {/* Linha 2 */}
        <View className="flex-row gap-1.5">
          {primeiras4.slice(2, 4).map((url, idx) => {
            const isUltima = idx === 1;
            const temMais = isUltima && restantes > 0;

            return (
              <Pressable 
                key={idx}
                onPress={() => handleAbrirFoto(url, meta, fotos, idx + 2)}
                className="flex-1 rounded-xl overflow-hidden border border-zinc-700/50 bg-[#12121c] relative active:opacity-90"
              >
                <Image 
                  source={{ uri: formatGoogleDriveThumbnailUrl(url) }}
                  style={{ width: "100%", height: 110 }}
                  resizeMode="cover"
                />
                {temMais && (
                  <View className="absolute inset-0 bg-black/80 items-center justify-center">
                    <Text className="text-white font-black text-lg font-mono">+{restantes + 1}</Text>
                    <Text className="text-zinc-300 text-[9px] font-bold uppercase tracking-wider">Fotos</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  };

  // Gesto Secreto de 5 Toques em Mensagem (Auditoria Admin: Quem Visualizou)
  const handleSecretAdminTap = (msg: MensagemChat) => {
    if (!isAdmin) return;
    const now = Date.now();
    if (adminTapTimes.current.id === msg.id && now - adminTapTimes.current.lastTime < 1200) {
      adminTapTimes.current.count += 1;
    } else {
      adminTapTimes.current = { id: msg.id, count: 1, lastTime: now };
    }
    adminTapTimes.current.lastTime = now;

    if (adminTapTimes.current.count >= 5) {
      adminTapTimes.current = { id: "", count: 0, lastTime: 0 };
      lastTapTimes.current[msg.id] = 0; // Limpa para não dar duplo toque
      setAdminSeenByModal({ visible: true, msg });
    }
  };

  // Long press para abrir Menu Contextual (Ações & Emojis)
  const handleLongPressMessage = (msg: MensagemChat) => {
    const now = Date.now();
    const lastTime = lastTapTimes.current[msg.id] || 0;
    if (now - lastTime < 300) {
      return;
    }
    if ((Platform.OS as string) !== "web") {
      try {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {}
    }
    setSelectedMessage(msg);
  };

  // Duplo Toque Rápido (< 320ms) para Reagir com ❤️ (Heart Pop)
  const handleDoubleTapMessage = (msg: MensagemChat) => {
    // Se o usuário estiver fazendo a sequência de 5 toques de admin, não reage
    if (adminTapTimes.current.id === msg.id && adminTapTimes.current.count >= 3) {
      lastTapTimes.current[msg.id] = 0;
      return;
    }

    const now = Date.now();
    const lastTime = lastTapTimes.current[msg.id] || 0;
    const diff = now - lastTime;

    if (diff < 340 && diff > 40) {
      lastTapTimes.current[msg.id] = 0;
      setSelectedMessage(null);
      setHeartPopMsgId(msg.id);
      setTimeout(() => setHeartPopMsgId(null), 850);
      alternarReacao(msg.id, "❤️");
    } else {
      lastTapTimes.current[msg.id] = now;
    }
  };

  // Envio de Resposta dentro da Thread / Subchat Dedicado (com suporte a anexos em espera)
  const handleEnviarThreadReply = async () => {
    if (!activeThreadRoot) return;
    const txt = textoThread.trim();
    const temAnexos = anexosThread.length > 0;
    if (!txt && !temAnexos) return;

    const anexosParaEnviar = [...anexosThread];
    setAnexosThread([]);
    setTextoThread("");

    if (anexosParaEnviar.length > 0) {
      setIsUploadingPhoto(true);
      for (let i = 0; i < anexosParaEnviar.length; i++) {
        const anexo = anexosParaEnviar[i];
        const uploadId = `upl_th_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        setActiveUploads(prev => [
          ...prev,
          {
            id: uploadId,
            uri: anexo.uri,
            progress: 20,
            phase: "[1/3] AUTENTICANDO OAUTH...",
            dest: "mural",
          },
        ]);

        setTimeout(() => {
          setActiveUploads(prev =>
            prev.map(u => (u.id === uploadId ? { ...u, progress: 65, phase: "[2/3] ENVIANDO BYTES AO DRIVE..." } : u))
          );
        }, 350);

        const uploadRes = await uploadImagemParaServidor(anexo.uri, { operador: myUsername, tipo: "mural" });
        const finalUrl = uploadRes.url || (anexo.base64 ? `data:image/jpeg;base64,${anexo.base64}` : anexo.uri);

        setActiveUploads(prev =>
          prev.map(u => (u.id === uploadId ? { ...u, progress: 100, phase: "[3/3] SALVANDO NO DRIVE..." } : u))
        );

        const legenda = i === 0 ? txt : "";
        await enviarMensagem(
          legenda,
          undefined,
          finalUrl,
          false,
          {
            id: activeThreadRoot.id,
            texto: activeThreadRoot.texto || "Recado do Mural",
            remetenteNome: activeThreadRoot.remetenteNome,
            remetenteUsername: activeThreadRoot.remetenteUsername,
          },
          activeThreadRoot.id
        );

        setTimeout(() => {
          setActiveUploads(prev => prev.filter(u => u.id !== uploadId));
        }, 200);
      }
      setIsUploadingPhoto(false);
    } else {
      await enviarMensagem(
        txt,
        undefined,
        undefined,
        false,
        {
          id: activeThreadRoot.id,
          texto: activeThreadRoot.texto || "Recado do Mural",
          remetenteNome: activeThreadRoot.remetenteNome,
          remetenteUsername: activeThreadRoot.remetenteUsername,
        },
        activeThreadRoot.id
      );
    }
  };

  // Seleção de Fotos para Fila de Anexos na Thread
  const handlePickAnexoThread = async () => {
    if (!activeThreadRoot) return;
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setToast({ type: "warning", title: "Permissão Necessária", message: "Permita o acesso à galeria para anexar fotos." });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: 5,
        quality: 0.8,
        base64: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const novos: AnexoPendente[] = result.assets.map(a => ({
          id: `anx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          uri: a.uri,
          base64: a.base64 || undefined,
        }));
        setAnexosThread(prev => [...prev, ...novos]);
      }
    } catch (err) {
      setToast({ type: "error", title: "Erro", message: "Não foi possível selecionar fotos." });
    }
  };

  // Handlers para comandos rápidos como /jogos ou /games
  const handleTextoMensagemChange = (text: string) => {
    setTextoMensagem(text);
    const clean = text.trim().toLowerCase();
    if (clean === "/jogos" || clean === "/games" || clean === "/jogo" || clean === "/game") {
      setTextoMensagem("");
      Keyboard.dismiss();
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setModalJogosVisible(true);
    }
  };

  const handleTextoMuralChange = (text: string) => {
    setTextoMural(text);
    const clean = text.trim().toLowerCase();
    if (clean === "/jogos" || clean === "/games" || clean === "/jogo" || clean === "/game") {
      setTextoMural("");
      Keyboard.dismiss();
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setModalJogosVisible(true);
    }
  };

  // Envio de Mensagem de Texto e Anexos no Chat Direto
  const handleEnviarDireto = async () => {
    const txt = textoMensagem.trim();
    if (txt.toLowerCase() === "/jogos" || txt.toLowerCase() === "/games" || txt.toLowerCase() === "/jogo" || txt.toLowerCase() === "/game") {
      setTextoMensagem("");
      Keyboard.dismiss();
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setModalJogosVisible(true);
      return;
    }

    const temAnexos = anexosDireto.length > 0;
    if (!txt && !temAnexos) return;
    if (!activeContact) return;

    if (editingMsg && !editingMsg.isMural) {
      const id = editingMsg.id;
      setEditingMsg(null);
      setTextoMensagem("");
      await editarMensagem(id, txt);
      return;
    }

    const reply = replyingToDirect ? {
      id: replyingToDirect.id,
      texto: replyingToDirect.texto || "📷 Foto",
      remetenteNome: replyingToDirect.remetenteNome,
      remetenteUsername: replyingToDirect.remetenteUsername
    } : undefined;
    setReplyingToDirect(null);

    const anexosParaEnviar = [...anexosDireto];
    setAnexosDireto([]);
    setTextoMensagem("");

    if (anexosParaEnviar.length > 0) {
      setIsUploadingPhoto(true);
      const finalUrls: string[] = [];

      for (let i = 0; i < anexosParaEnviar.length; i++) {
        const anexo = anexosParaEnviar[i];
        const uploadId = `upl_dir_${Date.now()}_${i}`;
        
        setActiveUploads(prev => [
          ...prev,
          {
            id: uploadId,
            uri: anexo.uri,
            progress: 30,
            phase: `[${i + 1}/${anexosParaEnviar.length}] ENVIANDO BYTES...`,
            dest: "direto",
          },
        ]);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

        const uploadRes = await uploadImagemParaServidor(anexo.uri, { operador: myUsername, tipo: "direto" });
        const finalUrl = uploadRes.url || (anexo.base64 ? `data:image/jpeg;base64,${anexo.base64}` : anexo.uri);
        if (anexo.base64 && uploadRes.url) {
          void cacheDriveImage(uploadRes.url, anexo.base64);
        }

        finalUrls.push(finalUrl);
        setActiveUploads(prev => prev.filter(u => u.id !== uploadId));
      }

      setIsUploadingPhoto(false);
      const payloadUrl = finalUrls.length === 1 ? finalUrls[0] : JSON.stringify(finalUrls);
      await enviarMensagem(txt, activeContact.id, payloadUrl, false, reply, undefined, activeContact.username);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 150);
    } else {
      await enviarMensagem(txt, activeContact.id, undefined, false, reply, undefined, activeContact.username);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  // Seleção de Fotos para Fila de Anexos no Chat Direto (Estilo Discord)
  const handlePickAnexoDireto = async () => {
    if (!activeContact) return;
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setToast({ type: "warning", title: "Permissão Necessária", message: "Permita o acesso à galeria para anexar fotos." });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: 10,
        quality: 0.8,
        base64: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const novos: AnexoPendente[] = result.assets.map(a => ({
          id: `anx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          uri: a.uri,
          base64: a.base64 || undefined,
        }));
        setAnexosDireto(prev => [...prev, ...novos]);
      }
    } catch (err) {
      setToast({ type: "error", title: "Erro", message: "Não foi possível carregar as fotos." });
    }
  };

  // Envio de Recado no Mural Geral (com suporte a Resposta/Citação e Coleção de Fotos com Texto)
  const handleEnviarMural = async () => {
    const txt = textoMural.trim();
    const temAnexos = anexosMural.length > 0;
    if (!txt && !temAnexos) return;

    if (editingMsg && editingMsg.isMural) {
      const id = editingMsg.id;
      setEditingMsg(null);
      setTextoMural("");
      await editarMensagem(id, txt);
      return;
    }

    const isPinned = fixarNoMural && isAdmin;
    setFixarNoMural(false);
    
    const reply = replyingToMural ? {
      id: replyingToMural.id,
      texto: replyingToMural.texto || "Foto anexada",
      remetenteNome: replyingToMural.remetenteNome,
      remetenteUsername: replyingToMural.remetenteUsername,
    } : undefined;
    setReplyingToMural(null);

    const anexosParaEnviar = [...anexosMural];
    setAnexosMural([]);
    setTextoMural("");

    if (anexosParaEnviar.length > 0) {
      setIsUploadingPhoto(true);
      const finalUrls: string[] = [];

      for (let i = 0; i < anexosParaEnviar.length; i++) {
        const anexo = anexosParaEnviar[i];
        const uploadId = `upl_mur_${Date.now()}_${i}`;
        
        setActiveUploads(prev => [
          ...prev,
          {
            id: uploadId,
            uri: anexo.uri,
            progress: 30,
            phase: `[${i + 1}/${anexosParaEnviar.length}] ENVIANDO BYTES...`,
            dest: "mural"
          }
        ]);

        const uploadRes = await uploadImagemParaServidor(anexo.uri, { operador: myUsername, tipo: "mural" });
        const finalUrl = uploadRes.url || (anexo.base64 ? `data:image/jpeg;base64,${anexo.base64}` : anexo.uri);
        if (anexo.base64 && uploadRes.url) {
          void cacheDriveImage(uploadRes.url, anexo.base64);
        }
        
        finalUrls.push(finalUrl);
        setActiveUploads(prev => prev.filter(u => u.id !== uploadId));
      }

      setIsUploadingPhoto(false);
      const payloadUrl = finalUrls.length === 1 ? finalUrls[0] : JSON.stringify(finalUrls);
      await enviarMensagem(txt, undefined, payloadUrl, isPinned, reply, undefined);
    } else {
      await enviarMensagem(txt, undefined, undefined, isPinned, reply, undefined);
    }
  };

  // Seleção de Fotos para Fila de Anexos no Mural Geral (Estilo Discord)
  const handlePickAnexoMural = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setToast({ type: "warning", title: "Permissão Necessária", message: "Permita o acesso à galeria para anexar fotos." });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: 10,
        quality: 0.8,
        base64: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const novos: AnexoPendente[] = result.assets.map(a => ({
          id: `anx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          uri: a.uri,
          base64: a.base64 || undefined,
        }));
        setAnexosMural(prev => [...prev, ...novos]);
      }
    } catch (err) {
      setToast({ type: "error", title: "Erro", message: "Não foi possível selecionar fotos." });
    }
  };

  // Busca e Conexão de Contato por @username
  const handleBuscarTag = async () => {
    const tag = inputTagBusca.trim();
    if (!tag) return;
    setIsSearchingUser(true);
    const res = await adicionarContatoPorTag(tag);
    setIsSearchingUser(false);

    if (res.success && res.contact) {
      setSearchedUser(res.contact);
      setToast({ type: "success", title: "Contato Conectado", message: `@${res.contact.username} adicionado com sucesso!` });
      setModalAddVisible(false);
      setInputTagBusca("");
      setSearchedUser(null);
    } else {
      setToast({ type: "warning", title: "Usuário Não Encontrado", message: res.error || "Verifique o @username digitado." });
    }
  };



  // Validação do PIN Mestre de Administração
  const handleValidarPin = async (fullPin: string) => {
    const ok = await autenticarPinMestre(fullPin);
    if (ok) {
      setModalPinVisible(false);
      setPinValue("");
      setToast({ type: "success", title: "Autoridade Reconhecida", message: "Sua conta agora tem poderes totais de Administrador!" });
    } else {
      setToast({ type: "error", title: "Código Incorreto", message: "Código de autoridade incorreto." });
      setPinValue("");
      setTimeout(() => pinInputRef.current?.focus(), 150);
    }
  };

  const formatTime = (ts?: number) => {
    if (!ts) return "";
    const date = new Date(ts);
    return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  };

  const formatLastSeen = (ts?: number) => {
    if (!ts) return "Desconectado";
    const date = new Date(ts);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const timeStr = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
    if (isToday) {
      return `Visto hoje às ${timeStr}`;
    }
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `Visto em ${day}/${month} às ${timeStr}`;
  };

  const renderPresenceText = (contact?: ChatContact | null) => {
    if (!contact) return <Text className="text-[11px] text-zinc-600 font-medium">Desconectado</Text>;
    if (contact.isOnline) {
      return <Text className="text-[11px] text-emerald-400 font-bold">Online</Text>;
    }
    if (contact.lastSeen) {
      return <Text className="text-[11px] text-zinc-400 font-medium">{formatLastSeen(contact.lastSeen)}</Text>;
    }
    return <Text className="text-[11px] text-zinc-600 font-medium">Desconectado</Text>;
  };

  const getChatDateLabel = (timestamp?: number) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    const now = new Date();

    const dDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const nDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const diffDays = Math.round((nDay - dDay) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Hoje";
    if (diffDays === 1) return "Ontem";

    const meses = [
      "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];
    const dia = date.getDate();
    const mes = meses[date.getMonth()];
    const ano = date.getFullYear();

    if (ano === now.getFullYear()) {
      return `${dia} de ${mes}`;
    }
    return `${dia} de ${mes} de ${ano}`;
  };

  const isSameDay = (t1?: number, t2?: number) => {
    if (!t1 || !t2) return false;
    const d1 = new Date(t1);
    const d2 = new Date(t2);
    return (
      d1.getDate() === d2.getDate() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getFullYear() === d2.getFullYear()
    );
  };

  const toggleSelectMessage = useCallback((msgId: string) => {
    if (Platform.OS !== "web") {
      try {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    }
    setSelectedMessageIds(prev => {
      const next = new Set(prev);
      if (next.has(msgId)) {
        next.delete(msgId);
      } else {
        next.add(msgId);
      }
      return next;
    });
  }, []);

  const handleCopiarSelecionadas = useCallback(() => {
    const list = activeContact ? mensagensConversaAtiva : mensagensMuralFiltradas;
    const msgs = list.filter(m => selectedMessageIds.has(m.id)).sort((a, b) => a.timestamp - b.timestamp);
    if (msgs.length === 0) return;

    const textoFormatado = msgs.map(m => {
      const hora = formatTime(m.timestamp);
      return `[${hora}] ${m.remetenteNome}: ${m.texto || "[Foto/Mídia]"}`;
    }).join("\n");

    void copiarTextoParaClipboard(textoFormatado, `${msgs.length} mensagem(ns) copiada(s)!`);
    setSelectedMessageIds(new Set());
  }, [activeContact, mensagensConversaAtiva, mensagensMuralFiltradas, selectedMessageIds, formatTime]);

  const handleExcluirSelecionadas = useCallback(() => {
    const ids = Array.from(selectedMessageIds);
    if (ids.length === 0) return;

    solicitarExclusao(
      "Apagar Mensagens",
      `Deseja apagar as ${ids.length} mensagem(ns) selecionada(s)?`,
      async () => {
        for (const id of ids) {
          await apagarMensagem(id);
        }
        setSelectedMessageIds(new Set());
        setToast({ type: "success", title: "Mensagens Apagadas", message: `${ids.length} mensagens foram removidas.` });
      }
    );
  }, [selectedMessageIds, solicitarExclusao, apagarMensagem]);

  const canDeleteSelected = useMemo(() => {
    if (selectedMessageIds.size === 0) return false;
    if (isAdmin) return true;
    const list = activeContact ? mensagensConversaAtiva : mensagensMuralFiltradas;
    return Array.from(selectedMessageIds).some(id => list.find(m => m.id === id)?.remetenteId === myUserId);
  }, [selectedMessageIds, isAdmin, activeContact, mensagensConversaAtiva, mensagensMuralFiltradas, myUserId]);

  return (
    <>
      <Modal visible={visible} animationType="slide" transparent={false} statusBarTranslucent={true} onRequestClose={onClose}>
        <SafeAreaView className="flex-1 bg-[#09090c]" edges={['top']}>
          <View 
            className="flex-1 bg-[#09090c] flex flex-col overflow-hidden"
            style={{ 
              paddingBottom: keyboardHeight > 0 
                ? keyboardHeight + (Platform.OS === 'android' ? Math.max(insets.bottom, 16) + 4 : 0) 
                : (Platform.OS === 'android' ? Math.max(insets.bottom, 8) : insets.bottom) 
            }}
          >
          
          {/* ========================================================================= */}
          {/* VIEW 1: HUB PRINCIPAL (MEU PERFIL + ABAS + LISTAS) */}
          {/* ========================================================================= */}
          {!activeContact ? (
            <View className="flex-1 flex flex-col">
              
              {/* Header com Meu Perfil ou Barra de Seleção Múltipla */}
              <View className="p-4 bg-[#0d0d12] border-b border-zinc-800 flex flex-col gap-3.5">
                {selectedMessageIds.size > 0 ? (
                  <View className="flex-row items-center justify-between py-0.5">
                    <View className="flex-row items-center gap-3">
                      <Pressable 
                        onPress={() => setSelectedMessageIds(new Set())}
                        className="h-10 w-10 rounded-xl bg-zinc-900 border border-zinc-800 items-center justify-center active:scale-95 shadow-sm"
                      >
                        <X size={18} color="#d4d4d8" />
                      </Pressable>
                      <Text className="text-sm font-black text-white uppercase tracking-wider">
                        {selectedMessageIds.size} selecionada{selectedMessageIds.size > 1 ? "s" : ""}
                      </Text>
                    </View>

                    <View className="flex-row items-center gap-2">
                      <Pressable 
                        onPress={handleCopiarSelecionadas}
                        className="h-10 px-3.5 rounded-xl bg-indigo-600/20 border border-indigo-500/40 flex-row items-center gap-1.5 active:scale-95 shadow-sm"
                      >
                        <Copy size={15} color="#a5b4fc" />
                        <Text className="text-xs font-bold text-indigo-200 uppercase tracking-wider">Copiar</Text>
                      </Pressable>

                      {canDeleteSelected && (
                        <Pressable 
                          onPress={handleExcluirSelecionadas}
                          className="h-10 px-3.5 rounded-xl bg-red-500/15 border border-red-500/30 flex-row items-center gap-1.5 active:scale-95 shadow-sm"
                        >
                          <Trash2 size={15} color="#f87171" />
                          <Text className="text-xs font-bold text-red-300 uppercase tracking-wider">Apagar</Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                ) : (
                  <View className="flex-row items-center justify-between gap-2.5">
                    {/* Avatar com Gesto Secreto + Informações do Perfil */}
                    <View className="flex-row items-center gap-3 flex-1 min-w-0">
                      <Pressable 
                        onPress={handleAvatarTap} 
                        className="relative flex-shrink-0 active:scale-95"
                      >
                        <View className="h-11 w-11 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 items-center justify-center shadow-md overflow-hidden">
                          {myPhotoUrl ? (
                            <Image 
                              source={{ uri: formatGoogleDriveThumbnailUrl(myPhotoUrl, 96) }} 
                              className="w-full h-full" 
                              resizeMode="cover" 
                            />
                          ) : (
                            <Text className="text-indigo-300 font-black text-sm">
                              {(operatorName || "AT").substring(0, 2).toUpperCase()}
                            </Text>
                          )}
                        </View>
                        <View className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-emerald-500 border-2 border-[#0d0d12]" />
                      </Pressable>

                      <Pressable 
                        onPress={() => setModalEditProfileVisible(true)}
                        className="flex-1 min-w-0"
                      >
                        <View className="flex-row items-center gap-1.5">
                          <Text className="text-base font-black text-white uppercase tracking-wider truncate" numberOfLines={1}>
                            {operatorName}
                          </Text>
                          <Edit2 size={13} color="#71717a" />
                        </View>
                        <View className="flex-row items-center gap-1.5 mt-0.5 flex-wrap">
                          <Text className="text-xs font-mono text-indigo-400 font-bold">
                            @{myUsername}
                          </Text>
                          <Pressable onPress={copiarMinhaTag} hitSlop={8}>
                            <Copy size={11} color="#71717a" />
                          </Pressable>

                          {/* Badge de Cargo */}
                          {renderCargoBadge(operatorCargo, isAdmin)}

                          {/* Badge de Admin com Ação Rápida de Sair */}
                          {isAdmin && (
                            <Pressable 
                              onPress={() => {
                                solicitarExclusao(
                                  "Sair do Modo Administrador",
                                  "Deseja revogar seus privilégios de Administrador e voltar a ser Operador padrão?",
                                  async () => {
                                    await alternarAdminUsuario(myUserId, false);
                                    setToast({ type: "info", title: "Admin Desativado", message: "Você voltou ao modo Operador." });
                                  }
                                );
                              }}
                              className="px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 flex-row items-center gap-1 active:scale-95"
                            >
                              <Crown size={10} color="#f59e0b" />
                              <Text className="text-[9px] font-mono text-amber-300 font-black">ADMIN</Text>
                            </Pressable>
                          )}

                          {/* Badge de Auditoria / Modo Secreto */}
                          {secretMode && (
                            <View className="px-1.5 py-0.5 rounded bg-red-500/15 border border-red-500/30 flex-row items-center gap-1">
                              <Eye size={10} color="#f87171" />
                              <Text className="text-[9px] font-mono text-red-300 font-black">AUDITORIA</Text>
                            </View>
                          )}
                        </View>
                      </Pressable>
                    </View>

                    {/* Botões do Topo */}
                    <View className="flex-row items-center gap-2 flex-shrink-0">
                      <Pressable 
                        onPress={() => setModalAddVisible(true)}
                        className="h-10 px-3.5 rounded-xl bg-indigo-600 flex-row items-center gap-1.5 shadow-lg active:scale-95"
                      >
                        <Plus size={15} color="#ffffff" strokeWidth={2.5} />
                        <Text className="text-xs font-black uppercase tracking-wider text-white">Adicionar</Text>
                      </Pressable>
                      <Pressable 
                        onPress={onClose}
                        className="h-10 w-10 rounded-xl bg-zinc-900 border border-zinc-800 items-center justify-center active:scale-95 shadow-sm"
                      >
                        <X size={17} color="#a1a1aa" />
                      </Pressable>
                    </View>
                  </View>
                )}

                {/* Seletor de Abas */}
                <View className="flex-row p-1 bg-[#09090c] rounded-2xl border border-zinc-800/80 gap-1.5">
                  <Pressable 
                    onPress={() => setActiveTab("direto")}
                    className={`flex-1 h-10 rounded-xl flex-row items-center justify-center gap-2 ${
                      activeTab === "direto" ? "bg-[#18181f] shadow-sm" : ""
                    }`}
                  >
                    <MessageSquare size={16} color={activeTab === "direto" ? "#818cf8" : "#71717a"} />
                    <Text className={`text-xs font-black uppercase tracking-wider ${
                      activeTab === "direto" ? "text-white" : "text-zinc-400"
                    }`}>
                      Direto ({contatos.length})
                    </Text>
                  </Pressable>

                  <Pressable 
                    onPress={() => setActiveTab("mural")}
                    className={`flex-1 h-10 rounded-xl flex-row items-center justify-center gap-2 ${
                      activeTab === "mural" ? "bg-[#18181f] shadow-sm" : ""
                    }`}
                  >
                    <Megaphone size={15} color={activeTab === "mural" ? "#fbbf24" : "#71717a"} />
                    <Text className={`text-xs font-black uppercase tracking-wider ${
                      activeTab === "mural" ? "text-white" : "text-zinc-400"
                    }`}>
                      Mural
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* ABA DIRETO: LISTA DE CONTATOS */}
              {activeTab === "direto" ? (
                <View className="flex-1 flex flex-col">
                  {/* Barra de Busca */}
                  <View className="p-3 bg-[#09090c] border-b border-zinc-900 flex-row items-center gap-2">
                    <View className="h-11 rounded-2xl bg-[#121216] border border-zinc-800 px-3.5 flex-1 flex-row items-center gap-2.5">
                      <Search size={16} color="#71717a" />
                      <TextInput 
                        placeholder="Buscar por @username ou nome..."
                        placeholderTextColor="#52525b"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        className="flex-1 text-sm text-white"
                      />
                    </View>
                  </View>

                  <FlatList 
                    data={contatosFiltrados}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={{ padding: 12 }}
                    initialNumToRender={10}
                    maxToRenderPerBatch={8}
                    windowSize={5}
                    removeClippedSubviews={Platform.OS === "android"}
                    ListEmptyComponent={
                      <View className="py-12 items-center justify-center">
                        <Text className="text-sm text-zinc-500 font-medium text-center">
                          Nenhum contato conectado ainda.{"\n"}Toque em <Text className="text-indigo-400 font-bold">+ Adicionar</Text> para conectar um @username.
                        </Text>
                      </View>
                    }
                    renderItem={({ item }) => (
                      <Pressable 
                        onPress={() => {
                          setActiveContact(item);
                          void marcarConversaComoLida(item.id, item.username);
                        }}
                        onLongPress={() => {
                          solicitarExclusao(
                            "Remover Contato",
                            `Deseja remover @${item.username} da sua lista de conversas?`,
                            () => {
                              removerContato(item.id);
                              setToast({ type: "info", title: "Contato Removido", message: `@${item.username} foi removido.` });
                            }
                          );
                        }}
                        className="bg-[#121216] p-3.5 rounded-2xl border border-zinc-800 mb-2.5 flex-row items-center justify-between active:scale-[0.98]"
                      >
                        <View className="flex-row items-center gap-3.5 flex-1 min-w-0 mr-2">
                          <Pressable 
                            onPress={(e) => {
                              e.stopPropagation();
                              setViewingUserProfile(item);
                            }}
                            hitSlop={6}
                            className="relative flex-shrink-0 active:scale-95"
                          >
                            <View className="h-12 w-12 rounded-2xl bg-purple-500/20 border border-purple-500/40 items-center justify-center overflow-hidden">
                              {item.photoUrl ? (
                                <Image 
                                  source={{ uri: formatGoogleDriveThumbnailUrl(item.photoUrl, 96) }} 
                                  className="w-full h-full" 
                                  resizeMode="cover" 
                                />
                              ) : (
                                <Text className="text-purple-300 font-black text-sm">
                                  {(item.displayName || "AT").substring(0, 2).toUpperCase()}
                                </Text>
                              )}
                            </View>
                            <View className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#121216] ${
                              item.isOnline ? "bg-emerald-500" : "bg-zinc-600"
                            }`} />
                          </Pressable>

                          <View className="flex-1 min-w-0">
                            {/* Linha 1: Nome + Cargo à Esquerda | Hora da Mensagem à Direita */}
                            <View className="flex-row items-center justify-between">
                              <View className="flex-row items-center gap-1.5 flex-1 mr-2 min-w-0">
                                <Text className="text-sm font-black text-zinc-100 uppercase truncate" numberOfLines={1}>
                                  {item.displayName}
                                </Text>
                                {renderCargoBadge(item.cargo, item.isAdmin)}
                              </View>
                              
                              {item.lastMessageTime ? (
                                <Text className="text-[11px] text-zinc-500 font-medium flex-shrink-0">
                                  {formatTime(item.lastMessageTime)}
                                </Text>
                              ) : null}
                            </View>

                            {/* Linha 2: Prévia da Mensagem à Esquerda | Status Operacional à Direita */}
                            <View className="flex-row items-center justify-between mt-1">
                              <Text 
                                className={`text-xs truncate flex-1 mr-2 ${
                                  item.lastMessage?.includes("apagada")
                                    ? "text-zinc-600 italic font-medium"
                                    : "text-zinc-400"
                                }`} 
                                numberOfLines={1}
                              >
                                {item.lastMessage || "Toque para abrir a conversa"}
                              </Text>

                              <View className="flex-row items-center gap-1.5 flex-shrink-0">
                                {renderStatusPresetBadge(item.statusPreset)}
                              </View>
                            </View>
                          </View>
                        </View>

                        {Boolean(item.unreadCount && item.unreadCount > 0) && (
                          <View className="h-5.5 min-w-[22px] px-1.5 rounded-full bg-indigo-500 items-center justify-center shadow">
                            <Text className="text-[11px] font-black text-white">{item.unreadCount}</Text>
                          </View>
                        )}
                      </Pressable>
                    )}
                  />
                </View>
              ) : (
                /* ========================================================================= */
                /* ABA MURAL GERAL - FEED DIRETO COM RESPOSTAS (QUOTES) */
                /* ========================================================================= */
                <View className="flex-1 flex flex-col bg-[#07070a]">
                  {/* Barra de Ações do Mural (Admin / Moderação) */}
                  {isAdmin && (
                    <View className="px-3.5 py-2 flex-row items-center justify-between border-b border-zinc-800/80 bg-[#0d0d12]">
                      <View className="flex-row items-center gap-1.5">
                        <Crown size={12} color="#fbbf24" />
                        <Text className="text-[11px] font-mono text-amber-300 font-bold uppercase">
                          Moderação Ativa
                        </Text>
                      </View>
                      <Pressable 
                        onPress={() => {
                          solicitarExclusao(
                            "Limpar Mural Geral",
                            "Deseja limpar todos os recados do mural? Mensagens privadas não serão afetadas.",
                            async () => {
                              const deletedCount = await limparMuralGeral();
                              setToast({ type: "info", title: "Mural Limpo", message: `${deletedCount} recados foram limpos.` });
                            }
                          );
                        }}
                        className="px-2.5 py-1 rounded-lg bg-red-500/10 border border-red-500/20 flex-row items-center gap-1.5 active:bg-red-500/20 active:scale-95"
                      >
                        <Trash2 size={11} color="#f87171" />
                        <Text className="text-[10px] font-mono font-bold text-red-300">LIMPAR MURAL</Text>
                      </Pressable>
                    </View>
                  )}

                  {/* Feed de Recados do Mural Virtualizado (Inverted Nativo: 0ms para abrir, inicia na base mais recente como WhatsApp) */}
                  <FlatList
                    ref={muralFlatListRef}
                    data={mensagensMuralInvertidas}
                    inverted={true}
                    keyExtractor={(m) => m.id}
                    className="flex-1"
                    contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 10, paddingBottom: 16 }}
                    keyboardShouldPersistTaps="handled"
                    initialNumToRender={14}
                    maxToRenderPerBatch={10}
                    windowSize={7}
                    removeClippedSubviews={false}
                    updateCellsBatchingPeriod={50}
                    ListHeaderComponent={
                      /* No inverted={true}, ListHeaderComponent fica na BASE física (logo acima do input) */
                      activeUploads.filter(u => u.dest === "mural").length > 0 ? (
                        <View className="gap-2 mb-3">
                          {activeUploads
                            .filter(u => u.dest === "mural")
                            .map(u => (
                              <PixelArcadeUploadCard
                                key={u.id}
                                imageUri={u.uri}
                                progress={u.progress}
                                phaseText={u.phase}
                                isMural={true}
                              />
                            ))}
                        </View>
                      ) : null
                    }
                    ListFooterComponent={
                      /* No inverted={true}, ListFooterComponent fica no TOPO físico da conversa (Aviso Fixado) */
                      avisoFixadoMural ? (
                        <View className="bg-amber-500/10 border border-amber-500/40 rounded-2xl p-4 shadow-lg mb-3 relative overflow-hidden">
                          <View className="flex-row items-center justify-between mb-2">
                            <View className="flex-row items-center gap-2">
                              <Pin size={14} color="#fbbf24" />
                              <Text className="text-xs font-black uppercase tracking-wider text-amber-300">Aviso da Administração</Text>
                            </View>
                            {isAdmin && (
                              <Pressable 
                                onPress={() => desafixarAviso(avisoFixadoMural.id)}
                                className="h-6 px-2 rounded-md bg-amber-500/20 border border-amber-500/40 items-center justify-center active:scale-95"
                              >
                                <Text className="text-[10px] font-mono text-amber-300 font-bold">Desafixar</Text>
                              </Pressable>
                            )}
                          </View>

                          {/* Se o aviso fixado for resposta a outro recado */}
                          {avisoFixadoMural.replyTo && (
                            <View className="mb-2 p-2.5 rounded-xl bg-amber-500/15 border-l-4 border-amber-500 flex-row items-center gap-2">
                              <CornerDownRight size={13} color="#fbbf24" />
                              <View className="flex-1">
                                <Text className="text-[11px] font-bold text-amber-300">
                                  {avisoFixadoMural.replyTo.remetenteNome} {avisoFixadoMural.replyTo.remetenteUsername ? `(@${avisoFixadoMural.replyTo.remetenteUsername})` : ""}
                                </Text>
                                <Text className="text-xs text-zinc-300 font-medium" numberOfLines={1}>
                                  {avisoFixadoMural.replyTo.texto}
                                </Text>
                              </View>
                            </View>
                          )}

                          {avisoFixadoMural.imagemBase64 && (
                            <Pressable 
                              onPress={() => handleAbrirFoto(avisoFixadoMural.imagemBase64!, {
                                senderName: avisoFixadoMural.remetenteNome,
                                senderUsername: avisoFixadoMural.remetenteUsername,
                                timestamp: avisoFixadoMural.timestamp,
                                caption: avisoFixadoMural.texto
                              })}
                              className="rounded-xl overflow-hidden mb-2 border border-amber-500/30 active:opacity-90"
                            >
                              <Image source={{ uri: avisoFixadoMural.imagemBase64 }} className="w-full h-44 rounded-xl" resizeMode="cover" />
                            </Pressable>
                          )}

                          {avisoFixadoMural.texto ? (
                            <Text className="text-[13.5px] text-amber-100 font-medium leading-relaxed">
                              {avisoFixadoMural.texto}
                            </Text>
                          ) : null}

                          {/* Embed de Link Preview no Aviso Fixado */}
                          {avisoFixadoMural.texto ? (
                            <LinkPreview textMessage={avisoFixadoMural.texto} />
                          ) : null}

                          {/* Barra de Reações e Ações do Aviso Fixado */}
                          <View className="flex-row items-center justify-between mt-3 pt-2.5 border-t border-amber-500/20 flex-wrap gap-2">
                            <View className="flex-row items-center flex-wrap gap-1.5 flex-1 min-w-0">
                              {Object.entries(avisoFixadoMural.reacoes || {}).map(([emoji, userIds]) => {
                                if (!userIds || userIds.length === 0) return null;
                                const isMyReaction = Boolean(myUserId && userIds.includes(myUserId));
                                return (
                                  <Pressable
                                    key={emoji}
                                    onPress={() => alternarReacao(avisoFixadoMural.id, emoji)}
                                    className={`flex-row items-center gap-1 px-2.5 py-0.5 rounded-full border active:scale-95 ${
                                      isMyReaction
                                        ? "bg-amber-500/25 border-amber-500/60"
                                        : "bg-zinc-900/80 border-zinc-800"
                                    }`}
                                  >
                                    <Text className="text-xs">{emoji}</Text>
                                    <Text className={`text-[11px] font-bold ${isMyReaction ? "text-amber-300" : "text-zinc-400"}`}>
                                      {userIds.length}
                                    </Text>
                                  </Pressable>
                                );
                              })}

                              <Pressable
                                onPress={() => setReactionPickerMsgId(reactionPickerMsgId === avisoFixadoMural.id ? null : avisoFixadoMural.id)}
                                className="h-6 w-6 rounded-full bg-zinc-900 border border-zinc-800 items-center justify-center active:scale-95"
                              >
                                <Smile size={12} color="#fbbf24" />
                              </Pressable>

                              <Pressable
                                onPress={() => {
                                  setReplyingToMural(avisoFixadoMural);
                                  setEditingMsg(null);
                                }}
                                className="h-6 px-2 rounded-full bg-amber-500/20 border border-amber-500/40 flex-row items-center gap-1 active:scale-95 ml-1"
                              >
                                <CornerDownRight size={11} color="#fbbf24" />
                                <Text className="text-[10px] font-bold text-amber-300">Responder</Text>
                              </Pressable>
                            </View>
                          </View>

                          {/* Picker Rápido de Emojis para Aviso Fixado */}
                          {reactionPickerMsgId === avisoFixadoMural.id && (
                            <View className="flex-row items-center justify-around mt-2 p-1.5 rounded-2xl bg-[#09090c] border border-amber-500/40 shadow-xl">
                              {["❤️", "👍", "😂", "🔥", "👀", "🎉", "👏"].map((em) => (
                                <Pressable
                                  key={em}
                                  onPress={() => {
                                    alternarReacao(avisoFixadoMural.id, em);
                                    setReactionPickerMsgId(null);
                                  }}
                                  className="p-1 rounded-lg active:scale-125"
                                >
                                  <Text className="text-base">{em}</Text>
                                </Pressable>
                              ))}
                            </View>
                          )}

                          <View className="flex-row items-center justify-between mt-2.5 pt-2 border-t border-zinc-800/60">
                            <View className="flex-row items-center gap-1.5">
                              <Text className="text-xs font-mono text-amber-400 font-bold">
                                @{avisoFixadoMural.remetenteUsername || avisoFixadoMural.remetenteNome}
                              </Text>
                              <View className="h-4 px-1.5 rounded bg-amber-500/15 border border-amber-500/30 flex-row items-center gap-0.5">
                                <Crown size={9} color="#f59e0b" />
                                <Text className="text-[9px] font-mono text-amber-300 font-black">ADMIN</Text>
                              </View>
                            </View>
                            <Text className="text-[10px] text-zinc-500">Fixado no topo</Text>
                          </View>
                        </View>
                      ) : null
                    }
                    renderItem={({ item: m, index }) => {
                      const olderMsg = mensagensMuralInvertidas[index + 1];
                      const showDateSep = !olderMsg || !isSameDay(m.timestamp, olderMsg.timestamp);
                      const isSelected = selectedMessageIds.has(m.id);
                      const isApagada = Boolean(m.apagadaEm);
                      const senderDisplay = getOperatorDisplay(m.remetenteId, m.remetenteUsername, m.remetenteNome, m.remetenteCargo);

                      return (
                        <View key={m.id} className="w-full">
                          {/* Divisor de Data Estilo WhatsApp */}
                          {showDateSep && (
                            <View className="w-full items-center my-3">
                              <View className="bg-[#181824] border border-zinc-800/80 px-3.5 py-1 rounded-full shadow-sm">
                                <Text className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                                  {getChatDateLabel(m.timestamp)}
                                </Text>
                              </View>
                            </View>
                          )}

                          {isApagada && !secretMode ? (
                            <Pressable 
                              onPress={() => {
                                if (selectedMessageIds.size > 0) {
                                  toggleSelectMessage(m.id);
                                }
                              }}
                              onLongPress={() => {
                                if (selectedMessageIds.size > 0) {
                                  toggleSelectMessage(m.id);
                                  return;
                                }
                                handleLongPressMessage(m);
                              }}
                              delayLongPress={500}
                              className={`bg-zinc-900/60 border rounded-2xl p-3.5 mb-2.5 flex-row items-center justify-between active:opacity-75 ${
                                isSelected ? "border-indigo-500 bg-indigo-950/30" : "border-zinc-800"
                              }`}
                            >
                              <View className="flex-row items-center gap-2 flex-1 min-w-0">
                                <Info size={14} color="#71717a" />
                                <Text className="text-xs text-zinc-500 italic font-medium">Recado apagado do mural</Text>
                              </View>
                              {isSelected && (
                                <View className="h-5 w-5 rounded-full bg-indigo-500 items-center justify-center shadow">
                                  <Check size={12} color="#ffffff" strokeWidth={3} />
                                </View>
                              )}
                            </Pressable>
                          ) : (
                            <Pressable 
                              onPress={() => {
                                if (selectedMessageIds.size > 0) {
                                  toggleSelectMessage(m.id);
                                  return;
                                }
                                handleSecretAdminTap(m);
                                handleDoubleTapMessage(m);
                              }}
                              onLongPress={() => {
                                if (selectedMessageIds.size > 0) {
                                  toggleSelectMessage(m.id);
                                  return;
                                }
                                handleLongPressMessage(m);
                              }}
                              // @ts-ignore
                              onContextMenu={(e: any) => {
                                if (e && e.preventDefault) e.preventDefault();
                                if (selectedMessageIds.size > 0) {
                                  toggleSelectMessage(m.id);
                                } else {
                                  handleLongPressMessage(m);
                                }
                              }}
                              delayLongPress={250}
                              className={`border rounded-2xl p-4 shadow-md relative overflow-hidden mb-2.5 cursor-pointer ${
                                isSelected
                                  ? "bg-indigo-950/40 border-indigo-500"
                                  : isApagada 
                                  ? "bg-zinc-900/80 border-red-500/50 opacity-60" 
                                  : "bg-[#121216] border-zinc-800"
                              }`}
                            >
                              <HeartPopOverlay visible={heartPopMsgId === m.id} />

                              <View className="flex-row items-center justify-between mb-2">
                                <Pressable 
                                  onPress={() => {
                                    if (selectedMessageIds.size > 0) {
                                      toggleSelectMessage(m.id);
                                      return;
                                    }
                                    setViewingUserProfile({
                                      id: m.remetenteId,
                                      username: senderDisplay.username,
                                      displayName: senderDisplay.displayName,
                                      cargo: senderDisplay.cargo,
                                      isAdmin: senderDisplay.isAdmin,
                                      photoUrl: senderDisplay.photoUrl || undefined,
                                      recado: senderDisplay.recado || undefined,
                                      statusPreset: senderDisplay.statusPreset || undefined
                                    });
                                  }}
                                  className="flex-row items-center gap-2.5 flex-1 min-w-0 mr-2 active:opacity-80"
                                >
                                  <View className="h-8 w-8 rounded-xl bg-purple-500/20 border border-purple-500/30 items-center justify-center overflow-hidden flex-shrink-0">
                                    {senderDisplay.photoUrl ? (
                                      <Image 
                                        source={{ uri: formatGoogleDriveThumbnailUrl(senderDisplay.photoUrl, 80) }} 
                                        className="w-full h-full" 
                                        resizeMode="cover" 
                                      />
                                    ) : (
                                      <Text className="text-purple-300 text-xs font-black">
                                        {senderDisplay.initials}
                                      </Text>
                                    )}
                                  </View>
                                  <View className="flex-1 min-w-0">
                                    <View className="flex-row items-center gap-1.5 flex-wrap">
                                      <Text className="text-[13.5px] font-black text-zinc-200 truncate" numberOfLines={1}>{senderDisplay.displayName}</Text>
                                      {renderCargoBadge(senderDisplay.cargo, senderDisplay.isAdmin)}
                                      {renderStatusPresetBadge(senderDisplay.statusPreset)}
                                    </View>
                                    <Text className="text-[11px] font-mono text-purple-400 font-bold mt-0.5">
                                      @{senderDisplay.username}
                                    </Text>
                                  </View>
                                </Pressable>
                                <View className="flex-row items-center gap-2">
                                  {m.editadaEm && !isApagada && (
                                    <Text className="text-[9.5px] font-bold text-amber-400">Editado</Text>
                                  )}
                                  <Text className="text-[11px] text-zinc-500">{formatTime(m.timestamp)}</Text>
                                  {isSelected ? (
                                    <View className="h-5 w-5 rounded-full bg-indigo-500 items-center justify-center shadow ml-1">
                                      <Check size={12} color="#ffffff" strokeWidth={3} />
                                    </View>
                                  ) : !isApagada ? (
                                    <Pressable 
                                      onPress={() => {
                                        if (isAdmin || m.remetenteId === myUserId) {
                                          solicitarExclusao(
                                            "Apagar do Mural",
                                            "Deseja excluir este recado do mural para todos os operadores?",
                                            async () => {
                                              await apagarMensagem(m.id);
                                              setToast({ type: "info", title: "Recado Apagado", message: "O recado foi apagado do mural." });
                                            }
                                          );
                                        } else {
                                          solicitarExclusao(
                                            "Apagar para Mim",
                                            "Deseja ocultar este recado do seu mural neste dispositivo?",
                                            async () => {
                                              await apagarParaMim(m.id);
                                              setToast({ type: "info", title: "Recado Ocultado", message: "O recado foi ocultado da sua tela." });
                                            }
                                          );
                                        }
                                      }}
                                      className="h-7 w-7 rounded-lg bg-red-500/10 border border-red-500/20 items-center justify-center active:scale-95 ml-1"
                                    >
                                      <Trash2 size={12} color="#f87171" />
                                    </Pressable>
                                  ) : null}
                                </View>
                              </View>

                              {/* Citação / Resposta (Quote) no Recado */}
                              {m.replyTo && (
                                <View className="mb-2.5 p-2.5 rounded-xl bg-purple-500/15 border-l-4 border-purple-500 flex-row items-center gap-2">
                                  <CornerDownRight size={13} color="#c084fc" />
                                  <View className="flex-1">
                                    <Text className="text-[11px] font-black text-purple-300">
                                      {m.replyTo.remetenteNome} {m.replyTo.remetenteUsername ? `(@${m.replyTo.remetenteUsername})` : ""}
                                    </Text>
                                    <Text className="text-xs text-zinc-300 font-medium" numberOfLines={2}>
                                      {m.replyTo.texto}
                                    </Text>
                                  </View>
                                </View>
                              )}

                              {/* Coleção / Foto anexada no recado do mural */}
                              {m.imagemBase64 ? (
                                renderImageCollage(m.imagemBase64, {
                                  senderName: m.remetenteNome,
                                  senderUsername: m.remetenteUsername,
                                  timestamp: m.timestamp,
                                  caption: m.texto
                                }, true)
                              ) : null}

                              {m.texto ? (
                                <Text className="text-[14px] text-zinc-300 leading-relaxed">{m.texto}</Text>
                              ) : null}

                              {/* Embed de Link Preview no Recado do Mural */}
                              {m.texto ? (
                                <LinkPreview textMessage={m.texto} />
                              ) : null}

                              {/* Reações do Recado e Botão de Responder */}
                              <View className="flex-row items-center justify-between mt-3 pt-2.5 border-t border-zinc-800/80 flex-wrap gap-2">
                                <View className="flex-row items-center flex-wrap gap-1.5 flex-1 min-w-0">
                                  {Object.entries((m.reacoes || {}) as Record<string, string[]>).map(([emoji, userIds]) => {
                                    if (!userIds || userIds.length === 0) return null;
                                    const isMyReaction = Boolean(myUserId && userIds.includes(myUserId));
                                    return (
                                      <Pressable
                                        key={emoji}
                                        onPress={() => alternarReacao(m.id, emoji)}
                                        onLongPress={() => setWhoReactedModal({ visible: true, emoji, msg: m })}
                                        className={`flex-row items-center gap-1 px-2.5 py-0.5 rounded-full border active:scale-95 ${
                                          isMyReaction
                                            ? "bg-purple-500/25 border-purple-500/60"
                                            : "bg-zinc-900 border-zinc-800"
                                        }`}
                                      >
                                        <Text className="text-xs">{emoji}</Text>
                                        <Text className={`text-[11px] font-bold ${isMyReaction ? "text-purple-300" : "text-zinc-400"}`}>
                                          {userIds.length}
                                        </Text>
                                      </Pressable>
                                    );
                                  })}

                                  <Pressable
                                    onPress={() => setReactionPickerMsgId(reactionPickerMsgId === m.id ? null : m.id)}
                                    className="h-6 w-6 rounded-full bg-zinc-900 border border-zinc-800 items-center justify-center active:scale-95"
                                  >
                                    <Smile size={12} color="#a1a1aa" />
                                  </Pressable>

                                  <Pressable
                                    onPress={() => setReplyingToMural(m)}
                                    className="h-6 px-2.5 rounded-full bg-zinc-900 border border-zinc-800 flex-row items-center gap-1 active:scale-95 ml-1"
                                  >
                                    <CornerDownRight size={11} color="#c084fc" />
                                    <Text className="text-[10px] font-bold text-purple-300">Responder</Text>
                                  </Pressable>
                                </View>
                              </View>

                              {/* Picker Rápido de Emojis */}
                              {reactionPickerMsgId === m.id && (
                                <View className="flex-row items-center justify-around mt-2 p-1.5 rounded-2xl bg-[#09090c] border border-zinc-700 shadow-xl">
                                  {["❤️", "👍", "😂", "🔥", "👀", "🎉", "👏"].map((em) => (
                                    <Pressable
                                      key={em}
                                      onPress={() => {
                                        alternarReacao(m.id, em);
                                        setReactionPickerMsgId(null);
                                      }}
                                      className="p-1 rounded-lg active:scale-125"
                                    >
                                      <Text className="text-base">{em}</Text>
                                    </Pressable>
                                  ))}
                                </View>
                              )}
                            </Pressable>
                          )}
                        </View>
                      );
                    }}
                  />

                    {/* Barra de Publicar no Mural */}
                    <View className="p-3.5 bg-[#0d0d12] border-t border-zinc-800 gap-2.5">
                      {/* Banner de Edição no Mural */}
                      {editingMsg && editingMsg.isMural && (
                        <View className="px-3.5 py-2 bg-amber-500/15 border border-amber-500/30 rounded-xl flex-row items-center justify-between mb-1">
                          <View className="flex-row items-center gap-2">
                            <Edit2 size={14} color="#fbbf24" />
                            <Text className="text-xs text-amber-300 font-bold">Editando recado do mural...</Text>
                          </View>
                          <Pressable onPress={() => { setEditingMsg(null); setTextoMural(""); }}>
                            <Text className="text-[10px] text-zinc-400 font-bold uppercase">Cancelar</Text>
                          </Pressable>
                        </View>
                      )}

                      {/* Banner de Resposta a Recado / Thread */}
                      {replyingToMural && (
                        <View className="px-3.5 py-2 bg-purple-500/15 border border-purple-500/30 rounded-xl flex-row items-center justify-between mb-1">
                          <View className="flex-row items-center gap-2 flex-1 min-w-0">
                            <CornerDownRight size={14} color="#c084fc" />
                            <View className="flex-1 min-w-0">
                              <Text className="text-xs text-purple-300 font-bold">
                                Respondendo a @{replyingToMural.remetenteUsername || replyingToMural.remetenteNome}
                              </Text>
                              <Text className="text-[11px] text-zinc-400 truncate" numberOfLines={1}>
                                {replyingToMural.texto || "Foto anexada"}
                              </Text>
                            </View>
                          </View>
                          <Pressable onPress={() => setReplyingToMural(null)} className="p-1">
                            <X size={14} color="#a1a1aa" />
                          </Pressable>
                        </View>
                      )}

                      {isAdmin && (
                        <Pressable 
                          onPress={() => setFixarNoMural(!fixarNoMural)}
                          className="flex-row items-center justify-between px-1"
                        >
                          <View className="flex-row items-center gap-2">
                            <View className={`h-4.5 w-4.5 rounded items-center justify-center border ${
                              fixarNoMural ? "bg-amber-500 border-amber-500" : "bg-zinc-900 border-zinc-700"
                            }`}>
                              {fixarNoMural && <Check size={12} color="#000000" strokeWidth={3} />}
                            </View>
                            <Text className="text-xs font-black uppercase tracking-wider text-amber-300 flex-row items-center gap-1">
                              Fixar como Destaque no Topo
                            </Text>
                          </View>
                          <View className="flex-row items-center gap-1">
                            <Crown size={11} color="#fbbf24" />
                            <Text className="text-[9.5px] font-mono text-amber-400/80">Admin Ativo</Text>
                          </View>
                        </Pressable>
                      )}

                      {/* Tray de Anexos Pendentes do Mural (Estilo Discord) */}
                      {anexosMural.length > 0 && (
                        <View className="p-2 bg-[#09090c] border border-amber-500/30 rounded-2xl flex-row items-center gap-2">
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, alignItems: "center" }}>
                            {anexosMural.map((anx, idx) => (
                              <View key={anx.id} className="relative">
                                <Image 
                                  source={{ uri: anx.uri }} 
                                  className="h-14 w-14 rounded-xl border border-amber-500/40" 
                                  resizeMode="cover" 
                                />
                                <Pressable
                                  onPress={() => {
                                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    setAnexosMural(prev => prev.filter(a => a.id !== anx.id));
                                  }}
                                  hitSlop={8}
                                  className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-red-600 border border-black items-center justify-center shadow-md active:scale-90"
                                >
                                  <X size={10} color="#ffffff" strokeWidth={3} />
                                </Pressable>
                                <View className="absolute bottom-0.5 left-0.5 px-1 rounded bg-black/70">
                                  <Text className="text-[8px] font-mono text-amber-300 font-bold">#{idx + 1}</Text>
                                </View>
                              </View>
                            ))}
                            <Pressable
                              onPress={handlePickAnexoMural}
                              className="h-14 w-14 rounded-xl border border-dashed border-zinc-700 bg-zinc-900/50 items-center justify-center active:scale-95"
                            >
                              <Plus size={16} color="#fbbf24" />
                              <Text className="text-[8px] font-bold text-amber-300 mt-0.5">+ Foto</Text>
                            </Pressable>
                          </ScrollView>
                          <Pressable
                            onPress={() => setAnexosMural([])}
                            className="px-2 py-1 rounded-md bg-zinc-800/80 active:bg-zinc-700 self-center"
                          >
                            <Text className="text-[9.5px] font-bold text-zinc-400">Limpar</Text>
                          </Pressable>
                        </View>
                      )}

                      <View className="flex-row items-center gap-2.5">
                        {/* Botão de Anexar Foto no Mural */}
                        <Pressable 
                          onPress={handlePickAnexoMural}
                          disabled={isUploadingPhoto}
                          className="h-12 w-12 rounded-2xl bg-[#121216] border border-zinc-800 items-center justify-center active:scale-95 shadow-md"
                        >
                          {isUploadingPhoto ? (
                            <ActivityIndicator size="small" color="#fbbf24" />
                          ) : (
                            <ImageIcon size={18} color="#fbbf24" />
                          )}
                        </Pressable>

                        <View className="flex-1 h-12 bg-[#121216] border border-zinc-800 rounded-2xl px-4 flex-row items-center gap-2.5">
                          <Megaphone size={16} color="#fbbf24" />
                          <TextInput 
                            placeholder="Publicar aviso no mural ou /jogos..."
                            placeholderTextColor="#52525b"
                            value={textoMural}
                            onChangeText={handleTextoMuralChange}
                            style={{ textAlignVertical: "center", paddingVertical: 0 }}
                            className="flex-1 text-sm text-white"
                          />
                        </View>
                        <Pressable 
                          onPress={() => {
                            if (textoMural.trim().length > 0 || anexosMural.length > 0) {
                              handleEnviarMural();
                            } else {
                              handleSecretSendTap();
                            }
                          }}
                          className={`h-12 w-12 rounded-2xl items-center justify-center active:scale-95 shadow-lg ${
                            textoMural.trim().length > 0 || anexosMural.length > 0 ? "bg-amber-500" : "bg-zinc-800 opacity-60"
                          }`}
                        >
                          <Send size={17} color={textoMural.trim().length > 0 || anexosMural.length > 0 ? "#09090c" : "#71717a"} strokeWidth={2.5} />
                        </Pressable>
                      </View>
                    </View>
                  </View>
                )}
              </View>
            ) : liveContact ? (
            /* ========================================================================= */
            /* VIEW 2: TELA DE CONVERSA DIRETA COM FOTOS */
            /* ========================================================================= */
            <View className="flex-1 flex flex-col bg-[#07070a]">
              
              {/* Header da Conversa ou Barra de Seleção Múltipla */}
              {selectedMessageIds.size > 0 ? (
                <View className="px-3.5 py-3 bg-[#0d0d12] border-b border-indigo-500/40 flex-row items-center justify-between shadow-lg">
                  <View className="flex-row items-center gap-3">
                    <Pressable 
                      onPress={() => setSelectedMessageIds(new Set())}
                      className="h-10 w-10 rounded-xl bg-zinc-900 border border-zinc-800 items-center justify-center active:scale-95 shadow-sm"
                    >
                      <X size={18} color="#d4d4d8" />
                    </Pressable>
                    <Text className="text-sm font-black text-white uppercase tracking-wider">
                      {selectedMessageIds.size} selecionada{selectedMessageIds.size > 1 ? "s" : ""}
                    </Text>
                  </View>

                  <View className="flex-row items-center gap-2">
                    <Pressable 
                      onPress={handleCopiarSelecionadas}
                      className="h-10 px-3.5 rounded-xl bg-indigo-600/20 border border-indigo-500/40 flex-row items-center gap-1.5 active:scale-95 shadow-sm"
                    >
                      <Copy size={15} color="#a5b4fc" />
                      <Text className="text-xs font-bold text-indigo-200 uppercase tracking-wider">Copiar</Text>
                    </Pressable>

                    {canDeleteSelected && (
                      <Pressable 
                        onPress={handleExcluirSelecionadas}
                        className="h-10 px-3.5 rounded-xl bg-red-500/15 border border-red-500/30 flex-row items-center gap-1.5 active:scale-95 shadow-sm"
                      >
                        <Trash2 size={15} color="#f87171" />
                        <Text className="text-xs font-bold text-red-300 uppercase tracking-wider">Apagar</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              ) : (
                <View className="px-3 py-3 bg-[#0d0d12] border-b border-zinc-800 flex-row items-center">
                  <View className="flex-row items-center gap-2.5 flex-1 min-w-0">
                    <Pressable 
                      onPress={() => setActiveContact(null)}
                      className="h-9 w-9 rounded-full bg-zinc-900 border border-zinc-800 items-center justify-center active:scale-95 shadow-sm flex-shrink-0"
                    >
                      <ChevronLeft size={18} color="#d4d4d8" />
                    </Pressable>

                    <Pressable 
                      onPress={() => setViewingUserProfile(liveContact)}
                      className="flex-row items-center gap-2.5 flex-1 min-w-0 active:opacity-80"
                    >
                      <View className="relative flex-shrink-0">
                        <View className="h-10 w-10 rounded-2xl bg-purple-500/20 border border-purple-500/40 items-center justify-center overflow-hidden">
                          {liveContact.photoUrl ? (
                            <Image 
                              source={{ uri: formatGoogleDriveThumbnailUrl(liveContact.photoUrl, 96) }} 
                              className="w-full h-full" 
                              resizeMode="cover" 
                            />
                          ) : (
                            <Text className="text-purple-300 font-black text-sm">
                              {(liveContact.displayName || "AT").substring(0, 2).toUpperCase()}
                            </Text>
                          )}
                        </View>
                        <View className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#0d0d12] ${
                          liveContact.isOnline ? "bg-emerald-500" : "bg-zinc-600"
                        }`} />
                      </View>

                      <View className="flex-1 min-w-0">
                        <View className="flex-row items-center gap-1 min-w-0">
                          <Text className="text-sm font-black text-white uppercase tracking-wider" numberOfLines={1} ellipsizeMode="tail" style={{ flexShrink: 1 }}>
                            {liveContact.displayName}
                          </Text>
                          {renderCargoBadge(liveContact.cargo, liveContact.isAdmin)}
                        </View>
                        <View className="flex-row items-center gap-1 mt-0.5 min-w-0">
                          <Text className="text-[11px] font-mono text-purple-400 font-bold" numberOfLines={1}>
                            @{liveContact.username}
                          </Text>
                          <Text className="text-[10px] text-zinc-600">•</Text>
                          {renderPresenceText(liveContact)}
                        </View>
                      </View>
                    </Pressable>
                  </View>

                  {/* Ações do Contato no Header */}
                  <View className="flex-row items-center gap-1.5 flex-shrink-0 ml-2">
                    {isAdmin && (
                      <Pressable
                        onPress={async () => {
                          const targetId = liveContact.id;
                          const isTargetAdmin = Boolean(liveContact.isAdmin);
                          await alternarAdminUsuario(targetId, !isTargetAdmin);
                          setToast({
                            type: isTargetAdmin ? "info" : "success",
                            title: isTargetAdmin ? "Admin Revogado" : "Admin Concedido",
                            message: isTargetAdmin 
                              ? `@${liveContact.username} agora é Operador padrão.` 
                              : `@${liveContact.username} agora tem privilégios de Administrador.`
                          });
                        }}
                        className="h-8 px-2 rounded-xl bg-amber-500/15 border border-amber-500/30 flex-row items-center gap-1 active:scale-95"
                      >
                        <Crown size={13} color="#f59e0b" />
                        <Text className="text-[10px] font-black text-amber-300 uppercase">
                          {liveContact.isAdmin ? "Rev" : "Adm"}
                        </Text>
                      </Pressable>
                    )}

                    <Pressable 
                      onPress={() => {
                        solicitarExclusao(
                          "Remover Contato",
                          `Deseja remover @${liveContact.username} das suas conversas?`,
                          () => {
                            removerContato(liveContact.id);
                            setActiveContact(null);
                            setToast({ type: "info", title: "Contato Removido", message: `@${liveContact.username} foi removido da lista.` });
                          }
                        );
                      }}
                      className="h-8 w-8 rounded-xl bg-red-500/10 border border-red-500/20 items-center justify-center active:scale-95 shadow-sm"
                    >
                      <Trash2 size={14} color="#f87171" />
                    </Pressable>
                  </View>
                </View>
              )}

              {/* Mensagens do Chat Direto (Inverted Nativo: 0ms de espera, abre direto no final sem saltos) */}
              <FlatList 
                ref={flatListRef}
                data={mensagensInvertidas}
                inverted={true}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 4, paddingBottom: 8 }}
                keyboardShouldPersistTaps="handled"
                initialNumToRender={20}
                maxToRenderPerBatch={15}
                windowSize={7}
                removeClippedSubviews={false}
                updateCellsBatchingPeriod={50}
                renderItem={({ item, index }) => {
                  const isMe = item.remetenteId === myUserId;
                  const isApagada = Boolean(item.apagadaEm);
                  const isLida = Boolean(
                    activeContact &&
                    item.lidasPor &&
                    (item.lidasPor.includes(activeContact.id) || (activeContact.username && item.lidasPor.includes(activeContact.username.toLowerCase())))
                  );
                  const isEntregue = Boolean(
                    activeContact && (
                      activeContact.isOnline ||
                      presencas.some(p => (p.id === activeContact.id || (activeContact.username && p.username?.toLowerCase() === activeContact.username.toLowerCase())) && p.isOnline)
                    )
                  );
                  const isHighlighted = highlightedMsgId === item.id;
                  const isSelected = selectedMessageIds.has(item.id);
                  const olderMsg = mensagensInvertidas[index + 1];
                  const showDateSep = !olderMsg || !isSameDay(item.timestamp, olderMsg.timestamp);

                  if (hiddenLocalIds[item.id] && !secretMode) {
                    return null;
                  }

                  return (
                    <View key={item.id} className="w-full">
                      {/* Divisor de Data Estilo WhatsApp */}
                      {showDateSep && (
                        <View className="w-full items-center my-3">
                          <View className="bg-[#181824] border border-zinc-800/80 px-3.5 py-1 rounded-full shadow-sm">
                            <Text className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                              {getChatDateLabel(item.timestamp)}
                            </Text>
                          </View>
                        </View>
                      )}

                      {/* Mensagem Apagada */}
                      {isApagada && !secretMode ? (
                        <View className={`w-full flex-row ${isMe ? "justify-end" : "justify-start"} my-0.5`}>
                          <Pressable 
                            onPress={() => {
                              if (selectedMessageIds.size > 0) {
                                toggleSelectMessage(item.id);
                              }
                            }}
                            onLongPress={() => {
                              if (selectedMessageIds.size > 0) {
                                toggleSelectMessage(item.id);
                                return;
                              }
                              handleLongPressMessage(item);
                            }}
                            delayLongPress={300}
                            className={`max-w-[78%] rounded-xl px-3 py-1.5 border flex-row items-center gap-1.5 active:opacity-75 ${
                              isSelected ? "border-indigo-500 bg-indigo-950/40" : "bg-zinc-900/90 border-zinc-800"
                            }`}
                          >
                            <Info size={13} color="#71717a" />
                            <Text className="text-xs font-medium text-zinc-500 italic">Mensagem apagada</Text>
                            {isSelected && (
                              <View className="h-4 w-4 rounded-full bg-indigo-500 items-center justify-center shadow ml-1">
                                <Check size={10} color="#ffffff" strokeWidth={3} />
                              </View>
                            )}
                          </Pressable>
                        </View>
                      ) : (
                        <SwipeableMessageRow
                          item={item}
                          isMe={isMe}
                          onSwipeReply={() => {
                            setReplyingToDirect(item);
                            setTimeout(() => directInputRef.current?.focus(), 150);
                          }}
                          onLongPress={() => {
                            if (selectedMessageIds.size > 0) {
                              toggleSelectMessage(item.id);
                              return;
                            }
                            handleLongPressMessage(item);
                          }}
                        >
                          <Pressable 
                            onPress={() => {
                              if (selectedMessageIds.size > 0) {
                                toggleSelectMessage(item.id);
                                return;
                              }
                              handleSecretAdminTap(item);
                              handleDoubleTapMessage(item);
                            }}
                            onLongPress={() => {
                              if (selectedMessageIds.size > 0) {
                                toggleSelectMessage(item.id);
                                return;
                              }
                              handleLongPressMessage(item);
                            }}
                            // @ts-ignore
                            onContextMenu={(e: any) => {
                              if (e && e.preventDefault) e.preventDefault();
                              if (selectedMessageIds.size > 0) {
                                toggleSelectMessage(item.id);
                              } else {
                                handleLongPressMessage(item);
                              }
                            }}
                            delayLongPress={250}
                            className={`w-full ${item.jogo ? "p-0 bg-transparent border-0 shadow-none" : "rounded-xl px-3 py-2 " + (isMe ? "bg-[#161624] border-l-2 border-indigo-500 border-t border-r border-b border-zinc-800 shadow-md" : "bg-[#111118] border-l-2 border-zinc-500 border-t border-r border-b border-zinc-800/80 shadow-sm")} text-left relative overflow-hidden transition-all cursor-pointer ${isSelected ? "bg-indigo-950/40 border border-indigo-400" : isHighlighted ? "bg-indigo-500/25 border-indigo-400" : ""} ${isApagada ? "opacity-50 border border-red-500/50" : ""}`}
                          >
                            <HeartPopOverlay visible={heartPopMsgId === item.id} />

                            {/* Checkmark no modo de seleção */}
                            {isSelected && (
                              <View className="absolute top-2 right-2 h-5 w-5 rounded-full bg-indigo-500 items-center justify-center shadow z-10">
                                <Check size={12} color="#ffffff" strokeWidth={3} />
                              </View>
                            )}

                        {/* Nome do Remetente + Selo de Cargo (Apenas em mensagens normais recebidas do outro operador) */}
                        {!isMe && !item.jogo && (
                          <View className="flex-row items-center gap-1.5 mb-1 flex-wrap">
                            <Text className="text-[10.5px] font-mono font-black text-zinc-400 uppercase tracking-wider">
                              {item.remetenteNome || item.remetenteUsername || "Atendente"}
                            </Text>
                            {renderCargoBadge(
                              item.remetenteCargo || liveContact?.cargo,
                              liveContact?.isAdmin
                            )}
                          </View>
                        )}

                        {/* CITAÇÃO / REPLY INTERATIVO DENTRO DO BALÃO */}
                        {item.replyTo && (
                          <Pressable
                            onPress={() => scrollToMessage(item.replyTo!.id)}
                            className="bg-black/50 border-l-2 border-amber-400 rounded-r-lg px-2.5 py-1.5 mb-1.5 flex-row items-center justify-between active:bg-black/70 shadow-sm"
                          >
                            <View className="flex-1 min-w-0 mr-2">
                              <View className="flex-row items-center gap-1">
                                <CornerDownRight size={11} color="#fbbf24" />
                                <Text 
                                  className="text-amber-300 font-black text-[10px] uppercase tracking-wider" 
                                  numberOfLines={1}
                                  ellipsizeMode="tail"
                                >
                                  {item.replyTo.remetenteUsername ? `@${item.replyTo.remetenteUsername.replace(/^@/, "")}` : item.replyTo.remetenteNome}
                                </Text>
                              </View>
                              <Text 
                                className="text-zinc-300 text-[11px] mt-0.5" 
                                numberOfLines={1}
                                ellipsizeMode="tail"
                              >
                                {item.replyTo.texto || "📷 Foto"}
                              </Text>
                            </View>
                            <View className="px-1.5 py-0.5 rounded bg-amber-400/10 border border-amber-400/20">
                              <Text className="text-amber-300 font-mono font-bold text-[9px]">Ir ↗</Text>
                            </View>
                          </Pressable>
                        )}

                        {/* Coleção / Foto Anexada (se houver) */}
                        {item.imagemBase64 ? (
                          renderImageCollage(item.imagemBase64, {
                            senderName: item.remetenteNome,
                            senderUsername: item.remetenteUsername,
                            timestamp: item.timestamp,
                            caption: item.texto
                          })
                        ) : null}

                        {/* Texto da Mensagem */}
                        {item.texto && !item.jogo ? (
                          <Text className={`text-[13.5px] leading-[19px] ${isMe ? "text-white font-normal" : "text-zinc-100 font-normal"}`}>
                            {item.texto}
                          </Text>
                        ) : null}

                        {/* Jogo Interativo no Balão (Jogo da Velha, etc.) */}
                        {item.jogo && item.jogo.tipo === "velha" && (
                          <JogoDaVelhaCard
                            jogo={item.jogo}
                            mensagemId={item.id}
                            myUserId={myUserId}
                            myUsername={myUsername}
                            onJogar={(pos) => void jogarVelha(item.id, pos)}
                            onReiniciar={() => void reiniciarJogo(item.id)}
                            timestamp={item.timestamp}
                            isMe={isMe}
                          />
                        )}

                        {/* Jogo Interativo no Balão (4 em Linha) */}
                        {item.jogo && item.jogo.tipo === "quatro_linha" && (
                          <QuatroEmLinhaCard
                            jogo={item.jogo}
                            mensagemId={item.id}
                            myUserId={myUserId}
                            myUsername={myUsername}
                            onJogarColuna={(col) => void jogarQuatroEmLinha(item.id, col)}
                            onReiniciar={() => void reiniciarJogo(item.id)}
                            timestamp={item.timestamp}
                            isMe={isMe}
                          />
                        )}

                        {/* Jogo Interativo no Balão (Batalha Naval) */}
                        {item.jogo && item.jogo.tipo === "batalha_naval" && (
                          <BatalhaNavalCard
                            jogo={item.jogo}
                            mensagemId={item.id}
                            myUserId={myUserId}
                            myUsername={myUsername}
                            onDisparar={(idx) => void dispararBatalhaNaval(item.id, idx)}
                            onReiniciar={() => void reiniciarJogo(item.id)}
                            timestamp={item.timestamp}
                            isMe={isMe}
                          />
                        )}

                        {/* Jogo Interativo no Balão (Termo Versus) */}
                        {item.jogo && item.jogo.tipo === "termo_versus" && (
                          <TermoCard
                            jogo={item.jogo}
                            mensagemId={item.id}
                            myUserId={myUserId}
                            myUsername={myUsername}
                            onEnviarPalpite={(palpite) => void jogarTermoVersus(item.id, palpite)}
                            onReiniciar={() => void reiniciarJogo(item.id)}
                            timestamp={item.timestamp}
                            isMe={isMe}
                          />
                        )}

                        {/* Jogo Interativo no Balão (Jogo da Forca) */}
                        {item.jogo && item.jogo.tipo === "forca" && (
                          <ForcaCard
                            jogo={item.jogo}
                            mensagemId={item.id}
                            myUserId={myUserId}
                            myUsername={myUsername}
                            onChutarLetra={async (letra) => {
                              const res = await chutarLetraForca(item.id, letra);
                              if (!res.sucesso && res.erro) {
                                setToast({ type: "warning", title: "Forca", message: res.erro });
                              }
                            }}
                            onChutarPalavra={async (palavra) => {
                              const res = await chutarPalavraForca(item.id, palavra);
                              if (!res.sucesso && res.erro) {
                                setToast({ type: "warning", title: "Forca", message: res.erro });
                              }
                            }}
                            onAdicionarDica={async (dica) => {
                              const res = await adicionarDicaForca(item.id, dica);
                              if (!res.sucesso && res.erro) {
                                setToast({ type: "warning", title: "Dica", message: res.erro });
                              } else {
                                setToast({ type: "success", title: "Dica Enviada! 💡", message: "Sua pista apareceu no painel da forca!" });
                              }
                            }}
                            onPedirDica={async () => {
                              const res = await pedirDicaForca(item.id);
                              if (!res.sucesso && res.erro) {
                                setToast({ type: "warning", title: "SOS", message: res.erro });
                              } else {
                                setToast({ type: "info", title: "SOS Enviado! 🆘", message: "Você pediu uma dica ao criador!" });
                              }
                            }}
                            onRevelarLetra={async () => {
                              const res = await revelarLetraForca(item.id);
                              if (!res.sucesso && res.erro) {
                                setToast({ type: "warning", title: "Presente", message: res.erro });
                              } else {
                                setToast({ type: "success", title: "Letra Revelada! 🎁", message: "Você presenteou seu colega com uma letra!" });
                              }
                            }}
                            onReiniciar={() => void reiniciarJogo(item.id)}
                            onAbrirNovoDesafio={() => {
                              setForcaPalavraInput("");
                              setForcaTemaInput("");
                              setForcaDicaInput("");
                              setForcaCustomVisible(true);
                            }}
                            timestamp={item.timestamp}
                            isMe={isMe}
                          />
                        )}

                        {/* Jogo Interativo no Balão (Stop! Adedonha) */}
                        {item.jogo && item.jogo.tipo === "stop" && (
                          <StopCard
                            jogo={item.jogo}
                            mensagemId={item.id}
                            myUserId={myUserId}
                            myUsername={myUsername}
                            onSubmeterRespostas={async (respostas, acionouStop) => {
                              const res = await submeterRespostasStop(item.id, respostas, acionouStop);
                              if (!res.sucesso && res.erro) {
                                setToast({ type: "warning", title: "Stop!", message: res.erro });
                              } else if (acionouStop) {
                                setToast({ type: "success", title: "🚨 STOP ACIONADO!", message: "Suas respostas foram gravadas!" });
                              }
                            }}
                            onAlternarValidacao={async (alvo, cat) => {
                              await alternarValidacaoStop(item.id, alvo, cat);
                            }}
                            onFinalizarRodada={async () => {
                              await finalizarRodadaStop(item.id);
                              setToast({ type: "success", title: "Rodada Concluída! 🏆", message: "O placar foi atualizado!" });
                            }}
                            onReiniciar={() => void reiniciarJogo(item.id)}
                            timestamp={item.timestamp}
                            isMe={isMe}
                          />
                        )}

                        {/* Embed de Link Preview na Conversa Direta */}
                        {item.texto ? (
                          <LinkPreview textMessage={item.texto} />
                        ) : null}

                        {/* Rodapé da Bolha: Hora + Checks (Apenas em mensagens normais!) */}
                        {!item.jogo && (
                          <View className="flex-row items-center justify-end gap-1 mt-1">
                            {item.editadaEm && !isApagada && (
                              <Text className={`text-[9.5px] font-bold mr-0.5 ${isMe ? "text-indigo-300" : "text-zinc-400"}`}>editado</Text>
                            )}
                            <Text className={`text-[10px] font-mono ${isApagada ? "text-red-300 font-bold" : isMe ? "text-indigo-300" : "text-zinc-500"}`}>
                              {formatTime(item.timestamp)}
                            </Text>
                            {/* Confirmação de Leitura nas MINHAS mensagens (Estilo WhatsApp) */}
                            {isMe && !isApagada && (
                              isLida ? (
                                <CheckCheck size={13} color="#38bdf8" />
                              ) : (
                                <Check size={13} color="#71717a" />
                              )
                            )}
                          </View>
                        )}
                      </Pressable>

                      {/* Pílulas de Reações da Mensagem */}
                      {item.reacoes && Object.keys(item.reacoes).length > 0 && (
                        <View className={`flex-row items-center gap-1 mt-0.5 px-1 flex-wrap ${isMe ? "justify-end" : "justify-start"}`}>
                          {Object.entries((item.reacoes || {}) as Record<string, string[]>).map(([emoji, userIds]) => {
                            if (!userIds || userIds.length === 0) return null;
                            const isMyReaction = Boolean(myUserId && userIds.includes(myUserId));
                            return (
                              <Pressable
                                key={emoji}
                                onPress={() => alternarReacao(item.id, emoji)}
                                onLongPress={() => setWhoReactedModal({ visible: true, emoji, msg: item })}
                                className={`flex-row items-center gap-1 px-2 py-0.5 rounded-full border ${
                                  isMyReaction ? "bg-purple-500/25 border-purple-500/60" : "bg-zinc-900/90 border-zinc-800"
                                }`}
                              >
                                <Text className="text-[11px]">{emoji}</Text>
                                <Text className={`text-[9.5px] font-bold ${isMyReaction ? "text-purple-300" : "text-zinc-400"}`}>
                                  {userIds.length}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      )}
                      </SwipeableMessageRow>
                    )}
                  </View>
                );
              }}
              ListHeaderComponent={
                  activeUploads.filter(u => u.dest === "direto").length > 0 ? (
                    <View className="py-2">
                      {activeUploads
                        .filter(u => u.dest === "direto")
                        .map(u => (
                          <PixelArcadeUploadCard
                            key={u.id}
                            imageUri={u.uri}
                            progress={u.progress}
                            phaseText={u.phase}
                            isMural={false}
                          />
                        ))}
                    </View>
                  ) : null
                }
              />

              {/* Input de Mensagem com Banner de Resposta Slim */}
              <View className="px-3 pt-2 pb-2.5 bg-[#0d0d12] border-t border-zinc-800">
                {/* Banner de Resposta (Quote) no Chat Direto */}
                {replyingToDirect && (
                  <View className="mb-2 px-3 py-1.5 bg-[#12121e] border border-indigo-500/40 rounded-xl flex-row items-center justify-between shadow-sm">
                    <View className="flex-row items-center gap-2 flex-1 min-w-0 mr-2">
                      <CornerDownRight size={13} color="#818cf8" />
                      <View className="flex-1 min-w-0">
                        <Text 
                          className="text-[11px] font-black uppercase text-indigo-300" 
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          Respondendo a {replyingToDirect.remetenteUsername ? `@${replyingToDirect.remetenteUsername.replace(/^@/, "")}` : replyingToDirect.remetenteNome}
                        </Text>
                        <Text 
                          className="text-[10px] text-zinc-400" 
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          "{replyingToDirect.texto || "📷 Foto"}"
                        </Text>
                      </View>
                    </View>
                    <Pressable 
                      onPress={() => setReplyingToDirect(null)}
                      className="h-6 w-6 rounded-full bg-zinc-800 items-center justify-center active:scale-95"
                      hitSlop={6}
                    >
                      <X size={12} color="#a1a1aa" />
                    </Pressable>
                  </View>
                )}

                {/* Banner de Edição no Chat Direto */}
                {editingMsg && !editingMsg.isMural && (
                  <View className="mb-2 px-3 py-1.5 bg-indigo-500/15 border border-indigo-500/30 rounded-xl flex-row items-center justify-between">
                    <View className="flex-row items-center gap-2 flex-1 min-w-0 mr-2">
                      <Edit2 size={13} color="#818cf8" />
                      <Text className="text-xs text-indigo-300 font-bold truncate">Editando mensagem...</Text>
                    </View>
                    <Pressable 
                      onPress={() => { setEditingMsg(null); setTextoMensagem(""); }}
                      className="h-6 w-6 rounded-full bg-zinc-800 items-center justify-center active:scale-95"
                      hitSlop={6}
                    >
                      <X size={12} color="#a1a1aa" />
                    </Pressable>
                  </View>
                )}

                {/* Tray de Anexos Pendentes no Chat Direto (Estilo Discord) */}
                {anexosDireto.length > 0 && (
                  <View className="mb-2 p-2 bg-[#09090c] border border-indigo-500/30 rounded-xl flex-row items-center gap-2">
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, alignItems: "center" }}>
                      {anexosDireto.map((anx, idx) => (
                        <View key={anx.id} className="relative">
                          <Image 
                            source={{ uri: anx.uri }} 
                            className="h-14 w-14 rounded-lg border border-indigo-500/40" 
                            resizeMode="cover" 
                          />
                          <Pressable
                            onPress={() => {
                              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              setAnexosDireto(prev => prev.filter(a => a.id !== anx.id));
                            }}
                            hitSlop={8}
                            className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-red-600 border border-black items-center justify-center shadow-md active:scale-90"
                          >
                            <X size={10} color="#ffffff" strokeWidth={3} />
                          </Pressable>
                          <View className="absolute bottom-0.5 left-0.5 px-1 rounded bg-black/70">
                            <Text className="text-[8px] font-mono text-indigo-300 font-bold">#{idx + 1}</Text>
                          </View>
                        </View>
                      ))}
                      <Pressable
                        onPress={handlePickAnexoDireto}
                        className="h-14 w-14 rounded-lg border border-dashed border-zinc-700 bg-zinc-900/50 items-center justify-center active:scale-95"
                      >
                        <Plus size={16} color="#818cf8" />
                        <Text className="text-[8px] font-bold text-indigo-300 mt-0.5">+ Foto</Text>
                      </Pressable>
                    </ScrollView>
                    <Pressable
                      onPress={() => setAnexosDireto([])}
                      className="px-2 py-1 rounded-md bg-zinc-800/80 active:bg-zinc-700 self-center"
                    >
                      <Text className="text-[9.5px] font-bold text-zinc-400">Limpar</Text>
                    </Pressable>
                  </View>
                )}

                <View className="flex-row items-center gap-2">
                  <Pressable 
                    onPress={handlePickAnexoDireto}
                    disabled={isUploadingPhoto}
                    className="h-11 w-11 rounded-xl bg-[#14141c] border border-zinc-800 items-center justify-center active:scale-95 shadow-md"
                  >
                    {isUploadingPhoto ? (
                      <ActivityIndicator size="small" color="#818cf8" />
                    ) : (
                      <ImageIcon size={17} color="#a1a1aa" />
                    )}
                  </Pressable>

                  <TextInput 
                    ref={directInputRef}
                    placeholder="Escreva ou digite /jogos..."
                    placeholderTextColor="#52525b"
                    value={textoMensagem}
                    onChangeText={handleTextoMensagemChange}
                    onSubmitEditing={handleEnviarDireto}
                    style={{ textAlignVertical: "center", paddingVertical: 0 }}
                    className="flex-1 h-11 bg-[#14141c] border border-zinc-800 rounded-xl px-3.5 text-xs text-white"
                  />

                  <Pressable 
                    onPress={() => {
                      if (textoMensagem.trim().length > 0 || anexosDireto.length > 0) {
                        handleEnviarDireto();
                      } else {
                        handleSecretSendTap();
                      }
                    }}
                    className={`h-11 w-11 rounded-xl items-center justify-center active:scale-95 shadow-md ${
                      textoMensagem.trim().length > 0 || anexosDireto.length > 0 ? "bg-indigo-600" : "bg-zinc-800 opacity-60"
                    }`}
                  >
                    <Send size={16} color={textoMensagem.trim().length > 0 || anexosDireto.length > 0 ? "#ffffff" : "#71717a"} />
                  </Pressable>
                </View>
              </View>

            </View>
          ) : null}

          </View>
        </SafeAreaView>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 0: EDITAR MEU PERFIL (UNIFICADO COM DRIVE, CARGOS, RECADO & STATUS) */}
      {/* ========================================================================= */}
      {modalEditProfileVisible && (
        <ProfileModal 
          visible={modalEditProfileVisible} 
          onClose={() => setModalEditProfileVisible(false)} 
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL GAMES HUB 1v1: HUB DE JOGOS DA EQUIPE (/jogos ou /games) */}
      {/* ========================================================================= */}
      {modalJogosVisible && (
        <GamesHubModal
          visible={modalJogosVisible}
          onClose={() => setModalJogosVisible(false)}
          activeContact={activeContact}
          onIniciarJogo={iniciarJogo}
          onAbrirDesafioTermoCustom={() => {
            setCustomPalavraInput("");
            setCustomDicaInput("");
            setTermoCustomVisible(true);
          }}
          onAbrirDesafioForcaCustom={() => {
            setForcaPalavraInput("");
            setForcaTemaInput("");
            setForcaDicaInput("");
            setForcaCustomVisible(true);
          }}
          onToast={setToast}
        />
      )}

      {/* Modal para Criar Palavra Personalizada do Termo */}
      {termoCustomVisible && (
        <Modal visible={termoCustomVisible} animationType="fade" transparent onRequestClose={() => setTermoCustomVisible(false)}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            className="flex-1 bg-black/85 items-center justify-center p-4"
          >
            <View className="w-full max-w-[360px] bg-[#0d0e14] border border-purple-500/40 rounded-[28px] p-5 shadow-2xl gap-4">
              <View className="flex-row items-center justify-between pb-2 border-b border-zinc-800">
                <View className="flex-row items-center gap-2">
                  <View className="h-8 w-8 rounded-xl bg-purple-500/20 border border-purple-500/40 items-center justify-center">
                    <Sparkles size={16} color="#c084fc" />
                  </View>
                  <View>
                    <Text className="text-sm font-black uppercase tracking-wider text-white">Desafio Secreto</Text>
                    <Text className="text-[10px] text-purple-300 font-medium">Você escolhe a palavra para o amigo!</Text>
                  </View>
                </View>
                <Pressable onPress={() => setTermoCustomVisible(false)} className="h-7 w-7 rounded-full bg-zinc-900 border border-zinc-800 items-center justify-center">
                  <X size={14} color="#a1a1aa" />
                </Pressable>
              </View>

              <View className="gap-3">
                <View className="gap-1">
                  <Text className="text-[11px] font-black uppercase text-zinc-300">Palavra Secreta (5 Letras):</Text>
                  <TextInput
                    value={customPalavraInput}
                    onChangeText={(txt) => setCustomPalavraInput(txt.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 5))}
                    placeholder="EX: LIVRO"
                    placeholderTextColor="#52525b"
                    maxLength={5}
                    autoCapitalize="characters"
                    className="h-11 px-3 rounded-xl bg-zinc-900 border border-purple-500/40 text-center font-black text-lg tracking-widest text-white"
                  />
                  <Text className="text-[10px] text-zinc-500 text-right">{customPalavraInput.length}/5 letras</Text>
                </View>

                <View className="gap-1">
                  <Text className="text-[11px] font-black uppercase text-zinc-300">Dica Opcional:</Text>
                  <TextInput
                    value={customDicaInput}
                    onChangeText={setCustomDicaInput}
                    placeholder="Ex: Objeto, fruta, animal..."
                    placeholderTextColor="#52525b"
                    maxLength={35}
                    className="h-10 px-3 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-200"
                  />
                </View>
              </View>

              <Pressable
                onPress={() => {
                  if (customPalavraInput.trim().length !== 5) {
                    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                    setToast({
                      type: "warning",
                      title: "5 Letras Exatas",
                      message: "A palavra secreta precisa ter exatamente 5 letras!"
                    });
                    return;
                  }
                  if (activeContact) {
                    void iniciarJogo(activeContact, "termo_versus", customPalavraInput.trim(), customDicaInput.trim() || undefined);
                    setTermoCustomVisible(false);
                    setToast({
                      type: "success",
                      title: "Desafio Enviado! 🎯",
                      message: `@${activeContact.username} terá que adivinhar "${customPalavraInput}"!`
                    });
                  }
                }}
                disabled={customPalavraInput.length !== 5}
                className={`py-3 rounded-xl items-center justify-center ${
                  customPalavraInput.length === 5 ? "bg-purple-600 border border-purple-400" : "bg-zinc-800 border border-zinc-700 opacity-50"
                }`}
              >
                <Text className="text-xs font-black uppercase tracking-wider text-white">Enviar Desafio</Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      )}

      {/* Modal para Criar Desafio do Jogo da Forca */}
      {forcaCustomVisible && (
        <Modal visible={forcaCustomVisible} animationType="fade" transparent onRequestClose={() => setForcaCustomVisible(false)}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            className="flex-1 bg-black/85 items-center justify-center p-4"
          >
            <View className="w-full max-w-[360px] bg-[#0a0d18] border border-cyan-500/40 rounded-[28px] p-5 shadow-2xl gap-4">
              <View className="flex-row items-center justify-between pb-2 border-b border-cyan-950">
                <View className="flex-row items-center gap-2">
                  <View className="h-8 w-8 rounded-xl bg-cyan-500/20 border border-cyan-500/40 items-center justify-center">
                    <HelpCircle size={16} color="#38bdf8" />
                  </View>
                  <View>
                    <Text className="text-sm font-black uppercase tracking-wider text-white">Criar Forca 1v1</Text>
                    <Text className="text-[10px] text-cyan-300 font-medium">Você cria o enigma e dá pistas quando quiser!</Text>
                  </View>
                </View>
                <Pressable onPress={() => setForcaCustomVisible(false)} className="h-7 w-7 rounded-full bg-zinc-900 border border-zinc-800 items-center justify-center">
                  <X size={14} color="#a1a1aa" />
                </Pressable>
              </View>

              <View className="gap-3">
                <View className="gap-1">
                  <Text className="text-[11px] font-black uppercase text-zinc-300">Palavra Secreta (3 a 15 letras):</Text>
                  <TextInput
                    value={forcaPalavraInput}
                    onChangeText={(txt) => setForcaPalavraInput(txt.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 15))}
                    placeholder="EX: COMPUTADOR"
                    placeholderTextColor="#52525b"
                    maxLength={15}
                    autoCapitalize="characters"
                    className="h-11 px-3 rounded-xl bg-zinc-900 border border-cyan-500/40 text-center font-black text-base tracking-widest text-white"
                  />
                  <Text className="text-[10px] text-zinc-500 text-right">{forcaPalavraInput.length}/15 letras</Text>
                </View>

                <View className="gap-1">
                  <Text className="text-[11px] font-black uppercase text-zinc-300">Tema / Categoria:</Text>
                  <TextInput
                    value={forcaTemaInput}
                    onChangeText={setForcaTemaInput}
                    placeholder="Ex: Tecnologia, Fruta, Objeto..."
                    placeholderTextColor="#52525b"
                    maxLength={25}
                    className="h-10 px-3 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-200"
                  />
                </View>

                <View className="gap-1">
                  <Text className="text-[11px] font-black uppercase text-zinc-300">Primeira Dica (Opcional):</Text>
                  <TextInput
                    value={forcaDicaInput}
                    onChangeText={setForcaDicaInput}
                    placeholder="Ex: Muito usado em escritórios..."
                    placeholderTextColor="#52525b"
                    maxLength={50}
                    className="h-10 px-3 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-200"
                  />
                </View>
              </View>

              <Pressable
                onPress={() => {
                  if (activeContact && forcaPalavraInput.trim().length >= 3) {
                    void iniciarJogo(
                      activeContact, 
                      "forca", 
                      forcaPalavraInput.trim(), 
                      forcaDicaInput.trim() || undefined,
                      forcaTemaInput.trim() || undefined
                    );
                    setForcaCustomVisible(false);
                    setToast({
                      type: "success",
                      title: "Forca Criada! 🪢",
                      message: `@${activeContact.username} terá que adivinhar a palavra de ${forcaPalavraInput.length} letras!`
                    });
                  }
                }}
                disabled={forcaPalavraInput.length < 3}
                className={`py-3 rounded-xl items-center justify-center ${
                  forcaPalavraInput.length >= 3 ? "bg-cyan-500 border border-cyan-300" : "bg-zinc-800 border border-zinc-700 opacity-50"
                }`}
              >
                <Text className="text-xs font-black uppercase tracking-wider text-cyan-950">Iniciar Partida na Forca</Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: ADICIONAR CONTATO POR @USERNAME */}
      {/* ========================================================================= */}
      {modalAddVisible && (
        <Modal visible={modalAddVisible} animationType="fade" transparent onRequestClose={() => setModalAddVisible(false)}>
          <View className="flex-1 bg-black/85 items-center justify-center p-4">
            <View className="w-full max-w-[390px] bg-[#0d0d12] border border-zinc-800 rounded-[32px] p-6 shadow-2xl gap-4">
              
              <View className="flex-row items-center justify-between pb-3 border-b border-zinc-800">
                <View className="flex-row items-center gap-3">
                  <View className="h-9 w-9 rounded-xl bg-indigo-500/20 border border-indigo-500/40 items-center justify-center">
                    <UserPlus size={18} color="#818cf8" />
                  </View>
                  <View>
                    <Text className="text-sm font-black uppercase tracking-wider text-white">Adicionar Contato</Text>
                    <Text className="text-xs text-zinc-400 font-medium">Busca direta por @username</Text>
                  </View>
                </View>
                <Pressable onPress={() => setModalAddVisible(false)} className="h-8 w-8 rounded-full bg-zinc-900 border border-zinc-800 items-center justify-center">
                  <X size={15} color="#a1a1aa" />
                </Pressable>
              </View>

              <View className="gap-2">
                <Text className="text-xs font-black uppercase tracking-wider text-zinc-400">Tag do Usuário</Text>
                <View className="h-12 bg-[#09090c] border border-indigo-500/50 rounded-2xl px-4 flex-row items-center gap-2">
                  <Text className="text-indigo-400 font-mono font-bold text-base">@</Text>
                  <TextInput 
                    placeholder="digite a tag (ex: marcos_caixa)"
                    placeholderTextColor="#52525b"
                    value={inputTagBusca}
                    onChangeText={setInputTagBusca}
                    autoCapitalize="none"
                    className="flex-1 text-sm text-white font-mono font-bold"
                  />
                </View>
              </View>

              <View className="flex-row gap-2.5 pt-1">
                <Pressable onPress={() => setModalAddVisible(false)} className="flex-1 h-12 rounded-xl bg-zinc-900 border border-zinc-800 items-center justify-center">
                  <Text className="text-zinc-400 text-xs font-black uppercase">Cancelar</Text>
                </Pressable>
                <Pressable onPress={handleBuscarTag} className="flex-1 h-12 rounded-xl bg-indigo-600 items-center justify-center shadow-lg active:scale-95">
                  {isSearchingUser ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text className="text-white text-xs font-black uppercase">Conectar</Text>
                  )}
                </Pressable>
              </View>

            </View>
          </View>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: COFRE DE AUTORIDADE / PIN MESTRE SECRETO */}
      {/* ========================================================================= */}
      {modalPinVisible && (
        <Modal visible={modalPinVisible} animationType="fade" transparent onRequestClose={() => setModalPinVisible(false)}>
          <View className="flex-1 bg-black/90 items-center justify-center p-4">
            <View className="w-full max-w-[390px] bg-[#0d0d12] border-2 border-amber-500/50 rounded-[36px] p-6 shadow-2xl gap-4 items-center">
              
              <View className="w-full flex-row items-center justify-between pb-2 border-b border-zinc-800">
                <View className="flex-row items-center gap-2.5">
                  <View className="h-8 w-8 rounded-lg bg-amber-500/20 items-center justify-center">
                    <ShieldCheck size={18} color="#fbbf24" />
                  </View>
                  <Text className="text-sm font-black uppercase tracking-wider text-white">Chave de Autoridade</Text>
                </View>
                <Pressable onPress={() => setModalPinVisible(false)} className="h-8 w-8 rounded-full bg-zinc-900 border border-zinc-800 items-center justify-center">
                  <X size={15} color="#a1a1aa" />
                </Pressable>
              </View>

              <View className="items-center">
                <Text className="text-sm font-black uppercase text-amber-300">Autenticação Mestra</Text>
                <Text className="text-xs text-zinc-400 mt-1 text-center">
                  Insira o código de segurança de 4 dígitos para obter privilégios de Administrador.
                </Text>
              </View>

              {/* Input com Teclado Nativo */}
              <View className="w-full py-3 items-center">
                <TextInput
                  ref={pinInputRef}
                  autoFocus={true}
                  value={pinValue}
                  onChangeText={(val) => {
                    const clean = val.replace(/[^0-9]/g, "").slice(0, 4);
                    setPinValue(clean);
                    if (clean.length === 4) {
                      void handleValidarPin(clean);
                    }
                  }}
                  maxLength={4}
                  keyboardType="number-pad"
                  secureTextEntry={true}
                  placeholder="••••"
                  placeholderTextColor="#52525b"
                  textAlign="center"
                  className="w-48 h-16 bg-[#09090c] border-2 border-amber-500/60 rounded-2xl text-2xl font-mono font-black text-amber-300 tracking-[14px] text-center"
                />
              </View>

              <View className="flex-row gap-2.5 w-full pt-2">
                <Pressable onPress={() => { setModalPinVisible(false); setPinValue(""); }} className="flex-1 h-12 rounded-xl bg-zinc-900 border border-zinc-800 items-center justify-center active:bg-zinc-800">
                  <Text className="text-zinc-400 text-xs font-black uppercase">Cancelar</Text>
                </Pressable>
                <Pressable 
                  onPress={() => handleValidarPin(pinValue)}
                  disabled={pinValue.length < 4}
                  className={`flex-1 h-12 rounded-xl items-center justify-center shadow-lg active:scale-95 ${
                    pinValue.length === 4 ? "bg-amber-500" : "bg-zinc-800 opacity-50"
                  }`}
                >
                  <Text className={`text-xs font-black uppercase ${pinValue.length === 4 ? "text-zinc-950 font-bold" : "text-zinc-500"}`}>
                    Autenticar
                  </Text>
                </Pressable>
              </View>

            </View>
          </View>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* MODAL CONTEXTUAL: LONG PRESS NA MENSAGEM (EMOJI BAR + AÇÕES COM LUCIDE) */}
      {/* ========================================================================= */}
      {Boolean(selectedMessage) && (
        <Modal
          visible={Boolean(selectedMessage)}
          transparent
          animationType="fade"
          onRequestClose={() => setSelectedMessage(null)}
        >
        <Pressable 
          onPress={() => setSelectedMessage(null)}
          className="flex-1 bg-black/80 justify-end p-4"
          style={{ paddingBottom: Math.max(insets.bottom, 16) }}
        >
          <Pressable 
            onPress={(e) => e.stopPropagation()}
            className="w-full max-w-[400px] mx-auto gap-2.5"
          >
            {/* 1. Emoji Quick Reactions Bar */}
            <View className="p-2 rounded-2xl bg-[#12121c] border border-zinc-800 flex-row items-center justify-around shadow-2xl">
              {["❤️", "👍", "🔥", "😂", "😮", "👏"].map(emoji => (
                <Pressable
                  key={emoji}
                  onPress={() => {
                    if (selectedMessage) {
                      alternarReacao(selectedMessage.id, emoji);
                      setSelectedMessage(null);
                    }
                  }}
                  className="h-10 w-10 rounded-xl items-center justify-center active:bg-zinc-800 active:scale-125"
                >
                  <Text className="text-xl">{emoji}</Text>
                </Pressable>
              ))}
            </View>

            {/* 2. Cartão de Ações com Ícones Lucide (Scrollável em telas compactas para evitar corte) */}
            <View className="rounded-2xl bg-[#12121c] border border-zinc-800 overflow-hidden shadow-2xl">
              <ScrollView 
                showsVerticalScrollIndicator={false}
                bounces={false}
                style={{ maxHeight: Dimensions.get('window').height * 0.52 }}
                contentContainerStyle={{ flexGrow: 0 }}
              >
                <View className="divide-y divide-zinc-800/60">
                  {/* Responder */}
                  <Pressable
                    onPress={() => {
                      if (selectedMessage) {
                        setReplyingToDirect(selectedMessage);
                        setSelectedMessage(null);
                        setTimeout(() => directInputRef.current?.focus(), 150);
                      }
                    }}
                    className="w-full px-4 py-3 flex-row items-center justify-between active:bg-zinc-800/60"
                  >
                    <View className="flex-row items-center gap-3">
                      <View className="w-7 h-7 rounded-lg bg-indigo-500/20 items-center justify-center">
                        <CornerDownRight size={15} color="#818cf8" />
                      </View>
                      <Text className="text-xs font-bold text-white uppercase tracking-wider">Responder</Text>
                    </View>
                    <Text className="text-[10px] font-mono text-zinc-500">Swipe</Text>
                  </Pressable>

                  {/* Copiar Texto */}
                  {selectedMessage?.texto ? (
                    <Pressable
                      onPress={() => {
                        if (selectedMessage?.texto) {
                          copiarTextoParaClipboard(selectedMessage.texto, "Texto copiado para a área de transferência!");
                          setSelectedMessage(null);
                        }
                      }}
                      className="w-full px-4 py-3 flex-row items-center gap-3 active:bg-zinc-800/60"
                    >
                      <View className="w-7 h-7 rounded-lg bg-zinc-800 items-center justify-center">
                        <Copy size={14} color="#d4d4d8" />
                      </View>
                      <Text className="text-xs font-bold text-white uppercase tracking-wider">Copiar Texto</Text>
                    </Pressable>
                  ) : null}

                  {/* Selecionar Mensagens */}
                  <Pressable
                    onPress={() => {
                      if (selectedMessage) {
                        setSelectedMessageIds(new Set([selectedMessage.id]));
                        setSelectedMessage(null);
                      }
                    }}
                    className="w-full px-4 py-3 flex-row items-center gap-3 active:bg-zinc-800/60"
                  >
                    <View className="w-7 h-7 rounded-lg bg-indigo-500/20 items-center justify-center">
                      <CheckSquare size={14} color="#818cf8" />
                    </View>
                    <Text className="text-xs font-bold text-white uppercase tracking-wider">Selecionar</Text>
                  </Pressable>

                  {/* Editar Mensagem (Apenas se for MINHA mensagem) */}
                  {selectedMessage?.remetenteId === myUserId && !selectedMessage?.apagadaEm ? (
                    <Pressable
                      onPress={() => {
                        if (selectedMessage) {
                          setEditingMsg({ id: selectedMessage.id, texto: selectedMessage.texto, isMural: false });
                          setTextoMensagem(selectedMessage.texto);
                          setSelectedMessage(null);
                          setTimeout(() => directInputRef.current?.focus(), 150);
                        }
                      }}
                      className="w-full px-4 py-3 flex-row items-center gap-3 active:bg-zinc-800/60"
                    >
                      <View className="w-7 h-7 rounded-lg bg-purple-500/20 items-center justify-center">
                        <Edit2 size={14} color="#c084fc" />
                      </View>
                      <Text className="text-xs font-bold text-white uppercase tracking-wider">Editar Mensagem</Text>
                    </Pressable>
                  ) : null}

                  {/* Fixar Mensagem */}
                  <Pressable
                    onPress={() => {
                      if (selectedMessage) {
                        alternarFixarMensagem(selectedMessage.id, !selectedMessage.isPinned);
                        setSelectedMessage(null);
                        setToast({
                          type: "info",
                          title: selectedMessage.isPinned ? "Mensagem Desafixada" : "Mensagem Fixada",
                          message: selectedMessage.isPinned ? "O aviso foi removido do topo." : "A mensagem foi fixada no topo do mural."
                        });
                      }
                    }}
                    className="w-full px-4 py-3 flex-row items-center gap-3 active:bg-zinc-800/60"
                  >
                    <View className="w-7 h-7 rounded-lg bg-amber-500/20 items-center justify-center">
                      <Pin size={14} color="#fbbf24" />
                    </View>
                    <Text className="text-xs font-bold text-white uppercase tracking-wider">
                      {selectedMessage?.isPinned ? "Desafixar Mensagem" : "Fixar Mensagem"}
                    </Text>
                  </Pressable>

                  {/* Gerenciar Admin de Outro Usuário (Exclusivo Admin) */}
                  {Boolean(isAdmin && selectedMessage?.remetenteId && selectedMessage?.remetenteId !== myUserId) && (
                    <Pressable
                      onPress={async () => {
                        if (selectedMessage) {
                          const targetId = selectedMessage.remetenteId;
                          const targetDisplay = getOperatorDisplay(
                            targetId, 
                            selectedMessage.remetenteUsername, 
                            selectedMessage.remetenteNome, 
                            selectedMessage.remetenteCargo
                          );
                          const isTargetAdmin = Boolean(targetDisplay.isAdmin);
                          setSelectedMessage(null);
                          await alternarAdminUsuario(targetId, !isTargetAdmin);
                          setToast({
                            type: isTargetAdmin ? "info" : "success",
                            title: isTargetAdmin ? "Admin Revogado 🛡️" : "Admin Concedido 👑",
                            message: isTargetAdmin 
                              ? `@${targetDisplay.username} agora é Atendente padrão.` 
                              : `@${targetDisplay.username} agora tem privilégios de Administrador.`
                          });
                        }
                      }}
                      className="w-full px-4 py-3 flex-row items-center gap-3 active:bg-zinc-800/60"
                    >
                      <View className="w-7 h-7 rounded-lg bg-amber-500/20 items-center justify-center">
                        <Crown size={14} color="#f59e0b" />
                      </View>
                      <View className="flex-1">
                        <Text className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                          {selectedMessage && getOperatorDisplay(selectedMessage.remetenteId).isAdmin ? "Revogar Permissão Admin" : "Promover a Administrador"}
                        </Text>
                      </View>
                    </Pressable>
                  )}

                  {/* Informações de Leitura (APENAS se for MINHA mensagem!) */}
                  {selectedMessage?.remetenteId === myUserId && (
                    <Pressable
                      onPress={() => {
                        if (selectedMessage) {
                          const msg = selectedMessage;
                          setSelectedMessage(null);
                          setAdminSeenByModal({ visible: true, msg });
                        }
                      }}
                      className="w-full px-4 py-3 flex-row items-center justify-between active:bg-zinc-800/60"
                    >
                      <View className="flex-row items-center gap-3">
                        <View className="w-7 h-7 rounded-lg bg-emerald-500/20 items-center justify-center">
                          <CheckCheck size={14} color="#34d399" />
                        </View>
                        <Text className="text-xs font-bold text-white uppercase tracking-wider">Status de Leitura</Text>
                      </View>
                      <Text className="text-[10px] font-mono text-emerald-400 font-bold">
                        {selectedMessage.lidasPor && activeContact && selectedMessage.lidasPor.includes(activeContact.id) ? "Lida" : "Entregue"}
                      </Text>
                    </Pressable>
                  )}

                  {/* Opção 1: Apagar para Mim (Sempre disponível para QUALQUER mensagem) */}
                  <Pressable
                    onPress={() => {
                      const msg = selectedMessage;
                      setSelectedMessage(null);
                      if (!msg) return;

                      solicitarExclusao(
                        "Apagar para Mim",
                        "Deseja ocultar esta mensagem da sua visualização neste dispositivo?",
                        async () => {
                          await apagarParaMim(msg.id);
                          setToast({ type: "info", title: "Mensagem Ocultada", message: "A mensagem foi removida da sua visualização." });
                        }
                      );
                    }}
                    className="w-full px-4 py-3 flex-row items-center gap-3 active:bg-red-500/20"
                  >
                    <View className="w-7 h-7 rounded-lg bg-red-500/20 items-center justify-center">
                      <Trash2 size={14} color="#f87171" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-xs font-bold text-red-400 uppercase tracking-wider">
                        Apagar para Mim
                      </Text>
                      <Text className="text-[10px] text-zinc-500 font-medium">
                        Oculta apenas no seu dispositivo
                      </Text>
                    </View>
                  </Pressable>

                  {/* Opção 2: Apagar para Todos (Disponível se for o remetente ou Admin) */}
                  {(selectedMessage?.remetenteId === myUserId || isAdmin) && (
                    <Pressable
                      onPress={() => {
                        const msg = selectedMessage;
                        setSelectedMessage(null);
                        if (!msg) return;

                        solicitarExclusao(
                          "Apagar para Todos",
                          "Deseja apagar esta mensagem para ambos nesta conversa?",
                          async () => {
                            await apagarMensagem(msg.id);
                            setToast({ type: "info", title: "Mensagem Apagada", message: "A mensagem foi apagada para ambos." });
                          }
                        );
                      }}
                      className="w-full px-4 py-3 flex-row items-center gap-3 active:bg-red-500/20"
                    >
                      <View className="w-7 h-7 rounded-lg bg-red-600/25 items-center justify-center">
                        <Trash2 size={14} color="#ef4444" />
                      </View>
                      <View className="flex-1">
                        <Text className="text-xs font-bold text-red-400 uppercase tracking-wider">
                          Apagar para Todos
                        </Text>
                        <Text className="text-[10px] text-zinc-500 font-medium">
                          Apaga para ambos nesta conversa
                        </Text>
                      </View>
                    </Pressable>
                  )}

                  {/* Purga Permanente do Banco de Dados (Exclusivo Administrador no Modo Secreto) */}
                  {Boolean(isAdmin && secretMode) && (
                    <Pressable
                      onPress={() => {
                        if (selectedMessage) {
                          const msgId = selectedMessage.id;
                          setSelectedMessage(null);
                          solicitarPurgaPermanenteAdmin(msgId);
                        }
                      }}
                      className="w-full px-4 py-3 flex-row items-center justify-between active:bg-red-500/20"
                    >
                      <View className="flex-row items-center gap-3">
                        <View className="w-7 h-7 rounded-lg bg-red-500/20 items-center justify-center">
                          <Trash2 size={14} color="#ef4444" />
                        </View>
                        <Text className="text-xs font-bold text-red-400 uppercase tracking-wider">Purgar do Banco (Admin)</Text>
                      </View>
                      <View className="px-1.5 py-0.5 rounded bg-red-500/10 border border-red-500/30">
                        <Text className="text-[9px] font-mono text-red-400 font-bold">Físico</Text>
                      </View>
                    </Pressable>
                  )}
                </View>
              </ScrollView>
            </View>

            {/* Botão Fechar */}
            <Pressable
              onPress={() => setSelectedMessage(null)}
              className="w-full py-3 rounded-2xl bg-zinc-900 border border-zinc-800 items-center justify-center active:scale-95 shadow-md"
            >
              <Text className="text-xs font-black uppercase tracking-wider text-zinc-300">Fechar</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: VISUALIZADOR DE FOTOS AVANÇADO (CYBERPUNK OLED • PINCH, PAN, ZOOM, ROTATE, SHARE & SAVE) */}
      {/* ========================================================================= */}
      {Boolean(fullscreenImage) && (
        <AdvancedPhotoViewer 
          visible={Boolean(fullscreenImage)}
          imageUri={fullscreenImage}
          images={fullscreenImagesList}
          initialIndex={fullscreenInitialIndex}
          meta={fullscreenMeta}
          onClose={() => {
            setFullscreenImage(null);
            setFullscreenImagesList([]);
            setFullscreenInitialIndex(0);
            setFullscreenMeta(null);
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: CONFIRMAÇÃO DE EXCLUSÃO (1 ETAPA PADRÃO / 2 ETAPAS PERMANENTE) */}
      {/* ========================================================================= */}
      {modalDelete.visible && (
        <Modal 
          visible={modalDelete.visible} 
          animationType="fade" 
          transparent 
          onRequestClose={() => setModalDelete({ visible: false, step: 1, isPermanent: false, title: "", message: "", onConfirm: () => {} })}
        >
        <View className="flex-1 bg-black/90 items-center justify-center p-6">
          <View className="w-full max-w-[380px] bg-[#0d0d12] border border-zinc-800 rounded-[36px] p-6 shadow-2xl gap-5">
            
            {/* Top Indicator */}
            <View className="items-center pt-0 pb-1">
              <View className="w-10 h-1 rounded-full bg-zinc-800" />
            </View>

            {/* Header com Ícone em Badge e Botão Fechar */}
            <View className="flex-row items-center justify-between pb-3 border-b border-zinc-900">
              <View className="flex-row items-center gap-3">
                <View className={`h-10 w-10 rounded-2xl items-center justify-center border ${
                  modalDelete.isPermanent 
                    ? "bg-amber-500/10 border-amber-500/20" 
                    : "bg-red-500/10 border-red-500/20"
                }`}>
                  {modalDelete.isPermanent ? (
                    <AlertTriangle size={18} color="#fbbf24" strokeWidth={2.2} />
                  ) : (
                    <Trash2 size={18} color="#f87171" strokeWidth={2.2} />
                  )}
                </View>
                <View>
                  <Text className="text-[10px] font-black uppercase tracking-[2px] text-zinc-500">
                    {modalDelete.isPermanent ? `Etapa ${modalDelete.step} de 2 • Purga Física` : "Exclusão"}
                  </Text>
                  <Text className="text-sm font-black uppercase text-zinc-100">
                    {modalDelete.isPermanent 
                      ? (modalDelete.step === 1 ? "Purgar do Servidor?" : "Confirmação Final") 
                      : (modalDelete.title || "Apagar Registro")}
                  </Text>
                </View>
              </View>
              <Pressable 
                onPress={() => setModalDelete({ visible: false, step: 1, isPermanent: false, title: "", message: "", onConfirm: () => {} })}
                className="h-8 w-8 bg-zinc-900 rounded-full items-center justify-center border border-zinc-800 active:bg-zinc-800"
              >
                <X size={15} color="#a1a1aa" />
              </Pressable>
            </View>

            {/* Card Interno de Detalhes (Fundo Escuro e Alerta) */}
            <View className="bg-[#09090c] rounded-[24px] p-4 border border-zinc-900/80 gap-3">
              <View className={`border p-3.5 rounded-2xl flex-row items-start gap-2.5 ${
                modalDelete.isPermanent
                  ? (modalDelete.step === 1 ? "bg-amber-500/10 border-amber-500/20" : "bg-red-500/15 border-red-500/30")
                  : "bg-red-500/10 border-red-500/20"
              }`}>
                <AlertTriangle 
                  size={16} 
                  color={modalDelete.isPermanent && modalDelete.step === 1 ? "#fbbf24" : "#f87171"} 
                  className="mt-0.5" 
                />
                <View className="flex-1">
                  <Text className={`text-[9px] font-black uppercase tracking-widest mb-1 ${
                    modalDelete.isPermanent && modalDelete.step === 1 ? "text-amber-400" : "text-red-400"
                  }`}>
                    {modalDelete.isPermanent 
                      ? (modalDelete.step === 1 ? "Atenção Administrador" : "Ação Irreversível") 
                      : "Confirmação"}
                  </Text>
                  <Text className="text-xs font-bold text-zinc-300 leading-relaxed">
                    {modalDelete.isPermanent 
                      ? (modalDelete.step === 1 
                          ? "Etapa 1 de 2: Esta ação removerá definitivamente o documento do banco de dados no Firestore para todos os operadores sem deixar avisos." 
                          : "Etapa 2 de 2: Tem certeza absoluta? Os dados desta mensagem serão purgados permanentemente sem possibilidade de auditoria.")
                      : (modalDelete.message || "Deseja realmente apagar esta mensagem?")}
                  </Text>
                </View>
              </View>
            </View>

            {/* Botões de Ação */}
            <View className="flex-row gap-2.5 w-full pt-1">
              <Pressable 
                onPress={() => setModalDelete({ visible: false, step: 1, isPermanent: false, title: "", message: "", onConfirm: () => {} })}
                className="flex-1 py-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 items-center justify-center active:bg-zinc-800 active:scale-95"
              >
                <Text className="text-zinc-400 text-xs font-black uppercase tracking-wider">Cancelar</Text>
              </Pressable>

              {modalDelete.isPermanent && modalDelete.step === 1 ? (
                <Pressable 
                  onPress={() => setModalDelete(prev => ({ ...prev, step: 2 }))}
                  className="flex-1 py-3.5 rounded-2xl bg-amber-500/20 border border-amber-500/40 items-center justify-center shadow-lg active:scale-95 flex-row gap-2"
                >
                  <Text className="text-amber-300 text-xs font-black uppercase tracking-wider">Avançar (2/2)</Text>
                </Pressable>
              ) : (
                <Pressable 
                  onPress={() => {
                    const cb = modalDelete.onConfirm;
                    setModalDelete({ visible: false, step: 1, isPermanent: false, title: "", message: "", onConfirm: () => {} });
                    cb();
                  }}
                  className="flex-1 py-3.5 rounded-2xl bg-red-500/20 border border-red-500/40 items-center justify-center shadow-lg active:scale-95 flex-row gap-2"
                >
                  <Trash2 size={13} color="#f87171" strokeWidth={2.2} />
                  <Text className="text-red-300 text-xs font-black uppercase tracking-wider">
                    {modalDelete.isPermanent ? "Purgar Agora" : "Excluir"}
                  </Text>
                </Pressable>
              )}
            </View>

          </View>
        </View>
      </Modal>
      )}

      {/* ========================================================================= */}
      {/* MODAL 6: QUEM REAGIU (DETALHES DE REAÇÃO & BOTÃO DE REMOVER) */}
      {/* ========================================================================= */}
      {whoReactedModal.visible && (
        <Modal
          visible={whoReactedModal.visible}
          animationType="fade"
          transparent
          onRequestClose={() => setWhoReactedModal({ visible: false, emoji: "❤️", msg: null })}
        >
        <Pressable 
          onPress={() => setWhoReactedModal({ visible: false, emoji: "❤️", msg: null })}
          className="flex-1 bg-black/80 items-center justify-end p-4"
        >
          <Pressable 
            onPress={(e) => e.stopPropagation()}
            className="w-full max-w-[420px] bg-[#121218] border-t-2 border-purple-500/50 rounded-t-[32px] p-5 shadow-2xl gap-4 max-h-[75%]"
          >
            {/* Header */}
            <View className="flex-row items-center justify-between pb-3 border-b border-zinc-800">
              <View className="flex-row items-center gap-2">
                <Text className="text-xl">{whoReactedModal.emoji}</Text>
                <Text className="text-sm font-black text-white uppercase tracking-wider">
                  Quem Reagiu com {whoReactedModal.emoji}
                </Text>
              </View>
              <Pressable
                onPress={() => setWhoReactedModal({ visible: false, emoji: "❤️", msg: null })}
                className="h-8 w-8 rounded-full bg-zinc-900 border border-zinc-800 items-center justify-center"
              >
                <X size={15} color="#a1a1aa" />
              </Pressable>
            </View>

            {/* Lista de Operadores que Reagiram */}
            <ScrollView className="max-h-80" contentContainerStyle={{ gap: 8 }}>
              {(() => {
                const userIds = (whoReactedModal.msg?.reacoes?.[whoReactedModal.emoji] || []);
                const myReactionActive = Boolean(myUserId && userIds.includes(myUserId));

                return (
                  <>
                    {/* Se o próprio usuário reagiu */}
                    {myReactionActive && (
                      <View className="p-3 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex-col gap-2">
                        <View className="flex-row items-center justify-between">
                          <View className="flex-row items-center gap-2.5">
                            <View className="h-8 w-8 rounded-xl bg-purple-500/20 border border-purple-500/40 items-center justify-center">
                              <Text className="text-purple-300 font-black text-xs">
                                {operatorName.substring(0, 2).toUpperCase()}
                              </Text>
                            </View>
                            <View>
                              <Text className="text-xs font-black text-white">{operatorName} (Você)</Text>
                              <Text className="text-[10px] font-mono text-purple-300">@{myUsername}</Text>
                            </View>
                          </View>
                          <Text className="text-lg">{whoReactedModal.emoji}</Text>
                        </View>

                        {/* Botão de Remover Minha Reação */}
                        <Pressable
                          onPress={() => {
                            if (whoReactedModal.msg) {
                              alternarReacao(whoReactedModal.msg.id, whoReactedModal.emoji);
                            }
                            setWhoReactedModal({ visible: false, emoji: "❤️", msg: null });
                          }}
                          className="w-full py-2 rounded-xl bg-red-500/15 border border-red-500/30 flex-row items-center justify-center gap-1.5 active:scale-95"
                        >
                          <Trash2 size={13} color="#f87171" />
                          <Text className="text-red-300 text-xs font-black uppercase tracking-wider">
                            Remover Minha Reação ({whoReactedModal.emoji})
                          </Text>
                        </Pressable>
                      </View>
                    )}

                    {/* Outros usuários */}
                    {userIds.map((uid, idx) => {
                      if (uid === myUserId) return null;
                      const op = getOperatorDisplay(uid);

                      return (
                        <View
                          key={idx}
                          className="flex-row items-center justify-between p-2.5 rounded-xl bg-[#181822] border border-zinc-800/80"
                        >
                          <View className="flex-row items-center gap-2.5">
                            <View className="h-8 w-8 rounded-xl bg-purple-500/20 border border-purple-500/40 items-center justify-center">
                              <Text className="text-purple-300 font-black text-xs">
                                {op.initials}
                              </Text>
                            </View>
                            <View>
                              <Text className="text-xs font-black text-white">{op.displayName}</Text>
                              <Text className="text-[10px] font-mono text-purple-400">@{op.username}</Text>
                            </View>
                          </View>
                          <Text className="text-lg">{whoReactedModal.emoji}</Text>
                        </View>
                      );
                    })}

                    {userIds.length === 0 && (
                      <Text className="text-center text-xs text-zinc-500 py-4">Ninguém reagiu com este emoji ainda.</Text>
                    )}
                  </>
                );
              })()}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
      )}

      {/* ========================================================================= */}
      {/* MODAL 7: AUDITORIA ADMIN SECRETA (QUEM VISUALIZOU A MENSAGEM) */}
      {/* ========================================================================= */}
      {adminSeenByModal.visible && (
        <Modal
          visible={adminSeenByModal.visible}
          animationType="fade"
          transparent
          onRequestClose={() => setAdminSeenByModal({ visible: false, msg: null })}
        >
        <Pressable 
          onPress={() => setAdminSeenByModal({ visible: false, msg: null })}
          className="flex-1 bg-black/90 items-center justify-end p-4"
        >
          <Pressable 
            onPress={(e) => e.stopPropagation()}
            className="w-full max-w-[420px] bg-[#121218] border-t-2 border-amber-500/60 rounded-t-[32px] p-5 shadow-2xl gap-4 max-h-[80%]"
          >
            {/* Header */}
            <View className="flex-row items-center justify-between pb-3 border-b border-amber-500/20">
              <View className="flex-row items-center gap-2">
                <View className="h-8 w-8 rounded-xl bg-amber-500/20 border border-amber-500/40 items-center justify-center">
                  <ShieldCheck size={18} color="#f59e0b" />
                </View>
                <View>
                  <Text className="text-[10px] font-mono text-amber-400 font-bold uppercase">Auditoria Admin Secreta</Text>
                  <Text className="text-sm font-black text-white uppercase tracking-wider">Quem Visualizou</Text>
                </View>
              </View>
              <Pressable
                onPress={() => setAdminSeenByModal({ visible: false, msg: null })}
                className="h-8 w-8 rounded-full bg-zinc-900 border border-zinc-800 items-center justify-center"
              >
                <X size={15} color="#a1a1aa" />
              </Pressable>
            </View>

            <View className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex-row items-center gap-2">
              <Eye size={16} color="#f59e0b" />
              <Text className="text-[11px] font-mono text-amber-300 flex-1">
                Desbloqueado pelo Gesto de 5 Toques. Visível apenas para Administradores.
              </Text>
            </View>

            {/* Lista de Leitores */}
            <ScrollView className="max-h-80" contentContainerStyle={{ gap: 8 }}>
              {(() => {
                const lidas = adminSeenByModal.msg?.lidasPor || [];
                return (
                  <>
                    {lidas.map((uid, idx) => {
                      const op = getOperatorDisplay(uid);

                      return (
                        <View
                          key={idx}
                          className="flex-row items-center justify-between p-2.5 rounded-xl bg-[#181822] border border-zinc-800/80"
                        >
                          <View className="flex-row items-center gap-2.5">
                            <View className="h-8 w-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 items-center justify-center">
                              <Text className="text-emerald-300 font-black text-xs">
                                {op.initials}
                              </Text>
                            </View>
                            <View>
                              <Text className="text-xs font-black text-white">{op.displayName}</Text>
                              <Text className="text-[10px] font-mono text-emerald-400">@{op.username}</Text>
                            </View>
                          </View>
                          <View className="items-end">
                            <Text className="text-[10px] font-mono text-emerald-400 font-bold">Visualizado</Text>
                            <Text className="text-[9px] font-mono text-zinc-500">Confirmado</Text>
                          </View>
                        </View>
                      );
                    })}

                    {lidas.length === 0 && (
                      <Text className="text-center text-xs text-zinc-500 py-4">Nenhum operador visualizou ainda.</Text>
                    )}
                  </>
                );
              })()}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
      )}

      {/* ========================================================================= */}
      {/* MODAL 8: PERFIL COMPLETO DO OPERADOR (COLEGAS DA EQUIPE) */}
      {/* ========================================================================= */}
      {Boolean(viewingUserProfile) && (
        <Modal
          visible={Boolean(viewingUserProfile)}
          transparent
          animationType="fade"
          onRequestClose={() => setViewingUserProfile(null)}
        >
        <Pressable 
          onPress={() => setViewingUserProfile(null)}
          className="flex-1 bg-black/85 items-center justify-center p-4"
        >
          <Pressable 
            onPress={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-[#0d0d12] border border-zinc-800 rounded-3xl p-5 shadow-2xl"
          >
            {/* Header com título e botão fechar */}
            <View className="flex-row items-center justify-between mb-4 pb-2 border-b border-zinc-800/80">
              <Text className="text-xs font-black uppercase tracking-wider text-zinc-400">
                Perfil do Operador
              </Text>
              <Pressable 
                onPress={() => setViewingUserProfile(null)} 
                hitSlop={10}
                className="h-7 w-7 rounded-full bg-zinc-900 border border-zinc-800 items-center justify-center active:scale-95"
              >
                <X size={14} color="#a1a1aa" />
              </Pressable>
            </View>

            {/* Foto e Informações Principais */}
            <View className="items-center mb-4">
              <View className="relative mb-3">
                <View className="h-20 w-20 rounded-3xl bg-purple-500/20 border-2 border-purple-500/40 items-center justify-center overflow-hidden shadow-lg">
                  {viewingUserProfile?.photoUrl ? (
                    <Image 
                      source={{ uri: formatGoogleDriveThumbnailUrl(viewingUserProfile.photoUrl, 160) }} 
                      className="w-full h-full" 
                      resizeMode="cover" 
                    />
                  ) : (
                    <Text className="text-purple-300 font-black text-2xl">
                      {(viewingUserProfile?.displayName || "AT").substring(0, 2).toUpperCase()}
                    </Text>
                  )}
                </View>
                <View className={`absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-2 border-[#0d0d12] ${
                  viewingUserProfile?.isOnline ? "bg-emerald-500" : "bg-zinc-600"
                }`} />
              </View>

              <Text className="text-lg font-black text-white uppercase tracking-wider text-center" numberOfLines={1}>
                {viewingUserProfile?.displayName}
              </Text>
              
              <View className="flex-row items-center gap-1.5 mt-1">
                <Text className="text-xs font-mono text-purple-400 font-bold">
                  @{viewingUserProfile?.username}
                </Text>
                <Pressable 
                  onPress={() => {
                    if (viewingUserProfile?.username) {
                      Clipboard.setString(`@${viewingUserProfile.username}`);
                      setToast({ type: "success", title: "Tag Copiada", message: `@${viewingUserProfile.username} copiado!` });
                    }
                  }} 
                  hitSlop={8}
                >
                  <Copy size={12} color="#71717a" />
                </Pressable>
              </View>

              {/* Badges de Cargo e Status */}
              <View className="flex-row items-center gap-2 mt-3 flex-wrap justify-center">
                {renderCargoBadge(viewingUserProfile?.cargo, viewingUserProfile?.isAdmin)}
                {renderStatusPresetBadge(viewingUserProfile?.statusPreset)}
              </View>
            </View>

            {/* Recado / Frase de Ênfase */}
            {viewingUserProfile?.recado ? (
              <View className="bg-amber-500/10 border border-amber-500/25 rounded-2xl p-3.5 mb-4">
                <View className="flex-row items-center gap-1.5 mb-1">
                  <Megaphone size={12} color="#fbbf24" />
                  <Text className="text-[10px] font-black uppercase text-amber-300 tracking-wider">
                    Recado do Operador
                  </Text>
                </View>
                <Text className="text-xs text-amber-200 font-medium italic leading-relaxed">
                  "{viewingUserProfile.recado}"
                </Text>
              </View>
            ) : null}

            {/* Presença / Visto por Último */}
            <View className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-2.5 mb-4 flex-row items-center justify-between">
              <Text className="text-[11px] text-zinc-400 font-medium">Status de Presença</Text>
              <Text className="text-[11px] font-bold text-zinc-300">
                {renderPresenceText(viewingUserProfile || undefined)}
              </Text>
            </View>

            {/* Botão de Ação: Iniciar Conversa (oculta se já estiver no privado com esse contato) */}
            {viewingUserProfile && viewingUserProfile.id !== myUserId && (!activeContact || activeContact.id !== viewingUserProfile.id) && (
              <Pressable
                onPress={() => {
                  const target = viewingUserProfile;
                  setViewingUserProfile(null);
                  setActiveContact(target);
                }}
                className="w-full h-11 rounded-xl bg-purple-600 active:bg-purple-700 items-center justify-center flex-row gap-2"
              >
                <MessageSquare size={16} color="#ffffff" />
                <Text className="text-xs font-black text-white uppercase tracking-wider">
                  Conversar no Privado
                </Text>
              </Pressable>
            )}
          </Pressable>
        </Pressable>
      </Modal>
      )}

      <CustomToast toast={toast} onDismiss={() => setToast(null)} />
    </>
  );
}

export const ChatModal: React.FC<ChatModalProps> = (props) => {
  if (!props.visible) {
    return null;
  }

  return <ChatModalComponent {...props} />;
};

