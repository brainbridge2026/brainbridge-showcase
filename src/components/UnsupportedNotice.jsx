import PhoneFrame from './PhoneFrame'
import { styles } from '../theme'
import { texts } from '../texts'

// 안전장치 — 아직 화면이 지원하지 않을 때 빈 화면 대신 "준비 중" 안내 카드.
//  variant='hot'(기본): 감정폭발축(child_emotion) 전용 문구 — 변경 금지.
//  variant='situation': 상황축 미매칭 전용 문구 (향후 상황축 확장 대비 분기).
export default function UnsupportedNotice({ onBack, onHome, variant = 'hot' }) {
  const u = texts.unsupported
  const isSituation = variant === 'situation'
  const title = isSituation ? u.situationTitle : u.title
  const body = isSituation ? u.situationBody : u.body
  return (
    <PhoneFrame onBack={onBack} align="top">
      <div className="fade-in">
        <div style={styles.infoCard}>
          <div style={styles.infoTitle}>{title}</div>
          <div style={styles.infoBody}>{body}</div>
        </div>
      </div>
      <div style={styles.footer}>
        <button style={styles.primaryButton} onClick={onHome}>
          {u.home}
        </button>
      </div>
    </PhoneFrame>
  )
}
