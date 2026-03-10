<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import type { FileTreeNode } from "@/utils/aiTreeNodeConverter.ts";
import { useEditorStore } from "@/stores/editor.ts";
import { storeToRefs } from "pinia";
import { ElMessage, ElInput } from "element-plus";
import { WarningFilled } from "@element-plus/icons-vue";
import { updateWorkInfoReq } from "@/api/works.ts";
import ExportWorkMenu from "@/views/editor/components/ExportWorkMenu.vue";
import { useChatInputStore } from "@/stores/chatInput.ts";
import { trackingEditPageUpdateTitle } from "@/utils/matomoTrackingEvent/trackingGlogEvent";
import { trackingEditPageLeftSidebarOperation } from "@/utils/matomoTrackingEvent/clickEvent";

// 定义组件属性
interface Props {
  modelValue: FileTreeNode[];
  draggable?: boolean;
  expandable?: boolean;
  highlightCurrent?: boolean;
  defaultExpandAll?: boolean;
  checkStreamingStatusAndConfirm?: () => Promise<boolean>; // 检查流式状态并确认的函数
  onAfterSaveEditorData?: () => void; // 保存编辑器数据后的回调函数
}

const treeData = defineModel<FileTreeNode[]>();

watch(treeData, () => {
  setCurrentKey(currentKey.value);
}, { deep: true });

// 定义事件
interface Emits {
  (e: "update:modelValue", value: FileTreeNode[]): void;

  (e: "node-click", data: any, node: FileTreeNode, component: any): void;

  (e: "node-drag-start", event: DragEvent, node: FileTreeNode, path: string[]): void;

  (e: "node-drag-over", event: DragEvent, node: FileTreeNode, path: string[]): void;

  (e: "node-drop", event: DragEvent, node: FileTreeNode, path: string[]): void;

  (e: "node-double-click", node: FileTreeNode, path: string[]): void;

  (e: "check-change", data: any, checked: boolean, indeterminate: boolean): void;

  (e: "current-change", data: any, node: any): void;

  (e: "node-expand", data: any, node: any, component: any): void;

  (e: "node-collapse", data: any, node: any, component: any): void;

  (e: "add-node", node: FileTreeNode, path: string[]): void;

  (e: "remove-node", node: FileTreeNode, path: string[]): void;
}

const props = withDefaults(defineProps<Props>(), {
  selectedNodeId: "",
  draggable: true,
  expandable: true,
  highlightCurrent: true,
  defaultExpandAll: true,
});


const emit = defineEmits<Emits>();

const editorStore = useEditorStore();
const {
  workId,
  currentEditingId,
  workInfo
} = storeToRefs(editorStore);
const { findNodeById, renameNodeLabel } = editorStore;

const chatInputStore = useChatInputStore();
const { addAssociationTag } = chatInputStore;

// 编辑标题相关
const isEditingTitle = ref(false);
const editingTitleValue = ref(workInfo.value.title || "");
const titleInputRef = ref<InstanceType<typeof ElInput> | null>(null);

watch(
  () => workInfo.value.title,
  (newTitle) => {
    if (!isEditingTitle.value) {
      editingTitleValue.value = newTitle || "";
    }
  }
);

const handleTitleUpdate = async (newTitle: string) => {
  if (!newTitle || newTitle === workInfo.value?.title) return;

  workInfo.value = {
    ...workInfo.value,
    title: newTitle,
  };
  await updateWorkInfoReq(workId.value, { title: newTitle });
};

const focusTitleInput = async () => {
  await nextTick();
  if (titleInputRef.value) {
    // el-input 组件可以通过 $el 访问 DOM，然后查找内部的 input 元素
    const inputElement = titleInputRef.value.$el?.querySelector('input') as HTMLInputElement;
    if (inputElement) {
      inputElement.focus();
      inputElement.select();
    } else {
      // 如果找不到 input，尝试直接调用组件的 focus 方法
      titleInputRef.value.focus?.();
    }
  }
};

const startEditTitle = async () => {
  isEditingTitle.value = true;
  editingTitleValue.value = workInfo.value.title || "";
  await focusTitleInput();
};

const finishEditTitle = () => {
  const newTitle = editingTitleValue.value.trim();

  if (!newTitle) {
    // 为空则恢复
    editingTitleValue.value = workInfo.value.title || "";
    isEditingTitle.value = false;
    return;
  }

  if (newTitle !== workInfo.value.title) {
    handleTitleUpdate(newTitle);
  }
  isEditingTitle.value = false;
  // 触发修改作品名埋点
  trackingEditPageUpdateTitle({
    work_id: workId.value,
  });
};

const cancelEditTitle = () => {
  editingTitleValue.value = workInfo.value.title || "";
  isEditingTitle.value = false;
};

const handleTitleBlur = () => {
  if (isEditingTitle.value) {
    finishEditTitle();
  }
};

const handleTitleKeydown = (event: Event | KeyboardEvent) => {
  const keyboardEvent = event as KeyboardEvent;
  if (keyboardEvent.key === "Enter") {
    keyboardEvent.preventDefault();
    finishEditTitle();
  } else if (keyboardEvent.key === "Escape") {
    keyboardEvent.preventDefault();
    cancelEditTitle();
  }
};

const handleWorkTitleClick = () => {
  if (!isEditingTitle.value) {
    startEditTitle();
  }
};

// 标签组拖拽相关
const tagsGroupRef = ref<HTMLElement | null>(null);
const isDraggingTags = ref(false);
let dragStartX = 0;
let dragStartScrollLeft = 0;

const handleTagsMouseDown = (e: MouseEvent) => {
  if (e.button !== 0) return; // 只响应左键
  const el = tagsGroupRef.value;
  if (!el) return;

  isDraggingTags.value = true;
  dragStartX = e.pageX;
  dragStartScrollLeft = el.scrollLeft;
  el.classList.add("is-dragging");
  e.preventDefault(); // 避免选中文字
};

const handleTagsMouseMove = (e: MouseEvent) => {
  if (!isDraggingTags.value) return;
  const el = tagsGroupRef.value;
  if (!el) return;

  const deltaX = e.pageX - dragStartX;
  el.scrollLeft = dragStartScrollLeft - deltaX;
};

const stopTagsDragging = () => {
  if (!isDraggingTags.value) return;
  isDraggingTags.value = false;
  if (tagsGroupRef.value) {
    tagsGroupRef.value.classList.remove("is-dragging");
  }
};

