import { computed, defineComponent, h, ref } from 'vue'
import { mockParentCredentials, parentUser } from './mockData'
import {
  authenticateParent,
  getBoundStudents,
  getFeedbackByStudent,
  getLeaveRequestsByStudent,
  getNoticesByStudent,
  getSchedulesByStudent,
  markNoticeRead,
  listLeaveRequests,
  submitLeaveRequest,
  updateFeedbackStatus,
} from './parentService'

const tabs = ['首页', '学生切换', '课表', '请假', '通知', '反馈'] as const
type TabName = (typeof tabs)[number]
type NoticeFilter = '全部' | '未读' | '调课通知'

export default defineComponent({
  name: 'ParentApp',
  setup() {
    const isAuthenticated = ref(false)
    const username = ref<string>(mockParentCredentials.username)
    const password = ref<string>(mockParentCredentials.password)
    const loginMessage = ref('')
    const activeTab = ref<TabName>('首页')
    const boundStudents = getBoundStudents()
    const selectedStudentId = ref<number | null>(boundStudents[0]?.id ?? null)
    const selectedScheduleId = ref<number | null>(null)
    const leaveReason = ref('发烧需要休息')
    const disputeReason = ref('希望核对本周课堂记录')
    const noticeFilter = ref<NoticeFilter>('全部')
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
    const leaveHistory = computed(() =>
      selectedStudentId.value === null
        ? []
        : getLeaveRequestsByStudent(selectedStudentId.value),
    )
    const feedback = computed(() =>
      selectedStudentId.value === null
        ? []
        : getFeedbackByStudent(selectedStudentId.value),
    )
    const leaveRequests = computed(() => listLeaveRequests())
    const unreadNoticeCount = computed(
      () => notices.value.filter((notice) => !notice.readAt).length,
    )
    const scheduleChangeNoticeCount = computed(
      () => notices.value.filter((notice) => notice.type === 'SCHEDULE_CHANGE').length,
    )
    const todayScheduleCount = computed(
      () => schedules.value.filter((item) => item.lessonDate === '2026-08-01').length,
    )
    const pendingFeedbackCount = computed(
      () => feedback.value.filter((item) => item.status === 'PENDING_PARENT').length,
    )
    const currentLeaveRequests = computed(() =>
      leaveRequests.value.filter((item) => item.studentId === selectedStudentId.value),
    )
    const visibleNotices = computed(() =>
      notices.value.filter((notice) => {
        if (noticeFilter.value === '未读') return !notice.readAt
        if (noticeFilter.value === '调课通知') return notice.type === 'SCHEDULE_CHANGE'
        return true
      }),
    )

    function login() {
      try {
        const user = authenticateParent(username.value, password.value)
        isAuthenticated.value = true
        activeTab.value = '首页'
        loginMessage.value = ''
        message.value = `已使用 ${user.displayName} 的 Mock 账号登录`
      } catch (error) {
        loginMessage.value =
          error instanceof Error ? error.message : '登录失败，请稍后重试'
      }
    }

    function logout() {
      isAuthenticated.value = false
      password.value = ''
      loginMessage.value = '已退出家长端'
      activeTab.value = '首页'
      selectedScheduleId.value = null
      message.value = ''
    }

    function renderLogin() {
      return h('main', { class: 'login-shell' }, [
        h('section', { class: 'login-card', 'aria-labelledby': 'login-title' }, [
          h('div', { class: 'login-intro' }, [
            h('p', { class: 'login-eyebrow' }, 'K12 家校平台'),
            h('h1', { id: 'login-title' }, '家长端登录'),
            h(
              'p',
              { class: 'login-description' },
              '使用家长 Mock 账号查看已绑定学生的课表、请假、通知和反馈。',
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
                login()
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

      const request = submitLeaveRequest({
        studentId: selectedStudentId.value,
        scheduleId: firstScheduleId,
        reason: leaveReason.value,
        contactPhone: parentUser.phone,
      })

      message.value = `请假已提交，状态：${request.status}`
    }

    function readNotice(noticeId: number) {
      markNoticeRead(noticeId)
      message.value = '通知已标记为已读'
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
            h('h1', parentUser.displayName),
            h('p', { class: 'muted' }, parentUser.phone),
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
            h('span', 'Mock 登录状态'),
            h(
              'button',
              { class: 'logout-button', type: 'button', onClick: logout },
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
                h('div', { class: 'section-header' }, [
                  h('div', [
                    h('h3', '今日待办'),
                    h('p', '按家长最常看的内容排在前面，进入后就能直接处理。'),
                  ]),
                  h('span', { class: 'section-badge' }, `${selectedStudent.value?.displayName ?? ''}`),
                ]),
                h('div', { class: 'summary-grid dashboard-grid' }, [
                  h('article', [
                    h('strong', String(todayScheduleCount.value)),
                    h('span', '今日课次'),
                    h('small', '先看今天有哪些课'),
                  ]),
                  h('article', [
                    h('strong', String(unreadNoticeCount.value)),
                    h('span', '未读通知'),
                    h('small', '调课和提醒优先查看'),
                  ]),
                  h('article', [
                    h('strong', String(pendingFeedbackCount.value)),
                    h('span', '待确认反馈'),
                    h('small', '可直接确认或提出异议'),
                  ]),
                  h('article', [
                    h('strong', String(currentLeaveRequests.value.length)),
                    h('span', '请假记录'),
                    h('small', '可回看审批状态'),
                  ]),
                ]),
                h('div', { class: 'quick-actions' }, [
                  h(
                    'button',
                    {
                      class: 'primary',
                      type: 'button',
                      onClick: () => {
                        activeTab.value = '请假'
                      },
                    },
                    '去提交请假',
                  ),
                  h(
                    'button',
                    {
                      class: 'ghost-button',
                      type: 'button',
                      onClick: () => {
                        activeTab.value = '通知'
                        noticeFilter.value = '未读'
                      },
                    },
                    '查看未读通知',
                  ),
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
                      h('span', `${item.teacherName} · ${item.roomName}`),
                    ]),
                  ),
                ),
              ])
            : null,
          activeTab.value === '请假'
            ? h('section', { class: 'panel' }, [
                h('div', { class: 'section-header' }, [
                  h('div', [
                    h('h3', '提交请假'),
                    h('p', '先选课程，再写原因，提交后可立即在记录里看到状态。'),
                  ]),
                ]),
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
                  leaveRequests.value
                    .filter((item) => item.studentId === selectedStudentId.value)
                    .map((item) =>
                    h('article', { class: 'row', key: item.id }, [
                      h('strong', item.reason),
                      h('span', item.status),
                    ]),
                    ),
                ),
                h('h4', '当前学生请假记录'),
                h(
                  'div',
                  { class: 'list compact' },
                  leaveHistory.value.map((item) =>
                    h('article', { class: 'row', key: item.id }, [
                      h('strong', item.reason),
                      h('span', `${item.status} · ${item.createdAt.slice(0, 10)}`),
                    ]),
                  ),
                ),
              ])
            : null,
          activeTab.value === '通知'
            ? h('section', { class: 'panel' }, [
                h('div', { class: 'section-header' }, [
                  h('div', [
                    h('h3', '通知中心'),
                    h('p', '把调课、提醒和普通消息放在一处，支持快速筛选。'),
                  ]),
                  h('div', { class: 'segmented' }, [
                    h(
                      'button',
                      {
                        class: { active: noticeFilter.value === '全部' },
                        type: 'button',
                        onClick: () => {
                          noticeFilter.value = '全部'
                        },
                      },
                      '全部',
                    ),
                    h(
                      'button',
                      {
                        class: { active: noticeFilter.value === '未读' },
                        type: 'button',
                        onClick: () => {
                          noticeFilter.value = '未读'
                        },
                      },
                      '未读',
                    ),
                    h(
                      'button',
                      {
                        class: { active: noticeFilter.value === '调课通知' },
                        type: 'button',
                        onClick: () => {
                          noticeFilter.value = '调课通知'
                        },
                      },
                      '调课通知',
                    ),
                  ]),
                ]),
                h(
                  'div',
                  { class: 'list' },
                  visibleNotices.value.map((notice) =>
                    h('article', { class: 'row notice', key: notice.id }, [
                      h('div', [
                        h('strong', notice.title),
                        h('p', notice.content),
                        notice.type === 'SCHEDULE_CHANGE'
                          ? h(
                              'p',
                              `原时间：${notice.originalTime}；新时间：${notice.newTime}；代课：${notice.substituteTeacherName}`,
                            )
                          : null
                      ]),
                      h('div', { class: 'notice-actions' }, [
                        h('span', notice.readAt ? '已读' : '未读'),
                        !notice.readAt
                          ? h(
                              'button',
                              {
                                type: 'button',
                                class: 'ghost-button',
                                onClick: () => readNotice(notice.id),
                              },
                              '标为已读',
                            )
                          : null,
                      ]),
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
