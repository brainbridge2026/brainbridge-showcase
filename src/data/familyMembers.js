// 가족 구성원 목록.
// 지금은 예시 데이터이며, 나중에 온보딩에서 실제로 등록한 구성원으로 대체됩니다.
// 화면은 이 목록을 불러와서 그대로 보여주는 방식이라, 여기만 바꾸면 됩니다.
// name: 화면에서 부르는 호칭(예: 아빠), givenName: 실제 이름(예: 정민).
// 리포트 본문 등에서는 givenName("정민님")을, 입력 화면 호명은 name("아빠")을 쓴다.
export const familyMembers = [
  { id: 'ian', name: '이안', relation: '아이' },
  { id: 'dad', name: '아빠', givenName: '정민', relation: '배우자' },
]

// 관계로 구성원 찾기 (예: '아이', '배우자'). 온보딩 데이터가 바뀌어도 여기로만 접근.
export function findByRelation(relation) {
  return familyMembers.find((m) => m.relation === relation)
}
