import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Clock, 
  MapPin, 
  BookOpen, 
  Check, 
  X, 
  Save,
  HelpCircle,
  Plus,
  Trash2,
  AlertTriangle,
  CalendarOff,
  Info,
  Settings,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '../lib/store';

const TABS = [
  { id: 'time', label: '基本时间约束', icon: Clock },
  { id: 'teacher', label: '教师偏好', icon: Users },
  { id: 'course', label: '课程分布', icon: BookOpen },
];

const DEFAULT_PERIODS = [
  { id: 0, time: '08:00-08:45', label: '第1节' },
  { id: 1, time: '08:55-09:40', label: '第2节' },
  { id: 2, time: '10:00-10:45', label: '第3节' },
  { id: 3, time: '10:55-11:40', label: '第4节' },
  { id: 4, time: '14:00-14:45', label: '第5节' },
  { id: 5, time: '14:55-15:40', label: '第6节' },
  { id: 6, time: '16:00-16:45', label: '第7节' },
  { id: 7, time: '16:55-17:40', label: '第8节' },
];

export default function RulesConfiguration() {
  const [activeTab, setActiveTab] = useState('time');
  const [isSaving, setIsSaving] = useState(false);
  const { scheduleRules, saveScheduleRule, updateScheduleRule, fetchScheduleRules, initDraftRuleConfig, draftRuleConfig } = useAppStore();

  // 加载已有规则并初始化草稿
  useEffect(() => {
    fetchScheduleRules().then(() => {
      initDraftRuleConfig();
    });
  }, []);

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      const draft = useAppStore.getState().draftRuleConfig;
      // 定义 4 类规则的基础分类体系，配置项直接合并来自 Zustand draft 中的实时状态
      const ruleCategories = [
        {
          rule_type: 'time_constraints',
          config: draft['time_constraints'] || { workDays: [true, true, true, true, true, false, false], periods: DEFAULT_PERIODS, lunchBreakEnabled: true, avoidWeekend: true },
          enabled: true,
          priority: 'high',
        },
        {
          rule_type: 'teacher_preferences',
          config: draft['teacher_preferences'] || { maxConsecutive: 2, maxDaily: 4, allowMultiCampus: true, preferMorning: true, avoidFirstLast: true },
          enabled: true,
          priority: 'high',
        },
        {
          rule_type: 'course_distribution',
          config: draft['course_distribution'] || {
            rules: [
              { subject: '语文', rule: '每天不超过1节', priority: 'high', enabled: true },
              { subject: '数学', rule: '每天不超过1节', priority: 'high', enabled: true },
              { subject: '体育', rule: '不连堂', priority: 'medium', enabled: true },
              { subject: '英语', rule: '避开第1节', priority: 'low', enabled: false },
            ],
            distributionMode: 'balanced',
            minIntervalDays: 1,
          },
          enabled: true,
          priority: 'medium',
        },
      ];

      for (const category of ruleCategories) {
        const existing = scheduleRules.find((r: any) => r.rule_type === category.rule_type);
        if (existing) {
          await updateScheduleRule(existing.id, {
            config: category.config,
            enabled: category.enabled,
            priority: category.priority,
          });
        } else {
          await saveScheduleRule({
            semester_id: null,
            rule_type: category.rule_type,
            config: category.config,
            enabled: category.enabled,
            priority: category.priority,
          } as any);
        }
      }
      await fetchScheduleRules();
      toast.success('规则配置已保存到数据库');
    } catch (err: any) {
      toast.error(`保存失败: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">排课规则设置</h1>
        <p className="text-slate-500 mt-2">配置自动排课算法的约束条件与偏好，规则越详细，排课结果越精准。</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex min-h-[600px]">
        {/* Left Sidebar */}
        <div className="w-64 bg-slate-50 border-r border-slate-200 flex flex-col">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center px-6 py-4 transition-colors border-l-4 ${
                activeTab === tab.id
                  ? 'bg-white border-blue-600 text-blue-600 font-medium'
                  : 'border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <tab.icon size={20} className="mr-3" />
              {tab.label}
            </button>
          ))}
          
          <div className="mt-auto p-6 border-t border-slate-200">
             <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
               <div className="flex items-start text-blue-800">
                 <HelpCircle size={18} className="mt-0.5 mr-2 shrink-0" />
                 <div>
                   <h4 className="font-bold text-sm">配置生效概览</h4>
                   <div className="text-xs mt-2 space-y-1 opacity-90">
                     <p>• 基础约束：<span className="font-bold">已启用</span></p>
                     <p>• 教师偏好：连堂≤<span className="font-bold">{draftRuleConfig['teacher_preferences']?.maxConsecutive || 2}</span>, 日≤<span className="font-bold">{draftRuleConfig['teacher_preferences']?.maxDaily || 4}</span></p>
                     <p>• 特殊个例：<span className="font-bold">{Object.keys(draftRuleConfig['teacher_preferences']?.customPrefs || {}).length}</span> 人已定</p>
                     <p>• 课程分布：<span className="font-bold">{draftRuleConfig['course_distribution']?.rules?.length || 0}</span> 条记录</p>
                   </div>
                 </div>
               </div>
             </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 p-8 overflow-y-auto">
          {activeTab === 'time' && <TimeConstraints />}
          {activeTab === 'teacher' && <TeacherPreferences />}
          {activeTab === 'course' && <CourseDistribution />}
        </div>
      </div>

      <div className="mt-6 flex justify-end space-x-4">
        <button 
          onClick={() => {
            const ruleMapping: Record<string, string> = {
              'time': 'time_constraints',
              'teacher': 'teacher_preferences',
              'course': 'course_distribution'
            };
            const targetType = ruleMapping[activeTab];
            if (targetType) {
              const dbRule = scheduleRules.find((r: any) => r.rule_type === targetType);
              useAppStore.getState().setDraftRuleConfig(targetType, dbRule?.config || {});
              toast.success(`已恢复当前页为最近一次保存的状态`);
            }
          }}
          className="px-6 py-2 border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-50"
        >
          重置当前页
        </button>
        <button 
          onClick={handleSaveAll}
          disabled={isSaving}
          className="px-6 py-2 bg-indigo-600 rounded-lg text-white font-medium hover:bg-indigo-700 shadow-sm flex items-center disabled:opacity-50"
        >
          {isSaving ? <Loader2 size={18} className="mr-2 animate-spin" /> : <Save size={18} className="mr-2" />}
          保存所有设置
        </button>
      </div>
    </div>
  );
}

// 1. 基本时间约束
function TimeConstraints() {
  const { draftRuleConfig, setDraftRuleConfig } = useAppStore();
  const config = draftRuleConfig['time_constraints'] || { workDays: [true, true, true, true, true, false, false], lunchBreakEnabled: true, avoidWeekend: true, periods: DEFAULT_PERIODS };
  const workDays = config.workDays || [true, true, true, true, true, false, false];
  const periods = config.periods || DEFAULT_PERIODS;

  const updateConfig = (updates: any) => {
    setDraftRuleConfig('time_constraints', { ...config, ...updates });
  };

  const addPeriod = () => {
    const newId = periods.length > 0 ? Math.max(...periods.map((p: any) => p.id)) + 1 : 0;
    const newPeriod = { id: newId, time: '00:00-00:45', label: `第${periods.length + 1}节` };
    updateConfig({ periods: [...periods, newPeriod] });
  };

  const removePeriod = (id: number) => {
    const newPeriods = periods.filter((p: any) => p.id !== id).map((p: any, idx: number) => ({
      ...p,
      label: `第${idx + 1}节`
    }));
    updateConfig({ periods: newPeriods });
  };

  const updatePeriodTime = (id: number, type: 'start' | 'end', val: string) => {
    const newPeriods = periods.map((p: any) => {
      if (p.id === id) {
        const parts = p.time.split('-');
        const start = parts[0] || '00:00';
        const end = parts[1] || '00:00';
        return { ...p, time: type === 'start' ? `${val}-${end}` : `${start}-${val}` };
      }
      return p;
    });
    updateConfig({ periods: newPeriods });
  };
  const [holidays, setHolidays] = useState<Array<{id: number; name: string; date: string}>>([]);
  const [showAddHoliday, setShowAddHoliday] = useState(false);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-bold text-slate-800">基本时间约束设置</h2>
        <p className="text-sm text-slate-500 mt-1">
          配置学校的工作日、课时时间和节假日安排
        </p>
      </div>

      {/* 工作日设置 */}
      <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
        <h3 className="font-bold text-slate-800 mb-4 flex items-center">
          <Clock size={18} className="mr-2 text-indigo-600" />
          工作日设置
        </h3>
        <div className="grid grid-cols-7 gap-3">
          {['周一', '周二', '周三', '周四', '周五', '周六', '周日'].map((day, idx) => (
            <button
              key={day}
              onClick={() => {
                const newDays = [...workDays];
                newDays[idx] = !newDays[idx];
                updateConfig({ workDays: newDays });
              }}
              className={`py-3 rounded-lg border-2 font-medium text-sm transition-all ${
                workDays[idx]
                  ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
                  : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
              }`}
            >
              {day}
            </button>
          ))}
        </div>
      </div>

      {/* 课节时间设置 */}
      <div className="bg-white rounded-xl p-6 border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-800 flex items-center">
            <Clock size={18} className="mr-2 text-indigo-600" />
            课节时间表
          </h3>
          <div className="flex items-center space-x-4">
            <span className="text-xs text-slate-500">每天共 {periods.length} 节课</span>
            <button onClick={addPeriod} className="flex items-center px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100 font-medium text-xs transition-colors">
              <Plus size={14} className="mr-1" /> 添加一节
            </button>
          </div>
        </div>
        
        <div className="space-y-2">
          {periods.map((period: any, idx: number) => (
            <div key={period.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors group">
              <div className="flex items-center space-x-4">
                <span className="w-16 text-sm font-bold text-slate-700">{period.label}</span>
                <input 
                  type="time" 
                  value={period.time.split('-')[0]}
                  onChange={(e) => updatePeriodTime(period.id, 'start', e.target.value)}
                  className="px-3 py-1 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <span className="text-slate-400">-</span>
                <input 
                  type="time" 
                  value={period.time.split('-')[1]}
                  onChange={(e) => updatePeriodTime(period.id, 'end', e.target.value)}
                  className="px-3 py-1 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <select
                  value={period.segment || (idx < 4 ? 'morning' : idx < 7 ? 'afternoon' : 'evening')}
                  onChange={(e) => {
                    const newPeriods = periods.map((p: any) => p.id === period.id ? { ...p, segment: e.target.value } : p);
                    updateConfig({ periods: newPeriods });
                  }}
                  className="px-2 py-1 border border-slate-300 rounded text-xs focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                >
                  <option value="morning">上午</option>
                  <option value="afternoon">下午</option>
                  <option value="evening">晚自习</option>
                </select>
              </div>
              <div className="flex items-center space-x-2">
                <button onClick={() => removePeriod(period.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 节假日管理 - 功能暂未实装 */}
      <div className="bg-white rounded-xl p-6 border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-800 flex items-center">
            <CalendarOff size={18} className="mr-2 text-indigo-600" />
            节假日设置
          </h3>
        </div>
        <div className="text-center py-8 text-slate-400">
          <CalendarOff size={32} className="mx-auto mb-2 opacity-50" />
          <p className="text-sm">节假日管理功能开发中</p>
          <p className="text-xs mt-1">后续版本将支持自定义节假日排除</p>
        </div>
      </div>

      {/* 全局约束 */}
      <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl p-6 border border-purple-200">
        <h3 className="font-bold text-slate-800 mb-4 flex items-center">
          <Settings size={18} className="mr-2 text-purple-600" />
          全局约束规则
        </h3>
        <div className="space-y-3">
          <label className="flex items-center justify-between cursor-pointer p-3 bg-white rounded-lg hover:bg-slate-50">
            <span className="text-sm text-slate-700">允许周末排课</span>
            <input 
              type="checkbox" 
              checked={!(config.avoidWeekend ?? true)}
              onChange={(e) => updateConfig({ avoidWeekend: !e.target.checked })}
              className="rounded text-indigo-600 focus:ring-indigo-500 border-slate-300" 
            />
          </label>
          <label className="flex items-center justify-between cursor-pointer p-3 bg-white rounded-lg hover:bg-slate-50">
            <span className="text-sm text-slate-700">启用午休时段保护（12:00-14:00）</span>
            <input 
              type="checkbox" 
              checked={config.lunchBreakEnabled ?? true}
              onChange={(e) => updateConfig({ lunchBreakEnabled: e.target.checked })}
              className="rounded text-indigo-600 focus:ring-indigo-500 border-slate-300" 
            />
          </label>
        </div>
      </div>
    </div>
  );
}

// 2. 教师偏好
function TeacherPreferences() {
  const { teachers, draftRuleConfig, setDraftRuleConfig } = useAppStore();
  const config = draftRuleConfig['teacher_preferences'] || { maxConsecutive: 2, maxDaily: 4, allowMultiCampus: true, customPrefs: {} };

  const maxConsecutive = config.maxConsecutive ?? 2;
  const maxDaily = config.maxDaily ?? 4;
  const allowMultiCampus = config.allowMultiCampus ?? true;
  const preferMorning = config.preferMorning ?? false;
  const avoidFirstLast = config.avoidFirstLast ?? true;

  const updateConfig = (updates: any) => {
    setDraftRuleConfig('teacher_preferences', { ...config, ...updates });
  };

  const [selectedTeacherId, setSelectedTeacherId] = useState('');

  // 初始化选中首个教师
  React.useEffect(() => {
    if (teachers.length > 0 && !selectedTeacherId) {
      setSelectedTeacherId(teachers[0].id);
    }
  }, [teachers, selectedTeacherId]);

  const timeConfig = draftRuleConfig['time_constraints'] || {};
  const activePeriods = timeConfig.periods || DEFAULT_PERIODS;

  // 用 activePeriods.length 初始化或者填充已有的列，保证数组不越界
  const preferences = config.customPrefs?.[selectedTeacherId] || Array(5).fill(0).map(() => Array(activePeriods.length).fill(0));

  const toggleCell = (day: number, period: number) => {
    const newPrefs = preferences.map((row: any) => {
       const r = [...row];
       while (r.length <= period) r.push(0);
       return r;
    });
    newPrefs[day][period] = (newPrefs[day][period] + 1) % 3;
    
    updateConfig({ 
      customPrefs: { 
        ...(config.customPrefs || {}), 
        [selectedTeacherId]: newPrefs 
      } 
    });
  };

  const currentTeacher = teachers.find(t => t.id === selectedTeacherId);

  if (teachers.length === 0) {
    return <div className="text-center py-12 text-slate-400">暂无教师数据，请先在基础数据中添加</div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800">教师排课偏好设置</h2>
          <p className="text-sm text-slate-500 mt-1">为每位教师设置个性化的排课时间偏好</p>
        </div>
        <select 
          value={selectedTeacherId}
          onChange={(e: any) => setSelectedTeacherId(e.target.value)}
          className="border border-slate-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none min-w-[200px]"
        >
          {teachers.map(t => <option key={t.id} value={t.id}>{t.name} - {(t.subjects || []).join('/')}</option>)}
        </select>
      </div>

      {/* Teacher Info Card */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold">{currentTeacher?.name}</h3>
            <p className="text-indigo-100 mt-1">任教科目：{(currentTeacher?.subjects || []).join('、')}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-indigo-200">周课时</p>
            <p className="text-3xl font-bold">{(currentTeacher as any)?.max_weekly_hours || 12}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Time Preference Grid */}
        <div className="lg:col-span-2">
           <div className="bg-white rounded-xl p-4 border border-slate-200">
             <p className="text-sm text-slate-500 mb-4">
               点击方格切换状态：
               <span className="inline-flex items-center mx-2">
                 <span className="w-3 h-3 bg-slate-100 border border-slate-300 rounded mr-1"></span> 普通
               </span>
               <span className="inline-flex items-center mx-2">
                 <span className="w-3 h-3 bg-green-100 border border-green-300 rounded mr-1"></span> 偏好时段
               </span>
               <span className="inline-flex items-center mx-2">
                 <span className="w-3 h-3 bg-red-100 border border-red-300 rounded mr-1"></span> 不可用
               </span>
             </p>
             
             <div className="border border-slate-200 rounded-lg overflow-hidden">
               <div className="grid grid-cols-9 bg-slate-100 border-b border-slate-200">
                 <div className="p-2 text-center text-xs font-bold text-slate-500">时间/星期</div>
                 {['周一', '周二', '周三', '周四', '周五'].map(day => (
                   <div key={day} className="col-span-1.6 p-2 text-center text-xs font-bold text-slate-700 border-l border-slate-200">
                     {day}
                   </div>
                 ))}
               </div>
               {activePeriods.map((period: any, periodIdx: number) => (
                 <div key={period.id} className="grid grid-cols-9 border-b border-slate-100 last:border-0">
                   <div className="p-2 flex flex-col items-center justify-center bg-slate-50 text-xs font-medium text-slate-600 border-r border-slate-200">
                     <span className="font-bold">{period.label}</span>
                     <span className="text-[10px] text-slate-400 mt-0.5">{period.time}</span>
                   </div>
                   {[0, 1, 2, 3, 4].map((dayIdx) => {
                     const status = (preferences[dayIdx] || [])[periodIdx] || 0;
                     let bg = 'bg-white hover:bg-slate-50';
                     let icon = null;
                     
                     if (status === 1) {
                       bg = 'bg-green-50 hover:bg-green-100 border-green-200';
                       icon = <Check size={14} className="text-green-600" />;
                     } else if (status === 2) {
                       bg = 'bg-red-50 hover:bg-red-100 border-red-200';
                       icon = <X size={14} className="text-red-600" />;
                     }

                     return (
                       <div 
                         key={dayIdx} 
                         onClick={() => toggleCell(dayIdx, periodIdx)}
                         className={`p-2 border-l border-slate-100 cursor-pointer transition-all flex items-center justify-center min-h-[50px] ${bg}`}
                       >
                         {icon}
                       </div>
                     );
                   })}
                 </div>
               ))}
             </div>
           </div>
        </div>

        {/* Settings Sidebar */}
        <div className="space-y-4">
           <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
             <h3 className="font-bold text-slate-800 mb-4 flex items-center">
               <Settings size={16} className="mr-2" />
               高级设置
             </h3>
             
             <div className="space-y-4">
               <div>
                 <label className="text-sm text-slate-700 mb-2 block">最大连堂数</label>
                 <div className="flex items-center border border-slate-300 rounded-lg bg-white">
                   <button 
                     onClick={() => updateConfig({ maxConsecutive: Math.max(1, maxConsecutive - 1) })}
                     className="px-3 py-2 hover:bg-slate-50 border-r border-slate-200"
                   >
                     -
                   </button>
                   <span className="px-4 py-2 text-sm font-medium flex-1 text-center">{maxConsecutive}</span>
                   <button 
                     onClick={() => updateConfig({ maxConsecutive: Math.min(4, maxConsecutive + 1) })}
                     className="px-3 py-2 hover:bg-slate-50 border-l border-slate-200"
                   >
                     +
                   </button>
                 </div>
               </div>

               <div>
                 <label className="text-sm text-slate-700 mb-2 block">每日最大课时</label>
                 <div className="flex items-center border border-slate-300 rounded-lg bg-white">
                   <button 
                     onClick={() => updateConfig({ maxDaily: Math.max(1, maxDaily - 1) })}
                     className="px-3 py-2 hover:bg-slate-50 border-r border-slate-200"
                   >
                     -
                   </button>
                   <span className="px-4 py-2 text-sm font-medium flex-1 text-center">{maxDaily}</span>
                   <button 
                     onClick={() => updateConfig({ maxDaily: Math.min(8, maxDaily + 1) })}
                     className="px-3 py-2 hover:bg-slate-50 border-l border-slate-200"
                   >
                     +
                   </button>
                 </div>
               </div>
               
               <div className="pt-4 border-t border-slate-200 space-y-3">
                 <label className="flex items-center space-x-2 cursor-pointer">
                   <input 
                     type="checkbox" 
                     checked={allowMultiCampus}
                     onChange={(e) => updateConfig({ allowMultiCampus: e.target.checked })}
                     className="rounded text-blue-600 focus:ring-blue-500 border-slate-300" 
                   />
                   <span className="text-sm text-slate-700">允许跨校区排课</span>
                 </label>
                 <label className="flex items-center space-x-2 cursor-pointer">
                   <input 
                     type="checkbox" 
                     checked={preferMorning}
                     onChange={(e) => updateConfig({ preferMorning: e.target.checked })}
                     className="rounded text-blue-600 focus:ring-blue-500 border-slate-300" 
                   />
                   <span className="text-sm text-slate-700">优先安排上午时段</span>
                 </label>
                 <label className="flex items-center space-x-2 cursor-pointer">
                   <input 
                     type="checkbox" 
                     checked={avoidFirstLast}
                     onChange={(e) => updateConfig({ avoidFirstLast: e.target.checked })}
                     className="rounded text-blue-600 focus:ring-blue-500 border-slate-300" 
                   />
                   <span className="text-sm text-slate-700">避免第一节和最后一节</span>
                 </label>
               </div>
             </div>
           </div>

           {(() => {
              const { classGroups: cgs } = useAppStore.getState();
              const headClass = cgs.find((c) => (c.head_teacher_id || c.headTeacherId) === selectedTeacherId);
              if (!headClass) return null;
              return (
                <div className="bg-yellow-50 rounded-xl p-5 border border-yellow-200">
                  <div className="flex items-start">
                    <AlertTriangle size={16} className="text-yellow-600 mr-2 mt-0.5 shrink-0" />
                    <div>
                      <h3 className="font-bold text-yellow-800 mb-1 text-sm">班主任提示</h3>
                      <p className="text-xs text-yellow-700 leading-relaxed">
                        {currentTeacher?.name} 同时担任 {headClass.name} 班主任，建议预留班会时间。
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()}

           {(() => {
              const prefs = preferences;
              const greenCount = prefs.flat().filter((v) => v === 1).length;
              const redCount = prefs.flat().filter((v) => v === 2).length;
              const totalCells = 5 * (activePeriods?.length || 8);
              const pct = totalCells > 0 ? Math.round((greenCount + redCount) / totalCells * 100) : 0;
              return (
                <div className="bg-blue-50 rounded-xl p-5 border border-blue-200">
                  <div className="flex items-start">
                    <Info size={16} className="text-blue-600 mr-2 mt-0.5 shrink-0" />
                    <div>
                      <h3 className="font-bold text-blue-800 mb-1 text-sm">智能建议</h3>
                      <p className="text-xs text-blue-700 leading-relaxed">
                        {pct === 0
                          ? `当前未为 ${currentTeacher?.name} 设置个人时间偏好，点击左侧时间表配置。`
                          : `已配置 ${pct}% 时段（偏好 ${greenCount} 个，不可用 ${redCount} 个），排课引擎将自动尊重这些偏好。`
                        }
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()}
        </div>
      </div>
    </div>
  );
}

// 3. 课程分布
function CourseDistribution() {
  const { draftRuleConfig, setDraftRuleConfig, coursePlans } = useAppStore();
  const config = draftRuleConfig['course_distribution'] || { rules: [] };
  const rules = config.rules || [];

  const updateRules = (newRules: any[]) => {
    setDraftRuleConfig('course_distribution', { ...config, rules: newRules });
  };

  const [showAddForm, setShowAddForm] = useState(false);
  const allSubjects = [...new Set(coursePlans.map(cp => cp.subject))].filter(Boolean);
  if (allSubjects.length === 0) allSubjects.push('语文', '数学', '英语', '物理', '化学');
  
  const [newRule, setNewRule] = useState({ subject: allSubjects[0] || '语文', rule: '每天不超过1节', priority: 'high', enabled: true });

  const subjectColors: Record<string, string> = {
    '语文': 'bg-red-100 text-red-700 border-red-200',
    '数学': 'bg-blue-100 text-blue-700 border-blue-200',
    '英语': 'bg-purple-100 text-purple-700 border-purple-200',
    '物理': 'bg-indigo-100 text-indigo-700 border-indigo-200',
    '化学': 'bg-emerald-100 text-emerald-700 border-emerald-200',
    '体育': 'bg-orange-100 text-orange-700 border-orange-200',
  };

  const applyTemplate = (type: 'balanced' | 'concentrated' | 'golden') => {
    let newRules: any[] = [];
    let idCounter = Date.now();
    
    const cores = ['语文', '数学', '英语', '物理', '化学', '生物', '政治', '历史', '地理'];
    const minors = ['体育', '音乐', '美术', '信息技术', '心理健康', '通用技术', '劳动'];
    const activeSubjects = allSubjects.length > 0 ? allSubjects : [...cores, ...minors];
    
    const coreActive = activeSubjects.filter(s => cores.includes(s));
    const minorActive = activeSubjects.filter(s => minors.includes(s));

    // 取出或新建目前全局教师偏好草稿，准备发生联动跨板修改
    const teacherPrefs = { 
       maxConsecutive: 2, 
       maxDaily: 4, 
       allowMultiCampus: true, 
       preferMorning: false,
       avoidFirstLast: true,
       customPrefs: {},
       ...(draftRuleConfig['teacher_preferences'] || {})
    };

    if (type === 'balanced') {
      teacherPrefs.maxConsecutive = 2; // 严格限连堂
      teacherPrefs.maxDaily = 4;
      teacherPrefs.preferMorning = false;
      teacherPrefs.avoidFirstLast = true;
      
      coreActive.forEach(sub => {
        newRules.push({ id: idCounter++, subject: sub, rule: '每天不超过1节', priority: 'high', enabled: true });
        newRules.push({ id: idCounter++, subject: sub, rule: '不连堂', priority: 'high', enabled: true });
      });
      minorActive.forEach(sub => {
        newRules.push({ id: idCounter++, subject: sub, rule: '不连堂', priority: 'medium', enabled: true });
        newRules.push({ id: idCounter++, subject: sub, rule: '避开第1节', priority: 'low', enabled: true });
      });
      toast.success(`已应用「均衡分布」：并已联动压制教师连堂上限为 2，共生成 ${newRules.length} 条全盘规则`);
    } else if (type === 'concentrated') {
      teacherPrefs.maxConsecutive = 4; // 集中排课必须跨版块解锁教师负荷，否则引擎仍会拦截！
      teacherPrefs.maxDaily = 6;
      teacherPrefs.preferMorning = false;
      teacherPrefs.avoidFirstLast = false;
      
      minorActive.forEach(sub => {
        newRules.push({ id: idCounter++, subject: sub, rule: '每天不超过1节', priority: 'high', enabled: true });
        newRules.push({ id: idCounter++, subject: sub, rule: '不连堂', priority: 'medium', enabled: true });
      });
      toast.success(`已应用「集中排课」：已联动提升教师连堂上限至 4，解放主科大考排版，共生成 ${newRules.length} 条规则`);
    } else if (type === 'golden') {
      teacherPrefs.maxConsecutive = 2;
      teacherPrefs.maxDaily = 5;
      teacherPrefs.preferMorning = true; // 黄金时段强制开启偏好上午
      teacherPrefs.avoidFirstLast = true;
      
      const goldenCores = ['语文', '数学', '英语'];
      const goldenActive = activeSubjects.filter(s => goldenCores.includes(s));
      const otherActive = activeSubjects.filter(s => !goldenCores.includes(s));

      goldenActive.forEach(sub => {
        newRules.push({ id: idCounter++, subject: sub, rule: '每天不超过1节', priority: 'high', enabled: true });
        newRules.push({ id: idCounter++, subject: sub, rule: '不连堂', priority: 'high', enabled: true });
      });
      otherActive.forEach(sub => {
        newRules.push({ id: idCounter++, subject: sub, rule: '避开第1节', priority: 'high', enabled: true });
        if (minors.includes(sub)) {
           newRules.push({ id: idCounter++, subject: sub, rule: '不连堂', priority: 'medium', enabled: true });
        }
      });
      toast.success(`已应用「黄金时段」：已联动保障早间时段供语数外专属，共生成 ${newRules.length} 条规则`);
    }

    // 联动执行双份保存！让整个草稿库一起翻新
    setDraftRuleConfig('teacher_preferences', teacherPrefs);
    updateRules(newRules); // 包含了 setDraftRuleConfig('course_distribution', ...)
    toast.info('⚠️ 模板已覆写草稿，请点底部“保存所有设置”以落库生效', { duration: 5000 });
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800">课程分布规则设置</h2>
          <p className="text-sm text-slate-500 mt-1">配置各科目的排课分布策略，确保课程合理分散</p>
        </div>
        <button 
          onClick={() => setShowAddForm(true)}
          className="flex items-center px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 font-medium text-sm">
          <Plus size={18} className="mr-2" />
          添加新规则
        </button>
      </div>

      {showAddForm && (
        <div className="bg-indigo-50 p-4 border border-indigo-100 rounded-xl flex items-end gap-4">
          <div className="flex-1">
            <label className="text-xs text-indigo-800 font-bold block mb-1">科目</label>
            <select value={newRule.subject} onChange={e => setNewRule({...newRule, subject: e.target.value})} className="w-full text-sm border border-indigo-200 rounded px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500">
              {allSubjects.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex-[2]">
            <label className="text-xs text-indigo-800 font-bold block mb-1">系统策略</label>
            <select value={newRule.rule} onChange={e => setNewRule({...newRule, rule: e.target.value})} className="w-full text-sm border border-indigo-200 rounded px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="每天不超过1节">每天不超过1节（核心主科打分降权）</option>
              <option value="避开第1节">避开第1节（文体特长科极强回避）</option>
              <option value="不连堂">不连堂（限制连续两节同科目）</option>
            </select>
          </div>
          <div className="flex-[0.8]">
            <label className="text-xs text-indigo-800 font-bold block mb-1">优先级</label>
            <select value={newRule.priority} onChange={e => setNewRule({...newRule, priority: e.target.value})} className="w-full text-sm border border-indigo-200 rounded px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="high">高</option>
              <option value="medium">中</option>
              <option value="low">低</option>
            </select>
          </div>
          <div className="flex space-x-2">
            <button 
              onClick={() => {
                updateRules([...rules, { ...newRule, id: Date.now() }]);
                setShowAddForm(false);
              }} 
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition"
            >
              保存
            </button>
            <button 
              onClick={() => setShowAddForm(false)} 
              className="bg-white text-slate-600 border border-slate-300 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
          <p className="text-sm text-blue-600 font-medium">总规则数</p>
          <p className="text-3xl font-bold text-blue-900 mt-1">{rules.length}</p>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
          <p className="text-sm text-green-600 font-medium">已启用</p>
          <p className="text-3xl font-bold text-green-900 mt-1">{rules.filter(r => r.enabled).length}</p>
        </div>
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4 border border-orange-200">
          <p className="text-sm text-orange-600 font-medium">高优先级</p>
          <p className="text-3xl font-bold text-orange-900 mt-1">{rules.filter(r => r.priority === 'high').length}</p>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
          <p className="text-sm text-purple-600 font-medium">科目覆盖</p>
          <p className="text-3xl font-bold text-purple-900 mt-1">{new Set(rules.map(r => r.subject)).size}</p>
        </div>
      </div>

      {/* Subject Rules */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-3">
          <div className="grid grid-cols-12 gap-4 text-sm font-bold text-slate-600">
            <div className="col-span-2">科目</div>
            <div className="col-span-4">规则描述</div>
            <div className="col-span-2">优先级</div>
            <div className="col-span-2">状态</div>
            <div className="col-span-2">操作</div>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {rules.map((rule) => (
            <div key={rule.id} className="px-6 py-4 hover:bg-slate-50 transition-colors">
              <div className="grid grid-cols-12 gap-4 items-center">
                <div className="col-span-2">
                  <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium border ${subjectColors[rule.subject] || 'bg-slate-100 text-slate-700'}`}>
                    {rule.subject}
                  </span>
                </div>
                <div className="col-span-4">
                  <p className="text-sm text-slate-700">{rule.rule}</p>
                </div>
                <div className="col-span-2">
                  <select 
                    value={rule.priority}
                    onChange={(e) => updateRules(rules.map((r: any) => r.id === rule.id ? { ...r, priority: e.target.value } : r))}
                    className="text-sm border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="high">高</option>
                    <option value="medium">中</option>
                    <option value="low">低</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={rule.enabled} 
                      onChange={() => updateRules(rules.map((r: any) => r.id === rule.id ? { ...r, enabled: !r.enabled } : r))} 
                      className="sr-only peer" 
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>
                <div className="col-span-2 flex space-x-2">
                  <button 
                    onClick={() => updateRules(rules.filter((r: any) => r.id !== rule.id))}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Common Distribution Patterns */}
      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-6 border border-indigo-200 mt-8">
        <h3 className="font-bold text-slate-800 mb-4">常用分布模式 (一键覆盖)</h3>
        <div className="grid grid-cols-3 gap-3">
          <button onClick={() => applyTemplate('balanced')} className="p-4 bg-white rounded-lg border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 text-left transition-all group">
            <p className="font-bold text-sm text-slate-800 group-hover:text-indigo-700">均衡分布</p>
            <p className="text-xs text-slate-500 mt-1">主科每天均匀分布，避免偏科疲劳</p>
          </button>
          <button onClick={() => applyTemplate('concentrated')} className="p-4 bg-white rounded-lg border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 text-left transition-all group">
            <p className="font-bold text-sm text-slate-800 group-hover:text-indigo-700">集中排课</p>
            <p className="text-xs text-slate-500 mt-1">解除主科连堂限制，任由高分时序聚集</p>
          </button>
          <button onClick={() => applyTemplate('golden')} className="p-4 bg-white rounded-lg border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 text-left transition-all group">
            <p className="font-bold text-sm text-slate-800 group-hover:text-indigo-700">黄金时段优先</p>
            <p className="text-xs text-slate-500 mt-1">强制其他所有科目避开第一节黄金脑区</p>
          </button>
        </div>
      </div>
    </div>
  );
}