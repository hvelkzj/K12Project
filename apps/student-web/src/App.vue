<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { UserSummary } from '@k12/shared'

import { listAssignmentRows } from './assignmentListService'
import { getSubmissionStatusLabel } from './assignmentPresentation'
import { authService } from './services/authService'
import { listCourseware } from './studentService'
import Home from './views/Home.vue'
import Login from './views/Login.vue'

type MainPage = 'home' | 'courseware' | 'assignments'

const courseNames: Record<number, string> = {
  11: '数学',
  12: '语文',
  13: '英语',
  14: '科学',
}

const currentUser = ref<UserSummary | null>(null)
const currentPage = ref<MainPage>('home')
const isInitializing = ref(true)
const authMessage = ref('')
const notice = ref('')
const requestedAssignmentId = ref<number | null>(null)
const assignmentViewKey = ref(0)
const submissionRevision = ref(0)

onMounted(async () => {
  const hadStoredSession = Boolean(authService.getAccessToken())

  try {
    const user = await authService.restoreCurrentUser()
    currentUser.value = user

    if (!user && hadStoredSession) {
      authMessage.value = '登录已失效，请重新登录'
    }
  } catch (error) {
    authMessage.value =
      error instanceof Error
        ? `暂时无法恢复登录：${error.message}`
        : '暂时无法恢复登录，请稍后重试'
  } finally {
    isInitializing.value = false
  }
})

const assignmentRows = computed(() => {
  void submissionRevision.value
  return currentUser.value ? listAssignmentRows(currentUser.value.id) : []
})
const materials = computed(() =>
  currentUser.value ? listCourseware(currentUser.value.id) : [],
)
const pendingCount = computed(
  () =>
    assignmentRows.value.filter(
      ({ status }) =>
        status === 'NOT_SUBMITTED' || status === 'REVISION_REQUIRED',
    ).length,
)
const gradedCount = computed(
  () =>
    assignmentRows.value.filter(({ status }) => status === 'GRADED').length,
)

function handleLoginSuccess(user: UserSummary): void {
  currentUser.value = user
  currentPage.value = 'home'
  authMessage.value = ''
  notice.value = ''
}

async function handleLogout(): Promise<void> {
  let logoutFailure = ''

  try {
    await authService.logout()
  } catch (error) {
    logoutFailure =
      error instanceof Error ? error.message : '认证服务暂时不可用'
  } finally {
    currentUser.value = null
    currentPage.value = 'home'
    authMessage.value = logoutFailure
      ? `退出请求失败：${logoutFailure}。本机登录信息已清除。`
      : ''
  }
}

function navigate(page: MainPage): void {
  currentPage.value = page
  requestedAssignmentId.value = null
  notice.value = ''
}

function openAssignment(assignmentId: number): void {
  requestedAssignmentId.value = assignmentId
  assignmentViewKey.value += 1
  currentPage.value = 'assignments'
  notice.value = ''
}

function handleAssignmentsChanged(): void {
  submissionRevision.value += 1
}

function showDownload(fileName: string): void {
  notice.value = `Mock 下载已准备：${fileName}`
}

function courseName(courseId: number): string {
  return courseNames[courseId] ?? '课程'
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value))
}

function formatBytes(byteSize: number): string {
  return `${(byteSize / 1024 / 1024).toFixed(1)} MB`
}
</script>

