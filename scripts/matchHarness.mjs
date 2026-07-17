// ─────────────────────────────────────────────────────────────────────────
// matchHarness.mjs — C-10 매칭 baseline 계측 하네스 (9편 · 기획 창 보정 반영)
//   실행: node scripts/matchHarness.mjs
//   성격: 배포 무관 개발 도구(Vite 번들 밖). matchTd.js를 화면 없이 직접 호출해 _metrics 수집.
//   ★ matchTd.js는 판정 로직 무변경. 이 하네스는 그 함수를 esbuild로 번들해(node의 JSON import
//     제약 우회) 그대로 호출만 한다. 매칭 로직을 흉내내거나 고치지 않는다.
//   ★ childText/parentText = behaviorPool.json의 rep(대표문장) 그대로. 지어내지 않음.
//   ★ format = App.jsx:216 이 matchTdToInput(current) 를 인자 없이 호출 → 기본값 'adult'.
// ─────────────────────────────────────────────────────────────────────────
import { build } from 'esbuild'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'

const rd = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url)))
const bp = rd('../src/data/behaviorPool.json')
const cta = rd('../src/data/childTypeToAxis.json')
// [블록 ① · 읽기 전용] sceneMap['7'] 빈 장면 구분용. 데이터만 로드(파일 수정 없음).
const s2t = rd('../src/data/situationToTd.json')

// PARENT_WEIGHT_TYPES = matchTd.js:17 정본과 동일(⑦가중 트리거). 하네스가 재선언(그 파일은 미export).
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

const scenes = Object.keys(bp).filter((k) => !k.startsWith('_'))
const childTypes = Object.keys(cta).filter((k) => !k.startsWith('_')) // 8, cta 순서

const childHas = (s, ct) => bp[s].child.some((it) => it.typeKey === ct)
const parentHas = (s, pt) => bp[s].parent.some((it) => it.typeKey === pt)
const childRep = (s, ct) => bp[s].child.find((it) => it.typeKey === ct)?.rep ?? null
const parentRep = (s, pt) => bp[s].parent.find((it) => it.typeKey === pt)?.rep ?? null

// [C-10 10편 ④] 입력 문장 변형 선택: 기본 rep, --variant=expand0 이면 expand[0] 사용.
//  ★ matchTd.js 무변경 — 하네스가 넣는 childText/parentText 문장만 교체(관찰). expand[1]은 미실행.
const VARIANT = (process.argv.find((a) => a.startsWith('--variant=')) ?? '').split('=')[1] || 'rep'
const childItem = (s, ct) => bp[s].child.find((it) => it.typeKey === ct)
const parentItem = (s, pt) => bp[s].parent.find((it) => it.typeKey === pt)
const missingExpand0 = [] // expand[0] 없는 (scene,type) — 지어내지 않고 그대로 보고(§3)
// ★ expand0 없으면 null 반환(무추론). 유효조합만 다루므로 typeKey 자체는 존재.
const childTextFor = (s, ct) =>
  VARIANT === 'expand0' ? childItem(s, ct)?.expand?.[0] ?? null : childItem(s, ct)?.rep ?? null
const parentTextFor = (s, pt) =>
  VARIANT === 'expand0' ? parentItem(s, pt)?.expand?.[0] ?? null : parentItem(s, pt)?.rep ?? null

// ── ① 키 일치 확인 ──
const bpChildUnion = [...new Set(scenes.flatMap((s) => bp[s].child.map((it) => it.typeKey)))]
const ctaNotInBp = childTypes.filter((k) => !bpChildUnion.includes(k))
const bpNotInCta = bpChildUnion.filter((k) => !childTypes.includes(k))
const keyCheck = {
  childTypeToAxisKeys: childTypes,
  behaviorPoolChildUnion: bpChildUnion,
  ctaNotInBehaviorPool: ctaNotInBp,
  behaviorPoolNotInCta: bpNotInCta,
  fullMatch: ctaNotInBp.length === 0 && bpNotInCta.length === 0,
  axisLookup: Object.fromEntries(childTypes.map((k) => [k, cta[k] ?? '⚠️UNDEFINED'])),
}

// ── 표1: 장면별 지도 (behaviorPool 직접 읽어서) ──
const table1 = scenes.map((s) => ({
  scene: s,
  child: bp[s].child.map((it) => ({ typeKey: it.typeKey, axis: cta[it.typeKey] ?? '⚠️UNDEFINED' })),
  parent: bp[s].parent.map((it) => it.typeKey),
}))

