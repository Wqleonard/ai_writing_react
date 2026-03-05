<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElInput, ElButton } from 'element-plus'
import { getShareDetail, saveDraft, publishShare, createEmptyShare, type ShareDetailResponse, type SaveDraftRequest, type PublishShareRequest } from '@/api/share'
import TiptapEditor from '@/components/TiptapEditor.vue'
import { useNavigation } from "@/hooks/useNavigation.ts"

const route = useRoute()
const router = useRouter()
const { navigateTo } = useNavigation()

// 表单数据
const title = ref('')
const content = ref('')
const shareId = ref('')
const loading = ref(false)
const savingDraft = ref(false)
const publishing = ref(false)
const isNewShare = ref(false) // 标识是否是新建分享

// 标题字数统计
const titleLength = computed(() => title.value.length)
const maxTitleLength = 50

// 加载分享详情（用于编辑草稿）
const loadShareDetail = async (id: string) => {
  try {
    loading.value = true
    const response = await getShareDetail(id) as ShareDetailResponse
    if (response) {
      title.value = response.title || ''
      content.value = response.content || ''
      shareId.value = String(response.id)
    }
  } catch (error) {
    console.error('加载分享详情失败:', error)
    ElMessage.error('加载分享详情失败，请稍后重试')
  } finally {
    loading.value = false
  }
}

// 创建空分享
const createShare = async () => {
  try {
    const id = await createEmptyShare()
    if (typeof id === 'number') {
      shareId.value = String(id)
      return true
    }
    return false
  } catch (error) {
    console.error('创建分享失败:', error)
    ElMessage.error('创建分享失败，请稍后重试')
    return false
  }
}

// 保存草稿
const handleSaveDraft = async () => {
  if (!title.value.trim()) {
    ElMessage.warning('请输入标题')
    return
  }
  if (!content.value.trim()) {
    ElMessage.warning('请输入内容')
    return
  }

  try {
    savingDraft.value = true

    // 如果是新建分享，先创建
    if (isNewShare.value && !shareId.value) {
      const created = await createShare()
      if (!created) {
        return
      }
    }

    const data: SaveDraftRequest = {
      title: title.value.trim(),
      coverImageUrl: '',
      content: content.value.trim()
    }
    await saveDraft(shareId.value, data)
    ElMessage.success('保存草稿成功')

    // 保存成功后不再自动返回，让用户继续编辑
  } catch (error) {
    console.error('保存草稿失败:', error)
    ElMessage.error('保存草稿失败，请稍后重试')
  } finally {
    savingDraft.value = false
  }
}

// 发布分享
const handlePublish = async () => {
  if (!title.value.trim()) {
    ElMessage.warning('请输入标题')
    return
  }
  if (!content.value.trim()) {
    ElMessage.warning('请输入内容')
    return
  }

  try {
    publishing.value = true

    // 如果是新建分享，先创建
    if (isNewShare.value && !shareId.value) {
      const created = await createShare()
      if (!created) {
        return
      }
    }

    const data: PublishShareRequest = {
      title: title.value.trim(),
      coverImageUrl: '',
      content: content.value.trim()
    }
    await publishShare(shareId.value, data)
    ElMessage.success('已提交审核')

    // 发布成功后返回
    setTimeout(() => {
      router.go(-1)
    }, 500)
  } catch (error) {
    console.error('发布失败:', error)
    ElMessage.error('发布失败，请稍后重试')
  } finally {
    publishing.value = false
  }
}

// 返回
const goBack = () => {
  router.go(-1)
}

onMounted(() => {
  const id = route.params.id as string
  if (id && id !== 'new') {
    shareId.value = id
    // 加载详情（如果是编辑草稿）
    loadShareDetail(id)
  } else {
    // 新建分享
    isNewShare.value = true
  }
})
</script>

<template>
  <div class="share-create-container h-full flex flex-col items-center px-2">
    <!-- 顶部导航栏 -->
    <header class="w-265 h-8 flex items-center">
      <el-button link class="back-button" @click="goBack">
        <span style="font-size: 20px;" class="iconfont">&#xeaa2;</span>
        <span class="">返回</span>
      </el-button>
    </header>

    <el-scrollbar class="w-full mx-auto flex-1 min-h-0">
      <div class="w-full flex flex-col items-center" v-loading="loading">
        <div class="flex flex-col w-265 items-center">
          <!-- 标题区域 (可选) -->
          <div class="text-3xl font-bold py-4">创建分享</div>

          <!-- 标题输入 - 左右布局 -->
          <div class="form-row">
            <div class="form-label">
              标题<span class="required">*</span>
            </div>
            <div class="form-input-wrapper">
              <el-input
                v-model="title"
                placeholder="请输入标题"
                :maxlength="maxTitleLength"
                class="title-input"
              />
              <span class="char-count">{{ titleLength }}/{{ maxTitleLength }}</span>
            </div>
          </div>

          <!-- 内容输入 - 左右布局 -->
          <div class="form-row content-row">
            <div class="form-label">
              内容<span class="required">*</span>
            </div>
            <div class="form-input-wrapper">
              <div class="editor-wrapper">
                <TiptapEditor
                  v-model="content"
                  placeholder="请输入内容"
                  :show-toolbar="false"
                  :need-selection-toolbar="false"
                  :btns="[]"
                  model-type="md"
                />
              </div>
            </div>
          </div>

          <!-- 按钮区域 - 底部靠右 -->
          <div class="button-row">
            <el-button
              @click="handleSaveDraft"
              :loading="savingDraft"
              :disabled="publishing"
              class="action-btn"
            >
              保存
            </el-button>
            <el-button
              type="primary"
              @click="handlePublish"
              :loading="publishing"
              :disabled="savingDraft"
              class="action-btn"
            >
              发布
            </el-button>
          </div>
        </div>
      </div>
    </el-scrollbar>
  </div>
</template>

<style scoped lang="less">
.share-create-container {
  background: transparent;
}

.back-button {
  color: #666;
  font-size: 20px;

  &:hover {
    color: var(--el-color-primary);
  }
}

.form-row {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  width: 100%;
  margin-bottom: 20px;
  align-items: flex-start;
}

.content-row {
  align-items: flex-start;
  margin-bottom: 30px;
}

.form-label {
  width: 80px;
  flex-shrink: 0;
  font-size: 18px;
  margin-top: 5px;
  color: #333;
  text-align: left;
}

.required {
  color: #f56c6c;
  margin-left: 2px;
}

.form-input-wrapper {
  flex: 1;
  position: relative;
}

.title-input {
  :deep(.el-input__wrapper) {
    // border: 1px solid #dcdfe6;
    border-radius: 10px;
    padding: 3px 70px 5px 10px !important;
    font-size: 18px;
  }
}

.char-count {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 12px;
  color: #999;
  pointer-events: none;
}

.editor-wrapper {
  border: 1px solid #e5e5e5;
  border-radius: 10px;
  overflow: hidden;
  min-height: 500px;
  background: white;

  :deep(.tiptap-editor) {
    height: 100%;
    min-height: 500px;
    padding: 0;
  }

  :deep(.ProseMirror) {
    min-height: 500px !important;
    padding: 0px 10px !important;
    font-size: 18px !important;
  }
}

.button-row {
  width: 100%;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-bottom: 40px;
}

.action-btn {
  min-width: 80px;
  border-radius: 10px;
}
</style>
