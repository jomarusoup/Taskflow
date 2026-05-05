# TASKFLOW — Claude Code 프로젝트 지시서

## 세션 시작 시 필수 순서

1. `HANDOFF.md` 읽기 — 이전 작업자(Gemini/Claude)가 어디까지 했는지 파악
2. **신선도 확인**: HANDOFF.md의 커밋 해시 vs `git log --oneline -1`
   - 일치 → 바로 작업 시작
   - 불일치 → `git log --oneline -5`로 최근 작업 파악 후 시작
3. 이 파일 확인 → 작업 시작

HANDOFF.md는 git post-commit 훅으로 커밋마다 자동 갱신됨. 불일치 시 git log가 진실의 원본.

---

## 프로젝트 개요

| 항목       | 내용                             |
| ---------- | -------------------------------- |
| 프론트엔드 | Vite 5 + Vanilla JS (ES Modules) |
| 백엔드     | Go 1.22 + Echo v4                |
| DB         | PostgreSQL 16                    |
| 인증       | JWT (Access 15분 / Refresh 14일) |
| 컨테이너   | Docker + Docker Compose          |
| 프록시     | Nginx                            |
| 배포       | 단일 서버, systemd               |

---

## 프로젝트 구조

```
taskflow/
├── backend/
│   ├── cmd/api/main.go
│   ├── internal/
│   │   ├── auth/          # JWT 발급·검증·미들웨어
│   │   ├── handlers/      # Echo 라우트 핸들러
│   │   ├── repository/    # DB 접근 계층
│   │   └── service/       # 비즈니스 로직
│   ├── migrations/        # SQL 마이그레이션 (순번 파일)
│   └── go.mod
│
├── frontend/
│   ├── src/
│   │   ├── js/            # 기능 모듈
│   │   ├── css/
│   │   └── api/           # 백엔드 API 통신 레이어
│   ├── vite.config.js
│   └── package.json
│
├── src/                   # v1 브라우저 단독 버전 (보존)
│   └── CLAUDE_V1.md       # v1 작업 시 규칙
│
└── docs/
    ├── setup-guide/       # 환경 구성 가이드
    └── coding-style-universal.md
```

---

## 브랜치 전략

```
main        ← 배포 가능 상태만 (직접 push 금지)
develop     ← 통합 브랜치 (PR로만 merge)
feature/*   ← 기능 단위 작업 브랜치 (AI 작업 범위)
v1-browser  ← v1 보존 (src/ 버그픽스만)
```

**AI 작업 규칙:**
- 모든 코드 수정은 `feature/기능이름` 브랜치에서 진행
- 직접 `main` / `develop` push 금지 — PR 생성 후 개발자 리뷰
- 단, `~/.claude/` `.gemini/` `CLAUDE.md` `GEMINI.md` 설정 변경은 `main` 직접 push 허용
- v1 버그픽스는 `v1-browser` 브랜치에서 작업 후 cherry-pick

---

## AI 세션 분리

컨텍스트 오염 방지를 위해 백엔드·프론트엔드 세션을 분리한다.

| 세션 | 작업 범위 | 참조 규칙 |
|---|---|---|
| **백엔드 세션** | `backend/` 전용 | `backend/CLAUDE.md` |
| **프론트엔드 세션** | `frontend/` + `src/` | `frontend/CLAUDE.md` |
| **공통** | `~/.claude/` `docs/` `CLAUDE.md` | 이 파일 + `~/.claude/CLAUDE.md` |

**API 경계**: `docs/api/` 의 명세가 두 세션의 유일한 접점. 백엔드는 명세대로 구현, 프론트엔드는 명세대로 호출.

---

## 핵심 규칙 (위반 시 즉시 중단)

1. **API 경계 준수** — 프론트엔드는 `/api/` 경유만. 직접 DB 접근 금지
2. **마이그레이션 필수** — DB 스키마 변경 시 `migrations/` SQL 파일 동반 작성. 기존 파일 수정 금지, 새 파일 추가
3. **docs 반영** — 아래 변경 시 해당 문서를 함께 갱신
   - API 엔드포인트 추가·변경 → `docs/api/openapi.md`
   - 브랜치·세션 규칙 변경 → `CLAUDE.md` / `GEMINI.md`
   - README 갱신 필요 시 → 사용자에게 Gemini 실행 요청 (직접 수정 금지)

---

## 수정 표준 패턴

```bash
# Go 수정
grep -n "키워드\|함수명" backend/internal/**/*.go | head -10
# 해당 범위만 Read → 수정 → go build ./... 확인

# SQL 마이그레이션
# migrations/ 에 새 파일 추가 (NNN_description.sql 형식, 기존 파일 수정 금지)

# JS/CSS 수정 (frontend/)
grep -n "키워드\|함수명" frontend/src/js/*.js | head -10
# 해당 범위만 Read → 수정 → /verify
```

---

## DB 스키마 (주요 테이블)

```sql
users(id, email, password_hash, role, created_at)
tasks(id, user_id, title, category, priority, status, tags, start_date, due_date, completed_at, memo)
contacts(id, user_id, name, dept, phone, email, category, memo)
schedules(id, user_id, title, date, start_time, end_time, color, memo)
```

---

## 인증 규칙

- **Access Token**: 메모리(변수) 보관, 15분 만료 — localStorage 저장 금지
- **Refresh Token**: HttpOnly 쿠키, 14일 만료
- API 요청마다 `Authorization: Bearer <access_token>` 헤더 포함
- 401 응답 시 Refresh Token으로 자동 갱신 후 재시도

---

## 알려진 주의사항

- `migrations/` 파일은 한 번 적용 후 수정 금지 — 변경 시 새 파일로 추가
- Docker Compose 환경변수는 `.env` (`.gitignore` 등록 필수)
- JWT Secret은 환경변수로만 관리, 코드에 하드코딩 금지
- Go `context` 전파 필수 — DB 쿼리·외부 호출 모두 ctx 인자 포함
