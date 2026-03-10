<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useLoginStore } from '@/stores/login.ts'
import { storeToRefs } from 'pinia'
import { ElMessage } from 'element-plus'
import { updateUserInfo, updatePassword, getUserInfoReq } from "@/api/users.ts";

interface Props {
  modelValue: boolean
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const loginStore = useLoginStore()
const { userInfo } = storeToRefs(loginStore)
const { avatarData } = loginStore

const isEditingNickname = ref(false)
const editingNickname = ref('')
const maxNicknameLength = 20

const isEditingPwd = ref(false)
const editingPassWord = ref('******')

const passwordEditDialog = ref(false)

// 监听对话框打开，初始化编辑状态
watch(() => props.modelValue, (newVal) => {
  if (newVal) {
    getUserInfoReq().then((res: any) => {
      userInfo.value = res
      editingNickname.value = userInfo.value?.nickName || ''
      localStorage.setItem('userInfo', JSON.stringify(userInfo.value))
    })
    isEditingNickname.value = false
    editingNickname.value = userInfo.value?.nickName || ''
  }
})

// 关闭对话框
const closeDialog = () => {
  emit('update:modelValue', false)
  isEditingNickname.value = false
  editingNickname.value = ''
}

// 开始编辑昵称
const startEditNickname = () => {
  isEditingNickname.value = true
  editingNickname.value = userInfo.value?.nickName || ''
}

// 取消编辑昵称
const cancelEditNickname = () => {
  isEditingNickname.value = false
  editingNickname.value = userInfo.value?.nickName || ''
}

// 确认保存昵称
const confirmEditNickname = async () => {
  if (editingNickname.value.trim()) {
    // TODO: 调用API更新昵称
    if (userInfo.value) {
      userInfo.value.nickName = editingNickname.value.trim()
      const userInfoReq = await updateUserInfo({
        nickName: userInfo.value.nickName,
      })
      userInfo.value = userInfoReq
      localStorage.setItem('userInfo', JSON.stringify(userInfo.value))
    }
    ElMessage.success('昵称修改成功')
    isEditingNickname.value = false
  } else {
    ElMessage.warning('昵称不能为空')
  }
}

// 开始编辑密码
const startEditPassword = () => {
  passwordEditDialog.value = true
  resetPasswordForm()
}

// 密码表单数据
const passwordForm = ref({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
  verificationCode: '' // 验证码字段
})

// 验证码相关
const smsCountdown = ref(0)
const canSendSms = computed(() => smsCountdown.value === 0)
const smsButtonText = computed(() => {
  if (smsCountdown.value > 0) {
    return `${smsCountdown.value}秒后重试`
  }
  return '获取验证码'
})

// 发送验证码（暂时注释，功能未实现）
const handleSendVerificationCode = async () => {
  if (!canSendSms.value) return

  // TODO: 调用API发送验证码
  // try {
  //   await sendSmsCode(userInfo.value?.phone)
  //   ElMessage.success('验证码已发送')
  //   smsCountdown.value = 60
  //   const timer = setInterval(() => {
  //     smsCountdown.value--
  //     if (smsCountdown.value <= 0) {
  //       clearInterval(timer)
  //     }
  //   }, 1000)
  // } catch (error) {
  //   ElMessage.error('发送验证码失败')
  // }

  ElMessage.info('获取验证码功能暂未开放')
}

// 密码表单引用
const passwordFormRef = ref()

// 检查表单字段是否有值
const hasAllFieldsFilled = computed(() => {
  return (
    passwordForm.value.currentPassword.trim() !== '' &&
    passwordForm.value.newPassword.trim() !== '' &&
    passwordForm.value.confirmPassword.trim() !== ''
    // && passwordForm.value.verificationCode.trim() !== '' // 验证码字段暂时不校验
  )
})

// 表单验证错误状态
const formHasErrors = ref(false)

// 监听表单字段变化，实时验证
watch(
  () => [
    passwordForm.value.currentPassword,
    passwordForm.value.newPassword,
    passwordForm.value.confirmPassword
  ],
  async () => {
    if (!passwordFormRef.value) return

    // 如果所有字段都有值，进行验证
    if (hasAllFieldsFilled.value) {
      try {
        // 只验证必需的三个字段：当前密码、新密码、确认新密码
        await Promise.all([
          passwordFormRef.value.validateField('currentPassword'),
          passwordFormRef.value.validateField('newPassword'),
          passwordFormRef.value.validateField('confirmPassword')
        ])
        formHasErrors.value = false
      } catch (error) {
        // 验证失败，说明有错误
        formHasErrors.value = true
      }
    } else {
      // 如果有字段为空，重置错误状态（按钮会因 hasAllFieldsFilled 为 false 而禁用）
      formHasErrors.value = false
    }
  },
  { immediate: false, deep: true }
)

// 判断更新密码按钮是否应该禁用
const isUpdatePasswordDisabled = computed(() => {
  return !hasAllFieldsFilled.value || formHasErrors.value
})

// 密码验证规则
const passwordRules = {
  currentPassword: [
    { required: true, message: '请输入当前密码', trigger: 'change' }
  ],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'change' },
    { min: 6, message: '密码长度不能少于6位', trigger: 'change' }
  ],
  confirmPassword: [
    { required: true, message: '请再次输入新密码', trigger: 'change' },
    {
      validator: (rule: any, value: string, callback: Function) => {
        if (value !== passwordForm.value.newPassword) {
          callback(new Error('两次输入的密码不一致'))
        } else {
          callback()
        }
      },
      trigger: 'change'
    }
  ],
  verificationCode: [
    // 验证码为可选字段，暂时不设置必填验证
    // { required: true, message: '请输入验证码', trigger: 'change' },
    { pattern: /^\d{6}$|^$/, message: '请输入6位数字验证码', trigger: 'change' }
  ]
}

