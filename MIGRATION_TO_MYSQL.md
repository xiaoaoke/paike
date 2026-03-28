# K12 排课系统 — 从 Supabase 迁移到 MySQL 指南

## 一、架构差异

```
当前架构:  React (浏览器) → Supabase SDK → PostgreSQL (云端)
目标架构:  React (浏览器) → Axios → Express API (Node.js) → MySQL
```

> Supabase 是 BaaS（后端即服务），浏览器可直连数据库。MySQL 无此能力，必须新增后端 API 层。

## 二、迁移步骤总览

```
Step 1 → 搭建 Express 后端 + MySQL 连接
Step 2 → 迁移数据库 Schema（PostgreSQL → MySQL）
Step 3 → 编写 RESTful API（24 个接口）
Step 4 → 重写前端 store.ts（Supabase SDK → Axios）
Step 5 → 配置 Vite 代理 + 清理 Supabase 依赖
Step 6 → 数据迁移 + 测试验证
```

---

## Step 1：搭建 Express 后端

### 1.1 创建后端目录

```bash
mkdir server
cd server
npm init -y
npm install express mysql2 cors dotenv uuid
npm install -D nodemon
```

### 1.2 基础入口 `server/index.js`

```javascript
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// MySQL 连接池
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'paike',
  waitForConnections: true,
  connectionLimit: 10,
});

// 导出连接池供路由使用
module.exports = { app, pool };

// 注册路由
require('./routes/teachers')(app, pool);
require('./routes/classGroups')(app, pool);
require('./routes/coursePlans')(app, pool);
require('./routes/scheduleRules')(app, pool);
require('./routes/schedulePlans')(app, pool);
require('./routes/scheduleSlots')(app, pool);
require('./routes/semesters')(app, pool);

const PORT = process.env.API_PORT || 3001;
app.listen(PORT, () => console.log(`API Server running on :${PORT}`));
```

### 1.3 环境变量 `server/.env`

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=paike
API_PORT=3001
```

---

## Step 2：数据库 Schema 迁移

### 2.1 PostgreSQL → MySQL 类型对照

| PostgreSQL | MySQL | 说明 |
|------------|-------|------|
| `UUID` | `CHAR(36)` | MySQL 8.0+ 支持 `DEFAULT (UUID())` |
| `TEXT[]` | `JSON` | 数组字段改用 JSON |
| `JSONB` | `JSON` | MySQL 的 JSON 无 GIN 索引 |
| `TIMESTAMPTZ` | `DATETIME` | 无时区，应用层处理 |
| `gen_random_uuid()` | `UUID()` | MySQL 8.0+ 内置 |
| `BOOLEAN` | `TINYINT(1)` | `0/1` 代替 `true/false` |
| `CHECK(...)` | `CHECK(...)` | MySQL 8.0.16+ 支持 |
| RLS 策略 | - | MySQL 无 RLS，改为后端中间件鉴权 |

### 2.2 MySQL 建表脚本 `server/init_mysql.sql`

```sql
-- ============================================
-- K12 排课系统 - MySQL 数据库初始化
-- 要求：MySQL 8.0+
-- ============================================

CREATE DATABASE IF NOT EXISTS paike
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE paike;

