import React, { ReactNode, useState, useRef, useMemo } from "react";
import { Text, View, Pressable, Modal, Platform, useWindowDimensions } from "react-native";
import { 
  Monitor, 
  Coins, 
  Vault, 
  Mail, 
  Wallet, 
  ArrowRightLeft, 
  Smartphone,
  Info,
  AlertTriangle,
  CheckCircle2,
  Banknote,
  CreditCard,
  Building2,
  Pin,
  PenLine,
  ArrowUpRight,
  CheckSquare,
  SlidersHorizontal,
  Plus
} from "lucide-react-native";
import * as Haptics from 'expo-haptics';
import { TotaisTurno, Transacao, LembreteFantasma } from "../../types/domain";
import { toBrl } from "../../utils/currency";
import { useAppSettings } from "../../hooks/use-app-settings";
import { MoneyInput } from "../common/money-input";

interface PainelPrincipalProps {
  totais: TotaisTurno;
  pendenciasFantasma: number;
  valorTerceiros?: number;
  isDiscreto?: boolean;
  onOpenChat?: () => void;
  ultimaMensagemGlobal?: string;
  transacoes?: Transacao[];
  fantasmas?: LembreteFantasma[];
  registrosPOS?: any[];
  registrosConvenio?: any[];
  ajusteManualSobra?: number;
  onAjusteSobra?: (val: number | ((prev: number) => number)) => void;
  onNavigateToChecklist?: () => void;
  isFechado?: boolean;
}

