# ABCDE 字段联合决议

日期：2026-08-07。

本记录模拟 A、B、C、D、E 按各自职责完成联合评审。它用于代替本轮逐人等待确认，不表示五位真实成员已经逐条回复。用户已授权本轮直接作出统一决定。

## 各成员评审立场

| 成员 | 评审重点 | 本轮意见 |
|---|---|---|
| A | 数据库、权限、公共契约 | 同一含义只保留一个公共字段；数据库负责关联和约束 |
| B | 家长端、通知 | 接口应直接提供学生上下文和可展示的调课结果 |
| C | 学生端、作业 | 作业、提交、附件和批改结果必须能完整表达订正历史 |
| D | 教师/班主任端 | 发布、签到、反馈和调课字段需能直接写入公共流程 |
| E | 教务/系统后台 | 审批、代课、工单和校区权限必须避免重复处理和跨校区访问 |

## 问题 1：字段命名不一致

- B、D：页面和 TypeScript 已使用 camelCase，继续使用成本最低。
- C、E：接受 API 使用 camelCase；原 snake_case 提案只映射到数据库。
- A 最终决定：API、TypeScript、JSON 使用 camelCase；PostgreSQL 使用 snake_case。文档分别写清两层名称，不在同一层混用。

回答：已统一，不再保留两套 API 字段。

## 问题 2：ID 类型不一致

- B：绑定学生和通知只要求 ID 能稳定比较。
- C、D：作业、签到和调课需要统一关联类型。
- E：原测试数据 `c1`、`class-101` 只是临时标签，可以改为数字 ID。
- A 最终决定：数据库使用 `SERIAL` 整数主键；API 使用 `number`。测试数据通过名称查找或使用数据库生成的数字 ID，不把 `c1` 等字符串作为公共 ID。

回答：公共 ID 统一为数字。

## 问题 3：日期和时间格式不一致

- B：调课通知需要稳定显示原时间和新时间。
- C、D：截止时间、提交时间和批改时间需要可比较的时间点。
- E：排课冲突需要按校区本地日期和课次时间判断。
- A 最终决定：时间点在数据库使用 `TIMESTAMPTZ`，API 返回带时区的 ISO 8601 字符串；课次使用 `DATE + TIME + TIME`，API 分别返回 `YYYY-MM-DD`、`HH:mm:ss`、`HH:mm:ss`。校区保存 IANA 时区，默认 `Asia/Shanghai`。

回答：时间传输格式和课次存储方式已统一，避免 macOS 与 Windows 本地解析差异。

## 问题 4：C、D 的作业字段冲突

- C：保留 `description`、附件、截止时间和学生可读的发布教师。
- D：补充 `classId`、可选 `scheduleId`、迟交规则和发布时间。
- A 最终决定：统一为 `id`、`campusId`、`classId`、`courseId`、`scheduleId`、`teacherId`、`title`、`description`、`attachments`、`dueAt`、`allowLate`、`publishedAt`、`createdAt`、`updatedAt`。
- `content` 统一改为 `description`；`publishedBy` 和 `teacher_id` 统一改为 `teacherId`；`deadline` 统一改为 `dueAt`。

回答：C、D 使用同一套作业字段，发布范围和迟交规则已补齐。

## 问题 5：批改、附件和订正字段冲突

- C：需要提交正文、附件、状态、成绩和教师评语。
- D：需要批改人、批改时间和是否订正。
- A 最终决定：分数统一为 `score`，范围 0–100；评语统一为 `teacherComment`；批改人和时间使用 `gradedBy`、`gradedAt`。
- `NOT_SUBMITTED` 只表示“没有提交记录”的页面状态，不写入数据库。
- `correctionRequired` 由提交状态 `REVISION_REQUIRED` 推导，不重复存储。
- 每次订正生成新的 `attempt`，旧提交保留。附件使用 `StoredFile` 加作业/提交关联表，API 返回数组。

回答：批改字段、附件结构和订正历史已统一。

## 问题 6：调课、审批和代课是否拆表

- D：希望从原排课发起，不重复录入课程和班级。
- E：希望审批和代课有明确处理字段，但第一版不需要多轮审批。
- B：需要调课前后时间和代课教师姓名。
- A 最终决定：第一版使用一张 `schedule_changes` 流程表。它关联原 `scheduleId`，保存原时间快照、新日期/时间、审批结果和代课教师。课程、班级从排课读取，不重复保存。
- B 的通知展示模型由调课记录、排课和教师信息组合生成；通知表只保存接收人、类型、标题、内容和关联记录。

回答：不建立独立审批表和代课表，避免同一流程重复字段不一致。

## 问题 7：家长异议内容由谁保存

- B：提出异议时增加必填文本。
- D：教师反馈原文必须保留，不能被家长回复覆盖。
- E：工单需要显示异议内容，但不应再复制一份。
- A 最终决定：异议内容唯一保存为反馈记录的 `parentResponse`，并记录 `respondedBy`、`respondedAt`。E 的工单响应可把它显示为 `issue`，数据库不重复保存 `issue`。

回答：家长异议使用 `parentResponse` 作为唯一来源；提出异议时不能为空。

## 问题 8：反馈状态和工单状态混用

- B、D：反馈只关心待家长处理、已确认、已异议。
- E：工单只关心待处理、处理中、已关闭。
- A 最终决定：反馈状态为 `PENDING_PARENT / CONFIRMED / DISPUTED`；工单状态为 `OPEN / PROCESSING / CLOSED`。两者分别维护，通过 `feedbackId` 一对一关联。工单关闭时必须有处理结果和关闭时间。

回答：反馈与工单使用两个枚举，不再互相覆盖。

## 问题 9：公共枚举和契约由谁确认

- B、C、D、E：接受本记录中的公共字段，通过各自页面模型映射，不再新增同义公共字段。
- A：把决议写入字段契约和数据库迁移，并添加结构测试。
- 最终决定：本轮联合决议作为 7/28 开发基线。后续若修改角色、状态、数据库或 API，需要按 `AGENTS.md` 由组长审核后合并。

回答：本轮问题已全部关闭，没有阻塞 7/28 数据库汇总的问题。

## 其他字段结论

| 范围 | 结论 |
|---|---|
| 请假 | `DRAFT` 仅是 B 的本地表单状态；公共状态为 `PENDING / APPROVED / REJECTED` |
| 签到 | 使用 `status / note / recordedBy / recordedAt`，状态为 `PRESENT / LATE / ABSENT / LEAVE` |
| 通知 | 类型为 `SCHEDULE_CHANGE / FEEDBACK / GENERAL`；是否已读由 `readAt` 是否为空推导 |
| 家长学生摘要 | 姓名、班级名和校区名是查询结果；权限关联使用 `studentId / classId / campusId` |
| 测试数据 | 两个校区、三个班级继续保留，但 ID 改由数据库生成；名称用于识别 |
| 权限 | 家长按绑定、学生按本人、教师按授课班级、班主任按负责班级、教务按校区、系统管理员按全机构 |

最终字段见 `docs/api-field-contract.md`，数据库结构见 `docs/data-model.md` 和 `apps/api/db/migrations/001_initial.sql`。
