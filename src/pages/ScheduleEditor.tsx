import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Filter, 
  Save, 
  RotateCcw, 
  Download,
  AlertCircle,
  Maximize2,
  Undo2,
  Sparkles,
  Loader2,
  Plus
} from 'lucide-react';
import { toast } from 'sonner';
import { ConflictData } from '../lib/types';
import { DraggableCourse } from '../components/schedule/DraggableCourse';
import { GridCell } from '../components/schedule/GridCell';
import { useAppStore, CoursePlan as StoreCoursePlan } from '../lib/store';
import * as XLSX from 'xlsx';

const DAYS = ['周一', '周二', '周三', '周四', '周五'];
const DEFAULT_PERIODS = [
  { id: 0, time: '08:00 - 08:45', label: '第1节' },
  { id: 1, time: '08:55 - 09:40', label: '第2节' },
  { id: 2, time: '10:00 - 10:45', label: '第3节' },
  { id: 3, time: '10:55 - 11:40', label: '第4节' },
  { id: 4, time: '14:00 - 14:45', label: '第5节' },
  { id: 5, time: '14:55 - 15:40', label: '第6节' },
  { id: 6, time: '16:00 - 16:45', label: '第7节' },
  { id: 7, time: '16:55 - 17:40', label: '第8节' },
];

// 科目配色映射
const SUBJECT_COLORS: Record<string, string> = {
  '数学': 'bg-blue-100 border-blue-200 text-blue-800',
  '语文': 'bg-red-100 border-red-200 text-red-800',
  '英语': 'bg-purple-100 border-purple-200 text-purple-800',
  '物理': 'bg-indigo-100 border-indigo-200 text-indigo-800',
  '化学': 'bg-emerald-100 border-emerald-200 text-emerald-800',
  '体育': 'bg-orange-100 border-orange-200 text-orange-800',
  '生物': 'bg-teal-100 border-teal-200 text-teal-800',
  '历史': 'bg-amber-100 border-amber-200 text-amber-800',
  '地理': 'bg-cyan-100 border-cyan-200 text-cyan-800',
  '政治': 'bg-rose-100 border-rose-200 text-rose-800',
  '音乐': 'bg-pink-100 border-pink-200 text-pink-800',
  '美术': 'bg-fuchsia-100 border-fuchsia-200 text-fuchsia-800',
};
const DEFAULT_COLOR = 'bg-gray-100 border-gray-200 text-gray-800';

// 内部使用的排课槽位（兼容 DraggableCourse/GridCell 组件）
interface EditorSlot {
  id: string;
  day: number;
  period: number;
  courseId: string; // course_plan_id
  classId: string; // class_group id
}

// 为侧边栏构建的课程卡片数据
interface CourseCard {
  id: string; // course_plan_id
  subject: string;
  teacherId: string;
  teacherName: string;
  color: string;
  duration: number;
  quota: number; // weekly_hours
}

