import { DEFAULT_INSTRUCTIONS } from "../shared/types.ts";
import {
  applyStatic,
  getSetting,
  type Key,
  type LangSetting,
  resolve,
  saveSetting,
  setLang,
  t,
} from "./i18n.ts";
import { generateMaze, type Maze, type Point, shortestPath } from "./maze.ts";
import { randomSeed } from "./prng.ts";
import { probabilityBars, render } from "./render.ts";
import {
  createSim,
  type InfoOptions,
  type SimOptions,
  type SimState,
  step,
} from "./sim.ts";

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing element #${id}`);
  return el as T;
};

const ui = {
  width: $<HTMLSelectElement>("width"),
  height: $<HTMLSelectElement>("height"),
  seed: $<HTMLInputElement>("seed"),
  randomSeed: $<HTMLButtonElement>("randomSeed"),
  braid: $<HTMLInputElement>("braid"),
  braidValue: $<HTMLSpanElement>("braidValue"),
  newMaze: $<HTMLButtonElement>("newMaze"),
  instructions: $<HTMLTextAreaElement>("instructions"),
  model: $<HTMLInputElement>("model"),
  delay: $<HTMLInputElement>("delay"),
  delayValue: $<HTMLSpanElement>("delayValue"),
  maxSteps: $<HTMLInputElement>("maxSteps"),
  showPath: $<HTMLInputElement>("showPath"),
  run: $<HTMLButtonElement>("run"),
  stepBtn: $<HTMLButtonElement>("stepBtn"),
  reset: $<HTMLButtonElement>("reset"),
  status: $<HTMLSpanElement>("status"),
  errorBox: $<HTMLDivElement>("errorBox"),
  errorText: $<HTMLDivElement>("errorText"),
  canvas: $<HTMLCanvasElement>("maze"),
  stats: $<HTMLDListElement>("stats"),
  decisionMeta: $<HTMLParagraphElement>("decisionMeta"),
  probs: $<HTMLDivElement>("probs"),
  historyBody: $<HTMLTableSectionElement>("historyBody"),
  lang: $<HTMLSelectElement>("lang"),
};

const INFO_KEYS: (keyof InfoOptions)[] = [
  "visibleCells",
  "visits",
  "lastMove",
  "currentVisits",
  "stepsTaken",
  "exitHint",
];
const SIZES = [5, 6, 8, 10, 12, 15, 20, 25, 30, 40];

interface RunSummary {
  n: number;
  maze: string;
  braid: number;
  info: string;
  status: SimState["status"];
  steps: number;
  shortest: number;
  apiCalls: number;
  avgLatency: number;
  elapsedMs: number;
}

let maze: Maze;
let sim: SimState;
let path: Point[] = [];
let running = false;
let abort: AbortController | null = null;
const runs: RunSummary[] = [];

function readInfo(): InfoOptions {
  const info = {} as InfoOptions;
  for (const k of INFO_KEYS) info[k] = $<HTMLInputElement>(`info-${k}`).checked;
  return info;
}

function readSimOptions(): SimOptions {
  return {
    info: readInfo(),
    instructions: ui.instructions.value,
    model: ui.model.value,
    maxSteps: Math.max(1, Number(ui.maxSteps.value) || 1000),
  };
}

function infoLabel(info: InfoOptions): string {
  const on = INFO_KEYS.filter((k) => info[k]).map((k) =>
    t(`infoShort.${k}` as Key)
  );
  return on.length ? on.join(t("infoShort.separator")) : t("infoShort.none");
}

function setupSelects(): void {
  for (const sel of [ui.width, ui.height]) {
    sel.replaceChildren();
    for (const s of SIZES) {
      const o = document.createElement("option");
      o.value = String(s);
      o.textContent = String(s);
      sel.appendChild(o);
    }
    sel.value = "10";
  }
  ui.seed.value = String(randomSeed());
  ui.instructions.value = DEFAULT_INSTRUCTIONS;
}

