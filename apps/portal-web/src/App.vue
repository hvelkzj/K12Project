<script setup lang="ts">
import { computed, reactive, ref } from 'vue'

import type {
  PublicRegistrationRole,
  UserAccountSummary,
} from '@k12/shared'

import {
  createPortalEntries,
  DEFAULT_PORTAL_URLS,
  loginUrlForRole,
  type PortalUrls,
} from './portalConfig'
import { registrationClient } from './registrationClient'
import {
  validateRegistration,
  type RegistrationForm,
} from './registrationRules'

const viteEnv = import.meta.env
const portalUrls: PortalUrls = {
  parent: viteEnv.VITE_PARENT_APP_URL ?? DEFAULT_PORTAL_URLS.parent,
  student: viteEnv.VITE_STUDENT_APP_URL ?? DEFAULT_PORTAL_URLS.student,
  teacher: viteEnv.VITE_TEACHER_APP_URL ?? DEFAULT_PORTAL_URLS.teacher,
  admin: viteEnv.VITE_ADMIN_APP_URL ?? DEFAULT_PORTAL_URLS.admin,
}
const portalEntries = createPortalEntries(portalUrls)

const workflows = [
  {
    step: '01',
    title: '作业闭环',
    description: '教师发布、学生提交与订正、教师批改、学生查看结果。',
  },
  {
    step: '02',
    title: '调课协同',
    description: '教师申请、教务审批、安排代课，家长实时收到通知。',
  },
  {
    step: '03',
    title: '家校反馈',
    description: '教师反馈、家长确认或提出异议、教务跟进处理工单。',
  },
  {
    step: '04',
    title: '教学运营',
    description: '请假审批、课堂签到、排课维护与账号权限同步联动。',
  },
]

const form = reactive<RegistrationForm>({
  username: '',
  displayName: '',
  password: '',
  confirmPassword: '',
  role: 'STUDENT',
})
const submitting = ref(false)
const formError = ref('')
const successAccount = ref<UserAccountSummary | null>(null)

const successLoginUrl = computed(() =>
  successAccount.value
    ? loginUrlForRole(
        successAccount.value.role as PublicRegistrationRole,
        portalUrls,
      )
    : portalUrls.student,
)

function selectRole(role: PublicRegistrationRole): void {
  form.role = role
  formError.value = ''
  successAccount.value = null
}

function scrollToRegistration(): void {
  document.querySelector('#register')?.scrollIntoView({ behavior: 'smooth' })
}

