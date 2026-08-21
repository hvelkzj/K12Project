# A 第二轮管理 API 交付记录

完成日期：2026-08-20；PR 恢复和评审修复：2026-08-21

分支：`feature/A-management-api-round-2`

## 已完成

- 实现 `PATCH /parent/notifications/:notificationId/read`。
- 教师和后台 overview 增加 `leaveRequests`。
- 实现 `PATCH /admin/leave-requests/:leaveRequestId/review`。
- 实现 `POST /admin/schedules` 新增排课。
- 实现 `PATCH /admin/schedules/:scheduleId` 修改和取消排课。
- 实现 `PATCH /admin/users/:userId` 账号启停。
- 通知只允许对应家长标记，只接受 `read: true`；重复标记不会覆盖原 `readAt`。
- 教务只能审批和维护所属校区，系统管理员可以操作全部校区。
- 请假审批校验重复审批和拒绝原因。
- 排课校验校区归属、时间先后、教师冲突、班级冲突和取消状态。
- 已有课次的校区、班级和课程身份字段不能修改。
- 账号启停仅允许系统管理员，当前系统管理员不能停用自己。
- 停用账号立即撤销全部会话并阻止再次登录；重新启用后恢复登录。
- 所有新增业务测试均创建独立内存仓库并注入固定时钟。

## 公共影响

- 更新 `docs/api-field-contract.md`，加入第二轮管理接口和 overview 字段。
- 没有新增公共字段，也没有修改 `packages/shared`。
- 没有修改四个前端和根锁文件。
- 认证服务新增内部账号状态同步能力；现有登录响应和 Token 格式不变。

## PR #16 恢复和评审修复

- PR #16 被误关后恢复为可评审状态，并基于当时最新 `develop` 完成无冲突合并模拟。
- 评审记录了排课取消路由、通知请求体、课次身份字段和文档空行四项问题。
- 当前登录账号是 PR 作者，GitHub 禁止作者批准自己的 PR；评审正文已明确同意合并。
- PR #16 已合并到 `develop`，合并提交为 `e9c6110`。
- 合并后把排课取消统一为 E 客户端使用的 `PATCH /admin/schedules/:scheduleId` 和 `status: 'CANCELLED'`。
- 合并后补齐通知 `read: true` 校验、不可修改字段校验和对应回归测试。

## 测试结果

macOS：

```text
npm run test --workspace @k12/api
npm run typecheck --workspace @k12/api
npm run build --workspace @k12/api
npx eslint apps/api/src apps/api/test
npm run check
```

- API：36 项测试中 35 项通过，1 项因当前沙箱禁止监听回环端口而跳过。
- API 类型检查、构建和定向 ESLint：通过。
- 根目录 `npm run check`：通过。
- 修复后全仓：208 项测试中 207 项通过，1 项跳过。
- PR 合并前真实 HTTP 冒烟验证通过：通知 `200`、请假创建 `201`、教师读取请假、请假审批 `200`。
- PR 合并前真实 HTTP 冒烟验证通过：排课创建 `201`、修改为 `CHANGED`、取消为 `CANCELLED`。
- PR 合并前真实 HTTP 冒烟验证通过：停用后原会话 `401`，重新启用后登录 `200`。

Windows PowerShell 复核命令：

```text
npm.cmd ci
npm.cmd run test --workspace @k12/api
npm.cmd run typecheck --workspace @k12/api
npm.cmd run build --workspace @k12/api
npm.cmd run check
npm.cmd run dev:api
```

## 需要配合

- Windows 成员需要基于修复后的最新 `develop` 重新执行本节 PowerShell 命令。
- B 接入通知已读时必须发送 `{ "read": true }`。
- E 已按统一 PATCH 路由发送 `status: 'CANCELLED'`，无需修改前端接口。
