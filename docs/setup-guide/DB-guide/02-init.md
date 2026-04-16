# DB·유저 초기화

## 클러스터 초기화 및 서비스 시작

```bash
sudo /usr/pgsql-16/bin/postgresql-16-setup initdb
sudo systemctl enable postgresql-16
sudo systemctl start postgresql-16
sudo systemctl status postgresql-16
```

## DB 및 유저 생성

```bash
sudo -u postgres psql
```

```sql
CREATE USER taskflow WITH PASSWORD 'your_secure_password';

CREATE DATABASE taskflow
  OWNER     = taskflow
  ENCODING  = 'UTF8'
  LC_COLLATE = 'ko_KR.UTF-8'
  LC_CTYPE   = 'ko_KR.UTF-8'
  TEMPLATE  = template0;

GRANT ALL PRIVILEGES ON DATABASE taskflow TO taskflow;

\l taskflow
\q
```

> `ko_KR.UTF-8` locale 없으면 `en_US.UTF-8` 또는 `C` 사용.  
> 확인: `locale -a | grep ko`
