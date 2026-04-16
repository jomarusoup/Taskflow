# Node.js 설치

## 버전 확인

```bash
node --version   # v20.x.x 이상
npm --version    # 10.x.x 이상
```

## nvm으로 설치 (권장)

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc

nvm install 20
nvm use 20
nvm alias default 20
```

## dnf로 설치

```bash
sudo dnf module enable nodejs:20 -y
sudo dnf install -y nodejs npm
```
