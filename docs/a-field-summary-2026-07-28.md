# A 成员 7/28 字段清单汇总

任务日期：2026-07-28。完成日期：2026-08-07。

## 完成结论

B、C、D、E 提交的 15 个字段组、131 行字段提案已汇总。原有 9 个跨端问题已经完成联合裁决，结果已落入公共字段契约和 PostgreSQL 初始迁移。

本次没有修改 B、C、D、E 的页面模块。后续成员应使用公共契约，不再创建同义字段或另一套状态值。

## 汇总来源

| 成员 | 实际分支 | 提交 | 字段清单 |
|---|---|---|---|
| B | `origin/feature/B-parent` | `4fd4a2c` | `docs/member-b-week-1.md` |
| C | `origin/feature/C-assignment` | `0806982` | `docs/C-assignment-fields.md` |
| D | `origin/feature/D-teacher` | `d0bd21f` | `docs/member-d-pages-and-fields.md` |
| E | `origin/feature/e-admin-web` | `34281bd` | `docs/E-admin-fields.md` |

请求中的 `D-parent` 分支不存在。根据项目分工，D 负责教师/班主任端，因此读取 `feature/D-teacher`。

## 数量统计

统计规则：每个字段表格行或字段列表项计 1 次；同名字段出现在不同实体时分别计数。

| 成员 | 字段组 | 字段行数 | 主题 |
|---|---:|---:|---|
| B | 4 | 33 | 绑定、请假、通知、反馈确认与异议 |
| C | 2 | 17 | 作业、提交与批改结果 |
| D | 6 | 51 | 公共关联、签到、作业、批改、反馈、调课 |
| E | 3 | 30 | 审批、代课、反馈工单；另含权限和测试数据 |
| 合计 | 15 | 131 | 第一周要求的主题全部覆盖 |

D 的 51 行包括 9 个公共关联字段。排除这些关联字段后，共有 122 行实体字段提案。

## 每个问题的最终回答

| 编号 | 问题 | 最终回答 |
|---|---|---|
| 1 | camelCase 与 snake_case 混用 | API、JSON、TypeScript 使用 camelCase；PostgreSQL 使用 snake_case |
| 2 | 数字 ID 与字符串 ID 混用 | 公共 ID 使用数字；`c1` 等字符串测试 ID 停用 |
| 3 | 时间格式不统一 | 时间点使用 ISO 8601；课次使用日期、开始时间、结束时间三个字段 |
| 4 | C/D 作业字段冲突 | 使用 `description`、`teacherId`、`dueAt`、`allowLate` 和附件数组 |
| 5 | 批改、附件和订正冲突 | 使用 `score`、`teacherComment`、`gradedBy`、`gradedAt`；订正使用 `attempt`；附件使用公共文件结构 |
| 6 | 调课、审批、代课是否拆分 | 使用一条 `schedule_changes` 流程记录，不另建审批和代课表 |
| 7 | 家长异议缺少唯一来源 | 异议内容唯一保存为 `parentResponse`；工单 `issue` 由它读取 |
| 8 | 反馈与工单状态混用 | 反馈使用三态，工单使用三态，两套枚举分开维护 |
| 9 | 公共字段由谁确认 | 本轮 ABCDE 联合决议成为 7/28 基线；之后公共变更仍需组长审核 |

完整讨论和理由见 `docs/abcde-field-decisions-2026-08-07.md`。

## 7/28 A 的数据库交付

| 交付 | 位置 | 结果 |
|---|---|---|
| 公共字段契约 | `docs/api-field-contract.md` | 已确定名称、类型、状态和数据范围 |
| 数据模型 | `docs/data-model.md` | 已说明基础表、业务表和关联关系 |
| PostgreSQL 初始迁移 | `apps/api/db/migrations/001_initial.sql` | 覆盖账号、权限关联、排课及四端业务数据 |
| 迁移结构测试 | `apps/api/test/schema.test.ts` | 校验表、状态、附件、订正、调课和工单约束 |

数据库共包含 23 张表：9 张基础数据表、13 张业务数据及关联表、1 张审计表。

## 交给 B/C/D/E

| 成员 | 直接使用 |
|---|---|
| B | `StudentSummary`、`LeaveRequest`、`Notification`、`ScheduleChangeNotice`、`StudentFeedback` |
| C | `FileSummary`、`Assignment`、`Submission` |
| D | `ScheduleSummary`、`AttendanceRecord`、`Assignment`、`Submission`、`StudentFeedback`、`ScheduleChange` |
| E | `ScheduleChange`、`FeedbackWorkOrder` 和公共数据范围规则 |

## 下一步

7/28 数据库汇总已完成。A 的 7/29 公共 TypeScript 包、六角色测试账号和认证 API 已通过 PR #4 合并；四个前端的共享包依赖由 A 统一登记，B/C/D/E 后续各自在本人模块中完成接入。

文档和测试仅使用仓库相对路径及跨平台 npm 命令，兼容 macOS 终端和 Windows PowerShell。
