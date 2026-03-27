-- ============================================
-- Paike SaaS 排课系统 - 多租户 RLS 安全策略加固脚本
-- 执行方式：在 Supabase SQL Editor 中运行
-- ============================================

-- 1. 删除旧的防匿名策略或全开放策略
DROP POLICY IF EXISTS "semesters_select" ON semesters;
DROP POLICY IF EXISTS "teachers_select" ON teachers;
DROP POLICY IF EXISTS "teachers_insert" ON teachers;
DROP POLICY IF EXISTS "teachers_update" ON teachers;
DROP POLICY IF EXISTS "teachers_delete" ON teachers;

DROP POLICY IF EXISTS "class_groups_select" ON class_groups;
DROP POLICY IF EXISTS "class_groups_insert" ON class_groups;
DROP POLICY IF EXISTS "class_groups_update" ON class_groups;
DROP POLICY IF EXISTS "class_groups_delete" ON class_groups;

DROP POLICY IF EXISTS "rooms_select" ON rooms;
DROP POLICY IF EXISTS "rooms_insert" ON rooms;
DROP POLICY IF EXISTS "rooms_update" ON rooms;
DROP POLICY IF EXISTS "rooms_delete" ON rooms;

DROP POLICY IF EXISTS "course_plans_select" ON course_plans;
DROP POLICY IF EXISTS "course_plans_insert" ON course_plans;
DROP POLICY IF EXISTS "course_plans_update" ON course_plans;
DROP POLICY IF EXISTS "course_plans_delete" ON course_plans;

DROP POLICY IF EXISTS "schedule_rules_select" ON schedule_rules;
DROP POLICY IF EXISTS "schedule_rules_insert" ON schedule_rules;
DROP POLICY IF EXISTS "schedule_rules_update" ON schedule_rules;
DROP POLICY IF EXISTS "schedule_rules_delete" ON schedule_rules;

DROP POLICY IF EXISTS "schedule_plans_select" ON schedule_plans;
DROP POLICY IF EXISTS "schedule_plans_insert" ON schedule_plans;
DROP POLICY IF EXISTS "schedule_plans_update" ON schedule_plans;
DROP POLICY IF EXISTS "schedule_plans_delete" ON schedule_plans;

DROP POLICY IF EXISTS "schedule_slots_select" ON schedule_slots;
DROP POLICY IF EXISTS "schedule_slots_insert" ON schedule_slots;
DROP POLICY IF EXISTS "schedule_slots_update" ON schedule_slots;
DROP POLICY IF EXISTS "schedule_slots_delete" ON schedule_slots;


-- ====== 模式 SaaS: Java Custom JWT 与 多租户强制绑定 ======

-- *所有的操作，前提必须是 JWT 中带有的 tenant_id 和要操作的数据行的 tenant_id 一致*

-- 1. Semesters (学期配置应当只有拥有 admin 角色才能修改)
CREATE POLICY "tenant_isolation_semesters_select" ON semesters FOR SELECT USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
CREATE POLICY "tenant_isolation_semesters_insert" ON semesters FOR INSERT WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid AND auth.jwt() ->> 'user_role' = 'admin');
CREATE POLICY "tenant_isolation_semesters_update" ON semesters FOR UPDATE USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid AND auth.jwt() ->> 'user_role' = 'admin');
CREATE POLICY "tenant_isolation_semesters_delete" ON semesters FOR DELETE USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid AND auth.jwt() ->> 'user_role' = 'admin');

-- 2. Teachers
CREATE POLICY "tenant_isolation_teachers_select" ON teachers FOR SELECT USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
CREATE POLICY "tenant_isolation_teachers_insert" ON teachers FOR INSERT WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid AND auth.jwt() ->> 'user_role' = 'admin');
CREATE POLICY "tenant_isolation_teachers_update" ON teachers FOR UPDATE USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid AND auth.jwt() ->> 'user_role' = 'admin');
CREATE POLICY "tenant_isolation_teachers_delete" ON teachers FOR DELETE USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid AND auth.jwt() ->> 'user_role' = 'admin');

