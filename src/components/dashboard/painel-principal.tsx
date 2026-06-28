import { ReactNode, useState, useRef } from "react";
import { Text, View, Pressable, Modal } from "react-native";
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
  Banknote,
  CreditCard,
  Building2,
  Pin,
  PenLine
} from "lucide-react-native";
import { TotaisTurno } from "../../types/domain";
import { toBrl } from "../../utils/currency";
import { SaldoCard } from "./saldo-card";
import { useAppSettings } from "../../hooks/use-app-settings";

interface PainelPrincipalProps {
  totais: TotaisTurno;
  pendenciasFantasma: number;
  valorTerceiros?: number;
  isDiscreto?: boolean;
  onOpenChat?: () => void;
  ultimaMensagemGlobal?: string;
}

export function PainelPrincipal({
  totais,
  pendenciasFantasma,
  valorTerceiros = 0,
  isDiscreto,
  onOpenChat,
  ultimaMensagemGlobal
}: PainelPrincipalProps) {
  const { settings } = useAppSettings();

  // No modo discreto, simulamos que todo o Pix interno é dinheiro físico na gaveta
  const gavetaSimulada = isDiscreto 
    ? (totais.gavetaFisico + (totais.pixNoCaixa || 0) + (totais.pixDiretoLoja || 0)) 
    : totais.gavetaFisico;

  // No modo discreto, o valor do saco deve parecer que é exatamente o valor do sistema
  const envelopeSimulado = isDiscreto ? totais.sistema : totais.especieEnvelope;

  const isNegativo = totais.sobra < 0;
  const isPerfeito = totais.sobra === 0;

  const clickCount = useRef(0);
  const lastClickTime = useRef(0);
  const [showGabarito, setShowGabarito] = useState(false);

  const handleSystemClick = () => {
    const now = Date.now();
    if (now - lastClickTime.current < 400) {
      if (clickCount.current + 1 >= 3) {
        setShowGabarito(true);
        clickCount.current = 0;
      } else {
        clickCount.current += 1;
      }
    } else {
      clickCount.current = 1;
    }
    lastClickTime.current = now;
  };

  const renderGabarito = () => {
    if (!showGabarito) return null;
    
    let remaining = Math.floor(Math.abs(totais.sistema));
    const coinsFraction = Math.abs(totais.sistema) - remaining;
    const notes = [100, 50, 20, 10, 5, 2];
    const breakdown = [];
    
    for (const note of notes) {
      const count = Math.floor(remaining / note);
      if (count > 0) {
        breakdown.push({ note, count });
        remaining -= count * note;
      }
    }
    const totalCoins = remaining + coinsFraction;

    return (
      <Modal visible={showGabarito} transparent animationType="fade" onRequestClose={() => setShowGabarito(false)}>
        <Pressable className="flex-1 bg-black/90 justify-center items-center p-6" onPress={() => setShowGabarito(false)}>
          <Pressable className="w-full max-w-[400px] bg-ink-900 border border-zinc-800 rounded-[40px] p-8 shadow-2xl" onPress={(e) => e.stopPropagation()}>
            <View className="items-center mb-6">
              <View className="h-12 w-12 rounded-2xl bg-zinc-100 items-center justify-center mb-4">
                <Banknote size={24} color="#09090b" />
              </View>
              <Text className="text-xl font-black text-zinc-100 tracking-tighter uppercase">Gabarito Físico</Text>
              <Text className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">
                Sugestão ideal para {toBrl(Math.abs(totais.sistema))}
              </Text>
            </View>

            <View className="gap-2 mb-6">
              {breakdown.map((item) => (
                <View key={item.note} className="flex-row items-center justify-between bg-ink-950 p-4 rounded-2xl border border-zinc-800/50">
                  <Text className="text-sm font-bold text-zinc-400">Notas de R$ {item.note.toFixed(2)}</Text>
                  <Text className="text-lg font-black text-emerald-400">{item.count} <Text className="text-xs text-emerald-600">x</Text></Text>
                </View>
              ))}
              {totalCoins > 0 && (
                <View className="flex-row items-center justify-between bg-ink-950 p-4 rounded-2xl border border-zinc-800/50">
                  <Text className="text-sm font-bold text-zinc-400">Valor em Moedas</Text>
                  <Text className="text-lg font-black text-yellow-400">{toBrl(totalCoins)}</Text>
                </View>
              )}
            </View>

            <Pressable 
              onPress={() => setShowGabarito(false)}
              className="bg-zinc-100 h-14 rounded-full items-center justify-center active:opacity-80"
            >
              <Text className="text-zinc-950 font-black text-sm uppercase tracking-widest">Fechar Gabarito</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    );
  };

  return (
    <View className="gap-6">
      <View className="flex-row gap-4">
        <View className="flex-1">
          <Pressable onPress={handleSystemClick} delayLongPress={2000}>
            <SaldoCard 
              label="Total Sistema" 
              value={toBrl(totais.sistema)} 
              icon={<Monitor size={12} color="#71717a" />}
            />
          </Pressable>
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
        <View className="flex-row items-center justify-between mb-6">
          <View className="flex-row items-center gap-2">
            <Mail size={14} color="#71717a" />
            <Text className="text-[11px] font-black uppercase tracking-[3px] text-zinc-500">
              Malote para a Loja
            </Text>
          </View>
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
            <View className="flex-1">
              <Text className="text-[9px] font-bold text-zinc-600 uppercase leading-4 tracking-tighter">
                Saldo de trocas no seu celular:
              </Text>
              <Text className="text-[9px] font-bold uppercase leading-4 tracking-tighter text-zinc-600">
                <Text className="text-purple-400">{toBrl(totais.pixNoCaixa)}</Text> — o valor de transferência acima já inclui as trocas e os centavos do sistema.
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* OUTROS RECEBIMENTOS (POS / CONVÊNIO) */}
      {!isDiscreto && (settings.posEnabled || settings.convenioEnabled) && (
        <View className="rounded-[40px] border border-zinc-800 bg-ink-900 p-6 shadow-2xl">
          <View className="flex-row items-center gap-2 mb-6">
            <CreditCard size={14} color="#71717a" />
            <Text className="text-[11px] font-black uppercase tracking-[3px] text-zinc-500">
              Outros Recebimentos
            </Text>
          </View>
          
          <View className="gap-3">
            {settings.posEnabled && (
              <View className="flex-row items-center justify-between rounded-[24px] bg-blue-500/5 border border-blue-500/20 p-5">
                <View className="flex-row items-center gap-3">
                  <CreditCard size={18} color="#60a5fa" />
                  <Text className="text-xs font-bold text-blue-400 uppercase tracking-tighter">Máquina POS</Text>
                </View>
                <Text 
                  className="text-xl font-black text-blue-100 tracking-tighter flex-1 text-right"
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.4}
                >
                  {toBrl(totais.totalPOS || 0)}
                </Text>
              </View>
            )}

            {settings.convenioEnabled && (
              <View className="flex-row items-center justify-between rounded-[24px] bg-purple-500/5 border border-purple-500/20 p-5">
                <View className="flex-row items-center gap-3">
                  <Building2 size={18} color="#c084fc" />
                  <Text className="text-xs font-bold text-purple-400 uppercase tracking-tighter">Convênios</Text>
                </View>
                <Text 
                  className="text-xl font-black text-purple-100 tracking-tighter flex-1 text-right"
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.4}
                >
                  {toBrl(totais.totalConvenio || 0)}
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {renderGabarito()}
    </View>
  );
}
