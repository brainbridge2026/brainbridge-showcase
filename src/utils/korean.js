// 한국어 조사 헬퍼.
// 이름 뒤에 붙는 주제 조사(은/는)를 받침 유무에 따라 골라준다.
// 예: "아빠" → "아빠는", "이안" → "이안은"
export function withTopicParticle(word) {
  if (!word) return word
  const last = word[word.length - 1]
  const code = last.charCodeAt(0)
  // 한글 음절 영역이 아니면 기본값 '는'
  if (code < 0xac00 || code > 0xd7a3) return `${word}는`
  const hasBatchim = (code - 0xac00) % 28 !== 0
  return `${word}${hasBatchim ? '은' : '는'}`
}

// 받침 있는 이름을 부를 때 붙이는 '이'를 처리한다. (구어체 친근형)
// 예: "이안" → "이안이"(뒤에 는/에게/만 등을 붙이면 "이안이는"), "민수" → "민수"
export function familiar(name) {
  if (!name) return name
  const last = name[name.length - 1]
  const code = last.charCodeAt(0)
  if (code < 0xac00 || code > 0xd7a3) return name
  const hasBatchim = (code - 0xac00) % 28 !== 0
  return hasBatchim ? `${name}이` : name
}
