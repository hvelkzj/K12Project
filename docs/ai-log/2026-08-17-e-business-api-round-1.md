# 2026-08-17 E 成员：后台接入业务 API

## 日期

2026-08-17。对应本轮任务 `docs/tasks/2026-08-17-round-1/05-E.md`。

## 目标

保留现有后台认证和八个页面，把调课审批、代课、反馈工单、用户和看板改为读取业务 API。开发时使用可注入的 Mock `fetch` 测试，不等待 A 的后端实现。

## 完整提示词

> 先阅读 AGENTS.md 和本轮任务文档 05-E.md。我是成员 E，只完成本模块任务，只修改 apps/admin-web 和本人交付记录。
> 保留认证和八个页面，把调课审批、代课、反馈工单、用户和看板改为读取业务 API。
> 复用现有认证客户端 Token，登录后加载 /admin/overview。
> 教务只展示所属校区，系统管理员展示全部校区。
> 审批成功后使用服务端返回值更新；拒绝必填原因；已审批不能重复；只有 APPROVED 可代课；代课教师同校区且非原教师。
> 工单 START 后 PROCESSING；CLOSE 前必填结果；已关闭不能再次处理。
> 工作台和看板从概览动态计算；增加加载中、空数据、失败和重试状态。
> 401 清理 Token 回登录；403/404/409/422 显示服务端错误不修改本地状态。
> 页面运行时不再读取业务 Mock；删除过期文案。
> 完成后运行测试，说明修改了什么、测试结果和还需谁配合。

## AI 回复摘要

- 新增 `adminApiClient.ts`：可注入 `fetch` 的后台业务客户端，复用 `ACCESS_TOKEN_KEY`。
- 新增 `adminTypes.ts`：`AdminOverview` 类型。
- 重构 `App.vue`：登录后加载概览，审批/代课/工单改为 PATCH 接口，新增加载/空/失败/重试状态，`401` 回登录。
- 删除 `mockData.ts`，删除“第一周演示”等文案，用户管理改为只读列表。
- `adminService.test.ts` 改为内联测试数据，不依赖 Mock。

## 人工判断

待 E 和组长审查后填写：

- [ ] 业务数据全部来自真实 API，认证与业务共用一套 Token。
- [ ] 教务/系统管理员数据范围由服务端 enforce，前端只做展示过滤。
- [ ] 失败操作（403/409/422/网络错误）不修改本地状态，不显示假成功。
- [ ] 公共字段不足时已在 PR 描述中提出，没有自行新增公共字段。

## 执行的修改

- `apps/admin-web/src/adminApiClient.ts`（新增）：业务客户端。
- `apps/admin-web/src/adminApiClient.test.ts`（新增）：客户端测试。
- `apps/admin-web/src/adminTypes.ts`（新增）：`AdminOverview`。
- `apps/admin-web/src/App.vue`：接入业务 API、状态处理、删除 Mock。
- `apps/admin-web/src/adminService.test.ts`：改为内联测试数据。
- `apps/admin-web/src/mockData.ts`（删除）：运行时不再读取业务 Mock。
- `apps/admin-web/src/style.css`：`mock-tag` 改名 `count-tag`，新增 loading/error 样式。
- `docs/member-e-business-api-round-1.md`（新增交付记录）。
- `docs/ai-log/2026-08-17-e-business-api-round-1.md`（本记录）。

## 测试结果

- `npm ci`：通过。
- `npm run test --workspace @k12/admin-web`：27 项通过、0 失败。
- `npm run typecheck --workspace @k12/admin-web`：通过。
- `npm run build --workspace @k12/admin-web`：通过。
- `npm run check`：通过；全仓 107 项测试 0 失败，五端 lint/typecheck/build 全通过。
- 真实 API 验证：教务/系统管理员 overview 范围正确；审批 200/403/409/422；代课 409/422/409；工单 200/422/409；无 Token 401、家长 403。

## 下一轮问题

1. A 确认 `overview.teachers` 是否作为代课教师数据源。
2. A 确认工单初始为空时的空数据展示。
3. B、D 联调家长异议和教师调课申请字段。
4. 建议发起 `feature/E-admin-api-round-1` → `develop` 的 PR。
