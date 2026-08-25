# AI 与 Git 协作规范

## 项目定位与文档规则

- 这是四周完成的课程作业，不按商业上线产品的标准扩展。
- 文档优先使用短句、表格和清单，只保留成员能直接执行的内容。
- 不主动增加竞品调研、企业级架构、复杂流程或额外交付物。
- 能用简单方案完成时不引入复杂方案；只有用户明确要求时再补充细节。
- 项目必须同时支持 macOS 和 Windows；文档中的系统相关命令必须同时给出两种写法。

## macOS 与 Windows 兼容

- 统一使用 Node.js 22.12+、npm 10+ 和根目录 `package-lock.json`。
- 拉取代码后使用 `npm ci`；只有修改依赖时才使用 `npm install` 并提交锁文件。
- npm 脚本使用 Node.js 实现，不在公共脚本中直接使用 `cp`、`rm`、`export`、`set` 等单系统命令。
- 代码路径使用 Node.js `path` API，不写 `/Users/...`、`C:\...` 等本机绝对路径。
- import 的文件名大小写必须和真实文件一致；文件名不使用 Windows 禁止字符。
- 文本统一 UTF-8，Git 统一保存为 LF；不得提交 `.env`、系统缓存和编辑器配置。
- 新增启动方式或配置步骤时，同时验证 macOS 终端和 Windows PowerShell。
- 合并前至少由一名 macOS 成员和一名 Windows 成员运行 `npm ci`、`npm run check` 和对应启动命令。

## 分支

- `main`：仅保留可演示版本。
- `develop`：集成分支。
- `feature/<成员>-<模块>`：个人开发分支。
- `fix/<成员>-<问题>`：缺陷修复分支。

## 提交

提交格式：`type(scope): summary`，例如 `feat(schedule): add substitute teacher approval`、`fix(feedback): prevent duplicate escalation`、`test(auth): add role isolation cases`。

每个成员至少保留三类可辨识提交：功能实现、Bug 修复、测试/文档。合并前必须通过 lint、单元测试和基本集成测试；禁止直接向 `main` 推送。

完成的内容，交付了什么功能或者产品在每一周的计划里，仿照A成员交付记录。

## AI 使用

每轮交互保存到 `docs/ai-log/`，至少记录：日期、目标、完整提示词、AI 回复摘要、人工判断、执行的修改、测试结果、下一轮问题。AI 生成的代码必须由成员审查并补充业务边界测试。

## 公共约定

数据库迁移、API 契约、角色枚举和状态枚举由组长审核后合并。涉及公共文件的修改必须在 PR 描述中说明影响范围。