// el-tree 引用
const treeRef = ref();

// 内部状态
const currentKey = defineModel<string>("currentKey", { default: "" });

// 通过 currentKey 计算当前选中的节点
const currentNode = computed(() => {
  if (!currentKey.value || !treeData.value) {
    return null;
  }
  return findNodeById(currentKey.value);
});

// 右键菜单状态
const contextMenuVisible = ref(false);
const contextMenuPosition = ref({ x: 0, y: 0 });
const contextMenuTarget = ref<any>(null);
const rightClickedNode = ref<any>(null); // 跟踪右键选中的节点

// 对话框相关状态
const renameDialogVisible = ref(false);
const deleteDialogVisible = ref(false);
const renameInputValue = ref("");
const deleteTargetNode = ref<FileTreeNode | null>(null);
const renameTargetNode = ref<FileTreeNode | null>(null); // 保存重命名的目标节点
const renameInputRef = ref();

// 导出对话框相关状态
const showExportDialog = ref(false);

// 检查同一父节点下的children是否有重复的label
const checkDuplicateLabel = (
  parentNode: FileTreeNode | null,
  label: string,
  excludeNodeId?: string
): boolean => {
  const siblings = parentNode ? parentNode.children : treeData.value || [];
  return siblings.some((node) => node.id !== excludeNodeId && node.label === label);
};

// 生成唯一的节点名称
const generateUniqueNodeName = (
  parentNode: FileTreeNode | null,
  baseName: string,
  isDirectory: boolean = false
): string => {
  let counter = 1;
  let uniqueName = baseName;

  while (checkDuplicateLabel(parentNode, uniqueName)) {
    uniqueName = `${baseName}${counter}`;
    counter++;
  }

  return uniqueName;
};

// 监听 currentKey 变化，更新树的选中状态
watch(currentKey, (newKey) => {
  setCurrentKey(newKey);
});
// 处理点击外部区域
const handleClickOutside = (event: Event) => {
  // 隐藏右键菜单
  hideContextMenu();

  // 关闭导出对话框
  const target = event.target as HTMLElement;
  if (!target.closest(".export-dropdown") && !target.closest(".export-btn-container")) {
    showExportDialog.value = false;
  }
};

// 监听点击外部隐藏右键菜单和清空选中状态
onMounted(() => {
  setCurrentKey(currentKey.value);
  document.addEventListener("click", handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener("click", handleClickOutside);
});

// 处理节点点击
const handleNodeClick = (data: any, node: any, component: any) => {
  // 只有 fileType 为 md 的文件节点才能被选中
  // 目录节点（isDirectory === true）不可被选中，只能展开折叠
  if (!data.isDirectory && data.fileType === 'md') {
    currentKey.value = data.id;
    // 触发自定义事件
  } else if (data.isDirectory) {
    // 重要：点击目录后，恢复之前选中的 md 节点的高亮状态
    nextTick(() => {
      if (currentKey.value && treeRef.value) {
        treeRef.value.setCurrentKey(currentKey.value);
      }
    });
  }
  // 如果节点的 new 为 true，置为 false（无论是否可选中）
  if (data.new) {
    data.new = false;
    // 同时更新树节点数据，确保数据同步
    const treeNode = findNodeById(data.id);
    if (treeNode) {
      treeNode.new = false;
    }
  }
  emit("node-click", data, node, component);
};

// 处理当前节点变化
const handleCurrentChange = (data: any, node: any) => {
  if (!data) {
    currentKey.value = "";
  } else {
    // 只有 md 文件节点才能被设置为 current
    if (!data.isDirectory && data.fileType === 'md') {
      currentKey.value = data.id;
      emit("current-change", data, node);
    }
  }
};

// 拖拽状态管理
const dragState = ref({
  draggedNode: null as FileTreeNode | null,
  draggedNodeParent: null as FileTreeNode | null,
  draggedNodeIndex: -1,
  dropTarget: null as FileTreeNode | null,
  dropTargetParent: null as FileTreeNode | null,
  dropTargetIndex: -1,
  dropPosition: "above" as "above" | "below", // 拖拽位置：上方或下方
  showDropLine: false, // 是否显示分割线
});

// 处理拖拽开始
const handleDragStart = (event: DragEvent, data: any) => {
  if (!props.draggable) return;

  event.stopPropagation();

  // 设置拖拽数据
  dragState.value.draggedNode = data;

  // 找到拖拽节点的父节点和索引
  const { parent, index } = findNodeParentAndIndex(data.id, treeData.value || []);
  dragState.value.draggedNodeParent = parent;
  dragState.value.draggedNodeIndex = index;

  // 设置拖拽效果
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", data.id);
  }

  // 添加拖拽样式
  const targetElement = event.currentTarget as HTMLElement;
  if (targetElement) {
    targetElement.classList.add("dragging");
  }
};

// 处理拖拽结束
const handleDragEnd = (event: DragEvent, data: any) => {
  if (!props.draggable) return;

  event.stopPropagation();

  // 移除拖拽样式
  const targetElement = event.currentTarget as HTMLElement;
  if (targetElement) {
    targetElement.classList.remove("dragging");
  }

  // 移除所有拖拽样式和分割线
  document.querySelectorAll(".drag-over").forEach((el) => {
    el.classList.remove("drag-over");
  });
  removeDropLine();

  // 清除拖拽状态
  dragState.value = {
    draggedNode: null,
    draggedNodeParent: null,
    draggedNodeIndex: -1,
    dropTarget: null,
    dropTargetParent: null,
    dropTargetIndex: -1,
    dropPosition: "above",
    showDropLine: false,
  };
};

// 处理拖拽进入
const handleDragEnter = (event: DragEvent, data: any) => {
  if (!props.draggable || !dragState.value.draggedNode) return;

  event.preventDefault();

  // 检查是否可以在同一层级拖拽
  if (canDropInSameLevel(data)) {
    dragState.value.dropTarget = data;
    const { parent, index } = findNodeParentAndIndex(data.id, treeData.value || []);
    dragState.value.dropTargetParent = parent;
    dragState.value.dropTargetIndex = index;

    // 计算拖拽位置（上方或下方）
    const targetElement = event.currentTarget as HTMLElement;
    if (targetElement) {
      const rect = targetElement.getBoundingClientRect();
      const mouseY = event.clientY;
      const elementCenterY = rect.top + rect.height / 2;

      // 根据鼠标位置判断是上方还是下方
      dragState.value.dropPosition = mouseY < elementCenterY ? "above" : "below";
      dragState.value.showDropLine = true;

      // 添加分割线样式
      addDropLine(targetElement, dragState.value.dropPosition);
    }
  }
};

