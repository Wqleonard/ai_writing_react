import { cva } from "class-variance-authority"

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive cursor-pointer",
  {
    variants: {
      variant: {
        default: "bg-(--theme-color) text-white hover:bg-(--theme-color)/90",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border bg-background hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
        // Quick Editor 专用变体
        "quick-primary":
          "bg-gradient-to-r from-[#efaf00] to-[#ff9500] text-white font-bold hover:from-[#efaf00]/90 hover:to-[#ff9500]/90 hover:-translate-y-[2px] shadow-[0_4px_12px_rgba(0,0,0,0.15)] hover:shadow-[0_6px_16px_rgba(0,0,0,0.2)]",
        "quick-revert":
          "bg-white text-[#999999] border-2 border-solid border-[#999999] font-normal hover:text-[var(--bg-editor-save)] hover:border-[var(--bg-editor-save)] hover:-translate-y-[2px] shadow-[0_4px_12px_rgba(0,0,0,0.1)] hover:shadow-[0_6px_16px_rgba(0,0,0,0.15)]",
        "quick-tag":
          "border border-black/20 bg-transparent text-[#4d4d4d] font-normal hover:border-black/30",
        "quick-tag-selected":
          "border-none bg-gradient-to-r from-[#efaf00] to-[#ff9500] text-white font-bold hover:from-[#efaf00]/90 hover:to-[#ff9500]/90",
        "quick-ghost":
          "bg-transparent border-none text-[#999999] hover:text-[var(--bg-editor-save)]",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
        // Quick Editor 专用尺寸
        "quick-confirm": "h-[52px] w-[221px] text-[28px] font-bold leading-[1.32em] px-0 rounded-[10px]",
        "quick-revert-size": "h-[52px] w-[261px] text-[28px] font-normal leading-[1.32em] px-0 py-[7px] rounded-[10px]",
        "quick-action": "h-[46px] w-[200px] text-[24px] font-bold leading-[1.32em] px-0 py-0 rounded-[8px]",
        "quick-action-revert": "h-[46px] w-[230px] text-[24px] font-normal leading-[1.32em] px-0 py-[6px] rounded-[8px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)
