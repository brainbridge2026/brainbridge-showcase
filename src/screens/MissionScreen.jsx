import { useState, useEffect } from 'react'
import PhoneFrame from '../components/PhoneFrame'
import { styles } from '../theme'
import { texts } from '../texts'
import { getTdNumber } from '../utils/td'
import { cleanText, isSupportedFormat } from '../utils/text'
import UnsupportedNotice from '../components/UnsupportedNotice'
import { comfortMessages } from '../data/comfortMessages'

// 기본은 1번. ?td=50 처럼 URL로 다른 사건 번호를 테스트할 수 있다.
const TD_NUMBER = getTdNumber()

// 데일리 미션 & 효과 피드백 (E). 통합 리포트에서 진입.
//  sections.E.tables[0].rows 5줄 → 카드. "안 했을 때 위로"(자산없음)는 생략하고,
//  대신 공용 위로 문구(comfortMessages)를 한 장씩 순서대로 보여준다.
//  [출처:...]·마크다운 주석은 표시 직전 제거.
export default function MissionScreen({ tdNumber, onBack, onHome }) {
  // 매칭 결과가 prop으로 오면 그 번호를, 없으면 URL ?td=(기본 1)을 쓴다. (getTdNumber는 폴백)
  const tdNum = tdNumber ?? TD_NUMBER
  const r = texts.report

  // 위로 문구 인덱스. ?comfort=3 딥링크로 특정 문구부터 시작 가능(스크린샷/개발용).
  const params = new URLSearchParams(window.location.search)
  const startComfort = Math.max(
    0,
    Math.min(comfortMessages.length - 1, (Number(params.get('comfort')) || 1) - 1),
  )
  const [comfortIdx, setComfortIdx] = useState(startComfort)

  const [cards, setCards] = useState([])
  // 지원하지 않는 사건 유형(감정 폭발축 등)이면 안전장치 안내를 띄운다.
  const [unsupported, setUnsupported] = useState(false)
  useEffect(() => {
    let alive = true
    fetch(`/td_json/td${tdNum}.json`)
      .then((res) => res.json())
      .then((json) => {
        if (!alive) return
        if (!isSupportedFormat(json)) {
          setUnsupported(true)
          return
        }
        const rowsE = json?.sections?.E?.tables?.[0]?.rows ?? []
        setCards(
          rowsE
            .filter((row) => {
              const src = row['출처'] ?? ''
              const body = row['내용'] ?? ''
              return !src.includes('자산 없음') && !body.includes('비워둡니다')
            })
            .map((row) => ({
              title: cleanText(row['항목']),
              body: cleanText(row['내용']),
            })),
        )
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [tdNum])

  // 안전장치 — 지원하지 않는 사건 유형이면 안내 카드만 보여준다.
  if (unsupported) {
    return <UnsupportedNotice onBack={onBack} onHome={onHome} />
  }

  return (
    <PhoneFrame onBack={onBack} align="top">
      <div className="fade-in">
        <h1 style={styles.reportTitle}>{r.missionTitle}</h1>
        {cards.map((c, i) => (
          <div key={i} style={styles.infoCard}>
            <div style={styles.infoTitle}>{c.title}</div>
            <div style={styles.infoBody}>{c.body}</div>
          </div>
        ))}

        {/* 안 했을 때 위로 — 한 장씩 순서대로. 목록이 늘어나면 자동 반영. */}
        {comfortMessages.length > 0 && (
          <div style={{ ...styles.infoCard, ...styles.comfortCard }}>
            {/* n/8 카운터는 검증용이라 사용자 화면에서는 숨김 (개발 시 comfortIdx로 확인) */}
            <div style={styles.infoTitle}>{r.comfort.title}</div>
            <div style={styles.infoBody}>{comfortMessages[comfortIdx]}</div>
            <button
              style={styles.comfortNext}
              onClick={() =>
                setComfortIdx((i) => (i + 1) % comfortMessages.length)
              }
            >
              {r.comfort.next}
            </button>
          </div>
        )}
      </div>
      <div style={styles.footer}>
        <button style={styles.primaryButton} onClick={onHome}>
          {r.home}
        </button>
      </div>
    </PhoneFrame>
  )
}
