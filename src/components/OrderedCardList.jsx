import { styles } from '../theme'

// 순서대로 고르는 카드 목록. order 배열의 순서가 곧 선택 순번.
// 선택된 카드에는 오른쪽에 순번 배지가 표시된다.
export default function OrderedCardList({ options, order, onToggle }) {
  return (
    <div style={styles.choiceList}>
      {options.map((option) => {
        const idx = order.indexOf(option)
        const selected = idx !== -1
        return (
          <button
            key={option}
            style={{
              ...styles.choiceButton,
              ...(selected ? styles.choiceButtonSelected : {}),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
            }}
            onClick={() => onToggle(option)}
          >
            <span>{option}</span>
            {selected && <span style={styles.orderBadge}>{idx + 1}</span>}
          </button>
        )
      })}
    </div>
  )
}
