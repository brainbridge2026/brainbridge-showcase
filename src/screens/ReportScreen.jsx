import { useState, useEffect } from 'react'
import PhoneFrame from '../components/PhoneFrame'
import { styles } from '../theme'
import { texts } from '../texts'
import { findByRelation } from '../data/familyMembers'
import { getTdNumber } from '../utils/td'
import { cleanText, isSupportedFormat } from '../utils/text'
import UnsupportedNotice from '../components/UnsupportedNotice'

// 기본은 1번. ?td=50 처럼 URL로 다른 사건 번호를 테스트할 수 있다.
const TD_NUMBER = getTdNumber()

// 통합 리포트 (부모 전용). 개인 결과 ↔ 통합 리포트 양방향 왕래.
// 6블록 본문은 td_json/td{번호}.json 에서 로드:
//  [1] 함께 겪은 순간   ← C표 "1. 우리가 함께 겪은 순간"
//  [2] 그때 우리는       ← C표 "2. 그때 우리는"
//  [3] 다르게 느낀 것    ← C표 "3. 우리가 다르게 느꼈던 건"
//  [4] ADHD 성향        ← C표 "4. 이 순환을 이해하는 열쇠"
//  [5] 표현·행동 코칭    ← 카드 3개: 💬(C-5 + A-3 발화속뜻), 🤝(C-6 + A-3 실행지연), ⚠️(A-3 피할표현)
//  [6] 양육자 케어      ← 엄마뷰 C표 "7. 그리고, 현정님께" / 아빠뷰는 spouseOn 일 때만
export default function ReportScreen({
  userName,
  tdNumber,
  spouseIncluded,
  onBack,
  onHome,
  onChildReport,
  onMission,
}) {
  // 매칭 결과가 prop으로 오면 그 번호를, 없으면 URL ?td=(기본 1)을 쓴다. (getTdNumber는 폴백)
  const tdNum = tdNumber ?? TD_NUMBER
  const childName = findByRelation('아이')?.name ?? '아이'
  const spouse = findByRelation('배우자')
  const spouseName = spouse?.givenName ?? spouse?.name ?? '배우자'
  const r = texts.report

  const params = new URLSearchParams(window.location.search)
  const [feedback, setFeedback] = useState(null)
  const [note, setNote] = useState('')
  // [6] 데모용 관점 토글: 'parent'(현정님) | 'spouse'(정민님). 실제로는 로그인 기준 자동.
  //  개발 확인용 ?care=spouse 로 아빠 뷰를 초기 선택 상태로 열 수 있다.
  const [careView, setCareView] = useState(
    params.get('care') === 'spouse' ? 'spouse' : 'parent',
  )

  // 아빠(정민님) 개입 여부. 실서비스에선 "누구와?"에서 배우자 선택 시 true.
  //  개발 확인용으로 ?spouse=1 딥링크로도 강제 표시 가능.
  const spouseOn = spouseIncluded || params.get('spouse') === '1'

  // 값이 함수면 (name, child) / (name, spouse, child) 로 채운다.
  const t = (v) => (typeof v === 'function' ? v(userName, childName) : v)
  const ts = (v) =>
    typeof v === 'function' ? v(userName, spouseName, childName) : v

  // td_json 로드 → C표(1~7)·A-3표(왜) 파싱. 자산없음("…비워둡니다")·[출처]는 화면 직전 정리.
  //  + B표(아빠 정민님 블록)도 파싱해서 [6] 양육자 케어의 아빠 뷰에 그대로 재사용.
  const [data, setData] = useState(null)
  const [spouseBlocks, setSpouseBlocks] = useState([])
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
        // C 표 — 블록명 키워드로 행을 찾아 내용 반환 (자산없음이면 빈 문자열)
        const rowsC = json?.sections?.C?.tables?.[0]?.rows ?? []
        const c = (kw) => {
          const row = rowsC.find((x) => (x['블록'] ?? '').includes(kw))
          const body = row ? cleanText(row['내용']) : ''
          return body.includes('비워둡니다') ? '' : body
        }
        // A-3 표 — 항목 술어로 "왜" 문구를 찾는다
        const subs = json?.sections?.A?.subsections ?? {}
        const a3Key = Object.keys(subs).find((k) => k.includes('A-3'))
        const rowsA3 = a3Key ? subs[a3Key]?.tables?.[0]?.rows ?? [] : []
        const a3 = (pred) => {
          const row = rowsA3.find((x) => pred(x['항목'] ?? ''))
          const body = row ? cleanText(row['내용']) : ''
          return body.includes('비워둡니다') ? '' : body
        }

        setData({
          moment: c('함께 겪은 순간'), // C-1
          weWere: c('그때 우리는'), // C-2
          gap: c('다르게 느꼈던'), // C-3
          key: c('이해하는 열쇠'), // C-4
          say: c('이렇게 말해보면'), // C-5
          act: c('이렇게 해보면'), // C-6
          care: c('그리고'), // C-7 그리고, 현정님께
          sayWhy: a3((k) => k.includes('발화 속뜻') || k.includes('번역')),
          actWhy: a3((k) => k.includes('실행 지연') || k.includes('관계 해석')),
          avoid: a3((k) => k.includes('피할 표현') || k.includes('피할 말')),
        })

        // B 표 — 아빠(정민님) 블록. 자산 있는 행만 카드로 (양육자 케어 아빠 뷰에 재사용).
        const rowsB = json?.sections?.B?.tables?.[0]?.rows ?? []
        setSpouseBlocks(
          rowsB
            .filter((row) => {
              const src = row['출처'] ?? ''
              const body = row['내용'] ?? ''
              return !src.includes('자산 없음') && !body.includes('비워둡니다')
            })
            .map((row) => ({
              subtitle: row['소제목'],
              body: cleanText(row['내용']),
            })),
        )
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [tdNum])

  const d = data ?? {}

  // 💬/🤝/⚠️ 코칭 카드 — 본문 + 왜(회색). 본문이 비면 카드 생략.
  const coachCard = (icon, title, body, why, tone) =>
    body ? (
      <div style={{ ...styles.infoCard, ...tone }}>
        <div style={styles.coachCardTitle}>
          {icon} {title}
        </div>
        <div style={styles.coachItem}>
          <div style={styles.coachLine}>{body}</div>
          {why && <div style={styles.coachWhy}>{why}</div>}
        </div>
      </div>
    ) : null

  // 안전장치 — 지원하지 않는 사건 유형이면 안내 카드만 보여준다.
  if (unsupported) {
    return <UnsupportedNotice onBack={onBack} onHome={onHome} />
  }

  return (
    <PhoneFrame onBack={onBack} align="top">
      <div>
        {/* 상단 제목 */}
        <h1 style={styles.reportTitle}>{t(r.title)}</h1>

        {/* [1] 함께 겪은 순간 — C-1 */}
        <h2 style={styles.sectionHeading}>{r.moment.heading}</h2>
        <p style={styles.reportBody}>{d.moment}</p>

        {/* [2] 그때 우리는 — C-2 */}
        <h2 style={styles.sectionHeading}>{r.perspectives.heading}</h2>
        <p style={styles.reportBody}>{d.weWere}</p>

        {/* [3] 다르게 느낀 것 — C-3 */}
        <h2 style={styles.sectionHeading}>{r.gap.heading}</h2>
        <p style={styles.reportBody}>{d.gap}</p>

        {/* [4] ADHD 성향 — C-4 */}
        <h2 style={styles.sectionHeading}>{r.key.heading}</h2>
        <p style={styles.reportBody}>{d.key}</p>

        {/* [5] 표현·행동 코칭 — 카드 3개 */}
        <h2 style={styles.sectionHeading}>{r.coaching.heading}</h2>
        {coachCard('💬', '이렇게 말해보면', d.say, d.sayWhy, styles.infoCardTeal)}
        {coachCard('🤝', '이렇게 해보면', d.act, d.actWhy, styles.infoCardTeal)}
        {coachCard('⚠️', '이런 말은 피해요', d.avoid, '', styles.infoCardCoral)}

        {/* [6] 양육자 케어 — 엄마뷰: C-7 / 아빠뷰: spouseOn 일 때만 노출 */}
        <p style={{ ...styles.reportNote, marginTop: '30px' }}>
          {r.care.demoNote}
        </p>
        {spouseOn && (
          <div style={styles.careToggle}>
            <button
              style={{
                ...styles.careTab,
                ...(careView === 'parent' ? styles.careTabActive : {}),
              }}
              onClick={() => setCareView('parent')}
            >
              {ts(r.care.toggle.parent)}
            </button>
            <button
              style={{
                ...styles.careTab,
                ...(careView === 'spouse' ? styles.careTabActive : {}),
              }}
              onClick={() => setCareView('spouse')}
            >
              {ts(r.care.toggle.spouse)}
            </button>
          </div>
        )}
        {spouseOn && careView === 'spouse' ? (
          // 아빠 뷰 — td_json B블록(정민님) 카드를 그대로 재사용
          spouseBlocks.map((b, i) => (
            <div key={i} style={styles.spouseSectionCard}>
              <div style={styles.spouseSubtitle}>{b.subtitle}</div>
              <div style={styles.spouseBody}>{b.body}</div>
            </div>
          ))
        ) : (
          // 엄마 뷰 — C-7 "그리고, 현정님께"
          <div style={styles.careCard}>
            <div style={styles.careHeading}>{ts(r.care.forParent.heading)}</div>
            <div style={styles.careBody}>{d.care}</div>
          </div>
        )}

        {/* 피드백 */}
        <h2 style={styles.sectionHeading}>{r.feedback.question}</h2>
        <div style={styles.choiceList}>
          {r.feedback.options.map((opt) => (
            <button
              key={opt}
              style={{
                ...styles.choiceButton,
                ...(feedback === opt ? styles.choiceButtonSelected : {}),
              }}
              onClick={() => setFeedback(opt)}
            >
              {opt}
            </button>
          ))}
        </div>
        <textarea
          style={styles.textInput}
          rows={3}
          placeholder={r.feedback.placeholder}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      {/* 하단 버튼 */}
      <div style={styles.footer}>
        <div style={styles.choiceList}>
          <button style={styles.primaryButton} onClick={onBack}>
            {r.backToResult}
          </button>
          <button style={styles.choiceButton} onClick={onMission}>
            {r.missionLink}
          </button>
          <button style={styles.choiceButton} onClick={onChildReport}>
            {t(r.childReport)}
          </button>
          <button style={styles.choiceButton} onClick={onHome}>
            {r.home}
          </button>
        </div>
        <p style={styles.reportNote}>{r.childReportNote}</p>
      </div>
    </PhoneFrame>
  )
}
