<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { UserSummary } from '@k12/shared'

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
import type { AdminOverview } from './adminTypes'
import {
  chooseSubstituteTeacherId,
  countSchedulesForBusinessDate,
} from './adminViewHelpers'

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

const selectedApprovalId = ref<number | null>(null)
const decisionNote = ref('')
const selectedSubstituteChangeId = ref<number | null>(null)
const selectedSubstituteTeacherId = ref<number | null>(null)
const substituteNote = ref('已与代课教师确认，无课程冲突')
const selectedWorkOrderId = ref<number | null>(null)
const workOrderResult = ref('')

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

const authClient = createAuthClient({ apiBaseUrl })

function handleUnauthorized() {
  void clearSessionAndGoLogin('登录已失效，请重新登录')
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

const dashboardStats = computed(() => [
  {
    label: '今日排课',
    value: countSchedulesForBusinessDate(visibleSchedules.value, new Date()),
    helper: '当前数据范围',
  },
  {
    label: '待审批',
    value: visibleScheduleChanges.value.filter(
      (change) => change.status === 'PENDING',
    ).length,
    helper: '需要教务处理',
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
    pendingApprovals: scheduleChanges.value.filter(
      (item) => item.campusId === campus.id && item.status === 'PENDING',
    ).length,
    openTickets: workOrders.value.filter(
      (item) => item.campusId === campus.id && item.status !== 'CLOSED',
    ).length,
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
  workOrderResult.value = ''
  decisionNote.value = ''
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

  if (decision === 'REJECTED' && !decisionNote.value.trim()) {
    showError(new Error('拒绝调课时必须填写拒绝原因'))
    return
  }

  try {
    const reviewed = await adminApiClient.reviewScheduleChange({
      changeId: selected.id,
      decision,
      decisionNote: decisionNote.value,
    })
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
    const assigned = await adminApiClient.assignSubstitute({
      changeId: selected.id,
      substituteTeacherId: selectedTeacher.id,
      substituteNote: substituteNote.value,
    })
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
  if (!selected) return

  try {
    const updated = await adminApiClient.updateWorkOrder({
      workOrderId: selected.id,
      action: 'START',
    })
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

  if (!workOrderResult.value.trim()) {
    showError(new Error('关闭工单前必须填写处理结果'))
    return
  }

  try {
    const closed = await adminApiClient.updateWorkOrder({
      workOrderId: selected.id,
      action: 'CLOSE',
      result: workOrderResult.value,
    })
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
          <small>{{ page.path }}</small>
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
          <p class="eyebrow">教务 / 系统后台 · 业务 API 接入</p>
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
            使用真实认证接口登录。教务仅能访问所属校区，系统管理员可访问
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
          <span class="scope-code">{{ currentRole }}</span>
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

      <section v-else-if="activePage === 'schedule'" class="panel">
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
          </div>
        </div>
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
                <td><span class="status-pill tone-info">{{ schedule.status }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section v-else-if="activePage === 'approval'" class="split-layout">
        <article class="panel list-panel">
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
              <button class="primary" type="button" @click="closeSelectedWorkOrder">
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
        <div v-if="visibleUsers.length === 0" class="empty-state">
          <strong>当前范围内没有用户</strong>
        </div>
        <div v-else class="table-wrap">
          <table>
            <thead><tr><th>用户</th><th>账号</th><th>校区</th><th>角色</th><th>账号状态</th></tr></thead>
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
                <div><dt>待审批</dt><dd>{{ metric.pendingApprovals }}</dd></div>
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
