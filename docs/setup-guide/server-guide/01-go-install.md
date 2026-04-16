# Go 설치

## 인터넷 연결 환경

```bash
wget https://go.dev/dl/go1.22.4.linux-amd64.tar.gz -O /tmp/go.tar.gz
sudo rm -rf /usr/local/go
sudo tar -C /usr/local -xzf /tmp/go.tar.gz
rm /tmp/go.tar.gz
```

## 내부망 환경

```bash
# 외부 PC에서 다운로드 후 서버로 전송
scp go1.22.4.linux-amd64.tar.gz user@server:/tmp/
sudo tar -C /usr/local -xzf /tmp/go.tar.gz
```

## 환경변수 등록

```bash
cat >> ~/.bashrc << 'EOF'
export PATH=$PATH:/usr/local/go/bin
export GOPATH=$HOME/go
export PATH=$PATH:$GOPATH/bin
EOF
source ~/.bashrc
```

## 확인

```bash
go version
# go version go1.22.4 linux/amd64
```
