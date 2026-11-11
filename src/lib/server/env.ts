import "server-only";

function req(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing ${name} in .env (see .env.example)`);
  return v;
}

export const env = {
  get oneClickKey() { return process.env.NEAR_INTENTS_API_KEY?.trim() || ""; }, // optional: lower fees
  get agentApiUrl() { return req("NEAR_INTENTS_AGENT_API_URL").replace(/\/$/, ""); },
  get agentApiKey() { return req("NEAR_INTENTS_AGENT_API_KEY"); },
  /** 32+ random chars; encrypts grant tokens at rest. */
  get secret() { return req("ALLOT_SECRET"); },
};
