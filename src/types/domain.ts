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

// Tipos de Fantasmas simplificados e avançados
export type TipoFantasma = 
  | "pessoa"            // Geral (ex-Ricardo)
  | "destroca_pix"      // Pegou espécie e mandou pix
  | "emprestimo"        // Pegou emprestado para o caixa
  | "outro";

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

export interface DividaCliente {
  id: string;
  cliente: string;
  valor: number;
  descricao: string;
  resolvido: boolean;
  timestamp: number;
}

// Estrutura para conferência física de notas
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
}

export interface Turno {
  id: string;
  caixaId?: string;      // ID do Caixa (ex: 2701)
  operadorId?: string;   // ID do Operador (ex: 1306)
  dataReferencia: string;
  statusTurno: "aberto" | "fechado";
  ajusteManualSobra: number;
  contagem?: ContagemCedulas;
  totais: TotaisTurno;
  criadoEm: number;
  atualizadoEm: number;
}