// 重置密码表单
const resetPasswordForm = () => {
  passwordForm.value = {
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    verificationCode: ''
  }
  smsCountdown.value = 0
  formHasErrors.value = false
  passwordFormRef.value?.clearValidate()
}

// 关闭密码修改对话框
const closePasswordDialog = () => {
  passwordEditDialog.value = false
  resetPasswordForm()
}

// 提交密码修改
const handleUpdatePassword = async () => {
  if (!passwordFormRef.value) return

  try {
    // 只验证必需的三个字段：当前密码、新密码、确认新密码
    await Promise.all([
      passwordFormRef.value.validateField('currentPassword'),
      passwordFormRef.value.validateField('newPassword'),
      passwordFormRef.value.validateField('confirmPassword')
    ])

    // 验证通过，调用接口
    try {
      const updateRes = await updatePassword(passwordForm.value.currentPassword, passwordForm.value.newPassword)
      console.log(updateRes)
      ElMessage.success('密码修改成功')
      closePasswordDialog()
    } catch (error: any) {
      // ElMessage.error(error?.message || '密码修改失败，请重试')
    }
  } catch (error) {
    // 验证失败，不执行提交
    console.log('表单验证失败')
  }
}

const editingPhone = ref(userInfo.value?.phone || '')
// 修改手机号
const handleModifyPhone = () => {
  ElMessage.info('手机号修改功能开发中')
}

</script>

