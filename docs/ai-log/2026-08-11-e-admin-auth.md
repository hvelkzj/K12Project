# 2026-08-11 E 成员：教务后台接入真实认证 API

## 日期

2026-08-11。

## 目标

完成 E 成员后台认证接入任务：在 `feature/E-admin-auth` 分支上接入登录、当前用户和退出三个真实认证 API，统一角色枚举，把本地 `account`/`enabled` 替换为公共 `username`/`active`，并从 `@k12/shared` 复用公共类型。同时承担 Windows 验证职责。

## 完整提示词

> 这是 E 成员下一步任务：负责范围只修改 `apps/admin-web` 和本人交付记录，同时负责 Windows 验收。
> 建议分支 `feature/E-admin-auth`。测试账号：教务 `academic_901`、系统管理员 `system_999`，统一密码 `K12Demo123!`。
> Windows 验证：在最新 develop 执行 `npm ci`、`npm run check`、`npm run dev:api`，记录 Node/npm 版本与认证流程结果。
> 开发任务：接入登录/当前用户/退出 API；Token 用 `sessionStorage` 的 `k12AccessToken`；角色统一为 `ACADEMIC_ADMIN` 和 `SYSTEM_ADMIN`；`account`/`enabled` 改为 `username`/`active`；从 `@k12/shared` 使用公共类型；教务仅所属校区、系统管理员全部校区；保持审批/拒绝原因/代课/工单流程；前端隐藏入口不能代替数据范围测试；业务数据用 Mock 但认证用真实 API；新增交付记录和 `docs/ai-log/`。

## AI 回复摘要

- 在最新 `develop` 上执行 Windows 验证：`npm ci` 通过，`npm run check` 通过，API 实际启动成功。
- 创建 `feature/E-admin-auth` 分支并完成认证接入。
- 新增 `authService.ts`：封装登录、当前用户、退出 API，令牌存 `sessionStorage` 的 `k12AccessToken`，含令牌过期自动清理。
- `types.ts` 改为复用 `@k12/shared` 的公共类型，删除本地重复类型；`mockData.ts` 字段 `account`→`username`、`enabled`→`active`。
- `adminService.ts` 增加 `availableSubstituteTeachers`，代课教师只限同校区且不能是原教师。
- `App.vue` 登录表单改为真实用户名/密码，校验管理员角色，退出登录按钮，数据范围按当前用户 `campusId` 动态计算。
- 测试覆盖：两种管理员登录、非管理员拒绝、跨校区拒绝、系统管理员全校区、拒绝原因必填、重复审批、代课教师范围、工单结果必填、令牌过期、退出。

## 人工判断

待 E 和组长审查后填写：

- [ ] 认证使用真实 API，业务数据仍用 Mock，符合“认证必须使用真实 API”的约定。
- [ ] 字段已全部对齐 `username`/`active`，未再使用 `account`/`enabled`。
- [ ] 数据范围由服务层 `filterByScope`/`ensureCampusAccess` 校验，前端隐藏入口不能代替测试。
- [ ] 公共字段不足时已先记录，没有自行创建另一套同名公共字段。

## 执行的修改

- `apps/admin-web/src/authService.ts`（新增）：认证客户端，令牌存 `sessionStorage`。
- `apps/admin-web/src/authService.test.ts`（新增）：认证测试。
- `apps/admin-web/src/types.ts`：复用 `@k12/shared` 类型，`UserAccount` 使用 `username`/`active`。
- `apps/admin-web/src/mockData.ts`：字段对齐 `username`/`active`。
- `apps/admin-web/src/adminService.ts`：新增代课教师范围函数。
- `apps/admin-web/src/adminService.test.ts`：补充角色与字段测试。
- `apps/admin-web/src/App.vue`：真实登录、退出、动态数据范围。
- `apps/admin-web/package.json`：添加 `@k12/shared` 依赖。
- `docs/ai-log/2026-08-11-e-admin-auth.md`（本次记录）。

## 测试结果

- Node.js v24.16.0、npm 11.13.0。
- `npm ci`：通过。
- `npm run check`：通过；admin-web 16 项测试、shared 4 项、api 17 项、parent 7 项、student 13 项全部通过，lint、五端类型检查和构建均成功。
- `npm run dev:api`：启动成功，`/health` 返回 200。
- 真实认证流程：教务登录 200 → 当前用户 200（role=ACADEMIC_ADMIN, campusId=1）→ 退出 204 → 退出后 401；系统管理员登录 200；家长（非管理员）登录 200 但角色校验拒绝进入；错误密码 401。
- `git diff --check`：通过。

## 下一轮问题

1. 需要 A 确认 `@k12/shared` 依赖版本对齐和锁文件更新。
2. 需要组长审核公共类型复用是否完整（`CampusSummary`、`ClassSummary`、`CourseSummary`、`UserAccountSummary`、`ScheduleSummary`、`ScheduleChange`、`FeedbackWorkOrder` 均已使用）。
3. Windows 验证结果需整理交给 A。
4. 建议发起 `feature/E-admin-auth` → `develop` 的 PR。
