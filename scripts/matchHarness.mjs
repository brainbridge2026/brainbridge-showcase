// ─────────────────────────────────────────────────────────────────────────
// matchHarness.mjs — Sprint 14 · C-120 80조합 재검증 계측 하네스 (14편 v1_r4)
//   실행: node scripts/matchHarness.mjs
//   성격: 배포 무관 개발 도구(Vite 번들 밖). matchTd.js를 화면 없이 직접 호출해 _metrics 수집.
//   ★ matchTd.js 판정 로직 무변경. esbuild로 번들해(node JSON import 제약 우회) 그대로 호출만 한다.
//   ★ 80조합 원천 = behaviorPool[scene].child × behaviorPool[scene].parent 직접 순회(중첩 반복문).
//      5 scene × (child 4 × parent 4) = 5 × 16 = 80. childText/parentText = 각 항목 rep(대표문장) 그대로.
//   ★ 가중/비가중 = parentType ∈ PARENT_WEIGHT_TYPES(가중 3종) 여부로 라벨만 부여. matchTd.js의
//      실제 ⑦가중 로직은 그대로 통과시켜 결과(weightApplied)를 관찰만 한다. 가짜 부모행동 추가 없음.
//   ★ C-121: contribBySource 합 = score 검사식은 사용하지 않는다(성립하지 않는 완료조건).
//   ★ 산출물은 리포 밖 실제 경로(OneDrive\Desktop\docs\11_계측)에 직접 파일로 저장한다.
// ─────────────────────────────────────────────────────────────────────────
import { build } from 'esbuild'
import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { homedir } from 'os'
import { join } from 'path'

const rd = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url)))
const bp = rd('../src/data/behaviorPool.json')

// PARENT_WEIGHT_TYPES = matchTd.js:17 정본과 동일(⑦가중 트리거). 하네스가 재선언(그 파일은 미export).
//  ★ 라벨 판정 전용. 이 목록에 미정 부모행동을 가짜로 추가하지 않는다.
const PARENT_WEIGHT_TYPES = ['자꾸 확인·점검했다', '내가 대신 해줬다', '여러 번 말했다']

// ── matchTd.js 번들 → 실제 함수 로드 (판정 로직 무수정, JSON import만 인라인) ──
const entry = fileURLToPath(new URL('../src/utils/matchTd.js', import.meta.url))
const bundled = await build({
  entryPoints: [entry],
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
  loader: { '.json': 'json' },
})
const mod = await import(
  'data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64')
)
const matchTdToInput = mod.matchTdToInput

const scenes = Object.keys(bp).filter((k) => !k.startsWith('_')) // 5장면 (behaviorPool 최상위 키)

// ── 80조합 직접 순회: 5 scene × 4 child × 4 parent (중첩 반복문 · behaviorPool 직접) ──
//   전역 child 목록을 먼저 순회하고 필터링하지 않는다. 각 scene의 child/parent 배열을 그대로 순회.
const results = []
for (const scene of scenes) {
  const childArr = bp[scene].child     // 배열(4)
  const parentArr = bp[scene].parent   // 배열(4)
  for (const c of childArr) {
    for (const p of parentArr) {
      const childType = c.typeKey
      const parentType = p.typeKey
      const childText = c.rep          // rep(대표문장) 그대로 — 지어내지 않음
      const parentText = p.rep
      const weighted = PARENT_WEIGHT_TYPES.includes(parentType) // 라벨만. 실제 가중은 matchTd.js 소관

      // format 기본 'adult' (App.jsx:216 무인자 호출과 동일 — 2번째 인자 없음)
      const r = matchTdToInput({ scene, childType, childText, parentType, parentText })
      const m = r._metrics

      results.push({
        scene,
        childType,
        parentType,
        weighted,
        childText,
        parentText,
        num: r.num,
        title: r.title ?? null,
        score: r.score,
        matchedBy: r.matchedBy ?? null,
        unmatched: !!r.unmatched,
        result: m.result,                 // 'matched' | 'unmatched' (best.score>0 기준)
        tiedAtTop: m.tiedAtTop,
        top3: m.top3,
        scoreGap: m.scoreGap,
        weightApplied: m.weightApplied,
        _metrics: m,                       // 원본 관찰값 전량(원본 JSON 보존용)
      })
    }
  }
}

// ── 표본 분리 ──
const all80 = results
const weighted40 = results.filter((r) => r.weighted)
const nonweighted40 = results.filter((r) => !r.weighted)

// ── 지표 산출 헬퍼 (한 표본 rs → 통계 객체). C-121: contrib=score 검사 없음. ──
const mean = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0)
const pct = (n, d) => (d ? ((100 * n) / d).toFixed(1) + '%' : '-')

