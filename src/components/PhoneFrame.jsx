import { styles } from '../theme'
import { texts } from '../texts'

// 모든 화면을 감싸는 공용 레이아웃.
// onBack이 주어지면 상단에 "뒤로" 버튼을 보여준다. (홈 화면 등에서는 생략)
// align="top": 내용이 길어 스크롤이 필요한 화면(결과 등)은 위쪽 정렬.
export default function PhoneFrame({ onBack, align, children }) {
  const bodyStyle =
    align === 'top' ? { ...styles.body, justifyContent: 'flex-start' } : styles.body
  return (
    <div style={styles.page}>
      <div style={styles.phone}>
        <div style={styles.topBar}>
          {onBack && (
            <button style={styles.backButton} onClick={onBack}>
              {texts.back}
            </button>
          )}
        </div>
        <div style={bodyStyle}>{children}</div>
      </div>
    </div>
  )
}
