-- [Sprint 17 · C-16 인증 축] RLS/RPC 인증 계층 — SECURITY DEFINER RPC 모델
--
-- 근거: BuildPack v2 §2-A·§6-B + 대표 결정 6·7·8·9 (2026-07-22)
-- 정정: BuildPack §6-B가 그린 '테이블 정책' 형태는 성립 불가(구성원이 Supabase Auth 사용자가
--   아니고 auth.users=0, publishable 키는 정적·전역이라 요청별 신원 클레임 없음 → 테이블 레벨
--   RLS의 USING 절이 키로 삼을 세션이 없음). 목표(R-1·R-2·R-3)는 유지하고 강제 지점을
--   테이블 정책 → SECURITY DEFINER RPC로 옮긴다. = 기획 창 P-51.
--
-- 모델:
--   - family / member / magic_link 세 테이블은 RLS 활성 + permissive 정책 0개 = 전면 default-deny.
--   - anon/authenticated의 광범위 직접 DML grant는 회수 → 직접 테이블 접근 전면 차단(R-4).
--   - magic_link 토큰을 인자로 받는 SECURITY DEFINER 함수(owner=postgres, rolbypassrls)만 노출.
--   - anon에는 공개 RPC EXECUTE만 부여. 내부 검증 헬퍼는 anon에 EXECUTE 주지 않음(definer 체인 전용).
--
-- 각 RPC 검증 순서(결정 7): ①토큰 일치 ②만료(expires_at) ③토큰 소속 family로 범위 강제(R-1)
--   ④역할 확인(주양육자만 추가·수정, R-2). 하나라도 실패하면 거부, 부분통과 반환 금지.
-- A-7: 예외는 generic 코드만(내부 ID·테이블명·SQL 원문 비노출). A-10: 토큰 원문을 반환값에 넣지 않음.

-- ─────────────────────────────────────────────────────────────
-- (0) 세 테이블 RLS 활성 보장 (이미 enabled · 방어적 재확인). permissive 정책은 만들지 않는다.
-- ─────────────────────────────────────────────────────────────
alter table public.family     enable row level security;
alter table public.member     enable row level security;
alter table public.magic_link enable row level security;

-- ─────────────────────────────────────────────────────────────
-- (1) 광범위 직접 DML grant 회수 (결정 7 · R-4). anon/authenticated 직접 접근 차단.
-- ─────────────────────────────────────────────────────────────
revoke all on table public.family     from anon, authenticated;
revoke all on table public.member     from anon, authenticated;
revoke all on table public.magic_link from anon, authenticated;

-- A-9(중복 구성원 0) 대비: 같은 family 내 (name,role) 유일. 추가만.
create unique index if not exists member_family_name_role_uidx
  on public.member (family_id, lower(name), role);

-- ─────────────────────────────────────────────────────────────
-- (2) 내부 헬퍼: 토큰 검증(일치+만료). anon에 노출하지 않음.
--   성공 시 member 반환 + last_used_at 갱신. 실패 시 generic 예외.
-- ─────────────────────────────────────────────────────────────
create or replace function public.bb_verify_token(p_token text)
returns public.member
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member public.member;
begin
  if p_token is null or length(p_token) < 20 then
    raise exception 'invite_invalid' using errcode = '28000';
  end if;
  select m.* into v_member
  from public.magic_link ml
  join public.member m on m.id = ml.member_id
  where ml.token = p_token
    and ml.expires_at > now()
  limit 1;
  if not found then
    raise exception 'invite_invalid' using errcode = '28000';
  end if;
  update public.magic_link set last_used_at = now() where token = p_token;
  return v_member;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- (3) 공개 RPC ① redeem_invite — 토큰 검증 후 세션 컨텍스트 반환(토큰 미포함).
--   역할 기반 라우팅은 클라이언트가 role/onboarding_status로 결정(A-1/A-2/A-3).
-- ─────────────────────────────────────────────────────────────
create or replace function public.redeem_invite(p_token text)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member public.member;
  v_family public.family;
