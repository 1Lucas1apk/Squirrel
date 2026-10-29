import { Linking, Platform } from 'react-native';
import { 
  ClienteInadimplente, 
  DiagnosticoErro, 
  DiagnosticoTelefone,
  EventoAuditoriaInadimplencia,
  ExclusaoTemporaria, 
  FaixaAging,
  GrupoAgendamento,
  HistoricoDetalheCliente, 
  InadimplenciaMetricas,
  PagamentoLojaD1,
  ParcelaContrato,
  StatusClienteCobranca,
  TipoEventoAuditoria,
  ConfigAutocobranca,
  StatusAutocobrancaAnalise,
  EventoHistoricoCliente,
  SaudeFinanceiraCliente
} from '../types/inadimplencia';
import { getRealtimeDatabase } from './firebase/realtime';
import { ref, set, remove, get, onValue, runTransaction } from 'firebase/database';
import { toBrl } from '../utils/currency';
import { 
  calcularScoreCobranca, 
  calcularDataVencimento, 
  isHorarioComercial,
  calcularDiasAtrasoReal,
  obterDetalhesAtraso,
  calcularPrevisaoInadimplencia,
  calcularFaixaAging,
  selecionarTop30Inteligente,
  calcularUrgenciaSabado,
  selecionarClientesUrgentesSabado,
  calcularSaudeFinanceiraCliente
} from '../utils/cobranca-math';
import { getBackofficeCredentials, saveBackofficeCredentials } from './auth-storage';

/**
 * Retorna a data atual local (YYYY-MM-DD) consistente com o fuso do Amazonas (evita virada prematura do UTC)
 */
export function getHojeDataYmd(): string {
  const d = new Date();
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

export function getBackofficeBaseUrl(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.hostname === 'localhost') {
    return `${window.location.origin}/unboxtech-proxy/UnBoxTech/modulos/inadimplencia_loja`;
  }
  return 'https://backoffice.unboxtech.com.br/UnBoxTech/modulos/inadimplencia_loja';
}

export function getBackofficeAuthUrl(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.hostname === 'localhost') {
    return `${window.location.origin}/unboxtech-proxy/UnBoxTech/config/auth.php`;
  }
  return 'https://backoffice.unboxtech.com.br/UnBoxTech/config/auth.php';
}

/**
 * Constrói headers de autenticação para requisições ao BackOffice.
 * Quando o cookie é 'NATIVE_COOKIE_JAR', não injeta headers explícitos —
 * o jar nativo do Android já envia o PHPSESSID automaticamente via credentials:'include'.
 */
export function buildBackofficeHeaders(cookie: string, extraHeaders: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { ...extraHeaders };
  if (cookie && cookie !== 'NATIVE_COOKIE_JAR') {
    headers['cookie'] = cookie;
    headers['x-backoffice-cookie'] = cookie;
  }
  return headers;
}

/**
 * Fetch com AbortController e timeout estrito para evitar travamento da UI.
 * No Android nativo, adiciona credentials:'include' para enviar cookies do jar nativo.
 */
export async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 5000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // No Android/iOS, sempre inclui credentials para enviar cookies nativos
    const nativeCredentials = Platform.OS !== 'web' ? { credentials: 'include' as RequestCredentials } : {};
    const response = await fetch(url, {
      ...options,
      ...nativeCredentials,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(id);
  }
}

// Firebase Realtime Database é a fonte única da verdade para dados compartilhados da Loja 27
// Não são utilizados caches locais isolados que impeçam sincronização em nuvem e dados analíticos.

export const TEMPLATE_MENSAGEM_PADRAO = `Olá, *{nome}*! Tudo bem? 🌟

Passando para lembrar que consta em nosso sistema um valor em aberto no seu cadastro na *Clara Eletro*.

Precisando de ajuda para regularizar ou negociar, é só nos chamar! Estamos à disposição para encontrar a melhor condição para você. 👍
*(Por favor, desconsidere esta mensagem caso o pagamento já tenha sido realizado).*

- Messagem automatica`;

export const CONFIG_AUTOCOBRANCA_PADRAO: ConfigAutocobranca = {
  ativa: false,
  modo: 'co_piloto',
  horarioLimiteDiasUteis: '09:30',
  horarioLimiteSabado: '09:00',
  cotaDiaria: 30,
  urgenciaSabadoAvulso: true,
};

// Lista de DDDs oficiais e válidos no Brasil
const DDDS_BRASIL_VALIDOS = new Set([
  '11','12','13','14','15','16','17','18','19', // SP
  '21','22','24', // RJ
  '27','28', // ES
  '31','32','33','34','35','37','38', // MG
  '41','42','43','44','45','46','47','48','49', // PR/SC
  '51','53','54','55', // RS
  '61', // DF
  '62','64', // GO
  '63', // TO
  '65','66', // MT
  '67', // MS
  '68', // AC
  '69', // RO
  '71','73','74','75','77', // BA
  '79', // SE
  '81','87', // PE
  '82', // AL
  '83', // PB
  '84', // RN
  '85','88', // CE
  '86','89', // PI
  '91','93','94', // PA
  '92','97', // AM (Amazonas)
  '95', // RR
  '96', // AP
  '98','99', // MA
]);

export class InadimplenciaService {
  private static cachedCookie: string | null = null;

  // Analisador inteligente de números de telefone e validação de DDD (DDD 20 vs 92/97 AM)
  static analisarTelefone(rawPhone: string): DiagnosticoTelefone {
    let digits = String(rawPhone || '').replace(/\D/g, '');

    // Remove prefixo internacional 55 se presente
    if (digits.startsWith('55') && digits.length >= 12) {
      digits = digits.slice(2);
    }

    if (digits.length < 10) {
      return {
        valido: false,
        telefoneFormatado: rawPhone || 'Sem telefone',
        ddd: '',
        numeroSemDdd: digits,
        isAmazonas: false,
        isDddInexistente: true,
        isFaltaNonoDigito: false,
        tipoAlerta: 'erro',
        mensagemAlerta: 'Telefone incompleto ou com menos de 10 dígitos.',
      };
    }

    const ddd = digits.slice(0, 2);
    const resto = digits.slice(2);
    const isAmazonas = ddd === '92' || ddd === '97';
    const isDddInexistente = !DDDS_BRASIL_VALIDOS.has(ddd);
    const isFaltaNonoDigito = resto.length === 8 && (resto.startsWith('8') || resto.startsWith('9'));

    let telefoneFormatado = `(${ddd}) ${resto}`;
    if (resto.length === 9) {
      telefoneFormatado = `(${ddd}) ${resto.slice(0, 5)}-${resto.slice(5)}`;
    } else if (resto.length === 8) {
      telefoneFormatado = `(${ddd}) ${resto.slice(0, 4)}-${resto.slice(4)}`;
    }

    if (ddd === '20') {
      return {
        valido: false,
        telefoneFormatado,
        ddd,
        numeroSemDdd: resto,
        isAmazonas: false,
        isDddInexistente: true,
        isFaltaNonoDigito,
        tipoAlerta: 'erro',
        mensagemAlerta: '❌ DDD 20 não existe no Brasil. No Amazonas, os DDDs são 92 (Manaus) ou 97 (Interior). Corrija o número antes de enviar.',
        sugestaoCorrecao: `(92) ${isFaltaNonoDigito ? '9' : ''}${resto}`,
      };
    }

    if (isDddInexistente) {
      return {
        valido: false,
        telefoneFormatado,
        ddd,
        numeroSemDdd: resto,
        isAmazonas: false,
        isDddInexistente: true,
        isFaltaNonoDigito,
        tipoAlerta: 'erro',
        mensagemAlerta: `❌ DDD ${ddd} é inválido/inexistente no Brasil. O disparo falhará no WhatsApp.`,
        sugestaoCorrecao: `(92) ${isFaltaNonoDigito ? '9' : ''}${resto}`,
      };
    }

    if (isFaltaNonoDigito) {
      return {
        valido: true,
        telefoneFormatado,
        ddd,
        numeroSemDdd: resto,
        isAmazonas,
        isDddInexistente: false,
        isFaltaNonoDigito: true,
        tipoAlerta: 'atencao',
        mensagemAlerta: '⚠️ Celular com 8 dígitos. Recomendado adicionar o 9º dígito antes de disparar.',
        sugestaoCorrecao: `(${ddd}) 9${resto.slice(0, 4)}-${resto.slice(4)}`,
      };
    }

    if (!isAmazonas) {
      return {
        valido: true,
        telefoneFormatado,
        ddd,
        numeroSemDdd: resto,
        isAmazonas: false,
        isDddInexistente: false,
        isFaltaNonoDigito: false,
        tipoAlerta: 'atencao',
        mensagemAlerta: `ℹ️ Número com DDD ${ddd} (fora do Amazonas). Certifique-se de que o contato é válido.`,
      };
    }

    return {
      valido: true,
      telefoneFormatado,
      ddd,
      numeroSemDdd: resto,
      isAmazonas: true,
      isDddInexistente: false,
      isFaltaNonoDigito: false,
      tipoAlerta: 'sucesso',
      mensagemAlerta: '✅ Número válido no padrão Amazonas.',
    };
  }

  // Motor de interpolação de mensagem dinâmica seguro contra ReDoS e injeção de '$'
  static formatarMensagemDinamica(
    template: string,
    cliente: { nome_cliente: string; v_inadim: number; atraso_dias?: number; cpf_cnpj?: string }
  ): string {
    const nomeCompleto = cliente.nome_cliente || 'Cliente';
    const primeiroNome = nomeCompleto.split(' ')[0] || 'Cliente';
    const valorFormatado = toBrl(cliente.v_inadim);
    const diasAtraso = `${cliente.atraso_dias || 15} dias`;
    const docCliente = cliente.cpf_cnpj || '';

    return template
      .replace(/\{nome\}|\{user\}/gi, () => nomeCompleto)
      .replace(/\{primeiro_nome\}/gi, () => primeiroNome)
      .replace(/\{valor\}/gi, () => valorFormatado)
      .replace(/\{atraso\}|\{dias\}/gi, () => diasAtraso)
      .replace(/\{cpf\}|\{doc\}/gi, () => docCliente)
      .replace(/\{portal\}|\{link_portal\}/gi, () => 'https://portal.claraeletro.com.br/login')
      .replace(/\{loja\}/gi, () => 'Clara Eletro');
  }

  // Obter template salvo na nuvem (Firebase RTDB) ou padrão
  static async getTemplateMensagem(): Promise<string> {
    try {
      const db = getRealtimeDatabase();
      if (db) {
        const snap = await get(ref(db, 'inadimplencia_template_msg_loja27'));
        if (snap.exists() && typeof snap.val() === 'string' && snap.val().trim()) {
          return snap.val().trim();
        }
      }
      return TEMPLATE_MENSAGEM_PADRAO;
    } catch {
      return TEMPLATE_MENSAGEM_PADRAO;
    }
  }

  static async saveTemplateMensagem(template: string): Promise<void> {
    const clean = template.trim() || TEMPLATE_MENSAGEM_PADRAO;
    try {
      const db = getRealtimeDatabase();
      if (db) {
        await set(ref(db, 'inadimplencia_template_msg_loja27'), clean);
      }
    } catch {
      // no-op
    }
  }

  // Obter configurações de Autocobrança da Loja 27 no Firebase RTDB
  static async getAutocobrancaConfig(): Promise<ConfigAutocobranca> {
    try {
      const db = getRealtimeDatabase();
      if (db) {
        const snap = await get(ref(db, 'inadimplencia_config_loja27/autocobranca'));
        if (snap.exists() && typeof snap.val() === 'object') {
          return { ...CONFIG_AUTOCOBRANCA_PADRAO, ...snap.val() };
        }
      }
      return { ...CONFIG_AUTOCOBRANCA_PADRAO };
    } catch {
      return { ...CONFIG_AUTOCOBRANCA_PADRAO };
    }
  }

  // Salvar configurações de Autocobrança no Firebase RTDB (sincronização global para toda a Loja 27)
  static async saveAutocobrancaConfig(
    config: Partial<ConfigAutocobranca>,
    operadorNome?: string
  ): Promise<void> {
    try {
      const db = getRealtimeDatabase();
      if (db) {
        const atual = await this.getAutocobrancaConfig();
        const nova = {
          ...atual,
          ...config,
          atualizadoPor: operadorNome || 'Operador Loja 27',
          atualizadoEm: Date.now(),
        };
        await set(ref(db, 'inadimplencia_config_loja27/autocobranca'), nova);
      }
    } catch (e) {
      console.warn('[Autocobranca] Erro ao salvar configurações:', e);
    }
  }

  // Listener em tempo real da configuração de Autocobrança
  static listenAutocobrancaConfig(callback: (config: ConfigAutocobranca) => void): () => void {
    const db = getRealtimeDatabase();
    if (!db) return () => {};
    const configRef = ref(db, 'inadimplencia_config_loja27/autocobranca');
    return onValue(configRef, (snap) => {
      if (snap.exists() && typeof snap.val() === 'object') {
        callback({ ...CONFIG_AUTOCOBRANCA_PADRAO, ...snap.val() });
      } else {
        callback({ ...CONFIG_AUTOCOBRANCA_PADRAO });
      }
    });
  }

  // Distributed Transaction Mutex: Adquire lock atômico diário no Firebase RTDB para evitar disparo concorrente
  static async tentarAdquirirLockAutocobranca(
    dataYmd: string,
    operador: string
  ): Promise<{ adquirido: boolean; motivo?: string; lockData?: any }> {
    const db = getRealtimeDatabase();
    if (!db) return { adquirido: false, motivo: 'Banco de dados offline' };

    const lockRef = ref(db, `inadimplencia_locks/autocobranca_${dataYmd}`);
    try {
      let adquirido = false;
      let existingVal: any = null;

      const txResult = await runTransaction(lockRef, (currentData) => {
        const agora = Date.now();
        if (currentData) {
          existingVal = currentData;
          // Se já foi executado hoje com sucesso, não permite nova execução
          if (currentData.status === 'executado') {
            return; // Aborta transação sem alterar
          }
          // Se está em processamento mas passou de 2 minutos (TTL expirado / app fechou), assume o lock
          if (currentData.status === 'processando' && agora - (currentData.timestamp || 0) < 120000) {
            return; // Outro dispositivo está ativamente processando
          }
        }
        // Concede o lock
        adquirido = true;
        return {
          status: 'processando',
          timestamp: agora,
          operador,
          tentativaEm: agora,
        };
      });

      if (txResult.committed && adquirido) {
        return { adquirido: true };
      }

      const motivo = existingVal?.status === 'executado'
        ? `Lote diário já disparado hoje (${existingVal.operador || 'Sistema'})`
        : 'Outro operador da Loja 27 está processando o lote neste momento';
      return { adquirido: false, motivo, lockData: existingVal };
    } catch (e) {
      console.warn('[Autocobranca] Erro ao verificar lock distribuído:', e);
      // Fallback seguro: Em caso de falha de rede/exceção, NÃO adquire o lock para prevenir disparos concorrentes
      return { adquirido: false, motivo: 'Falha na verificação de concorrência com o Firebase. Operação prevenida por segurança.' };
    }
  }

  // Atualizar status final do Lock
  static async finalizarLockAutocobranca(
    dataYmd: string,
    status: 'executado' | 'erro' | 'cancelado',
    detalhes?: { operador?: string; totalContatos?: number; msg?: string }
  ): Promise<void> {
    try {
      const db = getRealtimeDatabase();
      if (!db) return;
      const lockRef = ref(db, `inadimplencia_locks/autocobranca_${dataYmd}`);
      await set(lockRef, {
        status,
        timestamp: Date.now(),
        operador: detalhes?.operador || 'Loja 27',
        totalContatos: detalhes?.totalContatos || 0,
        mensagem: detalhes?.msg || '',
      });
    } catch {
      // no-op
    }
  }

