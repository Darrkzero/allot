import "server-only";
import { SETTLE_ASSET } from "../../assets";
import type { Rule } from "../../rules";
import type { Policy } from "./agent-api";
import { payoutAsset } from "./payout-asset";

/**
 * Turns split rules into the policy the owner signs with their passkey.
 * The key safety property: destinations are "only" the owner's own rule addresses,
 * so even our own server (holding the grant) cannot send funds anywhere else.
 * Private slices need `confidential: true`; it stays off unless a rule asks for it, and the
 * destination lock applies to confidential withdrawals too (checked live: policy_destination_denied).
 */
export async function policyFromRules(rules: Rule[]): Promise<Policy> {
  const assetIds = new Set<string>([SETTLE_ASSET.assetId]);
  for (const r of rules) {
    const asset = await payoutAsset(r.symbol, r.chain);
    if (!asset) throw new Error(`No NEAR Intents asset for ${r.symbol} on ${r.chain}`);
    assetIds.add(asset);
  }
  const seen = new Set<string>();
  const list = rules
    .filter((r) => {
      const k = `${r.chain}:${r.address}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .map((r) => ({ action: "withdraw" as const, chain: r.chain, address: r.address, memo: null }));

  return {
    frozen: false,
    actions: ["swap", "withdraw"], // no "transfer": funds can't move to other Intents accounts
    confidential: rules.some((r) => r.private),
    owner_approval: false,
    assets: [...assetIds],
    limits: {},
    // Throttles, not the safety boundary (destinations are). Both must fit real use: each slice
    // costs 1 to 2 actions (swap + withdraw), and the API charges the budget for every swap AND
    // withdraw, so a $1 payment can use up to $2 of it. Sized for many max-size ($10k) invoices a day.
    max_actions_per_hour: 600,
    destinations: { mode: "only", list },
    budget: { daily_usd: "100000", weekly_usd: null, monthly_usd: null },
    timelock_ms: 0,
  };
}
