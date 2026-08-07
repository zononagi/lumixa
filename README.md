# Lumixa

> The AI-native IDE for modern software development.

<div align="center">

**🇯🇵 日本語 | [🇺🇸 English](#english)**

</div>

---

<div align="center">

## ⬇️ ダウンロード / Download

### [**Windows インストーラー (.exe) — v0.1.0**](https://github.com/7g3n/lumixa/releases/download/v0.1.0/Lumixa-Setup-0.1.0.exe)

[すべてのリリース / All releases →](https://github.com/7g3n/lumixa/releases)

<sub>未署名ビルドのため Windows SmartScreen の警告が出る場合があります → 「詳細情報」→「実行」。<br/>Unsigned build — if SmartScreen warns, click **More info → Run anyway**.</sub>

</div>

---

# 日本語

## Lumixaとは

**Lumixa** は、AIとの共同開発を前提として設計された次世代のAIネイティブIDEです。

Cursorライクな操作性をベースにしながら、複数AIモデル・エージェント・プロジェクトメモリ・高度なコード編集を統合し、開発者がより高速かつ直感的にソフトウェアを開発できる環境を提供します。

---

## 特徴

### 🤖 AI First（APIキー）

- Claude（Anthropic API）
- OpenAI（GPT）

<sub>各プロバイダのAPIキーを設定に入力して利用します。キーはOSのキーチェーン（DPAPI / Keychain）で暗号化され、端末外に出ません。<br/>※ Claude/ChatGPT の「サブスク・アカウント連携」は Anthropic 側の制限（2026年1月〜、公式アプリ以外をブロック）により現在利用できません。</sub>

---

### 💬 AIチャット

- プロジェクト全体を理解
- コンテキスト保持
- ストリーミング応答
- プロジェクトメモリ
- コードブロックの syntax ハイライト

---

### 🧠 AI Agent

- 複数エージェント
- カスタムSystem Prompt
- 権限管理
- バックグラウンド実行

---

### ✨ Cursorライクな編集体験

- Composer
- Inline Edit
- AI Diff
- Ghost Preview
- One Click Fix

---

### 🎨 カスタマイズ

- VSCodeテーマ互換
- 半透明UI
- Mica
- Acrylic
- Background Cover風背景
- 背景動画対応

---

### 💻 ターミナル

- PowerShell
- CMD
- Git Bash
- WSL
- Bash
- zsh

AIによるコマンド実行・エラー解析をサポートします。

---

### 📦 Git

- Commit
- Push
- Pull
- Branch
- Rebase
- Merge

AIによるレビュー・コミットメッセージ生成に対応。

---

## 対応OS

- Windows
- macOS

---

## ロードマップ

- [x] MVP
- [x] Composer / Inline Edit
- [x] APIキー認証（Claude / OpenAI・暗号化保存）
- [ ] アカウント連携（OAuth）— Anthropicの制限により保留
- [x] AI Agent（複数エージェント・カスタムSystem Prompt・権限管理・バックグラウンド実行）
- [x] Cursorライク編集（AI Diff / Ghost Preview / One Click Fix）
- [x] Project Memory
- [x] UI カスタマイズ（Mica / Acrylic / 背景画像・動画 / VSCodeテーマ互換）
- [x] Git（Commit / Push / Pull / Branch / Merge / Rebase）
- [x] syntax ハイライト
- [ ] MCP
- [ ] Plugin SDK
- [ ] Cloud Sync

---

## ライセンス

現在開発中です。

---

# English

## About

**Lumixa** is an AI-native IDE built for modern software development.

Inspired by Cursor, Lumixa combines multiple AI providers, intelligent agents, project memory, and an extensible development environment into a single workspace.

Our goal is to make AI a true development partner—not just a chatbot.

---

## Features

### 🤖 AI First (API keys)

- Claude (Anthropic API)
- OpenAI (GPT)

<sub>Enter each provider's API key in Settings. Keys are encrypted with your OS keychain (DPAPI / Keychain) and never leave this machine.<br/>Note: Claude/ChatGPT subscription "account linking" is currently unavailable due to Anthropic's server-side restriction (since Jan 2026) blocking non-official apps.</sub>

---

### 💬 AI Chat

- Full project awareness
- Streaming responses
- Context memory
- Project memory
- Syntax-highlighted code blocks

---

### 🧠 AI Agents

- Multiple agents
- Custom system prompts
- Permission management
- Background execution

---

### ✨ Cursor-like Editing

- Composer
- Inline Edit
- AI-powered Diff
- Ghost Preview
- One Click Fix

---

### 🎨 Customization

- VSCode themes
- Acrylic
- Mica
- Transparent UI
- Background images
- Video backgrounds

---

### 💻 Integrated Terminal

Supports

- PowerShell
- CMD
- Git Bash
- WSL
- Bash
- zsh

AI can execute commands, analyze logs, and help resolve errors.

---

### 📦 Git Integration

- Commit
- Push
- Pull
- Branch
- Merge
- Rebase

AI-assisted commit messages and code reviews.

---

## Supported Platforms

- Windows
- macOS

---

## Roadmap

- [x] MVP
- [x] Composer / Inline Edit
- [x] API-key auth (Claude / OpenAI, encrypted at rest)
- [ ] Account linking (OAuth) — on hold due to Anthropic restriction
- [x] AI Agents (multiple agents, custom system prompts, permissions, background execution)
- [x] Cursor-like editing (AI Diff / Ghost Preview / One Click Fix)
- [x] Project Memory
- [x] UI customization (Mica / Acrylic / background image·video / VS Code themes)
- [x] Git (Commit / Push / Pull / Branch / Merge / Rebase)
- [x] Syntax highlighting
- [ ] MCP Support
- [ ] Plugin SDK
- [ ] Cloud Sync

---

## License

Currently under development.

---

<div align="center">

Made with ❤️ by the Lumixa Team

**Code at the speed of thought.**

</div>