export const PainelPrincipal = React.memo(function PainelPrincipal({
  totais,
  pendenciasFantasma,
  valorTerceiros = 0,
  isDiscreto,
  onOpenChat,
  ultimaMensagemGlobal,
  transacoes = [],
  fantasmas = [],
  registrosPOS = [],
  registrosConvenio = [],
  ajusteManualSobra = 0,
  onAjusteSobra,
  onNavigateToChecklist,
  isFechado
}: PainelPrincipalProps) {
  const { settings } = useAppSettings();
  const { width } = useWindowDimensions();

  // Detecção de tela responsiva
  const isNarrow = width < 375; // Telas compactas (320px - 360px)
  const isWide = width >= 430;   // Telas grandes (Max / Plus / Tablets)

  // Multiplicador de escala de fonte definido pelo usuário
  const fontMult = settings.fontScale === 'compact' ? 0.88 : settings.fontScale === 'large' ? 1.15 : 1.0;

  const triggerHaptic = (type: "light" | "medium" | "heavy" | "success" = "light") => {
    if (!settings.hapticsEnabled || Platform.OS === 'web') return;
    try {
      if (type === "light") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      else if (type === "medium") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      else if (type === "heavy") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      else if (type === "success") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
  };

  // No modo discreto, simulamos que todo o Pix interno é dinheiro físico na gaveta
  const gavetaSimulada = isDiscreto 
    ? (totais.gavetaFisico + (totais.pixNoCaixa || 0) + (totais.pixDiretoLoja || 0)) 
    : totais.gavetaFisico;

  const envelopeSimulado = isDiscreto ? totais.sistema : totais.especieEnvelope;
  const pixSimulado = isDiscreto ? 0 : totais.pixRepasse;

  const isNegativo = totais.sobra < 0;
  const isPerfeito = Math.abs(totais.sobra) < 0.005;

  // Contadores reais da sessão
  const totalVendasCount = transacoes.length;
  const totalConferidosCount = useMemo(() => {
    return transacoes.filter(t => t.statusConferencia === "confirmada").length;
  }, [transacoes]);

  const totalPixTransacoesCount = useMemo(() => {
    return fantasmas.filter(f => f.tipo === 'pix_recebido_gaveta_saiu').length;
  }, [fantasmas]);

  const totalSaidasValor = useMemo(() => {
    return transacoes
      .filter(t => t.categoria === 'sangria' || t.categoria === 'cancelamento')
      .reduce((acc, t) => acc + (t.valorRecebidoFisico || t.valorSistema || 0), 0);
  }, [transacoes]);

  const totalSaidasCount = useMemo(() => {
    return transacoes.filter(t => t.categoria === 'sangria' || t.categoria === 'cancelamento').length;
  }, [transacoes]);

  const totalPOSCount = (registrosPOS || []).length;
  const totalConvenioCount = (registrosConvenio || []).length;

  // Proporção de papel vs pix (para a barra visual)
  const absSistema = Math.abs(totais.sistema) || 1;
  const hasMovements = Math.abs(totais.sistema) > 0 || Math.abs(envelopeSimulado) > 0 || Math.abs(pixSimulado) > 0;
  const papelPercent = hasMovements ? Math.min(100, Math.max(0, (envelopeSimulado / absSistema) * 100)) : 50;
  const pixPercent = 100 - papelPercent;

  // Gabarito de Cédulas (3 toques rápidos)
  const clickCount = useRef(0);
  const lastClickTime = useRef(0);
  const [showGabarito, setShowGabarito] = useState(false);

  const handleSystemClick = () => {
    triggerHaptic("light");
    const now = Date.now();
    if (now - lastClickTime.current < 400) {
      if (clickCount.current + 1 >= 3) {
        setShowGabarito(true);
        triggerHaptic("success");
        clickCount.current = 0;
      } else {
        clickCount.current += 1;
      }
    } else {
      clickCount.current = 1;
    }
    lastClickTime.current = now;
  };

  const [localAjuste, setLocalAjuste] = useState(ajusteManualSobra || 0);
  const [prevAjusteProp, setPrevAjusteProp] = useState(ajusteManualSobra || 0);

  if (prevAjusteProp !== (ajusteManualSobra || 0)) {
    setPrevAjusteProp(ajusteManualSobra || 0);
    setLocalAjuste(ajusteManualSobra || 0);
  }

  // Funções de incremento do Ajuste 100% instantâneas (0ms) na UI
  const handleAddUmReal = () => {
    triggerHaptic("light");
    const nextVal = Math.round(((localAjuste || 0) + 1.00) * 100) / 100;
    setLocalAjuste(nextVal);
    onAjusteSobra?.(nextVal);
  };

  const handleZerarAjuste = () => {
    triggerHaptic("medium");
    setLocalAjuste(0);
    onAjusteSobra?.(0.00);
  };

  const renderGabarito = () => {
    if (!showGabarito) return null;
    
    let remaining = Math.floor(Math.abs(totais.sistema));
    const coinsFraction = Math.abs(totais.sistema) - remaining;
    const notes = [100, 50, 20, 10, 5, 2];
    const breakdown = [];
    
    for (const note of notes) {
      const count = Math.floor(remaining / note);
      if (count > 0) {
        breakdown.push({ note, count });
        remaining -= count * note;
      }
    }
    const totalCoins = remaining + coinsFraction;

    return (
      <Modal visible={showGabarito} transparent animationType="fade" onRequestClose={() => setShowGabarito(false)}>
        <Pressable className="flex-1 bg-black/90 justify-center items-center p-6" onPress={() => setShowGabarito(false)}>
          <Pressable className="w-full max-w-[400px] bg-ink-900 border border-zinc-800 rounded-[40px] p-8 shadow-2xl" onPress={(e) => e.stopPropagation()}>
            <View className="items-center mb-6">
              <View className="h-12 w-12 rounded-2xl bg-zinc-100 items-center justify-center mb-4">
                <Banknote size={24} color="#09090b" />
              </View>
              <Text className="text-xl font-black text-zinc-100 tracking-tighter uppercase">Gabarito Físico</Text>
              <Text className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">
                Sugestão ideal para {toBrl(Math.abs(totais.sistema))}
              </Text>
            </View>

            <View className="gap-2 mb-6">
              {breakdown.map((item) => (
                <View key={item.note} className="flex-row items-center justify-between bg-ink-950 p-4 rounded-2xl border border-zinc-800/50">
                  <Text className="text-sm font-bold text-zinc-400">Notas de R$ {item.note.toFixed(2)}</Text>
                  <Text className="text-lg font-black text-emerald-400">{item.count} <Text className="text-xs text-emerald-600">x</Text></Text>
                </View>
              ))}
              {totalCoins > 0 && (
                <View className="flex-row items-center justify-between bg-ink-950 p-4 rounded-2xl border border-zinc-800/50">
                  <Text className="text-sm font-bold text-zinc-400">Valor em Moedas</Text>
                  <Text className="text-lg font-black text-yellow-400">{toBrl(totalCoins)}</Text>
                </View>
              )}
            </View>

            <Pressable 
              onPress={() => {
                triggerHaptic("light");
                setShowGabarito(false);
              }}
              className="bg-zinc-100 h-14 rounded-full items-center justify-center active:opacity-80"
            >
              <Text className="text-zinc-950 font-black text-sm uppercase tracking-widest">Fechar Gabarito</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    );
  };

  const isStackLayout = settings.painelLayout === 'stack';

  // Escala Ergonômica de Caixa - Super Nitidez (40px Hero, Centavos Claros, Máximo Contraste)
  const heroFontSize = Math.round((isNarrow ? 32 : isWide ? 42 : 40) * fontMult);
  const metricFontSize = Math.round((isNarrow ? 17.5 : isWide ? 21 : 20) * fontMult);
  const labelFontSize = Math.round((isNarrow ? 12 : 13) * fontMult);
  const supportFontSize = Math.max(11, Math.round((isNarrow ? 11 : 12) * fontMult));

  const temAjusteAtivo = Math.abs(localAjuste || 0) > 0.001;

  // Helper para renderizar moedas com centavos destacados de forma 100% nativa sem sobreposição no Android
  const renderBrlComCentavos = (
    val: number,
    mainSize: number,
    centsSize: number,
    mainColorClass: string = "text-white",
    centsColorClass: string = "text-zinc-300",
    prefixColorClass: string = "text-zinc-400"
  ) => {
    const isNegative = (val || 0) < 0;
    const absVal = Math.abs(val || 0);
    const formatted = absVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const lastComma = formatted.lastIndexOf(',');
    const intPart = lastComma === -1 ? formatted : formatted.substring(0, lastComma);
    const centsPart = lastComma === -1 ? ',00' : formatted.substring(lastComma);
    const prefixSize = Math.max(11, Math.round(mainSize * 0.58));

    return (
      <Text numberOfLines={1} adjustsFontSizeToFit className="font-mono">
        {isNegative && (
          <Text style={{ fontSize: mainSize }} className={`font-black ${mainColorClass}`}>
            -{" "}
          </Text>
        )}
        <Text style={{ fontSize: prefixSize }} className={`font-bold ${prefixColorClass}`}>
          R${" "}
        </Text>
        <Text style={{ fontSize: mainSize }} className={`font-black tracking-tight ${mainColorClass}`}>
          {intPart}
        </Text>
        <Text style={{ fontSize: centsSize }} className={`font-extrabold ${centsColorClass}`}>
          {centsPart}
        </Text>
      </Text>
    );
  };

  return (
    <View className="gap-2.5">
      
      {/* ALERTA DE PENDÊNCIAS FANTASMAS (SE HOUVER) */}
      {pendenciasFantasma > 0 && !isDiscreto && (
        <View className="bg-amber-500/10 border border-amber-500/30 px-4 py-2.5 rounded-2xl flex-row items-center justify-between">
          <View className="flex-row items-center gap-2.5">
            <Info size={14} color="#f59e0b" />
            <Text 
              style={{ fontSize: labelFontSize }}
              className="font-bold text-amber-400 uppercase tracking-wider"
              numberOfLines={1}
            >
              {pendenciasFantasma} {pendenciasFantasma === 1 ? 'Movimentação Pendente' : 'Movimentações Pendentes'}
            </Text>
          </View>
          <View className="bg-amber-500 px-2 py-0.5 rounded-lg">
            <Text className="text-[10px] font-black text-amber-950">{pendenciasFantasma}</Text>
          </View>
        </View>
      )}

      {/* 1. CARD PRINCIPAL RESPONSIVO */}
      <View className="bg-[#121216] border border-zinc-800/80 rounded-[28px] p-4 shadow-2xl">
        
        {/* Topo do Card: "Total do Caixa" + Badge de Quebra/Sobra */}
        <View className="flex-row items-center justify-between mb-1.5">
          <View className="flex-row items-center gap-2">
            <Monitor size={14} color="#a1a1aa" />
            <Text 
              style={{ fontSize: labelFontSize }}
              className="font-black uppercase tracking-[2px] text-zinc-300"
            >
              Total do Caixa
            </Text>
          </View>

          {!isDiscreto && (
            <View 
              className={`px-2.5 py-0.5 rounded-full border flex-row items-center gap-1 ${
                isPerfeito 
                  ? 'bg-cyan-500/10 border-cyan-500/30' 
                  : isNegativo 
                    ? 'bg-red-500/10 border-red-500/30' 
                    : 'bg-emerald-500/10 border-emerald-500/30'
              }`}
            >
              {isPerfeito ? (
                <CheckCircle2 size={11} color="#22d3ee" />
              ) : isNegativo ? (
                <AlertTriangle size={11} color="#f87171" />
              ) : (
                <Coins size={11} color="#34d399" />
              )}
              <Text 
                style={{ fontSize: supportFontSize }}
                className={`font-black ${
                  isPerfeito 
                    ? 'text-cyan-400' 
                    : isNegativo 
                      ? 'text-red-400' 
                      : 'text-emerald-400'
                }`}
                numberOfLines={1}
              >
                {toBrl(totais.sobra)} {isPerfeito ? 'Perfeito' : isNegativo ? 'Quebra' : 'Sobra'}
              </Text>
            </View>
          )}
        </View>

        {/* Número Hero Grande (LINHA 100% LIVRE) */}
        <Pressable onPress={handleSystemClick} className="my-1 mb-2.5 active:opacity-85">
          {renderBrlComCentavos(
            totais.sistema, 
            heroFontSize, 
            Math.round(heroFontSize * 0.7), 
            'text-white', 
            'text-zinc-300'
          )}
        </Pressable>

        {/* DOCK GAVETA FINAL (VALOR FÍSICO REAL EM MÃOS) */}
        {!isDiscreto && (
          <View className="bg-[#09090c] border border-zinc-800/90 rounded-2xl p-3 px-3.5 flex-row items-center justify-between shadow-lg my-1 mb-3 min-h-[64px]">
            <View className="flex-row items-center gap-2.5">
              <View className="h-9 w-9 rounded-xl bg-amber-500/15 border border-amber-500/30 items-center justify-center flex-shrink-0">
                <Banknote size={18} color="#fcd34d" />
              </View>
              <View>
                <Text style={{ fontSize: labelFontSize }} className="font-black uppercase tracking-wider text-zinc-200" numberOfLines={1}>
                  Gaveta Final
                </Text>
                <Text style={{ fontSize: supportFontSize - 1 }} className="text-zinc-400 font-medium">
                  Físico em mãos
                </Text>
              </View>
            </View>

            <View className="items-end">
              {renderBrlComCentavos(
                gavetaSimulada,
                metricFontSize + 1,
                Math.round((metricFontSize + 1) * 0.75),
                'text-white',
                'text-zinc-300'
              )}
            </View>
          </View>
        )}

        {/* Barra de Proporção Visual */}
        {!isDiscreto && (
          <View className="h-2 w-full bg-zinc-900 rounded-full flex-row overflow-hidden mb-3 p-0.5 border border-zinc-800/80">
            <View 
              style={{ width: `${Math.max(6, Math.min(94, papelPercent))}%` }} 
              className="bg-amber-400 rounded-full mr-0.5" 
            />
            <View 
              style={{ width: `${Math.max(6, Math.min(94, pixPercent))}%` }} 
              className="bg-indigo-400 rounded-full" 
            />
          </View>
        )}

        {/* CABEÇALHO DO MALOTE (POSIÇÃO 3: Rótulo + Baixas) */}
        <View className="flex-row items-center justify-between pt-1.5 pb-2 border-t border-zinc-800/80">
          <Text style={{ fontSize: supportFontSize - 1 }} className="font-black uppercase tracking-[1.5px] text-zinc-500">
            Composição do Malote
          </Text>
          <Text style={{ fontSize: supportFontSize }} className="font-extrabold text-zinc-300">
            {totalVendasCount} {totalVendasCount === 1 ? 'baixa' : 'baixas'}
          </Text>
        </View>

        {/* COMPOSIÇÃO DO MALOTE: EXCLUSIVAMENTE LADO A LADO */}
        <View className="flex-row gap-2.5">
          
          {/* Lado Esquerdo: Dinheiro no Saco */}
          <View className="flex-1 bg-[#09090c] p-3 px-3.5 rounded-2xl border border-zinc-800/90 justify-between min-h-[78px]">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-1.5">
                <View className="h-6 w-6 rounded-lg bg-amber-500/15 border border-amber-500/30 items-center justify-center flex-shrink-0">
                  <Banknote size={13} color="#fcd34d" />
                </View>
                <Text style={{ fontSize: supportFontSize }} className="font-black uppercase tracking-wider text-amber-400" numberOfLines={1}>
                  Dinheiro
                </Text>
              </View>
              <Text style={{ fontSize: supportFontSize - 1 }} className="text-zinc-500 font-bold">
                {papelPercent.toFixed(0)}%
              </Text>
            </View>

            <View className="mt-1">
              {renderBrlComCentavos(
                envelopeSimulado, 
                metricFontSize, 
                Math.round(metricFontSize * 0.75), 
                'text-white', 
                'text-zinc-300'
              )}
              <Text style={{ fontSize: supportFontSize - 1 }} className="text-zinc-400 font-medium mt-0.5" numberOfLines={1}>
                No saco físico
              </Text>
            </View>
          </View>

          {/* Lado Direito: Pix a Transferir */}
          {!isDiscreto && (
            <View className="flex-1 bg-[#09090c] p-3 px-3.5 rounded-2xl border border-zinc-800/90 justify-between min-h-[78px]">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-1.5">
                  <View className="h-6 w-6 rounded-lg bg-indigo-500/15 border border-indigo-500/30 items-center justify-center flex-shrink-0">
                    <Smartphone size={13} color="#a5b4fc" />
                  </View>
                  <Text style={{ fontSize: supportFontSize }} className="font-black uppercase tracking-wider text-indigo-300" numberOfLines={1}>
                    Pix Repasse
                  </Text>
                </View>
                <Text style={{ fontSize: supportFontSize - 1 }} className="text-indigo-300/60 font-bold">
                  {totalPixTransacoesCount}x
                </Text>
              </View>

              <View className="mt-1">
                {renderBrlComCentavos(
                  pixSimulado, 
                  metricFontSize, 
                  Math.round(metricFontSize * 0.75), 
                  'text-indigo-200', 
                  'text-indigo-300',
                  'text-indigo-400/80'
                )}
                <Text style={{ fontSize: supportFontSize - 1 }} className="text-indigo-300/80 font-medium mt-0.5" numberOfLines={1}>
                  A transferir
                </Text>
              </View>
            </View>
          )}

        </View>

      </View>

      {/* 2. INDICADORES CONFIGURÁVEIS (DOCK UNIFICADO [PADRÃO], FOCO NO NÚMERO OU EM LINHAS) */}
      {settings.indicadoresStyle === 'focus' ? (
        /* MODO FOCO NO NÚMERO */
        <View className="flex-row gap-2">
          <View className="flex-1 bg-[#121216] p-3 rounded-2xl border border-zinc-800 items-center justify-center min-h-[66px]">
            <Text 
              style={{ fontSize: metricFontSize + 2 }}
              className="font-black text-zinc-100 font-mono tracking-tight"
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {toBrl(totalSaidasValor)}
            </Text>
            <View className="flex-row items-center gap-1 mt-0.5">
              <ArrowUpRight size={11} color="#f87171" />
              <Text style={{ fontSize: supportFontSize }} className="font-bold text-zinc-400 uppercase tracking-wider">
                Saídas ({totalSaidasCount})
              </Text>
            </View>
          </View>

          <Pressable 
            onPress={() => {
              triggerHaptic("medium");
              onNavigateToChecklist?.();
            }}
            className="flex-1 bg-[#121216] active:bg-[#181822] p-3 rounded-2xl border border-blue-500/30 items-center justify-center active:scale-95 min-h-[66px]"
          >
            <Text 
              style={{ fontSize: metricFontSize + 2 }}
              className="font-black text-blue-300 font-mono tracking-tight"
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {totalConferidosCount} de {totalVendasCount}
            </Text>
            <View className="flex-row items-center gap-1 mt-0.5">
              <CheckSquare size={12} color="#60a5fa" />
              <Text style={{ fontSize: supportFontSize }} className="font-bold text-blue-400 uppercase tracking-wider">
                Canhotos
              </Text>
            </View>
          </Pressable>
        </View>
      ) : settings.indicadoresStyle === 'rows' ? (
        /* MODO EM LINHAS HORIZONTAIS */
        <View className="gap-2">
          <View className="bg-[#121216] p-2.5 px-3.5 rounded-2xl border border-zinc-800 flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <ArrowUpRight size={13} color="#f87171" />
              <Text style={{ fontSize: labelFontSize }} className="font-bold text-zinc-300">Saídas do Caixa</Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Text style={{ fontSize: metricFontSize }} className="font-black text-zinc-100 font-mono">{toBrl(totalSaidasValor)}</Text>
              <Text style={{ fontSize: supportFontSize }} className="text-zinc-500 font-medium">({totalSaidasCount} ret.)</Text>
            </View>
          </View>

          <Pressable 
            onPress={() => {
              triggerHaptic("medium");
              onNavigateToChecklist?.();
            }}
            className="bg-[#121216] active:bg-[#181822] p-2.5 px-3.5 rounded-2xl border border-blue-500/30 flex-row items-center justify-between active:scale-95"
          >
            <View className="flex-row items-center gap-2">
              <CheckSquare size={13} color="#60a5fa" />
              <Text style={{ fontSize: labelFontSize }} className="font-bold text-blue-400">Canhotos</Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Text style={{ fontSize: metricFontSize }} className="font-black text-blue-300 font-mono">{totalConferidosCount} de {totalVendasCount}</Text>
              <Text style={{ fontSize: supportFontSize }} className="text-blue-400/80 font-medium">Abrir ›</Text>
            </View>
          </Pressable>
        </View>
      ) : (
        /* MODO PADRÃO: DOCK UNIFICADO (ERGONÔMICO 74px) */
        <View className="bg-[#121216] border border-zinc-800/80 rounded-2xl p-3 px-4 flex-row items-center shadow-lg min-h-[74px]">
          
          {/* Lado 1: Saídas */}
          <View className="flex-1 px-1">
            <View className="flex-row items-center gap-1.5">
              <ArrowUpRight size={14} color="#f87171" />
              <Text style={{ fontSize: supportFontSize }} className="font-bold text-zinc-300 uppercase tracking-wider" numberOfLines={1}>
                Saídas
              </Text>
            </View>
            <View className="mt-0.5">
              {renderBrlComCentavos(
                totalSaidasValor, 
                metricFontSize, 
                Math.round(metricFontSize * 0.75), 
                'text-white', 
                'text-zinc-300'
              )}
            </View>
            <Text style={{ fontSize: supportFontSize - 1 }} className="text-zinc-400 font-medium" numberOfLines={1}>
              {totalSaidasCount} {totalSaidasCount === 1 ? 'retirada' : 'retiradas'}
            </Text>
          </View>

          {/* Divisor Vertical */}
          <View className="w-[1px] h-12 bg-zinc-800 self-center mx-2.5" />

          {/* Lado 2: Canhotos */}
          <Pressable 
            onPress={() => {
              triggerHaptic("medium");
              onNavigateToChecklist?.();
            }}
            className="flex-1 px-1 active:opacity-80 active:scale-95"
          >
            <View className="flex-row items-center gap-1.5">
              <CheckSquare size={14} color="#60a5fa" />
              <Text style={{ fontSize: supportFontSize }} className="font-bold text-blue-400 uppercase tracking-wider" numberOfLines={1}>
                Canhotos
              </Text>
            </View>
            <Text 
              style={{ fontSize: metricFontSize }}
              className="font-black text-blue-300 font-mono tracking-tight mt-0.5"
            >
              {totalConferidosCount} de {totalVendasCount}
            </Text>
            <Text style={{ fontSize: supportFontSize - 1 }} className="text-blue-300/80 font-medium">
              Toque p/ abrir
            </Text>
          </Pressable>

        </View>
      )}

      {/* 3. AJUSTE DA GAVETA (CALIBRAÇÃO PERFEITA: ÍCONE 36px, BASELINE ESTÁVEL) */}
      {!isDiscreto && (
        <View className={`p-3 px-3.5 rounded-2xl border flex-row items-center justify-between gap-3 shadow-lg transition-all min-h-[66px] ${
          temAjusteAtivo 
            ? 'bg-[#14130e] border-amber-500/40 shadow-amber-500/5' 
            : 'bg-[#121216] border-zinc-800/80'
        }`}>
          
          {/* Lado Esquerdo: Ícone 36px + Rótulo + Digitação Direta */}
          <View className="flex-row items-center gap-3 flex-1 mr-2">
            <View className={`h-9 w-9 rounded-xl items-center justify-center flex-shrink-0 ${
              temAjusteAtivo ? 'bg-amber-500/20 border border-amber-500/30' : 'bg-zinc-900 border border-zinc-800'
            }`}>
              <SlidersHorizontal size={16} color={temAjusteAtivo ? "#fcd34d" : "#a1a1aa"} />
            </View>
            
            <View className="flex-1 justify-center">
              <Text style={{ fontSize: supportFontSize - 1 }} className={`font-bold uppercase tracking-wider ${
                temAjusteAtivo ? 'text-amber-300' : 'text-zinc-400'
              }`}>
                Ajuste da Gaveta
              </Text>
              
              <MoneyInput
                editable={!isFechado}
                className={`bg-transparent text-[20px] font-black font-mono p-0 h-7 leading-tight ${
                  temAjusteAtivo ? 'text-amber-300' : 'text-white'
                }`}
                value={localAjuste || 0}
                onChangeValue={(val) => {
                  setLocalAjuste(val);
                  onAjusteSobra?.(val);
                }}
              />
            </View>
          </View>

          {/* Lado Direito: Botão +1 Integrado e Elegante + Zerar */}
          {!isFechado && (
            <View className="flex-row items-center gap-1.5 flex-shrink-0">
              {temAjusteAtivo && (
                <Pressable 
                  onPress={handleZerarAjuste}
                  className="px-2.5 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 active:bg-zinc-800 active:scale-90"
                >
                  <Text style={{ fontSize: supportFontSize - 1 }} className="font-bold text-zinc-400">
                    Zerar
                  </Text>
                </Pressable>
              )}

              <Pressable 
                onPress={handleAddUmReal}
                className="px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/40 hover:bg-amber-500/25 active:bg-amber-500/30 active:scale-95 flex-row items-center gap-1 shadow"
              >
                <Plus size={13} color="#fcd34d" strokeWidth={3} />
                <Text style={{ fontSize: supportFontSize }} className="font-black text-amber-300">
                  1,00
                </Text>
              </Pressable>
            </View>
          )}

        </View>
      )}

      {/* 4. OUTROS RECEBIMENTOS: CARDS EM GRID PRÓPRIOS (SEM REPETIR O DOCK) */}
      {!isDiscreto && (settings.posEnabled || settings.convenioEnabled) && (
        <View className="mt-1">
          {/* Se ambos estiverem ativos: Grid de 2 Colunas */}
          {settings.posEnabled && settings.convenioEnabled ? (
            <View className="flex-row gap-2.5">
              
              {/* Card 1: POS Cartões */}
              <Pressable 
                onPress={() => {
                  triggerHaptic("medium");
                  onNavigateToChecklist?.();
                }}
                className="flex-1 bg-[#121216] border border-blue-500/30 rounded-2xl p-3.5 shadow-lg justify-between min-h-[92px] active:scale-98"
              >
                {/* Cabeçalho do Card: Ícone + Título */}
                <View className="flex-row items-center gap-2">
                  <View className="h-6 w-6 rounded-lg bg-blue-500/15 border border-blue-500/30 items-center justify-center flex-shrink-0">
                    <CreditCard size={13} color="#60a5fa" />
                  </View>
                  <Text style={{ fontSize: supportFontSize }} className="font-black text-blue-400 uppercase tracking-wider" numberOfLines={1}>
                    POS Cartões
                  </Text>
                </View>

                {/* Valor + Subtítulo Perfeitamente Posicionado */}
                <View className="mt-1.5">
                  {renderBrlComCentavos(
                    totais.totalPOS || 0,
                    metricFontSize,
                    Math.round(metricFontSize * 0.75),
                    'text-white',
                    'text-zinc-300',
                    'text-blue-400/80'
                  )}
                  <Text style={{ fontSize: supportFontSize - 1 }} className="text-blue-300/80 font-medium mt-0.5" numberOfLines={1}>
                    {totalPOSCount} {totalPOSCount === 1 ? 'comprovante' : 'comprovantes'} ›
                  </Text>
                </View>
              </Pressable>

              {/* Card 2: Convênios */}
              <Pressable 
                onPress={() => {
                  triggerHaptic("medium");
                  onNavigateToChecklist?.();
                }}
                className="flex-1 bg-[#121216] border border-purple-500/30 rounded-2xl p-3.5 shadow-lg justify-between min-h-[92px] active:scale-98"
              >
                {/* Cabeçalho do Card: Ícone + Título */}
                <View className="flex-row items-center gap-2">
                  <View className="h-6 w-6 rounded-lg bg-purple-500/15 border border-purple-500/30 items-center justify-center flex-shrink-0">
                    <Building2 size={13} color="#c084fc" />
                  </View>
                  <Text style={{ fontSize: supportFontSize }} className="font-black text-purple-400 uppercase tracking-wider" numberOfLines={1}>
                    Convênios
                  </Text>
                </View>

                {/* Valor + Subtítulo Perfeitamente Posicionado */}
                <View className="mt-1.5">
                  {renderBrlComCentavos(
                    totais.totalConvenio || 0,
                    metricFontSize,
                    Math.round(metricFontSize * 0.75),
                    'text-white',
                    'text-zinc-300',
                    'text-purple-400/80'
                  )}
                  <Text style={{ fontSize: supportFontSize - 1 }} className="text-purple-300/80 font-medium mt-0.5" numberOfLines={1}>
                    {totalConvenioCount} {totalConvenioCount === 1 ? 'cliente' : 'clientes'} ›
                  </Text>
                </View>
              </Pressable>

            </View>
          ) : settings.posEnabled ? (
            /* Apenas POS Ativo */
            <Pressable 
              onPress={() => {
                triggerHaptic("medium");
                onNavigateToChecklist?.();
              }}
              className="bg-[#121216] border border-zinc-800/80 rounded-2xl p-3 px-4 flex-row items-center justify-between shadow-lg min-h-[70px] active:scale-98"
            >
              <View className="flex-row items-center gap-3">
                <View className="h-10 w-10 rounded-2xl bg-blue-500/15 border border-blue-500/30 items-center justify-center">
                  <CreditCard size={18} color="#60a5fa" />
                </View>
                <View>
                  <Text style={{ fontSize: labelFontSize }} className="font-black text-blue-400 uppercase tracking-tight">
                    Máquina POS (Cartões)
                  </Text>
                  <Text style={{ fontSize: supportFontSize }} className="text-zinc-400 font-medium">
                    Toque para abrir a conferência
                  </Text>
                </View>
              </View>
              {renderBrlComCentavos(
                totais.totalPOS || 0,
                metricFontSize,
                Math.round(metricFontSize * 0.75),
                'text-white',
                'text-zinc-300'
              )}
            </Pressable>
          ) : (
            /* Apenas Convênios Ativo */
            <Pressable 
              onPress={() => {
                triggerHaptic("medium");
                onNavigateToChecklist?.();
              }}
              className="bg-[#121216] border border-zinc-800/80 rounded-2xl p-3 px-4 flex-row items-center justify-between shadow-lg min-h-[70px] active:scale-98"
            >
              <View className="flex-row items-center gap-3">
                <View className="h-10 w-10 rounded-2xl bg-purple-500/15 border border-purple-500/30 items-center justify-center">
                  <Building2 size={18} color="#c084fc" />
                </View>
                <View>
                  <Text style={{ fontSize: labelFontSize }} className="font-black text-purple-400 uppercase tracking-tight">
                    Convênios / Faturados
                  </Text>
                  <Text style={{ fontSize: supportFontSize }} className="text-zinc-400 font-medium">
                    Toque para abrir a conferência
                  </Text>
                </View>
              </View>
              {renderBrlComCentavos(
                totais.totalConvenio || 0,
                metricFontSize,
                Math.round(metricFontSize * 0.75),
                'text-white',
                'text-zinc-300'
              )}
            </Pressable>
          )}
        </View>
      )}

      {renderGabarito()}
    </View>
  );
});
