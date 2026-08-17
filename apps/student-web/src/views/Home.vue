<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { Assignment, FileSummary, Submission, UserSummary } from '@k12/shared'
import { listAssignmentRows } from '../assignmentListService'
import { getSubmissionHistory, submitAssignment } from '../studentService'
import { isAssignmentSubmissionClosed } from '../assignmentPresentation'
import type { AssignmentListRow } from '../assignmentPresentation'
import AssignmentList from './AssignmentList.vue'

const props = defineProps<{ currentUser: UserSummary }>()
type Page = 'list' | 'detail' | 'submit' | 'result'
type SidePanel = 'statistics' | 'profile' | null
const page = ref<Page>('list')
const activePanel = ref<SidePanel>(null)
const selectedId = ref<number | null>(null)
const currentNow = ref(new Date().toISOString())
const content = ref('')
const attachments = ref<FileSummary[]>([])
const errorMessage = ref('')
const revision = ref(0)
let timer: ReturnType<typeof setInterval> | undefined

onMounted(() => { timer = setInterval(() => { currentNow.value = new Date().toISOString() }, 30_000) })
onUnmounted(() => { if (timer) clearInterval(timer) })

const rows = computed<AssignmentListRow[]>(() => { void revision.value; return listAssignmentRows(props.currentUser.id) })
const selectedRow = computed(() => rows.value.find((row) => row.assignment.id === selectedId.value))
const assignment = computed<Assignment | undefined>(() => selectedRow.value?.assignment)
const latestSubmission = computed<Submission | undefined>(() => selectedRow.value?.latestSubmission)
const submissionHistory = computed<Submission[]>(() => { void revision.value; return selectedId.value === null ? [] : getSubmissionHistory(selectedId.value, props.currentUser.id) })
const isClosed = computed(() => assignment.value ? isAssignmentSubmissionClosed(assignment.value, currentNow.value) : false)
const canSubmit = computed(() => !isClosed.value && (selectedRow.value?.status === 'NOT_SUBMITTED' || selectedRow.value?.status === 'REVISION_REQUIRED'))
const nextAttempt = computed(() => (latestSubmission.value?.attempt ?? 0) + 1)
const completedCount = computed(() => rows.value.filter((row) => row.status === 'SUBMITTED' || row.status === 'GRADED').length)
const revisionCount = computed(() => rows.value.filter((row) => row.status === 'REVISION_REQUIRED').length)
const pendingCount = computed(() => rows.value.filter((row) => row.status === 'NOT_SUBMITTED').length)
const completionPercent = computed(() => rows.value.length === 0 ? 0 : Math.round((completedCount.value / rows.value.length) * 100))

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value))
}
function openAssignment(id: number): void { selectedId.value = id; errorMessage.value = ''; page.value = 'detail' }
function handlePlaceholder(featureName: string): void {
  if (featureName === '作业统计') activePanel.value = 'statistics'
  if (featureName === '个人中心') activePanel.value = 'profile'
}
function beginSubmission(): void { if (!canSubmit.value) return; content.value = ''; attachments.value = []; errorMessage.value = ''; page.value = 'submit' }
function handleFileChange(event: Event): void {
  const files = Array.from((event.target as HTMLInputElement).files ?? [])
  attachments.value = files.map((file, index) => ({ id: Date.now() + index, originalName: file.name, mimeType: file.type || 'application/octet-stream', byteSize: file.size, createdAt: new Date().toISOString() }))
}
function submit(): void {
  if (!assignment.value || !canSubmit.value) { errorMessage.value = '该作业已截止，不能继续提交。'; return }
  try {
    submitAssignment({ assignmentId: assignment.value.id, studentId: props.currentUser.id, content: content.value, attachments: attachments.value, submittedAt: new Date().toISOString() })
    revision.value += 1
    page.value = 'result'
  } catch (error) { errorMessage.value = error instanceof Error ? error.message : '提交失败，请稍后重试。' }
}
</script>

