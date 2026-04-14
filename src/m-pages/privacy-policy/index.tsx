import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

export default function MPrivacyPolicyPage() {
  const navigate = useNavigate()

  const handleBack = useCallback(() => {
    navigate('/m/rules')
  }, [navigate])

  return (
    <div className="w-full h-dvh flex flex-col bg-[#f3f3f3]">
      {/* 顶部栏 */}
      <div className="h-22 px-9 flex items-center justify-between shrink-0">
        <div
          className="iconfont text-[40px]! w-10 h-10 leading-10 active:bg-[#e5e5e5] rounded-md cursor-pointer"
          onClick={handleBack}
        >
          &#xeaa2;
        </div>
        <div className="text-[36px] text-[#464646]">隐私政策</div>
        <div />
      </div>

      {/* 隐私政策内容 */}
      <div className="flex-1 overflow-y-auto p-8 bg-white">
        <div className="page-agreement text-[28px] leading-[1.6] text-[#333]">
          <p className="font-bold mb-4">隐私政策</p>
          <p className="font-bold mb-2">引言</p>
          <p className="mb-2">
            爆文猫写作（以下简称"本软件"）是由浙江盛趣科技有限公司（以下或简称"我们"）为用户（以下或简称"您"）提供的产品及服务。我们重视用户个人信息和隐私的保护，根据《中华人民共和国个人信息保护法》、《中华人民共和国数据安全法》等相关法律法规制定本政策并保护您的个人信息和隐私安全。我们希望通过本政策向您说明您的哪些信息可能会被收集、收集这些信息的目的、我们及您如何保护这些信息的安全。
          </p>
          <p className="mb-2">
            <strong>请您在使用本软件前，仔细阅读本政策（尤其是加粗的内容）并确认了解我们对您个人信息的处理规则。如您对本政策有任何疑问，可联系我们进行咨询。</strong>
          </p>
          <p className="mb-2">
            请您放心，我们会始终遵循<strong>最小必要原则（最小影响、最小范围、最短时间）</strong>处理您的个人信息，不会因为您想要使用我们的产品和服务而过度收集您的个人信息。
          </p>

          <p className="font-bold mt-4 mb-2">一、我们如何收集和使用您的个人信息</p>
          <p className="mb-2">1. 收集和使用的原则</p>
          <p className="mb-2">我们在处理您个人信息时会严格遵循合法、正当、必要、诚信的原则。</p>
          <p className="mb-2">2. 个人信息和个人敏感信息的定义</p>
          <p className="mb-2">
            <strong>个人信息</strong>是指以电子或其他方式记录的能够单独或者与其他信息结合识别特定自然人身份或者反映特定自然人活动情况的各种信息。<strong>个人敏感信息包括身份证照片、生物识别信息、宗教信仰信息、特定身份信息、金融账户信息、征信信息、行踪轨迹信息、医疗健康信息、不满 14 周岁未成年人的个人信息等</strong>。<strong>对个人敏感信息，我们用"加粗"的书写方式进行特别提醒，希望您在阅读时特别关注。</strong>
          </p>

          <p className="font-bold mt-4 mb-2">3. 我们收集信息的方式、种类和目的</p>
          <p className="mb-2">收集个人信息的主要来源有：您主动向我们提供的信息、我们在您使用本软件过程中获取的信息。</p>
          <p className="mb-2">
            <strong>3.1 您主动提供</strong>
          </p>
          <p className="mb-2">
            <strong>3.1.1 账号注册、登录</strong>
          </p>
          <p className="mb-2">
            <strong>为向您提供账号注册、登录功能及服务，在您通过以下方式注册或登录本软件时，您需要提供如下账号注册信息：</strong>
          </p>
          <p className="mb-2">
            （1）手机号码登录：当您选择使用<strong>手机号码</strong>方式登录时，我们会从移动运营商处获取您的手机号码及该号码所属的运营商信息。
          </p>
          <p className="mb-2">
            （2）第三方跳转登录：您可以使用第三方账号登录，主要包括微信、QQ 账号，当您授权使用前述第三方账号登录时，我们会收集从第三方账号共享的<strong>头像、昵称</strong>及其他您在第三方授权登录界面同意授予的信息。
          </p>
          <p className="mb-2">
            收集前述这些信息的目的在于：（1）通过账号管理更好地为您提供服务；（2）如您提供真实有效的手机号码进行绑定，当您遇到账号丢失、忘记密码问题时，可以便捷地找回账号和密码。
          </p>
          <p className="mb-2">
            <strong>如您不提供上述信息，不注册、登录账号，将可能会影响您使用本软件的如下功能：机器辅助文字续写、机器对话及文档编辑等功能。</strong>
          </p>

          <p className="mb-2">
            <strong>3.1.2 智能对话</strong>
          </p>
          <p className="mb-2">
            在您使用写作创作等智能对话功能时，本软件需要获取您已输入的<strong>文本、图片、文件、语音/音频信息</strong>并完成机器续写，以便为您提供续写服务。
          </p>
          <p className="mb-2">
            对话信息有助于我们为您提供服务、优化模型，并了解您的需求和偏好，以便为您提供更精准的服务和支持。
          </p>

          <p className="mb-2">
            <strong>3.2 我们主动收集</strong>
          </p>
          <p className="mb-2">
            为向您提供更能满足您需求的续写服务，了解产品适配性、识别账号异常状态、向您报送错误，除了您根据产品或服务内容主动向我们提供的信息外，我们会直接或间接收集关于您使用本软件的如下相关信息：
          </p>
          <p className="mb-2">
            <strong>3.2.1 设备信息</strong>
          </p>
          <p className="mb-2">
            为了使本软件与设备进行必要的适配并安全服务，您在使用本软件时，根据您在软件安装及使用中授予的具体权限，我们会收集您的<strong>设备品牌、设备型号、屏幕分辨率、设备序列号、设备识别码（IMEI、Android id、oaid）、系统版本、IP 地址、WLAN 接入点、蓝牙、基站、软件版本号、网络接入方式、类型、状态、网络质量数据、操作、使用、服务日志、设备传感器数据</strong>。
          </p>
          <p className="mb-2">
            收集这些信息是为了向您提供更契合您需求的页面展示和搜索结果、了解产品适配性、识别账号异常状态、向您报送错误、进行 bug 分析，保障您正常使用本软件的服务、改进和优化我们的产品体验、保障您的账号安全。
          </p>

          <p className="mb-2">
            <strong>3.2.2 日志信息</strong>
          </p>
          <p className="mb-2">
            为了保障网络安全，改进和优化产品功能，您使用本软件时，系统可能通过<strong>cookies</strong>或其他方式自动收集某些信息并存储在服务器日志中。我们收集的此类信息可能包括：
          </p>
          <p className="mb-2">（1）对本软件的相关使用情况：您使用本软件的<strong>版本号、网络状态、您对本软件的设置项信息、您对本软件的浏览、操作行为</strong>；</p>
          <p className="mb-2">（2）网络安全事件相关日志信息，包括<strong>APP 崩溃、系统活动</strong>信息；</p>
          <p className="mb-2">
            （3）您可以通过浏览器设置拒绝或管理 cookies 或相关技术。但请注意，如果停用 cookies 或相关技术，您有可能无法享受最佳的服务体验，某些服务也可能无法正常使用。
          </p>

          <p className="mb-2">
            <strong>3.2.3 支付信息</strong>
          </p>
          <p className="mb-2">
            当您使用涉及支付的功能时：支付通过合作的第三方支付机构（微信支付、支付宝支付、苹果支付等）所提供的支付服务完成，将由其直接收集、处理您的设备信息并读取支付权限。
          </p>

          <p className="mb-2">
            <strong>3.2.4 用户反馈与服务</strong>
          </p>
          <p className="mb-2">
            为向您提供问题咨询、异常诊断等服务，我们可能会收集您的<strong>操作、使用、服务日志信息</strong>。为便于与您联系、尽快帮助您解决问题，我们可能会保存<strong>您与我们的通信记录及相关内容（包括账号信息、反馈信息、您留下的联系方式）</strong>。
          </p>

          <p className="font-bold mt-4 mb-2">二、我们如何共享、转让、公开披露您的个人信息</p>
          <p className="mb-2">
            我们不会与任何公司、组织和个人共享您的个人信息，但以下情况除外：
          </p>
          <p className="mb-2">1. 事先获得您的明确同意；</p>
          <p className="mb-2">2. 根据法律法规或强制性的行政或司法要求；</p>
          <p className="mb-2">
            3. 与关联公司共享：为便于我们基于关联账号共同向您提供服务，您的个人信息可能与关联公司共享；
          </p>
          <p className="mb-2">
            4. 与授权合作伙伴共享：仅为实现本政策中声明的目的，我们可能会与授权合作伙伴共享您的某些个人信息。
          </p>

          <p className="font-bold mt-4 mb-2">三、我们如何保护您的个人信息</p>
          <p className="mb-2">
            我们已采取符合业界标准、合理可行的安全防护措施保护您的个人信息，防止个人信息遭到未经授权访问、公开披露、使用、修改、损坏或丢失。
          </p>
          <p className="mb-2">
            我们会使用加密技术、匿名化处理等手段保护您的个人信息，并建立专门的管理制度、流程和组织确保信息安全。
          </p>

          <p className="font-bold mt-4 mb-2">四、您的权利</p>
          <p className="mb-2">您对您的个人信息享有以下权利：</p>
          <p className="mb-2">1. 访问、更正您的个人信息；</p>
          <p className="mb-2">2. 删除您的个人信息；</p>
          <p className="mb-2">3. 改变您授权同意的范围；</p>
          <p className="mb-2">4. 个人信息主体注销账户；</p>
          <p className="mb-2">5. 响应您的上述请求。</p>

          <p className="font-bold mt-4 mb-2">五、未成年人保护</p>
          <p className="mb-2">
            <strong>若您是未满 14 周岁的未成年，您应在取得监护人的同意的前提下阅读本政策，并在监护人的指导下使用我们的服务。对于经父母或监护人同意使用我们的产品或服务而收集未成年人个人信息的情况，我们只会在法律法规允许、父母或监护人明确同意或者保护未成年人所必要的情况下使用、共享、转让或披露此信息。</strong>
          </p>

          <p className="font-bold mt-4 mb-2">六、隐私政策的修订和通知</p>
          <p className="mb-2">
            我们可能适时对本政策进行修改或补充，该等修改或补充将在本软件上发布。如果您不同意本政策的变更，请您立即停止使用本软件及服务。如果您继续使用的，即表示您受修订后的本政策约束。
          </p>

          <p className="font-bold mt-4 mb-2">七、联系我们</p>
          <p className="mb-2">
            如果您对本政策有任何疑问、意见或建议，或需投诉、举报的，可以通过以下方式与我们联系：
          </p>
          <p className="mb-2">邮箱：baowenmaoai@126.com</p>
          <p className="mb-2">地址：上海浦东新区</p>
          <p className="mb-2">我们将在 15 个工作日内回复。</p>

          <p className="mt-8 text-center text-[24px] text-[#999]">浙江盛趣科技有限公司</p>
          <p className="text-center text-[24px] text-[#999]">2025 年 12 月</p>
        </div>
      </div>
    </div>
  )
}
