import * as React from "react"

import { cn } from "@/lib/utils"

export interface InputProps extends React.ComponentProps<"input"> {
  /** 是否显示字数统计（与 el-input show-word-limit 一致，需配合 maxLength 使用） */
  showWordLimit?: boolean
}

function Input({ className, type, showWordLimit, value, maxLength, ...props }: InputProps) {
  const length = typeof value === "string" ? value.length : 0
  const showLimit = showWordLimit && maxLength != null

  return (
    <div className="relative w-full min-w-0">
      <input
        type={type}
        data-slot="input"
        value={value}
        maxLength={maxLength}
        className={cn(
          "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
          "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
          showLimit && "pr-12",
          className
        )}
        {...props}
      />
      {showLimit && (
        <div
          className="text-muted-foreground pointer-events-none absolute bottom-0 right-3 top-0 flex items-end justify-end pb-1.5 text-xs"
          aria-live="polite"
        >
          {length} / {maxLength}
        </div>
      )}
    </div>
  )
}

export { Input }
