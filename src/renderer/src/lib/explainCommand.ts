/**
 * Terminal command explanation (spec §50). Pure, tested lookup that turns a
 * common shell command into a one-line plain-language explanation, so beginners
 * don't have to leave the IDE to understand what they're about to run. No AI.
 * Pairs with checkDanger() (lib/danger.ts) which handles the safety prompt (§49).
 */

interface Rule {
  re: RegExp
  ja: string
  en: string
}

const RULES: Rule[] = [
  { re: /^\s*npm\s+install\b/, ja: 'package.json に書かれた依存パッケージをインストールします。', en: 'Installs the dependencies listed in package.json.' },
  { re: /^\s*npm\s+(run\s+)?(dev|start)\b/, ja: '開発用サーバーを起動します。', en: 'Starts the development server.' },
  { re: /^\s*npm\s+run\s+build\b/, ja: 'プロジェクトを本番用にビルドします。', en: 'Builds the project for production.' },
  { re: /^\s*npm\s+(run\s+)?test\b/, ja: 'テストを実行します。', en: 'Runs the tests.' },
  { re: /^\s*npm\s+ci\b/, ja: 'ロックファイル通りに依存を厳密にインストールします。', en: 'Installs dependencies exactly per the lockfile.' },
  { re: /^\s*(pnpm|yarn)\s+(install|i)\b/, ja: '依存パッケージをインストールします。', en: 'Installs the dependencies.' },
  { re: /^\s*git\s+status\b/, ja: '変更されたファイルの状態を表示します。', en: 'Shows which files have changed.' },
  { re: /^\s*git\s+add\b/, ja: '変更をコミット対象（ステージ）に追加します。', en: 'Stages changes for the next commit.' },
  { re: /^\s*git\s+commit\b/, ja: 'ステージした変更を履歴に保存します。', en: 'Saves the staged changes to history.' },
  { re: /^\s*git\s+push\b/, ja: 'ローカルのコミットをリモートに送ります。', en: 'Sends your local commits to the remote.' },
  { re: /^\s*git\s+pull\b/, ja: 'リモートの変更を取得して取り込みます。', en: 'Fetches and merges remote changes.' },
  { re: /^\s*git\s+clone\b/, ja: 'リモートのリポジトリを複製します。', en: 'Copies a remote repository locally.' },
  { re: /^\s*git\s+reset\s+--hard\b/, ja: '⚠ 変更を破棄して指定状態に戻します（元に戻せません）。', en: '⚠ Discards changes and resets to a state (not recoverable).' },
  { re: /^\s*cd\b/, ja: '作業ディレクトリを移動します。', en: 'Changes the working directory.' },
  { re: /^\s*ls\b|^\s*dir\b/, ja: 'ディレクトリの中身を一覧表示します。', en: 'Lists the contents of a directory.' },
  { re: /^\s*mkdir\b/, ja: '新しいフォルダを作成します。', en: 'Creates a new folder.' },
  { re: /^\s*rm\s+-[a-z]*r/, ja: '⚠ フォルダとその中身を削除します（元に戻せません）。', en: '⚠ Deletes a folder and its contents (not recoverable).' },
  { re: /^\s*rm\b|^\s*del\b/, ja: 'ファイルを削除します。', en: 'Deletes a file.' },
  { re: /^\s*node\b/, ja: 'Node.js で JavaScript ファイルを実行します。', en: 'Runs a JavaScript file with Node.js.' },
  { re: /^\s*python[3]?\b/, ja: 'Python でスクリプトを実行します。', en: 'Runs a script with Python.' },
  { re: /^\s*npx\b/, ja: 'パッケージのコマンドを（未インストールでも）実行します。', en: 'Runs a package binary, downloading it if needed.' }
]

export function explainCommand(command: string, locale: 'ja' | 'en'): string | undefined {
  const cmd = command.trim()
  if (!cmd) return undefined
  for (const r of RULES) if (r.re.test(cmd)) return locale === 'ja' ? r.ja : r.en
  return undefined
}
