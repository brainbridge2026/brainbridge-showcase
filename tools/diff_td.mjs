// 새 변환 결과(td_json_new) vs 기존(td_json) 비교.
//   각 파일에서 어떤 top-level / sections 키가 달라졌는지 요약.
import fs from 'fs'
import path from 'path'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..')
const OLD = path.join(ROOT, 'public', 'td_json')
const NEW = path.join(ROOT, 'public', 'td_json_new')

const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b)

const files = fs.readdirSync(NEW).filter((f) => /^td\d+\.json$/.test(f))
files.sort((a, b) => Number(a.match(/\d+/)) - Number(b.match(/\d+/)))

const summary = {}
for (const f of files) {
  const n = JSON.parse(fs.readFileSync(path.join(NEW, f), 'utf8'))
  const oPath = path.join(OLD, f)
  if (!fs.existsSync(oPath)) {
    summary[f] = ['(기존 없음)']
    continue
  }
  const o = JSON.parse(fs.readFileSync(oPath, 'utf8'))
  const changes = []

  // top-level 키 (sections 제외)
  const topKeys = new Set([...Object.keys(o), ...Object.keys(n)].filter((k) => k !== 'sections'))
  for (const k of topKeys) {
    if (!eq(o[k], n[k])) {
      if (!(k in o)) changes.push(`+${k}`)
      else if (!(k in n)) changes.push(`-${k}`)
      else changes.push(`~${k}`)
    }
  }
  // sections 키
  const os = o.sections ?? {}
  const ns = n.sections ?? {}
  const secKeys = new Set([...Object.keys(os), ...Object.keys(ns)])
  for (const k of secKeys) {
    if (!eq(os[k], ns[k])) {
      if (!(k in os)) changes.push(`+sec.${k}`)
      else if (!(k in ns)) changes.push(`-sec.${k}`)
      else changes.push(`~sec.${k}`)
    }
  }
  summary[f] = changes.length ? changes : ['(동일)']
}

// 변경 패턴별 집계
const patterns = {}
for (const [f, ch] of Object.entries(summary)) {
  const key = ch.join(', ')
  ;(patterns[key] ??= []).push(f.replace('.json', ''))
}
console.log('=== 변경 패턴별 집계 ===')
for (const [pat, fs2] of Object.entries(patterns)) {
  console.log(`\n[${pat}]  (${fs2.length}개)`)
  console.log('  ' + fs2.join(', '))
}
