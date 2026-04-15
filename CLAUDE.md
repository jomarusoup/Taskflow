# TASKFLOW — Claude Code 지시서

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

인터넷이 없는 환경에서도 사용가능한 브라우저 단독 실행 업무관리 시스템.

| 항목   | 내용                                        |
| ------ | ------------------------------------------- |
| 런타임 | 브라우저 단독 (서버 없음, 빌드 시스템 없음) |
| 저장소 | localStorage 전용                           |
| 제약   | 외부 CDN 없음, CSP connect-src none         |
| 소스   | `src/` 디렉토리                             |

## 파일 구성 (src/)

| 파일                  | 내용                          |
| --------------------- | ----------------------------- |
| `src/index.html`      | HTML 구조 (엔트리포인트)      |
| `src/css/style.css`   | 전체 스타일시트               |
| `src/js/core.js`      | 전역 상태, 스토리지, 유틸리티 |
| `src/js/ui.js`        | 공통 UI, 테마, 마크다운       |
| `src/js/data.js`      | 업무 CRUD, 동기화             |
| `src/js/calendar.js`  | 대시보드, 캘린더, 일정        |
| `src/js/kanban.js`    | 칸반 보드                     |
| `src/js/ledger.js`    | 업무 대장, 필터링, 정렬       |
| `src/js/inventory.js` | 인벤토리 시스템               |
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

---

## 핵심 규칙 (위반 시 즉시 중단)

1. **단독 실행 보장** — 외부 서버·CDN·fetch·import 절대 금지. 파일 분리는 허용하되 브라우저에서 그대로 열리는 구조 유지
2. **파일 전체 읽기 금지** — grep으로 위치 먼저, 해당 범위만 Read (토큰 절약)
3. **README.md 직접 수정 금지** — Gemini CLI 전담 영역. 수정 필요 시 사용자에게 Gemini 사용 요청
4. **수정 전 보고** — 기능 추가·삭제 전 `[PLAN]`으로 승인 요청
5. **수정 후 검증** — 반드시 `/verify` 실행

## 수정 표준 패턴

```bash
# JS 수정
grep -n "함수명\|키워드" src/js/*.js | head -10
# 해당 파일의 범위만 Read → 수정 → /verify

# CSS 수정
grep -n "클래스\|키워드" src/css/style.css | head -10
# 해당 범위만 Read → 수정 → /verify
```

---

## 데이터 구조

```js
tasks[]         = { id, title, category, priority, status, tags[], startDate, dueDate, completedAt, assigneeId, memo }
contacts[]      = { id, name, title, company, category, type('main'|'sub'), officePhone, mobilePhone, email, memo }
recurringTasks[]   // 월간업무
annualTasks[]      // 연간업무
```

## 스토리지 키

```
taskflow_v3 / taskflow_settings_v1 / taskflow_recurring_v1
taskflow_annual_v1 / taskflow_contacts_v1 / taskflow_theme / taskflow_font
```

## 알려진 주의사항

- `populateModalDropdowns()` 스코프 밖 `t` 참조 → ReferenceError
- colspan 현재 **11** — 컬럼 추가 시 함께 수정
- `ep-tags-${t.id}` ID 중복 이력 — 수정 시 grep 확인
- `_renderEventBars` rAF 밖 실행 → `layer.parentElement` null 가드 필요
- `field-row` 2컬럼 grid — 3개 넣으면 auto-fit 변경 필요

---

## 규칙 파일

| 파일                              | 적용 범위                            |
| --------------------------------- | ------------------------------------ |
| `.claude/rules/ui-layout.md`      | CSS·HTML·JS UI 수정 시 레이아웃 기준 |
| `.claude/rules/issue-workflow.md` | GitHub 이슈 처리 워크플로            |
