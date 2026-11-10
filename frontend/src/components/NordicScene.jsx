// src/components/NordicScene.jsx
// =============================================================
// 日間模式頁面底部裝飾：拉普蘭雪國（SVG 手繪，無外部圖檔）
//
// 場景：雪丘、積雪松樹、冒煙的小木屋（窗戶透暖光），雪花零星飄落
// 馴鹿：共用 useWanderer 狀態機
//   - walk ：四腳交替、身體輕微起伏
//   - idle ：站著張望，偶爾轉身
//   - graze：40% 機率停下來低頭吃草（data-grazing="1"，頭部往下轉）
// =============================================================
import React, { useRef } from "react";
import useWanderer from "./useWanderer";

// ---------- 馴鹿（原創扁平風格，面向右） ----------
function Reindeer() {
  const body = "#8b7262", dark = "#6f5a4c", antler = "#a3907c";
  return (
    <svg width="52" height="44" viewBox="0 0 52 44" aria-hidden="true" className="nr-body" style={{ overflow: "visible" }}>
      {/* 後方兩腳（顏色深一點，做出前後層次） */}
      <g className="nr-leg nr-leg-b"><rect x="11" y="27" width="3" height="15" fill={dark} /><rect x="10.6" y="41" width="3.8" height="2" fill="#4a3d34" /></g>
      <g className="nr-leg nr-leg-a"><rect x="33" y="27" width="3" height="15" fill={dark} /><rect x="32.6" y="41" width="3.8" height="2" fill="#4a3d34" /></g>
      {/* 身體 */}
      <path d="M8 18 Q8 14 13 14 H36 Q41 14 41 19 V27 Q41 30 37 30 H12 Q8 30 8 26 Z" fill={body} />
      {/* 白色腹部與尾巴 */}
      <path d="M13 28 H35 Q34 30.5 31 30.5 H16 Q13 30.5 13 28 Z" fill="#efeae0" />
      <path d="M8.5 17 Q5 16 5.5 13" stroke="#efeae0" strokeWidth="2.6" strokeLinecap="round" fill="none" />
      {/* 前方兩腳 */}
      <g className="nr-leg nr-leg-a"><rect x="15" y="27" width="3" height="15" fill={body} /><rect x="14.6" y="41" width="3.8" height="2" fill="#4a3d34" /></g>
      <g className="nr-leg nr-leg-b"><rect x="36.5" y="27" width="3" height="15" fill={body} /><rect x="36.1" y="41" width="3.8" height="2" fill="#4a3d34" /></g>
      {/* 頭頸（吃草時以脖子根部為軸往下轉） */}
      <g className="nr-head">
        <path d="M36 18 L41 7 H46 L49 12 L47 15 L42 15 L40 21 Z" fill={body} />
        <path d="M37 16 Q38 20 41 21" stroke="#efeae0" strokeWidth="2" fill="none" />
        <circle cx="45" cy="9.5" r="0.9" fill="#2a2420" />
        <circle cx="49" cy="12.5" r="1.1" fill="#4a3d34" />
        {/* 鹿角 */}
        <g stroke={antler} strokeWidth="1.6" fill="none" strokeLinecap="round">
          <path d="M42 7 Q39 2 41 -4" /><path d="M40.4 1 L37 -1" /><path d="M41 -2 L44 -5" />
          <path d="M44.5 7 Q46 1 51 -2" /><path d="M47 2 L49 5" /><path d="M49 -0.5 L52 1" />
        </g>
        {/* 耳朵 */}
        <path d="M41.5 8 L38.5 6.5 L41 10 Z" fill={dark} />
      </g>
    </svg>
  );
}

// ---------- 積雪松樹 ----------
const Pine = ({ h = 40, o = 1 }) => (
  <svg width={h * 0.55} height={h} viewBox="0 0 22 40" aria-hidden="true" style={{ opacity: o }}>
    <rect x="10" y="33" width="2" height="7" fill="rgba(110,90,75,0.45)" />
    <path d="M11 0 L20 16 H15 L21 26 H15 L22 35 H0 L7 26 H1 L7 16 H2 Z" fill="rgba(80,100,90,0.32)" />
    <g fill="#ffffff"><path d="M11 0 L15 7.5 H7 Z" /><path d="M5.5 16 L9 13 L12 16 Z" opacity=".9" /><path d="M14 26 L17 23 L19 26 Z" opacity=".9" /></g>
  </svg>
);

