# 公共字段契约

版本：7/28 字段基线；7/29 公共 TypeScript 包；8/20 第二轮管理接口；8/24 公开注册与附件传输；8/25 学生多端、课件与考勤闭环。

本文件记录跨端字段和已确认接口。接口 JSON 使用 camelCase，数据库列使用 snake_case。

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
| `StudentOverview` | `student`、`courses`、`teachers`、`courseware`、`assignments`、`submissions`、`attendance` |

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
| `RegisterRequest` | `username`、`password`、`displayName`、`role: 'PARENT' \| 'STUDENT'` |
| `RegisterResponse` | `user: UserAccountSummary` |
| `CurrentUserResponse` | `user` |
| `ApiError` | `code`、`message` |

| 接口 | 说明 |
|---|---|
| `POST /auth/register` | 创建家长或学生账号，成功返回 `201 RegisterResponse` |
| `POST /auth/login` | 使用六角色 Mock 账号创建八小时会话 |
| `GET /auth/me` | 使用 Bearer 令牌读取当前用户 |
| `POST /auth/logout` | 删除当前令牌对应的会话 |

注册规则：

- `username` 为 4–24 位，以小写字母开头，只包含小写字母、数字和下划线。
- `displayName` 为 2–20 个字符。
- `password` 为 8–64 位，同时包含字母和数字。
- 公开注册只允许 `PARENT` 和 `STUDENT`；教师和管理角色由后台分配。
- 重复用户名返回 `409 USERNAME_TAKEN`，字段错误返回 `422 VALIDATION_ERROR`。
- 学生注册后加入默认校区和班级；家长注册后初始无学生绑定。

Mock 密码和注册密码均不进入用户响应。当前内存账号与会话用于课程项目运行，服务重启后注册账号和会话失效。

## 2026-08-17 共享业务 API

本轮业务 API 使用进程内共享仓库。服务启动时根据公共账号和业务契约建立初始数据；服务重启后恢复初始状态。本轮不连接 PostgreSQL。附件的元数据和真实字节都保存在当前进程内，重启后恢复初始附件。

所有业务接口要求 Bearer Token。`parentId`、`studentId`、`teacherId`、`requestedBy`、`reviewedBy`、`handlerId`、`gradedBy` 和 `recordedBy` 等身份字段由当前会话或后端关联生成，不接受请求体覆盖。

### 概览响应

概览响应组合现有公共类型，不增加同名公共实体。

| 接口 | 响应字段 |
|---|---|
| `GET /parent/students` | `ParentStudentBinding[]` |
| `GET /parent/students/:studentId/overview` | `student: StudentSummary`、`schedules: ScheduleSummary[]`、`courses: CourseSummary[]`、`teachers: UserSummary[]`、`leaveRequests: LeaveRequest[]`、`notifications: Notification[]`、`scheduleChangeNotices: ScheduleChangeNotice[]`、`feedback: StudentFeedback[]`、`attendance: AttendanceRecord[]` |
| `GET /student/overview` | `StudentOverview` |
| `GET /teacher/overview` | `campuses: CampusSummary[]`、`classes: ClassSummary[]`、`students: StudentSummary[]`、`courses: CourseSummary[]`、`schedules: ScheduleSummary[]`、`attendance: AttendanceRecord[]`、`courseware: Courseware[]`、`assignments: Assignment[]`、`submissions: Submission[]`、`feedback: StudentFeedback[]`、`scheduleChanges: ScheduleChange[]`、`leaveRequests: LeaveRequest[]` |
| `GET /admin/overview` | `campuses: CampusSummary[]`、`classes: ClassSummary[]`、`courses: CourseSummary[]`、`schedules: ScheduleSummary[]`、`users: UserAccountSummary[]`、`teachers: UserSummary[]`、`scheduleChanges: ScheduleChange[]`、`feedbackWorkOrders: FeedbackWorkOrder[]`、`leaveRequests: LeaveRequest[]` |

### 写接口

| 接口 | 请求字段 | 成功响应 |
|---|---|---|
| `POST /parent/leave-requests` | `studentId`、`scheduleId`、`reason`、`contactPhone` | `201 LeaveRequest` |
| `PATCH /parent/feedback/:feedbackId` | `status: 'CONFIRMED' \| 'DISPUTED'`、`parentResponse` | `200 StudentFeedback` |
| `POST /student/submissions` | `assignmentId`、`content`、`attachments: FileSummary[]` | `201 Submission` |
| `PUT /teacher/attendance` | `scheduleId`、`records: { studentId, status, note }[]` | `200 AttendanceRecord[]` |
| `POST /teacher/assignments` | `classId`、`courseId`、`scheduleId?`、`title`、`description`、`attachments`、`dueAt`、`allowLate` | `201 Assignment` |
| `POST /teacher/courseware` | `classId`、`courseId`、`title`、`description`、`attachments` | `201 Courseware` |
| `PATCH /teacher/submissions/:submissionId` | `score`、`teacherComment`、`correctionRequired` | `200 Submission` |
| `POST /teacher/feedback` | `scheduleId`、`studentId`、`performance`、`strengths`、`improvements`、`suggestion` | `201 StudentFeedback` |
| `POST /teacher/schedule-changes` | `scheduleId`、`reason`、`proposedDate`、`proposedStartTime`、`proposedEndTime` | `201 ScheduleChange` |
| `PATCH /admin/schedule-changes/:changeId/review` | `decision: 'APPROVED' \| 'REJECTED'`、`decisionNote` | `200 ScheduleChange` |
| `PATCH /admin/schedule-changes/:changeId/substitute` | `substituteTeacherId`、`substituteNote` | `200 ScheduleChange` |
| `PATCH /admin/work-orders/:workOrderId` | `action: 'START' \| 'CLOSE'`、`result?` | `200 FeedbackWorkOrder` |

