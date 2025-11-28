<template>
  <div class="task-progress-view">
    <div class="progress-header">
      <div class="header-left">
        <q-icon name="account_tree" size="20px" class="q-mr-sm" />
        <span class="text-weight-bold">任务执行进度</span>
      </div>
      <q-btn
        flat
        dense
        round
        icon="close"
        size="sm"
        @click="$emit('close')"
        class="close-btn"
      >
        <q-tooltip>关闭</q-tooltip>
      </q-btn>
    </div>

    <div class="progress-content">
      <div class="task-list">
        <div
          v-for="(task, index) in tasks"
          :key="task.id"
          class="task-item"
          :class="{
            'task-pending': task.status === 'pending',
            'task-running': task.status === 'running',
            'task-success': task.status === 'success',
            'task-error': task.status === 'error',
          }"
        >
          <div class="task-index">{{ index + 1 }}</div>

          <div class="task-icon">
            <q-spinner-dots
              v-if="task.status === 'running'"
              color="primary"
              size="20px"
            />
            <q-icon
              v-else-if="task.status === 'success'"
              name="check_circle"
              color="positive"
              size="20px"
            />
            <q-icon
              v-else-if="task.status === 'error'"
              name="cancel"
              color="negative"
              size="20px"
            />
            <q-icon
              v-else
              name="radio_button_unchecked"
              color="grey-5"
              size="20px"
            />
          </div>

          <div class="task-content">
            <div class="task-label">{{ task.label }}</div>
            <div v-if="task.desc" class="task-desc">{{ task.desc }}</div>
            <div v-if="task.error" class="task-error-msg">{{ task.error }}</div>
          </div>

          <div class="task-status-text">
            <span v-if="task.status === 'pending'" class="text-grey-6">待执行</span>
            <span v-else-if="task.status === 'running'" class="text-primary">执行中</span>
            <span v-else-if="task.status === 'success'" class="text-positive">已完成</span>
            <span v-else-if="task.status === 'error'" class="text-negative">失败</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: "TaskProgressView",
  props: {
    tasks: {
      type: Array,
      required: true,
      default: () => [],
    },
  },
};
</script>

<style scoped>
.task-progress-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--utools-bg-color);
  padding: clamp(8px, 2vw, 16px);
}

.progress-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: clamp(8px, 2vh, 16px);
  font-size: clamp(14px, 2vw, 16px);
}

.header-left {
  display: flex;
  align-items: center;
}

.close-btn {
  opacity: 0.7;
  transition: opacity 0.2s;
}

.close-btn:hover {
  opacity: 1;
}

.progress-content {
  flex: 1;
  overflow-y: auto;
}

.task-list {
  display: flex;
  flex-direction: column;
  gap: clamp(4px, 1vh, 8px);
}

.task-item {
  display: flex;
  align-items: center;
  gap: clamp(8px, 1.5vw, 12px);
  padding: clamp(8px, 1.5vh, 12px);
  border-radius: 8px;
  background-color: transparent;
  border: 1px solid rgba(128, 128, 128, 0.2);
  transition: all 0.3s ease;
}

.task-item.task-pending {
  opacity: 0.6;
}

.task-item.task-running {
  border-color: var(--q-primary);
  background-color: rgba(var(--q-primary-rgb), 0.05);
  box-shadow: 0 0 0 1px rgba(var(--q-primary-rgb), 0.1);
}

.task-item.task-success {
  border-color: var(--q-positive);
  background-color: rgba(var(--q-positive-rgb), 0.05);
}

.task-item.task-error {
  border-color: var(--q-negative);
  background-color: rgba(var(--q-negative-rgb), 0.05);
}

.task-index {
  display: flex;
  align-items: center;
  justify-content: center;
  width: clamp(20px, 3vw, 24px);
  height: clamp(20px, 3vw, 24px);
  border-radius: 50%;
  background-color: rgba(255, 255, 255, 0.1);
  font-size: clamp(10px, 1.5vw, 12px);
  font-weight: bold;
  flex-shrink: 0;
}

.task-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.task-content {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.task-label {
  font-weight: 500;
  font-size: clamp(12px, 1.8vw, 14px);
  margin-bottom: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-desc {
  font-size: clamp(10px, 1.5vw, 12px);
  color: var(--q-grey-6);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-error-msg {
  font-size: clamp(10px, 1.5vw, 12px);
  color: var(--q-negative);
  margin-top: 4px;
  word-break: break-word;
}

.task-status-text {
  font-size: clamp(10px, 1.5vw, 12px);
  font-weight: 500;
  flex-shrink: 0;
  white-space: nowrap;
}

/* 响应式适配 - 小屏幕 */
@media (max-width: 600px) {
  .task-item {
    flex-wrap: wrap;
  }

  .task-status-text {
    width: 100%;
    text-align: right;
    margin-top: 4px;
  }
}

/* 响应式适配 - 超小屏幕 */
@media (max-width: 400px) {
  .task-index {
    display: none;
  }

  .progress-header {
    font-size: 14px;
  }
}
</style>
