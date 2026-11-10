// src/components/LondonSky.jsx
// =============================================================
// 夜間模式 header 裝飾：英國夜空（全部為 CSS／SVG，無外部圖檔）
//
// - 彎月＋柔光、零星星星
// - 倫敦霧雲：三朵低透明度的雲緩慢飄過
// - 飛行表演隊：三架小噴射機排成梯隊，拖著低飽和的紅／白／藍彩煙，每 28 秒飛過一次
// - 鳥群：五隻鳥排成 V 字形，每 40 秒由右往左飛過
// 動畫寫在 index.css（.ls-*）；系統開啟「減少動態效果」時只保留靜態的月亮與雲
// =============================================================
import React from "react";

// 小噴射機（側面剪影，機頭朝右）
const Jet = () => (
  <svg width="14" height="6" viewBox="0 0 14 6" aria-hidden="true">
    <path d="M0 3 L4 2 L7 0.2 L8 2 L13 2.6 L14 3 L13 3.4 L8 4 L7 5.8 L4 4 Z" fill="rgba(255,236,214,0.7)" />
  </svg>
);

// 雲（三個圓角疊在一起）
const Cloud = ({ w = 90, o = 0.06 }) => (
  <svg width={w} height={w * 0.36} viewBox="0 0 100 36" aria-hidden="true">
    <g fill={`rgba(255,236,214,${o})`}>
      <ellipse cx="30" cy="24" rx="26" ry="11" />
      <ellipse cx="55" cy="16" rx="24" ry="14" />
      <ellipse cx="76" cy="25" rx="22" ry="10" />
    </g>
  </svg>
);

const SMOKE = ["rgba(181,84,74,0.55)", "rgba(232,225,214,0.45)", "rgba(90,112,153,0.55)"];

export default function LondonSky() {
  return (
    <div className="ls-sky relative h-[56px] flex-1 mx-6 overflow-hidden pointer-events-none select-none" aria-hidden="true">
      {/* 星星 */}
      {[[6, 12], [17, 30], [29, 8], [41, 22], [53, 10], [64, 34], [72, 14], [88, 28], [95, 9]].map(([l, t], i) => (
        <span key={i} className="lg-star absolute rounded-full" style={{ left: `${l}%`, top: t, animationDelay: `${i * 0.6}s` }} />
      ))}

      {/* 彎月 */}
      <div className="absolute" style={{ right: "7%", top: 6 }}>
        <div className="absolute -inset-4 rounded-full" style={{ background: "radial-gradient(circle, rgba(240,210,160,0.16), transparent 70%)" }} />
        <svg width="26" height="26" viewBox="0 0 26 26" className="relative">
          <defs>
            <mask id="ls-moon"><rect width="26" height="26" fill="white" /><circle cx="17" cy="10" r="9" fill="black" /></mask>
          </defs>
          <circle cx="13" cy="13" r="10" fill="rgba(240,214,170,0.8)" mask="url(#ls-moon)" />
        </svg>
      </div>

      {/* 霧雲 */}
      <div className="ls-cloud absolute" style={{ top: 4, animationDuration: "95s", animationDelay: "-10s" }}><Cloud w={110} o={0.06} /></div>
      <div className="ls-cloud absolute" style={{ top: 22, animationDuration: "130s", animationDelay: "-70s" }}><Cloud w={80} o={0.05} /></div>
      <div className="ls-cloud absolute" style={{ top: 12, animationDuration: "110s", animationDelay: "-40s" }}><Cloud w={140} o={0.04} /></div>

      {/* 飛行表演隊：三機梯隊＋彩煙 */}
      <div className="ls-jets absolute left-0" style={{ top: 16 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} className="absolute flex items-center" style={{ top: i * 6, left: -i * 10 }}>
            <span className="ls-smoke block h-[3px] rounded-full"
                  style={{ width: 150, background: `linear-gradient(90deg, transparent, ${SMOKE[i]})` }} />
            <Jet />
          </div>
        ))}
      </div>

      {/* 鳥群（V 字形，由右往左） */}
      <div className="ls-birds absolute right-0" style={{ top: 10 }}>
        <svg width="46" height="20" viewBox="0 0 46 20" aria-hidden="true">
          <g stroke="rgba(255,236,214,0.4)" strokeWidth="1.1" fill="none" strokeLinecap="round" className="ls-flap">
            {[[4, 10], [12, 5], [20, 1.5], [12, 15], [28, 6]].map(([x, y], i) => (
              <path key={i} d={`M${x} ${y + 2} q2.5 -2.5 5 0 q2.5 -2.5 5 0`} />
            ))}
          </g>
        </svg>
      </div>
    </div>
  );
}
