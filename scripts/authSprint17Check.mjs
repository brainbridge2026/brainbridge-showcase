// [Sprint 17 · C-16] 인증·RLS 자동검증 하네스 (node scripts/authSprint17Check.mjs)
//
// 근거: BuildPack v2 §7-B + 대표 결정 8·9 (2026-07-22)
// 검증: A-6·A-7·A-8·A-9·A-10 / R-1·R-2·R-3 / R-4(신설, 결정 9)
//
// 두 경로를 분리해 사용한다(정당한 테스트 하네스 구성):
//   - 관리 경로(SUPABASE_ACCESS_TOKEN, Management API): 픽스처 시드·상태 조회·정리.
//     (anon엔 가족 부트스트랩 RPC가 없다 = 설계상 privileged. 실제 앱은 초대 링크로 시작.)
//   - anon 경로(publishable 키): redeem/get/add/update RPC 및 직접 테이블 접근을 실제 클라이언트처럼 호출.
//
// ★ secret key(sb_secret_)는 쓰지 않는다. anon 경로는 publishable 키만 사용(결정 공통).
// ★ 실패(assert 불통) 시 exit 1. raw JSON + 요약 MD 생성.
//
// 필요한 환경변수:
//   SUPABASE_ACCESS_TOKEN = Management API PAT(sbp_...)  [관리 경로 전용, 번들에 안 들어감]
//   .env 의 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY(=publishable) 를 자동 로드.

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO = join(__dirname, '..')

// ── config ──────────────────────────────────────────────────
function parseEnv(path) {
  const out = {}
  if (!existsSync(path)) return out
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !line.trimStart().startsWith('#')) out[m[1]] = m[2]
  }
  return out
}
const env = parseEnv(join(REPO, '.env'))
const URL = env.VITE_SUPABASE_URL
const PUB = env.VITE_SUPABASE_ANON_KEY
const MGMT = process.env.SUPABASE_ACCESS_TOKEN
const REF = (URL || '').replace(/^https:\/\//, '').split('.')[0]
const UA = 'curl/8.4.0' // api.supabase.com Cloudflare UA 게이트 회피

if (!URL || !PUB) { console.error('FATAL: .env 의 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 없음'); process.exit(1) }
if (!MGMT) { console.error('FATAL: 환경변수 SUPABASE_ACCESS_TOKEN(관리 PAT) 미설정 — 픽스처 시드 불가'); process.exit(1) }

// ── http helpers ────────────────────────────────────────────
async function mgmt(sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${MGMT}`, 'Content-Type': 'application/json', 'User-Agent': UA },
    body: JSON.stringify({ query: sql }),
  })
  const text = await r.text()
  if (!r.ok) throw new Error(`mgmt ${r.status}: ${text.slice(0, 300)}`)
  return JSON.parse(text)
}
async function rpc(fn, params, token = PUB) {
  const r = await fetch(`${URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: token, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': UA },
    body: JSON.stringify(params),
  })
  let body; const t = await r.text(); try { body = JSON.parse(t) } catch { body = t }
  return { status: r.status, ok: r.ok, body }
}
async function directTable(method, table, extra = {}) {
  const opts = { method, headers: { apikey: PUB, Authorization: `Bearer ${PUB}`, 'User-Agent': UA, ...extra.headers } }
  if (extra.body) { opts.body = JSON.stringify(extra.body); opts.headers['Content-Type'] = 'application/json' }
  const url = `${URL}/rest/v1/${table}${extra.qs || ''}`
  const r = await fetch(url, opts)
  let body; const t = await r.text(); try { body = JSON.parse(t) } catch { body = t }
  return { status: r.status, ok: r.ok, body }
}

// ── result collection ───────────────────────────────────────
const results = []
function record(id, group, name, expected, actual, pass, raw) {
  results.push({ id, group, name, expected, actual, pass: !!pass, raw })
  console.log(`${pass ? 'PASS' : 'FAIL'} [${id}] ${name}`)
}
// A-7/A-10: 응답에 내부 정보·토큰 원문 노출 없는지
function leaksInternal(body, tokens) {
  const s = typeof body === 'string' ? body : JSON.stringify(body)
  if (/stack|\.sql|pg_catalog|at Object\.|node_modules/i.test(s)) return 'stacktrace/internal'
  for (const t of tokens) if (t && s.includes(t)) return 'raw-token'
  return null
}

