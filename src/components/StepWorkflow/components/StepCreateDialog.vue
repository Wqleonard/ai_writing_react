<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import {
  ElDialog,
  ElButton,
  ElSkeleton,
  ElFormItem,
  ElForm,
  ElInput,
  type FormInstance,
} from 'element-plus'
import {
  type CharacterData,
  getCharacterSettings,
  getStoriesReq,
  getTemplatesReq,
} from '@/api/generate-dialog.ts'
import { getWorkTagsReq, updateWorkInfoReq, updateWorkVersionReq } from '@/api/works.ts'
import TemplateCardItem, { type Template } from '@/components/TemplateCardItem.vue'
import { ElMessage } from 'element-plus'
import { postTemplateStream, type PostTemplateStreamData } from '@/api/writing-templates.ts'
import type { PostStreamData } from '@/api/index.ts'
import MarkdownEditor from '@/components/MarkdownEditor.vue'
import CustomSteps from './CustomSteps.vue'
import CharacterCard from './CharacterCard.vue'
import { useEditorStore } from '@/stores/editor'
import { storeToRefs } from 'pinia'
import CUSTOM_COVER from '@/assets/images/step_create/custom-cover.png'
import TAG_COVER from '@/assets/images/step_create/tag-cover.png'
import TEMPLATE_COVER from '@/assets/images/step_create/template-cover.png'
import FormRecommendLabel from '@/components/TopToolbarDialogs/FormRecommendLabel.vue'
import type { Tag } from '@/stores/editor'
import type { TagCategoryDataItem } from '@/components/TopToolbarDialogs/TagSelector.vue'
import type { CharacterCardData } from '@/components/StepWorkflow/components/CharacterCard.vue'
import { useOptionsStore } from '@/stores/options'
import {
  trackingGuidedWritingComplete,
  trackingGuidedWritingStart,
} from '@/utils/matomoTrackingEvent/clickEvent.ts'
import { trackingGuidedWritingClick } from '@/utils/matomoTrackingEvent/clickEvent.ts'
import { trackingOfficialContentUse } from '@/utils/matomoTrackingEvent/officialEvent.ts'
import showStepConfirmDialog from '@/components/StepWorkflow/components/showStepConfirmDialog.ts'
import type { Mode } from '../types.ts'
import type { StepSaveData } from '@/components/StepWorkflow/types.ts'
import { fileTreeData2ServerData, type FileTreeNode } from '@/utils/aiTreeNodeConverter.ts'
import FEMALE from '@/assets/images/character_card/female.png'
import MALE from '@/assets/images/character_card/male.png'

export interface StoryStorm {
  title: string
  intro: string
  theme: string
}

const emit = defineEmits<{
  confirm: [data: StepSaveData]
}>()

interface ModeArrItem {
  title: string
  mode: Mode
  desc: string
  cover: string
}

const STEPS = ['选择创作方式', '确定内容', '选择故事', '选择主角', '创作大纲']

const STEPS_CUSTOM = ['选择创作方式', '自定义设定', '选择故事', '选择主角', '创作大纲']

const STEPS_TEMPLATE = ['选择创作方式', '选择模板', '选择故事', '选择主角', '创作大纲']

const STEPS_TAG = ['选择创作方式', '选择标签', '选择故事', '选择主角', '创作大纲']

/** 基准 16px，用于 rem 适配与大屏适配 */
const ROOT_FONT_PX = 16
const pxToRem = (px: number) => `${(px / ROOT_FONT_PX).toFixed(4)}rem`

const steps = ref<string[]>(STEPS)

const stepActive = ref(0)

const dialogShow = defineModel<boolean>({ default: false })
const loading = ref(false)

// ========== 步骤数据管理系统 ==========
// 步骤状态管理
interface StepState {
  index: number
  snapshot: any // 数据快照
  updated: boolean
}

const INIT_STEP_STATES = [
  {
    index: 0,
    snapshot: null,
    updated: true,
  },
  {
    index: 1,
    snapshot: null,
    updated: false,
  },
  {
    index: 2,
    snapshot: null,
    updated: false,
  },
  {
    index: 3,
    snapshot: null,
    updated: false,
  },
  {
    index: 4,
    snapshot: null,
    updated: false,
  },
]

// 深拷贝函数
const deepClone = <T,>(obj: T): T => {
  return JSON.parse(JSON.stringify(obj))
}

// 初始化步骤状态数组（使用深拷贝，避免修改 INIT_STEP_STATES）
const currentStepStates = ref<StepState[]>(deepClone(INIT_STEP_STATES))

// 初始化历史步骤状态数组（使用深拷贝，避免修改 INIT_STEP_STATES）
const historyStepStates = ref<StepState[]>(deepClone(INIT_STEP_STATES))

// 更新步骤状态
const updateCurrentStepState = (index: number, snapshot: any) => {
  if (index < 0 || index > 4) return

  // 更新指定步骤的 snapshot
  currentStepStates.value[index].snapshot = snapshot

  // 将后续步骤的 snapshot 置为 null
  for (let i = index + 1; i <= 4; i++) {
    currentStepStates.value[i].snapshot = null
    currentStepStates.value[i].updated = false
  }
}

// 检查步骤是否可以访问（所有依赖步骤都已完成）
const isStepAccessible = (stepIndex: number): boolean => {
  if (stepIndex == 0) {
    return true
  }
  return !!currentStepStates.value[stepIndex - 1].snapshot
}

// 第0步 模式选择
const modes = ref<ModeArrItem[]>([
  {
    mode: 'custom',
    title: '自定义短篇创作',
    desc: '详细制定你的内容方向，并进行导语→故事→角色→章节的完整创作链',
    cover: CUSTOM_COVER,
  },
  {
    mode: 'template',
    title: '使用模板创作',
    desc: '选择热门模板创作，套用核心梗，助力创作爆款小说',
    cover: TEMPLATE_COVER,
  },
  {
    mode: 'tag',
    title: '使用标签创作',
    desc: '选择标签自由获取灵感脑洞，让创作的思维肆意挥洒',
    cover: TAG_COVER,
  },
])
const selectedMode = ref<Mode | null>(null)

// 根据选择的模式动态更新步骤名称
watch(selectedMode, mode => {
  if (mode === 'template') {
    steps.value = STEPS_TEMPLATE
  } else if (mode === 'tag') {
    steps.value = STEPS_TAG
  } else if (mode == 'custom') {
    steps.value = STEPS_CUSTOM
  } else {
    steps.value = STEPS
  }
})

const handleModeClick = (mode: Mode) => {
  selectedMode.value = mode
  // 更新步骤0的状态
  updateCurrentStepState(0, mode)
}

// ========第1步 选择标签或模板或自定义==========
// 自定义
const formRef = ref<FormInstance>()

const FormMap = new Map([
  ['prompt', '提示词'],
  ['coreMeme', '核心梗'],
  ['background', '故事背景'],
  ['persona', '主角人设'],
  ['wordCount', '字数'],
  ['perspective', '人称'],
])

const formModel = ref<Record<string, any>>({
  prompt: '官方提供-专业短篇小说写作30年',
  coreMeme: '',
  background: '',
  persona: '',
  wordCount: '',
  perspective: '',
})

const optionsStore = useOptionsStore()
const { recommendConfig } = storeToRefs(optionsStore)

const handleSelectRecommend = (key: string, recommend: string) => {
  if (key in formModel.value) {
    formModel.value[key] = recommend
  }
}

watch(
  () => formModel.value,
  newVal => {
    if (!!(newVal.coreMeme && newVal.background && newVal.persona)) {
      updateCurrentStepState(1, newVal)
    } else {
      updateCurrentStepState(1, null)
    }
  },
  { deep: true }
)

// 模板
const templates = ref<Template[]>([])
const selectedTemplate = defineModel<Template | null>('selectedTemplate', { default: null })

const handleTemplateClick = (template: Template) => {
  selectedTemplate.value = template
  // 更新步骤1的状态
  updateCurrentStepState(1, template)
}

// 更新模板列表
const updateTemplates = async () => {
  try {
    const res: any = await getTemplatesReq()
    if (!Array.isArray(res?.content)) return
    templates.value = res?.content?.map(
      (item: any): Template => ({
        id: String(item.id),
        title: item.title || '',
        description: item.content || '',
        usageCount: item.numberOfUses || 0,
        tags:
          item.tags?.map((tag: any) => {
            return {
              name: tag?.name || '',
              id: tag?.id || '',
              category: tag?.category || '',
            }
          }) || [],
      })
    )
  } catch (error) {}
}

// 标签
const categories = ref<TagCategoryDataItem[]>([])
const selectedTags = ref<Tag[]>([])

const onTagsChange = (tags: Tag[]) => {
  updateCurrentStepState(1, tags)
}

// 设置默认选中10章（查找标签名包含"章"的分类）
const initSelectedTags = () => {
  const chapterCategory = categories.value.find(cat => cat.category.includes('章'))
  if (chapterCategory) {
    // 查找10章标签
    const defaultChapterTag = chapterCategory.tags.find(tag => tag.name.includes('10'))
    if (defaultChapterTag) {
      // 默认将10章标签对象加入选中列表
      selectedTags.value = [defaultChapterTag]
    }
  } else {
    selectedTags.value = []
  }
}

