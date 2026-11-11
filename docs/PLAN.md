# Allot: project plan (working name)

**One line:** Get paid in any token on any chain, and have every payment sorted the moment it arrives: a slice for taxes, a slice for savings, the rest to spend. Each slice goes to the chain and token you choose.

**Hackathon tracks:**
- `realworld` (main)
- `open`
- `security`, if the auto-split is policy-locked (Path A below)
- `privacy`, if a slice uses Confidential Intents

**Deadline:** 14 Nov 2026, 23:59 UTC. We submit by 14 Nov, 12:00 UTC at the latest.

---

## 1. The problem

1. **Chain mismatch.** Payers and recipients hold stablecoins on different chains: USDT is on 13 chains and USDC on 17. Today someone has to bridge, swap and buy gas, and a wrong-network send loses the money.
2. **Nobody sets money aside.** Freelancers and small businesses everywhere are told to split income on arrival (taxes, savings, spending). Banks offer "pots" for this. Crypto has nothing equivalent, let alone across chains.
3. **Income is public.** Anyone who knows your address can see every payment you receive.

## 2. User flows

**Recipient (one-time setup, about 2 minutes)**
1. Sign in with a NEAR wallet.
2. Create split rules, which must add up to 100%. Each rule has a label, a percentage, a destination chain, a token and an address. For example:
   - Spending: 70% → USDC on Base
   - Tax reserve: 20% → USDC, private (Confidential Intents)
   - Savings: 10% → BTC on Bitcoin
3. Approve the rules once in the wallet. In Path A this signature is what locks the money to these destinations.
4. Get a payment link, with an optional amount and memo, for example `allot.app/pay/chima?amount=500&memo=Logo+design`.

**Payer (no account needed)**
1. Open the link and see the amount in USD and in their local currency.
2. Pick the token and chain they already hold, from 215 tokens on 39 chains.
3. See a live quote and a deposit address, then send one transfer.
4. Watch the status: waiting → received → split done. The page shows refunds if the payment fails.

**After payment (automatic)**
1. The payment arrives in the recipient's router balance inside NEAR Intents.
2. The split engine sends each slice to its destination, a different chain and token per slice.
3. The dashboard shows every payment, every slice, explorer links and a CSV export.

## 3. Screens

| # | Screen | Key elements |
|---|---|---|
| 1 | Landing | One-line pitch, "Create your rules", "Try demo (no funds)" |
| 2 | Rules setup | Rule rows (label, %, chain, token, address, private toggle), a 100% check, preview of "if you're paid $1,000, here's where it goes" with live fees, approve button |
| 3 | Pay page (public link) | Amount in USD and local currency, token and chain picker, live quote, QR code and deposit address, status timeline |
| 4 | Dashboard | Payments list. Per payment: each slice with status and explorer link. Totals per pot. CSV export. |
| 5 | Receipt | Shareable receipt: who paid, what for, what each pot received |

## 4. How it works

```
Payer (any chain)
  → 1Click quote (recipientType: INTENTS)
  → Router account balance (NEAR Intents)
  → split engine
      ├─ 70% → USDC on Base
      ├─ 20% → private balance (Confidential Intents)
      └─ 10% → BTC on Bitcoin
```

### Path A: fully automatic, preferred if the day-0 test passes

- The recipient gets a policy-bound agent wallet through the **NEAR Intents Agent API**.
- The recipient signs a policy with these settings:
  - `actions: [swap, withdraw, transfer]`
  - `destinations: only` the rule addresses
  - `assets` limited to the rule tokens
  - optional daily limits
- The emergency `frozen` switch means the recipient can stop everything at any time.
- The split engine runs on our server and executes the slices. **If the server is hacked, the policy still blocks any send outside the recipient's own approved addresses.** This is the security story: software can move your money but can't steal it.

### Path B: fallback, "one-tap split"

- Payments land in the recipient's own NEAR Intents balance (`recipientType: INTENTS`, recipient = their account).
- The dashboard prepares one quote per slice (`depositType: INTENTS`). The recipient approves the split with a wallet signature (NEP-413, via `generate-intent` and `submit-intent`).
- The app never holds the funds. It's less automatic, but still unique.

