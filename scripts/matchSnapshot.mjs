// ─────────────────────────────────────────────────────────────────────────
// matchSnapshot.mjs — Sprint 19 · 80조합 매칭 스냅샷 러너 (신규 · matchHarness 무변경)
//   실행: node scripts/matchSnapshot.mjs --out <경로> [--phase before|after] [--commit <hash>]
//   목적: before/after 각 1회 실행해 5장면×4child×4parent=80조합의 (num·score·tiedAtTop)만 스냅샷.
//   ★ matchTd.js 판정 로직 무변경. esbuild 미사용 · 의존성 추가 0.
//     matchTd.js의 bare JSON import 4개만 readFileSync+JSON.parse 인라인 후 data: URL로 동적 import.
//     (matchTd.js 함수 본문은 바이트 동일 — import 결선 방식만 Node 호환으로 치환)
//   ★ 원천 = behaviorPool[scene].child × behaviorPool[scene].parent 직접 순회(matchHarness와 동일 방식).
//   ★ childText/parentText = 각 항목 rep. format='adult'(무인자 호출과 동일).
// ─────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join, isAbsolute, resolve } from 'path'
import { execSync } from 'child_process'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..')

// ── CLI 파싱 ──
const argv = process.argv.slice(2)
function argOf(name) {
  const i = argv.indexOf(name)
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : null
}
const out = argOf('--out')
if (!out) {
  console.error('usage: node scripts/matchSnapshot.mjs --out <path> [--phase before|after] [--commit <hash>]')
  process.exit(2)
}
let phase = argOf('--phase')
if (!phase) {
  const lo = out.toLowerCase()
  phase = lo.includes('before') ? 'before' : lo.includes('after') ? 'after' : 'snapshot'
}
let commit = argOf('--commit')
if (!commit) {
  try { commit = execSync('git rev-parse HEAD', { cwd: repoRoot }).toString().trim() } catch { commit = 'UNKNOWN' }
}

// ── matchTd.js 로드 (bare JSON import 인라인 · 판정 로직 무변경) ──
const mtPath = join(repoRoot, 'src', 'utils', 'matchTd.js')
let src = readFileSync(mtPath, 'utf8')
const importRe = /import\s+([A-Za-z_$][\w$]*)\s+from\s+['"]([^'"]+\.json)['"]\s*;?/g
let m
const inlined = []
while ((m = importRe.exec(src)) !== null) inlined.push({ name: m[1], rel: m[2], full: m[0] })
for (const it of inlined) {
  const jsonPath = resolve(dirname(mtPath), it.rel)
  const jsonText = readFileSync(jsonPath, 'utf8')
  src = src.replace(it.full, `const ${it.name} = ${jsonText};`)
}
// 남은 상대 import(비-JSON)가 있으면 이 러너로는 안전하게 로드 불가 → 중단(무추론).
if (/^\s*import\s+.*from\s+['"]\.\.?\//m.test(src)) {
  console.error('ERROR: matchTd.js has non-JSON relative imports; cannot inline safely. Aborting (no guess).')
  process.exit(3)
}
const mod = await import('data:text/javascript;base64,' + Buffer.from(src, 'utf8').toString('base64'))
const matchTdToInput = mod.matchTdToInput
if (typeof matchTdToInput !== 'function') { console.error('ERROR: matchTdToInput not found'); process.exit(3) }

// ── behaviorPool 로드 + 80조합 순회 ──
const bp = JSON.parse(readFileSync(join(repoRoot, 'src', 'data', 'behaviorPool.json'), 'utf8'))
const scenes = Object.keys(bp).filter((k) => !k.startsWith('_'))
const records = []
for (const scene of scenes) {
  for (const c of bp[scene].child) {
    for (const p of bp[scene].parent) {
      const childType = c.typeKey
      const parentType = p.typeKey
      const r = matchTdToInput({ scene, childType, childText: c.rep, parentType, parentText: p.rep })
      const met = r._metrics
      records.push({
        key: `${scene}|${childType}|${parentType}`,
        scene, childType, parentType,
        num: r.num ?? null,
        score: r.score,
        tiedAtTop: met.tiedAtTop,
      })
    }
  }
}

// ── 출력 ──
const payload = {
  meta: { commit, phase, generatedAt: new Date().toISOString(), format: 'adult' },
  records,
}
const outPath = isAbsolute(out) ? out : resolve(repoRoot, out)
mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8')
console.error(`matchSnapshot: phase=${phase} records=${records.length} commit=${commit.slice(0, 12)} -> ${outPath}`)
