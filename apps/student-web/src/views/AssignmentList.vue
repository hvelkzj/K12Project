<script setup lang="ts">
import { computed, ref } from 'vue'
import type { CourseSummary } from '@k12/shared'

import {
  calculateGlobalProgress,
  formatCountdown,
  getAssignmentActionLabel,
  getAssignmentProgress,
  getScoreGrade,
  getSubmissionStatusLabel,
  isAssignmentSubmissionClosed,
} from '../assignmentPresentation'
import type { AssignmentListRow } from '../assignmentPresentation'
import {
  assignmentStatusFilters,
  filterAssignmentRows,
  listCourseFilterOptions,
} from '../assignmentFilters'
import type { AssignmentStatusFilter } from '../assignmentFilters'
import {
  getCourseDisplayCode,
  getCourseDisplayIcon,
  getCourseDisplayName,
} from '../coursePresentation'
import type { SubmissionViewStatus } from '../types'

const props = defineProps<{
  rows: AssignmentListRow[]
  now: string
  courses: CourseSummary[]
}>()

const emit = defineEmits<{
  open: [assignmentId: number]
  placeholder: [featureName: string]
}>()

const statusFilter = ref<AssignmentStatusFilter>('ALL')
const courseFilter = ref<number | 'ALL'>('ALL')

const courseOptions = computed(() =>
  listCourseFilterOptions(props.rows, props.courses),
)

const filteredRows = computed(() =>
  filterAssignmentRows(props.rows, {
    status: statusFilter.value,
    courseId: courseFilter.value,
  }),
)

const statusIcons: Record<SubmissionViewStatus, string> = {
  NOT_SUBMITTED: '◷',
  SUBMITTED: '✓',
  GRADED: '●',
  REVISION_REQUIRED: '!',
}

const globalProgressPercent = computed(() =>
  calculateGlobalProgress(props.rows.map((row) => row.status)),
)

function courseCode(courseId: number): string {
  return getCourseDisplayCode(props.courses, courseId)
}

function courseName(courseId: number): string {
  return getCourseDisplayName(props.courses, courseId)
}

function courseIcon(courseId: number): string {
  return getCourseDisplayIcon(props.courses, courseId)
}

function statusClass(status: SubmissionViewStatus): string {
  return status.toLowerCase().replace(/_/g, '-')
}

