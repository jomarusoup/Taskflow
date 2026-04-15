# TASKFLOW — AI 핸드오프 상태
> 이 파일은 Claude ↔ Gemini 전환 시 컨텍스트를 이어받는 **단일 공유 파일**이다.
> `/handoff` (Claude) 또는 `@HANDOFF.md 갱신` (Gemini) 트리거로만 갱신한다.
> **세션마다 자동 저장 안 함 — 명시적 트리거만.**

---

## 마지막 갱신
- 날짜: 2026-04-14
- 작업자: git auto (post-commit)
- 커밋: `1522026` modi

---

## 프로젝트 스냅샷 (src/)

| 파일 영역 | 설명 | 줄수 |
|---|---|---|
| `src/index.html` | 메인 UI (엔트리포인트) | 688줄 |
| `src/css/style.css` | 전체 스타일 | 861줄 |
| `src/js/*.js` | 11개 모듈화된 JS 파일들 | ~3,100줄 |

- 브랜치: `main`
- GitHub: jomarusoup/taskflow

---

## 완료된 주요 작업 (최근순)

- [x] (Gemini) 프로젝트 구조 개편: 루트 파일을 `src/` 폴더로 이동
- [x] (Gemini) `taskflow.js` 해체: 11개의 기능별 모듈 파일로 분리 (토큰 절약 및 유지보수성 향상)
- [x] (Gemini) `index.html` 내 스크립트 의존성 순서대로 연결 완료
- [x] (Gemini) 백업/가져오기 시 일정(schedules) 데이터 누락 수정
- [x] (Gemini) .gemini/settings.json 훅 설정 동기화 (Claude와 세션 공유)
- [x] (Gemini) 업무대장 그룹뷰 열 정렬 및 너비 최적화
- [x] (Gemini) 사이드바 칸반/인벤토리 아이콘 중복 수정

---

## 미처리 이슈 (GitHub)

- 현재 GitHub 이슈 (jomarusoup/Taskflow) 에 열린 이슈 없음.

---

## 다음 세션이 할 일

- [ ] (디자인/UI) 전체적인 UI 폴리싱 및 사용자 피드백 반영 (필요 시)
- [ ] (기능) 추가적인 편의 기능 아이디어 도출 및 구현

// 스토리지 키
taskflow_v3           // tasks[]
taskflow_settings_v1  // settings
taskflow_recurring_v1 // recurringTasks[]
taskflow_annual_v1    // annualTasks[]
taskflow_contacts_v1  // contacts[]
taskflow_schedules_v1 // schedules[] ← 최근 추가

// tasks[] 스키마
{ id, title, category, priority, status, tags[], startDate, dueDate,
  completedAt, assigneeId, memo, contactIds[], linkedTaskIds[] }

// schedules[] 스키마 (신규)
{ id, title, date, startTime, endTime, color, memo }
```

---

## 알려진 주의사항

- `colspan` 현재 동적 처리 (고정값 없음)
- SCHEDULE_KEY = `taskflow_schedules_v1` — 백업 시 포함 여부 확인 필요
- `_renderEventBars` rAF 밖 실행 → `layer.parentElement` null 가드 필요
- 외부 CDN·fetch·import 절대 금지 (내부망 CSP)

---

## 다음 세션이 할 일

- [ ] (없음 — 이슈 확인 후 결정)

---

## 전환 방법

### Claude → Gemini 전환
```
# Claude에서 먼저 실행:
/handoff

# Gemini 시작:
cd /Users/jomarusoup/Documents/project/taskflow
gemini

# Gemini 첫 메시지:
HANDOFF.md와 GEMINI.md를 읽고 이어서 진행해줘
```

### Gemini → Claude 전환
```
# Gemini에서 먼저 실행:
HANDOFF.md를 현재 상태로 갱신해줘

# Claude 시작:
cd /Users/jomarusoup/Documents/project/taskflow
claude

# Claude 첫 메시지:
최근 핸드오프 확인하고 이어서 진행해줘
```
