# 2026-08-21 E 成员：后台跨端联调与修复（第三轮）

## 日期

2026-08-21。对应第三轮任务 `docs/tasks/2026-08-20-follow-up/第三轮-跨端联调/05-E-任务.md`。

## 目标

在 A 的第二轮管理接口合并到 develop 后，验证五类跨端流程，并修复后台状态回写、统计和错误处理问题。只修改 `apps/admin-web` 和本人交付记录。

## 完整提示词

> E 成员第三轮任务：分支 fix/E-admin-cross-end-round-3。
> 审批教师调课并安排代课，确认家长端产生调课通知。
> 处理家长反馈异议工单。
> 审批家长请假并确认教师端可见。
> 创建和修改排课并确认教师端可见。
> 停用测试账号并确认会话失效。
> 修复后台状态回写、统计和错误处理问题。
> 不修改 API、公共类型或其他前端。
> 必须验证调课/工单/请假/排课/账号五类流程、数据范围、401/403/409/422/网络错误、根目录 npm run check。

## AI 回复摘要

- 启动真实 API 完成五类跨端流程验证，全部通过。
- 修复后台并发防护：四个操作函数改用 `runManagementAction`。
- 修复统计：工作台待审批含调课+请假，看板新增请假待审，统计基于可见数据范围。
- 新增 `adminStatistics.ts` 纯函数与测试。
- `types.ts` 补充 `LeaveRequest` 导出。

## 人工判断

待 E 和组长审查后填写：

- [ ] 五类跨端流程在真实 API 上验证通过。
- [ ] 数据范围（教务单校区/系统管理员全校区）与错误码行为正确。
- [ ] 后台并发操作有防重复保护，失败不修改本地状态。
- [ ] 统计包含调课和请假，且基于可见数据范围。

## 执行的修改

- `apps/admin-web/src/App.vue`：并发防护、统计修正、scopedLeaveRequests。
- `apps/admin-web/src/adminStatistics.ts`（新增）：统计纯函数。
- `apps/admin-web/src/adminStatistics.test.ts`（新增）：统计测试。
- `apps/admin-web/src/types.ts`：补充 `LeaveRequest` 导出。
- `docs/member-e-cross-end-round-3.md`（交付记录）。
- `docs/ai-log/2026-08-21-e-cross-end-round-3.md`（本记录）。

## 测试结果

- `npm run test --workspace @k12/admin-web`：49 项通过、0 失败。
- `npm run typecheck --workspace @k12/admin-web`：通过。
- `npm run build --workspace @k12/admin-web`：通过。
- 根目录 `npm run check`：通过；全仓 224 项测试 0 失败，五端 lint/typecheck/build 全通过。
- 真实 API 五类流程、数据范围、401/403/409/422 全部验证通过。

## 下一轮问题

1. 家长端调课通知的展示样式与其他端联调是否符合预期。
2. 教师端请假可见性与班主任/任课教师数据范围是否一致。
3. 建议发起 `fix/E-admin-cross-end-round-3` → `develop` 的 PR。
