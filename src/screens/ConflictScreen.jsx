import { useState } from 'react'
import PhoneFrame from '../components/PhoneFrame'
import QuestionStep from '../components/QuestionStep'
import CardChoiceList from '../components/CardChoiceList'
import OrderedCardList from '../components/OrderedCardList'
import OrderedChipGroup from '../components/OrderedChipGroup'
import { styles } from '../theme'
import { texts } from '../texts'
import { findByRelation } from '../data/familyMembers'
import { buildRetroSequence, retroNext, retroPrev } from '../utils/retroFlow'

// [C-93] 배우자 재석 선택지 — 순서 = [있었음, 없었음]. 라벨 문자열이 곧 저장값(다른 스텝과 동일 패턴).
//  ★ 단일 정본 = texts.conflict.spousePresence.options(확정본 문구). 흐름 분기(아래 spousePresence 스텝)와
//    저장 갈래 재키잉(App.buildConflictData)이 모두 이 상수의 [0](=있었음, '함께 있었어요')을 비교값으로
//    참조한다(App은 이 상수를 import). 상수 하나만 보므로 두 곳이 어긋나지 않는다.
export const SPOUSE_PRESENCE_OPTIONS = texts.conflict.spousePresence.options

// 깊은 회고 상세 입력 (시나리오 1: 아이가 주축).
// [C-25 정정] 깊은 회고 = 얕은 회고 + 중간 감정 조절 텀. 하나의 화면·데이터 계약을 공유한다.
//  - mode='calm'    : 기존 깊은 회고. reason → feeling → expression → childReaction → childSpeech
//                     → spousePresence → (분기).
//  - mode='settling': 사실 먼저(expression → childReaction) → 감정 조절 텀(pause) → 나머지 깊은 회고 합류.
//     · pause에서 "여기까지 할게요" → onStop(현재 응답 병합·incomplete·홈 재개). TD 매칭·결과 이동 없음.
//     · pause에서 "조금 더 이어서" → 깊은 회고의 첫 미응답 질문으로 합류.
//  - initial(재개/이어서): 이미 답한 회고 필드를 seed로 받아 그 스텝을 건너뛰고 첫 미응답부터 진행.
//    seed는 깊은 회고와 동일한 회고 필드(expressions·childReactions 등)에 저장된다(별도 데이터 아님).
//  ★ 전체 회고 완료 → onDone(collect())로 기존 완료 함수 진입 → 부재자 확인·공유 후 결과. 매칭 1회.
// scene: 앞에서 고른 상황.
export default function ConflictScreen({
  userName,
  scene,
  mode = 'calm',
  initial = {},
  onBack,
  onStop,
  onDone,
}) {
  const childName = findByRelation('아이')?.name ?? '아이'
  const spouseName = findByRelation('배우자')?.name ?? '배우자'
  // [C-93] 재석 질문(spousePresence)만 givenName 호명('정민님')을 쓴다 — spouseOnlyNotice와 정합.
  const spouseGivenName = findByRelation('배우자')?.givenName ?? spouseName
  const c = texts.conflict

  // [C-25 정정] 표시할 스텝 순서 — mode + seed(initial)로 결정(순수 로직은 utils/retroFlow).
  const sequence = buildRetroSequence(mode, initial)

  const [step, setStep] = useState(sequence[0])
  const [coachingBack, setCoachingBack] = useState('share')

  // 선택 상태 — initial(seed)로 초기화. calm 신규는 initial 비어 있어 전부 기본값(기존 동작).
  const [reason, setReason] = useState(
    initial.reason ?? { immediate: null, amplifiers: [] },
  )
  const [emotions, setEmotions] = useState(initial.emotions ?? [])
  const [intensity, setIntensity] = useState(initial.intensity ?? null)
  const [expressions, setExpressions] = useState(initial.expressions ?? [])
  const [childReactions, setChildReactions] = useState(initial.childReactions ?? [])
  const [childSpeech, setChildSpeech] = useState(initial.childSpeech ?? [])
  const [spouseActions, setSpouseActions] = useState(initial.spouseActions ?? [])
  const [spouseEmotions, setSpouseEmotions] = useState(initial.spouseEmotions ?? [])
  const [shareReasons, setShareReasons] = useState(initial.shareReasons ?? [])
  const [shareChoice, setShareChoice] = useState(initial.shareChoice ?? null)
  const [spousePresent, setSpousePresent] = useState(initial.spousePresent ?? null)

  // 다중/순서 토글 (append 순서 유지)
  const toggle = (setter) => (option) =>
    setter((prev) =>
      prev.includes(option) ? prev.filter((x) => x !== option) : [...prev, option],
    )

  // 선형 구간 전/후 이동(seed된 스텝은 시퀀스에서 이미 제거됨 → 중복 질문 없음).
  //  다음이 없으면(=마지막 spousePresence) 분기 로직이 대신 처리. 이전이 없으면 화면 이탈(onBack).
  const goNext = (cur) => () => setStep(retroNext(sequence, cur))
  const goBack = (cur) => () => {
    const prev = retroPrev(sequence, cur)
    if (prev) setStep(prev)
    else onBack()
  }

  // [5-B §0-(1)] 완료 시 각 스텝의 로컬 state 를 App(current)으로 넘길 취합 객체(깊은 회고와 동일 계약).
  const collect = () => ({
    reason, // 회고①트리거 2층 {immediate, amplifiers}
    emotions, // 회고④ 감정칩(순서)
    intensity, // 감정칩 강도
    expressions, // 회고② 내표현
    childReactions, // 회고③ 아이반응
    childSpeech, // 회고 아이발화
    spousePresent, // 배우자 재석 여부 (C-93) — spouseAction/share 갈래를 가르는 소스
    spouseActions, // 개입자 반응 (재석=있었음 갈래)
    spouseEmotions, // 개입자 감정 (재석=있었음 갈래)
    shareReasons, // 공유 사유 (재석=없었음 갈래)
    shareChoice, // 공유/미공유 선택 (재석=없었음 갈래)
  })

  switch (step) {
    // ★ [C-25] 감정 조절 텀 — settling 최초 진입에서 사실(내 표현·아이 반응) 뒤 1회.
    //   여기까지 할게요 = 응답 병합·incomplete·홈 재개(매칭·결과 이동 없음) / 조금 더 이어서 = 첫 미응답 질문.
    //   문구 = §801 안심 + §798 버튼(texts.shallow). 새 문구 없음.
    case 'pause':
      return (
        <PhoneFrame onBack={goBack('pause')}>
          <div className="fade-in">
            <p style={styles.resultParagraph}>{texts.shallow.reassure}</p>
          </div>
          <div style={styles.footer}>
            <div style={styles.choiceList}>
              <button style={styles.choiceButton} onClick={goNext('pause')}>
                {texts.shallow.continue}
              </button>
              <button style={styles.primaryButton} onClick={() => onStop(collect())}>
                {texts.shallow.stop}
              </button>
            </div>
          </div>
        </PhoneFrame>
      )

    // B - 회고① 트리거 2층: 상단=즉시트리거(단일, 필수) / 하단=증폭배경(복수, 0개 허용)
    case 'reason':
      return (
        <QuestionStep
          onBack={goBack('reason')}
          title={c.reason.question(scene)}
          sub={c.reason.sub}
          canProceed={reason.immediate !== null} // 상단 1개 필수, 하단은 선택
          onNext={goNext('reason')}
        >
          {/* 상단 — 즉시 트리거 (단일선택 · 라디오 방식) */}
          <div style={styles.choiceList}>
            {c.reason.immediateOptions.map((opt) => (
              <button
                key={opt}
                style={{
                  ...styles.choiceButton,
                  ...(reason.immediate === opt ? styles.choiceButtonSelected : {}),
                }}
                onClick={() => setReason((r) => ({ ...r, immediate: opt }))}
              >
                {opt}
              </button>
            ))}
          </div>

          {/* 하단 — 증폭 배경 (복수선택 · 체크박스 방식, 0~2개) */}
          <h2 style={styles.subQuestion}>{c.reason.amplifierQuestion}</h2>
          <div style={styles.choiceList}>
            {c.reason.amplifierOptions.map((opt) => {
              const selected = reason.amplifiers.includes(opt)
              return (
                <button
                  key={opt}
                  style={{
                    ...styles.choiceButton,
                    ...(selected ? styles.choiceButtonSelected : {}),
                  }}
                  onClick={() =>
                    setReason((r) => ({
                      ...r,
                      amplifiers: r.amplifiers.includes(opt)
                        ? r.amplifiers.filter((x) => x !== opt)
                        : [...r.amplifiers, opt],
                    }))
                  }
                >
                  {opt}
                </button>
              )
            })}
          </div>
        </QuestionStep>
      )

    // D - 내 감정(순서대로) + 강도(단일)
    case 'feeling':
      return (
        <QuestionStep
          onBack={goBack('feeling')}
          title={c.feeling.question(userName)}
          sub={c.feeling.sub}
          canProceed={emotions.length > 0 && intensity !== null}
          onNext={goNext('feeling')}
        >
          <OrderedChipGroup
            options={c.feeling.emotions}
            order={emotions}
            onToggle={toggle(setEmotions)}
          />
          <h2 style={styles.subQuestion}>{c.feeling.intensityQuestion}</h2>
          <CardChoiceList
            options={c.feeling.intensityOptions}
            isSelected={(o) => intensity === o}
            onSelect={setIntensity}
          />
        </QuestionStep>
      )

    // E - 이안이에게 한 말 (순서대로, "그 외" 포함)
    case 'expression':
      return (
        <QuestionStep
          onBack={goBack('expression')}
          title={c.expression.question(childName)}
          sub={c.expression.sub}
          canProceed={expressions.length > 0}
          onNext={goNext('expression')}
        >
          <OrderedCardList
            options={[...c.expression.options, c.expression.otherOption]}
            order={expressions}
            onToggle={toggle(setExpressions)}
          />
        </QuestionStep>
      )

    // F - 이안이 반응 (순서대로)
    case 'childReaction':
      return (
        <QuestionStep
          onBack={goBack('childReaction')}
          title={c.childReaction.question(childName)}
          sub={c.childReaction.sub}
          canProceed={childReactions.length > 0}
          onNext={goNext('childReaction')}
        >
          <OrderedCardList
            options={c.childReaction.options}
            order={childReactions}
            onToggle={toggle(setChildReactions)}
          />
        </QuestionStep>
      )

    // G - 이안이 발화 (선택 입력: 넘어가기 + 다음)
    case 'childSpeech':
      return (
        <QuestionStep
          onBack={goBack('childSpeech')}
          title={c.childSpeech.question(childName)}
          sub={c.childSpeech.sub}
          onNext={goNext('childSpeech')}
          secondaryLabel={c.skipButton}
          onSecondary={goNext('childSpeech')}
        >
          <CardChoiceList
            options={c.childSpeech.options}
            isSelected={(o) => childSpeech.includes(o)}
            onSelect={toggle(setChildSpeech)}
          />
        </QuestionStep>
      )

    // ★ 배우자 재석 확인 (C-93) — 선형 구간의 마지막. 재석 답으로 spouseAction(있었음)/share(없었음) 분기.
    //   ★ 저장 갈래(App.buildConflictData)도 같은 상수 [0]을 비교값으로 씀 — 문구 정본은 texts.
    case 'spousePresence':
      return (
        <QuestionStep
          onBack={goBack('spousePresence')}
          title={c.spousePresence.question(spouseGivenName)}
          canProceed={spousePresent !== null}
          onNext={() =>
            setStep(
              spousePresent === SPOUSE_PRESENCE_OPTIONS[0] ? 'spouseAction' : 'share',
            )
          }
        >
          <CardChoiceList
            options={SPOUSE_PRESENCE_OPTIONS}
            isSelected={(o) => spousePresent === o}
            onSelect={setSpousePresent}
          />
        </QuestionStep>
      )

    // H - 아빠 행동 (순서대로) — 재석=있었음일 때만
    case 'spouseAction':
      return (
        <QuestionStep
          onBack={() => setStep('spousePresence')}
          title={c.spouseAction.question(spouseName)}
          sub={c.spouseAction.sub}
          canProceed={spouseActions.length > 0}
          onNext={() => setStep('spouseFeeling')}
        >
          <OrderedCardList
            options={c.spouseAction.options(childName)}
            order={spouseActions}
            onToggle={toggle(setSpouseActions)}
          />
        </QuestionStep>
      )

    // I - 아빠에게 든 마음 (순서대로, 칩) — 함께 골랐을 때만
    case 'spouseFeeling':
      return (
        <QuestionStep
          onBack={() => setStep('spouseAction')}
          title={c.spouseFeeling.question(spouseName)}
          sub={c.spouseFeeling.sub}
          canProceed={spouseEmotions.length > 0}
          onNext={() => onDone(collect())}
        >
          <OrderedChipGroup
            options={c.spouseFeeling.emotions}
            order={spouseEmotions}
            onToggle={toggle(setSpouseEmotions)}
          />
        </QuestionStep>
      )

    // 부재자 공유 안내 — 재석=없었음일 때
    case 'share':
      return (
        <PhoneFrame onBack={() => setStep('spousePresence')}>
          <div>
            <h1 style={styles.question}>{texts.share.title}</h1>
            <p style={{ ...styles.subText, marginTop: '14px' }}>
              {texts.share.body(spouseName, userName, childName)}
            </p>
          </div>
          <div style={styles.footer}>
            <div style={styles.choiceList}>
              <button
                style={styles.primaryButton}
                onClick={() => {
                  setShareChoice('shared')
                  setStep('shareReason')
                }}
              >
                {texts.share.shareYes(spouseName)}
              </button>
              <button
                style={styles.choiceButton}
                onClick={() => {
                  setShareChoice('notShared')
                  setCoachingBack('share')
                  setStep('coaching')
                }}
              >
                {texts.share.shareNo}
              </button>
            </div>
          </div>
        </PhoneFrame>
      )

    // 부재자 공유 — 어떤 마음으로 나누고 싶은지 (순서대로)
    case 'shareReason':
      return (
        <QuestionStep
          onBack={() => setStep('share')}
          title={texts.share.reasonTitle}
          canProceed={shareReasons.length > 0}
          onNext={() => {
            setCoachingBack('shareReason')
            setStep('coaching')
          }}
        >
          <OrderedCardList
            options={texts.share.reasonOptions(spouseName, childName)}
            order={shareReasons}
            onToggle={toggle(setShareReasons)}
          />
          <p style={{ ...styles.suggestionNote, marginTop: '16px' }}>
            {texts.share.reasonNote}
          </p>
        </QuestionStep>
      )

    // 공유 이후 코칭 placeholder → 완료
    case 'coaching':
    default:
      return (
        <QuestionStep
          onBack={() => setStep(coachingBack)}
          title={texts.coaching.title}
          sub={texts.coaching.note}
          onNext={() => onDone(collect())}
        />
      )
  }
}
