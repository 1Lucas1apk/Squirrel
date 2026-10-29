export type NaturezaOperacao = "pagamento" | "entrada";

export type CategoriaTransacao =
  | "dinheiro"
  | "entrada_prestacao"
  | "compra_vista"
  | "gar"
  | "multiplo"
  | "sangria"
  | "cancelamento";

export type StatusConferencia = "pendente" | "confirmada" | "incorreto";

export type TipoFantasma =
  | "pix_recebido_gaveta_saiu"
  | "dinheiro_emprestado"
  | "destroca_pix_por_nota"
  | "lembrete_geral";

export type TipoPOS = "cartao" | "pix_loja" | "gas_do_povo";

export type TipoEventoLedger =
  | "CRIACAO_TRANSACAO"
  | "EDICAO_TRANSACAO"
  | "CANCELAMENTO_TRANSACAO"
  | "RESOLUCAO_CONFLITO"
  | "SANGRIA"
  | "SUPRIMENTO"
  | "AJUSTE_GAVETA";

export type StatusTransacaoLedger =
  | "CONFIRMADO"
  | "PENDENTE_SYNC"
  | "CONFLITO"
  | "CANCELADO"
  | "RESOLVIDO";

export interface LedgerEvent {
  id: string; // UUID/ULID único do evento (Garante Idempotência no envio)
  turnoId: string;
  transacaoId: string; // ID lógico da entidade transação
  tipo: TipoEventoLedger;

  valorSistema?: number;
  valorRecebidoFisico?: number;
  trocoSobra?: number;
  naturezaOperacao?: NaturezaOperacao;
  categoria?: CategoriaTransacao;
  descricao?: string;
  codigoContrato?: string;
  justificativaTexto?: string | null;

  operadorId: string;
  operadorNome: string;
  deviceId: string; // Identificador persistente do aparelho gerador

  sequence: number; // Sequência monotônica local do dispositivo
  baseVersion?: number; // Versão de onde partiu a alteração (Detecção de Concorrência Causal)

  criadoEmDevice: number; // Timestamp do relógio do aparelho
  sincronizadoEmServer?: number; // Timestamp de confirmação do Firestore

  motivo?: string;
  valorEscolhidoConflito?: number;
}

export interface Transacao {
  id: string; // transacaoId
  turnoId?: string;
  clientLocalId?: string;
  timestamp: number;
  naturezaOperacao: NaturezaOperacao;
  categoria: CategoriaTransacao;
  descricao: string;
  codigoContrato?: string;
  valorSistema: number;
  valorRecebidoFisico: number;
  trocoSobra: number;
  statusConferencia: StatusConferencia;
  justificativaTexto?: string | null;
  transacaoVinculadaId?: string;
  pendingSync?: boolean;

  // Campos do Ledger de Eventos & Projeção Causal
  statusLedger?: StatusTransacaoLedger;
  versao?: number; // Versão canônica consolidada atual
  baseVersion?: number;
  deviceId?: string;
  operadorNome?: string;
  operadorId?: string;
  conflitosConcorrentes?: LedgerEvent[]; // Eventos que divergiram com a mesma baseVersion
  eventosVinculados?: string[]; // IDs de todos os eventos que compõem o histórico imutável
}

export interface LembreteFantasma {
  id: string;
  clientLocalId?: string;
  tipo: TipoFantasma;
  pessoa?: string;
  descricao: string;
  valorReferencia: number;
  impactaPixRepasse: boolean;
  destinoPix?: string;
  transacaoVinculadaId?: string;
  resolvido: boolean;
  comprovadoPix: boolean;
  timestamp: number;
  pendingSync?: boolean;
}

export interface RegistroPOS {
  id: string;
  timestamp: number;
  tipo: TipoPOS;
  descricao: string;
  valor: number;
  statusConferencia?: "pendente" | "confirmada" | "incorreto";
}

export interface RegistroConvenio {
  id: string;
  timestamp: number;
  nome: string;
  valor: number;
  descricao?: string;
  statusConferencia?: "pendente" | "confirmada" | "incorreto";
}

