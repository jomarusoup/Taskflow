# AI 역할 분담

## 역할 표

| 작업 | 담당 | 이유 |
|---|---|---|
| 기능 기획·요구사항 정리 | **Gemini** | 긴 컨텍스트로 전체 파악 |
| 설계 문서·아이디어 비교 | **Gemini** | 탐색적 사고 |
| README.md 갱신 | **Gemini** (전담) | 문서화 전용 |
| 코드 구현·버그 수정·리팩터링 | **Claude** | 정밀 편집 |
| `.claude/` 설정 관리 | **Claude** | |
| MCP 도구 사용 (브라우저·GitHub) | **Claude** | MCP 연동 |

## 협업 원칙

- Claude는 **파일 전체를 읽지 않는다** — grep으로 위치 먼저, 범위만 Read
- 설계가 필요하면 `gemini -p "..."` 로 위임
- 구현 단계에서만 Claude가 코드 수정
- 매 수정 후 `/verify` → git push 자동 진행

## Gemini 위임 예시

```bash
gemini -p "로그인 기능 설계를 해줘. 현재: Go + Echo 백엔드, JWT 인증 예정"
gemini -p "인벤토리 자산관리 DB 스키마 설계를 해줘"
```