// ── 표2: 8×5 도달가능성 그리드 (축소는 childText 무관 → 40칸 전부 산출) ──
const grid = []
for (const s of scenes) {
  for (const ct of childTypes) {
    const reachable = childHas(s, ct)
    const r = matchTdToInput({
      scene: s,
      childType: ct,
      childText: reachable ? childRep(s, ct) : null,
      parentType: null,
      parentText: null,
    })
    const m = r._metrics
    grid.push({
      scene: s,
      childType: ct,
      reachable,
      axisSource: m.axisSource,
      axisUsed: m.axisUsed,
      poolAfterScene: m.poolSizeAfterScene,
      poolAfterAxis: m.poolSizeAfterAxis,
      narrowed: m.narrowed,
    })
  }
}

// ── 유효조합 열거 (하네스가 직접 셈): child·parent 모두 behaviorPool에 존재 + parent∈PWT ──
const valid = []
for (const s of scenes) {
  for (const ct of childTypes) {
    if (!childHas(s, ct)) continue
    for (const pt of PARENT_WEIGHT_TYPES) {
      if (!parentHas(s, pt)) continue
      if (VARIANT === 'expand0') {
        if (childItem(s, ct)?.expand?.[0] == null) missingExpand0.push({ scene: s, childType: ct, side: 'child' })
        if (parentItem(s, pt)?.expand?.[0] == null) missingExpand0.push({ scene: s, parentType: pt, side: 'parent' })
      }
      valid.push({
        scene: s,
        childType: ct,
        parentType: pt,
        childText: childTextFor(s, ct),
        parentText: parentTextFor(s, pt),
      })
    }
  }
}

// ── 유효조합 실측 (format 기본 'adult' — App.jsx:216과 동일하게 2번째 인자 없음) ──
const results = valid.map((v) => {
  const r = matchTdToInput({
    scene: v.scene,
    childType: v.childType,
    childText: v.childText,
    parentType: v.parentType,
    parentText: v.parentText,
  })
  return { input: v, num: r.num, score: r.score, matchedBy: r.matchedBy ?? null, unmatched: !!r.unmatched, _metrics: r._metrics }
})

// ── 집계 ──
const N = results.length
const pct = (n) => ((100 * n) / N).toFixed(1) + '%'
const avg = (arr) => (arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length) : 0)

// 표3 전체
const tiedCounts = results.map((r) => r._metrics.tiedAtTop)
const gap0 = results.filter((r) => r._metrics.scoreGap === 0).length
const gaps = results.map((r) => r._metrics.scoreGap).filter((g) => g !== null)
const unmatched = results.filter((r) => r._metrics.result === 'unmatched').length
const top1scoreDist = {}
for (const r of results) {
  const t = r._metrics.top3[0]?.score ?? 0
  top1scoreDist[t] = (top1scoreDist[t] || 0) + 1
}
const table3 = {
  N,
  tied1: pct(tiedCounts.filter((t) => t === 1).length),
  tied2: pct(tiedCounts.filter((t) => t === 2).length),
  tied3plus: pct(tiedCounts.filter((t) => t >= 3).length),
  gap0: pct(gap0),
  gapAvg: avg(gaps).toFixed(3),
  top1scoreDist,
  unmatched: pct(unmatched),
}

// 표3 childType별
const byChild = {}
for (const ct of childTypes) {
  const rs = results.filter((r) => r.input.childType === ct)
  if (!rs.length) {
    byChild[ct] = { n: 0, tied3plus: '-', gap0: '-', unmatched: '-' }
    continue
  }
  byChild[ct] = {
    n: rs.length,
    tied3plus: ((100 * rs.filter((r) => r._metrics.tiedAtTop >= 3).length) / rs.length).toFixed(1) + '%',
    gap0: ((100 * rs.filter((r) => r._metrics.scoreGap === 0).length) / rs.length).toFixed(1) + '%',
    unmatched: ((100 * rs.filter((r) => r._metrics.result === 'unmatched').length) / rs.length).toFixed(1) + '%',
  }
}

// 표4 신호원별 기여
const contribAvg = {
  scene: avg(results.map((r) => r._metrics.contribBySource.scene)),
  childText: avg(results.map((r) => r._metrics.contribBySource.childText)),
  parentText: avg(results.map((r) => r._metrics.contribBySource.parentText)),
}
const contribZero = {
  scene: pct(results.filter((r) => r._metrics.contribBySource.scene === 0).length),
  childText: pct(results.filter((r) => r._metrics.contribBySource.childText === 0).length),
  parentText: pct(results.filter((r) => r._metrics.contribBySource.parentText === 0).length),
}

