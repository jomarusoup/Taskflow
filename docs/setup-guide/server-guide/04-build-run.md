# 빌드 및 실행

## 의존성 설치

```bash
cd /opt/taskflow/backend
go mod tidy
```

## 빌드

```bash
go build -o bin/taskflow ./cmd/api
ls -lh bin/taskflow
```

## 실행

```bash
./bin/taskflow
# INFO  Taskflow API listening on :8080
```

## 개발 중 핫 리로드 (air)

```bash
go install github.com/air-verse/air@latest
cd /opt/taskflow/backend
air
```
