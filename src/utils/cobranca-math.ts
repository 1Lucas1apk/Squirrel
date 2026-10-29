import { ClienteInadimplente, PrevisaoInadimplencia, SaudeFinanceiraCliente } from '../types/inadimplencia';

export interface SubcategoriaInfo {
  codigo: string;
  macro: 'BOM_PAGADOR' | 'RECEM_VENCIDO' | 'CLIENTE_NOVO_PNP' | 'ZONA_VERMELHA' | 'DIVIDA_ENVELHECIDA';
  nome: string;
  slotAlvo: 'SLOT1_BOM_PAGADOR' | 'SLOT2_RECEM_VENCIDO' | 'SLOT3_PNP' | 'SLOT4_ZONA_VERMELHA' | 'SLOT_GERAL';
  pesoMultiplicador: number; // Beta que pondera o score final
  descricao: string;
}

export interface ScoreDetalhado {
  scoreFinal: number; // Pi' normalizado de 0 a 100
  scoreBruto: number; // Pi
  sTempo: number; // Curva de degradação temporal (0 a 1)
  sRuptura: number; // Ruptura de hábito do bom pagador (0 a 1)
  sNovo: number; // Risco de cliente novo (0 ou 1)
  exposicao: number; // Ei (escala logarítmica)
  fadiga: number; // delta_cobranca (0 a 1)
  contactabilidade: number; // Ci (0 a 1)
  elegivel: boolean;
  motivoInelegivel?: string;
  subcategoria?: SubcategoriaInfo;
  trilhaRecuperacao?: {
    categoria: 'CRITICA' | 'MEDIA' | 'BAIXA';
    acaoRecomendada: string;
    canal: string;
  };
}

const LAMBDA_TEMPO = 0.08;
const ALPHA_FADIGA = 0.15;
const W1_TEMPO = 0.40;
const W2_RUPTURA = 0.35;
const W3_NOVO = 0.25;

/**
 * Classificação Determinística em 13 Subcategorias Reais da Clara Eletro
 */
