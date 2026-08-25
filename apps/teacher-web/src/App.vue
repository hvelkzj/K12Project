<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { getBusinessStatusLabel } from '@k12/shared'
import type {
  AttendanceStatus,
  FileSummary,
  ScheduleSummary,
  Submission,
} from '@k12/shared'

import { teacherAuthClient } from './authClient'
import {
  canUseHomeroomScope,
  canWriteSchedule,
  teacherRoleName,
  type TeacherUser,
} from './teacherAccess'
import {
  teacherBusinessClient,
  TeacherBusinessError,
  type TeacherOverview,
} from './teacherBusinessClient'
import { resolveTeacherOverviewLoadFailure } from './teacherOverviewLoadState'
import {
  assignmentInput,
  feedbackInput,
  gradeInput,
  resetScheduleScopedDrafts,
  scheduleChangeInput,
} from './teacherFormRules'
import {
  assertApprovedLeavesUseLeave,
  assertScheduleActive,
  buildAttendanceDrafts,
  isScheduleCancelled,
  leaveBadgeText,
  saveAttendanceAndApply,
  visibleLeaveForStudent,
} from './teacherLeaveRules'
import {
  saveTeacherDownload,
  validateTeacherAttachment,
} from './teacherFileTransfer'
import type { AttendanceDraft } from './teacherWorkflow'

type PageKey =
  | 'today'
  | 'attendance'
  | 'publish'
  | 'grading'
  | 'feedback'
  | 'schedule-change'

interface GradeDraft {
  score: number | null
  teacherComment: string
  correctionRequired: boolean
}

const pages: Array<{ key: PageKey; label: string; shortLabel: string }> = [
  { key: 'today', label: '今日课程', shortLabel: '课程' },
  { key: 'attendance', label: '课堂签到', shortLabel: '签到' },
  { key: 'publish', label: '教学发布', shortLabel: '发布' },
  { key: 'grading', label: '作业批改', shortLabel: '批改' },
  { key: 'feedback', label: '课后反馈', shortLabel: '反馈' },
  { key: 'schedule-change', label: '调课申请', shortLabel: '调课' },
]

const attendanceStatuses: AttendanceStatus[] = [
  'PRESENT',
  'LATE',
  'ABSENT',
  'LEAVE',
]

const activePage = ref<PageKey>('today')
const currentUser = ref<TeacherUser | null>(null)
const overview = ref<TeacherOverview | null>(null)
const isRestoringSession = ref(true)
const isAuthenticating = ref(false)
const isOverviewLoading = ref(false)
const pendingAction = ref<string | null>(null)
const overviewLoadError = ref('')
const username = ref('')
const password = ref('')
const authMessage = ref('')
const notice = ref('')
const portalUrl =
  import.meta.env.VITE_PORTAL_URL ?? 'http://127.0.0.1:5172'
const selectedScheduleId = ref<number | null>(null)
const selectedSubmissionId = ref<number | null>(null)
const isUploadingAssignmentFiles = ref(false)
const isUploadingCoursewareFiles = ref(false)
const downloadingFileId = ref<number | null>(null)
const publishMode = ref<'assignment' | 'courseware'>('assignment')

const attendanceDrafts = ref<AttendanceDraft[]>([])
const gradeDrafts = reactive<Record<number, GradeDraft>>({})

const assignmentDraft = reactive({
  title: '',
  description: '',
  dueAt: '',
  allowLate: false,
  attachments: [] as FileSummary[],
})

const coursewareDraft = reactive({
  title: '',
  description: '',
  attachments: [] as FileSummary[],
})

const feedbackDraft = reactive({
  studentId: 0,
  performance: '',
  strengths: '',
  improvements: '',
  suggestion: '',
})

const scheduleChangeDraft = reactive({
  proposedDate: '',
  proposedStartTime: '',
  proposedEndTime: '',
  reason: '',
})

const visibleSchedules = computed(() => overview.value?.schedules ?? [])
const attendanceRecords = computed(() => overview.value?.attendance ?? [])
const scheduleChanges = computed(() => overview.value?.scheduleChanges ?? [])
const assignments = computed(() => overview.value?.assignments ?? [])
const courseware = computed(() => overview.value?.courseware ?? [])
const submissions = computed(() => overview.value?.submissions ?? [])

const selectedSchedule = computed(
  () =>
    visibleSchedules.value.find(
      (schedule) => schedule.id === selectedScheduleId.value,
    ) ?? null,
)

const selectedStudents = computed(() => {
  const schedule = selectedSchedule.value
  if (!schedule) return []
  return (overview.value?.students ?? []).filter(
    (student) => student.classId === schedule.classId,
  )
})

