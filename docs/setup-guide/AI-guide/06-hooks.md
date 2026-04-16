# Hooks — 자동화 훅

특정 이벤트 발생 시 자동으로 실행되는 쉘 스크립트.

## 이벤트 종류

| 이벤트 | 시점 | 파일 |
|---|---|---|
| `SessionStart` | 세션 시작 | `session-start.sh` |
| `Stop` | 세션 종료 | `session-end.sh` |
| `PreCompact` | 컨텍스트 압축 직전 | `pre-compact.sh` |

## session-start.sh

세션 시작 시 최근 세션 파일 경로 안내.

```bash
#!/bin/bash
SESSION_DIR="$(pwd)/.claude/sessions"
LATEST=$(ls -t "$SESSION_DIR"/[0-9]*.md 2>/dev/null | head -1)
if [ -z "$LATEST" ]; then
  LATEST=$(ls -t "$SESSION_DIR"/*.md 2>/dev/null | head -1)
fi
if [ -n "$LATEST" ]; then
  echo "최근 세션: $(basename $LATEST)"
  echo "→ cat $LATEST"
fi
```

## session-end.sh

`/save-session` 미실행 감지 → 자동으로 `auto-*.md` 생성.

## pre-compact.sh

컨텍스트 압축 전 현재 상태 스냅샷 자동 저장.

## 훅 추가 방법

`.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [{
      "matcher": "Bash",
      "hooks": [{ "type": "command", "command": "echo '[Bash 실행]'" }]
    }]
  }
}
```
