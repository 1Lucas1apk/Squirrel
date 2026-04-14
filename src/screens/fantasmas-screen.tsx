import { useState } from "react";
import { Pressable, Text, TextInput, View, ScrollView } from "react-native";
import { MoneyInput } from "../components/common/money-input";
import { LembreteFantasma, TipoFantasma } from "../types/domain";
import { toBrl } from "../utils/currency";

import { 
  Ghost, 
  Trash2, 
  CheckCircle2, 
  Circle, 
  DollarSign,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCcw,
  MessageSquare,
  HelpCircle,
  Banknote
} from "lucide-react-native";

interface FantasmasScreenProps {
  fantasmas: LembreteFantasma[];
  onCriar: (input: {
    tipo: TipoFantasma;
    pessoa?: string;
    descricao: string;
    valorReferencia: number;
    impactaPixRepasse: boolean;
  }) => Promise<void>;
  onToggleResolvido: (item: LembreteFantasma) => Promise<void>;
  onToggleComprovado: (item: LembreteFantasma) => Promise<void>;
  onExcluir: (id: string) => void;
  isFechado?: boolean;
}

const opcoes: { value: TipoFantasma; label: string; icon: any; sub: string; impact: string; color: string; showPixCheck: boolean }[] = [
  { 
    value: "pix_recebido_gaveta_saiu", 
    label: "Pix por Notas", 
    icon: ArrowUpRight, 
    sub: "Alguém levou dinheiro físico e mandou Pix p/ você.",
    impact: "Aumenta o Pix Repasse / Diminui Gaveta",
    color: "#a78bfa",
    showPixCheck: true
  },
  { 
    value: "destroca_pix_por_nota", 
    label: "Destrocar Pix", 
    icon: RefreshCcw, 
    sub: "Você pôs notas na gaveta p/ cobrir seu Pix Repasse.",
    impact: "Diminui o Pix Repasse / Soma na Gaveta",
    color: "#34d399",
    showPixCheck: false
  },
  { 
    value: "dinheiro_emprestado", 
    label: "Empréstimo", 
    icon: Banknote, 
    sub: "Notas que você pegou com alguém p/ o caixa (ex: troco).",
    impact: "Soma na Gaveta / Não mexe no Pix",
    color: "#fb923c",
    showPixCheck: false
  },
  { 
    value: "lembrete_geral", 
    label: "Lembrete", 
    icon: MessageSquare, 
    sub: "Anotação rápida de texto sem mexer em dinheiro.",
    impact: "Sem impacto financeiro",
    color: "#71717a",
    showPixCheck: false
  },
];

