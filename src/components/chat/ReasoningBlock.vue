<template>
  <details v-if="reasoning" class="reasoning-block" :open="autoOpen">
    <summary>
      <span class="reasoning-title">深度思考</span>
      <span class="reasoning-toggle">{{ isOpen ? '收起' : '展开' }}</span>
    </summary>
    <div class="reasoning-content" v-html="renderedReasoning"></div>
  </details>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { formatContent } from '@/utils/formatContent'

const props = defineProps<{
  reasoning: string
  autoOpen?: boolean
}>()

const isOpen = ref(props.autoOpen ?? false)
const renderedHtml = ref('')

watch(
  () => props.reasoning,
  async (val) => {
    renderedHtml.value = val ? await formatContent(val) : ''
  },
  { immediate: true }
)

const renderedReasoning = computed(() => renderedHtml.value)

function toggle() {
  isOpen.value = !isOpen.value
}
</script>

<style scoped>
.reasoning-block {
  background: var(--bg-tertiary);
  border-radius: 8px;
  margin-bottom: 8px;
  overflow: hidden;
}

.reasoning-block summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  cursor: pointer;
  font-size: 12px;
  user-select: none;
}

.reasoning-title {
  color: var(--text-secondary);
  font-weight: 500;
}

.reasoning-toggle {
  color: var(--el-color-primary);
  font-size: 11px;
}

.reasoning-content {
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-secondary);
  padding: 0 10px 10px;
  max-height: 300px;
  overflow-y: auto;
}
</style>