// contribBySource 합 vs score 불일치(= 승자 ⑦가중 기대) 분포
const mismatchDist = {}
for (const r of results) {
  const sum = r._metrics.contribBySource.scene + r._metrics.contribBySource.childText + r._metrics.contribBySource.parentText
  const d = r.score - sum
  mismatchDist[d] = (mismatchDist[d] || 0) + 1
}

// 표6: ⑦가중 40건 집계 (신설 — 10편). ★ matchTd.js 무변경 — 이미 계산된 _metrics.weightApplied를 읽어 집계만.
//  screenWeight(스마트폰 3건 방어 체크)와 완전히 별개: 이건 results(유효조합 40건) 전수 집계다.
const waVals = results.map((r) => r._metrics.weightApplied)
const sevenEmpty = (s) => (s2t[s]?.['7'] ?? []).length === 0
const rateZero = (rs) =>
  rs.length ? ((100 * rs.filter((r) => r._metrics.weightApplied === 0).length) / rs.length).toFixed(1) + '%' : '-'
const weight40 = {
  avg: avg(waVals),
  zeroRate: pct(waVals.filter((v) => v === 0).length),
  byScene: scenes.map((s) => {
    const rs = results.filter((r) => r.input.scene === s)
    return { scene: s, sevenEmpty: sevenEmpty(s), n: rs.length, avg: avg(rs.map((r) => r._metrics.weightApplied)), zeroRate: rateZero(rs) }
  }),
  byParentType: PARENT_WEIGHT_TYPES.map((pt) => {
    const rs = results.filter((r) => r.input.parentType === pt)
    return { parentType: pt, n: rs.length, avg: avg(rs.map((r) => r._metrics.weightApplied)), zeroRate: rateZero(rs) }
  }),
}

// 표5 노이즈: matchedTokens 빈도 (token → {count, 예시 title})
const tokenFreq = {}
for (const r of results) {
  for (const tk of r._metrics.matchedTokens) {
    if (!tokenFreq[tk]) tokenFreq[tk] = { count: 0, sampleTitle: '' }
    tokenFreq[tk].count++
    if (!tokenFreq[tk].sampleTitle) {
      const td = r.num
      tokenFreq[tk].sampleTitle = `(td${td}) ${r._metrics.top3[0] ? '' : ''}`
    }
  }
}

// 특수: 스마트폰·게임 weightApplied (PWT 3종 전부 — 도달 여부 무관하게 확인)
const screenScene = '스마트폰·게임'
const screenChildSample = bp[screenScene].child[0].typeKey // 아무 유효 child
const screenWeight = PARENT_WEIGHT_TYPES.map((pt) => {
  const r = matchTdToInput({
    scene: screenScene,
    childType: screenChildSample,
    childText: childRep(screenScene, screenChildSample),
    parentType: pt,
    parentText: parentRep(screenScene, pt) ?? '(behaviorPool에 없음)',
  })
  return { parentType: pt, parentInPool: parentHas(screenScene, pt), weightApplied: r._metrics.weightApplied }
})

// ── 출력 준비 (stdout 전용) ──
// [계측 전용] 출력은 stdout만. ★ 파일·폴더 생성 금지 —
//  리포 안에 docs/를 만들면 Vite EBUSY (00_README 4줄). 저장은 대표가 리다이렉트로 리포 밖에.
const now = new Date()
const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`

const jsonOut = {
  generatedAt: now.toISOString(),
  format: 'adult',
  variant: VARIANT, // [④] rep | expand0
  expand0Missing: missingExpand0, // [④] expand0 없는 조합(있으면). 비어있으면 전 조합 존재
  keyCheck,
  validComboCount: N,
  table1_sceneMap: table1,
  table2_reachabilityGrid: grid,
  table3_ranking: { overall: table3, byChildType: byChild },
  table4_contribution: { avg: contribAvg, zeroRate: contribZero, scoreMinusContribSumDist: mismatchDist },
  table5_tokenFreq: tokenFreq,
  table6_weightApplied40: weight40,
  screenWeightCheck: screenWeight,
  results,
}

// ── Markdown ──
const md = []
const P = (...x) => md.push(x.join(''))
P(`# C-10 매칭 계측 — ${VARIANT === 'expand0' ? 'expand[0] 변형' : 'rep(대표문장)'} · ${ymd}`)
P('')
P('> 9편 계측 하네스(기획 창 보정본) 산출. matchTd.js 판정 로직 무변경, _metrics 관찰값만.')
P(`> format=\`adult\`(App.jsx:216 무인자 호출). childText/parentText=behaviorPool ${VARIANT}. 유효조합 실측=${N}건.`)
if (VARIANT === 'expand0')
  P(`> expand[0] 누락 조합: ${missingExpand0.length ? JSON.stringify(missingExpand0) : '없음(전 유효조합에 expand[0] 존재)'}`)
