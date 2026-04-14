import { useMemo, useState } from "react";
import { Pressable, Text, TextInput, View, Alert } from "react-native";
import { 
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
  Check,
  Calculator,
  ChevronDown,
  Hash
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
    codigoContrato?: string;
    valorSistema: number;
    valorRecebidoFisico: number;
    trocoSobra: number;
    justificativaTexto?: string | null;
  }) => Promise<void>;
  onExcluir: (id: string) => Promise<void>;
  onEditar: (id: string, input: any) => Promise<void>;
  isFechado?: boolean;
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

function categoriaLabel(value: CategoriaTransacao) {
  return categorias.find((item) => item.value === value)?.label ?? value;
}

export function TransacoesScreen({ transacoes, onAdicionar, onExcluir, onEditar, isFechado }: TransacoesScreenProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [categoria, setCategoria] = useState<CategoriaTransacao>("dinheiro");
  const [descricao, setDescricao] = useState("");
  const [codigoContrato, setCodigoContrato] = useState("");
  const [valorSistema, setValorSistema] = useState(0);
  
  const [isCalculadora, setIsCalculadora] = useState(false);
  const [valorCliente, setValorCliente] = useState(0);
  const [valorTrocoEntregue, setValorTrocoEntregue] = useState(0);
  
  const [valorEntregueSimples, setValorEntregueSimples] = useState(0);
  const [justificativa, setJustificativa] = useState("");
  const [semTroco, setSemTroco] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const isSaida = categoria === "sangria" || categoria === "cancelamento";
  const valorNaGaveta = isCalculadora ? (valorCliente - valorTrocoEntregue) : valorEntregueSimples;
  const trocoSobra = semTroco && !isSaida ? valorNaGaveta - valorSistema : 0;

  const listagem = useMemo(() => showAll ? transacoes : transacoes.slice(0, 10), [transacoes, showAll]);

  const handleExcluir = (id: string) => {
    Alert.alert(
      "Excluir Registro",
      "Deseja realmente deletar este lançamento? Esta ação é irreversível.",
      [
        { text: "Sair", style: "cancel" },
        { text: "Confirmar", style: "destructive", onPress: () => onExcluir(id) }
      ]
    );
  };

  function startEdit(item: Transacao) {
    setEditingId(item.id);
    setCategoria(item.categoria);
    setDescricao(item.descricao);
    setCodigoContrato(item.codigoContrato || "");
    setValorSistema(item.valorSistema);
    setValorEntregueSimples(item.valorRecebidoFisico);
    setIsCalculadora(false);
    setJustificativa(item.justificativaTexto || "");
    setSemTroco(item.trocoSobra !== 0);
  }

  function cancelEdit() {
    setEditingId(null);
    setCategoria("dinheiro");
    setDescricao("");
    setCodigoContrato("");
    setValorSistema(0);
    setValorEntregueSimples(0);
    setValorCliente(0);
    setValorTrocoEntregue(0);
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
      codigoContrato: codigoContrato.trim() || undefined,
      valorSistema: Math.abs(valorSistema),
      valorRecebidoFisico: !isSaida ? Math.abs(valorNaGaveta) : 0,
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
      setCodigoContrato("");
      setValorSistema(0);
      setValorEntregueSimples(0);
      setValorCliente(0);
      setValorTrocoEntregue(0);
      setJustificativa("");
      setErro(null);
    } catch (e) {
      setErro("Erro ao salvar.");
    }
  }

  return (
    <View className="gap-6">
      {!isFechado && (
        <View className="rounded-[40px] border border-zinc-800 bg-ink-900 p-6 shadow-2xl">
          <View className="flex-row items-center justify-between mb-6">
            <Text className="text-[11px] font-black uppercase tracking-[3px] text-zinc-500">
              {editingId ? "Editando Lançamento" : "Novo Lançamento"}
            </Text>
            <Pressable 
              onPress={() => setIsCalculadora(!isCalculadora)}
              className={`flex-row items-center gap-2 px-3 py-1.5 rounded-full border ${isCalculadora ? 'bg-purple-500/10 border-purple-500/30' : 'bg-zinc-800 border-zinc-700'}`}
            >
              <Calculator size={12} color={isCalculadora ? '#a78bfa' : '#71717a'} />
              <Text className={`text-[9px] font-black uppercase ${isCalculadora ? 'text-purple-400' : 'text-zinc-500'}`}>
                {isCalculadora ? 'Modo Calculadora' : 'Modo Simples'}
              </Text>
            </Pressable>
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
                  }}
                >
                  <Icon size={14} color={active ? "#09090b" : "#71717a"} strokeWidth={3} />
                  <Text style={{ fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1, color: active ? '#09090b' : '#a1a1aa' }}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View className="gap-4">
            <View>
              <Text className="mb-2 ml-2 text-[10px] font-black uppercase tracking-widest text-zinc-700">Valor do Sistema</Text>
              <MoneyInput
                placeholder="0,00"
                className="rounded-[24px] border border-zinc-700 bg-ink-800 px-6 py-5 text-2xl font-black text-zinc-100"
                value={valorSistema}
                onChangeValue={setValorSistema}
              />
            </View>

            {!isSaida && (
              isCalculadora ? (
                <View className="flex-row gap-3">
                  <View className="flex-1">
                    <Text className="mb-2 ml-2 text-[10px] font-black uppercase tracking-widest text-zinc-700">Dinheiro Cliente</Text>
                    <MoneyInput placeholder="0,00" className="rounded-[24px] border border-zinc-700 bg-ink-800 px-6 py-5 text-xl font-black text-zinc-100" value={valorCliente} onChangeValue={setValorCliente} />
                  </View>
                  <View className="flex-1">
                    <Text className="mb-2 ml-2 text-[10px] font-black uppercase tracking-widest text-zinc-700">Troco Dado</Text>
                    <MoneyInput placeholder="0,00" className="rounded-[24px] border border-zinc-700 bg-ink-800 px-6 py-5 text-xl font-black text-zinc-100" value={valorTrocoEntregue} onChangeValue={setValorTrocoEntregue} />
                  </View>
                </View>
              ) : (
                <View>
                  <Text className="mb-2 ml-2 text-[10px] font-black uppercase tracking-widest text-zinc-700">Ficou na Gaveta</Text>
                  <MoneyInput placeholder="0,00" className="rounded-[24px] border border-zinc-700 bg-ink-800 px-6 py-5 text-2xl font-black text-zinc-100" value={valorEntregueSimples} onChangeValue={setValorEntregueSimples} />
                </View>
              )
            )}

            <View className="flex-row gap-3">
              <View className="flex-[2]">
                <TextInput className="rounded-[24px] border border-zinc-800 bg-ink-800 px-6 py-5 text-zinc-200 font-bold" placeholder="Cliente / Descrição" placeholderTextColor="#3f3f46" value={descricao} onChangeText={setDescricao} />
              </View>
              <View className="flex-1">
                <TextInput className="rounded-[24px] border border-zinc-800 bg-ink-800 px-4 py-5 text-zinc-400 font-black text-xs" placeholder="Contrato" placeholderTextColor="#3f3f46" value={codigoContrato} onChangeText={setCodigoContrato} />
              </View>
            </View>

            {!isSaida && (
              <View className={`rounded-[24px] border p-5 ${trocoSobra >= 0 ? "border-emerald-500/20 bg-emerald-500/5" : "border-red-500/20 bg-red-500/5"}`}>
                <View className="flex-row items-center justify-between">
                  <View>
                    <Text className={`text-[10px] uppercase font-black tracking-[2px] ${trocoSobra >= 0 ? "text-emerald-400" : "text-red-400"}`}>{trocoSobra >= 0 ? "Sobra" : "Quebra"}</Text>
                    <Text className={`text-xl font-black mt-1 ${trocoSobra >= 0 ? "text-zinc-100" : "text-red-200"}`}>{toBrl(Math.abs(trocoSobra))}</Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-[8px] font-black text-zinc-600 uppercase">Gaveta Física:</Text>
                    <Text className="text-xs font-black text-zinc-400">{toBrl(valorNaGaveta)}</Text>
                  </View>
                </View>
              </View>
            )}

            {erro && <View className="rounded-2xl bg-red-500/10 py-3 px-4 border border-red-500/20"><Text className="text-center text-[10px] font-black text-red-400 uppercase tracking-widest">{erro}</Text></View>}

            <View className="flex-row gap-2 mt-2">
              {editingId && <Pressable className="flex-1 rounded-[24px] bg-zinc-800 py-6" onPress={cancelEdit}><Text className="text-center font-black uppercase tracking-widest text-zinc-400">Sair</Text></Pressable>}
              <Pressable className="flex-[2] rounded-[24px] bg-zinc-100 py-6 shadow-2xl" onPress={onSalvar}><Text className="text-center font-black uppercase tracking-[4px] text-zinc-950">{editingId ? "Salvar" : "Lançar"}</Text></Pressable>
            </View>
          </View>
        </View>
      )}

      <View className="gap-4 pb-20">
        <Text className="ml-2 text-[11px] font-black uppercase tracking-[3px] text-zinc-600">Histórico de Hoje</Text>
        {listagem.map((item) => {
          const cat = categorias.find(c => c.value === item.categoria) || categorias[0];
          const Icon = cat.icon;
          return (
            <View key={item.id} className="rounded-[32px] bg-ink-900 p-6 border border-zinc-800 shadow-sm flex-row items-center justify-between">
              <View className="flex-1 flex-row items-center gap-4">
                <View className="h-12 w-12 items-center justify-center rounded-[18px] bg-ink-800 border border-zinc-800">
                  <Icon size={20} color={cat.color === "text-zinc-100" ? "#f4f4f5" : cat.color.includes("emerald") ? "#34d399" : cat.color.includes("blue") ? "#60a5fa" : "#f87171"} />
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center gap-2 mb-1">
                    <Text className="text-[10px] font-black uppercase tracking-widest text-zinc-600">{cat.label}</Text>
                    {item.codigoContrato && <View className="bg-zinc-800 px-1.5 py-0.5 rounded-md border border-zinc-700"><Text className="text-[8px] font-black text-zinc-400">{item.codigoContrato}</Text></View>}
                  </View>
                  <Text className="text-xl font-black text-zinc-100 tracking-tighter">{toBrl(item.valorSistema)}</Text>
                  <View className="flex-row items-center gap-2 mt-1">
                    {item.trocoSobra !== 0 && (
                      <View className={`px-1.5 py-0.5 rounded-md ${item.trocoSobra > 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                        <Text className={`text-[8px] font-black uppercase ${item.trocoSobra > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                          {item.trocoSobra > 0 ? `+ ${toBrl(item.trocoSobra)} Sobra` : `${toBrl(item.trocoSobra)} Quebra`}
                        </Text>
                      </View>
                    )}
                    {item.descricao ? <Text className="text-[10px] font-bold text-zinc-500 truncate uppercase tracking-tighter flex-1" numberOfLines={1}>{item.descricao}</Text> : null}
                  </View>
                </View>
              </View>

              {!isFechado && (
                <View className="flex-row gap-2 ml-4">
                  <Pressable onPress={() => startEdit(item)} hitSlop={8} className="h-10 w-10 items-center justify-center rounded-[14px] bg-zinc-800/50 border border-zinc-700/50"><Edit3 size={16} color="#71717a" /></Pressable>
                  <Pressable onPress={() => onExcluir(item.id)} hitSlop={8} className="h-10 w-10 items-center justify-center rounded-[14px] bg-red-500/10 border border-red-500/20"><Trash2 size={16} color="#f87171" /></Pressable>
                </View>
              )}
            </View>
          );
        })}
        {!showAll && transacoes.length > 10 && (
          <Pressable onPress={() => setShowAll(true)} className="flex-row items-center justify-center gap-2 py-6 rounded-[32px] border border-dashed border-zinc-800">
            <ChevronDown size={16} color="#3f3f46" /><Text className="text-[10px] font-black uppercase tracking-[3px] text-zinc-600">Ver todos os {transacoes.length} lançamentos</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
