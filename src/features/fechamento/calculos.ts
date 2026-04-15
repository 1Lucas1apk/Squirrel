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
  ajusteManualSobra = 0
): TotaisTurno {
  const sistema = calcularTotalSistema(transacoes);
  const trocoSobraVendas = transacoes.reduce((acc, item) => acc + clampMoney(item.trocoSobra), 0);
  
  let pixNoCaixa = 0;      
  let pixDiretoLoja = 0;
  let saldoPapelAjuste = 0; 
  let emprestimosFisicos = 0; 

  lembretes.forEach(item => {
    const v = clampMoney(item.valorReferencia);
    const isDiretoLoja = item.destinoPix && item.destinoPix !== "Meu Pix" && item.destinoPix !== "Operador";

    if (item.tipo === "pix_recebido_gaveta_saiu") {
      if (isDiretoLoja) {
        pixDiretoLoja += v;
      } else {
        pixNoCaixa += v;
      }
      saldoPapelAjuste -= v;
    } else if (item.tipo === "destroca_pix_por_nota") {
      if (isDiretoLoja) {
        pixDiretoLoja -= v;
      } else {
        pixNoCaixa -= v;
      }
      saldoPapelAjuste += v;
    } else if (item.tipo === "dinheiro_emprestado" && !item.resolvido) {
      emprestimosFisicos += v;
    }
  });

  // 1. DEFINIÇÃO DE VARIÁVEIS (Fg = Dinheiro Físico na Gaveta)
  // Fg = (Ts + TrocoVendas + AjusteManual) + SaldoPapelAjuste + Emprestimos
  const gavetaFisico = roundMoney(sistema + trocoSobraVendas + ajusteManualSobra + saldoPapelAjuste + emprestimosFisicos);

  // O sistema real que o operador precisa pagar em malote (pois a loja já recebeu pixDiretoLoja na conta dela)
  const sistemaPendente = Math.max(0, roundMoney(sistema - pixDiretoLoja));

  // 2. LÓGICA MATEMÁTICA CONDICIONAL (Obrigatória)
  let especieEnvelope = 0;
  let pixRepasse = 0;

  // Usa o dinheiro disponível, exceto o que é empréstimo (que precisa ser devolvido)
  const disponivelParaMalote = Math.max(0, roundMoney(gavetaFisico - emprestimosFisicos));

  if (disponivelParaMalote >= sistemaPendente) {
    // CONDIÇÃO A: Gaveta cobre o sistema integralmente
    especieEnvelope = sistemaPendente;
    pixRepasse = 0;
  } else {
    // CONDIÇÃO B: Gaveta é insuficiente, usa Pix para completar
    especieEnvelope = disponivelParaMalote;
    pixRepasse = roundMoney(sistemaPendente - disponivelParaMalote);
  }

  // 3. SOBRA (ACUMULADA): Tudo que excede o pagamento do sistema (incluindo pixDiretoLoja que quitou o sistema)
  // Sobra = Fg + PixNoCaixa + PixDiretoLoja - Ts - Emprestimos
  const sobraAcumulada = roundMoney((gavetaFisico - emprestimosFisicos) + pixNoCaixa + pixDiretoLoja - sistema);

  return {
    sistema,
    sobra: sobraAcumulada,
    gavetaFisico,
    especieEnvelope: roundMoney(especieEnvelope),
    pixRepasse: roundMoney(pixRepasse),
    pixNoCaixa: roundMoney(pixNoCaixa),
    pixDiretoLoja: roundMoney(pixDiretoLoja)
  };
}
