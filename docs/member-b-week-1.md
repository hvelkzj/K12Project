# 成员 B 第一周交付记录

> 集成说明：本文件保留 B 分支的原始字段提案和交付过程。跨端开发使用 `docs/api-field-contract.md` 的数字 ID、公共状态和最终字段；家长端 Mock 已在合并时完成对应调整。

## 负责范围

家长端和通知。

## 页面骨架

目录：`apps/parent-web`

- 登录状态：首页默认使用家长测试账号。
- 首页：显示当前学生课程、通知和反馈数量。
- 学生切换：只能切换已绑定学生。
- 课表：展示课程、时间、教师和教室。
- 请假：选择课程并提交请假 Mock。
- 通知：展示普通通知和调课通知。
- 反馈：家长确认或提出异议。

## 字段清单

### 家长和学生绑定

| 字段 | 说明 |
|---|---|
| parentId | 家长 ID |
| parentName | 家长姓名 |
| phone | 联系电话 |
| boundStudentIds | 已绑定学生 ID 列表 |
| studentId | 学生 ID |
| studentName | 学生姓名 |
| className | 班级 |
| campusName | 校区 |

### 请假

| 字段 | 说明 |
|---|---|
| leaveId | 请假记录 ID |
| studentId | 学生 ID |
| scheduleId | 对应课程 ID |
| reason | 请假原因 |
| contactPhone | 联系电话 |
| status | draft / submitted / approved / rejected |
| createdAt | 创建时间 |

### 通知

| 字段 | 说明 |
|---|---|
| noticeId | 通知 ID |
| studentId | 学生 ID |
| type | schedule_change / feedback / general |
| title | 标题 |
| content | 内容 |
| originalTime | 调课原时间 |
| newTime | 调课新时间 |
| substituteTeacherName | 代课教师 |
| createdAt | 创建时间 |
| read | 是否已读 |

### 反馈确认与异议

| 字段 | 说明 |
|---|---|
| feedbackId | 反馈 ID |
| studentId | 学生 ID |
| courseName | 课程 |
| teacherName | 教师 |
| strengths | 优点 |
| improvements | 不足 |
| suggestion | 建议 |
| status | pending_parent / confirmed / disputed |

## Mock 流程

`查看课表 -> 选择课程 -> 填写请假原因 -> 提交请假 -> 页面显示 submitted`

## 测试场景

- 家长可以查看已绑定学生课表。
- 家长不能查看未绑定学生。
- 家长可以提交已绑定学生的请假申请。
- 调课通知展示原时间、新时间和代课教师。
- 家长可以确认反馈或提出异议。

## 原分支待确认项

- 调课通知中的 `originalTime`、`newTime`、`substituteTeacherName` 是否与教师端和教务端字段名一致。
- 家长异议是否需要新增 `disputeReason` 字段；第一周 Mock 暂未加入公共字段。

以上问题已在 `docs/abcde-field-decisions-2026-08-07.md` 中解决。
