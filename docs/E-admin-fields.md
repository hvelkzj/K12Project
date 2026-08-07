# E成员：教务/系统后台页面与字段清单

## 1. 页面清单

| 页面 | 路由 | 说明 |
|---|---|---|
| 登录 | `/login` | 教务和管理员共用登录页 |
| 工作台 | `/dashboard` | 显示今日待办和统计 |
| 排课 | `/schedule` | 排课与课程管理 |
| 审批 | `/approval` | 调课申请审批（通过/拒绝） |
| 代课 | `/substitute` | 代课安排与冲突检查 |
| 反馈工单 | `/ticket` | 反馈异议工单处理 |
| 用户 | `/users` | 账号、角色、权限管理 |
| 看板 | `/board` | 数据看板 |

## 2. 审批字段（调课申请，依赖 D 的调课申请字段）

- `approval_id`: 审批记录唯一标识
- `request_id`: 关联的调课申请 ID（来自 D）
- `course_id`: 关联的课程 ID
- `class_id`: 关联的班级 ID
- `original_time_slot`: 原时间段
- `new_time_slot`: 新时间段
- `status`: 审批状态（枚举值：待审批、已通过、已拒绝）
- `reject_reason`: 拒绝原因（业务规则：拒绝时必须填写）
- `reviewer_id`: 审批人（教务）ID
- `reviewed_at`: 审批时间

## 3. 代课字段

- `substitute_id`: 代课记录唯一标识
- `approval_id`: 关联的审批 ID
- `schedule_id`: 关联的排课 ID
- `original_teacher_id`: 原教师 ID
- `substitute_teacher_id`: 代课教师 ID
- `class_id`: 关联的班级 ID
- `course_id`: 关联的课程 ID
- `time_slot`: 代课时间段
- `status`: 状态（枚举值：待安排、已安排、已完成）
- `note`: 备注

## 4. 反馈工单字段（依赖 D 的反馈字段和 B 的家长异议字段）

- `ticket_id`: 工单唯一标识
- `feedback_id`: 关联的反馈 ID（来自 D）
- `parent_id`: 提出异议的家长 ID（来自 B）
- `student_id`: 关联学生 ID
- `issue`: 家长异议内容
- `status`: 工单状态（枚举值：待处理、处理中、已关闭）
- `handler_id`: 处理人（教务）ID
- `handling_result`: 处理结果
- `created_at`: 创建时间
- `closed_at`: 关闭时间（业务规则：填写处理结果后才能关闭）

## 5. 权限与数据范围

| 角色 | 数据范围 |
|---|---|
| 教务 | 所属校区 |
| 系统管理员 | 全部校区 |

## 6. 测试数据（交给 A）

- 校区：校区A（id: `c1`）、校区B（id: `c2`）。
- 班级：`c1` 下两个班（`class-101`、`class-102`），`c2` 下一个班（`class-201`）。
- 排课：每个班级至少一条排课记录，用于审批和代课演示。
