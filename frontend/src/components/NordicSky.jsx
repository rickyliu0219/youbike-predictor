// src/components/NordicSky.jsx
// =============================================================
// 日間模式 header 裝飾：拉普蘭雪國的天空（CSS／SVG，無外部圖檔）
//
// - 淡淡的冬季太陽＋柔光（緩慢呼吸）
// - 兩朵很淡的雲緩慢飄過
// - 細雪：大小、速度、起點各不同的雪花，邊落下邊左右輕晃
// 動畫寫在 index.css（.ns-*）；開啟「減少動態效果」時雪花不動
// =============================================================
import React, { useMemo } from "react";

const FLAKES = 34;

export default function NordicSky() {
  // 雪花參數只在第一次產生，避免每次 re-render 跳動
  const flakes = useMemo(() => Array.from({ length: FLAKES }, (_, i) => ({
    left: (i * 97.3) % 100,                       // 均勻但不規則地分布
    size: 1.6 + ((i * 37) % 10) / 6,              // 1.6–3.1 px
    dur: 7 + ((i * 53) % 70) / 10,                // 7–14 秒落完
    delay: -((i * 71) % 140) / 10,                // 負延遲 → 一進場就滿天都有雪
    sway: 6 + ((i * 29) % 10),                    // 左右晃動幅度
    o: 0.35 + ((i * 17) % 40) / 100,              // 透明度
  })), []);

  return (
    <div className="ns-sky relative h-[56px] flex-1 mx-6 overflow-hidden pointer-events-none select-none" aria-hidden="true">
      {/* 冬陽 */}
      <div className="absolute" style={{ right: "7%", top: 6 }}>
        <div className="ns-sun-glow absolute -inset-5 rounded-full" style={{ background: "radial-gradient(circle, rgba(240,214,160,0.35), transparent 70%)" }} />
        <div className="relative w-6 h-6 rounded-full" style={{ background: "rgba(240,214,160,0.7)" }} />
      </div>

      {/* 淡雲 */}
      {[{ top: 6, w: 120, d: "120s", del: "-30s" }, { top: 24, w: 90, d: "150s", del: "-95s" }].map((c, i) => (
        <div key={i} className="ls-cloud absolute" style={{ top: c.top, animationDuration: c.d, animationDelay: c.del }}>
          <svg width={c.w} height={c.w * 0.36} viewBox="0 0 100 36">
            <g fill="rgba(140,155,170,0.10)">
              <ellipse cx="30" cy="24" rx="26" ry="11" /><ellipse cx="55" cy="16" rx="24" ry="14" /><ellipse cx="76" cy="25" rx="22" ry="10" />
            </g>
          </svg>
        </div>
      ))}

      {/* 雪花 */}
      {flakes.map((f, i) => (
        <span key={i} className="ns-flake absolute rounded-full"
          style={{
            left: `${f.left}%`, width: f.size, height: f.size, opacity: f.o,
            animationDuration: `${f.dur}s, ${f.dur / 3}s`, animationDelay: `${f.delay}s, ${f.delay}s`,
            "--sway": `${f.sway}px`,
          }} />
      ))}
    </div>
  );
}
