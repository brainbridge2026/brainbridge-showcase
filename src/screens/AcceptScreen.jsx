import { useState } from 'react'
import PhoneFrame from '../components/PhoneFrame'
import { styles } from '../theme'
import { texts } from '../texts'

// [C-105] 뜨거움(hard) 받아주기 화면 — masterplan §611 3기능 실분리(들어주기/멈추기/이어서 보기).
//  제목·본문·질문·선택지·마무리 문구 = Build Pack v2_r1 §2-A 확정본. 호칭 {userName} 동적(하드코딩 0).
//
//  ① 그냥 들어주면 좋겠어요 → 자유입력+제출("적었어요") → §788 마무리 → 홈 (중단 입력 → 홈 재개 생성)
//  ② 여기서 잠깐 멈출게요   → §803 선택권 문구 → 홈 (중단 입력 → 홈 재개 생성)
//  ③ 이어서 조금 더 볼게요  → 사용자 자발 선택으로 C-25 얕은 회고 이동(홈 아님·자동 강제 없음)
//
//  onDefer  : ①submit·②선택 시 App이 이 건을 미완료(홈 재개 카드)로 표시(§793).
//  onContinue: ③ 선택 시 App이 C-25 얕은 회고(shallow)로 라우팅.
export default function AcceptScreen({ userName, onBack, onDefer, onContinue, onHome }) {
  const a = texts.accept
  // phase: 'choose'(선택) → 'listenInput'(① 자유입력) → 'listenDone'(§788) / 'pauseNote'(§803)
  const [phase, setPhase] = useState('choose')
  const [note, setNote] = useState('')

  const handleSelect = (idx) => {
    if (idx === 0) setPhase('listenInput') // ① 들어주기
    else if (idx === 1) {
      // ② 멈추기 — 중단 입력 → 홈 재개 상태 생성
      onDefer()
      setPhase('pauseNote')
    } else {
      // ③ 이어서 보기 — 자발적으로 C-25 얕은 회고로 이동
      onContinue()
    }
  }

  // § 788 마무리 (① 제출 후) / § 803 문구 (② 후) — 공용 마무리 뷰
  if (phase === 'listenDone' || phase === 'pauseNote') {
    const message = phase === 'listenDone' ? a.listenDone : a.pauseNote
    return (
      <PhoneFrame onBack={onBack}>
        <div className="fade-in" style={{ textAlign: 'center' }}>
          <p style={{ ...styles.resultParagraph, marginBottom: 0 }}>{message}</p>
        </div>
        <div style={styles.footer}>
          <button style={styles.primaryButton} onClick={onHome}>
            {a.home}
          </button>
        </div>
      </PhoneFrame>
    )
  }

  // ① 자유입력 — 골라야 열린다.
  if (phase === 'listenInput') {
    return (
      <PhoneFrame onBack={() => setPhase('choose')}>
        <div className="fade-in">
          <h1 style={styles.question}>{a.title}</h1>
          <textarea
            style={{ ...styles.textInput, marginTop: '20px' }}
            rows={4}
            placeholder={a.listenPlaceholder}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <div style={styles.footer}>
          <button
            style={styles.primaryButton}
            onClick={() => {
              onDefer() // 중단 입력 → 홈 재개 상태 생성(§793)
              setPhase('listenDone') // → §788 마무리
            }}
          >
            {a.listenSubmit}
          </button>
        </div>
      </PhoneFrame>
    )
  }

  // 선택 화면 — 제목 · 감정 인정 본문 · 질문 · 선택지 3
  return (
    <PhoneFrame onBack={onBack}>
      <div className="fade-in">
        <h1 style={styles.question}>{a.title}</h1>
        <p style={{ ...styles.subText, marginTop: '14px' }}>{a.body(userName)}</p>
        <h2 style={{ ...styles.subQuestion, marginTop: '28px' }}>
          {a.question(userName)}
        </h2>
        <div style={styles.choiceList}>
          {a.options.map((opt, idx) => (
            <button
              key={opt}
              style={styles.choiceButton}
              onClick={() => handleSelect(idx)}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>
    </PhoneFrame>
  )
}
