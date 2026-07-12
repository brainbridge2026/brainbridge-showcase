import PhoneFrame from '../../components/PhoneFrame'
import { styles } from '../../theme'
import { texts } from '../../texts'

// 4-2단계. 그 자리에 없던 가족에게 전달할지 선택
// absentNames: 안 고른(부재) 가족 이름 문자열 (여러 명이면 ", "로 연결)
export default function AbsentShareStep({ absentNames, onBack, onYes, onNo }) {
  return (
    <PhoneFrame onBack={onBack}>
      <div>
        <h1 style={styles.question}>{texts.absent.title(absentNames)}</h1>
        <p style={{ ...styles.subText, marginTop: '14px' }}>
          {texts.absent.desc(absentNames)}
        </p>
      </div>

      <div style={styles.footer}>
        <div style={styles.choiceList}>
          <button style={styles.primaryButton} onClick={onYes}>
            {texts.absent.shareYes(absentNames)}
          </button>
          <button style={styles.choiceButton} onClick={onNo}>
            {texts.absent.shareNo}
          </button>
        </div>
      </div>
    </PhoneFrame>
  )
}
