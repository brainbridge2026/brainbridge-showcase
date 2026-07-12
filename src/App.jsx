import { useState } from 'react'
import HomeScreen from './screens/HomeScreen'
import CountScreen from './screens/CountScreen'
import NoConflictScreen from './screens/NoConflictScreen'
import WhoScreen from './screens/WhoScreen'
import SituationScreen from './screens/SituationScreen'
import MoodScreen from './screens/MoodScreen'
import PlaceholderScreen from './screens/PlaceholderScreen'
import ConflictScreen from './screens/ConflictScreen'
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

// 나중에 실제 사용자 이름으로 쉽게 바꿀 수 있도록 이름을 변수로 관리합니다.
// TODO: 로그인/사용자 정보 연동 시 이 값을 실제 사용자 이름으로 교체하세요.
const userName = '현정'
const MAX_CASES = 3

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

  const spouse = findByRelation('배우자')
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
    setCurrent({
      ...current,
      whoSelectedIds: selectedIds,
      spouseIncluded: !!spouse && selectedIds.includes(spouse.id),
    })
    setScreen('situation')
  }

  // 상황 → 지금 마음
  const handleSituationNext = (scene) => {
    setCurrent({ ...current, scene })
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

  // 깊은회고 완료
  const completeCurrent = () => {
    const c = { ...current, status: 'complete' }
    upsertCase(c)
    setCurrent(c)
    setScreen('done')
  }

  // 완료 → 결과 보기: 답변으로 td를 매칭하고 검토 화면으로.
  //  (오늘은 키워드 겹침 매칭. 나중에 이 함수 내부만 AI 매칭으로 교체 — utils/matchTd.js)
  const handleReview = () => {
    setMatchResult(matchTdToInput(current))
    setScreen('review')
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
      return <WhoScreen onBack={go('count')} onNext={handleWhoNext} />

    case 'situation':
      return (
        <SituationScreen onBack={go('who')} onNext={handleSituationNext} />
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
          spouseIncluded={current?.spouseIncluded}
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
