import { assert, assertEquals } from "@std/assert";
import {
  canMove,
  generateMaze,
  shortestPath,
  visibleCells,
} from "../src/maze.ts";
import { createSim, observe } from "../src/sim.ts";

Deno.test("generated maze is fully connected and reproducible", () => {
  const a = generateMaze({ width: 15, height: 12, seed: 42 });
  const b = generateMaze({ width: 15, height: 12, seed: 42 });
  assertEquals(a.cells, b.cells);
  const path = shortestPath(a);
  assert(path.length > 1);
  assertEquals(path[0], a.start);
  assertEquals(path[path.length - 1], a.exit);
  // A perfect maze has exactly cells-1 open passages.
  let open = 0;
  for (let y = 0; y < a.height; y++) {
    for (let x = 0; x < a.width; x++) {
      if (canMove(a, x, y, "right")) open++;
      if (canMove(a, x, y, "down")) open++;
    }
  }
  assertEquals(open, a.width * a.height - 1);
});

Deno.test("braiding adds passages", () => {
  const perfect = generateMaze({ width: 20, height: 20, seed: 7 });
  const braided = generateMaze({ width: 20, height: 20, seed: 7, braid: 1 });
  const count = (m: typeof perfect) => {
    let n = 0;
    for (let y = 0; y < m.height; y++) {
      for (let x = 0; x < m.width; x++) {
        if (canMove(m, x, y, "right")) n++;
        if (canMove(m, x, y, "down")) n++;
      }
    }
    return n;
  };
  assert(count(braided) > count(perfect));
  assert(shortestPath(braided).length <= shortestPath(perfect).length);
});

Deno.test("observation only contains local information", () => {
  const maze = generateMaze({ width: 8, height: 8, seed: 1 });
  const sim = createSim(maze);
  const obs = observe(sim, {
    visibleCells: true,
    visits: true,
    lastMove: true,
    currentVisits: true,
    stepsTaken: false,
    exitHint: false,
  });
  assertEquals(obs.surroundings.up.passable, false);
  assertEquals(obs.surroundings.left.passable, false);
  assertEquals(obs.last_move, null);
  assertEquals(obs.current_cell_visits, 1);
  assertEquals(obs.exit_hint, undefined);
  assertEquals(obs.steps_taken, undefined);
  for (const d of ["down", "right"] as const) {
    if (obs.surroundings[d].passable) {
      assertEquals(
        obs.surroundings[d].visible_cells,
        visibleCells(maze, 0, 0, d),
      );
      assertEquals(obs.surroundings[d].visits, 0);
    }
  }
});
