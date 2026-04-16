# DB Guide — PostgreSQL 환경 구성

> PostgreSQL 16 / RHEL·Rocky Linux 8/9

## 목차

| 문서 | 내용 |
|---|---|
| [01-install.md](01-install.md) | PostgreSQL 설치 |
| [02-init.md](02-init.md) | DB·유저 초기화 |
| [03-config.md](03-config.md) | 접속 허용 설정 |
| [04-schema.md](04-schema.md) | 스키마 상세 설명 |
| [05-migration.md](05-migration.md) | v1 데이터 마이그레이션 |
| [06-backup.md](06-backup.md) | 백업 및 복구 |
| [07-ops.md](07-ops.md) | 운영 관리 명령 |

## 테이블 관계 요약

```
users
  ├── tasks ── task_assignees ── contacts
  │        └── task_links
  ├── contacts
  ├── recurring_tasks / annual_tasks / schedules
  ├── settings
  └── inventory_ledgers
        ├── inventory_tabs ── inventory_columns
        └── inventory_rows ── inventory_cells
                           └── asset_histories
```
