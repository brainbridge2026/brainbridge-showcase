import { useState } from 'react'
import PhoneFrame from '../components/PhoneFrame'
import { styles } from '../theme'
import { texts } from '../texts'
import catalog from '../data/tdCatalog.json'

// 상황 선택 (선택형). 오늘은 AI 자동매칭 대신 수동 선택.
//  1단계: 카테고리 목록(1~10 + 8-A + 감정폭발축)
//  2단계: 그 카테고리 안의 td 제목 목록
//  td 제목을 누르면 ?screen=result&td={번호} 로 이동(전체 로드)해서 결과 화면을 연다.
//  (ResultScreen 등은 getTdNumber()로 ?td= 를 읽어 해당 사건을 로드)
export default function SituationPickerScreen({ onBack }) {
  const p = texts.picker
  const [cat, setCat] = useState(null) // 선택된 카테고리 객체

  const goResult = (num) => {
    window.location.search = `?screen=result&td=${num}`
  }

  // 2단계 — 카테고리 안의 td 제목 목록
  if (cat) {
    return (
      <PhoneFrame onBack={() => setCat(null)} align="top">
        <div className="fade-in">
          <h1 style={styles.reportTitle}>{cat.title}</h1>
          <div style={styles.choiceList}>
            {cat.items.map((it) => (
              <button
                key={it.num}
                style={styles.pickerItemButton}
                onClick={() => goResult(it.num)}
              >
                <span style={styles.pickerNum}>td{it.num}</span>
                {it.title}
              </button>
            ))}
          </div>
        </div>
      </PhoneFrame>
    )
  }

  // 1단계 — 카테고리 목록
  return (
    <PhoneFrame onBack={onBack} align="top">
      <div className="fade-in">
        <h1 style={styles.reportTitle}>{p.title}</h1>
        <p style={styles.reportNote}>{p.sub}</p>
        <div style={styles.choiceList}>
          {catalog.categories.map((c) => (
            <button
              key={c.key}
              style={styles.choiceButton}
              onClick={() => setCat(c)}
            >
              {c.title}
            </button>
          ))}
        </div>
      </div>
    </PhoneFrame>
  )
}
