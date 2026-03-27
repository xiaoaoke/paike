import { create } from 'zustand';
import { supabase } from './supabaseClient';

// ==================== 类型定义 ====================

export interface Teacher {
  id: string;
  employee_id: string | null;
  name: string;
  subjects: string[];
  max_weekly_hours: number;
  phone: string | null;
  email: string | null;
  color: string | null;
}

export interface ClassGroup {
  id: string;
  name: string;
  grade: number;
  head_teacher_id: string | null;
  student_count: number;
  academic_year: string | null;
  semester_id: string | null;
}



export interface CoursePlan {
  id: string;
  class_id: string;
  teacher_id: string;
  subject: string;
  weekly_hours: number;

  semester_id: string | null;
  academic_year?: string | null;
  semester?: string | null;
  // 前端关联字段
  teacher_name?: string;
  class_name?: string;
}

export interface SchedulePlan {
  id: string;
  name: string;
  semester_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ScheduleSlot {
  id: string;
  plan_id: string;
  day: number;
  period: number;
  course_plan_id: string;

  locked: boolean;
}

export interface ScheduleRule {
  id: string;
  semester_id: string | null;
  rule_type: string;
  config: Record<string, any>;
  enabled: boolean;
  priority: string;
}

export interface Semester {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
}

// ==================== Store ====================

interface AppState {
  // 数据
  semesters: Semester[];
  teachers: Teacher[];
  classGroups: ClassGroup[];

  coursePlans: CoursePlan[];
  schedulePlans: SchedulePlan[];
  scheduleSlots: ScheduleSlot[];
  scheduleRules: ScheduleRule[];

  // 选中状态
  activeSemesterId: string | null;
  activePlanId: string | null;

  // 加载状态
  loading: boolean;
  error: string | null;

  // 初始化
  initialize: () => Promise<void>;

  // 学期
  fetchSemesters: () => Promise<void>;

  // 教师 CRUD
  fetchTeachers: () => Promise<void>;
  addTeacher: (t: Omit<Teacher, 'id'>) => Promise<Teacher | null>;
  updateTeacher: (id: string, t: Partial<Teacher>) => Promise<void>;
  deleteTeacher: (id: string) => Promise<void>;

  // 班级 CRUD
  fetchClassGroups: () => Promise<void>;
  addClassGroup: (c: Omit<ClassGroup, 'id'>) => Promise<ClassGroup | null>;
  updateClassGroup: (id: string, c: Partial<ClassGroup>) => Promise<void>;
  deleteClassGroup: (id: string) => Promise<void>;



  // 课程计划 CRUD
  fetchCoursePlans: () => Promise<void>;
  addCoursePlan: (cp: Omit<CoursePlan, 'id' | 'teacher_name' | 'class_name'>) => Promise<CoursePlan | null>;
  updateCoursePlan: (id: string, cp: Partial<CoursePlan>) => Promise<void>;
  deleteCoursePlan: (id: string) => Promise<void>;

  // 排课方案 CRUD
  fetchSchedulePlans: () => Promise<void>;
  addSchedulePlan: (p: Pick<SchedulePlan, 'name' | 'semester_id'>) => Promise<SchedulePlan | null>;
  updateSchedulePlan: (id: string, p: Partial<SchedulePlan>) => Promise<void>;
  deleteSchedulePlan: (id: string) => Promise<void>;

  // 排课时间槽
  fetchScheduleSlots: (planId: string) => Promise<void>;
  saveScheduleSlots: (planId: string, slots: Omit<ScheduleSlot, 'id'>[]) => Promise<void>;

  // 规则
  fetchScheduleRules: () => Promise<void>;
  saveScheduleRule: (rule: Omit<ScheduleRule, 'id'>) => Promise<ScheduleRule | null>;
  updateScheduleRule: (id: string, rule: Partial<ScheduleRule>) => Promise<void>;
  deleteScheduleRule: (id: string) => Promise<void>;

  // 规则配置表单草稿
  draftRuleConfig: any;
  setDraftRuleConfig: (type: string, config: any) => void;
  initDraftRuleConfig: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  // 初始数据
  semesters: [],
  teachers: [],
  classGroups: [],

