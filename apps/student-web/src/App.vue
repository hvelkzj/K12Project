<script setup lang="ts">
import { computed, ref } from 'vue'

import { mockCredentials, mockNow } from './mockData'
import {
  authenticateStudent,
  getAssignment,
  getLatestSubmission,
  getSubmissionHistory,
  getSubmissionViewStatus,
  listAssignments,
  listCourseware,
  submitAssignment,
} from './studentService'
import type {
  FileSummary,
  StudentPage,
  StudentUser,
  SubmissionViewStatus,
} from './types'

const courseNames: Record<number, string> = {
  11: '数学',
  12: '语文',
  13: '英语',
  14: '科学',
}

const statusLabels: Record<SubmissionViewStatus, string> = {
  NOT_SUBMITTED: '未提交',
  SUBMITTED: '已提交',
  GRADED: '已批改',
  REVISION_REQUIRED: '需订正',
}

const page = ref<StudentPage>('login')
const currentStudent = ref<StudentUser | null>(null)
const account = ref(mockCredentials.account)
const password = ref(mockCredentials.password)
const loginError = ref('')
const selectedAssignmentId = ref(301)
const submissionContent = ref('')
const submissionAttachments = ref<FileSummary[]>([])
const submissionError = ref('')
const notice = ref('')
const submissionVersion = ref(0)

const studentId = computed(() => currentStudent.value?.id ?? 1001)
const materials = computed(() => listCourseware(studentId.value))
const assignmentRows = computed(() => {
  void submissionVersion.value
  return listAssignments(studentId.value).map((assignment) => ({
    assignment,
    status: getSubmissionViewStatus(assignment.id, studentId.value),
  }))
})
const selectedAssignment = computed(() =>
  getAssignment(selectedAssignmentId.value, studentId.value),
)
const latestSubmission = computed(() => {
  void submissionVersion.value
  return getLatestSubmission(selectedAssignmentId.value, studentId.value)
})
const submissionHistory = computed(() => {
  void submissionVersion.value
  return getSubmissionHistory(selectedAssignmentId.value, studentId.value)
})
const pendingCount = computed(
  () =>
    assignmentRows.value.filter(
      ({ status }) =>
        status === 'NOT_SUBMITTED' || status === 'REVISION_REQUIRED',
    ).length,
)
const gradedCount = computed(
  () => assignmentRows.value.filter(({ status }) => status === 'GRADED').length,
)
const assignmentPageActive = computed(() =>
  ['assignments', 'assignmentDetail', 'submission', 'result'].includes(page.value),
)

function handleLogin(): void {
  loginError.value = ''
  try {
    currentStudent.value = authenticateStudent(account.value, password.value)
    page.value = 'home'
  } catch (error) {
    loginError.value = error instanceof Error ? error.message : '登录失败'
  }
}

function logout(): void {
  currentStudent.value = null
  loginError.value = ''
  password.value = mockCredentials.password
  page.value = 'login'
}

function navigate(target: StudentPage): void {
  notice.value = ''
  submissionError.value = ''
  page.value = target
}

function openAssignment(assignmentId: number): void {
  selectedAssignmentId.value = assignmentId
  navigate('assignmentDetail')
}

function startSubmission(): void {
  const status = getSubmissionViewStatus(
    selectedAssignmentId.value,
    studentId.value,
  )

  if (status === 'SUBMITTED' || status === 'GRADED') {
    navigate('result')
    return
  }

  submissionContent.value = ''
  submissionAttachments.value = []
  navigate('submission')
}

function addSampleAttachment(): void {
  submissionAttachments.value = [
    {
      id: 9001,
      originalName: '我的作业.pdf',
      mimeType: 'application/pdf',
      byteSize: 428_600,
      createdAt: mockNow,
    },
  ]
}

function handleFileChange(event: Event): void {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]

  if (!file) return

  submissionAttachments.value = [
    {
      id: Date.now(),
      originalName: file.name,
      mimeType: file.type || 'application/octet-stream',
      byteSize: file.size,
      createdAt: mockNow,
    },
  ]
}

