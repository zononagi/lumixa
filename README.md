# Lumixa

An AI-native IDE — Cursor-like operability with a VS Code-familiar feel, built to be extended.

> **Status: Phase 0 + 1 complete.** A working desktop app: open a folder, edit
> files in Monaco, and chat with Claude (streaming) using your own API key.

## Run

```bash
npm install
npm run dev      # launches Electron with HMR
```

Other scripts:

```bash
npm run build      # bundle main + preload + renderer into out/
npm run start      # preview the built app
npm run typecheck  # type-check both node and web sides
```

## First-time setup

1. Launch the app.
2. Open **Settings** (⚙ in the activity bar) and paste your **Anthropic API key**.
   Keys are encrypted with the OS keychain (Windows DPAPI / macOS Keychain) and
   never leave your machine.
3. Click **↻ Refresh models** — only reachable models appear.
4. Open **AI Chat** (✨) and start talking to your code.

## Architecture

```
src/
  main/            Electron main process (Node). Owns disk, secrets, AI networking.
    ai/            Provider abstraction (IProvider) + anthropic adapter + registry.
    services/      fs (workspace), secrets (encrypted key storage).
    ipc.ts         Typed IPC handler registration.
    index.ts       Window creation + entry.
  preload/         contextBridge — the only surface the renderer can touch.
  shared/          IPC contract (channel names + types), shared by both sides.
  renderer/src/    React UI.
    shell/         ActivityBar, StatusBar, layout.
    features/      editor (Monaco) / explorer / chat / settings.
    stores/        Zustand state, decoupled from UI.
```

**Design principles**

- **UI ↔ logic separation.** `core`/state is UI-independent; `main` is Electron-only.
- **Provider abstraction.** New LLM backends (OpenAI, Gemini, OpenRouter, Ollama)
  are a single adapter file implementing `AIProvider` — nothing else changes.
- **Security first.** API keys live only in the main process; the renderer learns
  only *whether* a provider is configured, never the value. Streaming runs in main
  to avoid exposing keys or hitting CORS.

## App icon

Drop a PNG at `resources/icon.png` and it is picked up automatically at launch.

## Roadmap

| Phase | Scope |
|---|---|
| **0** ✅ | Electron + React + Monaco shell, Explorer, file open/save |
| **1** ✅ | Anthropic provider, streaming AI chat, encrypted key storage, model picker |
| 2 | xterm.js terminal, Composer (multi-file diff + accept/reject), Ctrl+K inline edit |
| 3 | Git GUI + AI commit messages, more providers, Project Memory |
| 4+ | RAG index, MCP, Agents, Cost Dashboard, AI Review, Ghost Mode, themes/backgrounds |

## Tech stack

Electron · React · TypeScript · Vite (electron-vite) · Monaco Editor · Zustand ·
`@anthropic-ai/sdk`
