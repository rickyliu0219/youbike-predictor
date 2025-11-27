// src/App.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Bike, Clock3, MapPin, RefreshCw, Loader2, AlertTriangle, Leaf, SlidersHorizontal, Sun, Moon } from "lucide-react";

// 後端 API（Vite 代理 /api → http://localhost:8000）
const API = "/api";

// 小工具
const round2 = (x) => Math.round((Number(x) || 0) * 100) / 100;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const TAIPEI_TZ = "Asia/Taipei";
function nowInTaipei() {
  const s = new Date().toLocaleString("sv-SE", { timeZone: TAIPEI_TZ, hour12: false });
  const [d, t] = s.split(" ");
  return { date: d, time: t.slice(0, 5) };
}
const getHour = (val) => {
  const s = String(val ?? "");
  const tail = s.slice(-5);
  const m = /^(\d{2}):(\d{2})$/.exec(tail);
  return m ? Number(m[1]) : NaN;
};

/* ================= 背景元件（黑白幾何網路 + 輕微動畫） ================= */
function GeoBackground({ isDarkMode }) {
  const leftPts = [
    [60, 250], [120, 140], [180, 220], [240, 90], [260, 260], [320, 180], [360, 300],
    [80, 380], [160, 450], [240, 360], [300, 480], [380, 420], [420, 520], [500, 460],
  ];
  const rightPts = [
    [1100, 180], [1180, 90], [1240, 200], [1320, 140], [1380, 240], [1460, 120],
    [1100, 340], [1180, 420], [1260, 360], [1340, 460], [1420, 380], [1500, 520], [1560, 440],
  ];

  // ✅ 只回傳有效的 [p, q] 配對
  const mkEdges = (pts) => {
    const edges = [];
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      edges.push([pts[i], pts[(i + 1) % n]]); // 鄰點
      if (i + 2 < n) edges.push([pts[i], pts[i + 2]]); // 隔一點
    }
    return edges;
  };

  const leftEdges = mkEdges(leftPts);
  const rightEdges = mkEdges(rightPts);

  return (
    <>
      <style>{`
        @keyframes drift-left  { 0%{transform:translateX(-2%)} 50%{transform:translateX(1%)} 100%{transform:translateX(-2%)} }
        @keyframes drift-right { 0%{transform:translateX( 2%)} 50%{transform:translateX(-1%)} 100%{transform:translateX( 2%)} }
        
        /* 日間模式 - 粉色系漸層 */
        .bg-day-grad { 
          background: linear-gradient(135deg, #fce7f3 0%, #fbcfe8 20%, #f9a8d4 40%, #f472b6 70%, #ec4899 100%);
        }
        
        /* 夜間模式 - 彩色漸層 */
        .bg-night-grad { 
          background: linear-gradient(135deg, #1e1b4b 0%, #4c1d95 20%, #7c3aed 40%, #a78bfa 60%, #c084fc 80%, #e879f9 100%);
        }
        
        .center-scrim-day { 
          background: radial-gradient(700px 420px at 50% 42%, rgba(255,255,255,0.90) 0%, rgba(255,255,255,0.75) 40%, rgba(255,255,255,0.40) 70%, rgba(255,255,255,0.10) 100%); 
        }
        
        .center-scrim-night { 
          background: radial-gradient(700px 420px at 50% 42%, rgba(0,0,0,0.20) 0%, rgba(0,0,0,0.15) 40%, rgba(0,0,0,0.10) 70%, rgba(0,0,0,0.05) 100%); 
        }
        
        .animate-left { animation: drift-left 28s ease-in-out infinite; }
        .animate-right { animation: drift-right 28s ease-in-out infinite; }
        
        .glass-card-day { 
          background: rgba(255,255,255,0.45); 
          backdrop-filter: blur(22px); 
          -webkit-backdrop-filter: blur(22px);
          border: 1px solid rgba(0,0,0,0.06); 
          border-radius: 22px; 
          box-shadow: 0 12px 40px rgba(0,0,0,0.08); 
        }
        
        .glass-card-night { 
          background: rgba(255,255,255,0.15); 
          backdrop-filter: blur(22px); 
          -webkit-backdrop-filter: blur(22px);
          border: 1px solid rgba(255,255,255,0.15); 
          border-radius: 22px; 
          box-shadow: 0 12px 40px rgba(0,0,0,0.25); 
        }
      `}</style>

      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className={`absolute inset-0 ${isDarkMode ? 'bg-night-grad' : 'bg-day-grad'}`} />

        {/* 左側 */}
        <svg className="absolute left-0 top-0 h-full w-[60%] opacity-70 animate-left"
             viewBox="0 0 800 900" preserveAspectRatio="none">
          <g stroke={isDarkMode ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.35)"} strokeWidth="1.4" fill="none">
            {leftEdges.map(([a, b], idx) => (
              <line key={idx} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />
            ))}
          </g>
          <g fill={isDarkMode ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.5)"}>
            {leftPts.map(([x, y], i) => (<circle key={i} cx={x} cy={y} r="3.2" />))}
          </g>
        </svg>

        {/* 右側 */}
        <svg className="absolute right-0 top-0 h-full w-[60%] opacity-70 animate-right"
             viewBox="800 0 800 900" preserveAspectRatio="none">
          <g stroke={isDarkMode ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.35)"} strokeWidth="1.4" fill="none">
            {rightEdges.map(([a, b], idx) => (
              <line key={idx} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />
            ))}
          </g>
          <g fill={isDarkMode ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.5)"}>
            {rightPts.map(([x, y], i) => (<circle key={i} cx={x} cy={y} r="3.2" />))}
          </g>
        </svg>

        <div className={`absolute inset-0 ${isDarkMode ? 'center-scrim-night' : 'center-scrim-day'}`} />
      </div>
    </>
  );
}