const roleName = computed(() =>
  currentUser.value ? teacherRoleName(currentUser.value.role) : '',
)
const ownScheduleCount = computed(() => {
  const userId = currentUser.value?.id
  return userId === undefined
    ? 0
    : visibleSchedules.value.filter((item) => item.teacherId === userId).length
})
const scopeDescription = computed(() => {
  const user = currentUser.value
  if (!user) return ''
  return canUseHomeroomScope(user)
    ? '可查看负责班级；教学写操作仍限本人授课'
    : '仅显示并操作本人授课课次'
})

const recordedStudentIds = computed(
  () =>
    new Set(
      attendanceRecords.value
        .filter((item) => item.scheduleId === selectedScheduleId.value)
        .map((item) => item.studentId),
    ),
)
const currentScheduleLeaveRequests = computed(() => {
  const schedule = selectedSchedule.value
  if (!overview.value || !schedule) return []
  return overview.value.leaveRequests.filter(
    (leaveRequest) => leaveRequest.scheduleId === schedule.id,
  )
})

function getStudentLeave(studentId: number) {
  const scheduleId = selectedScheduleId.value
  if (scheduleId === null) return undefined
  return visibleLeaveForStudent(
    currentScheduleLeaveRequests.value,
    scheduleId,
    studentId,
  )
}

const selectedScheduleCancelled = computed(() =>
  isScheduleCancelled(selectedSchedule.value),
)
watch(selectedScheduleId, () => {
  resetScheduleScopedDrafts({
    assignment: assignmentDraft,
    feedback: feedbackDraft,
    scheduleChange: scheduleChangeDraft,
  })
  coursewareDraft.title = ''
  coursewareDraft.description = ''
  coursewareDraft.attachments.splice(0)
})
const unrecordedAttendanceCount = computed(
  () =>
    selectedStudents.value.filter(
      (student) => !recordedStudentIds.value.has(student.id),
    ).length,
)

const ownAssignmentIds = computed(() => {
  const userId = currentUser.value?.id
  return new Set(
    assignments.value
      .filter((item) => item.teacherId === userId)
      .map((item) => item.id),
  )
})

const visibleSubmissions = computed(() =>
  submissions.value.filter((item) => ownAssignmentIds.value.has(item.assignmentId)),
)
const selectedSubmission = computed(
  () =>
    visibleSubmissions.value.find(
      (item) => item.id === selectedSubmissionId.value,
    ) ?? null,
)

function courseName(courseId: number): string {
  return overview.value?.courses.find((item) => item.id === courseId)?.name ?? `课程 #${courseId}`
}

function className(classId: number): string {
  return overview.value?.classes.find((item) => item.id === classId)?.name ?? `班级 #${classId}`
}

function studentName(studentId: number): string {
  return overview.value?.students.find((student) => student.id === studentId)?.displayName ?? `学生 #${studentId}`
}

function assignmentTitle(assignmentId: number): string {
  return assignments.value.find((item) => item.id === assignmentId)?.title ?? `作业 #${assignmentId}`
}

function assignmentFor(assignmentId: number) {
  return assignments.value.find((item) => item.id === assignmentId)
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value))
}

function formatBytes(byteSize: number): string {
  return byteSize < 1024 * 1024
    ? `${Math.max(1, Math.ceil(byteSize / 1024))} KB`
    : `${(byteSize / 1024 / 1024).toFixed(1)} MB`
}

async function handleAssignmentFiles(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  if (files.length === 0) return
  isUploadingAssignmentFiles.value = true
  notice.value = ''
  try {
    const uploaded: FileSummary[] = []
    for (const file of files) {
      uploaded.push(
        await teacherBusinessClient.uploadFile(
          file,
          validateTeacherAttachment(file),
        ),
      )
    }
    assignmentDraft.attachments.push(...uploaded)
    notice.value = `已上传 ${uploaded.length} 个作业附件`
  } catch (error) {
    handleBusinessError(error, '作业附件上传失败')
  } finally {
    isUploadingAssignmentFiles.value = false
    input.value = ''
  }
}

function removeAssignmentFile(fileId: number): void {
  const index = assignmentDraft.attachments.findIndex((item) => item.id === fileId)
  if (index >= 0) assignmentDraft.attachments.splice(index, 1)
}

async function handleCoursewareFiles(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  if (files.length === 0) return
  isUploadingCoursewareFiles.value = true
  notice.value = ''
  try {
    const uploaded: FileSummary[] = []
    for (const file of files) {
      uploaded.push(
        await teacherBusinessClient.uploadFile(
          file,
          validateTeacherAttachment(file),
        ),
      )
    }
    coursewareDraft.attachments.push(...uploaded)
    notice.value = `已上传 ${uploaded.length} 个课件附件`
  } catch (error) {
    handleBusinessError(error, '课件附件上传失败')
  } finally {
    isUploadingCoursewareFiles.value = false
    input.value = ''
  }
}

