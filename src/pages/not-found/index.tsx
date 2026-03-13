import { useNavigate } from 'react-router-dom'

export default function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-white">
      <div className="w-4/5 max-w-[1920px] px-5 pb-5 pt-20 text-center">
        {/* SVG 插图 */}
        <div className="mx-auto mb-5 h-60 w-60">
          <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
            {/* 轨道/星环 */}
            <ellipse
              cx="100"
              cy="100"
              rx="90"
              ry="40"
              fill="none"
              stroke="#e6ebf1"
              strokeWidth="4"
              transform="rotate(-15 100 100)"
            />
            {/* 星球主体 */}
            <circle cx="100" cy="100" r="60" fill="#b8c6db" />
            {/* 星球上的斑点 */}
            <circle cx="70" cy="80" r="6" fill="#a4b3cf" />
            <circle cx="130" cy="120" r="8" fill="#a4b3cf" />
            <circle cx="85" cy="135" r="5" fill="#a4b3cf" />
            <circle cx="115" cy="70" r="4" fill="#a4b3cf" />
            {/* 404 文字 */}
            <text
              x="50%"
              y="55%"
              textAnchor="middle"
              fill="#fff"
              fontSize="40"
              fontWeight="bold"
              style={{ filter: 'drop-shadow(2px 2px 2px rgba(0,0,0,0.1))' }}
            >
              404
            </text>
            {/* 被星球遮挡后的星环部分 */}
            <path
              d="M 190 100 A 90 40 0 0 1 10 100"
              fill="none"
              stroke="#e6ebf1"
              strokeWidth="4"
              transform="rotate(-15 100 100)"
            />
          </svg>
        </div>

        <div className="mb-7.5 text-xl font-medium text-[#333]">
          哎呀迷路了...
        </div>

        <div className="mb-7.5 h-px w-full bg-[#f0f0f0]" />

        <div className="flex flex-col gap-2 items-center">
          <div className="mb-10 inline-block text-left">
            <div className="mb-2.5 text-sm text-[#999]">可能的原因：</div>
            <ul className="m-0 list-disc pl-5 marker:text-[#ccc]">
              <li className="mb-2 text-sm text-[#999]">原来的页面不存在了</li>
              <li className="mb-2 text-sm text-[#999]">我们的服务器被外星人劫持了</li>
            </ul>
          </div>

          <button
            onClick={() => navigate('/')}
            className="inline-block bg-(--theme-color) px-6 py-2.5 rounded-lg text-base text-white transition-colors custom-btn"
          >
            返回首页
          </button>
        </div>
      </div>
    </div>
  )
}
