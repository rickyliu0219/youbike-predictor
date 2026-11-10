// src/components/LondonScene.jsx
// =============================================================
// 夜間模式頁面底部裝飾：倫敦夜景 2D 小動畫（全部為 SVG 手繪，無外部圖檔）
//
// 場景：遠方倫敦眼與城市剪影、星星閃爍、大笨鐘（時鐘指針＝現在時間）、
//       煤氣路燈（暖光微微閃動）、紅色電話亭
// 衛兵：用 requestAnimationFrame 驅動的簡單狀態機
//   - walk  ：以行軍速度走向隨機目標點（雙腳擺動、身體上下起伏）
//   - idle  ：立正站崗 1.5–4.5 秒，偶爾原地向後轉
//   - 30% 機率改成「定點巡邏」：在目前位置附近來回踱步
// 顏色採低飽和暖色，配合「暖炭」主題；系統開啟「減少動態效果」時衛兵只站崗不走動
// =============================================================
import React, { useEffect, useRef, useState } from "react";

const SPEED = 24;          // 行走速度（px/秒）
const EDGE = 26;           // 左右保留邊界（px）

// ---------- 衛兵（原創扁平風格，面向右） ----------
function Guard() {
  return (
    <svg width="24" height="50" viewBox="0 0 24 50" aria-hidden="true" className="lg-body">
      {/* 熊皮帽 */}
      <path d="M6 15 C6 5 8.5 1.5 12 1.5 C15.5 1.5 18 5 18 15 Z" fill="#2b2420" stroke="rgba(255,236,214,0.32)" strokeWidth="0.7" />
      {/* 帽子毛流高光，夜裡才看得出輪廓 */}
      <path d="M8.5 12 C8.3 7 9.8 4 12 3.4" stroke="rgba(255,236,214,0.18)" strokeWidth="1" fill="none" strokeLinecap="round" />
      {/* 臉與帽帶 */}
      <rect x="9" y="13.5" width="6" height="4.5" rx="1" fill="#d6b49a" />
      <path d="M9 15.5 Q12 19.5 15 15.5" stroke="#c9a15a" strokeWidth="0.8" fill="none" />
      {/* 雙腿（走路時擺動） */}
      <g className="lg-leg lg-leg-b"><rect x="12.3" y="31" width="3.4" height="15" fill="#1d1a20" /><rect x="12" y="45.5" width="4.6" height="2.5" rx="1" fill="#0f0d0c" /></g>
      <g className="lg-leg lg-leg-a"><rect x="8.3" y="31" width="3.4" height="15" fill="#25212a" /><rect x="8" y="45.5" width="4.6" height="2.5" rx="1" fill="#0f0d0c" /></g>
      {/* 紅色上衣 */}
      <rect x="6.5" y="18" width="11" height="14" rx="1.5" fill="#a3443a" />
      <rect x="12" y="18" width="5.5" height="14" rx="1" fill="#8f3a31" />
      {/* 鈕扣 */}
      {[20.5, 23, 25.5].map((y) => <circle key={y} cx="11.3" cy={y} r="0.55" fill="#eadfcf" />)}
      {/* 白腰帶 + 金扣 */}
      <rect x="6.5" y="27.3" width="11" height="1.8" fill="#e9e1d4" />
      <rect x="10.6" y="27.1" width="2.2" height="2.2" fill="#c9a15a" />
      {/* 擺動的左手 */}
      <g className="lg-arm"><rect x="5" y="18.5" width="2.6" height="11" rx="1.2" fill="#a3443a" /><rect x="5" y="28.8" width="2.6" height="2" rx="1" fill="#d6b49a" /></g>
      {/* 右肩扛槍 */}
      <rect x="17.4" y="18.5" width="2.6" height="9" rx="1.2" fill="#8f3a31" />
      <line x1="19.6" y1="4" x2="19.6" y2="27" stroke="#4a3f36" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M19.6 4 L19 0.6 L20.2 0.6 Z" fill="#b9b2a6" />
    </svg>
  );
}

