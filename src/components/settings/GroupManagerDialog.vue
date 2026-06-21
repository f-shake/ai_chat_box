<template>
  <el-dialog v-model="visible" title="管理分组" width="90%" style="max-width: 450px">
    <div class="group-list">
      <div v-for="g in promptStore.groups" :key="g.key" class="group-item">
        <el-input
          v-if="editingGroupKey === g.key"
          v-model="editingGroupName"
          @keyup.enter="saveGroupName(g.key)"
          @blur="saveGroupName(g.key)"
        />
        <span v-else class="group-name">{{ g.name }}</span>
        <span class="group-badge">{{ getGroupCount(g.key) }}</span>
        <div class="group-actions">
          <el-button text @click="startEditGroup(g)">
            <el-icon><Edit /></el-icon>
          </el-button>
          <el-button
            v-if="!g.builtIn"
            text
            type="danger"
            @click="deleteGroup(g.key)"
          >
            <el-icon><Close /></el-icon>
          </el-button>
        </div>
      </div>
    </div>
    <div class="add-group">
      <el-input v-model="newGroupName" placeholder="新分组名称" />
      <el-button @click="addGroup" :disabled="!newGroupName.trim()">添加</el-button>
    </div>
    <template #footer>
      <el-button @click="visible = false">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { usePromptStore } from '@/stores/promptStore'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const promptStore = usePromptStore()

const visible = ref(props.modelValue)
watch(() => props.modelValue, (v) => { visible.value = v })
watch(visible, (v) => emit('update:modelValue', v))

const newGroupName = ref('')
const editingGroupKey = ref('')
const editingGroupName = ref('')

function getGroupCount(key: string): number {
  return promptStore.allPrompts.filter((p) => p.groupKey === key).length
}

function startEditGroup(g: { key: string; name: string }) {
  editingGroupKey.value = g.key
  editingGroupName.value = g.name
}

async function saveGroupName(key: string) {
  if (editingGroupName.value.trim()) {
    await promptStore.renameGroup(key, editingGroupName.value.trim())
  }
  editingGroupKey.value = ''
}

async function deleteGroup(key: string) {
  ElMessageBox.confirm('删除分组也会删除该分组下的所有自定义预设', '删除分组', {
    type: 'warning',
    confirmButtonText: '删除',
    cancelButtonText: '取消',
  }).then(() => {
    promptStore.deleteGroup(key)
  }).catch(() => {})
}

async function addGroup() {
  if (newGroupName.value.trim()) {
    await promptStore.addGroup(newGroupName.value.trim())
    newGroupName.value = ''
  }
}
</script>

<style scoped>
.group-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
}

.group-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  background: var(--bg-secondary);
}

.group-name {
  flex: 1;
  font-size: 13px;
  color: var(--text-primary);
}

.group-badge {
  font-size: 11px;
  color: var(--text-tertiary);
  background: var(--bg-tertiary);
  padding: 1px 6px;
  border-radius: 10px;
}

.group-actions {
  display: flex;
  gap: 2px;
}

.add-group {
  display: flex;
  gap: 8px;
}
</style>
