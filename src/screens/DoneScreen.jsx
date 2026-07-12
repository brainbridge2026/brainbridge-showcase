import PhoneFrame from '../components/PhoneFrame'
import { styles } from '../theme'
import { texts } from '../texts'

// 완료. "결과 보기"로 개인 결과 화면 진입.
// "두 번 이상"이면 다른 일도 나눌지 안내로도 이어질 수 있음.
export default function DoneScreen({ onBack, isMultiple, onResult, onContinue }) {
  return (
    <PhoneFrame onBack={onBack}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={styles.question}>{texts.done.title}</h1>
      </div>
      <div style={styles.footer}>
        <button style={styles.primaryButton} onClick={onResult}>
          {texts.done.resultButton}
        </button>
        {isMultiple && (
          <button style={styles.textButton} onClick={onContinue}>
            {texts.done.anotherButton}
          </button>
        )}
      </div>
    </PhoneFrame>
  )
}
