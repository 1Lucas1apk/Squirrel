import { useState } from "react";
import { Pressable, Text, TextInput, View, ScrollView, FlatList } from "react-native";
import { MoneyInput } from "../components/common/money-input";
import { LembreteFantasma, TipoFantasma, Transacao } from "../types/domain";
import { toBrl } from "../utils/currency";
import { 
  Ghost, 
  Trash2, 
  CheckCircle2, 
  Circle, 
  DollarSign,
  ArrowUpRight,
  RefreshCcw,
  MessageSquare,
  HelpCircle,
  Banknote,
  Edit3,
  Link as LinkIcon,
  Wallet
} from "lucide-react-native";

interface FantasmasScreenProps {
  transacoes: Transacao[];
  fantasmas: LembreteFantasma[];
  onCriar: (input: {
    tipo: TipoFantasma;
    pessoa?: string;
    descricao: string;
    valorReferencia: number;
    impactaPixRepasse: boolean;
    destinoPix?: string;
    transacaoVinculadaId?: string;
  }) => Promise<void>;
  onEditar: (id: string, input: Partial<LembreteFantasma>) => Promise<void>;
  onToggleResolvido: (item: LembreteFantasma) => Promise<void>;
  onToggleComprovado: (item: LembreteFantasma) => Promise<void>;
  onExcluir: (id: string) => void;
  isFechado?: boolean;
}

const opcoes: { value: TipoFantasma; label: string; icon: any; sub: string; impact: string; color: string; showPixCheck: boolean }[] = [
  { value: "pix_recebido_gaveta_saiu", label: "Pix por Notas", icon: ArrowUpRight, sub: "Levou dinheiro e mandou Pix.", impact: "Aumenta Pix / Diminui Gaveta", color: "#a78bfa", showPixCheck: true },
  { value: "destroca_pix_por_nota", label: "Destrocar Pix", icon: RefreshCcw, sub: "Pôs notas p/ cobrir Pix.", impact: "Diminui Pix / Soma Gaveta", color: "#34d399", showPixCheck: false },
  { value: "dinheiro_emprestado", label: "Empréstimo", icon: Banknote, sub: "Notas p/ o caixa.", impact: "Soma Gaveta / S/ impacto Pix", color: "#fb923c", showPixCheck: false },
  { value: "lembrete_geral", label: "Lembrete", icon: MessageSquare, sub: "Anotação rápida.", impact: "Sem impacto financeiro", color: "#71717a", showPixCheck: false },
];

const DESTINOS_PIX = ["Meu Pix", "Conta da Loja", "Conta da Gerente"];

