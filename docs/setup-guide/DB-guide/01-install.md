# PostgreSQL 설치

## 공식 레포 추가 및 설치

```bash
# 레포 추가
sudo dnf install -y https://download.postgresql.org/pub/repos/yum/reporpms/EL-8-x86_64/pgdg-redhat-repo-latest.noarch.rpm

# 기본 모듈 비활성화 (버전 충돌 방지)
sudo dnf -qy module disable postgresql

# 설치
sudo dnf install -y postgresql16-server postgresql16 postgresql16-contrib

# 확인
psql --version
```

## 내부망 환경

```bash
# 외부 PC에서 rpm 다운로드 후 서버로 전송
# https://download.postgresql.org/pub/repos/yum/16/redhat/rhel-8-x86_64/
scp postgresql16-*.rpm user@server:/tmp/
sudo dnf install -y /tmp/postgresql16-*.rpm
```