begin
  v_member := public.bb_verify_token(p_token);
  select * into v_family from public.family where id = v_member.family_id;
  return json_build_object(
    'member_id',         v_member.id,
    'member_name',       v_member.name,
    'role',              v_member.role,
    'family_id',         v_member.family_id,
    'family_name',       v_family.display_name,
    'onboarding_status', v_family.onboarding_status,
    'onboarding_step',   v_family.onboarding_step
  );
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- (4) 공개 RPC ② get_family_members — 토큰 소속 family의 구성원만(R-1). 토큰 미포함.
-- ─────────────────────────────────────────────────────────────
create or replace function public.get_family_members(p_token text)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member public.member;
  v_result json;
begin
  v_member := public.bb_verify_token(p_token);
  select coalesce(json_agg(json_build_object(
      'member_id',          m.id,
      'name',               m.name,
      'role',               m.role,
      'age',                m.age,
      'received_diagnosis', m.received_diagnosis,
      'child_direct_use',   m.child_direct_use,
      'invite_ready',       exists(
        select 1 from public.magic_link ml
        where ml.member_id = m.id and ml.expires_at > now())
    ) order by m.created_at), '[]'::json)
  into v_result
  from public.member m
  where m.family_id = v_member.family_id;   -- 범위는 토큰에서만, 클라이언트 인자 불신
  return v_result;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- (5) 공개 RPC ③ add_family_member — 주양육자만(R-2). 구성원 추가 + 2차 토큰 발급(A-6).
--   A-9: 동일 (family,name,role) 재제출 시 새 행/토큰 만들지 않음(idempotent).
--   토큰 원문 미반환(A-10). invite_ready 플래그만.
-- ─────────────────────────────────────────────────────────────
create or replace function public.add_family_member(
  p_token               text,
  p_name                text,
  p_role                text,
  p_age                 integer default null,
  p_sex                 text    default null,
  p_received_diagnosis  text    default null,
  p_child_direct_use    boolean default null
)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller   public.member;
  v_member   public.member;
  v_existing public.member;
  v_token    text;
begin
  v_caller := public.bb_verify_token(p_token);

  -- 실제 role 어휘(member_role_check): primary_caregiver / child / partner. sex: male / female.
  if v_caller.role <> 'primary_caregiver' then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_name is null or length(btrim(p_name)) = 0 then
    raise exception 'invalid_input' using errcode = '22000';
  end if;
  if p_role not in ('partner','child') then
    raise exception 'invalid_input' using errcode = '22000';
  end if;
  if p_sex is not null and p_sex not in ('male','female') then
    raise exception 'invalid_input' using errcode = '22000';
  end if;
  if p_received_diagnosis is not null
     and p_received_diagnosis not in ('adhd','autism','other','none_or_unsure','prefer_not_to_say') then
    raise exception 'invalid_input' using errcode = '22000';
  end if;

  -- A-9 idempotent
  select * into v_existing from public.member
  where family_id = v_caller.family_id
    and lower(name) = lower(btrim(p_name))
    and role = p_role
  limit 1;
  if found then
    return json_build_object(
      'member_id', v_existing.id, 'name', v_existing.name, 'role', v_existing.role,
      'invite_ready', exists(select 1 from public.magic_link ml
        where ml.member_id = v_existing.id and ml.expires_at > now()),
      'created', false);
  end if;

  insert into public.member(family_id, name, role, age, sex, received_diagnosis, child_direct_use)
  values (v_caller.family_id, btrim(p_name), p_role, p_age, p_sex, p_received_diagnosis, p_child_direct_use)
  returning * into v_member;

  -- 2차 초대 토큰: ≥128bit(256bit hex), 30일 만료.
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.magic_link(member_id, token, expires_at)
  values (v_member.id, v_token, now() + interval '30 days');

  return json_build_object(
    'member_id', v_member.id, 'name', v_member.name, 'role', v_member.role,
    'invite_ready', true, 'created', true);
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- (6) 공개 RPC ④ update_onboarding — 주양육자만(R-2), 토큰 소속 family만(R-1).
--   값 검증: status 3종 / step 1~4.
-- ─────────────────────────────────────────────────────────────
create or replace function public.update_onboarding(
  p_token  text,
  p_status text,
  p_step   integer
)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller public.member;
begin
  v_caller := public.bb_verify_token(p_token);
  if v_caller.role <> 'primary_caregiver' then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_status not in ('not_started','in_progress','completed') then
    raise exception 'invalid_input' using errcode = '22000';
  end if;
  if p_step < 1 or p_step > 4 then
    raise exception 'invalid_input' using errcode = '22000';
  end if;
  update public.family
     set onboarding_status = p_status,
         onboarding_step    = p_step
   where id = v_caller.family_id;    -- R-1 범위
  return json_build_object('onboarding_status', p_status, 'onboarding_step', p_step);
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- (7) 실행 권한.
--   ★ Supabase는 default privileges로 신규 함수 EXECUTE를 anon/authenticated/service_role에
--     '직접' 부여한다(PUBLIC 경유 아님). 따라서 PUBLIC 회수만으로는 anon이 남는다 →
--     내부 헬퍼 bb_verify_token은 anon·authenticated에서 '명시적으로' 회수한다(최소 허용).
--   공개 RPC 4종은 default privileges로 이미 anon에 부여됨(명시 grant는 방어적 재확인).
-- ─────────────────────────────────────────────────────────────
-- 내부 헬퍼: anon/authenticated/public 모두 회수. definer 체인(owner=postgres)으로만 호출.
revoke execute on function public.bb_verify_token(text) from public, anon, authenticated;