function statOf(rs) {
  const n = rs.length
  const matched = rs.filter((r) => r.result === 'matched').length
  const unmatched = rs.filter((r) => r.result === 'unmatched').length

  // tiedAtTop≥3 — raw(unmatched 포함 전체) / matched-only(score>0)
  const tiedRaw3 = rs.filter((r) => r.tiedAtTop >= 3).length
  const tiedMatched3 = rs.filter((r) => r.result === 'matched' && r.tiedAtTop >= 3).length

  // score 분포 (0 / 1 / 2+) — 승자 score 기준(matched=best.score, unmatched=0)
  const s0 = rs.filter((r) => r.score === 0).length
  const s1 = rs.filter((r) => r.score === 1).length
  const s2plus = rs.filter((r) => r.score >= 2).length

  // weightApplied
  const wa = rs.map((r) => r.weightApplied)
  const waAvg = mean(wa)
  const waZero = wa.filter((v) => v === 0).length
  const waDist = {}
  for (const v of wa) waDist[v] = (waDist[v] || 0) + 1

  return {
    n,
    matched,
    unmatched,
    matchedRate: pct(matched, n),
    unmatchedRate: pct(unmatched, n),
    integrity: matched + unmatched === n, // matched + unmatched = 표본 수 성립 검사
    tiedRaw3,
    tiedRaw3Rate: pct(tiedRaw3, n),
    tiedMatched3,
    tiedMatched3Rate: pct(tiedMatched3, n),
    scoreDist: { '0': s0, '1': s1, '2+': s2plus },
    weightAppliedAvg: +waAvg.toFixed(3),
    weightAppliedZero: waZero,
    weightAppliedZeroRate: pct(waZero, n),
    weightAppliedDist: waDist,
  }
}

// 표본별 3단위(전체 / 장면별 / parentType별) 집계
function breakdown(rs) {
  const parentTypesPresent = [...new Set(rs.map((r) => r.parentType))]
  return {
    overall: statOf(rs),
    byScene: scenes
      .map((s) => ({ scene: s, ...statOf(rs.filter((r) => r.scene === s)) }))
      .filter((x) => x.n > 0),
    byParentType: parentTypesPresent.map((pt) => ({
      parentType: pt,
      ...statOf(rs.filter((r) => r.parentType === pt)),
    })),
  }
}

const summary = {
  all80: breakdown(all80),
  weighted40: breakdown(weighted40),
  nonweighted40: breakdown(nonweighted40),
}

// ── 분모 무결성 (80/40/40 · 장면별 16 · 중복 0) ──
const comboKeys = results.map((r) => `${r.scene}|${r.childType}|${r.parentType}`)
const dupCount = comboKeys.length - new Set(comboKeys).size
const denom = {
  total: all80.length,
  weighted: weighted40.length,
  nonweighted: nonweighted40.length,
  byScene: scenes.map((s) => {
    const rs = results.filter((r) => r.scene === s)
    return {
      scene: s,
      total: rs.length,
      weighted: rs.filter((r) => r.weighted).length,
      nonweighted: rs.filter((r) => !r.weighted).length,
    }
  }),
  duplicateCombos: dupCount,
  ok:
    all80.length === 80 &&
    weighted40.length === 40 &&
    nonweighted40.length === 40 &&
    dupCount === 0 &&
    scenes.every((s) => results.filter((r) => r.scene === s).length === 16),
}

// ── JSON 산출물 ──
const jsonOut = {
  meta: {
    sprint: 'Sprint 14',
    task: 'C-120 80조합 재검증',
    instruction: 'BrainBridge_빌드지시서_14편_Sprint14_C120_80조합재검증_v1_r4',
    generatedFor: '20260719',
    format: 'adult',
    source: 'behaviorPool[scene].child × behaviorPool[scene].parent 직접 순회 (rep 사용)',
    parentWeightTypes: PARENT_WEIGHT_TYPES,
    note: 'C-121: contribBySource 합=score 검사식 미사용. 가중40/비가중40은 장면 구성 비율이 달라 전체 비율만으로 원인 단정 금지 — 실측값만.',
  },
  denominator: denom,
  summary,
  combos: results, // 조합별 원본(80건)
}

// ── Markdown 요약 ──
const md = []
const P = (...x) => md.push(x.join(''))

function statTableHeader() {
  P('| 단위 | n | matched | unmatched | tied≥3 raw | tied≥3 matched | score0 | score1 | score2+ | wApplied 평균 | wApplied=0 | wApplied 분포 |')
  P('|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|---|')
}
function statRow(label, s) {
  P(
    `| ${label} | ${s.n} | ${s.matched} (${s.matchedRate}) | ${s.unmatched} (${s.unmatchedRate}) | ` +
      `${s.tiedRaw3} (${s.tiedRaw3Rate}) | ${s.tiedMatched3} (${s.tiedMatched3Rate}) | ` +
      `${s.scoreDist['0']} | ${s.scoreDist['1']} | ${s.scoreDist['2+']} | ` +
      `${s.weightAppliedAvg} | ${s.weightAppliedZero} (${s.weightAppliedZeroRate}) | ${JSON.stringify(s.weightAppliedDist)} |`
  )
}
function renderSample(title, bd) {
  P(`## ${title}`)
  P('')
  P('### 전체')
  P('')
  statTableHeader()
  statRow('전체', bd.overall)
  P('')
  P(`> matched + unmatched = n 성립: **${bd.overall.integrity ? '성립 ✅' : '불성립 ⚠️'}** (${bd.overall.matched} + ${bd.overall.unmatched} = ${bd.overall.n})`)
  P('')
  P('### 장면별')
  P('')
  statTableHeader()
  for (const s of bd.byScene) statRow(s.scene, s)
  P('')
  P('### parentType별')
  P('')
  statTableHeader()
  for (const p of bd.byParentType) statRow(p.parentType, p)
  P('')
}

