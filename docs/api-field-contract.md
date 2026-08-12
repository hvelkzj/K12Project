# 公共字段契约

版本：7/28 字段基线，7/29 公共 TypeScript 包已通过 PR #4 合并。

本文件只确定跨端字段，不提前实现 B、C、D、E 的业务接口。接口 JSON 使用 camelCase，数据库列使用 snake_case。

实现位置：业务类型和状态由 `@k12/shared` 导出；六角色测试账号由 `@k12/shared/mock-accounts` 导出。

## 公共规则

| 项目 | 约定 |
|---|---|
| ID | API 为 `number`，数据库为整数主键 |
| 时间点 | 带时区的 ISO 8601 字符串，例如 `2026-08-07T09:30:00+08:00` |
| 课次日期 | `YYYY-MM-DD` |
| 课次时间 | `HH:mm:ss` |
| 可选值 | 标记为 `?` 的字段可使用 `null` 或省略；TypeScript 表达为 `?: T \| null` |
| 权限 | 后端根据当前用户和关联 ID 校验，不能只依赖前端隐藏入口 |

## 公共摘要

| 类型 | 字段 |
|---|---|
| `CampusSummary` | `id`、`name` |
| `ClassSummary` | `id`、`campusId`、`name` |
| `CourseSummary` | `id`、`campusId`、`name`、`subject` |
| `UserSummary` | `id`、`displayName`、`role`、`campusId`、`campusName?` |
| `UserAccountSummary` | `UserSummary` 全部字段，以及 `username`、`active` |
| `StudentSummary` | `id`、`displayName`、`classId`、`className`、`campusId`、`campusName` |
| `FileSummary` | `id`、`originalName`、`mimeType`、`byteSize`、`createdAt` |
| `ScheduleSummary` | `id`、`campusId`、`classId`、`courseId`、`teacherId`、`lessonDate`、`startTime`、`endTime`、`room`、`status` |

## 角色和状态

| 范围 | 代码值 |
|---|---|
| 角色 | `PARENT`、`STUDENT`、`TEACHER`、`HOMEROOM_TEACHER`、`ACADEMIC_ADMIN`、`SYSTEM_ADMIN` |
| 排课 | `SCHEDULED`、`CHANGED`、`COMPLETED`、`CANCELLED` |
| 请假 | `PENDING`、`APPROVED`、`REJECTED` |
| 签到 | `PRESENT`、`LATE`、`ABSENT`、`LEAVE` |
| 提交记录 | `SUBMITTED`、`GRADED`、`REVISION_REQUIRED` |
| 调课 | `PENDING`、`APPROVED`、`REJECTED`、`SUBSTITUTE_ASSIGNED`、`COMPLETED` |
| 家校反馈 | `PENDING_PARENT`、`CONFIRMED`、`DISPUTED` |
| 反馈工单 | `OPEN`、`PROCESSING`、`CLOSED` |
| 通知类型 | `SCHEDULE_CHANGE`、`FEEDBACK`、`GENERAL` |

`NOT_SUBMITTED` 是没有提交记录时的页面派生状态；`DRAFT` 是未发送请假表单的本地状态。两者不写入数据库。

## 登录与当前用户

| 类型 | 字段 |
|---|---|
| `LoginRequest` | `username`、`password` |
| `LoginResponse` | `accessToken`、`tokenType`、`expiresAt`、`user` |
| `CurrentUserResponse` | `user` |
| `ApiError` | `code`、`message` |

| 接口 | 说明 |
|---|---|
| `POST /auth/login` | 使用六角色 Mock 账号创建八小时会话 |
| `GET /auth/me` | 使用 Bearer 令牌读取当前用户 |
| `POST /auth/logout` | 删除当前令牌对应的会话 |

Mock 密码不进入用户响应。当前内存会话用于第一周演示，后续再接 `users` 和 `sessions` 表。

## B：家长端和通知

