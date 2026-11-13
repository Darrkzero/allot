# Allot

**Get paid in anything. Sorted by your rules.**

Allot is a payment link for freelancers and small businesses anywhere. Your client pays with whatever they hold: 200+ currencies on 39 networks. Every payment is split the moment it lands, into **pots** you choose: 70% to spend as USDC on Base, 20% set aside for taxes (privately), 10% saved as Bitcoin. Each pot pays out to its own wallet, on its own network, in its own currency.

It's built on **NEAR Intents**: the [1Click API](https://docs.near-intents.org/) for cross-chain payments, and the **NEAR Intents Agent API** for a wallet that only the recipient's passkey controls and that can **only ever pay the recipient's own addresses**. There's no custom smart contract. The safety rules are enforced by NEAR, not by Allot's server.

**Hackathon tracks:** `realworld` (main) · `privacy` · `security` · `open`

> **Live:** [allot-production-6f6143df.up.railway.app](https://allot-production-6f6143df.up.railway.app) · [try the demo](https://allot-production-6f6143df.up.railway.app/demo) (no wallet needed) · [Demo video on X](https://x.com/Darrkzero/status/2121193219119612271)

---

## The problem

Freelancers and small businesses can be paid in crypto from anywhere, but it's clumsy for both sides:

- **Payer and payee are on different networks.** USDT and USDC each exist on more than a dozen chains. Someone has to bridge, swap and buy gas, and money sent on the wrong network can be lost.
- **Exchanges end up in the middle,** as the usual workaround, with their fees and custody.
- **Nobody sets money aside.** People are told to split income the day it arrives: taxes, savings, spending. Banks offer "pots" for this; crypto has nothing equivalent, let alone across chains.
- **Income is public.** Anyone who knows your address can see every payment you receive.

Allot answers all four with one link: the client pays from any chain, the money lands in a wallet only the recipient controls, and every payment is split into pots, any of which can be private.

## Try it in 60 seconds: no wallet, no money, no keys

Open the live demo: **[allot-production-6f6143df.up.railway.app/demo](https://allot-production-6f6143df.up.railway.app/demo)**. Or run it locally (Node.js 24+):

```bash
npm install
npm run dev
# open http://localhost:3000/demo
```

The demo and the fee preview need no wallet and no API keys: they use public 1Click *dry* quotes, which create and send nothing.

| Do | You'll see |
|---|---|
| Open **[/demo](https://allot-production-6f6143df.up.railway.app/demo)** | A payment link for a sample business, "Ada Design Studio", and a **live** NEAR price for paying $250 in ETH on Arbitrum. |
| Change the amount or currency | The price and every pot's estimate update live. |
| Look at **Ada's pots** | What actually arrives in each pot after fees: Spending (USDC on Base), Taxes (🔒 private, USDC on Arbitrum) and Savings (BTC). Small Bitcoin amounts show a visibly higher fee and ~8 min. |
| Press **Simulate payment** | The payment journey, then the exact steps the real split engine runs per pot: *making private → converting → sending*. Timed from NEAR's own estimates, so Bitcoin finishes last. |
| Press **Send Ada's money to a stranger** | The real `403 policy_destination_denied` that NEAR returned when we tried this on mainnet. |
| Open **[/create](https://allot-production-6f6143df.up.railway.app/create)**, give a Bitcoin pot 2% | The "If you're paid $1,000" card shows what arrives per pot; the tiny Bitcoin pot turns amber with its fee, several percent (Bitcoin's network fee on a $20 payout). |

Without a 1Click partner key, quotes include 1Click's default fee, so numbers differ slightly from a configured deployment.

## The full flow: create a real payment link

**On the live site you only need a device with a passkey** (Windows Hello, Touch ID or Face ID, or an Android phone or iPhone): no keys, no wallet extension, no funds. Creating a link makes a **real, empty, policy-locked wallet on NEAR mainnet**, so use your own wallet addresses for the pots: anything paid to the link is paid out to them. To run this flow locally instead, fill in the keys from [.env.example](.env.example).

| Step | Do | You'll see |
|---|---|---|
| 1 | Open **[/create](https://allot-production-6f6143df.up.railway.app/create)**: your name, a link name, and up to 5 pots (name, share, payout currency, your wallet address). Optionally switch a pot to **Private**. | A live "If you're paid $1,000" preview with fees. Private isn't offered where NEAR can't route it (USDT on Tron, TON, BNB Chain). |
| 2 | Press **Create my payment link**, then **Confirm with passkey** twice | Three passkey prompts: create the passkey; confirm your pots (creates the wallet with its policy); turn on auto-split (grants Allot's server permission to act *inside* that policy). Then "Your payment link is live" with your `/pay/<link name>` address. |
| 3 | Open **/pay/&lt;link name&gt;** as a client: enter an amount, pick a currency, add a refund address, press **Continue to payment** | Six one-tap currencies (or search all of them) and an exact live price, then a payment address and QR code, valid for 3 days. Nothing is charged unless funds are sent. |
| 4 | Stay on that page, **/pay/status/&lt;id&gt;** | "Waiting for your payment", then once paid, each pot's progress, with the private pot shown only as "🔒 Private pot · 20%". |
| 5 | Open **/dashboard/&lt;link name&gt;** and press **Sign in with passkey** | Payments, totals per pot, a request-a-payment link builder, CSV export for an accountant, "Retry delayed pots", and renewal of the auto-split permission. |

`npm run e2e` runs steps 1 to 5 locally with a software passkey against NEAR mainnet. Start `npm run dev` first; it prints 21 lines starting with ✓ and ends with `✅ E2E flow OK`.

---

## How it uses NEAR

```mermaid
flowchart LR
  P["Client pays<br/>any currency, 39 networks"] -->|"1Click: exact-output quote<br/>+ deposit address"| W[("Recipient's NEAR Intents wallet<br/>Agent API · owned by their passkey<br/>policy: pay only their addresses")]
  W -->|withdraw| A["Spending<br/>USDC on Base"]
  W -->|"shield → swap → withdraw<br/>(Confidential Intents)"| B["🔒 Taxes<br/>USDC on Arbitrum"]
  W -->|"swap to nBTC → withdraw"| C["Savings<br/>BTC on Bitcoin"]
```

1. **One wallet per link, owned by a passkey.** Setup sends the Agent API an `agent_create` intent signed with the recipient's **WebAuthn passkey** (P-256). The wallet's **policy** is built from their pots ([policy.ts](src/lib/server/near/policy.ts)):
   - `actions: ["swap", "withdraw"]`, with no `transfer`;
   - `destinations: { mode: "only", list: <the recipient's own addresses> }`;
   - `assets`: only the currencies their pots use;
   - `confidential`: on only if a pot is private.
2. **Allot's server acts only inside that policy.** A second passkey-signed `grant_issue` gives the server a grant token (the owner signs only its SHA-256 commitment). The token is stored encrypted (AES-256-GCM) and lasts 90 days; the owner renews it from the dashboard. If Allot's server were compromised, the policy would still only pay the recipient's own addresses.
3. **Payments land as USDC.** The pay page asks 1Click for an `EXACT_OUTPUT` quote into the wallet's Intents account. The client can pay with anything 1Click supports, and the recipient receives the exact invoiced amount ([pay/quote](src/app/api/pay/quote/route.ts)).
4. **The split engine** ([split.ts](src/lib/server/payments/split.ts)) turns each pot into steps on the wallet:
   - **private pots:** `shield` into the confidential balance, then a `confidential: true` swap and withdraw;
   - **Bitcoin pots:** swap to **nBTC**, then withdraw to the Bitcoin chain. On 11 Nov, 1Click had no liquidity into BTC held inside Intents, while nBTC filled in about 10 s ([payout-asset.ts](src/lib/server/near/payout-asset.ts));
   - **all other pots:** swap if needed, then `withdraw` to the pot's address.

   Every call carries a deterministic `Idempotency-Key`, so a repeated trigger can't move funds twice.
5. **Estimates** (demo, fee preview) are 1Click **dry** quotes, sent with placeholder recipients and never users' addresses ([quotes.ts](src/lib/server/near/quotes.ts)).

## Security model

| Threat | What stops it |
|---|---|
| Allot's server (or its database) is compromised | The wallet's NEAR policy only pays the recipient's own addresses. Tested on mainnet: a withdrawal to an unlisted address → `403 policy_destination_denied`. |
| Someone else edits a recipient's pots | Changing the policy needs the owner's passkey (`policy_update`). The server only ever holds a grant. |
| A retry pays twice | Deterministic idempotency keys. A manual retry resubmits only what NEAR reported `FAILED`/`REFUNDED`; anything in flight is re-checked instead ([db.ts](src/lib/server/db.ts)). |
| Dashboard takeover | Passkey sign-in verified server-side (challenge, origin, RP ID, user-verification flag, ECDSA signature), with single-use 2-minute challenges and an HMAC-signed 12-hour cookie ([webauthn.ts](src/lib/server/auth/webauthn.ts), [session.ts](src/lib/server/auth/session.ts)). |
| Spam or retry exhaustion | Per-IP rate limits on public endpoints ([rate-limit.ts](src/lib/server/rate-limit.ts)); retries paced to one every 5 s per pot. |
| Spreadsheet formula injection | Payer-written memos are neutralised in the CSV export. |

## Privacy, and its limits

A **private pot** goes through **NEAR Confidential Intents** (on `intents.far`), so the route from the payment link's wallet to that pot's address isn't on the public NEAR chain. Payers see it only as "🔒 Private pot · 20%", with no name, currency or address.

Limits, as the Agent API itself documents them: this is access control, not cryptography. The network's operators can read confidential state, the 1Click solver layer sees each intent, the shield step is public, and the final payout is public on its destination chain (it can be matched by amount and timing). The app says this next to the switch.

## Status: what has been verified

| What | How | Result |
|---|---|---|
| Policy blocks unapproved addresses | [spike/agent-policy-test.mjs](spike/agent-policy-test.mjs), mainnet, 8 Nov | Live withdrawal to a stranger → `403 policy_destination_denied` |
| Privacy must be switched on by the owner | [spike/confidential-test.mjs](spike/confidential-test.mjs), mainnet, 11 Nov | `shield` with confidential off → `403 policy_action_denied`. After the owner's `policy_update` it passes policy. A confidential withdrawal to a stranger is still blocked. |
| Which pots can be private | [spike/confidential-payouts.mjs](spike/confidential-payouts.mjs), dry previews | Every payout option except USDT on Tron, TON and BNB Chain |
| Full setup, renewal, payer quote, dashboard security | `npm run e2e`, mainnet, empty wallet | 21 checks pass |
| Split-engine edge cases | `npm test`, offline against a mock NEAR API | 8 checks pass: retries, missing amounts, review pauses, nothing spendable yet |
| The split engine's live calls | A simulated "paid" payment against an empty wallet | Withdraw, shield and the nBTC swap each stop only at "insufficient balance": accepted by policy |
| The live deploy on Railway | `npm run check:deploy -- <url>`, 13 Nov | 131 checks pass: the full flow above, private pots hidden from every public page and API, HTML/script in names and memos shown as text, sessions, input validation, per-visitor rate limits that forged `X-Forwarded-For`/`X-Real-IP` can't dodge, security headers, and every page on desktop and phone with no errors |
| Rate limits are per visitor | Manual, 13 Nov | With one network blocked (429), a phone on mobile data still got through |
| Data survives a redeploy | Manual, 13 Nov | Test links and payments still there after a Railway redeploy (SQLite on a volume) |
| A payment with real money, end to end | Manual | **Not done** (no funds before the deadline). Each part is verified separately above: the deposit address and status tracking (deploy check), every split-engine call against the live wallet (accepted by policy), and the policy itself on mainnet. |

The Agent API describes itself as an *experimental, mainnet-only beta*. Keep amounts small.

## Run it yourself

Requires **Node.js 24+** (it uses the built-in `node:sqlite`).

```bash
npm install
cp .env.example .env       # then fill in the keys (see below)
npm run dev                # http://localhost:3000
```

| Variable | Needed for | Get it from |
|---|---|---|
| `NEAR_INTENTS_AGENT_API_URL` | creating links, splitting | `https://api.demo.agentsonintents.com` |
| `NEAR_INTENTS_AGENT_API_KEY` | creating links, splitting | partners.demo.agentsonintents.com/dashboard |
| `ALLOT_SECRET` | encrypting grants, signing sign-in cookies | any 32+ random characters |
| `NEAR_INTENTS_API_KEY` | optional: 1Click partner key (lower fees) | partners.near-intents.org |
| `ALLOT_DB_PATH`, `ALLOT_CLIENT_IP_HEADER`, `ALLOT_PROXY_HOPS` | optional | see [.env.example](.env.example) |

| Command | What it does | When it works, you'll see |
|---|---|---|
| `npm run dev` / `npm run build` / `npm start` | Run, build, serve | `npm run build` prints `✓ Compiled successfully` |
| `npm test` | Offline unit tests (no keys) | 8 lines starting with ✓, ending with `All engine checks passed.` |
| `npm run e2e` | Full setup flow on NEAR mainnet with a software passkey (needs keys and `npm run dev`) | 21 lines starting with ✓, then `✅ E2E flow OK` |
| `npm run check:deploy -- <url>` | About 130 checks against a deployed instance, including every page in a real browser (Edge by default) | `==== 131 passed, 0 failed, 0 warnings ====` |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript | No errors |
| `POST /api/split/sweep` | Runs one background pass on demand. The production server already does this every minute by itself ([instrumentation.ts](src/instrumentation.ts)), so payments complete even if nobody keeps a page open. | `{"refreshed":<n>,"split":<n>}`, or `{"busy":true}` while a pass is running |

### Deploy on Railway

The app keeps its data in a SQLite file, so it runs as **one** server process with a persistent volume. [railway.json](railway.json) sets the build, start, health check (`/api/health`) and restart policy; Node 24 comes from `engines` in package.json.

1. **New Project → Deploy from GitHub repo**, and pick this repo.
2. **Add a volume** to the service, mounted at `/data`.
3. **Variables:** `ALLOT_DB_PATH=/data/allot.db`, `NEAR_INTENTS_AGENT_API_URL`, `NEAR_INTENTS_AGENT_API_KEY`, `ALLOT_SECRET`, and optionally `NEAR_INTENTS_API_KEY`.
4. **Settings → Networking → Generate Domain.** Passkeys are tied to this domain, so links created on localhost don't carry over.

Then check the deploy: `npm run check:deploy -- https://<your-domain>` (about 130 checks; it creates two test links with empty wallets and moves no funds).

On Railway, rate limits key on `X-Real-IP` automatically (its edge overwrites that header; the last `X-Forwarded-For` entry is an internal proxy address that changes per request). If `ALLOT_DB_PATH` is missing, the database goes on the attached volume anyway.

## Code map

```
src/
├── app/
│   ├── (marketing)/page.tsx        landing page (3D hero)
│   ├── (app)/create/               create a link (form, pots, live fee preview)
│   ├── (app)/pay/[handle]/         the client's pay page
│   ├── (app)/pay/status/[id]/      live payment and split status
│   ├── (app)/dashboard/[handle]/   owner dashboard (passkey sign-in)
│   ├── (app)/demo/                 demo mode
│   └── api/                        route handlers (links, pay, estimates, auth, dashboard, sweep, health)
├── instrumentation.ts              starts the once-a-minute background sweeper in production
├── components/ui/ · landing/       shared UI · landing animation
└── lib/
    ├── assets.ts · rules.ts        payout options, address checks, pot rules (browser + server)
    └── server/
        ├── near/                   Agent API, 1Click, policy, grant, quotes, payout routes
        ├── payments/               split engine, payment refresh, background sweeper
        ├── auth/                   passkey verification, sessions
        └── db.ts · seal.ts · rate-limit.ts · http.ts · env.ts · fx.ts
tests/   unit/ (npm test) · e2e/ (npm run e2e, npm run check:deploy)
spike/   the mainnet experiments cited above (own package.json: cd spike && npm install)
docs/    PLAN.md (decisions and progress log) · RESEARCH.md (hackathon research)
```

## Out of scope

Cashing out to bank accounts · tax or KYC compliance (the CSV is for records) · recurring billing · mobile apps.

## Disclosures

- **Built during the hackathon.** There is no pre-hackathon code: research started on 6 Nov 2026, the scripts in [spike/](spike/) date from 8–11 Nov, and the repository's first commit is from 11 Nov, all after the 19 Oct announcement.
- **AI-generated code.** Most of the code, tests and docs were written with an AI coding assistant (Claude Code), directed, reviewed and tested by the author.
- **Template.** Scaffolded with `create-next-app` (Next.js 16).
- **Libraries.** Next.js 16 and React 19; Tailwind CSS 4; three.js with @react-three/fiber and @react-three/drei (the landing page's 3D coins); qrcode (payment QR codes); Node's built-in `node:sqlite`. Development: TypeScript, ESLint, playwright-core (browser checks) and jiti (unit tests).
- **NEAR services.** The 1Click API, the NEAR Intents Agent API (mainnet beta) and Confidential Intents. No custom smart contract.

## Credits and license

Token and network logos come from [@web3icons/core](https://github.com/0xa3k5/web3icons) (MIT); the logos are trademarks of their projects and are shown only to identify supported currencies. Allot's own code is under the [MIT License](LICENSE).
