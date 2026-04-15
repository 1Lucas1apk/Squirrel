import { useState, useMemo } from "react";
import { Pressable, Text, View, FlatList, Switch, TextInput } from "react-native";
import { 
  Calendar, 
  Trash2, 
  RefreshCw,
  Clock,
  TrendingUp,
  Banknote,
  Search
} from "lucide-react-native";
import { Turno } from "../types/domain";
import { toBrl } from "../utils/currency";

interface HistoricoScreenProps {
  turnos: Turno[];
  loading: boolean;
  onRefresh: () => void;
  onOpen: (turnoId: string) => void;
  onExcluirDia: (turnoId: string) => void;
  onToggleRepasse?: (turnoId: string, repassado: boolean) => void;
}

export function HistoricoScreen({ turnos, loading, onRefresh, onOpen, onExcluirDia, onToggleRepasse }: HistoricoScreenProps) {
  const [busca, setBusca] = useState("");

  const turnosFiltrados = useMemo(() => {
    if (!busca.trim()) return turnos;
    const termo = busca.toLowerCase();
    return turnos.filter(t => 
      t.caixaId?.toLowerCase().includes(termo) || 
      t.operadorId?.toLowerCase().includes(termo) ||
      t.dataReferencia.includes(termo)
    );
  }, [turnos, busca]);

  const stats = useMemo(() => {
    const totalSistema = turnosFiltrados.reduce((acc, t) => acc + (t.totais?.sistema || 0), 0);
    const totalRepassado = turnosFiltrados.filter(t => t.repassado).reduce((acc, t) => acc + (t.totais?.sistema || 0), 0);
    return { totalSistema, totalRepassado };
  }, [turnosFiltrados]);

  const renderItem = ({ item: turno }: { item: Turno }) => (
    <View className={`rounded-[32px] border mb-4 overflow-hidden shadow-sm ${turno.repassado ? 'border-emerald-500/30 bg-emerald-950/20' : 'border-zinc-800 bg-ink-900'}`}>
      <View className="p-6">
        <Pressable className="flex-row items-center justify-between mb-4" onPress={() => onOpen(turno.id)}>
          <View className="flex-1 flex-row items-center gap-4">
            <View className={`h-12 w-12 items-center justify-center rounded-[18px] border ${turno.repassado ? 'bg-emerald-900/50 border-emerald-500/30' : 'bg-ink-800 border-zinc-800'}`}>
              <Clock size={20} color={turno.repassado ? "#34d399" : "#71717a"} />
            </View>
            <View>
              <View className="flex-row items-center gap-2">
                <Text className={`text-xl font-black tracking-tighter ${turno.repassado ? 'text-emerald-400' : 'text-zinc-100'}`}>{turno.dataReferencia}</Text>
                {turno.caixaId && (
                  <View className="bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700">
                    <Text className="text-[8px] font-black text-zinc-400 uppercase">CX: {turno.caixaId}</Text>
                  </View>
                )}
              </View>
              <Text className="text-[10px] font-black uppercase tracking-widest text-zinc-600">
                Sistema: {toBrl(turno.totais?.sistema || 0)}
              </Text>
            </View>
          </View>
          
          <View className="flex-row items-center gap-2">
            <Pressable 
              onPress={() => onExcluirDia(turno.id)}
              hitSlop={10}
              className="h-10 w-10 items-center justify-center rounded-[14px] bg-red-500/10 border border-red-500/20"
            >
              <Trash2 size={16} color="#f87171" />
            </Pressable>
          </View>
        </Pressable>

        <View className="flex-row items-center justify-between pt-4 border-t border-zinc-800/50">
          <Text className={`text-[10px] font-black uppercase tracking-widest ${turno.repassado ? 'text-emerald-500' : 'text-zinc-500'}`}>
            {turno.repassado ? "✔ Malote Repassado" : "Pendente de Repasse"}
          </Text>
          {onToggleRepasse && (
             <Switch 
               value={turno.repassado || false}
               onValueChange={(val) => onToggleRepasse(turno.id, val)}
               trackColor={{ false: "#27272a", true: "#059669" }}
               thumbColor={"#f4f4f5"}
             />
          )}
        </View>
      </View>
    </View>
  );

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

      <View className="rounded-[24px] border border-zinc-800 bg-ink-900 p-4 flex-row items-center gap-3">
        <Search size={14} color="#3f3f46" />
        <TextInput 
          placeholder="BUSCAR CAIXA, OPERADOR OU DATA..."
          placeholderTextColor="#3f3f46"
          value={busca}
          onChangeText={setBusca}
          className="flex-1 text-zinc-100 font-bold text-[10px] uppercase tracking-widest"
        />
      </View>

      {/* DASHBOARD DE ESTATÍSTICAS */}
      <View className="flex-row gap-3">
        <View className="flex-1 bg-ink-900 rounded-[24px] p-5 border border-zinc-800">
           <View className="flex-row items-center gap-2 mb-2">
             <TrendingUp size={14} color="#60a5fa" />
             <Text className="text-[9px] font-black uppercase tracking-[2px] text-zinc-500">Total Histórico</Text>
           </View>
           <Text className="text-lg font-black text-zinc-100 tracking-tighter">{toBrl(stats.totalSistema)}</Text>
        </View>
        <View className="flex-1 bg-emerald-500/10 rounded-[24px] p-5 border border-emerald-500/20">
           <View className="flex-row items-center gap-2 mb-2">
             <Banknote size={14} color="#34d399" />
             <Text className="text-[9px] font-black uppercase tracking-[2px] text-emerald-600">Já Repassado</Text>
           </View>
           <Text className="text-lg font-black text-emerald-400 tracking-tighter">{toBrl(stats.totalRepassado)}</Text>
        </View>
      </View>

      <FlatList
        data={turnosFiltrados}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
        ListEmptyComponent={
          <View className="rounded-[32px] border border-dashed border-zinc-800 py-20 items-center justify-center mt-4">
            <Calendar size={40} color="#27272a" strokeWidth={1} />
            <Text className="mt-4 text-zinc-600 font-bold uppercase tracking-widest">Nenhum dia encontrado</Text>
          </View>
        }
      />
    </View>
  );
}
