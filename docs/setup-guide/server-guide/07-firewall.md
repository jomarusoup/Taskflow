# 방화벽 설정

```bash
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https   # SSL 적용 후
sudo firewall-cmd --reload
sudo firewall-cmd --list-all
```

> 8080 포트는 Nginx가 프록시하므로 **외부 노출 불필요**.  
> 직접 테스트 시에만 임시로 추가:
> ```bash
> sudo firewall-cmd --add-port=8080/tcp   # --permanent 없이 임시 적용
> ```
