# TASKFLOW Frontend — Claude 세션 규칙

> 이 세션은 `frontend/` + `src/` 디렉토리만 다룬다.
> 백엔드(`backend/`)는 절대 수정하지 않는다.

## 작업 범위

| 허용 | 금지 |
|---|---|
| `frontend/**` | `backend/**` |
| `src/**` (v1) | 백엔드 로직 판단 |
| `docs/api/` (읽기 전용) | DB 스키마 직접 참조 |

## API 경계 규칙

- 백엔드 호출은 `frontend/src/api/` 레이어만 통해서
- API 명세는 `docs/api/openapi.md` 기준 — 명세 외 엔드포인트 임의 호출 금지
- 명세에 없는 데이터가 필요하면 코드 수정이 아닌 HANDOFF.md에 요청 기록

## 브랜치

- `feature/프론트엔드기능이름` 브랜치에서 작업
- `develop`으로 PR, `main` 직접 push 금지
- v1 버그픽스는 `v1-browser` 브랜치에서 작업

## JS/CSS 코딩 규칙

- `.claude/rules/common/coding-style.md` 준수
- `.claude/rules/ui-layout.md` UI 수정 시 필수 참조
- 모든 함수에 함수 주석 헤더 작성
- `var` 사용 금지, `const` / `let` 사용
