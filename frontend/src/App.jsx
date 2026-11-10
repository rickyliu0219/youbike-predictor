// src/App.jsx
// =============================================================
// YouBike 機器學習預測系統 — 前端主畫面（React + Tailwind + Recharts）
//
// 版面：
//   左欄：常用站點、站點選擇（自訂下拉，含搜尋／行政區）、天氣設定、時間設定
//   中欄：即時狀態（可借／可停／容量）、逐小時預測折線圖、時段統計長條圖
//   右欄：缺車／滿車風險、CO₂ 減量估算、站點資訊、站點地圖（一鍵導航）
//
// 資料流：
//   1. 載入時 GET /stations 取得站點清單
//   2. 選定站點 → GET /realtime/{id} 取得即時車數
//   3. 任何條件（站點／天氣／時間視窗）改變 → 250ms 防抖後 POST /forecast_day
//   所有 /api/* 請求由 Vite dev server 代理到 http://localhost:8000（見 vite.config.js）
// =============================================================
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine, BarChart, Bar, PieChart, Pie, Cell
} from "recharts";
import { Clock, MapPin, AlertTriangle, Leaf, Cloud, Droplets, Thermometer, Calendar, Sun, CloudFog, CloudRain, CloudLightning, Moon, Sunrise, Sunset } from "lucide-react";
import StationPicker from "./components/StationPicker";
import { shortName } from "./utils";
import StationMap from "./components/StationMap";
import LondonScene from "./components/LondonScene";

// ---------- 常數與小工具 ----------
const API = "/api";                                   // 後端 API 前綴（經 Vite 代理）
const round2 = (x) => Math.round((Number(x) || 0) * 100) / 100;   // 四捨五入到小數第 2 位
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));       // 限制數值範圍
const TAIPEI_TZ = "Asia/Taipei";
const LS_FAV_KEY = "yb_favorites"; // ← 常用站點 localStorage key

// 取得台北時間的 { date: "YYYY-MM-DD", time: "HH:mm" }（"sv-SE" 地區格式剛好是 ISO 樣式）
function nowInTaipei() {
  const s = new Date().toLocaleString("sv-SE", { timeZone: TAIPEI_TZ, hour12: false });
  const [d, t] = s.split(" ");
  return { date: d, time: t.slice(0, 5) };
}

// 從 "11/10 08:00" 這類標籤取出小時數（8）；格式不符回傳 NaN
const getHour = (val) => {
  const s = String(val ?? "");
  const tail = s.slice(-5);
  const m = /^(\d{2}):(\d{2})$/.exec(tail);
  return m ? Number(m[1]) : NaN;
};

// ---------- 日間／夜間切換開關（擬物風格膠囊開關）----------
// 日間：白色軌道、旋鈕在右（太陽）、文字在左
// 夜間：深灰軌道、旋鈕在左（月亮）、文字在右
// 旋鈕以 translateX 滑動，軌道底色與文字以 transition 漸變
function ThemeToggle({ isDark, onToggle }) {
  const W = 148, H = 44, PAD = 4, KNOB = H - PAD * 2;   // 尺寸（px）
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? "切換為日間模式" : "切換為夜間模式"}
      onClick={onToggle}
      className="neu-switch relative shrink-0 rounded-full transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
      style={{
        width: W,
        height: H,
        background: isDark ? "#4b4b4b" : "#f7f7f7",
        // 外框白邊 + 內凹陰影，做出「嵌在面板裡」的立體感
        border: "2px solid #ffffff",
        boxShadow: isDark
          ? "inset 2px 2px 5px rgba(0,0,0,0.45), 0 2px 6px rgba(0,0,0,0.35)"
          : "inset 2px 2px 5px rgba(0,0,0,0.10), inset -2px -2px 5px rgba(255,255,255,0.9), 0 2px 6px rgba(0,0,0,0.12)",
      }}
    >
      {/* 模式文字：日間在左、夜間在右 */}
      <span
        className="absolute top-1/2 -translate-y-1/2 text-[11px] font-extrabold leading-[1.05] tracking-wide text-left transition-all duration-300 select-none"
        style={{
          left: isDark ? KNOB + PAD + 14 : 16,
          color: isDark ? "#c8c8c8" : "#9a9a9a",
        }}
      >
        {isDark ? <>NIGHT<br />MODE</> : <>LIGHT<br />MODE</>}
      </span>

      {/* 旋鈕：凸起的白色圓形，內含太陽／月亮 */}
      <span
        className="neu-knob absolute top-1/2 rounded-full flex items-center justify-center"
        style={{
          left: PAD - 2,
          width: KNOB,
          height: KNOB,
          transform: `translate(${isDark ? 0 : W - KNOB - PAD * 2}px, -50%)`,
          background: "linear-gradient(145deg, #ffffff, #e6e6e6)",
          boxShadow: "2px 2px 6px rgba(0,0,0,0.25), -1px -1px 3px rgba(255,255,255,0.8)",
        }}
      >
        {isDark
          ? (
            // 細彎月：大圓減去往右偏移的圓（mask），開口朝右
            <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
              <defs>
                <mask id="yb-crescent">
                  <rect width="20" height="20" fill="white" />
                  <circle cx="13.5" cy="10" r="7" fill="black" />
                </mask>
              </defs>
              <circle cx="10" cy="10" r="8" fill="#a3a3a3" mask="url(#yb-crescent)" />
            </svg>
          )
          : <Sun className="w-[18px] h-[18px]" style={{ color: "#8f8f8f" }} strokeWidth={2} />}
      </span>
    </button>
  );
}

// ---------- Logo：字標與自行車融合 ----------
// "YouBike" 的 o 換成一個帶輻條的車輪，左側速度線表示「移動中」；
// 滑鼠移到 logo 上時車輪會轉動（.yb-wheel 動畫寫在 index.css）
function Logo({ isDark }) {
  const ink = isDark ? "var(--d-text)" : "var(--l-text)";
  const sub = isDark ? "var(--d-sub)" : "var(--l-sub)";
  const accent = "#f5a524";                 // 車輪與速度線的強調色（日夜模式共用）
  return (
    <div className="yb-logo flex items-center gap-3 select-none" aria-label="YouBike 需求預測">
      <div className="flex items-end leading-none" style={{ color: ink }}>
        {/* 速度線 */}
        <svg width="18" height="20" viewBox="0 0 18 20" aria-hidden="true" className="mr-1 mb-[3px]">
          <g stroke={accent} strokeWidth="2.4" strokeLinecap="round">
            <line x1="6" y1="5" x2="17" y2="5" />
            <line x1="2" y1="11" x2="17" y2="11" />
            <line x1="9" y1="17" x2="17" y2="17" />
          </g>
        </svg>
        <span className="text-[26px] font-black tracking-tight">Y</span>
        {/* 車輪＝字母 o */}
        <svg viewBox="0 0 24 24" aria-hidden="true" className="yb-wheel mx-[1px]"
             style={{ width: 21, height: 21, marginBottom: 1 }}>
          <circle cx="12" cy="12" r="10" fill="none" stroke={accent} strokeWidth="3.2" />
          <g stroke={accent} strokeWidth="1.3" strokeLinecap="round">
            <line x1="12" y1="3" x2="12" y2="21" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="5.6" y1="5.6" x2="18.4" y2="18.4" />
            <line x1="18.4" y1="5.6" x2="5.6" y2="18.4" />
          </g>
          <circle cx="12" cy="12" r="2.6" style={{ fill: ink }} />
        </svg>
        <span className="text-[26px] font-black tracking-tight">uBike</span>
      </div>
      <div className="leading-tight">
        <div className="text-[15px] font-bold" style={{ color: ink }}>需求預測</div>
        <div className="text-[10px] font-semibold tracking-[0.18em] uppercase" style={{ color: sub }}>Demand Forecast</div>
      </div>
    </div>
  );
}

