// Checks that the NEAR AI Cloud key in .env works.
// Run: node --env-file=.env spike/check-near-ai-key.mjs  (early research; the app does not use NEAR AI)
// Costs a fraction of a cent: one tiny completion on a cheap model.

const BASE_URL = "https://cloud-api.near.ai/v1";
const key = (process.env.NEAR_AI_API_KEY || "").trim();
const model = process.env.NEAR_AI_MODEL || "z-ai/glm-5.3-flash";

if (!key) {
  console.error("NEAR_AI_API_KEY is empty. Open .env and paste your key after the = sign.");
  process.exit(1);
}

const masked = `${key.slice(0, 6)}...${key.slice(-4)}`;
console.log(`Key: ${masked}  |  Model: ${model}`);

// NEAR AI Cloud keys are "sk-" + 32 hex characters (35 total), per nearai/cloud-api source.
if (!/^sk-[0-9a-f]{32}$/i.test(key)) {
  console.error(
    `This doesn't look like a NEAR AI Cloud key (expected "sk-" + 32 characters, 35 total; got ${key.length} characters starting "${key.slice(0, 4)}").\n` +
      "It may be a different key from the NEAR Builders site. Copy the key from the API Credits card instead."
  );
  process.exit(1);
}

const res = await fetch(`${BASE_URL}/chat/completions`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
  body: JSON.stringify({
    model,
    max_tokens: 40,
    messages: [{ role: "user", content: "Reply with exactly: NEAR AI key works" }],
  }),
});

const body = await res.text();
if (!res.ok) {
  const hints = {
    401: "Key rejected. Check it was pasted fully, or wait ~10s if it was just created.",
    402: "Out of credits on this key.",
    403: "Key not allowed for this request (expired or revoked?).",
    404: "Model not found. Pick another id from GET /v1/models.",
    429: "Rate limited. Wait a moment and retry.",
  };
  console.error(`FAILED (HTTP ${res.status}): ${hints[res.status] || "Unexpected error."}`);
  console.error(body.slice(0, 400));
  process.exit(1);
}

const json = JSON.parse(body);
const reply = json.choices?.[0]?.message?.content?.trim();
console.log(`Reply: ${reply}`);
console.log(`Tokens: ${json.usage?.prompt_tokens ?? "?"} in / ${json.usage?.completion_tokens ?? "?"} out`);
console.log("OK: your NEAR AI Cloud key works.");
