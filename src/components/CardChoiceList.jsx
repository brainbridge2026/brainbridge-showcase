import { styles } from '../theme'

// 카드형 선택 목록. 단일/다중 선택은 isSelected/onSelect로 결정한다.
export default function CardChoiceList({ options, isSelected, onSelect }) {
  return (
    <div style={styles.choiceList}>
      {options.map((option) => {
        const selected = isSelected(option)
        return (
          <button
            key={option}
            style={{
              ...styles.choiceButton,
              ...(selected ? styles.choiceButtonSelected : {}),
            }}
            onClick={() => onSelect(option)}
          >
            {option}
          </button>
        )
      })}
    </div>
  )
}
