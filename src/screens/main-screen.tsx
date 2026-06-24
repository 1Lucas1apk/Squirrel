import { useMemo, useState, useEffect, useRef } from "react";
import { Pressable, ScrollView, Text, View, Platform, StyleSheet, Share, Modal, TextInput, Switch, Animated, Easing } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

import { useCaixaSeguro } from "../hooks/use-caixa-seguro";
import { ChecklistScreen } from "./checklist-screen";
import { FantasmasScreen } from "./fantasmas-screen";
import { HistoricoScreen } from "./historico-screen";
import { PainelScreen } from "./painel-screen";
import { TransacoesScreen } from "./transacoes-screen";
import { TurnoScreen } from "./turno-screen";
import { CreditsScreen } from "./credits-screen";
import { RetrospectiveScreen } from "./retrospective-screen";
import { AnalyticsModal } from "./analytics-modal";
import { toBrl } from "../utils/currency";

import { RefreshCw, LayoutDashboard, PlusCircle, CheckSquare, Ghost, History, Share2, Lock, Unlock, CheckCircle2, AlertTriangle, X, AlertCircle, ShieldAlert, MoreHorizontal, Settings, CalendarDays, LogOut, Cloud, CloudOff, Zap, Sparkles, Info, ShieldCheck, Activity } from "lucide-react-native";
import { getDatabase, ref, onValue } from "firebase/database";
import { getFirebaseApp } from "../services/firebase/client";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useAuth } from "../hooks/use-auth";
import { useAppSettings, HapticIntensity } from "../hooks/use-app-settings";

import * as Haptics from 'expo-haptics';
import { scheduleDailyReminders } from "../services/notifications";

import { Skeleton } from "../components/common/skeleton";
import { registrarLogAlteracao, atualizarStatusTurno } from "../services/repositories/caixa-repository";
import { syncManager } from "../services/sync-manager";
import { getOfflineQueue, loadCurrentShiftCache } from "../services/local-storage";

type SectionKey = "painel" | "transacoes" | "checklist" | "fantasmas" | "historico";

