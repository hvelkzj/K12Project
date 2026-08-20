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
//批改作业表单
const reviewForm = ref({
  homeworkId: '',
  score: '',
  comment: ''
})
const submitLoading = ref(false)

async function submitReview() {
  submitLoading.value = true
  try {
    await apiClient.reviewHomework(reviewForm.value)
    await loadData()
    reviewForm.value = { homeworkId: '', score: '', comment: '' }
  } catch (err: any) {
    errorMsg.value = err?.message || '批改提交失败'
  } finally {
    submitLoading.value = false
  }
}

async function loadData() {
  loading.value = true
  errorMsg.value = ''
  try {
    // ==========只改这里接口，其他代码几乎不动==========
    const data = await apiClient.getReviewList()
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
    <h2>作业批改列表</h2>
    <div v-if="loading">加载中...</div>
    <div v-if="errorMsg" style="color:red">{{ errorMsg }}</div>
    <div v-if="!loading && !errorMsg && listData.length === 0">暂无签到数据</div>
    <div v-if="listData">
      <pre>{{ listData }}</pre>
    </div>
  </div>
  <div style="margin-top:20px;border-top:1px solid #ccc;padding-top:16px;">
  <h3>批改作业</h3>
  <div>
    <label>作业ID：</label>
    <input v-model="reviewForm.homeworkId" placeholder="输入作业ID"/>
  </div>
  <div style="margin:8px 0;">
    <label>分数：</label>
    <input v-model="reviewForm.score" placeholder="填写分数"/>
  </div>
  <div style="margin:8px 0;">
    <label>批改评语：</label>
    <textarea v-model="reviewForm.comment" rows="4" placeholder="写下批改评语"></textarea>
  </div>
  <button @click="submitReview" :disabled="submitLoading">
    {{ submitLoading ? '提交中...' : '提交批改' }}
  </button>
</div>
</template>