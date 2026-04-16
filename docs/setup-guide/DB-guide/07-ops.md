# 운영 관리 명령

## 서비스 관리

```bash
sudo systemctl status postgresql-16
sudo systemctl restart postgresql-16
sudo systemctl reload postgresql-16   # 설정 변경 시 (무중단)
```

## 자주 쓰는 psql 명령

```bash
# 접속
psql -U taskflow -d taskflow -h 127.0.0.1

# 테이블 목록
\dt

# 테이블 구조
\d tasks

# DB 크기
SELECT pg_size_pretty(pg_database_size('taskflow'));

# 현재 연결 수
SELECT count(*) FROM pg_stat_activity WHERE datname = 'taskflow';

# 5초 이상 실행 중인 쿼리
SELECT pid, now() - query_start AS duration, query
FROM pg_stat_activity
WHERE state = 'active'
  AND now() - query_start > interval '5 seconds'
ORDER BY duration DESC;
```

## 유지보수

```bash
# 통계 업데이트 + 공간 회수
psql -U taskflow -d taskflow -h 127.0.0.1 -c "VACUUM ANALYZE;"

# journal 로그 정리
sudo journalctl --vacuum-time=30d
```
