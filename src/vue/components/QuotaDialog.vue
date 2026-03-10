<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { getInvitationCodeReq, getUserBalanceReq } from '@/api/users'
import closeIcon from '@/assets/images/quota/close.svg'
import topUpIcon from '@/assets/images/quota/top_up.svg'
import exchangeIcon from '@/assets/images/quota/exchange.svg'
import invitationIcon from '@/assets/images/quota/invitation.svg'
//import innerSideIcon from '@/assets/images/quota/inner_side.svg'
import separateWhiteIcon from '@/assets/images/quota/separate_white.svg'
import separateYellowIcon from '@/assets/images/quota/separate_yellow.svg'
import quotaBackImg from '@/assets/images/quota/quota_back.png'
import ExchangeDialog from './ExchangeDialog.vue'
import UsageDetailsDialog from './UsageDetailsDialog.vue'

const model = defineModel<boolean>()

// 额度数据：每日免费 已用/总量万、固定额度万
const dailyFreeUsed = ref(0)  //余额
const dailyFreeTotal = ref(1000000 / 1000) //每日免费固定50万
const fixedQuota = ref(0) // 万 固定额度

// 邀请记录：累计获赠积分万、邀请人数
const bonusPoints = ref(0) // 万
const inviteeCount = ref(0)

// 邀请链接（不可输入，复制用）
const invitationLink = ref('https://baowenmao.com')

// 兑换弹层
const showExchangeDialog = ref(false)
// 使用情况弹层
const showUsageDetailsDialog = ref(false)

const closeDialog = () => {
  model.value = false
}

// 充值：点击提示暂未开放
const handleTopUp = () => {
  ElMessage.info('暂未开放')
}

// 兑换：打开兑换弹层
const handleOpenExchange = () => {
  showExchangeDialog.value = true
}

// 使用情况：打开使用情况弹层
const handleOpenUsageDetails = () => {
  showUsageDetailsDialog.value = true
}

// 使用情况弹层右上角关闭：关闭使用情况 + 额度弹层
const handleCloseAllDialogs = () => {
  showUsageDetailsDialog.value = false
  model.value = false
}

// 复制：把左侧框(不可输入)的内容复制到剪切板
const handleCopyLink = async () => {
  try {
    await navigator.clipboard.writeText(invitationLink.value)
    ElMessage.success('邀请链接已复制到剪贴板')
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = invitationLink.value
    document.body.appendChild(textarea)
    textarea.select()
    try {
      document.execCommand('copy')
      ElMessage.success('邀请链接已复制到剪贴板')
    } catch {
      ElMessage.error('复制失败，请手动复制')
    }
    document.body.removeChild(textarea)
  }
}

const updateQuota = async () => {
  try {
    const res: any = await getUserBalanceReq()
    if (res?.dailyFreeToken != null && typeof res.dailyFreeToken === 'number' && !isNaN(res.dailyFreeToken)) {
      dailyFreeUsed.value = parseFloat((res.dailyFreeToken / 1000).toFixed(0));
    }
    if (res?.token != null && typeof res.token === 'number' && !isNaN(res.token)) {
      fixedQuota.value = parseFloat((res.token / 1000).toFixed(0))
    }
    // if (res?.bonusPoints != null) bonusPoints.value = res.bonusPoints
    // if (res?.inviteeCount != null) inviteeCount.value = res.inviteeCount
  } catch {
    // 保持默认
  }
}

const updateInvitation = async () => {
  try {
    const res: any = await getInvitationCodeReq()
    // 接口返回数据：{ code, invitationNumber, link, token }
    if (res?.code) {
      // 使用当前域名拼接邀请链接
      invitationLink.value = `${window.location.origin}?invitationCode=${res.code}`
    }
    // 设置邀请人数
    if (res?.invitationNumber != null && typeof res.invitationNumber === 'number' && !isNaN(res.invitationNumber)) {
      inviteeCount.value = res.invitationNumber
    }
    // 设置累计获赠积分（token 除以 10000，参照额度处理方式）
    if (res?.token != null && typeof res.token === 'number' && !isNaN(res.token)) {
      bonusPoints.value = parseFloat((res.token / 1000).toFixed(0))
    }
  } catch {
    // 使用默认链接
  }
}


watch(model, async (newVal) => {
  if (newVal) {
    await updateQuota()
    await updateInvitation()
  }
})
</script>

