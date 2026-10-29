import React, { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { Pressable, Text, TextInput, View, Modal, FlatList, ScrollView, Platform } from "react-native";
import { 
  Search, CheckCircle2, Circle, AlertCircle, Trash2, Filter, Target, 
  Cloud, History, Clock, X, Check, Banknote, ArrowDownCircle, 
  ShoppingCart, Split, ArrowUpRight, XCircle, Building2, Flame, Edit3
} from "lucide-react-native";
import Swipeable from "react-native-gesture-handler/Swipeable";
import { MoneyInput } from "../components/common/money-input";
import { TabSwitcher } from "../components/common/tab-switcher";
import { LogAlteracao, Transacao, RegistroPOS, RegistroConvenio } from "../types/domain";
import { toBrl } from "../utils/currency";
import * as Haptics from "expo-haptics";

const EMPTY_LOGS: LogAlteracao[] = [];

interface ChecklistScreenProps {
  transacoes: Transacao[];
  pos: RegistroPOS[];
  convenios: RegistroConvenio[];
  logs?: LogAlteracao[];
  onToggle: (transacao: Transacao) => Promise<void>;
  onTogglePOS?: (id: string, current: string) => Promise<void>;
  onToggleConvenio?: (id: string, current: string) => Promise<void>;
  onExcluir: (id: string) => void;
  onReportarErro: (id: string, valorSistemaNovo: number, valorReal: number, justificativa: string) => Promise<void>;
  isFechado?: boolean;
}

function getCategoriaLabel(categoria: Transacao["categoria"]) {
  const map: Record<Transacao["categoria"], string> = {
    dinheiro: "Dinheiro",
    entrada_prestacao: "Entrada",
    compra_vista: "À Vista",
    gar: "GAR",
    multiplo: "Múltiplo",
    sangria: "Sangria",
    cancelamento: "Cancelamento",
  };
  return map[categoria] || "Dinheiro";
}

function getCategoryTheme(categoria: Transacao["categoria"]) {
  switch (categoria) {
    case "entrada_prestacao":
      return {
        color: "#60a5fa",
        bg: "bg-blue-500/15 border-blue-500/30",
        icon: ArrowDownCircle,
        label: "Entrada",
      };
    case "multiplo":
      return {
        color: "#fb923c",
        bg: "bg-orange-500/15 border-orange-500/30",
        icon: Split,
        label: "Múltiplo",
      };
    case "compra_vista":
      return {
        color: "#f4f4f5",
        bg: "bg-zinc-700/30 border-zinc-600/40",
        icon: ShoppingCart,
        label: "À Vista",
      };
    case "sangria":
      return {
        color: "#f87171",
        bg: "bg-red-500/15 border-red-500/30",
        icon: ArrowUpRight,
        label: "Sangria",
      };
    case "cancelamento":
      return {
        color: "#ef4444",
        bg: "bg-red-600/15 border-red-600/30",
        icon: XCircle,
        label: "Estorno",
      };
    case "gar":
      return {
        color: "#a78bfa",
        bg: "bg-purple-500/15 border-purple-500/30",
        icon: Flame,
        label: "GAR",
      };
    case "dinheiro":
    default:
      return {
        color: "#34d399",
        bg: "bg-emerald-500/15 border-emerald-500/30",
        icon: Banknote,
        label: "Dinheiro",
      };
  }
}

function formatHoraRapida(timestamp: number): string {
  if (!timestamp) return "--:--";
  const d = new Date(timestamp);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

const ChecklistItem = React.memo(function ChecklistItem({
  item,
  itemLogs = EMPTY_LOGS,
  isFechado,
  onToggle,
  onExcluir,
  onAbrirErro,
}: {
  item: Transacao;
  itemLogs?: LogAlteracao[];
  isFechado?: boolean;
  onToggle: (transacao: Transacao) => Promise<void>;
  onExcluir: (id: string) => void;
  onAbrirErro: (transacao: Transacao) => void;
}) {
  const swipeableRef = useRef<Swipeable>(null);
  const isConfirmada = item.statusConferencia === "confirmada";
  const isIncorreto = item.statusConferencia === "incorreto";
  const isSaida = item.categoria === "sangria" || item.categoria === "cancelamento";

  const theme = getCategoryTheme(item.categoria);
  const IconComponent = theme.icon;

  const hora = formatHoraRapida(item.timestamp);

  const renderLeftActions = () => {
    return (
      <View className="bg-emerald-500 justify-center items-start pl-8 pr-12 rounded-[28px] flex-1 mb-2.5">
        <CheckCircle2 size={28} color="#fff" />
      </View>
    );
  };

  const renderRightActions = () => {
    return (
      <View className="bg-red-500 justify-center items-end pr-8 pl-12 rounded-[28px] flex-1 mb-2.5">
        <AlertCircle size={28} color="#fff" />
      </View>
    );
  };

  return (
    <View className="mb-2.5">
      <Swipeable
        ref={swipeableRef}
        enabled={!isFechado}
        renderLeftActions={renderLeftActions}
        renderRightActions={renderRightActions}
        overshootFriction={8}
        onSwipeableOpen={(direction) => {
          swipeableRef.current?.close();
          if (direction === "left") {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onToggle(item);
          } else if (direction === "right") {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onAbrirErro(item);
          }
        }}
      >
        <View
          className={`rounded-[28px] bg-[#121216] p-4 border transition-all shadow-md ${
            isConfirmada
              ? "border-emerald-500/30 opacity-45 bg-[#0e1410]"
              : isIncorreto
              ? "border-red-500/40 bg-red-950/10"
              : isSaida
              ? "border-red-500/30 bg-[#140e0e]"
              : "border-zinc-800"
          }`}
        >
          <View className="flex-row items-center justify-between">
            {/* Lado Esquerdo: Ícone 48x48 + Informações e Valor Hero */}
            <Pressable
              className="flex-1 flex-row items-center gap-3.5 min-w-0"
              disabled={isFechado}
              onLongPress={() => {
                if (!isFechado) {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  onAbrirErro(item);
                }
              }}
              delayLongPress={450}
            >
              {/* Ícone de Categoria 48x48 */}
              <View
                className={`h-12 w-12 items-center justify-center rounded-2xl border flex-shrink-0 ${
                  isConfirmada
                    ? "bg-emerald-500/10 border-emerald-500/20"
                    : theme.bg
                }`}
              >
                <IconComponent
                  size={20}
                  color={isConfirmada ? "#34d399" : theme.color}
                  strokeWidth={2.5}
                />
              </View>

              {/* Informações Centrais */}
              <View className="flex-1 min-w-0">
                {/* Linha 1: Hora • Categoria • Badges */}
                <View className="flex-row items-center gap-1.5 flex-wrap mb-0.5">
                  <Text
                    style={{ color: isConfirmada ? "#10b981" : theme.color }}
                    className="text-[10px] font-black uppercase tracking-widest leading-none"
                  >
                    {hora} • {theme.label}
                  </Text>

                  {item.codigoContrato || (item as any).contrato ? (
                    <View className="bg-zinc-800/80 px-1.5 py-0.5 rounded-md border border-zinc-700/50">
                      <Text className="text-[9px] font-mono font-bold text-zinc-300">
                        #{item.codigoContrato || (item as any).contrato}
                      </Text>
                    </View>
                  ) : null}

                  {isIncorreto && (
                    <View className="bg-red-500/20 px-1.5 py-0.5 rounded border border-red-500/30 flex-row items-center gap-1">
                      <AlertCircle size={9} color="#f87171" />
                      <Text className="text-[8.5px] font-black text-red-300 uppercase">Ajustado</Text>
                    </View>
                  )}

                  {item.pendingSync && (
                    <View className="bg-amber-500/10 px-1.5 py-0.5 rounded flex-row items-center gap-1">
                      <Cloud size={9} color="#f59e0b" />
                    </View>
                  )}

                  {itemLogs.length > 0 && (
                    <View className="bg-blue-500/15 px-1.5 py-0.5 rounded border border-blue-500/30 flex-row items-center gap-1">
                      <History size={9} color="#60a5fa" />
                      <Text className="text-[8.5px] font-black text-blue-300 uppercase">Edit</Text>
                    </View>
                  )}
                </View>

                {/* Linha 2: VALOR GIGANTE (HERO) */}
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  className={`text-xl font-black font-mono tracking-tight ${
                    isConfirmada
                      ? "text-emerald-400/90"
                      : isSaida
                      ? "text-red-400"
                      : "text-white"
                  }`}
                >
                  {isSaida ? "- " : "+ "}
                  {toBrl(item.valorSistema)}
                </Text>

                {/* Linha 3: Ajuste de Erro ou Descrição */}
                {isIncorreto ? (
                  <View className="mt-1 bg-red-500/10 border border-red-500/20 px-2 py-1 rounded-xl">
                    <Text className="text-[9.5px] font-black text-red-400 uppercase">
                      Real Pago: {toBrl(item.valorRecebidoFisico)}
                    </Text>
                    {item.justificativaTexto ? (
                      <Text className="text-[9px] text-zinc-400 font-bold uppercase mt-0.5">
                        Obs: {item.justificativaTexto}
                      </Text>
                    ) : null}
                  </View>
                ) : item.descricao ? (
                  <View className="flex-row items-center gap-1 mt-0.5">
                    <Text
                      className="text-[11.5px] font-bold text-zinc-400 flex-1 min-w-0"
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {item.descricao}
                    </Text>
                  </View>
                ) : null}

                {/* Linha 4: Logs de Edição */}
                {itemLogs.length > 0 && (
                  <View className="mt-1 pt-1 border-t border-zinc-800/50">
                    {itemLogs.slice(0, 1).map((log: LogAlteracao) => (
                      <Text key={log.id} className="text-[8.5px] text-zinc-400 font-bold uppercase">
                        Editado: {toBrl(log.valorAntigo)} → {toBrl(log.valorNovo)}
                      </Text>
                    ))}
                  </View>
                )}
              </View>
            </Pressable>

            {/* Lado Direito: Botões de Ação */}
            <View className="flex-row items-center gap-2 ml-2 flex-shrink-0">
              {!isFechado && (
                <Pressable
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    onExcluir(item.id);
                  }}
                  hitSlop={8}
                  className="h-10 w-10 items-center justify-center rounded-2xl bg-red-500/10 border border-red-500/20 active:bg-red-500/30"
                >
                  <Trash2 size={15} color="#f87171" />
                </Pressable>
              )}

              <Pressable
                disabled={isFechado}
                onPress={() => {
                  if (!isFechado) {
                    void Haptics.impactAsync(
                      isConfirmada
                        ? Haptics.ImpactFeedbackStyle.Light
                        : Haptics.ImpactFeedbackStyle.Medium
                    );
                    onToggle(item);
                  }
                }}
                hitSlop={8}
                className={`h-11 w-11 items-center justify-center rounded-2xl border-2 active:scale-95 ${
                  isConfirmada
                    ? "border-emerald-500 bg-emerald-500 shadow-md shadow-emerald-500/30"
                    : "border-zinc-700 bg-zinc-900 active:bg-zinc-800"
                }`}
              >
                {isConfirmada ? (
                  <Check size={20} color="#064e3b" strokeWidth={3.5} />
                ) : (
                  <Circle size={18} color="#52525b" strokeWidth={2.5} />
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Swipeable>
    </View>
  );
});

const ConvenioChecklistItem = React.memo(function ConvenioChecklistItem({
  item,
  isFechado,
  onToggleConvenio,
}: {
  item: RegistroConvenio;
  isFechado?: boolean;
  onToggleConvenio?: (id: string, current: string) => Promise<void>;
}) {
  const isConfirmada = item.statusConferencia === "confirmada";
  const hora = new Date(item.timestamp).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <View
      className={`rounded-[28px] bg-[#121216] p-4 mb-2.5 border transition-all shadow-md ${
        isConfirmada
          ? "border-emerald-500/30 opacity-45 bg-[#0e1410]"
          : "border-zinc-800"
      }`}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-1 flex-row items-center gap-3.5 min-w-0">
          <View className="h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/15 border border-purple-500/30 flex-shrink-0">
            <Building2 size={20} color="#c084fc" strokeWidth={2.5} />
          </View>

          <View className="flex-1 min-w-0">
            <Text className="text-[10px] font-black uppercase tracking-widest text-purple-400 mb-0.5">
              {hora} • {item.nome}
            </Text>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              className={`text-xl font-black font-mono tracking-tight ${
                isConfirmada ? "text-emerald-400/90" : "text-purple-300"
              }`}
            >
              + {toBrl(item.valor)}
            </Text>
            {item.descricao ? (
              <Text
                className="text-[11.5px] font-bold text-zinc-400 mt-0.5"
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {item.descricao}
              </Text>
            ) : null}
          </View>
        </View>

        <View className="flex-row items-center gap-2 ml-2 flex-shrink-0">
          <Pressable
            disabled={isFechado}
            onPress={() => {
              if (!isFechado && onToggleConvenio) {
                void Haptics.impactAsync(
                  isConfirmada
                    ? Haptics.ImpactFeedbackStyle.Light
                    : Haptics.ImpactFeedbackStyle.Medium
                );
                onToggleConvenio(item.id, item.statusConferencia || "pendente");
              }
            }}
            hitSlop={8}
            className={`h-11 w-11 items-center justify-center rounded-2xl border-2 active:scale-95 ${
              isConfirmada
                ? "border-emerald-500 bg-emerald-500 shadow-md shadow-emerald-500/30"
                : "border-zinc-700 bg-zinc-900 active:bg-zinc-800"
            }`}
          >
            {isConfirmada ? (
              <Check size={20} color="#064e3b" strokeWidth={3.5} />
            ) : (
              <Circle size={18} color="#52525b" strokeWidth={2.5} />
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
});

// Modal isolado com estado local: digitar nele NÃO causa re-render no ChecklistScreen!
interface AjusteValoresModalProps {
  item: Transacao | null;
  onClose: () => void;
  onConfirm: (id: string, valorSistemaNovo: number, valorRealPago: number, justificativa: string) => Promise<void>;
}

const AjusteValoresModal = React.memo(function AjusteValoresModal({
  item,
  onClose,
  onConfirm,
}: AjusteValoresModalProps) {
  const [valorSistemaNovo, setValorSistemaNovo] = useState(0);
  const [valorRealPago, setValorRealPago] = useState(0);
  const [notaErro, setNotaErro] = useState("");

  React.useEffect(() => {
    if (item) {
      setValorSistemaNovo(item.valorSistema);
      setValorRealPago(item.valorRecebidoFisico);
      setNotaErro(item.justificativaTexto || "");
    }
  }, [item?.id]);

  if (!item) return null;

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={true}
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/85 items-center justify-center p-6">
        <View className="w-full max-w-[400px] rounded-3xl border border-red-500/30 bg-[#121216] p-6 shadow-2xl gap-4">
          <View className="flex-row items-center justify-between pb-2 border-b border-zinc-800">
            <View className="flex-row items-center gap-2">
              <View className="h-6 w-6 rounded-lg bg-red-500/20 border border-red-500/30 items-center justify-center">
                <AlertCircle size={13} color="#f87171" />
              </View>
              <Text className="text-xs font-black text-white uppercase tracking-[1.5px]">
                Ajuste de Valores
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10}>
              <X size={16} color="#71717a" />
            </Pressable>
          </View>

          <View className="flex-row gap-3">
            <View className="flex-1 bg-[#09090c] p-3 rounded-2xl border border-blue-500/30">
              <Text className="text-[10px] font-bold text-blue-400 uppercase mb-1">
                Lançado Sistema
              </Text>
              <MoneyInput
                value={valorSistemaNovo}
                onChangeValue={setValorSistemaNovo}
                className="w-full text-lg font-black text-blue-100 font-mono"
              />
            </View>
            <View className="flex-1 bg-[#09090c] p-3 rounded-2xl border border-red-500/30">
              <Text className="text-[10px] font-bold text-red-400 uppercase mb-1">
                Real Recebido
              </Text>
              <MoneyInput
                value={valorRealPago}
                onChangeValue={setValorRealPago}
                className="w-full text-lg font-black text-red-100 font-mono"
              />
            </View>
          </View>

          <TextInput
            placeholder="MOTIVO DO AJUSTE (EX: DESCONTO CARNÊ)"
            placeholderTextColor="#52525b"
            value={notaErro}
            onChangeText={setNotaErro}
            className="rounded-2xl border border-zinc-800 bg-[#09090c] px-4 py-3.5 text-zinc-200 font-bold text-xs uppercase"
          />

          <View className="flex-row gap-2.5 pt-1">
            <Pressable
              className="flex-1 rounded-2xl bg-zinc-900 border border-zinc-800 py-3.5 items-center justify-center active:scale-95"
              onPress={onClose}
            >
              <Text className="font-black text-zinc-400 uppercase text-[11px] tracking-wider">
                Cancelar
              </Text>
            </Pressable>
            <Pressable
              disabled={!notaErro.trim()}
              className={`flex-[1.5] rounded-2xl py-3.5 items-center justify-center active:scale-95 ${
                notaErro.trim() ? "bg-red-600" : "bg-red-950/40 opacity-50"
              }`}
              onPress={async () => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                await onConfirm(
                  item.id,
                  valorSistemaNovo,
                  valorRealPago,
                  notaErro.trim()
                );
                onClose();
              }}
            >
              <Text className="font-black text-white uppercase text-[11px] tracking-wider">
                Confirmar Ajuste
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
});

interface ChecklistSearchBarProps {
  onSearchChange: (text: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
}

const ChecklistSearchBar = React.memo(function ChecklistSearchBar({
  onSearchChange,
  onFocus,
  onBlur,
}: ChecklistSearchBarProps) {
  const [text, setText] = useState("");
  const [searchByText, setSearchByText] = useState(false);
  const timerRef = useRef<any>(null);

  const handleChangeText = (newText: string) => {
    setText(newText);
    if (timerRef.current) clearTimeout(timerRef.current);
    
    // Se limpou pelo teclado, dá um pequeno respiro de 50ms para a animação do teclado fluir lisa
    if (!newText.trim()) {
      timerRef.current = setTimeout(() => {
        onSearchChange("");
      }, 50);
      return;
    }

    // Debounce balanceado de 150ms: digitação e backspacing fluidos sem recalcular a lista a cada tecla
    timerRef.current = setTimeout(() => {
      onSearchChange(newText);
    }, 150);
  };

  const handleClear = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setText("");
    onSearchChange("");
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <View className="rounded-3xl border border-zinc-800 bg-[#121216] p-3.5 px-4 shadow-xl gap-2">
      <View className="flex-row items-center justify-between ml-0.5">
        <View className="flex-row items-center gap-2">
          <Search size={13} color="#a1a1aa" />
          <Text className="text-[10.5px] font-black uppercase tracking-[1.5px] text-zinc-400">
            Localizar Recibo
          </Text>
        </View>
        <Pressable
          onPress={() => setSearchByText(!searchByText)}
          className={`px-2 py-1 rounded-lg border flex-row items-center gap-1 ${
            searchByText
              ? "bg-zinc-800 border-zinc-700"
              : "bg-transparent border-zinc-800"
          }`}
        >
          <Text
            className={`text-[9.5px] font-black uppercase tracking-wider ${
              searchByText ? "text-zinc-200" : "text-zinc-500"
            }`}
          >
            {searchByText ? "Texto" : "123"}
          </Text>
        </Pressable>
      </View>
      <View className="relative justify-center">
        <TextInput
          className="rounded-2xl border border-zinc-800 bg-[#09090c] px-4 py-3 text-zinc-100 font-bold text-base pr-11"
          placeholder="Valor ou descrição..."
          placeholderTextColor="#52525b"
          value={text}
          onChangeText={handleChangeText}
          onFocus={onFocus}
          onBlur={onBlur}
          keyboardType={searchByText ? "default" : "numeric"}
        />
        {text.length > 0 && (
          <Pressable
            onPress={handleClear}
            className="absolute right-3 p-1.5 bg-zinc-800 rounded-full active:bg-zinc-700"
          >
            <X size={14} color="#a1a1aa" />
          </Pressable>
        )}
      </View>
    </View>
  );
});

// Cabeçalho memorizado e isolado da lista
interface ChecklistHeaderProps {
  hasConvenios: boolean;
  modoChecagem: "transacoes" | "outros";
  setModoChecagem: (modo: "transacoes" | "outros") => void;
  isConferido100: boolean;
  progresso: number;
  totalConfirmado: number;
  totalEsperado: number;
  faltaConfirmarValor: number;
  itensPendentes: number;
  itensConfirmados: number;
  totalItens: number;
  abaAtiva: string;
  setAbaAtiva: (aba: string) => void;
  subAbaDinheiro: "todas" | "especie" | "multiplo" | "gar";
  setSubAbaDinheiro: (sub: "todas" | "especie" | "multiplo" | "gar") => void;
  onSearchChange: (text: string) => void;
  onFocusSearch: () => void;
  onBlurSearch: () => void;
  apenasPendentes: boolean;
  setApenasPendentes: (val: boolean) => void;
  showTimeFilter: boolean;
  setShowTimeFilter: (val: boolean) => void;
  horaInicio: number | null;
  horaFim: number | null;
  setHoraInicio: (h: number | null) => void;
  setHoraFim: (h: number | null) => void;
}

const ChecklistHeader = React.memo(function ChecklistHeader({
  hasConvenios,
  modoChecagem,
  setModoChecagem,
  isConferido100,
  progresso,
  totalConfirmado,
  totalEsperado,
  faltaConfirmarValor,
  itensPendentes,
  itensConfirmados,
  totalItens,
  abaAtiva,
  setAbaAtiva,
  subAbaDinheiro,
  setSubAbaDinheiro,
  onSearchChange,
  onFocusSearch,
  onBlurSearch,
  apenasPendentes,
  setApenasPendentes,
  showTimeFilter,
  setShowTimeFilter,
  horaInicio,
  horaFim,
  setHoraInicio,
  setHoraFim,
}: ChecklistHeaderProps) {
  return (
    <View className="gap-3.5 mb-3">
      {hasConvenios && (
        <View className="flex-row gap-1.5 bg-[#121216] p-1.5 rounded-2xl border border-zinc-800">
          <Pressable
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setModoChecagem("transacoes");
            }}
            className={`flex-1 py-2.5 rounded-xl items-center ${
              modoChecagem === "transacoes" ? "bg-zinc-800 shadow-sm" : ""
            }`}
          >
            <Text
              className={`text-[10.5px] font-black uppercase tracking-widest ${
                modoChecagem === "transacoes" ? "text-white" : "text-zinc-500"
              }`}
            >
              Transações
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setModoChecagem("outros");
            }}
            className={`flex-1 py-2.5 rounded-xl items-center ${
              modoChecagem === "outros" ? "bg-zinc-800 shadow-sm" : ""
            }`}
          >
            <Text
              className={`text-[10.5px] font-black uppercase tracking-widest ${
                modoChecagem === "outros" ? "text-white" : "text-zinc-500"
              }`}
            >
              Convênios
            </Text>
          </Pressable>
        </View>
      )}

      {modoChecagem === "transacoes" && (
        <>
          {/* CARD DE PROGRESSO DA CONFERÊNCIA (ESTILO SQUIRREL DNA) */}
          <View
            className={`rounded-3xl border ${
              isConferido100
                ? "border-emerald-500/40 bg-[#0e1611]"
                : "border-blue-500/30 bg-[#121216]"
            } p-4 shadow-xl gap-3 transition-all`}
          >
            {/* Topo: Ícone + Título + Status Badge */}
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <View
                  className={`h-6 w-6 rounded-lg ${
                    isConferido100
                      ? "bg-emerald-500/20 border border-emerald-500/40"
                      : "bg-blue-500/15 border border-blue-500/30"
                  } items-center justify-center flex-shrink-0`}
                >
                  {isConferido100 ? (
                    <Check size={13} color="#34d399" strokeWidth={3} />
                  ) : (
                    <Target size={13} color="#60a5fa" />
                  )}
                </View>
                <Text
                  className={`text-[11px] font-black uppercase tracking-wider ${
                    isConferido100 ? "text-emerald-300" : "text-blue-300"
                  }`}
                >
                  {isConferido100 ? "Conferência 100% Concluída" : "Progresso da Conferência"}
                </Text>
              </View>

              <View
                className={`${
                  isConferido100
                    ? "bg-emerald-500/15 border-emerald-500/40"
                    : "bg-blue-500/10 border-blue-500/30"
                } border px-2.5 py-0.5 rounded-xl`}
              >
                <Text
                  className={`text-xs font-black font-mono tracking-wider ${
                    isConferido100 ? "text-emerald-300" : "text-blue-400"
                  }`}
                >
                  {Math.round(progresso)}%
                </Text>
              </View>
            </View>

            {/* Linha de Valores: Confirmado vs Total Esperado */}
            <View className="flex-row items-center justify-between gap-2">
              <View className="flex-1 min-w-0">
                <Text className="text-[9.5px] font-bold text-zinc-500 uppercase tracking-wider mb-0.5">
                  Total Conferido
                </Text>
                <Text
                  numberOfLines={1}
                  className={`text-2xl font-black font-mono tracking-tight ${
                    isConferido100 ? "text-emerald-300" : "text-blue-400"
                  }`}
                >
                  {toBrl(totalConfirmado)}
                </Text>
              </View>

              <View className="items-end flex-shrink-0">
                <Text className="text-[9.5px] font-bold text-zinc-500 uppercase tracking-wider mb-0.5">
                  Total a Bater
                </Text>
                <Text
                  numberOfLines={1}
                  className="text-base font-black font-mono text-zinc-300"
                >
                  {toBrl(totalEsperado)}
                </Text>
              </View>
            </View>

            {/* Resumo de Pendências + Badge de Contagem */}
            <View className="flex-row items-center justify-between gap-2 pt-1 border-t border-zinc-800/60">
              <Text
                numberOfLines={1}
                className={`text-[10px] font-bold uppercase tracking-wider flex-1 min-w-0 ${
                  isConferido100 ? "text-emerald-400" : "text-amber-400"
                }`}
              >
                {isConferido100
                  ? "✓ Todos os canhotos conferidos"
                  : `Falta ${toBrl(faltaConfirmarValor)} (${itensPendentes} pendentes)`}
              </Text>
              <View className="px-2.5 py-1 rounded-lg bg-[#09090c] border border-zinc-800 flex-shrink-0">
                <Text className="text-[11px] font-mono font-black text-zinc-200">
                  {itensConfirmados}/{totalItens}
                </Text>
              </View>
            </View>

            {/* Barra de Progresso com Indicador de Status */}
            <View className="h-2 w-full bg-zinc-800/90 rounded-full overflow-hidden">
              <View
                className={`h-full rounded-full transition-all ${
                  isConferido100 ? "bg-emerald-500" : "bg-blue-500"
                }`}
                style={{ width: `${Math.min(100, Math.max(0, progresso))}%` }}
              />
            </View>
          </View>

          {/* FILTRO DE CATEGORIAS (TABSWITCHER) */}
          <TabSwitcher
            tabs={[
              { key: "todas", label: "Todas" },
              { key: "dinheiro", label: "Dinheiro" },
              { key: "entradas", label: "Entrada" },
              { key: "avista", label: "À Vista" },
              { key: "saidas", label: "Saídas" },
            ]}
            activeKey={abaAtiva}
            onChange={(key) => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setAbaAtiva(key);
              setSubAbaDinheiro("todas");
            }}
          />

          {abaAtiva === "dinheiro" && (
            <View className="-mt-1 mb-1 px-1">
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 6 }}
              >
                {[
                  { key: "todas", label: "Geral" },
                  { key: "especie", label: "Apenas Espécie" },
                  { key: "multiplo", label: "Apenas Múltiplo" },
                  { key: "gar", label: "Apenas GAR" },
                ].map((sub) => (
                  <Pressable
                    key={sub.key}
                    onPress={() => {
                      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSubAbaDinheiro(sub.key as any);
                    }}
                    className={`px-3.5 py-1.5 rounded-xl border ${
                      subAbaDinheiro === sub.key
                        ? "bg-zinc-800 border-zinc-700"
                        : "bg-transparent border-transparent"
                    }`}
                  >
                    <Text
                      className={`text-[10.5px] font-black uppercase tracking-wider ${
                        subAbaDinheiro === sub.key
                          ? "text-zinc-200"
                          : "text-zinc-500"
                      }`}
                    >
                      {sub.label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}
        </>
      )}

      {/* BARRA DE LOCALIZAR RECIBO (COMPONENTE ISOLADO, 120 FPS, ZERO LAG AO DIGITAR/APAGAR) */}
      <ChecklistSearchBar
        onSearchChange={onSearchChange}
        onFocus={onFocusSearch}
        onBlur={onBlurSearch}
      />

      {/* FILTROS RÁPIDOS */}
      {modoChecagem === "transacoes" && (
        <View className="flex-row items-center gap-2 px-1">
          <Text className="text-[10.5px] font-black uppercase tracking-[1.5px] text-zinc-500 mr-1">
            Filtros:
          </Text>
          <Pressable
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setApenasPendentes(!apenasPendentes);
            }}
            className={`flex-row items-center gap-1.5 px-3.5 py-2 rounded-2xl border ${
              apenasPendentes
                ? "bg-amber-500/15 border-amber-500/30"
                : "bg-[#121216] border-zinc-800"
            }`}
          >
            <Filter
              size={12}
              color={apenasPendentes ? "#f59e0b" : "#71717a"}
            />
            <Text
              className={`text-xs font-black uppercase tracking-wider ${
                apenasPendentes ? "text-amber-400" : "text-zinc-400"
              }`}
            >
              {apenasPendentes ? "Pendentes" : "Todos"}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowTimeFilter(!showTimeFilter);
            }}
            className={`flex-row items-center gap-1.5 px-3.5 py-2 rounded-2xl border ${
              horaInicio !== null || horaFim !== null
                ? "bg-blue-500/15 border-blue-500/30"
                : "bg-[#121216] border-zinc-800"
            }`}
          >
            <Clock
              size={12}
              color={horaInicio !== null || horaFim !== null ? "#60a5fa" : "#71717a"}
            />
            <Text
              className={`text-[9.5px] font-black uppercase tracking-wider ${
                horaInicio !== null || horaFim !== null
                  ? "text-blue-400"
                  : "text-zinc-400"
              }`}
            >
              {horaInicio !== null || horaFim !== null
                ? `${horaInicio}h - ${horaFim}h`
                : "Horário"}
            </Text>
          </Pressable>
        </View>
      )}

      {/* SELETOR DE HORÁRIO EXPANSÍVEL */}
      {showTimeFilter && (
        <View className="bg-[#121216] border border-zinc-800 rounded-3xl p-4 gap-3">
          <View className="flex-row items-center justify-between">
            <Text className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">
              Filtrar por Intervalo (Horas)
            </Text>
            {(horaInicio !== null || horaFim !== null) && (
              <Pressable
                onPress={() => {
                  setHoraInicio(null);
                  setHoraFim(null);
                }}
                className="flex-row items-center gap-1"
              >
                <X size={10} color="#f87171" />
                <Text className="text-[9px] font-black text-red-400 uppercase">
                  Limpar
                </Text>
              </Pressable>
            )}
          </View>

          <View className="gap-3">
            <View>
              <Text className="text-[9px] font-bold text-zinc-500 uppercase mb-1.5 ml-1">
                A partir das: {horaInicio !== null ? `${horaInicio}:00` : "--:--"}
              </Text>
              <View className="flex-row flex-wrap gap-1.5">
                {[7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22].map(
                  (h) => (
                    <Pressable
                      key={h}
                      onPress={() => setHoraInicio(h)}
                      className={`h-8 w-10 items-center justify-center rounded-xl border ${
                        horaInicio === h
                          ? "bg-blue-600 border-blue-500"
                          : "bg-[#09090c] border-zinc-800"
                      }`}
                    >
                      <Text
                        className={`text-[10px] font-black ${
                          horaInicio === h ? "text-white" : "text-zinc-400"
                        }`}
                      >
                        {h}h
                      </Text>
                    </Pressable>
                  )
                )}
              </View>
            </View>

            <View>
              <Text className="text-[9px] font-bold text-zinc-500 uppercase mb-1.5 ml-1">
                Até às: {horaFim !== null ? `${horaFim}:00` : "--:--"}
              </Text>
              <View className="flex-row flex-wrap gap-1.5">
                {[7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22].map(
                  (h) => (
                    <Pressable
                      key={h}
                      onPress={() => setHoraFim(h)}
                      className={`h-8 w-10 items-center justify-center rounded-xl border ${
                        horaFim === h
                          ? "bg-blue-600 border-blue-500"
                          : "bg-[#09090c] border-zinc-800"
                      }`}
                    >
                      <Text
                        className={`text-[10px] font-black ${
                          horaFim === h ? "text-white" : "text-zinc-400"
                        }`}
                      >
                        {h}h
                      </Text>
                    </Pressable>
                  )
                )}
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  );
});

