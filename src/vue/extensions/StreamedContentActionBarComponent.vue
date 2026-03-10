<template>
  <NodeViewWrapper class="streamed-content-action-bar-wrapper">
    <div class="action-bar" :class="{'editing': editing}">
      <template v-if="!editing">
        <div @click="handleEdit" class="action-bar-btn edit-btn">
          编辑
        </div>
        <div @click="handleRegenerate" class="action-bar-btn regenerate-btn">
          重新生成
        </div>
        <div @click="handleReject" class="action-bar-btn reject-btn">
          拒绝
        </div>
        <div @click="handleAccept" type="danger" class="action-bar-btn accept-btn">
          接受
        </div>
        <!--        <div class="accept-btn-wrapper action-bar-btn">-->
        <!--          <div @click="handleAcceptAndContinue" type="danger" class="accept-btn">-->
        <!--            接受并继续-->
        <!--          </div>-->
        <!--          <el-popover-->
        <!--            v-model:visible="popoverVisible"-->
        <!--            placement="top-end"-->
        <!--            :width="150"-->
        <!--            trigger="click"-->
        <!--            popper-class="accept-dropdown-popover"-->
        <!--          >-->
        <!--            <template #reference>-->
        <!--              <div class="dropdown-icon-wrapper iconfont">-->
        <!--                &#xeaa1;-->
        <!--              </div>-->
        <!--            </template>-->
        <!--            <div class="dropdown-menu">-->
        <!--              <div-->
        <!--                v-for="option in optionsRef"-->
        <!--                :key="option.value"-->
        <!--                class="dropdown-item"-->
        <!--                :class="{ active: selectedOption === option.value }"-->
        <!--                @click="selectOption(option.value)"-->
        <!--              >-->
        <!--                <div class="option-text">{{ option.label }}</div>-->
        <!--                <div v-if="selectedOption === option.value" class="iconfont">&#xe60f;</div>-->
        <!--              </div>-->
        <!--            </div>-->
        <!--          </el-popover>-->
        <!--        </div>-->
      </template>
      <template v-else>
        <div class="action-bar-btn" @click="handleEditingCancel">取消</div>
        <div class="action-bar-btn" @click="handleEditingConfirm">确认</div>
      </template>
    </div>
  </NodeViewWrapper>
</template>

<script setup lang="ts">
import {ref} from 'vue'
import {NodeViewWrapper} from '@tiptap/vue-3'
import {ElPopover} from 'element-plus'

interface Props {
  node: {
    attrs: {
      streamedContentRange?: {
        from: number
        to: number
      }
      selectedOption?: 'chapter' | 'para' | 'once'
    }
  }
  editor: any
  deleteNode: () => void
}

const props = defineProps<Props>()

const editing = ref(false)

// 选项列表
interface OptionItem {
  value: 'chapter' | 'para' | 'once'
  label: string
}

const optionsRef = ref<OptionItem[]>([
  {value: 'chapter', label: '每次输出整篇后确认'},
  {value: 'para', label: '每次输出200字后确认'},
  // {value: 'once', label: '一次性输出,不再确认'}
])

// 选中的选项，从 node.attrs 中读取初始值，如果没有则默认为 'chapter'
const selectedOption = ref<'chapter' | 'para' | 'once'>(
  props.node.attrs.selectedOption || 'chapter'
)
// Popover 显示状态
const popoverVisible = ref(false)

// 选择选项
const selectOption = (option: 'chapter' | 'para' | 'once') => {
  selectedOption.value = option
  // 更新 node 的 attrs，以便持久化选择（虽然操作栏会被删除，但保持一致性）
  if (props.editor && props.node) {
    props.editor.commands.updateAttributes('streamedContentActionBar', {
      selectedOption: option
    })
  }
  // 关闭 popover
  popoverVisible.value = false
  // 这里可以根据选择的选项执行相应的逻辑
  console.log('选择的选项:', option)
}

// 从扩展的 storage 中获取事件处理函数
// 注意：不再传递 range 参数，由 WorkflowGenerate 内部维护
const handleEdit = () => {
  const storage = props.editor.storage.streamedContentActionBar
  if (storage?.onEdit) {
    storage.onEdit()
  }
  editing.value = true
}

const handleRegenerate = () => {
  const storage = props.editor.storage.streamedContentActionBar
  if (storage?.onRegenerate) {
    storage.onRegenerate()
  }
}

const handleReject = () => {
  const storage = props.editor.storage.streamedContentActionBar
  if (storage?.onReject) {
    storage.onReject()
  }
}

const handleAccept = () => {
  const storage = props.editor.storage.streamedContentActionBar
  if (storage?.onAccept) {
    // 传递 selectedOption，但不传递 range
    storage.onAccept(selectedOption.value)
  }
}

// const handleAcceptAndContinue = () => {
//   const storage = props.editor.storage.streamedContentActionBar
//   if (storage?.onAccept) {
//     storage.onAccept(selectedOption.value)
//   }
// }

const handleEditingCancel = () => {
  const storage = props.editor.storage.streamedContentActionBar
  if (storage?.onEditingCancel) {
    storage.onEditingCancel()
  }
  editing.value = false
}

const handleEditingConfirm = () => {
  const storage = props.editor.storage.streamedContentActionBar
  if (storage?.onEditingConfirm) {
    storage.onEditingConfirm()
  }
  editing.value = false
}
</script>

<style scoped lang="less">
.streamed-content-action-bar-wrapper {
  .action-bar {
    display: flex;
    gap: 10px;
    height: 48px;
    align-items: center;
    justify-content: flex-end;

    &.editing {
      .action-bar-btn {
        color: #000000;
        background: transparent;
        border: 1px solid #000000;

        &:hover {
          background: transparent;
        }
      }
    }

    .action-bar-btn {
      padding: 4px 8px;
      font-size: 14px;
      border-radius: 4px;
      background: #ff0000;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      cursor: pointer;
      line-height: 1;
      height: 28px;

      &:hover {
        background: #ff4d4d;
      }
    }

    .accept-btn-wrapper {
      position: relative;
      display: flex;
      align-items: center;
      overflow: hidden;

      .accept-btn {
        color: #ffffff;
        padding-right: 4px;
      }

      .dropdown-icon-wrapper {
        display: flex;
        align-items: center;
        justify-content: center;

        .dropdown-icon {
          color: #fff;
          font-size: 16px;
        }
      }
    }
  }
}

</style>

<style lang="less">
// 全局样式，用于 el-popover 的内容
.accept-dropdown-popover {
  padding: 4px !important;
  background: #ffffff !important;

  .dropdown-menu {
    padding: 4px 0;
    background: #ffffff;

    .dropdown-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 2px 4px;
      cursor: pointer;
      transition: background-color 0.2s;
      border-radius: 6px;

      &:hover {
        background-color: #f1f1f1;
      }

      .option-text {
        font-size: 12px;
        color: var(--text-primary);
      }

      .check-icon {
        color: var(--text-primary);
        font-size: 16px;
      }
    }
  }
}
</style>