<template>
  <AssignmentList v-if="page === 'list'" :rows="rows" :now="currentNow" @open="openAssignment" @placeholder="handlePlaceholder" />
  <section v-else-if="assignment" class="assignment-workspace">
    <button class="back-button" type="button" @click="page = 'list'">← 返回作业列表</button>
    <article v-if="page === 'detail'" class="panel">
      <div class="detail-hero"><div><p class="eyebrow">我的作业 · Assignment #{{ assignment.id }}</p><h1>{{ assignment.title }}</h1><p class="description">{{ assignment.description }}</p></div><span :class="['status-pill', isClosed ? 'closed' : 'open']">{{ isClosed ? '已截止' : '可提交' }}</span></div>
      <dl class="meta"><div><dt>◷ 截止时间</dt><dd>{{ formatDateTime(assignment.dueAt) }}</dd></div><div><dt>↗ 提交规则</dt><dd>{{ assignment.allowLate ? '允许迟交' : '截止后不可提交' }}</dd></div><div><dt>✓ 当前状态</dt><dd>{{ isClosed && selectedRow?.status === 'NOT_SUBMITTED' ? '已截止' : selectedRow?.status }}</dd></div></dl>
      <div v-if="assignment.attachments.length" class="attachments"><div class="section-title"><span>附件资料</span><small>{{ assignment.attachments.length }} 个文件</small></div><div v-for="file in assignment.attachments" :key="file.id" class="attachment-row"><span class="file-icon">PDF</span><strong>{{ file.originalName }}</strong><small>{{ Math.ceil(file.byteSize / 1024) }} KB</small></div></div>
      <p v-if="isClosed && (selectedRow?.status === 'NOT_SUBMITTED' || selectedRow?.status === 'REVISION_REQUIRED')" class="closed-message">该作业已超过截止时间，提交入口已关闭。</p>
      <button v-if="canSubmit" class="primary-button" type="button" @click="beginSubmission">{{ selectedRow?.status === 'REVISION_REQUIRED' ? '提交订正' : '提交作业' }}</button>
      <button v-else class="secondary-button" type="button" @click="page = 'result'">查看提交结果</button>
    </article>
    <form v-else-if="page === 'submit'" class="panel" @submit.prevent="submit">
      <div class="submit-heading"><div><p class="eyebrow">第 {{ nextAttempt }} 次提交</p><h1>{{ assignment.title }}</h1></div><p class="deadline">截止于 {{ formatDateTime(assignment.dueAt) }}</p></div>
      <label class="field"><span>作业正文 <i>可选，至少提交正文或附件之一</i></span><textarea v-model="content" rows="8" placeholder="请填写解题过程、作文内容或订正说明……"></textarea></label>
      <label class="upload-zone"><input type="file" multiple accept=".pdf,.docx,.jpg,.jpeg,.png" @change="handleFileChange" /><span class="upload-icon">↑</span><strong>选择作业附件</strong><small>支持 PDF、DOCX、JPG、PNG，单个文件不超过 10 MB</small></label>
      <p v-for="file in attachments" :key="file.id" class="file-name">{{ file.originalName }}</p><p v-if="errorMessage" class="error-message" role="alert">{{ errorMessage }}</p>
      <div class="actions"><button class="secondary-button" type="button" @click="page = 'detail'">取消</button><button class="primary-button" type="submit">确认提交</button></div>
    </form>
    <article v-else class="panel result">
      <div class="result-check">✓</div><p class="eyebrow">提交结果</p><h1>{{ latestSubmission ? '作业已成功提交' : '暂无提交记录' }}</h1><p v-if="latestSubmission">第 {{ latestSubmission.attempt }} 次提交 · {{ formatDateTime(latestSubmission.submittedAt) }}</p>
      <p v-if="latestSubmission?.teacherComment" class="comment">老师评语：{{ latestSubmission.teacherComment }}</p>
      <details v-if="submissionHistory.length > 1"><summary>查看 {{ submissionHistory.length }} 次提交历史</summary><p v-for="item in submissionHistory" :key="item.id">第 {{ item.attempt }} 次 · {{ item.status }} · {{ formatDateTime(item.submittedAt) }}</p></details>
      <button class="primary-button" type="button" @click="page = 'list'">返回作业列表</button>
    </article>
  </section>
  <div v-if="activePanel" class="panel-overlay" @click.self="activePanel = null">
    <aside class="side-panel" role="dialog" aria-modal="true" :aria-label="activePanel === 'statistics' ? '作业统计' : '我的学习档案'">
      <button class="close-button" type="button" aria-label="关闭" @click="activePanel = null">×</button>
      <template v-if="activePanel === 'statistics'">
        <p class="eyebrow">学习进度</p><h2>作业统计</h2><p class="panel-subtitle">实时根据你的提交状态更新。</p>
        <div class="ring" :style="{ '--progress': `${completionPercent * 3.6}deg` }"><strong>{{ completionPercent }}%</strong><span>完成率</span></div>
        <div class="stats-grid"><div><strong>{{ rows.length }}</strong><span>全部作业</span></div><div><strong>{{ completedCount }}</strong><span>已完成</span></div><div><strong>{{ pendingCount }}</strong><span>待提交</span></div><div><strong>{{ revisionCount }}</strong><span>待订正</span></div></div>
        <div class="tip-card"><strong>学习建议</strong><p>{{ revisionCount ? '你有需要订正的作业，建议优先根据老师评语完成修改。' : pendingCount ? '还有待完成作业，按截止时间逐项完成吧。' : '所有作业均已处理，做得很棒！' }}</p></div>
      </template>
      <template v-else>
        <p class="eyebrow">个人中心</p><h2>我的学习档案</h2>
        <div class="profile-card"><span>{{ props.currentUser.displayName.slice(0, 1) }}</span><div><strong>{{ props.currentUser.displayName }}</strong><small>学生 · 校区 #{{ props.currentUser.campusId }}</small></div></div>
        <dl class="profile-list"><div><dt>账号角色</dt><dd>学生</dd></div><div><dt>所属校区</dt><dd>{{ props.currentUser.campusName ?? '—' }}</dd></div><div><dt>本周完成</dt><dd>{{ completedCount }} 份作业</dd></div><div><dt>当前登录状态</dt><dd class="online">● 已登录</dd></div></dl>
        <p class="privacy-note">个人信息来自当前认证会话；退出登录后会清除本地访问令牌。</p>
      </template>
    </aside>
  </div>