// 更新标签列表
const updateTagCategories = async () => {
  try {
    // 重置选中状态
    selectedTags.value = []
    const response: any = await getWorkTagsReq()
    if (response) {
      categories.value = response
      if (Array.isArray(response)) {
        categories.value = response.map(
          (group: { category: string; categoryId: number; max: number; tags: Tag[] }) => ({
            category: group.category,
            categoryId: String(group.categoryId),
            max: group.max,
            tags: group.tags.map((tag: Tag) => ({
              ...tag,
              categoryId: String(group.categoryId),
              category: group.category,
              max: group.max,
            })),
          })
        )
      }
      initSelectedTags()
    }
  } catch (error) {
    console.error('获取标签数据失败:', error)
  }
}

// ========第2步 选择标签或模板或自定义==========
// 初始化3条空数据用于占位
const EMPTY_STORIES = [
  { title: '', intro: '', theme: '' },
  { title: '', intro: '', theme: '' },
  { title: '', intro: '', theme: '' },
]
const stories = ref<StoryStorm[]>(deepClone(EMPTY_STORIES))

// stories.value = [
//   {
//     title: '重生上海滩：卧底丈夫',
//     intro:
//       '## 故事简介\n\n我重生回民国初年的上海滩，发现枕边丈夫竟是敌方卧底，而我必须在他与各方势力的夹缝中求生并揭开真相。\n\n## 主要事件\n\n1. 重生归来：我在百乐门醒来，回到被丈夫枪杀前一周\n2. 卧底疑云：发现丈夫与青帮暗中交易，身份成谜\n3. 金钱被夺：丈夫将我的嫁妆转赠舞女，引发第一次冲突\n4. 虐身陷阱：舞女装病逼我抽血，丈夫冷眼旁观\n5. 假孕真相：舞女宣称怀了丈夫孩子，实则另有其父\n6. 身份暴露：丈夫竟是革命党卧底，接近我为获取情报\n7. 联手破局：我与丈夫合作，揭露青帮与军阀勾结\n8. 最终抉择：在爱与信仰间，我选择助他完成使命\n\n',
//     theme: '',
//   },
//   {
//     title: '血色日记：职场迷局',
//     intro:
//       '## 故事简介\n\n我在公司杂物间捡到一本神秘日记，发现其中记载的家族秘密竟与顶头上司的阴谋息息相关。\n\n## 主要事件\n\n1. 意外发现：在公司加班时捡到一本泛黄的日记本\n2. 秘密初现：日记中记载着与我家祖辈有关的惊人往事\n3. 职场危机：发现上司正在暗中调查我的家族背景\n4. 线索追踪：通过日记指引找到家族遗留的证物\n5. 真相揭露：上司竟是当年陷害我家族的仇人之子\n6. 绝地反击：利用日记中的秘密反制上司的阴谋\n7. 家族昭雪：揭开尘封多年的真相，为家族正名\n8. 新的开始：在职场中重新站稳脚跟，开启新生活\n\n',
//     theme: '',
//   },
//   {
//     title: '反派我，竟为主赴劫',
//     intro:
//       '## 故事简介\n\n我穿成注定惨死的反派魔尊，却在劫火中爱上注定杀我的正道主角，为他叛尽天下，也为他挡下最后一剑。\n\n## 主要事件\n\n1. 我夺舍反派：穿越第一夜，我亲手接下刺杀主角的密令，却对他一眼沦陷。\n2. 替身入局：我假扮他早死的白月光，夜夜替他疗伤，只为多听他唤一声“阿遥”。\n3. 亲人背刺：我亲哥把魔族布防图送给女主，逼我在宗门与魔域之间二选一。\n4. 夺机缘：秘境里，他把唯一升仙丹喂给装伤的女主，我血染青衣仍护他出阵。\n5. 身份曝露：他剑尖抵我心口，我笑着吻上锋刃，告诉他“我甘之如饴”。\n6. 天劫代受：飞升雷劫落下，我替他挡九重天雷，魔骨碎尽，换他一步登仙。\n7. 身死成局：我魂飞魄散前，逆转命书，把“反派惨死”改写成“主角永念”。\n8. 春回大地：百年后，他在梨花树下执我残剑，对弟子说“这是你们师娘”。\n\n',
//     theme: '',
//   },
// ]

// stepActive.value = 2

const selectedStory = ref<StoryStorm | null>(null)
// AbortController 用于取消故事请求
const storyAbortController = ref<AbortController | null>(null)

const handleSelectStory = (story: StoryStorm) => {
  if (story == selectedStory.value) return
  if (!story?.title || !story?.intro) return
  selectedStory.value = story
  // 更新步骤2的完成状态
  updateCurrentStepState(2, story)
}

const updateStories = async () => {
  historyStepStates.value[2].updated = true
  stories.value = [...EMPTY_STORIES]
  selectedStory.value = null

  // 如果已有正在进行的请求，先取消
  if (storyAbortController.value) {
    storyAbortController.value.abort()
  }

  // 创建新的 AbortController
  storyAbortController.value = new AbortController()
  const currentAbortController = storyAbortController.value

  try {
    // 根据模式构建描述信息
    let description = ''
    let tagIds: string[] = []

    if (selectedMode.value === 'tag') {
      description = selectedTags.value.map(tag => tag.name).join(',')
      tagIds = selectedTags.value.map(tag => String(tag.id))
    } else if (selectedMode.value === 'template' && selectedTemplate.value) {
      // template 模式：使用模板数据（如果需要，可以扩展模板的描述信息）
      // 目前保持使用标签，如果模板有描述信息可以替换
      description = selectedTemplate.value.description
      tagIds = selectedTags.value.map(tag => String(tag.id))
    } else if (selectedMode.value === 'custom') {
      description = generateCustomDesc(historyStepStates.value[1]?.snapshot)
      tagIds = []
    }
    const data: any = {
      templateContent: description,
      tagIds: tagIds,
    }

    loading.value = true
    const res = await getStoriesReq(data, {
      signal: currentAbortController.signal,
    })
    loading.value = false

    if (!res) {
      ElMessage.error('获取故事失败，请重试')
    }
    // 检查请求是否已被取消
    if (currentAbortController.signal.aborted) {
      return
    }

    // 处理 API 返回的数据
    const stormList = Array.isArray(res) ? res : []

    // 再次检查请求是否已被取消
    if (currentAbortController.signal.aborted) {
      return
    }

    // 用 for 循环填充数据，最多3条
    for (let i = 0; i < 3; i++) {
      const item = stormList[i]
      stories.value[i] = {
        title: item?.title || item?.name || '彩蛋',
        intro: item?.story || '这是彩蛋，没有故事设定~',
        theme: '',
      }
    }
    storyAbortController.value = null
  } catch (e: any) {
    // 如果是取消操作，不记录为错误
    // 检查是否是 AbortError (fetch API) 或 CanceledError (axios)
    loading.value = false
    if (
      (e instanceof DOMException && e.name === 'AbortError') ||
      e?.name === 'CanceledError' ||
      e?.code === 'ERR_CANCELED' ||
      e?.message?.includes('canceled')
    ) {
      console.log('故事请求已取消')
      storyAbortController.value = null
      return
    }
    console.error('获取故事失败:', e)
    // 发生错误时，重置为空数据
    stories.value = EMPTY_STORIES
    storyAbortController.value = null
  }
}

// 故事卡片编辑面板（与 QuickCharacterSelector 相同动效）
const showStoryEditPanel = ref(false)
const storyGridRef = ref<HTMLElement | null>(null)
const stpryEditPanelStyle = ref<{
  left?: string
  top?: string
  width?: string
  height?: string
  bottom?: string
  transformOrigin?: string
}>({
  left: '0rem',
  top: '0rem',
  width: '0rem',
  height: pxToRem(440),
  transformOrigin: 'top left',
})
const isStoryEditAnimating = ref(false)
const editingStory = ref<StoryStorm>({ title: '', intro: '', theme: '' })
const editingStoryIndex = ref<number | null>(null)
const MAX_INTRO_LENGTH = 1000

const handleEditStory = async (story: StoryStorm, index: number, event: MouseEvent) => {
  event.stopPropagation()
  if (!story?.title && !story?.intro) return
  editingStory.value = { ...story }
  editingStoryIndex.value = index
  const target = (event.currentTarget as HTMLElement).closest('.story-card') as HTMLElement
  if (target) {
    await animateStoryPanelFromCard(target)
  }
}

const animateStoryPanelFromCard = async (cardElement: HTMLElement) => {
  if (!storyGridRef.value) return
  const containerRect = storyGridRef.value.getBoundingClientRect()
  const cardRect = cardElement.getBoundingClientRect()
  const left = cardRect.left - containerRect.left
  const top = cardRect.top - containerRect.top + 60
  const width = cardRect.width
  stpryEditPanelStyle.value = {
    left: pxToRem(left),
    top: pxToRem(top),
    width: pxToRem(width),
    height: pxToRem(440),
    transformOrigin: 'top left',
  }
  isStoryEditAnimating.value = true
  showStoryEditPanel.value = true
  await nextTick()
  setTimeout(() => {
    const bottomOffsetRem = pxToRem(60)
    stpryEditPanelStyle.value = {
      left: '0rem',
      top: pxToRem(60),
      width: '100%',
      bottom: bottomOffsetRem,
      height: pxToRem(440),
      transformOrigin: 'top left',
    }
    setTimeout(() => {
      isStoryEditAnimating.value = false
    }, 650)
  }, 50)
}