<template>
  <el-dialog
    :model-value="model"
    :show-close="false"
    :close-on-click-modal="false"
    align-center
    @close="closeDialog" class="quota-dialog"
  >
    <template #header>
      <div class="dialog-header">
        <h2 class="dialog-title">额度</h2>
        <button class="close-btn" aria-label="关闭" @click="closeDialog">
          <img :src="closeIcon" alt="关闭"/>
        </button>
      </div>
    </template>
    <div class="quota-content">
      <!-- 主额度区块：quota_back.png 做背景，内测版右上叠盖且稍靠里 -->
      <div class="quota-main">
        <!-- <div class="beta-badge">
          <div class="beta-badge-content"><img :src="innerSideIcon" alt="" class="beta-icon" />
            <span>内测版</span>
          </div>
        </div> -->
        <img :src="quotaBackImg" alt="" class="quota-back-image" aria-hidden="true"/>
        <div class="position-card"></div>
        <div class="quota-card">
          <div class="quota-left">
            <div class="big-num">
              {{ dailyFreeUsed }}/{{ dailyFreeTotal }}
            </div>
            <div class="sub">（内测每日积分）</div>
          </div>
          <img :src="separateWhiteIcon" alt="" class="sep" aria-hidden="true"/>
          <div class="quota-right">
            <div class="big-num">{{ fixedQuota }}</div>
            <div class="sub">（固定积分）</div>
          </div>
        </div>
        <div class="action-btns">
          <button class="action-btn" @click="handleTopUp">
            <img :src="topUpIcon" alt=""/>
            <span>充值</span>
          </button>
          <img :src="separateYellowIcon" class="sep-y" alt="">
          <button class="action-btn" @click="handleOpenExchange">
            <img :src="exchangeIcon" alt=""/>
            <span>兑换</span>
          </button>
        </div>
      </div>

      <!-- 分割线 -->
      <div class="divider"/>

      <!-- 邀请记录 -->
      <div class="invite-section">
        <div class="invite-title">
          <img :src="invitationIcon" alt="" class="invite-icon"/>
          <span>邀请记录</span>
        </div>
        <div class="invite-card">
          <div class="invite-left">
            <div class="invite-num">{{ bonusPoints }}</div>
            <div class="invite-label">（累计获赠积分）</div>
          </div>
          <img :src="separateYellowIcon" alt="" class="sep-yellow" aria-hidden="true"/>
          <div class="invite-right">
            <div class="invite-num">{{ inviteeCount }}<span class="unit">人</span></div>
            <div class="invite-label">（邀请人数）</div>
          </div>
        </div>
        <div class="share-desc">分享邀请链接，新用户注册每人可获得200积分</div>
        <div class="link-row">
          <input :value="invitationLink" type="text" class="link-input" readonly/>
          <button class="copy-btn" @click="handleCopyLink">复制</button>
        </div>
        <!-- 分隔线 + 使用情况 -->
        <div class="usage-divider"/>
        <div class="usage-row">
          <div class="usage-item" @click="handleOpenUsageDetails">
            <span class="iconfont usage-icon" title="使用情况">&#xe619;</span>
            <span>使用情况</span>
          </div>
        </div>
      </div>
    </div>
  </el-dialog>

  <ExchangeDialog v-model="showExchangeDialog" @success="updateQuota"/>
  <UsageDetailsDialog v-model="showUsageDetailsDialog" @close-all="handleCloseAllDialogs"/>
</template>

<style lang="less">
/* 弹层 teleport 到 body，scoped 无法作用到挂载在 body 的节点，需单独未 scoped 的样式 */

.el-dialog.quota-dialog {
  --el-dialog-width: 722px;
  border-radius: 20px;
  padding: 0;
  overflow: visible;

  .el-dialog__header {
    padding: 35px;
    margin: 0;
  }
}
</style>

<style scoped lang="less">
.dialog-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  width: 100%;
}

