# TASKFLOW — Claude Code 지시서 (v2)

> v1(브라우저 단독) 규칙은 `src/CLAUDE_V1.md` 참조.

## 세션 시작 시 필수 순서

1. `HANDOFF.md` 읽기 — 이전 작업자(Gemini/Claude)가 어디까지 했는지 파악
2. **신선도 확인**: HANDOFF.md의 커밋 해시 vs `git log --oneline -1`
   - 일치 → 바로 작업 시작
   - 불일치 → `git log --oneline -5`로 최근 작업 파악 후 시작
3. 이 파일 확인 → 작업 시작

> HANDOFF.md는 git post-commit 훅으로 커밋마다 자동 갱신됨.
> 불일치 시 git log가 진실의 원본.

---

## 프로젝트 개요

| 항목       | 내용                               |
| ---------- | ---------------------------------- |
| 프론트엔드 | Vite 5 + Vanilla JS (ES Modules)   |
| 백엔드     | Go 1.22 + Echo v4                  |
| DB         | PostgreSQL 16                      |
| 인증       | JWT (Access 15분 / Refresh 14일)   |
| 컨테이너   | Docker + Docker Compose            |
| 프록시     | Nginx                              |
| 배포       | 단일 서버, systemd                 |

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

## AI 역할 분담

| 작업 | 담당 |
|---|---|
| 기능 기획, 요구사항 정리, 설계 문서 | **Gemini** (`gemini` CLI 사용) |
| README.md 갱신 | **Gemini** (전담) |
| 아이디어 탐색, 대안 비교 | **Gemini** |
| 코드 구현, 버그 수정, 리팩터링 | **Claude** |
| `.claude/` 설정 관리 | **Claude** |
| DB 마이그레이션 SQL 작성 | **Claude** |
| Docker / Nginx / systemd 설정 | **Claude** |

> 기획·설계가 필요하면 `gemini -p "..."` 로 직접 위임한다.
> 구현 단계에서만 Claude가 코드를 건드린다.

---

## Gemini 위임 트리거 — 즉시 전환 요청

아래 요청이 오면 코드를 건드리지 말고 사용자에게 전달:

```
이 작업은 Gemini 담당입니다.
터미널에서 실행: gemini -p "..."
```

| 트리거 | 전환 이유 |
|---|---|
| 기능 기획·요구사항 정리 요청 | Gemini 전담 |
| 설계 문서·아키텍처 설계 요청 | Gemini 전담 |
| README.md 수정 요청 | Gemini 전담 |
| 이슈 방향·우선순위 결정 요청 | Gemini 전담 |
| 브레인스토밍·대안 비교 요청 | Gemini 전담 |

---

## 토큰 절약 원칙

- 파일 전체 읽기 금지 — grep 먼저, 필요 범위만 Read
- Gemini가 설계한 내용을 재분석하지 않고 바로 구현
- Gemini 백그라운드 실행 중 동일 작업 선제 수행 금지

---

## 핵심 규칙 (위반 시 즉시 중단)

1. **API 경계 준수** — 프론트엔드는 `/api/` 경유만. 직접 DB 접근 금지
2. **파일 전체 읽기 금지** — grep으로 위치 먼저, 해당 범위만 Read (토큰 절약)
3. **README.md 직접 수정 금지** — Gemini CLI 전담 영역
4. **수정 전 보고** — 기능 추가·삭제 전 `[PLAN]`으로 승인 요청
5. **마이그레이션 필수** — DB 스키마 변경 시 `migrations/` SQL 파일 동반 작성. 기존 파일 수정 금지, 새 파일 추가
6. **코딩 스타일 준수** — `.claude/rules/common/coding-style.md` 적용
7. **수정 완료 시 자동 git push** — 별도 요청 없이 수정 → `/verify` → `git push` 순서로 진행

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

---

## 규칙 파일

| 파일 | 적용 범위 |
| ------------------------------------ | ----------------------------------------- |
| `.claude/rules/ui-layout.md`         | CSS·HTML·JS UI 수정 시 레이아웃 기준      |
| `.claude/rules/issue-workflow.md`    | GitHub 이슈 처리 워크플로                 |
| `.claude/rules/common/coding-style.md` | 전 언어 네이밍·주석·포매팅 규칙         |
| `.claude/rules/common/patterns.md`   | 불변성·오류처리·코드 품질 체크리스트     |
