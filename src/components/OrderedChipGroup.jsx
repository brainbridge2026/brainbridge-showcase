import { styles } from '../theme'

// 순서대로 고르는 칩 그룹. order 배열의 순서가 곧 선택 순번.
export default function OrderedChipGroup({ options, order, onToggle }) {
  return (
    <div style={styles.chipGroup}>
      {options.map((option) => {
        const idx = order.indexOf(option)
        const selected = idx !== -1
        return (
          <button
            key={option}
            style={{
              ...styles.chip,
              ...(selected ? styles.chipSelected : {}),
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
            }}
            onClick={() => onToggle(option)}
          >
            {selected && <span style={styles.orderBadge}>{idx + 1}</span>}
            <span>{option}</span>
          </button>
        )
      })}
    </div>
  )
}
