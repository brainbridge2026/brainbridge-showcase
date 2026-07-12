import PhoneFrame from '../components/PhoneFrame'
import { styles } from '../theme'
import { texts } from '../texts'

// 소진 케어 placeholder (3건 도달 시)
export default function BurnoutScreen({ onBack }) {
  return (
    <PhoneFrame onBack={onBack}>
      <div>
        <h1 style={styles.question}>{texts.burnout.title}</h1>
        <p style={{ ...styles.subText, marginTop: '14px' }}>
          {texts.burnout.body}
        </p>
        <p style={{ ...styles.suggestionNote, marginTop: '18px' }}>
          {texts.burnout.note}
        </p>
      </div>
    </PhoneFrame>
  )
}
