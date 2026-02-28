export interface StreamIndicatorProps {
  className?: string
}

const dotBase =
  'size-1.5 rounded-full bg-current opacity-30 animate-[stream-pulse_1.4s_ease-in-out_infinite]'

export const StreamIndicator = ({ className }: StreamIndicatorProps) => {
  return (
    <>
      <style>
        {`
        @keyframes stream-pulse {
          0%, 60%, 100% { opacity: 0.3; }
          30% { opacity: 1; }
        }
        `}
      </style>
      <div
        className={`flex h-7 w-8 shrink-0 items-center justify-start gap-1 ${className ?? ''}`.trim()}
      >
        <span className={dotBase} style={{ animationDelay: '-0.32s' }} />
        <span className={dotBase} style={{ animationDelay: '-0.16s' }} />
        <span className={dotBase} />
      </div>
    </>
  )
}
