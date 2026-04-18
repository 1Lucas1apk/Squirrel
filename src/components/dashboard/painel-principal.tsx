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
  Info,
  AlertTriangle,
  CheckCircle2,
  Banknote
} from "lucide-react-native";
import { TotaisTurno } from "../../types/domain";
import { toBrl } from "../../utils/currency";
import { SaldoCard } from "./saldo-card";

interface PainelPrincipalProps {
  totais: TotaisTurno;
  pendenciasFantasma: number;
  valorTerceiros?: number;
  isDiscreto?: boolean;
}

export function PainelPrincipal({
  totais,
  pendenciasFantasma,
  valorTerceiros = 0,
  isDiscreto
}: PainelPrincipalProps) {
  // No modo discreto, simulamos que todo o Pix interno é dinheiro físico na gaveta
  const gavetaSimulada = isDiscreto 
    ? (totais.gavetaFisico + (totais.pixNoCaixa || 0) + (totais.pixDiretoLoja || 0)) 
    : totais.gavetaFisico;

  // No modo discreto, o valor do saco deve parecer que é exatamente o valor do sistema
  const envelopeSimulado = isDiscreto ? totais.sistema : totais.especieEnvelope;

  const isNegativo = totais.sobra < 0;
  const isPerfeito = totais.sobra === 0;

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
        {!isDiscreto && (
          <View className="flex-1">
            <SaldoCard 
              label={isPerfeito ? "Caixa Perfeito" : (isNegativo ? "Falta (Quebra)" : "Sobra (Acumulada)")} 
              value={toBrl(totais.sobra)} 
              tone={isPerfeito ? "perfect" : (isNegativo ? "red" : "green")} 
              icon={isPerfeito ? <CheckCircle2 size={12} color="#22d3ee" /> : (isNegativo ? <AlertTriangle size={12} color="#f87171" /> : <Coins size={12} color="#34d399" />)}
            />
          </View>
        )}
      </View>

      {pendenciasFantasma > 0 && !isDiscreto && (
        <View className="bg-amber-500/10 border border-amber-500/20 px-5 py-3 rounded-2xl flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <Info size={14} color="#f59e0b" />
            <Text className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Movimentações Pendentes</Text>
          </View>
          <View className="bg-amber-500 px-2 py-0.5 rounded-lg">
            <Text className="text-[10px] font-black text-amber-950">{pendenciasFantasma}</Text>
          </View>
        </View>
      )}

      <View>
        <SaldoCard 
          label="Dinheiro Físico (Na Gaveta)" 
          value={toBrl(gavetaSimulada)} 
          tone="yellow" 
          icon={<Vault size={14} color="#facc15" />}
        />
        {!isDiscreto && valorTerceiros > 0 && (
          <View className="absolute -top-2 -right-2 bg-orange-500 px-3 py-1.5 rounded-full border-2 border-ink-950 shadow-lg flex-row items-center gap-1.5">
            <Banknote size={10} color="#451a03" strokeWidth={3} />
            <Text className="text-[9px] font-black text-orange-950 uppercase">Terceiros: {toBrl(valorTerceiros)}</Text>
          </View>
        )}
      </View>

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
            <Text 
              className="text-xl font-black text-zinc-100 tracking-tighter flex-1 text-right"
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.4}
              ellipsizeMode="clip"
            >
              {toBrl(envelopeSimulado)}
            </Text>
          </View>
          
          {!isDiscreto && (
            <View className="flex-row items-center justify-between rounded-[24px] bg-blue-500/5 border border-blue-500/20 p-5">
              <View className="flex-row items-center gap-3">
                <ArrowRightLeft size={18} color="#60a5fa" />
                <Text className="text-xs font-bold text-blue-400 uppercase tracking-tighter">Transferir via Pix</Text>
              </View>
              <Text 
                className="text-xl font-black text-blue-100 tracking-tighter flex-1 text-right"
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.4}
                ellipsizeMode="clip"
              >
                {toBrl(totais.pixRepasse)}
              </Text>
            </View>
          )}
        </View>
        
        {!isDiscreto && (
          <View className="mt-4 px-2 flex-row gap-3">
            <Smartphone size={14} color="#71717a" />
            <Text className="text-[9px] font-bold text-zinc-600 uppercase flex-1 leading-4 tracking-tighter">
              Saldo de trocas no seu celular: <Text className="text-purple-400">{toBrl(totais.pixNoCaixa)}</Text>. O valor de transferência acima já inclui as trocas e os centavos do sistema.
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