// ---------- 小木屋（煙囪冒煙） ----------
function Cabin() {
  return (
    <svg width="50" height="48" viewBox="0 0 64 62" aria-hidden="true" style={{ overflow: "visible" }}>
      {/* 煙 */}
      {[0, 1, 2].map((i) => (
        <circle key={i} className="nc-smoke" cx="46" cy="14" r="4" fill="rgba(150,160,170,0.35)" style={{ animationDelay: `${i * 1.3}s` }} />
      ))}
      <rect x="43" y="14" width="6" height="12" fill="#6b5546" />
      <path d="M8 62 V36 L32 20 L56 36 V62 Z" fill="#8a6a55" />
      {/* 屋頂積雪 */}
      <path d="M3 38 L32 18 L61 38 L58 40 L32 22.5 L6 40 Z" fill="#ffffff" stroke="rgba(150,165,180,0.35)" strokeWidth="0.8" />
      {/* 木紋 */}
      <g stroke="rgba(0,0,0,0.08)" strokeWidth="1">{[44, 50, 56].map((y) => <line key={y} x1="9" y1={y} x2="55" y2={y} />)}</g>
      {/* 暖光窗戶 */}
      <rect x="14" y="42" width="12" height="10" fill="#e8c88a" className="nc-window" />
      <path d="M20 42 V52 M14 47 H26" stroke="#8a6a55" strokeWidth="1.2" />
      <rect x="36" y="44" width="10" height="18" fill="#5a4535" />
    </svg>
  );
}

export default function NordicScene({ className = "" }) {
  const wrapRef = useRef(null);
  const deerRef = useRef(null);
  useWanderer(wrapRef, deerRef, { speed: 16, edge: 30, patrolChance: 0.15, turnChance: 0.3, idleAttr: "grazing", idleAttrChance: 0.4, startAt: 0.3 });

  return (
    <div ref={wrapRef} className={`ns-scene relative h-[60px] overflow-hidden pointer-events-none select-none ${className}`} aria-hidden="true">
      {/* 遠方雪丘 */}
      <svg className="absolute bottom-0 left-0 w-full h-[30px]" viewBox="0 0 400 30" preserveAspectRatio="none">
        <path d="M0 30 V18 Q60 6 130 16 T260 12 T400 16 V30 Z" fill="rgba(210,218,226,0.35)" />
      </svg>
      {/* 遠景松樹（淡） */}
      {[["8%", 26, .5], ["11%", 20, .45], ["47%", 24, .45], ["50.5%", 18, .4], ["88%", 26, .5]].map(([l, h, o], i) => (
        <div key={`f${i}`} className="absolute bottom-[8px]" style={{ left: l }}><Pine h={h} o={o} /></div>
      ))}
      {/* 近處雪地 */}
      <svg className="absolute bottom-0 left-0 w-full h-[16px]" viewBox="0 0 400 16" preserveAspectRatio="none">
        <path d="M0 16 V7 Q100 1 200 6 T400 5 V16 Z" fill="#fbfbfa" stroke="rgba(150,165,180,0.35)" strokeWidth="0.6" vectorEffect="non-scaling-stroke" />
      </svg>
      {/* 近景松樹與小木屋 */}
      <div className="absolute bottom-[4px]" style={{ left: "17%" }}><Pine h={44} /></div>
      <div className="absolute bottom-[4px]" style={{ left: "20%" }}><Pine h={32} /></div>
      <div className="absolute bottom-[4px]" style={{ left: "64%" }}><Cabin /></div>
      <div className="absolute bottom-[4px]" style={{ right: "6%" }}><Pine h={46} /></div>
      <div className="absolute bottom-[4px]" style={{ right: "9.5%" }}><Pine h={34} /></div>
      {/* 零星落雪 */}
      {Array.from({ length: 14 }, (_, i) => (
        <span key={i} className="ns-flake absolute rounded-full"
          style={{ left: `${(i * 7.3 + 3) % 100}%`, width: 2, height: 2, opacity: .55,
                   animationDuration: `${8 + (i % 5)}s, ${3 + (i % 3)}s`, animationDelay: `${-i * 0.9}s, ${-i * 0.5}s`, "--sway": "6px" }} />
      ))}
      {/* 馴鹿 */}
      <div ref={deerRef} className="nr-deer absolute bottom-[3px] left-0" style={{ marginLeft: -26 }}>
        <div style={{ transition: "transform .3s ease" }}><Reindeer /></div>
      </div>
    </div>
  );
}
