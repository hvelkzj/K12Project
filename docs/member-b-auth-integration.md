# 成员 B 家长端认证接入交付记录

日期：2026-08-11

## 范围

- 仅修改 `apps/parent-web` 和成员 B 交付记录。
- 家长端业务数据继续使用 Mock。
- 认证流程接入真实 API：`POST /auth/login`、`GET /auth/me`、`POST /auth/logout`。
- 使用 `@k12/shared` 公共类型和 `@k12/shared/mock-accounts` 测试账号。

## 已完成

- 登录账号改为 `parent_201` / `K12Demo123!`。
- 登录成功后校验用户角色必须为 `PARENT`。
- Token 使用 `sessionStorage`，键名为 `k12AccessToken`。
- API 地址读取 `VITE_API_BASE_URL`，默认 `http://127.0.0.1:3000`。
- 页面刷新时调用 `/auth/me` 恢复登录态；401 会清理 token 并回到登录页。
- 退出时调用 `/auth/logout`，随后清理 token。
- 删除父端本地重复公共类型文件 `src/types.ts`，改用共享类型。
- 保留家长端既有页面结构，支持流程：登录 -> 选择绑定学生 -> 查看课表 -> 提交请假 -> 查看结果 -> 退出。

## 测试覆盖

- 正确登录。
- 错误账号或密码。
- 非家长角色被阻止。
- 未绑定学生被拦截。
- 请假原因必填校验。
- 同一课程重复请假提交拦截。
- 调课通知包含原时间、新时间和代课教师。
- token 无效时清理并返回登录页状态。
- 退出后不能继续访问。

## 需要配合

- 成员 A：保持 `@k12/shared` 的 auth 类型、mock accounts 和 API 返回结构稳定。
- 后端/API 负责人：联调时确认本地 API 默认端口 `3000` 可用，且 CORS、401 响应与当前契约一致。
