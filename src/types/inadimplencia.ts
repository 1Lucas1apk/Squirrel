export type StatusClienteCobranca = 
  | 'fila' 
  | 'erro' 
  | 'enviados24h' 
  | 'agendados' 
  | 'pausado' 
  | 'compensacao_d1' 
  | 'quitado';

export interface PagamentoLojaD1 {
  ativo: boolean;
  registradoEm: number; // timestamp ms
  registradoEmFormatado: string; // DD/MM/AAAA HH:mm
  expiraEm: number; // 48h de trava de segurança contra cobrança indevida
  valorInformado: number;
  valorPago?: number;
  operadorNome: string;
  observacao?: string;
}

export interface DiagnosticoTelefone {
  valido: boolean;
  telefoneFormatado: string;
  ddd: string;
  numeroSemDdd: string;
  isAmazonas: boolean;
  isDddInexistente: boolean;
  isFaltaNonoDigito: boolean;
  tipoAlerta?: 'sucesso' | 'atencao' | 'erro';
  mensagemAlerta?: string;
  sugestaoCorrecao?: string;
}

export interface DiagnosticoErro {
  codigo: string;
  titulo: string;
  descricaoAmigavel: string;
  acaoSugerida: string;
  mensagemBruta?: string;
  statusProvedor?: number | string;
  dataErro?: string;
  permiteReenvio?: boolean;
  requerAtualizacaoCadastral?: boolean;
  telefoneAnalisado?: DiagnosticoTelefone;
}

export interface ExclusaoTemporaria {
  ativo: boolean;
  pausadoAte: number;
  pausadoAteFormatado: string;
  diasPausa: number;
  motivo: string;
  operadorNome: string;
  criadoEm: number;
}

export interface TelefoneCliente {
  raw: string;
  display?: string;
  tipo?: string;
  isWhatsapp?: boolean;
}

export type TipoEventoAuditoria =
  | 'DIVIDA_DETECTADA'
  | 'MENSAGEM_DISPARADA'
  | 'PAGAMENTO_INFORMADO_LOJA'
  | 'CONFIRMACAO_QUITACAO_D1'
  | 'AMORTIZACAO_D1'
  | 'TELEFONE_CORRIGIDO'
  | 'PAUSA_APLICADA'
  | 'EXCLUSAO_REMOVIDA';

export interface EventoAuditoriaInadimplencia {
  id: string;
  cpf: string;
  nomeCliente: string;
  tipo: TipoEventoAuditoria;
  timestamp: number;
  dataHoraFormatada: string;
  operador: string;
  detalhes?: {
    valorAnterior?: number;
    valorAtual?: number;
    valorPago?: number;
    diasAtraso?: number;
    templateId?: string;
    telefone?: string;
    observacao?: string;
    ttpHoras?: number;
  };
}

export type FaixaAging = '01-15' | '16-60' | '61-180' | '181-360' | 'PNP';

export interface SubcategoriaCliente {
  codigo: string;
  macro: 'BOM_PAGADOR' | 'RECEM_VENCIDO' | 'CLIENTE_NOVO_PNP' | 'ZONA_VERMELHA' | 'DIVIDA_ENVELHECIDA';
  nome: string;
  slotAlvo: 'SLOT1_BOM_PAGADOR' | 'SLOT2_RECEM_VENCIDO' | 'SLOT3_PNP' | 'SLOT4_ZONA_VERMELHA' | 'SLOT_GERAL';
  pesoMultiplicador: number;
  descricao: string;
}

export interface ClienteInadimplente {
  id_cliente: number;
  cpf_cnpj: string;
  nome_cliente: string;
  v_total: number;
  v_recebido: number;
  v_inadim: number;
  v_previsao: number;
  contratos: number;
  parcelas_aberto: number;
  parcelas_total: number;
  cobranca_enviada_24h: number;
  cobranca_ultimo_envio: string | null;
  cobranca_qtd_envios_24h: number;
  cobranca_qtd_envios_total: number;
  cobranca_ultimo_envio_geral: string | null;
  
  // Dados de telefonia
  phone?: string;
  phone_api?: string;
  has_valid_phone?: boolean;
  atraso_dias?: number;
  atraso_ref?: number;
  dataVencimentoReal?: string;
  safra?: string;
  mesAnoVencimento?: string;
  v_cliente_novo?: number;
  v_pnp?: number;
  
