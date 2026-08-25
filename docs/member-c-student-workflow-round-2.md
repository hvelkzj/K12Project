# C 学生端第二轮交付记录：筛选、搜索与本地草稿

完成日期：2026-08-20

分支：`feature/C-student-workflow-round-2`（基于 `feature/C-student-api-round-1`）

## 已完成

- 作业列表增加五种状态筛选：全部、未提交、已提交、已批改、需订正。
- 增加课程筛选，可与状态筛选组合使用；课程选项只列出有作业的课程。
- 课件中心增加标题搜索：忽略首尾空格、英文不区分大小写、无结果有明确提示。
- 作业正文和附件元数据保存为本地草稿，按作业 ID 隔离（`localStorage.k12StudentAssignmentDrafts`）。
- 提交成功后清除对应草稿；提交失败、返回列表或刷新页面时草稿保留。
- 订正草稿与提交历史分离：历史始终来自服务端概览，草稿不会覆盖首次提交记录。
- 课件附件只展示文件名和大小等元数据，移除虚假的"Mock 下载已准备"提示。
- 空作业、空课件、筛选无结果均有明确状态提示。
- 保留 `AssignmentList.vue` 主视觉，筛选栏沿用现有卡片与徽章设计语言，未重新设计页面。

## 实现说明

- 新增纯逻辑模块：`assignmentFilters.ts`（状态/课程组合筛选）、`coursewareSearch.ts`（标题搜索）、`assignmentDrafts.ts`（按作业 ID 隔离的草稿存储，可注入 Storage）、`draftSubmission.ts`（提交成功才清理草稿的流程封装）。
- 页面接入：`AssignmentList.vue` 增加筛选栏；`Home.vue` 进入提交页时载入草稿、输入变化即保存、提交成功后清除；`App.vue` 课件搜索与附件元数据展示。
- 未修改 API、公共类型、其他前端；未新增依赖，无锁文件变更。

## 测试结果

- 学生端测试：54/54 通过（新增 19 项：组合筛选 6、课件搜索 5、草稿存储与提交流程 8）。
- 学生端 TypeScript 检查：通过。
- 学生端生产构建：通过。
- 根目录 `npm run check`：通过（全部 workspace 的 lint、typecheck、test、build）。
