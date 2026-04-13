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

export function calcularSobra(transacoes: Transacao[], ajusteManual = 0): number {
  const trocoAcumulado = transacoes.reduce((acc, item) => acc + clampMoney(item.trocoSobra), 0);
  return roundMoney(clampMoney(trocoAcumulado + ajusteManual));
}

export function calcularTotaisTurno(
  transacoes: Transacao[],
  lembretes: LembreteFantasma[],
  ajusteManualSobra = 0
): TotaisTurno {
  const sistema = calcularTotalSistema(transacoes);
  const sobra = calcularSobra(transacoes, ajusteManualSobra);
  const gavetaFisico = roundMoney(sistema + sobra);

  const pixDisponivelParaRepasse = lembretes
    .filter((item) => item.impactaPixRepasse)
    .reduce((acc, item) => acc + clampMoney(item.valorReferencia), 0);

  // LOGICA "SOBRA NO PIX":
  // Primeiro, vemos quanto de dinheiro físico "sobra" para a empresa após tirarmos o nosso pix de apoio.
  const especieDisponivelParaEmpresa = roundMoney(gavetaFisico - pixDisponivelParaRepasse);

  // O que vai no saco é o menor valor entre o que o sistema pede e o que temos de dinheiro físico "limpo".
  const especieEnvelope = roundMoney(Math.max(0, Math.min(sistema, especieDisponivelParaEmpresa)));

  // O Pix de Repasse assume todo o resto para fechar o valor do sistema.
  const pixRepasse = roundMoney(Math.max(0, sistema - especieEnvelope));

  return {
    sistema,
    sobra,
    gavetaFisico,
    especieEnvelope,
    pixRepasse,
  };
}
