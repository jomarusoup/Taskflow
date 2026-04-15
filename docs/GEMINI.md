# TASKFLOW — Gemini CLI 지시서

## 세션 시작 시 필수 순서
1. `HANDOFF.md` 읽기 — 이전 AI(Claude)가 어디까지 했는지 파악
2. **신선도 확인**: HANDOFF.md의 커밋 해시와 `git log --oneline -1` 비교
   - 일치 → 바로 작업 시작
   - 불일치 → `git log --oneline -5`로 최근 작업 파악 후 시작
3. 이 파일 확인 → 작업 시작

## HANDOFF.md가 낡았을 때 (자가 복구)

```bash
git log --oneline -10
wc -l src/index.html src/css/style.css src/js/*.js
gh issue list --state open
```

---

## AI 역할 분담

### Gemini 담당 (이 세션에서 처리)

| 작업 | 설명 |
|---|---|
| **기능 기획** | 요구사항 정리, 사용자 스토리, 우선순위 |
| **설계 문서** | `docs/DESIGN.md` 작성·갱신 |
| **README.md** | 기능 목록, 변경사항 최신화 (전담) |
| **아이디어 탐색** | 브레인스토밍, 대안 비교 |
| **이슈 분석** | GitHub 이슈 검토, 구현 방향 제안 |

### Claude 담당 (전환 필요)

| 작업 | 설명 |
|---|---|
| **코드 구현** | JS/CSS/HTML 실제 수정 |
| **버그 수정** | 코드 디버깅, 오류 수정 |
| **리팩터링** | 코드 구조 개선 |
| **`.claude/` 관리** | 규칙·설정 파일 수정 |

> 기획·설계는 Gemini → 구현은 Claude. 경계가 애매하면 Gemini가 먼저 설계하고 Claude에 넘긴다.

---

## 프로젝트 개요

인터넷이 없는 환경에서도 사용 가능한 브라우저 단독 실행 업무관리 시스템.

| 항목 | 내용 |
|---|---|
| 런타임 | 브라우저 단독 (서버 없음, 빌드 시스템 없음) |
| 저장소 | localStorage 전용 |
| 제약 | 외부 CDN 없음, CSP connect-src none |
| 소스 | `src/` (index.html, css/style.css, js/*.js) |

## 파일 구성 (src/)

| 파일 | 내용 |
|---|---|
| `src/index.html` | HTML 구조 |
| `src/css/style.css` | 전체 스타일시트 |
| `src/js/core.js` | 전역 상태, 스토리지, 유틸리티 |
| `src/js/ui.js` | 공통 UI, 테마, 마크다운 |
| `src/js/data.js` | 업무 CRUD, 동기화 |
| `src/js/calendar.js` | 대시보드, 캘린더, 일정 |
| `src/js/kanban.js` | 칸반 보드 |
| `src/js/ledger.js` | 업무 대장, 필터링, 정렬 |
| `src/js/inventory.js` | 인벤토리 시스템 |
| `src/js/app.js` | 초기화 및 내비게이션 |

---

## 핵심 규칙

1. **파일 전체 읽기 금지** — grep으로 위치 먼저, 해당 범위만 읽기
2. **수정 전 [PLAN]** — 기능 추가는 반드시 설명 후 승인 받기
3. **수정 후 검증** — node 정적 검증 필수
4. **README.md 전담** — 주요 변경 후 직접 갱신
5. **단독 실행 보장** — 외부 CDN·fetch·import 절대 금지

## 정적 검증

```bash
node -e "
const fs=require('fs'),vm=require('vm'),path=require('path');
const jsDir='src/js';
fs.readdirSync(jsDir).forEach(f=>{
  if(!f.endsWith('.js'))return;
  const js=fs.readFileSync(path.join(jsDir,f),'utf8');
  try{new vm.Script(js);console.log('✓ '+f+': SYNTAX OK');}
  catch(e){console.log('✗ '+f+': ERROR:',e.message);process.exit(1);}
});
"
```

---

## 핸드오프 (Gemini → Claude 전환 전)

HANDOFF.md 갱신 트리거:
- 큰 기획·설계 완료 후
- Claude로 전환하기 직전
- 사용자 명시 요청 시

```
HANDOFF.md를 갱신해줘:
- 마지막 갱신: 오늘 날짜, Gemini
- 완료 작업: [이번에 한 것]
- 다음 할 일: Claude가 구현할 내용
```

---

## 데이터 구조

```js
tasks[]         = { id, title, category, priority, status, tags[], startDate, dueDate, completedAt, assigneeId, memo }
contacts[]      = { id, name, title, company, category, type, officePhone, mobilePhone, email, memo }
recurringTasks[], annualTasks[]
```

## 스토리지 키

```
taskflow_v3 / taskflow_settings_v1 / taskflow_recurring_v1
taskflow_annual_v1 / taskflow_contacts_v1 / taskflow_theme / taskflow_font
```

## 알려진 주의사항

- `_renderEventBars` rAF 밖 → null 가드 필요
- colspan 현재 **11** — 컬럼 추가 시 함께 수정
