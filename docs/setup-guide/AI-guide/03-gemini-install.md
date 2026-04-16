# Gemini CLI 설치

## 선행 조건

```bash
python3 --version   # 3.9 이상
```

## 설치

```bash
pip3 install gemini-cli
```

## 인증

```bash
# API 키 발급: https://aistudio.google.com/app/apikey
export GEMINI_API_KEY="your_api_key_here"

# 영구 등록
echo 'export GEMINI_API_KEY="your_api_key_here"' >> ~/.bashrc
source ~/.bashrc
```

## 사용법

```bash
# 기본 프롬프트
gemini -p "설계 요청 내용"

# 파일 컨텍스트 포함
gemini -p "이 파일 분석해줘" --file src/js/ledger.js

# 프로젝트 컨텍스트와 함께
cd /opt/taskflow
gemini -p "CLAUDE.md 기반으로 새 기능 X를 설계해줘"
```
