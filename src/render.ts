import { hasWall, type Point } from "./maze.ts";
import { type Key, t } from "./i18n.ts";
import type { SimState } from "./sim.ts";

export interface RenderOptions {
  showShortestPath: boolean;
  shortestPath: Point[];
}

/** Draw the maze, visit heatmap, trail, optional shortest path and the agent. */
export function render(
  canvas: HTMLCanvasElement,
  sim: SimState,
  opts: RenderOptions,
): void {
  const maze = sim.maze;
  const parent = canvas.parentElement;
  const availW = parent ? parent.clientWidth : 600;
  const maxH = Math.max(320, Math.min(720, globalThis.innerHeight - 200));
  const cell = Math.max(
    6,
    Math.floor(Math.min(availW / maze.width, maxH / maze.height)),
  );
  const pad = 2;
  const w = maze.width * cell + pad * 2;
  const h = maze.height * cell + pad * 2;
  const dpr = globalThis.devicePixelRatio || 1;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // The maze itself is drawn in white, black and grays only, independent of the theme.
  const bg = "#ffffff";
  const wallColor = "#000000";
  const trailColor = "#525252";
  const pathColor = "#a3a3a3";

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  const cx = (x: number) => pad + x * cell;
  const cy = (y: number) => pad + y * cell;

  // Visit heatmap: light gray for one visit, darker the more often a cell was visited.
  let maxVisits = 1;
  for (let i = 0; i < sim.visits.length; i++) {
    maxVisits = Math.max(maxVisits, sim.visits[i]);
  }
  for (let y = 0; y < maze.height; y++) {
    for (let x = 0; x < maze.width; x++) {
      const v = sim.visits[y * maze.width + x];
      if (v === 0) continue;
      const t = Math.min(1, v / Math.max(2, maxVisits));
      const gray = Math.round(232 - t * 80); // 232 (1 visit) .. 152 (most visited)
      ctx.fillStyle = `rgb(${gray}, ${gray}, ${gray})`;
      ctx.fillRect(cx(x), cy(y), cell, cell);
    }
  }

  // Exit cell: diagonal hatching so it stays recognisable at any cell size.
  {
    const x0 = cx(maze.exit.x), y0 = cy(maze.exit.y);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y0, cell, cell);
    ctx.clip();
    ctx.strokeStyle = "#737373";
    ctx.lineWidth = Math.max(1, cell * 0.08);
    ctx.beginPath();
    const gap = Math.max(3, cell / 4);
    for (let o = -cell; o < cell * 2; o += gap) {
      ctx.moveTo(x0 + o, y0 + cell);
      ctx.lineTo(x0 + o + cell, y0);
    }
    ctx.stroke();
    ctx.restore();
  }

  // Start cell: an "S" when there is room for it.
  if (cell >= 14) {
    ctx.fillStyle = "#737373";
    ctx.font = `bold ${Math.floor(cell * 0.5)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      "S",
      cx(maze.start.x) + cell / 2,
      cy(maze.start.y) + cell / 2 + 1,
    );
  }

  // Shortest path.
  if (opts.showShortestPath && opts.shortestPath.length > 1) {
    ctx.strokeStyle = pathColor;
    ctx.lineWidth = Math.max(1, cell * 0.1);
    ctx.lineJoin = "miter";
    ctx.lineCap = "butt";
    ctx.setLineDash([cell * 0.3, cell * 0.25]);
    ctx.beginPath();
    for (let i = 0; i < opts.shortestPath.length; i++) {
      const p = opts.shortestPath[i];
      const px = cx(p.x) + cell / 2, py = cy(p.y) + cell / 2;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Trail of the agent.
  if (sim.trail.length > 1) {
    ctx.strokeStyle = trailColor;
    ctx.lineWidth = Math.max(1, cell * 0.16);
    ctx.lineJoin = "miter";
    ctx.lineCap = "butt";
    ctx.beginPath();
    for (let i = 0; i < sim.trail.length; i++) {
      const p = sim.trail[i];
      const px = cx(p.x) + cell / 2, py = cy(p.y) + cell / 2;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  // Walls.
  ctx.strokeStyle = wallColor;
  ctx.lineWidth = Math.max(1.5, cell * 0.1);
  ctx.lineCap = "square";
  ctx.beginPath();
  for (let y = 0; y < maze.height; y++) {
    for (let x = 0; x < maze.width; x++) {
      const x0 = cx(x), y0 = cy(y), x1 = x0 + cell, y1 = y0 + cell;
      if (hasWall(maze, x, y, "up")) {
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y0);
      }
      if (hasWall(maze, x, y, "left")) {
        ctx.moveTo(x0, y0);
        ctx.lineTo(x0, y1);
      }
      if (x === maze.width - 1 && hasWall(maze, x, y, "right")) {
        ctx.moveTo(x1, y0);
        ctx.lineTo(x1, y1);
      }
      if (y === maze.height - 1 && hasWall(maze, x, y, "down")) {
        ctx.moveTo(x0, y1);
        ctx.lineTo(x1, y1);
      }
    }
  }
  ctx.stroke();

  // Agent: black disc with a white ring so it stands out on any gray.
  const ax = cx(sim.pos.x) + cell / 2, ay = cy(sim.pos.y) + cell / 2;
  ctx.fillStyle = "#000000";
  ctx.beginPath();
  ctx.arc(ax, ay, cell * 0.32, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = bg;
  ctx.lineWidth = Math.max(1, cell * 0.07);
  ctx.stroke();

  // Direction of the last move: a white dot inside the disc.
  if (sim.lastMove && cell >= 12) {
    const d =
      { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[sim.lastMove];
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(
      ax + d[0] * cell * 0.14,
      ay + d[1] * cell * 0.14,
      cell * 0.08,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
}

/** Draw a small visualisation of the probabilities of the last decision. */
export function probabilityBars(
  container: HTMLElement,
  probabilities: Partial<Record<string, number>> | null,
  chosen: string | null,
  options: string[],
): void {
  container.replaceChildren();
  for (const d of ["up", "down", "left", "right"]) {
    const row = document.createElement("div");
    row.className = "flex items-center gap-2 text-sm";
    const p = probabilities?.[d];
    const available = options.includes(d);
    const name = document.createElement("span");
    name.className = "w-12 shrink-0 " +
      (available ? "" : "text-muted-foreground");
    name.textContent = t(`dir.${d}` as Key);
    const bar = document.createElement("div");
    bar.className = "progress h-2 flex-1 rounded-full bg-muted";
    const fill = document.createElement("span");
    fill.className = "rounded-full " +
      (d === chosen ? "bg-orange-500" : "bg-primary/60");
    fill.style.width = `${Math.round((p ?? 0) * 100)}%`;
    bar.appendChild(fill);
    const val = document.createElement("span");
    val.className =
      "w-12 shrink-0 text-right tabular-nums text-muted-foreground";
    val.textContent = p === undefined
      ? (available ? "-" : t("decision.wall"))
      : `${(p * 100).toFixed(1)}%`;
    row.append(name, bar, val);
    container.appendChild(row);
  }
}
