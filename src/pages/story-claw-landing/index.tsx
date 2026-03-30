import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import COVER from "@/assets/images/story_claw_landing/cover.webp";
import FEATURE_OPEN_AND_USE from "@/assets/images/story_claw_landing/feature-open-and-use.webp";
import FEATURE_TASK_EXECUTION from "@/assets/images/story_claw_landing/feature-task-execution.webp";
import FEATURE_EDITOR from "@/assets/images/story_claw_landing/feature-editor.webp";
import FEATURE_REMOTE_SECURITY from "@/assets/images/story_claw_landing/feature-remote-security.webp";
import STORY_CLAW_LOGO from "@/assets/images/story_claw_landing/story-claw-logo.webp";
import STORY_CLAW_ICON from "@/assets/images/story_claw_landing/story-claw-icon.webp";

import GONGAN from "@/assets/images/gongan.png";
import { useLatestDownloads } from "./download";
import { useOptionsStore } from "@/stores/optionsStore";
import {
  Download,
  Book,
  CheckCircle,
  Zap,
  FileText,
  PenTool,
  Lightbulb,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/Button";

const getOS = () => {
  const userAgent = window.navigator.userAgent.toLowerCase();

  if (userAgent.indexOf("mac") !== -1) return "mac";

  if (userAgent.indexOf("win") !== -1) return "windows";

  return "other";
};

type DownloadState = ReturnType<typeof useLatestDownloads>;

const getWindowsDownloadUrl = (downloadState: DownloadState) => {
  if (downloadState.auto.platform === "win" && downloadState.auto.url) {
    return downloadState.auto.url;
  }
  return downloadState.links.winX64 || downloadState.links.winArm64;
};

const HeroDownloadButton = ({
  downloadState,
}: {
  downloadState: DownloadState;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [os, setOs] = useState("other");

  useEffect(() => {
    setOs(getOS());
  }, []);

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };
  const handleDownload = (platform: "mac" | "windows") => {
    if (platform === "mac") {
      toast.info("Mac 版本敬请期待");
      setIsOpen(false);
      return;
    }

    if (downloadState.loading) {
      toast.info("正在加载 Windows 下载地址...");
      return;
    }

    const downloadUrl = getWindowsDownloadUrl(downloadState);
    if (!downloadUrl) {
      toast.error("Windows 下载地址暂不可用，请稍后重试");
      return;
    }

    window.open(downloadUrl, "_blank", "noopener,noreferrer");
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block">
      <motion.button
        className="px-8 py-3 bg-[#d40000] text-white font-semibold rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all hover:bg-[#b00000]"
        whileHover={{
          scale: 1.05,
        }}
        whileTap={{
          scale: 0.98,
        }}
        onClick={toggleDropdown}
      >
        <Download className="w-5 h-5 mr-2" />
        立即下载
        {isOpen ? (
          <ChevronUp className="w-5 h-5 ml-2" />
        ) : (
          <ChevronDown className="w-5 h-5 ml-2" />
        )}
      </motion.button>
      {isOpen && (
        <motion.div
          className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 z-9999 overflow-hidden"
          initial={{
            opacity: 0,
            y: -10,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          exit={{
            opacity: 0,
            y: -10,
          }}
          transition={{
            duration: 0.2,
          }}
        >
          <div className="p-3 border-b border-gray-100 bg-gray-50">
            <p className="text-sm font-medium text-gray-700">选择版本下载</p>
          </div>
          <div className="divide-y divide-gray-100">
            <button
              type="button"
              onClick={() => handleDownload("mac")}
              className={`block w-full text-left px-4 py-3 transition-colors hover:bg-gray-50 cursor-pointer ${os === "mac" ? "bg-[#fff0f0]" : ""}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-800">Mac 版本</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    适用于 macOS 10.14 及以上
                  </p>
                </div>
                {os === "mac" && (
                  <span className="bg-[#d40000] text-white text-xs px-2 py-0.5 rounded-full">
                    适合您的设备
                  </span>
                )}
              </div>
            </button>
            <button
              type="button"
              onClick={() => handleDownload("windows")}
              className={`block w-full text-left px-4 py-3 transition-colors hover:bg-gray-50 cursor-pointer ${os === "windows" ? "bg-[#fff0f0]" : ""}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-800">Windows 版本</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    适用于 Windows 10 及以上
                  </p>
                </div>
                {os === "windows" && (
                  <span className="bg-[#d40000] text-white text-xs px-2 py-0.5 rounded-full">
                    当前设备
                  </span>
                )}
              </div>
            </button>
          </div>
          <div className="p-2 text-center text-xs text-gray-500">
            {downloadState.loading
              ? "正在加载最新版本..."
              : downloadState.error
                ? "下载地址加载失败，请稍后重试"
                : `Win ${downloadState.versionWin || "-"} / Mac ${downloadState.versionMac || "-"}`}
          </div>
        </motion.div>
      )}
    </div>
  );
};

const CtaDownloadButton = ({
  downloadState,
}: {
  downloadState: DownloadState;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [os, setOs] = useState("other");

  useEffect(() => {
    setOs(getOS());
  }, []);

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };
  const handleDownload = (platform: "mac" | "windows") => {
    if (platform === "mac") {
      toast.info("Mac 版本敬请期待");
      setIsOpen(false);
      return;
    }

    if (downloadState.loading) {
      toast.info("正在加载 Windows 下载地址...");
      return;
    }

    const downloadUrl = getWindowsDownloadUrl(downloadState);
    if (!downloadUrl) {
      toast.error("Windows 下载地址暂不可用，请稍后重试");
      return;
    }

    window.open(downloadUrl, "_blank", "noopener,noreferrer");
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block">
      <motion.button
        className="px-8 py-3 bg-[#ffd100] text-[#d40000] font-semibold rounded-full flex items-center justify-center mx-auto shadow-lg hover:shadow-xl transition-all hover:bg-white"
        whileHover={{
          scale: 1.05,
        }}
        whileTap={{
          scale: 0.98,
        }}
        onClick={toggleDropdown}
      >
        <Download className="w-5 h-5 mr-2" />
        立即下载爆文猫写作版龙虾
        {isOpen ? (
          <ChevronUp className="w-5 h-5 ml-2" />
        ) : (
          <ChevronDown className="w-5 h-5 ml-2" />
        )}
      </motion.button>
      {isOpen && (
        <motion.div
          className="absolute left-1/2 transform -translate-x-1/2 mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 z-9999 overflow-hidden"
          initial={{
            opacity: 0,
            y: -10,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          exit={{
            opacity: 0,
            y: -10,
          }}
          transition={{
            duration: 0.2,
          }}
        >
          <div className="p-3 border-b border-gray-100 bg-gray-50">
            <p className="text-sm font-medium text-gray-700">选择版本下载</p>
          </div>
          <div className="divide-y divide-gray-100">
            <button
              type="button"
              onClick={() => handleDownload("mac")}
              className={`block w-full text-left px-4 py-3 transition-colors hover:bg-gray-50 cursor-pointer ${os === "mac" ? "bg-[#fff0f0]" : ""}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-800">Mac 版本</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    适用于 macOS 10.14 及以上
                  </p>
                </div>
                {os === "mac" && (
                  <span className="bg-[#d40000] text-white text-xs px-2 py-0.5 rounded-full">
                    适合您的设备
                  </span>
                )}
              </div>
            </button>
            <button
              type="button"
              onClick={() => handleDownload("windows")}
              className={`block w-full text-left px-4 py-3 transition-colors hover:bg-gray-50 cursor-pointer ${os === "windows" ? "bg-[#fff0f0]" : ""}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-800">Windows 版本</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    适用于 Windows 10 及以上
                  </p>
                </div>
                {os === "windows" && (
                  <span className="bg-[#d40000] text-white text-xs px-2 py-0.5 rounded-full">
                    当前设备
                  </span>
                )}
              </div>
            </button>
          </div>
          <div className="p-2 text-center text-xs text-gray-500">
            {downloadState.loading
              ? "正在加载最新版本..."
              : downloadState.error
                ? "下载地址加载失败，请稍后重试"
                : `Win ${downloadState.versionWin || "-"} / Mac ${downloadState.versionMac || "-"}`}
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default function Home() {
  const navigate = useNavigate();
  const downloadState = useLatestDownloads();
  const [showContactModal, setShowContactModal] = useState(false);
  const [previewImage, setPreviewImage] = useState<{
    src: string;
    alt: string;
  } | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [showQrCode, setShowQrCode] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const clawGuideUrl = useOptionsStore((state) => state.clawGuideUrl);
  const clawVxQrCode = useOptionsStore((state) => state.clawVxQrCode);
  const clawFeishuQrCode = useOptionsStore((state) => state.clawFeishuQrCode);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleInstantExperience = () => {
    if (downloadState.auto.platform === "mac") {
      toast.info("Mac 版本敬请期待");
      return;
    }

    if (downloadState.loading) {
      toast.info("正在加载 Windows 下载地址...");
      return;
    }

    const downloadUrl = getWindowsDownloadUrl(downloadState);
    if (!downloadUrl) {
      toast.error("Windows 下载地址暂不可用，请稍后重试");
      return;
    }

    window.open(downloadUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div
      ref={scrollContainerRef}
      className="h-screen overflow-y-auto overflow-x-hidden bg-linear-to-b from-white to-[#fff9ed] font-sans"
    >
      <header
        className={`px-4 py-4 sm:px-6 lg:px-8 flex items-center justify-between bg-white shadow-sm rounded-lg max-w-[80%] mx-auto my-2 fixed top-0 left-0 right-0 z-50 transition-all duration-300`}
      >
        <div className="flex items-center space-x-1">
          <img
            src={STORY_CLAW_LOGO}
            alt="AutoClaw Logo"
            className="h-8 rounded-sm w-auto"
            loading="lazy"
          />
          <h1 className="ml-2 font-bold text-gray-800 text-xl">
            爆文猫写作版龙虾
          </h1>
        </div>
        <div className="flex items-center space-x-4">
          { }
          <button className="flex items-center text-gray-600 hover:text-gray-900 transition-colors">
            <></>
            <></>
          </button>
          { }
          <div className="relative group">
            <button
              className="text-gray-600 hover:text-gray-900 transition-colors"
              onMouseEnter={() => setShowQrCode(true)}
              onMouseLeave={() => setShowQrCode(false)}
            >
              养虾社群
            </button>
            {showQrCode && (
              <motion.div
                initial={{
                  opacity: 0,
                  y: -10,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                exit={{
                  opacity: 0,
                  y: -10,
                }}
                transition={{
                  duration: 0.2,
                }}
                className="absolute -right-10 mt-8 bg-white p-3 rounded-lg shadow-xl z-50"
                onMouseEnter={() => setShowQrCode(true)}
                onMouseLeave={() => setShowQrCode(false)}
              >
                <div className="w-48 h-48 bg-white p-2 rounded-lg shadow-lg">
                  <img
                    src={clawVxQrCode}
                    alt="养虾社群二维码"
                    className="w-full h-full object-contain"
                    loading="lazy"
                  />
                </div>
                <p className="text-center text-xs text-gray-600 mt-2">
                  扫码加入养虾社群
                </p>
              </motion.div>
            )}
          </div>
          { }
          <motion.button
            className="px-4 py-2 cursor-pointer bg-white text-[#d40000] border border-[#d40000] rounded-lg hover:bg-[#fff0f0] transition-colors"
            onClick={() =>
              window.open(clawGuideUrl, "_blank", "noopener,noreferrer")
            }
            whileHover={{
              scale: 1.02,
            }}
            whileTap={{
              scale: 0.98,
            }}
          >
            使用指南
          </motion.button>
          <motion.button
            type="button"
            onClick={handleInstantExperience}
            className="px-4 py-2 rounded-lg transition-colors cursor-pointer bg-[#d40000] text-white hover:bg-[#b00000]"
            whileHover={{
              scale: 1.02,
            }}
            whileTap={{
              scale: 0.98,
            }}
          >
            立即下载
          </motion.button>
        </div>
      </header>

      <section className="relative overflow-hidden bg-linear-to-br from-[#fff0f0] to-[#fff9ed] pt-36 pb-24 md:pt-56 md:pb-48 lg:pt-72 lg:pb-64">
        <div className="absolute inset-0 bg-linear-to-br from-[#fff0f0] to-[#fff9ed]"></div>
        <div className="max-w-[80%] mx-auto -mt-20 px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="flex flex-col md:flex-row justify-center items-center gap-20">
            <motion.div
              className="w-120 text-center md:text-left mb-10 md:mb-0"
              initial={{
                opacity: 0,
                y: 20,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              transition={{
                duration: 0.8,
              }}
            >
              <div className="flex items-center justify-center md:justify-start mb-4">
                <img
                  src={STORY_CLAW_ICON}
                  alt="龙虾icon"
                  className="h-20 w-auto mr-3"
                  loading="lazy"
                />
              </div>
              <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight text-[#d40000]">
                爆文猫写作版龙虾
                <span className="block text-3xl md:text-4xl mt-2 text-gray-800">
                  一键搞定所有故事创作
                </span>
              </h1>
              <p className="text-xl text-gray-600 mb-8">
                从聊天框走进创作流，AI 真正替你写作。
                <br />
                免编程、免配置，开箱即用。
              </p>
              <div className="flex flex-col sm:flex-row justify-center md:justify-start space-y-4 sm:space-y-0 sm:space-x-4">
                <HeroDownloadButton downloadState={downloadState} />
                <motion.button
                  className="px-8 py-3 bg-white text-[#d40000] border-2 border-[#d40000] font-semibold rounded-full flex items-center justify-center hover:bg-[#fff0f0] transition-all"
                  whileHover={{
                    scale: 1.05,
                  }}
                  whileTap={{
                    scale: 0.98,
                  }}
                  onClick={() =>
                    window.open(clawGuideUrl, "_blank", "noopener,noreferrer")
                  }
                >
                  <Book className="w-5 h-5 mr-2" />
                  查看使用指南
                </motion.button>
              </div>
            </motion.div>
            <motion.div
              className="flex justify-center"
              initial={{
                opacity: 0,
                scale: 0.9,
              }}
              animate={{
                opacity: 1,
                scale: 1,
              }}
              transition={{
                duration: 0.8,
                delay: 0.3,
              }}
            >
              <img
                src={COVER}
                alt="爆文猫写作版龙虾应用界面"
                className="w-200 max-w-full h-auto"
              />
            </motion.div>
          </div>
        </div>
      </section>

      <section
        id="features"
        className="py-16 bg-linear-to-b from-[#fff9ed] to-white"
      >
        <div className="max-w-[80%] mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="text-center mb-16"
            initial={{
              opacity: 0,
              y: 20,
            }}
            whileInView={{
              opacity: 1,
              y: 0,
            }}
            viewport={{
              root: scrollContainerRef,
              once: true,
            }}
            transition={{
              duration: 0.6,
            }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">
              强大创作功能，一站式写作体验
            </h2>
            <div className="w-24 h-1 bg-[#d40000] mx-auto"></div>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <motion.div
              className="bg-linear-to-br from-white to-[#fff0f0] rounded-xl shadow-xl overflow-hidden border border-gray-100"
              initial={{
                opacity: 0,
                y: 20,
              }}
              whileInView={{
                opacity: 1,
                y: 0,
              }}
              viewport={{
                root: scrollContainerRef,
                once: true,
              }}
              transition={{
                duration: 0.6,
              }}
              whileHover={{
                y: -5,
              }}
            >
              <div className="p-8">
                <div className="mb-6">
                  <img
                    src={FEATURE_OPEN_AND_USE}
                    alt="开箱即用零门槛"
                    className="w-full h-auto rounded-xl shadow-lg cursor-zoom-in transition-transform duration-200 hover:scale-[1.02]"
                    loading="lazy"
                    onClick={() =>
                      setPreviewImage({
                        src: FEATURE_OPEN_AND_USE,
                        alt: "开箱即用零门槛",
                      })
                    }
                  />
                </div>
                <h3 className="text-2xl font-bold mb-4 text-gray-800">
                  打开即用
                  <span
                    style={{
                      fontSize: "1.5rem",
                    }}
                  >
                    零门槛
                  </span>
                </h3>
                <div className="space-y-4">
                  <div className="flex items-start">
                    <div className="bg-[#ffd100]/20 p-1 rounded-full mr-3 mt-1">
                      <CheckCircle className="w-4 h-4 text-[#d40000]" />
                    </div>
                    <div>
                      <h4
                        className="font-bold text-gray-800"
                        style={{
                          fontFamily: '"Noto Sans SC", sans-serif',
                        }}
                      >
                        一键部署
                      </h4>
                      <p className="text-gray-600 text-sm">
                        打包 OpenClaw 运行环境，支持 Mac/Win 双平台，无需配置
                        API 或复杂代码。
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <div className="bg-[#ffd100]/20 p-1 rounded-full mr-3 mt-1">
                      <CheckCircle className="w-4 h-4 text-[#d40000]" />
                    </div>
                    <div>
                      <h4
                        className="font-bold text-gray-800"
                        style={{
                          fontFamily: '"Noto Sans SC", sans-serif',
                        }}
                      >
                        上手即写
                      </h4>
                      <p className="text-gray-600 text-sm">
                        预置写作指令集，无需学习提示词工程，文案/小说/剧本创作一键开启。
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
            <motion.div
              className="bg-linear-to-br from-white to-[#fff0f0] rounded-xl shadow-xl overflow-hidden border border-gray-100"
              initial={{
                opacity: 0,
                y: 20,
              }}
              whileInView={{
                opacity: 1,
                y: 0,
              }}
              viewport={{
                root: scrollContainerRef,
                once: true,
              }}
              transition={{
                duration: 0.6,
                delay: 0.2,
              }}
              whileHover={{
                y: -5,
              }}
            >
              <div className="p-8">
                <div className="mb-6">
                  <img
                    src={FEATURE_TASK_EXECUTION}
                    alt="自动整理本地文章"
                    className="w-full h-auto rounded-xl shadow-lg cursor-zoom-in transition-transform duration-200 hover:scale-[1.02]"
                    loading="lazy"
                    onClick={() =>
                      setPreviewImage({
                        src: FEATURE_TASK_EXECUTION,
                        alt: "自动整理本地文章",
                      })
                    }
                  />
                </div>
                <h3 className="text-2xl font-bold mb-4 text-gray-800">
                  发起任务自动执行
                </h3>
                <div className="space-y-4">
                  <div className="flex items-start">
                    <div className="bg-[#ffd100]/20 p-1 rounded-full mr-3 mt-1">
                      <CheckCircle className="w-4 h-4 text-[#d40000]" />
                    </div>
                    <div>
                      <h4
                        className="font-bold text-gray-800"
                        style={{
                          fontFamily: '"Noto Sans SC", sans-serif',
                        }}
                      >
                        自动化任务
                      </h4>
                      <p className="text-gray-600 text-sm">
                        区别于普通对话机器人，它能直接操控本地应用，执行批量创作与文件管理。
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <div className="bg-[#ffd100]/20 p-1 rounded-full mr-3 mt-1">
                      <CheckCircle className="w-4 h-4 text-[#d40000]" />
                    </div>
                    <div>
                      <h4
                        className="font-bold text-gray-800"
                        style={{
                          fontFamily: '"Noto Sans SC", sans-serif',
                        }}
                      >
                        5000+ 技能
                      </h4>
                      <p className="text-gray-600 text-sm">
                        对接 ClawHub 生态，一条指令即可调用海量插件。
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
            <motion.div
              className="bg-linear-to-br from-white to-[#fff0f0] rounded-xl shadow-xl overflow-hidden border border-gray-100"
              initial={{
                opacity: 0,
                y: 20,
              }}
              whileInView={{
                opacity: 1,
                y: 0,
              }}
              viewport={{
                root: scrollContainerRef,
                once: true,
              }}
              transition={{
                duration: 0.6,
                delay: 0.4,
              }}
              whileHover={{
                y: -5,
              }}
            >
              <div className="p-8">
                <div className="mb-6">
                  <img
                    src={FEATURE_EDITOR}
                    alt="专属协作编辑器"
                    className="w-full h-auto rounded-xl shadow-lg cursor-zoom-in transition-transform duration-200 hover:scale-[1.02]"
                    loading="lazy"
                    style={{
                      backgroundColor: "transparent",
                    }}
                    onClick={() =>
                      setPreviewImage({
                        src: FEATURE_EDITOR,
                        alt: "专属协作编辑器",
                      })
                    }
                  />
                </div>
                <h3 className="text-2xl font-bold mb-4 text-gray-800">
                  专属写作编辑器
                </h3>
                <div className="space-y-4">
                  <div className="flex items-start">
                    <div className="bg-[#ffd100]/20 p-1 rounded-full mr-3 mt-1">
                      <CheckCircle className="w-4 h-4 text-[#d40000]" />
                    </div>
                    <div>
                      <h4
                        className="font-bold text-gray-800"
                        style={{
                          fontFamily: '"Noto Sans SC", sans-serif',
                        }}
                      >
                        沉浸写作
                      </h4>
                      <p className="text-gray-600 text-sm">
                        自带文本区域，支持实时润色与格式调整，告别繁琐的文件导入导出。
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <div className="bg-[#ffd100]/20 p-1 rounded-full mr-3 mt-1">
                      <CheckCircle className="w-4 h-4 text-[#d40000]" />
                    </div>
                    <div>
                      <h4
                        className="font-bold text-gray-800"
                        style={{
                          fontFamily: '"Noto Sans SC", sans-serif',
                        }}
                      >
                        越用越懂
                      </h4>
                      <p className="text-gray-600 text-sm">
                        具备本地持续记忆功能，自动学习作者的文风偏好。
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
            <motion.div
              className="bg-linear-to-br from-white to-[#fff0f0] rounded-xl shadow-xl overflow-hidden border border-gray-100"
              initial={{
                opacity: 0,
                y: 20,
              }}
              whileInView={{
                opacity: 1,
                y: 0,
              }}
              viewport={{
                root: scrollContainerRef,
                once: true,
              }}
              transition={{
                duration: 0.6,
                delay: 0.6,
              }}
              whileHover={{
                y: -5,
              }}
            >
              <div className="p-8">
                <div className="mb-6">
                  <img
                    src={FEATURE_REMOTE_SECURITY}
                    alt="远程控制与安全"
                    className="w-full h-auto rounded-xl shadow-lg cursor-zoom-in transition-transform duration-200 hover:scale-[1.02]"
                    loading="lazy"
                    onClick={() =>
                      setPreviewImage({
                        src: FEATURE_REMOTE_SECURITY,
                        alt: "远程控制与安全",
                      })
                    }
                  />
                </div>
                <h3 className="text-2xl font-bold mb-4 text-gray-800">
                  多端协作与安全
                </h3>
                <div className="space-y-4">
                  <div className="flex items-start">
                    <div className="bg-[#ffd100]/20 p-1 rounded-full mr-3 mt-1">
                      <CheckCircle className="w-4 h-4 text-[#d40000]" />
                    </div>
                    <div>
                      <h4
                        className="font-bold text-gray-800"
                        style={{
                          fontFamily: '"Noto Sans SC", sans-serif',
                        }}
                      >
                        移动协同
                      </h4>
                      <p className="text-gray-600 text-sm">
                        微信QQ直接对话，远程操控，灵感随手下发，电脑自动开工。
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <div className="bg-[#ffd100]/20 p-1 rounded-full mr-3 mt-1">
                      <CheckCircle className="w-4 h-4 text-[#d40000]" />
                    </div>
                    <div>
                      <h4
                        className="font-bold text-gray-800"
                        style={{
                          fontFamily: '"Noto Sans SC", sans-serif',
                        }}
                      >
                        本地部署
                      </h4>
                      <p className="text-gray-600 text-sm">
                        无云端后台，数据 100% 留存在本地，守护创作原稿隐私。
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
          <motion.div
            className="mt-8 bg-linear-to-br from-white to-[#fff0f0] rounded-xl shadow-xl overflow-hidden border border-gray-100"
            initial={{
              opacity: 0,
              y: 20,
            }}
            whileInView={{
              opacity: 1,
              y: 0,
            }}
            viewport={{
              root: scrollContainerRef,
              once: true,
            }}
            transition={{
              duration: 0.6,
              delay: 0.8,
            }}
            whileHover={{
              y: -5,
            }}
          >
            <div className="p-8 flex items-center justify-center">
              <h3 className="text-2xl md:text-3xl font-bold text-gray-800 text-center">
                更多功能等你发现
              </h3>
            </div>
          </motion.div>
        </div>
      </section>

      <section
        id="scenarios"
        className="py-16 bg-linear-to-b from-white to-[#fff0f0]"
      >
        <div className="max-w-[80%] mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="text-center mb-12"
            initial={{
              opacity: 0,
              y: 20,
            }}
            whileInView={{
              opacity: 1,
              y: 0,
            }}
            viewport={{
              root: scrollContainerRef,
              once: true,
            }}
            transition={{
              duration: 0.6,
            }}
          >
            <h2 className="text-3xl font-bold text-gray-800 mb-4">
              适用什么样的场景
              <br />
            </h2>
            <div className="w-20 h-1 bg-[#d40000] mx-auto"></div>
          </motion.div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: <PenTool className="w-8 h-8 text-[#d40000]" />,
                title: "短篇创作辅助",
                description:
                  "智能构思剧情、优化文笔、补充细节，快速完成短篇故事创作。",
              },
              {
                icon: <FileText className="w-8 h-8 text-[#d40000]" />,
                title: "剧本脚本生成",
                description:
                  "一键生成剧本框架、台词设计，支持场景、人物对话优化调整。",
              },
              {
                icon: <Zap className="w-8 h-8 text-[#d40000]" />,
                title: "文案润色优化",
                description:
                  "自动修正语病、优化表达，贴合不同文风，提升文字质感。",
              },
              {
                icon: <Lightbulb className="w-8 h-8 text-[#d40000]" />,
                title: "创作灵感补给",
                description:
                  "输入关键词，一键生成选题、大纲，解决写作卡壳难题。",
              },
            ].map((scenario, index) => (
              <motion.div
                key={index}
                className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-shadow"
                initial={{
                  opacity: 0,
                  y: 20,
                }}
                whileInView={{
                  opacity: 1,
                  y: 0,
                }}
                viewport={{
                  root: scrollContainerRef,
                  once: true,
                }}
                transition={{
                  duration: 0.6,
                  delay: index * 0.1,
                }}
                whileHover={{
                  y: -5,
                }}
              >
                <div className="mb-4 p-2 bg-[#fff9ed] inline-flex rounded-full">
                  {scenario.icon}
                </div>
                <h3
                  className="text-lg font-bold mb-2 text-gray-800"
                  style={{
                    fontFamily: '"Noto Sans SC", sans-serif',
                  }}
                >
                  {scenario.title}
                </h3>
                <p className="text-gray-600 text-sm">{scenario.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section
        id="guide"
        className="py-16 bg-linear-to-br from-[#d40000] to-[#ff7070] text-white"
      >
        <div className="max-w-[80%] mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{
              opacity: 0,
              y: 20,
            }}
            whileInView={{
              opacity: 1,
              y: 0,
            }}
            viewport={{
              root: scrollContainerRef,
              once: true,
            }}
            transition={{
              duration: 0.8,
            }}
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              准备好改变你的创作方式了吗？
            </h2>
            <p className="text-xl mb-8 max-w-2xl mx-auto text-white/90">
              随时随地，爆文猫写作版龙虾帮你高效写作，开启全新的创作体验！
            </p>
            <CtaDownloadButton downloadState={downloadState} />
            <p className="mt-4 text-white/70">支持 Mac / Win 双平台</p>
          </motion.div>
        </div>
      </section>

      <footer className="py-8 bg-gray-900 text-white/80">
        <div className="max-w-[80%] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-2 mb-4 md:mb-0 w-50">
              <img
                src={STORY_CLAW_LOGO}
                alt="爆文猫写作版龙虾Logo"
                className="h-8 w-auto rounded-sm"
                loading="lazy"
              />
              <span className="ml-2 text-lg font-bold">爆文猫写作版龙虾</span>
            </div>
            <div className="flex space-x-6 mb-4 md:mb-0">
              <button
                type="button"
                onClick={() => navigate("/privacy-policy")}
                className="hover:text-white transition-colors"
              >
                隐私政策
              </button>
              <button
                type="button"
                onClick={() => navigate("/user-agreement")}
                className="hover:text-white transition-colors"
              >
                用户协议
              </button>
              <button
                type="button"
                onClick={() => setShowContactModal(true)}
                className="hover:text-white transition-colors"
              >
                联系我们
              </button>
            </div>
            {/* <div className="text-sm w-50"></div> */}
          </div>
        </div>
        <div className="flex shrink-0 w-full max-w-screen flex-col items-center pb-10">
          <div className="flex flex-col items-center justify-center mt-5">
            <p className="font-YaHei m-0 text-sm leading-[1.32] text-[#999]">
              © 2025 数龙信息技术（浙江）有限公司 保留所有权利。
            </p>
            <a
              href="https://beian.miit.gov.cn/"
              target="_blank"
              rel="noreferrer"
              className="mt-2.5 text-sm leading-[1.32] text-[#999] no-underline transition-colors duration-300 hover:text-[#efaf00]"
            >
              浙ICP备17039406号-19
            </a>
            <a
              href="https://beian.mps.gov.cn/#/query/webSearch?code=33060402002057"
              rel="noreferrer"
              target="_blank"
              className="mt-2.5 flex items-center text-sm leading-[1.32] text-[#999] no-underline transition-colors duration-300 hover:text-[#efaf00]"
            >
              <img
                src={GONGAN}
                alt=""
                className="mr-2 size-4 object-cover"
                loading="lazy"
              />
              <span>浙公网安备33060402002057号</span>
            </a>
          </div>
        </div>
      </footer>
      { }
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative max-w-5xl w-full max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="absolute -top-3 -right-3 bg-white text-gray-700 rounded-full p-2 shadow-lg custom-btn"
              aria-label="关闭预览"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={previewImage.src}
              alt={previewImage.alt}
              className="w-full h-full max-h-[90vh] object-contain rounded-xl shadow-2xl bg-white"
              loading="lazy"
            />
          </div>
        </div>
      )}
      {showContactModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <motion.div
            initial={{
              opacity: 0,
              scale: 0.9,
            }}
            animate={{
              opacity: 1,
              scale: 1,
            }}
            exit={{
              opacity: 0,
              scale: 0.9,
            }}
            className="bg-white rounded-2xl p-6 max-w-100 w-full mx-4 shadow-2xl"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-800">联系我们</h3>
              <Button
                onClick={() => setShowContactModal(false)}
                variant='ghost'
                size='icon-sm'
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </Button>
            </div>
            <div className="flex gap-6 justify-center">
              {clawVxQrCode && (
                <div className="flex flex-col items-center">
                  <div className="w-40 h-40 bg-white p-2 rounded-lg shadow-lg mb-2">
                    <img
                      src={clawVxQrCode}
                      alt="企业微信二维码"
                      className="w-full h-full object-contain"
                      loading="lazy"
                    />
                  </div>
                  <p className="text-sm text-gray-600">企业微信</p>
                </div>
              )}

              {clawFeishuQrCode && (
                <div className="flex flex-col items-center">
                  <div className="w-40 h-40 bg-white p-2 rounded-lg shadow-lg mb-2">
                    <img
                      src={clawFeishuQrCode}
                      alt="飞书二维码"
                      className="w-full h-full object-contain"
                      loading="lazy"
                    />
                  </div>
                  <p className="text-sm text-gray-600">飞书</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
