import { useState, useEffect } from 'react'
import PhoneFrame from '../components/PhoneFrame'
import { styles } from '../theme'
import { texts } from '../texts'
import { cleanText, isSupportedFormat } from '../utils/text'
import { getTdNumber } from '../utils/td'
import catalog from '../data/tdCatalog.json'

const ALL_TDS = catalog.categories.flatMap((c) => c.items)

// 검토 화면 — matchTdToInput 이 고른 td의 결과(받아주기 1겹)를 미리보기로 보여주고,
//  "이대로 보내기"를 누르면 그 td의 결과 화면으로 넘어간다. (수정 기능은 오늘 범위 밖)
//  match: { num, title, format, score } — 없으면 ?td= 로 대체(개발/딥링크 확인용).
export default function ReviewScreen({ match, onBack, onSend }) {
  // 미매칭(situationToTd·키워드 모두 미달) → td1 미리보기 금지, 미지원 안내(§4).
  const unmatched = match != null && match.num == null
  const num = match?.num ?? getTdNumber()
  const title = unmatched
    ? ''
    : match?.title ?? ALL_TDS.find((t) => t.num === num)?.title ?? ''
  const p = texts.review

  const [preview, setPreview] = useState('')
  const [supported, setSupported] = useState(true)
  useEffect(() => {
    let alive = true
    if (unmatched) {
      setSupported(false)
      return
    }
    fetch(`/td_json/td${num}.json`)
      .then((res) => res.json())
      .then((json) => {
        if (!alive) return
        if (!isSupportedFormat(json)) {
          setSupported(false)
          return
        }
        // 결과 화면 1겹(받아주기) 첫 문단을 미리보기로
        const subs = json?.sections?.A?.subsections ?? {}
        const raw = subs['A-1. 받아주기']?.text ?? ''
        setPreview(cleanText(raw).split(/\n{2,}/)[0] ?? '')
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [num, unmatched])

  return (
    <PhoneFrame onBack={onBack} align="top">
      <div className="fade-in">
        <h1 style={styles.reportTitle}>{p.title}</h1>
        <p style={styles.reportNote}>{p.sub}</p>

        {/* 매칭된 초안 미리보기 */}
        <div style={{ ...styles.infoCard, marginTop: '18px' }}>
          <div style={styles.infoTitle}>
            {!unmatched && <span style={styles.pickerNum}>td{num}</span>}
            {title}
          </div>
          <div style={styles.infoBody}>
            {supported ? preview || p.noPreview : p.unsupportedPreview}
          </div>
        </div>
      </div>

      <div style={styles.footer}>
        <button style={styles.primaryButton} onClick={onSend}>
          {p.send}
        </button>
      </div>
    </PhoneFrame>
  )
}
