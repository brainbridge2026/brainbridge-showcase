import PhoneFrame from '../components/PhoneFrame'
import { styles } from '../theme'
import { texts } from '../texts'

// 다른 일도? (두 번 이상일 때만)
export default function AnotherAskScreen({ onBack, onNow, onLater }) {
  return (
    <PhoneFrame onBack={onBack}>
      <h1 style={styles.question}>{texts.another.question}</h1>
      <div style={styles.choiceList}>
        <button style={styles.primaryButton} onClick={onNow}>
          {texts.another.now}
        </button>
        <button style={styles.choiceButton} onClick={onLater}>
          {texts.another.later}
        </button>
      </div>
    </PhoneFrame>
  )
}
