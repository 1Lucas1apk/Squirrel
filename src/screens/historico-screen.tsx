import { useState, useMemo, useCallback, useDeferredValue, memo } from "react";
import { Pressable, Text, View, FlatList, Switch, TextInput, Dimensions, Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { 
  Calendar, 
  Trash2, 
  RefreshCw,
  Clock, 
  TrendingUp, 
  Banknote, 
  Search, 
  BarChart2, 
  ChevronDown,
  X
} from "lucide-react-native";
import { LineChart } from "react-native-wagmi-charts";
import { Turno } from "../types/domain";
import { toBrl } from "../utils/currency";

const SCREEN_WIDTH = Dimensions.get('window').width;

interface HistoricoScreenProps {
  turnos: Turno[];
  loading: boolean;
  onRefresh: () => void;
  onOpen: (turnoId: string) => void;
  onExcluirDia: (turnoId: string) => void;
  onToggleRepasse?: (turnoId: string, repassado: boolean) => void;
  onRestaurarDia?: (turnoId: string) => void;
  onDeletarPermanente?: (turnoId: string) => void;
  onVoltar?: () => void;
  textoVoltar?: string;
}

interface HistoricoCardProps {
  turno: Turno;
  onOpen: (turnoId: string) => void;
  onExcluirDia: (turnoId: string) => void;
  onRestaurarDia?: (turnoId: string) => void;
  onDeletarPermanente?: (turnoId: string) => void;
  onToggleRepasse?: (turnoId: string, repassado: boolean) => void;
}

const HistoricoCard = memo(function HistoricoCard({
  turno,
  onOpen,
  onExcluirDia,
  onRestaurarDia,
  onDeletarPermanente,
  onToggleRepasse,
}: HistoricoCardProps) {
  const sobraValue = turno.totais?.sobra || 0;
  const temQuebra = sobraValue < -0.01;
  const temSobra = sobraValue > 0.01;

  return (
    <View className={`rounded-[26px] border mb-3 overflow-hidden shadow-md mx-auto w-full max-w-[460px] ${
      turno.repassado 
        ? 'border-emerald-500/30 bg-[#121216]' 
        : temQuebra
          ? 'border-red-500/30 bg-[#121216]'
          : temSobra
            ? 'border-emerald-500/20 bg-[#121216]'
            : 'border-zinc-800 bg-[#121216]'
    }`}>
      <View className="p-4">
        <Pressable 
          className="flex-row items-center justify-between mb-3" 
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            if (!turno.excluido) onOpen(turno.id);
          }}
          disabled={turno.excluido}
        >
          <View className="flex-1 flex-row items-center gap-3" style={{ opacity: turno.excluido ? 0.5 : 1 }}>
            <View className={`h-11 w-11 items-center justify-center rounded-2xl border ${
              temQuebra 
                ? 'bg-red-500/10 border-red-500/30' 
                : temSobra 
                ? 'bg-emerald-500/10 border-emerald-500/30' 
                : 'bg-zinc-900 border-zinc-800'
            }`}>
              <Clock size={19} color={temQuebra ? "#f87171" : temSobra ? "#34d399" : "#60a5fa"} strokeWidth={2.2} />
            </View>
            <View className="flex-1 min-w-0">
              <View className="flex-row items-center gap-1.5 flex-wrap">
                <Text className={`text-base font-black tracking-tight ${turno.repassado ? 'text-emerald-400' : 'text-white'}`}>{turno.dataReferencia}</Text>
                {turno.caixaId && (
                  <View className="bg-blue-500/10 border border-blue-500/25 px-1.5 py-0.5 rounded-md">
                    <Text className="text-[8.5px] font-black text-blue-400 uppercase">CX {turno.caixaId}</Text>
                  </View>
                )}
                {turno.operadorId && (
                  <View className="bg-zinc-800/80 border border-zinc-700/80 px-1.5 py-0.5 rounded-md">
                    <Text className="text-[8.5px] font-bold text-zinc-300 uppercase" numberOfLines={1}>{turno.operadorId}</Text>
                  </View>
                )}
              </View>
              <View className="flex-row items-center gap-1.5 mt-0.5 flex-wrap">
                <Text className="text-[10px] font-black uppercase tracking-wider text-zinc-400" numberOfLines={1}>
                  Sist: {toBrl(turno.totais?.sistema || 0)}
                </Text>
                <Text className={`text-[10px] font-black uppercase tracking-wider ${temQuebra ? 'text-red-400' : temSobra ? 'text-emerald-400' : 'text-zinc-500'}`} numberOfLines={1}>
                  • {temQuebra ? 'Falta' : 'Sobra'}: {toBrl(Math.abs(sobraValue))}
                </Text>
              </View>
            </View>
          </View>
          
          <View className="flex-row items-center gap-1.5 ml-2 flex-shrink-0">
            {turno.excluido ? (
              <>
                <Pressable 
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onRestaurarDia && onRestaurarDia(turno.id);
                  }}
                  hitSlop={8}
                  className="h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/25 active:scale-95"
                >
                  <RefreshCw size={14} color="#34d399" />
                </Pressable>
                <Pressable 
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                    onDeletarPermanente && onDeletarPermanente(turno.id);
                  }}
                  hitSlop={8}
                  className="h-8 w-8 items-center justify-center rounded-xl bg-red-500/10 border border-red-500/25 active:scale-95"
                >
                  <Trash2 size={14} color="#f87171" />
                </Pressable>
              </>
            ) : (
              <Pressable 
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onExcluirDia(turno.id);
                }}
                hitSlop={8}
                className="h-8 w-8 items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800 active:bg-zinc-800 active:scale-95"
              >
                <Trash2 size={13} color="#71717a" />
              </Pressable>
            )}
          </View>
        </Pressable>

        <View className="flex-row items-center justify-between pt-2.5 border-t border-zinc-800/60">
          <Text className={`text-[9.5px] font-black uppercase tracking-wider ${turno.repassado ? 'text-emerald-400' : 'text-zinc-500'}`}>
            {turno.repassado ? "Malote Repassado" : "Pendente de Repasse"}
          </Text>
          {onToggleRepasse && (
             <Switch 
               value={turno.repassado || false}
               onValueChange={(val) => {
                 void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                 onToggleRepasse(turno.id, val);
               }}
               trackColor={{ false: "#27272a", true: "#059669" }}
               thumbColor={"#f4f4f5"}
             />
          )}
        </View>
      </View>
    </View>
  );
});

