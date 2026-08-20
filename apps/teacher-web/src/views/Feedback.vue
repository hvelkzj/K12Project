<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { TeacherApiClient } from '@/teacherApiClient'
import { createTeacherAuthClient } from '@/authClient'
import { useRouter } from 'vue-router'

const router = useRouter()
const apiClient = new TeacherApiClient(fetch)
const authClient = createTeacherAuthClient(fetch)

const listData = ref<any>([])
const loading = ref(false)
const errorMsg = ref('')
//处理反馈表单
const feedbackForm = ref({
  feedbackId: '',
  replyContent: ''
})
const submitLoading = ref(false)

async function submitFeedbackReply() {
  submitLoading.value = true
  try {
    await apiClient.replyFeedback(feedbackForm.value)
    await loadData()
    feedbackForm.value = { feedbackId: '', replyContent: '' }
  } catch (err: any) {
    errorMsg.value = err?.message || '回复反馈失败'
  } finally {
    submitLoading.value = false
  }
}
async function loadData() {
  loading.value = true
  errorMsg.value = ''
  try {
    // ==========只改这里接口，其他代码几乎不动==========
    const data = await apiClient.getFeedbackList()
    listData.value = data
  } catch(err:any) {
    if(err?.status === 401) {
      sessionStorage.removeItem('k12AccessToken')
      router.push('/login')
      return
    }
    errorMsg.value = err?.message || '获取签到列表失败'
  } finally {
    loading.value = false
  }
}

onMounted(()=>{
  loadData()
})
</script>

<template>
  <div class="checkin-page">
    <h2>学生反馈列表</h2>
    <div v-if="loading">加载中...</div>
    <div v-if="errorMsg" style="color:red">{{ errorMsg }}</div>
    <div v-if="!loading && !errorMsg && listData.length === 0">暂无签到数据</div>
    <div v-if="listData">
      <pre>{{ listData }}</pre>
    </div>
  </div>
  <div style="margin-top:20px;border-top:1px solid #ccc;padding-top:16px;">
  <h3>回复用户反馈</h3>
  <div>
    <label>反馈ID：</label>
    <input v-model="feedbackForm.feedbackId" placeholder="填写反馈编号"/>
  </div>
  <div style="margin:8px 0;">
    <label>回复内容：</label>
    <textarea v-model="feedbackForm.replyContent" rows="4" placeholder="输入回复内容"></textarea>
  </div>
  <button @click="submitFeedbackReply" :disabled="submitLoading">
    {{ submitLoading ? '提交中...' : '提交回复' }}
  </button>
</div>
</template>