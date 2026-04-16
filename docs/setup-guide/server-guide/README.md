# Server Guide — 백엔드 및 Nginx 환경 구성

> Go 1.22 + Echo v4 + Nginx

## 목차

| 문서 | 내용 |
|---|---|
| [01-go-install.md](01-go-install.md) | Go 설치 |
| [02-project-structure.md](02-project-structure.md) | 백엔드 프로젝트 구조 |
| [03-env-config.md](03-env-config.md) | 환경변수 설정 |
| [04-build-run.md](04-build-run.md) | 빌드 및 실행 |
| [05-nginx.md](05-nginx.md) | Nginx 설치 및 설정 |
| [06-systemd.md](06-systemd.md) | systemd 서비스 등록 |
| [07-firewall.md](07-firewall.md) | 방화벽 설정 |
| [08-deploy.md](08-deploy.md) | 배포 업데이트 절차 |

## 요청 흐름

```
클라이언트
  ↓ :80
Nginx
  ├── /       → frontend/dist/ (정적 파일)
  └── /api/*  → 127.0.0.1:8080 (Go)
                    ↓
               PostgreSQL :5432
```
