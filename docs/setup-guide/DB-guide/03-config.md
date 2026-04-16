# 접속 허용 설정

## pg_hba.conf

```bash
sudo -u postgres psql -c "SHOW hba_file;"
# /var/lib/pgsql/16/data/pg_hba.conf

sudo vi /var/lib/pgsql/16/data/pg_hba.conf
```

아래 줄 추가:
```
local   taskflow   taskflow                  md5
host    taskflow   taskflow   127.0.0.1/32   md5
```

## postgresql.conf

```bash
sudo vi /var/lib/pgsql/16/data/postgresql.conf
```

```ini
listen_addresses = 'localhost'   # 외부 노출 차단
port = 5432

shared_buffers   = 256MB         # RAM 25%
effective_cache_size = 512MB     # RAM 50%
max_connections  = 100
```

## 설정 적용

```bash
sudo systemctl reload postgresql-16
```

## 접속 테스트

```bash
psql -U taskflow -d taskflow -h 127.0.0.1
# \conninfo 로 연결 확인
```
