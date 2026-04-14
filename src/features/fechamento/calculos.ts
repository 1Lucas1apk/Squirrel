import { LembreteFantasma, TotaisTurno, Transacao } from "../../types/domain";

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function clampMoney(value: number): number {
  const LIMIT = 160000;
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
  let saldoPapelAjuste = 0; 
  let emprestimosFisicos = 0; 

  lembretes.forEach(item => {
    const v = clampMoney(item.valorReferencia);
    if (item.tipo === "pix_recebido_gaveta_saiu") {
      pixNoCaixa += v;
      saldoPapelAjuste -= v;
    } else if (item.tipo === "destroca_pix_por_nota") {
      pixNoCaixa -= v;
      saldoPapelAjuste += v;
    } else if (item.tipo === "dinheiro_emprestado" && !item.resolvido) {
      emprestimosFisicos += v;
    }
  });

  // 1. DEFINIÇÃO DE VARIÁVEIS (Fg = Dinheiro Físico na Gaveta)
  // Fg = (Ts + TrocoVendas + AjusteManual) + SaldoPapelAjuste + Emprestimos
  const gavetaFisico = roundMoney(sistema + trocoSobraVendas + ajusteManualSobra + saldoPapelAjuste + emprestimosFisicos);

  // 2. LÓGICA MATEMÁTICA CONDICIONAL (Obrigatória)
  let especieEnvelope = 0;
  let pixRepasse = 0;

  if (gavetaFisico >= sistema) {
    // CONDIÇÃO A: Gaveta cobre o sistema integralmente
    especieEnvelope = sistema;
    pixRepasse = 0;
  } else {
    // CONDIÇÃO B: Gaveta é insuficiente, usa Pix para completar
    especieEnvelope = gavetaFisico;
    pixRepasse = roundMoney(sistema - gavetaFisico);
  }

  // 3. SOBRA (ACUMULADA): Tudo que excede o pagamento do sistema
  // Sobra = Fg + PixNoCaixa - Ts
  const sobraAcumulada = roundMoney(gavetaFisico + pixNoCaixa - sistema);

  return {
    sistema,
    sobra: sobraAcumulada,
    gavetaFisico,
    especieEnvelope: roundMoney(especieEnvelope),
    pixRepasse: roundMoney(pixRepasse),
    pixNoCaixa: roundMoney(pixNoCaixa)
  };
}
