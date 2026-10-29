import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, Modal, ScrollView, Dimensions, Platform } from 'react-native';
import { 
  X, 
  TrendingUp, 
  Activity, 
  Clock, 
  Wallet, 
  Flame, 
  ArrowUpRight, 
  ArrowDownRight,
  Info 
} from 'lucide-react-native';
import { LineChart } from "react-native-wagmi-charts";
import * as Haptics from 'expo-haptics';
import { Transacao, TotaisTurno } from '../types/domain';
import { toBrl } from '../utils/currency';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface AnalyticsModalProps {
  visible: boolean;
  onClose: () => void;
  transacoes: Transacao[];
  totais: TotaisTurno;
}

export function AnalyticsModal({ visible, onClose, transacoes, totais }: AnalyticsModalProps) {
  const [activeTab, setActiveTab] = useState<'trilha' | 'picos'>('trilha');

  const triggerHaptic = (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) => {
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(style);
    }
  };

  // 1. Processar dados para o Fluxo de Caixa (Timeline)
  const { chartData, totalEntradas, totalSaidas, picoMaximo } = useMemo(() => {
    if (!transacoes || transacoes.length === 0) {
      return { chartData: [], totalEntradas: 0, totalSaidas: 0, picoMaximo: 0 };
    }
    
    // Ordena por tempo (antigo para novo)
    const sorted = [...transacoes].sort((a, b) => a.timestamp - b.timestamp);
    
    let runningBalance = 0;
    let entradas = 0;
    let saidas = 0;
    let maxVal = 0;
    
    const points = sorted.map(t => {
      const isSaida = t.categoria === "sangria" || t.categoria === "cancelamento";
      
      if (isSaida) {
        runningBalance -= t.valorSistema;
        saidas += t.valorSistema;
      } else {
        runningBalance += t.valorRecebidoFisico;
        entradas += t.valorRecebidoFisico;
      }

      if (runningBalance > maxVal) {
        maxVal = runningBalance;
      }
      
      return {
        timestamp: t.timestamp,
        value: runningBalance,
      };
    });

    return {
      chartData: points,
      totalEntradas: entradas,
      totalSaidas: saidas,
      picoMaximo: maxVal
    };
  }, [transacoes]);

  // 2. Processar dados para o Balanço por Hora
  const { hourlyData, peakHour, maxHourlyCount } = useMemo(() => {
    const hours: Record<number, { count: number; value: number }> = {};
    
    // Horário comercial de 07h até 22h
    for (let i = 7; i <= 22; i++) {
      hours[i] = { count: 0, value: 0 };
    }

    if (transacoes && Array.isArray(transacoes)) {
      transacoes.forEach(t => {
        const h = new Date(t.timestamp).getHours();
        if (hours[h]) {
          hours[h].count += 1;
          const isSaida = t.categoria === "sangria" || t.categoria === "cancelamento";
          hours[h].value += isSaida ? -t.valorSistema : t.valorRecebidoFisico;
        }
      });
    }

    const list = Object.entries(hours).map(([hour, data]) => ({
      hour: parseInt(hour, 10),
      ...data
    }));

    let maxCount = 1;
    let peak = list[0];

    list.forEach(item => {
      if (item.count > maxCount) {
        maxCount = item.count;
      }
      if (item.count > (peak?.count || 0)) {
        peak = item;
      }
    });

    return {
      hourlyData: list,
      peakHour: peak,
      maxHourlyCount: maxCount
    };
  }, [transacoes]);

  return (
    <Modal 
      visible={visible} 
      transparent 
      animationType="fade" 
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/90 items-center justify-center p-4">
        <View className="w-full max-w-[400px] max-h-[92%] bg-[#0d0d12] border border-zinc-800 rounded-[36px] p-5 shadow-2xl flex-shrink">
          
          {/* Top Indicator */}
          <View className="items-center pt-0 pb-1.5">
            <View className="w-10 h-1 rounded-full bg-zinc-800" />
          </View>

          {/* Header */}
          <View className="flex-row items-center justify-between pb-3 border-b border-zinc-900 mb-3">
            <View className="flex-row items-center gap-3">
              <View className="h-10 w-10 rounded-2xl bg-blue-500/15 border border-blue-500/30 items-center justify-center">
                <Activity size={18} color="#60a5fa" />
              </View>
              <View>
                <View className="flex-row items-center gap-1.5">
                  <Text className="text-[10px] font-black uppercase tracking-[2px] text-zinc-500">Expediente</Text>
                  <View className="px-1.5 py-0.5 rounded bg-blue-500/20">
                    <Text className="text-blue-400 text-[8px] font-black">HOJE</Text>
                  </View>
                </View>
                <Text className="text-sm font-black uppercase text-zinc-100">Mapa de Movimentação</Text>
              </View>
            </View>
            <Pressable 
              onPress={() => {
                triggerHaptic();
                onClose();
              }} 
              className="h-8 w-8 bg-zinc-900 rounded-full items-center justify-center border border-zinc-800 active:bg-zinc-800"
            >
              <X size={15} color="#a1a1aa" />
            </Pressable>
          </View>

          {/* Seletor de Sub-Abas */}
          <View className="bg-[#121216] p-1 rounded-2xl border border-zinc-800 flex-row gap-1 mb-3">
            <Pressable 
              onPress={() => {
                triggerHaptic();
                setActiveTab('trilha');
              }}
              className={`flex-1 py-2 rounded-xl items-center justify-center ${
                activeTab === 'trilha' ? 'bg-blue-500 shadow' : 'bg-transparent'
              }`}
            >
              <Text className={`text-[10px] font-black uppercase ${
                activeTab === 'trilha' ? 'text-white' : 'text-zinc-400'
              }`}>
                Trilha da Gaveta
              </Text>
            </Pressable>
            <Pressable 
              onPress={() => {
                triggerHaptic();
                setActiveTab('picos');
              }}
              className={`flex-1 py-2 rounded-xl items-center justify-center ${
                activeTab === 'picos' ? 'bg-blue-500 shadow' : 'bg-transparent'
              }`}
            >
              <Text className={`text-[10px] font-black uppercase ${
                activeTab === 'picos' ? 'text-white' : 'text-zinc-400'
              }`}>
                Picos por Hora
              </Text>
            </Pressable>
          </View>

          {/* Conteúdo com Scroll */}
          <ScrollView 
            showsVerticalScrollIndicator={false}
            overScrollMode="never"
            className="flex-shrink"
            contentContainerStyle={{ paddingBottom: 16, gap: 12 }}
          >
            {/* STATS RÁPIDOS 2 COLUNAS */}
            <View className="flex-row gap-2">
              <View className="flex-1 bg-[#121216] p-3 rounded-2xl border border-zinc-800/80">
                <Text className="text-[8px] font-black uppercase tracking-wider text-zinc-400 mb-0.5">
                  Pico Máximo de Saldo
                </Text>
                <Text className="text-xs font-black font-mono text-emerald-400">
                  {toBrl(picoMaximo)}
                </Text>
                <Text className="text-[7px] text-zinc-500 mt-0.5">
                  Registrado no turno
                </Text>
              </View>
              <View className="flex-1 bg-[#121216] p-3 rounded-2xl border border-zinc-800/80">
                <Text className="text-[8px] font-black uppercase tracking-wider text-zinc-400 mb-0.5">
                  Saldo em Mãos
                </Text>
                <Text className="text-xs font-black font-mono text-blue-300">
                  {toBrl(totais?.gavetaFisico || 0)}
                </Text>
                <Text className="text-[7px] text-zinc-500 mt-0.5">
                  Na gaveta física
                </Text>
              </View>
            </View>

            {activeTab === 'trilha' ? (
              <View className="gap-3">
                {/* CARD DO GRÁFICO */}
                <View className="bg-[#121216] p-4 rounded-[26px] border border-zinc-800/80 shadow-md">
                  <View className="flex-row items-center justify-between pb-2 border-b border-zinc-800/60 mb-2.5">
                    <View className="flex-row items-center gap-2">
                      <View className="h-6 w-6 rounded-lg bg-blue-500/15 border border-blue-500/30 items-center justify-center">
                        <TrendingUp size={12} color="#60a5fa" />
                      </View>
                      <Text className="text-xs font-black uppercase text-zinc-200">Evolução do Saldo Físico</Text>
                    </View>
                    <View className="bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                      <Text className="text-[8px] font-mono font-bold text-blue-400">AO VIVO</Text>
                    </View>
                  </View>

                  {chartData.length >= 2 ? (
                    <View className="bg-[#09090c] p-2 rounded-2xl border border-zinc-800/80 mb-2 items-center">
                      <LineChart.Provider data={chartData}>
                        <LineChart height={150} width={Math.min(SCREEN_WIDTH - 60, 340)}>
                          <LineChart.Path color="#60a5fa" width={3}>
                            <LineChart.Gradient color="#60a5fa" />
                          </LineChart.Path>
                          <LineChart.CursorCrosshair color="#f4f4f5">
                            <LineChart.Tooltip textStyle={{ color: '#fff', fontWeight: 'bold', fontSize: 10 }} />
                          </LineChart.CursorCrosshair>
                        </LineChart>
                      </LineChart.Provider>
                      <View className="w-full flex-row justify-between pt-1 px-1">
                        <Text className="text-[8px] font-mono text-zinc-500">Abertura</Text>
                        <Text className="text-[8px] font-mono text-zinc-500">Agora</Text>
                      </View>
                    </View>
                  ) : (
                    <View className="bg-[#09090c] p-6 rounded-2xl border border-zinc-800/80 items-center justify-center mb-2">
                      <Clock size={28} color="#3f3f46" />
                      <Text className="text-[10px] text-zinc-400 font-medium text-center mt-2">
                        Lance os primeiros registros de caixa para visualizar a curva de saldo.
                      </Text>
                    </View>
                  )}

                  <Text className="text-[9px] text-zinc-400 font-medium leading-4">
                    O gráfico reflete entradas de dinheiro em espécie e quedas causadas por retiradas e sangrias no turno.
                  </Text>
                </View>

                {/* RESUMO DE ENTRADAS VS RETIRADAS */}
                <View className="bg-[#121216] p-4 rounded-[26px] border border-zinc-800/80 shadow-md">
                  <Text className="text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-2.5">
                    Composição do Fluxo
                  </Text>
                  <View className="flex-row gap-2">
                    <View className="flex-1 bg-[#09090c] p-3 rounded-2xl border border-emerald-500/20">
                      <View className="flex-row items-center justify-between mb-0.5">
                        <Text className="text-[8px] font-black uppercase text-emerald-400">Total Recebido</Text>
                        <ArrowUpRight size={11} color="#34d399" />
                      </View>
                      <Text className="text-xs font-black font-mono text-emerald-300">
                        {toBrl(totalEntradas)}
                      </Text>
                      <Text className="text-[7px] text-zinc-500 mt-0.5">Vendas em espécie</Text>
                    </View>
                    <View className="flex-1 bg-[#09090c] p-3 rounded-2xl border border-red-500/20">
                      <View className="flex-row items-center justify-between mb-0.5">
                        <Text className="text-[8px] font-black uppercase text-red-400">Total Retirado</Text>
                        <ArrowDownRight size={11} color="#f87171" />
                      </View>
                      <Text className="text-xs font-black font-mono text-red-300">
                        {toBrl(totalSaidas)}
                      </Text>
                      <Text className="text-[7px] text-zinc-500 mt-0.5">Sangrias & Baixas</Text>
                    </View>
                  </View>
                </View>
              </View>
            ) : (
              <View className="gap-3">
                {/* HORÁRIO MAIS MOVIMENTADO */}
                {peakHour && peakHour.count > 0 && (
                  <View className="bg-[#121216] p-4 rounded-[26px] border border-amber-500/30 shadow-md flex-row items-center gap-3">
                    <View className="h-10 w-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 items-center justify-center">
                      <Flame size={20} color="#fbbf24" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-[8px] font-black uppercase text-amber-400 tracking-wider">
                        Horário Mais Movimentado
                      </Text>
                      <Text className="text-xs font-black text-white uppercase">
                        {peakHour.hour}h às {peakHour.hour + 1}h ({peakHour.count} lançamentos)
                      </Text>
                      <Text className="text-[8px] text-zinc-400 font-mono">
                        Volume líquido: {toBrl(peakHour.value)}
                      </Text>
                    </View>
                  </View>
                )}

                {/* BARRAS DE GIRO POR HORA */}
                <View className="bg-[#121216] p-4 rounded-[26px] border border-zinc-800/80 shadow-md">
                  <Text className="text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-2.5">
                    Giro de Caixa por Hora
                  </Text>
                  
                  <View className="bg-[#09090c] rounded-2xl border border-zinc-800/80 p-2.5 pt-3">
                    <View className="flex-row items-end justify-between h-40 gap-1">
                      {hourlyData.filter(d => d.hour >= 8 && d.hour <= 20).map((item) => {
                        const isPeak = peakHour && peakHour.hour === item.hour && item.count > 0;
                        const hasActivity = item.count > 0;
                        const heightPercent = maxHourlyCount > 0 ? Math.round((item.count / maxHourlyCount) * 100) : 0;
                        const barHeightPercent = hasActivity ? Math.max(16, Math.min(100, heightPercent)) : 6;

                        return (
                          <View key={item.hour} className="flex-1 flex-col items-center justify-between h-full">
                            {/* Top Label (Count) */}
                            <View className="h-4 items-center justify-center">
                              {item.count > 0 ? (
                                <Text className={`text-[8px] font-mono font-bold ${isPeak ? 'text-amber-400' : 'text-zinc-400'}`}>
                                  {item.count}x
                                </Text>
                              ) : (
                                <Text className="text-[8px] text-transparent leading-none">-</Text>
                              )}
                            </View>

                            {/* Bar Track */}
                            <View className="w-full flex-1 justify-end items-center px-0.5 py-1">
                              <View 
                                className={`w-full rounded-t-sm ${
                                  isPeak 
                                    ? 'bg-amber-400' 
                                    : hasActivity 
                                      ? (item.value >= 0 ? 'bg-blue-500' : 'bg-red-500') 
                                      : 'bg-zinc-800/50'
                                }`}
                                style={{ height: `${barHeightPercent}%`, minHeight: hasActivity ? 6 : 3 }}
                              />
                            </View>

                            {/* Bottom Label (Hour) */}
                            <View className="h-4 items-center justify-center">
                              <Text className={`text-[8px] font-mono font-black ${isPeak ? 'text-amber-400' : hasActivity ? 'text-zinc-300' : 'text-zinc-600'}`}>
                                {item.hour}h
                              </Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </View>

                  <View className="flex-row items-center justify-center gap-4 mt-3 pt-2 border-t border-zinc-800/60">
                    <View className="flex-row items-center gap-1.5">
                      <View className="h-2 w-2 rounded-full bg-blue-500" />
                      <Text className="text-[8px] font-bold text-zinc-400 uppercase">Entrada</Text>
                    </View>
                    <View className="flex-row items-center gap-1.5">
                      <View className="h-2 w-2 rounded-full bg-amber-400" />
                      <Text className="text-[8px] font-bold text-zinc-400 uppercase">Pico do Dia</Text>
                    </View>
                    <View className="flex-row items-center gap-1.5">
                      <View className="h-2 w-2 rounded-full bg-red-500" />
                      <Text className="text-[8px] font-bold text-zinc-400 uppercase">Saída/Sangria</Text>
                    </View>
                  </View>
                </View>
              </View>
            )}

            <View className="flex-row items-center gap-2 px-1 pt-1">
              <Wallet size={12} color="#71717a" />
              <Text className="text-[8px] text-zinc-500 font-medium">
                Análise em tempo real baseada nas transações registradas neste turno.
              </Text>
            </View>
          </ScrollView>

          {/* Botão Fechar */}
          <Pressable 
            onPress={() => {
              triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
              onClose();
            }}
            className="w-full py-4 rounded-2xl bg-zinc-100 items-center justify-center shadow-xl active:scale-[0.98] mt-2"
          >
            <Text className="text-center font-black uppercase text-xs tracking-wider text-zinc-950">
              Fechar Mapa
            </Text>
          </Pressable>

        </View>
      </View>
    </Modal>
  );
}
