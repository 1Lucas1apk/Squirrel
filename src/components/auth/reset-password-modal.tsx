import React, { useState, useEffect } from "react";
import { 
  View, 
  Text, 
  TextInput, 
  Pressable, 
  Modal, 
  ActivityIndicator, 
  Platform, 
  KeyboardAvoidingView 
} from "react-native";
import { Mail, KeyRound, CheckCircle2, AlertCircle, X, ArrowLeft } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useAuth, formatAuthError } from "../../hooks/use-auth";

interface ResetPasswordModalProps {
  visible: boolean;
  onClose: () => void;
  initialEmail?: string;
}

export function ResetPasswordModal({
  visible,
  onClose,
  initialEmail = ""
}: ResetPasswordModalProps) {
  const { sendPasswordReset } = useAuth();
  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (visible) {
      setEmail(initialEmail.trim());
      setError(null);
      setSuccess(false);
      setLoading(false);
    }
  }, [visible, initialEmail]);

  const triggerHaptic = (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) => {
    if (Platform.OS !== "web") {
      void Haptics.impactAsync(style);
    }
  };

  const handleSendReset = async () => {
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
      setError("Por favor, digite seu endereço de e-mail.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
      setError("Formato de e-mail inválido. Verifique o que foi digitado.");
      return;
    }

    setLoading(true);
    setError(null);
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await sendPasswordReset(cleanEmail);
      if (Platform.OS !== "web") {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setSuccess(true);
    } catch (err: any) {
      triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
      setError(err?.message || formatAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1 bg-black/85 items-center justify-center p-4"
      >
        <View className="w-full max-w-[420px] bg-[#0d0d12] border border-zinc-800 rounded-[32px] p-6 shadow-2xl">
          
          {/* TOP HEADER */}
          <View className="flex-row items-center justify-between pb-4 border-b border-zinc-900 mb-5">
            <View className="flex-row items-center gap-3">
              <View className="h-11 w-11 rounded-2xl bg-amber-500/15 border border-amber-500/30 items-center justify-center">
                <KeyRound size={20} color="#fbbf24" strokeWidth={2.4} />
              </View>
              <View>
                <Text className="text-[10px] font-black uppercase tracking-[2px] text-zinc-500">Recuperação</Text>
                <Text className="text-base font-black text-zinc-100 uppercase tracking-wider">
                  Redefinir Senha
                </Text>
              </View>
            </View>

            <Pressable
              onPress={() => {
                triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
                onClose();
              }}
              hitSlop={10}
              className="h-9 w-9 rounded-full bg-zinc-900 border border-zinc-800 items-center justify-center active:bg-zinc-800"
            >
              <X size={16} color="#a1a1aa" />
            </Pressable>
          </View>

          {/* SUCCESS STATE */}
          {success ? (
            <View className="gap-5 py-2">
              <View className="items-center justify-center py-4 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl p-4 gap-3">
                <View className="h-14 w-14 rounded-full bg-emerald-500/20 items-center justify-center">
                  <CheckCircle2 size={32} color="#34d399" strokeWidth={2.5} />
                </View>
                <Text className="text-sm font-black text-emerald-300 uppercase tracking-wider text-center">
                  E-mail Enviado com Sucesso!
                </Text>
                <Text className="text-xs text-zinc-300 text-center leading-relaxed font-medium">
                  Enviamos o link de recuperação para{"\n"}
                  <Text className="font-bold text-white font-mono">{email.trim()}</Text>.
                </Text>
                <View className="w-full bg-[#09090c] border border-zinc-800 rounded-xl p-3 mt-1">
                  <Text className="text-[11px] text-zinc-400 text-center leading-tight">
                    💡 <Text className="font-bold text-zinc-300">Dica:</Text> Verifique sua caixa de entrada e também a pasta de <Text className="text-amber-400 font-bold">Spam / Lixo Eletrônico</Text>.
                  </Text>
                </View>
              </View>

              <Pressable
                onPress={() => {
                  triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
                  onClose();
                }}
                className="w-full py-4 rounded-2xl bg-zinc-100 items-center justify-center active:bg-zinc-300 flex-row gap-2"
              >
                <ArrowLeft size={16} color="#09090b" strokeWidth={2.5} />
                <Text className="font-black uppercase tracking-[2px] text-xs text-zinc-950">
                  Voltar para o Login
                </Text>
              </Pressable>
            </View>
          ) : (
            /* FORM STATE */
            <View className="gap-4">
              <Text className="text-xs text-zinc-400 leading-relaxed font-medium">
                Digite o e-mail associado à sua conta do Squirrel. Você receberá um link seguro do Firebase para criar uma nova senha.
              </Text>

              <View className="gap-1.5 mt-1">
                <Text className="text-[10.5px] font-black uppercase tracking-wider text-zinc-400 px-1">
                  E-mail da Conta
                </Text>
                <View className="h-13 bg-[#09090c] border border-zinc-800 rounded-2xl px-4 flex-row items-center gap-3">
                  <Mail size={18} color="#71717a" />
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="exemplo@email.com"
                    placeholderTextColor="#52525b"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    className="flex-1 text-sm font-bold text-white py-3"
                  />
                  {email.length > 0 && (
                    <Pressable onPress={() => setEmail("")} hitSlop={6}>
                      <X size={15} color="#71717a" />
                    </Pressable>
                  )}
                </View>
              </View>

              {/* ERROR CARD */}
              {error && (
                <View className="rounded-2xl bg-red-500/10 border border-red-500/25 p-3 flex-row items-center gap-2.5">
                  <AlertCircle size={16} color="#f87171" />
                  <Text className="text-xs font-semibold text-red-300 flex-1 leading-snug">
                    {error}
                  </Text>
                </View>
              )}

              {/* ACTION BUTTONS */}
              <View className="pt-2 gap-2.5">
                <Pressable
                  disabled={loading}
                  onPress={handleSendReset}
                  className="w-full py-4 rounded-2xl bg-zinc-100 items-center justify-center flex-row gap-2 active:bg-zinc-300 shadow-xl"
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#09090b" />
                  ) : (
                    <>
                      <KeyRound size={16} color="#09090b" strokeWidth={2.5} />
                      <Text className="font-black uppercase tracking-[2px] text-xs text-zinc-950">
                        Enviar Link de Redefinição
                      </Text>
                    </>
                  )}
                </Pressable>

                <Pressable
                  disabled={loading}
                  onPress={() => {
                    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
                    onClose();
                  }}
                  className="w-full py-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 items-center justify-center active:bg-zinc-800"
                >
                  <Text className="font-black uppercase tracking-[2px] text-[11px] text-zinc-400">
                    Cancelar
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
