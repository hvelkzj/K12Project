# E 成员：后台跨端联调与修复交付记录（第三轮）

完成日期：2026-08-21

分支：`fix/E-admin-cross-end-round-3`

## 跨端联调验证（真实 API）

### 1. 调课流程

- 教师提交调课申请（重复提交返回 409 正确）。
- 教务审批通过（`APPROVED`）。
- 教务安排代课（时间冲突返回 409，换教师后 `SUBSTITUTE_ASSIGNED`）。
- 家长端产生调课通知：`scheduleChangeNotices` 从 0 → 1，含新日期和代课教师。

### 2. 反馈异议工单流程

- 家长对反馈提出异议（`DISPUTED`）自动生成工单（`OPEN`）。
- 教务处理：`START` → `PROCESSING`，关闭结果为空返回 422，关闭后 `CLOSED`，重复关闭返回 409。

### 3. 请假流程

- 家长提交请假（`PENDING`）。
- 教务 overview 可见该请假，拒绝原因为空返回 422，通过后 `APPROVED`。
- 班主任教师 overview 可见该请假（学生 102）。

### 4. 排课流程

- 系统管理员创建排课（`SCHEDULED`），修改时间/教室后 `CHANGED`。
- 对应教师在 overview 中可见更新后的排课。

### 5. 账号启停流程

- 停用 `teacher_301` 后原会话立即 401，重新登录也 401。
- 禁止停用当前系统管理员返回 422。

### 数据范围

- 教务 overview：1 个校区；跨校区审批返回 403。
- 系统管理员 overview：全部校区。

### 错误处理

- `401`（无令牌/会话失效）、`403`（跨校区/角色）、`409`（重复/冲突）、`422`（字段/规则）全部正确返回并展示。

## 修复问题

1. **状态回写与并发防护**：`submitReview`、`submitSubstitute`、`beginSelectedWorkOrder`、`closeSelectedWorkOrder` 改用统一的 `runManagementAction` 防重复提交，成功后才更新本地状态，失败不修改本地状态。
2. **统计问题**：
   - 工作台"待审批"统计包含调课和请假两类申请。
   - 看板按校区新增"请假待审"指标。
   - 工作台统计基于可见数据范围，不遗漏系统管理员的跨校区数据；请假统计不受列表筛选影响。
   - 新增 `adminStatistics.ts` 纯函数并测试。
3. **类型一致性**：`types.ts` 补充导出 `LeaveRequest`。

## 测试结果

- `npm run test --workspace @k12/admin-web`：49 项通过、0 失败。
- `npm run typecheck --workspace @k12/admin-web`：通过。
- `npm run build --workspace @k12/admin-web`：通过。
- 根目录 `npm run check`：通过；全仓 224 项测试 0 失败，lint、五端类型检查和构建均成功。

## 说明

- 未修改 API、公共类型或其他前端。
- 仅修改 `apps/admin-web` 和本人交付记录。
