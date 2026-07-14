import { useState } from 'react'
import PhoneFrame from '../components/PhoneFrame'
import QuestionStep from '../components/QuestionStep'
import CardChoiceList from '../components/CardChoiceList'
import OrderedCardList from '../components/OrderedCardList'
import OrderedChipGroup from '../components/OrderedChipGroup'
import { styles } from '../theme'
import { texts } from '../texts'
import { findByRelation } from '../data/familyMembers'

// 깊은 회고 상세 입력 (시나리오 1: 아이가 주축). B부터 시작.
// B reason → C coping → D feeling → E expression → F childReaction → G childSpeech
//   spouseIncluded=true  → H spouseAction → I spouseFeeling → onDone
//   spouseIncluded=false → share (→ shareReason) → coaching → onDone
// scene: 앞에서 고른 상황, spouseIncluded: "누구와"에서 아빠도 골랐는지.
export default function ConflictScreen({
  userName,
  scene,
  spouseIncluded,
  onBack,
  onDone,
}) {
  const childName = findByRelation('아이')?.name ?? '아이'
  const spouseName = findByRelation('배우자')?.name ?? '배우자'
  const c = texts.conflict

  const [step, setStep] = useState('reason')
  const [coachingBack, setCoachingBack] = useState('share')

  // 선택 상태
  // [C-53 해소] 회고① 트리거 2층(확정본 C). immediate=단일 즉시트리거 / amplifiers=복수 증폭배경.
  //  ★ 값은 다른 스텝(coping/feeling/expression 등)과 동일하게 "한국어 라벨 문자열"로 저장(내부 키 아님).
  //  이 객체가 6편(5-B)에서 conflict_input.data jsonb에 그대로 실림 — 저장 배선은 6편 소관, 여기선 로컬 state까지만.
  const [reason, setReason] = useState({ immediate: null, amplifiers: [] })
  const [coping, setCoping] = useState([])
  const [emotions, setEmotions] = useState([])
  const [intensity, setIntensity] = useState(null)
  const [expressions, setExpressions] = useState([])
  const [childReactions, setChildReactions] = useState([])
  const [childSpeech, setChildSpeech] = useState([])
  const [spouseActions, setSpouseActions] = useState([])
  const [spouseEmotions, setSpouseEmotions] = useState([])
  const [shareReasons, setShareReasons] = useState([])
  // [5-B §1-E] 공유/미공유 갈래 표시 — 인벤토리상 "선택 안 담김"이라 저장되게 추가. 'shared' | 'notShared'
  const [shareChoice, setShareChoice] = useState(null)

  // 다중/순서 토글 (append 순서 유지)
  const toggle = (setter) => (option) =>
    setter((prev) =>
      prev.includes(option) ? prev.filter((x) => x !== option) : [...prev, option],
    )

  const afterChildSpeech = spouseIncluded ? 'spouseAction' : 'share'

  // [5-B §0-(1)] 완료 시 각 스텝의 로컬 state 를 App(current)으로 넘길 취합 객체.
  //  ★ App.buildConflictData 가 이 키들을 conflict_input.data(jsonb) 필드로 매핑한다.
  //    키 이름을 바꾸면 App 쪽 매핑도 함께 바꿔야 함(저장구조 정합).
  const collect = () => ({
    reason, // 회고①트리거 2층 {immediate, amplifiers}
    coping, // 회고 내대처
    emotions, // 회고④ 감정칩(순서)
    intensity, // 감정칩 강도
    expressions, // 회고② 내표현
    childReactions, // 회고③ 아이반응
    childSpeech, // 회고 아이발화
    spouseActions, // 개입자 반응 (spouseIncluded=true 갈래)
    spouseEmotions, // 개입자 감정 (true 갈래)
    shareReasons, // 공유 사유 (false 갈래)
    shareChoice, // 공유/미공유 선택 (false 갈래)
  })

  switch (step) {
    // B - 회고① 트리거 2층: 상단=즉시트리거(단일, 필수) / 하단=증폭배경(복수, 0개 허용)
    case 'reason':
      return (
        <QuestionStep
          onBack={onBack}
          title={c.reason.question(scene)}
          sub={c.reason.sub}
          canProceed={reason.immediate !== null} // 상단 1개 필수, 하단은 선택
          onNext={() => setStep('coping')}
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

    // C - 내 대처 (순서대로)
    case 'coping':
      return (
        <QuestionStep
          onBack={() => setStep('reason')}
          title={c.coping.question(userName)}
          sub={c.coping.sub}
          canProceed={coping.length > 0}
          onNext={() => setStep('feeling')}
        >
          <OrderedCardList
            options={c.coping.options}
            order={coping}
            onToggle={toggle(setCoping)}
          />
        </QuestionStep>
      )

    // D - 내 감정(순서대로) + 강도(단일)
    case 'feeling':
      return (
        <QuestionStep
          onBack={() => setStep('coping')}
          title={c.feeling.question(userName)}
          sub={c.feeling.sub}
          canProceed={emotions.length > 0 && intensity !== null}
          onNext={() => setStep('expression')}
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
          onBack={() => setStep('feeling')}
          title={c.expression.question(childName)}
          sub={c.expression.sub}
          canProceed={expressions.length > 0}
          onNext={() => setStep('childReaction')}
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
          onBack={() => setStep('expression')}
          title={c.childReaction.question(childName)}
          sub={c.childReaction.sub}
          canProceed={childReactions.length > 0}
          onNext={() => setStep('childSpeech')}
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
          onBack={() => setStep('childReaction')}
          title={c.childSpeech.question(childName)}
          sub={c.childSpeech.sub}
          onNext={() => setStep(afterChildSpeech)}
          secondaryLabel={c.skipButton}
          onSecondary={() => setStep(afterChildSpeech)}
        >
          <CardChoiceList
            options={c.childSpeech.options}
            isSelected={(o) => childSpeech.includes(o)}
            onSelect={toggle(setChildSpeech)}
          />
        </QuestionStep>
      )

    // H - 아빠 행동 (순서대로) — 함께 골랐을 때만
    case 'spouseAction':
      return (
        <QuestionStep
          onBack={() => setStep('childSpeech')}
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

    // 부재자 공유 안내 — 이안이만 골랐을 때
    case 'share':
      return (
        <PhoneFrame onBack={() => setStep('childSpeech')}>
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
