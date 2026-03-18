<script setup>
import { ref, onMounted } from 'vue';
import { dbService } from '@/utils/db';
import { ElMessage } from 'element-plus';

const isDbReady = ref(false);
const isLoading = ref(true);

onMounted(async () => {
  try {
    // 全局初始化数据库
    await dbService.init();
    isDbReady.value = true;
  } catch (error) {
    console.error('Global DB init failed:', error);
    ElMessage.error('数据库初始化失败，请刷新重试');
  } finally {
    isLoading.value = false;
  }
});
</script>

<template>
  <div v-if="isLoading" class="global-loading">
    <el-icon class="is-loading" :size="40"><Loading /></el-icon>
    <p>正在初始化本地数据库环境...</p>
  </div>
  <router-view v-else-if="isDbReady" />
  <div v-else class="global-error">
    <el-result icon="error" title="初始化失败" sub-title="请检查网络连接或刷新页面重试" />
  </div>
</template>

<style scoped>
.global-loading,
.global-error {
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #606266;
}

.global-loading p {
  margin-top: 16px;
  font-size: 16px;
}
</style>
