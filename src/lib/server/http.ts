import "server-only";
import { AgentApiError } from "./near/agent-api";
import { OneClickError } from "./near/oneclick";

export function errorResponse(e: unknown) {
  if (e instanceof AgentApiError || e instanceof OneClickError) {
    const status = e.status >= 400 && e.status < 500 ? 400 : 502;
    return Response.json({ error: e.message }, { status });
  }
  console.error(e);
  return Response.json({ error: e instanceof Error ? e.message : "Unexpected error" }, { status: 500 });
}
