import { useState, useEffect } from 'react'
import PhoneFrame from '../components/PhoneFrame'
import { styles } from '../theme'
import { texts } from '../texts'
import { findByRelation } from '../data/familyMembers'
import { getTdNumber } from '../utils/td'
import { cleanText } from '../utils/text'
import UnsupportedNotice from '../components/UnsupportedNotice'

// 기본은 1번. ?td=50 처럼 URL로 다른 사건 번호를 테스트할 수 있다.
const TD_NUMBER = getTdNumber()

// 아빠(정민님) 전용 3겹 순서.
const LAYER_DEFS = [
  { key: 'layer1', label: '받아주기' },
  { key: 'layer2', label: '핵심이해' },
  { key: 'layer3', label: '깊은 근거' },
]

// 자산 없음 판정 (기존 규칙과 동일: 비워둠/자산 없음/대표 집필 필요는 생략)
const isAssetLess = (t) =>
  !t ||
  t.includes('비워둡니다') ||
  t.includes('자산 없음') ||
  t.includes('대표 집필 필요')

// 2·3겹 안의 "**소제목**:"은 내용이므로, 줄바꿈으로 분리해 읽기 좋게 정리.
//  (1겹은 소제목이 없어 그대로) 이후 cleanText로 [출처]·잔여 마크다운 제거.
const formatLayer = (raw) =>
  cleanText((raw ?? '').replace(/\s*\*\*([^*]+?)\*\*\s*:/g, '\n$1:'))

// 정민님용 개인결과 — 아빠(정민님) 전용 3겹 리포트.
//  데이터: sections.B2_dad (td111만 sections.D_prime_dad) = { layer1, layer2, layer3 }.
//  ?viewer=spouse 로 볼 때만 이 블록을 노출한다(기존 B블록 조건부 렌더와 같은 취지).
//  layer1(받아주기)→layer2(핵심이해)→layer3(깊은 근거) 순서, 자산 없음은 생략.
// onBack/onHome: 홈으로, onReport: 통합 리포트로.
export default function SpouseResultScreen({
  userName,
  tdNumber,
  onBack,
  onHome,
  onReport,
}) {
  const spouse = findByRelation('배우자')
  const spouseName = spouse?.givenName ?? spouse?.name ?? '아빠'
  const s = texts.spouseResult

  // 매칭 결과 등으로 prop이 오면 그 번호를, 없으면 URL ?td= (기본 1)을 쓴다.
  const tdNum = tdNumber ?? TD_NUMBER

  // 아빠 전용 블록은 viewer=spouse로 볼 때만 노출.
  const viewerSpouse =
    new URLSearchParams(window.location.search).get('viewer') === 'spouse'

  const [blocks, setBlocks] = useState([])
  const [unsupported, setUnsupported] = useState(false)
  useEffect(() => {
    let alive = true
    fetch(`/td_json/td${tdNum}.json`)
      .then((res) => res.json())
      .then((data) => {
        if (!alive) return
        // 아빠 전용 3겹: 대부분 B2_dad, td111만 D_prime_dad.
        const dad = data?.sections?.B2_dad ?? data?.sections?.D_prime_dad ?? null
        if (!dad) {
          // 아빠 전용 블록 자체가 없는 유형이면 안내 카드.
          setUnsupported(true)
          return
        }
        setBlocks(
          LAYER_DEFS.map((d) => ({
            label: d.label,
            body: formatLayer(dad[d.key]),
          })).filter((b) => !isAssetLess(b.body)),
        )
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [tdNum])

  // 안전장치 — 아빠 전용 블록이 없으면 안내 카드만.
  if (unsupported) {
    return <UnsupportedNotice onBack={onBack} onHome={onHome} />
  }

  return (
    <PhoneFrame onBack={onBack} align="top">
      <div className="fade-in">
        <h1 style={styles.reportTitle}>{s.title(userName, spouseName)}</h1>
        <p style={styles.reportNote}>{s.intro(userName, spouseName)}</p>

        {/* 조건부: viewer=spouse로 볼 때만 아빠(정민님) 전용 3겹 표시 */}
        {viewerSpouse && (
          <div style={{ marginTop: '18px' }}>
            {blocks.map((b, i) => (
              <div key={i} style={styles.infoCard}>
                <div style={styles.infoTitle}>{b.label}</div>
                <div style={styles.infoBody}>{b.body}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ ...styles.choiceList, marginTop: '24px' }}>
          <button style={styles.primaryButton} onClick={onReport}>
            {s.report}
          </button>
          <button style={styles.choiceButton} onClick={onHome}>
            {s.home}
          </button>
        </div>
      </div>
    </PhoneFrame>
  )
}
