# Lumixa

> A fast, modern desktop code editor / IDE.

<div align="center">

**🇯🇵 日本語 | [🇺🇸 English](#english)**

</div>

---

<div align="center">

## ⬇️ ダウンロード / Download

### [**Windows インストーラー (.exe) — v0.2.1 final beta**](https://github.com/zononagi/lumixa/releases/download/v0.2.1-final-beta/Lumixa-Setup-0.2.1-final-beta.exe)

[すべてのリリース / All releases →](https://github.com/zononagi/lumixa/releases)

<sub>未署名ビルドのため Windows SmartScreen の警告が出る場合があります → 「詳細情報」→「実行」。<br/>Unsigned build — if SmartScreen warns, click **More info → Run anyway**.</sub>

</div>

---

# 日本語

## Lumixaとは

**Lumixa** は、高速でモダンなデスクトップ **コードエディタ / IDE** です。

コア機能は AI に依存しません（Monaco エディタ・言語サービス・静的解析が土台）。そのうえで、お使いの環境に **すでにインストール・認証済みの Claude Code CLI** を、そのまま AI エージェントとして Lumixa から利用できます。**Lumixa 自身は Claude の認証情報（OAuth トークン・Cookie・API キー）を一切取得・保存しません** — 認証はすべて Claude Code に委ねる設計です。

---

## 特徴

### 📝 エディタ
- Monaco ベースの高機能エディタ（シンタックスハイライト・診断・フォーマット）
- タブ、マルチカーソル、Undo/Redo、コピー＆ペースト
- Ctrl/Cmd + S で保存

### 🗂 ファイル / ワークスペース
- フォルダを開く、ツリー表示のエクスプローラー

### 💻 ターミナル
- PowerShell / CMD / Git Bash / WSL / bash / zsh
- 危険なコマンドは実行前に確認ダイアログ

### 📦 Git
- Status / Stage / Commit / Push / Pull / Branch / Checkout / Merge / Rebase

### 🎨 外観
- ダーク / ライトテーマ、VS Code テーマのインポート
- 半透明 UI、Windows 11 の Mica / Acrylic、背景画像・動画

### 🤖 AI エージェント（任意 / ローカル Claude Code 連携）
- お使いの **Claude Code CLI** を Lumixa の GUI から操作（別ログイン不要・**Lumixa は認証情報を保持しません**）
- リアルタイムのストリーミング表示、ツール実行の可視化、変更ファイル→クリックでエディタに反映
- Provider 抽象化（将来 Codex / Gemini / Ollama などに拡張可能）

### 📊 使用状況モニター（Usage Monitor）
- Claude Code が公式に出力するリセット時刻を表示（5時間 / 週間）
- 使用**率**は公式に非公開のため、推測せず正直に「Unavailable」表示（**独自計算値を公式使用量として表示しません**）
- 公式使用量とは明確に分けた「Lumixa Activity」（セッション / メッセージ / ツール呼出 / 変更ファイル / 稼働時間）

### 🌐 多言語 UI
- 日本語 / English / 한국어

---

## 対応OS
- Windows
- macOS（実験的）

---

## ロードマップ
- [x] エディタ / タブ / エクスプローラー
- [x] ターミナル（複数シェル）＋ Problems パネル
- [x] Git（Merge / Rebase / Stash / History / Blame）
- [x] 外観カスタマイズ（テーマ / Mica / Acrylic / 背景）
- [x] コード補完エンジン（Ghost Text＋Monaco 型認識 IntelliSense）
- [x] Quick Fix / リファクタリング（Monaco 内蔵）＋ Command Palette
- [x] Project Intelligence（依存解析 / Project Health）
- [x] Learning Mode / Why?（静的解析ベースの説明）
- [x] AI エージェント（ローカル Claude Code 連携 / 認証は CLI に委譲）
- [x] 使用状況モニター（公式リセット時刻 + Lumixa Activity）
- [x] 習熟度モード（初心者 / 開発者 / エキスパート）＋「次にやること」ガイド
- [ ] 初心者支援の拡充（Project Wizard / Environment Doctor / Code Builder / Safe Mode …）
- [ ] デバッガ統合（DAP）
- [ ] Git グラフ可視化 / Call Hierarchy

---

## ライセンス
現在開発中です。

---

# English

## About

**Lumixa** is a fast, modern desktop **code editor / IDE**.

Its core does not depend on AI (built on the Monaco editor, language services, and static analysis). On top of that, it can drive the **Claude Code CLI you already have installed and signed in** as an AI agent, straight from Lumixa's GUI. **Lumixa never obtains or stores Claude credentials (OAuth tokens, cookies, API keys)** — authentication is delegated entirely to Claude Code.

---

## Features

### 📝 Editor
- Monaco-based editor (syntax highlighting, diagnostics, formatting)
- Tabs, multi-cursor, undo/redo, copy & paste
- Ctrl/Cmd + S to save

### 🗂 Files / Workspace
- Open folder, tree-view explorer

### 💻 Terminal
- PowerShell / CMD / Git Bash / WSL / bash / zsh
- Dangerous commands prompt for confirmation before running

### 📦 Git
- Status / Stage / Commit / Push / Pull / Branch / Checkout / Merge / Rebase

### 🎨 Appearance
- Dark / light themes, VS Code theme import
- Translucent UI, Windows 11 Mica / Acrylic, background image/video

### 🤖 AI Agent (optional / local Claude Code)
- Drive your installed **Claude Code CLI** from Lumixa's GUI (no separate login — **Lumixa holds no credentials**)
- Real-time streaming, tool-call visualization, file changes → click to open in the editor
- Provider abstraction (extensible to Codex / Gemini / Ollama in future)

### 📊 Usage Monitor
- Shows the reset times Claude Code officially emits (5-hour / weekly)
- Usage **percentages** are not officially exposed, so it honestly shows "Unavailable" instead of guessing (**never presents a self-computed value as official usage**)
- A clearly separate "Lumixa Activity" (sessions / messages / tool calls / files modified / runtime)

### 🌐 Localized UI
- Japanese / English / Korean

---

## Supported Platforms
- Windows
- macOS (experimental)

---

## Roadmap
- [x] Editor / tabs / explorer
- [x] Terminal (multiple shells) + Problems panel
- [x] Git (Merge / Rebase / Stash / History / Blame)
- [x] Appearance (themes / Mica / Acrylic / background)
- [x] Completion engine (Ghost Text + Monaco type-aware IntelliSense)
- [x] Quick Fix / refactoring (Monaco built-ins) + Command Palette
- [x] Project Intelligence (dependency analysis / Project Health)
- [x] Learning Mode / Why? (static-analysis explanations)
- [x] AI agent (local Claude Code integration / auth delegated to the CLI)
- [x] Usage Monitor (official reset times + Lumixa Activity)
- [x] Experience modes (Beginner / Developer / Expert) + "What's Next?" guidance
- [ ] Expanded beginner support (Project Wizard / Environment Doctor / Code Builder / Safe Mode …)
- [ ] Integrated debugger (DAP)
- [ ] Git graph visualization / Call Hierarchy

---

## License
Currently under development.

---

<div align="center">

**Code at the speed of thought.**

</div>
