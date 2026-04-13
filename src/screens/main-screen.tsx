import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View, Platform, StyleSheet, Share } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useCaixaSeguro } from "../hooks/use-caixa-seguro";
import { ChecklistScreen } from "./checklist-screen";
import { FantasmasScreen } from "./fantasmas-screen";
import { DevendoScreen } from "./devendo-screen"; // NOVO
import { HistoricoScreen } from "./historico-screen";
import { PainelScreen } from "./painel-screen";
import { TransacoesScreen } from "./transacoes-screen";
import { TurnoScreen } from "./turno-screen";
import { toBrl } from "../utils/currency";

import { 
  LayoutDashboard, 
  PlusCircle, 
  CheckSquare, 
  Ghost, 
  History,
  UserMinus,
  Share2
} from "lucide-react-native";

type SectionKey = "painel" | "transacoes" | "checklist" | "fantasmas" | "devendo" | "historico";

export function MainScreen() {
  const [section, setSection] = useState<SectionKey>("painel");
  const caixa = useCaixaSeguro();

  const pendingFantasmas = useMemo(
    () => caixa.fantasmas.filter((item) => !item.resolvido).length,
    [caixa.fantasmas]
  );

  async function gerarRelatorio() {
    const data = caixa.turno?.dataReferencia || "";
    const t = caixa.totais;
    const msg = `📊 *FECHAMENTO CAIXA - ${data}*\n\n` +
                `✅ *Sistema:* ${toBrl(t.sistema)}\n` +
                `💰 *Sobra:* ${toBrl(t.sobra)}\n` +
                `🏦 *Gaveta Real:* ${toBrl(t.gavetaFisico)}\n\n` +
                `📩 *ENVELOPE (MALOTE)*\n` +
                `💵 Espécie: ${toBrl(t.especieEnvelope)}\n` +
                `📱 Pix Repasse: ${toBrl(t.pixRepasse)}\n\n` +
                `⚠️ *Pendências:* ${pendingFantasmas} item(ns)\n` +
                `🐿️ Gerado via *Squirrel App*`;
    
    try {
      await Share.share({ message: msg });
    } catch (error) {
      console.log(error);
    }
  }

  async function changeSection(next: SectionKey) {
    setSection(next);
    if (next === "historico") await caixa.carregarHistoricoTurnos();
  }

  if (!caixa.turno) {
    return (
      <SafeAreaView style={styles.container}>
        {section === "historico" ? (
          <View className="mx-auto flex-1 w-full max-w-[460px] px-5 pb-8 pt-5">
            <View className="mb-6 flex-row items-center justify-between">
              <Text className="text-xl font-black text-zinc-100 uppercase tracking-widest">Histórico</Text>
              <Pressable className="rounded-2xl border border-zinc-700 px-4 py-2 bg-ink-900" onPress={() => setSection("painel")}><Text className="text-xs font-bold text-zinc-300 uppercase">Voltar</Text></Pressable>
            </View>
            <HistoricoScreen turnos={caixa.historicoTurnos} loading={caixa.loading} onRefresh={caixa.carregarHistoricoTurnos} onOpen={(turnoId) => void caixa.abrirTurnoPorId(turnoId)} onExcluirDia={caixa.excluirTurno} />
          </View>
        ) : (
          <TurnoScreen loading={caixa.loading} error={caixa.error} onNovoDia={caixa.iniciarNovoDia} onContinuar={caixa.continuarDiaAnterior} onVerHistorico={() => void changeSection("historico")} />
        )}
      </SafeAreaView>
    );
  }

  const sections: { key: SectionKey; label: string; icon: any }[] = [
    { key: "painel", label: "Painel", icon: LayoutDashboard },
    { key: "transacoes", label: "Lançar", icon: PlusCircle },
    { key: "devendo", label: "Devendo", icon: UserMinus },
    { key: "fantasmas", label: "Notas", icon: Ghost },
    { key: "checklist", label: "Check", icon: CheckSquare },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View className="border-b border-zinc-900 bg-ink-950 px-4 pb-4 pt-2">
        <View className="mx-auto flex w-full max-w-[460px] flex-row items-center justify-between">
          <View>
            <Text className="text-lg font-black text-zinc-100 uppercase tracking-tighter">Caixa Seguro</Text>
            <Text className="text-[10px] font-black uppercase tracking-[2px] text-zinc-600">{caixa.turno.dataReferencia} • {caixa.transacoes.length} ITENS</Text>
          </View>
          <View className="flex-row gap-2">
            <Pressable className="h-10 w-10 items-center justify-center rounded-2xl border border-zinc-800 bg-ink-900" onPress={gerarRelatorio}><Share2 size={18} color="#a78bfa" /></Pressable>
            <Pressable className="h-10 w-10 items-center justify-center rounded-2xl border border-zinc-800 bg-ink-900" onPress={() => changeSection("historico")}><History size={18} color="#71717a" /></Pressable>
          </View>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="always">
        <View className="mx-auto w-full max-w-[460px]">
          {section === "painel" && <PainelScreen totais={caixa.totais} pendenciasFantasma={pendingFantasmas} ajusteManualSobra={caixa.turno.ajusteManualSobra} onAjusteSobra={caixa.definirAjusteSobra} />}
          {section === "transacoes" && <TransacoesScreen transacoes={caixa.transacoes} onAdicionar={caixa.criarTransacao} onExcluir={caixa.excluirTransacao} onEditar={caixa.editarLançamento} />}
          {section === "devendo" && <DevendoScreen dividas={caixa.dividas} onCriar={caixa.criarDivida} onExcluir={caixa.excluirDivida} onToggle={caixa.alternarDividaStatus} />}
          {section === "fantasmas" && <FantasmasScreen fantasmas={caixa.fantasmas} onCriar={caixa.criarFantasma} onToggleResolvido={caixa.alternarFantasmaResolvido} onToggleComprovado={caixa.alternarFantasmaComprovado} onExcluir={caixa.excluirFantasma} />}
          {section === "checklist" && <ChecklistScreen transacoes={caixa.transacoes} onToggle={caixa.alternarConferencia} />}
          {section === "historico" && <HistoricoScreen turnos={caixa.historicoTurnos} loading={caixa.loading} onRefresh={caixa.carregarHistoricoTurnos} onOpen={(turnoId) => void caixa.abrirTurnoPorId(turnoId)} onExcluirDia={caixa.excluirTurno} />}
        </View>
      </ScrollView>

      <View style={styles.navContainer} pointerEvents="box-none">
        <View style={styles.navInner}>
          {sections.map((s) => {
            const active = section === s.key;
            const Icon = s.icon;
            return (
              <Pressable key={s.key} style={[styles.navButton, active && styles.navButtonActive]} onPress={() => setSection(s.key)}>
                <Icon size={16} color={active ? "#09090b" : "#71717a"} strokeWidth={active ? 3 : 2} />
                {active && <Text style={styles.navLabel}>{s.label}</Text>}
              </Pressable>
            );
          })}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  scrollContent: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 140 },
  navContainer: { position: 'absolute', bottom: Platform.OS === 'android' ? 24 : 34, left: 0, right: 0, alignItems: 'center', paddingHorizontal: 10, zIndex: 999 },
  navInner: { flexDirection: 'row', gap: 2, borderRadius: 32, borderWidth: 1, borderColor: '#27272a', backgroundColor: '#18181b', padding: 6, elevation: 10 },
  navButton: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 24, paddingHorizontal: 12, paddingVertical: 10 },
  navButtonActive: { backgroundColor: '#f4f4f5' },
  navLabel: { fontSize: 9, fontWeight: '900', color: '#09090b', textTransform: 'uppercase' }
});