const closeStoryEditPanel = () => {
  showStoryEditPanel.value = false
  editingStory.value = { title: '', intro: '', theme: '' }
  editingStoryIndex.value = null
  isStoryEditAnimating.value = false
}

const handleSaveStoryEdit = () => {
  if (editingStoryIndex.value !== null) {
    const title = (editingStory.value.title || '').trim()
    const intro = (editingStory.value.intro || '').trim()
    if (!title) {
      ElMessage.warning('请填写书名')
      return
    }
    const idx = editingStoryIndex.value
    const wasSelected = selectedStory.value === stories.value[idx]
    stories.value[idx] = { ...editingStory.value, title, intro }
    if (wasSelected) {
      selectedStory.value = stories.value[idx]
    }
    updateCurrentStepState(2, stories.value[idx])
  }
  closeStoryEditPanel()
}

// ========第3步 选择角色==========
const EMPTY_CHARACTER = {
  name: '',
  gender: '',
  age: '',
  bloodType: '',
  mbti: '',
  experiences: '',
  personality: '',
  abilities: '',
  identity: '',
}
const EMPTY_CHARACTERS: CharacterCardData[] = [EMPTY_CHARACTER, EMPTY_CHARACTER, EMPTY_CHARACTER]
const characters = ref<CharacterCardData[]>(deepClone(EMPTY_CHARACTERS))

// characters.value = [
//   {
//     name: '颜南舟',
//     gender: '女',
//     age: '22岁',
//     bloodType: '',
//     mbti: 'ESTP',
//     experiences: '渴望逃离原生家庭，追寻自由人生',
//     personality: '自由奔放、行动力强、活在当下',
//     abilities: '快速适应环境、社交达人、危机应变',
//     identity: '流浪画家，自由职业者',
//   },
//   {
//     name: '谢启明',
//     gender: '女',
//     age: '26岁',
//     bloodType: '',
//     mbti: 'ESFJ',
//     experiences: '为调查亲人离奇死亡真相，踏上复仇之路',
//     personality: '温暖坚韧、共情力强、重视羁绊',
//     abilities: '细致入微的观察力、强大的共情与沟通能力',
//     identity: '寻真者，守护者',
//   },
//   {
//     name: '孟砚清',
//     gender: '女',
//     age: '24岁',
//     bloodType: '',
//     mbti: 'ENTP',
//     experiences: '意外获得超能力，试图隐藏却卷入巨大阴谋',
//     personality: '思维敏捷，善于诡辩，玩世不恭却洞察人心',
//     abilities: '精神操控，能短暂影响他人意志与感知',
//     identity: '自由撰稿人，超能力者',
//   },
// ]

const selectedCharacter = ref<CharacterCardData | null>(null)

// AbortController 用于取消角色请求
const characterAbortController = ref<AbortController | null>(null)

const generateCustomDesc = (formData: Record<string, any> | null) => {
  let description = ''
  if (!formData) return description

  const keys = Object.keys(formData)
  for (const key of keys) {
    const customItem = formData[key]
    if (FormMap.has(key) && customItem != '') {
      description += FormMap.get(key) + ':' + customItem + ';'
    }
    console.log('description', description)
  }
  return description
}

// 更新角色列表
const updateCharacters = async () => {
  if (!selectedStory.value) return
  characters.value = [...EMPTY_CHARACTERS]
  selectedCharacter.value = null
  historyStepStates.value[3].updated = true

  // 如果已有正在进行的请求，先取消
  if (characterAbortController.value) {
    characterAbortController.value.abort()
  }

  // 创建新的 AbortController
  characterAbortController.value = new AbortController()
  const currentAbortController = characterAbortController.value

  try {
    loading.value = true
    // 根据模式构建描述信息
    let description = ''

    if (selectedMode.value === 'tag') {
      description = selectedTags.value.map(tag => tag.name).join(',')
    } else if (selectedMode.value === 'template' && selectedTemplate.value) {
      // template 模式：使用模板数据（如果需要，可以扩展模板的描述信息）
      description = selectedTemplate.value.description
    } else if (selectedMode.value == 'custom') {
      description = generateCustomDesc(historyStepStates.value[1]?.snapshot)
    }

    const reqParams: CharacterData = {
      description: description,
      workType: 'editor',
      brainStorm: selectedStory.value,
    }

    const req = await getCharacterSettings(reqParams)
    loading.value = false
    if (!req) {
      ElMessage.error('获取角色失败，请重试')
    }

    // 处理 API 返回的数据
    const characterList = Array.isArray(req?.roleCards) ? req.roleCards : []

    // 再次检查请求是否已被取消
    if (currentAbortController.signal.aborted) {
      return
    }

    // 用 for 循环填充数据，最多3条
    for (let i = 0; i < 3; i++) {
      if (i < characterList.length) {
        const item = characterList[i]
        characters.value[i] = {
          name: item.name || '',
          gender: item.gender || '',
          age: item.age || '',
          bloodType: item.bloodType || '',
          mbti: item.mbti || '',
          experiences: item.experiences || '',
          personality: item.personality || '',
          abilities: item.abilities || '',
          identity: item.identity || '',
        }
      }
      // 如果 i >= characterList.length，characters.value[i] 已经是空数据（来自 EMPTY_CHARACTERS），无需处理
    }
    characterAbortController.value = null
  } catch (e: any) {
    loading.value = false
    // 如果是取消操作，不记录为错误
    // 检查是否是 AbortError (fetch API) 或 CanceledError (axios)
    if (
      (e instanceof DOMException && e.name === 'AbortError') ||
      e?.name === 'CanceledError' ||
      e?.code === 'ERR_CANCELED' ||
      e?.message?.includes('canceled')
    ) {
      console.log('角色请求已取消')
      characterAbortController.value = null
      return
    }
    console.error('获取角色失败:', e)
    // 发生错误时，重置为空数据
    characters.value = EMPTY_CHARACTERS
    characterAbortController.value = null
  }
}

// 角色卡片编辑面板（与故事编辑面板相同动效）
const showCharacterEditPanel = ref(false)
const characterGridRef = ref<HTMLElement | null>(null)
const characterEditPanelStyle = ref<{
  left?: string
  top?: string
  width?: string
  height?: string
  bottom?: string
  transformOrigin?: string
}>({
  left: '0rem',
  top: '0rem',
  width: '0rem',
  height: pxToRem(480),
  transformOrigin: 'top left',
})
const isCharacterEditAnimating = ref(false)
const editingCharacter = ref<CharacterCardData>({ ...EMPTY_CHARACTER })
const editingCharacterIndex = ref<number | null>(null)

const handleCharacterEdit = async (
  character: CharacterCardData,
  index: number,
  event?: MouseEvent
) => {
  if (!character?.name) return
  editingCharacter.value = { ...character }
  editingCharacterIndex.value = index
  const target = event?.currentTarget
    ? (event.currentTarget as HTMLElement).closest('.character-card')
    : null
  const cardEl = target as HTMLElement | null
  if (cardEl) {
    await animateCharacterPanelFromCard(cardEl)
  } else {
    showCharacterEditPanel.value = true
    isCharacterEditAnimating.value = false
  }
}

const animateCharacterPanelFromCard = async (cardElement: HTMLElement) => {
  if (!characterGridRef.value) return
  const containerRect = characterGridRef.value.getBoundingClientRect()
  const cardRect = cardElement.getBoundingClientRect()
  const left = cardRect.left - containerRect.left
  const top = cardRect.top - containerRect.top + 60
  const width = cardRect.width
  characterEditPanelStyle.value = {
    left: pxToRem(left),
    top: pxToRem(top),
    width: pxToRem(width),
    height: pxToRem(480),
    transformOrigin: 'top left',
  }
  isCharacterEditAnimating.value = true
  showCharacterEditPanel.value = true
  await nextTick()
  setTimeout(() => {
    const bottomOffsetRem = pxToRem(60)
    characterEditPanelStyle.value = {
      left: '0rem',
      top: pxToRem(60),
      width: '100%',
      bottom: bottomOffsetRem,
      height: pxToRem(480),
      transformOrigin: 'top left',
    }
    setTimeout(() => {
      isCharacterEditAnimating.value = false
    }, 650)
  }, 50)
}

const closeCharacterEditPanel = () => {
  showCharacterEditPanel.value = false
  editingCharacter.value = { ...EMPTY_CHARACTER }
  editingCharacterIndex.value = null
  isCharacterEditAnimating.value = false
}

const handleSaveCharacterEdit = () => {
  if (editingCharacterIndex.value !== null) {
    const name = (editingCharacter.value.name || '').trim()
    if (!name) {
      ElMessage.warning('请填写角色名称')
      return
    }
    const idx = editingCharacterIndex.value
    const wasSelected = selectedCharacter.value === characters.value[idx]
    characters.value[idx] = { ...editingCharacter.value, name: name }
    if (wasSelected) {
      selectedCharacter.value = characters.value[idx]
    }
    updateCurrentStepState(3, characters.value[idx])
  }
  closeCharacterEditPanel()
}

