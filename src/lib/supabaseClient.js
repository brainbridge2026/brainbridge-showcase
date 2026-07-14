// [저장배선 5-B · §2·§5.2] Supabase 클라이언트 (첫 도입) + conflict_input insert
//
// showcase 모드에선 이 모듈의 saveConflictInput이 아예 호출되지 않는다(App.jsx 분기).
// live 모드에서만 호출되므로, 클라이언트는 lazy 생성한다 —
// env(VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)가 없으면 null을 돌려 showcase 빌드가 깨지지 않게 한다.
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

let _client = null
function getSupabase() {
  if (!url || !anonKey) return null // env 미설정(showcase 등) → 저장 비활성
  if (!_client) _client = createClient(url, anonKey)
  return _client
}

// conflict_input 테이블(C-67 확정, 컬럼 6개: id·conflict_id·member_id·is_sensitive·created_at·data)
//   id·created_at 은 DB 자동. 나머지 4개를 넘긴다. data 는 jsonb.
// ★ RLS 는 꺼진 상태로 작업(C-70 — live 인증 auth.uid() 매핑 확정 후 켬, 기획 창 판단). 여기서 켜지 않는다.
export async function saveConflictInput({ conflict_id, member_id, is_sensitive = false, data }) {
  const sb = getSupabase()
  if (!sb) {
    console.warn('[saveConflictInput] Supabase env 미설정 — 저장 생략')
    return { ok: false, reason: 'no-client' }
  }
  const { data: row, error } = await sb
    .from('conflict_input')
    .insert({ conflict_id, member_id, is_sensitive, data })
    .select()
    .single()
  if (error) {
    console.error('[saveConflictInput] insert 실패:', error.message)
    return { ok: false, reason: error.message }
  }
  return { ok: true, row }
}
