import { serveDir } from "@std/http/file-server";
import { APIError, TypeSafeError } from "@typesafe-ai/sdk";
import { decide, validateRequest } from "./server/jev.ts";
import type { ErrorResponse } from "./shared/types.ts";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function errorResponse(message: string, status: number): Response {
  const body: ErrorResponse = { error: message };
  return json(body, status);
}

async function handleDecide(req: Request): Promise<Response> {
  if (req.method !== "POST") return errorResponse("method not allowed", 405);
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse("invalid JSON body", 400);
  }
  try {
    const decision = await decide(validateRequest(body));
    return json(decision);
  } catch (err) {
    if (err instanceof APIError) {
      return errorResponse(
        `Jev API error (${err.status}): ${err.message}`,
        502,
      );
    }
    if (err instanceof TypeSafeError) {
      return errorResponse(`Jev SDK error: ${err.message}`, 502);
    }
    const message = err instanceof Error ? err.message : String(err);
    return errorResponse(message, 400);
  }
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (url.pathname === "/api/decide") return await handleDecide(req);
  if (url.pathname === "/api/health") return json({ ok: true });
  if (url.pathname === "/hello") return new Response("hello");

  const res = await serveDir(req, { fsRoot: "dist", quiet: true });
  if (res.status === 404 && url.pathname === "/") {
    return new Response(
      "dist/ is missing. Run `deno task build` first.",
      { status: 503 },
    );
  }
  return res;
});
