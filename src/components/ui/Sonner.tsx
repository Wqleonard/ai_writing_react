import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { isMobileDevice } from "@/utils/rem.ts";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()
  const isMobile = isMobileDevice();
  const iconSize = isMobile ? "size-8" : "size-4"

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className={iconSize} />,
        info: <InfoIcon className={iconSize} />,
        warning: <TriangleAlertIcon className={iconSize} />,
        error: <OctagonXIcon className={iconSize} />,
        loading: <Loader2Icon className={`${iconSize} animate-spin`} />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
