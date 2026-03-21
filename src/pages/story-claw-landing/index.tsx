import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { X } from "lucide-react";

import {
    Download,
    Book,
    CheckCircle,
    Zap,
    ShieldCheck,
    Users,
    FileText,
    PenTool,
    Lightbulb,
    Smartphone,
    ChevronDown,
    ChevronUp,
} from "lucide-react";

const COLORS = {
    primary: "rgb(212, 0, 0)",
    secondary: "rgb(255, 209, 0)",
    primaryLight: "rgba(212, 0, 0, 0.1)",
    secondaryLight: "rgba(255, 209, 0, 0.1)",
    text: "rgb(31, 31, 31)",
    textLight: "rgb(102, 102, 102)",
    background: "rgb(255, 255, 255)",
    cardBg: "rgb(255, 255, 255)"
};

const getOS = () => {
    const userAgent = window.navigator.userAgent.toLowerCase();

    if (userAgent.indexOf("mac") !== -1)
        return "mac";

    if (userAgent.indexOf("win") !== -1)
        return "windows";

    return "other";
};

const DownloadButton = (
    {
        className = "",
        label = "立即下载"
    }: {
        className?: string;
        label?: string;
    }
) => {
    const [isOpen, setIsOpen] = useState(false);
    const [os, setOs] = useState("other");

    useEffect(() => {
        setOs(getOS());
    }, []);

    const toggleDropdown = () => {
        setIsOpen(!isOpen);
    };

    return (
        <div className="relative inline-block">
            <motion.button
                className={`px-4 py-2 bg-[#d40000] text-white rounded-full hover:bg-[#b00000] transition-colors flex items-center justify-center ${className}`}
                whileHover={{
                    scale: 1.02
                }}
                whileTap={{
                    scale: 0.98
                }}
                onClick={toggleDropdown}>
                <Download className="w-4 h-4 mr-2" />
                {label}
                {isOpen ? <ChevronUp className="w-4 h-4 ml-2" /> : <></>}
            </motion.button>
            {isOpen && <motion.div
                className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 z-9999 overflow-hidden"
                initial={{
                    opacity: 0,
                    y: -10
                }}
                animate={{
                    opacity: 1,
                    y: 0
                }}
                exit={{
                    opacity: 0,
                    y: -10
                }}
                transition={{
                    duration: 0.2
                }}>
                <div className="p-3 border-b border-gray-100 bg-gray-50">
                    <p className="text-sm font-medium text-gray-700">选择版本下载</p>
                </div>
                <div className="divide-y divide-gray-100">
                    <a
                        href="#"
                        className={`block w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${os === "mac" ? "bg-[#fff0f0]" : ""}`}>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium text-gray-800">Mac 版本</p>
                                <p className="text-xs text-gray-500 mt-0.5">适用于 macOS 10.14 及以上</p>
                            </div>
                            {os === "mac" && <span className="bg-[#d40000] text-white text-xs px-2 py-0.5 rounded-full">适合您的设备
                            </span>}
                        </div>
                    </a>
                    <a
                        href="#"
                        className={`block w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${os === "windows" ? "bg-[#fff0f0]" : ""}`}>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium text-gray-800">Windows 版本</p>
                                <p className="text-xs text-gray-500 mt-0.5">适用于 Windows 10 及以上</p>
                            </div>
                            {os === "windows" && <span className="bg-[#d40000] text-white text-xs px-2 py-0.5 rounded-full">适合您的设备
                            </span>}
                        </div>
                    </a>
                </div>
                <div className="p-2 text-center">
                    <p className="text-xs text-gray-500">更新日期: 2026-03-20</p>
                </div>
            </motion.div>}
        </div>
    );
};

