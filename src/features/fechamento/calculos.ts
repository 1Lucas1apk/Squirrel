import { LembreteFantasma, TotaisTurno, Transacao } from "../../types/domain";

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function clampMoney(value: number): number {
  const LIMIT = 160000;
  if (value > LIMIT) {
    return LIMIT;
  }
  if (value < -LIMIT) {
    return -LIMIT;
  }
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

  const pixRepasse = lembretes
    .filter((item) => item.impactaPixRepasse)
    .reduce((acc, item) => acc + clampMoney(item.valorReferencia), 0);

  const especieEnvelope = roundMoney(Math.max(gavetaFisico - pixRepasse, 0));

  return {
    sistema,
    sobra,
    gavetaFisico,
    especieEnvelope: roundMoney(especieEnvelope),
    pixRepasse: roundMoney(pixRepasse),
  };
}
