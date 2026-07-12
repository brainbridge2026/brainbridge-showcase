import { useState } from 'react'
import PhoneFrame from '../components/PhoneFrame'
import { styles } from '../theme'
import { texts } from '../texts'
import { familyMembers } from '../data/familyMembers'

// 함께 있던 사람 고르기 (다중 선택). 선택 결과(selectedIds)를 onNext로 넘긴다.
// 이 선택은 이후 아빠 관련 질문 분기에 그대로 사용된다.
export default function WhoScreen({ onBack, onNext }) {
  const [selectedIds, setSelectedIds] = useState([])

  const toggle = (id) =>
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )

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
                onClick={() => toggle(member.id)}
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
          onClick={() => hasSelection && onNext(selectedIds)}
          disabled={!hasSelection}
        >
          {texts.who.nextButton}
        </button>
      </div>
    </PhoneFrame>
  )
}
