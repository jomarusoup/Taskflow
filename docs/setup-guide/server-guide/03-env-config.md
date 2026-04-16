# 환경변수 설정

```bash
vi /opt/taskflow/backend/.env
```

```ini
# 서버
APP_PORT=8080
APP_ENV=production        # development | production

# DB
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=taskflow
DB_USER=taskflow
DB_PASSWORD=your_secure_password

# JWT
# 생성: openssl rand -hex 64
JWT_SECRET=your_64char_random_secret_here
JWT_ACCESS_EXPIRE=15m
JWT_REFRESH_EXPIRE=336h   # 14일
```

```bash
# 소유자만 읽기 가능하도록 권한 제한
chmod 600 /opt/taskflow/backend/.env
```
