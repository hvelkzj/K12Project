<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { getBusinessStatusLabel } from '@k12/shared'
import type {
  LeaveRequest,
  UserSummary,
} from '@k12/shared'

import {
  createAdminApiClient,
} from './adminApiClient'
import {
  canAccessAdminPage,
  createAuthClient,
  isAuthenticatedAdmin,
  isAdminRole,
} from './authService'
import type {
  AdminRole,
  FeedbackWorkOrder,
  Schedule,
  ScheduleChange,
  ScheduleChangeStatus,
  UserAccount,
  UserRole,
  WorkOrderStatus,
} from './types'
import type {
  AdminOverview,
  CreateScheduleInput,
} from './adminTypes'
import {
  chooseSubstituteTeacherId,
  countSchedulesForBusinessDate,
} from './adminViewHelpers'
import {
  countOpenWorkOrders,
  countPendingLeaveRequests,
  countPendingScheduleChanges,
} from './adminStatistics'
import {
  canCloseWorkOrder,
  canDisableCurrentAdmin,
  canManageUser,
  canReviewLeaveRequest,
  isScheduleIdentityLocked,
  runManagementAction,
  validateRequiredText,
  validateScheduleTime,
} from './adminManagementRules'

type PageKey =
  | 'login'
  | 'dashboard'
  | 'schedule'
  | 'approval'
  | 'substitute'
  | 'ticket'
  | 'users'
  | 'board'

const pages: Array<{
  key: PageKey
  label: string
  shortLabel: string
  path: string
}> = [
  { key: 'login', label: '登录', shortLabel: '登录', path: '/login' },
  { key: 'dashboard', label: '工作台', shortLabel: '首页', path: '/dashboard' },
  { key: 'schedule', label: '排课管理', shortLabel: '排课', path: '/schedule' },
  { key: 'approval', label: '调课审批', shortLabel: '审批', path: '/approval' },
  { key: 'substitute', label: '代课安排', shortLabel: '代课', path: '/substitute' },
  { key: 'ticket', label: '反馈工单', shortLabel: '工单', path: '/ticket' },
  { key: 'users', label: '用户管理', shortLabel: '用户', path: '/users' },
  { key: 'board', label: '数据看板', shortLabel: '看板', path: '/board' },
]

const roleLabels: Record<AdminRole, string> = {
  ACADEMIC_ADMIN: '教务',
  SYSTEM_ADMIN: '系统管理员',
}

const userRoleLabels: Record<UserRole, string> = {
  PARENT: '家长',
  STUDENT: '学生',
  TEACHER: '任课教师',
  HOMEROOM_TEACHER: '班主任',
  ACADEMIC_ADMIN: '教务',
  SYSTEM_ADMIN: '系统管理员',
}

const scheduleChangeLabels: Record<ScheduleChangeStatus, string> = {
  PENDING: '待审批',
  APPROVED: '已通过',
  REJECTED: '已拒绝',
  SUBSTITUTE_ASSIGNED: '已安排代课',
  COMPLETED: '已完成',
}

const workOrderLabels: Record<WorkOrderStatus, string> = {
  OPEN: '待处理',
  PROCESSING: '处理中',
  CLOSED: '已关闭',
}

const activePage = ref<PageKey>('login')
const currentRole = ref<AdminRole>('ACADEMIC_ADMIN')
const currentUser = ref<UserSummary | null>(null)
const loginUsername = ref('academic_901')
const loginPassword = ref('K12Demo123!')
const isLoggingIn = ref(false)
const homeCampusId = ref(1)
const notice = ref('')
const errorMessage = ref('')
const scheduleCampusFilter = ref(0)

const isLoadingOverview = ref(false)
const overviewLoadFailed = ref(false)
const overviewError = ref('')

const campuses = ref<AdminOverview['campuses']>([])
const classGroups = ref<AdminOverview['classes']>([])
const courses = ref<AdminOverview['courses']>([])
const teachers = ref<AdminOverview['teachers']>([])
const schedules = ref<Schedule[]>([])
const scheduleChanges = ref<ScheduleChange[]>([])
const workOrders = ref<FeedbackWorkOrder[]>([])
const users = ref<UserAccount[]>([])
const leaveRequests = ref<LeaveRequest[]>([])

const selectedApprovalId = ref<number | null>(null)
const decisionNote = ref('')
const selectedLeaveRequestId = ref<number | null>(null)
const leaveReviewNote = ref('')
const selectedSubstituteChangeId = ref<number | null>(null)
const selectedSubstituteTeacherId = ref<number | null>(null)
const substituteNote = ref('已与代课教师确认，无课程冲突')
const selectedWorkOrderId = ref<number | null>(null)
const workOrderResult = ref('')
const leaveStatusFilter = ref<'PENDING' | 'ALL'>('PENDING')
const managementActionState = reactive({ pendingKey: null as string | null })

const currentPage = computed(
  () => pages.find((page) => page.key === activePage.value) ?? pages[0],
)

const visiblePages = computed(() =>
  isAuthenticatedAdmin(currentUser.value)
    ? pages.filter((page) => page.key !== 'login')
    : pages.filter((page) => page.key === 'login'),
)

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:3000'
const portalUrl =
  import.meta.env.VITE_PORTAL_URL ?? 'http://127.0.0.1:5172'

const authClient = createAuthClient({ apiBaseUrl })

function handleUnauthorized() {
  return clearSessionAndGoLogin('登录已失效，请重新登录')
}

const adminApiClient = createAdminApiClient({
  apiBaseUrl,
  onUnauthorized: handleUnauthorized,
})

const currentRoleLabel = computed(() =>
  currentUser.value && isAdminRole(currentUser.value.role)
    ? roleLabels[currentUser.value.role]
    : roleLabels[currentRole.value],
)

const scopeDescription = computed(() =>
  currentRole.value === 'ACADEMIC_ADMIN'
    ? `仅可查看和处理所属校区（${currentUser.value?.campusName ?? '当前校区'}）数据`
    : '可查看单一机构下的全部校区数据',
)

const visibleCampuses = computed(() =>
  currentRole.value === 'SYSTEM_ADMIN'
    ? campuses.value
    : campuses.value.filter((campus) => campus.id === homeCampusId.value),
)

const visibleSchedules = computed(() =>
  currentRole.value === 'SYSTEM_ADMIN'
    ? schedules.value
    : schedules.value.filter(
        (schedule) => schedule.campusId === homeCampusId.value,
      ),
)

const displayedSchedules = computed(() => {
  if (scheduleCampusFilter.value === 0) {
    return visibleSchedules.value
  }

  return visibleSchedules.value.filter(
    (schedule) => schedule.campusId === scheduleCampusFilter.value,
  )
})

const visibleScheduleChanges = computed(() =>
  currentRole.value === 'SYSTEM_ADMIN'
    ? scheduleChanges.value
    : scheduleChanges.value.filter(
        (change) => change.campusId === homeCampusId.value,
      ),
)

const visibleWorkOrders = computed(() =>
  currentRole.value === 'SYSTEM_ADMIN'
    ? workOrders.value
    : workOrders.value.filter(
        (workOrder) => workOrder.campusId === homeCampusId.value,
      ),
)

const visibleUsers = computed(() =>
  currentRole.value === 'SYSTEM_ADMIN'
    ? users.value
    : users.value.filter((user) => user.campusId === homeCampusId.value),
)

const selectedApproval = computed(() =>
  visibleScheduleChanges.value.find(
    (change) => change.id === selectedApprovalId.value,
  ),
)

const substituteCandidates = computed(() =>
  visibleScheduleChanges.value.filter((change) => change.status === 'APPROVED'),
)

