// ─────────────────────────────────────────────────────────────────────────
// expressionPoolCheck.mjs — Sprint 19 · 회고② 내표현 avoid풀 25개 전수 자동검증 (신규)
//   실행: node scripts/expressionPoolCheck.mjs
//   E-1 pool 최상위 장면 키 5개 = texts.situation.options 5개 완전 일치(집합 동일)
//   E-2 각 장면 배열 길이 = 5 · 총 25개
//   E-3 25개 전부 비어있지 않은 문자열
//   E-4 25개 중복 0
//   E-5 25개가 C-50 확정본 원문과 문자 단위 일치(스크립트 상수 === 전수 비교)
//   E-6 texts.conflict.expression.options 심볼 부재(임시 공통 제거)
//   E-7 otherOption = '그 외' 유지
//   ★ 사람 눈 개입 없이 판정. FAIL 1건이라도 있으면 비영 종료.
// ─────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve, join } from 'path'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..')

// ── texts.js 로드 (korean.js의 export 함수를 인라인해 raw Node에서 평가) ──
const koreanSrc = readFileSync(join(repoRoot, 'src', 'utils', 'korean.js'), 'utf8').replace(/export\s+function/g, 'function')
let textsSrc = readFileSync(join(repoRoot, 'src', 'texts.js'), 'utf8')
textsSrc = textsSrc.replace(/import\s*\{[^}]*\}\s*from\s*['"]\.\/utils\/korean['"]\s*;?/, '')
const combined = koreanSrc + '\n' + textsSrc
const mod = await import('data:text/javascript;base64,' + Buffer.from(combined, 'utf8').toString('base64'))
const texts = mod.texts

// ── expressionPool.json 로드 ──
const pool = JSON.parse(readFileSync(join(repoRoot, 'src', 'data', 'expressionPool.json'), 'utf8'))
const scenes = Object.keys(pool).filter((k) => !k.startsWith('_'))

// ── E-5 기대값: C-50 확정본 §3 원문 25개 (docs/03_콘텐츠자산/…avoid풀_확정본_v1.md) ──
const EXPECTED = {
  '숙제·공부': ['숙제하라고 몇 번 말해야 해?', '넌 공부만 하면 왜 이 모양이야?', '빨리 문제집 펴.', '숙제까지 엄마가 챙겨야 해?', '이제 숙제는 네가 알아서 해.'],
  '정리·청소': ['치우라고 몇 번 말해야 해?', '넌 왜 맨날 어질러?', '빨리 좀 치워.', '정리도 엄마가 다 해야 해?', '이제 네 방은 네가 알아서 해.'],
  '등교·외출 준비': ['준비하라고 몇 번 말해야 해?', '넌 왜 맨날 늦어?', '빨리 준비해.', '준비도 엄마가 다 해줘야 해?', '이제 준비는 네가 알아서 해.'],
  '스마트폰·게임': ['끄라고 몇 번 말해야 해?', '넌 게임만 하면 왜 이 모양이야?', '빨리 안 꺼?', '끄는 것까지 엄마가 해야 해?', '이제 하고 싶은 대로 해.'],
  '밥·잠 등 생활습관': ['몇 번을 말해야 해?', '넌 왜 맨날 제시간에 못 해?', '빨리 좀 해.', '이것까지 엄마가 챙겨야 해?', '이제 알아서 해.'],
}

let pass = 0, fail = 0
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log('PASS', name, detail) }
  else { fail++; console.log('FAIL', name, detail) }
}

// E-1
const poolKeys = [...scenes].sort()
const situationOpts = [...texts.situation.options].sort()
check('E-1 pool 장면키 == texts.situation.options (집합 동일)',
  poolKeys.length === situationOpts.length && poolKeys.every((k, i) => k === situationOpts[i]),
  `pool=${JSON.stringify(scenes)} situation=${JSON.stringify(texts.situation.options)}`)

// E-2
let total = 0
let e2 = true
for (const s of scenes) { const len = pool[s].length; total += len; if (len !== 5) e2 = false }
check('E-2 각 장면 5개 · 총 25개', e2 && total === 25, `total=${total}`)

// E-3
const all = scenes.flatMap((s) => pool[s])
check('E-3 25개 전부 비어있지 않은 문자열', all.length === 25 && all.every((x) => typeof x === 'string' && x.length > 0))

// E-4
const uniq = new Set(all)
check('E-4 25개 중복 0', uniq.size === all.length, `unique=${uniq.size}/${all.length}`)

// E-5 (문자 단위 === 전수)
let e5mismatch = []
for (const s of scenes) {
  const exp = EXPECTED[s]
  if (!exp) { e5mismatch.push(`${s}: 기대값 장면 없음`); continue }
  for (let i = 0; i < 5; i++) {
    if (pool[s][i] !== exp[i]) e5mismatch.push(`${s}[${i}] "${pool[s][i]}" !== "${exp[i]}"`)
  }
}
check(`E-5 25개 C-50 원문 문자단위 일치 (${25 - e5mismatch.length}/25)`, e5mismatch.length === 0, e5mismatch.join(' | '))

// E-6
check('E-6 texts.conflict.expression.options 부재', texts.conflict.expression.options === undefined,
  `options=${JSON.stringify(texts.conflict.expression.options)}`)

// E-7
check("E-7 otherOption == '그 외'", texts.conflict.expression.otherOption === '그 외',
  `otherOption=${JSON.stringify(texts.conflict.expression.otherOption)}`)

console.log(`\n== expressionPoolCheck: ${pass} passed, ${fail} failed ==`)
if (fail > 0) process.exit(1)