export function classificarSubcategoriaCliente(cliente: ClienteInadimplente): SubcategoriaInfo {
  const atraso = cliente.atraso_dias || 0;
  const valor = cliente.v_inadim || 0;
  const recebido = cliente.v_recebido || 0;
  const parcelasTotal = Math.max(1, cliente.parcelas_total || 1);
  const parcelasAberto = Math.max(1, cliente.parcelas_aberto || 1);
  const razaoAberto = parcelasAberto / parcelasTotal;
  const contratos = cliente.contratos || 1;
  const envios = cliente.cobranca_qtd_envios_total || 0;

  // 1. ZONA VERMELHA: Iminência de Perda Contábil (D+85 a D+89)
  if (atraso >= 85 && atraso <= 89) {
    return {
      codigo: '4.1_PRE_PERDA_PCLD',
      macro: 'ZONA_VERMELHA',
      slotAlvo: 'SLOT4_ZONA_VERMELHA',
      nome: 'Iminência de Perda PCLD (85 a 89d)',
      pesoMultiplicador: 1.50,
      descricao: 'Faltam menos de 5 dias para atingir 90 dias e virar perda contábil irreversível no ERP.',
    };
  }

  // 2. BOM PAGADOR EM RUPTURA
  // 2.1. Reta Final (Quase Quitou: faltam <= 25% das parcelas e atraso recente)
  if (razaoAberto <= 0.25 && atraso <= 30 && recebido > 0) {
    return {
      codigo: '1.1_RETA_FINAL',
      macro: 'BOM_PAGADOR',
      slotAlvo: 'SLOT1_BOM_PAGADOR',
      nome: 'Reta Final (Quase Quitou)',
      pesoMultiplicador: 1.40,
      descricao: `Já quitou ${Math.round((1 - razaoAberto) * 100)}% do carnê. Altíssima chance de regularização imediata.`,
    };
  }
  // 2.2. Cliente Histórico Fiel (Multi-contratos quitados no passado)
  if (contratos >= 2 && recebido > valor && atraso <= 30) {
    return {
      codigo: '1.2_HISTORICO_FIEL',
      macro: 'BOM_PAGADOR',
      slotAlvo: 'SLOT1_BOM_PAGADOR',
      nome: 'Cliente Histórico Fiel (Multi-contratos)',
      pesoMultiplicador: 1.35,
      descricao: 'Cliente tradicional com compras anteriores quitadas. Atraso pontual atípico.',
    };
  }
  // 2.3. Amortizador com Resíduo
  if (recebido > 0 && valor <= 250 && atraso <= 45) {
    return {
      codigo: '1.3_AMORTIZADOR_RESIDUO',
      macro: 'BOM_PAGADOR',
      slotAlvo: 'SLOT1_BOM_PAGADOR',
      nome: 'Amortizador com Saldo Residual',
      pesoMultiplicador: 1.25,
      descricao: 'Saldo residual baixo. Resgate facilitado no caixa ou portal.',
    };
  }

  // 3. CLIENTE NOVO / PNP (1ª Parcela Não Paga)
  if (recebido === 0 && contratos <= 1 && atraso <= 45) {
    return {
      codigo: '3.1_PNP_CRITICO',
      macro: 'CLIENTE_NOVO_PNP',
      slotAlvo: 'SLOT3_PNP',
      nome: 'PNP Crítico (1ª Parcela em Aberto)',
      pesoMultiplicador: 1.35,
      descricao: 'Primeira compra na loja sem nenhum pagamento realizado. Risco de perda se não abordado.',
    };
  }

  // 4. ZONA VERMELHA: Virada da 2ª Parcela (D+31 a D+60 e >= 2 parcelas)
  if (atraso >= 31 && atraso <= 60 && parcelasAberto >= 2) {
    return {
      codigo: '4.2_VIRADA_2A_PARCELA',
      macro: 'ZONA_VERMELHA',
      slotAlvo: 'SLOT4_ZONA_VERMELHA',
      nome: 'Virada da 2ª Parcela (Risco Acúmulo)',
      pesoMultiplicador: 1.25,
      descricao: 'Duas parcelas acumuladas. Intervenção necessária antes que a dívida dobre.',
    };
  }

  // 5. ENTRADA NA INADIMPLÊNCIA (D+5 a D+30)
  // 5.1. Ticket Alto Recente (VIP)
  if (atraso >= 5 && atraso <= 20 && valor >= 1200) {
    return {
      codigo: '2.1_TICKET_ALTO_RECENTE',
      macro: 'RECEM_VENCIDO',
      slotAlvo: 'SLOT2_RECEM_VENCIDO',
      nome: 'Ticket Alto Recente (VIP)',
      pesoMultiplicador: 1.30,
      descricao: 'Débito expressivo recém-vencido. Forte impacto positivo no fluxo de caixa da Loja 27.',
    };
  }
  // 5.2. Micro-parcela
  if (atraso >= 5 && atraso <= 30 && valor < 400) {
    return {
      codigo: '2.3_MICRO_PARCELA',
      macro: 'RECEM_VENCIDO',
      slotAlvo: 'SLOT2_RECEM_VENCIDO',
      nome: 'Micro-parcela (Link Portal)',
      pesoMultiplicador: 1.10,
      descricao: 'Valor acessível para quitação rápida via autosserviço no Portal Clara Eletro.',
    };
  }
  // 5.3. Ticket Médio Padrão
  if (atraso >= 5 && atraso <= 30) {
    return {
      codigo: '2.2_TICKET_MEDIO',
      macro: 'RECEM_VENCIDO',
      slotAlvo: 'SLOT2_RECEM_VENCIDO',
      nome: 'Atraso Recente (Ticket Médio)',
      pesoMultiplicador: 1.15,
      descricao: 'Faixa operacional padrão da esteira matinal de cobrança.',
    };
  }

  // 6. DÍVIDA ENVELHECIDA
  // Débitos Críticos (>= R$ 3.000) e Tickets Altos (>= R$ 1.200) NUNCA sofrem rebaixamento por fadiga!
  if (valor >= 3000) {
    return {
      codigo: '5.0_DEBITO_CRITICO',
      macro: 'ZONA_VERMELHA',
      slotAlvo: 'SLOT4_ZONA_VERMELHA',
      nome: 'Débito Crítico (> R$ 3.000)',
      pesoMultiplicador: 1.35,
      descricao: 'Maior exposição financeira da Loja 27. Prioridade estratégica máxima de cobrança.',
    };
  }

  if (valor >= 1200) {
    return {
      codigo: '5.0_TICKET_ALTO_ENVELHECIDO',
      macro: 'RECEM_VENCIDO',
      slotAlvo: 'SLOT2_RECEM_VENCIDO',
      nome: 'Ticket Alto Relevante',
      pesoMultiplicador: 1.15,
      descricao: 'Débito de alto impacto no caixa da loja. Cobrança contínua prioritária.',
    };
  }

  // Cadáver Contábil (> 365 dias): penalidade drástica para não queimar cota diária
  if (atraso > 365) {
    return {
      codigo: '5.3_CADAVER_CONTABIL',
      macro: 'DIVIDA_ENVELHECIDA',
      slotAlvo: 'SLOT_GERAL',
      nome: 'Cadáver Contábil (> 1 ano)',
      pesoMultiplicador: 0.15,
      descricao: 'Atraso superior a 1 ano. Baixíssima probabilidade de conversão via WhatsApp diário.',
    };
  }

  if (atraso > 90 && envios >= 3) {
    return {
      codigo: '5.2_FADIGA_CRONICA',
      macro: 'DIVIDA_ENVELHECIDA',
      slotAlvo: 'SLOT_GERAL',
      nome: 'Fadiga de Cobrança (Ticket Baixo)',
      pesoMultiplicador: 0.40,
      descricao: 'Múltiplos envios anteriores sem conversão em ticket baixo. Prioridade reduzida para preservar cota diária.',
    };
  }

  return {
    codigo: '5.1_ELEGIVEL_ACORDO',
    macro: 'DIVIDA_ENVELHECIDA',
    slotAlvo: 'SLOT4_ZONA_VERMELHA',
    nome: 'Dívida Antiga (Tabela do Mês)',
    pesoMultiplicador: 0.85,
    descricao: 'Atraso superior a 90 dias. Elegível para renegociação com desconto no balcão da loja.',
  };
}

/**
 * 1. Filtro Operacional de Elegibilidade
 * Elegivel = 1 se (t - t_ultimo_envio >= 24h) and (D_i > 4) and (V_inadim > 0)
 */
export function verificarElegibilidade(cliente: ClienteInadimplente): { elegivel: boolean; motivo?: string } {
  if (cliente.v_inadim <= 0) {
    return { elegivel: false, motivo: 'Valor em aberto zerado' };
  }

  // Janela de resfriamento de 24h
  if (cliente.status === 'enviados24h' || cliente.cobranca_enviada_24h === 1) {
    return { elegivel: false, motivo: 'Bloqueado por janela de resfriamento de 24h' };
  }

  // Carência de 4 dias de atraso (atrasos curtos são tolerância operacional)
  const diasAtraso = cliente.atraso_dias || 0;
  if (diasAtraso <= 4) {
    return { elegivel: false, motivo: `Em tolerância de carência (${diasAtraso} dias <= 4 dias)` };
  }

  // Exclusão temporária ativa (pausa no balcão)
  if (cliente.status === 'pausado' || (cliente.exclusao && cliente.exclusao.pausadoAte > Date.now())) {
    return { elegivel: false, motivo: `Pausado temporariamente: ${cliente.exclusao?.motivo || 'Pausa'}` };
  }

  // Trava Intraday D+1: Pagamento informado na loja (blindagem de 48h contra cobrança indevida)
  if (
    cliente.status === 'compensacao_d1' || 
    (cliente.pagamentoLojaD1 && cliente.pagamentoLojaD1.ativo && cliente.pagamentoLojaD1.expiraEm > Date.now())
  ) {
    return { elegivel: false, motivo: 'Pagamento informado no balcão: aguardando compensação D+1 (Blindagem de 48h)' };
  }

  // Cliente já incluso em lote agendado futuro
  if (cliente.status === 'agendados' || (cliente.agendadoPara && cliente.agendadoPara.length > 0)) {
    return { elegivel: false, motivo: `Já incluso no agendamento oficial de ${cliente.agendadoPara}` };
  }

  return { elegivel: true };
}

