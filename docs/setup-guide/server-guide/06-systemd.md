# systemd 서비스 등록

## 서비스 전용 유저 생성

```bash
sudo useradd -r -s /sbin/nologin taskflow-svc
sudo chown -R taskflow-svc:taskflow-svc /opt/taskflow/backend
```

## 서비스 파일

```bash
sudo vi /etc/systemd/system/taskflow.service
```

```ini
[Unit]
Description=Taskflow v2 API Server
After=network.target postgresql-16.service
Wants=postgresql-16.service

[Service]
Type=simple
User=taskflow-svc
WorkingDirectory=/opt/taskflow/backend
EnvironmentFile=/opt/taskflow/backend/.env
ExecStart=/opt/taskflow/backend/bin/taskflow
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

## 등록 및 시작

```bash
sudo systemctl daemon-reload
sudo systemctl enable taskflow
sudo systemctl start taskflow
sudo systemctl status taskflow
```

## 로그 확인

```bash
sudo journalctl -u taskflow -f
sudo journalctl -u taskflow --since today
```
