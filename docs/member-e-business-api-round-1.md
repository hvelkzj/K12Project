# E 成员：后台接入业务 API 交付记录

完成日期：2026-08-17

分支：`feature/E-admin-api-round-1`

## 已交付

- 新增可注入 `fetch` 的后台业务客户端 `adminApiClient.ts`。
- 复用现有认证客户端的 `k12AccessToken`，不复制第二套 Token 管理。
- 接入四个后台业务接口：

| 方法与路径 | 用途 |
|---|---|
| `GET /admin/overview` | 登录后加载后台可见数据 |
| `PATCH /admin/schedule-changes/:changeId/review` | 审批调课 |
| `PATCH /admin/schedule-changes/:changeId/substitute` | 安排代课 |
| `PATCH /admin/work-orders/:workOrderId` | 开始或关闭反馈工单 |

- 工作台与看板数据从后台概览动态计算，不再使用写死的 Mock 数据。
- 增加加载中、空数据、请求失败和重试状态。
- `401` 清理 Token 并回到登录页；`403`、`404`、`409`、`422` 显示服务端业务错误，不修改本地状态。
- 删除运行时业务 Mock（`mockData.ts`），删除“第一周演示”等过期文案。
- 用户管理页改为只读概览列表（本轮无用户启停接口）。

## 权限结果

| 角色 | 后端范围 | 前端表现 |
|---|---|---|
| 教务 `ACADEMIC_ADMIN` | 所属校区 | overview 仅返回所属校区数据 |
| 系统管理员 `SYSTEM_ADMIN` | 全部校区 | overview 返回全部校区数据 |

## 审批与工单边界

- 拒绝调课时必须填写原因（前端预校验 + 服务端 422）。
- 已审批申请不能重复审批（服务端 409）。
- 只有 `APPROVED` 申请可以安排代课（服务端 409）。
- 代课教师必须同校区且不能是原教师（前端预校验 + 服务端 422）。
- 工单 `START` 成功后显示 `PROCESSING`。
- 工单 `CLOSE` 前必须填写处理结果（前端预校验 + 服务端 422）。
- 已关闭工单不能再次处理（服务端 409）。
- 审批、代课、工单成功后使用服务端返回值更新本地状态；失败时本地状态不变。

## 测试结果

- `npm ci`：通过。
- `npm run test --workspace @k12/admin-web`：27 项通过、0 失败。
- `npm run typecheck --workspace @k12/admin-web`：通过。
- `npm run build --workspace @k12/admin-web`：通过。
- `npm run check`：通过；全仓 107 项测试、0 失败，lint、五端类型检查和构建均成功。

## 真实 API 验证

- 教务 overview：1 个校区、4 条排课、1 条调课申请。
- 系统管理员 overview：2 个校区、5 条排课、2 条调课申请。
- 审批通过 200、跨校区 403、重复 409、拒绝原因空 422。
- 代课冲突 409（教师时间冲突）、跨校区教师 422、未通过申请代课 409。
- 无 Token 401、家长访问后台 403。
- 工单 START 200（PROCESSING）、关闭结果空 422、关闭 200（CLOSED）、重复关闭 409。

## 仍待 A、B、D 配合

- A：确认 `GET /admin/overview` 返回的 `teachers` 字段是否用于代课教师下拉（当前使用 overview.teachers）。
- A：确认工单列表初始可能为空（家长异议才会生成工单），空数据状态是否满足演示预期。
- B：家长异议产生的工单内容与后台展示是否对齐。
- D：调课申请字段（原时间、拟调整时间）与教师端提交内容是否一致。