export function FantasmasScreen({
  fantasmas,
  onCriar,
  onToggleResolvido,
  onToggleComprovado,
  onExcluir,
  isFechado,
}: FantasmasScreenProps) {
  const [tipo, setTipo] = useState<TipoFantasma>("pix_recebido_gaveta_saiu");
  const [pessoa, setPessoa] = useState("");
  const [descricao, setDescricao] = useState("");
  const [valorReferencia, setValorReferencia] = useState(0);
  const [erro, setErro] = useState<string | null>(null);

  const selectedOp = opcoes.find(o => o.value === tipo)!;

  async function onSalvar() {
    if (!pessoa.trim() && tipo !== "lembrete_geral") {
      setErro("Informe quem está envolvido.");
      return;
    }

    try {
      await onCriar({
        tipo,
        pessoa: pessoa.trim() || undefined,
        descricao: descricao.trim(),
        valorReferencia,
        impactaPixRepasse: tipo === "pix_recebido_gaveta_saiu" || tipo === "destroca_pix_por_nota",
      });

      setDescricao("");
      setPessoa("");
      setValorReferencia(0);
      setErro(null);
    } catch (e) {
      setErro("Erro ao salvar.");
    }
  }

  return (
    <View className="gap-6 pb-20">
      {!isFechado && (
        <View className="rounded-[40px] border border-zinc-800 bg-ink-900 p-6 shadow-2xl">
          <Text className="mb-5 text-[10px] font-black uppercase tracking-[3px] text-zinc-500">Movimentação Informal</Text>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-6 -mx-2 px-2">
            <View className="flex-row gap-2">
              {opcoes.map((item) => {
                const active = tipo === item.value;
                const Icon = item.icon;
                return (
                  <Pressable
                    key={item.value}
                    onPress={() => setTipo(item.value)}
                    style={{
                      borderRadius: 24,
                      borderWidth: 2,
                      paddingHorizontal: 20,
                      paddingVertical: 14,
                      backgroundColor: active ? item.color : '#18181b',
                      borderColor: active ? item.color : '#27272a',
                    }}
                  >
                    <View className="flex-row items-center gap-2">
                      <Icon size={14} color={active ? "#000" : "#71717a"} strokeWidth={3} />
                      <Text style={{ fontSize: 10, fontWeight: '900', textTransform: 'uppercase', color: active ? '#000' : '#71717a' }}>{item.label}</Text>
                    </View>
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
            <TextInput
              className="rounded-[24px] border border-zinc-800 bg-ink-800 px-6 py-5 text-white font-bold"
              placeholder={tipo === "lembrete_geral" ? "Título do Lembrete" : "Com quem? (Ex: Ricardo, Gerente...)"}
              placeholderTextColor="#3f3f46"
              value={pessoa}
              onChangeText={setPessoa}
            />

            <TextInput
              className="rounded-[24px] border border-zinc-800 bg-ink-800 px-6 py-5 text-white font-bold"
              placeholder="Mais detalhes (opcional)"
              placeholderTextColor="#3f3f46"
              value={descricao}
              onChangeText={setDescricao}
            />

            {tipo !== "lembrete_geral" && (
              <View>
                <Text className="mb-2 ml-2 text-[10px] font-black uppercase tracking-widest text-zinc-700">Valor em Dinheiro</Text>
                <MoneyInput
                  placeholder="0,00"
                  className="rounded-[24px] border border-zinc-700 bg-ink-800 px-6 py-5 text-3xl font-black text-white"
                  value={valorReferencia}
                  onChangeValue={setValorReferencia}
                />
              </View>
            )}

            {erro && <Text className="text-center text-xs text-red-400 font-bold bg-red-500/10 py-2 rounded-xl">{erro}</Text>}

            <Pressable className="mt-2 rounded-[24px] bg-zinc-100 py-6 active:opacity-80" onPress={onSalvar}>
              <Text className="text-center font-black uppercase tracking-[4px] text-zinc-950">Lançar Registro</Text>
            </Pressable>
          </View>
        </View>
      )}

      <View className="gap-4">
        <Text className="ml-2 text-[11px] font-black uppercase tracking-[3px] text-zinc-600">Registros Ativos</Text>
        {fantasmas.map((item) => {
          const op = opcoes.find(o => o.value === item.tipo) || opcoes[3];
          const Icon = op.icon;
          return (
            <View key={item.id} className={`rounded-[32px] border p-6 ${item.resolvido ? "border-zinc-800 bg-zinc-900/50 opacity-40" : "border-zinc-800 bg-ink-900"}`}>
              <View className="flex-row items-start justify-between mb-6">
                <View className="flex-1 flex-row items-center gap-4">
                  <View style={{ backgroundColor: item.resolvido ? '#27272a' : op.color }} className="h-12 w-12 items-center justify-center rounded-2xl">
                    <Icon size={20} color={item.resolvido ? "#71717a" : "#000"} strokeWidth={3} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[9px] font-black uppercase tracking-widest text-zinc-600">{item.pessoa || "Lembrete"}</Text>
                    <Text className={`text-xl font-black tracking-tight ${item.resolvido ? "text-zinc-500 line-through" : "text-zinc-100"}`}>{toBrl(item.valorReferencia)}</Text>
                    {item.descricao ? <Text className="text-[10px] font-bold text-zinc-500 uppercase">{item.descricao}</Text> : null}
                  </View>
                </View>
                {!isFechado && (
                  <Pressable onPress={() => onExcluir(item.id)} className="h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 border border-red-500/20"><Trash2 size={16} color="#f87171" /></Pressable>
                )}
              </View>

              <View className="flex-row gap-3">
                <Pressable
                  onPress={() => !isFechado && onToggleResolvido(item)}
                  disabled={isFechado}
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    borderRadius: 20,
                    borderWidth: 2,
                    paddingVertical: 16,
                    backgroundColor: item.resolvido ? '#10b981' : 'transparent',
                    borderColor: item.resolvido ? '#10b981' : '#27272a',
                  }}
                >
                  {item.resolvido ? <CheckCircle2 size={18} color="#064e3b" strokeWidth={3} /> : <Circle size={18} color="#3f3f46" strokeWidth={3} />}
                  <Text style={{ fontSize: 10, fontWeight: '900', textTransform: 'uppercase', color: item.resolvido ? '#064e3b' : '#71717a' }}>{item.resolvido ? "Concluído" : "Resolver"}</Text>
                </Pressable>
                
                {op.showPixCheck && (
                  <Pressable
                    onPress={() => !isFechado && onToggleComprovado(item)}
                    disabled={isFechado}
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 10,
                      borderRadius: 20,
                      borderWidth: 2,
                      paddingVertical: 16,
                      backgroundColor: item.comprovadoPix ? '#3b82f6' : 'transparent',
                      borderColor: item.comprovadoPix ? '#3b82f6' : '#27272a',
                    }}
                  >
                    <DollarSign size={18} color={item.comprovadoPix ? "#172554" : "#3f3f46"} strokeWidth={3} />
                    <Text style={{ fontSize: 10, fontWeight: '900', textTransform: 'uppercase', color: item.comprovadoPix ? '#172554' : '#71717a' }}>{item.comprovadoPix ? "Pix OK" : "Aguardando"}</Text>
                  </Pressable>
                )}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}