P('# Sprint 14 — C-120 80조합 재검증 계측 요약 · 20260719')
P('')
P('> 원천: `behaviorPool[scene].child × behaviorPool[scene].parent` 직접 순회(중첩 반복문). 5 scene × 4 child × 4 parent = 80.')
P('> childText/parentText = 각 항목 rep. format=`adult`(App.jsx:216 무인자). matchTd.js 판정 로직 무변경 — _metrics 관찰값만.')
P('> C-121: contribBySource 합=score 검사식 미사용. 가중40/비가중40은 장면 구성 비율이 달라(등교 가중12·비가중4, 스마트폰 가중4·비가중12 등) 전체 비율만으로 원인·매핑효과 단정 금지 — 실측값만.')
P('')
P('## 0. 분모 무결성')
P('')
P('| 항목 | 값 |')
P('|---|---|')
P(`| 전체 조합 | ${denom.total} |`)
P(`| 가중 조합 | ${denom.weighted} |`)
P(`| 비가중 조합 | ${denom.nonweighted} |`)
P(`| 중복 조합 | ${denom.duplicateCombos} |`)
P(`| 80/40/40·장면16·중복0 전부 성립 | ${denom.ok ? '성립 ✅' : '불성립 ⚠️'} |`)
P('')
P('| 장면 | 전체 | 가중 | 비가중 |')
P('|---|--:|--:|--:|')
for (const s of denom.byScene) P(`| ${s.scene} | ${s.total} | ${s.weighted} | ${s.nonweighted} |`)
P('')
renderSample('1. 전체 80조합', summary.all80)
renderSample('2. 가중 40조합', summary.weighted40)
renderSample('3. 비가중 40조합', summary.nonweighted40)
P('> 지표 정의: tied≥3 raw = tiedAtTop≥3 전체(unmatched 포함) / tied≥3 matched = result=matched(score>0)만.')
P('> score 분포 = 승자 score(matched=best.score, unmatched=0). weightApplied = pool ∩ ⑦가중 td 수(관찰).')

// ── 파일 저장 (리포 밖 실제 경로 · OneDrive 리다이렉션 반영) ──
const OUT_DIR = join(homedir(), 'OneDrive', 'Desktop', 'docs', '11_계측')
const jsonPath = join(OUT_DIR, 'matchSprint14_80combo_20260719.json')
const mdPath = join(OUT_DIR, 'matchSprint14_80combo_20260719.md')
writeFileSync(jsonPath, JSON.stringify(jsonOut, null, 2), 'utf8')
writeFileSync(mdPath, md.join('\n') + '\n', 'utf8')

// ── 요약 (stderr) ──
console.error('=== Sprint 14 · C-120 80조합 재검증 요약 ===')
console.error('분모: 전체', denom.total, '| 가중', denom.weighted, '| 비가중', denom.nonweighted, '| 중복', denom.duplicateCombos, '| 무결성', denom.ok)
console.error('전체80  : matched', summary.all80.overall.matched, '/ unmatched', summary.all80.overall.unmatched, '| tied≥3 raw', summary.all80.overall.tiedRaw3, '| wApplied평균', summary.all80.overall.weightAppliedAvg, '| wApplied=0', summary.all80.overall.weightAppliedZero)
console.error('가중40  : matched', summary.weighted40.overall.matched, '/ unmatched', summary.weighted40.overall.unmatched, '| tied≥3 raw', summary.weighted40.overall.tiedRaw3, '| wApplied평균', summary.weighted40.overall.weightAppliedAvg, '| wApplied=0', summary.weighted40.overall.weightAppliedZero)
console.error('비가중40: matched', summary.nonweighted40.overall.matched, '/ unmatched', summary.nonweighted40.overall.unmatched, '| tied≥3 raw', summary.nonweighted40.overall.tiedRaw3, '| wApplied평균', summary.nonweighted40.overall.weightAppliedAvg, '| wApplied=0', summary.nonweighted40.overall.weightAppliedZero)
console.error('무결성 성립(3표본):', summary.all80.overall.integrity && summary.weighted40.overall.integrity && summary.nonweighted40.overall.integrity)
console.error('저장:', jsonPath)
console.error('저장:', mdPath)