function statusFilterLabel(filter: AssignmentStatusFilter): string {
  return filter === 'ALL' ? '全部' : getSubmissionStatusLabel(filter)
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

function scoreColor(score: number): string {
  if (score >= 90) return '#23845f'
  if (score >= 70) return '#356fbd'
  return '#b64f55'
}

function actionLabel(row: AssignmentListRow): string {
  return getAssignmentActionLabel(
    row.status,
    isAssignmentSubmissionClosed(row.assignment, props.now),
  )
}

function assignmentAriaLabel(row: AssignmentListRow): string {
  const countdown = formatCountdown(row.assignment.dueAt, props.now)
  const score =
    row.latestSubmission?.score === undefined
      ? ''
      : `，得分 ${row.latestSubmission.score}`

  return [
    `${courseName(row.assignment.courseId)}作业：${row.assignment.title}`,
    getSubmissionStatusLabel(row.status),
    countdown,
    `${actionLabel(row)}${score}`,
  ].join('，')
}
</script>

<template>
  <section class="c-assignment-page" aria-labelledby="assignment-page-title">
    <header class="c-assignment-header">
      <div>
        <p class="c-eyebrow">我的任务</p>
        <h1 id="assignment-page-title">我的作业本</h1>
      </div>
      <div class="c-header-actions" aria-label="作业辅助功能">
        <button
          class="c-header-button c-dashboard-button"
          type="button"
          @click="emit('placeholder', '作业统计')"
        >
          <span aria-hidden="true">▥</span>作业统计
        </button>
        <button
          class="c-header-button c-icon-button"
          type="button"
          aria-label="日历（暂未开放）"
          title="日历暂未开放"
          disabled
        >
          <span aria-hidden="true">□</span>
        </button>
        <button
          class="c-header-button c-icon-button"
          type="button"
          aria-label="消息通知（暂未开放）"
          title="消息通知暂未开放"
          disabled
        >
          <span aria-hidden="true">♢</span>
        </button>
        <button
          class="c-user-profile"
          type="button"
          @click="emit('placeholder', '个人中心')"
        >
          <span class="c-avatar" aria-hidden="true">林</span>
          <span>我的</span>
        </button>
      </div>
    </header>

    <div class="c-global-progress">
      <strong>全局完成率</strong>
      <div
        class="c-progress-track"
        role="progressbar"
        aria-label="作业全局完成率"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-valuenow="globalProgressPercent"
      >
        <span
          class="c-progress-fill"
          :style="{ width: `${globalProgressPercent}%` }"
        ></span>
      </div>
      <b>{{ globalProgressPercent }}%</b>
    </div>

    <div class="c-filter-bar">
      <div class="c-status-filters" role="group" aria-label="按状态筛选作业">
        <button
          v-for="filter in assignmentStatusFilters"
          :key="filter"
          type="button"
          :class="['c-filter-chip', { active: statusFilter === filter }]"
          @click="statusFilter = filter"
        >
          {{ statusFilterLabel(filter) }}
        </button>
      </div>
      <label class="c-course-filter">
        <span class="c-filter-label">课程</span>
        <select v-model="courseFilter" aria-label="按课程筛选作业">
          <option :value="'ALL'">全部课程</option>
          <option
            v-for="option in courseOptions"
            :key="option.courseId"
            :value="option.courseId"
          >
            {{ option.name }}
          </option>
        </select>
      </label>
    </div>

    <p v-if="rows.length === 0" class="c-empty-state">
      当前没有已发布的作业。
    </p>
    <p v-else-if="filteredRows.length === 0" class="c-empty-state">
      没有符合筛选条件的作业，试试其他筛选。
    </p>
    <div v-else class="c-assignment-grid">
      <article
        v-for="row in filteredRows"
        :key="row.assignment.id"
        class="c-assignment-card"
        :aria-label="assignmentAriaLabel(row)"
      >
        <div
          class="c-card-clickable"
          role="button"
          tabindex="0"
          @click="emit('open', row.assignment.id)"
          @keydown.enter.space.prevent="emit('open', row.assignment.id)"
        >
          <div class="c-card-body">
            <div class="c-card-meta">
              <span
                :class="['c-course-tag', `course-${row.assignment.courseId}`]"
                :title="courseName(row.assignment.courseId)"
              >
                <span class="c-course-icon" aria-hidden="true">
                  {{ courseIcon(row.assignment.courseId) }}
                </span>
                {{ courseCode(row.assignment.courseId) }}
              </span>
              <span
                :class="['c-status-badge', statusClass(row.status)]"
              >
                <span aria-hidden="true">{{ statusIcons[row.status] }}</span>
                {{ getSubmissionStatusLabel(row.status) }}
              </span>
            </div>

            <strong class="c-assignment-title">{{ row.assignment.title }}</strong>
            <span class="c-assignment-description">
              {{ row.assignment.description }}
            </span>
            <span class="c-time-row">
              倒计时时间：
              <b>{{ formatCountdown(row.assignment.dueAt, now) }}</b>
            </span>
            <span class="c-time-row">
              截止时间：<b>{{ formatDateTime(row.assignment.dueAt) }}</b>
            </span>
            <span class="c-late-rule">
              {{ row.assignment.allowLate ? '允许迟交' : '截止后不可提交' }}
            </span>

            <span
              v-if="row.latestSubmission?.score != null"
              class="c-score-card"
            >
              <span class="c-score-main">
                <strong :style="{ color: scoreColor(row.latestSubmission.score) }">
                  得分：{{ row.latestSubmission.score }}
                </strong>
                <b>{{ getScoreGrade(row.latestSubmission.score) }}</b>
              </span>
              <span v-if="row.latestSubmission.teacherComment" class="c-feedback">
                老师评语：{{ row.latestSubmission.teacherComment }}
              </span>
            </span>
          </div>
        </div>

        <div class="c-card-footer">
          <span class="c-card-progress">
            <span>{{ getAssignmentProgress(row.status)?.text || '未开始' }}</span>
            <span class="c-card-progress-track">
              <span
                class="c-card-progress-fill"
                :style="{
                  width: `${getAssignmentProgress(row.status)?.percent || 0}%`,
                }"
              ></span>
            </span>
          </span>
          <button
            class="c-action-button"
            type="button"
            @click.stop="emit('open', row.assignment.id)"
          >
            {{ actionLabel(row) }}
          </button>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.c-assignment-page {
  --c-primary: #625bcf;
  --c-text: #263247;
  --c-muted: #7c8596;
  --c-shadow: 0 10px 30px rgb(38 51 75 / 8%);
  color: var(--c-text);
}

