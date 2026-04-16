# DB Setting — PostgreSQL 환경 구성

> 대상: Taskflow v2 데이터베이스
> OS: RHEL/Rocky Linux 8/9 / PostgreSQL 16

---

## 목차

1. [개요](#1-개요)
2. [PostgreSQL 설치](#2-postgresql-설치)
3. [초기화 및 서비스 시작](#3-초기화-및-서비스-시작)
4. [DB 및 유저 생성](#4-db-및-유저-생성)
5. [접속 허용 설정](#5-접속-허용-설정)
6. [스키마 적용](#6-스키마-적용)
7. [스키마 상세](#7-스키마-상세)
8. [v1 데이터 마이그레이션](#8-v1-데이터-마이그레이션)
9. [백업 및 복구](#9-백업-및-복구)
10. [운영 관리](#10-운영-관리)

---

## 1. 개요

| 항목 | 내용 |
|---|---|
| DBMS | PostgreSQL 16 |
| DB명 | taskflow |
| 유저 | taskflow (애플리케이션 전용) |
| 포트 | 5432 (로컬 전용, 외부 미노출) |
| 인코딩 | UTF-8 |
| 주요 기능 | JSONB (유연한 메타데이터), UUID, 배열 타입 |

---

## 2. PostgreSQL 설치

### 공식 레포 추가 및 설치

```bash
# PostgreSQL 16 공식 레포 추가
sudo dnf install -y https://download.postgresql.org/pub/repos/yum/reporpms/EL-8-x86_64/pgdg-redhat-repo-latest.noarch.rpm

# 기본 postgresql 모듈 비활성화 (버전 충돌 방지)
sudo dnf -qy module disable postgresql

# 설치
sudo dnf install -y postgresql16-server postgresql16 postgresql16-contrib

# 버전 확인
psql --version
# psql (PostgreSQL) 16.x
```

### 내부망 환경

```bash
# 외부 PC에서 rpm 다운로드 후 서버로 전송
# https://download.postgresql.org/pub/repos/yum/16/redhat/rhel-8-x86_64/
scp postgresql16-*.rpm user@server:/tmp/
sudo dnf install -y /tmp/postgresql16-*.rpm
```

---

## 3. 초기화 및 서비스 시작

```bash
# DB 클러스터 초기화 (최초 1회만 실행)
sudo /usr/pgsql-16/bin/postgresql-16-setup initdb

# 부팅 시 자동 시작 등록
sudo systemctl enable postgresql-16

# 서비스 시작
sudo systemctl start postgresql-16

# 상태 확인
sudo systemctl status postgresql-16
```

---

## 4. DB 및 유저 생성

```bash
# postgres 슈퍼유저로 접속
sudo -u postgres psql
```

```sql
-- 애플리케이션 전용 유저 생성
-- (비밀번호는 .env의 DB_PASSWORD와 동일하게 설정)
CREATE USER taskflow WITH PASSWORD 'your_secure_password';

-- DB 생성
CREATE DATABASE taskflow
  OWNER     = taskflow
  ENCODING  = 'UTF8'
  LC_COLLATE = 'ko_KR.UTF-8'
  LC_CTYPE   = 'ko_KR.UTF-8'
  TEMPLATE  = template0;

-- 권한 부여
GRANT ALL PRIVILEGES ON DATABASE taskflow TO taskflow;

-- 확인
\l taskflow
\q
```

> `ko_KR.UTF-8` locale이 없으면 `en_US.UTF-8` 또는 `C`로 대체.  
> locale 확인: `locale -a | grep ko`

---

## 5. 접속 허용 설정

### pg_hba.conf 수정

```bash
# 설정 파일 위치 확인
sudo -u postgres psql -c "SHOW hba_file;"
# /var/lib/pgsql/16/data/pg_hba.conf

sudo vi /var/lib/pgsql/16/data/pg_hba.conf
```

기존 내용 아래에 추가:

```
# TYPE  DATABASE   USER       ADDRESS          METHOD
# Taskflow 애플리케이션 — 로컬 접속
local   taskflow   taskflow                    md5
host    taskflow   taskflow   127.0.0.1/32     md5
```

### postgresql.conf 수정 (로컬 전용)

```bash
sudo vi /var/lib/pgsql/16/data/postgresql.conf
```

```ini
# 로컬에서만 수신 (외부 노출 차단)
listen_addresses = 'localhost'
port = 5432

# 성능 기본 튜닝 (서버 RAM에 맞게 조정)
shared_buffers = 256MB          # RAM의 25%
effective_cache_size = 512MB    # RAM의 50%
max_connections = 100
```

### 설정 재적용

```bash
sudo systemctl reload postgresql-16
```

### 접속 테스트

```bash
psql -U taskflow -d taskflow -h 127.0.0.1
# 비밀번호 입력 후
\conninfo
# You are connected to database "taskflow" as user "taskflow"
\q
```

---

## 6. 스키마 적용

```bash
# 초기 스키마 적용
psql -U taskflow -d taskflow -h 127.0.0.1 \
  -f /opt/taskflow/backend/migrations/001_init.sql

# 결과 확인
psql -U taskflow -d taskflow -h 127.0.0.1 -c "\dt"
```

### 초기 admin 계정 생성

```bash
psql -U taskflow -d taskflow -h 127.0.0.1 << 'EOF'
-- 임시 계정 (백엔드 실행 후 /api/v1/auth/init 으로 비밀번호 재설정)
INSERT INTO users (username, password_hash, display_name, role)
VALUES ('admin', '$2a$10$placeholder', '관리자', 'admin');
\q
EOF
```

> 실제 bcrypt 해시는 Go 백엔드의 초기화 엔드포인트(`/api/v1/auth/init`)를 통해 설정한다.

---

## 7. 스키마 상세

### 테이블 관계도

```
users ──┬── tasks ──── task_assignees ── contacts
        │         └── task_links
        ├── contacts
        ├── recurring_tasks
        ├── annual_tasks
        ├── schedules
        ├── settings
        └── inventory_ledgers ── inventory_tabs ── inventory_columns
                              └── inventory_rows ── inventory_cells
                                               └── asset_histories
```

### 주요 테이블 설명

#### `users`
```sql
id            UUID PK
username      VARCHAR(50) UNIQUE  -- 로그인 ID
password_hash TEXT                -- bcrypt 해시
display_name  VARCHAR(100)        -- 화면 표시명
role          VARCHAR(20)         -- admin | member
```

#### `tasks`
```sql
id           UUID PK
created_by   UUID → users(id)
title        TEXT
category     TEXT
priority     VARCHAR(20)          -- high | medium | low
status       VARCHAR(20)          -- todo | in_progress | done 등
tags         TEXT[]               -- PostgreSQL 배열 타입
start_date   DATE
due_date     DATE
completed_at TIMESTAMPTZ
memo         TEXT
```

#### `contacts`
```sql
id             UUID PK
created_by     UUID → users(id)
name           VARCHAR(100)
company        VARCHAR(100)
title          VARCHAR(100)
categories     TEXT[]              -- 다중 카테고리 배열
category_roles JSONB               -- [{category: "IT", role: "main"}, ...]
office_phone   VARCHAR(50)
mobile_phone   VARCHAR(50)
email          VARCHAR(200)
memo           TEXT
```

#### `inventory_ledgers / tabs / columns / rows / cells`
```
ledger (원장)
  └── tab (탭/시트)
        └── column (컬럼 정의: 이름, 타입, 옵션)
  └── row (행)
        └── cell (row × column 교차점, 실제 값)
```

`inventory_cells` 의 `value`는 TEXT로 저장하며, `col_type`에 따라 애플리케이션 레이어에서 형변환한다.

#### `asset_histories` (GLPI 감사 로그)
```sql
row_id     UUID → inventory_rows(id)  -- 어떤 자산
col_id     UUID → inventory_columns   -- 어떤 필드
changed_by UUID → users(id)           -- 누가
old_value  TEXT                        -- 변경 전
new_value  TEXT                        -- 변경 후
changed_at TIMESTAMPTZ                 -- 언제
```

---

## 8. v1 데이터 마이그레이션

### Step 1 — v1 브라우저에서 Export

Taskflow v1 접속 → **설정 → 데이터 내보내기** → `taskflow_export.json` 저장

내보내기 JSON 구조:
```json
{
  "tasks": [...],
  "contacts": [...],
  "recurringTasks": [...],
  "annualTasks": [...],
  "schedules": [...]
}
```

### Step 2 — 서버로 전송

```bash
scp taskflow_export.json user@server:/tmp/
```

### Step 3 — 마이그레이션 실행

```bash
psql -U taskflow -d taskflow -h 127.0.0.1 << 'EOF'
-- JSON 파일 임시 테이블에 로드
CREATE TEMP TABLE v1_import (data JSONB);
\copy v1_import(data) FROM '/tmp/taskflow_export.json'

-- 마이그레이션 실행
\i /opt/taskflow/backend/migrations/002_migrate_v1.sql
\q
EOF
```

### Step 4 — 결과 검증

```bash
psql -U taskflow -d taskflow -h 127.0.0.1 << 'EOF'
SELECT 'tasks'    AS tbl, COUNT(*) FROM tasks
UNION ALL
SELECT 'contacts',        COUNT(*) FROM contacts
UNION ALL
SELECT 'recurring',       COUNT(*) FROM recurring_tasks
UNION ALL
SELECT 'annual',          COUNT(*) FROM annual_tasks;
\q
EOF
```

---

## 9. 백업 및 복구

### 전체 백업

```bash
# 일반 백업 (SQL 덤프)
pg_dump -U taskflow -h 127.0.0.1 -d taskflow \
  -f /backup/taskflow_$(date +%Y%m%d).sql

# 압축 백업 (권장)
pg_dump -U taskflow -h 127.0.0.1 -d taskflow \
  -Fc -f /backup/taskflow_$(date +%Y%m%d).dump
```

### 복구

```bash
# SQL 파일로 복구
psql -U taskflow -h 127.0.0.1 -d taskflow \
  -f /backup/taskflow_20260101.sql

# .dump 파일로 복구
pg_restore -U taskflow -h 127.0.0.1 -d taskflow \
  /backup/taskflow_20260101.dump
```

### 자동 백업 (cron)

```bash
crontab -e
```

```cron
# 매일 새벽 2시 자동 백업 (30일치 보관)
0 2 * * * pg_dump -U taskflow -h 127.0.0.1 -d taskflow -Fc \
  -f /backup/taskflow_$(date +\%Y\%m\%d).dump && \
  find /backup -name "taskflow_*.dump" -mtime +30 -delete
```

---

## 10. 운영 관리

### 자주 쓰는 명령

```bash
# DB 접속
psql -U taskflow -d taskflow -h 127.0.0.1

# 테이블 목록
\dt

# 테이블 구조 확인
\d tasks

# 현재 연결 수 확인
SELECT count(*) FROM pg_stat_activity WHERE datname = 'taskflow';

# DB 크기 확인
SELECT pg_size_pretty(pg_database_size('taskflow'));

# 느린 쿼리 확인 (실행 중)
SELECT pid, now() - query_start AS duration, query
FROM pg_stat_activity
WHERE state = 'active' AND now() - query_start > interval '5 seconds'
ORDER BY duration DESC;
```

### PostgreSQL 서비스 관리

```bash
sudo systemctl status postgresql-16
sudo systemctl restart postgresql-16
sudo systemctl reload postgresql-16    # 설정 변경 시 (무중단)
```

### 인덱스 유지보수

```bash
# 통계 업데이트 (자동 실행되지만 수동 강제 가능)
psql -U taskflow -d taskflow -h 127.0.0.1 -c "ANALYZE;"

# 인덱스 재구성 (디스크 공간 회수)
psql -U taskflow -d taskflow -h 127.0.0.1 -c "VACUUM ANALYZE;"
```