// 处理拖拽离开
const handleDragLeave = (event: DragEvent, data: any) => {
  if (!props.draggable) return;

  // 移除分割线
  removeDropLine();
  dragState.value.showDropLine = false;
};

// 处理拖拽悬停
const handleDragOver = (event: DragEvent, data: any) => {
  if (!props.draggable || !dragState.value.draggedNode) return;

  event.preventDefault();

  // 检查是否可以在同一层级拖拽
  if (canDropInSameLevel(data)) {
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }

    // 更新目标节点信息（防止在不同节点间移动时信息不准确）
    dragState.value.dropTarget = data;
    const { parent, index } = findNodeParentAndIndex(data.id, treeData.value || []);
    dragState.value.dropTargetParent = parent;
    dragState.value.dropTargetIndex = index;

    // 更新拖拽位置和分割线
    const targetElement = event.currentTarget as HTMLElement;
    if (targetElement) {
      const rect = targetElement.getBoundingClientRect();
      const mouseY = event.clientY;
      const elementCenterY = rect.top + rect.height / 2;

      const newPosition = mouseY < elementCenterY ? "above" : "below";

      // 如果位置发生变化，更新分割线
      if (newPosition !== dragState.value.dropPosition) {
        dragState.value.dropPosition = newPosition;
        addDropLine(targetElement, newPosition);
      }
    }
  } else {
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "none";
    }
  }
};

// 处理拖拽放置
const handleDrop = (event: DragEvent, data: any) => {
  if (!props.draggable || !dragState.value.draggedNode) return;

  event.preventDefault();
  event.stopPropagation();

  // 移除分割线
  removeDropLine();
  dragState.value.showDropLine = false;

  // 检查是否可以在同一层级拖拽
  if (!canDropInSameLevel(data)) {
    return;
  }

  // 执行排序
  performSameLevelSort();
};

// 检查是否可以在同一层级拖拽
const canDropInSameLevel = (targetNode: FileTreeNode): boolean => {
  if (!dragState.value.draggedNode) return false;

  // 不能拖拽到自己
  if (dragState.value.draggedNode.id === targetNode.id) return false;

  // 检查是否在同一层级（同一个父节点）
  const draggedParent = dragState.value.draggedNodeParent;
  const targetParent = findNodeParentAndIndex(targetNode.id, treeData.value || []).parent;

  // 如果两个节点都没有父节点，说明都是根节点
  if (!draggedParent && !targetParent) {
    return true;
  }

  // 如果有父节点，检查是否是同一个父节点
  const isSameParent = draggedParent?.id === targetParent?.id;
  return isSameParent;
};

// 执行同一层级的排序
const performSameLevelSort = () => {
  const {
    draggedNode,
    draggedNodeParent,
    draggedNodeIndex,
    dropTarget,
    dropTargetParent,
    dropTargetIndex,
    dropPosition,
  } = dragState.value;

  if (!draggedNode || !dropTarget || draggedNodeIndex === -1 || dropTargetIndex === -1) {
    return;
  }

  // 获取要操作的子节点数组 - 使用目标节点的父节点（确保在同一层级）
  let childrenArray: FileTreeNode[];
  let parentNode: FileTreeNode | null = null;

  if (dropTargetParent) {
    // 有父节点，操作父节点的children
    childrenArray = dropTargetParent.children;
    parentNode = dropTargetParent;
  } else {
    // 没有父节点，操作根节点数组
    childrenArray = treeData.value || [];
    parentNode = null;
  }

  // 移除拖拽的节点
  const [movedNode] = childrenArray.splice(draggedNodeIndex, 1);

  // 根据拖拽位置计算新的插入位置
  let newIndex: number;

  if (dropPosition === "above") {
    // 拖拽到目标节点上方，插入到目标节点之前
    newIndex = dropTargetIndex;
  } else {
    // 拖拽到目标节点下方，插入到目标节点之后
    newIndex = dropTargetIndex + 1;
  }

  // 如果拖拽节点原来在目标节点之前，由于我们已经移除了拖拽节点，
  // 目标节点的索引会向前移动一位，所以需要调整
  if (draggedNodeIndex < dropTargetIndex) {
    newIndex = newIndex - 1;
  }

  // 确保索引在有效范围内
  newIndex = Math.max(0, Math.min(newIndex, childrenArray.length));

  // 插入到新位置
  childrenArray.splice(newIndex, 0, movedNode);

  // 触发响应式更新
  if (parentNode) {
    // 更新父节点的children数组
    parentNode.children = [...childrenArray];
  } else {
    // 根节点排序，直接更新treeData
    treeData.value = [...childrenArray];
  }

  // 强制触发整个树数据的响应式更新
  forceTreeDataUpdate();

  // 使用 nextTick 确保 DOM 更新
  nextTick(() => {
    // 重新设置当前选中的节点，确保视图同步
    if (currentKey.value) {
      setCurrentKey(currentKey.value);
    }

    // 确保 el-tree 组件也更新
    if (treeRef.value) {
      treeRef.value.setCurrentKey(currentKey.value);
    }
  });
};

// 查找节点的父节点和索引
const findNodeParentAndIndex = (
  nodeId: string,
  nodes: FileTreeNode[],
  parent: FileTreeNode | null = null
): {
  parent: FileTreeNode | null;
  index: number;
} => {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];

    // 如果找到目标节点
    if (node.id === nodeId) {
      return { parent, index: i };
    }

    // 递归查找子节点
    if (node.children && node.children.length > 0) {
      const result = findNodeParentAndIndex(nodeId, node.children, node);
      if (result.index !== -1) {
        return result;
      }
    }
  }

  return { parent: null, index: -1 };
};