function removeCoursewareFile(fileId: number): void {
  const index = coursewareDraft.attachments.findIndex(
    (item) => item.id === fileId,
  )
  if (index >= 0) coursewareDraft.attachments.splice(index, 1)
}

async function downloadAttachment(file: FileSummary): Promise<void> {
  if (downloadingFileId.value !== null) return
  downloadingFileId.value = file.id
  notice.value = ''
  try {
    saveTeacherDownload(
      await teacherBusinessClient.downloadFile(file.id),
      file.originalName,
    )
    notice.value = `已开始下载：${file.originalName}`
  } catch (error) {
    handleBusinessError(error, '附件下载失败')
  } finally {
    downloadingFileId.value = null
  }
}

function resetGradeDrafts(): void {
  for (const key of Object.keys(gradeDrafts)) delete gradeDrafts[Number(key)]
  for (const item of visibleSubmissions.value) {
    gradeDrafts[item.id] = {
      score: item.score ?? null,
      teacherComment: item.teacherComment,
      correctionRequired: item.status === 'REVISION_REQUIRED',
    }
  }
}

function resetAttendanceDrafts(): void {
  const scheduleId = selectedScheduleId.value
  attendanceDrafts.value = scheduleId === null
    ? []
    : buildAttendanceDrafts({
        students: selectedStudents.value,
        scheduleId,
        attendance: attendanceRecords.value,
        leaveRequests: currentScheduleLeaveRequests.value,
      })
  if (!selectedStudents.value.some((student) => student.id === feedbackDraft.studentId)) {
    feedbackDraft.studentId = selectedStudents.value[0]?.id ?? 0
  }
}

function selectDefaultSchedule(): void {
  const userId = currentUser.value?.id
  selectedScheduleId.value =
    visibleSchedules.value.find((item) => item.teacherId === userId)?.id ??
    visibleSchedules.value[0]?.id ??
    null
  resetAttendanceDrafts()
}

function applyOverview(value: TeacherOverview): void {
  overview.value = value
  if (!value.schedules.some((item) => item.id === selectedScheduleId.value)) {
    selectDefaultSchedule()
  } else {
    resetAttendanceDrafts()
  }
  resetGradeDrafts()
}

function goTo(page: PageKey): void {
  activePage.value = page
  notice.value = ''
}

function selectSchedule(scheduleId: number, page: PageKey): void {
  selectedScheduleId.value = scheduleId
  resetAttendanceDrafts()
  goTo(page)
}

function handleBusinessError(error: unknown, fallback: string): void {
  if (error instanceof TeacherBusinessError && error.status === 401) {
    currentUser.value = null
    overview.value = null
    selectedScheduleId.value = null
    authMessage.value = '登录已失效，请重新登录'
    return
  }
  notice.value = error instanceof Error ? error.message : fallback
}

async function loadOverview(): Promise<void> {
  isOverviewLoading.value = true
  overviewLoadError.value = ''
  try {
    applyOverview(await teacherBusinessClient.loadOverview())
  } catch (error) {
    const failure = resolveTeacherOverviewLoadFailure(error)
    if (failure.sessionExpired) {
      currentUser.value = null
      overview.value = null
      selectedScheduleId.value = null
      authMessage.value = failure.authMessage
      return
    }
    overviewLoadError.value = failure.overviewLoadError
    notice.value = failure.notice
  } finally {
    isOverviewLoading.value = false
  }
}

async function login(): Promise<void> {
  if (!username.value.trim() || !password.value) {
    authMessage.value = '账号和密码不能为空'
    return
  }
  isAuthenticating.value = true
  authMessage.value = ''
  try {
    currentUser.value = await teacherAuthClient.login(username.value.trim(), password.value)
    activePage.value = 'today'
    notice.value = `已使用 ${currentUser.value.displayName} 的账号登录`
    await loadOverview()
  } catch (error) {
    authMessage.value = error instanceof Error ? error.message : '登录失败'
  } finally {
    isAuthenticating.value = false
  }
}

async function logout(): Promise<void> {
  let message = '已退出教师端'
  try {
    await teacherAuthClient.logout()
  } catch (error) {
    message = error instanceof Error
      ? `退出接口失败，本地会话已清除：${error.message}`
      : '退出接口失败，本地会话已清除'
  } finally {
    currentUser.value = null
    overview.value = null
    selectedScheduleId.value = null
    attendanceDrafts.value = []
    notice.value = ''
    password.value = ''
    authMessage.value = message
  }
}

function requireWritableSchedule(): ScheduleSummary {
  const user = currentUser.value
  const schedule = selectedSchedule.value
  if (!user || !schedule) throw new Error('请先选择课次')
  if (!canWriteSchedule(user, schedule)) {
    throw new Error('班主任只能查看该课次，不能代替任课教师操作')
  }
  assertScheduleActive(schedule)
  return schedule
}