<template>
  <el-dialog :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)"
    :close-on-click-modal="false" append-to-body align-center @close="closeDialog" class="account-dialog">
    <template #header>
      <div class="account-dialog-header">
        <div class="account-title">账号</div>
        <i class="iconfont icon-BtnGuideClose close-icon" @click="closeDialog"></i>
      </div>
    </template>
    <div class="account-content">
      <!-- 头像 -->
      <div class="info-section">
        <div class="info-left">
          <div class="info-label">头像</div>
        </div>
        <div class="info-right">
          <div class="avatar-placeholder">
            <img :src="avatarData" alt="" class="user-avatar" />
          </div>
        </div>
      </div>

      <!-- 用户昵称 -->
      <div class="info-section">
        <div class="info-left">
          <div class="info-label">用户昵称</div>
          <div class="info-subtitle">您的个人资料名称</div>
        </div>
        <div class="info-right">
          <!-- 非编辑状态 -->
          <div v-if="!isEditingNickname" class="info-display-wrapper">
            <span class="info-display-text">{{ userInfo?.nickName || '未设置' }}</span>
            <i class="iconfont icon-edit edit-icon" @click="startEditNickname"></i>
          </div>
          <!-- 编辑状态 -->
          <div v-else class="info-edit-wrapper">
            <div class="info-edit-input-group">
              <el-input v-model="editingNickname" :maxlength="maxNicknameLength" placeholder="请输入用户昵称"
                class="info-edit-input">
                <template #suffix>
                  <span class="char-counter">{{ editingNickname.length }}/{{ maxNicknameLength }}</span>
                </template>
              </el-input>
            </div>
            <div class="info-edit-actions">
              <el-button class="cancel-btn" @click="cancelEditNickname">取消</el-button>
              <el-button type="primary" class="confirm-btn" @click="confirmEditNickname">确定</el-button>
            </div>
          </div>
        </div>
      </div>

      <!-- 手机号 -->
      <div class="info-section">
        <div class="info-left">
          <div class="info-label">手机号</div>
          <div class="info-subtitle">您的个人手机号</div>
        </div>
        <div class="info-right">
          <div class="info-display-wrapper">
            <span class="info-display-text">{{ userInfo?.phone || '未设置' }}</span>
            <!-- <span class="edit-icon-placeholder"></span> -->
          </div>
        </div>
      </div>

      <!-- 密码 -->
      <!-- <div class="info-section">
        <div class="info-left">
          <div class="info-label">密码</div>
          <div class="info-subtitle">您的账号密码</div>
        </div>
        <div class="info-right">
          <div class="info-display-wrapper">
            <span class="info-display-text">************</span>
            <i class="iconfont icon-edit edit-icon" @click="startEditPassword"></i>
          </div>
        </div>
      </div> -->
    </div>
  </el-dialog>

  <el-dialog align-center append-to-body class="password-change-dialog" v-model="passwordEditDialog"
    :close-on-click-modal="false" @close="closePasswordDialog">
    <template #header>
      <div class="password-dialog-header">
        <div class="password-title">修改密码</div>
        <i class="iconfont icon-BtnGuideClose close-icon" @click="closePasswordDialog"></i>
      </div>
    </template>
    <div class="password-dialog-content">
      <!-- <p class="password-dialog-subtitle">请输入当前密码和新密码来更新您的账户密码</p> -->
      <el-form ref="passwordFormRef" :model="passwordForm" :rules="passwordRules" label-position="top">
        <!-- 手机号（只读显示） -->
        <el-form-item label="手机号">
          <el-input :model-value="userInfo?.phone || '未设置'" disabled class="password-form-input" />
        </el-form-item>
        <!-- 验证码 暂时注释-->
        <!-- <el-form-item label="验证码" prop="verificationCode">
          <div class="verification-code-wrapper">
            <el-input v-model="passwordForm.verificationCode" placeholder="请输入验证码" maxlength="6"
              class="password-form-input verification-code-input" />
            <el-button :disabled="!canSendSms" @click="handleSendVerificationCode" class="verification-code-btn"
              type="primary">
              {{ smsButtonText }}
            </el-button>
          </div>
        </el-form-item> -->
        <!-- 当前密码 -->
        <el-form-item label="当前密码" prop="currentPassword">
          <el-input v-model="passwordForm.currentPassword" type="password" placeholder="请输入当前密码" show-password
            class="password-form-input" />
        </el-form-item>
        <!-- 设置密码 -->
        <el-form-item label="设置密码" prop="newPassword">
          <el-input v-model="passwordForm.newPassword" type="password" placeholder="请输入你的密码" show-password
            class="password-form-input" />
        </el-form-item>
        <!-- 重新输入密码 -->
        <el-form-item label="重新输入密码" prop="confirmPassword">
          <el-input v-model="passwordForm.confirmPassword" type="password" placeholder="请输入你的密码" show-password
            class="password-form-input" />
        </el-form-item>
      </el-form>
    </div>
    <template #footer>
      <div class="password-dialog-footer">
        <el-button class="password-dialog-btn cancel-btn" @click="closePasswordDialog">
          取消
        </el-button>
        <el-button class="password-dialog-btn confirm-btn" type="primary" :disabled="isUpdatePasswordDisabled"
          @click="handleUpdatePassword">
          确定
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<style lang="less">
/* 弹层 teleport 到 body，scoped 无法作用到挂载在 body 的节点，需单独未 scoped 的样式 */

