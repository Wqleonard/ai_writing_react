import { createApp, h, ref } from 'vue'
import LoginDialog from './index.vue'
import ElementPlus, { ElMessage } from 'element-plus'
import '@/assets/element-css.css'

/**
 * 登录结果
 */
export interface LoginResult {
  success: boolean
  message?: string
}

/**
 * 打开登录对话框
 * @returns Promise，resolve 时表示登录成功，reject 时表示用户取消或关闭对话框
 */
 const showLoginDialog = async (): Promise<LoginResult> => {
  // 动态导入 router 和 mainPinia 避免循环依赖
  const { default: router } = await import('@/router')
  const { mainPinia } = await import('@/main')

  return new Promise((resolve, reject) => {
    // 创建容器元素
    const container = document.createElement('div')
    document.body.appendChild(container)

    // 创建 Vue 应用实例
    const app = createApp({
      setup() {
        const model = ref(true)
        let isResolved = false

        // 处理登录成功
        const handleLoginSuccess = () => {
          console.log('登录成功 handleLoginSuccess')
          if (isResolved) return
          isResolved = true
          // 先关闭对话框
          model.value = false
          ElMessage.success({
            message: '登录成功',
            offset: 20
          })
          // 延迟销毁，确保动画完成
          setTimeout(() => {
            app.unmount()
            document.body.removeChild(container)
            // 在销毁后 resolve，确保所有清理工作完成
            resolve({
              success: true,
              message: '登录成功'
            })
          }, 300)
        }

        const handleLoginFailed = () => {
          console.log('登录失败 handleLoginFailed')
        }

        // 处理对话框关闭（通过 v-model 变化）
        const handleDialogClose = (val: boolean | undefined) => {
          model.value = val ?? false
          // 如果对话框被关闭且还未 resolve，则 reject
          if (!val && !isResolved) {
            isResolved = true
            // 延迟销毁，确保动画完成
            setTimeout(() => {
              app.unmount()
              document.body.removeChild(container)
              // 在销毁后 reject，确保所有清理工作完成
              reject(new Error('用户关闭对话框'))
            }, 300)
          }
        }

        return () => h(LoginDialog, {
          modelValue: model.value,
          'onUpdate:modelValue': handleDialogClose,
          onLoginSuccess: handleLoginSuccess,
          onLoginFailed: handleLoginFailed,
        })
      }
    })

    // 使用 Element Plus、Pinia 和 Router
    app.use(ElementPlus)
    app.use(mainPinia)
    app.use(router)

    // 挂载应用
    app.mount(container)
  })
}

export default showLoginDialog
