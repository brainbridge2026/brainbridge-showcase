import PhoneFrame from '../components/PhoneFrame'
import { styles } from '../theme'
import { texts } from '../texts'

// 홈 화면. 미완료 건이 있으면 "이어하기" 카드를 위에 보여준다.
// resumeItems: [{ id, sub }]
export default function HomeScreen({ userName, resumeItems = [], onResume, onStart }) {
  return (
    <PhoneFrame>
      <div style={{ textAlign: 'center' }}>
        <h1 style={styles.greeting}>{texts.home.greeting(userName)}</h1>
        <p style={{ ...styles.subText, marginTop: '12px' }}>{texts.home.sub}</p>
      </div>

      {resumeItems.length > 0 && (
        <div style={{ marginTop: '28px' }}>
          <p style={styles.resumeLabel}>{texts.home.resume.label}</p>
          {resumeItems.map((item) => (
            <button
              key={item.id}
              style={styles.resumeCard}
              onClick={() => onResume(item.id)}
            >
              <div style={styles.resumeCardTitle}>{texts.home.resume.button}</div>
              <div style={styles.resumeCardSub}>{item.sub}</div>
            </button>
          ))}
        </div>
      )}

      <div style={styles.footer}>
        <button style={styles.primaryButton} onClick={onStart}>
          {texts.home.startButton}
        </button>
      </div>
    </PhoneFrame>
  )
}