const HeroDownloadButton = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [os, setOs] = useState("other");

    useEffect(() => {
        setOs(getOS());
    }, []);

    const toggleDropdown = () => {
        setIsOpen(!isOpen);
    };

    return (
        <div className="relative inline-block">
            <motion.button
                className="px-8 py-3 bg-[#d40000] text-white font-semibold rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all hover:bg-[#b00000]"
                whileHover={{
                    scale: 1.05
                }}
                whileTap={{
                    scale: 0.98
                }}
                onClick={toggleDropdown}>
                <Download className="w-5 h-5 mr-2" />立即下载
                {isOpen ? <ChevronUp className="w-5 h-5 ml-2" /> : <ChevronDown className="w-5 h-5 ml-2" />}
            </motion.button>
            {isOpen && <motion.div
                className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 z-9999 overflow-hidden"
                initial={{
                    opacity: 0,
                    y: -10
                }}
                animate={{
                    opacity: 1,
                    y: 0
                }}
                exit={{
                    opacity: 0,
                    y: -10
                }}
                transition={{
                    duration: 0.2
                }}>
                <div className="p-3 border-b border-gray-100 bg-gray-50">
                    <p className="text-sm font-medium text-gray-700">选择版本下载</p>
                </div>
                <div className="divide-y divide-gray-100">
                    <a
                        href="#"
                        className={`block w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${os === "mac" ? "bg-[#fff0f0]" : ""}`}>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium text-gray-800">Mac 版本</p>
                                <p className="text-xs text-gray-500 mt-0.5">适用于 macOS 10.14 及以上</p>
                            </div>
                            {os === "mac" && <span className="bg-[#d40000] text-white text-xs px-2 py-0.5 rounded-full">适合您的设备
                            </span>}
                        </div>
                    </a>
                    <a
                        href="#"
                        className={`block w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${os === "windows" ? "bg-[#fff0f0]" : ""}`}>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium text-gray-800">Windows 版本</p>
                                <p className="text-xs text-gray-500 mt-0.5">适用于 Windows 10 及以上</p>
                            </div>
                            {os === "windows" && <span className="bg-[#d40000] text-white text-xs px-2 py-0.5 rounded-full">当前设备</span>}
                        </div>
                    </a>
                </div>
                <></>
            </motion.div>}
        </div>
    );
};

const CtaDownloadButton = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [os, setOs] = useState("other");

    useEffect(() => {
        setOs(getOS());
    }, []);

    const toggleDropdown = () => {
        setIsOpen(!isOpen);
    };

    return (
        <div className="relative inline-block">
            <motion.button
                className="px-8 py-3 bg-[#ffd100] text-[#d40000] font-semibold rounded-full flex items-center justify-center mx-auto shadow-lg hover:shadow-xl transition-all hover:bg-white"
                whileHover={{
                    scale: 1.05
                }}
                whileTap={{
                    scale: 0.98
                }}
                onClick={toggleDropdown}>
                <Download className="w-5 h-5 mr-2" />立即下载爆文猫写作版龙虾
                {isOpen ? <ChevronUp className="w-5 h-5 ml-2" /> : <ChevronDown className="w-5 h-5 ml-2" />}
            </motion.button>
            {isOpen && <motion.div
                className="absolute left-1/2 transform -translate-x-1/2 mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 z-9999 overflow-hidden"
                initial={{
                    opacity: 0,
                    y: -10
                }}
                animate={{
                    opacity: 1,
                    y: 0
                }}
                exit={{
                    opacity: 0,
                    y: -10
                }}
                transition={{
                    duration: 0.2
                }}>
                <div className="p-3 border-b border-gray-100 bg-gray-50">
                    <p className="text-sm font-medium text-gray-700">选择版本下载</p>
                </div>
                <div className="divide-y divide-gray-100">
                    <a
                        href="#"
                        className={`block w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${os === "mac" ? "bg-[#fff0f0]" : ""}`}>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium text-gray-800">Mac 版本</p>
                                <p className="text-xs text-gray-500 mt-0.5">适用于 macOS 10.14 及以上</p>
                            </div>
                            {os === "mac" && <span className="bg-[#d40000] text-white text-xs px-2 py-0.5 rounded-full">适合您的设备
                            </span>}
                        </div>
                    </a>
                    <a
                        href="#"
                        className={`block w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${os === "windows" ? "bg-[#fff0f0]" : ""}`}>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium text-gray-800">Windows 版本</p>
                                <p className="text-xs text-gray-500 mt-0.5">适用于 Windows 10 及以上</p>
                            </div>
                            {os === "windows" && <span className="bg-[#d40000] text-white text-xs px-2 py-0.5 rounded-full">当前设备</span>}
                        </div>
                    </a>
                </div>
                <></>
            </motion.div>}
        </div>
    );
};

