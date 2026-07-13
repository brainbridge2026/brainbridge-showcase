-- [실서비스/공통] conflict_input 재구성 — data jsonb 중심
--   빌드지시서 5-A편 · 정본 근거: 리비전 v41 (C-67 스키마, C-69 CLI 연결, C-70 RLS)
--
-- 목적: 입력성 컬럼 10개를 제거하고 data jsonb 하나로 통합한다.
--   바깥 칸(id·conflict_id·member_id·is_sensitive·created_at)만 유지.
--   빈 테이블(데이터 0)이라 데이터 이전 불필요.
--
-- ★ 구조는 코드가 정의(아래 data 내부 구조), 테이블은 data 하나 —
--   흐름이 바뀌면 이 주석 + 5-B편 화면 저장부만 수정하고 스키마(테이블)는 안 건드린다(이것이 jsonb를 택한 이유).
--
-- data jsonb 내부 구조 (권장 형태 · DB는 강제 안 함 · 5-B편 화면이 이 형태로 저장):
--   {
--     // ① 관찰(시작 지점)
--     "situation": "숙제·공부",                 // 장면(상황축)
--     "parties": ["mom", "child"],              // 충돌 당사자
--     "observation": {
--       "child":  { "type": "딴데빠짐",   "text": "..." },   // ②아이행동
--       "parent": { "type": "여러번말함", "text": "..." }    // ③부모행동
--     },
--     // ② 회고(내면·4질문)
--     "intensity": "deep",                      // hot | shallow | deep
--     "ventText": null,                         // 뜨거움(hot)일 때만
--     "retro": {
--       "trigger": { "immediate": "거절감", "amplifier": ["반복성"] },  // 2층
--       "saidPhrases": [],                      // 회고② (C-50 확정 후 채움)
--       "childReaction": { "type": "회피", "text": "..." },              // 회고③ 6유형
--       "emotions": [ { "chip": "답답함", "level": "많이" } ]            // 회고④ 순서=현저성
--     },
--     // ③ 수렴(개입자·마음)
--     "interveners": [                          // 없으면 []. (C-51 반응유형 확정 후 채움)
--       { "member": "dad", "reaction": null, "myFeelingChange": null }
--     ],
--     "mind": { "shared": true, "reasons": ["예방", "아이이해"] },
--     // ④ 재개용
--     "stoppedAt": null                         // 중단 지점(재개). 완료면 null
--   }
--
-- ※ intensity·is_sensitive처럼 자주 조회·필터할 값은 나중에 generated column/별도 컬럼으로 승격 가능(지금은 안 함).

-- ─────────────────────────────────────────────────────────────
-- (a) 입력성 컬럼 10개 제거 (IF EXISTS로 안전 처리). "trigger"는 예약어라 따옴표.
-- ─────────────────────────────────────────────────────────────
alter table public.conflict_input
  drop column if exists specific_situation,
  drop column if exists coping,
  drop column if exists said_phrases,
  drop column if exists child_reaction,
  drop column if exists "trigger",
  drop column if exists emotions,
  drop column if exists intensity,
  drop column if exists free_text,
  drop column if exists emotion_state,
  drop column if exists vent_text;

-- ─────────────────────────────────────────────────────────────
-- (b) data jsonb 통합 컬럼 추가 (not null default '{}' → 삽입 시 항상 존재 보장)
-- ─────────────────────────────────────────────────────────────
alter table public.conflict_input
  add column if not exists data jsonb not null default '{}'::jsonb;

-- ─────────────────────────────────────────────────────────────
-- (c) RLS 정책 (C-70: 원본 비공유 게이트 — live 전용, showcase는 이 테이블 미사용)
--   자기 것(자기 member_id)만 조회/삽입. update/delete 정책은 만들지 않음
--   → append-only(원본 불변, 설계 §14) 기본 차단 유지.
-- ─────────────────────────────────────────────────────────────
create policy "own_input_select" on public.conflict_input
  for select using (member_id = auth.uid());

create policy "own_input_insert" on public.conflict_input
  for insert with check (member_id = auth.uid());

-- ★ RLS 활성화는 보류(정책만 생성). live 인증이 auth.uid()에 매핑되는지 미확인(개념 판단).
--   showcase는 이 테이블을 안 쓰므로 무관. 활성화는 live 인증 매핑 확정 후 — 기획 창 판단(리비전 v41, 빌드지시서 5-A §3).
--   확정되면 별도 마이그레이션에서 아래 한 줄을 실행:
-- alter table public.conflict_input enable row level security;
