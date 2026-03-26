import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { toast as sonnerToast, type ExternalToast } from "sonner";
import { isMobileDevice } from "@/utils/rem";

type ToastMessage = Parameters<typeof sonnerToast>[0];
type ToastKind =
  | "default"
  | "success"
  | "info"
  | "warning"
  | "error"
  | "loading";

const MOBILE_TOAST_DURATION = 2000;


function resolveToastMessage(message: ToastMessage): React.ReactNode {
  return typeof message === "function" ? message() : message;
}

function renderMobileHeadlessToast(kind: ToastKind, message: ToastMessage) {
  const iconMap: Record<ToastKind, React.ReactNode> = {
    default: <InfoIcon className="size-10 text-[36px] text-[#666]" />,
    success: <CircleCheckIcon className="size-10 text-[36px] text-[#22a06b]" />,
    info: <InfoIcon className="size-10 text-[36px] text-[#2f81f7]" />,
    warning: (
      <TriangleAlertIcon className="size-10 text-[36px] text-[#d29922]" />
    ),
    error: <OctagonXIcon className="size-10 text-[36px] text-[#f85149]" />,
    loading: (
      <Loader2Icon className="size-10 text-[36px] animate-spin text-[#666]" />
    ),
  };

  if (kind == "default") {
    return (
      <div className="w-89 flex items-center justify-center">
        <div className="mx-auto flex items-center justify-center rounded-xl border border-border bg-popover px-8 py-5 text-center text-3xl leading-normal shadow-lg">
          {resolveToastMessage(message)}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-89 flex items-center justify-center h-fit">
      <div className="rounded-xl border border-border bg-popover px-4 py-3 shadow-lg">
        <div className="flex items-center gap-2">
          <span className="mt-0.5 shrink-0">{iconMap[kind]}</span>
          <div className="text-3xl leading-8 text-popover-foreground wrap-break-word">
            {resolveToastMessage(message)}
          </div>
        </div>
      </div>
    </div>
  );
}

function createMobileAwareToast(
  kind: ToastKind,
  message: ToastMessage,
  data?: ExternalToast,
) {
  const style = data?.style as React.CSSProperties | undefined;
  const toastOptions: ExternalToast = {
    ...data,
    position: data?.position ?? "top-center",
    style: {
      marginLeft: "auto",
      marginRight: "auto",
      width: "fit-content",
      maxWidth: "100%",
      ...style,
    },
  };

  if (!isMobileDevice()) {
    if (kind === "default") {
      return sonnerToast(message, toastOptions);
    }
    return sonnerToast[kind](message, toastOptions);
  }

  return sonnerToast.custom(() => renderMobileHeadlessToast(kind, message), {
    ...toastOptions,
    duration: toastOptions.duration ?? MOBILE_TOAST_DURATION,
  });
}

export const mtoast = Object.assign(
  (message: ToastMessage, data?: ExternalToast) =>
    createMobileAwareToast("default", message, data),
  {
    success: (message: ToastMessage, data?: ExternalToast) =>
      createMobileAwareToast("success", message, data),
    info: (message: ToastMessage, data?: ExternalToast) =>
      createMobileAwareToast("info", message, data),
    warning: (message: ToastMessage, data?: ExternalToast) =>
      createMobileAwareToast("warning", message, data),
    error: (message: ToastMessage, data?: ExternalToast) =>
      createMobileAwareToast("error", message, data),
    loading: (message: ToastMessage, data?: ExternalToast) =>
      createMobileAwareToast("loading", message, data),
    message: (message: ToastMessage, data?: ExternalToast) =>
      createMobileAwareToast("default", message, data),
    custom: sonnerToast.custom,
    promise: sonnerToast.promise,
    dismiss: sonnerToast.dismiss,
    getHistory: sonnerToast.getHistory,
    getToasts: sonnerToast.getToasts,
  },
) as typeof sonnerToast;
