// [저장배선 · Sprint 18 A-1] 저장 신분 소스 = C-16 magic_link 초대 토큰.
//
// 서버 save_conflict RPC 가 토큰으로 member/family 를 확정한다.
//   따라서 앱은 member_id 를 직접 만들어 보내지 않고 '토큰만' 넘긴다(Sprint 17 모델 일치).
//   이 방식이 클라이언트가 member_id/family_id 를 위조할 여지를 없앤다(R-10d·R-13).
//
// ★ Sprint 17 이전의 임시 신분 리터럴은 제거됐다. 실제 토큰 소스는 inviteToken.js 하나.
import { parseInviteToken } from '../utils/inviteToken'

// 현재 세션의 초대 토큰. 없으면 null (showcase 등 저장 비대상 · APP_MODE 분기에서 별도 가드).
export function getCurrentInviteToken() {
  return parseInviteToken()
}