const handleCharacterClick = (character: CharacterCardData) => {
  if (!character.name) return
  selectedCharacter.value = character
  // 更新步骤3的完成状态
  updateCurrentStepState(3, character)
}

// ===== 步骤4 创作大纲 =====
const outlineContent = ref('')
const isOutlineEditing = ref(false)
const isOutlineStreaming = ref(false)

const editorStore = useEditorStore()
const { sidebarTreeData, currentEditingId, workId, workInfo, currentContent } =
  storeToRefs(editorStore)

// MarkdownEditor 的 ref
const markdownEditorRef = ref<InstanceType<typeof MarkdownEditor> | null>(null)

// 从流式数据中提取内容
const getContentFromPartial = (partialData: any): string => {
  if (!partialData || !Array.isArray(partialData) || partialData.length === 0) {
    return ''
  }
  const firstItem = partialData[0]
  return firstItem?.content[0]?.text || ''
}

// AbortController 用于取消流式请求
const outlineStreamAbortController = ref<AbortController | null>(null)

// 流式数据处理回调
const onOutlineStreamData = (data: PostStreamData) => {
  switch (data.event) {
    case 'messages/partial': {
      const content = getContentFromPartial(data.data)
      outlineContent.value = content
      break
    }
    case 'updates': {
      if (outlineContent.value == '') {
        outlineContent.value = '生成失败，请重试'
      }
      break
    }
    case 'end': {
      break
    }
  }
}

// 流式结束回调
const onOutlineStreamEnd = () => {
  isOutlineStreaming.value = false
  loading.value = false
  outlineStreamAbortController.value = null
}

// 流式错误回调
const onOutlineStreamError = (error: Error) => {
  console.error('获取大纲失败:', error)
  loading.value = false
  outlineStreamAbortController.value = null
  ElMessage.error('生成大纲失败，请重试')
}

// 更新大纲（流式）
const updateOutlineStream = async () => {
  // 检查必要的数据
  if (!selectedStory.value || !selectedCharacter.value) {
    ElMessage.warning('请先完成前面的步骤')
    return
  }
  isOutlineStreaming.value = true
  historyStepStates.value[4].updated = true

  // 如果已有正在进行的请求，先取消
  if (outlineStreamAbortController.value) {
    outlineStreamAbortController.value.abort()
  }

  // 重置内容
  outlineContent.value = ''
  loading.value = true

  // 构建请求参数
  const requestData: PostTemplateStreamData = {
    workId: workId.value,
    targetStage: 'outline',
    theme: selectedStory.value.theme,
    brainStorm: {
      title: selectedStory.value.title,
      intro: selectedStory.value.intro,
    },
    roleCard: selectedCharacter.value,
    chapterNumber: parseChapterNumber(getSelectedChapterNumber()),
  }

  // 根据模式设置 description
  if (selectedMode.value === 'template' && selectedTemplate.value) {
    requestData.description = selectedTemplate.value.description
  } else if (selectedMode.value === 'tag') {
    requestData.description = selectedTags.value.map(tag => tag.name).join(',')
  } else if (selectedMode.value == 'custom') {
    requestData.description = generateCustomDesc(historyStepStates.value[1]?.snapshot)
  }

  // 创建新的 AbortController
  outlineStreamAbortController.value = new AbortController()

  try {
    await postTemplateStream(
      requestData,
      onOutlineStreamData,
      onOutlineStreamError,
      onOutlineStreamEnd,
      { signal: outlineStreamAbortController.value.signal }
    )
  } catch (error) {
    // 如果是取消操作，不记录为错误
    if (error instanceof DOMException && error.name === 'AbortError') {
      console.log('流式请求已取消')
      loading.value = false
      outlineStreamAbortController.value = null
      return
    }
    console.error('调用模板流式接口失败:', error)
    loading.value = false
    outlineStreamAbortController.value = null
    ElMessage.error('生成大纲失败，请重试')
  }
}

const handleOutlineEdit = () => {
  // 切换编辑状态
  isOutlineEditing.value = !isOutlineEditing.value

  // 如果进入编辑模式，设置光标位置为0
  if (isOutlineEditing.value) {
    nextTick(() => {
      // 设置光标位置为0
      if (markdownEditorRef.value?.editor) {
        const editor = markdownEditorRef.value.editor
        if (editor?.chain) {
          editor.chain().setTextSelection(0).focus().run()
        }
      }
    })
  }
}

const handleBack = () => {
  console.log('handleBack', stepActive.value)
  if (stepActive.value == 0) {
    return
  }
  stepActive.value = stepActive.value - 1
}

const generateRoleSetting = (character: CharacterCardData | null) => {
  if (!character) {
    return ''
  }
  let md = '## 主角信息\n'

  const firstLineArr = []

  if (character.name) {
    firstLineArr.push(character.name)
  }
  if (character.age) {
    firstLineArr.push(character.age)
  }
  if (character.gender) {
    firstLineArr.push(character.gender)
  }
  if (character.mbti) {
    firstLineArr.push(character.mbti)
  }
  md += firstLineArr.join('，') + '。\n\n'
  if (character.experiences) {
    md += character.experiences + '\n\n'
  }
  if (character.personality) {
    md += character.personality + '\n\n'
  }
  if (character.abilities) {
    md += character.abilities + '\n\n'
  }
  if (character.identity) {
    md += character.identity + '\n\n'
  }
  return md
}

const handleClose = async () => {
  if (selectedStory.value || selectedCharacter.value) {
    try {
      const confirmDialog = await showStepConfirmDialog()
      if (confirmDialog == 'cancel') {
        dialogShow.value = false
        return
      }
      const newSidebarTreeData: FileTreeNode[] = [
        {
          id: '大纲.md',
          key: '大纲.md',
          label: '大纲',
          content: outlineContent.value || '',
          isDirectory: false,
          path: ['大纲.md'],
          fileType: 'md',
          children: [],
          new: true,
        },
        {
          id: '知识库',
          key: '知识库',
          label: '知识库',
          content: '',
          isDirectory: true,
          path: ['知识库'],
          fileType: 'directory',
          children: [],
        },
        {
          id: '设定',
          key: '设定',
          label: '设定',
          content: '',
          isDirectory: true,
          path: ['设定'],
          fileType: 'directory',
          children: [
            {
              id: '故事设定/角色设定.md',
              key: '故事设定-角色设定.md',
              label: '角色设定',
              content: selectedCharacter.value ? generateRoleSetting(selectedCharacter.value) : '',
              isDirectory: false,
              path: ['设定', '角色设定.md'],
              fileType: 'md',
              children: [],
              new: true,
            },
            {
              id: '故事设定/故事设定.md',
              key: '故事设定-故事设定.md',
              label: '故事设定',
              content: selectedStory.value ? selectedStory.value?.intro : '',
              isDirectory: false,
              path: ['设定', '角色设定.md'],
              fileType: 'md',
              children: [],
              new: true,
            },
          ],
        },
        {
          id: '正文',
          key: '正文',
          label: '正文',
          isDirectory: true,
          content: '',
          path: ['正文'],
          children: [
            {
              id: '正文/第一章.md',
              key: '正文-第一章.md',
              label: '第一章',
              content: '',
              isDirectory: false,
              path: ['正文', '第一章.md'],
              fileType: 'md',
              children: [],
            },
          ],
        },
      ]
      // 保存到当前
      if (confirmDialog == 'saveToCurrent') {
        sidebarTreeData.value = [...newSidebarTreeData]

        const editCheckKeys = ['大纲.md', '设定/故事设定.md', '设定/角色设定.md']
        for (const key of editCheckKeys) {
          const node = editorStore.findNodeById(key)
          if (node && node.content) {
            currentEditingId.value = key
            currentContent.value = node.content
            break
          }
        }
        const titleLine = selectedStory.value?.title || '未命名作品'
        workInfo.value.title = titleLine
        await updateWorkInfoReq(workId.value, {
          title: titleLine,
          stage: 'final',
        })
        await editorStore.saveEditorData('1')
        ElMessage.success('保存成功')
        dialogShow.value = false
      } else {
        // 保存到新作品
        const newWorkId = (await editorStore.createNewWork()) || ''
        if (!newWorkId) {
          ElMessage.error('保存失败')
          return
        }
        const titleLine = selectedStory.value?.title || '未命名作品'
        workInfo.value.title = titleLine
        await updateWorkInfoReq(newWorkId, {
          title: titleLine,
          stage: 'final',
        })

        const saveData: FileTreeNode = {
          id: 'root',
          key: 'root',
          label: 'root',
          content: '',
          isDirectory: true,
          path: [],
          children: newSidebarTreeData,
        }
        const parseServerData = fileTreeData2ServerData(saveData)
        const updateVersion = await updateWorkVersionReq(
          newWorkId,
          JSON.stringify(parseServerData),
          '0'
        )
        ElMessage.success('保存成功')
        dialogShow.value = false
      }
    } catch (e) {
      console.log('用户关闭')
    }
  } else {
    dialogShow.value = false
  }
}

