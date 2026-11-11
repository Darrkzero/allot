import "server-only";

// Fiat exchange rates for showing amounts in the payer's and recipient's own currency.
// Free, no key: https://github.com/fawazahmed0/exchange-api
const SOURCES = [
  "https://latest.currency-api.pages.dev/v1/currencies/usd.json",
  "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json",
];

let cache: { at: number; rates: Record<string, number> } | null = null;

export async function usdRates(): Promise<Record<string, number>> {
  if (cache && Date.now() - cache.at < 60 * 60_000) return cache.rates;
  for (const url of SOURCES) {
    try {
      const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8_000) });
      if (!res.ok) continue;
      const json = (await res.json()) as { usd: Record<string, number> };
      const rates = Object.fromEntries(Object.entries(json.usd).map(([k, v]) => [k.toUpperCase(), v]));
      cache = { at: Date.now(), rates };
      return rates;
    } catch {
      // try next source
    }
  }
  return cache?.rates ?? { USD: 1 };
}
