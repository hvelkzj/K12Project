# K12 教育培训综合管理平台

本项目面向家长、学生、教师/班主任、教务管理员和系统总后台，复刻并深化一个 K12 培训机构的综合管理平台。

## 项目重点

- 排课与调课流转：教师请假 → 教务审批 → 系统推荐代课 → 家长通知 → 影响班级确认。
- 家校反馈工单：班主任发起反馈 → 家长认可/提出异议 → 教务客服介入 → 回访与关闭。
- 权限隔离：教师仅可见本人班级，班主任可见负责学生完整跟进记录，教务可处理业务，系统总后台负责机构级配置和审计。

## 文档

- [四周计划与五人分工](docs/project-plan.md)
- [Git 与 AI 协作规范](AGENTS.md)
- [权限与业务规则](docs/business-rules.md)
- [实验报告证据清单](docs/report-evidence.md)

## 建议技术栈

Vue 3 + TypeScript + Vite + Element Plus；Node.js + NestJS/Express；PostgreSQL；Prisma；JWT + RBAC；Docker Compose。

技术栈不是评分重点，优先保证业务链闭环、可测试、易协作。

