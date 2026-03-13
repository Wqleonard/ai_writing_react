import { defineStore } from "pinia";
import { ref } from "vue";
import { ElMessage } from "element-plus";
import { postSuggestsReq } from "@/api/users.ts";

/**
 * 问题反馈弹层全局状态，供侧边栏、消息差评等任意位置打开同一弹层
 */
export const useFeedbackDialogStore = defineStore("feedbackDialog", () => {
  const visible = ref(false);
  const showQrCode = ref(false);
  const content = ref("");

  const openFeedbackDialog = () => {
    visible.value = true;
    showQrCode.value = false;
    content.value = "";
  };

  const closeFeedbackDialog = () => {
    visible.value = false;
    showQrCode.value = false;
    content.value = "";
  };

  const submitFeedback = async () => {
    const suggest = content.value.trim();
    if (!suggest) {
      ElMessage.warning("请先输入反馈内容");
      return;
    }
    try {
      const req = await postSuggestsReq(suggest);
      if (req?.content) {
        showQrCode.value = true;
        content.value = "";
      }
    } catch (e) {
      console.error(e);
    }
  };

  return {
    visible,
    showQrCode,
    content,
    openFeedbackDialog,
    closeFeedbackDialog,
    submitFeedback,
  };
});
