-- [Sprint 17 · C-16 인증 축] member·family 부족 필드 추가 (추가만 · 파괴적 변경 없음)
--
-- 근거: BrainBridge_Sprint17_BuildPack_Candidate_v2 §2-A·§4-A + 대표 결정 3·4·5 (2026-07-22)
-- 정본 채택: 기존 family / member / magic_link 스키마를 그대로 쓴다(결정 1).
--   - Build Pack의 "family_member" = 실제 테이블 "member" (명칭 정정 = 기획 창 P-50).
--   - 초대 토큰 정본 = magic_link (token·expires_at 이미 존재, 결정 2). 토큰을 member에 중복 저장하지 않는다.
--
-- 원칙(결정 공통):
--   - 컬럼 삭제·이름 변경 금지. 추가만 한다.
--   - member.adhd_context 는 건드리지 않는다(결정 5). received_diagnosis 와 별개 필드로 공존.
--   - 데이터 0행 확인됨(family/member/magic_link) → 파괴적 위험 없음.
--   - 재실행 안전(idempotent): add column if not exists + 제약은 존재 검사 후 추가.

-- ─────────────────────────────────────────────────────────────
-- (1) member 추가 필드 (결정 3)
-- ─────────────────────────────────────────────────────────────
-- received_diagnosis: 받은 진단(선택). 미입력 허용(nullable) = 온보딩설계_v2 §2 P-9.
--   값: adhd / autism / other / none_or_unsure / prefer_not_to_say (또는 NULL).
alter table public.member
  add column if not exists received_diagnosis text;

-- child_direct_use: 역할이 자녀일 때만 의미(직접/대리 입력). boolean, nullable.
alter table public.member
  add column if not exists child_direct_use boolean;

-- received_diagnosis 허용값 CHECK (NULL 허용).
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'member_received_diagnosis_chk'
      and conrelid = 'public.member'::regclass
  ) then
    alter table public.member
      add constraint member_received_diagnosis_chk
      check (received_diagnosis is null or received_diagnosis in
        ('adhd','autism','other','none_or_unsure','prefer_not_to_say'));
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────
-- (2) family 추가 필드 (결정 3·4)
-- ─────────────────────────────────────────────────────────────
-- onboarding_step: 중간 이탈 후 재개 지점(A-4). 1~4, 기본 1.
alter table public.family
  add column if not exists onboarding_step integer not null default 1;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'family_onboarding_step_chk'
      and conrelid = 'public.family'::regclass
  ) then
    alter table public.family
      add constraint family_onboarding_step_chk
      check (onboarding_step between 1 and 4);
  end if;
end $$;

-- onboarding_status: 기존 컬럼 유지(결정 4). onboarding_completed 신규 생성 안 함.
--   값 체계 확정 = 'not_started' / 'in_progress' / 'completed'.
--   A-2 완료판정 = 'completed'. A-4 재개판정 = 'in_progress' + onboarding_step.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'family_onboarding_status_chk'
      and conrelid = 'public.family'::regclass
  ) then
    alter table public.family
      add constraint family_onboarding_status_chk
      check (onboarding_status in ('not_started','in_progress','completed'));
  end if;
end $$;
