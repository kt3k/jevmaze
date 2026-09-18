import type { Direction } from "../shared/types.ts";
import { mulberry32 } from "./prng.ts";

/** Wall bits for a cell. A set bit means the wall is present. */
export const WALL: Record<Direction, number> = {
  up: 1,
  down: 2,
  left: 4,
  right: 8,
};

export const DELTA: Record<Direction, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

export const OPPOSITE: Record<Direction, Direction> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

export interface Point {
  x: number;
  y: number;
}

export interface Maze {
  width: number;
  height: number;
  seed: number;
  /** Fraction of dead ends that were opened up to create loops (0 = perfect maze). */
  braid: number;
  /** Wall bitmask per cell, row-major. */
  cells: Uint8Array;
  start: Point;
  exit: Point;
}

export interface MazeOptions {
  width: number;
  height: number;
  seed: number;
  braid?: number;
}

export function index(maze: Maze, x: number, y: number): number {
  return y * maze.width + x;
}

export function inBounds(maze: Maze, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < maze.width && y < maze.height;
}

export function hasWall(
  maze: Maze,
  x: number,
  y: number,
  dir: Direction,
): boolean {
  return (maze.cells[index(maze, x, y)] & WALL[dir]) !== 0;
}

export function canMove(
  maze: Maze,
  x: number,
  y: number,
  dir: Direction,
): boolean {
  if (hasWall(maze, x, y, dir)) return false;
  const { dx, dy } = DELTA[dir];
  return inBounds(maze, x + dx, y + dy);
}

function removeWall(maze: Maze, x: number, y: number, dir: Direction): void {
  const { dx, dy } = DELTA[dir];
  const nx = x + dx, ny = y + dy;
  if (!inBounds(maze, nx, ny)) return;
  maze.cells[index(maze, x, y)] &= ~WALL[dir];
  maze.cells[index(maze, nx, ny)] &= ~WALL[OPPOSITE[dir]];
}

/** Generate a maze with the recursive backtracker, then optionally braid it. */
export function generateMaze(opts: MazeOptions): Maze {
  const { width, height, seed } = opts;
  const braid = Math.min(1, Math.max(0, opts.braid ?? 0));
  const rand = mulberry32(seed);
  const maze: Maze = {
    width,
    height,
    seed,
    braid,
    cells: new Uint8Array(width * height).fill(15),
    start: { x: 0, y: 0 },
    exit: { x: width - 1, y: height - 1 },
  };

  const visited = new Uint8Array(width * height);
  const stack: Point[] = [{ x: 0, y: 0 }];
  visited[0] = 1;
  const dirs: Direction[] = ["up", "down", "left", "right"];

  while (stack.length > 0) {
    const cur = stack[stack.length - 1];
    const candidates = dirs.filter((d) => {
      const nx = cur.x + DELTA[d].dx, ny = cur.y + DELTA[d].dy;
      return inBounds(maze, nx, ny) && !visited[index(maze, nx, ny)];
    });
    if (candidates.length === 0) {
      stack.pop();
      continue;
    }
    const d = candidates[Math.floor(rand() * candidates.length)];
    removeWall(maze, cur.x, cur.y, d);
    const next = { x: cur.x + DELTA[d].dx, y: cur.y + DELTA[d].dy };
    visited[index(maze, next.x, next.y)] = 1;
    stack.push(next);
  }

  if (braid > 0) braidMaze(maze, braid, rand);
  return maze;
}

/** Open a wall in some dead ends so the maze contains loops. */
function braidMaze(maze: Maze, fraction: number, rand: () => number): void {
  const dirs: Direction[] = ["up", "down", "left", "right"];
  for (let y = 0; y < maze.height; y++) {
    for (let x = 0; x < maze.width; x++) {
      const open = dirs.filter((d) => canMove(maze, x, y, d));
      if (open.length !== 1) continue;
      if (rand() >= fraction) continue;
      const closed = dirs.filter((d) => {
        const nx = x + DELTA[d].dx, ny = y + DELTA[d].dy;
        return hasWall(maze, x, y, d) && inBounds(maze, nx, ny);
      });
      if (closed.length === 0) continue;
      removeWall(maze, x, y, closed[Math.floor(rand() * closed.length)]);
    }
  }
}

/** Breadth-first shortest path from start to exit, as a list of cells including both ends. */
export function shortestPath(maze: Maze): Point[] {
  const n = maze.width * maze.height;
  const prev = new Int32Array(n).fill(-1);
  const seen = new Uint8Array(n);
  const startIdx = index(maze, maze.start.x, maze.start.y);
  const exitIdx = index(maze, maze.exit.x, maze.exit.y);
  const queue = [startIdx];
  seen[startIdx] = 1;
  const dirs: Direction[] = ["up", "down", "left", "right"];
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head];
    if (cur === exitIdx) break;
    const x = cur % maze.width, y = Math.floor(cur / maze.width);
    for (const d of dirs) {
      if (!canMove(maze, x, y, d)) continue;
      const ni = index(maze, x + DELTA[d].dx, y + DELTA[d].dy);
      if (seen[ni]) continue;
      seen[ni] = 1;
      prev[ni] = cur;
      queue.push(ni);
    }
  }
  if (!seen[exitIdx]) return [];
  const path: Point[] = [];
  for (let i = exitIdx; i !== -1; i = prev[i]) {
    path.push({ x: i % maze.width, y: Math.floor(i / maze.width) });
  }
  return path.reverse();
}

/** Count how many cells can be stepped through in a direction before a wall. */
export function visibleCells(
  maze: Maze,
  x: number,
  y: number,
  dir: Direction,
): number {
  let count = 0;
  let cx = x, cy = y;
  while (canMove(maze, cx, cy, dir)) {
    cx += DELTA[dir].dx;
    cy += DELTA[dir].dy;
    count++;
  }
  return count;
}