// ---------- 夜間模式配色 ----------
// 所有夜間顏色集中在這裡；換配色只要改 DEFAULT_DARK（或網址加 ?dark=名稱 預覽）
const DARK_PALETTES = {
  graphite: { name: "石墨灰", risk: ["#8a8a91","#b4b4ba","#e4e4e7"], bg1: "#141416", bg2: "#1c1c1f", card: "#1f2023", border: "rgba(255,255,255,0.08)",
              input: "#26272b", soft: "rgba(255,255,255,0.05)", header: "rgba(20,20,22,0.82)",
              text: "#ececee", sub: "#9a9aa1", accent: "#d4d4d8",
              rent: "#e4e4e7", ret: "#8b8b93", remain: "#5f5f66", grid: "#2b2c30", axis: "#8a8a91", tooltip: "#202124" },
  midnight: { name: "霧藍午夜", risk: ["#7fa3a0","#c7a76f","#c27a78"], bg1: "#0e131c", bg2: "#151c28", card: "#18202d", border: "rgba(148,163,184,0.12)",
              input: "#1e2736", soft: "rgba(143,176,214,0.07)", header: "rgba(14,19,28,0.82)",
              text: "#e2e8f0", sub: "#8a96a8", accent: "#8fb0d6",
              rent: "#a9c3e2", ret: "#5d7898", remain: "#6b7484", grid: "#243042", axis: "#7d8899", tooltip: "#18202d" },
  warm:     { name: "暖炭", risk: ["#9aa77d","#d9a56a","#c76a55"], bg1: "#151311", bg2: "#1d1a17", card: "#221f1c", border: "rgba(255,240,220,0.08)",
              input: "#2a2622", soft: "rgba(217,165,106,0.07)", header: "rgba(21,19,17,0.82)",
              text: "#ede6dd", sub: "#a39a8f", accent: "#d9a56a",
              rent: "#e0b07a", ret: "#8c7a66", remain: "#6b635a", grid: "#302b26", axis: "#8f857a", tooltip: "#24201d" },
  forest:   { name: "墨綠", risk: ["#8cbfa3","#cdb27a","#c27a68"], bg1: "#0f1412", bg2: "#151c19", card: "#1a221f", border: "rgba(200,230,215,0.08)",
              input: "#212a26", soft: "rgba(140,191,163,0.07)", header: "rgba(15,20,18,0.82)",
              text: "#e3ebe6", sub: "#8fa199", accent: "#8cbfa3",
              rent: "#a3cfb6", ret: "#5e8574", remain: "#66706b", grid: "#25302b", axis: "#85948d", tooltip: "#1a221f" },
};
const DEFAULT_DARK = "warm";   // 選定：暖炭
const darkVars = (p) => ({
  "--d-bg1": p.bg1, "--d-bg2": p.bg2, "--d-card": p.card, "--d-border": p.border, "--d-input": p.input,
  "--d-soft": p.soft, "--d-header": p.header, "--d-text": p.text, "--d-sub": p.sub, "--d-accent": p.accent,
});

