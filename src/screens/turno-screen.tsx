import { Pressable, Text, View } from "react-native";
import { 
  Zap, 
  PlayCircle, 
  History, 
  Settings,
  ChevronRight,
  ShieldCheck
} from "lucide-react-native";

interface TurnoScreenProps {
  loading: boolean;
  error: string | null;
  onNovoDia: () => void;
  onContinuar: () => void;
  onVerHistorico: () => void;
}

export function TurnoScreen({
  loading,
  error,
  onNovoDia,
  onContinuar,
  onVerHistorico,
}: TurnoScreenProps) {
  return (
    <View className="flex-1 justify-center bg-ink-950 px-8">
      <View className="mb-16">
        <View className="h-20 w-20 items-center justify-center rounded-[32px] bg-zinc-100 mb-8 shadow-2xl shadow-zinc-100/20">
          <ShieldCheck size={40} color="#09090b" strokeWidth={2.5} />
        </View>
        <Text className="text-6xl font-black text-zinc-100 tracking-tighter">Squirrel</Text>
        <Text className="text-xl text-zinc-500 font-bold tracking-tight mt-1 uppercase">Caixa Seguro • v5.0</Text>
      </View>

      <View className="gap-5">
        {error && (
          <View className="rounded-3xl border border-red-500/20 bg-red-500/5 p-5 mb-4">
            <Text className="text-center text-[10px] font-black uppercase tracking-widest text-red-400">{error}</Text>
          </View>
        )}

        <Pressable
          className="rounded-[32px] bg-zinc-100 px-8 py-7 active:opacity-80 flex-row items-center justify-between shadow-2xl shadow-zinc-100/10"
          disabled={loading}
          onPress={onNovoDia}
        >
          <View className="flex-row items-center gap-4">
            <Zap size={24} color="#09090b" strokeWidth={3} />
            <Text className="text-xl font-black uppercase tracking-widest text-zinc-950">
              {loading ? "..." : "Novo Dia"}
            </Text>
          </View>
          <ChevronRight size={20} color="#09090b" strokeWidth={3} />
        </Pressable>

        <Pressable
          className="rounded-[32px] border border-zinc-800 bg-ink-900 px-8 py-7 active:bg-zinc-800 flex-row items-center justify-between"
          disabled={loading}
          onPress={onContinuar}
        >
          <View className="flex-row items-center gap-4">
            <PlayCircle size={24} color="#f4f4f5" />
            <Text className="text-xl font-black uppercase tracking-widest text-zinc-100">
              Continuar
            </Text>
          </View>
          <ChevronRight size={20} color="#3f3f46" />
        </Pressable>

        <View className="mt-8 flex-row items-center justify-between px-2">
          <Pressable onPress={onVerHistorico} className="flex-row items-center gap-2">
            <History size={16} color="#71717a" />
            <Text className="text-[10px] font-black uppercase tracking-[3px] text-zinc-600">Histórico</Text>
          </Pressable>
          <View className="h-1 w-1 rounded-full bg-zinc-800" />
          <View className="flex-row items-center gap-2 opacity-30">
            <Settings size={16} color="#71717a" />
            <Text className="text-[10px] font-black uppercase tracking-[3px] text-zinc-600">Ajustes</Text>
          </View>
        </View>
      </View>

      <View className="absolute bottom-12 left-0 right-0 items-center">
        <Text className="text-[9px] font-black uppercase tracking-[5px] text-zinc-800">
          CLARA ELETRO • OPERACIONAL
        </Text>
      </View>
    </View>
  );
}
