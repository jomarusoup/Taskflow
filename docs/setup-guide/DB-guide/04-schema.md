# 스키마 상세

스키마 파일: `backend/migrations/001_init.sql`

## 주요 테이블

### users
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | UUID PK | |
| username | VARCHAR(50) UNIQUE | 로그인 ID |
| password_hash | TEXT | bcrypt 해시 |
| display_name | VARCHAR(100) | 화면 표시명 |
| role | VARCHAR(20) | admin \| member |

### tasks
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | UUID PK | |
| created_by | UUID → users | |
| title | TEXT | |
| category | TEXT | |
| priority | VARCHAR(20) | high \| medium \| low |
| status | VARCHAR(20) | todo \| in_progress \| done |
| tags | TEXT[] | 배열 타입 |
| start_date / due_date | DATE | |
| memo | TEXT | |

### contacts
| 컬럼 | 타입 | 설명 |
|---|---|---|
| categories | TEXT[] | 다중 카테고리 |
| category_roles | JSONB | `[{category, role}]` |
| office_phone / mobile_phone | VARCHAR(50) | |

### inventory (자산관리)

```
inventory_ledgers (원장)
  └── inventory_tabs (탭)
        └── inventory_columns (컬럼 정의: 이름·타입·옵션)
  └── inventory_rows (행)
        └── inventory_cells (셀 값)
        └── asset_histories (변경 이력)
```

`asset_histories`: 누가(changed_by) 언제(changed_at) 어떤 필드(col_id)를 무엇에서(old_value) 무엇으로(new_value) 바꿨는지 기록.

## 스키마 적용

```bash
psql -U taskflow -d taskflow -h 127.0.0.1 \
  -f /opt/taskflow/backend/migrations/001_init.sql
```
