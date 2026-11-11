// Payout destinations Allot supports, and per-chain address validation.
// Shared by client and server (no secrets here).

export type ChainId =
  | "base" | "arb" | "eth" | "op" | "pol" | "avax" | "bsc"
  | "sol" | "tron" | "ton" | "near" | "btc" | "zec";

export const CHAIN_NAMES: Record<ChainId, string> = {
  base: "Base", arb: "Arbitrum", eth: "Ethereum", op: "Optimism", pol: "Polygon",
  avax: "Avalanche", bsc: "BNB Chain", sol: "Solana", tron: "Tron", ton: "TON",
  near: "NEAR", btc: "Bitcoin", zec: "Zcash",
};

// Other networks payers can pay from (1Click's chain ids). Unknown ids fall back to Title Case.
const OTHER_CHAIN_NAMES: Record<string, string> = {
  aptos: "Aptos", gnosis: "Gnosis", starknet: "Starknet", plasma: "Plasma", monad: "Monad", xlayer: "X Layer",
  aleo: "Aleo", hypercore: "HyperCore", sui: "Sui", bera: "Berachain", stellar: "Stellar", scroll: "Scroll",
  movement: "Movement", doge: "Dogecoin", xrp: "XRP Ledger", cardano: "Cardano", ltc: "Litecoin",
  bch: "Bitcoin Cash", dash: "Dash", miden: "Miden",
};

/** A network's display name: "arb" → "Arbitrum", "aptos" → "Aptos". */
export function chainLabel(id: string): string {
  return CHAIN_NAMES[id as ChainId] ?? OTHER_CHAIN_NAMES[id] ?? id.charAt(0).toUpperCase() + id.slice(1);
}

const EXPLORER_TX: Record<ChainId, string> = {
  base: "https://basescan.org/tx/", arb: "https://arbiscan.io/tx/", eth: "https://etherscan.io/tx/",
  op: "https://optimistic.etherscan.io/tx/", pol: "https://polygonscan.com/tx/", avax: "https://snowtrace.io/tx/",
  bsc: "https://bscscan.com/tx/", sol: "https://solscan.io/tx/", tron: "https://tronscan.org/#/transaction/",
  ton: "https://tonviewer.com/transaction/", near: "https://nearblocks.io/txns/", btc: "https://mempool.space/tx/",
  zec: "https://blockchair.com/zcash/transaction/",
};

export function explorerTx(chain: string, hash: string | null | undefined): string | null {
  if (!hash) return null;
  const base = EXPLORER_TX[chain as ChainId];
  return base ? base + hash : null;
}

/**
 * Private slices (NEAR Confidential Intents) pay out from the confidential balance on `intents.far`.
 * Dry-run previews on 11 Nov 2026 reached every option except these chains:
 * Tron and TON answered provider_unavailable, BNB Chain unsupported_chain.
 */
export const PRIVATE_UNSUPPORTED_CHAINS: ChainId[] = ["tron", "ton", "bsc"];
export const privateSupported = (chain: ChainId) => !PRIVATE_UNSUPPORTED_CHAINS.includes(chain);

/** (symbol, chain) pairs offered as payout destinations. */
export const PAYOUT_OPTIONS: { symbol: string; chain: ChainId }[] = [
  ...(["base", "arb", "eth", "op", "pol", "avax", "sol", "near"] as ChainId[]).map((chain) => ({ symbol: "USDC", chain })),
  ...(["tron", "bsc", "eth", "sol", "ton", "pol", "near"] as ChainId[]).map((chain) => ({ symbol: "USDT", chain })),
  { symbol: "BTC", chain: "btc" },
  ...(["base", "arb", "eth", "op"] as ChainId[]).map((chain) => ({ symbol: "ETH", chain })),
  { symbol: "SOL", chain: "sol" },
  { symbol: "ZEC", chain: "zec" },
];

const EVM: ChainId[] = ["base", "arb", "eth", "op", "pol", "avax", "bsc"];

// `hint` completes "That doesn't look like a <Chain> address: …", so it's written for people, not parsers.
const ADDRESS_RULES: Record<ChainId, { re: RegExp; hint: string }> = {
  ...(Object.fromEntries(EVM.map((c) => [c, { re: /^0x[0-9a-fA-F]{40}$/, hint: "it should start with 0x and be 42 characters long" }])) as Record<string, { re: RegExp; hint: string }>),
  sol: { re: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/, hint: "it should be 32 to 44 letters and numbers" },
  tron: { re: /^T[1-9A-HJ-NP-Za-km-z]{33}$/, hint: "it should start with T and be 34 characters long" },
  ton: { re: /^(?:[EU]Q[A-Za-z0-9_-]{46}|-?\d:[0-9a-fA-F]{64})$/, hint: "it should start with EQ or UQ" },
  near: { re: /^(?=.{2,64}$)(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/, hint: "it should look like yourname.near" },
  btc: { re: /^(?:bc1[02-9ac-hj-np-z]{11,71}|[13][1-9A-HJ-NP-Za-km-z]{25,34})$/, hint: "it should start with bc1, 1 or 3" },
  zec: { re: /^t[13][1-9A-HJ-NP-Za-km-z]{33}$/, hint: "it should start with t1 or t3 (private z-addresses aren't supported)" },
} as Record<ChainId, { re: RegExp; hint: string }>;

/** Returns the normalized address, or an error message (a full sentence, ending with a period). */
export function checkAddress(chain: ChainId, raw: string): { ok: true; address: string } | { ok: false; error: string } {
  const address = raw.trim();
  const rule = ADDRESS_RULES[chain];
  if (!rule) return { ok: false, error: `Payouts to ${chain} aren't supported.` };
  if (!rule.re.test(address)) return { ok: false, error: `That doesn't look like a ${CHAIN_NAMES[chain]} address: ${rule.hint}.` };
  // The Agent API requires canonical lowercase EVM addresses.
  return { ok: true, address: EVM.includes(chain) ? address.toLowerCase() : address };
}

/** What every incoming payment is converted into on arrival, before splitting. */
export const SETTLE_ASSET = {
  assetId: "nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near",
  symbol: "USDC",
  chain: "base" as ChainId,
  decimals: 6,
};

export function toAtomic(amount: number, decimals: number): string {
  // Avoid float error: format with fixed decimals, then strip the dot.
  const [whole, frac = ""] = amount.toFixed(decimals).split(".");
  return (BigInt(whole) * 10n ** BigInt(decimals) + BigInt(frac.padEnd(decimals, "0") || "0")).toString();
}

export function fromAtomic(atomic: string | bigint, decimals: number): number {
  const v = BigInt(atomic);
  const base = 10n ** BigInt(decimals);
  return Number(v / base) + Number(v % base) / Number(base);
}