async function saveAttendance(): Promise<void> {
  try {
    const schedule = requireWritableSchedule()
    const records = attendanceDrafts.value.filter((item) => !recordedStudentIds.value.has(item.studentId))
    if (records.length === 0) throw new Error('当前课次没有待保存签到')
    assertApprovedLeavesUseLeave({
      drafts: records,
      leaveRequests: currentScheduleLeaveRequests.value,
      scheduleId: schedule.id,
    })
    pendingAction.value = 'attendance'
    const created = await saveAttendanceAndApply({
      save: () =>
        teacherBusinessClient.saveAttendance({ scheduleId: schedule.id, records }),
      apply: (savedRecords) => overview.value?.attendance.push(...savedRecords),
    })
    resetAttendanceDrafts()
    notice.value = `已保存 ${created.length} 条签到记录`
  } catch (error) {
    handleBusinessError(error, '签到保存失败')
  } finally {
    pendingAction.value = null
  }
}

async function publishAssignment(): Promise<void> {
  try {
    const schedule = requireWritableSchedule()
    pendingAction.value = 'assignment'
    const created = await teacherBusinessClient.publishAssignment(
      assignmentInput(schedule, assignmentDraft),
    )
    if (overview.value) overview.value.assignments.push(created)
    assignmentDraft.title = ''
    assignmentDraft.description = ''
    assignmentDraft.attachments.splice(0)
    notice.value = `作业 #${created.id} 已发布`
  } catch (error) {
    handleBusinessError(error, '作业发布失败')
  } finally {
    pendingAction.value = null
  }
}

async function publishCourseware(): Promise<void> {
  try {
    const schedule = requireWritableSchedule()
    pendingAction.value = 'courseware'
    const created = await teacherBusinessClient.publishCourseware({
      classId: schedule.classId,
      courseId: schedule.courseId,
      title: coursewareDraft.title,
      description: coursewareDraft.description,
      attachments: coursewareDraft.attachments,
    })
    if (overview.value) overview.value.courseware.push(created)
    coursewareDraft.title = ''
    coursewareDraft.description = ''
    coursewareDraft.attachments.splice(0)
    notice.value = `课件 #${created.id} 已发布，学生端已同步`
  } catch (error) {
    handleBusinessError(error, '课件发布失败')
  } finally {
    pendingAction.value = null
  }
}

function replaceSubmission(updated: Submission): void {
  const list = overview.value?.submissions
  if (!list) return
  const index = list.findIndex((item) => item.id === updated.id)
  if (index >= 0) list[index] = updated
}

async function saveGrade(item: Submission): Promise<void> {
  const draft = gradeDrafts[item.id]
  try {
    if (!draft) throw new Error('批改表单不存在')
    pendingAction.value = `grade-${item.id}`
    const updated = await teacherBusinessClient.gradeSubmission(
      item.id,
      gradeInput(draft),
    )
    replaceSubmission(updated)
    gradeDrafts[item.id] = {
      score: updated.score ?? null,
      teacherComment: updated.teacherComment,
      correctionRequired: updated.status === 'REVISION_REQUIRED',
    }
    notice.value = `提交 #${updated.id} 已完成批改`
  } catch (error) {
    handleBusinessError(error, '批改保存失败')
  } finally {
    pendingAction.value = null
  }
}

async function sendFeedback(): Promise<void> {
  try {
    const schedule = requireWritableSchedule()
    pendingAction.value = 'feedback'
    const created = await teacherBusinessClient.sendFeedback(
      feedbackInput(schedule.id, feedbackDraft),
    )
    if (overview.value) overview.value.feedback.push(created)
    notice.value = `反馈 #${created.id} 已发送给家长`
  } catch (error) {
    handleBusinessError(error, '反馈发送失败')
  } finally {
    pendingAction.value = null
  }
}

async function submitScheduleChange(): Promise<void> {
  try {
    const schedule = requireWritableSchedule()
    pendingAction.value = 'schedule-change'
    const created = await teacherBusinessClient.requestScheduleChange(
      scheduleChangeInput(schedule.id, scheduleChangeDraft),
    )
    if (overview.value) overview.value.scheduleChanges.push(created)
    notice.value = `调课申请 #${created.id} 已提交，状态：${getBusinessStatusLabel(created.status)}`
  } catch (error) {
    handleBusinessError(error, '调课申请提交失败')
  } finally {
    pendingAction.value = null
  }
}

onMounted(async () => {
  try {
    currentUser.value = await teacherAuthClient.restoreCurrentUser()
    if (currentUser.value) {
      notice.value = `已恢复 ${currentUser.value.displayName} 的登录状态`
      await loadOverview()
    } else {
      authMessage.value = '请使用教师或班主任账号登录'
    }
  } catch (error) {
    authMessage.value = error instanceof Error ? error.message : '会话恢复失败'
  } finally {
    isRestoringSession.value = false
  }
})
</script>

