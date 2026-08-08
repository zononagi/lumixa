import type { en } from './en'

/** 한국어 */
export const ko: typeof en = {
  'ab.explorer': '탐색기',
  'ab.settings': '설정',
  'ab.terminal': '터미널 (Ctrl+`)',
  'ab.git': '소스 제어',

  'explorer.title': '탐색기',
  'explorer.openFolder': '폴더 열기',
  'explorer.empty': '열린 폴더가 없습니다.',

  'status.noFolder': '폴더 없음',
  'status.unsaved': '● 저장 안 됨',
  'status.saved': '저장됨',

  'editor.empty': '탐색기에서 파일을 열어 시작하세요.',

  'settings.title': '설정',
  'settings.language': '언어',
  'settings.appearance': '모양',
  'settings.appearanceHint':
    '창 재질, 테마, 반투명, 배경 이미지/동영상을 설정합니다. VS Code 테마를 가져올 수 있습니다.',
  'settings.windowEffect': '창 효과',
  'settings.effectNone': '없음(불투명)',
  'settings.effectMica': 'Mica',
  'settings.effectAcrylic': 'Acrylic',
  'settings.winOnly': 'Mica / Acrylic은 Windows 11이 필요합니다.',
  'settings.theme': '테마',
  'settings.themeDark': '다크',
  'settings.themeLight': '라이트',
  'settings.importTheme': 'VS Code 테마 가져오기…',
  'settings.themeImported': '가져옴: {name}',
  'settings.uiOpacity': 'UI 불투명도',
  'settings.background': '배경',
  'settings.bgNone': '없음',
  'settings.bgImage': '이미지…',
  'settings.bgVideo': '동영상…',
  'settings.bgDim': '배경 어둡게',

  'terminal.title': '터미널',
  'terminal.close': '패널 닫기',
  'terminal.intro': 'Lumixa 터미널 — 실제 셸에서 명령을 실행합니다.',
  'terminal.dangerConfirm':
    '⚠️ 파괴적일 수 있는 명령:\n\n{cmd}\n\n이유: {reason}\n\n그래도 실행하시겠습니까?',
  'terminal.cancelled': '(취소됨)',

  'git.title': '소스 제어',
  'git.noFolder': '소스 제어를 사용하려면 폴더를 여세요.',
  'git.noRepo': '이 폴더는 Git 저장소가 아닙니다.',
  'git.changes': '변경 사항',
  'git.stageAll': '모두 스테이지',
  'git.commitPlaceholder': '커밋 메시지',
  'git.commit': '커밋',
  'git.push': '푸시',
  'git.pull': '풀',
  'git.refresh': '새로고침',
  'git.clean': '커밋할 변경 사항이 없습니다 — 작업 트리가 깨끗합니다.',
  'git.checkout': '체크아웃',
  'git.merge': '병합',
  'git.rebase': '리베이스',
  'git.continue': '계속',
  'git.abort': '중단',
  'git.noOtherBranches': '다른 브랜치 없음',
  'git.mergeInProgress': '⚠️ 병합 진행 중 — 충돌을 해결하고 스테이지한 후 계속하세요.',
  'git.rebaseInProgress': '⚠️ 리베이스 진행 중 — 충돌을 해결하고 스테이지한 후 계속하세요.'
}