  // Status operacional e camada Intraday D+1
  status: StatusClienteCobranca;
  agendadoPara?: string;
  agendadoOrigem?: 'app' | 'backoffice';
  statusCarteira?: 'ATIVO' | 'AGUARDANDO_COMPENSACAO_D1' | 'QUITADO' | 'AMORTIZADO' | 'REINCIDENTE';
  pagamentoLojaD1?: PagamentoLojaD1;
  faixaAging?: FaixaAging;

  // Features Comportamentais para Machine Learning & Scoring
  ttpHoras?: number; // Time To Pay (horas entre o WhatsApp e o pagamento)
  diaHabitualPagamento?: number; // Dia do mês em que o cliente costuma pagar
  dataPrimeiroAtraso?: string;
  dataUltimaQuitacao?: string;
  valorAmortizadoAcumulado?: number;
  qtdDisparosAntesPagamento?: number;

  diagnostico?: DiagnosticoErro;
  diagnosticoTelefone?: DiagnosticoTelefone;
  exclusao?: ExclusaoTemporaria;
  telefones?: TelefoneCliente[];
  scorePrioridade?: number;
  scoreDetalhado?: any;
  subcategoria?: SubcategoriaCliente;
  saudeFinanceira?: SaudeFinanceiraCliente;
  historicoEventos?: EventoHistoricoCliente[];
  previsao?: PrevisaoInadimplencia;
  trilhaRecuperacao?: {
    categoria: 'CRITICA' | 'MEDIA' | 'BAIXA';
    acaoRecomendada: string;
    canal: string;
  };

  // Status de execução do item em lote histórico
  itemStatus?: 'SUCESSO' | 'ERRO' | 'PENDENTE';
  erroMensagem?: string;
}

export type PerfilRiscoCliente = 
  | 'CALOTE_ENTRADA'       // Cliente Novo de alto ticket que nunca pagou nada (v_recebido == 0)
  | 'SUPERENDIVIDADO'     // Cliente com muitos contratos que entrou em colapso financeiro
  | 'ATRASO_LEVE'         // Atraso de 5 a 45 dias com alta propensão a pagar no portal
  | 'DIVIDA_ENVELHECIDA'   // Atraso > 180 dias / PNP
  | 'REGULAR';

export interface PrevisaoInadimplencia {
  perfilRisco: PerfilRiscoCliente;
  probabilidadeRecuperacao: number; // 0 a 100%
  rotuloPerfil: string;
  descricaoRisco: string;
  acaoEstrategica: string;
  canalSugerido: 'PORTAL_CLIENTE' | 'GERENTE_NEGOCIACAO' | 'COBRANCA_PRESENCIAL' | 'SPC_SERASA';
}

export interface InadimplenciaMetricas {
  totalClientes: number;
  valorTotalInadim: number;
  totalFila: number;
  totalErro: number;
  totalEnviados24h: number;
  totalPausados: number;
  cotaDiaria: {
    enviados: number;
    consumido: number;
    limite: number;
    restantes: number;
    dataReferencia: string;
  };
  whatsappStatus: 'CONECTADO' | 'DESCONECTADO' | 'VERIFICANDO' | 'DESCONHECIDO';
  // Contadores analíticos oficiais do BackOffice UnBoxTech
  valorTotalOriginal?: number;
  valorTotalRecebido?: number;
  percInadimplencia?: number;
  previsaoPerda?: number;
  pnpTotal?: number;
  renegociacaoTotal?: number;
  curtoPrazoTotal?: number;
  clienteNovoTotal?: number;
  clientesVl15Count?: number;
  criticidade?: string;
  exposicaoRiscoTotal?: number;
  percExposicaoRisco?: number;
  statusCriticidade?: 'critico' | 'alerta' | 'estavel';
  enviosPersonalizado?: string;
  taxaConversao?: number;
  pagamentoDiaTotal?: number;
  pagamentoDiaQtd?: number;
  aiRadarScore?: number;
  aiRadarResumo?: string;
  aiRadarAcoes?: string[];
  countsFila?: number;
  countsAgendados?: number;
  countsErro?: number;
  countsListaEnvios?: number;
  syncStatusLabel?: string;
  syncLastUpdate?: string;
}

export interface GrupoAgendamento {
  schedule_date: string;
  status: string;
  is_processing: boolean;
  total_count: number;
  pending_count: number;
  success_count: number;
  error_count: number;
  consumed_count: number;
  daily_limit: number;
  daily_remaining: number;
  total_value: number;
  sent_value: number;
  origem?: 'app' | 'backoffice';
  first_time?: string;
  last_time?: string;
  clientes?: ClienteInadimplente[];
  clientesCpfs?: string[];
}