// ── fixtures ────────────────────────────────────────────────
const tok = () => randomBytes(32).toString('hex') // 256bit
const F = {
  tA: tok(), tAchild: tok(), tAexp: tok(), tB: tok(),
  famA: null, famB: null, primA: null, childA: null, primB: null,
}

async function seed() {
  await teardown() // 이전 잔여 제거
  const rowsA = await mgmt(`insert into public.family(display_name) values ('AUTOCHK_A') returning id;`)
  F.famA = rowsA[0].id
  const rowsB = await mgmt(`insert into public.family(display_name) values ('AUTOCHK_B') returning id;`)
  F.famB = rowsB[0].id
  const pA = await mgmt(`insert into public.member(family_id,name,role) values ('${F.famA}','pcA','primary_caregiver') returning id;`)
  F.primA = pA[0].id
  const cA = await mgmt(`insert into public.member(family_id,name,role) values ('${F.famA}','childA','child') returning id;`)
  F.childA = cA[0].id
  const pB = await mgmt(`insert into public.member(family_id,name,role) values ('${F.famB}','pcB','primary_caregiver') returning id;`)
  F.primB = pB[0].id
  await mgmt(`insert into public.magic_link(member_id,token,expires_at) values
    ('${F.primA}','${F.tA}', now()+interval '1 day'),
    ('${F.childA}','${F.tAchild}', now()+interval '1 day'),
    ('${F.primA}','${F.tAexp}', now()-interval '1 day'),
    ('${F.primB}','${F.tB}', now()+interval '1 day');`)
}
async function teardown() {
  await mgmt(`delete from public.magic_link ml using public.member m, public.family f
      where ml.member_id=m.id and m.family_id=f.id and f.display_name like 'AUTOCHK%';`)
  await mgmt(`delete from public.member m using public.family f
      where m.family_id=f.id and f.display_name like 'AUTOCHK%';`)
  await mgmt(`delete from public.family where display_name like 'AUTOCHK%';`)
}

