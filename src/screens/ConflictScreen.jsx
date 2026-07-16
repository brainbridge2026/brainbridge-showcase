import { useState } from 'react'
import PhoneFrame from '../components/PhoneFrame'
import QuestionStep from '../components/QuestionStep'
import CardChoiceList from '../components/CardChoiceList'
import OrderedCardList from '../components/OrderedCardList'
import OrderedChipGroup from '../components/OrderedChipGroup'
import { styles } from '../theme'
import { texts } from '../texts'
import { findByRelation } from '../data/familyMembers'

// [C-93] 배우자 재석 선택지 — 순서 = [있었음, 없었음]. 라벨 문자열이 곧 저장값(다른 스텝과 동일 패턴).
//  ★ 단일 정본: 흐름 분기(아래 spousePresence 스텝)와 저장 갈래 재키잉(App.buildConflictData)이
//    모두 이 상수의 [0](=있었음)을 비교값으로 참조한다. 두 곳이 어긋나면 저장 갈래가 틀어지므로
//    비교 문자열을 각자 하드코딩하지 말고 반드시 이 상수만 본다.
// TODO: C-93 §4 확정 문구 도착 시 이 상수를 texts.conflict.spousePresence.options 로 교체
//   (상수 하나만 갱신하면 흐름·저장 양쪽 동시 반영됨).
export const SPOUSE_PRESENCE_OPTIONS = [
  '(있었음 · 문구 확정 대기)',
  '(없었음 · 문구 확정 대기)',
]

// 깊은 회고 상세 입력 (시나리오 1: 아이가 주축). B부터 시작.
// B reason → C coping → D feeling → E expression → F childReaction → G childSpeech
//   → ★ spousePresence (배우자 재석 질문, C-93) 에서 분기:
//        재석=있었음 → H spouseAction → I spouseFeeling → onDone
//        재석=없었음 → share (→ shareReason) → coaching → onDone
// scene: 앞에서 고른 상황.
// [C-93] 배우자 재석 여부는 who가 아니라 이 화면의 spousePresence 스텝이 결정한다.
//   (예전엔 who 다중선택 → spouseIncluded prop 이었음. 소스가 이 스텝으로 이관돼 prop은 더 안 받음.)
export default function ConflictScreen({ userName, scene, onBack, onDone }) {
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
  // [C-93] 배우자 재석 답 — spousePresence 스텝에서 선택. spouseAction/share 갈래의 소스.
  const [spousePresent, setSpousePresent] = useState(null)

  // 다중/순서 토글 (append 순서 유지)
  const toggle = (setter) => (option) =>
    setter((prev) =>
      prev.includes(option) ? prev.filter((x) => x !== option) : [...prev, option],
    )

  // [C-93] childSpeech 다음은 항상 spousePresence(재석 질문)로 간다.
  //  재석 답에 따라 spouseAction(있었음)/share(없었음)로 갈리는 분기는 그 스텝의 onNext에 있음.

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
    spousePresent, // 배우자 재석 여부 (C-93) — spouseAction/share 갈래를 가르는 소스
    spouseActions, // 개입자 반응 (재석=있었음 갈래)
    spouseEmotions, // 개입자 감정 (재석=있었음 갈래)
    shareReasons, // 공유 사유 (재석=없었음 갈래)
    shareChoice, // 공유/미공유 선택 (재석=없었음 갈래)
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
          onNext={() => setStep('spousePresence')}
          secondaryLabel={c.skipButton}
          onSecondary={() => setStep('spousePresence')}
        >
          <CardChoiceList
            options={c.childSpeech.options}
            isSelected={(o) => childSpeech.includes(o)}
            onSelect={toggle(setChildSpeech)}
          />
        </QuestionStep>
      )

    // ★ 배우자 재석 확인 (C-93) — childSpeech(G) 다음, spouseAction(H)/share 앞.
    //   "그 자리에 있었나" 사실 확인이지 "개입했나"가 아님(H가 '지켜봤어요'·'자리를 피했어요'도 받으므로).
    //   spouseIncluded(who 유래) 대체 — 재석 여부의 소스가 이 스텝으로 이관됨.
    //   선택값 = 옵션 라벨(SPOUSE_PRESENCE_OPTIONS). 있었음([0]) → spouseAction, 없었음 → share.
    //   ★ 저장 갈래(App.buildConflictData)도 같은 상수 [0]을 비교값으로 씀 — 문구는 그 상수에서 교체.
    case 'spousePresence':
      return (
        <QuestionStep
          onBack={() => setStep('childSpeech')}
          title="(배우자 재석 질문 · 문구 확정 대기)"
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