function handleSubmission(): void {
  submissionError.value = ''
  try {
    submitAssignment({
      assignmentId: selectedAssignmentId.value,
      studentId: studentId.value,
      content: submissionContent.value,
      attachments: submissionAttachments.value,
      submittedAt: mockNow,
    })
    submissionVersion.value += 1
    navigate('result')
    notice.value = '作业提交成功，老师批改后会更新结果。'
  } catch (error) {
    submissionError.value = error instanceof Error ? error.message : '提交失败'
  }
}

function showDownload(fileName: string): void {
  notice.value = `Mock 下载已准备：${fileName}`
}

function courseName(courseId: number): string {
  return courseNames[courseId] ?? '课程'
}

function statusLabel(status: SubmissionViewStatus): string {
  return statusLabels[status]
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatBytes(byteSize: number): string {
  return `${(byteSize / 1024 / 1024).toFixed(1)} MB`
}
</script>

<template>
  <main v-if="page === 'login'" class="login-page">
    <section class="login-card">
      <div class="login-intro">
        <p class="eyebrow">K12 学习中心</p>
        <h1>今天也一起<br />完成一个小目标</h1>
        <p>查看课件、提交作业，并及时收到老师的批改结果。</p>
        <div class="study-illustration" aria-hidden="true">
          <span>📚</span><span>✏️</span><span>✓</span>
        </div>
      </div>
      <form class="login-form" @submit.prevent="handleLogin">
        <div>
          <p class="eyebrow">学生端</p>
          <h2>欢迎回来</h2>
          <p class="muted">使用测试账号体验第一周 Mock 流程。</p>
        </div>
        <label>
          学生账号
          <input v-model="account" autocomplete="username" />
        </label>
        <label>
          登录密码
          <input
            v-model="password"
            type="password"
            autocomplete="current-password"
          />
        </label>
        <p class="account-tip">
          测试账号：{{ mockCredentials.account }} / {{ mockCredentials.password }}
        </p>
        <p v-if="loginError" class="error-message" role="alert">
          {{ loginError }}
        </p>
        <button class="primary-button wide" type="submit">进入学习中心</button>
      </form>
    </section>
  </main>

  <div v-else class="app-shell">
    <aside class="sidebar">
      <div class="brand">
        <span class="brand-mark">K</span>
        <div><strong>K12 学习中心</strong><small>学生端</small></div>
      </div>
      <nav aria-label="学生端主导航">
        <button :class="{ active: page === 'home' }" @click="navigate('home')">
          <span>⌂</span>首页
        </button>
        <button
          :class="{ active: page === 'courseware' }"
          @click="navigate('courseware')"
        >
          <span>▤</span>课件
        </button>
        <button :class="{ active: assignmentPageActive }" @click="navigate('assignments')">
          <span>✓</span>作业
          <b v-if="pendingCount">{{ pendingCount }}</b>
        </button>
      </nav>
      <div class="sidebar-note">
        <span>连续学习 5 天</span>
        <strong>保持好奇，继续加油！</strong>
      </div>
    </aside>

    <section class="workspace">
      <header class="topbar">
        <div>
          <p class="eyebrow">{{ currentStudent?.campusName }}</p>
          <strong>{{ currentStudent?.className }}</strong>
        </div>
        <div class="student-profile">
          <span class="avatar">林</span>
          <div><strong>{{ currentStudent?.displayName }}</strong><small>学生</small></div>
          <button class="text-button" @click="logout">退出</button>
        </div>
      </header>

      <div class="page-content">
        <p v-if="notice" class="success-message" role="status">{{ notice }}</p>

        <section v-if="page === 'home'" class="page-section">
          <div class="welcome-banner">
            <div>
              <p class="eyebrow">早上好，{{ currentStudent?.displayName }}</p>
              <h2>先完成今天最重要的一份作业吧</h2>
              <p>你有 {{ pendingCount }} 份待完成或待订正作业。</p>
              <button class="primary-button" @click="navigate('assignments')">
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
            <button class="text-button" @click="navigate('assignments')">查看全部</button>
          </div>
          <div class="compact-list">
            <button
              v-for="row in assignmentRows.filter(({ status }) => status === 'NOT_SUBMITTED' || status === 'REVISION_REQUIRED').slice(0, 3)"
              :key="row.assignment.id"
              class="compact-item"
              @click="openAssignment(row.assignment.id)"
            >
              <span class="course-icon">{{ courseName(row.assignment.courseId).slice(0, 1) }}</span>
              <span><strong>{{ row.assignment.title }}</strong><small>{{ courseName(row.assignment.courseId) }} · 截止 {{ formatDateTime(row.assignment.dueAt) }}</small></span>
              <em :class="['status', row.status.toLowerCase()]">{{ statusLabel(row.status) }}</em>
            </button>
          </div>
        </section>

        <section v-else-if="page === 'courseware'" class="page-section">
          <div class="page-heading">
            <div><p class="eyebrow">学习资料</p><h2>课件中心</h2><p>按课程查看老师最新发布的学习资料。</p></div>
          </div>
          <div class="card-grid">
            <article v-for="material in materials" :key="material.id" class="material-card">
              <div class="file-cover">{{ courseName(material.courseId).slice(0, 1) }}</div>
              <div class="material-content">
                <span class="course-tag">{{ material.courseName }}</span>
                <h3>{{ material.title }}</h3>
                <p>{{ material.description }}</p>
                <small>{{ material.file.originalName }} · {{ formatBytes(material.file.byteSize) }}</small>
                <button class="secondary-button" @click="showDownload(material.file.originalName)">Mock 下载</button>
              </div>
            </article>
          </div>
        </section>

        <section v-else-if="page === 'assignments'" class="page-section">
          <div class="page-heading">
            <div><p class="eyebrow">我的任务</p><h2>作业列表</h2><p>查看要求、截止时间与当前提交状态。</p></div>
          </div>
          <div class="assignment-list">
            <article v-for="row in assignmentRows" :key="row.assignment.id" class="assignment-card">
              <div class="assignment-main">
                <span class="course-tag">{{ courseName(row.assignment.courseId) }}</span>
                <h3>{{ row.assignment.title }}</h3>
                <p>{{ row.assignment.description }}</p>
                <small>截止 {{ formatDateTime(row.assignment.dueAt) }} · {{ row.assignment.allowLate ? '允许迟交' : '不允许迟交' }}</small>
              </div>
              <div class="assignment-action">
                <em :class="['status', row.status.toLowerCase()]">{{ statusLabel(row.status) }}</em>
                <button class="secondary-button" @click="openAssignment(row.assignment.id)">查看作业</button>
              </div>
            </article>
          </div>
        </section>

        <section v-else-if="page === 'assignmentDetail'" class="page-section narrow">
          <button class="back-button" @click="navigate('assignments')">← 返回作业列表</button>
          <article class="detail-card">
            <div class="detail-title">
              <div><span class="course-tag">{{ courseName(selectedAssignment.courseId) }}</span><h2>{{ selectedAssignment.title }}</h2></div>
              <em :class="['status', getSubmissionViewStatus(selectedAssignment.id, studentId).toLowerCase()]">{{ statusLabel(getSubmissionViewStatus(selectedAssignment.id, studentId)) }}</em>
            </div>
            <dl class="meta-grid">
              <div><dt>截止时间</dt><dd>{{ formatDateTime(selectedAssignment.dueAt) }}</dd></div>
              <div><dt>迟交规则</dt><dd>{{ selectedAssignment.allowLate ? '允许迟交' : '截止后不可提交' }}</dd></div>
              <div><dt>作业编号</dt><dd>#{{ selectedAssignment.id }}</dd></div>
            </dl>
            <div class="detail-block"><h3>作业要求</h3><p>{{ selectedAssignment.description }}</p></div>
            <div class="detail-block">
              <h3>老师附件</h3>
              <p v-if="selectedAssignment.attachments.length === 0" class="muted">本作业没有附件。</p>
              <button v-for="file in selectedAssignment.attachments" :key="file.id" class="file-row" @click="showDownload(file.originalName)">
                <span>PDF</span><strong>{{ file.originalName }}</strong><small>{{ formatBytes(file.byteSize) }}</small>
              </button>
            </div>
            <div v-if="latestSubmission?.teacherComment" class="teacher-comment">
              <strong>老师评语</strong><p>{{ latestSubmission.teacherComment }}</p>
            </div>
            <button class="primary-button" @click="startSubmission">
              {{ getSubmissionViewStatus(selectedAssignment.id, studentId) === 'REVISION_REQUIRED' ? '提交订正' : getSubmissionViewStatus(selectedAssignment.id, studentId) === 'NOT_SUBMITTED' ? '提交作业' : '查看提交结果' }}
            </button>
          </article>
        </section>

        <section v-else-if="page === 'submission'" class="page-section narrow">
          <button class="back-button" @click="navigate('assignmentDetail')">← 返回作业详情</button>
          <form class="detail-card submission-form" @submit.prevent="handleSubmission">
            <div><p class="eyebrow">第 {{ (latestSubmission?.attempt ?? 0) + 1 }} 次提交</p><h2>{{ selectedAssignment.title }}</h2><p class="muted">截止 {{ formatDateTime(selectedAssignment.dueAt) }}</p></div>
            <label>
              作业正文
              <textarea v-model="submissionContent" rows="8" placeholder="填写解题过程、作文内容或订正说明……"></textarea>
            </label>
            <div class="upload-box">
              <strong>上传附件</strong>
              <p>支持 PDF、DOCX、JPG、PNG，单个文件不超过 10 MB。</p>
              <input type="file" accept=".pdf,.docx,.jpg,.jpeg,.png" @change="handleFileChange" />
              <button class="text-button" type="button" @click="addSampleAttachment">添加示例附件</button>
              <div v-for="file in submissionAttachments" :key="file.id" class="selected-file">
                <span>✓</span><strong>{{ file.originalName }}</strong><small>{{ formatBytes(file.byteSize) }}</small>
              </div>
            </div>
            <p v-if="submissionError" class="error-message" role="alert">{{ submissionError }}</p>
            <div class="form-actions">
              <button class="secondary-button" type="button" @click="navigate('assignmentDetail')">取消</button>
              <button class="primary-button" type="submit">确认提交</button>
            </div>
          </form>
        </section>

        <section v-else-if="page === 'result'" class="page-section narrow">
          <button class="back-button" @click="navigate('assignments')">← 返回作业列表</button>
          <article class="result-card">
            <div class="result-icon">✓</div>
            <p class="eyebrow">提交结果</p>
            <h2>{{ latestSubmission?.status === 'GRADED' ? '老师已完成批改' : '作业已成功提交' }}</h2>
            <p>{{ selectedAssignment.title }} · 第 {{ latestSubmission?.attempt }} 次提交</p>
            <div class="result-summary">
              <div><span>当前状态</span><strong>{{ latestSubmission ? statusLabel(latestSubmission.status) : '未提交' }}</strong></div>
              <div><span>提交时间</span><strong>{{ latestSubmission ? formatDateTime(latestSubmission.submittedAt) : '—' }}</strong></div>
              <div><span>批改成绩</span><strong>{{ latestSubmission?.score ?? '待批改' }}</strong></div>
            </div>
            <div v-if="latestSubmission?.content" class="answer-preview"><strong>提交内容</strong><p>{{ latestSubmission.content }}</p></div>
            <div v-if="latestSubmission?.teacherComment" class="teacher-comment"><strong>老师评语</strong><p>{{ latestSubmission.teacherComment }}</p></div>
            <details v-if="submissionHistory.length > 1">
              <summary>查看 {{ submissionHistory.length }} 次提交记录</summary>
              <p v-for="item in submissionHistory" :key="item.id">第 {{ item.attempt }} 次 · {{ statusLabel(item.status) }} · {{ formatDateTime(item.submittedAt) }}</p>
            </details>
            <button class="primary-button" @click="navigate('assignments')">继续查看作业</button>
          </article>
        </section>
      </div>
    </section>
  </div>
</template>