-- 3. Class Groups
CREATE POLICY "tenant_isolation_class_groups_select" ON class_groups FOR SELECT USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
CREATE POLICY "tenant_isolation_class_groups_insert" ON class_groups FOR INSERT WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid AND auth.jwt() ->> 'user_role' = 'admin');
CREATE POLICY "tenant_isolation_class_groups_update" ON class_groups FOR UPDATE USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid AND auth.jwt() ->> 'user_role' = 'admin');
CREATE POLICY "tenant_isolation_class_groups_delete" ON class_groups FOR DELETE USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid AND auth.jwt() ->> 'user_role' = 'admin');

-- 4. Rooms
CREATE POLICY "tenant_isolation_rooms_select" ON rooms FOR SELECT USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
CREATE POLICY "tenant_isolation_rooms_insert" ON rooms FOR INSERT WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid AND auth.jwt() ->> 'user_role' = 'admin');
CREATE POLICY "tenant_isolation_rooms_update" ON rooms FOR UPDATE USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid AND auth.jwt() ->> 'user_role' = 'admin');
CREATE POLICY "tenant_isolation_rooms_delete" ON rooms FOR DELETE USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid AND auth.jwt() ->> 'user_role' = 'admin');

-- 5. Course Plans
CREATE POLICY "tenant_isolation_course_plans_select" ON course_plans FOR SELECT USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
CREATE POLICY "tenant_isolation_course_plans_insert" ON course_plans FOR INSERT WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid AND auth.jwt() ->> 'user_role' = 'admin');
CREATE POLICY "tenant_isolation_course_plans_update" ON course_plans FOR UPDATE USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid AND auth.jwt() ->> 'user_role' = 'admin');
CREATE POLICY "tenant_isolation_course_plans_delete" ON course_plans FOR DELETE USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid AND auth.jwt() ->> 'user_role' = 'admin');

-- 6. Schedule Rules
CREATE POLICY "tenant_isolation_schedule_rules_select" ON schedule_rules FOR SELECT USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
CREATE POLICY "tenant_isolation_schedule_rules_insert" ON schedule_rules FOR INSERT WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid AND auth.jwt() ->> 'user_role' = 'admin');
CREATE POLICY "tenant_isolation_schedule_rules_update" ON schedule_rules FOR UPDATE USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid AND auth.jwt() ->> 'user_role' = 'admin');
CREATE POLICY "tenant_isolation_schedule_rules_delete" ON schedule_rules FOR DELETE USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid AND auth.jwt() ->> 'user_role' = 'admin');

-- 7. Schedule Plans
CREATE POLICY "tenant_isolation_schedule_plans_select" ON schedule_plans FOR SELECT USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
CREATE POLICY "tenant_isolation_schedule_plans_insert" ON schedule_plans FOR INSERT WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid AND auth.jwt() ->> 'user_role' = 'admin');
CREATE POLICY "tenant_isolation_schedule_plans_update" ON schedule_plans FOR UPDATE USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid AND auth.jwt() ->> 'user_role' = 'admin');
CREATE POLICY "tenant_isolation_schedule_plans_delete" ON schedule_plans FOR DELETE USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid AND auth.jwt() ->> 'user_role' = 'admin');

-- 8. Schedule Slots
CREATE POLICY "tenant_isolation_schedule_slots_select" ON schedule_slots FOR SELECT USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
CREATE POLICY "tenant_isolation_schedule_slots_insert" ON schedule_slots FOR INSERT WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid AND auth.jwt() ->> 'user_role' = 'admin');
CREATE POLICY "tenant_isolation_schedule_slots_update" ON schedule_slots FOR UPDATE USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid AND auth.jwt() ->> 'user_role' = 'admin');
CREATE POLICY "tenant_isolation_schedule_slots_delete" ON schedule_slots FOR DELETE USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid AND auth.jwt() ->> 'user_role' = 'admin');
