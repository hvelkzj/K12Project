<script setup lang="ts">
import { computed, reactive, ref } from 'vue'

type PageKey =
  | 'login'
  | 'today'
  | 'attendance'
  | 'publish'
  | 'grading'
  | 'feedback'
  | 'schedule-change'

type Role = 'teacher' | 'headTeacher'

const pages: Array<{ key: PageKey; label: string; shortLabel: string }> = [
  { key: 'login', label: '登录', shortLabel: '登录' },
  { key: 'today', label: '今日课程', shortLabel: '课程' },
  { key: 'attendance', label: '课堂签到', shortLabel: '签到' },
  { key: 'publish', label: '发布作业', shortLabel: '作业' },
  { key: 'grading', label: '作业批改', shortLabel: '批改' },
  { key: 'feedback', label: '课后反馈', shortLabel: '反馈' },
  { key: 'schedule-change', label: '调课申请', shortLabel: '调课' },
]

const activePage = ref<PageKey>('today')
const activeRole = ref<Role>('teacher')
const notice = ref('')

const roleName = computed(() =>
  activeRole.value === 'teacher' ? '任课教师' : '班主任',
)

const scopeDescription = computed(() =>
  activeRole.value === 'teacher'
    ? '仅显示本人授课的课程与班级数据'
    : '显示本人负责班级的数据，不扩展到其他班级',
)

const todayCourses = [
  {
    time: '09:00–10:30',
    name: '数学提高班',
    className: '六年级 1 班',
    room: 'A-302',
    attendance: '待签到',
  },
  {
    time: '14:00–15:30',
    name: '数学思维训练',
    className: '六年级 2 班',
    room: 'B-205',
    attendance: '未开始',
  },
]

const students = ref([
  { id: 'S001', name: '林晓雨', attendance: 'present', note: '' },
  { id: 'S002', name: '周明轩', attendance: 'late', note: '迟到 8 分钟' },
  { id: 'S003', name: '陈安然', attendance: 'leave', note: '已提交请假' },
  { id: 'S004', name: '许嘉宁', attendance: 'present', note: '' },
])

const assignment = reactive({
  title: '分数乘法巩固练习',
  content: '完成练习册第 18–20 页，写出计算过程。',
  deadline: '2026-08-08T20:00',
  allowLate: false,
})

const submissions = ref([
  { student: '林晓雨', submittedAt: '08-06 19:24', score: 92, correction: false },
  { student: '周明轩', submittedAt: '08-06 20:03', score: 78, correction: true },
  { student: '许嘉宁', submittedAt: '08-06 20:17', score: 88, correction: false },
])

const feedback = reactive({
  student: 'S001',
  performance: '课堂专注，能主动回答问题。',
  strengths: '分数乘法计算准确。',
  improvements: '应用题的单位换算需要更细心。',
  suggestion: '本周复习练习册中的单位换算题。',
})

const scheduleChange = reactive({
  requestedDate: '2026-08-10',
  startTime: '10:00',
  endTime: '11:30',
  reason: '参加学校教研活动',
})

function goTo(page: PageKey) {
  activePage.value = page
  notice.value = ''
}

function showNotice(message: string) {
  notice.value = message
}

