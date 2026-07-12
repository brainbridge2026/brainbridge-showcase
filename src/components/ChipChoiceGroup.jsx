import { styles } from '../theme'

// 칩(태그)형 다중 선택 그룹. (감정 등)
export default function ChipChoiceGroup({ options, selected, onToggle }) {
  return (
    <div style={styles.chipGroup}>
      {options.map((option) => {
        const on = selected.includes(option)
        return (
          <button
            key={option}
            style={{ ...styles.chip, ...(on ? styles.chipSelected : {}) }}
            onClick={() => onToggle(option)}
          >
            {option}
          </button>
        )
      })}
    </div>
  )
}