export interface DividaCliente {
  id: string;
  cliente: string;
  valor: number;
  descricao: string;
  resolvido: boolean;
  timestamp: number;
}

export interface ContagemCedulas {
  n100: number;
  n50: number;
  n20: number;
  n10: number;
  n5: number;
  n2: number;
  moedas: number;
}

export interface TotaisTurno {
  sistema: number;
  sobra: number;
  gavetaFisico: number;
  especieEnvelope: number;
  pixRepasse: number;
  pixNoCaixa: number;
  pixDiretoLoja: number;
  totalPOS: number;
  totalConvenio: number;
}

export interface LogAlteracao {
  id: string;
  transacaoId: string;
  timestamp: number;
  valorAntigo: number;
  valorNovo: number;
  campoAlterado: string;
  motivo?: string;
}

export interface MensagemChat {
  id: string;
  remetenteId: string;
  remetenteNome: string;
  remetenteUsername?: string;
  remetenteCargo?: string;
  destinatarioId?: string; // Se nulo/undefined, é mensagem do Mural Global
  parentId?: string; // Para subcomentários/respostas aninhadas no Mural
  replyTo?: {
    id: string;
    texto: string;
    remetenteNome: string;
    remetenteUsername?: string;
  };
  reacoes?: Record<string, string[]>; // Mapa de emoji -> array de IDs de usuários (ex: { "❤️": ["uid1", "uid2"] })
  texto: string;
  imagemBase64?: string; // Suporte a imagem / foto em base64 (Zero custo, direto no Firestore)
  remetentePhotoUrl?: string;
  remetenteRecado?: string;
  remetenteStatusPreset?: string;
  isPinned?: boolean; // Se verdadeiro, é aviso fixado no topo do Mural (Admin)
  timestamp: number;
  lidasPor: string[]; // array de IDs que já leram
  editadaEm?: number;
  apagadaEm?: number;
  jogo?: JogoChatPayload;
}

export type TipoJogoChat = "velha" | "quatro_linha" | "batalha_naval" | "termo_versus" | "forca" | "stop";

export interface StopRespostas {
  nome: string;
  comida: string;
  objeto: string;
  lugar: string;
}

export type StatusValidacaoItem = "pendente" | "valido" | "repetido" | "invalido";

export interface ValidacaoStop {
  nome: StatusValidacaoItem;
  comida: StatusValidacaoItem;
  objeto: StatusValidacaoItem;
  lugar: StatusValidacaoItem;
}

export interface JogoStopEstado {
  letraSorteada: string; // Ex: "B"
  categorias: string[]; // ["Nome", "Comida", "Objeto", "Cidade / Lugar"]
  fase: "jogando" | "stop_acionado" | "conferencia" | "finalizado";
  quemParouId?: string | null; // Quem apertou STOP primeiro
  tempoStopAcionado?: number | null; // Timestamp de quando o STOP foi apertado
  jogador1Respostas?: StopRespostas | null;
  jogador1Pronto: boolean; // Enviou suas respostas
  jogador2Respostas?: StopRespostas | null;
  jogador2Pronto: boolean; // Enviou suas respostas
  jogador1Pontos?: number;
  jogador2Pontos?: number;
  validacaoJ1?: ValidacaoStop; // Avaliação das palavras do J1
  validacaoJ2?: ValidacaoStop; // Avaliação das palavras do J2
  motivosJ1?: Partial<Record<keyof StopRespostas, string>>; // Motivos da validação automática J1
  motivosJ2?: Partial<Record<keyof StopRespostas, string>>; // Motivos da validação automática J2
  rodada: number;
}

