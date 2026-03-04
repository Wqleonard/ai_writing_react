import LOGO from "@/assets/images/my-place/sidebar_logo.png";

interface LandingNavbarProps {
  isLoggedIn: boolean;
  onNavClick: (anchor: string) => void;
  onShowLogin: () => void;
}

export function LandingNavbar({
  isLoggedIn,
  onNavClick,
  onShowLogin,
}: LandingNavbarProps) {
  return (
    <nav className="fixed top-0 left-0 right-0 z-9999 bg-[#f7f7f4] py-5 px-[86px]">
      <div className="flex items-center justify-between">
        {/* Logo */}
        <div className="flex flex-row items-center">
          <div className="flex size-8 items-center justify-center overflow-hidden">
            <img
              src={LOGO}
              alt="爆文猫写作"
              className="w-12 h-12 max-w-12! max-h-12!"
              loading="lazy"
            />
          </div>
          <span className="ml-2.5 text-lg font-bold text-[#80807d]">
            爆文猫写作
          </span>
          <span className="ml-2 rounded-full bg-gray-400 px-[7px] text-[11px] font-medium leading-5 text-white">
            内测版
          </span>
        </div>

        {/* Nav links */}
        <div className="flex gap-[66px]">
          {[
            { label: "功能", anchor: "workshop" },
            { label: "优势", anchor: "advantages" },
            { label: "适用场景", anchor: "scenarios" },
            { label: "常见问题", anchor: "faq" },
          ].map(({ label, anchor }) => (
            <a
              key={anchor}
              onClick={(e) => {
                e.preventDefault();
                onNavClick(anchor);
              }}
              href="#"
              className="cursor-pointer text-base font-normal leading-[21px] text-[#464646] no-underline transition-colors duration-300 hover:text-[#efaf00]"
            >
              {label}
            </a>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-[15px]">
          <a
            href="/workspace/my-place"
            className="flex size-8 items-center justify-center transition-opacity duration-300 hover:opacity-70"
          >
            <svg width="33" height="33" viewBox="0 0 33 33" fill="none">
              <path
                d="M13.75 27.5V19.25H19.25V27.5M5.5 12.375L16.5 3.4375L27.5 12.375V26.125C27.5 26.6223 27.3025 27.0992 26.9508 27.4508C26.5992 27.8025 26.1223 28 25.625 28H7.375C6.87772 28 6.40081 27.8025 6.04917 27.4508C5.69754 27.0992 5.5 26.6223 5.5 26.125V12.375Z"
                stroke="#666666"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>
          {!isLoggedIn && (
            <button
              onClick={onShowLogin}
              className="flex h-7 w-[102px] cursor-pointer items-center justify-center rounded-[10px] border-none bg-linear-to-r from-[#efaf00] to-[#ff9500] p-0 text-base text-white transition-transform duration-200 hover:-translate-y-0.5"
            >
              注册/登录
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
