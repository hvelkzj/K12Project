import type { Submission } from '@k12/shared'

import { assignmentDrafts } from './assignmentDrafts'
import type { AssignmentDraftStore } from './assignmentDrafts'
import { studentDataService } from './studentService'
import type { StudentDataService } from './studentService'
import type { SubmitWorkInput } from './studentBusinessClient'

export interface DraftSubmissionFlow {
  submitWork(input: SubmitWorkInput): Promise<Submission>
}

// 提交成功才清理草稿；提交失败或网络错误时不清除，保留用户输入。
export function createDraftSubmissionFlow(
  service: StudentDataService,
  drafts: AssignmentDraftStore,
): DraftSubmissionFlow {
  return {
    async submitWork(input) {
      const submission = await service.submitWork(input)
      drafts.clear(input.assignmentId)
      return submission
    },
  }
}

export const draftSubmissionFlow = createDraftSubmissionFlow(
  studentDataService,
  assignmentDrafts,
)
