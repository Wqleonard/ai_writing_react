import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { EditorSaveStatus, TreeNode } from '@/utils/interfaces.ts'
import {
  fileTreeData2ServerData,
  type FileTreeNode,
  type ServerData,
} from '@/utils/aiTreeNodeConverter'
import {
  createWorkReq,
  getWorksByIdReq,
  getWorksByIdAndVersionReq,
  updateWorkVersionReq,
  updateWorkInfoReq,
} from '@/api/works'
import { ElMessage } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
import { getWorkInfoFromLocalStorage, saveWorkInfoToLocalStorage } from '@/utils/utils'
import { debounce } from 'lodash-es'
import { trackingWorkInfoSave } from '@/utils/matomoTrackingEvent/adopEvent'

export interface WorkVersion {
  versionId: string
  isAutoSaved: string
  updatedTime: string
}

interface EditorSettings {
  fontSize: number
  lineHeight: number
  fontWeight: number
  margin: number
  textIndentEnabled: boolean
}

// 根据 mock 数据补全 InspirationDraw 类型和初始化
interface InspirationDraw {
  id: string
  workId: string
  content: string
  createdTime: string
  updatedTime: string
  nodes: any[]
  edges: any[]
}

export interface ElTreeNode {
  id: string
  label: string
  content?: string
  children?: ElTreeNode[]
  path: string
  originNode?: TreeNode
}

// 流式任务状态类型  edit表示有编辑内容代用户确认 hilt_pending表示有人在回路中待处理
export type StreamingTaskStatus =
  | 'streaming'
  | 'pending'
  | 'ready'
  | 'edit_pending'
  | 'hilt_pending'

export interface Tag {
  id: number
  name: string
  userId: string
  categoryId?: string
}

export interface WorkInfo {
  workId: string
  title: string
  introduction: string
  createdTime: string
  updatedTime: string
  description: string
  stage: string
  chapterNum?: number
  wordNum?: number,
  workTags: Tag[]
}

