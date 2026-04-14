import { useMemo, useState, useEffect } from "react";
import { Pressable, ScrollView, Text, View, Platform, StyleSheet, Share, Modal, TextInput } from "react-native";
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
import { MoneyInput } from "../components/common/money-input";

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
  ShieldAlert,
  MoreHorizontal,
  Banknote,
  Settings,
  CalendarDays
} from "lucide-react-native";

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

type SectionKey = "painel" | "transacoes" | "checklist" | "fantasmas" | "devendo" | "historico";

export function MainScreen() {
  const [section, setSection] = useState<SectionKey>("painel");
  const [modalFechamento, setModalFechamento] = useState(false);
  const [modalMais, setModalMais] = useState(false);
  const [modalNotas, setModalNotas] = useState(false);
  const [modalConfig, setModalConfig] = useState(false);
  
  const [bateu, setBateu] = useState<boolean | null>(null);
  const [obs, setObs] = useState("");

  const [caixaId, setCaixaId] = useState("");
  const [operadorId, setOperadorId] = useState("");

  const [cedulas, setCedulas] = useState({ n100: 0, n50: 0, n20: 0, n10: 0, n5: 0, n2: 0, moedas: 0 });

  const [customAlert, setCustomAlert] = useState<{
    visible: boolean; title: string; message: string; onConfirm: () => void; destructive?: boolean;
  }>({ visible: false, title: "", message: "", onConfirm: () => {} });
  
  const caixa = useCaixaSeguro();
  const isFechado = caixa.turno?.statusTurno === "fechado";

  const totalEmNotas = useMemo(() => {
    return (cedulas.n100 * 100) + (cedulas.n50 * 50) + (cedulas.n20 * 20) + 
           (cedulas.n10 * 10) + (cedulas.n5 * 5) + (cedulas.n2 * 2) + cedulas.moedas;
  }, [cedulas]);

  useEffect(() => {
    if (caixa.turno && !caixa.loading) {
      const pendenciasF = (caixa.fantasmas || []).filter(f => !f.resolvido);
      const pendenciasD = (caixa.dividas || []).filter(d => !d.resolvido);
      if (pendenciasF.length > 0 || pendenciasD.length > 0) {
        const detalhesF = pendenciasF.map(f => `• ${f.pessoa}: ${toBrl(f.valorReferencia)}`).join('\n');
        const detalhesD = pendenciasD.map(d => `• ${d.cliente}: ${toBrl(d.valor)} (Troco)`).join('\n');
        const msg = `⚠️ Existem pendências em aberto:\n\n${detalhesF}${detalhesD ? '\n' + detalhesD : ''}\n\nPor favor, faça a devolução ou cobrança e marque como resolvido!`;
        setTimeout(() => {
          setCustomAlert({ visible: true, title: "NOTIFICAÇÃO DE CAIXA", message: msg, onConfirm: () => {} });
        }, 1500);
      }
    }
  }, [caixa.turno?.id, caixa.loading]);

  useEffect(() => {
    if (caixa.turno) {
      setCaixaId(caixa.turno.caixaId || "");
      setOperadorId(caixa.turno.operadorId || "");
      if (caixa.turno.contagem) setCedulas(caixa.turno.contagem);
    }
  }, [caixa.turno?.id]);

  const mostrarAlerta = (title: string, message: string, onConfirm: () => void, destructive = false) => {
    setCustomAlert({ visible: true, title, message, onConfirm, destructive });
  };

  const changeSection = async (next: SectionKey) => {
    setSection(next);
    if (next === "historico") await caixa.carregarHistoricoTurnos();
  };

  const iniciarFechamento = () => {
    if (bateu === null) return;
    setModalFechamento(false);
    setTimeout(() => {
      mostrarAlerta("ENCERRAR DIA", "Deseja realmente fechar o caixa agora? As edições serão travadas.", async () => {
        await caixa.fecharTurno();
        setBateu(null);
        setObs("");
      });
    }, 300);
  };

  async function handleReabrir() {
    mostrarAlerta("DESTRAVAR DIA", "O modo somente leitura será desativado. Confirmar?", async () => {
      await caixa.reabrirTurno();
    });
  }

  async function gerarRelatorio() {
    const data = caixa.turno?.dataReferencia || "";
    const t = caixa.totais;
    
    const entradas = [...caixa.transacoes].filter(i => i.categoria !== 'sangria' && i.categoria !== 'cancelamento').reverse();
    const saidas = [...caixa.transacoes].filter(i => i.categoria === 'sangria' || i.categoria === 'cancelamento').reverse();
    const fantasmasAtivos = (caixa.fantasmas || []);

    const catMap: any = {
      'dinheiro': 'Dinheiro',
      'entrada_prestacao': 'Entrada ',
      'compra_vista': 'À Vista ',
      'gar': 'GAR    ',
      'multiplo': 'Múltiplo',
      'sangria': 'Sangria ',
      'cancelamento': 'Estorno '
    };

    const formatItem = (item: any) => {
      const time = new Date(item.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const cat = catMap[item.categoria] || 'Outro   ';
      let extra = "";
      if (item.trocoSobra > 0) extra = ` *(+ ${toBrl(item.trocoSobra)} Sobra)*`;
      if (item.trocoSobra < 0) extra = ` *(- ${toBrl(Math.abs(item.trocoSobra))} Quebra)*`;
      return `  ${time} • ${cat} | ${toBrl(item.valorSistema)} - ${item.descricao || (item.codigoContrato ? 'Contrato' : 'Sem desc.')}${extra}`;
    };

    const listaEntradas = entradas.map(formatItem).join('\n');
    const listaSaidas = saidas.map(formatItem).join('\n');
    
    const listaFantasmas = fantasmasAtivos.map(f => {
      const status = f.resolvido ? '[CONCLUÍDO]' : '[PENDENTE] ';
      let tipoStr = '(Lembrete)';
      if (f.tipo === 'pix_recebido_gaveta_saiu') tipoStr = '(Pix por Notas)';
      if (f.tipo === 'destroca_pix_por_nota') tipoStr = '(Destroca Pix)';
      if (f.tipo === 'dinheiro_emprestado') tipoStr = '(Empréstimo/Destrocar)';
      return `  ${status} ${f.pessoa}: ${toBrl(f.valorReferencia)} ${tipoStr}`;
    }).join('\n');

    const msg = `━━━━━━━━━━━━━━━━━━━━\n` +
                `📊 *RELATÓRIO ANALÍTICO DE CAIXA*\n` +
                `━━━━━━━━━━━━━━━━━━━━\n` +
                `📅 **DATA:** ${data}\n` +
                `🆔 **CAIXA:** ${caixaId || '2701'}\n` +
                `━━━━━━━━━━━━━━━━━━━━\n\n` +
                `📥 **ENTRADAS (${entradas.length} Registros)**\n` +
                `${listaEntradas || '  └─ _Nenhum lançamento_'}\n\n` +
                `📤 **SAÍDAS / SANGRIAS (${saidas.length} Registros)**\n` +
                `${listaSaidas || '  └─ _Nenhuma saída_'}\n\n` +
                `━━━━━━━━━━━━━━━━━━━━\n\n` +
                `👻 **MOVIMENTAÇÃO INFORMAL (Controle Pix / Espécie)**\n` +
                `${listaFantasmas || '  └─ _Nenhum ajuste registrado_'}\n\n` +
                `━━━━━━━━━━━━━━━━━━━━\n\n` +
                `⚖️ **BALANÇO FINAL DE GAVETA**\n` +
                `  ▪️ TOTAL SISTEMA:   ${toBrl(t.sistema)}\n` +
                `  ▪️ SOBRA ACUMULADA: ${toBrl(t.sobra)}\n` +
                `  ▪️ GAVETA FÍSICA:   ${toBrl(t.gavetaFisico)}\n\n` +
                `📩 **FECHAMENTO DE MALOTE EXATOS**\n` +
                `  💵 DINHEIRO (NO SACO): ${toBrl(t.especieEnvelope)}\n` +
                `  📱 TRANSFERIR PIX:     ${toBrl(t.pixRepasse)}\n\n` +
                `━━━━━━━━━━━━━━━━━━━━\n` +
                `🐿️`;

    try {
      await Share.share({ message: msg });
    } catch (error) {
      console.log(error);
    }
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
            <HistoricoScreen turnos={caixa.historicoTurnos} loading={caixa.loading} onRefresh={caixa.carregarHistoricoTurnos} onOpen={(turnoId) => void caixa.abrirTurnoPorId(turnoId)} onExcluirDia={(id) => mostrarAlerta("APAGAR DIA", "Deseja deletar?", () => caixa.excluirTurno(id), true)} />
          </View>
        ) : (
          <TurnoScreen loading={caixa.loading} error={caixa.error} onNovoDia={caixa.iniciarNovoDia} onContinuar={caixa.continuarDiaAnterior} onVerHistorico={() => changeSection("historico")} />
        )}
      </SafeAreaView>
    );
  }

  const mainSections: { key: SectionKey; label: string; icon: any }[] = [
    { key: "painel", label: "Painel", icon: LayoutDashboard },
    { key: "transacoes", label: "Lançar", icon: PlusCircle },
    { key: "checklist", label: "Check", icon: CheckSquare },
    { key: "devendo", label: "Dívida", icon: UserMinus },
    { key: "fantasmas", label: "Notas", icon: Ghost },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <Modal visible={customAlert.visible} transparent animationType="fade">
        <View className="flex-1 bg-black/90 items-center justify-center p-6">
          <View className="w-full max-w-[380px] rounded-[40px] border border-zinc-800 bg-ink-900 p-8 items-center shadow-2xl">
            <View className={`h-16 w-16 items-center justify-center rounded-3xl mb-6 ${customAlert.destructive ? 'bg-red-500/10' : 'bg-emerald-500/10'}`}>
              {customAlert.destructive ? <ShieldAlert size={32} color="#f87171" /> : <AlertCircle size={32} color="#34d399" />}
            </View>
            <Text className="text-xl font-black text-white uppercase tracking-[2px] mb-3 text-center">{customAlert.title}</Text>
            <Text className="text-sm font-bold text-zinc-500 uppercase text-center leading-5 mb-8">{customAlert.message}</Text>
            <View className="flex-row gap-3 w-full">
              <Pressable onPress={() => setCustomAlert(prev => ({ ...prev, visible: false }))} className="flex-1 py-5 rounded-[24px] bg-zinc-800"><Text className="text-center font-black text-zinc-400 uppercase text-[10px]">Sair</Text></Pressable>
              <Pressable onPress={() => { customAlert.onConfirm(); setCustomAlert(prev => ({ ...prev, visible: false })); }} className={`flex-[1.5] py-5 rounded-[24px] ${customAlert.destructive ? 'bg-red-500' : 'bg-zinc-100'}`}><Text className={`text-center font-black uppercase text-[10px] ${customAlert.destructive ? 'text-white' : 'text-zinc-950'}`}>Confirmar</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={modalMais} transparent animationType="slide">
        <Pressable className="flex-1 bg-black/60" onPress={() => setModalMais(false)}>
          <View className="mt-auto bg-ink-900 rounded-t-[40px] border-t border-zinc-800 p-8 shadow-2xl">
            <View className="w-12 h-1.5 bg-zinc-800 rounded-full mx-auto mb-8" />
            <Text className="text-xs font-black text-zinc-600 uppercase tracking-[4px] mb-6 text-center">Apoio Técnico</Text>
            <View className="gap-3">
              <Pressable onPress={() => { setModalMais(false); setModalNotas(true); }} className="flex-row items-center gap-4 bg-ink-800 p-6 rounded-[24px] border border-zinc-800">
                <Banknote size={20} color="#a78bfa" /><Text className="text-zinc-100 font-black uppercase tracking-widest text-xs">Contador de Notas</Text>
              </Pressable>
              <Pressable onPress={() => { setModalMais(false); setModalConfig(true); }} className="flex-row items-center gap-4 bg-ink-800 p-6 rounded-[24px] border border-zinc-800">
                <Settings size={20} color="#71717a" /><Text className="text-zinc-100 font-black uppercase tracking-widest text-xs">ID do Caixa/Operador</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={modalNotas} transparent animationType="fade">
        <View className="flex-1 bg-black/95 p-6">
          <SafeAreaView className="flex-1">
            <View className="flex-row items-center justify-between mb-8"><Text className="text-2xl font-black text-white uppercase tracking-widest">Contador</Text><X color="#fff" onPress={() => setModalNotas(false)} /></View>
            <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
              <View className="gap-4 mb-10">
                {[100, 50, 20, 10, 5, 2].map(val => (
                  <View key={val} className="flex-row items-center gap-4 bg-ink-900 p-4 rounded-[24px] border border-zinc-800">
                    <View className="w-16 h-12 bg-zinc-100 rounded-xl items-center justify-center"><Text className="font-black text-zinc-950">{val}</Text></View>
                    <TextInput keyboardType="numeric" placeholder="0" placeholderTextColor="#3f3f46" className="flex-1 text-2xl font-black text-white text-right" value={String(cedulas[`n${val}` as keyof typeof cedulas] || "")} onChangeText={(t) => setCedulas(prev => ({ ...prev, [`n${val}`]: parseInt(t) || 0 }))} />
                  </View>
                ))}
                <View className="bg-ink-900 p-6 rounded-[24px] border border-zinc-800">
                  <Text className="text-[10px] font-black text-zinc-600 uppercase mb-2">Moedas e Quebrados</Text>
                  <MoneyInput value={cedulas.moedas} onChangeValue={(v) => setCedulas(prev => ({ ...prev, moedas: v }))} className="text-3xl font-black text-white" />
                </View>
              </View>
            </ScrollView>
            <View className="bg-ink-900 p-8 rounded-[40px] border border-zinc-800 shadow-2xl">
              <Text className="text-center text-[10px] font-black text-zinc-600 uppercase mb-2">Total Contado</Text>
              <Text className={`text-center text-4xl font-black mb-6 ${totalEmNotas === caixa.totais.gavetaFisico ? 'text-emerald-400' : 'text-zinc-100'}`}>{toBrl(totalEmNotas)}</Text>
              <Pressable onPress={async () => { await caixa.salvarContagem(cedulas); setModalNotas(false); }} className="bg-zinc-100 py-6 rounded-[24px] shadow-xl"><Text className="text-center font-black uppercase text-zinc-950">Salvar Contagem</Text></Pressable>
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      <Modal visible={modalConfig} transparent animationType="fade">
        <View className="flex-1 bg-black/90 items-center justify-center p-6">
          <View className="w-full max-w-[380px] bg-ink-900 border border-zinc-800 rounded-[40px] p-8 shadow-2xl">
            <Text className="text-xl font-black text-white uppercase mb-6 text-center">Identificação</Text>
            <Text className="text-[10px] font-black text-zinc-600 uppercase mb-2 ml-2">ID do Caixa</Text>
            <TextInput value={caixaId} onChangeText={setCaixaId} placeholder="2701" placeholderTextColor="#3f3f46" className="bg-ink-800 p-5 rounded-2xl text-white font-black mb-4 border border-zinc-800" />
            <Text className="text-[10px] font-black text-zinc-600 uppercase mb-2 ml-2">ID do Operador</Text>
            <TextInput value={operadorId} onChangeText={setOperadorId} placeholder="1306" placeholderTextColor="#3f3f46" className="bg-ink-800 p-5 rounded-2xl text-white font-black mb-8 border border-zinc-800" />
            <Pressable onPress={async () => { await caixa.salvarIDs(caixaId, operadorId); setModalConfig(false); }} className="bg-zinc-100 py-5 rounded-2xl shadow-xl"><Text className="text-center font-black uppercase text-zinc-950">Salvar Dados</Text></Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={modalFechamento} transparent animationType="slide">
        <View className="flex-1 bg-black/90 items-center justify-center p-6">
          <View className="w-full max-w-[400px] rounded-[40px] border border-zinc-800 bg-ink-900 p-8 shadow-2xl">
            <View className="flex-row items-center justify-between mb-6"><Text className="text-xl font-black text-white uppercase tracking-widest">Auditoria Final</Text><X size={20} color="#71717a" onPress={() => setModalFechamento(false)} /></View>
            <Text className="text-[10px] font-black text-zinc-500 uppercase tracking-[2px] mb-4 text-center">O Caixa bateu com o Físico?</Text>
            <View className="flex-row gap-4 mb-8">
              <Pressable onPress={() => setBateu(true)} className={`flex-1 flex-row items-center justify-center gap-2 py-5 rounded-[24px] border-2 ${bateu === true ? 'bg-emerald-500 border-emerald-500' : 'bg-ink-800 border-zinc-800'}`}><CheckCircle2 size={18} color={bateu === true ? "#064e3b" : "#71717a"} /><Text className={`font-black uppercase text-[10px] ${bateu === true ? 'text-emerald-950' : 'text-zinc-500'}`}>Sim</Text></Pressable>
              <Pressable onPress={() => setBateu(false)} className={`flex-1 flex-row items-center justify-center gap-2 py-5 rounded-[24px] border-2 ${bateu === false ? 'bg-red-500 border-red-500' : 'bg-ink-800 border-zinc-800'}`}><AlertTriangle size={18} color={bateu === false ? "#450a0a" : "#71717a"} /><Text className={`font-black uppercase text-[10px] ${bateu === false ? 'text-red-950' : 'text-zinc-500'}`}>Não</Text></Pressable>
            </View>
            {bateu === false && <TextInput multiline value={obs} onChangeText={setObs} className="rounded-[24px] border border-zinc-800 bg-ink-800 p-6 text-zinc-200 font-bold mb-8" placeholder="O que deu erro?" placeholderTextColor="#3f3f46" />}
            <Pressable disabled={bateu === null} onPress={iniciarFechamento} className={`rounded-[24px] py-6 shadow-2xl ${bateu !== null ? 'bg-zinc-100' : 'bg-zinc-800 opacity-50'}`}><Text className="text-center font-black uppercase tracking-[4px] text-zinc-950">Confirmar</Text></Pressable>
          </View>
        </View>
      </Modal>

      <View className="border-b border-zinc-900 bg-ink-950 px-4 pb-4 pt-2">
        <View className="mx-auto flex w-full max-w-[460px] flex-row items-center justify-between">
          <View>
            <Pressable onLongPress={() => alert("SQUIL AUDIT: "+caixa.transacoes.length+" itens ativos.")} delayLongPress={5000}><Text className="text-lg font-black text-zinc-100 uppercase tracking-tighter">CAIXA</Text></Pressable>
            <Text className="text-[10px] font-black uppercase tracking-[2px] text-zinc-600">{caixa.turno.dataReferencia} • {caixaId || 'S/C'}</Text>
          </View>
          <View className="flex-row gap-2">
            <Pressable className="h-10 w-10 items-center justify-center rounded-2xl border border-zinc-800 bg-ink-900 active:bg-zinc-800" onPress={gerarRelatorio}><Share2 size={18} color="#a78bfa" /></Pressable>
            <Pressable className="h-10 w-10 items-center justify-center rounded-2xl border border-zinc-800 bg-ink-900 active:bg-zinc-800" onPress={() => changeSection("historico")}><CalendarDays size={18} color="#71717a" /></Pressable>
            {isFechado ? (
              <Pressable onLongPress={() => handleReabrir()} delayLongPress={2000} className="h-10 w-10 items-center justify-center rounded-2xl border border-red-500/30 bg-red-500/10"><Lock size={18} color="#f87171" /></Pressable>
            ) : (
              <Pressable onPress={() => setModalFechamento(true)} className="h-10 w-10 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10"><Unlock size={18} color="#34d399" /></Pressable>
            )}
            <Pressable className="h-10 w-10 items-center justify-center rounded-2xl border border-zinc-800 bg-ink-900 active:bg-zinc-800" onPress={() => setModalMais(true)}><MoreHorizontal size={18} color="#71717a" /></Pressable>
          </View>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="always">
        <View className="mx-auto w-full max-w-[460px]">
          {section === "painel" && (
            <PainelScreen 
              totais={caixa.totais} 
              fantasmas={caixa.fantasmas || []} 
              ajusteManualSobra={caixa.turno.ajusteManualSobra} 
              onAjusteSobra={caixa.definirAjusteSobra}
              isFechado={isFechado} 
            />
          )}
          {section === "transacoes" && <TransacoesScreen transacoes={caixa.transacoes} onAdicionar={caixa.criarTransacao} onExcluir={(id) => mostrarAlerta("EXCLUIR", "Apagar?", () => caixa.excluirTransacao(id), true)} onEditar={caixa.editarLançamento} isFechado={isFechado} />}
          {section === "checklist" && <ChecklistScreen transacoes={caixa.transacoes} onToggle={caixa.alternarConferencia} isFechado={isFechado} />}
          {section === "devendo" && <DevendoScreen dividas={caixa.dividas || []} onCriar={caixa.criarDivida} onExcluir={(id) => mostrarAlerta("REMOVER", "Apagar dívida?", () => caixa.excluirDivida(id), true)} onToggle={caixa.alternarDividaStatus} isFechado={isFechado} />}
          {section === "fantasmas" && <FantasmasScreen fantasmas={caixa.fantasmas || []} onCriar={caixa.criarFantasma} onToggleResolvido={caixa.alternarFantasmaResolvido} onToggleComprovado={caixa.alternarFantasmaComprovado} onExcluir={(id) => mostrarAlerta("EXCLUIR", "Remover?", () => caixa.excluirFantasma(id), true)} isFechado={isFechado} />}
          {section === "historico" && <HistoricoScreen turnos={caixa.historicoTurnos} loading={caixa.loading} onRefresh={caixa.carregarHistoricoTurnos} onOpen={(turnoId) => void caixa.abrirTurnoPorId(turnoId)} onExcluirDia={(id) => mostrarAlerta("APAGAR DIA", "Deseja deletar?", () => caixa.excluirTurno(id), true)} />}
        </View>
      </ScrollView>

      <View style={styles.navContainer} pointerEvents="box-none">
        <View style={styles.navInner}>
          {mainSections.map((s) => {
            const active = section === s.key;
            const Icon = s.icon;
            return (
              <Pressable 
                key={s.key} 
                style={[styles.navButton, active && styles.navButtonActive]} 
                onPress={() => setSection(s.key)}
                hitSlop={10}
              >
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
  navContainer: { position: 'absolute', bottom: Platform.OS === 'android' ? 24 : 34, left: 0, right: 0, alignItems: 'center', paddingHorizontal: 8, zIndex: 999 },
  navInner: { flexDirection: 'row', gap: 2, borderRadius: 32, borderWidth: 1, borderColor: '#27272a', backgroundColor: '#18181b', padding: 4, elevation: 10 },
  navButton: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 24, paddingHorizontal: 10, paddingVertical: 10 },
  navButtonActive: { backgroundColor: '#f4f4f5' },
  navLabel: { fontSize: 8, fontWeight: '900', color: '#09090b', textTransform: 'uppercase' }
});