P('')
P(`## ① childTypeToAxis ↔ behaviorPool child 키 일치: **${keyCheck.fullMatch ? '완전 일치 ✅' : '불일치 ⚠️'}**`)
P(`- cta에만: ${JSON.stringify(keyCheck.ctaNotInBehaviorPool)} / behaviorPool에만: ${JSON.stringify(keyCheck.behaviorPoolNotInCta)}`)
P(`- 축 조회 undefined: ${Object.values(keyCheck.axisLookup).includes('⚠️UNDEFINED') ? '있음 ⚠️' : '없음(8종 전부 유효)'}`)
P('')
P('## 표1. 장면별 지도 (behaviorPool 직접)')
P('')
P('| 장면 | child 종류 → 축(childTypeToAxis) | parent 종류 |')
P('|---|---|---|')
for (const t of table1) {
  const c = t.child.map((x) => `${x.typeKey}→${JSON.stringify(x.axis)}`).join(' / ')
  P(`| ${t.scene} | ${c} | ${t.parent.join(' / ')} |`)
}
P('')
P('## 표2. 8×5 도달가능성 + 축소 (40칸)')
P('')
P('| 장면 | childType | 도달 | axisSrc | axisUsed | poolAfterScene | poolAfterAxis | narrowed |')
P('|---|---|:--:|---|---|--:|--:|:--:|')
for (const g of grid) {
  P(`| ${g.scene} | ${g.childType} | ${g.reachable ? '가능' : '불가(참고)'} | ${g.axisSource} | ${JSON.stringify(g.axisUsed)} | ${g.poolAfterScene} | ${g.poolAfterAxis} | ${g.narrowed} |`)
}
P('')
P(`> 도달 가능 셀 = behaviorPool에 (scene,childType) 존재. 도달가능 20 / 불가 20. 축소값은 childText 무관이라 40칸 모두 산출되나, **불가 셀은 참고용**(App 미도달).`)
P('')
P(`## 표3. 서열 (유효 ${N}건)`)
P('')
P('| 지표 | 값 |')
P('|---|---|')
P(`| tiedAtTop=1 (1등 단독) | ${table3.tied1} |`)
P(`| tiedAtTop=2 | ${table3.tied2} |`)
P(`| **tiedAtTop≥3** | **${table3.tied3plus}** |`)
P(`| **scoreGap=0** | **${table3.gap0}** |`)
P(`| scoreGap 평균 | ${table3.gapAvg} |`)
P(`| top1.score 분포 | ${JSON.stringify(table3.top1scoreDist)} |`)
P(`| **unmatched 비율** | **${table3.unmatched}** |`)
P('')
P('### 표3-b. childType별')
P('')
P('| childType | n | tiedAtTop≥3 | scoreGap=0 | unmatched |')
P('|---|--:|---|---|---|')
for (const ct of childTypes) {
  const b = byChild[ct]
  P(`| ${ct} | ${b.n} | ${b.tied3plus} | ${b.gap0} | ${b.unmatched} |`)
}
P('')
P('## 표4. 신호원별 기여 (Q1·Q3 판정 근거)')
P('')
P('| 신호원 | 평균 기여 | 기여 0 비율 |')
P('|---|--:|---|')
P(`| scene | ${contribAvg.scene.toFixed(3)} | ${contribZero.scene} |`)
P(`| **childText** | **${contribAvg.childText.toFixed(3)}** | ${contribZero.childText} |`)
P(`| parentText | ${contribAvg.parentText.toFixed(3)} | ${contribZero.parentText} |`)
P('')
P(`> ★ 판정선: childText 평균 기여 ${contribAvg.childText < 0.5 ? '< 0.5 → C-107은 C-10 선결 아님' : contribAvg.childText >= 1 ? '≥ 1 → C-107 선결' : '0.5~1 사이(경계)'} (실측 ${contribAvg.childText.toFixed(3)}).`)
P(`> App.jsx:215 주석("childText 매칭 미사용") vs matchTd.js:110 실제 사용 불일치의 실제 영향 = childText 평균 기여 ${contribAvg.childText.toFixed(3)}점.`)
P(`> score − Σcontrib 분포(=승자 ⑦가중 기대): ${JSON.stringify(mismatchDist)}`)
P('')
P('## 표5. 노이즈 (matchedTokens 빈도 — 우연겹침 관찰)')
P('')
P('| 토큰 | 겹친 횟수 |')
P('|---|--:|')
for (const [tk, info] of Object.entries(tokenFreq).sort((a, b) => b[1].count - a[1].count)) {
  P(`| ${tk} | ${info.count} |`)
}
P('')
P('> ★ 우연겹침 판정은 관찰만(확정은 기획 창). 빌드 창 주석은 인계 메모에.')
P('')
P('## 표6: ⑦가중 40건 집계 (신설 — 10편)')
P('')
P('| 지표 | 값 |')
P('|---|---|')
P(`| weightApplied 평균 | ${weight40.avg.toFixed(3)} |`)
P(`| weightApplied=0 비율 | ${weight40.zeroRate} |`)
P('')
P("### 표6-b. 장면별 (sceneMap['7'] 빈 장면 구분)")
P('')
P("| 장면 | 7축 빈배열? | n | weightApplied 평균 | =0 비율 |")
P('|---|:--:|--:|--:|---|')
for (const s of weight40.byScene) P(`| ${s.scene} | ${s.sevenEmpty ? '빈배열' : '있음'} | ${s.n} | ${s.avg.toFixed(3)} | ${s.zeroRate} |`)
P('')
P('### 표6-c. parentType별 (PWT 3종)')
P('')
P('| parentType | n | weightApplied 평균 | =0 비율 |')
P('|---|--:|--:|---|')
for (const p of weight40.byParentType) P(`| ${p.parentType} | ${p.n} | ${p.avg.toFixed(3)} | ${p.zeroRate} |`)
P('')
P(`> ★ 40건 전수 실측(아래 screenWeight 3건 방어 체크와 별개). weightApplied 평균 ${weight40.avg.toFixed(3)} / =0 ${weight40.zeroRate}.`)
P("> ★ 7축 '있음'인 장면도 weightApplied=0이면: (3)축소가 childType 축(1~6)으로 pool을 줄여 ⑦축 td를 먼저 제외하기 때문(빈배열이 원인이 아님).")
P('')
P('## 특수: 스마트폰·게임 weightApplied (⑦축 빈배열 방어 확인 — 40건 집계 아님)')
P('')
P('| parentType | behaviorPool 존재 | weightApplied |')
P('|---|:--:|--:|')
for (const w of screenWeight) P(`| ${w.parentType} | ${w.parentInPool ? '있음' : '없음' } | ${w.weightApplied} |`)
P('')
P(`> 기대: 스마트폰·게임 sceneMap['7']=[] → 전 parentType에서 weightApplied=0. 실측: ${screenWeight.every((w) => w.weightApplied === 0) ? '전부 0 ✅ (설계상 정상)' : '0 아님 ⚠️ 보고필요'}`)

