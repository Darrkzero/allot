"use client";

// Browser passkeys (WebAuthn): the recipient's fingerprint / Face ID is the owner of their
// payout wallet. No seed phrase, no wallet extension.

export const b64url = (buf: ArrayBuffer | Uint8Array) => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

export const fromB64url = (s: string) => {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  return Uint8Array.from(atob(pad), (c) => c.charCodeAt(0));
};

export type PasskeyOwner = { type: "passkey"; credential_id: string; public_key: string; rp_id: string; origin: string };

/** Browser passkey errors, in words people understand. */
export function passkeyErrorMessage(e: unknown, fallback: string) {
  if (e instanceof DOMException && (e.name === "NotAllowedError" || e.name === "AbortError")) {
    return "The passkey prompt was closed or timed out. Press the button to try again.";
  }
  if (e instanceof DOMException && e.name === "InvalidStateError") return "This device already has a passkey for this link. Try a different link name.";
  return e instanceof Error ? e.message : fallback;
}

export function passkeysSupported() {
  return typeof window !== "undefined" && !!window.PublicKeyCredential && !!navigator.credentials;
}

/** Creates a new passkey for this payment link and returns the owner object the Agent API expects. */
export async function createPasskey(handle: string, displayName: string): Promise<PasskeyOwner> {
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: "Allot", id: location.hostname },
      user: { id: crypto.getRandomValues(new Uint8Array(16)), name: `${handle}@allot`, displayName },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }], // ES256 / P-256, required by the Agent API
      authenticatorSelection: { residentKey: "preferred", userVerification: "required" },
      attestation: "none",
      timeout: 120_000,
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error("Passkey creation was cancelled.");
  const res = cred.response as AuthenticatorAttestationResponse;
  const spki = res.getPublicKey?.();
  if (!spki) throw new Error("This browser can't export the passkey's public key. Try Chrome, Edge or Safari.");
  return { type: "passkey", credential_id: b64url(cred.rawId), public_key: b64url(spki), rp_id: location.hostname, origin: location.origin };
}

type WebAuthnPayload = {
  challenge: string;
  rpId: string;
  allowCredentials: { id: string; type: "public-key" }[];
  userVerification: "required";
  timeout: number;
};

/** Dashboard sign-in: signs a server challenge with this link's passkey. Must run from a click. */
export async function signInWithPasskey(c: { challenge: string; rpId: string; credentialId: string }) {
  const cred = (await navigator.credentials.get({
    publicKey: {
      challenge: fromB64url(c.challenge),
      rpId: c.rpId,
      allowCredentials: [{ id: fromB64url(c.credentialId), type: "public-key" }],
      userVerification: "required",
      timeout: 120_000,
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error("Sign-in was cancelled.");
  const r = cred.response as AuthenticatorAssertionResponse;
  return {
    id: b64url(cred.rawId),
    response: { clientDataJSON: b64url(r.clientDataJSON), authenticatorData: b64url(r.authenticatorData), signature: b64url(r.signature) },
  };
}

/** Signs an Agent API owner intent (standard "webauthn") with the passkey. Must run from a click. */
export async function signIntent(intent: { standard: string; payload: Record<string, unknown> }) {
  if (intent.standard !== "webauthn") throw new Error(`Unexpected signing standard: ${intent.standard}`);
  const p = intent.payload as unknown as WebAuthnPayload;
  const cred = (await navigator.credentials.get({
    publicKey: {
      challenge: fromB64url(p.challenge),
      rpId: p.rpId,
      allowCredentials: p.allowCredentials.map((c) => ({ id: fromB64url(c.id), type: "public-key" as const })),
      userVerification: p.userVerification,
      timeout: p.timeout,
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error("Signing was cancelled.");
  const r = cred.response as AuthenticatorAssertionResponse;
  const credential: Record<string, unknown> = {
    id: cred.id,
    rawId: b64url(cred.rawId),
    type: "public-key",
    response: {
      clientDataJSON: b64url(r.clientDataJSON),
      authenticatorData: b64url(r.authenticatorData),
      signature: b64url(r.signature),
      ...(r.userHandle ? { userHandle: b64url(r.userHandle) } : {}),
    },
    clientExtensionResults: cred.getClientExtensionResults?.() ?? {},
  };
  if (cred.authenticatorAttachment === "platform" || cred.authenticatorAttachment === "cross-platform") {
    credential.authenticatorAttachment = cred.authenticatorAttachment;
  }
  return { standard: "webauthn", payload: intent.payload, credential };
}