export function MainScreen() {
  const { logout } = useAuth();
  const { settings, updateSettings, loading: settingsLoading } = useAppSettings();
  const caixa = useCaixaSeguro();

  const [section, setSection] = useState<SectionKey>("painel");
  const [isDiscreto, setIsDiscreto] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncPendingCount, setSyncPendingCount] = useState(0);
  const [syncError, setSyncError] = useState<string | null>(null);
  const spinValue = useRef(new Animated.Value(0)).current;

  // Monitor de Estado de Sincronização
  useEffect(() => {
    const unsub = syncManager.subscribe(setIsSyncing);
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = syncManager.subscribeStatus((status) => {
      setSyncPendingCount(status.pendingCount);
      setSyncError(status.lastError);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (isSyncing) {
      Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    } else {
      spinValue.setValue(0);
    }
  }, [isSyncing]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const [modalFechamento, setModalFechamento] = useState(false);
  const [modalMais, setModalMais] = useState(false);
  const [modalConfig, setModalConfig] = useState(false);
  const [modalPreferencias, setModalPreferencias] = useState(false);
  const [modalCreditos, setModalCreditos] = useState(false);
  const [modalRetrospectiva, setModalRetrospectiva] = useState(false);
  const [modalAnalytics, setModalAnalytics] = useState(false);
  const [modalConflitos, setModalConflitos] = useState(false);
  
  const [bateu, setBateu] = useState<boolean | null>(null);
  const [obs, setObs] = useState("");

  const [caixaId, setCaixaId] = useState("");
  const [operadorId, setOperadorId] = useState("");

  // Memorização de IDs
  useEffect(() => {
    async function loadLastIds() {
      if (!caixa.turno && !caixa.loading) {
        const lastCx = await AsyncStorage.getItem("@squirrel_last_caixa_id");
        const lastOp = await AsyncStorage.getItem("@squirrel_last_operador_id");
        if (lastCx) setCaixaId(lastCx);
        if (lastOp) setOperadorId(lastOp);
      }
    }
    loadLastIds();
  }, [caixa.turno === null]);

  const [customAlert, setCustomAlert] = useState<{
    visible: boolean; title: string; message: string; onConfirm: () => void; destructive?: boolean;
  }>({ visible: false, title: "", message: "", onConfirm: () => {} });
  
  const isFechado = caixa.turno?.statusTurno === "fechado";

  const triggerHaptic = (type: "light" | "medium" | "heavy" | "success") => {
    if (!settings.hapticsEnabled) return;

    if (type === "success") {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return;
    }

    const intensityMap = {
      light: Haptics.ImpactFeedbackStyle.Light,
      medium: Haptics.ImpactFeedbackStyle.Medium,
      heavy: Haptics.ImpactFeedbackStyle.Heavy,
    };

    const style = type === "light" ? intensityMap[settings.hapticIntensity] : (intensityMap[type as keyof typeof intensityMap] || intensityMap.light);
    void Haptics.impactAsync(style);
  };

  const handleEditComLog = async (id: string, input: any) => {
    const original = caixa.transacoes.find(t => t.id === id);
    if (original && original.valorSistema !== input.valorSistema) {
      await caixa.registrarLog(id, {
        valorAntigo: original.valorSistema,
        valorNovo: input.valorSistema,
        campoAlterado: "valorSistema",
        motivo: "Edição manual pelo operador"
      });
    }
    await caixa.editarLançamento(id, input);
  };

  // Função para salvar e reagendar notificações
  const saveAndSchedule = async (newSettings: any) => {
    await updateSettings(newSettings);
    const updated = { ...settings, ...newSettings };
    const hasPending = (caixa.fantasmas || []).some(f => !f.resolvido);
    await scheduleDailyReminders(updated.fechamentoSemana, updated.fechamentoSabado, hasPending);
  };

  // Monitora as Notas Fantasmas para atualizar as notificações
  useEffect(() => {
    if (!settings.fechamentoSemana) return;
    const hasPending = (caixa.fantasmas || []).some(f => !f.resolvido);
    void scheduleDailyReminders(settings.fechamentoSemana, settings.fechamentoSabado, hasPending);
  }, [(caixa.fantasmas || []).length, (caixa.fantasmas || []).filter(f => !f.resolvido).length]);

  // Monitor de Conexão Offline
  useEffect(() => {
    const db = getDatabase(getFirebaseApp());
    const connectedRef = ref(db, ".info/connected");
    const unsub = onValue(connectedRef, (snap) => {
      const connected = !!snap.val();
      setIsOnline(connected);
      if (connected) {
        // Quando volta a conectar, tenta sincronizar o que ficou pendente
        void syncManager.processQueue();
      }
    });
    return () => unsub();
  }, []);

  const mainSections: { key: SectionKey; label: string; icon: any }[] = useMemo(() => {
    const sections: { key: SectionKey; label: string; icon: any }[] = [
      { key: "painel", label: "Painel", icon: LayoutDashboard },
      { key: "transacoes", label: "Lançar", icon: PlusCircle },
      { key: "checklist", label: "Check", icon: CheckSquare },
    ];

    if (!isDiscreto) {
      sections.push({ key: "fantasmas", label: "Notas", icon: Ghost });
    }

    return sections;
  }, [isDiscreto]);

  // Sistema de Notificação de Pendências ao Abrir
  useEffect(() => {
    if (caixa.turno && !caixa.loading) {
      const pendenciasF = (caixa.fantasmas || []).filter(f => !f.resolvido);

      if (pendenciasF.length > 0) {
        const detalhesF = pendenciasF.map(f => `• ${f.pessoa}: ${toBrl(f.valorReferencia)}`).join('\n');
        
        const msg = `⚠️ Existem movimentações informais pendentes:\n\n${detalhesF}\n\nPor favor, não esqueça de resolvê-las!`;

        setTimeout(() => {
          setCustomAlert({
            visible: true,
            title: "NOTIFICAÇÃO DE CAIXA",
            message: msg,
            onConfirm: () => {},
          });
        }, 1500);
      }
    }
  }, [caixa.turno?.id, caixa.loading]);

  useEffect(() => {
    if (caixa.turno) {
      setCaixaId(caixa.turno.caixaId || "");
      setOperadorId(caixa.turno.operadorId || "");
    }
  }, [caixa.turno?.id]);

  const mostrarAlerta = (title: string, message: string, onConfirm: () => void, destructive = false) => {
    setCustomAlert({ visible: true, title, message, onConfirm, destructive });
  };

  const changeSection = async (next: SectionKey) => {
    triggerHaptic("light");
    setSection(next);
    if (next === "historico") await caixa.carregarHistoricoTurnos();
  };

  const iniciarFechamento = () => {
    if (bateu === null) return;
    
    // Verifica se existem notas informais pendentes
    const pendenciasF = (caixa.fantasmas || []).filter(f => !f.resolvido);
    const totalPendencia = pendenciasF.reduce((acc, f) => acc + f.valorReferencia, 0);

    if (totalPendencia > 0) {
      mostrarAlerta(
        "NOTAS PENDENTES", 
        `Você ainda tem ${toBrl(totalPendencia)} em movimentações não resolvidas. Deseja fechar assim mesmo?`, 
        async () => {
          setModalFechamento(false);
          await caixa.fecharTurno();
          await atualizarStatusTurno(caixa.turno!.id, "fechado", { 
            bateuFisico: bateu === true, 
            observacoes: obs.trim() 
          });
          setBateu(null);
          setObs("");
        }
      );
      return;
    }

    setModalFechamento(false);
    setTimeout(() => {
      mostrarAlerta("ENCERRAR DIA", "Deseja realmente fechar o caixa agora? As edições serão travadas.", async () => {
        await caixa.fecharTurno();
        await atualizarStatusTurno(caixa.turno!.id, "fechado", { 
          bateuFisico: bateu === true, 
          observacoes: obs.trim() 
        });

        if (caixa.totais.sobra === 0) {
          triggerHaptic("success");
        }

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
      const time = new Date(item.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const cat = catMap[item.categoria] || 'Outro   ';
      let extra = "";
      if (item.trocoSobra > 0) extra = ` *(+ ${toBrl(item.trocoSobra)} Sobra)*`;
      if (item.trocoSobra < 0) extra = ` *(- ${toBrl(Math.abs(item.trocoSobra))} Quebra)*`;
      
      let auditoria = "";
      if (item.statusConferencia === "incorreto") {
        auditoria = `\n      ⚠️ ERRO: Pago ${toBrl(item.valorRecebidoFisico)} (Obs: ${item.justificativaTexto || 'Sem nota'})`;
      }

      return `  ${time} • ${cat} | ${toBrl(item.valorSistema)} - ${item.descricao || (item.codigoContrato ? 'Contrato' : 'Sem desc.')}${extra}${auditoria}`;
    };

    const listaEntradas = entradas.map(formatItem).join('\n');
    const listaSaidas = saidas.map(formatItem).join('\n');
    
    const listaFantasmas = fantasmasAtivos.map(f => {
      const status = f.resolvido ? '[CONCLUÍDO]' : '[PENDENTE] ';
      let tipoStr = '(Lembrete)';
      if (f.tipo === 'pix_recebido_gaveta_saiu') tipoStr = '(Pix por Notas)';
      if (f.tipo === 'destroca_pix_por_nota') tipoStr = '(Destroca Pix)';
      if (f.tipo === 'dinheiro_emprestado') tipoStr = '(Empréstimo/Destrocar)';
      
      const refStr = f.transacaoVinculadaId ? ` [Ref]` : '';
      const destStr = (f.destinoPix && f.destinoPix !== "Meu Pix" && f.destinoPix !== "Operador") ? ` (Dest: ${f.destinoPix})` : '';

      return `  ${status} ${f.pessoa}: ${toBrl(f.valorReferencia)} ${tipoStr}${refStr}${destStr}`;
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

  async function exportarBackupLocal() {
    try {
      const cache = await loadCurrentShiftCache();
      const queue = await getOfflineQueue();
      const payload = {
        exportedAt: new Date().toISOString(),
        turno: cache.turno,
        transacoes: cache.transacoes,
        fantasmas: cache.fantasmas,
        logs: cache.logs,
        queue,
      };
      const fileUri = `${FileSystem.cacheDirectory}squirrel-backup-${Date.now()}.json`;
      await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(payload, null, 2), {
        encoding: FileSystem.EncodingType.UTF8,
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: "application/json",
          dialogTitle: "Exportar backup local do Squirrel",
        });
      } else {
        await Share.share({ message: JSON.stringify(payload) });
      }
    } catch (e) {
      mostrarAlerta("ERRO DE BACKUP", "Não foi possível exportar o backup local.", () => {});
    }
  }

  async function compartilharDiagnostico() {
    const queue = await getOfflineQueue();
    const diagnostico = [
      `Timestamp: ${new Date().toISOString()}`,
      `Online: ${isOnline}`,
      `Sincronizando: ${isSyncing}`,
      `Pendências de Sync: ${syncPendingCount}`,
      `Erro Sync: ${syncError ?? "nenhum"}`,
      `Conflitos: ${caixa.syncConflicts.length}`,
      `Turno atual: ${caixa.turno?.id ?? "nenhum"}`,
      `Transações locais: ${caixa.transacoes.length}`,
      `Fantasmas locais: ${caixa.fantasmas.length}`,
      `Fila offline: ${queue.length}`,
    ].join("\n");
    await Share.share({ message: diagnostico });
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* MODAIS GLOBAIS - Disponíveis em todo o app */}
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
        <View className="flex-1 bg-black/60">
          <Pressable className="flex-1" onPress={() => setModalMais(false)} />
          <View className="max-h-[82%] bg-ink-900 rounded-t-[40px] border-t border-zinc-800 p-8 shadow-2xl">
            <View className="w-12 h-1.5 bg-zinc-800 rounded-full mx-auto mb-8" />
            <Text className="text-xs font-black text-zinc-600 uppercase tracking-[4px] mb-6 text-center">Apoio Técnico</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View className="gap-3 pb-2">
              <Pressable onPress={() => { setModalMais(false); setModalRetrospectiva(true); }} className="flex-row items-center gap-4 bg-ink-800 p-6 rounded-[24px] border border-zinc-800">
                <Sparkles size={20} color="#facc15" /><Text className="text-zinc-100 font-black uppercase tracking-widest text-xs">Você Sabia? (Retrospectiva)</Text>
              </Pressable>
              <Pressable onPress={() => { setModalMais(false); setModalAnalytics(true); }} className="flex-row items-center gap-4 bg-ink-800 p-6 rounded-[24px] border border-zinc-800">
                <Activity size={20} color="#60a5fa" /><Text className="text-zinc-100 font-black uppercase tracking-widest text-xs">Mapa de Movimentação</Text>
              </Pressable>
              <Pressable onPress={() => { setModalMais(false); void syncManager.processQueue(); }} className="flex-row items-center gap-4 bg-ink-800 p-6 rounded-[24px] border border-zinc-800">
                <RefreshCw size={20} color="#60a5fa" /><Text className="text-zinc-100 font-black uppercase tracking-widest text-xs">Forçar Sincronização</Text>
              </Pressable>
              <Pressable onPress={() => { setModalMais(false); void exportarBackupLocal(); }} className="flex-row items-center gap-4 bg-ink-800 p-6 rounded-[24px] border border-zinc-800">
                <Share2 size={20} color="#34d399" /><Text className="text-zinc-100 font-black uppercase tracking-widest text-xs">Exportar Backup Local</Text>
              </Pressable>
              <Pressable onPress={() => { setModalMais(false); void compartilharDiagnostico(); }} className="flex-row items-center gap-4 bg-ink-800 p-6 rounded-[24px] border border-zinc-800">
                <Info size={20} color="#60a5fa" /><Text className="text-zinc-100 font-black uppercase tracking-widest text-xs">Compartilhar Diagnóstico</Text>
              </Pressable>
              {caixa.syncConflicts.length > 0 && (
                <Pressable onPress={() => { setModalMais(false); setModalConflitos(true); }} className="flex-row items-center gap-4 bg-amber-500/10 p-6 rounded-[24px] border border-amber-500/30">
                  <AlertTriangle size={20} color="#facc15" /><Text className="text-amber-300 font-black uppercase tracking-widest text-xs">Resolver Conflitos ({caixa.syncConflicts.length})</Text>
                </Pressable>
              )}
              <Pressable onPress={() => { setModalMais(false); mostrarAlerta("SAIR DO DIA", "Deseja voltar para a tela inicial? O dia continuará aberto para edições depois.", () => caixa.sairDoDia()); }} className="flex-row items-center gap-4 bg-ink-800 p-6 rounded-[24px] border border-zinc-800">
                <LogOut size={20} color="#f87171" /><Text className="text-zinc-100 font-black uppercase tracking-widest text-xs">Sair deste Dia</Text>
              </Pressable>
              <View className="h-px bg-zinc-800 my-2" />
              <Pressable onPress={() => { setModalMais(false); setModalConfig(true); }} className="flex-row items-center gap-4 bg-ink-800 p-6 rounded-[24px] border border-zinc-800">
                <Settings size={20} color="#71717a" /><Text className="text-zinc-100 font-black uppercase tracking-widest text-xs">ID do Caixa/Operador</Text>
              </Pressable>
              <Pressable onPress={() => { setModalMais(false); setModalPreferencias(true); }} className="flex-row items-center gap-4 bg-ink-800 p-6 rounded-[24px] border border-zinc-800">
                <Zap size={20} color="#a78bfa" /><Text className="text-zinc-100 font-black uppercase tracking-widest text-xs">Configurações do App</Text>
              </Pressable>
              <Pressable onPress={() => { setModalMais(false); setModalCreditos(true); }} className="flex-row items-center gap-4 bg-ink-800 p-6 rounded-[24px] border border-zinc-800">
                <Info size={20} color="#60a5fa" /><Text className="text-zinc-100 font-black uppercase tracking-widest text-xs">Créditos</Text>
              </Pressable>
              <Pressable onPress={() => { setModalMais(false); logout(); }} className="flex-row items-center gap-4 bg-red-500/10 p-6 rounded-[24px] border border-red-500/20">
                <LogOut size={20} color="#f87171" /><Text className="text-red-400 font-black uppercase tracking-widest text-xs">Sair da Conta</Text>
              </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {modalCreditos && <CreditsScreen onClose={() => setModalCreditos(false)} />}
      {caixa.turno && (
        <AnalyticsModal 
          visible={modalAnalytics} 
          onClose={() => setModalAnalytics(false)} 
          transacoes={caixa.transacoes}
          totais={caixa.totais}
        />
      )}
      {modalRetrospectiva && (
        <RetrospectiveScreen 
          turnos={caixa.historicoTurnos} 
          onClose={() => setModalRetrospectiva(false)} 
        />
      )}
      <Modal visible={modalConflitos} transparent animationType="fade">
        <View className="flex-1 bg-black/90 items-center justify-center p-6">
          <View className="w-full max-w-[420px] bg-ink-900 border border-zinc-800 rounded-[32px] p-6">
            <Text className="text-sm font-black text-white uppercase tracking-widest mb-4">Conflitos de sincronização</Text>
            <ScrollView className="max-h-[360px]" showsVerticalScrollIndicator={false}>
              <View className="gap-3">
                {caixa.syncConflicts.map((conflict) => (
                  <View key={conflict.actionId} className="rounded-2xl border border-zinc-800 bg-ink-800 p-4">
                    <Text className="text-[10px] font-black text-zinc-200 uppercase tracking-wider mb-2">
                      {conflict.entityType} • {conflict.entityId}
                    </Text>
                    <Text className="text-[10px] font-bold text-zinc-500 uppercase mb-3">{conflict.reason}</Text>
                    {conflict.remoteData && conflict.localData && (
                      <View className="mb-4 bg-ink-950 p-4 rounded-2xl border border-zinc-800">
                        <View className="flex-row justify-between mb-3 pb-3 border-b border-zinc-800/50">
                          <Text className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Nuvem diz:</Text>
                          <Text className="text-xs font-bold text-zinc-300">
                            {toBrl(conflict.remoteData.valorSistema ?? conflict.remoteData.valorReferencia ?? 0)}
                          </Text>
                        </View>
                        <View className="flex-row justify-between">
                          <Text className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Seu app diz:</Text>
                          <Text className="text-xs font-bold text-emerald-300">
                            {toBrl(conflict.localData.valorSistema ?? conflict.localData.valorReferencia ?? 0)}
                          </Text>
                        </View>
                      </View>
                    )}
                    <View className="flex-row gap-2">
                      <Pressable
                        onPress={() => void caixa.resolverConflito(conflict.actionId, "keep-remote")}
                        className="flex-1 rounded-xl border border-zinc-700 bg-zinc-900 py-3"
                      >
                        <Text className="text-center text-[10px] font-black uppercase text-zinc-300">Manter remoto</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => void caixa.resolverConflito(conflict.actionId, "keep-local")}
                        className="flex-1 rounded-xl border border-emerald-500/40 bg-emerald-500/10 py-3"
                      >
                        <Text className="text-center text-[10px] font-black uppercase text-emerald-300">Aplicar local</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            </ScrollView>
            <Pressable onPress={() => setModalConflitos(false)} className="mt-4 rounded-2xl bg-zinc-100 py-4">
              <Text className="text-center font-black uppercase text-zinc-950">Fechar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={modalPreferencias} transparent animationType="fade">
        <View className="flex-1 bg-black/90 items-center justify-center p-6">
          <View className="w-full max-w-[380px] bg-ink-900 border border-zinc-800 rounded-[40px] p-8 shadow-2xl">
            <View className="flex-row items-center justify-between mb-8">
              <Text className="text-xl font-black text-white uppercase">Ajustes</Text>
              <Pressable onPress={() => setModalPreferencias(false)} hitSlop={12}>
                <X size={20} color="#71717a" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} overScrollMode="never">
              <View className="gap-8">
                {/* HORÁRIOS */}
                <View className="gap-4">
                  <Text className="text-[10px] font-black text-zinc-600 uppercase ml-1">Lembretes de Fechamento</Text>
                  
                  <View className="flex-row gap-3">
                    <View className="flex-1 gap-2">
                      <Text className="text-[8px] font-black text-zinc-500 uppercase ml-1">Seg a Sex</Text>
                      <TextInput 
                        value={settings.fechamentoSemana}
                        onChangeText={(v) => saveAndSchedule({ fechamentoSemana: v })}
                        placeholder="17:00"
                        placeholderTextColor="#3f3f46"
                        className="bg-ink-800 p-4 rounded-2xl text-white font-black border border-zinc-800 text-center"
                      />
                    </View>
                    <View className="flex-1 gap-2">
                      <Text className="text-[8px] font-black text-zinc-500 uppercase ml-1">Sábado</Text>
                      <TextInput 
                        value={settings.fechamentoSabado}
                        onChangeText={(v) => saveAndSchedule({ fechamentoSabado: v })}
                        placeholder="12:00"
                        placeholderTextColor="#3f3f46"
                        className="bg-ink-800 p-4 rounded-2xl text-white font-black border border-zinc-800 text-center"
                      />
                    </View>
                  </View>
                </View>

                {/* BIOMETRIA */}
                <View>
                  <View className="flex-row items-center justify-between mb-4">
                    <View className="flex-row items-center gap-3">
                      <ShieldCheck size={18} color="#34d399" />
                      <Text className="text-xs font-black text-zinc-100 uppercase">Segurança Biométrica</Text>
                    </View>
                    <Switch 
                      value={settings.biometricsEnabled}
                      onValueChange={(val) => updateSettings({ biometricsEnabled: val })}
                      trackColor={{ false: "#27272a", true: "#059669" }}
                      thumbColor={"#f4f4f5"}
                    />
                  </View>
                  <Text className="text-[10px] font-bold text-zinc-500 uppercase leading-4">
                    Pede digital ou FaceID ao abrir o app para proteger seus dados.
                  </Text>
                </View>

                {/* VIBRAÇÃO */}
                <View>
                  <View className="flex-row items-center justify-between mb-4">
                    <View className="flex-row items-center gap-3">
                      <Zap size={18} color="#a78bfa" />
                      <Text className="text-xs font-black text-zinc-100 uppercase">Vibrações (Haptic)</Text>
                    </View>
                    <Switch 
                      value={settings.hapticsEnabled}
                      onValueChange={(val) => updateSettings({ hapticsEnabled: val })}
                      trackColor={{ false: "#27272a", true: "#a78bfa" }}
                      thumbColor={"#f4f4f5"}
                    />
                  </View>
                  <Text className="text-[10px] font-bold text-zinc-500 uppercase leading-4">
                    Feedback físico ao tocar em botões e confirmar lançamentos.
                  </Text>
                </View>

                {/* MODO DE DIGITAÇÃO DE MOEDA */}
                <View>
                  <Text className="text-[10px] font-black text-zinc-600 uppercase mb-4 ml-1">Estilo de Digitação de Valores</Text>
                  <View className="flex-row gap-2">
                    {(['rtl', 'manual'] as const).map((mode) => {
                      const active = settings.moneyInputMode === mode;
                      return (
                        <Pressable 
                          key={mode} 
                          onPress={() => updateSettings({ moneyInputMode: mode })}
                          className={`flex-1 p-4 rounded-2xl border-2 items-center justify-center ${active ? 'bg-emerald-500/10 border-emerald-500' : 'bg-ink-800 border-zinc-800'}`}
                        >
                          <Text className={`text-[10px] font-black uppercase text-center ${active ? 'text-emerald-400' : 'text-zinc-500'}`}>
                            {mode === 'rtl' ? 'Nubank (Automático)' : 'Digitação Livre'}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <Text className="text-[10px] font-bold text-zinc-500 uppercase leading-4 mt-3 ml-1">
                    Automático preenche da direita pra esquerda. Livre permite colocar a vírgula onde quiser.
                  </Text>
                </View>

                {settings.hapticsEnabled && (
                  <View>
                    <Text className="text-[10px] font-black text-zinc-600 uppercase mb-4 ml-1">Intensidade do Toque</Text>
                    <View className="flex-row gap-2">
                      {(['light', 'medium', 'heavy'] as HapticIntensity[]).map((level) => {
                        const active = settings.hapticIntensity === level;
                        return (
                          <Pressable 
                            key={level} 
                            onPress={() => {
                              updateSettings({ hapticIntensity: level });
                              const intensityMap = {
                                light: Haptics.ImpactFeedbackStyle.Light,
                                medium: Haptics.ImpactFeedbackStyle.Medium,
                                heavy: Haptics.ImpactFeedbackStyle.Heavy,
                              };
                              void Haptics.impactAsync(intensityMap[level]);
                            }}
                            className={`flex-1 py-4 rounded-2xl border-2 items-center ${active ? 'bg-purple-500/10 border-purple-500' : 'bg-ink-800 border-zinc-800'}`}
                          >
                            <Text className={`text-[10px] font-black uppercase ${active ? 'text-purple-400' : 'text-zinc-500'}`}>
                              {level === 'light' ? 'Leve' : level === 'medium' ? 'Médio' : 'Forte'}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                )}
              </View>
            </ScrollView>

            <Pressable onPress={() => setModalPreferencias(false)} className="bg-zinc-100 py-5 rounded-2xl shadow-xl mt-8">
              <Text className="text-center font-black uppercase text-zinc-950">Fechar</Text>
            </Pressable>
          </View>
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
            <Pressable onPress={async () => { 
              await caixa.salvarIDs(caixaId, operadorId); 
              await AsyncStorage.setItem("@squirrel_last_caixa_id", caixaId);
              await AsyncStorage.setItem("@squirrel_last_operador_id", operadorId);
              setModalConfig(false); 
            }} className="bg-zinc-100 py-5 rounded-2xl shadow-xl"><Text className="text-center font-black uppercase text-zinc-950">Salvar Dados</Text></Pressable>
          </View>
        </View>
      </Modal>

      {/* CONTEÚDO DINÂMICO */}
      {!caixa.turno ? (
        <View className="flex-1">
          {section === "historico" ? (
            <View className="flex-1">
              <View className="mx-auto flex-1 w-full max-w-[460px]">
                <HistoricoScreen 
                  turnos={caixa.historicoTurnos} 
                  loading={caixa.loading} 
                  onRefresh={caixa.carregarHistoricoTurnos} 
                  onOpen={(turnoId) => void caixa.abrirTurnoPorId(turnoId)} 
                  onExcluirDia={(id) => mostrarAlerta("APAGAR DIA", "Deseja deletar?", () => caixa.excluirTurno(id), true)} 
                  onVoltar={() => setSection("painel")}
                />
              </View>
            </View>
          ) : (
            <TurnoScreen 
              loading={caixa.loading} 
              error={caixa.error} 
              onNovoDia={caixa.iniciarNovoDia} 
              onContinuar={caixa.continuarDiaAnterior} 
              onVerHistorico={() => changeSection("historico")} 
              onAbrirAjustes={() => setModalPreferencias(true)}
            />
          )}
        </View>
      ) : (
        <>
          <Modal visible={modalFechamento} transparent animationType="slide">
            <View className="flex-1 bg-black/90 items-center justify-center p-6">
              <View className="w-full max-w-[400px] rounded-[40px] border border-zinc-800 bg-ink-900 p-8 shadow-2xl">
                <View className="flex-row items-center justify-between mb-6">
                  <Text className="text-xl font-black text-white uppercase tracking-widest">Auditoria Final</Text>
                  <Pressable onPress={() => setModalFechamento(false)} hitSlop={12}>
                    <X size={20} color="#71717a" />
                  </Pressable>
                </View>
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
              <View className="flex-row items-center gap-2 flex-wrap flex-1 mr-2">
                <Pressable onPress={() => setIsDiscreto(!isDiscreto)}>
                  <Text className={`text-lg font-black uppercase tracking-tighter ${isDiscreto ? 'text-zinc-700' : 'text-zinc-100'}`}>CAIXA</Text>
                  <Text className="text-[10px] font-black uppercase tracking-[2px] text-zinc-600">{caixa.turno.dataReferencia} • {caixaId || 'S/C'}</Text>
                </Pressable>
                <View className={`h-6 min-w-6 px-1 items-center justify-center rounded-full ${isOnline ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                  {isOnline ? <Cloud size={12} color="#34d399" /> : <CloudOff size={12} color="#f87171" />}
                </View>
                {syncPendingCount > 0 && (
                  <View className="h-6 min-w-6 px-2 items-center justify-center rounded-full bg-amber-500/10 border border-amber-500/30">
                    <Text className="text-[9px] font-black text-amber-300">{syncPendingCount}</Text>
                  </View>
                )}
                {!!syncError && (
                  <Pressable onPress={caixa.limparErroSync} className="h-6 px-2 items-center justify-center rounded-full bg-red-500/10 border border-red-500/30">
                    <Text className="text-[9px] font-black text-red-300 uppercase">erro</Text>
                  </Pressable>
                )}
                {caixa.syncConflicts.length > 0 && (
                  <Pressable onPress={() => setModalConflitos(true)} className="h-6 px-2 items-center justify-center rounded-full bg-amber-500/10 border border-amber-500/30">
                    <Text className="text-[9px] font-black text-amber-300 uppercase">conflito</Text>
                  </Pressable>
                )}
              </View>
              <View className="flex-row gap-2 flex-shrink-0">
                {isSyncing && (
                  <Animated.View style={{ transform: [{ rotate: spin }] }} className="h-10 w-10 items-center justify-center">
                    <RefreshCw size={16} color="#60a5fa" />
                  </Animated.View>
                )}
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

          {section === "painel" ? (
            <ScrollView className="flex-1" contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View className="mx-auto w-full max-w-[460px]">
                {caixa.loading ? (
                   <View className="gap-6">
                     <Skeleton height={140} width="100%" />
                     <View className="flex-row gap-4">
                       <Skeleton height={100} width="100%" className="flex-1" />
                       <Skeleton height={100} width="100%" className="flex-1" />
                     </View>
                     <Skeleton height={200} width="100%" />
                   </View>
                ) : (
                  <PainelScreen 
                    totais={caixa.totais} 
                    fantasmas={caixa.fantasmas || []} 
                    transacoes={caixa.transacoes}
                    logs={caixa.logs}
                    notaDia={caixa.turno.notaDia}
                    onSaveNota={caixa.definirNotaDia}
                    ajusteManualSobra={caixa.turno.ajusteManualSobra} 
                    onAjusteSobra={caixa.definirAjusteSobra}
                    isFechado={isFechado} 
                    isDiscreto={isDiscreto}
                  />
                )}
              </View>
            </ScrollView>
          ) : (
            <View className="flex-1 px-4 pt-6">
              <View className="mx-auto w-full max-w-[460px] flex-1">
                {section === "transacoes" && (
                  <TransacoesScreen 
                    transacoes={caixa.transacoes} 
                    logs={caixa.logs} 
                    onAdicionar={caixa.criarTransacao} 
                    onExcluir={(id) => mostrarAlerta("EXCLUIR", "Apagar?", () => caixa.excluirTransacao(id), true)} 
                    onEditar={handleEditComLog} 
                    onConfirmar={mostrarAlerta}
                    isFechado={isFechado} 
                  />
                )}
                {section === "checklist" && (
                  <ChecklistScreen 
                    transacoes={caixa.transacoes} 
                    fantasmas={caixa.fantasmas || []}
                    logs={caixa.logs}
                    onToggle={caixa.alternarConferencia} 
                    onExcluir={(id) => mostrarAlerta("EXCLUIR", "Apagar?", () => caixa.excluirTransacao(id), true)} 
                    onReportarErro={caixa.reportarErroTransacao}
                    isFechado={isFechado} 
                  />
                )}
                {section === "fantasmas" && <FantasmasScreen transacoes={caixa.transacoes} fantasmas={caixa.fantasmas || []} onCriar={caixa.criarFantasma} onEditar={caixa.editarFantasma} onToggleResolvido={caixa.alternarFantasmaResolvido} onToggleComprovado={caixa.alternarFantasmaComprovado} onExcluir={(id) => mostrarAlerta("EXCLUIR", "Remover?", () => caixa.excluirFantasma(id), true)} isFechado={isFechado} />}
                {section === "historico" && (
                  <HistoricoScreen 
                    turnos={caixa.historicoTurnos} 
                    loading={caixa.loading} 
                    onRefresh={caixa.carregarHistoricoTurnos} 
                    onOpen={(turnoId) => void caixa.abrirTurnoPorId(turnoId)} 
                    onExcluirDia={(id) => mostrarAlerta("APAGAR DIA", "Deseja deletar?", () => caixa.excluirTurno(id), true)} 
                    onToggleRepasse={(id, state) => caixa.alternarRepasse(id, state)} 
                    onVoltar={() => setSection("painel")}
                  />
                )}
              </View>
            </View>
          )}

          <View style={[styles.navContainer, { pointerEvents: 'box-none' }]}>
            <View style={styles.navInner}>
              {mainSections.map((s) => {
                const active = section === s.key;
                const Icon = s.icon;
                return (
                  <Pressable 
                    key={s.key} 
                    style={[styles.navButton, active && styles.navButtonActive]} 
                    onPress={() => {
                      triggerHaptic("light");
                      setSection(s.key);
                    }}
                    hitSlop={10}
                  >
                    <View>
                      <Icon size={18} color={active ? "#09090b" : "#71717a"} strokeWidth={active ? 3 : 2} />
                      {s.key === "fantasmas" && (caixa.fantasmas || []).some(f => !f.resolvido) && (
                        <View className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-amber-500 border-2 border-ink-900" />
                      )}
                    </View>
                    {active && <Text style={styles.navLabel}>{s.label}</Text>}
                  </Pressable>
                );              })}
            </View>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  scrollContent: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 140 },
  navContainer: { position: 'absolute', bottom: Platform.OS === 'android' ? 24 : 34, left: 0, right: 0, alignItems: 'center', paddingHorizontal: 8, zIndex: 999 },
  navInner: { flexDirection: 'row', gap: 4, borderRadius: 32, borderWidth: 1, borderColor: '#27272a', backgroundColor: '#18181b', padding: 6, elevation: 10 },
  navButton: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 24, paddingHorizontal: 14, paddingVertical: 12 },
  navButtonActive: { backgroundColor: '#f4f4f5' },
  navLabel: { fontSize: 10, fontWeight: '900', color: '#09090b', textTransform: 'uppercase', letterSpacing: 0.5 }
});
