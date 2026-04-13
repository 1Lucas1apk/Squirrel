import { useState } from "react";
import { Pressable, Text, TextInput, View, ScrollView } from "react-native";
import { MoneyInput } from "../components/common/money-input";
import { LembreteFantasma, TipoFantasma } from "../types/domain";
import { toBrl } from "../utils/currency";

import { 
  Ghost, 
  User, 
  UserRound, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  DollarSign,
  AlertTriangle,
  ChevronRight,
  Circle
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
  onExcluir: (id: string) => Promise<void>;
}

const tipos: { value: TipoFantasma; label: string; icon: any }[] = [
  { value: "gerente_troca", label: "Gerente", icon: UserRound },
  { value: "outro", label: "Pessoa", icon: User },
];

export function FantasmasScreen({
  fantasmas,
  onCriar,
  onToggleResolvido,
  onToggleComprovado,
  onExcluir,
}: FantasmasScreenProps) {
  const [tipo, setTipo] = useState<TipoFantasma>("gerente_troca");
  const [pessoa, setPessoa] = useState("");
  const [descricao, setDescricao] = useState("");
  const [valorReferencia, setValorReferencia] = useState(0);
  const [impactaPixRepasse, setImpactaPixRepasse] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  async function onSalvar() {
    if (!descricao.trim()) {
      setErro("Descreva a pendência.");
      return;
    }

    try {
      await onCriar({
        tipo,
        pessoa: pessoa.trim() || undefined,
        descricao: descricao.trim(),
        valorReferencia,
        impactaPixRepasse,
      });

      setDescricao("");
      setPessoa("");
      setValorReferencia(0);
      setImpactaPixRepasse(true);
      setErro(null);
    } catch (e) {
      setErro("Erro ao salvar fantasma.");
    }
  }

  return (
    <View className="gap-6 pb-20">
      {/* Formulário de Criação */}
      <View className="rounded-[40px] border border-purple-500/20 bg-purple-500/5 p-6 shadow-2xl">
        <View className="flex-row items-center gap-3 mb-6 ml-1">
          <Ghost size={14} color="#a78bfa" />
          <Text className="text-[10px] font-black uppercase tracking-[3px] text-purple-400">
            Novo Registro Fantasma
          </Text>
        </View>
        
        <View className="mb-6 flex-row gap-2">
          {tipos.map((item) => {
            const active = tipo === item.value;
            const Icon = item.icon;
            return (
              <Pressable
                key={item.value}
                onPress={() => setTipo(item.value)}
                hitSlop={8}
                style={{
                  flex: 1,
                  borderRadius: 20,
                  borderWidth: 1,
                  paddingHorizontal: 16,
                  paddingVertical: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  backgroundColor: active ? '#a78bfa' : 'rgba(88, 28, 135, 0.2)',
                  borderColor: active ? '#c4b5fd' : 'rgba(126, 34, 206, 0.3)',
                  elevation: active ? 4 : 0,
                }}
              >
                <Icon size={14} color={active ? "#2e1065" : "#a78bfa"} strokeWidth={3} />
                <Text style={{
                  fontSize: 10,
                  fontWeight: '900',
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                  color: active ? '#2e1065' : '#a78bfa'
                }}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View className="gap-4">
          <TextInput
            className="rounded-[24px] border border-purple-800/40 bg-purple-950/20 px-6 py-5 text-purple-100 font-bold"
            placeholder="Quem? (Ex: Ricardo, Gerente...)"
            placeholderTextColor="#4c1d95"
            value={pessoa}
            onChangeText={setPessoa}
          />

          <TextInput
            className="rounded-[24px] border border-purple-800/40 bg-purple-950/20 px-6 py-5 text-purple-100 font-bold"
            placeholder="O que aconteceu?"
            placeholderTextColor="#4c1d95"
            value={descricao}
            onChangeText={setDescricao}
            multiline
          />

          <View>
            <View className="flex-row items-center gap-2 mb-2 ml-2">
              <DollarSign size={10} color="#581c87" />
              <Text className="text-[10px] font-black uppercase tracking-widest text-purple-900">Valor de Referência</Text>
            </View>
            <MoneyInput
              placeholder="0,00"
              placeholderTextColor="#4c1d95"
              className="rounded-[24px] border border-purple-800/40 bg-purple-950/30 px-6 py-5 text-3xl font-black text-purple-100"
              value={valorReferencia}
              onChangeValue={setValorReferencia}
            />
          </View>

          <Pressable
            className={`flex-row items-center justify-between rounded-[24px] border p-5 ${
              impactaPixRepasse ? "border-purple-400/30 bg-purple-400/10" : "border-purple-800/30 bg-purple-950/20"
            }`}
            onPress={() => setImpactaPixRepasse(!impactaPixRepasse)}
          >
            <View className="flex-1">
              <Text className={impactaPixRepasse ? "text-purple-100 font-black text-[10px] uppercase tracking-widest" : "text-purple-400/40 font-bold text-[10px] uppercase tracking-widest"}>
                {impactaPixRepasse ? "Impacta no Malote" : "Apenas Lembrete"}
              </Text>
              <Text className="text-[9px] text-purple-400/60 mt-1 uppercase font-bold tracking-tighter">
                {impactaPixRepasse ? "Este valor será descontado do físico." : "Não afeta os cálculos de fechamento."}
              </Text>
            </View>
            <View className={`h-8 w-8 items-center justify-center rounded-full border-2 ${impactaPixRepasse ? "border-purple-400 bg-purple-400 shadow-lg shadow-purple-500/50" : "border-purple-800"}`}>
               {impactaPixRepasse && <CheckCircle2 size={16} color="#2e1065" strokeWidth={3} />}
            </View>
          </Pressable>

          {erro && (
            <View className="rounded-2xl bg-red-500/10 py-3 border border-red-500/20">
              <Text className="text-center text-[10px] font-black text-red-400 uppercase tracking-widest">{erro}</Text>
            </View>
          )}

          <Pressable className="mt-2 rounded-[24px] bg-purple-400 py-6 active:bg-purple-300 shadow-2xl shadow-purple-500/40" onPress={onSalvar}>
            <Text className="text-center font-black uppercase tracking-[4px] text-purple-950">Lançar Pendência</Text>
          </Pressable>
        </View>
      </View>

      {/* Lista de Pendências */}
      <View className="gap-4">
        <Text className="ml-2 text-[11px] font-black uppercase tracking-[3px] text-zinc-600">Pendências em Aberto</Text>
        {fantasmas.map((item) => (
          <View 
            key={item.id} 
            className={`rounded-[32px] border p-6 shadow-sm ${
              item.resolvido 
                ? "border-zinc-800 bg-zinc-900/50 opacity-60" 
                : "border-purple-500/20 bg-ink-900"
            }`}
          >
            <View className="flex-row items-start justify-between mb-6">
              <View className="flex-1">
                <View className="flex-row items-center gap-2 mb-2">
                  <View className={`px-3 py-1 rounded-full border ${item.resolvido ? "border-zinc-700 bg-zinc-800" : "border-purple-500/20 bg-purple-500/10"}`}>
                    <Text className={`text-[9px] font-black uppercase tracking-widest ${item.resolvido ? "text-zinc-600" : "text-purple-400"}`}>
                      {item.pessoa || "Geral"} • {item.tipo === "gerente_troca" ? "Gerente" : "Pessoa"}
                    </Text>
                  </View>
                  {item.impactaPixRepasse && !item.resolvido && (
                    <AlertTriangle size={12} color="#facc15" />
                  )}
                </View>
                <Text className={`text-xl font-black tracking-tight ${item.resolvido ? "text-zinc-500 line-through" : "text-purple-100"}`}>
                  {item.descricao}
                </Text>
                <Text className={`text-sm font-black mt-1 uppercase ${item.resolvido ? "text-zinc-600" : "text-zinc-500"}`}>
                  {toBrl(item.valorReferencia)}
                </Text>
              </View>
              
              <Pressable 
                onPress={() => onExcluir(item.id)}
                hitSlop={12}
                className="h-10 w-10 items-center justify-center rounded-[14px] bg-red-500/10 border border-red-500/20"
              >
                <Trash2 size={16} color="#f87171" />
              </Pressable>
            </View>

            <View className="flex-row gap-3">
              {/* Botão Resolvido */}
              <Pressable
                onPress={() => onToggleResolvido(item)}
                hitSlop={15}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 12,
                  borderRadius: 20,
                  borderWidth: 2,
                  paddingVertical: 18,
                  backgroundColor: item.resolvido ? '#10b981' : 'rgba(167, 139, 250, 0.1)',
                  borderColor: item.resolvido ? '#10b981' : 'rgba(167, 139, 250, 0.3)',
                  elevation: item.resolvido ? 8 : 0,
                }}
              >
                {item.resolvido ? (
                  <CheckCircle2 size={20} color="#064e3b" strokeWidth={3} />
                ) : (
                  <Circle size={20} color="#a78bfa" strokeWidth={3} />
                )}
                <Text style={{
                  fontSize: 11,
                  fontWeight: '900',
                  textTransform: 'uppercase',
                  letterSpacing: 1.5,
                  color: item.resolvido ? '#064e3b' : '#a78bfa'
                }}>
                  {item.resolvido ? "Concluído" : "Pendente"}
                </Text>
              </Pressable>
              
              {/* Botão Pix */}
              <Pressable
                onPress={() => onToggleComprovado(item)}
                hitSlop={15}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 12,
                  borderRadius: 20,
                  borderWidth: 2,
                  paddingVertical: 18,
                  backgroundColor: item.comprovadoPix ? '#3b82f6' : '#18181b',
                  borderColor: item.comprovadoPix ? '#3b82f6' : '#27272a',
                  elevation: item.comprovadoPix ? 8 : 0,
                }}
              >
                <DollarSign size={20} color={item.comprovadoPix ? "#172554" : "#3f3f46"} strokeWidth={3} />
                <Text style={{
                  fontSize: 11,
                  fontWeight: '900',
                  textTransform: 'uppercase',
                  letterSpacing: 1.5,
                  color: item.comprovadoPix ? '#172554' : '#71717a'
                }}>
                  {item.comprovadoPix ? "Pix OK" : "Verificar"}
                </Text>
              </Pressable>
            </View>
          </View>
        ))}
        
        {fantasmas.length === 0 && (
          <View className="rounded-[32px] border border-dashed border-zinc-800 py-20 items-center justify-center opacity-50">
            <Ghost size={40} color="#27272a" strokeWidth={1} />
            <Text className="mt-4 text-zinc-600 font-black uppercase tracking-[3px] text-[10px]">Sem lembretes</Text>
          </View>
        )}
      </View>
    </View>
  );
}