// ---------- 日間模式配色 ----------
// 換配色改 DEFAULT_LIGHT，或網址加 ?light=名稱 預覽
const LIGHT_PALETTES = {
  mono:  { name: "純白灰", risk: ["#9ca3af","#6b7280","#111827"], bg1: "#f9fafb", bg2: "#f3f4f6", card: "#ffffff", border: "#e5e7eb", input: "#ffffff",
           soft: "#f3f4f6", header: "rgba(255,255,255,0.85)", text: "#111827", sub: "#6b7280", accent: "#1f2937",
           tile: "#f3f3f3", tileOn: "#fafafa", tileEdge: "#9ca3af",
           rent: "#111827", ret: "#6b7280", remain: "#9ca3af", grid: "#e5e7eb", axis: "#111827" },
  cream: { name: "奶油米", risk: ["#b8c4a0","#d4a86a","#b5654a"], bg1: "#f7f4ef", bg2: "#efeae2", card: "#fffdf9", border: "#ebe4d9", input: "#fffdf9",
           soft: "#f4efe7", header: "rgba(250,247,242,0.88)", text: "#2b2622", sub: "#857a6f", accent: "#b07a3f",
           tile: "#f3eee6", tileOn: "#fffaf2", tileEdge: "#c9a77c",
           rent: "#b07a3f", ret: "#a39788", remain: "#cfc6ba", grid: "#ece5da", axis: "#6f655b" },
  mist:  { name: "霧藍白", risk: ["#9fbcd6","#d1b07a","#b86a6a"], bg1: "#f3f6f9", bg2: "#e9eef3", card: "#ffffff", border: "#e1e7ee", input: "#ffffff",
           soft: "#eef2f6", header: "rgba(247,249,251,0.88)", text: "#1e2a36", sub: "#66768a", accent: "#4f7cac",
           tile: "#edf1f5", tileOn: "#f9fbfd", tileEdge: "#8fa9c6",
           rent: "#4f7cac", ret: "#9aabbd", remain: "#c4cfdb", grid: "#e3e9ef", axis: "#5a6878" },
  sage:  { name: "鼠尾草", risk: ["#a3c1ae","#cfb27a","#b5705f"], bg1: "#f4f6f2", bg2: "#eaeee7", card: "#fcfdfb", border: "#e1e7de", input: "#fcfdfb",
           soft: "#eef2ec", header: "rgba(246,248,244,0.88)", text: "#222a25", sub: "#6b7a70", accent: "#5e8d74",
           tile: "#edf1eb", tileOn: "#fafcf9", tileEdge: "#93b3a0",
           rent: "#5e8d74", ret: "#a4b3a9", remain: "#c9d3cc", grid: "#e3e9e0", axis: "#5f6b63" },
  hawaii:   { name: "夏威夷", risk: ["#7fb8ae","#efb27f","#e8705a"], bg1: "#fbf6ec", bg2: "#f3ebdc", card: "#fffdf8", border: "#efe4d0", input: "#fffdf8",
              soft: "#f6efe2", header: "rgba(251,246,236,0.88)", text: "#1f3a3a", sub: "#6e7f7b", accent: "#e8705a",
              tile: "#f5ede0", tileOn: "#fffaf1", tileEdge: "#e8a08f",
              rent: "#e8705a", ret: "#3a9a8f", remain: "#c9bfae", grid: "#efe6d6", axis: "#55706c" },
  santorini:{ name: "聖托里尼", risk: ["#9fb7da","#d4a84f","#b9584c"], bg1: "#f6f8fb", bg2: "#e9eef6", card: "#ffffff", border: "#dfe6f1", input: "#ffffff",
              soft: "#eef2f9", header: "rgba(246,248,251,0.88)", text: "#16294a", sub: "#64738c", accent: "#2f5fa7",
              tile: "#edf1f8", tileOn: "#fbfcfe", tileEdge: "#8ea8d4",
              rent: "#2f5fa7", ret: "#d4a84f", remain: "#c3cddd", grid: "#e2e8f2", axis: "#4f5f7a" },
  kyoto:    { name: "京都和風", risk: ["#9aa77a","#d0a35c","#b9503a"], bg1: "#f6f2e9", bg2: "#ede7da", card: "#fcfaf4", border: "#e6dfd0", input: "#fcfaf4",
              soft: "#f2ede2", header: "rgba(246,242,233,0.88)", text: "#2a2826", sub: "#7b756b", accent: "#b9503a",
              tile: "#f1ebdf", tileOn: "#fdfbf6", tileEdge: "#cf9283",
              rent: "#b9503a", ret: "#7d8b5a", remain: "#cbc4b6", grid: "#e9e2d4", axis: "#5e584f" },
  nordic:   { name: "北歐", risk: ["#9bb0a2","#c9ad84","#b4675c"], bg1: "#f5f5f2", bg2: "#ebebe6", card: "#fdfdfb", border: "#e3e3dd", input: "#fdfdfb",
              soft: "#f0f0ec", header: "rgba(245,245,242,0.88)", text: "#24292e", sub: "#737a80", accent: "#5b7083",
              tile: "#efefea", tileOn: "#fcfcfa", tileEdge: "#a3b1bd",
              rent: "#5b7083", ret: "#c4ae8c", remain: "#cfd3d6", grid: "#e6e6e0", axis: "#5c6268" },
  provence: { name: "普羅旺斯", risk: ["#a8b07c","#c7a96e","#a7586e"], bg1: "#f8f6f3", bg2: "#efebe6", card: "#fefdfb", border: "#e8e3dc", input: "#fefdfb",
              soft: "#f3f0eb", header: "rgba(248,246,243,0.88)", text: "#2d2a33", sub: "#79737f", accent: "#7c6fae",
              tile: "#f2eee9", tileOn: "#fdfcfa", tileEdge: "#b3aad3",
              rent: "#7c6fae", ret: "#9aa36b", remain: "#d0cbd4", grid: "#ebe6df", axis: "#5f5966" },
  marrakech:{ name: "摩洛哥", risk: ["#a9b07a","#d4a24a","#b3502f"], bg1: "#f8f1e7", bg2: "#efe3d2", card: "#fffaf3", border: "#ecdcc6", input: "#fffaf3",
              soft: "#f5ebdd", header: "rgba(248,241,231,0.88)", text: "#3a2a22", sub: "#86705f", accent: "#c0663f",
              tile: "#f3e8d8", tileOn: "#fffaf2", tileEdge: "#d9a088",
              rent: "#c0663f", ret: "#d4a24a", remain: "#d6c6b0", grid: "#eee0cc", axis: "#6d584a" },
};
const DEFAULT_LIGHT = "nordic";   // 選定：北歐
const lightVars = (p) => ({
  "--l-bg1": p.bg1, "--l-bg2": p.bg2, "--l-card": p.card, "--l-border": p.border, "--l-input": p.input,
  "--l-soft": p.soft, "--l-header": p.header, "--l-text": p.text, "--l-sub": p.sub, "--l-accent": p.accent,
});

// ---------- 時間軸：依小時決定時段名稱、天空顏色與圖示 ----------
// 低飽和配色：只保留細微的色溫差（冷灰藍＝夜、暖灰＝晨昏、淡灰藍＝白天），不搶整體版面
//   light / dark：分別給日間、夜間（暖炭）主題用的面板底色
const DAY_PERIODS = [
  { from: 0,  to: 4,  label: "深夜 / 凌晨", light: "#e3e6ec", dark: "#1d1a18", Icon: Moon },
  { from: 5,  to: 6,  label: "清晨 / 日出", light: "#eee8e3", dark: "#302722", Icon: Sunrise },
  { from: 7,  to: 10, label: "上午",        light: "#e8edf1", dark: "#2a2622", Icon: Sun },
  { from: 11, to: 13, label: "中午",        light: "#ecf0f3", dark: "#2d2924", Icon: Sun },
  { from: 14, to: 16, label: "下午",        light: "#e9ecef", dark: "#2b2723", Icon: Sun },
  { from: 17, to: 18, label: "傍晚 / 日落", light: "#ede6e2", dark: "#332824", Icon: Sunset },
  { from: 19, to: 23, label: "夜間",        light: "#e2e5eb", dark: "#201d1a", Icon: Moon },
];
const periodOf = (h) => DAY_PERIODS.find((p) => h >= p.from && h <= p.to) || DAY_PERIODS[0];
const WEEK = ["日", "一", "二", "三", "四", "五", "六"];
const pad2 = (n) => String(n).padStart(2, "0");