.c-assignment-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 20px 24px;
  border: 1px solid #e7e9f0;
  border-radius: 18px;
  background: #fff;
  box-shadow: var(--c-shadow);
}

.c-assignment-header h1 {
  margin: 0;
  font-size: clamp(26px, 4vw, 34px);
}

.c-eyebrow {
  margin: 0 0 5px;
  color: var(--c-primary);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.c-header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.c-header-button,
.c-user-profile {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-height: 40px;
  border: 0;
  border-radius: 10px;
  padding: 8px 12px;
  color: #445068;
  background: #f7f8fb;
  font-weight: 750;
}

.c-header-button:hover,
.c-user-profile:hover {
  background: #eeeff8;
}

.c-header-button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.c-dashboard-button {
  color: var(--c-primary);
  background: #f0efff;
}

.c-icon-button {
  width: 40px;
  padding-inline: 0;
}

.c-avatar {
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border-radius: 50%;
  color: #fff;
  background: #ed956c;
  font-weight: 900;
}

.c-global-progress {
  display: grid;
  grid-template-columns: auto 1fr 48px;
  align-items: center;
  gap: 16px;
  margin-top: 20px;
  padding: 17px 20px;
  border: 1px solid #e7e9f0;
  border-radius: 14px;
  background: #fff;
  box-shadow: var(--c-shadow);
}

.c-global-progress b {
  color: #637086;
  text-align: right;
}

.c-progress-track,
.c-card-progress-track {
  overflow: hidden;
  border-radius: 999px;
  background: #e9ebf1;
}

.c-progress-track {
  height: 10px;
}

.c-progress-fill,
.c-card-progress-fill {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: #41a77d;
  transition: width 0.3s ease;
}

.c-assignment-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 22px;
  margin-top: 22px;
}

.c-assignment-card {
  display: flex;
  min-width: 0;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid #e3e6ee;
  border-radius: 16px;
  padding: 0;
  color: inherit;
  background: #fff;
  box-shadow: var(--c-shadow);
  text-align: left;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.c-assignment-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 16px 38px rgb(38 51 75 / 13%);
}

.c-card-clickable {
  display: flex;
  flex: 1;
  flex-direction: column;
  cursor: pointer;
}

.c-card-clickable:focus-visible {
  outline: 3px solid rgb(98 91 207 / 25%);
  outline-offset: -3px;
}

.c-card-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  padding: 22px;
}

.c-card-meta,
.c-score-main,
.c-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.c-card-meta {
  margin-bottom: 18px;
}

.c-course-tag,
.c-status-badge,
.c-late-rule {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  gap: 6px;
  border-radius: 999px;
  padding: 5px 10px;
  font-size: 12px;
  font-weight: 850;
}

.c-course-tag {
  color: #356fbd;
  background: #e9f2ff;
}

.c-course-tag.course-12 {
  color: #8c5c17;
  background: #fff2d8;
}

