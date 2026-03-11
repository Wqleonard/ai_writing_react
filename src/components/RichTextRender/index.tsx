import React, { forwardRef } from "react";
import type { CSSProperties, HTMLAttributes } from "react";
import clsx from "clsx";
import "./index.less";

export interface RenderRichTextProps extends Omit<HTMLAttributes<HTMLElement>, "content" | "style" | "className"> {
  content?: string;
  className?: string;
  style?: CSSProperties;
  bordered?: boolean;
  maxHeight?: number | string;
  as?: "div" | "span" | "button";
  inline?: boolean;
  contentClassName?: string;
  contentStyle?: CSSProperties;
}

const RichTextRender = forwardRef<HTMLElement, RenderRichTextProps>(function RenderRichText(
  {
    content = "",
    className,
    style,
    bordered = false,
    maxHeight,
    as = "div",
    inline = false,
    contentClassName,
    contentStyle: contentStyleProp,
    ...rest
  },
  ref
) {
  if (!content.trim()) return null;

  const contentStyle: CSSProperties = {};
  if (maxHeight !== undefined && maxHeight !== null && maxHeight !== "") {
    contentStyle.maxHeight = typeof maxHeight === "number" ? `${maxHeight}px` : maxHeight;
    contentStyle.overflowY = "auto";
  }
  if (contentStyleProp) {
    Object.assign(contentStyle, contentStyleProp);
  }

  const WrapperTag = as;
  const ContentTag = as === "div" ? "div" : "span";

  return (
    <WrapperTag
      ref={ref as never}
      className={clsx(
        !inline && "render-rich-text",
        !inline && bordered && "render-rich-text-bordered",
        className
      )}
      style={style}
      {...rest}
    >
      <ContentTag
        className={clsx(!inline && "render-rich-text-content", contentClassName)}
        style={contentStyle}
        dangerouslySetInnerHTML={{ __html: content }}
      />
    </WrapperTag>
  );
});

export default RichTextRender;
