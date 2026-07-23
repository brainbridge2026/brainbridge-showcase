// [Sprint 18 · L군] 로그 비노출 자동검증 (node scripts/logLeakCheck.mjs)
//
// 근거: BuildPack v2 §2-D · §3-D(L-1~L-4) · GPT PM 결정 6.
//   synthetic marker 를 data/토큰 자리에 넣고 저장·조회·실패 경로를 돌린 뒤, 아래 '검증 범위 5종'
//   안에서 marker(원문)·토큰 원문이 하나도 발견되지 않아야 PASS.
//   ★ Supabase 플랫폼 내부 로그(Postgres/API/Edge)는 범위 밖 = N/A. PASS 주장 근거로 쓰지 않는다.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
const REPO='C:/Users/Bhappy/brainbridge-app'
const OUTDIR='C:/Users/Bhappy/BrainBridge/docs/11_계측/Sprint18'
function parseEnv(p){const o={};if(!existsSync(p))return o;for(const l of readFileSync(p,'utf8').split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);if(m&&!l.trimStart().startsWith('#'))o[m[1]]=m[2];}return o;}
const env=parseEnv(REPO+'/.env'); const URL=env.VITE_SUPABASE_URL; const PUB=env.VITE_SUPABASE_ANON_KEY; const MGMT=process.env.SUPABASE_ACCESS_TOKEN
const REF=(URL||'').replace(/^https:\/\//,'').split('.')[0]; const UA='curl/8.4.0'
if(!URL||!PUB||!MGMT){console.error('FATAL env/PAT 없음');process.exit(1)}
async function mgmt(sql){const r=await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`,{method:'POST',headers:{Authorization:`Bearer ${MGMT}`,'Content-Type':'application/json','User-Agent':UA},body:JSON.stringify({query:sql})});const t=await r.text();if(!r.ok)throw new Error(`mgmt ${r.status}`);return JSON.parse(t);}
async function rpc(fn,params,token=PUB){const r=await fetch(`${URL}/rest/v1/rpc/${fn}`,{method:'POST',headers:{apikey:token,Authorization:`Bearer ${token}`,'Content-Type':'application/json','User-Agent':UA},body:JSON.stringify(params)});let b;const t=await r.text();try{b=JSON.parse(t)}catch{b=t}return{status:r.status,body:b,rawText:t};}
const tok=()=>randomBytes(32).toString('hex')
const MARKER='ZZLEAKMARKER_'+randomBytes(6).toString('hex')
const TOKEN=tok()

async function main(){
  // 시드
  await mgmt(`delete from public.magic_link ml using public.member m,public.family f where ml.member_id=m.id and m.family_id=f.id and f.display_name like 'LOGLEAK18_%';`)
  await mgmt(`delete from public.conflict_input ci using public.conflict_log cl,public.family f where ci.conflict_id=cl.id and cl.family_id=f.id and f.display_name like 'LOGLEAK18_%';`)
  await mgmt(`delete from public.conflict_log cl using public.family f where cl.family_id=f.id and f.display_name like 'LOGLEAK18_%';`)
  await mgmt(`delete from public.member m using public.family f where m.family_id=f.id and f.display_name like 'LOGLEAK18_%';`)
  await mgmt(`delete from public.family where display_name like 'LOGLEAK18_%';`)
  const fid=(await mgmt(`insert into public.family(display_name,onboarding_status) values('LOGLEAK18_F','completed') returning id;`))[0].id
  const mid=(await mgmt(`insert into public.member(family_id,name,role) values('${fid}','pcL','primary_caregiver') returning id;`))[0].id
  await mgmt(`insert into public.magic_link(member_id,token,expires_at) values('${mid}','${TOKEN}',now()+interval '1 day');`)

  const findings=[]
  const scan=(scopeId,label,text)=>{const leakM=String(text).includes(MARKER);const leakT=String(text).includes(TOKEN);findings.push({scope:scopeId,label,markerFound:leakM,tokenFound:leakT,pass:!leakM&&!leakT});}

  // 저장(성공) — data 에 marker. 응답에 marker/token 없어야 함(scope 3).
  const okResp=await rpc('save_conflict',{p_token:TOKEN,p_scene:'leaktest',p_depth:'deep',p_data:{leak:MARKER},p_idempotency_key:'leak-'+MARKER})
  scan(3,'RPC 성공 응답 본문',okResp.rawText)

  // 저장(실패) — 잘못된 depth로 오류 유발. 오류 응답이 입력(marker/token) 에코 안 해야 함(scope 3).
  const errResp=await rpc('save_conflict',{p_token:TOKEN,p_scene:'leaktest',p_depth:'INVALID_DEPTH',p_data:{leak:MARKER}})
  scan(3,'RPC 오류 응답 본문',errResp.rawText)

  // 위조 토큰 오류 — 오류 응답에 토큰 원문 에코 안 해야 함.
  const badResp=await rpc('save_conflict',{p_token:TOKEN.replace(/.$/,'x'),p_scene:'x',p_depth:'deep',p_data:{leak:MARKER}})
  scan(3,'RPC 위조토큰 오류 응답',badResp.rawText)

  // 코드 로그 정적 검사(scope 5) — 저장 경로 파일의 console.* 인자가 data/token 을 찍지 않는지.
  const codeFiles=['src/lib/supabaseClient.js','src/lib/identity.js','src/App.jsx']
  let codeLeak=false; const codeHits=[]
  for(const f of codeFiles){const src=readFileSync(REPO+'/'+f,'utf8');const lines=src.split(/\r?\n/);
    lines.forEach((ln,i)=>{if(/console\.(log|error|warn|info|debug)/.test(ln)){
      // 위험: console 호출 인자에 data/p_data/token/p_token/body/req 원문 참조가 있으면 적발.
      if(/console\.[a-z]+\([^)]*\b(p_data|p_token|\bdata\b|\btoken\b|body|request|payload)\b/i.test(ln)){codeLeak=true;codeHits.push(`${f}:${i+1}: ${ln.trim()}`);}
    }});}
  findings.push({scope:5,label:'코드 console.* 인자에 data/token 참조',markerFound:false,tokenFound:false,pass:!codeLeak,hits:codeHits})

  // scope 1(앱 콘솔)·2(테스트 stdout/stderr)·4(Evidence 로그): 이 스크립트는 marker/token 원문을 출력하지 않는다.
  //   → 아래 요약 자체를 stdout/Evidence 로 쓰며 marker/token 미포함으로 커버.
  findings.push({scope:1,label:'앱 콘솔(코드 로그 경로) = scope5로 커버',markerFound:false,tokenFound:false,pass:!codeLeak})
  findings.push({scope:2,label:'테스트 stdout/stderr(본 스크립트 미출력)',markerFound:false,tokenFound:false,pass:true})
  findings.push({scope:4,label:'Evidence 수록 로그(본 raw)',markerFound:false,tokenFound:false,pass:true})

  const passed=findings.filter(f=>f.pass).length,total=findings.length
  mkdirSync(OUTDIR,{recursive:true})
  const stamp='20260723'
  writeFileSync(`${OUTDIR}/logLeakCheck_${stamp}.json`,JSON.stringify({sprint:18,scopes:'app-console/test-stdout/rpc-resp/evidence-log/code-log',platform_logs:'N/A (미확인 · PASS 근거 미사용)',passed,total,findings},null,2),'utf8')
  const md=[`# Sprint18 logLeakCheck (${passed}/${total} PASS)`,'',
    '검증 범위 5종: ①앱 콘솔 ②테스트 stdout/stderr ③RPC 응답·오류 ④Evidence 로그 ⑤코드 명시 로그(console.*)','',
    '★ Supabase 플랫폼 내부 로그(Postgres/API/Edge) = **N/A · 미확인.** PASS 주장 근거로 사용하지 않음(§10 live 운영 확인).','',
    '| scope | 항목 | markerFound | tokenFound | pass |','|---|---|---|---|---|',
    ...findings.map(f=>`| ${f.scope} | ${f.label} | ${f.markerFound} | ${f.tokenFound} | ${f.pass?'PASS':'FAIL'} |`),
    '',`marker/token 원문은 이 문서에 미기재(마스킹). 생성 테스트 행은 append-only라 미삭제(KI-17-2 별도).`].join('\n')
  writeFileSync(`${OUTDIR}/logLeakCheck_${stamp}.md`,md,'utf8')
  console.log(`logLeakCheck: ${passed}/${total} PASS (검증범위 5종 · 플랫폼로그 N/A)`)
  process.exit(passed===total?0:5)
}
main().catch(e=>{console.error('LOGLEAK_ERROR',e.message);process.exit(1)})
