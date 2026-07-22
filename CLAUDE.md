# TASKFLOW — Claude Code 지시서 (브라우저 단독)

> 이 시스템은 **브라우저에서만** 동작한다. 서버·인터넷·빌드 시스템 없음, 데이터는 localStorage(JSON) 전용.
> 앱 소스는 `src/` 하나뿐이며, `src/index.html` 을 브라우저로 직접 열어 실행한다.

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

인터넷이 없는 환경에서도 사용 가능한 **브라우저 단독 실행** 업무관리 시스템.

| 항목   | 내용                                        |
| ------ | ------------------------------------------- |
| 런타임 | 브라우저 단독 (서버 없음, 빌드 시스템 없음) |
| 저장소 | localStorage 전용 (JSON 직렬화)             |
| 제약   | 외부 CDN·fetch·import 없음, CSP `connect-src 'none'` |
| 소스   | `src/` 디렉토리                             |

---

## 파일 구성 (src/)

| 파일                  | 내용                          |
| --------------------- | ----------------------------- |
| `src/index.html`      | HTML 구조 (엔트리포인트)      |
| `src/css/style.css`   | 전체 스타일시트               |
| `src/css/inventory.css` | 인벤토리 뷰 전용 스타일     |
| `src/js/core.js`      | 전역 상태, 스토리지, 유틸리티 |
| `src/js/ui.js`        | 공통 UI, 테마, 마크다운       |
| `src/js/data.js`      | 업무 CRUD, 동기화             |
| `src/js/backup.js`    | JSON 백업/복원                |
| `src/js/modal.js`     | 업무 상세 모달                |
| `src/js/calendar.js`  | 대시보드, 캘린더, 일정, 월간/연간 업무 |
| `src/js/kanban.js`    | 칸반 보드                     |
| `src/js/ledger.js`    | 업무 대장, 필터링, 정렬       |
| `src/js/inventory.js` | 인벤토리 시스템               |
| `src/js/contacts.js`  | 연락처                        |
| `src/js/app.js`       | 초기화 및 내비게이션          |

---

## AI 역할 분담

| 작업 | 담당 |
|---|---|
| 기능 기획, 요구사항 정리, 설계 문서 | **Gemini** (`gemini` CLI 사용) |
| README.md 갱신 | **Gemini** (전담) |
| 아이디어 탐색, 대안 비교 | **Gemini** |
| 코드 구현, 버그 수정, 리팩터링 | **Claude** |
| `.claude/` 설정 관리 | **Claude** |

> 기획·설계가 필요하면 `gemini -p "..."` 로 직접 위임한다.
> 구현 단계에서만 Claude가 코드를 건드린다.

### Gemini 위임 트리거 — 즉시 전환 요청

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

## 브랜치 전략

```
main        ← 배포 가능 상태만 (직접 push 금지)
feature/*   ← 기능 단위 작업 브랜치 (AI 작업 범위)
```

**AI 작업 규칙:**
- 모든 코드 수정은 `feature/기능이름` 브랜치에서 진행
- 직접 `main` push 금지 — PR 생성 후 개발자 리뷰
- 단, `.claude/` `.gemini/` `CLAUDE.md` `GEMINI.md` 설정 변경은 `main` 직접 push 허용

---

## 핵심 규칙 (위반 시 즉시 중단)

1. **단독 실행 보장** — 외부 서버·CDN·fetch·import 절대 금지. 파일 분리는 허용하되 브라우저에서 `src/index.html` 을 그대로 열면 동작하는 구조 유지
2. **파일 전체 읽기 금지** — grep으로 위치 먼저, 해당 범위만 Read (토큰 절약)
3. **README.md 직접 수정 금지** — Gemini CLI 전담 영역
4. **수정 전 보고** — 기능 추가·삭제 전 `[PLAN]`으로 승인 요청
5. **데이터 마이그레이션 필수** — localStorage 스키마 변경 시 `core.js`의 `load()` 마이그레이션 경로에 하위호환 처리 동반. 저장 키 버전 변경 여부 판단
6. **코딩 스타일 준수** — `.claude/rules/common/coding-style.md` 적용
7. **수정 완료 시 자동 git push** — 별도 요청 없이 수정 → `/verify` → `git push` 순서로 진행

---

## 수정 표준 패턴

```bash
# JS 수정
grep -n "함수명\|키워드" src/js/*.js | head -10
# 해당 파일의 범위만 Read → 수정 → /verify

# CSS 수정
grep -n "클래스\|키워드" src/css/*.css | head -10
# 해당 범위만 Read → 수정 → /verify
```

---

## 데이터 구조 (localStorage)

```js
tasks[]         = { id, title, category, priority, status, tags[], startDate, dueDate,
                    completedAt, assigneeId, memo, contactIds[], linkedTaskIds[] }
contacts[]      = { id, name, title, company, category, type('main'|'sub'),
                    officePhone, mobilePhone, email, memo }
recurringTasks[]   // 월간업무
annualTasks[]      // 연간업무
schedules[]        // 일정
```

## 스토리지 키

```
taskflow_v3 / taskflow_settings_v1 / taskflow_recurring_v1
taskflow_annual_v1 / taskflow_contacts_v1 / taskflow_schedules_v1
taskflow_inventory_v3 / taskflow_sidebar_v1 / taskflow_theme / taskflow_font
```

---

## 알려진 주의사항

- 외부 CDN·fetch·import 절대 금지 (내부망 CSP `connect-src 'none'` 대응)
- localStorage 저장은 `core.js`의 `safeSetItem` 래퍼 사용 (quota 초과 시 토스트 처리)
- `ledger.js`의 EP(확장 패널) 헬퍼는 `_epCatState`, `_epTagState`, `_epLinkedState` 전역 + `_initEpState(id)` 기반 동작
- 사용자 입력 문자열을 인라인 `onclick` 에 직접 넣지 말 것 — `data-*` 속성 + `addEventListener` 방식 사용 (인젝션 방지)
- 날짜 문자열은 `toISOString()` 대신 로컬 성분 조립(`today()` 계열) 사용 — 타임존 하루 밀림 방지
- 인벤토리 고정열은 `position:sticky` + 불투명 배경 + z-index 계층 (`inventory.css`)

---

## 규칙 파일

| 파일 | 적용 범위 |
| ------------------------------------ | ----------------------------------------- |
| `.claude/rules/ui-layout.md`         | CSS·HTML·JS UI 수정 시 레이아웃 기준      |
| `.claude/rules/issue-workflow.md`    | GitHub 이슈 처리 워크플로                 |
| `.claude/rules/common/coding-style.md` | 전 언어 네이밍·주석·포매팅 규칙         |
| `.claude/rules/common/patterns.md`   | 불변성·오류처리·코드 품질 체크리스트     |
