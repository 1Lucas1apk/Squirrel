const BRL_FORMATTER = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function toBrl(value: number): string {
  return BRL_FORMATTER.format(value);
}
