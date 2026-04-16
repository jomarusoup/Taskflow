# AI 전환 워크플로 (Handoff)

Claude ↔ Gemini 전환 시 컨텍스트를 이어받는 절차.

## HANDOFF.md

`/opt/taskflow/HANDOFF.md` — 전환 컨텍스트 단일 공유 파일.

```markdown
## 마지막 갱신
- 날짜 / 작업자 / 커밋 해시

## 완료된 주요 작업

## 미처리 이슈

## 다음 세션이 할 일

## 알려진 주의사항
```

## Claude → Gemini 전환

```
# Claude에서:
/handoff

# Gemini 시작:
cd /opt/taskflow
gemini

# Gemini 첫 메시지:
HANDOFF.md 확인하고 이어서 진행해줘
```

## Gemini → Claude 전환

```
# Gemini에서:
HANDOFF.md를 현재 상태로 갱신해줘

# Claude 시작:
cd /opt/taskflow
claude
# session-start.sh 훅이 최근 세션 자동 안내
```

## 신선도 확인

HANDOFF.md의 커밋 해시와 현재 HEAD 비교:

```bash
grep "커밋:" HANDOFF.md
git log --oneline -1
```

| 결과 | 조치 |
|---|---|
| 일치 | 바로 작업 시작 |
| 불일치 | `git log --oneline -5` 로 최근 작업 파악 후 시작 |