// ---------- 時間設定卡片（參考「時間軸天氣模擬」設計）----------
// 1. 上方三張日期卡：今日／明日／後日（切換預測的那一天）
// 2. 中間天空面板：模擬時間、時段名稱、太陽／月亮；背景色隨時段漸變，數字切換時有進場動畫
// 3. 下方時間軸滑桿 00:00–23:00，可拖曳或點刻度；選到的小時會同步標在預測折線圖上
function TimeCard({ isDark, cardClass, neuTile, now, view, setView, hour, setHour, atHour }) {
  const period = periodOf(hour);
  const PIcon = period.Icon;
  const days = [["today", "今日", 0], ["tomorrow", "明日", 1], ["dayafter", "後日", 2]].map(([k, label, off]) => {
    const d = new Date(now.getTime() + off * 86400000);
    return { k, label, md: `${d.getMonth() + 1}/${d.getDate()}`, wd: WEEK[d.getDay()] };
  });
  const sel = days.find((d) => d.k === view) || days[0];
  const nowHour = now.getHours();
  const isNow = view === "today" && hour === nowHour;
  const fmt = (v) => (v === null || v === undefined ? "—" : v);

  return (
    <div className={`${cardClass} border rounded-2xl p-5 shadow-xl`}>
      {/* 標題列：右側是即時時鐘，點擊可跳回「現在」 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar className={`w-5 h-5 ${isDark ? "yd-accent" : "yl-accent"}`} />
          <h3 className="font-bold text-sm">時間設定</h3>
        </div>
        <button
          type="button"
          onClick={() => { setView("today"); setHour(nowHour); }}
          title="回到現在"
          className="neu-press flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
          style={neuTile(isNow)}
        >
          <Clock className="w-3 h-3" />
          現在 {pad2(now.getHours())}:{pad2(now.getMinutes())}
        </button>
      </div>

      {/* 日期切換 */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {days.map((d) => {
          const active = d.k === view;
          return (
            <button key={d.k} type="button" aria-pressed={active} onClick={() => setView(d.k)}
              className="neu-press rounded-2xl py-2 flex flex-col items-center leading-tight" style={neuTile(active)}>
              <span className={`text-xs ${active ? "font-bold" : "font-medium"}`}>{d.label}</span>
              <span className="text-[10px] opacity-70 tabular-nums">{d.md}（{d.wd}）</span>
            </button>
          );
        })}
      </div>

      {/* 天空面板：背景色依時段漸變 */}
      <div
        className="relative overflow-hidden rounded-2xl px-4 py-3.5"
        style={{
          backgroundColor: isDark ? period.dark : period.light,
          color: isDark ? "#e5e7eb" : "var(--l-text)",
          transition: "background-color .7s ease",
          // 與天氣卡片一致的擬物內凹感
          border: `1.5px solid ${isDark ? "rgba(255,255,255,.10)" : "#ffffff"}`,
          boxShadow: isDark
            ? "inset 2px 2px 6px rgba(0,0,0,.35), inset -1px -1px 3px rgba(255,255,255,.04)"
            : "inset 2px 2px 6px rgba(0,0,0,.06), inset -2px -2px 6px rgba(255,255,255,.8)",
        }}
      >
        {/* 光暈：讓面板有一點天空層次 */}
        <div className="pointer-events-none absolute -top-10 -right-8 w-40 h-40 rounded-full"
             style={{ background: `radial-gradient(circle, rgba(255,255,255,${isDark ? .05 : .55}), transparent 70%)` }} />
        <div className="relative flex items-start justify-between">
          <div>
            <div key={view} className="yb-slide-in text-[11px] opacity-80">模擬時間 · {sel.md}（{sel.wd}）</div>
            <div key={`h${hour}`} className="yb-pop text-[34px] leading-none font-bold tabular-nums mt-1.5">
              {pad2(hour)}:00
            </div>
            <div key={period.label} className="yb-slide-in text-xs font-semibold mt-2 opacity-90">{period.label}</div>
          </div>
          <PIcon key={period.label + "i"} className="yb-icon-in w-9 h-9" style={{ color: isDark ? "#a8a29e" : "#9ca3af" }} strokeWidth={1.6} />
        </div>
        {/* 該小時的預測值（來自折線圖資料） */}
        <div className="relative mt-3 grid grid-cols-3 gap-2 text-center">
          {[["借出", atHour?.rent], ["歸還", atHour?.ret], ["剩餘", atHour?.remain]].map(([k, v]) => (
            <div key={k} className="rounded-xl py-1.5" style={{ background: isDark ? "rgba(255,255,255,.05)" : "rgba(255,255,255,.7)" }}>
              <div className="text-[10px] opacity-60">{k}</div>
              <div key={`${k}${hour}${view}`} className="yb-pop text-sm font-bold tabular-nums">{fmt(v)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 時間軸 */}
      <div className="mt-4">
        <input type="range" min="0" max="23" step="1" value={hour}
          onChange={(e) => setHour(Number(e.target.value))}
          aria-label="模擬時間"
          className="neu-range" style={{ "--pct": `${(hour / 23) * 100}%` }} />
        <div className="relative h-4 mt-1.5 text-[10px] tabular-nums opacity-70">
          {[0, 6, 12, 18, 23].map((h) => (
            <button key={h} type="button" onClick={() => setHour(h)}
              className="absolute -translate-x-1/2 hover:opacity-100 hover:font-bold transition"
              style={{ left: `calc(12px + (100% - 24px) * ${h / 23})` }}>
              {pad2(h)}:00
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------- 更新按鈕：與日夜切換開關同風格的圓形擬物按鈕，只放圖示 ----------
// 滑鼠移入：圖示順時針轉半圈；按下：按鈕凹陷；載入中：圖示持續旋轉
function RefreshButton({ loading, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      aria-label="更新預測"
      title="更新預測"
      className="neu-round group shrink-0 w-11 h-11 rounded-full flex items-center justify-center disabled:cursor-wait"
    >
      {/* 兩段粗弧線 + 實心箭頭，呈 180° 旋轉對稱 */}
      <svg
        viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"
        className={`transition-transform duration-500 ease-out ${loading ? "animate-spin" : "group-hover:rotate-180"}`}
        fill="#8f8f8f" stroke="#8f8f8f"
      >
        <path d="M7.98 6.27 A7 7 0 0 1 19.00 12.00" fill="none" strokeWidth="2.6" />
        <polygon points="19.00 15.60 22.40 12.00 15.60 12.00" stroke="none" />
        <path d="M16.02 17.73 A7 7 0 0 1 5.00 12.00" fill="none" strokeWidth="2.6" />
        <polygon points="5.00 8.40 1.60 12.00 8.40 12.00" stroke="none" />
      </svg>
    </button>
  );
}

export default function App() {
  // ===== 畫面狀態 =====
  const [isDarkMode, setIsDarkMode] = useState(false); // 預設日間（黑白灰）；true＝夜間（深色）
  // 夜間配色：網址 ?dark=graphite|midnight|warm|forest 可預覽，否則用 DEFAULT_DARK
  const pal = useMemo(() => {
    const q = new URLSearchParams(window.location.search).get("dark");
    return DARK_PALETTES[q] || DARK_PALETTES[DEFAULT_DARK];
  }, []);
  const lpal = useMemo(() => {
    const q = new URLSearchParams(window.location.search).get("light");
    return LIGHT_PALETTES[q] || LIGHT_PALETTES[DEFAULT_LIGHT];
  }, []);
  const [stations, setStations] = useState([]);        // 全部站點清單
  const [stationId, setStationId] = useState("");      // 目前選取的站點
  const [now, setNow] = useState(() => new Date());                // 即時時鐘（每 20 秒更新）
  const [simHour, setSimHour] = useState(() => new Date().getHours()); // 時間軸選到的小時（0–23）
  // 天氣條件（送給後端當模型特徵）
  const [rainMm, setRainMm] = useState(0);             // 降雨量 mm
  const [isRain, setIsRain] = useState(0);             // 是否下雨（由 rainMm 自動同步）
  const [tempC, setTempC] = useState(26);              // 氣溫 °C
  const [rangeView, setRangeView] = useState("today"); // 預測哪一天：today / tomorrow / dayafter
  const [realtime, setRealtime] = useState(null);      // 即時車數
  const [series, setSeries] = useState([]);            // 逐小時預測結果 [{hour, rent, ret, remain}]
  const [loadingAll, setLoadingAll] = useState(false);

  // ===== 常用站點狀態 =====
  const [favorites, setFavorites] = useState([]); // array<string> of station_id

  useEffect(() => {
    // 初次載入：讀 localStorage
    try {
      const saved = JSON.parse(localStorage.getItem(LS_FAV_KEY) || "[]");
      setFavorites(Array.isArray(saved) ? saved.map(String) : []);
    } catch {
      setFavorites([]);
    }
  }, []);

  useEffect(() => {
    // 站點清單更新後，剔除不存在的常用
    if (!stations?.length) return;
    const ids = new Set(stations.map(s => String(s.station_id)));
    setFavorites(prev => {
      const next = prev.filter(id => ids.has(id));
      if (next.length !== prev.length) {
        localStorage.setItem(LS_FAV_KEY, JSON.stringify(next));
      }
      return next;
    });
  }, [stations]);

  const toggleFav = (id) => {
    setFavorites(prev => {
      const s = new Set(prev.map(String));
      const sid = String(id);
      if (s.has(sid)) s.delete(sid); else s.add(sid);
      const arr = Array.from(s);
      localStorage.setItem(LS_FAV_KEY, JSON.stringify(arr));
      return arr;
    });
  };

  // 一鍵天氣情境（目前的降雨＋溫度剛好等於某個情境時，該卡片顯示為選取狀態）
  const presets = [
    { name: "晴天", Icon: Sun,            rain_mm: 0,   temp: 28 },
    { name: "陰天", Icon: Cloud,          rain_mm: 0,   temp: 24 },
    { name: "霧天", Icon: CloudFog,       rain_mm: 0,   temp: 20 },
    { name: "雨天", Icon: CloudRain,      rain_mm: 1.5, temp: 23 },
    { name: "大雨", Icon: CloudLightning, rain_mm: 8,   temp: 21 },
  ];
  const activePreset = presets.find((p) => p.rain_mm === rainMm && p.temp === tempC)?.name;

  // ===== 載入站點清單：先用即時 API，失敗時改用後端本地 CSV =====
  useEffect(() => {
    (async () => {
      const load = async (url) => {
        const r = await fetch(url);
        const j = await r.json();
        return r.ok && Array.isArray(j) ? j : null;   // 後端出錯時回傳的是 {error: ...}，不是陣列
      };
      try {
        const list = (await load(`${API}/stations`)) || (await load(`${API}/stations?source=csv`)) || [];
        setStations(list);
        if (list.length) setStationId(String(list[0].station_id));
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  // 站點清單載入後，若目前沒有選到有效站點，自動選第一個（常用優先）
  useEffect(() => {
    if (!stations.length) return;
    if (stations.some((s) => String(s.station_id) === String(stationId))) return;
    const first = stations.find((s) => favorites.includes(String(s.station_id))) || stations[0];
    setStationId(String(first.station_id));
  }, [stations, stationId, favorites]);

  // 降雨量 > 0 就視為下雨（is_rain 是模型特徵之一）
  useEffect(() => {
    if (rainMm > 0 && isRain !== 1) setIsRain(1);
    if (rainMm === 0 && isRain !== 0) setIsRain(0);
  }, [rainMm, isRain]);

  // ===== 切換站點時抓即時車數 =====
  useEffect(() => {
    if (!stationId) return;
    (async () => {
      try {
        const r = await fetch(`${API}/realtime/${stationId}`);
        const j = await r.json();
        if (j && j.available_rent_bikes !== undefined) {
          setRealtime({
            remain_bikes: Number(j.available_rent_bikes),
            remain_slots: Number(j.available_return_bikes),
            update_time: j.update_time,
            capacity: Number(j.docks_total || (Number(j.available_rent_bikes || 0) + Number(j.available_return_bikes || 0)) || 0),
          });
        } else {
          setRealtime(null);
        }
      } catch {
        setRealtime(null);
      }
    })();
  }, [stationId]);

  // ===== 呼叫 /forecast_day 取得逐小時預測，轉成圖表用的資料 =====
  // 失敗時塞一組全 0 的序列，讓圖表維持版面而不是整個消失
  async function buildIntradaySeries() {
    const safeNum = (v) => {
      const n = Number(v);
      return Number.isFinite(n) && !Number.isNaN(n) ? n : 0;
    };
    try {
      const body = {
        station_id: Number(stationId),
        date: nowInTaipei().date,
        view: rangeView,
        rain_mm: Number(rainMm),
        is_rain: Number(isRain),
        temp_c: Number(tempC),
        use_realtime_start: true,
      };
      const r = await fetch(`${API}/forecast_day`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const horizon = rangeView === "next6" ? 6 : rangeView === "next12" ? 12 : 24;
        setSeries(Array.from({ length: horizon }, (_, i) => ({
          hour: `${String(i).padStart(2, "0")}:00`, rent: 0, ret: 0, remain: null
        })));
        return;
      }
      const j = await r.json();
      const remains = Array.isArray(j.remain_bikes) ? j.remain_bikes : [];
      const hours = Array.isArray(j.hours) ? j.hours : [];
      const s = hours.map((item, idx) => {
        const toInt = (v) => Math.max(0, Math.round(safeNum(v)));
        const remRaw = remains[idx];
        const rem = remRaw === null || remRaw === undefined ? null : toInt(remRaw);
        return {
          hour: String(item?.hour || `-- ${idx}`),
          rent: toInt(item?.rent),
          ret: toInt(item?.ret),
          remain: rem,
        };
      });
      setSeries(s);
    } catch (err) {
      console.error("forecast_day error:", err);
      const horizon = rangeView === "next6" ? 6 : rangeView === "next12" ? 12 : 24;
      setSeries(Array.from({ length: horizon }, (_, i) => ({
        hour: `${String(i).padStart(2, "0")}:00`, rent: 0, ret: 0, remain: null
      })));
    }
  }

  async function runAll() {
    if (!stationId) return;
    setLoadingAll(true);
    try { await buildIntradaySeries(); } finally { setLoadingAll(false); }
  }

  // 防抖：拖動溫度／降雨滑桿時不要每一格都打 API，停 250ms 才送出
  const deb = useRef(null);
  useEffect(() => {
    if (!stationId) return;
    clearTimeout(deb.current);
    deb.current = setTimeout(runAll, 250);
    return () => clearTimeout(deb.current);
  }, [stationId, rainMm, isRain, tempC, rangeView]);   // 拖時間軸只在前端查表，不重打 API

  // 即時時鐘：每 20 秒更新一次（時間設定卡片右上角顯示）
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 20000);
    return () => clearInterval(t);
  }, []);

  // 時間軸選到的那一小時，在預測序列中的資料（給天空面板與折線圖參考線用）
  const atHour = useMemo(
    () => series.find((r) => getHour(r?.hour) === simHour) || null,
    [series, simHour]
  );

  // 時段加總：早上 6–9、中午 12–13、晚上 16–18、整個視窗
  const aggregates = useMemo(() => {
    const toInt = (x) => Math.max(0, Math.round(Number(x) || 0));
    const inRange = (lo, hi) => (r) => {
      const h = getHour(r?.hour);
      return Number.isFinite(h) && h >= lo && h <= hi;
    };
    const sumInt = (rows, key) => rows.reduce((acc, r) => acc + toInt(r?.[key]), 0);
    return {
      morning: { rent: sumInt(series.filter(inRange(6, 9)), "rent"), ret: sumInt(series.filter(inRange(6, 9)), "ret") },
      noon: { rent: sumInt(series.filter(inRange(12, 13)), "rent"), ret: sumInt(series.filter(inRange(12, 13)), "ret") },
      evening: { rent: sumInt(series.filter(inRange(16, 18)), "rent"), ret: sumInt(series.filter(inRange(16, 18)), "ret") },
      day: { rent: sumInt(series, "rent"), ret: sumInt(series, "ret") },
    };
  }, [series]);

  const selectedStation = useMemo(
    () => stations.find((s) => String(s.station_id) === String(stationId)),
    [stations, stationId]
  );

  // 風險評估（以即時車數計算）：
  //   缺車風險 = 1 − 可借車數 / 容量；滿車風險 = 1 − 空位數 / 容量
  //   ≥ 0.75 → 高、≥ 0.45 → 中、其餘 → 低
  const risk = useMemo(() => {
    if (!realtime) return null;   // 沒有即時車數就不評估（否則會誤判成 0 台車 → 高風險）
    const capFromRt = Number(realtime?.remain_bikes || 0) + Number(realtime?.remain_slots || 0);
    const cap = Number(realtime?.capacity || capFromRt || selectedStation?.docks_total || 0);
    if (!cap) return null;
    const remainB = Math.max(0, Math.min(cap, Number(realtime?.remain_bikes || 0)));
    const remainS = Math.max(0, Math.min(cap, Number(realtime?.remain_slots || 0)));
    const stockout = 1 - remainB / cap;
    const full = 1 - remainS / cap;
    const tag = (z) => (z >= 0.75 ? "高" : z >= 0.45 ? "中" : "低");
    return {
      capacity: cap,
      stockout: { score: round2(stockout), level: tag(stockout) },
      full: { score: round2(full), level: tag(full) },
    };
  }, [selectedStation, realtime]);

  // CO₂ 減量估算：假設每趟 2.5 km；機車約 0.075 kg/km、汽車約 0.17 kg/km
  const eco = useMemo(() => {
    const trips = Number(aggregates?.day?.rent || 0);
    return { 
      trips: round2(trips), 
      saveScooter: round2(trips * 2.5 * 0.075), 
      saveCar: round2(trips * 2.5 * 0.17) 
    };
  }, [aggregates?.day]);

  const timeData = [
    { name: "早上", rent: aggregates.morning.rent, ret: aggregates.morning.ret },
    { name: "中午", rent: aggregates.noon.rent, ret: aggregates.noon.ret },
    { name: "晚上", rent: aggregates.evening.rent, ret: aggregates.evening.ret },
  ];

  // 圓餅圖：站上的車 vs 空車柱
  const capacityData = realtime ? [
    { name: "可借車輛", value: realtime.remain_bikes },
    { name: "空位", value: realtime.remain_slots },
  ] : [];

  // ====== 主題樣式（日間＝黑白灰；夜間＝DARK_PALETTES 中選定的配色，CSS 類別定義在 index.css） ======
  const bgClass = isDarkMode ? "yd-bg" : "yl-bg";
  const cardClass = isDarkMode ? "yd-card" : "yl-card";
  const textPrimary = isDarkMode ? "yd-text" : "yl-text";
  const textSecondary = isDarkMode ? "yd-sub" : "yl-sub";
  const accentColor = isDarkMode ? "yd-accent" : "yl-accent";

  // 圖表顏色（日間黑灰；夜間取自配色）
  const chartStroke = {
    axis: isDarkMode ? pal.axis : lpal.axis,
    grid: isDarkMode ? pal.grid : lpal.grid,
    rent: isDarkMode ? pal.rent : lpal.rent,
    ret: isDarkMode ? pal.ret : lpal.ret,
    remain: isDarkMode ? pal.remain : lpal.remain,
    barRent: isDarkMode ? pal.rent : lpal.rent,
    barRet: isDarkMode ? pal.ret : lpal.ret,
    pieUse: isDarkMode ? pal.rent : lpal.rent,
    pieSlot: isDarkMode ? pal.grid : lpal.grid,
  };

  // ====== 共用 Tooltip 樣式（避免黑底黑字） ======
  const tooltipStyle = {
    contentStyle: {
      backgroundColor: isDarkMode ? pal.tooltip : lpal.card,
      border: `1px solid ${isDarkMode ? pal.grid : lpal.border}`,
      borderRadius: 12,
      boxShadow: isDarkMode ? "0 8px 24px rgba(0,0,0,0.40)" : "0 8px 24px rgba(0,0,0,0.08)",
       color: isDarkMode ? pal.text : lpal.text,
      padding: 10,
    },
    itemStyle: {
       color: isDarkMode ? pal.text : lpal.text,
    },
    labelStyle: {
       color: isDarkMode ? pal.text : lpal.text,
      fontWeight: 600,
    },
    wrapperStyle: { outline: "none" },
  };

  // === 擬物風格小卡（天氣情境）：未選取＝平面淺色；選取＝凸起 + 外框 ===
  const neuTile = (active) => isDarkMode
    ? {
        background: active ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.05)",
        border: `1.5px solid ${active ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.12)"}`,
        boxShadow: active
          ? "3px 3px 8px rgba(0,0,0,0.45), -1px -1px 3px rgba(255,255,255,0.06)"
          : "inset 1px 1px 3px rgba(0,0,0,0.25)",
        color: active ? "#f1f5f9" : "#cbd5e1",
      }
    : {
        background: active ? lpal.tileOn : lpal.tile,
        border: `1.5px solid ${active ? lpal.tileEdge : "#ffffff"}`,
        boxShadow: active
          ? "3px 3px 8px rgba(0,0,0,0.14), -2px -2px 6px rgba(255,255,255,0.9)"
          : "inset 1px 1px 3px rgba(0,0,0,0.05)",
        color: active ? lpal.text : lpal.sub,
      };

  // === 風險條顏色：低=綠 / 中=橙 / 高=紅（支援日/夜） ===
  // 顏色取自目前主題的 risk: [低, 中, 高]，低飽和、與主題同色系
  const riskColor = (level) => {
    const [lo, mid, hi] = (isDarkMode ? pal : lpal).risk;
    const lv = String(level || "").trim();
    return lv === "高" ? hi : lv === "中" ? mid : lo;
  };

  return (
    <div className={`${isDarkMode ? "theme-dark" : "theme-light"} min-h-screen ${bgClass} ${textPrimary}`} style={isDarkMode ? darkVars(pal) : lightVars(lpal)}>
      <div className={`sticky top-0 z-50 backdrop-blur-xl ${isDarkMode ? 'yd-header shadow-[0_6px_20px_rgba(0,0,0,0.35)]' : 'yl-header shadow-[0_6px_20px_rgba(0,0,0,0.06)]'}`}>
        <div className="max-w-[1920px] mx-auto px-6 py-3 flex items-center justify-between">
          <Logo isDark={isDarkMode} />
          {/* 夜間模式限定：倫敦夜景＋巡邏衛兵（寬螢幕才顯示） */}
          {isDarkMode ? <div className="hidden md:flex flex-1 min-w-0"><LondonScene /></div> : <div className="flex-1" />}
          <div className="flex items-center gap-3">
            <ThemeToggle isDark={isDarkMode} onToggle={() => setIsDarkMode(!isDarkMode)} />
            <RefreshButton loading={loadingAll} onClick={runAll} />
          </div>
        </div>
      </div>

      <div className="max-w-[1920px] mx-auto p-6">
        <div className="grid grid-cols-12 gap-6">
          
          {/* 左側：常用 / 站點 / 天氣 / 時間 */}
          <div className="col-span-12 lg:col-span-3 space-y-6">
            {/* 常用站點卡片：有加入常用（按 ★）才顯示 */}
            {favorites.length > 0 && (
            <div className={`${cardClass} border rounded-2xl p-5 shadow-xl`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-sm">常用站點</h3>
                <button
                  onClick={() => { setFavorites([]); localStorage.setItem(LS_FAV_KEY, "[]"); }}
                  className={`neu-press text-xs underline ${isDarkMode ? 'yd-sub' : 'yl-sub'}`}
                >
                  清空
                </button>
              </div>
                <div className="flex flex-wrap gap-2">
                  {favorites
                    .map(fid => stations.find(s => String(s.station_id) === String(fid)))
                    .filter(Boolean)
                    .map(st => (
                      <div key={st.station_id}
                        className={`neu-press group inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs cursor-pointer
                          ${isDarkMode ? 'yd-soft yd-border' : 'yl-soft yl-border'}`}
                        onClick={() => setStationId(String(st.station_id))}
                      >
                        <span className="font-medium">{st.station_name}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleFav(st.station_id); }}
                          className={`${isDarkMode ? 'yd-sub' : 'yl-sub'} opacity-70 group-hover:opacity-100`}
                          title="移除常用"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                </div>
            </div>
            )}

            <div className={`${cardClass} border rounded-2xl p-5 shadow-xl`}>
              <div className="flex items-center gap-2 mb-4">
                <MapPin className={`w-5 h-5 ${isDarkMode ? 'yd-accent' : 'yl-accent'}`} />
                <h3 className="font-bold text-sm">站點選擇</h3>
              </div>
              {/* 自訂下拉選單：清單也會套用主題配色（見 components/StationPicker.jsx） */}
              <StationPicker isDark={isDarkMode} stations={stations} value={stationId} onChange={setStationId}
                favorites={favorites} onToggleFav={toggleFav} />
            </div>

            <div className={`${cardClass} border rounded-2xl p-5 shadow-xl`}>
              <div className="flex items-center gap-2 mb-4">
                <Cloud className={`w-5 h-5 ${isDarkMode ? 'yd-accent' : 'yl-accent'}`} />
                <h3 className="font-bold text-sm">天氣設定</h3>
              </div>
              {/* 天氣情境卡片：圖示在上、文字在下；選取中的卡片凸起並顯示勾勾 */}
              <div className="grid grid-cols-5 gap-2 mb-5">
                {presets.map((p) => {
                  const { name, rain_mm, temp } = p;
                  const active = activePreset === name;
                  return (
                    <button
                      key={name}
                      type="button"
                      aria-pressed={active}
                      onClick={() => { setRainMm(rain_mm); setTempC(clamp(temp, 0, 50)); }}
                      className="neu-press flex flex-col items-center justify-center gap-1 rounded-2xl py-3"
                      style={neuTile(active)}
                    >
                      <p.Icon className="w-5 h-5" strokeWidth={1.6} />
                      <span className={`text-[11px] ${active ? 'font-bold' : 'font-medium'}`}>{name}</span>
                    </button>
                  );
                })}
              </div>

              {/* 溫度／降雨滑桿（樣式見 index.css 的 .neu-range；--pct 控制已填滿長度） */}
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1 text-xs">
                      <Thermometer className="w-3 h-3" />
                      <span>溫度</span>
                    </div>
                    <span className="text-xs font-mono">{tempC}°C</span>
                  </div>
                  <input type="range" min="0" max="50" step="0.1" value={tempC}
                    onChange={(e) => setTempC(Number(e.target.value))}
                    className="neu-range" style={{ "--pct": `${(tempC / 50) * 100}%` }} />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1 text-xs">
                      <Droplets className="w-3 h-3" />
                      <span>降雨</span>
                    </div>
                    <span className="text-xs font-mono">{rainMm}mm</span>
                  </div>
                  <input type="range" min="0" max="20" step="0.1" value={rainMm}
                    onChange={(e) => setRainMm(Number(e.target.value))}
                    className="neu-range" style={{ "--pct": `${(rainMm / 20) * 100}%` }} />
                </div>
              </div>
            </div>

            <TimeCard isDark={isDarkMode} cardClass={cardClass} neuTile={neuTile} now={now}
              view={rangeView} setView={setRangeView} hour={simHour} setHour={setSimHour} atHour={atHour} />
          </div>

          {/* 中間：即時、預測、時段 */}
          <div className="col-span-12 lg:col-span-6 space-y-6">
            <div className={`${cardClass} border rounded-2xl p-6 shadow-xl`}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">即時狀態</h2>
              </div>
              <div className="grid grid-cols-3 gap-6 mb-6">
                <div className="text-center">
                  <div className={`text-5xl font-bold ${accentColor}`}>{realtime?.remain_bikes ?? "—"}</div>
                  <div className={`text-sm ${textSecondary} mt-2`}>可借車輛</div>
                </div>
                <div className="text-center">
                  <div className={`text-5xl font-bold ${isDarkMode ? 'yd-sub' : 'yl-sub'}`}>{realtime?.remain_slots ?? "—"}</div>
                  <div className={`text-sm ${textSecondary} mt-2`}>可停車格</div>
                </div>
                <div className="text-center">
                  <div className={`text-5xl font-bold ${isDarkMode ? 'yd-accent' : 'yl-accent'}`}>{realtime?.capacity ?? "—"}</div>
                  <div className={`text-sm ${textSecondary} mt-2`}>總容量</div>
                </div>
              </div>
              {capacityData.length > 0 && (
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={capacityData} dataKey="value" cx="50%" cy="50%" innerRadius={50} outerRadius={70}>
                        {capacityData.map((entry, index) => (
                          <Cell key={index} fill={index === 0 ? chartStroke.pieUse : chartStroke.pieSlot} />
                        ))}
                      </Pie>
                      {/* 統一樣式的 Tooltip（圓餅） */}
                      <Tooltip
                        contentStyle={tooltipStyle.contentStyle}
                        itemStyle={tooltipStyle.itemStyle}
                        labelStyle={tooltipStyle.labelStyle}
                        wrapperStyle={tooltipStyle.wrapperStyle}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className={`${cardClass} border rounded-2xl p-6 shadow-xl`}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">即時預測</h2>
              </div>
              <div className="h-80">
                <ResponsiveContainer>
                  <LineChart data={series} margin={{ top: 22, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartStroke.grid} />
                    <XAxis dataKey="hour" stroke={chartStroke.axis} tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="flow" stroke={chartStroke.axis} tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="remain" orientation="right" stroke={chartStroke.axis} tick={{ fontSize: 11 }} />
                    {/* 統一樣式的 Tooltip（折線） */}
                    <Tooltip
                      contentStyle={tooltipStyle.contentStyle}
                      itemStyle={tooltipStyle.itemStyle}
                      labelStyle={tooltipStyle.labelStyle}
                      wrapperStyle={tooltipStyle.wrapperStyle}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    {/* 時間軸選到的小時 */}
                    {atHour && (
                      <ReferenceLine yAxisId="flow" x={atHour.hour} stroke="#f5a524" strokeWidth={2} strokeDasharray="4 4"
                        label={{ value: atHour.hour.slice(-5), position: "top", fill: "#f5a524", fontSize: 11 }} />
                    )}
                    <Line yAxisId="flow" type="monotone" dataKey="rent" name="借車" stroke={chartStroke.rent} strokeWidth={3} dot={false} />
                    <Line yAxisId="flow" type="monotone" dataKey="ret" name="還車" stroke={chartStroke.ret} strokeWidth={3} dot={false} />
                    <Line yAxisId="remain" type="monotone" dataKey="remain" name="剩餘" stroke={chartStroke.remain} strokeWidth={2} dot={false} strokeDasharray="5 5" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className={`${cardClass} border rounded-2xl p-6 shadow-xl`}>
              <h2 className="text-xl font-bold mb-4">時段統計</h2>
              <div className="h-64">
                <ResponsiveContainer>
                  <BarChart data={timeData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartStroke.grid} />
                    <XAxis dataKey="name" stroke={chartStroke.axis} />
                    <YAxis stroke={chartStroke.axis} />
                    {/* 統一樣式的 Tooltip（長條） */}
                    <Tooltip
                      contentStyle={tooltipStyle.contentStyle}
                      itemStyle={tooltipStyle.itemStyle}
                      labelStyle={tooltipStyle.labelStyle}
                      wrapperStyle={tooltipStyle.wrapperStyle}
                    />
                    <Legend />
                    <Bar dataKey="rent" name="借車" fill={chartStroke.barRent} radius={[8, 8, 0, 0]} />
                    <Bar dataKey="ret" name="還車" fill={chartStroke.barRet} radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* 右側：風險/效益/站點 */}
          <div className="col-span-12 lg:col-span-3 space-y-6">
            <div className={`${cardClass} border rounded-2xl p-5 shadow-xl`}>
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className={`w-5 h-5 ${isDarkMode ? 'yd-accent' : 'yl-accent'}`} />
                <h3 className="font-bold text-sm">風險評估</h3>
              </div>
              {risk ? (
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm">缺車風險</span>
                      <span className="text-lg font-bold">{risk.stockout.level}</span>
                    </div>
                    <div className={`w-full h-2 rounded-full overflow-hidden ${isDarkMode ? 'yd-soft' : 'yl-soft'}`}>
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${risk.stockout.score * 100}%`, background: riskColor(risk.stockout.level) }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm">滿車風險</span>
                      <span className="text-lg font-bold">{risk.full.level}</span>
                    </div>
                    <div className={`w-full h-2 rounded-full overflow-hidden ${isDarkMode ? 'yd-soft' : 'yl-soft'}`}>
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${risk.full.score * 100}%`, background: riskColor(risk.full.level) }} />
                    </div>
                  </div>
                </div>
              ) : <div className={textSecondary}>等待資料...</div>}
            </div>

            <div className={`${cardClass} border rounded-2xl p-5 shadow-xl`}>
              <div className="flex items-center gap-2 mb-4">
                <Leaf className={`w-5 h-5 ${isDarkMode ? 'yd-accent' : 'yl-accent'}`} />
                <h3 className="font-bold text-sm">環境效益</h3>
              </div>
              <div className="space-y-4">
                <div className={`text-center py-4 rounded-xl ${
                  isDarkMode ? 'yd-soft border yd-border' : 'yl-soft border yl-border'
                }`}>
                  <div className={`${isDarkMode ? 'yd-accent' : 'yl-accent'} text-3xl font-bold`}>{Math.round(eco.trips)}</div>
                  <div className={`text-xs ${textSecondary} mt-1`}>預測騎乘趟數</div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className={`flex justify-between p-2 rounded-lg ${isDarkMode ? 'yd-soft' : 'yl-soft'}`}>
                    <span>vs 機車</span>
                    <span className="font-bold">-{eco.saveScooter.toFixed(1)} kg CO₂</span>
                  </div>
                  <div className={`flex justify-between p-2 rounded-lg ${isDarkMode ? 'yd-soft' : 'yl-soft'}`}>
                    <span>vs 汽車</span>
                    <span className="font-bold">-{eco.saveCar.toFixed(1)} kg CO₂</span>
                  </div>
                </div>
              </div>
            </div>

            {selectedStation && (
              <div className={`${cardClass} border rounded-2xl p-5 shadow-xl`}>
                <div className="flex items-center gap-2 mb-4">
                  <MapPin className={`w-5 h-5 ${isDarkMode ? 'yd-accent' : 'yl-accent'}`} />
                  <h3 className="font-bold text-sm">站點資訊</h3>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className={textSecondary}>站點名稱</span>
                    <span className="font-medium">{shortName(selectedStation.station_name)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={textSecondary}>行政區</span>
                    <span className="font-medium">{selectedStation.district}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={textSecondary}>站點 ID</span>
                    <span className="font-mono text-xs">{selectedStation.station_id}</span>
                  </div>
                </div>
              </div>
            )}

            {/* 站點位置地圖 + 一鍵導航（見 components/StationMap.jsx） */}
            {selectedStation && (
              <StationMap isDark={isDarkMode} station={selectedStation} stations={stations}
                onSelect={setStationId} accent={isDarkMode ? pal.accent : lpal.accent} />
            )}
          </div>
        </div>
      </div>

      <div className={`${cardClass} border-t mt-10`}>
        <div className="max-w-[1920px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between text-xs">
            <div className={textSecondary}>© 2025 YouBike 機器學習預測系統 | 由劉禹寬製作</div>
            <div className={textSecondary}>僅供比賽創意用途 · 不保證預測準確性 · 不承擔法律責任</div>
          </div>
        </div>
      </div>
    </div>
  );
}
