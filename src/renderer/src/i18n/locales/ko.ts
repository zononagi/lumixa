import type { en } from './en'

/** 한국어 */
export const ko: typeof en = {
  'action.save': '저장',

  'ab.explorer': '탐색기',
  'ab.settings': '설정',
  'ab.composer': 'Composer — 다중 파일 AI 편집',
  'ab.terminal': '터미널 (Ctrl+`)',
  'ab.chat': 'AI 채팅',

  'explorer.title': '탐색기',
  'explorer.openFolder': '폴더 열기',
  'explorer.empty': '열린 폴더가 없습니다.',

  'status.noFolder': '폴더 없음',
  'status.unsaved': '● 저장 안 됨',
  'status.saved': '저장됨',
  'status.generating': '생성 중…',
  'status.noModel': '모델 없음',

  'editor.empty': '탐색기에서 파일을 열거나 AI 패널에서 시작하세요.',
  'editor.inlinePlaceholder': '선택 영역을 AI로 편집…',
  'editor.inlineEdit': '편집',
  'editor.applied': '✓ 적용됨',
  'editor.keep': '유지',
  'editor.undo': '실행 취소',

  'chat.title': 'AI 채팅',
  'chat.clear': '대화 지우기',
  'chat.emptyNoModel':
    '사용 가능한 모델이 없습니다. 설정(⚙)에서 제공자 API 키를 추가하세요.',
  'chat.empty': '코드에 대해 무엇이든 물어보세요. 응답이 실시간으로 표시됩니다.',
  'chat.you': '나',
  'chat.placeholderNoModel': '먼저 제공자를 설정하세요…',
  'chat.placeholder': 'Lumixa에 메시지…',
  'chat.noModels': '모델 없음',
  'chat.stop': '중지',
  'chat.send': '보내기',

  'settings.title': '설정',
  'settings.language': '언어',
  'settings.providers': '제공자',
  'settings.providersHint':
    '본인의 API 키를 사용합니다. 키는 OS 키체인(DPAPI / Keychain)으로 암호화되며 이 기기를 벗어나지 않습니다. 키가 없는 제공자는 모델 선택에 표시되지 않습니다.',
  'settings.comingSoon': '준비 중',
  'settings.configured': '✓ 설정됨',
  'settings.refresh': '↻ 모델 새로고침',
  'settings.refreshing': '새로고침 중…',
  'settings.modelsAvailable': '{n}개 모델 사용 가능.',
  'settings.noModels': '아직 모델이 없습니다 — 위에서 키를 추가한 후 새로고침하세요.',

  'composer.title': '✦ Composer',
  'composer.placeholder':
    '열린 파일 전반의 변경을 설명하세요… (예: "헤더에 다크 모드 토글 추가")',
  'composer.placeholderNoModel': '먼저 설정에서 제공자를 설정하세요.',
  'composer.context': '컨텍스트 내 {n}개 파일',
  'composer.generate': '편집 생성',
  'composer.generating': '생성 중…',
  'composer.noEdits': '모델이 파일 편집을 반환하지 않았습니다. 지시를 다시 표현해 보세요.',
  'composer.accept': '수락',
  'composer.reject': '거부',
  'composer.applied': '✓ 적용됨',
  'composer.apply': '수락한 변경 {n}건 적용',

  'terminal.title': '터미널',
  'terminal.close': '패널 닫기',
  'terminal.intro': 'Lumixa 터미널 — 실제 셸에서 명령을 실행합니다.',
  'terminal.dangerConfirm':
    '⚠️ 파괴적일 수 있는 명령:\n\n{cmd}\n\n이유: {reason}\n\n그래도 실행하시겠습니까?',
  'terminal.cancelled': '(취소됨)',

  'ab.git': '소스 제어',
  'git.title': '소스 제어',
  'git.noFolder': '소스 제어를 사용하려면 폴더를 여세요.',
  'git.noRepo': '이 폴더는 Git 저장소가 아닙니다.',
  'git.changes': '변경 사항',
  'git.stageAll': '모두 스테이지',
  'git.commitPlaceholder': '커밋 메시지',
  'git.commit': '커밋',
  'git.aiMessage': '✨ AI 메시지',
  'git.generating': '생성 중…',
  'git.push': '푸시',
  'git.pull': '풀',
  'git.refresh': '새로고침',
  'git.noStaged': '변경 사항을 스테이지한 후 커밋하세요.',
  'git.clean': '커밋할 변경 사항이 없습니다 — 작업 트리가 깨끗합니다.'
}