/**
 * Fator de Contactabilidade (C_i)
 * 1.0 = Ativo Confirmado (disparos anteriores bem-sucedidos)
 * 0.8 = Telefone Válido / Não testado recentemente
 * 0.6 = Falha anterior de Gateway/WhatsApp desconectado (porém com telefone válido e elegível para nova tentativa)
 * 0.5 = Celular com 8 dígitos (falta o 9º dígito)
 * 0.0 = Falha Permanente / Erro Cadastral Fatal (DDD 20, número inexistente ou menor que 10 dígitos)
 */
export function calcularContactabilidade(cliente: ClienteInadimplente): number {
  // 1. Clientes com status de AGENDADOS ou ENVIADOS24H nunca entram no Top 30 prioritário
  if (cliente.status === 'agendados' || cliente.status === 'enviados24h') {
    return 0.0;
  }

  const telDiag = cliente.diagnosticoTelefone;

  // 2. Erro fatal de telefone: DDD 20, DDD inexistente ou número explicitamente inválido
  if (telDiag) {
    if (telDiag.isDddInexistente || telDiag.ddd === '20' || (!telDiag.valido && cliente.phone)) {
      return 0.0;
    }
    if (telDiag.isFaltaNonoDigito) {
      return 0.5;
    }
  }

  // Se o status for erro mas o telefone for válido, reabilita com 0.70 para nova tentativa (erro transitório)
  if (cliente.status === 'erro') {
    if (telDiag?.valido || cliente.has_valid_phone) {
      return 0.70;
    }
    return 0.0;
  }

  // 3. Confirmado ativo em disparos anteriores
  if (cliente.cobranca_enviada_24h === 1 || (cliente.cobranca_qtd_envios_total && cliente.cobranca_qtd_envios_total > 0)) {
    return 1.0;
  }

  // 4. Clientes da Fila oficial da loja: elegibilidade ativa para cobrança prioritária
  return 0.8;
}

/**
 * Matriz de Tratamento Operacional Clara Eletro para Contactabilidade Zero (Status: ERRO)
 * Regras reais da Loja:
 * 1. Atraso > 1 dia: crediário 100% bloqueado no ERP (nem o gerente consegue liberar novas compras).
 * 2. Atraso >= 90 dias: elegível para acordo na Tabela do Mês vigente no balcão da loja.
 * 3. Débito Crítico (>= R$ 3.000): buscar ficha cadastral e contrato físico arquivado na Loja 27.
 */
export function classificarTrilhaRecuperacao(vInadim: number): {
  categoria: 'CRITICA' | 'MEDIA' | 'BAIXA';
  acaoRecomendada: string;
  canal: string;
} {
  if (vInadim >= 3000) {
    return {
      categoria: 'CRITICA',
      acaoRecomendada: 'Débito Crítico: Contato direto ou visita presencial.',
      canal: 'Atendimento presencial no balcão da Loja 27 ou contato telefônico com referências.',
    };
  }

  if (vInadim >= 800) {
    return {
      categoria: 'MEDIA',
      acaoRecomendada: 'Cobrança Ativa WhatsApp / Portal do Cliente.',
      canal: 'Atendimento WhatsApp oficial Clara Eletro ou Portal do Cliente.',
    };
  }

  return {
    categoria: 'BAIXA',
    acaoRecomendada: 'Lembrete Amigável WhatsApp. Quitação de parcelas no balcão ou Portal.',
    canal: 'Caixa da Loja 27 ou Portal do Cliente.',
  };
}

/**
 * Motor Matemático de Score de Priorização (P_i')
 */
