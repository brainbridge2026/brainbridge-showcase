import PhoneFrame from '../../components/PhoneFrame'
import { styles } from '../../theme'
import { texts } from '../../texts'

// 4-3단계. 왜 나누고 싶은지 (복수 선택)
// absentNames: 나눌 대상, presentNames: 그 자리에 있던 가족
export default function ShareReasonStep({
  absentNames,
  presentNames,
  selectedReasons,
  onToggle,
  onBack,
  onNext,
}) {
  const options = texts.reason.options(absentNames, presentNames)

  return (
    <PhoneFrame onBack={onBack}>
      <div>
        <h1 style={styles.question}>{texts.reason.title(absentNames)}</h1>

        <div style={styles.choiceList}>
          {options.map((option) => {
            const selected = selectedReasons.includes(option)
            return (
              <button
                key={option}
                style={{
                  ...styles.choiceButton,
                  ...(selected ? styles.choiceButtonSelected : {}),
                }}
                onClick={() => onToggle(option)}
              >
                {option}
              </button>
            )
          })}
        </div>

        <p style={{ ...styles.suggestionNote, marginTop: '16px' }}>
          {texts.reason.note(absentNames)}
        </p>
      </div>

      <div style={styles.footer}>
        <button style={styles.primaryButton} onClick={onNext}>
          {texts.reason.nextButton}
        </button>
      </div>
    </PhoneFrame>
  )
}
