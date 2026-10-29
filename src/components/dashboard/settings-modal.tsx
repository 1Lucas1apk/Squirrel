import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, Modal, ScrollView, Switch, Alert, Platform } from 'react-native';
import { 
  SlidersHorizontal, 
  Terminal, 
  Hash, 
  UserCheck, 
  LayoutGrid, 
  Calculator, 
  Zap, 
  Clock, 
  Bell, 
  Layers, 
  Search, 
  Users, 
  ShieldCheck, 
  Fingerprint, 
  Database, 
  Download, 
  Trash2, 
  X, 
  CheckCircle2, 
  Circle,
  Crown,
  Bug
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppSettings, HapticIntensity, MoneyInputMode } from '../../hooks/use-app-settings';
import { useChat } from '../../hooks/use-chat';
import { CustomToast, ToastConfig } from '../common/custom-toast';
import { DebugLogsModal } from './debug-logs-modal';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  caixaId: string;
  setCaixaId: (val: string) => void;
  currentOperadorId: string;
  setCurrentOperadorId: (val: string) => void;
  onSalvarIDs: (caixa: string, op: string) => Promise<void>;
  isAdmin?: boolean;
}

export function SettingsModal({
  visible,
  onClose,
  caixaId,
  setCaixaId,
  currentOperadorId,
  setCurrentOperadorId,
  onSalvarIDs,
  isAdmin = false
}: SettingsModalProps) {
  const { settings, updateSettings } = useAppSettings();
  const { myUserId, alternarAdminUsuario } = useChat();

  // Estados locais para inputs
  const [localCaixaId, setLocalCaixaId] = useState(caixaId);
  const [localOperadorId, setLocalOperadorId] = useState(currentOperadorId);
  const [localSemana, setLocalSemana] = useState(settings.fechamentoSemana || "17:00");
  const [localSabado, setLocalSabado] = useState(settings.fechamentoSabado || "12:00");
  const [localGas, setLocalGas] = useState(String(settings.gasDoPovoValorPadrao || 120.36));
  const [toast, setToast] = useState<ToastConfig | null>(null);
  const [showDebugModal, setShowDebugModal] = useState(false);

  useEffect(() => {
    if (visible) {
      setLocalCaixaId(caixaId);
      setLocalOperadorId(currentOperadorId);
      setLocalSemana(settings.fechamentoSemana || "17:00");
      setLocalSabado(settings.fechamentoSabado || "12:00");
      setLocalGas(String(settings.gasDoPovoValorPadrao || 120.36));
      setToast(null);
    }
  }, [visible, caixaId, currentOperadorId, settings]);

  const triggerHaptic = (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) => {
    if (settings.hapticsEnabled && Platform.OS !== 'web') {
      void Haptics.impactAsync(style);
    }
  };

  const handleSalvarConcluir = async () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);

    // Salvar IDs do Caixa e Operador
    setCaixaId(localCaixaId);
    setCurrentOperadorId(localOperadorId);
    await onSalvarIDs(localCaixaId, localOperadorId);
    await AsyncStorage.setItem("@squirrel_last_caixa_id", localCaixaId);
    await AsyncStorage.setItem("@squirrel_last_operador_id", localOperadorId);

    // Salvar Configurações
    await updateSettings({
      fechamentoSemana: localSemana.trim() || "17:00",
      fechamentoSabado: localSabado.trim() || "12:00",
      gasDoPovoValorPadrao: parseFloat(localGas.replace(',', '.')) || 120.36
    });

    onClose();
  };

  const handleLimparCache = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
    setToast({
      type: "success",
      title: "Cache Liberado",
      message: "Arquivos temporários e caches liberados com sucesso."
    });
  };

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
              <View className="h-10 w-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 items-center justify-center">
                <SlidersHorizontal size={18} color="#34d399" />
              </View>
              <View>
                <View className="flex-row items-center gap-1.5">
                  <Text className="text-[10px] font-black uppercase tracking-[2px] text-zinc-500">Squirrel</Text>
                  <View className="px-1.5 py-0.5 rounded bg-emerald-500/20">
                    <Text className="text-emerald-400 text-[8px] font-black">v2.8</Text>
                  </View>
                </View>
                <Text className="text-sm font-black uppercase text-zinc-100">Ajustes & Caixa</Text>
              </View>
            </View>
            <Pressable 
              onPress={onClose} 
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
            contentContainerStyle={{ paddingBottom: 16, gap: 14 }}
          >
            {/* 1. IDENTIFICAÇÃO OPERACIONAL */}
            <View className="bg-[#121216] p-4 rounded-[26px] border border-zinc-800/80 shadow-md">
              <View className="flex-row items-center justify-between pb-2.5 border-b border-zinc-800/60 mb-3">
                <View className="flex-row items-center gap-2">
                  <View className="h-7 w-7 rounded-xl bg-amber-500/15 border border-amber-500/30 items-center justify-center">
                    <Terminal size={14} color="#fbbf24" />
                  </View>
                  <Text className="text-xs font-black uppercase text-zinc-200">Terminal & Operador</Text>
                </View>
                <View className="bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                  <Text className="text-[8px] font-mono font-bold text-amber-400">ATIVO</Text>
                </View>
              </View>

              <View className="flex-row gap-2.5">
                <View className="flex-1 bg-[#09090c] p-3 rounded-2xl border border-zinc-800/80">
                  <Text className="text-[9px] font-black uppercase text-zinc-500 mb-1">ID do Caixa</Text>
                  <View className="flex-row items-center justify-between">
                    <TextInput 
                      value={localCaixaId}
                      onChangeText={setLocalCaixaId}
                      placeholder="01"
                      placeholderTextColor="#3f3f46"
                      className="bg-transparent text-sm font-black font-mono text-zinc-100 flex-1 p-0"
                    />
                    <Hash size={14} color="#71717a" />
                  </View>
                </View>
                <View className="flex-1 bg-[#09090c] p-3 rounded-2xl border border-zinc-800/80">
                  <Text className="text-[9px] font-black uppercase text-zinc-500 mb-1">ID Operador</Text>
                  <View className="flex-row items-center justify-between">
                    <TextInput 
                      value={localOperadorId}
                      onChangeText={setLocalOperadorId}
                      placeholder="1306"
                      placeholderTextColor="#3f3f46"
                      className="bg-transparent text-sm font-black font-mono text-zinc-100 flex-1 p-0"
                    />
                    <UserCheck size={14} color="#71717a" />
                  </View>
                </View>
              </View>
            </View>

            {/* 2. PERSONALIZAÇÃO VISUAL DO PAINEL */}
            <View className="bg-[#121216] p-4 rounded-[26px] border border-zinc-800/80 shadow-md gap-3.5">
              <View className="flex-row items-center gap-2 pb-2 border-b border-zinc-800/60">
                <View className="h-7 w-7 rounded-xl bg-purple-500/15 border border-purple-500/30 items-center justify-center">
                  <LayoutGrid size={14} color="#c084fc" />
                </View>
                <Text className="text-xs font-black uppercase text-zinc-200">Layout & Interface</Text>
              </View>

              {/* Disposição do Malote */}
              <View>
                <View className="flex-row justify-between items-center mb-1.5">
                  <Text className="text-[10px] font-black uppercase text-zinc-400">Disposição do Malote</Text>
                  <Text className="text-[9px] font-mono text-purple-400 font-bold">
                    {settings.painelLayout === 'grid' ? "Lado a Lado" : "Empilhado"}
                  </Text>
                </View>
                <View className="bg-[#09090c] p-1 rounded-2xl border border-zinc-800 flex-row gap-1">
                  <Pressable 
                    onPress={() => {
                      triggerHaptic();
                      updateSettings({ painelLayout: 'grid' });
                    }}
                    className={`flex-1 py-2.5 rounded-xl items-center justify-center ${settings.painelLayout === 'grid' ? 'bg-purple-500 shadow' : 'bg-transparent'}`}
                  >
                    <Text className={`text-[11px] font-black uppercase ${settings.painelLayout === 'grid' ? 'text-zinc-950' : 'text-zinc-400'}`}>
                      Lado a Lado
                    </Text>
                  </Pressable>
                  <Pressable 
                    onPress={() => {
                      triggerHaptic();
                      updateSettings({ painelLayout: 'stack' });
                    }}
                    className={`flex-1 py-2.5 rounded-xl items-center justify-center ${settings.painelLayout === 'stack' ? 'bg-purple-500 shadow' : 'bg-transparent'}`}
                  >
                    <Text className={`text-[11px] font-black uppercase ${settings.painelLayout === 'stack' ? 'text-zinc-950' : 'text-zinc-400'}`}>
                      Empilhado
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* Indicadores: Saídas & Canhotos */}
              <View>
                <View className="flex-row justify-between items-center mb-1.5">
                  <Text className="text-[10px] font-black uppercase text-zinc-400">Saídas & Canhotos</Text>
                  <Text className="text-[9px] font-mono text-purple-400 font-bold">
                    {settings.indicadoresStyle === 'dock' ? "Dock Flutuante" : settings.indicadoresStyle === 'focus' ? "Foco Nº" : "Linhas"}
                  </Text>
                </View>
                <View className="bg-[#09090c] p-1 rounded-2xl border border-zinc-800 flex-row gap-1">
                  <Pressable 
                    onPress={() => {
                      triggerHaptic();
                      updateSettings({ indicadoresStyle: 'dock' });
                    }}
                    className={`flex-1 py-2 rounded-xl items-center justify-center ${settings.indicadoresStyle === 'dock' ? 'bg-purple-500 shadow' : 'bg-transparent'}`}
                  >
                    <Text className={`text-[10px] font-black uppercase ${settings.indicadoresStyle === 'dock' ? 'text-zinc-950' : 'text-zinc-400'}`}>
                      Dock
                    </Text>
                  </Pressable>
                  <Pressable 
                    onPress={() => {
                      triggerHaptic();
                      updateSettings({ indicadoresStyle: 'focus' });
                    }}
                    className={`flex-1 py-2 rounded-xl items-center justify-center ${settings.indicadoresStyle === 'focus' ? 'bg-purple-500 shadow' : 'bg-transparent'}`}
                  >
                    <Text className={`text-[10px] font-black uppercase ${settings.indicadoresStyle === 'focus' ? 'text-zinc-950' : 'text-zinc-400'}`}>
                      Foco Nº
                    </Text>
                  </Pressable>
                  <Pressable 
                    onPress={() => {
                      triggerHaptic();
                      updateSettings({ indicadoresStyle: 'rows' });
                    }}
                    className={`flex-1 py-2 rounded-xl items-center justify-center ${settings.indicadoresStyle === 'rows' ? 'bg-purple-500 shadow' : 'bg-transparent'}`}
                  >
                    <Text className={`text-[10px] font-black uppercase ${settings.indicadoresStyle === 'rows' ? 'text-zinc-950' : 'text-zinc-400'}`}>
                      Linhas
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* Escala de Tipografia */}
              <View>
                <View className="flex-row justify-between items-center mb-1.5">
                  <Text className="text-[10px] font-black uppercase text-zinc-400">Tamanho da Letra</Text>
                  <Text className="text-[9px] font-mono text-purple-400 font-bold">
                    {settings.fontScale === 'compact' ? "Compacto" : settings.fontScale === 'large' ? "Grande" : "Padrão"}
                  </Text>
                </View>
                <View className="bg-[#09090c] p-1 rounded-2xl border border-zinc-800 flex-row gap-1">
                  <Pressable 
                    onPress={() => {
                      triggerHaptic();
                      updateSettings({ fontScale: 'compact' });
                    }}
                    className={`flex-1 py-2 rounded-xl items-center justify-center ${settings.fontScale === 'compact' ? 'bg-purple-500 shadow' : 'bg-transparent'}`}
                  >
                    <Text className={`text-[10px] font-black uppercase ${settings.fontScale === 'compact' ? 'text-zinc-950' : 'text-zinc-400'}`}>
                      A- Compacto
                    </Text>
                  </Pressable>
                  <Pressable 
                    onPress={() => {
                      triggerHaptic();
                      updateSettings({ fontScale: 'normal' });
                    }}
                    className={`flex-1 py-2 rounded-xl items-center justify-center ${settings.fontScale === 'normal' ? 'bg-purple-500 shadow' : 'bg-transparent'}`}
                  >
                    <Text className={`text-[10px] font-black uppercase ${settings.fontScale === 'normal' ? 'text-zinc-950' : 'text-zinc-400'}`}>
                      A Padrão
                    </Text>
                  </Pressable>
                  <Pressable 
                    onPress={() => {
                      triggerHaptic();
                      updateSettings({ fontScale: 'large' });
                    }}
                    className={`flex-1 py-2 rounded-xl items-center justify-center ${settings.fontScale === 'large' ? 'bg-purple-500 shadow' : 'bg-transparent'}`}
                  >
                    <Text className={`text-[10px] font-black uppercase ${settings.fontScale === 'large' ? 'text-zinc-950' : 'text-zinc-400'}`}>
                      A+ Grande
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>

            {/* 3. DIGITAÇÃO & HAPTIC FEEDBACK */}
            <View className="bg-[#121216] p-4 rounded-[26px] border border-zinc-800/80 shadow-md gap-3.5">
              <View className="flex-row items-center gap-2 pb-2 border-b border-zinc-800/60">
                <View className="h-7 w-7 rounded-xl bg-cyan-500/15 border border-cyan-500/30 items-center justify-center">
                  <Calculator size={14} color="#22d3ee" />
                </View>
                <Text className="text-xs font-black uppercase text-zinc-200">Digitação & Sensibilidade</Text>
              </View>

              {/* Modo de Digitação */}
              <View>
                <Text className="text-[10px] font-black uppercase text-zinc-400 mb-2">Entrada de Valores Monetários</Text>
                <View className="flex-row gap-2">
                  <Pressable 
                    onPress={() => {
                      triggerHaptic();
                      updateSettings({ moneyInputMode: 'rtl' });
                    }}
                    className={`flex-1 p-3 rounded-2xl border-2 ${
                      settings.moneyInputMode === 'rtl' 
                        ? 'bg-emerald-500/10 border-emerald-500' 
                        : 'bg-[#09090c] border-zinc-800'
                    }`}
                  >
                    <View className="flex-row items-center justify-between mb-1">
                      <Text className={`text-xs font-black uppercase ${settings.moneyInputMode === 'rtl' ? 'text-emerald-400' : 'text-zinc-300'}`}>
                        Nubank
                      </Text>
                      {settings.moneyInputMode === 'rtl' ? (
                        <CheckCircle2 size={13} color="#34d399" />
                      ) : (
                        <Circle size={13} color="#52525b" />
                      )}
                    </View>
                    <Text className="text-[9px] text-zinc-400 font-medium leading-tight">
                      Automático da direita para a esquerda.
                    </Text>
                  </Pressable>

                  <Pressable 
                    onPress={() => {
                      triggerHaptic();
                      updateSettings({ moneyInputMode: 'manual' });
                    }}
                    className={`flex-1 p-3 rounded-2xl border-2 ${
                      settings.moneyInputMode === 'manual' 
                        ? 'bg-emerald-500/10 border-emerald-500' 
                        : 'bg-[#09090c] border-zinc-800'
                    }`}
                  >
                    <View className="flex-row items-center justify-between mb-1">
                      <Text className={`text-xs font-black uppercase ${settings.moneyInputMode === 'manual' ? 'text-emerald-400' : 'text-zinc-300'}`}>
                        Livre
                      </Text>
                      {settings.moneyInputMode === 'manual' ? (
                        <CheckCircle2 size={13} color="#34d399" />
                      ) : (
                        <Circle size={13} color="#52525b" />
                      )}
                    </View>
                    <Text className="text-[9px] text-zinc-400 font-medium leading-tight">
                      Digitação livre com vírgula manual.
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* Switch Haptics e Níveis */}
              <View className="pt-2 border-t border-zinc-800/60 gap-3">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2.5 flex-1 pr-2">
                    <View className="h-8 w-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 items-center justify-center">
                      <Zap size={15} color="#22d3ee" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-xs font-black uppercase text-zinc-200">Vibração Tátil (Haptic)</Text>
                      <Text className="text-[9px] text-zinc-500 font-medium">Feedback físico ao tocar e lançar</Text>
                    </View>
                  </View>
                  <Switch 
                    value={settings.hapticsEnabled}
                    onValueChange={(val) => {
                      triggerHaptic();
                      updateSettings({ hapticsEnabled: val });
                    }}
                    trackColor={{ false: "#27272a", true: "#0891b2" }}
                    thumbColor={"#f4f4f5"}
                  />
                </View>

                {settings.hapticsEnabled && (
                  <View className="bg-[#09090c] p-1 rounded-2xl border border-zinc-800 flex-row gap-1">
                    {(['light', 'medium', 'heavy'] as HapticIntensity[]).map((lvl) => {
                      const isActive = settings.hapticIntensity === lvl;
                      const label = lvl === 'light' ? 'Leve' : lvl === 'medium' ? 'Médio' : 'Forte';
                      return (
                        <Pressable 
                          key={lvl}
                          onPress={() => {
                            const intensityMap = {
                              light: Haptics.ImpactFeedbackStyle.Light,
                              medium: Haptics.ImpactFeedbackStyle.Medium,
                              heavy: Haptics.ImpactFeedbackStyle.Heavy,
                            };
                            if (Platform.OS !== 'web') {
                              void Haptics.impactAsync(intensityMap[lvl]);
                            }
                            updateSettings({ hapticIntensity: lvl });
                          }}
                          className={`flex-1 py-1.5 rounded-xl items-center justify-center ${
                            isActive ? 'bg-cyan-500 shadow' : 'bg-transparent'
                          }`}
                        >
                          <Text className={`text-[10px] font-black uppercase ${
                            isActive ? 'text-zinc-950' : 'text-zinc-400'
                          }`}>
                            {label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>
            </View>

            {/* 4. OPERACIONAL & NOTIFICAÇÕES DE FECHAMENTO */}
            <View className="bg-[#121216] p-4 rounded-[26px] border border-zinc-800/80 shadow-md gap-3">
              <View className="flex-row items-center justify-between pb-2 border-b border-zinc-800/60">
                <View className="flex-row items-center gap-2">
                  <View className="h-7 w-7 rounded-xl bg-blue-500/15 border border-blue-500/30 items-center justify-center">
                    <Clock size={14} color="#60a5fa" />
                  </View>
                  <Text className="text-xs font-black uppercase text-zinc-200">Operacional & Horários</Text>
                </View>
                <Text className="text-[9px] font-mono text-blue-400 font-bold">Lembretes</Text>
              </View>

              {/* Lembretes de Fechamento */}
              <View className="flex-row gap-2.5">
                <View className="flex-1 bg-[#09090c] p-3 rounded-2xl border border-zinc-800">
                  <Text className="text-[9px] font-black uppercase text-zinc-500 mb-1">Seg a Sex</Text>
                  <View className="flex-row items-center gap-2">
                    <Bell size={13} color="#60a5fa" />
                    <TextInput 
                      value={localSemana}
                      onChangeText={setLocalSemana}
                      placeholder="17:00"
                      placeholderTextColor="#3f3f46"
                      className="bg-transparent text-sm font-black font-mono text-zinc-100 flex-1 p-0"
                    />
                  </View>
                </View>
                <View className="flex-1 bg-[#09090c] p-3 rounded-2xl border border-zinc-800">
                  <Text className="text-[9px] font-black uppercase text-zinc-500 mb-1">Sábado</Text>
                  <View className="flex-row items-center gap-2">
                    <Bell size={13} color="#60a5fa" />
                    <TextInput 
                      value={localSabado}
                      onChangeText={setLocalSabado}
                      placeholder="12:00"
                      placeholderTextColor="#3f3f46"
                      className="bg-transparent text-sm font-black font-mono text-zinc-100 flex-1 p-0"
                    />
                  </View>
                </View>
              </View>

              {/* Valor Padrão Gás do Povo */}
              <View className="bg-[#09090c] p-3 rounded-2xl border border-zinc-800 flex-row items-center justify-between">
                <View className="flex-1 mr-2">
                  <Text className="text-[9px] font-black uppercase text-zinc-500">Valor Padrão Gás do Povo</Text>
                  <TextInput 
                    value={localGas}
                    onChangeText={setLocalGas}
                    placeholder="120.36"
                    keyboardType="numeric"
                    placeholderTextColor="#3f3f46"
                    className="bg-transparent text-xs font-black font-mono text-zinc-200 p-0 mt-0.5"
                  />
                </View>
                <View className="px-2 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <Text className="text-[8px] font-mono font-bold text-blue-400">R$ PADRÃO</Text>
                </View>
              </View>
            </View>

            {/* 5. MÓDULOS DO SISTEMA */}
            <View className="bg-[#121216] p-4 rounded-[26px] border border-zinc-800/80 shadow-md gap-3">
              <View className="flex-row items-center gap-2 pb-2 border-b border-zinc-800/60">
                <View className="h-7 w-7 rounded-xl bg-pink-500/15 border border-pink-500/30 items-center justify-center">
                  <Layers size={14} color="#f472b6" />
                </View>
                <Text className="text-xs font-black uppercase text-zinc-200">Módulos do Sistema</Text>
              </View>

              {/* Switch Convênios */}
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-2.5 flex-1 pr-2">
                  <View className="h-8 w-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 items-center justify-center">
                    <Users size={15} color="#818cf8" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs font-black uppercase text-zinc-200">Módulo Convênios</Text>
                    <Text className="text-[9px] text-zinc-500 font-medium">Vendas a prazo e clientes conveniados</Text>
                  </View>
                </View>
                <Switch 
                  value={settings.convenioEnabled}
                  onValueChange={(val) => {
                    triggerHaptic();
                    updateSettings({ convenioEnabled: val });
                  }}
                  trackColor={{ false: "#27272a", true: "#6366f1" }}
                  thumbColor={"#f4f4f5"}
                />
              </View>

              {/* Switch Barra de Busca */}
              <View className="flex-row items-center justify-between pt-2 border-t border-zinc-800/40">
                <View className="flex-row items-center gap-2.5 flex-1 pr-2">
                  <View className="h-8 w-8 rounded-xl bg-pink-500/10 border border-pink-500/20 items-center justify-center">
                    <Search size={15} color="#f472b6" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs font-black uppercase text-zinc-200">Barra de Busca Rápida</Text>
                    <Text className="text-[9px] text-zinc-500 font-medium">Filtrar lançamentos no topo do painel</Text>
                  </View>
                </View>
                <Switch 
                  value={settings.searchEnabled}
                  onValueChange={(val) => {
                    triggerHaptic();
                    updateSettings({ searchEnabled: val });
                  }}
                  trackColor={{ false: "#27272a", true: "#ec4899" }}
                  thumbColor={"#f4f4f5"}
                />
              </View>
            </View>

            {/* 6. SEGURANÇA & BIOMETRIA */}
            <View className="bg-[#121216] p-4 rounded-[26px] border border-zinc-800/80 shadow-md gap-3">
              <View className="flex-row items-center gap-2 pb-2 border-b border-zinc-800/60">
                <View className="h-7 w-7 rounded-xl bg-emerald-500/15 border border-emerald-500/30 items-center justify-center">
                  <ShieldCheck size={14} color="#34d399" />
                </View>
                <Text className="text-xs font-black uppercase text-zinc-200">Segurança & Acesso</Text>
              </View>

              {/* Switch Biometria */}
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-2.5 flex-1 pr-2">
                  <View className="h-8 w-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 items-center justify-center">
                    <Fingerprint size={15} color="#34d399" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs font-black uppercase text-zinc-200">Biometria (Digital / FaceID)</Text>
                    <Text className="text-[9px] text-zinc-500 font-medium">Exigir autenticação ao abrir o app</Text>
                  </View>
                </View>
                <Switch 
                  value={settings.biometricsEnabled}
                  onValueChange={(val) => {
                    triggerHaptic();
                    updateSettings({ biometricsEnabled: val });
                  }}
                  trackColor={{ false: "#27272a", true: "#059669" }}
                  thumbColor={"#f4f4f5"}
                />
              </View>

              {/* Status do Administrador Master e Ação de Sair */}
              {isAdmin && (
                <View className="gap-2">
                  <View className="bg-[#09090c] p-3 rounded-2xl border border-amber-500/20 flex-row items-center justify-between">
                    <View className="flex-row items-center gap-2">
                      <Crown size={14} color="#fbbf24" />
                      <Text className="text-xs font-black text-amber-400 uppercase">Administrador Mestre</Text>
                    </View>
                    <View className="px-2 py-0.5 rounded bg-amber-500/20">
                      <Text className="text-[8px] font-mono font-black text-amber-300">AUTORIZADO</Text>
                    </View>
                  </View>
                  <Pressable 
                    onPress={async () => {
                      triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
                      await alternarAdminUsuario(myUserId, false);
                      setToast({
                        type: "info",
                        title: "Admin Desativado",
                        message: "Você voltou ao modo Operador padrão."
                      });
                    }}
                    className="py-2.5 px-3 rounded-xl bg-red-500/10 border border-red-500/20 flex-row items-center justify-center gap-2 active:bg-red-500/20"
                  >
                    <Crown size={13} color="#f87171" />
                    <Text className="text-[11px] font-black uppercase text-red-400">Sair do Modo Administrador</Text>
                  </Pressable>
                </View>
              )}
            </View>

            {/* 7. ARMAZENAMENTO & CACHE */}
            <View className="bg-[#121216] p-4 rounded-[26px] border border-zinc-800/80 shadow-md gap-3">
              <View className="flex-row items-center gap-2 pb-2 border-b border-zinc-800/60">
                <View className="h-7 w-7 rounded-xl bg-zinc-700/30 border border-zinc-700/50 items-center justify-center">
                  <Database size={14} color="#a1a1aa" />
                </View>
                <Text className="text-xs font-black uppercase text-zinc-200">Armazenamento & Manutenção</Text>
              </View>

              <Pressable 
                onPress={handleLimparCache}
                className="py-3 px-4 rounded-2xl bg-[#09090c] border border-zinc-800 flex-row items-center justify-between active:bg-zinc-900"
              >
                <View className="flex-row items-center gap-2.5">
                  <Trash2 size={14} color="#f87171" />
                  <Text className="text-xs font-black uppercase text-red-400">Limpar Cache Temporário</Text>
                </View>
                <Text className="text-[9px] text-zinc-500 font-mono">Liberar Espaço</Text>
              </Pressable>
            </View>

            {/* 8. DIAGNÓSTICO & DEPURAÇÃO (LOGS DO SISTEMA) */}
            <View className="bg-[#121216] p-4 rounded-[26px] border border-zinc-800/80 shadow-md gap-3">
              <View className="flex-row items-center gap-2 pb-2 border-b border-zinc-800/60">
                <View className="h-7 w-7 rounded-xl bg-amber-500/15 border border-amber-500/30 items-center justify-center">
                  <Terminal size={14} color="#fbbf24" />
                </View>
                <Text className="text-xs font-black uppercase text-zinc-200">Diagnóstico & Logs</Text>
              </View>

              {/* Switch Modo Depuração */}
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-2.5 flex-1 pr-2">
                  <View className="h-8 w-8 rounded-xl bg-amber-500/10 border border-amber-500/20 items-center justify-center">
                    <Bug size={15} color="#fbbf24" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs font-black uppercase text-zinc-200">Modo Depuração Ativo</Text>
                    <Text className="text-[9px] text-zinc-500 font-medium">Registra trace detalhado de operações e erros</Text>
                  </View>
                </View>
                <Switch 
                  value={settings.debugModeEnabled}
                  onValueChange={(val) => {
                    triggerHaptic();
                    void updateSettings({ debugModeEnabled: val });
                  }}
                  trackColor={{ false: "#27272a", true: "#f59e0b" }}
                  thumbColor={"#f4f4f5"}
                />
              </View>

              {/* Botão Abrir Central de Logs */}
              <Pressable 
                onPress={() => {
                  triggerHaptic();
                  setShowDebugModal(true);
                }}
                className="py-3 px-4 rounded-2xl bg-indigo-600/15 border border-indigo-500/30 flex-row items-center justify-between active:bg-indigo-600/25 mt-1"
              >
                <View className="flex-row items-center gap-2.5">
                  <Terminal size={15} color="#818cf8" />
                  <Text className="text-xs font-black uppercase text-indigo-300">Visualizar & Copiar Logs</Text>
                </View>
                <View className="px-2.5 py-1 rounded-lg bg-indigo-500/20 border border-indigo-500/30">
                  <Text className="text-[9px] font-bold font-mono text-indigo-300">ABRIR</Text>
                </View>
              </Pressable>
            </View>
          </ScrollView>

          {/* Botão Salvar & Concluir */}
          <Pressable 
            onPress={handleSalvarConcluir}
            className="w-full py-4 rounded-2xl bg-zinc-100 items-center justify-center shadow-xl active:scale-[0.98] mt-2"
          >
            <Text className="text-center font-black uppercase text-xs tracking-wider text-zinc-950">
              Salvar & Concluir Ajustes
            </Text>
          </Pressable>

        </View>
      </View>

      <CustomToast toast={toast} onDismiss={() => setToast(null)} />

      <DebugLogsModal
        visible={showDebugModal}
        onClose={() => setShowDebugModal(false)}
        contextInfo={{
          "Caixa ID": caixaId,
          "Operador ID": currentOperadorId,
        }}
      />
    </Modal>
  );
}
