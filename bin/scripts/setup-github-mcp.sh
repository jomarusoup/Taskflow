#!/bin/bash
# GitHub MCP 최초 세팅 스크립트 (한 번만 실행)
# 실행: bash setup-github-mcp.sh

echo "=== GitHub MCP 세팅 ==="
echo ""

# 1. PAT 입력
read -p "GitHub PAT를 입력하세요 (ghp_...): " GITHUB_PAT_INPUT

if [ -z "$GITHUB_PAT_INPUT" ]; then
  echo "PAT가 입력되지 않았습니다."
  exit 1
fi

# 2. ~/.bashrc 에 환경변수 등록
if grep -q "GITHUB_PAT" ~/.bashrc; then
  echo "✓ GITHUB_PAT 이미 등록됨 — 업데이트합니다"
  sed -i '/export GITHUB_PAT=/d' ~/.bashrc
fi

echo "export GITHUB_PAT=\"$GITHUB_PAT_INPUT\"" >> ~/.bashrc
echo "✓ ~/.bashrc 에 GITHUB_PAT 등록 완료"
export GITHUB_PAT="$GITHUB_PAT_INPUT"

# 3. Claude Code에 GitHub MCP 등록
echo ""
echo "GitHub MCP 등록 중..."
claude mcp add-json github \
  "{\"type\":\"http\",\"url\":\"https://api.githubcopilot.com/mcp\",\"headers\":{\"Authorization\":\"Bearer $GITHUB_PAT_INPUT\"}}"

if [ $? -eq 0 ]; then
  echo "✓ GitHub MCP 등록 완료"
else
  echo "✗ 실패 — PATH 확인: export PATH=\"\$HOME/.local/bin:\$PATH\""
fi

# 4. settings.json Stop 훅 추가 여부 확인
SETTINGS=".claude/settings.json"
if [ -f "$SETTINGS" ]; then
  if grep -q "session-end.sh" "$SETTINGS"; then
    echo "✓ session-end.sh 훅 이미 등록됨"
  else
    echo ""
    echo "⚠️  settings.json 에 Stop 훅을 추가하세요:"
    echo '  "Stop": [{"matcher":"*","hooks":[{"type":"command","command":".claude/hooks/session-end.sh"}]}]'
  fi
fi

echo ""
echo "=== 완료 ==="
echo "1. source ~/.bashrc  — 환경변수 적용"
echo "2. claude 재시작 후 /mcp — 연결 확인"