function HistoricoScreenComponent({
  turnos,
  loading,
  onRefresh,
  onOpen,
  onExcluirDia,
  onRestaurarDia,
  onDeletarPermanente,
  onToggleRepasse,
  onVoltar,
  textoVoltar = "Sair"
}: HistoricoScreenProps) {
  const [busca, setBusca] = useState("");
  const buscaDeferida = useDeferredValue(busca);
  const [mostrarLixeira, setMostrarLixeira] = useState(false);
  const [visibleCount, setVisibleCount] = useState(10);

  const turnosFiltrados = useMemo(() => {
    // Filtra turnos válidos que tenham dataReferencia (evita registros corrompidos/sem data)
    let result = turnos.filter(t => 
      t.dataReferencia && 
      t.dataReferencia.trim().length >= 8 && 
      (mostrarLixeira ? t.excluido : !t.excluido)
    );
    if (buscaDeferida.trim()) {
      const termo = buscaDeferida.toLowerCase();
      result = result.filter(t => 
        t.caixaId?.toLowerCase().includes(termo) || 
        t.operadorId?.toLowerCase().includes(termo) ||
        t.dataReferencia.toLowerCase().includes(termo)
      );
    }
    // Ordena por data (mais recente primeiro)
    return [...result].sort((a, b) => b.dataReferencia.localeCompare(a.dataReferencia));
  }, [turnos, buscaDeferida, mostrarLixeira]);

  const listagemPaginada = useMemo(() => {
    return turnosFiltrados.slice(0, visibleCount);
  }, [turnosFiltrados, visibleCount]);

  const chartData = useMemo(() => {
    // Pega os últimos 7 turnos cronologicamente para o gráfico (ignora excluídos)
    const last7 = [...turnos.filter(t => !t.excluido)]
      .sort((a, b) => a.dataReferencia.localeCompare(b.dataReferencia))
      .slice(-7);
    
    if (last7.length < 2) return [];

    return last7.map((t, idx) => ({
      timestamp: idx,
      value: t.totais?.sistema || 0
    }));
  }, [turnos]);

  const stats = useMemo(() => {
    const totalSistema = turnosFiltrados.reduce((acc, t) => acc + (t.totais?.sistema || 0), 0);
    const totalRepassado = turnosFiltrados.filter(t => t.repassado).reduce((acc, t) => acc + (t.totais?.sistema || 0), 0);
    return { totalSistema, totalRepassado };
  }, [turnosFiltrados]);

  const renderItem = useCallback(({ item: turno }: { item: Turno }) => {
    return (
      <HistoricoCard
        turno={turno}
        onOpen={onOpen}
        onExcluirDia={onExcluirDia}
        onRestaurarDia={onRestaurarDia}
        onDeletarPermanente={onDeletarPermanente}
        onToggleRepasse={onToggleRepasse}
      />
    );
  }, [onOpen, onExcluirDia, onRestaurarDia, onDeletarPermanente, onToggleRepasse]);

  return (
    <View className="flex-1 bg-ink-950">
      <FlatList
        data={listagemPaginada}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={5}
        removeClippedSubviews={false}
        showsVerticalScrollIndicator={false}
        overScrollMode="never"
        contentContainerStyle={{ paddingBottom: 140, paddingHorizontal: 12 }}
        ListHeaderComponent={
          <View className="mx-auto w-full max-w-[460px] gap-4 mb-4 pt-1">
            {/* CABEÇALHO DA TELA */}
            <View className="flex-row items-center justify-between px-1">
              <View className="flex-row items-center gap-2">
                <Calendar size={16} color="#60a5fa" />
                <Text className="text-[11px] font-black uppercase tracking-[2px] text-zinc-400">Dias Anteriores</Text>
              </View>
              <View className="flex-row items-center gap-2">
                <Pressable 
                  className="h-9 w-9 items-center justify-center rounded-2xl bg-[#121216] border border-zinc-800 active:bg-zinc-800" 
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onRefresh();
                  }}
                  disabled={loading}
                  hitSlop={6}
                >
                  <RefreshCw size={15} color="#a1a1aa" className={loading ? "animate-spin" : ""} />
                </Pressable>
                {onVoltar && (
                  <Pressable 
                    className="px-3.5 h-9 items-center justify-center rounded-2xl bg-zinc-800 border border-zinc-700 active:bg-zinc-700" 
                    onPress={() => {
                      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      onVoltar();
                    }}
                    hitSlop={6}
                  >
                    <Text className="text-[10px] font-black text-zinc-200 uppercase">{textoVoltar}</Text>
                  </Pressable>
                )}
              </View>
            </View>

            {/* GRÁFICO DE DESEMPENHO */}
            {chartData.length >= 2 && (
              <View className="rounded-3xl bg-[#121216] border border-zinc-800 p-4 shadow-xl">
                <View className="flex-row items-center justify-between mb-4">
                  <View className="flex-row items-center gap-2">
                    <BarChart2 size={14} color="#a78bfa" />
                    <Text className="text-[9.5px] font-black uppercase tracking-wider text-zinc-400">Fluxo dos últimos 7 dias</Text>
                  </View>
                </View>
                
                <LineChart.Provider data={chartData}>
                  <LineChart height={110} width={Math.min(SCREEN_WIDTH - 64, 400)}>
                    <LineChart.Path color="#a78bfa" width={3}>
                      <LineChart.Gradient color="#a78bfa" />
                    </LineChart.Path>
                    <LineChart.CursorCrosshair color="#f4f4f5">
                      <LineChart.Tooltip textStyle={{ color: '#fff', fontWeight: 'bold', fontSize: 11 }} />
                    </LineChart.CursorCrosshair>
                  </LineChart>
                </LineChart.Provider>
                
                <View className="mt-3 flex-row justify-between items-center px-1">
                  <Text className="text-[8px] font-black text-zinc-500 uppercase">Mais antigo</Text>
                  <Text className="text-[8px] font-black text-zinc-400 uppercase">Hoje / Recente</Text>
                </View>
              </View>
            )}

            {/* BARRA DE PESQUISA */}
            <View className="rounded-2xl border border-zinc-800 bg-[#121216] px-3.5 py-2.5 flex-row items-center gap-2.5 shadow-sm">
              <Search size={14} color="#71717a" />
              <TextInput 
                placeholder="BUSCAR DATA, CAIXA OU OPERADOR..."
                placeholderTextColor="#52525b"
                value={busca}
                onChangeText={setBusca}
                className="flex-1 text-zinc-100 font-bold text-xs uppercase tracking-wider"
              />
              {busca.length > 0 && (
                <Pressable
                  onPress={() => setBusca("")}
                  hitSlop={8}
                  className="p-1 rounded-full bg-zinc-800"
                >
                  <X size={13} color="#a1a1aa" />
                </Pressable>
              )}
            </View>

            {/* DASHBOARD DE ESTATÍSTICAS */}
            <View className="flex-row gap-3">
              <View className="flex-1 bg-[#121216] rounded-2xl p-4 border border-zinc-800">
                 <View className="flex-row items-center gap-2 mb-1.5">
                   <TrendingUp size={14} color="#60a5fa" />
                   <Text className="text-[9px] font-black uppercase tracking-[2px] text-zinc-400">Total Histórico</Text>
                 </View>
                 <Text className="text-base font-black text-zinc-100 tracking-tight" numberOfLines={1} adjustsFontSizeToFit>{toBrl(stats.totalSistema)}</Text>
              </View>
              <View className="flex-1 bg-[#121216] rounded-2xl p-4 border border-emerald-500/25">
                 <View className="flex-row items-center gap-2 mb-1.5">
                   <Banknote size={14} color="#34d399" />
                   <Text className="text-[9px] font-black uppercase tracking-[2px] text-emerald-500">Já Repassado</Text>
                 </View>
                 <Text className="text-base font-black text-emerald-400 tracking-tight" numberOfLines={1} adjustsFontSizeToFit>{toBrl(stats.totalRepassado)}</Text>
              </View>
            </View>
            
            <View className="flex-row items-center justify-between mt-2 px-2">
              <Text className="text-[10px] font-black uppercase tracking-[3px] text-zinc-500">Registros</Text>
              <Pressable onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setMostrarLixeira(!mostrarLixeira);
              }} className="flex-row items-center gap-1.5" hitSlop={10}>
                <Trash2 size={12} color={mostrarLixeira ? "#f87171" : "#71717a"} />
                <Text className={`text-[9px] font-black uppercase tracking-[2px] ${mostrarLixeira ? 'text-red-400' : 'text-zinc-500'}`}>{mostrarLixeira ? 'Ocultar Lixeira' : 'Ver Lixeira'}</Text>
              </Pressable>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View className="rounded-3xl border border-dashed border-zinc-800 py-16 items-center justify-center mt-2 bg-[#121216]/40">
            <Calendar size={36} color="#3f3f46" strokeWidth={1.5} />
            <Text className="mt-3 text-zinc-500 font-bold uppercase tracking-wider text-xs">Nenhum dia encontrado</Text>
          </View>
        }
        ListFooterComponent={
          visibleCount < turnosFiltrados.length ? (
            <Pressable 
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setVisibleCount(prev => prev + 10);
              }}
              className="mx-auto w-full max-w-[460px] flex-row items-center justify-center gap-2 py-4 mt-2 mb-6 rounded-2xl border border-dashed border-zinc-800 active:bg-zinc-900"
            >
              <ChevronDown size={15} color="#52525b" />
              <Text className="text-[10px] font-black uppercase text-zinc-500">Ver mais dias anteriores</Text>
            </Pressable>
          ) : null
        }
      />
    </View>
  );
}

export const HistoricoScreen = memo(HistoricoScreenComponent);