const initDialog = () => {
  stepActive.value = 0
  selectedMode.value = null
  steps.value = STEPS

  selectedTemplate.value = null
  selectedTags.value = []
  formRef.value?.resetFields()

  characters.value = deepClone(EMPTY_CHARACTERS)
  selectedCharacter.value = null

  stories.value = deepClone(EMPTY_STORIES)
  selectedStory.value = null

  loading.value = false
  outlineContent.value = ''
  isOutlineEditing.value = false

  // 取消正在进行的流式请求
  if (outlineStreamAbortController.value) {
    outlineStreamAbortController.value.abort()
    outlineStreamAbortController.value = null
  }

  // 取消正在进行的角色请求
  if (characterAbortController.value) {
    characterAbortController.value.abort()
    characterAbortController.value = null
  }

  // 取消正在进行的故事请求
  if (storyAbortController.value) {
    storyAbortController.value.abort()
    storyAbortController.value = null
  }

  // 使用深拷贝恢复初始值，避免修改 INIT_STEP_STATES
  historyStepStates.value = deepClone(INIT_STEP_STATES)
  currentStepStates.value = deepClone(INIT_STEP_STATES)
}

// 当对话框关闭时，重置视图
watch(dialogShow, val => {
  if (val) {
    trackingGuidedWritingStart('Mode')
    initSelectedTags()
  } else {
    initDialog()
  }
})

// 暴露方法：设置视图
const setActiveStep = (step: number) => {
  if (step < 0 || step >= steps.value.length) return
  stepActive.value = step
}

// 步骤点击处理（使用步骤数据管理系统）
const onStepClick = (step: number) => {
  // 如果点击的是当前步骤，不做任何操作
  if (step === stepActive.value) {
    return
  }

  // 如果用户想向前跳（跳到未完成的步骤），需要验证前置条件
  if (step > stepActive.value) {
    // 检查是否可以访问该步骤（所有依赖步骤都已完成）
    if (!isStepAccessible(step)) {
      return
    }
  }
  const historyCurrentStep = historyStepStates.value[stepActive.value].snapshot
  const currentSnapshot = currentStepStates.value[stepActive.value].snapshot

  if (currentSnapshot !== historyCurrentStep) {
    historyStepStates.value = currentStepStates.value
  }
  // 允许向后跳（返回之前的步骤）或满足条件的前进
  stepActive.value = step
}
// 计算每个步骤的可访问性（用于进度条禁用状态）
const stepAccessibleList = computed<boolean[]>(() => {
  return steps.value.map((_, index) => {
    // 当前步骤和已完成的步骤总是可访问
    if (index <= stepActive.value) return true
    // 后续步骤需要检查依赖
    return isStepAccessible(index)
  })
})

// 检查当前步骤是否可以进入下一步
const nextStepAble = computed<boolean>(() => {
  const currentStep = stepActive.value

  if (currentStep === 0) {
    // 步骤0：必须选择模式
    return !!selectedMode.value
  } else if (currentStep === 1) {
    // 步骤1：根据模式判断
    if (selectedMode.value === 'template') {
      return !!selectedTemplate.value
    } else if (selectedMode.value === 'tag') {
      return selectedTags.value.length > 0
    } else if (selectedMode.value == 'custom') {
      return !!(formModel.value.coreMeme && formModel.value.background && formModel.value.persona)
    }
    return false
  } else if (currentStep === 2) {
    // 步骤2：必须选择故事
    return !!selectedStory.value
  } else if (currentStep === 3) {
    // 步骤3：必须选择角色
    return !!selectedCharacter.value
  } else if (currentStep === 4) {
    // 步骤4：流式输出中不允许点击下一步
    // 检查是否有正在进行的流式请求（通过 loading 或 AbortController 判断）
    if (loading.value || outlineStreamAbortController.value !== null) {
      return false
    }
    // 其他情况可以进入下一步（确认并提交）
    return true
  }

  // 其他步骤默认可以进入下一步
  return true
})

const getSelectedChapterNumber = (): string => {
  // 查找章节数量分类
  const chapterCategory = categories.value.find(cat => cat.category.includes('章'))

  if (!chapterCategory) return '10章' // 默认值

  const selectedTagIds = selectedTags.value.map(tag => tag.id)
  // 查找选中的章节标签
  const selectedChapterTag = chapterCategory.tags.find(tag => selectedTagIds.includes(tag.id))

  return selectedChapterTag ? selectedChapterTag.name : '10章' // 默认值
}

// 从章节字符串中提取数字（如 "10章" -> 10）
const parseChapterNumber = (chapterStr: string): number => {
  const match = chapterStr.match(/\d+/)
  return match ? parseInt(match[0], 10) : 10
}

// 下一步确认（使用步骤数据管理系统）
const nextStepConfirm = () => {
  const currentStep = stepActive.value
  const historyCurrentStep = historyStepStates.value[currentStep].snapshot
  const currentSnapshot = currentStepStates.value[currentStep].snapshot

  if (currentSnapshot !== historyCurrentStep) {
    historyStepStates.value = currentStepStates.value
  }

  if (currentStep === 0) {
    stepActive.value++
    if (selectedMode.value === 'template') {
      trackingGuidedWritingClick('Template Write from Tool')
    } else if (selectedMode.value === 'tag') {
      trackingGuidedWritingClick('Tag Write from Tool')
    } else if (selectedMode.value === 'custom') {
      trackingGuidedWritingClick('Custom Write from Tool')
    }
  }
  if (currentStep === 1) {
    stepActive.value++
    let type: 'Custom Write' | 'Template Write' | 'Tag Write' = 'Custom Write'
    if (selectedMode.value == 'template') {
      type = 'Template Write'
    } else if (selectedMode.value == 'tag') {
      type = 'Tag Write'
    } else {
      type = 'Custom Write'
    }
  }
  if (currentStep === 2) {
    stepActive.value++
  }
  if (currentStep === 3) {
    stepActive.value++
  }
  if (currentStep === 4) {
    let desc = ''
    if (selectedMode.value === 'custom' && historyStepStates.value[1]?.snapshot) {
      desc = generateCustomDesc(historyStepStates.value[1]?.snapshot)
    } else if (selectedMode.value === 'template') {
      desc = selectedTemplate.value?.description || ''
    } else if (selectedMode.value === 'tag') {
      desc = selectedTags.value.map(tag => tag.name).join(',') || ''
    }
    trackingGuidedWritingComplete()
    emit('confirm', {
      mode: selectedMode.value,
      template: selectedTemplate.value,
      tags: selectedTags.value,
      character: selectedCharacter.value,
      story: selectedStory.value,
      outline: outlineContent.value,
      description: desc,
    })
  }
}

watch(stepActive, async (newVal, oldValue) => {
  const historySnapshot = historyStepStates.value[newVal].snapshot
  const historyUpdated = historyStepStates.value[newVal].updated

  if (newVal == 0) {
    trackingGuidedWritingStart('Mode')
  }

  if (newVal == 1) {
    trackingGuidedWritingStart('Content')
    return
  }
  if (newVal == 2) {
    trackingGuidedWritingStart('Story')
    if (selectedMode.value === 'template' && selectedTemplate.value) {
      trackingOfficialContentUse('Template', selectedTemplate.value.title)
    } else if (selectedMode.value === 'tag' && selectedTags.value.length > 0) {
      // 按 categoryId 分类为新数组
      selectedTags.value.map(tag => {
        const category = categories.value.find(cat => cat.categoryId === tag.categoryId)
        if (category) {
          trackingOfficialContentUse('Tag', category.category + ':' + tag.name)
        }
      })
    }

    // 步骤2：选择故事
    if (!historySnapshot && !historyUpdated) {
      await updateStories()
    }
  }
  if (newVal == 3) {
    trackingGuidedWritingStart('Protagonist')
    // 步骤3：选择主角
    if (!historySnapshot && !historyUpdated) {
      await updateCharacters()
    }
  }
  if (newVal == 4) {
    isOutlineEditing.value = false
    if (!historySnapshot && !historyUpdated) {
      await updateOutlineStream()
    }
  }
})

onMounted(() => {
  updateTemplates()
  updateTagCategories()
})

defineExpose({
  setActiveStep,
  handleModeClick,
  handleTemplateClick,
  nextStepConfirm,
})
</script>

