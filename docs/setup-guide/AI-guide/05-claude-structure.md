# .claude 디렉토리 구조

```
.claude/
├── settings.json          # 프로젝트 설정 (hooks, 활성 플러그인)
├── settings.local.json    # 로컬 전용 (git 제외)
├── hooks/                 # 자동화 훅 스크립트
├── commands/              # 슬래시 커맨드 정의
├── agents/                # 서브 에이전트 정의
├── rules/                 # 컨텍스트 규칙 (자동 로드)
└── sessions/              # 세션 스냅샷
```

## settings.json

```json
{
  "hooks": {
    "SessionStart": [{ "matcher": "*", "hooks": [{ "type": "command", "command": ".claude/hooks/session-start.sh" }] }],
    "PreCompact":   [{ "matcher": "*", "hooks": [{ "type": "command", "command": ".claude/hooks/pre-compact.sh" }] }],
    "Stop":         [{ "matcher": "*", "hooks": [{ "type": "command", "command": ".claude/hooks/session-end.sh" }] }]
  },
  "enabledPlugins": {
    "chrome-devtools-mcp@claude-plugins-official": true,
    "github@claude-plugins-official": true,
    "commit-commands@claude-plugins-official": true
  }
}
```

## CLAUDE.md

프로젝트 루트의 `CLAUDE.md`는 세션 시작 시 **항상 자동 로드**된다.  
프로젝트 개요·규칙·데이터 구조·주의사항을 작성해두는 핵심 파일.

## .gitignore 권장

```
.claude/sessions/auto-*.md
.claude/settings.local.json
backend/.env
frontend/dist/
```
