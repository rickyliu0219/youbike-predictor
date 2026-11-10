// src/App.jsx
// =============================================================
// YouBike 機器學習預測系統 — 前端主畫面（React + Tailwind + Recharts）
//
// 版面：
//   左欄：常用站點、站點選擇（搜尋／行政區篩選）、天氣設定、時間視窗
//   中欄：即時狀態（可借／可停／容量）、逐小時預測折線圖、時段統計長條圖
//   右欄：缺車／滿車風險、CO₂ 減量估算、站點資訊
//
// 資料流：
//   1. 載入時 GET /stations 取得站點清單
//   2. 選定站點 → GET /realtime/{id} 取得即時車數
//   3. 任何條件（站點／天氣／時間視窗）改變 → 250ms 防抖後 POST /forecast_day
//   所有 /api/* 請求由 Vite dev server 代理到 http://localhost:8000（見 vite.config.js）
// =============================================================
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, PieChart, Pie, Cell
} from "recharts";
import { Bike, Clock, MapPin, RefreshCw, Loader2, AlertTriangle, Leaf, Cloud, Droplets, Thermometer, Calendar, Sun } from "lucide-react";

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
      className="relative shrink-0 rounded-full transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
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
        className="absolute top-1/2 rounded-full flex items-center justify-center transition-transform duration-300 ease-out"
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

