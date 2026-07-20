// ─────────────────────────────────────────────────────────────────────────
// matchSprint15_c118.mjs — Sprint 15 · C-118 지정 TD 서열 복구 검증 + Evidence 생성
//   실행: node scripts/matchSprint15_c118.mjs
//   성격: C-118 전용 검증/증거 파일(1개). Sprint14 하네스(scripts/matchHarness.mjs)를 수정하지 않고,
//         동일한 80조합 순회 방식으로 수정된 matchTd.js를 직접 호출해 결과를 검증한다.
//   ★ matchTd.js 판정 로직은 호출만(무수정). esbuild로 번들해 JSON import 제약 우회(하네스와 동일 패턴).
//   ★ baseline(matchSprint14_80combo_20260719.json)은 읽기 전용 입력. 절대 덮어쓰지 않음.
//   ★ 산출물 = matchSprint15_c118_20260720.json / .md (Sprint15 전용 파일명, 11_계측).
//   ★ Acceptance A~E를 이진(pass/fail)으로 자체 assert. 하나라도 실패 시 exit 1.
// ─────────────────────────────────────────────────────────────────────────
import { build } from 'esbuild'
import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { homedir } from 'os'
import { join } from 'path'

const rd = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url)))
const bp = rd('../src/data/behaviorPool.json')

// PARENT_WEIGHT_TYPES = matchTd.js 정본과 동일(⑦가중 트리거). 라벨 판정 전용 재선언(그 파일 미export).
const PARENT_WEIGHT_TYPES = ['자꾸 확인·점검했다', '내가 대신 해줬다', '여러 번 말했다']
// C-85 §3-B 지정 TD(검증 기대값). matchTd.js/parentTypeToTd.json과 동일해야 한다.
const EXPECTED_TARGET = { '자꾸 확인·점검했다': 34, '내가 대신 해줬다': 57, '여러 번 말했다': 67 }

const OUT_DIR = join(homedir(), 'OneDrive', 'Desktop', 'docs', '11_계측')
const BASELINE_PATH = join(OUT_DIR, 'matchSprint14_80combo_20260719.json')

// ── 수정된 matchTd.js 번들 → 실제 함수 로드 (판정 로직 무수정, JSON import 인라인) ──
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

const scenes = Object.keys(bp).filter((k) => !k.startsWith('_'))

// ── 80조합 직접 순회: 5 scene × 4 child × 4 parent (하네스와 동일 방식) ──
const results = []
for (const scene of scenes) {
  for (const c of bp[scene].child) {
    for (const p of bp[scene].parent) {
      const childType = c.typeKey
      const parentType = p.typeKey
      const weighted = PARENT_WEIGHT_TYPES.includes(parentType)
      const r = matchTdToInput({ scene, childType, childText: c.rep, parentType, parentText: p.rep })
      const m = r._metrics
      results.push({
        scene,
        childType,
        parentType,
        weighted,
        childText: c.rep,
        parentText: p.rep,
        result: m.result,
        score: r.score,
        num: r.num, // top1 (matched=지정/승자 num, unmatched=null)
        title: r.title ?? null,
        matchedBy: r.matchedBy ?? null,
        unmatched: !!r.unmatched,
        top3: m.top3,
        tiedAtTop: m.tiedAtTop,
        scoreGap: m.scoreGap,
        weightApplied: m.weightApplied,
        parentTypeTargetTd: m.parentTypeTargetTd,
        parentTypeBonusApplied: m.parentTypeBonusApplied,
        parentTypeBonusValue: m.parentTypeBonusValue,
        _metrics: m,
      })
    }
  }
}

const key = (r) => `${r.scene}|${r.childType}|${r.parentType}`
const byKey = new Map(results.map((r) => [key(r), r]))
const w40 = results.filter((r) => r.weighted)
const nw40 = results.filter((r) => !r.weighted)
const sp = results.filter((r) => r.scene === '스마트폰·게임')
const cnt = (a, f) => a.filter(f).length

// ── baseline(읽기 전용) 로드 → 대상 22건·matched 집합 도출 ──
const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
const baseCombos = baseline.combos
const baseMatchedKeys = new Set(baseCombos.filter((c) => c.result === 'matched').map(key))
const targetTuples = baseCombos.filter(
  (c) => c.weighted === true && c.result === 'matched' && c.tiedAtTop >= 3,
)

// ── Acceptance 판정 ──
const checks = []
const add = (id, label, pass, detail) => checks.push({ id, label, pass: !!pass, detail })

