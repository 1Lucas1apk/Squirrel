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

export interface Transacao {
  id: string;
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
}

export interface LembreteFantasma {
  id: string;
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
}
