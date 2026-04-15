import { useState } from "react";
import { Pressable, Text, TextInput, View, Modal, FlatList } from "react-native";
import { Search, CheckCircle2, Circle, AlertCircle, Trash2, Link as LinkIcon } from "lucide-react-native";
import { MoneyInput } from "../components/common/money-input";
import { LembreteFantasma, Transacao } from "../types/domain";
import { toBrl } from "../utils/currency";

interface ChecklistScreenProps {
  transacoes: Transacao[];
  fantasmas: LembreteFantasma[];
  onToggle: (transacao: Transacao) => Promise<void>;
  onExcluir: (id: string) => void;
  onReportarErro: (id: string, valorReal: number, justificativa: string) => Promise<void>;
  isFechado?: boolean;
}

export function ChecklistScreen({ transacoes, fantasmas, onToggle, onExcluir, onReportarErro, isFechado }: ChecklistScreenProps) {
  const [busca, setBusca] = useState("");

  const [itemEmErro, setItemEmErro] = useState<string | null>(null);
  const [valorRealPago, setValorRealPago] = useState(0);
  const [notaErro, setNotaErro] = useState("");

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
    return map[categoria];
  }

  const transacoesFiltradas = transacoes.filter((t) => {
    if (!busca) return true;
    const valorStr = t.valorSistema.toString().replace(".", ",");
    return valorStr.includes(busca) || t.descricao.toLowerCase().includes(busca.toLowerCase());
  });

  const confirmadas = transacoes.filter(t => t.statusConferencia === "confirmada");

  const renderItem = ({ item }: { item: Transacao }) => {
    const isConfirmada = item.statusConferencia === "confirmada";
    const isCancelamento = item.categoria === "cancelamento";
    
    return (
      <View className={`rounded-[32px] border p-6 shadow-sm mb-4 ${
        isConfirmada 
          ? "border-emerald-500/20 bg-emerald-500/5 opacity-40" 
          : item.statusConferencia === "incorreto"
            ? "border-red-500/40 bg-red-500/10"
            : isCancelamento
              ? "border-red-500/40 bg-red-500/10"
              : "border-zinc-800 bg-ink-900"
      }`}>
        <View className="flex-row items-center justify-between">
          <Pressable
            className="flex-1"
            disabled={isFechado}
            onPress={() => !isFechado && onToggle(item)}
            onLongPress={() => {
              if (!isFechado) {
                setValorRealPago(item.valorRecebidoFisico);
                setItemEmErro(item.id);
              }
            }}
            delayLongPress={500}
          >
            <View className="flex-row items-center gap-2 mb-2">
              <Text className={`text-[10px] font-black uppercase tracking-widest ${isConfirmada ? "text-emerald-500" : "text-zinc-500"}`}>
                {new Date(item.timestamp).toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' })} • {getCategoriaLabel(item.categoria)}
              </Text>
              {isCancelamento && (
                <AlertCircle size={12} color="#f87171" />
              )}
            </View>
            <Text className={`text-2xl font-black tracking-tighter ${isConfirmada ? "text-zinc-600" : "text-zinc-100"}`}>
              {toBrl(item.valorSistema)}
            </Text>
            {fantasmas.some(f => f.transacaoVinculadaId === item.id) && (
              <View className="flex-row items-center gap-1.5 mt-1 bg-blue-500/10 border border-blue-500/20 self-start px-2 py-0.5 rounded-md">
                <LinkIcon size={10} color="#60a5fa" />
                <Text className="text-[8px] font-black text-blue-400 uppercase">Pix Vinculado</Text>
              </View>
            )}
            {item.statusConferencia === "incorreto" && (
              <View className="mt-2 bg-red-500/10 border border-red-500/20 p-2 rounded-xl">
                <Text className="text-[9px] font-black text-red-400 uppercase">Real Pago: {toBrl(item.valorRecebidoFisico)}</Text>
                {item.justificativaTexto && (
                  <Text className="text-[9px] text-zinc-500 font-bold uppercase mt-1">Obs: {item.justificativaTexto}</Text>
                )}
              </View>
            )}
            {item.descricao && item.statusConferencia !== "incorreto" ? (
              <Text className="mt-1 text-xs font-bold text-zinc-500 uppercase tracking-tighter" numberOfLines={1}>{item.descricao}</Text>
            ) : null}
          </Pressable>

          <View className="flex-row items-center gap-3">
            {!isFechado && (
              <Pressable 
                onPress={() => onExcluir(item.id)}
                hitSlop={12}
                className="h-10 w-10 items-center justify-center rounded-[14px] bg-red-500/10 border border-red-500/20"
              >
                <Trash2 size={16} color="#f87171" />
              </Pressable>
            )}
            
            <Pressable
              disabled={isFechado}
              onPress={() => !isFechado && onToggle(item)}
              className={`h-12 w-12 items-center justify-center rounded-[20px] border-2 ${
                isConfirmada ? "border-emerald-500 bg-emerald-500" : "border-zinc-800 bg-ink-900"
              }`}
            >
              {isConfirmada ? (
                <CheckCircle2 size={24} color="#064e3b" strokeWidth={3} />
              ) : (
                <Circle size={24} color="#3f3f46" strokeWidth={3} />
              )}
            </Pressable>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View className="flex-1">
      {/* Modal de Erro Rápido - Fixo na Tela */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={itemEmErro !== null}
        onRequestClose={() => setItemEmErro(null)}
      >
        <View className="flex-1 bg-black/80 items-center justify-center p-6">
          <View className="w-full max-w-[400px] rounded-[40px] border border-red-500/30 bg-ink-900 p-8 shadow-2xl">
            <Text className="text-xl font-black text-white uppercase tracking-widest mb-2">Valor Incorreto?</Text>
            <Text className="text-xs font-bold text-zinc-500 uppercase mb-6">Quanto foi pago na realidade?</Text>
            
            <MoneyInput 
              value={valorRealPago} 
              onChangeValue={setValorRealPago}
              className="rounded-[24px] border border-red-800/40 bg-red-950/20 px-6 py-5 text-3xl font-black text-red-100 mb-4"
            />

            <TextInput
              placeholder="MOTIVO DO ERRO (EX: DESCONTO CARNÊ)"
              placeholderTextColor="#450a0a"
              value={notaErro}
              onChangeText={setNotaErro}
              className="rounded-2xl border border-red-900/30 bg-red-950/10 px-5 py-4 text-red-200 font-bold text-xs mb-6 uppercase"
            />

            <View className="flex-row gap-3">
              <Pressable 
                className="flex-1 rounded-2xl bg-zinc-800 py-4" 
                onPress={() => {
                  setItemEmErro(null);
                  setNotaErro("");
                }}
              >
                <Text className="text-center font-black text-zinc-400 uppercase text-[10px]">Cancelar</Text>
              </Pressable>
              <Pressable 
                disabled={!notaErro.trim()}
                className={`flex-[2] rounded-2xl py-4 ${notaErro.trim() ? 'bg-red-500' : 'bg-red-900 opacity-50'}`}
                onPress={async () => {
                  await onReportarErro(itemEmErro!, valorRealPago, notaErro.trim());
                  setItemEmErro(null);
                  setNotaErro("");
                }}
              >
                <Text className="text-center font-black text-white uppercase text-[10px]">Confirmar Erro</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      
      <FlatList
        className="flex-1"
        showsVerticalScrollIndicator={false}
        overScrollMode="never"
        ListHeaderComponent={
          <View className="gap-6 mb-4">
            <View className="rounded-[32px] border border-zinc-800 bg-ink-900 p-6 shadow-2xl">
              <View className="flex-row items-center gap-3 mb-4 ml-1">
                <Search size={14} color="#71717a" />
                <Text className="text-[10px] font-black uppercase tracking-[3px] text-zinc-600">
                  Localizar Recibo
                </Text>
              </View>
              <TextInput
                className="rounded-2xl border border-zinc-700 bg-ink-800 px-6 py-5 text-zinc-100 font-bold text-lg"
                placeholder="Valor ou descrição..."
                placeholderTextColor="#3f3f46"
                value={busca}
                onChangeText={setBusca}
                keyboardType="numbers-and-punctuation"
              />
            </View>

            <View className="flex-row items-center justify-between px-2">
              <Text className="text-[11px] font-black uppercase tracking-[3px] text-zinc-500">
                Conferência
              </Text>
              <View className="rounded-full bg-blue-500/10 px-4 py-1.5 border border-blue-500/20">
                <Text className="text-[10px] font-black text-blue-400 uppercase tracking-widest">
                  {confirmadas.length} de {transacoes.length} OK
                </Text>
              </View>
            </View>
          </View>
        }
        data={transacoesFiltradas}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        initialNumToRender={20}
        maxToRenderPerBatch={20}
        windowSize={10}
        contentContainerStyle={{ paddingBottom: 140 }}
        ListEmptyComponent={
          <View className="rounded-[32px] border border-dashed border-zinc-800 py-20 items-center justify-center mt-4">
            <Search size={32} color="#27272a" />
            <Text className="mt-4 text-zinc-600 font-black uppercase tracking-widest text-xs">Nada encontrado</Text>
          </View>
        }
      />
    </View>
  );
}
