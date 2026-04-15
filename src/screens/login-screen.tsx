import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ShieldCheck, Mail, Lock } from "lucide-react-native";
import { useAuth } from "../hooks/use-auth";
import { migrarDadosAntigos } from "../services/repositories/caixa-repository";

export function LoginScreen() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
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
      
      // Assim que logar/registrar com sucesso, roda o script de migração (se houver dados)
      await migrarDadosAntigos();

    } catch (e: any) {
      console.log(e.code); // Log interno
      let msgErro = "Erro na autenticação. Verifique os dados.";
      
      if (e.code === "auth/configuration-not-found" || e.code === "auth/api-key-not-valid-for-user-project") {
        msgErro = "Firebase não configurado. Ative 'E-mail/Senha' no painel Authentication do Firebase.";
      } else if (e.code === "auth/email-already-in-use") {
        msgErro = "Esta conta já existe. Tente acessar o sistema.";
      } else if (e.code === "auth/invalid-email") {
        msgErro = "E-mail inválido.";
      } else if (e.code === "auth/invalid-credential" || e.code === "auth/wrong-password" || e.code === "auth/user-not-found") {
        msgErro = "E-mail ou senha incorretos.";
      } else if (e.code === "auth/weak-password") {
        msgErro = "A senha é muito fraca (use no mínimo 6 caracteres).";
      }

      setErro(msgErro);
    } finally {
      setLoadingAction(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-ink-950 justify-center px-8">
      <View className="mx-auto w-full max-w-[400px]">
        <View className="mb-12 items-center">
          <View className="h-24 w-24 items-center justify-center rounded-[40px] bg-zinc-100 mb-8 shadow-2xl shadow-zinc-100/20">
            <ShieldCheck size={48} color="#09090b" strokeWidth={2.5} />
          </View>
          <Text className="text-5xl font-black text-zinc-100 tracking-tighter mb-2">Squirrel</Text>
          <Text className="text-[10px] font-black text-zinc-500 uppercase tracking-[4px]">Caixa Seguro Multi-Loja</Text>
        </View>

        <View className="gap-4">
          <View className="rounded-[24px] border border-zinc-800 bg-ink-900 flex-row items-center px-6 py-2">
            <Mail size={20} color="#71717a" />
            <TextInput 
              className="flex-1 text-white font-bold text-base ml-4 py-4"
              placeholder="E-mail da Loja/Operador"
              placeholderTextColor="#52525b"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View className="rounded-[24px] border border-zinc-800 bg-ink-900 flex-row items-center px-6 py-2">
            <Lock size={20} color="#71717a" />
            <TextInput 
              className="flex-1 text-white font-bold text-base ml-4 py-4"
              placeholder="Senha de Acesso"
              placeholderTextColor="#52525b"
              secureTextEntry
              value={senha}
              onChangeText={setSenha}
            />
          </View>
        </View>

        {erro && (
          <View className="mt-6 rounded-2xl bg-red-500/10 border border-red-500/20 p-4">
            <Text className="text-center text-[10px] font-black text-red-400 uppercase tracking-widest">{erro}</Text>
          </View>
        )}

        <View className="mt-8 gap-4">
          <Pressable 
            disabled={loadingAction}
            onPress={() => handleAuth(true)}
            className="rounded-[24px] bg-zinc-100 py-6 shadow-2xl items-center flex-row justify-center gap-3 active:bg-zinc-300"
          >
            {loadingAction ? <ActivityIndicator color="#09090b" /> : null}
            <Text className="font-black uppercase tracking-[4px] text-zinc-950">Acessar Sistema</Text>
          </Pressable>

          <Pressable 
            disabled={loadingAction}
            onPress={() => handleAuth(false)}
            className="rounded-[24px] border-2 border-zinc-800 bg-ink-900 py-5 items-center active:bg-zinc-800"
          >
            <Text className="font-black uppercase tracking-[2px] text-zinc-500 text-xs">Criar Nova Conta</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
