import { endSession } from "@/lib/server/auth/session";

export async function POST() {
  await endSession();
  return Response.json({ ok: true });
}
