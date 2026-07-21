// [C-116] 위로 자동 로테이션 공용 유틸.
//  ResultScreen의 두 상태(부모위로풀 reassureText · 반복인정 repeatAckText) 생성 경로를 재사용하되,
//  "활성 세션 안 다음 적격 재진입에서 직전 문구와 즉시 중복 회피"를 위해 세션 메모리를 얹는다.
//
//  ★ 자산 원천 = C-14 부모위로풀(public/reassurePools.json · 14 tdCategory)
//               · C-14 반복인정(src/data/repeatAcknowledgment.json).
//  ★ 아동용 reassure_pools 혼입 0 — 이 유틸은 부모위로풀만 다룬다.
//  ★ 전체 새로고침 이후 영속 로테이션 = N/A(모듈 변수는 새로고침 시 리셋).

// 활성 세션에서 직전에 고른 부모위로풀 원본 문자열(fill 이전). 새로고침 시 리셋 → 영속 X.
let lastReassureRaw = null

// 부모위로풀 pool(배열)에서 1개 선택 — 직전 선택과 즉시 중복되지 않게 로테이션.
//  pool이 비었으면 null. 후보가 직전 1개뿐이면 그대로 사용(회피 불가 시 중복 허용).
//  ★ 세션 유지: 같은 렌더 세션에서는 이 함수를 1회만 호출해 결과를 고정한다(호출부 책임).
export function pickReassure(pool) {
  if (!pool || !pool.length) return null
  const candidates =
    pool.length > 1 ? pool.filter((x) => x !== lastReassureRaw) : pool
  const arr = candidates.length ? candidates : pool
  const picked = arr[Math.floor(Math.random() * arr.length)]
  lastReassureRaw = picked
  return picked
}

// 반복인정 tier 키 — 같은 td 완료 건수(이번 건 포함) 구간. count<2면 null(반복 데이터 없음 → 생략).
function repeatTierKey(sameTdCount) {
  if (sameTdCount === 2) return 'tier2'
  if (sameTdCount === 3 || sameTdCount === 4) return 'tier3_4'
  if (sameTdCount >= 5) return 'tier5plus'
  return null
}

// 활성 세션 반복인정 안정 캐시 — (tdNum + tier)별 최초 선택 문구를 고정.
//  ★ 반복인정은 풀 로테이션 대상이 아니다: 같은 td·같은 tier로 재진입하면 동일 문구,
//    반복 횟수가 다른 tier로 이동했을 때만 그 tier의 새 문구를 선택한다.
//  새로고침 시 모듈 리셋 → 영속 X(부모위로풀 로테이션과 동일 세션 범위).
const repeatAckCache = {}

// 반복인정 — 같은 td 완료 건수 기준 구간 문구 1개. (tdNum + tier) 기준 세션 내 안정 유지.
//  count<2면 null(생략, 무추론). 구간(tier)이 바뀔 때만 새 문구(풀 로테이션 대상 아님).
export function pickRepeatAck(repeatAck, sameTdCount, tdNum) {
  const tier = repeatTierKey(sameTdCount)
  if (!tier) return null
  const tierPool = repeatAck[tier]
  if (!tierPool || !tierPool.length) return null
  const cacheKey = `td${tdNum}:${tier}`
  // 같은 td·같은 tier면 세션 최초 선택을 그대로 반환(재진입해도 불변).
  if (repeatAckCache[cacheKey] != null) return repeatAckCache[cacheKey]
  const picked = tierPool[Math.floor(Math.random() * tierPool.length)]
  repeatAckCache[cacheKey] = picked
  return picked
}