  coursePlans: [],
  schedulePlans: [],
  scheduleSlots: [],
  scheduleRules: [],
  activeSemesterId: null,
  activePlanId: null,
  loading: false,
  error: null,
  draftRuleConfig: {},

  // ==================== 初始化 ====================
  initialize: async () => {
    set({ loading: true, error: null });
    try {
      await Promise.all([
        get().fetchSemesters(),
        get().fetchTeachers(),
        get().fetchClassGroups(),

        get().fetchCoursePlans(),
        get().fetchSchedulePlans(),
        get().fetchScheduleRules(),
      ]);
    } catch (err: any) {
      set({ error: err.message });
    } finally {
      set({ loading: false });
    }
  },

  // ==================== 学期 ====================
  fetchSemesters: async () => {
    const { data, error } = await supabase.from('semesters').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    const semesters = data || [];
    const active = semesters.find(s => s.is_active);
    set({ semesters, activeSemesterId: active?.id || null });
  },

  // ==================== 教师 ====================
  fetchTeachers: async () => {
    const { data, error } = await supabase.from('teachers').select('*').order('name');
    if (error) throw error;
    set({ teachers: data || [] });
  },

  addTeacher: async (t) => {
    const { data, error } = await supabase.from('teachers').insert(t).select().single();
    if (error) throw error;
    set(s => ({ teachers: [...s.teachers, data] }));
    return data;
  },

  updateTeacher: async (id, t) => {
    const { error } = await supabase.from('teachers').update(t).eq('id', id);
    if (error) throw error;
    set(s => ({ teachers: s.teachers.map(x => x.id === id ? { ...x, ...t } : x) }));
  },

  deleteTeacher: async (id) => {
    const { error } = await supabase.from('teachers').delete().eq('id', id);
    if (error) throw error;
    set(s => ({ teachers: s.teachers.filter(x => x.id !== id) }));
    get().fetchCoursePlans();
    if (get().activePlanId) get().fetchScheduleSlots(get().activePlanId!);
  },

  // ==================== 班级 ====================
  fetchClassGroups: async () => {
    const { data, error } = await supabase.from('class_groups').select('*').order('grade').order('name');
    if (error) throw error;
    set({ classGroups: data || [] });
  },

  addClassGroup: async (c) => {
    const { data, error } = await supabase.from('class_groups').insert(c).select().single();
    if (error) throw error;
    set(s => ({ classGroups: [...s.classGroups, data] }));
    return data;
  },

  updateClassGroup: async (id, c) => {
    const { error } = await supabase.from('class_groups').update(c).eq('id', id);
    if (error) throw error;
    set(s => ({ classGroups: s.classGroups.map(x => x.id === id ? { ...x, ...c } : x) }));
  },

  deleteClassGroup: async (id) => {
    const { error } = await supabase.from('class_groups').delete().eq('id', id);
    if (error) throw error;
    set(s => ({ classGroups: s.classGroups.filter(x => x.id !== id) }));
    get().fetchCoursePlans();
    if (get().activePlanId) get().fetchScheduleSlots(get().activePlanId!);
  },



  // ==================== 课程计划 ====================
  fetchCoursePlans: async () => {
    const { data, error } = await supabase
      .from('course_plans')
      .select(`
        *,
        teachers:teacher_id(name),
        class_groups:class_id(name)
      `)
      .order('created_at');
    if (error) throw error;
    const plans = (data || []).map((p: any) => ({
      ...p,
      teacher_name: p.teachers?.name || '',
      class_name: p.class_groups?.name || '',
      teachers: undefined,
      class_groups: undefined,
    }));
    set({ coursePlans: plans });
  },

  addCoursePlan: async (cp) => {
    const { data, error } = await supabase.from('course_plans').insert(cp).select().single();
    if (error) throw error;
    // 重新获取以包含关联名称
    await get().fetchCoursePlans();
    return data;
  },

  updateCoursePlan: async (id, cp) => {
    const { teacher_name, class_name, ...dbFields } = cp as any;
    const { error } = await supabase.from('course_plans').update(dbFields).eq('id', id);
    if (error) throw error;
    await get().fetchCoursePlans();
  },

  deleteCoursePlan: async (id) => {
    const { error } = await supabase.from('course_plans').delete().eq('id', id);
    if (error) throw error;
    set(s => ({ coursePlans: s.coursePlans.filter(x => x.id !== id) }));
    if (get().activePlanId) get().fetchScheduleSlots(get().activePlanId!);
  },