// 添加拖拽分割线
const addDropLine = (targetElement: HTMLElement, position: "above" | "below") => {
  // 先移除现有的分割线
  removeDropLine();

  // 创建分割线元素
  const dropLine = document.createElement("div");
  dropLine.className = "drag-drop-line";
  dropLine.style.cssText = `
    position: absolute;
    left: 0;
    right: 0;
    height: 2px;
    background-color: var(--el-color-primary);
    z-index: 1000;
    pointer-events: none;
    border-radius: 1px;
    box-shadow: 0 0 4px rgba(64, 158, 255, 0.5);
  `;

  // 根据位置设置分割线的位置
  const rect = targetElement.getBoundingClientRect();
  const treeContainer = targetElement.closest(".el-tree") as HTMLElement;
  if (treeContainer) {
    const containerRect = treeContainer.getBoundingClientRect();

    if (position === "above") {
      dropLine.style.top = `${rect.top - containerRect.top - 1}px`;
    } else {
      dropLine.style.top = `${rect.bottom - containerRect.top + 1}px`;
    }

    // 添加到树容器中
    treeContainer.style.position = "relative";
    treeContainer.appendChild(dropLine);
  }
};

// 移除拖拽分割线
const removeDropLine = () => {
  const existingLine = document.querySelector(".drag-drop-line");
  if (existingLine) {
    existingLine.remove();
  }
};

// 强制触发树数据的响应式更新
const forceTreeDataUpdate = () => {
  if (!treeData.value) return;
  // 创建新的数组引用，确保 Vue 检测到变化
  treeData.value = treeData.value.map((node) => ({
    ...node,
    children: node.children ? [...node.children] : [],
  }));
};

// 处理添加节点
const handleAddNode = (event: Event, data: any) => {
  event.stopPropagation();
  if (!treeData.value) {
    return;
  }
  const targetNode = findNodeById(data?.id)
  if (!targetNode) return;

  // 创建新节点，确保名称唯一
  const baseLabel = "新文件";
  const uniqueLabel = generateUniqueNodeName(data, baseLabel, false);
  const newPath = [...data.path, uniqueLabel + ".md"];
  const newNode: FileTreeNode = {
    id: newPath.join("/"),
    key: newPath.join("-"),
    label: uniqueLabel,
    content: "",
    isDirectory: false,
    path: newPath,
    fileType: "md",
    children: [],
  };
  console.log(newNode);
  if (!targetNode.children) {
    targetNode.children = [];
  }
  // 添加新节点到当前目录
  targetNode.children.push(newNode);
  // 触发响应式更新
  treeData.value = [...(treeData.value || [])];
  currentKey.value = newNode.id;

  console.log(JSON.parse(JSON.stringify(treeData.value)));

  // 添加埋点：文件夹下添加文件
  trackingEditPageLeftSidebarOperation("add", "File", {
    parent_folder: data.label || "unknown",
  });
};

// 处理右键菜单
const handleContextMenu = (event: MouseEvent, data: any) => {
  event.preventDefault();
  event.stopPropagation();

  contextMenuPosition.value = { x: event.clientX, y: event.clientY };
  contextMenuTarget.value = data;
  rightClickedNode.value = data; // 设置右键选中的节点
  contextMenuVisible.value = true;
};

// 隐藏右键菜单
const hideContextMenu = () => {
  contextMenuVisible.value = false;
  contextMenuTarget.value = null;
  rightClickedNode.value = null; // 清除右键选中的节点
};

// 处理添加文件夹
const handleAddFolder = () => {
  if (!contextMenuTarget.value) return;
  if (!treeData.value) return;
  const targetNode = findNodeById(contextMenuTarget.value.id);
  if (!targetNode) return;

  const baseLabel = "新文件夹";
  const uniqueLabel = generateUniqueNodeName(contextMenuTarget.value, baseLabel, true);
  const newPath = [...(contextMenuTarget.value.path || []), uniqueLabel];
  const newNode: FileTreeNode = {
    id: newPath.join("/"),
    key: newPath.join("-"),
    label: uniqueLabel,
    content: "",
    isDirectory: true,
    path: newPath,
    fileType: "directory",
    children: [],
  };
  if (!targetNode.children) {
    targetNode.children = [];
  }

  targetNode.children.push(newNode);
  treeData.value = [...(treeData.value || [])];

  // 添加埋点：右键菜单在文件夹下添加文件夹
  trackingEditPageLeftSidebarOperation("add", "Folder", {
    parent_folder: contextMenuTarget.value.label || "unknown",
  });

  hideContextMenu();
};

// 处理添加文件
const handleAddFile = () => {
  if (!contextMenuTarget.value) return;
  if (!treeData.value) return;
  const targetNode = findNodeById(contextMenuTarget.value.id);
  if (!targetNode) return;

  const baseLabel = "新文件";
  const uniqueLabel = generateUniqueNodeName(contextMenuTarget.value, baseLabel, false);

  const newPath = [...(contextMenuTarget.value.path || []), uniqueLabel + ".md"];
  const newNode: FileTreeNode = {
    id: newPath.join("/"),
    key: newPath.join("-"),
    label: uniqueLabel,
    content: "",
    isDirectory: false,
    path: newPath,
    fileType: "md",
    children: [],
  };
  if (!targetNode.children) {
    targetNode.children = [];
  }
  targetNode.children.push(newNode);
  treeData.value = [...(treeData.value || [])];
  currentKey.value = newNode.id;

  // 添加埋点：右键菜单在文件夹下添加文件
  trackingEditPageLeftSidebarOperation("add", "File", {
    parent_folder: contextMenuTarget.value.label || "unknown",
  });

  hideContextMenu();
};

const addToChat = () => {
  if (!contextMenuTarget.value) return;
  addAssociationTag(contextMenuTarget.value.id);
  hideContextMenu();
}

// 处理重命名
const handleRename = () => {
  if (!contextMenuTarget.value) return;

  // 保存目标节点引用，避免在hideContextMenu后丢失
  renameTargetNode.value = contextMenuTarget.value;

  // 设置重命名对话框的初始值
  renameInputValue.value = contextMenuTarget.value.label;
  renameDialogVisible.value = true;
  hideContextMenu();
};

