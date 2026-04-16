# 배포 업데이트 절차

## 배포 스크립트

```bash
vi /opt/taskflow/scripts/deploy.sh
```

```bash
#!/bin/bash
set -e

echo "=== 배포 시작: $(date) ==="

cd /opt/taskflow
git pull origin main

# 백엔드 재빌드
cd backend
go mod tidy
go build -o bin/taskflow ./cmd/api
echo "✓ 백엔드 빌드 완료"

# 프론트엔드 재빌드
cd ../frontend
npm install
npm run build
echo "✓ 프론트엔드 빌드 완료"

# 서비스 재시작
sudo systemctl restart taskflow
sudo systemctl status taskflow --no-pager

echo "=== 배포 완료: $(date) ==="
```

```bash
chmod +x /opt/taskflow/scripts/deploy.sh
/opt/taskflow/scripts/deploy.sh
```
