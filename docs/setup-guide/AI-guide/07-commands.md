# 슬래시 커맨드

`.claude/commands/*.md` 파일이 `/파일명` 커맨드로 등록된다.

## 현재 커맨드 목록

| 커맨드 | 설명 |
|---|---|
| `/verify` | 수정 후 정적·브라우저 검증 |
| `/git` | 커밋 & 푸시 (Haiku 에이전트 위임) |
| `/add 기능명` | 기능 추가 플로우 |
| `/fix 버그내용` | 버그 수정 플로우 |
| `/design 대상` | 설계 문서 작성 |
| `/status` | 프로젝트 현황 확인 |
| `/save-session` | 세션 요약 저장 |
| `/handoff` | AI 전환 전 상태 저장 |
| `/issue` | GitHub 오픈 이슈 처리 |
| `/learn` | 패턴·규칙 학습 |

## 새 커맨드 추가

```bash
vi .claude/commands/my-command.md
```

```markdown
# /my-command — 설명

Claude가 실행할 내용을 자연어로 작성.
```

## 사용 예시

```
Claude Code 프롬프트:
/verify
/git
/add 사용자 프로필 페이지
/fix 로그인 후 리다이렉트 안 되는 버그
```
