# AI 协作记录：C 学生端业务 API 接入

日期：2026-08-20

## 目标

按 `docs/tasks/2026-08-17-round-1/03-C.md` 完成学生端业务 API 接入，只修改 `apps/student-web` 和 C 本轮交付记录、AI 记录。

## 完整提示词

```text
我是C成员，这是新一轮的任务，共享api A成员已经完成，更新develop分支就可以了。
每次的pr都有评审在下面，当然也是ai给的，如果有什么不妥，比如修改了自己原来的想法，可以说一下，继续完成C的下一个任务
（随后提供了任务文件 03-C.md，并确认本地 PyCharm 项目路径）
```

## AI 回复摘要

- 读取本轮 C 任务，确认只处理 `apps/student-web` 和 C 本人记录。
- 对照 A 已合并的共享业务 API（`businessRoutes.ts` / `businessTypes.ts` / `businessSeed.ts`），确认 `/student/overview`、`/student/submissions` 的请求与响应形态。
- 新增可注入 `fetch` 的 `studentBusinessClient.ts`，复用现有 `authService` 的 Token 处理（补充暴露 `clearAccessToken`）。
- 改造 `App.vue` 与 `Home.vue` 的数据流：登录后加载一次概览，首页、课件、作业列表、详情、结果全部从概览派生。
- 提交走 `POST /student/submissions`，成功后重新加载概览回写状态；失败保留正文和附件。
- 增加加载中、空数据、失败重试、`401` 清 Token 回登录、`403/404/409/422` 显示服务端信息。
- `mockData.ts` 转为测试夹具（对齐 `businessSeed.ts`），运行时不再读取业务 Mock。
- 全仓 `npm run check` 通过后整理交付记录。

## 人工判断

- 学生业务接口复用现有认证 Token，没有新增第二套登录状态。
- 页面运行时业务数据来自 API；Mock 只保留为测试夹具，供 `studentService` / 展示层测试使用。
- `401` 清理 Token 并回登录页；其他业务错误保留登录状态并显示服务端信息，符合任务第 10、11 条。
- 截止、重复提交等业务规则以服务端响应为最终结果，前端只做提前提示。
- 未新增公共字段，未修改 API、其他成员前端和 `AssignmentList.vue` 主视觉。

## 执行的修改

- 新增 `apps/student-web/src/studentBusinessClient.ts` 及 8 项客户端测试。
- 修改 `apps/student-web/src/services/authService.ts`：接口与实现补充 `clearAccessToken`。
- 重写 `apps/student-web/src/studentService.ts`：基于概览的纯查询函数 + 可注入客户端的 `StudentDataService`。
- 重写 `apps/student-web/src/assignmentListService.ts`、`mockData.ts`（转为夹具）。
- 重写 `apps/student-web/src/App.vue`、`views/Home.vue`：接入概览、提交接口与错误状态。
- 重写 `studentService.test.ts`、`assignmentPresentation.test.ts`，更新 `authService.test.ts`。
- 新增 `docs/member-c-student-api-round-1.md` 和本 AI 记录。

## 测试结果

- 学生端测试：35/35 通过。
- 学生端 TypeScript 检查：通过。
- 学生端生产构建：通过。
- 根目录 `npm run check`：通过（全部 workspace 的 lint、typecheck、test、build）。

## 下一轮问题

- 等待 A 对本轮 PR 评审；若评审提出修改，按评审意见修复后再进入下一轮。
- 真实附件上传、更多课程/教师/课件展示字段是否扩展，由 A 裁决。
