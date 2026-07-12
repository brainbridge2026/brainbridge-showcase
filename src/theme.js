// 앱 전체에서 공유하는 색상/스타일 토큰
export const COLORS = {
  primary: '#5B4FE0', // 메인 보라색
  bg: '#ECEAFB', // 연보라 배경
  text: '#1E1B3A', // 진한 본문 텍스트
  subText: '#6B6790', // 부드러운 보조 텍스트
  white: '#FFFFFF',
}

export const styles = {
  // 화면 전체: 가운데 정렬
  page: {
    minHeight: '100vh',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'stretch',
    backgroundColor: COLORS.bg,
  },
  // 모바일 폰 크기 (가로 390px)
  phone: {
    width: '390px',
    maxWidth: '100%',
    minHeight: '100vh',
    backgroundColor: COLORS.bg,
    display: 'flex',
    flexDirection: 'column',
    padding: '20px 24px 32px',
    position: 'relative',
  },
  // 상단 뒤로 버튼 줄
  topBar: {
    height: '40px',
    display: 'flex',
    alignItems: 'center',
  },
  backButton: {
    background: 'none',
    border: 'none',
    color: COLORS.subText,
    fontSize: '16px',
    cursor: 'pointer',
    padding: '4px 4px 4px 0',
  },
  // 본문 영역: 위쪽 콘텐츠 + 아래쪽 버튼을 분리
  body: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: '14px',
  },
  greeting: {
    fontSize: '24px',
    fontWeight: 700,
    color: COLORS.text,
    lineHeight: 1.4,
  },
  question: {
    fontSize: '22px',
    fontWeight: 700,
    color: COLORS.text,
    lineHeight: 1.45,
  },
  subText: {
    fontSize: '16px',
    fontWeight: 400,
    color: COLORS.subText,
    lineHeight: 1.5,
  },
  // 세로로 쌓는 선택 버튼 목록
  choiceList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginTop: '12px',
  },
  // 연한 배경의 선택 버튼(탭)
  choiceButton: {
    width: '100%',
    padding: '18px 20px',
    fontSize: '17px',
    fontWeight: 600,
    color: COLORS.text,
    backgroundColor: COLORS.white,
    border: '1.5px solid #DBD7F5',
    borderRadius: '16px',
    cursor: 'pointer',
    textAlign: 'left',
  },
  // 선택된 상태(다중 선택)일 때 강조
  choiceButtonSelected: {
    backgroundColor: '#EDEBFC', // 연보라 강조 배경
    border: `2px solid ${COLORS.primary}`,
    color: COLORS.primary,
  },
  // 상황 선택 화면 — td 번호 배지 (버튼 안 작은 라벨)
  pickerNum: {
    display: 'inline-block',
    fontSize: '12px',
    fontWeight: 700,
    color: COLORS.primary,
    marginRight: '8px',
  },
  // 상황 선택 화면 — 항목 버튼(긴 제목용, 폰트 약간 작게)
  pickerItemButton: {
    width: '100%',
    padding: '15px 18px',
    fontSize: '15px',
    fontWeight: 600,
    lineHeight: 1.5,
    color: COLORS.text,
    backgroundColor: COLORS.white,
    border: '1.5px solid #DBD7F5',
    borderRadius: '14px',
    cursor: 'pointer',
    textAlign: 'left',
  },
  // 비활성(선택 전) 주요 버튼
  primaryButtonDisabled: {
    backgroundColor: '#C3BEF0',
    boxShadow: 'none',
    cursor: 'not-allowed',
  },
  // 구성원 카드: 이름은 크게
  memberName: {
    fontSize: '18px',
    fontWeight: 700,
  },
  // 관계 태그(칩) — 살짝 다른 톤의 둥근 배경
  relationChip: {
    display: 'inline-block',
    fontSize: '13px',
    fontWeight: 600,
    color: COLORS.primary,
    backgroundColor: '#E4E1FA',
    borderRadius: '999px',
    padding: '3px 11px',
  },
  // 카드 내부 가로 배치(이름 + 칩)
  memberRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },

  // 감정 등: 칩(태그) 여러 개를 줄바꿈으로 배치
  chipGroup: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
    marginTop: '12px',
  },
  chip: {
    fontSize: '15px',
    fontWeight: 600,
    color: COLORS.text,
    backgroundColor: COLORS.white,
    border: '1.5px solid #DBD7F5',
    borderRadius: '999px',
    padding: '10px 16px',
    cursor: 'pointer',
  },
  chipSelected: {
    backgroundColor: '#EDEBFC',
    border: `2px solid ${COLORS.primary}`,
    color: COLORS.primary,
  },

  // 한 화면 안의 두 번째(보조) 질문 제목 (예: 감정 강도)
  subQuestion: {
    fontSize: '18px',
    fontWeight: 700,
    color: COLORS.text,
    marginTop: '28px',
  },

  // 본문 중 특정 단어 하이라이트(앰버) + 클릭 가능한 주석
  highlight: {
    color: '#B45309',
    backgroundColor: '#FDE9C8',
    borderRadius: '4px',
    padding: '0 3px',
    textDecoration: 'underline',
    textUnderlineOffset: '2px',
    cursor: 'help',
  },
  // 하이라이트 주석 툴팁 박스
  tooltipBox: {
    marginTop: '14px',
    backgroundColor: '#FEF3C7',
    border: '1px solid #FADF98',
    borderRadius: '12px',
    padding: '14px 16px',
    fontSize: '14px',
    color: '#7C5710',
    lineHeight: 1.6,
  },

  // 홈 "이어하기" 카드
  resumeLabel: {
    fontSize: '13px',
    fontWeight: 700,
    color: '#9A97AE',
    marginBottom: '8px',
  },
  resumeCard: {
    width: '100%',
    textAlign: 'left',
    padding: '16px 18px',
    backgroundColor: '#FFFFFF',
    border: `2px solid ${COLORS.primary}`,
    borderRadius: '16px',
    cursor: 'pointer',
    marginBottom: '10px',
  },
  resumeCardTitle: {
    fontSize: '16px',
    fontWeight: 700,
    color: COLORS.primary,
  },
  resumeCardSub: {
    fontSize: '14px',
    color: COLORS.subText,
    marginTop: '4px',
  },

  // 순서대로 고르는 화면에서 선택 순번을 보여주는 동그란 배지
  orderBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '24px',
    height: '24px',
    borderRadius: '999px',
    backgroundColor: COLORS.primary,
    color: COLORS.white,
    fontSize: '13px',
    fontWeight: 700,
    padding: '0 6px',
    flexShrink: 0,
  },
  // 하단 고정 느낌의 주요 실행 버튼(보라색)
  primaryButton: {
    width: '100%',
    padding: '18px 24px',
    fontSize: '17px',
    fontWeight: 600,
    color: COLORS.white,
    backgroundColor: COLORS.primary,
    border: 'none',
    borderRadius: '16px',
    cursor: 'pointer',
    boxShadow: '0 6px 16px rgba(91, 79, 224, 0.3)',
  },
  // 본문 아래에 버튼을 배치할 때 쓰는 하단 영역
  footer: {
    marginTop: '24px',
  },
  // 보조(텍스트) 버튼 — 예: "넘어가기"
  textButton: {
    width: '100%',
    marginTop: '12px',
    padding: '14px',
    fontSize: '16px',
    fontWeight: 600,
    color: '#6B6790',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
  },

  // 예방 제안 카드 — 연한 크림/민트 톤으로 본문과 부드럽게 구분한다.
  suggestionCard: {
    marginTop: '20px',
    backgroundColor: '#EAF7F1', // 연한 민트
    border: '1.5px solid #CDE9DD',
    borderRadius: '18px',
    padding: '20px',
  },
  suggestionTitle: {
    fontSize: '16px',
    fontWeight: 700,
    color: '#2E7D5B', // 진한 민트 계열
    lineHeight: 1.4,
  },
  suggestionBody: {
    fontSize: '15px',
    fontWeight: 400,
    color: COLORS.text,
    lineHeight: 1.6,
    marginTop: '10px',
  },
  suggestionNote: {
    fontSize: '12px',
    fontWeight: 400,
    color: '#9A97AE', // 작은 회색 안내
    lineHeight: 1.5,
    marginTop: '14px',
  },

  // === 개인 결과 화면 ===
  // 1겹: 위로 문단 — 넉넉한 줄간격/여백
  resultParagraph: {
    fontSize: '16px',
    lineHeight: 1.85,
    color: COLORS.text,
    marginBottom: '22px',
  },
  resultNote: {
    fontSize: '12px',
    color: '#9A97AE',
    lineHeight: 1.6,
    marginTop: '-12px',
    marginBottom: '22px',
  },
  // 반복 인정 문구가 들어갈 빈 자리 (지금은 내용 없이 자리만)
  repeatSlot: {
    marginBottom: '8px',
  },
  // 2·3겹: 정보 카드
  infoCard: {
    backgroundColor: '#FFFFFF',
    border: '1.5px solid #E5E2F5',
    borderRadius: '16px',
    padding: '18px 20px',
    marginBottom: '14px',
  },
  infoCardTeal: {
    backgroundColor: '#E6F6F4',
    border: '1.5px solid #BFE6DF',
  },
  infoCardCoral: {
    backgroundColor: '#FEECE8',
    border: '1.5px solid #F6CBBE',
  },
  // 안 했을 때 위로 카드 — 부드러운 보라 톤 + 한 장씩 넘김
  comfortCard: {
    backgroundColor: '#F3F1FC',
    border: '1.5px solid #DBD7F5',
    marginTop: '4px',
  },
  comfortNext: {
    marginTop: '14px',
    padding: '10px 16px',
    fontSize: '14px',
    fontWeight: 600,
    color: COLORS.primary,
    backgroundColor: COLORS.white,
    border: '1.5px solid #CFC9F0',
    borderRadius: '12px',
    cursor: 'pointer',
  },
  infoTitle: {
    fontSize: '16px',
    fontWeight: 700,
    color: COLORS.text,
    marginBottom: '8px',
  },
  infoBody: {
    fontSize: '15px',
    lineHeight: 1.7,
    color: COLORS.text,
    whiteSpace: 'pre-line',
  },
  // 임상 용어 하이라이트(앰버, 클릭 없음)
  termHighlight: {
    color: '#B45309',
    backgroundColor: '#FDE9C8',
    borderRadius: '4px',
    padding: '0 3px',
  },

  // === 통합 리포트 (부모 전용) ===
  reportTitle: {
    fontSize: '20px',
    fontWeight: 700,
    color: COLORS.text,
    lineHeight: 1.45,
    marginBottom: '4px',
  },
  sectionHeading: {
    fontSize: '18px',
    fontWeight: 700,
    color: COLORS.text,
    marginTop: '30px',
    marginBottom: '12px',
  },
  reportBody: {
    fontSize: '15px',
    lineHeight: 1.75,
    color: COLORS.text,
    whiteSpace: 'pre-line',
  },
  reportNote: {
    fontSize: '12px',
    color: '#9A97AE',
    lineHeight: 1.6,
    marginTop: '10px',
  },
  // [2] 관점 카드 — 부모(보라)/이안이(청록)로 구분
  perspCard: {
    borderRadius: '16px',
    padding: '16px 18px',
    marginBottom: '12px',
  },
  perspParent: {
    backgroundColor: '#EDEBFC',
    border: '1.5px solid #C9C2F3',
  },
  perspChild: {
    backgroundColor: '#E6F3F6',
    border: '1.5px solid #BCDDE6',
  },
  perspParentTitle: {
    fontSize: '15px',
    fontWeight: 700,
    color: COLORS.primary,
    marginBottom: '8px',
  },
  perspChildTitle: {
    fontSize: '15px',
    fontWeight: 700,
    color: '#2A7A8C',
    marginBottom: '8px',
  },
  // [5] 코칭 카드 안의 줄/제목
  coachCardTitle: {
    fontSize: '15px',
    fontWeight: 700,
    color: COLORS.text,
    marginBottom: '10px',
  },
  coachLine: {
    fontSize: '15px',
    lineHeight: 1.7,
    color: COLORS.text,
  },
  // 항목+설명을 한 세트로 묶는 간격
  coachItem: {
    marginBottom: '14px',
  },
  // "왜" 설명 — 본문보다 작고 연한 회색
  coachWhy: {
    fontSize: '12.5px',
    lineHeight: 1.55,
    color: '#8E8AA3',
    marginTop: '4px',
  },
  // [6] 양육자 케어 — 따뜻한 배경
  careCard: {
    backgroundColor: '#FFF3E6',
    border: '1.5px solid #F3D9B8',
    borderRadius: '18px',
    padding: '20px',
    marginTop: '30px',
  },
  careHeading: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#B4651E',
    marginBottom: '12px',
  },
  // [6] 관점 토글(탭) — 현정님이 볼 때 / 정민님이 볼 때
  careToggle: {
    display: 'flex',
    gap: '8px',
    marginTop: '10px',
    marginBottom: '14px',
  },
  careTab: {
    flex: 1,
    padding: '10px 12px',
    fontSize: '14px',
    fontWeight: 600,
    color: '#8A7A66',
    backgroundColor: '#FBF1E4',
    border: '1.5px solid #F0DCC2',
    borderRadius: '999px',
    cursor: 'pointer',
  },
  careTabActive: {
    color: '#FFFFFF',
    backgroundColor: '#C77A2E',
    border: '1.5px solid #C77A2E',
  },
  careBody: {
    fontSize: '15px',
    lineHeight: 1.8,
    color: '#4A3B2A',
  },
  // === 개인 결과: 아빠(정민님) 조건부 블록 — 파란 계열 ===
  spouseTitle: {
    fontSize: '19px',
    fontWeight: 700,
    color: '#2563C9',
    marginTop: '10px',
    marginBottom: '14px',
  },
  spouseSectionCard: {
    backgroundColor: '#EEF4FD',
    border: '1.5px solid #C7D9F5',
    borderRadius: '16px',
    padding: '16px 18px',
    marginBottom: '12px',
  },
  spouseSubtitle: {
    fontSize: '15px',
    fontWeight: 700,
    color: '#2A5BA4',
    marginBottom: '8px',
  },
  spouseBody: {
    fontSize: '15px',
    lineHeight: 1.75,
    color: COLORS.text,
  },
  expandButton: {
    background: 'none',
    border: 'none',
    color: '#2A5BA4',
    fontWeight: 600,
    fontSize: '14px',
    cursor: 'pointer',
    padding: '10px 0 0',
    textAlign: 'left',
  },
  expandBody: {
    fontSize: '14px',
    lineHeight: 1.7,
    color: '#3A4A63',
    marginTop: '10px',
    backgroundColor: '#FFFFFF',
    borderRadius: '10px',
    padding: '12px 14px',
  },

  // 피드백 자유 입력란
  textInput: {
    width: '100%',
    marginTop: '12px',
    padding: '14px',
    fontSize: '15px',
    color: COLORS.text,
    border: '1.5px solid #DBD7F5',
    borderRadius: '12px',
    fontFamily: 'inherit',
    resize: 'vertical',
    boxSizing: 'border-box',
  },
}
