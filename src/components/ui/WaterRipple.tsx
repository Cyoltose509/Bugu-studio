"use client";

/** 水波纹加载效果 — 用于 /works 页面流式渲染 */
export default function WaterRipple({ text = "加载中..." }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      {/* 水波纹动画 */}
      <div className="relative w-16 h-16 mb-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="absolute inset-0 rounded-full border-2 animate-water-ripple"
            style={{
              borderColor: "#3388BB",
              animationDelay: `${i * 0.3}s`,
            }}
          />
        ))}
      </div>
      <p className="text-sm" style={{ color: "#777" }}>{text}</p>

      <style jsx>{`
        @keyframes waterRipple {
          0%   { transform: scale(0.2); opacity: 0.8; }
          100% { transform: scale(1.8); opacity: 0; }
        }
        .animate-water-ripple {
          animation: waterRipple 1.2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
      `}</style>
    </div>
  );
}
