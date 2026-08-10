# K12 教育培训综合管理平台

五人协作完成的课程项目，包含家长、学生、教师/班主任、教务和系统后台。

## 核心功能

- 排课与调课：教师申请，教务审批并安排代课，家长收到通知。
- 家校反馈：教师填写反馈，家长确认或提出异议，教务处理。
- 作业：教师发布和批改，学生提交并查看结果。
- 权限：不同角色只能查看和操作自己范围内的数据。

## 文档

- [项目分工与四周计划](docs/project-plan.md)
- [第一周执行计划](docs/week-1-execution-plan.md)
- [参考产品](docs/reference-products.md)
- [业务规则](docs/business-rules.md)
- [7/28 字段汇总](docs/a-field-summary-2026-07-28.md)
- [ABCDE 字段联合决议](docs/abcde-field-decisions-2026-08-07.md)
- [公共字段契约](docs/api-field-contract.md)
- [公共数据模型](docs/data-model.md)
- [7/29 公共类型与登录交付](docs/a-7-29-public-types-and-auth.md)
- [模块页面总清单](docs/module-page-inventory.md)
- [实验报告材料](docs/report-evidence.md)
- [协作规则](AGENTS.md)

## 项目目录

| 目录 | 负责人 | 本地地址 |
|---|---|---|
| `packages/shared` | A | 公共类型、状态和测试账号，不单独启动 |
| `apps/api` | A | `http://127.0.0.1:3000` |
| `apps/parent-web` | B | `http://127.0.0.1:5173` |
| `apps/student-web` | C | `http://127.0.0.1:5174` |
| `apps/teacher-web` | D | `http://127.0.0.1:5175` |
| `apps/admin-web` | E | `http://127.0.0.1:5176` |

教务后台和系统后台共用 `admin-web`，登录后再按角色显示功能。

## 本地启动

支持 macOS 和 Windows。两种系统都需要 Node.js 22.12 或更高版本、npm 10 或更高版本。

```bash
node -v
npm -v
npm ci
npm run dev
```

`npm run dev` 会同时启动后端和四个前端。后端健康检查地址为
`http://127.0.0.1:3000/health`。

认证接口：

- `POST /auth/login`
- `GET /auth/me`
- `POST /auth/logout`

六角色测试账号和请求格式见 [7/29 公共类型与登录交付](docs/a-7-29-public-types-and-auth.md)。

只启动一个项目：

```bash
npm run dev:api
npm run dev:parent
npm run dev:student
npm run dev:teacher
npm run dev:admin
```

需要修改端口或 API 地址时，先复制对应项目中的 `.env.example` 为
`.env`，再修改本地文件。不要提交 `.env`。

macOS：

```bash
cp apps/parent-web/.env.example apps/parent-web/.env
```

Windows PowerShell：

```powershell
Copy-Item apps/parent-web/.env.example apps/parent-web/.env
```

其他模块只需替换路径中的模块名。默认配置可直接运行时，不需要创建 `.env`。

## 提交前检查

```bash
npm run check
```

该命令在 macOS 终端和 Windows PowerShell 中相同，会运行代码规范、类型检查、测试和生产构建。

依赖发生变化时运行 `npm install` 并提交 `package-lock.json`；仅同步别人已提交的依赖时运行 `npm ci`。

## 数据库结构

7/28 初始迁移位于 `apps/api/db/migrations/001_initial.sql`。安装 PostgreSQL 客户端后，macOS 终端和 Windows PowerShell 使用相同命令创建本地结构：

```bash
psql -d k12 -f apps/api/db/migrations/001_initial.sql
```

不连接数据库也可以运行迁移结构测试：

```bash
npm run test --workspace @k12/api
```

初始迁移不包含真实账号或个人信息。
