import { useState } from 'react'
import PhoneFrame from '../components/PhoneFrame'
import QuestionStep from '../components/QuestionStep'
import OrderedCardList from '../components/OrderedCardList'
import OrderedChipGroup from '../components/OrderedChipGroup'
import { styles } from '../theme'
import { texts } from '../texts'
import { findByRelation } from '../data/familyMembers'
import { familiar } from '../utils/korean'

// [C-25] 얕은 회고(settling) — 구현 가능 화면 명세(Build Pack v2_r1 §2-B).
//  입력 순서: ① 내 표현 → ② 아이 반응 → ③ 중단/이어서 → ④ (이어서) 내 감정.
//  ★ 문장빌더는 '내 표현'·'아이 반응' 화면 상단 인라인(현재까지의 문장). 전용 문장빌더 화면 신규 0.
//  ★ ② 아이 반응까지 = 최소선 충족 → 중단("여기까지 할게요")해도 번역/결과로 이동.
//    ② 이전(내 표현 단계)에서 뒤로 나가면 홈으로(§2-B "② 이전 중단이면 홈으로"). onBack=App의 go('home').
//  ★ 새 문구는 §801 안심 문구 + §798 중단/이어서 버튼뿐. 질문·선택지는 conflict 확정 자산 재사용.
//  ★ 내 감정 입력(④)은 포함하되 L-24(감정 원인=상황/아이 식별)는 범위 밖 — 원인 식별 단계 없음.
//
//  onBack : mood 화면으로(②이전 이탈 = 홈 재개 카드는 App이 이미 생성해 둠).
//  onDone(retro): 얕은 회고 종료 → App이 매칭 후 번역/결과로. retro={expressions,childReactions,emotions}.
export default function ShallowRetroScreen({ userName, onBack, onDone }) {
  const childName = findByRelation('아이')?.name ?? '아이'
  const c = texts.conflict
  const s = texts.shallow

  const [step, setStep] = useState('expr')
  const [expressions, setExpressions] = useState([])
  const [childReactions, setChildReactions] = useState([])
  const [emotions, setEmotions] = useState([])

  const toggle = (setter) => (option) =>
    setter((prev) =>
      prev.includes(option) ? prev.filter((x) => x !== option) : [...prev, option],
    )

  const collect = () => ({ expressions, childReactions, emotions })

  // 상단 인라인 문장빌더 — 지금까지 고른 확정 선택지(무추론)를 이름·아이이름과 함께 한 줄로 보여준다.
  //  ★ 신규 문구 아님: 선택 라벨(확정 자산) + 이름 + 구두점만 조합. 선택 전에는 렌더 안 함.
  const builder = () =>
    expressions.length || childReactions.length ? (
      <div style={{ ...styles.infoCard, ...styles.comfortCard, marginBottom: '20px' }}>
        {expressions.length > 0 && (
          <div style={styles.infoBody}>
            {userName}님: “{expressions.join('”, “')}”
          </div>
        )}
        {childReactions.length > 0 && (
          <div style={{ ...styles.infoBody, marginTop: '6px' }}>
            {familiar(childName)}: {childReactions.join(', ')}
          </div>
        )}
      </div>
    ) : null

  // ① 내 표현 (순서대로, "그 외" 포함) — 상단 문장빌더
  if (step === 'expr') {
    return (
      <QuestionStep
        onBack={onBack}
        title={c.expression.question(childName)}
        sub={c.expression.sub}
        canProceed={expressions.length > 0}
        onNext={() => setStep('reaction')}
      >
        {builder()}
        <OrderedCardList
          options={[...c.expression.options, c.expression.otherOption]}
          order={expressions}
          onToggle={toggle(setExpressions)}
        />
      </QuestionStep>
    )
  }

  // ② 아이 반응 (순서대로) — 상단 문장빌더. 여기까지 = 최소선 충족.
  if (step === 'reaction') {
    return (
      <QuestionStep
        onBack={() => setStep('expr')}
        title={c.childReaction.question(childName)}
        sub={c.childReaction.sub}
        canProceed={childReactions.length > 0}
        onNext={() => setStep('branch')}
      >
        {builder()}
        <OrderedCardList
          options={c.childReaction.options}
          order={childReactions}
          onToggle={toggle(setChildReactions)}
        />
      </QuestionStep>
    )
  }

  // ③ 중단 / 이어서 — 안심 문구(§801) + 두 갈래. 최소선 충족 상태라 중단해도 번역/결과로.
  if (step === 'branch') {
    return (
      <PhoneFrame onBack={() => setStep('reaction')}>
        <div className="fade-in">
          <p style={{ ...styles.resultParagraph }}>{s.reassure}</p>
        </div>
        <div style={styles.footer}>
          <div style={styles.choiceList}>
            <button style={styles.choiceButton} onClick={() => setStep('feeling')}>
              {s.continue}
            </button>
            <button style={styles.primaryButton} onClick={() => onDone(collect())}>
              {s.stop}
            </button>
          </div>
        </div>
      </PhoneFrame>
    )
  }

  // ④ 내 감정 (이어서 선택 시) — 감정칩(순서). L-24 원인 식별은 붙이지 않음(범위 밖).
  return (
    <QuestionStep
      onBack={() => setStep('branch')}
      title={c.feeling.question(userName)}
      sub={c.feeling.sub}
      canProceed={emotions.length > 0}
      onNext={() => onDone(collect())}
    >
      {builder()}
      <OrderedChipGroup
        options={c.feeling.emotions}
        order={emotions}
        onToggle={toggle(setEmotions)}
      />
    </QuestionStep>
  )
}
