import React, { useState, useMemo, useRef } from 'react';
import { 
  Download, 
  Printer, 
  Calendar,
  ChevronDown,
  FileText,
  Table as TableIcon,
  User,
  Users,
  DoorOpen,
  Eye
} from 'lucide-react';
import { useAppStore } from '../lib/store';
import { ScheduleSlot, Teacher, ClassGroup } from '../lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

const DAYS = ['周一', '周二', '周三', '周四', '周五'];
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

type ViewMode = 'class' | 'teacher';

export default function ScheduleView() {
  const { teachers, classGroups, coursePlans, scheduleSlots, scheduleRules } = useAppStore();
  
  const timeConfig = scheduleRules.find(r => r.rule_type === 'time_constraints')?.config || {};
  const periods = timeConfig.periods || DEFAULT_PERIODS;
  const [viewMode, setViewMode] = useState<ViewMode>('class');
  const [selectedId, setSelectedId] = useState('');
  const [showWeekend, setShowWeekend] = useState(false);

  // 初始化选中首个实体
  React.useEffect(() => {
    if (!selectedId) {
      if (viewMode === 'class' && classGroups.length > 0) setSelectedId(classGroups[0].id);
      else if (viewMode === 'teacher' && teachers.length > 0) setSelectedId(teachers[0].id);
    }
  }, [viewMode, classGroups, teachers, selectedId]);

  const schedule = scheduleSlots as any[];

  // Get current entity based on view mode
  const getCurrentEntity = () => {
    switch (viewMode) {
      case 'class':
        return classGroups.find((c: any) => c.id === selectedId);
      case 'teacher':
        return teachers.find((t: any) => t.id === selectedId);
      default:
        return null;
    }
  };

  // Filter schedule based on view mode
  const filteredSchedule = useMemo(() => {
    switch (viewMode) {
      case 'class':
        return schedule.filter((slot: any) => {
          const cp: any = coursePlans.find((c: any) => c.id === (slot.course_plan_id || slot.coursePlanId));
          return cp && (cp.class_id || cp.classId) === selectedId;
        });
      case 'teacher':
        return schedule.filter((slot: any) => {
          const cp: any = coursePlans.find((c: any) => c.id === (slot.course_plan_id || slot.coursePlanId));
          return cp && (cp.teacher_id || cp.teacherId) === selectedId;
        });
      default:
        return [];
    }
  }, [viewMode, selectedId, schedule, coursePlans]);

  // Get course info for a specific slot
  const getCourseInfo = (day: number, period: number) => {
    const slots = filteredSchedule.filter((slot: any) => slot.day === day && slot.period === period);
    return slots.map((slot: any) => {
      const coursePlanId = slot.course_plan_id || slot.coursePlanId;
      const course: any = coursePlans.find((c: any) => c.id === coursePlanId);
      const classId = course?.class_id || course?.classId;
      const classInfo = classGroups.find((c: any) => c.id === classId);
      const teacher = teachers.find((t: any) => t.id === course?.teacher_id || t.id === course?.teacherId);
      return {
        slot,
        course,
        classInfo,
        teacher
      };
    });
  };

  // Handle export to Excel
  const handleExportExcel = async () => {
    if (!currentEntity) return;

    try {
      toast.info('正在生成课表 Excel 文件...');

      // 准备数据行，使用 json_to_sheet 来保障强兼容性
      const scheduleData = periods.map(period => {
        const row: any = {
          '时间 / 星期': `${period.label} (${period.time})`
        };
        DAYS.forEach((day, dayIdx) => {
          const courseInfos = getCourseInfo(dayIdx, period.id);
          if (courseInfos.length === 0) {
            row[day] = '-';
          } else {
            const cellTexts = courseInfos.map(info => {
              const subject = (info.course as any)?.subject_name || (info.course as any)?.subject || '未知';
              if (viewMode === 'class') {
                return `${subject} (${(info.teacher as any)?.name || '未安排'})`;
              } else if (viewMode === 'teacher') {
                return `${subject} (${(info.classInfo as any)?.name || '未知班级'})`;
              } else {
                return `${subject} (${(info.classInfo as any)?.name || '未知班级'} - ${(info.teacher as any)?.name || '未安排'})`;
              }
            });
            // 使用 / 来分隔多门课（极少情况），避免 \n 在基础版 excel 中不换行导致拥挤
            row[day] = cellTexts.join(' / ');
          }
        });
        return row;
      });

      const worksheetName = currentEntity ? (currentEntity as any).name : '排课表';

      const ws = XLSX.utils.json_to_sheet(scheduleData);

      // 设置列宽
      ws['!cols'] = [
        { wch: 22 }, // 时间 / 星期
        { wch: 20 },
        { wch: 20 },
        { wch: 20 },
        { wch: 20 },
        { wch: 20 }
      ];

      const wb = XLSX.utils.book_new();
      
      // 添加说明信息到工作表末尾，避免干扰主表结构
      const subtitle = 
        viewMode === 'class' ? `${(currentEntity as any)?.grade || ''}年级 | 学年：${(currentEntity as any)?.academicYear || (currentEntity as any)?.academic_year || '未设置'}` :
        `任教科目：${((currentEntity as any)?.subjects || []).join('、')}`;
        
      XLSX.utils.sheet_add_aoa(ws, [
        [],
        ['备注说明：', subtitle],
        ['生成时间：', new Date().toLocaleString('zh-CN')]
      ], { origin: -1 });

      XLSX.utils.book_append_sheet(wb, ws, "课程表");
      
      // 第1重防御：强制清洗所有破坏属性声明的隐形换行和非法字符
      const safeFilename = `${worksheetName}_课表`.replace(/[\r\n\t\\/:*?"<>|]/g, '').trim();
      
      // 第2重防御：使用精准的 XLSX MIME 类型
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      
      // 终极绝杀：直接动用系统底层的 File System Access API 唤起真正系统的原生物理保存窗（直接击穿任何假点击拦截）
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
          toast.success('课表 Excel 导出成功！');
          return;
        } catch (err: any) {
          if (err.name !== 'AbortError') {
            console.error('SaveFilePicker 失败，启用备选下载方案:', err);
          } else {
            return; // 用户主动取消保存
          }
        }
      }

      // 如果浏览器实在太老不支持物理API，启动原先增强版的挂载式备选方案
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${safeFilename}.xlsx`;
      document.body.appendChild(link);
      
      link.click();
      
      setTimeout(() => {
        if (document.body.contains(link)) {
          document.body.removeChild(link);
        }
        URL.revokeObjectURL(url);
      }, 2000);
      
      toast.success('课表 Excel 导出成功！');
    } catch (error) {
      console.error('导出 Excel 失败:', error);
      toast.error(`导出失败: ${(error as Error).message}`);
    }
  };

  // Get statistics
  const getStatistics = () => {
    // 强制防穿透过滤，确保只有真实的排课落在了统计网格里
    const validSlots = filteredSchedule.filter((s: any) => s.day != null && s.period != null);
    const totalSlots = validSlots.length;
    const subjects = new Set(validSlots.map((slot: any) => {
      const course = coursePlans.find((c: any) => c.id === (slot.course_id || slot.courseId));
      return (course as any)?.subject_name || (course as any)?.subject;
    }));
    
    return {
      totalSlots,
      uniqueSubjects: subjects.size,
      emptySlots: (DAYS.length * periods.length) - totalSlots
    };
  };

  const stats = getStatistics();
  const currentEntity = getCurrentEntity();

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">课程表查看</h1>
          <p className="text-slate-500 mt-1">查看和导出各班级、教师的课程安排</p>
        </div>
        <div className="flex space-x-3">
          <button 
            onClick={handleExportExcel}
            className="flex items-center px-4 py-2 bg-indigo-600 rounded-lg text-white hover:bg-indigo-700 font-medium text-sm shadow-sm transition-colors"
          >
            <Download size={18} className="mr-2" />
            导出课表
          </button>
        </div>
      </div>

      {/* View Mode Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <Tabs value={viewMode} onValueChange={(value) => {
          setViewMode(value as ViewMode);
          // Reset selection when changing mode
          if (value === 'class') setSelectedId(classGroups[0]?.id || '');
          else if (value === 'teacher') setSelectedId(teachers[0]?.id || '');
        }}>
          <div className="flex items-center justify-between mb-6">
            <TabsList className="grid w-[260px] grid-cols-2">
              <TabsTrigger value="class" className="flex items-center">
                <Users size={16} className="mr-2" />
                按班级
              </TabsTrigger>
              <TabsTrigger value="teacher" className="flex items-center">
                <User size={16} className="mr-2" />
                按教师
              </TabsTrigger>
            </TabsList>

            {/* Selector */}
            <div className="flex items-center space-x-3">
              <label className="text-sm text-slate-600 font-medium">选择查看：</label>
              {viewMode === 'class' && (
                <Select value={selectedId} onValueChange={setSelectedId}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {classGroups.map((cls: any) => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {viewMode === 'teacher' && (
                <Select value={selectedId} onValueChange={setSelectedId}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {teachers.map((teacher: any) => (
                      <SelectItem key={teacher.id} value={teacher.id}>
                        {teacher.name} - {(teacher.subjects || []).join(', ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

            </div>
          </div>

          {/* Statistics Cards */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-600 font-medium">已排课时</p>
                  <p className="text-2xl font-bold text-blue-900 mt-1">{stats.totalSlots}</p>
                </div>
                <div className="w-12 h-12 bg-blue-200 rounded-full flex items-center justify-center">
                  <Calendar className="text-blue-700" size={24} />
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-purple-600 font-medium">科目数量</p>
                  <p className="text-2xl font-bold text-purple-900 mt-1">{stats.uniqueSubjects}</p>
                </div>
                <div className="w-12 h-12 bg-purple-200 rounded-full flex items-center justify-center">
                  <FileText className="text-purple-700" size={24} />
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg p-4 border border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 font-medium">空闲课时</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{stats.emptySlots}</p>
                </div>
                <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center">
                  <TableIcon className="text-slate-700" size={24} />
                </div>
              </div>
            </div>
          </div>

          {/* Schedule Table */}
          <TabsContent value={viewMode} className="mt-0">
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden print:border-0 relative">
              {/* Table Header - Entity Info */}
              <div className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white p-6 print:bg-white print:text-slate-900 print:border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold">
                      {viewMode === 'class' && (currentEntity as any)?.name}
                      {viewMode === 'teacher' && `${(currentEntity as any)?.name} 的课程表`}
                    </h2>
                    <p className="text-indigo-100 mt-1 text-sm print:text-slate-600">
                      {viewMode === 'class' && `${(currentEntity as any)?.grade || ''}年级 | 学年：${(currentEntity as any)?.academicYear || (currentEntity as any)?.academic_year || '未设置'}`}
                      {viewMode === 'teacher' && `任教科目：${((currentEntity as any)?.subjects || []).join('、')}`}
                    </p>
                  </div>
                  <div className="text-right print:hidden">
                    <p className="text-sm text-indigo-200">2025-2026学年 上学期</p>
                    <p className="text-xs text-indigo-200 mt-1">生成时间：{new Date().toLocaleString('zh-CN')}</p>
                  </div>
                </div>
              </div>

              {/* Schedule Grid */}
              <div className="overflow-x-auto print:overflow-visible">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b-2 border-slate-300">
                      <th className="border border-slate-300 px-4 py-3 text-slate-700 font-semibold w-32">
                        时间/星期
                      </th>
                      {DAYS.map((day, idx) => (
                        <th key={idx} className="border border-slate-300 px-4 py-3 text-slate-700 font-semibold">
                          {day}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {periods.map((period: any) => (
                      <tr key={period.id} className="hover:bg-slate-50 transition-colors">
                        <td className="border border-slate-300 px-4 py-3 bg-slate-50">
                          <div className="text-center">
                            <p className="font-semibold text-slate-800">{period.label}</p>
                            <p className="text-xs text-slate-500 mt-1">{period.time}</p>
                          </div>
                        </td>
                        {DAYS.map((_, dayIdx) => {
                          const courseInfos = getCourseInfo(dayIdx, period.id);
                          return (
                            <td key={dayIdx} className="border border-slate-300 p-2 align-top">
                              {courseInfos.length > 0 ? (
                                <div className="space-y-1">
                                  {courseInfos.map((info, idx) => (
                                    <CourseCard
                                      key={idx}
                                      courseInfo={info}
                                      viewMode={viewMode}
                                    />
                                  ))}
                                </div>
                              ) : (
                                <div className="h-20 flex items-center justify-center text-slate-300 text-xs">
                                  -
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Footer Notes */}
              <div className="bg-slate-50 border-t border-slate-200 p-4 print:bg-white">
                <div className="grid grid-cols-2 gap-4 text-xs text-slate-600">
                  <div>
                    <p className="font-semibold text-slate-700 mb-2">备注说明：</p>
                    <ul className="space-y-1 list-disc list-inside">
                      <li>上午课程时间：08:00 - 11:40</li>
                      <li>下午课程时间：14:00 - 17:40</li>
                      <li>课间休息时间：10分钟</li>
                    </ul>
                  </div>
                  <div className="text-right">
                    <p className="text-slate-500">
                      {viewMode === 'class' && `班主任：${teachers.find((t: any) => t.id === (currentEntity as any)?.head_teacher_id || (currentEntity as any)?.headTeacherId)?.name || '-'}`}
                      {viewMode === 'teacher' && `联系方式：${(currentEntity as any)?.phone || '-'}`}

                    </p>
                    <p className="text-slate-400 mt-2 print:block">打印日期：{new Date().toLocaleDateString('zh-CN')}</p>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Weekly Summary */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 print:hidden">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">周课时统计</h3>
        <WeeklySummary schedule={filteredSchedule} viewMode={viewMode} />
      </div>
    </div>
  );
}

// Course Card Component
function CourseCard({ courseInfo, viewMode }: { courseInfo: any; viewMode: ViewMode }) {
  const { course, classInfo, teacher, room } = courseInfo;

  if (!course) return null;

  return (
    <div className={`${course.color} rounded-lg p-2 border text-xs min-h-[72px]`}>
      <div className="font-semibold text-sm mb-1">{course.subject}</div>
      
      {viewMode === 'class' && (
        <>
          <div className="flex items-center text-xs opacity-80 mt-1">
            <User size={12} className="mr-1" />
            {teacher?.name}
          </div>

        </>
      )}

      {viewMode === 'teacher' && (
        <>
          <div className="flex items-center text-xs opacity-80 mt-1">
            <Users size={12} className="mr-1" />
            {classInfo?.name}
          </div>
        </>
      )}


    </div>
  );
}

// Weekly Summary Component
function WeeklySummary({ schedule, viewMode }: { schedule: ScheduleSlot[]; viewMode: ViewMode }) {
  const { coursePlans } = useAppStore();
  const summary = useMemo(() => {
    const dayCounts = DAYS.map((_, dayIdx) => {
      return schedule.filter((slot: any) => slot.day === dayIdx).length;
    });

    const subjectCounts: Record<string, number> = {};
    schedule.forEach((slot: any) => {
      const course = coursePlans.find((c: any) => c.id === (slot.course_id || slot.courseId));
      if (course) {
        const subjectName = (course as any).subject_name || (course as any).subject || '未知';
        subjectCounts[subjectName] = (subjectCounts[subjectName] || 0) + 1;
      }
    });

    return { dayCounts, subjectCounts };
  }, [schedule, coursePlans]);

  return (
    <div className="space-y-4">
      {/* Daily Distribution */}
      <div>
        <h4 className="text-sm font-medium text-slate-700 mb-3">每日课时分布</h4>
        <div className="grid grid-cols-5 gap-3">
          {DAYS.map((day, idx) => (
            <div key={idx} className="bg-slate-50 rounded-lg p-3 border border-slate-200">
              <p className="text-xs text-slate-500 mb-1">{day}</p>
              <div className="flex items-end space-x-2">
                <p className="text-2xl font-bold text-slate-800">{summary.dayCounts[idx]}</p>
                <p className="text-xs text-slate-500 mb-1">节课</p>
              </div>
              <div className="mt-2 bg-slate-200 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-indigo-500 h-full rounded-full transition-all"
                  style={{ width: `${(summary.dayCounts[idx] / 8) * 100}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Subject Distribution */}
      {viewMode === 'class' && (
        <div>
          <h4 className="text-sm font-medium text-slate-700 mb-3">科目课时统计</h4>
          <div className="grid grid-cols-3 gap-3">
            {Object.entries(summary.subjectCounts).map(([subject, count]) => {
              const course: any = coursePlans.find((c: any) => (c.subject_name || c.subject) === subject);
              return (
                <div key={subject} className="bg-slate-50 rounded-lg p-3 border border-slate-200 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className={`w-3 h-3 rounded ${course?.color?.split(' ')[0] || 'bg-slate-300'}`}></div>
                    <span className="text-sm text-slate-700">{subject}</span>
                  </div>
                  <span className="text-lg font-bold text-slate-800">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
