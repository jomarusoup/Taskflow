# Taskflow v2 — 개발 환경 구성 가이드

> 대상 OS: Red Hat Enterprise Linux 8/9, Rocky Linux 8/9

---

## 목차

1. [사전 요구사항](#1-사전-요구사항)
2. [시스템 패키지 업데이트](#2-시스템-패키지-업데이트)
3. [Go 설치](#3-go-설치)
4. [Node.js 설치](#4-nodejs-설치)
5. [PostgreSQL 설치 및 설정](#5-postgresql-설치-및-설정)
6. [Nginx 설치 및 설정](#6-nginx-설치-및-설정)
7. [프로젝트 클론 및 초기화](#7-프로젝트-클론-및-초기화)
8. [DB 초기화 및 마이그레이션](#8-db-초기화-및-마이그레이션)
9. [백엔드 빌드 및 실행](#9-백엔드-빌드-및-실행)
10. [프론트엔드 빌드](#10-프론트엔드-빌드)
11. [systemd 서비스 등록](#11-systemd-서비스-등록)
12. [방화벽 설정](#12-방화벽-설정)
13. [v1 데이터 마이그레이션](#13-v1-데이터-마이그레이션)

---

## 1. 사전 요구사항

| 항목 | 버전 | 비고 |
|---|---|---|
| OS | RHEL/Rocky 8 이상 | |
| Go | 1.22 이상 | 백엔드 런타임 |
| Node.js | 20 LTS 이상 | 프론트엔드 빌드 |
| PostgreSQL | 16 이상 | DB |
| Nginx | 1.20 이상 | 리버스 프록시 + 정적 파일 |
| Git | 2.x | 소스 클론 |

---

## 2. 시스템 패키지 업데이트

```bash
sudo dnf update -y
sudo dnf install -y git curl wget tar gcc make
```

---

## 3. Go 설치

### 3-1. 바이너리 다운로드 및 설치

```bash
# 최신 안정 버전 다운로드 (https://go.dev/dl/ 에서 최신 버전 확인)
wget https://go.dev/dl/go1.22.4.linux-amd64.tar.gz -O /tmp/go.tar.gz

# 기존 Go 제거 후 설치
sudo rm -rf /usr/local/go
sudo tar -C /usr/local -xzf /tmp/go.tar.gz

# 임시 파일 정리
rm /tmp/go.tar.gz
```

### 3-2. 환경변수 등록

```bash
cat >> ~/.bashrc << 'EOF'

# Go
export PATH=$PATH:/usr/local/go/bin
export GOPATH=$HOME/go
export PATH=$PATH:$GOPATH/bin
EOF

source ~/.bashrc
```

### 3-3. 설치 확인

```bash
go version
# go version go1.22.4 linux/amd64
```

---

## 4. Node.js 설치

이미 설치된 경우 버전만 확인한다.

```bash
node --version   # v20.x.x 이상이면 OK
npm --version
```

### 미설치 시 — nvm으로 설치 (권장)

```bash
# nvm 설치
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc

# Node.js 20 LTS 설치
nvm install 20
nvm use 20
nvm alias default 20
```

### 또는 dnf로 설치

```bash
sudo dnf module enable nodejs:20 -y
sudo dnf install -y nodejs npm
```

---

## 5. PostgreSQL 설치 및 설정

### 5-1. 설치

Rocky/RHEL 8 기준 PostgreSQL 공식 레포 사용.

```bash
# PostgreSQL 16 레포 추가
sudo dnf install -y https://download.postgresql.org/pub/repos/yum/reporpms/EL-8-x86_64/pgdg-redhat-repo-latest.noarch.rpm

# 기본 모듈 비활성화 (충돌 방지)
sudo dnf -qy module disable postgresql

# 설치
sudo dnf install -y postgresql16-server postgresql16
```

### 5-2. 초기화 및 서비스 시작

```bash
# DB 클러스터 초기화
sudo /usr/pgsql-16/bin/postgresql-16-setup initdb

# 부팅 시 자동 시작 설정
sudo systemctl enable postgresql-16
sudo systemctl start postgresql-16

# 상태 확인
sudo systemctl status postgresql-16
```

### 5-3. DB 및 유저 생성

```bash
sudo -u postgres psql << 'EOF'
-- 애플리케이션 전용 유저 생성
CREATE USER taskflow WITH PASSWORD 'your_secure_password';

-- DB 생성
CREATE DATABASE taskflow OWNER taskflow;

-- 권한 부여
GRANT ALL PRIVILEGES ON DATABASE taskflow TO taskflow;

\q
EOF
```

### 5-4. 접속 허용 설정 (로컬)

```bash
# pg_hba.conf 위치 확인
sudo -u postgres psql -c "SHOW hba_file;"

# 편집 (기본 경로: /var/lib/pgsql/16/data/pg_hba.conf)
sudo vi /var/lib/pgsql/16/data/pg_hba.conf
```

아래 라인을 `local all all peer` 아래에 추가:

```
# Taskflow 애플리케이션
local   taskflow        taskflow                                md5
host    taskflow        taskflow        127.0.0.1/32            md5
```

```bash
# 설정 재적용
sudo systemctl reload postgresql-16
```

### 5-5. 접속 테스트

```bash
psql -U taskflow -d taskflow -h 127.0.0.1 -W
# 비밀번호 입력 후 \conninfo 로 확인
```

---

## 6. Nginx 설치 및 설정

### 6-1. 설치

```bash
sudo dnf install -y nginx
sudo systemctl enable nginx
```

### 6-2. Taskflow 설정 파일 작성

```bash
sudo vi /etc/nginx/conf.d/taskflow.conf
```

```nginx
server {
    listen 80;
    server_name your-server-ip-or-domain;

    # 프론트엔드 정적 파일
    root /opt/taskflow/frontend/dist;
    index index.html;

    # SPA 라우팅 — 없는 경로는 index.html로
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API 리버스 프록시 → Go 백엔드
    location /api/ {
        proxy_pass         http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

```bash
# 설정 문법 검사
sudo nginx -t

# 서비스 시작
sudo systemctl start nginx
```

---

## 7. 프로젝트 클론 및 초기화

```bash
# 배포 디렉토리 생성
sudo mkdir -p /opt/taskflow
sudo chown $USER:$USER /opt/taskflow

# 클론
git clone https://github.com/jomarusoup/Taskflow.git /opt/taskflow
cd /opt/taskflow

# main 브랜치 (v2) 사용
git checkout main
```

### 환경변수 파일 작성

```bash
cat > /opt/taskflow/backend/.env << 'EOF'
# 서버
APP_PORT=8080
APP_ENV=production

# DB
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=taskflow
DB_USER=taskflow
DB_PASSWORD=your_secure_password

# JWT
JWT_SECRET=your_very_long_random_secret_key_here
JWT_ACCESS_EXPIRE=15m
JWT_REFRESH_EXPIRE=336h  # 14일
EOF

chmod 600 /opt/taskflow/backend/.env
```

---

## 8. DB 초기화 및 마이그레이션

```bash
cd /opt/taskflow

# 스키마 적용
psql -U taskflow -d taskflow -h 127.0.0.1 -W -f backend/migrations/001_init.sql

# 초기 admin 계정 생성 (비밀번호는 앱 실행 후 변경 권장)
psql -U taskflow -d taskflow -h 127.0.0.1 -W << 'EOF'
INSERT INTO users (username, password_hash, display_name, role)
VALUES ('admin', 'TEMP_HASH', '관리자', 'admin');
EOF
```

> 실제 비밀번호 해시는 백엔드 서버 실행 후 `/api/v1/auth/init` 엔드포인트를 통해 설정한다.

---

## 9. 백엔드 빌드 및 실행

```bash
cd /opt/taskflow/backend

# 의존성 설치
go mod tidy

# 빌드
go build -o bin/taskflow ./cmd/api

# 실행 테스트
./bin/taskflow
# Taskflow API listening on :8080
```

---

## 10. 프론트엔드 빌드

```bash
cd /opt/taskflow/frontend

# 의존성 설치
npm install

# 프로덕션 빌드
npm run build
# → dist/ 디렉토리에 결과물 생성

# Nginx가 바라보는 경로로 복사 (또는 symlink)
# vite.config.js의 outDir이 ../dist 이므로 /opt/taskflow/frontend/dist
```

Nginx `root` 경로를 `/opt/taskflow/frontend/dist`로 맞춰두었으므로 빌드 후 바로 반영된다.

---

## 11. systemd 서비스 등록

백엔드를 시스템 서비스로 등록하여 서버 재시작 시 자동 구동.

```bash
sudo vi /etc/systemd/system/taskflow.service
```

```ini
[Unit]
Description=Taskflow v2 API Server
After=network.target postgresql-16.service

[Service]
Type=simple
User=taskflow
WorkingDirectory=/opt/taskflow/backend
EnvironmentFile=/opt/taskflow/backend/.env
ExecStart=/opt/taskflow/backend/bin/taskflow
Restart=on-failure
RestartSec=5

# 보안 강화
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

```bash
# 서비스 전용 유저 생성 (선택)
sudo useradd -r -s /sbin/nologin taskflow
sudo chown -R taskflow:taskflow /opt/taskflow

# 서비스 등록 및 시작
sudo systemctl daemon-reload
sudo systemctl enable taskflow
sudo systemctl start taskflow
sudo systemctl status taskflow
```

---

## 12. 방화벽 설정

```bash
# HTTP (Nginx)
sudo firewall-cmd --permanent --add-service=http

# HTTPS (추후 SSL 적용 시)
sudo firewall-cmd --permanent --add-service=https

# 내부 포트(8080)는 외부 노출 불필요 — Nginx가 프록시하므로
# 만약 직접 접근 테스트가 필요하다면:
# sudo firewall-cmd --permanent --add-port=8080/tcp

sudo firewall-cmd --reload
sudo firewall-cmd --list-all
```

---

## 13. v1 데이터 마이그레이션

기존 Taskflow v1(브라우저 단독)에서 데이터를 옮기는 방법.

### Step 1 — v1에서 Export

브라우저에서 Taskflow v1 접속 → **설정 → 데이터 내보내기** → JSON 파일 저장

### Step 2 — 서버로 전송

```bash
scp taskflow_export.json user@server:/tmp/
```

### Step 3 — 마이그레이션 실행

```bash
# import용 임시 테이블에 JSON 로드
psql -U taskflow -d taskflow -h 127.0.0.1 -W << 'EOF'
CREATE TEMP TABLE v1_import (data JSONB);
\copy v1_import(data) FROM '/tmp/taskflow_export.json'
EOF

# 마이그레이션 스크립트 실행
psql -U taskflow -d taskflow -h 127.0.0.1 -W -f /opt/taskflow/backend/migrations/002_migrate_v1.sql
```

---

## 빠른 참조

```bash
# 서비스 상태 확인
sudo systemctl status taskflow nginx postgresql-16

# 백엔드 로그
sudo journalctl -u taskflow -f

# Nginx 로그
sudo tail -f /var/log/nginx/error.log

# DB 접속
psql -U taskflow -d taskflow -h 127.0.0.1 -W

# 프론트 재빌드 & 반영
cd /opt/taskflow/frontend && npm run build
```