const selectedSubstituteChange = computed(() =>
  visibleScheduleChanges.value.find(
    (change) => change.id === selectedSubstituteChangeId.value,
  ),
)

const availableSubstituteTeachers = computed(() => {
  const selected = selectedSubstituteChange.value
  if (!selected) {
    return []
  }

  return teachers.value.filter(
    (teacher) =>
      teacher.campusId === selected.campusId &&
      teacher.id !== selected.originalTeacherId,
  )
})

const assignedChanges = computed(() =>
  visibleScheduleChanges.value.filter(
    (change) =>
      change.status === 'SUBSTITUTE_ASSIGNED' || change.status === 'COMPLETED',
  ),
)

const selectedWorkOrder = computed(() =>
  visibleWorkOrders.value.find(
    (workOrder) => workOrder.id === selectedWorkOrderId.value,
  ),
)

const scopedLeaveRequests = computed(() =>
  currentRole.value === 'SYSTEM_ADMIN'
    ? leaveRequests.value
    : leaveRequests.value.filter(
        (leave) => scheduleCampusForLeave(leave) === homeCampusId.value,
      ),
)

const visibleLeaveRequests = computed(() => {
  const scoped = scopedLeaveRequests.value

  if (leaveStatusFilter.value === 'PENDING') {
    return scoped.filter((leave) => leave.status === 'PENDING')
  }

  return scoped
})

const selectedLeaveRequest = computed(() =>
  visibleLeaveRequests.value.find(
    (leave) => leave.id === selectedLeaveRequestId.value,
  ),
)

const dashboardStats = computed(() => [
  {
    label: '今日排课',
    value: countSchedulesForBusinessDate(visibleSchedules.value, new Date()),
    helper: '当前数据范围',
  },
  {
    label: '待审批',
    value:
      visibleScheduleChanges.value.filter(
        (change) => change.status === 'PENDING',
      ).length +
      scopedLeaveRequests.value.filter(
        (leave) => leave.status === 'PENDING',
      ).length,
    helper: '调课与请假',
  },
  {
    label: '待安排代课',
    value: substituteCandidates.value.length,
    helper: '已通过申请',
  },
  {
    label: '未关闭工单',
    value: visibleWorkOrders.value.filter(
      (workOrder) => workOrder.status !== 'CLOSED',
    ).length,
    helper: '待处理与处理中',
  },
])

const boardMetrics = computed(() =>
  visibleCampuses.value.map((campus) => ({
    campus,
    schedules: schedules.value.filter(
      (item) => item.campusId === campus.id,
    ).length,
    users: users.value.filter((item) => item.campusId === campus.id).length,
    pendingApprovals: countPendingScheduleChanges(
      scheduleChanges.value,
      campus.id,
    ),
    pendingLeaveRequests: countPendingLeaveRequests(
      leaveRequests.value,
      campus.id,
      scheduleCampusForLeave,
    ),
    openTickets: countOpenWorkOrders(workOrders.value, campus.id),
  })),
)

watch(availableSubstituteTeachers, (candidates) => {
  selectedSubstituteTeacherId.value = chooseSubstituteTeacherId(
    selectedSubstituteTeacherId.value,
    candidates,
  )
})

function resetScopedSelections() {
  selectedApprovalId.value = visibleScheduleChanges.value[0]?.id ?? null
  selectedSubstituteChangeId.value = substituteCandidates.value[0]?.id ?? null
  selectedWorkOrderId.value = visibleWorkOrders.value[0]?.id ?? null
  selectedLeaveRequestId.value = visibleLeaveRequests.value[0]?.id ?? null
  workOrderResult.value = ''
  decisionNote.value = ''
  leaveReviewNote.value = ''
}

function clearMessages() {
  notice.value = ''
  errorMessage.value = ''
}

function showNotice(message: string) {
  errorMessage.value = ''
  notice.value = message
}

function showError(error: unknown) {
  notice.value = ''
  errorMessage.value =
    error instanceof Error ? error.message : '操作失败，请稍后重试'
}

function goTo(page: PageKey) {
  if (!canAccessAdminPage(page, currentUser.value)) {
    activePage.value = 'login'
    clearMessages()
    showError(new Error('请先使用教务或系统管理员账号登录'))
    return
  }

  activePage.value = page
  clearMessages()
}

function applyOverview(overview: AdminOverview) {
  campuses.value = overview.campuses.map((item) => ({ ...item }))
  classGroups.value = overview.classes.map((item) => ({ ...item }))
  courses.value = overview.courses.map((item) => ({ ...item }))
  teachers.value = overview.teachers.map((item) => ({ ...item }))
  schedules.value = overview.schedules.map((item) => ({ ...item }))
  scheduleChanges.value = overview.scheduleChanges.map((item) => ({ ...item }))
  workOrders.value = overview.feedbackWorkOrders.map((item) => ({ ...item }))
  users.value = overview.users.map((item) => ({ ...item }))
  leaveRequests.value = (overview.leaveRequests ?? []).map((item) => ({ ...item }))
}

async function loadOverview(): Promise<boolean> {
  isLoadingOverview.value = true
  overviewLoadFailed.value = false
  overviewError.value = ''

  try {
    const overview = await adminApiClient.loadOverview()
    applyOverview(overview)
    resetScopedSelections()
    showNotice(`后台数据已加载，共 ${overview.campuses.length} 个校区可见`)
    return true
  } catch (error) {
    overviewLoadFailed.value = true
    overviewError.value =
      error instanceof Error ? error.message : '后台数据加载失败'
    return false
  } finally {
    isLoadingOverview.value = false
  }
}

async function clearSessionAndGoLogin(message: string) {
  try {
    await authClient.logout()
  } catch {
    // 忽略退出异常
  } finally {
    currentUser.value = null
    currentRole.value = 'ACADEMIC_ADMIN'
    homeCampusId.value = 1
    loginUsername.value = 'academic_901'
    loginPassword.value = 'K12Demo123!'
    campuses.value = []
    classGroups.value = []
    courses.value = []
    teachers.value = []
    schedules.value = []
    scheduleChanges.value = []
    workOrders.value = []
    users.value = []
    leaveRequests.value = []
    resetScopedSelections()
    clearMessages()
    goTo('login')
    showError(new Error(message))
  }
}

async function restoreSession() {
  try {
    const user = await authClient.getCurrentUser()
    if (!user) return

    if (!isAdminRole(user.role)) {
      await authClient.logout()
      return
    }

    currentUser.value = user
    currentRole.value = user.role
    homeCampusId.value = user.campusId
    goTo('dashboard')
    if (await loadOverview()) {
      showNotice(
        `欢迎回来，${user.displayName}。数据范围：${scopeDescription.value}`,
      )
    }
  } catch (error) {
    showError(error)
  }
}

async function login() {
  if (isLoggingIn.value) return

  clearMessages()
  isLoggingIn.value = true

  try {
    const session = await authClient.login(
      loginUsername.value,
      loginPassword.value,
    )

    if (!isAdminRole(session.user.role)) {
      await authClient.logout()
      showError(new Error('该账号不是教务或系统管理员，不能进入后台'))
      return
    }

    currentUser.value = session.user
    currentRole.value = session.user.role
    homeCampusId.value = session.user.campusId
    goTo('dashboard')
    if (!(await loadOverview())) {
      return
    }

    showNotice(
      `已使用 ${session.user.displayName}（${roleLabels[session.user.role]}）登录，${scopeDescription.value}`,
    )
  } catch (error) {
    showError(error)
  } finally {
    isLoggingIn.value = false
  }
}

async function logout() {
  await clearSessionAndGoLogin('')
}

onMounted(restoreSession)