export default function Home() {
    const navigate = useNavigate();
    const [showContactModal, setShowContactModal] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const [showQrCode, setShowQrCode] = useState(false);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

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

    return (
        <div
            ref={scrollContainerRef}
            className="h-screen overflow-y-auto overflow-x-hidden bg-linear-to-b from-white to-[#fff9ed] font-sans">
            <header
                className={`px-4 py-4 sm:px-6 lg:px-8 flex items-center justify-between bg-white shadow-sm rounded-lg max-w-[80%] mx-auto my-2 fixed top-0 left-0 right-0 z-50 transition-all duration-300`}>
                <div className="flex items-center space-x-1">
                    <img
                        src="https://lf-code-agent.coze.cn/obj/x-ai-cn/attachment/3894913543964963/客户端logo_20260319111723.png"
                        alt="AutoClaw Logo"
                        className="h-8 rounded-sm w-auto" />
                    <h1 className="ml-2 font-bold text-gray-800 text-xl">爆文猫写作版龙虾</h1>
                </div>
                <div className="flex items-center space-x-4">
                    { }
                    <button
                        className="flex items-center text-gray-600 hover:text-gray-900 transition-colors">
                        <></>
                        <></>
                    </button>
                    { }
                    <div className="relative group">
                        <button
                            className="text-gray-600 hover:text-gray-900 transition-colors"
                            onMouseEnter={() => setShowQrCode(true)}
                            onMouseLeave={() => setShowQrCode(false)}>养虾社群
                        </button>
                        {showQrCode && <               motion.div
                            initial={{
                                opacity: 0,
                                y: -10 
                            }}
                            animate={{
                                opacity: 1,
                                y: 0
                            }}
                            exit={{
                                opacity: 0,
                                y: -10
                            }}
                            transition={{
                                duration: 0.2
                            }}
                            className="absolute -right-10 mt-8 bg-white p-3 rounded-lg shadow-xl z-50"
                            onMouseEnter={() => setShowQrCode(true)}
                            onMouseLeave={() => setShowQrCode(false)}>
                            <div className="w-48 h-48 bg-white p-2 rounded-lg shadow-lg">
                                <img
                                    src="https://space.coze.cn/api/coze_space/gen_image?image_size=square&prompt=WeChat%20group%20QR%20code%2C%20literary%20community&sign=491990c366e31c00afe9243cf40feb6a"
                                    alt="养虾社群二维码"
                                    className="w-full h-full object-contain" />
                            </div>
                            <p className="text-center text-xs text-gray-600 mt-2">扫码加入养虾社群</p>
                        </motion.div>}
                    </div>
                    { }
                    <motion.button
                        className="px-4 py-2 bg-white text-[#d40000] border border-[#d40000] rounded-lg hover:bg-[#fff0f0] transition-colors"
                        whileHover={{
                            scale: 1.02
                        }}
                        whileTap={{
                            scale: 0.98
                        }}>使用指南</motion.button>
                    <motion.button
                        className="px-4 py-2 bg-[#d40000] text-white rounded-lg hover:bg-[#b00000] transition-colors"
                        whileHover={{
                            scale: 1.02
                        }}
                        whileTap={{
                            scale: 0.98
                        }}>立即体验</motion.button>
                </div>
            </header>

            <section
                className="relative overflow-hidden bg-linear-to-br from-[#fff0f0] to-[#fff9ed] pt-36 pb-24 md:pt-56 md:pb-48 lg:pt-72 lg:pb-64">
                <div
                    className="absolute inset-0 bg-linear-to-br from-[#fff0f0] to-[#fff9ed]"></div>
                <div className="max-w-[80%] mx-auto -mt-20 px-4 sm:px-6 lg:px-8 relative z-10">
                    <div className="flex flex-col md:flex-row justify-center items-center gap-40">
                        <motion.div
                            className="md:w-120 text-center md:text-left mb-10 md:mb-0"
                            initial={{
                                opacity: 0,
                                y: 20
                            }}
                            animate={{
                                opacity: 1,
                                y: 0
                            }}
                            transition={{
                                duration: 0.8
                            }}>
                            <div className="flex items-center justify-center md:justify-start mb-4">
                                <img
                                    src="https://lf-code-agent.coze.cn/obj/x-ai-cn/267088422146/attachment/_Image_20260320101942.png"
                                    alt="龙虾icon"
                                    className="h-20 w-auto mr-3" />
                            </div>
                            <h1
                                className="text-4xl md:text-5xl font-bold mb-6 leading-tight text-[#d40000]">爆文猫写作版龙虾
                                <span className="block text-3xl md:text-4xl mt-2 text-gray-800">一键搞定所有故事创作</span>
                            </h1>
                            <p className="text-xl text-gray-600 mb-8">从聊天框走进创作流，AI 真正替你写作。<br />免编程、免配置，开箱即用。</p>
                            <div
                                className="flex flex-col sm:flex-row justify-center md:justify-start space-y-4 sm:space-y-0 sm:space-x-4">
                                <HeroDownloadButton />
                                <motion.button
                                    className="px-8 py-3 bg-white text-[#d40000] border-2 border-[#d40000] font-semibold rounded-full flex items-center justify-center hover:bg-[#fff0f0] transition-all"
                                    whileHover={{
                                        scale: 1.05
                                    }}
                                    whileTap={{
                                        scale: 0.98
                                    }}>
                                    <Book className="w-5 h-5 mr-2" />查看使用指南</motion.button>
                            </div>
                        </motion.div>
                        <motion.div
                            className="md:w-1/2 flex justify-center"
                            initial={{
                                opacity: 0,
                                scale: 0.9
                            }}
                            animate={{
                                opacity: 1,
                                scale: 1
                            }}
                            transition={{
                                duration: 0.8,
                                delay: 0.3
                            }}>
                            <div className="relative">
                                <img
                                    src="https://lf-code-agent.coze.cn/obj/x-ai-cn/267088422146/attachment/img_v3_02vu_13aec57e-44ab-42be-a8c3-edd77db83a0g_20260319142625.jpg"
                                    alt="爆文猫写作版龙虾应用界面"
                                    className="w-full max-w-full h-auto rounded-2xl shadow-2xl" />
                                <></>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </section>

            <section id="features" className="py-16 bg-linear-to-b from-[#fff9ed] to-white">
                <div className="max-w-[80%] mx-auto px-4 sm:px-6 lg:px-8">
                    <motion.div
                        className="text-center mb-16"
                        initial={{
                            opacity: 0,
                            y: 20
                        }}
                        whileInView={{
                            opacity: 1,
                            y: 0
                        }}
                        viewport={{
                            root: scrollContainerRef,
                            once: true
                        }}
                        transition={{
                            duration: 0.6
                        }}>
                        <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">强大创作功能，一站式写作体验</h2>
                        <div className="w-24 h-1 bg-[#d40000] mx-auto"></div>
                    </motion.div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                        <motion.div
                            className="bg-linear-to-br from-white to-[#fff0f0] rounded-xl shadow-xl overflow-hidden border border-gray-100"
                            initial={{
                                opacity: 0,
                                y: 20
                            }}
                            whileInView={{
                                opacity: 1,
                                y: 0
                            }}
                            viewport={{
                                root: scrollContainerRef,
                                once: true
                            }}
                            transition={{
                                duration: 0.6
                            }}
                            whileHover={{
                                y: -5
                            }}>
                            <div className="p-8">
                                <div className="mb-6">
                                    <img
                                        src="https://lf-code-agent.coze.cn/obj/x-ai-cn/267088422146/attachment/开箱即用_20260320120528.png"
                                        alt="开箱即用零门槛"
                                        className="w-full h-auto rounded-xl shadow-lg" />
                                </div>
                                <h3 className="text-2xl font-bold mb-4 text-gray-800">打开即用<span
                                    style={{
                                        fontSize: "1.5rem"
                                    }}>零门槛</span></h3>
                                <div className="space-y-4">
                                    <div className="flex items-start">
                                        <div className="bg-[#ffd100]/20 p-1 rounded-full mr-3 mt-1">
                                            <CheckCircle className="w-4 h-4 text-[#d40000]" />
                                        </div>
                                        <div>
                                            <h4
                                                className="font-bold text-gray-800"
                                                style={{
                                                    fontFamily: "\"Noto Sans SC\", sans-serif"
                                                }}>一键部署</h4>
                                            <p className="text-gray-600 text-sm">打包 OpenClaw 运行环境，支持 Mac/Win 双平台，无需配置 API 或复杂代码。</p>
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
                                                    fontFamily: "\"Noto Sans SC\", sans-serif"
                                                }}>上手即写</h4>
                                            <p className="text-gray-600 text-sm">预置写作指令集，无需学习提示词工程，文案/小说/剧本创作一键开启。</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                        <motion.div
                            className="bg-linear-to-br from-white to-[#fff0f0] rounded-xl shadow-xl overflow-hidden border border-gray-100"
                            initial={{
                                opacity: 0,
                                y: 20
                            }}
                            whileInView={{
                                opacity: 1,
                                y: 0
                            }}
                            viewport={{
                                root: scrollContainerRef,
                                once: true
                            }}
                            transition={{
                                duration: 0.6,
                                delay: 0.2
                            }}
                            whileHover={{
                                y: -5
                            }}>
                            <div className="p-8">
                                <div className="mb-6">
                                    <img
                                        src="https://lf-code-agent.coze.cn/obj/x-ai-cn/267088422146/attachment/技能市场_20260320120532.png"
                                        alt="自动整理本地文章"
                                        className="w-full h-auto rounded-xl shadow-lg" />
                                </div>
                                <h3 className="text-2xl font-bold mb-4 text-gray-800">发起任务自动执行</h3>
                                <div className="space-y-4">
                                    <div className="flex items-start">
                                        <div className="bg-[#ffd100]/20 p-1 rounded-full mr-3 mt-1">
                                            <CheckCircle className="w-4 h-4 text-[#d40000]" />
                                        </div>
                                        <div>
                                            <h4
                                                className="font-bold text-gray-800"
                                                style={{
                                                    fontFamily: "\"Noto Sans SC\", sans-serif"
                                                }}>自动化任务</h4>
                                            <p className="text-gray-600 text-sm">区别于普通对话机器人，它能直接操控本地应用，执行批量创作与文件管理。</p>
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
                                                    fontFamily: "\"Noto Sans SC\", sans-serif"
                                                }}>5000+ 技能</h4>
                                            <p className="text-gray-600 text-sm">对接 ClawHub 生态，一条指令即可调用海量插件。</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                        <motion.div
                            className="bg-linear-to-br from-white to-[#fff0f0] rounded-xl shadow-xl overflow-hidden border border-gray-100"
                            initial={{
                                opacity: 0,
                                y: 20
                            }}
                            whileInView={{
                                opacity: 1,
                                y: 0
                            }}
                            viewport={{
                                root: scrollContainerRef,
                                once: true
                            }}
                            transition={{
                                duration: 0.6,
                                delay: 0.4
                            }}
                            whileHover={{
                                y: -5
                            }}>
                            <div className="p-8">
                                <div className="mb-6">
                                    <img
                                        src="https://lf-code-agent.coze.cn/obj/x-ai-cn/267088422146/attachment/专属写作_20260320133701.png"
                                        alt="专属协作编辑器"
                                        className="w-full h-auto rounded-xl shadow-lg"
                                        style={{
                                            backgroundColor: "transparent"
                                        }} />
                                </div>
                                <h3 className="text-2xl font-bold mb-4 text-gray-800">专属写作编辑器</h3>
                                <div className="space-y-4">
                                    <div className="flex items-start">
                                        <div className="bg-[#ffd100]/20 p-1 rounded-full mr-3 mt-1">
                                            <CheckCircle className="w-4 h-4 text-[#d40000]" />
                                        </div>
                                        <div>
                                            <h4
                                                className="font-bold text-gray-800"
                                                style={{
                                                    fontFamily: "\"Noto Sans SC\", sans-serif"
                                                }}>沉浸写作</h4>
                                            <p className="text-gray-600 text-sm">自带文本区域，支持实时润色与格式调整，告别繁琐的文件导入导出。</p>
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
                                                    fontFamily: "\"Noto Sans SC\", sans-serif"
                                                }}>越用越懂</h4>
                                            <p className="text-gray-600 text-sm">具备本地持续记忆功能，自动学习作者的文风偏好。</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                        <motion.div
                            className="bg-linear-to-br from-white to-[#fff0f0] rounded-xl shadow-xl overflow-hidden border border-gray-100"
                            initial={{
                                opacity: 0,
                                y: 20
                            }}
                            whileInView={{
                                opacity: 1,
                                y: 0
                            }}
                            viewport={{
                                root: scrollContainerRef,
                                once: true
                            }}
                            transition={{
                                duration: 0.6,
                                delay: 0.6
                            }}
                            whileHover={{
                                y: -5
                            }}>
                            <div className="p-8">
                                <div className="mb-6">
                                    <img
                                        src="https://lf-code-agent.coze.cn/obj/x-ai-cn/267088422146/attachment/远程控制_20260320120537.png"
                                        alt="远程控制与安全"
                                        className="w-full h-auto rounded-xl shadow-lg" />
                                </div>
                                <h3 className="text-2xl font-bold mb-4 text-gray-800">多端协作与安全</h3>
                                <div className="space-y-4">
                                    <div className="flex items-start">
                                        <div className="bg-[#ffd100]/20 p-1 rounded-full mr-3 mt-1">
                                            <CheckCircle className="w-4 h-4 text-[#d40000]" />
                                        </div>
                                        <div>
                                            <h4
                                                className="font-bold text-gray-800"
                                                style={{
                                                    fontFamily: "\"Noto Sans SC\", sans-serif"
                                                }}>移动协同</h4>
                                            <p className="text-gray-600 text-sm">微信QQ直接对话，远程操控，灵感随手下发，电脑自动开工。</p>
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
                                                    fontFamily: "\"Noto Sans SC\", sans-serif"
                                                }}>本地部署</h4>
                                            <p className="text-gray-600 text-sm">无云端后台，数据 100% 留存在本地，守护创作原稿隐私。</p>
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
                            y: 20
                        }}
                        whileInView={{
                            opacity: 1,
                            y: 0
                        }}
                        viewport={{
                            root: scrollContainerRef,
                            once: true
                        }}
                        transition={{
                            duration: 0.6,
                            delay: 0.8
                        }}
                        whileHover={{
                            y: -5
                        }}>
                        <div className="p-8 flex items-center justify-center">
                            <h3 className="text-2xl md:text-3xl font-bold text-gray-800 text-center">更多功能等你发现
                            </h3>
                        </div>
                    </motion.div>
                </div>
            </section>

            <section id="scenarios" className="py-16 bg-linear-to-b from-white to-[#fff0f0]">
                <div className="max-w-[80%] mx-auto px-4 sm:px-6 lg:px-8">
                    <motion.div
                        className="text-center mb-12"
                        initial={{
                            opacity: 0,
                            y: 20
                        }}
                        whileInView={{
                            opacity: 1,
                            y: 0
                        }}
                        viewport={{
                            root: scrollContainerRef,
                            once: true
                        }}
                        transition={{
                            duration: 0.6
                        }}>
                        <h2 className="text-3xl font-bold text-gray-800 mb-4">适用什么样的场景<br /></h2>
                        <div className="w-20 h-1 bg-[#d40000] mx-auto"></div>
                    </motion.div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {[{
                            icon: <PenTool className="w-8 h-8 text-[#d40000]" />,
                            title: "短篇创作辅助",
                            description: "智能构思剧情、优化文笔、补充细节，快速完成短篇故事创作。"
                        }, {
                            icon: <FileText className="w-8 h-8 text-[#d40000]" />,
                            title: "剧本脚本生成",
                            description: "一键生成剧本框架、台词设计，支持场景、人物对话优化调整。"
                        }, {
                            icon: <Zap className="w-8 h-8 text-[#d40000]" />,
                            title: "文案润色优化",
                            description: "自动修正语病、优化表达，贴合不同文风，提升文字质感。"
                        }, {
                            icon: <Lightbulb className="w-8 h-8 text-[#d40000]" />,
                            title: "创作灵感补给",
                            description: "输入关键词，一键生成选题、大纲，解决写作卡壳难题。"
                        }].map((scenario, index) => <motion.div
                            key={index}
                            className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-shadow"
                            initial={{
                                opacity: 0,
                                y: 20
                            }}
                            whileInView={{
                                opacity: 1,
                                y: 0
                            }}
                            viewport={{
                                root: scrollContainerRef,
                                once: true
                            }}
                            transition={{
                                duration: 0.6,
                                delay: index * 0.1
                            }}
                            whileHover={{
                                y: -5
                            }}>
                            <div className="mb-4 p-2 bg-[#fff9ed] inline-flex rounded-full">
                                {scenario.icon}
                            </div>
                            <h3
                                className="text-lg font-bold mb-2 text-gray-800"
                                style={{
                                    fontFamily: "\"Noto Sans SC\", sans-serif"
                                }}>
                                {scenario.title}
                            </h3>
                            <p className="text-gray-600 text-sm">{scenario.description}</p>
                        </motion.div>)}
                    </div>
                </div>
            </section>

            <section
                id="guide"
                className="py-16 bg-linear-to-br from-[#d40000] to-[#ff7070] text-white">
                <div className="max-w-[80%] mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <motion.div
                        initial={{
                            opacity: 0,
                            y: 20
                        }}
                        whileInView={{
                            opacity: 1,
                            y: 0
                        }}
                        viewport={{
                            root: scrollContainerRef,
                            once: true
                        }}
                        transition={{
                            duration: 0.8
                        }}>
                        <h2 className="text-3xl md:text-4xl font-bold mb-6">准备好改变你的创作方式了吗？</h2>
                        <p className="text-xl mb-8 max-w-2xl mx-auto text-white/90">随时随地，爆文猫写作版龙虾帮你高效写作，开启全新的创作体验！</p>
                        <CtaDownloadButton />
                        <p className="mt-4 text-white/70">支持 Mac / Win 双平台</p>
                    </motion.div>
                </div>
            </section>

            <footer className="py-8 bg-gray-900 text-white/80">
                <div className="max-w-[80%] mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col md:flex-row justify-between items-center">
                        <div className="flex items-center space-x-2 mb-4 md:mb-0">
                            <img
                                src="https://lf-code-agent.coze.cn/obj/x-ai-cn/attachment/3894913543964963/客户端logo_20260319111723.png"
                                alt="爆文猫写作版龙虾Logo"
                                className="h-8 w-auto rounded-sm" />
                            <span className="ml-2 text-lg font-bold">爆文猫写作版龙虾</span>
                        </div>
                        <div className="flex space-x-6 mb-4 md:mb-0">
                            <button
                                type="button"
                                onClick={() => navigate("/privacy-policy")}
                                className="hover:text-white transition-colors">隐私政策</button>
                            <button
                                type="button"
                                onClick={() => navigate("/user-agreement")}
                                className="hover:text-white transition-colors">用户协议</button>
                            <button
                                type="button"
                                onClick={() => setShowContactModal(true)}
                                className="hover:text-white transition-colors">联系我们</button>
                        </div>
                        <div className="text-sm">© 2026 爆文猫写作版龙虾 版权所有</div>
                    </div>
                </div>
            </footer>
            { }
            {showContactModal && <div
                className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <motion.div
                    initial={{
                        opacity: 0,
                        scale: 0.9
                    }}
                    animate={{
                        opacity: 1,
                        scale: 1
                    }}
                    exit={{
                        opacity: 0,
                        scale: 0.9
                    }}
                    className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-bold text-gray-800">联系我们</h3>
                        <button
                            onClick={() => setShowContactModal(false)}
                            className="text-gray-500 hover:text-gray-700">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-6 w-6"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor">
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                        <div className="flex flex-col items-center">
                            <div className="w-40 h-40 bg-white p-2 rounded-lg shadow-lg mb-2">
                                { }
                                <img
                                    src="https://space.coze.cn/api/coze_space/gen_image?image_size=square&prompt=Feishu%20QR%20code%2C%20business%20communication&sign=747f2860c770e73c201167a915993917"
                                    alt="飞书二维码"
                                    className="w-full h-full object-contain" />
                            </div>
                            <p className="text-sm text-gray-600">飞书</p>
                        </div>
                        <div className="flex flex-col items-center">
                            <div className="w-40 h-40 bg-white p-2 rounded-lg shadow-lg mb-2">
                                { }
                                <img
                                    src="https://space.coze.cn/api/coze_space/gen_image?image_size=square&prompt=WeChat%20Work%20QR%20code%2C%20business%20communication&sign=3439f23d63a5175492b22b8c39b7a8d4"
                                    alt="企业微信二维码"
                                    className="w-full h-full object-contain" />
                            </div>
                            <p className="text-sm text-gray-600">企业微信</p>
                        </div>
                    </div>
                </motion.div>
            </div>}
        </div>
    );
}