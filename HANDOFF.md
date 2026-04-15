# TASKFLOW — AI 핸드오프 상태
> 이 파일은 Claude ↔ Gemini 전환 시 컨텍스트를 이어받는 **단일 공유 파일**이다.
> `/handoff` (Claude) 또는 `@HANDOFF.md 갱신` (Gemini) 트리거로만 갱신한다.
> **세션마다 자동 저장 안 함 — 명시적 트리거만.**

---

## 마지막 갱신
- 날짜: 2026-04-15
- 작업자: Gemini
- 커밋: (작업 중 - 커밋 전)

---

## 프로젝트 스냅샷 (src/)

| 파일 영역 | 설명 | 줄수 |
|---|---|---|
| `src/index.html` | 메인 UI (엔트리포인트) | 688줄 |
| `src/css/style.css` | 전체 스타일 | 868줄 |
| `src/js/*.js` | 11개 모듈화된 JS 파일들 | ~3,600줄 |

- 브랜치: `main`
- GitHub: jomarusoup/taskflow

---

## 완료된 주요 작업 (최근순)

- [x] (Gemini) **상세 패널 카테고리/태그 다중 선택 UI 고도화**:
    - 태그 및 카테고리 입력란을 모두 검색/선택/직접입력이 가능한 다중 선택 UI(Pill + Dropdown)로 업그레이드.
    - 검색창을 상단에 고정(`sticky`)하고 배경색을 부여하여 스크롤 시 시인성 확보.
    - 검색창에서 새로운 항목 입력 후 `Enter` 시 즉시 추가되는 기능 구현.
- [x] (Gemini) **상세 패널 데이터 유지 버그 수정**:
    - 저장 또는 렌더링 시 상세 패널 내의 다중 선택 UI(Pill)가 사라지는 현상 수정 (리스트/그룹 뷰 공통).
- [x] (Gemini) **일정 추가/수정 팝업 레이아웃 최적화**:
    - 필드 구조 상하 배치 통일, 시간 필드 그리드 적용, 하단 여백 보정.
- [x] (Gemini) **업무 대장 그룹 뷰 레이아웃 및 너비 최적화**:
    - 버튼/제목 가로 정렬, `table-layout: auto` 및 `min-width` 적용.

---

## 미처리 이슈 (GitHub)

- 현재 GitHub 이슈 (jomarusoup/Taskflow) 에 열린 이슈 없음.

---

## 다음 세션이 할 일

- [ ] (UI/UX) 전체적인 UI 폴리싱 및 사용자 피드백 반영.
- [ ] (기능) 업무 상세보기 모달(Modal)의 태그/카테고리 드롭다운에도 검색 및 직접 입력 기능 수평 전개 검토.

// 스토리지 키
taskflow_v3 / taskflow_settings_v1 / taskflow_recurring_v1
taskflow_annual_v1 / taskflow_contacts_v1 / taskflow_schedules_v1

// tasks[] 스키마
{ id, title, category, priority, status, tags[], startDate, dueDate,
  completedAt, assigneeId, memo, contactIds[], linkedTaskIds[] }

---

## 알려진 주의사항

- `ledger.js`의 EP(Expanded Panel) 헬퍼 함수들은 `_epCatState`, `_epTagState` 등을 기반으로 동작함.
- 외부 CDN·fetch·import 절대 금지 (내부망 CSP 대응).

---

## 전환 방법

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
