# A 成员 7/29 公共类型与登录交付

任务日期：2026-07-29。初次完成日期：2026-08-07。前端依赖接入日期：2026-08-12。

## 完成结论

A 的公共包、六角色 Mock 账号和认证 API 已通过 PR #4 合并到 `develop`。本轮在 `feature/A-shared-integration` 为四个前端登记精确共享包依赖，没有修改 B、C、D、E 的业务页面。

| 交付 | 位置 | 结果 |
|---|---|---|
| 公共包 | `packages/shared` | 包名为 `@k12/shared`，编译后供 API 和前端导入 |
| 角色与状态 | `packages/shared/src/constants.ts` | 六种角色、八组持久化状态和通知类型 |
| 公共接口类型 | `packages/shared/src/types.ts` | 公共摘要、四端业务对象和认证响应 |
| 六角色账号 | `@k12/shared/mock-accounts` | 六个唯一用户名、数字 ID 和统一测试密码 |
| 四端依赖 | 四个前端 `package.json` | 均使用精确版本 `@k12/shared@0.1.0` |
| 登录 API | `POST /auth/login` | 校验账号密码并创建八小时 Mock 会话 |
| 当前用户 API | `GET /auth/me` | 使用 Bearer 令牌返回当前用户 |
| 退出 API | `POST /auth/logout` | 删除当前会话，成功返回 204 |

## 公共包用法

业务类型和状态从主入口导入：

```ts
import {
  SUBMISSION_STATUSES,
  type Submission,
  type UserSummary,
} from '@k12/shared'
```

测试账号只从独立 Mock 入口导入：

```ts
import { MOCK_ACCOUNTS } from '@k12/shared/mock-accounts'
```

`NOT_SUBMITTED` 和 `DRAFT` 仍是页面派生状态，不进入公共持久化状态。

## 前端接入约定

| 项目 | 统一约定 |
|---|---|
| API 地址 | 从 `VITE_API_BASE_URL` 读取，默认值为 `http://127.0.0.1:3000` |
| Token 存储 | 使用 `sessionStorage` |
| Token 键名 | `k12AccessToken` |
| 会话失效 | 收到 401 时清除 Token 并返回登录页 |
| 主动退出 | 调用 `/auth/logout` 后清除 Token |
| 业务数据 | 本轮仍可使用各端 Mock；认证使用真实 API |

## 六角色 Mock 账号

统一测试密码：`K12Demo123!`。这些账号只用于本地课程演示，不是真实账号。

| 角色 | 用户 ID | 用户名 | 所属校区 |
|---|---:|---|---|
| 家长 `PARENT` | 201 | `parent_201` | 滨江校区 |
| 学生 `STUDENT` | 101 | `student_101` | 滨江校区 |
| 任课教师 `TEACHER` | 301 | `teacher_301` | 滨江校区 |
| 班主任 `HOMEROOM_TEACHER` | 302 | `teacher_302` | 滨江校区 |
| 教务 `ACADEMIC_ADMIN` | 901 | `academic_901` | 滨江校区 |
| 系统管理员 `SYSTEM_ADMIN` | 999 | `system_999` | 滨江校区 |

系统管理员虽然有所属校区，权限范围仍是单一机构下的全部校区。

## 认证接口

### `POST /auth/login`

请求：

```json
{
  "username": "student_101",
  "password": "K12Demo123!"
}
```

成功返回 `accessToken`、`tokenType`、`expiresAt` 和 `user`。响应不包含密码。

### `GET /auth/me`

请求头使用 `Authorization: Bearer <accessToken>`。成功返回当前 `user`。

### `POST /auth/logout`

请求头同样使用 Bearer 令牌。成功返回 204，原令牌立即失效。

| HTTP | 错误代码 | 场景 |
|---:|---|---|
| 400 | `INVALID_JSON` | JSON 格式错误 |
| 400 | `VALIDATION_ERROR` | 用户名或密码缺失 |
| 401 | `INVALID_CREDENTIALS` | 账号或密码错误 |
| 401 | `AUTH_REQUIRED` | 未提供正确格式的 Bearer 令牌 |
| 401 | `INVALID_SESSION` | 令牌未知、已退出或已过期 |
| 405 | `METHOD_NOT_ALLOWED` | 已知地址使用错误方法 |
| 413 | `PAYLOAD_TOO_LARGE` | 请求体超过 16 KiB |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | 登录请求不是 JSON |

会话保存在 API 进程内存中，只保存令牌的 SHA-256 摘要，有效期八小时。登录时会清理过期会话；每个账号最多保留五个会话，超出时只淘汰该账号最旧的会话。API 要求请求头在 10 秒内、完整请求在 15 秒内送达。服务重启后需要重新登录；后续接 PostgreSQL 时再替换为 `users` 和 `sessions` 表。

## 给 B、C、D、E 的交接

四个前端已经声明公共包依赖。各成员只修改自己的模块，并把本地类型和账号逐步替换为 A 发布的公共内容。

| 成员 | 后续接入重点 |
|---|---|
| B | 使用 `parent_201`，把课表、通知和反馈字段对齐公共类型 |
| C | 使用 `student_101`，课件附件统一为 `attachments: FileSummary[]` |
| D | 使用 `teacher_301`、`teacher_302` 和大写教师角色 |
| E | 使用 `username`、`active`，替换本地的 `account`、`enabled` 字段 |

A 的公共交付已完成。B、C、D、E 的页面接入属于各成员后续任务。

## 验证结果

- macOS `npm ci`：通过，公共包会在安装阶段自动构建。
- 公共包测试：7/7 通过，其中 3 项检查四端精确依赖、统一 API 地址和唯一根锁文件。
- API 测试：16 项通过、0 失败；另 1 项真实 HTTP 端口测试因当前沙箱禁止监听而跳过。无需端口的测试已覆盖多会话隔离、多分块请求和 16 KiB 精确边界。
- 全仓 `npm run check`：通过，共发现 51 项测试（50 项通过、1 项因上述沙箱限制跳过），六个工作区类型检查和构建均成功。
- Windows 成员仍需按合并规则运行 `npm ci`、`npm run check` 和 `npm run dev:api`。