// ---------- 大笨鐘（指針顯示現在時間） ----------
function BigBen({ now }) {
  const h = now.getHours() % 12, m = now.getMinutes();
  const hourDeg = h * 30 + m * 0.5, minDeg = m * 6;
  return (
    <svg width="34" height="64" viewBox="0 0 34 64" aria-hidden="true">
      <g fill="rgba(255,236,214,0.14)">
        <path d="M17 0 L19 9 L15 9 Z" />
        <rect x="12" y="9" width="10" height="6" />
        <rect x="10" y="15" width="14" height="18" />
        <rect x="11" y="33" width="12" height="31" />
      </g>
      {/* 窗格線 */}
      <g stroke="rgba(255,236,214,0.08)" strokeWidth="0.6">
        {[38, 44, 50, 56].map((y) => <line key={y} x1="11" y1={y} x2="23" y2={y} />)}
        <line x1="17" y1="33" x2="17" y2="64" />
      </g>
      {/* 鐘面：暖光 */}
      <circle cx="17" cy="24" r="5.4" fill="rgba(217,165,106,0.55)" className="lg-glow" />
      <circle cx="17" cy="24" r="5.4" fill="none" stroke="rgba(255,236,214,0.35)" strokeWidth="0.6" />
      <line x1="17" y1="24" x2="17" y2="21.2" stroke="#2a2420" strokeWidth="0.9" strokeLinecap="round" transform={`rotate(${hourDeg} 17 24)`} />
      <line x1="17" y1="24" x2="17" y2="19.6" stroke="#2a2420" strokeWidth="0.6" strokeLinecap="round" transform={`rotate(${minDeg} 17 24)`} />
    </svg>
  );
}

// ---------- 煤氣路燈 ----------
function Lamp() {
  return (
    <svg width="20" height="56" viewBox="0 0 20 56" aria-hidden="true">
      <circle cx="10" cy="9" r="9" fill="rgba(217,165,106,0.16)" className="lg-flicker" />
      <rect x="9" y="12" width="2" height="44" fill="rgba(255,236,214,0.22)" />
      <path d="M6 6 L14 6 L12.5 13 L7.5 13 Z" fill="rgba(240,200,140,0.75)" className="lg-flicker" />
      <path d="M5.5 5 L14.5 5 L10 1.5 Z" fill="rgba(255,236,214,0.3)" />
    </svg>
  );
}

// ---------- 紅色電話亭 ----------
function PhoneBox() {
  return (
    <svg width="16" height="34" viewBox="0 0 16 34" aria-hidden="true">
      <path d="M1 5 Q8 0 15 5 L15 34 L1 34 Z" fill="#7d3a32" />
      <rect x="2.5" y="6" width="11" height="2.2" fill="#2a1f1c" />
      <g fill="rgba(240,200,140,0.35)">
        {[10, 15, 20].map((y) => [3.5, 8.5].map((x) => <rect key={`${x}${y}`} x={x} y={y} width="4" height="4" />))}
      </g>
    </svg>
  );
}

