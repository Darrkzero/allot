import "server-only";
import { createHash, createPublicKey, verify } from "node:crypto";

// Minimal WebAuthn assertion verification for dashboard sign-in (ES256 / P-256 passkeys).
// Checks, in order: credential id, clientData type/challenge/origin, rpId hash, user
// presence + verification flags, and the ECDSA signature over authData || sha256(clientData).

const sha256 = (b: Buffer | string) => createHash("sha256").update(b).digest();
const fromB64url = (s: string) => Buffer.from(s, "base64url");

export type AssertionInput = {
  id: string;
  response: { clientDataJSON: string; authenticatorData: string; signature: string };
};

export type Expected = {
  challenge: string; // base64url, exactly as issued
  origin: string;
  rpId: string;
  credentialId: string; // base64url
  publicKeySpki: string; // base64url DER SPKI (as stored at setup)
};

export function verifyAssertion(a: AssertionInput, exp: Expected): { ok: true } | { ok: false; reason: string } {
  try {
    if (a.id !== exp.credentialId) return { ok: false, reason: "Unknown passkey for this link." };

    const clientDataRaw = fromB64url(a.response.clientDataJSON);
    const clientData = JSON.parse(clientDataRaw.toString("utf8"));
    if (clientData.type !== "webauthn.get") return { ok: false, reason: "Wrong ceremony type." };
    if (clientData.challenge !== exp.challenge) return { ok: false, reason: "Challenge mismatch." };
    if (clientData.origin !== exp.origin) return { ok: false, reason: `Origin mismatch (${clientData.origin}).` };

    const authData = fromB64url(a.response.authenticatorData);
    if (authData.length < 37) return { ok: false, reason: "Malformed authenticator data." };
    if (!authData.subarray(0, 32).equals(sha256(exp.rpId))) return { ok: false, reason: "Wrong relying party." };
    const flags = authData[32];
    if (!(flags & 0x01)) return { ok: false, reason: "User presence not confirmed." };
    if (!(flags & 0x04)) return { ok: false, reason: "User verification (fingerprint/PIN) not performed." };

    const key = createPublicKey({ key: fromB64url(exp.publicKeySpki), format: "der", type: "spki" });
    const signed = Buffer.concat([authData, sha256(clientDataRaw)]);
    const good = verify("sha256", signed, { key, dsaEncoding: "der" }, fromB64url(a.response.signature));
    return good ? { ok: true } : { ok: false, reason: "Signature check failed." };
  } catch {
    return { ok: false, reason: "Could not verify the passkey response." };
  }
}
