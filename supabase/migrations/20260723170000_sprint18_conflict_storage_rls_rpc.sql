-- [Sprint 18 · C-16 저장 축] conflict_log/conflict_input 저장 배선 + 접근제어 + append-only + RPC
--
-- 근거: BrainBridge_Sprint18_BuildPack_Candidate_v2 §2-A(S군)·§2-B(R군) + 대표 확정 1~4(2026-07-23)
--   + Pre-Build Schema Probe RESULT v1 실측(§1-A) + §8-A/§8-B 착수 전 재확인(두 테이블 0행·구조 일치).
--
-- 모델: Sprint 17 SECURITY DEFINER RPC 모델을 conflict 계열로 확장한다(새 인증모델 없음).
--   - conflict_input/conflict_log RLS enabled=true 유지, forced=false 유지(FORCE 미적용 확정 · S-3).
--   - anon/authenticated 직접 DML grant 회수(S-2) → 클라이언트는 magic_link 토큰 RPC로만 접근.
--   - append-only: 두 테이블 UPDATE/DELETE 차단 정책(S-3).
--   - auth.uid() 잔존 정책 제거(S-1) — 구성원은 Auth 사용자가 아니다(auth.users=0).
--   - A-10 재시도 중복 방지: conflict_log.idempotency_key + 부분 UNIQUE(대표 확정 1).

-- ─────────────────────────────────────────────────────────────
-- S-1. auth.uid() 잔존 정책 제거 (conflict_input)
-- ─────────────────────────────────────────────────────────────
drop policy if exists own_input_select on public.conflict_input;
drop policy if exists own_input_only   on public.conflict_input;
drop policy if exists own_input_insert on public.conflict_input;

-- conflict_log 의 no_update / no_delete 는 유지(append-only 의도와 일치).

-- ─────────────────────────────────────────────────────────────
-- S-2. 직접 DML grant 회수 (anon/authenticated). service_role 유지.
--   목표 = family/member/magic_link 와 동일(service_role만).
-- ─────────────────────────────────────────────────────────────
revoke all on table public.conflict_input from anon, authenticated;
revoke all on table public.conflict_log  from anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- S-3. append-only 강제 — conflict_input 에도 UPDATE/DELETE 차단 정책 신설
--   (conflict_log 는 no_update/no_delete 이미 존재 · 부모-자식 비대칭 해소)
--   RLS FORCE 는 적용하지 않는다(확정). service_role 운영 경로 유지.
-- ─────────────────────────────────────────────────────────────
alter table public.conflict_input enable row level security;  -- 방어적 재확인(이미 enabled)

drop policy if exists ci_no_update on public.conflict_input;
drop policy if exists ci_no_delete on public.conflict_input;
create policy ci_no_update on public.conflict_input for update using (false);
create policy ci_no_delete on public.conflict_input for delete using (false);

-- ─────────────────────────────────────────────────────────────
-- S-4. 인덱스 (FK 칼럼 · 범위 조회)
-- ─────────────────────────────────────────────────────────────
create index if not exists conflict_input_conflict_id_idx on public.conflict_input (conflict_id);
create index if not exists conflict_input_member_id_idx   on public.conflict_input (member_id);
create index if not exists conflict_log_family_id_idx     on public.conflict_log (family_id);

-- ─────────────────────────────────────────────────────────────
-- A-10. 재시도 중복 방지 — conflict_log.idempotency_key + 부분 UNIQUE (대표 확정 1)
--   클라이언트가 회고 1건당 무작위 키를 생성해 넘기고, save_conflict 가 동일 키 재호출 시
--   새 행을 만들지 않고 기존 ID를 반환한다. data 원문을 키로 쓰지 않는다.
-- ─────────────────────────────────────────────────────────────
alter table public.conflict_log
  add column if not exists idempotency_key text;

create unique index if not exists conflict_log_idempotency_key_uidx
  on public.conflict_log (idempotency_key)
  where idempotency_key is not null;

