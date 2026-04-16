# 프로젝트 구조

```
frontend/
├── src/
│   ├── index.html        # 메인 HTML
│   ├── main.js           # JS 진입점
│   ├── js/               # 기존 v1 로직 (모듈화)
│   │   ├── core.js       # 전역 상태, 스토리지
│   │   ├── ui.js         # 공통 UI, 테마
│   │   ├── data.js       # 업무 CRUD
│   │   ├── calendar.js   # 캘린더, 대시보드
│   │   ├── kanban.js     # 칸반 보드
│   │   ├── ledger.js     # 업무 대장
│   │   ├── inventory.js  # 인벤토리
│   │   ├── contacts.js   # 연락처
│   │   ├── modal.js      # 모달
│   │   └── app.js        # 초기화·네비게이션
│   ├── css/
│   │   └── style.css     # 전체 스타일
│   └── api/              # v2 신규 — 백엔드 통신
│       ├── client.js     # fetch 기반 공통 클라이언트
│       └── auth.js       # 로그인·로그아웃·토큰 관리
├── public/               # 정적 자산 (이미지, 파비콘)
├── dist/                 # 빌드 결과물 (git 제외)
├── package.json
└── vite.config.js
```