function campusName(campusId: number) {
  return campuses.value.find((campus) => campus.id === campusId)?.name ?? '未知校区'
}

function className(classId: number) {
  return classGroups.value.find((item) => item.id === classId)?.name ?? '未知班级'
}

function courseName(courseId: number) {
  return courses.value.find((course) => course.id === courseId)?.name ?? '未知课程'
}

function teacherName(teacherId: number | null | undefined) {
  if (teacherId === undefined || teacherId === null) {
    return '未安排'
  }

  return teachers.value.find((teacher) => teacher.id === teacherId)?.displayName ?? '未知教师'
}

function scheduleFor(change: ScheduleChange) {
  return schedules.value.find((schedule) => schedule.id === change.scheduleId)
}

function scheduleForLeave(leave: LeaveRequest) {
  return schedules.value.find((schedule) => schedule.id === leave.scheduleId)
}

function scheduleCampusForLeave(leave: LeaveRequest) {
  return scheduleForLeave(leave)?.campusId ?? 0
}

function studentNameForLeave(leave: LeaveRequest) {
  return `学生 #${leave.studentId}`
}

function formatTime(time: string) {
  return time.slice(0, 5)
}

function formatDateTime(dateTime: string) {
  return dateTime.replace('T', ' ').slice(0, 16)
}

function statusTone(status: string) {
  if (status === 'PENDING' || status === 'OPEN') return 'tone-warning'
  if (
    status === 'APPROVED' ||
    status === 'SUBSTITUTE_ASSIGNED' ||
    status === 'CLOSED' ||
    status === 'COMPLETED'
  ) {
    return 'tone-success'
  }
  if (status === 'REJECTED' || status === 'CANCELLED') return 'tone-danger'
  return 'tone-info'
}

function viewApproval(changeId: number) {
  selectedApprovalId.value = changeId
  decisionNote.value = ''
  clearMessages()
}

async function submitReview(decision: 'APPROVED' | 'REJECTED') {
  const selected = selectedApproval.value
  if (!selected) {
    showError(new Error('请先查看一条调课申请'))
    return
  }

  if (selected.status !== 'PENDING') {
    showError(new Error('该申请已审批，不能重复处理'))
    return
  }

  if (decision === 'REJECTED') {
    const error = validateRequiredText(decisionNote.value, '拒绝调课时必须填写拒绝原因')
    if (error) {
      showError(new Error(error))
      return
    }
  }

  try {
    const action = await runManagementAction(
      managementActionState,
      `review-${selected.id}`,
      () => adminApiClient.reviewScheduleChange({
        changeId: selected.id,
        decision,
        decisionNote: decisionNote.value,
      }),
    )
    if (!action.started) return
    const reviewed = action.value
    const index = scheduleChanges.value.findIndex((item) => item.id === selected.id)
    scheduleChanges.value[index] = reviewed
    decisionNote.value = ''

    if (decision === 'APPROVED') {
      selectedSubstituteChangeId.value = reviewed.id
      showNotice('申请已通过，可前往“代课安排”选择同校区教师')
    } else {
      showNotice('申请已拒绝，拒绝原因已记录')
    }
  } catch (error) {
    showError(error)
  }
}

function openSubstitute(changeId: number) {
  selectedSubstituteChangeId.value = changeId
  goTo('substitute')
}

function viewLeaveRequest(leaveRequestId: number) {
  selectedLeaveRequestId.value = leaveRequestId
  leaveReviewNote.value = ''
  clearMessages()
}

async function submitLeaveReview(decision: 'APPROVED' | 'REJECTED') {
  const selected = selectedLeaveRequest.value
  if (!selected) {
    showError(new Error('请先查看一条请假申请'))
    return
  }

  if (!canReviewLeaveRequest(selected.status)) {
    showError(new Error('该请假已完成审批，不能重复处理'))
    return
  }

  if (decision === 'REJECTED') {
    const error = validateRequiredText(leaveReviewNote.value, '拒绝请假时必须填写原因')
    if (error) {
      showError(new Error(error))
      return
    }
  }

  try {
    const action = await runManagementAction(
      managementActionState,
      `leave-${selected.id}`,
      () => adminApiClient.reviewLeaveRequest({
        leaveRequestId: selected.id,
        decision,
        reviewNote: leaveReviewNote.value,
      }),
    )
    if (!action.started) return
    const reviewed = action.value
    const index = leaveRequests.value.findIndex((item) => item.id === selected.id)
    leaveRequests.value[index] = reviewed
    leaveReviewNote.value = ''
    showNotice(
      decision === 'APPROVED' ? '请假申请已通过' : '请假申请已拒绝，原因已记录',
    )
  } catch (error) {
    showError(error)
  }
}

async function submitSubstitute() {
  const selected = selectedSubstituteChange.value
  if (!selected) {
    showError(new Error('当前没有可安排代课的已通过申请'))
    return
  }

  const selectedTeacher = teachers.value.find(
    (teacher) => teacher.id === selectedSubstituteTeacherId.value,
  )
  if (!selectedTeacher) {
    showError(new Error('请选择代课教师'))
    return
  }
  if (selectedTeacher.campusId !== selected.campusId) {
    showError(new Error('请选择申请所在校区的代课教师'))
    return
  }
  if (selectedTeacher.id === selected.originalTeacherId) {
    showError(new Error('代课教师不能是原教师'))
    return
  }

  try {
    const action = await runManagementAction(
      managementActionState,
      `substitute-${selected.id}`,
      () => adminApiClient.assignSubstitute({
        changeId: selected.id,
        substituteTeacherId: selectedTeacher.id,
        substituteNote: substituteNote.value,
      }),
    )
    if (!action.started) return
    const assigned = action.value
    const index = scheduleChanges.value.findIndex((item) => item.id === selected.id)
    scheduleChanges.value[index] = assigned

    const scheduleIndex = schedules.value.findIndex(
      (schedule) => schedule.id === selected.scheduleId,
    )
    if (scheduleIndex >= 0) {
      const currentSchedule = schedules.value[scheduleIndex]
      if (currentSchedule) {
        schedules.value[scheduleIndex] = {
          ...currentSchedule,
          teacherId: selectedTeacher.id,
          lessonDate: assigned.proposedDate,
          startTime: assigned.proposedStartTime,
          endTime: assigned.proposedEndTime,
          status: 'CHANGED',
        }
      }
    }

    showNotice(`已安排${selectedTeacher.displayName}代课，排课已同步更新`)
    const next = substituteCandidates.value[0]
    selectedSubstituteChangeId.value = next?.id ?? null
  } catch (error) {
    showError(error)
  }
}

function viewWorkOrder(workOrderId: number) {
  selectedWorkOrderId.value = workOrderId
  workOrderResult.value = ''
  clearMessages()
}

async function beginSelectedWorkOrder() {
  const selected = selectedWorkOrder.value
  if (!selected) {
    showError(new Error('请先查看一条反馈工单'))
    return
  }

  if (selected.status !== 'OPEN') {
    showError(new Error('该工单已经开始处理'))
    return
  }

  try {
    const action = await runManagementAction(
      managementActionState,
      `workorder-${selected.id}`,
      () => adminApiClient.updateWorkOrder({
        workOrderId: selected.id,
        action: 'START',
      }),
    )
    if (!action.started) return
    const updated = action.value
    const index = workOrders.value.findIndex((item) => item.id === selected.id)
    workOrders.value[index] = updated
    showNotice('工单已进入处理中状态')
  } catch (error) {
    showError(error)
  }
}