export interface JogoForcaEstado {
  modo: "duelo_aleatorio" | "desafio_criador";
  palavraSecreta: string; // Ex: "COMPUTADOR"
  tema: string; // Ex: "Tecnologia / Eletrônico"
  dicas: string[]; // Histórico de dicas enviadas pelo criador
  letrasChutadas: string[]; // Letras já testadas (maiúsculas)
  errosMaximos: number; // Padrão: 6 vidas (partes do boneco cibernético)
  errosAtuais: number; // Quantos erros cometidos (0..6)
  criadorId?: string | null; // Quem criou o enigma (no modo desafio_criador)
  adivinhadorId?: string | null; // Quem está tentando adivinhar (no modo desafio_criador)
  ultimoChutePorId?: string | null; // Quem fez a última jogada
  pediuDica?: boolean; // Alerta de socorro quando o adivinhador está com poucas vidas
  letrasReveladasPeloCriador?: string[]; // Letras que o criador revelou de presente
}

export interface JogoVelhaEstado {
  tabuleiro: (string | null)[]; // 9 posições: null | "X" | "O"
  linhasVencedoras?: number[] | null; // [0, 1, 2], etc.
}

export interface JogoQuatroLinhaEstado {
  tabuleiro: (string | null)[]; // 42 posições (6 linhas x 7 colunas em flat array)
  linhasVencedoras?: number[] | null; // índices das 4 peças vencedoras
  ultimaJogada?: number | null; // índice da última peça
}

export interface JogoBatalhaNavalEstado {
  jogador1Frota: number[]; // índices (0..24) das embarcações do J1
  jogador2Frota: number[]; // índices (0..24) das embarcações do J2
  jogador1Tiros: number[]; // tiros disparados pelo J1 na frota do J2
  jogador2Tiros: number[]; // tiros disparados pelo J2 na frota do J1
  ultimoTiro?: { jogadorId: string; index: number; acertou: boolean } | null;
}

export type StatusLetraTermo = "correto" | "presente" | "ausente";

export interface PalpiteTermo {
  palavra: string;
  feedback: StatusLetraTermo[];
}

export interface JogoTermoEstado {
  palavraSecreta: string;
  modo: "aleatorio" | "desafio";
  dica?: string | null;
  criadorPalavraId?: string | null;
  jogador1Palpites: PalpiteTermo[];
  jogador2Palpites: PalpiteTermo[];
}

export interface JogoChatPayload {
  tipo: TipoJogoChat;
  partidaId: string;
  jogador1Id: string; // Jogador X / Vermelho / Almirante 1 / Criador
  jogador1Nome: string;
  jogador1Username?: string | null;
  jogador2Id: string; // Jogador O / Amarelo / Almirante 2 / Adivinhador
  jogador2Nome: string;
  jogador2Username?: string | null;
  turnoAtualId: string; // Id de quem joga agora
  quemIniciouId?: string | null; // Id de quem fez o primeiro movimento na rodada
  estado: JogoVelhaEstado | JogoQuatroLinhaEstado | JogoBatalhaNavalEstado | JogoTermoEstado | JogoForcaEstado | JogoStopEstado;
  status: "em_andamento" | "vitoria" | "empate" | "cancelado";
  vencedorId?: string | null;
  vencedorNome?: string | null;
  placar?: {
    jogador1: number;
    jogador2: number;
    empates: number;
  };
  criadoEm: number;
  atualizadoEm: number;
}

export interface ChatContact {
  id: string;
  username: string;
  displayName: string;
  avatarColor?: string;
  photoUrl?: string;
  isAdmin?: boolean;
  cargo?: string;
  recado?: string;
  statusPreset?: string;
  isOnline?: boolean;
  lastSeen?: number;
  lastMessage?: string;
  lastMessageTime?: number;
  unreadCount?: number;
}

export interface Turno {
  id: string;
  caixaId?: string;
  operadorId?: string;
  dataReferencia: string;
  statusTurno: "aberto" | "fechado";
  ajusteManualSobra: number;
  contagem?: ContagemCedulas;
  totais: TotaisTurno;
  criadoEm: number;
  atualizadoEm: number;
  repassado?: boolean;
  bateuFisico?: boolean;
  observacoesFechamento?: string;
  notaDia?: string;
  posRelatorioTotal?: number;
  excluido?: boolean;
  pendingSync?: boolean;
}
