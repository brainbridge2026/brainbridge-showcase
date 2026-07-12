import PhoneFrame from '../components/PhoneFrame'
import { styles } from '../theme'
import { texts } from '../texts'

// 3. [가장 힘든 일부터]
// variant: 'once'(한 번) | 'multiple'(두 번/세 번 이상) — 문구가 달라진다.
export default function HardestScreen({ variant, onBack, onNext }) {
  const copy = texts.hardest[variant] ?? texts.hardest.multiple

  return (
    <PhoneFrame onBack={onBack}>
      <div>
        <h1 style={styles.question}>{copy.question}</h1>
        <p style={{ ...styles.subText, marginTop: '12px' }}>{copy.sub}</p>
      </div>
      <div style={styles.footer}>
        <button style={styles.primaryButton} onClick={onNext}>
          {texts.hardest.startButton}
        </button>
      </div>
    </PhoneFrame>
  )
}
