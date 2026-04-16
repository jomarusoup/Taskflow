# Nginx 설치 및 설정

## 설치

```bash
sudo dnf install -y nginx
sudo systemctl enable nginx
```

## 설정 파일

```bash
sudo vi /etc/nginx/conf.d/taskflow.conf
```

```nginx
server {
    listen 80;
    server_name _;

    root  /opt/taskflow/frontend/dist;
    index index.html;

    # SPA 라우팅
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API 프록시
    location /api/ {
        proxy_pass         http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_read_timeout 60s;
    }

    # 보안 헤더
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options        SAMEORIGIN;

    # 정적 파일 장기 캐시 (Vite 해시 파일명)
    location ~* \.(js|css|png|ico|woff2)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

## 적용

```bash
sudo nginx -t           # 문법 검사
sudo systemctl start nginx
```
