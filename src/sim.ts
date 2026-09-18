import {
  type DecideRequest,
  type DecideResponse,
  type Direction,
  DIRECTIONS,
  type ErrorResponse,
  type ExitHint,
  type Observation,
} from "../shared/types.ts";
import {
  canMove,
  DELTA,
  index,
  type Maze,
  type Point,
  visibleCells,
} from "./maze.ts";

/** Which pieces of local information are included in the observation. */
export interface InfoOptions {
  visibleCells: boolean;
  visits: boolean;
  lastMove: boolean;
  currentVisits: boolean;
  stepsTaken: boolean;
  exitHint: boolean;
}

export interface SimOptions {
  info: InfoOptions;
  instructions: string;
  model: string;
  maxSteps: number;
}

export type SimStatus =
  | "idle"
  | "running"
  | "paused"
  | "solved"
  | "gave_up"
  | "error";

export interface StepRecord {
  step: number;
  from: Point;
  direction: Direction;
  forced: boolean;
  decision?: DecideResponse;
}

export interface SimState {
  maze: Maze;
  pos: Point;
  steps: number;
  visits: Uint16Array;
  trail: Point[];
  lastMove: Direction | null;
  apiCalls: number;
  forcedMoves: number;
  totalLatencyMs: number;
  inputTokens: number;
  outputTokens: number;
  startedAt: number | null;
  elapsedMs: number;
  status: SimStatus;
  error: string | null;
  lastDecision: DecideResponse | null;
  lastOptions: Direction[];
  history: StepRecord[];
}

export function createSim(maze: Maze): SimState {
  const visits = new Uint16Array(maze.width * maze.height);
  visits[index(maze, maze.start.x, maze.start.y)] = 1;
  return {
    maze,
    pos: { ...maze.start },
    steps: 0,
    visits,
    trail: [{ ...maze.start }],
    lastMove: null,
    apiCalls: 0,
    forcedMoves: 0,
    totalLatencyMs: 0,
    inputTokens: 0,
    outputTokens: 0,
    startedAt: null,
    elapsedMs: 0,
    status: "idle",
    error: null,
    lastDecision: null,
    lastOptions: [],
    history: [],
  };
}

export function passableDirections(sim: SimState): Direction[] {
  return DIRECTIONS.filter((d) => canMove(sim.maze, sim.pos.x, sim.pos.y, d));
}

function exitHint(sim: SimState): ExitHint {
  const dx = sim.maze.exit.x - sim.pos.x;
  const dy = sim.maze.exit.y - sim.pos.y;
  return {
    horizontal: dx === 0 ? "same" : dx > 0 ? "right" : "left",
    vertical: dy === 0 ? "same" : dy > 0 ? "down" : "up",
  };
}

/** Build the local observation Jev gets to see. */
export function observe(sim: SimState, info: InfoOptions): Observation {
  const { maze, pos } = sim;
  const surroundings = {} as Observation["surroundings"];
  for (const d of DIRECTIONS) {
    const passable = canMove(maze, pos.x, pos.y, d);
    const entry: Observation["surroundings"][Direction] = { passable };
    if (passable) {
      if (info.visibleCells) {
        entry.visible_cells = visibleCells(maze, pos.x, pos.y, d);
      }
      if (info.visits) {
        entry.visits =
          sim.visits[index(maze, pos.x + DELTA[d].dx, pos.y + DELTA[d].dy)];
      }
    }
    surroundings[d] = entry;
  }
  const obs: Observation = { surroundings };
  if (info.lastMove) obs.last_move = sim.lastMove;
  if (info.stepsTaken) obs.steps_taken = sim.steps;
  if (info.currentVisits) {
    obs.current_cell_visits = sim.visits[index(maze, pos.x, pos.y)];
  }
  if (info.exitHint) obs.exit_hint = exitHint(sim);
  return obs;
}

async function askJev(
  req: DecideRequest,
  signal?: AbortSignal,
): Promise<DecideResponse> {
  const res = await fetch("/api/decide", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(req),
    signal,
  });
  const body = await res.json() as DecideResponse | ErrorResponse;
  if (!res.ok || "error" in body) {
    throw new Error("error" in body ? body.error : `HTTP ${res.status}`);
  }
  return body;
}

function applyMove(sim: SimState, dir: Direction): void {
  sim.pos = { x: sim.pos.x + DELTA[dir].dx, y: sim.pos.y + DELTA[dir].dy };
  sim.visits[index(sim.maze, sim.pos.x, sim.pos.y)]++;
  sim.trail.push({ ...sim.pos });
  sim.lastMove = dir;
  sim.steps++;
}

/**
 * Advance the simulation by one move. Only calls Jev when there is an actual
 * choice to make; a single passable direction is taken without asking.
 */
export async function step(
  sim: SimState,
  opts: SimOptions,
  signal?: AbortSignal,
): Promise<void> {
  if (
    sim.status === "solved" || sim.status === "gave_up" ||
    sim.status === "error"
  ) return;
  if (sim.startedAt === null) sim.startedAt = performance.now();
  const options = passableDirections(sim);
  sim.lastOptions = options;
  const from = { ...sim.pos };
  let dir: Direction;
  let forced = false;
  let decision: DecideResponse | undefined;

  if (options.length === 1) {
    dir = options[0];
    forced = true;
    sim.forcedMoves++;
    sim.lastDecision = null;
  } else {
    const t0 = performance.now();
    try {
      decision = await askJev({
        observation: observe(sim, opts.info),
        instructions: opts.instructions,
        model: opts.model,
      }, signal);
    } catch (err) {
      if (signal?.aborted) return;
      sim.status = "error";
      sim.error = err instanceof Error ? err.message : String(err);
      sim.elapsedMs = performance.now() - sim.startedAt;
      return;
    }
    sim.apiCalls++;
    sim.totalLatencyMs += performance.now() - t0;
    sim.inputTokens += decision.usage.input_tokens;
    sim.outputTokens += decision.usage.output_tokens;
    sim.lastDecision = decision;
    dir = options.includes(decision.choice) ? decision.choice : options[0];
  }

  applyMove(sim, dir);
  sim.history.push({ step: sim.steps, from, direction: dir, forced, decision });
  sim.elapsedMs = performance.now() - sim.startedAt;

  if (sim.pos.x === sim.maze.exit.x && sim.pos.y === sim.maze.exit.y) {
    sim.status = "solved";
  } else if (sim.steps >= opts.maxSteps) {
    sim.status = "gave_up";
  }
}
