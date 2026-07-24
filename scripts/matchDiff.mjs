// ─────────────────────────────────────────────────────────────────────────
// matchDiff.mjs — Sprint 19 · before/after 80조합 스냅샷 비교 (신규 · GPT PM 정정 4)
//   실행: node scripts/matchDiff.mjs --before <before.json> --after <after.json> --out <match_diff.json>
//   필수 stdout 7지표:
//     records_before= records_after= num_mismatch= score_mismatch= tiedAtTop_mismatch= missing_keys= extra_keys=
//   ★ 차이 1건이라도 있으면 전수(MISMATCH ...) 출력 후 비영 종료코드로 종료(§E④ 정지조건).
//   ★ num:null ↔ null = 일치. null ↔ 숫자 = 불일치.
// ─────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { dirname, resolve, isAbsolute } from 'path'

const argv = process.argv.slice(2)
function argOf(name) { const i = argv.indexOf(name); return i >= 0 && i + 1 < argv.length ? argv[i + 1] : null }
const beforePath = argOf('--before')
const afterPath = argOf('--after')
const outPath = argOf('--out')
if (!beforePath || !afterPath || !outPath) {
  console.error('usage: node scripts/matchDiff.mjs --before <b.json> --after <a.json> --out <diff.json>')
  process.exit(2)
}
const rd = (p) => JSON.parse(readFileSync(isAbsolute(p) ? p : resolve(process.cwd(), p), 'utf8'))
const before = rd(beforePath)
const after = rd(afterPath)

const bRec = before.records || []
const aRec = after.records || []
const bMap = new Map(bRec.map((r) => [r.key, r]))
const aMap = new Map(aRec.map((r) => [r.key, r]))

const eqVal = (x, y) => {
  // null ↔ null 일치, null ↔ 숫자 불일치
  if (x === null || x === undefined) return y === null || y === undefined
  if (y === null || y === undefined) return false
  return x === y
}

const mismatches = []
let num_mismatch = 0, score_mismatch = 0, tiedAtTop_mismatch = 0
for (const [key, b] of bMap) {
  const a = aMap.get(key)
  if (!a) continue // missing handled below
  if (!eqVal(b.num, a.num)) { num_mismatch++; mismatches.push(`MISMATCH ${key} num: ${b.num} -> ${a.num}`) }
  if (!eqVal(b.score, a.score)) { score_mismatch++; mismatches.push(`MISMATCH ${key} score: ${b.score} -> ${a.score}`) }
  if (!eqVal(b.tiedAtTop, a.tiedAtTop)) { tiedAtTop_mismatch++; mismatches.push(`MISMATCH ${key} tiedAtTop: ${b.tiedAtTop} -> ${a.tiedAtTop}`) }
}
const missing_keys = [...bMap.keys()].filter((k) => !aMap.has(k)).length
const extra_keys = [...aMap.keys()].filter((k) => !bMap.has(k)).length

// ── 7지표 stdout (그대로 Evidence 수록) ──
const lines = [
  `records_before=${bRec.length}`,
  `records_after=${aRec.length}`,
  `num_mismatch=${num_mismatch}`,
  `score_mismatch=${score_mismatch}`,
  `tiedAtTop_mismatch=${tiedAtTop_mismatch}`,
  `missing_keys=${missing_keys}`,
  `extra_keys=${extra_keys}`,
]
console.log(lines.join('\n'))

const diff = {
  meta: { beforeCommit: before.meta?.commit ?? null, afterCommit: after.meta?.commit ?? null, generatedAt: new Date().toISOString() },
  metrics: {
    records_before: bRec.length, records_after: aRec.length,
    num_mismatch, score_mismatch, tiedAtTop_mismatch, missing_keys, extra_keys,
  },
  mismatches,
}
const op = isAbsolute(outPath) ? outPath : resolve(process.cwd(), outPath)
mkdirSync(dirname(op), { recursive: true })
writeFileSync(op, JSON.stringify(diff, null, 2), 'utf8')

const total = num_mismatch + score_mismatch + tiedAtTop_mismatch + missing_keys + extra_keys
if (total > 0) {
  for (const line of mismatches) console.log(line)
  console.error(`matchDiff: ${total} discrepancies -> STOP (§E④). exit 1`)
  process.exit(1)
}
console.error('matchDiff: 0 discrepancies (매칭 무영향 확인)')
