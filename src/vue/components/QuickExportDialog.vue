<template>
  <div
    class="quick-export-dropdown"
    v-show="visible"
    @click.stop
  >
    <div class="quick-export-menu">
      <div class="export-options">
        <!-- 导出全书选项 -->
        <div
          class="export-option"
          @click="exportFullBook('word')"
        >
          <span class="option-text">导出正文为 Word</span>
        </div>
        <div
          class="export-option"
          @click="exportFullBook('txt')"
        >
          <span class="option-text">导出正文为 TXT</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { useEditorStore } from '@/vue/stores/editor'
import { storeToRefs } from 'pinia'
import { ExportUtils } from '@/utils/exportUtils'
import type { FileTreeNode } from '@/stores/editorStore'
import type { DocChapterStorageData } from '@/utils/interfaces'

interface Props {
  visible: boolean
  /** 是否为剧本模式：正文为 第N集.md + ScriptChapterStorageData，与快捷创作的 正文-第N章 + DocChapterStorageData 区分 */
  isScript?: boolean
}

interface Emits {
  (e: 'close'): void
}

const props = withDefaults(defineProps<Props>(), {
  isScript: false
})
const emit = defineEmits<Emits>()

const editorStore = useEditorStore()
const { serverData, workInfo } = storeToRefs(editorStore)

// 快捷创作：从目录名称中提取章节索引（正文-第N章.md 或 正文-第x章.md）
const getQuickChapterIndexFromDir = (dir: string): number => {
  const numMatch = dir.match(/正文-第(\d+)章\.md/)
  if (numMatch) return Math.max(0, parseInt(numMatch[1], 10) - 1)
  const match = dir.match(/正文-第(.+)章\.md/)
  if (!match) return -1
  const chineseNumbers = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十',
    '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十']
  const index = chineseNumbers.indexOf(match[1])
  return index > 0 ? index - 1 : -1
}

// 剧本：从目录名称中提取集数索引（第N集.md）
const getScriptEpisodeIndexFromDir = (dir: string): number => {
  const match = dir.match(/^第(\d+)集\.md$/)
  if (match) return Math.max(0, parseInt(match[1], 10) - 1)
  return -1
}

/**
 * 将 serverData 转换为 FileTreeNode 结构（按 isScript 区分剧本 / 快捷创作）
 * 只导出正文（章/集目录），其他目录不导出
 */
const convertServerDataToWorkNode = (): FileTreeNode | null => {
  if (!workInfo.value?.title) {
    return null
  }

  const workTitle = workInfo.value.title
  const children: FileTreeNode[] = []
  const directories = Object.keys(serverData.value)

  if (props.isScript) {
    // 剧本：正文为 第N集.md，数据为 ScriptChapterStorageData { episodeNote, content }
    const episodeDirs = directories.filter(dir => /^第\d+集\.md$/.test(dir))
    if (episodeDirs.length === 0) return null

    episodeDirs.sort((a, b) => getScriptEpisodeIndexFromDir(a) - getScriptEpisodeIndexFromDir(b))

    episodeDirs.forEach(dir => {
      const raw = serverData.value[dir]
      if (!raw) return
      try {
        const parsed = JSON.parse(raw) as { episodeNote?: string; content?: string }
        const content = parsed.content ?? ''
        children.push({
          id: dir,
          key: dir,
          label: dir.replace('.md', ''),
          content,
          isDirectory: false,
          path: [dir],
          fileType: 'md',
          children: []
        })
      } catch {
        children.push({
          id: dir,
          key: dir,
          label: dir.replace('.md', ''),
          content: raw,
          isDirectory: false,
          path: [dir],
          fileType: 'md',
          children: []
        })
      }
    })
  } else {
    // 快捷创作：正文为 正文-第N章.md，数据为 DocChapterStorageData { detailedOutline, content }
    const chapterDirs = directories.filter(dir => dir.startsWith('正文-第') && dir.endsWith('章.md'))
    if (chapterDirs.length === 0) return null

    chapterDirs.sort((a, b) => getQuickChapterIndexFromDir(a) - getQuickChapterIndexFromDir(b))

    chapterDirs.forEach(dir => {
      const chapterData = serverData.value[dir]
      if (chapterData) {
        try {
          const parsed = JSON.parse(chapterData) as DocChapterStorageData
          const chapterContent = parsed.content || ''
          children.push({
            id: dir,
            key: dir,
            label: dir.replace('.md', ''),
            content: chapterContent,
            isDirectory: false,
            path: [dir],
            fileType: 'md',
            children: []
          })
        } catch {
          children.push({
            id: dir,
            key: dir,
            label: dir.replace('.md', ''),
            content: chapterData,
            isDirectory: false,
            path: [dir],
            fileType: 'md',
            children: []
          })
        }
      }
    })
  }

  return {
    id: workTitle,
    key: workTitle,
    label: workTitle,
    content: '',
    isDirectory: true,
    path: [],
    children
  }
}

/**
 * 导出正文
 */
const exportFullBook = async (format: 'word' | 'txt') => {
  const workNode = convertServerDataToWorkNode()

  if (!workNode) {
    ElMessage.warning('没有可导出的正文内容')
    return
  }

  try {
    if (format === 'word') {
      await ExportUtils.exportWorkAsZipDoc(workNode)
      ElMessage.success('正文 Word 文件导出成功')
    } else {
      await ExportUtils.exportWorkAsZipTxt(workNode)
      ElMessage.success('正文 TXT 文件导出成功')
    }
    emit('close')
  } catch (error) {
    console.error('导出失败:', error)
    ElMessage.error(error instanceof Error ? error.message : '导出失败')
  }
}
</script>

<style scoped lang="less">
.quick-export-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  z-index: 1000;
  margin-top: 8px;
}

.quick-export-menu {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  min-width: 200px;
  box-shadow: 0 4px 12px var(--shadow-color);
  color: var(--text-primary);
  overflow: hidden;
}

.export-title {
  padding: 12px 16px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.export-options {
  padding: 4px 0;
}

.export-option {
  display: flex;
  align-items: center;
  padding: 10px 16px;
  cursor: pointer;
  transition: background-color 0.2s ease;
  font-size: 14px;
  color: var(--text-primary);

  &:hover {
    background: var(--bg-hover);
  }

  &:active {
    background: var(--bg-active);
  }
}

.option-text {
  color: var(--text-primary);
  flex: 1;
}
</style>

