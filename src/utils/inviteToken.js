// [Sprint 17 · C-16] 초대 토큰 클라이언트 인터페이스
//
// ★ 토큰의 '생성·검증·만료'는 서버(Supabase)의 SECURITY DEFINER RPC + magic_link 테이블이 담당한다.
//   (P-49/P-51: 추측 불가능한 무작위 토큰을 서버가 검증. 클라이언트는 토큰 원문을 저장·가공하지 않는다.)
//   이 모듈은 그 RPC를 부르는 '얇은 클라이언트'일 뿐이다 — 인증 판정 로직을 클라이언트에 두지 않는다.
//
// 사용 키 = publishable(anon) 하나. secret 키는 절대 사용하지 않는다.
// showcase(초대 토큰 없는 진입)에서는 이 모듈이 호출되지 않으므로 네트워크·클라이언트 생성이 없다.
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

let _client = null
function client() {
  if (!url || !anonKey) return null
  if (!_client) _client = createClient(url, anonKey, { auth: { persistSession: false } })
  return _client
}

// URL에서 초대 토큰만 추출한다. 파라미터명 = invite.
//  역할·가족ID·구성원ID는 URL에 싣지 않는다(위조 방지, 19-f/P-49). 오직 토큰 하나.
export function parseInviteToken(search = window.location.search) {
  const t = new URLSearchParams(search).get('invite')
  return t && t.trim() ? t.trim() : null
}

// 공통 RPC 호출. { ok, data, reason } 반환. 토큰 원문은 로그/반환 메시지에 넣지 않는다(A-10).
async function callRpc(fn, params) {
  const sb = client()
  if (!sb) return { ok: false, reason: 'no-client' }
  const { data, error } = await sb.rpc(fn, params)
  if (error) return { ok: false, reason: error.message || 'error' }
  return { ok: true, data }
}

// 토큰 검증 → 세션 컨텍스트(역할·온보딩 상태 등). 토큰 미포함 반환.
export function redeemInvite(token) {
  return callRpc('redeem_invite', { p_token: token })
}
export function getFamilyMembers(token) {
  return callRpc('get_family_members', { p_token: token })
}
export function addFamilyMember(token, { name, role, age, sex, receivedDiagnosis, childDirectUse }) {
  return callRpc('add_family_member', {
    p_token: token,
    p_name: name,
    p_role: role,
    p_age: age ?? null,
    p_sex: sex ?? null,
    p_received_diagnosis: receivedDiagnosis ?? null,
    p_child_direct_use: childDirectUse ?? null,
  })
}
export function updateOnboarding(token, status, step) {
  return callRpc('update_onboarding', { p_token: token, p_status: status, p_step: step })
}
export function updateSelfProfile(token, { sex, receivedDiagnosis }) {
  return callRpc('update_self_profile', {
    p_token: token,
    p_sex: sex ?? null,
    p_received_diagnosis: receivedDiagnosis ?? null,
  })
}
