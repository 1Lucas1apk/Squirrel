import { LembreteFantasma, Transacao } from "../types/domain";

export const mockTransacoes: Transacao[] = [
  {
    id: "t1",
    timestamp: Date.now() - 20000,
    naturezaOperacao: "pagamento",
    categoria: "dinheiro",
    descricao: "Entrada avista",
    valorSistema: 1200,
    valorRecebidoFisico: 1200,
    trocoSobra: 0,
    statusConferencia: "pendente",
  },
  {
    id: "t2",
    timestamp: Date.now() - 12000,
    naturezaOperacao: "entrada",
    categoria: "multiplo",
    descricao: "Multiplo (somente especie no app)",
    valorSistema: 250,
    valorRecebidoFisico: 250,
    trocoSobra: 0.69,
    statusConferencia: "pendente",
  },
  {
    id: "t3",
    timestamp: Date.now() - 6000,
    naturezaOperacao: "pagamento",
    categoria: "sangria",
    descricao: "Despesa gasolina",
    valorSistema: 100,
    valorRecebidoFisico: 0,
    trocoSobra: 0,
    statusConferencia: "confirmada",
  },
];

export const mockLembretes: LembreteFantasma[] = [
  {
    id: "f1",
    timestamp: Date.now() - 5000,
    tipo: "pix_recebido_gaveta_saiu",
    descricao: "Gerente levou 10 fisico e vai enviar pix",
    valorReferencia: 10,
    impactaPixRepasse: true,
    resolvido: false,
    comprovadoPix: false,
  },
  {
    id: "f2",
    timestamp: Date.now() - 3000,
    tipo: "lembrete_geral",
    descricao: "Ricardo vai lancar amanha",
    valorReferencia: 45,
    impactaPixRepasse: false,
    resolvido: false,
    comprovadoPix: false,
  },
];
