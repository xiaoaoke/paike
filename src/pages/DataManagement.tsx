import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  FileSpreadsheet,
  Trash2,
  Edit2,
  X,
  Upload,
  Download,
  ChevronDown
} from 'lucide-react';
import { useAppStore } from '../lib/store';
import { Teacher, ClassGroup, CoursePlan } from '../lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../components/ui/alert-dialog';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

type TabType = 'teachers' | 'classes' | 'courses' | 'rooms';

const SUBJECT_COLORS = [
  'bg-red-100 border-red-200 text-red-800',
  'bg-blue-100 border-blue-200 text-blue-800',
  'bg-purple-100 border-purple-200 text-purple-800',
  'bg-indigo-100 border-indigo-200 text-indigo-800',
  'bg-emerald-100 border-emerald-200 text-emerald-800',
  'bg-orange-100 border-orange-200 text-orange-800',
  'bg-pink-100 border-pink-200 text-pink-800',
  'bg-yellow-100 border-yellow-200 text-yellow-800',
];

export default function DataManagement() {
  const [activeTab, setActiveTab] = useState<TabType>('teachers');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  
  // 从 Zustand Store 获取数据和操作
  const {
    teachers, classGroups: classes, coursePlans,
    addTeacher, updateTeacher, deleteTeacher,
    addClassGroup, updateClassGroup, deleteClassGroup,
    addCoursePlan, updateCoursePlan, deleteCoursePlan,
  } = useAppStore();

  // Dialog states
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form states
  const [formData, setFormData] = useState<any>({});

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    toast.info("开始处理文件，请稍候...");
    try {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data = XLSX.utils.sheet_to_json(ws);
          
          if (!data || data.length === 0) {
            toast.error("表格为空或格式不正确");
            return;
          }

          let successCount = 0;
          let failCount = 0;

          if (activeTab === 'teachers') {
            for (const row of data as any[]) {
              try {
                if (!row['姓名']) throw new Error('缺少必填项：姓名');
                const subjects = row['任教科目(多科目请用逗号分隔)'] 
                  ? String(row['任教科目(多科目请用逗号分隔)']).split(/[,，]/).map(s => s.trim()).filter(Boolean) 
                  : [];
                await addTeacher({
                  name: String(row['姓名']).trim(),
                  employee_id: row['工号'] ? String(row['工号']) : null,
                  subjects,
                  max_weekly_hours: parseInt(row['最大周课时']) || 12,
                  phone: row['手机号'] ? String(row['手机号']) : null,
                  email: null,
                  color: null,
                });
                successCount++;
              } catch (err) {
                console.error("教师导入失败：", row, err);
                failCount++;
              }
            }
          } else if (activeTab === 'classes') {
            for (const row of data as any[]) {
              try {
                if (!row['班级名称']) throw new Error('缺少必填项：班级名称');
                const htName = row['班主任姓名'] ? String(row['班主任姓名']).trim() : '';
                let headTeacherId = null;
                if (htName) {
                  const teacher = teachers.find(t => t.name === htName);
                  if (teacher) headTeacherId = teacher.id;
                  else console.warn(`未匹配到该班主任，关联置空: ${htName}`); // Non-blocking
                }
                
                let gradeNum = 1;
                const gradeRaw = String(row['年级(如高一)'] || '');
                if (gradeRaw.includes('高一') || gradeRaw === '1') gradeNum = 1;
                else if (gradeRaw.includes('高二') || gradeRaw === '2') gradeNum = 2;
                else if (gradeRaw.includes('高三') || gradeRaw === '3') gradeNum = 3;
                else {
                  const extracted = parseInt(gradeRaw.replace(/[^0-9]/g, ''));
                  if (!isNaN(extracted)) gradeNum = extracted;
                }

                await addClassGroup({
                  name: String(row['班级名称']).trim(),
                  grade: gradeNum,
                  academic_year: row['学年(如2024)'] ? String(row['学年(如2024)']) : '2025-2026',
                  head_teacher_id: headTeacherId,
                  student_count: parseInt(row['学生人数']) || 45,
                  semester_id: null,
                });
                successCount++;
              } catch (err) {
                console.error("班级导入失败：", row, err);
                failCount++;
              }
            }
          } else if (activeTab === 'courses') {
            for (const row of data as any[]) {
              try {
                const className = String(row['班级名称'] || '').trim();
                const teacherName = String(row['任课教师姓名'] || '').trim();
                const subject = String(row['科目名称'] || '').trim();
                
                if (!className || !teacherName || !subject) throw new Error('核心约束项为空');

                const cls = classes.find(c => c.name === className);
                const teacher = teachers.find(t => t.name === teacherName);
                
                if (!cls) throw new Error(`未找到班级: ${className}`);
                if (!teacher) throw new Error(`未找到教师: ${teacherName}`);

                await addCoursePlan({
                  class_id: cls.id,
                  teacher_id: teacher.id,
                  subject: subject,
                  weekly_hours: parseInt(row['每周计划课时']) || 4,
                  semester_id: null,
                  academic_year: cls.academic_year || '2025-2026',
                  semester: '上学期' 
                });
                successCount++;
              } catch (err) {
                console.error("课程导入失败：", row, err);
                failCount++;
              }
            }
          }

          if (failCount > 0) {
            toast.warning(`导入完成：成功 ${successCount} 条，失败/报错跳过 ${failCount} 条（请打开控制台查看具体行错）`);
          } else {
            toast.success(`🎉 完美导入：全部 ${successCount} 条记录均已成功落库！`);
          }

          setShowImportDialog(false);
          if (fileInputRef.current) fileInputRef.current.value = ''; // Reset input
        } catch (err: any) {
          toast.error("Excel 数据提取失败：" + err.message);
        }
      };
      reader.readAsBinaryString(file);
    } catch (err: any) {
      toast.error("文件读取接口拦截: " + err.message);
    }
  };

  // 完美复刻极强防阻断和安全截获机制的 Excel 导出引擎（用于基础模板）
  const downloadTemplate = async (filename: string, headers: string[]) => {
    try {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([headers]);
      
      // 设置固定列宽，优化人工填表体验
      const wscols = headers.map(() => ({ wch: 22 }));
      ws['!cols'] = wscols;

      XLSX.utils.book_append_sheet(wb, ws, "导入模板");

      const safeFilename = filename.replace(/[\r\n\t\\/:*?"<>|]/g, '').trim();
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      // 绝杀层：物理 API 级拉取保存
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
          toast.success(`${safeFilename} 下载成功！`);
          return;
        } catch (err: any) {
          if (err.name !== 'AbortError') console.error('SaveFilePicker 失败:', err);
          else return; // 取消
        }
      }

      // 兜底层：异步 Blob 延迟撤销
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

      toast.success(`${safeFilename} 下载成功！`);
    } catch (error: any) {
      toast.error(`模板下载失败: ${error.message}`);
    }
  };

  // Get current data based on active tab
  const getCurrentData = () => {
    switch (activeTab) {
      case 'teachers': return teachers;
      case 'classes': return classes;
      case 'courses': return coursePlans;

      default: return [];
    }
  };

  // Filter data based on search term
  const getFilteredData = () => {
    const data = getCurrentData();
    if (!searchTerm) return data;

    return data.filter((item: any) => {
      const searchLower = searchTerm.toLowerCase();
      if (activeTab === 'teachers') {
        return item.name.toLowerCase().includes(searchLower) || 
               (item.subjects || []).some((s: string) => s.toLowerCase().includes(searchLower)) ||
               (item.employee_id || item.employeeId || '').toLowerCase().includes(searchLower);
      } else if (activeTab === 'classes') {
        return item.name.toLowerCase().includes(searchLower);
      } else if (activeTab === 'courses') {
        return item.subject.toLowerCase().includes(searchLower) ||
               (item.teacher_name || item.teacherName || '').toLowerCase().includes(searchLower) ||
               (item.class_name || item.className || '').toLowerCase().includes(searchLower);

      }
      return false;
    });
  };

  // Handle add new item
  const handleAdd = () => {
    setFormData({});
    setShowAddDialog(true);
  };

  // Handle edit item
  const handleEdit = (item: any) => {
    setEditingItem(item);
    setFormData({ ...item });
    setShowEditDialog(true);
  };

  // Handle delete confirmation
  const handleDeleteConfirm = (id: string) => {
    setDeletingId(id);
    setShowDeleteDialog(true);
  };

  // Execute delete (async - Supabase)
  const executeDelete = async () => {
    if (!deletingId) return;
    try {
      // 引用完整性校验：删除前检查是否有关联的课程计划
      if (activeTab === 'teachers') {
        const linked = coursePlans.filter(cp => cp.teacher_id === deletingId);
        if (linked.length > 0) {
          toast.error(`该教师关联了 ${linked.length} 条课程计划，请先删除相关课程计划`);
          setShowDeleteDialog(false);
          setDeletingId(null);
          return;
        }
        await deleteTeacher(deletingId);
        toast.success('教师删除成功');
      } else if (activeTab === 'classes') {
        const linked = coursePlans.filter(cp => cp.class_id === deletingId);
        if (linked.length > 0) {
          toast.error(`该班级关联了 ${linked.length} 条课程计划，请先删除相关课程计划`);
          setShowDeleteDialog(false);
          setDeletingId(null);
          return;
        }
        await deleteClassGroup(deletingId);
        toast.success('班级删除成功');

      } else if (activeTab === 'courses') {
        await deleteCoursePlan(deletingId);
        toast.success('课程计划删除成功');
      }
    } catch (err: any) {
      toast.error(`删除失败: ${err.message}`);
    }
    setShowDeleteDialog(false);
    setDeletingId(null);
  };

  // Save new or edited item (async - Supabase)
  const handleSave = async () => {
    try {
      // ==================== 边界拦截验证 ====================
      if (activeTab === 'teachers') {
        const maxHours = parseInt(formData.maxWeeklyHours || formData.max_weekly_hours) || 12;
        if (maxHours < 0 || maxHours > 50) throw new Error('教师最大周课时不能超过 50 节');
      } else if (activeTab === 'classes') {
        const count = parseInt(formData.studentCount || formData.student_count) || 0;
        if (count < 0 || count > 100) throw new Error('班级人数必须在 0 到 100 人之间');

      } else if (activeTab === 'courses') {
        const hours = parseInt(formData.weeklyHours || formData.weekly_hours) || 0;
        if (hours <= 0 || hours > 40) throw new Error('单科周排课量必须在 1 到 40 之间');
      }
      
      setSaving(true);
      if (showAddDialog) {
        switch (activeTab) {
          case 'teachers': {
            const subjects = typeof formData.subjects === 'string'
              ? formData.subjects.split(',').map((s: string) => s.trim()).filter(Boolean)
              : formData.subjects || [];
            await addTeacher({
              name: formData.name,
              employee_id: formData.employeeId || formData.employee_id || null,
              subjects,
              max_weekly_hours: formData.maxWeeklyHours || formData.max_weekly_hours || 12,
              phone: formData.phone || null,
              email: formData.email || null,
              color: formData.color || null,
            });
            toast.success('教师添加成功');
            break;
          }
          case 'classes': {
            await addClassGroup({
              name: formData.name,
              grade: parseInt(formData.grade) || 1,
              head_teacher_id: formData.headTeacherId || formData.head_teacher_id || null,
              student_count: parseInt(formData.studentCount || formData.student_count) || 0,
              academic_year: formData.academicYear || formData.academic_year || null,
              semester_id: null,
            });
            toast.success('班级添加成功');
            break;
          }
          case 'courses': {
            await addCoursePlan({
              class_id: formData.classId || formData.class_id,
              teacher_id: formData.teacherId || formData.teacher_id,
              subject: formData.subject,
              weekly_hours: parseInt(formData.weeklyHours || formData.weekly_hours) || 4,
              academic_year: formData.academicYear || formData.academic_year || '2025-2026',
              semester: formData.semester || '上学期',
              semester_id: null,
            });
            toast.success('课程计划添加成功');
            break;
          }

        }
        setShowAddDialog(false);
      } else if (showEditDialog) {
        switch (activeTab) {
          case 'teachers': {
            const subjects = typeof formData.subjects === 'string'
              ? formData.subjects.split(',').map((s: string) => s.trim()).filter(Boolean)
              : formData.subjects || [];
            await updateTeacher(editingItem.id, {
              name: formData.name,
              employee_id: formData.employeeId || formData.employee_id,
              subjects,
              max_weekly_hours: formData.maxWeeklyHours || formData.max_weekly_hours,
              phone: formData.phone,
              email: formData.email,
              color: formData.color,
            });
            toast.success('教师信息已更新');
            break;
          }
          case 'classes': {
            await updateClassGroup(editingItem.id, {
              name: formData.name,
              grade: parseInt(formData.grade),
              head_teacher_id: formData.headTeacherId || formData.head_teacher_id,
              student_count: parseInt(formData.studentCount || formData.student_count),
              academic_year: formData.academicYear || formData.academic_year,
            });
            toast.success('班级信息已更新');
            break;
          }
          case 'courses': {
            await updateCoursePlan(editingItem.id, {
              class_id: formData.classId || formData.class_id,
              teacher_id: formData.teacherId || formData.teacher_id,
              subject: formData.subject,
              weekly_hours: parseInt(formData.weeklyHours || formData.weekly_hours),
              academic_year: formData.academicYear || formData.academic_year || '2025-2026',
              semester: formData.semester || '上学期',
            });
            toast.success('课程计划已更新');
            break;
          }

        }
        setShowEditDialog(false);
        setEditingItem(null);
      }
    } catch (err: any) {
      toast.error(err.message || '保存数据时出错');
    } finally {
      setSaving(false);
    }
    setFormData({});
  };

  // Toggle item selection
  const toggleSelection = (id: string) => {
    setSelectedItems(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // Toggle select all
  const toggleSelectAll = () => {
    const data = getFilteredData();
    if (selectedItems.length === data.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(data.map((item: any) => item.id));
    }
  };

  // Batch delete (async - Supabase)
  const handleBatchDelete = async () => {
    if (selectedItems.length === 0) {
      toast.error('请先选择要删除的项目');
      return;
    }
    try {
      let successCount = 0;
      let skippedCount = 0;

      for (const id of selectedItems) {
        // 引用完整性校验（与单条删除保持一致）
        if (activeTab === 'teachers') {
          const linked = coursePlans.filter(cp => cp.teacher_id === id);
          if (linked.length > 0) { skippedCount++; continue; }
          await deleteTeacher(id);
        } else if (activeTab === 'classes') {
          const linked = coursePlans.filter(cp => cp.class_id === id);
          if (linked.length > 0) { skippedCount++; continue; }
          await deleteClassGroup(id);
        } else if (activeTab === 'courses') {
          await deleteCoursePlan(id);
        }
        successCount++;
      }

      const labels = { teachers: '位教师', classes: '个班级', courses: '个课程计划' } as Record<string, string>;
      if (skippedCount > 0) {
        toast.warning(`已删除 ${successCount} ${labels[activeTab]}，跳过 ${skippedCount} 条（存在关联课程计划）`);
      } else {
        toast.success(`已删除 ${successCount} ${labels[activeTab]}`);
      }
    } catch (err: any) {
      toast.error(`批量删除失败: ${err.message}`);
    }
    setSelectedItems([]);
  };

  const filteredData = getFilteredData();

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">基础数据管理</h1>
          <p className="text-slate-500 mt-1">管理排课所需的教师、班级及课程计划数据</p>
        </div>
        <div className="flex space-x-3">
          <button 
            onClick={() => setShowImportDialog(true)}
            className="flex items-center px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-medium text-sm transition-colors"
          >
            <FileSpreadsheet size={18} className="mr-2 text-green-600" />
            Excel 批量导入
          </button>
          <button 
            onClick={handleAdd}
            className="flex items-center px-4 py-2 bg-indigo-600 rounded-lg text-white hover:bg-indigo-700 font-medium text-sm shadow-sm transition-colors"
          >
            <Plus size={18} className="mr-2" />
            新增数据
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50/30">
          <TabButton 
            id="teachers" 
            label="教师管理" 
            count={teachers.length} 
            active={activeTab === 'teachers'} 
            onClick={() => { setActiveTab('teachers'); setSelectedItems([]); setSearchTerm(''); }} 
          />
          <TabButton 
            id="classes" 
            label="班级管理" 
            count={classes.length} 
            active={activeTab === 'classes'} 
            onClick={() => { setActiveTab('classes'); setSelectedItems([]); setSearchTerm(''); }} 
          />
          <TabButton 
            id="courses" 
            label="课程计划" 
            count={coursePlans.length} 
            active={activeTab === 'courses'} 
            onClick={() => { setActiveTab('courses'); setSelectedItems([]); setSearchTerm(''); }} 
          />

        </div>

        {/* Filter Bar */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder="搜索姓名、科目..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-1.5 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
              />
            </div>
            {selectedItems.length > 0 && (
              <button 
                onClick={handleBatchDelete}
                className="flex items-center px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm hover:bg-red-100"
              >
                <Trash2 size={16} className="mr-1.5" />
                删除选中 ({selectedItems.length})
              </button>
            )}
          </div>
          <span className="text-sm text-slate-500">共 {filteredData.length} 条记录</span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {filteredData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                <Search className="text-slate-400" size={32} />
              </div>
              <p className="text-slate-500 text-lg font-medium mb-1">暂无数据</p>
              <p className="text-slate-400 text-sm mb-4">
                {searchTerm ? '未找到匹配的结果，请尝试其他搜索关键词' : '点击右上角"新增数据"按钮开始添加'}
              </p>
              {!searchTerm && (
                <button 
                  onClick={handleAdd}
                  className="flex items-center px-4 py-2 bg-indigo-600 rounded-lg text-white hover:bg-indigo-700 font-medium text-sm shadow-sm transition-colors"
                >
                  <Plus size={18} className="mr-2" />
                  新增数据
                </button>
              )}
            </div>
          ) : (
            <>
              {activeTab === 'teachers' && (
                <TeachersTable 
                  data={filteredData as any as Teacher[]} 
                  selectedItems={selectedItems}
                  onToggleSelection={toggleSelection}
                  onToggleSelectAll={toggleSelectAll}
                  onEdit={handleEdit}
                  onDelete={handleDeleteConfirm}
                />
              )}
              {activeTab === 'classes' && (
                <ClassesTable 
                  data={filteredData as any as ClassGroup[]} 
                  teachers={teachers}
                  selectedItems={selectedItems}
                  onToggleSelection={toggleSelection}
                  onToggleSelectAll={toggleSelectAll}
                  onEdit={handleEdit}
                  onDelete={handleDeleteConfirm}
                />
              )}
              {activeTab === 'courses' && (
                <CoursePlansTable 
                  data={filteredData as any as CoursePlan[]} 
                  classes={classes}
                  selectedItems={selectedItems}
                  onToggleSelection={toggleSelection}
                  onToggleSelectAll={toggleSelectAll}
                  onEdit={handleEdit}
                  onDelete={handleDeleteConfirm}
                />
              )}

            </>
          )}
        </div>
        
        {/* Pagination */}
        <div className="p-4 border-t border-slate-200 flex items-center justify-between bg-slate-50/30">
          <div className="text-xs text-slate-500">显示 1 至 {filteredData.length} 条</div>
          <div className="flex space-x-1">
            <button className="px-3 py-1 border border-slate-200 rounded text-slate-400 text-xs cursor-not-allowed">上一页</button>
            <button className="px-3 py-1 bg-indigo-50 border border-indigo-200 rounded text-indigo-600 text-xs font-bold">1</button>
            <button className="px-3 py-1 border border-slate-200 rounded text-slate-600 text-xs hover:bg-slate-50">下一页</button>
          </div>
        </div>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={showAddDialog || showEditDialog} onOpenChange={(open) => {
        if (!open) {
          setShowAddDialog(false);
          setShowEditDialog(false);
          setFormData({});
          setEditingItem(null);
        }
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {showAddDialog ? '新增' : '编辑'}
              {activeTab === 'teachers' && '教师'}
              {activeTab === 'classes' && '班级'}
              {activeTab === 'courses' && '课程计划'}
            </DialogTitle>
          </DialogHeader>

          <DialogDescription>
            {activeTab === 'teachers' && '填写教师的基本信息'}
            {activeTab === 'classes' && '填写班级的基本信息'}
            {activeTab === 'courses' && '填写课程计划的基本信息'}
          </DialogDescription>

          <div className="space-y-4 py-4">
            {activeTab === 'teachers' && (
              <TeacherForm formData={formData} setFormData={setFormData} />
            )}
            {activeTab === 'classes' && (
              <ClassForm formData={formData} setFormData={setFormData} teachers={teachers} />
            )}
            {activeTab === 'courses' && (
              <CoursePlanForm 
                formData={formData} 
                setFormData={setFormData} 
                teachers={teachers}
                classes={classes}
              />
            )}

          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowAddDialog(false);
                setShowEditDialog(false);
                setFormData({});
                setEditingItem(null);
              }}
            >
              取消
            </Button>
            <Button onClick={handleSave}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              此操作无法撤销。确定要删除这条记录吗?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingId(null)}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={executeDelete} className="bg-red-600 hover:bg-red-700">
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Excel 批量导入</DialogTitle>
          </DialogHeader>

          <DialogDescription>
            上传Excel文件批量导入数据，或下载模板填写后再导入
          </DialogDescription>

          <div className="space-y-4 py-4">
            <div 
              className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-indigo-400 transition-colors cursor-pointer relative"
              onClick={() => fileInputRef.current?.click()}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept=".xlsx, .xls"
                onChange={handleFileUpload}
              />
              <Upload className="mx-auto h-12 w-12 text-slate-400 mb-3" />
              <p className="text-sm text-slate-600 mb-1">点击上传或拖拽文件到此处</p>
              <p className="text-xs text-slate-400">支持 .xlsx, .xls 格式</p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800 font-medium mb-2">📥 模板下载</p>
              <p className="text-xs text-blue-600 mb-3">请下载对应的Excel模板，填写后再导入</p>
              <div className="flex flex-wrap gap-2">
                <button 
                  onClick={() => downloadTemplate('教师导入模板', ['姓名', '工号', '手机号', '任教科目(多科目请用逗号分隔)', '最大周课时'])}
                  className="flex items-center px-3 py-1.5 bg-white border border-blue-300 rounded text-xs text-blue-700 hover:bg-blue-50"
                >
                  <Download size={14} className="mr-1" />
                  教师模板
                </button>
                <button 
                  onClick={() => downloadTemplate('班级导入模板', ['班级名称', '年级(如高一)', '学年(如2024)', '班主任姓名', '学生人数'])}
                  className="flex items-center px-3 py-1.5 bg-white border border-blue-300 rounded text-xs text-blue-700 hover:bg-blue-50"
                >
                  <Download size={14} className="mr-1" />
                  班级模板
                </button>
                <button 
                  onClick={() => downloadTemplate('课程计划导入模板', ['班级名称', '科目名称', '任课教师姓名', '每周计划课时'])}
                  className="flex items-center px-3 py-1.5 bg-white border border-blue-300 rounded text-xs text-blue-700 hover:bg-blue-50"
                >
                  <Download size={14} className="mr-1" />
                  课程计划模板
                </button>

              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportDialog(false)}>关闭</Button>
            <Button onClick={() => fileInputRef.current?.click()}>
              选择文件并开始导入
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Tab Button Component
function TabButton({ id, label, count, active, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors relative flex items-center ${
        active 
          ? 'border-blue-600 text-blue-600 bg-blue-50/50' 
          : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
      }`}
    >
      {label}
      <span className={`ml-2 px-1.5 py-0.5 rounded-full text-xs ${active ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
        {count}
      </span>
    </button>
  );
}

// Teachers Table
function TeachersTable({ data, selectedItems, onToggleSelection, onToggleSelectAll, onEdit, onDelete }: any) {
  return (
    <table className="w-full text-sm text-left">
      <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
        <tr>
          <th className="px-6 py-4 w-12">
            <input 
              type="checkbox" 
              checked={data.length > 0 && selectedItems.length === data.length}
              onChange={onToggleSelectAll}
              className="rounded border-slate-300" 
            />
          </th>
          <th className="px-6 py-4">姓名</th>
          <th className="px-6 py-4">教工号</th>
          <th className="px-6 py-4">任教科目</th>
          <th className="px-6 py-4">最大周课时</th>
          <th className="px-6 py-4">联系方式</th>
          <th className="px-6 py-4 text-right">操作</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {data.map((teacher: Teacher) => (
          <tr key={teacher.id} className="hover:bg-slate-50 group transition-colors">
            <td className="px-6 py-4">
              <input 
                type="checkbox" 
                checked={selectedItems.includes(teacher.id)}
                onChange={() => onToggleSelection(teacher.id)}
                className="rounded border-slate-300" 
              />
            </td>
            <td className="px-6 py-4 font-medium text-slate-800">
              <div className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 ${teacher.color?.split(' ')[0] || 'bg-blue-500'} text-xs font-bold text-white`}>
                  {teacher.name[0]}
                </div>
                {teacher.name}
              </div>
            </td>
            <td className="px-6 py-4 text-slate-500 font-mono text-xs">{(teacher as any).employee_id || (teacher as any).employeeId}</td>
            <td className="px-6 py-4">
              <div className="flex flex-wrap gap-1">
                {(teacher.subjects || []).map((subject: string, idx: number) => (
                  <span key={idx} className="bg-slate-100 px-2 py-1 rounded text-xs text-slate-600 border border-slate-200">
                    {subject}
                  </span>
                ))}
              </div>
            </td>
            <td className="px-6 py-4 text-slate-500">{(teacher as any).max_weekly_hours || (teacher as any).maxWeeklyHours || 12}</td>
            <td className="px-6 py-4 text-slate-500 text-xs">{teacher.phone}</td>
            <td className="px-6 py-4 text-right">
              <div className="flex items-center justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => onEdit(teacher)}
                  className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                >
                  <Edit2 size={16} />
                </button>
                <button 
                  onClick={() => onDelete(teacher.id)}
                  className="p-1 text-red-600 hover:bg-red-50 rounded"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Classes Table
function ClassesTable({ data, teachers, selectedItems, onToggleSelection, onToggleSelectAll, onEdit, onDelete }: any) {
  return (
    <table className="w-full text-sm text-left">
      <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
        <tr>
          <th className="px-6 py-4 w-12">
            <input 
              type="checkbox" 
              checked={data.length > 0 && selectedItems.length === data.length}
              onChange={onToggleSelectAll}
              className="rounded border-slate-300" 
            />
          </th>
          <th className="px-6 py-4">班级名称</th>
          <th className="px-6 py-4">年级</th>
          <th className="px-6 py-4">班主任</th>
          <th className="px-6 py-4">学生人数</th>
          <th className="px-6 py-4">学年</th>
          <th className="px-6 py-4 text-right">操作</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {data.map((cls: ClassGroup) => (
          <tr key={cls.id} className="hover:bg-slate-50 group transition-colors">
            <td className="px-6 py-4">
              <input 
                type="checkbox" 
                checked={selectedItems.includes(cls.id)}
                onChange={() => onToggleSelection(cls.id)}
                className="rounded border-slate-300" 
              />
            </td>
            <td className="px-6 py-4 font-medium text-slate-800">{cls.name}</td>
            <td className="px-6 py-4 text-slate-500">{cls.grade}年级</td>
            <td className="px-6 py-4 text-slate-500">
              {teachers.find((t: Teacher) => t.id === ((cls as any).head_teacher_id || (cls as any).headTeacherId))?.name || '未设置'}
            </td>
            <td className="px-6 py-4 text-slate-500">{(cls as any).student_count || (cls as any).studentCount || 0}</td>
            <td className="px-6 py-4 text-slate-500 text-xs">{(cls as any).academic_year || (cls as any).academicYear}</td>
            <td className="px-6 py-4 text-right">
              <div className="flex items-center justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => onEdit(cls)}
                  className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                >
                  <Edit2 size={16} />
                </button>
                <button 
                  onClick={() => onDelete(cls.id)}
                  className="p-1 text-red-600 hover:bg-red-50 rounded"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Course Plans Table
function CoursePlansTable({ data, classes, selectedItems, onToggleSelection, onToggleSelectAll, onEdit, onDelete }: any) {
  return (
    <table className="w-full text-sm text-left">
      <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
        <tr>
          <th className="px-6 py-4 w-12">
            <input 
              type="checkbox" 
              checked={data.length > 0 && selectedItems.length === data.length}
              onChange={onToggleSelectAll}
              className="rounded border-slate-300" 
            />
          </th>
          <th className="px-6 py-4">班级</th>
          <th className="px-6 py-4">科目</th>
          <th className="px-6 py-4">任课教师</th>
          <th className="px-6 py-4">周课时</th>
          <th className="px-6 py-4">学年/学期</th>
          <th className="px-6 py-4 text-right">操作</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {data.map((plan: CoursePlan) => {
          const associatedClass = classes?.find((c: any) => c.id === (plan as any).class_id || c.id === (plan as any).classId) || {};
          return (
            <tr key={plan.id} className="hover:bg-slate-50 group transition-colors">
              <td className="px-6 py-4">
                <input 
                  type="checkbox" 
                  checked={selectedItems.includes(plan.id)}
                  onChange={() => onToggleSelection(plan.id)}
                  className="rounded border-slate-300" 
                />
              </td>
              <td className="px-6 py-4 font-medium text-slate-800">{(plan as any).class_name || (plan as any).className}</td>
              <td className="px-6 py-4">
                <span className="bg-indigo-100 px-2 py-1 rounded text-xs text-indigo-700 border border-indigo-200">
                  {plan.subject}
                </span>
              </td>
              <td className="px-6 py-4 text-slate-600">{(plan as any).teacher_name || (plan as any).teacherName}</td>
              <td className="px-6 py-4 text-slate-500">{(plan as any).weekly_hours || (plan as any).weeklyHours} 课时/周</td>
              <td className="px-6 py-4 text-slate-500 text-xs">
                {(plan as any).academic_year || (plan as any).academicYear || '-'}
                {(plan as any).semester ? ` ${(plan as any).semester}` : ''}
              </td>
              <td className="px-6 py-4 text-right">
                <div className="flex items-center justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => onEdit(plan)}
                    className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button 
                    onClick={() => onDelete(plan.id)}
                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}



// Teacher Form
function TeacherForm({ formData, setFormData }: any) {
  const colors = [
    { value: 'bg-red-100 border-red-200 text-red-800', label: '红色', class: 'bg-red-100' },
    { value: 'bg-blue-100 border-blue-200 text-blue-800', label: '蓝色', class: 'bg-blue-100' },
    { value: 'bg-purple-100 border-purple-200 text-purple-800', label: '紫色', class: 'bg-purple-100' },
    { value: 'bg-indigo-100 border-indigo-200 text-indigo-800', label: '靛蓝', class: 'bg-indigo-100' },
    { value: 'bg-emerald-100 border-emerald-200 text-emerald-800', label: '绿色', class: 'bg-emerald-100' },
    { value: 'bg-orange-100 border-orange-200 text-orange-800', label: '橙色', class: 'bg-orange-100' },
  ];

  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">姓名 *</Label>
          <Input
            id="name"
            value={formData.name || ''}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="请输入教师姓名"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="employeeId">教工号 *</Label>
          <Input
            id="employeeId"
            value={formData.employeeId || formData.employee_id || ''}
            onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
            placeholder="T001"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="subjects">任教科目 *</Label>
        <Input
          id="subjects"
          value={Array.isArray(formData.subjects) ? formData.subjects.join(', ') : formData.subjects || ''}
          onChange={(e) => setFormData({ ...formData, subjects: e.target.value })}
          placeholder="语文, 数学（多个科目用逗号分隔）"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="maxWeeklyHours">最大周课时</Label>
          <Input
            id="maxWeeklyHours"
            type="number"
            value={formData.maxWeeklyHours || formData.max_weekly_hours || 12}
            onChange={(e) => setFormData({ ...formData, maxWeeklyHours: parseInt(e.target.value) })}
            placeholder="12"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="color">颜色标识</Label>
          <Select 
            value={formData.color || colors[0].value}
            onValueChange={(value) => setFormData({ ...formData, color: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {colors.map((color) => (
                <SelectItem key={color.value} value={color.value}>
                  <div className="flex items-center">
                    <div className={`w-4 h-4 rounded mr-2 ${color.class}`}></div>
                    {color.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="phone">手机号</Label>
          <Input
            id="phone"
            value={formData.phone || ''}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="13800138000"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">邮箱</Label>
          <Input
            id="email"
            type="email"
            value={formData.email || ''}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="teacher@school.edu"
          />
        </div>
      </div>
    </>
  );
}

// Class Form
function ClassForm({ formData, setFormData, teachers }: any) {
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">班级名称 *</Label>
          <Input
            id="name"
            value={formData.name || ''}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="高一(1)班"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="grade">年级 *</Label>
          <Select 
            value={formData.grade?.toString() || ''}
            onValueChange={(value) => setFormData({ ...formData, grade: parseInt(value) })}
          >
            <SelectTrigger>
              <SelectValue placeholder="选择年级" />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(g => (
                <SelectItem key={g} value={g.toString()}>{g} 年级</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="headTeacherId">班主任</Label>
          <Select 
            value={formData.headTeacherId || formData.head_teacher_id || ''}
            onValueChange={(value) => setFormData({ ...formData, headTeacherId: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="选择班主任" />
            </SelectTrigger>
            <SelectContent>
              {teachers.map((teacher: Teacher) => (
                <SelectItem key={teacher.id} value={teacher.id}>
                  {teacher.name} ({teacher.subjects.join(', ')})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="studentCount">学生人数</Label>
          <Input
            id="studentCount"
            type="number"
            value={formData.studentCount || formData.student_count || 45}
            onChange={(e) => setFormData({ ...formData, studentCount: parseInt(e.target.value) })}
            placeholder="45"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="academicYear">学年</Label>
        <Input
          id="academicYear"
          value={formData.academicYear || formData.academic_year || '2025-2026'}
          onChange={(e) => setFormData({ ...formData, academicYear: e.target.value })}
          placeholder="2025-2026"
        />
      </div>
    </>
  );
}

// Course Plan Form
function CoursePlanForm({ formData, setFormData, teachers, classes, rooms }: any) {
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="classId">班级 *</Label>
          <Select 
            value={formData.classId || formData.class_id || ''}
            onValueChange={(value) => setFormData({ ...formData, classId: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="选择班级" />
            </SelectTrigger>
            <SelectContent>
              {classes.map((cls: ClassGroup) => (
                <SelectItem key={cls.id} value={cls.id}>
                  {cls.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="subject">科目 *</Label>
          <Input
            id="subject"
            value={formData.subject || ''}
            onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
            placeholder="数学"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="teacherId">任课教师 *</Label>
          <Select 
            value={formData.teacherId || formData.teacher_id || ''}
            onValueChange={(value) => setFormData({ ...formData, teacherId: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="选择教师" />
            </SelectTrigger>
            <SelectContent>
              {teachers.map((teacher: Teacher) => (
                <SelectItem key={teacher.id} value={teacher.id}>
                  {teacher.name} ({teacher.subjects.join(', ')})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="weeklyHours">周课时 *</Label>
          <Input
            id="weeklyHours"
            type="number"
            value={formData.weeklyHours || formData.weekly_hours || 4}
            onChange={(e) => setFormData({ ...formData, weeklyHours: parseInt(e.target.value) })}
            placeholder="4"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="academicYear">学年</Label>
          <Input
            id="academicYear"
            value={formData.academicYear || formData.academic_year || '2025-2026'}
            onChange={(e) => setFormData({ ...formData, academicYear: e.target.value })}
            placeholder="2025-2026"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="semester">学期</Label>
          <Select 
            value={formData.semester || '上学期'}
            onValueChange={(value) => setFormData({ ...formData, semester: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="上学期">上学期</SelectItem>
              <SelectItem value="下学期">下学期</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>


    </>
  );
}
