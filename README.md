# Jev Maze

TypeSafe の System One モデル [Jev](https://docs.typesafe.ai/)
に、周囲の情報だけを与えて 2D 迷路を解かせるシミュレーションです。
ブラウザ上に迷路を表示し、Jev が上下左右のどちらに進むかを 1
手ずつ判断させ、出口に辿り着くまでのステップ数や API
呼び出し回数を観察できます。

## 仕組み

- 迷路は recursive backtracker
  で生成します（シードで再現可能、ループ率で行き止まりを開けられます）。
- 1 手ごとにブラウザが `POST /api/decide` を呼び、サーバーが Jev の Choice
  質問（`up` / `down` / `left` / `right`
  のうち通れる方向だけを選択肢にする）を投げます。
- Jev
  に渡すのは現在マスの周囲の情報だけです。壁の有無は常に渡し、見通し距離・隣接マスの訪問回数・直前の移動方向・現在マスの訪問回数・ステップ数・出口の方角は
  UI で ON/OFF できます。
- 通れる方向が 1 つしかない場合は Jev
  に聞かずに進みます（統計の「一本道で自動移動」）。
- API キーはサーバー側でのみ使い、ブラウザには渡しません。
- UI
  は日本語と英語に対応しています。ブラウザの言語設定（`navigator.languages`）で日本語が優先なら日本語、それ以外は英語になり、ヘッダーのセレクタで切り替えると
  localStorage に保存されます。文言は `src/i18n.ts` にまとめています。

## 開発

```sh
export JEV_KEY=...      # TypeSafe の API キー（TYPESAFE_API_KEY でも可）
deno task build         # static/ のコピー、Tailwind + basecoat の CSS、deno bundle で dist/ を生成
deno task start         # http://localhost:8000
deno task dev           # ビルドしてから --watch で起動
deno task test
deno task check
```

## Deno Deploy

- エントリポイント: `main.ts`
- ビルドコマンド: `deno task build`（`dist/`
  はコミットしていないので、デプロイ時にビルドが必要です）
- 環境変数: `JEV_KEY`

## 構成

| パス                | 内容                                                |
| ------------------- | --------------------------------------------------- |
| `main.ts`           | Deno.serve。`dist/` の静的配信と `/api/decide`      |
| `server/jev.ts`     | Jev（`@typesafe-ai/sdk`）の呼び出しと質問の組み立て |
| `shared/types.ts`   | サーバーとブラウザで共有する型                      |
| `src/maze.ts`       | 迷路生成、最短経路（BFS）、見通し距離               |
| `src/sim.ts`        | シミュレーションの状態遷移と観測の生成              |
| `src/render.ts`     | Canvas 描画                                         |
| `src/main.ts`       | UI                                                  |
| `static/index.html` | ページ本体（Tailwind + basecoat）                   |