  // Motor Preditivo: Analisa o relógio, a ociosidade matinal e seleciona a fila de cobrança
  static async analisarStatusAutocobranca(
    clientes: ClienteInadimplente[],
    contatosHoje: number = 0,
    lotesHoje: number = 0,
    configSobrescrever?: ConfigAutocobranca,
    agendamentoHoje?: GrupoAgendamento | null
  ): Promise<StatusAutocobrancaAnalise> {
    const config = configSobrescrever || await this.getAutocobrancaConfig();

    const agora = new Date();
    const diaSemana = agora.getDay(); // 0 = Domingo, 6 = Sábado
    const isDomingo = diaSemana === 0;
    const isSabado = diaSemana === 6;

    const hora = agora.getHours();
    const minuto = agora.getMinutes();
    const horaFormatada = `${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}`;
    const hojeYmd = getHojeDataYmd();

    const foraExpediente = isDomingo || (isSabado ? (hora < 7 || hora >= 13) : (hora < 7 || hora >= 18));
    const horarioLimiteAtual = isSabado ? (config.horarioLimiteSabado || '09:00') : (config.horarioLimiteDiasUteis || '09:30');

    if (!config.ativa) {
      return {
        emAtraso: false,
        motivoAtraso: 'Autocobrança desativada nas configurações da Loja 27',
        isSabado,
        isDomingo,
        foraExpediente,
        horarioLimiteAtual,
        clientesSugeridos: [],
        tipoAcaoSugerida: 'nenhuma',
        valorTotalSugerido: 0,
      };
    }

    if (isDomingo) {
      return {
        emAtraso: false,
        motivoAtraso: 'Domingo: Loja 27 fechada (Conformidade Art. 42 CDC)',
        isSabado,
        isDomingo,
        foraExpediente: true,
        horarioLimiteAtual,
        clientesSugeridos: [],
        tipoAcaoSugerida: 'nenhuma',
        valorTotalSugerido: 0,
      };
    }

    if (foraExpediente) {
      return {
        emAtraso: false,
        motivoAtraso: `Fora do expediente oficial de cobrança (${isSabado ? 'Sáb: 07h-13h' : 'Seg-Sex: 07h-18h'})`,
        isSabado,
        isDomingo,
        foraExpediente: true,
        horarioLimiteAtual,
        clientesSugeridos: [],
        tipoAcaoSugerida: 'nenhuma',
        valorTotalSugerido: 0,
      };
    }

    // Verificar se já houve disparo ou lote hoje
    const db = getRealtimeDatabase();
    let jaExecutadoHoje = contatosHoje > 0 || lotesHoje > 0;
    if (!jaExecutadoHoje && db) {
      try {
        const snapLock = await get(ref(db, `inadimplencia_locks/autocobranca_${hojeYmd}`));
        if (snapLock.exists() && snapLock.val()?.status === 'executado') {
          jaExecutadoHoje = true;
        }
      } catch {
        // no-op
      }
    }

    if (jaExecutadoHoje) {
      // O lote diário já foi agendado ou processado hoje.
      // OPORTUNIDADE DE INTELIGÊNCIA: Se o lote de hoje teve ERROS e já finalizou,
      // esse número de erros virou SALDO disponível para atingir os 30 disparos com sucesso!
      const errosLote = Number(agendamentoHoje?.error_count || 0);
      const sucessosLote = Number(agendamentoHoje?.success_count || 0);
      const isLoteConcluido = agendamentoHoje && (agendamentoHoje.status === 'FINALIZADO' || !agendamentoHoje.is_processing);

      // Trava rigorosa anti-bug: Saldo estritamente limitado ao que falta para bater a meta de 30 (NUNCA mais que 30)
      const saldoVagas = Math.max(0, 30 - sucessosLote);
      const saldoErrosReaproveitavel = (isLoteConcluido && errosLote > 0)
        ? Math.min(errosLote, saldoVagas, 30)
        : 0;

      // Verifica no Firebase se já disparamos a recuperação de erros hoje
      let jaRecuperouErrosHoje = false;
      if (saldoErrosReaproveitavel > 0 && db) {
        try {
          const snapRecup = await get(ref(db, `inadimplencia_locks/autocobranca_recuperacao_${hojeYmd}`));
          if (snapRecup.exists() && snapRecup.val()?.status === 'executado') {
            jaRecuperouErrosHoje = true;
          }
        } catch {
          // no-op
        }
      }

      if (saldoErrosReaproveitavel > 0 && !jaRecuperouErrosHoje && !foraExpediente && !isDomingo && config.ativa) {
        const cpfsJaNoLote = new Set<string>((agendamentoHoje?.clientesCpfs || []).map((c) => String(c).replace(/\D/g, '')));

        // Carrega disparos avulsos das últimas 24h para jamais re-disparar para quem já foi contatado
        let disparos24hMap: Record<string, boolean> = {};
        if (db) {
          try {
            const snapDisp = await get(ref(db, 'inadimplencia_disparos_24h'));
            if (snapDisp.exists()) {
              const val = snapDisp.val();
              if (val && typeof val === 'object') {
                Object.keys(val).forEach((k) => {
                  disparos24hMap[String(k).replace(/\D/g, '')] = true;
                });
              }
            }
          } catch {}
        }

        // Filtra clientes elegíveis com critérios cirúrgicos anti-bug:
        const candidatosSuplentes = clientes.filter((c) => {
          const cleanCpf = String(c.cpf_cnpj).replace(/\D/g, '');
          if (!cleanCpf) return false;
          if (cpfsJaNoLote.has(cleanCpf)) return false;
          if (disparos24hMap[cleanCpf]) return false;
          if (c.cobranca_enviada_24h === 1) return false;
          if (c.status === 'compensacao_d1' || (c.pagamentoLojaD1 && c.pagamentoLojaD1.ativo)) return false;
          if (c.status === 'pausado') return false;

          // Validação rigorosa de telefone celular (DDD + 9 dígitos, 10 ou 11 dígitos, sem DDD inexistente)
          const tel = String(c.phone || c.phone_api || '').replace(/\D/g, '');
          const telSem55 = tel.startsWith('55') ? tel.slice(2) : tel;
          if (telSem55.length < 10 || telSem55.length > 11) return false;
          if (c.has_valid_phone === false) return false;
          const ddd = telSem55.slice(0, 2);
          if (ddd === '20' || ddd === '00') return false;

          return true;
        });

        // Ordena por maior assertividade e potencial de recuperação
        const suplentesOrdenados = [...candidatosSuplentes].sort((a, b) => (b.scorePrioridade || 0) - (a.scorePrioridade || 0));
        const suplentesFinais = suplentesOrdenados.slice(0, saldoErrosReaproveitavel);

        if (suplentesFinais.length > 0) {
          const vTotal = suplentesFinais.reduce((acc, c) => acc + (c.v_inadim || 0), 0);
          return {
            emAtraso: true,
            motivoAtraso: `Lote de hoje teve ${errosLote} erro${errosLote > 1 ? 's' : ''}. Saldo liberado de ${suplentesFinais.length} disparo${suplentesFinais.length > 1 ? 's' : ''} avulso${suplentesFinais.length > 1 ? 's' : ''} para atingir a meta de 30 entregas!`,
            isSabado,
            isDomingo,
            foraExpediente: false,
            horarioLimiteAtual,
            clientesSugeridos: suplentesFinais,
            tipoAcaoSugerida: 'recuperacao_erros_avulso',
            valorTotalSugerido: vTotal,
            jaExecutadoHoje: false,
            saldoErrosReaproveitavel: suplentesFinais.length,
          };
        }
      }

      return {
        emAtraso: false,
        motivoAtraso: 'Cobrança do dia já foi realizada com sucesso',
        isSabado,
        isDomingo,
        foraExpediente: false,
        horarioLimiteAtual,
        clientesSugeridos: [],
        tipoAcaoSugerida: 'nenhuma',
        valorTotalSugerido: 0,
        jaExecutadoHoje: true,
      };
    }

    // Compara o relógio com o limite matinal
    const [limiteHora, limiteMin] = horarioLimiteAtual.split(':').map(Number);
    const emAtraso = (hora > limiteHora) || (hora === limiteHora && minuto >= limiteMin);

    if (!emAtraso) {
      return {
        emAtraso: false,
        motivoAtraso: `Dentro da tolerância matinal normal (Aguardando equipe até ${horarioLimiteAtual})`,
        isSabado,
        isDomingo,
        foraExpediente: false,
        horarioLimiteAtual,
        clientesSugeridos: [],
        tipoAcaoSugerida: 'nenhuma',
        valorTotalSugerido: 0,
      };
    }

    // Atraso Detectado!
    // No Sábado com urgência avulsa ativada, busca casos críticos cirúrgicos
    if (isSabado && config.urgenciaSabadoAvulso) {
      const { urgentes } = selecionarClientesUrgentesSabado(clientes, 10);
      if (urgentes.length > 0) {
        const vTotal = urgentes.reduce((acc, c) => acc + (c.v_inadim || 0), 0);
        return {
          emAtraso: true,
          motivoAtraso: `Sábado às ${horaFormatada}: ${urgentes.length} clientes urgentes precisam de cobrança cirúrgica antes do fechamento.`,
          isSabado: true,
          isDomingo: false,
          foraExpediente: false,
          horarioLimiteAtual,
          clientesSugeridos: urgentes,
          tipoAcaoSugerida: 'avulso_sabado_urgente',
          valorTotalSugerido: vTotal,
        };
      }
    }

    // Dias úteis (ou sábado padrão): seleciona Top 30 inteligente
    const { top30 } = selecionarTop30Inteligente(clientes);
    const vTotal = top30.reduce((acc, c) => acc + (c.v_inadim || 0), 0);

    return {
      emAtraso: true,
      motivoAtraso: `Expediente atrasado (${horaFormatada} > ${horarioLimiteAtual}): Cota matinal 0/30 ainda não iniciada.`,
      isSabado,
      isDomingo,
      foraExpediente: false,
      horarioLimiteAtual,
      clientesSugeridos: top30,
      tipoAcaoSugerida: 'lote_top30',
      valorTotalSugerido: vTotal,
    };
  }

  // Executa o disparo de Autocobrança com Distributed Lock e Template Oficial
  static async executarAutocobranca(
    clientesSugeridos: ClienteInadimplente[],
    tipoAcao: 'lote_top30' | 'avulso_sabado_urgente' | 'recuperacao_erros_avulso',
    operadorNome: string = 'SQUIRREL AUTOCOBRANCA'
  ): Promise<{ success: boolean; msg: string }> {
    const hojeYmd = getHojeDataYmd();

    // 1. Tenta adquirir Lock Distribuído
    const lockId = tipoAcao === 'recuperacao_erros_avulso' ? `autocobranca_recuperacao_${hojeYmd}` : hojeYmd;
    const { adquirido, motivo } = await this.tentarAdquirirLockAutocobranca(lockId, operadorNome);
    if (!adquirido) {
      return { success: false, msg: motivo || 'Operação cancelada: lock concorrente em andamento.' };
    }

    const templateOficial = await this.getTemplateMensagem();

    try {
      if (tipoAcao === 'lote_top30') {
        // Envia Lote Oficial de até 30 clientes
        const resultadoLote = await this.criarAgendamentoDiario(
          clientesSugeridos.slice(0, 30),
          hojeYmd,
          templateOficial,
          operadorNome
        );

        if (resultadoLote.success) {
          await this.finalizarLockAutocobranca(lockId, 'executado', {
            operador: operadorNome,
            totalContatos: clientesSugeridos.slice(0, 30).length,
            msg: resultadoLote.msg,
          });
          return {
            success: true,
            msg: `Lote oficial de autocobrança agendado com sucesso para ${clientesSugeridos.slice(0, 30).length} clientes!`,
          };
        } else {
          await this.finalizarLockAutocobranca(lockId, 'erro', {
            operador: operadorNome,
            msg: resultadoLote.msg,
          });
          return { success: false, msg: resultadoLote.msg };
        }
      } else if (tipoAcao === 'recuperacao_erros_avulso') {
        // Recuperação de Saldo de Erros via Disparo Avulso
        // Trava rigorosa anti-bug: NUNCA disparar para centenas de celulares (máximo 30)
        const clientesSeguros = clientesSugeridos.slice(0, 30);
        let enviados = 0;
        let falhas = 0;

        for (const cliente of clientesSeguros) {
          const tel = cliente.phone || cliente.phone_api;
          if (tel) {
            try {
              const res = await this.sendIndividualCollection(cliente, tel);
              if (res.success) {
                enviados++;
              } else {
                falhas++;
              }
            } catch {
              falhas++;
            }
            // Throttling anti-bloqueio WhatsApp / Meta (1.5s entre disparos avulsos)
            await new Promise((resolve) => setTimeout(resolve, 1500));
          }
        }

        const db = getRealtimeDatabase();
        if (db) {
          try {
            await set(ref(db, `inadimplencia_locks/autocobranca_recuperacao_${hojeYmd}`), {
              status: 'executado',
              timestamp: Date.now(),
              operador: operadorNome,
              enviados,
              falhas,
              totalContatos: clientesSeguros.length,
            });
          } catch {}
        }

        await this.finalizarLockAutocobranca(lockId, 'executado', {
          operador: operadorNome,
          totalContatos: enviados,
          msg: `${enviados} cobranças avulsas de recuperação de erros disparadas com sucesso`,
        });

        return {
          success: true,
          msg: `${enviados} clientes suplentes cobrados com sucesso para preencher os erros do lote de hoje!`,
        };
      } else {
        // Envio Cirúrgico de Sábado (Cobranças Avulsas usando estritamente o Template Oficial com Throttling Anti-Spam)
        let enviados = 0;
        for (const cliente of clientesSugeridos) {
          const tel = cliente.phone || cliente.phone_api;
          if (tel) {
            await this.sendIndividualCollection(cliente, tel);
            enviados++;
            // Throttling anti-bloqueio WhatsApp / Meta (1.5s entre disparos avulsos)
            await new Promise((resolve) => setTimeout(resolve, 1500));
          }
        }

        await this.finalizarLockAutocobranca(lockId, 'executado', {
          operador: operadorNome,
          totalContatos: enviados,
          msg: `${enviados} cobranças avulsas de sábado disparadas com sucesso`,
        });

        return {
          success: true,
          msg: `${enviados} cobranças avulsas de sábado executadas com o template oficial!`,
        };
      }
    } catch (e: any) {
      await this.finalizarLockAutocobranca(hojeYmd, 'erro', {
        operador: operadorNome,
        msg: e?.message || 'Erro inesperado na autocobrança',
      });
      return { success: false, msg: `Falha na autocobrança: ${e?.message || 'Erro desconhecido'}` };
    }
  }

  // Obter cookie ativo dinamicamente (Firebase RTDB -> Auto-Login Oficial com Inicialização de Loja)
  static async getCookie(forceRefresh = false): Promise<string> {
    if (!forceRefresh && this.cachedCookie && this.cachedCookie.trim()) {
      return this.cachedCookie.trim();
    }
    try {
      // 1. Tenta carregar do Firebase Realtime Database (Nuvem compartilhada)
      if (!forceRefresh) {
        const db = getRealtimeDatabase();
        if (db) {
          const snap = await get(ref(db, 'inadimplencia_cookie'));
          if (snap.exists()) {
            const val = snap.val();
            if (typeof val === 'string' && val.trim()) {
              this.cachedCookie = val.trim();
              return this.cachedCookie;
            }
          }
        }
      }

      // 2. Tenta renovação dinâmica completa via auto-login oficial no BackOffice
      const novoCookie = await this.login();
      if (novoCookie && novoCookie.trim()) {
        this.cachedCookie = novoCookie.trim();
        return this.cachedCookie;
      }

      return '';
    } catch {
      return '';
    }
  }

  // Salvar cookie dinâmico no Firebase Realtime Database
  static async saveCookie(cookie: string): Promise<void> {
    const clean = cookie.trim();
    this.cachedCookie = clean;
    if (clean) {
      try {
        const db = getRealtimeDatabase();
        if (db) {
          await set(ref(db, 'inadimplencia_cookie'), clean);
        }
      } catch {
        // no-op
      }
    }
  }

  static async getTelefonesCustomizados(): Promise<Record<string, string>> {
    try {
      const db = getRealtimeDatabase();
      if (db) {
        const snap = await get(ref(db, 'inadimplencia_telefones_loja27'));
        if (snap.exists()) {
          const val = snap.val();
          if (val && typeof val === 'object') return val;
        }
      }
      return {};
    } catch {
      return {};
    }
  }

  static async salvarTelefoneCliente(cpf: string, novoTelefone: string): Promise<void> {
    const cleanCpf = cpf.replace(/\D/g, '');
    const cleanPhone = novoTelefone.trim();
    try {
      const db = getRealtimeDatabase();
      if (db) {
        await set(ref(db, `inadimplencia_telefones_loja27/${cleanCpf}`), cleanPhone);
        // Propagação inteligente em cascata: atualiza a carteira master viva na nuvem imediatamente
        await set(ref(db, `inadimplencia_carteira_loja27/${cleanCpf}/phone`), cleanPhone);
        await set(ref(db, `inadimplencia_carteira_loja27/${cleanCpf}/phone_api`), cleanPhone);
        await set(ref(db, `inadimplencia_carteira_loja27/${cleanCpf}/has_valid_phone`), true);
        await set(ref(db, `inadimplencia_carteira_loja27/${cleanCpf}/status`), 'fila');
        await remove(ref(db, `inadimplencia_erros_loja27/${cleanCpf}`));
      }
    } catch {
      // no-op
    }

    await this.registrarEventoHistoricoCliente(cleanCpf, {
      tipo: 'ATUALIZACAO_TELEFONE',
      titulo: 'Telefone Cadastral Atualizado',
      descricao: `Contato atualizado para ${cleanPhone}`,
      detalhes: {
        phone: cleanPhone,
        operador: 'DEV SQUIRREL',
      },
    });
  }

  static async getAgendamentosLocais(): Promise<GrupoAgendamento[]> {
    try {
      const db = getRealtimeDatabase();
      if (db) {
        const snap = await get(ref(db, 'inadimplencia_agendamentos_loja27'));
        if (snap.exists()) {
          const val = snap.val();
          if (Array.isArray(val)) return val;
          if (val && typeof val === 'object') return Object.values(val);
        }
      }
      return [];
    } catch {
      return [];
    }
  }