.el-dialog.account-dialog {
  border-radius: 20px;
  padding: 0;
  overflow: visible;

  .el-dialog__header {
    padding: 32px 32px 0 32px;
    margin: 0;
  }
}

.el-dialog.password-change-dialog {
  border-radius: 20px;
  padding: 0;
  overflow: visible;

  .el-dialog__header {
    padding: 32px 32px 0 32px;
    margin: 0;
    position: relative;
  }

  .el-dialog__headerbtn {
    display: none;
  }

  .el-dialog__body {
    padding: 0 32px;
  }

  .el-dialog__footer {
    padding: 0 32px 32px 32px;
  }
}
</style>

<style scoped lang="less">
.account-dialog-header {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  width: 100%;
  padding: 0;

  .account-title {
    font-size: 36px;
    font-weight: 600;
    margin-top: 5px;
    background: linear-gradient(135deg, #EFAF00 0%, #FF9500 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .close-icon {
    font-size: 22px;
    color: #464646;
    width: 22px;
    height: 22px;
    cursor: pointer;
    transition: color 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;

    &:hover {
      color: #606266;
    }
  }
}

.account-content {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 0px 32px 32px 32px;

  .info-section {
    width: 100%;
    display: flex;
    align-items: center;
    padding: 20px 0;
    border-bottom: 1px solid #e4e7ed;

    &:last-child {
      border-bottom: none;
    }

    .info-left {
      min-width: 140px;
      display: flex;
      flex-direction: column;
      gap: 4px;

      .info-label {
        font-size: 18px;
        font-weight: 400;
        color: var(--text-primary);
      }

      .info-subtitle {
        font-size: 14px;
        color: #909399;
        line-height: 1.5;
      }
    }

    .info-right {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      min-height: 40px;

      .avatar-placeholder {
        width: 80px;
        height: 80px;
        border-radius: 50%;
        overflow: hidden;
        display: flex;
        justify-content: center;
        align-items: center;
        border: 1px solid #dedede;
        background: #f5f5f5;

        .user-avatar {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
      }

      .info-display-wrapper {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 200px;
        justify-content: flex-end;

        .info-display-text {
          font-size: 16px;
          color: var(--text-primary);
          line-height: 1.5;
        }

        .edit-icon {
          font-size: 16px;
          color: #909399;
          cursor: pointer;
          transition: color 0.2s;

          &:hover {
            color: var(--el-color-primary);
          }
        }

        .edit-icon-placeholder {
          width: 16px;
          height: 16px;
        }
      }

      .info-edit-wrapper {
        display: flex;
        align-items: center;
        gap: 12px;
        width: 100%;
        max-width: 500px;
        justify-content: flex-end;

        .info-edit-input-group {
          flex: 1;
          max-width: 280px;

          .info-edit-input {
            width: 100%;

            :deep(.el-input__wrapper) {
              // padding-right: 50px;
              // padding: 5px 10px;
              border-radius: 10px;
            }

            :deep(.el-input__suffix) {
              right: 10px;
            }

            .char-counter {
              font-size: 12px;
              color: #909399;
              white-space: nowrap;
              padding-left: 4px;
            }
          }
        }

        .info-edit-actions {
          display: flex;
          align-items: center;
          // gap: 12px;
          flex-shrink: 0;

          .cancel-btn {
            padding: 6px 10px;
            font-size: 14px;
            color: #606266;
            background: #fff;
            border: 1px solid #dcdfe6;
            border-radius: 10px;

            &:hover {
              color: var(--el-color-primary);
              border-color: var(--el-color-primary);
            }
          }

          .confirm-btn {
            padding: 6px 10px;
            font-size: 14px;
            border-radius: 10px;
          }
        }
      }
    }
  }
}

.password-dialog-header {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  width: 100%;
  padding: 0;

  .password-title {
    font-size: 36px;
    font-weight: 600;
    margin-top: 5px;
    background: linear-gradient(135deg, #EFAF00 0%, #FF9500 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .close-icon {
    font-size: 22px;
    color: #464646;
    width: 22px;
    height: 22px;
    cursor: pointer;
    transition: color 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;

    &:hover {
      color: #606266;
    }
  }
}

.password-dialog-content {
  padding: 24px 0;

  .password-dialog-subtitle {
    margin: 0 0 24px 0;
    font-size: 14px;
    color: #909399;
    line-height: 1.5;
  }

  .password-form-input {
    :deep(.el-input__wrapper) {
      border-radius: 10px;
      height: 50px;
    }

    :deep(.el-input.is-disabled .el-input__wrapper) {
      background: transparent;
      cursor: default;
    }
  }

  .verification-code-wrapper {
    display: flex;
    width: 100%;
    gap: 12px;
    align-items: center;

    .verification-code-input {
      flex: 1;
    }

    .verification-code-btn {
      flex-shrink: 0;
      width: 170px;
      height: 50px;
      font-size: 14px;
      font-weight: 700;
      border-radius: 10px;
      white-space: nowrap;
      background: linear-gradient(135deg, #EFAF00 0%, #FF9500 100%);
      border: none;

      &:hover {
        background: linear-gradient(135deg, #FF9500 0%, #FFB340 100%);
      }

      &:disabled {
        background: #dcdfe6;
        color: #c0c4cc;
      }
    }
  }
}

.password-dialog-footer {
  display: flex;
  flex-direction: row;
  gap: 12px;
  justify-content: center;

  .password-dialog-btn {
    margin: 0;
    width: 140px;
    height: 50px;
    font-size: 14px;
    border-radius: 10px;
    // min-width: 80px;

    &.cancel-btn {
      background: #fff;
      border: 1px solid #dcdfe6;
      color: #606266;

      &:hover {
        color: var(--el-color-primary);
        border-color: var(--el-color-primary);
      }
    }

    &.confirm-btn {
      background: linear-gradient(135deg, #EFAF00 0%, #FF9500 100%);
      font-weight: 700;
      border: none;

      &:hover {
        background: linear-gradient(135deg, #FF9500 0%, #FFB340 100%);
      }

      &:disabled {
        background: #dcdfe6;
        color: #c0c4cc;
      }
    }
  }
}
</style>
<style>
.el-dialog {
  &.account-dialog {
    --el-dialog-width: 722px;

    .el-dialog__headerbtn {
      display: none;
    }
  }

  &.password-change-dialog {
    --el-dialog-width: 722px;

    .el-form {
      .el-form-item {
        margin-bottom: 20px;

        .el-form-item__label {
          margin-bottom: 0;
          padding-bottom: 8px;
          font-size: 14px;
          font-weight: 500;
          color: #303133;
          line-height: 1.5;
        }
      }
    }
  }
}
</style>