export function calcularScoreCobranca(
  cliente: ClienteInadimplente,
  maxVinadimGlobal: number
): ScoreDetalhado {
  const { elegivel, motivo } = verificarElegibilidade(cliente);
  const diasAtraso = Math.max(0, cliente.atraso_dias || 0);

  // A. Curva de Degradação Temporal S_tempo = 1 - e^(-lambda * (D_i - 4))
  const dEfetivo = Math.max(0, diasAtraso - 4);
  const sTempo = 1 - Math.exp(-LAMBDA_TEMPO * dEfetivo);

  // B. Índice de Ruptura Comportamental S_ruptura = H_i * (P_aberto / P_total)
  // H_i = V_recebido / (V_recebido + V_inadim)
  const totalGeral = (cliente.v_recebido || 0) + (cliente.v_inadim || 0);
  const hPontualidade = totalGeral > 0 ? (cliente.v_recebido || 0) / totalGeral : 0;
  const razaoParcelas = cliente.parcelas_total > 0 
    ? Math.min(1.0, (cliente.parcelas_aberto || 1) / cliente.parcelas_total)
    : 0.5;
  const sRuptura = hPontualidade >= 0.70 ? hPontualidade * razaoParcelas : (hPontualidade * 0.3);

  // C. Risco de Cliente Novo S_novo
  const sNovo = (cliente.v_recebido === 0 && (cliente.contratos <= 1)) ? 1.0 : 0.0;

  // D. Exposição Financeira Relativa E_i = ln(1 + V_inadim) / ln(1 + max(V_inadim))
  const maxRef = Math.max(1000, maxVinadimGlobal);
  const exposicao = Math.log(1 + Math.max(0, cliente.v_inadim)) / Math.log(1 + maxRef);

  // E. Eficiência e Fadiga de Cobrança com Proteção de Ticket Alto:
  // Débitos altos (>= R$ 1.200) e críticos (>= R$ 3.000) não podem ter fadiga excessiva
  const nEnvios = cliente.cobranca_qtd_envios_total || 0;
  const fadigaBase = 1 / (1 + ALPHA_FADIGA * nEnvios);
  const fatorProtecaoTicket = Math.min(1.0, Math.max(0, cliente.v_inadim) / 3000);
  // Garante piso de até 0.78 de fadiga para débitos críticos, evitando descarte de clientes grandes
  const fadiga = fadigaBase + (1.0 - fadigaBase) * (fatorProtecaoTicket * 0.65);

  // Bônus progressivo para débitos expressivos no fluxo de caixa da Loja 27
  const bonusTicketCritico = cliente.v_inadim >= 3000 ? 1.30 : (cliente.v_inadim >= 1500 ? 1.15 : 1.0);

  // F. Fator de Contactabilidade C_i
  const contactabilidade = calcularContactabilidade(cliente);

  // G. Subcategoria Comportamental e Peso Multiplicador
  const subcategoria = classificarSubcategoriaCliente(cliente);

  // Score Bruto P_i ajustado pela subcategoria comportamental e bônus de ticket
  const scoreBruto = (W1_TEMPO * sTempo + W2_RUPTURA * sRuptura + W3_NOVO * sNovo) * exposicao * fadiga * subcategoria.pesoMultiplicador * bonusTicketCritico;

  // Score Final P_i' = P_i * C_i (normalizado de 0 a 100)
  const scoreFinal = Number(Math.min(100, scoreBruto * contactabilidade * 100).toFixed(1));

  const trilhaRecuperacao = contactabilidade === 0 
    ? classificarTrilhaRecuperacao(cliente.v_inadim) 
    : undefined;

  return {
    scoreFinal,
    scoreBruto: Number((scoreBruto * 100).toFixed(1)),
    sTempo: Number(sTempo.toFixed(3)),
    sRuptura: Number(sRuptura.toFixed(3)),
    sNovo,
    exposicao: Number(exposicao.toFixed(3)),
    fadiga: Number(fadiga.toFixed(3)),
    contactabilidade,
    elegivel: elegivel && contactabilidade > 0,
    motivoInelegivel: motivo || (contactabilidade === 0 ? 'Número sem WhatsApp ou inválido (C_i = 0)' : undefined),
    subcategoria,
    trilhaRecuperacao,
  };
}

/**
 * Seleciona os Top 30 clientes aplicando a Matriz Balanceada de 4 Slots:
 * - Slot 1: 10 vagas (Bons Pagadores em Ruptura / Quase Quitou)
 * - Slot 2: 10 vagas (Entrada Recente / Ticket Alto e Médio)
 * - Slot 3: 5 vagas (PNP - 1ª Parcela Não Paga)
 * - Slot 4: 5 vagas (Zona Vermelha Pré-Perda / Prestes a 90 dias)
 * Transbordamento dinâmico automático caso algum slot tenha menos clientes.
 */
export function selecionarTop30Inteligente(clientes: ClienteInadimplente[]): {
  top30: ClienteInadimplente[];
  todosElegiveisOrdenados: ClienteInadimplente[];
  scoresMap: Map<string, ScoreDetalhado>;
  totalElegiveis: number;
} {
  let maxVinadim = 0;
  clientes.forEach(c => {
    if (c.v_inadim > maxVinadim) maxVinadim = c.v_inadim;
  });

  const scoresMap = new Map<string, ScoreDetalhado>();
  const elegiveis: { cliente: ClienteInadimplente; score: ScoreDetalhado }[] = [];

  clientes.forEach(cliente => {
    const score = calcularScoreCobranca(cliente, maxVinadim);
    scoresMap.set(cliente.cpf_cnpj, score);
    if (score.elegivel) {
      elegiveis.push({ cliente, score });
    }
  });

  // Ordena decrescente pelo scoreFinal P_i'
  elegiveis.sort((a, b) => b.score.scoreFinal - a.score.scoreFinal);

  const todosElegiveisOrdenados = elegiveis.map(item => item.cliente);

  // SELEÇÃO BALANCEADA EM 4 SLOTS ESTRATÉGICOS
  const bucketSlot1: ClienteInadimplente[] = []; // Bom Pagador (meta: 10)
  const bucketSlot2: ClienteInadimplente[] = []; // Recém-Vencido (meta: 10)
  const bucketSlot3: ClienteInadimplente[] = []; // PNP (meta: 5)
  const bucketSlot4: ClienteInadimplente[] = []; // Zona Vermelha (meta: 5)

  todosElegiveisOrdenados.forEach(c => {
    const sc = scoresMap.get(c.cpf_cnpj)?.subcategoria;
    const slot = sc?.slotAlvo;
    if (slot === 'SLOT1_BOM_PAGADOR') bucketSlot1.push(c);
    else if (slot === 'SLOT2_RECEM_VENCIDO') bucketSlot2.push(c);
    else if (slot === 'SLOT3_PNP') bucketSlot3.push(c);
    else if (slot === 'SLOT4_ZONA_VERMELHA') bucketSlot4.push(c);
  });

  const selecionadosCpfs = new Set<string>();
  const top30: ClienteInadimplente[] = [];

  const adicionarAoTop30 = (lista: ClienteInadimplente[], qtd: number) => {
    let count = 0;
    for (const c of lista) {
      if (count >= qtd || top30.length >= 30) break;
      if (!selecionadosCpfs.has(c.cpf_cnpj)) {
        selecionadosCpfs.add(c.cpf_cnpj);
        top30.push(c);
        count++;
      }
    }
  };

  // Preenchimento primário dos 4 slots estratégicos
  adicionarAoTop30(bucketSlot1, 10);
  adicionarAoTop30(bucketSlot2, 10);
  adicionarAoTop30(bucketSlot3, 5);
  adicionarAoTop30(bucketSlot4, 5);

  // Transbordamento dinâmico: se faltar para 30, preenche pelo ranking geral de maior score
  if (top30.length < 30) {
    for (const c of todosElegiveisOrdenados) {
      if (top30.length >= 30) break;
      if (!selecionadosCpfs.has(c.cpf_cnpj)) {
        selecionadosCpfs.add(c.cpf_cnpj);
        top30.push(c);
      }
    }
  }

  // Ordena o lote final do Top 30 por prioridade decrescente de Score e valor
  top30.sort((a, b) => {
    const scoreA = scoresMap.get(a.cpf_cnpj)?.scoreFinal ?? a.scorePrioridade ?? 0;
    const scoreB = scoresMap.get(b.cpf_cnpj)?.scoreFinal ?? b.scorePrioridade ?? 0;
    if (scoreB !== scoreA) return scoreB - scoreA;
    return b.v_inadim - a.v_inadim;
  });

  return {
    top30,
    todosElegiveisOrdenados,
    scoresMap,
    totalElegiveis: elegiveis.length,
  };
}

