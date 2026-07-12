// 화면 표시 직전 텍스트 정리 유틸.
//  - [출처: ...] 표기 제거
//  - *(원문 보완)* 같은 마크다운 주석 제거
//  - **굵게** / *기울임* 강조 기호 제거(내용은 유지)
//  - 중복 공백 정리
export const cleanText = (text) =>
  (text ?? '')
    .replace(/\s*\[출처:[^\]]*\]/g, '')
    .replace(/\s*\*\([^)]*\)\*/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()

// 블록명 앞 "1. " 같은 번호 접두어 제거 (아이용·미션 카드 제목).
export const stripNum = (text) =>
  (text ?? '').replace(/^\s*\d+\.\s*/, '').trim()

// 지원하는 사건 포맷인지. 지금은 성인(adult) 구조만 화면이 지원한다.
// 그 외(예: child_emotion — 감정 폭발축 td101~111)는 안전장치 안내를 띄운다.
export const isSupportedFormat = (json) => json?.format === 'adult'
