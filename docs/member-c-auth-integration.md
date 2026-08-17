# C 成员：学生端认证与作业提交流程

## 完成内容

- 学生端使用真实 `POST /auth/login`、`GET /auth/me` 与 `POST /auth/logout`。
- 仅接受 `STUDENT` 角色；Token 保存于 `sessionStorage.k12AccessToken`，401 与退出均会清除。
- 使用 `@k12/shared` 的 `UserSummary`、`Courseware`、`FileSummary`、`Assignment`、`Submission` 与 `SubmissionStatus`。
- 课件与作业均使用 `attachments: FileSummary[]`；`NOT_SUBMITTED` 仅由页面派生。
- 保留作业列表视觉页面，并完成详情、提交、结果、列表状态回写、订正历史与附件校验。

## 截止后提交修复

此前详情页读取了不存在的 `deadline` 字段并直接修改页面状态，实际没有触发截止校验。现已统一使用公共 `Assignment.dueAt`：页面入口会禁用截止后的提交，提交动作仍会调用 `studentService.submitAssignment`，以真实当前时间再次校验，避免绕过页面限制。

## 验证

- 学生端测试：12/12 通过。
- 学生端 TypeScript 检查：通过。
- 学生端生产构建：通过。

## 待联调

业务作业、课件和提交数据当前仍为 Mock，后续可替换为后端业务 API；认证已使用真实 API。