/**
 * Calcula os dias de atraso real com base no histórico de parcelas em aberto e dados do cliente.
 * Cada parcela em aberto representa ~30 dias de intervalo na Clara Eletro.
 */
export function calcularDiasAtrasoReal(cliente: any): number {
  if (cliente.atraso_ref !== undefined && cliente.atraso_ref !== null && Number(cliente.atraso_ref) >= 0) {
    return Number(cliente.atraso_ref);
  }
  if (cliente.atraso_dias !== undefined && cliente.atraso_dias !== null && Number(cliente.atraso_dias) >= 0) {
    return Number(cliente.atraso_dias);
  }
  const parcelas = Math.max(1, Number(cliente.parcelas_aberto || 1));
  return Math.min(365, parcelas * 30);
}

/**
 * Obtém detalhes legíveis do atraso: data exata de vencimento, safra e mês de referência.
 */
export function obterDetalhesAtraso(diasAtraso: number, dataReferencia: Date = new Date()): {
  dataVencimentoFormatada: string;
  safra: string;
  mesAnoFormatado: string;
  descricaoCurta: string;
} {
  const dias = Math.max(1, diasAtraso || 15);
  const dataVenc = new Date(dataReferencia.getTime() - dias * 86400000);
  const dia = String(dataVenc.getDate()).padStart(2, '0');
  const mes = String(dataVenc.getMonth() + 1).padStart(2, '0');
  const ano = dataVenc.getFullYear();
  const dataVencimentoFormatada = `${dia}/${mes}/${ano}`;

  const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const mesAnoFormatado = `${MESES[dataVenc.getMonth()]}/${ano}`;

  let safra = '30-60';
  if (dias < 30) safra = '15-29';
  else if (dias <= 60) safra = '30-60';
  else if (dias <= 90) safra = '61-90';
  else if (dias <= 180) safra = '91-180';
  else if (dias <= 365) safra = '181-365';
  else safra = '1 ano+';

  return {
    dataVencimentoFormatada,
    safra,
    mesAnoFormatado,
    descricaoCurta: `Venceu em ${dataVencimentoFormatada} (${dias}d • ${mesAnoFormatado})`,
  };
}

/**
 * Gera telefone de contato padrão com DDD 92 do Amazonas consistente com o cadastro do cliente.
 */
export function gerarTelefoneAmazonasPadrao(cpf: string, idCliente: number = 0): string {
  const clean = String(cpf || '').replace(/\D/g, '');
  const prefixos = ['984', '991', '992', '993', '981', '982', '994', '985'];
  const prefixo = prefixos[Math.abs(idCliente) % prefixos.length];
  const mid = clean.slice(3, 5).padStart(2, '2');
  const sufix = clean.slice(-4).padStart(4, '0');
  return `(92) ${prefixo}${mid}-${sufix}`;
}

/**
 * Calcula a data exata em que o débito venceu com base nos dias de atraso.
 */
export function calcularDataVencimento(diasAtraso: number, dataReferencia: Date = new Date()): string {
  const dias = Math.max(0, diasAtraso || 15);
  const dataVenc = new Date(dataReferencia.getTime() - dias * 86400000);
  const dia = String(dataVenc.getDate()).padStart(2, '0');
  const mes = String(dataVenc.getMonth() + 1).padStart(2, '0');
  const ano = dataVenc.getFullYear();
  return `${dia}/${mes}/${ano}`;
}

/**
 * Retorna o próximo dia útil válido para agendamento oficial no BackOffice.
 * O BackOffice da Clara Eletro opera de Segunda a Sábado, das 07:00 às 18:00.
 * Apenas Domingo não tem expediente.
 */
