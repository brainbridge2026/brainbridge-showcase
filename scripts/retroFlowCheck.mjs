// [C-25 정정] 회고 흐름 순수 로직 자동 검증 (node scripts/retroFlowCheck.mjs).
//  ConflictScreen이 소비하는 buildRetroSequence/retroNext/retroPrev 계약을 검증한다.
import {
  buildRetroSequence,
  retroNext,
  retroPrev,
  CALM_ORDER,
  SETTLING_ORDER,
} from '../src/utils/retroFlow.js'
// [Sprint 19] R-D용: 장면별 표현풀 정본(scene→5개) 조회 검증. bare JSON import 회피 위해 readFileSync 사용.
import { readFileSync } from 'fs'
const expressionPool = JSON.parse(readFileSync(new URL('../src/data/expressionPool.json', import.meta.url)))

let pass = 0
let fail = 0
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const check = (name, cond) => {
  if (cond) { pass++; console.log('PASS', name) }
  else { fail++; console.log('FAIL', name) }
}

// B-6: calm = 기존 깊은 회고 순서, pause 없음, 첫 스텝 reason
const calm = buildRetroSequence('calm', {})
check('calm sequence == CALM_ORDER', eq(calm, CALM_ORDER))
check('calm no pause', !calm.includes('pause'))
check('calm first = reason', calm[0] === 'reason')

// settling 최초 진입: 사실 먼저 + 감정 조절 텀(pause), 첫 스텝 expression
const settling = buildRetroSequence('settling', {})
check('settling sequence == SETTLING_ORDER', eq(settling, SETTLING_ORDER))
check('settling has pause', settling.includes('pause'))
check('settling first = expression (facts first)', settling[0] === 'expression')
check('settling: expression·childReaction before pause', settling.indexOf('childReaction') < settling.indexOf('pause'))
check('settling: reason·feeling after pause (감정 조절 텀 이후)', settling.indexOf('pause') < settling.indexOf('reason') && settling.indexOf('pause') < settling.indexOf('feeling'))

// B-2/B-3: 사실 seed 후 이어서/재개 → 깊은 회고 첫 미응답(reason)부터, 이미 답한 사실 스텝 제거·pause 없음
const resumed = buildRetroSequence('settling', { expressions: ['빨리 좀 해.'], childReactions: ['울었어요'] })
check('resume: expression skipped (중복 질문 없음)', !resumed.includes('expression'))
check('resume: childReaction skipped', !resumed.includes('childReaction'))
check('resume: no pause (감정 조절 텀 재노출 없음)', !resumed.includes('pause'))
check('resume: first unanswered = reason', resumed[0] === 'reason')
check('resume sequence == [reason,feeling,childSpeech,spousePresence]', eq(resumed, ['reason', 'feeling', 'childSpeech', 'spousePresence']))

// B-8: 모든 흐름의 마지막 선형 스텝 = spousePresence(부재자 확인 분기) → 결과 직행 없음
check('calm ends at spousePresence (부재자 확인)', calm[calm.length - 1] === 'spousePresence')
check('settling ends at spousePresence', settling[settling.length - 1] === 'spousePresence')
check('resume ends at spousePresence', resumed[resumed.length - 1] === 'spousePresence')

// nav 계약
check('settling next(expression)=childReaction', retroNext(settling, 'expression') === 'childReaction')
check('settling next(childReaction)=pause', retroNext(settling, 'childReaction') === 'pause')
check('settling next(pause)=reason (감정 조절 텀 후 합류)', retroNext(settling, 'pause') === 'reason')
check('settling prev(pause)=childReaction', retroPrev(settling, 'pause') === 'childReaction')
check('calm next(spousePresence)=null (분기 위임)', retroNext(calm, 'spousePresence') === null)
check('first step prev=null (화면 이탈)', retroPrev(settling, settling[0]) === null)

// 데이터 계약: 얕은 경유(사실 seed) union 이어서 == 깊은 직행의 전체 필수 스텝 집합
const settlingUnion = new Set([...settling.filter((s) => s !== 'pause'), ...resumed])
const calmRequired = new Set(CALM_ORDER)
check('데이터 계약 일치: settling 경유 스텝 union == calm 필수 스텝', eq([...settlingUnion].sort(), [...calmRequired].sort()))

// ── [Sprint 19] R-A~R-D: 회고② 내표현 장면별 정본 반영 후에도 흐름·조회 계약 유지 ──
// R-A: calm 시퀀스에 expression 포함 유지
check('R-A calm 시퀀스에 expression 포함 유지', calm.includes('expression'))
// R-B: settling 첫 스텝 = expression 유지
check('R-B settling 첫 스텝 = expression 유지', settling[0] === 'expression')
// R-C: seed 재개 시 expression 스킵 유지
check('R-C seed 재개 시 expression 스킵 유지', !resumed.includes('expression'))
// R-D: 5장면 각각에서 pool 조회가 정확히 5개를 반환
const poolScenes = Object.keys(expressionPool).filter((k) => !k.startsWith('_'))
check(
  'R-D 5장면 각각 pool 조회 = 5개 (총 25)',
  poolScenes.length === 5 && poolScenes.every((s) => Array.isArray(expressionPool[s]) && expressionPool[s].length === 5),
  `scenes=${poolScenes.length} lens=${JSON.stringify(poolScenes.map((s) => expressionPool[s].length))}`,
)

console.log(`\n== retroFlow: ${pass} passed, ${fail} failed ==`)
if (fail > 0) process.exit(1)
