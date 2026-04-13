import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { 
  UserPlus, 
  Trash2, 
  CheckCircle2, 
  Circle, 
  DollarSign,
  User,
  History
} from "lucide-react-native";
import { MoneyInput } from "../components/common/money-input";
import { DividaCliente } from "../types/domain";
import { toBrl } from "../utils/currency";

interface DevendoScreenProps {
  dividas: DividaCliente[];
  onCriar: (input: any) => Promise<void>;
  onExcluir: (id: string) => Promise<void>;
  onToggle: (item: DividaCliente) => Promise<void>;
}

export function DevendoScreen({ dividas, onCriar, onExcluir, onToggle }: DevendoScreenProps) {
  const [cliente, setCliente] = useState("");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState(0);
  const [erro, setErro] = useState<string | null>(null);

  async function onSalvar() {
    if (!cliente.trim() || valor <= 0) {
      setErro("Informe o cliente e o valor.");
      return;
    }
    await onCriar({ cliente: cliente.trim(), descricao: descricao.trim(), valor, resolvido: false });
    setCliente("");
    setDescricao("");
    setValor(0);
    setErro(null);
  }

  return (
    <View className="gap-6 pb-20">
      <View className="rounded-[40px] border border-orange-500/20 bg-orange-500/5 p-6 shadow-2xl">
        <View className="flex-row items-center gap-3 mb-6 ml-1">
          <UserPlus size={14} color="#fb923c" />
          <Text className="text-[10px] font-black uppercase tracking-[3px] text-orange-400">Novo Troco Pendente</Text>
        </View>

        <View className="gap-4">
          <TextInput className="rounded-[24px] border border-orange-800/40 bg-orange-950/20 px-6 py-5 text-orange-100 font-bold" placeholder="Nome do Cliente" placeholderTextColor="#7c2d12" value={cliente} onChangeText={setCliente} />
          
          <View>
            <Text className="mb-2 ml-2 text-[10px] font-black uppercase tracking-widest text-orange-900">Valor que devo</Text>
            <MoneyInput placeholder="0,00" placeholderTextColor="#7c2d12" className="rounded-[24px] border border-orange-800/40 bg-orange-950/30 px-6 py-5 text-3xl font-black text-orange-100" value={valor} onChangeValue={setValor} />
          </View>

          <TextInput className="rounded-[24px] border border-orange-800/40 bg-orange-950/20 px-6 py-5 text-orange-100 font-bold" placeholder="Motivo (Ex: Falta de moeda)" placeholderTextColor="#7c2d12" value={descricao} onChangeText={setDescricao} />

          {erro && <Text className="text-center text-xs text-red-400 font-bold py-2">{erro}</Text>}

          <Pressable className="mt-2 rounded-[24px] bg-orange-400 py-6 active:bg-orange-300 shadow-2xl" onPress={onSalvar}>
            <Text className="text-center font-black uppercase tracking-[4px] text-orange-950">Salvar Dívida</Text>
          </Pressable>
        </View>
      </View>

      <View className="gap-4">
        <Text className="ml-2 text-[11px] font-black uppercase tracking-[3px] text-zinc-600">Trocos Pendentes</Text>
        {dividas.map((item) => (
          <View key={item.id} className={`rounded-[32px] border p-6 ${item.resolvido ? "border-zinc-800 bg-zinc-900/50 opacity-40" : "border-orange-500/20 bg-ink-900"}`}>
            <View className="flex-row items-start justify-between mb-6">
              <View className="flex-1">
                <View className="flex-row items-center gap-2 mb-2">
                  <View className="bg-orange-500/10 px-3 py-1 rounded-full border border-orange-500/20">
                    <Text className={`text-[9px] font-black uppercase tracking-widest ${item.resolvido ? "text-zinc-600" : "text-orange-400"}`}>{item.cliente}</Text>
                  </View>
                </View>
                <Text className={`text-xl font-black tracking-tight ${item.resolvido ? "text-zinc-500 line-through" : "text-orange-100"}`}>{item.descricao || "Devendo troco"}</Text>
                <Text className="text-sm font-black text-zinc-500 mt-1 uppercase">{toBrl(item.valor)}</Text>
              </View>
              <Pressable onPress={() => onExcluir(item.id)} hitSlop={12} className="h-10 w-10 items-center justify-center rounded-[14px] bg-red-500/10 border border-red-500/20"><Trash2 size={16} color="#f87171" /></Pressable>
            </View>

            <Pressable onPress={() => onToggle(item)} hitSlop={15} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, borderRadius: 20, borderWidth: 2, paddingVertical: 18, backgroundColor: item.resolvido ? '#10b981' : 'rgba(251, 146, 60, 0.1)', borderColor: item.resolvido ? '#10b981' : 'rgba(251, 146, 60, 0.3)' }}>
              {item.resolvido ? <CheckCircle2 size={20} color="#064e3b" strokeWidth={3} /> : <Circle size={20} color="#fb923c" strokeWidth={3} />}
              <Text style={{ fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5, color: item.resolvido ? '#064e3b' : '#fb923c' }}>{item.resolvido ? "Pago ao Cliente" : "Devendo ao Cliente"}</Text>
            </Pressable>
          </View>
        ))}
      </View>
    </View>
  );
}
