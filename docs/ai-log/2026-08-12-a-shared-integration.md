# 2026-08-12 A 成员：四端共享依赖接入

## 日期

2026-08-12。对应 A 的四端公共依赖和集成任务。

## 目标

在 PR #4 合并后的 `develop` 基线上，为四个前端统一登记 `@k12/shared` 精确依赖，确认 API 地址示例和唯一根锁文件，补充集成测试、公共接入约定和第一周交付记录，并发起 PR。

## 完整提示词

> 文件：`01-A-任务.md`

> 完成A的任务

GitHub CLI 重新认证后的补充提示：

> 已登录

## AI 回复摘要

- 获取远程 `develop`，确认 PR #4 已通过合并提交 `893de62` 进入集成分支。
- 从最新基线创建并推送 `feature/A-shared-integration`。
- 为家长端、学生端、教师端和后台登记精确依赖 `@k12/shared@0.1.0`。
- 使用根 `package-lock.json` 统一记录依赖，没有生成子目录锁文件。
- 确认四个前端已有统一的 `VITE_API_BASE_URL` 示例，因此没有重复修改环境文件。
- 新增 3 项共享集成测试，检查精确版本、API 地址和唯一根锁文件。
- 记录 `sessionStorage`、`k12AccessToken`、401 和退出清理 Token 的前端约定。
- 更新公共字段申请模板和 A 的周计划交付记录。
- 创建以 `develop` 为目标的草稿 PR #7。

## 人工判断

待 A 和组长审查后填写：

- [ ] 同意由 A 一次性登记四端公共依赖，避免成员重复修改根锁文件。
- [ ] 同意 `@k12/shared` 使用精确版本 `0.1.0`。
- [ ] 同意前端 Token 和 API 地址约定。
- [ ] Windows 验证通过后再把 PR #7 标记为可审查并合并。

## 执行的修改

- 更新四个前端 `package.json`。
- 更新根 `package-lock.json`。
- 新增 `packages/shared/test/frontendIntegration.test.ts`。
- 更新 README、公共类型交付、字段契约、数据模型、页面清单和第一周计划。
- 新增本轮 AI 记录。
- 未修改 B、C、D、E 页面或业务逻辑。

## 测试结果

- 基线 `npm ci`：通过。
- 基线 `npm run check`：通过。
- 修改后 `npm ci`：通过。
- 共享包测试：7/7 通过。
- 修改后 `npm run check`：通过；共发现 51 项测试，50 项通过、0 失败，1 项真实端口测试因 Codex 沙箱禁止监听而跳过。
- 六个工作区类型检查和构建通过。
- `git diff --check`：通过。

## 下一轮问题

1. Windows 成员需要在 PR #7 上运行 `npm ci` 和 `npm run check`。
2. Windows 成员需要确认四个前端可以解析 `@k12/shared`。
3. 验证通过后把 PR #7 转为正式 PR 并合并到 `develop`。
4. 合并后通知 B、C、D、E 从最新 `develop` 开始各自认证接入。
