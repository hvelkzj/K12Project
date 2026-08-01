import { computed, defineComponent, h, ref } from 'vue';
import { parentUser } from './mockData';
import {
  getBoundStudents,
  getFeedbackByStudent,
  getNoticesByStudent,
  getSchedulesByStudent,
  listLeaveRequests,
  submitLeaveRequest,
  updateFeedbackStatus
} from './parentService';

const tabs = ['首页', '学生切换', '课表', '请假', '通知', '反馈'] as const;
type TabName = (typeof tabs)[number];

export default defineComponent({
  name: 'ParentApp',
  setup() {
    const activeTab = ref<TabName>('首页');
    const boundStudents = getBoundStudents();
    const selectedStudentId = ref(boundStudents[0]?.id ?? '');
    const selectedScheduleId = ref('');
    const leaveReason = ref('发烧需要休息');
    const message = ref('已使用家长测试账号登录');

    const selectedStudent = computed(() =>
      boundStudents.find((student) => student.id === selectedStudentId.value)
    );
    const schedules = computed(() =>
      selectedStudentId.value ? getSchedulesByStudent(selectedStudentId.value) : []
    );
    const notices = computed(() =>
      selectedStudentId.value ? getNoticesByStudent(selectedStudentId.value) : []
    );
    const feedback = computed(() =>
      selectedStudentId.value ? getFeedbackByStudent(selectedStudentId.value) : []
    );
    const leaveRequests = computed(() => listLeaveRequests());

    function switchStudent(studentId: string) {
      selectedStudentId.value = studentId;
      selectedScheduleId.value = '';
      message.value = '已切换学生';
    }

    function createLeaveRequest() {
      const firstScheduleId = selectedScheduleId.value || schedules.value[0]?.id;

      if (!firstScheduleId) {
        message.value = '当前学生没有可请假的课程';
        return;
      }

      const request = submitLeaveRequest({
        studentId: selectedStudentId.value,
        scheduleId: firstScheduleId,
        reason: leaveReason.value,
        contactPhone: parentUser.phone
      });

      message.value = `请假已提交，状态：${request.status}`;
    }

    function markFeedback(feedbackId: string, status: 'confirmed' | 'disputed') {
      updateFeedbackStatus(feedbackId, status);
      message.value = status === 'confirmed' ? '已确认反馈' : '已提交异议，等待教务处理';
    }

    return () =>
      h('main', { class: 'shell' }, [
        h('aside', { class: 'sidebar' }, [
          h('div', [
            h('p', { class: 'eyebrow' }, '家长端'),
            h('h1', parentUser.name),
            h('p', { class: 'muted' }, parentUser.phone)
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
                    activeTab.value = tab;
                  }
                },
                tab
              )
            )
          )
        ]),
        h('section', { class: 'content' }, [
          h('header', { class: 'topbar' }, [
            h('div', [
              h('p', { class: 'eyebrow' }, '当前学生'),
              h('h2', `${selectedStudent.value?.name} · ${selectedStudent.value?.className}`)
            ]),
            h('p', { class: 'status' }, message.value)
          ]),
          activeTab.value === '首页'
            ? h('section', { class: 'panel' }, [
                h('h3', '今日概览'),
                h('div', { class: 'summary-grid' }, [
                  h('article', [h('strong', String(schedules.value.length)), h('span', '课程')]),
                  h('article', [h('strong', String(notices.value.length)), h('span', '通知')]),
                  h('article', [h('strong', String(feedback.value.length)), h('span', '待看反馈')])
                ])
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
                        onClick: () => switchStudent(student.id)
                      },
                      [
                        h('span', student.name),
                        h('small', `${student.className} · ${student.campusName}`)
                      ]
                    )
                  )
                )
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
                        h('p', `${item.date} ${item.startTime}-${item.endTime}`)
                      ]),
                      h('span', `${item.teacherName} · ${item.roomName}`)
                    ])
                  )
                )
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
                        selectedScheduleId.value = (event.target as HTMLSelectElement).value;
                      }
                    },
                    [
                      h('option', { value: '' }, '默认第一节可请假课程'),
                      ...schedules.value.map((item) =>
                        h(
                          'option',
                          { key: item.id, value: item.id },
                          `${item.courseName} · ${item.date} ${item.startTime}`
                        )
                      )
                    ]
                  )
                ]),
                h('label', [
                  '请假原因',
                  h('textarea', {
                    rows: 4,
                    value: leaveReason.value,
                    onInput: (event: Event) => {
                      leaveReason.value = (event.target as HTMLTextAreaElement).value;
                    }
                  })
                ]),
                h('button', { class: 'primary', type: 'button', onClick: createLeaveRequest }, '提交请假'),
                h(
                  'div',
                  { class: 'list compact' },
                  leaveRequests.value.map((item) =>
                    h('article', { class: 'row', key: item.id }, [
                      h('strong', item.reason),
                      h('span', item.status)
                    ])
                  )
                )
              ])
            : null,
          activeTab.value === '通知'
            ? h('section', { class: 'panel' }, [
                h('h3', '通知'),
                h(
                  'div',
                  { class: 'list' },
                  notices.value.map((notice) =>
                    h('article', { class: 'row notice', key: notice.id }, [
                      h('div', [
                        h('strong', notice.title),
                        h('p', notice.content),
                        notice.type === 'schedule_change'
                          ? h(
                              'p',
                              `原时间：${notice.originalTime}；新时间：${notice.newTime}；代课：${notice.substituteTeacherName}`
                            )
                          : null
                      ]),
                      h('span', notice.read ? '已读' : '未读')
                    ])
                  )
                )
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
                      h('div', { class: 'actions' }, [
                        h(
                          'button',
                          { type: 'button', onClick: () => markFeedback(item.id, 'confirmed') },
                          '确认'
                        ),
                        h(
                          'button',
                          { type: 'button', onClick: () => markFeedback(item.id, 'disputed') },
                          '提出异议'
                        )
                      ])
                    ])
                  )
                )
              ])
            : null
        ])
      ]);
  }
});
