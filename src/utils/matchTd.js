import catalog from '../data/tdCatalog.json'
import situationToTd from '../data/situationToTd.json'

// 모든 td를 평평하게 편다 → { num, title, format }
const ALL_TDS = catalog.categories.flatMap((c) => c.items)

// _note 등 밑줄 접두 키는 매핑이 아니므로 제외.
const SITUATION_MAP = Object.fromEntries(
  Object.entries(situationToTd).filter(([k]) => !k.startsWith('_')),
)

// ────────────────────────────────────────────────────────────────────────
// matchTdToInput(answers, opts) — 충돌입력 답변을 받아 가장 잘 맞는 td를 고른다.
//
// ⚠️ 오늘(임시) 구현: "상황 답변 텍스트 ↔ td title 키워드 겹침"의 아주 단순한 매칭.
//    정교한 AI가 아니다. 실제 구조는 "AI 자동매칭으로 초안 생성 → 대표 검토 후 발송"이며,
//    나중에 이 함수 "내부"만 진짜 AI 매칭(phase5_pipeline)으로 교체할 예정이다.
//    ⛳ 교체 시에도 시그니처 matchTdToInput(answers) 와 반환 형태
//       ({ num, title, format, score }) 는 그대로 유지할 것.
//
// 【포맷 필터】 화면/입력 축에 맞는 format 후보군 안에서만 매칭한다.
//    성인 상황축 입력(현재 유일하게 구현된 흐름)은 format='adult'만 후보로 삼아,
//    감정폭발축(child_emotion, td101~111)이 후보에 아예 들어가지 않게 한다.
//    (예전엔 전 111개에서 골라 '숙제·공부' → td108(child_emotion)로 잘못 매칭되어
//     결과화면 포맷 게이트에서 "준비 중"으로 빠지던 문제를 원천 차단.)
//    opts.format 기본값 'adult'. 감정폭발축 전용 입력이 생기면 그때 넘겨 재사용.
//    ※ isSupportedFormat 게이트/감정폭발축 미구현 상태는 설계대로 그대로 둔다.
//
// 【매칭 순서】 (1) situationToTd 명시 매핑 우선 → (2) 없으면 키워드 점수 →
//    (3) 매핑도 없고 점수도 0이면 임의 td 폴백 금지, unmatched(num=null) 반환 → 화면은 UnsupportedNotice.
//    상황축은 소재별. 확장 시 (1)situation.options 배열에 추가
//      (2)situationToTd에 매핑 추가 (3)콘텐츠 없으면 집필 먼저(C-35 참조).
//      임의 td 폴백 금지 — 매칭 없으면 UnsupportedNotice로.
//    반환: 매칭 { num, title, format, score, matchedBy } / 미매칭 { num: null, unmatched: true, score: 0 }.
// ────────────────────────────────────────────────────────────────────────
export function matchTdToInput(answers, { format = 'adult' } = {}) {
  // 매칭 후보를 현재 축의 포맷으로 먼저 제한한다.
  const pool = ALL_TDS.filter((td) => td.format === format)

  // (1) 명시적 상황축 매핑 우선 — 라벨이 매핑에 있으면 그 td로 확정.
  const scene = answers?.scene
  if (scene && SITUATION_MAP[scene] != null) {
    const mapped = pool.find((td) => td.num === SITUATION_MAP[scene])
    if (mapped) return { ...mapped, score: Infinity, matchedBy: 'situationToTd' }
  }

  // (2) 매핑에 없으면 키워드 점수 매칭 (fallback 매처)
  const text = [scene, answers?.note].filter(Boolean).join(' ')
  // 토큰화: 가운뎃점·공백·기호로 분리, 2글자 이상만
  const tokens = text
    .split(/[·\s,/()★]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2)

  let best = null
  for (const td of pool) {
    const title = td.title ?? ''
    const score = tokens.reduce((n, tk) => (title.includes(tk) ? n + 1 : n), 0)
    if (!best || score > best.score) best = { ...td, score }
  }
  if (best && best.score > 0) return { ...best, matchedBy: 'keyword' }

  // (3) 매핑도 없고 점수도 0 → td1 강제 폴백 금지. 미매칭 신호를 반환(§4: 자산 없음 → 화면 생략).
  return { num: null, title: null, format: null, score: 0, unmatched: true }
}
