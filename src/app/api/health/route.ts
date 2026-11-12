import { connection } from "next/server";
import { dbHealthy } from "@/lib/server/db";

// Health check for the host (Railway): the server is up and its database file is reachable.
// A failing check keeps a broken deploy (e.g. a missing volume) from replacing a working one.
export async function GET() {
  await connection(); // always run at request time
  try {
    return Response.json({ ok: dbHealthy() });
  } catch {
    return Response.json({ ok: false, error: "Database unavailable" }, { status: 503 });
  }
}
