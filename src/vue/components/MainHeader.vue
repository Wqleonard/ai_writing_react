<script setup lang="ts">
import { ref, onMounted, defineAsyncComponent, nextTick } from "vue";
import { useLoginStore } from "@/vue/stores/login.ts";
import { storeToRefs } from "pinia";
import { ElMessage } from "element-plus";
import { useThemeStore } from "@/vue/stores/theme.ts";
import showLoginDialog from "./LoginDialog/showLoginDialog.ts";
import { useChatInputStore } from "@/vue/stores/chatInput.ts";
import { useRoute, useRouter } from "vue-router";
import { showNotesSelectorDialog } from '@/utils/showNotesSelectorDialog';

// 动态引入对话框组件
const AccountDialog = defineAsyncComponent(() => import("./AccountDialog.vue"));
const QuotaDialog = defineAsyncComponent(() => import("./QuotaDialog.vue"));

const showInsiteMessage = ref(false)

const loginStore = useLoginStore()
const { isLoggedIn, avatarData } = storeToRefs(loginStore)

// 处理用户头像点击
const handleUserClick = async () => {
  if (!isLoggedIn.value) {
    try {
      const result = await showLoginDialog()
    } catch (error) {
      console.log('用户取消登录', error)
    }
  }
}
// 退出登录
const handleLogout = () => {
  visible.value = false
  loginStore.logout()
  ElMessage.success({
    message: '退出登录成功',
    type: 'success',
  })
  // 可以添加其他退出后的逻辑，比如跳转到首页
}

const visible = ref(false)

// 账号对话框
const showAccountDialog = ref(false)

// 打开账号对话框
const openAccountDialog = () => {
  visible.value = false
  showAccountDialog.value = true
}

// 额度对话框
const showQuotaDialog = ref(false)

// 打开额度对话框
const openQuotaDialog = () => {
  visible.value = false
  showQuotaDialog.value = true
}

// 用户中心对话框（备用，用于替换下方 popover 内容）
const showUserCenterDialog = ref(false)

const route = useRoute();
const router = useRouter();
// 笔记相关
const chatInputStore = useChatInputStore();

// 处理笔记点击
const handleNotesClick = async () => {
  try {
    // 调用笔记选择器弹层（内部会自动从 chatInputStore 获取已选中的笔记）
    const result = await showNotesSelectorDialog();

    // 处理选中的笔记
    if (result.success && result.notes.length > 0) {
      // 先清空已选中的笔记
      chatInputStore.selectedNotes.forEach((note) => {
        chatInputStore.removeNote(note.id);
      });

      // 检查当前是否在我的空间页面，如果不在则先切换路由
      if (route.name !== "workspace") {
        // 先切换路由，等待路由切换完成后再添加笔记
        await router.replace({ name: "workspace" });
        // 等待下一个 tick 确保组件已挂载
        await nextTick();
        // 再等待一小段时间确保 my-place 的 onMounted 已执行完 clearAll
      }
      await new Promise(resolve => setTimeout(resolve, 200));
      // 添加新选中的笔记（在路由切换完成后）
      result.notes.forEach((note) => {
        chatInputStore.addNote(note);
      });
    } else if (result.success && result.notes.length === 0) {
      // 如果用户确认但没有选中任何笔记，清空所有已选中的笔记
      // 检查当前是否在我的空间页面，如果不在则先切换路由
      if (route.name !== "workspace") {
        await router.replace({ name: "workspace" });
      }
      await new Promise(resolve => setTimeout(resolve, 200));
      // 在路由切换完成后清空笔记
      chatInputStore.clearSelectedNotes();
    }
  } catch (error) {
    // 用户取消或关闭对话框，不做任何操作
    console.log("笔记选择已取消");
  }
};

const themeStore = useThemeStore()
onMounted(() => {
  themeStore.initTheme()
})


</script>

