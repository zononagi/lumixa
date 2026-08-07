/** English strings. This dictionary's shape is the source of truth for all locales. */
export const en = {
  'action.save': 'Save',

  'ab.explorer': 'Explorer',
  'ab.settings': 'Settings',
  'ab.composer': 'Composer — multi-file AI edits',
  'ab.terminal': 'Terminal (Ctrl+`)',
  'ab.chat': 'AI Chat',

  'explorer.title': 'Explorer',
  'explorer.openFolder': 'Open Folder',
  'explorer.empty': 'No folder is open.',

  'status.noFolder': 'No folder open',
  'status.unsaved': '● Unsaved',
  'status.saved': 'Saved',
  'status.generating': 'Generating…',
  'status.noModel': 'No model',

  'editor.empty': 'Open a file from the Explorer, or ask the AI panel to get started.',
  'editor.inlinePlaceholder': 'Edit the selection with AI…',
  'editor.inlineEdit': 'Edit',
  'editor.applied': '✓ Applied',
  'editor.keep': 'Keep',
  'editor.undo': 'Undo',

  'chat.title': 'AI Chat',
  'chat.clear': 'Clear conversation',
  'chat.emptyNoModel':
    'No models available. Add a provider API key in Settings (⚙) to start chatting.',
  'chat.empty': 'Ask anything about your code. Responses stream in live.',
  'chat.you': 'You',
  'chat.placeholderNoModel': 'Configure a provider first…',
  'chat.placeholder': 'Message Lumixa…',
  'chat.noModels': 'No models',
  'chat.stop': 'Stop',
  'chat.send': 'Send',

  'settings.title': 'Settings',
  'settings.language': 'Language',
  'settings.providers': 'Providers',
  'settings.providersHint':
    'Bring your own API key. Keys are encrypted with your OS keychain (DPAPI / Keychain) and never leave this machine. Providers without a key are hidden from the model picker.',
  'settings.comingSoon': 'coming soon',
  'settings.configured': '✓ configured',
  'settings.refresh': '↻ Refresh models',
  'settings.refreshing': 'Refreshing…',
  'settings.modelsAvailable': '{n} model(s) available.',
  'settings.noModels': 'No models yet — add a key above, then refresh.',

  'composer.title': '✦ Composer',
  'composer.placeholder':
    'Describe the change across your open files… (e.g. "add a dark-mode toggle to the header")',
  'composer.placeholderNoModel': 'Configure a provider in Settings first.',
  'composer.context': '{n} file(s) in context',
  'composer.generate': 'Generate edits',
  'composer.generating': 'Generating…',
  'composer.noEdits': 'The model returned no file edits. Try rephrasing the instruction.',
  'composer.accept': 'Accept',
  'composer.reject': 'Reject',
  'composer.applied': '✓ Applied',
  'composer.apply': 'Apply {n} accepted change(s)',

  'terminal.title': 'Terminal',
  'terminal.close': 'Close panel',
  'terminal.intro': 'Lumixa terminal — commands run in a real shell.',
  'terminal.dangerConfirm':
    '⚠️ Potentially destructive command:\n\n{cmd}\n\nReason: {reason}\n\nRun it anyway?',
  'terminal.cancelled': '(cancelled)',

  'ab.git': 'Source Control',
  'git.title': 'Source Control',
  'git.noFolder': 'Open a folder to use Source Control.',
  'git.noRepo': 'This folder is not a Git repository.',
  'git.changes': 'Changes',
  'git.stageAll': 'Stage all',
  'git.commitPlaceholder': 'Commit message',
  'git.commit': 'Commit',
  'git.aiMessage': '✨ AI message',
  'git.generating': 'Generating…',
  'git.push': 'Push',
  'git.pull': 'Pull',
  'git.refresh': 'Refresh',
  'git.noStaged': 'Stage changes, then commit.',
  'git.clean': 'Nothing to commit — working tree clean.'
}
