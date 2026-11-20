/** "65.50" o "65,50" → 6550 centavos. Devuelve NaN si no es válido. */
export function parseMoneyToCents(input: string): number {
  const s = input.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return NaN;
  return Math.round(Number(s) * 100);
}

export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function formatMoney(cents: number, currency = "USD", locale = "es"): string {
  try {
    return new Intl.NumberFormat(locale === "es" ? "es-US" : locale, { style: "currency", currency }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}