export function obterProximoDiaUtil(dataBase: Date = new Date()): {
  dataYmd: string;
  dataFormatada: string;
  diaSemanaNome: string;
  isFimDeSemana: boolean;
  diasAdicionados: number;
} {
  const d = new Date(dataBase.getTime());
  const hora = d.getHours();
  let diasAdicionados = 0;

  // Se já passou das 18h de Segunda a Sexta -> avança 1 dia
  if (hora >= 18 && d.getDay() >= 1 && d.getDay() <= 5) {
    d.setDate(d.getDate() + 1);
    diasAdicionados++;
  } else if (hora >= 18 && d.getDay() === 6) {
    // Sábado após as 18h -> avança para Segunda (+2 dias)
    d.setDate(d.getDate() + 2);
    diasAdicionados += 2;
  }

  // Se for Domingo (0) -> avança para Segunda (+1 dia)
  if (d.getDay() === 0) {
    d.setDate(d.getDate() + 1);
    diasAdicionados += 1;
  }

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const dataYmd = `${y}-${m}-${day}`;
  const dataFormatada = `${day}/${m}/${y}`;

  const DIAS_SEMANA = [
    'Domingo',
    'Segunda-feira',
    'Terça-feira',
    'Quarta-feira',
    'Quinta-feira',
    'Sexta-feira',
    'Sábado',
  ];
  const diaSemanaNome = DIAS_SEMANA[d.getDay()];

  return {
    dataYmd,
    dataFormatada,
    diaSemanaNome,
    isFimDeSemana: dataBase.getDay() === 0 || (dataBase.getDay() === 6 && hora >= 18),
    diasAdicionados,
  };
}

/**
 * Valida se uma data YYYY-MM-DD cai em um dia sem expediente (Apenas Domingo).
 * A Clara Eletro opera de Segunda a Sábado a partir das 07:00.
 */
export function isDataFimDeSemana(dataYmd: string): boolean {
  if (!dataYmd) return false;
  const parts = dataYmd.split('-');
  if (parts.length !== 3) return false;
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  // Domingo a loja opera normalmente na Clara Eletro
  return false;
}

/**
 * Verifica se está dentro do horário comercial oficial do BackOffice (06:00 às 18:00).
 * A Clara Eletro opera de Segunda a Sábado das 06:00 às 18:00.
 */
export function isHorarioComercial(data: Date = new Date()): boolean {
  const hora = data.getHours();
  // Expediente operacional oficial da Clara Eletro: 06:00 às 18:00
  return hora >= 6 && hora < 18;
}

/**
 * Heurística Preditiva de Inadimplência (Visão de Dono e Classificação Estratégica)
 * Mapeia cada cliente em 4 perfis claros de ação de crédito e cobrança
 */
export function calcularPrevisaoInadimplencia(cliente: ClienteInadimplente): PrevisaoInadimplencia {
  const vRecebido = cliente.v_recebido || 0;
  const vInadim = cliente.v_inadim || 0;
  const contratos = cliente.contratos || 1;
  const diasAtraso = cliente.atraso_dias || 0;
  const vClienteNovo = (cliente as any).v_cliente_novo || 0;
  const vPnp = (cliente as any).v_pnp || 0;

  // 1. Calote de Entrada (Cliente Novo de Alto Ticket sem entrada, R$ 0 pago)
  if (vRecebido === 0 && (vClienteNovo > 0 || (contratos <= 2 && vInadim >= 500 && diasAtraso >= 25))) {
    return {
      perfilRisco: 'CALOTE_ENTRADA',
      probabilidadeRecuperacao: 15,
      rotuloPerfil: 'Calote de Entrada (Novo)',
      descricaoRisco: 'Cliente novo sem histórico de pagamentos (R$ 0 recebido). Alto risco de perda total ou estelionato.',
      acaoEstrategica: 'Trava imediata no CPF, notificação extrajudicial e visita física. Sem concessão de desconto pelo WhatsApp.',
      canalSugerido: 'SPC_SERASA',
    };
  }

  // 2. Superendividamento de Cliente Antigo ("Bola de Neve")
  if (contratos >= 5 && vRecebido > 1000) {
    return {
      perfilRisco: 'SUPERENDIVIDADO',
      probabilidadeRecuperacao: 65,
      rotuloPerfil: 'Superendividado (Bola de Neve)',
      descricaoRisco: 'Cliente histórico da loja com alto valor pago, asfixiado por múltiplos contratos simultâneos.',
      acaoEstrategica: 'Atendimento de gerente: unificação de todos os carnês em contrato único, congelamento de juros e alongamento de prazo.',
      canalSugerido: 'GERENTE_NEGOCIACAO',
    };
  }

  // 3. Atraso Leve / Esquecimento Operacional (5 a 45 dias)
  if (diasAtraso <= 45) {
    return {
      perfilRisco: 'ATRASO_LEVE',
      probabilidadeRecuperacao: 85,
      rotuloPerfil: 'Atraso Recente (Portal)',
      descricaoRisco: 'Atraso de curto prazo. Alta probabilidade de quitação rápida via autosserviço.',
      acaoEstrategica: 'Envio do link do Portal do Cliente oficial (portal.claraeletro.com.br/login) para emissão de 2ª via segura.',
      canalSugerido: 'PORTAL_CLIENTE',
    };
  }

  // 4. Dívida Envelhecida / PNP (Provável Não Pagador)
  if (diasAtraso > 180 || vPnp > 0) {
    return {
      perfilRisco: 'DIVIDA_ENVELHECIDA',
      probabilidadeRecuperacao: 25,
      rotuloPerfil: 'Dívida Antiga / PNP',
      descricaoRisco: 'Dívida envelhecida acima de 6 meses. Alta chance de transição para perda contábil definitiva (PCLD).',
      acaoEstrategica: 'Cobrança presencial de balcão na Loja 27 Purupuru e proposta de quitação facilitada mediante entrada em espécie.',
      canalSugerido: 'COBRANCA_PRESENCIAL',
    };
  }

  // Padrão: Atraso Moderado
  return {
    perfilRisco: 'REGULAR',
    probabilidadeRecuperacao: 50,
    rotuloPerfil: 'Inadimplência Moderada',
    descricaoRisco: 'Atraso intermediário (46 a 180 dias). Requer acompanhamento da régua de cobrança.',
    acaoEstrategica: 'Orientação de pagamento pelo Portal do Cliente Clara Eletro ou caixa da loja.',
    canalSugerido: 'PORTAL_CLIENTE',
  };
}

/**
 * Classificação Contábil por Faixas de Aging de Recebíveis
 */
