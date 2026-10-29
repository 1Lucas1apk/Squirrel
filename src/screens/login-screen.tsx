import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ShieldCheck, Mail, Lock, Eye, EyeOff, KeyRound } from "lucide-react-native";
import { useAuth, formatAuthError } from "../hooks/use-auth";
import { migrarDadosAntigos } from "../services/repositories/caixa-repository";
import { saveCredentials } from "../services/auth-storage";
import { ResetPasswordModal } from "../components/auth/reset-password-modal";

export function LoginScreen() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [verSenha, setVerSenha] = useState(false);
  const [modalResetSenha, setModalResetSenha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState(false);
  const { signIn, signUp } = useAuth();

  const handleAuth = async (isLogin: boolean) => {
    const emailLimpo = email.trim();
    const senhaLimpa = senha.trim();

    if (!emailLimpo || !senhaLimpa) {
      setErro("Preencha e-mail e senha.");
      return;
    }
    
    if (senhaLimpa.length < 6) {
      setErro("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    setLoadingAction(true);
    setErro(null);
    try {
      if (isLogin) {
        await signIn(emailLimpo, senhaLimpa);
      } else {
        await signUp(emailLimpo, senhaLimpa);
      }
      
      // Salva para auto-login futuro (Persistência Manual)
      await saveCredentials(emailLimpo, senhaLimpa);
      
      // Assim que logar/registrar com sucesso, roda o script de migração (se houver dados)
      await migrarDadosAntigos();

    } catch (e: any) {
      console.error("ERRO COMPLETO AUTH:", e);
      let msgErro = formatAuthError(e);
      
      if (e.code === "auth/configuration-not-found" || e.code === "auth/api-key-not-valid-for-user-project") {
        msgErro = "Firebase não configurado corretamente no .env";
      }

      setErro(msgErro);
    } finally {
      setLoadingAction(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-ink-950 justify-center px-8">
      <View className="mx-auto w-full max-w-[400px]">
        <View className="mb-10 items-center">
          <View className="h-24 w-24 items-center justify-center rounded-[40px] bg-zinc-100 mb-6 shadow-2xl shadow-zinc-100/20">
            <ShieldCheck size={48} color="#09090b" strokeWidth={2.5} />
          </View>
          <Text className="text-5xl font-black text-zinc-100 tracking-tighter mb-2">Squirrel</Text>
          <Text className="text-[10px] font-black text-zinc-500 uppercase tracking-[4px]">Caixa Seguro Multi-Loja</Text>
        </View>

        <View className="gap-3.5">
          <View className="rounded-[24px] border border-zinc-800 bg-ink-900 flex-row items-center px-5 py-1.5">
            <Mail size={20} color="#71717a" />
            <TextInput 
              className="flex-1 text-white font-bold text-base ml-3 py-3.5"
              placeholder="E-mail da Loja/Operador"
              placeholderTextColor="#52525b"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View className="rounded-[24px] border border-zinc-800 bg-ink-900 flex-row items-center px-5 py-1.5">
            <Lock size={20} color="#71717a" />
            <TextInput 
              className="flex-1 text-white font-bold text-base ml-3 py-3.5"
              placeholder="Senha de Acesso"
              placeholderTextColor="#52525b"
              secureTextEntry={!verSenha}
              autoCapitalize="none"
              value={senha}
              onChangeText={setSenha}
            />
            <Pressable onPress={() => setVerSenha(!verSenha)} hitSlop={10} className="p-1">
              {verSenha ? <EyeOff size={18} color="#a1a1aa" /> : <Eye size={18} color="#71717a" />}
            </Pressable>
          </View>

          {/* BOTÃO ESQUECI MINHA SENHA */}
          <View className="flex-row justify-end px-1 pt-0.5">
            <Pressable 
              onPress={() => setModalResetSenha(true)}
              hitSlop={8}
              className="flex-row items-center gap-1.5 active:opacity-70"
            >
              <KeyRound size={13} color="#fbbf24" />
              <Text className="text-xs font-bold text-amber-400">
                Esqueceu a senha?
              </Text>
            </Pressable>
          </View>
        </View>

        {erro && (
          <View className="mt-5 rounded-2xl bg-red-500/10 border border-red-500/20 p-3.5 gap-1.5">
            <Text className="text-center text-xs font-bold text-red-400">{erro}</Text>
            {erro.includes("Senha incorreta") && (
              <Pressable 
                onPress={() => setModalResetSenha(true)}
                className="items-center mt-1"
              >
                <Text className="text-[11px] font-black text-amber-400 uppercase tracking-wider underline">
                  Redefinir senha agora
                </Text>
              </Pressable>
            )}
          </View>
        )}

        <View className="mt-7 gap-3.5">
          <Pressable 
            disabled={loadingAction}
            onPress={() => handleAuth(true)}
            className="rounded-[24px] bg-zinc-100 py-5 shadow-2xl items-center flex-row justify-center gap-3 active:bg-zinc-300"
          >
            {loadingAction ? <ActivityIndicator color="#09090b" /> : null}
            <Text className="font-black uppercase tracking-[4px] text-zinc-950 text-sm">Acessar Sistema</Text>
          </Pressable>

          <Pressable 
            disabled={loadingAction}
            onPress={() => handleAuth(false)}
            className="rounded-[24px] border border-zinc-800 bg-ink-900 py-4 items-center active:bg-zinc-800"
          >
            <Text className="font-black uppercase tracking-[2px] text-zinc-400 text-xs">Criar Nova Conta</Text>
          </Pressable>
        </View>
      </View>

      <ResetPasswordModal
        visible={modalResetSenha}
        onClose={() => setModalResetSenha(false)}
        initialEmail={email}
      />
    </SafeAreaView>
  );
}
