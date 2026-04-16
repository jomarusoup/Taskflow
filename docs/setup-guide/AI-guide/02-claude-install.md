# Claude Code 설치

> 공식 문서: [Claude Code Installation](https://code.claude.com/docs/en/install.md) · [Advanced Setup](https://code.claude.com/docs/en/setup.md)

## 필요 계정

Anthropic **Pro, Max, Team, Enterprise, Console** 중 하나 필요.  
(Claude.ai 무료 플랜은 사용 불가)

---

## 설치 — Native Installer (공식 권장)

Node.js·npm 불필요. RHEL·Rocky Linux에서 바로 사용 가능.

```bash
curl -fsSL https://claude.ai/install.sh | bash
```

### 특정 버전 지정

```bash
# 안정 버전 (약 1주일 검증된 버전)
curl -fsSL https://claude.ai/install.sh | bash -s stable

# 특정 버전 번호 지정
curl -fsSL https://claude.ai/install.sh | bash -s 2.1.89
```

### 특징

- 자동 업데이트 지원
- 의존성 최소화 (Node.js 별도 설치 불필요)
- npm으로 기존 설치한 경우 마이그레이션:
  ```bash
  npm uninstall -g @anthropic-ai/claude-code
  curl -fsSL https://claude.ai/install.sh | bash
  ```

---

## 인증

```bash
claude
# 최초 실행 시 브라우저 인증 안내 표시
# 화면 안내에 따라 Anthropic 계정 로그인
```

---

## 실행

```bash
cd /opt/taskflow
claude
```

## 버전 확인

```bash
claude --version
```
