import PhoneFrame from '../components/PhoneFrame'
import { styles } from '../theme'
import { texts } from '../texts'

// 2-분기. "없었어요"를 골랐을 때: 위로 문구 + 예방 제안 카드.
export default function NoConflictScreen({ onBack, onHome }) {
  const { comfort, card, homeButton } = texts.noConflict

  return (
    <PhoneFrame onBack={onBack}>
      <div>
        <h1 style={styles.question}>{comfort}</h1>

        {/* 예방 제안 카드 — 연한 민트 톤으로 부드럽게 구분 */}
        <div style={styles.suggestionCard}>
          <p style={styles.suggestionTitle}>{card.title}</p>
          <p style={styles.suggestionBody}>{card.body}</p>
          <p style={styles.suggestionNote}>{card.note}</p>
        </div>
      </div>

      <div style={styles.footer}>
        <button style={styles.primaryButton} onClick={onHome}>
          {homeButton}
        </button>
      </div>
    </PhoneFrame>
  )
}
