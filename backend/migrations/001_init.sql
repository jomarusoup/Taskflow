-- Taskflow v2 초기 스키마
-- 실행: psql -U postgres -d taskflow -f 001_init.sql

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 사용자
CREATE TABLE users (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username     VARCHAR(50) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name VARCHAR(100),
  role         VARCHAR(20) NOT NULL DEFAULT 'member', -- admin | member
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 업무
CREATE TABLE tasks (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_by   UUID NOT NULL REFERENCES users(id),
  title        TEXT NOT NULL,
  category     TEXT,
  priority     VARCHAR(20) NOT NULL DEFAULT 'medium',
  status       VARCHAR(20) NOT NULL DEFAULT 'todo',
  tags         TEXT[] NOT NULL DEFAULT '{}',
  start_date   DATE,
  due_date     DATE,
  completed_at TIMESTAMPTZ,
  memo         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 업무 담당자 (다대다)
CREATE TABLE task_assignees (
  task_id    UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, contact_id)
);

-- 업무 연결 (양방향)
CREATE TABLE task_links (
  task_id        UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  linked_task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, linked_task_id)
);

-- 연락처
CREATE TABLE contacts (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_by     UUID NOT NULL REFERENCES users(id),
  name           VARCHAR(100) NOT NULL,
  company        VARCHAR(100),
  title          VARCHAR(100),
  categories     TEXT[] NOT NULL DEFAULT '{}',
  category_roles JSONB NOT NULL DEFAULT '[]', -- [{category, role}]
  office_phone   VARCHAR(50),
  mobile_phone   VARCHAR(50),
  email          VARCHAR(200),
  memo           TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 월간업무 (recurring)
CREATE TABLE recurring_tasks (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_by UUID NOT NULL REFERENCES users(id),
  title      TEXT NOT NULL,
  category   TEXT,
  memo       TEXT,
  order_idx  INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 연간업무
CREATE TABLE annual_tasks (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_by UUID NOT NULL REFERENCES users(id),
  title      TEXT NOT NULL,
  category   TEXT,
  memo       TEXT,
  months     INT[] NOT NULL DEFAULT '{}', -- 해당 월 배열
  order_idx  INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 일정 (schedules)
CREATE TABLE schedules (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_by  UUID NOT NULL REFERENCES users(id),
  title       TEXT NOT NULL,
  start_date  DATE NOT NULL,
  end_date    DATE,
  start_time  TIME,
  end_time    TIME,
  category    TEXT,
  memo        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인벤토리 원장
CREATE TABLE inventory_ledgers (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_by UUID NOT NULL REFERENCES users(id),
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인벤토리 탭
CREATE TABLE inventory_tabs (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ledger_id  UUID NOT NULL REFERENCES inventory_ledgers(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  color      VARCHAR(20),
  order_idx  INT NOT NULL DEFAULT 0
);

-- 인벤토리 컬럼 정의
CREATE TABLE inventory_columns (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tab_id    UUID NOT NULL REFERENCES inventory_tabs(id) ON DELETE CASCADE,
  name      TEXT NOT NULL,
  col_type  VARCHAR(20) NOT NULL DEFAULT 'text', -- text | select | date | number
  metadata  JSONB NOT NULL DEFAULT '{}',         -- select 옵션 목록 등
  order_idx INT NOT NULL DEFAULT 0
);

-- 인벤토리 행
CREATE TABLE inventory_rows (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ledger_id UUID NOT NULL REFERENCES inventory_ledgers(id) ON DELETE CASCADE,
  order_idx INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인벤토리 셀 데이터
CREATE TABLE inventory_cells (
  row_id    UUID NOT NULL REFERENCES inventory_rows(id) ON DELETE CASCADE,
  col_id    UUID NOT NULL REFERENCES inventory_columns(id) ON DELETE CASCADE,
  value     TEXT,
  PRIMARY KEY (row_id, col_id)
);

-- 자산 변경 이력 (GLPI 수준 감사 로그)
CREATE TABLE asset_histories (
  id         BIGSERIAL PRIMARY KEY,
  row_id     UUID NOT NULL REFERENCES inventory_rows(id) ON DELETE CASCADE,
  col_id     UUID REFERENCES inventory_columns(id) ON DELETE SET NULL,
  changed_by UUID NOT NULL REFERENCES users(id),
  old_value  TEXT,
  new_value  TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 설정
CREATE TABLE settings (
  user_id    UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data       JSONB NOT NULL DEFAULT '{}'
);

-- 인덱스
CREATE INDEX idx_tasks_created_by   ON tasks(created_by);
CREATE INDEX idx_tasks_status        ON tasks(status);
CREATE INDEX idx_tasks_due_date      ON tasks(due_date);
CREATE INDEX idx_contacts_created_by ON contacts(created_by);
CREATE INDEX idx_asset_histories_row ON asset_histories(row_id);
