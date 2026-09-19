/** Tiny i18n layer: two dictionaries, browser-preference detection, manual override. */

export type Lang = "ja" | "en";

const STORAGE_KEY = "jevmaze.lang";

const ja = {
  "header.desc":
    'TypeSafe の System One モデル <a class="underline" href="https://docs.typesafe.ai/" target="_blank" rel="noreferrer">Jev</a> に周囲の情報だけを与え、上下左右の判断を繰り返させて出口に辿り着くまでを観察します。',
  "lang.label": "言語",

  "run.title": "実行",
  "run.delay": "1手ごとの待ち時間",
  "run.maxSteps": "最大ステップ数",
  "run.showPath": "最短経路を表示",
  "run.start": "開始",
  "run.pause": "一時停止",
  "run.resume": "再開",
  "run.step": "1手",
  "run.reset": "リセット",

  "maze.title": "迷路",
  "maze.desc": "サイズとシードから迷路を生成します。",
  "maze.width": "幅",
  "maze.height": "高さ",
  "maze.seed": "シード",
  "maze.randomSeed": "ランダムなシード",
  "maze.braid": "ループ率",
  "maze.braidHelp":
    "行き止まりの壁を開けてループを作る割合。0% は一本道の完全迷路。",
  "maze.new": "新しい迷路を生成",

  "info.title": "Jev に与える情報",
  "info.desc": "4方向の壁の有無は常に渡します。追加の情報を選べます。",
  "info.visibleCells": "見通し距離（各方向で壁まで何マスか）",
  "info.visits": "隣接マスの訪問回数",
  "info.lastMove": "直前の移動方向",
  "info.currentVisits": "現在マスの訪問回数",
  "info.stepsTaken": "これまでのステップ数",
  "info.exitHint": "出口の方角（ヒント）",
  "info.instructions": "指示文（Choice の instructions）",
  "info.model": "モデル",
  "infoShort.visibleCells": "見通し",
  "infoShort.visits": "訪問",
  "infoShort.lastMove": "直前",
  "infoShort.currentVisits": "現在",
  "infoShort.stepsTaken": "歩数",
  "infoShort.exitHint": "方角",
  "infoShort.separator": "・",
  "infoShort.none": "壁のみ",

  "error.title": "エラー",
  "legend":
    "S: スタート、斜線: 出口、黒丸: Jev、白い点: 直前の移動方向、グレーの濃さ: 訪問回数、濃いグレーの線: 軌跡。",

  "status.idle": "待機中",
  "status.running": "実行中",
  "status.paused": "一時停止",
  "status.solved": "ゴール！",
  "status.gave_up": "上限到達",
  "status.error": "エラー",

  "stats.title": "統計",
  "stats.status": "状態",
  "stats.maze": "迷路",
  "stats.mazeValue": "{width} × {height}（シード {seed}）",
  "stats.steps": "ステップ数",
  "stats.shortest": "最短経路長",
  "stats.ratio": "比率",
  "stats.apiCalls": "Jev の判断回数",
  "stats.forced": "一本道で自動移動",
  "stats.latency": "平均レイテンシ",
  "stats.elapsed": "経過時間",
  "stats.tokens": "トークン",
  "stats.tokensValue": "{input} in / {output} out",

  "decision.title": "直近の判断",
  "decision.none": "まだ判断していません。",
  "decision.forced":
    "ステップ {step}: 一本道のため Jev に聞かずに「{dir}」へ移動",
  "decision.chosen":
    "ステップ {step}: 「{dir}」を選択（確信度 {confidence}%、{latency}ms、{model}）",
  "decision.wall": "壁",

  "dir.up": "上",
  "dir.down": "下",
  "dir.left": "左",
  "dir.right": "右",

  "history.title": "試行の履歴",
  "history.desc": "各試行の結果。比率 = ステップ数 ÷ 最短経路長。",
  "history.maze": "迷路",
  "history.braid": "ループ",
  "history.info": "情報",
  "history.result": "結果",
  "history.steps": "ステップ",
  "history.shortest": "最短",
  "history.ratio": "比率",
  "history.api": "API",
  "history.latency": "平均遅延",
  "history.time": "時間",
};

export type Key = keyof typeof ja;

