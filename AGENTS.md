# AI 与 Git 协作规范

## 分支

- `main`：仅保留可演示版本。
- `develop`：集成分支。
- `feature/<成员>-<模块>`：个人开发分支。
- `fix/<成员>-<问题>`：缺陷修复分支。

## 提交

提交格式：`type(scope): summary`，例如 `feat(schedule): add substitute teacher approval`、`fix(feedback): prevent duplicate escalation`、`test(auth): add role isolation cases`。

每个成员至少保留三类可辨识提交：功能实现、Bug 修复、测试/文档。合并前必须通过 lint、单元测试和基本集成测试；禁止直接向 `main` 推送。

## AI 使用

每轮交互保存到 `docs/ai-log/`，至少记录：日期、目标、完整提示词、AI 回复摘要、人工判断、执行的修改、测试结果、下一轮问题。AI 生成的代码必须由成员审查并补充业务边界测试。

## 公共约定

数据库迁移、API 契约、角色枚举和状态枚举由组长审核后合并。涉及公共文件的修改必须在 PR 描述中说明影响范围。

