import "server-only";
import { AgentApiError } from "./near/agent-api";
import { OneClickError } from "./near/oneclick";

/** An error whose message is written for the user (e.g. "Unknown currency."), returned as-is. */
export class UserError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

/** Reads a JSON request body; malformed or missing JSON becomes an empty object, so validation answers it. */
export async function readJson(request: Request): Promise<Record<string, unknown>> {
  const body = await request.json().catch(() => null);
  return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
}

export function errorResponse(e: unknown) {
  if (e instanceof UserError) return Response.json({ error: e.message }, { status: e.status });
  if (e instanceof AgentApiError || e instanceof OneClickError) {
    const status = e.status >= 400 && e.status < 500 ? 400 : 502;
    return Response.json({ error: e.message }, { status });
  }
  // Anything else is a bug or an outage on our side: log the details, don't show them.
  console.error(e);
  return Response.json({ error: "Something went wrong on our side. Please try again in a moment." }, { status: 500 });
}