function buildMaze(): void {
  const seed = Number(ui.seed.value) || 0;
  maze = generateMaze({
    width: Number(ui.width.value),
    height: Number(ui.height.value),
    seed,
    braid: Number(ui.braid.value) / 100,
  });
  path = shortestPath(maze);
  resetSim();
}

function resetSim(): void {
  stopLoop();
  sim = createSim(maze);
  hideError();
  update();
}

function stopLoop(): void {
  running = false;
  abort?.abort();
  abort = null;
  if (sim && sim.status === "running") sim.status = "paused";
}

function statusLabel(status: SimState["status"]): string {
  return t(`status.${status}` as Key);
}

function fmtMs(ms: number): string {
  return ms >= 10_000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`;
}

function update(): void {
  render(ui.canvas, sim, {
    showShortestPath: ui.showPath.checked,
    shortestPath: path,
  });

  ui.status.textContent = statusLabel(sim.status);
  ui.status.dataset.variant = sim.status === "solved"
    ? "primary"
    : sim.status === "error" || sim.status === "gave_up"
    ? "destructive"
    : sim.status === "running"
    ? "secondary"
    : "outline";

  const finished = sim.status === "solved" || sim.status === "gave_up" ||
    sim.status === "error";
  ui.run.textContent = running
    ? t("run.pause")
    : sim.steps > 0 && !finished
    ? t("run.resume")
    : t("run.start");
  ui.run.disabled = finished;
  ui.stepBtn.disabled = running || finished;
  for (
    const el of [
      ui.width,
      ui.height,
      ui.seed,
      ui.braid,
      ui.newMaze,
      ui.randomSeed,
    ]
  ) {
    (el as HTMLInputElement).disabled = running;
  }

  const shortest = Math.max(0, path.length - 1);
  const avgLatency = sim.apiCalls ? sim.totalLatencyMs / sim.apiCalls : 0;
  const rows: [string, string][] = [
    [
      t("stats.maze"),
      t("stats.mazeValue", {
        width: maze.width,
        height: maze.height,
        seed: maze.seed,
      }),
    ],
    [t("stats.steps"), String(sim.steps)],
    [t("stats.shortest"), String(shortest)],
    [t("stats.ratio"), sim.steps ? (sim.steps / shortest).toFixed(2) : "-"],
    [t("stats.apiCalls"), String(sim.apiCalls)],
    [t("stats.forced"), String(sim.forcedMoves)],
    [t("stats.latency"), sim.apiCalls ? fmtMs(avgLatency) : "-"],
    [t("stats.elapsed"), sim.startedAt !== null ? fmtMs(sim.elapsedMs) : "-"],
    [
      t("stats.tokens"),
      t("stats.tokensValue", {
        input: sim.inputTokens,
        output: sim.outputTokens,
      }),
    ],
  ];

  ui.stats.replaceChildren();
  for (const [k, v] of rows) {
    const dt = document.createElement("dt");
    dt.className = "text-muted-foreground";
    dt.textContent = k;
    const dd = document.createElement("dd");
    dd.className = "tabular-nums";
    dd.textContent = v;
    ui.stats.append(dt, dd);
  }

  const last = sim.history[sim.history.length - 1];
  if (!last) {
    ui.decisionMeta.textContent = t("decision.none");
    probabilityBars(ui.probs, null, null, []);
  } else if (last.forced) {
    ui.decisionMeta.textContent = t("decision.forced", {
      step: last.step,
      dir: dirLabel(last.direction),
    });
    probabilityBars(ui.probs, null, last.direction, [last.direction]);
  } else if (last.decision) {
    const d = last.decision;
    ui.decisionMeta.textContent = t("decision.chosen", {
      step: last.step,
      dir: dirLabel(d.choice),
      confidence: (d.confidence * 100).toFixed(0),
      latency: d.latency_ms,
      model: d.model,
    });
    probabilityBars(
      ui.probs,
      d.probabilities,
      d.choice,
      Object.keys(d.probabilities),
    );
  }

  if (sim.status === "error" && sim.error) showError(sim.error);
}

function dirLabel(d: string): string {
  return t(`dir.${d}` as Key);
}

function showError(msg: string): void {
  ui.errorText.textContent = msg;
  ui.errorBox.classList.remove("hidden");
}

function hideError(): void {
  ui.errorBox.classList.add("hidden");
}

function recordRun(): void {
  const shortest = Math.max(0, path.length - 1);
  runs.push({
    n: runs.length + 1,
    maze: `${maze.width}×${maze.height} #${maze.seed}`,
    braid: maze.braid,
    info: infoLabel(readInfo()),
    status: sim.status,
    steps: sim.steps,
    shortest,
    apiCalls: sim.apiCalls,
    avgLatency: sim.apiCalls ? sim.totalLatencyMs / sim.apiCalls : 0,
    elapsedMs: sim.elapsedMs,
  });
  renderHistory();
}

