import { useState, useEffect, useMemo } from 'react'
import HomeScreen from './screens/HomeScreen'
import CountScreen from './screens/CountScreen'
import NoConflictScreen from './screens/NoConflictScreen'
import WhoScreen from './screens/WhoScreen'
import SituationScreen from './screens/SituationScreen'
import ChildBehaviorScreen from './screens/ChildBehaviorScreen'
import ParentBehaviorScreen from './screens/ParentBehaviorScreen'
import MoodScreen from './screens/MoodScreen'
import PlaceholderScreen from './screens/PlaceholderScreen'
import ConflictScreen, { SPOUSE_PRESENCE_OPTIONS } from './screens/ConflictScreen'
import DoneScreen from './screens/DoneScreen'
import ResultScreen from './screens/ResultScreen'
import ReportScreen from './screens/ReportScreen'
import ChildReportScreen from './screens/ChildReportScreen'
import MissionScreen from './screens/MissionScreen'
import SituationPickerScreen from './screens/SituationPickerScreen'
import ReviewScreen from './screens/ReviewScreen'
import SpouseResultScreen from './screens/SpouseResultScreen'
import AnotherAskScreen from './screens/AnotherAskScreen'
import BurnoutScreen from './screens/BurnoutScreen'
import AcceptScreen from './screens/AcceptScreen'
import OnboardingScreen from './screens/OnboardingScreen'
import PhoneFrame from './components/PhoneFrame'
import { styles } from './theme'
import { texts } from './texts'
import { findByRelation } from './data/familyMembers'
import { matchTdToInput } from './utils/matchTd'
import { saveConflictInput } from './lib/supabaseClient'
import { getCurrentMemberId } from './lib/identity'
import { parseInviteToken, redeemInvite } from './utils/inviteToken'
import { decideRoute, ROUTE } from './utils/authRouter'

// 나중에 실제 사용자 이름으로 쉽게 바꿀 수 있도록 이름을 변수로 관리합니다.
// [C-16] 초대(세션)로 들어오면 그 구성원 이름으로 대체된다. 초대 없으면 이 기본값(showcase 무변경).
const DEFAULT_USER_NAME = '현정'
const MAX_CASES = 3

// [C-16] 초대 확인 중 / 확인 실패(A-7: 내부 사유·오류 원문 비노출) — "초대" 용어만.
function InviteLoading() {
  return (
    <PhoneFrame>
      <p style={{ ...styles.subText, textAlign: 'center' }}>{texts.onboarding.loading}</p>
    </PhoneFrame>
  )
}
function InviteDenied({ onHome }) {
  return (
    <PhoneFrame>
      <div>
        <h1 style={styles.question}>{texts.onboarding.deniedTitle}</h1>
        <p style={{ ...styles.subText, marginTop: '12px' }}>{texts.onboarding.deniedBody}</p>
        <div style={styles.footer}>
          <button style={styles.primaryButton} onClick={onHome}>{texts.onboarding.deniedHome}</button>
        </div>
      </div>
    </PhoneFrame>
  )
}

// [SHOWCASE/LIVE 분기 · 5-B §3-A] 저장만 갈린다. 매칭·리포트는 두 모드 공통(항상 실작동).
//   미설정/그 외 = showcase(저장 안 함). 'live' 일 때만 conflict_input 에 저장.
const APP_MODE = import.meta.env.VITE_APP_MODE === 'live' ? 'live' : 'showcase'