-- 1. 学期
CREATE TABLE IF NOT EXISTS semesters (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(100) NOT NULL,
  start_date DATE NULL,
  end_date DATE NULL,
  is_active TINYINT(1) DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. 教师
CREATE TABLE IF NOT EXISTS teachers (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  employee_id VARCHAR(50) UNIQUE,
  name VARCHAR(100) NOT NULL,
  subjects JSON NOT NULL DEFAULT ('[]'),
  max_weekly_hours INT DEFAULT 12,
  phone VARCHAR(20),
  email VARCHAR(100),
  color VARCHAR(100),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. 班级
CREATE TABLE IF NOT EXISTS class_groups (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(100) NOT NULL,
  grade INT NOT NULL,
  head_teacher_id CHAR(36),
  student_count INT DEFAULT 0,
  academic_year VARCHAR(20),
  semester_id CHAR(36),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (head_teacher_id) REFERENCES teachers(id) ON DELETE SET NULL,
  FOREIGN KEY (semester_id) REFERENCES semesters(id) ON DELETE SET NULL
);

-- 4. 教室
CREATE TABLE IF NOT EXISTS rooms (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(100) NOT NULL,
  room_number VARCHAR(20) NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT '普通教室',
  capacity INT NOT NULL DEFAULT 50,
  building VARCHAR(50),
  floor INT,
  facilities JSON DEFAULT ('[]'),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5. 课程计划
CREATE TABLE IF NOT EXISTS course_plans (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  class_id CHAR(36) NOT NULL,
  teacher_id CHAR(36) NOT NULL,
  subject VARCHAR(50) NOT NULL,
  weekly_hours INT NOT NULL DEFAULT 4,
  room_id CHAR(36),
  semester_id CHAR(36),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (class_id) REFERENCES class_groups(id) ON DELETE CASCADE,
  FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL,
  FOREIGN KEY (semester_id) REFERENCES semesters(id) ON DELETE SET NULL
);

-- 6. 排课规则
CREATE TABLE IF NOT EXISTS schedule_rules (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  semester_id CHAR(36),
  rule_type VARCHAR(50) NOT NULL,
  config JSON NOT NULL DEFAULT ('{}'),
  enabled TINYINT(1) DEFAULT 1,
  priority VARCHAR(20) DEFAULT 'medium',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (semester_id) REFERENCES semesters(id) ON DELETE CASCADE
);

-- 7. 排课方案
CREATE TABLE IF NOT EXISTS schedule_plans (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(200) NOT NULL,
  semester_id CHAR(36),
  status VARCHAR(20) DEFAULT 'draft',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (semester_id) REFERENCES semesters(id) ON DELETE SET NULL
);

-- 8. 排课时间槽
CREATE TABLE IF NOT EXISTS schedule_slots (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  plan_id CHAR(36) NOT NULL,
  day INT NOT NULL CHECK (day >= 0 AND day <= 6),
  period INT NOT NULL CHECK (period >= 0 AND period <= 7),
  course_plan_id CHAR(36) NOT NULL,
  room_id CHAR(36),
  is_locked TINYINT(1) DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_slot (plan_id, day, period, course_plan_id),
  FOREIGN KEY (plan_id) REFERENCES schedule_plans(id) ON DELETE CASCADE,
  FOREIGN KEY (course_plan_id) REFERENCES course_plans(id) ON DELETE CASCADE,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL
);

-- 索引
CREATE INDEX idx_cp_class ON course_plans(class_id);
CREATE INDEX idx_cp_teacher ON course_plans(teacher_id);
CREATE INDEX idx_ss_plan ON schedule_slots(plan_id);
CREATE INDEX idx_ss_course ON schedule_slots(course_plan_id);
```

### 2.3 `subjects` 字段差异处理

PostgreSQL 用 `TEXT[]` 存储教师科目数组：
```sql
-- PostgreSQL: subjects = '{语文,数学}'
-- MySQL:     subjects = '["语文","数学"]'
```

前端代码中 `teacher.subjects` 从 Supabase 返回时已经是 `string[]`，MySQL 的 JSON 字段通过 `JSON.parse()` 即可获得相同结构。在后端 API 中处理：

```javascript
// 查询后解析
rows.forEach(row => {
  if (typeof row.subjects === 'string') {
    row.subjects = JSON.parse(row.subjects);
  }
});
```

---

## Step 3：编写 RESTful API 路由

### 3.1 路由示例：`server/routes/teachers.js`

```javascript
const { v4: uuidv4 } = require('uuid');

module.exports = (app, pool) => {
  // 查询所有教师
  app.get('/api/teachers', async (req, res) => {
    try {
      const [rows] = await pool.query(
        'SELECT * FROM teachers ORDER BY name'
      );
      rows.forEach(r => {
        if (typeof r.subjects === 'string') r.subjects = JSON.parse(r.subjects);
      });
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 新增教师
  app.post('/api/teachers', async (req, res) => {
    try {
      const id = uuidv4();
      const { name, employee_id, subjects, max_weekly_hours, phone, email, color } = req.body;
      await pool.query(
        `INSERT INTO teachers (id, name, employee_id, subjects, max_weekly_hours, phone, email, color)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, name, employee_id, JSON.stringify(subjects || []), max_weekly_hours || 12, phone, email, color]
      );
      const [rows] = await pool.query('SELECT * FROM teachers WHERE id = ?', [id]);
      rows[0].subjects = JSON.parse(rows[0].subjects);
      res.json(rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 更新教师
  app.put('/api/teachers/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const fields = { ...req.body };
      if (fields.subjects) fields.subjects = JSON.stringify(fields.subjects);
      const keys = Object.keys(fields);
      const sql = `UPDATE teachers SET ${keys.map(k => `${k} = ?`).join(', ')} WHERE id = ?`;
      await pool.query(sql, [...keys.map(k => fields[k]), id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 删除教师
  app.delete('/api/teachers/:id', async (req, res) => {
    try {
      await pool.query('DELETE FROM teachers WHERE id = ?', [req.params.id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
};
```

### 3.2 完整路由清单

需要为以下 7 个实体各创建 CRUD 路由文件：

| 文件 | 接口数 | 特殊事项 |
|------|--------|---------|
| `routes/semesters.js` | 2 (GET, POST) | |
| `routes/teachers.js` | 4 (CRUD) | `subjects` JSON 序列化 |
| `routes/classGroups.js` | 4 (CRUD) | |
| `routes/coursePlans.js` | 4 (CRUD) | GET 需 JOIN teachers + class_groups |
| `routes/scheduleRules.js` | 4 (CRUD) | `config` JSON 字段 |
| `routes/schedulePlans.js` | 4 (CRUD) | |
| `routes/scheduleSlots.js` | 3 (GET, POST/批量, DELETE) | 批量插入 + 先删后插模式 |

`coursePlans` 的 GET 需要特殊 JOIN（当前 Supabase 用内嵌关联查询）：

```javascript
app.get('/api/course-plans', async (req, res) => {
  const [rows] = await pool.query(`
    SELECT cp.*, t.name AS teacher_name, cg.name AS class_name
    FROM course_plans cp
    LEFT JOIN teachers t ON cp.teacher_id = t.id
    LEFT JOIN class_groups cg ON cp.class_id = cg.id
    ORDER BY cp.created_at
  `);
  res.json(rows);
});
```

---

## Step 4：重写前端 store.ts

### 4.1 新建 `src/lib/api.ts`（替代 supabaseClient.ts）

```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: '/api', // Vite 代理会转发到后端
  timeout: 10000,
});

export default api;
```

### 4.2 store.ts 改写对照

```typescript
// ===== 改前 (Supabase) =====
import { supabase } from './supabaseClient';

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

deleteTeacher: async (id) => {
  const { error } = await supabase.from('teachers').delete().eq('id', id);
  if (error) throw error;
  set(s => ({ teachers: s.teachers.filter(x => x.id !== id) }));
},


// ===== 改后 (Axios + MySQL) =====
import api from './api';

fetchTeachers: async () => {
  const { data } = await api.get('/teachers');
  set({ teachers: data });
},

addTeacher: async (t) => {
  const { data } = await api.post('/teachers', t);
  set(s => ({ teachers: [...s.teachers, data] }));
  return data;
},

deleteTeacher: async (id) => {
  await api.delete(`/teachers/${id}`);
  set(s => ({ teachers: s.teachers.filter(x => x.id !== id) }));
},
```

### 4.3 特别注意：coursePlans 的关联查询

当前 Supabase 使用内嵌关联语法：
```typescript
// Supabase
.from('course_plans').select('*, teachers:teacher_id(name), class_groups:class_id(name)')
```

改为直接调 API（后端已做 JOIN）：
```typescript
// MySQL
const { data } = await api.get('/course-plans');
// data 已经包含 teacher_name 和 class_name
set({ coursePlans: data });
```

---

## Step 5：Vite 代理 + 清理

### 5.1 配置开发代理 `vite.config.ts`

```typescript
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  // ...其余配置不变
});
```

### 5.2 清理 Supabase 依赖

```bash
# 移除 Supabase SDK
npm uninstall @supabase/supabase-js

# 安装 Axios
npm install axios

# 删除 Supabase 客户端
rm src/lib/supabaseClient.ts

# .env 中删除 Supabase 配置，改为后端地址（如需）
```

### 5.3 文件变更清单

| 操作 | 文件 |
|------|------|
| **删除** | `src/lib/supabaseClient.ts` |
| **重写** | `src/lib/store.ts`（全部 Supabase 调用 → Axios） |
| **新建** | `src/lib/api.ts` |
| **新建** | `server/` 整个后端目录 |
| **修改** | `vite.config.ts`（加 proxy） |
| **修改** | `package.json`（移除 supabase，加 axios） |
| **修改** | `.env`（移除 Supabase，加 MySQL） |

---

## Step 6：数据迁移

如果已有生产数据需要迁移：

```bash
# 1. 从 Supabase 导出 CSV
# Supabase Dashboard → Table Editor → Export CSV

# 2. 导入到 MySQL
mysql -u root -p paike < server/init_mysql.sql

# 3. 用 LOAD DATA 或 Python 脚本导入 CSV
# 注意 subjects 字段从 PostgreSQL 数组格式 {a,b} 转为 JSON ["a","b"]
```

### subjects 数据格式转换脚本

```python
import json, csv

with open('teachers.csv', 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        pg_array = row['subjects']  # '{语文,数学}'
        items = pg_array.strip('{}').split(',')
        mysql_json = json.dumps(items, ensure_ascii=False)
        print(f"UPDATE teachers SET subjects='{mysql_json}' WHERE id='{row['id']}';")
```

---

## 常见问题

### Q: 是否有更简单的方案？
**A:** 如果只是想换 MySQL 但保持"无后端"的开发体验，可以考虑：
- **PlanetScale** — MySQL 的 Serverless 方案，有 JS SDK
- **Prisma + PlanetScale** — ORM 抽象层，切换数据库只需改一行配置

### Q: 迁移后 RLS 安全策略怎么办？
**A:** MySQL 没有 RLS。安全控制移到 Express 中间件：
```javascript
app.use('/api', (req, res, next) => {
  // 校验 JWT / API Key
  const token = req.headers.authorization;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  // verify(token) ...
  next();
});
```

### Q: JSON 字段在 MySQL 中的查询性能？
**A:** MySQL 的 JSON 字段不支持 GIN 索引（PostgreSQL 有）。对于本项目的数据量（几十条规则），JSON 查询性能完全不是问题。如果数据量增大，建议将 JSON 中的常用查询字段拆为独立列。
