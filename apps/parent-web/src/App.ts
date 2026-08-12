import { computed, defineComponent, h, onMounted, ref } from 'vue'
import type { UserSummary } from '@k12/shared'
import { parentAuthClient } from './authClient'
import { mockParentCredentials, parentProfile, parentUser } from './mockData'
import {
  getBoundStudents,
  getFeedbackByStudent,
  getParentContactPhone,
  getNoticesByStudent,
  getSchedulesByStudent,
  listLeaveRequests,
  submitLeaveRequest,
  updateFeedbackStatus,
} from './parentService'

const tabs = ['首页', '学生切换', '课表', '请假', '通知', '反馈'] as const
type TabName = (typeof tabs)[number]

export default defineComponent({
  name: 'ParentApp',
  setup() {
    const isAuthenticated = ref(false)
    const isRestoringSession = ref(true)
    const currentUser = ref<UserSummary | null>(null)
    const username = ref<string>(mockParentCredentials.username)
    const password = ref<string>(mockParentCredentials.password)
    const loginMessage = ref('')
    const activeTab = ref<TabName>('首页')
    const boundStudents = getBoundStudents()
    const selectedStudentId = ref<number | null>(boundStudents[0]?.id ?? null)
    const selectedScheduleId = ref<number | null>(null)
    const leaveReason = ref('发烧需要休息')
    const disputeReason = ref('希望核对本周课堂记录')
    const message = ref('')

    const selectedStudent = computed(() =>
      boundStudents.find((student) => student.id === selectedStudentId.value),
    )
    const schedules = computed(() =>
      selectedStudentId.value === null
        ? []
        : getSchedulesByStudent(selectedStudentId.value),
    )
    const notices = computed(() =>
      selectedStudentId.value === null
        ? []
        : getNoticesByStudent(selectedStudentId.value),
    )
    const feedback = computed(() =>
      selectedStudentId.value === null
        ? []
        : getFeedbackByStudent(selectedStudentId.value),
    )
    const leaveRequests = computed(() => listLeaveRequests())

    const displayUser = computed(() => currentUser.value ?? parentUser)

    async function restoreSession() {
      try {
        const user = await parentAuthClient.restoreCurrentUser()
        currentUser.value = user
        isAuthenticated.value = user !== null
        loginMessage.value = user ? '' : '请使用家长账号登录'
        message.value = user ? `已恢复 ${user.displayName} 的登录状态` : ''
      } catch (error) {
        currentUser.value = null
        isAuthenticated.value = false
        loginMessage.value =
          error instanceof Error ? error.message : '登录状态恢复失败'
      } finally {
        isRestoringSession.value = false
      }
    }

    onMounted(() => {
      void restoreSession()
    })

    async function login() {
      loginMessage.value = ''
      try {
        const user = await parentAuthClient.login(username.value, password.value)
        currentUser.value = user
        isAuthenticated.value = true
        activeTab.value = '首页'
        loginMessage.value = ''
        message.value = `已使用 ${user.displayName} 的真实认证账号登录`
      } catch (error) {
        loginMessage.value =
          error instanceof Error ? error.message : '登录失败，请稍后重试'
      }
    }

    async function logout() {
      try {
        await parentAuthClient.logout()
      } catch (error) {
        loginMessage.value =
          error instanceof Error ? error.message : '退出登录失败，请稍后重试'
      } finally {
        currentUser.value = null
        isAuthenticated.value = false
        password.value = ''
        activeTab.value = '首页'
        selectedScheduleId.value = null
        message.value = ''
        loginMessage.value = '已退出家长端'
      }
    }

    function renderLogin() {
      if (isRestoringSession.value) {
        return h('main', { class: 'login-shell' }, [
          h('section', { class: 'login-card single' }, [
            h('p', { class: 'login-description' }, '正在检查登录状态...'),
          ]),
        ])
      }

      return h('main', { class: 'login-shell' }, [
        h('section', { class: 'login-card', 'aria-labelledby': 'login-title' }, [
          h('div', { class: 'login-intro' }, [
            h('p', { class: 'login-eyebrow' }, 'K12 家校平台'),
            h('h1', { id: 'login-title' }, '家长端登录'),
            h(
              'p',
              { class: 'login-description' },
              '使用家长测试账号完成登录、学生切换、课表查看、请假提交、通知查看和退出流程。',
            ),
            h('dl', { class: 'demo-account' }, [
              h('div', [h('dt', '测试账号'), h('dd', mockParentCredentials.username)]),
              h('div', [h('dt', '测试密码'), h('dd', mockParentCredentials.password)]),
            ]),
          ]),
          h(
            'form',
            {
              class: 'login-form',
              onSubmit: (event: Event) => {
                event.preventDefault()
                void login()
              },
            },
            [
              h('label', [
                '账号',
                h('input', {
                  name: 'username',
                  autocomplete: 'username',
                  value: username.value,
                  onInput: (event: Event) => {
                    username.value = (event.target as HTMLInputElement).value
                  },
                }),
              ]),
              h('label', [
                '密码',
                h('input', {
                  name: 'password',
                  type: 'password',
                  autocomplete: 'current-password',
                  value: password.value,
                  onInput: (event: Event) => {
                    password.value = (event.target as HTMLInputElement).value
                  },
                }),
              ]),
              loginMessage.value
                ? h('p', { class: 'login-message', role: 'status' }, loginMessage.value)
                : null,
              h(
                'button',
                { class: 'primary login-submit', type: 'submit' },
                '登录并进入首页',
              ),
            ],
          ),
        ]),
      ])
    }

    function switchStudent(studentId: number) {
      selectedStudentId.value = studentId
      selectedScheduleId.value = null
      message.value = '已切换学生'
    }

    function createLeaveRequest() {
      const firstScheduleId = selectedScheduleId.value ?? schedules.value[0]?.id

      if (selectedStudentId.value === null || firstScheduleId === undefined) {
        message.value = '当前学生没有可请假的课程'
        return
      }

      try {
        const request = submitLeaveRequest({
          studentId: selectedStudentId.value,
          scheduleId: firstScheduleId,
          reason: leaveReason.value,
          contactPhone: getParentContactPhone(),
        })

        message.value = `请假已提交，状态：${request.status}`
      } catch (error) {
        message.value =
          error instanceof Error ? error.message : '请假提交失败，请稍后重试'
      }
    }

    function markFeedback(
      feedbackId: number,
      status: 'CONFIRMED' | 'DISPUTED',
    ) {
      updateFeedbackStatus(
        feedbackId,
        status,
        status === 'DISPUTED' ? disputeReason.value : '',
      )
      message.value =
        status === 'CONFIRMED' ? '已确认反馈' : '已提交异议，等待教务处理'
    }

    return () =>
      isAuthenticated.value
        ? h('main', { class: 'shell' }, [
        h('aside', { class: 'sidebar' }, [
          h('div', [
            h('p', { class: 'eyebrow' }, '家长端'),
            h('h1', displayUser.value.displayName),
            h('p', { class: 'muted' }, parentProfile.phone),
          ]),
          h(
            'nav',
            tabs.map((tab) =>
              h(
                'button',
                {
                  class: { active: activeTab.value === tab },
                  type: 'button',
                  onClick: () => {
                    activeTab.value = tab
                  },
                },
                tab,
              ),
            ),
          ),
        h('div', { class: 'account-actions' }, [
            h('span', '真实认证登录状态'),
            h(
              'button',
              { class: 'logout-button', type: 'button', onClick: () => void logout() },
              '退出登录',
            ),
          ]),
        ]),
        h('section', { class: 'content' }, [
          h('header', { class: 'topbar' }, [
            h('div', [
              h('p', { class: 'eyebrow' }, '当前学生'),
              h(
                'h2',
                `${selectedStudent.value?.displayName} · ${selectedStudent.value?.className}`,
              ),
            ]),
            h('p', { class: 'status' }, message.value),
          ]),
          activeTab.value === '首页'
            ? h('section', { class: 'panel' }, [
                h('h3', '今日概览'),
                h('div', { class: 'summary-grid' }, [
                  h('article', [h('strong', String(schedules.value.length)), h('span', '课程')]),
                  h('article', [h('strong', String(notices.value.length)), h('span', '通知')]),
                  h('article', [
                    h('strong', String(feedback.value.length)),
                    h('span', '待看反馈'),
                  ]),
                ]),
              ])
            : null,
          activeTab.value === '学生切换'
            ? h('section', { class: 'panel' }, [
                h('h3', '学生切换'),
                h(
                  'div',
                  { class: 'list' },
                  boundStudents.map((student) =>
                    h(
                      'button',
                      {
                        class: 'row-button',
                        type: 'button',
                        onClick: () => switchStudent(student.id),
                      },
                      [
                        h('span', student.displayName),
                        h('small', `${student.className} · ${student.campusName}`),
                      ],
                    ),
                  ),
                ),
              ])
            : null,
          activeTab.value === '课表'
            ? h('section', { class: 'panel' }, [
                h('h3', '课表'),
                h(
                  'div',
                  { class: 'list' },
                  schedules.value.map((item) =>
                    h('article', { class: 'row', key: item.id }, [
                      h('div', [
                        h('strong', item.courseName),
                        h(
                          'p',
                          `${item.lessonDate} ${item.startTime}-${item.endTime}`,
                        ),
                      ]),
                      h('span', `${item.teacherName} · ${item.room}`),
                    ]),
                  ),
                ),
              ])
            : null,
          activeTab.value === '请假'
            ? h('section', { class: 'panel' }, [
                h('h3', '提交请假'),
                h('label', [
                  '选择课程',
                  h(
                    'select',
                    {
                      value: selectedScheduleId.value,
                      onChange: (event: Event) => {
                        const value = (event.target as HTMLSelectElement).value
                        selectedScheduleId.value = value ? Number(value) : null
                      },
                    },
                    [
                      h('option', { value: '' }, '默认第一节可请假课程'),
                      ...schedules.value.map((item) =>
                        h(
                          'option',
                          { key: item.id, value: item.id },
                          `${item.courseName} · ${item.lessonDate} ${item.startTime}`,
                        ),
                      ),
                    ],
                  ),
                ]),
                h('label', [
                  '请假原因',
                  h('textarea', {
                    rows: 4,
                    value: leaveReason.value,
                    onInput: (event: Event) => {
                      leaveReason.value = (event.target as HTMLTextAreaElement).value
                    },
                  }),
                ]),
                h(
                  'button',
                  { class: 'primary', type: 'button', onClick: createLeaveRequest },
                  '提交请假',
                ),
                h(
                  'div',
                  { class: 'list compact' },
                  leaveRequests.value.map((item) =>
                    h('article', { class: 'row', key: item.id }, [
                      h('strong', item.reason),
                      h('span', item.status),
                    ]),
                  ),
                ),
              ])
            : null,
          activeTab.value === '通知'
            ? h('section', { class: 'panel' }, [
                h('h3', '通知'),
                h(
                  'div',
                  { class: 'list' },
                  notices.value.map((notice) =>
                    h('article', { class: 'row notice', key: 'notification' in notice ? notice.notification.id : notice.id }, [
                      h('div', [
                        h('strong', 'notification' in notice ? notice.notification.title : notice.title),
                        h('p', 'notification' in notice ? notice.notification.content : notice.content),
                        'notification' in notice
                          ? h(
                              'p',
                              `原时间：${notice.originalDate} ${notice.originalStartTime}-${notice.originalEndTime}；新时间：${notice.newDate} ${notice.newStartTime}-${notice.newEndTime}；代课：${notice.substituteTeacherName ?? '待确认'}`,
                            )
                          : null
                      ]),
                      h('span', ('notification' in notice ? notice.notification.readAt : notice.readAt) ? '已读' : '未读'),
                    ]),
                  ),
                ),
              ])
            : null,
          activeTab.value === '反馈'
            ? h('section', { class: 'panel' }, [
                h('h3', '学生反馈'),
                h(
                  'div',
                  { class: 'list' },
                  feedback.value.map((item) =>
                    h('article', { class: 'feedback-card', key: item.id }, [
                      h('strong', `${item.courseName} · ${item.teacherName}`),
                      h('p', `优点：${item.strengths}`),
                      h('p', `改进：${item.improvements}`),
                      h('p', `建议：${item.suggestion}`),
                      h('label', [
                        '异议说明',
                        h('textarea', {
                          rows: 2,
                          value: disputeReason.value,
                          onInput: (event: Event) => {
                            disputeReason.value = (
                              event.target as HTMLTextAreaElement
                            ).value
                          },
                        }),
                      ]),
                      h('div', { class: 'actions' }, [
                        h(
                          'button',
                          {
                            type: 'button',
                            onClick: () => markFeedback(item.id, 'CONFIRMED'),
                          },
                          '确认',
                        ),
                        h(
                          'button',
                          {
                            type: 'button',
                            onClick: () => markFeedback(item.id, 'DISPUTED'),
                          },
                          '提出异议',
                        ),
                      ]),
                    ]),
                  ),
                ),
              ])
            : null
        ])
      ])
        : renderLogin()
  },
})