  // ==================== 排课方案 ====================
  fetchSchedulePlans: async () => {
    const { data, error } = await supabase.from('schedule_plans').select('*').order('updated_at', { ascending: false });
    if (error) throw error;
    const plans = data || [];
    const activePlan = plans.length > 0 ? plans[0] : null;
    set({ schedulePlans: plans, activePlanId: activePlan?.id || null });
    
    // 全局启动：当读取到激活课表时，必须立刻关联拉去全部槽位（Slots），避免其他非排课界面读取白板
    if (activePlan) {
      await get().fetchScheduleSlots(activePlan.id);
    }
  },

  addSchedulePlan: async (p) => {
    const { data, error } = await supabase.from('schedule_plans').insert({ ...p, status: 'draft' }).select().single();
    if (error) throw error;
    set(s => ({ schedulePlans: [data, ...s.schedulePlans], activePlanId: data.id }));
    return data;
  },

  updateSchedulePlan: async (id, p) => {
    const { error } = await supabase.from('schedule_plans').update({ ...p, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
    set(s => ({ schedulePlans: s.schedulePlans.map(x => x.id === id ? { ...x, ...p } : x) }));
  },

  deleteSchedulePlan: async (id) => {
    const { error } = await supabase.from('schedule_plans').delete().eq('id', id);
    if (error) throw error;
    set(s => ({
      schedulePlans: s.schedulePlans.filter(x => x.id !== id),
      activePlanId: s.activePlanId === id ? (s.schedulePlans.find(x => x.id !== id)?.id || null) : s.activePlanId,
    }));
  },

  // ==================== 排课时间槽 ====================
  fetchScheduleSlots: async (planId) => {
    const { data, error } = await supabase.from('schedule_slots').select('*').eq('plan_id', planId);
    if (error) throw error;
    set({ scheduleSlots: data || [] });
  },

  saveScheduleSlots: async (planId, slots) => {
    // 1. 删除旧槽位
    const { error: deleteError } = await supabase.from('schedule_slots').delete().eq('plan_id', planId);
    if (deleteError) throw deleteError;

    // 2. 插入新槽位
    if (slots.length > 0) {
      const slotsWithPlan = slots.map(s => ({ ...s, plan_id: planId }));
      const { data, error } = await supabase.from('schedule_slots').insert(slotsWithPlan).select();
      if (error) throw error;
      set({ scheduleSlots: data || [] });
    } else {
      set({ scheduleSlots: [] });
    }

    // 更新方案更新时间
    await supabase.from('schedule_plans').update({ updated_at: new Date().toISOString() }).eq('id', planId);
  },

  // ==================== 规则 ====================
  fetchScheduleRules: async () => {
    const { data, error } = await supabase.from('schedule_rules').select('*').order('created_at');
    if (error) throw error;
    set({ scheduleRules: data || [] });
  },

  saveScheduleRule: async (rule) => {
    const { data, error } = await supabase.from('schedule_rules').insert(rule).select().single();
    if (error) throw error;
    set(s => ({ scheduleRules: [...s.scheduleRules, data] }));
    return data;
  },

  updateScheduleRule: async (id, rule) => {
    const { error } = await supabase.from('schedule_rules').update(rule).eq('id', id);
    if (error) throw error;
    set(s => ({ scheduleRules: s.scheduleRules.map(x => x.id === id ? { ...x, ...rule } : x) }));
  },

  deleteScheduleRule: async (id) => {
    const { error } = await supabase.from('schedule_rules').delete().eq('id', id);
    if (error) throw error;
    set(s => ({ scheduleRules: s.scheduleRules.filter(x => x.id !== id) }));
  },

  // 规则配置表单草稿
  setDraftRuleConfig: (type: string, config: any) => {
    set(s => ({
      draftRuleConfig: {
        ...s.draftRuleConfig,
        [type]: { ...s.draftRuleConfig[type], ...config }
      }
    }));
  },

  initDraftRuleConfig: () => {
    const rules = get().scheduleRules;
    const initialDraft: any = {};
    rules.forEach((r: any) => {
      initialDraft[r.rule_type] = r.config;
    });
    set({ draftRuleConfig: initialDraft });
  }
}));