// A. 대상 22건
const targetRows = targetTuples.map((t) => byKey.get(`${t.scene}|${t.childType}|${t.parentType}`))
const missing = targetTuples.filter((_, i) => !targetRows[i])
const soleTop1 = targetRows.filter(
  (r) => r && r.num === EXPECTED_TARGET[r.parentType] && r.tiedAtTop === 1,
)
const wrongTop1 = targetRows.filter((r) => r && r.num !== EXPECTED_TARGET[r.parentType])
const notTied1 = targetRows.filter((r) => r && r.tiedAtTop !== 1)
add('A-count', '대상 22건 확정(baseline)', targetTuples.length === 22, `${targetTuples.length}건`)
add('A-missing', '대상 누락 0건', missing.length === 0, `누락 ${missing.length}`)
add('A-sole', '지정 TD 단독 top1 & tiedAtTop=1 (22/22)', soleTop1.length === 22, `${soleTop1.length}/22`)
add('A-wrong', '잘못된 지정 TD top1 0건', wrongTop1.length === 0, `오배정 ${wrongTop1.length}`)
add('A-tied1', '대상 22건 tiedAtTop=1', notTied1.length === 0, `tied≠1 ${notTied1.length}`)

// B. 가중40
const w40matched = cnt(w40, (r) => r.result === 'matched')
const w40unmatched = cnt(w40, (r) => r.result === 'unmatched')
const w40matchedTied3 = cnt(w40, (r) => r.result === 'matched' && r.tiedAtTop >= 3)
const spW = sp.filter((r) => r.weighted)
add('B-mn', '가중40 matched 36 / unmatched 4', w40matched === 36 && w40unmatched === 4, `matched ${w40matched} / unmatched ${w40unmatched}`)
add('B-tied', '가중 matched-only tiedAtTop≥3 = 0/36', w40matchedTied3 === 0, `${w40matchedTied3}/36`)
add('B-sp', '스마트폰 가중 4건 unmatched 유지', spW.length === 4 && spW.every((r) => r.result === 'unmatched'), `${spW.length}건 중 unmatched ${cnt(spW, (r) => r.result === 'unmatched')}`)

// C. 비가중40
const nw40matched = cnt(nw40, (r) => r.result === 'matched')
const nw40unmatched = cnt(nw40, (r) => r.result === 'unmatched')
const nwWzero = cnt(nw40, (r) => r.weightApplied === 0)
const nwNoBonus = cnt(nw40, (r) => r.parentTypeBonusApplied === false && r.parentTypeTargetTd === null)
add('C-mn', '비가중40 matched 10 / unmatched 30', nw40matched === 10 && nw40unmatched === 30, `matched ${nw40matched} / unmatched ${nw40unmatched}`)
add('C-wz', '비가중40 weightApplied=0 (40/40)', nwWzero === 40, `${nwWzero}/40`)
add('C-nomap', '비가중40 parentType 전용 매핑 0건', nwNoBonus === 40, `${nwNoBonus}/40`)

// D. 전체80
const allMatched = cnt(results, (r) => r.result === 'matched')
const allUnmatched = cnt(results, (r) => r.result === 'unmatched')
const nowMatchedKeys = new Set(results.filter((r) => r.result === 'matched').map(key))
const newlyMatched = [...nowMatchedKeys].filter((k) => !baseMatchedKeys.has(k))
const lostMatched = [...baseMatchedKeys].filter((k) => !nowMatchedKeys.has(k))
add('D-mn', '전체80 matched 46 / unmatched 34', allMatched === 46 && allUnmatched === 34, `matched ${allMatched} / unmatched ${allUnmatched}`)
add('D-new', '신규 matched 생성 0건 (baseline과 동일 집합)', newlyMatched.length === 0 && lostMatched.length === 0, `신규 ${newlyMatched.length} / 소실 ${lostMatched.length}`)

// E. 스마트폰·게임
const spUnmatched = cnt(sp, (r) => r.result === 'unmatched')
add('E-all', '스마트폰 16건 모두 unmatched', spUnmatched === 16, `${spUnmatched}/16`)
add('E-c119', 'C-119 가중 4건도 unmatched', spW.every((r) => r.result === 'unmatched'), `가중 unmatched ${cnt(spW, (r) => r.result === 'unmatched')}/4`)

const allPass = checks.every((c) => c.pass)

