import { Text, View } from "react-native";
import { SlidersHorizontal } from "lucide-react-native";
import { MoneyInput } from "../components/common/money-input";
import { PainelPrincipal } from "../components/dashboard/painel-principal";
import { TotaisTurno } from "../types/domain";

interface PainelScreenProps {
  totais: TotaisTurno;
  pendenciasFantasma: number;
  ajusteManualSobra: number;
  onAjusteSobra: (value: number) => void;
}

export function PainelScreen({
  totais,
  pendenciasFantasma,
  ajusteManualSobra,
  onAjusteSobra,
}: PainelScreenProps) {
  return (
    <View className="gap-6">
      <PainelPrincipal totais={totais} pendenciasFantasma={pendenciasFantasma} />

      <View className="rounded-[40px] border border-zinc-800 bg-ink-900 p-6 shadow-2xl">
        <View className="flex-row items-center gap-3 mb-4 ml-1">
          <SlidersHorizontal size={14} color="#71717a" />
          <Text className="text-[11px] font-black uppercase tracking-[3px] text-zinc-500">
            Ajuste Manual da Sobra
          </Text>
        </View>
        <Text className="mb-6 text-xs font-bold leading-5 text-zinc-600 px-1 uppercase tracking-tighter">
          Use os centavos da caixinha para cobrir quebras. Isso altera o <Text className="text-zinc-400">Gaveta Físico</Text> mas mantém o <Text className="text-zinc-400">Total Sistema</Text> intacto.
        </Text>
        <MoneyInput
          placeholder="0,00"
          placeholderTextColor="#27272a"
          className="rounded-[24px] border border-zinc-700 bg-ink-800 px-6 py-5 text-3xl font-black text-zinc-100 shadow-inner"
          value={ajusteManualSobra}
          onChangeValue={onAjusteSobra}
        />
      </View>
    </View>
  );
}
