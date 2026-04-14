import { ReactNode } from "react";
import { Text, View } from "react-native";
import { 
  Monitor, 
  Coins, 
  Vault, 
  Mail, 
  Wallet, 
  ArrowRightLeft, 
  Smartphone,
  Info
} from "lucide-react-native";
import { TotaisTurno } from "../../types/domain";
import { toBrl } from "../../utils/currency";
import { SaldoCard } from "./saldo-card";

interface PainelPrincipalProps {
  totais: TotaisTurno;
  pendenciasFantasma: number;
}

export function PainelPrincipal({
  totais,
  pendenciasFantasma,
}: PainelPrincipalProps) {
  return (
    <View className="gap-6">
      <View className="flex-row gap-4">
        <View className="flex-1">
          <SaldoCard 
            label="Total Sistema" 
            value={toBrl(totais.sistema)} 
            icon={<Monitor size={12} color="#71717a" />}
          />
        </View>
        <View className="flex-1">
          <SaldoCard 
            label="Sobra (Acumulada)" 
            value={toBrl(totais.sobra)} 
            tone="green" 
            icon={<Coins size={12} color="#34d399" />}
          />
        </View>
      </View>

      <SaldoCard 
        label="Dinheiro Físico (Na Gaveta)" 
        value={toBrl(totais.gavetaFisico)} 
        tone="yellow" 
        icon={<Vault size={14} color="#facc15" />}
      />

      <View className="rounded-[40px] border border-zinc-800 bg-ink-900 p-6 shadow-2xl">
        <View className="flex-row items-center gap-2 mb-6">
          <Mail size={14} color="#71717a" />
          <Text className="text-[11px] font-black uppercase tracking-[3px] text-zinc-500">
            Malote para a Loja
          </Text>
        </View>
        
        <View className="gap-3">
          <View className="flex-row items-center justify-between rounded-[24px] bg-ink-800 border border-zinc-800 p-5 shadow-inner">
            <View className="flex-row items-center gap-3">
              <Wallet size={18} color="#71717a" />
              <Text className="text-xs font-bold text-zinc-400 uppercase tracking-tighter">Dinheiro (No Saco)</Text>
            </View>
            <Text className="text-xl font-black text-zinc-100 tracking-tighter">{toBrl(totais.especieEnvelope)}</Text>
          </View>
          
          <View className="flex-row items-center justify-between rounded-[24px] bg-blue-500/5 border border-blue-500/20 p-5">
            <View className="flex-row items-center gap-3">
              <ArrowRightLeft size={18} color="#60a5fa" />
              <Text className="text-xs font-bold text-blue-400 uppercase tracking-tighter">Transferir via Pix</Text>
            </View>
            <Text className="text-xl font-black text-blue-100 tracking-tighter">{toBrl(totais.pixRepasse)}</Text>
          </View>
        </View>
        
        <View className="mt-4 px-2 flex-row gap-3">
          <Smartphone size={14} color="#71717a" />
          <Text className="text-[9px] font-bold text-zinc-600 uppercase flex-1 leading-4 tracking-tighter">
            Saldo de trocas no seu celular: {toBrl(totais.pixNoCaixa)}. O valor de transferência acima já inclui as trocas e os centavos do sistema.
          </Text>
        </View>
      </View>
    </View>
  );
}
