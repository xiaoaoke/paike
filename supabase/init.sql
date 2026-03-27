-- ============================================
-- K12 排课系统 - Supabase 数据库初始化脚本
-- 在 Supabase Dashboard -> SQL Editor 中运行
-- ============================================

-- 1. 学期设置
CREATE TABLE IF NOT EXISTS semesters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. 教师
CREATE TABLE IF NOT EXISTS teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id TEXT UNIQUE,
  name TEXT NOT NULL,
  subjects TEXT[] NOT NULL DEFAULT '{}',
  max_weekly_hours INT DEFAULT 12,
  phone TEXT,
  email TEXT,
  color TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. 班级
CREATE TABLE IF NOT EXISTS class_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  grade INT NOT NULL,
  head_teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
  student_count INT DEFAULT 0,
  academic_year TEXT,
  semester_id UUID REFERENCES semesters(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. 教室
CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  room_number TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT '普通教室',
  capacity INT NOT NULL DEFAULT 50,
  building TEXT,
  floor INT,
  facilities TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. 课程计划
CREATE TABLE IF NOT EXISTS course_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES class_groups(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  weekly_hours INT NOT NULL DEFAULT 4,
  room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
  semester_id UUID REFERENCES semesters(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. 排课规则
CREATE TABLE IF NOT EXISTS schedule_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  semester_id UUID REFERENCES semesters(id) ON DELETE CASCADE,
  rule_type TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  enabled BOOLEAN DEFAULT true,
  priority TEXT DEFAULT 'medium',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. 排课方案
CREATE TABLE IF NOT EXISTS schedule_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  semester_id UUID REFERENCES semesters(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 8. 排课时间槽
CREATE TABLE IF NOT EXISTS schedule_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES schedule_plans(id) ON DELETE CASCADE,
  day INT NOT NULL CHECK (day >= 0 AND day <= 6),
  period INT NOT NULL CHECK (period >= 0 AND period <= 7),
  course_plan_id UUID NOT NULL REFERENCES course_plans(id) ON DELETE CASCADE,
  room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
  is_locked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(plan_id, day, period, course_plan_id)
);

-- ====== 启用 RLS (Row Level Security) ======
ALTER TABLE semesters ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_slots ENABLE ROW LEVEL SECURITY;

-- 创建基本的安全策略 (允许所有操作但禁止删除)
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

-- 创建必要的索引优化查询性能
CREATE INDEX IF NOT EXISTS idx_course_plans_class ON course_plans(class_id);
CREATE INDEX IF NOT EXISTS idx_course_plans_teacher ON course_plans(teacher_id);
CREATE INDEX IF NOT EXISTS idx_schedule_slots_plan ON schedule_slots(plan_id);
CREATE INDEX IF NOT EXISTS idx_schedule_slots_course ON schedule_slots(course_plan_id);
CREATE INDEX IF NOT EXISTS idx_schedule_slots_room ON schedule_slots(room_id);
