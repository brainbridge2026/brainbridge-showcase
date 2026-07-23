// [C-25 정정] 회고 흐름(깊은 회고 = 얕은 회고 + 중간 감정 조절 텀) 순수 로직.
//  ★ 얕은 회고(settling)는 축약 결과 경로가 아니다. 깊은 회고와 동일한 질문·부재자 확인·결과 흐름을
//    쓰되, 사실 질문(내 표현·아이 반응) 뒤에 '감정 조절 텀(pause)'을 한 번 끼운다.
//    감정 조절 텀 이후에는 깊은 회고의 첫 미응답 질문으로 합류한다.
//  ★ ConflictScreen(깊은 회고)이 이 순서를 소비한다. 별도 결과 파이프라인 없음.

// 깊은 회고 정본 순서(calm) — 부재자 분기(spousePresence) 이전까지의 선형 구간.
//  (분기 이후 spouseAction/spouseFeeling · share/shareReason/coaching은 ConflictScreen이 그대로 처리.)
export const CALM_ORDER = [
  'reason',
  'feeling',
  'expression',
  'childReaction',
  'childSpeech',
  'spousePresence',
]

// settling 최초 진입 순서 — 사실 질문(내 표현·아이 반응) 먼저 → 감정 조절 텀(pause) → 나머지 깊은 회고.
export const SETTLING_ORDER = [
  'expression',
  'childReaction',
  'pause',
  'reason',
  'feeling',
  'childSpeech',
  'spousePresence',
]

// 이미 답한(seed된) 스텝 판정 — 얕은 회고에서 넘어온 내 표현·아이 반응 등.
//  깊은 회고와 동일한 회고 필드로 저장되므로 같은 필드명으로 판정한다(중복 질문 방지).
export function seededSteps(initial = {}) {
  return {
    reason: (initial?.reason?.immediate ?? null) !== null,
    feeling: (initial?.emotions?.length ?? 0) > 0 && (initial?.intensity ?? null) !== null,
    expression: (initial?.expressions?.length ?? 0) > 0,
    childReaction: (initial?.childReactions?.length ?? 0) > 0,
    // [D-3] 데이터 계약 완전화 — childSpeech·spousePresent 필드 편입(값이 비어도 필드는 존재).
    //  감정 조절 텀(pause)은 childReaction 직후라, seededSteps가 소비되는 시점(settling 진입/재개)엔
    //  이 두 값이 '항상 빈 값'이다 → 두 값은 false로 계산되어 buildRetroSequence 회귀 없음
    //  (childSpeech 스텝·spousePresence 스텝 모두 그대로 유지). 계약상 필드만 완전하게 채운다.
    childSpeech: (initial?.childSpeech?.length ?? 0) > 0,
    spousePresent: (initial?.spousePresent ?? null) !== null,
  }
}

// 표시할 스텝 순서를 만든다.
//  - settling 최초 진입(seed 없음) → 사실 먼저 + pause 포함.
//  - settling 재개/이어서(seed 있음) or calm → 깊은 회고 순서에서 이미 답한 스텝만 건너뜀.
//    (seed된 사실 스텝은 다시 묻지 않고, 감정 조절 텀도 재노출하지 않는다.)
export function buildRetroSequence(mode, initial = {}) {
  const seeded = seededSteps(initial)
  const resumed = seeded.expression || seeded.childReaction
  const base = mode === 'settling' && !resumed ? SETTLING_ORDER : CALM_ORDER
  // seed된 사실 스텝(reason/feeling/expression/childReaction)만 제거.
  //  pause·spousePresence 스텝은 seeded 키와 이름이 달라 항상 유지되고,
  //  childSpeech는 seeded 키에 있으나 소비 시점 값이 항상 false라 역시 항상 유지된다(D-3).
  return base.filter((s) => !seeded[s])
}

// 시퀀스 상 다음/이전 스텝(선형 구간). 끝이면 null(다음=분기, 이전=화면 이탈).
export function retroNext(sequence, cur) {
  const i = sequence.indexOf(cur)
  return i >= 0 && i < sequence.length - 1 ? sequence[i + 1] : null
}
export function retroPrev(sequence, cur) {
  const i = sequence.indexOf(cur)
  return i > 0 ? sequence[i - 1] : null
}
