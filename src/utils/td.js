// URL의 ?td= 값으로 로드할 td 번호를 정한다 (개발/테스트용 오버라이드).
// 값이 없거나 이상하면 1로 폴백. 예: ?screen=result&td=50
export const getTdNumber = () => {
  const n = Number(new URLSearchParams(window.location.search).get('td'))
  return Number.isFinite(n) && n > 0 ? n : 1
}
