# 2026-08-21 E 成员：后台最终收口（第四轮）

## 日期

2026-08-21。对应第四轮任务 `docs/tasks/2026-08-20-follow-up/第四轮-最终收口/05-E-任务.md`。

## 目标

回归后台各功能页，检查权限、加载/空数据/错误/重试状态，删除调试输出和过期文案，只修复后台问题并补齐最终边界测试，在 Windows PowerShell 完成全仓验证。

## 完整提示词

> E 成员第四轮任务：分支 fix/E-admin-final-round-4。
> 回归工作台、排课、请假审批、调课、代课、工单、账号和看板。
> 检查教务和系统管理员权限。
> 检查加载中、空数据、401、403、409、422、网络错误和重试。
> 删除调试输出和过期文案。
> 只修复后台问题，补齐最终边界测试。
> 在 Windows PowerShell 完成全仓验证：npm.cmd ci、npm.cmd run check、npm.cmd run dev，确认 API 和四个前端均能启动，并在 PR 中记录 Windows 结果。

## AI 回复摘要

- 审查未发现调试输出和过期文案残留（仅测试脚手架 `createFetchMock` 与正式种子密码 `K12Demo123!`）。
- 修复 5 个后台问题：排课表单校区级联重置、排课增改并发防护、调课审批状态前置校验、工单开始空选提示、401 处理串行化。
- 补齐边界测试：422、写接口网络错误、账号启停 403、工单重复关闭、请假审批状态组合。
- Windows 全仓验证通过。

## 人工判断

待 E 和组长审查后填写：

- [ ] 五个后台修复问题均验证有效，无回归。
- [ ] 边界测试覆盖 401/403/404/409/422/网络错误。
- [ ] Windows `npm.cmd dev` 五个服务均可启动。
- [ ] 无调试输出和过期文案残留。

## 执行的修改

- `apps/admin-web/src/App.vue`：校区级联重置、并发防护、状态前置校验、空选提示、401 串行化。
- `apps/admin-web/src/adminApiClient.test.ts`：422、写接口网络错误、账号启停 403 测试。
- `apps/admin-web/src/adminService.test.ts`：工单重复关闭/重新处理测试。
- `apps/admin-web/src/adminManagementRules.test.ts`：请假审批状态组合测试。
- `docs/member-e-final-round-4.md`（交付记录）。
- `docs/ai-log/2026-08-21-e-final-round-4.md`（本记录）。

## 测试结果

- `npm run test --workspace @k12/admin-web`：56 项通过、0 失败。
- `npm run typecheck --workspace @k12/admin-web`：通过。
- `npm run build --workspace @k12/admin-web`：通过。
- 根目录 `npm run check`：通过；全仓 244 项测试 0 失败，五端 lint/typecheck/build 全通过。
- Windows `npm.cmd ci` / `npm.cmd run check` / `npm.cmd run dev`：全部通过；API `/health` 200，四个前端 200。
- 真实 API 回归：教务 1 校区、系统管理员 2 校区；401/403/404/409/422 全部正确。

## 下一轮问题

1. 排课表单校区切换在编辑模式下不重置（身份字段锁定），确认与产品预期一致。
2. 建议发起 `fix/E-admin-final-round-4` → `develop` 的 PR。
