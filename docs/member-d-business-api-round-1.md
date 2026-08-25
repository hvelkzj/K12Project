# D 教师端业务 API 接入交付记录

完成日期：2026-08-20

分支：`feature/D-teacher-api-round-1`

评审 PR：#15

合并提交：`160109e17df6b2d447ad65a4ef78d310a7e9c927`

## PR 评审结论

- PR 原提交只有一处 API 地址修改，未完成本轮业务 API 接入。
- `import.meta.env.VITE_API_BASE_URL` 在 Node 测试环境中直接求值，导致教师端测试在导入阶段崩溃。
- 已在 GitHub 提交问题评审，并按组长要求批准和合并。
- 评论评审：`4979623742`。
- 批准评审：`4979625434`。
- 上述问题均在合并后的 `develop` 修复。

## 已完成

- 恢复安全的默认 API 地址，同时支持 `VITE_API_BASE_URL`。
- 保留真实登录、当前用户、会话恢复、退出和教师角色限制。
- 新增可注入 `fetch` 的教师业务客户端。
- 接入 `GET /teacher/overview`。
- 接入 `PUT /teacher/attendance`。
- 接入 `POST /teacher/assignments`。
- 接入 `PATCH /teacher/submissions/:submissionId`。
- 接入 `POST /teacher/feedback`。
- 接入 `POST /teacher/schedule-changes`。
- 页面数据改为服务端教师概览，不再读取运行时业务 Mock。
- 签到、发布、批改、反馈和调课均等待接口成功后再更新页面。
- 失败操作保留用户输入，不显示假成功。
- `401` 清理 Token 并返回登录页。
- `403`、`404`、`409`、`422` 显示服务端业务错误。
- 增加初次加载、刷新、空数据、网络错误和重试状态。
- 任课教师只操作本人课次；班主任可查看负责班级，但其他教师课次的操作按钮不可用。

## 测试结果

macOS：

```text
npm run test --workspace @k12/teacher-web
npm run typecheck --workspace @k12/teacher-web
npm run build --workspace @k12/teacher-web
npx eslint apps/teacher-web/src
npm run check
```

- 教师端测试：38/38 通过。
- 教师端类型检查、构建和定向 ESLint：通过。
- 根目录 `npm run check`：通过；全仓 154 项测试中 153 项通过，1 项因当前环境禁止监听回环端口而跳过。
- 真实 API 浏览器回归：任课教师登录、签到、发布作业、批改为 `REVISION_REQUIRED` 通过。
- 真实 API 浏览器回归：重复反馈和重复调课返回 `409`，表单内容保留。
- 真实 API 浏览器回归：班主任可见 4 个课次、仅 2 个本人课次可操作，会话刷新恢复通过。
- 浏览器控制台：0 个错误、0 个警告。

Windows PowerShell 复核命令：

```text
npm.cmd ci
npm.cmd run test --workspace @k12/teacher-web
npm.cmd run typecheck --workspace @k12/teacher-web
npm.cmd run build --workspace @k12/teacher-web
npm.cmd run check
npm.cmd run dev:api
npm.cmd run dev:teacher
```

## 需要配合

- Windows 成员同步最新 `develop`，执行上述 PowerShell 命令并回报结果。
- A 后续保持教师端 6 个业务接口、Bearer Token 和 `{ code, message }` 错误结构稳定。
- C 后续使用学生接口确认教师批改结果和订正状态可以同步读取。
- E 后续使用后台接口确认教师调课申请可以正常审批和安排代课。

