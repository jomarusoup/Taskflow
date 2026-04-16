# Client Guide — 프론트엔드 환경 구성

> Vite + Vanilla JS 기반 프론트엔드

## 목차

| 문서 | 내용 |
|---|---|
| [01-nodejs.md](01-nodejs.md) | Node.js 설치 |
| [02-project-structure.md](02-project-structure.md) | 프로젝트 구조 |
| [03-vite-config.md](03-vite-config.md) | Vite 설정 |
| [04-dev-server.md](04-dev-server.md) | 개발 서버 실행 |
| [05-build.md](05-build.md) | 프로덕션 빌드 |
| [06-api-integration.md](06-api-integration.md) | API 연동 구조 |
| [07-v1-migration.md](07-v1-migration.md) | v1 코드 마이그레이션 |

## 아키텍처 요약

```
브라우저
  ↓ 정적 파일 (HTML/CSS/JS)
Nginx :80
  ↓ /api/* 프록시
Go 백엔드 :8080
  ↓
PostgreSQL :5432
```
