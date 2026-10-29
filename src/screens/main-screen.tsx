import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { Pressable, ScrollView, Text, View, Platform, StyleSheet, Share, Modal, TextInput, Switch, Animated, Easing, Image, InteractionManager } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";

import { useCaixaSeguro } from "../hooks/use-caixa-seguro";
import { ChecklistScreen } from "./checklist-screen";
import { FantasmasScreen } from "./fantasmas-screen";
import { HistoricoScreen } from "./historico-screen";
import { PainelScreen } from "./painel-screen";
import { TransacoesScreen } from "./transacoes-screen";
import { TurnoScreen } from "./turno-screen";
import { ConvenioScreen } from "./convenio-screen";
import { CreditsScreen } from "./credits-screen";
import { RetrospectiveScreen } from "./retrospective-screen";
import { SnapshotsScreen } from "./snapshots-screen";
import { AnalyticsModal } from "./analytics-modal";
import { AuditModal } from "./audit-modal";
import { InadimplenciaScreen } from "./inadimplencia-screen";
import { ChatModal } from "../components/chat/chat-modal";
import { SettingsModal } from "../components/dashboard/settings-modal";
import { ProfileModal } from "../components/dashboard/profile-modal";
import { SecurityModal } from "../components/dashboard/security-modal";
import { toBrl } from "../utils/currency";
import { formatGoogleDriveThumbnailUrl } from "../services/google-drive-direct-service";
import { getTodayReferenceDate } from "../utils/date";
import { Turno, Transacao, LembreteFantasma, LogAlteracao, RegistroPOS, RegistroConvenio } from "../types/domain";

import { RefreshCw, LayoutDashboard, PlusCircle, CheckSquare, Ghost, History, Share2, Lock, Unlock, CheckCircle2, AlertTriangle, X, AlertCircle, ShieldAlert, MoreHorizontal, Settings, CalendarDays, LogOut, Cloud, CloudOff, Zap, Sparkles, Info, ShieldCheck, Activity, CreditCard, Building2, Store, Search, ChevronDown, Database, Banknote, Eye, EyeOff, PauseCircle, FileText, Download, Upload, Terminal, SlidersHorizontal, ChevronRight, User, Heart, KeyRound } from "lucide-react-native";
import NetInfo from "@react-native-community/netinfo";
import { getFirebaseApp } from "../services/firebase/client";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useAuth } from "../hooks/use-auth";
import { useChatStore } from "../store/chat-store";
import { useAppSettings, HapticIntensity } from "../hooks/use-app-settings";
import { useLoja } from "../hooks/use-loja";

import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { scheduleDailyReminders } from "../services/notifications";

import { Skeleton } from "../components/common/skeleton";
import { registrarLogAlteracao, atualizarStatusTurno } from "../services/repositories/caixa-repository";
import { loadCurrentShiftCache, saveCurrentShiftCache } from "../services/local-storage";

type SectionKey = "painel" | "transacoes" | "checklist" | "fantasmas" | "historico" | "convenio";