export default function ScheduleEditor() {
  // ==================== Zustand Store ====================
  const {
    classGroups, coursePlans, teachers,
    schedulePlans, scheduleSlots,
    activePlanId,
    addSchedulePlan, saveScheduleSlots, fetchScheduleSlots, scheduleRules
  } = useAppStore();

  const timeConfig = scheduleRules.find(r => r.rule_type === 'time_constraints')?.config || {};
  const periods = timeConfig.periods || DEFAULT_PERIODS;

  // ==================== Local State ====================
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [prevClassId, setPrevClassId] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<EditorSlot[]>([]);
  const [history, setHistory] = useState<EditorSlot[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [highlightedCell, setHighlightedCell] = useState<{day: number, period: number} | null>(null);
  const [currentWeek, setCurrentWeek] = useState(5);
  const [isSaving, setIsSaving] = useState(false);
  const [autoSchedulingType, setAutoSchedulingType] = useState<'current' | 'all' | null>(null);

  // 初始化：选中首个班级，加载已有排课数据
  useEffect(() => {
    if (classGroups.length > 0 && !selectedClassId) {
      setSelectedClassId(classGroups[0].id);
    }
  }, [classGroups, selectedClassId]);

  // 当活跃方案变化时，加载 slots
  useEffect(() => {
    if (activePlanId) {
      fetchScheduleSlots(activePlanId).then(() => {
        // slots 已在 store 中
      });
    }
  }, [activePlanId, fetchScheduleSlots]);

  // 将 store scheduleSlots 转换为编辑器格式
  useEffect(() => {
    if (scheduleSlots.length > 0) {
      const editorSlots: EditorSlot[] = scheduleSlots.map(s => {
        // course_plan_id → 找到对应的 class_id
        const cp = coursePlans.find(p => p.id === s.course_plan_id);
        return {
          id: s.id,
          day: s.day,
          period: s.period,
          courseId: s.course_plan_id,
          classId: cp?.class_id || '',
        };
      });
      setSchedule(editorSlots);
      setHistory([editorSlots]);
      setHistoryIndex(0);
    }
  }, [scheduleSlots, coursePlans]);

  // ==================== 衍生数据 ====================

  // 当前班级
  const currentClass = useMemo(() => 
    classGroups.find(c => c.id === selectedClassId) || classGroups[0],
    [classGroups, selectedClassId]
  );

  // 当切班或初始化时自动探测是否存在“自习”专用兜底课程卡
  useEffect(() => {
    if (!selectedClassId || !currentClass || teachers.length === 0) return;
    
    // 如果没有任何课程，或不存在“自习”
    const hasSelfStudy = coursePlans.some(cp => cp.class_id === selectedClassId && cp.subject === '自习');
    const activeSemesterId = useAppStore.getState().activeSemesterId;
    
    if (!hasSelfStudy) {
       const headTeacherId = (currentClass as any).head_teacher_id;
       const sysTeacher = teachers.find(t => t.name && (t.name.includes('系统') || t.name.includes('辅助'))) || teachers[0];
       const defaultTeacherId = headTeacherId || sysTeacher?.id;
       
       if (defaultTeacherId) {
         useAppStore.getState().addCoursePlan({
           class_id: selectedClassId,
           subject: '自习',
           teacher_id: defaultTeacherId,
           weekly_hours: 0,
           semester_id: activeSemesterId || null
         } as any).catch(e => console.error('Failed to init self-study card:', e.message || e));
       }
    }
  }, [selectedClassId, coursePlans.length, currentClass, teachers.length, classGroups]);

  // 当前班级的课程卡片列表（用于侧边栏）
  const courseCards: CourseCard[] = useMemo(() => {
    if (!selectedClassId) return [];
    const classPlans = coursePlans.filter(cp => cp.class_id === selectedClassId);
    return classPlans.map(cp => {
      const teacher = teachers.find(t => t.id === cp.teacher_id);
      return {
        id: cp.id,
        subject: cp.subject,
        teacherId: cp.teacher_id,
        teacherName: cp.teacher_name || teacher?.name || '未指定',
        color: SUBJECT_COLORS[cp.subject] || DEFAULT_COLOR,
        duration: 1,
        quota: cp.weekly_hours,
      };
    });
  }, [selectedClassId, coursePlans, teachers]);

  // 获取某个 slot 对应的教师ID
  const getTeacherId = useCallback((slot: EditorSlot) => {
    const cp = coursePlans.find(p => p.id === slot.courseId);
    return cp?.teacher_id;
  }, [coursePlans]);

  // ==================== 冲突检测 ====================
  const conflictMap = useMemo(() => {
    const map = new Map<string, ConflictData>();
    const slotsByTime: Record<string, EditorSlot[]> = {};
    
    schedule.forEach(slot => {
      const key = `${slot.day}-${slot.period}`;
      if (!slotsByTime[key]) slotsByTime[key] = [];
      slotsByTime[key].push(slot);
    });

    Object.values(slotsByTime).forEach(slots => {
      // 班级冲突
      const classCounts: Record<string, number> = {};
      slots.forEach(s => {
        classCounts[s.classId] = (classCounts[s.classId] || 0) + 1;
      });
      slots.forEach(s => {
        if (classCounts[s.classId] > 1) {
          map.set(s.id, { type: 'class_overlap', message: '时段冲突' });
        }
      });

      // 教师冲突
      const slotsByTeacher: Record<string, EditorSlot[]> = {};
      slots.forEach(s => {
        const tid = getTeacherId(s);
        if (tid) {
          if (!slotsByTeacher[tid]) slotsByTeacher[tid] = [];
          slotsByTeacher[tid].push(s);
        }
      });

      Object.entries(slotsByTeacher).forEach(([tid, teacherSlots]) => {
        if (teacherSlots.length > 1) {
          teacherSlots.forEach(targetSlot => {
            const others = teacherSlots.filter(s => s.id !== targetSlot.id);
            if (others.length > 0) {
              const otherSlot = others[0];
              const otherClass = classGroups.find(cg => cg.id === otherSlot.classId);
              if (otherClass) {
                map.set(targetSlot.id, {
                  type: 'teacher_overlap',
                  message: `与 ${otherClass.name} 教师冲突`,
                  conflictingClassId: otherSlot.classId
                });
              }
            }
          });
        }
      });
    });

    return map;
  }, [schedule, getTeacherId, classGroups]);

  // ==================== 操作函数 ====================

  const handlePrevWeek = () => {
    if (currentWeek > 1) {
      setCurrentWeek(currentWeek - 1);
      toast.success(`已切换到第 ${currentWeek - 1} 周`);
    }
  };

  const handleNextWeek = () => {
    if (currentWeek < 20) {
      setCurrentWeek(currentWeek + 1);
      toast.success(`已切换到第 ${currentWeek + 1} 周`);
    }
  };

  const handleDrop = useCallback((item: any, day: number, period: number) => {
    const newSchedule = [...schedule];
    
    if (item.source === 'sidebar') {
      const currentCount = newSchedule.filter(s => s.courseId === item.id && s.classId === selectedClassId).length;
      if (currentCount >= item.quota && item.quota > 0) {
        toast.warning(`注意: "${item.subject}" 本周分配数已超定额 (${item.quota}节)`);
        // 不再 return，允许强制霸王硬上弓
      }
    }

    if (item.slotId) {
      const oldSlotIndex = newSchedule.findIndex(s => s.id === item.slotId);
      if (oldSlotIndex >= 0) {
        newSchedule.splice(oldSlotIndex, 1);
      }
    }

    newSchedule.push({
      id: crypto.randomUUID(),
      day,
      period,
      courseId: item.id,
      classId: selectedClassId,
    });

    setSchedule(newSchedule);
    
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newSchedule);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);

    toast.success(item.slotId ? '已移动课程' : '已添加课程');
  }, [schedule, selectedClassId, history, historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setSchedule(history[historyIndex - 1]);
      toast.info('已撤销');
    }
  }, [history, historyIndex]);

  // 全局响应 Ctrl + Z 快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 避免在输入框内输入时拦截正常按键
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo]);

  const getCoursesAt = (day: number, period: number) => {
    const slots = schedule.filter(s => s.day === day && s.period === period && s.classId === selectedClassId);
    return slots.map(slot => {
      const cp = coursePlans.find(p => p.id === slot.courseId);
      if (!cp) return null;
      const teacher = teachers.find(t => t.id === cp.teacher_id);
      // 转换为 DraggableCourse 需要的 Course 格式
      const course = {
        id: cp.id,
        subject: cp.subject,
        teacherId: cp.teacher_id,
        teacherName: cp.teacher_name || teacher?.name || '',
        color: SUBJECT_COLORS[cp.subject] || DEFAULT_COLOR,
        duration: 1,
        quota: cp.weekly_hours,
      };
      return { course, slotId: slot.id };
    }).filter(Boolean) as { course: any; slotId: string }[];
  };

  const getUsedCount = (courseId: string) => {
    return schedule.filter(s => s.courseId === courseId && s.classId === selectedClassId).length;
  };

  const jumpToClass = (targetClassId: string, day: number, period: number) => {
    const prevClass = classGroups.find(c => c.id === selectedClassId);
    const targetClass = classGroups.find(c => c.id === targetClassId);
    
    setPrevClassId(selectedClassId);
    setSelectedClassId(targetClassId);
    setHighlightedCell({ day, period });
    setTimeout(() => setHighlightedCell(null), 3000);

    toast(
      <div className="flex flex-col gap-1">
        <span className="font-bold text-slate-800">已跳转至 {targetClass?.name}</span>
        <span className="text-xs text-slate-500">正在查看冲突时段</span>
        <button 
          onClick={() => {
            if (prevClass) setSelectedClassId(prevClass.id);
            toast.dismiss();
          }}
          className="mt-2 flex items-center justify-center w-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs py-1.5 rounded transition-colors shadow-sm font-medium"
        >
          <Undo2 size={12} className="mr-1" /> 返回 {prevClass?.name}
        </button>
      </div>,
      { duration: 6000 }
    );
  };

  const goBackToPrevClass = () => {
    if (prevClassId) {
      const prevName = classGroups.find(c => c.id === prevClassId)?.name;
      setSelectedClassId(prevClassId);
      setPrevClassId(null);
      toast.info(`已返回 ${prevName}`);
    }
  };

  // ==================== 保存方案到 Supabase ====================
  const handleSave = async () => {
    setIsSaving(true);
    try {
      let planId = activePlanId;
      
      // 如果没有活跃方案，先创建一个
      if (!planId) {
        const newPlan = await addSchedulePlan({
          name: `排课方案 ${new Date().toLocaleDateString()}`,
          semester_id: null,
        });
        if (!newPlan) throw new Error('创建排课方案失败');
        planId = newPlan.id;
      }

      // 将 EditorSlot 转为 DB ScheduleSlot 格式
      const dbSlots = schedule.map(s => ({
        plan_id: planId!,
        day: s.day,
        period: s.period,
        course_plan_id: s.courseId,
        locked: false,
      }));

      await saveScheduleSlots(planId, dbSlots);
      toast.success('排课方案已保存到数据库');
    } catch (err: any) {
      toast.error(`保存失败: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // ==================== 一键排课（基于 Store 数据）====================
  const handleAutoSchedule = (targetClassId?: string) => {
    if (coursePlans.length === 0) {
      toast.error('请先在基础数据中添加课程计划');
      return;
    }
    const classPlans = coursePlans.filter(cp => cp.class_id === selectedClassId);
    if (classPlans.length === 0) {
      toast.warning('当前班级尚未配置课程计划，请先在“数据管理”录入');
      return;
    }

    setAutoSchedulingType(targetClassId ? 'current' : 'all');
    toast(
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Loader2 className="animate-spin" size={18} />
          <span className="font-bold">正在生成智能排课方案...</span>
        </div>
        <p className="text-xs text-slate-500">基于课程计划和基础数据自动排课</p>
      </div>,
      { duration: 2000 }
    );

    setTimeout(() => {
      try {
        const newSchedule: EditorSlot[] = targetClassId ? schedule.filter(s => s.classId !== targetClassId) : [];
        let slotId = Date.now();

        // ========== 解析排课规则 ==========
        const tcConfig = scheduleRules.find((r: any) => r.rule_type === 'time_constraints')?.config || {};
        const workDays = tcConfig.workDays || [true, true, true, true, true, false, false];
        const avoidWeekend = tcConfig.avoidWeekend ?? true;
        const lunchBreakEnabled = tcConfig.lunchBreakEnabled ?? true;

        const tpConfig = scheduleRules.find((r: any) => r.rule_type === 'teacher_preferences')?.config || {};
        const maxDaily = tpConfig.maxDaily || 4;
        const maxConsecutive = tpConfig.maxConsecutive || 2;
        const customPrefs = tpConfig.customPrefs || {};
        const preferMorning = tpConfig.preferMorning ?? false;
        const avoidFirstLast = tpConfig.avoidFirstLast ?? true;

        // 解析课程分布规则
        const cdConfig = scheduleRules.find((r: any) => r.rule_type === 'course_distribution')?.config || {};
        const courseRules = cdConfig.rules || [];
        // 构建规则查找集合
        const avoidFirstPeriodSubjects = new Set<string>(
          courseRules.filter((r: any) => r.enabled && r.rule?.includes('避开第1节')).map((r: any) => r.subject)
        );
        const noConsecutiveSubjects = new Set<string>(
          courseRules.filter((r: any) => r.enabled && r.rule?.includes('不连堂')).map((r: any) => r.subject)
        );
        const oncePerDaySubjects = new Set<string>(
          courseRules.filter((r: any) => r.enabled && r.rule?.includes('每天不超过1节')).map((r: any) => r.subject)
        );


        // 班级排队清单（所有班级或指定班级）
        const allClassIds = targetClassId 
          ? [targetClassId] 
          : [...new Set(coursePlans.map(cp => cp.class_id))];

        allClassIds.forEach(classId => {
          const classPlans = coursePlans.filter(cp => cp.class_id === classId);
          
          classPlans.forEach(plan => {
            // 修复 Bug：统计该科目目前在课表草稿中已排的数量，防止多次点击"一键排课"无限叠加幽灵课时
            let scheduledCount = newSchedule.filter(s => s.classId === classId && s.courseId === plan.id).length;
            const targetCount = plan.weekly_hours;

            // 动态规划：逐个落子，每次落子后重新算分
            while (scheduledCount < targetCount) {
              const candidates: Array<{ day: number; period: number; score: number }> = [];
              
              for (let day = 0; day < 7; day++) {
                if (!workDays[day]) continue;
                if (day >= 5 && avoidWeekend) continue;

                for (let period = 0; period < (tcConfig.periods || DEFAULT_PERIODS).length; period++) {
                  // 检查班级冲突
                  const classConflict = newSchedule.some(s => s.day === day && s.period === period && s.classId === classId);
                  if (classConflict) continue;

                  // 检查教师时段冲突
                  const teacherSlots = newSchedule.filter(s => {
                    const otherPlan = coursePlans.find(p => p.id === s.courseId);
                    return otherPlan?.teacher_id === plan.teacher_id;
                  });
                  
                  const teacherConflict = teacherSlots.some(s => s.day === day && s.period === period);
                  if (teacherConflict) continue;

                  let score = 1.0;

                  // ===== P0: 应用教师个人时间偏好矩阵 =====
                  const teacherPrefs = customPrefs[plan.teacher_id];
                  if (teacherPrefs) {
                    const prefValue = (teacherPrefs[day] || [])[period];
                    if (prefValue === 2) continue; // 红色不可用 → 物理屏蔽
                    if (prefValue === 1) score *= 1.8; // 绿色偏好 → 强加分
                  }

                  // 检查教师单日负荷上限（改为柔性惩罚而非硬截断，允许高强度挤压排课）
                  const teacherDailyCount = teacherSlots.filter(s => s.day === day).length;
                  if (teacherDailyCount >= maxDaily) {
                    score *= 0.01; // 极强惩罚，除非无路可走，否则不排
                  }

                  // P1: 联动 preferMorning 开关控制上午倾向
                  if (period < 4) { 
                    score *= preferMorning ? 1.5 : 1.0;
                    if (preferMorning && ['语文', '数学', '英语'].includes(plan.subject)) score *= 1.3;
                  }
                  if (preferMorning && period >= 1 && period <= 3) score *= 1.2;

                  // P1: 联动 avoidFirstLast 开关
                  const totalPeriods = (tcConfig.periods || DEFAULT_PERIODS).length;
                  if (avoidFirstLast && (period === 0 || period === totalPeriods - 1)) {
                    score *= 0.4;
                  }
                  
                  // 体育等副科规避第一节，尽量放下午
                  if (period === 0 && ['体育', '音乐', '美术'].includes(plan.subject)) score *= 0.1;
                  if (period >= 4 && ['体育', '音乐', '美术'].includes(plan.subject)) score *= 1.5;

                  // ===== 应用课程分布规则 =====
                  // 规则：避开第1节
                  if (period === 0 && avoidFirstPeriodSubjects.has(plan.subject)) score *= 0.2;
                  
                  // 规则：不连堂 — 检查前一节是否同科目
                  if (noConsecutiveSubjects.has(plan.subject) && period > 0) {
                    const prevSlot = newSchedule.find(s => s.day === day && s.period === period - 1 && s.classId === classId);
                    if (prevSlot) {
                      const prevPlan = coursePlans.find(cp => cp.id === prevSlot.courseId);
                      if (prevPlan?.subject === plan.subject) score *= 0.05;
                    }
                  }

                  // 规则：每天不超过1节 — 强惩罚同一天已有同科目（动态生效）
                  const sameDayCount = newSchedule.filter(s => s.day === day && s.classId === classId && s.courseId === plan.id).length;
                  if (sameDayCount > 0 && oncePerDaySubjects.has(plan.subject)) {
                    score *= 0.02;  // 几乎不可能被选中
                  } else if (sameDayCount > 0) {
                    score *= 0.1;   // 普通科目也降权
                  }

                  // 午休保护
                  if (lunchBreakEnabled && period === 3) score *= 0.8;

                  // 教师连续课节检查（基于 maxConsecutive）
                  if (maxConsecutive > 0) {
                    let consecutiveCount = 0;
                    for (let p = period - 1; p >= 0; p--) {
                      const hasSlot = teacherSlots.some(s => s.day === day && s.period === p);
                      if (hasSlot) consecutiveCount++;
                      else break;
                    }
                    if (consecutiveCount >= maxConsecutive) score *= 0.1;
                  }

                  // 随机扰动（避免所有班级排成一样的）
                  score *= (0.8 + Math.random() * 0.4);

                  candidates.push({ day, period, score });
                }
              }

              if (candidates.length === 0) {
                console.warn(`${classGroups.find(c => c.id === classId)?.name} 的 ${plan.subject} 无法找到更多无冲突时段`);
                break; // 彻底无路可走，退出循环
              }

              candidates.sort((a, b) => b.score - a.score);

              let placed = false;
              for (const c of candidates) {
                // 再次严格验证物理冲突
                const classConflict = newSchedule.some(s => s.day === c.day && s.period === c.period && s.classId === classId);
                const teacherConflict = newSchedule.some(s => {
                  if (s.day !== c.day || s.period !== c.period) return false;
                  const otherPlan = coursePlans.find(p => p.id === s.courseId);
                  return otherPlan?.teacher_id === plan.teacher_id;
                });

                if (!classConflict && !teacherConflict) {
                  newSchedule.push({
                    id: `auto_${slotId++}`,
                    day: c.day,
                    period: c.period,
                    courseId: plan.id, // course_plan_id
                    classId: classId,
                  });
                  scheduledCount++;
                  placed = true;
                  break; // 成功落位一子，退出选拔，开启下一轮打分
                }
              }

              if (!placed) {
                console.warn(`${classGroups.find(c => c.id === classId)?.name} 的 ${plan.subject} 前排槽位全部物理冲突，无法落位`);
                break;
              }
            }

            if (scheduledCount < targetCount) {
              console.warn(`${classGroups.find(c => c.id === classId)?.name} 的 ${plan.subject} 只安排了 ${scheduledCount}/${targetCount}`);
            }
          });
        });

        setSchedule(newSchedule);
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(newSchedule);
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);

        toast.success(
          <div className="flex flex-col gap-1">
            <span className="font-bold">✨ 智能排课完成！</span>
            <span className="text-xs">已生成 {newSchedule.length} 个课时安排</span>
            <span className="text-xs text-green-600">覆盖 {allClassIds.length} 个班级</span>
          </div>,
          { duration: 5000 }
        );
      } catch (error: any) {
        console.error('智能排课错误:', error);
        toast.error('智能排课失败，请检查基础数据配置');
      } finally {
        setAutoSchedulingType(null);
      }
    }, 1500);
  };

  // ==================== 导出与清空 ====================
  const handleExportExcel = async () => {
    if (!currentClass) {
      toast.error('请先选择班级');
      return;
    }

    try {
      toast.info(`正在生成 ${currentClass.name} 课表草稿...`);

      const exportData = periods.map(period => {
        const row: any = { '时间 / 星期': `${period.label} (${period.time})` };
        DAYS.forEach((day, dayIdx) => {
          const courses = getCoursesAt(dayIdx, period.id);
          if (courses.length === 0) {
            row[day] = '-';
          } else {
            row[day] = courses.map(c => `${c.course.subject} (${c.course.teacherName || '未安排'})`).join(' / ');
          }
        });
        return row;
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);

      ws['!cols'] = [
        { wch: 22 },
        { wch: 20 },
        { wch: 20 },
        { wch: 20 },
        { wch: 20 },
        { wch: 20 }
      ];

      XLSX.utils.sheet_add_aoa(ws, [
        [],
        ['备注说明：', `${currentClass.grade || ''}年级 | 学年：${currentClass.academic_year || (currentClass as any).academicYear || '未设置'}`],
        ['生成时间：', new Date().toLocaleString('zh-CN')]
      ], { origin: -1 });

      XLSX.utils.book_append_sheet(wb, ws, "课表草稿");

      const safeFilename = `${currentClass.name}_课表草稿`.replace(/[\r\n\t\\/:*?"<>|]/g, '').trim();
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      if ('showSaveFilePicker' in window) {
        try {
          // @ts-ignore
          const fileHandle = await window.showSaveFilePicker({
            suggestedName: `${safeFilename}.xlsx`,
            types: [{
              description: 'Excel Workbook',
              accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
            }],
          });
          // @ts-ignore
          const writable = await fileHandle.createWritable();
          await writable.write(blob);
          await writable.close();
          toast.success('课表草稿导出成功！');
          return;
        } catch (err: any) {
          if (err.name !== 'AbortError') console.error('SaveFilePicker 失败:', err);
          else return;
        }
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${safeFilename}.xlsx`;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        if (document.body.contains(link)) document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 2000);
      toast.success('课表草稿导出成功！');
    } catch (error: any) {
      toast.error(`导出失败: ${error.message}`);
    }
  };

  const handleRemoveSlot = useCallback((slotId: string) => {
    const newSchedule = schedule.filter(s => s.id !== slotId);
    setSchedule(newSchedule);
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newSchedule);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    toast.success('已移除该课程');
  }, [schedule, history, historyIndex]);

  const handleClearSchedule = () => {
    if (!currentClass) return;
    
    // 使用应用态的 Toast 作为确认框，防止 window.confirm 被原生壳环境（WebView/Electron等）暴力拦截
    toast(`确定要清空【${currentClass.name}】当前所有已排课吗？`, {
      description: '仅清空当前工作区画板，需点击“保存方案”才会永久生效到数据库。',
      action: {
        label: '确认清空',
        onClick: () => {
          const newSchedule = schedule.filter(s => s.classId !== selectedClassId);
          setSchedule(newSchedule);
          
          const newHistory = history.slice(0, historyIndex + 1);
          newHistory.push(newSchedule);
          setHistory(newHistory);
          setHistoryIndex(newHistory.length - 1);
          
          toast.success(`已清空 ${currentClass.name} 课表草稿`);
        }
      },
      cancel: {
        label: '取消',
        onClick: () => {}
      },
      duration: 6000,
    });
  };

  // ==================== 渲染 ====================

  if (classGroups.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <AlertCircle size={48} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-bold text-slate-600 mb-2">暂无班级数据</h3>
          <p className="text-slate-400">请先在"基础数据"中添加班级和课程计划</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center space-x-4">
          <div className="flex items-center bg-slate-100 rounded-lg p-1">
            <button className="p-1 hover:bg-white rounded-md shadow-sm transition-all" onClick={handlePrevWeek}><ChevronLeft size={18} /></button>
            <span className="px-3 font-medium text-slate-700">第 {currentWeek} 周</span>
            <button className="p-1 hover:bg-white rounded-md shadow-sm transition-all" onClick={handleNextWeek}><ChevronRight size={18} /></button>
          </div>
          
          <div className="h-6 w-px bg-slate-300 mx-2"></div>
          
          <div className="flex items-center gap-2">
            <select 
                value={selectedClassId}
                onChange={(e: any) => setSelectedClassId(e.target.value)}
                className="bg-white border border-slate-300 text-slate-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2 min-w-[120px]"
            >
                {classGroups.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            {prevClassId && selectedClassId !== prevClassId && (
                <button 
                    onClick={goBackToPrevClass}
                    className="flex items-center px-3 py-2 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors border border-indigo-200"
                    title="返回刚才查看的班级"
                >
                    <Undo2 size={14} className="mr-1" />
                    返回上一班级
                </button>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            <button 
              className="flex items-center px-4 py-2 bg-white border border-indigo-200 text-indigo-600 hover:bg-indigo-50 rounded-lg shadow-sm transition-all font-medium text-sm disabled:opacity-50"
              onClick={() => handleAutoSchedule(selectedClassId)}
              disabled={autoSchedulingType !== null || coursePlans.length === 0}
            >
              {autoSchedulingType === 'current' ? <Loader2 size={18} className="mr-2 animate-spin" /> : <Sparkles size={18} className="mr-2" />}
              对当前班级排课
            </button>
            <button 
              className="flex items-center px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-lg shadow-md transition-all font-medium text-sm disabled:opacity-50"
              onClick={() => handleAutoSchedule()}
              disabled={autoSchedulingType !== null || coursePlans.length === 0}
            >
              {autoSchedulingType === 'all' ? <Loader2 size={18} className="mr-2 animate-spin" /> : <Sparkles size={18} className="mr-2" />}
              对所有班级排课
            </button>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {conflictMap.size > 0 && (
            <div className="flex items-center text-red-600 text-sm bg-red-50 px-3 py-1.5 rounded-full animate-pulse border border-red-200">
              <AlertCircle size={16} className="mr-2" />
              <span>{conflictMap.size} 个排课冲突</span>
            </div>
          )}
          
          <button 
            onClick={undo}
            disabled={historyIndex === 0}
            className="p-2 text-slate-500 hover:text-slate-800 disabled:opacity-30 transition-colors"
            title="撤销 (Ctrl+Z)"
          >
            <RotateCcw size={20} />
          </button>

          <button 
            className="flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm transition-all font-medium text-sm disabled:opacity-50"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? <Loader2 size={18} className="mr-2 animate-spin" /> : <Save size={18} className="mr-2" />}
            保存方案
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Main Grid */}
        <div className="flex-1 overflow-auto p-6 bg-slate-50/50">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden min-w-[800px]">
            {/* Header Row */}
            <div className="grid grid-cols-[80px_repeat(5,1fr)] bg-slate-50 border-b border-slate-200">
              <div className="p-4 border-r border-slate-200 text-center font-medium text-slate-500 text-sm">时间</div>
              {DAYS.map((day, i) => (
                <div key={day} className={`p-4 text-center font-bold text-slate-700 border-r border-slate-200 ${i === 4 ? 'border-r-0' : ''}`}>
                  {day}
                </div>
              ))}
            </div>

            {/* Grid Body */}
            <div className="divide-y divide-slate-200">
              {periods.map((period) => (
                <div key={period.id} className="grid grid-cols-[80px_repeat(5,1fr)]">
                  <div className="p-2 border-r border-slate-200 flex flex-col items-center justify-center bg-slate-50 text-xs text-slate-500">
                    <span className="font-bold mb-1">{period.label}</span>
                    <span className="text-slate-400 scale-90">{period.time}</span>
                  </div>
                  
                  {DAYS.map((_, dayIndex) => {
                    const slotItems = getCoursesAt(dayIndex, period.id);
                    const hasConflict = slotItems.some(item => conflictMap.has(item.slotId));
                    const isHighlighted = highlightedCell?.day === dayIndex && highlightedCell?.period === period.id;

                    return (
                      <GridCell 
                        key={`${dayIndex}-${period.id}`}
                        day={dayIndex}
                        period={period.id}
                        onDrop={handleDrop}
                        isConflict={hasConflict}
                        isHighlighted={isHighlighted}
                      >
                         <div className="w-full h-full flex flex-col gap-1 overflow-y-auto">
                           {slotItems.map((item) => (
                              <div key={item.slotId} className="flex-1 min-h-[36px]">
                                <DraggableCourse 
                                  course={item.course} 
                                  slotId={item.slotId} 
                                  conflict={conflictMap.get(item.slotId)}
                                  onJumpToClass={(targetClassId: string) => jumpToClass(targetClassId, dayIndex, period.id)}
                                  onRemove={handleRemoveSlot}
                                />
                              </div>
                           ))}
                         </div>
                      </GridCell>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="w-72 bg-white border-l border-slate-200 flex flex-col shadow-xl z-20">
          <div className="p-4 border-b border-slate-200">
             <h3 className="font-bold text-slate-800">待排课程</h3>
             <p className="text-xs text-slate-500 mt-1">
               {currentClass ? `${currentClass.name} — 拖拽课程卡片至左侧课表` : '选择班级后显示课程'}
             </p>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
             {courseCards.length === 0 ? (
               <div className="text-center py-8">
                 <AlertCircle size={32} className="mx-auto text-slate-300 mb-3" />
                 <p className="text-sm text-slate-400 mb-2">该班级暂无课程计划</p>
                 <p className="text-xs text-slate-300">请先在"基础数据 → 课程计划"中添加</p>
               </div>
             ) : (
               <div className="space-y-2">
                 {courseCards.map(course => (
                   <DraggableCourse 
                     key={course.id} 
                     course={course} 
                     isSidebar 
                     placedCount={getUsedCount(course.id)}
                   />
                 ))}
               </div>
             )}

             <div className="pt-4 border-t border-slate-100">
               <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">排课工具</h4>
               <div className="grid grid-cols-2 gap-2">
                  <ToolButton icon={Download} label="导出Excel" onClick={handleExportExcel} />
                  <ToolButton icon={RotateCcw} label="清空课表" onClick={handleClearSchedule} />
               </div>
             </div>
             
             <div className="pt-4 border-t border-slate-100">
               <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                 <h5 className="text-blue-800 font-bold text-sm mb-1">排课统计</h5>
                 <div className="text-xs text-blue-600 leading-relaxed space-y-1">
                   <p>当前班级已排: <strong>{schedule.filter(s => s.classId === selectedClassId).length}</strong> 节</p>
                   <p>全校总计: <strong>{schedule.length}</strong> 节</p>
                   <p>冲突数: <strong className={conflictMap.size > 0 ? 'text-red-600' : ''}>{conflictMap.size}</strong></p>
                 </div>
               </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ToolButton({ icon: Icon, label, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className="flex flex-col items-center justify-center p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors text-slate-600"
    >
      <Icon size={18} className="mb-1" />
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}