// 确认重命名
const confirmRename = () => {
  if (!renameTargetNode.value || !renameInputValue.value.trim()) {
    renameDialogVisible.value = false;
    return;
  }
  let editCurrentNode = false;
  if (currentEditingId.value == renameTargetNode.value.id) {
    editCurrentNode = true;
  }

  const newName = renameInputValue.value.trim();
  const targetNode = renameTargetNode.value;

  // 检查名称是否重复
  const parentNode = findNodeParentAndIndex(targetNode.id, treeData.value || []).parent;
  const isDuplicate = checkDuplicateLabel(parentNode, newName, targetNode.id);

  if (isDuplicate) {
    ElMessage.warning("该名称已存在，请使用其他名称");
    return;
  }

  // 保存旧节点 id，用于检查是否需要更新选中状态
  const oldNodeId = targetNode.id;

  // 使用 editorStore 的 renameNodeLabel 方法执行重命名
  // 该方法会自动更新节点及其所有子节点的 path、id、key，并触发响应式更新
  // 如果重命名的是当前编辑的节点，会自动更新 currentEditingId 和 currentSidebarId
  const updatedNode = renameNodeLabel(oldNodeId, newName);

  if (updatedNode) {
    // 触发响应式更新（确保树组件刷新）
    forceTreeDataUpdate();
    // 如果重命名的是当前选中的节点，需要更新 currentKey
    // renameNodeLabel 已经更新了 currentSidebarId，但为了确保树组件选中状态正确，需要同步更新
    if (editCurrentNode) {
      currentEditingId.value = updatedNode.id;
    }
    ElMessage.success(`成功重命名为: ${newName}`);

    // 添加埋点：重命名操作
    trackingEditPageLeftSidebarOperation(
      "rename",
      updatedNode.isDirectory ? "Folder" : "File",
      {
        item_name: newName,
      }
    );
  } else {
    ElMessage.error("重命名失败");
  }

  renameDialogVisible.value = false;
  renameInputValue.value = "";
  renameTargetNode.value = null; // 清空保存的引用
};

// 取消重命名
const cancelRename = () => {
  renameDialogVisible.value = false;
  renameInputValue.value = "";
  renameTargetNode.value = null; // 清空保存的引用
};

// 聚焦输入框的辅助函数
const focusRenameInput = () => {
  if (renameInputRef.value) {
    // 尝试多种方式聚焦输入框
    const inputElement =
      renameInputRef.value.input || renameInputRef.value.$el?.querySelector("input");
    if (inputElement) {
      inputElement.focus();
      return true;
    } else {
      // 备用方案：直接调用组件的 focus 方法
      try {
        renameInputRef.value.focus();
        return true;
      } catch (error) {
        return false;
      }
    }
  }
  return false;
};

// 监听重命名对话框显示状态，自动聚焦输入框
watch(renameDialogVisible, async (visible) => {
  if (visible) {
    setTimeout(() => {
      focusRenameInput();
    }, 200);
  } else {
    setTimeout(() => {
      // 对话框关闭时清空保存的引用
      if (!visible && renameTargetNode.value) {
        renameTargetNode.value = null;
      }
    }, 200);
  }
});

// 处理删除
const handleDelete = () => {
  if (!contextMenuTarget.value) return;

  // 设置删除目标节点
  deleteTargetNode.value = contextMenuTarget.value;
  deleteDialogVisible.value = true;
  hideContextMenu();
};

// 确认删除
const confirmDelete = () => {
  if (!deleteTargetNode.value) {
    deleteDialogVisible.value = false;
    return;
  }

  // 从树数据中递归查找并删除目标节点
  const deleteNodeFromTree = (nodes: FileTreeNode[], targetNode: FileTreeNode): boolean => {

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      // 如果找到目标节点，直接删除
      if (node.id === targetNode.id) {
        nodes.splice(i, 1);
        return true;
      }

      // 如果当前节点有子节点，递归查找
      if (node.children && node.children.length > 0) {
        if (deleteNodeFromTree(node.children, targetNode)) {
          return true;
        }
      }
    }
    return false;
  };

  // 执行删除操作
  if (deleteNodeFromTree(treeData.value || [], deleteTargetNode.value)) {
    // 触发响应式更新
    forceTreeDataUpdate();

    // 添加埋点：删除操作
    trackingEditPageLeftSidebarOperation(
      "delete",
      deleteTargetNode.value.isDirectory ? "Folder" : "File",
      {
        item_name: deleteTargetNode.value.label,
      }
    );

    // 如果删除的是当前选中的节点，清空选中状态
    if (deleteTargetNode.value.id === currentKey.value) {
      currentKey.value = "";
    }
    if (deleteTargetNode.value.id === currentEditingId.value) {
      currentEditingId.value = "";
    }
  } else {
    ElMessage.error("删除失败：未找到目标节点");
  }
  deleteDialogVisible.value = false;
  setTimeout(() => {
    deleteTargetNode.value = null;
  }, 200);
};

// 取消删除
const cancelDelete = () => {
  deleteDialogVisible.value = false;
  setTimeout(() => {
    deleteTargetNode.value = null;
  }, 200);
};

// 处理顶部操作按钮点击
const handleHeaderAction = (action: string, event?: Event) => {
  // 阻止事件冒泡，避免触发 handleClickOutside
  if (event) {
    event.stopPropagation();
  }
  switch (action) {
    case "addFile":
      handleAddFileByTop();
      break;
    case "addFolder":
      handleAddFolderByTop();
      break;
    default:
      console.warn("未知的操作类型:", action);
  }
};

// 添加文件（根据currentNode决定位置）
const handleAddFileByTop = () => {
  if (!treeData.value) {
    console.error("treeData 不存在");
    return;
  }

  const baseLabel = "新文件";
  let newPath: string[];
  let newNode: FileTreeNode;

  if (currentNode.value && currentNode.value.isDirectory) {
    // 如果有currentNode且是目录，在currentNode下创建
    const uniqueLabel = generateUniqueNodeName(currentNode.value, baseLabel, false);
    newPath = [...currentNode.value.path, uniqueLabel + ".md"];
    newNode = {
      id: newPath.join("/"),
      key: newPath.join("-"),
      label: uniqueLabel,
      content: "",
      isDirectory: false,
      path: newPath,
      fileType: "md",
      children: [],
    };
    // 添加到currentNode的children中
    currentNode.value.children.push(newNode);
  } else {
    // 如果没有currentNode或currentNode不是目录，在根级别创建
    const uniqueLabel = generateUniqueNodeName(null, baseLabel, false);
    newPath = [uniqueLabel + ".md"];
    newNode = {
      id: newPath.join("/"),
      key: newPath.join("-"),
      label: uniqueLabel,
      content: "",
      isDirectory: false,
      path: newPath,
      fileType: "md",
      children: [],
    };

    // 添加到根级别
    treeData.value.push(newNode);
  }

  // 触发响应式更新
  treeData.value = [...(treeData.value || [])];

  // 设置新创建的节点为当前选中节点
  // 先设置 currentNode，避免 watch 监听器重新查找
  currentKey.value = newNode.id;

  // 添加埋点：底部按钮在根目录添加文件
  trackingEditPageLeftSidebarOperation("add", "File", {
    parent_folder: "root",
  });
};