.dialog-title {
  margin: 0;
  margin-left: 17px;
  margin-top: 22px;
  font-size: 36px;
  font-weight: 700;
  color: transparent;
  background: linear-gradient(90deg, #efaf00 0%, #ff9500 100%);
  -webkit-background-clip: text;
  background-clip: text;
  line-height: 1.32;
}

.close-btn {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;

  img {
    width: 22px;
    height: 22px;
    opacity: 0.8;
  }
}

.quota-content {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 69px;

  .quota-main {
    position: relative;
    margin-top: 9px;
    width: 100%;

    /* 内测版：右上叠盖，稍微靠里 */

    .beta-badge {
      position: absolute;
      top: 4px;
      right: 6px;
      display: flex;
      flex-direction: row;
      justify-content: flex-end;
      align-items: flex-start;
      width: 400px;
      height: 150px;
      padding: 7px 27px;
      border-radius: 10px;
      background: #fff;
      border: 1px solid #ff9500;
      background-clip: padding-box;

      .beta-badge-content {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 7px;
      }

      // &::before {
      //   content: '';
      //   position: absolute;
      //   inset: 0;
      //   border-radius: 10px;
      //   padding: 1px;
      //   background: linear-gradient(90deg, #efaf00 0%, #ff9500 100%);
      //   -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      //   mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      //   -webkit-mask-composite: xor;
      //   mask-composite: exclude;
      //   pointer-events: none;
      // }

      .beta-icon {
        width: 21px;
        height: 21px;
      }

      span {
        font-size: 20px;
        font-weight: 700;
        color: transparent;
        background: linear-gradient(90deg, #efaf00 0%, #ff9500 100%);
        -webkit-background-clip: text;
        background-clip: text;
      }
    }

    .quota-back-image {
      width: 100%;
      position: absolute;
      left: 0;
      top: 0;
      // height: 186px;
      aspect-ratio: 195/62;
      object-fit: cover;
      z-index: 1;
    }

    .position-card {
      width: 100%;
      aspect-ratio: 195/62;
    }

    .quota-card {
      position: absolute;
      left: 0;
      top: 0;
      width: 100%;
      aspect-ratio: 195/62;
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: center;
      z-index: 2;

      .quota-left,
      .quota-right {
        flex: 1;
        margin-top: 15px;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
      }


      .big-num {
        font-size: 40px;
        font-weight: 700;
        color: #fff;
        line-height: 1.32;

        .unit {
          font-size: 20px;
          font-weight: 400;
        }
      }

      .sub {
        font-size: 16px;
        color: rgba(255, 255, 255, 0.8);
        line-height: 1.32;
        margin-top: 10px;
      }

      .sep {
        width: 2px;
        height: 67px;
        flex-shrink: 0;
        margin: 0 24px;
        align-self: center;
      }
    }

    .action-btns {
      display: flex;
      height: 54px;
      width: 100%;
      flex-direction: row;
      border-bottom-left-radius: 20px;
      border-bottom-right-radius: 20px;
      border-bottom: 1px solid #EFAF00;
      border-left: 1px solid #EFAF00;
      border-right: 1px solid #EFAF00;
      justify-content: center;
      align-items: center;

      .sep-y {
        width: 1px;
        height: 39px;
      }

      .action-btn {
        display: flex;
        align-items: center;
        flex-direction: row;
        justify-content: center;
        flex: 1;
        gap: 6px;
        padding: 0;
        border: none;
        background: none;
        font-size: 20px;
        font-weight: 400;
        color: #9a9a9a;
        cursor: pointer;
        line-height: 1.32;

        img {
          width: 21px;
          height: 21px;
        }

        &:last-child img {
          width: 26px;
          height: 24px;
        }
      }
    }
  }

  .divider {
    height: 1px;
    width: 100%;
    background: #dadada;
    opacity: 0.5;
    margin: 33px 0 20px 0;
  }

  .invite-section {
    width: 100%;
    padding-left: 6px;

    .invite-title {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 20px;

      .invite-icon {
        width: 24px;
        height: 26px;
      }

      span {
        font-size: 20px;
        font-weight: 700;
        color: transparent;
        background: linear-gradient(90deg, #efaf00 0%, #ff9500 100%);
        -webkit-background-clip: text;
        background-clip: text;
      }
    }

    .invite-card {
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 20px;
      position: relative;
      height: 122px;
      width: 100%;
      border-radius: 20px;
      border: 1px solid transparent;
      background: linear-gradient(180deg, #fff8e5 0%, #fff 100%);
      background-clip: padding-box;

      &::before {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: 20px;
        padding: 1px;
        background: linear-gradient(90deg, #efaf00 0%, #ff9500 100%);
        mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
        -webkit-mask-composite: xor;
        mask-composite: exclude;
        pointer-events: none;
      }


      .invite-left,
      .invite-right {
        display: flex;
        flex: 1;
        flex-direction: column;
        align-items: center;
        text-align: center;
      }


      .invite-num {
        font-size: 24px;
        font-weight: 400;
        color: #464646;
        line-height: 1.32;

        .unit {
          font-size: 15px;
        }
      }

      .invite-label {
        font-size: 13px;
        color: #999;
        margin-top: 11px;
        line-height: 1.32;
      }

      .sep-yellow {
        width: 1px;
        height: 48px;
        flex-shrink: 0;
      }
    }

    .share-desc {
      font-size: 14px;
      color: #999;
      line-height: 1.32;
      margin-bottom: 14px;
    }

    .link-row {
      display: flex;
      align-items: center;
      gap: 19px;
      height: 43px;
      margin-bottom: 20px;

      .link-input {
        flex: 1;
        height: 43px;
        padding: 0 13px;
        border: none;
        border-radius: 10px;
        background: #f5f5f5;
        font-size: 16px;
        color: #999;
        outline: none;
        cursor: default;
      }

      .copy-btn {
        flex-shrink: 0;
        width: 68px;
        height: 37px;
        border: none;
        border-radius: 10px;
        background: linear-gradient(90deg, #efaf00 0%, #ff9500 100%);
        font-size: 18px;
        font-weight: 400;
        color: #fff;
        cursor: pointer;
        line-height: 1.32;
      }
    }

    .usage-divider {
      height: 1px;
      width: 100%;
      background: #dadada;
      opacity: 0.5;
      margin: 0 0 20px 0;
    }

    .usage-row {
      display: flex;
      align-items: center;
      gap: 24px;
      margin-bottom: 58px;
    }

    .usage-item {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      font-size: 16px;
      font-weight: 400;
      color: #9a9a9a;
      line-height: 1.32;

      .usage-icon {
        font-size: 20px;
        color: #9a9a9a;
      }

      &:hover {
        color: #ff9500;

        .usage-icon {
          color: #ff9500;
        }
      }
    }
  }
}
</style>
