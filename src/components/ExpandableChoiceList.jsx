import { useState } from 'react'
import { styles } from '../theme'

// 유형별 "대표 표현(rep) + 더 자세히(expand 2개)" 펼침 선택 목록.
//  - CardChoiceList의 시각 톤을 그대로 따름(choiceButton/choiceButtonSelected/expandButton 재사용).
//    디자인을 새로 만들지 않고 기존 스타일만 조합한다.
//  - 전체를 통틀어 단일 선택: 어느 유형의 rep 또는 expand 중 딱 하나.
// props:
//  items    = [{ typeKey, rep, expand:[a,b] }]
//  selected = { typeKey, text } | null
//  onSelect = (typeKey, text) => void
//  moreLabel= "더 자세히"(펼침 어포던스 라벨)
export default function ExpandableChoiceList({ items, selected, onSelect, moreLabel }) {
  const [open, setOpen] = useState({}) // typeKey → 펼침 여부

  const isSel = (typeKey, text) =>
    selected && selected.typeKey === typeKey && selected.text === text

  const optButton = (typeKey, text, extra) => (
    <button
      key={text}
      style={{
        ...styles.choiceButton,
        ...(isSel(typeKey, text) ? styles.choiceButtonSelected : {}),
        ...extra,
      }}
      onClick={() => onSelect(typeKey, text)}
    >
      {text}
    </button>
  )

  return (
    <div style={styles.choiceList}>
      {items.map((item) => {
        const isOpen = !!open[item.typeKey]
        return (
          <div key={item.typeKey}>
            {/* 대표 표현(rep) */}
            {optButton(item.typeKey, item.rep)}
            {/* 더 자세히 펼침 어포던스 */}
            <button
              style={styles.expandButton}
              onClick={() =>
                setOpen((prev) => ({ ...prev, [item.typeKey]: !prev[item.typeKey] }))
              }
            >
              {isOpen ? `${moreLabel} ▲` : `${moreLabel} ▼`}
            </button>
            {/* 같은 유형의 세부 표현(expand) — 유형 아래로 묶여 보이게 */}
            {isOpen && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  marginTop: '8px',
                }}
              >
                {item.expand.map((e) =>
                  optButton(item.typeKey, e, { fontSize: '15px' }),
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