// ── 대표 고정 조합 6건 ──
const repDefs = [
  ['등교·외출 준비', '딴 데로 빠졌다', '자꾸 확인·점검했다', 'td34 단독 top1'],
  ['등교·외출 준비', '딴 데로 빠졌다', '내가 대신 해줬다', 'td57 단독 top1'],
  ['등교·외출 준비', '딴 데로 빠졌다', '여러 번 말했다', 'td67 단독 top1'],
  ['숙제·공부', '딴 데로 빠졌다', '이유를 길게 설명했다', '기존 td22 matched 유지'],
  ['숙제·공부', '회피', '이유를 길게 설명했다', '기존 unmatched(UnsupportedNotice) 유지'],
  ['스마트폰·게임', '딴 데로 빠졌다', '여러 번 말했다', '기존 unmatched 유지'],
]
const reps = repDefs.map(([s, ct, pt, expect]) => {
  const r = byKey.get(`${s}|${ct}|${pt}`)
  return { scene: s, childType: ct, parentType: pt, expect, num: r?.num ?? null, result: r?.result, tiedAtTop: r?.tiedAtTop, top3: r?.top3, weightApplied: r?.weightApplied, parentTypeTargetTd: r?.parentTypeTargetTd, parentTypeBonusValue: r?.parentTypeBonusValue }
})

// ── 요약 통계(표본별) ──
function statOf(rs) {
  const n = rs.length
  const matched = cnt(rs, (r) => r.result === 'matched')
  return {
    n,
    matched,
    unmatched: n - matched,
    matchedTied3: cnt(rs, (r) => r.result === 'matched' && r.tiedAtTop >= 3),
    weightAppliedZero: cnt(rs, (r) => r.weightApplied === 0),
    bonusApplied: cnt(rs, (r) => r.parentTypeBonusApplied === true),
  }
}
const summary = {
  all80: statOf(results),
  weighted40: statOf(w40),
  nonweighted40: statOf(nw40),
  byScene: scenes.map((s) => ({ scene: s, ...statOf(results.filter((r) => r.scene === s)) })),
}

// ── JSON 산출물 ──
const jsonOut = {
  meta: {
    sprint: 'Sprint 15',
    task: 'C-118 가중 매칭 지정 TD 서열 복구',
    buildPack: 'BrainBridge_Sprint15_BuildPack_Candidate_v2',
    generatedFor: '20260720',
    format: 'adult',
    source: 'behaviorPool[scene].child × behaviorPool[scene].parent 직접 순회 (rep 사용) — Sprint14 하네스와 동일',
    baselineRef: 'matchSprint14_80combo_20260719.json',
    parentWeightTypes: PARENT_WEIGHT_TYPES,
    parentTypeToTd: EXPECTED_TARGET,
    note: 'C-118: C-109 공통 축7 +1 유지 위에 선택 parentType의 지정 TD 1개에만 추가 bonus +1(총 2점) → 단독 top1. 비가중 4종 null 유지(전용 매핑 0). scene·childType 점수 계산 무변경.',
  },
  denominator: {
    total: results.length,
    weighted: w40.length,
    nonweighted: nw40.length,
    byScene: scenes.map((s) => {
      const rs = results.filter((r) => r.scene === s)
      return { scene: s, total: rs.length, weighted: cnt(rs, (r) => r.weighted), nonweighted: cnt(rs, (r) => !r.weighted) }
    }),
    duplicateCombos: results.length - new Set(results.map(key)).size,
    ok: results.length === 80 && w40.length === 40 && nw40.length === 40,
  },
  summary,
  acceptance: { allPass, checks },
  target22: targetRows.map((r) => ({ scene: r.scene, childType: r.childType, parentType: r.parentType, num: r.num, expectedTargetTd: EXPECTED_TARGET[r.parentType], tiedAtTop: r.tiedAtTop, top3: r.top3, parentTypeBonusValue: r.parentTypeBonusValue })),
  representatives: reps,
  combos: results,
}