async function closeSelectedWorkOrder() {
  const selected = selectedWorkOrder.value
  if (!selected) {
    showError(new Error('请先查看一条反馈工单'))
    return
  }

  if (!canCloseWorkOrder(selected.status)) {
    showError(
      new Error(
        selected.status === 'OPEN'
          ? '请先开始处理工单'
          : '该工单已经关闭',
      ),
    )
    return
  }

  if (!workOrderResult.value.trim()) {
    showError(new Error('关闭工单前必须填写处理结果'))
    return
  }

  try {
    const action = await runManagementAction(
      managementActionState,
      `workorder-${selected.id}`,
      () => adminApiClient.updateWorkOrder({
        workOrderId: selected.id,
        action: 'CLOSE',
        result: workOrderResult.value,
      }),
    )
    if (!action.started) return
    const closed = action.value
    const index = workOrders.value.findIndex((item) => item.id === selected.id)
    workOrders.value[index] = closed
    workOrderResult.value = ''
    showNotice('工单已关闭，处理结果和关闭时间已保存')
  } catch (error) {
    showError(error)
  }
}

function retryLoadOverview() {
  void loadOverview()
}

const scheduleFormOpen = ref(false)
const scheduleFormBusy = ref(false)
const editingScheduleId = ref<number | null>(null)
const scheduleForm = ref({
  campusId: 0,
  classId: 0,
  courseId: 0,
  teacherId: 0,
  lessonDate: '',
  startTime: '09:00',
  endTime: '10:30',
  room: '',
})

watch(
  () => scheduleForm.value.campusId,
  () => {
    if (editingScheduleId.value !== null) return
    scheduleForm.value.classId = 0
    scheduleForm.value.courseId = 0
    scheduleForm.value.teacherId = 0
  },
)

function resetScheduleForm() {
  scheduleForm.value = {
    campusId: homeCampusId.value,
    classId: 0,
    courseId: 0,
    teacherId: 0,
    lessonDate: '',
    startTime: '09:00',
    endTime: '10:30',
    room: '',
  }
}

function openCreateSchedule() {
  resetScheduleForm()
  editingScheduleId.value = null
  scheduleFormOpen.value = true
  clearMessages()
}

function openEditSchedule(schedule: Schedule) {
  editingScheduleId.value = schedule.id
  scheduleForm.value = {
    campusId: schedule.campusId,
    classId: schedule.classId,
    courseId: schedule.courseId,
    teacherId: schedule.teacherId,
    lessonDate: schedule.lessonDate,
    startTime: schedule.startTime.slice(0, 5),
    endTime: schedule.endTime.slice(0, 5),
    room: schedule.room,
  }
  scheduleFormOpen.value = true
  clearMessages()
}

function cancelScheduleForm() {
  scheduleFormOpen.value = false
  editingScheduleId.value = null
  resetScheduleForm()
}

function scheduleFormOptions(campusId: number) {
  const classesForCampus = classGroups.value.filter(
    (item) => item.campusId === campusId,
  )
  const coursesForCampus = courses.value.filter(
    (item) => item.campusId === campusId,
  )
  const teachersForCampus = teachers.value.filter(
    (item) => item.campusId === campusId,
  )

  return { classesForCampus, coursesForCampus, teachersForCampus }
}

function buildScheduleInput(): CreateScheduleInput | null {
  const form = scheduleForm.value
  const { classesForCampus, coursesForCampus, teachersForCampus } =
    scheduleFormOptions(form.campusId)

  if (!form.lessonDate) {
    showError(new Error('请选择上课日期'))
    return null
  }
  if (!form.room.trim()) {
    showError(new Error('请填写教室'))
    return null
  }
  if (!classesForCampus.some((item) => item.id === form.classId)) {
    showError(new Error('请选择该校区下的班级'))
    return null
  }
  if (!coursesForCampus.some((item) => item.id === form.courseId)) {
    showError(new Error('请选择该校区下的课程'))
    return null
  }
  if (!teachersForCampus.some((item) => item.id === form.teacherId)) {
    showError(new Error('请选择该校区下的教师'))
    return null
  }
  const timeError = validateScheduleTime(form.startTime, form.endTime)
  if (timeError) {
    showError(new Error(timeError))
    return null
  }

  return {
    campusId: form.campusId,
    classId: form.classId,
    courseId: form.courseId,
    teacherId: form.teacherId,
    lessonDate: form.lessonDate,
    startTime: `${form.startTime}:00`,
    endTime: `${form.endTime}:00`,
    room: form.room.trim(),
  }
}

async function submitScheduleForm() {
  if (scheduleFormBusy.value) return

  clearMessages()

  const actionKey = editingScheduleId.value === null
    ? 'schedule-create'
    : `schedule-edit-${editingScheduleId.value}`

  if (editingScheduleId.value === null) {
    const input = buildScheduleInput()
    if (!input) return

    scheduleFormBusy.value = true
    try {
      const action = await runManagementAction(
        managementActionState,
        actionKey,
        () => adminApiClient.createSchedule(input),
      )
      if (!action.started) return
      const created = action.value
      schedules.value.push(created)
      scheduleFormOpen.value = false
      resetScheduleForm()
      showNotice('课次已新增')
    } catch (error) {
      showError(error)
    } finally {
      scheduleFormBusy.value = false
    }
    return
  }

  const scheduleId = editingScheduleId.value
  const current = schedules.value.find((item) => item.id === scheduleId)
  if (!current) return

  const form = scheduleForm.value
  const { classesForCampus, coursesForCampus, teachersForCampus } =
    scheduleFormOptions(form.campusId)
  if (!classesForCampus.some((item) => item.id === form.classId)) {
    showError(new Error('请选择该校区下的班级'))
    return
  }
  if (!coursesForCampus.some((item) => item.id === form.courseId)) {
    showError(new Error('请选择该校区下的课程'))
    return
  }
  if (!teachersForCampus.some((item) => item.id === form.teacherId)) {
    showError(new Error('请选择该校区下的教师'))
    return
  }
  const timeError = validateScheduleTime(form.startTime, form.endTime)
  if (timeError) {
    showError(new Error(timeError))
    return
  }

  scheduleFormBusy.value = true
  try {
    const action = await runManagementAction(
      managementActionState,
      actionKey,
      () => adminApiClient.updateSchedule({
        scheduleId,
        changes: {
          teacherId: form.teacherId,
          lessonDate: form.lessonDate,
          startTime: `${form.startTime}:00`,
          endTime: `${form.endTime}:00`,
          room: form.room.trim(),
        },
      }),
    )
    if (!action.started) return
    const updated = action.value
    const index = schedules.value.findIndex((item) => item.id === scheduleId)
    schedules.value[index] = updated
    scheduleFormOpen.value = false
    editingScheduleId.value = null
    resetScheduleForm()
    showNotice('课次已更新')
  } catch (error) {
    showError(error)
  } finally {
    scheduleFormBusy.value = false
  }
}

async function cancelSchedule(scheduleId: number) {
  const current = schedules.value.find((item) => item.id === scheduleId)
  if (!current) return
  if (current.status === 'CANCELLED') {
    showError(new Error('该课次已经取消'))
    return
  }

  try {
    const action = await runManagementAction(
      managementActionState,
      `schedule-${scheduleId}`,
      () => adminApiClient.updateSchedule({
        scheduleId,
        changes: { status: 'CANCELLED' },
      }),
    )
    if (!action.started) return
    const updated = action.value
    const index = schedules.value.findIndex((item) => item.id === scheduleId)
    schedules.value[index] = updated
    showNotice('课次已取消')
  } catch (error) {
    showError(error)
  }
}

