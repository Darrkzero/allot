import "server-only";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import type { Rule } from "../rules";

// Small SQLite store (Node's built-in driver; no native install).
// Without ALLOT_DB_PATH, a Railway volume is used when one is attached (Railway sets its mount path),
// so a missing variable can't silently put the data on the container's throwaway disk.
const DB_PATH =
  process.env.ALLOT_DB_PATH ||
  (process.env.RAILWAY_VOLUME_MOUNT_PATH ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, "allot.db") : path.join(process.cwd(), "data", "allot.db"));

let db: DatabaseSync | null = null;
function conn(): DatabaseSync {
  if (db) return db;
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  db = new DatabaseSync(DB_PATH);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS routers (
      handle TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      rules TEXT NOT NULL,          -- JSON Rule[]
      owner TEXT NOT NULL,          -- JSON passkey owner (public data)
      agent_id TEXT,
      intents_account TEXT,
      grant_sealed TEXT,            -- encrypted grant token
      setup TEXT,                   -- JSON: pending correlation ids during setup
      status TEXT NOT NULL,         -- 'pending_create' | 'pending_grant' | 'active'
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      handle TEXT NOT NULL REFERENCES routers(handle),
      amount_usd REAL NOT NULL,
      memo TEXT,
      origin_asset TEXT NOT NULL,
      origin_symbol TEXT NOT NULL,
      origin_chain TEXT NOT NULL,
      deposit_address TEXT NOT NULL,
      deposit_memo TEXT,
      amount_in_formatted TEXT NOT NULL,
      amount_out TEXT NOT NULL,     -- atomic settle-asset units expected
      deadline TEXT,
      status TEXT NOT NULL,         -- 1Click status
      detail TEXT,                  -- JSON last status payload
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS payments_by_handle ON payments(handle, created_at);
    CREATE TABLE IF NOT EXISTS legs (
      id TEXT PRIMARY KEY,            -- <paymentId>:<rule index>
      payment_id TEXT NOT NULL REFERENCES payments(id),
      idx INTEGER NOT NULL,
      label TEXT NOT NULL,
      percent INTEGER NOT NULL,
      symbol TEXT NOT NULL,
      chain TEXT NOT NULL,
      address TEXT NOT NULL,
      target_asset TEXT NOT NULL,
      amount_settle TEXT NOT NULL,    -- atomic USDC allotted to this slice
      phase TEXT NOT NULL,            -- 'shield' | 'swap' | 'withdraw' | 'done' | 'failed'
      swap_corr TEXT,
      swap_out TEXT,                  -- atomic target-asset amount received from the swap
      withdraw_corr TEXT,
      withdraw_amount TEXT,
      tx_hash TEXT,
      dest_tx_hash TEXT,
      agent_status TEXT,
      error TEXT,
      attempts INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS legs_by_payment ON legs(payment_id, idx);
    CREATE TABLE IF NOT EXISTS challenges (
      id TEXT PRIMARY KEY,
      handle TEXT NOT NULL,
      challenge TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    );
  `);
  // Migrations (each throws "duplicate column" once applied, which is fine):
  //   key_n: idempotency-key generation, bumped only after a definitive "nothing submitted" rejection
  //   private / shield_corr / shield_out: private slices routed through NEAR Confidential Intents
  //   grant_expires_at: when the split engine's permission (grant) lapses; the owner renews it
  for (const sql of [
    "ALTER TABLE routers ADD COLUMN grant_expires_at TEXT",
    "ALTER TABLE legs ADD COLUMN key_n INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE legs ADD COLUMN private INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE legs ADD COLUMN shield_corr TEXT",
    "ALTER TABLE legs ADD COLUMN shield_out TEXT",
  ]) {
    try {
      db.exec(sql);
    } catch {
      // column already exists
    }
  }
  return db;
}

export type RouterRow = {
  handle: string;
  name: string;
  rules: Rule[];
  owner: { type: "passkey"; credential_id: string; public_key: string; rp_id: string; origin: string };
  agent_id: string | null;
  intents_account: string | null;
  grant_sealed: string | null;
  grant_expires_at: string | null; // null for links made before renewal existed: created_at + 90 days
  setup: Record<string, string> | null;
  status: "pending_create" | "pending_grant" | "active";
  created_at: string;
};

const parseRouter = (r: Record<string, unknown> | undefined): RouterRow | null =>
  r
    ? ({
        ...r,
        rules: JSON.parse(r.rules as string),
        owner: JSON.parse(r.owner as string),
        setup: r.setup ? JSON.parse(r.setup as string) : null,
      } as RouterRow)
    : null;

export function getRouter(handle: string): RouterRow | null {
  return parseRouter(conn().prepare("SELECT * FROM routers WHERE handle = ?").get(handle) as Record<string, unknown> | undefined);
}

export function insertRouter(r: Pick<RouterRow, "handle" | "name" | "rules" | "owner" | "agent_id" | "setup">) {
  conn()
    .prepare(
      `INSERT INTO routers (handle, name, rules, owner, agent_id, setup, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending_create', ?)`
    )
    .run(r.handle, r.name, JSON.stringify(r.rules), JSON.stringify(r.owner), r.agent_id, JSON.stringify(r.setup), new Date().toISOString());
}

export function updateRouter(handle: string, patch: Partial<Pick<RouterRow, "intents_account" | "grant_sealed" | "grant_expires_at" | "setup" | "status">>) {
  const sets: string[] = [];
  const vals: (string | null)[] = [];
  for (const [k, v] of Object.entries(patch)) {
    sets.push(`${k} = ?`);
    vals.push(v === null || v === undefined ? null : typeof v === "string" ? v : JSON.stringify(v));
  }
  if (!sets.length) return;
  conn().prepare(`UPDATE routers SET ${sets.join(", ")} WHERE handle = ?`).run(...vals, handle);
}

/** Removes an unfinished setup so the handle can be retried. */
export function deletePendingRouter(handle: string) {
  conn().prepare("DELETE FROM routers WHERE handle = ? AND status != 'active'").run(handle);
}

export type PaymentRow = {
  id: string;
  handle: string;
  amount_usd: number;
  memo: string | null;
  origin_asset: string;
  origin_symbol: string;
  origin_chain: string;
  deposit_address: string;
  deposit_memo: string | null;
  amount_in_formatted: string;
  amount_out: string;
  deadline: string | null;
  status: string;
  detail: string | null;
  created_at: string;
  updated_at: string;
};

export function insertPayment(p: Omit<PaymentRow, "created_at" | "updated_at" | "detail">) {
  const now = new Date().toISOString();
  conn()
    .prepare(
      `INSERT INTO payments (id, handle, amount_usd, memo, origin_asset, origin_symbol, origin_chain, deposit_address,
        deposit_memo, amount_in_formatted, amount_out, deadline, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(p.id, p.handle, p.amount_usd, p.memo, p.origin_asset, p.origin_symbol, p.origin_chain, p.deposit_address,
      p.deposit_memo, p.amount_in_formatted, p.amount_out, p.deadline, p.status, now, now);
}

export function getPayment(id: string): PaymentRow | null {
  return (conn().prepare("SELECT * FROM payments WHERE id = ?").get(id) as PaymentRow | undefined) ?? null;
}

export function updatePaymentStatus(id: string, status: string, detail: unknown) {
  conn()
    .prepare("UPDATE payments SET status = ?, detail = ?, updated_at = ? WHERE id = ?")
    .run(status, JSON.stringify(detail), new Date().toISOString(), id);
}

export function listPayments(handle: string, limit = 50): PaymentRow[] {
  return conn().prepare("SELECT * FROM payments WHERE handle = ? ORDER BY created_at DESC LIMIT ?").all(handle, limit) as PaymentRow[];
}

export type LegPhase = "shield" | "swap" | "withdraw" | "done" | "failed";

export type LegRow = {
  id: string;
  payment_id: string;
  idx: number;
  label: string;
  percent: number;
  symbol: string;
  chain: string;
  address: string;
  target_asset: string;
  amount_settle: string;
  phase: LegPhase;
  private: number; // 1 = routed through NEAR Confidential Intents
  shield_corr: string | null;
  shield_out: string | null; // atomic USDC that reached the confidential balance
  swap_corr: string | null;
  swap_out: string | null;
  withdraw_corr: string | null;
  withdraw_amount: string | null;
  tx_hash: string | null;
  dest_tx_hash: string | null;
  agent_status: string | null;
  error: string | null;
  attempts: number;
  key_n: number;
  updated_at: string;
};

export function getLegs(paymentId: string): LegRow[] {
  return conn().prepare("SELECT * FROM legs WHERE payment_id = ? ORDER BY idx").all(paymentId) as LegRow[];
}

/** Inserts the legs for a payment once; a second call is a no-op. */
export function insertLegs(
  legs: Omit<LegRow, "updated_at" | "attempts" | "key_n" | "shield_corr" | "shield_out" | "swap_corr" | "swap_out" | "withdraw_corr" | "tx_hash" | "dest_tx_hash" | "agent_status" | "error">[]
) {
  const c = conn();
  const stmt = c.prepare(
    `INSERT OR IGNORE INTO legs (id, payment_id, idx, label, percent, symbol, chain, address, target_asset, amount_settle, phase, private, withdraw_amount, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const now = new Date().toISOString();
  c.exec("BEGIN");
  try {
    for (const l of legs) {
      stmt.run(l.id, l.payment_id, l.idx, l.label, l.percent, l.symbol, l.chain, l.address, l.target_asset, l.amount_settle, l.phase, l.private, l.withdraw_amount, now);
    }
    c.exec("COMMIT");
  } catch (e) {
    c.exec("ROLLBACK");
    throw e;
  }
}

type LegPatch = Partial<
  Pick<LegRow, "phase" | "shield_corr" | "shield_out" | "swap_corr" | "swap_out" | "withdraw_corr" | "withdraw_amount" | "tx_hash" | "dest_tx_hash" | "agent_status" | "error" | "attempts" | "key_n">
>;

export function updateLeg(id: string, patch: LegPatch) {
  const keys = Object.keys(patch) as (keyof LegPatch)[];
  if (!keys.length) return;
  const sets = keys.map((k) => `${k} = ?`).join(", ");
  const vals = keys.map((k) => (patch[k] === undefined ? null : patch[k])) as (string | number | null)[];
  conn().prepare(`UPDATE legs SET ${sets}, updated_at = ? WHERE id = ?`).run(...vals, new Date().toISOString(), id);
}

/** One-time sign-in challenge, valid for 2 minutes. */
export function createChallenge(handle: string, id: string, challenge: string) {
  const c = conn();
  c.prepare("DELETE FROM challenges WHERE expires_at < ?").run(Date.now());
  c.prepare("INSERT INTO challenges (id, handle, challenge, expires_at) VALUES (?, ?, ?, ?)").run(id, handle, challenge, Date.now() + 120_000);
}

/** Consumes a challenge (single use). Returns it only if unexpired and issued for this handle. */
export function takeChallenge(id: string, handle: string): string | null {
  const c = conn();
  const row = c.prepare("SELECT * FROM challenges WHERE id = ?").get(id) as { handle: string; challenge: string; expires_at: number } | undefined;
  c.prepare("DELETE FROM challenges WHERE id = ?").run(id);
  if (!row || row.handle !== handle || row.expires_at < Date.now()) return null;
  return row.challenge;
}

/**
 * Retries a payment's failed slices: fresh idempotency keys, attempt counter reset.
 * Each slice resumes at the step it hadn't finished (shield, then swap, then withdraw).
 * An operation is only resubmitted if NEAR reported it FAILED or REFUNDED (its funds came back).
 * Otherwise (e.g. the slice gave up while a withdrawal was still in flight, or a swap succeeded
 * without reporting its output) its correlation id is kept, so the engine re-checks the original
 * instead of sending twice from the wallet's shared balance.
 */
export function resetFailedLegs(paymentId: string, settleAsset: string): number {
  return Number(
    conn()
      .prepare(
        `UPDATE legs SET
           phase = CASE
             WHEN private = 1 AND shield_out IS NULL THEN 'shield'
             WHEN swap_out IS NOT NULL OR target_asset = ? THEN 'withdraw'
             ELSE 'swap' END,
           shield_corr = CASE WHEN shield_out IS NULL AND agent_status IN ('FAILED', 'REFUNDED') THEN NULL ELSE shield_corr END,
           swap_corr = CASE WHEN swap_out IS NULL AND agent_status IN ('FAILED', 'REFUNDED') THEN NULL ELSE swap_corr END,
           withdraw_corr = CASE WHEN agent_status IN ('FAILED', 'REFUNDED') THEN NULL ELSE withdraw_corr END,
           attempts = 0, key_n = key_n + 1, error = NULL, updated_at = ?
         WHERE payment_id = ? AND phase = 'failed'`
      )
      .run(settleAsset, new Date().toISOString(), paymentId).changes
  );
}

/** Slice phases that still need work. */
export const OPEN_PHASES: ReadonlySet<LegPhase> = new Set(["shield", "swap", "withdraw"]);

/**
 * Payments still waiting on 1Click (not yet paid, refunded or failed), from the last 4 days:
 * deposit addresses stay open about 3 days. Least recently updated first.
 */
export function listOpenPayments(limit = 25): PaymentRow[] {
  const since = new Date(Date.now() - 4 * 86_400_000).toISOString();
  return conn()
    .prepare(
      `SELECT * FROM payments
       WHERE status IN ('PENDING_DEPOSIT', 'KNOWN_DEPOSIT_TX', 'PROCESSING', 'INCOMPLETE_DEPOSIT') AND created_at > ?
       ORDER BY updated_at LIMIT ?`
    )
    .all(since, limit) as PaymentRow[];
}

/** Cheap check that the database file is reachable (used by the health check). */
export function dbHealthy(): boolean {
  return (conn().prepare("SELECT 1 AS ok").get() as { ok: number } | undefined)?.ok === 1;
}

/**
 * Paid payments whose split isn't finished yet (for the sweeper). Unsplit payments first, then
 * the ones whose slices were touched longest ago, so every pending payment gets its turn.
 */
export function paymentsNeedingSplit(limit = 20): PaymentRow[] {
  return conn()
    .prepare(
      `SELECT p.* FROM payments p
       WHERE p.status = 'SUCCESS'
         AND (NOT EXISTS (SELECT 1 FROM legs l WHERE l.payment_id = p.id)
              OR EXISTS (SELECT 1 FROM legs l WHERE l.payment_id = p.id AND l.phase IN ('shield','swap','withdraw')))
       ORDER BY COALESCE((SELECT MAX(l.updated_at) FROM legs l WHERE l.payment_id = p.id), '') LIMIT ?`
    )
    .all(limit) as PaymentRow[];
}
