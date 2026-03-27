-- ============================================
-- Paike K12 排课系统 - 终极单机版一键回退脚本
-- 修复策略重复创建或依赖删除的 2BP01 / 42710 报错
-- ============================================

-- 1. 删除所有租户相关的字段（CASCADE 会连带删除所有依赖该字段的 auth policy 多租户策略）
ALTER TABLE semesters DROP COLUMN IF EXISTS tenant_id CASCADE;
ALTER TABLE teachers DROP COLUMN IF EXISTS tenant_id CASCADE;
ALTER TABLE class_groups DROP COLUMN IF EXISTS tenant_id CASCADE;
ALTER TABLE rooms DROP COLUMN IF EXISTS tenant_id CASCADE;
ALTER TABLE course_plans DROP COLUMN IF EXISTS tenant_id CASCADE;
ALTER TABLE schedule_rules DROP COLUMN IF EXISTS tenant_id CASCADE;
ALTER TABLE schedule_plans DROP COLUMN IF EXISTS tenant_id CASCADE;
ALTER TABLE schedule_slots DROP COLUMN IF EXISTS tenant_id CASCADE;

-- 2. 清理旧策略防止冲突 (Idempotent 幂等操作)
DROP POLICY IF EXISTS "semesters_select" ON semesters;

DROP POLICY IF EXISTS "teachers_insert" ON teachers;
DROP POLICY IF EXISTS "teachers_select" ON teachers;
DROP POLICY IF EXISTS "teachers_update" ON teachers;
DROP POLICY IF EXISTS "teachers_delete" ON teachers;

DROP POLICY IF EXISTS "class_groups_insert" ON class_groups;
DROP POLICY IF EXISTS "class_groups_select" ON class_groups;
DROP POLICY IF EXISTS "class_groups_update" ON class_groups;
DROP POLICY IF EXISTS "class_groups_delete" ON class_groups;

DROP POLICY IF EXISTS "rooms_insert" ON rooms;
DROP POLICY IF EXISTS "rooms_select" ON rooms;
DROP POLICY IF EXISTS "rooms_update" ON rooms;
DROP POLICY IF EXISTS "rooms_delete" ON rooms;

DROP POLICY IF EXISTS "course_plans_insert" ON course_plans;
DROP POLICY IF EXISTS "course_plans_select" ON course_plans;
DROP POLICY IF EXISTS "course_plans_update" ON course_plans;
DROP POLICY IF EXISTS "course_plans_delete" ON course_plans;

DROP POLICY IF EXISTS "schedule_rules_insert" ON schedule_rules;
DROP POLICY IF EXISTS "schedule_rules_select" ON schedule_rules;
DROP POLICY IF EXISTS "schedule_rules_update" ON schedule_rules;
DROP POLICY IF EXISTS "schedule_rules_delete" ON schedule_rules;

DROP POLICY IF EXISTS "schedule_plans_insert" ON schedule_plans;
DROP POLICY IF EXISTS "schedule_plans_select" ON schedule_plans;
DROP POLICY IF EXISTS "schedule_plans_update" ON schedule_plans;
DROP POLICY IF EXISTS "schedule_plans_delete" ON schedule_plans;

DROP POLICY IF EXISTS "schedule_slots_insert" ON schedule_slots;
DROP POLICY IF EXISTS "schedule_slots_select" ON schedule_slots;
DROP POLICY IF EXISTS "schedule_slots_update" ON schedule_slots;
DROP POLICY IF EXISTS "schedule_slots_delete" ON schedule_slots;


-- 3. 重建回退后的单机版 RLS 策略 (允许所有匿名改写，仅防止恶意 DELETE 全表)
CREATE POLICY "semesters_select" ON semesters FOR SELECT USING (true);

-- teachers
CREATE POLICY "teachers_insert" ON teachers FOR INSERT WITH CHECK (true);
CREATE POLICY "teachers_select" ON teachers FOR SELECT USING (true);
CREATE POLICY "teachers_update" ON teachers FOR UPDATE USING (true);
CREATE POLICY "teachers_delete" ON teachers FOR DELETE USING (false);

-- class_groups
CREATE POLICY "class_groups_insert" ON class_groups FOR INSERT WITH CHECK (true);
CREATE POLICY "class_groups_select" ON class_groups FOR SELECT USING (true);
CREATE POLICY "class_groups_update" ON class_groups FOR UPDATE USING (true);
CREATE POLICY "class_groups_delete" ON class_groups FOR DELETE USING (false);

-- rooms
CREATE POLICY "rooms_insert" ON rooms FOR INSERT WITH CHECK (true);
CREATE POLICY "rooms_select" ON rooms FOR SELECT USING (true);
CREATE POLICY "rooms_update" ON rooms FOR UPDATE USING (true);
CREATE POLICY "rooms_delete" ON rooms FOR DELETE USING (false);

-- course_plans
CREATE POLICY "course_plans_insert" ON course_plans FOR INSERT WITH CHECK (true);
CREATE POLICY "course_plans_select" ON course_plans FOR SELECT USING (true);
CREATE POLICY "course_plans_update" ON course_plans FOR UPDATE USING (true);
CREATE POLICY "course_plans_delete" ON course_plans FOR DELETE USING (false);

-- schedule_rules
CREATE POLICY "schedule_rules_insert" ON schedule_rules FOR INSERT WITH CHECK (true);
CREATE POLICY "schedule_rules_select" ON schedule_rules FOR SELECT USING (true);
CREATE POLICY "schedule_rules_update" ON schedule_rules FOR UPDATE USING (true);
CREATE POLICY "schedule_rules_delete" ON schedule_rules FOR DELETE USING (false);

-- schedule_plans
CREATE POLICY "schedule_plans_insert" ON schedule_plans FOR INSERT WITH CHECK (true);
CREATE POLICY "schedule_plans_select" ON schedule_plans FOR SELECT USING (true);
CREATE POLICY "schedule_plans_update" ON schedule_plans FOR UPDATE USING (true);
CREATE POLICY "schedule_plans_delete" ON schedule_plans FOR DELETE USING (false);

-- schedule_slots
CREATE POLICY "schedule_slots_insert" ON schedule_slots FOR INSERT WITH CHECK (true);
CREATE POLICY "schedule_slots_select" ON schedule_slots FOR SELECT USING (true);
CREATE POLICY "schedule_slots_update" ON schedule_slots FOR UPDATE USING (true);
CREATE POLICY "schedule_slots_delete" ON schedule_slots FOR DELETE USING (false);
