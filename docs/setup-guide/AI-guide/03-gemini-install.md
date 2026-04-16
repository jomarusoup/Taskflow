# Gemini CLI 설치

> 공식 저장소: [google-gemini/gemini-cli](https://github.com/google-gemini/gemini-cli)

---

## 설치

### npx — 설치 없이 바로 실행 (빠른 시작)

```bash
npx @google/gemini-cli
```

### npm 전역 설치 (권장)

```bash
npm install -g @google/gemini-cli
```

설치 후:
```bash
gemini --version
```

---

## 인증

### 방법 1 — Google Sign-In OAuth (권장)

별도 API 키 불필요. 무료 할당량 제공.

```bash
gemini
# 실행 후 브라우저 Google 계정 로그인 안내 표시
```

- 무료 한도: 60 요청/분, 1,000 요청/일
- Gemini 3 모델, 최대 1M 토큰 컨텍스트

### 방법 2 — Gemini API Key

API 키 발급: [Google AI Studio](https://aistudio.google.com/app/apikey)

```bash
export GEMINI_API_KEY="your_api_key_here"

# 영구 등록
echo 'export GEMINI_API_KEY="your_api_key_here"' >> ~/.bashrc
source ~/.bashrc

gemini
```

---

## 릴리스 채널

| 채널 | 설명 | 설치 |
|---|---|---|
| `@latest` (기본) | 주간 안정 릴리스 | `npm install -g @google/gemini-cli` |
| `@preview` | 주간 시험 기능 | `npm install -g @google/gemini-cli@preview` |
| `@nightly` | 매일 최신 빌드 | `npm install -g @google/gemini-cli@nightly` |

---

## 사용법

```bash
# 기본 프롬프트
gemini -p "설계 요청 내용"

# 프로젝트 디렉토리에서 실행 (컨텍스트 자동 로드)
cd /opt/taskflow
gemini -p "CLAUDE.md 기반으로 새 기능을 설계해줘"
```
