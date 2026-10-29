import React, { useState } from "react";
import { 
  View, 
  Text, 
  TextInput, 
  Pressable, 
  Modal, 
  ScrollView, 
  ActivityIndicator, 
  Platform, 
  KeyboardAvoidingView 
} from "react-native";
import { 
  ShieldCheck, 
  Lock, 
  Mail, 
  KeyRound, 
  Check, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  X, 
  Send,
  Info,
  CheckCircle2
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useAuth } from "../../hooks/use-auth";
import { useAppSettings } from "../../hooks/use-app-settings";
import { CustomToast, ToastConfig } from "../common/custom-toast";

interface SecurityModalProps {
  visible: boolean;
  onClose: () => void;
}

type TabType = "senha" | "email";

export function SecurityModal({ visible, onClose }: SecurityModalProps) {
  const { user, changePassword, changeEmail, sendCurrentUserPasswordReset } = useAuth();
  const { settings } = useAppSettings();

  const [activeTab, setActiveTab] = useState<TabType>("senha");

  // Estados da Senha
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmaSenha, setConfirmaSenha] = useState("");
  const [verSenhaAtual, setVerSenhaAtual] = useState(false);
  const [verNovaSenha, setVerNovaSenha] = useState(false);
  const [verConfirmaSenha, setVerConfirmaSenha] = useState(false);
  const [loadingSenha, setLoadingSenha] = useState(false);
  const [loadingResetLink, setLoadingResetLink] = useState(false);

  // Estados do E-mail
  const [novoEmail, setNovoEmail] = useState("");
  const [senhaEmail, setSenhaEmail] = useState("");
  const [verSenhaEmail, setVerSenhaEmail] = useState(false);
  const [loadingEmail, setLoadingEmail] = useState(false);

  // Toast
  const [toast, setToast] = useState<ToastConfig | null>(null);

  const triggerHaptic = (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) => {
    if (settings.hapticsEnabled && Platform.OS !== "web") {
      void Haptics.impactAsync(style);
    }
  };

  const handleResetFields = () => {
    setSenhaAtual("");
    setNovaSenha("");
    setConfirmaSenha("");
    setNovoEmail("");
    setSenhaEmail("");
  };

  const handleClose = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    handleResetFields();
    onClose();
  };

  // 1. Alteração de Senha
  const handleAlterarSenha = async () => {
    const atual = senhaAtual.trim();
    const nova = novaSenha.trim();
    const confirma = confirmaSenha.trim();

    if (!atual) {
      triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
      setToast({ type: "error", title: "Senha Atual Obrigatória", message: "Digite sua senha atual para autorizar a mudança." });
      return;
    }

    if (nova.length < 6) {
      triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
      setToast({ type: "error", title: "Senha Curta", message: "A nova senha precisa ter no mínimo 6 caracteres." });
      return;
    }

    if (nova !== confirma) {
      triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
      setToast({ type: "error", title: "Senhas Divergentes", message: "A confirmação da nova senha não confere." });
      return;
    }

    if (atual === nova) {
      triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
      setToast({ type: "error", title: "Senha Repetida", message: "A nova senha deve ser diferente da atual." });
      return;
    }

    setLoadingSenha(true);
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await changePassword(atual, nova);
      if (Platform.OS !== "web") {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setToast({
        type: "success",
        title: "Senha Atualizada! 🔐",
        message: "Sua senha foi redefinida no Firebase e suas credenciais locais foram salvas."
      });
      handleResetFields();
    } catch (err: any) {
      triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
      setToast({
        type: "error",
        title: "Falha na Alteração",
        message: err?.message || "Não foi possível alterar a senha."
      });
    } finally {
      setLoadingSenha(false);
    }
  };

  // 2. Envio de Link de Redefinição para o próprio e-mail
  const handleEnviarLinkRedefinicao = async () => {
    setLoadingResetLink(true);
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const res = await sendCurrentUserPasswordReset();
      if (Platform.OS !== "web") {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setToast({
        type: "success",
        title: "Link Enviado! ✉️",
        message: res.message
      });
    } catch (err: any) {
      triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
      setToast({
        type: "error",
        title: "Erro ao Enviar",
        message: err?.message || "Não foi possível enviar o e-mail de redefinição."
      });
    } finally {
      setLoadingResetLink(false);
    }
  };

  // 3. Alteração de E-mail
  const handleAlterarEmail = async () => {
    const cleanEmail = novoEmail.trim().toLowerCase();
    const atualSenha = senhaEmail.trim();

    if (!cleanEmail) {
      triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
      setToast({ type: "error", title: "E-mail Obrigatório", message: "Por favor, digite o novo endereço de e-mail." });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
      setToast({ type: "error", title: "E-mail Inválido", message: "Digite um formato de e-mail válido (ex: nome@loja.com)." });
      return;
    }

    if (user?.email && cleanEmail === user.email.toLowerCase().trim()) {
      triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
      setToast({ type: "error", title: "Mesmo E-mail", message: "O novo e-mail deve ser diferente do e-mail atual." });
      return;
    }

    if (!atualSenha) {
      triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
      setToast({ type: "error", title: "Confirmação Necessária", message: "Digite sua senha atual para autorizar a troca de e-mail." });
      return;
    }

    setLoadingEmail(true);
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const res = await changeEmail(atualSenha, cleanEmail);
      if (Platform.OS !== "web") {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setToast({
        type: "success",
        title: res.verificationSent ? "Confirmação Enviada! 📩" : "E-mail Alterado! ✅",
        message: res.message
      });
      handleResetFields();
    } catch (err: any) {
      triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
      setToast({
        type: "error",
        title: "Falha na Alteração",
        message: err?.message || "Não foi possível alterar o e-mail."
      });
    } finally {
      setLoadingEmail(false);
    }
  };

  const isMinLength = novaSenha.length >= 6;
  const isMatch = novaSenha.length > 0 && novaSenha === confirmaSenha;
  const isDifferent = novaSenha.length > 0 && novaSenha !== senhaAtual;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1 bg-black/90 items-center justify-center p-4"
      >
        <View className="w-full max-w-[440px] max-h-[92%] bg-[#0d0d12] border border-zinc-800 rounded-[36px] p-5 shadow-2xl flex-col">
          
          {/* TOP HANDLE */}
          <View className="items-center pb-2">
            <View className="w-10 h-1 rounded-full bg-zinc-800" />
          </View>

          {/* HEADER */}
          <View className="flex-row items-center justify-between pb-3.5 border-b border-zinc-900 mb-3.5">
            <View className="flex-row items-center gap-3">
              <View className="h-10 w-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 items-center justify-center">
                <ShieldCheck size={20} color="#fbbf24" strokeWidth={2.4} />
              </View>
              <View>
                <Text className="text-[10px] font-black uppercase tracking-[2px] text-zinc-500">Squirrel Security</Text>
                <Text className="text-sm font-black text-zinc-100 uppercase tracking-wider">
                  Segurança & Acesso
                </Text>
              </View>
            </View>

            <Pressable
              onPress={handleClose}
              hitSlop={10}
              className="h-8.5 w-8.5 rounded-full bg-zinc-900 border border-zinc-800 items-center justify-center active:bg-zinc-800"
            >
              <X size={16} color="#a1a1aa" />
            </Pressable>
          </View>

          {/* TAB SELECTOR */}
          <View className="flex-row bg-[#09090c] p-1 rounded-2xl border border-zinc-800/80 mb-4">
            <Pressable
              onPress={() => {
                triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
                setActiveTab("senha");
              }}
              className={`flex-1 py-2.5 rounded-xl flex-row items-center justify-center gap-2 ${
                activeTab === "senha" ? "bg-zinc-800 border border-zinc-700 shadow-sm" : "opacity-70"
              }`}
            >
              <Lock size={13} color={activeTab === "senha" ? "#fbbf24" : "#a1a1aa"} />
              <Text className={`text-xs font-black uppercase tracking-wider ${
                activeTab === "senha" ? "text-white" : "text-zinc-400"
              }`}>
                Alterar Senha
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
                setActiveTab("email");
              }}
              className={`flex-1 py-2.5 rounded-xl flex-row items-center justify-center gap-2 ${
                activeTab === "email" ? "bg-zinc-800 border border-zinc-700 shadow-sm" : "opacity-70"
              }`}
            >
              <Mail size={13} color={activeTab === "email" ? "#38bdf8" : "#a1a1aa"} />
              <Text className={`text-xs font-black uppercase tracking-wider ${
                activeTab === "email" ? "text-white" : "text-zinc-400"
              }`}>
                Alterar E-mail
              </Text>
            </Pressable>
          </View>

          <ScrollView 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ gap: 14, paddingBottom: 12 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* CONTA ATUAL INFO */}
            <View className="bg-[#121216] border border-zinc-800/80 rounded-2xl p-3 flex-row items-center justify-between">
              <View className="flex-row items-center gap-2.5 flex-1 min-w-0 mr-2">
                <View className="h-8 w-8 rounded-xl bg-zinc-900 border border-zinc-800 items-center justify-center">
                  <Mail size={14} color="#a1a1aa" />
                </View>
                <View className="flex-1 min-w-0">
                  <Text className="text-[9px] font-black uppercase tracking-wider text-zinc-500">
                    Conta Ativa
                  </Text>
                  <Text className="text-xs font-bold font-mono text-zinc-200 truncate" numberOfLines={1}>
                    {user?.email || "operador@squirrel.internal"}
                  </Text>
                </View>
              </View>
              <View className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 flex-row items-center gap-1">
                <View className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <Text className="text-[8.5px] font-black font-mono text-emerald-400">ONLINE</Text>
              </View>
            </View>

            {/* TAB CONTENT: SENHA */}
            {activeTab === "senha" && (
              <View className="gap-3.5">
                
                {/* CAMPO: SENHA ATUAL */}
                <View className="gap-1">
                  <Text className="text-[10.5px] font-black uppercase tracking-wider text-zinc-400 px-1">
                    Senha Atual
                  </Text>
                  <View className="h-12 bg-[#09090c] border border-zinc-800 rounded-2xl px-3.5 flex-row items-center gap-2.5">
                    <KeyRound size={16} color="#71717a" />
                    <TextInput
                      value={senhaAtual}
                      onChangeText={setSenhaAtual}
                      placeholder="Digite sua senha atual"
                      placeholderTextColor="#52525b"
                      secureTextEntry={!verSenhaAtual}
                      autoCapitalize="none"
                      className="flex-1 text-sm font-bold text-white py-2"
                    />
                    <Pressable onPress={() => setVerSenhaAtual(!verSenhaAtual)} hitSlop={8}>
                      {verSenhaAtual ? <EyeOff size={16} color="#a1a1aa" /> : <Eye size={16} color="#71717a" />}
                    </Pressable>
                  </View>
                </View>

                {/* CAMPO: NOVA SENHA */}
                <View className="gap-1">
                  <Text className="text-[10.5px] font-black uppercase tracking-wider text-zinc-400 px-1">
                    Nova Senha
                  </Text>
                  <View className="h-12 bg-[#09090c] border border-zinc-800 rounded-2xl px-3.5 flex-row items-center gap-2.5">
                    <Lock size={16} color="#71717a" />
                    <TextInput
                      value={novaSenha}
                      onChangeText={setNovaSenha}
                      placeholder="Mínimo 6 caracteres"
                      placeholderTextColor="#52525b"
                      secureTextEntry={!verNovaSenha}
                      autoCapitalize="none"
                      className="flex-1 text-sm font-bold text-white py-2"
                    />
                    <Pressable onPress={() => setVerNovaSenha(!verNovaSenha)} hitSlop={8}>
                      {verNovaSenha ? <EyeOff size={16} color="#a1a1aa" /> : <Eye size={16} color="#71717a" />}
                    </Pressable>
                  </View>
                </View>

                {/* CAMPO: CONFIRMAR NOVA SENHA */}
                <View className="gap-1">
                  <Text className="text-[10.5px] font-black uppercase tracking-wider text-zinc-400 px-1">
                    Confirmar Nova Senha
                  </Text>
                  <View className="h-12 bg-[#09090c] border border-zinc-800 rounded-2xl px-3.5 flex-row items-center gap-2.5">
                    <Lock size={16} color="#71717a" />
                    <TextInput
                      value={confirmaSenha}
                      onChangeText={setConfirmaSenha}
                      placeholder="Repita a nova senha"
                      placeholderTextColor="#52525b"
                      secureTextEntry={!verConfirmaSenha}
                      autoCapitalize="none"
                      className="flex-1 text-sm font-bold text-white py-2"
                    />
                    <Pressable onPress={() => setVerConfirmaSenha(!verConfirmaSenha)} hitSlop={8}>
                      {verConfirmaSenha ? <EyeOff size={16} color="#a1a1aa" /> : <Eye size={16} color="#71717a" />}
                    </Pressable>
                  </View>
                </View>

                {/* REQUISITOS DE VALIDAÇÃO VISUAIS */}
                <View className="bg-[#09090c] border border-zinc-800/80 rounded-2xl p-3 gap-1.5">
                  <View className="flex-row items-center gap-2">
                    <View className={`h-4 w-4 rounded-full items-center justify-center ${
                      isMinLength ? "bg-emerald-500/20 text-emerald-400" : "bg-zinc-800"
                    }`}>
                      {isMinLength ? <Check size={10} color="#34d399" strokeWidth={3} /> : <View className="h-1.5 w-1.5 rounded-full bg-zinc-600" />}
                    </View>
                    <Text className={`text-[11px] font-medium ${isMinLength ? "text-emerald-300 font-bold" : "text-zinc-500"}`}>
                      Pelo menos 6 caracteres
                    </Text>
                  </View>

                  <View className="flex-row items-center gap-2">
                    <View className={`h-4 w-4 rounded-full items-center justify-center ${
                      isMatch ? "bg-emerald-500/20 text-emerald-400" : "bg-zinc-800"
                    }`}>
                      {isMatch ? <Check size={10} color="#34d399" strokeWidth={3} /> : <View className="h-1.5 w-1.5 rounded-full bg-zinc-600" />}
                    </View>
                    <Text className={`text-[11px] font-medium ${isMatch ? "text-emerald-300 font-bold" : "text-zinc-500"}`}>
                      Confirmação coincide exatamente
                    </Text>
                  </View>
                </View>

                {/* BOTÃO ATUALIZAR SENHA */}
                <Pressable
                  disabled={loadingSenha}
                  onPress={handleAlterarSenha}
                  className="w-full h-12 py-3 rounded-2xl bg-zinc-100 items-center justify-center flex-row gap-2 active:bg-zinc-300 shadow-xl mt-1"
                >
                  {loadingSenha ? (
                    <ActivityIndicator size="small" color="#09090b" />
                  ) : (
                    <>
                      <Lock size={15} color="#09090b" strokeWidth={2.5} />
                      <Text className="font-black uppercase tracking-[2px] text-xs text-zinc-950">
                        Atualizar Senha
                      </Text>
                    </>
                  )}
                </Pressable>

                {/* DIVISOR */}
                <View className="flex-row items-center gap-3 my-1">
                  <View className="flex-1 h-[1px] bg-zinc-900" />
                  <Text className="text-[10px] font-black uppercase tracking-wider text-zinc-600">Ou</Text>
                  <View className="flex-1 h-[1px] bg-zinc-900" />
                </View>

                {/* LINK DE REDEFINIÇÃO RÁPIDO */}
                <View className="bg-amber-500/10 border border-amber-500/25 rounded-2xl p-3 gap-2">
                  <View className="flex-row items-center gap-2">
                    <KeyRound size={14} color="#fbbf24" />
                    <Text className="text-xs font-black text-amber-300 uppercase tracking-wider">
                      Não lembra sua senha atual?
                    </Text>
                  </View>
                  <Text className="text-[11px] text-zinc-400 leading-snug">
                    Enviaremos um link de redefinição direto para o seu e-mail cadastrado.
                  </Text>
                  <Pressable
                    disabled={loadingResetLink}
                    onPress={handleEnviarLinkRedefinicao}
                    className="w-full py-2.5 rounded-xl bg-amber-500/20 border border-amber-500/40 items-center justify-center flex-row gap-2 active:bg-amber-500/30 mt-1"
                  >
                    {loadingResetLink ? (
                      <ActivityIndicator size="small" color="#fbbf24" />
                    ) : (
                      <>
                        <Send size={13} color="#fbbf24" />
                        <Text className="text-xs font-bold text-amber-300">
                          Enviar Link de Redefinição por E-mail
                        </Text>
                      </>
                    )}
                  </Pressable>
                </View>

              </View>
            )}

            {/* TAB CONTENT: EMAIL */}
            {activeTab === "email" && (
              <View className="gap-3.5">
                <View className="bg-sky-500/10 border border-sky-500/25 rounded-2xl p-3 gap-1.5">
                  <View className="flex-row items-center gap-2">
                    <Info size={14} color="#38bdf8" />
                    <Text className="text-xs font-black text-sky-300 uppercase tracking-wider">
                      Como funciona a troca de e-mail
                    </Text>
                  </View>
                  <Text className="text-[11px] text-zinc-300 leading-relaxed font-medium">
                    Por razões de segurança do Firebase, solicitamos sua senha atual. Um link de validação poderá ser enviado para o novo endereço para confirmar a propriedade.
                  </Text>
                </View>

                {/* CAMPO: NOVO EMAIL */}
                <View className="gap-1">
                  <Text className="text-[10.5px] font-black uppercase tracking-wider text-zinc-400 px-1">
                    Novo E-mail
                  </Text>
                  <View className="h-12 bg-[#09090c] border border-zinc-800 rounded-2xl px-3.5 flex-row items-center gap-2.5">
                    <Mail size={16} color="#71717a" />
                    <TextInput
                      value={novoEmail}
                      onChangeText={setNovoEmail}
                      placeholder="novoemail@exemplo.com"
                      placeholderTextColor="#52525b"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      className="flex-1 text-sm font-bold text-white py-2"
                    />
                    {novoEmail.length > 0 && (
                      <Pressable onPress={() => setNovoEmail("")} hitSlop={6}>
                        <X size={15} color="#71717a" />
                      </Pressable>
                    )}
                  </View>
                </View>

                {/* CAMPO: SENHA ATUAL DE CONFIRMAÇÃO */}
                <View className="gap-1">
                  <Text className="text-[10.5px] font-black uppercase tracking-wider text-zinc-400 px-1">
                    Senha Atual de Confirmação
                  </Text>
                  <View className="h-12 bg-[#09090c] border border-zinc-800 rounded-2xl px-3.5 flex-row items-center gap-2.5">
                    <Lock size={16} color="#71717a" />
                    <TextInput
                      value={senhaEmail}
                      onChangeText={setSenhaEmail}
                      placeholder="Digite sua senha atual para autorizar"
                      placeholderTextColor="#52525b"
                      secureTextEntry={!verSenhaEmail}
                      autoCapitalize="none"
                      className="flex-1 text-sm font-bold text-white py-2"
                    />
                    <Pressable onPress={() => setVerSenhaEmail(!verSenhaEmail)} hitSlop={8}>
                      {verSenhaEmail ? <EyeOff size={16} color="#a1a1aa" /> : <Eye size={16} color="#71717a" />}
                    </Pressable>
                  </View>
                </View>

                {/* BOTÃO ATUALIZAR EMAIL */}
                <Pressable
                  disabled={loadingEmail}
                  onPress={handleAlterarEmail}
                  className="w-full h-12 py-3 rounded-2xl bg-sky-500 items-center justify-center flex-row gap-2 active:bg-sky-600 shadow-xl mt-2"
                >
                  {loadingEmail ? (
                    <ActivityIndicator size="small" color="#09090b" />
                  ) : (
                    <>
                      <Mail size={15} color="#09090b" strokeWidth={2.5} />
                      <Text className="font-black uppercase tracking-[2px] text-xs text-zinc-950">
                        Atualizar E-mail
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            )}

          </ScrollView>

        </View>
      </KeyboardAvoidingView>

      <CustomToast toast={toast} onDismiss={() => setToast(null)} />
    </Modal>
  );
}
