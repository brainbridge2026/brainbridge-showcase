import { useState } from 'react'
import QuestionStep from '../components/QuestionStep'
import ExpandableChoiceList from '../components/ExpandableChoiceList'
import { texts } from '../texts'
import behaviorPool from '../data/behaviorPool.json'

// [DEMO/실서비스 공통] ②③ 선택은 데모·실서비스 모두 필요
// ③ 부모 행동 관찰 선택 — 아이 행동(②) 선택 다음 단계.
//  데이터 출처: src/data/behaviorPool.json 의 [scene].parent (유형 4개, 각 rep 1 + expand 2).
//  ★ 관찰 톤: 부모 행동도 잘잘못이 아니라 "무슨 일이 있었는지" 관찰(자책 유도 아님).
//  선택 결과: { parentType: 유형키, parentText: 고른 문장 } — 전체 통틀어 단일 선택.
export default function ParentBehaviorScreen({ scene, onBack, onNext }) {
  // 개발/딥링크 확인용: prop scene 이 없으면 URL ?scene= 로 대체(스크린샷용).
  const activeScene =
    scene ?? new URLSearchParams(window.location.search).get('scene')
  const items = behaviorPool[activeScene]?.parent ?? []
  const p = texts.parentBehavior

  const [selected, setSelected] = useState(null) // { typeKey, text } | null

  return (
    <QuestionStep
      onBack={onBack}
      title={p.question}
      sub={p.sub}
      canProceed={selected !== null}
      onNext={() =>
        onNext({ parentType: selected.typeKey, parentText: selected.text })
      }
    >
      <ExpandableChoiceList
        items={items}
        selected={selected}
        onSelect={(typeKey, text) => setSelected({ typeKey, text })}
        moreLabel={p.more}
      />
    </QuestionStep>
  )
}