export interface ParcelaContrato {
  numero: number;
  vencimento: string;
  valor: number;
  diasAtraso: number;
  status: 'Paga' | 'Vencida' | 'A Vencer' | string;
  dataPagamento?: string;
  isPaga?: boolean;
}

export interface ContratoCliente {
  contrato: string;
  loja?: string;
  dataEmissao?: string;
  valorTotal: number;
  saldoAberto: number;
  parcelasTotal?: number;
  parcelasAberto?: number;
  parcelasPagas?: number;
  parcelas: ParcelaContrato[];
}

export interface HistoricoDetalheCliente {
  cpf: string;
  codigo_cliente: number;
  nome_cliente?: string;
  telefones: TelefoneCliente[];
  contratos: ContratoCliente[];
  totais: {
    v_inadim: number;
    dias_atraso: number;
    parcelas_aberto: number;
    parcelas_total?: number;
    parcelas_pagas?: number;
    v_total?: number;
    v_recebido?: number;
  };
}

export interface ConfigAutocobranca {
  ativa: boolean;
  modo: 'co_piloto' | 'autonomo';
  horarioLimiteDiasUteis: string; // HH:mm ex: '09:30'
  horarioLimiteSabado: string; // HH:mm ex: '09:00'
  cotaDiaria: number; // padrão 30
  urgenciaSabadoAvulso: boolean; // se true, identifica clientes críticos para avulso no sábado
  atualizadoPor?: string;
  atualizadoEm?: number;
}

export interface StatusAutocobrancaAnalise {
  emAtraso: boolean;
  motivoAtraso?: string;
  isSabado: boolean;
  isDomingo: boolean;
  foraExpediente: boolean;
  horarioLimiteAtual: string;
  clientesSugeridos: ClienteInadimplente[];
  tipoAcaoSugerida: 'lote_top30' | 'avulso_sabado_urgente' | 'recuperacao_erros_avulso' | 'nenhuma';
  valorTotalSugerido: number;
  lockAdquirido?: boolean;
  jaExecutadoHoje?: boolean;
  saldoErrosReaproveitavel?: number;
}

export type NivelSaudeFinanceira = 'EXCELENTE' | 'BOA' | 'REGULAR' | 'RISCO_ALTO' | 'CRITICA_INSOLVENTE';

export interface SaudeFinanceiraCliente {
  scoreSaude: number; // 0 a 100
  nivel: NivelSaudeFinanceira;
  rotuloNivel: string; // ex: 'Excelente Pagador'
  corHex: string; // ex: '#10b981'
  corBadgeBg: string; // ex: 'bg-emerald-500/15'
  corBadgeText: string; // ex: 'text-emerald-400'
  corBadgeBorder: string; // ex: 'border-emerald-500/30'
  taxaQuitacaoHistorica: number; // 0 a 100 (% do valor total já pago)
  pctParcelasPagas: number; // 0 a 100 (% de parcelas pagas)
  resumoQuitacao: string; // ex: 'Já pagou 80% do carnê (R$ 1.200 de R$ 1.500)'
  grauRiscoReal: 'MÍNIMO' | 'BAIXO' | 'MODERADO' | 'ALTO' | 'MÁXIMO_CALOTE';
  diagnosticoExecutivo: string; // Explicação direta para tomada de decisão
}

export interface EventoHistoricoCliente {
  id: string;
  dataIso: string;
  dataHora: string;
  tipo:
    | 'REGISTRO_INICIAL'
    | 'MUDANCA_DEBITO'
    | 'MUDANCA_ATRASO'
    | 'PAGAMENTO_CAIXA'
    | 'ENVIO_WHATSAPP'
    | 'MUDANCA_STATUS'
    | 'MUDANCA_SUBCATEGORIA'
    | 'ATUALIZACAO_TELEFONE'
    | 'TRAVA_D1_ATIVADA';
  titulo: string;
  descricao?: string;
  detalhes?: {
    valorAnterior?: number;
    valorNovo?: number;
    valorAtual?: number;
    diasAtrasoAnterior?: number;
    diasAtrasoNovo?: number;
    statusAnterior?: string;
    statusNovo?: string;
    subcategoriaAnterior?: string;
    subcategoriaNova?: string;
    operador?: string;
    observacao?: string;
    phone?: string;
  };
}
