# NEAR HACKATHON (Nov 2026): Research Report

*Compiled 6 Nov 2026. Primary sources: [nearhackathon.com](https://nearhackathon.com), [HACKATHON.md](https://nearhackathon.com/HACKATHON.md) (the official rules file), and the official prompt repo [nearai/near-hackathon-prompt-examples](https://github.com/nearai/near-hackathon-prompt-examples) (last commit 30 Oct 2026). The organizers say rules may change, so re-read the live HACKATHON.md before you submit.*

---

## 1. At a glance

| | |
|---|---|
| **What** | Online, global, two-week build sprint. Organized by NEAR Protocol. |
| **Announced** | 19 Oct 2026 ([the X post you linked](https://x.com/NEARProtocol/status/2112257967818997891)) |
| **Build window** | 1 Nov 00:00 UTC to **14 Nov 23:59 UTC** (code written since 19 Oct counts) |
| **Time left (as of 6 Nov)** | About **8.5 days** |
| **Judging** | 16–18 Nov. Results by 18 Nov 23:59 UTC |
| **Prize pool** | **$250,000**, fixed in USD and paid in NEAR |
| **Registration** | **None.** The final submission is the only registration. |
| **Deliverables** | (1) Public GitHub repo, (2) public demo post on X, (3) the submission form or API |
| **Teams** | Solo or any size (1, 2–4, 4–6, 6–8, 8+) |
| **Focus** | Privacy, cross-chain, agentic apps. Built on NEAR Intents, Chain Signatures, chain abstraction, NEAR AI Cloud |
| **Unusual twist** | **Claude Code and Codex screen every project first.** Human judges decide. |

---

## 2. Prize structure and the math

| Prize | Amount | Count | Total |
|---|---|---|---|
| Grand prize (overall) | $55,000 | 1 | $55,000 |
| 1st place per track | $10,000 | 13 | $130,000 |
| 2nd place per track | $3,000 | 13 | $39,000 |
| 3rd place per track | $2,000 | 13 | $26,000 |

- **40 paid slots** in total. Every track pays the same amounts.
- Prizes go out as **one NEAR payment, no vesting, within 30 days** of results (Q-016). The USD amount is fixed, so the NEAR quantity depends on the price at payout.
- The payout goes to a **mainnet NEAR account** that you create yourself (a named account like `team.near`, or a 64-character implicit account).
- **You can enter several tracks with one project.** Pick every track that genuinely fits. The rules don't say whether one project can win prizes in more than one track. Ask in Discord if that matters to your plan.
- **One person can enter up to 2 projects.** They must be independent, and each README must name the other.

---

## 3. The 13 tracks in detail

Each track has a starter prompt with docs links: `tracks/NN-*.md` in the [prompt repo](https://github.com/nearai/near-hackathon-prompt-examples). The "hints" are wishes, not requirements (Q-011). Your own NEAR contract that fits the track is enough.

| # | id | Track | What they want | Hints | Starter idea in the official prompt |
|---|---|---|---|---|---|
| 01 | `defi` | Unstoppable DeFi | Exchanges, perps, lending, vaults and trading agents that settle across chains via Intents. No custodian. | Trading, NEAR Intents, Chain Signatures | Cross-chain **DCA vault** using 1Click quotes, a slippage guard and a dry-run mode. Stretch: a contract-owned BTC address via Chain Signatures. |
| 02 | `thesis` | Investment Thesis | A long-term NEAR thesis backed by **reproducible** data. "Judged on the evidence, not the conviction." | Onchain data, dashboards, research | BigQuery (`bigquery-public-data.crypto_near_mainnet_us`) plus the Intents Explorer API, a one-command rebuild of every chart, and a THESIS.md that includes the evidence *against* the thesis. |
| 03 | `privacy` | Privacy & Private AI | Confidential compute, private finance, AI that protects sensitive data | Private AI, TEE, NEAR AI Cloud | **Private expense auditor**: inference on NEAR AI Cloud, attestation verified with a fresh nonce, a "Verified" panel, nothing kept server-side. |
| 04 | `business` | Autonomous Business | AI-native businesses with treasury, sales, procurement and revenue share. "Humans only set the constraints." | AI agents, Intents, Chain Signatures | **One-agent research shop**: customers pay in any token, the agent buys its own inference, revenue splits automatically, rules live in config.yaml, and there's a kill switch. |
| 05 | `swarms` | AI Swarms | Coordination markets, bidding, collective purchasing between agents | Multi-agent, Intents, sub-accounts | **Group-buying swarm**: one sub-account per agent, a sealed-bid coordinator, and a 20-buyer/5-seller simulation that needs no LLM calls. |
| 06 | `security` | AI Security & Defense | Spending limits, policy engines, sandboxed wallets, reputation, scam detection | Agent security, function-call keys, TEE attestation | **Counterparty check service** returning allow, warn or block, a wrapper that refuses to sign, and a **prompt-injection attack demo**. |
| 07 | `agents` | Agent Economy | Agents that earn, spend, negotiate, hire other agents and pay for APIs | Agent commerce, Intents, Chain Signatures | **General-contractor agent**: breaks down a task, hires agents on market.near.ai, negotiates once, and issues receipts. |
| 08 | `realworld` | Real-World Money | Payroll, invoicing, remittances, merchant payments. "Something a normal company could use tomorrow." | Stablecoins, Intents, meta-transactions | **Freelancer invoicing**: the client pays from any chain, the freelancer gets USDC on NEAR, gas is covered through a relayer, and there's a CSV export for the accountant. |
| 09 | `games` | Games With Real Economies | NPCs with wallets, player-owned markets. "Judged on the game loop, not the token." Bonus if players never notice the chain. | Agent NPCs, social login, Intents, NEP-245 | **Market-town game**: merchant agents set prices from supply and demand, items are NEP-245 tokens, and a fast-forward mode shows a week of trading. |
| 10 | `nfts` | NFTs That Do Something | NFTs as accounts that own money, earn royalties and carry access rights | Dynamic NFTs, NEP-171, sub-accounts | **Membership NFT with its own wallet**: control passes on transfer, plus a threat model of how a seller might try to keep access. |
| 11 | `memecoins` | Memecoins With Mechanics | The meme does something. "Judged on the mechanic, not the chart." | NEP-141, token mechanics | **Streak coin**: daily check-in, then mint or burn. Parameters are fixed in the contract with no admin key, and the prompt asks for a 60-day simulation first. |
| 12 | `social` | Social Money | Shared budgets, rewards and reputation on **Sputnik DAO and Trezu**. "Don't rebuild the multisig." | Sputnik DAO, Trezu, named accounts | **Bounty board with earned trust**: tiered auto-approval tied to each contributor's track record. |
| 13 | `open` | Open Innovation | Anything that doesn't fit a category. Can be combined with any other track. | Chain abstraction, experimental | **Inheritance account**: a dead-man's switch over BTC and ETH via Chain Signatures, with guardians and a cancel window. |

**What the prompts have in common.** Every one asks for a **demo, dry-run or simulation mode that judges can run without funds**, a readable rules or config file, and a design step before any code. That is a strong hint about what the screening step rewards.

---

## 4. Judges

| Judge | Affiliation | Known public interests (my read, not stated by organizers) |
|---|---|---|
| Illia Polosukhin | NEAR co-founder | "User-owned AI", agents, chain abstraction |
| Eddy Lazzarin | a16z crypto (CTO) | Technical rigor, mechanism design |
| Mert Mumtaz | Helius (CEO) | Very vocal on **privacy** and performance |
| Avichal Garg | Electric Capital | Developer ecosystems, long-term infrastructure |
| Kain Warwick | Synthetix and Infinex | DeFi, **cross-chain UX** (Infinex is a chain-abstraction product) |
| Haseeb Qureshi | Dragonfly | Market structure, real business models |
| Stepan Gershuni | cyber•Fund | AI agents, crypto x AI |
| **Claude Code and Codex** | Anthropic and OpenAI | **First-pass screening** (see below) |

### How the AI screening works (Q-017)

- Claude Code and Codex **screen**: they check reproducibility, verify features, write a structured report and give a preliminary score.
- **Humans decide.** "A low AI score alone cannot reject" a project.
- The organizers ask for a README "written for a machine reader as well as a human": what the product is, the problem it solves, and numbered **"do X, see Y"** steps. **No marketing.**
- The site states that the agents check "that it runs and does what the README says."

**What this means in practice:** if the AI can't clone, install and run your project from the README, it gets a weak report before a human ever looks at it. A dry-run mode, sample data, `.env.example` files and one-command setup pay off directly.

### Judging criteria

None are officially published. The FAQ points to past NEAR hackathon criteria as a guide: **technical implementation, design, impact, originality, sustainability.**

---

## 5. Submission: exact requirements

### Checklist (from SUBMITTING.md and HACKATHON.md)

- [ ] Working project. Code from 19 Oct 2026 onward counts.
- [ ] **Public repo by 14 Nov 23:59 UTC.** It must stay public through judging.
- [ ] A **LICENSE file** (any license; MIT is fine).
- [ ] README covers: what it is, the problem, "do X, see Y" steps, which NEAR features are used, any **pre-existing code or libraries and AI-generated code**, and your other project if you're entering two.
- [ ] **No secrets anywhere in the git history.**
- [ ] **Demo post on X** that says it was built at NEAR HACKATHON, tags **@NEARProtocol** and **#NEARHackathon** (optionally @NearLegion and @NearBuilders), and has a video or screenshots attached.
  - If your demo only runs locally, a **video is required**. Screenshots aren't enough when judges can't open the demo (Q-012).
- [ ] A **mainnet NEAR account** for the payout.
- [ ] Every track that fits is selected.
- [ ] Submitted **once**, via the [form](https://nearhackathon.com/#apply) or the API.

### Form or API fields

| Field | Rule |
|---|---|
| projectName | 2–80 characters |
| leadName | 2–80 characters |
| email | max 160 characters; **max 2 submissions per email** |
| size | exactly one of `1`, `2 - 4`, `4 - 6`, `6 - 8`, `8+` |
| tracks | one or more of `defi thesis privacy business swarms security agents realworld games nfts memecoins social open` |
| nearAddress | 2–64 characters, lowercase, a valid NEAR account |
| projectUrl | public repo URL; **each repo can be submitted only once** |
| demoUrl | link to the X post |
| idea | 20–2,000 characters: the problem, what you built, and how NEAR fits |
| consent | true |

- API: `POST https://nearhackathon.com/api/applications`. Body ≤ 12 KB. Include a `requestId` UUID and reuse it on retries.
- **Don't send a `website` field through the API.** It's a spam trap: any non-empty value rejects the submission.
- Status codes: **409** means that repo was already submitted or the email has reached its limit. **403** means the window is closed.
- **Submissions can't be edited.** Fixes go through [/request-changes](https://nearhackathon.com/request-changes), which organizers review by hand. Submit a second time and you get rejected, or your entry counts as a different project.
- **Order of operations:** finish the repo, make it public, post the demo, *then* submit.

### Rules that catch people out

| Rule | Detail |
|---|---|
| Existing projects (Q-002, Q-004) | Allowed, including products on other chains, but **only the NEAR work done in the window is judged**. Separate it with a branch, or with `pre-hackathon` and `hackathon-submission` tags, and link the diff in the README. Submitting an old project as-is is not allowed. |
| Libraries and templates (Q-005) | All allowed, including AI-written code. List them in the README. |
| Testnet (Q-010) | Testnet-only projects are eligible in every track. |
| **NEAR Intents has no testnet (Q-007)** | Use mainnet with separate dev accounts, tiny amounts, and `dry: true` quotes. |
| 1Click JWT (Q-006) | Optional. Without it you pay an extra fee: HACKATHON.md says 0.2%, the Intents docs say 0.25%. Register at partners.near-intents.org. |
| Mainnet costs (Q-008) | Not reimbursed. Testnet NEAR is free from the near-cli faucet or near-faucet.io. |
| Hosted demo (Q-012) | A plus. Keep it up until 18 Nov, ideally 25 Nov. |
| IP (Q-013) | You keep all rights. Organizers get non-exclusive promo rights. |

---

## 6. Technology you'll touch

### NEAR Intents and the 1Click API (cross-chain swaps and settlement)

- Base URL `https://1click.chaindefuser.com`
  - `GET /v0/tokens`
  - `POST /v0/quote`
  - `POST /v0/deposit/submit` (optional)
  - `GET /v0/status?depositAddress=…`
- Quote body includes `dry`, `swapType: EXACT_INPUT`, `slippageTolerance` (basis points), `originAsset`/`destinationAsset` (e.g. `nep141:wrap.near`, `nep141:btc.omft.near`), `amount` (smallest unit), `recipient`, `refundTo`, `deadline`.
- Statuses: `PENDING_DEPOSIT`, `KNOWN_DEPOSIT_TX`, `PROCESSING`, `SUCCESS`, `INCOMPLETE_DEPOSIT`, `REFUNDED`, `FAILED`. The prompts expect you to **show REFUNDED and FAILED in the UI**.
- `dry: true` returns a real quote with no execution. Use it for your judge-friendly demo mode.
- **Confidential Intents** went live in Feb 2026. Private cross-chain swaps are available to 1Click builders. Per Nansen, about 42% of near.com swap volume runs privately.

### Chain Signatures (one NEAR account controls BTC, ETH and other addresses)

- MPC signer contract `v1.signer`. Foreign addresses are derived from the NEAR account name plus a derivation path.
- The flow: derive the address, build the foreign transaction, call `sign`, attach the signature, broadcast.
- Signing on NEAR is free. You still need gas on the target chain.
- Supports any chain that uses ECDSA or EdDSA: BTC, ETH, DOGE, XRP, Cosmos.

### NEAR AI Cloud (private inference in TEEs)

- OpenAI-compatible at `https://cloud-api.near.ai/v1`.
- Attestation report at `/v1/attestation/report` (with a nonce). It returns an Intel TDX quote, and GPU evidence is verified through NVIDIA.
- References: [verification docs](https://docs.near.ai/cloud/verification) and the [example repo](https://github.com/near-examples/nearai-cloud-verification-example).
- **Credits:** buy them at cloud.near.ai, or **claim $10 free by joining NEAR Builders** at [nearbuilders.org/join](https://nearbuilders.org/join).

### Agent infrastructure

- **Agent API (agentsonintents.com).** Gives each agent a policy-bound wallet on Intents. The owner signs a policy (actions, assets, limits, USD budget, time windows, emergency stop) plus a grant. It runs in a TEE and returns execution proofs.
  - Demo keys: [partners.demo.agentsonintents.com/dashboard](https://partners.demo.agentsonintents.com/dashboard), base URL `https://api.demo.agentsonintents.com`. These keys are temporary.
- **OutLayer.** Verifiable off-chain compute in Intel TDX: you upload WASM and get an attested result. Also provides agent key custody, VRF randomness and secret injection. Callable from a contract (`request_execution`) or over HTTPS.
- **PingPay Agent Pay.** Lets agents pay **x402** (HTTP 402) paywalls in Base USDC, with settlement to a NEAR recipient via Intents. Middleware: `@pingpay/agentpay-middleware`.
- **NEAR AI Agent Market** ([market.near.ai](https://market.near.ai)). Agents get hired per job, with escrow, and can be used over MCP from Claude, Codex and others. You can list your agent there.
- **NEAR MCP server** ([nearai/near-mcp](https://github.com/nearai/near-mcp)).
- **Function-call access keys.** Scope a key to one contract with a gas allowance. These keys can't transfer NEAR or add keys, and an account that holds only function-call keys can lock itself out once the allowance runs out.

### Standards

- NEP-141 (fungible tokens)
- NEP-171 (NFTs)
- NEP-245 (multi-token)
- Meta-transactions / relayers (gasless UX)

### Ecosystem partners

| Category | Partners |
|---|---|
| DeFi | Rhea (DEX and lending, SDK/CLI), HEX (swaps), Aurora (EVM on NEAR) |
| Chain abstraction | HOT |
| Memecoin launchpads | meme.cooking, BRRRAIN |
| DAO and treasury | Trezu (treasury), SputnikDAO |
| Other | Top Level Accounts (rented names as NFT accounts) |

### Agent tooling the organizers recommend

- `npx skills add near/agent-skills` installs the `near-ai-cloud`, `near-api-js`, `near-dapp`, `near-intents`, `near-kit` and `near-smart-contracts` skills.
- Doc indexes for LLMs: `docs.near.org/llms.txt` and `docs.near-intents.org/llms.txt`.

---

## 7. Ecosystem context (useful for the `thesis` track and for pitching)

These figures come from [Nansen's Q2 2026 NEAR report](https://nansen.ai/post/nansen-near-quarterly-report-q2-2026). Treat them as approximate: Nansen's own figures are internally inconsistent in places.

| Metric | Value |
|---|---|
| NEAR Intents cumulative volume | **over $22B across 35+ chains** |
| Distribution partners | SimpleSwap, Ledger Wallet |
| Daily active addresses | ~121K |
| Daily transactions | ~854K average |
| HOT Wallet share of transactions | ~65% (down 27% QoQ). Concentration risk. |
| Confidential Intents TVL | ~$27–30M, targeting $70M (the NEAR@3.33 incentive) |
| Fee capture rate | 30.5% over the trailing 30 days, vs an 11.5% lifetime average |
| Protocol | Dynamic resharding to 9 shards. SPICE (200 ms blocks) and post-quantum signing are on the roadmap. |

**NEAR price.** A live 1Click dry-run quote on 6 Nov priced 10 NEAR at $37.50, so NEAR was **about $3.75**. Search results had been stale and contradictory. At that price the $10K track prize is about 2,670 NEAR. Prizes are fixed in USD, so the price only affects how many NEAR tokens you receive.

### Live access check (6 Nov 2026, from this machine, read-only)

| Channel | Status | Notes |
|---|---|---|
| NEAR RPC, mainnet and testnet | ✅ live | `rpc.mainnet.near.org` and `rpc.testnet.near.org`, protocol v88 |
| NEAR Intents 1Click API | ✅ works with no key | **215 tokens on 39 chains** (NEAR, ETH, SOL, Base, Aptos, BSC, Arbitrum, BTC, ZEC, XRP, DOGE, TON, Tron and more). A dry quote of 10 NEAR → BTC returned $35.85 out for $37.50 in, in about 465 s. **The roughly 4% gap on a small trade without a JWT** means you should get the free JWT. |
| Chain Signatures | ✅ live | `v1.signer` (mainnet) and `v1.signer-prod.testnet` respond. `derived_public_key` works for address derivation. |
| Intents contract `intents.near` | ✅ deployed | |
| Sputnik DAO factory `sputnik-dao.near` | ✅ live | `get_dao_list` returns existing DAOs |
| NEAR AI Cloud | ✅ reachable; **API key needed** | 64 models, including Claude, GPT, Gemini, Qwen, DeepSeek, GLM and Kimi. Completions return 401 without a key. The attestation report is public (Intel TDX quote, event log, signing address). |
| PingPay x402 | ✅ live | Settles via near-intents. Networks include `near:mainnet` and EVM chains. |
| Agent Market, near.social API, Agent API host, OutLayer host | ✅ reachable | Building against them needs an account or key |
| Discord and Telegram | ❌ | Need your login. Claude can't join them. |

**Local toolchain.**
- Installed: Node 24, npm, Python 3.13, git, Docker.
- **Missing: Rust/cargo, cargo-near, near-cli**, which you need for writing Rust contracts. JS contracts (near-sdk-js) or a TypeScript-only app need nothing extra.

---

## 8. In-person events and community

| Event | Details |
|---|---|
| **Build City × NEAR Legion: Private AI Hackathon NYC** | **Wed 11 Nov 2026**, 9 am–6 pm ET, The Wilson, 132 W 27th St. One day, teams of up to 4. Talks cover confidential computing, privacy and agentic commerce. **Registration was open, with ~142 going.** Projects feed into the global hackathon. [luma.com/private-ai-hack](https://luma.com/private-ai-hack) |
| Chicago, Bolivia, Malaysia meetups | NEAR announced November meetups in these places ([coverage](https://coinfomania.com/near-protocol-announces-global-hackathon-meetups-for-builders/)). I couldn't confirm dates. Check [luma.com/near-legion](https://luma.com/near-legion). |
| Video walkthroughs of each track prompt | [NEAR DevHub YouTube](https://www.youtube.com/channel/UCq0iWZQuXhvP8yQzDZsmWfQ) |
| Help and teammates | [NEAR Discord](https://discord.gg/nearprotocol) · [Telegram builders chat](https://t.me/nearbuilderschat) · [nearbuilders.org/build](https://nearbuilders.org/build) |

---

## 9. Lessons from past NEAR hackathons

- **One Trillion Agents (Jan–Feb 2025, $100K).** Winners were practical agents: a Balancer swap assistant, X DropBot (Chain Signatures tips on X), AgentFather (an agent creator), and SquidChain (an agent battle game).
- **Zcash × NEAR Intents (Mar 2025, $70K).** Per the [Zcash forum](https://forum.zcashcommunity.com/t/zcash-x-near-intents-hackathon/50604), judges **only awarded first place** in each category, citing low participation and quality.
  - **Lesson:** a working, polished entry in a niche track can face little competition.
  - **Lesson:** a low-quality entry may win nothing even with little competition.
  - The current rules don't say whether prizes can be withheld.

---

## 10. Strategy: how to maximize your odds (my analysis)

### a) Pick tracks by expected competition, not only by interest

| Likely crowded | Likely thinner |
|---|---|
| `agents`, `defi`, `privacy`, `business` | `thesis`, `social`, `nfts`, `memecoins`, `games`, `realworld` |

- **Why the left column is crowded:** this is where the hype is, where the announcement put its emphasis, and where an AI coding agent produces a plausible project most easily.
- **Why the right column is thinner:** these tracks need specific knowledge (Sputnik DAO and Trezu internals, NEP-245, data work) or a design sense that's hard to fake.
- Every track pays the same $10K for first place.
- **Multi-track tagging is free.** Design one project that honestly fits 2–4 tracks. Example: an agent spending firewall fits `security` + `agents` + `privacy` (if it uses TEE attestation) + `open`.

### b) Optimize for the AI screener, then for the humans

1. A **one-command setup**, plus `.env.example` and committed sample data.
2. A **dry-run or simulation mode** that needs no funds and no API keys where possible. Intents `dry: true` quotes make this easy.
3. A README with numbered **"do X → see Y"** steps that state the expected output exactly, so an agent can verify them.
4. A short **"How NEAR is used"** section that names concrete features: 1Click, `v1.signer`, function-call keys, NEP-245, and so on.
5. Tests that pass. A screener will likely run them.
6. A **hosted demo**, kept up until 25 Nov.

### c) What the human judges will probably reward

- **A real user problem**, shown as one complete moment in the demo video. The official demo guidance says: lead with the problem, show a real action producing a visible result, explain NEAR's role concretely, and skip the architecture slides.
- **NEAR doing something only NEAR does well**: Intents settlement across chains, Chain Signatures controlling BTC from a contract, TEE-verified private inference, or named accounts and sub-accounts as agent identities. "Powered by NEAR" with no specific feature won't land.
- **Security honesty.** Several prompts ask for threat models and failure-case sections. Judges like Lazzarin and Qureshi will reward stated limits over hand-waving.

### d) Timeline for the remaining ~8 days

| Day | Date | Goal |
|---|---|---|
| D0 | 6 Nov | Pick tracks and an idea. Create the mainnet payout account. Get NEAR AI credits ($10 via NEAR Builders) and a 1Click JWT. Install agent skills. Draft the README skeleton and RULES or threat model. |
| D1–D3 | 7–9 Nov | Core contract and integration on testnet. Dry-run mode working end to end. |
| D4–D5 | 10–11 Nov | UI and one complete user flow. Hosted deploy. (Optional: the NYC in-person day on 11 Nov.) |
| D6 | 12 Nov | Tests, README "do X → see Y", LICENSE, secret scan of git history. Ask a fresh Claude Code session to follow the README from a clean clone and fix whatever breaks. |
| D7 | 13 Nov | Record the 60–90 s demo video. Publish the X post with the tags. Make the repo public. |
| D8 | 14 Nov (morning) | **Submit with time to spare.** The deadline is 23:59 UTC. Don't leave it until the last hour. |

---

## 10b. Web3 trends (8 Nov 2026) mapped to tracks

How hot each theme is, and how crowded its track is likely to be, are my estimates from the sources below.

| Trend right now | Evidence | Track | Heat | Likely crowding |
|---|---|---|---|---|
| **Stablecoins as everyday money** | The #1 theme on 2026 narrative lists. **Nigeria leads the world in stablecoin adoption**: 59% of crypto users hold USDT (BVNK 2026). Gig workers prefer stablecoin pay, and cash-out to naira is the pain point. | `realworld` | 🔥🔥🔥 | Medium. The official starter idea is invoicing, so many entries will be generic. |
| **Exchange and agent key security** | **Binance lost about $6.3B on 29 Oct 2026** through a compromised engineer's laptop. In May 2026, a prompt injection made Grok and Bankr agents send about $150–200K from a wallet. | `security` | 🔥🔥🔥 (very fresh) | Low to medium |
| **Privacy** | ZEC is up about 2,500% in a year, and privacy coins total about $33.6B. Confidential Intents handle about 42% of near.com swap volume. | `privacy` | 🔥🔥🔥 | Medium to high |
| **AI agent payments (x402)** | About 196M transactions and about $42M settled by 1 Nov. Critics estimate about half are artificial. | `agents`, `business` | 🔥🔥 (hype ahead of demand) | **High** |
| **Perps and prediction markets** | Perp-DEX volume is down about 50% from its peak, and Hyperliquid dominates. NEAR launched a NIFTY 50 perp on 4 Nov. | `defi` | 🔥 | High, and hard to build in 6 days |
| **Memecoins** | Cooling after a January spike | `memecoins` | ❄️ | Low |
| **NEAR-specific** | HSP-029 issuance cut (2.5% → 1.6%) passed 2 Nov. NEAR is near $3.70. | `thesis` | Fresh data | Low |

**Supported stablecoins on 1Click (checked live):**
- USDT on **Tron, BSC**, Solana, TON, ETH, NEAR, Polygon, Avalanche, Arbitrum and others.
- USDC on 17 chains.
- No naira stablecoin (cNGN).

**Recommendation (updated: global, not country-specific):** `realworld` as a **worldwide stablecoin payments product**. The payer pays with whatever token they hold, on any of the 39 supported chains, and the recipient receives exactly the token and chain they choose, with amounts shown in their local currency. Enter it under `realworld` + `open`, plus `privacy` if it uses Confidential Intents. Emerging markets (Nigeria, Argentina, Turkey, the Philippines and others) are example users, not the scope. The runner-up is `security` (an agent spending firewall).

**Sources:**
- Stablecoins and narratives: [CoinGecko narratives](https://www.coingecko.com/learn/crypto-narratives), [Dragonfly on stablecoin cards](https://cointelegraph.com/news/stablecoin-card-adoption-to-take-off-in-2026-dragonfly), [Nairametrics: gig workers](https://nairametrics.com/2026/02/24/why-nigerian-gig-workers-prefer-stablecoin-payments-to-the-naira/), [Nigeria leads stablecoin ownership](https://www.livebitcoinnews.com/nigeria-leads-the-world-in-stablecoin-ownership-with-59-usdt)
- Security: [Binance hack (TechCrunch)](https://techcrunch.com/2026/10/29/binance-pauses-withdrawals-as-hackers-suspected-of-stealing-billions-in-crypto/), [Grok wallet drain (OECD.AI)](https://oecd.ai/en/incidents/2026-05-04-4a73)
- Agent payments: [x402 (Decrypt)](https://decrypt.co/resources/what-is-x402-how-ai-agents-pay-with-crypto), [x402 transaction counts (CoinDesk)](https://www.coindesk.com/business/2026/10/14/ai-agents-make-138-million-crypto-payments-as-u-s-dominates-spending-on-ai-models)
- Privacy: [privacy coins (KuCoin)](https://www.kucoin.com/blog/privacy-coins-surge-to-33-6b-market-cap-as-zec-soars-2496-2026-s-top-crypto-sector)
- Perps: [perp-DEX volume decline (ForkLog)](https://forklog.com/en/perp-dex-trading-volumes-plummet-over-50-since-october/amp)
- NEAR: [HSP-029 issuance cut](https://www.coingabbar.com/en/near-protocol-news-house-of-stake-vote-passes-issuance-cut)

---

## 11. Open questions to ask in Discord or Telegram

1. Can one project win prizes in more than one track?
2. Is the grand prize winner also eligible for a track prize?
3. What exactly are the scoring criteria and weights for 2026?
4. Can prizes go unawarded in a track with weak entries?

---

## 12. Sources

**Official**
- [nearhackathon.com](https://nearhackathon.com) and [HACKATHON.md](https://nearhackathon.com/HACKATHON.md)
- [Prompt repo](https://github.com/nearai/near-hackathon-prompt-examples) (README, 00-setup, SUBMITTING, 13 track files)
- [Announcement post](https://x.com/NEARProtocol/status/2112257967818997891) and [submission-window post](https://x.com/NEARProtocol/status/2113017143096963080)

**Docs**
- [1Click quickstart](https://docs.near-intents.org/integration/distribution-channels/1click-api/quickstart) and [making a request](https://docs.near-intents.org/integration/distribution-channels/1click-api/quickstart/making-a-request.md)
- [Chain Signatures](https://docs.near.org/chain-abstraction/chain-signatures/getting-started)
- [NEAR AI Cloud verification](https://docs.near.ai/cloud/verification)
- [Agent API](https://docs.agentsonintents.com/integration/agent-api/overview)
- [OutLayer](https://app.outlayer.ai/docs/getting-started)
- [PingPay Agent Pay](https://pingpay.gitbook.io/docs/pingpay-api/agent-pay-facilitator)
- [Agent Market docs](https://docs.market.near.ai/)

**Coverage**
- Coinfomania: [launch](https://coinfomania.com/near-protocol-launches-hackathon-with-250k-prize-pool/), [judges](https://coinfomania.com/near-hackathon-launches-with-judging-panel-from-a16z/), [AI judges](https://coinfomania.com/near-protocol-enhances-community-engagement-with-ai-judges/), [meetups](https://coinfomania.com/near-protocol-announces-global-hackathon-meetups-for-builders/)
- [CoinAlertNews](https://coinalertnews.com/news/2026/11/03/near-protocol-hackathon-tracks-meetups)
- [Web3Voyager Nov 2026 list](https://web3voyager.com/blog/web3-hackathons-november-2026)

**Events**
- [NYC Private AI Hackathon (Luma)](https://luma.com/private-ai-hack)
- [NEAR Legion calendar](https://luma.com/near-legion)

**Ecosystem data**
- [Nansen Q2 2026](https://nansen.ai/post/nansen-near-quarterly-report-q2-2026)
- Confidential Intents coverage ([BlockEden](https://blockeden.xyz/blog/2026/03/13/near-confidential-intents-privacy-cross-chain-swaps/))

**Past hackathons**
- [One Trillion Agents winners](https://x.com/NEARDevHub/status/1899907018523369591)
- [Zcash × NEAR Intents forum thread](https://forum.zcashcommunity.com/t/zcash-x-near-intents-hackathon/50604)
