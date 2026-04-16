# MCP 서버 설치·설정

MCP(Model Context Protocol) — Claude Code에 외부 도구 연동 기능 제공.

## 현재 사용 중인 MCP 서버

| 서버 | 용도 |
|---|---|
| `github` | 이슈·PR·파일 조회/수정 |
| `chrome-devtools` | 브라우저 자동화·스크린샷 |

## 설정 파일 위치

```
프로젝트 범위: /opt/taskflow/.mcp.json
Gemini 범위:   /opt/taskflow/.gemini/settings.json
```

## .mcp.json

```json
{
  "mcpServers": {
    "github": {
      "type": "http",
      "url": "https://api.githubcopilot.com/mcp",
      "headers": {
        "Authorization": "Bearer ${GITHUB_PAT}"
      }
    },
    "chrome-devtools": {
      "command": "npx",
      "args": ["chrome-devtools-mcp@latest"]
    }
  }
}
```

## GitHub PAT 발급

1. GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens
2. 권한: `Contents` (read/write), `Issues` (read/write), `Pull requests` (read/write)
3. 토큰 복사 후 환경변수 등록:

```bash
echo 'export GITHUB_PAT="ghp_your_token"' >> ~/.bashrc
source ~/.bashrc
```

## 연동 확인

Claude Code에서:
```
GitHub 레포 jomarusoup/Taskflow의 오픈 이슈 목록 알려줘
```

## chrome-devtools 참고

X 서버(디스플레이)가 없는 서버 환경에서는 동작하지 않는다.  
로컬 개발 환경에서만 사용 가능.
