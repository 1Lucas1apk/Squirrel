import React, { useMemo } from 'react';
import { View, Text, Pressable, ScrollView, Modal, Platform } from 'react-native';
import { 
  X, 
  Sparkles, 
  TrendingUp, 
  Calendar, 
  Award, 
  Banknote, 
  Zap, 
  ArrowUpRight, 
  Crown,
  Scale,
  Trophy,
  Info
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Turno } from '../types/domain';
import { toBrl } from '../utils/currency';

interface RetrospectiveScreenProps {
  turnos: Turno[];
  onClose: () => void;
}

export function RetrospectiveScreen({ turnos, onClose }: RetrospectiveScreenProps) {
  const triggerHaptic = (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) => {
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(style);
    }
  };

  const stats = useMemo(() => {
    if (!turnos || !Array.isArray(turnos) || turnos.length === 0) return null;

    const turnosValidos = turnos.filter(t => t && !t.excluido);
    if (turnosValidos.length === 0) return null;

    const totalDias = turnosValidos.length;
    const totalSistema = turnosValidos.reduce((acc, t) => acc + (t.totais?.sistema || 0), 0);
    const mediaPorDia = totalDias > 0 ? totalSistema / totalDias : 0;
    
    // Dia Recorde
    const sortedBySistema = [...turnosValidos].sort((a, b) => (b.totais?.sistema || 0) - (a.totais?.sistema || 0));
    const diaRecorde = sortedBySistema[0] || null;
    
    // Dia Mais Difícil (Maior Quebra / Menor Sobra)
    const sortedByQuebra = [...turnosValidos].sort((a, b) => (a.totais?.sobra || 0) - (b.totais?.sobra || 0));
    const diaDificil = sortedByQuebra[0] || null;
    
    // Sobras e Quebras
    const totalSobra = turnosValidos.reduce((acc, t) => acc + (t.totais?.sobra || 0), 0);
    const diasPerfeitos = turnosValidos.filter(t => Math.abs(t.totais?.sobra || 0) < 0.01).length;
    const taxaPrecisao = totalDias > 0 ? (diasPerfeitos / totalDias) * 100 : 100;

    // Volume Financeiro
    const totalDinheiroSaco = turnosValidos.reduce((acc, t) => acc + (t.totais?.especieEnvelope || 0), 0);
    const totalPixRepasse = turnosValidos.reduce((acc, t) => acc + (t.totais?.pixRepasse || 0), 0);
    
    // Patente do Operador
    let titulo = "Operador Iniciante";
    let subTitulo = "Começando a trilha agora.";
    let badgeNivel = "NÍVEL 1 • APRENDIZ";

    if (totalDias >= 3 && totalDias <= 7) {
      titulo = "Operador Fiel";
      subTitulo = "Mantendo o caixa em ordem constante.";
      badgeNivel = "NÍVEL 2 • PRATA";
    } else if (totalDias > 7 && taxaPrecisao >= 80) {
      titulo = "Mestre da Gaveta";
      subTitulo = "Precisão cirúrgica no fechamento de turnos.";
      badgeNivel = "NÍVEL ELITE • OURO";
    } else if (totalDias > 15 || totalSistema > 50000) {
      titulo = "Elite Squirrel";
      subTitulo = "Alto volume operacional sob controle absoluto.";
      badgeNivel = "NÍVEL MASTER • DIAMANTE";
    }

    return {
      totalDias,
      totalSistema,
      mediaPorDia,
      diaRecorde,
      diaDificil,
      totalSobra,
      diasPerfeitos,
      taxaPrecisao,
      totalDinheiroSaco,
      totalPixRepasse,
      titulo,
      subTitulo,
      badgeNivel
    };
  }, [turnos]);

  if (!stats) {
    return (
      <Modal visible transparent animationType="fade" onRequestClose={onClose}>
        <View className="flex-1 bg-black/90 items-center justify-center p-4">
          <View className="w-full max-w-[380px] bg-[#0d0d12] border border-zinc-800 rounded-[36px] p-7 items-center shadow-2xl">
            <View className="h-16 w-16 rounded-3xl bg-amber-500/10 border border-amber-500/20 items-center justify-center mb-4">
              <Info size={32} color="#fbbf24" />
            </View>
            <Text className="text-base font-black uppercase text-white mb-2 text-center">Sem Dados Históricos</Text>
            <Text className="text-xs text-zinc-400 font-medium text-center leading-5 mb-6">
              Conclua seu primeiro fechamento de caixa para desbloquear as estatísticas e recordes operacionais.
            </Text>
            <Pressable 
              onPress={() => {
                triggerHaptic();
                onClose();
              }}
              className="w-full py-4 rounded-2xl bg-zinc-100 items-center justify-center active:scale-[0.98]"
            >
              <Text className="text-xs font-black uppercase text-zinc-950">Voltar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    );
  }

  const precisaoPercent = Math.min(100, Math.max(0, stats.taxaPrecisao));

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-black/90 items-center justify-center p-4">
        <View className="w-full max-w-[400px] max-h-[92%] bg-[#0d0d12] border border-zinc-800 rounded-[36px] p-5 shadow-2xl flex-shrink">
          
          {/* Top Indicator */}
          <View className="items-center pt-0 pb-1.5">
            <View className="w-10 h-1 rounded-full bg-zinc-800" />
          </View>

          {/* Header */}
          <View className="flex-row items-center justify-between pb-3 border-b border-zinc-900 mb-3">
            <View className="flex-row items-center gap-3">
              <View className="h-10 w-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 items-center justify-center">
                <Sparkles size={18} color="#fbbf24" />
              </View>
              <View>
                <View className="flex-row items-center gap-1.5">
                  <Text className="text-[10px] font-black uppercase tracking-[2px] text-zinc-500">Histórico</Text>
                  <View className="px-1.5 py-0.5 rounded bg-amber-500/20">
                    <Text className="text-amber-400 text-[8px] font-black">{stats.totalDias} TURNOS</Text>
                  </View>
                </View>
                <Text className="text-sm font-black uppercase text-zinc-100">Você Sabia?</Text>
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

          {/* Conteúdo com Scroll */}
          <ScrollView 
            showsVerticalScrollIndicator={false}
            overScrollMode="never"
            className="flex-shrink"
            contentContainerStyle={{ paddingBottom: 16, gap: 12 }}
          >
            {/* 1. CARD DE PATENTE DO OPERADOR */}
            <View className="bg-[#121216] p-4 rounded-[26px] border border-amber-500/30 shadow-md">
              <View className="flex-row items-center gap-3 mb-3">
                <View className="h-11 w-11 rounded-2xl bg-amber-500/20 border border-amber-500/40 items-center justify-center shadow-inner">
                  <Crown size={20} color="#fbbf24" />
                </View>
                <View className="flex-1 min-w-0">
                  <View className="flex-row items-center gap-2 mb-0.5">
                    <View className="bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                      <Text className="text-[8px] font-mono font-bold text-amber-400 uppercase">
                        {stats.badgeNivel}
                      </Text>
                    </View>
                  </View>
                  <Text className="text-base font-black uppercase text-white tracking-tight leading-tight">
                    {stats.titulo}
                  </Text>
                  <Text className="text-[9px] text-zinc-400 font-medium truncate mt-0.5">
                    {stats.subTitulo}
                  </Text>
                </View>
              </View>

              {/* Barra de Precisão */}
              <View className="pt-2 border-t border-zinc-800/80 gap-1">
                <View className="flex-row justify-between items-center">
                  <Text className="text-[9px] font-black uppercase text-zinc-400">Taxa de Caixas Perfeitos</Text>
                  <Text className="text-[9px] font-mono font-black text-emerald-400">
                    {stats.diasPerfeitos} / {stats.totalDias} ({Math.round(precisaoPercent)}%)
                  </Text>
                </View>
                <View className="w-full h-2 bg-[#09090c] rounded-full overflow-hidden p-0.5 border border-zinc-800">
                  <View 
                    className="h-full bg-emerald-500 rounded-full" 
                    style={{ width: `${precisaoPercent}%` }}
                  />
                </View>
              </View>
            </View>

            {/* 2. GRID 2x2 DE MÉTRICAS PRINCIPAIS */}
            <View className="flex-row gap-2">
              {/* Volume Total */}
              <View className="flex-1 bg-[#121216] p-3 rounded-2xl border border-zinc-800/80 justify-between">
                <View className="flex-row items-center justify-between mb-1.5">
                  <View className="h-7 w-7 rounded-xl bg-purple-500/15 border border-purple-500/30 items-center justify-center">
                    <TrendingUp size={13} color="#c084fc" />
                  </View>
                  <Text className="text-[8px] font-mono font-bold text-zinc-500">TOTAL</Text>
                </View>
                <View>
                  <Text className="text-[8px] font-black uppercase text-zinc-400 mb-0.5">Volume Total</Text>
                  <Text className="text-xs font-black font-mono text-purple-300">
                    {toBrl(stats.totalSistema)}
                  </Text>
                  <Text className="text-[7px] text-zinc-500 mt-0.5">
                    {stats.totalDias} turnos somados
                  </Text>
                </View>
              </View>

              {/* Média por Turno */}
              <View className="flex-1 bg-[#121216] p-3 rounded-2xl border border-zinc-800/80 justify-between">
                <View className="flex-row items-center justify-between mb-1.5">
                  <View className="h-7 w-7 rounded-xl bg-blue-500/15 border border-blue-500/30 items-center justify-center">
                    <Calendar size={13} color="#60a5fa" />
                  </View>
                  <Text className="text-[8px] font-mono font-bold text-zinc-500">MÉDIA</Text>
                </View>
                <View>
                  <Text className="text-[8px] font-black uppercase text-zinc-400 mb-0.5">Média Diária</Text>
                  <Text className="text-xs font-black font-mono text-blue-300">
                    {toBrl(stats.mediaPorDia)}
                  </Text>
                  <Text className="text-[7px] text-zinc-500 mt-0.5">
                    Por abertura
                  </Text>
                </View>
              </View>
            </View>

            <View className="flex-row gap-2">
              {/* Dinheiro em Espécie / Malote */}
              <View className="flex-1 bg-[#121216] p-3 rounded-2xl border border-zinc-800/80 justify-between">
                <View className="flex-row items-center justify-between mb-1.5">
                  <View className="h-7 w-7 rounded-xl bg-emerald-500/15 border border-emerald-500/30 items-center justify-center">
                    <Banknote size={13} color="#34d399" />
                  </View>
                  <Text className="text-[8px] font-mono font-bold text-emerald-400">MALOTE</Text>
                </View>
                <View>
                  <Text className="text-[8px] font-black uppercase text-zinc-400 mb-0.5">Dinheiro Físico</Text>
                  <Text className="text-xs font-black font-mono text-emerald-400">
                    {toBrl(stats.totalDinheiroSaco)}
                  </Text>
                  <Text className="text-[7px] text-zinc-500 mt-0.5">
                    Em envelopes
                  </Text>
                </View>
              </View>

              {/* Repasse Pix */}
              <View className="flex-1 bg-[#121216] p-3 rounded-2xl border border-zinc-800/80 justify-between">
                <View className="flex-row items-center justify-between mb-1.5">
                  <View className="h-7 w-7 rounded-xl bg-cyan-500/15 border border-cyan-500/30 items-center justify-center">
                    <ArrowUpRight size={13} color="#22d3ee" />
                  </View>
                  <Text className="text-[8px] font-mono font-bold text-cyan-400">PIX</Text>
                </View>
                <View>
                  <Text className="text-[8px] font-black uppercase text-zinc-400 mb-0.5">Repasses Pix</Text>
                  <Text className="text-xs font-black font-mono text-cyan-400">
                    {toBrl(stats.totalPixRepasse)}
                  </Text>
                  <Text className="text-[7px] text-zinc-500 mt-0.5">
                    Transferências
                  </Text>
                </View>
              </View>
            </View>

            {/* 3. EXTREMOS & RECORDES */}
            <View className="bg-[#121216] p-3.5 rounded-[26px] border border-zinc-800/80 shadow-md gap-2.5">
              <View className="flex-row items-center gap-2 pb-2 border-b border-zinc-800/60">
                <View className="h-6 w-6 rounded-lg bg-amber-500/15 border border-amber-500/30 items-center justify-center">
                  <Trophy size={12} color="#fbbf24" />
                </View>
                <Text className="text-xs font-black uppercase text-zinc-200">Extremos & Recordes</Text>
              </View>

              {/* Dia de Ouro */}
              <View className="bg-[#09090c] p-2.5 rounded-2xl border border-amber-500/20 flex-row items-center justify-between">
                <View className="flex-row items-center gap-2.5 flex-1 mr-2">
                  <View className="h-8 w-8 rounded-xl bg-amber-500/10 items-center justify-center border border-amber-500/20">
                    <Award size={15} color="#fbbf24" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[8px] font-black uppercase text-amber-400">Dia de Ouro (Recorde)</Text>
                    <Text className="text-[11px] font-black text-zinc-200 font-mono">
                      {stats.diaRecorde?.dataReferencia || "—"}
                    </Text>
                  </View>
                </View>
                <View className="items-end">
                  <Text className="text-xs font-black font-mono text-amber-400">
                    {toBrl(stats.diaRecorde?.totais?.sistema || 0)}
                  </Text>
                  <Text className="text-[7px] text-zinc-500">Maior faturamento</Text>
                </View>
              </View>

              {/* Maior Divergência */}
              {stats.diaDificil && (
                <View className="bg-[#09090c] p-2.5 rounded-2xl border border-zinc-800 flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2.5 flex-1 mr-2">
                    <View className="h-8 w-8 rounded-xl bg-red-500/10 items-center justify-center border border-red-500/20">
                      <Zap size={15} color="#f87171" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-[8px] font-black uppercase text-red-400">Maior Desafio / Quebra</Text>
                      <Text className="text-[11px] font-black text-zinc-200 font-mono">
                        {stats.diaDificil.dataReferencia || "—"}
                      </Text>
                    </View>
                  </View>
                  <View className="items-end">
                    <Text className="text-xs font-black font-mono text-red-400">
                      {toBrl(stats.diaDificil.totais?.sobra || 0)}
                    </Text>
                    <Text className="text-[7px] text-zinc-500">Divergência</Text>
                  </View>
                </View>
              )}
            </View>

            {/* 4. BALANÇO GERAL DE GAVETA */}
            <View className="bg-[#121216] p-3.5 rounded-[26px] border border-zinc-800/80 shadow-md gap-2">
              <View className="flex-row items-center justify-between pb-2 border-b border-zinc-800/60">
                <View className="flex-row items-center gap-2">
                  <View className="h-6 w-6 rounded-lg bg-emerald-500/15 border border-emerald-500/30 items-center justify-center">
                    <Scale size={12} color="#34d399" />
                  </View>
                  <Text className="text-xs font-black uppercase text-zinc-200">Balanço Geral de Gaveta</Text>
                </View>
                <View className={`px-2 py-0.5 rounded-full border ${stats.totalSobra >= 0 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                  <Text className={`text-[8px] font-mono font-bold ${stats.totalSobra >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {stats.totalSobra >= 0 ? "POSITIVO" : "ATENÇÃO"}
                  </Text>
                </View>
              </View>

              <View className="bg-[#09090c] p-3 rounded-2xl border border-zinc-800 flex-row items-center justify-between">
                <View>
                  <Text className="text-[8px] font-black uppercase text-zinc-500 mb-0.5">Saldo Acumulado</Text>
                  <Text className={`text-sm font-black font-mono ${stats.totalSobra >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {stats.totalSobra >= 0 ? `+${toBrl(stats.totalSobra)}` : toBrl(stats.totalSobra)}
                  </Text>
                </View>
                <View className="items-end max-w-[170px]">
                  <Text className="text-[8px] text-zinc-400 text-right leading-3">
                    {stats.totalSobra >= 0 ? "Sobras superaram quebras." : "Quebras superaram sobras."}
                  </Text>
                  <Text className={`text-[8px] font-bold mt-0.5 ${stats.totalSobra >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {stats.totalSobra >= 0 ? "Caixa Altamente Saudável" : "Atenção no Troco"}
                  </Text>
                </View>
              </View>
            </View>
          </ScrollView>

          {/* 5. BOTÃO CONCLUIR */}
          <Pressable 
            onPress={() => {
              triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
              onClose();
            }}
            className="w-full py-4 rounded-2xl bg-zinc-100 items-center justify-center shadow-xl active:scale-[0.98] mt-2"
          >
            <Text className="text-center font-black uppercase text-xs tracking-wider text-zinc-950">
              Continuar Evoluindo
            </Text>
          </Pressable>

        </View>
      </View>
    </Modal>
  );
}