<template>
  <div class="main-header flex gap-1 items-center">
    <el-tooltip content="笔记管理">
      <div class="el-only-child-wrapper">
        <div
          class="iconfont cursor-pointer w-6 h-6 text-center leading-6 rounded-sm overflow-hidden hover:bg-[#e4e4e4]"
          @click="handleNotesClick">
          &#xe644;
        </div>
      </div>
    </el-tooltip>
    <div class="w-[1px] h-4.5 bg-[#dedede] my-1"></div>

    <InsiteMessage v-model="showInsiteMessage"/>

    <!-- 未登录状态：显示登录按钮 -->
    <div
      v-if="!isLoggedIn"
      class="rounded-full cursor-pointer w-6 h-6 text-center leading-6 iconfont text-xl! ml-3"
      @click="handleUserClick"
    >
      &#xe60b;
    </div>

    <!-- 已登录状态：显示用户头像和退出登录弹窗 -->
    <el-popover
      v-else placement="bottom-end"
      trigger="click"
      popper-class="user-menu-popover"
      v-model:visible="visible"
    >
      <template #reference>
        <div class="el-only-child-wrapper">
          <div
            class="rounded-full cursor-pointer w-6 h-6 flex items-center justify-center overflow-hidden outline-1 outline-[#dedede] ml-3">
            <img :src="avatarData" alt=""/>
          </div>
        </div>
      </template>
      <div class="user-menu-content">
        <!-- 原方式：账号 / 额度 / 退出登录，保留备用 -->
        <div class="menu-item" @click="openAccountDialog">账号</div>
        <div class="menu-item" @click="openQuotaDialog">额度</div>
        <div class="menu-item logout" @click="handleLogout">退出登录</div>
      </div>
    </el-popover>

    <!-- 账号对话框 -->
    <AccountDialog v-model="showAccountDialog"/>

    <!-- 额度对话框 -->
    <QuotaDialog v-model="showQuotaDialog"/>

    <!-- 用户中心对话框：修改个人资料 -> openAccountDialog，退出登录 -> handleLogout -->
    <UserCenterDialog
      v-model="showUserCenterDialog"
      @edit-profile="openAccountDialog"
      @logout="handleLogout"
    />
  </div>
</template>

<style scoped lang="less">
.main-header {
  .qa {
    color: var(--text-secondary);
    cursor: pointer;

    &:hover {
      color: var(--text-primary);
    }
  }

  .points-layout {
    color: var(--text-secondary);
    background: var(--bg-primary);
    border: 1px solid var(--border-color);

    .btn-get {
      color: var(--text-primary);
    }
  }
}

.user-menu-content {
  display: flex;
  flex-direction: column;
}

.menu-item {
  padding: 8px 16px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s ease;
}

.menu-item:hover {
  background-color: #f5f5f5;
}

.menu-item.logout {
  color: #ef4444;
}

.menu-item.logout:hover {
  background-color: #fef2f2;
}

/* 二维码对话框样式 */
:deep(.el-dialog) {
  &.feedback-dialog {
    --el-dialog-width: 332px;
    min-height: 260px;

    .el-dialog__header {
      padding-right: 0;

      .el-dialog__title {
        font-size: 16px;
        font-weight: 500;
      }
    }

    .el-textarea__inner {
      resize: none;
      border: 2px solid var(--theme-color);
      border-radius: 10px;
      padding: 12px;
      font-size: 14px;
      line-height: 1.6;
      box-shadow: none;

      &:focus {
        border: 2px solid var(--theme-color);
        box-shadow: none;
      }
    }

    .qr-code-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }

    .qr-code-text {
      text-align: center;
      color: var(--text-secondary);
      font-size: 14px;
      line-height: 1.8;
    }

    .qr-code-wrapper {
      display: flex;
      justify-content: center;
      align-items: center;
      width: 108px;
      height: 108px;

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
    }
  }

}
</style>

<style>
/* 用户菜单弹窗样式 */
.user-menu-popover {
  width: 120px !important;
  min-width: 120px !important;
  padding: 8px 0;
}
</style>
