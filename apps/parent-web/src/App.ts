import { computed, defineComponent, h, onMounted, ref } from 'vue'
import type {
  LeaveRequest,
  Notification,
  ParentStudentBinding,
  ScheduleChangeNotice,
  ScheduleSummary,
  StudentFeedback,
  UserSummary,
} from '@k12/shared'
import { MOCK_ACCOUNT_PASSWORD } from '@k12/shared/mock-accounts'
import { parentAuthClient } from './authClient'
import {
  parentBusinessClient,
  ParentBusinessError,
} from './parentBusinessClient'
import type { ParentOverview } from './parentBusinessClient'

const tabs = ['首页', '学生切换', '课表', '请假', '通知', '反馈'] as const
type TabName = (typeof tabs)[number]

const mockParentCredentials = {
  username: 'parent_201',
  password: MOCK_ACCOUNT_PASSWORD,
} as const

function formatLessonTime(time: string): string {
  return time.slice(0, 5)
}

function isScheduleChangeNotice(
  notice: Notification | ScheduleChangeNotice,
): notice is ScheduleChangeNotice {
  return 'notification' in notice
}

export default defineComponent({
  name: 'ParentApp',
  setup() {
    const isAuthenticated = ref(false)
    const isRestoringSession = ref(true)
    const isLoadingStudents = ref(false)
    const isLoadingOverview = ref(false)
    const isSubmittingLeave = ref(false)
    const isSavingFeedback = ref(false)
    const currentUser = ref<UserSummary | null>(null)
    const username = ref<string>(mockParentCredentials.username)
    const password = ref<string>(mockParentCredentials.password)
    const loginMessage = ref('')
    const activeTab = ref<TabName>('首页')
    const bindings = ref<ParentStudentBinding[]>([])
    const overview = ref<ParentOverview | null>(null)
    const selectedStudentId = ref<number | null>(null)
    const selectedScheduleId = ref<number | null>(null)
    const contactPhone = ref('13800000001')
    const leaveReason = ref('发烧需要休息')
    const disputeReason = ref('希望核对本周课堂记录')
    const message = ref('')
    const loadError = ref('')

    const boundStudents = computed(() =>
      bindings.value.map((binding) => binding.student),
    )
    const selectedStudent = computed(() => {
      if (overview.value?.student) return overview.value.student
      return boundStudents.value.find(
        (student) => student.id === selectedStudentId.value,
      )
    })
    const schedules = computed(() => overview.value?.schedules ?? [])
    const notices = computed<(Notification | ScheduleChangeNotice)[]>(() => [
      ...(overview.value?.scheduleChangeNotices ?? []),
      ...(overview.value?.notifications ?? []),
    ])
    const feedback = computed(() => overview.value?.feedback ?? [])
    const leaveRequests = computed(() => overview.value?.leaveRequests ?? [])
    const courseNames = computed(
      () =>
        new Map(
          (overview.value?.courses ?? []).map((course) => [
            course.id,
            course.name,
          ]),
        ),
    )
    const teacherNames = computed(
      () =>
        new Map(
          (overview.value?.teachers ?? []).map((teacher) => [
            teacher.id,
            teacher.displayName,
          ]),
        ),
    )
    const displayUser = computed(
      () => currentUser.value ?? { displayName: '家长', campusName: '' },
    )

    function resetBusinessState(): void {
      bindings.value = []
      overview.value = null
      selectedStudentId.value = null
      selectedScheduleId.value = null
      loadError.value = ''
      message.value = ''
    }

    function forceLogin(messageText: string): void {
      parentAuthClient.clearAccessToken()
      currentUser.value = null
      isAuthenticated.value = false
      activeTab.value = '首页'
      loginMessage.value = messageText
      resetBusinessState()
    }

    function businessErrorMessage(error: unknown, fallback: string): string {
      if (error instanceof ParentBusinessError) {
        if (error.status === 401) {
          forceLogin('登录已失效，请重新登录')
        }
        return error.message
      }

      return error instanceof Error ? error.message : fallback
    }

    async function loadOverview(studentId: number): Promise<void> {
      selectedStudentId.value = studentId
      selectedScheduleId.value = null
      overview.value = null
      loadError.value = ''
      isLoadingOverview.value = true

      try {
        overview.value = await parentBusinessClient.getOverview(studentId)
        message.value = '学生概览已更新'
      } catch (error) {
        loadError.value = businessErrorMessage(error, '学生概览加载失败')
      } finally {
        isLoadingOverview.value = false
      }
    }

    async function loadStudentsAndDefaultOverview(): Promise<void> {
      isLoadingStudents.value = true
      loadError.value = ''

      try {
        const nextBindings = await parentBusinessClient.listStudents()
        bindings.value = nextBindings

        const firstStudentId = nextBindings[0]?.student.id
        if (firstStudentId === undefined) {
          overview.value = null
          selectedStudentId.value = null
          message.value = '当前账号暂无绑定学生'
          return
        }

        await loadOverview(firstStudentId)
      } catch (error) {
        loadError.value = businessErrorMessage(error, '绑定学生加载失败')
      } finally {
        isLoadingStudents.value = false
      }
    }

    async function restoreSession() {
      try {
        const user = await parentAuthClient.restoreCurrentUser()
        currentUser.value = user
        isAuthenticated.value = user !== null
        loginMessage.value = user ? '' : '请使用家长账号登录'
        if (user) await loadStudentsAndDefaultOverview()
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
        await loadStudentsAndDefaultOverview()
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
        loginMessage.value = '已退出家长端'
        resetBusinessState()
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
      void loadOverview(studentId)
      message.value = '正在切换学生...'
    }

    function scheduleCourseName(schedule: ScheduleSummary): string {
      return courseNames.value.get(schedule.courseId) ?? `课程 #${schedule.courseId}`
    }

    function teacherName(teacherId: number): string {
      return teacherNames.value.get(teacherId) ?? `教师 #${teacherId}`
    }

    function feedbackTitle(item: StudentFeedback): string {
      const schedule = schedules.value.find(
        (candidate) => candidate.id === item.scheduleId,
      )
      const courseName = schedule ? scheduleCourseName(schedule) : '课程反馈'
      return `${courseName} · ${teacherName(item.teacherId)}`
    }

    async function createLeaveRequest() {
      const firstScheduleId = selectedScheduleId.value ?? schedules.value[0]?.id

      if (selectedStudentId.value === null || firstScheduleId === undefined) {
        message.value = '当前学生没有可请假的课程'
        return
      }

      isSubmittingLeave.value = true
      try {
        const request = await parentBusinessClient.submitLeaveRequest({
          studentId: selectedStudentId.value,
          scheduleId: firstScheduleId,
          reason: leaveReason.value,
          contactPhone: contactPhone.value,
        })

        if (overview.value) {
          overview.value = {
            ...overview.value,
            leaveRequests: [...overview.value.leaveRequests, request],
          }
        }
        message.value = `请假已提交，状态：${request.status}`
      } catch (error) {
        message.value = businessErrorMessage(error, '请假提交失败，请稍后重试')
      } finally {
        isSubmittingLeave.value = false
      }
    }

    async function markFeedback(
      feedbackId: number,
      status: 'CONFIRMED' | 'DISPUTED',
    ) {
      if (status === 'DISPUTED' && !disputeReason.value.trim()) {
        message.value = '提出异议时必须填写异议内容'
        return
      }

      isSavingFeedback.value = true
      try {
        const updated = await parentBusinessClient.respondToFeedback(feedbackId, {
          status,
          parentResponse: status === 'DISPUTED' ? disputeReason.value : '',
        })

        if (overview.value) {
          overview.value = {
            ...overview.value,
            feedback: overview.value.feedback.map((item) =>
              item.id === updated.id ? updated : item,
            ),
          }
        }
        message.value =
          updated.status === 'CONFIRMED'
            ? '已确认反馈'
            : '已提交异议，等待教务处理'
      } catch (error) {
        message.value = businessErrorMessage(error, '反馈处理失败，请稍后重试')
      } finally {
        isSavingFeedback.value = false
      }
    }

    function renderPanelState() {
      if (isLoadingStudents.value || isLoadingOverview.value) {
        return h('section', { class: 'panel state-panel' }, [
          h('h3', '正在加载数据'),
          h('p', { class: 'muted' }, '正在从业务 API 获取最新家长端数据。'),
        ])
      }

      if (loadError.value) {
        return h('section', { class: 'panel state-panel' }, [
          h('h3', '数据加载失败'),
          h('p', { class: 'error-message' }, loadError.value),
          h(
            'button',
            {
              class: 'primary',
              type: 'button',
              onClick: () => void loadStudentsAndDefaultOverview(),
            },
            '重试',
          ),
        ])
      }

      if (bindings.value.length === 0) {
        return h('section', { class: 'panel state-panel' }, [
          h('h3', '暂无绑定学生'),
          h('p', { class: 'muted' }, '当前家长账号还没有绑定学生。'),
        ])
      }

      return null
    }

    return () => {
      if (!isAuthenticated.value) return renderLogin()

      const panelState = renderPanelState()

      return h('main', { class: 'shell' }, [
        h('aside', { class: 'sidebar' }, [
          h('div', [
            h('p', { class: 'eyebrow' }, '家长端'),
            h('h1', displayUser.value.displayName),
            h('p', { class: 'muted' }, currentUser.value?.campusName ?? ''),
          ]),
          h(
            'nav',
            { 'aria-label': '家长端主导航' },
            tabs.map((tab) =>
              h(
                'button',
                {
                  class: { active: activeTab.value === tab },
                  type: 'button',
                  'aria-current': activeTab.value === tab ? 'page' : undefined,
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
                selectedStudent.value
                  ? `${selectedStudent.value.displayName} · ${selectedStudent.value.className}`
                  : '未选择学生',
              ),
            ]),
            message.value
              ? h('p', { class: 'status' }, message.value)
              : null,
          ]),
          panelState,
          !panelState && activeTab.value === '首页'
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
          !panelState && activeTab.value === '学生切换'
            ? h('section', { class: 'panel' }, [
                h('h3', '学生切换'),
                h(
                  'div',
                  { class: 'list' },
                  boundStudents.value.map((student) =>
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
          !panelState && activeTab.value === '课表'
            ? h('section', { class: 'panel' }, [
                h('h3', '课表'),
                schedules.value.length === 0
                  ? h('p', { class: 'empty-state' }, '当前学生暂无课表')
                  : h(
                      'div',
                      { class: 'list' },
                      schedules.value.map((item) =>
                        h('article', { class: 'row', key: item.id }, [
                          h('div', [
                            h('strong', scheduleCourseName(item)),
                            h(
                              'p',
                              `${item.lessonDate} ${formatLessonTime(item.startTime)}-${formatLessonTime(item.endTime)}`,
                            ),
                          ]),
                          h('span', `${teacherName(item.teacherId)} · ${item.room}`),
                        ]),
                      ),
                    ),
              ])
            : null,
          !panelState && activeTab.value === '请假'
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
                          `${scheduleCourseName(item)} · ${item.lessonDate} ${formatLessonTime(item.startTime)}`,
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
                h('label', [
                  '联系电话',
                  h('input', {
                    value: contactPhone.value,
                    onInput: (event: Event) => {
                      contactPhone.value = (event.target as HTMLInputElement).value
                    },
                  }),
                ]),
                h(
                  'button',
                  {
                    class: 'primary',
                    disabled: isSubmittingLeave.value,
                    type: 'button',
                    onClick: () => void createLeaveRequest(),
                  },
                  isSubmittingLeave.value ? '提交中...' : '提交请假',
                ),
                leaveRequests.value.length === 0
                  ? h('p', { class: 'empty-state' }, '当前学生暂无请假记录')
                  : h(
                      'div',
                      { class: 'list compact' },
                      leaveRequests.value.map((item: LeaveRequest) =>
                        h('article', { class: 'row', key: item.id }, [
                          h('strong', item.reason),
                          h('span', item.status),
                        ]),
                      ),
                    ),
              ])
            : null,
          !panelState && activeTab.value === '通知'
            ? h('section', { class: 'panel' }, [
                h('h3', '通知'),
                notices.value.length === 0
                  ? h('p', { class: 'empty-state' }, '当前学生暂无通知')
                  : h(
                      'div',
                      { class: 'list' },
                      notices.value.map((notice) => {
                        const notification = isScheduleChangeNotice(notice)
                          ? notice.notification
                          : notice

                        return h('article', { class: 'row notice', key: notification.id }, [
                          h('div', [
                            h('strong', notification.title),
                            h('p', notification.content),
                            isScheduleChangeNotice(notice)
                              ? h(
                                  'p',
                                  `原时间：${notice.originalDate} ${formatLessonTime(notice.originalStartTime)}-${formatLessonTime(notice.originalEndTime)}；新时间：${notice.newDate} ${formatLessonTime(notice.newStartTime)}-${formatLessonTime(notice.newEndTime)}；原教师：${notice.originalTeacherName}；代课：${notice.substituteTeacherName ?? '待确认'}`,
                                )
                              : null,
                          ]),
                          h('span', notification.readAt ? '已读' : '未读'),
                        ])
                      }),
                    ),
              ])
            : null,
          !panelState && activeTab.value === '反馈'
            ? h('section', { class: 'panel' }, [
                h('h3', '学生反馈'),
                feedback.value.length === 0
                  ? h('p', { class: 'empty-state' }, '当前学生暂无反馈')
                  : h(
                      'div',
                      { class: 'list' },
                      feedback.value.map((item: StudentFeedback) =>
                        h('article', { class: 'feedback-card', key: item.id }, [
                          h('strong', feedbackTitle(item)),
                          h('p', `表现：${item.performance}`),
                          h('p', `优点：${item.strengths}`),
                          h('p', `改进：${item.improvements}`),
                          h('p', `建议：${item.suggestion}`),
                          h('p', `状态：${item.status}`),
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
                                disabled:
                                  isSavingFeedback.value ||
                                  item.status !== 'PENDING_PARENT',
                                type: 'button',
                                onClick: () => void markFeedback(item.id, 'CONFIRMED'),
                              },
                              '确认',
                            ),
                            h(
                              'button',
                              {
                                disabled:
                                  isSavingFeedback.value ||
                                  item.status !== 'PENDING_PARENT',
                                type: 'button',
                                onClick: () => void markFeedback(item.id, 'DISPUTED'),
                              },
                              '提出异议',
                            ),
                          ]),
                        ]),
                      ),
                    ),
              ])
            : null,
        ]),
      ])
    }
  },
})
