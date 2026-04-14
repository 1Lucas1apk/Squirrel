import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View, Platform, StyleSheet, Share, Modal, TextInput, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useCaixaSeguro } from "../hooks/use-caixa-seguro";
import { ChecklistScreen } from "./checklist-screen";
import { FantasmasScreen } from "./fantasmas-screen";
import { DevendoScreen } from "./devendo-screen";
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
  Share2,
  Lock,
  Unlock,
  CheckCircle2,
  AlertTriangle,
  X,
  AlertCircle,
  ShieldAlert
} from "lucide-react-native";

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

type SectionKey = "painel" | "transacoes" | "checklist" | "fantasmas" | "devendo" | "historico";

export function MainScreen() {
  const [section, setSection] = useState<SectionKey>("painel");
  const [modalFechamento, setModalFechamento] = useState(false);
  const [bateu, setBateu] = useState<boolean | null>(null);
  const [obs, setObs] = useState("");

  // Estado para o Alerta Premium Único
  const [customAlert, setCustomAlert] = useState<{
    visible: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    destructive?: boolean;
  }>({ visible: false, title: "", message: "", onConfirm: () => {} });
  
  const caixa = useCaixaSeguro();
  const isFechado = caixa.turno?.statusTurno === "fechado";

  const pendingFantasmas = useMemo(
    () => caixa.fantasmas.filter((item) => !item.resolvido).length,
    [caixa.fantasmas]
  );

  const mostrarAlerta = (title: string, message: string, onConfirm: () => void, destructive = false) => {
    setCustomAlert({ visible: true, title, message, onConfirm, destructive });
  };

  // Função para fechar o dia com segurança
  const iniciarFechamento = () => {
    if (bateu === null) return;
    
    // Primeiro fecha o modal de auditoria para não encavalar
    setModalFechamento(false);
    
    // Depois mostra a confirmação final
    setTimeout(() => {
      mostrarAlerta(
        "ENCERRAR DIA",
        "Deseja realmente travar as edições e fechar o caixa de hoje? Esta ação requer desbloqueio manual depois.",
        async () => {
          await caixa.fecharTurno();
          setBateu(null);
          setObs("");
        }
      );
    }, 300);
  };

  async function handleReabrir() {
    mostrarAlerta(
      "DESTRAVAR DIA",
      "O modo somente leitura será desativado e as edições serão permitidas. Confirmar?",
      async () => {
        await caixa.reabrirTurno();
      }
    );
  }

  const handleExcluirTurnoLocal = (id: string) => {
    mostrarAlerta(
      "APAGAR TUDO",
      "Esta ação vai deletar permanentemente o histórico deste dia do banco de dados. Confirmar?",
      () => caixa.excluirTurno(id),
      true
    );
  };

  async function gerarRelatorio() {
    const data = caixa.turno?.dataReferencia || "";
    const t = caixa.totais;
    
    const entradas = caixa.transacoes.filter(i => i.categoria !== 'sangria' && i.categoria !== 'cancelamento');
    const saidas = caixa.transacoes.filter(i => i.categoria === 'sangria' || i.categoria === 'cancelamento');

    const listaEntradas = entradas.map(item => 
      `🔹 ${toBrl(item.valorSistema)} | ${item.codigoContrato || 'S/C'} - ${item.descricao || 'Venda/Entrada'}`
    ).join('\n');

    const listaSaidas = saidas.map(item => 
      `🔻 ${toBrl(item.valorSistema)} | ${item.descricao || 'Sangria/Despesa'}`
    ).join('\n');

    const msg = `🏪 *CLARA ELETRO - RESUMO DE CAIXA*\n` +
                `📅 DATA: ${data}\n` +
                `━━━━━━━━━━━━━━━━━━━━\n\n` +
                `📥 *MOVIMENTAÇÃO DE ENTRADA*\n` +
                `${listaEntradas || '_Nenhuma entrada_'}\n\n` +
                `📤 *MOVIMENTAÇÃO DE SAÍDA*\n` +
                `${listaSaidas || '_Nenhuma saída_'}\n\n` +
                `━━━━━━━━━━━━━━━━━━━━\n\n` +
                `💰 *BALANÇO FINANCEIRO*\n` +
                `• TOTAL DO SISTEMA: ${toBrl(t.sistema)}\n` +
                `• SOBRA ACUMULADA: ${toBrl(t.sobra)}\n` +
                `• DINHEIRO NA GAVETA: ${toBrl(t.gavetaFisico)}\n\n` +
                `📩 *FECHAMENTO DE ENVELOPE*\n` +
                `💵 DINHEIRO (NOTAS): ${toBrl(t.especieEnvelope)}\n` +
                `📱 REPASSE VIA PIX: ${toBrl(t.pixRepasse)}\n\n` +
                `━━━━━━━━━━━━━━━━━━━━\n` +
                `🐿️ _Relatório gerado via Squirrel App_`;
    
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
            <HistoricoScreen turnos={caixa.historicoTurnos} loading={caixa.loading} onRefresh={caixa.carregarHistoricoTurnos} onOpen={(turnoId) => void caixa.abrirTurnoPorId(turnoId)} onExcluirDia={handleExcluirTurnoLocal} />
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
      {/* ALERTA PREMIUM CUSTOMIZADO (Z-INDEX MÁXIMO) */}
      <Modal visible={customAlert.visible} transparent animationType="fade" onRequestClose={() => setCustomAlert(prev => ({ ...prev, visible: false }))}>
        <View className="flex-1 bg-black/90 items-center justify-center p-6">
          <View className="w-full max-w-[380px] rounded-[40px] border border-zinc-800 bg-ink-900 p-8 shadow-2xl items-center">
            <View className={`h-16 w-16 items-center justify-center rounded-3xl mb-6 ${customAlert.destructive ? 'bg-red-500/10' : 'bg-emerald-500/10'}`}>
              {customAlert.destructive ? <ShieldAlert size={32} color="#f87171" /> : <AlertCircle size={32} color="#34d399" />}
            </View>
            <Text className="text-xl font-black text-white uppercase tracking-[2px] mb-3 text-center">{customAlert.title}</Text>
            <Text className="text-sm font-bold text-zinc-500 uppercase tracking-tighter text-center leading-5 mb-8">{customAlert.message}</Text>
            <View className="flex-row gap-3 w-full">
              <Pressable onPress={() => setCustomAlert(prev => ({ ...prev, visible: false }))} className="flex-1 py-5 rounded-[24px] bg-zinc-800"><Text className="text-center font-black text-zinc-400 uppercase text-[10px] tracking-widest">Sair</Text></Pressable>
              <Pressable onPress={() => { customAlert.onConfirm(); setCustomAlert(prev => ({ ...prev, visible: false })); }} className={`flex-[1.5] py-5 rounded-[24px] ${customAlert.destructive ? 'bg-red-500' : 'bg-zinc-100'}`}><Text className={`text-center font-black uppercase text-[10px] tracking-widest ${customAlert.destructive ? 'text-white' : 'text-zinc-950'}`}>Confirmar</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Auditoria Fechamento */}
      <Modal visible={modalFechamento} transparent animationType="slide" onRequestClose={() => setModalFechamento(false)}>
        <View className="flex-1 bg-black/90 items-center justify-center p-6">
          <View className="w-full max-w-[400px] rounded-[40px] border border-zinc-800 bg-ink-900 p-8 shadow-2xl">
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-xl font-black text-white uppercase tracking-widest">Auditoria Final</Text>
              <Pressable onPress={() => setModalFechamento(false)}><X size={20} color="#71717a" /></Pressable>
            </View>
            <Text className="text-[10px] font-black text-zinc-500 uppercase tracking-[2px] mb-4 text-center">O Caixa bateu com o Físico?</Text>
            <View className="flex-row gap-4 mb-8">
              <Pressable onPress={() => setBateu(true)} className={`flex-1 flex-row items-center justify-center gap-2 py-5 rounded-[24px] border-2 ${bateu === true ? 'bg-emerald-500 border-emerald-500' : 'bg-ink-800 border-zinc-800'}`}><CheckCircle2 size={18} color={bateu === true ? "#064e3b" : "#71717a"} /><Text className={`font-black uppercase text-[10px] ${bateu === true ? 'text-emerald-950' : 'text-zinc-500'}`}>Sim</Text></Pressable>
              <Pressable onPress={() => setBateu(false)} className={`flex-1 flex-row items-center justify-center gap-2 py-5 rounded-[24px] border-2 ${bateu === false ? 'bg-red-500 border-red-500' : 'bg-ink-800 border-zinc-800'}`}><AlertTriangle size={18} color={bateu === false ? "#450a0a" : "#71717a"} /><Text className={`font-black uppercase text-[10px] ${bateu === false ? 'text-red-950' : 'text-zinc-500'}`}>Não</Text></Pressable>
            </View>
            {bateu === false && (
              <TextInput multiline value={obs} onChangeText={setObs} className="rounded-[24px] border border-zinc-800 bg-ink-800 p-6 text-zinc-200 font-bold mb-8" placeholder="O que deu erro?" placeholderTextColor="#3f3f46" />
            )}
            <Pressable disabled={bateu === null} onPress={iniciarFechamento} className={`rounded-[24px] py-6 shadow-2xl ${bateu !== null ? 'bg-zinc-100' : 'bg-zinc-800 opacity-50'}`}><Text className="text-center font-black uppercase tracking-[4px] text-zinc-950">Prosseguir</Text></Pressable>
          </View>
        </View>
      </Modal>

      {/* CABEÇALHO */}
      <View className="border-b border-zinc-900 bg-ink-950 px-4 pb-4 pt-2">
        <View className="mx-auto flex w-full max-w-[460px] flex-row items-center justify-between">
          <View>
            <Text className="text-lg font-black text-zinc-100 uppercase tracking-tighter">Caixa Seguro</Text>
            <Text className="text-[10px] font-black uppercase tracking-[2px] text-zinc-600">{caixa.turno.dataReferencia} • {caixa.transacoes.length} ITENS</Text>
          </View>
          <View className="flex-row gap-2">
            <Pressable className="h-10 w-10 items-center justify-center rounded-2xl border border-zinc-800 bg-ink-900 active:bg-zinc-800" onPress={gerarRelatorio}><Share2 size={18} color="#a78bfa" /></Pressable>
            {isFechado ? (
              <Pressable onLongPress={handleReabrir} delayLongPress={2000} className="h-10 w-10 items-center justify-center rounded-2xl border border-red-500/30 bg-red-500/10 active:bg-red-500/20"><Lock size={18} color="#f87171" /></Pressable>
            ) : (
              <Pressable onPress={() => setModalFechamento(true)} className="h-10 w-10 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10 active:bg-emerald-500/20"><Unlock size={18} color="#34d399" /></Pressable>
            )}
            <Pressable className="h-10 w-10 items-center justify-center rounded-2xl border border-zinc-800 bg-ink-900 active:bg-zinc-800" onPress={() => changeSection("historico")}><History size={18} color="#71717a" /></Pressable>
          </View>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="always">
        <View className="mx-auto w-full max-w-[460px]">
          {section === "painel" && <PainelScreen totais={caixa.totais} pendenciasFantasma={pendingFantasmas} ajusteManualSobra={caixa.turno.ajusteManualSobra} onAjusteSobra={caixa.definirAjusteSobra} isFechado={isFechado} />}
          {section === "transacoes" && <TransacoesScreen transacoes={caixa.transacoes} onAdicionar={caixa.criarTransacao} onExcluir={caixa.excluirTransacao} onEditar={caixa.editarLançamento} isFechado={isFechado} />}
          {section === "devendo" && <DevendoScreen dividas={caixa.dividas} onCriar={caixa.criarDivida} onExcluir={caixa.excluirDivida} onToggle={caixa.alternarDividaStatus} isFechado={isFechado} />}
          {section === "fantasmas" && <FantasmasScreen fantasmas={caixa.fantasmas} onCriar={caixa.criarFantasma} onToggleResolvido={caixa.alternarFantasmaResolvido} onToggleComprovado={caixa.alternarFantasmaComprovado} onExcluir={caixa.excluirFantasma} isFechado={isFechado} />}
          {section === "checklist" && <ChecklistScreen transacoes={caixa.transacoes} onToggle={caixa.alternarConferencia} isFechado={isFechado} />}
          {section === "historico" && <HistoricoScreen turnos={caixa.historicoTurnos} loading={caixa.loading} onRefresh={caixa.carregarHistoricoTurnos} onOpen={(turnoId) => void caixa.abrirTurnoPorId(turnoId)} onExcluirDia={handleExcluirTurnoLocal} />}
        </View>
      </ScrollView>

      {/* NAVEGAÇÃO INFERIOR */}
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
