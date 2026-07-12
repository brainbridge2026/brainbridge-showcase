import { useState, useEffect } from 'react'
import PhoneFrame from '../components/PhoneFrame'
import { styles } from '../theme'
import { texts } from '../texts'
import { findByRelation } from '../data/familyMembers'
import { getTdNumber } from '../utils/td'
import { getAgeTier } from '../utils/ageTier'
import { cleanText, stripNum, isSupportedFormat } from '../utils/text'
import UnsupportedNotice from '../components/UnsupportedNotice'

// 기본은 1번. ?td=50 처럼 URL로 다른 사건 번호를 테스트할 수 있다.
const TD_NUMBER = getTdNumber()

// 아이용 결과 리포트 (D). 통합 리포트에서 진입.
//  sections.D는 age_tier 구조 { tier1(5~7세), tier2(8~10세), tier3(11세+) }.
//  아이 나이 → getAgeTier로 tier를 정한다. 나이 정보가 없으면 tier2가 기본값.
//  선택한 tier에 표가 없으면(예: tier1은 3줄 대본 text) tier2 → 옛 표 구조 순으로 폴백.
//  "응원"이 자산없음이면 생략. 본문은 "엄마"·"너는/네가"로 이미 작성돼 있어 그대로 표시.
export default function ChildReportScreen({ userName, tdNumber, onBack, onHome }) {
  // 매칭 결과가 prop으로 오면 그 번호를, 없으면 URL ?td=(기본 1)을 쓴다. (getTdNumber는 폴백)
  const tdNum = tdNumber ?? TD_NUMBER
  const child = findByRelation('아이')
  const childName = child?.name ?? '아이'
  // 온보딩에서 아이 나이를 받으면 child.age에 담긴다. 아직 없으면 undefined → tier2 기본.
  //  개발 확인용으로 ?age=6 딥링크로 나이를 강제 지정할 수 있다(온보딩 값 대체).
  const ageParam = new URLSearchParams(window.location.search).get('age')
  const childAge = ageParam != null && ageParam !== '' ? Number(ageParam) : child?.age
  const r = texts.report

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
        // 아이 나이로 tier 결정(나이 미상이면 tier2). 표가 없으면 tier2 → 옛 표 구조 폴백.
        const dSec = json?.sections?.D ?? {}
        const tier = getAgeTier(childAge)
        const rowsD =
          dSec?.[tier]?.tables?.[0]?.rows ??
          dSec?.tier2?.tables?.[0]?.rows ??
          dSec?.tables?.[0]?.rows ??
          []
        setCards(
          rowsD
            .filter((row) => {
              const src = row['출처'] ?? ''
              const body = row['내용'] ?? ''
              return !src.includes('자산 없음') && !body.includes('비워둡니다')
            })
            .map((row) => ({
              title: stripNum(cleanText(row['블록'])),
              body: cleanText(row['내용']),
            })),
        )
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [childAge, tdNum])

  // 안전장치 — 지원하지 않는 사건 유형이면 안내 카드만 보여준다.
  if (unsupported) {
    return <UnsupportedNotice onBack={onBack} onHome={onHome} />
  }

  return (
    <PhoneFrame onBack={onBack} align="top">
      <div className="fade-in">
        <h1 style={styles.reportTitle}>{r.childReport(userName, childName)}</h1>
        {cards.map((c, i) => (
          <div key={i} style={styles.infoCard}>
            <div style={styles.infoTitle}>{c.title}</div>
            <div style={styles.infoBody}>{c.body}</div>
          </div>
        ))}
      </div>
      <div style={styles.footer}>
        <button style={styles.primaryButton} onClick={onHome}>
          {r.home}
        </button>
      </div>
    </PhoneFrame>
  )
}
