import { useMemo, useState } from "react";
import { Pressable, Text, TextInput, View, FlatList, ScrollView } from "react-native";
import { 
  Layers, 
  Link as LinkIcon, 
  Plus, 
  Calculator, 
  ChevronDown,
  Banknote,
  ArrowDownCircle,
  ShoppingCart,
  Split,
  ArrowUpCircle,
  XCircle,
  Trash2,
  Edit3
} from "lucide-react-native";
import * as Haptics from 'expo-haptics';
import { MoneyInput } from "../components/common/money-input";
import { CategoriaTransacao, NaturezaOperacao, TotaisTurno, Transacao } from "../types/domain";
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
    transacaoVinculadaId?: string;
  }) => Promise<void>;
  onExcluir: (id: string) => void;
  onEditar: (id: string, input: any) => Promise<void>;
  isFechado?: boolean;
}

const categorias: { value: CategoriaTransacao; label: string; icon: any; color: string }[] = [
  { value: "dinheiro", label: "Dinheiro", icon: Banknote, color: "text-emerald-400" },
  { value: "entrada_prestacao", label: "Entrada", icon: ArrowDownCircle, color: "text-blue-400" },
  { value: "compra_vista", label: "À Vista", icon: ShoppingCart, color: "text-zinc-100" },
  { value: "multiplo", label: "Misto", icon: Split, color: "text-orange-400" },
  { value: "sangria", label: "Sangria", icon: ArrowUpCircle, color: "text-red-400" },
  { value: "cancelamento", label: "Cancel", icon: XCircle, color: "text-red-500" },
];

function naturezaPorCategoria(categoria: CategoriaTransacao): NaturezaOperacao {
  return categoria === "entrada_prestacao" ? "entrada" : "pagamento";
}