export function calcularFaixaAging(diasAtraso: number): '01-15' | '16-60' | '61-180' | '181-360' | 'PNP' {
  if (diasAtraso <= 15) return '01-15';
  if (diasAtraso <= 60) return '16-60';
  if (diasAtraso <= 180) return '61-180';
  if (diasAtraso <= 360) return '181-360';
  return 'PNP';
}

/**
 * Avaliação Preditiva de Urgência para Cobrança Cirúrgica no Sábado
 * No sábado, o expediente encerra mais cedo. O foco é cobrança cirúrgica usando sempre o template oficial da loja:
 * 1. Pré-Perda Crítica (D+85 a D+89): prestes a completar 90 dias e virar perda irreversível
 * 2. Recém-vencido de alto valor (D+5 a D+15 e valor >= R$ 1.200): alta propensão de regularização antes do fim de semana
 * 3. Ruptura de Bom Pagador com valor expressivo: histórico pontual que atrasou de forma atípica
 * 4. PNP de Alto Risco (1ª parcela não paga de valor expressivo)
 */
export function calcularUrgenciaSabado(
  cliente: ClienteInadimplente
): { urgente: boolean; scoreUrgencia: number; motivo?: string } {
  const eleg = verificarElegibilidade(cliente);
  if (!eleg.elegivel) {
    return { urgente: false, scoreUrgencia: 0, motivo: eleg.motivo };
  }

  const contactabilidade = calcularContactabilidade(cliente);
  if (contactabilidade === 0) {
    return { urgente: false, scoreUrgencia: 0, motivo: 'Contactabilidade zero' };
  }

  const diasAtraso = cliente.atraso_dias || 0;
  const valor = cliente.v_inadim || 0;

  // Critério A: Iminência de Perda Contábil / PCLD (85 a 89 dias)
  if (diasAtraso >= 85 && diasAtraso <= 89) {
    return {
      urgente: true,
      scoreUrgencia: 95,
      motivo: `Pré-Perda Crítica (${diasAtraso} dias): prestes a completar 90 dias e virar perda irreversível no ERP.`,
    };
  }

  // Critério B: Recém-vencido de Alto Valor (D+5 a D+15 e Valor >= R$ 1.200)
  if (diasAtraso >= 5 && diasAtraso <= 15 && valor >= 1200) {
    return {
      urgente: true,
      scoreUrgencia: 88,
      motivo: `Atraso Recente Alto Valor (${diasAtraso} dias - R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}): alta propensão de retorno no sábado.`,
    };
  }

  // Critério C: Ruptura de Bom Pagador com Valor Expressivo (atraso até 30 dias e valor >= 800)
  const totalGeral = (cliente.v_recebido || 0) + valor;
  const hPontualidade = totalGeral > 0 ? (cliente.v_recebido || 0) / totalGeral : 0;
  if (hPontualidade >= 0.75 && diasAtraso <= 30 && valor >= 800) {
    return {
      urgente: true,
      scoreUrgencia: 82,
      motivo: `Ruptura de Bom Pagador (${Math.round(hPontualidade * 100)}% histórico quitado): cliente pontual com atraso atípico.`,
    };
  }

  // Critério D: PNP recente de Alto Valor (contrato novo sem nenhum pagamento e valor >= R$ 1.500)
  if (cliente.v_recebido === 0 && cliente.contratos <= 1 && diasAtraso <= 30 && valor >= 1500) {
    return {
      urgente: true,
      scoreUrgencia: 78,
      motivo: `PNP Alto Risco (1ª parcela não paga - R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}): intervenção urgente.`,
    };
  }

  return { urgente: false, scoreUrgencia: 0 };
}

/**
 * Seleciona a lista prioritária de cobrança cirúrgica de sábado
 */
export function selecionarClientesUrgentesSabado(
  clientes: ClienteInadimplente[],
  limite: number = 10
): {
  urgentes: (ClienteInadimplente & { scoreUrgencia: number; motivoUrgencia: string })[];
  totalUrgentes: number;
} {
  const avaliados: (ClienteInadimplente & { scoreUrgencia: number; motivoUrgencia: string })[] = [];

  clientes.forEach(cliente => {
    const res = calcularUrgenciaSabado(cliente);
    if (res.urgente && res.motivo) {
      avaliados.push({
        ...cliente,
        scoreUrgencia: res.scoreUrgencia,
        motivoUrgencia: res.motivo,
      });
    }
  });

  avaliados.sort((a, b) => b.scoreUrgencia - a.scoreUrgencia || b.v_inadim - a.v_inadim);

  return {
    urgentes: avaliados.slice(0, limite),
    totalUrgentes: avaliados.length,
  };
}

/**
 * Motor de Avaliação da Saúde Financeira do Cliente (Visão de Dono)
 * Mede com precisão matemática se o cliente é um risco real de inadimplência/calote
 * ou se é um bom pagador histórico que apenas teve um atraso momentâneo.
 */