<template>
  <el-dialog
    v-model="dialogShow"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    :show-close="false"
    class="step-create-dialog"
  >
    <!-- Header -->
    <template #header>
      <el-button v-if="stepActive != 0" link class="back-button" @click="handleBack">
        <span class="iconfont back-icon">&#xe62a;</span>
      </el-button>
      <el-button link class="close-button" @click="handleClose">
        <span class="iconfont close-icon">&#xe633;</span>
      </el-button>

      <!-- 模板创作进度条  -->
      <div class="flex w-full justify-center pt-4">
        <CustomSteps
          v-model="stepActive"
          :steps="steps"
          :step-accessible="stepAccessibleList"
          :max-width="550"
          @on-step-click="onStepClick"
        />
      </div>
    </template>

    <div class="dialog-body-wrapper">
      <div v-if="stepActive == 0" class="step-content step-mode">
        <div
          v-for="mode in modes"
          :key="mode.mode"
          :class="{
            'mode-item': true,
            selected: mode.mode === selectedMode,
          }"
          @click="handleModeClick(mode.mode)"
        >
          <div class="mode-cover">
            <img :src="mode.cover" alt="" />
          </div>
          <div class="mode-title">{{ mode.title }}</div>
          <div class="mode-desc">{{ mode.desc }}</div>
        </div>
      </div>

      <template v-if="stepActive == 1">
        <!-- 自定义 -->
        <div v-if="selectedMode == 'custom'" class="step-content step-custom">
          <el-form
            ref="formRef"
            class="step-create-dialog-form"
            :model="formModel"
            label-width="80px"
            label-position="top"
            @submit.prevent=""
          >
            <el-form-item label="提示词">
              <el-input v-model="formModel.prompt" disabled />
            </el-form-item>

            <el-form-item label="核心梗">
              <template #label>
                <FormRecommendLabel
                  label="核心梗"
                  required
                  :recommends="recommendConfig?.coreMeme || []"
                  field-key="coreMeme"
                  @select="handleSelectRecommend"
                />
              </template>
              <el-input
                v-model="formModel.coreMeme"
                type="textarea"
                :rows="1"
                maxlength="200"
                placeholder="请填写核心冲突，如“为救家族签下替身协议后，发现金主竟是幼时白月光本尊”"
                show-word-limit
                resize="none"
              />
            </el-form-item>

            <el-form-item label="故事背景">
              <template #label>
                <FormRecommendLabel
                  label="故事背景"
                  required
                  :recommends="recommendConfig?.background || []"
                  field-key="background"
                  @select="handleSelectRecommend"
                />
              </template>
              <el-input
                v-model="formModel.background"
                type="textarea"
                :rows="1"
                maxlength="200"
                placeholder="请填写时代背景、故事场景、主要矛盾设定、金手指设定、故事发展阶段等信息"
                show-word-limit
                resize="none"
              />
            </el-form-item>

            <el-form-item label="主角人设">
              <template #label>
                <FormRecommendLabel
                  label="主角人设"
                  required
                  :recommends="recommendConfig?.persona || []"
                  field-key="persona"
                  @select="handleSelectRecommend"
                />
              </template>

              <el-input
                v-model="formModel.persona"
                maxlength="200"
                placeholder="请填写男女主角年龄、性别、性格、目标和规划等信息"
                show-word-limit
              />
            </el-form-item>

            <el-form-item label="字数">
              <template #label>
                <FormRecommendLabel
                  label="字数"
                  :recommends="recommendConfig?.wordCount || []"
                  field-key="wordCount"
                  @select="handleSelectRecommend"
                />
              </template>
              <el-input
                v-model="formModel.wordCount"
                maxlength="10"
                placeholder="选填，默认10000字左右短篇"
                show-word-limit
                resize="none"
              />
            </el-form-item>

            <el-form-item label="人称">
              <template #label>
                <FormRecommendLabel
                  label="人称"
                  :recommends="recommendConfig.perspective || []"
                  field-key="perspective"
                  @select="handleSelectRecommend"
                />
              </template>
              <el-input
                v-model="formModel.perspective"
                maxlength="10"
                placeholder="选填，默认第一人称"
                show-word-limit
                resize="none"
              />
            </el-form-item>
          </el-form>
        </div>

        <!-- 标签 -->
        <div v-if="selectedMode == 'tag'" class="step-content tag-select-layout">
          <TagSelector
            v-model:selectedTags="selectedTags"
            v-model:categories="categories"
            @on-selected-tags-change="onTagsChange"
          />
        </div>

        <!-- 模板 -->
        <div v-if="selectedMode == 'template'" class="step-content step-template">
          <div class="template-header">
            <!-- <el-select
              style="width: 130px"
            /> -->
          </div>
          <div class="template-group">
            <TemplateCardItem
              v-for="template in templates"
              :key="template.id"
              :data="template"
              class="template-card grid-item"
              :class="{ ['selected']: template.id === selectedTemplate?.id }"
              @click="handleTemplateClick(template)"
            />
          </div>
        </div>
      </template>

      <div v-else-if="stepActive == 2" class="story-step step-content">
        <div class="card-edit-container">
          <div class="story-edit-container" ref="storyGridRef">
            <div class="story-grid" :class="{ 'edit-mode': showStoryEditPanel }">
              <div
                v-for="(story, index) in stories"
                :key="index"
                class="story-card"
                :class="{ selected: selectedStory == story }"
                @click="handleSelectStory(story)"
              >
                <el-skeleton v-if="!story.title || !story.intro" :animated="loading" class="mt-2">
                  <el-skeleton-item variant="h3" style="width: 60%; margin-bottom: 12px" />
                  <el-skeleton-item />
                  <el-skeleton-item />
                  <el-skeleton-item />
                </el-skeleton>
                <div v-else class="story-card-content group relative">
                  <div class="book-title">书名: 《{{ story.title }}》</div>
                  <el-scrollbar max-height="220" class="book-synopsis mt-2">
                    <MarkdownRenderer class="story-markdown-render" :content="story.intro" />
                  </el-scrollbar>
                  <el-button
                    class="absolute -top-1 -right-3 opacity-0 transition-opacity group-hover:opacity-100"
                    link
                    @click.stop="handleEditStory(story, index, $event)"
                  >
                    <span class="iconfont text-lg">&#xea48;</span>
                  </el-button>
                </div>
              </div>
            </div>
            <div class="mt-2 text-xs text-[#909399]" v-if="loading">服务器火爆，预计加载时间30s</div>
            <!-- 换一批按钮 -->
            <div class="footer-actions mt-4">
              <el-button
                link
                type="info"
                class="link-item"
                @click="updateStories"
                :disabled="loading"
              >
                <span class="iconfont refresh-icon mr-1">&#xe66f;</span>
                <span>换一批</span>
              </el-button>
            </div>
            <!-- 编辑面板：从卡片位置展开，与 QuickCharacterSelector 相同动效 -->
            <Transition name="edit-panel">
              <div
                v-if="showStoryEditPanel"
                class="edit-panel story-edit-panel"
                :style="stpryEditPanelStyle"
                :class="{ animating: isStoryEditAnimating }"
              >
                <div class="edit-panel-content">
                  <div class="edit-form">
                    <div class="form-group form-group-name">
                      <label class="form-label">书名：</label>
                      <div class="form-input-wrapper">
                        <el-input
                          v-model="editingStory.title"
                          placeholder="请填入书名"
                          maxlength="50"
                          show-word-limit
                          class="form-input"
                        />
                      </div>
                    </div>
                    <div class="form-group form-group-bio">
                      <label class="form-label">故事简介：</label>
                      <div class="form-input-wrapper form-input-wrapper-bio">
                        <el-scrollbar max-height="260">
                          <MarkdownEditor
                            v-model="editingStory.intro"
                            :maxlength="MAX_INTRO_LENGTH"
                            placeholder="填写故事简介、梗概"
                            class="form-textarea bg-[#fff6d9] rounded-lg min-h-[260px] pr-18"
                          />
                        </el-scrollbar>
                        <span class="word-count word-count-bio"
                          >{{ (editingStory.intro || '').length }}/{{ MAX_INTRO_LENGTH }}</span
                        >
                      </div>
                    </div>
                    <div class="edit-actions">
                      <el-button class="edit-btn" @click="closeStoryEditPanel">取消</el-button>
                      <el-button class="edit-btn" type="primary" @click="handleSaveStoryEdit"
                        >确定
                      </el-button>
                    </div>
                  </div>
                </div>
              </div>
            </Transition>
          </div>
        </div>
      </div>

      <div v-else-if="stepActive == 3" class="character-step step-content">
        <div class="card-edit-container">
          <div class="character-edit-container" ref="characterGridRef">
            <div class="character-grid" :class="{ 'edit-mode': showCharacterEditPanel }">
              <CharacterCard
                v-for="(character, characterI) in characters"
                :key="character.name + character.mbti + characterI"
                :data="character"
                :class="{ ['selected']: character == selectedCharacter }"
                :loading="loading"
                @click="handleCharacterClick(character)"
                @edit="(data, e) => handleCharacterEdit(data, characterI, e)"
              />
            </div>
            <div class="mt-2 text-xs text-[#909399]" v-if="loading">服务器火爆，预计加载时间20s</div>
            <div class="footer-actions mt-4">
              <el-button
                link
                type="info"
                class="link-item"
                @click="updateCharacters"
                :disabled="loading"
              >
                <span class="iconfont refresh-icon mr-1">&#xe66f;</span>
                <span>换一批</span>
              </el-button>
            </div>

            <!-- 角色编辑面板：从卡片位置展开，与故事编辑面板相同动效 -->
            <Transition name="edit-panel">
              <div
                v-if="showCharacterEditPanel"
                class="edit-panel character-edit-panel"
                :style="characterEditPanelStyle"
                :class="{ animating: isCharacterEditAnimating }"
              >
                <div class="edit-panel-content relative">
                  <div class="w-40 h-auto absolute bottom-0 right-10">
                    <img
                      class="w-full h-auto object-cover"
                      :src="editingCharacter.gender == '女' ? FEMALE : MALE"
                      alt=""
                    />
                  </div>
                  <div class="edit-form">
                    <div class="form-group form-group-name">
                      <label class="form-label">角色名：</label>
                      <div class="form-input-wrapper">
                        <el-input
                          v-model="editingCharacter.name"
                          placeholder="请填入角色名"
                          maxlength="5"
                          show-word-limit
                          class="form-input"
                        />
                      </div>
                    </div>
                    <div class="form-group">
                      <label class="form-label">性别：</label>
                      <div class="form-input-wrapper">
                        <el-select
                          v-model="editingCharacter.gender"
                          placeholder="性别"
                          class="form-select"
                          :options="[
                            { label: '男', value: '男' },
                            { label: '女', value: '女' },
                          ]"
                        />
                      </div>
                    </div>
                    <div class="form-group form-group-bio">
                      <label class="form-label">人物标签：</label>
                      <div class="form-input-wrapper">
                        <el-input
                          v-model="editingCharacter.abilities"
                          maxlength="100"
                          placeholder="人物标签"
                          show-word-limit
                          class="form-input bg-[#fff6d9] rounded-lg"
                        />
                      </div>
                    </div>
                    <div class="form-group form-group-bio">
                      <label class="form-label">人物身份：</label>
                      <div class="form-input-wrapper">
                        <el-input
                          v-model="editingCharacter.identity"
                          placeholder="人物身份"
                          maxlength="50"
                          show-word-limit
                          class="form-input bg-[#fff6d9] rounded-lg"
                        />
                      </div>
                    </div>
                    <div class="form-group">
                      <label class="form-label">人物小传：</label>
                      <div class="form-input-wrapper">
                        <el-input
                          v-model="editingCharacter.experiences"
                          type="textarea"
                          :rows="4"
                          placeholder="人物小传"
                          maxlength="300"
                          class="form-input"
                          show-word-limit
                        />
                      </div>
                    </div>
                    <div class="edit-actions">
                      <el-button class="edit-btn" @click="closeCharacterEditPanel">取消</el-button>
                      <el-button class="edit-btn" type="primary" @click="handleSaveCharacterEdit">
                        确定
                      </el-button>
                    </div>
                  </div>
                </div>
              </div>
            </Transition>
          </div>
        </div>
      </div>

      <div v-else-if="stepActive == 4" class="step-outline step-content">
        <div
          :class="{
            'editor-layout': true,
            editing: isOutlineEditing,
          }"
        >
          <div class="header">大纲</div>
          <AutoScrollbar max-height="420" class="markdown-editor-scrollbar">
            <MarkdownEditor
              ref="markdownEditorRef"
              v-model="outlineContent"
              :readonly="!isOutlineEditing"
              class="step-outline-editor"
            />
          </AutoScrollbar>
        </div>
        <div class="footer-actions">
          <el-button
            link
            type="info"
            class="link-item"
            @click="updateOutlineStream"
            :disabled="loading"
          >
            <span class="iconfont refresh-icon mr-1">&#xe66f;</span>
            <span>重新生成</span>
          </el-button>
          <el-button
            link
            type="info"
            class="link-item"
            @click="handleOutlineEdit"
            :disabled="loading"
          >
            <span class="iconfont refresh-icon mr-1">&#xea48;</span>
            <span>{{ isOutlineEditing ? '完成编辑' : '编辑' }}</span>
          </el-button>
        </div>
      </div>
    </div>
    <!-- Footer -->
    <template #footer>
      <div class="footer-buttons">
        <el-button type="info" class="skip-button" @click="handleClose"> 退出</el-button>
        <el-button
          type="primary"
          class="confirm-button next-step iconfont"
          :disabled="!nextStepAble"
          @click="nextStepConfirm"
        >
          {{ stepActive == 4 ? '保存至作品' : '下一步' }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped lang="less">
// 自定义设定视图样式
.custom-header {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 0 20px 0;
  position: relative;
  text-align: center;
  font-size: 24px;
  line-height: 32px;

  .header-title {
    display: flex;
    flex-direction: column;
    justify-content: center;
    height: 120px;
    line-height: 1.8;
    font-size: 24px;
    font-weight: 400;
    color: var(--el-text-color-primary);
    margin: 0;
    text-align: center;
    position: relative;
    z-index: 1;

    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: url('@/assets/images/title_bg.png') no-repeat center center;
      background-size: 260px auto;
      opacity: 0.05;
      z-index: 0;
    }
  }
}

