import PhoneFrame from './PhoneFrame'
import { styles } from '../theme'
import { texts } from '../texts'

// 질문 하나 + 선택지(children) + 하단 "다음" 버튼으로 구성되는 공용 스텝 레이아웃.
// canProceed가 false면 "다음"은 비활성.
export default function QuestionStep({
  onBack,
  title,
  sub,
  canProceed = true,
  nextLabel,
  onNext,
  secondaryLabel,
  onSecondary,
  children,
}) {
  const label = nextLabel ?? texts.conflict.nextButton
  return (
    <PhoneFrame onBack={onBack}>
      <div>
        <h1 style={styles.question}>{title}</h1>
        {sub && <p style={{ ...styles.subText, marginTop: '12px' }}>{sub}</p>}
        {children}
      </div>
      <div style={styles.footer}>
        <button
          style={{
            ...styles.primaryButton,
            ...(canProceed ? {} : styles.primaryButtonDisabled),
          }}
          disabled={!canProceed}
          onClick={() => canProceed && onNext()}
        >
          {label}
        </button>
        {secondaryLabel && (
          <button style={styles.textButton} onClick={onSecondary}>
            {secondaryLabel}
          </button>
        )}
      </div>
    </PhoneFrame>
  )
}
