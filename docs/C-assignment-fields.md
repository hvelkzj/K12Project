# C成员：学生端作业与批改字段清单

> 集成说明：本文件保留 `feature/C-assignment` 的原始字段提案。最终公共字段已统一为 camelCase、数字 ID 和公共状态，开发时以 `docs/api-field-contract.md` 为准。`feature/C-assignment-pages` 已通过 PR #3 完成审查、评论、批准和合并；其中视觉页面作为作业列表主页面。合并后的契约、接入、交互和测试问题已在 `develop` 修复，没有新增或修改公共字段。

## 1. 作业基础表 (Assignment)

- `assignment_id`: 作业唯一标识
- `course_id`: 关联的课程 ID
- `teacher_id`: 发布作业的教师 ID
- `title`: 作业标题
- `description`: 作业详细要求
- `attachments`: 教师上传的附件
- `deadline`: 提交截止时间（注意：业务规则要求截止后默认不能提交）

## 2. 作业提交记录表 (Submission)

- `submission_id`: 提交记录唯一标识
- `assignment_id`: 关联的作业 ID
- `student_id`: 提交作业的学生 ID
- `content`: 学生填写的作业正文
- `student_attachments`: 学生上传的附件
- `status`: 提交状态（枚举值：未提交、已提交、已批改、需订正）
- `submit_time`: 实际提交时间
- `grade`: 批改分数/等级
- `teacher_feedback`: 教师批改评语
- `graded_time`: 批改时间