.c-course-tag.course-13 {
  color: #26765a;
  background: #e8f7f0;
}

.c-course-tag.course-14 {
  color: #9a4d75;
  background: #fbeaf3;
}

.c-course-icon {
  font-size: 15px;
}

.c-status-badge.not-submitted {
  color: #8c5c17;
  background: #fff2d8;
}

.c-status-badge.submitted {
  color: #376db4;
  background: #e9f2ff;
}

.c-status-badge.graded {
  color: #26765a;
  background: #e8f7f0;
}

.c-status-badge.revision-required {
  color: #b54d4f;
  background: #ffeded;
}

.c-assignment-title {
  margin-bottom: 10px;
  font-size: 18px;
}

.c-assignment-description {
  min-height: 48px;
  margin-bottom: 16px;
  color: #667185;
  line-height: 1.6;
}

.c-time-row {
  margin-bottom: 6px;
  color: var(--c-muted);
  font-size: 13px;
}

.c-time-row b {
  color: #3f4a60;
}

.c-late-rule {
  margin-top: 7px;
  color: #655fae;
  background: #f1efff;
}

.c-score-card {
  display: grid;
  gap: 8px;
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1px solid #edf0f4;
}

.c-score-main strong {
  font-size: 17px;
}

.c-score-main b {
  color: #23845f;
  font-size: 22px;
}

.c-feedback {
  color: #7b8495;
  font-size: 12px;
  line-height: 1.5;
}

.c-card-footer {
  padding: 15px 22px;
  border-top: 1px solid #edf0f4;
  background: #fbfcfe;
}

.c-card-progress {
  display: grid;
  width: min(160px, 55%);
  gap: 6px;
  color: #7b8495;
  font-size: 12px;
}

.c-card-progress-track {
  height: 6px;
}

.c-action-button {
  border: 0;
  border-radius: 10px;
  padding: 8px 16px;
  color: #fff;
  background: var(--c-primary);
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
}

.c-action-button:hover {
  opacity: 0.9;
}

.c-empty-state {
  margin-top: 22px;
  padding: 40px;
  border: 1px dashed #cfd3df;
  border-radius: 16px;
  color: var(--c-muted);
  background: #fff;
  text-align: center;
}

.c-filter-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 14px;
  margin-top: 20px;
  padding: 14px 18px;
  border: 1px solid #e7e9f0;
  border-radius: 14px;
  background: #fff;
  box-shadow: var(--c-shadow);
}

.c-status-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.c-filter-chip {
  border: 1px solid #e3e6ee;
  border-radius: 999px;
  padding: 6px 14px;
  color: #5d6880;
  background: #f7f8fb;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
}

.c-filter-chip:hover {
  background: #eeeff8;
}

.c-filter-chip.active {
  color: #fff;
  border-color: var(--c-primary);
  background: var(--c-primary);
}

.c-course-filter {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.c-filter-label {
  color: var(--c-muted);
  font-size: 13px;
  font-weight: 750;
}

.c-course-filter select {
  border: 1px solid #d7dce8;
  border-radius: 10px;
  padding: 7px 10px;
  color: #3f4a60;
  background: #fbfcfe;
  font: inherit;
  font-size: 13px;
  font-weight: 750;
  cursor: pointer;
}

@media (max-width: 760px) {
  .c-assignment-header {
    align-items: stretch;
    flex-direction: column;
  }

  .c-header-actions {
    flex-wrap: wrap;
  }

  .c-user-profile {
    margin-left: auto;
  }

  .c-global-progress {
    grid-template-columns: 1fr auto;
  }

  .c-global-progress .c-progress-track {
    grid-column: 1 / -1;
    grid-row: 2;
  }
}

@media (max-width: 460px) {
  .c-dashboard-button {
    flex: 1;
  }

  .c-user-profile > span:last-child {
    display: none;
  }

  .c-assignment-grid {
    grid-template-columns: 1fr;
  }
}
</style>