export function MainScreen() {
  const { logout, user } = useAuth();
  const { settings, updateSettings, loading: settingsLoading } = useAppSettings();
  const loja = useLoja();
  const [somaOutros, setSomaOutros] = useState(0);

  const caixa = useCaixaSeguro(somaOutros);
  
  // Seletores granulares do Zustand: evita que o MainScreen re-renderize em heartbeats de presença alheios
  const mensagens = useChatStore((s) => s.mensagens);
  const hiddenLocalIds = useChatStore((s) => s.hiddenLocalIds);
  const myProfile = useChatStore((s) => s.myProfile);
  const isAdmin = useChatStore((s) => s.isAdmin);

  const operatorName = myProfile?.displayName || user?.displayName || (user?.email ? user.email.split("@")[0] : "Operador");
  const myPhotoUrl = myProfile?.photoUrl || user?.photoURL || undefined;
  const [headerAvatarError, setHeaderAvatarError] = useState(false);

  const ultimoAutorMuralObj = useMemo(() => {
    const ativas = mensagens.filter(m => !m.destinatarioId && !m.apagadaEm && !hiddenLocalIds[m.id]);
    const last = ativas[ativas.length - 1];
    if (!last) return null;
    let text = "";
    if (last.texto?.trim()) {
      const sender = last.remetenteNome ? last.remetenteNome.split(" ")[0] : (last.remetenteUsername ? `@${last.remetenteUsername}` : "");
      text = sender ? `${sender}: ${last.texto}` : last.texto;
    } else if (last.imagemBase64) {
      const sender = last.remetenteNome ? last.remetenteNome.split(" ")[0] : (last.remetenteUsername ? `@${last.remetenteUsername}` : "");
      text = sender ? `${sender}: 📷 Foto no mural` : "📷 Foto no mural";
    }
    return {
      text,
      senderId: last.remetenteId,
      senderName: last.remetenteNome,
      senderUsername: last.remetenteUsername,
      senderCargo: last.remetenteCargo,
      senderPhotoUrl: (last as any).remetentePhotoUrl || null
    };
  }, [mensagens, hiddenLocalIds]);

  const ultimaMensagemMuralAtiva = ultimoAutorMuralObj?.text;

  useEffect(() => {
    setHeaderAvatarError(false);
  }, [myPhotoUrl]);

  const [section, setSection] = useState<SectionKey>("painel");
  const [isDiscreto, setIsDiscreto] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  type ConnectionStatus = "idle" | "offline" | "restoring" | "ready";
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("idle");

  const [modalFechamento, setModalFechamento] = useState(false);
  const [modalMais, setModalMais] = useState(false);
  const [modalPerfil, setModalPerfil] = useState(false);
  const [modalSeguranca, setModalSeguranca] = useState(false);
  const [modalAuditoria, setModalAuditoria] = useState(false);
  const [modalConfig, setModalConfig] = useState(false);
  const [modalPreferencias, setModalPreferencias] = useState(false);
  const [modalCreditos, setModalCreditos] = useState(false);
  const [modalRetrospectiva, setModalRetrospectiva] = useState(false);
  const [modalAnalytics, setModalAnalytics] = useState(false);
  const [modalSnapshots, setModalSnapshots] = useState(false);
  const [modalInadimplencia, setModalInadimplencia] = useState(false);
  const [modalImportarJson, setModalImportarJson] = useState(false);
  const [jsonImportText, setJsonImportText] = useState("");
  const [isChatVisible, setChatVisible] = useState(false);
  const [bateu, setBateu] = useState<boolean | null>(null);
  const [obs, setObs] = useState("");

  const [caixaId, setCaixaId] = useState("");
  const [currentOperadorId, setCurrentOperadorId] = useState("");

  const [inputLojaMode, setInputLojaMode] = useState(false);
  const [lojaCodeInput, setLojaCodeInput] = useState("");
  
  const [fechamentosLoja, setFechamentosLoja] = useState<import("../services/repositories/loja-repository").FechamentoPOS[]>([]);

  // Animação de Sincronismo e Transição de Conexão 100% Nativa na GPU (useNativeDriver: true - Zero impacto na JS Thread)
  // Ciclo completo de cores: Vermelho (Offline) ➔ Azul (Conexão Restaurada / Sincronizando) ➔ Verde (Tudo Pronto) ➔ Dark padrão
  const syncRedAnim = useRef(new Animated.Value(0)).current;
  const syncBlueAnim = useRef(new Animated.Value(0)).current;
  const syncGreenAnim = useRef(new Animated.Value(0)).current;

  const isOnlineRef = useRef(true);
  const wasOfflineRef = useRef(false);
  const isGlowRunning = useRef(false);
  const activeTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const activeAnimation = useRef<Animated.CompositeAnimation | null>(null);

  const clearAllGlowTimers = useCallback(() => {
    activeTimers.current.forEach((t) => clearTimeout(t));
    activeTimers.current = [];
    if (activeAnimation.current) {
      activeAnimation.current.stop();
      activeAnimation.current = null;
    }
  }, []);

  // Transição para estado Offline (Borda Vermelha + Fundo Avermelhado + LED Vermelho)
  const triggerOfflineState = useCallback(() => {
    clearAllGlowTimers();
    isGlowRunning.current = false;
    setConnectionStatus("offline");

    syncBlueAnim.setValue(0);
    syncGreenAnim.setValue(0);

    const anim = Animated.timing(syncRedAnim, {
      toValue: 1,
      duration: 350,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    });
    activeAnimation.current = anim;
    anim.start(() => {
      activeAnimation.current = null;
    });
  }, [syncRedAnim, syncBlueAnim, syncGreenAnim, clearAllGlowTimers]);

  // Transição ao Restaurar a Conexão: Vermelho ➔ Azul (Restaurando) ➔ Verde (Tudo Pronto) ➔ Dark
  const triggerRestoredTransition = useCallback(() => {
    clearAllGlowTimers();
    isGlowRunning.current = true;
    setConnectionStatus("restoring");

    // Fase 1: Desvanece Vermelho e acende Azul vibrante (Conexão Restaurada)
    const animPhase1 = Animated.parallel([
      Animated.timing(syncRedAnim, {
        toValue: 0,
        duration: 300,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(syncBlueAnim, {
        toValue: 1,
        duration: 350,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]);

    activeAnimation.current = animPhase1;
    animPhase1.start(({ finished }) => {
      if (!finished) return;

      // Mantém Azul por 450ms
      const t1 = setTimeout(() => {
        if (!isOnlineRef.current) return;
        setConnectionStatus("ready");

        // Fase 2: Transição Azul ➔ Verde ("Tudo Pronto")
        const animPhase2 = Animated.parallel([
          Animated.timing(syncBlueAnim, {
            toValue: 0,
            duration: 300,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(syncGreenAnim, {
            toValue: 1,
            duration: 350,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
        ]);

        activeAnimation.current = animPhase2;
        animPhase2.start(({ finished: f2 }) => {
          if (!f2) return;

          // Mantém Verde "Tudo Pronto" por 700ms
          const t2 = setTimeout(() => {
            if (!isOnlineRef.current) return;

            // Fase 3: Desvanece Verde suavemente para o Dark padrão
            const animPhase3 = Animated.timing(syncGreenAnim, {
              toValue: 0,
              duration: 450,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            });

            activeAnimation.current = animPhase3;
            animPhase3.start(({ finished: f3 }) => {
              if (f3) {
                setConnectionStatus("idle");
                isGlowRunning.current = false;
              }
            });
          }, 700);
          activeTimers.current.push(t2);
        });
      }, 450);
      activeTimers.current.push(t1);
    });
  }, [syncRedAnim, syncBlueAnim, syncGreenAnim, clearAllGlowTimers]);

  // Transição para sincronizações rotineiras (Abertura de turno / novos lançamentos online)
  const triggerSyncGlow = useCallback(() => {
    if (!isOnlineRef.current) return; // Não interfere se estiver offline
    if (isGlowRunning.current) return;
    isGlowRunning.current = true;
    clearAllGlowTimers();

    setConnectionStatus("restoring");
    syncRedAnim.setValue(0);
    syncBlueAnim.setValue(0);
    syncGreenAnim.setValue(0);

    // Fase 1: Azul suave (sincronizando dados)
    const animPhase1 = Animated.timing(syncBlueAnim, {
      toValue: 1,
      duration: 300,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    });

    activeAnimation.current = animPhase1;
    animPhase1.start(({ finished }) => {
      if (!finished) return;

      const t1 = setTimeout(() => {
        if (!isOnlineRef.current) return;
        setConnectionStatus("ready");

        // Fase 2: Verde (dados sincronizados / tudo pronto)
        const animPhase2 = Animated.parallel([
          Animated.timing(syncBlueAnim, {
            toValue: 0,
            duration: 250,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(syncGreenAnim, {
            toValue: 1,
            duration: 300,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
        ]);

        activeAnimation.current = animPhase2;
        animPhase2.start(({ finished: f2 }) => {
          if (!f2) return;

          const t2 = setTimeout(() => {
            if (!isOnlineRef.current) return;

            // Fase 3: Retorna ao padrão
            const animPhase3 = Animated.timing(syncGreenAnim, {
              toValue: 0,
              duration: 400,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            });

            activeAnimation.current = animPhase3;
            animPhase3.start(({ finished: f3 }) => {
              if (f3) {
                setConnectionStatus("idle");
                isGlowRunning.current = false;
              }
            });
          }, 500);
          activeTimers.current.push(t2);
        });
      }, 300);
      activeTimers.current.push(t1);
    });
  }, [syncRedAnim, syncBlueAnim, syncGreenAnim, clearAllGlowTimers]);

  useEffect(() => {
    // POS não é mais utilizado no fluxo atual
    setFechamentosLoja([]);
    setSomaOutros(0);
  }, []);

  // Memorização de IDs
  useEffect(() => {
    async function loadLastIds() {
      if (!caixa.turno && !caixa.loading) {
        const lastCx = await AsyncStorage.getItem("@squirrel_last_caixa_id");
        const lastOp = await AsyncStorage.getItem("@squirrel_last_operador_id");
        if (lastCx) setCaixaId(lastCx);
        if (lastOp) setCurrentOperadorId(lastOp);
      }
    }
    loadLastIds();
  }, [caixa.turno === null]);

  // Listener para quando o usuário CLICA na notificação do Android e abre o Chat direto
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (data?.type === "chat_message") {
        setChatVisible(true);
      }
    });

    return () => {
      sub.remove();
    };
  }, []);

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

  // Ao excluir um turno, também limpa os pos_fechamentos da loja
  // para evitar dados órfãos que causariam descontos incorretos
  const handleExcluirTurno = async (id: string) => {
    // Encontra o turno no histórico para saber a dataReferencia
    const turnoAlvo = caixa.historicoTurnos.find(t => t.id === id);
    if (turnoAlvo && loja.lojaCodigo) {
      await loja.removerFechamentoPOS(turnoAlvo.dataReferencia, id);
    }
    await caixa.excluirTurno(id);
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

  // Limpeza de timers e animações de sincronização no unmount
  useEffect(() => {
    return () => {
      clearAllGlowTimers();
    };
  }, [clearAllGlowTimers]);

  // Monitor de Conexão Oficial do Sistema com Sinalização Visual Completa
  // Ciclo: Offline (Vermelho) ➔ Restaurado (Azul) ➔ Tudo Pronto (Verde) ➔ Dark
  useEffect(() => {
    NetInfo.fetch().then((state) => {
      const online = Boolean(state.isConnected && state.isInternetReachable !== false);
      isOnlineRef.current = online;
      wasOfflineRef.current = !online;
      setIsOnline(online);
      if (!online) {
        triggerOfflineState();
      }
    });

    const unsub = NetInfo.addEventListener((state) => {
      const online = Boolean(state.isConnected && state.isInternetReachable !== false);
      const previouslyOffline = wasOfflineRef.current;
      wasOfflineRef.current = !online;
      isOnlineRef.current = online;
      setIsOnline(online);

      if (!online) {
        triggerOfflineState();
      } else if (previouslyOffline) {
        triggerRestoredTransition();
      }
    });
    return () => unsub();
  }, [triggerOfflineState, triggerRestoredTransition]);

  // Sinalização de sincronização visual ao carregar o turno ou receber novos dados
  const hasTriggeredInitialGlow = useRef(false);
  useEffect(() => {
    if (caixa.turno?.id && !hasTriggeredInitialGlow.current) {
      hasTriggeredInitialGlow.current = true;
      if (isOnlineRef.current) {
        triggerSyncGlow();
      }
    }
  }, [caixa.turno?.id, triggerSyncGlow]);

  useEffect(() => {
    if (caixa.turno?.id && hasTriggeredInitialGlow.current) {
      if (isOnlineRef.current) {
        triggerSyncGlow();
      }
    }
  }, [(caixa.transacoes || []).length, (caixa.registrosConvenio || []).length, triggerSyncGlow]);

  const mainSections: { key: SectionKey; label: string; icon: any }[] = useMemo(() => [
    { key: "painel", label: "Painel", icon: LayoutDashboard },
    { key: "transacoes", label: "Dinheiro", icon: Banknote },
    { key: "convenio", label: "Convênio", icon: Building2 },
    { key: "checklist", label: "Check", icon: CheckSquare },
  ], []);

  const canhotosCount = useMemo(() => {
    return (caixa.transacoes || []).length;
  }, [caixa.transacoes]);

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
      setCurrentOperadorId(caixa.turno.operadorId || "");
    }
  }, [caixa.turno?.id]);

  const mostrarAlerta = useCallback((title: string, message: string, onConfirm: () => void, destructive = false) => {
    setCustomAlert({ visible: true, title, message, onConfirm, destructive });
  }, []);

  const handleExcluirTransacao = useCallback((id: string) => {
    mostrarAlerta("EXCLUIR", "Apagar?", () => caixa.excluirTransacao(id), true);
  }, [mostrarAlerta, caixa.excluirTransacao]);

  const changeSection = useCallback(async (next: SectionKey) => {
    triggerHaptic("light");
    setSection(next);
    if (next === "historico") await caixa.carregarHistoricoTurnos();
  }, [caixa.carregarHistoricoTurnos]);

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
                `🆔 **CAIXA:** ${caixaId || '01'}\n` +
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
                (settings.posEnabled || settings.convenioEnabled ? 
                  `💳 **OUTROS RECEBIMENTOS**\n` +
                  (settings.posEnabled ? `  ▪️ MÁQUINA POS:  ${toBrl(t.totalPOS)}\n` : '') +
                  (settings.convenioEnabled ? `  ▪️ CONVÊNIOS:    ${toBrl(t.totalConvenio)}\n\n` : '')
                : '') +
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
      const payload = {
        exportedAt: new Date().toISOString(),
        turno: cache.turno,
        transacoes: cache.transacoes,
        fantasmas: cache.fantasmas,
        logs: cache.logs,
      };
      const file = new File(Paths.cache, `squirrel-backup-${Date.now()}.json`);
      file.write(JSON.stringify(payload, null, 2));
      const fileUri = file.uri;
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

  async function handleRestaurarJson(rawJson: string) {
    try {
      if (!rawJson || !rawJson.trim()) {
        mostrarAlerta("CAMPO VAZIO", "Cole o conteúdo JSON do backup para continuar.", () => {});
        return;
      }
      let parsed: any;
      try {
        parsed = JSON.parse(rawJson.trim());
      } catch (parseErr) {
        mostrarAlerta("JSON INVÁLIDO", "Não foi possível interpretar o texto. Certifique-se de copiar o código completo.", () => {});
        return;
      }

      if (!parsed.turno && !parsed.transacoes && !Array.isArray(parsed)) {
        mostrarAlerta("ARQUIVO INVÁLIDO", "O conteúdo colado não contém um formato reconhecido de backup do Squirrel.", () => {});
        return;
      }

      const transacoes: Transacao[] = Array.isArray(parsed.transacoes) 
        ? parsed.transacoes 
        : Array.isArray(parsed) 
        ? parsed 
        : [];
      const fantasmas: LembreteFantasma[] = Array.isArray(parsed.fantasmas) ? parsed.fantasmas : [];
      const logs: LogAlteracao[] = Array.isArray(parsed.logs) ? parsed.logs : [];
      const pos: RegistroPOS[] = Array.isArray(parsed.registrosPOS) ? parsed.registrosPOS : [];
      const convenio: RegistroConvenio[] = Array.isArray(parsed.registrosConvenio) ? parsed.registrosConvenio : [];

      let turno: Turno;
      if (parsed.turno && typeof parsed.turno === "object") {
        turno = {
          ...parsed.turno,
          id: parsed.turno.id || `turno_${Date.now()}`,
          dataReferencia: parsed.turno.dataReferencia || getTodayReferenceDate(),
          statusTurno: parsed.turno.statusTurno || "aberto",
          totais: parsed.turno.totais || {
            sistema: 0,
            sobra: 0,
            gavetaFisico: 0,
            especieEnvelope: 0,
            pixRepasse: 0,
            pixNoCaixa: 0,
            pixDiretoLoja: 0,
            totalPOS: 0,
            totalConvenio: 0,
          },
          criadoEm: parsed.turno.criadoEm || Date.now(),
          atualizadoEm: Date.now(),
        };
      } else {
        const firstTs = transacoes[0]?.timestamp || Date.now();
        const dataRef = new Date(firstTs).toISOString().slice(0, 10);
        turno = {
          id: `turno_${Date.now()}`,
          dataReferencia: dataRef,
          statusTurno: "aberto",
          ajusteManualSobra: 0,
          totais: {
            sistema: 0,
            sobra: 0,
            gavetaFisico: 0,
            especieEnvelope: 0,
            pixRepasse: 0,
            pixNoCaixa: 0,
            pixDiretoLoja: 0,
            totalPOS: 0,
            totalConvenio: 0,
          },
          criadoEm: firstTs,
          atualizadoEm: Date.now(),
          repassado: false,
          excluido: false,
        };
      }

      // Executa a importação real (Zustand + MMKV + Firestore Nuvem)
      await caixa.importarTurnoCompleto(turno, transacoes, fantasmas, logs, pos, convenio);

      setModalImportarJson(false);
      setJsonImportText("");
      setSection("painel");

      mostrarAlerta(
        "BACKUP RESTAURADO COM SUCESSO!",
        `O dia ${turno.dataReferencia} foi importado com sucesso!\n\n• ${transacoes.length} transações restauradas\n• ${fantasmas.length} notas carregadas\n• Caixa aberto e pronto no painel.`,
        () => {}
      );
    } catch (e: any) {
      console.error("[Restaurar JSON] Erro:", e);
      mostrarAlerta("ERRO AO PROCESSAR", `Falha ao importar: ${e?.message || "Verifique o formato"}`, () => {});
    }
  }

  async function compartilharDiagnostico() {
    const diagnostico = [
      `Timestamp: ${new Date().toISOString()}`,
      `Online: ${isOnline}`,
      `Turno atual: ${caixa.turno?.id ?? "nenhum"}`,
      `Transações locais: ${caixa.transacoes.length}`,
      `Fantasmas locais: ${caixa.fantasmas.length}`,
    ].join("\n");
    await Share.share({ message: diagnostico });
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* MODAL DE OPÇÕES DO CAIXA COM DESIGN SYSTEM OFICIAL */}
      <Modal visible={modalMais} transparent animationType="slide" onRequestClose={() => setModalMais(false)}>
        <View className="flex-1 justify-end bg-black/85">
          <Pressable className="flex-1" onPress={() => setModalMais(false)} />
          
          <View className="w-full bg-[#0d0d12] rounded-t-[40px] shadow-2xl border-t border-zinc-800 max-h-[88%] p-5 pt-3 flex-col">
            {/* Handle Bar */}
            <View className="w-12 h-1.5 rounded-full bg-zinc-800 mx-auto mb-3" />

            {/* Header */}
            <View className="flex-row items-center justify-between pb-3 mb-3 px-1 border-b border-zinc-900">
              <View className="flex-row items-center gap-2.5">
                <View className="h-7 w-7 rounded-xl bg-amber-500/20 border border-amber-500/40 items-center justify-center">
                  <SlidersHorizontal size={14} color="#fbbf24" strokeWidth={2.5} />
                </View>
                <Text className="text-xs font-black uppercase tracking-[2px] text-zinc-200">
                  Opções do Caixa
                </Text>
              </View>
              <Pressable 
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setModalMais(false);
                }}
                hitSlop={10}
                className="h-8 w-8 rounded-full bg-zinc-900 border border-zinc-800 items-center justify-center active:bg-zinc-800"
              >
                <X size={15} color="#a1a1aa" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24, gap: 14 }}>
              
              {/* 1. BOTÃO HERO PRIMÁRIO NO TOPO: SAIR DESTE DIA */}
              <Pressable
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setModalMais(false);
                  mostrarAlerta(
                    "SAIR DO DIA", 
                    "Deseja voltar para a tela inicial? O dia continuará aberto para edições depois.", 
                    () => { 
                      caixa.sairDoDia(); 
                      setSection("painel"); 
                    }
                  );
                }}
                className="w-full h-14 rounded-2xl bg-zinc-100 px-4 flex-row items-center justify-between active:bg-zinc-200 shadow-xl"
              >
                <View className="flex-row items-center gap-3.5 flex-1 min-w-0 mr-2">
                  <View className="h-9 w-9 rounded-xl bg-zinc-950 items-center justify-center flex-shrink-0">
                    <PauseCircle size={20} color="#ffffff" strokeWidth={2.5} />
                  </View>
                  <View className="flex-1 min-w-0">
                    <Text className="font-black uppercase text-zinc-950 text-xs tracking-wider leading-tight">
                      Sair Deste Dia
                    </Text>
                    <Text className="text-[10px] text-zinc-600 font-bold mt-0.5" numberOfLines={1}>
                      Pausar turno para continuar depois
                    </Text>
                  </View>
                </View>
                <View className="h-7 px-2.5 rounded-lg bg-zinc-200 border border-zinc-300 items-center justify-center flex-shrink-0">
                  <Text className="text-[10px] font-black uppercase text-zinc-900 tracking-wider">
                    PAUSAR
                  </Text>
                </View>
              </Pressable>

              {/* 2. CARD: INTELIGÊNCIA & ANÁLISES */}
              <View className="bg-[#121216] border border-zinc-800 rounded-[32px] p-4 shadow-xl gap-2.5">
                <View className="flex-row items-center gap-2 px-1 pb-1 border-b border-zinc-800/80">
                  <View className="h-6 w-6 rounded-lg bg-amber-500/20 border border-amber-500/40 items-center justify-center">
                    <Sparkles size={13} color="#fbbf24" strokeWidth={2.5} />
                  </View>
                  <Text className="text-xs font-black uppercase tracking-[1.5px] text-zinc-200">
                    Inteligência & Análises
                  </Text>
                </View>

                {/* Você Sabia? (Retrospectiva) */}
                <Pressable
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setModalMais(false);
                    setModalRetrospectiva(true);
                  }}
                  className="w-full bg-[#09090c] p-3 px-3.5 rounded-2xl border border-amber-500/30 flex-row items-center justify-between active:bg-zinc-900"
                >
                  <View className="flex-row items-center gap-3.5 flex-1 min-w-0 mr-2">
                    <View className="h-10 w-10 rounded-xl bg-amber-500/15 border border-amber-500/30 items-center justify-center flex-shrink-0">
                      <Sparkles size={18} color="#fcd34d" />
                    </View>
                    <View className="flex-1 min-w-0">
                      <Text className="text-xs font-black text-white uppercase tracking-wider leading-tight">
                        Você Sabia? (Retrospectiva)
                      </Text>
                      <Text className="text-[10px] text-zinc-400 font-medium truncate mt-0.5" numberOfLines={1}>
                        Recordes, ticket médio e destaques do dia
                      </Text>
                    </View>
                  </View>
                  <View className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 flex-shrink-0">
                    <Text className="text-[9px] font-black text-amber-300 uppercase">ABRIR</Text>
                  </View>
                </Pressable>

                {/* Mapa de Movimentação */}
                <Pressable
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setModalMais(false);
                    setModalAnalytics(true);
                  }}
                  className="w-full bg-[#09090c] p-3 px-3.5 rounded-2xl border border-blue-500/30 flex-row items-center justify-between active:bg-zinc-900"
                >
                  <View className="flex-row items-center gap-3.5 flex-1 min-w-0 mr-2">
                    <View className="h-10 w-10 rounded-xl bg-blue-500/15 border border-blue-500/30 items-center justify-center flex-shrink-0">
                      <Activity size={18} color="#93c5fd" />
                    </View>
                    <View className="flex-1 min-w-0">
                      <Text className="text-xs font-black text-white uppercase tracking-wider leading-tight">
                        Mapa de Movimentação
                      </Text>
                      <Text className="text-[10px] text-zinc-400 font-medium truncate mt-0.5" numberOfLines={1}>
                        Gráficos de fluxo e horários de pico
                      </Text>
                    </View>
                  </View>
                  <View className="px-2.5 py-1 rounded-lg bg-blue-500/15 border border-blue-500/30 flex-shrink-0">
                    <Text className="text-[9px] font-black text-blue-300 uppercase">GRÁFICO</Text>
                  </View>
                </Pressable>

                {/* Auditoria do Turno */}
                <Pressable
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setModalMais(false);
                    setModalAuditoria(true);
                  }}
                  className="w-full bg-[#09090c] p-3 px-3.5 rounded-2xl border border-indigo-500/30 flex-row items-center justify-between active:bg-zinc-900"
                >
                  <View className="flex-row items-center gap-3.5 flex-1 min-w-0 mr-2">
                    <View className="h-10 w-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 items-center justify-center flex-shrink-0">
                      <ShieldCheck size={18} color="#818cf8" />
                    </View>
                    <View className="flex-1 min-w-0">
                      <Text className="text-xs font-black text-white uppercase tracking-wider leading-tight">
                        Auditoria do Turno
                      </Text>
                      <Text className="text-[10px] text-zinc-400 font-medium truncate mt-0.5" numberOfLines={1}>
                        Rastreabilidade de entradas, saídas e logs
                      </Text>
                    </View>
                  </View>
                  <View className="px-2.5 py-1 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex-shrink-0">
                    <Text className="text-[9px] font-black text-indigo-300 uppercase">LOGS</Text>
                  </View>
                </Pressable>

                {/* Inadimplência & Cobrança (BackOffice Clara) */}
                <Pressable
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setModalMais(false);
                    setModalInadimplencia(true);
                  }}
                  className="w-full bg-[#09090c] p-3 px-3.5 rounded-2xl border border-cyan-500/30 flex-row items-center justify-between active:bg-zinc-900"
                >
                  <View className="flex-row items-center gap-3.5 flex-1 min-w-0 mr-2">
                    <View className="h-10 w-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 items-center justify-center flex-shrink-0">
                      <Sparkles size={18} color="#38bdf8" />
                    </View>
                    <View className="flex-1 min-w-0">
                      <Text className="text-xs font-black text-white uppercase tracking-wider leading-tight">
                        Inadimplência & Cobrança
                      </Text>
                      <Text className="text-[10px] text-zinc-400 font-medium truncate mt-0.5" numberOfLines={1}>
                        Exclusão, cobrança individual e diagnóstico BackOffice
                      </Text>
                    </View>
                  </View>
                  <View className="px-2.5 py-1 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex-shrink-0">
                    <Text className="text-[9px] font-black text-cyan-300 uppercase">ONLINE</Text>
                  </View>
                </Pressable>
              </View>

              {/* 3. CARD: RELATÓRIOS & DADOS */}
              <View className="bg-[#121216] border border-zinc-800 rounded-[32px] p-4 shadow-xl gap-2.5">
                <View className="flex-row items-center gap-2 px-1 pb-1 border-b border-zinc-800/80">
                  <View className="h-6 w-6 rounded-lg bg-emerald-500/20 border border-emerald-500/40 items-center justify-center">
                    <Database size={13} color="#34d399" strokeWidth={2.5} />
                  </View>
                  <Text className="text-xs font-black uppercase tracking-[1.5px] text-zinc-200">
                    Relatórios & Backups
                  </Text>
                </View>

                {/* Compartilhar Relatório */}
                <Pressable
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setModalMais(false);
                    void gerarRelatorio();
                  }}
                  className="w-full bg-[#09090c] p-3 px-3.5 rounded-2xl border border-zinc-800 flex-row items-center justify-between active:bg-zinc-900"
                >
                  <View className="flex-row items-center gap-3.5 flex-1 min-w-0 mr-2">
                    <View className="h-10 w-10 rounded-xl bg-purple-500/15 border border-purple-500/30 items-center justify-center flex-shrink-0">
                      <FileText size={18} color="#d8b4fe" />
                    </View>
                    <View className="flex-1 min-w-0">
                      <Text className="text-xs font-black text-zinc-100 uppercase tracking-wider leading-tight">
                        Compartilhar Relatório
                      </Text>
                      <Text className="text-[10px] text-zinc-400 font-medium truncate mt-0.5" numberOfLines={1}>
                        PDF formatado para WhatsApp ou impressão
                      </Text>
                    </View>
                  </View>
                  <View className="px-2.5 py-1 rounded-lg bg-purple-500/15 border border-purple-500/30 flex-shrink-0">
                    <Text className="text-[9px] font-black text-purple-300 uppercase">PDF</Text>
                  </View>
                </Pressable>

                {/* Exportar Backup Local */}
                <Pressable
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setModalMais(false);
                    void exportarBackupLocal();
                  }}
                  className="w-full bg-[#09090c] p-3 px-3.5 rounded-2xl border border-zinc-800 flex-row items-center justify-between active:bg-zinc-900"
                >
                  <View className="flex-row items-center gap-3.5 flex-1 min-w-0 mr-2">
                    <View className="h-10 w-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 items-center justify-center flex-shrink-0">
                      <Download size={18} color="#6ee7b7" />
                    </View>
                    <View className="flex-1 min-w-0">
                      <Text className="text-xs font-black text-zinc-100 uppercase tracking-wider leading-tight">
                        Exportar Backup Local
                      </Text>
                      <Text className="text-[10px] text-zinc-400 font-medium truncate mt-0.5" numberOfLines={1}>
                        Gerar e salvar arquivo JSON de segurança
                      </Text>
                    </View>
                  </View>
                  <View className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex-shrink-0">
                    <Text className="text-[9px] font-black text-emerald-300 uppercase">JSON</Text>
                  </View>
                </Pressable>

                {/* Importar Backup Local (JSON) */}
                <Pressable
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setModalMais(false);
                    setModalImportarJson(true);
                  }}
                  className="w-full bg-[#09090c] p-3 px-3.5 rounded-2xl border border-zinc-800 flex-row items-center justify-between active:bg-zinc-900"
                >
                  <View className="flex-row items-center gap-3.5 flex-1 min-w-0 mr-2">
                    <View className="h-10 w-10 rounded-xl bg-sky-500/15 border border-sky-500/30 items-center justify-center flex-shrink-0">
                      <Upload size={18} color="#38bdf8" />
                    </View>
                    <View className="flex-1 min-w-0">
                      <Text className="text-xs font-black text-zinc-100 uppercase tracking-wider leading-tight">
                        Importar Backup (JSON)
                      </Text>
                      <Text className="text-[10px] text-zinc-400 font-medium truncate mt-0.5" numberOfLines={1}>
                        Carregar arquivo JSON salvo para restaurar
                      </Text>
                    </View>
                  </View>
                  <View className="px-2.5 py-1 rounded-lg bg-sky-500/15 border border-sky-500/30 flex-shrink-0">
                    <Text className="text-[9px] font-black text-sky-300 uppercase">IMPORT</Text>
                  </View>
                </Pressable>

                {/* Reverter Dados (Snapshots) */}
                <Pressable
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setModalMais(false);
                    setModalSnapshots(true);
                  }}
                  className="w-full bg-[#09090c] p-3 px-3.5 rounded-2xl border border-zinc-800 flex-row items-center justify-between active:bg-zinc-900"
                >
                  <View className="flex-row items-center gap-3.5 flex-1 min-w-0 mr-2">
                    <View className="h-10 w-10 rounded-xl bg-amber-500/15 border border-amber-500/30 items-center justify-center flex-shrink-0">
                      <History size={18} color="#fcd34d" />
                    </View>
                    <View className="flex-1 min-w-0">
                      <Text className="text-xs font-black text-zinc-100 uppercase tracking-wider leading-tight">
                        Reverter Dados (Backups)
                      </Text>
                      <Text className="text-[10px] text-zinc-400 font-medium truncate mt-0.5" numberOfLines={1}>
                        Restaurar checkpoints de segurança do turno
                      </Text>
                    </View>
                  </View>
                  <View className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 flex-shrink-0">
                    <Text className="text-[9px] font-black text-amber-300 uppercase">RESTORE</Text>
                  </View>
                </Pressable>
              </View>

              {/* 4. CARD: APOIO & CONFIGURAÇÕES */}
              <View className="bg-[#121216] border border-zinc-800 rounded-[32px] p-4 shadow-xl gap-2.5">
                <View className="flex-row items-center gap-2 px-1 pb-1 border-b border-zinc-800/80">
                  <View className="h-6 w-6 rounded-lg bg-purple-500/20 border border-purple-500/40 items-center justify-center">
                    <Settings size={13} color="#c084fc" strokeWidth={2.5} />
                  </View>
                  <Text className="text-xs font-black uppercase tracking-[1.5px] text-zinc-200">
                    Apoio & Configurações
                  </Text>
                </View>

                {/* Compartilhar Diagnóstico */}
                <Pressable
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setModalMais(false);
                    void compartilharDiagnostico();
                  }}
                  className="w-full bg-[#09090c] p-3 px-3.5 rounded-2xl border border-zinc-800 flex-row items-center justify-between active:bg-zinc-900"
                >
                  <View className="flex-row items-center gap-3.5 flex-1 min-w-0 mr-2">
                    <View className="h-10 w-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 items-center justify-center flex-shrink-0">
                      <Terminal size={18} color="#67e8f9" />
                    </View>
                    <View className="flex-1 min-w-0">
                      <Text className="text-xs font-black text-zinc-100 uppercase tracking-wider leading-tight">
                        Compartilhar Diagnóstico
                      </Text>
                      <Text className="text-[10px] text-zinc-400 font-medium truncate mt-0.5" numberOfLines={1}>
                        Logs técnicos de rede, banco e sincronização
                      </Text>
                    </View>
                  </View>
                  <ChevronRight size={16} color="#71717a" />
                </Pressable>

                {/* Perfil do Operador */}
                <Pressable
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setModalMais(false);
                    setModalPerfil(true);
                  }}
                  className="w-full bg-[#09090c] p-3 px-3.5 rounded-2xl border border-zinc-800 flex-row items-center justify-between active:bg-zinc-900"
                >
                  <View className="flex-row items-center gap-3.5 flex-1 min-w-0 mr-2">
                    <View className="h-10 w-10 rounded-xl bg-amber-500/15 border border-amber-500/30 items-center justify-center flex-shrink-0">
                      <User size={18} color="#fbbf24" />
                    </View>
                    <View className="flex-1 min-w-0">
                      <Text className="text-xs font-black text-zinc-100 uppercase tracking-wider leading-tight">
                        Perfil do Operador
                      </Text>
                      <Text className="text-[10px] text-zinc-400 font-medium truncate mt-0.5" numberOfLines={1}>
                        Nome, @tag única e status do caixa
                      </Text>
                    </View>
                  </View>
                  <ChevronRight size={16} color="#71717a" />
                </Pressable>

                {/* Configurações do App */}
                <Pressable
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setModalMais(false);
                    setModalPreferencias(true);
                  }}
                  className="w-full bg-[#09090c] p-3 px-3.5 rounded-2xl border border-zinc-800 flex-row items-center justify-between active:bg-zinc-900"
                >
                  <View className="flex-row items-center gap-3.5 flex-1 min-w-0 mr-2">
                    <View className="h-10 w-10 rounded-xl bg-purple-500/15 border border-purple-500/30 items-center justify-center flex-shrink-0">
                      <Zap size={18} color="#c084fc" />
                    </View>
                    <View className="flex-1 min-w-0">
                      <Text className="text-xs font-black text-zinc-100 uppercase tracking-wider leading-tight">
                        Configurações do App
                      </Text>
                      <Text className="text-[10px] text-zinc-400 font-medium truncate mt-0.5" numberOfLines={1}>
                        Tolerâncias, avisos sonoros e preferências
                      </Text>
                    </View>
                  </View>
                  <ChevronRight size={16} color="#71717a" />
                </Pressable>

                {/* Créditos */}
                <Pressable
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setModalMais(false);
                    setModalCreditos(true);
                  }}
                  className="w-full bg-[#09090c] p-3 px-3.5 rounded-2xl border border-zinc-800 flex-row items-center justify-between active:bg-zinc-900"
                >
                  <View className="flex-row items-center gap-3.5 flex-1 min-w-0 mr-2">
                    <View className="h-10 w-10 rounded-xl bg-pink-500/15 border border-pink-500/30 items-center justify-center flex-shrink-0">
                      <Heart size={18} color="#f472b6" />
                    </View>
                    <View className="flex-1 min-w-0">
                      <Text className="text-xs font-black text-zinc-100 uppercase tracking-wider leading-tight">
                        Créditos
                      </Text>
                      <Text className="text-[10px] text-zinc-400 font-medium truncate mt-0.5" numberOfLines={1}>
                        Sobre o criador & manifesto Eudaimonia
                      </Text>
                    </View>
                  </View>
                  <ChevronRight size={16} color="#71717a" />
                </Pressable>

                {/* Segurança & Acesso */}
                <Pressable
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setModalMais(false);
                    setModalSeguranca(true);
                  }}
                  className="w-full bg-[#09090c] p-3 px-3.5 rounded-2xl border border-zinc-800 flex-row items-center justify-between active:bg-zinc-900"
                >
                  <View className="flex-row items-center gap-3.5 flex-1 min-w-0 mr-2">
                    <View className="h-10 w-10 rounded-xl bg-amber-500/15 border border-amber-500/30 items-center justify-center flex-shrink-0">
                      <KeyRound size={18} color="#fbbf24" />
                    </View>
                    <View className="flex-1 min-w-0">
                      <Text className="text-xs font-black text-zinc-100 uppercase tracking-wider leading-tight">
                        Segurança & Acesso
                      </Text>
                      <Text className="text-[10px] text-zinc-400 font-medium truncate mt-0.5" numberOfLines={1}>
                        Alterar senha, e-mail e redefinição
                      </Text>
                    </View>
                  </View>
                  <ChevronRight size={16} color="#71717a" />
                </Pressable>
              </View>

              {/* 5. CARD: SESSÃO / LOGOUT */}
              <View className="pt-1 mb-2">
                <Pressable
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                    setModalMais(false);
                    logout();
                  }}
                  className="w-full h-12 rounded-2xl bg-red-500/10 border border-red-500/25 items-center justify-center flex-row gap-2 active:bg-red-500/20"
                >
                  <LogOut size={16} color="#f87171" strokeWidth={2.2} />
                  <Text className="font-black uppercase text-xs tracking-wider text-red-400">
                    Sair da Conta (Logout)
                  </Text>
                </Pressable>
              </View>

            </ScrollView>
          </View>
        </View>
      </Modal>

      <ProfileModal
        visible={modalPerfil}
        onClose={() => setModalPerfil(false)}
        caixaId={caixaId || "01"}
      />

      <SecurityModal
        visible={modalSeguranca}
        onClose={() => setModalSeguranca(false)}
      />

      <AuditModal
        visible={modalAuditoria}
        onClose={() => setModalAuditoria(false)}
        transacoes={caixa.transacoes}
        fantasmas={caixa.fantasmas}
        logs={caixa.logs}
        totais={caixa.totais}
        caixaId={caixaId || "01"}
        operadorName={operatorName || "Operador"}
      />

      {(modalConfig || modalPreferencias) && (
        <SettingsModal
          visible={modalConfig || modalPreferencias}
          onClose={() => {
            setModalConfig(false);
            setModalPreferencias(false);
          }}
          caixaId={caixaId}
          setCaixaId={setCaixaId}
          currentOperadorId={currentOperadorId}
          setCurrentOperadorId={setCurrentOperadorId}
          onSalvarIDs={async (cx, op) => {
            await caixa.salvarIDs(cx, op);
          }}
          isAdmin={isAdmin}
        />
      )}

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
      {modalSnapshots && (
        <SnapshotsScreen
          onClose={() => setModalSnapshots(false)}
          onAlert={mostrarAlerta}
        />
      )}

      <InadimplenciaScreen
        visible={modalInadimplencia}
        onClose={() => setModalInadimplencia(false)}
        operadorNome={operatorName || "Operador"}
      />

      {/* MODAL DE IMPORTAR BACKUP JSON */}
      <Modal visible={modalImportarJson} transparent animationType="fade" onRequestClose={() => setModalImportarJson(false)}>
        <View className="flex-1 bg-black/90 items-center justify-center p-5">
          <View className="w-full max-w-[420px] max-h-[85%] bg-[#0d0d12] border border-zinc-800 rounded-[36px] p-6 shadow-2xl flex-col">
            
            {/* Header */}
            <View className="flex-row items-center justify-between mb-4 pb-3 border-b border-zinc-800/80">
              <View className="flex-row items-center gap-3">
                <View className="h-9 w-9 rounded-2xl bg-sky-500/15 border border-sky-500/30 items-center justify-center">
                  <Upload size={18} color="#38bdf8" />
                </View>
                <View>
                  <Text className="text-sm font-black uppercase tracking-wider text-zinc-100">
                    Importar Backup JSON
                  </Text>
                  <Text className="text-[10px] text-zinc-400 font-medium">
                    Restauração manual de arquivo salvo
                  </Text>
                </View>
              </View>
              <Pressable 
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setModalImportarJson(false);
                }} 
                hitSlop={12}
                className="h-8 w-8 rounded-full bg-zinc-900 border border-zinc-800 items-center justify-center"
              >
                <X size={16} color="#71717a" />
              </Pressable>
            </View>

            {/* Explicação */}
            <View className="bg-sky-500/10 border border-sky-500/20 rounded-2xl p-3 mb-3">
              <Text className="text-[11px] text-sky-200 leading-relaxed font-medium">
                Cole abaixo o conteúdo do arquivo <Text className="font-bold text-sky-300">.json</Text> gerado pelo Squirrel. Todos os dados do turno serão sincronizados com os dados importados.
              </Text>
            </View>

            {/* Input JSON */}
            <View className="flex-1 min-h-[140px] max-h-[220px] bg-[#09090c] border border-zinc-800 rounded-2xl p-3 mb-4">
              <TextInput
                value={jsonImportText}
                onChangeText={setJsonImportText}
                placeholder="Cole o código JSON do backup aqui..."
                placeholderTextColor="#52525b"
                multiline
                numberOfLines={8}
                style={{ fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}
                className="flex-1 text-xs text-zinc-200 text-top"
                textAlignVertical="top"
              />
            </View>

            {/* Botões de Ação */}
            <View className="flex-row gap-3">
              <Pressable
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setJsonImportText("");
                  setModalImportarJson(false);
                }}
                className="flex-1 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 items-center justify-center active:bg-zinc-800"
              >
                <Text className="font-black uppercase text-xs tracking-wider text-zinc-400">
                  Cancelar
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                  void handleRestaurarJson(jsonImportText);
                }}
                className="flex-1 h-12 rounded-2xl bg-sky-500 items-center justify-center active:bg-sky-400 shadow-lg"
              >
                <Text className="font-black uppercase text-xs tracking-wider text-zinc-950">
                  Restaurar
                </Text>
              </Pressable>
            </View>

          </View>
        </View>
      </Modal>

      {/* MODAL DE CONFIGURAÇÕES & AJUSTES DO SISTEMA (HUB TÁTICO REWORK) */}
      <SettingsModal 
        visible={modalPreferencias || modalConfig}
        onClose={() => {
          setModalPreferencias(false);
          setModalConfig(false);
        }}
        caixaId={caixaId}
        setCaixaId={setCaixaId}
        currentOperadorId={currentOperadorId}
        setCurrentOperadorId={setCurrentOperadorId}
        onSalvarIDs={async (cid, oid) => {
          await caixa.salvarIDs(cid, oid);
        }}
        isAdmin={isAdmin}
      />

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
                    onOpen={(turnoId) => {
                      caixa.carregarTurnoExistente(turnoId);
                      setSection("painel");
                    }} 
                    onExcluirDia={(id) => mostrarAlerta("APAGAR DIA", "Deseja deletar?", () => handleExcluirTurno(id), true)} 
                    onRestaurarDia={(id) => mostrarAlerta("RESTAURAR DIA", "Tem certeza que deseja recuperar este dia da lixeira?", () => caixa.restaurarDia(id))}
                    onDeletarPermanente={(id) => mostrarAlerta("EXCLUSÃO PERMANENTE", "Tem certeza? Esta ação não pode ser desfeita.", () => caixa.deletarDiaPermanente(id), true)}
                    onVoltar={() => setSection("painel")}
                  />
              </View>
            </View>
          ) : (
            <TurnoScreen 
              loading={caixa.loading} 
              error={caixa.error} 
              onNovoDia={caixa.abrirNovoCaixa} 
              onContinuar={() => {
                const ultimoValido = caixa.historicoTurnos.find(t => !t.excluido);
                if (ultimoValido) {
                  caixa.carregarTurnoExistente(ultimoValido.id);
                } else {
                  mostrarAlerta("NENHUM DIA", "Não há dias abertos no momento.", () => {});
                }
              }} 
              onVerHistorico={() => changeSection("historico")} 
              onAbrirAjustes={() => setModalPreferencias(true)}
              onImportar={() => setModalImportarJson(true)}
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

          {/* 🌟 CABEÇALHO FLUTUANTE PREMIUM (ESTILO FLOATING GLASS CARD - SQUIRREL DNA) */}
          <View className="bg-ink-950 px-3 pt-2 pb-2 border-b border-zinc-900/60">
            <View className="mx-auto w-full max-w-[460px]">
              <View
                style={{
                  position: "relative",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderColor: isOnline ? "#27272a" : "#ef4444",
                  backgroundColor: isOnline ? "#121216" : "#180a0a",
                  borderWidth: 1,
                  borderRadius: 26,
                  paddingHorizontal: 12,
                  paddingVertical: 9,
                  minHeight: 56,
                  overflow: "hidden",
                }}
                className="shadow-2xl"
              >
                {/* Camada Vermelha Offline (Borda Vermelha #ef4444 + Fundo Avermelhado #180a0a, 100% Nativo na GPU) */}
                <Animated.View
                  pointerEvents="none"
                  style={[
                    StyleSheet.absoluteFillObject,
                    {
                      borderRadius: 26,
                      borderColor: "#ef4444",
                      borderWidth: 1.5,
                      backgroundColor: "#180a0a",
                      opacity: syncRedAnim,
                    },
                  ]}
                />

                {/* Camada Azul de Conexão Restaurada / Sincronizando (Borda Azul #3b82f6 + Fundo Azul Escuro #0c1626, 100% Nativo na GPU) */}
                <Animated.View
                  pointerEvents="none"
                  style={[
                    StyleSheet.absoluteFillObject,
                    {
                      borderRadius: 26,
                      borderColor: "#3b82f6",
                      borderWidth: 1.5,
                      backgroundColor: "#0c1626",
                      opacity: syncBlueAnim,
                    },
                  ]}
                />

                {/* Camada Verde de Tudo Pronto (Borda Verde #10b981 + Fundo Verde Escuro #0b1a13, 100% Nativo na GPU) */}
                <Animated.View
                  pointerEvents="none"
                  style={[
                    StyleSheet.absoluteFillObject,
                    {
                      borderRadius: 26,
                      borderColor: "#10b981",
                      borderWidth: 1.5,
                      backgroundColor: "#0b1a13",
                      opacity: syncGreenAnim,
                    },
                  ]}
                />

                {/* LADO ESQUERDO: Ícone Badge + Saudação Operador + Olho Discreto + Caixa e Data */}
                <View style={{ flexDirection: "row", alignItems: "center", flex: 1, minWidth: 0, marginRight: 8 }}>
                  <Pressable
                    onPress={() => {
                      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setModalPerfil(true);
                    }}
                    className="relative flex-shrink-0 mr-2.5 active:scale-95"
                    hitSlop={4}
                  >
                    <View
                      style={{ width: 36, height: 36, borderRadius: 14 }}
                      className="bg-zinc-900 border border-zinc-800 items-center justify-center shadow-sm overflow-hidden"
                    >
                      {myPhotoUrl ? (
                        <Image 
                          source={{ uri: formatGoogleDriveThumbnailUrl(myPhotoUrl, 96) }} 
                          className="w-full h-full"
                          resizeMode="cover"
                        />
                      ) : (
                        <Store size={18} color="#60a5fa" strokeWidth={2.2} />
                      )}
                    </View>
                    {/* Indicador LED de Conexão Dinâmico (Vermelho ➔ Azul ➔ Verde) */}
                    <View
                      className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 ${
                        connectionStatus === "offline"
                          ? "bg-red-500 border-[#180a0a]"
                          : connectionStatus === "restoring"
                          ? "bg-blue-500 border-[#0c1626]"
                          : "bg-emerald-500 border-[#121216]"
                      }`}
                    />
                  </Pressable>

                  <View style={{ flex: 1, minWidth: 0, justifyContent: "center" }}>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <Pressable
                        onPress={() => {
                          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setModalPerfil(true);
                        }}
                        style={{ flexDirection: "row", alignItems: "center", flex: 1, minWidth: 0 }}
                        hitSlop={4}
                      >
                        <Text
                          className={`text-xs font-black uppercase tracking-wider ${
                            isDiscreto ? "text-zinc-500" : "text-white"
                          }`}
                          numberOfLines={1}
                        >
                          {isDiscreto 
                            ? `CAIXA ${caixaId || "01"}` 
                            : `Olá, ${(operatorName || (user?.email ? user.email.split("@")[0] : "Operador")).trim().split(" ")[0]}`}
                        </Text>
                        {!isDiscreto && (
                          <View className="ml-1.5 flex-shrink-0">
                            <Sparkles size={11} color="#fbbf24" strokeWidth={2.5} />
                          </View>
                        )}
                      </Pressable>

                      <Pressable
                        onPress={() => {
                          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setIsDiscreto(!isDiscreto);
                        }}
                        hitSlop={8}
                        className="ml-1 p-0.5 flex-shrink-0"
                      >
                        {isDiscreto ? (
                          <EyeOff size={13} color="#71717a" />
                        ) : (
                          <Eye size={13} color="#a1a1aa" />
                        )}
                      </Pressable>
                    </View>

                    {/* CAIXA E DATA SEMPRE VISÍVEIS */}
                    <Text
                      className="text-[10px] font-black uppercase tracking-wider text-zinc-400 mt-0.5"
                      numberOfLines={1}
                    >
                      CAIXA {caixaId || "01"} • {caixa.turno.dataReferencia}
                    </Text>
                  </View>
                </View>

                {/* LADO DIREITO: 4 BOTÕES DE AÇÃO PERFEITAMENTE ALINHADOS (36x36) */}
                <View style={{ flexDirection: "row", alignItems: "center", flexShrink: 0, gap: 5 }}>
                  {/* 1. Fantasmas / Vales Informais */}
                  <Pressable
                    onPress={() => {
                      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      changeSection("fantasmas");
                    }}
                    style={{ width: 36, height: 36, borderRadius: 13, alignItems: "center", justifyContent: "center" }}
                    className={`border active:scale-95 transition-all relative ${
                      section === "fantasmas"
                        ? "bg-amber-500/20 border-amber-500/40"
                        : "bg-zinc-900 border-zinc-800 active:bg-zinc-800"
                    }`}
                    hitSlop={6}
                  >
                    <Ghost
                      size={16}
                      color={section === "fantasmas" ? "#fbbf24" : "#a1a1aa"}
                      strokeWidth={section === "fantasmas" ? 2.5 : 2}
                    />
                    {(caixa.fantasmas || []).some((f) => !f.resolvido) && (
                      <View className="absolute -top-1 -right-1 h-3.5 min-w-[14px] px-0.5 rounded-full bg-amber-500 border-2 border-[#121216] items-center justify-center">
                        <Text className="text-[7.5px] font-black text-black leading-none">
                          {(caixa.fantasmas || []).filter((f) => !f.resolvido).length}
                        </Text>
                      </View>
                    )}
                  </Pressable>

                  {/* 2. Histórico */}
                  <Pressable
                    onPress={() => {
                      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      changeSection("historico");
                    }}
                    style={{ width: 36, height: 36, borderRadius: 13, alignItems: "center", justifyContent: "center" }}
                    className={`border active:scale-95 transition-all ${
                      section === "historico"
                        ? "bg-zinc-800 border-zinc-700"
                        : "bg-zinc-900 border-zinc-800 active:bg-zinc-800"
                    }`}
                    hitSlop={6}
                  >
                    <CalendarDays
                      size={16}
                      color={section === "historico" ? "#ffffff" : "#a1a1aa"}
                      strokeWidth={section === "historico" ? 2.5 : 2}
                    />
                  </Pressable>

                  {/* 3. Status do Caixa (Aberto / Fechado) */}
                  {isFechado ? (
                    <Pressable
                      onLongPress={() => {
                        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                        handleReabrir();
                      }}
                      delayLongPress={2000}
                      style={{ width: 36, height: 36, borderRadius: 13, alignItems: "center", justifyContent: "center" }}
                      className="border border-red-500/40 bg-red-500/15 active:scale-95"
                      hitSlop={6}
                    >
                      <Lock size={16} color="#f87171" strokeWidth={2.2} />
                    </Pressable>
                  ) : (
                    <Pressable
                      onPress={() => {
                        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setModalFechamento(true);
                      }}
                      style={{ width: 36, height: 36, borderRadius: 13, alignItems: "center", justifyContent: "center" }}
                      className="border border-emerald-500/40 bg-emerald-500/15 active:scale-95"
                      hitSlop={6}
                    >
                      <Unlock size={16} color="#34d399" strokeWidth={2.2} />
                    </Pressable>
                  )}

                  {/* 4. Três Pontos (...) para Menu e Configurações */}
                  <Pressable
                    onPress={() => {
                      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setModalMais(true);
                    }}
                    style={{ width: 36, height: 36, borderRadius: 13, alignItems: "center", justifyContent: "center" }}
                    className="border border-zinc-800 bg-zinc-900 active:scale-95 active:bg-zinc-800"
                    hitSlop={6}
                  >
                    <MoreHorizontal size={16} color="#a1a1aa" />
                  </Pressable>
                </View>

              </View>
            </View>
          </View>

          {/* SEÇÕES PRESERVADAS EM MEMÓRIA (TRANSIÇÃO INSTANTÂNEA 0MS) */}
          {/* SEÇÃO ATIVA (CARREGAMENTO RÁPIDO E ZERO CONSUMO DE CPU EM SEÇÕES INATIVAS) */}
          {section === "painel" && (
            <View style={{ flex: 1 }}>
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
                      onOpenChat={() => setChatVisible(true)}
                      ultimaMensagemGlobal={ultimaMensagemMuralAtiva}
                      ultimoAutorMsg={ultimoAutorMuralObj}
                      fantasmas={caixa.fantasmas || []} 
                      transacoes={caixa.transacoes}
                      logs={caixa.logs}
                      registrosPOS={caixa.registrosPOS || []}
                      registrosConvenio={caixa.registrosConvenio || []}
                      notaDia={caixa.turno.notaDia}
                      onSaveNota={caixa.definirNotaDia}
                      ajusteManualSobra={caixa.turno.ajusteManualSobra} 
                      onAjusteSobra={caixa.definirAjusteSobra}
                      isFechado={isFechado} 
                      isDiscreto={isDiscreto}
                      onNavigateToChecklist={() => changeSection("checklist")}
                    />
                  )}
                </View>
              </ScrollView>
            </View>
          )}

          {section === "transacoes" && (
            <View style={{ flex: 1 }} className="px-3 pt-2">
              <View className="w-full max-w-[460px] self-center flex-1">
                <TransacoesScreen 
                  transacoes={caixa.transacoes} 
                  logs={caixa.logs} 
                  totais={caixa.totais}
                  onAdicionar={caixa.criarTransacao} 
                  onCriarFantasma={caixa.criarFantasma}
                  onExcluir={handleExcluirTransacao} 
                  onEditar={handleEditComLog} 
                  onConfirmar={mostrarAlerta}
                  isFechado={isFechado} 
                />
              </View>
            </View>
          )}

          {section === "checklist" && (
            <View style={{ flex: 1 }} className="px-3 pt-2">
              <View className="w-full max-w-[460px] self-center flex-1">
                <ChecklistScreen 
                  transacoes={caixa.transacoes} 
                  pos={caixa.registrosPOS}
                  convenios={caixa.registrosConvenio}
                  logs={caixa.logs}
                  onToggle={caixa.alternarConferencia} 
                  onTogglePOS={caixa.alternarConferenciaPOS}
                  onToggleConvenio={caixa.alternarConferenciaConvenio}
                  onExcluir={handleExcluirTransacao} 
                  onReportarErro={caixa.reportarErroTransacao}
                  isFechado={isFechado} 
                />
              </View>
            </View>
          )}

          {section === "convenio" && (
            <View style={{ flex: 1 }} className="px-3 pt-2">
              <View className="w-full max-w-[460px] self-center flex-1">
                <ConvenioScreen 
                  registros={caixa.registrosConvenio}
                  onAdicionar={caixa.criarConvenio}
                  onEditar={caixa.editarConvenio}
                  onExcluir={(id) => mostrarAlerta("EXCLUIR", "Deseja apagar este lançamento de convênio?", () => caixa.excluirConvenio(id), true)}
                  isFechado={isFechado} 
                />
              </View>
            </View>
          )}

          {section === "fantasmas" && (
            <View style={{ flex: 1 }} className="px-3 pt-2">
              <View className="w-full max-w-[460px] self-center flex-1">
                <FantasmasScreen 
                  transacoes={caixa.transacoes} 
                  fantasmas={caixa.fantasmas || []} 
                  onCriar={caixa.criarFantasma} 
                  onEditar={caixa.editarFantasma} 
                  onToggleResolvido={caixa.alternarFantasmaResolvido} 
                  onToggleComprovado={caixa.alternarFantasmaComprovado} 
                  onExcluir={(id) => mostrarAlerta("EXCLUIR", "Remover?", () => caixa.excluirFantasma(id), true)} 
                  isFechado={isFechado} 
                />
              </View>
            </View>
          )}

          {section === "historico" && (
            <View style={{ flex: 1 }} className="px-3 pt-2">
              <View className="w-full max-w-[460px] self-center flex-1">
                <HistoricoScreen 
                  turnos={caixa.historicoTurnos} 
                  loading={caixa.loading} 
                  onRefresh={caixa.carregarHistoricoTurnos} 
                  onOpen={(turnoId) => {
                    caixa.carregarTurnoExistente(turnoId);
                    setSection("painel");
                  }} 
                  onExcluirDia={(id) => mostrarAlerta("APAGAR DIA", "Deseja deletar?", () => handleExcluirTurno(id), true)} 
                  onRestaurarDia={(id) => mostrarAlerta("RESTAURAR DIA", "Tem certeza que deseja recuperar este dia da lixeira?", () => caixa.restaurarDia(id))}
                  onDeletarPermanente={(id) => mostrarAlerta("EXCLUSÃO PERMANENTE", "Tem certeza? Esta ação não pode ser desfeita.", () => caixa.deletarDiaPermanente(id), true)}
                  onToggleRepasse={(id, state) => caixa.alternarRepasse(id, state)} 
                  onVoltar={() => {
                    caixa.sairDoDia();
                    setSection("painel");
                  }}
                  textoVoltar="Sair do Dia"
                />
              </View>
            </View>
          )}

          <View style={[styles.navContainer, { pointerEvents: 'box-none' }]}>
            <View style={styles.navInner}>
              {mainSections.map((s) => {
                const active = section === s.key;
                const Icon = s.icon;
                const isCheck = s.key === "checklist";
                return (
                  <Pressable 
                    key={s.key} 
                    style={[styles.navButton, active && styles.navButtonActive]} 
                    onPress={() => changeSection(s.key)}
                    hitSlop={10}
                  >
                    <View style={{ position: 'relative' }}>
                      <Icon size={18} color={active ? "#09090b" : "#a1a1aa"} strokeWidth={active ? 2.5 : 2} />
                      {!active && isCheck && canhotosCount > 0 && (
                        <View style={styles.navBadge}>
                          <Text style={styles.navBadgeText}>{canhotosCount}</Text>
                        </View>
                      )}
                    </View>
                    {active && <Text style={styles.navLabel}>{s.label}</Text>}
                  </Pressable>
                );
              })}
            </View>
          </View>
        </>
      )}
      {/* Chat Modal — Mantido pré-aquecido via React.memo (0ms para abrir e fechar, 0% CPU na tela de vendas) */}
      <ChatModal visible={isChatVisible} onClose={() => setChatVisible(false)} />

      {/* MODAIS GLOBAIS - Deve ficar no fim para sobrepor tudo */}
      {customAlert.visible && (
        <Modal visible transparent animationType="fade">
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
      )}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#09090b" },
  scrollContent: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 130 },
  navContainer: { position: 'absolute', bottom: Platform.OS === 'android' ? 26 : 32, left: 0, right: 0, alignItems: 'center', paddingHorizontal: 8, zIndex: 999 },
  navInner: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 4, 
    borderRadius: 32, 
    borderWidth: 1, 
    borderColor: '#3f3f46', 
    backgroundColor: '#141418', 
    padding: 5, 
    elevation: 12,
    ...(Platform.OS === 'web' 
      ? ({ boxShadow: '0px 10px 20px rgba(0,0,0,0.5)' } as any) 
      : { shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 20 }
    )
  },
  navButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 24, paddingHorizontal: 11, paddingVertical: 9, minHeight: 40, position: 'relative' },
  navButtonActive: { backgroundColor: '#f4f4f5', paddingHorizontal: 15 },
  navLabel: { fontSize: 10.5, fontWeight: '900', color: '#09090b', textTransform: 'uppercase', letterSpacing: 0.5, marginLeft: 6 },
  navBadge: { position: 'absolute', top: -5, right: -7, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#3b82f6', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  navBadgeText: { color: '#ffffff', fontSize: 8.5, fontWeight: '900' }
});
