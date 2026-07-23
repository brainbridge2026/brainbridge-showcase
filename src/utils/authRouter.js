// [Sprint 17 · C-16] 역할 기반 라우팅 결정 (온보딩설계_v2 §4 · 19-g)
//
// 순수 함수: redeem_invite 결과(세션 컨텍스트)를 받아 어디로 보낼지만 결정한다.
//   토큰 파싱·검증은 inviteToken.js(→ 서버 RPC)가 이미 끝냈다. 여기서 인증하지 않는다.
//
// 규칙(§4):
//   주양육자(primary_caregiver)?
//     ├ onboarding_status='completed' → 홈
//     └ 그 외(not_started/in_progress) → 온보딩(onboarding_step부터 재개)
//   배우자(partner)·자녀(child) → 바로 홈 (프로필 이미 반영됨)
//
// ★ 역할 값은 서버 프로필에서 온 것(URL 아님). 실제 스키마 어휘: primary_caregiver / partner / child.

export const ROUTE = { ONBOARDING: 'onboarding', HOME: 'home', DENIED: 'denied' }

// redeemResult = { ok, data, reason }
export function decideRoute(redeemResult) {
  if (!redeemResult || !redeemResult.ok || !redeemResult.data) {
    // 위조·만료·존재하지 않는 토큰 등 (A-7). 내부 사유는 화면에 노출하지 않는다.
    return { route: ROUTE.DENIED, session: null, resumeStep: null }
  }
  const s = redeemResult.data
  const session = {
    memberId: s.member_id,
    memberName: s.member_name,
    role: s.role,
    familyId: s.family_id,
    familyName: s.family_name,
    onboardingStatus: s.onboarding_status,
    onboardingStep: s.onboarding_step,
  }
  const isPrimary = session.role === 'primary_caregiver'
  if (isPrimary && session.onboardingStatus !== 'completed') {
    // 1~4 범위 보정. 저장된 step부터 재개(A-4).
    const step = Math.min(4, Math.max(1, Number(session.onboardingStep) || 1))
    return { route: ROUTE.ONBOARDING, session, resumeStep: step }
  }
  // 주양육자(완료) · 배우자 · 자녀 → 홈
  return { route: ROUTE.HOME, session, resumeStep: null }
}