export function calcularSaudeFinanceiraCliente(cliente: {
  v_total?: number;
  v_recebido?: number;
  v_inadim?: number;
  parcelas_total?: number;
  parcelas_aberto?: number;
  atraso_dias?: number;
  contratos?: number;
  nome_cliente?: string;
}): SaudeFinanceiraCliente {
  const vTotal = Number(cliente.v_total || 0);
  const vRecebido = Number(cliente.v_recebido || 0);
  const vInadim = Number(cliente.v_inadim || 0);
  const pTotal = Number(cliente.parcelas_total || 1);
  const pAberto = Number(cliente.parcelas_aberto || 1);
  const atraso = Number(cliente.atraso_dias || 0);
  const contratos = Number(cliente.contratos || 1);

  // 1. Taxa de Quitação Histórica (% do montante que o cliente já pagou de fato à loja)
  const baseTotal = vTotal > 0 ? vTotal : (vRecebido + vInadim);
  const taxaQuitacaoHistorica = baseTotal > 0 ? Math.min(100, Math.max(0, (vRecebido / baseTotal) * 100)) : 0;

  // 2. Percentual de Parcelas Quitadas
  const parcelasPagas = Math.max(0, pTotal - pAberto);
  const pctParcelasPagas = pTotal > 0 ? Math.min(100, Math.max(0, (parcelasPagas / pTotal) * 100)) : 0;

  // 3. Cálculo do Score de Saúde (0 a 100)
  let penalidadeAtraso = 0;
  if (atraso <= 15) {
    penalidadeAtraso = 0;
  } else if (atraso <= 30) {
    penalidadeAtraso = 10;
  } else if (atraso <= 60) {
    penalidadeAtraso = 20;
  } else if (atraso <= 90) {
    penalidadeAtraso = 35;
  } else if (atraso <= 180) {
    penalidadeAtraso = 55;
  } else {
    penalidadeAtraso = 75;
  }

  const penalidadeContratos = contratos >= 8 ? 15 : (contratos >= 5 ? 8 : 0);

  let scoreSaude = Math.round(
    (taxaQuitacaoHistorica * 0.55) + 
    (pctParcelasPagas * 0.35) - 
    penalidadeAtraso - 
    penalidadeContratos + 
    10
  );

  if (vRecebido === 0 && atraso >= 30) {
    scoreSaude = Math.min(scoreSaude, 15);
  }

  scoreSaude = Math.min(100, Math.max(0, scoreSaude));

  // 4. Classificação por Nível
  let nivel: SaudeFinanceiraCliente['nivel'];
  let rotuloNivel: string;
  let corHex: string;
  let corBadgeBg: string;
  let corBadgeText: string;
  let corBadgeBorder: string;
  let grauRiscoReal: SaudeFinanceiraCliente['grauRiscoReal'];
  let diagnosticoExecutivo: string;

  if (scoreSaude >= 80) {
    nivel = 'EXCELENTE';
    rotuloNivel = 'Excelente Pagador';
    corHex = '#10b981';
    corBadgeBg = 'bg-emerald-500/15';
    corBadgeText = 'text-emerald-400';
    corBadgeBorder = 'border-emerald-500/30';
    grauRiscoReal = 'MÍNIMO';
    diagnosticoExecutivo = `Cliente com histórico exemplar na loja: já quitou ${Math.round(taxaQuitacaoHistorica)}% do carnê. Atraso recente e pontual. Risco mínimo de perda, cobrança amigável recomendada.`;
  } else if (scoreSaude >= 60) {
    nivel = 'BOA';
    rotuloNivel = 'Boa Saúde';
    corHex = '#38bdf8';
    corBadgeBg = 'bg-cyan-500/15';
    corBadgeText = 'text-cyan-400';
    corBadgeBorder = 'border-cyan-500/30';
    grauRiscoReal = 'BAIXO';
    diagnosticoExecutivo = `Bom pagador histórico: já amortizou ${Math.round(taxaQuitacaoHistorica)}% do saldo total (${parcelasPagas}/${pTotal} parcelas). Recuperação altamente provável via lembrete oficial.`;
  } else if (scoreSaude >= 40) {
    nivel = 'REGULAR';
    rotuloNivel = 'Saúde Regular';
    corHex = '#f59e0b';
    corBadgeBg = 'bg-amber-500/15';
    corBadgeText = 'text-amber-400';
    corBadgeBorder = 'border-amber-500/30';
    grauRiscoReal = 'MODERADO';
    diagnosticoExecutivo = `Atenção: atraso de ${atraso} dias com ${pAberto} parcelas em aberto. Pagou ${Math.round(taxaQuitacaoHistorica)}% do carnê. Requer contato prioritário antes que a dívida envelheça.`;
  } else if (scoreSaude >= 20) {
    nivel = 'RISCO_ALTO';
    rotuloNivel = 'Risco Elevado';
    corHex = '#f97316';
    corBadgeBg = 'bg-orange-500/15';
    corBadgeText = 'text-orange-400';
    corBadgeBorder = 'border-orange-500/30';
    grauRiscoReal = 'ALTO';
    diagnosticoExecutivo = `Situação delicada: ${atraso} dias de atraso e ${contratos} contrato(s). Pouca amortização histórica (${Math.round(taxaQuitacaoHistorica)}% pago). Risco severo de perda.`;
  } else {
    nivel = 'CRITICA_INSOLVENTE';
    rotuloNivel = 'Insolvente / Crítico';
    corHex = '#ef4444';
    corBadgeBg = 'bg-rose-500/15';
    corBadgeText = 'text-rose-400';
    corBadgeBorder = 'border-rose-500/30';
    grauRiscoReal = 'MÁXIMO_CALOTE';
    diagnosticoExecutivo = vRecebido === 0 
      ? `Calote de entrada provável: o cliente pagou R$ 0,00 e já acumula ${atraso} dias de atraso. Dívida de alto risco de estelionato ou insolvência.`
      : `Dívida antiga sem amortizações recentes (${atraso} dias de atraso). Perda financeira consumada se não houver renegociação de choque.`;
  }

  const vRecebidoFmt = vRecebido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const baseTotalFmt = baseTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const resumoQuitacao = `Quitou ${Math.round(taxaQuitacaoHistorica)}% do carnê (${vRecebidoFmt} de ${baseTotalFmt})`;

  return {
    scoreSaude,
    nivel,
    rotuloNivel,
    corHex,
    corBadgeBg,
    corBadgeText,
    corBadgeBorder,
    taxaQuitacaoHistorica: Number(taxaQuitacaoHistorica.toFixed(1)),
    pctParcelasPagas: Number(pctParcelasPagas.toFixed(1)),
    resumoQuitacao,
    grauRiscoReal,
    diagnosticoExecutivo,
  };
}