// ── Markdown 요약 ──
const md = []
const P = (...x) => md.push(x.join(''))
P('# Sprint 15 — C-118 지정 TD 서열 복구 계측 요약 · 20260720')
P('')
P('> 원천: `behaviorPool[scene].child × behaviorPool[scene].parent` 직접 순회(Sprint14 하네스와 동일). 5×4×4=80.')
P('> C-118: C-109 공통 축7 +1 유지 + 선택 parentType 지정 TD 1개에만 추가 bonus +1(총 2점) → 단독 top1.')
P(`> baseline: matchSprint14_80combo_20260719.json (읽기 전용). matchTd.js 판정 로직 호출만(하네스 무수정).`)
P('')
P('## 0. 분모 무결성')
P('')
P('| 항목 | 값 |')
P('|---|---|')
P(`| 전체/가중/비가중 | ${jsonOut.denominator.total} / ${jsonOut.denominator.weighted} / ${jsonOut.denominator.nonweighted} |`)
P(`| 중복 조합 | ${jsonOut.denominator.duplicateCombos} |`)
P(`| 80/40/40 성립 | ${jsonOut.denominator.ok ? '성립 ✅' : '불성립 ⚠️'} |`)
P('')
P('| 장면 | 전체 | 가중 | 비가중 |')
P('|---|--:|--:|--:|')
for (const s of jsonOut.denominator.byScene) P(`| ${s.scene} | ${s.total} | ${s.weighted} | ${s.nonweighted} |`)
P('')
P('## 1. 표본별 요약 (Sprint 15)')
P('')
P('| 표본 | n | matched | unmatched | matched tied≥3 | weightApplied=0 | bonus 적용 |')
P('|---|--:|--:|--:|--:|--:|--:|')
const sr = (label, s) => P(`| ${label} | ${s.n} | ${s.matched} | ${s.unmatched} | ${s.matchedTied3} | ${s.weightAppliedZero} | ${s.bonusApplied} |`)
sr('전체80', summary.all80)
sr('가중40', summary.weighted40)
sr('비가중40', summary.nonweighted40)
P('')
P('### 장면별')
P('')
P('| 장면 | n | matched | unmatched | matched tied≥3 | bonus 적용 |')
P('|---|--:|--:|--:|--:|--:|')
for (const s of summary.byScene) P(`| ${s.scene} | ${s.n} | ${s.matched} | ${s.unmatched} | ${s.matchedTied3} | ${s.bonusApplied} |`)
P('')
P('## 2. Acceptance Matrix (이진 pass/fail)')
P('')
P('| ID | 항목 | 결과 | 실측 |')
P('|---|---|:--:|---|')
for (const c of checks) P(`| ${c.id} | ${c.label} | ${c.pass ? 'PASS ✅' : 'FAIL ❌'} | ${c.detail} |`)
P('')
P(`> **종합: ${allPass ? '전 항목 PASS ✅' : '실패 항목 존재 ❌'}**`)
P('')
P('## 3. 대상 22건 검증 (baseline: weighted & matched & tiedAtTop≥3)')
P('')
P('| # | 장면 | 아이행동 | 부모행동 | 지정 TD | Sprint15 num | tiedAtTop | bonus |')
P('|--:|---|---|---|--:|--:|--:|--:|')
targetRows.forEach((r, i) => P(`| ${i + 1} | ${r.scene} | ${r.childType} | ${r.parentType} | ${EXPECTED_TARGET[r.parentType]} | ${r.num} | ${r.tiedAtTop} | ${r.parentTypeBonusValue} |`))
P('')
P('## 4. 대표 고정 조합 6건')
P('')
P('| # | 조합 | 기대 | Sprint15 실측 |')
P('|--:|---|---|---|')
reps.forEach((r, i) => {
  const meas = r.result === 'matched' ? `num=${r.num} matched tied=${r.tiedAtTop} top3=${JSON.stringify(r.top3.map((t) => t.num + ':' + t.score))}` : `unmatched (num=null)`
  P(`| ${i + 1} | ${r.scene} × ${r.childType} × ${r.parentType} | ${r.expect} | ${meas} |`)
})
P('')
P('> 지정 TD: 자꾸 확인·점검했다→td34 / 내가 대신 해줬다→td57 / 여러 번 말했다→td67 (C-85 §3-B).')

// ── 파일 저장 ──
const jsonPath = join(OUT_DIR, 'matchSprint15_c118_20260720.json')
const mdPath = join(OUT_DIR, 'matchSprint15_c118_20260720.md')
writeFileSync(jsonPath, JSON.stringify(jsonOut, null, 2), 'utf8')
writeFileSync(mdPath, md.join('\n') + '\n', 'utf8')

// ── 콘솔 요약 (stderr) ──
console.error('=== Sprint 15 · C-118 검증 ===')
console.error('분모: 전체', jsonOut.denominator.total, '| 가중', jsonOut.denominator.weighted, '| 비가중', jsonOut.denominator.nonweighted, '| 중복', jsonOut.denominator.duplicateCombos)
console.error('전체80  : matched', summary.all80.matched, '/ unmatched', summary.all80.unmatched)
console.error('가중40  : matched', summary.weighted40.matched, '/ unmatched', summary.weighted40.unmatched, '| matched tied≥3', summary.weighted40.matchedTied3, '| bonus', summary.weighted40.bonusApplied)
console.error('비가중40: matched', summary.nonweighted40.matched, '/ unmatched', summary.nonweighted40.unmatched, '| weightApplied=0', summary.nonweighted40.weightAppliedZero, '| bonus', summary.nonweighted40.bonusApplied)
console.error('대상22  : 단독top1', soleTop1.length + '/22', '| 누락', missing.length, '| 오배정', wrongTop1.length)
for (const c of checks) console.error((c.pass ? 'PASS ' : 'FAIL ') + c.id + ' — ' + c.label + ' [' + c.detail + ']')
console.error('종합:', allPass ? 'ALL PASS ✅' : 'FAIL ❌')
console.error('저장:', jsonPath)
console.error('저장:', mdPath)

process.exit(allPass ? 0 : 1)
