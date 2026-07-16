import { useState } from 'react'
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
import { texts } from './texts'
import { findByRelation } from './data/familyMembers'
import { matchTdToInput } from './utils/matchTd'
import { saveConflictInput } from './lib/supabaseClient'
import { getCurrentMemberId } from './lib/identity'

// 나중에 실제 사용자 이름으로 쉽게 바꿀 수 있도록 이름을 변수로 관리합니다.
// TODO: 로그인/사용자 정보 연동 시 이 값을 실제 사용자 이름으로 교체하세요.
const userName = '현정'
const MAX_CASES = 3

// [SHOWCASE/LIVE 분기 · 5-B §3-A] 저장만 갈린다. 매칭·리포트는 두 모드 공통(항상 실작동).
//   미설정/그 외 = showcase(저장 안 함). 'live' 일 때만 conflict_input 에 저장.
const APP_MODE = import.meta.env.VITE_APP_MODE === 'live' ? 'live' : 'showcase'

// [5-B §1] current(취합된 1건) → conflict_input.data (jsonb) 매핑.
//   ★ 지시서 §1 표의 data 필드명을 정본으로 쓴다. 해당 갈래(개입자/마음) 필드만 채운다.
function buildConflictData(c) {
  // [C-93] 개입자/마음 저장 갈래의 소스 = 재석 답(spousePresent).
  //  ★ 비교값 = ConflictScreen이 쓰는 SPOUSE_PRESENCE_OPTIONS[0](=있었음) 단일 정본.
  //    spousePresent는 다른 스텝(coping/emotions 등)과 동일하게 '한국어 라벨 문자열'로 저장되므로
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
    // coping·intensity 정식 채택 확정(후속 반영). 저장구조 유지.
    // [임시공통] C-50 정식화 시 값 세트 교체(저장구조는 유지)
    coping: c.coping ?? [], // 회고 내대처
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
  const [matchResult, setMatchResult] = useState(null) // matchTdToInput 결과 {num,title,...}

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

  // 지금 마음: 미룸(hard/settling)이면 미완료로 저장하며 "멈춘 지점(stoppedAt)"을 기록.
  //  [DEMO-ONLY] C-25: 재개 시 건 처음이 아니라 이 지점부터 이어가려고 stoppedAt를 남긴다.
  //    hot_only(hard)    → 'mood'   (뜨거움 체크 전, '지금 마음' 화면부터)
  //    minimum(settling) → 'shallow'(트리거·자유서술 남은 부분부터)
  const deferCase = (moodKind, stoppedAt, nextScreen) => {
    const c = { ...current, mood: moodKind, status: 'incomplete', stoppedAt }
    upsertCase(c)
    setCurrent(c)
    setScreen(nextScreen)
  }
  const handleCalm = () => {
    setCurrent({ ...current, mood: 'calm' })
    setConflictBack('mood')
    setScreen('conflict')
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
    // TODO(C-10): ②③ 관찰유형(childType/parentType 등)을 매칭 정교화에 활용 — 정식 파이프라인에서.
    //  현재 matchTdToInput은 상황축(scene)만 사용. ②③ 값은 current에 저장돼 있으나 매칭엔 아직 미사용.
    setMatchResult(matchTdToInput(current))
    setScreen('result') // [C-41] 'review'(운영자 검토) 스킵 → 다듬어진 결과로 직행
  }

  // 완료 → 다음 건 안내 (3건 도달 시 소진 케어)
  const handleDoneContinue = () => {
    setScreen(completedCount >= MAX_CASES ? 'burnout' : 'another')
  }

  // 홈 이어하기: [DEMO-ONLY] C-25 — 건 단위가 아니라 저장된 "멈춘 지점(stoppedAt)"부터 재개.
  //  mood:'calm' 강제 덮어쓰기 없이 실제 저장 상태(mood/scene 등)를 그대로 복원한다.
  const handleResume = (id) => {
    const c = cases.find((x) => x.id === id)
    if (!c) return
    setCurrent(c)
    setScreen(c.stoppedAt ?? 'conflict') // 지점 없으면(레거시 건) 기존 깊은회고로 폴백
  }

  const resumeItems = incompleteCases.map((c) => ({
    id: c.id,
    sub: texts.home.resume.sub(childName, c.scene),
  }))

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
          // [DEMO-ONLY] C-25: hot_only(hard)는 'accept' 대신 홈으로. 재개점은 'mood'.
          onHard={() => deferCase('hard', 'mood', 'home')}
          // [DEMO-ONLY] C-25: minimum(settling)은 shallow로, 재개점도 'shallow'.
          onSettling={() => deferCase('settling', 'shallow', 'shallow')}
          onCalm={handleCalm}
        />
      )

    case 'accept':
      return (
        <PlaceholderScreen
          onBack={go('mood')}
          title={texts.accept.title}
          note={texts.accept.note}
        />
      )

    case 'shallow':
      return (
        <PlaceholderScreen
          onBack={go('mood')}
          title={texts.shallow.title}
          note={texts.shallow.note}
        />
      )

    case 'conflict':
      return (
        <ConflictScreen
          userName={userName}
          scene={current?.scene}
          onBack={go(conflictBack)}
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
          tdNumber={matchResult?.num}
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