export default function LondonScene({ className = "" }) {
  const wrapRef = useRef(null);
  const guardRef = useRef(null);
  const [now, setNow] = useState(() => new Date());

  // 大笨鐘每 30 秒更新一次
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  // 衛兵狀態機
  useEffect(() => {
    const wrap = wrapRef.current, guard = guardRef.current;
    if (!wrap || !guard) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const rand = (a, b) => a + Math.random() * (b - a);
    const width = () => wrap.clientWidth;

    const st = { x: width() * 0.4, dir: 1, mode: "idle", until: performance.now() + 1200, target: 0, patrol: null };
    const render = () => {
      guard.style.transform = `translateX(${st.x}px)`;
      guard.dataset.walking = st.mode === "walk" ? "1" : "0";
      guard.firstChild.style.transform = `scaleX(${st.dir})`;
    };
    render();
    if (reduce) return;

    let raf, last = performance.now();
    const tick = (t) => {
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      const W = width();
      if (st.mode === "idle" && t > st.until) {
        // 選下一個目標：定點巡邏（在附近 40–70px 來回）或走到隨機位置
        if (st.patrol && st.patrol.left > 0) {
          st.target = st.patrol.flip ? st.patrol.a : st.patrol.b;
          st.patrol.flip = !st.patrol.flip; st.patrol.left -= 1;
        } else if (Math.random() < 0.3) {
          const a = Math.max(EDGE, st.x - rand(20, 35)), b = Math.min(W - EDGE, st.x + rand(20, 35));
          st.patrol = { a, b, flip: false, left: 3 + Math.floor(rand(0, 3)) };
          st.target = b;
        } else {
          st.patrol = null;
          do { st.target = rand(EDGE, W - EDGE); } while (Math.abs(st.target - st.x) < 50 && W > 160);
        }
        st.dir = st.target > st.x ? 1 : -1;
        st.mode = "walk";
      } else if (st.mode === "walk") {
        st.x += st.dir * SPEED * dt;
        if ((st.dir > 0 && st.x >= st.target) || (st.dir < 0 && st.x <= st.target)) {
          st.x = st.target;
          st.mode = "idle";
          st.until = t + (st.patrol ? rand(600, 1400) : rand(1500, 4500));
          if (!st.patrol && Math.random() < 0.35) st.dir *= -1;   // 原地向後轉
        }
      }
      st.x = Math.max(EDGE, Math.min(W - EDGE, st.x));
      render();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div ref={wrapRef} className={`lg-scene relative h-[60px] overflow-hidden pointer-events-none select-none ${className}`} aria-hidden="true">
      {/* 星星 */}
      {[[8, 10], [19, 22], [31, 8], [44, 16], [57, 6], [66, 24], [79, 12], [91, 20]].map(([l, t], i) => (
        <span key={i} className="lg-star absolute rounded-full" style={{ left: `${l}%`, top: t, animationDelay: `${i * 0.7}s` }} />
      ))}
      {/* 遠方剪影：城市＋倫敦眼 */}
      <svg className="absolute bottom-0 left-0 w-full h-[34px]" viewBox="0 0 400 34" preserveAspectRatio="none">
        <path d="M0 34 V24 H18 V18 H30 V26 H52 V14 H60 V22 H84 V27 H120 V20 H134 V25 H170 V22 H196 V28 H240 V19 H252 V24 H300 V21 H330 V26 H372 V18 H384 V25 H400 V34 Z"
              fill="rgba(255,236,214,0.045)" />
      </svg>
      <svg className="absolute bottom-0" style={{ left: "38%" }} width="44" height="48" viewBox="0 0 44 48">
        <g stroke="rgba(255,236,214,0.09)" fill="none" strokeWidth="1">
          <circle cx="22" cy="22" r="18" />
          {Array.from({ length: 8 }, (_, i) => <line key={i} x1="22" y1="22" x2={22 + 18 * Math.cos(i * Math.PI / 4)} y2={22 + 18 * Math.sin(i * Math.PI / 4)} />)}
          <path d="M14 48 L22 22 L30 48" />
        </g>
      </svg>
      {/* 地面線 */}
      <div className="absolute bottom-[3px] left-0 right-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(255,236,214,0.12) 15%, rgba(255,236,214,0.12) 85%, transparent)" }} />
      {/* 地標 */}
      <div className="absolute bottom-[3px]" style={{ left: "16%" }}><Lamp /></div>
      <div className="absolute bottom-[3px]" style={{ left: "62%" }}><PhoneBox /></div>
      <div className="absolute bottom-[3px]" style={{ right: "6%" }}><BigBen now={now} /></div>
      {/* 衛兵（在地標前方走動） */}
      <div ref={guardRef} className="lg-guard absolute bottom-[1px] left-0" style={{ marginLeft: -12 }}>
        <div style={{ transition: "transform .25s ease" }}><Guard /></div>
      </div>
    </div>
  );
}
