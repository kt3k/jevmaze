/** Types shared between the server and the browser bundle. */

export type Direction = "up" | "down" | "left" | "right";

export const DIRECTIONS: readonly Direction[] = ["up", "down", "left", "right"];

/** What Jev is told about one of the four directions from the current cell. */
export interface DirectionInfo {
  /** Whether the agent can step in this direction (no wall). */
  passable: boolean;
  /** How many cells are visible in this direction before hitting a wall. */
  visible_cells?: number;
  /** How many times the adjacent cell in this direction has been visited. */
  visits?: number;
}

export interface ExitHint {
  horizontal: "left" | "right" | "same";
  vertical: "up" | "down" | "same";
}

/** Everything Jev gets to see for one decision. Only local information. */
export interface Observation {
  surroundings: Record<Direction, DirectionInfo>;
  last_move?: Direction | null;
  steps_taken?: number;
  current_cell_visits?: number;
  exit_hint?: ExitHint;
}

export interface DecideRequest {
  observation: Observation;
  /** Instruction text for the Choice question. Falls back to a default. */
  instructions?: string;
  /** Model name, e.g. "jev-latest". */
  model?: string;
}

export interface DecideResponse {
  choice: Direction;
  probabilities: Partial<Record<Direction, number>>;
  confidence: number;
  model: string;
  usage: { input_tokens: number; output_tokens: number };
  /** Wall-clock time of the Jev API call as measured on the server. */
  latency_ms: number;
}

export interface ErrorResponse {
  error: string;
}

export const DEFAULT_INSTRUCTIONS =
  "You are an agent exploring a 2D grid maze and must reach the exit. " +
  "You can only see your immediate surroundings. Choose the direction to move next. " +
  "Prefer directions that lead to cells you have not visited yet, and avoid reversing " +
  "your last move unless it is the only way forward.";
