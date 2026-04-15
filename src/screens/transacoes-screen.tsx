import { useMemo, useState } from "react";
import { Pressable, Text, TextInput, View, Alert, FlatList, ScrollView } from "react-native";
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
  Calculator,
  ChevronDown,
  Plus,
  Layers,
  Link
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
  
  // Campos simples
  const [valorSistema, setValorSistema] = useState(0);
  const [descricao, setDescricao] = useState("");
  const [codigoContrato, setCodigoContrato] = useState("");

  // Vínculo
  const [transacaoVinculadaId, setTransacaoVinculadaId] = useState("");
  const [mostrarTransacoes, setMostrarTransacoes] = useState(false);

  // Modo Avançado (Múltiplos pagamentos)
  const [isModoAvançado, setIsModoAvançado] = useState(false);
  const [pagamentos, setPagamentos] = useState([{ id: Math.random().toString(), valor: 0, descricao: '', contrato: '' }]);
  
  // Calculadora e Troco
  const [isCalculadora, setIsCalculadora] = useState(false);
  const [valorCliente, setValorCliente] = useState(0);
  const [valorTrocoEntregue, setValorTrocoEntregue] = useState(0);
  const [valorEntregueSimples, setValorEntregueSimples] = useState(0);
  
  const [justificativa, setJustificativa] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const isSaida = categoria === "sangria" || categoria === "cancelamento";
  
  const totalSistemaAtual = isModoAvançado ? pagamentos.reduce((acc, p) => acc + p.valor, 0) : valorSistema;
  
  // Restauração da matemática correta
  // Se for calculadora, Gaveta = Recebido - Troco. Se não, Gaveta = valorEntregueSimples.
  // Se valorEntregueSimples for 0, assumimos que o valor da gaveta foi exatamente o valor do sistema para não gerar falsa quebra.
  const valorNaGaveta = isCalculadora 
    ? (valorCliente - valorTrocoEntregue) 
    : (valorEntregueSimples > 0 ? valorEntregueSimples : totalSistemaAtual);

  const trocoSobra = !isSaida ? valorNaGaveta - totalSistemaAtual : 0;
  const trocoIdeal = Math.max(0, valorCliente - totalSistemaAtual);

  const listagem = useMemo(() => showAll ? transacoes : transacoes.slice(0, 10), [transacoes, showAll]);

  function startEdit(item: Transacao) {
    setEditingId(item.id);
    setCategoria(item.categoria);
    setValorSistema(item.valorSistema);
    setDescricao(item.descricao);
    setCodigoContrato(item.codigoContrato || "");
    setTransacaoVinculadaId(item.transacaoVinculadaId || "");
    setIsModoAvançado(false);
    
    if (item.valorRecebidoFisico !== item.valorSistema || item.trocoSobra !== 0) {
      setValorEntregueSimples(item.valorRecebidoFisico);
      setIsCalculadora(true);
      setValorCliente(item.valorRecebidoFisico); 
      setValorTrocoEntregue(0); 
    } else {
      setValorEntregueSimples(item.valorSistema);
      setIsCalculadora(false);
      setValorCliente(0);
      setValorTrocoEntregue(0);
    }
    
    setJustificativa(item.justificativaTexto || "");
    setMostrarTransacoes(false);
    setErro(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setCategoria("dinheiro");
    setValorSistema(0);
    setDescricao("");
    setCodigoContrato("");
    setTransacaoVinculadaId("");
    setPagamentos([{ id: Math.random().toString(), valor: 0, descricao: '', contrato: '' }]);
    setValorEntregueSimples(0);
    setValorCliente(0);
    setValorTrocoEntregue(0);
    setJustificativa("");
    setIsCalculadora(false);
    setMostrarTransacoes(false);
    setErro(null);
  }

  const addPagamento = () => {
    setPagamentos([...pagamentos, { id: Math.random().toString(), valor: 0, descricao: '', contrato: '' }]);
  };

  const removePagamento = (id: string) => {
    setPagamentos(pagamentos.filter(p => p.id !== id));
  };

  const updatePagamento = (id: string, field: keyof typeof pagamentos[0], value: any) => {
    setPagamentos(pagamentos.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  async function onSalvar() {
    if (isModoAvançado) {
      const validPagamentos = pagamentos.filter(p => p.valor > 0);
      if (validPagamentos.length === 0) {
        setErro("Informe pelo menos um valor válido.");
        return;
      }

      try {
        let sobraRestante = trocoSobra;

        for (let i = 0; i < validPagamentos.length; i++) {
          const p = validPagamentos[i];
          let sobraAplicada = 0;
          let gavetaAplicada = 0;

          if (i === 0) {
             sobraAplicada = sobraRestante;
             gavetaAplicada = !isSaida ? p.valor + sobraRestante : 0;
          } else {
             sobraAplicada = 0;
             gavetaAplicada = !isSaida ? p.valor : 0;
          }

          await onAdicionar({
            naturezaOperacao: naturezaPorCategoria(categoria),
            categoria,
            descricao: p.descricao.trim() || (validPagamentos.length > 1 ? `Pagamento Múltiplo ${i+1}` : ""),
            codigoContrato: p.contrato.trim() || undefined,
            valorSistema: Math.abs(p.valor),
            valorRecebidoFisico: gavetaAplicada,
            trocoSobra: sobraAplicada,
            justificativaTexto: null,
            transacaoVinculadaId: transacaoVinculadaId || undefined,
          });
        }
        
        cancelEdit();
      } catch (e) {
        setErro("Erro ao salvar múltiplo.");
      }
    } else {
      if (valorSistema <= 0) {
        setErro("Informe o valor do sistema.");
        return;
      }

      if (isSaida && categoria === "cancelamento" && !justificativa.trim()) {
        setErro("Informe o motivo do cancelamento.");
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
        transacaoVinculadaId: transacaoVinculadaId || undefined,
      };

      try {
        if (editingId) {
          await onEditar(editingId, payload);
        } else {
          await onAdicionar(payload);
        }
        cancelEdit();
      } catch (e) {
        setErro("Erro ao salvar transação.");
      }
    }
  }

  const renderItem = ({ item }: { item: Transacao }) => {
    const cat = categorias.find(c => c.value === item.categoria) || categorias[0];
    const Icon = cat.icon;
    const refTransacao = item.transacaoVinculadaId ? transacoes.find(t => t.id === item.transacaoVinculadaId) : null;
    
    return (
      <View className="rounded-[32px] bg-ink-900 p-6 border border-zinc-800 shadow-sm flex-row items-center justify-between mb-4">
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
            
            {refTransacao && (
              <View className="flex-row items-center gap-1 mt-1">
                <LinkIcon size={10} color="#60a5fa" />
                <Text className="text-[9px] font-black text-blue-400 uppercase tracking-widest truncate flex-1" numberOfLines={1}>Ref: {refTransacao.descricao || 'Lançamento'}</Text>
              </View>
            )}
            
            <View className="flex-row items-center gap-2 mt-1">
              {item.trocoSobra !== 0 && (
                <View className={`px-1.5 py-0.5 rounded-md border ${item.trocoSobra > 0 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
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
  };

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
            <View className="rounded-[40px] border border-zinc-800 bg-ink-900 p-6 shadow-2xl">
              <View className="flex-row items-center justify-between mb-6">
                <Text className="text-[11px] font-black uppercase tracking-[3px] text-zinc-500">
                  {editingId ? "Editando Lançamento" : "Novo Lançamento"}
                </Text>
                
                {!editingId && (
                  <View className="flex-row gap-2">
                    <Pressable 
                      onPress={() => {
                        setIsModoAvançado(!isModoAvançado);
                        setErro(null);
                      }}
                      className={`flex-row items-center gap-2 px-3 py-1.5 rounded-full border ${isModoAvançado ? 'bg-blue-500/10 border-blue-500/30' : 'bg-zinc-800 border-zinc-700'}`}
                    >
                      <Layers size={12} color={isModoAvançado ? '#60a5fa' : '#71717a'} />
                      <Text className={`text-[9px] font-black uppercase tracking-[1px] ${isModoAvançado ? 'text-blue-400' : 'text-zinc-500'}`}>
                        Modo Avançado
                      </Text>
                    </Pressable>

                    <Pressable 
                      onPress={() => setIsCalculadora(!isCalculadora)}
                      className={`flex-row items-center gap-2 px-3 py-1.5 rounded-full border ${isCalculadora ? 'bg-purple-500/10 border-purple-500/30' : 'bg-zinc-800 border-zinc-700'}`}
                    >
                      <Calculator size={12} color={isCalculadora ? '#a78bfa' : '#71717a'} />
                      <Text className={`text-[9px] font-black uppercase tracking-[1px] ${isCalculadora ? 'text-purple-400' : 'text-zinc-500'}`}>
                        Calculadora
                      </Text>
                    </Pressable>
                  </View>
                )}
                
                {editingId && (
                  <Pressable 
                    onPress={() => setIsCalculadora(!isCalculadora)}
                    className={`flex-row items-center gap-2 px-3 py-1.5 rounded-full border ${isCalculadora ? 'bg-purple-500/10 border-purple-500/30' : 'bg-zinc-800 border-zinc-700'}`}
                  >
                    <Calculator size={12} color={isCalculadora ? '#a78bfa' : '#71717a'} />
                    <Text className={`text-[9px] font-black uppercase tracking-[1px] ${isCalculadora ? 'text-purple-400' : 'text-zinc-500'}`}>
                      Calculadora
                    </Text>
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

              <View className="gap-6">
                
                {!isModoAvançado ? (
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

                    {/* SEÇÃO VINCULAR TRANSAÇÃO */}
                    <View className="mt-1">
                      <Pressable 
                        onPress={() => setMostrarTransacoes(!mostrarTransacoes)}
                        className={`flex-row items-center justify-between px-6 py-4 rounded-[24px] border ${transacaoVinculadaId ? 'bg-blue-500/10 border-blue-500/30' : 'bg-ink-800 border-zinc-800'}`}
                      >
                        <View className="flex-row items-center gap-3">
                          <Link size={16} color={transacaoVinculadaId ? "#60a5fa" : "#71717a"} />
                          <Text className={`font-black text-[10px] uppercase tracking-widest ${transacaoVinculadaId ? 'text-blue-400' : 'text-zinc-500'}`}>
                            {transacaoVinculadaId ? "Lançamento Vinculado" : "Vincular a um lançamento (Opcional)"}
                          </Text>
                        </View>
                        {transacaoVinculadaId ? (
                           <Pressable onPress={() => setTransacaoVinculadaId("")} hitSlop={10}><Text className="text-blue-400 font-bold text-[9px] uppercase">Remover</Text></Pressable>
                        ) : (
                           <Text className="text-zinc-600 font-bold text-[9px] uppercase">Selecionar</Text>
                        )}
                      </Pressable>
                      
                      {mostrarTransacoes && !transacaoVinculadaId && (
                        <View className="mt-2 bg-ink-950 rounded-[24px] border border-zinc-800 p-2 max-h-[200px] overflow-hidden">
                          <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                            {transacoes.length === 0 ? (
                              <Text className="text-zinc-600 text-center py-4 font-bold text-xs">Nenhum lançamento no caixa.</Text>
                            ) : transacoes.map(t => (
                              <Pressable 
                                key={t.id} 
                                onPress={() => { setTransacaoVinculadaId(t.id); setMostrarTransacoes(false); }}
                                className="px-4 py-3 border-b border-zinc-800/50 flex-row justify-between items-center active:bg-zinc-800 rounded-xl"
                              >
                                <Text className="text-zinc-300 font-bold text-xs" numberOfLines={1}>{t.descricao || 'Sem descrição'}</Text>
                                <Text className="text-zinc-500 font-black text-xs ml-2">{toBrl(t.valorSistema)}</Text>
                              </Pressable>
                            ))}
                          </ScrollView>
                        </View>
                      )}
                      {transacaoVinculadaId && (
                        <Text className="ml-4 mt-2 text-[9px] text-zinc-500 font-bold uppercase tracking-tighter">
                          → Ref: {transacoes.find(t => t.id === transacaoVinculadaId)?.descricao || 'Não encontrado'} ({toBrl(transacoes.find(t => t.id === transacaoVinculadaId)?.valorSistema || 0)})
                        </Text>
                      )}
                    </View>

                    <View className="flex-row gap-3">
                      <View className="flex-[2]">
                        <TextInput className="rounded-[24px] border border-zinc-800 bg-ink-800 px-6 py-5 text-zinc-200 font-bold" placeholder="Cliente / Descrição" placeholderTextColor="#3f3f46" value={descricao} onChangeText={setDescricao} />
                      </View>
                      <View className="flex-1">
                        <TextInput className="rounded-[24px] border border-zinc-800 bg-ink-800 px-4 py-5 text-zinc-400 font-black text-xs" placeholder="Contrato" placeholderTextColor="#3f3f46" value={codigoContrato} onChangeText={setCodigoContrato} />
                      </View>
                    </View>

                    {isSaida && categoria === "cancelamento" && (
                      <TextInput
                        className="rounded-[24px] border border-red-500/30 bg-red-500/5 px-6 py-5 text-red-100 font-bold mt-2"
                        placeholder="Motivo do Cancelamento"
                        placeholderTextColor="#991b1b"
                        value={justificativa}
                        onChangeText={setJustificativa}
                      />
                    )}
                  </View>
                ) : (
                  <View className="gap-3">
                    {/* SEÇÃO VINCULAR TRANSAÇÃO (Modo Multi) */}
                    <View className="mb-2">
                      <Pressable 
                        onPress={() => setMostrarTransacoes(!mostrarTransacoes)}
                        className={`flex-row items-center justify-between px-6 py-4 rounded-[24px] border ${transacaoVinculadaId ? 'bg-blue-500/10 border-blue-500/30' : 'bg-ink-800 border-zinc-800'}`}
                      >
                        <View className="flex-row items-center gap-3">
                          <Link size={16} color={transacaoVinculadaId ? "#60a5fa" : "#71717a"} />
                          <Text className={`font-black text-[10px] uppercase tracking-widest ${transacaoVinculadaId ? 'text-blue-400' : 'text-zinc-500'}`}>
                            {transacaoVinculadaId ? "Lançamento Vinculado" : "Vincular a um lançamento (Opcional)"}
                          </Text>
                        </View>
                        {transacaoVinculadaId ? (
                           <Pressable onPress={() => setTransacaoVinculadaId("")} hitSlop={10}><Text className="text-blue-400 font-bold text-[9px] uppercase">Remover</Text></Pressable>
                        ) : (
                           <Text className="text-zinc-600 font-bold text-[9px] uppercase">Selecionar</Text>
                        )}
                      </Pressable>
                      
                      {mostrarTransacoes && !transacaoVinculadaId && (
                        <View className="mt-2 bg-ink-950 rounded-[24px] border border-zinc-800 p-2 max-h-[200px] overflow-hidden">
                          <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                            {transacoes.length === 0 ? (
                              <Text className="text-zinc-600 text-center py-4 font-bold text-xs">Nenhum lançamento no caixa.</Text>
                            ) : transacoes.map(t => (
                              <Pressable 
                                key={t.id} 
                                onPress={() => { setTransacaoVinculadaId(t.id); setMostrarTransacoes(false); }}
                                className="px-4 py-3 border-b border-zinc-800/50 flex-row justify-between items-center active:bg-zinc-800 rounded-xl"
                              >
                                <Text className="text-zinc-300 font-bold text-xs" numberOfLines={1}>{t.descricao || 'Sem descrição'}</Text>
                                <Text className="text-zinc-500 font-black text-xs ml-2">{toBrl(t.valorSistema)}</Text>
                              </Pressable>
                            ))}
                          </ScrollView>
                        </View>
                      )}
                      {transacaoVinculadaId && (
                        <Text className="ml-4 mt-2 text-[9px] text-zinc-500 font-bold uppercase tracking-tighter">
                          → Ref: {transacoes.find(t => t.id === transacaoVinculadaId)?.descricao || 'Não encontrado'} ({toBrl(transacoes.find(t => t.id === transacaoVinculadaId)?.valorSistema || 0)})
                        </Text>
                      )}
                    </View>

                    {pagamentos.map((pag, index) => (
                      <View key={pag.id} className="p-6 rounded-[32px] border border-zinc-800/60 bg-ink-800/20 gap-4">
                        <View className="flex-row justify-between items-center ml-2 mb-1">
                          <Text className="text-[10px] font-black uppercase tracking-[2px] text-zinc-500">Valor do Sistema {pagamentos.length > 1 ? `#${index + 1}` : ''}</Text>
                          {pagamentos.length > 1 && (
                            <Pressable onPress={() => removePagamento(pag.id)} hitSlop={10} className="bg-red-500/10 p-1.5 rounded-lg border border-red-500/20"><Trash2 size={12} color="#f87171" /></Pressable>
                          )}
                        </View>
                        <MoneyInput
                          placeholder="0,00"
                          className="rounded-[20px] border border-zinc-700 bg-ink-800 px-5 py-4 text-2xl font-black text-zinc-100"
                          value={pag.valor}
                          onChangeValue={(v) => updatePagamento(pag.id, 'valor', v)}
                        />
                        <View className="flex-row gap-3">
                          <View className="flex-[2]">
                            <TextInput className="w-full flex-1 rounded-[20px] border border-zinc-800 bg-ink-800 px-5 py-4 text-zinc-200 font-bold" placeholder="Cliente / Descrição" placeholderTextColor="#3f3f46" value={pag.descricao} onChangeText={(t) => updatePagamento(pag.id, 'descricao', t)} />
                          </View>
                          <View className="flex-1">
                            <TextInput className="w-full flex-1 rounded-[20px] border border-zinc-800 bg-ink-800 px-4 py-4 text-zinc-400 font-black text-xs" placeholder="Contrato" placeholderTextColor="#3f3f46" value={pag.contrato} onChangeText={(t) => updatePagamento(pag.id, 'contrato', t)} />
                          </View>
                        </View>
                      </View>
                    ))}
                    
                    {!isSaida && (
                      <Pressable onPress={addPagamento} className="py-4 border-2 border-dashed border-blue-500/30 rounded-[24px] items-center justify-center bg-blue-500/5 flex-row gap-2 active:bg-blue-500/10">
                        <Plus size={14} color="#60a5fa" />
                        <Text className="text-[10px] font-black uppercase tracking-[2px] text-blue-400">Adicionar Pagamento</Text>
                      </Pressable>
                    )}
                  </View>
                )}

                {/* SEÇÃO DE CÁLCULO DE TROCO E GAVETA */}
                {!isSaida && (
                  <View className="bg-ink-800/30 p-5 rounded-[32px] border border-zinc-800/50 gap-4 mt-2">
                    <Text className="text-[10px] font-black uppercase tracking-[2px] text-zinc-500 mb-1 ml-2 text-center">Acerto de Contas {isModoAvançado && pagamentos.length > 1 ? `(Total: ${toBrl(totalSistemaAtual)})` : ''}</Text>
                    
                    {isCalculadora ? (
                      <View className="flex-row gap-3">
                        <View className="flex-1">
                          <Text className="mb-2 ml-2 text-[10px] font-black uppercase tracking-widest text-zinc-700">Dinheiro Recebido</Text>
                          <MoneyInput placeholder="0,00" className="rounded-[20px] border border-zinc-700 bg-ink-800 px-5 py-4 text-xl font-black text-zinc-100" value={valorCliente} onChangeValue={setValorCliente} />
                        </View>
                        <View className="flex-1">
                          <Text className="mb-2 ml-2 text-[10px] font-black uppercase tracking-widest text-zinc-700">Troco Dado</Text>
                          <MoneyInput placeholder="0,00" className="rounded-[20px] border border-zinc-700 bg-ink-800 px-5 py-4 text-xl font-black text-zinc-100" value={valorTrocoEntregue} onChangeValue={setValorTrocoEntregue} />
                        </View>
                      </View>
                    ) : (
                      <View>
                        <Text className="mb-2 ml-2 text-[10px] font-black uppercase tracking-widest text-zinc-700">Ficou na Gaveta</Text>
                        <MoneyInput placeholder="0,00" className="rounded-[20px] border border-zinc-700 bg-ink-800 px-5 py-4 text-2xl font-black text-zinc-100 text-center" value={valorEntregueSimples} onChangeValue={setValorEntregueSimples} />
                      </View>
                    )}

                    <View className={`rounded-[24px] border p-5 ${trocoSobra > 0 ? "border-emerald-500/20 bg-emerald-500/5" : trocoSobra < 0 ? "border-red-500/20 bg-red-500/5" : "border-blue-500/20 bg-blue-500/5"}`}>
                      <View className="flex-row items-center justify-between">
                        <View>
                          <Text className={`text-[10px] uppercase font-black tracking-[2px] ${trocoSobra > 0 ? "text-emerald-400" : trocoSobra < 0 ? "text-red-500" : "text-blue-400"}`}>
                            {trocoSobra > 0 ? "Sobra (Ficou no Caixa)" : trocoSobra < 0 ? "Falta (Saiu do Caixa)" : "Caixa Exato"}
                          </Text>
                          <Text className={`text-2xl font-black mt-1 ${trocoSobra > 0 ? "text-emerald-400" : trocoSobra < 0 ? "text-red-500" : "text-blue-400"}`}>
                            {trocoSobra === 0 ? "R$ 0,00" : (trocoSobra > 0 ? "+" : "-") + toBrl(Math.abs(trocoSobra))}
                          </Text>
                        </View>
                        <View className="items-end gap-1">
                          <Text className="text-[8px] font-black text-zinc-600 uppercase">Gaveta Física Final</Text>
                          <Text className="text-sm font-black text-zinc-300">{toBrl(valorNaGaveta)}</Text>
                          {isCalculadora && valorCliente > 0 && (
                            <View className="bg-ink-900 border border-zinc-800 px-2 py-1 rounded mt-1">
                              <Text className="text-[8px] font-black text-zinc-500 uppercase">Troco Ideal: <Text className="text-zinc-300">{toBrl(trocoIdeal)}</Text></Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </View>
                  </View>
                )}

                {erro && <View className="rounded-2xl bg-red-500/10 py-3 px-4 border border-red-500/20"><Text className="text-center text-[10px] font-black text-red-400 uppercase tracking-widest">{erro}</Text></View>}

                <View className="flex-row gap-2 mt-2">
                  {editingId && <Pressable className="flex-1 rounded-[24px] bg-zinc-800 py-6" onPress={cancelEdit}><Text className="text-center font-black uppercase tracking-widest text-zinc-400">Cancelar</Text></Pressable>}
                  <Pressable className="flex-[2] rounded-[24px] bg-zinc-100 py-6 shadow-2xl active:bg-zinc-300" onPress={onSalvar}><Text className="text-center font-black uppercase tracking-[4px] text-zinc-950">{editingId ? "Salvar Edição" : "Registrar Operação"}</Text></Pressable>
                </View>
              </View>
            </View>
          )}

          <Text className="ml-2 text-[11px] font-black uppercase tracking-[3px] text-zinc-600 mb-4">Histórico de Hoje</Text>
        </View>
      }
      ListEmptyComponent={
        <View className="rounded-[32px] border border-dashed border-zinc-800 py-20 items-center justify-center mt-4">
          <Text className="text-zinc-600 font-bold uppercase tracking-widest">Nenhum lançamento no turno</Text>
        </View>
      }
      ListFooterComponent={
        !showAll && transacoes.length > 10 ? (
          <Pressable onPress={() => setShowAll(true)} className="mx-auto w-full max-w-[460px] flex-row items-center justify-center gap-2 py-6 mt-4 rounded-[32px] border border-dashed border-zinc-800">
            <ChevronDown size={16} color="#3f3f46" /><Text className="text-[10px] font-black uppercase tracking-[3px] text-zinc-600">Ver todos os {transacoes.length} lançamentos</Text>
          </Pressable>
        ) : null
      }
    />
  );
}
