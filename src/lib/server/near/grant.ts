import "server-only";
import { generateIntent, newGrantCredential } from "./agent-api";
import type { RouterRow } from "../db";

/**
 * The split engine's permission to act inside a link's policy ("grant"). The owner signs only
 * the SHA-256 commitment of a token our server keeps (sealed); it lapses after GRANT_DAYS, and
 * the owner renews it from the dashboard with one passkey approval.
 */
export const GRANT_DAYS = 90;
export const GRANT_RENEW_WINDOW_DAYS = 14; // the dashboard nudges the owner this close to expiry

/** Shown when an owner signature is still settling; pressing Approve again resumes safely. */
export const STILL_CONFIRMING = "NEAR is still confirming this step. Wait a moment, then press Approve again: it picks up where it left off.";

/** A fresh grant token plus the owner intent that authorises it. Nothing is active until signed. */
export async function prepareGrant(agentId: string) {
  const { token, credential } = newGrantCredential();
  const expiresAt = new Date(Date.now() + GRANT_DAYS * 86_400_000).toISOString().replace(/\.\d+Z$/, "Z");
  const intent = await generateIntent({ type: "grant_issue", agent_id: agentId, label: "allot-split-engine", credential, expires_at: expiresAt });
  return { token, expiresAt, intent };
}

/** When a link's grant lapses. Links set up before renewal existed didn't record it: 90 days from creation. */
export function grantExpiry(r: Pick<RouterRow, "grant_expires_at" | "created_at">): string {
  return r.grant_expires_at ?? new Date(Date.parse(r.created_at) + GRANT_DAYS * 86_400_000).toISOString();
}
