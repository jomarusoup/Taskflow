---
Title: task_flow
creation: 2026-07-22
modification: 2026-07-22
status: "in progress"
tags:
 - "project"
 - "webapp"
aliases:
 - "TASKFLOW"
---
MOC:: [[task_flow]]
FROM:: [[empty]]

# TASKFLOW — 업무 관리 시스템

서버·빌드·설치 없이 **`src/index.html` 파일 하나만 열면 실행**되는 단독형(offline-first)
업무 관리 웹앱. 외부 CDN·네트워크 요청이 전혀 없어 폐쇄망(내부망·CSP 환경)에서도 그대로 쓸 수 있다.

전체 기획 정본: [docs/plan/PLAN.md](docs/plan/PLAN.md)

## 실행

```
# 1) 가장 간단 — 파일 더블클릭
src/index.html 을 브라우저(Chrome/Edge 권장)로 연다

# 2) 또는 정적 서버로
cd src && python3 -m http.server 8000   # → http://localhost:8000
```

빌드 단계 없음. 별도 의존성 없음.

## 기능

| 뷰 | 설명 |
| --- | --- |
| **대시보드** | KPI 카드(활성/진행/완료/기한초과) + 월간 캘린더, 일정 표시 |
| **칸반 보드** | 상태별(To Do·In Progress·Done) 드래그 이동 |
| **업무 대장** | 전체 업무 목록·그룹 뷰, 카테고리/태그/우선순위 관리 |
| **인벤토리** | 다중 탭 관리 대장(서버·자산 등) 표 형태 관리 |
| **연락처** | 담당자·부서 연락처, 업무와 연결 |
| **백업** | 전체 데이터 JSON 내보내기/가져오기, 백업 주기 알림 |
| **설정** | 카테고리·태그·상태·우선순위·테마·폰트 커스터마이즈 |

## 데이터 저장

- 모든 데이터는 브라우저 **IndexedDB**(앱 전용 DB `taskflow_store`)에 자동 저장된다.
  앱 전용 네임스페이스라 같은 브라우저의 다른 사이트/앱과 충돌하지 않는다.
- 데이터 구조는 JSON이며, **백업 메뉴에서 `.json` 파일로 내보내기·가져오기**가 가능하다
  → 다른 PC·브라우저로 그대로 이식·백업.
- 이전 버전(localStorage)의 데이터가 있으면 최초 실행 시 자동 이전한다.

## 구조

```
task_flow/
├── src/                # 앱 본체 (단독 실행)
│   ├── index.html      # 엔트리포인트 (이 파일을 연다)
│   ├── css/style.css
│   └── js/
│       ├── store.js    # 저장 계층 (IndexedDB, 자동저장·마이그레이션)
│       ├── core.js     # 전역 상태·데이터 로드·공통 유틸
│       ├── app.js      # 초기화·네비게이션·렌더 오케스트레이션
│       ├── calendar.js kanban.js ledger.js inventory.js contacts.js
│       ├── modal.js data.js ui.js backup.js
├── docs/               # 기획·작업·이슈 (arachne 노트)
│   └── plan/PLAN.md    # 전체 기획 정본
├── taskflow.pen        # UI 디자인 (Pencil)
├── AGENTS.md           # 프로젝트 규약 정본(SSOT)
└── CLAUDE.md           # Claude Code 전용 보충
```

## 기술 스택

- Vanilla JavaScript (프레임워크·번들러 없음), HTML, CSS
- 저장: IndexedDB / 이식: JSON export·import
- 외부 의존성·CDN 없음 (폐쇄망 대응)

## 개발

프로젝트 규약은 [AGENTS.md](AGENTS.md)가 정본이다. 코드 작업은 Claude Code 기준.
UI 디자인은 [taskflow.pen](taskflow.pen)(Pencil)에서 관리한다.