async function submitRegistration(): Promise<void> {
  formError.value = ''
  successAccount.value = null
  const validation = validateRegistration(form)
  if (!validation.ok) {
    formError.value = validation.message
    return
  }

  submitting.value = true
  try {
    successAccount.value = await registrationClient.register(validation.value)
    form.password = ''
    form.confirmPassword = ''
  } catch (error) {
    formError.value =
      error instanceof Error
        ? error.message
        : '注册服务暂时不可用，请稍后重试。'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="site-shell">
    <header class="topbar">
      <a class="brand" href="#top" aria-label="K12 教育协作平台首页">
        <span class="brand-mark" aria-hidden="true">K</span>
        <span>
          <strong>K12 Link</strong>
          <small>教育协作平台</small>
        </span>
      </a>

      <nav class="main-nav" aria-label="首页导航">
        <a href="#platform">平台能力</a>
        <a href="#workflow">业务协同</a>
        <a href="#portals">角色入口</a>
      </nav>

      <div class="top-actions">
        <a class="text-action" href="#portals">登录</a>
        <button class="compact-button" type="button" @click="scrollToRegistration">
          注册账号
        </button>
      </div>
    </header>

    <main id="top">
      <section class="hero" aria-labelledby="hero-title">
        <div class="hero-orb hero-orb-one" aria-hidden="true"></div>
        <div class="hero-orb hero-orb-two" aria-hidden="true"></div>

        <div class="hero-copy">
          <p class="eyebrow">连接课堂、家庭与校园运营</p>
          <h1 id="hero-title">
            <span>让每一次教学协作，</span><br />
            <span>都从一个入口开始</span>
          </h1>
          <p class="hero-lead">
            面向家长、学生、教师与教务的统一 K12 管理平台。课程、作业、反馈、调课和运营数据在真实业务 API 中顺畅流转。
          </p>
          <div class="hero-actions">
            <a class="primary-button" href="#portals">
              进入我的平台
              <span aria-hidden="true">→</span>
            </a>
            <button class="secondary-button" type="button" @click="scrollToRegistration">
              创建学习账号
            </button>
          </div>
          <dl class="hero-metrics" aria-label="项目完成数据">
            <div>
              <dt>6</dt>
              <dd>用户角色</dd>
            </div>
            <div>
              <dt>29</dt>
              <dd>业务页面</dd>
            </div>
            <div>
              <dt>7</dt>
              <dd>跨端流程</dd>
            </div>
          </dl>
        </div>

        <div class="hero-visual" aria-label="学生端界面预览">
          <div class="visual-glow" aria-hidden="true"></div>
          <div class="browser-card">
            <div class="browser-bar" aria-hidden="true">
              <span></span><span></span><span></span>
              <div>k12 · 学生学习空间</div>
            </div>
            <img
              src="/previews/student-dashboard.jpg"
              alt="学生端首页，显示作业、课件与学习提醒"
            />
          </div>
          <div class="floating-note note-top">
            <span class="note-icon">✓</span>
            <span><strong>真实业务 API</strong><small>跨端状态即时同步</small></span>
          </div>
          <div class="floating-note note-bottom">
            <span class="note-icon violet">6</span>
            <span><strong>角色权限隔离</strong><small>只访问自己的数据</small></span>
          </div>
        </div>
      </section>

      <section id="platform" class="section section-intro" aria-labelledby="platform-title">
        <div class="section-heading centered">
          <p class="eyebrow">ONE CONNECTED CAMPUS</p>
          <h2 id="platform-title">一个平台，连接学习的每个参与者</h2>
          <p>保留各端独立、清晰的工作空间，通过统一身份和业务数据把协作串联起来。</p>
        </div>
        <div class="value-grid">
          <article>
            <span class="value-number">01</span>
            <h3>统一入口</h3>
            <p>从首页按身份进入对应平台，不再需要记忆四个分散地址。</p>
          </article>
          <article>
            <span class="value-number">02</span>
            <h3>真实联动</h3>
            <p>写操作等待服务端确认，失败不显示假成功，跨端结果立即可见。</p>
          </article>
          <article>
            <span class="value-number">03</span>
            <h3>清晰权限</h3>
            <p>家长、学生、教师、教务和系统管理员拥有不同的数据范围。</p>
          </article>
        </div>
      </section>

      <section id="workflow" class="section workflow-section" aria-labelledby="workflow-title">
        <div class="section-heading light-heading">
          <p class="eyebrow">CONNECTED WORKFLOWS</p>
          <h2 id="workflow-title">业务不止呈现，更能完整流转</h2>
          <p>每条流程都穿过真实页面和接口，不依赖运行时业务 Mock。</p>
        </div>
        <div class="workflow-grid">
          <article v-for="workflow in workflows" :key="workflow.step">
            <span>{{ workflow.step }}</span>
            <div>
              <h3>{{ workflow.title }}</h3>
              <p>{{ workflow.description }}</p>
            </div>
          </article>
        </div>
      </section>

      <section id="portals" class="section portals-section" aria-labelledby="portals-title">
        <div class="section-heading split-heading">
          <div>
            <p class="eyebrow">ROLE PORTALS</p>
            <h2 id="portals-title">选择你的工作空间</h2>
          </div>
          <p>每个入口保留适合该角色的页面结构、任务重点与权限边界。</p>
        </div>

        <div class="portal-grid">
          <article
            v-for="(entry, index) in portalEntries"
            :key="entry.title"
            class="portal-card"
            :class="{ featured: index === 1 }"
          >
            <div class="portal-image">
              <img :src="entry.image" :alt="`${entry.title}首页截图`" loading="lazy" />
              <span>{{ entry.eyebrow }}</span>
            </div>
            <div class="portal-card-copy">
              <p>{{ entry.audience }}</p>
              <h3>{{ entry.title }}</h3>
              <span>{{ entry.description }}</span>
              <a :href="entry.url" :aria-label="`进入${entry.title}`">
                进入平台 <span aria-hidden="true">↗</span>
              </a>
            </div>
          </article>
        </div>
      </section>

      <section id="register" class="section register-section" aria-labelledby="register-title">
        <div class="register-copy">
          <p class="eyebrow">CREATE AN ACCOUNT</p>
          <h2 id="register-title">第一次使用？<br />从这里创建账号</h2>
          <p>
            学生注册后默认加入滨江校区六年级 1 班，可立即进入学生端；家长账号创建后由学校完成学生绑定。
          </p>
          <ul>
            <li><span>✓</span> 注册信息由真实 API 校验并保存到运行时账号仓库</li>
            <li><span>✓</span> 教师和管理角色不开放自注册，避免权限越界</li>
            <li><span>✓</span> 项目重启后恢复初始数据，不保存真实个人信息</li>
          </ul>
        </div>

        <div class="register-panel">
          <div class="role-switch" aria-label="选择注册角色">
            <button
              type="button"
              :class="{ active: form.role === 'STUDENT' }"
              :aria-pressed="form.role === 'STUDENT'"
              @click="selectRole('STUDENT')"
            >
              我是学生
            </button>
            <button
              type="button"
              :class="{ active: form.role === 'PARENT' }"
              :aria-pressed="form.role === 'PARENT'"
              @click="selectRole('PARENT')"
            >
              我是家长
            </button>
          </div>

          <form class="register-form" @submit.prevent="submitRegistration">
            <label for="display-name">
              姓名或称呼
              <input
                id="display-name"
                v-model="form.displayName"
                name="displayName"
                autocomplete="name"
                maxlength="20"
                placeholder="例如：陈同学"
              />
            </label>
            <label for="username">
              用户名
              <input
                id="username"
                v-model="form.username"
                name="username"
                autocomplete="username"
                maxlength="24"
                placeholder="小写字母开头"
              />
            </label>
            <div class="form-row">
              <label for="password">
                密码
                <input
                  id="password"
                  v-model="form.password"
                  name="password"
                  type="password"
                  autocomplete="new-password"
                  maxlength="64"
                  placeholder="至少 8 位"
                />
              </label>
              <label for="confirm-password">
                确认密码
                <input
                  id="confirm-password"
                  v-model="form.confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autocomplete="new-password"
                  maxlength="64"
                  placeholder="再次输入"
                />
              </label>
            </div>
            <p class="field-hint">密码需同时包含字母和数字。</p>

            <p v-if="formError" class="form-message error-message" role="alert">
              {{ formError }}
            </p>
            <div
              v-if="successAccount"
              class="form-message success-message"
              role="status"
            >
              <strong>账号创建成功</strong>
              <span>用户名：{{ successAccount.username }}</span>
              <a :href="successLoginUrl">前往{{ successAccount.role === 'PARENT' ? '家长端' : '学生端' }}登录 →</a>
            </div>

            <button class="submit-button" type="submit" :disabled="submitting">
              {{ submitting ? '正在创建账号…' : '创建账号' }}
            </button>
          </form>
        </div>
      </section>
    </main>

    <footer>
      <div class="brand footer-brand">
        <span class="brand-mark" aria-hidden="true">K</span>
        <span><strong>K12 Link</strong><small>教育协作平台</small></span>
      </div>
      <p>课程项目 · 统一身份 · 真实业务 API · macOS / Windows</p>
      <a href="#top">返回顶部 ↑</a>
    </footer>
  </div>
</template>
