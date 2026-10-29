import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  FlatList,
  TextInput,
  Switch,
  Share,
  Platform,
  Dimensions,
} from "react-native";
import {
  Terminal,
  X,
  Copy,
  Share2,
  Trash2,
  Search,
  AlertTriangle,
  AlertCircle,
  Info,
  Bug,
  Filter,
  Check,
  RefreshCw,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import {
  LogItem,
  LogLevel,
  getLogs,
  clearLogs,
  subscribeLogs,
  formatLogsForExport,
  setDebugModeActive,
} from "../../services/debug-logger";
import { useAppSettings } from "../../hooks/use-app-settings";
import { CustomToast, ToastConfig } from "../common/custom-toast";

interface DebugLogsModalProps {
  visible: boolean;
  onClose: () => void;
  contextInfo?: Record<string, string>;
}

type FilterCategory = "todos" | "erros" | "avisos" | "sistema" | "rede";

export function DebugLogsModal({ visible, onClose, contextInfo }: DebugLogsModalProps) {
  const { settings, updateSettings } = useAppSettings();
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [filtroTexto, setFiltroTexto] = useState("");
  const [categoria, setCategoria] = useState<FilterCategory>("todos");
  const [toast, setToast] = useState<ToastConfig | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Assina os logs em tempo real enquanto o modal estiver aberto
  useEffect(() => {
    if (!visible) return;
    const unsubscribe = subscribeLogs((newLogs) => {
      setLogs(newLogs);
    });
    return () => unsubscribe();
  }, [visible]);

  const triggerHaptic = (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) => {
    if (settings.hapticsEnabled && Platform.OS !== "web") {
      void Haptics.impactAsync(style);
    }
  };

  // Filtra os logs por categoria e por termo digitado
  const logsFiltrados = useMemo(() => {
    const termo = filtroTexto.trim().toLowerCase();

    return logs
      .slice()
      .reverse() // Mais recentes no topo
      .filter((item) => {
        // Filtro de categoria
        if (categoria === "erros" && item.level !== "error") return false;
        if (categoria === "avisos" && item.level !== "warn") return false;
        if (categoria === "sistema" && item.tag !== "SISTEMA" && item.tag !== "DEPURAÇÃO") return false;
        if (categoria === "rede" && !item.message.toLowerCase().includes("firestore") && !item.message.toLowerCase().includes("drive") && !item.message.toLowerCase().includes("network")) return false;

        // Filtro de busca de texto
        if (!termo) return true;
        return (
          item.message.toLowerCase().includes(termo) ||
          item.timeStr.toLowerCase().includes(termo) ||
          (item.tag && item.tag.toLowerCase().includes(termo))
        );
      });
  }, [logs, categoria, filtroTexto]);

  // Contadores para os botões de filtro
  const contadores = useMemo(() => {
    let erros = 0;
    let avisos = 0;
    for (let i = 0; i < logs.length; i++) {
      if (logs[i].level === "error") erros++;
      else if (logs[i].level === "warn") avisos++;
    }
    return { erros, avisos, total: logs.length };
  }, [logs]);

  // Ação de Copiar Todos os Logs (usando Share nativo com opção de Copiar ou exportar)
  const handleCopiarLogs = async () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    const textoCompleto = formatLogsForExport({
      ...contextInfo,
      "Modo Depuração": settings.debugModeEnabled ? "Ativo" : "Inativo",
      "Horário da Cópia": new Date().toLocaleTimeString("pt-BR"),
    });

    try {
      await Share.share({
        title: "Relatório de Logs - Squirrel",
        message: textoCompleto,
      });
      setToast({
        type: "success",
        title: "Logs Prontos",
        message: "Você pode colar no WhatsApp ou salvar.",
      });
    } catch (e: any) {
      setToast({
        type: "error",
        title: "Erro ao Compartilhar",
        message: e?.message || "Não foi possível copiar.",
      });
    }
  };

  // Ação de Limpar Logs
  const handleLimpar = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
    clearLogs();
    setToast({
      type: "info",
      title: "Logs Limpos",
      message: "Histórico de depuração resetado.",
    });
  };

  // Alterna Modo Depuração
  const handleToggleDebug = (novoValor: boolean) => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    void updateSettings({ debugModeEnabled: novoValor });
    setDebugModeActive(novoValor);
    setToast({
      type: novoValor ? "success" : "info",
      title: novoValor ? "Depuração Ativada" : "Depuração Desativada",
      message: novoValor
        ? "Logs detalhados estão sendo gravados."
        : "Logs reduzidos para modo padrão.",
    });
  };

  // Render do Card de Log Individual
  const renderItem = useCallback(
    ({ item }: { item: LogItem }) => {
      const isError = item.level === "error";
      const isWarn = item.level === "warn";
      const isExpanded = expandedLogId === item.id;

      const borderColor = isError
        ? "border-red-500/40 bg-red-500/10"
        : isWarn
        ? "border-amber-500/40 bg-amber-500/10"
        : "border-zinc-800 bg-[#0d0d12]";

      const badgeColor = isError
        ? "bg-red-500/20 text-red-400"
        : isWarn
        ? "bg-amber-500/20 text-amber-300"
        : "bg-zinc-800 text-zinc-400";

      return (
        <Pressable
          onPress={() => {
            triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
            setExpandedLogId(isExpanded ? null : item.id);
          }}
          className={`p-3 rounded-2xl border mb-2 active:opacity-90 ${borderColor}`}
        >
          <View className="flex-row items-center justify-between mb-1.5">
            <View className="flex-row items-center gap-2">
              <View className={`px-2 py-0.5 rounded-md ${badgeColor}`}>
                <Text className="text-[9px] font-black font-mono uppercase">
                  {item.level.toUpperCase()}
                </Text>
              </View>
              {item.tag && (
                <View className="px-1.5 py-0.5 rounded bg-zinc-800/80 border border-zinc-700/50">
                  <Text className="text-[9px] font-mono text-zinc-300">
                    {item.tag}
                  </Text>
                </View>
              )}
            </View>
            <Text className="text-[9px] font-mono text-zinc-400">
              {item.timeStr}
            </Text>
          </View>

          <Text
            className={`text-xs font-mono select-text ${
              isError ? "text-red-200 font-bold" : isWarn ? "text-amber-200" : "text-zinc-200"
            }`}
            numberOfLines={isExpanded ? undefined : 3}
          >
            {item.message}
          </Text>

          {item.stack && isExpanded && (
            <View className="mt-2 p-2 bg-black/50 rounded-xl border border-red-500/20">
              <Text className="text-[10px] font-mono text-red-300/80 select-text">
                {item.stack}
              </Text>
            </View>
          )}

          <View className="flex-row justify-between items-center mt-1 pt-1 border-t border-zinc-800/40">
            <Text className="text-[8px] font-mono text-zinc-400">
              {isExpanded ? "Toque para recolher" : "Toque para expandir"}
            </Text>
            <Pressable
              onPress={async () => {
                triggerHaptic();
                await Share.share({
                  message: `[${item.timeStr}] [${item.level.toUpperCase()}] ${item.message}${
                    item.stack ? `\nStack:\n${item.stack}` : ""
                  }`,
                });
              }}
              hitSlop={8}
            >
              <Text className="text-[9px] font-bold text-indigo-400 uppercase">
                Copiar Linha
              </Text>
            </Pressable>
          </View>
        </Pressable>
      );
    },
    [expandedLogId]
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/85 justify-end">
        <View className="bg-[#121216] border-t border-zinc-800 rounded-t-[36px] max-h-[92%] flex-1 p-5 shadow-2xl">
          {/* Header */}
          <View className="flex-row items-center justify-between pb-3 border-b border-zinc-800/80">
            <View className="flex-row items-center gap-3">
              <View className="h-10 w-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 items-center justify-center shadow-sm">
                <Terminal size={20} color="#818cf8" strokeWidth={2.2} />
              </View>
              <View>
                <Text className="text-base font-black text-white tracking-wide">
                  Depuração & Logs
                </Text>
                <Text className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                  {contadores.total} eventos capturados
                </Text>
              </View>
            </View>
            <Pressable
              onPress={onClose}
              className="h-9 w-9 rounded-xl bg-zinc-800 items-center justify-center active:scale-95"
            >
              <X size={18} color="#a1a1aa" />
            </Pressable>
          </View>

          {/* Switch de Ativar Modo Depuração */}
          <View className="mt-3 p-3.5 bg-[#09090c] border border-zinc-800/80 rounded-2xl flex-row items-center justify-between shadow-sm">
            <View className="flex-row items-center gap-2.5 flex-1 pr-2">
              <View className="h-8 w-8 rounded-xl bg-amber-500/15 border border-amber-500/30 items-center justify-center">
                <Bug size={16} color="#fbbf24" />
              </View>
              <View className="flex-1">
                <Text className="text-xs font-black uppercase text-zinc-100">
                  Modo Depuração Detalhado
                </Text>
                <Text className="text-[9px] text-zinc-400 font-medium">
                  Grava trace detalhado de Firestore, cálculos e eventos
                </Text>
              </View>
            </View>
            <Switch
              value={settings.debugModeEnabled}
              onValueChange={handleToggleDebug}
              trackColor={{ false: "#27272a", true: "#6366f1" }}
              thumbColor={"#f4f4f5"}
            />
          </View>

          {/* Barra de Busca de Logs */}
          <View className="mt-2.5 flex-row items-center bg-[#09090c] border border-zinc-800 rounded-xl px-3 py-2">
            <Search size={14} color="#71717a" />
            <TextInput
              value={filtroTexto}
              onChangeText={setFiltroTexto}
              placeholder="Pesquisar nos logs (ex: erro, caixa, foto)..."
              placeholderTextColor="#52525b"
              className="flex-1 ml-2 text-xs font-mono text-zinc-200 p-0"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {filtroTexto.length > 0 && (
              <Pressable onPress={() => setFiltroTexto("")} hitSlop={6}>
                <X size={14} color="#a1a1aa" />
              </Pressable>
            )}
          </View>

          {/* Categorias de Filtro */}
          <View className="mt-2 flex-row gap-1.5">
            <Pressable
              onPress={() => {
                triggerHaptic();
                setCategoria("todos");
              }}
              className={`px-3 py-1.5 rounded-xl border flex-row items-center gap-1 active:scale-95 ${
                categoria === "todos"
                  ? "bg-zinc-200 border-zinc-200"
                  : "bg-[#09090c] border-zinc-800"
              }`}
            >
              <Text
                className={`text-[10px] font-black uppercase ${
                  categoria === "todos" ? "text-zinc-950" : "text-zinc-400"
                }`}
              >
                Todos ({contadores.total})
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                triggerHaptic();
                setCategoria("erros");
              }}
              className={`px-3 py-1.5 rounded-xl border flex-row items-center gap-1 active:scale-95 ${
                categoria === "erros"
                  ? "bg-red-500 border-red-500"
                  : "bg-[#09090c] border-zinc-800"
              }`}
            >
              <AlertCircle size={12} color={categoria === "erros" ? "#fff" : "#f87171"} />
              <Text
                className={`text-[10px] font-black uppercase ${
                  categoria === "erros" ? "text-white" : "text-red-400"
                }`}
              >
                Erros ({contadores.erros})
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                triggerHaptic();
                setCategoria("avisos");
              }}
              className={`px-3 py-1.5 rounded-xl border flex-row items-center gap-1 active:scale-95 ${
                categoria === "avisos"
                  ? "bg-amber-500 border-amber-500"
                  : "bg-[#09090c] border-zinc-800"
              }`}
            >
              <AlertTriangle size={12} color={categoria === "avisos" ? "#000" : "#fbbf24"} />
              <Text
                className={`text-[10px] font-black uppercase ${
                  categoria === "avisos" ? "text-zinc-950" : "text-amber-400"
                }`}
              >
                Avisos ({contadores.avisos})
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                triggerHaptic();
                setCategoria("sistema");
              }}
              className={`px-3 py-1.5 rounded-xl border flex-row items-center gap-1 active:scale-95 ${
                categoria === "sistema"
                  ? "bg-indigo-600 border-indigo-600"
                  : "bg-[#09090c] border-zinc-800"
              }`}
            >
              <Text
                className={`text-[10px] font-black uppercase ${
                  categoria === "sistema" ? "text-white" : "text-indigo-400"
                }`}
              >
                Sistema
              </Text>
            </Pressable>
          </View>

          {/* Lista de Logs */}
          <FlatList
            data={logsFiltrados}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            className="flex-1 mt-3"
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={15}
            maxToRenderPerBatch={15}
            windowSize={7}
            ListEmptyComponent={
              <View className="py-16 items-center justify-center border border-dashed border-zinc-800 rounded-3xl mt-2">
                <Terminal size={32} color="#3f3f46" />
                <Text className="text-zinc-500 font-bold uppercase tracking-wider text-xs mt-3">
                  Nenhum log correspondente
                </Text>
              </View>
            }
          />

          {/* Barra de Ações: Copiar Todos e Limpar */}
          <View className="flex-row gap-2.5 pt-3 border-t border-zinc-800/80 mt-2">
            <Pressable
              onPress={handleLimpar}
              className="py-3.5 px-4 rounded-2xl bg-zinc-900 border border-zinc-800 items-center justify-center flex-row gap-2 active:bg-zinc-800"
            >
              <Trash2 size={15} color="#f87171" />
              <Text className="text-xs font-black uppercase text-red-400">
                Limpar
              </Text>
            </Pressable>

            <Pressable
              onPress={handleCopiarLogs}
              className="flex-1 py-3.5 px-4 rounded-2xl bg-indigo-600 items-center justify-center flex-row gap-2 shadow-lg shadow-indigo-500/20 active:bg-indigo-700 active:scale-[0.99]"
            >
              <Share2 size={16} color="#ffffff" strokeWidth={2.2} />
              <Text className="text-xs font-black uppercase tracking-wider text-white">
                Copiar / Compartilhar Logs
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      <CustomToast toast={toast} onDismiss={() => setToast(null)} />
    </Modal>
  );
}