// 添加文件夹（根据currentNode决定位置）
const handleAddFolderByTop = () => {
  if (!treeData.value) {
    console.error("treeData 不存在");
    return;
  }

  const baseLabel = "新文件夹";
  let newPath: string[];
  let newNode: FileTreeNode;

  if (currentNode.value && currentNode.value.isDirectory) {
    // 如果有currentNode且是目录，在currentNode下创建
    const uniqueLabel = generateUniqueNodeName(currentNode.value, baseLabel, true);
    newPath = [...currentNode.value.path, uniqueLabel];
    newNode = {
      id: newPath.join("/"),
      key: newPath.join("-"),
      label: uniqueLabel,
      content: "",
      isDirectory: true,
      path: newPath,
      fileType: "directory",
      children: [],
    };
    // 添加到currentNode的children中
    currentNode.value.children.push(newNode);
  } else {
    // 如果没有currentNode或currentNode不是目录，在根级别创建
    const uniqueLabel = generateUniqueNodeName(null, baseLabel, true);
    newPath = [uniqueLabel];
    newNode = {
      id: newPath.join("/"),
      key: newPath.join("-"),
      label: uniqueLabel,
      content: "",
      isDirectory: true,
      path: newPath,
      fileType: "directory",
      children: [],
    };
    // 添加到根级别
    treeData.value.push(newNode);
  }
  // 触发响应式更新
  treeData.value = [...(treeData.value || [])];

  // 添加埋点：底部按钮在根目录添加文件夹
  trackingEditPageLeftSidebarOperation("add", "Folder", {
    parent_folder: "root",
  });
};

// 暴露给父组件的方法
const setCurrentKey = (key: string) => {
  currentKey.value = key;
  if (treeRef.value) {
    treeRef.value.setCurrentKey(key);
  }
};

const getCurrentKey = () => {
  return currentKey.value;
};

const getNode = (key: string) => {
  if (treeRef.value) {
    return treeRef.value.getNode();
  }
  return null;
};

const setExpandedKeys = (keys: string[]) => {
  if (treeRef.value) {
    treeRef.value.setExpandedKeys(keys);
  }
};

const getExpandedKeys = () => {
  if (treeRef.value) {
    return treeRef.value.getExpandedKeys();
  }
  return [];
};

const getIcon = (data: FileTreeNode): string => {
  if (data.isDirectory) {
    return "&#xe620;";
  } else if (!data.fileType) {
    return "&#xe624;";
  } else {
    switch (data.fileType) {
      case "md":
        return "&#xe624;";
      case "jpg":
        return "&#xe624;";
      case "jpeg":
        return "&#xe624;";
      case "gif":
        return "&#xe624;";
      default:
        return "&#xe624;";
    }
  }
};

const showTagSelectDialog = ref(false);


// 暴露方法给父组件
defineExpose({
  setCurrentKey,
  getCurrentKey,
  getNode,
  setExpandedKeys,
  getExpandedKeys,
});
</script>

