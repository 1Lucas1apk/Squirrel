export type NaturezaOperacao = "pagamento" | "entrada";

export type CategoriaTransacao =
  | "dinheiro"
  | "entrada_prestacao"
  | "compra_vista"
  | "gar"
  | "multiplo"
  | "sangria"
  | "cancelamento";

export type StatusConferencia = "pendente" | "confirmada";
export type TipoFantasma = "gerente_troca" | "outro";

export interface Transacao {
  id: string;
  timestamp: number;
  naturezaOperacao: NaturezaOperacao;
  categoria: CategoriaTransacao;
  descricao: string;
  codigoContrato?: string; // NOVO: Campo de contrato (Ex: 2303/1.4)
  valorSistema: number;
  valorRecebidoFisico: number;
  trocoSobra: number;
  statusConferencia: StatusConferencia;
  justificativaTexto?: string | null;
}

export interface LembreteFantasma {
  id: string;
  tipo: TipoFantasma;
  pessoa?: string;
  descricao: string;
  valorReferencia: number;
  impactaPixRepasse: boolean;
  resolvido: boolean;
  comprovadoPix: boolean;
  timestamp: number;
}

// NOVO: Estrutura para a aba "Devendo"
export interface DividaCliente {
  id: string;
  cliente: string;
  valor: number;
  descricao: string;
  resolvido: boolean;
  timestamp: number;
}

export interface TotaisTurno {
  sistema: number;
  sobra: number;
  gavetaFisico: number;
  especieEnvelope: number;
  pixRepasse: number;
}

export interface Turno {
  id: string;
  dataReferencia: string;
  statusTurno: "aberto" | "fechado";
  ajusteManualSobra: number;
  totais: TotaisTurno;
  criadoEm: number;
  atualizadoEm: number;
}