### Common to both paths

- **Demo mode** for judges: no wallet, no funds, no keys. It uses live dry-run quotes (`dry: true`) to show the exact amount each slice would receive, plus a scripted walkthrough of a full payment.
- **Prices and currency:**
  - Token prices come from the 1Click token list.
  - Local currencies (150+, including NGN, EUR and BRL) come from a free exchange-rate API.
- **Statuses** are shown everywhere: `PENDING_DEPOSIT`, `PROCESSING`, `SUCCESS`, `INCOMPLETE_DEPOSIT`, `REFUNDED`, `FAILED`.
- **Fee guard:** warn when a slice is too small for its chain, for example a $2 slice to Bitcoin where the network fee eats it. Enforce a sensible minimum payment.

**Stack:**
- TypeScript, Next.js (React UI plus server routes)
- NEAR Wallet Selector (HOT, Meteor, MyNearWallet)
- near-api-js
- 1Click API, Agent API
- SQLite locally; a hosted database for the live demo
- Vitest for tests

### D0 test results (8 Nov): ✅ Path A confirmed

Script: `spike/agent-policy-test.mjs`. Throwaway EVM owner, $0 balance, run on mainnet via the Agent API (custody contract `outlayer.near`).

| Step | Result |
|---|---|
| `agent_create`, owner signs the policy (EIP-712) | `SUCCESS`. Agent `ACTIVE`, policy `APPLIED` (revision 1). Intents account is a 64-hex implicit account. |
| `grant_issue`, owner signs the backend's permission | `SUCCESS`. Our server holds the `ngt_` token, and the owner signed only its SHA-256 hash. |
| Dry-run withdraw to the allowed address | `policy_check: {address_allowed: true, within_limits: true}`, plus a budget readout |
| **Live withdraw to a non-approved address using our grant** | **`403 policy_destination_denied`**. Our server can't send funds anywhere the owner didn't approve. |
| Live withdraw to the allowed address | Passes the policy, then fails only on `insufficient_balance`. "Nothing was submitted or charged." |
| 1Click payment into the agent account (`recipientType: INTENTS`) | 100 USDC on Arbitrum → 99.99 USDC in the agent account, about 25 s. 0.05 ETH → 111.89 USDC, about 45 s. |

**Format details learned:**
- EVM addresses must be lowercase.
- An EVM owner's `public_key` is `0x` + 128 hex, without the `04` prefix.
- Mutating calls need an `Idempotency-Key` header.

**Notes:**
- The API labels itself an "experimental, mainnet-only beta. Keep amounts small." This goes in the README.
- 1Click's `generate-intent` timed out (server-side) on 8 Nov. Path A doesn't depend on it.

### Progress log

