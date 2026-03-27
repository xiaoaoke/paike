export interface Course {
  id: string;
  subject: string;
  teacherId: string;
  teacherName: string;
  color: string;
  duration: number; // usually 1 period
  classId?: string;
  quota: number; // Max lessons per week for this course in a class
}

export interface ScheduleSlot {
  id: string;
  day: number; // 0-6 (Mon-Sun) or 1-5
  period: number; // 1-8
  courseId: string;
  classId: string;
  roomId?: string; // 保留可选用于兼容，但不应继续使用
  locked?: boolean;
}

export interface Teacher {
  id: string;
  name: string;
  subjects: string[];
  color: string;
  employeeId?: string; // 教工号
  maxWeeklyHours?: number; // 最大周课时
  phone?: string;
  email?: string;
}

export interface ClassGroup {
  id: string;
  name: string;
  grade: number;
  headTeacherId?: string; // 班主任ID
  studentCount?: number; // 学生人数
  academicYear?: string; // 学年
}

export interface CoursePlan {
  id: string;
  classId: string;
  className: string;
  subject: string;
  teacherId: string;
  teacherName: string;
  weeklyHours: number; // 周课时
  semester: string; // 学期
  academicYear: string; // 学年

}

export interface ConflictData {
  type: 'class_overlap' | 'teacher_overlap';
  message: string;
  conflictingClassId?: string;
}