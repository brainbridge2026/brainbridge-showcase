// [저장배선 5-B · §3-B] conflict_input.member_id 신분 소스 — 단계별 교체 지점
//
// 이 함수 하나가 알파(매직링크) ↔ 베타(로그인) 교체 지점이다.
// 저장 구조(saveConflictInput)·호출부는 이 함수가 바뀌어도 불변이어야 한다(시그니처 유지).
//
// ★ 지금은 임시 표식만 반환한다. ?viewer= 파라미터(showcase 전용)는 저장 신분으로 끌어오지 않는다
//   — showcase 미리보기와 저장배선은 완전히 분리(대표 지시).
export function getCurrentMemberId() {
  // TODO: C-16 매직링크 착수 시 실제 구성원 신분으로 교체 — 이 함수 내부만 교체, 저장구조·호출부 불변.
  //   (베타: return supabase.auth.getUser().id 기반 member_id 매핑)
  return 'PENDING_MAGICLINK'
}