<template>
  <main v-if="isRestoringSession" class="auth-page">
    <section class="auth-card"><h1>正在恢复教师会话</h1><p>正在验证已保存的登录状态。</p></section>
  </main>

  <main v-else-if="!currentUser" class="auth-page">
    <section class="auth-card">
      <p class="eyebrow">教师工作空间</p>
      <h1>K12 教师登录</h1>
      <p class="muted">请使用任课教师或班主任账号登录。</p>
      <form class="auth-form" @submit.prevent="login">
        <label><span>账号</span><input v-model="username" autocomplete="username" /></label>
        <label><span>密码</span><input v-model="password" type="password" autocomplete="current-password" /></label>
        <p v-if="authMessage" class="auth-message" role="status">{{ authMessage }}</p>
        <button class="primary" type="submit" :disabled="isAuthenticating">{{ isAuthenticating ? '登录中…' : '登录' }}</button>
      </form>
      <a class="portal-return-link" :href="portalUrl">← 返回统一首页</a>
    </section>
  </main>

  <div v-else class="app-shell">
    <aside class="sidebar">
      <div class="brand"><span class="brand-mark">K</span><div><strong>K12 教学台</strong><small>教师 / 班主任端</small></div></div>
      <nav aria-label="教师端页面">
        <button v-for="page in pages" :key="page.key" class="nav-item" :class="{ active: activePage === page.key }" type="button" @click="goTo(page.key)">
          <span class="nav-dot" aria-hidden="true"></span><span>{{ page.label }}</span>
        </button>
      </nav>
      <div class="scope-card">
        <span>当前数据范围</span><strong>{{ roleName }}</strong><p>{{ scopeDescription }}</p>
        <button class="logout-button" type="button" @click="logout">退出登录</button>
      </div>
    </aside>

    <main class="workspace">
      <header class="topbar">
        <div><p class="eyebrow">{{ currentUser.campusName }}</p><h1>{{ pages.find((page) => page.key === activePage)?.label }}</h1></div>
        <div class="user-card"><strong>{{ currentUser.displayName }}</strong><span>{{ roleName }} · ID {{ currentUser.id }}</span></div>
      </header>

      <div v-if="notice" class="notice" role="status">{{ notice }}</div>

      <section v-if="isOverviewLoading" class="panel empty-state">
        <h2>正在加载教师业务数据</h2><p class="muted">正在读取课表、学生、作业、签到和调课信息。</p>
      </section>
      <section v-else-if="overviewLoadError && !overview" class="panel empty-state">
        <h2>教师业务数据加载失败</h2><p class="muted">{{ overviewLoadError }}</p>
        <button class="primary" type="button" @click="loadOverview">重新加载</button>
      </section>

      <template v-else-if="overview">
        <template v-if="activePage === 'today'">
          <section class="summary-grid" aria-label="今日概览">
            <article><span>可见课程</span><strong>{{ visibleSchedules.length }}</strong><small>按当前身份显示</small></article>
            <article><span>本人授课</span><strong>{{ ownScheduleCount }}</strong><small>可执行教学写操作</small></article>
            <article><span>签到记录</span><strong>{{ attendanceRecords.length }}</strong><small>记录已同步</small></article>
            <article><span>调课申请</span><strong>{{ scheduleChanges.length }}</strong><small>实时处理状态</small></article>
          </section>
          <section class="panel">
            <div class="section-heading"><div><p class="eyebrow">课程日程</p><h2>可见课次</h2></div><button class="secondary" type="button" @click="loadOverview">刷新数据</button></div>
            <p v-if="visibleSchedules.length === 0" class="muted empty-state">当前没有可见课次。</p>
            <div v-else class="course-list">
              <article v-for="schedule in visibleSchedules" :key="schedule.id" class="course-card">
                <time>{{ schedule.lessonDate }}<br />{{ schedule.startTime.slice(0, 5) }}–{{ schedule.endTime.slice(0, 5) }}</time>
                <div class="course-main"><h3>{{ courseName(schedule.courseId) }}</h3><p>{{ className(schedule.classId) }} · {{ schedule.room }} · 课次 #{{ schedule.id }}</p></div>
                <span class="status">{{ schedule.status === 'CANCELLED' ? '课次已取消' : schedule.teacherId === currentUser.id ? '本人授课' : '班主任可见' }}</span>
                <div class="card-actions">
                  <button class="secondary" type="button" :disabled="!canWriteSchedule(currentUser, schedule) || schedule.status === 'CANCELLED'" @click="selectSchedule(schedule.id, 'schedule-change')">申请调课</button>
                  <button class="primary" type="button" :disabled="!canWriteSchedule(currentUser, schedule) || schedule.status === 'CANCELLED'" @click="selectSchedule(schedule.id, 'attendance')">进入签到</button>
                </div>
              </article>
            </div>
          </section>
        </template>

        <section v-else-if="activePage === 'attendance'" class="panel">
          <div class="section-heading"><div><p class="eyebrow">课次 #{{ selectedSchedule?.id ?? '—' }}</p><h2>{{ selectedSchedule ? className(selectedSchedule.classId) : '请先选择课次' }}课堂签到</h2></div><span class="status">{{ selectedStudents.length }} 名学生</span></div>
          <p v-if="selectedStudents.length === 0" class="muted empty-state">当前课次没有可签到学生。</p>
          <div v-else class="table-wrap">
            <table><thead><tr><th>学生</th><th>签到状态</th><th>备注</th></tr></thead>
              <tbody>
                <tr v-for="draft in attendanceDrafts" :key="draft.studentId">
                  <td>
                    <strong>{{ studentName(draft.studentId) }}</strong>
                    <small>ID {{ draft.studentId }}</small>
                    <span
                      v-if="getStudentLeave(draft.studentId)"
                      class="leave-badge"
                      :class="`leave-${getStudentLeave(draft.studentId)!.status.toLowerCase()}`"
                    >{{ leaveBadgeText(getStudentLeave(draft.studentId)!) }}</span>
                  </td>
                  <td>
                    <select
                      v-model="draft.status"
                      :disabled="recordedStudentIds.has(draft.studentId) || getStudentLeave(draft.studentId)?.status === 'APPROVED' || selectedScheduleCancelled"
                    >
                      <option v-for="status in attendanceStatuses" :key="status" :value="status">{{ getBusinessStatusLabel(status) }}</option>
                    </select>
                  </td>
                  <td>
                    <input
                      v-model="draft.note"
                      :disabled="recordedStudentIds.has(draft.studentId) || getStudentLeave(draft.studentId)?.status === 'APPROVED' || selectedScheduleCancelled"
                      placeholder="可选备注"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="panel-footer"><p class="muted">已批准请假的学生固定显示为“请假”；已保存学生将被锁定。</p><button class="primary" type="button" :disabled="pendingAction !== null || unrecordedAttendanceCount === 0 || selectedScheduleCancelled" @click="saveAttendance">{{ pendingAction === 'attendance' ? '保存中…' : '保存签到' }}</button></div>
        </section>

        <section v-else-if="activePage === 'publish'" class="panel">
          <div class="section-heading"><div><p class="eyebrow">教学内容管理</p><h2>{{ publishMode === 'assignment' ? '新建作业' : '发布课件' }}</h2></div><span class="status">发布后网页、APP 与小程序同步</span></div>
          <div class="publish-tabs" role="tablist" aria-label="教学发布类型">
            <button type="button" :class="{ active: publishMode === 'assignment' }" @click="publishMode = 'assignment'">发布作业</button>
            <button type="button" :class="{ active: publishMode === 'courseware' }" @click="publishMode = 'courseware'">发布课件</button>
          </div>
          <form v-if="publishMode === 'assignment'" class="form-grid" @submit.prevent="publishAssignment">
            <label class="full"><span>当前课次</span><input :value="selectedSchedule ? `${className(selectedSchedule.classId)} · ${courseName(selectedSchedule.courseId)} · #${selectedSchedule.id}` : '请先选择课次'" readonly /></label>
            <label class="full"><span>作业标题</span><input v-model="assignmentDraft.title" required /></label>
            <label class="full"><span>作业内容</span><textarea v-model="assignmentDraft.description" rows="4" required></textarea></label>
            <label class="full attachment-upload"><span>作业附件</span><input type="file" multiple accept=".pdf,.docx,.jpg,.jpeg,.png" :disabled="isUploadingAssignmentFiles" @change="handleAssignmentFiles" /><small>{{ isUploadingAssignmentFiles ? '附件上传中…' : '支持 PDF、DOCX、JPG、PNG，单个文件不超过 10 MB' }}</small></label>
            <div v-if="assignmentDraft.attachments.length" class="full uploaded-files"><div v-for="file in assignmentDraft.attachments" :key="file.id"><span><strong>{{ file.originalName }}</strong><small>{{ formatBytes(file.byteSize) }}</small></span><button class="secondary" type="button" :disabled="pendingAction !== null" @click="removeAssignmentFile(file.id)">移除</button></div></div>
            <label><span>截止时间</span><input v-model="assignmentDraft.dueAt" type="datetime-local" required /></label>
            <label class="check-field"><input v-model="assignmentDraft.allowLate" type="checkbox" /><span>允许截止后提交</span></label>
            <div class="full form-actions"><button class="primary" type="submit" :disabled="pendingAction !== null || isUploadingAssignmentFiles || selectedScheduleCancelled">{{ pendingAction === 'assignment' ? '发布中…' : isUploadingAssignmentFiles ? '等待附件上传' : '发布作业' }}</button></div>
          </form>
          <form v-else class="form-grid" @submit.prevent="publishCourseware">
            <label class="full"><span>当前课程</span><input :value="selectedSchedule ? `${className(selectedSchedule.classId)} · ${courseName(selectedSchedule.courseId)} · #${selectedSchedule.id}` : '请先选择课次'" readonly /></label>
            <label class="full"><span>课件标题</span><input v-model="coursewareDraft.title" required /></label>
            <label class="full"><span>课件说明</span><textarea v-model="coursewareDraft.description" rows="4" required></textarea></label>
            <label class="full attachment-upload"><span>课件附件</span><input type="file" multiple accept=".pdf,.docx,.jpg,.jpeg,.png" :disabled="isUploadingCoursewareFiles" @change="handleCoursewareFiles" /><small>{{ isUploadingCoursewareFiles ? '附件上传中…' : '支持 PDF、DOCX、JPG、PNG，单个文件不超过 10 MB' }}</small></label>
            <div v-if="coursewareDraft.attachments.length" class="full uploaded-files"><div v-for="file in coursewareDraft.attachments" :key="file.id"><span><strong>{{ file.originalName }}</strong><small>{{ formatBytes(file.byteSize) }}</small></span><button class="secondary" type="button" :disabled="pendingAction !== null" @click="removeCoursewareFile(file.id)">移除</button></div></div>
            <div class="full form-actions"><button class="primary" type="submit" :disabled="pendingAction !== null || isUploadingCoursewareFiles || selectedScheduleCancelled">{{ pendingAction === 'courseware' ? '发布中…' : isUploadingCoursewareFiles ? '等待附件上传' : '发布课件' }}</button></div>
            <div v-if="courseware.length" class="full published-materials"><strong>已发布课件</strong><span v-for="material in courseware.filter((item) => item.teacherId === currentUser?.id).slice(-4).reverse()" :key="material.id">#{{ material.id }} · {{ material.title }} · {{ material.attachments.length }} 个附件</span></div>
          </form>
        </section>

        <section v-else-if="activePage === 'grading'" class="panel">
          <div class="section-heading"><div><p class="eyebrow">学生提交记录</p><h2>学生提交与批改</h2></div><span class="status">{{ visibleSubmissions.length }} 份提交</span></div>
          <p v-if="visibleSubmissions.length === 0" class="muted empty-state">当前没有可批改提交。</p>
          <div v-else class="table-wrap"><table><thead><tr><th>作业 / 学生</th><th>分数与评语</th><th>订正</th><th>操作</th></tr></thead>
            <tbody><tr v-for="item in visibleSubmissions" :key="item.id">
              <td><button class="submission-link" type="button" @click="selectedSubmissionId = item.id">{{ assignmentTitle(item.assignmentId) }}</button><small>{{ studentName(item.studentId) }} · 第 {{ item.attempt }} 次提交 · {{ getBusinessStatusLabel(item.status) }}</small></td>
              <td><input v-model.number="gradeDrafts[item.id]!.score" class="score-input" type="number" min="0" max="100" :disabled="item.status !== 'SUBMITTED'" /><input v-model="gradeDrafts[item.id]!.teacherComment" placeholder="教师评语" :disabled="item.status !== 'SUBMITTED'" /></td>
              <td><label class="inline-check"><input v-model="gradeDrafts[item.id]!.correctionRequired" type="checkbox" :disabled="item.status !== 'SUBMITTED'" />需要订正</label></td>
              <td><div class="grade-actions"><button class="secondary" type="button" @click="selectedSubmissionId = item.id">查看详情</button><button class="primary" type="button" :disabled="item.status !== 'SUBMITTED' || pendingAction !== null" @click="saveGrade(item)">{{ pendingAction === `grade-${item.id}` ? '保存中…' : '保存批改' }}</button></div></td>
            </tr></tbody>
          </table></div>
        </section>

        <section v-else-if="activePage === 'feedback'" class="panel">
          <div class="section-heading"><div><p class="eyebrow">课后家校沟通</p><h2>发送学生反馈</h2></div><span class="status">待家长确认</span></div>
          <form class="form-grid" @submit.prevent="sendFeedback">
            <label><span>课次</span><input :value="selectedSchedule?.id ?? ''" readonly /></label>
            <label><span>学生</span><select v-model.number="feedbackDraft.studentId"><option v-for="student in selectedStudents" :key="student.id" :value="student.id">{{ student.displayName }} · {{ student.id }}</option></select></label>
            <label class="full"><span>课堂表现</span><textarea v-model="feedbackDraft.performance" rows="2" required></textarea></label>
            <label><span>优点</span><textarea v-model="feedbackDraft.strengths" rows="3" required></textarea></label>
            <label><span>待提升</span><textarea v-model="feedbackDraft.improvements" rows="3" required></textarea></label>
            <label class="full"><span>学习建议</span><textarea v-model="feedbackDraft.suggestion" rows="3" required></textarea></label>
            <div class="full form-actions"><button class="primary" type="submit" :disabled="pendingAction !== null || selectedStudents.length === 0 || selectedScheduleCancelled">{{ pendingAction === 'feedback' ? '发送中…' : '发送给家长' }}</button></div>
          </form>
        </section>

        <section v-else class="panel">
          <div class="section-heading"><div><p class="eyebrow">课次 #{{ selectedSchedule?.id ?? '—' }}</p><h2>提交调课申请</h2></div><span class="status">提交后由教务审批</span></div>
          <form class="form-grid" @submit.prevent="submitScheduleChange">
            <label class="full"><span>课程</span><input :value="selectedSchedule ? `${className(selectedSchedule.classId)} · ${courseName(selectedSchedule.courseId)} · ${selectedSchedule.room}` : '请先选择课次'" readonly /></label>
            <label><span>申请日期</span><input v-model="scheduleChangeDraft.proposedDate" type="date" required /></label>
            <div class="time-fields"><label><span>开始时间</span><input v-model="scheduleChangeDraft.proposedStartTime" type="time" required /></label><label><span>结束时间</span><input v-model="scheduleChangeDraft.proposedEndTime" type="time" required /></label></div>
            <label class="full"><span>调课原因</span><textarea v-model="scheduleChangeDraft.reason" rows="4" required></textarea></label>
            <div class="full form-actions"><button class="primary" type="submit" :disabled="pendingAction !== null || selectedScheduleCancelled">{{ pendingAction === 'schedule-change' ? '提交中…' : '提交调课申请' }}</button></div>
          </form>
          <div v-if="scheduleChanges.length" class="request-list"><article v-for="item in scheduleChanges" :key="item.id"><strong>申请 #{{ item.id }} · {{ getBusinessStatusLabel(item.status) }}</strong><span>{{ item.proposedDate }} {{ item.proposedStartTime }}–{{ item.proposedEndTime }}</span><small>{{ item.reason }}</small></article></div>
          <p v-else class="muted empty-state">当前没有调课申请。</p>
        </section>
      </template>
    </main>

    <div v-if="selectedSubmission" class="submission-overlay" @click.self="selectedSubmissionId = null">
      <aside class="submission-detail" role="dialog" aria-modal="true" aria-label="学生作业提交详情">
        <button class="detail-close" type="button" aria-label="关闭提交详情" @click="selectedSubmissionId = null">×</button>
        <p class="eyebrow">提交 #{{ selectedSubmission.id }}</p>
        <h2>{{ assignmentTitle(selectedSubmission.assignmentId) }}</h2>
        <dl class="submission-meta">
          <div><dt>学生</dt><dd>{{ studentName(selectedSubmission.studentId) }}</dd></div>
          <div><dt>提交状态</dt><dd>{{ getBusinessStatusLabel(selectedSubmission.status) }}</dd></div>
          <div><dt>提交次数</dt><dd>第 {{ selectedSubmission.attempt }} 次</dd></div>
          <div><dt>提交时间</dt><dd>{{ formatDateTime(selectedSubmission.submittedAt) }}</dd></div>
          <div><dt>作业要求</dt><dd>{{ assignmentFor(selectedSubmission.assignmentId)?.description ?? '暂无' }}</dd></div>
          <div class="full"><dt>学生正文</dt><dd>{{ selectedSubmission.content || '学生未填写正文，请查看附件。' }}</dd></div>
        </dl>
        <section class="detail-files">
          <div class="section-heading"><div><p class="eyebrow">学生提交材料</p><h3>附件</h3></div><span class="status">{{ selectedSubmission.attachments.length }} 个</span></div>
          <p v-if="selectedSubmission.attachments.length === 0" class="muted">本次提交没有附件。</p>
          <div v-else class="uploaded-files"><div v-for="file in selectedSubmission.attachments" :key="file.id"><span><strong>{{ file.originalName }}</strong><small>{{ formatBytes(file.byteSize) }}</small></span><button class="secondary" type="button" :disabled="downloadingFileId !== null" @click="downloadAttachment(file)">{{ downloadingFileId === file.id ? '下载中…' : '下载到本地' }}</button></div></div>
        </section>
      </aside>
    </div>

    <nav class="mobile-nav" aria-label="移动端教师端页面">
      <button v-for="page in pages" :key="page.key" :class="{ active: activePage === page.key }" type="button" @click="goTo(page.key)">{{ page.shortLabel }}</button>
    </nav>
  </div>
</template>