/* ================= 背景元件結束 ================= */

export default function App() {
  // 日夜間模式
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  // 站點與篩選
  const [stations, setStations] = useState([]);
  const [stationId, setStationId] = useState("");
  const [searchText, setSearchText] = useState("");
  const [districtFilter, setDistrictFilter] = useState("全部");

  // 時間 / 天氣
  const [date, setDate] = useState(() => nowInTaipei().date);
  const [time, setTime] = useState(() => nowInTaipei().time);
  const [rainMm, setRainMm] = useState(0);
  const [isRain, setIsRain] = useState(0);
  const [tempC, setTempC] = useState(26);
  const [rangeView, setRangeView] = useState("today"); // next6 | next12 | today | tomorrow | dayafter

  // 即時與序列
  const [realtime, setRealtime] = useState(null);
  const [series, setSeries] = useState([]);
  const [loadingAll, setLoadingAll] = useState(false);

  const presets = [
    { name: "晴朗",   rain_mm: 0,   temp: 28 },
    { name: "陰",     rain_mm: 0,   temp: 24 },
    { name: "毛毛雨", rain_mm: 0.6, temp: 23 },
    { name: "大雨",   rain_mm: 8,   temp: 21 },
  ];

  // 讀站點
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API}/stations`);
        const j = await r.json();
        setStations(j || []);
        if (j?.length) setStationId(String(j[0].station_id));
      } catch (e) {
        console.error(e);
        alert("載入站點失敗，請檢查後端 /stations");
      }
    })();
  }, []);

  // 行政區清單 + 篩選
  const districts = useMemo(
    () => ["全部", ...Array.from(new Set((stations || []).map(s => s.district).filter(Boolean))).sort()],
    [stations]
  );
  const filteredStations = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return (stations || []).filter((s) => {
      const okD = districtFilter === "全部" || s.district === districtFilter;
      const okQ =
        !q ||
        String(s.station_name || "").toLowerCase().includes(q) ||
        String(s.station_id).includes(q);
      return okD && okQ;
    });
  }, [stations, searchText, districtFilter]);

  useEffect(() => {
    if (!filteredStations.length) return;
    const exist = filteredStations.some(s => String(s.station_id) === String(stationId));
    if (!exist) setStationId(String(filteredStations[0].station_id));
  }, [filteredStations, stationId]);

  // isRain 跟著雨量
  useEffect(() => {
    if (rainMm > 0 && isRain !== 1) setIsRain(1);
    if (rainMm === 0 && isRain !== 0) setIsRain(0);
  }, [rainMm, isRain]);

  // 即時 KPI
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
            capacity:
              Number(
                j.docks_total ||
                (Number(j.available_rent_bikes || 0) + Number(j.available_return_bikes || 0)) ||
                0
              ),
          });
        } else {
          setRealtime(null);
        }
      } catch {
        setRealtime(null);
      }
    })();
  }, [stationId]);

  // 取得預測序列
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
        const txt = await r.text().catch(() => "");
        console.warn("forecast_day fail:", r.status, txt);
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

  const deb = useRef(null);
  useEffect(() => {
    if (!stationId) return;
    clearTimeout(deb.current);
    deb.current = setTimeout(runAll, 250);
    return () => clearTimeout(deb.current);
  }, [stationId, date, time, rainMm, isRain, tempC, rangeView]);

  // 分段匯總
  const aggregates = useMemo(() => {
    const toInt = (x) => Math.max(0, Math.round(Number(x) || 0));
    const inRange = (lo, hi) => (r) => {
      const h = getHour(r?.hour);
      return Number.isFinite(h) && h >= lo && h <= hi;
    };
    const sumInt = (rows, key) => rows.reduce((acc, r) => acc + toInt(r?.[key]), 0);
    const morningRows = series.filter(inRange(6, 9));
    const noonRows = series.filter(inRange(12, 13));
    const eveningRows = series.filter(inRange(16, 18));
    const windowRows = series;
    return {
      morning: { rent: sumInt(morningRows, "rent"), ret: sumInt(morningRows, "ret") },
      noon: { rent: sumInt(noonRows, "rent"), ret: sumInt(noonRows, "ret") },
      evening: { rent: sumInt(eveningRows, "rent"), ret: sumInt(eveningRows, "ret") },
      day: { rent: sumInt(windowRows, "rent"), ret: sumInt(windowRows, "ret") },
    };
  }, [series]);

  const selectedStation = useMemo(
    () => stations.find((s) => String(s.station_id) === String(stationId)),
    [stations, stationId]
  );

  // 風險
  const risk = useMemo(() => {
    const capFromRt =
      Number(realtime?.remain_bikes || 0) + Number(realtime?.remain_slots || 0);
    const cap =
      Number(realtime?.capacity || capFromRt || selectedStation?.docks_total || 0);
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

  // 減碳
  const eco = useMemo(() => {
    const trips = Number(aggregates?.day?.rent || 0), KM = 2.5, EF_M = 0.075, EF_C = 0.17;
    return { trips: round2(trips), km: KM, saveScooter: round2(trips * KM * EF_M), saveCar: round2(trips * KM * EF_C) };
  }, [aggregates?.day]);

  // 視窗標籤（← 這裡已改成純 JS，沒有 TypeScript 斷言）
  const viewLabel = useMemo(() => {
    const map = {
      next6: "近 6 小時",
      next12: "近 12 小時",
      today: "今日",
      tomorrow: "明日",
      dayafter: "後日",
    };
    return map[rangeView] || "今日";
  }, [rangeView]);

  const btnPrimary = isDarkMode 
    ? "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 bg-purple-600 text-white font-semibold shadow hover:brightness-110 shadow-purple-400/50"
    : "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 bg-pink-500 text-white font-semibold shadow hover:brightness-110 shadow-pink-300/50";

  const textClass = isDarkMode ? "text-gray-100" : "text-slate-900";
  const glassCard = isDarkMode ? "glass-card-night" : "glass-card-day";

  return (
    <div className={`relative min-h-screen ${textClass}`}>
      <GeoBackground isDarkMode={isDarkMode} />

      <header className={`sticky top-0 z-10 backdrop-blur-2xl ${isDarkMode ? 'bg-black/30' : 'bg-white/60'} border-b ${isDarkMode ? 'border-white/20' : 'border-white/70'}`}>
        <div className="max-w-7xl xl:max-w-8xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div initial={{ rotate: -10, scale: 0.9 }} animate={{ rotate: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 180 }}
              className={`p-2 rounded-2xl ${isDarkMode ? 'bg-purple-900/50' : 'bg-white/80'} border ${isDarkMode ? 'border-purple-400/30' : 'border-white/80'} shadow`}>
              <Bike className={`w-6 h-6 ${isDarkMode ? 'text-purple-300' : 'text-pink-600'}`} />
            </motion.div>
            <h1 className="text-xl font-semibold tracking-wide">YouBike 需求預測</h1>
          </div>
          
          {/* 日夜間切換按鈕 */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={`flex items-center gap-2 px-4 py-2 rounded-2xl transition-all duration-300 ${
              isDarkMode 
                ? 'bg-purple-600/50 hover:bg-purple-600/70 text-purple-100 border border-purple-400/30' 
                : 'bg-pink-200/50 hover:bg-pink-300/50 text-pink-900 border border-pink-300/50'
            }`}
          >
            {isDarkMode ? (
              <>
                <Moon className="w-4 h-4" />
                <span className="text-sm font-medium">夜間模式</span>
              </>
            ) : (
              <>
                <Sun className="w-4 h-4" />
                <span className="text-sm font-medium">日間模式</span>
              </>
            )}
          </motion.button>
        </div>
      </header>

      <main className="max-w-7xl xl:max-w-8xl mx-auto px-4 py-8 grid grid-cols-1 xl:grid-cols-4 gap-5">
        {/* 左側控制 */}
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="lg:col-span-1 space-y-6">
          <div className={glassCard + " p-5"}>
            <div className="flex items-center gap-2 mb-3">
              <MapPin className={`w-4 h-4 ${isDarkMode ? 'text-purple-300' : 'text-slate-700'}`} /><h2 className="font-semibold">站點</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
              <input type="text" placeholder="搜尋站名或 ID" value={searchText} onChange={(e) => setSearchText(e.target.value)}
                className={`w-full ${isDarkMode ? 'bg-black/30 border-white/20 text-white placeholder:text-gray-400' : 'bg-white/60 border-white/70 placeholder:text-slate-400'} border rounded-xl px-3 py-2`} />
              <select className={`w-full ${isDarkMode ? 'bg-black/30 border-white/20 text-white' : 'bg-white/60 border-white/70'} border rounded-xl px-3 py-2`}
                value={districtFilter} onChange={(e) => setDistrictFilter(e.target.value)}>
                {districts.map((d) => <option key={d} value={d} className={isDarkMode ? 'bg-gray-800' : 'bg-white'}>{d}</option>)}
              </select>
            </div>
            <select className={`w-full ${isDarkMode ? 'bg-black/30 border-white/20 text-white' : 'bg-white/60 border-white/70'} border rounded-xl px-3 py-2`}
              value={stationId} onChange={(e) => setStationId(e.target.value)}>
              {filteredStations.map((s) => (
                <option key={s.station_id} value={s.station_id} className={isDarkMode ? 'bg-gray-800' : 'bg-white'}>
                  {s.station_name}（{s.district}｜柱:{s.docks_total}｜ID:{s.station_id}）
                </option>
              ))}
            </select>
          </div>

          <div className={glassCard + " p-5"}>
            <div className="flex items-center gap-2 mb-3">
              <Clock3 className={`w-4 h-4 ${isDarkMode ? 'text-amber-400' : 'text-amber-700'}`} /><h2 className="font-semibold">時間</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={`block text-xs ${isDarkMode ? 'text-gray-300' : 'text-slate-600'} mb-1`}>日期（台灣時間）</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                  className={`w-full ${isDarkMode ? 'bg-black/30 border-white/20 text-white' : 'bg-white/60 border-white/70'} border rounded-xl px-3 py-2`} />
              </div>
              <div>
                <label className={`block text-xs ${isDarkMode ? 'text-gray-300' : 'text-slate-600'} mb-1`}>時間（台灣時間）</label>
                <input type="time" value={time} onChange={(e) => setTime(e.target.value)}
                  className={`w-full ${isDarkMode ? 'bg-black/30 border-white/20 text-white' : 'bg-white/60 border-white/70'} border rounded-xl px-3 py-2`} />
              </div>
            </div>
          </div>

          <div className={glassCard + " p-5"}>
            <div className="flex items-center gap-2 mb-3">
              <SlidersHorizontal className={`w-4 h-4 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-700'}`} /><h2 className="font-semibold">時間範圍</h2>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {[
                ["next6", "近6小時"],
                ["next12", "近12小時"],
                ["today", "今日"],
                ["tomorrow", "明日"],
                ["dayafter", "後日"],
              ].map(([k, label]) => (
                <button key={k} onClick={() => setRangeView(k)}
                  className={`text-xs rounded-xl px-2 py-1.5 border transition ${
                    rangeView === k 
                      ? isDarkMode ? "bg-purple-600 text-white border-purple-500 shadow" : "bg-pink-500 text-white border-pink-500 shadow"
                      : isDarkMode ? "bg-black/30 border-white/20 hover:bg-black/40 text-gray-200" : "bg-white/60 border-white/70 hover:bg-white/80"
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className={glassCard + " p-5"}>
            <div className="flex items-center gap-2 mb-3">
              <SlidersHorizontal className={`w-4 h-4 ${isDarkMode ? 'text-violet-400' : 'text-violet-700'}`} /><h2 className="font-semibold">天氣</h2>
            </div>
            <div className="grid grid-cols-4 gap-2 mb-2">
              {presets.map((p) => (
                <button key={p.name}
                  onClick={() => { setRainMm(p.rain_mm); setTempC(clamp(p.temp, 0, 50)); }}
                  className={`text-xs rounded-xl px-2 py-1.5 ${isDarkMode ? 'bg-black/30 border-white/20 hover:bg-black/40 text-gray-200' : 'bg-white/60 border-white/70 hover:bg-white/80'} border`}>
                  {p.name}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className={`flex justify-between text-xs ${isDarkMode ? 'text-gray-300' : 'text-slate-600'}`}>
                  <span>氣溫</span><span>{tempC} °C</span>
                </div>
                <input type="range" min="0" max="50" step="0.1" value={tempC}
                  onChange={(e) => setTempC(Number(e.target.value))} className="w-full" />
              </div>
              <div>
                <div className={`flex justify-between text-xs ${isDarkMode ? 'text-gray-300' : 'text-slate-600'}`}>
                  <span>降雨量</span><span>{rainMm} mm</span>
                </div>
                <input type="range" min="0" max="20" step="0.1" value={rainMm}
                  onChange={(e) => setRainMm(Number(e.target.value))} className="w-full" />
              </div>
            </div>
          </div>

          <motion.button whileTap={{ scale: 0.98 }} onClick={runAll} disabled={loadingAll}
            className={`w-full ${btnPrimary}`}>
            {loadingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            更新預測（即時＋曲線）
          </motion.button>
        </motion.section>

        {/* 右側視覺化 */}
        <motion.section className="xl:col-span-3 space-y-6">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className={glassCard + " p-5"}>
              <div className={`text-sm ${isDarkMode ? 'text-emerald-400' : 'text-emerald-800/90'}`}>即時剩餘車輛</div>
              <div className="text-3xl font-bold mt-1">{realtime ? realtime.remain_bikes : "—"}</div>
              <div className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-slate-600'} mt-2`}>更新時間：{realtime?.update_time || "—"}</div>
            </div>
            <div className={glassCard + " p-5"}>
              <div className={`text-sm ${isDarkMode ? 'text-cyan-400' : 'text-cyan-800/90'}`}>即時剩餘車格</div>
              <div className="text-3xl font-bold mt-1">{realtime ? realtime.remain_slots : "—"}</div>
              <div className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-slate-600'} mt-2`}>更新時間：{realtime?.update_time || "—"}</div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className={glassCard + " p-5"}>
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className={`w-4 h-4 ${isDarkMode ? 'text-amber-400' : 'text-amber-700'}`} /><h3 className="font-semibold">下一小時風險預報</h3>
              </div>
              {(() => {
                if (!risk) return <div className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-slate-600'}`}>請先選站點，並取得即時資料。</div>;
                return (
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className={`${isDarkMode ? 'text-gray-300' : 'text-slate-600'} text-xs mb-1`}>缺車風險</div>
                      <div className="text-lg font-semibold">{risk.stockout.level}（{Math.round(risk.stockout.score * 100)}%）</div>
                      <div className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-slate-600'} mt-1`}>依「剩餘車輛/容量」估算；容量=柱數 {risk.capacity}</div>
                    </div>
                    <div>
                      <div className={`${isDarkMode ? 'text-gray-300' : 'text-slate-600'} text-xs mb-1`}>滿車風險</div>
                      <div className="text-lg font-semibold">{risk.full.level}（{Math.round(risk.full.score * 100)}%）</div>
                      <div className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-slate-600'} mt-1`}>依「剩餘車格/容量」估算</div>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className={glassCard + " p-5"}>
              <div className="flex items-center gap-2 mb-2">
                <Leaf className={`w-4 h-4 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-700'}`} /><h3 className="font-semibold">節能與減碳估算（視窗內）</h3>
              </div>
              <div className="text-sm">
                <div>預測借車總數：<span className="font-semibold">{Math.round(eco.trips)}</span> 趟</div>
                <div className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-slate-600'}`}>平均里程 2.5 km/趟（可調）</div>
                <div className="mt-2">相對機車節省：<span className="font-semibold">{eco.saveScooter.toFixed(2)} kg CO₂e</span></div>
                <div>相對汽車節省：<span className="font-semibold">{eco.saveCar.toFixed(2)} kg CO₂e</span></div>
              </div>
            </div>
          </div>

          {/* 曲線 */}
          <div className={glassCard + " p-5"}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Bike className={`w-4 h-4 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-700'}`} /><h2 className="font-semibold">{viewLabel} 曲線</h2>
              </div>
              <div className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-slate-600'}`}>
                {rangeView === "today" ? `${date}・即時校準 + 模型預測` : "即時校準 + 模型預測"}
              </div>
            </div>
            <div className="h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(15,23,42,0.06)"} />
                  <XAxis dataKey="hour" stroke={isDarkMode ? "rgba(255,255,255,0.5)" : "rgba(51,65,85,0.7)"} tick={{ fontSize: 12 }} />
                  <YAxis yAxisId="flow" stroke={isDarkMode ? "rgba(255,255,255,0.5)" : "rgba(51,65,85,0.7)"} tick={{ fontSize: 12 }}
                    domain={[0, 15]} ticks={[0, 5, 10, 15]} />
                  <YAxis yAxisId="remain" orientation="right" stroke={isDarkMode ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.7)"} tick={{ fontSize: 12 }}
                    domain={[
                      0,
                      (realtime?.capacity ||
                        (realtime?.remain_bikes || 0) + (realtime?.remain_slots || 0) ||
                        selectedStation?.docks_total || 0),
                    ]}
                    ticks={(() => {
                      const cap = (realtime?.capacity ||
                        (realtime?.remain_bikes || 0) + (realtime?.remain_slots || 0) ||
                        selectedStation?.docks_total || 0);
                      if (!cap) return [0];
                      const mid = Math.max(1, Math.round(cap / 2));
                      return [0, mid, cap];
                    })()}
                  />
                  <Tooltip
                    contentStyle={{
                      background: isDarkMode ? "rgba(0,0,0,0.85)" : "rgba(255,255,255,0.85)",
                      backdropFilter: "blur(12px)",
                      border: isDarkMode ? "1px solid rgba(255,255,255,0.2)" : "1px solid rgba(0,0,0,0.06)",
                      borderRadius: 12,
                      color: isDarkMode ? "#ffffff" : "#0f172a",
                    }}
                    formatter={(v, n) => [v == null ? "—" : Math.round(v), n]}
                  />
                  <Legend wrapperStyle={{ color: isDarkMode ? "#ffffff" : "#334155" }} />
                  <Line yAxisId="flow" type="monotone" dataKey="rent" name="借車(預測)" dot={false} stroke="#10b981" strokeWidth={2} />
                  <Line yAxisId="flow" type="monotone" dataKey="ret"  name="還車(預測)" dot={false} stroke="#3b82f6" strokeWidth={2} />
                  <Line yAxisId="remain" type="monotone" dataKey="remain" name="剩餘(推估)" dot={false} stroke={isDarkMode ? "#a78bfa" : "#6b7280"} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 匯總 */}
          <div className="grid md:grid-cols-4 gap-4">
            <div className={glassCard + " p-5"}>
              <div className={`text-sm ${isDarkMode ? 'text-gray-200' : 'text-slate-700'} mb-1`}>上午（06—09）</div>
              <div className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-slate-600'}`}>借車</div>
              <div className="text-xl font-semibold">{Math.round(aggregates.morning.rent)}</div>
              <div className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-slate-600'} mt-1`}>還車</div>
              <div className="text-xl font-semibold">{Math.round(aggregates.morning.ret)}</div>
            </div>
            <div className={glassCard + " p-5"}>
              <div className={`text-sm ${isDarkMode ? 'text-gray-200' : 'text-slate-700'} mb-1`}>中午（12—13）</div>
              <div className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-slate-600'}`}>借車</div>
              <div className="text-xl font-semibold">{Math.round(aggregates.noon.rent)}</div>
              <div className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-slate-600'} mt-1`}>還車</div>
              <div className="text-xl font-semibold">{Math.round(aggregates.noon.ret)}</div>
            </div>
            <div className={glassCard + " p-5"}>
              <div className={`text-sm ${isDarkMode ? 'text-gray-200' : 'text-slate-700'} mb-1`}>晚上（16—18）</div>
              <div className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-slate-600'}`}>借車</div>
              <div className="text-xl font-semibold">{Math.round(aggregates.evening.rent)}</div>
              <div className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-slate-600'} mt-1`}>還車</div>
              <div className="text-xl font-semibold">{Math.round(aggregates.evening.ret)}</div>
            </div>
            <div className={glassCard + " p-5"}>
              <div className={`text-sm ${isDarkMode ? 'text-gray-200' : 'text-slate-700'} mb-1`}>{rangeView === "today" ? "全天合計" : "視窗合計"}</div>
              <div className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-slate-600'}`}>借車</div>
              <div className="text-xl font-semibold">{Math.round(aggregates.day.rent)}</div>
              <div className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-slate-600'} mt-1`}>還車</div>
              <div className="text-xl font-semibold">{Math.round(aggregates.day.ret)}</div>
            </div>
          </div>
        </motion.section>
      </main>

      <footer className="max-w-6xl mx-auto px-4 pb-10">
        <div className={glassCard + " px-4 py-3 text-center " + (isDarkMode ? 'text-gray-300' : 'text-slate-700')}>
          由劉禹寬製作。此頁僅供比賽創意用途，不保證任何預測準確性，亦不承擔任何法律責任。
        </div>
      </footer>
    </div>
  );
}