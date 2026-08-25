# 2026-08-24 Windows 项目测试

## 日期

2026-08-24。

## 目标

在 Windows PowerShell 验证最新 `develop` 的干净安装、全仓检查、统一启动、六服务 HTTP、十三账号会话和停止后端口释放，并补齐相关文档。

## 完整提示词

```text
进行windows下的项目测试，测试完补齐相关文档
```

## AI 回复摘要

- 确认 `main` 只有规划文档，切换到本地 `develop` 跟踪分支完成测试。
- 执行干净安装、lint、类型检查、300 项测试、全部工作区构建和真实服务冒烟。
- 使用十三个本地账号验证登录、角色、当前用户、退出和旧令牌失效，并验证学生注册流程。
- 修复 Node.js 24 在 Windows 统一启动时的 `DEP0190` 警告，并增加回归测试。
- 更新 4 个受安全公告影响的间接依赖补丁版本，最终审计为 0 漏洞。
- 回填项目状态、模块清单、A 最终交付记录和任务归档。

## 人工判断

- `main` 没有可运行代码，测试应基于项目约定的集成分支 `develop`。
- Windows 启动警告来自 `shell: true`，固定参数当前可控，但 Node.js 已明确弃用，应改为直接调用当前 npm CLI。
- `npm.cmd` 在当前 Node.js 24 环境直接 `spawn` 返回 `EINVAL`，因此使用 `npm_execpath` 方案。
- 安全更新均在现有版本范围内，不使用 `--force`，并通过干净安装和全仓回归确认兼容。
- 本轮不改业务契约、角色、状态和页面逻辑。

## 执行的修改

- `scripts/dev.mjs`：统一启动通过 Node.js 调用当前 npm CLI，不再启用 shell。
- `packages/shared/test/frontendIntegration.test.ts`：增加无 shell 启动回归测试。
- `package-lock.json`：更新 `brace-expansion`、`js-yaml` 和 `nanoid` 的受影响间接版本，共 4 个锁文件条目。
- `docs/windows-test-2026-08-24.md`：新增 Windows 完整测试记录。
- `README.md`、`docs/project-plan.md`、`docs/module-page-inventory.md`、`docs/member-a-final-integration-round-4.md`：更新 Windows 完成状态和测试数量。
- 后续任务归档：将 Windows 最终复核从待办改为已通过。

## 测试结果

- Windows 11 专业版、PowerShell 7.6.4、Node.js 24.17.0、npm 11.8.0。
- `npm ci`：通过，更新锁文件后再次干净安装成功，审计 0 漏洞。
- `npm run check`：通过，300 项测试通过、0 失败、0 跳过。
- 工作区：shared 14、API 68、统一入口 7、家长端 39、学生端 67、教师端 48、后台 57。
- 六个服务：端口 3000、5172、5173、5174、5175、5176 均返回 HTTP 200。
- 十三个账号：登录 200、当前用户 200、退出 204、旧令牌 401，角色全部匹配；学生注册 201、登录 200、概览 200。
- 停止统一启动后六个端口全部释放。
- `npm audit --omit=dev` 和 `npm audit`：均为 0 漏洞。

## 下一轮问题

- 如需完成 Windows 视觉验收，在浏览器补测桌面和 720px 窄屏布局。
- 提交前按成员身份放入符合规范的 `feature/<成员>-<模块>` 或 `fix/<成员>-<问题>` 分支，并在 PR 说明统一启动脚本和根锁文件影响。
