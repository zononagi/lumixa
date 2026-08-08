import type { en } from './en'

/** 日本語 */
export const ja: typeof en = {
  'ab.explorer': 'エクスプローラー',
  'ab.settings': '設定',
  'ab.terminal': 'ターミナル (Ctrl+`)',
  'ab.git': 'ソース管理',

  'explorer.title': 'エクスプローラー',
  'explorer.openFolder': 'フォルダを開く',
  'explorer.empty': 'フォルダが開かれていません。',

  'status.noFolder': 'フォルダ未選択',
  'status.unsaved': '● 未保存',
  'status.saved': '保存済み',

  'editor.empty': 'エクスプローラーからファイルを開いて始めましょう。',

  'settings.title': '設定',
  'settings.language': '言語',
  'settings.appearance': '外観',
  'settings.appearanceHint':
    'ウィンドウ素材、テーマ、半透明、背景画像/動画を設定します。VSCodeテーマもインポートできます。',
  'settings.windowEffect': 'ウィンドウ効果',
  'settings.effectNone': 'なし（不透明）',
  'settings.effectMica': 'Mica',
  'settings.effectAcrylic': 'Acrylic',
  'settings.winOnly': 'Mica / Acrylic は Windows 11 が必要です。',
  'settings.theme': 'テーマ',
  'settings.themeDark': 'ダーク',
  'settings.themeLight': 'ライト',
  'settings.importTheme': 'VSCodeテーマをインポート…',
  'settings.themeImported': 'インポート済み: {name}',
  'settings.uiOpacity': 'UIの不透明度',
  'settings.background': '背景',
  'settings.bgNone': 'なし',
  'settings.bgImage': '画像…',
  'settings.bgVideo': '動画…',
  'settings.bgDim': '背景の暗さ',

  'terminal.title': 'ターミナル',
  'terminal.close': 'パネルを閉じる',
  'terminal.intro': 'Lumixaターミナル — 実際のシェルでコマンドを実行します。',
  'terminal.dangerConfirm':
    '⚠️ 破壊的な可能性のあるコマンド：\n\n{cmd}\n\n理由: {reason}\n\n実行しますか？',
  'terminal.cancelled': '（キャンセルしました）',

  'git.title': 'ソース管理',
  'git.noFolder': 'ソース管理を使うにはフォルダを開いてください。',
  'git.noRepo': 'このフォルダは Git リポジトリではありません。',
  'git.changes': '変更',
  'git.stageAll': 'すべてステージ',
  'git.commitPlaceholder': 'コミットメッセージ',
  'git.commit': 'コミット',
  'git.push': 'プッシュ',
  'git.pull': 'プル',
  'git.refresh': '更新',
  'git.clean': 'コミットする変更はありません — 作業ツリーはクリーンです。',
  'git.checkout': 'チェックアウト',
  'git.merge': 'マージ',
  'git.rebase': 'リベース',
  'git.continue': '続行',
  'git.abort': '中止',
  'git.noOtherBranches': '他のブランチなし',
  'git.mergeInProgress': '⚠️ マージ中 — 競合を解決しステージして「続行」してください。',
  'git.rebaseInProgress': '⚠️ リベース中 — 競合を解決しステージして「続行」してください。'
}
