// 아이 나이(만 나이) → 아이용 리포트 age_tier 계산.
//  td_json sections.D 구조: tier1(5~7세) / tier2(8~10세) / tier3(11세+).
//  나이 정보가 없으면(온보딩에서 아직 안 받은 경우 등) tier2를 기본값으로 유지.
//  (리비전 트래커 C-17: 프로필 나이 → tier 계산 로직)
export function getAgeTier(age) {
  const n = Number(age)
  if (!Number.isFinite(n)) return 'tier2' // 나이 미상 → 기본값
  if (n <= 7) return 'tier1' // 구간1 (5~7세)
  if (n <= 10) return 'tier2' // 구간2 (8~10세)
  return 'tier3' // 구간3 (11세+)
}