export function TransacoesScreen({ transacoes, onAdicionar, onExcluir, onEditar, isFechado }: TransacoesScreenProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [categoria, setCategoria] = useState<CategoriaTransacao>("dinheiro");
  const [subTipoEntrada, setSubTipoEntrada] = useState<string | null>(null);
  const [valorSistema, setValorSistema] = useState(0);
  const [descricao, setDescricao] = useState("");
  const [codigoContrato, setCodigoContrato] = useState("");
  const [transacaoVinculadaId, setTransacaoVinculadaId] = useState("");
  const [mostrarTransacoes, setMostrarTransacoes] = useState(false);
  const [buscaVenda, setBuscaVenda] = useState("");
  const [isModoAvançado, setIsModoAvançado] = useState(false);
  const [pagamentos, setPagamentos] = useState([{ id: Math.random().toString(), valor: 0, descricao: '', contrato: '' }]);
  const [isCalculadora, setIsCalculadora] = useState(false);
  const [valorCliente, setValorCliente] = useState(0);
  const [valorTrocoEntregue, setValorTrocoEntregue] = useState(0);
  const [valorEntregueSimples, setValorEntregueSimples] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [preConfirmado, setPreConfirmado] = useState(false);

  const isSaida = categoria === "sangria" || categoria === "cancelamento";
  const totalSistemaAtual = isModoAvançado ? pagamentos.reduce((acc, p) => acc + p.valor, 0) : valorSistema;
  
  // LOGICA CORRIGIDA: Aceita 0,00 como valor recebido (padrão)
  const valorNaGaveta = isCalculadora ? (valorCliente - valorTrocoEntregue) : valorEntregueSimples;

  const trocoSobra = !isSaida ? valorNaGaveta - totalSistemaAtual : 0;
  const listagem = useMemo(() => showAll ? transacoes : transacoes.slice(0, 10), [transacoes, showAll]);

  const isPerfeito = trocoSobra === 0;

  function resetForm() {
    setEditingId(null);
    setCategoria("dinheiro");
    setSubTipoEntrada(null);
    setValorSistema(0);
    setDescricao("");
    setCodigoContrato("");
    setTransacaoVinculadaId("");
    setPagamentos([{ id: Math.random().toString(), valor: 0, descricao: '', contrato: '' }]);
    setValorEntregueSimples(0);
    setValorCliente(0);
    setValorTrocoEntregue(0);
    setIsCalculadora(false);
    setMostrarTransacoes(false);
    setBuscaVenda("");
    setErro(null);
    setPreConfirmado(false);
  }

  async function onSalvar() {
    if (totalSistemaAtual > 100000) { setErro("Limite de 100 mil."); return; }

    // Trava de Sobra/Falta Alta (> R$ 1,00)
    if (!preConfirmado && !isSaida && Math.abs(trocoSobra) >= 1) {
      setPreConfirmado(true);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setErro(`Atenção: Diferença de ${toBrl(trocoSobra)}. Clique de novo para confirmar.`);
      return;
    }

    if (isModoAvançado) {
      const valid = pagamentos.filter(p => p.valor > 0);
      if (valid.length === 0) { setErro("Informe um valor."); return; }
      try {
        let sobraRestante = trocoSobra;
        for (let i = 0; i < valid.length; i++) {
          const p = valid[i];
          const sobraAplicada = i === 0 ? sobraRestante : 0;
          const gavetaAplicada = !isSaida ? p.valor + sobraAplicada : 0;
          await onAdicionar({
            naturezaOperacao: naturezaPorCategoria(categoria),
            categoria,
            descricao: p.descricao.trim() || `Pgto ${i+1}`,
            codigoContrato: p.contrato.trim() || undefined,
            valorSistema: Math.abs(p.valor),
            valorRecebidoFisico: gavetaAplicada,
            trocoSobra: sobraAplicada,
            transacaoVinculadaId: transacaoVinculadaId || undefined,
          });
        }
        resetForm();
      } catch (e) { setErro("Erro ao salvar."); }
    } else {
      if (valorSistema <= 0) { setErro("Informe o valor."); return; }
      try {
        const payload = {
          naturezaOperacao: naturezaPorCategoria(categoria),
          categoria,
          descricao: descricao.trim(),
          codigoContrato: codigoContrato.trim() || undefined,
          valorSistema: Math.abs(valorSistema),
          valorRecebidoFisico: !isSaida ? Math.abs(valorNaGaveta) : 0,
          trocoSobra: !isSaida ? trocoSobra : 0,
          transacaoVinculadaId: transacaoVinculadaId || undefined,
        };
        if (editingId) await onEditar(editingId, payload);
        else await onAdicionar(payload);
        resetForm();
      } catch (e) { setErro("Erro ao salvar."); }
    }
  }

  const renderItem = ({ item }: { item: Transacao }) => {
    const cat = categorias.find(c => c.value === item.categoria) || categorias[0];
    const Icon = cat.icon;
    const refT = item.transacaoVinculadaId ? transacoes.find(t => t.id === item.transacaoVinculadaId) : null;
    
    // Cores vibrantes baseadas na categoria
    const accentColors: Record<CategoriaTransacao, string> = {
      dinheiro: "#34d399", // Emerald
      entrada_prestacao: "#60a5fa", // Blue
      compra_vista: "#f4f4f5", // Zinc/White
      multiplo: "#fb923c", // Orange
      sangria: "#f87171", // Red
      cancelamento: "#ef4444", // Strong Red
      gar: "#a78bfa" // Purple
    };

    const color = accentColors[item.categoria] || "#71717a";

    return (
      <View className="rounded-[32px] bg-ink-900 p-6 border border-zinc-800 mb-4 flex-row items-center justify-between">
        <View className="flex-1 flex-row items-center gap-4 min-w-0">
          <View style={{ borderColor: `${color}33` }} className="h-12 w-12 items-center justify-center rounded-2xl bg-ink-800 border flex-shrink-0">
            <Icon size={20} color={color} />
          </View>
          <View className="flex-1 min-w-0">
            <View className="flex-row items-center gap-2 mb-1">
              <Text style={{ color }} className="text-[10px] font-black uppercase tracking-widest flex-shrink-0">{cat.label}</Text>
              {item.codigoContrato && (
                <View className="bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700 flex-shrink">
                  <Text className="text-[8px] font-black text-zinc-400" numberOfLines={1} ellipsizeMode="tail">{item.codigoContrato}</Text>
                </View>
              )}
            </View>
            <Text 
              className="text-xl font-black text-zinc-100 tracking-tighter"
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.4}
              ellipsizeMode="clip"
            >
              {toBrl(item.valorSistema)}
            </Text>
            {refT && (
              <View className="flex-row items-center gap-1 mt-1">
                <LinkIcon size={10} color="#60a5fa" /><Text className="text-[9px] font-black text-blue-400 uppercase" numberOfLines={1}>Ref: {refT.descricao || 'Lançamento'}</Text>
              </View>
            )}
            <View className="flex-row items-center gap-2 mt-1">
              {item.trocoSobra !== 0 && (
                <View className={`px-1.5 py-0.5 rounded border flex-shrink-0 ${item.trocoSobra > 0 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                  <Text className={`text-[8px] font-black uppercase ${item.trocoSobra > 0 ? 'text-emerald-500' : 'text-red-500'}`}>{item.trocoSobra > 0 ? `+ ${toBrl(item.trocoSobra)}` : toBrl(item.trocoSobra)}</Text>
                </View>
              )}
              {item.descricao ? <Text className="text-[10px] font-bold text-zinc-500 uppercase flex-1" numberOfLines={1} ellipsizeMode="tail">{item.descricao}</Text> : null}
            </View>
          </View>
        </View>
        {!isFechado && (
          <View className="flex-row gap-2 ml-4 flex-shrink-0">
            <Pressable onPress={() => {
              setEditingId(item.id);
              setCategoria(item.categoria);
              setValorSistema(item.valorSistema);
              setDescricao(item.descricao);
              setCodigoContrato(item.codigoContrato || "");
              setTransacaoVinculadaId(item.transacaoVinculadaId || "");
              setValorEntregueSimples(item.valorRecebidoFisico);
            }} className="h-10 w-10 items-center justify-center rounded-xl bg-zinc-800/50 border border-zinc-700/50"><Edit3 size={16} color="#71717a" /></Pressable>
            <Pressable onPress={() => onExcluir(item.id)} className="h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 border border-red-500/20"><Trash2 size={16} color="#f87171" /></Pressable>
          </View>
        )}
      </View>
    );
  };

  const currentThemeColor = useMemo(() => {
    const map: Record<CategoriaTransacao, string> = {
      dinheiro: "#10b981", // Emerald 500
      entrada_prestacao: "#3b82f6", // Blue 500
      compra_vista: "#f4f4f5", // Zinc
      multiplo: "#f97316", // Orange 500
      sangria: "#ef4444", // Red 500
      cancelamento: "#ef4444",
      gar: "#a78bfa"
    };
    return map[categoria] || "#71717a";
  }, [categoria]);

  return (
    <FlatList
      className="flex-1"
      showsVerticalScrollIndicator={false}
      overScrollMode="never"
      keyboardShouldPersistTaps="handled"
      data={listagem}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      contentContainerStyle={{ paddingBottom: 140 }}
      ListHeaderComponent={
        <View className="gap-6 mb-8">
          {!isFechado && (
            <View style={{ borderColor: `${currentThemeColor}20` }} className="rounded-[40px] border bg-ink-900 p-6 shadow-2xl">
              <View className="flex-row items-center justify-between mb-6">
                <Text style={{ color: currentThemeColor }} className="text-[11px] font-black uppercase tracking-[2px]">{editingId ? "Editando Registro" : "Novo Lançamento"}</Text>
                <View className="flex-row gap-2">
                  <Pressable onPress={() => setIsModoAvançado(!isModoAvançado)} className={`flex-row items-center gap-2 px-3 py-1.5 rounded-full border ${isModoAvançado ? 'bg-blue-500/10 border-blue-500/30' : 'bg-zinc-800 border-zinc-700'}`}>
                    <Layers size={12} color={isModoAvançado ? '#60a5fa' : '#71717a'} /><Text className={`text-[9px] font-black uppercase ${isModoAvançado ? 'text-blue-400' : 'text-zinc-500'}`}>Multi</Text>
                  </Pressable>
                  <Pressable onPress={() => setIsCalculadora(!isCalculadora)} className={`flex-row items-center gap-2 px-3 py-1.5 rounded-full border ${isCalculadora ? 'bg-purple-500/10 border-purple-500/30' : 'bg-zinc-800 border-zinc-700'}`}>
                    <Calculator size={12} color={isCalculadora ? '#a78bfa' : '#71717a'} /><Text className={`text-[9px] font-black uppercase ${isCalculadora ? 'text-purple-400' : 'text-zinc-500'}`}>Calc</Text>
                  </Pressable>
                </View>
              </View>
              <View className="mb-8 flex-row flex-wrap gap-2">
                {categorias.map((item) => {
                  const active = categoria === item.value;
                  const Icon = item.icon;
                  return (
                    <Pressable key={item.value} onPress={() => {
                      setCategoria(item.value);
                      setPreConfirmado(false);
                      if (item.value !== "entrada_prestacao") setSubTipoEntrada(null);
                    }} className={`rounded-2xl border px-4 py-3 flex-row items-center gap-2 ${active ? 'bg-zinc-100 border-zinc-100' : 'bg-ink-800 border-zinc-800'}`}>
                      <Icon size={14} color={active ? "#09090b" : "#71717a"} strokeWidth={3} /><Text className={`text-[10px] font-black uppercase ${active ? 'text-zinc-950' : 'text-zinc-500'}`}>{item.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {categoria === "entrada_prestacao" && (
                <View className="mb-8 -mt-4 bg-ink-800/40 p-4 rounded-3xl border border-zinc-800/50">
                  <Text className="text-[9px] font-black uppercase text-zinc-600 mb-3 ml-1">Tipo de Entrada</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {[
                      { label: "Renegociação", value: "Renegociação" },
                      { label: "Quitação", value: "Quitação" },
                      { label: "Entrada (Compra)", value: "Entrada (Compra)" },
                    ].map((sub) => {
                      const active = subTipoEntrada === sub.value;
                      return (
                        <Pressable 
                          key={sub.value} 
                          onPress={() => {
                            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setSubTipoEntrada(sub.value);
                            setDescricao(sub.label);
                            setPreConfirmado(false);
                          }} 
                          className={`rounded-xl border px-4 py-2 ${active ? 'bg-blue-500 border-blue-500' : 'bg-ink-900 border-zinc-800'}`}
                        >
                          <Text className={`text-[10px] font-black uppercase ${active ? 'text-white' : 'text-zinc-500'}`}>{sub.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}
              <View className="gap-6">
                {!isModoAvançado ? (
                  <View className="gap-4">
                    <View>
                      <Text style={{ color: `${currentThemeColor}60` }} className="mb-2 ml-2 text-[10px] font-black uppercase">Valor do Sistema</Text>
                      <MoneyInput 
                        placeholder="0,00" 
                        style={{ borderColor: `${currentThemeColor}40` }}
                        className="rounded-[24px] border bg-ink-800 px-6 py-5 text-2xl font-black text-zinc-100" 
                        value={valorSistema} 
                        onChangeValue={(v) => { setValorSistema(v); setPreConfirmado(false); }} 
                      />
                    </View>
                    <View className="mt-1">
                      <Pressable onPress={() => setMostrarTransacoes(!mostrarTransacoes)} className={`flex-row items-center justify-between px-6 py-4 rounded-[24px] border ${transacaoVinculadaId ? 'bg-blue-500/10 border-blue-500/30' : 'bg-ink-800 border-zinc-800'}`}>
                        <View className="flex-row items-center gap-3">
                          <LinkIcon size={16} color={transacaoVinculadaId ? "#60a5fa" : "#71717a"} />
                          <Text className={`font-black text-[10px] uppercase ${transacaoVinculadaId ? 'text-blue-400' : 'text-zinc-500'}`}>{transacaoVinculadaId ? "Vinculado" : "Vincular"}</Text>
                        </View>
                        <Text className="text-blue-400 font-bold text-[9px] uppercase">{transacaoVinculadaId ? "Remover" : "Selecionar"}</Text>
                      </Pressable>
                      {mostrarTransacoes && !transacaoVinculadaId && (
                        <View className="mt-2 bg-ink-950 rounded-[24px] border border-zinc-800 p-2 max-h-[250px] overflow-hidden">
                          <TextInput placeholder="BUSCAR..." placeholderTextColor="#3f3f46" value={buscaVenda} onChangeText={setBuscaVenda} className="bg-ink-900 border border-zinc-800 rounded-xl px-4 py-3 text-white font-bold text-[9px] mb-2 uppercase" />
                          <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} overScrollMode="never">
                            {transacoes.filter(t => t.valorSistema.toString().includes(buscaVenda) || t.descricao.toLowerCase().includes(buscaVenda.toLowerCase())).map(t => (
                              <Pressable key={t.id} onPress={() => { setTransacaoVinculadaId(t.id); setMostrarTransacoes(false); setBuscaVenda(""); }} className="px-4 py-3 border-b border-zinc-800/50 flex-row justify-between items-center"><Text className="text-zinc-300 font-bold text-xs" numberOfLines={1}>{t.descricao || 'Sem desc.'}</Text><Text className="text-zinc-500 font-black text-xs">{toBrl(t.valorSistema)}</Text></Pressable>
                            ))}
                          </ScrollView>
                        </View>
                      )}
                    </View>
                    <View className="flex-row gap-3 w-full">
                      <View className="flex-[1.5] min-w-0">
                        <TextInput 
                          style={{ borderColor: `${currentThemeColor}20` }}
                          className="rounded-[24px] border bg-ink-800 px-6 py-5 text-zinc-200 font-bold" 
                          placeholder="Descrição" 
                          placeholderTextColor="#3f3f46" 
                          value={descricao} 
                          onChangeText={(t) => { setDescricao(t); setPreConfirmado(false); }} 
                        />
                      </View>
                      <View className="flex-1 min-w-0">
                        <TextInput 
                          style={{ borderColor: `${currentThemeColor}20` }}
                          className="rounded-[24px] border bg-ink-800 px-4 py-5 text-zinc-400 font-black text-xs text-center" 
                          placeholder="Contrato" 
                          placeholderTextColor="#3f3f46" 
                          value={codigoContrato} 
                          onChangeText={(t) => { setCodigoContrato(t); setPreConfirmado(false); }} 
                        />
                      </View>
                    </View>
                  </View>
                ) : (
                  <View className="gap-3">
                    {pagamentos.map((pag, idx) => (
                      <View key={pag.id} className="p-5 rounded-[32px] border border-zinc-800/60 bg-ink-800/20 gap-4">
                        <View className="flex-row justify-between items-center"><Text className="text-[9px] font-black uppercase text-zinc-500">Valor #{idx+1}</Text>{pagamentos.length > 1 && <Pressable onPress={() => setPagamentos(pagamentos.filter(p => p.id !== pag.id))}><Trash2 size={12} color="#f87171" /></Pressable>}</View>
                        <MoneyInput placeholder="0,00" className="rounded-2xl border border-zinc-700 bg-ink-800 px-5 py-4 text-xl font-black text-zinc-100" value={pag.valor} onChangeValue={(v) => { setPagamentos(pagamentos.map(p => p.id === pag.id ? {...p, valor: v} : p)); setPreConfirmado(false); }} />
                        <View className="flex-row gap-2">
                          <TextInput className="flex-[2] rounded-xl border border-zinc-800 bg-ink-800 px-4 py-3 text-zinc-200 font-bold text-xs" placeholder="Desc." placeholderTextColor="#3f3f46" value={pag.descricao} onChangeText={(t) => { setPagamentos(pagamentos.map(p => p.id === pag.id ? {...p, descricao: t} : p)); setPreConfirmado(false); }} />
                          <TextInput className="flex-1 rounded-xl border border-zinc-800 bg-ink-800 px-3 py-3 text-zinc-400 font-black text-[10px] text-center" placeholder="Contr." placeholderTextColor="#3f3f46" value={pag.contrato} onChangeText={(t) => { setPagamentos(pagamentos.map(p => p.id === pag.id ? {...p, contrato: t} : p)); setPreConfirmado(false); }} />
                        </View>
                      </View>
                    ))}
                    {!isSaida && <Pressable onPress={() => setPagamentos([...pagamentos, { id: Math.random().toString(), valor: 0, descricao: '', contrato: '' }])} className="py-4 border-2 border-dashed border-blue-500/30 rounded-[24px] items-center justify-center bg-blue-500/5 flex-row gap-2"><Plus size={14} color="#60a5fa" /><Text className="text-[10px] font-black uppercase text-blue-400">Adicionar</Text></Pressable>}
                  </View>
                )}
                {!isSaida && (
                  <View className="bg-ink-800/30 p-5 rounded-[32px] border border-zinc-800/50 gap-4">
                    <Text className="text-[9px] font-black uppercase text-zinc-500 text-center">Acerto de Contas</Text>
                    {isCalculadora ? (
                      <View className="flex-row gap-3">
                        <View className="flex-1"><Text className="mb-2 ml-2 text-[9px] font-black uppercase text-zinc-700">Recebido</Text><MoneyInput placeholder="0,00" className="rounded-2xl border border-zinc-700 bg-ink-800 px-4 py-4 text-lg font-black text-zinc-100" value={valorCliente} onChangeValue={(v) => { setValorCliente(v); setPreConfirmado(false); }} /></View>
                        <View className="flex-1"><Text className="mb-2 ml-2 text-[9px] font-black uppercase text-zinc-700">Troco Dado</Text><MoneyInput placeholder="0,00" className="rounded-2xl border border-zinc-700 bg-ink-800 px-4 py-4 text-lg font-black text-zinc-100" value={valorTrocoEntregue} onChangeValue={(v) => { setValorTrocoEntregue(v); setPreConfirmado(false); }} /></View>
                      </View>
                    ) : (
                      <View><Text className="mb-2 ml-2 text-[9px] font-black uppercase text-zinc-700">Ficou na Gaveta</Text><MoneyInput placeholder="0,00" className="rounded-2xl border border-zinc-700 bg-ink-800 px-5 py-4 text-xl font-black text-zinc-100 text-center" value={valorEntregueSimples} onChangeValue={(v) => { setValorEntregueSimples(v); setPreConfirmado(false); }} /></View>
                    )}
                    <View 
                      style={{ 
                        borderColor: trocoSobra > 0 ? '#10b98140' : trocoSobra < 0 ? '#ef444440' : '#3b82f640',
                        backgroundColor: trocoSobra > 0 ? '#10b98105' : trocoSobra < 0 ? '#ef444405' : '#3b82f605'
                      }} 
                      className="rounded-3xl border p-5"
                    >
                      <View className="flex-row items-center justify-between">
                        <View>
                          <Text 
                            style={{ color: trocoSobra > 0 ? '#34d399' : trocoSobra < 0 ? '#f87171' : '#60a5fa' }} 
                            className="text-[9px] uppercase font-black"
                          >
                            {trocoSobra > 0 ? "Sobra" : (trocoSobra < 0 ? "Falta" : "Exato")}
                          </Text>
                          <Text 
                            style={{ color: trocoSobra > 0 ? '#34d399' : trocoSobra < 0 ? '#f87171' : '#60a5fa' }} 
                            className="text-xl font-black"
                          >
                            {toBrl(trocoSobra)}
                          </Text>
                        </View>
                        <View className="items-end">
                          <Text className="text-[8px] font-black text-zinc-600 uppercase">Gaveta Final</Text>
                          <Text className="text-sm font-black text-zinc-300">{toBrl(valorNaGaveta)}</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                )}
                {erro && <View className="rounded-2xl bg-red-500/10 py-3 px-4 border border-red-500/20"><Text className="text-center text-[10px] font-black text-red-400 uppercase">{erro}</Text></View>}
                <View className="flex-row gap-2">
                  {editingId && <Pressable className="flex-1 rounded-[24px] bg-zinc-800 py-6" onPress={resetForm}><Text className="text-center font-black uppercase text-zinc-400 text-xs">Sair</Text></Pressable>}
                  <Pressable 
                    style={{ backgroundColor: currentThemeColor }}
                    className="flex-[2] rounded-[24px] py-6 shadow-2xl" 
                    onPress={() => {
                      if (preConfirmado) {
                        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      }
                      onSalvar();
                    }}
                  >
                    <Text className={`text-center font-black uppercase text-xs ${categoria === "compra_vista" ? "text-zinc-950" : "text-zinc-100"}`}>
                      {preConfirmado ? "Confirmar Diferença?" : (editingId ? "Salvar Alterações" : "Registrar Lançamento")}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )}
          <Text className="ml-2 text-[11px] font-black uppercase tracking-[3px] text-zinc-600 mb-4">Histórico de Hoje</Text>
        </View>
      }
      ListEmptyComponent={<View className="rounded-[32px] border border-dashed border-zinc-800 py-20 items-center justify-center mt-4"><Text className="text-zinc-600 font-bold uppercase tracking-widest text-xs">Nenhum lançamento</Text></View>}
      ListFooterComponent={!showAll && transacoes.length > 10 ? <Pressable onPress={() => setShowAll(true)} className="mx-auto w-full max-w-[460px] flex-row items-center justify-center gap-2 py-6 mt-4 rounded-[32px] border border-dashed border-zinc-800"><ChevronDown size={16} color="#3f3f46" /><Text className="text-[10px] font-black uppercase text-zinc-600">Ver todos</Text></Pressable> : null}
    />
  );
}
