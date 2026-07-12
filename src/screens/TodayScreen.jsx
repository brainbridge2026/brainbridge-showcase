import PhoneFrame from '../components/PhoneFrame'
import { styles } from '../theme'
import { texts } from '../texts'

// 1. [오늘 어땠는지] — 흐름의 진입 화면
export default function TodayScreen({ userName, onBack, onNext }) {
  return (
    <PhoneFrame onBack={onBack}>
      <div>
        <h1 style={styles.greeting}>{texts.today.greeting(userName)}</h1>
        <p style={{ ...styles.subText, marginTop: '12px' }}>{texts.today.sub}</p>
      </div>
      <div style={styles.footer}>
        <button style={styles.primaryButton} onClick={onNext}>
          {texts.today.nextButton}
        </button>
      </div>
    </PhoneFrame>
  )
}
