# D 教师端认证与权限交付记录

完成日期：2026-08-18

评审 PR：#14

合并提交：`3ce2f4f4176d7c6b2fea4ae153718a5cfbe71023`

## 已完成

- 接入 `POST /auth/login`、`GET /auth/me` 和 `POST /auth/logout`。
- Token 使用 `sessionStorage` 的 `k12AccessToken`。
- 只允许 `TEACHER` 和 `HOMEROOM_TEACHER` 进入教师端。
- 非教师角色登录后立即撤销服务端会话并清理本地 Token。
- 支持刷新恢复会话、过期会话清理和主动退出。
- 删除 `teacher_d`、手动角色切换、小写角色和 Mock 登录。
- 教师只查看本人授课课次。
- 班主任可查看负责班级，教学写操作仍要求本人授课。
- 使用公共 `ScheduleSummary`、`AttendanceRecord`、`Assignment`、`Submission`、`StudentFeedback` 和 `ScheduleChange`。
- 学生、课次、教师和业务记录使用数字 ID。
- 业务状态使用公共大写值，时间点使用带时区的 ISO 8601 字符串。
- 保留签到、作业、批改、反馈和调课入口。
- 完成登录、选择课次、提交调课、查看状态和退出流程。
- 业务数据继续使用 Mock，符合本次 D 任务范围；认证使用真实 API。

## PR #14 评审问题与修复

| 评审问题 | develop 修复 |
|---|---|
| 登录调用不存在的 `/teacher/login`，两个工具文件为空 | 改为可注入 `fetch` 的真实认证客户端 |
| 路由缺依赖、别名、页面和注册，导致 16 个类型错误 | 删除不可达路由，接入现有单页应用 |
| axios 被错误加入根包，锁文件产生无关变化 | 移除 axios 和无关锁记录，只保留教师测试依赖记录 |
| 缺角色、会话、范围和业务边界测试 | 新增认证、权限、签到和调课测试 |
| 缺 D 交付记录和 AI 记录 | 已补齐 |

## 测试结果

macOS：

```text
npm run test --workspace @k12/teacher-web
npm run typecheck --workspace @k12/teacher-web
npm run build --workspace @k12/teacher-web
npx eslint apps/teacher-web/src
npm run check
```

- 教师端测试：21/21 通过。
- 教师端类型检查、构建和 ESLint：通过。
- 根目录 `npm run check`：通过；全仓 137 项测试中 136 项通过、1 项因当前环境禁止监听端口而跳过。
- 浏览器：任课教师登录、调课、重复拦截、退出通过。
- 浏览器：班主任数据范围、只读课次和刷新恢复会话通过。
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

- A 继续保持三个认证接口、Bearer Token 和 `{ code, message }` 错误结构稳定。
- Windows 成员同步最新 `develop` 后运行上面的 PowerShell 命令并回报结果。
