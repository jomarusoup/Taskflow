# v1 데이터 마이그레이션

v1 localStorage → v2 PostgreSQL

## Step 1 — v1에서 Export

Taskflow v1 → **설정 → 데이터 내보내기** → JSON 저장

```json
{
  "tasks": [...],
  "contacts": [...],
  "recurringTasks": [...],
  "annualTasks": [...],
  "schedules": [...]
}
```

## Step 2 — 서버로 전송

```bash
scp taskflow_export.json user@server:/tmp/
```

## Step 3 — 마이그레이션 실행

```bash
psql -U taskflow -d taskflow -h 127.0.0.1 << 'EOF'
CREATE TEMP TABLE v1_import (data JSONB);
\copy v1_import(data) FROM '/tmp/taskflow_export.json'
\i /opt/taskflow/backend/migrations/002_migrate_v1.sql
\q
EOF
```

## Step 4 — 결과 검증

```sql
SELECT 'tasks'    AS tbl, COUNT(*) FROM tasks
UNION ALL
SELECT 'contacts',        COUNT(*) FROM contacts
UNION ALL
SELECT 'recurring',       COUNT(*) FROM recurring_tasks
UNION ALL
SELECT 'annual',          COUNT(*) FROM annual_tasks;
```
