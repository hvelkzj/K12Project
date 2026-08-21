# 2026-08-20 E 成员：后台管理功能（第二轮）

## 日期

2026-08-20。对应第二轮任务 `docs/tasks/2026-08-20-follow-up/第二轮-剩余业务功能/05-E-任务.md`。

## 目标

在保留后台认证和第一轮业务 API 基础上，为审批页增加请假审批、排课页支持新增/修改/取消课次、用户页支持账号启停。只修改 `apps/admin-web` 和本人交付记录。

## 完整提示词

> E 成员第二轮任务：分支 feature/E-admin-management-round-2。
> 审批页增加请假审批区域，支持通过和拒绝，拒绝必填原因。
> 排课页支持新增课次，支持修改时间/教室/教师，支持取消课次，排课失败保留表单内容。
> 用户页支持账号启停，入口只对系统管理员显示。
> 教务只能管理所属校区的请假和排课，系统管理员可查看全部校区。
> 成功后用服务端响应更新页面，失败不修改本地状态。
> 增加加载中、空数据、冲突和重试状态。
> 提交前运行 test/typecheck/build/check。

## AI 回复摘要

- 扩展 `adminTypes.ts`：overview 增加 `leaveRequests`，新增排课创建/更新输入类型。
- 扩展 `adminApiClient.ts`：新增请假审批、排课新增/修改/取消、账号启停方法。
- 新增 `adminManagementRules.ts` 及测试：排课时间校验、必填文本校验、禁止停用当前管理员、账号启停权限。
- 重构 `App.vue`：审批页增加请假审批区，排课页增加新增/编辑/取消表单，用户页增加启停按钮。
- 教务排课表单校区下拉禁用，班级/课程/教师按校区过滤；请假按所属校区过滤。

## 人工判断

待 E 和组长审查后填写：

- [ ] 请假审批、排课管理和账号启停的接口路径与 A 第二轮契约一致。
- [ ] 教务校区限制由服务端 enforce，前端只做表单和展示过滤。
- [ ] 排课失败保留表单，成功后用服务端响应更新，失败不改本地状态。
- [ ] 禁止停用当前系统管理员的前端预校验与服务端校验一致。

## 执行的修改

- `apps/admin-web/src/adminTypes.ts`：`AdminOverview` 增加 `leaveRequests`；新增 `CreateScheduleInput`、`UpdateScheduleInput`。
- `apps/admin-web/src/adminApiClient.ts`：新增 `reviewLeaveRequest`、`createSchedule`、`updateSchedule`、`updateUser`。
- `apps/admin-web/src/adminApiClient.test.ts`：新增对应接口测试。
- `apps/admin-web/src/adminManagementRules.ts`（新增）：领域校验规则。
- `apps/admin-web/src/adminManagementRules.test.ts`（新增）：规则测试。
- `apps/admin-web/src/App.vue`：审批/排课/用户页面功能。
- `apps/admin-web/src/style.css`：排课表单和操作按钮样式。
- `docs/member-e-management-round-2.md`（交付记录）。
- `docs/ai-log/2026-08-20-e-management-round-2.md`（本记录）。

## 测试结果

- `npm run test --workspace @k12/admin-web`：41 项通过、0 失败。
- `npm run typecheck --workspace @k12/admin-web`：通过。
- `npm run build --workspace @k12/admin-web`：通过。
- `npm run check`：通过；全仓 199 项测试 0 失败，五端 lint/typecheck/build 全通过。

## 下一轮问题

1. A 的第二轮管理接口尚未合并到 `develop`，需发布并合并后再真实联调。
2. A 确认 `GET /admin/overview` 的 `leaveRequests` 返回结构和排课新增/修改接口的输入校验。
3. 排课冲突（教师时间、教室冲突）由服务端 `409` 处理，前端展示服务端错误。
4. 建议发起 `feature/E-admin-management-round-2` → `develop` 的 PR。
