import * as React from "react"
import { type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"
import { buttonVariants } from "./button-variants"

const LinkButton = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> &
    VariantProps<typeof buttonVariants> & {
      asChild?: boolean
    }
>(({ className, variant = "link", size = "default", asChild = false, disabled, ...props }, ref) => {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      ref={ref}
      type="button"
      data-slot="link-button"
      data-variant={variant}
      data-size={size}
      className={cn(
        className,
        "transition-[filter] cursor-pointer",
        disabled ? "cursor-not-allowed opacity-60" : "hover:brightness-110 active:brightness-90"
      )}
      disabled={disabled}
      {...props}
    />
  )
})
LinkButton.displayName = "LinkButton"

export { LinkButton }