</template>

<style scoped>
.assignment-workspace { max-width: 960px; margin: 0 auto; }.back-button, .secondary-button, .primary-button { border: 0; border-radius: 10px; padding: 11px 17px; font-weight: 800; cursor: pointer; transition: transform .2s, box-shadow .2s; }.back-button, .secondary-button { color: #536079; background: #eef0f7; }.primary-button { color: #fff; background: linear-gradient(135deg, #746de2, #564cc4); box-shadow: 0 8px 18px rgb(98 91 207 / 25%); }.primary-button:hover { transform: translateY(-1px); box-shadow: 0 12px 22px rgb(98 91 207 / 30%); }.panel { margin-top: 16px; padding: 32px; border: 1px solid #e4e7ef; border-radius: 22px; background: #fff; box-shadow: 0 14px 38px rgb(38 51 75 / 10%); }.detail-hero, .submit-heading { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; }.eyebrow { margin: 0; color: #6c64d7; font-size: 12px; font-weight: 850; letter-spacing: .08em; }h1 { margin: 9px 0 12px; color: #263247; font-size: clamp(27px, 4vw, 36px); }.description, .deadline { color: #68748a; line-height: 1.75; }.status-pill { flex: 0 0 auto; border-radius: 999px; padding: 7px 12px; font-size: 13px; font-weight: 800; }.status-pill.open { color: #23845f; background: #e8f7f0; }.status-pill.closed { color: #b64f55; background: #ffeded; }.meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 24px; }.meta div { padding: 15px; border-radius: 13px; background: #f7f8fc; }.meta dt { color: #7a8496; font-size: 12px; }.meta dd { margin: 7px 0 0; color: #34425a; font-weight: 800; }.attachments { margin: 20px 0; padding: 17px; border: 1px solid #e9ebf2; border-radius: 14px; }.section-title { display: flex; justify-content: space-between; margin-bottom: 12px; font-weight: 800; }.section-title small { color: #8991a0; font-weight: 600; }.attachment-row { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 10px; padding: 10px; border-radius: 10px; background: #f8f9fd; }.attachment-row small { color: #8490a3; }.file-icon { border-radius: 6px; padding: 4px 5px; color: #ce555b; background: #ffe8e8; font-size: 10px; font-weight: 900; }.closed-message, .error-message { margin: 18px 0; color: #b54d4f; font-weight: 700; }.field { display: grid; gap: 9px; margin-top: 22px; font-weight: 800; color: #3e4960; }.field i { color: #9299a7; font-size: 12px; font-style: normal; font-weight: 500; }.field textarea { border: 1px solid #d7dce8; border-radius: 12px; padding: 14px; font: inherit; line-height: 1.6; resize: vertical; }.field textarea:focus { outline: 3px solid rgb(98 91 207 / 15%); border-color: #746de2; }.upload-zone { display: grid; place-items: center; gap: 7px; margin-top: 18px; padding: 24px; border: 2px dashed #d9d6fa; border-radius: 14px; color: #57627a; background: #fafaff; cursor: pointer; }.upload-zone input { display: none; }.upload-zone small { color: #8b94a6; }.upload-icon { display: grid; width: 34px; height: 34px; place-items: center; border-radius: 50%; color: #625bcf; background: #eeecff; font-size: 21px; }.file-name { margin: 9px 0; color: #50607c; }.actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 24px; }.result { text-align: center; }.result-check { display: grid; width: 56px; height: 56px; place-items: center; margin: 0 auto 16px; border-radius: 50%; color: #fff; background: #42aa80; font-size: 28px; font-weight: 900; }.result details { margin: 18px 0; color: #536079; text-align: left; }@media (max-width: 650px) { .detail-hero, .submit-heading { flex-direction: column; }.meta { grid-template-columns: 1fr; }.panel { padding: 22px; } }
.panel-overlay { position: fixed; z-index: 20; inset: 0; display: flex; justify-content: flex-end; background: rgb(31 40 60 / 35%); backdrop-filter: blur(2px); }.side-panel { width: min(400px, 92vw); min-height: 100%; padding: 32px; color: #2e3850; background: #fff; box-shadow: -18px 0 42px rgb(25 34 55 / 18%); }.side-panel h2 { margin: 8px 0; font-size: 28px; }.close-button { float: right; border: 0; border-radius: 50%; width: 32px; height: 32px; color: #68748a; background: #f1f2f7; font-size: 23px; cursor: pointer; }.panel-subtitle { margin: 0; color: #8790a0; }.ring { display: grid; width: 142px; height: 142px; place-content: center; margin: 28px auto; border-radius: 50%; background: radial-gradient(closest-side, white 77%, transparent 78% 100%), conic-gradient(#625bcf var(--progress), #ececf5 0); text-align: center; }.ring strong { font-size: 27px; }.ring span { color: #8991a0; font-size: 12px; }.stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }.stats-grid div { display: grid; gap: 4px; padding: 15px; border-radius: 13px; background: #f7f8fc; }.stats-grid strong { color: #625bcf; font-size: 25px; }.stats-grid span, .profile-card small { color: #8490a3; font-size: 12px; }.tip-card, .privacy-note { margin-top: 18px; padding: 16px; border-radius: 13px; color: #536079; background: #f2f1ff; line-height: 1.6; }.tip-card p { margin: 6px 0 0; }.profile-card { display: flex; align-items: center; gap: 13px; margin: 24px 0; padding: 18px; border-radius: 15px; background: linear-gradient(135deg, #f0efff, #fff4ef); }.profile-card > span { display: grid; width: 48px; height: 48px; place-items: center; border-radius: 50%; color: #fff; background: #ed956c; font-size: 20px; font-weight: 900; }.profile-card div { display: grid; gap: 4px; }.profile-list { margin: 0; }.profile-list div { display: flex; justify-content: space-between; padding: 14px 0; border-bottom: 1px solid #edf0f5; }.profile-list dt { color: #8991a0; }.profile-list dd { margin: 0; font-weight: 750; }.online { color: #23845f; }
</style>