-- 공개 RPC: public·authenticated 회수 후 anon만 부여(최소 허용 · qa MINOR-3).
--  현재 auth.users=0이라 authenticated 사용자는 없지만, default privileges 잔존분을 명시 회수해
--  '초대(anon) 경로만' 노출한다. 회원가입(§9) 도입 시 authenticated 재부여는 그때 결정.
revoke execute on function public.redeem_invite(text)                                               from public, authenticated;
revoke execute on function public.get_family_members(text)                                          from public, authenticated;
revoke execute on function public.add_family_member(text,text,text,integer,text,text,boolean)       from public, authenticated;
revoke execute on function public.update_onboarding(text,text,integer)                              from public, authenticated;

grant  execute on function public.redeem_invite(text)                                               to anon;
grant  execute on function public.get_family_members(text)                                          to anon;
grant  execute on function public.add_family_member(text,text,text,integer,text,text,boolean)       to anon;
grant  execute on function public.update_onboarding(text,text,integer)                              to anon;

-- ─────────────────────────────────────────────────────────────
-- (8) 공개 RPC ⑤ update_self_profile — 호출자 '본인'(토큰 소속) member 행의 성별·받은 진단만 갱신.
--   온보딩 1화면(주양육자 본인 프로필)용. 역할 무관(자기 자신). 이름·역할·family_id는 변경 불가.
--   R-1: 토큰의 member_id로만 범위. coalesce로 null 인자는 기존값 유지(부분 갱신).
-- ─────────────────────────────────────────────────────────────
create or replace function public.update_self_profile(
  p_token              text,
  p_sex                text default null,
  p_received_diagnosis text default null
)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller public.member;
begin
  v_caller := public.bb_verify_token(p_token);
  if p_sex is not null and p_sex not in ('male','female') then
    raise exception 'invalid_input' using errcode = '22000';
  end if;
  if p_received_diagnosis is not null
     and p_received_diagnosis not in ('adhd','autism','other','none_or_unsure','prefer_not_to_say') then
    raise exception 'invalid_input' using errcode = '22000';
  end if;
  update public.member
     set sex                = coalesce(p_sex, sex),
         received_diagnosis = coalesce(p_received_diagnosis, received_diagnosis)
   where id = v_caller.id;    -- 본인 행만
  return json_build_object('member_id', v_caller.id, 'ok', true);
end;
$$;
revoke execute on function public.update_self_profile(text,text,text) from public, authenticated;
grant  execute on function public.update_self_profile(text,text,text) to anon;