function renderHistory(): void {
  ui.historyBody.replaceChildren();
  for (const r of [...runs].reverse()) {
    const tr = document.createElement("tr");
    const cells = [
      String(r.n),
      r.maze,
      `${Math.round(r.braid * 100)}%`,
      r.info,
      statusLabel(r.status),
      String(r.steps),
      String(r.shortest),
      r.shortest ? (r.steps / r.shortest).toFixed(2) : "-",
      String(r.apiCalls),
      r.apiCalls ? fmtMs(r.avgLatency) : "-",
      fmtMs(r.elapsedMs),
    ];
    cells.forEach((c, i) => {
      const td = document.createElement("td");
      td.textContent = c;
      if (i >= 5) td.className = "text-right tabular-nums";
      tr.appendChild(td);
    });
    ui.historyBody.appendChild(tr);
  }
}

async function doStep(signal: AbortSignal): Promise<void> {
  await step(sim, readSimOptions(), signal);
  if (signal.aborted) return;
  update();
  if (
    sim.status === "solved" || sim.status === "gave_up" ||
    sim.status === "error"
  ) {
    recordRun();
  }
}

async function loop(): Promise<void> {
  if (running) return;
  running = true;
  abort = new AbortController();
  const signal = abort.signal;
  sim.status = "running";
  update();
  while (running && sim.status === "running") {
    await doStep(signal);
    if (signal.aborted) return;
    const delay = Number(ui.delay.value);
    if (delay > 0) await new Promise((r) => setTimeout(r, delay));
  }
  running = false;
  abort = null;
  update();
}

function wire(): void {
  ui.newMaze.addEventListener("click", buildMaze);
  ui.randomSeed.addEventListener("click", () => {
    ui.seed.value = String(randomSeed());
    buildMaze();
  });
  for (const el of [ui.width, ui.height, ui.seed]) {
    el.addEventListener("change", buildMaze);
  }
  ui.braid.addEventListener("input", () => {
    ui.braidValue.textContent = `${ui.braid.value}%`;
  });
  ui.braid.addEventListener("change", buildMaze);
  ui.delay.addEventListener("input", () => {
    ui.delayValue.textContent = `${ui.delay.value}ms`;
  });
  ui.showPath.addEventListener("change", update);
  ui.run.addEventListener("click", () => {
    if (running) {
      stopLoop();
      update();
    } else {
      loop();
    }
  });
  ui.stepBtn.addEventListener("click", async () => {
    if (running) return;
    ui.stepBtn.disabled = true;
    const ac = new AbortController();
    abort = ac;
    if (sim.status === "idle" || sim.status === "paused") {
      sim.status = "running";
    }
    await doStep(ac.signal);
    if (sim.status === "running") sim.status = "paused";
    abort = null;
    update();
  });
  ui.reset.addEventListener("click", resetSim);
  globalThis.addEventListener("resize", update);
  ui.lang.addEventListener("change", () => {
    applyLang(ui.lang.value as LangSetting);
    saveSetting(ui.lang.value as LangSetting);
  });
}

function applyLang(setting: LangSetting): void {
  setLang(resolve(setting));
  ui.lang.value = setting;
  applyStatic();
  if (sim) {
    update();
    renderHistory();
  }
}

applyLang(getSetting());
setupSelects();
wire();
buildMaze();
