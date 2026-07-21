import { useState, useEffect } from 'react'
import PhoneFrame from '../components/PhoneFrame'
import { styles } from '../theme'
import { texts } from '../texts'
import { getTdNumber } from '../utils/td'
import { cleanText, isSupportedFormat } from '../utils/text'
import UnsupportedNotice from '../components/UnsupportedNotice'
import { matchTdToInput } from '../utils/matchTd'
import tdCategoryMap from '../data/tdCategoryMap.json'
import repeatAck from '../data/repeatAcknowledgment.json'
import { pickReassure, pickRepeatAck } from '../utils/comfort'

// 기본은 1번. ?td=50 처럼 URL로 다른 사건 번호를 테스트할 수 있다.
const TD_NUMBER = getTdNumber()

// 데일리 미션 & 효과 피드백 (E). 통합 리포트에서 진입.
//  sections.E.tables[0].rows 5줄 → 카드.
//  [C-114] 미션 3질문(효과확인·변화·회고) 답변 UI — ReportScreen 3버튼+자유입력 계약 그대로 재사용.
//  [C-116] 미션 위로 자동 로테이션 — reassureText(부모위로풀)·repeatAckText(반복인정) 두 상태 분리·버튼 없음.
export default function MissionScreen({ userName, tdNumber, cases, onBack, onHome }) {
  // 매칭 결과가 prop으로 오면 그 번호를, 없으면 URL ?td=(기본 1)을 쓴다. (getTdNumber는 폴백)
  const tdNum = tdNumber ?? TD_NUMBER
  const r = texts.report

  // {부모이름} 자리표시자를 실제 사용자 이름으로 치환(ResultScreen과 동일 소비 경로).
  const fill = (s) => (s ?? '').split('{부모이름}').join(userName ?? '')

  const [cards, setCards] = useState([])
  // [C-114] 미션 3질문 답변 — 효과확인·변화·회고 각각 별도 state 키(덮어쓰기 없음).
  //  각 질문 = {choice: 선택 버튼, note: 자유입력}. report.feedback.options/placeholder 재사용.
  const [answers, setAnswers] = useState({
    effect: { choice: null, note: '' },
    change: { choice: null, note: '' },
    reflect: { choice: null, note: '' },
  })
  const setChoice = (key, choice) =>
    setAnswers((prev) => ({ ...prev, [key]: { ...prev[key], choice } }))
  const setNote = (key, note) =>
    setAnswers((prev) => ({ ...prev, [key]: { ...prev[key], note } }))

  // [C-116] 위로 자동 로테이션 두 상태(ResultScreen 재사용).
  const [reassureText, setReassureText] = useState(null) // 부모위로풀 1개(카테고리별)
  const [repeatAckText, setRepeatAckText] = useState(null) // 반복인정(횟수 구간별·없으면 생략)

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

  // [C-116] 두 위로 문구 생성 — 같은 렌더 세션 1회 고정(재렌더 시 안정).
  //  reassureText: tdCategoryMap→카테고리→부모위로풀에서 1개(활성 세션 직전과 즉시 중복 회피 로테이션).
  //  repeatAckText: 같은 td 완료 건수(이번 건 포함) 구간에 맞춰 별도 생성. 반복 데이터 없으면 생략.
  useEffect(() => {
    let alive = true

    // 반복인정 — 같은 td 완료 건수 기준(ResultScreen과 동일 계산). count<2면 null(생략).
    const sameTdCount = (cases ?? [])
      .filter((cc) => cc?.status === 'complete')
      .filter((cc) => matchTdToInput(cc).num === tdNum).length
    const ack = pickRepeatAck(repeatAck, sameTdCount)
    setRepeatAckText(ack ? fill(ack) : null)

    // 부모위로풀 — 카테고리 매핑 있는 td만. 아동풀 혼입 0(부모용 public/reassurePools.json).
    const cat = tdCategoryMap[`td${tdNum}`]
    if (!cat) {
      setReassureText(null)
    } else {
      fetch('/reassurePools.json')
        .then((res) => res.json())
        .then((pools) => {
          if (!alive) return
          const picked = pickReassure(pools?.[cat])
          setReassureText(picked ? fill(picked) : null)
        })
        .catch(() => {})
    }
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tdNum])

  // 안전장치 — 지원하지 않는 사건 유형이면 안내 카드만 보여준다.
  if (unsupported) {
    return <UnsupportedNotice onBack={onBack} onHome={onHome} />
  }

  const ma = r.missionAnswers

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

        {/* [C-114] 미션 3질문 답변 — 각 질문 3버튼(report.feedback.options)+자유입력, 상태 독립 */}
        <h2 style={styles.sectionHeading}>{ma.heading}</h2>
        {ma.questions.map((q) => (
          <div key={q.key} style={{ marginBottom: '20px' }}>
            <p style={styles.infoTitle}>{q.label}</p>
            <div style={styles.choiceList}>
              {r.feedback.options.map((opt) => (
                <button
                  key={opt}
                  style={{
                    ...styles.choiceButton,
                    ...(answers[q.key].choice === opt
                      ? styles.choiceButtonSelected
                      : {}),
                  }}
                  onClick={() => setChoice(q.key, opt)}
                >
                  {opt}
                </button>
              ))}
            </div>
            <textarea
              style={styles.textInput}
              rows={2}
              placeholder={r.feedback.placeholder}
              value={answers[q.key].note}
              onChange={(e) => setNote(q.key, e.target.value)}
            />
          </div>
        ))}

        {/* [C-116] 반복인정(반복 데이터 있을 때만) — 위로풀과 분리(합치지 않음) */}
        {repeatAckText && (
          <div style={{ ...styles.infoCard, ...styles.comfortCard }}>
            <div style={styles.infoBody}>{repeatAckText}</div>
          </div>
        )}
        {/* [C-116] 부모위로풀 1개 자동 — 버튼·카운터·풀 크기 노출 0 */}
        {reassureText && (
          <div style={{ ...styles.infoCard, ...styles.comfortCard }}>
            <div style={styles.infoBody}>{reassureText}</div>
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
