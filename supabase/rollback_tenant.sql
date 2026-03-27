-- 回滚所有多租户字段
ALTER TABLE semesters DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE teachers DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE class_groups DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE rooms DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE course_plans DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE schedule_rules DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE schedule_plans DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE schedule_slots DROP COLUMN IF EXISTS tenant_id;
