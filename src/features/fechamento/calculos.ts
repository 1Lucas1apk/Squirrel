import { LembreteFantasma, TotaisTurno, Transacao } from "../../types/domain";

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function clampMoney(value: number): number {
  const LIMIT = 100000;
  if (value > LIMIT) return LIMIT;
  if (value < -LIMIT) return -LIMIT;
  return value;
}

export function calcularTotalSistema(transacoes: Transacao[]): number {
  return roundMoney(
    transacoes.reduce((acc, item) => {
      const valorSistema = clampMoney(item.valorSistema);
      if (item.categoria === "sangria" || item.categoria === "cancelamento") {
        return acc - valorSistema;
      }
      return acc + valorSistema;
    }, 0)
  );
}

export function calcularSobraBase(transacoes: Transacao[], ajusteManual = 0): number {
  const trocoAcumulado = transacoes.reduce((acc, item) => acc + clampMoney(item.trocoSobra), 0);
  return roundMoney(clampMoney(trocoAcumulado + ajusteManual));
}

export function calcularTotaisTurno(
  transacoes: Transacao[],
  lembretes: LembreteFantasma[],
  registrosPOS: import("../../types/domain").RegistroPOS[] = [],
  registrosConvenio: import("../../types/domain").RegistroConvenio[] = [],
  ajusteManualSobra = 0,
  posRelatorioTotal = 0,
  posSomaOutrosTurnos = 0
): TotaisTurno {
  const sistema = calcularTotalSistema(transacoes);

  // Calcula sobras ou diferenças reais de vendas (troco que ficou na gaveta)
  const trocoSobraVendas = transacoes.reduce((acc, item) => {
    if (item.categoria === "sangria" || item.categoria === "cancelamento") return acc;
    if (item.trocoSobra !== undefined && item.trocoSobra !== 0) {
      return acc + clampMoney(item.trocoSobra);
    }
    if (item.valorRecebidoFisico !== undefined && item.valorRecebidoFisico > 0 && item.valorRecebidoFisico !== item.valorSistema) {
      return acc + clampMoney(item.valorRecebidoFisico - item.valorSistema);
    }
    return acc;
  }, 0);

  let pixNoCaixa = 0;      // Pix no celular do Operador
  let pixDiretoLoja = 0;   // Pix informal que foi direto p/ Gerente/Loja
  let saldoPapelAjuste = 0; 
  let emprestimosFisicos = 0; 

  lembretes.forEach(item => {
    const v = clampMoney(item.valorReferencia || 0);
    const isDiretoLoja = Boolean(item.destinoPix && item.destinoPix !== "Meu Pix" && item.destinoPix !== "Operador");

    if (item.tipo === "pix_recebido_gaveta_saiu") {
      if (isDiretoLoja) {
        pixDiretoLoja += v;
      } else {
        pixNoCaixa += v;
      }
      saldoPapelAjuste -= v; // Saiu nota da gaveta p/ entrar Pix
    } else if (item.tipo === "destroca_pix_por_nota") {
      if (isDiretoLoja) {
        pixDiretoLoja -= v;
      } else {
        pixNoCaixa -= v;
      }
      saldoPapelAjuste += v; // Entrou nota na gaveta p/ "limpar" Pix
    } else if (item.tipo === "dinheiro_emprestado" && !item.resolvido) {
      emprestimosFisicos += v;
    }
  });

  // 1. GAVETA FÍSICA REAL (Fg = Dinheiro Físico em Cédulas e Moedas na Gaveta)
  // Fg = (Ts + TrocoSobraVendas + AjusteManual) + SaldoPapelAjuste + Emprestimos
  const gavetaFisico = roundMoney(sistema + trocoSobraVendas + (ajusteManualSobra || 0) + saldoPapelAjuste + emprestimosFisicos);

  // O sistema líquido pendente que o malote precisa cobrir (abate o que a loja já recebeu em Pix direto dela)
  const sistemaPendente = Math.max(0, roundMoney(sistema - pixDiretoLoja));

  // 2. LÓGICA DO MALOTE (Target = 100% do Sistema)
  // Dinheiro disponível para o malote (exclui empréstimos de terceiros que devem ser devolvidos)
  const disponivelParaMalote = Math.max(0, roundMoney(gavetaFisico - emprestimosFisicos));

  let especieEnvelope = 0;
  let pixRepasse = 0;

  if (disponivelParaMalote >= sistemaPendente) {
    // Caso A: Gaveta cobre o sistema integralmente em espécie
    especieEnvelope = sistemaPendente;
    pixRepasse = 0;
  } else {
    // Caso B: Falta dinheiro em espécie na gaveta (trocas informais).
    // O saco leva o dinheiro físico disponível e o Pix Repasse completa a diferença exata.
    especieEnvelope = disponivelParaMalote;
    pixRepasse = roundMoney(sistemaPendente - disponivelParaMalote);
  }

  // 3. SOBRA REAL ACUMULADA
  // Sobra = (Gaveta - Empréstimos) + PixNoCaixa + PixDiretoLoja - Sistema
  const sobraAcumulada = roundMoney((gavetaFisico - emprestimosFisicos) + pixNoCaixa + pixDiretoLoja - sistema);

  // Totais de POS e Convênios
  const posDoTurnoCorrigido = Math.max(0, posRelatorioTotal - posSomaOutrosTurnos);
  const totalPOS = roundMoney(registrosPOS.reduce((acc, r) => acc + clampMoney(r.valor || 0), posDoTurnoCorrigido));
  const totalConvenio = roundMoney(registrosConvenio.reduce((acc, r) => acc + clampMoney(r.valor || 0), 0));

  return {
    sistema,
    sobra: sobraAcumulada,
    gavetaFisico,
    especieEnvelope: roundMoney(especieEnvelope),
    pixRepasse: roundMoney(pixRepasse),
    pixNoCaixa: roundMoney(pixNoCaixa),
    pixDiretoLoja: roundMoney(pixDiretoLoja),
    totalPOS,
    totalConvenio
  };
}
