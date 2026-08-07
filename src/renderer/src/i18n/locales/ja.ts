import type { en } from './en'

/** 日本語 */
export const ja: typeof en = {
  'action.save': '保存',

  'ab.explorer': 'エクスプローラー',
  'ab.settings': '設定',
  'ab.composer': 'Composer — 複数ファイルAI編集',
  'ab.terminal': 'ターミナル (Ctrl+`)',
  'ab.chat': 'AIチャット',

  'explorer.title': 'エクスプローラー',
  'explorer.openFolder': 'フォルダを開く',
  'explorer.empty': 'フォルダが開かれていません。',

  'status.noFolder': 'フォルダ未選択',
  'status.unsaved': '● 未保存',
  'status.saved': '保存済み',
  'status.generating': '生成中…',
  'status.noModel': 'モデルなし',

  'editor.empty': 'エクスプローラーからファイルを開くか、AIパネルで始めましょう。',
  'editor.inlinePlaceholder': '選択範囲をAIで編集…',
  'editor.inlineEdit': '編集',
  'editor.applied': '✓ 適用済み',
  'editor.keep': '保持',
  'editor.undo': '元に戻す',

  'chat.title': 'AIチャット',
  'chat.clear': '会話をクリア',
  'chat.emptyNoModel':
    '利用可能なモデルがありません。設定(⚙)でプロバイダーのAPIキーを追加してください。',
  'chat.empty': 'コードについて何でも質問できます。応答はリアルタイムで表示されます。',
  'chat.you': 'あなた',
  'chat.placeholderNoModel': 'まずプロバイダーを設定してください…',
  'chat.placeholder': 'Lumixaにメッセージ…',
  'chat.noModels': 'モデルなし',
  'chat.stop': '停止',
  'chat.send': '送信',

  'settings.title': '設定',
  'settings.language': '言語',
  'settings.providers': 'プロバイダー',
  'settings.providersHint':
    '自分のAPIキーを使用します。キーはOSのキーチェーン（DPAPI / Keychain）で暗号化され、この端末から外に出ません。キー未設定のプロバイダーはモデル選択に表示されません。',
  'settings.comingSoon': '近日対応',
  'settings.configured': '✓ 設定済み',
  'settings.refresh': '↻ モデルを更新',
  'settings.refreshing': '更新中…',
  'settings.modelsAvailable': '{n} 個のモデルが利用可能。',
  'settings.noModels': 'モデルがありません — 上でキーを追加して更新してください。',

  'composer.title': '✦ Composer',
  'composer.placeholder':
    '開いているファイルへの変更を説明…（例：「ヘッダーにダークモード切替を追加」）',
  'composer.placeholderNoModel': 'まず設定でプロバイダーを設定してください。',
  'composer.context': 'コンテキスト内 {n} ファイル',
  'composer.generate': '編集を生成',
  'composer.generating': '生成中…',
  'composer.noEdits': 'ファイル編集が返されませんでした。指示を言い換えてください。',
  'composer.accept': '承認',
  'composer.reject': '却下',
  'composer.applied': '✓ 適用済み',
  'composer.apply': '{n} 件の変更を適用',

  'terminal.title': 'ターミナル',
  'terminal.close': 'パネルを閉じる',
  'terminal.intro': 'Lumixaターミナル — 実際のシェルでコマンドを実行します。',
  'terminal.dangerConfirm':
    '⚠️ 破壊的な可能性のあるコマンド：\n\n{cmd}\n\n理由: {reason}\n\n実行しますか？',
  'terminal.cancelled': '（キャンセルしました）',

  'ab.git': 'ソース管理',
  'git.title': 'ソース管理',
  'git.noFolder': 'ソース管理を使うにはフォルダを開いてください。',
  'git.noRepo': 'このフォルダは Git リポジトリではありません。',
  'git.changes': '変更',
  'git.stageAll': 'すべてステージ',
  'git.commitPlaceholder': 'コミットメッセージ',
  'git.commit': 'コミット',
  'git.aiMessage': '✨ AIで生成',
  'git.generating': '生成中…',
  'git.push': 'プッシュ',
  'git.pull': 'プル',
  'git.refresh': '更新',
  'git.noStaged': '変更をステージしてからコミットしてください。',
  'git.clean': 'コミットする変更はありません — 作業ツリーはクリーンです。'
}
