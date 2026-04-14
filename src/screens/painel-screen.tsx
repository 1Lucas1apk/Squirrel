import { useState } from "react";
import { Text, View, Pressable, TextInput } from "react-native";
import { SlidersHorizontal, CheckCircle2, XCircle, MessageSquare } from "lucide-react-native";
import { MoneyInput } from "../components/common/money-input";
import { PainelPrincipal } from "../components/dashboard/painel-principal";
import { TotaisTurno } from "../types/domain";

interface PainelScreenProps {
  totais: TotaisTurno;
  pendenciasFantasma: number;
  ajusteManualSobra: number;
  onAjusteSobra: (value: number) => void;
  isFechado?: boolean;
}

export function PainelScreen({
  totais,
  pendenciasFantasma,
  ajusteManualSobra,
  onAjusteSobra,
  isFechado
}: PainelScreenProps) {
  return (
    <View className="gap-6 pb-20">
      <PainelPrincipal totais={totais} pendenciasFantasma={pendenciasFantasma} />

      {/* Ajuste de Sobra */}
      <View className={`rounded-[40px] border p-6 shadow-2xl ${isFechado ? 'border-zinc-900 bg-zinc-900/30' : 'border-zinc-800 bg-ink-900'}`}>
        <View className="flex-row items-center gap-3 mb-4 ml-1">
          <SlidersHorizontal size={14} color="#71717a" />
          <Text className="text-[11px] font-black uppercase tracking-[3px] text-zinc-500">
            Ajuste Manual da Sobra
          </Text>
        </View>
        <Text className="mb-6 text-xs font-bold leading-5 text-zinc-600 px-1 uppercase tracking-tighter">
          {isFechado 
            ? "O ajuste manual está travado pois o dia já foi encerrado."
            : "Use os centavos da caixinha para cobrir quebras. Isso altera o Gaveta Físico mas mantém o Total Sistema intacto."
          }
        </Text>
        <MoneyInput
          placeholder="0,00"
          placeholderTextColor="#27272a"
          editable={!isFechado}
          className={`rounded-[24px] border px-6 py-5 text-3xl font-black shadow-inner ${isFechado ? 'border-zinc-800 bg-zinc-900 text-zinc-600' : 'border-zinc-700 bg-ink-800 text-zinc-100'}`}
          value={ajusteManualSobra}
          onChangeValue={onAjusteSobra}
        />
      </View>
    </View>
  );
}
