# B 家长端业务 API 接入交付记录

完成日期：2026-08-18

分支：`feature/B-parent-api-round-1`

## 已完成

- 保留家长端现有真实认证和蓝色侧栏视觉。
- 新增可注入 `fetch` 的家长业务客户端。
- 接入 `GET /parent/students`。
- 接入 `GET /parent/students/:studentId/overview`。
- 接入 `POST /parent/leave-requests`。
- 接入 `PATCH /parent/feedback/:feedbackId`。
- 登录后加载绑定学生，再加载第一个学生概览。
- 切换学生后重新请求该学生概览，并清空上一位学生数据。
- 请假成功后使用服务端返回的 `LeaveRequest` 写入列表。
- 请假失败时保留课程、原因和联系电话。
- 反馈确认成功显示 `CONFIRMED`，异议成功显示 `DISPUTED`。
- 调课通知展示原日期时间、新日期时间、原教师和代课教师。
- 增加加载中、空数据、请求失败和重试状态。
- 业务接口 `401` 清除 Token 并回到登录页。
- `403`、`404`、`409`、`422` 使用服务端错误信息。
- 页面运行时不再导入业务 Mock；Mock 仅保留在测试夹具。

## 删除的运行时 Mock

- 删除 `apps/parent-web/src/mockData.ts`。
- 删除 `apps/parent-web/src/parentService.ts`。
- 删除原 `parentService` 单元测试，改为业务 API 客户端测试。

## 测试结果

- `npm.cmd run test --workspace @k12/parent-web`：22/22 通过。
- `npm.cmd run typecheck --workspace @k12/parent-web`：通过。

## 仍需 A 配合

- 联调时保持家长端 4 个业务接口路径、状态码和错误体 `{ code, message }` 稳定。
- 若后续需要展示更多课程/教师详情，由 A 裁决是否扩展公共类型或 API 响应。
