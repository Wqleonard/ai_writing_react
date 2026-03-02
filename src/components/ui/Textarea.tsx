import * as React from "react"

import { cn } from "@/lib/utils"

export interface TextareaProps extends React.ComponentProps<"textarea"> {
  /** 是否显示字数统计（与 el-input show-word-limit 一致，需配合 maxLength 使用） */
  showWordLimit?: boolean
  resize?: boolean
  areaClassName?: string
}

const Textarea = ({
  className,
  showWordLimit,
  value,
  maxLength,
  resize = false,
  areaClassName,
  onFocus,
  onBlur,
  ...props
}: TextareaProps) => {
  const [focused, setFocused] = React.useState(false)
  const length = typeof value === "string" ? value.length : 0
  const showLimit = showWordLimit && maxLength != null

  return (
    <div className={cn(
      "relative w-full min-w-0 px-3 py-2 rounded-md border border-input transition-shadow",
      focused && "ring-[3px] ring-ring/50",
      className,
    )}>
      <textarea
        data-slot="textarea"
        value={value}
        maxLength={maxLength}
        className={cn(
          "flex min-h-[80px] w-full resize-none bg-background text-base text-foreground placeholder:text-muted-foreground outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          showLimit && "pb-6 pr-12",
          resize && 'resize-y!',
          areaClassName,
        )}
        onFocus={(e) => { setFocused(true); onFocus?.(e) }}
        onBlur={(e) => { setFocused(false); onBlur?.(e) }}
        {...props}
      />
      {showLimit && (
        <div
          className="text-muted-foreground pointer-events-none absolute bottom-2 right-3 text-right text-xs"
          aria-live="polite"
        >
          {length} / {maxLength}
        </div>
      )}
    </div>
  )
}

export { Textarea }

