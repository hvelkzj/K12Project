# 2026-08-22 B 家长端第三轮跨端修复

## 目标

根据最新 B 成员第三轮任务，完成家长端真实 API 跨端流程修复。

## 完整提示词

用户要求：“现在我已经拉取了最新的develop分支，根据任务说明书完成最新的任务。”

任务说明书要求：

- 使用真实 API 提交请假并刷新审批状态。
- 查看调课通知并标记已读。
- 确认教师反馈或提出异议。
- 验证异议失败时不改变页面状态。
- 验证账号停用或会话失效后返回登录页。
- 修复家长端的展示、刷新、请求竞争和错误处理问题。
- 不修改 API、公共类型或其他前端。

## AI 回复摘要

- 先确认本地在 `develop` 且工作区干净。
- 创建分支 `fix/B-parent-cross-end-round-3`。
- 只检查和修改 `apps/parent-web` 与成员 B 文档。
- 不修改 API、公共类型或其他前端。

## 人工判断

- 公共 `Notification.readAt` 字段已能表达已读状态，不需要修改 shared。
- API 已提供 `PATCH /parent/notifications/:notificationId/read`，家长端只需接入。
- 请假批准和拒绝由后台处理，家长端通过刷新当前学生概览获取最新审批状态。

## 执行的修改

- `parentBusinessClient` 增加 `markNotificationRead`。
- 家长端通知页增加“标记已读”按钮。
- 普通通知和调课通知均使用服务端返回的 `Notification` 更新 `readAt`。
- 请假提交成功后刷新当前学生概览。
- 请假页增加“刷新审批状态”按钮。
- 概览加载增加请求序号，避免旧请求覆盖新学生数据。
- 异议失败、通知已读失败、`409` 和网络错误只显示错误信息，不改页面业务状态。
- 新增通知已读和本地替换 helper 测试。
- 新增第三轮交付记录。

## 测试结果

- `npm.cmd run test --workspace @k12/parent-web`：30/30 通过。
- `npm.cmd run typecheck --workspace @k12/parent-web`：通过。

## 下一轮问题

- Windows 浏览器需要实测桌面和 720px 窄屏布局。
- 如 API 后续调整通知已读响应，需要成员 A 通知成员 B 同步更新。
