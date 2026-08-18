<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import type {
  Assignment,
  AttendanceRecord,
  AttendanceStatus,
  ScheduleChange,
  ScheduleSummary,
  StudentFeedback,
  StudentSummary,
  Submission,
} from '@k12/shared'
import { MOCK_ACCOUNT_PASSWORD } from '@k12/shared/mock-accounts'

import { teacherAuthClient } from './authClient'
import {
  canUseHomeroomScope,
  canWriteSchedule,
  teacherRoleName,
  visibleSchedulesForTeacher,
  type TeacherUser,
} from './teacherAccess'
import {
  createAttendanceRecords,
  createScheduleChange,
  type AttendanceDraft,
} from './teacherWorkflow'

type PageKey =
  | 'today'
  | 'attendance'
  | 'publish'
  | 'grading'
  | 'feedback'
  | 'schedule-change'

const pages: Array<{ key: PageKey; label: string; shortLabel: string }> = [
  { key: 'today', label: '今日课程', shortLabel: '课程' },
  { key: 'attendance', label: '课堂签到', shortLabel: '签到' },
  { key: 'publish', label: '发布作业', shortLabel: '作业' },
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

const allSchedules: ScheduleSummary[] = [
  {
    id: 1001,
    campusId: 1,
    classId: 101,
    courseId: 11,
    teacherId: 301,
    lessonDate: '2026-08-19',
    startTime: '09:00:00',
    endTime: '10:30:00',
    room: 'A-302',
    status: 'SCHEDULED',
  },
  {
    id: 1002,
    campusId: 1,
    classId: 102,
    courseId: 12,
    teacherId: 303,
    lessonDate: '2026-08-19',
    startTime: '14:00:00',
    endTime: '15:30:00',
    room: 'B-205',
    status: 'SCHEDULED',
  },
  {
    id: 1003,
    campusId: 1,
    classId: 101,
    courseId: 12,
    teacherId: 302,
    lessonDate: '2026-08-20',
    startTime: '14:00:00',
    endTime: '15:30:00',
    room: 'B-102',
    status: 'SCHEDULED',
  },
  {
    id: 1004,
    campusId: 1,
    classId: 102,
    courseId: 12,
    teacherId: 302,
    lessonDate: '2026-08-20',
    startTime: '16:30:00',
    endTime: '18:00:00',
    room: 'B-203',
    status: 'SCHEDULED',
  },
]

const students: StudentSummary[] = [
  {
    id: 101,
    displayName: '林晓雨',
    classId: 101,
    className: '六年级 1 班',
    campusId: 1,
    campusName: '滨江校区',
  },
  {
    id: 104,
    displayName: '周明轩',
    classId: 101,
    className: '六年级 1 班',
    campusId: 1,
    campusName: '滨江校区',
  },
  {
    id: 102,
    displayName: '林晓晨',
    classId: 102,
    className: '六年级 2 班',
    campusId: 1,
    campusName: '滨江校区',
  },
]

const courseNames = new Map<number, string>([
  [11, '数学提高班'],
  [12, '英语阅读班'],
])
const classNames = new Map<number, string>([
  [101, '六年级 1 班'],
  [102, '六年级 2 班'],
])
const homeroomClassIdsByTeacher = new Map<number, number[]>([[302, [101]]])

const activePage = ref<PageKey>('today')
const currentUser = ref<TeacherUser | null>(null)
const isRestoringSession = ref(true)
const isAuthenticating = ref(false)
const username = ref('teacher_301')
const password = ref(MOCK_ACCOUNT_PASSWORD)
const authMessage = ref('')
const notice = ref('')
const selectedScheduleId = ref<number | null>(null)

const visibleSchedules = computed(() => {
  const user = currentUser.value
  if (!user) return []
  return visibleSchedulesForTeacher(
    user,
    allSchedules,
    homeroomClassIdsByTeacher.get(user.id) ?? [],
  )
})
const selectedSchedule = computed(
  () =>
    visibleSchedules.value.find(
      (schedule) => schedule.id === selectedScheduleId.value,
    ) ?? null,
)
const selectedStudents = computed(() =>
  selectedSchedule.value
    ? students.filter(
        (student) => student.classId === selectedSchedule.value?.classId,
      )
    : [],
)
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

const attendanceDrafts = ref<AttendanceDraft[]>([])
const attendanceRecords = ref<AttendanceRecord[]>([])

const assignment = reactive<Assignment>({
  id: 3001,
  campusId: 1,
  classId: 101,
  courseId: 11,
  scheduleId: 1001,
  teacherId: 301,
  title: '分数乘法巩固练习',
  description: '完成练习册第 18—20 页，写出计算过程。',
  attachments: [],
  dueAt: '2026-08-21T20:00:00+08:00',
  allowLate: false,
  publishedAt: '2026-08-18T09:00:00+08:00',
  createdAt: '2026-08-18T09:00:00+08:00',
  updatedAt: '2026-08-18T09:00:00+08:00',
})
const assignmentDeadline = ref('2026-08-21T20:00')

const submissions = ref<Submission[]>([
  {
    id: 4001,
    assignmentId: 3001,
    studentId: 101,
    attempt: 1,
    content: '已完成全部练习。',
    attachments: [],
    status: 'SUBMITTED',
    submittedAt: '2026-08-18T19:24:00+08:00',
    score: 92,
    teacherComment: '计算过程清晰。',
    gradedBy: 301,
    gradedAt: '2026-08-18T21:00:00+08:00',
    updatedAt: '2026-08-18T21:00:00+08:00',
  },
  {
    id: 4002,
    assignmentId: 3001,
    studentId: 104,
    attempt: 1,
    content: '已提交练习。',
    attachments: [],
    status: 'REVISION_REQUIRED',
    submittedAt: '2026-08-18T20:03:00+08:00',
    score: 78,
    teacherComment: '请订正第 4 题。',
    gradedBy: 301,
    gradedAt: '2026-08-18T21:05:00+08:00',
    updatedAt: '2026-08-18T21:05:00+08:00',
  },
])

const feedbackDraft = reactive({
  studentId: 101,
  performance: '课堂专注，能主动回答问题。',
  strengths: '分数乘法计算准确。',
  improvements: '应用题的单位换算需要更细心。',
  suggestion: '本周复习练习册中的单位换算题。',
})
const feedbackRecords = ref<StudentFeedback[]>([])

const scheduleChangeDraft = reactive({
  proposedDate: '2026-08-22',
  proposedStartTime: '10:00',
  proposedEndTime: '11:30',
  reason: '参加学校教研活动',
})
const scheduleChanges = ref<ScheduleChange[]>([])

function courseName(courseId: number): string {
  return courseNames.get(courseId) ?? `课程 #${courseId}`
}

function className(classId: number): string {
  return classNames.get(classId) ?? `班级 #${classId}`
}

function studentName(studentId: number): string {
  return students.find((student) => student.id === studentId)?.displayName ?? `学生 #${studentId}`
}

function selectDefaultSchedule(): void {
  selectedScheduleId.value = visibleSchedules.value[0]?.id ?? null
  resetAttendanceDrafts()
}

function resetAttendanceDrafts(): void {
  attendanceDrafts.value = selectedStudents.value.map((student) => ({
    studentId: student.id,
    status: 'PRESENT',
    note: '',
  }))
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

async function login(): Promise<void> {
  if (!username.value.trim() || !password.value) {
    authMessage.value = '账号和密码不能为空'
    return
  }

  isAuthenticating.value = true
  authMessage.value = ''
  try {
    currentUser.value = await teacherAuthClient.login(
      username.value.trim(),
      password.value,
    )
    activePage.value = 'today'
    notice.value = `已使用 ${currentUser.value.displayName} 的真实账号登录`
    selectDefaultSchedule()
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
    selectedScheduleId.value = null
    attendanceDrafts.value = []
    notice.value = ''
    password.value = ''
    authMessage.value = message
  }
}

function requireWritableSchedule(): {
  user: TeacherUser
  schedule: ScheduleSummary
} {
  const user = currentUser.value
  const schedule = selectedSchedule.value
  if (!user || !schedule) throw new Error('请先选择课次')
  if (!canWriteSchedule(user, schedule)) {
    throw new Error('班主任只能查看该课次，不能代替任课教师操作')
  }
  return { user, schedule }
}

function saveAttendance(): void {
  try {
    const { user, schedule } = requireWritableSchedule()
    const records = createAttendanceRecords({
      user,
      schedule,
      drafts: attendanceDrafts.value,
      existing: attendanceRecords.value,
      recordedAt: new Date().toISOString(),
    })
    attendanceRecords.value.push(...records)
    notice.value = `已保存 ${records.length} 条签到记录`
  } catch (error) {
    notice.value = error instanceof Error ? error.message : '签到保存失败'
  }
}

function publishAssignment(): void {
  try {
    const { user, schedule } = requireWritableSchedule()
    if (!assignment.title.trim() || !assignment.description.trim()) {
      throw new Error('作业标题和内容不能为空')
    }
    assignment.classId = schedule.classId
    assignment.courseId = schedule.courseId
    assignment.scheduleId = schedule.id
    assignment.teacherId = user.id
    assignment.dueAt = `${assignmentDeadline.value}:00+08:00`
    assignment.updatedAt = new Date().toISOString()
    notice.value = `作业已保存，截止时间 ${assignment.dueAt}`
  } catch (error) {
    notice.value = error instanceof Error ? error.message : '作业保存失败'
  }
}

function saveGrades(): void {
  try {
    const { user } = requireWritableSchedule()
    if (
      submissions.value.some(
        (item) =>
          item.score === null ||
          item.score === undefined ||
          item.score < 0 ||
          item.score > 100,
      )
    ) {
      throw new Error('分数必须在 0 到 100 之间')
    }
    const now = new Date().toISOString()
    submissions.value = submissions.value.map((item) => ({
      ...item,
      status: item.status === 'REVISION_REQUIRED' ? 'REVISION_REQUIRED' : 'GRADED',
      gradedBy: user.id,
      gradedAt: now,
      updatedAt: now,
    }))
    notice.value = '批改结果已保存'
  } catch (error) {
    notice.value = error instanceof Error ? error.message : '批改保存失败'
  }
}

function sendFeedback(): void {
  try {
    const { user, schedule } = requireWritableSchedule()
    if (
      !feedbackDraft.performance.trim() ||
      !feedbackDraft.strengths.trim() ||
      !feedbackDraft.improvements.trim() ||
      !feedbackDraft.suggestion.trim()
    ) {
      throw new Error('课后反馈字段不能为空')
    }
    const now = new Date().toISOString()
    feedbackRecords.value.push({
      id: feedbackRecords.value.length + 1,
      campusId: schedule.campusId,
      scheduleId: schedule.id,
      studentId: feedbackDraft.studentId,
      teacherId: user.id,
      performance: feedbackDraft.performance.trim(),
      strengths: feedbackDraft.strengths.trim(),
      improvements: feedbackDraft.improvements.trim(),
      suggestion: feedbackDraft.suggestion.trim(),
      status: 'PENDING_PARENT',
      parentResponse: '',
      respondedBy: null,
      respondedAt: null,
      sentAt: now,
      updatedAt: now,
    })
    notice.value = '课后反馈已发送给家长'
  } catch (error) {
    notice.value = error instanceof Error ? error.message : '反馈发送失败'
  }
}

function submitScheduleChange(): void {
  try {
    const { user, schedule } = requireWritableSchedule()
    const request = createScheduleChange({
      user,
      schedule,
      draft: scheduleChangeDraft,
      existing: scheduleChanges.value,
      createdAt: new Date().toISOString(),
    })
    scheduleChanges.value.push(request)
    notice.value = `调课申请 #${request.id} 已提交，状态：${request.status}`
  } catch (error) {
    notice.value = error instanceof Error ? error.message : '调课申请提交失败'
  }
}

onMounted(async () => {
  try {
    currentUser.value = await teacherAuthClient.restoreCurrentUser()
    if (currentUser.value) {
      notice.value = `已恢复 ${currentUser.value.displayName} 的登录状态`
      selectDefaultSchedule()
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
      <p class="eyebrow">真实认证</p>
      <h1>K12 教师登录</h1>
      <p class="muted">任课教师 teacher_301，班主任 teacher_302。</p>
      <form class="auth-form" @submit.prevent="login">
        <label><span>账号</span><input v-model="username" autocomplete="username" /></label>
        <label><span>密码</span><input v-model="password" type="password" autocomplete="current-password" /></label>
        <p v-if="authMessage" class="auth-message" role="status">{{ authMessage }}</p>
        <button class="primary" type="submit" :disabled="isAuthenticating">
          {{ isAuthenticating ? '登录中…' : '登录' }}
        </button>
      </form>
    </section>
  </main>

  <div v-else class="app-shell">
    <aside class="sidebar">
      <div class="brand">
        <span class="brand-mark">K</span>
        <div><strong>K12 教学台</strong><small>教师 / 班主任端</small></div>
      </div>

      <nav aria-label="教师端页面">
        <button
          v-for="page in pages"
          :key="page.key"
          class="nav-item"
          :class="{ active: activePage === page.key }"
          type="button"
          @click="goTo(page.key)"
        >
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

      <template v-if="activePage === 'today'">
        <section class="summary-grid" aria-label="今日概览">
          <article><span>可见课程</span><strong>{{ visibleSchedules.length }}</strong><small>按真实角色范围过滤</small></article>
          <article><span>本人授课</span><strong>{{ ownScheduleCount }}</strong><small>可执行教学写操作</small></article>
          <article><span>签到记录</span><strong>{{ attendanceRecords.length }}</strong><small>数字学生 ID</small></article>
          <article><span>调课申请</span><strong>{{ scheduleChanges.length }}</strong><small>可查看处理状态</small></article>
        </section>

        <section class="panel">
          <div class="section-heading"><div><p class="eyebrow">课程日程</p><h2>可见课次</h2></div><span class="mock-tag">业务 Mock · 认证真实</span></div>
          <div class="course-list">
            <article v-for="schedule in visibleSchedules" :key="schedule.id" class="course-card">
              <time>{{ schedule.lessonDate }}<br />{{ schedule.startTime.slice(0, 5) }}–{{ schedule.endTime.slice(0, 5) }}</time>
              <div class="course-main"><h3>{{ courseName(schedule.courseId) }}</h3><p>{{ className(schedule.classId) }} · {{ schedule.room }} · 课次 #{{ schedule.id }}</p></div>
              <span class="status">{{ schedule.teacherId === currentUser.id ? '本人授课' : '班主任可见' }}</span>
              <div class="card-actions">
                <button class="secondary" type="button" :disabled="!canWriteSchedule(currentUser, schedule)" @click="selectSchedule(schedule.id, 'schedule-change')">申请调课</button>
                <button class="primary" type="button" :disabled="!canWriteSchedule(currentUser, schedule)" @click="selectSchedule(schedule.id, 'attendance')">进入签到</button>
              </div>
            </article>
          </div>
        </section>
      </template>

      <section v-else-if="activePage === 'attendance'" class="panel">
        <div class="section-heading"><div><p class="eyebrow">课次 #{{ selectedSchedule?.id ?? '—' }}</p><h2>{{ selectedSchedule ? className(selectedSchedule.classId) : '请先选择课次' }}课堂签到</h2></div><span class="status">{{ selectedStudents.length }} 名学生</span></div>
        <div class="table-wrap">
          <table><thead><tr><th>学生</th><th>签到状态</th><th>备注</th></tr></thead>
            <tbody><tr v-for="draft in attendanceDrafts" :key="draft.studentId">
              <td><strong>{{ studentName(draft.studentId) }}</strong><small>ID {{ draft.studentId }}</small></td>
              <td><select v-model="draft.status"><option v-for="status in attendanceStatuses" :key="status" :value="status">{{ status }}</option></select></td>
              <td><input v-model="draft.note" placeholder="可选备注" /></td>
            </tr></tbody>
          </table>
        </div>
        <div class="panel-footer"><p class="muted">同一课次、同一学生不能重复签到。</p><button class="primary" type="button" @click="saveAttendance">保存签到</button></div>
      </section>

      <section v-else-if="activePage === 'publish'" class="panel">
        <div class="section-heading"><div><p class="eyebrow">教师发布</p><h2>新建作业</h2></div><span class="status">公共 Assignment</span></div>
        <form class="form-grid" @submit.prevent="publishAssignment">
          <label class="full"><span>当前课次</span><input :value="selectedSchedule ? `${className(selectedSchedule.classId)} · ${courseName(selectedSchedule.courseId)} · #${selectedSchedule.id}` : '请先选择课次'" readonly /></label>
          <label class="full"><span>作业标题</span><input v-model="assignment.title" required /></label>
          <label class="full"><span>作业内容</span><textarea v-model="assignment.description" rows="4" required></textarea></label>
          <label><span>截止时间</span><input v-model="assignmentDeadline" type="datetime-local" required /></label>
          <label class="check-field"><input v-model="assignment.allowLate" type="checkbox" /><span>允许截止后提交</span></label>
          <div class="full form-actions"><button class="primary" type="submit">保存作业</button></div>
        </form>
      </section>

      <section v-else-if="activePage === 'grading'" class="panel">
        <div class="section-heading"><div><p class="eyebrow">作业 #{{ assignment.id }}</p><h2>学生提交与批改</h2></div><span class="status">{{ submissions.length }} 份提交</span></div>
        <div class="table-wrap"><table><thead><tr><th>学生</th><th>提交时间</th><th>分数</th><th>状态</th></tr></thead>
          <tbody><tr v-for="item in submissions" :key="item.id"><td><strong>{{ studentName(item.studentId) }}</strong><small>ID {{ item.studentId }}</small></td><td>{{ item.submittedAt }}</td><td><input v-model.number="item.score" class="score-input" type="number" min="0" max="100" /></td><td>{{ item.status }}</td></tr></tbody>
        </table></div>
        <div class="panel-footer"><p class="muted">评语和订正状态保留在公共 Submission 字段。</p><button class="primary" type="button" @click="saveGrades">保存批改</button></div>
      </section>

      <section v-else-if="activePage === 'feedback'" class="panel">
        <div class="section-heading"><div><p class="eyebrow">课后家校沟通</p><h2>发送学生反馈</h2></div><span class="status">PENDING_PARENT</span></div>
        <form class="form-grid" @submit.prevent="sendFeedback">
          <label><span>课次</span><input :value="selectedSchedule?.id ?? ''" readonly /></label>
          <label><span>学生</span><select v-model.number="feedbackDraft.studentId"><option v-for="student in selectedStudents" :key="student.id" :value="student.id">{{ student.displayName }} · {{ student.id }}</option></select></label>
          <label class="full"><span>课堂表现</span><textarea v-model="feedbackDraft.performance" rows="2" required></textarea></label>
          <label><span>优点</span><textarea v-model="feedbackDraft.strengths" rows="3" required></textarea></label>
          <label><span>待提升</span><textarea v-model="feedbackDraft.improvements" rows="3" required></textarea></label>
          <label class="full"><span>学习建议</span><textarea v-model="feedbackDraft.suggestion" rows="3" required></textarea></label>
          <div class="full form-actions"><button class="primary" type="submit">发送给家长</button></div>
        </form>
      </section>

      <section v-else class="panel">
        <div class="section-heading"><div><p class="eyebrow">课次 #{{ selectedSchedule?.id ?? '—' }}</p><h2>提交调课申请</h2></div><span class="status">公共 ScheduleChange</span></div>
        <form class="form-grid" @submit.prevent="submitScheduleChange">
          <label class="full"><span>课程</span><input :value="selectedSchedule ? `${className(selectedSchedule.classId)} · ${courseName(selectedSchedule.courseId)} · ${selectedSchedule.room}` : '请先选择课次'" readonly /></label>
          <label><span>申请日期</span><input v-model="scheduleChangeDraft.proposedDate" type="date" required /></label>
          <div class="time-fields"><label><span>开始时间</span><input v-model="scheduleChangeDraft.proposedStartTime" type="time" required /></label><label><span>结束时间</span><input v-model="scheduleChangeDraft.proposedEndTime" type="time" required /></label></div>
          <label class="full"><span>调课原因</span><textarea v-model="scheduleChangeDraft.reason" rows="4" required></textarea></label>
          <div class="full form-actions"><button class="primary" type="submit">提交调课申请</button></div>
        </form>
        <div v-if="scheduleChanges.length" class="request-list">
          <article v-for="item in scheduleChanges" :key="item.id"><strong>申请 #{{ item.id }} · {{ item.status }}</strong><span>{{ item.proposedDate }} {{ item.proposedStartTime }}–{{ item.proposedEndTime }}</span><small>{{ item.reason }}</small></article>
        </div>
      </section>
    </main>

    <nav class="mobile-nav" aria-label="移动端教师端页面">
      <button v-for="page in pages" :key="page.key" :class="{ active: activePage === page.key }" type="button" @click="goTo(page.key)">{{ page.shortLabel }}</button>
    </nav>
  </div>
</template>
