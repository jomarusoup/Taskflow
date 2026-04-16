# AI Setting — Claude Code & Gemini CLI 환경 구성

> Taskflow 프로젝트의 AI 협업 환경 구성 가이드
> Claude Code (Claude) + Gemini CLI (Gemini) 공동 작업 체계

---

## 목차

1. [AI 역할 분담](#1-ai-역할-분담)
2. [Claude Code 설치](#2-claude-code-설치)
3. [Gemini CLI 설치](#3-gemini-cli-설치)
4. [MCP 서버 설치 및 설정](#4-mcp-서버-설치-및-설정)
5. [.claude 디렉토리 구조](#5-claude-디렉토리-구조)
6. [.gemini 디렉토리 구조](#6-gemini-디렉토리-구조)
7. [CLAUDE.md — 프로젝트 지시서](#7-claudemd--프로젝트-지시서)
8. [Hooks — 자동화 훅](#8-hooks--자동화-훅)
9. [Commands — 슬래시 커맨드](#9-commands--슬래시-커맨드)
10. [Agents — 서브 에이전트](#10-agents--서브-에이전트)
11. [Rules — 컨텍스트 규칙](#11-rules--컨텍스트-규칙)
12. [Sessions — 세션 관리](#12-sessions--세션-관리)
13. [AI 전환 워크플로 (Handoff)](#13-ai-전환-워크플로-handoff)

---

## 1. AI 역할 분담

| 작업 | 담당 AI | 이유 |
|---|---|---|
| 기능 기획, 요구사항 정리 | **Gemini** | 긴 컨텍스트로 전체 파악 |
| 설계 문서, 아이디어 비교 | **Gemini** | 탐색적 사고에 강함 |
| README.md 갱신 | **Gemini** (전담) | 문서화 전용 |
| 코드 구현, 버그 수정 | **Claude** | 정밀 편집에 강함 |
| 리팩터링, 코드 리뷰 | **Claude** | |
| `.claude/` 설정 관리 | **Claude** | |
| MCP 도구 사용 (브라우저, GitHub) | **Claude** | MCP 연동 |

### 협업 원칙

- **Claude는 파일 전체를 읽지 않는다** — grep으로 위치 먼저, 해당 범위만 Read
- **설계가 필요하면 Gemini에 위임** — `gemini -p "..."`
- **구현 단계에서만 Claude가 코드를 건드린다**
- **매 수정 후 `/verify` → git push** (자동 워크플로)

---

## 2. Claude Code 설치

### Node.js 선행 설치 필요

```bash
node --version   # v18 이상 필요
```

### Claude Code CLI 설치

```bash
npm install -g @anthropic-ai/claude-code
```

### 인증

```bash
claude
# 최초 실행 시 Anthropic 계정 로그인 안내 표시
# 브라우저에서 인증 후 API 키 연동
```

### 버전 확인

```bash
claude --version
```

### 실행

```bash
# 프로젝트 디렉토리에서 실행
cd /opt/taskflow
claude
```

---

## 3. Gemini CLI 설치

### Python 선행 설치 확인

```bash
python3 --version   # 3.9 이상
pip3 --version
```

### Gemini CLI 설치

```bash
pip3 install google-generativeai
# 또는 공식 CLI
pip3 install gemini-cli
```

### 인증

```bash
# Google Cloud 인증 또는 API 키 방식
export GEMINI_API_KEY="your_api_key_here"

# .bashrc에 영구 등록
echo 'export GEMINI_API_KEY="your_api_key_here"' >> ~/.bashrc
source ~/.bashrc
```

### 사용법

```bash
# 기본 프롬프트
gemini -p "질문 또는 지시사항"

# 파일 컨텍스트와 함께
gemini -p "이 파일을 분석해줘" --file src/js/ledger.js

# Taskflow 설계 위임 예시
gemini -p "새 기능 X에 대한 설계 문서를 작성해줘. 현재 구조: ..."
```

---

## 4. MCP 서버 설치 및 설정

MCP(Model Context Protocol) 서버는 Claude Code에 외부 도구 연동 기능을 제공한다.

### 현재 사용 중인 MCP 서버

| 서버 | 용도 |
|---|---|
| `github` | GitHub 이슈, PR, 파일 조회/수정 |
| `chrome-devtools` | 브라우저 자동화, 스크린샷, 콘솔 확인 |

### 설정 파일 위치

```
프로젝트 범위: /opt/taskflow/.mcp.json
전역 범위:     ~/.claude/settings.json (mcpServers 키)
```

### `.mcp.json` 구조

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

### GitHub MCP 설정

#### GitHub PAT(Personal Access Token) 발급

1. GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens
2. 권한 선택:
   - Repository: `Contents` (read/write), `Issues` (read/write), `Pull requests` (read/write)
3. 토큰 복사

#### 환경변수 등록

```bash
echo 'export GITHUB_PAT="ghp_your_token_here"' >> ~/.bashrc
source ~/.bashrc
```

#### 연동 확인

Claude Code에서:
```
GitHub 레포 jomarusoup/Taskflow의 오픈 이슈 목록 알려줘
```

### chrome-devtools MCP 설정

브라우저 자동화에 사용. X 서버(디스플레이)가 있는 환경에서만 동작.

```bash
# npx로 자동 설치 (설정 파일에 이미 포함됨)
# 별도 설치 불필요

# 헤드리스 모드로 실행 시 (X 서버 없는 서버 환경)
# chrome-devtools-mcp@latest --headless
```

### Gemini용 MCP 설정 (`.gemini/settings.json`)

```json
{
  "approvalMode": "auto_edit",
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

---

## 5. .claude 디렉토리 구조

```
.claude/
├── settings.json          # 프로젝트 설정 (hooks, 활성 플러그인)
├── settings.local.json    # 로컬 전용 설정 (git 제외 권장)
├── hooks/                 # 자동화 훅 스크립트
│   ├── session-start.sh   # 세션 시작 시 실행
│   ├── session-end.sh     # 세션 종료 시 실행
│   └── pre-compact.sh     # 컨텍스트 압축 전 실행
├── commands/              # 슬래시 커맨드 정의
│   ├── verify.md          # /verify — 수정 후 검증
│   ├── git.md             # /git — 커밋·푸시
│   ├── add.md             # /add — 기능 추가
│   ├── fix.md             # /fix — 버그 수정
│   ├── design.md          # /design — 설계
│   ├── handoff.md         # /handoff — AI 전환 상태 저장
│   ├── save-session.md    # /save-session — 세션 요약 저장
│   ├── status.md          # /status — 프로젝트 현황
│   ├── learn.md           # /learn — 패턴 학습
│   └── issue.md           # /issue — GitHub 이슈 처리
├── agents/                # 서브 에이전트 정의
│   ├── planner.md         # 설계 전담 에이전트
│   └── reviewer.md        # 코드 리뷰 에이전트
├── rules/                 # 컨텍스트 규칙 (자동 로드)
│   ├── ui-layout.md       # CSS·HTML·JS UI 수정 기준
│   └── issue-workflow.md  # GitHub 이슈 처리 워크플로
└── sessions/              # 세션 스냅샷 (자동 생성)
    ├── 2026-04-06-init.md # 수동 저장 세션
    └── auto-*.md          # 자동 저장 세션 (git 제외)
```

### `settings.json` 구조

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

---

## 6. .gemini 디렉토리 구조

```
.gemini/
└── settings.json    # MCP 서버 설정, 승인 모드
```

### `settings.json` 구조

```json
{
  "approvalMode": "auto_edit",
  "mcpServers": { ... },
  "hooksConfig": { "enabled": true },
  "hooks": {
    "SessionStart": [{ "type": "command", "command": ".claude/hooks/session-start.sh" }],
    "SessionEnd":   [{ "type": "command", "command": ".claude/hooks/session-end.sh" }]
  }
}
```

---

## 7. CLAUDE.md — 프로젝트 지시서

`CLAUDE.md`는 Claude Code 세션 시작 시 **항상 자동으로 로드**되는 프로젝트 지시서다.  
이 파일에 작성된 내용은 모든 대화에서 컨텍스트로 유지된다.

### 위치

```
/opt/taskflow/CLAUDE.md          # 프로젝트 루트 (자동 로드)
/opt/taskflow/src/CLAUDE.md      # 하위 디렉토리 (해당 디렉토리 작업 시 로드)
```

### 주요 작성 내용

- 프로젝트 개요 및 아키텍처
- 파일 구성 설명
- AI 역할 분담 규칙
- 핵심 제약 사항 (외부 CDN 금지 등)
- 수정 표준 패턴
- 데이터 구조 정의
- 알려진 주의사항

### 수정 방법

```bash
# Claude가 직접 수정 가능
# README.md는 Gemini 전담 — CLAUDE.md와 구분
vi /opt/taskflow/CLAUDE.md
```

---

## 8. Hooks — 자동화 훅

훅은 특정 이벤트 발생 시 자동으로 실행되는 쉘 스크립트다.

### 훅 이벤트 종류

| 이벤트 | 시점 | 파일 |
|---|---|---|
| `SessionStart` | Claude Code 세션 시작 시 | `session-start.sh` |
| `Stop` | 세션 종료 시 | `session-end.sh` |
| `PreCompact` | 컨텍스트 압축 직전 | `pre-compact.sh` |
| `PostToolUse` | 도구 실행 후 | 설정 파일에서 정의 |

### session-start.sh — 세션 시작 훅

세션 시작 시 가장 최근 저장된 세션 파일 경로를 안내한다.

```bash
#!/bin/bash
SESSION_DIR="$(pwd)/.claude/sessions"

# 수동 저장 세션 우선, 없으면 auto 포함
LATEST=$(ls -t "$SESSION_DIR"/[0-9]*.md 2>/dev/null | head -1)
if [ -z "$LATEST" ]; then
  LATEST=$(ls -t "$SESSION_DIR"/*.md 2>/dev/null | head -1)
fi

if [ -n "$LATEST" ]; then
  echo "┌─────────────────────────────────────────┐"
  echo "│  [세션 이어받기]                         │"
  echo "│  최근 세션: $(basename $LATEST)"
  echo "│  → cat $LATEST"
  echo "└─────────────────────────────────────────┘"
fi
```

### session-end.sh — 세션 종료 훅

`/save-session` 없이 종료 시 자동으로 최소한의 스냅샷을 생성한다.

```bash
#!/bin/bash
SESSION_DIR="$(pwd)/.claude/sessions"
TODAY=$(date +%Y-%m-%d)
DATE=$(date +%Y-%m-%d-%H%M)

mkdir -p "$SESSION_DIR"

# 오늘 수동 저장 세션이 없으면 auto 파일 생성
SAVED=$(ls "$SESSION_DIR"/${TODAY}[^a]*.md 2>/dev/null | head -1)
if [ -z "$SAVED" ]; then
  FILE="$SESSION_DIR/auto-${DATE}.md"
  cat > "$FILE" << TEMPLATE
# 자동 저장 — ${DATE}
> /save-session 없이 종료됨. 다음 세션에서 대화 내용 직접 확인 필요.
TEMPLATE
fi
```

### pre-compact.sh — 컨텍스트 압축 전 훅

긴 대화로 컨텍스트 압축이 발생하기 직전 현재 상태를 스냅샷으로 저장한다.

```bash
#!/bin/bash
SESSION_DIR="$(pwd)/.claude/sessions"
mkdir -p "$SESSION_DIR"
DATE=$(date +%Y-%m-%d-%H%M)
FILE="$SESSION_DIR/auto-${DATE}.md"

cat > "$FILE" << TEMPLATE
# 자동 저장 — ${DATE} (PreCompact)
> 컨텍스트 압축 전 자동 생성. /save-session 으로 정리 필요.
TEMPLATE

echo "[PreCompact] 임시 세션 저장: auto-${DATE}.md"
```

### 훅 추가 방법

`.claude/settings.json` 편집:

```json
{
  "hooks": {
    "PostToolUse": [{
      "matcher": "Bash",
      "hooks": [{
        "type": "command",
        "command": "echo '[Bash 실행됨]'"
      }]
    }]
  }
}
```

---

## 9. Commands — 슬래시 커맨드

`.claude/commands/` 디렉토리의 `.md` 파일이 `/파일명` 형태의 슬래시 커맨드로 등록된다.

### 사용법

```
Claude Code 프롬프트에서:
/verify       → 수정 후 검증 실행
/git          → 커밋 & 푸시
/add 기능명   → 기능 추가 플로우
/fix 버그내용 → 버그 수정 플로우
/status       → 프로젝트 현황 확인
/save-session → 현재 세션 요약 저장
/handoff      → Gemini 전환 전 상태 저장
/issue        → GitHub 오픈 이슈 처리
/design 대상  → 설계 문서 작성
/learn        → 패턴/규칙 학습
```

### 커맨드 파일 구조 (예: `verify.md`)

```markdown
# /verify — 수정 후 검증

수정할 때마다 반드시 실행. 2단계로 검증한다.

## STEP 1 — 정적 검증
...

## STEP 2 — 브라우저 검증
...
```

### 새 커맨드 추가 방법

```bash
vi .claude/commands/my-command.md
```

```markdown
# /my-command — 커맨드 설명

실행할 내용을 자연어로 작성.
Claude가 이 내용을 읽고 수행한다.
```

---

## 10. Agents — 서브 에이전트

`.claude/agents/` 디렉토리에 정의된 에이전트는 Claude가 복잡한 작업을 위임할 때 사용한다.

### 현재 에이전트

#### `planner.md` — 설계 에이전트

기능 추가 전 구현 계획을 수립한다. 승인 없이 코드를 작성하지 않는다.

```markdown
---
name: planner
description: 기능 추가 전 설계 전담 에이전트. 구현 전 계획 수립.
---

플래닝 순서:
1. 요구사항 파악
2. 현재 코드 분석 (grep 먼저)
3. 영향 범위 파악
4. [PLAN] 형식으로 보고 → 승인 대기
```

#### `reviewer.md` — 리뷰 에이전트

수정 완료 후 코드 품질과 안정성을 검토한다.

### 에이전트 호출 방법

Claude Code 내에서 자동으로 호출되거나, 명시적으로 지시:

```
planner 에이전트를 사용해서 이 기능을 설계해줘
reviewer 에이전트로 방금 수정한 코드를 리뷰해줘
```

### 새 에이전트 추가

```bash
vi .claude/agents/my-agent.md
```

```markdown
---
name: my-agent
description: 에이전트 설명. Claude가 언제 이 에이전트를 사용할지 결정하는 기준.
---

에이전트가 수행할 작업을 상세히 기술.
```

---

## 11. Rules — 컨텍스트 규칙

`.claude/rules/` 파일들은 특정 파일 수정 시 자동으로 컨텍스트에 포함된다.

### 현재 규칙 파일

#### `ui-layout.md`

CSS·HTML·JS UI 수정 시 항상 로드. 열 폭, 버튼 크기, 패딩 기준 등 UI 일관성 규칙.

```markdown
# 적용 범위: CSS·HTML·JS UI 수정 시
- table-layout: auto 기본
- greedy 열 패턴 (주요 텍스트 열에 width: 100%)
- 버튼 클래스별 패딩 기준
- 호버 시 표시 패턴
```

#### `issue-workflow.md`

GitHub 이슈 처리 시 로드. 이슈 타입별(bug/feat/remove/refactor) 처리 절차.

```markdown
# 적용 범위: GitHub 이슈 처리 시
- 이슈 제목 형식: [bug], [feat], [remove], [refactor]
- 섹션 → grep 키워드 매핑
- [feat] 처리 규칙: planner 에이전트 먼저
- [remove] 처리 규칙: localStorage 영향 먼저 확인
```

### 새 규칙 추가

```bash
vi .claude/rules/new-rule.md
```

CLAUDE.md의 규칙 파일 테이블에도 등록:

```markdown
| `.claude/rules/new-rule.md` | 해당 파일 수정 시 적용 범위 |
```

---

## 12. Sessions — 세션 관리

세션 파일은 AI 간 컨텍스트 연속성을 유지하는 핵심 메커니즘이다.

### 세션 저장 방법

```
Claude Code 프롬프트에서:
/save-session
```

수동 저장 시 `YYYY-MM-DD-제목.md` 형식으로 저장됨.

### 세션 파일 구조

```markdown
# 세션 — 날짜 제목

## 완료
- [x] 기능 A 구현
- [x] 버그 B 수정

## 미완료 / 다음 세션
- [ ] 기능 C (설계 완료, 구현 필요)

## 발견한 패턴·주의사항
- 특이사항 기록

## 파일 상태
- 주요 파일 줄수
- 스토리지 키 현황
```

### 자동 저장 (auto-*)

- `session-end.sh` 훅이 `/save-session` 미실행 감지 → `auto-YYYYMMDD-HHMM.md` 자동 생성
- `pre-compact.sh` 훅이 컨텍스트 압축 전 자동 저장
- `auto-*` 파일은 `.gitignore`에 포함 (git 제외)

```bash
# .gitignore
.claude/sessions/auto-*.md
.claude/settings.local.json
backend/.env
```

---

## 13. AI 전환 워크플로 (Handoff)

Claude ↔ Gemini 전환 시 컨텍스트를 잃지 않기 위한 절차.

### HANDOFF.md

프로젝트 루트의 `HANDOFF.md`가 전환 컨텍스트 단일 공유 파일이다.

```
/opt/taskflow/HANDOFF.md
```

### Claude → Gemini 전환

```
# Claude에서 먼저 실행:
/handoff

# Gemini 시작:
cd /opt/taskflow
gemini

# Gemini 첫 메시지:
HANDOFF.md 확인하고 이어서 진행해줘
```

### Gemini → Claude 전환

```
# Gemini에서 먼저 실행:
HANDOFF.md를 현재 상태로 갱신해줘

# Claude 시작:
cd /opt/taskflow
claude

# Claude는 세션 시작 훅이 자동으로 최근 세션 안내
# HANDOFF.md 읽어서 컨텍스트 파악 후 작업 시작
```

### 신선도 확인

세션 시작 시 HANDOFF.md의 커밋 해시와 현재 HEAD를 비교한다:

```bash
# HANDOFF.md에 기록된 커밋
grep "커밋:" HANDOFF.md

# 실제 현재 커밋
git log --oneline -1

# 일치 → 바로 작업 시작
# 불일치 → git log --oneline -5 로 최근 작업 파악
```
