import { useState } from 'react'
import PhoneFrame from '../components/PhoneFrame'
import { styles } from '../theme'
import { texts } from '../texts'
import { familyMembers, findByRelation } from '../data/familyMembers'

// [C-93] 이 사건의 "상대"를 고르는 단일 선택 화면.
//  - 라디오 방식: 누르면 배열을 통째로 교체해 항상 길이 1. 선택 해제 없음(다른 걸 누르면 자동 교체).
//  - selectedIds를 '배열'로 유지하는 이유 = 호출부 계약: App.handleWhoNext가 whoSelectedIds(배열)를 기대.
//  - 배우자 재석 여부(spouseIncluded)는 여기서 계산하지 않는다 — ConflictScreen 재석 질문으로 이관(C-93).
//  - 배우자 단독 선택은 콘텐츠 미지원(부부 2자 td 미집필) → 안내만 하고 다음으로 진입시키지 않음.
export default function WhoScreen({ userName, onBack, onNext }) {
  const [selectedIds, setSelectedIds] = useState([])

  // 단일 지정: 배열을 통째로 교체(항상 길이 1). 선택 해제 없음(라디오).
  const select = (id) => setSelectedIds([id])

  const hasSelection = selectedIds.length > 0

  // 배우자 단독 선택 감지 — 콘텐츠 미지원 안내 대상.
  //  ★ unsupported.situation*(매칭 실패, 콘텐츠는 있음)와 다름: 여긴 애초에 콘텐츠가 없음(부부 2자 td 미집필).
  const selectedMember = familyMembers.find((m) => m.id === selectedIds[0])
  const isSpouseOnly = selectedMember?.relation === '배우자'
  const canProceed = hasSelection && !isSpouseOnly

  // spouseOnlyNotice 본문 치환값 — report/result와 동일 패턴: child는 familiar 적용, spouse는 givenName 호명.
  const notice = texts.who.spouseOnlyNotice
  const childName = findByRelation('아이')?.name ?? '아이'
  const spouseMember = findByRelation('배우자')
  const spouseName = spouseMember?.givenName ?? spouseMember?.name ?? '배우자'

  return (
    <PhoneFrame onBack={onBack}>
      <div>
        {/* [C-93] sub 제거(확정본): 단일 전환으로 안내 줄 존재 이유 소멸. title만으로 완결, 라디오가 곧 안내. */}
        <h1 style={styles.question}>{texts.who.title}</h1>

        <div style={styles.choiceList}>
          {familyMembers.map((member) => {
            const selected = selectedIds.includes(member.id)
            return (
              <button
                key={member.id}
                style={{
                  ...styles.choiceButton,
                  ...(selected ? styles.choiceButtonSelected : {}),
                }}
                onClick={() => select(member.id)}
              >
                <span style={styles.memberRow}>
                  <span style={styles.memberName}>{member.name}</span>
                  <span style={styles.relationChip}>{member.relation}</span>
                </span>
              </button>
            )
          })}
        </div>

        {/* 배우자 단독 선택 안내 — 콘텐츠 미지원(부부 2자 td 미집필). 다음 진입 차단. */}
        {/*  ★ unsupported.situation*(매칭 실패, C-92)과 다른 새 키(재사용 금지). */}
        {isSpouseOnly && (
          <div style={styles.suggestionCard}>
            <p style={styles.suggestionTitle}>{notice.title}</p>
            <p style={{ ...styles.suggestionBody, marginTop: '8px' }}>
              {notice.body(userName, spouseName, childName)}
            </p>
          </div>
        )}
      </div>

      <div style={styles.footer}>
        <button
          style={{
            ...styles.primaryButton,
            ...(canProceed ? {} : styles.primaryButtonDisabled),
          }}
          onClick={() => canProceed && onNext(selectedIds)}
          disabled={!canProceed}
        >
          {texts.who.nextButton}
        </button>
      </div>
    </PhoneFrame>
  )
}