<template>
  <div class="editor-tree-sidebar">
    <div class="editor-tree-sidebar-info">
      <el-input
        v-if="isEditingTitle"
        ref="titleInputRef"
        v-model="editingTitleValue"
        maxlength="30"
        class="work-info-title-input"
        @blur="handleTitleBlur"
        @keydown="handleTitleKeydown"
        @click="handleWorkTitleClick"
      />
      <div
        v-else
        class="work-info-title truncate"
        @click="handleWorkTitleClick"
        :title="'点击编辑作品名称'"
      >
        {{ workInfo.title }}
      </div>
      <div
        class="tags-group"
        ref="tagsGroupRef"
        @mousedown="handleTagsMouseDown"
        @mousemove="handleTagsMouseMove"
        @mouseup="stopTagsDragging"
        @mouseleave="stopTagsDragging"
      >
        <div
          v-for="tag in workInfo.workTags"
          :key="tag.id"
          class="tag"
        >
          {{ tag.name }}
        </div>
        <el-button
          class="check-tags-btn"
          link
          @click="showTagSelectDialog = true"
        >
          编辑标签
        </el-button>
      </div>
    </div>

    <el-tree
      ref="treeRef"
      class="editor-tree-sidebar-tree"
      node-key="id"
      :data="treeData"
      :default-expand-all="defaultExpandAll"
      :draggable="draggable"
      :allow-drag="() => draggable"
      :allow-drop="() => draggable"
      @node-click="handleNodeClick"
      @current-change="handleCurrentChange"
    >
      <template #default="{ node, data }: { node: any, data: FileTreeNode }">
        <div
          :class="{
            'custom-tree-node': true,
            'right-clicked': rightClickedNode === data,
            'directory-node': data.isDirectory,
          }"
          :draggable="draggable"
          @dragstart="handleDragStart($event, data)"
          @dragend="handleDragEnd($event, data)"
          @dragenter="handleDragEnter($event, data)"
          @dragleave="handleDragLeave($event, data)"
          @dragover="handleDragOver($event, data)"
          @drop="handleDrop($event, data)"
          @contextmenu="handleContextMenu($event, data)"
        >
          <!-- 图标 -->
          <div class="iconfont tree-node-icon" v-html="getIcon(data)"/>
          <!-- 节点标签容器 -->
          <div class="tree-node-label-wrapper">
            <div class="tree-node-label">{{ node.label }}</div>
            <!-- new标识 - 只在文件节点显示，悬浮在右上方 -->
            <span
              v-if="!data.isDirectory && data.new"
              class="new-indicator"
            >
              new
            </span>
          </div>
          <!-- 操作按钮区域 -->
          <div v-if="data.isDirectory" class="tree-node-actions">
            <el-button
              type="primary" class="action-btn add-btn"
              @click="handleAddNode($event, data)" title="添加文件"
            >
              +
            </el-button>
          </div>
        </div>
      </template>
    </el-tree>

    <div class="el-tree-sidebar-bottom">
      <el-button
        class="sidebar-bottom-btn iconfont shadow-sm"
        type="primary"
        title="添加文件夹"
        @click="handleAddFolderByTop"
      >
        &#xe62d;
      </el-button>

      <el-button
        class="sidebar-bottom-btn iconfont shadow-sm"
        type="primary"
        title="添加文件"
        @click="handleAddFileByTop"
      >
        &#xe62c;
      </el-button>

      <el-popover
        trigger="click"
        :show-arrow="false"
        popper-class="editor-sidebar-export-popover"
      >
        <template #reference>
          <el-button
            class="sidebar-bottom-btn iconfont shadow-sm"
            type="primary"
            title="导出作品"
          >
            &#xe62e;
          </el-button>
        </template>
        <ExportWorkMenu/>

      </el-popover>

    </div>

    <!-- 重命名对话框 -->
    <el-dialog
      v-model="renameDialogVisible"
      title="重命名"
      width="400px"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
    >
      <div class="rename-dialog-content">
        <p class="dialog-label">重命名 {{ renameTargetNode?.isDirectory ? "文件夹" : "文件" }}：</p>
        <el-input
          v-model="renameInputValue"
          placeholder="请输入新名称"
          maxlength="50"
          show-word-limit
          @keyup.enter="confirmRename"
          @keyup.escape="cancelRename"
          ref="renameInputRef"
          clearable
        />
        <p class="dialog-tip" v-if="!renameTargetNode?.isDirectory">注意：文件扩展名将自动保持</p>
      </div>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="cancelRename">取消</el-button>
          <el-button type="primary" @click="confirmRename" :disabled="!renameInputValue.trim()">
            确定
          </el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 删除确认对话框 -->
    <el-dialog
      v-model="deleteDialogVisible"
      title="删除确认"
      width="400px"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
    >
      <div class="delete-dialog-content">
        <div class="warning-icon">
          <el-icon size="24" color="#f56c6c">
            <WarningFilled/>
          </el-icon>
        </div>
        <div class="warning-text">
          <p>
            确定要删除 <strong>"{{ deleteTargetNode?.label }}"</strong> 吗？
          </p>
          <p class="warning-tip">此操作不可撤销，请谨慎操作。</p>
        </div>
      </div>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="cancelDelete">取消</el-button>
          <el-button type="danger" @click="confirmDelete"> 确定删除</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 右键菜单 -->
    <div
      v-if="contextMenuVisible"
      class="context-menu"
      :style="{ left: contextMenuPosition.x + 'px', top: contextMenuPosition.y + 'px' }"
      @click.stop
    >
      <!-- 目录节点的菜单 -->
      <template v-if="contextMenuTarget?.isDirectory">
        <div class="context-menu-item" @click="handleAddFolder">
          <span>添加文件夹</span>
        </div>
        <div class="context-menu-item" @click="handleAddFile">
          <span>添加文件</span>
        </div>
        <div class="context-menu-divider"/>

      </template>
      <div class="context-menu-item" @click="addToChat">
        <span>添加到对话</span>
      </div>
      <div class="context-menu-item" @click="handleRename">
        <span>重命名</span>
      </div>
      <div class="context-menu-item" @click="handleDelete">
        <span>删除</span>
      </div>
    </div>
  </div>

  <TagSelectDialog v-model="showTagSelectDialog"/>

</template>

<style scoped lang="less">
.editor-tree-sidebar {
  background: var(--bg-primary);
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  --tree-node-hover-bg: #fffef9;

  .editor-tree-sidebar-info {
    border-bottom: 1px solid var(--border-color);
    padding-bottom: 8px;

    .work-info-title {
      border-radius: 6px;
      line-height: 32px;
      font-size: 20px;
      padding: 0 4px;
      cursor: pointer;
      user-select: none;

      &:hover {
        background: var(--bg-tertiary);
      }
    }

    .work-info-title-input {
      :deep(.el-input__wrapper) {
        padding: 0 4px;
        box-shadow: none;
        background: transparent;
        border: none;
        border-radius: 0;
      }

      :deep(.el-input__inner) {
        font-size: 20px;
        line-height: 32px;
        height: 32px;
        padding: 0;
      }
    }

    .tags-group {
      margin-top: 4px;
      display: flex;
      align-items: center;
      gap: 4px;
      overflow-x: scroll;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;
      -ms-overflow-style: none;
      cursor: grab;

      &::-webkit-scrollbar {
        display: none;
      }

      &.is-dragging {
        cursor: grabbing;
        user-select: none;
      }

      .tag {
        flex-shrink: 0;
        border-radius: 4px;
        padding: 2px 6px;
        font-size: 10px;
        background: var(--bg-tertiary);
      }

      .check-tags-btn {
        font-size: 12px;
        text-decoration: underline;
      }
    }
  }


  .el-tree-sidebar-header {
    height: 40px;
    display: flex;
    align-items: center;
    background: var(--bg-secondary);
    flex-shrink: 0;
    padding: 8px 16px;
    transition: background-color 0.2s;

    .header-actions {
      gap: 4px;
      margin-left: auto;
      display: flex;

      .header-actions-btn {
        width: 32px;
        height: 32px;
        cursor: pointer;
        color: var(--text-muted);
        background: 0 0;
        border: none;
        border-radius: 4px;
        justify-content: center;
        align-items: center;
        transition: background-color 0.2s;
        display: flex;

        .iconfont {
          font-size: 24px !important;
        }
      }

      .header-actions-btn:hover {
        background: var(--bg-hover);
        border-color: var(--accent-color);
        color: var(--accent-color);
      }

      .header-actions-btn:active {
        background: var(--bg-active);
        transform: scale(0.95);
      }
    }
  }

  .editor-tree-sidebar-tree {
    margin-top: 8px;

    &.el-tree {
      flex: 1;
    }
  }

  .el-tree-sidebar-bottom {
    display: flex;
    align-items: center;
    padding: 10px;
    justify-content: center;
    gap: 20px;

    :deep(.sidebar-bottom-btn) {
      --el-color-primary-light-5: #ffffff;
      padding: 0;
      width: 40px;
      height: 40px;
      border-radius: 40px;
      line-height: 40px;
      text-align: center;
      font-size: 24px;
      --el-color-primary: #6c6c6c;
      background: #ffffff;
      flex-shrink: 0;
      color: #000000;
      border: none;

      &:hover {
        opacity: 1;
        background: #d3d3d3;
      }

      &:active {
        background: #b1b1b1;
      }
    }
  }
}

