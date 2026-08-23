# E 成员：后台最终收口交付记录（第四轮）

完成日期：2026-08-21

分支：`fix/E-admin-final-round-4`

## 回归验证（真实 API）

- 工作台/排课/请假审批/调课/代课/工单/账号/看板：教务与系统管理员 overview 数据范围正确。
  - 教务：1 校区（4 排课、1 调课）。
  - 系统管理员：2 校区（5 排课、2 调课）。
- 权限：
  - 无 Token → 401。
  - 教务跨校区审批 → 403。
  - 教务启停账号 → 403（仅系统管理员）。
  - 停用当前系统管理员 → 422。
- 错误码：401/403/404/409/422 全部正确；重复审批 409、拒绝空原因 422。

## 修复问题

1. **排课表单校区切换未重置班级/课程/教师**：新增 watch，创建模式切换校区时重置班级/课程/教师选择；编辑模式（身份字段锁定）不重置。
2. **排课新增/编辑未纳入并发防护**：`submitScheduleForm` 改用统一的 `runManagementAction`，避免与"取消课次"等操作并发。
3. **调课审批缺状态前置校验**：`submitReview` 增加 `status !== 'PENDING'` 校验，与请假审批一致。
4. **工单开始处理空选静默返回**：`beginSelectedWorkOrder` 增加空选提示和 `OPEN` 状态校验。
5. **401 处理串行化**：`handleUnauthorized` 改为 `return` 等待清理流程完成。

## 补齐边界测试

- `adminApiClient.test.ts`：新增 422 校验错误、请假审批/排课创建/工单关闭的网络错误、账号启停 403。
- `adminService.test.ts`：新增已关闭工单不能再次关闭、不能重新开始处理。
- `adminManagementRules.test.ts`：新增拒绝请假原因必填与已审批请假不可重复处理组合用例。

## Windows 验证

- `npm.cmd ci`：通过。
- `npm.cmd run check`：通过；全仓 244 项测试 0 失败，五端 lint/typecheck/build 全通过。
- `npm.cmd run dev`：API 3000 `/health` 200；四个前端 5173/5174/5175/5176 均返回 HTTP 200。

## 说明

- 未修改 API、公共类型或其他前端。
- 仅修改 `apps/admin-web` 和本人交付记录。
