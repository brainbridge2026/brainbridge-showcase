// BrainBridge · td_json 재변환기
//   소스: docs/BrainBridge_content_full_confirmed_v4.md
//   각 td를 파싱해 public/td_json 구조로 출력한다.
//
// 이번 버전의 새 규칙:
//  - D블록 3-tier: `## D.`(또는 `## N. D.`)=tier2, `## D-구간1(5~7세)`=tier1, `## D-구간3(11세+)`=tier3
//      → sections.D = { tier1, tier2, tier3 } (있는 tier만)
//  - td111은 D′(부모 자기대화)=tier2, D″-구간1=tier1, D'-구간3=tier3 → sections.D_prime = { tier1, tier2, tier3 }
//      (프라임/아포스트로피가 아니라 "구간N" 라벨로 tier 판별)
//  - td10 등의 `## G. 그 순간(acute_response)` 블록 반영
//  - 메타(id/category/category_title/format)는 기존 td{N}.json에서 보존, title은 md에서.
//
// 사용법: node tools/convert_td.mjs [출력폴더]   (기본: public/td_json_new)

import fs from 'fs'
import path from 'path'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..')
// ⚠ [경로 주의] docs 폴더는 프로젝트 밖으로 이동됨(EBUSY 방지, 2026-07 masterplan_v6 잠금 사고).
//   아래 SRC의 'docs' 는 이제 존재하지 않는 옛 위치다.
//   → 재실행할 때만 새 위치로 고쳐라: C:\Users\Bhappy\OneDrive\Desktop\docs\...
//     예) const SRC = 'C:\\Users\\Bhappy\\OneDrive\\Desktop\\docs\\BrainBridge_content_full_confirmed_v5.md'
//   (평소엔 손대지 말 것 — 재변환이 필요한 시점에만 수정)
const SRC = path.join(ROOT, 'docs', 'BrainBridge_content_full_confirmed_v5.md')
const EXIST_DIR = path.join(ROOT, 'public', 'td_json')
const OUT_DIR = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(ROOT, 'public', 'td_json_new')

const md = fs.readFileSync(SRC, 'utf8')
const lines = md.split(/\r?\n/)

// ── 헬퍼 ─────────────────────────────────────────────
const isTable = (l) => /^\s*\|/.test(l)
const isSep = (l) => /^\s*\|[\s:|-]+\|?\s*$/.test(l) && l.includes('-')
const isHr = (l) => /^\s*-{3,}\s*$/.test(l)

function splitCells(l) {
  let s = l.trim()
  if (s.startsWith('|')) s = s.slice(1)
  if (s.endsWith('|')) s = s.slice(0, -1)
  return s.split('|').map((c) => c.trim())
}

// 본문 줄들 → { text?, tables? }
function parseBody(bodyLines) {
  const tables = []
  const textLines = []
  let i = 0
  while (i < bodyLines.length) {
    if (isTable(bodyLines[i])) {
      const block = []
      while (i < bodyLines.length && isTable(bodyLines[i])) {
        block.push(bodyLines[i])
        i++
      }
      const header = splitCells(block[0])
      let rowStart = 1
      if (block[1] && isSep(block[1])) rowStart = 2
      const rows = []
      for (let r = rowStart; r < block.length; r++) {
        const cells = splitCells(block[r])
        const obj = {}
        header.forEach((h, idx) => {
          obj[h] = cells[idx] ?? ''
        })
        rows.push(obj)
      }
      tables.push({ header, rows })
    } else {
      textLines.push(bodyLines[i])
      i++
    }
  }
  const text = textLines
    .filter((l) => !isHr(l))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  const out = {}
  if (text) out.text = text
  if (tables.length) out.tables = tables
  return out
}

function sectionObj(header, bodyLines) {
  return { header, ...parseBody(bodyLines) }
}

