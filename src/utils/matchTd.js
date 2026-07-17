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

// [C-10 10편 ②-2] 키워드 점수에서 제외할 불용어(조사·부사 계열 노이즈).
const STOPWORDS = new Set(['하고', '다른'])
// 근거: matchBaseline_20260716 표5 실측 노이즈. ★추가 시 실측 근거 필요

// [C-10 10편 ②-3] 토큰화 단일 정본 — split 정규식·length·STOPWORDS 규칙은 ②-1·②-2와 동일(무변경).
//   text·title·관찰이 모두 이 함수를 통과해 "경계(토큰) 기준"을 공유한다. dedupe(Set)는 호출부에서.
function tokenize(s) {
  return (s ?? '')
    .toString()
    .split(/[·\s,/()★]+/)
    .map((x) => x.trim())
    .filter((x) => x.length >= 2)
    .filter((x) => !STOPWORDS.has(x))
}

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
//        ★ [6편-보정] 축소(axis)·비축소(keyword) 경로 모두 best.score > 0 일 때만 반환한다.
//          0점이면 근거 없음 → (6) unmatched(무추론·임의 폴백 금지). matchedBy는 축소 시 'axis', 아니면 'keyword'.
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

  // [계측 전용 · C-10 baseline] (2)단계 후 후보 수 — 관찰만, 판정 무영향.
  const poolSizeAfterScene = pool.length

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

  // [계측 전용 · C-10 baseline] (3)단계 후 후보 수 + 실제 사용 축 재도출.
  //  ★ 위 (3)블록을 건드리지 않고 동일 입력으로 관찰만 재계산(판정 무영향).
  const poolSizeAfterAxis = pool.length
  let _axisSource = 'none'
  let _axisUsed = []
  if (sceneMap) {
    if (answers?.patternAxis != null && Array.isArray(sceneMap[answers.patternAxis])) {
      _axisSource = 'patternAxis'
      _axisUsed = [String(answers.patternAxis)]
    } else if (answers?.childType && Array.isArray(CHILD_TYPE_TO_AXIS[answers.childType])) {
      _axisSource = 'childType'
      _axisUsed = CHILD_TYPE_TO_AXIS[answers.childType]
    }
  }

  // (4) ⑦ 가중 (parentType) — 확정 아님, 점수만 올릴 td 집합.
  let weightSet = new Set()
  if (sceneMap && PARENT_WEIGHT_TYPES.includes(answers?.parentType)) {
    weightSet = new Set(sceneMap['7'] ?? [])
  }

  // [계측 전용 · C-10 baseline] ⑦가중(+1)이 실제 적용될 td 수 = pool ∩ weightSet.
  const weightApplied = pool.filter((td) => weightSet.has(td.num)).length

  // (5) 키워드 점수 매칭 (축소된 pool 안에서). ★ note 제거(죽은 필드), childText·parentText 추가.
  const text = [scene, answers?.childText, answers?.parentText].filter(Boolean).join(' ')
  // 토큰화: tokenize()(가운뎃점·공백·기호 분리 · 2글자↑ · STOPWORDS 제외) + ②-1 중복 제거(Set).
  //  ★ split 정규식·length·STOPWORDS 규칙은 tokenize로 그대로 이관(무변경). 여기선 dedupe만 담당.
  const tokens = [...new Set(tokenize(text))]

  let best = null
  for (const td of pool) {
    // [C-10 10편 ②-3] substring(title.includes) → 토큰 집합 교집합으로 점수 산정.
    //  title도 동일 tokenize를 통과 → 경계 기준 일치(조사·부사 부분문자열 우연겹침 차단).
    const titleTokens = new Set(tokenize(td.title ?? ''))
    let score = tokens.filter((tk) => titleTokens.has(tk)).length
    if (weightSet.has(td.num)) score += 1 // ⑦ 가중(점수만) — 무변경
    if (!best || score > best.score) best = { ...td, score } // tie-break 무변경
  }
  // ─── [계측 전용 · C-10 baseline] 판정에 영향 없음. 관찰값만 계산해 _metrics로 반환. ───
  //  ★ 위 판정 루프·게이트는 무변경. 아래는 "동일 공식"으로 점수를 재계산해 서열/기여를 관찰만 한다.
  //    (기존 score/best 판정에 절대 되먹이지 않음. 불일치가 나면 그 자체가 발견 → 인계 메모.)
  // [C-10 10편 ②-3] 관찰도 동일 방식(집합 교집합)으로 — matchedTokens/contribBySource가 점수와 정합.
  //   ★ 관찰 전용. tokenize()(②-1·②-2 규칙 포함) 재사용. score용 tokens 블록·판정 루프는 재변경 안 함.
  const _scored = pool.map((td) => {
    const titleTokens = new Set(tokenize(td.title ?? ''))
    let s = tokens.filter((tk) => titleTokens.has(tk)).length
    if (weightSet.has(td.num)) s += 1
    return { num: td.num, score: s }
  })
  const _sorted = [..._scored].sort((a, b) => b.score - a.score)
  const _topScore = _sorted.length ? _sorted[0].score : 0
  const _scoreDistribution = _scored.reduce((acc, { score }) => {
    acc[score] = (acc[score] || 0) + 1
    return acc
  }, {})
  // matchedTokens/contribBySource: 승자 title 토큰 집합과의 교집합(경계 기준). 부분문자열 관찰 폐기.
  const _winnerTitleTokens = new Set(tokenize(best?.title ?? ''))
  const _ovl = (s) => tokenize(s).filter((t) => _winnerTitleTokens.has(t))
  const _sceneOv = _ovl(scene)
  const _childOv = _ovl(answers?.childText)
  const _parentOv = _ovl(answers?.parentText)
  const _metrics = {
    scene: answers?.scene ?? null,
    childType: answers?.childType ?? null,
    parentType: answers?.parentType ?? null,
    patternAxis: answers?.patternAxis ?? null,
    poolSizeAfterScene,
    axisUsed: _axisUsed,
    axisSource: _axisSource,
    poolSizeAfterAxis,
    narrowed,
    top3: _sorted.slice(0, 3).map((x) => ({ num: x.num, score: x.score })),
    scoreGap: _sorted.length >= 2 ? _sorted[0].score - _sorted[1].score : null,
    tiedAtTop: _scored.filter((x) => x.score === _topScore).length,
    scoreDistribution: _scoreDistribution,
    contribBySource: {
      scene: _sceneOv.length,
      childText: _childOv.length,
      parentText: _parentOv.length,
    },
    matchedTokens: [...new Set([..._sceneOv, ..._childOv, ..._parentOv])],
    weightApplied,
    result: best && best.score > 0 ? 'matched' : 'unmatched',
  }

  // ★ [6편-보정 · C-10] 축소(axis)·비축소(keyword) 경로 모두 best.score > 0 일 때만 반환.
  //   0점은 근거 없음 → (6) unmatched. 축소됐어도 pool 첫 후보(배열 순서일 뿐) 반환 금지 = 무추론/임의폴백 금지.
  if (best && best.score > 0) {
    return { ...best, matchedBy: narrowed ? 'axis' : 'keyword', _metrics }
  }

  // (6) 매핑도 없고 점수도 0 → 임의 td 폴백 금지. 미매칭 신호 반환(§4: 자산 없음 → 화면 생략).
  return { num: null, title: null, format: null, score: 0, unmatched: true, _metrics }
}
