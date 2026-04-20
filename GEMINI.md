# TASKFLOW — Gemini CLI 지시서

> 상세 규칙: `docs/GEMINI.md` 참조

## 세션 시작 시 필수 순서

1. `HANDOFF.md` 읽기 — 이전 AI(Claude)가 어디까지 했는지 파악
2. 신선도 확인: HANDOFF.md 커밋 해시 vs `git log --oneline -1`
   - 일치 → 바로 작업 시작
   - 불일치 → `git log --oneline -5` 확인 후 시작

---

## 브랜치 전략

```
main        ← 배포 가능 상태 (직접 push 금지)
develop     ← 통합 브랜치 (PR로만 merge)
feature/*   ← 기능 단위 작업 (Claude 코딩 범위)
v1-browser  ← v1 보존
```

- 기획·설계 완료 후 Claude에게 `feature/기능이름` 브랜치 이름 제안
- PR 제목·설명 초안 작성은 Gemini 담당

## 역할 경계 (엄수)

### Gemini 담당 — 코드를 한 줄도 쓰지 않는다

| 작업 | 설명 |
|---|---|
| 기능 기획 | 요구사항 정리, 우선순위, 사용자 스토리 |
| 설계 문서 | `docs/DESIGN.md` 작성·갱신 |
| README.md | 기능 목록, 변경사항 최신화 (전담) |
| 이슈 분석 | GitHub 이슈 검토, 구현 방향 제안 |
| 아이디어 탐색 | 브레인스토밍, 대안 비교 |

### Claude 위임 트리거 — 즉시 전환 요청

아래 요청이 오면 코드·설정을 건드리지 말고 사용자에게 전달:

```
이 작업은 Claude 담당입니다.
터미널에서 실행: claude
```

| 트리거 | 전환 이유 |
|---|---|
| 코드 수정·버그 수정 요청 | Claude 전담 |
| `.claude/` `.gemini/` 설정 수정 | Claude 전담 |
| DB 마이그레이션 SQL 작성 | Claude 전담 |
| Docker / Nginx / systemd 설정 | Claude 전담 |
| `/verify` `/git` 실행 | Claude 전담 |

---

## 토큰 절약 원칙

- 코드 파일 전체 읽기 금지 — 설계에 필요한 인터페이스만 확인
- 구현 세부사항은 Claude에게 위임, Gemini는 "무엇을" 만들지만 결정
- HANDOFF.md로 컨텍스트 전달, 중복 분석 금지

---

## 프로젝트 개요

| 항목 | 내용 |
|---|---|
| 프론트엔드 | Vite 5 + Vanilla JS |
| 백엔드 | Go 1.22 + Echo v4 |
| DB | PostgreSQL 16 |
| 인증 | JWT (Access 15분 / Refresh 14일) |
| 컨테이너 | Docker + Docker Compose |

소스 구조: `backend/` `frontend/` `src/`(v1 보존) `docs/`

---

## 핸드오프 (Gemini → Claude 전환)

설계·기획 완료 후 HANDOFF.md 갱신:

```
HANDOFF.md를 갱신해줘:
- 마지막 갱신: [오늘 날짜], Gemini
- 완료 작업: [이번에 한 것]
- 다음 할 일: [Claude가 구현할 내용]
```
