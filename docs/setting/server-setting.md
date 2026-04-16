# Server Setting — 백엔드 및 Nginx 환경 구성

> 대상: Taskflow v2 Go 백엔드 + Nginx
> OS: RHEL/Rocky Linux 8/9

---

## 목차

1. [개요](#1-개요)
2. [Go 설치](#2-go-설치)
3. [프로젝트 구조](#3-프로젝트-구조)
4. [환경변수 설정](#4-환경변수-설정)
5. [백엔드 빌드 및 실행](#5-백엔드-빌드-및-실행)
6. [Nginx 설치 및 설정](#6-nginx-설치-및-설정)
7. [systemd 서비스 등록](#7-systemd-서비스-등록)
8. [방화벽 설정](#8-방화벽-설정)
9. [로그 관리](#9-로그-관리)
10. [배포 업데이트 절차](#10-배포-업데이트-절차)

---

## 1. 개요

| 항목 | 내용 |
|---|---|
| 언어 | Go 1.22 |
| 프레임워크 | Echo v4 |
| 포트 | 8080 (내부, 외부 미노출) |
| 인증 | JWT (Access 15분 / Refresh 14일) |
| 리버스 프록시 | Nginx (80 → 8080) |

### 요청 흐름

```
클라이언트 브라우저
    ↓ :80
  Nginx
    ├── /         → frontend/dist/ (정적 파일)
    └── /api/*    → 127.0.0.1:8080 (Go 백엔드)
                        ↓
                   PostgreSQL :5432
```

---

## 2. Go 설치

### 2-1. 다운로드 및 설치

인터넷이 연결된 환경:
```bash
wget https://go.dev/dl/go1.22.4.linux-amd64.tar.gz -O /tmp/go.tar.gz
sudo rm -rf /usr/local/go
sudo tar -C /usr/local -xzf /tmp/go.tar.gz
rm /tmp/go.tar.gz
```

인터넷이 없는 내부망 환경:
```bash
# 외부 PC에서 다운로드 후 서버로 전송
scp go1.22.4.linux-amd64.tar.gz user@server:/tmp/

# 서버에서 설치
sudo tar -C /usr/local -xzf /tmp/go.tar.gz
```

### 2-2. 환경변수 등록

```bash
cat >> ~/.bashrc << 'EOF'

# Go
export PATH=$PATH:/usr/local/go/bin
export GOPATH=$HOME/go
export PATH=$PATH:$GOPATH/bin
EOF

source ~/.bashrc
```

### 2-3. 설치 확인

```bash
go version
# go version go1.22.4 linux/amd64
```

---

## 3. 프로젝트 구조

```
backend/
├── cmd/
│   └── api/
│       └── main.go             # 서버 진입점
├── internal/                   # 외부 패키지에서 import 불가 (캡슐화)
│   ├── auth/
│   │   ├── jwt.go              # JWT 발급/검증
│   │   └── middleware.go       # Echo 인증 미들웨어
│   ├── models/
│   │   ├── user.go             # users 테이블 구조체
│   │   ├── task.go             # tasks 테이블 구조체
│   │   ├── contact.go          # contacts 테이블 구조체
│   │   └── inventory.go        # inventory_* 테이블 구조체
│   ├── handlers/
│   │   ├── auth.go             # POST /auth/login, /auth/logout, /auth/refresh
│   │   ├── tasks.go            # GET/POST/PUT/DELETE /tasks
│   │   ├── contacts.go         # GET/POST/PUT/DELETE /contacts
│   │   └── inventory.go        # GET/POST/PUT/DELETE /inventory
│   ├── repository/
│   │   ├── db.go               # DB 연결 풀 초기화
│   │   ├── task_repo.go        # tasks 쿼리
│   │   ├── contact_repo.go     # contacts 쿼리
│   │   └── inventory_repo.go   # inventory 쿼리
│   └── service/
│       ├── task_service.go     # 업무 비즈니스 로직
│       └── inventory_service.go
├── migrations/
│   ├── 001_init.sql            # 초기 스키마
│   └── 002_migrate_v1.sql      # v1 데이터 마이그레이션
├── bin/
│   └── taskflow                # 빌드 결과 바이너리
├── .env                        # 환경변수 (git 제외)
└── go.mod
```

### 주요 의존성

```
github.com/labstack/echo/v4         # 웹 프레임워크
github.com/golang-jwt/jwt/v5        # JWT
github.com/jmoiron/sqlx             # SQL 확장 (Named query 등)
github.com/lib/pq                   # PostgreSQL 드라이버
golang.org/x/crypto                 # bcrypt 비밀번호 해싱
```

---

## 4. 환경변수 설정

```bash
vi /opt/taskflow/backend/.env
```

```ini
# 서버
APP_PORT=8080
APP_ENV=production          # development | production

# DB
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=taskflow
DB_USER=taskflow
DB_PASSWORD=your_secure_password_here

# JWT
JWT_SECRET=your_very_long_random_secret_64chars_minimum_here
JWT_ACCESS_EXPIRE=15m       # Access Token 만료 (15분)
JWT_REFRESH_EXPIRE=336h     # Refresh Token 만료 (14일)
```

```bash
# 파일 권한 제한 (소유자만 읽기)
chmod 600 /opt/taskflow/backend/.env
```

> `JWT_SECRET`은 최소 64자 이상의 랜덤 문자열 사용.  
> 생성 방법: `openssl rand -hex 64`

---

## 5. 백엔드 빌드 및 실행

### 의존성 다운로드

```bash
cd /opt/taskflow/backend
go mod tidy
```

### 빌드

```bash
# 현재 플랫폼용 빌드
go build -o bin/taskflow ./cmd/api

# 빌드 결과 확인
ls -lh bin/taskflow
file bin/taskflow
```

### 실행 테스트

```bash
./bin/taskflow
# INFO  Taskflow API Server
# INFO  Listening on :8080
```

### 개발 중 핫 리로드 (air 사용)

```bash
# air 설치 (개발 환경에서만)
go install github.com/air-verse/air@latest

# 프로젝트 루트에서 실행
cd /opt/taskflow/backend
air
```

---

## 6. Nginx 설치 및 설정

### 6-1. 설치

```bash
sudo dnf install -y nginx
sudo systemctl enable nginx
```

### 6-2. 설정 파일 작성

```bash
sudo vi /etc/nginx/conf.d/taskflow.conf
```

```nginx
server {
    listen 80;
    server_name _;    # IP 직접 접근 허용. 도메인이 있으면 도메인명 입력

    # 프론트엔드 정적 파일
    root /opt/taskflow/frontend/dist;
    index index.html;

    # SPA 라우팅 (새로고침 시 404 방지)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Go 백엔드 API 프록시
    location /api/ {
        proxy_pass          http://127.0.0.1:8080;
        proxy_http_version  1.1;
        proxy_set_header    Host              $host;
        proxy_set_header    X-Real-IP         $remote_addr;
        proxy_set_header    X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header    X-Forwarded-Proto $scheme;
        proxy_read_timeout  60s;
        proxy_send_timeout  60s;
    }

    # 보안 헤더
    add_header X-Content-Type-Options  nosniff;
    add_header X-Frame-Options         SAMEORIGIN;
    add_header X-XSS-Protection        "1; mode=block";

    # 정적 파일 캐시 (JS/CSS는 Vite가 해시 파일명 사용하므로 장기 캐시 가능)
    location ~* \.(js|css|png|jpg|ico|woff2)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

### 6-3. 설정 적용

```bash
# 문법 검사
sudo nginx -t
# nginx: configuration file /etc/nginx/nginx.conf test is successful

# 서비스 시작
sudo systemctl start nginx

# 상태 확인
sudo systemctl status nginx
```

### 6-4. 기본 설정 비활성화 (충돌 방지)

```bash
# /etc/nginx/nginx.conf 에 기본 server {} 블록이 있으면 주석 처리
sudo vi /etc/nginx/nginx.conf
# http { } 블록 안의 default server 블록을 제거하거나 주석 처리
```

---

## 7. systemd 서비스 등록

### 서비스 전용 유저 생성

```bash
sudo useradd -r -s /sbin/nologin taskflow-svc
sudo chown -R taskflow-svc:taskflow-svc /opt/taskflow/backend
```

### 서비스 파일 작성

```bash
sudo vi /etc/systemd/system/taskflow.service
```

```ini
[Unit]
Description=Taskflow v2 API Server
Documentation=https://github.com/jomarusoup/Taskflow
After=network.target postgresql-16.service
Wants=postgresql-16.service

[Service]
Type=simple
User=taskflow-svc
WorkingDirectory=/opt/taskflow/backend
EnvironmentFile=/opt/taskflow/backend/.env
ExecStart=/opt/taskflow/backend/bin/taskflow
ExecReload=/bin/kill -HUP $MAINPID

# 비정상 종료 시 5초 후 자동 재시작
Restart=on-failure
RestartSec=5

# 보안 강화
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=/opt/taskflow/backend

# 로그
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

### 서비스 등록 및 시작

```bash
sudo systemctl daemon-reload
sudo systemctl enable taskflow
sudo systemctl start taskflow
sudo systemctl status taskflow
```

---

## 8. 방화벽 설정

```bash
# HTTP 포트 개방
sudo firewall-cmd --permanent --add-service=http

# HTTPS (SSL 인증서 적용 후)
sudo firewall-cmd --permanent --add-service=https

# 설정 반영
sudo firewall-cmd --reload

# 확인
sudo firewall-cmd --list-all
```

> 8080 포트는 Nginx가 프록시하므로 **외부에 노출하지 않는다.**  
> 개발 중 직접 테스트가 필요하면 `--add-port=8080/tcp` 임시 추가 후 테스트.

---

## 9. 로그 관리

### 실시간 로그 확인

```bash
# 백엔드 로그 (systemd journal)
sudo journalctl -u taskflow -f

# 오늘 로그만
sudo journalctl -u taskflow --since today

# Nginx 접근 로그
sudo tail -f /var/log/nginx/access.log

# Nginx 에러 로그
sudo tail -f /var/log/nginx/error.log
```

### 로그 로테이션 (자동 구성됨)

```bash
# journal 로그 크기 제한 확인
sudo journalctl --disk-usage

# 오래된 로그 정리
sudo journalctl --vacuum-time=30d
```

---

## 10. 배포 업데이트 절차

```bash
#!/bin/bash
# /opt/taskflow/scripts/deploy.sh

set -e

echo "=== Taskflow 배포 시작: $(date) ==="

# 1. 최신 소스 받기
cd /opt/taskflow
git pull origin main

# 2. 백엔드 재빌드
cd backend
go mod tidy
go build -o bin/taskflow ./cmd/api
echo "✓ 백엔드 빌드 완료"

# 3. 프론트엔드 재빌드
cd ../frontend
npm install
npm run build
echo "✓ 프론트엔드 빌드 완료"

# 4. 서비스 재시작
sudo systemctl restart taskflow
sudo systemctl status taskflow --no-pager

echo "=== 배포 완료: $(date) ==="
```

```bash
# 실행 권한 부여
chmod +x /opt/taskflow/scripts/deploy.sh

# 배포 실행
/opt/taskflow/scripts/deploy.sh
```
