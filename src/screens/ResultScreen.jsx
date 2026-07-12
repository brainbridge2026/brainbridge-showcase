import { useState, useEffect } from 'react'
import PhoneFrame from '../components/PhoneFrame'
import { styles } from '../theme'
import { texts } from '../texts'
import { findByRelation } from '../data/familyMembers'
import { getTdNumber } from '../utils/td'
import { cleanText, isSupportedFormat } from '../utils/text'
import { matchTdToInput } from '../utils/matchTd'
import tdCategoryMap from '../data/tdCategoryMap.json'
import repeatAck from '../data/repeatAcknowledgment.json'
import UnsupportedNotice from '../components/UnsupportedNotice'

// 기본은 1번. ?td=50 처럼 URL로 다른 사건 번호를 테스트할 수 있다.
const TD_NUMBER = getTdNumber()

// 개인 결과 — 지친 부모를 배려하는 3겹 구조.
// layer1(받아주기) → layer2(핵심 이해) → layer3(깊은 근거), 겹마다 사용자가 선택.
// onBack: 완료 화면으로, onHome: 홈으로, onReport: 통합 리포트로.
export default function ResultScreen({
  userName,
  tdNumber,
  spouseIncluded,
  cases,
  onBack,
  onHome,
  onReport,
}) {
  const childName = findByRelation('아이')?.name ?? '아이'
  const r = texts.result

  // {부모이름} 자리표시자를 실제 사용자 이름으로 치환.
  const fill = (s) => (s ?? '').split('{부모이름}').join(userName)

  // 매칭 결과 등으로 prop이 오면 그 번호를, 없으면 URL ?td= (기본 1)을 쓴다.
  const tdNum = tdNumber ?? TD_NUMBER

  const params = new URLSearchParams(window.location.search)
  // URL의 ?layer= 값으로 시작 겹을 지정할 수 있다 (예: ?screen=result&layer=layer2).
  const [layer, setLayer] = useState(params.get('layer') || 'layer1')

  // 아빠(정민님) 개입 여부. 실서비스에선 "누구와?"에서 배우자 선택 시 true.
  //  개발 확인용으로 ?spouse=1 딥링크로도 강제 표시 가능 (current 없는 스크린샷 대비).
  const spouseOn = spouseIncluded || params.get('spouse') === '1'
  const [finishBack, setFinishBack] = useState('layer1')

  // td_json/td{번호}.json 로드.
  //  1겹(받아주기): sections.A.subsections['A-1. 받아주기'].text → 문단 배열
  //  2겹(핵심 이해): A-2 항목의 tables[0].rows → [{subtitle=블록, body=결과문}]
  //  3겹(깊은 근거): A-3 항목의 tables[0].rows → [{subtitle=항목, body=내용, variant}]
  //  B블록(그때, 아빠는): sections.B.tables[0].rows → [{subtitle=소제목, body=내용}]
  //    (자산 없음/비워둡니다 행은 제외)
  // 표시 직전 [출처: ...]는 항상 제거.
  const [acceptParagraphs, setAcceptParagraphs] = useState([])
  const [understandBlocks, setUnderstandBlocks] = useState([])
  const [deepItems, setDeepItems] = useState([])
  const [spouseBlocks, setSpouseBlocks] = useState([])
  // [DEMO-ONLY] why_pool 랜덤 로테이션, 세션 유지 없음
  // C-신규(왜 로테이션): td1·td11·td22만 존재, 나머지 td는 필드 없으면 토글 자체를 숨김
  const [whyPicks, setWhyPicks] = useState([]) // A-2 블록별 로드 시 랜덤 1개(없으면 null)
  const [openWhy, setOpenWhy] = useState({}) // 블록 index → 펼침 여부
  // [DEMO-ONLY] 반복 횟수는 로컬 cases 배열 기준 카운트, 실서비스는 DB 집계 필요
  // C-14: 반복인정(횟수 구간별) + 위로풀(카테고리 로테이션), 세션 유지 없음
  const [repeatAckText, setRepeatAckText] = useState(null) // 1겹 상단 반복 인정(없으면 null)
  const [reassureText, setReassureText] = useState(null) // 1겹 하단 위로풀 로테이션(없으면 null)
  // 지원하지 않는 사건 유형이면 안전장치 안내를 띄운다.
  //  variant: 'hot'(감정폭발축 포맷 미지원) / 'situation'(상황축 미매칭 → td null).
  const [unsupported, setUnsupported] = useState(false)
  const [unsupportedVariant, setUnsupportedVariant] = useState('hot')

  // C-14 반복 인정: 완료된 cases 중 "이번 td와 같은 td"가 몇 번째인지(이번 건 포함) 세어
  //  2번째→tier2 / 3~4번째→tier3_4 / 5번째 이상→tier5plus 에서 랜덤 1개. 1번째면 생략.
  // C-14 위로풀: tdCategoryMap에서 카테고리를 찾아 reassurePools의 5개 중 랜덤 1개(매핑 없으면 생략).
  //  둘 다 로드 시 1회 랜덤 → 새로고침/재진입마다 다시 랜덤(세션 유지 없음).
  useEffect(() => {
    let alive = true
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]

    // 반복 인정 — 같은 td 완료 건수(이번 건 포함) 기준 구간 판정
    const sameTdCount = (cases ?? [])
      .filter((c) => c?.status === 'complete')
      .filter((c) => matchTdToInput(c).num === tdNum).length
    let ackPool = null
    if (sameTdCount === 2) ackPool = repeatAck.tier2
    else if (sameTdCount === 3 || sameTdCount === 4) ackPool = repeatAck.tier3_4
    else if (sameTdCount >= 5) ackPool = repeatAck.tier5plus
    setRepeatAckText(ackPool && ackPool.length ? fill(pick(ackPool)) : null)

    // 위로풀 — 카테고리 매핑 있는 td만. public/reassurePools.json에서 카테고리별 5개 중 1개.
    const cat = tdCategoryMap[`td${tdNum}`]
    if (!cat) {
      setReassureText(null)
    } else {
      fetch('/reassurePools.json')
        .then((res) => res.json())
        .then((pools) => {
          if (!alive) return
          const arr = pools?.[cat]
          setReassureText(arr && arr.length ? fill(pick(arr)) : null)
        })
        .catch(() => {})
    }
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tdNum])
  useEffect(() => {
    let alive = true
    // 매칭 실패(situationToTd·키워드 모두 미달)로 td가 null이면 임의 폴백 없이 안내(§4).
    if (tdNumber === null) {
      setUnsupportedVariant('situation')
      setUnsupported(true)
      return
    }
    fetch(`/td_json/td${tdNum}.json`)
      .then((res) => res.json())
      .then((data) => {
        if (!alive) return
        if (!isSupportedFormat(data)) {
          setUnsupportedVariant('hot')
          setUnsupported(true)
          return
        }
        const subs = data?.sections?.A?.subsections ?? {}

        // 1겹
        const raw = subs['A-1. 받아주기']?.text ?? ''
        setAcceptParagraphs(
          cleanText(raw)
            .split(/\n{2,}/)
            .map((p) => p.trim())
            .filter(Boolean),
        )

        // 2겹 — 이름에 "A-2"가 들어간 항목을 찾아 표 4줄을 카드로
        const a2Key = Object.keys(subs).find((k) => k.includes('A-2'))
        const rows2 = a2Key ? subs[a2Key]?.tables?.[0]?.rows ?? [] : []
        setUnderstandBlocks(
          rows2.map((row) => ({
            // 카드 제목도 본문처럼 cleanText 적용(편집 꼬리표 "*(수정됨)*" 등 제거). 데이터는 그대로.
            subtitle: cleanText(row['블록']),
            body: cleanText(row['결과문']),
          })),
        )

        // [DEMO-ONLY] why_pool 랜덤 로테이션, 세션 유지 없음
        //  A-2 각 블록(i)과 data.why_pool[i]가 1:1. 로드 시 블록별로 3개 중 하나를 랜덤 선택.
        //  why_pool 없는 td는 whyPicks가 전부 null → 토글 자체가 렌더 안 됨(자산 없음 → 화면 생략).
        const wp = Array.isArray(data?.why_pool) ? data.why_pool : null
        setWhyPicks(
          rows2.map((_, i) => {
            const group = Array.isArray(wp?.[i]) ? wp[i] : null
            return group && group.length
              ? cleanText(group[Math.floor(Math.random() * group.length)])
              : null
          }),
        )
        setOpenWhy({}) // 새 td 로드 시 펼침 상태 초기화

        // 3겹 — 이름에 "A-3"이 들어간 항목. 항목 값으로 카드 종류 분기.
        //  추천 표현 / 함께 쓸 표현 → teal(💬), 피할 표현 / 피할 말 → coral(⚠️)
        const a3Key = Object.keys(subs).find((k) => k.includes('A-3'))
        const rows3 = a3Key ? subs[a3Key]?.tables?.[0]?.rows ?? [] : []
        setDeepItems(
          rows3.map((row) => {
            const title = row['항목'] ?? ''
            // variant 판별은 원문(title) 기준 유지. 표시용 제목만 cleanText 적용.
            let variant = 'default'
            if (title.includes('추천 표현') || title.includes('함께 쓸 표현')) {
              variant = 'teal'
            } else if (title.includes('피할 표현') || title.includes('피할 말')) {
              variant = 'coral'
            }
            return { subtitle: cleanText(title), body: cleanText(row['내용']), variant }
          }),
        )

        // B — 아빠(정민님) 조건부 블록. tables[0].rows 중 자산 있는 행만 카드로.
        //  자산 없음: 출처가 "자산 없음"이거나 내용이 "…비워둡니다"인 행 → 카드 생략
        const rowsB = data?.sections?.B?.tables?.[0]?.rows ?? []
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

  // 값이 함수면 이름을 넣어 문자열로 만든다.
  const t = (v) => (typeof v === 'function' ? v(userName, childName) : v)

  const goFinish = (from) => {
    setFinishBack(from)
    setLayer('finish')
  }

  // 조건부: 아빠(정민님)가 개입한 경우에만 보이는 블록 (데모에선 항상 표시 + 주석).
  //  카드 내용은 td_json sections.B 에서 로드 (spouseBlocks). 자산 있는 행이 없으면
  //  블록 자체를 렌더하지 않는다.
  const renderSpouseBlock = () => {
    if (!spouseOn || !spouseBlocks.length) return null
    const s = r.spouse
    return (
      <div style={{ marginTop: '28px' }}>
        <p style={styles.resultNote}>{s.demoNote}</p>
        <h2 style={styles.spouseTitle}>{s.title}</h2>
        {spouseBlocks.map((b, i) => (
          <div key={i} style={styles.spouseSectionCard}>
            <div style={styles.spouseSubtitle}>{b.subtitle}</div>
            <div style={styles.spouseBody}>{b.body}</div>
          </div>
        ))}
      </div>
    )
  }

  // 안전장치 — 지원하지 않는 사건 유형이면 안내 카드만 보여준다.
  //  hot(포맷 미지원) / situation(상황축 미매칭)에 따라 문구 분기.
  if (unsupported) {
    return (
      <UnsupportedNotice
        onBack={onBack}
        onHome={onHome}
        variant={unsupportedVariant}
      />
    )
  }

  // 【1겹】 받아주기
  if (layer === 'layer1') {
    return (
      <PhoneFrame onBack={onBack} align="top">
        <div className="fade-in" key="layer1">
          {/* C-14 반복 인정 — 같은 td 반복 시 횟수 구간별 문구(1번째면 생략) */}
          {repeatAckText ? (
            <div style={{ ...styles.repeatSlot, ...styles.infoCard, ...styles.comfortCard }}>
              <div style={styles.infoBody}>{repeatAckText}</div>
            </div>
          ) : (
            <div style={styles.repeatSlot} />
          )}
          {/* A-1. 받아주기 — td_json에서 로드(고정 본문), [출처:...] 제거, 문단별로 표시 */}
          {acceptParagraphs.map((para, i) => (
            <p key={i} style={styles.resultParagraph}>
              {para}
            </p>
          ))}
          {/* C-14 위로풀 — tdCategoryMap의 카테고리별 5개 중 랜덤 1개(매핑 없으면 생략) */}
          {reassureText && (
            <div style={{ ...styles.infoCard, ...styles.comfortCard }}>
              <div style={styles.infoBody}>{reassureText}</div>
            </div>
          )}
          <div style={styles.choiceList}>
            <button style={styles.primaryButton} onClick={() => setLayer('layer2')}>
              {r.layer1.more}
            </button>
            <button style={styles.choiceButton} onClick={() => goFinish('layer1')}>
              {r.layer1.rest}
            </button>
          </div>
        </div>
      </PhoneFrame>
    )
  }

  // 짧은 마무리
  if (layer === 'finish') {
    return (
      <PhoneFrame onBack={() => setLayer(finishBack)}>
        <div className="fade-in" key="finish" style={{ textAlign: 'center' }}>
          <p style={{ ...styles.resultParagraph, marginBottom: 0 }}>
            {t(r.finish.body)}
          </p>
        </div>
        <div style={styles.footer}>
          <button style={styles.primaryButton} onClick={onHome}>
            {r.finish.home}
          </button>
        </div>
      </PhoneFrame>
    )
  }

  // 【2겹】 핵심 이해
  if (layer === 'layer2') {
    return (
      <PhoneFrame onBack={() => setLayer('layer1')} align="top">
        <div className="fade-in" key="layer2">
          {/* A-2 핵심 이해 — 소제목(블록) + 내용(결과문) 두 줄 카드 */}
          {understandBlocks.map((b, i) => {
            // [DEMO-ONLY] why_pool 랜덤 로테이션, 세션 유지 없음
            // C-신규(왜 로테이션): td1·td11·td22만 존재, 나머지 td는 필드 없으면 토글 자체를 숨김
            const why = whyPicks[i]
            const open = !!openWhy[i]
            return (
              <div key={i} style={styles.infoCard}>
                <div style={styles.infoTitle}>{b.subtitle}</div>
                <div style={styles.infoBody}>{b.body}</div>
                {/* why_pool 자산 있는 블록에만 '왜 그런지 더 볼게요' 토글 노출 */}
                {why && (
                  <>
                    <button
                      style={styles.expandButton}
                      onClick={() =>
                        setOpenWhy((prev) => ({ ...prev, [i]: !prev[i] }))
                      }
                    >
                      {open
                        ? `${r.layer2.collapseLabel} ▲`
                        : `${r.layer2.expandLabel} ▼`}
                    </button>
                    {open && <div style={styles.expandBody}>{why}</div>}
                  </>
                )}
              </div>
            )
          })}

          {/* 조건부: 아빠(정민님) 개입 블록 — 2겹 하단 */}
          {renderSpouseBlock()}

          <div style={{ ...styles.choiceList, marginTop: '28px' }}>
            <button style={styles.primaryButton} onClick={() => setLayer('layer3')}>
              {r.layer2.more}
            </button>
            <button style={styles.choiceButton} onClick={() => goFinish('layer2')}>
              {r.layer2.enough}
            </button>
          </div>
        </div>
      </PhoneFrame>
    )
  }

  // 【3겹】 깊은 근거
  return (
    <PhoneFrame onBack={() => setLayer('layer2')} align="top">
      <div className="fade-in" key="layer3">
        {/* A-3 깊은 근거 — 항목값으로 카드 종류 분기 (💬 teal / ⚠️ coral / 일반) */}
        {deepItems.map((item, i) => {
          const icon =
            item.variant === 'teal' ? '💬 ' : item.variant === 'coral' ? '⚠️ ' : ''
          return (
            <div
              key={i}
              style={{
                ...styles.infoCard,
                ...(item.variant === 'teal' ? styles.infoCardTeal : {}),
                ...(item.variant === 'coral' ? styles.infoCardCoral : {}),
              }}
            >
              <div style={styles.infoTitle}>
                {icon}
                {item.subtitle}
              </div>
              <div style={styles.infoBody}>{item.body}</div>
            </div>
          )
        })}
        <div style={{ ...styles.choiceList, marginTop: '20px' }}>
          <button style={styles.primaryButton} onClick={onHome}>
            {r.layer3.home}
          </button>
          <button style={styles.choiceButton} onClick={onReport}>
            {r.layer3.report}
          </button>
        </div>
      </div>
    </PhoneFrame>
  )
}
