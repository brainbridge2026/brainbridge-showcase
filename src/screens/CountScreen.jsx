import PhoneFrame from '../components/PhoneFrame'
import { styles } from '../theme'
import { texts } from '../texts'

// 부딪힌 횟수. "없었어요" → 위로 화면, "한 번"/"두 번 이상" → 한 건 입력 시작.
export default function CountScreen({ onBack, onNone, onStart }) {
  const [none, once, multiple] = texts.count.options

  const handleSelect = (option) => {
    if (option === none) onNone()
    else if (option === once) onStart('once')
    else onStart('multiple')
  }

  return (
    <PhoneFrame onBack={onBack}>
      <h1 style={styles.question}>{texts.count.question}</h1>
      <div style={styles.choiceList}>
        {texts.count.options.map((option) => (
          <button
            key={option}
            style={styles.choiceButton}
            onClick={() => handleSelect(option)}
          >
            {option}
          </button>
        ))}
      </div>
    </PhoneFrame>
  )
}
