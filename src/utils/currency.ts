const BRL_FORMATTER = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function toBrl(value: number): string {
  return BRL_FORMATTER.format(value || 0).replace(/[\u00a0\u202f]/g, ' ').replace(/\s+/g, ' ');
}

