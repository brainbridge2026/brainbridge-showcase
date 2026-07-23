// [Sprint 18 · C-16 저장 축] 저장·접근제어 자동검증 하네스 (node scripts/authSprint18Check.mjs)
//
// 근거: BuildPack v2 §3-B(R-4~R-14) · §3-C(A-10) · §5 Evidence. raw-first.
//   관리 경로(SUPABASE_ACCESS_TOKEN, Management API): 픽스처 시드·상태 조회·정리(0건 — append-only).
//   anon 경로(publishable): save_conflict / get_family_conflicts / get_conflict_detail 및 직접 테이블 접근.
// ★ secret/service_role 키는 쓰지 않는다. 토큰 원문·data 원문은 raw에서 마스킹한다.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { randomBytes } from 'node:crypto'

const REPO = 'C:/Users/Bhappy/brainbridge-app'
const OUTDIR = 'C:/Users/Bhappy/BrainBridge/docs/11_계측/Sprint18'
function parseEnv(p){const o={};if(!existsSync(p))return o;for(const l of readFileSync(p,'utf8').split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);if(m&&!l.trimStart().startsWith('#'))o[m[1]]=m[2];}return o;}
const env=parseEnv(REPO+'/.env'); const URL=env.VITE_SUPABASE_URL; const PUB=env.VITE_SUPABASE_ANON_KEY; const MGMT=process.env.SUPABASE_ACCESS_TOKEN
const REF=(URL||'').replace(/^https:\/\//,'').split('.')[0]; const UA='curl/8.4.0'
if(!URL||!PUB){console.error('FATAL .env 없음');process.exit(1)}
if(!MGMT){console.error('FATAL SUPABASE_ACCESS_TOKEN 미설정');process.exit(1)}

async function mgmt(sql){const r=await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`,{method:'POST',headers:{Authorization:`Bearer ${MGMT}`,'Content-Type':'application/json','User-Agent':UA},body:JSON.stringify({query:sql})});const t=await r.text();if(!r.ok)throw new Error(`mgmt ${r.status}: ${t.slice(0,300)}`);return JSON.parse(t);}
async function rpc(fn,params,token=PUB){const r=await fetch(`${URL}/rest/v1/rpc/${fn}`,{method:'POST',headers:{apikey:token,Authorization:`Bearer ${token}`,'Content-Type':'application/json','User-Agent':UA},body:JSON.stringify(params)});let b;const t=await r.text();try{b=JSON.parse(t)}catch{b=t}return{status:r.status,ok:r.ok,body:b};}
async function directTable(method,table,extra={}){const opts={method,headers:{apikey:PUB,Authorization:`Bearer ${PUB}`,'User-Agent':UA,...extra.headers}};if(extra.body){opts.body=JSON.stringify(extra.body);opts.headers['Content-Type']='application/json';}const r=await fetch(`${URL}/rest/v1/${table}${extra.qs||''}`,opts);let b;const t=await r.text();try{b=JSON.parse(t)}catch{b=t}return{status:r.status,ok:r.ok,body:b};}
const tok=()=>randomBytes(32).toString('hex')
const results=[]
function record(id,name,expected,actual,pass,raw){results.push({id,name,expected,actual,pass:!!pass,raw});console.log(`${pass?'PASS':'FAIL'} [${id}] ${name}`);}
// data/토큰 마스킹
function mask(o){const s=JSON.stringify(o);return s.replace(/[a-f0-9]{64}/g,'<TOKEN>');}

const F={f1:null,f2:null,p1:null,pn1:null,ca1:null,ct1:null,p2:null,tP1:tok(),tPN1:tok(),tCA1:tok(),tCT1:tok(),tP2:tok(),tExp:tok()}

async function teardownSeed(){
  await mgmt(`delete from public.magic_link ml using public.member m, public.family f where ml.member_id=m.id and m.family_id=f.id and f.display_name like 'TESTS18_%';`)
  await mgmt(`delete from public.conflict_input ci using public.conflict_log cl, public.family f where ci.conflict_id=cl.id and cl.family_id=f.id and f.display_name like 'TESTS18_%';`)
  await mgmt(`delete from public.conflict_log cl using public.family f where cl.family_id=f.id and f.display_name like 'TESTS18_%';`)
  await mgmt(`delete from public.member m using public.family f where m.family_id=f.id and f.display_name like 'TESTS18_%';`)
  await mgmt(`delete from public.family where display_name like 'TESTS18_%';`)
}
async function seed(){
  await teardownSeed()
  const id=r=>r[0].id
  F.f1=id(await mgmt(`insert into public.family(display_name,onboarding_status) values('TESTS18_F1','completed') returning id;`))
  F.f2=id(await mgmt(`insert into public.family(display_name,onboarding_status) values('TESTS18_F2','completed') returning id;`))
  F.p1=id(await mgmt(`insert into public.member(family_id,name,role) values('${F.f1}','pc1','primary_caregiver') returning id;`))
  F.pn1=id(await mgmt(`insert into public.member(family_id,name,role,sex) values('${F.f1}','partner1','partner','male') returning id;`))
  F.ca1=id(await mgmt(`insert into public.member(family_id,name,role,age,child_direct_use) values('${F.f1}','childAllowed','child',10,true) returning id;`))
  F.ct1=id(await mgmt(`insert into public.member(family_id,name,role,age,child_direct_use) values('${F.f1}','childTier1','child',6,false) returning id;`))
  F.p2=id(await mgmt(`insert into public.member(family_id,name,role) values('${F.f2}','pc2','primary_caregiver') returning id;`))
  await mgmt(`insert into public.magic_link(member_id,token,expires_at) values
    ('${F.p1}','${F.tP1}',now()+interval '2 days'),
    ('${F.pn1}','${F.tPN1}',now()+interval '2 days'),
    ('${F.ca1}','${F.tCA1}',now()+interval '2 days'),
    ('${F.ct1}','${F.tCT1}',now()+interval '2 days'),
    ('${F.p2}','${F.tP2}',now()+interval '2 days'),
    ('${F.p1}','${F.tExp}',now()-interval '1 day');`)
}

async function run(){
  await seed()

  // R-4: 유효 토큰 저장 → log 1 + input 1, FK 정합
  const s4=await rpc('save_conflict',{p_token:F.tP1,p_scene:'숙제',p_depth:'deep',p_data:{note:'x'},p_idempotency_key:'idem-r4-'+tok().slice(0,8)})
  const cnt4=await mgmt(`select (select count(*) from public.conflict_log where id='${s4.body?.conflict_log_id}') l,(select count(*) from public.conflict_input where id='${s4.body?.conflict_input_id}' and conflict_id='${s4.body?.conflict_log_id}' and member_id='${F.p1}') i;`)
  record('R-4','유효 토큰 저장 → log1+input1 FK정합','log=1,input=1',`log=${cnt4[0].l},input=${cnt4[0].i},logId=${!!s4.body?.conflict_log_id}`,s4.ok&&Number(cnt4[0].l)===1&&Number(cnt4[0].i)===1,{resp:s4.body})

  // R-5: 만료·위조 토큰 → 거부, 행 생성 0
  //  ★ 정정(GPT PM MAJOR): 각 호출 직전/직후에 conflict_log·conflict_input 건수를 별도 측정한다.
  //    (JOIN cartesian 과대집계 폐기 — delta=-3 같은 비정상값 방지). log delta=0·input delta=0 이라야 PASS.
  async function fam1Counts(){
    const r=await mgmt(`select
        (select count(*) from public.conflict_log where family_id='${F.f1}') as logs,
        (select count(*) from public.conflict_input ci join public.conflict_log cl on cl.id=ci.conflict_id where cl.family_id='${F.f1}') as inputs;`)
    return { logs:Number(r[0].logs), inputs:Number(r[0].inputs) }
  }
  // 위조 토큰
  const preBad=await fam1Counts()
  const bad5=await rpc('save_conflict',{p_token:'not_a_real_token_zzzzzzzzzzzz',p_scene:'x',p_depth:'deep',p_data:{}})
  const postBad=await fam1Counts()
  const badLogD=postBad.logs-preBad.logs, badInD=postBad.inputs-preBad.inputs
  // 만료 토큰
  const preExp=await fam1Counts()
  const exp5=await rpc('save_conflict',{p_token:F.tExp,p_scene:'x',p_depth:'deep',p_data:{}})
  const postExp=await fam1Counts()
  const expLogD=postExp.logs-preExp.logs, expInD=postExp.inputs-preExp.inputs
  const r5pass = !bad5.ok && !exp5.ok && badLogD===0 && badInD===0 && expLogD===0 && expInD===0
  record('R-5','만료·위조 토큰 거부 · log/input delta 0 (별도 측정)',
    'both denied · badLogΔ0 badInΔ0 expLogΔ0 expInΔ0',
    `bad=${bad5.status}(logΔ${badLogD},inΔ${badInD}) exp=${exp5.status}(logΔ${expLogD},inΔ${expInD})`,
    r5pass,
    { forged:{ status:bad5.status, denied:!bad5.ok, resp:bad5.body, preCounts:preBad, postCounts:postBad, logDelta:badLogD, inputDelta:badInD },
      expired:{ status:exp5.status, denied:!exp5.ok, resp:exp5.body, preCounts:preExp, postCounts:postExp, logDelta:expLogD, inputDelta:expInD } })

  // R-7: get_family_conflicts 타가족 0건 · data 원문 0
  const listF1=await rpc('get_family_conflicts',{p_token:F.tP1})
  const listF2=await rpc('get_family_conflicts',{p_token:F.tP2})
  const hasData = JSON.stringify(listF1.body||'').includes('"data"')
  record('R-7','가족목록: 타가족0·data원문0','own only, no data field',`f1=${(listF1.body||[]).length},f2=${(listF2.body||[]).length},dataLeak=${hasData}`,listF1.ok&&!hasData&&(listF2.body||[]).length===0,{f1:listF1.body,f2:listF2.body})

  // R-6: 가족A 토큰으로 가족B conflict 상세 → 거부
  const s4b=await rpc('save_conflict',{p_token:F.tP2,p_scene:'y',p_depth:'shallow',p_data:{}})
  const cross=await rpc('get_conflict_detail',{p_token:F.tP1,p_conflict_id:s4b.body?.conflict_log_id})
  record('R-6','타가족 conflict 상세 거부','denied',`status=${cross.status},msg=${cross.body?.message}`,!cross.ok,{resp:cross.body})

  // R-8: anon 직접 테이블 접근 차단
  const d1=await directTable('GET','conflict_input',{qs:'?select=id&limit=1'})
  const d2=await directTable('GET','conflict_log',{qs:'?select=id&limit=1'})
  const d3=await directTable('POST','conflict_input',{body:{conflict_id:F.f1,member_id:F.p1,data:{}}})
  const blocked=[d1,d2,d3].every(d=>d.status===401||d.status===403||d.status===404||(d.body&&/permission|denied|42501/i.test(JSON.stringify(d.body))))
  record('R-8','anon 직접 테이블 접근 차단','all blocked',`GETci=${d1.status},GETcl=${d2.status},POSTci=${d3.status}`,blocked,{d1:d1.body,d2:d2.body,d3:d3.body})

  // R-9: UPDATE/DELETE RPC 부재 · R-10a 시그니처
  const procs=await mgmt(`select proname,pg_get_function_identity_arguments(oid) args from pg_proc where pronamespace='public'::regnamespace and proname like '%conflict%' order by 1;`)
  const noMut=!procs.some(p=>/update|delete|edit|remove/i.test(p.proname))
  const sc=procs.find(p=>p.proname==='save_conflict')
  const noIdArgs=sc && !/family_id|member_id/i.test(sc.args)
  record('R-9','conflict UPDATE/DELETE RPC 부재','none',`procs=${procs.map(p=>p.proname).join(',')}`,noMut,{procs})
  record('R-10a','save_conflict 시그니처 family/member 인자 0','0 id args',`args=${sc?.args}`,noIdArgs,{args:sc?.args})

  // R-10b: 추가 family 인자 호출 실패
  const extra=await rpc('save_conflict',{p_token:F.tP1,p_scene:'x',p_depth:'deep',p_data:{},p_family_id:F.f2})
  record('R-10b','추가 family 인자 호출 실패','rejected(signature)',`status=${extra.status}`,!extra.ok,{resp:extra.body})

  // R-10c: 저장된 log.family_id == 토큰 member family
  const s10=await rpc('save_conflict',{p_token:F.tPN1,p_scene:'z',p_depth:'shallow',p_data:{}})
  const fam=await mgmt(`select cl.family_id lf,(select family_id from public.member where id='${F.pn1}') mf from public.conflict_log cl where cl.id='${s10.body?.conflict_log_id}';`)
  record('R-10c','log.family_id == 토큰 member family','match',`log=${fam[0]?.lf===fam[0]?.mf}`,fam[0]&&fam[0].lf===fam[0].mf,{fam:fam[0]})

  // R-11: 2인 입력 상태에서 상세 조회 → 본인 data만, 타인 data 0
  //   (구조상 save_conflict는 계정별 log를 만들므로, 다구성원 단일 log 상태를 admin으로 시드해 read-side 검증)
  const seedLog=(await mgmt(`insert into public.conflict_log(family_id,depth,scene) values('${F.f1}','deep','shared') returning id;`))[0].id
  await mgmt(`insert into public.conflict_input(conflict_id,member_id,data) values('${seedLog}','${F.p1}','{"secretP1":"MARKER_P1"}'::jsonb),('${seedLog}','${F.pn1}','{"secretPN1":"MARKER_PN1"}'::jsonb);`)
  const detP1=await rpc('get_conflict_detail',{p_token:F.tP1,p_conflict_id:seedLog})
  const sP1=JSON.stringify(detP1.body||'')
  const ownOk=sP1.includes('MARKER_P1'); const otherLeak=sP1.includes('MARKER_PN1')
  const otherCount=detP1.body?.other_count
  record('R-11','상세: 본인 data만·타인 원문0','own data yes, other data no',`own=${ownOk},otherLeak=${otherLeak},otherCount=${otherCount}`,detP1.ok&&ownOk&&!otherLeak&&Number(otherCount)===1,{detail:JSON.parse(mask(detP1.body))})

  // R-12: tier1 / child_direct_use=false 자녀 저장 거부
  const beforeCT=Number((await mgmt(`select count(*) c from public.conflict_input where member_id='${F.ct1}';`))[0].c)
  const ct=await rpc('save_conflict',{p_token:F.tCT1,p_scene:'x',p_depth:'deep',p_data:{}})
  const afterCT=Number((await mgmt(`select count(*) c from public.conflict_input where member_id='${F.ct1}';`))[0].c)
  record('R-12','tier1/직접사용false 자녀 저장 거부','denied·rows0',`status=${ct.status},delta=${afterCT-beforeCT}`,!ct.ok&&(afterCT-beforeCT)===0,{resp:ct.body})

  // R-12b: 직접사용 허용 자녀(age>7)는 저장 허용
  const ca=await rpc('save_conflict',{p_token:F.tCA1,p_scene:'x',p_depth:'deep',p_data:{}})
  record('R-12b','직접사용 허용 자녀 저장 허용','allowed',`status=${ca.status},ok=${ca.ok}`,ca.ok&&!!ca.body?.conflict_log_id,{resp:ca.body})

  // R-13: 저장된 member_id는 항상 토큰 당사자
  const md=await mgmt(`select member_id from public.conflict_input where id='${s10.body?.conflict_input_id}';`)
  record('R-13','저장 member_id=토큰 당사자','== token member',`stored=${md[0]?.member_id===F.pn1}`,md[0]&&md[0].member_id===F.pn1,{stored:md[0]?.member_id===F.pn1})

  // A-10: 동일 멱등키 재시도 → 중복 0
  const key='idem-a10-'+tok().slice(0,10)
  const a1=await rpc('save_conflict',{p_token:F.tP1,p_scene:'dup',p_depth:'deep',p_data:{},p_idempotency_key:key})
  const a2=await rpc('save_conflict',{p_token:F.tP1,p_scene:'dup',p_depth:'deep',p_data:{},p_idempotency_key:key})
  const dupCnt=Number((await mgmt(`select count(*) c from public.conflict_log where idempotency_key='${key}';`))[0].c)
  record('A-10','동일 멱등키 재시도 중복0','1 log only, same id',`logs=${dupCnt},sameId=${a1.body?.conflict_log_id===a2.body?.conflict_log_id},idem2=${a2.body?.idempotent}`,a1.ok&&a2.ok&&dupCnt===1&&a1.body?.conflict_log_id===a2.body?.conflict_log_id&&a2.body?.idempotent===true,{a1:a1.body,a2:a2.body})

  // 결과 집계
  const passed=results.filter(r=>r.pass).length, total=results.length
  mkdirSync(OUTDIR,{recursive:true})
  const stamp='20260723'
  const rawObj={sprint:18,ran_at_note:'stamp-'+stamp,project:REF,passed,total,results}
  writeFileSync(`${OUTDIR}/authSprint18Check_${stamp}.json`,JSON.stringify(rawObj,null,2),'utf8')
  const md2=[`# Sprint18 authSprint18Check 결과 (${passed}/${total} PASS)`,'',`프로젝트 ${REF} · anon=publishable · 관리경로=Management API(시드) · 토큰·data 마스킹`,'',
    '| ID | 결과 | 항목 | actual |','|---|---|---|---|',
    ...results.map(r=>`| ${r.id} | ${r.pass?'PASS':'FAIL'} | ${r.name} | ${String(r.actual).replace(/\|/g,'/')} |`),
    '',`시드 가족: TESTS18_F1(주양육자·배우자·직접사용자녀·tier1자녀) · TESTS18_F2(주양육자). append-only라 생성 행 미삭제(KI-17-2 별도).`].join('\n')
  writeFileSync(`${OUTDIR}/authSprint18Check_${stamp}.md`,md2,'utf8')
  console.log(`\n== authSprint18Check: ${passed}/${total} PASS ==`)
  console.log('raw:',`${OUTDIR}/authSprint18Check_${stamp}.json`)
  process.exit(passed===total?0:4)
}
run().catch(e=>{console.error('HARNESS_ERROR',e.message);process.exit(1)})
