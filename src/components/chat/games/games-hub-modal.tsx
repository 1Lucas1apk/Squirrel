import React, { useState, useMemo } from "react";
import { View, Text, Pressable, Modal, ScrollView, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { 
  Gamepad2, 
  Sparkles, 
  Search, 
  X, 
  ChevronLeft,
  Anchor, 
  Grid3X3, 
  CircleDot, 
  Clock, 
  Users, 
  Lock, 
  Flame, 
  Dices, 
  Brain, 
  Crosshair, 
  Shield, 
  Zap, 
  Swords
} from "lucide-react-native";
import { ChatContact, TipoJogoChat } from "../../../types/domain";

interface GamesHubModalProps {
  visible: boolean;
  onClose: () => void;
  activeContact: ChatContact | null;
  onIniciarJogo: (contact: ChatContact, tipo: TipoJogoChat, customPalavra?: string, customDica?: string) => Promise<void>;
  onAbrirDesafioTermoCustom: () => void;
  onAbrirDesafioForcaCustom: () => void;
  onToast: (toast: { type: "success" | "warning" | "error" | "info"; title: string; message: string }) => void;
}

type CategoriaJogo = "todos" | "palavras" | "estrategia" | "tabuleiro" | "classicos";

export const GamesHubModal: React.FC<GamesHubModalProps> = ({
  visible,
  onClose,
  activeContact,
  onIniciarJogo,
  onAbrirDesafioTermoCustom,
  onAbrirDesafioForcaCustom,
  onToast,
}) => {
  const [categoriaAtiva, setCategoriaAtiva] = useState<CategoriaJogo>("todos");
  const [busca, setBusca] = useState("");

  const handleJogar = (tipo: TipoJogoChat, titulo: string) => {
    if (!activeContact) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      onToast({
        type: "warning",
        title: "Selecione um Colega",
        message: "Abra a conversa privada de um atendente para desafiá-lo para uma partida!"
      });
      return;
    }

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    onClose();
    void onIniciarJogo(activeContact, tipo);
    onToast({
      type: "success",
      title: `${titulo} Iniciado! ⚔️`,
      message: `A partida contra @${activeContact.username} começou no chat!`
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-[#07080d]">
        <SafeAreaView className="flex-1 flex-col">
          
          {/* ========================================================================= */}
          {/* 1. TOP BAR 100% RESPONSIVA */}
          {/* ========================================================================= */}
          <View className="px-3.5 py-2.5 bg-[#0c0d14] border-b border-zinc-800/80 flex-row items-center justify-between">
            <View className="flex-row items-center gap-2.5 flex-1 min-w-0 mr-2">
              <Pressable
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onClose();
                }}
                className="h-9 w-9 rounded-xl bg-zinc-900 border border-zinc-800 items-center justify-center active:scale-95 flex-shrink-0"
              >
                <ChevronLeft size={19} color="#d4d4d8" />
              </Pressable>

              <View className="flex-1 min-w-0">
                <View className="flex-row items-center gap-1.5">
                  <Gamepad2 size={13} color="#818cf8" />
                  <Text className="text-[10.5px] font-black uppercase tracking-[1.5px] text-indigo-400">
                    SQUIRREL ARCADE
                  </Text>
                  <View className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                </View>
                <Text className="text-sm font-black uppercase tracking-wider text-white truncate" numberOfLines={1}>
                  Hub de Jogos 1v1
                </Text>
              </View>
            </View>

            <Pressable
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onClose();
              }}
              className="h-9 w-9 rounded-xl bg-zinc-900 border border-zinc-800 items-center justify-center active:scale-95 flex-shrink-0"
            >
              <X size={16} color="#a1a1aa" />
            </Pressable>
          </View>

          {/* ========================================================================= */}
          {/* 2. BANNER DE ADVERSÁRIO (RESPONSIVO EM LINHA SEPARADA) */}
          {/* ========================================================================= */}
          <View className="px-3.5 pt-2 pb-1 bg-[#0c0d14]/60">
            {activeContact ? (
              <View className="p-2 rounded-xl bg-indigo-950/40 border border-indigo-500/30 flex-row items-center justify-between">
                <View className="flex-row items-center gap-2 flex-1 min-w-0 mr-2">
                  <View className="h-2 w-2 rounded-full bg-emerald-400 flex-shrink-0" />
                  <Text className="text-xs font-bold text-zinc-300 truncate" numberOfLines={1}>
                    Desafiando: <Text className="text-white font-black">{activeContact.displayName}</Text>
                  </Text>
                  <Text className="text-[11px] font-mono text-indigo-300 font-bold flex-shrink-0">
                    @{activeContact.username}
                  </Text>
                </View>
                <View className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex-shrink-0">
                  <Text className="text-[9px] font-black uppercase text-emerald-400">Pronto</Text>
                </View>
              </View>
            ) : (
              <View className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 flex-row items-center gap-2">
                <Users size={13} color="#fbbf24" className="flex-shrink-0" />
                <Text className="text-[11px] text-amber-300 font-bold flex-1" numberOfLines={1}>
                  Abra uma conversa privada para desafiar um colega.
                </Text>
              </View>
            )}
          </View>

          {/* ========================================================================= */}
          {/* 3. CONTEÚDO ROLÁVEL COM CONTAINER MAX-W-MD */}
          {/* ========================================================================= */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            className="flex-1"
            contentContainerStyle={{ paddingBottom: 32 }}
          >
            <View className="w-full max-w-[480px] self-center px-3.5 pt-2 gap-3.5">
              
              {/* BUSCA */}
              <View className="h-11 px-3 bg-zinc-900/90 border border-zinc-800 rounded-xl flex-row items-center gap-2 shadow-sm">
                <Search size={15} color="#71717a" />
                <TextInput
                  value={busca}
                  onChangeText={setBusca}
                  placeholder="Buscar jogo (termo, naval, raciocínio)..."
                  placeholderTextColor="#52525b"
                  className="flex-1 text-xs text-white font-medium"
                  style={{ paddingVertical: 0 }}
                />
                {Boolean(busca) && (
                  <Pressable onPress={() => setBusca("")}>
                    <X size={14} color="#71717a" />
                  </Pressable>
                )}
              </View>

              {/* TABS DE CATEGORIAS */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {[
                  { id: "todos", label: "Todos", icon: Flame },
                  { id: "palavras", label: "Palavras", icon: Brain },
                  { id: "estrategia", label: "Estratégia", icon: Crosshair },
                  { id: "tabuleiro", label: "Tabuleiro", icon: CircleDot },
                  { id: "classicos", label: "Rápidos", icon: Zap },
                ].map(cat => {
                  const IconC = cat.icon;
                  const isSelected = categoriaAtiva === cat.id;
                  return (
                    <Pressable
                      key={cat.id}
                      onPress={() => {
                        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setCategoriaAtiva(cat.id as CategoriaJogo);
                      }}
                      className={`px-3 py-1.5 rounded-xl border flex-row items-center gap-1.5 active:scale-95 ${
                        isSelected
                          ? "bg-indigo-600 border-indigo-400 shadow-sm shadow-indigo-600/30"
                          : "bg-zinc-900/80 border-zinc-800"
                      }`}
                    >
                      <IconC size={12} color={isSelected ? "#ffffff" : "#a1a1aa"} />
                      <Text className={`text-[11px] font-black uppercase tracking-wider ${isSelected ? "text-white" : "text-zinc-400"}`}>
                        {cat.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {/* ========================================================================= */}
              {/* HERO CARD: TERMO VERSUS */}
              {/* ========================================================================= */}
              {(!busca || "termo versus palavras".includes(busca.toLowerCase())) && (categoriaAtiva === "todos" || categoriaAtiva === "palavras") && (
                <View className="rounded-2xl bg-[#091712] border border-emerald-500/40 p-4 shadow-xl gap-2.5 overflow-hidden relative">
                  
                  {/* Arte Visual de Fundo: Grade Flutuante Neon do Termo */}
                  <View className="absolute right-2 top-2 opacity-15 pointer-events-none flex-row gap-1">
                    <View className="gap-1">
                      <View className="w-5 h-5 rounded bg-emerald-500" />
                      <View className="w-5 h-5 rounded bg-zinc-800" />
                      <View className="w-5 h-5 rounded bg-amber-500" />
                    </View>
                    <View className="gap-1">
                      <View className="w-5 h-5 rounded bg-amber-500" />
                      <View className="w-5 h-5 rounded bg-emerald-500" />
                      <View className="w-5 h-5 rounded bg-emerald-500" />
                    </View>
                    <View className="gap-1">
                      <View className="w-5 h-5 rounded bg-zinc-800" />
                      <View className="w-5 h-5 rounded bg-emerald-500" />
                      <View className="w-5 h-5 rounded bg-zinc-800" />
                    </View>
                  </View>

                  {/* Topo do Card */}
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-2 flex-wrap flex-1 mr-2">
                      <View className="px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/50 flex-row items-center gap-1">
                        <Flame size={10} color="#34d399" />
                        <Text className="text-[9px] font-black uppercase text-emerald-300">EM ALTA</Text>
                      </View>
                      <View className="px-2 py-0.5 rounded-md bg-zinc-900 border border-zinc-700">
                        <Text className="text-[9px] font-mono text-zinc-300 font-bold">10.000+ PALAVRAS</Text>
                      </View>
                    </View>

                    <View className="px-2 py-0.5 rounded-full bg-zinc-950 border border-zinc-800 flex-row items-center gap-1">
                      <Clock size={10} color="#34d399" />
                      <Text className="text-[9.5px] font-mono text-zinc-300 font-bold">~3 min</Text>
                    </View>
                  </View>

                  {/* Título */}
                  <View>
                    <Text className="text-xl font-black uppercase tracking-wider text-white">
                      Termo Versus
                    </Text>
                    <Text className="text-xs font-bold text-emerald-400 mt-0.5">
                      Duelo de Palavras Secretas 1v1
                    </Text>
                  </View>

                  <Text className="text-xs text-zinc-300 leading-4">
                    Adivinhe a palavra secreta de 5 letras em até 6 tentativas. Verde acertou, 
                    amarelo existe e cinza não existe. Fog-of-War ativado para ninguém colar!
                  </Text>

                  {/* Letras Ilustrativas (100% Responsivas) */}
                  <View className="flex-row items-center gap-1.5 my-1">
                    {[
                      { l: "T", bg: "bg-emerald-600 border-emerald-400" },
                      { l: "E", bg: "bg-amber-500 border-amber-300" },
                      { l: "R", bg: "bg-zinc-800 border-zinc-700" },
                      { l: "M", bg: "bg-emerald-600 border-emerald-400" },
                      { l: "O", bg: "bg-emerald-600 border-emerald-400" },
                    ].map((b, i) => (
                      <View key={i} className={`w-8 h-8 rounded-lg border items-center justify-center ${b.bg}`}>
                        <Text className="text-xs font-black text-white">{b.l}</Text>
                      </View>
                    ))}
                    <Text className="text-[10px] font-mono text-emerald-400 font-bold ml-1.5">
                      = 6 TENTATIVAS
                    </Text>
                  </View>

                  {/* Botões do Termo (Empilhados para Nunca Cortar em Celulares Pequenos) */}
                  <View className="gap-2 pt-1 border-t border-emerald-950/80">
                    <Pressable
                      onPress={() => handleJogar("termo_versus", "Termo Versus")}
                      className="w-full h-11 rounded-xl bg-emerald-500 border border-emerald-300 items-center justify-center flex-row gap-2 active:scale-98 shadow-md shadow-emerald-500/20"
                    >
                      <Dices size={15} color="#064e3b" strokeWidth={2.5} />
                      <Text className="text-xs font-black uppercase tracking-wider text-emerald-950">
                        Sorteio Rápido do Dicionário
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => {
                        if (!activeContact) {
                          onToast({
                            type: "warning",
                            title: "Selecione um Colega",
                            message: "Abra a conversa de um colega para desafiá-lo com palavra secreta!"
                          });
                          return;
                        }
                        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        onClose();
                        onAbrirDesafioTermoCustom();
                      }}
                      className="w-full h-11 rounded-xl bg-purple-600/80 border border-purple-400 items-center justify-center flex-row gap-2 active:scale-98 shadow-sm"
                    >
                      <Sparkles size={15} color="#ffffff" strokeWidth={2} />
                      <Text className="text-xs font-black uppercase tracking-wider text-white" numberOfLines={1}>
                        Criar Desafio Personalizado
                      </Text>
                    </Pressable>
                  </View>
                </View>
              )}

              {/* ========================================================================= */}
              {/* CARD: JOGO DA FORCA (HANGMAN VERSUS) */}
              {/* ========================================================================= */}
              {(!busca || "jogo da forca hangman palavras letras".includes(busca.toLowerCase())) && (categoriaAtiva === "todos" || categoriaAtiva === "palavras") && (
                <View className="rounded-2xl bg-[#0b101c] border border-cyan-500/40 p-4 shadow-xl gap-2.5 overflow-hidden relative">
                  
                  {/* Arte Visual de Fundo: Forca Laser Holográfica 100% Vetorial */}
                  <View className="absolute right-3 top-3 opacity-15 pointer-events-none w-16 h-16 items-center justify-between p-1">
                    <View className="w-12 h-1 bg-cyan-400 rounded-full flex-row justify-end">
                      <View className="w-1 h-4 bg-cyan-300 shadow-sm" />
                    </View>
                    <View className="w-6 h-6 rounded-lg border border-cyan-400/80 my-0.5 items-center justify-center">
                      <View className="w-3 h-1 rounded-full bg-cyan-300" />
                    </View>
                    <View className="w-10 h-1 bg-cyan-600 rounded-full" />
                  </View>

                  {/* Topo do Card */}
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-2 flex-wrap flex-1 mr-2">
                      <View className="px-2 py-0.5 rounded-md bg-cyan-500/20 border border-cyan-400/50 flex-row items-center gap-1">
                        <Flame size={10} color="#38bdf8" />
                        <Text className="text-[9px] font-black uppercase text-cyan-300">NOVO</Text>
                      </View>
                      <View className="px-2 py-0.5 rounded-md bg-zinc-900 border border-zinc-700">
                        <Text className="text-[9px] font-mono text-zinc-300 font-bold">SISTEMA DE DICAS VIVO</Text>
                      </View>
                    </View>

                    <View className="px-2 py-0.5 rounded-full bg-zinc-950 border border-zinc-800 flex-row items-center gap-1">
                      <Clock size={10} color="#38bdf8" />
                      <Text className="text-[9.5px] font-mono text-zinc-300 font-bold">~3 min</Text>
                    </View>
                  </View>

                  {/* Título */}
                  <View>
                    <Text className="text-xl font-black uppercase tracking-wider text-white">
                      Jogo da Forca
                    </Text>
                    <Text className="text-xs font-bold text-cyan-300 mt-0.5">
                      Hangman Versus com Pistas em Tempo Real
                    </Text>
                  </View>

                  <Text className="text-xs text-zinc-300 leading-4">
                    Jogue no <Text className="text-cyan-300 font-bold">Duelo 1v1</Text> onde ambos tentam adivinhar a palavra em turnos alternados, ou crie um <Text className="text-cyan-300 font-bold">Desafio Personalizado</Text> com sua própria palavra e dê pistas ao vivo!
                  </Text>

                  {/* Ilustração das Vidas */}
                  <View className="flex-row items-center justify-between p-2 rounded-xl bg-black/40 border border-cyan-950">
                    <Text className="text-[10px] font-mono text-cyan-300 font-bold">SCANNER HOLOGRÁFICO</Text>
                    <Text className="text-[10px] font-mono text-zinc-400 font-bold">6 FASES DE CONTENÇÃO</Text>
                  </View>

                  {/* Botões da Forca */}
                  <View className="gap-2 pt-1 border-t border-cyan-950/80">
                    <Pressable
                      onPress={() => handleJogar("forca", "Jogo da Forca")}
                      className="w-full h-11 rounded-xl bg-cyan-500 border border-cyan-300 items-center justify-center flex-row gap-2 active:scale-98 shadow-md shadow-cyan-500/20"
                    >
                      <Swords size={15} color="#082f49" strokeWidth={2.5} />
                      <Text className="text-xs font-black uppercase tracking-wider text-cyan-950" numberOfLines={1}>
                        Duelo 1v1 (Sorteio em Turnos)
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => {
                        if (!activeContact) {
                          onToast({
                            type: "warning",
                            title: "Selecione um Colega",
                            message: "Abra a conversa de um colega para desafiá-lo na forca!"
                          });
                          return;
                        }
                        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        onClose();
                        onAbrirDesafioForcaCustom();
                      }}
                      className="w-full h-11 rounded-xl bg-cyan-950/80 border border-cyan-400 items-center justify-center flex-row gap-2 active:scale-98 shadow-sm"
                    >
                      <Sparkles size={15} color="#38bdf8" strokeWidth={2} />
                      <Text className="text-xs font-black uppercase tracking-wider text-cyan-300" numberOfLines={1}>
                        Criar Palavra Secreta & Pista
                      </Text>
                    </Pressable>
                  </View>
                </View>
              )}

              {/* ========================================================================= */}
              {/* CARD: STOP! / ADEDONHA 1v1 */}
              {/* ========================================================================= */}
              {(!busca || "stop adedonha palavras letras categorias".includes(busca.toLowerCase())) && (categoriaAtiva === "todos" || categoriaAtiva === "palavras") && (
                <View className="rounded-2xl bg-[#150f0c] border border-amber-500/40 p-4 shadow-xl gap-2.5 overflow-hidden relative">
                  
                  {/* Arte Visual de Fundo: Sirene de Emergência */}
                  <View className="absolute right-3 top-3 opacity-15 pointer-events-none w-16 h-16 items-center justify-center">
                    <View className="w-14 h-14 rounded-full border border-amber-400/40 items-center justify-center">
                      <Flame size={36} color="#f59e0b" />
                    </View>
                  </View>

                  {/* Topo do Card */}
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-2 flex-wrap flex-1 mr-2">
                      <View className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-400/50 flex-row items-center gap-1">
                        <Flame size={10} color="#fbbf24" />
                        <Text className="text-[9px] font-black uppercase text-amber-300">NOVIDADE 🔥</Text>
                      </View>
                      <View className="px-2 py-0.5 rounded-md bg-zinc-900 border border-zinc-700">
                        <Text className="text-[9px] font-mono text-zinc-300 font-bold">4 CATEGORIAS • AUDITORIA VIVA</Text>
                      </View>
                    </View>

                    <View className="px-2 py-0.5 rounded-full bg-zinc-950 border border-zinc-800 flex-row items-center gap-1">
                      <Clock size={10} color="#fbbf24" />
                      <Text className="text-[9.5px] font-mono text-zinc-300 font-bold">~2 min</Text>
                    </View>
                  </View>

                  {/* Título */}
                  <View>
                    <Text className="text-xl font-black uppercase tracking-wider text-white">
                      Stop! Adedonha
                    </Text>
                    <Text className="text-xs font-bold text-amber-400 mt-0.5">
                      Duelo de Palavras Rápidas & Botão STOP 1v1
                    </Text>
                  </View>

                  <Text className="text-xs text-zinc-300 leading-4">
                    Uma letra é sorteada na rodada. Preencha Nome, Comida, Objeto e Lugar o mais rápido que puder e aperte o botão de emergência <Text className="text-rose-400 font-bold">STOP!</Text> para travar o adversário. Na auditoria, palavras únicas valem +10, repetidas +5 e zoeiras 0!
                  </Text>

                  {/* Badges das 4 Categorias */}
                  <View className="flex-row items-center gap-1.5 flex-wrap">
                    <View className="px-2 py-1 rounded-lg bg-zinc-900/90 border border-zinc-800">
                      <Text className="text-[9.5px] font-bold text-zinc-300">👤 Nome</Text>
                    </View>
                    <View className="px-2 py-1 rounded-lg bg-zinc-900/90 border border-zinc-800">
                      <Text className="text-[9.5px] font-bold text-zinc-300">🍕 Comida</Text>
                    </View>
                    <View className="px-2 py-1 rounded-lg bg-zinc-900/90 border border-zinc-800">
                      <Text className="text-[9.5px] font-bold text-zinc-300">📦 Objeto</Text>
                    </View>
                    <View className="px-2 py-1 rounded-lg bg-zinc-900/90 border border-zinc-800">
                      <Text className="text-[9.5px] font-bold text-zinc-300">🌍 Lugar</Text>
                    </View>
                  </View>

                  {/* Botão de Iniciar Partida */}
                  <View className="pt-1 border-t border-amber-950/80">
                    <Pressable
                      onPress={() => handleJogar("stop", "Stop! Adedonha")}
                      className="w-full h-11 rounded-xl bg-amber-500 border border-amber-300 items-center justify-center flex-row gap-2 active:scale-98 shadow-md shadow-amber-500/20"
                    >
                      <Flame size={15} color="#451a03" strokeWidth={2.5} />
                      <Text className="text-xs font-black uppercase tracking-wider text-amber-950" numberOfLines={1}>
                        Sortear Letra & Iniciar Duelo
                      </Text>
                    </Pressable>
                  </View>
                </View>
              )}

              {/* ========================================================================= */}
              {/* CARD 2: BATALHA NAVAL */}
              {/* ========================================================================= */}
              {(!busca || "batalha naval radar tiro".includes(busca.toLowerCase())) && (categoriaAtiva === "todos" || categoriaAtiva === "estrategia") && (
                <View className="rounded-2xl bg-[#091526] border border-cyan-500/40 p-4 shadow-lg gap-2.5 overflow-hidden relative">
                  
                  {/* Arte Visual de Fundo: Sonar Tático Naval */}
                  <View className="absolute right-2 top-2 opacity-20 pointer-events-none w-20 h-20 items-center justify-center">
                    <View className="w-20 h-20 rounded-full border border-cyan-400/30 items-center justify-center">
                      <View className="w-12 h-12 rounded-full border border-cyan-400/40 items-center justify-center">
                        <View className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                      </View>
                    </View>
                    <View className="absolute w-20 h-[1px] bg-cyan-400/25" />
                    <View className="absolute h-20 w-[1px] bg-cyan-400/25" />
                  </View>

                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-2.5 flex-1 min-w-0 mr-2">
                      <View className="h-10 w-10 rounded-xl bg-cyan-500/20 border border-cyan-400/40 items-center justify-center flex-shrink-0">
                        <Anchor size={20} color="#38bdf8" />
                      </View>
                      <View className="flex-1 min-w-0">
                        <Text className="text-base font-black uppercase tracking-wider text-white truncate" numberOfLines={1}>
                          Batalha Naval
                        </Text>
                        <Text className="text-[11px] text-cyan-300 font-bold">Radar 5x5 • Guerra Tática</Text>
                      </View>
                    </View>

                    <View className="px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-400/30 flex-shrink-0">
                      <Text className="text-[8.5px] font-black uppercase text-cyan-300">DISPONÍVEL</Text>
                    </View>
                  </View>

                  <Text className="text-xs text-zinc-300 leading-4">
                    Esconda 3 navios no radar 5x5. Dispare tiros alternados e afunde a frota inimiga primeiro!
                  </Text>

                  {/* Chips Informativos */}
                  <View className="flex-row items-center gap-2 pt-1 border-t border-cyan-950">
                    <View className="flex-row items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-950 border border-zinc-800">
                      <Clock size={10} color="#38bdf8" />
                      <Text className="text-[10px] font-mono text-zinc-300 font-bold">~4 min</Text>
                    </View>
                    <View className="flex-row items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-950 border border-zinc-800">
                      <Crosshair size={10} color="#38bdf8" />
                      <Text className="text-[10px] font-mono text-zinc-300 font-bold">25 Quadrantes</Text>
                    </View>
                  </View>

                  {/* Botão de Ação Full Width */}
                  <Pressable
                    onPress={() => handleJogar("batalha_naval", "Batalha Naval")}
                    className="w-full h-11 rounded-xl bg-cyan-600 border border-cyan-400 items-center justify-center flex-row gap-2 active:scale-98 shadow-md shadow-cyan-600/30"
                  >
                    <Anchor size={15} color="#ffffff" />
                    <Text className="text-xs font-black uppercase tracking-wider text-white">
                      Desafiar Frota Naval
                    </Text>
                  </Pressable>
                </View>
              )}

              {/* ========================================================================= */}
              {/* CARD 3: 4 EM LINHA */}
              {/* ========================================================================= */}
              {(!busca || "4 em linha connect quatro fichas".includes(busca.toLowerCase())) && (categoriaAtiva === "todos" || categoriaAtiva === "tabuleiro") && (
                <View className="rounded-2xl bg-[#160e26] border border-indigo-500/40 p-4 shadow-lg gap-2.5 overflow-hidden relative">
                  
                  {/* Arte Visual de Fundo: Grade Connect-4 */}
                  <View className="absolute right-2 top-2 opacity-25 pointer-events-none flex-row gap-1 bg-indigo-950/60 p-1.5 rounded-xl border border-indigo-500/30">
                    <View className="gap-1">
                      <View className="w-3.5 h-3.5 rounded-full bg-rose-500" />
                      <View className="w-3.5 h-3.5 rounded-full bg-amber-400" />
                      <View className="w-3.5 h-3.5 rounded-full bg-zinc-800" />
                    </View>
                    <View className="gap-1">
                      <View className="w-3.5 h-3.5 rounded-full bg-amber-400" />
                      <View className="w-3.5 h-3.5 rounded-full bg-rose-500" />
                      <View className="w-3.5 h-3.5 rounded-full bg-rose-500" />
                    </View>
                    <View className="gap-1">
                      <View className="w-3.5 h-3.5 rounded-full bg-zinc-800" />
                      <View className="w-3.5 h-3.5 rounded-full bg-amber-400" />
                      <View className="w-3.5 h-3.5 rounded-full bg-rose-500" />
                    </View>
                  </View>

                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-2.5 flex-1 min-w-0 mr-2">
                      <View className="h-10 w-10 rounded-xl bg-indigo-500/20 border border-indigo-400/40 items-center justify-center flex-shrink-0">
                        <CircleDot size={20} color="#a855f7" />
                      </View>
                      <View className="flex-1 min-w-0">
                        <Text className="text-base font-black uppercase tracking-wider text-white truncate" numberOfLines={1}>
                          4 em Linha
                        </Text>
                        <Text className="text-[11px] text-indigo-300 font-bold">Tabuleiro Vertical com Gravidade</Text>
                      </View>
                    </View>

                    <View className="px-2 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-400/30 flex-shrink-0">
                      <Text className="text-[8.5px] font-black uppercase text-indigo-300">DISPONÍVEL</Text>
                    </View>
                  </View>

                  <Text className="text-xs text-zinc-300 leading-4">
                    Solte fichas pelas 7 colunas. A gravidade empilha as peças! Conecte 4 fichas em linha.
                  </Text>

                  {/* Chips Informativos */}
                  <View className="flex-row items-center gap-2 pt-1 border-t border-indigo-950">
                    <View className="flex-row items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-950 border border-zinc-800">
                      <Clock size={10} color="#a855f7" />
                      <Text className="text-[10px] font-mono text-zinc-300 font-bold">~2 min</Text>
                    </View>
                    <View className="flex-row items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-950 border border-zinc-800">
                      <Shield size={10} color="#a855f7" />
                      <Text className="text-[10px] font-mono text-zinc-300 font-bold">Física & Reflexo</Text>
                    </View>
                  </View>

                  {/* Botão de Ação Full Width */}
                  <Pressable
                    onPress={() => handleJogar("quatro_linha", "4 em Linha")}
                    className="w-full h-11 rounded-xl bg-indigo-600 border border-indigo-400 items-center justify-center flex-row gap-2 active:scale-98 shadow-md shadow-indigo-600/30"
                  >
                    <CircleDot size={15} color="#ffffff" />
                    <Text className="text-xs font-black uppercase tracking-wider text-white">
                      Conectar Fichas
                    </Text>
                  </Pressable>
                </View>
              )}

              {/* ========================================================================= */}
              {/* CARD 4: JOGO DA VELHA */}
              {/* ========================================================================= */}
              {(!busca || "jogo da velha tic tac toe clássico".includes(busca.toLowerCase())) && (categoriaAtiva === "todos" || categoriaAtiva === "classicos") && (
                <View className="rounded-2xl bg-[#14141c] border border-purple-500/40 p-4 shadow-lg gap-2.5 overflow-hidden relative">
                  
                  {/* Arte Visual de Fundo: Grade Neon 3x3 Retrô */}
                  <View className="absolute right-2 top-2 opacity-25 pointer-events-none w-16 h-16 justify-between p-1 bg-purple-950/40 rounded-xl border border-purple-500/30">
                    <View className="flex-row justify-between items-center px-0.5">
                      <Text className="text-[11px] font-black text-purple-400">X</Text>
                      <Text className="text-[11px] font-black text-zinc-600">·</Text>
                      <Text className="text-[11px] font-black text-rose-400">O</Text>
                    </View>
                    <View className="h-[1px] bg-purple-500/30 w-full" />
                    <View className="flex-row justify-between items-center px-0.5">
                      <Text className="text-[11px] font-black text-zinc-600">·</Text>
                      <Text className="text-[11px] font-black text-purple-400">X</Text>
                      <Text className="text-[11px] font-black text-zinc-600">·</Text>
                    </View>
                    <View className="h-[1px] bg-purple-500/30 w-full" />
                    <View className="flex-row justify-between items-center px-0.5">
                      <Text className="text-[11px] font-black text-rose-400">O</Text>
                      <Text className="text-[11px] font-black text-zinc-600">·</Text>
                      <Text className="text-[11px] font-black text-purple-400">X</Text>
                    </View>
                  </View>

                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-2.5 flex-1 min-w-0 mr-2">
                      <View className="h-10 w-10 rounded-xl bg-purple-500/20 border border-purple-400/40 items-center justify-center flex-shrink-0">
                        <Grid3X3 size={20} color="#c084fc" />
                      </View>
                      <View className="flex-1 min-w-0">
                        <Text className="text-base font-black uppercase tracking-wider text-white truncate" numberOfLines={1}>
                          Jogo da Velha
                        </Text>
                        <Text className="text-[11px] text-purple-300 font-bold">O Clássico dos Clássicos</Text>
                      </View>
                    </View>

                    <View className="px-2 py-0.5 rounded-full bg-purple-500/15 border border-purple-400/30 flex-shrink-0">
                      <Text className="text-[8.5px] font-black uppercase text-purple-300">DISPONÍVEL</Text>
                    </View>
                  </View>

                  <Text className="text-xs text-zinc-300 leading-4">
                    Disputa instantânea de X e O no balão de chat com placar ao vivo e revanche com 1 toque.
                  </Text>

                  {/* Chips Informativos */}
                  <View className="flex-row items-center gap-2 pt-1 border-t border-purple-950">
                    <View className="flex-row items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-950 border border-zinc-800">
                      <Clock size={10} color="#c084fc" />
                      <Text className="text-[10px] font-mono text-zinc-300 font-bold">~1 min</Text>
                    </View>
                    <View className="flex-row items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-950 border border-zinc-800">
                      <Zap size={10} color="#c084fc" />
                      <Text className="text-[10px] font-mono text-zinc-300 font-bold">Duelo Rápido</Text>
                    </View>
                  </View>

                  {/* Botão de Ação Full Width */}
                  <Pressable
                    onPress={() => handleJogar("velha", "Jogo da Velha")}
                    className="w-full h-11 rounded-xl bg-purple-600 border border-purple-400 items-center justify-center flex-row gap-2 active:scale-98 shadow-md shadow-purple-600/30"
                  >
                    <Swords size={15} color="#ffffff" />
                    <Text className="text-xs font-black uppercase tracking-wider text-white">
                      Desafiar no Balão
                    </Text>
                  </Pressable>
                </View>
              )}

              {/* ========================================================================= */}
              {/* SEÇÃO PRÓXIMOS JOGOS (ROADMAP) */}
              {/* ========================================================================= */}
              <View className="mt-1 pt-3 border-t border-zinc-800/80 gap-2.5">
                <View className="flex-row items-center gap-1.5">
                  <Sparkles size={14} color="#fbbf24" />
                  <Text className="text-xs font-black uppercase tracking-wider text-amber-300">
                    Próximos Lançamentos no Hub
                  </Text>
                </View>

                {/* Truco */}
                <View className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80 flex-row items-center justify-between opacity-75">
                  <View className="flex-row items-center gap-2.5 flex-1 min-w-0 mr-2">
                    <View className="h-9 w-9 rounded-xl bg-amber-500/10 border border-amber-500/20 items-center justify-center flex-shrink-0">
                      <Text className="text-lg">🃏</Text>
                    </View>
                    <View className="flex-1 min-w-0">
                      <Text className="text-xs font-black text-white uppercase truncate" numberOfLines={1}>
                        Truco & Baralho 1v1
                      </Text>
                      <Text className="text-[10px] text-zinc-400 truncate" numberOfLines={1}>
                        Blefe, manilhas e rodadas rápidas com cartas secretas.
                      </Text>
                    </View>
                  </View>
                  <View className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 flex-row items-center gap-1 flex-shrink-0">
                    <Lock size={9} color="#71717a" />
                    <Text className="text-[8.5px] font-mono font-bold text-zinc-500 uppercase">Em Breve</Text>
                  </View>
                </View>

                {/* Quiz */}
                <View className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80 flex-row items-center justify-between opacity-75">
                  <View className="flex-row items-center gap-2.5 flex-1 min-w-0 mr-2">
                    <View className="h-9 w-9 rounded-xl bg-sky-500/10 border border-sky-500/20 items-center justify-center flex-shrink-0">
                      <Text className="text-lg">💡</Text>
                    </View>
                    <View className="flex-1 min-w-0">
                      <Text className="text-xs font-black text-white uppercase truncate" numberOfLines={1}>
                        Quiz de Agilidade & Caixa
                      </Text>
                      <Text className="text-[10px] text-zinc-400 truncate" numberOfLines={1}>
                        Perguntas de reflexo e regras com pontuação ao vivo.
                      </Text>
                    </View>
                  </View>
                  <View className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 flex-row items-center gap-1 flex-shrink-0">
                    <Lock size={9} color="#71717a" />
                    <Text className="text-[8.5px] font-mono font-bold text-zinc-500 uppercase">Em Breve</Text>
                  </View>
                </View>
              </View>

              {/* RODAPÉ */}
              <View className="pt-2 items-center">
                <Text className="text-[9.5px] text-zinc-500 font-mono text-center">
                  Digite <Text className="text-indigo-400 font-bold">/jogos</Text> a qualquer momento no chat para abrir este Hub.
                </Text>
              </View>

            </View>
          </ScrollView>

        </SafeAreaView>
      </View>
    </Modal>
  );
};
