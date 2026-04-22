# TASKFLOW v1 — Claude Code 지시서 (브라우저 단독 버전)

> 이 파일은 `v1-browser` 브랜치 / `src/` 디렉토리 작업 시 적용되는 규칙입니다.
> v2(Go + PostgreSQL + Docker) 규칙은 루트 `CLAUDE.md` 참조.

---

## 프로젝트 개요

인터넷이 없는 환경에서도 사용 가능한 브라우저 단독 실행 업무관리 시스템.

| 항목   | 내용                                        |
| ------ | ------------------------------------------- |
| 런타임 | 브라우저 단독 (서버 없음, 빌드 시스템 없음) |
| 저장소 | localStorage 전용                           |
| 제약   | 외부 CDN 없음, CSP connect-src none         |
| 소스   | `src/` 디렉토리                             |

---

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

## v1 핵심 규칙 (위반 시 즉시 중단)

1. **단독 실행 보장** — 외부 서버·CDN·fetch·import 절대 금지. 파일 분리는 허용하되 브라우저에서 그대로 열리는 구조 유지
2. **파일 전체 읽기 금지** — grep으로 위치 먼저, 해당 범위만 Read (토큰 절약)
3. **수정 전 보고** — 기능 추가·삭제 전 `[PLAN]`으로 승인 요청
4. **수정 후 검증** — 반드시 `/verify` 실행

---

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

---

## 알려진 주의사항

- `populateModalDropdowns()` 스코프 밖 `t` 참조 → ReferenceError
- colspan 현재 **11** — 컬럼 추가 시 함께 수정
- `ep-tags-${t.id}` ID 중복 이력 — 수정 시 grep 확인
- `_renderEventBars` rAF 밖 실행 → `layer.parentElement` null 가드 필요
- `field-row` 2컬럼 grid — 3개 넣으면 auto-fit 변경 필요
