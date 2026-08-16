# Lumixa

> プロジェクトを理解し、問題を予測・調査・修正まで支援する、AI-native なデスクトップ IDE。
> An AI-native desktop IDE that understands your project and helps predict, investigate, and fix problems — powered by your local Claude Code CLI.

<div align="center">

**🇯🇵 日本語 | [🇺🇸 English](#english)**

</div>

---

<div align="center">

## ⬇️ ダウンロード / Download

### [**Windows インストーラー (.exe) — v1.0.0**](https://github.com/zononagi/lumixa/releases/download/v1.0.0/Lumixa-Setup-1.0.0.exe)

[すべてのリリース / All releases →](https://github.com/zononagi/lumixa/releases)

<sub>未署名ビルドのため Windows SmartScreen の警告が出る場合があります → 「詳細情報」→「実行」。<br/>Unsigned build — if SmartScreen warns, click **More info → Run anyway**.</sub>

</div>

---

# 日本語

## Lumixa とは

**Lumixa** は、高速でモダンなデスクトップ **コードエディタ / IDE** であり、v1.0.0 で **Autonomous Development Engine（自律開発エンジン）** を搭載しました。

単なる「AI に質問できる IDE」ではありません。Lumixa は **プロジェクト全体を常時理解**し、変更の影響を予測し、問題を検出・調査し、修正・テスト・検証まで一貫して支援します。実作業の頭脳には、お使いの環境に **すでにインストール・認証済みの Claude Code CLI** をそのまま利用します。

```
従来の IDE                     Lumixa
User → コードを書く             User → 「何を作りたい / 直したい」
     → ビルド → エラー               → Lumixa がプロジェクトを理解
     → 自分で調査                     → 影響を予測・問題を検出
     → 自分で修正                     → AI が実装・テスト・自動修正
                                       → 検証 → あなたがレビュー
```

---

## 設計思想（正直さの原則）

Lumixa の各機能は、以下の原則を徹底しています。

- **静的解析ファースト** — Project Brain、影響分析、コード監視、カバレッジなどは静的解析で動作し、**Claude Code が無くても機能します**（Graceful Degradation）。AI は「説明・調査・実装・修正」など判断が要る作業でのみ呼び出します。
- **認証を持たない** — Lumixa は Claude の認証情報（OAuth トークン・Cookie・API キー）を**一切取得・保存しません**。認証はすべて Claude Code CLI に委ねます。
- **でっち上げない** — 使用率やバグの確信度など、根拠のない数値を Lumixa が捏造しません。AI の推論は明確に「AI の分析」として提示し、進捗は**実際のコード・テスト状態から算出**します（AI の自己申告に依存しません）。
- **秘密情報を守る** — `.env` / `*.pem` / `*.key` / secret・credential・token 等はインデックスから内容を読まず、AI コンテキストへ渡しません。
- **安全策** — 破壊的コマンドは実行前に確認。危険な変更（認証 / DB / 決済 / マイグレーション等）は警告し、スナップショットで取り消し可能に。

---

## 基本機能

| 分野 | 内容 |
| --- | --- |
| 📝 **エディタ** | Monaco ベース（シンタックスハイライト・診断・フォーマット）、タブ、マルチカーソル、Ghost Text 補完、Ctrl/Cmd+S 保存 |
| 🗂 **ワークスペース** | フォルダを開く、ツリー表示エクスプローラー |
| 💻 **ターミナル** | PowerShell / CMD / Git Bash / WSL / bash / zsh、危険コマンドは確認ダイアログ |
| 📦 **Git** | Status / Stage / Commit / Push / Pull / Branch / Checkout / Merge / Rebase / Stash / History / Blame |
| 🧩 **Code Builder** | 変数・関数・コンポーネント等の雛形をフォームから生成 |
| 🛟 **Safe Mode** | プロジェクトのスナップショット作成・復元（Git の代替ではない安全網） |
| 🎨 **外観** | ダーク / ライト、VS Code テーマのインポート、半透明 UI、Windows 11 Mica / Acrylic、背景画像・動画 |
| ⌨️ **操作** | コマンドパレット（Ctrl/Cmd+Shift+P）、キーボード主体の操作 |
| 🌐 **多言語 UI** | 日本語 / English / 한국어 |

---

## 🤖 Claude Code ネイティブチャットパネル

お使いの **Claude Code CLI** を、ターミナルを意識せず GUI から操作できます。

- リアルタイムのストリーミング表示、ツール実行の可視化、変更ファイル一覧
- **コンテキスト添付**：現在のファイル / 選択範囲 / ワークスペース / Problems / Git 差分 / プロジェクト知識（`+ Context`・`@メンション`）
- **クイックアクション**：Explain / Fix / Refactor / Optimize / Add Tests / Generate Docs / Find Bug / Review Code
- エディタ右クリック「Ask Claude Code」、Problems から「Fix with Claude Code」
- **インライン Diff**：AI の変更を Monaco Diff で確認し、Keep / Revert
- セッション管理（作成・リネーム・切替）、バックグラウンド継続と完了通知
- ショートカット：Ctrl/Cmd+Shift+L 開閉、Ctrl/Cmd+Enter 送信、Esc 停止

---

## 🧠 Autonomous Development Engine

プロジェクトを理解・予測・検出・調査・修正・保守まで支援する、13 のサブシステム。

| サブシステム | 説明 |
| --- | --- |
| 🧠 **Project Brain** | ワークスペースを索引し、依存グラフ・スタック概要・統計を構築。差分更新で大規模でも高速（並列索引）。 |
| 🎯 **Change Impact Radar** | 変更が壊す可能性のある範囲（直接／間接・影響テスト）を検出し、0–100 のリスクスコアと根拠を提示。 |
| 👁 **AI Code Watcher** | 常時の静的検査（debugger 残り・空 catch・ハードコード秘密・緩い等価比較・any 等）を確信度付きで表示。低信頼は既定で非表示。 |
| 🐞 **Bug Detective** | バグを自然言語で説明 → Lumixa が証拠（Git 履歴・作業差分・Problems・関連ファイル）を収集し、Claude Code が「仮説 / 根拠 / 確信度 / 再現」に分けて調査。 |
| 🩺 **Self-Healing Engine** | typecheck / test / build / lint を実行 → 失敗を Claude Code が修正 → 再検証、を最大 3 回まで。事前スナップショットで取り消し可能。 |
| 🧪 **Test Guardian** | 依存グラフから未テストファイルと影響テストを特定。ワンクリックでテスト生成、テスト実行。 |
| ⌛ **Git Time Machine** | 「なぜこのコードがある？」を blame → 導入コミット → 履歴 → PR/Issue 参照から調査し、Claude Code が理由と削除リスクを説明。 |
| 🗺 **Architecture Map** | 依存グラフをインタラクティブに可視化。ノードクリックで移動・再中心化、エッジで「なぜ繋がるか」。 |
| 🎯 **Goal Mode** | 抽象目標をチェック可能なタスクに分解。**進捗は実際のコード・テスト状態から算出**（AI の自己申告ではない）。各タスクを Claude Code へ。 |
| 📓 **Skill Memory** | プロジェクト固有ルールを**出典・確信度付き**で記憶。自動検出＋ユーザールール。AI コンテキストへ供給。 |
| ⚠ **Risk Detector** | 重要領域（認証 / DB / 決済 / マイグレーション / 秘密 / インフラ / デプロイ）を分類し、未コミットの危険変更を警告＋推奨手順。 |
| 🎓 **Beginner Assistant** | コマンドをやさしく解説（＋安全判定・実行）、エラーを平易に翻訳（module-not-found はワンクリックで依存導入）。 |
| 📡 **AI Activity Center** | 全サブシステム＋Claude Code の活動をリアルタイム表示＋タイムスタンプ付き監査ログ。 |

---

## ✨ Project Creation Engine（New Project）

「何を作りたいか」を自然言語で説明するだけで、実際に動くプロジェクトを生成し、そのままエンジンに接続します。

1. **記述** — 例：「プレイリスト・検索・ダークモード付きの React 音楽プレイヤー」
2. **計画** — テンプレート推薦（Web=React+TS+Vite / バックエンド=Node+TS）＋機能チェックリスト＋プロジェクト名を自動提案
3. **生成** — `npm run dev/build` できる実プロジェクトを生成（package.json / tsconfig / vite / src / README）。**空でないフォルダには書き込まない安全設計**
4. **接続** — 生成後に自動で開いて **Project Brain が索引**、説明を **Goal Mode に種まき**
5. **次の一歩** — 依存導入 / Claude Code で実装 / Goal を開く / Self-Healing 検証（すべて明示的な操作）

起動：コマンドパレット「New Project…」または起動画面のボタン。

---

## 📊 使用状況モニター（Usage Monitor）

- Claude Code が公式に出力するリセット時刻を表示（5 時間 / 週間）
- 使用**率**は公式に非公開のため、推測せず「Unavailable」と正直に表示（**独自計算値を公式使用量として表示しません**）
- 公式使用量と明確に分けた「Lumixa Activity」（セッション / メッセージ / ツール呼出 / 変更ファイル / 稼働時間）

---

## 対応 OS

- **Windows** — インストーラー配布（NSIS）
- **macOS / Linux** — ソースからのビルドは可能（設定あり）。配布バイナリは現在 Windows のみ。

---

## 開発（ソースからビルド）

前提：Node.js 18+ と npm。AI 機能を使う場合は **Claude Code CLI** のインストール・ログインが必要（任意）。

```bash
npm install        # 依存をインストール
npm run dev        # 開発モードで起動（electron-vite）
npm run typecheck  # 型チェック（node + web）
npm test           # テスト（vitest, 189 件）
npm run build      # 本番ビルド
npm run dist:win   # Windows インストーラーを生成（dist/Lumixa-Setup-<version>.exe）
```

技術スタック：Electron + electron-vite / React 19 / TypeScript / Zustand / Monaco Editor / xterm.js / Vitest。

---

## ロードマップ

**v1.0.0（完了）**
- [x] エディタ / タブ / エクスプローラー / ターミナル（複数シェル）/ Problems
- [x] Git（Merge / Rebase / Stash / History / Blame）
- [x] 外観（テーマ / Mica / Acrylic / 背景）/ 補完 / Quick Fix / コマンドパレット
- [x] Claude Code ネイティブチャットパネル（コンテキスト / クイックアクション / @メンション / Diff）
- [x] Autonomous Development Engine（13 サブシステム）
- [x] Project Creation Engine（自然言語からのプロジェクト生成）
- [x] 使用状況モニター / 習熟度モード / 初心者支援
- [x] 日本語 / English / 한국어

**今後**
- [ ] テンプレート追加、生成時の install/実装の自動連鎖
- [ ] Import / Migration エンジン、テンプレートマーケットプレイス
- [ ] インストーラーのコード署名
- [ ] デバッガ統合（DAP）/ Git グラフ可視化 / Call Hierarchy

---

## ライセンス

MIT License — © Nagisa Dozono

---

# English

## About

**Lumixa** is a fast, modern desktop **code editor / IDE**. As of v1.0.0 it ships a full **Autonomous Development Engine**.

It is not just "an IDE you can ask AI questions". Lumixa **continuously understands your whole project**, predicts the impact of changes, detects and investigates problems, and helps all the way through fixing, testing, and verification. The heavy lifting is done by the **Claude Code CLI you already have installed and signed in**.

```
Traditional IDE                Lumixa
User → write code              User → "what to build / fix"
     → build → error                → Lumixa understands the project
     → investigate yourself         → predicts impact, detects issues
     → fix yourself                 → AI implements, tests, self-heals
                                     → verifies → you review
```

---

## Design principles (honesty first)

- **Static-analysis first** — Project Brain, impact analysis, the code watcher, coverage, etc. run on static analysis and **work without Claude Code** (graceful degradation). AI is only invoked for judgment work: explaining, investigating, implementing, fixing.
- **Holds no credentials** — Lumixa never obtains or stores Claude credentials (OAuth tokens, cookies, API keys). Authentication is delegated entirely to the Claude Code CLI.
- **Never fabricates** — no made-up numbers for usage or bug confidence. AI reasoning is clearly labeled as AI analysis, and progress is **computed from your real code and test state** (never an AI self-report).
- **Protects secrets** — `.env` / `*.pem` / `*.key` / secret·credential·token files are never read into the index or sent to the AI.
- **Safety rails** — destructive commands are confirmed first; risky changes (auth / DB / payments / migrations …) are flagged and made revertible with snapshots.

---

## Core features

| Area | Details |
| --- | --- |
| 📝 **Editor** | Monaco-based (highlighting, diagnostics, formatting), tabs, multi-cursor, Ghost Text completion, Ctrl/Cmd+S to save |
| 🗂 **Workspace** | Open folder, tree-view explorer |
| 💻 **Terminal** | PowerShell / CMD / Git Bash / WSL / bash / zsh, confirmation for dangerous commands |
| 📦 **Git** | Status / Stage / Commit / Push / Pull / Branch / Checkout / Merge / Rebase / Stash / History / Blame |
| 🧩 **Code Builder** | Generate boilerplate (variables, functions, components…) from a form |
| 🛟 **Safe Mode** | Create/restore project snapshots (a safety net, not a Git replacement) |
| 🎨 **Appearance** | Dark / light, VS Code theme import, translucent UI, Windows 11 Mica / Acrylic, background image/video |
| ⌨️ **Interaction** | Command palette (Ctrl/Cmd+Shift+P), keyboard-first |
| 🌐 **Localized UI** | Japanese / English / Korean |

---

## 🤖 Claude Code native chat panel

Drive your **Claude Code CLI** from the GUI — no terminal required.

- Real-time streaming, tool-call visualization, changed-files list
- **Context attachments**: current file / selection / workspace / Problems / Git diff / project knowledge (`+ Context`, `@mentions`)
- **Quick actions**: Explain / Fix / Refactor / Optimize / Add Tests / Generate Docs / Find Bug / Review Code
- Editor right-click "Ask Claude Code", and "Fix with Claude Code" from Problems
- **Inline diffs**: review AI changes in a Monaco diff editor, then Keep / Revert
- Session management (create, rename, switch), background continuation with completion toasts
- Shortcuts: Ctrl/Cmd+Shift+L toggle, Ctrl/Cmd+Enter send, Esc stop

---

## 🧠 Autonomous Development Engine

Thirteen subsystems that help you understand, predict, detect, investigate, fix, and maintain.

| Subsystem | What it does |
| --- | --- |
| 🧠 **Project Brain** | Indexes the workspace into a dependency graph, stack summary, and stats. Incremental + parallel — fast on large projects. |
| 🎯 **Change Impact Radar** | Finds what a change could break (direct/indirect + affected tests) with a 0–100 risk score and reasons. |
| 👁 **AI Code Watcher** | Always-on static checks (leftover debugger, empty catch, hard-coded secrets, loose equality, `any`…) with confidence; low-confidence hidden by default. |
| 🐞 **Bug Detective** | Describe a bug → Lumixa gathers evidence (git history, working diff, Problems, related files) and Claude Code investigates as Hypotheses / Evidence / Confidence / Reproduction. |
| 🩺 **Self-Healing Engine** | Run typecheck / test / build / lint → Claude Code fixes failures → re-verify, up to 3 attempts. Pre-run snapshot makes it revertible. |
| 🧪 **Test Guardian** | Uses the dependency graph to find untested files + tests affected by a change; one-click test generation and test runs. |
| ⌛ **Git Time Machine** | "Why does this code exist?" from blame → introducing commit → history → PR/issue refs; Claude Code explains purpose and removal risk. |
| 🗺 **Architecture Map** | Interactive dependency visualization; click a node to open/re-center, hover an edge for "why connected". |
| 🎯 **Goal Mode** | Breaks an abstract goal into checkable tasks; **progress is measured from real code & tests** (not an AI self-report). Hand any task to Claude Code. |
| 📓 **Skill Memory** | Remembers project rules **with source + confidence**. Auto-derived facts + your own rules, fed to the AI as context. |
| ⚠ **Risk Detector** | Classifies critical areas (auth / DB / payments / migrations / secrets / infra / deploy) and warns about risky uncommitted changes with recommended safeguards. |
| 🎓 **Beginner Assistant** | Plain-language command help (with safety + run) and error translation (one-click dependency install for module-not-found). |
| 📡 **AI Activity Center** | Live view of what every subsystem + Claude Code is doing, plus a timestamped audit log. |

---

## ✨ Project Creation Engine (New Project)

Describe what you want in plain language and Lumixa scaffolds a real, runnable project and wires it into the engine.

1. **Describe** — e.g. "A React music player with a playlist, search and dark mode"
2. **Plan** — recommended template (web = React+TS+Vite / backend = Node+TS) + feature checklist + a suggested project name
3. **Generate** — a real project you can `npm run dev/build` (package.json / tsconfig / vite / src / README). **Refuses to write into a non-empty folder.**
4. **Wire up** — opens the project so **Project Brain indexes it**, and seeds **Goal Mode** from the description
5. **Next steps** — Install dependencies / Implement with Claude Code / Open Goal Mode / Self-Healing verify (all explicit actions)

Launch from the command palette ("New Project…") or the welcome screen button.

---

## 📊 Usage Monitor

- Shows the reset times Claude Code officially emits (5-hour / weekly)
- Usage **percentages** aren't officially exposed, so it honestly shows "Unavailable" instead of guessing (**never presents a self-computed value as official usage**)
- A clearly separate "Lumixa Activity" (sessions / messages / tool calls / files modified / runtime)

---

## Supported platforms

- **Windows** — installer (NSIS) provided
- **macOS / Linux** — buildable from source (configs included); prebuilt binaries are Windows-only for now.

---

## Develop (build from source)

Requirements: Node.js 18+ and npm. For AI features, install and sign in to the **Claude Code CLI** (optional).

```bash
npm install        # install dependencies
npm run dev        # start in dev mode (electron-vite)
npm run typecheck  # type-check (node + web)
npm test           # tests (vitest, 189 tests)
npm run build      # production build
npm run dist:win   # build the Windows installer (dist/Lumixa-Setup-<version>.exe)
```

Stack: Electron + electron-vite / React 19 / TypeScript / Zustand / Monaco Editor / xterm.js / Vitest.

---

## Roadmap

**v1.0.0 (done)**
- [x] Editor / tabs / explorer / terminal (multiple shells) / Problems
- [x] Git (Merge / Rebase / Stash / History / Blame)
- [x] Appearance (themes / Mica / Acrylic / background) / completion / Quick Fix / command palette
- [x] Claude Code native chat panel (context / quick actions / @mentions / diffs)
- [x] Autonomous Development Engine (13 subsystems)
- [x] Project Creation Engine (create projects from natural language)
- [x] Usage Monitor / experience modes / beginner support
- [x] Japanese / English / Korean

**Future**
- [ ] More templates; auto-run the install/implement chain during creation
- [ ] Import / Migration engine; template marketplace
- [ ] Code signing for the installer
- [ ] Integrated debugger (DAP) / Git graph visualization / Call Hierarchy

---

## License

MIT License — © Nagisa Dozono

---

<div align="center">

**Code at the speed of thought.**

</div>
