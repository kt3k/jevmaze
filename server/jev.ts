import { choice, type JsonValue, TypeSafeClient } from "@typesafe-ai/sdk";
import {
  type DecideRequest,
  type DecideResponse,
  DEFAULT_INSTRUCTIONS,
  type Direction,
  DIRECTIONS,
} from "../shared/types.ts";

const DIRECTION_LABEL: Record<Direction, string> = {
  up: "Move one cell up (north)",
  down: "Move one cell down (south)",
  left: "Move one cell left (west)",
  right: "Move one cell right (east)",
};

let client: TypeSafeClient | undefined;

/** Lazily create the SDK client so a missing key only fails API calls, not startup. */
export function getClient(): TypeSafeClient {
  if (client) return client;
  const apiKey = Deno.env.get("JEV_KEY") ?? Deno.env.get("TYPESAFE_API_KEY");
  if (!apiKey) {
    throw new Error("JEV_KEY (or TYPESAFE_API_KEY) is not set");
  }
  client = new TypeSafeClient({ apiKey, timeout: 15_000 });
  return client;
}

/** Describe one option so the per-option rubric carries the local information too. */
function describeOption(req: DecideRequest, dir: Direction): string {
  const info = req.observation.surroundings[dir];
  const parts = [DIRECTION_LABEL[dir]];
  if (info.visible_cells !== undefined) {
    parts.push(`${info.visible_cells} cell(s) visible ahead before a wall`);
  }
  if (info.visits !== undefined) {
    parts.push(
      info.visits === 0
        ? "the next cell is unvisited"
        : `the next cell was visited ${info.visits} time(s)`,
    );
  }
  if (req.observation.last_move && isReverse(req.observation.last_move, dir)) {
    parts.push("this reverses the previous move");
  }
  return parts.join("; ");
}

function isReverse(a: Direction, b: Direction): boolean {
  return (a === "up" && b === "down") || (a === "down" && b === "up") ||
    (a === "left" && b === "right") || (a === "right" && b === "left");
}

export function validateRequest(body: unknown): DecideRequest {
  if (!body || typeof body !== "object") {
    throw new Error("body must be an object");
  }
  const req = body as DecideRequest;
  const obs = req.observation;
  if (!obs || typeof obs !== "object" || !obs.surroundings) {
    throw new Error("observation.surroundings is required");
  }
  for (const d of DIRECTIONS) {
    const info = obs.surroundings[d];
    if (!info || typeof info.passable !== "boolean") {
      throw new Error(
        `observation.surroundings.${d}.passable must be a boolean`,
      );
    }
  }
  if (req.instructions !== undefined && typeof req.instructions !== "string") {
    throw new Error("instructions must be a string");
  }
  if (req.model !== undefined && typeof req.model !== "string") {
    throw new Error("model must be a string");
  }
  return req;
}

/** Ask Jev which of the passable directions to take. */
export async function decide(req: DecideRequest): Promise<DecideResponse> {
  const passable = DIRECTIONS.filter((d) =>
    req.observation.surroundings[d].passable
  );
  if (passable.length === 0) throw new Error("no passable direction");

  const criteria: Partial<Record<Direction, string>> = {};
  for (const d of passable) criteria[d] = describeOption(req, d);

  const instructions = req.instructions?.trim() || DEFAULT_INSTRUCTIONS;
  // The SDK's EntryType wants an index signature; the observation is plain JSON.
  const state: Record<string, JsonValue> = {
    task:
      "Find the exit of a 2D grid maze. Only the immediate surroundings are known.",
    ...(req.observation as unknown as Record<string, JsonValue>),
  };

  const started = performance.now();
  const result = await getClient().systemOne({
    state,
    model: req.model?.trim() || undefined,
    questions: {
      move: choice(instructions, criteria as Record<Direction, string>),
    },
  });
  const latency_ms = Math.round(performance.now() - started);

  const answer = result.answers.move;
  return {
    choice: answer.choice,
    probabilities: answer.probabilities,
    confidence: answer.confidence,
    model: result.model,
    usage: result.usage,
    latency_ms,
  };
}