// 内容区域
.step-content {
  min-height: 540px;
}

.step-mode {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24px;

  .mode-item {
    width: 240px;
    height: 204px;
    border: 2px solid #e6e6e5;
    border-radius: 16px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 20px;
    cursor: pointer;

    &:hover {
      border: 2px solid var(--theme-color);
    }

    &.selected {
      border: 2px solid var(--theme-color);
    }

    .mode-cover {
      width: 100%;
      height: 76px;
      background: #ffffff;

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
    }

    .mode-title {
      height: 26px;
      font-size: 22px;
      font-weight: 500;
    }

    .mode-desc {
      font-size: 12px;
      color: #9a9a9a;
    }
  }
}

.tag-select-layout {
  padding: 0 32px;
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;

  // 脑洞选择内容
  .brainstorm-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 16px;

    .brainstorm-list {
      display: flex;
      flex-direction: row;
      gap: 12px;
      flex-wrap: wrap;

      .brainstorm-item {
        flex: 1;
        min-width: 240px;
        padding: 32px;
        background: #fff9f0;
        border-radius: 8px;
        border: 2px solid transparent;
        cursor: pointer;
        transition: all 0.2s;
        min-height: 260px;

        &:hover {
          border-color: var(--border-hover);
        }

        &.selected {
          border-color: var(--bg-editor-save);
        }

        .brainstorm-title {
          margin: 0 0 16px 0;
          font-size: 18px;
          font-weight: 600;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .title-divider {
          width: 100%;
          height: 1px;
          background: var(--border-color);
          margin-bottom: 16px;
        }

        .brainstorm-summary {
          margin: 0;
          font-size: 15px;
          color: var(--text-secondary);
          line-height: 2;
          display: -webkit-box;
          -webkit-line-clamp: 6;
          line-clamp: 6;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      }
    }

    // 骨架屏
    .brainstorm-skeleton {
      display: flex;
      flex-direction: row;
      gap: 12px;

      .skeleton-item {
        flex: 1;
        min-width: 240px;
        padding: 32px;
        background: #fff9f0;
        border-radius: 8px;
        min-height: 260px;

        .skeleton-title {
          width: 60%;
          height: 22px;
          background: linear-gradient(
            90deg,
            var(--border-color) 25%,
            var(--bg-hover) 50%,
            var(--border-color) 75%
          );
          background-size: 200% 100%;
          animation: skeleton-loading 1.5s ease-in-out infinite;
          border-radius: 4px;
          margin-bottom: 16px;
        }

        .skeleton-divider {
          width: 100%;
          height: 1px;
          background: var(--border-color);
          margin-bottom: 16px;
        }

        .skeleton-line {
          height: 16px;
          background: linear-gradient(
            90deg,
            var(--border-color) 25%,
            var(--bg-hover) 50%,
            var(--border-color) 75%
          );
          background-size: 200% 100%;
          animation: skeleton-loading 1.5s ease-in-out infinite;
          border-radius: 4px;
          margin-bottom: 12px;
          width: 100%;

          &.short {
            width: 70%;
          }

          &:last-child {
            margin-bottom: 0;
          }
        }
      }
    }

    // 刷新按钮
    .refresh-container {
      display: flex;
      justify-content: center;
      padding-top: 8px;

      .refresh-btn {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 24px;
        background: transparent;
        border: none;
        color: var(--bg-editor-save);
        font-size: 16px;
        cursor: pointer;
        transition: all 0.2s;

        &:hover:not(:disabled) {
          opacity: 0.8;
        }

        &:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .rotating {
          animation: rotate 1s linear infinite;
        }
      }
    }
  }
}

.step-template {
  .template-header {
    height: 50px;
    display: flex;
    flex-direction: row-reverse;
    align-items: center;
  }

  .template-group {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    row-gap: 16px;
    column-gap: 16px;
    overflow-y: auto;

    .grid-item {
      flex: 0 0 calc((100% - 48px) / 4);
      width: calc((100% - 48px) / 4);
      height: 144px;
      border-radius: 20px;
      border: 2px solid var(--el-border-color-light);
      transition: box-shadow 0.2s ease;
      background: #fff;

      &:hover {
        border: 2px solid var(--theme-color);
      }
    }

    :deep(.template-card) {
      height: 190px;
      position: relative;
      padding: 12px 16px;
      background: #fff;
      cursor: pointer;
      transition: all 0.3s ease;

      &.selected {
        border: 2px solid var(--el-color-primary);
      }

      .template-description {
        -webkit-line-clamp: 4;
        line-clamp: 4;
        -webkit-box-orient: vertical;
        overflow: hidden;
        text-overflow: ellipsis;
        min-height: 78px;
      }
    }
  }
}

.character-step {
  display: flex;
  flex-direction: column;
  gap: 24px;
  justify-content: center;

  .card-edit-container {
    position: relative;
    flex: 1;
    min-height: 0;
  }

  .character-edit-container {
    position: relative;
    height: 540px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  .edit-panel-enter-active,
  .edit-panel-leave-active {
    transition: all 0.6s ease;
  }

  .edit-panel-enter-from,
  .edit-panel-leave-to {
    opacity: 0;
    transform: scale(0.8);
  }

  .edit-panel.character-edit-panel {
    position: absolute;
    background: #fff8e5;
    border: 2px solid rgba(255, 149, 0, 1);
    border-radius: 10px;
    z-index: 100;
    overflow: hidden;
    transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1);
    top: 0;
    left: 0;
    right: 0;
    display: flex;
    flex-direction: column;

    &.animating {
      transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .edit-panel-content {
      padding: 30px 50px 0 50px;
      position: relative;
      height: 100%;
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
      overflow-y: auto;
      overflow-x: hidden;
    }

    .edit-form {
      display: flex;
      flex-direction: column;
      gap: 22px;
      position: relative;
      z-index: 1;
      flex: 0 0 auto;
      min-height: min-content;

      .form-group {
        display: flex;
        flex-direction: row;
        align-items: flex-start;
        gap: 50px;
        flex-shrink: 0;

        .form-label {
          flex-shrink: 0;
          width: 124px;
          font-size: 24px;
          line-height: 32px;
          color: #464646;
        }

        .form-input-wrapper {
          flex: 1;
          min-width: 0;
          position: relative;

          .word-count {
            position: absolute;
            right: 16px;
            top: 16px;
            font-size: 14px;
            color: #999;
          }

          &.form-input-wrapper-bio .word-count.word-count-bio {
            top: auto;
            bottom: 16px;
          }
        }

        .form-input {
          :deep(.el-input__wrapper) {
            background: rgba(255, 246, 217, 0.6);
            border: none;
            box-shadow: none;
            font-size: 16px;

            .el-input__count-inner {
              background: rgba(255, 246, 217, 0.6);
              font-size: 14px;
              color: #999;
            }

            .el-input__count {
              background: rgba(255, 246, 217, 0.6);
            }
          }

          :deep(.el-textarea__inner) {
            background: rgba(255, 246, 217, 0.6);
            border: none;
            box-shadow: none;
            font-size: 16px;
            resize: none;
            padding-right: 70px;
          }

          :deep(.el-input__count) {
            background: #fff6d9;
            font-size: 14px;
            color: #999;
          }
        }

        .form-select {
          :deep(.el-select__wrapper) {
            background: #fff6d9;
            border: none;
            box-shadow: none;
            font-size: 16px;
          }
        }

        &.form-group-bio .form-input-wrapper {
          flex: 1;
        }
      }

      .edit-actions {
        display: flex;
        gap: 24px;
        justify-content: center;

        .edit-btn {
          margin: 0;
        }
      }
    }
  }

  .character-grid {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 22px;
    padding: 2px 80px;
    width: 100%;

    &.edit-mode {
      pointer-events: none;
      opacity: 0.6;
    }

    :deep(.character-card) {
      cursor: pointer;

      &:hover {
        outline: 2px solid var(--theme-color);
      }

      &.selected {
        outline: 2px solid var(--theme-color);
      }
    }
  }
}

// 内容区域
.story-step {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 24px;

  .card-edit-container {
    position: relative;
    flex: 1;
    min-height: 0;
  }

  .story-edit-container {
    position: relative;
    height: 540px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }

  // 编辑面板动效（与 QuickCharacterSelector 一致）
  .edit-panel-enter-active,
  .edit-panel-leave-active {
    transition: all 0.6s ease;
  }

  .edit-panel-enter-from,
  .edit-panel-leave-to {
    opacity: 0;
    transform: scale(0.8);
  }

  .edit-panel.story-edit-panel {
    position: absolute;
    background: #fff8e5;
    border: 2px solid rgba(255, 149, 0, 1);
    border-radius: 10px;
    z-index: 100;
    overflow: hidden;
    transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1);
    top: 0;
    left: 0;
    right: 0;
    display: flex;
    flex-direction: column;

    &.animating {
      transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .edit-panel-content {
      padding: 30px 50px 0 50px;
      position: relative;
      height: 100%;
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
      overflow-y: auto;
      overflow-x: hidden;
    }

    .edit-form {
      height: 100%;
      display: flex;
      flex-direction: column;
      gap: 22px;
      position: relative;
      z-index: 1;
      flex: 0 0 auto;
      min-height: min-content;

      .form-group {
        display: flex;
        flex-direction: row;
        align-items: flex-start;
        gap: 50px;
        flex-shrink: 0;

        .form-label {
          flex-shrink: 0;
          width: 124px;
          font-size: 24px;
          line-height: 32px;
          color: #464646;
        }

        .form-input-wrapper {
          flex: 1;
          min-width: 0;
          position: relative;

          .word-count {
            position: absolute;
            right: 16px;
            top: 16px;
            font-size: 14px;
            color: #999;
          }
        }

        .form-input {
          :deep(.el-input__wrapper) {
            background: #fff6d9;
            border: none;
            box-shadow: none;
            font-size: 16px;

            .el-input__count-inner {
              background: #fff6d9;
              font-size: 14px;
              color: #999;
            }
          }
        }

        &.form-group-bio .form-input-wrapper {
          flex: 1;
        }
      }

      .edit-actions {
        display: flex;
        gap: 24px;
        margin-top: 16px;
        justify-content: center;

        .edit-btn {
          margin: 0;
        }
      }
    }
  }

  // 方向卡片网格
  .story-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 22px;
    padding: 2px 80px;
    width: 100%;

    .story-card {
      height: 310px;
      padding: 10px 20px 26px 20px;
      border-radius: 12px;
      background: #f9eece;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      gap: 12px;
      overflow: hidden;
      position: relative;

      &:hover {
        outline: 2px solid var(--theme-color);
      }

      &.selected {
        outline: 2px solid var(--theme-color);
      }

      .book-title {
        margin-top: 8px;
        font-size: 20px;
        font-weight: 600;
        color: #000000;
        line-height: 1.2;
        overflow: hidden;
        text-overflow: ellipsis;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        line-clamp: 2;
        -webkit-box-orient: vertical;
        word-break: break-word;
        flex-shrink: 0;
      }
    }
  }
}

.step-outline {
  padding: 24px 60px 0;

  .editor-layout {
    height: calc(100% - 32px);
    background: #f9eece;
    border-radius: 8px;
    padding-top: 8px;

    &.editing {
      outline: 2px solid #ce644c;
    }

    .header {
      font-size: 32px;
      font-weight: 600;
      color: #000000;
      line-height: 40px;
      padding-left: 8px;
    }

    .markdown-editor-scrollbar {
      height: 420px;
    }

    :deep(.markdown-editor) {
      height: calc(100% - 40px);
    }
  }

  .footer-actions {
    margin-top: 16px;
    height: 32px;
  }
}

// Footer 按钮区域（在 footer 插槽中）
.footer-buttons {
  display: flex;
  gap: 12px;
  align-items: center;
}

.footer-actions {
  display: flex;
  width: 100%;
  justify-content: center;
}

.dialog-body-wrapper {
  position: relative;
  min-height: 100%;
}
</style>

<style lang="less">
// 全局样式，用于 Element Plus Dialog 组件，与 CreateRecommendDialog 保持一致
.el-dialog.step-create-dialog {
  --el-dialog-width: 1020px;
  --el-dialog-margin-top: 10vh;
  border-radius: 10px !important;
  max-height: 80vh;
  display: flex;
  flex-direction: column;

  .el-dialog__header {
    padding: 0 32px;

    .back-button {
      position: absolute;
      left: 24px;
      top: 20px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      padding: 0;
      border-radius: 4px;
      background: transparent;
      transition: all 0.2s ease;

      .back-icon {
        font-size: 28px;
        color: var(--el-text-color-secondary);

        &:hover {
          color: var(--el-color-primary);
        }
      }
    }

    .close-button {
      position: absolute;
      right: 24px;
      top: 20px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      padding: 0;
      border-radius: 4px;
      background: transparent;
      transition: all 0.2s ease;

      .close-icon {
        font-size: 28px;
        color: var(--el-text-color-secondary);

        &:hover {
          color: var(--el-color-primary);
        }
      }
    }
  }

  .el-dialog__body {
    padding: 0 24px 12px 24px;
    flex: 1;
    overflow: auto;
  }

  .el-dialog__headerbtn {
    top: 0;
    right: 0;
  }

  .el-dialog__footer {
    display: flex;
    flex-direction: row-reverse;
    padding: 16px 24px;
  }

  .step-create-dialog-form {
    .el-form-item {
      .el-form-item__label {
        width: 100%;
        font-size: 20px;

        &:has(.recommend-label) {
          padding: 0;
        }
      }

      .el-input {
        height: 42px;
        font-size: 16px;
      }

      .el-textarea {
        font-size: 16px;

        .el-textarea__inner {
          line-height: 30px;
        }
      }

      .el-select {
        .el-select__wrapper {
          height: 42px;
          font-size: 16px;
        }
      }
    }
  }
}

// Tooltip 样式：最大宽度 240px，超出换行
.el-popper.intro-tooltip {
  width: 280px !important;
  word-wrap: break-word !important;
  word-break: break-word !important;
  white-space: normal !important;
  background: #303133;
  font-size: 14px;
  border: 1px solid var(--el-text-color-primary) !important;
  transform: translateY(-260px);

  .popover-story-markdown-render {
    color: #ffffff !important;
    font-size: 12px;

    h2 {
      font-size: 14px;
      margin: 0;
      color: #ffffff !important;
    }
  }
}

.story-card {
  .book-synopsis {
    .story-markdown-render {
      font-size: 14px;

      h2 {
        font-size: 16px;
        margin: 0;
      }
    }
  }
}
</style>
