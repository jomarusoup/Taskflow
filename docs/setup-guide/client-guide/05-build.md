# 프로덕션 빌드

```bash
cd /opt/taskflow/frontend
npm run build
# → frontend/dist/ 에 결과물 생성
```

Nginx의 `root`가 `frontend/dist`를 가리키므로 빌드 후 즉시 반영된다.

## 배포 스크립트

```bash
#!/bin/bash
# scripts/deploy-frontend.sh
set -e
cd /opt/taskflow
git pull origin main
cd frontend
npm install
npm run build
echo "프론트엔드 배포 완료: $(date)"
```
