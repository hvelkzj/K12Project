# 7/28 公共数据模型

数据库：PostgreSQL。初始迁移：`apps/api/db/migrations/001_initial.sql`。

## 基础数据

| 表 | 用途 | 关键约束 |
|---|---|---|
| `organizations` | 机构 | 名称唯一 |
| `campuses` | 校区 | 机构内名称唯一，保存时区 |
| `users` | 账号和角色 | 用户名唯一，角色限六种 |
| `sessions` | 登录会话 | 只保存令牌摘要和过期时间 |
| `classes` | 班级 | 校区内名称唯一，关联班主任 |
| `parent_students` | 家长学生绑定 | 家长与学生组合唯一 |
| `class_students` | 班级学生 | 班级与学生组合唯一 |
| `courses` | 课程 | 校区内名称唯一 |
| `schedules` | 排课 | 结束时间晚于开始时间 |

## 业务数据

| 表 | 负责人/使用端 | 关键约束 |
|---|---|---|
| `attendance` | D | 每个课次、每个学生一条签到 |
| `leave_requests` | B、E | 关联家长、学生和课次 |
| `stored_files` | A，供 C/D 使用 | 保存附件元数据，不把文件写入数据库 |
| `courseware`、`courseware_attachments` | C、D | 课件可有多个附件 |
| `assignments`、`assignment_attachments` | C、D | 作业关联班级、课程和迟交规则 |
| `submissions`、`submission_attachments` | C、D | `assignment + student + attempt` 唯一 |
| `student_feedback` | B、D | 每个课次、每个学生一条反馈 |
| `feedback_work_orders` | E | 与异议反馈一对一，关闭必须填写结果 |
| `schedule_changes` | B、D、E | 一条记录完成申请、审批和代课流程 |
| `notifications` | B | 关联业务记录，已读状态由 `read_at` 表示 |
| `audit_logs` | A、E | 记录关键操作，不保存业务真值 |

## 三条主要关联

调课：

`schedules → schedule_changes → notifications`

作业：

`assignments → assignment_attachments → submissions → submission_attachments`

反馈：

`student_feedback → feedback_work_orders`

## 数据不重复原则

- 审批和代课字段保存在 `schedule_changes`，不另建审批表和代课表。
- 工单异议内容从 `student_feedback.parent_response` 读取。
- 姓名、班级名、课程名和校区名通过关联查询返回，不复制到业务表。
- 调课记录保存原时间快照，因为原排课批准后可能更新；通知不再复制这些字段。
- “未提交”“是否需要订正”“通知是否已读”均由已有数据推导。

## 本地验证

安装依赖和运行结构测试的命令在 macOS 终端与 Windows PowerShell 中相同：

```bash
npm ci
npm run test --workspace @k12/api
```

本地已安装 PostgreSQL 客户端时，两种系统都可以执行：

```bash
psql -d k12 -f apps/api/db/migrations/001_initial.sql
```

迁移只创建结构，不包含真实账号或个人信息。A 的 7/29 公共类型、登录接口和六角色测试账号 Mock 已通过 PR #4 合并，见 `docs/a-7-29-public-types-and-auth.md`。当前认证使用内存会话，后续数据库接入时再读写 `users` 和 `sessions` 表。
