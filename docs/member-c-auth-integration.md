# C 成员：学生端认证与作业提交流程

## 完成内容

- 学生端使用真实 `POST /auth/login`、`GET /auth/me` 与 `POST /auth/logout`。
- 仅接受 `STUDENT` 角色；非学生登录会撤销刚创建的服务端会话。
- Token 保存于 `sessionStorage.k12AccessToken`；登录 401 保留“账号或密码错误”，会话 401 才清除 Token 并返回登录页。
- 会话恢复遇到网络错误或 5xx 时保留 Token；退出失败会报告错误，同时清除本地 Token。
- 使用 `@k12/shared` 的 `UserSummary`、`Courseware`、`FileSummary`、`Assignment`、`Submission` 与 `SubmissionStatus`。
- 课件与作业均使用 `attachments: FileSummary[]`；`NOT_SUBMITTED` 仅由页面派生。
- 保留 PR #8 的作业列表视觉页面，并恢复首页、课件及课件附件入口。
- 完成详情、提交、结果、列表状态回写、订正历史与附件校验。
- 登录表单使用关联的 `label` / `input`，提交期间阻止重复登录请求。

## PR #8 合并整改

- PR #8 于 2026-08-17 经 A 提出问题后批准合并，合并提交为 `9e5afdf`。
- 合并评审中的测试回退、页面回退、错误密码提示、退出失败和表单可访问性问题均已在 `develop` 修复。
- 页面保持七个状态：登录、首页、课件、作业列表、作业详情、提交、结果。

## 截止后提交修复

此前详情页读取了不存在的 `deadline` 字段并直接修改页面状态，实际没有触发截止校验。现已统一使用公共 `Assignment.dueAt`：页面入口会禁用截止后的提交，提交动作仍会调用 `studentService.submitAssignment`，以真实当前时间再次校验，避免绕过页面限制。

## 验证

- 学生端测试：24/24 通过，包含 12 项认证和会话边界测试。
- 学生端 TypeScript 检查：通过。
- 学生端生产构建：通过。
- 浏览器实测正确/错误登录、首页、课件附件、作业提交、列表状态回写和退出通过；干净页面控制台 0 错误、0 警告。

## 待联调

业务作业、课件和提交数据当前仍为 Mock，后续可替换为后端业务 API；认证已使用真实 API。

Windows 成员仍需独立运行 `npm ci`、`npm run check`、`npm run dev:api` 和 `npm run dev:student`，并记录浏览器主流程结果。
