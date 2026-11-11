// Shared setup for unit tests: run the real TypeScript sources (via jiti) against a throwaway
// SQLite file, with no keys and no network unless a test starts its own mock server.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

// A fresh database per test file, removed on exit.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "allot-test-"));
process.env.ALLOT_DB_PATH = path.join(dir, "test.db");
process.env.ALLOT_SECRET ??= "unit-test-secret-unit-test-secret";
// Best effort: on Windows the SQLite file can still be open at exit; it lives in the OS temp folder anyway.
process.on("exit", () => {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {}
});

// "server-only" throws outside React Server Components; point it at its no-op build, as Next does.
const jiti = createJiti(import.meta.url, {
  alias: { "server-only": path.join(ROOT, "node_modules/server-only/empty.js"), "@": path.join(ROOT, "src") },
});

/** Imports a source file by its path from the project root, e.g. load("src/lib/server/db.ts"). */
export const load = (rel) => jiti.import(path.join(ROOT, rel));
export const dbPath = process.env.ALLOT_DB_PATH;
