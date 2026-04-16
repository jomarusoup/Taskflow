# 서브 에이전트

`.claude/agents/*.md` 파일로 정의. 복잡한 작업을 전담 에이전트에 위임.

## 현재 에이전트

### planner — 설계 에이전트

기능 추가 전 구현 계획 수립. **승인 없이 코드 작성 금지**.

```markdown
---
name: planner
description: 기능 추가 전 설계 전담. 구현 전 계획 수립.
---

1. 요구사항 파악
2. grep으로 현재 코드 분석
3. 영향 범위 파악
4. [PLAN] 형식으로 보고 → 승인 대기
```

### reviewer — 리뷰 에이전트

수정 완료 후 코드 품질·안정성 검토.

## 에이전트 호출

```
# 명시적 호출
planner 에이전트로 이 기능을 설계해줘
reviewer 에이전트로 방금 수정한 코드 리뷰해줘

# Claude가 자동 판단하여 호출하기도 함
```

## 새 에이전트 추가

```bash
vi .claude/agents/my-agent.md
```

```markdown
---
name: my-agent
description: 에이전트 설명 (언제 사용할지 기준)
---

수행할 작업을 상세히 기술.
```
