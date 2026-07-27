<script setup lang="ts">
const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:3000'
</script>

<template>
  <main class="shell">
    <p class="eyebrow">K12 教育培训综合管理平台</p>
    <h1>教务 / 系统后台</h1>
    <p>项目骨架已就绪，业务页面由 E 成员继续完成。</p>
    <dl>
      <dt>后端地址</dt>
      <dd>{{ apiBaseUrl }}</dd>
      <dt>本地端口</dt>
      <dd>5176</dd>
    </dl>
  </main>
</template>