.custom-tree-node {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s ease;
  cursor: pointer;
  user-select: none;

  /* 拖拽相关样式 */

  &.dragging {
    opacity: 0.5;
    transform: scale(0.95);
  }

  /* 拖拽时的光标样式 */

  &[draggable="true"] {
    cursor: grab;

    &:active {
      cursor: grabbing;
    }
  }

  /* 目录节点的光标样式（表示可点击展开/折叠） */

  &.directory-node {
    cursor: pointer;
  }

  .tree-node-label-wrapper {
    margin-left: 4px;
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 4px;
    overflow: hidden;
  }

  .tree-node-label {
    display: inline-block;
    max-width: calc(100% - 50px);
    font-size: 14px;
    color: var(--el-text-color-primary);
    line-height: 1.4;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    vertical-align: top;
  }

  .new-indicator {
    flex-shrink: 0;
    font-size: 10px;
    color: #f56c6c;
    font-weight: 500;
    text-transform: lowercase;
    user-select: none;
    white-space: nowrap;
    line-height: 1;
    align-self: flex-start;
    margin-top: 2px;
  }

  .tree-node-actions {
    display: flex;
    align-items: center;
    opacity: 0;
    transition: opacity 0.2s ease;
  }

  &:hover {
    .action-btn {
      color: white;
    }
  }

  .action-btn {
    padding: 0;
    margin-left: 8px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.2s ease;
    user-select: none;

  }
}

.custom-tree-node:hover .tree-node-actions {
  opacity: 1;
}

.node-actions-slot {
  display: flex;
  align-items: center;
  gap: 4px;
}

:deep(.el-tree) {
  background: var(--bg-primary);

  .el-tree-node__children {
    padding-left: 0;
  }

  .el-tree-node__content {
    border-radius: 10px;

    .tree-node-label {
      color: var(--text-primary);
    }
  }

  .el-tree-node.is-current > .el-tree-node__content {
    background: var(--tree-node-hover-bg);

    .tree-node-label {
      color: var(--text-primary);
    }
  }

  .el-tree-node__content:hover {
    background-color: var(--tree-node-hover-bg);
  }

  .el-tree-node:focus > .el-tree-node__content {
    background: var(--bg-primary);
  }

  .el-tree-node.is-current:focus > .el-tree-node__content {
    background: var(--tree-node-hover-bg);
  }

  .el-tree-node:has(> .el-tree-node__content > .right-clicked):not(.is-current)
  > .el-tree-node__content {
    background: var(--tree-node-hover-bg) !important;
  }

  /* 目录节点不显示选中状态 */

  .el-tree-node:has(.directory-node).is-current > .el-tree-node__content {
    background: transparent;

    .tree-node-label {
      color: var(--text-primary);
    }
  }

  /* 目录节点 hover 时显示浅色背景 */

  .el-tree-node__content:has(.directory-node):hover {
    background-color: var(--tree-node-hover-bg) !important;
  }
}

:deep(.el-tree-node.is-current > .el-tree-node__content .tree-node-label) {
  color: white;
}

/* 目录节点的文字颜色保持不变（不变成白色） */
:deep(.el-tree-node.is-current > .el-tree-node__content .directory-node .tree-node-label) {
  color: var(--text-primary);
}

/* 展开/收起图标样式 */
:deep(.el-tree-node__expand-icon) {
  color: var(--el-text-color-secondary);
  transition: all 0.2s ease;
}

:deep(.el-tree-node__expand-icon:hover) {
  color: var(--el-color-primary);
}

:deep(.el-tree-node.is-current > .el-tree-node__content .el-tree-node__expand-icon) {
  color: white;
}

/* 目录节点的展开图标保持正常颜色 */
:deep(.el-tree-node:has(.directory-node).is-current > .el-tree-node__content .el-tree-node__expand-icon) {
  color: var(--el-text-color-secondary);
}

/* 节点内容样式 */
:deep(.el-tree-node__content) {
  padding: 0;
  height: auto;
  min-height: 32px;
  border-radius: 4px;
  transition: all 0.2s ease;
}

/* 层级缩进 */
:deep(.el-tree-node__children) {
  padding-left: 16px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .custom-tree-node {
    padding: 6px 8px;
    min-height: 36px;
  }

  .tree-node-label {
    font-size: 13px;
  }

  .tree-node-actions {
    margin-left: 6px;
  }
}

/* 滚动条样式 */
:deep(.el-tree) {
  height: 100%;
  overflow-y: auto;
}

:deep(.el-tree::-webkit-scrollbar) {
  width: 6px;
}

:deep(.el-tree::-webkit-scrollbar-track) {
  background: var(--el-fill-color-lighter);
  border-radius: 3px;
}

:deep(.el-tree::-webkit-scrollbar-thumb) {
  background: var(--el-border-color);
  border-radius: 3px;
}

:deep(.el-tree::-webkit-scrollbar-thumb:hover) {
  background: var(--el-text-color-secondary);
}

/* 右键菜单样式 */
.context-menu {
  position: fixed;
  background: var(--bg-dialog);
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
  z-index: 2000;
  min-width: 120px;
  padding: 4px;

  .context-menu-item {
    border-radius: 4px;
    overflow: hidden;
    padding: 4px 16px;
    cursor: pointer;
    font-size: 14px;
    color: #606266;

    &:hover {
      background-color: var(--bg-hover);
    }
  }

  .context-menu-divider {
    height: 1px;
    background-color: #e4e7ed;
    margin: 4px 0;
  }
}

/* 对话框样式 */
.rename-dialog-content {
  .dialog-label {
    margin: 0 0 12px 0;
    font-size: 14px;
    color: var(--el-text-color-primary);
  }

  .dialog-tip {
    margin: 8px 0 0 0;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }
}

.delete-dialog-content {
  display: flex;
  align-items: flex-start;
  gap: 12px;

  .warning-icon {
    flex-shrink: 0;
    margin-top: 2px;
  }

  .warning-text {
    flex: 1;

    p {
      margin: 0 0 8px 0;
      font-size: 14px;
      color: var(--el-text-color-primary);

      &:last-child {
        margin-bottom: 0;
      }
    }

    .warning-tip {
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }
  }
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>

<style>
.editor-sidebar-export-popover {
  width: 170px !important;
  padding: 8px !important;
}

</style>
