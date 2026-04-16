-- v1 localStorage → v2 PostgreSQL 마이그레이션
-- 브라우저에서 export한 JSON을 임시 테이블로 import 후 변환

-- 임시 테이블 (JSON import용)
CREATE TEMP TABLE v1_import (data JSONB);

-- 사용 방법:
-- 1. Taskflow v1에서 설정 → 내보내기(Export) 실행 → JSON 파일 저장
-- 2. psql에서 아래 명령 실행:
--    \copy v1_import(data) FROM '/path/to/export.json'
-- 3. 이 스크립트 나머지 부분 실행

-- 마이그레이션 실행 유저 (admin 계정 먼저 생성 필요)
DO $$
DECLARE
  admin_id UUID;
BEGIN
  SELECT id INTO admin_id FROM users WHERE role = 'admin' LIMIT 1;
  IF admin_id IS NULL THEN
    RAISE EXCEPTION 'admin 계정을 먼저 생성하세요 (001_init.sql 후 INSERT INTO users)';
  END IF;

  -- contacts 마이그레이션
  INSERT INTO contacts (id, created_by, name, company, title, categories, category_roles, office_phone, mobile_phone, email, memo)
  SELECT
    uuid_generate_v4(),
    admin_id,
    c->>'name',
    c->>'company',
    c->>'title',
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(c->'categories', '[]'::jsonb))),
    COALESCE(c->'categoryRoles', '[]'::jsonb),
    c->>'officePhone',
    c->>'mobilePhone',
    c->>'email',
    c->>'memo'
  FROM v1_import, jsonb_array_elements(data->'contacts') AS c
  ON CONFLICT DO NOTHING;

  -- tasks 마이그레이션
  INSERT INTO tasks (id, created_by, title, category, priority, status, tags, start_date, due_date, completed_at, memo)
  SELECT
    uuid_generate_v4(),
    admin_id,
    t->>'title',
    t->>'category',
    COALESCE(t->>'priority', 'medium'),
    COALESCE(t->>'status', 'todo'),
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(t->'tags', '[]'::jsonb))),
    NULLIF(t->>'startDate', '')::DATE,
    NULLIF(t->>'dueDate', '')::DATE,
    NULLIF(t->>'completedAt', '')::TIMESTAMPTZ,
    t->>'memo'
  FROM v1_import, jsonb_array_elements(data->'tasks') AS t
  ON CONFLICT DO NOTHING;

  RAISE NOTICE '마이그레이션 완료';
END $$;