function ChecklistScreenComponent({
  transacoes,
  pos,
  convenios,
  logs,
  onToggle,
  onTogglePOS,
  onToggleConvenio,
  onExcluir,
  onReportarErro,
  isFechado,
}: ChecklistScreenProps) {
  const [modoChecagem, setModoChecagem] = useState<"transacoes" | "outros">("transacoes");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const [busca, setBusca] = useState("");
  const handleSearchChange = useCallback((text: string) => {
    setBusca(text);
  }, []);

  const [apenasPendentes, setApenasPendentes] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState("todas");
  const [subAbaDinheiro, setSubAbaDinheiro] = useState<"todas" | "especie" | "multiplo" | "gar">("todas");

  const [horaInicio, setHoraInicio] = useState<number | null>(null);
  const [horaFim, setHoraFim] = useState<number | null>(null);
  const [showTimeFilter, setShowTimeFilter] = useState(false);

  // Item selecionado para ajuste de valores no modal isolado
  const [itemEmErro, setItemEmErro] = useState<Transacao | null>(null);

  // Pré-indexação O(1) dos logs para evitar buscas repetidas por linha
  const logsByTxId = useMemo(() => {
    const map = new Map<string, LogAlteracao[]>();
    if (logs && logs.length > 0) {
      for (let i = 0; i < logs.length; i++) {
        const log = logs[i];
        if (!log.transacaoId) continue;
        const list = map.get(log.transacaoId) || [];
        list.push(log);
        map.set(log.transacaoId, list);
      }
    }
    return map;
  }, [logs]);

  // Filtro de Transações por Aba (Memoizado)
  const transacoesPorAba = useMemo(() => {
    if (abaAtiva === "todas") return transacoes;
    return transacoes.filter((t) => {
      if (abaAtiva === "dinheiro") {
        if (subAbaDinheiro === "especie") return t.categoria === "dinheiro";
        if (subAbaDinheiro === "multiplo") return t.categoria === "multiplo";
        if (subAbaDinheiro === "gar") return t.categoria === "gar";
        return t.categoria === "dinheiro" || t.categoria === "multiplo" || t.categoria === "gar";
      }
      if (abaAtiva === "entradas") return t.categoria === "entrada_prestacao";
      if (abaAtiva === "avista") return t.categoria === "compra_vista";
      if (abaAtiva === "saidas") return t.categoria === "sangria" || t.categoria === "cancelamento";
      return true;
    });
  }, [transacoes, abaAtiva, subAbaDinheiro]);

  // Filtro de Busca e Intervalo de Horas (Otimizado: exatos primeiro, menor para maior)
  const transacoesFiltradas = useMemo(() => {
    const termo = busca.trim();
    if (!termo && !apenasPendentes && horaInicio === null && horaFim === null) {
      return transacoesPorAba;
    }

    const buscaLower = termo.toLowerCase();
    const buscaNumStr = buscaLower.replace(".", ",");
    const buscaDotStr = buscaLower.replace(",", ".");
    const queryNum = parseFloat(buscaDotStr);
    const hasQueryNum = !isNaN(queryNum);

    const filtered = transacoesPorAba.filter((t) => {
      if (apenasPendentes && t.statusConferencia === "confirmada") return false;
      if (horaInicio !== null || horaFim !== null) {
        const itemHour = new Date(t.timestamp).getHours();
        if (horaInicio !== null && itemHour < horaInicio) return false;
        if (horaFim !== null && itemHour > horaFim) return false;
      }
      if (!buscaLower) return true;

      const val = t.valorSistema || 0;
      if (hasQueryNum && Math.abs(val - queryNum) < 0.001) return true;

      const valStr = String(val);
      if (valStr.includes(buscaDotStr) || valStr.replace(".", ",").includes(buscaNumStr)) {
        return true;
      }

      return Boolean(t.descricao && t.descricao.toLowerCase().includes(buscaLower));
    });

    if (!buscaLower) {
      return filtered;
    }

    // Ordenação Inteligente de Busca Solicitada:
    // 1º: Valores exatos primeiro (ex: todos os 100 no topo)
    // 2º: Ordenados do menor para o maior (ex: 100 -> 1000 -> 1100)
    // 3º: Em empate de valor, o mais recente primeiro (timestamp)
    return filtered.slice().sort((a, b) => {
      const valA = a.valorSistema || 0;
      const valB = b.valorSistema || 0;
      const exactA = hasQueryNum && Math.abs(valA - queryNum) < 0.001;
      const exactB = hasQueryNum && Math.abs(valB - queryNum) < 0.001;

      if (exactA && !exactB) return -1;
      if (!exactA && exactB) return 1;

      if (Math.abs(valA - valB) > 0.001) {
        return valA - valB;
      }

      return b.timestamp - a.timestamp;
    });
  }, [transacoesPorAba, apenasPendentes, horaInicio, horaFim, busca]);

  // Cálculo O(N) unificado em uma única passada
  const {
    totalEsperado,
    totalConfirmado,
    totalItens,
    itensConfirmados,
    itensPendentes,
    faltaConfirmarValor,
    progresso,
    isConferido100,
  } = useMemo(() => {
    let esperado = 0;
    let confirmado = 0;
    const total = transacoesPorAba.length;
    let confirmadosCount = 0;

    for (let i = 0; i < total; i++) {
      const t = transacoesPorAba[i];
      const isSaida = t.categoria === "sangria" || t.categoria === "cancelamento";
      const isConf = t.statusConferencia === "confirmada";
      const val = t.valorSistema || 0;

      if (isSaida) {
        esperado -= val;
        if (isConf) confirmado -= val;
      } else {
        esperado += val;
        if (isConf) confirmado += val;
      }

      if (isConf) confirmadosCount++;
    }

    const pendentesCount = Math.max(0, total - confirmadosCount);
    const falta = Math.max(0, esperado - confirmado);
    const prog = total > 0 ? (confirmadosCount / total) * 100 : 0;
    const is100 = total > 0 && confirmadosCount === total;

    return {
      totalEsperado: esperado,
      totalConfirmado: confirmado,
      totalItens: total,
      itensConfirmados: confirmadosCount,
      itensPendentes: pendentesCount,
      faltaConfirmarValor: falta,
      progresso: prog,
      isConferido100: is100,
    };
  }, [transacoesPorAba]);

  // Lista de convênios filtrada e memoizada (exatos primeiro, menor para maior)
  const conveniosFiltrados = useMemo(() => {
    if (!convenios || convenios.length === 0) return [];
    const termo = busca.trim();
    if (!termo) {
      return [...convenios].sort((a, b) => b.timestamp - a.timestamp);
    }

    const buscaLower = termo.toLowerCase();
    const buscaNumStr = buscaLower.replace(".", ",");
    const queryNum = parseFloat(termo.replace(",", "."));
    const hasQueryNum = !isNaN(queryNum);

    return convenios
      .filter((f) => {
        const isNumMatch = hasQueryNum && f.valor === queryNum;
        return (
          isNumMatch ||
          f.valor.toString().replace(".", ",").includes(buscaNumStr) ||
          (f.descricao || f.nome || "").toLowerCase().includes(buscaLower)
        );
      })
      .sort((a, b) => {
        const valA = a.valor || 0;
        const valB = b.valor || 0;
        const exactA = hasQueryNum && Math.abs(valA - queryNum) < 0.001;
        const exactB = hasQueryNum && Math.abs(valB - queryNum) < 0.001;

        if (exactA && !exactB) return -1;
        if (!exactA && exactB) return 1;

        if (Math.abs(valA - valB) > 0.001) {
          return valA - valB;
        }

        return b.timestamp - a.timestamp;
      });
  }, [convenios, busca]);

  const handleAbrirErro = useCallback((t: Transacao) => {
    setItemEmErro(t);
  }, []);

  const handleCloseModalErro = useCallback(() => {
    setItemEmErro(null);
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: Transacao }) => {
      return (
        <ChecklistItem
          key={item.id}
          item={item}
          itemLogs={logsByTxId.get(item.id) || EMPTY_LOGS}
          isFechado={isFechado}
          onToggle={onToggle}
          onExcluir={onExcluir}
          onAbrirErro={handleAbrirErro}
        />
      );
    },
    [logsByTxId, isFechado, onToggle, onExcluir, handleAbrirErro]
  );

  const renderOutrosItem = useCallback(
    ({ item }: { item: RegistroConvenio }) => {
      return (
        <ConvenioChecklistItem
          key={item.id}
          item={item}
          isFechado={isFechado}
          onToggleConvenio={onToggleConvenio}
        />
      );
    },
    [isFechado, onToggleConvenio]
  );

  const handleFocusSearch = useCallback(() => {
    setIsSearchFocused(true);
    flatListRef.current?.scrollToOffset({ offset: 320, animated: true });
  }, []);

  const handleBlurSearch = useCallback(() => {
    setIsSearchFocused(false);
  }, []);

  // Header memoizado com todas as props estáveis (NÃO recria ao digitar ou apagar busca!)
  const headerComponent = useMemo(() => {
    return (
      <ChecklistHeader
        hasConvenios={Boolean(convenios && convenios.length > 0)}
        modoChecagem={modoChecagem}
        setModoChecagem={setModoChecagem}
        isConferido100={isConferido100}
        progresso={progresso}
        totalConfirmado={totalConfirmado}
        totalEsperado={totalEsperado}
        faltaConfirmarValor={faltaConfirmarValor}
        itensPendentes={itensPendentes}
        itensConfirmados={itensConfirmados}
        totalItens={totalItens}
        abaAtiva={abaAtiva}
        setAbaAtiva={setAbaAtiva}
        subAbaDinheiro={subAbaDinheiro}
        setSubAbaDinheiro={setSubAbaDinheiro}
        onSearchChange={handleSearchChange}
        onFocusSearch={handleFocusSearch}
        onBlurSearch={handleBlurSearch}
        apenasPendentes={apenasPendentes}
        setApenasPendentes={setApenasPendentes}
        showTimeFilter={showTimeFilter}
        setShowTimeFilter={setShowTimeFilter}
        horaInicio={horaInicio}
        horaFim={horaFim}
        setHoraInicio={setHoraInicio}
        setHoraFim={setHoraFim}
      />
    );
  }, [
    convenios,
    modoChecagem,
    isConferido100,
    progresso,
    totalConfirmado,
    totalEsperado,
    faltaConfirmarValor,
    itensPendentes,
    itensConfirmados,
    totalItens,
    abaAtiva,
    subAbaDinheiro,
    handleSearchChange,
    handleFocusSearch,
    handleBlurSearch,
    apenasPendentes,
    showTimeFilter,
    horaInicio,
    horaFim,
  ]);

  const listContentStyle = useMemo(
    () => ({ paddingBottom: isSearchFocused || busca ? 400 : 140 }),
    [isSearchFocused, Boolean(busca)]
  );

  return (
    <View className="flex-1">
      {/* MODAL DE AJUSTE DE VALORES ISOLADO (ZERO LAG AO DIGITAR) */}
      <AjusteValoresModal
        item={itemEmErro}
        onClose={handleCloseModalErro}
        onConfirm={onReportarErro}
      />

      <FlatList
        ref={flatListRef}
        className="flex-1"
        showsVerticalScrollIndicator={false}
        overScrollMode="never"
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={headerComponent}
        data={modoChecagem === "transacoes" ? transacoesFiltradas : conveniosFiltrados}
        keyExtractor={(item) => item.id}
        renderItem={modoChecagem === "transacoes" ? (renderItem as any) : (renderOutrosItem as any)}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={5}
        updateCellsBatchingPeriod={50}
        removeClippedSubviews={Platform.OS === "android"}
        contentContainerStyle={listContentStyle}
        ListEmptyComponent={
          <View className="rounded-[32px] border border-dashed border-zinc-800 py-20 items-center justify-center mt-4">
            <Search size={32} color="#27272a" />
            <Text className="mt-4 text-zinc-600 font-black uppercase tracking-widest text-xs">
              Nada encontrado
            </Text>
          </View>
        }
      />
    </View>
  );
}

export const ChecklistScreen = React.memo(ChecklistScreenComponent);
