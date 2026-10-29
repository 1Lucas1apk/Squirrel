import React, { useState, useEffect } from "react";
import { 
  View, 
  Text, 
  TextInput, 
  Pressable, 
  Modal, 
  ScrollView, 
  Platform, 
  ActivityIndicator,
  Clipboard,
  KeyboardAvoidingView,
  Image
} from "react-native";
import { 
  UserCheck, 
  X, 
  Check, 
  Sparkles, 
  AtSign, 
  Store, 
  ShieldCheck, 
  Mail, 
  Copy, 
  Smile,
  Zap,
  Lock,
  Coffee,
  Crown,
  Camera,
  Trash2,
  Briefcase,
  Tag,
  Bike,
  Terminal,
  Megaphone,
  Bell,
  KeyRound,
  ChevronRight
} from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { useAuth } from "../../hooks/use-auth";
import { useAppSettings } from "../../hooks/use-app-settings";
import { useChat } from "../../hooks/use-chat";
import { formatGoogleDriveThumbnailUrl, cacheDriveImage } from "../../services/google-drive-direct-service";
import { uploadImagemParaServidor } from "../../services/media-upload-service";
import { DEV_UID, DEV_EMAIL } from "../../services/repositories/chat-repository";
import { verificarDisponibilidadeUsername } from "../../services/repositories/chat-repository";
import { testarDiagnosticoNotificacoes } from "../../services/push-notification-service";
import { CustomToast, ToastConfig } from "../common/custom-toast";
import { SecurityModal } from "./security-modal";

interface ProfileModalProps {
  visible: boolean;
  onClose: () => void;
  caixaId?: string;
}

const STATUS_PRESETS = [
  { id: "disponivel", label: "Disponível", icon: Zap, color: "#34d399", bg: "bg-emerald-500/15 border-emerald-500/30 text-emerald-300" },
  { id: "fechamento", label: "Fechando", icon: Lock, color: "#fbbf24", bg: "bg-amber-500/15 border-amber-500/30 text-amber-300" },
  { id: "pausa", label: "Pausa", icon: Coffee, color: "#38bdf8", bg: "bg-sky-500/15 border-sky-500/30 text-sky-300" },
  { id: "foco", label: "Foco Total", icon: Sparkles, color: "#c084fc", bg: "bg-purple-500/15 border-purple-500/30 text-purple-300" },
];