export default function App() {
  // ===== 畫面狀態 =====
  const [isDarkMode, setIsDarkMode] = useState(true); // 夜間=深色、日間=黑白
  const [stations, setStations] = useState([]);        // 全部站點清單
  const [stationId, setStationId] = useState("");      // 目前選取的站點
  const [searchText, setSearchText] = useState("");    // 站名／站號搜尋字
  const [districtFilter, setDistrictFilter] = useState("全部");
  const [date, setDate] = useState(() => nowInTaipei().date);
  const [time, setTime] = useState(() => nowInTaipei().time);
  // 天氣條件（送給後端當模型特徵）
  const [rainMm, setRainMm] = useState(0);             // 降雨量 mm
  const [isRain, setIsRain] = useState(0);             // 是否下雨（由 rainMm 自動同步）
  const [tempC, setTempC] = useState(26);              // 氣溫 °C
  const [rangeView, setRangeView] = useState("today"); // 預測視窗：next6 / next12 / today / tomorrow / dayafter
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

  const isFav = (id) => favorites.includes(String(id));
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

  // 一鍵天氣情境
  const presets = [
    { name: "☀️ 晴", rain_mm: 0, temp: 28 },
    { name: "☁️ 陰", rain_mm: 0, temp: 24 },
    { name: "🌧️ 小雨", rain_mm: 0.6, temp: 23 },
    { name: "⛈️ 大雨", rain_mm: 8, temp: 21 },
  ];

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

  const districts = useMemo(
    () => ["全部", ...Array.from(new Set((stations || []).map(s => s.district).filter(Boolean))).sort()],
    [stations]
  );

  // 依行政區 + 關鍵字篩選站點
  const filteredStations = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return (stations || []).filter((s) => {
      const okD = districtFilter === "全部" || s.district === districtFilter;
      const okQ = !q || String(s.station_name || "").toLowerCase().includes(q) || String(s.station_id).includes(q);
      return okD && okQ;
    });
  }, [stations, searchText, districtFilter]);

  // 置頂常用於下拉
  const orderedStations = useMemo(() => {
    const favSet = new Set(favorites);
    const favs = filteredStations.filter(s => favSet.has(String(s.station_id)));
    const others = filteredStations.filter(s => !favSet.has(String(s.station_id)));
    return [...favs, ...others];
  }, [filteredStations, favorites]);

  // 篩選後若目前站點不在清單內，自動改選第一個
  useEffect(() => {
    if (!orderedStations.length) return;
    const exist = orderedStations.some(s => String(s.station_id) === String(stationId));
    if (!exist) setStationId(String(orderedStations[0].station_id));
  }, [orderedStations, stationId]);

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
        date,
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
  }, [stationId, date, time, rainMm, isRain, tempC, rangeView]);

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

  // ====== 主題樣式（夜間=原本藍青；日間=黑白灰） ======
  const bgClass = isDarkMode
    ? "bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950"
    : "bg-gradient-to-br from-gray-50 via-gray-100 to-white";
  const cardClass = isDarkMode
    ? "bg-white/10 backdrop-blur-xl border-white/20"
    : "bg-white border-gray-200";
  const textPrimary = isDarkMode ? "text-white" : "text-gray-900";
  const textSecondary = isDarkMode ? "text-slate-300" : "text-gray-600";
  const accentColor = isDarkMode ? "text-cyan-300" : "text-gray-900";
  const primaryBtn = isDarkMode ? "bg-cyan-600/80 hover:bg-cyan-600 backdrop-blur-sm" : "bg-black hover:bg-gray-900";
  const inputBg = isDarkMode ? "bg-white/5 border-white/20 backdrop-blur-sm" : "bg-white border-gray-300";
  const accentGradient = isDarkMode ? "from-cyan-500 to-sky-600" : "from-gray-900 to-gray-700";

  // charts（日間顏色→黑灰；夜間維持原樣）
  const chartStroke = {
    axis: isDarkMode ? "#94a3b8" : "#111827",
    grid: isDarkMode ? "#334155" : "#e5e7eb",
    rent: isDarkMode ? "#06b6d4" : "#111827",
    ret: isDarkMode ? "#38bdf8" : "#6b7280",
    remain: isDarkMode ? "#94a3b8" : "#9ca3af",
    barRent: isDarkMode ? "#06b6d4" : "#111827",
    barRet: isDarkMode ? "#38bdf8" : "#6b7280",
    pieUse: isDarkMode ? "#06b6d4" : "#111827",
    pieSlot: isDarkMode ? "#64748b" : "#d1d5db",
  };

  // ====== 共用 Tooltip 樣式（避免黑底黑字） ======
  const tooltipStyle = {
    contentStyle: {
      backgroundColor: isDarkMode ? "rgba(15,23,42,0.95)" : "#ffffff", // 夜間深藍黑 / 日間白
      border: `1px solid ${isDarkMode ? "#334155" : "#e5e7eb"}`,
      borderRadius: 12,
      boxShadow: isDarkMode ? "0 8px 24px rgba(0,0,0,0.40)" : "0 8px 24px rgba(0,0,0,0.08)",
      color: isDarkMode ? "#e5e7eb" : "#111827",
      padding: 10,
    },
    itemStyle: {
      color: isDarkMode ? "#e5e7eb" : "#111827",
    },
    labelStyle: {
      color: isDarkMode ? "#e5e7eb" : "#111827",
      fontWeight: 600,
    },
    wrapperStyle: { outline: "none" },
  };

  // === 風險條顏色：低=綠 / 中=橙 / 高=紅（支援日/夜） ===
  const riskBarClass = (level) => {
    const lv = String(level || "").trim();
    if (lv === "高") return isDarkMode ? "bg-red-400" : "bg-red-500";
    if (lv === "中") return isDarkMode ? "bg-amber-400" : "bg-amber-500";
    return isDarkMode ? "bg-green-400" : "bg-green-500"; // 低
  };

  return (
    <div className={`${isDarkMode ? "theme-dark" : "theme-light"} min-h-screen ${bgClass} ${textPrimary}`}>
      <div className={`${cardClass} border sticky top-0 z-50 ${isDarkMode ? 'bg-white/5' : 'bg-white'}`}>
        <div className="max-w-[1920px] mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 bg-gradient-to-br ${accentGradient} rounded-xl flex items-center justify-center shadow-lg`}>
                <Bike className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="text-lg font-bold">YouBike 機器學習預測系統</div>
                <div className={`text-xs ${textSecondary}`}>智慧還車系統</div>
              </div>
            </div>
            <div className={`h-8 w-px ${isDarkMode ? 'bg-white/20' : 'bg-gray-300'}`} />
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4" />
              <span>{date} {time}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle isDark={isDarkMode} onToggle={() => setIsDarkMode(!isDarkMode)} />
            <button onClick={runAll} disabled={loadingAll}
              className={`px-4 py-2 ${primaryBtn} text-white rounded-xl flex items-center gap-2 text-sm font-medium disabled:opacity-50 shadow-lg transition`}>
              {loadingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              更新
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1920px] mx-auto p-6">
        <div className="grid grid-cols-12 gap-6">
          
          {/* 左側：常用 / 站點 / 天氣 / 時間 */}
          <div className="col-span-12 lg:col-span-3 space-y-6">
            {/* 常用站點卡片 */}
            <div className={`${cardClass} border rounded-2xl p-5 shadow-xl`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-sm">常用站點</h3>
                {favorites.length > 0 && (
                  <button
                    onClick={() => { setFavorites([]); localStorage.setItem(LS_FAV_KEY, "[]"); }}
                    className={`text-xs underline ${isDarkMode ? 'text-slate-300' : 'text-gray-600'}`}
                  >
                    清空
                  </button>
                )}
              </div>
              {favorites.length === 0 ? (
                <div className={`text-xs ${textSecondary}`}>還沒有常用站點，請先在下拉選單選擇站點並按 ⭐ 加入。</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {favorites
                    .map(fid => stations.find(s => String(s.station_id) === String(fid)))
                    .filter(Boolean)
                    .map(st => (
                      <div key={st.station_id}
                        className={`group inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs cursor-pointer
                          ${isDarkMode ? 'bg-white/5 hover:bg-white/10 border-white/15' : 'bg-gray-50 hover:bg-gray-100 border-gray-200'}`}
                        onClick={() => setStationId(String(st.station_id))}
                      >
                        <span className="font-medium">{st.station_name}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleFav(st.station_id); }}
                          className={`${isDarkMode ? 'text-slate-300' : 'text-gray-500'} opacity-70 group-hover:opacity-100`}
                          title="移除常用"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </div>

            <div className={`${cardClass} border rounded-2xl p-5 shadow-xl`}>
              <div className="flex items-center gap-2 mb-4">
                <MapPin className={`w-5 h-5 ${isDarkMode ? 'text-cyan-300' : 'text-gray-800'}`} />
                <h3 className="font-bold text-sm">站點選擇</h3>
              </div>
              <div className="space-y-3">
                <input type="text" placeholder="搜尋..." value={searchText} onChange={(e) => setSearchText(e.target.value)}
                  className={`w-full px-3 py-2 text-sm rounded-xl border ${inputBg} ${textPrimary}`} />
                <select value={districtFilter} onChange={(e) => setDistrictFilter(e.target.value)}
                  className={`w-full px-3 py-2 text-sm rounded-xl border ${inputBg} ${textPrimary}`}
                  style={{ color: isDarkMode ? 'white' : 'black' }}>
                  {districts.map((d) => <option key={d} value={d} style={{ color: 'black', backgroundColor: 'white' }}>{d}</option>)}
                </select>

                {/* 下拉 + ⭐ */}
                <div className="flex gap-2 items-center">
                  <select
                    value={stationId}
                    onChange={(e) => setStationId(e.target.value)}
                    className={`station-select w-full px-3 py-2 text-sm rounded-xl border ${inputBg} ${textPrimary}`}
                  >
                    {orderedStations.map((s) => (
                      <option key={s.station_id} value={s.station_id}>
                        {isFav(s.station_id) ? "★ " : ""}{s.station_name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => toggleFav(stationId)}
                    title={isFav(stationId) ? "從常用移除" : "加入常用"}
                    className={`shrink-0 px-3 py-2 rounded-xl border transition
                      ${isDarkMode ? 'bg-white/10 hover:bg-white/20 border-white/20' : 'bg-gray-100 hover:bg-gray-200 border-gray-300'}`}
                  >
                    <span className={`text-lg ${isFav(stationId) ? (isDarkMode ? 'text-yellow-300' : 'text-yellow-500') : (isDarkMode ? 'text-slate-300' : 'text-gray-500')}`}>
                      ★
                    </span>
                  </button>
                </div>
              </div>
            </div>

            <div className={`${cardClass} border rounded-2xl p-5 shadow-xl`}>
              <div className="flex items-center gap-2 mb-4">
                <Cloud className={`w-5 h-5 ${isDarkMode ? 'text-cyan-300' : 'text-gray-800'}`} />
                <h3 className="font-bold text-sm">天氣設定</h3>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {presets.map((p) => (
                  <button key={p.name} onClick={() => { setRainMm(p.rain_mm); setTempC(clamp(p.temp, 0, 50)); }}
                    className={`px-3 py-2 text-xs rounded-xl font-medium transition shadow ${
                      isDarkMode
                        ? 'bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20'
                        : 'bg-gray-100 hover:bg-gray-200 border border-gray-300'
                    }`}>
                    {p.name}
                  </button>
                ))}
              </div>
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1 text-xs">
                      <Thermometer className="w-3 h-3" />
                      <span>溫度</span>
                    </div>
                    <span className="text-xs font-mono">{tempC}°C</span>
                  </div>
                  <input type="range" min="0" max="50" step="0.1" value={tempC}
                    onChange={(e) => setTempC(Number(e.target.value))} className="w-full h-1" />
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
                    onChange={(e) => setRainMm(Number(e.target.value))} className="w-full h-1" />
                </div>
              </div>
            </div>

            <div className={`${cardClass} border rounded-2xl p-5 shadow-xl`}>
              <div className="flex items-center gap-2 mb-4">
                <Calendar className={`w-5 h-5 ${isDarkMode ? 'text-cyan-300' : 'text-gray-800'}`} />
                <h3 className="font-bold text-sm">時間設定</h3>
              </div>
              <div className="space-y-3">
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                  className={`w-full px-3 py-2 text-sm rounded-xl border ${inputBg} ${textPrimary}`} />
                <input type="time" value={time} onChange={(e) => setTime(e.target.value)}
                  className={`w-full px-3 py-2 text-sm rounded-xl border ${inputBg} ${textPrimary}`} />
              </div>
              <div className="grid grid-cols-3 gap-2 mt-4">
                {[["next6", "6小時"], ["next12", "12小時"], ["today", "今日"], ["tomorrow", "明日"], ["dayafter", "後日"]].map(([k, label]) => (
                  <button key={k} onClick={() => setRangeView(k)}
                    className={`px-2 py-1.5 text-xs rounded-xl font-medium shadow transition ${
                      rangeView === k ? `${primaryBtn} text-white`
                      : isDarkMode
                        ? 'bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20'
                        : 'bg-gray-100 hover:bg-gray-200 border border-gray-300'
                    }`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 中間：即時、預測、時段 */}
          <div className="col-span-12 lg:col-span-6 space-y-6">
            <div className={`${cardClass} border rounded-2xl p-6 shadow-xl`}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">即時狀態</h2>
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${
                  isDarkMode
                    ? 'bg-green-400/20 text-green-300 border border-green-400/30'
                    : 'bg-gray-200 text-gray-700 border border-gray-300'
                }`}>
                  <div className={`w-2 h-2 rounded-full animate-pulse ${isDarkMode ? 'bg-green-400' : 'bg-gray-900'}`} />
                  LIVE
                </div>
              </div>
              <div className="grid grid-cols-3 gap-6 mb-6">
                <div className="text-center">
                  <div className={`text-5xl font-bold ${accentColor}`}>{realtime?.remain_bikes ?? "—"}</div>
                  <div className={`text-sm ${textSecondary} mt-2`}>可借車輛</div>
                </div>
                <div className="text-center">
                  <div className={`text-5xl font-bold ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>{realtime?.remain_slots ?? "—"}</div>
                  <div className={`text-sm ${textSecondary} mt-2`}>可停車格</div>
                </div>
                <div className="text-center">
                  <div className={`text-5xl font-bold ${isDarkMode ? 'text-cyan-400' : 'text-gray-800'}`}>{realtime?.capacity ?? "—"}</div>
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
                <div className={`text-xs ${textSecondary}`}>RandomForest 模型預測</div>
              </div>
              <div className="h-80">
                <ResponsiveContainer>
                  <LineChart data={series} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                <AlertTriangle className={`w-5 h-5 ${isDarkMode ? 'text-amber-300' : 'text-gray-800'}`} />
                <h3 className="font-bold text-sm">風險評估</h3>
              </div>
              {risk ? (
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm">缺車風險</span>
                      <span className="text-lg font-bold">{risk.stockout.level}</span>
                    </div>
                    <div className={`w-full h-2 rounded-full overflow-hidden ${isDarkMode ? 'bg-white/10' : 'bg-gray-200'}`}>
                      <div className={`h-full ${riskBarClass(risk.stockout.level)}`} style={{ width: `${risk.stockout.score * 100}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm">滿車風險</span>
                      <span className="text-lg font-bold">{risk.full.level}</span>
                    </div>
                    <div className={`w-full h-2 rounded-full overflow-hidden ${isDarkMode ? 'bg-white/10' : 'bg-gray-200'}`}>
                      <div className={`h-full ${riskBarClass(risk.full.level)}`} style={{ width: `${risk.full.score * 100}%` }} />
                    </div>
                  </div>
                </div>
              ) : <div className={textSecondary}>等待資料...</div>}
            </div>

            <div className={`${cardClass} border rounded-2xl p-5 shadow-xl`}>
              <div className="flex items-center gap-2 mb-4">
                <Leaf className={`w-5 h-5 ${isDarkMode ? 'text-green-300' : 'text-gray-800'}`} />
                <h3 className="font-bold text-sm">環境效益</h3>
              </div>
              <div className="space-y-4">
                <div className={`text-center py-4 rounded-xl ${
                  isDarkMode ? 'bg-green-400/10 border border-green-400/20' : 'bg-gray-50 border border-gray-200'
                }`}>
                  <div className={`${isDarkMode ? 'text-green-300' : 'text-gray-900'} text-3xl font-bold`}>{Math.round(eco.trips)}</div>
                  <div className={`text-xs ${textSecondary} mt-1`}>預測騎乘趟數</div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className={`flex justify-between p-2 rounded-lg ${isDarkMode ? 'bg-green-400/10' : 'bg-gray-50'}`}>
                    <span>vs 機車</span>
                    <span className="font-bold">-{eco.saveScooter.toFixed(1)} kg</span>
                  </div>
                  <div className={`flex justify-between p-2 rounded-lg ${isDarkMode ? 'bg-green-400/10' : 'bg-gray-50'}`}>
                    <span>vs 汽車</span>
                    <span className="font-bold">-{eco.saveCar.toFixed(1)} kg</span>
                  </div>
                  <div className={`text-xs ${textSecondary} text-center mt-2`}>CO₂ 減量估算</div>
                </div>
              </div>
            </div>

            {selectedStation && (
              <div className={`${cardClass} border rounded-2xl p-5 shadow-xl`}>
                <div className="flex items-center gap-2 mb-4">
                  <MapPin className={`w-5 h-5 ${isDarkMode ? 'text-pink-300' : 'text-gray-800'}`} />
                  <h3 className="font-bold text-sm">站點資訊</h3>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className={textSecondary}>站點名稱</span>
                    <span className="font-medium">{selectedStation.station_name}</span>
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
