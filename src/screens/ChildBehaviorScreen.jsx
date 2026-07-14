import { useState } from 'react'
import QuestionStep from '../components/QuestionStep'
import ExpandableChoiceList from '../components/ExpandableChoiceList'
import { texts } from '../texts'
import { findByRelation } from '../data/familyMembers'
import behaviorPool from '../data/behaviorPool.json'

// [DEMO/실서비스 공통] ②③ 선택은 데모·실서비스 모두 필요
// ② 아이 행동 관찰 선택 — 상황축(scene) 선택 다음 단계.
//  데이터 출처: src/data/behaviorPool.json 의 [scene].child (유형 4개, 각 rep 1 + expand 2).
//  scene 은 texts.situation.options 문자열 그대로(부모가 onNext(scene)로 넘긴 값).
//  선택 결과: { childType: 유형키, childText: 고른 문장 } — 전체 통틀어 단일 선택.
export default function ChildBehaviorScreen({ scene, onBack, onNext }) {
  const childName = findByRelation('아이')?.name ?? '아이'
  // 개발/딥링크 확인용: prop scene 이 없으면 URL ?scene= 로 대체(스크린샷용).
  const activeScene =
    scene ?? new URLSearchParams(window.location.search).get('scene')
  const items = behaviorPool[activeScene]?.child ?? []
  const c = texts.childBehavior

  const [selected, setSelected] = useState(null) // { typeKey, text } | null

  return (
    <QuestionStep
      onBack={onBack}
      title={c.question(childName)}
      sub={c.sub}
      canProceed={selected !== null}
      onNext={() =>
        onNext({ childType: selected.typeKey, childText: selected.text })
      }
    >
      <ExpandableChoiceList
        items={items}
        selected={selected}
        onSelect={(typeKey, text) => setSelected({ typeKey, text })}
        moreLabel={c.more}
      />
    </QuestionStep>
  )
}
