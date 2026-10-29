import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Platform,
  Linking,
  Keyboard,
  KeyboardAvoidingView,
} from 'react-native';
import {
  X,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  Send,
  PauseCircle,
  PlayCircle,
  Clock,
  CheckCircle2,
  Phone,
  MessageSquare,
  MessageCircle,
  Sparkles,
  ShieldAlert,
  Search,
  Key,
  Calendar,
  Layers,
  ChevronRight,
  User,
  Info,
  SlidersHorizontal,
  FileText,
  Share2,
  CalendarDays,
  CalendarPlus,
  Edit3,
  Check,
  Target,
  Lock,
  UserCheck,
  Calculator,
  TrendingUp,
  Zap,
  Plus,
  Trash2,
  RotateCcw,
  Users,
  Eye,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Activity,
  History,
  HeartPulse,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import {
  ClienteInadimplente,
  InadimplenciaMetricas,
  StatusClienteCobranca,
  DiagnosticoErro,
  DiagnosticoTelefone,
  ExclusaoTemporaria,
  GrupoAgendamento,
  HistoricoDetalheCliente,
  ConfigAutocobranca,
  StatusAutocobrancaAnalise,
  EventoHistoricoCliente,
} from '../types/inadimplencia';
import { 
  InadimplenciaService, 
  TEMPLATE_MENSAGEM_PADRAO, 
  CONFIG_AUTOCOBRANCA_PADRAO 
} from '../services/inadimplencia-service';
import { 
  selecionarTop30Inteligente, 
  ScoreDetalhado, 
  obterProximoDiaUtil, 
  isDataFimDeSemana, 
  calcularDataVencimento,
  isHorarioComercial,
  calcularSaudeFinanceiraCliente
} from '../utils/cobranca-math';
import { getBackofficeCredentials } from '../services/auth-storage';
import { getHojeDataYmd } from '../services/inadimplencia-service';
import { toBrl } from '../utils/currency';

interface InadimplenciaScreenProps {
  visible: boolean;
  onClose: () => void;
  operadorNome?: string;
}

function formatarHoraMinuto(valor?: string, padrao: string = '08:00'): string {
  if (!valor || typeof valor !== 'string') return padrao;
  const limpo = valor.trim();
  if (limpo.includes(' ')) {
    const timePart = limpo.split(' ')[1];
    return timePart ? timePart.slice(0, 5) : padrao;
  }
  if (limpo.includes(':')) {
    return limpo.slice(0, 5);
  }
  return padrao;
}

type TabType = 'top30' | 'fila' | 'compensacao_d1' | 'erro' | 'pausado' | 'enviados24h' | 'agendamentos' | 'todos';

export function InadimplenciaScreen({ visible, onClose, operadorNome = 'Operador' }: InadimplenciaScreenProps) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [clientes, setClientes] = useState<ClienteInadimplente[]>([]);
  const [metricas, setMetricas] = useState<InadimplenciaMetricas | null>(null);
  const [agendamentos, setAgendamentos] = useState<GrupoAgendamento[]>([]);
  const [isFromCache, setIsFromCache] = useState(false);

  // Filtros
  const [tabAtiva, setTabAtiva] = useState<TabType>('top30');
  const [safraFiltro, setSafraFiltro] = useState<string>('Todas');
  const [busca, setBusca] = useState('');

  // Modais internos
  const [modalDiagnostico, setModalDiagnostico] = useState<DiagnosticoErro | null>(null);
  const [modalScoreDetalhado, setModalScoreDetalhado] = useState<{
    cliente: ClienteInadimplente;
    score: ScoreDetalhado;
  } | null>(null);
  const [modalExclusaoCliente, setModalExclusaoCliente] = useState<ClienteInadimplente | null>(null);
  const [modalExclusaoGeral, setModalExclusaoGeral] = useState(false);
  const [modalCobrancaIndividual, setModalCobrancaIndividual] = useState<ClienteInadimplente | null>(null);
  const [modalCookie, setModalCookie] = useState(false);
  const [modalDetalhesContrato, setModalDetalhesContrato] = useState<HistoricoDetalheCliente | null>(null);
  const [modalCriarAgendamento, setModalCriarAgendamento] = useState(false);
  const [modalEditarTemplate, setModalEditarTemplate] = useState(false);

  // Estados de Autocobrança Inteligente da Loja 27
  const [configAutocobranca, setConfigAutocobranca] = useState<ConfigAutocobranca>(CONFIG_AUTOCOBRANCA_PADRAO);
  const [statusAutocobranca, setStatusAutocobranca] = useState<StatusAutocobrancaAnalise | null>(null);
  const [modalConfigAutocobranca, setModalConfigAutocobranca] = useState(false);
  const [salvandoConfigAutocobranca, setSalvandoConfigAutocobranca] = useState(false);
  const [executandoAutocobranca, setExecutandoAutocobranca] = useState(false);

  // Formulário do Modal de Configuração de Autocobrança
  const [formAutocobrancaAtiva, setFormAutocobrancaAtiva] = useState(false);
  const [formAutocobrancaModo, setFormAutocobrancaModo] = useState<'co_piloto' | 'autonomo'>('co_piloto');
  const [formHorarioDiasUteis, setFormHorarioDiasUteis] = useState('09:30');
  const [formHorarioSabado, setFormHorarioSabado] = useState('09:00');
  const [formUrgenciaSabado, setFormUrgenciaSabado] = useState(true);

  // Estados de Registro de Pagamento em Loja (Trava Intraday 48h D+1)
  const [modalRegistrarPagamentoLoja, setModalRegistrarPagamentoLoja] = useState<ClienteInadimplente | null>(null);
  const [valorPagoInformado, setValorPagoInformado] = useState('');
  const [obsPagamentoInformado, setObsPagamentoInformado] = useState('');
  const [salvandoPagamentoLoja, setSalvandoPagamentoLoja] = useState(false);

  // Estados de formulário de exclusão
  const [diasExclusao, setDiasExclusao] = useState<number>(15);
  const [motivoExclusao, setMotivoExclusao] = useState<string>('Promessa de pagamento no balcão');
  const [motivoCustomizado, setMotivoCustomizado] = useState('');

  // Estados de formulário de cobrança individual
  const [telefoneSelecionado, setTelefoneSelecionado] = useState('');
  const [mensagemCobranca, setMensagemCobranca] = useState('');
  const [enviandoCobranca, setEnviandoCobranca] = useState(false);

  // Template dinâmico de mensagem
  const [templateMensagem, setTemplateMensagem] = useState(TEMPLATE_MENSAGEM_PADRAO);

  // Estados de agendamento diário oficial & Review do lote
  const [dataAgendamento, setDataAgendamento] = useState('');
  const [qtdAgendamento, setQtdAgendamento] = useState<number>(30);
  const [enviandoAgendamento, setEnviandoAgendamento] = useState(false);
  const [loteCustomizadoCpfs, setLoteCustomizadoCpfs] = useState<string[]>([]);
  const [subAbaReview, setSubAbaReview] = useState<'selecionados' | 'de_fora'>('selecionados');

  // Estados de Substituição direta & Escolha de candidatos
  const [modalSubstituir, setModalSubstituir] = useState(false);
  const [clienteParaSubstituir, setClienteParaSubstituir] = useState<ClienteInadimplente | null>(null);
  const [buscaSubstituto, setBuscaSubstituto] = useState('');
  const [filtroCategoriaSubstituto, setFiltroCategoriaSubstituto] = useState<'todos' | 'prioritarios' | 'erros'>('todos');
  const [buscaDeFora, setBuscaDeFora] = useState('');
  const [paginaDeFora, setPaginaDeFora] = useState(1);

  // Estados de confirmação e sucesso ao disparar o lote
  const [modalConfirmarDisparo, setModalConfirmarDisparo] = useState(false);
  const [modalSucessoDisparo, setModalSucessoDisparo] = useState<{
    data: string;
    totalClientes: number;
    valorTotal: number;
    msg: string;
  } | null>(null);

  // Estados de Correção rápida de telefone
  const [modalEditarTelefone, setModalEditarTelefone] = useState<ClienteInadimplente | null>(null);
  const [telefoneEditando, setTelefoneEditando] = useState('');
  const [salvandoTelefone, setSalvandoTelefone] = useState(false);

  // Paginação inteligente para a aba Todos (elimina travamentos e crash com 200+ clientes)
  const [paginaExibicao, setPaginaExibicao] = useState(1);
  const ITENS_POR_PAGINA = 30;

  // Modal para visualização detalhada e cancelamento/reversão de agendamento
  const [modalDetalhesAgendamento, setModalDetalhesAgendamento] = useState<GrupoAgendamento | null>(null);
  const [revertendoAgendamento, setRevertendoAgendamento] = useState(false);

  // Estados adicionais de lote e radar
  const [disparandoLote, setDisparandoLote] = useState(false);
  const [salvandoTemplate, setSalvandoTemplate] = useState(false);
  const [radarExpandido, setRadarExpandido] = useState(false);
  const [eventoSelecionado, setEventoSelecionado] = useState<any>(null);

  // Estado de configuração do login / cookie (sem dados hardcoded, carregado do SecureStore)
  const [loginUsuario, setLoginUsuario] = useState('');
  const [loginSenha, setLoginSenha] = useState('');
  const [cookieInput, setCookieInput] = useState('');
  const [fazendoLogin, setFazendoLogin] = useState(false);
  const [loginFeedback, setLoginFeedback] = useState<{ tipo: 'erro' | 'sucesso' | 'aviso'; texto: string } | null>(null);
  const [syncProgress, setSyncProgress] = useState<{ step: string; percent: number } | null>(null);

  // Estados de Histórico & Linha do Tempo do Cliente
  const [historicoClienteAtual, setHistoricoClienteAtual] = useState<EventoHistoricoCliente[]>([]);
  const [carregandoHistorico, setCarregandoHistorico] = useState(false);

  // Modal Global de Feedback / Confirmação (Substitui Alert.alert nativo por modal padronizado e elegante)
  const [customAlertModal, setCustomAlertModal] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type?: 'info' | 'success' | 'warning' | 'error' | 'destructive';
    cancelText?: string;
    confirmText?: string;
    onConfirm?: () => void;
    onCancel?: () => void;
  }>({
    visible: false,
    title: '',
    message: '',
    type: 'info',
  });

  const mostrarAlerta = useCallback((
    title: string,
    message: string,
    options?: {
      type?: 'info' | 'success' | 'warning' | 'error' | 'destructive';
      cancelText?: string;
      confirmText?: string;
      onConfirm?: () => void;
      onCancel?: () => void;
    }
  ) => {
    setCustomAlertModal({
      visible: true,
      title,
      message,
      type: options?.type || 'info',
      cancelText: options?.cancelText,
      confirmText: options?.confirmText || 'Entendido',
      onConfirm: options?.onConfirm,
      onCancel: options?.onCancel,
    });
  }, []);

  const triggerHaptic = (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) => {
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(style);
    }
  };

  // Monitoramento da altura do teclado virtual (GBoard / Samsung / SwiftKey / iOS)
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const onShow = (e: any) => {
      const h = e?.endCoordinates?.height;
      if (typeof h === 'number' && h > 0) {
        setKeyboardHeight(h);
      }
    };
    const onHide = () => {
      setKeyboardHeight(0);
    };

    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      onShow
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      onHide
    );

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const carregarDados = useCallback(async (silencioso = false, forceRefresh = false) => {
    if (!silencioso) setLoading(true);
    try {
      let groups: GrupoAgendamento[] = [];
      try {
        groups = await InadimplenciaService.fetchScheduleGroups(forceRefresh);
        if (Array.isArray(groups)) {
          setAgendamentos(groups);
        }
      } catch (err) {
        console.warn('Erro ao carregar agendamentos:', err);
      }

      const [res, tmpl, cfg] = await Promise.all([
        InadimplenciaService.fetchClientesData(groups, forceRefresh, (step, percent) => {
          setSyncProgress({ step, percent });
        }),
        InadimplenciaService.getTemplateMensagem(),
        InadimplenciaService.getAutocobrancaConfig(),
      ]);

      if (res) {
        if (Array.isArray(res.clientes)) {
          setClientes(res.clientes);
        }
        if (res.metricas) {
          setMetricas(res.metricas);
        }
        setIsFromCache(Boolean(res.fromCache));
      }
      if (tmpl) {
        setTemplateMensagem(tmpl);
      }
      if (cfg) {
        setConfigAutocobranca(cfg);
        setFormAutocobrancaAtiva(cfg.ativa);
        setFormAutocobrancaModo(cfg.modo);
        setFormHorarioDiasUteis(cfg.horarioLimiteDiasUteis || '09:30');
        setFormHorarioSabado(cfg.horarioLimiteSabado || '09:00');
        setFormUrgenciaSabado(cfg.urgenciaSabadoAvulso);

        if (res && res.clientes) {
          const hojeYmd = getHojeDataYmd();
          const loteHojeObj = groups.find((g) => g.schedule_date === hojeYmd) || null;
          const lotesHoje = loteHojeObj ? 1 : 0;
          const contatosHoje = res.metricas?.cotaDiaria.consumido || 0;
          const analise = await InadimplenciaService.analisarStatusAutocobranca(
            res.clientes,
            contatosHoje,
            lotesHoje,
            cfg,
            loteHojeObj
          );
          setStatusAutocobranca(analise);

          // Execução 100% Autônoma com Jitter Anti-Colisão (dispersão aleatória de 0 a 4s para múltiplos dispositivos):
          if (
            cfg.ativa &&
            cfg.modo === 'autonomo' &&
            analise.emAtraso &&
            analise.tipoAcaoSugerida !== 'nenhuma' &&
            analise.clientesSugeridos.length > 0 &&
            (!analise.jaExecutadoHoje || analise.tipoAcaoSugerida === 'recuperacao_erros_avulso')
          ) {
            const jitterMs = Math.floor(Math.random() * 4000);
            const acaoExecucao = analise.tipoAcaoSugerida;
            setTimeout(() => {
              void InadimplenciaService.executarAutocobranca(
                analise.clientesSugeridos,
                acaoExecucao,
                'SQUIRREL AUTO-ROBOT'
              ).then((execRes) => {
                if (execRes.success) {
                  void carregarDados(true, true);
                }
              });
            }, jitterMs);
          }
        }
      }
    } catch (err) {
      console.error('Erro em carregarDados:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setTimeout(() => setSyncProgress(null), 1000);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      void carregarDados();
      // Data padrão de agendamento: próximo dia útil oficial (Segunda a Sábado, 07:00 às 18:00)
      const proximoDiaUtil = obterProximoDiaUtil();
      setDataAgendamento(proximoDiaUtil.dataYmd);

      const unsubscribe = InadimplenciaService.listenAutocobrancaConfig((cfg) => {
        setConfigAutocobranca(cfg);
        setFormAutocobrancaAtiva(cfg.ativa);
        setFormAutocobrancaModo(cfg.modo);
        setFormHorarioDiasUteis(cfg.horarioLimiteDiasUteis || '09:30');
        setFormHorarioSabado(cfg.horarioLimiteSabado || '09:00');
        setFormUrgenciaSabado(cfg.urgenciaSabadoAvulso);
      });

      return () => {
        unsubscribe();
      };
    }
  }, [visible, carregarDados]);

  // Carrega credenciais do cofre seguro do dispositivo ao abrir a tela
  useEffect(() => {
    if (visible) {
      void (async () => {
        try {
          const creds = await getBackofficeCredentials();
          if (creds.user) setLoginUsuario(creds.user);
          if (creds.pass) setLoginSenha(creds.pass);
        } catch {}
      })();
    }
  }, [visible]);

  // Carrega histórico e linha do tempo viva do cliente ao abrir o modal de detalhes
  useEffect(() => {
    if (modalDetalhesContrato?.cpf) {
      setCarregandoHistorico(true);
      void InadimplenciaService.getHistoricoCliente(modalDetalhesContrato.cpf)
        .then((hist) => setHistoricoClienteAtual(hist))
        .catch(() => setHistoricoClienteAtual([]))
        .finally(() => setCarregandoHistorico(false));
    } else {
      setHistoricoClienteAtual([]);
    }
  }, [modalDetalhesContrato?.cpf]);

  // Reseta paginação para o topo sempre que filtros mudarem
  useEffect(() => {
    setPaginaExibicao(1);
  }, [tabAtiva, safraFiltro, busca]);

  // Motor Matemático Inteligente: Seleciona Top 30 prioritários com mapa de scores
  const { top30Clientes, todosElegiveisOrdenados, scoresMap, totalElegiveis } = useMemo(() => {
    const res = selecionarTop30Inteligente(clientes);
    return {
      top30Clientes: res.top30,
      todosElegiveisOrdenados: res.todosElegiveisOrdenados,
      scoresMap: res.scoresMap,
      totalElegiveis: res.totalElegiveis,
    };
  }, [clientes]);

  // Total em Compensação D+1 (Blindados 48h)
  const totalCompensacaoD1 = useMemo(() => {
    return clientes.filter((c) => c.status === 'compensacao_d1' || !!c.pagamentoLojaD1?.ativo).length;
  }, [clientes]);

  // Atalhos Dinâmicos de Dias Úteis Consecutivos (Segunda a Sábado)
  const atalhosDiasUteis = useMemo(() => {
    const list: { label: string; ymd: string }[] = [];
    const base = new Date();
    let curr = new Date(base.getTime());
    const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    while (list.length < 3) {
      curr.setDate(curr.getDate() + 1);
      const dayOfWeek = curr.getDay();
      // Apenas Domingo (0) não é dia de expediente. Sábado a loja opera normalmente!
      if (dayOfWeek !== 0) {
        const y = curr.getFullYear();
        const m = String(curr.getMonth() + 1).padStart(2, '0');
        const d = String(curr.getDate()).padStart(2, '0');
        list.push({
          label: `${list.length === 0 ? 'Próx. ' : ''}${DIAS[dayOfWeek]} (${d}/${m})`,
          ymd: `${y}-${m}-${d}`,
        });
      }
    }
    return list;
  }, []);

  // Lista filtrada em memória com busca ultra-reativa
  const clientesFiltrados = useMemo(() => {
    let base = clientes;
    // Se não houver termo de busca, aplica o filtro da aba ativa normalmente
    if (!busca.trim()) {
      if (tabAtiva === 'top30') {
        base = top30Clientes;
      } else if (tabAtiva === 'todos') {
        base = [...clientes].sort((a, b) => (b.v_inadim || 0) - (a.v_inadim || 0));
      } else if (tabAtiva === 'fila') {
        base = clientes.filter((c) => (c.status === 'fila' || !c.status) && c.cobranca_enviada_24h !== 1 && !c.pagamentoLojaD1?.ativo);
      } else if (tabAtiva === 'compensacao_d1') {
        base = clientes.filter((c) => c.status === 'compensacao_d1' || !!c.pagamentoLojaD1?.ativo);
      } else if (tabAtiva === 'erro') {
        base = clientes.filter((c) => c.status === 'erro');
      } else if (tabAtiva === 'pausado') {
        base = clientes.filter((c) => c.status === 'pausado');
      } else if (tabAtiva === 'enviados24h') {
        base = clientes.filter((c) => c.status === 'enviados24h' || c.cobranca_enviada_24h === 1);
      }
    } else {
      // Ao digitar no campo de busca, busca na CARTEIRA INTEIRA da Loja 27!
      // Assim o usuário nunca fica travado por estar na aba errada (ex: buscando quem tá na fila enquanto tá no Top 30)
      base = [...clientes].sort((a, b) => (b.v_inadim || 0) - (a.v_inadim || 0));
    }

    return base.filter((c) => {
      // Filtro de safra
      if (safraFiltro !== 'Todas') {
        const dias = c.atraso_dias || 0;
        if (safraFiltro === '30-60' && (dias < 30 || dias > 60)) return false;
        if (safraFiltro === '61-90' && (dias < 61 || dias > 90)) return false;
        if (safraFiltro === '91-180' && (dias < 91 || dias > 180)) return false;
        if (safraFiltro === '181-365' && (dias < 181 || dias > 365)) return false;
        if (safraFiltro === '1 ano+' && dias <= 365) return false;
      }

      // Busca Inteligente por Nome, CPF ou Telefone (segura contra crash de campos undefined)
      if (busca.trim()) {
        const query = busca.toLowerCase().trim();
        const cleanDigits = query.replace(/\D/g, '');

        // 1. Busca por Nome
        const nomeCliente = String(c.nome_cliente || (c as any).nome || (c as any).nome_cli || '').toLowerCase();
        const nomeMatch = nomeCliente.includes(query);

        // 2. Busca por CPF (apenas se foram digitados números)
        const cpfDigits = String(c.cpf_cnpj || (c as any).cpf || '').replace(/\D/g, '');
        const cpfMatch = cleanDigits.length > 0 && cpfDigits.includes(cleanDigits);

        // 3. Busca por Telefone (se digitou 4 ou mais dígitos)
        const phoneDigits = String(c.phone || c.phone_api || '').replace(/\D/g, '');
        const phoneMatch = cleanDigits.length >= 4 && phoneDigits.includes(cleanDigits);

        if (!nomeMatch && !cpfMatch && !phoneMatch) return false;
      }

      return true;
    });
  }, [clientes, tabAtiva, safraFiltro, busca, top30Clientes]);

  // Contadores ultra-reativos das abas (sincronizados em tempo real com clientes em memória, Firebase e métricas)
  const contadoresAbas = useMemo(() => {
    let countFila = 0;
    let countErro = 0;
    let countPausado = 0;
    let countEnviados24h = 0;
    let countCompensacaoD1 = 0;

    for (const c of clientes) {
      if (c.status === 'enviados24h' || c.cobranca_enviada_24h === 1) {
        countEnviados24h++;
      } else if (c.status === 'compensacao_d1' || c.pagamentoLojaD1?.ativo) {
        countCompensacaoD1++;
      } else if (c.status === 'pausado') {
        countPausado++;
      } else if (c.status === 'erro') {
        countErro++;
      } else {
        countFila++;
      }
    }

    const enviadosFinal = Math.max(countEnviados24h, metricas?.totalEnviados24h || 0);
    const d1Final = Math.max(countCompensacaoD1, totalCompensacaoD1);
    const erroFinal = Math.max(countErro, metricas?.totalErro || 0);
    const pausadosFinal = Math.max(countPausado, metricas?.totalPausados || 0);
    const filaFinal = metricas?.totalFila !== undefined
      ? Math.max(0, metricas.totalFila)
      : countFila;

    return {
      top30: top30Clientes.length,
      fila: filaFinal,
      compensacao_d1: d1Final,
      erro: erroFinal,
      pausado: pausadosFinal,
      enviados24h: enviadosFinal,
      agendamentos: agendamentos.length,
      todos: metricas?.totalClientes || clientes.length,
    };
  }, [clientes, top30Clientes, metricas, totalCompensacaoD1, agendamentos]);

  // Métricas executivas consolidadas dos lotes de agendamento (visão estratégica para tomada de decisão)
  const resumoAgendamentos = useMemo(() => {
    let agendadosQtd = 0;
    let finalizadosQtd = 0;
    let valorAgendadoTotal = 0;
    let valorDisparadoTotal = 0;
    let clientesAgendadosTotal = 0;
    let clientesDisparadosTotal = 0;
    let sucessosTotal = 0;

    for (const ag of agendamentos) {
      if (ag.status === 'AGENDADO') {
        agendadosQtd++;
        valorAgendadoTotal += (ag.total_value || ag.sent_value || 0);
        clientesAgendadosTotal += (ag.total_count || 0);
      } else {
        finalizadosQtd++;
        valorDisparadoTotal += (ag.sent_value || ag.total_value || 0);
        clientesDisparadosTotal += (ag.total_count || 0);
        sucessosTotal += (ag.success_count || 0);
      }
    }

    const taxaSucesso = clientesDisparadosTotal > 0
      ? Math.round((sucessosTotal / clientesDisparadosTotal) * 100)
      : 100;
    const errosTotal = Math.max(0, clientesDisparadosTotal - sucessosTotal);

    return {
      agendadosQtd,
      finalizadosQtd,
      valorAgendadoTotal,
      valorDisparadoTotal,
      clientesAgendadosTotal,
      clientesDisparadosTotal,
      sucessosTotal,
      errosTotal,
      taxaSucesso,
    };
  }, [agendamentos]);

  // Formatar data de agendamento com dia da semana amigável
  const formatarDataAgendamento = useCallback((ymd: string) => {
    if (!ymd || !ymd.includes('-')) return { dataFmt: ymd, diaSemana: '', isHoje: false };
    const parts = ymd.split('-');
    const ano = parseInt(parts[0], 10);
    const mes = parseInt(parts[1], 10) - 1;
    const dia = parseInt(parts[2], 10);
    const dataObj = new Date(ano, mes, dia, 12, 0, 0);
    const DIAS_EXTENSO = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    const diaSemana = DIAS_EXTENSO[dataObj.getDay()] || '';
    const dataFmt = `${String(dia).padStart(2, '0')}/${String(mes + 1).padStart(2, '0')}/${ano}`;
    const hojeYmd = getHojeDataYmd();
    const isHoje = ymd === hojeYmd;
    return { dataFmt, diaSemana, isHoje };
  }, []);

  // Data atual de referência local
  const hojeYmdAtual = useMemo(() => getHojeDataYmd(), []);

  // Lote oficial exclusivo do dia de hoje (se existir)
  const loteHoje = useMemo(() => {
    return agendamentos.find((a) => a.schedule_date === hojeYmdAtual) || null;
  }, [agendamentos, hojeYmdAtual]);

  // Disparos executados hoje: calculado estritamente sobre a cota de hoje (máximo 30)
  const disparosHoje = useMemo(() => {
    return Math.min(30, Number(metricas?.cotaDiaria?.enviados || (loteHoje ? loteHoje.success_count : 0)));
  }, [metricas, loteHoje]);

  const vagasRestantesHoje = useMemo(() => {
    return Math.max(0, 30 - disparosHoje);
  }, [disparosHoje]);

  // Lotes para o Status Board: EXCLUSIVAMENTE o lote de hoje!
  // Se não houver lote de hoje nem em processamento, não exibe lotes antigos
  const lotesStatusBoard = useMemo(() => {
    if (loteHoje) return [loteHoje];
    const processando = agendamentos.filter((a) => a.is_processing || a.status === 'PROCESSANDO');
    if (processando.length > 0) return [processando[0]];
    return [];
  }, [agendamentos, loteHoje]);

  // Clientes paginados para a listagem (garante fluidez instantânea e 0 travamentos com 200+ clientes)
  const clientesExibidos = useMemo(() => {
    if (tabAtiva === 'top30') return clientesFiltrados;
    return clientesFiltrados.slice(0, paginaExibicao * ITENS_POR_PAGINA);
  }, [clientesFiltrados, paginaExibicao, tabAtiva]);

  // Clientes atualmente dentro do lote selecionado para disparo (buscando em toda a base da loja)
  const clientesLoteSelecionados = useMemo(() => {
    return clientes.filter((c) => loteCustomizadoCpfs.includes(c.cpf_cnpj));
  }, [clientes, loteCustomizadoCpfs]);

  // Todos os clientes da loja que estão FORA do lote atual, ordenados por prioridade (Score decrescente, depois Débito)
  const todosClientesDeFora = useMemo(() => {
    return [...clientes]
      .filter((c) => !loteCustomizadoCpfs.includes(c.cpf_cnpj))
      .sort((a, b) => {
        const scoreA = scoresMap.get(a.cpf_cnpj)?.scoreFinal ?? a.scorePrioridade ?? 0;
        const scoreB = scoresMap.get(b.cpf_cnpj)?.scoreFinal ?? b.scorePrioridade ?? 0;
        if (scoreB !== scoreA) return scoreB - scoreA;
        return b.v_inadim - a.v_inadim;
      });
  }, [clientes, loteCustomizadoCpfs, scoresMap]);

  // Clientes para exibição na aba "Quem Tá de Fora" com busca rápida
  const clientesDeForaFiltrados = useMemo(() => {
    if (!buscaDeFora.trim()) return todosClientesDeFora;
    const q = buscaDeFora.toLowerCase().trim();
    const cleanDigits = q.replace(/\D/g, '');
    return todosClientesDeFora.filter((c) => {
      const nomeOk = c.nome_cliente.toLowerCase().includes(q);
      const cpfOk = cleanDigits.length > 0 && c.cpf_cnpj.replace(/\D/g, '').includes(cleanDigits);
      return nomeOk || cpfOk;
    });
  }, [todosClientesDeFora, buscaDeFora]);

  // Clientes paginados para exibição fluida em "Quem Tá de Fora" (elimina travamentos e re-renders pesados)
  const clientesDeForaExibidos = useMemo(() => {
    return clientesDeForaFiltrados.slice(0, paginaDeFora * 20);
  }, [clientesDeForaFiltrados, paginaDeFora]);

  // Candidatos para o seletor modal de substituição
  const candidatosSubstituicao = useMemo(() => {
    return todosClientesDeFora.filter((c) => {
      if (filtroCategoriaSubstituto === 'prioritarios') {
        const score = scoresMap.get(c.cpf_cnpj)?.scoreFinal ?? c.scorePrioridade ?? 0;
        return score > 0 && c.status !== 'erro';
      }
      if (filtroCategoriaSubstituto === 'erros') {
        return c.status === 'erro' || !c.diagnosticoTelefone?.valido;
      }
      return true;
    }).filter((c) => {
      if (!buscaSubstituto.trim()) return true;
      const q = buscaSubstituto.toLowerCase().trim();
      const cleanDigits = q.replace(/\D/g, '');
      const nomeOk = c.nome_cliente.toLowerCase().includes(q);
      const cpfOk = cleanDigits.length > 0 && c.cpf_cnpj.replace(/\D/g, '').includes(cleanDigits);
      return nomeOk || cpfOk;
    });
  }, [todosClientesDeFora, filtroCategoriaSubstituto, buscaSubstituto, scoresMap]);

  // Saldo total do lote selecionado
  const saldoTotalLote = useMemo(() => {
    return clientesLoteSelecionados.reduce((acc, c) => acc + c.v_inadim, 0);
  }, [clientesLoteSelecionados]);

  // Abrir modal de agendamento já populado com os N primeiros
  const abrirModalCriarAgendamento = useCallback(() => {
    triggerHaptic();
    const cpfsIniciais = todosElegiveisOrdenados.slice(0, qtdAgendamento).map((c) => c.cpf_cnpj);
    setLoteCustomizadoCpfs(cpfsIniciais);
    setSubAbaReview('selecionados');
    setModalCriarAgendamento(true);
  }, [todosElegiveisOrdenados, qtdAgendamento]);

  // Alterar cota e sincronizar
  const handleMudarQtdAgendamento = (novaQtd: number) => {
    triggerHaptic();
    setQtdAgendamento(novaQtd);
    if (loteCustomizadoCpfs.length < novaQtd) {
      const restantes = todosClientesDeFora
        .filter((c) => !loteCustomizadoCpfs.includes(c.cpf_cnpj))
        .slice(0, novaQtd - loteCustomizadoCpfs.length)
        .map((c) => c.cpf_cnpj);
      setLoteCustomizadoCpfs([...loteCustomizadoCpfs, ...restantes]);
    } else if (loteCustomizadoCpfs.length > novaQtd) {
      setLoteCustomizadoCpfs(loteCustomizadoCpfs.slice(0, novaQtd));
    }
  };

  // Remover cliente do lote no Review
  const handleRemoverClienteDoLote = (cpf: string) => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    setLoteCustomizadoCpfs((prev) => prev.filter((item) => item !== cpf));
  };

  // Adicionar cliente de fora ao lote no Review
  const handleAdicionarClienteAoLote = (cpf: string) => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    if (loteCustomizadoCpfs.includes(cpf)) return;
    if (loteCustomizadoCpfs.length >= qtdAgendamento) {
      mostrarAlerta(
        'Limite Atingido',
        `A cota do lote já está em ${qtdAgendamento} clientes. Remova alguém da lista antes de adicionar ou aumente a quantidade.`,
        { type: 'warning' }
      );
      return;
    }
    setLoteCustomizadoCpfs((prev) => [...prev, cpf]);
  };

  // Abrir modal para substituir cliente específico
  const handleAbrirSubstituirCliente = (cliente: ClienteInadimplente) => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    setClienteParaSubstituir(cliente);
    setBuscaSubstituto('');
    setFiltroCategoriaSubstituto('todos');
    setModalSubstituir(true);
  };

  // Abrir modal para preencher vaga aberta
  const handleAbrirAdicionarVagaAberta = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    setClienteParaSubstituir(null);
    setBuscaSubstituto('');
    setFiltroCategoriaSubstituto('todos');
    setModalSubstituir(true);
  };

  // Executar a substituição ou adição do candidato
  const handleExecutarSubstituicao = (novoCliente: ClienteInadimplente) => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    if (loteCustomizadoCpfs.includes(novoCliente.cpf_cnpj)) return;

    if (clienteParaSubstituir) {
      setLoteCustomizadoCpfs((prev) =>
        prev.map((cpf) => (cpf === clienteParaSubstituir.cpf_cnpj ? novoCliente.cpf_cnpj : cpf))
      );
      setModalSubstituir(false);
      setClienteParaSubstituir(null);
    } else {
      if (loteCustomizadoCpfs.length >= qtdAgendamento) {
        mostrarAlerta('Cota Atingida', `O lote já possui ${qtdAgendamento} clientes.`, { type: 'warning' });
        return;
      }
      setLoteCustomizadoCpfs((prev) => [...prev, novoCliente.cpf_cnpj]);
      setModalSubstituir(false);
    }
  };

  // Abrir modal de edição/correção de telefone
  const handleAbrirEditarTelefone = (cliente: ClienteInadimplente) => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    setModalEditarTelefone(cliente);
    setTelefoneEditando(cliente.phone || cliente.phone_api || '');
  };

  // Salvar novo telefone corrigido
  const handleSalvarTelefoneCorrigido = async () => {
    if (!modalEditarTelefone) return;
    setSalvandoTelefone(true);
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);

    await InadimplenciaService.salvarTelefoneCliente(
      modalEditarTelefone.cpf_cnpj,
      telefoneEditando
    );

    setSalvandoTelefone(false);
    setModalEditarTelefone(null);
    await carregarDados(true);
  };

  // Abrir modal para registrar pagamento presencial em loja (Trava 48h D+1)
  const handleAbrirRegistrarPagamentoLoja = (cliente: ClienteInadimplente) => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    setModalRegistrarPagamentoLoja(cliente);
    setValorPagoInformado(cliente.v_inadim ? cliente.v_inadim.toFixed(2).replace('.', ',') : '');
    setObsPagamentoInformado('Pagamento presencial recebido no caixa da Loja 27');
  };

  // Confirmar salvamento do pagamento em loja no Firebase e ativar Trava D+1
  const handleConfirmarPagamentoLoja = async () => {
    if (!modalRegistrarPagamentoLoja) return;
    const valor = parseFloat(valorPagoInformado.replace(/\./g, '').replace(',', '.')) || 0;
    if (valor <= 0) {
      mostrarAlerta('Valor Inválido', 'Por favor, informe o valor recebido no caixa.', { type: 'warning' });
      return;
    }
    setSalvandoPagamentoLoja(true);
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await InadimplenciaService.registrarPagamentoLoja(
        modalRegistrarPagamentoLoja,
        valor,
        operadorNome,
        obsPagamentoInformado.trim() || 'Pagamento no balcão da Loja 27'
      );
      setSalvandoPagamentoLoja(false);
      setModalRegistrarPagamentoLoja(null);
      mostrarAlerta(
        'Trava D+1 Ativada com Sucesso! 🛡️',
        `Pagamento de ${toBrl(valor)} registrado no sistema.\n\nO cliente ${modalRegistrarPagamentoLoja.nome_cliente} está blindado por 48 horas contra mensagens automáticas de cobrança enquanto o BackOffice processa a compensação contábil noturna.`,
        { type: 'success' }
      );
      void carregarDados(true);
    } catch (err: any) {
      setSalvandoPagamentoLoja(false);
      mostrarAlerta('Erro ao Salvar', err?.message || 'Falha ao registrar pagamento.', { type: 'error' });
    }
  };

  // Remover trava de segurança D+1
  const handleRemoverTravaD1 = (cpf: string) => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    mostrarAlerta(
      'Remover Trava D+1?',
      'Deseja cancelar a blindagem temporária de pagamento em loja deste cliente? Ele voltará a ser elegível para disparos de cobrança.',
      {
        type: 'destructive',
        cancelText: 'Voltar',
        confirmText: 'Sim, Remover',
        onConfirm: async () => {
          await InadimplenciaService.removerPagamentoLoja(cpf);
          mostrarAlerta('Trava Removida', 'A blindagem temporária foi revogada com sucesso.', { type: 'success' });
          void carregarDados(true);
        },
      }
    );
  };

  // Auto-Completar Cota (Seleção Automática dos Suplentes pelo Score)
  const handleAutoCompletarCota = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    const faltam = qtdAgendamento - loteCustomizadoCpfs.length;
    if (faltam <= 0) return;

    const suplentes = todosClientesDeFora
      .filter((c) => c.status !== 'pausado' && c.cobranca_enviada_24h !== 1)
      .slice(0, faltam)
      .map((c) => c.cpf_cnpj);
    setLoteCustomizadoCpfs((prev) => [...prev, ...suplentes]);
  };

  // Restaurar Lote Padrão da Matemática
  const handleRestaurarLotePadrao = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    const padrao = todosElegiveisOrdenados.slice(0, qtdAgendamento).map((c) => c.cpf_cnpj);
    setLoteCustomizadoCpfs(padrao);
  };

  // Aplicar pausa de cobrança (exclusão temporária)
  const handleConfirmarExclusaoIndividual = async () => {
    if (!modalExclusaoCliente) return;
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    const motivoFinal = motivoCustomizado.trim() || motivoExclusao;
    const targetCpf = modalExclusaoCliente.cpf_cnpj;

    // Otimista: atualiza status em memória imediatamente
    setClientes((prev) =>
      prev.map((c) =>
        c.cpf_cnpj === targetCpf
          ? { ...c, status: 'pausado' as const }
          : c
      )
    );
    setMetricas((prev) =>
      prev
        ? {
            ...prev,
            totalPausados: (prev.totalPausados || 0) + 1,
            totalFila: Math.max(0, (prev.totalFila || 0) - 1),
          }
        : prev
    );

    await InadimplenciaService.salvarExclusao(
      targetCpf,
      diasExclusao,
      motivoFinal,
      operadorNome
    );

    setModalExclusaoCliente(null);
    setMotivoCustomizado('');
    void carregarDados(true);
  };

  // Aplicar pausa de cobrança em lote (exclusão geral)
  const handleConfirmarExclusaoGeral = async () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
    const cpfs = clientesFiltrados.map((c) => c.cpf_cnpj);
    const motivoFinal = motivoCustomizado.trim() || motivoExclusao;

    const count = await InadimplenciaService.aplicarExclusaoGeral(
      cpfs,
      diasExclusao,
      motivoFinal,
      operadorNome
    );

    setModalExclusaoGeral(false);
    setMotivoCustomizado('');
    mostrarAlerta('Exclusão Aplicada', `${count} clientes foram colocados em pausa de cobrança por ${diasExclusao} dias.`, { type: 'success' });
    void carregarDados(true);
  };

  // Reativar cobrança
  const handleReativarCobranca = async (cpf: string) => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    // Otimista: reativa cliente na fila imediatamente
    setClientes((prev) =>
      prev.map((c) =>
        c.cpf_cnpj === cpf
          ? { ...c, status: 'fila' as const }
          : c
      )
    );
    setMetricas((prev) =>
      prev
        ? {
            ...prev,
            totalPausados: Math.max(0, (prev.totalPausados || 0) - 1),
            totalFila: (prev.totalFila || 0) + 1,
          }
        : prev
    );
    await InadimplenciaService.removerExclusao(cpf);
    void carregarDados(true);
  };

  // Abrir modal de cobrança individual
  const handleAbrirCobrancaIndividual = async (cliente: ClienteInadimplente) => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    setModalCobrancaIndividual(cliente);

    let phoneDestino = cliente.phone || cliente.phone_api || '';
    
    // Tenta obter telefone oficial se estiver vazio
    if (!phoneDestino || phoneDestino.length < 8) {
      const history = await InadimplenciaService.fetchClientHistory(cliente.cpf_cnpj);
      if (history && history.telefones && history.telefones.length > 0) {
        phoneDestino = history.telefones[0].display || history.telefones[0].raw;
      }
    }

    setTelefoneSelecionado(phoneDestino);

    // Formata mensagem dinâmica usando template
    const msgFormatada = InadimplenciaService.formatarMensagemDinamica(templateMensagem, cliente);
    setMensagemCobranca(msgFormatada);
  };

  // Executar disparo individual com sincronismo ultra-reativo em tempo real
  const handleEnviarCobrancaIndividual = async (forcarWhatsappNativo = false) => {
    if (!modalCobrancaIndividual || !telefoneSelecionado.trim()) return;
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    const targetCpf = modalCobrancaIndividual.cpf_cnpj;

    if (forcarWhatsappNativo) {
      await InadimplenciaService.abrirWhatsappNativo(telefoneSelecionado, mensagemCobranca);
      // Otimista: atualiza status imediatamente para enviados24h
      setClientes((prev) =>
        prev.map((c) =>
          c.cpf_cnpj === targetCpf
            ? {
                ...c,
                status: 'enviados24h' as const,
                cobranca_enviada_24h: 1,
                cobranca_ultimo_envio: new Date().toISOString(),
                cobranca_qtd_envios_24h: (c.cobranca_qtd_envios_24h || 0) + 1,
              }
            : c
        )
      );
      setMetricas((prev) =>
        prev
          ? {
              ...prev,
              totalEnviados24h: Math.max((prev.totalEnviados24h || 0) + 1, 1),
              totalFila: Math.max(0, (prev.totalFila || 0) - 1),
            }
          : prev
      );
      setModalCobrancaIndividual(null);
      void carregarDados(true);
      return;
    }

    setEnviandoCobranca(true);
    const res = await InadimplenciaService.sendIndividualCollection(
      modalCobrancaIndividual,
      telefoneSelecionado,
      mensagemCobranca
    );
    setEnviandoCobranca(false);

    if (res.success) {
      triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
      // Otimista: cliente marcado imediatamente como enviados24h e contadores atualizados em 0ms
      setClientes((prev) =>
        prev.map((c) =>
          c.cpf_cnpj === targetCpf
            ? {
                ...c,
                status: 'enviados24h' as const,
                cobranca_enviada_24h: 1,
                cobranca_ultimo_envio: new Date().toISOString(),
                cobranca_qtd_envios_24h: (c.cobranca_qtd_envios_24h || 0) + 1,
              }
            : c
        )
      );
      setMetricas((prev) =>
        prev
          ? {
              ...prev,
              totalEnviados24h: Math.max((prev.totalEnviados24h || 0) + 1, 1),
              totalFila: Math.max(0, (prev.totalFila || 0) - 1),
            }
          : prev
      );
      mostrarAlerta('Sucesso!', res.msg, { type: 'success' });
      setModalCobrancaIndividual(null);
      void carregarDados(true);
    } else if (res.openWhatsappDirect) {
      mostrarAlerta('Aviso de Envio', res.msg, {
        type: 'warning',
        cancelText: 'Cancelar',
        confirmText: 'Abrir WhatsApp',
        onConfirm: () => {
          void InadimplenciaService.abrirWhatsappNativo(telefoneSelecionado, mensagemCobranca);
          setClientes((prev) =>
            prev.map((c) =>
              c.cpf_cnpj === targetCpf
                ? {
                    ...c,
                    status: 'enviados24h' as const,
                    cobranca_enviada_24h: 1,
                    cobranca_ultimo_envio: new Date().toISOString(),
                    cobranca_qtd_envios_24h: (c.cobranca_qtd_envios_24h || 0) + 1,
                  }
                : c
            )
          );
          setMetricas((prev) =>
            prev
              ? {
                  ...prev,
                  totalEnviados24h: Math.max((prev.totalEnviados24h || 0) + 1, 1),
                  totalFila: Math.max(0, (prev.totalFila || 0) - 1),
                }
              : prev
          );
          setModalCobrancaIndividual(null);
          void carregarDados(true);
        },
      });
    } else {
      mostrarAlerta('Erro no Envio', res.msg, { type: 'error' });
    }
  };

  // Exclusão instantânea e segura de agendamento (Apenas lotes AGENDADO ou em processamento)
  const handleExcluirAgendamento = useCallback((ag: GrupoAgendamento) => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
    if (ag.status !== 'AGENDADO' && !ag.is_processing) {
      mostrarAlerta(
        'Lote Concluído',
        'Este lote já foi totalmente executado e finalizado pelo BackOffice. Históricos já concluídos não podem ser revertidos.',
        { type: 'info' }
      );
      return;
    }

    mostrarAlerta(
      'Excluir Agendamento? 🗑',
      `Deseja apagar definitivamente o agendamento de ${ag.schedule_date} no BackOffice?\n\nOs ${ag.total_count} clientes serão liberados imediatamente para a fila de cobrança e a cota diária será restaurada.`,
      {
        type: 'destructive',
        cancelText: 'Cancelar',
        confirmText: 'Sim, Excluir e Liberar',
        onConfirm: async () => {
          triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
          setRevertendoAgendamento(true);
          // OTIMISTA: Remove imediatamente da interface em 0ms
          setAgendamentos((prev) => prev.filter((item) => item.schedule_date !== ag.schedule_date));
          if (modalDetalhesAgendamento?.schedule_date === ag.schedule_date) {
            setModalDetalhesAgendamento(null);
          }
          try {
            const res = await InadimplenciaService.reverterAgendamento(ag.schedule_date, ag.status);
            setRevertendoAgendamento(false);
            mostrarAlerta('Agendamento Excluído! 🗑', res.msg, { type: 'success' });
            void carregarDados(true, true);
          } catch (err: any) {
            setRevertendoAgendamento(false);
            mostrarAlerta('Erro', err?.message || 'Falha ao excluir agendamento.', { type: 'error' });
            void carregarDados(true, true);
          }
        },
      }
    );
  }, [modalDetalhesAgendamento, carregarDados, mostrarAlerta]);

  // Abrir modal de confirmação antes do disparo oficial
  const handleAbrirConfirmarDisparo = () => {
    if (clientesLoteSelecionados.length === 0) {
      mostrarAlerta('Aviso', 'Selecione ao menos 1 cliente no lote para agendar.', { type: 'warning' });
      return;
    }
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    setModalConfirmarDisparo(true);
  };

  // Executar Agendamento Oficial Diário com Lote Revisado
  const handleExecutarDisparoConfirmado = async () => {
    if (!isHorarioComercial()) {
      mostrarAlerta(
        'Operação Bloqueada',
        'O envio de agendamentos só é permitido durante o horário comercial do BackOffice (Seg a Sáb, 07:00 às 18:00).',
        { type: 'warning' }
      );
      setModalConfirmarDisparo(false);
      return;
    }
    if (isDataFimDeSemana(dataAgendamento)) {
      mostrarAlerta(
        'Data Inválida',
        'A data agendada cai em um domingo (sem expediente). Selecione um dia útil (Segunda a Sábado).',
        { type: 'warning' }
      );
      setModalConfirmarDisparo(false);
      return;
    }

    const agendamentoExistente = agendamentos.find(
      (a) => a.schedule_date === dataAgendamento && a.status === 'AGENDADO'
    );
    if (agendamentoExistente) {
      mostrarAlerta(
        'Lote Já Agendado',
        `A data ${dataAgendamento} já possui um agendamento oficial no BackOffice com ${agendamentoExistente.total_count} clientes.\n\nPara reagendar ou enviar uma nova lista, exclua o lote anterior na aba Agendamentos ou selecione outra data.`,
        { type: 'warning' }
      );
      setModalConfirmarDisparo(false);
      return;
    }

    setEnviandoAgendamento(true);
    triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);

    try {
      const res = await InadimplenciaService.criarAgendamentoDiario(
        clientesLoteSelecionados,
        dataAgendamento,
        templateMensagem
      );

      setEnviandoAgendamento(false);
      setModalConfirmarDisparo(false);

      if (!res.success) {
        mostrarAlerta('Agendamento Não Concluído', res.msg, { type: 'error' });
        return;
      }

      // Fecha modais de criação, limpa seleção atual e muda para a aba de agendamentos
      setModalCriarAgendamento(false);
      setLoteCustomizadoCpfs([]);
      setTabAtiva('agendamentos');

      // Otimista: adiciona o lote criado instantaneamente à lista em memória
      setAgendamentos((prev) => [
        {
          schedule_date: dataAgendamento,
          status: 'AGENDADO',
          is_processing: false,
          total_count: clientesLoteSelecionados.length,
          pending_count: clientesLoteSelecionados.length,
          success_count: 0,
          error_count: 0,
          consumed_count: 0,
          daily_limit: 30,
          daily_remaining: Math.max(0, 30 - clientesLoteSelecionados.length),
          total_value: saldoTotalLote,
          sent_value: 0,
          origem: 'app',
          clientes: [...clientesLoteSelecionados],
          clientesCpfs: clientesLoteSelecionados.map((c) => c.cpf_cnpj.replace(/\D/g, '')),
        },
        ...prev.filter((item) => item.schedule_date !== dataAgendamento),
      ]);

      setModalSucessoDisparo({
        data: dataAgendamento,
        totalClientes: clientesLoteSelecionados.length,
        valorTotal: saldoTotalLote,
        msg: res.msg || 'Meta Daily da Loja 27 Clara Eletro agendada com sucesso!',
      });

      // Recarrega os dados de forma suave e forçando sincronização atualizada
      void carregarDados(true, true);
    } catch (err: any) {
      setEnviandoAgendamento(false);
      setModalConfirmarDisparo(false);
      mostrarAlerta('Erro no Disparo', (err && err.message) ? err.message : 'Falha ao agendar lote.', { type: 'error' });
    }
  };

  // Salvar novo template de mensagem
  const handleSalvarTemplate = async () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    await InadimplenciaService.saveTemplateMensagem(templateMensagem);
    setModalEditarTemplate(false);
    mostrarAlerta('Template Salvo', 'A mensagem dinâmica padrão foi atualizada para todas as cobranças da Clara Eletro.', { type: 'success' });
  };

  // Salvar configuração sincronizada de Autocobrança no Firebase RTDB
  const handleSalvarConfigAutocobranca = async () => {
    setSalvandoConfigAutocobranca(true);
    try {
      await InadimplenciaService.saveAutocobrancaConfig({
        ativa: formAutocobrancaAtiva,
        modo: formAutocobrancaModo,
        horarioLimiteDiasUteis: formHorarioDiasUteis.trim() || '09:30',
        horarioLimiteSabado: formHorarioSabado.trim() || '09:00',
        urgenciaSabadoAvulso: formUrgenciaSabado,
      }, operadorNome || 'DEV SQUIRREL');

      setModalConfigAutocobranca(false);
      mostrarAlerta(
        'Configurações Atualizadas',
        'As opções de Autocobrança foram sincronizadas com sucesso para toda a Loja 27 no Firebase.',
        { type: 'success' }
      );
      void carregarDados(true);
    } catch {
      mostrarAlerta('Erro', 'Não foi possível salvar as configurações de autocobrança.', { type: 'error' });
    } finally {
      setSalvandoConfigAutocobranca(false);
    }
  };

  // Disparo aprovado/manual da Autocobrança (Modo Co-Piloto ou Emergência de Sábado)
  const handleDispararAutocobranca = async () => {
    if (!statusAutocobranca || statusAutocobranca.clientesSugeridos.length === 0) return;
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    setExecutandoAutocobranca(true);
    try {
      const res = await InadimplenciaService.executarAutocobranca(
        statusAutocobranca.clientesSugeridos,
        statusAutocobranca.tipoAcaoSugerida === 'nenhuma' ? 'lote_top30' : statusAutocobranca.tipoAcaoSugerida,
        operadorNome || 'DEV SQUIRREL'
      );
      if (res.success) {
        mostrarAlerta('Autocobrança Executada', res.msg, { type: 'success' });
        void carregarDados(true, true);
      } else {
        mostrarAlerta('Aviso da Autocobrança', res.msg, { type: 'warning' });
      }
    } catch (err: any) {
      mostrarAlerta('Erro na Autocobrança', err?.message || 'Falha ao executar autocobrança.', { type: 'error' });
    } finally {
      setExecutandoAutocobranca(false);
    }
  };

  // Executar Login Oficial
  const handleExecutarLogin = async () => {
    setLoginFeedback(null);

    if (!isHorarioComercial()) {
      setLoginFeedback({
        tipo: 'aviso',
        texto: 'Fora do horário limite (06:00 às 18:00). O BackOffice Clara Eletro opera de 06:00 às 18:00.',
      });
      return;
    }

    setFazendoLogin(true);
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);

    const novoCookie = await InadimplenciaService.login(loginUsuario, loginSenha);
    setFazendoLogin(false);

    if (novoCookie) {
      triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
      setLoginFeedback({
        tipo: 'sucesso',
        texto: 'Sessão oficial com a Loja 27 conectada com sucesso!',
      });
      setTimeout(() => {
        setModalCookie(false);
        setLoginFeedback(null);
        void carregarDados(false, true);
      }, 1000);
    } else {
      triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
      setLoginFeedback({
        tipo: 'erro',
        texto: 'Falha na autenticação. Verifique o usuário e senha inseridos.',
      });
    }
  };

  const safras = ['Todas', '30-60', '61-90', '91-180', '181-365', '1 ano+'];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View className="flex-1 bg-[#09090c]">
        {/* TOPBAR PRINCIPAL */}
        <View className="pt-12 pb-3 px-4 bg-[#0d0d12] border-b border-zinc-800 flex-row items-center justify-between">
          <View className="flex-row items-center gap-2 flex-1 min-w-0 mr-1.5">
            <View className="h-9 w-9 rounded-xl bg-cyan-500/15 border border-cyan-500/30 items-center justify-center flex-shrink-0">
              <Sparkles size={18} color="#38bdf8" />
            </View>
            <View className="flex-1 min-w-0">
              <View className="flex-row items-center gap-1.5 flex-wrap">
                <Text className="text-xs font-black text-white uppercase tracking-wider" numberOfLines={1}>
                  Inadimplência
                </Text>
                <View className="px-1.5 py-0.5 rounded bg-cyan-500/20 border border-cyan-500/30">
                  <Text className="text-[8px] font-black text-cyan-300 uppercase">Loja 27</Text>
                </View>
              </View>
              <Text className="text-[9px] text-zinc-400 font-medium truncate mt-0.5">
                {operadorNome} • OneBox
              </Text>
            </View>
          </View>

          <View className="flex-row items-center gap-1 flex-shrink-0">
            {/* CONFIGURAR AUTOCOBRANÇA INTELIGENTE */}
            <Pressable
              onPress={() => {
                triggerHaptic();
                setModalConfigAutocobranca(true);
              }}
              className={`h-8 w-8 rounded-full border items-center justify-center relative active:bg-zinc-800 ${
                configAutocobranca.ativa 
                  ? 'bg-amber-500/15 border-amber-500/50' 
                  : 'bg-zinc-900 border-zinc-800'
              }`}
            >
              <Zap size={13} color={configAutocobranca.ativa ? '#f59e0b' : '#71717a'} />
              {configAutocobranca.ativa && (
                <View className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-amber-400" />
              )}
            </Pressable>

            {/* CONFIGURAR TEMPLATE DINÂMICO */}
            <Pressable
              onPress={() => {
                triggerHaptic();
                setModalEditarTemplate(true);
              }}
              className="h-8 w-8 rounded-full bg-zinc-900 border border-zinc-800 items-center justify-center active:bg-zinc-800"
            >
              <MessageSquare size={13} color="#fbbf24" />
            </Pressable>

            {/* LOGIN / SESSÃO */}
            <Pressable
              onPress={() => {
                triggerHaptic();
                setModalCookie(true);
              }}
              className="h-8 w-8 rounded-full bg-zinc-900 border border-zinc-800 items-center justify-center active:bg-zinc-800"
            >
              <Key size={13} color="#38bdf8" />
            </Pressable>

            {/* ATUALIZAR */}
            <Pressable
              onPress={() => {
                triggerHaptic();
                setRefreshing(true);
                void carregarDados(false, true);
              }}
              className="h-8 w-8 rounded-full bg-zinc-900 border border-zinc-800 items-center justify-center active:bg-zinc-800"
            >
              <RefreshCw size={13} color={refreshing ? '#38bdf8' : '#a1a1aa'} />
            </Pressable>

            {/* FECHAR */}
            <Pressable
              onPress={() => {
                triggerHaptic();
                onClose();
              }}
              className="h-8 w-8 rounded-full bg-zinc-900 border border-zinc-800 items-center justify-center active:bg-zinc-800"
            >
              <X size={15} color="#ffffff" />
            </Pressable>
          </View>
        </View>

        {/* PROGRESS BAR DE SINCRONIZAÇÃO AO VIVO */}
        {syncProgress && (
          <View className="mx-4 mt-2 px-3.5 py-2.5 bg-[#121218] border border-cyan-500/40 rounded-2xl gap-2 shadow-lg">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2 flex-1 mr-2">
                <ActivityIndicator size="small" color="#38bdf8" />
                <Text className="text-[11px] font-bold text-zinc-200 tracking-tight" numberOfLines={1}>
                  {syncProgress.step}
                </Text>
              </View>
              <Text className="text-xs font-black text-cyan-400">
                {syncProgress.percent}%
              </Text>
            </View>
            <View className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
              <View
                className="h-full bg-cyan-400 rounded-full"
                style={{ width: `${Math.min(100, Math.max(5, syncProgress.percent))}%` }}
              />
            </View>
          </View>
        )}

        {loading ? (
          <View className="flex-1 px-4 pt-4 gap-3">
            <View className="h-16 bg-[#121218] border border-zinc-800 rounded-2xl" />
            <View className="flex-row gap-2.5">
              <View className="flex-1 h-24 bg-[#121218] border border-zinc-800 rounded-2xl" />
              <View className="flex-1 h-24 bg-[#121218] border border-zinc-800 rounded-2xl" />
            </View>
            <View className="h-10 bg-[#121218] border border-zinc-800 rounded-xl" />
            <View className="flex-1 gap-3 pt-2">
              {[1, 2, 3].map((k) => (
                <View key={k} className="h-28 bg-[#121218] border border-zinc-800/80 rounded-2xl p-4 gap-2">
                  <View className="h-4 w-48 bg-zinc-800 rounded" />
                  <View className="h-3 w-32 bg-zinc-800/60 rounded" />
                  <View className="flex-row justify-between pt-3 border-t border-zinc-800">
                    <View className="h-5 w-24 bg-zinc-800 rounded" />
                    <View className="h-5 w-20 bg-zinc-800 rounded" />
                  </View>
                </View>
              ))}
            </View>
            <View className="flex-row items-center justify-center gap-2 pb-8">
              <ActivityIndicator size="small" color="#38bdf8" />
              <Text className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
                {syncProgress?.step || 'Carregando carteira de inadimplência da Clara Eletro...'}
              </Text>
            </View>
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 160, paddingHorizontal: 16, paddingTop: 14, gap: 14 }}
          >
            {/* BANNER PROATIVO DE AUTOCOBRANÇA DA LOJA 27 */}
            {statusAutocobranca?.emAtraso && (
              <View className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 gap-3">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2.5 flex-1 mr-2">
                    <View className="h-8 w-8 rounded-xl bg-amber-500/20 border border-amber-500/40 items-center justify-center flex-shrink-0">
                      <Zap size={16} color="#f59e0b" />
                    </View>
                    <View className="flex-1">
                      <View className="flex-row items-center gap-2 flex-wrap">
                        <Text className="text-xs font-black text-amber-300 uppercase tracking-wide">
                          {statusAutocobranca.tipoAcaoSugerida === 'recuperacao_erros_avulso'
                            ? 'Otimização de Cota • Reúso de Erros'
                            : statusAutocobranca.isSabado
                            ? 'Autocobrança Sábado • Casos Críticos'
                            : 'Atraso de Cobrança • Loja 27'}
                        </Text>
                        <View className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/30">
                          <Text className="text-[8px] font-black text-amber-300 uppercase">
                            {statusAutocobranca.tipoAcaoSugerida === 'recuperacao_erros_avulso'
                              ? `+${statusAutocobranca.saldoErrosReaproveitavel || statusAutocobranca.clientesSugeridos.length} Vagas Disponíveis`
                              : statusAutocobranca.tipoAcaoSugerida === 'avulso_sabado_urgente'
                              ? 'Cirúrgico'
                              : 'Top 30 Balanceado'}
                          </Text>
                        </View>
                      </View>
                      <Text className="text-[10px] text-amber-200/80 font-medium mt-0.5">
                        {statusAutocobranca.motivoAtraso}
                      </Text>
                    </View>
                  </View>
                </View>

                <View className="flex-row items-center justify-between pt-2.5 border-t border-amber-500/20">
                  <View>
                    <Text className="text-[9px] text-zinc-400 font-bold uppercase">
                      Recuperação Estimada
                    </Text>
                    <Text className="text-sm font-black text-amber-400">
                      {toBrl(statusAutocobranca.valorTotalSugerido)}
                      <Text className="text-[10px] font-medium text-zinc-400"> ({statusAutocobranca.clientesSugeridos.length} clientes)</Text>
                    </Text>
                  </View>

                  <Pressable
                    onPress={handleDispararAutocobranca}
                    disabled={executandoAutocobranca}
                    className="px-3.5 py-2 rounded-xl bg-amber-500 border border-amber-400 flex-row items-center gap-1.5 active:bg-amber-600"
                  >
                    {executandoAutocobranca ? (
                      <ActivityIndicator size="small" color="#09090c" />
                    ) : (
                      <>
                        <Zap size={13} color="#09090c" />
                        <Text className="text-[10px] font-black uppercase text-zinc-950">
                          {statusAutocobranca.tipoAcaoSugerida === 'recuperacao_erros_avulso'
                            ? `Cobrar ${statusAutocobranca.clientesSugeridos.length} Suplentes Avulsos`
                            : statusAutocobranca.tipoAcaoSugerida === 'avulso_sabado_urgente'
                            ? 'Cobrar Casos Urgentes'
                            : 'Disparar Cota Oficial'}
                        </Text>
                      </>
                    )}
                  </Pressable>
                </View>
              </View>
            )}

            {/* STATUS DO WHATSAPP E META DAILY DA LOJA */}
            <View className="bg-[#121218] border border-zinc-800 rounded-2xl p-3.5 gap-2.5">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-2">
                  <View className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  <Text className="text-xs font-black uppercase text-zinc-200">
                    WHATSAPP: CONECTADO
                  </Text>
                </View>

                {/* BOTÃO CRIAR AGENDAMENTO DIÁRIO (FOCO DA LOJA) */}
                <Pressable
                  onPress={abrirModalCriarAgendamento}
                  className="px-3 py-1.5 rounded-xl bg-cyan-500 border border-cyan-400 flex-row items-center gap-1.5 active:bg-cyan-600"
                >
                  <CalendarPlus size={13} color="#09090c" />
                  <Text className="text-[10px] font-black uppercase text-zinc-950">
                    Criar Agendamento
                  </Text>
                </Pressable>
              </View>

              <Text className="text-[10px] text-zinc-400 font-medium">
                Criar o agendamento conta como meta daily para o setor de cobrança da Clara Eletro.
              </Text>
            </View>

            {/* CARDS DE KPIS */}
            <View className="flex-row gap-2.5">
              {/* CONSUMO DIÁRIO */}
              <View className="flex-1 bg-[#121218] border border-zinc-800 rounded-2xl p-3.5 justify-between">
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
                    Consumo Diário
                  </Text>
                  <Clock size={13} color="#38bdf8" />
                </View>

                <Text className="text-xl font-black text-white">
                  {disparosHoje}
                  <Text className="text-xs font-bold text-zinc-500"> / 30 disparos</Text>
                </Text>

                <View className="w-full h-1.5 bg-zinc-800 rounded-full mt-2 overflow-hidden">
                  <View
                    className="h-full bg-cyan-400 rounded-full"
                    style={{
                      width: `${Math.min(100, (disparosHoje / 30) * 100)}%`,
                    }}
                  />
                </View>
                <Text className="text-[9px] text-zinc-500 font-medium mt-1">
                  {vagasRestantesHoje} vagas restantes hoje
                </Text>
              </View>

              {/* TOTAL EM ATRASO OFICIAL (R$ 234.226,68) */}
              <View className="flex-1 bg-[#121218] border border-zinc-800 rounded-2xl p-3.5 justify-between">
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
                    Total Inadimplência
                  </Text>
                  <ShieldAlert size={13} color="#ef4444" />
                </View>

                <Text className="text-lg font-black text-rose-400">
                  {toBrl(metricas?.valorTotalInadim || 0)}
                </Text>

                <Text className="text-[9px] text-zinc-500 font-medium mt-1">
                  {metricas?.totalClientes || clientes.length} clientes • C. Purupuru
                </Text>
              </View>
            </View>

            {/* ══════════ STATUS BOARD — LOTE DE HOJE EM TEMPO REAL ══════════ */}
            {lotesStatusBoard.length > 0 && (
              <View className="bg-[#0c0d14] border border-sky-500/30 rounded-2xl overflow-hidden">
                {/* HEADER DO STATUS BOARD */}
                <View className="px-3.5 py-2.5 bg-sky-500/8 border-b border-sky-500/20 flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2 flex-1 min-w-0 mr-2">
                    <View className="w-2 h-2 rounded-full bg-sky-400" style={{ opacity: lotesStatusBoard.some(a => a.is_processing || a.status === 'PROCESSANDO') ? 1 : 0.4 }} />
                    <Zap size={13} color="#38bdf8" />
                    <Text className="text-[11px] font-black uppercase tracking-wider text-sky-200 truncate">
                      Status Board • Lote de Hoje
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-1.5 flex-shrink-0">
                    <Pressable
                      onPress={() => {
                        triggerHaptic();
                        void carregarDados(true, true);
                      }}
                      className="px-2 py-0.5 rounded-full bg-sky-500/15 border border-sky-500/30 flex-row items-center gap-1 active:bg-sky-500/30"
                    >
                      <RefreshCw size={8} color="#38bdf8" />
                      <Text className="text-[8px] font-black uppercase text-sky-300">Sync</Text>
                    </Pressable>
                    <View className={`px-2 py-0.5 rounded-full border ${
                      lotesStatusBoard.some(a => a.is_processing || a.status === 'PROCESSANDO')
                        ? 'bg-amber-500/20 border-amber-500/40'
                        : lotesStatusBoard.some(a => a.status === 'AGENDADO')
                        ? 'bg-purple-500/20 border-purple-500/40'
                        : 'bg-emerald-500/20 border-emerald-500/30'
                    }`}>
                      <Text className={`text-[8px] font-black uppercase ${
                        lotesStatusBoard.some(a => a.is_processing || a.status === 'PROCESSANDO')
                          ? 'text-amber-300'
                          : lotesStatusBoard.some(a => a.status === 'AGENDADO')
                          ? 'text-purple-300'
                          : 'text-emerald-300'
                      }`}>
                        {lotesStatusBoard.some(a => a.is_processing || a.status === 'PROCESSANDO')
                          ? '⟳ Processando'
                          : lotesStatusBoard.some(a => a.status === 'AGENDADO')
                          ? '● Aguardando'
                          : '✓ Concluído'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* EXIBIÇÃO EXCLUSIVA DO LOTE DE HOJE */}
                <View className="p-3 gap-2.5">
                  {lotesStatusBoard.map((ag, idx) => {
                    const isProcessando = ag.is_processing || ag.status === 'PROCESSANDO';
                    const isAgendado = ag.status === 'AGENDADO';
                    const { dataFmt, isHoje } = formatarDataAgendamento(ag.schedule_date);
                    const total = ag.total_count || 0;
                    const enviados = ag.success_count || 0;
                    const pendentes = ag.pending_count || 0;
                    const erros = ag.error_count || 0;
                    const progresso = total > 0 ? Math.round(((enviados + erros) / total) * 100) : 0;
                    const valorTotal = ag.total_value || ag.sent_value || 0;
                    const valorEnviado = ag.sent_value || 0;

                    return (
                      <View
                        key={`sb-${idx}`}
                        className={`rounded-xl border p-3 gap-2.5 ${
                          isProcessando
                            ? 'bg-amber-500/5 border-amber-500/30'
                            : isAgendado
                            ? 'bg-purple-500/5 border-purple-500/25'
                            : 'bg-zinc-900/60 border-zinc-800'
                        }`}
                      >
                        {/* LINHA 1: DATA + STATUS BADGE */}
                        <View className="flex-row items-center justify-between">
                          <View className="flex-row items-center gap-2 flex-1 min-w-0 mr-2">
                            <View className={`w-6 h-6 rounded-lg items-center justify-center ${
                              isProcessando ? 'bg-amber-500/20' : isAgendado ? 'bg-purple-500/20' : 'bg-emerald-500/20'
                            }`}>
                              {isProcessando ? (
                                <ActivityIndicator size="small" color="#fbbf24" style={{ transform: [{ scale: 0.6 }] }} />
                              ) : isAgendado ? (
                                <Clock size={12} color="#c084fc" />
                              ) : (
                                <CheckCircle2 size={12} color="#34d399" />
                              )}
                            </View>
                            <View className="flex-1 min-w-0">
                              <View className="flex-row items-center gap-1.5">
                                <Text className="text-[11px] font-black text-white">{dataFmt}</Text>
                                {isHoje && (
                                  <View className="px-1 py-0.5 rounded bg-amber-500/20 border border-amber-500/40">
                                    <Text className="text-[7px] font-black text-amber-300 uppercase">Hoje</Text>
                                  </View>
                                )}
                              </View>
                            </View>
                          </View>
                          <View className={`px-2 py-0.5 rounded-full border ${
                            isProcessando
                              ? 'bg-amber-500/20 border-amber-500/40'
                              : isAgendado
                              ? 'bg-purple-500/15 border-purple-500/30'
                              : 'bg-emerald-500/15 border-emerald-500/30'
                          }`}>
                            <Text className={`text-[8px] font-black uppercase ${
                              isProcessando ? 'text-amber-300' : isAgendado ? 'text-purple-300' : 'text-emerald-300'
                            }`}>
                              {ag.status || (isProcessando ? 'PROCESSANDO' : isAgendado ? 'AGENDADO' : 'FINALIZADO')}
                            </Text>
                          </View>
                        </View>

                        {/* LINHA 2: GRID DE CONTADORES — Total | Enviados | Pendentes | Erros */}
                        <View className="flex-row items-stretch gap-1.5">
                          <View className="flex-1 bg-zinc-900/80 rounded-lg p-2 items-center">
                            <Text className="text-[7px] font-black uppercase text-zinc-500">Total</Text>
                            <Text className="text-sm font-black text-white font-mono">{total}</Text>
                          </View>
                          <View className="flex-1 bg-emerald-500/8 rounded-lg p-2 items-center border border-emerald-500/20">
                            <Text className="text-[7px] font-black uppercase text-emerald-500">Enviados</Text>
                            <Text className="text-sm font-black text-emerald-400 font-mono">{enviados}</Text>
                          </View>
                          <View className="flex-1 bg-sky-500/8 rounded-lg p-2 items-center border border-sky-500/20">
                            <Text className="text-[7px] font-black uppercase text-sky-500">Pendentes</Text>
                            <Text className="text-sm font-black text-sky-400 font-mono">{pendentes}</Text>
                          </View>
                          <View className="flex-1 bg-rose-500/8 rounded-lg p-2 items-center border border-rose-500/20">
                            <Text className="text-[7px] font-black uppercase text-rose-500">Erros</Text>
                            <Text className="text-sm font-black text-rose-400 font-mono">{erros}</Text>
                          </View>
                        </View>

                        {/* LINHA 3: BARRA DE PROGRESSO + VALORES */}
                        <View className="gap-1">
                          <View className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden flex-row">
                            {total > 0 ? (
                              <>
                                <View
                                  className="h-full bg-emerald-500"
                                  style={{ width: `${Math.max(0, (enviados / total) * 100)}%` }}
                                />
                                <View
                                  className="h-full bg-rose-500"
                                  style={{ width: `${Math.max(0, (erros / total) * 100)}%` }}
                                />
                                {isProcessando && pendentes > 0 && (
                                  <View
                                    className="h-full bg-amber-500/40"
                                    style={{ width: `${Math.max(0, (pendentes / total) * 100)}%` }}
                                  />
                                )}
                              </>
                            ) : (
                              <View className="h-full bg-zinc-700 w-full" />
                            )}
                          </View>
                          <View className="flex-row items-center justify-between">
                            <Text className="text-[9px] font-bold text-zinc-400">
                              {isProcessando
                                ? `${progresso}% concluído • ${pendentes} restante${pendentes !== 1 ? 's' : ''}`
                                : isAgendado
                                ? `Aguardando processamento • ${total} na fila`
                                : `100% concluído • ${enviados} ok, ${erros} erro${erros !== 1 ? 's' : ''}`}
                            </Text>
                            <Text className="text-[9px] font-mono font-bold text-zinc-500">
                              {enviados + erros}/{total}
                            </Text>
                          </View>
                        </View>

                        {/* LINHA 4: VALORES FINANCEIROS */}
                        <View className="flex-row items-center justify-between pt-1.5 border-t border-zinc-800/60">
                          <View className="flex-row items-center gap-1.5">
                            <Text className="text-[8px] font-black uppercase text-zinc-500">Valor Cobrado:</Text>
                            <Text className="text-[11px] font-black text-emerald-400 font-mono">
                              {toBrl(valorEnviado)}
                            </Text>
                          </View>
                          <View className="flex-row items-center gap-1.5">
                            <Text className="text-[8px] font-black uppercase text-zinc-500">Valor Total:</Text>
                            <Text className="text-[11px] font-black text-zinc-300 font-mono">
                              {toBrl(valorTotal)}
                            </Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* BOTÃO E PAINEL RADAR & CONTADORES OFICIAIS DO BACKOFFICE */}
            <View className="bg-[#121218] border border-zinc-800 rounded-2xl overflow-hidden">
              <Pressable
                onPress={() => {
                  triggerHaptic();
                  setRadarExpandido((prev) => !prev);
                }}
                className="p-3.5 flex-row items-center justify-between gap-2 active:bg-zinc-800/60"
              >
                <View className="flex-row items-center gap-2 flex-1 min-w-0 flex-wrap">
                  <BarChart3 size={15} color="#38bdf8" className="flex-shrink-0" />
                  <Text className="text-xs font-black uppercase text-zinc-200 tracking-wider flex-shrink-0">
                    Radar & Contadores
                  </Text>
                  <View className={`px-2 py-0.5 rounded-full border flex-row items-center gap-1 flex-shrink-0 ${
                    metricas?.statusCriticidade === 'critico'
                      ? 'bg-rose-500/20 border-rose-500/40'
                      : metricas?.statusCriticidade === 'alerta'
                      ? 'bg-amber-500/20 border-amber-500/40'
                      : 'bg-emerald-500/20 border-emerald-500/30'
                  }`}>
                    {metricas?.statusCriticidade === 'critico' && <AlertTriangle size={9} color="#f43f5e" />}
                    <Text className={`text-[8px] font-black uppercase ${
                      metricas?.statusCriticidade === 'critico'
                        ? 'text-rose-300'
                        : metricas?.statusCriticidade === 'alerta'
                        ? 'text-amber-300'
                        : 'text-emerald-300'
                    }`}>
                      {metricas?.criticidade || 'Calculando...'}
                    </Text>
                  </View>
                </View>
                <View className="flex-row items-center gap-1 flex-shrink-0">
                  <Text className="text-[10px] font-bold text-zinc-400">
                    {radarExpandido ? 'Recolher' : 'Diagnóstico'}
                  </Text>
                  {radarExpandido ? (
                    <ChevronUp size={14} color="#a1a1aa" />
                  ) : (
                    <ChevronDown size={14} color="#a1a1aa" />
                  )}
                </View>
              </Pressable>

              {radarExpandido && (
                <View className="p-3.5 pt-0 gap-2.5 border-t border-zinc-800/80">
                  {/* CARD DE INADIMPLÊNCIA OFICIAL (BACKOFFICE ONEBOX) */}
                  <View className="bg-emerald-950/25 border border-emerald-500/40 rounded-xl p-3 gap-1.5 mt-2.5">
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center gap-1.5 flex-1 min-w-0 mr-2">
                        <CheckCircle2 size={14} color="#34d399" className="flex-shrink-0" />
                        <Text className="text-[10px] font-black uppercase text-emerald-300 truncate">
                          Painel Oficial OneBox • Loja 27
                        </Text>
                      </View>
                      <Text className="text-xs font-mono font-black text-emerald-300 flex-shrink-0">
                        {toBrl(metricas?.valorTotalInadim || 0)}
                      </Text>
                    </View>
                    <Text className="text-[9px] text-zinc-300 leading-relaxed font-medium">
                      Inadimplência da carteira de <Text className="text-emerald-400 font-bold">{metricas?.percInadimplencia ?? 0}%</Text> ({toBrl(metricas?.valorTotalInadim || 0)} de {toBrl(metricas?.valorTotalOriginal || 0)} original).
                    </Text>
                  </View>

                  <View className="flex-row gap-2">
                    <View className="flex-1 bg-zinc-900/90 border border-zinc-800 rounded-xl p-2.5">
                      <Text className="text-[8px] font-black uppercase text-zinc-500">Valor Original Total</Text>
                      <Text className="text-xs font-black text-zinc-200 mt-0.5">
                        {toBrl(metricas?.valorTotalOriginal || 0)}
                      </Text>
                    </View>
                    <View className="flex-1 bg-zinc-900/90 border border-zinc-800 rounded-xl p-2.5">
                      <Text className="text-[8px] font-black uppercase text-zinc-500">Total Recebido (Baixas)</Text>
                      <Text className="text-xs font-black text-emerald-400 mt-0.5">
                        {toBrl(metricas?.valorTotalRecebido || 0)}
                      </Text>
                    </View>
                  </View>

                  <View className="flex-row gap-2">
                    <View className="flex-1 bg-zinc-900/90 border border-zinc-800 rounded-xl p-2.5">
                      <Text className="text-[8px] font-black uppercase text-zinc-500">% Inadimplência</Text>
                      <Text className="text-xs font-black text-emerald-400 mt-0.5">
                        {metricas?.percInadimplencia ?? 0}% da Carteira
                      </Text>
                    </View>
                    <View className="flex-1 bg-zinc-900/90 border border-zinc-800 rounded-xl p-2.5">
                      <Text className="text-[8px] font-black uppercase text-zinc-500">Previsão de Perda</Text>
                      <Text className="text-xs font-black text-rose-400 mt-0.5">
                        {toBrl(metricas?.previsaoPerda || 0)}
                      </Text>
                    </View>
                  </View>

                  <View className="flex-row gap-2">
                    <View className="flex-1 bg-zinc-900/90 border border-zinc-800 rounded-xl p-2.5">
                      <Text className="text-[8px] font-black uppercase text-zinc-500">PNP (1ª Parcela Não Paga)</Text>
                      <Text className="text-xs font-black text-purple-300 mt-0.5">
                        {toBrl(metricas?.pnpTotal || 0)}
                      </Text>
                    </View>
                    <View className="flex-1 bg-zinc-900/90 border border-zinc-800 rounded-xl p-2.5">
                      <Text className="text-[8px] font-black uppercase text-zinc-500">Cliente Novo R$</Text>
                      <Text className="text-xs font-black text-sky-300 mt-0.5">
                        {toBrl(metricas?.clienteNovoTotal || 0)}
                      </Text>
                    </View>
                  </View>
                </View>
              )}
            </View>

            {/* ABAS COM CONTADORES DE STATUS */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {[
                { key: 'top30', label: 'Top 30 Inteligente', count: contadoresAbas.top30, color: '#38bdf8', highlight: true },
                { key: 'fila', label: 'Fila (Elegíveis)', count: contadoresAbas.fila, color: '#06b6d4' },
                { key: 'compensacao_d1', label: 'D+1 Compensação', count: contadoresAbas.compensacao_d1, color: '#f59e0b' },
                { key: 'erro', label: `Incontactáveis (${contadoresAbas.erro})`, count: contadoresAbas.erro, color: '#ef4444' },
                { key: 'pausado', label: 'Pausados', count: contadoresAbas.pausado, color: '#fbbf24' },
                { key: 'enviados24h', label: '24h (Enviados)', count: contadoresAbas.enviados24h, color: '#22c55e' },
                { key: 'agendamentos', label: 'Agendamentos', count: contadoresAbas.agendamentos, color: '#a855f7' },
                { key: 'todos', label: `Todos (${contadoresAbas.todos})`, count: contadoresAbas.todos, color: '#e2e8f0' },
              ].map((aba) => {
                const ativa = tabAtiva === aba.key;
                return (
                  <Pressable
                    key={aba.key}
                    onPress={() => {
                      triggerHaptic();
                      setTabAtiva(aba.key as TabType);
                    }}
                    className={`px-3 py-2 rounded-xl flex-row items-center gap-2 border ${
                      ativa
                        ? aba.highlight
                          ? 'bg-cyan-500/20 border-cyan-500'
                          : 'bg-zinc-800 border-zinc-600'
                        : 'bg-[#121218] border-zinc-800'
                    }`}
                  >
                    {aba.key === 'top30' && <Sparkles size={12} color={ativa ? '#38bdf8' : '#71717a'} />}
                    {aba.key === 'compensacao_d1' && <Clock size={12} color={ativa ? '#fbbf24' : '#71717a'} />}
                    <Text
                      className={`text-[11px] font-black uppercase ${
                        ativa ? (aba.highlight ? 'text-cyan-300' : 'text-white') : 'text-zinc-400'
                      }`}
                    >
                      {aba.label}
                    </Text>
                    <View
                      className="px-1.5 py-0.5 rounded-md"
                      style={{ backgroundColor: `${aba.color}20` }}
                    >
                      <Text className="text-[9px] font-black" style={{ color: aba.color }}>
                        {aba.count}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* SE FOR ABA DE AGENDAMENTOS: PAINEL EXECUTIVO & HISTÓRICO DE DISPAROS */}
            {tabAtiva === 'agendamentos' ? (
              <View className="gap-3.5">
                {/* CABEÇALHO DA ABA COM AÇÃO DE NOVO AGENDAMENTO (100% RESPONSIVO ANDROID) */}
                <View className="flex-row items-center justify-between gap-2 px-1">
                  <View className="flex-row items-center gap-1.5 flex-1 min-w-0 mr-1">
                    <CalendarDays size={15} color="#a855f7" className="flex-shrink-0" />
                    <Text className="text-xs font-black uppercase tracking-wider text-zinc-200 truncate">
                      Agendamentos
                    </Text>
                    <View className="px-1.5 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 flex-shrink-0">
                      <Text className="text-[9px] font-black text-purple-300 uppercase">
                        {agendamentos.length} {agendamentos.length === 1 ? 'Lote' : 'Lotes'}
                      </Text>
                    </View>
                  </View>
                  <Pressable
                    onPress={abrirModalCriarAgendamento}
                    className="px-2.5 py-1.5 rounded-xl bg-cyan-500/20 border border-cyan-500/50 flex-row items-center gap-1 active:bg-cyan-500/30 flex-shrink-0"
                  >
                    <CalendarPlus size={12} color="#38bdf8" />
                    <Text className="text-[10px] font-black uppercase text-cyan-300">Novo Lote</Text>
                  </Pressable>
                </View>

                {/* PAINEL EXECUTIVO ESTRATÉGICO DE AGENDAMENTOS (100% RESPONSIVO ANDROID) */}
                <View className="bg-gradient-to-br from-[#121124] via-[#0f111a] to-[#0a0b12] border border-purple-500/30 rounded-2xl p-3.5 gap-3 shadow-xl">
                  {/* CABEÇALHO DO PAINEL */}
                  <View className="flex-row items-center justify-between border-b border-purple-500/20 pb-2.5">
                    <View className="flex-row items-center gap-2 flex-1 min-w-0 mr-2">
                      <Sparkles size={14} color="#c084fc" />
                      <Text className="text-[11px] font-black uppercase tracking-wider text-purple-200 truncate">
                        Painel de Metas & Controle Diário
                      </Text>
                    </View>
                    <View className="px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 flex-shrink-0">
                      <Text className="text-[9px] font-black text-cyan-300 uppercase">
                        Cota: 30 / Dia
                      </Text>
                    </View>
                  </View>

                  {/* DUPLA DE CARDS PRINCIPAIS: RESUMO OPERACIONAL & FINANCEIRO */}
                  <View className="flex-row items-stretch gap-2.5">
                    {/* CARD 1: STATUS DOS LOTES */}
                    <View className="flex-1 bg-[#151426] border border-purple-500/30 rounded-xl p-3 justify-between">
                      <View className="flex-row items-center justify-between">
                        <Text className="text-[9px] font-black uppercase tracking-wider text-purple-300" numberOfLines={1}>
                          {resumoAgendamentos.agendadosQtd > 0 ? 'Fila Ativa' : 'Histórico Lotes'}
                        </Text>
                        <Calendar size={12} color="#c084fc" />
                      </View>
                      <View className="my-1">
                        <Text className="text-base font-black text-white" numberOfLines={1}>
                          {resumoAgendamentos.agendadosQtd > 0
                            ? `${resumoAgendamentos.agendadosQtd} ${resumoAgendamentos.agendadosQtd === 1 ? 'Lote Ativo' : 'Lotes Ativos'}`
                            : `${resumoAgendamentos.finalizadosQtd} ${resumoAgendamentos.finalizadosQtd === 1 ? 'Lote Concluído' : 'Lotes Concluídos'}`}
                        </Text>
                      </View>
                      <Text className="text-[10px] text-zinc-400 font-bold" numberOfLines={1}>
                        {resumoAgendamentos.agendadosQtd > 0
                          ? `${resumoAgendamentos.clientesAgendadosTotal} contatos na fila`
                          : `${resumoAgendamentos.clientesDisparadosTotal} contatos disparados`}
                      </Text>
                    </View>

                    {/* CARD 2: VOLUME FINANCEIRO */}
                    <View className="flex-1 bg-[#151426] border border-emerald-500/30 rounded-xl p-3 justify-between">
                      <View className="flex-row items-center justify-between">
                        <Text className="text-[9px] font-black uppercase tracking-wider text-emerald-400" numberOfLines={1}>
                          {resumoAgendamentos.agendadosQtd > 0 ? 'Total Programado' : 'Total Executado'}
                        </Text>
                        <Target size={12} color="#34d399" />
                      </View>
                      <View className="my-1">
                        <Text className="text-base font-black text-emerald-400 font-mono" numberOfLines={1}>
                          {toBrl(
                            resumoAgendamentos.agendadosQtd > 0
                              ? resumoAgendamentos.valorAgendadoTotal
                              : resumoAgendamentos.valorDisparadoTotal
                          )}
                        </Text>
                      </View>
                      <Text className="text-[10px] text-zinc-400 font-bold" numberOfLines={1}>
                        {resumoAgendamentos.agendadosQtd > 0 ? 'Meta Diária Loja 27' : 'Cobrança Acumulada'}
                      </Text>
                    </View>
                  </View>

                  {/* BANNER DE ASSERTIVIDADE & BARRA VISUAL DE TAXA DE ENTREGA */}
                  <View className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-3 gap-2">
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center gap-1.5 flex-1 min-w-0 mr-2">
                        <CheckCircle2 size={13} color="#38bdf8" />
                        <Text className="text-[10px] font-black uppercase text-zinc-300 truncate">
                          Taxa de Entrega WhatsApp
                        </Text>
                      </View>
                      <View className="flex-row items-center gap-1.5 flex-shrink-0">
                        <Text className="text-xs font-black text-sky-300 font-mono">
                          {resumoAgendamentos.taxaSucesso}%
                        </Text>
                        <Text className="text-[9px] text-zinc-400 font-bold">
                          ({resumoAgendamentos.sucessosTotal} de {resumoAgendamentos.clientesDisparadosTotal} ok)
                        </Text>
                      </View>
                    </View>

                    {/* Barra visual de assertividade */}
                    <View className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden flex-row">
                      <View
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${Math.max(5, resumoAgendamentos.taxaSucesso)}%` }}
                      />
                      <View
                        className="h-full bg-rose-500"
                        style={{ width: `${Math.max(0, 100 - resumoAgendamentos.taxaSucesso)}%` }}
                      />
                    </View>

                    <View className="flex-row items-center justify-between pt-1 border-t border-zinc-800/60">
                      <View className="flex-row items-center gap-1 flex-1 min-w-0 mr-2">
                        <Clock size={11} color="#fbbf24" />
                        <Text className="text-[9px] font-bold text-zinc-400 truncate">
                          Disparos às 08:00 AM • Seg a Sáb (07:00 às 18:00)
                        </Text>
                      </View>
                      <Text className="text-[9px] text-zinc-500 font-mono flex-shrink-0">
                        {resumoAgendamentos.finalizadosQtd} lotes processados
                      </Text>
                    </View>
                  </View>
                </View>

                {/* LISTAGEM DE LOTES OU EMPTY STATE */}
                {agendamentos.length === 0 ? (
                  <View className="bg-[#0f111a] border border-zinc-800 rounded-2xl p-6 items-center gap-3">
                    <View className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 items-center justify-center">
                      <CalendarDays size={24} color="#c084fc" />
                    </View>
                    <Text className="text-sm font-black text-white text-center">
                      Nenhum Agendamento Ativo
                    </Text>
                    <Text className="text-xs text-zinc-400 text-center max-w-xs leading-relaxed">
                      A Loja 27 ainda não possui disparos agendados para os próximos dias. Agendar o lote diário garante o cumprimento da meta do setor de cobrança.
                    </Text>
                    <Pressable
                      onPress={abrirModalCriarAgendamento}
                      className="mt-1 px-4 py-2.5 rounded-xl bg-purple-600 border border-purple-400 flex-row items-center gap-2 active:bg-purple-700 shadow-lg shadow-purple-900/40"
                    >
                      <Sparkles size={14} color="#ffffff" />
                      <Text className="text-xs font-black uppercase text-white">
                        Agendar Top 30 Inteligente Agora
                      </Text>
                    </Pressable>
                  </View>
                ) : (
                  agendamentos.map((ag, idx) => {
                    const isProcessando = ag.is_processing || ag.status === 'PROCESSANDO';
                    const isAgendado = !isProcessando && ag.status === 'AGENDADO';
                    const isApp = ag.origem === 'app';
                    const { dataFmt, diaSemana, isHoje } = formatarDataAgendamento(ag.schedule_date);
                    const totalVal = isAgendado ? (ag.total_value || ag.sent_value || 0) : (ag.sent_value || ag.total_value || 0);
                    const ticketMedio = ag.total_count > 0 ? totalVal / ag.total_count : 0;
                    const taxaSucessoLote = ag.total_count > 0 ? Math.round((ag.success_count / ag.total_count) * 100) : 0;

                    return (
                      <View
                        key={idx}
                        className={`border rounded-2xl p-4 gap-3.5 shadow-lg ${
                          isProcessando
                            ? 'bg-[#15120a] border-amber-500/40'
                            : isAgendado
                            ? 'bg-[#121122] border-purple-500/40'
                            : 'bg-[#0f1118] border-zinc-800'
                        }`}
                      >
                        {/* CABEÇALHO DO CARD */}
                        <View className="flex-row items-center justify-between">
                          <View className="flex-row items-center gap-2 flex-1 min-w-0 mr-2">
                            <View className={`w-7 h-7 rounded-lg items-center justify-center ${
                              isProcessando
                                ? 'bg-amber-500/20'
                                : isAgendado
                                ? 'bg-purple-500/20'
                                : 'bg-emerald-500/20'
                            }`}>
                              {isProcessando ? (
                                <ActivityIndicator size="small" color="#fbbf24" style={{ transform: [{ scale: 0.6 }] }} />
                              ) : isAgendado ? (
                                <Calendar size={14} color="#c084fc" />
                              ) : (
                                <Calendar size={14} color="#34d399" />
                              )}
                            </View>
                            <View className="flex-1 min-w-0">
                              <View className="flex-row items-center gap-1.5 flex-wrap">
                                <Text className="text-xs font-black uppercase text-white">
                                  {diaSemana ? `${diaSemana} • ` : ''}{dataFmt}
                                </Text>
                                {isHoje && (
                                  <View className="px-1.5 py-0.2 rounded bg-amber-500/20 border border-amber-500/40">
                                    <Text className="text-[8px] font-black text-amber-300 uppercase">Hoje</Text>
                                  </View>
                                )}
                                {isApp && (
                                  <View className="px-1.5 py-0.2 rounded bg-cyan-500/15 border border-cyan-500/30">
                                    <Text className="text-[8px] font-black text-cyan-300 uppercase">
                                      Squirrel AI
                                    </Text>
                                  </View>
                                )}
                              </View>
                              <Text className="text-[9px] text-zinc-500 font-mono">
                                Data de Disparo: {ag.schedule_date}
                              </Text>
                            </View>
                          </View>

                          <View className={`px-2.5 py-1 rounded-full border ${
                            isProcessando
                              ? 'bg-amber-500/20 border-amber-500/40'
                              : isAgendado
                              ? 'bg-purple-500/20 border-purple-500/40'
                              : 'bg-emerald-500/20 border-emerald-500/40'
                          }`}>
                            <Text className={`text-[9px] font-black uppercase ${
                              isProcessando ? 'text-amber-300' : isAgendado ? 'text-purple-300' : 'text-emerald-300'
                            }`}>
                              {isProcessando ? '⟳ PROCESSANDO' : isAgendado ? '● PROGRAMADO 08:00' : '✓ EXECUTADO'}
                            </Text>
                          </View>
                        </View>

                        {/* BANNER FINANCEIRO DO LOTE */}
                        <View className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-3 flex-row items-center justify-between">
                          <View>
                            <Text className="text-[8px] font-black uppercase tracking-wider text-zinc-500">
                              {isAgendado ? 'Valor do Lote Programado' : 'Valor Total Disparado'}
                            </Text>
                            <Text className="text-base font-black text-emerald-400 font-mono mt-0.5">
                              {toBrl(totalVal)}
                            </Text>
                          </View>
                          <View className="items-end">
                            <Text className="text-[8px] font-black uppercase tracking-wider text-zinc-500">
                              Ticket Médio
                            </Text>
                            <Text className="text-xs font-black text-zinc-300 font-mono mt-0.5">
                              {toBrl(ticketMedio)} / cliente
                            </Text>
                          </View>
                        </View>

                        {/* BARRA VISUAL DE PROGRESSO / PIPELINE */}
                        <View className="gap-1.5">
                          <View className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden flex-row">
                            {isAgendado ? (
                              <View className="h-full bg-purple-500 rounded-full w-full" />
                            ) : (
                              <>
                                <View
                                  className="h-full bg-emerald-500"
                                  style={{ width: `${Math.max(0, (ag.success_count / (ag.total_count || 1)) * 100)}%` }}
                                />
                                <View
                                  className="h-full bg-rose-500"
                                  style={{ width: `${Math.max(0, (ag.error_count / (ag.total_count || 1)) * 100)}%` }}
                                />
                                {isProcessando && ag.pending_count > 0 && (
                                  <View
                                    className="h-full bg-amber-500/50"
                                    style={{ width: `${Math.max(0, (ag.pending_count / (ag.total_count || 1)) * 100)}%` }}
                                  />
                                )}
                              </>
                            )}
                          </View>
                          <View className="flex-row items-center justify-between">
                            <Text className="text-[9px] font-bold text-zinc-400">
                              {isProcessando
                                ? `Disparando: ${ag.success_count} enviados • ${ag.pending_count} na fila • ${ag.error_count} erros`
                                : isAgendado
                                ? 'Fila 100% preparada • Aguardando janela das 08:00 no BackOffice'
                                : `${ag.success_count} entregues • ${ag.error_count} erros • Assertividade: ${taxaSucessoLote}%`}
                            </Text>
                            <Text className="text-[9px] font-mono text-zinc-500">
                              {ag.consumed_count || ag.total_count}/30 cota
                            </Text>
                          </View>
                        </View>

                        {/* GRADE DE 3 COLUNAS COM DETALHES OPERACIONAIS */}
                        <View className="flex-row items-center justify-between pt-2 border-t border-zinc-800/80">
                          <View className="flex-1">
                            <Text className="text-[8px] font-bold uppercase text-zinc-500">Contatos</Text>
                            <Text className="text-xs font-black text-zinc-200 mt-0.5" numberOfLines={1}>
                              {ag.total_count} clientes
                            </Text>
                          </View>

                          <View className="flex-1 items-center">
                            <Text className="text-[8px] font-bold uppercase text-zinc-500">
                              {isProcessando ? 'Status da Fila' : isAgendado ? 'Status da Fila' : 'Disparos OK'}
                            </Text>
                            <Text className={`text-xs font-black mt-0.5 ${
                              isProcessando ? 'text-amber-400' : isAgendado ? 'text-purple-300' : 'text-emerald-400'
                            }`} numberOfLines={1}>
                              {isProcessando
                                ? `${ag.success_count} ok • ${ag.pending_count} pend`
                                : isAgendado
                                ? `${ag.pending_count ?? ag.total_count} na fila`
                                : `${ag.success_count} enviados`}
                            </Text>
                          </View>

                          <View className="flex-1 items-end">
                            <Text className="text-[8px] font-bold uppercase text-zinc-500">Disparo</Text>
                            <Text className="text-xs font-black text-sky-300 font-mono mt-0.5" numberOfLines={1}>
                              08:00 AM
                            </Text>
                          </View>
                        </View>

                        {/* AÇÕES DO AGENDAMENTO: VER CLIENTES & EXCLUIR / CONCLUÍDO */}
                        <View className="flex-row items-center justify-between gap-2 pt-2 border-t border-zinc-800/80">
                          <Pressable
                            onPress={async () => {
                              triggerHaptic();
                              if (!ag.clientes || ag.clientes.length === 0) {
                                const items = await InadimplenciaService.fetchScheduleItems(ag.schedule_date);
                                if (items && items.length > 0) {
                                  ag.clientes = items.map((it: any) => {
                                    const docClean = String(it.doc || it.cpf || '').replace(/\D/g, '');
                                    const matchCarteira = clientes.find((cm) => cm.cpf_cnpj.replace(/\D/g, '') === docClean);
                                    const valRef = Number(it.valor_ref || it.v_inadim || (matchCarteira?.v_inadim || 0));
                                    const atrasoRef = Number(it.atraso_ref || it.atraso_dias || (matchCarteira?.atraso_dias || 15));
                                    const rawStatus = String(it.status || '').toUpperCase();
                                    const itemStatus: 'SUCESSO' | 'ERRO' | 'PENDENTE' = 
                                      rawStatus === 'SUCESSO' || rawStatus === 'ENVIADO' ? 'SUCESSO' :
                                      rawStatus === 'ERRO' ? 'ERRO' : 'PENDENTE';
                                    return {
                                      id_cliente: Number(it.id || it.codigo_cliente || matchCarteira?.id_cliente || 0),
                                      cpf_cnpj: String(it.doc || it.cpf || matchCarteira?.cpf_cnpj || ''),
                                      nome_cliente: String(it.nome || it.nome_cliente || matchCarteira?.nome_cliente || 'Cliente'),
                                      phone: it.phone || matchCarteira?.phone || '',
                                      v_total: valRef,
                                      v_recebido: matchCarteira?.v_recebido || 0,
                                      v_inadim: valRef,
                                      v_previsao: valRef,
                                      contratos: matchCarteira?.contratos || 1,
                                      parcelas_aberto: matchCarteira?.parcelas_aberto || 1,
                                      parcelas_total: matchCarteira?.parcelas_total || 1,
                                      cobranca_enviada_24h: itemStatus === 'SUCESSO' ? 1 : 0,
                                      cobranca_ultimo_envio: it.sent_at || null,
                                      cobranca_qtd_envios_24h: itemStatus === 'SUCESSO' ? 1 : 0,
                                      cobranca_qtd_envios_total: itemStatus === 'SUCESSO' ? 1 : 0,
                                      cobranca_ultimo_envio_geral: it.sent_at || null,
                                      atraso_dias: atrasoRef,
                                      status: (itemStatus === 'SUCESSO' ? 'enviados24h' : itemStatus === 'ERRO' ? 'erro' : 'agendados') as any,
                                      itemStatus,
                                      erroMensagem: it.error_message || undefined,
                                    };
                                  });
                                }
                              }
                              setModalDetalhesAgendamento({ ...ag });
                            }}
                            className="flex-1 py-2.5 px-3 rounded-xl bg-zinc-800 border border-zinc-700 flex-row items-center justify-center gap-1.5 active:bg-zinc-700"
                          >
                            <Eye size={13} color="#38bdf8" />
                            <Text className="text-[10px] font-black uppercase text-zinc-200">
                              Ver Carteira ({ag.total_count})
                            </Text>
                          </Pressable>

                          {(isAgendado || ag.is_processing) ? (
                            <Pressable
                              disabled={revertendoAgendamento}
                              onPress={() => handleExcluirAgendamento(ag)}
                              className="px-3.5 py-2.5 rounded-xl bg-rose-500/15 border border-rose-500/40 flex-row items-center gap-1.5 active:bg-rose-500/30"
                            >
                              <Trash2 size={13} color="#f87171" />
                              <Text className="text-[10px] font-black uppercase text-rose-300">
                                Excluir Agendamento
                              </Text>
                            </Pressable>
                          ) : (
                            <View className="px-3.5 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex-row items-center gap-1">
                              <CheckCircle2 size={12} color="#10b981" />
                              <Text className="text-[10px] font-bold text-emerald-400">
                                Concluído
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            ) : (
              /* SE FOR ABA DE CLIENTES: LISTA, BUSCA E FILTROS */
              <>
                {/* BARRA DE PESQUISA & BOTÃO DE EXCLUSÃO GERAL */}
                <View className="flex-row items-center gap-2">
                  <View className="flex-1 h-11 bg-[#121218] border border-zinc-800 rounded-xl px-3 flex-row items-center gap-2">
                    <Search size={14} color="#71717a" />
                    <TextInput
                      value={busca}
                      onChangeText={setBusca}
                      placeholder="Buscar por Nome, CPF ou Telefone..."
                      placeholderTextColor="#71717a"
                      autoCapitalize="none"
                      autoCorrect={false}
                      className="flex-1 text-xs text-white font-bold"
                    />
                    {busca.length > 0 && (
                      <Pressable onPress={() => setBusca('')}>
                        <X size={14} color="#a1a1aa" />
                      </Pressable>
                    )}
                  </View>

                  {/* BOTÃO DE EXCLUSÃO GERAL */}
                  <Pressable
                    onPress={() => {
                      triggerHaptic();
                      setModalExclusaoGeral(true);
                    }}
                    className="h-11 px-3.5 bg-amber-500/15 border border-amber-500/40 rounded-xl flex-row items-center gap-1.5 active:bg-amber-500/25"
                  >
                    <PauseCircle size={15} color="#fbbf24" strokeWidth={2.5} />
                    <Text className="text-[10px] font-black uppercase text-amber-300">
                      Exclusão Geral
                    </Text>
                  </Pressable>
                </View>

                {/* CARROSSEL DE SAFRAS */}
                <View className="flex-row items-center gap-1.5">
                  <Text className="text-[10px] font-black uppercase text-zinc-500 mr-1">Safra:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                    {safras.map((s) => {
                      const ativa = safraFiltro === s;
                      return (
                        <Pressable
                          key={s}
                          onPress={() => {
                            triggerHaptic();
                            setSafraFiltro(s);
                          }}
                          className={`px-2.5 py-1 rounded-lg border ${
                            ativa
                              ? 'bg-cyan-500/20 border-cyan-500/40'
                              : 'bg-[#121218] border-zinc-800'
                          }`}
                        >
                          <Text
                            className={`text-[10px] font-bold ${
                              ativa ? 'text-cyan-300 font-black' : 'text-zinc-400'
                            }`}
                          >
                            {s}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>

                {/* BANNER PREVIA DA META DAILY (TOP 30) */}
                {tabAtiva === 'top30' && (
                  <View className="bg-cyan-500/10 border border-cyan-500/30 rounded-2xl p-3.5 gap-2.5">
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center gap-2 flex-1 min-w-0 mr-2">
                        <View className="h-8 w-8 rounded-xl bg-cyan-500/20 border border-cyan-500/40 items-center justify-center flex-shrink-0">
                          <Target size={16} color="#38bdf8" />
                        </View>
                        <View className="flex-1 min-w-0">
                          <Text className="text-xs font-black uppercase text-white">
                            Prévia da Meta Daily (Top 30)
                          </Text>
                          <Text className="text-[10px] text-zinc-400 mt-0.5">
                            {top30Clientes.length} selecionados • {toBrl(top30Clientes.reduce((acc, c) => acc + c.v_inadim, 0))} em cobrança
                          </Text>
                        </View>
                      </View>

                      <Pressable
                        onPress={abrirModalCriarAgendamento}
                        className="px-3 py-2 rounded-xl bg-cyan-500 border border-cyan-400 flex-row items-center gap-1.5 active:bg-cyan-600 flex-shrink-0"
                      >
                        <Eye size={13} color="#09090c" />
                        <Text className="text-[10px] font-black uppercase text-zinc-950">
                          Revisar Lote
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                )}

                {/* LISTAGEM DE CLIENTES */}
                <View className="gap-3 mt-1">
                  <View className="flex-row items-center justify-between px-1">
                    <Text className="text-[11px] font-black uppercase tracking-wider text-zinc-500">
                      Clientes ({clientesExibidos.length} de {clientesFiltrados.length})
                    </Text>
                    <Text className="text-[10px] text-zinc-500 font-medium">
                      Toque em Cobrar Avulso ou Pausar
                    </Text>
                  </View>

                  {clientesExibidos.map((cliente) => {
                    const isPausado = cliente.status === 'pausado';
                    const isErro = cliente.status === 'erro';
                    const isEnviado = cliente.status === 'enviados24h';
                    const isCompensacaoD1 = cliente.status === 'compensacao_d1' || !!cliente.pagamentoLojaD1?.ativo;
                    const telDiag = cliente.diagnosticoTelefone;
                    const scoreObj = cliente.scoreDetalhado || scoresMap.get(cliente.cpf_cnpj);
                    const scoreVal = scoreObj?.scoreFinal ?? cliente.scorePrioridade ?? 0;

                    return (
                      <View
                        key={cliente.cpf_cnpj}
                        className={`bg-[#121218] rounded-2xl p-4 border gap-3 ${
                          isCompensacaoD1
                            ? 'border-amber-500/40 bg-amber-950/10'
                            : isErro
                            ? 'border-rose-500/30'
                            : isPausado
                            ? 'border-amber-500/30'
                            : isEnviado
                            ? 'border-emerald-500/30'
                            : 'border-zinc-800'
                        }`}
                      >
                        {/* HEADER DO CARD: NOME E STATUS */}
                        <View className="flex-row items-start justify-between gap-2">
                          <View className="flex-1 min-w-0">
                            <Text className="text-xs font-black uppercase text-white truncate" numberOfLines={1}>
                              {cliente.nome_cliente}
                            </Text>
                            <Text className="text-[10px] text-zinc-400 font-mono mt-0.5">
                              CPF: {cliente.cpf_cnpj} • Cód: {cliente.id_cliente} • <Text className="text-cyan-300 font-semibold">{cliente.diagnosticoTelefone?.telefoneFormatado || cliente.phone || 'Sem tel'}</Text>
                            </Text>
                          </View>

                          {/* BADGES DE STATUS */}
                          {isCompensacaoD1 && (
                            <View className="px-2 py-1 rounded-lg bg-amber-500/15 border border-amber-500/40 flex-row items-center gap-1 flex-shrink-0">
                              <Clock size={11} color="#fbbf24" />
                              <Text className="text-[9px] font-black uppercase text-amber-300">
                                Compensação D+1 (48h)
                              </Text>
                            </View>
                          )}

                          {!isCompensacaoD1 && isPausado && (
                            <View className="px-2 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 flex-row items-center gap-1 flex-shrink-0">
                              <PauseCircle size={11} color="#fbbf24" />
                              <Text className="text-[9px] font-black uppercase text-amber-300">
                                Pausado até {cliente.exclusao?.pausadoAteFormatado}
                              </Text>
                            </View>
                          )}

                          {!isCompensacaoD1 && isErro && (
                            <Pressable
                              onPress={() => {
                                if (cliente.diagnostico) {
                                  triggerHaptic();
                                  setModalDiagnostico(cliente.diagnostico);
                                }
                              }}
                              className="px-2 py-1 rounded-lg bg-rose-500/15 border border-rose-500/30 flex-row items-center gap-1 flex-shrink-0"
                            >
                              <AlertTriangle size={11} color="#f87171" />
                              <Text className="text-[9px] font-black uppercase text-rose-300">
                                Erro (Ver Análise)
                              </Text>
                            </Pressable>
                          )}

                          {!isCompensacaoD1 && cliente.status === 'agendados' && (
                            <View className="px-2 py-1 rounded-lg bg-purple-500/15 border border-purple-500/30 flex-row items-center gap-1 flex-shrink-0">
                              <Calendar size={11} color="#c084fc" />
                              <Text className="text-[9px] font-black uppercase text-purple-300">
                                Agendado p/ {cliente.agendadoPara || 'Data Futura'} {cliente.agendadoOrigem === 'app' ? '• App' : ''}
                              </Text>
                            </View>
                          )}

                          {!isCompensacaoD1 && isEnviado && cliente.status !== 'agendados' && (
                            <View className="px-2 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex-row items-center gap-1 flex-shrink-0">
                              <CheckCircle2 size={11} color="#4ade80" />
                              <Text className="text-[9px] font-black uppercase text-emerald-300">
                                Enviado 24h
                              </Text>
                            </View>
                          )}

                          {!isCompensacaoD1 && !isPausado && !isErro && !isEnviado && cliente.status !== 'agendados' && (
                            <View className="px-2 py-1 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex-shrink-0">
                              <Text className="text-[9px] font-black uppercase text-cyan-300">
                                Fila (Elegível)
                              </Text>
                            </View>
                          )}
                        </View>

                        {/* SCORE MATEMÁTICO DE PRIORIZAÇÃO P_i' */}
                        <View className="flex-row items-center justify-between gap-2 flex-wrap">
                          <Pressable
                            onPress={() => {
                              if (scoreObj) {
                                triggerHaptic();
                                setModalScoreDetalhado({ cliente, score: scoreObj });
                              }
                            }}
                            className={`px-2.5 py-1 rounded-lg border flex-row items-center gap-1.5 active:opacity-80 ${
                              scoreVal >= 70
                                ? 'bg-emerald-500/15 border-emerald-500/40'
                                : scoreVal >= 40
                                ? 'bg-cyan-500/15 border-cyan-500/30'
                                : scoreVal > 0
                                ? 'bg-zinc-800/80 border-zinc-700'
                                : 'bg-rose-500/10 border-rose-500/30'
                            }`}
                          >
                            <Calculator
                              size={11}
                              color={scoreVal >= 70 ? '#4ade80' : scoreVal >= 40 ? '#38bdf8' : scoreVal > 0 ? '#a1a1aa' : '#f87171'}
                            />
                            <Text
                              className={`text-[10px] font-black uppercase ${
                                scoreVal >= 70
                                  ? 'text-emerald-300'
                                  : scoreVal >= 40
                                  ? 'text-cyan-300'
                                  : scoreVal > 0
                                  ? 'text-zinc-300'
                                  : 'text-rose-300'
                              }`}
                            >
                              Score: {scoreVal} pts {scoreVal >= 70 ? '• Alta Prioridade' : scoreVal === 0 ? '• Inelegível (C_i = 0)' : ''}
                            </Text>
                            <Info size={10} color={scoreVal >= 70 ? '#4ade80' : '#71717a'} />
                          </Pressable>

                          {scoreObj?.sRuptura && scoreObj.sRuptura >= 0.5 ? (
                            <View className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 flex-row items-center gap-1">
                              <TrendingUp size={10} color="#fbbf24" />
                              <Text className="text-[9px] font-black text-amber-300 uppercase">Ruptura de Hábito</Text>
                            </View>
                          ) : null}

                          {/* PERFIL DE RISCO / HEURÍSTICA DE CRÉDITO */}
                          {cliente.previsao && (
                            <View className={`px-2 py-0.5 rounded border flex-row items-center gap-1 ${
                              cliente.previsao.perfilRisco === 'CALOTE_ENTRADA'
                                ? 'bg-rose-500/20 border-rose-500/40'
                                : cliente.previsao.perfilRisco === 'SUPERENDIVIDADO'
                                ? 'bg-purple-500/20 border-purple-500/40'
                                : cliente.previsao.perfilRisco === 'ATRASO_LEVE'
                                ? 'bg-cyan-500/20 border-cyan-500/40'
                                : 'bg-zinc-800 border-zinc-700'
                            }`}>
                              <Text className={`text-[9px] font-black uppercase ${
                                cliente.previsao.perfilRisco === 'CALOTE_ENTRADA'
                                  ? 'text-rose-300'
                                  : cliente.previsao.perfilRisco === 'SUPERENDIVIDADO'
                                  ? 'text-purple-300'
                                  : cliente.previsao.perfilRisco === 'ATRASO_LEVE'
                                  ? 'text-cyan-300'
                                  : 'text-zinc-400'
                              }`}>
                                {cliente.previsao.rotuloPerfil}
                              </Text>
                            </View>
                          )}

                          {/* SAÚDE FINANCEIRA DO CLIENTE (TERMÔMETRO REAL DE RISCO) */}
                          {(() => {
                            const saude = cliente.saudeFinanceira || calcularSaudeFinanceiraCliente(cliente);
                            return (
                              <View className={`px-2 py-0.5 rounded border flex-row items-center gap-1 ${saude.corBadgeBg} ${saude.corBadgeBorder}`}>
                                <HeartPulse size={10} color={saude.corHex} />
                                <Text className={`text-[9px] font-black uppercase ${saude.corBadgeText}`}>
                                  Saúde: {saude.scoreSaude}% • {saude.rotuloNivel}
                                </Text>
                              </View>
                            );
                          })()}
                        </View>

                        {/* DIAGNÓSTICO INTELIGENTE DO NÚMERO (DDD 20 VS AMAZONAS) */}
                        {telDiag && telDiag.tipoAlerta === 'erro' && (
                          <View className="bg-rose-500/10 border border-rose-500/25 rounded-xl p-2.5 flex-row items-center gap-2">
                            <AlertTriangle size={14} color="#f87171" />
                            <View className="flex-1 min-w-0">
                              <Text className="text-[10px] font-black uppercase text-rose-300">
                                {telDiag.isDddInexistente ? 'DDD 20 Inexistente' : 'Telefone Incorreto'}
                              </Text>
                              <Text className="text-[9px] text-zinc-300 font-medium">
                                {telDiag.mensagemAlerta}
                              </Text>
                            </View>
                          </View>
                        )}

                        {telDiag && telDiag.tipoAlerta === 'atencao' && (
                          <View className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-2.5 flex-row items-center gap-2">
                            <Info size={13} color="#fbbf24" />
                            <View className="flex-1 min-w-0">
                              <Text className="text-[10px] font-bold text-amber-200">
                                {telDiag.mensagemAlerta}
                              </Text>
                            </View>
                          </View>
                        )}

                        {/* VALORES E ATRASO REAL */}
                        <View className="flex-row items-center justify-between pt-2 border-t border-zinc-800/80">
                          <View>
                            <Text className="text-[9px] font-bold uppercase text-zinc-500">
                              Inadimplência
                            </Text>
                            <Text className="text-base font-black text-rose-400">
                              {toBrl(cliente.v_inadim)}
                            </Text>
                            <Text className="text-[9px] text-zinc-400 font-medium mt-0.5">
                              Total: {toBrl(cliente.v_total)} • {cliente.v_total > 0 ? `${((cliente.v_inadim / cliente.v_total) * 100).toFixed(1)}%` : '100%'}
                            </Text>
                          </View>

                          <View className="items-center">
                            <Text className="text-[9px] font-bold uppercase text-zinc-500">
                              Contratos / Parc.
                            </Text>
                            <Text className="text-xs font-black text-zinc-200">
                              {cliente.contratos} ct • {cliente.parcelas_aberto}/{cliente.parcelas_total} p
                            </Text>
                            {/* MENSAGERIA OFICIAL BACKOFFICE */}
                            <View className="mt-1 px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 flex-row items-center gap-1">
                              <MessageSquare size={9} color="#38bdf8" />
                              <Text className="text-[9px] font-black text-cyan-300">
                                {cliente.cobranca_qtd_envios_total || 0} {(cliente.cobranca_qtd_envios_total === 1) ? 'envio' : 'envios'}
                              </Text>
                            </View>
                          </View>

                          <View className="items-end">
                            <Text className="text-[9px] font-bold uppercase text-zinc-500">
                              Atraso Real
                            </Text>
                            <View className="px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 items-end">
                              <Text className="text-[10px] font-black text-amber-300">
                                {cliente.atraso_dias || 15} dias {cliente.mesAnoVencimento ? `• ${cliente.mesAnoVencimento}` : ''}
                              </Text>
                              <Text className="text-[8px] font-bold text-zinc-300">
                                Venc: {cliente.dataVencimentoReal || calcularDataVencimento(cliente.atraso_dias || 15)} {cliente.safra ? `(${cliente.safra})` : ''}
                              </Text>
                            </View>
                            {cliente.cobranca_ultimo_envio_geral ? (
                              <Text className="text-[8px] text-zinc-500 mt-0.5">
                                Último: {cliente.cobranca_ultimo_envio_geral.slice(0, 10)}
                              </Text>
                            ) : null}
                          </View>
                        </View>

                        {/* MOTIVO SE ESTIVER PAUSADO */}
                        {isPausado && cliente.exclusao && (
                          <View className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-2.5">
                            <Text className="text-[10px] font-bold text-amber-200">
                              Motivo da Pausa: {cliente.exclusao.motivo}
                            </Text>
                            <Text className="text-[9px] text-amber-400/80 font-medium mt-0.5">
                              Registrado por {cliente.exclusao.operadorNome || 'Operador'}
                            </Text>
                          </View>
                        )}

                        {/* DIAGNÓSTICO DO ERRO DE WHATSAPP / TELEFONIA */}
                        {isErro && cliente.diagnostico && (
                          <View className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-2.5">
                            <Text className="text-[10px] font-black text-rose-300 uppercase">
                              Causa: {cliente.diagnostico.titulo}
                            </Text>
                            <Text className="text-[10px] text-zinc-300 mt-0.5 font-medium">
                              {cliente.diagnostico.descricaoAmigavel}
                            </Text>
                          </View>
                        )}

                        {/* BANNER DE TRAVA D+1 (SE O CLIENTE PAGOU EM LOJA) */}
                        {cliente.pagamentoLojaD1?.ativo && (
                          <View className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex-row items-center justify-between">
                            <View className="flex-1 min-w-0 mr-2">
                              <View className="flex-row items-center gap-1.5">
                                <Clock size={13} color="#fbbf24" />
                                <Text className="text-[10px] font-black uppercase text-amber-300">
                                  Pagamento em Loja: {toBrl(cliente.pagamentoLojaD1.valorInformado || cliente.pagamentoLojaD1.valorPago || 0)}
                                </Text>
                              </View>
                              <Text className="text-[9px] text-zinc-300 mt-0.5 font-medium">
                                Blindado contra disparos automáticos até a consolidação contábil D+1.
                              </Text>
                            </View>
                            <Pressable
                              onPress={() => handleRemoverTravaD1(cliente.cpf_cnpj)}
                              className="px-2.5 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 active:bg-zinc-700"
                            >
                              <Text className="text-[9px] font-black text-amber-300">Remover Trava</Text>
                            </Pressable>
                          </View>
                        )}

                        {/* AÇÕES INDIVIDUAIS */}
                        <View className="flex-row items-center gap-2 pt-1">
                          {/* BOTÃO COBRAR INDIVIDUALMENTE */}
                          <Pressable
                            onPress={() => handleAbrirCobrancaIndividual(cliente)}
                            className="flex-1 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex-row items-center justify-center gap-1.5 active:bg-cyan-500/30"
                          >
                            <Send size={13} color="#38bdf8" />
                            <Text className="text-[11px] font-black uppercase text-cyan-200">
                              Cobrar Avulso
                            </Text>
                          </Pressable>

                          {/* BOTÃO PAUSAR / REATIVAR EXCLUSÃO */}
                          {isPausado ? (
                            <Pressable
                              onPress={() => handleReativarCobranca(cliente.cpf_cnpj)}
                              className="px-3 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex-row items-center justify-center gap-1.5 active:bg-emerald-500/30"
                            >
                              <PlayCircle size={14} color="#4ade80" />
                              <Text className="text-[10px] font-black uppercase text-emerald-300">
                                Reativar
                              </Text>
                            </Pressable>
                          ) : (
                            <Pressable
                              onPress={() => {
                                triggerHaptic();
                                setModalExclusaoCliente(cliente);
                              }}
                              className="px-3 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex-row items-center justify-center gap-1.5 active:bg-amber-500/25"
                            >
                              <PauseCircle size={14} color="#fbbf24" />
                              <Text className="text-[10px] font-black uppercase text-amber-300">
                                Pausar
                              </Text>
                            </Pressable>
                          )}

                          {/* BOTÃO HISTÓRICO / CONTRATOS (Abertura Imediata e Resiliente) */}
                          <Pressable
                            onPress={async () => {
                              triggerHaptic();
                              const detalhe = await InadimplenciaService.fetchClientHistory(cliente.cpf_cnpj, cliente);
                              setModalDetalhesContrato(detalhe);
                            }}
                            className="h-10 w-10 rounded-xl bg-zinc-800 border border-zinc-700 items-center justify-center active:bg-zinc-700"
                          >
                            <FileText size={15} color="#a1a1aa" />
                          </Pressable>
                        </View>
                      </View>
                    );
                  })}

                  {/* PAGINAÇÃO INTELIGENTE (ELIMINA TRAVAMENTOS NA LISTA COM 200+ ITENS) */}
                  {clientesExibidos.length < clientesFiltrados.length && (
                    <View className="items-center gap-2 pt-2 pb-4">
                      <Pressable
                        onPress={() => {
                          triggerHaptic();
                          setPaginaExibicao((p) => p + 1);
                        }}
                        className="w-full py-3.5 px-4 rounded-2xl bg-[#181824] border border-cyan-500/30 items-center justify-center active:bg-cyan-500/10 flex-row gap-2"
                      >
                        <ChevronDown size={15} color="#38bdf8" />
                        <Text className="text-xs font-black uppercase tracking-wider text-cyan-300">
                          Carregar mais {Math.min(ITENS_POR_PAGINA, clientesFiltrados.length - clientesExibidos.length)} devedores ({clientesExibidos.length} de {clientesFiltrados.length})
                        </Text>
                      </Pressable>

                      <Pressable
                        onPress={() => {
                          triggerHaptic();
                          setPaginaExibicao(Math.ceil(clientesFiltrados.length / ITENS_POR_PAGINA));
                        }}
                        className="py-1.5 px-3"
                      >
                        <Text className="text-[10px] font-bold text-zinc-500 uppercase">
                          Mostrar todos os {clientesFiltrados.length} devedores
                        </Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              </>
            )}
          </ScrollView>
        )}

        {/* MODAL CRIAR AGENDAMENTO DIÁRIO OFICIAL (PRÉVIA & REVISÃO INTERATIVA) */}
        <Modal
          visible={modalCriarAgendamento}
          transparent
          animationType="slide"
          statusBarTranslucent
          onRequestClose={() => setModalCriarAgendamento(false)}
        >
          <View
            style={{ paddingBottom: keyboardHeight }}
            className="flex-1 justify-end bg-black/85"
          >
            <Pressable
              className="flex-1"
              onPress={() => {
                Keyboard.dismiss();
                setModalCriarAgendamento(false);
              }}
            />
            <View className="w-full bg-[#121218] border-t border-zinc-800 rounded-t-[32px] p-5 gap-3.5 max-h-[92%]">
              <View className="w-12 h-1 rounded-full bg-zinc-800 mx-auto" />

              {/* HEADER DO MODAL */}
              <View className="flex-row items-center justify-between border-b border-zinc-800 pb-3">
                <View className="flex-row items-center gap-2 flex-1 min-w-0 mr-2">
                  <CalendarPlus size={18} color="#38bdf8" />
                  <View className="flex-1 min-w-0">
                    <Text className="text-xs font-black uppercase tracking-wider text-white">
                      Revisão do Lote de Cobrança
                    </Text>
                    <Text className="text-[10px] text-cyan-300 font-medium truncate">
                      Meta Daily • Loja 27 C. Purupuru
                    </Text>
                  </View>
                </View>
                <Pressable onPress={() => setModalCriarAgendamento(false)}>
                  <X size={16} color="#a1a1aa" />
                </Pressable>
              </View>

              {/* CARD RESUMO DO NOVO SALDO & VAGAS */}
              <View className="bg-gradient-to-r from-cyan-950/40 to-zinc-900 border border-cyan-500/30 rounded-2xl p-3.5 gap-2.5">
                <View className="flex-row items-center justify-between">
                  <View>
                    <Text className="text-[9px] font-black uppercase tracking-wider text-cyan-400">
                      Novo Saldo em Cobrança do Lote
                    </Text>
                    <Text className="text-xl font-black text-white">
                      {toBrl(saldoTotalLote)}
                    </Text>
                  </View>

                  <View className="items-end">
                    <Text className="text-[9px] font-black uppercase tracking-wider text-zinc-400">
                      Vagas Preenchidas
                    </Text>
                    <Text className="text-lg font-black text-white">
                      <Text
                        className={
                          clientesLoteSelecionados.length === qtdAgendamento
                            ? 'text-emerald-400'
                            : 'text-amber-400'
                        }
                      >
                        {clientesLoteSelecionados.length}
                      </Text>
                      <Text className="text-xs font-bold text-zinc-500"> / {qtdAgendamento}</Text>
                    </Text>
                  </View>
                </View>

                {/* BARRA DE PREENCHIMENTO */}
                <View className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <View
                    className="h-full bg-cyan-400 rounded-full"
                    style={{
                      width: `${Math.min(100, (clientesLoteSelecionados.length / qtdAgendamento) * 100)}%`,
                    }}
                  />
                </View>

                {/* BOTÕES RÁPIDOS: AUTO-COMPLETAR E RESTAURAR */}
                <View className="flex-row items-center justify-between pt-1 border-t border-zinc-800/60">
                  {clientesLoteSelecionados.length < qtdAgendamento ? (
                    <Pressable
                      onPress={handleAutoCompletarCota}
                      className="px-2.5 py-1 rounded-lg bg-cyan-500/20 border border-cyan-400/50 flex-row items-center gap-1 active:bg-cyan-500/30"
                    >
                      <Zap size={11} color="#38bdf8" />
                      <Text className="text-[10px] font-black text-cyan-300 uppercase">
                        Auto-Completar ({qtdAgendamento - clientesLoteSelecionados.length} vagas)
                      </Text>
                    </Pressable>
                  ) : (
                    <View className="flex-row items-center gap-1">
                      <CheckCircle2 size={11} color="#4ade80" />
                      <Text className="text-[10px] font-black text-emerald-400 uppercase">
                        Cota de {qtdAgendamento} completa
                      </Text>
                    </View>
                  )}

                  <Pressable
                    onPress={handleRestaurarLotePadrao}
                    className="flex-row items-center gap-1 px-2 py-1 rounded-lg active:bg-zinc-800"
                  >
                    <RotateCcw size={11} color="#a1a1aa" />
                    <Text className="text-[10px] font-bold text-zinc-400 uppercase">
                      Restaurar Padrão
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* CONTROLES DO AGENDAMENTO (DATA & QUANTIDADE) */}
              <View className="gap-2">
                <View className="flex-row gap-2">
                  <View className="flex-1 gap-1">
                    <Text className="text-[9px] font-black uppercase text-zinc-400">
                      Data do Envio (AAAA-MM-DD):
                    </Text>
                    <TextInput
                      value={dataAgendamento}
                      onChangeText={setDataAgendamento}
                      placeholder="2026-09-07"
                      placeholderTextColor="#71717a"
                      className="w-full h-10 bg-zinc-900 border border-zinc-800 rounded-xl px-3 text-xs text-white font-mono font-bold"
                    />
                  </View>

                  <View className="gap-1">
                    <Text className="text-[9px] font-black uppercase text-zinc-400">
                      Cota do Lote:
                    </Text>
                    <View className="flex-row gap-1">
                      {[10, 20, 30].map((qtd) => (
                        <Pressable
                          key={qtd}
                          onPress={() => handleMudarQtdAgendamento(qtd)}
                          className={`h-10 px-3 rounded-xl items-center justify-center border ${
                            qtdAgendamento === qtd
                              ? 'bg-cyan-500/20 border-cyan-400'
                              : 'bg-zinc-900 border-zinc-800'
                          }`}
                        >
                          <Text
                            className={`text-xs font-black ${
                              qtdAgendamento === qtd ? 'text-cyan-300' : 'text-zinc-400'
                            }`}
                          >
                            {qtd}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                </View>

                {/* BOTÕES DE ATALHO DE DIAS ÚTEIS (SEGUNDA A SÁBADO) */}
                <View className="flex-row items-center gap-1.5 flex-wrap">
                  <Text className="text-[9px] font-black uppercase text-zinc-500 mr-1">Dia Útil:</Text>
                  {atalhosDiasUteis.map((dt) => (
                    <Pressable
                      key={dt.ymd}
                      onPress={() => {
                        triggerHaptic();
                        setDataAgendamento(dt.ymd);
                      }}
                      className={`px-2 py-1 rounded-lg border ${
                        dataAgendamento === dt.ymd
                          ? 'bg-cyan-500/20 border-cyan-400'
                          : 'bg-zinc-900 border-zinc-800'
                      }`}
                    >
                      <Text
                        className={`text-[9px] font-bold ${
                          dataAgendamento === dt.ymd ? 'text-cyan-300 font-black' : 'text-zinc-400'
                        }`}
                      >
                        {dt.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {/* AVISO DE FIM DE SEMANA BLOQUEADO */}
                {isDataFimDeSemana(dataAgendamento) && (
                  <View className="bg-amber-500/15 border border-amber-500/40 rounded-xl p-2.5 flex-row items-center gap-2">
                    <AlertTriangle size={15} color="#fbbf24" />
                    <View className="flex-1 min-w-0">
                      <Text className="text-[10px] font-black uppercase text-amber-300">
                        Atenção: Data em Fim de Semana
                      </Text>
                      <Text className="text-[9px] text-amber-100 font-medium leading-tight mt-0.5">
                        O BackOffice Clara Eletro não dispara aos sábados e domingos (apenas Seg a Sex, 07h às 19h).
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => {
                        triggerHaptic();
                        setDataAgendamento(obterProximoDiaUtil().dataYmd);
                      }}
                      className="px-2 py-1 bg-amber-500/30 border border-amber-400/60 rounded-lg active:bg-amber-500/40 flex-shrink-0"
                    >
                      <Text className="text-[9px] font-black uppercase text-white">Mudar p/ Seg</Text>
                    </Pressable>
                  </View>
                )}
              </View>

              {/* TOGGLE SEGMENTADO: SELECIONADOS NO LOTE VS QUEM TÁ DE FORA */}
              <View className="flex-row p-1 bg-zinc-900 border border-zinc-800 rounded-xl">
                <Pressable
                  onPress={() => {
                    triggerHaptic();
                    setSubAbaReview('selecionados');
                  }}
                  className={`flex-1 py-2 rounded-lg items-center justify-center flex-row gap-1.5 ${
                    subAbaReview === 'selecionados' ? 'bg-zinc-800' : ''
                  }`}
                >
                  <Text
                    className={`text-[11px] font-black uppercase ${
                      subAbaReview === 'selecionados' ? 'text-white' : 'text-zinc-500'
                    }`}
                  >
                    No Lote ({clientesLoteSelecionados.length})
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    triggerHaptic();
                    setSubAbaReview('de_fora');
                  }}
                  className={`flex-1 py-2 rounded-lg items-center justify-center flex-row gap-1.5 ${
                    subAbaReview === 'de_fora' ? 'bg-zinc-800' : ''
                  }`}
                >
                  <Text
                    className={`text-[11px] font-black uppercase ${
                      subAbaReview === 'de_fora' ? 'text-cyan-300' : 'text-zinc-500'
                    }`}
                  >
                    Quem Tá de Fora ({todosClientesDeFora.length})
                  </Text>
                </Pressable>
              </View>

              {/* LISTA SCROLLÁVEL DE CLIENTES NO REVIEW */}
              {subAbaReview === 'de_fora' ? (
                /* BARRA DE BUSCA EM QUEM TÁ DE FORA */
                <View className="flex-row items-center bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 gap-2">
                  <Search size={13} color="#71717a" />
                  <TextInput
                    value={buscaDeFora}
                    onChangeText={setBuscaDeFora}
                    placeholder="Filtrar quem tá de fora por nome ou CPF..."
                    placeholderTextColor="#71717a"
                    className="flex-1 text-xs text-white p-0"
                  />
                  {buscaDeFora ? (
                    <Pressable onPress={() => setBuscaDeFora('')}>
                      <X size={13} color="#71717a" />
                    </Pressable>
                  ) : null}
                </View>
              ) : null}

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingBottom: 10 }}
                className="max-h-64"
              >
                {subAbaReview === 'selecionados' ? (
                  clientesLoteSelecionados.length === 0 ? (
                    <View className="py-8 items-center justify-center gap-2">
                      <AlertTriangle size={20} color="#fbbf24" />
                      <Text className="text-xs font-black uppercase text-zinc-400">
                        Nenhum cliente no lote
                      </Text>
                      <Pressable
                        onPress={handleAutoCompletarCota}
                        className="px-3 py-1.5 bg-cyan-500 rounded-xl"
                      >
                        <Text className="text-xs font-black uppercase text-zinc-950">
                          Preencher com {qtdAgendamento} Clientes
                        </Text>
                      </Pressable>
                    </View>
                  ) : (
                    <>
                      {clientesLoteSelecionados.map((cliente, idx) => {
                        const scoreObj = scoresMap.get(cliente.cpf_cnpj);
                        const scoreVal = scoreObj?.scoreFinal ?? cliente.scorePrioridade ?? 0;
                        const telDiag = cliente.diagnosticoTelefone;
                        const temAlertaTel = telDiag && !telDiag.valido;

                        return (
                          <View
                            key={cliente.cpf_cnpj}
                            className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 gap-2"
                          >
                            <View className="flex-row items-center justify-between gap-2">
                              <View className="flex-row items-center gap-2 flex-1 min-w-0">
                                <View className="h-6 w-6 rounded-md bg-cyan-500/20 border border-cyan-500/30 items-center justify-center flex-shrink-0">
                                  <Text className="text-[10px] font-black text-cyan-300">
                                    #{idx + 1}
                                  </Text>
                                </View>

                                <View className="flex-1 min-w-0">
                                  <Text className="text-xs font-black uppercase text-white truncate" numberOfLines={1}>
                                    {cliente.nome_cliente}
                                  </Text>
                                  <Text className="text-[10px] text-zinc-400 font-medium">
                                    Débito: <Text className="text-rose-400 font-bold">{toBrl(cliente.v_inadim)}</Text> • Atraso: <Text className="text-amber-300 font-bold">{cliente.atraso_dias}d</Text>
                                  </Text>
                                  <Text className="text-[9px] text-zinc-400 font-medium mt-0.5">
                                    Vencimento: <Text className="text-amber-300 font-bold">{cliente.dataVencimentoReal || 'Recente'}</Text> {cliente.mesAnoVencimento ? `(${cliente.mesAnoVencimento})` : ''} • {cliente.parcelas_aberto || 1}p em aberto
                                  </Text>
                                </View>
                              </View>

                              <View className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 flex-shrink-0">
                                <Text className="text-[9px] font-black text-cyan-300">
                                  {scoreVal} pts
                                </Text>
                              </View>
                            </View>

                            {/* LINHA DE AÇÕES E STATUS DO TELEFONE */}
                            <View className="flex-row items-center justify-between pt-1.5 border-t border-zinc-800/60">
                              <View className="flex-row items-center gap-1.5 flex-1 min-w-0 mr-2">
                                <Phone size={10} color={temAlertaTel ? '#fbbf24' : '#38bdf8'} />
                                <Text
                                  className={`text-[10px] font-mono font-semibold ${
                                    temAlertaTel ? 'text-amber-400 font-bold' : 'text-zinc-200'
                                  }`}
                                  numberOfLines={1}
                                >
                                  {cliente.diagnosticoTelefone?.telefoneFormatado || cliente.phone || cliente.phone_api || 'Sem número'}
                                </Text>
                                <Pressable
                                  onPress={() => handleAbrirEditarTelefone(cliente)}
                                  className="px-1.5 py-0.5 rounded bg-cyan-500/20 border border-cyan-500/30 flex-row items-center gap-0.5 active:bg-cyan-500/30"
                                >
                                  <Edit3 size={9} color="#38bdf8" />
                                  <Text className="text-[9px] font-black text-cyan-300 uppercase">
                                    {temAlertaTel ? 'Corrigir' : 'Alterar'}
                                  </Text>
                                </Pressable>
                              </View>

                              <View className="flex-row items-center gap-1.5 flex-shrink-0">
                                {/* BOTÃO SUBSTITUIR DIRETAMENTE */}
                                <Pressable
                                  onPress={() => handleAbrirSubstituirCliente(cliente)}
                                  className="h-8 px-2.5 rounded-lg bg-cyan-500/20 border border-cyan-400/50 flex-row items-center gap-1 active:bg-cyan-500/30"
                                >
                                  <RotateCcw size={11} color="#38bdf8" />
                                  <Text className="text-[9px] font-black text-cyan-300 uppercase">
                                    Substituir
                                  </Text>
                                </Pressable>

                                {/* BOTÃO TIRAR */}
                                <Pressable
                                  onPress={() => handleRemoverClienteDoLote(cliente.cpf_cnpj)}
                                  className="h-8 px-2 rounded-lg bg-rose-500/15 border border-rose-500/30 flex-row items-center gap-1 active:bg-rose-500/30"
                                >
                                  <Trash2 size={11} color="#f87171" />
                                </Pressable>
                              </View>
                            </View>
                          </View>
                        );
                      })}

                      {/* BANNER DE VAGA ABERTA SE COTA NÃO ESTIVER COMPLETA */}
                      {clientesLoteSelecionados.length < qtdAgendamento ? (
                        <View className="p-3 bg-cyan-950/30 border border-dashed border-cyan-500/40 rounded-xl flex-row items-center justify-between mt-1">
                          <View className="flex-1 min-w-0 mr-2">
                            <Text className="text-[11px] font-black uppercase text-cyan-300">
                              Vaga Aberta no Lote ({clientesLoteSelecionados.length}/{qtdAgendamento})
                            </Text>
                            <Text className="text-[10px] text-zinc-400">
                              Falta {qtdAgendamento - clientesLoteSelecionados.length} cliente para completar o lote diário
                            </Text>
                          </View>
                          <View className="flex-row gap-1.5">
                            <Pressable
                              onPress={handleAutoCompletarCota}
                              className="px-2.5 py-1.5 bg-cyan-500/20 border border-cyan-400/50 rounded-lg flex-row items-center gap-1 active:bg-cyan-500/30"
                            >
                              <Zap size={11} color="#38bdf8" />
                              <Text className="text-[10px] font-black uppercase text-cyan-300">Auto</Text>
                            </Pressable>
                            <Pressable
                              onPress={handleAbrirAdicionarVagaAberta}
                              className="px-2.5 py-1.5 bg-cyan-500 rounded-lg flex-row items-center gap-1 active:bg-cyan-600"
                            >
                              <Plus size={11} color="#09090c" />
                              <Text className="text-[10px] font-black uppercase text-zinc-950">Escolher</Text>
                            </Pressable>
                          </View>
                        </View>
                      ) : null}
                    </>
                  )
                ) : (
                  clientesDeForaFiltrados.length === 0 ? (
                    <View className="py-8 items-center justify-center">
                      <Text className="text-xs text-zinc-500 font-medium">
                        Nenhum cliente disponível fora do lote com este filtro.
                      </Text>
                    </View>
                  ) : (
                    <>
                      {clientesDeForaExibidos.map((cliente, idx) => {
                        const scoreObj = scoresMap.get(cliente.cpf_cnpj);
                        const scoreVal = scoreObj?.scoreFinal ?? cliente.scorePrioridade ?? 0;
                        const telDiag = cliente.diagnosticoTelefone;
                        const temAlertaTel = telDiag && !telDiag.valido;

                        return (
                          <View
                            key={cliente.cpf_cnpj}
                            className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 gap-2"
                          >
                            <View className="flex-row items-center justify-between gap-2">
                              <View className="flex-row items-center gap-2 flex-1 min-w-0">
                                <View className="h-6 w-6 rounded-md bg-zinc-800 border border-zinc-700 items-center justify-center flex-shrink-0">
                                  <Text className="text-[9px] font-bold text-zinc-400">
                                    #{idx + 1}
                                  </Text>
                                </View>

                                <View className="flex-1 min-w-0">
                                  <Text className="text-xs font-black uppercase text-zinc-300 truncate" numberOfLines={1}>
                                    {cliente.nome_cliente}
                                  </Text>
                                  <Text className="text-[10px] text-zinc-400 font-medium">
                                    Débito: <Text className="text-zinc-200 font-bold">{toBrl(cliente.v_inadim)}</Text> • {cliente.atraso_dias}d atraso
                                  </Text>
                                </View>
                              </View>

                              <View className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 flex-shrink-0">
                                <Text className="text-[9px] font-black text-zinc-300">
                                  {scoreVal} pts
                                </Text>
                              </View>
                            </View>

                            {/* LINHA DE TELEFONE E ADICIONAR */}
                            <View className="flex-row items-center justify-between pt-1.5 border-t border-zinc-800/60">
                              <View className="flex-row items-center gap-1.5 flex-1 min-w-0 mr-2">
                                <Phone size={10} color={temAlertaTel ? '#fbbf24' : '#71717a'} />
                                <Text
                                  className={`text-[10px] font-mono ${
                                    temAlertaTel ? 'text-amber-400 font-bold' : 'text-zinc-400'
                                  }`}
                                  numberOfLines={1}
                                >
                                  {cliente.phone || cliente.phone_api || 'Sem número'}
                                </Text>
                                {temAlertaTel ? (
                                  <Pressable
                                    onPress={() => handleAbrirEditarTelefone(cliente)}
                                    className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/30 flex-row items-center gap-0.5"
                                  >
                                    <Edit3 size={9} color="#fbbf24" />
                                    <Text className="text-[9px] font-black text-amber-300 uppercase">
                                      Corrigir
                                    </Text>
                                  </Pressable>
                                ) : null}
                              </View>

                              <Pressable
                                onPress={() => handleAdicionarClienteAoLote(cliente.cpf_cnpj)}
                                className="h-8 px-2.5 rounded-lg bg-cyan-500/20 border border-cyan-400/50 flex-row items-center gap-1 active:bg-cyan-500/30 flex-shrink-0"
                              >
                                <Plus size={12} color="#38bdf8" />
                                <Text className="text-[9px] font-black text-cyan-300 uppercase">
                                  Adicionar
                                </Text>
                              </Pressable>
                            </View>
                          </View>
                        );
                      })}

                      {/* BOTÃO CARREGAR MAIS (PAGINAÇÃO FLUIDA) */}
                      {clientesDeForaFiltrados.length > clientesDeForaExibidos.length && (
                        <Pressable
                          onPress={() => {
                            triggerHaptic();
                            setPaginaDeFora((p) => p + 1);
                          }}
                          className="h-10 rounded-xl bg-zinc-800/90 border border-zinc-700/70 items-center justify-center my-1 active:bg-zinc-700"
                        >
                          <Text className="text-xs font-bold text-cyan-300">
                            Carregar mais 20 clientes ({clientesDeForaExibidos.length} de {clientesDeForaFiltrados.length})
                          </Text>
                        </Pressable>
                      )}
                    </>
                  )
                )}
              </ScrollView>

              {/* BOTÃO FINAL DE DISPARO */}
              <Pressable
                disabled={enviandoAgendamento || clientesLoteSelecionados.length === 0}
                onPress={handleAbrirConfirmarDisparo}
                className={`w-full h-12 rounded-xl items-center justify-center flex-row gap-2 mt-1 ${
                  clientesLoteSelecionados.length > 0
                    ? 'bg-cyan-500 active:bg-cyan-600'
                    : 'bg-zinc-800 opacity-50'
                }`}
              >
                {enviandoAgendamento ? (
                  <ActivityIndicator size="small" color="#09090c" />
                ) : (
                  <>
                    <CalendarPlus size={16} color="#09090c" />
                    <Text className="text-xs font-black uppercase text-zinc-950">
                      Disparar Lote ({clientesLoteSelecionados.length} clientes • {toBrl(saldoTotalLote)})
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </Modal>

        {/* MODAL DE CONFIRMAÇÃO DO DISPARO DO LOTE */}
        <Modal
          visible={modalConfirmarDisparo}
          transparent
          animationType="fade"
          onRequestClose={() => !enviandoAgendamento && setModalConfirmarDisparo(false)}
        >
          <View className="flex-1 justify-center items-center bg-black/85 px-4">
            <View className="w-full max-w-md bg-[#121218] border border-cyan-500/40 rounded-3xl p-5 gap-4">
              {/* HEADER */}
              <View className="flex-row items-center justify-between border-b border-zinc-800 pb-3">
                <View className="flex-row items-center gap-2.5 flex-1 min-w-0">
                  <View className="h-9 w-9 rounded-xl bg-cyan-500/15 border border-cyan-500/30 items-center justify-center">
                    <CalendarPlus size={18} color="#38bdf8" />
                  </View>
                  <View className="flex-1 min-w-0">
                    <Text className="text-sm font-black uppercase text-white tracking-wide">
                      Confirmar Disparo do Lote
                    </Text>
                    <Text className="text-[10px] text-zinc-400 font-medium truncate">
                      Meta Daily • Loja 27 C. Purupuru
                    </Text>
                  </View>
                </View>
                {!enviandoAgendamento && (
                  <Pressable onPress={() => setModalConfirmarDisparo(false)} className="p-1">
                    <X size={16} color="#a1a1aa" />
                  </Pressable>
                )}
              </View>

              {/* RESUMO DO LOTE */}
              <View className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-3.5 gap-2.5">
                <View className="flex-row items-center justify-between pb-2 border-b border-zinc-800/80">
                  <View className="flex-row items-center gap-1.5">
                    <Calendar size={13} color="#38bdf8" />
                    <Text className="text-[10px] font-bold text-zinc-400 uppercase">Data Programada:</Text>
                  </View>
                  <Text className="text-xs font-mono font-black text-white">
                    {dataAgendamento}
                  </Text>
                </View>

                <View className="flex-row items-center justify-between pb-2 border-b border-zinc-800/80">
                  <View className="flex-row items-center gap-1.5">
                    <Users size={13} color="#a855f7" />
                    <Text className="text-[10px] font-bold text-zinc-400 uppercase">Clientes Selecionados:</Text>
                  </View>
                  <Text className="text-xs font-black text-purple-300">
                    {clientesLoteSelecionados.length} clientes
                  </Text>
                </View>

                <View className="flex-row items-center justify-between pb-2 border-b border-zinc-800/80">
                  <View className="flex-row items-center gap-1.5">
                    <TrendingUp size={13} color="#f43f5e" />
                    <Text className="text-[10px] font-bold text-zinc-400 uppercase">Volume em Cobrança:</Text>
                  </View>
                  <Text className="text-xs font-black text-rose-400">
                    {toBrl(saldoTotalLote)}
                  </Text>
                </View>

                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-1.5">
                    <Zap size={13} color="#34d399" />
                    <Text className="text-[10px] font-bold text-zinc-400 uppercase">Canal Oficial:</Text>
                  </View>
                  <View className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30">
                    <Text className="text-[9px] font-black text-emerald-300 uppercase">
                      OneBox WhatsApp
                    </Text>
                  </View>
                </View>
              </View>

              {/* CARD DE AVISO CONFORME HORÁRIO */}
              {!isHorarioComercial() ? (
                <View className="p-3 bg-rose-500/15 border border-rose-500/40 rounded-xl flex-row items-start gap-2.5">
                  <AlertTriangle size={16} color="#f87171" className="mt-0.5" />
                  <View className="flex-1 min-w-0">
                    <Text className="text-[11px] font-black uppercase text-rose-300">
                      Bloqueio: Fora do Horário Comercial
                    </Text>
                    <Text className="text-[10px] text-zinc-300 mt-0.5 leading-tight font-medium">
                      O BackOffice Clara Eletro não permite disparos de cobrança fora do horário de expediente (Segunda a Sábado, das 07:00 às 18:00). Conexões fora deste intervalo serão rejeitadas.
                    </Text>
                  </View>
                </View>
              ) : isDataFimDeSemana(dataAgendamento) ? (
                <View className="p-3 bg-amber-500/15 border border-amber-500/40 rounded-xl flex-row items-start gap-2.5">
                  <AlertTriangle size={16} color="#fbbf24" className="mt-0.5" />
                  <View className="flex-1 min-w-0">
                    <Text className="text-[11px] font-black uppercase text-amber-300">
                      Atenção: Data em Domingo
                    </Text>
                    <Text className="text-[10px] text-amber-100/90 mt-0.5 leading-tight font-medium">
                      A data selecionada ({dataAgendamento}) é domingo (sem expediente). O disparo diário opera de Segunda a Sábado.
                    </Text>
                  </View>
                </View>
              ) : (
                <View className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl flex-row items-start gap-2.5">
                  <CheckCircle2 size={16} color="#34d399" className="mt-0.5" />
                  <View className="flex-1 min-w-0">
                    <Text className="text-[11px] font-black uppercase text-emerald-300">
                      Expediente Comercial Ativo
                    </Text>
                    <Text className="text-[10px] text-zinc-300 mt-0.5 leading-tight font-medium">
                      O lote de {clientesLoteSelecionados.length} clientes será transmitido para processamento no BackOffice Clara Eletro.
                    </Text>
                  </View>
                </View>
              )}

              {/* BOTÕES DE AÇÃO */}
              <View className="flex-row gap-2 pt-1">
                <Pressable
                  disabled={enviandoAgendamento}
                  onPress={() => setModalConfirmarDisparo(false)}
                  className="flex-1 h-12 rounded-xl bg-zinc-800 items-center justify-center active:bg-zinc-700"
                >
                  <Text className="text-xs font-black uppercase text-zinc-300">
                    Cancelar
                  </Text>
                </Pressable>

                <Pressable
                  disabled={enviandoAgendamento || !isHorarioComercial() || isDataFimDeSemana(dataAgendamento)}
                  onPress={handleExecutarDisparoConfirmado}
                  className={`flex-[1.6] h-12 rounded-xl items-center justify-center flex-row gap-2 ${
                    !isHorarioComercial() || isDataFimDeSemana(dataAgendamento)
                      ? 'bg-zinc-800 border border-zinc-700 opacity-60'
                      : 'bg-cyan-500 active:bg-cyan-600'
                  }`}
                >
                  {enviandoAgendamento ? (
                    <ActivityIndicator size="small" color="#09090c" />
                  ) : !isHorarioComercial() ? (
                    <>
                      <Lock size={15} color="#a1a1aa" />
                      <Text className="text-xs font-black uppercase text-zinc-400">
                        Bloqueado (Fora de Horário)
                      </Text>
                    </>
                  ) : isDataFimDeSemana(dataAgendamento) ? (
                    <>
                      <AlertTriangle size={15} color="#fbbf24" />
                      <Text className="text-xs font-black uppercase text-amber-300">
                        Fim de Semana
                      </Text>
                    </>
                  ) : (
                    <>
                      <Send size={15} color="#09090c" />
                      <Text className="text-xs font-black uppercase text-zinc-950">
                        Confirmar e Disparar
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {/* MODAL DE SUCESSO DO DISPARO */}
        <Modal
          visible={!!modalSucessoDisparo}
          transparent
          animationType="fade"
          onRequestClose={() => setModalSucessoDisparo(null)}
        >
          <View className="flex-1 justify-center items-center bg-black/85 px-4">
            <View className="w-full max-w-md bg-[#121218] border border-emerald-500/40 rounded-3xl p-5 gap-4 items-center">
              <View className="h-14 w-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 items-center justify-center">
                <CheckCircle2 size={32} color="#34d399" />
              </View>

              <View className="items-center gap-1">
                <Text className="text-base font-black uppercase text-white tracking-wide text-center">
                  Lote Agendado com Sucesso!
                </Text>
                <Text className="text-xs text-emerald-400 font-medium text-center">
                  Meta Daily • Clara Eletro Loja 27
                </Text>
              </View>

              {modalSucessoDisparo && (
                <View className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-3.5 gap-2">
                  <View className="flex-row items-center justify-between pb-2 border-b border-zinc-800/80">
                    <Text className="text-[10px] font-bold text-zinc-400 uppercase">Data do Agendamento:</Text>
                    <Text className="text-xs font-mono font-bold text-white">
                      {modalSucessoDisparo.data}
                    </Text>
                  </View>

                  <View className="flex-row items-center justify-between pb-2 border-b border-zinc-800/80">
                    <Text className="text-[10px] font-bold text-zinc-400 uppercase">Clientes Incluídos:</Text>
                    <Text className="text-xs font-black text-cyan-300">
                      {modalSucessoDisparo.totalClientes} clientes
                    </Text>
                  </View>

                  <View className="flex-row items-center justify-between">
                    <Text className="text-[10px] font-bold text-zinc-400 uppercase">Volume em Cobrança:</Text>
                    <Text className="text-xs font-black text-emerald-400">
                      {toBrl(modalSucessoDisparo.valorTotal)}
                    </Text>
                  </View>
                </View>
              )}

              <View className="w-full p-3 bg-zinc-900/60 border border-zinc-800 rounded-xl">
                <Text className="text-[10px] text-zinc-300 text-center font-medium leading-relaxed">
                  {modalSucessoDisparo?.msg || 'Os clientes foram marcados como agendados e salvos com sucesso.'}
                </Text>
              </View>

              <Pressable
                onPress={() => setModalSucessoDisparo(null)}
                className="w-full h-12 bg-emerald-500 rounded-xl items-center justify-center active:bg-emerald-600"
              >
                <Text className="text-xs font-black uppercase text-zinc-950">
                  OK, Entendido
                </Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        {/* MODAL SELECIONAR SUBSTITUTO / ESCOLHER CLIENTE */}
        <Modal
          visible={modalSubstituir}
          transparent
          animationType="slide"
          onRequestClose={() => setModalSubstituir(false)}
        >
          <View className="flex-1 justify-end bg-black/85">
            <View className="w-full bg-[#121218] border-t border-zinc-800 rounded-t-[32px] p-5 gap-3 max-h-[88%]">
              <View className="w-12 h-1 rounded-full bg-zinc-800 mx-auto" />

              {/* HEADER DO SELETOR */}
              <View className="flex-row items-center justify-between border-b border-zinc-800 pb-3">
                <View className="flex-row items-center gap-2 flex-1 min-w-0 mr-2">
                  <RotateCcw size={18} color="#38bdf8" />
                  <View className="flex-1 min-w-0">
                    <Text className="text-xs font-black uppercase tracking-wider text-white">
                      {clienteParaSubstituir ? 'Substituir Cliente no Lote' : 'Adicionar ao Lote'}
                    </Text>
                    {clienteParaSubstituir ? (
                      <Text className="text-[10px] text-zinc-400 font-medium truncate">
                        Saindo: <Text className="text-rose-400 font-bold">{clienteParaSubstituir.nome_cliente}</Text> ({toBrl(clienteParaSubstituir.v_inadim)})
                      </Text>
                    ) : (
                      <Text className="text-[10px] text-cyan-300 font-medium">
                        Preenchendo vaga ({clientesLoteSelecionados.length}/{qtdAgendamento})
                      </Text>
                    )}
                  </View>
                </View>
                <Pressable onPress={() => setModalSubstituir(false)}>
                  <X size={16} color="#a1a1aa" />
                </Pressable>
              </View>

              {/* BARRA DE PESQUISA */}
              <View className="flex-row items-center bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 gap-2">
                <Search size={14} color="#71717a" />
                <TextInput
                  value={buscaSubstituto}
                  onChangeText={setBuscaSubstituto}
                  placeholder="Pesquisar por nome ou CPF..."
                  placeholderTextColor="#71717a"
                  className="flex-1 text-xs text-white p-0"
                />
                {buscaSubstituto ? (
                  <Pressable onPress={() => setBuscaSubstituto('')}>
                    <X size={14} color="#71717a" />
                  </Pressable>
                ) : null}
              </View>

              {/* FILTRO EM CHIPS */}
              <View className="flex-row gap-1.5">
                {[
                  { id: 'todos', label: `Todos (${todosClientesDeFora.length})` },
                  { id: 'prioritarios', label: '🌟 Prioritários' },
                  { id: 'erros', label: '⚠️ Com Pendência / Erro' },
                ].map((chip) => (
                  <Pressable
                    key={chip.id}
                    onPress={() => {
                      triggerHaptic();
                      setFiltroCategoriaSubstituto(chip.id as any);
                    }}
                    className={`px-2.5 py-1 rounded-lg border ${
                      filtroCategoriaSubstituto === chip.id
                        ? 'bg-cyan-500/20 border-cyan-400'
                        : 'bg-zinc-900 border-zinc-800'
                    }`}
                  >
                    <Text
                      className={`text-[10px] font-black uppercase ${
                        filtroCategoriaSubstituto === chip.id ? 'text-cyan-300' : 'text-zinc-400'
                      }`}
                    >
                      {chip.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* LISTA DE CANDIDATOS */}
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingBottom: 16 }}
                className="max-h-72"
              >
                {candidatosSubstituicao.length === 0 ? (
                  <View className="py-10 items-center justify-center gap-1">
                    <Text className="text-xs text-zinc-500 font-medium">
                      Nenhum candidato encontrado nesta categoria.
                    </Text>
                  </View>
                ) : (
                  candidatosSubstituicao.slice(0, 40).map((cand) => {
                    const scoreObj = scoresMap.get(cand.cpf_cnpj);
                    const scoreVal = scoreObj?.scoreFinal ?? cand.scorePrioridade ?? 0;
                    const diffValor = clienteParaSubstituir ? cand.v_inadim - clienteParaSubstituir.v_inadim : cand.v_inadim;
                    const telDiag = cand.diagnosticoTelefone;
                    const temAlertaTel = telDiag && !telDiag.valido;

                    return (
                      <View
                        key={cand.cpf_cnpj}
                        className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 gap-2"
                      >
                        <View className="flex-row items-center justify-between">
                          <View className="flex-1 min-w-0 mr-2">
                            <Text className="text-xs font-black uppercase text-white truncate" numberOfLines={1}>
                              {cand.nome_cliente}
                            </Text>
                            <Text className="text-[10px] text-zinc-400 font-medium">
                              Débito: <Text className="text-rose-400 font-bold">{toBrl(cand.v_inadim)}</Text> • Atraso: <Text className="text-amber-300 font-bold">{cand.atraso_dias}d</Text>
                            </Text>
                            <Text className="text-[9px] text-zinc-500 font-medium">
                              Venc: <Text className="text-zinc-300">{cand.dataVencimentoReal || 'Recente'}</Text> {cand.mesAnoVencimento ? `(${cand.mesAnoVencimento})` : ''} • {cand.parcelas_aberto || 1}p em aberto
                            </Text>
                          </View>

                          <View className="items-end flex-shrink-0">
                            <View className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700">
                              <Text className="text-[9px] font-black text-cyan-300">
                                {scoreVal} pts
                              </Text>
                            </View>
                            <Text
                              className={`text-[9px] font-bold mt-0.5 ${
                                diffValor >= 0 ? 'text-emerald-400' : 'text-amber-400'
                              }`}
                            >
                              {diffValor >= 0 ? `+${toBrl(diffValor)}` : `-${toBrl(Math.abs(diffValor))}`}
                            </Text>
                          </View>
                        </View>

                        {/* STATUS DO TELEFONE */}
                        <View className="flex-row items-center justify-between pt-1.5 border-t border-zinc-800/60">
                          <View className="flex-row items-center gap-1.5 flex-1 min-w-0 mr-2">
                            <Phone size={10} color={temAlertaTel ? '#fbbf24' : '#38bdf8'} />
                            <Text
                              className={`text-[10px] font-mono font-medium ${
                                temAlertaTel ? 'text-amber-400 font-bold' : 'text-zinc-300'
                              }`}
                              numberOfLines={1}
                            >
                              {cand.diagnosticoTelefone?.telefoneFormatado || cand.phone || cand.phone_api || 'Sem telefone'}
                            </Text>
                            {temAlertaTel ? (
                              <Pressable
                                onPress={() => handleAbrirEditarTelefone(cand)}
                                className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/30 flex-row items-center gap-0.5"
                              >
                                <Edit3 size={9} color="#fbbf24" />
                                <Text className="text-[9px] font-black text-amber-300 uppercase">
                                  Corrigir
                                </Text>
                              </Pressable>
                            ) : null}
                          </View>

                          <Pressable
                            onPress={() => handleExecutarSubstituicao(cand)}
                            className="px-3 py-1.5 rounded-lg bg-cyan-500 flex-row items-center gap-1 active:bg-cyan-600"
                          >
                            <Check size={11} color="#09090c" />
                            <Text className="text-[10px] font-black uppercase text-zinc-950">
                              {clienteParaSubstituir ? 'Substituir' : 'Selecionar'}
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                    );
                  })
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* MODAL CORRIGIR TELEFONE / CONTATO */}
        <Modal
          visible={!!modalEditarTelefone}
          transparent
          animationType="fade"
          statusBarTranslucent
          onRequestClose={() => setModalEditarTelefone(null)}
        >
          <View
            style={{ paddingBottom: keyboardHeight }}
            className="flex-1 justify-center items-center bg-black/85 p-4"
          >
            <Pressable
              className="absolute inset-0"
              onPress={() => {
                Keyboard.dismiss();
                setModalEditarTelefone(null);
              }}
            />
            <View className="w-full max-w-sm bg-[#121218] border border-zinc-800 rounded-2xl p-5 gap-3.5">
              <View className="flex-row items-center justify-between border-b border-zinc-800 pb-2.5">
                <View className="flex-row items-center gap-2">
                  <Phone size={16} color="#38bdf8" />
                  <Text className="text-xs font-black uppercase tracking-wider text-white">
                    Corrigir Telefone do Cliente
                  </Text>
                </View>
                <Pressable onPress={() => setModalEditarTelefone(null)}>
                  <X size={16} color="#a1a1aa" />
                </Pressable>
              </View>

              {modalEditarTelefone ? (
                <View className="gap-2.5">
                  <View className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
                    <Text className="text-xs font-black uppercase text-white truncate" numberOfLines={1}>
                      {modalEditarTelefone.nome_cliente}
                    </Text>
                    <Text className="text-[10px] text-zinc-400 font-medium mt-0.5">
                      CPF: {modalEditarTelefone.cpf_cnpj} • Débito: <Text className="text-rose-400 font-bold">{toBrl(modalEditarTelefone.v_inadim)}</Text>
                    </Text>
                  </View>

                  <View className="gap-1">
                    <Text className="text-[9px] font-black uppercase text-zinc-400">
                      Número de WhatsApp / Celular:
                    </Text>
                    <TextInput
                      value={telefoneEditando}
                      onChangeText={setTelefoneEditando}
                      placeholder="(92) 9XXXX-XXXX"
                      placeholderTextColor="#71717a"
                      keyboardType="phone-pad"
                      className="w-full h-11 bg-zinc-900 border border-zinc-800 rounded-xl px-3 text-sm text-white font-mono font-bold"
                    />
                  </View>

                  {/* DIAGNÓSTICO DO NÚMERO EM TEMPO REAL */}
                  {(() => {
                    const diag = InadimplenciaService.analisarTelefone(telefoneEditando);
                    return (
                      <View className="gap-1">
                        <View
                          className={`p-2.5 rounded-xl border ${
                            diag.tipoAlerta === 'erro'
                              ? 'bg-rose-500/10 border-rose-500/30'
                              : diag.tipoAlerta === 'atencao'
                              ? 'bg-amber-500/10 border-amber-500/30'
                              : 'bg-emerald-500/10 border-emerald-500/30'
                          }`}
                        >
                          <Text
                            className={`text-[10px] font-medium leading-tight ${
                              diag.tipoAlerta === 'erro'
                                ? 'text-rose-300'
                                : diag.tipoAlerta === 'atencao'
                                ? 'text-amber-300'
                                : 'text-emerald-300'
                            }`}
                          >
                            {diag.mensagemAlerta}
                          </Text>
                        </View>

                        {diag.sugestaoCorrecao ? (
                          <Pressable
                            onPress={() => {
                              triggerHaptic();
                              setTelefoneEditando(diag.sugestaoCorrecao!);
                            }}
                            className="p-2 bg-cyan-500/10 border border-cyan-500/30 rounded-xl flex-row items-center justify-between"
                          >
                            <Text className="text-[10px] text-cyan-300 font-medium">
                              Sugestão: <Text className="font-bold">{diag.sugestaoCorrecao}</Text>
                            </Text>
                            <Text className="text-[9px] font-black text-cyan-400 uppercase">
                              Aplicar
                            </Text>
                          </Pressable>
                        ) : null}
                      </View>
                    );
                  })()}

                  <Pressable
                    disabled={salvandoTelefone || !telefoneEditando.trim()}
                    onPress={handleSalvarTelefoneCorrigido}
                    className="w-full h-11 rounded-xl bg-cyan-500 items-center justify-center flex-row gap-2 active:bg-cyan-600 mt-1"
                  >
                    {salvandoTelefone ? (
                      <ActivityIndicator size="small" color="#09090c" />
                    ) : (
                      <>
                        <Check size={14} color="#09090c" />
                        <Text className="text-xs font-black uppercase text-zinc-950">
                          Salvar e Validar Contato
                        </Text>
                      </>
                    )}
                  </Pressable>
                </View>
              ) : null}
            </View>
          </View>
        </Modal>



        {/* MODAL DE EDITAR TEMPLATE DINÂMICO DE MENSAGEM */}
        <Modal
          visible={modalEditarTemplate}
          transparent
          animationType="slide"
          statusBarTranslucent
          onRequestClose={() => setModalEditarTemplate(false)}
        >
          <View
            style={{ paddingBottom: keyboardHeight }}
            className="flex-1 justify-end bg-black/85"
          >
            <Pressable
              className="flex-1"
              onPress={() => {
                Keyboard.dismiss();
                setModalEditarTemplate(false);
              }}
            />
            <View className="w-full bg-[#121218] border-t border-zinc-800 rounded-t-[32px] p-5 gap-4 max-h-[85%]">
              <ScrollView
                keyboardShouldPersistTaps="handled"
                bounces={false}
                showsVerticalScrollIndicator={false}
              >
                <View className="w-12 h-1 rounded-full bg-zinc-800 mx-auto mb-3" />

                <View className="flex-row items-center justify-between border-b border-zinc-800 pb-3">
                  <View className="flex-row items-center gap-2">
                    <Edit3 size={16} color="#fbbf24" />
                    <Text className="text-xs font-black uppercase tracking-wider text-white">
                      Template Dinâmico de Mensagem
                    </Text>
                  </View>
                  <Pressable onPress={() => setModalEditarTemplate(false)}>
                    <X size={16} color="#a1a1aa" />
                  </Pressable>
                </View>

                <Text className="text-xs text-zinc-300 leading-relaxed mt-3">
                  Mensagem oficial enviada aos clientes. Você pode usar variáveis dinâmicas estilo bot:
                </Text>

                {/* CHIPS DE VARIÁVEIS */}
                <View className="flex-row flex-wrap gap-1.5 mt-3 mb-3">
                  {['{nome}', '{primeiro_nome}', '{valor}', '{dias}', '{loja}'].map((tag) => (
                    <Pressable
                      key={tag}
                      onPress={() => setTemplateMensagem((prev) => `${prev} ${tag}`)}
                      className="px-2.5 py-1 bg-zinc-900 border border-amber-500/40 rounded-lg"
                    >
                      <Text className="text-[10px] font-mono font-black text-amber-300">{tag}</Text>
                    </Pressable>
                  ))}
                </View>

                <TextInput
                  value={templateMensagem}
                  onChangeText={setTemplateMensagem}
                  multiline
                  numberOfLines={6}
                  textAlignVertical="top"
                  className="w-full h-36 bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs text-white font-medium mb-4"
                />

                <View className="flex-row gap-2">
                  <Pressable
                    onPress={() => setTemplateMensagem(TEMPLATE_MENSAGEM_PADRAO)}
                    className="flex-1 h-11 bg-zinc-800 rounded-xl items-center justify-center active:bg-zinc-700"
                  >
                    <Text className="text-xs font-black uppercase text-zinc-300">Restaurar Padrão</Text>
                  </Pressable>

                  <Pressable
                    onPress={handleSalvarTemplate}
                    className="flex-1 h-11 bg-amber-500 rounded-xl items-center justify-center active:bg-amber-600"
                  >
                    <Text className="text-xs font-black uppercase text-zinc-950">Salvar Template</Text>
                  </Pressable>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* MODAL DE CONFIGURAÇÃO DE AUTOCOBRANÇA DA LOJA 27 */}
        <Modal
          visible={modalConfigAutocobranca}
          transparent
          animationType="slide"
          statusBarTranslucent
          onRequestClose={() => setModalConfigAutocobranca(false)}
        >
          <View
            style={{ paddingBottom: keyboardHeight }}
            className="flex-1 justify-end bg-black/85"
          >
            <Pressable
              className="flex-1"
              onPress={() => {
                Keyboard.dismiss();
                setModalConfigAutocobranca(false);
              }}
            />
            <View className="w-full bg-[#121218] border-t border-zinc-800 rounded-t-[32px] p-5 gap-4 max-h-[90%]">
              <View className="w-12 h-1 rounded-full bg-zinc-800 mx-auto" />

              <View className="flex-row items-center justify-between border-b border-zinc-800 pb-3">
                <View className="flex-row items-center gap-2">
                  <Zap size={18} color="#f59e0b" />
                  <View>
                    <Text className="text-xs font-black uppercase tracking-wider text-white">
                      Autocobrança Inteligente • Loja 27
                    </Text>
                    <Text className="text-[10px] text-zinc-400 font-medium">
                      Sincronização oficial em nuvem (Firebase RTDB)
                    </Text>
                  </View>
                </View>
                <Pressable onPress={() => setModalConfigAutocobranca(false)}>
                  <X size={16} color="#a1a1aa" />
                </Pressable>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingBottom: 16 }}>
                {/* STATUS MASTER (LIGADO / DESLIGADO) */}
                <View className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 gap-3">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1 mr-3">
                      <Text className="text-xs font-black uppercase text-white">
                        Ativar Autocobrança da Loja
                      </Text>
                      <Text className="text-[10px] text-zinc-400 font-medium mt-0.5">
                        Detecta ociosidade matinal e atrasos na cota diária de 30 disparos.
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => setFormAutocobrancaAtiva(!formAutocobrancaAtiva)}
                      className={`w-14 h-8 rounded-full p-1 transition-colors ${
                        formAutocobrancaAtiva ? 'bg-amber-500' : 'bg-zinc-800'
                      }`}
                    >
                      <View
                        className={`w-6 h-6 rounded-full bg-white transition-transform ${
                          formAutocobrancaAtiva ? 'translate-x-6' : 'translate-x-0'
                        }`}
                      />
                    </Pressable>
                  </View>
                </View>

                {/* SELETOR DE MODO OPERACIONAL */}
                <View className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 gap-3">
                  <Text className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">
                    Modo Operacional da Loja
                  </Text>
                  <View className="flex-row gap-2">
                    <Pressable
                      onPress={() => setFormAutocobrancaModo('co_piloto')}
                      className={`flex-1 p-3 rounded-xl border ${
                        formAutocobrancaModo === 'co_piloto'
                          ? 'bg-amber-500/15 border-amber-500/50'
                          : 'bg-zinc-950 border-zinc-800'
                      }`}
                    >
                      <View className="flex-row items-center gap-1.5 mb-1">
                        <ShieldAlert size={14} color={formAutocobrancaModo === 'co_piloto' ? '#f59e0b' : '#71717a'} />
                        <Text className={`text-xs font-black uppercase ${
                          formAutocobrancaModo === 'co_piloto' ? 'text-amber-300' : 'text-zinc-400'
                        }`}>
                          Co-Piloto
                        </Text>
                      </View>
                      <Text className="text-[9px] text-zinc-400 leading-relaxed font-medium">
                        Alerta a equipe na tela com a fila já montada para aprovação com 1 toque.
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => setFormAutocobrancaModo('autonomo')}
                      className={`flex-1 p-3 rounded-xl border ${
                        formAutocobrancaModo === 'autonomo'
                          ? 'bg-amber-500/15 border-amber-500/50'
                          : 'bg-zinc-950 border-zinc-800'
                      }`}
                    >
                      <View className="flex-row items-center gap-1.5 mb-1">
                        <Zap size={14} color={formAutocobrancaModo === 'autonomo' ? '#f59e0b' : '#71717a'} />
                        <Text className={`text-xs font-black uppercase ${
                          formAutocobrancaModo === 'autonomo' ? 'text-amber-300' : 'text-zinc-400'
                        }`}>
                          100% Autônomo
                        </Text>
                      </View>
                      <Text className="text-[9px] text-zinc-400 leading-relaxed font-medium">
                        Dispara automaticamente no horário limite se nenhum operador iniciou o lote.
                      </Text>
                    </Pressable>
                  </View>
                </View>

                {/* HORÁRIOS LIMITES DE OCIOSIDADE */}
                <View className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 gap-3">
                  <Text className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">
                    Horários Limites de Tolerância Matinal
                  </Text>
                  
                  <View className="flex-row gap-3">
                    <View className="flex-1 gap-1.5">
                      <Text className="text-[10px] text-zinc-300 font-bold uppercase">
                        Segunda a Sexta
                      </Text>
                      <TextInput
                        value={formHorarioDiasUteis}
                        onChangeText={setFormHorarioDiasUteis}
                        placeholder="09:30"
                        placeholderTextColor="#71717a"
                        className="h-10 bg-zinc-950 border border-zinc-800 rounded-xl px-3 text-white font-mono font-bold text-center"
                      />
                      <Text className="text-[8px] text-zinc-500">Padrão oficial: 09:30 AM</Text>
                    </View>

                    <View className="flex-1 gap-1.5">
                      <Text className="text-[10px] text-zinc-300 font-bold uppercase">
                        Sábado
                      </Text>
                      <TextInput
                        value={formHorarioSabado}
                        onChangeText={setFormHorarioSabado}
                        placeholder="09:00"
                        placeholderTextColor="#71717a"
                        className="h-10 bg-zinc-950 border border-zinc-800 rounded-xl px-3 text-white font-mono font-bold text-center"
                      />
                      <Text className="text-[8px] text-zinc-500">Expediente reduzido (até 13h)</Text>
                    </View>
                  </View>
                </View>

                {/* URGÊNCIA CIRÚRGICA DE SÁBADO */}
                <View className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 gap-3">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1 mr-3">
                      <Text className="text-xs font-black uppercase text-white">
                        Cobrança Cirúrgica no Sábado
                      </Text>
                      <Text className="text-[10px] text-zinc-400 font-medium mt-0.5">
                        Foca em clientes recém-vencidos de alto valor e casos pré-perda (D+85 a D+89) usando estritamente o template oficial.
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => setFormUrgenciaSabado(!formUrgenciaSabado)}
                      className={`w-14 h-8 rounded-full p-1 transition-colors ${
                        formUrgenciaSabado ? 'bg-amber-500' : 'bg-zinc-800'
                      }`}
                    >
                      <View
                        className={`w-6 h-6 rounded-full bg-white transition-transform ${
                          formUrgenciaSabado ? 'translate-x-6' : 'translate-x-0'
                        }`}
                      />
                    </Pressable>
                  </View>
                </View>

                <Text className="text-[9px] text-zinc-500 text-center px-4 leading-relaxed font-medium">
                  🔒 Trava de Segurança: Qualquer alteração salva será sincronizada instantaneamente via Firebase RTDB para todos os computadores e celulares da Loja 27.
                </Text>
              </ScrollView>

              <View className="flex-row gap-2 pt-2 border-t border-zinc-800">
                <Pressable
                  onPress={() => setModalConfigAutocobranca(false)}
                  className="flex-1 h-11 bg-zinc-800 rounded-xl items-center justify-center active:bg-zinc-700"
                >
                  <Text className="text-xs font-black uppercase text-zinc-300">Cancelar</Text>
                </Pressable>

                <Pressable
                  onPress={handleSalvarConfigAutocobranca}
                  disabled={salvandoConfigAutocobranca}
                  className="flex-1 h-11 bg-amber-500 rounded-xl items-center justify-center active:bg-amber-600"
                >
                  {salvandoConfigAutocobranca ? (
                    <ActivityIndicator size="small" color="#09090c" />
                  ) : (
                    <Text className="text-xs font-black uppercase text-zinc-950">Salvar Opções</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {/* MODAL DE ANÁLISE MATEMÁTICA DO SCORE (P_i') */}
        <Modal
          visible={!!modalScoreDetalhado}
          transparent
          animationType="slide"
          onRequestClose={() => setModalScoreDetalhado(null)}
        >
          <View className="flex-1 justify-end bg-black/85">
            <View className="w-full bg-[#121218] border-t border-zinc-800 rounded-t-[32px] p-5 gap-4 max-h-[85%]">
              <View className="w-12 h-1 rounded-full bg-zinc-800 mx-auto" />

              <View className="flex-row items-center justify-between border-b border-zinc-800 pb-3">
                <View className="flex-row items-center gap-2">
                  <Calculator size={18} color="#38bdf8" />
                  <Text className="text-xs font-black uppercase tracking-wider text-white">
                    Análise Matemática de Priorização (P_i')
                  </Text>
                </View>
                <Pressable onPress={() => setModalScoreDetalhado(null)}>
                  <X size={16} color="#a1a1aa" />
                </Pressable>
              </View>

              {modalScoreDetalhado && (
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingBottom: 20 }}>
                  {/* IDENTIFICAÇÃO DO CLIENTE */}
                  <View className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3.5 gap-2">
                    <View className="flex-row items-center justify-between">
                      <Text className="text-xs font-black text-white uppercase flex-1 min-w-0 mr-2" numberOfLines={1}>
                        {modalScoreDetalhado.cliente.nome_cliente}
                      </Text>
                      <View className="px-2 py-0.5 rounded bg-cyan-500/20 border border-cyan-500/30 flex-shrink-0">
                        <Text className="text-[9px] font-black text-cyan-300">
                          {toBrl(modalScoreDetalhado.cliente.v_inadim)}
                        </Text>
                      </View>
                    </View>
                    <Text className="text-[10px] text-zinc-400 font-mono">
                      CPF: {modalScoreDetalhado.cliente.cpf_cnpj} • Atraso: {modalScoreDetalhado.cliente.atraso_dias} dias
                    </Text>
                  </View>

                  {/* CARD DE SCORE FINAL */}
                  <View className="bg-cyan-500/10 border border-cyan-500/30 rounded-2xl p-4 gap-2">
                    <View className="flex-row items-center justify-between">
                      <Text className="text-[10px] font-black uppercase tracking-wider text-cyan-300">
                        Score Final de Cobrança (P_i')
                      </Text>
                      <Text className="text-2xl font-black text-white">
                        {modalScoreDetalhado.score.scoreFinal}
                        <Text className="text-xs font-bold text-zinc-400"> / 100</Text>
                      </Text>
                    </View>

                    <View className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <View
                        className="h-full bg-cyan-400 rounded-full"
                        style={{ width: `${Math.min(100, modalScoreDetalhado.score.scoreFinal)}%` }}
                      />
                    </View>

                    <Text className="text-[10px] text-zinc-300 leading-relaxed font-medium">
                      Fórmula: P_i' = (0.40·S_tempo + 0.35·S_ruptura + 0.25·S_novo) × E_i × δ_fadiga × C_i × 100
                    </Text>
                  </View>

                  {/* SUBCATEGORIA COMPORTAMENTAL DA CLARA ELETRO */}
                  {modalScoreDetalhado.score.subcategoria && (
                    <View className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3.5 gap-1.5">
                      <View className="flex-row items-center justify-between">
                        <View className="flex-row items-center gap-1.5 flex-1 mr-2">
                          <Zap size={13} color="#f59e0b" />
                          <Text className="text-xs font-black uppercase text-amber-300 flex-1" numberOfLines={1}>
                            {modalScoreDetalhado.score.subcategoria.nome}
                          </Text>
                        </View>
                        <View className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/30">
                          <Text className="text-[9px] font-black text-amber-300">
                            Peso: {modalScoreDetalhado.score.subcategoria.pesoMultiplicador}x
                          </Text>
                        </View>
                      </View>
                      <Text className="text-[10px] text-amber-200/80 leading-relaxed font-medium">
                        {modalScoreDetalhado.score.subcategoria.descricao}
                      </Text>
                    </View>
                  )}

                  {/* BREAKDOWN DOS FATORES */}
                  <View className="gap-2">
                    <Text className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">
                      Decomposição dos Componentes Matemáticos:
                    </Text>

                    {/* S_TEMPO */}
                    <View className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 gap-1">
                      <View className="flex-row items-center justify-between">
                        <Text className="text-xs font-black text-white">
                          S_tempo: Degradação Temporal (40%)
                        </Text>
                        <Text className="text-xs font-mono font-black text-cyan-300">
                          {modalScoreDetalhado.score.sTempo}
                        </Text>
                      </View>
                      <Text className="text-[10px] text-zinc-400">
                        Curva exponencial de decaimento com carência de 4 dias. Dias efetivos: {Math.max(0, (modalScoreDetalhado.cliente.atraso_dias || 0) - 4)}.
                      </Text>
                    </View>

                    {/* S_RUPTURA */}
                    <View className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 gap-1">
                      <View className="flex-row items-center justify-between">
                        <Text className="text-xs font-black text-white">
                          S_ruptura: Quebra de Hábito (35%)
                        </Text>
                        <Text className="text-xs font-mono font-black text-cyan-300">
                          {modalScoreDetalhado.score.sRuptura}
                        </Text>
                      </View>
                      <Text className="text-[10px] text-zinc-400">
                        Historicamente pontual ({toBrl(modalScoreDetalhado.cliente.v_recebido)} quitados) que subitamente parou de pagar. Maior potencial de recuperação rápida.
                      </Text>
                    </View>

                    {/* S_NOVO */}
                    <View className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 gap-1">
                      <View className="flex-row items-center justify-between">
                        <Text className="text-xs font-black text-white">
                          S_novo: Risco 1º Carnê (25%)
                        </Text>
                        <Text className="text-xs font-mono font-black text-cyan-300">
                          {modalScoreDetalhado.score.sNovo}
                        </Text>
                      </View>
                      <Text className="text-[10px] text-zinc-400">
                        Cliente novo sem histórico de pagamento anterior. Risco alto de inadimplência crônica se não acionado no início.
                      </Text>
                    </View>

                    {/* E_I EXPOSICAO */}
                    <View className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 gap-1">
                      <View className="flex-row items-center justify-between">
                        <Text className="text-xs font-black text-white">
                          E_i: Exposição Financeira Relativa
                        </Text>
                        <Text className="text-xs font-mono font-black text-cyan-300">
                          {modalScoreDetalhado.score.exposicao}
                        </Text>
                      </View>
                      <Text className="text-[10px] text-zinc-400">
                        Escala logarítmica ln(1 + V_inadim) comparada ao teto de inadimplência da loja C. Purupuru.
                      </Text>
                    </View>

                    {/* FADIGA */}
                    <View className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 gap-1">
                      <View className="flex-row items-center justify-between">
                        <Text className="text-xs font-black text-white">
                          δ_cobranca: Coeficiente de Fadiga
                        </Text>
                        <Text className="text-xs font-mono font-black text-cyan-300">
                          {modalScoreDetalhado.score.fadiga}
                        </Text>
                      </View>
                      <Text className="text-[10px] text-zinc-400">
                        Penaliza clientes que já receberam {modalScoreDetalhado.cliente.cobranca_qtd_envios_total || 0} envios sem retorno, priorizando novos contatos.
                      </Text>
                    </View>

                    {/* CONTACTABILIDADE C_I */}
                    <View className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 gap-1">
                      <View className="flex-row items-center justify-between">
                        <Text className="text-xs font-black text-white">
                          C_i: Contactabilidade Operacional
                        </Text>
                        <Text
                          className={`text-xs font-mono font-black ${
                            modalScoreDetalhado.score.contactabilidade > 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {modalScoreDetalhado.score.contactabilidade}
                        </Text>
                      </View>
                      <Text className="text-[10px] text-zinc-400">
                        {modalScoreDetalhado.score.contactabilidade === 0
                          ? 'Fator ZERO: Telefone inválido (DDD 20) ou sem WhatsApp. Zera o score para não desperdiçar disparos digitais e encaminha para Trilha Presencial / PDV.'
                          : 'Número válido e apto para disparo oficial via WhatsApp OneBox.'}
                      </Text>
                    </View>
                  </View>

                  <Pressable
                    onPress={() => setModalScoreDetalhado(null)}
                    className="w-full h-11 bg-cyan-500 rounded-xl items-center justify-center active:bg-cyan-600 mt-2"
                  >
                    <Text className="text-xs font-black uppercase text-zinc-950">Entendido</Text>
                  </Pressable>
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>

        {/* MODAL DE DIAGNÓSTICO INTELIGENTE DE ERROS */}
        <Modal
          visible={!!modalDiagnostico}
          transparent
          animationType="fade"
          onRequestClose={() => setModalDiagnostico(null)}
        >
          <View className="flex-1 justify-center items-center bg-black/80 px-4">
            <View className="w-full max-w-md bg-[#121218] border border-rose-500/30 rounded-3xl p-5 gap-4">
              <View className="flex-row items-center justify-between border-b border-zinc-800 pb-3">
                <View className="flex-row items-center gap-2.5">
                  <View className="h-8 w-8 rounded-xl bg-rose-500/20 border border-rose-500/40 items-center justify-center">
                    <ShieldAlert size={16} color="#f87171" />
                  </View>
                  <Text className="text-xs font-black uppercase tracking-wider text-white">
                    Diagnóstico da Falha
                  </Text>
                </View>
                <Pressable onPress={() => setModalDiagnostico(null)}>
                  <X size={16} color="#a1a1aa" />
                </Pressable>
              </View>

              {modalDiagnostico && (
                <View className="gap-3">
                  <View>
                    <Text className="text-sm font-black text-rose-300 uppercase">
                      {modalDiagnostico.titulo}
                    </Text>
                    <Text className="text-xs text-zinc-300 mt-1 leading-relaxed">
                      {modalDiagnostico.descricaoAmigavel}
                    </Text>
                  </View>

                  <View className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 gap-1">
                    <Text className="text-[10px] font-black uppercase text-amber-400">
                      Ação Recomendada pela Clara Eletro:
                    </Text>
                    <Text className="text-[11px] text-zinc-200 font-medium">
                      {modalDiagnostico.acaoSugerida}
                    </Text>
                  </View>

                  <View className="bg-black/50 border border-zinc-800 rounded-xl p-3 gap-1">
                    <Text className="text-[9px] font-black uppercase text-zinc-500">
                      Log Técnico do Provedor OneBox:
                    </Text>
                    <Text className="text-[10px] text-zinc-400 font-mono">
                      {modalDiagnostico.mensagemBruta || 'Sem log disponível'}
                    </Text>
                  </View>
                </View>
              )}

              <Pressable
                onPress={() => setModalDiagnostico(null)}
                className="w-full h-11 bg-zinc-800 rounded-xl items-center justify-center active:bg-zinc-700 mt-1"
              >
                <Text className="text-xs font-black uppercase text-white">Fechar Análise</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        {/* MODAL DE EXCLUSÃO TEMPORÁRIA (INDIVIDUAL E GERAL) */}
        <Modal
          visible={!!modalExclusaoCliente || modalExclusaoGeral}
          transparent
          animationType="slide"
          statusBarTranslucent
          onRequestClose={() => {
            setModalExclusaoCliente(null);
            setModalExclusaoGeral(false);
          }}
        >
          <View
            style={{ paddingBottom: keyboardHeight }}
            className="flex-1 justify-end bg-black/80"
          >
            <Pressable
              className="flex-1"
              onPress={() => {
                Keyboard.dismiss();
                setModalExclusaoCliente(null);
                setModalExclusaoGeral(false);
              }}
            />
            <View className="w-full bg-[#121218] border-t border-zinc-800 rounded-t-[32px] p-5 gap-4 max-h-[85%]">
              <ScrollView
                keyboardShouldPersistTaps="handled"
                bounces={false}
                showsVerticalScrollIndicator={false}
              >
                <View className="w-12 h-1 rounded-full bg-zinc-800 mx-auto mb-3" />

                <View className="flex-row items-center justify-between border-b border-zinc-800 pb-3">
                  <View className="flex-row items-center gap-2">
                    <PauseCircle size={18} color="#fbbf24" />
                    <Text className="text-xs font-black uppercase tracking-wider text-white">
                      {modalExclusaoGeral ? 'Pausar Cobrança Geral' : 'Pausar Cobrança Individual'}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => {
                      setModalExclusaoCliente(null);
                      setModalExclusaoGeral(false);
                    }}
                  >
                    <X size={16} color="#a1a1aa" />
                  </Pressable>
                </View>

                {modalExclusaoCliente && (
                  <View className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 mt-3">
                    <Text className="text-xs font-black uppercase text-white truncate">
                      {modalExclusaoCliente.nome_cliente}
                    </Text>
                    <Text className="text-[10px] text-zinc-400 font-mono mt-0.5">
                      CPF: {modalExclusaoCliente.cpf_cnpj} • Em débito: {toBrl(modalExclusaoCliente.v_inadim)}
                    </Text>
                  </View>
                )}

                {modalExclusaoGeral && (
                  <View className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 mt-3">
                    <Text className="text-xs font-black uppercase text-amber-300">
                      Atenção: Exclusão em Lote
                    </Text>
                    <Text className="text-[11px] text-zinc-300 mt-1">
                      Esta regra será aplicada a todos os {clientesFiltrados.length} clientes atualmente filtrados na tela.
                    </Text>
                  </View>
                )}

                {/* SELEÇÃO DO PERÍODO DE PAUSA */}
                <View className="gap-2 mt-3">
                  <Text className="text-[11px] font-black uppercase text-zinc-400">
                    Por quanto tempo pausar a cobrança?
                  </Text>
                  <View className="flex-row gap-2">
                    {[7, 15, 30, 60].map((d) => (
                      <Pressable
                        key={d}
                        onPress={() => setDiasExclusao(d)}
                        className={`flex-1 h-11 rounded-xl items-center justify-center border ${
                          diasExclusao === d
                            ? 'bg-amber-500/20 border-amber-500'
                            : 'bg-zinc-900 border-zinc-800'
                        }`}
                      >
                        <Text
                          className={`text-xs font-black ${
                            diasExclusao === d ? 'text-amber-300' : 'text-zinc-400'
                          }`}
                        >
                          {d} dias
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                {/* SELEÇÃO DO MOTIVO */}
                <View className="gap-2 mt-3">
                  <Text className="text-[11px] font-black uppercase text-zinc-400">
                    Motivo da Pausa (Auditoria Operacional)
                  </Text>
                  {[
                    'Promessa de pagamento no balcão',
                    'Renegociação de carnê em andamento',
                    'Contestação de valores / juros',
                    'Visita domiciliar agendada',
                  ].map((m) => (
                    <Pressable
                      key={m}
                      onPress={() => {
                        setMotivoExclusao(m);
                        setMotivoCustomizado('');
                      }}
                      className={`p-2.5 rounded-xl border flex-row items-center justify-between ${
                        motivoExclusao === m && !motivoCustomizado
                          ? 'bg-zinc-800 border-amber-500/50'
                          : 'bg-zinc-900 border-zinc-800'
                      }`}
                    >
                      <Text
                        className={`text-[11px] font-bold ${
                          motivoExclusao === m && !motivoCustomizado ? 'text-amber-300 font-black' : 'text-zinc-300'
                        }`}
                      >
                        {m}
                      </Text>
                    </Pressable>
                  ))}

                  <TextInput
                    value={motivoCustomizado}
                    onChangeText={setMotivoCustomizado}
                    placeholder="Ou digite outro motivo específico..."
                    placeholderTextColor="#71717a"
                    className="w-full h-11 bg-zinc-900 border border-zinc-800 rounded-xl px-3 text-xs text-white font-bold mt-1"
                  />
                </View>

                {/* BOTÃO CONFIRMAR */}
                <Pressable
                  onPress={
                    modalExclusaoGeral
                      ? handleConfirmarExclusaoGeral
                      : handleConfirmarExclusaoIndividual
                  }
                  className="w-full h-12 bg-amber-500 rounded-xl items-center justify-center active:bg-amber-600 mt-4 mb-2"
                >
                  <Text className="text-xs font-black uppercase text-zinc-950">
                    {modalExclusaoGeral
                      ? `Pausar ${clientesFiltrados.length} Clientes por ${diasExclusao} Dias`
                      : `Confirmar Pausa por ${diasExclusao} Dias`}
                  </Text>
                </Pressable>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* MODAL DE COBRANÇA INDIVIDUAL (WHATSAPP) */}
        <Modal
          visible={!!modalCobrancaIndividual}
          transparent
          animationType="slide"
          statusBarTranslucent
          onRequestClose={() => setModalCobrancaIndividual(null)}
        >
          <View
            style={{ paddingBottom: keyboardHeight }}
            className="flex-1 justify-end bg-black/80"
          >
            <Pressable
              className="flex-1"
              onPress={() => {
                Keyboard.dismiss();
                setModalCobrancaIndividual(null);
              }}
            />
            <View className="w-full bg-[#121218] border-t border-zinc-800 rounded-t-[32px] p-5 gap-4 max-h-[85%]">
              <ScrollView
                keyboardShouldPersistTaps="handled"
                bounces={false}
                showsVerticalScrollIndicator={false}
              >
                <View className="w-12 h-1 rounded-full bg-zinc-800 mx-auto mb-3" />

                <View className="flex-row items-center justify-between border-b border-zinc-800 pb-3">
                  <View className="flex-row items-center gap-2">
                    <Send size={16} color="#38bdf8" />
                    <Text className="text-xs font-black uppercase tracking-wider text-white">
                      Cobrança Individual Clara Eletro
                    </Text>
                  </View>
                  <Pressable onPress={() => setModalCobrancaIndividual(null)}>
                    <X size={16} color="#a1a1aa" />
                  </Pressable>
                </View>

                {modalCobrancaIndividual && (
                  <View className="gap-3 mt-3">
                    <View className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3.5 gap-2">
                      <View className="flex-row items-center justify-between">
                        <Text className="text-xs font-black uppercase text-white truncate flex-1 mr-2">
                          {modalCobrancaIndividual.nome_cliente}
                        </Text>
                        <View className="px-2 py-0.5 rounded-md bg-rose-500/20 border border-rose-500/30">
                          <Text className="text-[9px] font-black text-rose-300 uppercase">
                            {modalCobrancaIndividual.atraso_dias || 15}d de Atraso Real
                          </Text>
                        </View>
                      </View>

                      <View className="flex-row items-center justify-between pt-2 border-t border-zinc-800/80">
                        <View>
                          <Text className="text-[8px] font-bold text-zinc-500 uppercase">Débito em Aberto</Text>
                          <Text className="text-sm font-black text-rose-400 font-mono">
                            {toBrl(modalCobrancaIndividual.v_inadim)}
                          </Text>
                        </View>
                        <View className="items-end">
                          <Text className="text-[8px] font-bold text-zinc-500 uppercase">Vencimento Original</Text>
                          <Text className="text-xs font-bold text-zinc-300">
                            {modalCobrancaIndividual.dataVencimentoReal || calcularDataVencimento(modalCobrancaIndividual.atraso_dias || 15)} {modalCobrancaIndividual.safra ? `(${modalCobrancaIndividual.safra})` : ''}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <Pressable
                      onPress={() => {
                        const c = modalCobrancaIndividual;
                        setModalCobrancaIndividual(null);
                        handleAbrirRegistrarPagamentoLoja(c);
                      }}
                      className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 flex-row items-center justify-between active:bg-amber-500/25"
                    >
                      <View className="flex-row items-center gap-2">
                        <Clock size={14} color="#fbbf24" />
                        <Text className="text-[10px] font-black uppercase text-amber-300">
                          Cliente pagou no balcão da loja?
                        </Text>
                      </View>
                      <Text className="text-[9px] font-black text-amber-400">
                        Ativar Trava D+1 (48h) ›
                      </Text>
                    </Pressable>

                    <View className="gap-1.5">
                      <View className="flex-row items-center justify-between">
                        <Text className="text-[10px] font-black uppercase text-zinc-400">
                          Telefone / WhatsApp de Destino:
                        </Text>
                        {telefoneSelecionado.includes('20') && (
                          <Pressable
                            onPress={() => {
                              const corrigido = telefoneSelecionado.replace('20', '92');
                              setTelefoneSelecionado(corrigido);
                            }}
                          >
                            <Text className="text-[10px] font-black text-cyan-300">
                              Mudar DDD 20 p/ 92
                            </Text>
                          </Pressable>
                        )}
                      </View>
                      <View className="flex-row items-center gap-2">
                        <TextInput
                          value={telefoneSelecionado}
                          onChangeText={setTelefoneSelecionado}
                          placeholder="(92) 99999-9999"
                          placeholderTextColor="#71717a"
                          keyboardType="phone-pad"
                          className="flex-1 h-11 bg-zinc-900 border border-zinc-800 rounded-xl px-3 text-xs text-white font-mono font-bold"
                        />
                        <Pressable
                          onPress={() => {
                            triggerHaptic();
                            const digits = telefoneSelecionado.replace(/\D/g, '');
                            if (digits) void Linking.openURL(`tel:${digits}`);
                          }}
                          className="h-11 px-3 bg-zinc-800 border border-zinc-700 rounded-xl items-center justify-center flex-row gap-1 active:bg-zinc-700"
                        >
                          <Phone size={13} color="#38bdf8" />
                          <Text className="text-[10px] font-bold text-zinc-200">Ligar</Text>
                        </Pressable>
                      </View>
                    </View>

                    <View className="gap-1.5">
                      <Text className="text-[10px] font-black uppercase text-zinc-400">
                        Mensagem de Cobrança (Dinâmica):
                      </Text>
                      <TextInput
                        value={mensagemCobranca}
                        onChangeText={setMensagemCobranca}
                        multiline
                        numberOfLines={5}
                        textAlignVertical="top"
                        className="w-full h-28 bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs text-white font-medium"
                      />
                    </View>

                    <View className="flex-row gap-2 pt-1 pb-2">
                      <Pressable
                        disabled={enviandoCobranca}
                        onPress={() => handleEnviarCobrancaIndividual(false)}
                        className="flex-1 h-12 bg-cyan-500 rounded-xl items-center justify-center active:bg-cyan-600 flex-row gap-2"
                      >
                        {enviandoCobranca ? (
                          <ActivityIndicator size="small" color="#09090c" />
                        ) : (
                          <>
                            <Send size={15} color="#09090c" />
                            <Text className="text-xs font-black uppercase text-zinc-950">
                              Disparar via OneBox
                            </Text>
                          </>
                        )}
                      </Pressable>

                      <Pressable
                        onPress={() => handleEnviarCobrancaIndividual(true)}
                        className="px-4 h-12 bg-emerald-600 rounded-xl items-center justify-center active:bg-emerald-700 flex-row gap-1.5"
                      >
                        <Phone size={15} color="#ffffff" />
                        <Text className="text-xs font-black uppercase text-white">
                          WhatsApp App
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* MODAL DE HISTÓRICO E CONTRATOS */}
        <Modal
          visible={!!modalDetalhesContrato}
          transparent
          animationType="fade"
          onRequestClose={() => setModalDetalhesContrato(null)}
        >
          <View className="flex-1 justify-center items-center bg-black/85 px-3 sm:px-4">
            <View className="w-full max-w-lg bg-[#121218] border border-zinc-800 rounded-3xl p-5 gap-3.5 max-h-[88%]">
              {/* HEADER */}
              <View className="flex-row items-center justify-between border-b border-zinc-800 pb-3">
                <View className="flex-row items-center gap-2.5 flex-1 min-w-0 mr-2">
                  <View className="h-9 w-9 rounded-xl bg-cyan-500/15 border border-cyan-500/30 items-center justify-center">
                    <FileText size={18} color="#38bdf8" />
                  </View>
                  <View className="flex-1 min-w-0">
                    <Text className="text-sm font-black uppercase tracking-wider text-white truncate">
                      {modalDetalhesContrato?.nome_cliente || 'Contratos & Parcelas'}
                    </Text>
                    <Text className="text-[10px] text-zinc-400 font-mono truncate">
                      CPF: {modalDetalhesContrato?.cpf} • Cód: {modalDetalhesContrato?.codigo_cliente || 'N/A'} • Loja 27
                    </Text>
                  </View>
                </View>
                <Pressable
                  onPress={() => setModalDetalhesContrato(null)}
                  className="h-8 w-8 rounded-full bg-zinc-800/80 items-center justify-center active:bg-zinc-700"
                >
                  <X size={15} color="#a1a1aa" />
                </Pressable>
              </View>

              {modalDetalhesContrato && (
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingBottom: 8 }}>
                  {/* CARD ELEGANTE DE TELEFONE E WHATSAPP */}
                  {modalDetalhesContrato.telefones && modalDetalhesContrato.telefones.length > 0 && (
                    <View className="bg-emerald-950/30 border border-emerald-500/35 rounded-2xl p-3.5 gap-2.5">
                      <View className="flex-row items-center justify-between">
                        <View className="flex-row items-center gap-1.5">
                          <Phone size={13} color="#34d399" />
                          <Text className="text-[10px] font-black uppercase text-emerald-400 tracking-wider">
                            Contato Oficial do Cliente
                          </Text>
                        </View>
                        <View className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40">
                          <Text className="text-[9px] font-black text-emerald-300 uppercase">
                            WhatsApp Apto
                          </Text>
                        </View>
                      </View>

                      {modalDetalhesContrato.telefones.map((tel, tIdx) => (
                        <View
                          key={tIdx}
                          className="flex-row items-center justify-between bg-zinc-900/90 border border-zinc-800 rounded-xl px-3 py-2"
                        >
                          <View className="flex-1 min-w-0 mr-2">
                            <Text className="text-sm font-mono font-black text-white">
                              {tel.display || tel.raw}
                            </Text>
                            <Text className="text-[9px] text-zinc-400">
                              {tIdx === 0 ? 'Telefone Principal • Amazonas' : 'Telefone Secundário'}
                            </Text>
                          </View>

                          <View className="flex-row items-center gap-1.5 flex-shrink-0">
                            <Pressable
                              onPress={() => {
                                triggerHaptic();
                                const phoneStr = tel.raw || tel.display || '';
                                const digits = phoneStr.replace(/\D/g, '');
                                if (digits) void Linking.openURL(`tel:${digits}`);
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 flex-row items-center gap-1 active:bg-zinc-700"
                            >
                              <Phone size={12} color="#38bdf8" />
                              <Text className="text-[10px] font-bold text-zinc-200">Ligar</Text>
                            </Pressable>

                            <Pressable
                              onPress={() => {
                                triggerHaptic();
                                const phoneStr = tel.raw || tel.display || '';
                                if (phoneStr) {
                                  void InadimplenciaService.abrirWhatsappNativo(
                                    phoneStr,
                                    `Olá ${modalDetalhesContrato?.nome_cliente || ''}! Somos da Clara Eletro Purupuru.`
                                  );
                                }
                              }}
                              className="px-3 py-1.5 rounded-lg bg-emerald-500 flex-row items-center gap-1.5 active:bg-emerald-600"
                            >
                              <MessageCircle size={12} color="#09090c" />
                              <Text className="text-[10px] font-black uppercase text-zinc-950">
                                WhatsApp
                              </Text>
                            </Pressable>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* BOTÃO RÁPIDO REGISTRAR PAGAMENTO EM LOJA */}
                  <Pressable
                    onPress={() => {
                      const cFound = clientes.find((c) => c.cpf_cnpj === modalDetalhesContrato.cpf) || ({
                        cpf_cnpj: modalDetalhesContrato.cpf,
                        nome_cliente: modalDetalhesContrato.nome_cliente,
                        v_inadim: modalDetalhesContrato.totais?.v_inadim || 0,
                        id_cliente: modalDetalhesContrato.codigo_cliente || '',
                      } as ClienteInadimplente);

                      setModalDetalhesContrato(null);
                      handleAbrirRegistrarPagamentoLoja(cFound);
                    }}
                    className="p-3 bg-amber-500/15 border border-amber-500/35 rounded-2xl flex-row items-center justify-between active:bg-amber-500/25"
                  >
                    <View className="flex-row items-center gap-2.5 flex-1 min-w-0 mr-2">
                      <Clock size={16} color="#fbbf24" />
                      <View className="flex-1 min-w-0">
                        <Text className="text-xs font-black uppercase text-amber-300">
                          Registrar Pagamento em Loja (Trava 48h D+1)
                        </Text>
                        <Text className="text-[9px] text-zinc-300 mt-0.5 font-medium">
                          Blindar cliente contra mensagens automáticas de cobrança no WhatsApp.
                        </Text>
                      </View>
                    </View>
                    <ChevronRight size={15} color="#fbbf24" />
                  </Pressable>

                  {/* FAIXA RESUMO DO CARNÊ / DÉBITO */}
                  <View className="flex-row gap-2">
                    <View className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 items-center justify-center">
                      <Text className="text-[9px] font-bold text-zinc-500 uppercase">Total Carnê</Text>
                      <Text className="text-xs font-black text-zinc-200 mt-0.5">
                        {toBrl(modalDetalhesContrato.totais?.v_total || modalDetalhesContrato.contratos[0]?.valorTotal || 0)}
                      </Text>
                    </View>

                    <View className="flex-1 bg-rose-950/20 border border-rose-500/30 rounded-xl p-2.5 items-center justify-center">
                      <Text className="text-[9px] font-black text-rose-400 uppercase">Em Aberto</Text>
                      <Text className="text-xs font-black text-rose-300 mt-0.5">
                        {toBrl(modalDetalhesContrato.totais?.v_inadim || modalDetalhesContrato.contratos[0]?.saldoAberto || 0)}
                      </Text>
                    </View>

                    <View className="flex-1 bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-2.5 items-center justify-center">
                      <Text className="text-[9px] font-black text-emerald-400 uppercase">Já Quitado</Text>
                      <Text className="text-xs font-black text-emerald-300 mt-0.5">
                        {toBrl(modalDetalhesContrato.totais?.v_recebido || 0)}
                      </Text>
                    </View>
                  </View>

                  {/* CARD DE SAÚDE FINANCEIRA & DIAGNÓSTICO DE RISCO (VISÃO DE DONO) */}
                  {(() => {
                    const cMatch = clientes.find((item) => item.cpf_cnpj.replace(/\D/g, '') === modalDetalhesContrato.cpf.replace(/\D/g, ''));
                    const saude = cMatch?.saudeFinanceira || calcularSaudeFinanceiraCliente({
                      v_total: modalDetalhesContrato.totais?.v_total || modalDetalhesContrato.contratos[0]?.valorTotal || 0,
                      v_recebido: modalDetalhesContrato.totais?.v_recebido || 0,
                      v_inadim: modalDetalhesContrato.totais?.v_inadim || modalDetalhesContrato.contratos[0]?.saldoAberto || 0,
                      parcelas_total: modalDetalhesContrato.totais?.parcelas_total || modalDetalhesContrato.contratos[0]?.parcelasTotal || 1,
                      parcelas_aberto: modalDetalhesContrato.totais?.parcelas_aberto || modalDetalhesContrato.contratos[0]?.parcelasAberto || 1,
                      atraso_dias: modalDetalhesContrato.totais?.dias_atraso || 0,
                      contratos: modalDetalhesContrato.contratos?.length || 1,
                      nome_cliente: modalDetalhesContrato.nome_cliente,
                    });

                    return (
                      <View className="bg-[#181820] border border-zinc-800 rounded-2xl p-3.5 gap-2.5">
                        <View className="flex-row items-center justify-between">
                          <View className="flex-row items-center gap-1.5">
                            <HeartPulse size={14} color={saude.corHex} />
                            <Text className="text-[10px] font-black uppercase text-zinc-300 tracking-wider">
                              Saúde Financeira do Cliente
                            </Text>
                          </View>
                          <View className={`px-2 py-0.5 rounded-full border flex-row items-center gap-1 ${saude.corBadgeBg} ${saude.corBadgeBorder}`}>
                            <Text className={`text-[9px] font-black uppercase ${saude.corBadgeText}`}>
                              {saude.rotuloNivel} • Risco {saude.grauRiscoReal}
                            </Text>
                          </View>
                        </View>

                        {/* BARRA DE SAÚDE */}
                        <View className="gap-1">
                          <View className="flex-row items-center justify-between">
                            <Text className="text-[10px] font-bold text-zinc-400">Score de Saúde</Text>
                            <Text className="text-xs font-black text-white">{saude.scoreSaude} / 100</Text>
                          </View>
                          <View className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                            <View
                              className="h-full rounded-full"
                              style={{ width: `${saude.scoreSaude}%`, backgroundColor: saude.corHex }}
                            />
                          </View>
                        </View>

                        {/* DIAGNÓSTICO EXECUTIVO */}
                        <View className="bg-zinc-900/80 border border-zinc-800/80 rounded-xl p-2.5 gap-1">
                          <Text className="text-[9px] font-black uppercase text-zinc-400">
                            {saude.resumoQuitacao}
                          </Text>
                          <Text className="text-[10px] text-zinc-300 leading-relaxed font-medium">
                            {saude.diagnosticoExecutivo}
                          </Text>
                        </View>
                      </View>
                    );
                  })()}

                  {/* SEÇÃO HISTÓRICO & LINHA DO TEMPO DO CLIENTE */}
                  <View className="bg-[#181820] border border-zinc-800 rounded-2xl p-3.5 gap-2.5">
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center gap-1.5">
                        <History size={14} color="#38bdf8" />
                        <Text className="text-[10px] font-black uppercase text-zinc-300 tracking-wider">
                          Linha do Tempo & Histórico do Cliente
                        </Text>
                      </View>
                      {carregandoHistorico ? (
                        <ActivityIndicator size="small" color="#38bdf8" />
                      ) : (
                        <Text className="text-[9px] font-bold text-zinc-500">
                          {historicoClienteAtual.length} registro(s)
                        </Text>
                      )}
                    </View>

                    {historicoClienteAtual.length > 0 ? (
                      <View className="gap-2 pt-1">
                        {historicoClienteAtual.map((ev, evIdx) => (
                          <View key={ev.id || evIdx} className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-2.5 gap-1">
                            <View className="flex-row items-center justify-between">
                              <Text className="text-[10px] font-black text-cyan-300 uppercase">
                                {ev.titulo}
                              </Text>
                              <Text className="text-[8px] text-zinc-500 font-mono">
                                {ev.dataHora}
                              </Text>
                            </View>
                            {ev.descricao && (
                              <Text className="text-[9px] text-zinc-300 font-medium">
                                {ev.descricao}
                              </Text>
                            )}
                            {ev.detalhes?.observacao && (
                              <Text className="text-[9px] text-amber-300/90 font-medium italic">
                                Obs: {ev.detalhes.observacao}
                              </Text>
                            )}
                          </View>
                        ))}
                      </View>
                    ) : (
                      <View className="bg-zinc-900/60 border border-dashed border-zinc-800 rounded-xl p-3 items-center justify-center">
                        <Text className="text-[10px] text-zinc-500 text-center font-medium">
                          Nenhum evento anterior registrado. O sistema registrará automaticamente a cada amortização, baixa no caixa ou cobrança D+1.
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* LISTA DE CONTRATOS E PARCELAS DETALHADAS */}
                  {modalDetalhesContrato.contratos.map((ct, idx) => {
                    const totalP = ct.parcelasTotal || ct.parcelas?.length || 0;
                    const abertasP = ct.parcelasAberto || ct.parcelas?.filter((p) => !p.isPaga && p.status !== 'Paga').length || 0;
                    const pagasP = ct.parcelasPagas || ct.parcelas?.filter((p) => p.isPaga || p.status === 'Paga').length || 0;

                    return (
                      <View key={idx} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3.5 gap-3">
                        <View className="flex-row items-center justify-between border-b border-zinc-800/80 pb-2.5">
                          <View className="flex-1 min-w-0 mr-2">
                            <Text className="text-xs font-black text-white uppercase truncate">
                              Contrato #{ct.contrato}
                            </Text>
                            <Text className="text-[10px] text-zinc-400 font-medium">
                              {ct.loja || 'Loja 27 • C. Purupuru'} • {pagasP} pagas • {abertasP} em atraso
                            </Text>
                          </View>
                          <View className="items-end flex-shrink-0">
                            <Text className="text-xs font-black text-rose-400">
                              {toBrl(ct.saldoAberto || ct.valorTotal)}
                            </Text>
                            <Text className="text-[9px] text-zinc-500 font-medium">Saldo devedor</Text>
                          </View>
                        </View>

                        {/* LISTAGEM DAS PARCELAS COM STATUS CLARO */}
                        <View className="gap-2">
                          <Text className="text-[9px] font-black uppercase text-zinc-400 tracking-wider">
                            Detalhamento das Parcelas:
                          </Text>

                          {ct.parcelas && ct.parcelas.map((p, pIdx) => {
                            const isPaga = p.isPaga || p.status === 'Paga';
                            const isVencida = !isPaga && (p.status === 'Vencida' || (p.diasAtraso && p.diasAtraso > 0));

                            return (
                              <View
                                key={pIdx}
                                className={`rounded-xl p-2.5 flex-row items-center justify-between border ${
                                  isPaga
                                    ? 'bg-emerald-950/15 border-emerald-500/25'
                                    : isVencida
                                    ? 'bg-rose-950/20 border-rose-500/35'
                                    : 'bg-zinc-800/60 border-zinc-700/50'
                                }`}
                              >
                                <View className="flex-row items-center gap-2 flex-1 min-w-0 mr-2">
                                  <View
                                    className={`px-2 py-0.5 rounded-md flex-shrink-0 ${
                                      isPaga
                                        ? 'bg-emerald-500/20'
                                        : isVencida
                                        ? 'bg-rose-500/20'
                                        : 'bg-zinc-700/60'
                                    }`}
                                  >
                                    <Text
                                      className={`text-[9px] font-black uppercase ${
                                        isPaga
                                          ? 'text-emerald-400'
                                          : isVencida
                                          ? 'text-rose-300'
                                          : 'text-zinc-300'
                                      }`}
                                    >
                                      {isPaga
                                        ? 'Liquidada'
                                        : isVencida
                                        ? `Vencida ${p.diasAtraso ? `(${p.diasAtraso}d)` : ''}`
                                        : 'A Vencer'}
                                    </Text>
                                  </View>

                                  <View className="flex-1 min-w-0">
                                    <Text
                                      className={`text-xs font-bold uppercase truncate ${
                                        isPaga ? 'text-zinc-300' : 'text-white'
                                      }`}
                                    >
                                      Parcela {p.numero}
                                    </Text>
                                    <Text
                                      className={`text-[10px] ${
                                        isPaga
                                          ? 'text-emerald-400/80'
                                          : isVencida
                                          ? 'text-rose-300/80'
                                          : 'text-zinc-400'
                                      }`}
                                    >
                                      Venc: {p.vencimento} {isPaga ? '• Baixada no Caixa' : '• Cobrança Ativa'}
                                    </Text>
                                  </View>
                                </View>

                                <View className="items-end flex-shrink-0">
                                  <Text
                                    className={`text-xs font-black ${
                                      isPaga
                                        ? 'text-emerald-400/80 line-through'
                                        : isVencida
                                        ? 'text-rose-400'
                                        : 'text-zinc-200'
                                    }`}
                                  >
                                    {toBrl(p.valor)}
                                  </Text>
                                  <Text className="text-[8px] font-bold uppercase text-zinc-500">
                                    {isPaga ? 'Paga' : isVencida ? 'Em Aberto' : 'Futura'}
                                  </Text>
                                </View>
                              </View>
                            );
                          })}
                        </View>
                      </View>
                    );
                  })}
                </ScrollView>
              )}

              {/* FOOTER POLIDO */}
              <Pressable
                onPress={() => setModalDetalhesContrato(null)}
                className="w-full h-12 bg-zinc-800 rounded-xl items-center justify-center active:bg-zinc-700"
              >
                <Text className="text-xs font-black uppercase text-white tracking-wide">
                  Fechar Histórico
                </Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        {/* MODAL REGISTRAR PAGAMENTO EM LOJA (TRAVA INTRADAY 48H D+1) */}
        <Modal
          visible={!!modalRegistrarPagamentoLoja}
          transparent
          animationType="fade"
          statusBarTranslucent
          onRequestClose={() => !salvandoPagamentoLoja && setModalRegistrarPagamentoLoja(null)}
        >
          <View
            style={{ paddingBottom: keyboardHeight }}
            className="flex-1 justify-center items-center bg-black/85 px-4"
          >
            <Pressable
              className="absolute inset-0"
              onPress={() => {
                if (!salvandoPagamentoLoja) {
                  Keyboard.dismiss();
                  setModalRegistrarPagamentoLoja(null);
                }
              }}
            />
            <View className="w-full max-w-md bg-[#121218] border border-amber-500/40 rounded-3xl p-5 gap-4">
              {/* HEADER */}
              <View className="flex-row items-center justify-between border-b border-zinc-800 pb-3">
                <View className="flex-row items-center gap-2.5 flex-1 min-w-0">
                  <View className="h-9 w-9 rounded-xl bg-amber-500/15 border border-amber-500/30 items-center justify-center flex-shrink-0">
                    <Clock size={18} color="#fbbf24" />
                  </View>
                  <View className="flex-1 min-w-0">
                    <Text className="text-sm font-black uppercase text-white tracking-wide">
                      Registrar Pagamento em Loja
                    </Text>
                    <Text className="text-[10px] text-amber-300 font-medium truncate">
                      Blindagem Intraday • D+1 (48h de Proteção)
                    </Text>
                  </View>
                </View>
                {!salvandoPagamentoLoja && (
                  <Pressable onPress={() => setModalRegistrarPagamentoLoja(null)} className="p-1">
                    <X size={16} color="#a1a1aa" />
                  </Pressable>
                )}
              </View>

              {/* INFORMAÇÕES DO CLIENTE */}
              {modalRegistrarPagamentoLoja && (
                <View className="gap-3">
                  <View className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
                    <Text className="text-xs font-black uppercase text-white truncate">
                      {modalRegistrarPagamentoLoja.nome_cliente}
                    </Text>
                    <Text className="text-[10px] text-zinc-400 font-mono mt-0.5">
                      CPF: {modalRegistrarPagamentoLoja.cpf_cnpj} • Débito: <Text className="text-rose-400 font-bold">{toBrl(modalRegistrarPagamentoLoja.v_inadim)}</Text>
                    </Text>
                  </View>

                  {/* EXPLICAÇÃO DA TRAVA D+1 */}
                  <View className="p-3 bg-amber-500/10 border border-amber-500/25 rounded-xl flex-row items-start gap-2.5">
                    <AlertTriangle size={15} color="#fbbf24" className="mt-0.5" />
                    <View className="flex-1 min-w-0">
                      <Text className="text-[10px] font-black uppercase text-amber-300">
                        Como funciona a trava D+1?
                      </Text>
                      <Text className="text-[9px] text-zinc-300 mt-0.5 leading-relaxed font-medium">
                        O BackOffice opera em cache diário (D+1). Pagamentos no balcão hoje só refletem na virada noturna. Ao salvar aqui, o cliente é blindado por 48h e não recebe cobranças via WhatsApp.
                      </Text>
                    </View>
                  </View>

                  {/* INPUT VALOR PAGO */}
                  <View className="gap-1.5">
                    <Text className="text-[10px] font-black uppercase text-zinc-400">
                      Valor Recebido no Caixa (R$):
                    </Text>
                    <TextInput
                      value={valorPagoInformado}
                      onChangeText={setValorPagoInformado}
                      keyboardType="numeric"
                      placeholder="0,00"
                      placeholderTextColor="#71717a"
                      className="w-full h-11 bg-zinc-900 border border-zinc-800 rounded-xl px-3 text-sm text-white font-mono font-bold"
                    />
                  </View>

                  {/* INPUT OBSERVAÇÃO */}
                  <View className="gap-1.5">
                    <Text className="text-[10px] font-black uppercase text-zinc-400">
                      Observação / Canal:
                    </Text>
                    <TextInput
                      value={obsPagamentoInformado}
                      onChangeText={setObsPagamentoInformado}
                      placeholder="Ex: Recebido em dinheiro no caixa 01 da Loja 27"
                      placeholderTextColor="#71717a"
                      className="w-full h-10 bg-zinc-900 border border-zinc-800 rounded-xl px-3 text-xs text-zinc-200"
                    />
                  </View>

                  {/* BOTÕES */}
                  <View className="flex-row gap-2 pt-2">
                    <Pressable
                      disabled={salvandoPagamentoLoja}
                      onPress={() => setModalRegistrarPagamentoLoja(null)}
                      className="flex-1 h-12 rounded-xl bg-zinc-800 items-center justify-center active:bg-zinc-700"
                    >
                      <Text className="text-xs font-black uppercase text-zinc-300">Cancelar</Text>
                    </Pressable>

                    <Pressable
                      disabled={salvandoPagamentoLoja}
                      onPress={handleConfirmarPagamentoLoja}
                      className="flex-[1.5] h-12 rounded-xl bg-amber-500 items-center justify-center active:bg-amber-600 flex-row gap-2"
                    >
                      {salvandoPagamentoLoja ? (
                        <ActivityIndicator size="small" color="#09090c" />
                      ) : (
                        <>
                          <CheckCircle2 size={15} color="#09090c" />
                          <Text className="text-xs font-black uppercase text-zinc-950">
                            Ativar Trava D+1
                          </Text>
                        </>
                      )}
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          </View>
        </Modal>

        {/* MODAL DETALHES DO AGENDAMENTO & REVERSÃO OFICIAL */}
        <Modal
          visible={!!modalDetalhesAgendamento}
          transparent
          animationType="slide"
          onRequestClose={() => setModalDetalhesAgendamento(null)}
        >
          <View className="flex-1 justify-end bg-black/85">
            <View className="w-full bg-[#121218] border-t border-zinc-800 rounded-t-[32px] p-5 gap-3.5 max-h-[90%]">
              <View className="w-12 h-1 rounded-full bg-zinc-800 mx-auto" />

              <View className="flex-row items-center justify-between border-b border-zinc-800 pb-3">
                <View className="flex-row items-center gap-2 flex-1 min-w-0 mr-2">
                  <Calendar size={18} color="#a855f7" />
                  <View className="flex-1 min-w-0">
                    <Text className="text-xs font-black uppercase tracking-wider text-white">
                      Lote Agendado • {modalDetalhesAgendamento?.schedule_date}
                    </Text>
                    <Text className="text-[10px] text-purple-300 font-medium truncate">
                      {modalDetalhesAgendamento?.total_count} clientes • {toBrl(modalDetalhesAgendamento?.total_value || 0)}
                    </Text>
                  </View>
                </View>
                <Pressable onPress={() => setModalDetalhesAgendamento(null)}>
                  <X size={16} color="#a1a1aa" />
                </Pressable>
              </View>

              {/* AVISO E BOTÃO REVERTER */}
              <View className="bg-purple-500/10 border border-purple-500/30 rounded-2xl p-3.5 gap-2">
                <View className="flex-row items-center justify-between gap-2">
                  <View className="flex-1 min-w-0">
                    <Text className="text-[10px] font-black uppercase text-purple-300">
                      Status: {modalDetalhesAgendamento?.status || 'AGENDADO'}
                    </Text>
                    <Text className="text-[10px] font-bold text-zinc-300 mt-0.5">
                      {modalDetalhesAgendamento?.status === 'FINALIZADO'
                        ? `${modalDetalhesAgendamento?.success_count || 0} entregues • ${modalDetalhesAgendamento?.error_count || 0} erros • Assertividade: ${(modalDetalhesAgendamento?.total_count || 0) > 0 ? Math.round(((modalDetalhesAgendamento?.success_count || 0) / modalDetalhesAgendamento!.total_count) * 100) : 0}%`
                        : `${modalDetalhesAgendamento?.pending_count ?? modalDetalhesAgendamento?.total_count} pendentes • ${modalDetalhesAgendamento?.success_count || 0} enviados`}
                    </Text>
                  </View>

                  {(modalDetalhesAgendamento?.status === 'AGENDADO' || modalDetalhesAgendamento?.is_processing) ? (
                    <Pressable
                      disabled={revertendoAgendamento}
                      onPress={() => {
                        if (modalDetalhesAgendamento) {
                          handleExcluirAgendamento(modalDetalhesAgendamento);
                        }
                      }}
                      className="px-3 py-2 rounded-xl bg-rose-500/20 border border-rose-500/40 flex-row items-center gap-1.5 active:bg-rose-500/30 flex-shrink-0"
                    >
                      <Trash2 size={12} color="#f87171" />
                      <Text className="text-[10px] font-black uppercase text-rose-300">
                        {revertendoAgendamento ? 'Excluindo...' : 'Excluir Agendamento'}
                      </Text>
                    </Pressable>
                  ) : (
                    <View className="px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex-row items-center gap-1.5 flex-shrink-0">
                      <CheckCircle2 size={12} color="#34d399" />
                      <Text className="text-[10px] font-black uppercase text-emerald-300">
                        ✓ Concluído
                      </Text>
                    </View>
                  )}
                </View>

                {modalDetalhesAgendamento?.status === 'FINALIZADO' && (
                  <View className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden flex-row mt-1">
                    <View
                      className="h-full bg-emerald-500"
                      style={{
                        width: `${Math.max(5, (modalDetalhesAgendamento?.total_count || 0) > 0 ? Math.round(((modalDetalhesAgendamento?.success_count || 0) / modalDetalhesAgendamento!.total_count) * 100) : 0)}%`,
                      }}
                    />
                    <View
                      className="h-full bg-rose-500"
                      style={{
                        width: `${Math.max(0, 100 - ((modalDetalhesAgendamento?.total_count || 0) > 0 ? Math.round(((modalDetalhesAgendamento?.success_count || 0) / modalDetalhesAgendamento!.total_count) * 100) : 0))}%`,
                      }}
                    />
                  </View>
                )}
              </View>

              {/* LISTA DE CLIENTES DO LOTE */}
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 20 }}>
                {modalDetalhesAgendamento?.clientes && modalDetalhesAgendamento.clientes.length > 0 ? (
                  modalDetalhesAgendamento.clientes.map((c, i) => (
                    <View key={i} className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-3 gap-1.5">
                      <View className="flex-row items-center justify-between">
                        <View className="flex-1 min-w-0 mr-2">
                          <View className="flex-row items-center gap-1.5 flex-wrap">
                            <Text className="text-xs font-black uppercase text-white truncate">
                              {c.nome_cliente}
                            </Text>
                            {c.itemStatus === 'SUCESSO' ? (
                              <View className="px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 flex-row items-center gap-1">
                                <CheckCircle2 size={9} color="#34d399" />
                                <Text className="text-[8px] font-black uppercase text-emerald-400">Entregue</Text>
                              </View>
                            ) : c.itemStatus === 'ERRO' ? (
                              <View className="px-1.5 py-0.5 rounded bg-rose-500/15 border border-rose-500/30 flex-row items-center gap-1">
                                <AlertTriangle size={9} color="#f87171" />
                                <Text className="text-[8px] font-black uppercase text-rose-400">Erro no Envio</Text>
                              </View>
                            ) : (
                              <View className="px-1.5 py-0.5 rounded bg-purple-500/15 border border-purple-500/30 flex-row items-center gap-1">
                                <Clock size={9} color="#c084fc" />
                                <Text className="text-[8px] font-black uppercase text-purple-300">Na Fila</Text>
                              </View>
                            )}
                          </View>
                          <Text className="text-[10px] text-zinc-400 font-mono mt-0.5">
                            CPF: {c.cpf_cnpj} • Tel: {c.phone || c.phone_api || 'Sem telefone'}
                          </Text>
                        </View>
                        <View className="items-end">
                          <Text className="text-xs font-black text-rose-400">
                            {c.v_inadim > 0 ? toBrl(c.v_inadim) : 'Liquidado / Negociado'}
                          </Text>
                          <Text className="text-[9px] text-zinc-500 mt-0.5">
                            {c.atraso_dias || 15} dias de atraso
                          </Text>
                        </View>
                      </View>
                      {c.itemStatus === 'ERRO' && c.erroMensagem && (
                        <View className="bg-rose-500/10 border border-rose-500/25 rounded-lg px-2 py-1 mt-0.5">
                          <Text className="text-[9px] text-rose-300 font-medium">
                            Falha: {c.erroMensagem}
                          </Text>
                        </View>
                      )}
                    </View>
                  ))
                ) : (
                  <View className="py-8 items-center justify-center gap-2">
                    <Calendar size={28} color="#a855f7" />
                    <Text className="text-xs font-bold text-zinc-300 text-center">
                      Lote registrado no BackOffice para {modalDetalhesAgendamento?.schedule_date}.
                    </Text>
                    <Text className="text-[10px] text-zinc-500 text-center">
                      {modalDetalhesAgendamento?.total_count} clientes contabilizados na meta daily.
                    </Text>
                  </View>
                )}
              </ScrollView>

              <Pressable
                onPress={() => setModalDetalhesAgendamento(null)}
                className="w-full h-11 bg-zinc-800 rounded-xl items-center justify-center active:bg-zinc-700"
              >
                <Text className="text-xs font-black uppercase text-white">Fechar</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        {/* MODAL DE LOGIN / SESSÃO BACKOFFICE */}
        <Modal
          visible={modalCookie}
          transparent
          animationType="fade"
          statusBarTranslucent
          onRequestClose={() => setModalCookie(false)}
        >
          <View
            style={{ paddingBottom: keyboardHeight }}
            className="flex-1 justify-center items-center bg-black/80 px-4"
          >
            <Pressable
              className="absolute inset-0"
              onPress={() => {
                Keyboard.dismiss();
                setModalCookie(false);
              }}
            />
            <View className="w-full max-w-md bg-[#121218] border border-cyan-500/30 rounded-3xl p-5 gap-4">
              <View className="flex-row items-center justify-between border-b border-zinc-800 pb-3">
                <View className="flex-row items-center gap-2">
                  <Key size={16} color="#38bdf8" />
                  <Text className="text-xs font-black uppercase tracking-wider text-white">
                    Autenticação BackOffice Clara
                  </Text>
                </View>
                <Pressable onPress={() => setModalCookie(false)}>
                  <X size={16} color="#a1a1aa" />
                </Pressable>
              </View>

              <Text className="text-xs text-zinc-300 leading-relaxed">
                Autentique-se diretamente com suas credenciais oficiais do BackOffice para renovar a sessão automaticamente:
              </Text>

              <View className="gap-2">
                <Text className="text-[10px] font-black uppercase text-zinc-400">Usuário:</Text>
                <TextInput
                  value={loginUsuario}
                  onChangeText={setLoginUsuario}
                  placeholder="USUÁRIO"
                  placeholderTextColor="#71717a"
                  className="w-full h-11 bg-zinc-900 border border-zinc-800 rounded-xl px-3 text-xs text-white font-bold"
                />
              </View>

              <View className="gap-2">
                <Text className="text-[10px] font-black uppercase text-zinc-400">Senha:</Text>
                <TextInput
                  value={loginSenha}
                  onChangeText={setLoginSenha}
                  secureTextEntry
                  placeholder="••••••"
                  placeholderTextColor="#71717a"
                  className="w-full h-11 bg-zinc-900 border border-zinc-800 rounded-xl px-3 text-xs text-white font-bold"
                />
              </View>

              {loginFeedback && (
                <View
                  className={`flex-row items-center gap-2.5 p-3 rounded-2xl border ${
                    loginFeedback.tipo === 'erro'
                      ? 'bg-rose-500/15 border-rose-500/30'
                      : loginFeedback.tipo === 'aviso'
                      ? 'bg-amber-500/15 border-amber-500/30'
                      : 'bg-emerald-500/15 border-emerald-500/30'
                  }`}
                >
                  {loginFeedback.tipo === 'erro' ? (
                    <AlertTriangle size={15} color="#f43f5e" />
                  ) : loginFeedback.tipo === 'aviso' ? (
                    <Clock size={15} color="#f59e0b" />
                  ) : (
                    <CheckCircle2 size={15} color="#10b981" />
                  )}
                  <Text
                    className={`text-xs font-semibold flex-1 ${
                      loginFeedback.tipo === 'erro'
                        ? 'text-rose-300'
                        : loginFeedback.tipo === 'aviso'
                        ? 'text-amber-300'
                        : 'text-emerald-300'
                    }`}
                  >
                    {loginFeedback.texto}
                  </Text>
                </View>
              )}

              <Pressable
                disabled={fazendoLogin}
                onPress={handleExecutarLogin}
                className="w-full h-12 bg-cyan-500 rounded-xl items-center justify-center active:bg-cyan-600 flex-row gap-2 mt-1"
              >
                {fazendoLogin ? (
                  <ActivityIndicator size="small" color="#09090c" />
                ) : (
                  <>
                    <Key size={16} color="#09090c" />
                    <Text className="text-xs font-black uppercase text-zinc-950">
                      Entrar e Atualizar Sessão
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </Modal>

        {/* MODAL GLOBAL DE ALERTAS E CONFIRMAÇÕES (SUBSTITUI ALERT.ALERT NATIVO) */}
        <Modal
          visible={customAlertModal.visible}
          transparent
          animationType="fade"
          onRequestClose={() => setCustomAlertModal((prev) => ({ ...prev, visible: false }))}
        >
          <View className="flex-1 justify-center items-center bg-black/85 px-5">
            <View className="w-full max-w-sm bg-[#121218] border border-zinc-800 rounded-3xl p-6 gap-4 items-center shadow-2xl">
              {/* ÍCONE CUSTOMIZADO CONFORME O TIPO */}
              <View
                className={`h-14 w-14 rounded-2xl items-center justify-center border ${
                  customAlertModal.type === 'success'
                    ? 'bg-emerald-500/15 border-emerald-500/30'
                    : customAlertModal.type === 'error'
                    ? 'bg-rose-500/15 border-rose-500/30'
                    : customAlertModal.type === 'destructive'
                    ? 'bg-rose-500/20 border-rose-500/40'
                    : customAlertModal.type === 'warning'
                    ? 'bg-amber-500/15 border-amber-500/30'
                    : 'bg-cyan-500/15 border-cyan-500/30'
                }`}
              >
                {customAlertModal.type === 'success' ? (
                  <CheckCircle2 size={30} color="#34d399" />
                ) : customAlertModal.type === 'error' ? (
                  <AlertCircle size={30} color="#f87171" />
                ) : customAlertModal.type === 'destructive' ? (
                  <ShieldAlert size={30} color="#f43f5e" />
                ) : customAlertModal.type === 'warning' ? (
                  <AlertTriangle size={30} color="#fbbf24" />
                ) : (
                  <Info size={30} color="#38bdf8" />
                )}
              </View>

              {/* TÍTULO E MENSAGEM */}
              <View className="items-center gap-1.5 w-full">
                <Text className="text-base font-black uppercase text-white tracking-wide text-center">
                  {customAlertModal.title}
                </Text>
                <Text className="text-xs text-zinc-300 font-medium text-center leading-relaxed">
                  {customAlertModal.message}
                </Text>
              </View>

              {/* BOTÕES DE AÇÃO */}
              {customAlertModal.cancelText ? (
                <View className="flex-row gap-2.5 w-full pt-2">
                  <Pressable
                    onPress={() => {
                      const onCancel = customAlertModal.onCancel;
                      setCustomAlertModal((prev) => ({ ...prev, visible: false }));
                      onCancel?.();
                    }}
                    className="flex-1 h-12 rounded-xl bg-zinc-800 items-center justify-center active:bg-zinc-700"
                  >
                    <Text className="text-xs font-black uppercase text-zinc-300">
                      {customAlertModal.cancelText}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      const onConfirm = customAlertModal.onConfirm;
                      setCustomAlertModal((prev) => ({ ...prev, visible: false }));
                      onConfirm?.();
                    }}
                    className={`flex-[1.4] h-12 rounded-xl items-center justify-center active:opacity-90 ${
                      customAlertModal.type === 'destructive'
                        ? 'bg-rose-600'
                        : customAlertModal.type === 'success'
                        ? 'bg-emerald-500'
                        : customAlertModal.type === 'warning'
                        ? 'bg-amber-500'
                        : 'bg-cyan-500'
                    }`}
                  >
                    <Text
                      className={`text-xs font-black uppercase ${
                        customAlertModal.type === 'destructive' ? 'text-white' : 'text-zinc-950'
                      }`}
                    >
                      {customAlertModal.confirmText || 'Confirmar'}
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <View className="w-full pt-2">
                  <Pressable
                    onPress={() => {
                      const onConfirm = customAlertModal.onConfirm;
                      setCustomAlertModal((prev) => ({ ...prev, visible: false }));
                      onConfirm?.();
                    }}
                    className={`w-full h-12 rounded-xl items-center justify-center active:opacity-90 ${
                      customAlertModal.type === 'destructive'
                        ? 'bg-rose-600'
                        : customAlertModal.type === 'success'
                        ? 'bg-emerald-500'
                        : customAlertModal.type === 'warning'
                        ? 'bg-amber-500'
                        : 'bg-cyan-500'
                    }`}
                  >
                    <Text
                      className={`text-xs font-black uppercase ${
                        customAlertModal.type === 'destructive' ? 'text-white' : 'text-zinc-950'
                      }`}
                    >
                      {customAlertModal.confirmText || 'Entendido'}
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
}