export function ProfileModal({ visible, onClose, caixaId = "01" }: ProfileModalProps) {
  const { user } = useAuth();
  const { settings } = useAppSettings();
  const { 
    myUserId, 
    myUsername, 
    operatorName, 
    operatorCargo, 
    operatorRecado,
    operatorStatusPreset,
    myPhotoUrl, 
    atualizarMeuPerfil, 
    isAdmin, 
    alternarAdminUsuario 
  } = useChat();

  const [nome, setNome] = useState(operatorName);
  const [username, setUsername] = useState(myUsername);
  const [cargo, setCargo] = useState(operatorCargo || "atendente");
  const [recado, setRecado] = useState(operatorRecado || "");
  const [photoUrl, setPhotoUrl] = useState<string | null>(myPhotoUrl || null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState(operatorStatusPreset || "disponivel");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<ToastConfig | null>(null);
  const [isTestingPush, setIsTestingPush] = useState(false);
  const [modalSeguranca, setModalSeguranca] = useState(false);

  const handleTestarNotificacao = async () => {
    setIsTestingPush(true);
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const res = await testarDiagnosticoNotificacoes(myUserId, username);
      if (res.permissionGranted) {
        setToast({
          type: "success",
          title: "Notificações 100% Ativas! 🔔",
          message: `Canal OK ✅ | Token FCM Gerado ✅ | Notificação Disparada ✅`
        });
      } else {
        setToast({
          type: "error",
          title: "Permissão Necessária",
          message: res.error || "Habilite as notificações do Squirrel nas configurações do Android."
        });
      }
    } catch (e: any) {
      setToast({
        type: "error",
        title: "Erro no Diagnóstico",
        message: e?.message || "Não foi possível testar as notificações."
      });
    } finally {
      setIsTestingPush(false);
    }
  };

  // Validação de username em tempo real
  const [checkStatus, setCheckStatus] = useState<"idle" | "checking" | "available" | "unavailable">("idle");
  const [checkMessage, setCheckMessage] = useState("");

  useEffect(() => {
    if (visible) {
      setNome(operatorName);
      setUsername(myUsername);
      setCargo(operatorCargo || (isAdmin ? "admin" : "atendente"));
      setRecado(operatorRecado || "");
      setSelectedStatus(operatorStatusPreset || "disponivel");
      setPhotoUrl(myPhotoUrl || null);
      setCheckStatus("idle");
      setCheckMessage("");
      setToast(null);
    }
  }, [visible, operatorName, myUsername, operatorCargo, operatorRecado, operatorStatusPreset, myPhotoUrl, isAdmin]);

  // Checagem de disponibilidade com debounce
  useEffect(() => {
    const clean = username.toLowerCase().replace(/[^a-z0-9_]/g, "").trim();
    const cleanOld = myUsername ? myUsername.toLowerCase().replace(/[^a-z0-9_]/g, "").trim() : "";
    if (!clean || clean === cleanOld) {
      setCheckStatus("idle");
      setCheckMessage("");
      return;
    }

    if (clean.length < 3) {
      setCheckStatus("unavailable");
      setCheckMessage("Mínimo 3 letras");
      return;
    }

    setCheckStatus("checking");
    const timer = setTimeout(async () => {
      try {
        const res = await verificarDisponibilidadeUsername(clean, myUserId);
        if (res.disponivel) {
          setCheckStatus("available");
          setCheckMessage("Disponível");
        } else {
          setCheckStatus("unavailable");
          setCheckMessage(res.motivo || "Já em uso");
        }
      } catch {
        setCheckStatus("idle");
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [username, myUsername, myUserId]);

  const triggerHaptic = (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) => {
    if (settings.hapticsEnabled && Platform.OS !== "web") {
      void Haptics.impactAsync(style);
    }
  };

  const handleCopyTag = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    Clipboard.setString(`@${username.replace(/^@/, "")}`);
    setCopied(true);
    setToast({ type: "success", title: "Tag Copiada", message: `@${username.replace(/^@/, "")} copiado para a área de transferência.` });
    setTimeout(() => setCopied(false), 2000);
  };

  // Upload de Foto de Perfil
  const handlePickPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        setToast({
          type: "warning",
          title: "Permissão Necessária",
          message: "Permita o acesso às fotos para alterar sua imagem."
        });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setIsUploadingPhoto(true);
        const uploadRes = await uploadImagemParaServidor(asset.uri, {
          operador: username || "avatar",
          tipo: "avatar"
        });
        setIsUploadingPhoto(false);

        if (uploadRes.success && uploadRes.url) {
          if (asset.base64) {
            void cacheDriveImage(uploadRes.url, asset.base64);
          }
          setPhotoUrl(uploadRes.url);
          setToast({
            type: "success",
            title: "Foto Carregada",
            message: "Foto de perfil pronta! Clique em Salvar Perfil."
          });
        } else if (asset.base64) {
          const fallbackDataUrl = `data:image/jpeg;base64,${asset.base64}`;
          setPhotoUrl(fallbackDataUrl);
        }
      }
    } catch (err: any) {
      setIsUploadingPhoto(false);
      setToast({
        type: "error",
        title: "Erro ao Carregar Foto",
        message: err.message || "Não foi possível carregar a imagem."
      });
    }
  };

  const handleSalvar = async () => {
    const cleanNome = nome.trim();
    const cleanUser = username.toLowerCase().replace(/[^a-z0-9_]/g, "").trim();
    const cleanOld = myUsername ? myUsername.toLowerCase().replace(/[^a-z0-9_]/g, "").trim() : "";

    if (!cleanNome) {
      triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
      setToast({ type: "error", title: "Nome Obrigatório", message: "Por favor, digite seu nome ou apelido." });
      return;
    }

    if (cleanUser.length < 3) {
      triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
      setToast({ type: "error", title: "Tag Curta", message: "O @username deve ter pelo menos 3 caracteres." });
      return;
    }

    if (checkStatus === "unavailable" && cleanUser !== cleanOld) {
      triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
      setToast({ type: "error", title: "Tag Indisponível", message: checkMessage || "Escolha outro @username." });
      return;
    }

    setSaving(true);
    triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);

    const finalCargo = (!isDevUser && (cargo.toLowerCase() === "dev" || cargo.toLowerCase() === "desenvolvedor"))
      ? (isAdmin ? "admin" : "atendente")
      : cargo;

    try {
      // 1. Atualiza Perfil na Nuvem (Firestore) e no store local indexado por usuário
      const res = await atualizarMeuPerfil(cleanNome, cleanUser, finalCargo, photoUrl, recado, selectedStatus);

      if (!res.success) {
        setToast({ type: "error", title: "Erro ao Salvar", message: res.error || "Não foi possível atualizar o perfil." });
        setSaving(false);
        return;
      }

      if (Platform.OS !== "web") {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      onClose();
    } catch (e: any) {
      setToast({ type: "error", title: "Erro de Conexão", message: e?.message || "Tente novamente mais tarde." });
    } finally {
      setSaving(false);
    }
  };

  const firstNome = (nome.trim() || "Operador").split(" ")[0];

  const isDevUser = Boolean(
    (user?.email && user.email.toLowerCase().trim() === DEV_EMAIL) ||
    user?.uid === DEV_UID
  );

  const CARGOS_LIST = [
    { id: "atendente", label: "Atendente", icon: UserCheck, color: "#c084fc", bg: "bg-purple-500/15 border-purple-500/30", text: "text-purple-300", locked: false },
    { id: "gerente", label: "Gerente", icon: Briefcase, color: "#60a5fa", bg: "bg-blue-500/15 border-blue-500/30", text: "text-blue-300", locked: false },
    { id: "vendedor", label: "Vendedor", icon: Tag, color: "#34d399", bg: "bg-emerald-500/15 border-emerald-500/30", text: "text-emerald-300", locked: false },
    { id: "entregador", label: "Entregador", icon: Bike, color: "#fbbf24", bg: "bg-amber-500/15 border-amber-500/30", text: "text-amber-300", locked: false },
    { id: "admin", label: "Admin", icon: Crown, color: "#f59e0b", bg: "bg-amber-500/20 border-amber-500/40", text: "text-amber-300", locked: !isAdmin, badge: !isAdmin ? "BLOQUEADO" : "ATIVO" },
    { id: "dev", label: "Dev", icon: Terminal, color: "#38bdf8", bg: "bg-cyan-500/20 border-cyan-500/40", text: "text-cyan-300", locked: !isDevUser, badge: isDevUser ? "OFICIAL" : "BLOQUEADO" },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 bg-black/90 items-center justify-center p-4"
      >
        <View className="w-full max-w-[420px] max-h-[92%] bg-[#0d0d12] border border-zinc-800 rounded-[36px] p-5 shadow-2xl flex-col">
          
          {/* TOP HANDLE */}
          <View className="items-center pt-0 pb-1.5">
            <View className="w-10 h-1 rounded-full bg-zinc-800" />
          </View>

          {/* HEADER */}
          <View className="flex-row items-center justify-between pb-3 border-b border-zinc-900 mb-3">
            <View className="flex-row items-center gap-3">
              <View className="h-10 w-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 items-center justify-center">
                <UserCheck size={18} color="#fbbf24" strokeWidth={2.4} />
              </View>
              <View>
                <View className="flex-row items-center gap-1.5">
                  <Text className="text-[10.5px] font-black uppercase tracking-[2px] text-zinc-500">Squirrel</Text>
                  {isAdmin ? (
                    <View className="px-2 py-0.5 rounded bg-amber-500/20 flex-row items-center gap-1 border border-amber-500/30">
                      <Crown size={9} color="#f59e0b" />
                      <Text className="text-amber-400 text-[9px] font-black uppercase">ADMIN</Text>
                    </View>
                  ) : (
                    <View className="px-2 py-0.5 rounded bg-purple-500/20">
                      <Text className="text-purple-400 text-[9px] font-black uppercase">{cargo}</Text>
                    </View>
                  )}
                </View>
                <Text className="text-sm font-black text-zinc-100 uppercase tracking-wider">
                  Editar Meu Perfil
                </Text>
              </View>
            </View>

            <Pressable
              onPress={() => {
                triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
                onClose();
              }}
              hitSlop={10}
              className="h-8.5 w-8.5 rounded-full bg-zinc-900 border border-zinc-800 items-center justify-center active:bg-zinc-800"
            >
              <X size={16} color="#a1a1aa" />
            </Pressable>
          </View>

          <ScrollView 
            showsVerticalScrollIndicator={false} 
            contentContainerStyle={{ gap: 14, paddingBottom: 10 }}
            keyboardShouldPersistTaps="handled"
          >
            
            {/* 1. LIVE PREVIEW DO CABEÇALHO & CHAT */}
            <View className="bg-[#121216] border border-zinc-800/80 rounded-2xl p-3 gap-2">
              <View className="flex-row items-center justify-between">
                <Text className="text-[10px] font-black uppercase tracking-[1.5px] text-zinc-500">
                  Prévia no Topo do App & Chat
                </Text>
                <View className="flex-row items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30">
                  <View className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  <Text className="text-[9px] font-black font-mono text-emerald-400">ONLINE</Text>
                </View>
              </View>

              <View className="bg-[#09090c] border border-zinc-800/90 rounded-xl p-2.5 flex-row items-center gap-2.5">
                <View className="relative flex-shrink-0">
                  <View className="h-10 w-10 rounded-xl bg-zinc-900 border border-zinc-800 items-center justify-center overflow-hidden shadow-sm">
                    {photoUrl ? (
                      <Image 
                        source={{ uri: formatGoogleDriveThumbnailUrl(photoUrl, 160) }}
                        className="w-full h-full"
                        resizeMode="cover"
                      />
                    ) : (
                      <Text className="text-indigo-300 font-black text-sm">
                        {(firstNome || "OP").substring(0, 2).toUpperCase()}
                      </Text>
                    )}
                  </View>
                  <View className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-[#09090c] bg-emerald-500" />
                </View>
                <View className="flex-1 min-w-0">
                  <View className="flex-row items-center gap-1.5">
                    <Text className="text-xs font-black uppercase tracking-wider text-white truncate">
                      {firstNome}
                    </Text>
                    <View className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700">
                      <Text className="text-[8.5px] font-black uppercase tracking-wider text-zinc-300 font-mono">
                        @{username.replace(/^@/, "")}
                      </Text>
                    </View>
                  </View>
                  {recado.trim() ? (
                    <Text className="text-[10px] text-amber-300 font-medium truncate mt-0.5" numberOfLines={1}>
                      "{recado.trim()}"
                    </Text>
                  ) : (
                    <Text className="text-[10px] font-black uppercase tracking-wider text-zinc-400 mt-0.5">
                      CAIXA {caixaId} • HOJE
                    </Text>
                  )}
                </View>
              </View>
            </View>

            {/* 2. FOTO DE PERFIL (UPLOAD GOOGLE DRIVE + REMOVER) */}
            <View className="bg-[#09090c] border border-zinc-800/80 rounded-2xl p-3.5 flex-row items-center gap-3.5">
              <View className="relative flex-shrink-0">
                <View className="h-14 w-14 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 items-center justify-center overflow-hidden shadow-md">
                  {photoUrl ? (
                    <Image 
                      source={{ uri: formatGoogleDriveThumbnailUrl(photoUrl, 160) }} 
                      className="w-full h-full" 
                      resizeMode="cover" 
                    />
                  ) : (
                    <Text className="text-indigo-300 font-black text-lg">
                      {(nome || operatorName || "AT").substring(0, 2).toUpperCase()}
                    </Text>
                  )}
                </View>
                {isUploadingPhoto && (
                  <View className="absolute inset-0 bg-black/70 rounded-2xl items-center justify-center">
                    <ActivityIndicator size="small" color="#818cf8" />
                  </View>
                )}
              </View>

              <View className="flex-1 gap-1.5">
                <Text className="text-xs font-black uppercase tracking-wider text-zinc-300">Foto de Perfil</Text>
                <View className="flex-row items-center gap-2">
                  <Pressable
                    onPress={handlePickPhoto}
                    disabled={isUploadingPhoto}
                    className="flex-1 py-2 px-3 rounded-xl bg-indigo-600 border border-indigo-500 flex-row items-center justify-center gap-1.5 active:scale-95 shadow-sm"
                  >
                    <Camera size={13} color="#ffffff" />
                    <Text className="text-white text-xs font-bold uppercase tracking-wider">
                      {photoUrl ? "Alterar" : "Escolher"}
                    </Text>
                  </Pressable>

                  {photoUrl && (
                    <Pressable
                      onPress={() => {
                        triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
                        setPhotoUrl(null);
                        setToast({ type: "info", title: "Foto Removida", message: "Clique em Salvar Perfil para confirmar a remoção." });
                      }}
                      className="py-2 px-3 rounded-xl bg-zinc-900 border border-zinc-800 active:scale-95"
                    >
                      <Trash2 size={13} color="#f87171" />
                    </Pressable>
                  )}
                </View>
              </View>
            </View>

            {/* 3. FORMULÁRIO DE IDENTIDADE */}
            <View className="gap-3">
              
              {/* CAMPO 1: NOME / APELIDO */}
              <View className="gap-1">
                <Text className="text-xs font-black uppercase tracking-wider text-zinc-400 px-1">
                  Nome de Guerra / Apelido
                </Text>
                <View className="h-12 bg-[#09090c] border border-zinc-800 rounded-2xl px-3 flex-row items-center gap-2.5">
                  <Smile size={16} color="#fbbf24" />
                  <TextInput
                    value={nome}
                    onChangeText={setNome}
                    placeholder="Ex: Wini, Lucas..."
                    placeholderTextColor="#52525b"
                    maxLength={30}
                    className="flex-1 text-sm font-bold text-white"
                  />
                </View>
              </View>

              {/* CAMPO 2: TAG @USERNAME */}
              <View className="gap-1">
                <View className="flex-row items-center justify-between px-1">
                  <Text className="text-[10.5px] font-black uppercase tracking-wider text-zinc-400">
                    Tag do Squirrel (@username)
                  </Text>
                  {checkStatus === "checking" && (
                    <Text className="text-[9px] font-bold text-sky-400 font-mono">Verificando...</Text>
                  )}
                  {checkStatus === "available" && (
                    <Text className="text-[9px] font-black text-emerald-400 font-mono">✓ Disponível</Text>
                  )}
                  {checkStatus === "unavailable" && (
                    <Text className="text-[9px] font-black text-red-400 font-mono">✕ {checkMessage}</Text>
                  )}
                </View>
                <View className="h-12 bg-[#09090c] border border-zinc-800 rounded-2xl px-3 flex-row items-center gap-2">
                  <AtSign size={16} color="#a1a1aa" />
                  <TextInput
                    value={username}
                    onChangeText={(val) => setUsername(val.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                    placeholder="ex: wini"
                    placeholderTextColor="#52525b"
                    autoCapitalize="none"
                    maxLength={25}
                    className="flex-1 text-sm font-black font-mono text-amber-400"
                  />
                  <Pressable
                    onPress={handleCopyTag}
                    hitSlop={8}
                    className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 flex-row items-center gap-1 active:bg-zinc-800"
                  >
                    {copied ? (
                      <Check size={11} color="#34d399" />
                    ) : (
                      <Copy size={11} color="#a1a1aa" />
                    )}
                    <Text className="text-[8.5px] font-black font-mono text-zinc-300">
                      {copied ? "COPIADO" : "COPIAR"}
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* CAMPO 3: SELEÇÃO DE CARGO / FUNÇÃO NA EQUIPE */}
              <View className="gap-1.5 pt-0.5">
                <Text className="text-[10.5px] font-black uppercase tracking-wider text-zinc-400 px-1">
                  Cargo / Função na Equipe
                </Text>
                
                <View className="flex-row flex-wrap gap-2">
                  {CARGOS_LIST.map((item) => {
                    const IconC = item.icon;
                    const isSelected = cargo.toLowerCase() === item.id.toLowerCase();
                    return (
                      <Pressable
                        key={item.id}
                        onPress={() => {
                          if (item.id === "dev") {
                            if (!isDevUser) {
                              triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
                              setToast({ 
                                type: "error", 
                                title: "🔒 Acesso Bloqueado", 
                                message: "A insígnia e funções Dev são exclusivas da conta oficial @dev." 
                              });
                              return;
                            }
                            triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
                            setCargo("dev");
                            setToast({ type: "success", title: "Conta Dev Oficial! 💻", message: "Selo [ >_ DEV ] ativo." });
                            return;
                          }
                          if (item.id === "admin" && !isAdmin) {
                            triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
                            setToast({ type: "warning", title: "🔒 Acesso Bloqueado", message: "Para se tornar Admin, use o PIN Mestre no Chat." });
                            return;
                          }
                          triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
                          setCargo(item.id);
                        }}
                        style={{ width: "48%" }}
                        className={`h-11 px-3 rounded-xl border flex-row items-center justify-between active:scale-95 ${
                          isSelected
                            ? `${item.bg} border-2`
                            : item.locked
                            ? "bg-[#09090c]/70 border-zinc-800/60 opacity-60"
                            : "bg-[#09090c] border-zinc-800"
                        }`}
                      >
                        <View className="flex-row items-center gap-2">
                          <IconC size={14} color={item.color} />
                          <Text className={`text-xs font-black uppercase tracking-wider ${isSelected ? item.text : "text-zinc-300"}`}>
                            {item.label}
                          </Text>
                        </View>
                        {item.locked ? (
                          <Lock size={11} color="#71717a" />
                        ) : isSelected ? (
                          <Check size={13} color={item.color} strokeWidth={3} />
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* CAMPO 4: RECADO DO OPERADOR / FRASE DE ÊNFASE */}
              <View className="gap-1.5 pt-0.5">
                <View className="flex-row items-center justify-between px-1">
                  <Text className="text-[10.5px] font-black uppercase tracking-wider text-zinc-400">
                    Recado do Operador / Frase de Ênfase
                  </Text>
                  <Text className="text-[9px] font-mono text-zinc-500">
                    {recado.length}/60
                  </Text>
                </View>
                <View className="h-12 bg-[#09090c] border border-zinc-800 focus:border-indigo-500 rounded-2xl px-3 flex-row items-center gap-2.5">
                  <Megaphone size={16} color="#fbbf24" />
                  <TextInput
                    value={recado}
                    onChangeText={(t) => setRecado(t.slice(0, 60))}
                    placeholder="Ex: Foco nas vendas de hoje 🚀"
                    placeholderTextColor="#52525b"
                    className="flex-1 text-sm font-medium text-white"
                  />
                  {recado.length > 0 && (
                    <Pressable onPress={() => setRecado("")} hitSlop={6}>
                      <X size={14} color="#71717a" />
                    </Pressable>
                  )}
                </View>
              </View>

              {/* CAMPO 5: STATUS RÁPIDO */}
              <View className="gap-1.5 pt-0.5">
                <Text className="text-[10.5px] font-black uppercase tracking-wider text-zinc-400 px-1">
                  Status Operacional
                </Text>
                
                {/* Linha 1 de Status */}
                <View className="flex-row gap-2">
                  {STATUS_PRESETS.slice(0, 2).map((preset) => {
                    const IconC = preset.icon;
                    const isSelected = selectedStatus === preset.id;
                    return (
                      <Pressable
                        key={preset.id}
                        onPress={() => {
                          triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
                          setSelectedStatus(preset.id);
                        }}
                        className={`flex-1 p-2.5 rounded-xl border flex-row items-center justify-center gap-1.5 ${
                          isSelected
                            ? preset.bg
                            : "bg-[#09090c] border-zinc-800 active:bg-zinc-900"
                        }`}
                      >
                        <IconC size={12} color={preset.color} />
                        <Text className="text-[10px] font-black uppercase tracking-wider text-zinc-200">
                          {preset.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Linha 2 de Status */}
                <View className="flex-row gap-2">
                  {STATUS_PRESETS.slice(2, 4).map((preset) => {
                    const IconC = preset.icon;
                    const isSelected = selectedStatus === preset.id;
                    return (
                      <Pressable
                        key={preset.id}
                        onPress={() => {
                          triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
                          setSelectedStatus(preset.id);
                        }}
                        className={`flex-1 p-2.5 rounded-xl border flex-row items-center justify-center gap-1.5 ${
                          isSelected
                            ? preset.bg
                            : "bg-[#09090c] border-zinc-800 active:bg-zinc-900"
                        }`}
                      >
                        <IconC size={12} color={preset.color} />
                        <Text className="text-[10px] font-black uppercase tracking-wider text-zinc-200">
                          {preset.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* 6. CONTA VINCULADA & SEGURANÇA */}
              <View className="bg-[#09090c] border border-zinc-800/80 rounded-2xl p-3.5 gap-2.5 mt-1">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-1.5">
                    <Mail size={13} color="#a1a1aa" />
                    <Text className="text-[9.5px] font-black uppercase tracking-wider text-zinc-400">
                      Conta Conectada
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800">
                    <ShieldCheck size={10} color="#34d399" />
                    <Text className="text-[8px] font-black font-mono text-zinc-300">AUTENTICADO</Text>
                  </View>
                </View>

                <Text className="text-xs font-bold font-mono text-zinc-200 truncate" numberOfLines={1}>
                  {user?.email || "operador@squirrel.internal"}
                </Text>

                {/* BOTÃO GERENCIAR SEGURANÇA */}
                <Pressable
                  onPress={() => {
                    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
                    setModalSeguranca(true);
                  }}
                  className="w-full py-2.5 px-3 rounded-xl bg-zinc-900 border border-zinc-800 flex-row items-center justify-between active:bg-zinc-800 mt-0.5"
                >
                  <View className="flex-row items-center gap-2">
                    <KeyRound size={14} color="#fbbf24" />
                    <Text className="text-xs font-bold text-zinc-200">
                      Alterar Senha ou E-mail
                    </Text>
                  </View>
                  <ChevronRight size={14} color="#71717a" />
                </Pressable>
              </View>

              {/* BOTÃO DE DIAGNÓSTICO E TESTE DE NOTIFICAÇÕES PUSH (FCM) */}
              <Pressable
                onPress={handleTestarNotificacao}
                disabled={isTestingPush}
                className="w-full py-3 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 items-center justify-center active:scale-[0.98] flex-row gap-2"
              >
                {isTestingPush ? (
                  <ActivityIndicator size="small" color="#818cf8" />
                ) : (
                  <>
                    <Bell size={14} color="#818cf8" />
                    <Text className="text-xs font-bold text-indigo-300">Testar Notificações & Diagnóstico Push (FCM)</Text>
                  </>
                )}
              </Pressable>

              {/* BOTÃO SAIR DO MODO ADMIN */}
              {isAdmin && (
                <Pressable
                  onPress={async () => {
                    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
                    await alternarAdminUsuario(myUserId, false);
                    setToast({ type: "info", title: "Admin Desativado", message: "Você voltou ao modo Operador padrão." });
                  }}
                  className="w-full py-3 rounded-2xl bg-red-500/10 border border-red-500/30 items-center justify-center active:scale-[0.98] flex-row gap-2"
                >
                  <Crown size={14} color="#f87171" />
                  <Text className="text-xs font-bold text-red-400">Sair do Modo Administrador</Text>
                </Pressable>
              )}

            </View>

            {/* 7. BOTÃO SALVAR */}
            <View className="pt-2">
              <Pressable
                onPress={handleSalvar}
                disabled={saving}
                className="w-full h-13 py-3.5 rounded-2xl bg-zinc-100 items-center justify-center flex-row gap-2 active:bg-zinc-200 shadow-xl"
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#09090b" />
                ) : (
                  <>
                    <Check size={16} color="#09090b" strokeWidth={3} />
                    <Text className="font-black uppercase text-xs tracking-wider text-zinc-950">
                      Salvar Perfil
                    </Text>
                  </>
                )}
              </Pressable>
            </View>

          </ScrollView>

        </View>
      </KeyboardAvoidingView>

      <CustomToast toast={toast} onDismiss={() => setToast(null)} />

      <SecurityModal
        visible={modalSeguranca}
        onClose={() => setModalSeguranca(false)}
      />
    </Modal>
  );
}
