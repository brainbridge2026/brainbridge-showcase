import { useState } from 'react'
import QuestionStep from '../components/QuestionStep'
import CardChoiceList from '../components/CardChoiceList'
import { texts } from '../texts'

// 상황 (단일 선택). 옵션은 texts.situation.options 배열이 단일 소스.
export default function SituationScreen({ onBack, onNext }) {
  const [scene, setScene] = useState(null)

  return (
    <QuestionStep
      onBack={onBack}
      title={texts.situation.question}
      sub={texts.situation.sub}
      canProceed={scene !== null}
      nextLabel={texts.who.nextButton}
      onNext={() => onNext(scene)}
    >
      <CardChoiceList
        options={texts.situation.options}
        isSelected={(o) => scene === o}
        onSelect={setScene}
      />
    </QuestionStep>
  )
}