  /**
   * Realiza login via XMLHttpRequest no Android nativo (fetch redirect:'manual' é ignorado).
   * XHR segue o 302 automaticamente e armazena o PHPSESSID no cookie jar nativo.
   * Retorna o cookie extraído ou null em caso de falha.
   */
  private static _xhrLogin(authUrl: string, usuario: string, senha: string): Promise<string | null> {
    return new Promise((resolve) => {
      const body = `login=${encodeURIComponent(usuario)}&pswd=${encodeURIComponent(senha)}`;
      const xhr = new XMLHttpRequest();
      xhr.open('POST', authUrl, true);
      xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
      xhr.setRequestHeader('Referer', 'https://backoffice.unboxtech.com.br/UnBoxTech/index.php');
      xhr.withCredentials = true; // armazena cookies nativamente
      xhr.timeout = 15000;

      xhr.onload = () => {
        const finalUrl = xhr.responseURL || '';
        console.log(`[BackOffice Login XHR] status=${xhr.status}, responseURL=${finalUrl}`);

        // Verifica se redirecionou para a página de erro
        if (finalUrl.includes('erro') || finalUrl.includes('index.php?erro')) {
          console.warn(`[BackOffice Login XHR] Servidor rejeitou credenciais para ${usuario}: ${finalUrl}`);
          resolve(null);
          return;
        }

        // Tenta extrair PHPSESSID dos cabeçalhos de resposta
        const setCookie = xhr.getResponseHeader('Set-Cookie') || xhr.getResponseHeader('set-cookie') || '';
        const xSetCookie = xhr.getResponseHeader('x-set-cookie') || '';
        const allCookieHeaders = setCookie + '; ' + xSetCookie;
        const matches = [...allCookieHeaders.matchAll(/PHPSESSID=([^;,\s]+)/g)];
        if (matches.length > 0) {
          const cookie = `PHPSESSID=${matches[matches.length - 1][1]}`;
          console.log(`[BackOffice Login XHR] Cookie extraído dos headers: ${cookie}`);
          resolve(cookie);
          return;
        }

        // No Android nativo, os headers Set-Cookie da resposta 302 são consumidos
        // pelo redirect follower e armazenados no cookie jar nativo.
        // Precisamos extrair o PHPSESSID do cookie jar fazendo uma segunda requisição
        // que retornará os cookies armazenados nativamente nos headers de resposta.
        // Alternativa: verificar se a URL final indica sucesso (contém 'intranet')
        if (finalUrl.includes('intranet') || (xhr.status === 200 && !finalUrl.includes('erro'))) {
          console.log('[BackOffice Login XHR] Login bem-sucedido detectado via URL final. Extraindo cookie do jar nativo...');
          // Faz uma requisição GET simples com withCredentials para que o cookie jar
          // envie o PHPSESSID automaticamente. Usamos a intranet que já foi carregada.
          const probeXhr = new XMLHttpRequest();
          probeXhr.open('GET', 'https://backoffice.unboxtech.com.br/UnBoxTech/modulos/intranet/index.php', true);
          probeXhr.withCredentials = true;
          probeXhr.timeout = 10000;
          probeXhr.onload = () => {
            // O cookie jar nativo enviou o PHPSESSID automaticamente nessa requisição.
            // Mesmo que não consigamos ler o header de resposta, o cookie está no jar.
            // Tentamos extrair do Document.cookie ou dos headers de resposta.
            const probeCookie = probeXhr.getResponseHeader('Set-Cookie') || '';
            const probeMatches = [...probeCookie.matchAll(/PHPSESSID=([^;,\s]+)/g)];
            if (probeMatches.length > 0) {
              const cookie = `PHPSESSID=${probeMatches[probeMatches.length - 1][1]}`;
              console.log(`[BackOffice Login XHR] Cookie extraído do probe: ${cookie}`);
              resolve(cookie);
              return;
            }

            // Em último recurso: tenta capturar das response headers via getAllResponseHeaders
            const allHeaders = probeXhr.getAllResponseHeaders() || '';
            const phpMatch = allHeaders.match(/PHPSESSID=([^;,\s\r\n]+)/);
            if (phpMatch) {
              const cookie = `PHPSESSID=${phpMatch[1]}`;
              console.log(`[BackOffice Login XHR] Cookie extraído via getAllResponseHeaders: ${cookie}`);
              resolve(cookie);
              return;
            }

            // Se não conseguimos extrair o header, o cookie ESTÁ no jar nativo.
            // Retornamos um sentinel especial que indica "usar credentials: include"
            console.log('[BackOffice Login XHR] Cookie no jar nativo (não extraível via header). Usando NATIVE_JAR.');
            resolve('NATIVE_COOKIE_JAR');
          };
          probeXhr.onerror = () => {
            console.log('[BackOffice Login XHR] Probe falhou, mas login foi bem-sucedido. Usando NATIVE_JAR.');
            resolve('NATIVE_COOKIE_JAR');
          };
          probeXhr.ontimeout = () => {
            console.log('[BackOffice Login XHR] Probe timeout, mas login foi bem-sucedido. Usando NATIVE_JAR.');
            resolve('NATIVE_COOKIE_JAR');
          };
          probeXhr.send();
          return;
        }

        // Login falhou ou não conseguimos determinar
        console.warn(`[BackOffice Login XHR] Não foi possível determinar resultado. status=${xhr.status}, url=${finalUrl}`);
        resolve(null);
      };

      xhr.onerror = () => {
        console.error(`[BackOffice Login XHR] Erro na requisição para ${usuario}`);
        resolve(null);
      };
      xhr.ontimeout = () => {
        console.error(`[BackOffice Login XHR] Timeout na requisição para ${usuario}`);
        resolve(null);
      };
      xhr.send(body);
    });
  }

  // Auto-Login e renovação transparente no BackOffice com vinculação à Loja 27 - C. PURUPURU
  static async login(usuarioParam?: string, senhaParam?: string): Promise<string | null> {
    if (!isHorarioComercial()) {
      console.warn('[BackOffice Login] Bloqueado: Fora do horário comercial (06:00 às 18:00).');
      return null;
    }
    try {
      let usuario = usuarioParam?.trim() || '';
      let senha = senhaParam?.trim() || '';

      if (!usuario || !senha) {
        const creds = await getBackofficeCredentials();
        usuario = usuario || creds.user;
        senha = senha || creds.pass;
      }

      if (!usuario || !senha) {
        console.warn('[BackOffice Login] Usuário ou senha não fornecidos.');
        return null;
      }

      // Persiste as credenciais imediatamente no dispositivo
      await saveBackofficeCredentials(usuario, senha);

      // Mapeamento resiliente de credenciais da Loja 27 (Purupuru)
      const usuariosTentativa: string[] = [];
      const cleanUser = usuario.toUpperCase();
      usuariosTentativa.push(cleanUser);
      if (usuario.toLowerCase() === 'wini' || usuario.toLowerCase().includes('1lucas1apk')) {
        if (!usuariosTentativa.includes('LUCASR')) usuariosTentativa.unshift('LUCASR');
      } else if (!usuariosTentativa.includes('LUCASR')) {
        usuariosTentativa.push('LUCASR');
      }

      let novoCookie: string | null = null;
      const authUrl = getBackofficeAuthUrl();
      const isNative = Platform.OS !== 'web';

      for (const u of usuariosTentativa) {
        console.log(`[BackOffice Login] Tentando autenticar com login: ${u}... (${isNative ? 'XHR nativo' : 'fetch/proxy'})`);

        try {
          if (isNative) {
            // ========== ANDROID / iOS: XMLHttpRequest ==========
            // fetch com redirect:'manual' não funciona no Android nativo.
            // XHR segue o 302 automaticamente e armazena cookies no jar nativo.
            const directAuthUrl = `https://backoffice.unboxtech.com.br/UnBoxTech/config/auth.php`;
            novoCookie = await this._xhrLogin(directAuthUrl, u, senha);
            if (novoCookie) {
              console.log(`[BackOffice Login] ✅ Autenticação nativa bem-sucedida para ${u}: ${novoCookie}`);
              break;
            }
          } else {
            // ========== WEB (Metro Proxy): fetch com JSON response ==========
            const body = new URLSearchParams({ login: u, pswd: senha }).toString();
            const resp = await fetch(authUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
                Referer: 'https://backoffice.unboxtech.com.br/UnBoxTech/index.php',
              },
              body,
              redirect: 'manual',
            });

            const loc = resp.headers.get('location') || '';
            console.log(`[BackOffice Login] Resposta auth.php para ${u}: status=${resp.status}, location=${loc}`);

            // 1. Tenta ler resposta JSON estruturada (proxy dev do Metro retorna JSON)
            try {
              const data = await resp.clone().json();
              if (data && data.cookie) {
                novoCookie = data.cookie;
                console.log(`[BackOffice Login] Cookie recebido via proxy JSON para ${u}: ${novoCookie}`);
                break;
              }
            } catch {
              // não é JSON
            }

            // 2. Extrai cabeçalhos Set-Cookie da resposta 302
            if (!loc.includes('erro')) {
              const rawCookie = resp.headers.get('x-set-cookie') || resp.headers.get('set-cookie') || '';
              const matches = [...rawCookie.matchAll(/PHPSESSID=([^;,\s]+)/g)];
              if (matches.length > 0) {
                novoCookie = `PHPSESSID=${matches[matches.length - 1][1]}`;
                console.log(`[BackOffice Login] Sessão autenticada extraída com sucesso para ${u}: ${novoCookie}`);
                break;
              }
            } else {
              console.warn(`[BackOffice Login] Servidor rejeitou credenciais para ${u}: ${loc}`);
            }
          }
        } catch (fetchErr) {
          console.error(`[BackOffice Login] Erro na requisição HTTP para ${u}:`, fetchErr);
        }
      }

      if (!novoCookie) {
        console.error('[BackOffice Login] ❌ Falha na autenticação. Verifique usuário e senha.');
        return null;
      }

      // Se o cookie está no jar nativo (Android), as requisições subsequentes
      // com credentials:'include' ou withCredentials=true já terão o PHPSESSID.
      // Mas para manter compatibilidade com o sistema de cookie explícito,
      // precisamos extraí-lo em algum momento.
      const isNativeJar = novoCookie === 'NATIVE_COOKIE_JAR';

      const baseUrl = getBackofficeBaseUrl();
      const serverRoot = baseUrl.replace(/\/modulos\/.*$/, '');

      // Passo 2: Inicializa a sessão na Intranet (vincula permissões)
      try {
        console.log('[BackOffice Login] Vinculando sessão na Intranet...');
        if (isNativeJar) {
          // No Android, usa XHR com withCredentials para enviar o cookie do jar
          await new Promise<void>((resolve) => {
            const xhr = new XMLHttpRequest();
            xhr.open('GET', 'https://backoffice.unboxtech.com.br/UnBoxTech/modulos/intranet/index.php', true);
            xhr.withCredentials = true;
            xhr.timeout = 10000;
            xhr.onload = () => {
              // Tenta extrair o PHPSESSID da resposta dessa requisição
              const allHeaders = xhr.getAllResponseHeaders() || '';
              const phpMatch = allHeaders.match(/PHPSESSID=([^;,\s\r\n]+)/);
              if (phpMatch && isNativeJar) {
                novoCookie = `PHPSESSID=${phpMatch[1]}`;
                console.log(`[BackOffice Login] Cookie extraído na etapa Intranet: ${novoCookie}`);
              }
              resolve();
            };
            xhr.onerror = () => resolve();
            xhr.ontimeout = () => resolve();
            xhr.send();
          });
        } else {
          await fetch(`${serverRoot}/modulos/intranet/index.php`, {
            headers: {
              cookie: novoCookie,
              'x-backoffice-cookie': novoCookie,
              Referer: `${serverRoot}/index.php`,
            },
          });
        }
      } catch (err) {
        console.warn('[BackOffice Login] Aviso ao inicializar Intranet:', err);
      }

      // Passo 3: Inicializa o módulo inadimplencia_loja com o parâmetro de loja
      try {
        console.log('[BackOffice Login] Vinculando sessão à Loja 27 (C. PURUPURU)...');
        if (isNativeJar) {
          await new Promise<void>((resolve) => {
            const xhr = new XMLHttpRequest();
            xhr.open('GET', 'https://backoffice.unboxtech.com.br/UnBoxTech/modulos/inadimplencia_loja/index.php?loja=C.+PURUPURU', true);
            xhr.withCredentials = true;
            xhr.timeout = 10000;
            xhr.onload = () => {
              // Última tentativa de extrair PHPSESSID
              if (novoCookie === 'NATIVE_COOKIE_JAR') {
                const allHeaders = xhr.getAllResponseHeaders() || '';
                const phpMatch = allHeaders.match(/PHPSESSID=([^;,\s\r\n]+)/);
                if (phpMatch) {
                  novoCookie = `PHPSESSID=${phpMatch[1]}`;
                  console.log(`[BackOffice Login] Cookie extraído na etapa Loja: ${novoCookie}`);
                }
              }
              resolve();
            };
            xhr.onerror = () => resolve();
            xhr.ontimeout = () => resolve();
            xhr.send();
          });
        } else {
          await fetch(`${serverRoot}/modulos/inadimplencia_loja/index.php?loja=C.+PURUPURU`, {
            headers: {
              cookie: novoCookie,
              'x-backoffice-cookie': novoCookie,
              Referer: `${serverRoot}/modulos/intranet/index.php`,
            },
          });
        }
      } catch (err) {
        console.warn('[BackOffice Login] Aviso ao inicializar Inadimplência Loja:', err);
      }

      // Se ainda temos NATIVE_COOKIE_JAR sem cookie explícito, precisamos
      // modificar as requisições do BackOffice para usar credentials:'include'.
      // Por agora, salvamos um sentinel para que getCookie() saiba usar o jar nativo.
      if (novoCookie === 'NATIVE_COOKIE_JAR') {
        console.warn('[BackOffice Login] ⚠️ Cookie não extraível dos headers. Usando jar nativo com credentials:include.');
      }