-- ─────────────────────────────────────────────────────────────
-- R-1. save_conflict — 저장 (SECURITY DEFINER · Sprint 17 규격 동일)
--   순서: ①토큰 일치 ②만료 ③family 범위(토큰에서) ④역할 판정 ⑤conflict_log ⑥conflict_input ⑦id 반환
--   ★ family_id/member_id 인자 없음(R-10a). member_id=토큰 당사자 고정(R-13). is_sensitive 미지정(default true).
-- ─────────────────────────────────────────────────────────────
create or replace function public.save_conflict(
  p_token           text,
  p_scene           text,
  p_depth           text,
  p_present_members jsonb   default null,
  p_data            jsonb   default '{}'::jsonb,
  p_idempotency_key text    default null
)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller   public.member;
  v_log_id   uuid;
  v_input_id uuid;
  v_existing public.conflict_log;
begin
  -- ①②③ 토큰 검증(일치+만료) → member 확정. 실패 시 generic 예외.
  v_caller := public.bb_verify_token(p_token);

  -- depth CHECK 사전 방어(DB CHECK 도 존재).
  if p_depth is null or p_depth not in ('received','shallow','deep') then
    raise exception 'invalid_input' using errcode = '22000';
  end if;

  -- ④ 역할 판정 (BuildPack §2-B 권한표):
  --   주양육자·배우자 허용. 자녀는 child_direct_use=true 이고 tier1(만7세 이하) 아닐 때만 허용.
  --   (tier1 = age <= 7, ageTier.js 기준. age NULL 은 tier1 아님 = tier2 취급.)
  if v_caller.role = 'child' then
    if not (coalesce(v_caller.child_direct_use, false) = true
            and (v_caller.age is null or v_caller.age > 7)) then
      raise exception 'not_authorized' using errcode = '42501';
    end if;
  elsif v_caller.role not in ('primary_caregiver','partner') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  -- A-10 멱등: 동일 키가 이미 있으면(같은 토큰 family 범위) 기존 ID 반환, 새 행 만들지 않음.
  if p_idempotency_key is not null then
    select * into v_existing
    from public.conflict_log
    where idempotency_key = p_idempotency_key
      and family_id = v_caller.family_id
    limit 1;
    if found then
      select ci.id into v_input_id
      from public.conflict_input ci
      where ci.conflict_id = v_existing.id and ci.member_id = v_caller.id
      order by ci.created_at asc limit 1;
      return json_build_object(
        'conflict_log_id',   v_existing.id,
        'conflict_input_id', v_input_id,
        'idempotent',        true);
    end if;
  end if;

  -- ⑤⑥ 한 트랜잭션(함수 본문은 단일 트랜잭션): 부모→자식.
  insert into public.conflict_log(family_id, scene, present_members, depth, idempotency_key)
  values (v_caller.family_id, p_scene, p_present_members, p_depth, p_idempotency_key)
  returning id into v_log_id;

  insert into public.conflict_input(conflict_id, member_id, data)  -- is_sensitive 미지정 → default true
  values (v_log_id, v_caller.id, coalesce(p_data, '{}'::jsonb))
  returning id into v_input_id;

  -- ⑦ id만 반환. data 내용 미반환.
  return json_build_object(
    'conflict_log_id',   v_log_id,
    'conflict_input_id', v_input_id,
    'idempotent',        false);
exception
  when unique_violation then
    -- 멱등 키 경합(동시 재시도): 기존 행을 조회해 반환.
    select * into v_existing from public.conflict_log
      where idempotency_key = p_idempotency_key and family_id = v_caller.family_id limit 1;
    if found then
      select ci.id into v_input_id from public.conflict_input ci
        where ci.conflict_id = v_existing.id and ci.member_id = v_caller.id
        order by ci.created_at asc limit 1;
      return json_build_object('conflict_log_id', v_existing.id, 'conflict_input_id', v_input_id, 'idempotent', true);
    end if;
    raise;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- R-2. get_family_conflicts — 가족 범위 목록 (data 원문 미반환)
