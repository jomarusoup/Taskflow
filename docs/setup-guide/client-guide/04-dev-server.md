# 개발 서버 실행

> Go 백엔드(:8080)가 실행 중이어야 `/api/*` 프록시가 동작한다.

```bash
cd /opt/taskflow/frontend
npm run dev
# → http://localhost:3000
```

## 동시 실행 순서

```bash
# 터미널 1 — DB
sudo systemctl start postgresql-16

# 터미널 2 — Go 백엔드
cd /opt/taskflow/backend
./bin/taskflow

# 터미널 3 — 프론트엔드
cd /opt/taskflow/frontend
npm run dev
```