<template>
  <main v-if="isInitializing" class="loading-screen" aria-live="polite">
    系统加载中…
  </main>

  <Login
    v-else-if="!currentUser"
    :notice="authMessage"
    @success="handleLoginSuccess"
  />

  <div v-else class="app-shell">
    <aside class="sidebar">
      <div class="brand">
        <span class="brand-mark">K</span>
        <div><strong>K12 学习中心</strong><small>学生端</small></div>
      </div>
      <nav aria-label="学生端主导航">
        <button
          type="button"
          :class="{ active: currentPage === 'home' }"
          @click="navigate('home')"
        >
          <span>⌂</span>首页
        </button>
        <button
          type="button"
          :class="{ active: currentPage === 'courseware' }"
          @click="navigate('courseware')"
        >
          <span>▤</span>课件
        </button>
        <button
          type="button"
          :class="{ active: currentPage === 'assignments' }"
          @click="navigate('assignments')"
        >
          <span>✓</span>作业
          <b v-if="pendingCount">{{ pendingCount }}</b>
        </button>
      </nav>
      <div class="sidebar-note">
        <span>本周学习提醒</span>
        <strong>按截止时间完成作业，订正后记得重新提交。</strong>
      </div>
    </aside>

    <section class="workspace">
      <header class="topbar">
        <div>
          <p class="eyebrow">{{ currentUser.campusName ?? 'K12 校区' }}</p>
          <strong>学生学习空间</strong>
        </div>
        <div class="student-profile">
          <span class="avatar">{{ currentUser.displayName.slice(0, 1) }}</span>
          <div><strong>{{ currentUser.displayName }}</strong><small>学生</small></div>
          <button class="text-button" type="button" @click="handleLogout">
            退出
          </button>
        </div>
      </header>

      <div class="page-content">
        <p v-if="notice" class="success-message" role="status">{{ notice }}</p>

        <section v-if="currentPage === 'home'" class="page-section">
          <div class="welcome-banner">
            <div>
              <p class="eyebrow">你好，{{ currentUser.displayName }}</p>
              <h2>先完成今天最重要的一份作业吧</h2>
              <p>你有 {{ pendingCount }} 份待完成或待订正作业。</p>
              <button
                class="primary-button"
                type="button"
                @click="navigate('assignments')"
              >
                查看作业
              </button>
            </div>
            <div class="banner-symbol" aria-hidden="true">A+</div>
          </div>

          <div class="summary-grid">
            <article class="summary-card coral">
              <span>待处理</span><strong>{{ pendingCount }}</strong><small>份作业</small>
            </article>
            <article class="summary-card blue">
              <span>已批改</span><strong>{{ gradedCount }}</strong><small>份作业</small>
            </article>
            <article class="summary-card green">
              <span>新课件</span><strong>{{ materials.length }}</strong><small>份资料</small>
            </article>
          </div>

          <div class="section-heading">
            <div><p class="eyebrow">下一步</p><h3>待完成作业</h3></div>
            <button class="text-button" type="button" @click="navigate('assignments')">
              查看全部
            </button>
          </div>
          <div class="compact-list">
            <button
              v-for="row in assignmentRows.filter(({ status }) => status === 'NOT_SUBMITTED' || status === 'REVISION_REQUIRED').slice(0, 3)"
              :key="row.assignment.id"
              class="compact-item"
              type="button"
              @click="openAssignment(row.assignment.id)"
            >
              <span class="course-icon">{{ courseName(row.assignment.courseId).slice(0, 1) }}</span>
              <span>
                <strong>{{ row.assignment.title }}</strong>
                <small>{{ courseName(row.assignment.courseId) }} · 截止 {{ formatDateTime(row.assignment.dueAt) }}</small>
              </span>
              <em :class="['status', row.status.toLowerCase()]">
                {{ getSubmissionStatusLabel(row.status) }}
              </em>
            </button>
          </div>
        </section>

        <section v-else-if="currentPage === 'courseware'" class="page-section">
          <div class="page-heading">
            <div>
              <p class="eyebrow">学习资料</p>
              <h2>课件中心</h2>
              <p>按课程查看老师最新发布的课件与附件。</p>
            </div>
          </div>
          <div class="card-grid">
            <article
              v-for="material in materials"
              :key="material.id"
              class="material-card"
            >
              <div class="file-cover">{{ courseName(material.courseId).slice(0, 1) }}</div>
              <div class="material-content">
                <span class="course-tag">{{ courseName(material.courseId) }}</span>
                <h3>{{ material.title }}</h3>
                <p>{{ material.description }}</p>
                <div class="material-files">
                  <button
                    v-for="file in material.attachments"
                    :key="file.id"
                    class="material-file"
                    type="button"
                    @click="showDownload(file.originalName)"
                  >
                    <span>{{ file.originalName }}</span>
                    <small>{{ formatBytes(file.byteSize) }}</small>
                  </button>
                </div>
              </div>
            </article>
          </div>
        </section>

        <Home
          v-else
          :key="assignmentViewKey"
          :current-user="currentUser"
          :initial-assignment-id="requestedAssignmentId"
          @assignments-changed="handleAssignmentsChanged"
        />
      </div>
    </section>
  </div>
</template>

<style scoped>
.loading-screen {
  min-height: 100vh;
  display: grid;
  place-items: center;
  color: #625bcf;
  background: #f5f7fb;
  font-size: 18px;
  font-weight: 800;
}

.material-files {
  display: grid;
  gap: 8px;
  margin-top: 14px;
}

.material-file {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
  width: 100%;
  border: 1px solid #e4e7ef;
  border-radius: 10px;
  padding: 10px 12px;
  color: #4c5870;
  background: #fafbfe;
  text-align: left;
}

.material-file:hover {
  border-color: #aaa5e2;
  background: #f4f3ff;
}

.material-file small {
  min-height: auto;
}
</style>
