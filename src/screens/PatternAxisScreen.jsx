import { useState } from 'react'
import QuestionStep from '../components/QuestionStep'
import CardChoiceList from '../components/CardChoiceList'
import { texts } from '../texts'
import childTypeToAxis from '../data/childTypeToAxis.json'
import axisPool from '../data/axisPool.json'

// ★ 패턴 단서(2차 질문) 화면 — C-85 / 빌드지시서 7편. C-10: patternAxis 2신호.
//  배치: ② 아이 행동 → [이 화면] → ③ 부모 행동.
//  App이 "축 후보 2개 이상"일 때만 이 화면으로 보낸다(1개면 자동세팅·생략 — App.jsx §5-2).
//  childType이 유도한 축 후보(childTypeToAxis)만 label로 보여주고, 고른 축 키를 onNext로 넘긴다.
//  [C-85 §4 판단·인계] 부연(sub)은 CardChoiceList가 문자열만 렌더하므로 이번엔 label만 표시(부연 후속 판단).
//   ExpandableChoiceList는 빈 expand에도 '더 자세히' 버튼이 떠 공유 컴포넌트 수정이 필요하므로 미사용(대표 지시).
export default function PatternAxisScreen({ childType, onBack, onNext }) {
  const c = texts.patternAxis
  const axes = childTypeToAxis[childType] ?? []

  // label 문자열로 선택받아 축 키로 되돌리기 위한 매핑 (6개 label 전부 상호구분되어 유일).
  const labelToAxis = {}
  const options = axes.map((ax) => {
    const label = axisPool[ax]?.label ?? ax
    labelToAxis[label] = ax
    return label
  })

  const [selected, setSelected] = useState(null) // 선택된 label | null

  return (
    <QuestionStep
      onBack={onBack}
      title={c.question}
      sub={c.sub}
      canProceed={selected !== null}
      onNext={() => onNext({ patternAxis: labelToAxis[selected] })}
    >
      <CardChoiceList
        options={options}
        isSelected={(o) => selected === o}
        onSelect={setSelected}
      />
    </QuestionStep>
  )
}