      // Salva o cookie com sessão pronta diretamente no Firebase Realtime Database
      await this.saveCookie(novoCookie!);
      console.log(`[BackOffice Login] ✅ Sessão da Loja 27 sincronizada com a nuvem! Cookie: ${novoCookie}`);
      return novoCookie;
    } catch (err) {
      console.error('[BackOffice Login] Erro inesperado no fluxo de login:', err);
      return null;
    }
  }

  /**
   * Grava evento na linha do tempo histórica do cliente no Firebase Realtime Database
   */
  static async registrarEventoHistoricoCliente(
    cpf: string,
    evento: Omit<EventoHistoricoCliente, 'id' | 'dataIso' | 'dataHora'>
  ): Promise<void> {
    const cleanCpf = cpf.replace(/\D/g, '');
    if (!cleanCpf) return;
    try {
      const db = getRealtimeDatabase();
      if (db) {
        const agora = Date.now();
        const dataIso = new Date(agora).toISOString();
        const dataHora = new Date(agora).toLocaleString('pt-BR', { timeZone: 'America/Manaus' });
        const id = `HIST-${agora}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

        const eventoCompleto: EventoHistoricoCliente = {
          id,
          dataIso,
          dataHora,
          ...evento,
        };

        await set(ref(db, `inadimplencia_historico_clientes/${cleanCpf}/${id}`), eventoCompleto);
      }
    } catch {
      // no-op
    }
  }

  /**
   * Busca a linha do tempo completa de um cliente específico no Firebase Realtime Database
   */
  static async getHistoricoCliente(cpf: string): Promise<EventoHistoricoCliente[]> {
    const cleanCpf = cpf.replace(/\D/g, '');
    if (!cleanCpf) return [];
    try {
      const db = getRealtimeDatabase();
      if (db) {
        const snap = await get(ref(db, `inadimplencia_historico_clientes/${cleanCpf}`));
        if (snap.exists()) {
          const val = snap.val();
          if (val && typeof val === 'object') {
            const lista = Object.values(val) as EventoHistoricoCliente[];
            lista.sort((a, b) => b.dataIso.localeCompare(a.dataIso));
            return lista;
          }
        }
      }
      return [];
    } catch {
      return [];
    }
  }

  // Diagnóstico inteligente da causa raiz dos erros
  static diagnosticarErro(
    rawError: string, 
    statusProvedor?: string | number, 
    dataErro?: string,
    phone?: string
  ): DiagnosticoErro {
    const raw = String(rawError || '').trim();
    const lower = raw.toLowerCase();
    const telDiag = phone ? this.analisarTelefone(phone) : undefined;

    if (telDiag && telDiag.ddd === '20') {
      return {
        codigo: 'DDD_INEXISTENTE',
        titulo: 'DDD 20 Inválido (Erro Cadastral)',
        descricaoAmigavel: 'O número foi cadastrado com DDD 20, que não existe no Brasil. No Amazonas deve ser DDD 92 ou 97.',
        acaoSugerida: 'Atualizar o DDD para 92 (Manaus) ou 97 (Interior) e tentar novamente.',
        mensagemBruta: raw || 'Telefone com DDD inexistente (20)',
        statusProvedor: 400,
        dataErro,
        permiteReenvio: false,
        requerAtualizacaoCadastral: true,
        telefoneAnalisado: telDiag,
      };
    }

    if (telDiag && telDiag.isDddInexistente) {
      return {
        codigo: 'DDD_INEXISTENTE',
        titulo: `DDD ${telDiag.ddd} Inexistente no Brasil`,
        descricaoAmigavel: `O DDD informado (${telDiag.ddd}) não pertence a nenhum estado brasileiro.`,
        acaoSugerida: 'Solicitar confirmação do telefone com o cliente ou avalista e atualizar no sistema.',
        mensagemBruta: raw || `DDD inválido: ${telDiag.ddd}`,
        statusProvedor: 400,
        dataErro,
        permiteReenvio: false,
        requerAtualizacaoCadastral: true,
        telefoneAnalisado: telDiag,
      };
    }

    if (
      lower.includes('no active account') || 
      lower.includes('nao tem conta ativa') || 
      lower.includes('não tem conta ativa') || 
      lower.includes('sem conta ativa') ||
      lower.includes('active account for this number') ||
      lower.includes('disconnected') || 
      lower.includes('status: disconnected') || 
      lower.includes('sem conexao') || 
      lower.includes('sem conexão') ||
      lower.includes('status: opening')
    ) {
      return {
        codigo: 'SEM_CONTA_WHATSAPP',
        titulo: 'Incontactável: Sem WhatsApp ou Número Inexistente',
        descricaoAmigavel: 'O WhatsApp da Clara Eletro está CONECTADO, porém este número específico do cliente não possui WhatsApp ativo, foi cancelado ou não recebe mensagens.',
        acaoSugerida: 'Não queimar cota dos 30 envios. Aplicar Trilha Presencial, Trava no PDV ou acionar referências/avalista.',
        mensagemBruta: raw,
        statusProvedor: statusProvedor || 'UNREACHABLE',
        dataErro,
        permiteReenvio: false,
        requerAtualizacaoCadastral: true,
        telefoneAnalisado: telDiag,
      };
    }

    if (lower.includes('err_internal_error') || statusProvedor === 500) {
      return {
        codigo: 'ERRO_INTERNO_PROVEDOR',
        titulo: 'Instabilidade no Provedor OneBox',
        descricaoAmigavel: 'O servidor intermediário da OneBox encontrou uma falha interna temporária ao tentar despachar a mensagem.',
        acaoSugerida: 'Tentar o reenvio avulso em instantes ou aguardar o ciclo de reprocessamento automático.',
        mensagemBruta: raw,
        statusProvedor: statusProvedor || 500,
        dataErro,
        permiteReenvio: true,
        requerAtualizacaoCadastral: false,
        telefoneAnalisado: telDiag,
      };
    }

    if (lower.includes('502 bad gateway') || lower.includes('504 gateway timeout') || statusProvedor === 502 || statusProvedor === 504) {
      return {
        codigo: 'GATEWAY_TIMEOUT',
        titulo: 'Instabilidade de Servidor (502 Gateway)',
        descricaoAmigavel: 'O gateway entre o BackOffice e os servidores do WhatsApp oscilou durante o disparo.',
        acaoSugerida: 'O sistema reprocessará automaticamente ou você pode disparar individualmente agora.',
        mensagemBruta: raw,
        statusProvedor: statusProvedor || 502,
        dataErro,
        permiteReenvio: true,
        requerAtualizacaoCadastral: false,
        telefoneAnalisado: telDiag,
      };
    }

    if (lower.includes('err_subscription_check_failed') || statusProvedor === 402) {
      return {
        codigo: 'ASSINATURA_EXPIRADA',
        titulo: 'Licença do Provedor Pendente',
        descricaoAmigavel: 'A conta de mensageria da loja atingiu o limite contratado ou requer renovação de assinatura na OneBox.',
        acaoSugerida: 'Notificar o setor de TI ou gerência para regularizar o plano de mensageria.',
        mensagemBruta: raw,
        statusProvedor: statusProvedor || 402,
        dataErro,
        permiteReenvio: false,
        requerAtualizacaoCadastral: false,
        telefoneAnalisado: telDiag,
      };
    }

    if (lower.includes('regularizado') || lower.includes('fora da inadimplencia')) {
      return {
        codigo: 'CLIENTE_REGULARIZADO',
        titulo: 'Cliente já Quitado',
        descricaoAmigavel: 'O cliente já realizou a baixa do carnê no PDV e não está mais em atraso.',
        acaoSugerida: 'Nenhuma cobrança necessária. O cliente já está liberado no caixa.',
        mensagemBruta: raw,
        statusProvedor: 200,
        dataErro,
        permiteReenvio: false,
        requerAtualizacaoCadastral: false,
        telefoneAnalisado: telDiag,
      };
    }

    return {
      codigo: 'ERRO_DESCONHECIDO',
      titulo: 'Erro no Envio',
      descricaoAmigavel: raw || 'Falha na comunicação com o servidor de envio de WhatsApp.',
      acaoSugerida: 'Verificar conexão e tentar novamente.',
      mensagemBruta: raw,
      statusProvedor,
      dataErro,
      permiteReenvio: true,
      requerAtualizacaoCadastral: false,
      telefoneAnalisado: telDiag,
    };
  }

  // Obter exclusões salvas na nuvem (Firebase RTDB prioritário)
  static async getExclusoes(): Promise<Record<string, ExclusaoTemporaria>> {
    try {
      const db = getRealtimeDatabase();
      if (db) {
        const snap = await get(ref(db, 'inadimplencia_exclusoes_loja27'));
        if (snap.exists()) {
          const val = snap.val();
          if (val && typeof val === 'object') {
            const agora = Date.now();
            const validas: Record<string, ExclusaoTemporaria> = {};
            const remocoes: Promise<any>[] = [];
            for (const [cpf, exc] of Object.entries(val as Record<string, ExclusaoTemporaria>)) {
              if (exc && exc.pausadoAte > agora) {
                validas[cpf] = exc;
              } else {
                remocoes.push(remove(ref(db, `inadimplencia_exclusoes_loja27/${cpf}`)));
              }
            }
            if (remocoes.length > 0) {
              await Promise.allSettled(remocoes);
            }
            return validas;
          }
        }
      }
      return {};
    } catch {
      return {};
    }
  }

  // Salvar exclusão temporária individual na nuvem
  static async salvarExclusao(
    cpf: string, 
    dias: number, 
    motivo: string, 
    operadorNome: string = 'Operador'
  ): Promise<ExclusaoTemporaria> {
    const cleanCpf = cpf.replace(/\D/g, '');
    const agora = Date.now();
    const pausadoAte = agora + dias * 24 * 60 * 60 * 1000;
    const dataFim = new Date(pausadoAte);
    const dia = String(dataFim.getDate()).padStart(2, '0');
    const mes = String(dataFim.getMonth() + 1).padStart(2, '0');
    const ano = dataFim.getFullYear();
    const pausadoAteFormatado = `${dia}/${mes}/${ano}`;

    const exclusao: ExclusaoTemporaria = {
      ativo: true,
      pausadoAte,
      pausadoAteFormatado,
      diasPausa: dias,
      motivo: motivo.trim() || 'Pausa manual de cobrança solicitada no caixa',
      operadorNome,
      criadoEm: agora,
    };

    try {
      const db = getRealtimeDatabase();
      if (db) {
        await set(ref(db, `inadimplencia_exclusoes_loja27/${cleanCpf}`), exclusao);
        await set(ref(db, `inadimplencia_carteira_loja27/${cleanCpf}/status`), 'pausado');
        await set(ref(db, `inadimplencia_carteira_loja27/${cleanCpf}/exclusao`), exclusao);
      }
    } catch {
      // no-op
    }

    await this.registrarEventoHistoricoCliente(cleanCpf, {
      tipo: 'MUDANCA_STATUS',
      titulo: `Cobrança Pausada (${dias} dias)`,
      descricao: `Pausa até ${pausadoAteFormatado}. Motivo: ${exclusao.motivo}`,
      detalhes: {
        statusAnterior: 'fila',
        statusNovo: 'pausado',
        operador: operadorNome,
        observacao: exclusao.motivo,
      },
    });

    return exclusao;
  }

  // Aplicar exclusão geral para múltiplos clientes na nuvem
  static async aplicarExclusaoGeral(
    cpfs: string[], 
    dias: number, 
    motivo: string, 
    operadorNome: string = 'Operador'
  ): Promise<number> {
    const agora = Date.now();
    const pausadoAte = agora + dias * 24 * 60 * 60 * 1000;
    const dataFim = new Date(pausadoAte);
    const dia = String(dataFim.getDate()).padStart(2, '0');
    const mes = String(dataFim.getMonth() + 1).padStart(2, '0');
    const ano = dataFim.getFullYear();
    const pausadoAteFormatado = `${dia}/${mes}/${ano}`;

    let count = 0;
    const db = getRealtimeDatabase();
    const mutacoes: Promise<any>[] = [];

    for (const rawCpf of cpfs) {
      const cleanCpf = rawCpf.replace(/\D/g, '');
      if (!cleanCpf) continue;
      const exc: ExclusaoTemporaria = {
        ativo: true,
        pausadoAte,
        pausadoAteFormatado,
        diasPausa: dias,
        motivo: motivo.trim() || 'Exclusão geral temporária',
        operadorNome,
        criadoEm: agora,
      };
      count++;
      if (db) {
        mutacoes.push(set(ref(db, `inadimplencia_exclusoes_loja27/${cleanCpf}`), exc));
        mutacoes.push(set(ref(db, `inadimplencia_carteira_loja27/${cleanCpf}/status`), 'pausado'));
        mutacoes.push(set(ref(db, `inadimplencia_carteira_loja27/${cleanCpf}/exclusao`), exc));
      }
    }

    if (mutacoes.length > 0) {
      await Promise.allSettled(mutacoes);
    }

    return count;
  }

  // Remover exclusão temporária na nuvem
  static async removerExclusao(cpf: string): Promise<void> {
    const cleanCpf = cpf.replace(/\D/g, '');
    try {
      const db = getRealtimeDatabase();
      if (db) {
        await remove(ref(db, `inadimplencia_exclusoes_loja27/${cleanCpf}`));
        await set(ref(db, `inadimplencia_carteira_loja27/${cleanCpf}/status`), 'fila');
        await remove(ref(db, `inadimplencia_carteira_loja27/${cleanCpf}/exclusao`));
      }
    } catch {
      // no-op
    }
  }

  // -------------------------------------------------------------
  // CAMADA INTRADAY D+1 E AUDITORIA COMPORTAMENTAL PERMANENTE
  // -------------------------------------------------------------

  /**
   * Grava evento imutável de auditoria no Firebase Realtime Database
   * para alimentar modelos preditivos e visão analítica global da loja
   */
  static async salvarEventoAuditoria(
    evento: Omit<EventoAuditoriaInadimplencia, 'id' | 'timestamp' | 'dataHoraFormatada'>
  ): Promise<EventoAuditoriaInadimplencia> {
    const agora = Date.now();
    const dataHoraFormatada = new Date(agora).toLocaleString('pt-BR', { timeZone: 'America/Manaus' });
    const id = `EVT-${agora}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

    const novoEvento: EventoAuditoriaInadimplencia = {
      ...evento,
      id,
      timestamp: agora,
      dataHoraFormatada,
    };

    try {
      const db = getRealtimeDatabase();
      if (db) {
        const sanitizedEvento = JSON.parse(JSON.stringify(novoEvento));
        await set(ref(db, `inadimplencia_eventos_auditoria_loja27/${id}`), sanitizedEvento);
      }
    } catch {
      // no-op
    }

    return novoEvento;
  }

  /**
   * Obter eventos de auditoria consolidados da nuvem (Firebase RTDB)
   */
  static async getEventosAuditoria(): Promise<EventoAuditoriaInadimplencia[]> {
    try {
      const db = getRealtimeDatabase();
      if (db) {
        const snap = await get(ref(db, 'inadimplencia_eventos_auditoria_loja27'));
        if (snap.exists()) {
          const val = snap.val();
          if (val && typeof val === 'object') {
            const lista = Object.values(val) as EventoAuditoriaInadimplencia[];
            lista.sort((a, b) => b.timestamp - a.timestamp);
            return lista;
          }
        }
      }
      return [];
    } catch {
      return [];
    }
  }

  /**
   * Obter pagamentos informados em loja aguardando compensação D+1 (Trava 48h na nuvem)
   */
  static async getPagamentosLojaD1(): Promise<Record<string, PagamentoLojaD1>> {
    try {
      const db = getRealtimeDatabase();
      if (db) {
        const snap = await get(ref(db, 'inadimplencia_pagamentos_d1_loja27'));
        if (snap.exists()) {
          const remotePags = snap.val();
          if (remotePags && typeof remotePags === 'object') {
            const agora = Date.now();
            const validos: Record<string, PagamentoLojaD1> = {};
            const remocoes: Promise<any>[] = [];
            for (const [cpf, p] of Object.entries(remotePags as Record<string, PagamentoLojaD1>)) {
              if (p && p.expiraEm > agora) {
                validos[cpf] = p;
              } else {
                remocoes.push(remove(ref(db, `inadimplencia_pagamentos_d1_loja27/${cpf}`)));
              }
            }
            if (remocoes.length > 0) {
              await Promise.allSettled(remocoes);
            }
            return validos;
          }
        }
      }
      return {};
    } catch {
      return {};
    }
  }

  /**
   * Registrar pagamento em loja física pelo operador (Trava anti-cobrança de 48h na nuvem)
   */
  static async registrarPagamentoLoja(
    cliente: ClienteInadimplente,
    valorInformado: number,
    operadorNome: string = 'Operador',
    observacao: string = ''
  ): Promise<{ success: boolean; msg: string }> {
    const cleanCpf = cliente.cpf_cnpj.replace(/\D/g, '');
    const agora = Date.now();
    const dataHoraFormatada = new Date(agora).toLocaleString('pt-BR', { timeZone: 'America/Manaus' });
    const expiraEm = agora + 48 * 60 * 60 * 1000; // 48 horas de trava estrita

    const pagamentoD1: PagamentoLojaD1 = {
      ativo: true,
      registradoEm: agora,
      registradoEmFormatado: dataHoraFormatada,
      expiraEm,
      valorInformado: Number(valorInformado || cliente.v_inadim),
      operadorNome,
      observacao: observacao.trim() || 'Pagamento recebido no balcão/caixa da Loja 27 Purupuru',
    };

    try {
      const db = getRealtimeDatabase();
      if (db) {
        await set(ref(db, `inadimplencia_pagamentos_d1_loja27/${cleanCpf}`), pagamentoD1);
        await set(ref(db, `inadimplencia_carteira_loja27/${cleanCpf}/statusCarteira`), 'AGUARDANDO_COMPENSACAO_D1');
        await set(ref(db, `inadimplencia_carteira_loja27/${cleanCpf}/pagamentoInformadoEm`), agora);
      }
    } catch {
      // no-op
    }

    // Registra evento permanente no log de auditoria da nuvem
    await this.salvarEventoAuditoria({
      cpf: cleanCpf,
      nomeCliente: cliente.nome_cliente,
      tipo: 'PAGAMENTO_INFORMADO_LOJA',
      operador: operadorNome,
      detalhes: {
        valorAnterior: cliente.v_inadim,
        valorPago: pagamentoD1.valorInformado,
        observacao: pagamentoD1.observacao,
      },
    });

    await this.registrarEventoHistoricoCliente(cleanCpf, {
      tipo: 'TRAVA_D1_ATIVADA',
      titulo: `Pagamento Informado (${toBrl(pagamentoD1.valorInformado)})`,
      descricao: `Cliente informou pagamento no balcão da loja. Blindagem D+1 ativada por 48h.`,
      detalhes: {
        valorAnterior: cliente.v_inadim,
        operador: operadorNome,
        observacao: pagamentoD1.observacao,
      },
    });

    return {
      success: true,
      msg: `Pagamento de ${toBrl(pagamentoD1.valorInformado)} registrado com sucesso! Trava de 48h ativada na nuvem: o cliente está blindado de qualquer cobrança até a compensação D+1 do BackOffice.`,
    };
  }

  /**
   * Remover trava de pagamento D+1 manualmente na nuvem
   */
  static async removerPagamentoLoja(cpf: string): Promise<void> {
    const cleanCpf = cpf.replace(/\D/g, '');
    try {
      const db = getRealtimeDatabase();
      if (db) {
        await remove(ref(db, `inadimplencia_pagamentos_d1_loja27/${cleanCpf}`));
        await set(ref(db, `inadimplencia_carteira_loja27/${cleanCpf}/status`), 'fila');
        await set(ref(db, `inadimplencia_carteira_loja27/${cleanCpf}/statusCarteira`), 'ATIVO');
        await remove(ref(db, `inadimplencia_carteira_loja27/${cleanCpf}/pagamentoLojaD1`));
      }
    } catch {
      // no-op
    }

    await this.registrarEventoHistoricoCliente(cleanCpf, {
      tipo: 'MUDANCA_STATUS',
      titulo: 'Trava D+1 Removida',
      descricao: 'Trava temporária de 48h cancelada. Cliente reativado na fila.',
    });
  }


  /**
   * MOTOR DE DIFF MATINAL D+1 (D-1 vs D)
   * Compara o estado salvo ontem no Firebase com a nova foto do BackOffice.
   * Rastreia quem quitou, quem amortizou e quem entrou sem perder nenhum histórico!
   */
  static async conciliarDiffD1(
    clientesAnterioresMap: Map<string, any>,
    novosClientesBackoffice: any[],
    operadorNome: string = 'SISTEMA_D1'
  ): Promise<{
    quitadosCount: number;
    amortizadosCount: number;
    novosCount: number;
    totalRecuperadoD1: number;
  }> {
    const db = getRealtimeDatabase();
    const agora = Date.now();
    let quitadosCount = 0;
    let amortizadosCount = 0;
    let novosCount = 0;
    let totalRecuperadoD1 = 0;
    const mutacoes: Promise<any>[] = [];

    const novosMap = new Map<string, any>();
    novosClientesBackoffice.forEach((c) => {
      const clean = String(c.cpf || c.cpf_cnpj || '').replace(/\D/g, '');
      if (clean) novosMap.set(clean, c);
    });

    const pagamentosD1 = await this.getPagamentosLojaD1();

    // 1. Analisa clientes que já estavam cadastrados no Firebase
    for (const [cleanCpf, anterior] of clientesAnterioresMap.entries()) {
      const vinadimAnterior = Number(anterior.v_inadim || 0);
      const novo = novosMap.get(cleanCpf);

      // CASO A: Cliente sumiu do BackOffice (ou v_inadim zerou) -> CONFIRMAÇÃO OFICIAL DE QUITAÇÃO D+1
      if (!novo || Number(novo.v_inadim || 0) <= 0) {
        if (vinadimAnterior > 0 && anterior.statusCarteira !== 'QUITADO') {
          quitadosCount++;
          totalRecuperadoD1 += vinadimAnterior;

          let ttpHoras: number | undefined = undefined;
          if (anterior.cobranca_ultimo_envio || anterior.ultimoDisparoEm) {
            const envioTimestamp = anterior.ultimoDisparoEm || new Date(anterior.cobranca_ultimo_envio).getTime();
            if (envioTimestamp > 0 && agora > envioTimestamp) {
              ttpHoras = Number(((agora - envioTimestamp) / (1000 * 60 * 60)).toFixed(1));
            }
          }

          if (db) {
            mutacoes.push(set(ref(db, `inadimplencia_carteira_loja27/${cleanCpf}/statusCarteira`), 'QUITADO'));
            mutacoes.push(set(ref(db, `inadimplencia_carteira_loja27/${cleanCpf}/v_inadim`), 0));
            mutacoes.push(set(ref(db, `inadimplencia_carteira_loja27/${cleanCpf}/dataUltimaQuitacao`), new Date().toISOString()));
            if (ttpHoras !== undefined) {
              mutacoes.push(set(ref(db, `inadimplencia_carteira_loja27/${cleanCpf}/ttpHoras`), ttpHoras));
            }
          }

          mutacoes.push(this.salvarEventoAuditoria({
            cpf: cleanCpf,
            nomeCliente: anterior.nome_cliente || anterior.nome || 'Cliente',
            tipo: 'CONFIRMACAO_QUITACAO_D1',
            operador: operadorNome,
            detalhes: {
              valorAnterior: vinadimAnterior,
              valorAtual: 0,
              valorPago: vinadimAnterior,
              ttpHoras,
              observacao: 'Baixa oficial compensada no D+1 do BackOffice',
            },
          }));

          mutacoes.push(this.registrarEventoHistoricoCliente(cleanCpf, {
            tipo: 'PAGAMENTO_CAIXA',
            titulo: 'Dívida Quitada (Baixa D+1)',
            descricao: `Quitação integral compensada no BackOffice. Débito de ${toBrl(vinadimAnterior)} zerado.`,
            detalhes: {
              valorAnterior: vinadimAnterior,
              valorNovo: 0,
              operador: operadorNome,
            },
          }));

          if (pagamentosD1[cleanCpf]) {
            mutacoes.push(this.removerPagamentoLoja(cleanCpf));
          }
        }
      }
      // CASO B: Cliente continua na base, mas seu débito diminuiu -> AMORTIZAÇÃO PARCIAL NO CAIXA
      else if (novo) {
        const vinadimNovo = Number(novo.v_inadim || 0);
        if (vinadimAnterior > vinadimNovo && vinadimNovo > 0) {
          const valorPago = Number((vinadimAnterior - vinadimNovo).toFixed(2));
          amortizadosCount++;
          totalRecuperadoD1 += valorPago;

          if (db) {
            mutacoes.push(set(ref(db, `inadimplencia_carteira_loja27/${cleanCpf}/statusCarteira`), 'AMORTIZADO'));
            mutacoes.push(set(ref(db, `inadimplencia_carteira_loja27/${cleanCpf}/v_inadim`), vinadimNovo));
            mutacoes.push(set(ref(db, `inadimplencia_carteira_loja27/${cleanCpf}/dataUltimaAmortizacao`), new Date().toISOString()));
          }

          mutacoes.push(this.salvarEventoAuditoria({
            cpf: cleanCpf,
            nomeCliente: anterior.nome_cliente || anterior.nome || 'Cliente',
            tipo: 'AMORTIZACAO_D1',
            operador: operadorNome,
            detalhes: {
              valorAnterior: vinadimAnterior,
              valorAtual: vinadimNovo,
              valorPago,
              observacao: 'Amortização parcial compensada no D+1 do BackOffice',
            },
          }));

          mutacoes.push(this.registrarEventoHistoricoCliente(cleanCpf, {
            tipo: 'PAGAMENTO_CAIXA',
            titulo: 'Amortização Parcial no Caixa',
            descricao: `Amortização de ${toBrl(valorPago)} compensada no BackOffice. Débito reduzido de ${toBrl(vinadimAnterior)} para ${toBrl(vinadimNovo)}.`,
            detalhes: {
              valorAnterior: vinadimAnterior,
              valorNovo: vinadimNovo,
              operador: operadorNome,
            },
          }));
        }
      }
    }

    // 2. Analisa clientes novos que entraram no BackOffice hoje
    for (const [cleanCpf, novo] of novosMap.entries()) {
      if (!clientesAnterioresMap.has(cleanCpf)) {
        novosCount++;
        mutacoes.push(this.salvarEventoAuditoria({
          cpf: cleanCpf,
          nomeCliente: novo.nome_cliente || novo.nome || 'Cliente',
          tipo: 'DIVIDA_DETECTADA',
          operador: operadorNome,
          detalhes: {
            valorAtual: Number(novo.v_inadim || 0),
            diasAtraso: Number(novo.atraso_dias || 15),
            observacao: 'Entrada na base de inadimplência da Loja 27',
          },
        }));

        mutacoes.push(this.registrarEventoHistoricoCliente(cleanCpf, {
          tipo: 'REGISTRO_INICIAL',
          titulo: 'Entrada na Carteira de Inadimplência',
          descricao: `Cliente entrou na inadimplência com débito de ${toBrl(Number(novo.v_inadim || 0))} (${Number(novo.atraso_dias || 15)} dias de atraso).`,
          detalhes: {
            valorNovo: Number(novo.v_inadim || 0),
            diasAtrasoNovo: Number(novo.atraso_dias || 15),
            operador: operadorNome,
          },
        }));
      }
    }

    if (mutacoes.length > 0) {
      await Promise.allSettled(mutacoes);
    }

    return { quitadosCount, amortizadosCount, novosCount, totalRecuperadoD1 };
  }

  // Buscar clientes do BackOffice filtrados para a loja 27 - C. PURUPURU (Total: R$ 234.226,68)
  static async fetchClientesData(
    scheduleGroupsInput?: GrupoAgendamento[],
    forceRefresh = false,
    onProgress?: (step: string, percent: number) => void
  ): Promise<{
    clientes: ClienteInadimplente[];
    metricas: InadimplenciaMetricas;
    fromCache: boolean;
  }> {
    onProgress?.('Carregando base consolidada na Nuvem...', 10);
    let cookie = await this.getCookie();
    let rawClientes: any[] = [];
    let isLive = false;
    const db = getRealtimeDatabase();
    const baseUrl = getBackofficeBaseUrl();
    const hojeYmd = getHojeDataYmd();

    // 1. CARREGA O ESTADO MESTRE SALVO NO FIREBASE REALTIME DATABASE (Fonte da Verdade Viva na Nuvem)
    const clientesAnterioresMap = new Map<string, any>();
    let dbMetricas: Partial<InadimplenciaMetricas> | null = null;
    let dbSyncMeta: any = null;
    const errosPorCpf: Record<string, { rawMsg: string; dataErro?: string; status?: string; phone?: string }> = {};
    const infoExplorarPorCpf: Record<string, {
      atraso_ref?: number;
      phone?: string;
      phone_api?: string;
      has_valid_phone?: boolean;
      sent_24h?: boolean;
      queue_status?: string;
      queue_sent_at?: string;
    }> = {};

    if (db) {
      try {
        const [snapCarteira, snapMetricas, snapErros, snapMeta] = await Promise.all([
          get(ref(db, 'inadimplencia_carteira_loja27')),
          get(ref(db, 'inadimplencia_metricas_loja27')),
          get(ref(db, 'inadimplencia_erros_loja27')),
          get(ref(db, 'inadimplencia_sync_metadata')),
        ]);
        if (snapCarteira.exists()) {
          const val = snapCarteira.val();
          if (val && typeof val === 'object') {
            Object.entries(val).forEach(([k, v]: [string, any]) => {
              clientesAnterioresMap.set(k, v);
            });
          }
        }
        if (snapMetricas.exists()) {
          dbMetricas = snapMetricas.val();
        }
        if (snapErros.exists()) {
          const val = snapErros.val();
          if (val && typeof val === 'object') {
            Object.assign(errosPorCpf, val);
          }
        }
        if (snapMeta.exists()) {
          dbSyncMeta = snapMeta.val();
        }
      } catch {
        // no-op
      }
    }

    // 2. VERIFICAÇÃO DE HORÁRIO COMERCIAL E LAZY CLOUD-FIRST INTELIGENTE
    // O BackOffice da Clara Eletro opera exclusivamente de Segunda a Sábado das 06:00 às 18:00.
    // Fora desse horário comercial (noites e domingos), o BackOffice fica offline e rejeita requisições com 422.
    // Portanto, fora do expediente OU se os dados já forem do mesmo dia (lazy cache),
    // consome 100% dos dados consolidados no Firebase Realtime Database sem bater em nenhuma API externa!
    const foraComercial = !isHorarioComercial();
    const isSameDay = dbSyncMeta?.last_sync_date === hojeYmd;
    const hasData = clientesAnterioresMap.size > 0;
    const shouldSkipBackoffice = !forceRefresh && (foraComercial || (isSameDay && hasData && dbMetricas !== null));

    let dailyMetrics = dbMetricas?.cotaDiaria || { enviados: 0, consumido: 0, limite: 30, restantes: 30, dataReferencia: 'Hoje' };
    let critJsonLive: any = null;
    let colJsonLive: any = null;
    let pagJsonLive: any = null;
    let expFilaJsonLive: any = null;
    let aiRadarJsonLive: any = null;
    let syncJsonLive: any = null;

    if (shouldSkipBackoffice) {
      // Reutiliza os dados persistidos na nuvem sem requisições desnecessárias
      rawClientes = Array.from(clientesAnterioresMap.values());
      isLive = false;
      onProgress?.('Dados atualizados da Nuvem prontos!', 100);
    } else {
      // VIRADA DE DIA (D+0 -> D+1), FORCE REFRESH MANUAL OU BANCO VAZIO: CONSULTA OFICIAL COMPLETA AO BACKOFFICE
      onProgress?.('Conectando e autenticando no BackOffice Clara Eletro...', 25);
      const requestApis = async (ck: string) => {
        const headers = buildBackofficeHeaders(ck, {
          accept: 'application/json, text/plain, */*',
          Referer: `${baseUrl}/index.php`,
        });

        return Promise.allSettled([
          fetchWithTimeout(
            `${baseUrl}/api/clients_data.php?tipo=Todos&tipo_documento=Todos&periodo=Todos&safra=Todos&cpf=`,
            { headers },
            20000
          ),
          fetchWithTimeout(
            `${baseUrl}/api/store_criticidade.php?tipo=Todos&tipo_documento=Todos&periodo=Todos&safra=Todos&cpf=`,
            { headers },
            15000
          ),
          fetchWithTimeout(`${baseUrl}/api/collection_metrics.php`, { headers }, 15000),
          fetchWithTimeout(`${baseUrl}/api/pagamento_dia_cache.php`, { headers }, 15000),
          fetchWithTimeout(
            `${baseUrl}/api/explorar_devedores.php?action=top_clients_explore_list&tab=fila&page=1&per_page=200&search=&safra=Todos&sort_key=valor_ref&sort_dir=desc`,
            { headers },
            15000
          ),
          fetchWithTimeout(
            `${baseUrl}/api/explorar_devedores.php?action=top_clients_explore_list&tab=fila&page=2&per_page=200&search=&safra=Todos&sort_key=valor_ref&sort_dir=desc`,
            { headers },
            15000
          ),
          fetchWithTimeout(
            `${baseUrl}/api/explorar_devedores.php?action=top_clients_explore_list&tab=erro&page=1&per_page=200`,
            { headers },
            15000
          ),
          fetchWithTimeout(`${baseUrl}/api/ai_radar_summary.php?loja=C.+PURUPURU`, { headers }, 30000),
          fetchWithTimeout(`${baseUrl}/api/check_sync_status.php`, { headers }, 15000),
        ]);
      };

      try {
        onProgress?.('Baixando carteira oficial Loja 27 (C. Purupuru)...', 40);
        let results = await requestApis(cookie);
        onProgress?.('Processando contratos e métricas oficiais...', 65);

        // 1. Processa clients_data.php diretamente da API oficial
        // 1. Processa clients_data.php diretamente da API oficial
        let cJson: any = null;
        if (results[0].status === 'fulfilled' && results[0].value.ok) {
          try {
            cJson = await results[0].value.json();
          } catch {
            // Resposta não era JSON válido (ex: redirecionado para HTML de login)
          }
        }

        // 2. Processa store_criticidade.php
        if (results[1].status === 'fulfilled' && results[1].value.ok) {
          try {
            critJsonLive = await results[1].value.json();
          } catch {}
        }

        // 3. Processa collection_metrics.php
        if (results[2].status === 'fulfilled' && results[2].value.ok) {
          try {
            colJsonLive = await results[2].value.json();
          } catch {}
        }

        // Se a resposta indicar sessão expirada ou inválida:
        // Sem cookies válidos, store_criticidade retorna { success: false, msg: "Loja do usuario nao definida" }
        // e clients_data retorna filters.loja === "Todos" (trazendo a rede estadual inteira em vez da Loja 27)
        const isSessionExpired = 
          !cJson || 
          !cJson.success || 
          !Array.isArray(cJson.clientes) || 
          cJson.clientes.length === 0 || 
          cJson.filters?.loja === 'Todos' || 
          (critJsonLive && critJsonLive.success === false && String(critJsonLive.msg || '').includes('Loja'));

        if (isSessionExpired) {
          onProgress?.('Sessão expirada. Autenticando com credenciais salvas...', 45);
          const novoCookie = await this.login();
          if (novoCookie) {
            cookie = novoCookie;
            results = await requestApis(cookie);
            if (results[0].status === 'fulfilled' && results[0].value.ok) {
              try { cJson = await results[0].value.json(); } catch {}
            }
            if (results[1].status === 'fulfilled' && results[1].value.ok) {
              try { critJsonLive = await results[1].value.json(); } catch {}
            }
            if (results[2].status === 'fulfilled' && results[2].value.ok) {
              try { colJsonLive = await results[2].value.json(); } catch {}
            }
          }
        }

        // Se após a tentativa de login a resposta ainda for da rede global (loja: Todos) ou sem sessão,
        // NUNCA aceita gravar os 17 mil clientes nem dados corrompidos na Loja 27!
        const sessionStillInvalid = 
          !cJson || 
          !cJson.success || 
          cJson.filters?.loja === 'Todos' || 
          (critJsonLive && critJsonLive.success === false);

        if (sessionStillInvalid) {
          console.warn('[BackOffice] Sem sessão autenticada ou Loja não identificada. Mantendo base protegida do Firebase.');
          rawClientes = Array.from(clientesAnterioresMap.values());
          isLive = false;
        } else if (cJson && cJson.success && Array.isArray(cJson.clientes) && cJson.clientes.length > 0) {
          // CIRCUIT-BREAKER E ISOLAMENTO ESTRITO DA LOJA 27 (C. PURUPURU):
          // A rede inteira possui ~17.000 clientes inadimplentes em todo o Amazonas.
          // A Loja 27 possui uma média histórica de ~224 clientes (limite seguro: até 800).
          let clientesFiltrados = cJson.clientes;
          if (clientesFiltrados.length > 500) {
            clientesFiltrados = clientesFiltrados.filter((c: any) => {
              const lojaStr = String(c.loja || c.nome_loja || c.store || '').toUpperCase();
              const idLoja = String(c.loja || c.id_loja || c.unidade || c.filial || '');
              return lojaStr.includes('PURUPURU') || idLoja === '27' || idLoja.includes('27');
            });
          }

          // TRAVA ANTI-17MIL: Se após a filtragem ainda houver mais de 800 clientes
          // (ou seja, se o BackOffice ignorou o filtro de loja e retornou a rede inteira sem campo de loja),
          // ABORTA IMEDIATAMENTE a ingestão ao vivo para JAMAIS gravar 17 mil clientes no Firebase!
          if (clientesFiltrados.length > 0 && clientesFiltrados.length <= 800) {
            rawClientes = clientesFiltrados;
            isLive = true;
            await this.conciliarDiffD1(clientesAnterioresMap, clientesFiltrados);
          } else {
            console.warn(`[CIRCUIT-BREAKER] Ingestão de ${clientesFiltrados.length} clientes da rede global abortada! Mantendo base segura da Loja 27.`);
          }
        }

        // 4. Processa pagamento_dia_cache.php
        if (results[3].status === 'fulfilled' && results[3].value.ok) {
          try {
            pagJsonLive = await results[3].value.json();
            if (db && pagJsonLive) {
              await set(ref(db, 'inadimplencia_pagamentos_dia_loja27'), pagJsonLive);
            }
          } catch {}
        }

        // 5. Processa explorar_devedores.php (fila, atraso_ref real e cotas diárias)
        const ingestExplorarItems = (items: any[]) => {
          if (!Array.isArray(items)) return;
          items.forEach((it) => {
            const doc = String(it.doc || it.cpf || '').replace(/\D/g, '');
            if (doc) {
              infoExplorarPorCpf[doc] = {
                atraso_ref: it.atraso_ref !== undefined && it.atraso_ref !== null ? Number(it.atraso_ref) : undefined,
                phone: it.phone || it.phone_api || undefined,
                phone_api: it.phone_api || undefined,
                has_valid_phone: it.has_valid_phone !== false,
                sent_24h: Boolean(it.sent_24h),
                queue_status: it.queue_status || undefined,
                queue_sent_at: it.queue_sent_at || undefined,
              };
            }
          });
        };

        if (results[4].status === 'fulfilled' && results[4].value.ok) {
          try {
            expFilaJsonLive = await results[4].value.json();
            if (expFilaJsonLive && Array.isArray(expFilaJsonLive.items)) {
              ingestExplorarItems(expFilaJsonLive.items);
            }
          } catch {}
        }

        // Fila page 2 (completa os 223 clientes oficiais da Loja 27)
        if (results[5].status === 'fulfilled' && results[5].value.ok) {
          try {
            const expFilaP2 = await results[5].value.json();
            if (expFilaP2 && Array.isArray(expFilaP2.items)) {
              ingestExplorarItems(expFilaP2.items);
            }
          } catch {}
        }

        // 6. Processa explorar_devedores.php (diagnósticos de erro e atraso_ref dos incontactáveis)
        if (results[6].status === 'fulfilled' && results[6].value.ok) {
          try {
            const expErroJson = await results[6].value.json();
            if (expErroJson && Array.isArray(expErroJson.items)) {
              ingestExplorarItems(expErroJson.items);
              expErroJson.items.forEach((item: any) => {
                const doc = String(item.doc || '').replace(/\D/g, '');
                if (doc) {
                  errosPorCpf[doc] = {
                    rawMsg: item.error_message || 'WhatsApp sem conexão para envio agendado (status: DISCONNECTED)',
                    dataErro: item.last_error_at || item.sent_at || '2026-08-27',
                    status: item.queue_status || item.status || 'ERRO',
                    phone: item.phone || item.phone_api || '',
                  };
                }
              });
            }
          } catch {}
        }

        // 7. Processa ai_radar_summary.php
        if (results[7].status === 'fulfilled' && results[7].value.ok) {
          try {
            aiRadarJsonLive = await results[7].value.json();
            if (db && aiRadarJsonLive) {
              await set(ref(db, 'inadimplencia_ai_radar_loja27'), aiRadarJsonLive);
            }
          } catch {}
        }

        // 8. Processa check_sync_status.php
        if (results[8].status === 'fulfilled' && results[8].value.ok) {
          try {
            syncJsonLive = await results[8].value.json();
            if (db && syncJsonLive) {
              await set(ref(db, 'inadimplencia_sync_status_loja27'), syncJsonLive);
            }
          } catch {}
        }
      } catch {
        // Falha de rede: usa banco Realtime
      }
    }

    // Se a chamada ao vivo falhou, carrega do Firebase Realtime Database
    if (!isLive || rawClientes.length === 0) {
      if (clientesAnterioresMap.size > 0) {
        rawClientes = Array.from(clientesAnterioresMap.values());
      }
    }

    const exclusoes = await this.getExclusoes();
    const telefonesCustomizados = await this.getTelefonesCustomizados();
    const pagamentosD1 = await this.getPagamentosLojaD1();

    // Carrega disparos avulsos recentes (últimas 24h) da nuvem (Firebase RTDB)
    const disparos24hMap: Record<string, boolean> = {};
    const disparosAvulsosHojeCpfs = new Set<string>();
    if (db) {
      try {
        const snapDisp = await get(ref(db, 'inadimplencia_disparos_24h'));
        if (snapDisp.exists()) {
          const valDisp = snapDisp.val();
          if (valDisp && typeof valDisp === 'object') {
            const agora = Date.now();
            const limite24h = agora - 24 * 60 * 60 * 1000;
            const remocoes: Promise<any>[] = [];
            for (const [cpfKey, d] of Object.entries(valDisp as Record<string, any>)) {
              if (d && d.timestamp > limite24h) {
                const cleanKey = String(cpfKey).replace(/\D/g, '');
                disparos24hMap[cleanKey] = true;
                const dDate = new Date(d.timestamp);
                const dYmd = `${dDate.getFullYear()}-${String(dDate.getMonth() + 1).padStart(2, '0')}-${String(dDate.getDate()).padStart(2, '0')}`;
                if (dYmd === hojeYmd) {
                  disparosAvulsosHojeCpfs.add(cleanKey);
                }
              } else {
                remocoes.push(remove(ref(db, `inadimplencia_disparos_24h/${cpfKey}`)));
              }
            }
            if (remocoes.length > 0) {
              await Promise.allSettled(remocoes);
            }
          }
        }
      } catch {
        // no-op
      }
    }

    let valorTotalInadim = 0;
    let valorTotalOriginal = 0;
    let valorTotalRecebido = 0;
    let valorTotalPrevisao = 0;
    let valorTotalPnp = 0;
    let valorTotalClienteNovo = 0;
    let clientesVl15Count = 0;

    let totalFila = 0;
    let totalErro = 0;
    let totalEnviados24h = 0;
    let totalPausados = 0;
    let totalAgendados = 0;
    let maxVinadim = 1;

    // Identifica clientes já agendados em lotes futuros/ativos
    const cpfsAgendadosMap: Record<string, { schedule_date: string; origem?: 'app' | 'backoffice' }> = {};
    const gruposAgendados = scheduleGroupsInput || await this.getAgendamentosLocais();
    gruposAgendados.forEach((grp) => {
      if (grp.status === 'AGENDADO') {
        if (Array.isArray(grp.clientesCpfs) && grp.clientesCpfs.length > 0) {
          grp.clientesCpfs.forEach((cpf) => {
            const clean = String(cpf).replace(/\D/g, '');
            if (clean) cpfsAgendadosMap[clean] = { schedule_date: grp.schedule_date, origem: grp.origem };
          });
        }
        if (Array.isArray(grp.clientes) && grp.clientes.length > 0) {
          grp.clientes.forEach((cl: any) => {
            const clean = String(cl.cpf_cnpj || cl.doc || cl.cpf || '').replace(/\D/g, '');
            if (clean) cpfsAgendadosMap[clean] = { schedule_date: grp.schedule_date, origem: grp.origem };
          });
        }
      }
    });

    rawClientes.forEach((c: any) => {
      const v = Number(c.v_inadim || 0);
      if (v > maxVinadim) maxVinadim = v;
      valorTotalInadim += v;
      valorTotalOriginal += Number(c.v_original || c.v_total || 0);
      valorTotalRecebido += Number(c.v_recebido || 0);
      valorTotalPrevisao += Number(c.v_previsao || 0);

      // Reconhecimento de PNP (1ª Parcela Não Paga):
      // Clientes com v_recebido == 0 ou todas parcelas em aberto nunca pagaram a primeira parcela
      const vRec = Number(c.v_recebido || 0);
      const pAberto = Number(c.parcelas_aberto || 0);
      const pTotal = Number(c.parcelas_total || 0);
      const isPnp = Number(c.v_pnp || 0) > 0 || vRec === 0 || (pTotal > 0 && pAberto >= pTotal);
      const pnpVal = Number(c.v_pnp || (isPnp ? v : 0));
      valorTotalPnp += pnpVal;

      // Reconhecimento de Cliente Novo:
      const vCliNovo = Number(c.v_cliente_novo || 0);
      valorTotalClienteNovo += vCliNovo;

      if (c.vl15_flag === 1) clientesVl15Count++;
    });

    const critMetrics = critJsonLive?.metrics || {};
    const critLojaInadim = Number(critMetrics.v_inadim || 0);
    const critLojaPago = Number(critMetrics.v_pago || critMetrics.v_recebido || 0);
    const critLojaAvencer = Number(critMetrics.v_avencer || 0);
    const critLojaPrevPerda = Number(critMetrics.v_prev_perda || critMetrics.v_previsao_perda || 0);
    const critLojaQtdAberto = Number(critMetrics.qtd_clientes_aberto || 0);
    const critLojaPnp = Number(critMetrics.v_pnp || critJsonLive?.v_pnp || 0);
    const critLojaClienteNovo = Number(critMetrics.v_cliente_novo || critJsonLive?.v_cliente_novo || 0);
    const critLojaOrigem = Number(critMetrics.v_origem || critMetrics.v_original || (critLojaPago + critLojaInadim + critLojaAvencer));

    const valorInadimFinal = (isLive && critLojaInadim > 0)
      ? critLojaInadim
      : (dbMetricas?.valorTotalInadim ?? dbSyncMeta?.valor_total_inadim ?? valorTotalInadim);

    const valorOriginalFinal = (isLive && critLojaOrigem > 0)
      ? critLojaOrigem
      : (dbMetricas?.valorTotalOriginal ?? valorTotalOriginal);

    const valorRecebidoFinal = (isLive && critLojaPago > 0)
      ? critLojaPago
      : (dbMetricas?.valorTotalRecebido ?? valorTotalRecebido);

    // Previsão de Perda: Indicador oficial macro da carteira
    const critLojaPrevisaoPerdaOficial = Number(critMetrics.v_previsao_perda || 0);
    const previsaoPerdaFinal = critLojaPrevisaoPerdaOficial > 0
      ? critLojaPrevisaoPerdaOficial
      : (dbMetricas?.previsaoPerda !== undefined && dbMetricas.previsaoPerda > 0
          ? dbMetricas.previsaoPerda
          : (critLojaPrevPerda > 0 ? critLojaPrevPerda : valorTotalPrevisao));

    // PNP e Cliente Novo: Indicadores macro da carteira global da Loja 27.
    // NUNCA devem ser substituídos pelo somatório parcial restrito aos 223 clientes inadimplentes!
    // Se a API ao vivo fornecer o valor macro oficial da loja, utiliza-o.
    // Caso contrário, preserva a verdade macro consolidada no Firebase RTDB.
    const pnpFinal = (critLojaPnp > 0)
      ? critLojaPnp
      : (dbMetricas?.pnpTotal !== undefined && dbMetricas.pnpTotal > 0
          ? dbMetricas.pnpTotal
          : valorTotalPnp);

    const clienteNovoFinal = (critLojaClienteNovo > 0)
      ? critLojaClienteNovo
      : (dbMetricas?.clienteNovoTotal !== undefined && dbMetricas.clienteNovoTotal > 0
          ? dbMetricas.clienteNovoTotal
          : valorTotalClienteNovo);

    onProgress?.('Calculando scores preditivos e IA Radar...', 80);

    const clientes: ClienteInadimplente[] = rawClientes.map((c: any) => {
      const cleanCpf = String(c.cpf || c.cpf_cnpj || '').replace(/\D/g, '');
      const vInadim = Number(c.v_inadim || 0);

      const exc = exclusoes[cleanCpf];
      const isPausado = !!exc && exc.pausadoAte > Date.now();

      const erroInfo = errosPorCpf[cleanCpf];
      const hasErroOriginal = !!erroInfo || c.has_open_error === true;

      const telCustom = telefonesCustomizados[cleanCpf];
      const explorarInfo = infoExplorarPorCpf[cleanCpf];

      // LGPD & Art. 42 CDC: NUNCA inventar nem gerar telefones fictícios.
      // Se o cliente não possuir telefone cadastrado, o campo permanece vazio e ele é direcionado à Trilha Presencial.
      const rawPhone = telCustom || c.phone || explorarInfo?.phone || c.phone_api || explorarInfo?.phone_api || erroInfo?.phone || '';
      const diagnosticoTelefone = rawPhone ? this.analisarTelefone(rawPhone) : undefined;

      // Superação criteriosa de erro:
      // Apenas supera o erro se houver telefone customizado pelo operador ou se for falha de infraestrutura
      // com telefone real comprovadamente válido. Nunca mascara números sem conta de WhatsApp.
      const isSemContaWhatsapp = Boolean(
        erroInfo?.rawMsg && (
          erroInfo.rawMsg.toLowerCase().includes('no active account') ||
          erroInfo.rawMsg.toLowerCase().includes('sem conta ativa') ||
          erroInfo.rawMsg.toLowerCase().includes('unreachable')
        )
      );
      const isErroInfraestrutura = Boolean(
        !isSemContaWhatsapp &&
        erroInfo?.rawMsg && (
          erroInfo.rawMsg.includes('DISCONNECTED') ||
          erroInfo.rawMsg.includes('TIMEOUT')
        )
      );
      const telValido = Boolean(diagnosticoTelefone?.valido);
      const erroSuperado = (!!telCustom && telValido) || (isErroInfraestrutura && telValido);
      const hasErro = hasErroOriginal && !erroSuperado;

      // Camada Intraday D+1: se o cliente pagou hoje na loja, ele é blindado por 48h!
      const pagamentoD1 = pagamentosD1[cleanCpf];
      const isCompensacaoD1 = !!pagamentoD1 && pagamentoD1.ativo && pagamentoD1.expiraEm > Date.now();

      // Cliente já agendado para data futura/hoje
      const agendadoInfo = cpfsAgendadosMap[cleanCpf];
      const isAgendado = !!agendadoInfo;

      // Disparo realizado nas últimas 24h (via BackOffice ou avulso no app)
      const isDisparado24h = c.cobranca_enviada_24h === 1 || c.sent_24h === true || explorarInfo?.sent_24h === true || !!disparos24hMap[cleanCpf];

      let status: StatusClienteCobranca = 'fila';
      let statusCarteira: 'ATIVO' | 'AGUARDANDO_COMPENSACAO_D1' | 'QUITADO' | 'AMORTIZADO' | 'REINCIDENTE' = 'ATIVO';

      if (isCompensacaoD1) {
        status = 'compensacao_d1';
        statusCarteira = 'AGUARDANDO_COMPENSACAO_D1';
        totalPausados++;
      } else if (isPausado) {
        status = 'pausado';
        statusCarteira = 'ATIVO';
        totalPausados++;
      } else if (isDisparado24h) {
        // Se já foi cobrado nas últimas 24h, o status oficial é ENVIADOS24H!
        status = 'enviados24h';
        statusCarteira = 'ATIVO';
        totalEnviados24h++;
      } else if (isAgendado) {
        status = 'agendados';
        statusCarteira = 'ATIVO';
        totalAgendados++;
      } else if (hasErro) {
        status = 'erro';
        statusCarteira = 'ATIVO';
        totalErro++;
      } else {
        status = 'fila';
        statusCarteira = 'ATIVO';
        totalFila++;
      }

      const diagnostico = hasErro
        ? this.diagnosticarErro(
            erroInfo?.rawMsg || 'Incontactável no WhatsApp (status: UNREACHABLE)',
            erroInfo?.status,
            erroInfo?.dataErro,
            rawPhone
          )
        : undefined;

      const atrasoRealOficial = explorarInfo?.atraso_ref !== undefined && explorarInfo.atraso_ref !== null
        ? explorarInfo.atraso_ref
        : c.atraso_ref !== undefined && Number(c.atraso_ref) >= 0
        ? Number(c.atraso_ref)
        : c.atraso_dias !== undefined && Number(c.atraso_dias) >= 0
        ? Number(c.atraso_dias)
        : undefined;

      const diasAtraso = atrasoRealOficial !== undefined
        ? atrasoRealOficial
        : calcularDiasAtrasoReal(c);

      const detalhesAtraso = obterDetalhesAtraso(diasAtraso);
      const dataVencimentoReal = detalhesAtraso.dataVencimentoFormatada;
      const safra = detalhesAtraso.safra;
      const mesAnoVencimento = detalhesAtraso.mesAnoFormatado;

      const clienteObj: ClienteInadimplente = {
        id_cliente: Number(c.id_cliente || c.codigo_cliente || 0),
        cpf_cnpj: c.cpf_cnpj || c.cpf || '',
        nome_cliente: c.nome_cliente || c.nome || 'Cliente',
        v_total: Number(c.v_total || c.v_original || 0),
        v_recebido: Number(c.v_recebido || 0),
        v_inadim: vInadim,
        v_previsao: Number(c.v_previsao || 0),
        contratos: Number(c.contratos || 1),
        parcelas_aberto: Number(c.parcelas_aberto || 0),
        parcelas_total: Number(c.parcelas_total || 0),
        cobranca_enviada_24h: isDisparado24h ? 1 : Number(c.cobranca_enviada_24h || 0),
        cobranca_ultimo_envio: c.cobranca_ultimo_envio || null,
        cobranca_qtd_envios_24h: isDisparado24h ? Math.max(1, Number(c.cobranca_qtd_envios_24h || 0)) : Number(c.cobranca_qtd_envios_24h || 0),
        cobranca_qtd_envios_total: Number(c.cobranca_qtd_envios_total || 0),
        cobranca_ultimo_envio_geral: c.cobranca_ultimo_envio_geral || null,
        phone: rawPhone,
        phone_api: c.phone_api || explorarInfo?.phone_api || rawPhone,
        has_valid_phone: c.has_valid_phone !== false && (explorarInfo?.has_valid_phone !== false),
        atraso_dias: diasAtraso,
        atraso_ref: diasAtraso,
        dataVencimentoReal,
        safra,
        mesAnoVencimento,
        v_cliente_novo: Number(c.v_cliente_novo || 0),
        v_pnp: Number(c.v_pnp || (Number(c.v_recebido || 0) === 0 ? vInadim : 0)),
        status,
        agendadoPara: agendadoInfo?.schedule_date,
        agendadoOrigem: agendadoInfo?.origem,
        statusCarteira,
        pagamentoLojaD1: isCompensacaoD1 ? pagamentoD1 : undefined,
        faixaAging: calcularFaixaAging(diasAtraso),
        diagnostico,
        diagnosticoTelefone,
        exclusao: isPausado ? exc : undefined,
      };

      const score = calcularScoreCobranca(clienteObj, maxVinadim);
      clienteObj.scorePrioridade = score.scoreFinal;
      clienteObj.scoreDetalhado = score;
      clienteObj.trilhaRecuperacao = score.trilhaRecuperacao;
      clienteObj.previsao = calcularPrevisaoInadimplencia(clienteObj);
      clienteObj.saudeFinanceira = calcularSaudeFinanceiraCliente(clienteObj);

      return clienteObj;
    });

    const percInad = critJsonLive?.perc_inadim !== undefined
      ? Number(Number(critJsonLive.perc_inadim).toFixed(2))
      : valorOriginalFinal > 0 
      ? Number(((valorInadimFinal / valorOriginalFinal) * 100).toFixed(2)) 
      : 0;

    const statusCriticidade: 'critico' | 'alerta' | 'estavel' = 
      percInad >= 25 ? 'critico' : percInad >= 15 ? 'alerta' : 'estavel';

    const criticidadeRotulo = critJsonLive?.criticidade
      || (statusCriticidade === 'critico' ? 'Atenção Elevada' : statusCriticidade === 'alerta' ? 'Atenção' : 'Estável');

    const criticidade = `${criticidadeRotulo}: ${percInad.toFixed(1).replace('.', ',')}% da Carteira`;

    const totalEnviadosFinal = Math.max(
      totalEnviados24h,
      Number(colJsonLive?.metrics?.envios_personalizado_qtd || 0),
      Number(dailyMetrics.enviados || 0)
    );

    // Alinha a cota diária oficial estritamente com o lote de hoje da Loja 27 + disparos avulsos de hoje (máximo 30 disparos)
    const loteHojeObj = (scheduleGroupsInput || []).find((g) => g.schedule_date === hojeYmd);
    const loteCpfs = new Set((loteHojeObj?.clientesCpfs || []).map((c: string) => String(c).replace(/\D/g, '')));
    let avulsosHojeCount = 0;
    for (const cpf of disparosAvulsosHojeCpfs) {
      if (!loteCpfs.has(cpf)) {
        avulsosHojeCount++;
      }
    }

    if (loteHojeObj) {
      const enviadosLote = Number(loteHojeObj.success_count || 0);
      const totalEnviadosHoje = Math.min(30, enviadosLote + avulsosHojeCount);
      dailyMetrics.enviados = totalEnviadosHoje;
      dailyMetrics.consumido = totalEnviadosHoje;
      dailyMetrics.limite = 30;
      dailyMetrics.restantes = Math.max(0, 30 - totalEnviadosHoje);
      dailyMetrics.dataReferencia = hojeYmd;
    } else {
      const totalEnviadosHoje = Math.min(30, avulsosHojeCount);
      dailyMetrics.consumido = totalEnviadosHoje;
      dailyMetrics.enviados = totalEnviadosHoje;
      dailyMetrics.limite = 30;
      dailyMetrics.restantes = Math.max(0, 30 - totalEnviadosHoje);
      dailyMetrics.dataReferencia = hojeYmd;
    }

    const metricas: InadimplenciaMetricas = {
      totalClientes: critLojaQtdAberto || clientes.length,
      valorTotalInadim: valorInadimFinal,
      totalFila: totalFila,
      totalErro: totalErro,
      totalEnviados24h: totalEnviadosFinal,
      totalPausados,
      cotaDiaria: dailyMetrics,
      whatsappStatus: 'CONECTADO',
      valorTotalOriginal: valorOriginalFinal,
      valorTotalRecebido: valorRecebidoFinal,
      percInadimplencia: percInad,
      previsaoPerda: previsaoPerdaFinal,
      pnpTotal: pnpFinal,
      clienteNovoTotal: clienteNovoFinal,
      clientesVl15Count: clientesVl15Count,
      criticidade,
      exposicaoRiscoTotal: valorInadimFinal,
      percExposicaoRisco: percInad,
      statusCriticidade,
      enviosPersonalizado: colJsonLive?.metrics?.envios_personalizado || `${totalEnviadosFinal}/30`,
      taxaConversao: colJsonLive?.metrics?.taxa_conversao,
      pagamentoDiaTotal: pagJsonLive?.total_valor,
      pagamentoDiaQtd: pagJsonLive?.total_pagamentos,
      aiRadarScore: aiRadarJsonLive?.score,
      aiRadarResumo: aiRadarJsonLive?.resumo,
      aiRadarAcoes: aiRadarJsonLive?.acoes,
      countsFila: totalFila,
      countsAgendados: totalAgendados || expFilaJsonLive?.counts?.agendados || 0,
      countsErro: totalErro,
      countsListaEnvios: expFilaJsonLive?.counts?.lista_envios || totalEnviadosFinal || 0,
      syncStatusLabel: syncJsonLive?.label,
      syncLastUpdate: syncJsonLive?.last_sync,
    };

    // Sincronização inteligente com Firebase Realtime Database
    try {
      const db = getRealtimeDatabase();
      if (db) {
        // ATENÇÃO: Somente atualiza a nuvem se os dados vieram AO VIVO do BackOffice (isLive === true)
        // e se o número de clientes corresponder estritamente à Loja 27 (<= 800 clientes, normal ~224).
        // Isso impede gravar 17 mil clientes da rede global e impede que o modo offline sobrescreva as métricas oficiais.
        if (isLive && rawClientes.length > 0 && rawClientes.length <= 800) {
          onProgress?.('Sincronizando com a Nuvem da Loja 27 no Firebase...', 95);
          const sanitizedMetricas = JSON.parse(JSON.stringify(metricas));
          const sanitizedErros = JSON.parse(JSON.stringify(errosPorCpf));
          const statusPayload = JSON.parse(JSON.stringify({
            totalClientes: metricas.totalClientes,
            valorTotalInadim: metricas.valorTotalInadim,
            exposicaoRiscoTotal: metricas.exposicaoRiscoTotal,
            percExposicaoRisco: metricas.percExposicaoRisco,
            criticidade: metricas.criticidade,
            atualizadoEm: new Date().toISOString(),
            operador: 'DEV SQUIRREL',
            loja: '27 - C. PURUPURU',
          }));

          // Atualiza a carteira master salvando a lista enriquecida de clientes da Loja 27
          const carteiraMaster: Record<string, any> = {};
          clientes.forEach((cl: any) => {
            const doc = String(cl.cpf_cnpj || cl.cpf || '').replace(/\D/g, '');
            if (doc) {
              carteiraMaster[doc] = {
                id_cliente: cl.id_cliente || cl.codigo_cliente || '',
                cpf_cnpj: cl.cpf_cnpj || cl.cpf || '',
                nome_cliente: cl.nome_cliente || cl.nome || '',
                v_total: Number(cl.v_total || cl.v_original || 0),
                v_recebido: Number(cl.v_recebido || 0),
                v_inadim: Number(cl.v_inadim || 0),
                parcelas_aberto: Number(cl.parcelas_aberto || 0),
                parcelas_total: Number(cl.parcelas_total || 0),
                contratos: Number(cl.contratos || 1),
                phone: cl.phone || '',
                phone_api: cl.phone_api || '',
                atraso_dias: Number(cl.atraso_dias || 0),
                dataVencimentoReal: cl.dataVencimentoReal || '',
                safra: cl.safra || '',
                mesAnoVencimento: cl.mesAnoVencimento || '',
                faixaAging: cl.faixaAging || '',
                scorePrioridade: cl.scorePrioridade || 0,
                statusCarteira: cl.statusCarteira || 'ATIVO',
                status: cl.status || 'fila',
                cobranca_enviada_24h: cl.cobranca_enviada_24h || 0,
                cobranca_qtd_envios_total: cl.cobranca_qtd_envios_total || 0,
                vl15_flag: cl.vl15_flag || 0,
                v_previsao: cl.v_previsao || 0,
                v_pnp: cl.v_pnp || 0,
                v_cliente_novo: cl.v_cliente_novo || 0,
                atualizadoEm: new Date().toISOString(),
              };
            }
          });
          const sanitizedCarteira = JSON.parse(JSON.stringify(carteiraMaster));

          // Grava metadata com timestamp para controle da virada de dia e lazy sync inteligente
          const metaPayload = JSON.parse(JSON.stringify({
            last_sync_timestamp: Date.now(),
            last_sync_date: hojeYmd,
            last_sync_iso: new Date().toISOString(),
            total_clientes: metricas.totalClientes,
            valorTotalInadim: metricas.valorTotalInadim,
            atualizado_por: 'DEV SQUIRREL',
            origem: forceRefresh ? 'manual_force_refresh' : 'day_turn_sync',
          }));

          try {
            await Promise.allSettled([
              set(ref(db, 'inadimplencia_metricas_loja27'), sanitizedMetricas),
              set(ref(db, 'inadimplencia_erros_loja27'), sanitizedErros),
              set(ref(db, 'inadimplencia_carteira_loja27_status'), statusPayload),
              set(ref(db, 'inadimplencia_carteira_loja27'), sanitizedCarteira),
              set(ref(db, 'inadimplencia_sync_metadata'), metaPayload),
            ]);
            console.log('[InadimplenciaService] ✅ Dados persistidos com sucesso no Firebase Realtime Database!');
          } catch (dbErr) {
            console.error('[InadimplenciaService] ❌ Erro ao gravar dados no Firebase RTDB:', dbErr);
          }
        }
      }
    } catch {
      // no-op
    }

    onProgress?.('Sincronização 100% concluída!', 100);
    return { clientes, metricas, fromCache: shouldSkipBackoffice };
  }

  // Buscar itens detalhados de um agendamento específico (lista de clientes daquele dia)
  static async fetchScheduleItems(scheduleDateYmd: string): Promise<any[]> {
    if (!isHorarioComercial()) {
      return [];
    }
    try {
      const cookie = await this.getCookie();
      const baseUrl = getBackofficeBaseUrl();
      const resp = await fetchWithTimeout(`${baseUrl}/api/explorar_devedores.php`, {
        method: 'POST',
        headers: buildBackofficeHeaders(cookie, {
          'Content-Type': 'application/json',
          Referer: `${baseUrl}/index.php`,
        }),
        body: JSON.stringify({
          action: 'bulk_queue_schedule_items',
          schedule_date: scheduleDateYmd,
        }),
      }, 15000);

      if (resp.ok) {
        const json = await resp.json();
        if (json && json.success && Array.isArray(json.items)) {
          return json.items;
        }
      }
      return [];
    } catch {
      return [];
    }
  }

  // Buscar lista oficial de agendamentos diários da loja (ordenado do mais recente ao mais antigo)
  static async fetchScheduleGroups(forceRefresh = false): Promise<GrupoAgendamento[]> {
    const locais = await this.getAgendamentosLocais();
    let remoteItems: GrupoAgendamento[] = [];
    const db = getRealtimeDatabase();
    const hojeYmd = getHojeDataYmd();

    // 1. Tenta carregar do Firebase Realtime Database
    let dbGroups: GrupoAgendamento[] | null = null;
    let dbSyncMeta: any = null;
    if (db) {
      try {
        const [snapGroups, snapMeta] = await Promise.all([
          get(ref(db, 'inadimplencia_agendamentos_loja27')),
          get(ref(db, 'inadimplencia_sync_metadata')),
        ]);
        if (snapGroups.exists()) {
          const val = snapGroups.val();
          if (Array.isArray(val)) {
            dbGroups = val;
          } else if (val && typeof val === 'object') {
            dbGroups = Object.values(val);
          }
        }
        if (snapMeta.exists()) {
          dbSyncMeta = snapMeta.val();
        }
      } catch {
        // no-op
      }
    }

    // Se estiver fora do horário comercial (BackOffice offline/422), retorna direto do Firebase sem bater no BackOffice!
    if (!forceRefresh && !isHorarioComercial()) {
      return (dbGroups && dbGroups.length > 0) ? dbGroups : locais;
    }

    // Se houver lote de hoje ou algum lote estiver PROCESSANDO ou AGENDADO, não usa cache preguiçoso
    const temLoteHoje = (dbGroups || locais).some((g) => g.schedule_date === hojeYmd);
    const temLoteAtivoOuProcessando = (dbGroups || locais).some(
      (g) => g.is_processing || g.status === 'PROCESSANDO' || g.status === 'AGENDADO'
    );

    // Se já existem agendamentos no Firebase, tem lote de hoje e nenhum está ativo/processando, pode retornar do cache
    const isSameDay = dbSyncMeta?.last_sync_date === hojeYmd;
    if (!forceRefresh && dbGroups && dbGroups.length > 0 && isSameDay && temLoteHoje && !temLoteAtivoOuProcessando) {
      return dbGroups;
    }

    // Consulta a API do BackOffice
    try {
      let cookie = await this.getCookie();
      const baseUrl = getBackofficeBaseUrl();
      let resp = await fetchWithTimeout(`${baseUrl}/api/explorar_devedores.php`, {
        method: 'POST',
        headers: buildBackofficeHeaders(cookie, {
          'Content-Type': 'application/json',
          Referer: `${baseUrl}/index.php`,
        }),
        body: JSON.stringify({ action: 'bulk_queue_schedule_groups' }),
      }, 15000);

      // Auto-renovação de sessão se rejeitado por perda de sessão/loja
      if (resp.status === 422 || resp.status === 401) {
        let jsonErr: any = null;
        try { jsonErr = await resp.clone().json(); } catch {}
        const msgErr = String(jsonErr?.msg || '').toLowerCase();
        if (msgErr.includes('sessao') || msgErr.includes('loja') || msgErr.includes('login')) {
          console.log('[BackOffice Schedule] Sessão expirada detectada. Renovando login...');
          const novoCookie = await this.login();
          if (novoCookie) {
            cookie = novoCookie;
            resp = await fetchWithTimeout(`${baseUrl}/api/explorar_devedores.php`, {
              method: 'POST',
              headers: buildBackofficeHeaders(cookie, {
                'Content-Type': 'application/json',
                Referer: `${baseUrl}/index.php`,
              }),
              body: JSON.stringify({ action: 'bulk_queue_schedule_groups' }),
            }, 15000);
          }
        }
      }

      if (resp.ok) {
        const json = await resp.json();
        if (json && json.success && Array.isArray(json.items) && json.items.length > 0) {
          remoteItems = json.items;
        }
      }
    } catch {
      // no-op
    }

    // Mapa de metadados locais salvos no Firebase (para manter origem e CPFs)
    const locaisMap = new Map<string, GrupoAgendamento>();
    (dbGroups || locais).forEach((g) => {
      if (g.schedule_date) locaisMap.set(g.schedule_date, g);
    });

    // Se temos grupos com status AGENDADO ou PROCESSANDO, busca direto via bulk_queue_schedule_items para garantir CPFs e status
    for (const g of remoteItems) {
      const local = locaisMap.get(g.schedule_date);
      const isAtivoOuProcessando = g.status === 'AGENDADO' || g.status === 'PROCESSANDO' || Boolean(g.is_processing);
      const precisaBuscar = isAtivoOuProcessando && (
        !g.clientesCpfs || 
        g.clientesCpfs.length < g.total_count ||
        !local?.clientesCpfs || 
        local.clientesCpfs.length < g.total_count ||
        g.status === 'PROCESSANDO' ||
        Boolean(g.is_processing)
      );

      if (precisaBuscar) {
        try {
          const items = await this.fetchScheduleItems(g.schedule_date);
          if (items && items.length > 0) {
            g.clientesCpfs = items.map((it: any) => String(it.doc || it.cpf || '').replace(/\D/g, ''));
            g.clientes = items.map((it: any) => {
              const docClean = String(it.doc || it.cpf || '').replace(/\D/g, '');
              const localCl = local?.clientes?.find((c) => String(c.cpf_cnpj).replace(/\D/g, '') === docClean);
              const val = Number(it.valor_ref || it.v_inadim || localCl?.v_inadim || 0);
              const atraso = Number(it.atraso_ref || it.atraso_dias || localCl?.atraso_dias || 15);
              const rawStatus = String(it.status || '').toLowerCase();
              const isEnviado = rawStatus === 'enviado' || rawStatus === 'sucesso';
              const isErro = rawStatus === 'erro';
              return {
                id_cliente: Number(it.id || it.codigo_cliente || localCl?.id_cliente || 0),
                cpf_cnpj: String(it.doc || it.cpf || localCl?.cpf_cnpj || ''),
                nome_cliente: String(it.nome || it.nome_cliente || localCl?.nome_cliente || 'Cliente'),
                phone: it.phone || localCl?.phone || '',
                v_total: val,
                v_recebido: 0,
                v_inadim: val,
                v_previsao: val,
                contratos: localCl?.contratos || 1,
                parcelas_aberto: localCl?.parcelas_aberto || 1,
                parcelas_total: localCl?.parcelas_total || 1,
                cobranca_enviada_24h: isEnviado ? 1 : 0,
                cobranca_ultimo_envio: it.sent_at || null,
                cobranca_qtd_envios_24h: isEnviado ? 1 : 0,
                cobranca_qtd_envios_total: isEnviado ? 1 : 0,
                cobranca_ultimo_envio_geral: it.sent_at || null,
                atraso_dias: atraso,
                status: (isEnviado ? 'enviados24h' : isErro ? 'erro' : 'agendados') as any,
                itemStatus: isEnviado ? 'SUCESSO' : isErro ? 'ERRO' : 'PENDENTE',
                erroMensagem: it.error_message || undefined,
              };
            });
          }
        } catch {
          // no-op
        }
      }
    }

    const baseList: GrupoAgendamento[] = remoteItems.length > 0 ? remoteItems : (dbGroups || locais);
    const listaMesclada: GrupoAgendamento[] = baseList.map((g) => {
      const local = locaisMap.get(g.schedule_date);
      const cpfs = (g.clientesCpfs && g.clientesCpfs.length > 0)
        ? g.clientesCpfs
        : local?.clientesCpfs;
      const cls = (g.clientes && g.clientes.length > 0)
        ? g.clientes
        : local?.clientes;

      return {
        ...g,
        origem: local?.origem || (cpfs ? 'app' : 'backoffice'),
        clientes: cls,
        clientesCpfs: cpfs,
      };
    });

    // ORDENAÇÃO CRONOLÓGICA DECRESCENTE (Lotes futuros/recentes no topo!)
    listaMesclada.sort((a, b) => b.schedule_date.localeCompare(a.schedule_date));

    // Salva a lista consolidada atualizada no Firebase RTDB
    if (db) {
      try {
        const sanitizedAgendamentos = JSON.parse(JSON.stringify(listaMesclada));
        await set(ref(db, 'inadimplencia_agendamentos_loja27'), sanitizedAgendamentos);
      } catch {
        // no-op
      }
    }

    return listaMesclada;
  }

  // Criar Agendamento Oficial Diário (Lote de até 30 clientes para contar como Daily da loja)
  static async criarAgendamentoDiario(
    clientesParaAgendar: ClienteInadimplente[],
    scheduleDateYmd: string,
    messageTemplate: string,
    operadorNome: string = 'DEV SQUIRREL'
  ): Promise<{
    success: boolean;
    msg: string;
    isOfflineOrCors?: boolean;
    scriptConsoleSnippet?: string;
    dailyRemaining?: number;
  }> {
    // 1. BLOQUEIO FORA DO EXPEDIENTE COMERCIAL (07:00 às 18:00, Seg a Sáb)
    if (!isHorarioComercial()) {
      return {
        success: false,
        msg: 'Agendamento indisponível fora do horário comercial. O BackOffice Clara Eletro opera de Segunda a Sábado, das 07:00 às 18:00.',
      };
    }

    // 2. BLOQUEIO DE CLIENTES COM TRAVA INTRADAY D+1 (Pagamento informado no balcão)
    const elegiveis = clientesParaAgendar.filter((c) => {
      const isD1 = c.status === 'compensacao_d1' || (c.pagamentoLojaD1 && c.pagamentoLojaD1.ativo && c.pagamentoLojaD1.expiraEm > Date.now());
      return !isD1;
    });

    if (elegiveis.length === 0) {
      return {
        success: false,
        msg: 'Todos os clientes selecionados informaram pagamento no balcão (compensação D+1 ativa). Disparo bloqueado para evitar cobrança indevida.',
      };
    }

    const cookie = await this.getCookie();
    const baseUrl = getBackofficeBaseUrl();

    const selected = elegiveis.map((c) => {
      const cleanDoc = c.cpf_cnpj.replace(/\D/g, '');
      const phoneDigits = String(c.phone || c.phone_api || '').replace(/\D/g, '');
      const fullPhone = phoneDigits.startsWith('55') ? phoneDigits : `55${phoneDigits}`;

      return {
        doc: cleanDoc,
        nome: c.nome_cliente,
        codigo_cliente: c.id_cliente,
        valor_ref: c.v_inadim,
        atraso_ref: c.atraso_dias || 15,
        phone: fullPhone,
        phone_api: fullPhone,
      };
    });

    const totalValor = elegiveis.reduce((acc, c) => acc + c.v_inadim, 0);

    const payloadObj = {
      action: 'bulk_enqueue_send',
      selected,
      message_text: messageTemplate,
      test_mode: false,
      test_phone: '',
      schedule_date: scheduleDateYmd,
    };

    const scriptConsoleSnippet = '/* Comandos de console desativados por conformidade com a LGPD e sigilo financeiro */';

    // Helper para persistir sucesso no Firebase e auditoria
    const registrarSucessoAgendamento = async (dailyRem?: number) => {
      const novoAgendamentoLocal: GrupoAgendamento = {
        schedule_date: scheduleDateYmd,
        status: 'AGENDADO',
        origem: 'app',
        is_processing: false,
        total_count: selected.length,
        pending_count: selected.length,
        success_count: 0,
        error_count: 0,
        consumed_count: 0,
        daily_limit: 30,
        daily_remaining: dailyRem !== undefined ? Number(dailyRem) : Math.max(0, 30 - selected.length),
        total_value: totalValor,
        sent_value: 0,
        clientes: elegiveis.map((c) => ({
          ...c,
          status: 'agendados',
          agendadoPara: scheduleDateYmd,
          agendadoOrigem: 'app',
        })),
        clientesCpfs: elegiveis.map((c) => c.cpf_cnpj.replace(/\D/g, '')),
      };

      const locaisAtuais = await this.getAgendamentosLocais();
      const filtrados = locaisAtuais.filter((g) => g.schedule_date !== scheduleDateYmd);
      const listaAtualizada = [novoAgendamentoLocal, ...filtrados];

      const db = getRealtimeDatabase();
      const agora = Date.now();
      if (db) {
        try {
          // Sanitiza rigorosamente todo o payload removendo propriedades undefined que causam crash no Firebase
          const sanitizedLista = JSON.parse(JSON.stringify(listaAtualizada));
          const mutacoes: Promise<any>[] = [
            set(ref(db, 'inadimplencia_agendamentos_loja27'), sanitizedLista),
            set(ref(db, 'inadimplencia_sync_metadata/last_action'), 'agendamento_criado'),
            set(ref(db, 'inadimplencia_sync_metadata/last_sync_timestamp'), agora),
          ];
          // Atualiza status e timestamp de disparo de cada cliente na carteira local
          for (const cl of elegiveis) {
            const cleanDoc = cl.cpf_cnpj.replace(/\D/g, '');
            if (cleanDoc) {
              mutacoes.push(set(ref(db, `inadimplencia_carteira_loja27/${cleanDoc}/status`), 'agendados'));
              mutacoes.push(set(ref(db, `inadimplencia_carteira_loja27/${cleanDoc}/agendadoPara`), scheduleDateYmd));
              mutacoes.push(set(ref(db, `inadimplencia_carteira_loja27/${cleanDoc}/agendadoOrigem`), 'app'));
              mutacoes.push(set(ref(db, `inadimplencia_carteira_loja27/${cleanDoc}/ultimoDisparoEm`), agora));
              mutacoes.push(this.salvarEventoAuditoria({
                cpf: cleanDoc,
                nomeCliente: cl.nome_cliente,
                tipo: 'MENSAGEM_DISPARADA',
                operador: operadorNome,
                detalhes: {
                  valorAtual: cl.v_inadim || 0,
                  telefone: cl.phone || cl.phone_api || '',
                  observacao: `Disparo agendado para ${scheduleDateYmd}`,
                },
              }));
            }
          }
          await Promise.allSettled(mutacoes);
          console.log('[BackOffice Agendamento] ✅ Sucesso persistido no Firebase Realtime Database!');
        } catch (dbErr) {
          console.warn('[BackOffice Agendamento] Aviso ao persistir dados locais no Firebase RTDB:', dbErr);
        }
      }

      return {
        success: true,
        msg: `Lote agendado com sucesso no BackOffice para ${scheduleDateYmd} com ${selected.length} clientes! Meta Daily registrada.`,
        dailyRemaining: dailyRem !== undefined ? Number(dailyRem) : Math.max(0, 30 - selected.length),
        scriptConsoleSnippet,
      };
    };

    // Helper para verificar no servidor se o lote foi efetivamente gravado
    const verificarSeCriouNoServidor = async (dateYmd: string): Promise<GrupoAgendamento | null> => {
      try {
        const ck = await this.getCookie();
        const bUrl = getBackofficeBaseUrl();
        const vResp = await fetchWithTimeout(`${bUrl}/api/explorar_devedores.php`, {
          method: 'POST',
          headers: buildBackofficeHeaders(ck, {
            'Content-Type': 'application/json',
            Referer: `${bUrl}/index.php`,
          }),
          body: JSON.stringify({ action: 'bulk_queue_schedule_groups' }),
        }, 20000);
        if (vResp.ok) {
          let vText = '';
          let vJson: any = null;
          try {
            vText = await vResp.text();
            vJson = JSON.parse(vText);
          } catch {
            const vMatch = vText.match(/\{[\s\S]*\}/);
            if (vMatch) vJson = JSON.parse(vMatch[0]);
          }
          if (vJson && vJson.success && Array.isArray(vJson.items)) {
            const found = vJson.items.find((g: any) => g.schedule_date === dateYmd);
            if (found && (Number(found.total_count) > 0 || found.status === 'AGENDADO')) {
              return found;
            }
          }
        }
      } catch {}
      return null;
    };

    try {
      let cookie = await this.getCookie();
      const baseUrl = getBackofficeBaseUrl();

      let resp = await fetchWithTimeout(`${baseUrl}/api/explorar_devedores.php`, {
        method: 'POST',
        headers: buildBackofficeHeaders(cookie, {
          'Content-Type': 'application/json',
          Referer: `${baseUrl}/index.php`,
        }),
        body: JSON.stringify(payloadObj),
      }, 45000);

      // Lê a resposta do servidor com suporte robusto a notices do PHP / BOM
      let json: any = null;
      let rawText = '';
      try {
        rawText = await resp.text();
        json = JSON.parse(rawText);
      } catch {
        try {
          const match = rawText.match(/\{[\s\S]*\}/);
          if (match) json = JSON.parse(match[0]);
        } catch {}
      }

      // Se a sessão expirou, renova o login e tenta novamente
      const msgErr = String(json?.msg || '').toLowerCase();
      if ((resp.status === 422 || resp.status === 401) && (msgErr.includes('sessao') || msgErr.includes('loja') || msgErr.includes('login'))) {
        console.log('[BackOffice Agendamento] Sessão expirada detectada. Renovando login...');
        const novoCookie = await this.login();
        if (novoCookie) {
          cookie = novoCookie;
          resp = await fetchWithTimeout(`${baseUrl}/api/explorar_devedores.php`, {
            method: 'POST',
            headers: buildBackofficeHeaders(cookie, {
              'Content-Type': 'application/json',
              Referer: `${baseUrl}/index.php`,
            }),
            body: JSON.stringify(payloadObj),
          }, 45000);
          try {
            rawText = await resp.text();
            json = JSON.parse(rawText);
          } catch {
            try {
              const match = rawText.match(/\{[\s\S]*\}/);
              if (match) json = JSON.parse(match[0]);
            } catch {}
          }
        }
      }

      const isSuccess = Boolean(
        json && (
          json.success === true ||
          json.success === 'true' ||
          json.success === 1 ||
          json.ok === true ||
          json.status === 'success' ||
          (Array.isArray(json.items) && json.items.length > 0)
        )
      );

      if (isSuccess) {
        return await registrarSucessoAgendamento(json.daily_remaining);
      } else if (json && json.msg) {
        // Antes de rejeitar, verifica se o servidor já concluiu a gravação do agendamento
        const grupoCriado = await verificarSeCriouNoServidor(scheduleDateYmd);
        if (grupoCriado) {
          console.log('[BackOffice Agendamento] ✅ Lote confirmado no servidor BackOffice:', scheduleDateYmd);
          return await registrarSucessoAgendamento(grupoCriado.daily_remaining);
        }
        return {
          success: false,
          msg: json.msg,
          scriptConsoleSnippet,
        };
      }
    } catch (err: any) {
      console.warn('[BackOffice Agendamento] Erro ou timeout na chamada direta:', err?.message);
      if (Platform.OS === 'web') {
        return {
          success: false,
          msg: 'Envio direto bloqueado no Chrome por restrição de CORS. Utilize o aplicativo oficial no Android.',
          scriptConsoleSnippet,
        };
      }
    }

    // FALLBACK DE VERIFICAÇÃO CONTINGENCIAL:
    // O BackOffice pode demorar mais de 30s processando 30 clientes mas persistir com sucesso no banco.
    // Verificamos a lista oficial de agendamentos antes de emitir falso erro para o usuário.
    try {
      console.log('[BackOffice Agendamento] Verificando contingência na lista oficial...');
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const grupoCriado = await verificarSeCriouNoServidor(scheduleDateYmd);
      if (grupoCriado && (Number(grupoCriado.total_count) > 0 || grupoCriado.status === 'AGENDADO')) {
        console.log('[BackOffice Agendamento] ✅ Lote confirmado com sucesso via contingência!');
        return await registrarSucessoAgendamento(grupoCriado.daily_remaining);
      }
    } catch (verifErr) {
      console.warn('[BackOffice Agendamento] Falha na verificação de contingência:', verifErr);
    }

    return {
      success: false,
      msg: 'Não foi possível confirmar o agendamento com o servidor do BackOffice. Verifique se o lote já consta na aba Agendamentos.',
      scriptConsoleSnippet,
    };
  }

  // Reverter / Cancelar Agendamento Oficial (Apenas status AGENDADO ou em processamento)
  static async reverterAgendamento(
    scheduleDateYmd: string,
    agStatus?: string
  ): Promise<{ success: boolean; msg: string; deleted?: number }> {
    if (agStatus === 'FINALIZADO') {
      return {
        success: false,
        msg: 'Este lote já foi totalmente executado e finalizado pelo BackOffice. Históricos já concluídos não podem ser revertidos.',
      };
    }

    const locaisAtuais = await this.getAgendamentosLocais();
    const alvo = locaisAtuais.find((g) => g.schedule_date === scheduleDateYmd);
    if (alvo && alvo.status === 'FINALIZADO') {
      return {
        success: false,
        msg: 'Este lote já foi totalmente finalizado pelo BackOffice e não pode ser cancelado.',
      };
    }

    const cookie = await this.getCookie();
    const baseUrl = getBackofficeBaseUrl();
    let deletedCount = 0;

    if (isHorarioComercial()) {
      try {
        const resp = await fetchWithTimeout(`${baseUrl}/api/explorar_devedores.php`, {
          method: 'POST',
          headers: buildBackofficeHeaders(cookie, {
            'Content-Type': 'application/json',
            Referer: `${baseUrl}/index.php`,
          }),
          body: JSON.stringify({
            action: 'bulk_queue_delete_day',
            schedule_date: scheduleDateYmd,
          }),
        }, 30000);

        let json: any = null;
        let rawText = '';
        try {
          rawText = await resp.text();
          json = JSON.parse(rawText);
        } catch {
          try {
            const match = rawText.match(/\{[\s\S]*\}/);
            if (match) json = JSON.parse(match[0]);
          } catch {}
        }

        if (json && json.success === false && json.msg) {
          console.warn('[BackOffice Reverter] Rejeição do servidor:', json.msg);
          return {
            success: false,
            msg: json.msg,
          };
        }

        if (json && json.deleted !== undefined) {
          deletedCount = Number(json.deleted);
        }
      } catch {
        // no-op
      }
    }

    try {
      const filtrados = locaisAtuais.filter((g) => g.schedule_date !== scheduleDateYmd);

      const db = getRealtimeDatabase();
      if (db) {
        const sanitizedFiltrados = JSON.parse(JSON.stringify(filtrados));
        const mutacoes: Promise<any>[] = [
          set(ref(db, 'inadimplencia_agendamentos_loja27'), sanitizedFiltrados),
          set(ref(db, 'inadimplencia_sync_metadata/last_action'), 'agendamento_cancelado'),
          set(ref(db, 'inadimplencia_sync_metadata/last_sync_timestamp'), Date.now()),
        ];

        // Reverte imediatamente o status dos clientes do lote para a fila comum na nuvem
        if (alvo) {
          const cpfsToUnlock = new Set<string>();
          if (Array.isArray(alvo.clientesCpfs)) {
            alvo.clientesCpfs.forEach((c) => {
              const clean = String(c).replace(/\D/g, '');
              if (clean) cpfsToUnlock.add(clean);
            });
          }
          if (Array.isArray(alvo.clientes)) {
            alvo.clientes.forEach((c: any) => {
              const clean = String(c.cpf_cnpj || c.doc || c.cpf || '').replace(/\D/g, '');
              if (clean) cpfsToUnlock.add(clean);
            });
          }
          for (const cleanCpf of cpfsToUnlock) {
            mutacoes.push(set(ref(db, `inadimplencia_carteira_loja27/${cleanCpf}/status`), 'fila'));
            mutacoes.push(remove(ref(db, `inadimplencia_carteira_loja27/${cleanCpf}/agendadoPara`)));
            mutacoes.push(remove(ref(db, `inadimplencia_carteira_loja27/${cleanCpf}/agendadoOrigem`)));
          }
        }
        await Promise.allSettled(mutacoes);
      }
    } catch {
      // no-op
    }

    return { 
      success: true, 
      msg: `Agendamento de ${scheduleDateYmd} cancelado e apagado com sucesso! ${deletedCount > 0 ? `${deletedCount} clientes devolvidos à fila de cobrança.` : 'Clientes devolvidos à fila de cobrança.'}`,
      deleted: deletedCount,
    };
  }

  // Buscar detalhes do histórico e contratos de um cliente (resiliente mesmo fora do horário)
  static async fetchClientHistory(
    cpf: string,
    fallbackCliente?: ClienteInadimplente
  ): Promise<HistoricoDetalheCliente> {
    const cleanCpf = cpf.replace(/\D/g, '');

    // Se estiver dentro do horário comercial, tenta buscar contratos oficiais direto do BackOffice
    if (isHorarioComercial()) {
      try {
        const cookie = await this.getCookie();
        const baseUrl = getBackofficeBaseUrl();
        const resp = await fetchWithTimeout(`${baseUrl}/api/explorar_devedores.php`, {
          method: 'POST',
          headers: buildBackofficeHeaders(cookie, {
            'Content-Type': 'application/json',
            Referer: `${baseUrl}/index.php`,
          }),
          body: JSON.stringify({
            action: 'client_carnes',
            cpf: cleanCpf,
          }),
        }, 12000);

        if (resp.ok) {
          const json = await resp.json();
          const telefones = Array.isArray(json.telefones) ? json.telefones : [];
          const contratos = Array.isArray(json.contratos) ? json.contratos : [];
          const totais = json.totais || { v_inadim: 0, dias_atraso: 0, parcelas_aberto: 0 };
          const histResult: HistoricoDetalheCliente = {
            cpf: json.cpf || cpf,
            codigo_cliente: Number(json.codigo_cliente || fallbackCliente?.id_cliente || 0),
            nome_cliente: json.nome_cliente || fallbackCliente?.nome_cliente || 'Cliente Clara Eletro',
            telefones,
            contratos,
            totais,
          };
          const db = getRealtimeDatabase();
          if (db) {
            try {
              await set(ref(db, `inadimplencia_historico_clientes/${cleanCpf}`), histResult);
            } catch {
              // no-op
            }
          }
          return histResult;
        }
      } catch {
        // no-op
      }
    }

    // Histórico sintetizado rico para garantia de abertura imediata fora do expediente
    const cleanCpfDigits = cleanCpf || fallbackCliente?.cpf_cnpj.replace(/\D/g, '') || '';

    // 1. Verifica se o histórico já existe no Firebase Realtime Database
    try {
      const db = getRealtimeDatabase();
      if (db) {
        const snap = await get(ref(db, `inadimplencia_historico_clientes/${cleanCpfDigits}`));
        if (snap.exists()) {
          const histDb = snap.val();
          if (histDb && Array.isArray(histDb.contratos) && histDb.contratos.length > 0) {
            return histDb;
          }
        }
      }
    } catch {
      // no-op
    }

    // 2. Se não há histórico oficial na API e nem no cache:
    // Retorna os dados cadastrais reais do cliente sem forjar contratos nem salvar dados falsos na nuvem
    const telPrincipal = fallbackCliente?.phone || fallbackCliente?.phone_api || '';
    const telefones: { raw: string; display: string }[] = [];
    if (telPrincipal) {
      telefones.push({
        raw: telPrincipal,
        display: fallbackCliente?.diagnosticoTelefone?.telefoneFormatado || telPrincipal,
      });
    }

    return {
      cpf: fallbackCliente?.cpf_cnpj || cpf,
      codigo_cliente: fallbackCliente?.id_cliente || 0,
      nome_cliente: fallbackCliente?.nome_cliente || 'Cliente Clara Eletro',
      telefones,
      contratos: [],
      totais: {
        v_inadim: fallbackCliente?.v_inadim || 0,
        dias_atraso: fallbackCliente?.atraso_dias || 15,
        parcelas_aberto: fallbackCliente?.parcelas_aberto || 1,
        parcelas_total: fallbackCliente?.parcelas_total || 1,
        parcelas_pagas: Math.max(0, (fallbackCliente?.parcelas_total || 1) - (fallbackCliente?.parcelas_aberto || 1)),
        v_total: fallbackCliente?.v_total || fallbackCliente?.v_inadim || 0,
        v_recebido: fallbackCliente?.v_recebido || 0,
      },
    };
  }

  // Disparo individual de cobrança
  static async sendIndividualCollection(
    cliente: ClienteInadimplente, 
    phone: string, 
    mensagemCustomizada?: string
  ): Promise<{ success: boolean; msg: string; openWhatsappDirect?: boolean }> {
    const cleanPhone = phone.replace(/\D/g, '');
    const cleanCpf = cliente.cpf_cnpj.replace(/\D/g, '');
    const cookie = await this.getCookie();
    const baseUrl = getBackofficeBaseUrl();

    const template = await this.getTemplateMensagem();
    const msg = mensagemCustomizada || this.formatarMensagemDinamica(template, cliente);

    try {
      const resp = await fetchWithTimeout(`${baseUrl}/api/send_collection_message.php`, {
        method: 'POST',
        headers: buildBackofficeHeaders(cookie, {
          'Content-Type': 'application/json',
          Referer: `${baseUrl}/index.php`,
        }),
        body: JSON.stringify({
          numeros: [cleanPhone],
          mensagem: msg,
          cpf: cleanCpf,
          codigo_cliente: cliente.id_cliente,
        }),
      }, 15000);

      if (resp.ok) {
        const json = await resp.json();
        if (json && json.success) {
          const agora = Date.now();
          const db = getRealtimeDatabase();
          const mutacoes: Promise<any>[] = [];
          if (db) {
            mutacoes.push(
              set(ref(db, `inadimplencia_disparos_24h/${cleanCpf}`), {
                timestamp: agora,
                cpf: cleanCpf,
                valor: cliente.v_inadim,
                phone: cleanPhone,
                nome: cliente.nome_cliente,
              }),
              set(ref(db, `inadimplencia_carteira_loja27/${cleanCpf}/ultimoDisparoEm`), agora),
              set(ref(db, `inadimplencia_carteira_loja27/${cleanCpf}/cobranca_enviada_24h`), 1),
              set(ref(db, `inadimplencia_sync_metadata/last_action`), 'disparo_avulso'),
              set(ref(db, `inadimplencia_sync_metadata/last_sync_timestamp`), agora)
            );
          }

          mutacoes.push(
            this.salvarEventoAuditoria({
              cpf: cleanCpf,
              nomeCliente: cliente.nome_cliente,
              tipo: 'MENSAGEM_DISPARADA',
              operador: 'DEV SQUIRREL',
              detalhes: {
                valorAtual: cliente.v_inadim,
                telefone: cleanPhone,
                observacao: 'Cobrança avulsa via WhatsApp OneBox',
              },
            }),
            this.registrarEventoHistoricoCliente(cleanCpf, {
              tipo: 'ENVIO_WHATSAPP',
              titulo: 'Cobrança WhatsApp Disparada',
              descricao: `Mensagem enviada para ${cleanPhone} (Débito: ${toBrl(cliente.v_inadim)})`,
              detalhes: {
                valorAtual: cliente.v_inadim,
                phone: cleanPhone,
                operador: 'DEV SQUIRREL',
              },
            })
          );

          await Promise.allSettled(mutacoes);

          return { success: true, msg: json.msg || 'Mensagem enviada com sucesso pelo BackOffice!' };
        } else if (json && json.msg) {
          return { 
            success: false, 
            msg: `${json.msg}. Deseja abrir no WhatsApp do aparelho?`,
            openWhatsappDirect: true 
          };
        }
      }
    } catch {
      // no-op
    }

    return {
      success: false,
      msg: 'Não foi possível conectar à API de mensageria da OneBox. Deseja abrir no WhatsApp do aparelho?',
      openWhatsappDirect: true,
    };
  }

  // Abrir WhatsApp diretamente no aparelho
  static async abrirWhatsappNativo(phone: string, text: string): Promise<void> {
    let cleanPhone = phone.replace(/\D/g, '');
    if (!cleanPhone.startsWith('55') && cleanPhone.length <= 11) {
      cleanPhone = `55${cleanPhone}`;
    }
    const encoded = encodeURIComponent(text);
    const url = Platform.OS === 'web'
      ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encoded}`
      : `whatsapp://send?phone=${cleanPhone}&text=${encoded}`;

    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        await Linking.openURL(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encoded}`);
      }
    } catch {
      await Linking.openURL(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encoded}`);
    }
  }
}
