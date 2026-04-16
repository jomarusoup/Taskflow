# 백업 및 복구

## 수동 백업

```bash
# 압축 백업 (권장)
pg_dump -U taskflow -h 127.0.0.1 -d taskflow \
  -Fc -f /backup/taskflow_$(date +%Y%m%d).dump

# SQL 덤프
pg_dump -U taskflow -h 127.0.0.1 -d taskflow \
  -f /backup/taskflow_$(date +%Y%m%d).sql
```

## 복구

```bash
# .dump 파일
pg_restore -U taskflow -h 127.0.0.1 -d taskflow \
  /backup/taskflow_20260101.dump

# SQL 파일
psql -U taskflow -h 127.0.0.1 -d taskflow \
  -f /backup/taskflow_20260101.sql
```

## 자동 백업 (cron)

```bash
crontab -e
```

```cron
# 매일 새벽 2시, 30일치 보관
0 2 * * * pg_dump -U taskflow -h 127.0.0.1 -d taskflow -Fc \
  -f /backup/taskflow_$(date +\%Y\%m\%d).dump && \
  find /backup -name "taskflow_*.dump" -mtime +30 -delete
```