// ── 출력 선택 (CLI): 기본 md, --json 시 JSON. 둘 다 stdout으로만 ──
// [계측 전용] 출력은 stdout만. ★ 파일·폴더 생성 금지 — 리포 안에 docs/를 만들면 Vite EBUSY (00_README 4줄)
//  저장은 하네스가 아니라 대표가 리다이렉트로 리포 밖에: node scripts/matchHarness.mjs > "…\11_계측\matchAfter.md"
if (process.argv.includes('--json')) {
  console.log(JSON.stringify(jsonOut, null, 2))
} else {
  process.stdout.write(md.join('\n') + '\n')
}

// ── 요약 (stderr — stdout 리다이렉트 오염 방지) ──
console.error('=== C-10 매칭 계측 요약 (stderr) ===')
console.error('variant:', VARIANT, '| expand0 누락:', missingExpand0.length ? JSON.stringify(missingExpand0) : '없음')
console.error('키 일치:', keyCheck.fullMatch, '| 축 undefined:', Object.values(keyCheck.axisLookup).includes('⚠️UNDEFINED'))
console.error('유효조합 실측 개수:', N)
console.error('표3: tied≥3', table3.tied3plus, '| gap=0', table3.gap0, '| unmatched', table3.unmatched, '| top1분포', JSON.stringify(table3.top1scoreDist))
console.error('표4: contribAvg', JSON.stringify({ scene: +contribAvg.scene.toFixed(3), childText: +contribAvg.childText.toFixed(3), parentText: +contribAvg.parentText.toFixed(3) }))
console.error('score−Σcontrib 분포:', JSON.stringify(mismatchDist))
console.error('표6(신설) ⑦가중 40건: 평균', weight40.avg.toFixed(3), '| =0', weight40.zeroRate)
console.error('스마트폰 weightApplied(방어체크·3건):', JSON.stringify(screenWeight.map((w) => w.weightApplied)))
console.error('출력: stdout (기본 md, --json 시 JSON). 하네스는 파일을 만들지 않음 — 저장은 리다이렉트로 리포 밖에.')