// 아빠 정민님용 3겹 블록(B2 / D'-정민님용) → { layer1, layer2, layer3 }
//  본문은 "**1겹 받아주기**: …", "**2겹 핵심이해**: …", "**3겹 깊은 근거**: …" 3줄.
//  레이어 라벨만 키로 치환하고, 2·3겹 안의 **소제목**: 은 내용이므로 그대로 유지.
function parseLayers(bodyLines) {
  const out = {}
  for (const l of bodyLines) {
    let m
    if ((m = l.match(/^\*\*\s*1겹[^*]*\*\*\s*:\s*(.*)$/))) out.layer1 = m[1].trim()
    else if ((m = l.match(/^\*\*\s*2겹[^*]*\*\*\s*:\s*(.*)$/))) out.layer2 = m[1].trim()
    else if ((m = l.match(/^\*\*\s*3겹[^*]*\*\*\s*:\s*(.*)$/))) out.layer3 = m[1].trim()
  }
  return out
}

// ### 하위 섹션 추출 (adult A / td101 A)
function extractSubsections(bodyLines) {
  const subs = []
  let cur = null
  for (const l of bodyLines) {
    const m = l.match(/^###\s+(.*)$/)
    if (m) {
      cur = { header: m[1].trim(), bodyLines: [] }
      subs.push(cur)
    } else if (cur) {
      cur.bodyLines.push(l)
    }
  }
  return subs
}

// 헤더 core (분류용): ■ 와 "N. " 접두 제거
function coreOf(header) {
  return header.replace(/^■\s*/, '').replace(/^\d+\.\s*/, '').trim()
}

function classify(core) {
  if (/^상황 기본 정보/.test(core)) return { type: 'situation_info' }
  if (/^G[.\s]/.test(core) || core === 'G') return { type: 'G' }
  if (/^A[-\d]/.test(core)) return { type: 'A_sub' }
  if (/^A[.\s]/.test(core) || core === 'A') return { type: 'A_main' }
  // 아빠 정민님용 3겹 (B / D 일반 판별보다 먼저 확인)
  if (/^B2\b/.test(core)) return { type: 'B2_dad' }
  if (/^D['′″’'"]*-?\s*정민님용/.test(core)) return { type: 'D_prime_dad' }
  if (/^B[.\s]/.test(core) || core === 'B') return { type: 'B' }
  if (/^C[.\s]/.test(core) || core === 'C') return { type: 'C' }
  if (/^E[.\s]/.test(core) || core === 'E') return { type: 'E' }
  if (/^F[.\s]/.test(core) || core === 'F') return { type: 'F' }
  if (/재사용 풀/.test(core)) return { type: 'reuse_pool' }
  const dm = core.match(/^D([′″'‘’"]*)/)
  if (dm) {
    const family = dm[1] && dm[1].length ? 'D_prime' : 'D'
    let tier = 2
    if (/구간\s*1/.test(core)) tier = 1
    else if (/구간\s*3/.test(core)) tier = 3
    return { type: 'D', family, tier }
  }
  return { type: 'unknown' }
}

function orderTiers(d) {
  const out = {}
  for (const t of ['tier1', 'tier2', 'tier3']) if (d[t]) out[t] = d[t]
  return out
}

// ── td 블록 경계: `# TD{N}.` 부터 다음 `# ` (단일 해시) 직전까지 ──
const tdStarts = []
lines.forEach((l, idx) => {
  const m = l.match(/^#\s+TD(\d+)\.\s*(.*)$/)
  if (m) tdStarts.push({ idx, num: Number(m[1]), title: m[2].trim() })
})

function blockEnd(startIdx) {
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (/^#\s/.test(lines[i])) return i
  }
  return lines.length
}

// ── 한 td 블록 파싱 ──
function parseTd(tdInfo) {
  const start = tdInfo.idx
  const end = blockEnd(start)

  // pre-section (첫 ## 이전) → intro_note
  let firstSecAt = -1
  const preLines = []
  for (let i = start + 1; i < end; i++) {
    if (/^##\s/.test(lines[i])) {
      firstSecAt = i
      break
    }
    preLines.push(lines[i])
  }
  const introText = preLines.filter((l) => l.trim() && !isHr(l)).join('\n').trim()

  // ## 섹션들 수집
  const rawSections = []
  if (firstSecAt >= 0) {
    let cur = null
    for (let i = firstSecAt; i < end; i++) {
      const m = lines[i].match(/^##\s+(.*)$/)
      if (m && !/^###/.test(lines[i])) {
        cur = { header: m[1].trim(), bodyLines: [] }
        rawSections.push(cur)
      } else if (cur) {
        cur.bodyLines.push(lines[i])
      }
    }
  }

  const sections = {}
  let i = 0
  while (i < rawSections.length) {
    const s = rawSections[i]
    const core = coreOf(s.header)
    const c = classify(core)
    switch (c.type) {
      case 'situation_info':
        sections.situation_info = sectionObj(s.header, s.bodyLines)
        i++
        break
      case 'G':
        sections.G = sectionObj(s.header, s.bodyLines)
        i++
        break
      case 'B':
        sections.B = sectionObj(s.header, s.bodyLines)
        i++
        break
      case 'B2_dad':
        sections.B2_dad = parseLayers(s.bodyLines)
        i++
        break
      case 'D_prime_dad':
        sections.D_prime_dad = parseLayers(s.bodyLines)
        i++
        break
      case 'C':
        sections.C = sectionObj(s.header, s.bodyLines)
        i++
        break
      case 'E':
        sections.E = sectionObj(s.header, s.bodyLines)
        i++
        break
      case 'F':
        sections.F = sectionObj(s.header, s.bodyLines)
        i++
        break
      case 'reuse_pool':
        sections.reuse_pool = sectionObj(s.header, s.bodyLines)
        i++
        break
      case 'A_main': {
        const subs = extractSubsections(s.bodyLines)
        if (subs.length > 0) {
          const A = { header: s.header, subsections: {} }
          for (const sub of subs) A.subsections[sub.header] = sectionObj(sub.header, sub.bodyLines)
          sections.A = A
          i++
        } else {
          // 뒤따르는 ## A-x 형제(td111) 수집
          const group = [s]
          let j = i + 1
          while (j < rawSections.length && classify(coreOf(rawSections[j].header)).type === 'A_sub') {
            group.push(rawSections[j])
            j++
          }
          if (group.length > 1) {
            sections.A = group.map((g) => sectionObj(g.header, g.bodyLines))
            i = j
          } else {
            sections.A = sectionObj(s.header, s.bodyLines)
            i++
          }
        }
        break
      }
      case 'D': {
        const dk = c.family
        if (!sections[dk]) sections[dk] = {}
        sections[dk]['tier' + c.tier] = sectionObj(s.header, s.bodyLines)
        i++
        break
      }
      default:
        // A_sub 단독(그룹 밖) 또는 unknown → 스킵(경고)
        console.warn(`  [warn] td${tdInfo.num}: 미분류 섹션 "${s.header}"`)
        i++
    }
  }
  for (const dk of ['D', 'D_prime']) if (sections[dk]) sections[dk] = orderTiers(sections[dk])

  // 메타는 기존 파일에서 보존
  const existPath = path.join(EXIST_DIR, `td${tdInfo.num}.json`)
  let meta = { id: `td${tdInfo.num}`, category: null, category_title: null, format: 'adult' }
  if (fs.existsSync(existPath)) {
    const ex = JSON.parse(fs.readFileSync(existPath, 'utf8'))
    meta = { id: ex.id, category: ex.category, category_title: ex.category_title, format: ex.format }
  } else {
    console.warn(`  [warn] 기존 파일 없음: td${tdInfo.num}.json (메타 기본값 사용)`)
  }

  const result = {
    id: meta.id,
    td_num: tdInfo.num,
    category: meta.category,
    category_title: meta.category_title,
    title: tdInfo.title,
    format: meta.format,
  }
  if (introText) result.intro_note = { text: introText }
  result.sections = sections
  return result
}

// ── 실행 ──
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })
console.log(`td 개수: ${tdStarts.length}`)
let ok = 0
for (const t of tdStarts) {
  const obj = parseTd(t)
  fs.writeFileSync(path.join(OUT_DIR, `td${t.num}.json`), JSON.stringify(obj, null, 2) + '\n', 'utf8')
  ok++
}
console.log(`생성 완료: ${ok}개 → ${OUT_DIR}`)
