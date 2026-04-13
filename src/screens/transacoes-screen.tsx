import { useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { 
  Plus, 
  Trash2, 
  Edit3, 
  Banknote, 
  ArrowDownCircle, 
  ShoppingCart, 
  ShieldCheck, 
  Split, 
  ArrowUpCircle, 
  XCircle,
  X,
  Check
} from "lucide-react-native";
import { MoneyInput } from "../components/common/money-input";
import { CategoriaTransacao, NaturezaOperacao, Transacao } from "../types/domain";
import { toBrl } from "../utils/currency";

interface TransacoesScreenProps {
  transacoes: Transacao[];
  onAdicionar: (input: {
    naturezaOperacao: NaturezaOperacao;
    categoria: CategoriaTransacao;
    descricao: string;
    valorSistema: number;
    valorRecebidoFisico: number;
    trocoSobra: number;
    justificativaTexto?: string | null;
  }) => Promise<void>;
  onExcluir: (id: string) => Promise<void>;
  onEditar: (id: string, input: any) => Promise<void>;
}

const categorias: { value: CategoriaTransacao; label: string; icon: any; color: string }[] = [
  { value: "dinheiro", label: "Dinheiro", icon: Banknote, color: "text-emerald-400" },
  { value: "entrada_prestacao", label: "Entrada", icon: ArrowDownCircle, color: "text-blue-400" },
  { value: "compra_vista", label: "À Vista", icon: ShoppingCart, color: "text-zinc-100" },
  { value: "gar", label: "GAR", icon: ShieldCheck, color: "text-zinc-100" },
  { value: "multiplo", label: "Misto", icon: Split, color: "text-orange-400" },
  { value: "sangria", label: "Sangria", icon: ArrowUpCircle, color: "text-red-400" },
  { value: "cancelamento", label: "Cancel", icon: XCircle, color: "text-red-500" },
];

function naturezaPorCategoria(categoria: CategoriaTransacao): NaturezaOperacao {
  return categoria === "entrada_prestacao" ? "entrada" : "pagamento";
}

export function TransacoesScreen({ transacoes, onAdicionar, onExcluir, onEditar }: TransacoesScreenProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [categoria, setCategoria] = useState<CategoriaTransacao>("dinheiro");
  const [descricao, setDescricao] = useState("");
  const [valorSistema, setValorSistema] = useState(0);
  const [valorEntregue, setValorEntregue] = useState(0);
  const [justificativa, setJustificativa] = useState("");
  const [semTroco, setSemTroco] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const ultimas = useMemo(() => transacoes.slice(0, 10), [transacoes]);
  const isSaida = categoria === "sangria" || categoria === "cancelamento";
  const trocoSobra = semTroco && !isSaida ? valorEntregue - valorSistema : 0;

  function startEdit(item: Transacao) {
    setEditingId(item.id);
    setCategoria(item.categoria);
    setDescricao(item.descricao);
    setValorSistema(item.valorSistema);
    setValorEntregue(item.valorRecebidoFisico);
    setJustificativa(item.justificativaTexto || "");
    setSemTroco(item.trocoSobra > 0);
  }

  function cancelEdit() {
    setEditingId(null);
    setCategoria("dinheiro");
    setDescricao("");
    setValorSistema(0);
    setValorEntregue(0);
    setJustificativa("");
  }

  async function onSalvar() {
    if (valorSistema <= 0) {
      setErro("Informe o valor.");
      return;
    }

    const payload = {
      naturezaOperacao: naturezaPorCategoria(categoria),
      categoria,
      descricao: descricao.trim(),
      valorSistema: Math.abs(valorSistema),
      valorRecebidoFisico: !isSaida ? Math.abs(valorEntregue) : 0,
      trocoSobra: !isSaida ? trocoSobra : 0,
      justificativaTexto: categoria === "cancelamento" ? justificativa.trim() : null,
    };

    try {
      if (editingId) {
        await onEditar(editingId, payload);
        setEditingId(null);
      } else {
        await onAdicionar(payload);
      }
      setDescricao("");
      setValorSistema(0);
      setValorEntregue(0);
      setJustificativa("");
      setErro(null);
    } catch (e) {
      setErro("Erro ao salvar.");
    }
  }

  return (
    <View className="gap-6">
      <View className="rounded-[40px] border border-zinc-800 bg-ink-900 p-6 shadow-2xl">
        <View className="flex-row items-center justify-between mb-6">
          <Text className="text-[11px] font-black uppercase tracking-[3px] text-zinc-500">
            {editingId ? "Editando Lançamento" : "Novo Lançamento"}
          </Text>
          {editingId && (
            <Pressable onPress={cancelEdit} className="h-8 w-8 items-center justify-center rounded-full bg-zinc-800">
              <X size={14} color="#f4f4f5" />
            </Pressable>
          )}
        </View>

        <View className="mb-8 flex-row flex-wrap gap-2">
          {categorias.map((item) => {
            const active = categoria === item.value;
            const Icon = item.icon;
            return (
              <Pressable
                key={item.value}
                onPress={() => {
                  setCategoria(item.value);
                  setErro(null);
                }}
                hitSlop={8}
                style={{
                  borderRadius: 20,
                  borderWidth: 1,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  backgroundColor: active ? '#f4f4f5' : '#18181b',
                  borderColor: active ? '#f4f4f5' : '#27272a',
                  elevation: active ? 4 : 0,
                }}
              >
                <Icon size={14} color={active ? "#09090b" : "#71717a"} strokeWidth={3} />
                <Text style={{
                  fontSize: 10,
                  fontWeight: '900',
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                  color: active ? '#09090b' : '#a1a1aa'
                }}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View className="gap-4">
          <View className="flex-row gap-4">
            <View className="flex-1">
              <Text className="mb-2 ml-2 text-[10px] font-black uppercase tracking-widest text-zinc-700">Sistema</Text>
              <MoneyInput
                placeholder="0,00"
                className="rounded-[24px] border border-zinc-700 bg-ink-800 px-6 py-5 text-2xl font-black text-zinc-100"
                value={valorSistema}
                onChangeValue={setValorSistema}
              />
            </View>
            {!isSaida && (
              <View className="flex-1">
                <Text className="mb-2 ml-2 text-[10px] font-black uppercase tracking-widest text-zinc-700">Recebido</Text>
                <MoneyInput
                  placeholder="0,00"
                  className="rounded-[24px] border border-zinc-700 bg-ink-800 px-6 py-5 text-2xl font-black text-zinc-100"
                  value={valorEntregue}
                  onChangeValue={setValorEntregue}
                />
              </View>
            )}
          </View>

          <TextInput
            className="rounded-[24px] border border-zinc-800 bg-ink-800 px-6 py-5 text-zinc-200 font-bold"
            placeholder="Descrição ou Cliente"
            placeholderTextColor="#3f3f46"
            value={descricao}
            onChangeText={setDescricao}
          />

          {categoria === "cancelamento" && (
            <TextInput
              className="rounded-[24px] border border-red-500/20 bg-red-500/5 px-6 py-5 text-red-200 font-bold"
              placeholder="Justificativa obrigatória"
              placeholderTextColor="#7f1d1d"
              value={justificativa}
              onChangeText={setJustificativa}
              multiline
            />
          )}

          {!isSaida && (
            <Pressable
              className={`flex-row items-center justify-between rounded-[24px] border p-5 ${
                semTroco 
                  ? trocoSobra >= 0 ? "border-emerald-500/20 bg-emerald-500/5" : "border-red-500/20 bg-red-500/5"
                  : "border-zinc-800 bg-ink-800"
              }`}
              onPress={() => setSemTroco(!semTroco)}
            >
              <View>
                <Text className={`text-[10px] uppercase font-black tracking-[2px] ${
                  semTroco 
                    ? trocoSobra >= 0 ? "text-emerald-400" : "text-red-400" 
                    : "text-zinc-600"
                }`}>
                  {semTroco 
                    ? trocoSobra >= 0 ? "Enviar Diferença para Sobra" : "Quebra de Caixa (Falta)" 
                    : "Troco Devolvido"}
                </Text>
                <Text className={`text-xs font-black mt-1 ${trocoSobra >= 0 ? "text-zinc-100" : "text-red-200"}`}>
                  {trocoSobra >= 0 ? "Sobra: " : "Falta: "}{toBrl(Math.abs(trocoSobra))}
                </Text>
              </View>
              <View className={`h-8 w-8 items-center justify-center rounded-full border-2 ${
                semTroco 
                  ? trocoSobra >= 0 ? "border-emerald-500 bg-emerald-500" : "border-red-500 bg-red-500" 
                  : "border-zinc-800"
              }`}>
                {semTroco && (
                  trocoSobra >= 0 
                    ? <Check size={16} color="#064e3b" strokeWidth={4} />
                    : <X size={16} color="#450a0a" strokeWidth={4} />
                )}
              </View>
            </Pressable>
          )}

          {erro && (
            <View className="rounded-2xl bg-red-500/10 py-3 px-4 border border-red-500/20">
              <Text className="text-center text-[10px] font-black text-red-400 uppercase tracking-widest">{erro}</Text>
            </View>
          )}

          <Pressable 
            className={`mt-2 rounded-[24px] py-6 active:opacity-80 shadow-2xl ${editingId ? "bg-zinc-100" : "bg-zinc-100"}`} 
            onPress={onSalvar}
          >
            <Text className="text-center font-black uppercase tracking-[4px] text-zinc-950">
              {editingId ? "Confirmar Edição" : "Lançar no Caixa"}
            </Text>
          </Pressable>
        </View>
      </View>

      <View className="gap-4 pb-20">
        <Text className="ml-2 text-[11px] font-black uppercase tracking-[3px] text-zinc-600">Histórico Recente</Text>
        {ultimas.map((item) => {
          const cat = categorias.find(c => c.value === item.categoria) || categorias[0];
          const Icon = cat.icon;
          return (
            <View key={item.id} className="rounded-[32px] bg-ink-900 p-6 border border-zinc-800 shadow-sm flex-row items-center justify-between">
              <View className="flex-1 flex-row items-center gap-4">
                <View className="h-12 w-12 items-center justify-center rounded-[18px] bg-ink-800 border border-zinc-800">
                  <Icon size={20} color={cat.color === "text-zinc-100" ? "#f4f4f5" : cat.color.includes("emerald") ? "#34d399" : cat.color.includes("blue") ? "#60a5fa" : "#f87171"} />
                </View>
                <View className="flex-1">
                  <Text className="text-[10px] font-black uppercase tracking-widest text-zinc-600">
                    {cat.label}
                  </Text>
                  <Text className="text-xl font-black text-zinc-100 tracking-tighter">{toBrl(item.valorSistema)}</Text>
                  {item.descricao ? <Text className="text-[10px] font-bold text-zinc-500 truncate" numberOfLines={1}>{item.descricao}</Text> : null}
                </View>
              </View>
              
              <View className="flex-row gap-2 ml-4">
                <Pressable 
                  onPress={() => startEdit(item)}
                  className="h-10 w-10 items-center justify-center rounded-[14px] bg-zinc-800/50 border border-zinc-700/50"
                >
                  <Edit3 size={16} color="#71717a" />
                </Pressable>
                <Pressable 
                  onPress={() => onExcluir(item.id)}
                  className="h-10 w-10 items-center justify-center rounded-[14px] bg-red-500/10 border border-red-500/20"
                >
                  <Trash2 size={16} color="#f87171" />
                </Pressable>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}