// [5-B §1] current(취합된 1건) → conflict_input.data (jsonb) 매핑.
//   ★ 지시서 §1 표의 data 필드명을 정본으로 쓴다. 해당 갈래(개입자/마음) 필드만 채운다.
function buildConflictData(c) {
  // [C-93] 개입자/마음 저장 갈래의 소스 = 재석 답(spousePresent).
  //  ★ 비교값 = ConflictScreen이 쓰는 SPOUSE_PRESENCE_OPTIONS[0](=있었음) 단일 정본.
  //    spousePresent는 다른 스텝(emotions 등)과 동일하게 '한국어 라벨 문자열'로 저장되므로
  //    (mood 같은 코드키 아님), 라벨→불리언 임의 변환 없이 그 라벨 상수를 그대로 비교한다.
  //    이렇게 하면 흐름 분기(ConflictScreen)와 저장 갈래(여기)가 같은 상수를 봐 드리프트가 없다.
  //  ※ null/미일치면 else(마음 갈래). spousePresence 스텝은 선택 필수라 정상 흐름에선 항상 둘 중 하나.
  const spouseWasPresent = c.spousePresent === SPOUSE_PRESENCE_OPTIONS[0]
  const data = {
    // 1-A 시작 지점·공통
    whoSelectedIds: c.whoSelectedIds,
    // [C-93] 필드명 유지(5-B). 값 소스만 who→재석 답으로 이관(§2 계약) — 저장 레코드 정합용.
    spouseIncluded: spouseWasPresent,
    scene: c.scene,
    childType: c.childType,
    childText: c.childText,
    parentType: c.parentType,
    parentText: c.parentText,
    mood: c.mood, // 코드키 정본 hard|settling|calm (안 바꿈)
    // 1-B 회고 국면
    // [C-53] reason 2층 {immediate, amplifiers} (확정본 C · 작업2 반영 완료본)
    reason: c.reason ?? null,
    // ★ 필드명 = 실제 코드 state 키를 정본으로(지시서 §1-B 표기 정정). emotions/childReactions 복수형 유지.
    emotions: c.emotions ?? [], // 회고④ 감정칩(순서=현저성)
    childReactions: c.childReactions ?? [], // 회고③ 아이반응
    childSpeech: c.childSpeech ?? [],
    // [임시공통] C-50·C-75·C-76·C-77 정식화 시 값 세트 교체(저장구조는 유지)
    expressions: c.expressions ?? [], // 회고② 내표현
    // [임시공통] C-50 정식화 시 값 세트 교체(저장구조는 유지)
    coping: c.coping ?? [], // C-110: 회고 coping 스텝 폐기(정본 부재·매칭 미사용). 스키마 유지 위해 빈 배열 저장.
    intensity: c.intensity ?? null, // 감정칩 강도 (feeling 스텝의 일부)
    // [C-93] 배우자 재석 답 원답(라벨) 그대로 보존. 갈래 판정은 위 spouseWasPresent가 담당.
    spousePresent: c.spousePresent ?? null,
  }
  // 1-D 개입자 갈래 (재석=있었음일 때만). jsonb 필드명은 5-B 그대로 유지.
  if (spouseWasPresent) {
    // [임시공통] C-77 정식화 시 값 세트 교체(저장구조는 유지)
    data.spouseActions = c.spouseActions ?? []
    data.spouseEmotions = c.spouseEmotions ?? []
  } else {
    // 1-E 마음 갈래 (재석=없었음/미선택일 때). jsonb 필드명은 5-B 그대로 유지.
    data.shareReasons = c.shareReasons ?? []
    data.shareChoice = c.shareChoice ?? null // 공유/미공유 갈래 표시 (5-B에서 담게 추가)
  }
  return data
}

