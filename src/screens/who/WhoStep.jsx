import PhoneFrame from '../../components/PhoneFrame'
import { styles } from '../../theme'
import { texts } from '../../texts'
import { familyMembers } from '../../data/familyMembers'

// 4-1단계. 함께 있던 사람 고르기 (다중 선택)
export default function WhoStep({ selectedIds, onToggle, onBack, onNext }) {
  const hasSelection = selectedIds.length > 0

  return (
    <PhoneFrame onBack={onBack}>
      <div>
        <h1 style={styles.question}>{texts.who.title}</h1>
        <p style={{ ...styles.subText, marginTop: '12px' }}>{texts.who.sub}</p>

        <div style={styles.choiceList}>
          {familyMembers.map((member) => {
            const selected = selectedIds.includes(member.id)
            return (
              <button
                key={member.id}
                style={{
                  ...styles.choiceButton,
                  ...(selected ? styles.choiceButtonSelected : {}),
                }}
                onClick={() => onToggle(member.id)}
              >
                <span style={styles.memberRow}>
                  <span style={styles.memberName}>{member.name}</span>
                  <span style={styles.relationChip}>{member.relation}</span>
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div style={styles.footer}>
        <button
          style={{
            ...styles.primaryButton,
            ...(hasSelection ? {} : styles.primaryButtonDisabled),
          }}
          onClick={() => hasSelection && onNext()}
          disabled={!hasSelection}
        >
          {texts.who.nextButton}
        </button>
      </div>
    </PhoneFrame>
  )
}
