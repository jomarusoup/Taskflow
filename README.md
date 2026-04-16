# 🌊 TASKFLOW — 업무관리 시스템

> **v2 개발 진행 중** — Go 백엔드 + PostgreSQL + 멀티유저 + GLPI 수준 인벤토리
>
> v1(브라우저 단독 오프라인 버전)은 [`v1-browser`](../../tree/v1-browser) 브랜치에서 유지됩니다.

---

## 🎯 1. 프로젝트 목표

| 버전 | 설명 | 브랜치 |
| :--- | :--- | :--- |
| **v1** | 브라우저 단독 실행, localStorage, 오프라인 완전 지원 | [`v1-browser`](../../tree/v1-browser) |
| **v2** | Go 백엔드 + PostgreSQL, 멀티유저 로그인, 팀 내부 서버 배포 | `main` (현재) |

### v2 핵심 목표

| 항목 | 내용 |
| :--- | :--- |
| **백엔드** | Go 1.22 + Echo v4 |
| **DB** | PostgreSQL 16 |
| **인증** | JWT (Access 15분 / Refresh 14일) |
| **인벤토리** | GLPI 수준 자산관리 (변경 이력·담당자·업무 연결) |
| **배포** | 단일 서버, Nginx 리버스 프록시, systemd |
| **프론트** | Vite + Vanilla JS (기존 v1 UI 재사용) |

---

## 🏗️ 2. 기술 스택

```
Frontend   Vite 5 + Vanilla JS (ES Modules)
Backend    Go 1.22 + Echo v4
Database   PostgreSQL 16
Proxy      Nginx
Auth       JWT (HttpOnly Refresh Cookie)
Deploy     systemd (Docker 미사용, 추후 도입 예정)
```

---

## 📂 3. 프로젝트 구조

```
taskflow/
├── backend/                   # Go API 서버
│   ├── cmd/api/main.go
│   ├── internal/
│   │   ├── auth/              # JWT 발급·검증·미들웨어
│   │   ├── models/            # DB 구조체
│   │   ├── handlers/          # Echo 라우트 핸들러
│   │   ├── repository/        # DB 접근 계층
│   │   └── service/           # 비즈니스 로직
│   ├── migrations/            # SQL 마이그레이션
│   └── go.mod
│
├── frontend/                  # Vite 프론트엔드
│   ├── src/
│   │   ├── js/                # v1에서 이전한 모듈 (모듈화)
│   │   ├── css/style.css
│   │   ├── api/               # 백엔드 API 통신 레이어
│   │   └── index.html
│   ├── dist/                  # 빌드 결과 (Nginx 제공)
│   └── package.json
│
├── docs/
│   ├── setup-guide/           # 📚 환경 구성 가이드 (아래 참조)
│   └── DESIGN.md
│
├── src/                       # v1 소스 (v1-browser 브랜치 기준)
├── CLAUDE.md                  # Claude Code 지시서
├── HANDOFF.md                 # AI 간 작업 인계 기록
└── .mcp.json                  # MCP 서버 설정
```

---

## 🚀 4. Quick Start

### 환경 구성 가이드

상세 설치·설정은 각 가이드를 참조하세요.

| 가이드 | 내용 |
| :--- | :--- |
| [📦 Client 환경 구성](docs/setup-guide/client-guide/README.md) | Node.js, Vite 설정, 빌드, API 연동 |
| [🖥️ Server 환경 구성](docs/setup-guide/server-guide/README.md) | Go 설치, Nginx, systemd, 배포 |
| [🗄️ DB 환경 구성](docs/setup-guide/DB-guide/README.md) | PostgreSQL 설치, 스키마, 마이그레이션, 백업 |
| [🤖 AI 도구 환경 구성](docs/setup-guide/AI-guide/README.md) | Claude Code, Gemini CLI, MCP 설치, 훅·커맨드 |

### 빠른 실행 순서

```bash
# 1. 소스 클론
git clone https://github.com/jomarusoup/Taskflow.git
cd Taskflow

# 2. DB 스키마 적용 (PostgreSQL 설치 후)
psql -U taskflow -d taskflow -h 127.0.0.1 -f backend/migrations/001_init.sql

# 3. 백엔드 빌드 및 실행
cd backend && go mod tidy && go build -o bin/taskflow ./cmd/api
./bin/taskflow

# 4. 프론트엔드 빌드
cd ../frontend && npm install && npm run build

# 5. Nginx 재시작
sudo systemctl restart nginx
```

---

## 📅 5. 주요 기능

| 기능 | 설명 |
| :--- | :--- |
| **대시보드** | 캘린더 연동, 주간·월간·연간 업무, 기한 초과·오늘 마감 퀵 패널 |
| **칸반 보드** | 드래그 앤 드롭 상태 관리 |
| **업무 대장** | 필터링·정렬·그룹뷰, 다중 카테고리·태그, 연결 업무, CSV 내보내기 |
| **연락처** | 담당자 관리, 업무 연결, 카테고리별 정·부 구분 |
| **인벤토리** | 다중 원장·탭·컬럼 커스텀, 자산 변경 이력 (v2 확장 예정) |
| **멀티유저** | JWT 로그인, 역할(admin·member) 구분 (v2) |

---

## 🤖 6. AI 협업 워크플로

이 프로젝트는 **Claude Code**와 **Gemini CLI**가 역할을 분담하여 협업합니다.

| 에이전트 | 담당 |
| :--- | :--- |
| **Claude Code** | 코드 구현, 버그 수정, `.claude/` 설정 관리, MCP 도구 |
| **Gemini CLI** | 기능 기획, 설계 문서, README 갱신, 아이디어 탐색 |

AI 도구 설치·설정 방법: [AI-guide](docs/setup-guide/AI-guide/README.md)

### 협업 프로토콜

1. **HANDOFF.md** — Claude ↔ Gemini 전환 시 작업 상태 인계
2. **세션 훅** — 세션 시작·종료 시 자동 스냅샷 저장
3. **CLAUDE.md** — Claude 전용 프로젝트 지시서 (규칙·구조·주의사항)