// 항상 한 건만 진행 중. 한 건 완료해야 다음 건 시작 가능.
// home → count → [누구와 → 상황 → 지금마음 → (깊은회고 B~I)] → done → (다른 일도?) → 반복
export default function App() {
  // URL의 ?screen= 값으로 시작 화면을 지정할 수 있다 (예: ?screen=result).
  // 값이 없으면 홈에서 시작.
  const [screen, setScreen] = useState(
    new URLSearchParams(window.location.search).get('screen') || 'home',
  )
  const [count, setCount] = useState(null) // 'once' | 'multiple'
  const [cases, setCases] = useState([]) // 완료/미완료 건 목록
  const [current, setCurrent] = useState(null) // 지금 편집 중인 건
  const [conflictBack, setConflictBack] = useState('mood') // 깊은회고 뒤로 목적지
  // [C-25 정정] 회고 모드 — 'calm'(깊은 회고 바로) | 'settling'(사실 먼저 + 감정 조절 텀 후 깊은 회고 합류).
  const [retroMode, setRetroMode] = useState('calm')
  const [matchResult, setMatchResult] = useState(null) // matchTdToInput 결과 {num,title,...}

  // [C-16] 초대 토큰 진입 — 있을 때만 동작. 없으면 아래 전부 무효과(showcase/뷰어 경로 무변경).
  const inviteToken = useMemo(() => parseInviteToken(), [])
  const [auth, setAuth] = useState(inviteToken ? { status: 'loading' } : { status: 'none' })
  useEffect(() => {
    if (!inviteToken) return
    let alive = true
    redeemInvite(inviteToken).then((r) => {
      if (!alive) return
      setAuth({ status: 'ready', ...decideRoute(r) })
    })
    return () => { alive = false }
  }, [inviteToken])
  const authSession = auth.session || null
  // 초대 세션이면 그 구성원 이름을, 아니면 기본값(showcase).
  const userName = authSession?.memberName || DEFAULT_USER_NAME

  // 보는 사람. ?viewer=spouse 로 진입하면 정민님(배우자) 경로로 흐른다.
  //  (실서비스에선 로그인한 사용자 기준으로 자동 결정)
  const viewer = new URLSearchParams(window.location.search).get('viewer')

  const go = (next) => () => setScreen(next)

  // [C-93] who에서 배우자 재석을 계산하지 않으므로 spouse 변수 불필요(제거).
  //  배우자 판별은 WhoScreen(단독 선택 안내)·ConflictScreen(재석 질문)이 각자 담당.
  const childName = findByRelation('아이')?.name ?? '아이'
  const completedCount = cases.filter((x) => x.status === 'complete').length
  const incompleteCases = cases.filter((x) => x.status === 'incomplete')

  const upsertCase = (c) =>
    setCases((prev) =>
      prev.some((x) => x.id === c.id)
        ? prev.map((x) => (x.id === c.id ? c : x))
        : [...prev, c],
    )

  // 새 건 시작
  const startCase = () => {
    setCurrent({
      id: `${Date.now()}-${Math.random()}`,
      whoSelectedIds: [],
      scene: null,
      spouseIncluded: false,
      mood: null,
      status: 'draft',
    })
    setScreen('who')
  }

  // 부딪힌 횟수
  const handleCountStart = (kind) => {
    setCount(kind)
    startCase()
  }

  // 누구와 → 상황
  const handleWhoNext = (selectedIds) => {
    // C-93: spouseIncluded 소스는 ConflictScreen 재석 질문으로 이관.
    //  who는 사건의 상대만 결정한다. spouseIncluded는 startCase 초기값(false) 유지 —
    //  여기서 세팅하지 않는다. (?spouse=1 수동 파라미터 경로는 Result/Report에서 별도로 살아있음)
    setCurrent({
      ...current,
      whoSelectedIds: selectedIds, // 배열 유지(길이 1) — 호출부 계약
    })
    setScreen('situation')
  }

  // 상황 → ②아이행동 (빌드지시서 4편 C: situation → childBehavior → parentBehavior → mood)
  const handleSituationNext = (scene) => {
    setCurrent({ ...current, scene })
    setScreen('childBehavior')
  }

  // ② 아이행동 선택 저장 → ③ 부모행동으로 직행.
  // [C-85 롤백 / 8편] 패턴 단서 화면(축 2차 질문)은 폐기됨 — 7축은 매칭 엔진 내부 분류이지
  // 부모가 답할 질문이 아니었음(리비전 v50 §U). 축 추론은 C-10 정식화에서 함수 내부가 담당.
  // TODO: C-10 — phase5_pipeline이 scene·childText 등에서 축을 내부 추론(patternAxis 인자 불필요)
  const handleChildNext = ({ childType, childText }) => {
    setCurrent({ ...current, childType, childText })
    setScreen('parentBehavior')
  }

  // ③ 부모행동 선택 저장 → (기존) 지금 마음
  const handleParentNext = ({ parentType, parentText }) => {
    setCurrent({ ...current, parentType, parentText })
    // [TEMP] 감정강도 분기 설계 확정 전 임시 연결 — 지시서 5편에서 교체
    setScreen('mood')
  }

  // [C-25 정정] settling = 감정 조절 텀이 있는 깊은 회고. 사실 먼저(내 표현·아이 반응) 입력하도록
  //  ConflictScreen(mode='settling')에 진입. 응답은 깊은 회고와 동일한 회고 필드로 저장(별도 데이터 없음).
  //  ★ 진입 시 미완료 표시하지 않는다 — 홈 재개 상태는 감정 조절 텀의 "여기까지 할게요"에서만 생성.
  const startSettlingRetro = () => {
    setCurrent({ ...current, mood: 'settling' })
    setRetroMode('settling')
    setConflictBack('mood')
    setScreen('conflict')
  }
  const handleCalm = () => {
    setCurrent({ ...current, mood: 'calm' })
    setRetroMode('calm')
    setConflictBack('mood')
    setScreen('conflict')
  }

  // [C-105] hard 받아주기 — ①submit·② 선택 시 이 건을 미완료(홈 재개 카드)로 표시(§793).
  //  재개점 stoppedAt='mood'(기존 hard 재개 규칙과 동일 — '지금 마음' 화면부터).
  const deferHardCase = () => {
    const c = { ...current, mood: 'hard', status: 'incomplete', stoppedAt: 'mood' }
    upsertCase(c)
    setCurrent(c)
  }

  // [C-105] ③ '이어서 조금 더 볼게요' — 자발적으로 동일한 C-25 흐름(settling 회고)으로 합류.
  //  ★ mood는 그대로 두고(하드에서 넘어옴) 회고 모드만 settling. 얕은/깊은 회고 파이프라인 동일.
  const continueToRetro = () => {
    setRetroMode('settling')
    setConflictBack('mood')
    setScreen('conflict')
  }

  // [C-25 정정] 감정 조절 텀 "여기까지 할게요" — 현재 응답 병합·incomplete 저장·홈 재개 상태 생성 후 홈.
  //  ★ TD 매칭·결과 이동 없음. 재개 지점 stoppedAt='conflict' → 홈에서 깊은 회고 첫 미응답 질문으로 복귀.
  const handleRetroStop = (retro = {}) => {
    const c = { ...current, ...retro, status: 'incomplete', stoppedAt: 'conflict' }
    upsertCase(c)
    setCurrent(c)
    setScreen('home')
  }

  // 깊은회고 완료 — ConflictScreen 각 스텝값(retro)을 current 로 취합(§0-(1)) 후,
  //  [SHOWCASE/LIVE 분기] live 모드일 때만 conflict_input.data(jsonb)에 저장. 매칭·리포트는 분기 밖(공통).
  const completeCurrent = (retro = {}) => {
    const c = { ...current, ...retro, status: 'complete' }
    upsertCase(c)
    setCurrent(c)
    if (APP_MODE === 'live') {
      // ★ member_id 신분 소스는 getCurrentMemberId() 하나로 격리(알파↔베타 교체 지점, §3-B).
      saveConflictInput({
        conflict_id: c.id,
        member_id: getCurrentMemberId(),
        is_sensitive: false, // 기본 false(추후 규칙)
        data: buildConflictData(c),
      })
    }
    // showcase 면 저장 안 함 — 아래 done/매칭/리포트는 두 모드 공통으로 그대로 진행.
    setScreen('done')
  }

  // 완료 → 결과 보기: 답변으로 td를 매칭하고 결과 화면으로 바로 이동.
  //  (오늘은 키워드 겹침 매칭. 나중에 이 함수 내부만 AI 매칭으로 교체 — utils/matchTd.js)
  //  [C-41] 쇼케이스(사용자) 경로는 컨시어지 검토 화면('review')을 건너뛴다.
  //   ReviewScreen/‘case review’ 코드는 삭제하지 않고 보존 — 향후 live(실동작) 모드에서
  //   "운영자 전용" 검토 화면으로 정식 분리 예정(딥링크 ?screen=review 로 여전히 접근 가능).
  const handleReview = () => {
    // [C-10] matchTdToInput은 current 객체 전체를 받는다. (임시 키워드/축 엔진 — 함수 내부만 추후 AI 매칭으로 교체)
    //  매칭 점수에 실제 사용되는 필드: scene · childText · parentText
    //    (matchTd.js에서 tokenize 후 title 토큰과 집합 교집합으로 점수 계산 — 10편 ②-3 이후 방식)
    //  축 필터(pool 축소): patternAxis 우선, 없으면 childType. ⑦가중 트리거: parentType
    //    ★ ⑦가중은 parentType 경로 — parentText와 다른 경로임에 주의(혼동 금지).
    //  ★ 실측(2026-07-16/17 · docs 11_계측): parentText 기여 = 0.000 (rep/after/expand0 전부 동일).
    //    원인=자산 어휘 계층 불일치(일상어 vs 임상 title). C-108 소관.
    //  ★ childText 기여는 노이즈 제거(②dedupe+불용어+경계매칭) 후 오히려 하락: rep 0.45→0.125, expand[0] 0.000. 10편 참고.
    // TODO(C-10): 함수 내부를 정식 AI 매칭(phase5_pipeline)으로 교체 — ②③ 관찰유형 활용 고도화는 그때.
    setMatchResult(matchTdToInput(current))
    setScreen('result') // [C-41] 'review'(운영자 검토) 스킵 → 다듬어진 결과로 직행
  }

  // 완료 → 다음 건 안내 (3건 도달 시 소진 케어)
  const handleDoneContinue = () => {
    setScreen(completedCount >= MAX_CASES ? 'burnout' : 'another')
  }

  // 홈 이어하기: [DEMO-ONLY] C-25 — 건 단위가 아니라 저장된 "멈춘 지점(stoppedAt)"부터 재개.
  //  mood:'calm' 강제 덮어쓰기 없이 실제 저장 상태(mood/scene/회고필드 등)를 그대로 복원한다.
  //  ★ [C-25 정정] 회고 재개(stoppedAt='conflict')는 저장된 회고 응답을 seed로 ConflictScreen에 넘겨
  //    깊은 회고의 첫 미응답 질문부터 진행한다(감정 조절 텀 재노출 없음·중복 질문 없음). 뒤로=홈.
  const handleResume = (id) => {
    const c = cases.find((x) => x.id === id)
    if (!c) return
    // 레거시/구 stoppedAt('shallow')은 회고 재개로 흡수.
    const target = c.stoppedAt === 'shallow' ? 'conflict' : c.stoppedAt ?? 'conflict'
    setCurrent(c)
    if (target === 'conflict') {
      setRetroMode('settling')
      setConflictBack('home')
    }
    setScreen(target)
  }

  const resumeItems = incompleteCases.map((c) => ({
    id: c.id,
    sub: texts.home.resume.sub(childName, c.scene),
  }))

  // [C-16] 초대 진입 분기 — inviteToken 있을 때만. 없으면 기존 switch(showcase/뷰어) 그대로.
  if (inviteToken) {
    if (auth.status === 'loading') return <InviteLoading />
    if (auth.route === ROUTE.DENIED) return <InviteDenied onHome={() => { window.location.search = '' }} />
    if (auth.route === ROUTE.ONBOARDING) {
      return (
        <OnboardingScreen
          token={inviteToken}
          session={authSession}
          initialStep={auth.resumeStep || 1}
          onComplete={() =>
            setAuth({ status: 'ready', route: ROUTE.HOME, session: authSession, resumeStep: null })
          }
        />
      )
    }
    // route === HOME → 아래 기존 화면으로 진행(userName이 세션 구성원 이름을 반영, A-3).
  }

  switch (screen) {
    case 'home':
      return (
        <HomeScreen
          userName={userName}
          resumeItems={resumeItems}
          onResume={handleResume}
          onStart={viewer === 'spouse' ? go('spouseResult') : go('count')}
          onPick={go('situationPicker')}
        />
      )

    // 정민님(배우자) 관점 개인결과. 홈→여기→통합리포트로 이어짐.
    case 'spouseResult':
      return (
        <SpouseResultScreen
          userName={userName}
          tdNumber={matchResult?.num}
          onBack={go('home')}
          onHome={go('home')}
          onReport={go('report')}
        />
      )

    case 'situationPicker':
      return <SituationPickerScreen onBack={go('home')} />

    case 'count':
      return (
        <CountScreen
          onBack={go('home')}
          onNone={go('noConflict')}
          onStart={handleCountStart}
        />
      )

    case 'noConflict':
      return <NoConflictScreen onBack={go('count')} onHome={go('home')} />

    case 'who':
      return (
        <WhoScreen
          userName={userName}
          onBack={go('count')}
          onNext={handleWhoNext}
        />
      )

    case 'situation':
      return (
        <SituationScreen onBack={go('who')} onNext={handleSituationNext} />
      )

    // [빌드지시서 4편 A] ②아이행동 선택 → ③부모행동. (situation→childBehavior 연결은 C단계)
    case 'childBehavior':
      return (
        <ChildBehaviorScreen
          scene={current?.scene}
          onBack={go('situation')}
          onNext={handleChildNext}
        />
      )

    // [빌드지시서 4편 B] ③부모행동 선택 → (기존) mood. 뒤로 → ②아이행동.
    case 'parentBehavior':
      return (
        <ParentBehaviorScreen
          userName={userName}
          scene={current?.scene}
          onBack={go('childBehavior')}
          onNext={handleParentNext}
        />
      )

    case 'mood':
      return (
        <MoodScreen
          userName={userName}
          onBack={go('situation')}
          // [C-105] hard → 받아주기 화면(accept). 홈 직행 폐기 — §611 3기능은 accept 화면에서 분기.
          onHard={() => {
            setCurrent({ ...current, mood: 'hard' })
            setScreen('accept')
          }}
          // [C-25 정정] settling → 감정 조절 텀이 있는 깊은 회고(ConflictScreen mode='settling'). 축약 결과 경로 폐기.
          onSettling={startSettlingRetro}
          onCalm={handleCalm}
        />
      )

    // [C-105] 뜨거움 받아주기 — §611 3기능 분기(들어주기/멈추기/이어서 보기).
    case 'accept':
      return (
        <AcceptScreen
          userName={userName}
          onBack={go('mood')}
          onDefer={deferHardCase}
          onContinue={continueToRetro}
          onHome={go('home')}
        />
      )

    // [C-25 정정] settling·calm·재개·C-105③ 모두 ConflictScreen(깊은 회고) 하나로 합류.
    //  mode=settling이면 사실 먼저 + 감정 조절 텀(pause). initial=current로 이미 답한 회고 필드 seed(중복 질문 방지).
    //  onStop=감정 조절 텀 "여기까지 할게요"(홈 재개). onDone=기존 완료 함수(부재자 확인·공유 후 결과·매칭 1회).
    case 'conflict':
      return (
        <ConflictScreen
          userName={userName}
          scene={current?.scene}
          mode={retroMode}
          initial={current ?? {}}
          onBack={go(conflictBack)}
          onStop={handleRetroStop}
          onDone={completeCurrent}
        />
      )

    case 'done':
      return (
        <DoneScreen
          onBack={go('home')}
          isMultiple={count === 'multiple'}
          onResult={handleReview}
          onContinue={handleDoneContinue}
        />
      )

    case 'review':
      return (
        <ReviewScreen
          match={matchResult}
          onBack={go('done')}
          onSend={go('result')}
        />
      )

    case 'result':
      return (
        <ResultScreen
          userName={userName}
          tdNumber={matchResult?.num}
          spouseIncluded={current?.spouseIncluded}
          cases={cases}
          onBack={go('done')}
          onHome={go('home')}
          onReport={go('report')}
        />
      )

    case 'report':
      return (
        <ReportScreen
          userName={userName}
          tdNumber={matchResult?.num}
          spouseIncluded={current?.spouseIncluded}
          onBack={go('result')}
          onHome={go('home')}
          onChildReport={go('childReport')}
          onMission={go('mission')}
        />
      )

    case 'childReport':
      return (
        <ChildReportScreen
          userName={userName}
          tdNumber={matchResult?.num}
          onBack={go('report')}
          onHome={go('home')}
        />
      )

    case 'mission':
      return (
        <MissionScreen
          userName={userName}
          tdNumber={matchResult?.num}
          cases={cases}
          onBack={go('report')}
          onHome={go('home')}
        />
      )

    case 'another':
      return (
        <AnotherAskScreen
          onBack={go('done')}
          onNow={startCase}
          onLater={go('later')}
        />
      )

    case 'later':
      return (
        <PlaceholderScreen
          onBack={go('another')}
          title={texts.later.title}
          note={texts.later.note}
        />
      )

    case 'burnout':
      return <BurnoutScreen onBack={go('done')} />

    default:
      return (
        <HomeScreen
          userName={userName}
          resumeItems={resumeItems}
          onResume={handleResume}
          onStart={viewer === 'spouse' ? go('spouseResult') : go('count')}
          onPick={go('situationPicker')}
        />
      )
  }
}