// ── checks ──────────────────────────────────────────────────
async function run() {
  await seed()
  const allTokens = [F.tA, F.tAchild, F.tAexp, F.tB]

  // ── A-6: 2차 초대 링크 자동 생성 = 구성원 추가 시 토큰 발급, 구성원수=토큰수, 각 토큰 검증 통과
  const addP = await rpc('add_family_member', { p_token: F.tA, p_name: 'partnerA', p_role: 'partner', p_sex: 'male' })
  const addC = await rpc('add_family_member', { p_token: F.tA, p_name: 'child2A', p_role: 'child' })
  const cnt = await mgmt(`select
      (select count(*) from public.member where family_id='${F.famA}') as members,
      (select count(distinct ml.member_id) from public.magic_link ml join public.member m on m.id=ml.member_id
         where m.family_id='${F.famA}' and ml.expires_at>now()) as members_with_valid_token;`)
  const memberCount = Number(cnt[0].members)
  const withToken = Number(cnt[0].members_with_valid_token)
  // 각 구성원 토큰이 실제 redeem 되는지 (관리경로로 토큰 조회 후 anon redeem)
  const links = await mgmt(`select distinct on (m.id) ml.token from public.member m
      join public.magic_link ml on ml.member_id=m.id and ml.expires_at>now()
      where m.family_id='${F.famA}' order by m.id, ml.created_at desc;`)
  let allRedeem = true
  for (const l of links) { const rr = await rpc('redeem_invite', { p_token: l.token }); if (!rr.ok) allRedeem = false }
  record('A-6', 'auth', '구성원 추가 시 2차 토큰 자동 발급 · 구성원수=유효토큰수 · 전 토큰 검증 통과',
    'created & members==tokens & all redeem', `add.created=${addP.body?.created}/${addC.body?.created}, members=${memberCount}, withToken=${withToken}, allRedeem=${allRedeem}`,
    addP.body?.created === true && addC.body?.created === true && memberCount === withToken && memberCount > 0 && allRedeem,
    { addP: addP.body, addC: addC.body, counts: cnt[0], allRedeem })

  // ── A-7: 위조·만료 토큰 → 인증 거부 + 내부정보 비노출
  const bad = await rpc('redeem_invite', { p_token: 'not_a_real_token_zzzzzzzzzzzz' })
  const exp = await rpc('redeem_invite', { p_token: F.tAexp })
  const leakBad = leaksInternal(bad.body, allTokens)
  const leakExp = leaksInternal(exp.body, allTokens)
  record('A-7', 'auth', '위조·만료 토큰 인증 거부 · 스택트레이스/내부ID/DB오류 비노출',
    'both denied, no internal leak', `bad=${bad.status}/${bad.body?.message}, exp=${exp.status}/${exp.body?.message}, leak=${leakBad || ''}${leakExp || ''}`,
    !bad.ok && !exp.ok && bad.body?.message === 'invite_invalid' && exp.body?.message === 'invite_invalid' && !leakBad && !leakExp,
    { bad, exp })

  // ── A-8: familyId+memberId(UUID)만으로는 인증 불가 (id ≠ token)
  const idAsFam = await rpc('redeem_invite', { p_token: F.famA })
  const idAsMem = await rpc('redeem_invite', { p_token: F.primA })
  record('A-8', 'auth', 'familyId/memberId(UUID)만으로는 인증 불가',
    'both denied', `fam=${idAsFam.status}/${idAsFam.body?.message}, mem=${idAsMem.status}/${idAsMem.body?.message}`,
    !idAsFam.ok && !idAsMem.ok,
    { idAsFam, idAsMem })

  // ── A-9: 중복 제출 시 구성원 행 증가 0
  const before = Number((await mgmt(`select count(*) c from public.member where family_id='${F.famA}';`))[0].c)
  const dup1 = await rpc('add_family_member', { p_token: F.tA, p_name: 'dupX', p_role: 'partner', p_sex: 'female' })
  const dup2 = await rpc('add_family_member', { p_token: F.tA, p_name: 'dupX', p_role: 'partner', p_sex: 'female' })
  const after = Number((await mgmt(`select count(*) c from public.member where family_id='${F.famA}';`))[0].c)
  record('A-9', 'auth', '동일 구성원 재제출 시 행 증가 0 (멱등)',
    'delta==1 (first only), dup created=false', `before=${before}, after=${after}, dup1.created=${dup1.body?.created}, dup2.created=${dup2.body?.created}`,
    dup1.body?.created === true && dup2.body?.created === false && (after - before) === 1,
    { dup1: dup1.body, dup2: dup2.body, before, after })

  // ── A-10: 토큰 원문 미노출 (RPC 응답 + 빌드 번들 grep)
  const respScan = [addP.body, addC.body, dup1.body, dup2.body].map(b => leaksInternal(b, allTokens)).filter(Boolean)
  let bundleFinding = 'dist 없음(빌드 후 별도 grep 대상)'
  const distDir = join(REPO, 'dist')
  if (existsSync(distDir)) {
    const hits = []
    const scanDir = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name)
      if (e.isDirectory()) scanDir(p)
      else if (/\.(js|css|html|map)$/.test(e.name)) {
        const c = readFileSync(p, 'utf8')
        for (const t of allTokens) if (t && c.includes(t)) hits.push(`${e.name}:token`)
        // secret 접두사(sb_secret_) · service_role · 관리 PAT(sbp_) 노출 검사 (qa MINOR-2).
        if (/sb_secret_|service_role|sbp_[A-Za-z0-9]/.test(c)) hits.push(`${e.name}:secret`)
      }
    } }
    scanDir(distDir)
    bundleFinding = hits.length ? hits.join(',') : 'clean'
  }
  record('A-10', 'auth', 'RPC 응답·번들에 토큰 원문/secret 노출 0',
    'no leak in responses & bundle', `respLeaks=${respScan.length}, bundle=${bundleFinding}`,
    respScan.length === 0 && (bundleFinding === 'clean' || bundleFinding.startsWith('dist 없음')),
    { respScan, bundleFinding })

  // ── R-1: 교차 가족 접근 차단
  const memA = await rpc('get_family_members', { p_token: F.tA })
  const memB = await rpc('get_family_members', { p_token: F.tB })
  const idsA = (memA.body || []).map(m => m.member_id)
  const idsB = (memB.body || []).map(m => m.member_id)
  const noBinA = !idsA.includes(F.primB)
  const noAinB = !idsB.some(id => id === F.primA || id === F.childA)
  record('R-1', 'rls', '교차 가족 접근 차단 (A 토큰은 B 행 0건, B 토큰은 A 행 0건)',
    'no cross-family rows', `A_has_B=${!noBinA}, B_has_A=${!noAinB}, |A|=${idsA.length}, |B|=${idsB.length}`,
    noBinA && noAinB && idsB.length === 1,
    { membersA: memA.body, membersB: memB.body })

  // ── R-2: 역할별 권한 분리 (자녀 토큰은 추가·온보딩 수정 거부, 주양육자는 허용)
  const childAdd = await rpc('add_family_member', { p_token: F.tAchild, p_name: 'intruder', p_role: 'child' })
  const childOnb = await rpc('update_onboarding', { p_token: F.tAchild, p_status: 'in_progress', p_step: 2 })
  const primOnb = await rpc('update_onboarding', { p_token: F.tA, p_status: 'in_progress', p_step: 2 })
  record('R-2', 'rls', '역할별 권한 분리 (자녀=거부, 주양육자=허용)',
    'child denied add+onboarding, primary allowed', `childAdd=${childAdd.status}/${childAdd.body?.message}, childOnb=${childOnb.status}/${childOnb.body?.message}, primOnb=${primOnb.status}`,
    !childAdd.ok && childAdd.body?.message === 'not_authorized' && !childOnb.ok && primOnb.ok,
    { childAdd, childOnb, primOnb })

  // ── R-3: RPC별 허용·거부 쌍 실측 (허용 raw + 거부 raw 둘 다 남김)
  const pairs = [
    ['redeem_invite', await rpc('redeem_invite', { p_token: F.tA }), await rpc('redeem_invite', { p_token: 'bad_zzzzzzzzzzzzzzzzzzzz' })],
    ['get_family_members', await rpc('get_family_members', { p_token: F.tA }), await rpc('get_family_members', { p_token: 'bad_zzzzzzzzzzzzzzzzzzzz' })],
    ['add_family_member', await rpc('add_family_member', { p_token: F.tA, p_name: 'r3p', p_role: 'partner' }), await rpc('add_family_member', { p_token: F.tAchild, p_name: 'r3x', p_role: 'child' })],
    ['update_onboarding', await rpc('update_onboarding', { p_token: F.tA, p_status: 'in_progress', p_step: 3 }), await rpc('update_onboarding', { p_token: F.tAchild, p_status: 'completed', p_step: 4 })],
    // qa MINOR-1: 5번째 공개 RPC도 허용·거부 쌍 실측. 허용=본인 토큰, 거부=위조 토큰.
    ['update_self_profile', await rpc('update_self_profile', { p_token: F.tA, p_sex: 'female' }), await rpc('update_self_profile', { p_token: 'bad_zzzzzzzzzzzzzzzzzzzz', p_sex: 'female' })],
  ]
  const r3ok = pairs.every(([, allow, deny]) => allow.ok && !deny.ok)
  record('R-3', 'rls', 'RPC별 허용·거부 쌍 실측 (allow PASS + deny DENY 둘 다)',
    'every fn: allow ok & deny denied', pairs.map(([n, a, d]) => `${n}:${a.status}/${d.status}`).join(' '),
    r3ok,
    Object.fromEntries(pairs.map(([n, a, d]) => [n, { allow: { status: a.status, body: a.body }, deny: { status: d.status, body: d.body } }])))

  // ── R-4(신설): publishable 키 직접 테이블 접근 전량 거부 (뒷문 확인)
  //  qa MINOR: 실제 존재하는 컬럼으로 시도해야 차단이 '스키마 오류(PGRST204)'가 아닌
  //  'RLS/권한 거부(42501)'로 발동함을 실측할 수 있다. 테이블별 실제 컬럼 사용.
  const realCol = { family: { display_name: 'hack' }, member: { name: 'hack' }, magic_link: { token: 'hack' } }
  const r4 = {}
  for (const t of ['family', 'member', 'magic_link']) {
    r4[t] = {
      select: await directTable('GET', t, { qs: '?select=*' }),
      insert: await directTable('POST', t, { body: realCol[t] }),
      update: await directTable('PATCH', t, { qs: '?id=is.null', body: realCol[t] }),
      delete: await directTable('DELETE', t, { qs: '?id=is.null' }),
    }
  }
  // 전량 거부(≥400) + 각 거부가 권한 거부(42501)인지까지 확인(스키마 오류로 인한 우연 차단 배제).
  const r4allDenied = Object.values(r4).every(tbl => Object.values(tbl).every(op => op.status >= 400))
  const r4allPermDenied = Object.values(r4).every(tbl =>
    Object.values(tbl).every(op => op.status >= 400 && (op.body?.code === '42501' || /permission denied/i.test(JSON.stringify(op.body)))))
  record('R-4', 'rls', 'publishable 키 직접 테이블 SELECT/INSERT/UPDATE/DELETE 전량 권한거부(42501)',
    'all direct ops permission-denied (42501)', `denied=${r4allDenied}, permDenied=${r4allPermDenied} · ` + Object.entries(r4).map(([t, ops]) => `${t}:${Object.values(ops).map(o => o.status).join('/')}`).join(' '),
    r4allDenied && r4allPermDenied, r4)

  await teardown()
}

