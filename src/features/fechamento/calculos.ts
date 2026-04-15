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
  
  // 1. GAVETA FÍSICA REAL
  // Soma o que foi recebido de fato (considerando sobras/erros) e abate as sangrias/estornos
  const realEntradaFisica = transacoes.reduce((acc, item) => {
    if (item.categoria === "sangria" || item.categoria === "cancelamento") {
      return acc - clampMoney(item.valorSistema); 
    }
    return acc + clampMoney(item.valorRecebidoFisico);
  }, 0);

  let pixNoCaixa = 0;      // Pix no celular do Operador
  let pixDiretoLoja = 0;   // Pix informal que foi p/ Gerente/Loja
  let saldoPapelAjuste = 0; 
  let emprestimosFisicos = 0; 

  lembretes.forEach(item => {
    const v = clampMoney(item.valorReferencia);
    const isMeuPix = !item.destinoPix || item.destinoPix === "Meu Pix" || item.destinoPix === "Operador";

    if (item.tipo === "pix_recebido_gaveta_saiu") {
      if (isMeuPix) pixNoCaixa += v; else pixDiretoLoja += v;
      saldoPapelAjuste -= v; // Saiu nota da gaveta p/ entrar Pix
    } else if (item.tipo === "destroca_pix_por_nota") {
      if (isMeuPix) pixNoCaixa -= v; else pixDiretoLoja -= v;
      saldoPapelAjuste += v; // Entrou nota na gaveta p/ "limpar" Pix
    } else if (item.tipo === "dinheiro_emprestado" && !item.resolvido) {
      emprestimosFisicos += v;
    }
  });

  // Dinheiro que existe fisicamente na gaveta agora
  const gavetaFisico = roundMoney(realEntradaFisica + ajusteManualSobra + saldoPapelAjuste + emprestimosFisicos);

  // 2. LÓGICA DO MALOTE (Target = 100% do Sistema)
  // Dinheiro disponível para o saco (tirando o que é de terceiros/empréstimo)
  const disponivelParaMalote = Math.max(0, roundMoney(gavetaFisico - emprestimosFisicos));

  let especieEnvelope = 0;
  let pixRepasse = 0;

  if (disponivelParaMalote >= sistema) {
    // Caso A: Gaveta tem tudo ou mais que o sistema. O saco vai exato com o valor do sistema.
    especieEnvelope = sistema;
    pixRepasse = 0;
  } else {
    // Caso B: Falta papel na gaveta (devido às trocas). 
    // O saco leva o que tem de papel e o Pix Repasse é o que você transfere no Bradesco p/ completar.
    especieEnvelope = disponivelParaMalote;
    pixRepasse = roundMoney(sistema - disponivelParaMalote);
  }

  // 3. SOBRA REAL ACUMULADA
  // É tudo o que você tem (Gaveta + Pix no Celular + Pix com Gerente) menos o que deve à Loja (Sistema) e Empréstimos
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
