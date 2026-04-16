# 백엔드 프로젝트 구조

```
backend/
├── cmd/api/main.go              # 서버 진입점
├── internal/
│   ├── auth/
│   │   ├── jwt.go               # JWT 발급·검증
│   │   └── middleware.go        # Echo 인증 미들웨어
│   ├── models/
│   │   ├── user.go
│   │   ├── task.go
│   │   ├── contact.go
│   │   └── inventory.go
│   ├── handlers/
│   │   ├── auth.go              # /auth/login, /logout, /refresh
│   │   ├── tasks.go
│   │   ├── contacts.go
│   │   └── inventory.go
│   ├── repository/
│   │   ├── db.go                # DB 연결 풀
│   │   ├── task_repo.go
│   │   ├── contact_repo.go
│   │   └── inventory_repo.go
│   └── service/
│       ├── task_service.go
│       └── inventory_service.go
├── migrations/
│   ├── 001_init.sql
│   └── 002_migrate_v1.sql
├── bin/taskflow                 # 빌드 결과
├── .env                         # 환경변수 (git 제외)
└── go.mod
```

## 주요 의존성

| 패키지 | 용도 |
|---|---|
| `labstack/echo/v4` | 웹 프레임워크 |
| `golang-jwt/jwt/v5` | JWT |
| `jmoiron/sqlx` | SQL 확장 |
| `lib/pq` | PostgreSQL 드라이버 |
| `golang.org/x/crypto` | bcrypt |