async function toggleUserActive(user: UserAccount) {
  if (!canManageUser(currentRole.value)) {
    showError(new Error('只有系统管理员可以启停账号'))
    return
  }

  if (!canDisableCurrentAdmin(user, currentUser.value)) {
    showError(new Error('不能停用当前登录的系统管理员'))
    return
  }

  try {
    const action = await runManagementAction(
      managementActionState,
      `user-${user.id}`,
      () => adminApiClient.updateUser({
        userId: user.id,
        active: !user.active,
      }),
    )
    if (!action.started) return
    const updated = action.value
    const index = users.value.findIndex((item) => item.id === user.id)
    users.value[index] = updated
    showNotice(`${user.displayName}账号已${updated.active ? '启用' : '停用'}`)
  } catch (error) {
    showError(error)
  }
}
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="brand">
        <span class="brand-mark">K</span>
        <div>
          <strong>K12 运营中心</strong>
          <small>教务 / 系统后台</small>
        </div>
      </div>

      <nav aria-label="后台页面">
        <button
          v-for="page in visiblePages"
          :key="page.key"
          class="nav-item"
          :class="{ active: activePage === page.key }"
          type="button"
          @click="goTo(page.key)"
        >
          <span class="nav-mark" aria-hidden="true"></span>
          <span>{{ page.label }}</span>
        </button>
      </nav>

      <div v-if="currentUser" class="scope-card">
        <span>当前数据范围</span>
        <strong>{{ roleLabels[currentRole] }}</strong>
        <p>{{ currentUser.displayName }} · {{ scopeDescription }}</p>
      </div>
      <div v-else class="scope-card">
        <span>访问状态</span>
        <strong>尚未登录</strong>
        <p>登录后显示角色对应的数据范围。</p>
      </div>
    </aside>

    <main class="workspace">
      <header class="topbar">
        <div>
          <p class="eyebrow">教务 / 系统后台</p>
          <h1>{{ currentPage?.label }}</h1>
        </div>
        <div class="topbar-user">
          <span v-if="currentUser" class="topbar-name">
            {{ currentUser.displayName }} ·
            {{ currentRoleLabel }}
          </span>
          <button
            v-if="currentUser"
            class="secondary"
            type="button"
            @click="logout"
          >
            退出登录
          </button>
        </div>
      </header>

      <div v-if="notice" class="message success-message" role="status">
        {{ notice }}
      </div>
      <div v-if="errorMessage" class="message error-message" role="alert">
        {{ errorMessage }}
      </div>

      <section v-if="activePage === 'login'" class="panel login-panel">
        <div class="login-copy">
          <span class="feature-kicker">后台登录</span>
          <h2>进入教务后台</h2>
          <p>
            教务人员可以处理所属校区事务，系统管理员可以查看和管理
            单一机构下的全部校区。
          </p>
          <ul class="check-list">
            <li>教务：仅所属校区（academic_901）</li>
            <li>系统管理员：全部校区（system_999）</li>
          </ul>
        </div>
        <form class="login-form" @submit.prevent="login">
          <label>
            <span>用户名</span>
            <input v-model="loginUsername" autocomplete="username" required />
          </label>
          <label>
            <span>密码</span>
            <input
              v-model="loginPassword"
              type="password"
              autocomplete="current-password"
              required
            />
          </label>
          <button
            class="primary wide"
            type="submit"
            :disabled="isLoggingIn"
          >
            {{ isLoggingIn ? '登录中…' : '登录并进入工作台' }}
          </button>
          <a class="portal-return-link" :href="portalUrl">← 返回统一首页</a>
        </form>
      </section>

      <section
        v-else-if="isLoadingOverview"
        class="panel loading-panel"
        role="status"
      >
        <div class="loading-spinner" aria-hidden="true"></div>
        <strong>正在加载后台数据…</strong>
      </section>

      <section
        v-else-if="overviewLoadFailed"
        class="panel error-panel"
        role="alert"
      >
        <span class="feature-kicker">数据加载失败</span>
        <h2>无法加载后台数据</h2>
        <p>{{ overviewError }}</p>
        <div class="form-actions">
          <button class="primary" type="button" @click="retryLoadOverview">
            重试
          </button>
        </div>
      </section>

      <template v-else-if="activePage === 'dashboard'">
        <section class="scope-banner">
          <div>
            <span class="feature-kicker">访问范围</span>
            <strong>{{ roleLabels[currentRole] }}</strong>
            <p>{{ scopeDescription }}</p>
          </div>
          <span class="scope-code">当前身份：{{ roleLabels[currentRole] }}</span>
        </section>

        <section class="summary-grid" aria-label="工作台统计">
          <article v-for="stat in dashboardStats" :key="stat.label">
            <span>{{ stat.label }}</span>
            <strong>{{ stat.value }}</strong>
            <small>{{ stat.helper }}</small>
          </article>
        </section>

        <section class="dashboard-grid">
          <article class="panel">
            <div class="section-heading">
              <div>
                <p class="eyebrow">今日优先处理</p>
                <h2>待办事项</h2>
              </div>
            </div>
            <div class="task-list">
              <button type="button" @click="goTo('approval')">
                <span class="task-icon">审</span>
                <span><strong>调课申请审批</strong><small>核对时间和校区范围</small></span>
                <b>{{ dashboardStats[1]?.value }}</b>
              </button>
              <button type="button" @click="goTo('substitute')">
                <span class="task-icon">代</span>
                <span><strong>安排代课教师</strong><small>仅选择申请所在校区教师</small></span>
                <b>{{ dashboardStats[2]?.value }}</b>
              </button>
              <button type="button" @click="goTo('ticket')">
                <span class="task-icon">单</span>
                <span><strong>处理反馈工单</strong><small>关闭前填写处理结果</small></span>
                <b>{{ dashboardStats[3]?.value }}</b>
              </button>
            </div>
          </article>

          <article class="panel compact-panel">
            <div class="section-heading">
              <div>
                <p class="eyebrow">数据概览</p>
                <h2>数据范围</h2>
              </div>
            </div>
            <dl class="detail-list">
              <div><dt>校区</dt><dd>{{ campuses.length }} 个</dd></div>
              <div><dt>班级</dt><dd>{{ classGroups.length }} 个</dd></div>
              <div><dt>排课</dt><dd>{{ schedules.length }} 条</dd></div>
              <div><dt>当前用户</dt><dd>{{ currentUser?.displayName ?? '未登录' }}</dd></div>
            </dl>
            <button class="secondary wide" type="button" @click="goTo('board')">
              查看数据看板
            </button>
          </article>
        </section>
      </template>

      <section v-else-if="activePage === 'schedule'" class="content-stack">
        <article class="panel">
          <div class="section-heading">
            <div>
              <p class="eyebrow">课程与教室</p>
              <h2>排课清单</h2>
            </div>
            <div class="heading-actions">
              <label class="inline-filter">
                <span>校区</span>
                <select v-model.number="scheduleCampusFilter">
                  <option :value="0">当前范围内全部</option>
                  <option
                    v-for="campus in visibleCampuses"
                    :key="campus.id"
                    :value="campus.id"
                  >
                    {{ campus.name }}
                  </option>
                </select>
              </label>
              <button class="primary" type="button" @click="openCreateSchedule">
                新增课次
              </button>
            </div>
          </div>

          <form
            v-if="scheduleFormOpen"
            class="schedule-form"
            @submit.prevent="submitScheduleForm"
          >
            <div class="schedule-form-heading">
              <strong>{{ editingScheduleId === null ? '新增课次' : `编辑课次 #${editingScheduleId}` }}</strong>
              <button
                class="secondary"
                type="button"
                @click="cancelScheduleForm"
              >
                取消
              </button>
            </div>
            <div class="schedule-form-grid">
              <label class="stack-field">
                <span>校区</span>
                <select
                  v-model.number="scheduleForm.campusId"
                  :disabled="currentRole !== 'SYSTEM_ADMIN' || isScheduleIdentityLocked(editingScheduleId)"
                >
                  <option
                    v-for="campus in visibleCampuses"
                    :key="campus.id"
                    :value="campus.id"
                  >
                    {{ campus.name }}
                  </option>
                </select>
              </label>
              <label class="stack-field">
                <span>班级</span>
                <select
                  v-model.number="scheduleForm.classId"
                  :disabled="isScheduleIdentityLocked(editingScheduleId)"
                >
                  <option :value="0" disabled>请选择班级</option>
                  <option
                    v-for="item in scheduleFormOptions(scheduleForm.campusId).classesForCampus"
                    :key="item.id"
                    :value="item.id"
                  >
                    {{ item.name }}
                  </option>
                </select>
              </label>
              <label class="stack-field">
                <span>课程</span>
                <select
                  v-model.number="scheduleForm.courseId"
                  :disabled="isScheduleIdentityLocked(editingScheduleId)"
                >
                  <option :value="0" disabled>请选择课程</option>
                  <option
                    v-for="item in scheduleFormOptions(scheduleForm.campusId).coursesForCampus"
                    :key="item.id"
                    :value="item.id"
                  >
                    {{ item.name }}
                  </option>
                </select>
              </label>
              <label class="stack-field">
                <span>教师</span>
                <select v-model.number="scheduleForm.teacherId">
                  <option :value="0" disabled>请选择教师</option>
                  <option
                    v-for="item in scheduleFormOptions(scheduleForm.campusId).teachersForCampus"
                    :key="item.id"
                    :value="item.id"
                  >
                    {{ item.displayName }}
                  </option>
                </select>
              </label>
              <label class="stack-field">
                <span>日期</span>
                <input v-model="scheduleForm.lessonDate" type="date" required />
              </label>
              <label class="stack-field">
                <span>开始时间</span>
                <input v-model="scheduleForm.startTime" type="time" required />
              </label>
              <label class="stack-field">
                <span>结束时间</span>
                <input v-model="scheduleForm.endTime" type="time" required />
              </label>
              <label class="stack-field">
                <span>教室</span>
                <input v-model="scheduleForm.room" placeholder="如 A-302" required />
              </label>
            </div>
            <div class="form-actions">
              <button
                class="primary"
                type="submit"
                :disabled="scheduleFormBusy"
              >
                {{ scheduleFormBusy ? '提交中…' : editingScheduleId === null ? '保存课次' : '保存修改' }}
              </button>
            </div>
          </form>

          <p class="scope-inline">{{ scopeDescription }}</p>
          <div v-if="displayedSchedules.length === 0" class="empty-state">
            <strong>当前范围内没有排课</strong>
          </div>
          <div v-else class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>校区 / 班级</th>
                  <th>日期与时间</th>
                  <th>课程</th>
                  <th>教师</th>
                  <th>教室</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="schedule in displayedSchedules" :key="schedule.id">
                  <td>
                    <strong>{{ campusName(schedule.campusId) }}</strong>
                    <small>{{ className(schedule.classId) }} · ID {{ schedule.id }}</small>
                  </td>
                  <td>
                    <strong>{{ schedule.lessonDate }}</strong>
                    <small>{{ formatTime(schedule.startTime) }}–{{ formatTime(schedule.endTime) }}</small>
                  </td>
                  <td>{{ courseName(schedule.courseId) }}</td>
                  <td>{{ teacherName(schedule.teacherId) }}</td>
                  <td>{{ schedule.room }}</td>
                  <td><span class="status-pill tone-info">{{ getBusinessStatusLabel(schedule.status) }}</span></td>
                  <td>
                    <div class="row-actions">
                      <button
                        v-if="schedule.status !== 'CANCELLED'"
                        class="table-action"
                        type="button"
                        @click="openEditSchedule(schedule)"
                      >
                        修改
                      </button>
                      <button
                        v-if="schedule.status !== 'CANCELLED'"
                        class="table-action danger-action"
                        type="button"
                        :disabled="managementActionState.pendingKey !== null"
                        @click="cancelSchedule(schedule.id)"
                      >
                        {{ managementActionState.pendingKey === `schedule-${schedule.id}` ? '取消中…' : '取消' }}
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <section v-else-if="activePage === 'approval'" class="content-stack">
        <article class="panel">
          <div class="section-heading">
            <div>
              <p class="eyebrow">查看申请 → 作出决策</p>
              <h2>调课申请</h2>
            </div>
            <span class="count-tag">{{ visibleScheduleChanges.length }} 条</span>
          </div>
          <div v-if="visibleScheduleChanges.length === 0" class="empty-state">
            <strong>当前范围内没有调课申请</strong>
          </div>
          <div v-else class="request-list">
            <button
              v-for="change in visibleScheduleChanges"
              :key="change.id"
              class="request-item"
              :class="{ selected: selectedApprovalId === change.id }"
              type="button"
              @click="viewApproval(change.id)"
            >
              <span>
                <strong>#{{ change.id }} · {{ teacherName(change.requestedBy) }}</strong>
                <small>{{ campusName(change.campusId) }} · {{ change.originalDate }}</small>
              </span>
              <span class="status-pill" :class="statusTone(change.status)">
                {{ scheduleChangeLabels[change.status] }}
              </span>
            </button>
          </div>
        </article>

        <article v-if="selectedApproval" class="panel detail-panel">
          <div class="section-heading">
            <div>
              <p class="eyebrow">申请 #{{ selectedApproval.id }}</p>
              <h2>审批详情</h2>
            </div>
            <span class="status-pill" :class="statusTone(selectedApproval.status)">
              {{ scheduleChangeLabels[selectedApproval.status] }}
            </span>
          </div>
          <dl class="detail-list two-column">
            <div>
              <dt>校区</dt>
              <dd>{{ campusName(selectedApproval.campusId) }}</dd>
            </div>
            <div>
              <dt>班级 / 课程</dt>
              <dd>
                {{ className(scheduleFor(selectedApproval)?.classId ?? 0) }} ·
                {{ courseName(scheduleFor(selectedApproval)?.courseId ?? 0) }}
              </dd>
            </div>
            <div>
              <dt>原时间</dt>
              <dd>
                {{ selectedApproval.originalDate }}
                {{ formatTime(selectedApproval.originalStartTime) }}–{{ formatTime(selectedApproval.originalEndTime) }}
              </dd>
            </div>
            <div>
              <dt>拟调整时间</dt>
              <dd>
                {{ selectedApproval.proposedDate }}
                {{ formatTime(selectedApproval.proposedStartTime) }}–{{ formatTime(selectedApproval.proposedEndTime) }}
              </dd>
            </div>
            <div class="full-row">
              <dt>申请原因</dt>
              <dd>{{ selectedApproval.reason }}</dd>
            </div>
            <div v-if="selectedApproval.reviewedAt" class="full-row">
              <dt>审批记录</dt>
              <dd>
                {{ selectedApproval.decisionNote || '通过' }} ·
                {{ formatDateTime(selectedApproval.reviewedAt) }}
              </dd>
            </div>
          </dl>

          <template v-if="selectedApproval.status === 'PENDING'">
            <label class="stack-field">
              <span>拒绝原因</span>
              <textarea
                v-model="decisionNote"
                rows="3"
                placeholder="选择拒绝时必填；通过时可留空"
              ></textarea>
            </label>
            <div class="form-actions">
              <button class="danger" type="button" @click="submitReview('REJECTED')">
                拒绝申请
              </button>
              <button class="primary" type="button" @click="submitReview('APPROVED')">
                通过申请
              </button>
            </div>
          </template>
          <button
            v-else-if="selectedApproval.status === 'APPROVED'"
            class="primary wide"
            type="button"
            @click="openSubstitute(selectedApproval.id)"
          >
            前往安排代课
          </button>
          <p v-else class="finished-note">该申请已完成审批，不能重复处理。</p>
        </article>

        <article class="panel">
          <div class="section-heading">
            <div>
              <p class="eyebrow">家长请假申请</p>
              <h2>请假审批</h2>
            </div>
            <div class="heading-actions">
              <label class="inline-filter">
                <span>状态</span>
                <select v-model="leaveStatusFilter">
                  <option value="PENDING">待审批</option>
                  <option value="ALL">全部</option>
                </select>
              </label>
              <span class="count-tag">{{ visibleLeaveRequests.length }} 条</span>
            </div>
          </div>
          <div v-if="visibleLeaveRequests.length === 0" class="empty-state">
            <strong>当前范围内没有请假申请</strong>
          </div>
          <div v-else class="request-list">
            <button
              v-for="leave in visibleLeaveRequests"
              :key="leave.id"
              class="request-item"
              :class="{ selected: selectedLeaveRequestId === leave.id }"
              type="button"
              @click="viewLeaveRequest(leave.id)"
            >
              <span>
                <strong>#{{ leave.id }} · {{ className(scheduleForLeave(leave)?.classId ?? 0) }}</strong>
                <small>{{ campusName(scheduleCampusForLeave(leave)) }} · {{ scheduleForLeave(leave)?.lessonDate }}</small>
              </span>
              <span class="status-pill" :class="statusTone(leave.status)">
                {{ leave.status === 'PENDING' ? '待审批' : leave.status === 'APPROVED' ? '已通过' : '已拒绝' }}
              </span>
            </button>
          </div>
        </article>

        <article v-if="selectedLeaveRequest" class="panel detail-panel">
          <div class="section-heading">
            <div>
              <p class="eyebrow">请假 #{{ selectedLeaveRequest.id }}</p>
              <h2>请假详情</h2>
            </div>
            <span class="status-pill" :class="statusTone(selectedLeaveRequest.status)">
              {{ selectedLeaveRequest.status === 'PENDING' ? '待审批' : selectedLeaveRequest.status === 'APPROVED' ? '已通过' : '已拒绝' }}
            </span>
          </div>
          <dl class="detail-list two-column">
            <div>
              <dt>学生</dt>
              <dd>{{ studentNameForLeave(selectedLeaveRequest) }}</dd>
            </div>
            <div>
              <dt>课程</dt>
              <dd>
                {{ className(scheduleForLeave(selectedLeaveRequest)?.classId ?? 0) }} ·
                {{ courseName(scheduleForLeave(selectedLeaveRequest)?.courseId ?? 0) }}
              </dd>
            </div>
            <div>
              <dt>课次时间</dt>
              <dd>
                {{ scheduleForLeave(selectedLeaveRequest)?.lessonDate }}
                {{ formatTime(scheduleForLeave(selectedLeaveRequest)?.startTime ?? '') }}–{{ formatTime(scheduleForLeave(selectedLeaveRequest)?.endTime ?? '') }}
              </dd>
            </div>
            <div class="full-row">
              <dt>请假原因</dt>
              <dd>{{ selectedLeaveRequest.reason }}</dd>
            </div>
            <div class="full-row">
              <dt>联系电话</dt>
              <dd>{{ selectedLeaveRequest.contactPhone || '未填写' }}</dd>
            </div>
            <div v-if="selectedLeaveRequest.reviewedAt" class="full-row">
              <dt>审批记录</dt>
              <dd>
                {{ selectedLeaveRequest.reviewNote || (selectedLeaveRequest.status === 'APPROVED' ? '通过' : '') }} ·
                {{ formatDateTime(selectedLeaveRequest.reviewedAt) }}
              </dd>
            </div>
          </dl>

          <template v-if="selectedLeaveRequest.status === 'PENDING'">
            <label class="stack-field">
              <span>拒绝原因</span>
              <textarea
                v-model="leaveReviewNote"
                rows="3"
                placeholder="选择拒绝时必填；通过时可留空"
              ></textarea>
            </label>
            <div class="form-actions">
              <button
                class="danger"
                type="button"
                :disabled="managementActionState.pendingKey !== null"
                @click="submitLeaveReview('REJECTED')"
              >
                {{ managementActionState.pendingKey === `leave-${selectedLeaveRequest.id}` ? '处理中…' : '拒绝请假' }}
              </button>
              <button
                class="primary"
                type="button"
                :disabled="managementActionState.pendingKey !== null"
                @click="submitLeaveReview('APPROVED')"
              >
                {{ managementActionState.pendingKey === `leave-${selectedLeaveRequest.id}` ? '处理中…' : '通过请假' }}
              </button>
            </div>
          </template>
          <p v-else class="finished-note">该请假已完成审批，不能重复处理。</p>
        </article>
      </section>

      <section v-else-if="activePage === 'substitute'" class="content-stack">
        <article class="panel">
          <div class="section-heading">
            <div>
              <p class="eyebrow">审批通过后安排</p>
              <h2>选择代课教师</h2>
            </div>
            <span class="count-tag">同校区校验</span>
          </div>

          <div v-if="substituteCandidates.length" class="substitute-form">
            <label class="stack-field">
              <span>已通过申请</span>
              <select v-model.number="selectedSubstituteChangeId">
                <option
                  v-for="change in substituteCandidates"
                  :key="change.id"
                  :value="change.id"
                >
                  #{{ change.id }} · {{ campusName(change.campusId) }} ·
                  {{ teacherName(change.originalTeacherId) }}
                </option>
              </select>
            </label>
            <label class="stack-field">
              <span>代课教师</span>
              <select v-model.number="selectedSubstituteTeacherId" required>
                <option
                  v-for="teacher in availableSubstituteTeachers"
                  :key="teacher.id"
                  :value="teacher.id"
                >
                  {{ teacher.displayName }} · {{ campusName(teacher.campusId) }}
                </option>
              </select>
            </label>
            <label class="stack-field full-field">
              <span>安排备注</span>
              <textarea v-model="substituteNote" rows="3"></textarea>
            </label>
            <div class="assignment-preview full-field">
              <span>代课时间</span>
              <strong v-if="selectedSubstituteChange">
                {{ selectedSubstituteChange.proposedDate }}
                {{ formatTime(selectedSubstituteChange.proposedStartTime) }}–{{ formatTime(selectedSubstituteChange.proposedEndTime) }}
              </strong>
            </div>
            <div class="form-actions full-field">
              <button class="primary" type="button" @click="submitSubstitute">
                确认代课安排
              </button>
            </div>
          </div>
          <div v-else class="empty-state">
            <strong>当前没有待安排的申请</strong>
            <p>请先在调课审批页通过申请。</p>
            <button class="secondary" type="button" @click="goTo('approval')">返回审批</button>
          </div>
        </article>

        <article class="panel">
          <div class="section-heading">
            <div>
              <p class="eyebrow">安排记录</p>
              <h2>已安排代课</h2>
            </div>
          </div>
          <div v-if="assignedChanges.length === 0" class="empty-state">
            <strong>暂无已安排的代课记录</strong>
          </div>
          <div v-else class="table-wrap">
            <table>
              <thead><tr><th>申请</th><th>校区</th><th>时间</th><th>原教师</th><th>代课教师</th><th>状态</th></tr></thead>
              <tbody>
                <tr v-for="change in assignedChanges" :key="change.id">
                  <td>#{{ change.id }}</td>
                  <td>{{ campusName(change.campusId) }}</td>
                  <td>{{ change.proposedDate }} {{ formatTime(change.proposedStartTime) }}</td>
                  <td>{{ teacherName(change.originalTeacherId) }}</td>
                  <td><strong>{{ teacherName(change.substituteTeacherId) }}</strong></td>
                  <td><span class="status-pill tone-success">{{ scheduleChangeLabels[change.status] }}</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <section v-else-if="activePage === 'ticket'" class="split-layout">
        <article class="panel list-panel">
          <div class="section-heading">
            <div>
              <p class="eyebrow">家长异议</p>
              <h2>反馈工单</h2>
            </div>
            <span class="count-tag">{{ visibleWorkOrders.length }} 条</span>
          </div>
          <div v-if="visibleWorkOrders.length === 0" class="empty-state">
            <strong>当前范围内没有反馈工单</strong>
          </div>
          <div v-else class="request-list">
            <button
              v-for="workOrder in visibleWorkOrders"
              :key="workOrder.id"
              class="request-item ticket-item"
              :class="{ selected: selectedWorkOrderId === workOrder.id }"
              type="button"
              @click="viewWorkOrder(workOrder.id)"
            >
              <span>
                <strong>#{{ workOrder.id }} · 反馈 {{ workOrder.feedbackId }}</strong>
                <small>{{ campusName(workOrder.campusId) }} · {{ formatDateTime(workOrder.createdAt) }}</small>
              </span>
              <span class="status-pill" :class="statusTone(workOrder.status)">
                {{ workOrderLabels[workOrder.status] }}
              </span>
            </button>
          </div>
        </article>

        <article v-if="selectedWorkOrder" class="panel detail-panel">
          <div class="section-heading">
            <div>
              <p class="eyebrow">工单 #{{ selectedWorkOrder.id }}</p>
              <h2>处理详情</h2>
            </div>
            <span class="status-pill" :class="statusTone(selectedWorkOrder.status)">
              {{ workOrderLabels[selectedWorkOrder.status] }}
            </span>
          </div>
          <div class="issue-card">
            <span>家长异议</span>
            <p>{{ selectedWorkOrder.issue }}</p>
          </div>

          <template v-if="selectedWorkOrder.status !== 'CLOSED'">
            <label class="stack-field">
              <span>处理结果</span>
              <textarea
                v-model="workOrderResult"
                rows="5"
                placeholder="关闭工单前必须填写具体处理结果"
              ></textarea>
            </label>
            <div class="form-actions">
              <button
                v-if="selectedWorkOrder.status === 'OPEN'"
                class="secondary"
                type="button"
                @click="beginSelectedWorkOrder"
              >
                标记处理中
              </button>
              <button
                v-if="canCloseWorkOrder(selectedWorkOrder.status)"
                class="primary"
                type="button"
                :disabled="managementActionState.pendingKey !== null"
                @click="closeSelectedWorkOrder"
              >
                保存结果并关闭
              </button>
            </div>
          </template>
          <div v-else class="result-card">
            <span>处理结果</span>
            <p>{{ selectedWorkOrder.result }}</p>
            <small>关闭时间：{{ formatDateTime(selectedWorkOrder.closedAt ?? '') }}</small>
          </div>
        </article>
      </section>

      <section v-else-if="activePage === 'users'" class="panel">
        <div class="section-heading">
          <div>
            <p class="eyebrow">账号、角色与权限</p>
            <h2>用户清单</h2>
          </div>
          <span class="count-tag">{{ scopeDescription }}</span>
        </div>
        <p v-if="currentRole === 'SYSTEM_ADMIN'" class="scope-inline">
          系统管理员可以启停账号；不能停用当前登录的系统管理员。
        </p>
        <div v-if="visibleUsers.length === 0" class="empty-state">
          <strong>当前范围内没有用户</strong>
        </div>
        <div v-else class="table-wrap">
          <table>
            <thead><tr><th>用户</th><th>账号</th><th>校区</th><th>角色</th><th>账号状态</th><th v-if="currentRole === 'SYSTEM_ADMIN'">操作</th></tr></thead>
            <tbody>
              <tr v-for="user in visibleUsers" :key="user.id">
                <td><strong>{{ user.displayName }}</strong><small>ID {{ user.id }}</small></td>
                <td><code>{{ user.username }}</code></td>
                <td>{{ campusName(user.campusId) }}</td>
                <td>{{ userRoleLabels[user.role] }}</td>
                <td>
                  <span class="status-pill" :class="user.active ? 'tone-success' : 'tone-danger'">
                    {{ user.active ? '已启用' : '已停用' }}
                  </span>
                </td>
                <td v-if="currentRole === 'SYSTEM_ADMIN'">
                  <button
                    class="table-action"
                    type="button"
                    :disabled="managementActionState.pendingKey !== null || (currentUser?.id === user.id && user.role === 'SYSTEM_ADMIN' && user.active)"
                    @click="toggleUserActive(user)"
                  >
                    {{ managementActionState.pendingKey === `user-${user.id}` ? '处理中…' : user.active ? '停用' : '启用' }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section v-else class="content-stack">
        <section class="summary-grid board-summary" aria-label="数据看板概览">
          <article>
            <span>可见校区</span><strong>{{ visibleCampuses.length }}</strong><small>{{ scopeDescription }}</small>
          </article>
          <article>
            <span>可见用户</span><strong>{{ visibleUsers.length }}</strong><small>按角色范围过滤</small>
          </article>
          <article>
            <span>调课申请</span><strong>{{ visibleScheduleChanges.length }}</strong><small>含历史记录</small>
          </article>
          <article>
            <span>请假申请</span><strong>{{ visibleLeaveRequests.length }}</strong><small>按当前过滤</small>
          </article>
          <article>
            <span>反馈工单</span><strong>{{ visibleWorkOrders.length }}</strong><small>含已关闭工单</small>
          </article>
        </section>

        <article class="panel">
          <div class="section-heading">
            <div>
              <p class="eyebrow">按校区汇总</p>
              <h2>运营数据</h2>
            </div>
          </div>
          <div v-if="boardMetrics.length === 0" class="empty-state">
            <strong>当前范围内没有可汇总的校区</strong>
          </div>
          <div v-else class="metric-grid">
            <article v-for="metric in boardMetrics" :key="metric.campus.id" class="metric-card">
              <div class="metric-heading">
                <span class="campus-index">{{ metric.campus.id }}</span>
                <div><strong>{{ metric.campus.name }}</strong><small>校区数据范围</small></div>
              </div>
              <div class="metric-row"><span>排课</span><b>{{ metric.schedules }}</b></div>
              <div class="metric-bar"><i :style="{ width: `${Math.min(metric.schedules * 22, 100)}%` }"></i></div>
              <div class="metric-row"><span>用户</span><b>{{ metric.users }}</b></div>
              <div class="metric-bar blue"><i :style="{ width: `${Math.min(metric.users * 13, 100)}%` }"></i></div>
              <dl class="mini-metrics">
                <div><dt>调课待审</dt><dd>{{ metric.pendingApprovals }}</dd></div>
                <div><dt>请假待审</dt><dd>{{ metric.pendingLeaveRequests }}</dd></div>
                <div><dt>未关闭工单</dt><dd>{{ metric.openTickets }}</dd></div>
              </dl>
            </article>
          </div>
        </article>
      </section>
    </main>

    <nav class="mobile-nav" aria-label="移动端后台页面">
      <button
        v-for="page in visiblePages"
        :key="page.key"
        :class="{ active: activePage === page.key }"
        type="button"
        @click="goTo(page.key)"
      >
        {{ page.shortLabel }}
      </button>
    </nav>
  </div>
</template>