-- ─────────────────────────────────────────────────────────────
create or replace function public.get_family_conflicts(p_token text)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller public.member;
  v_result json;
begin
  v_caller := public.bb_verify_token(p_token);
  select coalesce(json_agg(json_build_object(
      'id',          cl.id,
      'scene',       cl.scene,
      'depth',       cl.depth,
      'created_at',  cl.created_at,
      'input_count', (select count(*) from public.conflict_input ci where ci.conflict_id = cl.id)
    ) order by cl.created_at desc), '[]'::json)
  into v_result
  from public.conflict_log cl
  where cl.family_id = v_caller.family_id;   -- 범위는 토큰에서만
  return v_result;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- R-3. get_conflict_detail — 단건 상세 (★ 원본 입력 비공유 · R-11)
--   본인 입력만 data 원문 포함. 타 구성원 입력은 존재/건수만(내용 0).
-- ─────────────────────────────────────────────────────────────
create or replace function public.get_conflict_detail(p_token text, p_conflict_id uuid)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller public.member;
  v_log    public.conflict_log;
  v_self   json;
  v_others json;
begin
  v_caller := public.bb_verify_token(p_token);

  -- 토큰 family 소속 확인. 아니면 거부.
  select * into v_log from public.conflict_log
    where id = p_conflict_id and family_id = v_caller.family_id;
  if not found then
    raise exception 'not_found' using errcode = '42501';
  end if;

  -- 본인 입력: data 원문 포함.
  select coalesce(json_agg(json_build_object(
      'input_id',   ci.id,
      'member_id',  ci.member_id,
      'created_at', ci.created_at,
      'data',       ci.data) order by ci.created_at asc), '[]'::json)
  into v_self
  from public.conflict_input ci
  where ci.conflict_id = p_conflict_id and ci.member_id = v_caller.id;

  -- 타 구성원 입력: 존재/건수만. data 원문 절대 미포함.
  select coalesce(json_agg(json_build_object(
      'input_id',   ci.id,
      'member_id',  ci.member_id,
      'created_at', ci.created_at) order by ci.created_at asc), '[]'::json)
  into v_others
  from public.conflict_input ci
  where ci.conflict_id = p_conflict_id and ci.member_id <> v_caller.id;

  return json_build_object(
    'id',              v_log.id,
    'scene',           v_log.scene,
    'depth',           v_log.depth,
    'present_members', v_log.present_members,
    'created_at',      v_log.created_at,
    'own_inputs',      v_self,
    'other_inputs',    v_others,          -- data 없음
    'other_count',     json_array_length(v_others));
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- 실행 권한 — 공개 RPC 3종은 anon만(최소허용). public/authenticated 회수. UPDATE/DELETE RPC 없음(R-9).
-- ─────────────────────────────────────────────────────────────
revoke execute on function public.save_conflict(text,text,text,jsonb,jsonb,text) from public, authenticated;
revoke execute on function public.get_family_conflicts(text)                     from public, authenticated;
revoke execute on function public.get_conflict_detail(text,uuid)                 from public, authenticated;

grant execute on function public.save_conflict(text,text,text,jsonb,jsonb,text) to anon;
grant execute on function public.get_family_conflicts(text)                     to anon;
grant execute on function public.get_conflict_detail(text,uuid)                 to anon;

-- ★ 운영/서버 경로(service_role)에도 명시 grant (BuildPack §2-B 규격 = anon + service_role).
--   Supabase 기본권한이 service_role 에 직접 부여하지만, 마이그레이션을 자기완결·재적용 가능하게
--   명시한다(qa MAJOR 해소). service_role 은 클라이언트에 절대 투입하지 않는다(A-10·R-14).
grant execute on function public.save_conflict(text,text,text,jsonb,jsonb,text) to service_role;
grant execute on function public.get_family_conflicts(text)                     to service_role;
grant execute on function public.get_conflict_detail(text,uuid)                 to service_role;
