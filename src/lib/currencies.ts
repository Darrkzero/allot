// Currencies offered in the "show amounts in" picker.
export const CURRENCIES = [
  "USD", "EUR", "GBP", "NGN", "KES", "GHS", "ZAR", "INR", "PKR", "BDT", "PHP", "IDR", "VND",
  "BRL", "ARS", "MXN", "COP", "TRY", "CAD", "AUD", "JPY", "CNY", "AED", "SGD",
];

export function fmtMoney(usd: number, currency: string, rates: Record<string, number>) {
  const rate = rates[currency] ?? (currency === "USD" ? 1 : NaN);
  if (!Number.isFinite(rate)) return null;
  return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: rate * usd >= 1000 ? 0 : 2 }).format(usd * rate);
}

/** Best-guess currency from the browser's locale region. */
export function guessCurrency(): string {
  if (typeof navigator === "undefined") return "USD";
  const region = (navigator.language.split("-")[1] || "").toUpperCase();
  const map: Record<string, string> = {
    US: "USD", GB: "GBP", NG: "NGN", KE: "KES", GH: "GHS", ZA: "ZAR", IN: "INR", PK: "PKR", BD: "BDT", PH: "PHP",
    ID: "IDR", VN: "VND", BR: "BRL", AR: "ARS", MX: "MXN", CO: "COP", TR: "TRY", CA: "CAD", AU: "AUD", JP: "JPY",
    CN: "CNY", AE: "AED", SG: "SGD", DE: "EUR", FR: "EUR", ES: "EUR", IT: "EUR", NL: "EUR", PT: "EUR", IE: "EUR",
  };
  return map[region] ?? "USD";
}
