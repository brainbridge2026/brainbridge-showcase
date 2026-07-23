// [저장배선 · Sprint 18 A-2·A-4] conflict 저장 = save_conflict RPC.
//
// ★ RLS 는 켜져 있고(enabled=true, forced=false), conflict_input·conflict_log 의 anon·authenticated
//   직접 DML grant 는 회수됐다. 클라이언트 저장 경로는 오직 magic_link 토큰 기반 SECURITY DEFINER
//   RPC(`save_conflict`) 하나다. 직접 테이블 insert 는 하지 않는다(Sprint 17 인증 모델 확장).
//   (Sprint 18 이전 주석의 "RLS 꺼진 상태" 기술은 실측과 반대여서 정정됨 — A-4.)
//
// showcase 모드에선 이 모듈이 호출되지 않는다(App.jsx APP_MODE 분기). live 모드에서만 호출되므로
// 클라이언트는 lazy 생성한다 — env 없으면 null 을 돌려 showcase 빌드가 깨지지 않게 한다.
//
// ★ L군: 초대 토큰 원문·data jsonb 원문을 로그에 쓰지 않는다. 오류는 error.code 만 남긴다.
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

let _client = null
function getSupabase() {
  if (!url || !anonKey) return null // env 미설정(showcase 등) → 저장 비활성
  if (!_client) _client = createClient(url, anonKey, { auth: { persistSession: false } })
  return _client
}

// save_conflict(p_token, p_scene, p_depth, p_present_members, p_data, p_idempotency_key)
//   서버가 토큰으로 member/family 확정 · conflict_log(부모)+conflict_input(자식)을 한 트랜잭션 생성.
//   반환 = { conflict_log_id, conflict_input_id, idempotent }. data 내용은 반환하지 않는다.
//   idempotencyKey 동일 재호출 시 서버가 기존 ID 반환(중복 행 0 · A-10).
export async function saveConflict({ token, scene = null, depth, presentMembers = null, data = {}, idempotencyKey = null }) {
  const sb = getSupabase()
  if (!sb) {
    console.warn('[saveConflict] Supabase env 미설정 — 저장 생략')
    return { ok: false, reason: 'no-client' }
  }
  if (!token) {
    console.warn('[saveConflict] 초대 토큰 없음 — 저장 생략')
    return { ok: false, reason: 'no-token' }
  }
  const { data: row, error } = await sb.rpc('save_conflict', {
    p_token: token,
    p_scene: scene,
    p_depth: depth,
    p_present_members: presentMembers,
    p_data: data ?? {},
    p_idempotency_key: idempotencyKey,
  })
  if (error) {
    // ★ 토큰·data·요청 본문을 찍지 않는다 — 코드만(L-1).
    console.error('[saveConflict] insert 실패 code=', error.code ?? 'error')
    return { ok: false, reason: error.code ?? 'error' }
  }
  return { ok: true, ids: row }
}