| 类型 | 字段 |
|---|---|
| `ParentStudentBinding` | `parentId`、`student`、`relationship`、`createdAt` |
| `LeaveRequest` | `id`、`parentId`、`studentId`、`scheduleId`、`reason`、`contactPhone`、`status`、`reviewedBy?`、`reviewNote`、`reviewedAt?`、`createdAt`、`updatedAt` |
| `Notification` | `id`、`userId`、`studentId?`、`type`、`title`、`content`、`relatedType`、`relatedId?`、`readAt?`、`createdAt` |
| `ScheduleChangeNotice` | `notification`、`originalDate`、`originalStartTime`、`originalEndTime`、`newDate`、`newStartTime`、`newEndTime`、`originalTeacherName`、`substituteTeacherName?` |

`read` 由 `readAt != null` 推导。调课通知展示字段由通知关联的调课记录生成，不在通知表中重复保存。

## C、D：作业、提交和批改

| 类型 | 字段 |
|---|---|
| `Courseware` | `id`、`classId`、`courseId`、`teacherId`、`title`、`description`、`attachments`、`publishedAt` |
| `Assignment` | `id`、`campusId`、`classId`、`courseId`、`scheduleId?`、`teacherId`、`title`、`description`、`attachments`、`dueAt`、`allowLate`、`publishedAt`、`createdAt`、`updatedAt` |
| `Submission` | `id`、`assignmentId`、`studentId`、`attempt`、`content`、`attachments`、`status`、`submittedAt`、`score?`、`teacherComment`、`gradedBy?`、`gradedAt?`、`updatedAt` |

- `attachments` 类型为 `FileSummary[]`。
- `score` 范围为 0–100。
- `correctionRequired` 由 `status === 'REVISION_REQUIRED'` 推导。
- 订正时新增更大的 `attempt`，不能覆盖旧提交。
- `allowLate` 为 `false` 且已超过 `dueAt` 时，后端拒绝新提交。

## D：签到和课后反馈

| 类型 | 字段 |
|---|---|
| `AttendanceRecord` | `id`、`scheduleId`、`studentId`、`status`、`note`、`recordedBy`、`recordedAt` |
| `StudentFeedback` | `id`、`campusId`、`scheduleId`、`studentId`、`teacherId`、`performance`、`strengths`、`improvements`、`suggestion`、`status`、`parentResponse`、`respondedBy?`、`respondedAt?`、`sentAt`、`updatedAt` |

同一课次、同一学生只能有一条签到和一条课后反馈。

## B、D、E：调课、反馈工单

| 类型 | 字段 |
|---|---|
| `ScheduleChange` | `id`、`campusId`、`scheduleId`、`requestedBy`、`reason`、`originalTeacherId`、`originalDate`、`originalStartTime`、`originalEndTime`、`proposedDate`、`proposedStartTime`、`proposedEndTime`、`status`、`decisionNote`、`reviewedBy?`、`reviewedAt?`、`substituteTeacherId?`、`substituteNote`、`createdAt`、`updatedAt` |
| `FeedbackWorkOrder` | `id`、`feedbackId`、`campusId`、`issue`、`status`、`handlerId?`、`result`、`createdAt`、`updatedAt`、`closedAt?` |

- 调课拒绝时 `decisionNote` 必填。
- `SUBSTITUTE_ASSIGNED` 和 `COMPLETED` 状态必须有 `substituteTeacherId`。
- 工单 `issue` 从关联反馈的 `parentResponse` 读取，不在工单表重复保存。
- 工单关闭时 `result` 和 `closedAt` 必填。

## 数据范围

| 角色 | 后端过滤依据 |
|---|---|
| 家长 | `parent_students.parent_id` 与 `student_id` 绑定 |
| 学生 | 当前用户 ID 等于业务记录的 `student_id` |
| 教师 | 当前用户 ID 等于排课或作业的 `teacher_id` |
| 班主任 | `classes.homeroom_teacher_id`，教学写操作仍要求本人授课 |
| 教务 | 当前用户 `campus_id` 等于业务记录 `campus_id` |
| 系统管理员 | 所属机构下全部校区；第一版单机构运行 |

字段来源和裁决过程见 `docs/abcde-field-decisions-2026-08-07.md`。

## 公共字段变更申请

B、C、D、E 不直接新增第二套公共字段。需要扩展契约时，把以下信息交给 A：

```text
提出成员：
业务场景：
公共类型：
字段名：
TypeScript 类型：
是否必填：
允许 null：
示例 JSON：
不增加该字段会阻塞什么流程：
```

A 审核后同时更新公共类型、契约文档、测试和影响说明。
