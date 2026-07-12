import PhoneFrame from '../components/PhoneFrame'
import { styles } from '../theme'

// 아직 안 만든 화면을 위한 공용 placeholder.
export default function PlaceholderScreen({ onBack, title, note }) {
  return (
    <PhoneFrame onBack={onBack}>
      <div>
        <h1 style={styles.question}>{title}</h1>
        <p style={{ ...styles.subText, marginTop: '12px' }}>{note}</p>
      </div>
    </PhoneFrame>
  )
}