export const useEditorStore = defineStore('editor', () => {
  const serverData = ref<any>({})

  const workInfo = ref<WorkInfo>({
    workId: '',
    title: '',
    introduction: '',
    createdTime: '',
    updatedTime: '',
    description: '',
    stage: 'final',
    chapterNum: 10,
    wordNum: 1000,
    workTags: [],
  })

  const baseEditorSettings = {
    fontSize: 22,
    lineHeight: 1.3,
    fontWeight: 400,
    margin: 40,
    textIndentEnabled: false,
  }

  const editorSettings = ref<EditorSettings>(baseEditorSettings)

  const inspirationDraw = ref<InspirationDraw>({
    id: '',
    workId: '',
    content: '',
    createdTime: '',
    updatedTime: '',
    nodes: [],
    edges: [],
  })

  const currentContent = ref<string>('')
  const hasTourOpened = ref<boolean>(false)
  const tourOpen = ref<any>(false)

  // 是否在该浏览器打开过引导（持久化）
  const hasTourOpenedOnThisClient = ref<boolean>(
    localStorage.getItem('hasTourOpenedOnThisClient') === 'true'
  )

  // 监听 hasTourOpenedOnThisClient 变化，同步存储到 localStorage
  watch(hasTourOpenedOnThisClient, newValue => {
    if (newValue) {
      localStorage.setItem('hasTourOpenedOnThisClient', 'true')
    } else {
      localStorage.removeItem('hasTourOpenedOnThisClient')
    }
  })

  // 保存编辑器设置（通过 watch 自动持久化）
  const saveEditorSettings = (settings: EditorSettings) => {
    // 只需要更新 editorSettings.value，watch 会自动应用样式并保存到 localStorage
    editorSettings.value = settings
  }

  const loadEditorSettings = () => {
    try {
      const savedSettings = localStorage.getItem('editorSettings')
      if (savedSettings) {
        editorSettings.value = JSON.parse(savedSettings)
      } else {
        editorSettings.value = baseEditorSettings
      }
    } catch (error) {
      console.error('读取编辑器设置失败:', error)
      editorSettings.value = baseEditorSettings
    }
  }

  // 初始化时加载本地存储的设置
  loadEditorSettings()

  const workId = ref('')

  const sidebarTreeData = ref<FileTreeNode[]>([])
  // 从 localStorage 初始化或使用默认值
  const currentSidebarId = ref<string>(localStorage.getItem('currentSidebarId') || '')
  const currentEditingId = ref<string>(localStorage.getItem('currentEditingId') || '')

  // 统一的流式任务状态（多个流式任务可能改变此状态）
  const streamingTaskStatus = ref<StreamingTaskStatus>('ready')

  // 监听 currentSidebarId 变化，同步存储到 localStorage
  watch(currentSidebarId, newValue => {
    if (newValue) {
      localStorage.setItem('currentSidebarId', newValue)
    } else {
      localStorage.removeItem('currentSidebarId')
    }
    const node = findNodeById(newValue)
    if (node && node.id && node.fileType == 'md') {
      if (currentEditingId.value != node.id) {
        currentEditingId.value = node.id
      }
    }
  })

  // 监听 currentEditingId 变化，同步存储到 localStorage
  watch(currentEditingId, newValue => {
    if (newValue) {
      localStorage.setItem('currentEditingId', newValue)
    } else {
      localStorage.removeItem('currentEditingId')
    }
    if (currentSidebarId.value != newValue) {
      currentSidebarId.value = newValue
    }
  })

  // 通过 id 查找 sidebarTreeData 中对应的节点
  const findNodeById = (id: string): FileTreeNode | null => {
    if (!id || !sidebarTreeData.value || sidebarTreeData.value.length === 0) {
      return null
    }

    // 递归查找节点
    const findNodeRecursive = (nodes: FileTreeNode[]): FileTreeNode | null => {
      for (const node of nodes) {
        if (node.id === id) {
          return node
        }
        if (node.children && node.children.length > 0) {
          const found = findNodeRecursive(node.children)
          if (found) return found
        }
      }
      return null
    }

    return findNodeRecursive(sidebarTreeData.value)
  }

  // 通过 id 更新或创建节点并更新 content
  const updateNodeContentById = (id: string, content: string): boolean => {
    if (!id || !id.endsWith('.md')) {
      console.error('节点 id 格式错误，必须以 .md 结尾')
      return false
    }

    // 查找节点是否存在
    const existingNode = findNodeById(id)
    if (existingNode) {
      // 节点存在，直接更新 content
      existingNode.content = content
      existingNode.new = true // 标记为新节点
      // 触发响应式更新
      sidebarTreeData.value = [...sidebarTreeData.value]
      if (currentEditingId.value == id) {
        currentContent.value = content
      }
      return true
    }

    // 节点不存在，需要创建
    const pathParts = id.split('/').filter(part => part !== '')
    if (pathParts.length === 0) {
      console.error('节点 id 格式错误')
      return false
    }

    // 获取文件名（最后一个部分）
    const fileName = pathParts[pathParts.length - 1]
    // 获取文件标签（移除扩展名）
    const fileLabel = fileName.replace(/\.md$/, '')
    // 获取父路径部分（除了文件名）
    const parentPathParts = pathParts.slice(0, -1)

    // 确保 sidebarTreeData 是数组
    if (!Array.isArray(sidebarTreeData.value)) {
      sidebarTreeData.value = []
    }

    // 查找或创建父目录节点
    let parentNode: FileTreeNode | null = null

    if (parentPathParts.length === 0) {
      // 如果没有父路径，文件直接在根级别
      // 这种情况下，我们直接在 sidebarTreeData 中创建文件节点
      const fileNode: FileTreeNode = {
        id: id,
        key: pathParts.join('-'),
        label: fileLabel,
        content: content,
        isDirectory: false,
        path: pathParts,
        fileType: 'md',
        children: [],
        new: true,
      }
      sidebarTreeData.value.push(fileNode)
      sidebarTreeData.value = [...sidebarTreeData.value]
      if (currentEditingId.value == id) {
        currentContent.value = content
      }
      return true
    }

    // 有父路径，需要创建所有父目录
    // 首先找到或创建第一级目录
    const firstLevelDir = parentPathParts[0]
    let currentNode: FileTreeNode | null = findNodeById(firstLevelDir)

    if (!currentNode || !currentNode.isDirectory) {
      // 创建第一级目录
      currentNode = {
        id: firstLevelDir,
        key: firstLevelDir,
        label: firstLevelDir,
        content: '',
        isDirectory: true,
        path: [firstLevelDir],
        fileType: 'directory',
        children: [],
      }
      sidebarTreeData.value.push(currentNode)
      sidebarTreeData.value = [...sidebarTreeData.value]
    }

    // 递归创建剩余的目录层级
    for (let i = 1; i < parentPathParts.length; i++) {
      if (!currentNode) {
        console.error('创建目录节点失败')
        return false
      }

      const dirName = parentPathParts[i]
      const currentDirId = parentPathParts.slice(0, i + 1).join('/')

      if (!currentNode.children) {
        currentNode.children = []
      }

      let childDir: FileTreeNode | undefined = currentNode.children.find(
        node => node.id === currentDirId && node.isDirectory
      )

      if (!childDir) {
        childDir = {
          id: currentDirId,
          key: parentPathParts.slice(0, i + 1).join('-'),
          label: dirName,
          content: '',
          isDirectory: true,
          path: parentPathParts.slice(0, i + 1),
          fileType: 'directory',
          children: [],
        }
        currentNode.children.push(childDir)
        sidebarTreeData.value = [...sidebarTreeData.value]
      }

      currentNode = childDir
    }

    if (!currentNode) {
      console.error('创建父目录节点失败')
      return false
    }

    parentNode = currentNode

    // 确保父节点的 children 数组存在
    if (!parentNode.children) {
      parentNode.children = []
    }

    // 创建文件节点
    const fileNode: FileTreeNode = {
      id: id,
      key: pathParts.join('-'),
      label: fileLabel,
      content: content,
      isDirectory: false,
      path: pathParts,
      fileType: 'md',
      children: [],
      new: true,
    }

    // 检查是否已存在同名文件（理论上不应该，但为了安全）
    const existingFile = parentNode.children.find(child => child.id === id)
    if (existingFile) {
      existingFile.content = content
      existingFile.new = true
    } else {
      parentNode.children.push(fileNode)
    }

    // 触发响应式更新
    sidebarTreeData.value = [...sidebarTreeData.value]

    if (currentEditingId.value == id) {
      currentContent.value = content
    }
    return true
  }

  // 通过 id 查找 sidebarTreeData 中对应的节点
  const findNodeByFileName = (fileName: string): FileTreeNode | null => {
    if (!fileName || !sidebarTreeData.value || sidebarTreeData.value.length === 0) {
      return null
    }

    // 递归查找节点
    const findNodeRecursive = (nodes: FileTreeNode[], include = true): FileTreeNode | null => {
      for (const node of nodes) {
        if (include ? node.id.includes(`/${fileName}`) : node.id === fileName) {
          return node
        }
        if (node.children && node.children.length > 0) {
          const found = findNodeRecursive(node.children, include)
          if (found) return found
        }
      }
      return null
    }

    let node = findNodeRecursive(sidebarTreeData.value)
    if (!node) {
      node = findNodeRecursive(sidebarTreeData.value, false)
    }
    return node
  }

  // 查找第一个 fileType 为 'md' 的节点
  const findFirstMdNode = (): FileTreeNode | null => {
    if (!sidebarTreeData.value || sidebarTreeData.value.length === 0) {
      return null
    }

    // 递归查找第一个 md 文件节点
    const findMdNodeRecursive = (nodes: FileTreeNode[]): FileTreeNode | null => {
      for (const node of nodes) {
        // 检查是否是 md 文件节点
        if (!node.isDirectory && node.fileType === 'md') {
          return node
        }
        // 如果是目录，递归查找子节点
        if (node.children && node.children.length > 0) {
          const found = findMdNodeRecursive(node.children)
          if (found) return found
        }
      }
      return null
    }

    return findMdNodeRecursive(sidebarTreeData.value)
  }

  const updateWorkTitle = async () => {
    if (!workInfo.value.workId) return
    // 只有当标题以"未命名作品"开头时，才执行更新逻辑
    if (!workInfo.value.title || !workInfo.value.title.startsWith('未命名作品')) return

    // 从 serverData 中获取故事设定文件内容
    const storySettingKey = '设定/故事设定.md'
    const storySettingContent = serverData.value[storySettingKey]

    if (!storySettingContent || typeof storySettingContent !== 'string') {
      console.warn('未找到故事设定文件:', storySettingKey)
      return
    }

    // 解析 markdown 内容，查找 "## 文章标题" 后面的内容
    const lines: string[] = storySettingContent.split('\n\n')
    const titleIndex = lines.findIndex((line: string) => line.trim() === '## 文章标题')

    if (titleIndex === -1) {
      return
    }

    // 获取下一行作为标题
    let titleLine = lines[titleIndex + 1]?.trim()

    if (!titleLine) {
      return
    }

    // 更新 workInfo 的 title
    workInfo.value.title = titleLine

    // 调用接口同步到服务器
    try {
      await updateWorkInfoReq(workInfo.value.workId, {
        title: workInfo.value.title,
      })
    } catch (error) {
      console.error('更新作品标题失败:', error)
      ElMessage.error('更新作品标题失败')
    }
  }

  const updateWorkIntro = async () => {
    if (!workInfo.value.workId) return
    // 优先从 '正文/导语.md' 文件中查找
    const introductionKey = '正文/导语.md'
    const node = findNodeById(introductionKey)
    if (!node) {
      return
    }
    const introductionContent = node.content
    if (!introductionContent) {
      return
    }
    if (introductionContent == workInfo.value.introduction) {
      return
    }
    workInfo.value.introduction = introductionContent
    // 调用接口同步到服务器
    try {
      await updateWorkInfoReq(workInfo.value.workId, {
        introduction: workInfo.value.introduction,
      })
    } catch (error) {
      console.error('更新作品简介失败:', error)
      ElMessage.error('更新作品导语失败')
    }
  }

  // 重命名节点 label
  const renameNodeLabel = (nodeId: string, newLabel: string): FileTreeNode | null => {
    if (!nodeId || !newLabel) {
      console.warn('❌ nodeId 或 newLabel 不存在')
      return null
    }

    // 使用 findNodeById 查找节点
    const node = findNodeById(nodeId)
    if (!node) {
      console.warn('❌ 未找到节点:', nodeId)
      return null
    }

    // 保存旧的路径，用于更新子节点
    const oldPath = [...(node.path || [])]
    const oldId = nodeId

    // 更新 label
    node.label = newLabel

    // 更新路径中的最后一个部分
    const newPath = [...(node.path || [])]
    if (newPath.length > 0) {
      // 如果是文件节点，需要保持文件扩展名
      if (!node.isDirectory && node.fileType && node.fileType !== 'directory') {
        const originalFileName = newPath[newPath.length - 1]
        const lastDotIndex = originalFileName.lastIndexOf('.')
        if (lastDotIndex > 0) {
          // 有扩展名，保持扩展名
          const extension = originalFileName.substring(lastDotIndex)
          newPath[newPath.length - 1] = newLabel + extension
        } else {
          newPath[newPath.length - 1] = newLabel
        }
      } else {
        newPath[newPath.length - 1] = newLabel
      }
    }

    // 更新节点的路径相关属性
    node.path = newPath
    const newId = newPath.join('/')
    node.id = newId
    if (node.key !== undefined) {
      node.key = newPath.join('-')
    }

    // 递归更新所有子节点的 path、id 和 key
    const updateChildrenPaths = (parentNode: FileTreeNode, newParentPath: string[]) => {
      if (!parentNode.children || parentNode.children.length === 0) {
        return
      }

      for (const child of parentNode.children) {
        // 保存旧的子节点 id，用于检查是否需要更新 currentEditingId
        const oldChildId = child.id

        // 获取子节点自己的名称（路径的最后一个元素）
        const childName =
          child.path && child.path.length > 0 ? child.path[child.path.length - 1] : child.label

        // 更新子节点的 path：新父节点路径 + 子节点自己的名称
        const newChildPath = [...newParentPath, childName]
        child.path = newChildPath

        // 更新子节点的 id 和 key
        const newChildId = newChildPath.join('/')
        child.id = newChildId
        if (child.key !== undefined) {
          child.key = newChildPath.join('-')
        }

        // 如果子节点是当前编辑的节点，需要同步更新 currentEditingId 和 currentSidebarId
        if (currentEditingId.value === oldChildId) {
          currentEditingId.value = newChildId
          currentSidebarId.value = newChildId
        } else if (currentEditingId.value.startsWith(oldChildId + '/')) {
          // 当前编辑的是子节点的子节点，需要替换路径前缀
          const relativePath = currentEditingId.value.substring(oldChildId.length)
          currentEditingId.value = newChildId + relativePath
          currentSidebarId.value = newChildId + relativePath
        }

        // 递归更新子节点的子节点
        if (child.children && child.children.length > 0) {
          updateChildrenPaths(child, newChildPath)
        }
      }
    }

    // 如果有子节点，递归更新所有子节点
    if (node.children && node.children.length > 0) {
      updateChildrenPaths(node, newPath)
    }

    // 如果更新的是当前编辑的节点，需要同步更新 currentEditingId 和 currentSidebarId
    if (currentEditingId.value === oldId) {
      currentEditingId.value = newId
      currentSidebarId.value = newId
    } else if (currentEditingId.value.startsWith(oldId + '/')) {
      // 如果当前编辑的是该节点的子节点，需要替换路径前缀
      const relativePath = currentEditingId.value.substring(oldId.length)
      currentEditingId.value = newId + relativePath
      currentSidebarId.value = newId + relativePath
    }

    // 触发响应式更新
    sidebarTreeData.value = [...sidebarTreeData.value]

    // 返回更新后的节点
    return node
  }

  const createNewWork = async (): Promise<string | null> => {
    try {
      const response = await createWorkReq()
      if (response?.id) {
        return response.id
      }
      return null
    } catch (error) {
      console.error('创建作品失败:', error)
      ElMessage.error('创建作品失败，请重试')
      return null
    }
  }

  const route = useRoute()
  const router = useRouter()

  const initializeWorkId = async (): Promise<string> => {
    const routeWorkId = Array.isArray(route?.params?.workId)
      ? route.params.workId[0]
      : route?.params?.workId || ''

    if (routeWorkId) {
      return routeWorkId + ''
    }

    // 如果没有workId，创建新作品
    const newWorkId = await createNewWork()
    if (newWorkId) {
      // 跳转到新创建的作品页面，添加 isNew 标识参数
      await router.push({
        path: `/editor/${newWorkId}`,
        state: { isNew: true },
      })
      return newWorkId + ''
    }

    // 如果创建失败，返回默认ID
    return 'default-work'
  }

  const initEditorData = async () => {
    // 先清空，防止上次作品数据残留导致页面先展示旧内容；接口返回后再赋新值以触发重绘
    // serverData.value = {}

    workId.value = await initializeWorkId()

    try {
      workInfo.value = {
        ...workInfo.value,
        workId: workId.value,
      }
      const req: any = await getWorksByIdReq(workInfo.value.workId)

      // 2025-12-31 新增：保存 sessions 数据，用于传递给 useDualTabChat
      const sessions = req?.sessions || []

      const updatedWorkInfo = JSON.parse(JSON.stringify(workInfo.value))

      if (req?.id) {
        updatedWorkInfo.workId = req.id
      }
      if (req?.title) {
        updatedWorkInfo.title = req.title
      }
      if (req?.createdTime) {
        updatedWorkInfo.createdTime = req.createdTime
      }
      if (req?.updatedTime) {
        updatedWorkInfo.updatedTime = req.updatedTime
      }
      if (req?.stage) {
        updatedWorkInfo.stage = req.stage
      }
      if (req?.introduction) {
        updatedWorkInfo.introduction = req.introduction
      }
      if (req?.description) {
        updatedWorkInfo.description = req.description
      }
      if (req?.workTags && Array.isArray(req.workTags)) {
        const workTags: Tag[] = []
        for (let i = 0; i < req.workTags.length; i++) {
          const tags = req.workTags[i]?.tags
          if (tags && Array.isArray(tags)) {
            for (let j = 0; j < tags.length; j++) {
              workTags.push({
                id: tags[j].id,
                name: tags[j].name,
                userId: tags[j].userId,
              })
            }
          }
          updatedWorkInfo.workTags = workTags
        }
      }
      if (req?.chapterNum) {
        updatedWorkInfo.chapterNum = req.chapterNum
      }
      if (req?.wordNum) {
        updatedWorkInfo.wordNum = req.wordNum
      }

      workInfo.value = updatedWorkInfo

      // 无版本或新作品时清空 serverData，避免残留上一作品数据（如新建剧本后小说纲章仍显示旧内容）
      if (!req.latestWorkVersion) {
        serverData.value = {}
        return sessions
      }

      if (
        req?.inspirationDraws &&
        Array.isArray(req.inspirationDraws) &&
        req.inspirationDraws.length > 0
      ) {
        const reqBack = req.inspirationDraws[0]
        const content = JSON.parse(reqBack?.content || JSON.stringify({ nodes: [], edges: [] }))
        inspirationDraw.value = {
          ...reqBack,
          nodes: content?.nodes || [],
          edges: content?.edges || [],
        }
      } else {
        // 当前作品没有画布数据时，显式重置，避免沿用上一部作品的画布状态
        inspirationDraw.value = {
          id: '',
          workId: workInfo.value.workId || '',
          content: '',
          createdTime: '',
          updatedTime: '',
          nodes: [],
          edges: [],
        }
      }
      const latestWorkVersion = req.latestWorkVersion
      if (latestWorkVersion?.content) {
        serverData.value = JSON.parse(latestWorkVersion.content)
      }

      return sessions
    } catch (e) {
      console.error(e)
      return [] // 发生错误时返回空数组
    }
  }

  const updateWorkInfo = async () => {
    if (!workInfo.value.workId) return
    try {
      const response: any = await getWorksByIdReq(workInfo.value.workId)
      const updatedWorkInfo = JSON.parse(JSON.stringify(workInfo.value))

      if (response?.id) {
        updatedWorkInfo.workId = response.id
      }
      if (response?.title) {
        updatedWorkInfo.title = response.title
      }
      if (response?.createdTime) {
        updatedWorkInfo.createdTime = response.createdTime
      }
      if (response?.updatedTime) {
        updatedWorkInfo.updatedTime = response.updatedTime
      }
      if (response?.stage) {
        updatedWorkInfo.stage = response.stage
      }
      if (response?.introduction) {
        updatedWorkInfo.introduction = response.introduction
      }
      if (response?.description) {
        updatedWorkInfo.description = response.description
      }
      if (response?.workTags && Array.isArray(response.workTags)) {
        const workTags: Tag[] = []
        for (let i = 0; i < response.workTags.length; i++) {
          const tags = response.workTags[i]?.tags
          if (tags && Array.isArray(tags)) {
            for (let j = 0; j < tags.length; j++) {
              workTags.push({
                id: tags[j].id,
                name: tags[j].name,
                userId: tags[j].userId,
              })
            }
          }
          updatedWorkInfo.workTags = workTags
        }
      }
      workInfo.value = updatedWorkInfo
    } catch (e) {
      console.error(e)
    }
  }

  // 实际的保存函数
  const _saveEditorData = async (
    saveStatus: EditorSaveStatus = '0',
    needLocalCache: boolean = true
  ) => {
    try {
      const saveData: FileTreeNode = {
        id: 'root',
        key: 'root',
        label: 'root',
        content: '',
        isDirectory: true,
        path: [],
        children: sidebarTreeData.value,
      }
      const parseServerData = fileTreeData2ServerData(saveData)
      const stringifyServerData = JSON.stringify(parseServerData)
      const req = await updateWorkVersionReq(workId.value, stringifyServerData, saveStatus)
      let newFiles = parseServerData
      if (needLocalCache) {
        // 本地缓存一下作品信息和文件系统数据（基于作品ID）
        const localFiles = getWorkInfoFromLocalStorage(workInfo.value.workId)
        if (localFiles) {
          newFiles = { ...localFiles, ...parseServerData }
        }
      }
      saveWorkInfoToLocalStorage(newFiles, workInfo.value.workId)
      workInfo.value = {
        ...workInfo.value,
        updatedTime: new Date().toISOString(),
      }
      // 保存的埋点
      trackingWorkInfoSave({
        work_id: workId.value,
        save_status: saveStatus,
      })
      if (!req) {
        if (saveStatus == '0') {
          ElMessage.success({
            message: '保存成功',
            type: 'success',
          })
        }
      } else {
        ElMessage.warning({
          message: req,
          type: 'warning',
        })
      }
      await updateWorkTitle()
      await updateWorkIntro()
    } catch (e) {
      console.error(e)
      ElMessage.error('保存失败')
    }
  }

  // 存储最后一次调用的 Promise resolve/reject 和参数
  let pendingResolve: ((value: void) => void) | null = null
  let pendingReject: ((reason?: any) => void) | null = null
  let pendingSaveStatus: EditorSaveStatus = '0'
  let pendingNeedLocalCache: boolean = true

  // 使用 lodash debounce 创建防抖的保存函数
  // 300ms 延迟，使用最后一次调用的参数
  const debouncedSave = debounce(
    async () => {
      try {
        // 使用最后一次调用的参数
        await _saveEditorData(pendingSaveStatus, pendingNeedLocalCache)
        // 如果有等待的 Promise，resolve 它
        if (pendingResolve) {
          pendingResolve()
          pendingResolve = null
          pendingReject = null
        }
      } catch (error) {
        // 如果有等待的 Promise，reject 它
        if (pendingReject) {
          pendingReject(error)
          pendingResolve = null
          pendingReject = null
        }
      }
    },
    300,
    { leading: true, trailing: true }
  )

  // 包装函数，返回 Promise
  const saveEditorData = async (
    saveStatus: EditorSaveStatus = '0',
    needLocalCache: boolean = true
  ): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      // 如果有之前的 Promise，先 reject 它（因为参数可能已经改变，之前的调用被取消）
      if (pendingReject) {
        pendingReject(new Error('Save cancelled by new save request'))
      }
      // 存储新的 Promise resolve/reject 和参数
      pendingResolve = resolve
      pendingReject = reject
      pendingSaveStatus = saveStatus
      pendingNeedLocalCache = needLocalCache
      // 调用防抖函数
      debouncedSave()
    })
  }

  const workVersionList = ref<WorkVersion[]>([])

  const getWorksVersionById = async (): Promise<WorkVersion[]> => {
    try {
      if (!workInfo.value.workId) {
        return []
      }
      const req: any = await getWorksByIdReq(workInfo.value.workId)
      if (req?.workVersionIds && Array.isArray(req.workVersionIds)) {
        workVersionList.value = req.workVersionIds
        return req.workVersionIds
      }
      return []
    } catch (e) {
      console.error('获取作品版本列表失败:', e)
      return []
    }
  }

  const loadWorkVersion = async (versionId: string): Promise<ServerData | null> => {
    try {
      if (!workInfo.value.workId) {
        return null
      }
      const req: any = await getWorksByIdAndVersionReq(workInfo.value.workId, versionId)
      // API 的 get 方法已经返回了 response.data.data，所以 req 直接就是版本数据对象
      if (req?.content) {
        return JSON.parse(req.content)
      }
      return null
    } catch (e) {
      console.error('加载作品版本失败:', e)
      ElMessage.error('加载版本失败')
      return null
    }
  }

  const restoreWorkVersion = async (versionId: string): Promise<boolean> => {
    try {
      const versionData = await loadWorkVersion(versionId)
      if (versionData) {
        serverData.value = versionData
        ElMessage.success('版本恢复成功')
        return true
      }
      return false
    } catch (e) {
      console.error('恢复作品版本失败:', e)
      ElMessage.error('恢复版本失败')
      return false
    }
  }

  // 处理编辑器设置变化
  const handleEditorSettingChange = (settings: EditorSettings) => {
    // 更新编辑器设置状态（watch 会自动应用样式并保存到 localStorage）
    editorSettings.value = { ...settings }
  }

  // 应用编辑器样式 - 通过虚拟 CSS 样式表实现
  const applyEditorStyles = (settings: EditorSettings) => {
    // 无需等待 DOM，直接创建/更新样式表
    const styleId = 'tiptap-editor-custom-styles'
    let customStyle = document.getElementById(styleId) as HTMLStyleElement

    // 如果样式标签不存在，创建它
    if (!customStyle) {
      customStyle = document.createElement('style')
      customStyle.id = styleId
      document.head.appendChild(customStyle)
    }

    const remFontSize = Number((settings.fontSize / 16).toFixed(4))

    // 直接更新样式内容，DOM 渲染后会自动应用
    customStyle.textContent = `
      /* 编辑器标题区域左右边距 */
      .page-editor-panel .editor-container .editor-content .editor-content-layout {
        padding: 0 ${settings.margin}px;
      }

      .page-editor-panel .editor-container .tiptap-content .tiptap-editor-content .ProseMirror {
        --tiptap-prosemirror-font-size: ${remFontSize}rem !important;
        --tiptap-prosemirror-line-height: ${settings.lineHeight} !important;
        font-weight: ${settings.fontWeight} !important;
      }

      /* 应用样式到段落元素，但排除 Mermaid 容器 */
      .page-editor-panel .editor-container .tiptap-content .ProseMirror p:not(.mermaid-container):not(.mermaid-container *) {
        ${settings.textIndentEnabled ? 'text-indent: 2em;' : 'text-indent: 0;'}
      }
    `
  }
  applyEditorStyles(editorSettings.value)

  // 监听 editorSettings 变化，自动应用样式并持久化到本地存储
  watch(
    editorSettings,
    newSettings => {
      // 应用新的样式
      applyEditorStyles(newSettings)

      // 保存到本地存储
      try {
        localStorage.setItem('editorSettings', JSON.stringify(newSettings))
      } catch (error) {
        console.error('保存编辑器设置失败:', error)
      }
    },
    { deep: true, immediate: true } // deep: 深度监听对象内部属性变化, immediate: 立即执行一次
  )

  const initEditorStore = () => {
    currentContent.value = ''
    currentSidebarId.value = "";
    currentEditingId.value = "";
    workInfo.value = {
      workId: '',
      title: '',
      introduction: '',
      createdTime: '',
      updatedTime: '',
      description: '',
      stage: 'final',
      chapterNum: 10,
      wordNum: 1000,
      workTags: [],
    }
  }

  return {
    workId,
    workInfo,
    serverData,
    sidebarTreeData,
    editorSettings,
    workVersionList,
    currentSidebarId,
    currentEditingId,
    inspirationDraw,
    streamingTaskStatus,
    tourOpen,
    hasTourOpenedOnThisClient,
    hasTourOpened,
    currentContent,
    findNodeById,
    findNodeByFileName,
    findFirstMdNode,
    updateNodeContentById,
    renameNodeLabel,
    updateWorkInfo,
    initEditorData,
    saveEditorSettings,
    saveEditorData,
    getWorksVersionById,
    loadWorkVersion,
    restoreWorkVersion,
    createNewWork,
    handleEditorSettingChange,
    updateWorkTitle,
    updateWorkIntro,
    initEditorStore
  }
})
