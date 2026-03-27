-- ============================================
-- Paike SaaS: 多租户隔离 (Multi-Tenancy) 改造补丁
-- 适用场景：已部署过老版本 init.sql 的数据库，用于自动叠加 tenant_id 且不丢失数据
-- ============================================

-- 1. 创建特殊的默认公有租户 UUID (解决现有存量数据的 NOT NULL 冲突)
DO $$
BEGIN
    -- 尝试为所有表添加 tenant_id 字段。旧数据将默认并绑定到全零 UUID
    -- 注意：如果表还没有创建，这里的 ALTER 会给出 Notice，不妨碍后续脚本
    ALTER TABLE IF EXISTS semesters ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid;
    ALTER TABLE IF EXISTS teachers ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid;
    ALTER TABLE IF EXISTS class_groups ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid;
    ALTER TABLE IF EXISTS rooms ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid;
    ALTER TABLE IF EXISTS course_plans ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid;
    ALTER TABLE IF EXISTS schedule_plans ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid;
    ALTER TABLE IF EXISTS schedule_slots ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid;
    ALTER TABLE IF EXISTS schedule_rules ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid;
END $$;

-- 2. 去除 DEFAULT 约束，因为之后 SaaS 插入数据必须通过 Java 端透传真正的 tenant_id
ALTER TABLE IF EXISTS semesters ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE IF EXISTS teachers ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE IF EXISTS class_groups ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE IF EXISTS rooms ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE IF EXISTS course_plans ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE IF EXISTS schedule_plans ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE IF EXISTS schedule_slots ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE IF EXISTS schedule_rules ALTER COLUMN tenant_id DROP DEFAULT;

-- 3. 对 tenant_id 建立索引以优化 SaaS 场景下根据机构查询的性能
CREATE INDEX IF NOT EXISTS idx_semesters_tenant ON semesters(tenant_id);
CREATE INDEX IF NOT EXISTS idx_teachers_tenant ON teachers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_class_groups_tenant ON class_groups(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rooms_tenant ON rooms(tenant_id);
CREATE INDEX IF NOT EXISTS idx_course_plans_tenant ON course_plans(tenant_id);
CREATE INDEX IF NOT EXISTS idx_schedule_plans_tenant ON schedule_plans(tenant_id);
CREATE INDEX IF NOT EXISTS idx_schedule_slots_tenant ON schedule_slots(tenant_id);
CREATE INDEX IF NOT EXISTS idx_schedule_rules_tenant ON schedule_rules(tenant_id);
