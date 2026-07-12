import PhoneFrame from '../components/PhoneFrame'
import CardChoiceList from '../components/CardChoiceList'
import { styles } from '../theme'
import { texts } from '../texts'

// 지금 마음 — 상태에 따라 흐름이 갈린다. (선택 즉시 이동, 별도 다음 버튼 없음)
// onHard: 많이 힘듦 → 받아주기 / onSettling: 가라앉는 중 → 얕은 회고 / onCalm: 차분함 → 깊은 회고
export default function MoodScreen({ userName, onBack, onHard, onSettling, onCalm }) {
  const options = texts.mood.options
  const handlers = [onHard, onSettling, onCalm]

  return (
    <PhoneFrame onBack={onBack}>
      <div>
        <h1 style={styles.question}>{texts.mood.question(userName)}</h1>
        <p style={{ ...styles.subText, marginTop: '12px' }}>{texts.mood.sub}</p>
        <CardChoiceList
          options={options}
          isSelected={() => false}
          onSelect={(o) => handlers[options.indexOf(o)]()}
        />
      </div>
    </PhoneFrame>
  )
}
