# K12 智能排课系统

一款面向 K12 学校的全功能智能排课管理平台，支持教师/班级/课程计划的完整 CRUD、规则化约束配置、一键自动排课、手动拖拽微调以及多维度统计分析。

## 技术架构

| 层级 | 技术栈 |
|------|--------|
| 前端框架 | React 18 + TypeScript |
| 构建工具 | Vite 6 |
| 状态管理 | Zustand |
| UI 组件 | Radix UI + Tailwind CSS 4 |
| 图表 | Recharts |
| 拖拽 | React DnD |
| Excel | SheetJS (xlsx) |
| 数据库 | Supabase (PostgreSQL) |
| 通知 | Sonner |

## 功能模块

### 📊 仪表盘 (Dashboard)
- 排课进度概览

### 📋 基础数据管理 (DataManagement)
- **教师管理** — 增删改查、工号/科目/周课时/颜色标识
- **班级管理** — 年级/班主任关联/学生人数/学年
- **课程计划** — 班级-教师-科目-周课时绑定
- **Excel 批量导入** — 教师/班级/课程计划模板下载 + 一键导入
- **引用完整性** — 删除教师/班级前检查关联课程计划
- **批量操作** — 多选删除、全选/反选

### ⚙️ 规则设置 (RulesConfiguration)
- **基本时间约束** — 工作日开关、课节时间表（可增删、设置时段归属）、午休保护、周末排课开关
- **教师偏好** — 最大连堂/每日课时、个人时间偏好矩阵（3 态：普通/偏好/不可用）、偏好上午、避开首末节、跨校区
- **课程分布** — 按科目设置规则（每天不超过1节/不连堂/避开第1节）、优先级/启禁用开关
- **一键模板** — 均衡分布/集中排课/黄金时段 三种模式，联动跨版块修改教师偏好
- **持久化** — 所有规则保存到 `schedule_rules` 表、支持重置当前页

### 📅 排课编辑器 (ScheduleEditor)
- **一键排课** — 动态规划算法，按评分贪心落子，完整消费 12 条规则项
- **手动拖拽** — 课程卡片拖入课表格子、格内删除（hover 显示 X）
- **冲突检测** — 班级/教师双重时段冲突校验
- **撤销/重做** — 完整历史栈支持
- **保存/加载** — 课表方案持久化到 `schedule_slots` 表

### 👁️ 课表查看 (ScheduleView)
- 按班级/教师视角查看已排课表
- 支持导出

### 📈 统计分析 (Statistics)
- **6 大 KPI** — 排课班级、教师总数、排课完成度、教师平均负荷、冲突检测、自习课数量
- **教师雷达图** — 多维能力分布
- **质量进度条** — 连堂违规率、首末节分布、科目均衡度
- **周趋势折线** — 每日科目分布
- **班级均衡** — 各班课时负载对比

## 数据库结构

共 8 张核心表：

```
semesters        → 学期设置
teachers         → 教师信息
class_groups     → 班级信息
rooms            → 教室（预留）
course_plans     → 课程计划（班级-教师-科目绑定）
schedule_rules   → 排课规则（JSON 配置）
schedule_plans   → 排课方案
schedule_slots   → 排课时间槽（方案-日期-课节-课程计划）
```

## 快速开始

### 环境要求
- Node.js ≥ 18
- npm ≥ 9
- Supabase 项目（已创建）

### 安装与运行

```bash
# 1. 克隆项目
git clone https://github.com/xiaoaoke/paike.git
cd paike

# 2. 安装依赖
npm install

# 3. 配置环境变量
# 创建 .env 文件，填入 Supabase 配置
echo "VITE_SUPABASE_URL=https://your-project.supabase.co" > .env
echo "VITE_SUPABASE_ANON_KEY=your-anon-key" >> .env

# 4. 初始化数据库
# 在 Supabase Dashboard → SQL Editor 中依次执行：
#   supabase/init.sql          （建表）
#   supabase/rollback_rls.sql  （修正 RLS 策略，允许删除操作）

# 5. 启动开发服务器
npm run dev

# 6. 构建生产版本
npm run build
```

## 项目结构

```
paike/
├── src/
│   ├── App.tsx                    # 路由 + 布局
│   ├── main.tsx                   # 入口
│   ├── lib/
│   │   ├── store.ts               # Zustand 全局状态（含所有 CRUD）
│   │   ├── supabaseClient.ts      # Supabase 客户端初始化
│   │   └── types.ts               # TypeScript 类型定义
│   ├── pages/
│   │   ├── Dashboard.tsx          # 仪表盘
│   │   ├── DataManagement.tsx     # 基础数据管理
│   │   ├── RulesConfiguration.tsx # 规则设置
│   │   ├── ScheduleEditor.tsx     # 排课编辑器（核心引擎）
│   │   ├── ScheduleView.tsx       # 课表查看
│   │   └── Statistics.tsx         # 统计分析
│   └── components/
│       ├── schedule/              # 排课专用组件
│       │   ├── DraggableCourse.tsx
│       │   └── GridCell.tsx
│       └── ui/                    # Radix UI 封装
├── supabase/
│   ├── init.sql                   # 数据库建表脚本
│   ├── rls_security.sql           # RLS 安全策略
│   ├── rollback_rls.sql           # RLS 修正（允许删除）
│   ├── seed_data.sql              # 示例数据
│   └── ...
├── .env                           # 环境变量
├── package.json
└── vite.config.ts
```

## 环境变量

| 变量名 | 说明 |
|--------|------|
| `VITE_SUPABASE_URL` | Supabase 项目 URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase 匿名访问密钥 |

## 许可证

MIT