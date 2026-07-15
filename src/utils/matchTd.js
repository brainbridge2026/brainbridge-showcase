import catalog from '../data/tdCatalog.json'
import situationToTd from '../data/situationToTd.json'
import childTypeToAxis from '../data/childTypeToAxis.json'

// 모든 td를 평평하게 편다 → { num, title, format }
const ALL_TDS = catalog.categories.flatMap((c) => c.items)

// _note 등 밑줄 접두 키는 매핑이 아니므로 제외.
const SITUATION_MAP = Object.fromEntries(
  Object.entries(situationToTd).filter(([k]) => !k.startsWith('_')),
)
const CHILD_TYPE_TO_AXIS = Object.fromEntries(
  Object.entries(childTypeToAxis).filter(([k]) => !k.startsWith('_')),
)

// ⑦ 부모 확인·개입 축 가중 대상 (behaviorPool ③ parent typeKey). 확정 아님 — 점수만 가산.
const PARENT_WEIGHT_TYPES = ['자꾸 확인·점검했다', '내가 대신 해줬다', '여러 번 말했다']

// ────────────────────────────────────────────────────────────────────────
// matchTdToInput(answers, opts) — 충돌입력 답변을 받아 가장 잘 맞는 td를 고른다.
//
// C-10: 2신호(소재+패턴축) 매칭. 정식 파이프라인 교체 시 이 함수 내부만 교체.
//    ⚠️ 임시 구현이다(정교한 AI 아님). 실제 구조는 "AI 자동매칭으로 초안 생성 → 대표 검토 후 발송"이며,
//    나중에 이 함수 "내부"만 진짜 AI 매칭(phase5_pipeline)으로 교체할 예정이다.
//    ⛳ 교체 시에도 시그니처 matchTdToInput(answers) 와 반환 형태
//       ({ num, title, format, score, matchedBy }) / 미매칭({ num:null,...,unmatched:true }) 는 그대로 유지할 것.
//    호출부 2곳(App.jsx / ResultScreen.jsx)은 .num 만 쓰므로 반환 형태를 바꾸면 깨진다.
//
// 【2신호 매칭 구조】 (C-84 매핑 정본) — 장면은 "td 확정"이 아니라 "후보 pool 축소" 신호다.
//    (1) format 게이트로 pool 제한 (adult만 → td101~111 감정폭발축 원천 차단. 과거 '숙제→td108' 오매칭 방지).
//    (2) scene(소재축) → situationToTd[scene] 전체(모든 축 합집합)로 pool 축소. 매핑 없으면 축소 없이 진행.
//    (3) 패턴축 신호로 더 축소:
//        - answers.patternAxis 있으면 → situationToTd[scene][patternAxis]
//        - 없고 answers.childType 있으면 → childTypeToAxis[childType]가 준 축들의 td 합집합
//    (4) ⑦ 가중: parentType이 확인·개입류면 그 장면 축 "7" td에 점수 가산(확정 아님, pool에서 안 뺌).
//    (5) 축소된 pool 안에서 키워드 점수(scene·childText·parentText ↔ td title 겹침)로 최종 1개.
//        ★ 장면/축으로 pool이 축소됐으면(narrowed) 키워드 점수가 0이어도 최고점 후보를 반환한다
//          (축소 자체가 신호. matchedBy:'axis'). 축소가 없었으면 기존대로 점수>0만 매칭(matchedBy:'keyword').
//    (6) 매핑도 없고 점수도 0 → 임의 td 폴백 금지, unmatched(num=null). 화면은 UnsupportedNotice.
//
//    확장 시 (1)situation.options 배열에 추가 (2)situationToTd에 축별 매핑 추가 (3)콘텐츠 없으면 집필 먼저(C-35).
// ────────────────────────────────────────────────────────────────────────
export function matchTdToInput(answers, { format = 'adult' } = {}) {
  // (1) format 게이트 — 현재 축의 포맷으로 후보 제한 (손대지 말 것: 감정폭발축 차단 장치)
  let pool = ALL_TDS.filter((td) => td.format === format)

  const scene = answers?.scene
  const sceneMap = scene ? SITUATION_MAP[scene] : null // { "1":[...], ..., "7":[...] } | undefined
  let narrowed = false // 장면/축으로 pool이 축소됐는지 → matchedBy 판정

  // (2) scene(소재축)으로 후보 축소 — 매핑 있을 때만. 합집합 pool.
  if (sceneMap) {
    const sceneNums = new Set(Object.values(sceneMap).flat())
    const scenePool = pool.filter((td) => sceneNums.has(td.num))
    if (scenePool.length > 0) {
      pool = scenePool
      narrowed = true
    }
    // 방어: 장면 합집합이 비면(있을 수 없지만) 상위 pool 유지.
  }

  // (3) 패턴축 신호로 더 축소 — patternAxis 우선, 없으면 childType.
  if (sceneMap) {
    let axisNums = null
    if (answers?.patternAxis != null && Array.isArray(sceneMap[answers.patternAxis])) {
      axisNums = sceneMap[answers.patternAxis]
    } else if (answers?.childType && Array.isArray(CHILD_TYPE_TO_AXIS[answers.childType])) {
      const axes = CHILD_TYPE_TO_AXIS[answers.childType]
      axisNums = axes.flatMap((ax) => sceneMap[ax] ?? [])
    }
    // 방어(§4-3): axisNums 없음/빈배열(예: 스마트폰 축"7"=[]) → 축소 건너뛰고 상위 pool 유지(빈 pool 금지).
    if (axisNums && axisNums.length > 0) {
      const axisSet = new Set(axisNums)
      const axisPool = pool.filter((td) => axisSet.has(td.num))
      if (axisPool.length > 0) {
        pool = axisPool
        narrowed = true
      }
    }
  }

  // (4) ⑦ 가중 (parentType) — 확정 아님, 점수만 올릴 td 집합.
  let weightSet = new Set()
  if (sceneMap && PARENT_WEIGHT_TYPES.includes(answers?.parentType)) {
    weightSet = new Set(sceneMap['7'] ?? [])
  }

  // (5) 키워드 점수 매칭 (축소된 pool 안에서). ★ note 제거(죽은 필드), childText·parentText 추가.
  const text = [scene, answers?.childText, answers?.parentText].filter(Boolean).join(' ')
  // 토큰화: 가운뎃점·공백·기호로 분리, 2글자 이상만
  const tokens = text
    .split(/[·\s,/()★]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2)

  let best = null
  for (const td of pool) {
    const title = td.title ?? ''
    let score = tokens.reduce((n, tk) => (title.includes(tk) ? n + 1 : n), 0)
    if (weightSet.has(td.num)) score += 1 // ⑦ 가중(점수만)
    if (!best || score > best.score) best = { ...td, score }
  }
  if (best) {
    // 장면/축으로 축소됐으면 점수 0이어도 후보 반환(축소가 신호). 아니면 기존대로 점수>0만.
    if (narrowed) return { ...best, matchedBy: 'axis' }
    if (best.score > 0) return { ...best, matchedBy: 'keyword' }
  }

  // (6) 매핑도 없고 점수도 0 → 임의 td 폴백 금지. 미매칭 신호 반환(§4: 자산 없음 → 화면 생략).
  return { num: null, title: null, format: null, score: 0, unmatched: true }
}
