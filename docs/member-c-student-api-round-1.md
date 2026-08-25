# C 学生端业务 API 接入交付记录

完成日期：2026-08-20

分支：`feature/C-student-api-round-1`

## 已完成

- 保留学生端现有真实认证和作业列表视觉页面（`AssignmentList.vue` 未改动）。
- 新增可注入 `fetch` 的学生业务客户端 `studentBusinessClient.ts`。
- 接入 `GET /student/overview`。
- 接入 `POST /student/submissions`，只发送 `assignmentId`、`content`、`attachments`。
- 登录后加载学生概览；首页统计、课件、作业列表、详情和结果共用同一次概览数据。
- 提交成功后重新加载概览，更新列表状态和完成率。
- `REVISION_REQUIRED` 时允许再次提交；结果页显示完整 `attempt` 历史。
- 不允许迟交时前端提前提示，但以服务端 `409` 响应为最终结果。
- 附件只发送 `FileSummary` 元数据，未实现真实上传。
- 增加加载中、空数据、请求失败和重试状态。
- 业务接口 `401` 清除 Token 并回到登录页；`403`、`404`、`409`、`422` 显示服务端信息，不改变为会话过期。
- 提交失败时保留正文和附件选择，不显示假成功。
- 页面运行时不再读取业务 Mock；`mockData.ts` 转为测试夹具（对齐 `businessSeed.ts` 的林晓雨数据）。
- 保留作业列表 → 详情 → 提交 → 结果 → 列表状态回写的页面流程。

## 测试结果

- 学生端测试：35/35 通过（含业务客户端 8 项：Bearer 携带、契约字段、401 清 Token、403/404/409/422 服务端消息、网络错误、无 Token）。
- 学生端 TypeScript 检查：通过。
- 学生端生产构建：通过。
- 根目录 `npm run check`：通过（全部 workspace 的 lint、typecheck、test、build）。

## 仍需 A 或 D 配合

- 联调时保持 `/student/overview`、`/student/submissions` 的路径、状态码和错误体 `{ code, message }` 稳定。
- 若学生端需要展示更多课程/教师/课件详情字段，由 A 裁决是否扩展公共类型或 API 响应。
- 真实附件上传待后续轮次；本轮只传 `FileSummary` 元数据。
