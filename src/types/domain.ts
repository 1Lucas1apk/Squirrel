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

export interface Transacao {
  id: string;
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
  destinatarioId?: string; // Se nulo/undefined, é mensagem do Mural Global
  texto: string;
  timestamp: number;
  lidasPor: string[]; // array de IDs de caixas que já leram
  editadaEm?: number;
  apagadaEm?: number;
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
}
