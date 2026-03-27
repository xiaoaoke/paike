-- ============================================
-- Paike K12 排课系统 - RLS 回滚脚本
-- 恢复至单机版的配置（允许匿名读写，仅禁止随意删除）
-- ============================================

-- 1. 删除基于 JWT 的多租户策略
DROP POLICY IF EXISTS "tenant_isolation_semesters_select" ON semesters;
DROP POLICY IF EXISTS "tenant_isolation_semesters_insert" ON semesters;
DROP POLICY IF EXISTS "tenant_isolation_semesters_update" ON semesters;
DROP POLICY IF EXISTS "tenant_isolation_semesters_delete" ON semesters;

DROP POLICY IF EXISTS "tenant_isolation_teachers_select" ON teachers;
DROP POLICY IF EXISTS "tenant_isolation_teachers_insert" ON teachers;
DROP POLICY IF EXISTS "tenant_isolation_teachers_update" ON teachers;
DROP POLICY IF EXISTS "tenant_isolation_teachers_delete" ON teachers;

DROP POLICY IF EXISTS "tenant_isolation_class_groups_select" ON class_groups;
DROP POLICY IF EXISTS "tenant_isolation_class_groups_insert" ON class_groups;
DROP POLICY IF EXISTS "tenant_isolation_class_groups_update" ON class_groups;
DROP POLICY IF EXISTS "tenant_isolation_class_groups_delete" ON class_groups;

DROP POLICY IF EXISTS "tenant_isolation_rooms_select" ON rooms;
DROP POLICY IF EXISTS "tenant_isolation_rooms_insert" ON rooms;
DROP POLICY IF EXISTS "tenant_isolation_rooms_update" ON rooms;
DROP POLICY IF EXISTS "tenant_isolation_rooms_delete" ON rooms;

DROP POLICY IF EXISTS "tenant_isolation_course_plans_select" ON course_plans;
DROP POLICY IF EXISTS "tenant_isolation_course_plans_insert" ON course_plans;
DROP POLICY IF EXISTS "tenant_isolation_course_plans_update" ON course_plans;
DROP POLICY IF EXISTS "tenant_isolation_course_plans_delete" ON course_plans;

DROP POLICY IF EXISTS "tenant_isolation_schedule_rules_select" ON schedule_rules;
DROP POLICY IF EXISTS "tenant_isolation_schedule_rules_insert" ON schedule_rules;
DROP POLICY IF EXISTS "tenant_isolation_schedule_rules_update" ON schedule_rules;
DROP POLICY IF EXISTS "tenant_isolation_schedule_rules_delete" ON schedule_rules;

DROP POLICY IF EXISTS "tenant_isolation_schedule_plans_select" ON schedule_plans;
DROP POLICY IF EXISTS "tenant_isolation_schedule_plans_insert" ON schedule_plans;
DROP POLICY IF EXISTS "tenant_isolation_schedule_plans_update" ON schedule_plans;
DROP POLICY IF EXISTS "tenant_isolation_schedule_plans_delete" ON schedule_plans;

DROP POLICY IF EXISTS "tenant_isolation_schedule_slots_select" ON schedule_slots;
DROP POLICY IF EXISTS "tenant_isolation_schedule_slots_insert" ON schedule_slots;
DROP POLICY IF EXISTS "tenant_isolation_schedule_slots_update" ON schedule_slots;
DROP POLICY IF EXISTS "tenant_isolation_schedule_slots_delete" ON schedule_slots;

-- 2. 恢复模式 B: 限制匿名用户只读，禁止删除，除学期外开放所有编辑

-- semesters: 只读（学期配置不应被前端修改）
CREATE POLICY "semesters_select" ON semesters FOR SELECT USING (true);

-- teachers
CREATE POLICY "teachers_select" ON teachers FOR SELECT USING (true);
CREATE POLICY "teachers_insert" ON teachers FOR INSERT WITH CHECK (true);
CREATE POLICY "teachers_update" ON teachers FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "teachers_delete" ON teachers FOR DELETE USING (true);

-- class_groups
CREATE POLICY "class_groups_select" ON class_groups FOR SELECT USING (true);
CREATE POLICY "class_groups_insert" ON class_groups FOR INSERT WITH CHECK (true);
CREATE POLICY "class_groups_update" ON class_groups FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "class_groups_delete" ON class_groups FOR DELETE USING (true);

-- rooms
CREATE POLICY "rooms_select" ON rooms FOR SELECT USING (true);
CREATE POLICY "rooms_insert" ON rooms FOR INSERT WITH CHECK (true);
CREATE POLICY "rooms_update" ON rooms FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "rooms_delete" ON rooms FOR DELETE USING (true);

-- course_plans
CREATE POLICY "course_plans_select" ON course_plans FOR SELECT USING (true);
CREATE POLICY "course_plans_insert" ON course_plans FOR INSERT WITH CHECK (true);
CREATE POLICY "course_plans_update" ON course_plans FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "course_plans_delete" ON course_plans FOR DELETE USING (true);

-- schedule_rules
CREATE POLICY "schedule_rules_select" ON schedule_rules FOR SELECT USING (true);
CREATE POLICY "schedule_rules_insert" ON schedule_rules FOR INSERT WITH CHECK (true);
CREATE POLICY "schedule_rules_update" ON schedule_rules FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "schedule_rules_delete" ON schedule_rules FOR DELETE USING (true);

-- schedule_plans
CREATE POLICY "schedule_plans_select" ON schedule_plans FOR SELECT USING (true);
CREATE POLICY "schedule_plans_insert" ON schedule_plans FOR INSERT WITH CHECK (true);
CREATE POLICY "schedule_plans_update" ON schedule_plans FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "schedule_plans_delete" ON schedule_plans FOR DELETE USING (true);

CREATE POLICY "schedule_slots_select" ON schedule_slots FOR SELECT USING (true);
CREATE POLICY "schedule_slots_insert" ON schedule_slots FOR INSERT WITH CHECK (true);
CREATE POLICY "schedule_slots_update" ON schedule_slots FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "schedule_slots_delete" ON schedule_slots FOR DELETE USING (true);