function login() {
  goTo('today')
  showNotice(`已使用 ${roleName.value} Mock 账号进入教师端`)
}
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="brand">
        <span class="brand-mark">K</span>
        <div>
          <strong>K12 教学台</strong>
          <small>教师 / 班主任端</small>
        </div>
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
          <span class="nav-dot" aria-hidden="true"></span>
          <span>{{ page.label }}</span>
        </button>
      </nav>

      <div class="scope-card">
        <span>当前数据范围</span>
        <strong>{{ roleName }}</strong>
        <p>{{ scopeDescription }}</p>
      </div>
    </aside>

    <main class="workspace">
      <header class="topbar">
        <div>
          <p class="eyebrow">2026 年 8 月 7 日 · 星期五</p>
          <h1>{{ pages.find((page) => page.key === activePage)?.label }}</h1>
        </div>
        <label class="role-switch">
          <span>演示角色</span>
          <select v-model="activeRole">
            <option value="teacher">任课教师</option>
            <option value="headTeacher">班主任</option>
          </select>
        </label>
      </header>

      <div v-if="notice" class="notice" role="status">{{ notice }}</div>

      <section v-if="activePage === 'login'" class="panel login-panel">
        <div>
          <p class="eyebrow">Mock 登录</p>
          <h2>进入教师工作台</h2>
          <p class="muted">登录接口接入前，仅演示角色与页面范围，不保存账号信息。</p>
        </div>
        <div class="form-grid compact-form">
          <label>
            <span>账号</span>
            <input value="teacher_d" readonly />
          </label>
          <label>
            <span>角色</span>
            <select v-model="activeRole">
              <option value="teacher">任课教师</option>
              <option value="headTeacher">班主任</option>
            </select>
          </label>
          <button class="primary" type="button" @click="login">登录并查看今日课程</button>
        </div>
      </section>

      <template v-else-if="activePage === 'today'">
        <section class="summary-grid" aria-label="今日概览">
          <article><span>今日课程</span><strong>2</strong><small>均为本人授课</small></article>
          <article><span>待批改</span><strong>12</strong><small>1 项作业</small></article>
          <article><span>待发反馈</span><strong>4</strong><small>今日课程学生</small></article>
          <article><span>调课申请</span><strong>1</strong><small>等待教务处理</small></article>
        </section>

        <section class="panel">
          <div class="section-heading">
            <div><p class="eyebrow">课程日程</p><h2>今天的课程</h2></div>
            <span class="mock-tag">Mock 数据</span>
          </div>
          <div class="course-list">
            <article v-for="course in todayCourses" :key="course.time" class="course-card">
              <time>{{ course.time }}</time>
              <div class="course-main">
                <h3>{{ course.name }}</h3>
                <p>{{ course.className }} · {{ course.room }}</p>
              </div>
              <span class="status">{{ course.attendance }}</span>
              <div class="card-actions">
                <button class="secondary" type="button" @click="goTo('schedule-change')">申请调课</button>
                <button class="primary" type="button" @click="goTo('attendance')">进入签到</button>
              </div>
            </article>
          </div>
        </section>
      </template>

      <section v-else-if="activePage === 'attendance'" class="panel">
        <div class="section-heading">
          <div><p class="eyebrow">09:00–10:30 · A-302</p><h2>六年级 1 班课堂签到</h2></div>
          <span class="status">4 名学生</span>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>学生</th><th>签到状态</th><th>备注</th></tr></thead>
            <tbody>
              <tr v-for="student in students" :key="student.id">
                <td><strong>{{ student.name }}</strong><small>{{ student.id }}</small></td>
                <td>
                  <select v-model="student.attendance">
                    <option value="present">出勤</option>
                    <option value="late">迟到</option>
                    <option value="absent">缺勤</option>
                    <option value="leave">请假</option>
                  </select>
                </td>
                <td><input v-model="student.note" placeholder="可选备注" /></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="panel-footer">
          <p class="muted">重复提交由后端按课程和学生校验；本页暂不定义公共状态值。</p>
          <button class="primary" type="button" @click="showNotice('签到 Mock 已保存')">保存签到</button>
        </div>
      </section>

      <section v-else-if="activePage === 'publish'" class="panel">
        <div class="section-heading">
          <div><p class="eyebrow">教师发布</p><h2>新建作业</h2></div>
          <span class="mock-tag">字段待与 C 确认</span>
        </div>
        <form class="form-grid" @submit.prevent="showNotice('作业发布 Mock 已提交')">
          <label class="full"><span>班级与课程</span><select><option>六年级 1 班 · 数学提高班</option></select></label>
          <label class="full"><span>作业标题</span><input v-model="assignment.title" required /></label>
          <label class="full"><span>作业内容</span><textarea v-model="assignment.content" rows="4" required></textarea></label>
          <label><span>截止时间</span><input v-model="assignment.deadline" type="datetime-local" required /></label>
          <label class="check-field"><input v-model="assignment.allowLate" type="checkbox" /><span>允许截止后提交</span></label>
          <div class="full form-actions"><button class="primary" type="submit">发布作业</button></div>
        </form>
      </section>

      <section v-else-if="activePage === 'grading'" class="panel">
        <div class="section-heading">
          <div><p class="eyebrow">分数乘法巩固练习</p><h2>学生提交与批改</h2></div>
          <span class="status">3 / 4 已提交</span>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>学生</th><th>提交时间</th><th>分数</th><th>订正</th></tr></thead>
            <tbody>
              <tr v-for="item in submissions" :key="item.student">
                <td><strong>{{ item.student }}</strong></td>
                <td>{{ item.submittedAt }}</td>
                <td><input v-model="item.score" class="score-input" type="number" min="0" max="100" /></td>
                <td><label class="inline-check"><input v-model="item.correction" type="checkbox" />需订正</label></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="panel-footer">
          <p class="muted">批改状态、订正次数与 C 成员确认后接入。</p>
          <button class="primary" type="button" @click="showNotice('批改结果 Mock 已保存')">保存批改</button>
        </div>
      </section>

      <section v-else-if="activePage === 'feedback'" class="panel">
        <div class="section-heading">
          <div><p class="eyebrow">课后家校沟通</p><h2>发送学生反馈</h2></div>
          <span class="mock-tag">状态待与 B、E 确认</span>
        </div>
        <form class="form-grid" @submit.prevent="showNotice('课后反馈 Mock 已发送')">
          <label><span>课程</span><select><option>六年级 1 班 · 数学提高班</option></select></label>
          <label><span>学生</span><select v-model="feedback.student"><option value="S001">林晓雨</option><option value="S002">周明轩</option></select></label>
          <label class="full"><span>课堂表现</span><textarea v-model="feedback.performance" rows="2" required></textarea></label>
          <label><span>优点</span><textarea v-model="feedback.strengths" rows="3" required></textarea></label>
          <label><span>待提升</span><textarea v-model="feedback.improvements" rows="3" required></textarea></label>
          <label class="full"><span>学习建议</span><textarea v-model="feedback.suggestion" rows="3" required></textarea></label>
          <div class="full form-actions"><button class="primary" type="submit">发送给家长</button></div>
        </form>
      </section>

      <section v-else class="panel">
        <div class="section-heading">
          <div><p class="eyebrow">当前课程：8 月 10 日 09:00–10:30</p><h2>提交调课申请</h2></div>
          <span class="mock-tag">审批由 E 负责</span>
        </div>
        <form class="form-grid" @submit.prevent="showNotice('调课申请 Mock 已提交，等待教务审批')">
          <label class="full"><span>课程</span><input value="六年级 1 班 · 数学提高班 · A-302" readonly /></label>
          <label><span>申请日期</span><input v-model="scheduleChange.requestedDate" type="date" required /></label>
          <div class="time-fields">
            <label><span>开始时间</span><input v-model="scheduleChange.startTime" type="time" required /></label>
            <label><span>结束时间</span><input v-model="scheduleChange.endTime" type="time" required /></label>
          </div>
          <label class="full"><span>调课原因</span><textarea v-model="scheduleChange.reason" rows="4" required></textarea></label>
          <div class="full flow-note">
            <strong>后续流程</strong>
            <span>教务审批 → 安排代课 → 通知家长</span>
          </div>
          <div class="full form-actions"><button class="primary" type="submit">提交调课申请</button></div>
        </form>
      </section>
    </main>

    <nav class="mobile-nav" aria-label="移动端教师端页面">
      <button
        v-for="page in pages.slice(1)"
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