**8 Nov (D0 + most of D1) ✅**
- Next.js 16 app scaffolded. Pages: landing, `/create` (rules editor with live preview and passkey setup), `/pay/[handle]` (any-token checkout with live quotes and local currency), `/pay/status/[id]` (deposit address, QR, live status timeline, refund states).
- API routes:
  - `/api/routers` (create), `/api/routers/[handle]/sign` (two passkey signatures), `/api/routers/[handle]` (public info)
  - `/api/pay/quote` (dry or real `EXACT_OUTPUT` quote into the router's Intents account), `/api/pay/[id]` (status)
  - `/api/options` (payout options, tokens to pay with, exchange rates)
- Grant tokens are encrypted at rest (AES-256-GCM). SQLite via `node:sqlite`.
- `tests/e2e/setup-flow.mjs`: a software passkey runs the whole setup plus a payer quote against the live Agent API. **Passes.**

**8 Nov: split engine ✅** (`src/lib/server/payments/split.ts`)
- On payment `SUCCESS`, the delivered amount is split by rule percentages (dust goes to the largest rule), giving one "leg" per rule.
- A leg in the settlement asset (USDC on Base) withdraws directly. Any other leg swaps inside the agent account, then withdraws what the swap delivered.
- Deterministic Idempotency-Keys: `allot:<payment>:<rule>:<phase>:<key_n>`.
  - Unknown outcomes (network errors, 429, 5xx) retry with the **same** key, so nothing is sent twice.
  - A 4xx rejection ("nothing submitted or charged") retries with a **fresh** key (`key_n++`), so a cached rejection can't block the retry once funds are spendable.
- Triggered by every status poll (`/api/pay/[id]`) and by `/api/split/sweep`, which a cron job or the dashboard can call.
- The payer's status page shows the split's progress per slice. Addresses and transaction hashes are visible to the owner only.
- Simulated paid $25 payment, empty wallet: 17.50 / 5.00 / 2.50 split correctly. Direct and swap routes were chosen correctly. Every call reached the Agent API, passed the policy, and was held only by `insufficient_balance`, which is retried as designed.

**8 Nov: owner dashboard ✅** (`/dashboard/[handle]`)
- Passkey sign-in: a one-time server challenge (2 min, single use) is verified server-side (`src/lib/server/auth/webauthn.ts`). The check covers credential id, ceremony type, challenge, origin, rpId hash, the UP and UV flags, and the ES256 signature over authData plus sha256(clientData). On success the owner gets an HMAC-signed httpOnly session cookie (12 h) scoped to that handle.
- Dashboard features:
  - a "Request a payment" link builder (amount and memo);
  - one card per pot, showing delivered and on-the-way totals;
  - the payment list with every slice, its status, explorer links and errors;
  - "Retry held slices" (fresh idempotency keys; funds never leave the locked wallet);
  - a locked-wallet panel (allowed destinations, current balance, NEAR account link);
  - CSV export with one row per slice;
  - auto-refresh while anything is in flight.
- `npm run e2e` extended. It verifies:
  - no session → 401;
  - forged signature → 401;
  - reused challenge → 400;
  - valid sign-in gives a cookie;
  - the dashboard lists the payment and shows full addresses;
  - a session for one link can't open another link's dashboard;
  - CSV export works.

  **All pass.**

**10–11 Nov: design + motion ✅**
- **Visual style:** a dark premium theme with Manrope type and white pill buttons. The landing page is a full-bleed hero, with a header arranged like the reference. Real token logos (@web3icons, MIT) are bundled locally in `src/lib/token-logos.ts`.
- **3D hero** (`src/components/coin-vortex/`, React Three Fiber):
  - Real-logo coins orbit the glowing Allot coin. Faces are textured in the browser; materials and textures are cached and shared.
  - **The intro:** coins spiral in and lock into orbit. The Allot coin spins in, overshoots slightly, and lands with a glow pulse. The intro clock starts at the first rendered frame, so slow devices still see it. At the end the scene fires `allot:coins-landed`, which starts the cards and the count-up.
  - **Interaction:** the orbit tilts toward the pointer. Scrolling speeds up the orbit, spreads the coins and dollies the camera, with eased smoothing.
  - **Adaptive resolution:** `PerformanceMonitor` lowers the pixel ratio when frames drop.
- **Page motion** (`src/components/landing/motion.tsx`, CSS-only transforms):
  - headline lines rise out of a mask;
  - blur-fade intros;
  - `<Reveal>` scroll reveals with stagger;
  - an endless logo marquee;
  - a typed security terminal;
  - a shine sweep on buttons;
  - reduced motion is respected throughout.
- **Performance fixes:**
  - no `backdrop-filter` over the WebGL canvas;
  - removed `background-attachment: fixed`;
  - no SVG filters on moving shapes;
  - cheaper materials, shared geometry and edge materials;
  - DPR capped at 1.5;
  - the scene pauses when off-screen.
- **Result:** about 60 FPS and about 0–1% slow frames (`scripts/visual/motion-check.mjs`). The intro measures 3.1 s from canvas to coins landed (`scripts/visual/intro-timing.mjs`).

**11 Nov: private slices (Confidential Intents, `privacy` track) ✅**
- **What it does:** any rule can be marked private. Its slice is shielded into the owner's confidential balance (NEAR Confidential Intents, on `intents.far`), then swapped and withdrawn from there with `confidential: true`. Payers and the public NEAR explorer don't see where it goes; payer views show only "Private · 20%".
- **Safety:** the policy turns `confidential` on only when a rule is private. The destination lock still applies to confidential withdrawals.
- **Checked live, no funds** (`spike/confidential-test.mjs`, on the throwaway test wallet):
  - `shield` with confidential off → `policy_action_denied`;
  - owner `policy_update` → confidential on (revision 2);
  - `shield` then passes policy (only `insufficient_balance`);
  - confidential withdraw to an unapproved address → `policy_destination_denied`.
- **Reachable privately** (`spike/confidential-payouts.mjs`, dry-run previews): every payout option except USDT on Tron and TON (`provider_unavailable`) and USDT on BNB Chain (`unsupported_chain`). The private switch is disabled for those chains, and the server rejects them.
- **Honest limits** (stated in the UI and to go in the README): access control, not cryptography. FAR operators and Defuse can read confidential state, the solver layer sees intents, the shield step is public, and the final transfer is public on its own chain.
- **BTC payout fix found on the way:** 1Click had no liquidity for USDC → BTC held inside Intents (`btc.omft.near`), even for public slices. BTC slices now swap to nBTC (`nbtc.bridge.near`, ~10 s), then withdraw to the Bitcoin chain (dry-run verified, public and private). See `src/lib/server/near/payout-asset.ts`.
- **Tests:**
  - `npm run e2e` now creates a link with a private slice and a BTC slice. It checks that confidential is on, nBTC is in the policy, the public pages mask the private slice, the owner sees it in full, and a private Tron slice is refused.
  - A synthetic paid payment drove the real engine against the empty wallet. All three slices (withdraw, **shield**, swap to nBTC) stopped only at `insufficient_balance`.

**11 Nov: bug review ✅** (all fixes verified: unit test of the DB reset and sweep order, the e2e run, and paced retries on the real engine)
- **Policy limits too low:** NEAR charges the daily budget for every swap *and* withdraw, so a $5,000/day budget failed invoices over about $3.8k (the pay page allows $10k), and 120 actions an hour capped a link at about 24 payments an hour. Now $100,000 a day and 600 actions an hour (throttles only; the destination lock is the safety boundary). **Links created before this keep the old limits.**
- **Retry could double-send:** "Retry held slices" resubmitted any failed step with a fresh key, even when the original was still in flight or had succeeded without reporting its output. With the wallet's pooled balance, that could spend another payment's money. Now a step is resubmitted only if NEAR reported it FAILED or REFUNDED; otherwise the original is re-checked.
- **CSV formula injection:** a payer's memo like `=HYPERLINK(…)` reached the owner's spreadsheet as a formula. Cells starting with `= + - @` are now neutralised.
- **Retry budget burnable:** each poll from any viewer, and the public sweep endpoint, used one of the 40 attempts, so slices could fail in seconds. Now retries are paced to one every 5 s per slice (at least 5 minutes in total).
- **Setup could get stuck:** a retry after a timeout resubmitted a *new* passkey signature (the API is idempotent only for the same one). Now a signature is submitted only while the intent is still `PENDING_SIGNATURE`.
- **Smaller fixes:**
  - the dashboard resumes live refresh after sign-in and after a retry;
  - every NEAR, 1Click and exchange-rate call has a timeout;
  - the sweeper processes pending payments fairly;
  - a stranger can't wipe an in-progress setup;
  - the status page stops polling a payment that doesn't exist;
  - the pay form recovers from network errors;
  - the dropdown never shows a wrong ✓.
- **The four gaps first left open are now fixed:**
  - **Never spend more than arrived:** a step's output is the reported amount, else NEAR's guaranteed `min_amount_out`, never the requested amount. For a shield that reports nothing, it's what's actually spendable in the confidential balance (retried while that's 0).
  - **Review pauses:** `UNCERTAIN`/`NEEDS_REVIEW` keep the slice in progress with a clear note ("Under review"). It's re-checked every 60 s, with `refresh=true` for NEEDS_REVIEW, and is never failed.
  - **Grant renewal:** the dashboard shows when auto-split's permission lapses (amber within 14 days) and renews it for 90 days with one passkey approval (`/api/dashboard/[handle]/grant`). The new token only replaces the old once NEAR confirms it.
  - **Rate limiting:** an in-memory per-IP limiter (`src/lib/server/rate-limit.ts`; one server process, so in-process counters are complete) covers link setup, sign-in, quotes (previews vs real deposit addresses), the status page, link info and the sweep. Behind a CDN, set `ALLOT_PROXY_HOPS=2`.
- **Verified:**
  - e2e, live: renewal through NEAR, and the 7th sweep in a minute gets 429.
  - The renewed grant drives the real engine.
  - The engine test runs the real `split.ts` against a mock NEAR API covering: missing amounts, guaranteed minimum, review pause/gap/refresh, nothing spendable yet.

**11 Nov: plain-language pass ✅**
- **One vocabulary everywhere:**
  - link name (was "handle");
  - pots (was "rules" or "slices");
  - wallet address;
  - payment address (was "deposit address").
- No NEAR, policy or settle jargon in the payer's flow.
- **Create:**
  - three numbered steps (About you, Your pots, Lock it in);
  - every field has a visible label;
  - a live link preview and an "N% left to assign" badge;
  - the passkey steps are explained up front, with a progress checklist;
  - technical approval text sits under "What you're approving".
- **Pay:**
  - three steps;
  - six one-tap currencies with logos, plus "Search all 222 currencies" with proper network names;
  - the refund address is explained;
  - the button tells you what's still missing.
- **Status:**
  - the recipient's name instead of the link name;
  - copy buttons for the amount, address and memo;
  - a wrong-network warning;
  - plain progress steps;
  - "All done" when finished;
  - an expired address links to a new payment.
- **Dashboard:**
  - payment and pot states in plain words;
  - a labeled payment request;
  - "Download for accountant (CSV)";
  - a "Your wallet" explanation.
- **Errors say what happened and how to fix it:** address checks, totals, link names, passkey cancel or timeout, offline, and 1Click quote errors (translated, with the original kept in the log).

**11 Nov: create page layout.** A 3-step stepper version was tried, then reverted at the user's request: the create page stays a single page (About you and Your pots on the left; the $1,000 preview and "Lock it in" on the right).

**11 Nov: folder structure ✅**
- **Root:**
  - `docs/` holds PLAN.md and RESEARCH.md;
  - `tests/e2e/setup-flow.mjs` runs via `npm run e2e`;
  - `scripts/visual/` holds the screenshot and FPS tools, plus `scripts/check-near-ai-key.mjs`;
  - the unused Next.js starter SVGs are gone.
- **`src/app`:**
  - the landing page is in `(marketing)/`;
  - each app page keeps its own components in a `_components/` folder next to it (a private folder, never routed);
  - the create form is split into create-form, pot-card, split-bar, payout-preview and done;
  - the dashboard into dashboard, grant-renewal and request-payment.
- **`src/components`:** `ui/` (shared) and `landing/` (3D coins, motion, split diagram).
- **`src/lib`:**
  - shared domain code at the top (assets, rules, currencies), plus `logos/` and `client/`;
  - `server/` is grouped into `near/` (Agent API, 1Click, policy, grant, payout asset), `payments/` (split engine, refresh) and `auth/` (session, WebAuthn), with infrastructure (db, env, http, seal, rate-limit, fx) at its root.
- **Moved by script:** 64 imports rewritten. URLs unchanged; tsc, lint and e2e all clean.

**11 Nov: demo mode + fee preview ✅** (D4 items)
- **`/demo`: a payment to a sample recipient ("Ada Design Studio"), with no wallet and no money.**
  - The payer's price is a **live** NEAR quote.
  - Each pot shows a **live** estimate of what arrives after fees (Spending, USDC on Base; Taxes, private USDC on Arbitrum; Savings, BTC).
  - "Simulate payment" plays the real engine's steps (making private → converting → sending), timed from NEAR's own estimates, so Bitcoin finishes last.
  - "Send Ada's money to a stranger" shows the real `403 policy_destination_denied` from the mainnet tests.
  - Linked from the hero ("Try the demo") and the header ("Demo").
- **Fee preview on /create:** the $1,000 card shows "≈ what arrives" per pot. A pot with a fee of 3% or more turns amber with the fee, e.g. $20 to Bitcoin is about 7.9%.
- **How it works:**
  - `src/lib/server/near/quotes.ts` gets estimates from 1Click **dry** quotes (nothing is created or sent) and caches them for 20–30 s.
  - Placeholder recipients only fill the quote's recipient field. The Tron and TON ones are derived from a hash (no one holds their keys); users' own addresses are never sent, so a private pot's address isn't revealed.
  - API: `POST /api/estimate/payment` and `POST /api/estimate/payouts`, both validated and rate-limited.
- **Verified in Edge:** live price, live estimates, simulation stages, the redirect card, and the amber fee warning, with no console errors.

**Next:** README written for the AI judges, hosted deploy (you pick the host), then **one real payment** of about $5–10 to verify the money path, including a private pot.

## 5. Out of scope (stated in the README)

- Cashing out to bank accounts
- Tax or KYC compliance (the CSV export is for records only)
- Recurring or subscription billing
- Mobile apps

## 6. Schedule (UTC dates; today is 8 Nov)

| Day | Date | Goal | Done when |
|---|---|---|---|
| D0 | 8 Nov | **Technical test** (2–3 h): Agent API demo (create agent, set destination policy, execute one withdraw) and 1Click payment into an Intents balance. **Decide Path A or B.** Set up the project. | Decision made; repo runs `npm run dev` |
| D1 | 9 Nov | Rules setup screen, payment link, pay page with live quotes and local currency | A payer can get a real quote from a link |
| D2 | 10 Nov | Real payment end to end into the router balance, status tracking including refunds | One real $5–10 payment received |
| D3 | 11 Nov | Split engine (Path A or B), receipts | That payment splits to 2–3 chains |
| D4 | 12 Nov | Dashboard, CSV, demo mode, fee guard, deploy hosted demo. Stretch: private slice via Confidential Intents. | Judge can try the demo from a URL |
| D5 | 13 Nov | README written for AI judges ("do X → see Y"), tests, fresh-clone check, LICENSE, record a 60–90 s video, X post, make the repo public | Everything is publishable |
| D6 | 14 Nov | Buffer, final check of the live HACKATHON.md, **submit (you confirm the payload)** | 201 response from the submission API |

## 7. What I need from you

| Item | Where | When |
|---|---|---|
| NEAR Intents partner API key | partners.near-intents.org | D0 |
| Agent API demo key | partners.demo.agentsonintents.com/dashboard | D0 (for the Path A test) |
| About $15–25 in crypto for real test payments (e.g. USDC or USDT on any chain) | Your wallet | D2 |
| 2–3 receiving addresses **you control**, e.g. an EVM address for Base, a BTC or Solana address, and your NEAR account | Your wallets | D1 |
| GitHub account, and a hosting account (Vercel or Railway, free tier) | | D4 |
| Final name for the product | Your call | Before D4 |

All keys go in `.env`, which is git-ignored, and never in the repo or this chat.

## 8. Risks

| Risk | Plan |
|---|---|
| The Agent API demo environment is limited, or doesn't run on mainnet | Fall back to Path B (decided on D0, so no time is lost) |
| No testnet for NEAR Intents | Use tiny mainnet amounts, separate dev accounts and dry-run quotes for the demo |
| Fees eat small slices | Fee guard and a minimum payment, explained in the README |
| HOT wallet can't sign NEP-413 messages | Test on D0. If needed, use Meteor or MyNearWallet for the recipient. |
| Running out of time | D3 is the cut line. Path B + dashboard + demo mode is already a complete entry. Privacy is a stretch goal only. |
