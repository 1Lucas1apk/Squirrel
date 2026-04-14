import { Pressable, Text, View, Alert } from "react-native";
import { 
  Calendar, 
  Trash2, 
  ChevronRight, 
  RefreshCw,
  Clock
} from "lucide-react-native";
import { Turno } from "../types/domain";
import { toBrl } from "../utils/currency";

interface HistoricoScreenProps {
  turnos: Turno[];
  loading: boolean;
  onRefresh: () => void;
  onOpen: (turnoId: string) => void;
  onExcluirDia: (turnoId: string) => void;
}

export function HistoricoScreen({ turnos, loading, onRefresh, onOpen, onExcluirDia }: HistoricoScreenProps) {
  return (
    <View className="gap-6 pb-20">
      <View className="flex-row items-center justify-between px-2">
        <View className="flex-row items-center gap-2">
          <Calendar size={16} color="#71717a" />
          <Text className="text-[11px] font-black uppercase tracking-[3px] text-zinc-500">Dias Anteriores</Text>
        </View>
        <Pressable 
          className="h-10 w-10 items-center justify-center rounded-2xl bg-ink-900 border border-zinc-800" 
          onPress={onRefresh}
          disabled={loading}
        >
          <RefreshCw size={16} color="#71717a" className={loading ? "animate-spin" : ""} />
        </Pressable>
      </View>

      <View className="gap-4">
        {turnos.map((turno) => (
          <View
            key={turno.id}
            className="rounded-[32px] border border-zinc-800 bg-ink-900 overflow-hidden shadow-sm"
          >
            <Pressable
              className="p-6 flex-row items-center justify-between"
              onPress={() => onOpen(turno.id)}
            >
              <View className="flex-1 flex-row items-center gap-4">
                <View className="h-12 w-12 items-center justify-center rounded-[18px] bg-ink-800 border border-zinc-800">
                  <Clock size={20} color="#71717a" />
                </View>
                <View>
                  <Text className="text-xl font-black text-zinc-100 tracking-tighter">{turno.dataReferencia}</Text>
                  <Text className="text-[10px] font-black uppercase tracking-widest text-zinc-600">
                    Sistema: {toBrl(turno.totais.sistema)}
                  </Text>
                </View>
              </View>
              
              <View className="flex-row items-center gap-2">
                <Pressable 
                  onPress={() => {
                    Alert.alert(
                      "Apagar Registros",
                      "Deseja realmente deletar todo o histórico deste dia? Esta ação não pode ser desfeita.",
                      [
                        { text: "Sair", style: "cancel" },
                        { text: "Confirmar", style: "destructive", onPress: () => onExcluirDia(turno.id) }
                      ]
                    );
                  }}
                  className="h-10 w-10 items-center justify-center rounded-[14px] bg-red-500/10 border border-red-500/20"
                >
                  <Trash2 size={16} color="#f87171" />
                </Pressable>
                <View className="h-10 w-10 items-center justify-center rounded-[14px] bg-zinc-800">
                  <ChevronRight size={16} color="#71717a" />
                </View>
              </View>
            </Pressable>
          </View>
        ))}

        {turnos.length === 0 && (
          <View className="rounded-[32px] border border-dashed border-zinc-800 py-20 items-center justify-center">
            <Calendar size={40} color="#27272a" strokeWidth={1} />
            <Text className="mt-4 text-zinc-600 font-bold uppercase tracking-widest">Nenhum dia registrado</Text>
          </View>
        )}
      </View>
    </View>
  );
}