export function FantasmasScreen({ transacoes, fantasmas, onCriar, onEditar, onToggleResolvido, onToggleComprovado, onExcluir, isFechado }: FantasmasScreenProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tipo, setTipo] = useState<TipoFantasma>("pix_recebido_gaveta_saiu");
  const [pessoa, setPessoa] = useState("");
  const [descricao, setDescricao] = useState("");
  const [valorReferencia, setValorReferencia] = useState(0);
  const [destinoPix, setDestinoPix] = useState("Meu Pix");
  const [transacaoVinculadaId, setTransacaoVinculadaId] = useState("");
  const [mostrarTransacoes, setMostrarTransacoes] = useState(false);
  const [buscaVenda, setBuscaVenda] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const selectedOp = opcoes.find(o => o.value === tipo)!;

  function resetForm() {
    setEditingId(null);
    setTipo("pix_recebido_gaveta_saiu");
    setPessoa("");
    setDescricao("");
    setValorReferencia(0);
    setDestinoPix("Meu Pix");
    setTransacaoVinculadaId("");
    setMostrarTransacoes(false);
    setBuscaVenda("");
    setErro(null);
  }

  async function onSalvar() {
    if (!pessoa.trim() && tipo !== "lembrete_geral") { setErro("Informe o envolvido."); return; }
    if (valorReferencia <= 0 && tipo !== "lembrete_geral") { setErro("Informe o valor."); return; }
    try {
      const payload = {
        tipo,
        pessoa: pessoa.trim() || undefined,
        descricao: descricao.trim(),
        valorReferencia,
        impactaPixRepasse: tipo === "pix_recebido_gaveta_saiu" || tipo === "destroca_pix_por_nota",
        destinoPix: tipo === "lembrete_geral" || tipo === "dinheiro_emprestado" ? undefined : destinoPix,
        transacaoVinculadaId: transacaoVinculadaId || undefined,
      };
      if (editingId) { await onEditar(editingId, payload); }
      else { await onCriar(payload); }
      resetForm();
    } catch (e) { setErro("Erro ao salvar."); }
  }

  const renderItem = ({ item }: { item: LembreteFantasma }) => {
    const op = opcoes.find(o => o.value === item.tipo) || opcoes[3];
    const Icon = op.icon;
    const refT = item.transacaoVinculadaId ? transacoes.find(t => t.id === item.transacaoVinculadaId) : null;
    return (
      <View className={`rounded-[32px] border p-6 mb-4 ${item.resolvido ? "border-zinc-800 bg-zinc-900/50 opacity-40" : "border-zinc-800 bg-ink-900"}`}>
        <View className="flex-row items-start justify-between mb-6">
          <View className="flex-1 flex-row items-center gap-4">
            <View style={{ backgroundColor: item.resolvido ? '#27272a' : op.color }} className="h-12 w-12 items-center justify-center rounded-2xl">
              <Icon size={20} color={item.resolvido ? "#71717a" : "#000"} strokeWidth={3} />
            </View>
            <View className="flex-1">
              <Text className="text-[9px] font-black uppercase text-zinc-600">{item.pessoa || "Lembrete"}</Text>
              <Text className={`text-xl font-black tracking-tight ${item.resolvido ? "text-zinc-500 line-through" : "text-zinc-100"}`}>{toBrl(item.valorReferencia)}</Text>
              {item.destinoPix && (item.tipo === "pix_recebido_gaveta_saiu" || item.tipo === "destroca_pix_por_nota") && (
                <View className="flex-row items-center gap-1 mt-1">
                  <Wallet size={10} color="#a78bfa" /><Text className="text-[9px] font-black text-purple-400 uppercase">Dest: {item.destinoPix}</Text>
                </View>
              )}
              {refT && (
                <View className="flex-row items-center gap-1 mt-1">
                  <LinkIcon size={10} color="#60a5fa" /><Text className="text-[9px] font-black text-blue-400 uppercase" numberOfLines={1}>Ref: {refT.descricao || 'Venda'}</Text>
                </View>
              )}
            </View>
          </View>
          {!isFechado && (
            <View className="flex-row gap-2">
              <Pressable onPress={() => {
                setEditingId(item.id);
                setTipo(item.tipo);
                setPessoa(item.pessoa || "");
                setDescricao(item.descricao || "");
                setValorReferencia(item.valorReferencia);
                setDestinoPix(item.destinoPix || "Meu Pix");
                setTransacaoVinculadaId(item.transacaoVinculadaId || "");
              }} className="h-10 w-10 items-center justify-center rounded-xl bg-zinc-800/50 border border-zinc-700/50"><Edit3 size={16} color="#71717a" /></Pressable>
              <Pressable onPress={() => onExcluir(item.id)} className="h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 border border-red-500/20"><Trash2 size={16} color="#f87171" /></Pressable>
            </View>
          )}
        </View>
        {item.descricao ? <Text className="text-[10px] font-bold text-zinc-500 uppercase mb-4 leading-4 bg-ink-950 p-3 rounded-2xl border border-zinc-800/50">{item.descricao}</Text> : null}
        <View className="flex-row gap-3">
          <Pressable onPress={() => !isFechado && onToggleResolvido(item)} disabled={isFechado} className={`flex-1 flex-row items-center justify-center gap-2 rounded-[20px] border-2 py-4 ${item.resolvido ? 'bg-emerald-500 border-emerald-500' : 'border-zinc-800'}`}>
            {item.resolvido ? <CheckCircle2 size={18} color="#064e3b" strokeWidth={3} /> : <Circle size={18} color="#3f3f46" strokeWidth={3} />}
            <Text className={`text-[10px] font-black uppercase ${item.resolvido ? 'text-emerald-950' : 'text-zinc-500'}`}>{item.resolvido ? "Ok" : "Resolver"}</Text>
          </Pressable>
          {op.showPixCheck && (
            <Pressable onPress={() => !isFechado && onToggleComprovado(item)} disabled={isFechado} className={`flex-1 flex-row items-center justify-center gap-2 rounded-[20px] border-2 py-4 ${item.comprovadoPix ? 'bg-blue-500 border-blue-500' : 'border-zinc-800'}`}>
              <DollarSign size={18} color={item.comprovadoPix ? "#172554" : "#3f3f46"} strokeWidth={3} />
              <Text className={`text-[10px] font-black uppercase ${item.comprovadoPix ? 'text-blue-950' : 'text-zinc-500'}`}>{item.comprovadoPix ? "Pix OK" : "Aguardar"}</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  };

  return (
    <FlatList
      className="flex-1"
      data={fantasmas}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      showsVerticalScrollIndicator={false}
      overScrollMode="never"
      contentContainerStyle={{ paddingBottom: 140 }}
      ListHeaderComponent={
        <View className="gap-6 mb-6">
          {!isFechado && (
            <View className="rounded-[40px] border border-zinc-800 bg-ink-900 p-6 shadow-2xl">
              <Text className="mb-5 text-[10px] font-black uppercase tracking-[3px] text-zinc-500">{editingId ? "Editando" : "Nova Nota"}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} overScrollMode="never" className="mb-6 -mx-2 px-2">
                <View className="flex-row gap-2">
                  {opcoes.map((item) => {
                    const active = tipo === item.value;
                    const Icon = item.icon;
                    return (
                      <Pressable key={item.value} onPress={() => setTipo(item.value)} className={`rounded-[24px] border px-5 py-3 flex-row items-center gap-2 ${active ? 'bg-zinc-100 border-zinc-100' : 'bg-ink-800 border-zinc-800'}`}>
                        <Icon size={14} color={active ? "#09090b" : "#71717a"} strokeWidth={3} />
                        <Text className={`text-[10px] font-black uppercase ${active ? 'text-zinc-950' : 'text-zinc-500'}`}>{item.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
              <View className="bg-ink-800/50 border border-zinc-800 p-4 rounded-3xl mb-6 flex-row gap-3 items-start">
                <HelpCircle size={16} color={selectedOp.color} />
                <View className="flex-1">
                  <Text className="text-[10px] font-black uppercase text-zinc-100 mb-1">{selectedOp.label}</Text>
                  <Text className="text-xs text-zinc-500 leading-4">{selectedOp.sub}</Text>
                  <Text style={{ color: selectedOp.color }} className="text-[9px] font-black uppercase mt-2">{selectedOp.impact}</Text>
                </View>
              </View>
              <View className="gap-4">
                <TextInput className="rounded-[24px] border border-zinc-800 bg-ink-800 px-6 py-5 text-white font-bold" placeholder={tipo === "lembrete_geral" ? "Título" : "Com quem?"} placeholderTextColor="#3f3f46" value={pessoa} onChangeText={setPessoa} />
                {tipo !== "lembrete_geral" && (
                  <View>
                    <Text className="mb-2 ml-2 text-[10px] font-black uppercase text-zinc-700">Valor em Dinheiro</Text>
                    <MoneyInput placeholder="0,00" className="rounded-[24px] border border-zinc-700 bg-ink-800 px-6 py-5 text-3xl font-black text-white" value={valorReferencia} onChangeValue={setValorReferencia} />
                  </View>
                )}
                {(tipo === "pix_recebido_gaveta_saiu" || tipo === "destroca_pix_por_nota") && (
                  <View className="mt-2 bg-ink-950 p-4 rounded-[24px] border border-zinc-800">
                    <Text className="text-[10px] font-black uppercase text-zinc-500 mb-4 ml-1">Destino do Pix</Text>
                    <View className="flex-row flex-wrap gap-2">
                      {DESTINOS_PIX.map(dest => (
                        <Pressable key={dest} onPress={() => setDestinoPix(dest)} className={`px-4 py-3 rounded-2xl border ${destinoPix === dest ? 'bg-purple-500/20 border-purple-500/50' : 'bg-ink-800 border-zinc-800'}`}>
                          <Text className={`text-[10px] font-black uppercase ${destinoPix === dest ? 'text-purple-400' : 'text-zinc-500'}`}>{dest}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                )}
                {tipo !== "lembrete_geral" && (
                  <View className="mt-2">
                    <Pressable onPress={() => setMostrarTransacoes(!mostrarTransacoes)} className={`flex-row items-center justify-between px-6 py-5 rounded-[24px] border ${transacaoVinculadaId ? 'bg-blue-500/10 border-blue-500/30' : 'bg-ink-800 border-zinc-800'}`}>
                      <View className="flex-row items-center gap-3">
                        <LinkIcon size={16} color={transacaoVinculadaId ? "#60a5fa" : "#71717a"} />
                        <Text className={`font-black text-xs uppercase ${transacaoVinculadaId ? 'text-blue-400' : 'text-zinc-500'}`}>{transacaoVinculadaId ? "Vinculado" : "Vincular Venda"}</Text>
                      </View>
                      <Text className="text-blue-400 font-bold text-[10px] uppercase">{transacaoVinculadaId ? "Remover" : "Selecionar"}</Text>
                    </Pressable>
                    {mostrarTransacoes && !transacaoVinculadaId && (
                      <View className="mt-2 bg-ink-950 rounded-[24px] border border-zinc-800 p-2 max-h-[250px] overflow-hidden">
                        <TextInput placeholder="BUSCAR VALOR OU NOME..." placeholderTextColor="#3f3f46" value={buscaVenda} onChangeText={setBuscaVenda} className="bg-ink-900 border border-zinc-800 rounded-xl px-4 py-3 text-white font-bold text-[9px] mb-2 uppercase" />
                        <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} overScrollMode="never">
                          {transacoes.filter(t => t.valorSistema.toString().includes(buscaVenda) || t.descricao.toLowerCase().includes(buscaVenda.toLowerCase())).map(t => (
                            <Pressable key={t.id} onPress={() => { setTransacaoVinculadaId(t.id); setMostrarTransacoes(false); setBuscaVenda(""); }} className="px-4 py-3 border-b border-zinc-800/50 flex-row justify-between items-center"><Text className="text-zinc-300 font-bold text-xs" numberOfLines={1}>{t.descricao || 'Sem desc.'}</Text><Text className="text-zinc-500 font-black text-xs">{toBrl(t.valorSistema)}</Text></Pressable>
                          ))}
                        </ScrollView>
                      </View>
                    )}
                  </View>
                )}
                <TextInput className="rounded-[24px] border border-zinc-800 bg-ink-800 px-6 py-5 text-white font-bold" placeholder="Detalhes da Nota" placeholderTextColor="#3f3f46" multiline numberOfLines={3} value={descricao} onChangeText={setDescricao} />
                {erro && <Text className="text-center text-[10px] uppercase text-red-400 font-black bg-red-500/10 py-3 rounded-2xl border border-red-500/20">{erro}</Text>}
                <View className="flex-row gap-2">
                  {editingId && <Pressable className="flex-1 rounded-[24px] bg-zinc-800 py-6" onPress={resetForm}><Text className="text-center font-black uppercase text-zinc-400 text-xs">Sair</Text></Pressable>}
                  <Pressable className="flex-[2] rounded-[24px] bg-zinc-100 py-6" onPress={onSalvar}><Text className="text-center font-black uppercase text-zinc-950 text-xs">{editingId ? "Salvar" : "Registrar"}</Text></Pressable>
                </View>
              </View>
            </View>
          )}
          <Text className="ml-2 text-[11px] font-black uppercase tracking-[3px] text-zinc-600">Registros Ativos</Text>
        </View>
      }
      ListEmptyComponent={<View className="rounded-[32px] border border-dashed border-zinc-800 py-20 items-center justify-center mt-4"><Text className="text-zinc-600 font-bold uppercase tracking-widest text-xs">Nenhum registro</Text></View>}
    />
  );
}