const en: Record<Key, string> = {
  "header.desc":
    'Give <a class="underline" href="https://docs.typesafe.ai/" target="_blank" rel="noreferrer">Jev</a>, TypeSafe\'s System One model, nothing but its immediate surroundings, let it pick up/down/left/right one step at a time, and watch how long it takes to reach the exit.',
  "lang.label": "Language",

  "run.title": "Run",
  "run.delay": "Delay per move",
  "run.maxSteps": "Max steps",
  "run.showPath": "Show shortest path",
  "run.start": "Start",
  "run.pause": "Pause",
  "run.resume": "Resume",
  "run.step": "Step",
  "run.reset": "Reset",

  "maze.title": "Maze",
  "maze.desc": "Generated from the size and seed.",
  "maze.width": "Width",
  "maze.height": "Height",
  "maze.seed": "Seed",
  "maze.randomSeed": "Random seed",
  "maze.braid": "Loop rate",
  "maze.braidHelp":
    "Fraction of dead ends opened up to create loops. 0% is a perfect maze with a single route.",
  "maze.new": "Generate new maze",

  "info.title": "Information given to Jev",
  "info.desc":
    "Walls in the four directions are always included. Pick any extras.",
  "info.visibleCells": "Line of sight (cells until a wall, per direction)",
  "info.visits": "Visit count of adjacent cells",
  "info.lastMove": "Last move direction",
  "info.currentVisits": "Visit count of the current cell",
  "info.stepsTaken": "Steps taken so far",
  "info.exitHint": "Direction of the exit (hint)",
  "info.instructions": "Instructions (for the Choice question)",
  "info.model": "Model",
  "infoShort.visibleCells": "sight",
  "infoShort.visits": "visits",
  "infoShort.lastMove": "last",
  "infoShort.currentVisits": "current",
  "infoShort.stepsTaken": "steps",
  "infoShort.exitHint": "exit",
  "infoShort.separator": ", ",
  "infoShort.none": "walls only",

  "error.title": "Error",
  "legend":
    "S: start, hatched: exit, black disc: Jev, white dot: last move, gray shade: visit count, dark gray line: trail.",

  "status.idle": "Idle",
  "status.running": "Running",
  "status.paused": "Paused",
  "status.solved": "Solved!",
  "status.gave_up": "Step limit",
  "status.error": "Error",

  "stats.title": "Stats",
  "stats.status": "Status",
  "stats.maze": "Maze",
  "stats.mazeValue": "{width} × {height} (seed {seed})",
  "stats.steps": "Steps",
  "stats.shortest": "Shortest path",
  "stats.ratio": "Ratio",
  "stats.apiCalls": "Jev decisions",
  "stats.forced": "Forced moves (single route)",
  "stats.latency": "Avg latency",
  "stats.elapsed": "Elapsed",
  "stats.tokens": "Tokens",
  "stats.tokensValue": "{input} in / {output} out",

  "decision.title": "Last decision",
  "decision.none": "No decision yet.",
  "decision.forced":
    "Step {step}: only one way, moved {dir} without asking Jev",
  "decision.chosen":
    "Step {step}: chose {dir} (confidence {confidence}%, {latency}ms, {model})",
  "decision.wall": "wall",

  "dir.up": "up",
  "dir.down": "down",
  "dir.left": "left",
  "dir.right": "right",

  "history.title": "Run history",
  "history.desc": "One row per run. Ratio = steps ÷ shortest path length.",
  "history.maze": "Maze",
  "history.braid": "Loops",
  "history.info": "Info",
  "history.result": "Result",
  "history.steps": "Steps",
  "history.shortest": "Shortest",
  "history.ratio": "Ratio",
  "history.api": "API",
  "history.latency": "Avg latency",
  "history.time": "Time",
};

const dictionaries: Record<Lang, Record<Key, string>> = { ja, en };

let current: Lang = "en";

/** Pick a language from the browser's preference list: Japanese if it comes first, else English. */
export function detectLang(): Lang {
  const prefs = navigator.languages?.length
    ? navigator.languages
    : [navigator.language];
  for (const p of prefs) {
    const base = (p ?? "").toLowerCase().split("-")[0];
    if (base === "ja") return "ja";
    if (base === "en") return "en";
  }
  return "en";
}

/** The saved override, or the browser preference when nothing was chosen yet. */
export function initialLang(): Lang {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "ja" || v === "en") return v;
  } catch {
    // Storage may be unavailable; fall through to detection.
  }
  return detectLang();
}

export function saveLang(lang: Lang): void {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // Ignore storage failures; the choice still applies for this page load.
  }
}

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang): void {
  current = lang;
  document.documentElement.lang = lang;
}

/** Look up a string and substitute `{name}` placeholders. */
export function t(key: Key, params?: Record<string, string | number>): string {
  let s = dictionaries[current][key] ?? dictionaries.en[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      s = s.replaceAll(`{${k}}`, String(v));
    }
  }
  return s;
}

/** Fill every element carrying data-i18n / data-i18n-html / data-i18n-title. */
export function applyStatic(root: ParentNode = document): void {
  for (const el of root.querySelectorAll<HTMLElement>("[data-i18n]")) {
    el.textContent = t(el.dataset.i18n as Key);
  }
  for (const el of root.querySelectorAll<HTMLElement>("[data-i18n-html]")) {
    el.innerHTML = t(el.dataset.i18nHtml as Key);
  }
  for (const el of root.querySelectorAll<HTMLElement>("[data-i18n-title]")) {
    el.title = t(el.dataset.i18nTitle as Key);
  }
}