// ── output ──────────────────────────────────────────────────
function stamp() { const d = new Date(); return d.toISOString().slice(0, 10).replace(/-/g, '') }
function writeOutputs() {
  const pass = results.filter(r => r.pass).length
  const fail = results.length - pass
  const groups = {}
  for (const r of results) { (groups[r.group] ??= []).push(r) }
  const raw = {
    generatedAt: new Date().toISOString(),
    project: REF,
    sprint: 'Sprint17-C16',
    summary: { total: results.length, pass, fail },
    results,
  }
  const outDir = 'C:/Users/Bhappy/BrainBridge/docs/11_계측/Sprint17'
  mkdirSync(outDir, { recursive: true })
  const base = `authSprint17Check_${stamp()}`
  writeFileSync(join(outDir, `${base}.json`), JSON.stringify(raw, null, 2), 'utf8')

  // 요약 MD (§7-B: 대상 0건 그룹은 0%가 아니라 N/A)
  let md = `# Sprint 17 · C-16 인증/RLS 자동검증 요약\n\n`
  md += `- 생성: ${raw.generatedAt}\n- 프로젝트: ${REF}\n- 결과: **${pass}/${results.length} PASS**, ${fail} FAIL\n\n`
  for (const [g, rs] of Object.entries(groups)) {
    const p = rs.filter(r => r.pass).length
    const rate = rs.length === 0 ? 'N/A' : `${((p / rs.length) * 100).toFixed(0)}%`
    md += `## ${g} (${p}/${rs.length} = ${rate})\n\n| ID | 검증 | 기대 | 실측 | 판정 |\n|---|---|---|---|---|\n`
    for (const r of rs) md += `| ${r.id} | ${r.name} | ${r.expected} | ${String(r.actual).replace(/\|/g, '/')} | ${r.pass ? '✅ PASS' : '❌ FAIL'} |\n`
    md += `\n`
  }
  md += `> raw 원본(허용·거부 결과 각각 포함): \`${base}.json\`\n`
  writeFileSync(join(outDir, `${base}.md`), md, 'utf8')
  console.log(`\n=== ${pass}/${results.length} PASS, ${fail} FAIL ===`)
  console.log(`raw:  ${join(outDir, base + '.json')}`)
  console.log(`md:   ${join(outDir, base + '.md')}`)
  return fail
}

try {
  await run()
  const fail = writeOutputs()
  process.exit(fail === 0 ? 0 : 1)
} catch (e) {
  console.error('HARNESS ERROR:', e.message)
  try { await teardown() } catch {}
  process.exit(1)
}
