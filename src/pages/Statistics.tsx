import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  Users,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  Filter,
  FileText,
  PieChart as PieChartIcon,
  Activity,
  Award,
  Target,
  DoorOpen,
  BookOpen,
  ChevronDown
} from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Area,
  AreaChart
} from 'recharts';

import { toast } from 'sonner';
import { useAppStore } from '../lib/store';
import * as XLSX from 'xlsx';

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4'];

export default function Statistics({ embedded = false }: { embedded?: boolean }) {
  const [timeRange, setTimeRange] = useState('week');
  const [selectedView, setSelectedView] = useState('overview');

  // 从 Zustand Store 获取持久化数据
  const {
    teachers, classGroups, coursePlans, scheduleSlots, schedulePlans,
    fetchTeachers, fetchClassGroups, fetchCoursePlans, fetchScheduleSlots, fetchSchedulePlans
  } = useAppStore();

  useEffect(() => {
    fetchTeachers();
    fetchClassGroups();
    fetchCoursePlans();
    fetchSchedulePlans().then(() => {
      const plans = useAppStore.getState().schedulePlans;
      if (plans.length > 0) {
        fetchScheduleSlots(plans[0].id);
      }
    });
  }, []);

  // 从 Store 数据计算统计 (兼容 snake_case 字段映射)
  const stats = useMemo(() => {
    const totalSlots = scheduleSlots.length;
    const totalPossibleSlots = classGroups.length * 5 * 8;
    const completionRate = totalPossibleSlots > 0 ? (totalSlots / totalPossibleSlots) * 100 : 0;

    // 教师工作负荷
    const teacherWorkload = teachers.map((teacher: any) => {
      const tid = teacher.id;
      const tPlans = coursePlans.filter((cp: any) => (cp.teacher_id || cp.teacherId) === tid);
      const tPlanIds = tPlans.map((cp: any) => cp.id);
      const scheduled = scheduleSlots.filter((s: any) =>
        tPlanIds.includes(s.course_plan_id || s.coursePlanId)
      ).length;
      const maxHours = (teacher as any).max_weekly_hours || (teacher as any).maxWeeklyHours || 12;
      return {
        name: teacher.name,
        scheduled,
        total: maxHours,
        percentage: maxHours > 0 ? ((scheduled / maxHours) * 100).toFixed(1) : '0'
      };
    });


    // 每日课程分布
    const dailyDistribution = [
      { day: '周一', count: scheduleSlots.filter((s: any) => s.day === 0).length },
      { day: '周二', count: scheduleSlots.filter((s: any) => s.day === 1).length },
      { day: '周三', count: scheduleSlots.filter((s: any) => s.day === 2).length },
      { day: '周四', count: scheduleSlots.filter((s: any) => s.day === 3).length },
      { day: '周五', count: scheduleSlots.filter((s: any) => s.day === 4).length }
    ];

    // 科目分布
    const subjectDistribution: Record<string, number> = {};
    scheduleSlots.forEach((slot: any) => {
      const coursePlanId = slot.course_plan_id || slot.coursePlanId;
      const cp = coursePlans.find((c: any) => c.id === coursePlanId);
      const subject = cp?.subject || '未知';
      subjectDistribution[subject] = (subjectDistribution[subject] || 0) + 1;
    });
    const subjectStats = Object.entries(subjectDistribution).map(([name, value]) => ({ name, value }));

    // 时段分布
    const morningSlots = scheduleSlots.filter((s: any) => s.period < 4).length;
    const afternoonSlots = scheduleSlots.filter((s: any) => s.period >= 4).length;
    const timeDistribution = [
      { name: '上午', value: morningSlots },
      { name: '下午', value: afternoonSlots }
    ];

    // 班级排课完成度
    const classCompletion = classGroups.map((cg: any) => {
      const cid = cg.id;
      const classCoursePlans = coursePlans.filter((cp: any) => (cp.class_id || cp.classId) === cid);
      const classCoursePlanIds = classCoursePlans.map((cp: any) => cp.id);
      const classSlots = scheduleSlots.filter((s: any) => classCoursePlanIds.includes(s.course_plan_id || s.coursePlanId));
      return {
        name: cg.name,
        completed: classSlots.length,
        total: 40,
        percentage: ((classSlots.length / 40) * 100).toFixed(1)
      };
    });

    const avgTeacherWorkload = teacherWorkload.length > 0 
      ? teacherWorkload.reduce((sum, t) => sum + parseFloat(t.percentage), 0) / teacherWorkload.length 
      : 0;


    let conflictsCount = 0;
    const slotMap = new Map();
    scheduleSlots.forEach((s: any) => {
      const cp: any = coursePlans.find((c: any) => c.id === (s.course_plan_id || s.coursePlanId));
      if (!cp) return;
      const classKey = `c_${s.day}_${s.period}_${cp.class_id || cp.classId}`;
      if (slotMap.has(classKey)) conflictsCount++;
      else slotMap.set(classKey, true);
      const teacherKey = `t_${s.day}_${s.period}_${cp.teacher_id || cp.teacherId}`;
      if (slotMap.has(teacherKey)) conflictsCount++;
      else slotMap.set(teacherKey, true);
    });

    // 教师综合评估（从真实数据计算）
    const avgCompletion = teacherWorkload.length > 0 ? teacherWorkload.reduce((s, t) => s + parseFloat(t.percentage), 0) / teacherWorkload.length : 0;
    // 跨班教学：教师教多个不同班级的比例
    const crossClassTeachers = teachers.filter((t: any) => {
      const tPlans = coursePlans.filter((cp: any) => (cp.teacher_id || cp.teacherId) === t.id);
      const uniqueClasses = new Set(tPlans.map((cp: any) => cp.class_id || cp.classId));
      return uniqueClasses.size > 1;
    }).length;
    const crossClassRate = teachers.length > 0 ? (crossClassTeachers / teachers.length) * 100 : 0;
    // 课程多样性：平均每位教师教授的科目数
    const avgSubjectsPerTeacher = teachers.length > 0 ? teachers.reduce((s: number, t: any) => s + (t.subjects?.length || 0), 0) / teachers.length * 20 : 0;
    // 时间利用率
    const timeUtilization = totalPossibleSlots > 0 ? (totalSlots / totalPossibleSlots) * 100 : 0;

    const teacherRadarData = [
      { subject: '课时完成度', A: Math.min(Math.round(avgCompletion), 100), fullMark: 100 },
      { subject: '教师负荷均衡', A: Math.min(Math.round(100 - Math.abs(avgCompletion - 75)), 100), fullMark: 100 },
      { subject: '时间利用率', A: Math.min(Math.round(timeUtilization), 100), fullMark: 100 },
      { subject: '跨班教学', A: Math.min(Math.round(crossClassRate), 100), fullMark: 100 },
      { subject: '课程多样性', A: Math.min(Math.round(avgSubjectsPerTeacher), 100), fullMark: 100 },
      { subject: '冲突规避', A: conflictsCount === 0 ? 100 : Math.max(0, 100 - conflictsCount * 10), fullMark: 100 }
    ];

    // 课程质量指标（从真实数据计算）
    const totalSubjects = new Set(coursePlans.map((cp: any) => cp.subject)).size;
    const scheduledSubjects = new Set(
      scheduleSlots.map((s: any) => {
        const cp = coursePlans.find((c: any) => c.id === (s.course_plan_id || s.coursePlanId));
        return cp?.subject;
      }).filter(Boolean)
    ).size;
    const coverageRate = totalSubjects > 0 ? (scheduledSubjects / totalSubjects) * 100 : 0;

    // 时间分布均衡度：上午/下午课时差距越小越均衡
    const totalScheduled = morningSlots + afternoonSlots;
    const balanceRate = totalScheduled > 0 ? (1 - Math.abs(morningSlots - afternoonSlots) / totalScheduled) * 100 : 0;

    // 连堂合理性：检查同科目连堂出现次数
    let consecutiveViolations = 0;
    let totalChecks = 0;
    classGroups.forEach((cg: any) => {
      const classCoursePlanIds = coursePlans.filter((cp: any) => (cp.class_id || cp.classId) === cg.id).map((cp: any) => cp.id);
      for (let day = 0; day < 5; day++) {
        for (let period = 1; period < 8; period++) {
          const prevSlot = scheduleSlots.find((s: any) => s.day === day && s.period === period - 1 && classCoursePlanIds.includes(s.course_plan_id || s.coursePlanId));
          const curSlot = scheduleSlots.find((s: any) => s.day === day && s.period === period && classCoursePlanIds.includes(s.course_plan_id || s.coursePlanId));
          if (prevSlot && curSlot) {
            totalChecks++;
            const prevCp = coursePlans.find((c: any) => c.id === prevSlot.course_plan_id);
            const curCp = coursePlans.find((c: any) => c.id === curSlot.course_plan_id);
            if (prevCp?.subject === curCp?.subject) consecutiveViolations++;
          }
        }
      }
    });
    const consecutiveRate = totalChecks > 0 ? (1 - consecutiveViolations / totalChecks) * 100 : 100;

    // 黄金时段占比：上午1-4节中主科占比
    const goldenSlots = scheduleSlots.filter((s: any) => s.period >= 0 && s.period < 4);
    const goldenMainSubjects = goldenSlots.filter((s: any) => {
      const cp = coursePlans.find((c: any) => c.id === (s.course_plan_id || s.coursePlanId));
      return ['语文', '数学', '英语'].includes(cp?.subject || '');
    }).length;
    const goldenRate = goldenSlots.length > 0 ? (goldenMainSubjects / goldenSlots.length) * 100 : 0;

    const qualityMetrics = [
      { label: '课程覆盖率', value: Math.round(coverageRate), colors: 'from-blue-500 to-purple-500' },
      { label: '时间分布均衡度', value: Math.round(balanceRate), colors: 'from-emerald-500 to-teal-500' },
      { label: '连堂合理性', value: Math.round(consecutiveRate), colors: 'from-orange-500 to-red-500' },
      { label: '黄金时段占比', value: Math.round(goldenRate), colors: 'from-purple-500 to-pink-500' }
    ];

    // 每日科目课时趋势（按星期几统计各科目课时数）
    const dayNames = ['周一', '周二', '周三', '周四', '周五'];
    const topSubjects = Object.entries(subjectDistribution).sort((a, b) => b[1] - a[1]).slice(0, 4).map(e => e[0]);
    const dailySubjectTrend = dayNames.map((dayName, dayIdx) => {
      const row: any = { day: dayName };
      topSubjects.forEach(sub => {
        row[sub] = scheduleSlots.filter((s: any) => {
          if (s.day !== dayIdx) return false;
          const cp = coursePlans.find((c: any) => c.id === (s.course_plan_id || s.coursePlanId));
          return cp?.subject === sub;
        }).length;
      });
      return row;
    });

    // 班级课程均衡度（主科/副科/其他分类统计）
    const mainSubjects = ['语文', '数学', '英语', '物理', '化学', '生物', '政治', '历史', '地理'];
    const minorSubjects = ['体育', '音乐', '美术', '信息技术', '心理健康', '通用技术', '劳动'];
    const classBalanceData = classGroups.slice(0, 6).map((cg: any) => {
      const classCpIds = coursePlans.filter((cp: any) => (cp.class_id || cp.classId) === cg.id).map((cp: any) => cp.id);
      const classSlots = scheduleSlots.filter((s: any) => classCpIds.includes(s.course_plan_id || s.coursePlanId));
      let mainCount = 0, minorCount = 0, otherCount = 0;
      classSlots.forEach((s: any) => {
        const cp = coursePlans.find((c: any) => c.id === (s.course_plan_id || s.coursePlanId));
        if (!cp) return;
        if (mainSubjects.includes(cp.subject)) mainCount++;
        else if (minorSubjects.includes(cp.subject)) minorCount++;
        else otherCount++;
      });
      return { class: cg.name, 主科: mainCount, 副科: minorCount, 其他: otherCount };
    });

    return {
      completionRate: completionRate.toFixed(1),
      avgTeacherWorkload: avgTeacherWorkload.toFixed(1),
      conflictsCount,
      totalSlots,
      totalPossibleSlots,
      teacherWorkload,
      dailyDistribution,
      subjectStats,
      timeDistribution,
      classCompletion,
      teacherRadarData,
      qualityMetrics,
      dailySubjectTrend,
      topSubjects,
      classBalanceData,
      selfStudyCount: scheduleSlots.filter((s: any) => {
        const cp = coursePlans.find((c: any) => c.id === (s.course_plan_id || s.coursePlanId));
        return cp?.subject === '自习';
      }).length
    };
  }, [teachers, classGroups, coursePlans, scheduleSlots]);

  const handleExport = async (format: string) => {
    if (format === 'Excel') {
      try {
        const wb = XLSX.utils.book_new();

        // 1. 概览统计
        const overviewData = [
          { '统计指标': '已排课时数', '数值': stats.totalSlots },
          { '统计指标': '系统总容量 (槽位)', '数值': stats.totalPossibleSlots },
          { '统计指标': '大盘排课完成率', '数值': `${stats.completionRate}%` },
          { '统计指标': '教师总人数', '数值': teachers.length },
          { '统计指标': '班级总数量', '数值': classGroups.length }
        ];
        const wsOverview = XLSX.utils.json_to_sheet(overviewData);
        XLSX.utils.book_append_sheet(wb, wsOverview, '概览指标');

        // 2. 教师负荷
        const teacherData = stats.teacherWorkload.map((t: any) => ({
          '教师姓名': t.name,
          '已排课时': t.scheduled,
          '规定最大负荷 (节)': t.total,
          '负荷率 (%)': t.percentage
        }));
        const wsTeacher = XLSX.utils.json_to_sheet(teacherData);
        XLSX.utils.book_append_sheet(wb, wsTeacher, '教师负荷报表');

        // 3. 班级进度
        const classData = stats.classCompletion.map((c: any) => ({
          '班级名称': c.name,
          '已排下课时': c.completed,
          '预期总排课': c.total,
          '班级完成率 (%)': c.percentage
        }));
        const wsClass = XLSX.utils.json_to_sheet(classData);
        XLSX.utils.book_append_sheet(wb, wsClass, '班级排课进度');


        const safeFilename = `排课系统统计报表_${new Date().toISOString().split('T')[0]}`.replace(/[\r\n\t\\/:*?"<>|]/g, '');
        
        // 生成强编码扩展名的二进制格式流
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        
        // 终极绝杀：原生物理文件对话框
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
            toast.success('📊 Excel 真·报表已生成并保存！');
            return;
          } catch (err: any) {
            if (err.name !== 'AbortError') {
              console.error('SaveFilePicker 失败，启用备选下载方案:', err);
            } else {
              return; // 取消下载
            }
          }
        }
        
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${safeFilename}.xlsx`;
        document.body.appendChild(link);
        
        link.click();
        
        // 延迟释放，防止沙盒式浏览器吞掉 download 属性
        setTimeout(() => {
          if (document.body.contains(link)) {
            document.body.removeChild(link);
          }
          URL.revokeObjectURL(url);
        }, 2000);
        
        toast.success('📊 Excel 真·报表已生成并开始下载！');
      } catch (err: any) {
        toast.error('导出失败: ' + err.message);
      }
    } else {
      toast.info(`暂未支持 ${format} 的深度排版导出`);
    }
  };

  return (
    <div className={embedded ? "space-y-6" : "max-w-7xl mx-auto p-6 space-y-6"}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          {embedded ? null : (
            <>
              <h1 className="text-2xl font-bold text-slate-800">统计报表</h1>
              <p className="text-slate-500 mt-1">全面的排课数据分析与可视化展示</p>
            </>
          )}
        </div>
        {!embedded && (
          <div className="flex space-x-3">
            <div className="relative">
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="appearance-none px-4 py-2 pr-10 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="week">本周</option>
                <option value="month">本月</option>
                <option value="semester">本学期</option>
                <option value="year">本学年</option>
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
            <button
              onClick={() => handleExport('Excel')}
              className="flex items-center px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-medium text-sm"
            >
              <Download size={18} className="mr-2 text-green-600" />
              导出Excel
            </button>
            <button
              onClick={() => handleExport('PDF')}
              className="flex items-center px-4 py-2 bg-indigo-600 rounded-lg text-white hover:bg-indigo-700 font-medium text-sm shadow-sm"
            >
              <FileText size={18} className="mr-2" />
              导出PDF
            </button>
          </div>
        )}
      </div>

      {/* KPI Cards - 融合指标面板 */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
        <KPICard
          title="排课班级"
          value={String(classGroups.length)}
          subtitle={`共 ${coursePlans.length} 条课程计划`}
          icon={Award}
          color="blue"
        />
        <KPICard
          title="教师总数"
          value={String(teachers.length)}
          subtitle="参与排课"
          icon={Users}
          color="purple"
        />
        <KPICard
          title="排课完成度"
          value={`${stats.completionRate}%`}
          subtitle={`${stats.totalSlots} / ${stats.totalPossibleSlots} 节课`}
          icon={Target}
          color="blue"
        />
        <KPICard
          title="教师平均负荷"
          value={`${stats.avgTeacherWorkload}%`}
          subtitle={parseFloat(stats.avgTeacherWorkload) < 95 ? '符合预期范围' : '部分教师超负荷'}
          icon={Activity}
          color="purple"
        />

        <KPICard
          title="冲突检测"
          value={String(stats.conflictsCount)}
          subtitle={stats.conflictsCount > 0 ? '需要处理' : '排课正常无冲突'}
          icon={AlertTriangle}
          color={stats.conflictsCount > 0 ? 'orange' : 'emerald'}
        />
        <KPICard
          title="自习课数量"
          value={String(stats.selfStudyCount)}
          subtitle={stats.selfStudyCount > 0 ? `占总课时 ${(stats.selfStudyCount / Math.max(stats.totalSlots, 1) * 100).toFixed(1)}%` : '暂无自习课安排'}
          icon={Clock}
          color="blue"
        />
      </div>

      {/* View Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-2">
        <div className="flex space-x-2 overflow-x-auto">
          <TabButton
            active={selectedView === 'overview'}
            onClick={() => setSelectedView('overview')}
            icon={BarChart3}
            label="综合概览"
          />
          <TabButton
            active={selectedView === 'teacher'}
            onClick={() => setSelectedView('teacher')}
            icon={Users}
            label="教师分析"
          />

          <TabButton
            active={selectedView === 'course'}
            onClick={() => setSelectedView('course')}
            icon={BookOpen}
            label="课程分析"
          />
          <TabButton
            active={selectedView === 'class'}
            onClick={() => setSelectedView('class')}
            icon={Award}
            label="班级分析"
          />
        </div>
      </div>

      {/* Content Views */}
      {selectedView === 'overview' && <OverviewView stats={stats} />}
      {selectedView === 'teacher' && <TeacherAnalysisView stats={stats} />}

      {selectedView === 'course' && <CourseAnalysisView stats={stats} />}
      {selectedView === 'class' && <ClassAnalysisView stats={stats} />}
    </div>
  );
}

// KPI Card Component
function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
  trend,
  trendUp
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: any;
  color: string;
  trend?: string;
  trendUp?: boolean;
}) {
  const colorClasses = {
    blue: 'from-blue-500 to-blue-600',
    purple: 'from-purple-500 to-purple-600',
    emerald: 'from-emerald-500 to-emerald-600',
    orange: 'from-orange-500 to-orange-600'
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-500 mb-1">{title}</p>
          <p className="text-2xl font-bold text-slate-800">{value}</p>
        </div>
        <div className={`w-10 h-10 bg-gradient-to-br ${colorClasses[color as keyof typeof colorClasses]} rounded-lg flex items-center justify-center shrink-0 ml-3`}>
          <Icon className="text-white" size={20} />
        </div>
      </div>
      <p className="text-xs text-slate-400 mt-2">{subtitle}</p>
      {trend && (
        <div className="mt-2 flex items-center">
          <span className={`text-xs font-medium ${trendUp ? 'text-green-600' : 'text-red-600'}`}>
            {trend}
          </span>
          <span className="text-xs text-slate-400 ml-2">vs 上周</span>
        </div>
      )}
    </div>
  );
}

// Tab Button
function TabButton({
  active,
  onClick,
  icon: Icon,
  label
}: {
  active: boolean;
  onClick: () => void;
  icon: any;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center px-4 py-2 rounded-lg font-medium text-sm transition-colors whitespace-nowrap ${
        active
          ? 'bg-indigo-50 text-indigo-700'
          : 'text-slate-600 hover:bg-slate-50'
      }`}
    >
      <Icon size={16} className="mr-2" />
      {label}
    </button>
  );
}

// Overview View
function OverviewView({ stats }: { stats: any }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Distribution */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4">每日课程分布</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stats.dailyDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="day" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px'
                }}
              />
              <Bar dataKey="count" fill="#3b82f6" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Subject Distribution */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4">科目分布</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={stats.subjectStats}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {stats.subjectStats.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Time Distribution */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4">上午/下午分布</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={stats.timeDistribution}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                fill="#8884d8"
                paddingAngle={5}
                dataKey="value"
                label
              >
                {stats.timeDistribution.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Class Completion */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4">班级排课完成度</h3>
          <div className="space-y-3">
            {stats.classCompletion.slice(0, 6).map((item: any) => (
              <div key={item.name} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-700 font-medium">{item.name}</span>
                  <span className="text-slate-500">{item.percentage}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2 rounded-full transition-all"
                    style={{ width: `${item.percentage}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Teacher Analysis View
function TeacherAnalysisView({ stats }: { stats: any }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Teacher Workload Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4">教师工作负荷对比</h3>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={stats.teacherWorkload}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              <Bar dataKey="scheduled" fill="#3b82f6" name="已排课时" radius={[8, 8, 0, 0]} />
              <Bar dataKey="total" fill="#e2e8f0" name="计划课时" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Teacher Workload Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4">教师负荷详情</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">教师</th>
                  <th className="text-center py-3 px-4 font-semibold text-slate-700">已排</th>
                  <th className="text-center py-3 px-4 font-semibold text-slate-700">计划</th>
                  <th className="text-center py-3 px-4 font-semibold text-slate-700">完成度</th>
                  <th className="text-center py-3 px-4 font-semibold text-slate-700">状态</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stats.teacherWorkload.map((teacher: any) => {
                  const percentage = parseFloat(teacher.percentage);
                  const status =
                    percentage >= 90
                      ? { label: '饱和', color: 'text-orange-600 bg-orange-50' }
                      : percentage >= 70
                      ? { label: '正常', color: 'text-green-600 bg-green-50' }
                      : { label: '空闲', color: 'text-blue-600 bg-blue-50' };

                  return (
                    <tr key={teacher.name} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-medium text-slate-800">{teacher.name}</td>
                      <td className="py-3 px-4 text-center text-slate-600">{teacher.scheduled}</td>
                      <td className="py-3 px-4 text-center text-slate-600">{teacher.total}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-semibold text-slate-800">{teacher.percentage}%</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
                          {status.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Teacher Performance Radar */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-bold text-slate-800 mb-4">教师综合评估</h3>
          <ResponsiveContainer width="100%" height={400}>
            <RadarChart data={stats.teacherRadarData}>
              <PolarGrid stroke="#e2e8f0" />
              <PolarAngleAxis dataKey="subject" stroke="#64748b" />
              <PolarRadiusAxis stroke="#64748b" />
              <Radar name="评估指标" dataKey="A" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
      </div>
    </div>
  );
}



// Course Analysis View
function CourseAnalysisView({ stats }: { stats: any }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Subject Distribution Bar */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4">科目课时分布</h3>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={stats.subjectStats}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px'
                }}
              />
              <Bar dataKey="value" fill="#8b5cf6" radius={[8, 8, 0, 0]}>
                {stats.subjectStats.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Course Quality Metrics */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4">课程质量指标</h3>
          <div className="space-y-6">
            {stats.qualityMetrics.map((metric: any) => (
              <div key={metric.label}>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-700">{metric.label}</span>
                  <span className="font-semibold text-slate-800">{metric.value}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-3">
                  <div className={`bg-gradient-to-r ${metric.colors} h-3 rounded-full`} style={{ width: `${metric.value}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Weekly Trend */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-bold text-slate-800 mb-4">每日科目课时分布</h3>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={stats.dailySubjectTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="day" stroke="#64748b" />
            <YAxis stroke="#64748b" />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: '8px'
              }}
            />
            <Legend />
            {(stats.topSubjects || []).map((sub: string, idx: number) => (
              <Area key={sub} type="monotone" dataKey={sub} stackId="1" stroke={COLORS[idx % COLORS.length]} fill={COLORS[idx % COLORS.length]} fillOpacity={0.6} />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// Class Analysis View
function ClassAnalysisView({ stats }: { stats: any }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Class Completion Progress */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4">班级排课进度</h3>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={stats.classCompletion}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" stroke="#64748b" angle={-45} textAnchor="end" height={80} />
              <YAxis stroke="#64748b" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px'
                }}
              />
              <Bar dataKey="completed" fill="#3b82f6" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Class Ranking */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4">班级排名</h3>
          <div className="space-y-3">
            {stats.classCompletion
              .sort((a: any, b: any) => parseFloat(b.percentage) - parseFloat(a.percentage))
              .slice(0, 8)
              .map((cls: any, idx: number) => (
                <div key={cls.name} className="flex items-center space-x-3 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                      idx === 0
                        ? 'bg-yellow-400 text-yellow-900'
                        : idx === 1
                        ? 'bg-slate-300 text-slate-700'
                        : idx === 2
                        ? 'bg-orange-400 text-orange-900'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {idx + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-medium text-slate-800">{cls.name}</span>
                      <span className="text-sm font-semibold text-slate-700">{cls.percentage}%</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-1.5">
                      <div
                        className="bg-gradient-to-r from-indigo-500 to-purple-500 h-1.5 rounded-full"
                        style={{ width: `${cls.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Class Schedule Balance */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-bold text-slate-800 mb-4">班级课程均衡度分析</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={stats.classBalanceData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="class" stroke="#64748b" />
            <YAxis stroke="#64748b" />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: '8px'
              }}
            />
            <Legend />
            <Line type="monotone" dataKey="主科" stroke="#3b82f6" strokeWidth={2} />
            <Line type="monotone" dataKey="副科" stroke="#8b5cf6" strokeWidth={2} />
            <Line type="monotone" dataKey="其他" stroke="#10b981" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
