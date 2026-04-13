export function parseMoneyInput(raw: string): number {
  const clean = raw.trim().replace(/[^\d,.-]/g, "");
  if (!clean) {
    return 0;
  }

  const lastComma = clean.lastIndexOf(",");
  const lastDot = clean.lastIndexOf(".");
  const decimalIndex = Math.max(lastComma, lastDot);

  let normalized = clean;
  if (decimalIndex >= 0) {
    const integerPart = clean.slice(0, decimalIndex).replace(/[^\d-]/g, "");
    const decimalPart = clean.slice(decimalIndex + 1).replace(/[^\d]/g, "");
    normalized = `${integerPart || "0"}.${decimalPart || "0"}`;
  } else {
    normalized = clean.replace(/[^\d-]/g, "");
  }

  const parsed = Number(normalized);
  if (Number.isNaN(parsed)) {
    return 0;
  }
  return Math.round((parsed + Number.EPSILON) * 100) / 100;
}
