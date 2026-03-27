import React from "react";

interface Bubble {
  size: number;
  left: number;
  top: number;
  delay: number;
}

interface BubblesContainerProps {
  bubbles?: Bubble[];
  isAnimate?: boolean;
  className?: string;
  bubbleColor?: string;
  containerWidth?: number | string;
  containerHeight?: number | string;
}

const defaultBubbles: Bubble[] = [
  { size: 115, left: 200, top: 115, delay: 0 },
  { size: 100, left: 32, top: 150, delay: 0.5 },
  { size: 48, left: 150, top: 204, delay: 3 },
  { size: 80, left: 370, top: 180, delay: 1.5 },
  { size: 32, left: 325, top: 156, delay: 2 },
  { size: 22, left: 300, top: 222, delay: 2.5 },
];

export default function BubblesContainer({
  bubbles = defaultBubbles,
  isAnimate = false,
  className = "",
  bubbleColor = "linear-gradient(180deg, #FFFEF9 0%, #f5d249 100%)",
  containerWidth = 450,
  containerHeight = 340,
}: BubblesContainerProps) {
  const containerStyle: React.CSSProperties = {
    width: typeof containerWidth === "number" ? `${containerWidth}px` : containerWidth,
    height: typeof containerHeight === "number" ? `${containerHeight}px` : containerHeight,
  };

  return (
    <div
      className={`bubbles-container ${className}`}
      style={containerStyle}
    >
      {bubbles.map((bubble, index) => (
        <div
          key={index}
          className={`bubble ${isAnimate ? "animate" : ""}`}
          style={{
            width: bubble.size,
            height: bubble.size,
            left: bubble.left,
            top: bubble.top,
            animationDelay: `${bubble.delay}s`,
            background: bubbleColor,
          }}
        />
      ))}
      <style>{`
        .bubbles-container {
          margin: 0 auto;
          pointer-events: none;
          position: relative;
        }
        .bubbles-container .bubble {
          position: absolute;
          left: 0;
          border-radius: 50%;
          opacity: 0.8;
          transition: opacity 0.3s ease;
        }
        .bubbles-container .bubble.animate {
          animation: bubble-bounce 3s infinite ease-in-out;
          animation-fill-mode: both;
        }
        @keyframes bubble-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-32px); }
        }
      `}</style>
    </div>
  );
}