### 附件上传与下载

| 接口 | 请求 | 成功响应 |
|---|---|---|
| `POST /student/files?name=:originalName` | 原始文件字节；`Content-Type` 为文件 MIME | `201 FileSummary` |
| `POST /teacher/files?name=:originalName` | 原始文件字节；`Content-Type` 为文件 MIME | `201 FileSummary` |
| `GET /files/:fileId` | Bearer Token | 文件字节；响应包含 MIME、长度和下载文件名 |

- 支持 PDF、DOCX、JPG、JPEG 和 PNG，单个文件不超过 10 MB，空文件返回错误。
- APP 与小程序上传时可使用 `Content-Transfer-Encoding: base64` 传输文件内容；服务端解码后仍按原始字节执行 10 MB 限制。
- 作业或提交只能引用当前用户刚上传的附件，不能伪造其他文件的 `FileSummary`。
- 学生只能下载本班作业、课件和本人提交附件；教师只能下载本人发布内容及本人作业对应的学生提交附件。
- 家长不能下载作业文件；教务按所属校区访问，系统管理员按关联业务范围访问。
- 上传、下载和业务写接口都使用 Bearer Token；浏览器下载会保存为原始文件名。

### 2026-08-20 第二轮管理接口

| 接口 | 请求字段 | 成功响应 |
|---|---|---|
| `PATCH /parent/notifications/:notificationId/read` | `read: true` | `200 Notification` |
| `PATCH /admin/leave-requests/:leaveRequestId/review` | `decision: 'APPROVED' \| 'REJECTED'`、`reviewNote` | `200 LeaveRequest` |
| `POST /admin/schedules` | `campusId`、`classId`、`courseId`、`teacherId`、`lessonDate`、`startTime`、`endTime`、`room` | `201 ScheduleSummary` |
| `PATCH /admin/schedules/:scheduleId` | `teacherId?`、`lessonDate?`、`startTime?`、`endTime?`、`room?`、`status?: 'SCHEDULED' \| 'CANCELLED'`；至少一个字段 | `200 ScheduleSummary` |
| `PATCH /admin/users/:userId` | `active: boolean` | `200 UserAccountSummary` |

- 通知标记已读是幂等操作；已有 `readAt` 时不覆盖原时间。
- 教务只能审批和维护所属校区；系统管理员可以操作全部校区。
- 排课新增和修改必须校验班级、课程、教师的校区归属，并阻止教师或班级时间冲突。
- `campusId`、`classId`、`courseId` 是已有课次的身份字段，不能通过 PATCH 修改。
- 普通字段修改且未提供 `status` 时，服务端把状态改为 `CHANGED`。
- 取消课次通过同一个 PATCH 接口发送 `status: 'CANCELLED'`；已取消或已完成课次不能再次修改。
- 请假拒绝必须填写 `reviewNote`，已经审批的申请不能重复审批。
- 已批准请假的学生签到只能是 `LEAVE`；审批前已有其他签到状态时，批准操作同步纠正为 `LEAVE`。
- 账号启停仅系统管理员可用；当前系统管理员不能停用自己。
- 停用账号后撤销该账号全部会话，后续登录统一返回 `INVALID_CREDENTIALS`；重新启用后可以再次登录。

### 错误和联动

| HTTP 状态 | 错误代码 | 使用场景 |
|---:|---|---|
| `401` | `AUTH_REQUIRED`、`INVALID_SESSION` | Token 缺失、格式错误、未知或过期 |
| `403` | `FORBIDDEN` | 角色不允许、未绑定学生、非本人课程或跨校区访问 |
| `404` | `NOT_FOUND` | 学生、课程、课次或业务记录不存在 |
| `409` | `CONFLICT` | 重复提交、重复签到、重复审批、状态不允许或代课时间冲突 |
| `422` | `VALIDATION_ERROR` | 字段格式、必填值、时间、分数或业务规则错误 |

文件请求体超过 10 MB 时返回 `413 PAYLOAD_TOO_LARGE`。

- 教师发布作业后学生概览立即可见；学生提交后教师概览立即可见；教师批改后学生概览返回新状态、分数和评语。
- 教师发布课件后，学生网页端、Android APP 和微信小程序通过同一个学生概览读取。
- 教师签到保存后，学生概览和已绑定家长概览读取同一条考勤记录。
- 家长提出异议后创建 `OPEN` 反馈工单。
- 安排代课后更新课次并为受影响班级的已绑定学生生成调课通知。
- 业务写接口只接受 `application/json`；跨域预检允许 `GET`、`POST`、`PUT`、`PATCH` 和 `OPTIONS`。

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
