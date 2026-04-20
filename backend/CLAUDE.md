# TASKFLOW Backend — Claude 세션 규칙

> 이 세션은 `backend/` 디렉토리만 다룬다.
> 프론트엔드(`frontend/` `src/`)는 절대 수정하지 않는다.

## 작업 범위

| 허용 | 금지 |
|---|---|
| `backend/**` | `frontend/**` |
| `docs/api/` (API 명세 갱신) | `src/**` |
| `backend/migrations/` | 프론트엔드 로직 판단 |

## API 경계 규칙

- 엔드포인트 추가·변경 시 **반드시** `docs/api/openapi.md` 먼저 갱신
- 프론트엔드가 어떻게 호출할지 고려하지 않는다 — 명세가 계약
- 응답 구조 변경 시 프론트엔드 세션에 알릴 내용을 HANDOFF.md에 기록

## 브랜치

- `feature/백엔드기능이름` 브랜치에서 작업
- `develop`으로 PR, `main` 직접 push 금지

## Go 코딩 규칙

- `.claude/rules/common/coding-style.md` 준수
- 모든 핸들러·서비스 함수에 함수 주석 헤더 작성
- 에러는 반드시 핸들링, 무시 금지 (`_ = err` 절대 금지)
- `context.Context` 항상 첫 번째 인자로 전달
