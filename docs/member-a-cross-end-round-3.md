# A 第三轮跨端联调交付记录

完成日期：2026-08-21

分支：`feature/A-cross-end-round-3`

## 已完成

| 流程 | 验证结果 |
|---|---|
| D 发布作业 → C 提交 → D 批改 → C 查看结果 | 通过 |
| D 要求订正 → C 再次提交 → 保留 attempt 历史 | 通过 |
| D 调课 → E 审批和代课 → B 查看并读取通知 | 通过 |
| D 发送反馈 → B 提出异议 → E 处理工单 | 通过 |
| B 提交请假 → E 审批 → D 登记 `LEAVE` | 通过 |
| E 新增和修改排课 → D 教师概览更新 | 通过 |
| E 停用账号 → 会话失效且禁止重新登录 | 通过 |

- 新增七条独立的 API 请求处理器集成测试。
- 每条流程都创建独立认证服务和内存业务仓库。
- 所有服务端时间都使用注入的固定时钟。
- 覆盖错误角色、未绑定学生、跨校区、重复提交、重复审批、重复批改、重复工单操作和资源冲突。
- 验证失败操作不会阻断后续合法操作。

## 公共影响

- 没有新增业务接口。
- 没有新增或修改公共字段、角色、状态和共享类型。
- 没有修改 API 契约。
- 没有修改四个前端、数据库迁移、依赖和根锁文件。

## 验证

macOS：

```text
npm ci
npm run test --workspace @k12/api
npm run typecheck --workspace @k12/api
npm run build --workspace @k12/api
npx eslint apps/api/test/crossEnd.integration.test.ts
npm run check
npm run dev:api
```

- 根锁文件安装：通过。
- API 测试：44 项通过。
- API 类型检查、构建和定向 ESLint：通过。
- 根目录 `npm run check`：通过；全仓 220 项测试通过。
- `npm run dev:api`：启动通过，`GET /health` 返回 `200` 和健康状态。

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

- Windows 最终版本已执行上述 PowerShell 命令并通过，详见 `docs/windows-test-2026-08-24.md`。
- B、C、D、E 可以继续使用现有公共接口和字段，不需要为本轮测试调整前端契约。
