import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Bike, CloudRain, Thermometer, Clock3, MapPin, RefreshCw, Loader2 } from "lucide-react";

// Tailwind is available in this environment per instructions. No import needed.
// This component expects the backend from the previous step running at the same origin.
// It fetches /stations, and calls /predict_one to produce single-point predictions
// and an intraday (24h) sweep to draw smooth lines.

export default function App() {
  const [stations, setStations] = useState([]);
  const [stationId, setStationId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState(() => new Date().toISOString().slice(11, 16));
  const [rainMm, setRainMm] = useState(0);
  const [isRain, setIsRain] = useState(0);
  const [tempC, setTempC] = useState(26);
  const [loading, setLoading] = useState(false);
  const [chartLoading, setChartLoading] = useState(false);
  const [point, setPoint] = useState(null); // { rent_pred, return_pred }
  const [series, setSeries] = useState([]); // hourly predictions for line chart

  // Weather presets for beginners
  const presets = [
    { name: "晴朗", rain_mm: 0, is_rain: 0, temp: 28 },
    { name: "陰", rain_mm: 0, is_rain: 0, temp: 24 },
    { name: "毛毛雨", rain_mm: 0.6, is_rain: 1, temp: 23 },
    { name: "大雨", rain_mm: 8, is_rain: 1, temp: 21 },
  ];

  useEffect(() => {
    fetch("/stations")
      .then((r) => r.json())
      .then((list) => {
        setStations(list);
        if (list?.length) setStationId(String(list[0].station_id));
      })
      .catch(() => setStations([]));
  }, []);

  const tsISO = useMemo(() => {
    // Combine date + time to ISO string
    try {
      const iso = new Date(`${date}T${time}:00`).toISOString();
      return iso;
    } catch (e) {
      return new Date().toISOString();
    }
  }, [date, time]);

  async function predictOnce() {
    if (!stationId) return;
    setLoading(true);
    try {
      const body = {
        station_id: Number(stationId),
        dt: tsISO,
        rain_mm: Number(rainMm),
        is_rain: Number(isRain),
        temp_c: Number(tempC),
      };
      const r = await fetch("/predict_one", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      setPoint(j);
    } finally {
      setLoading(false);
    }
  }

  async function buildIntradaySeries() {
    if (!stationId) return;
    setChartLoading(true);
    try {
      const baseDate = date; // sweep this day's 00:00~23:00
      const hours = Array.from({ length: 24 }, (_, h) => h);
      const rows = [];
      for (const h of hours) {
        const iso = new Date(`${baseDate}T${String(h).padStart(2, "0")}:00:00`).toISOString();
        const body = {
          station_id: Number(stationId),
          dt: iso,
          rain_mm: Number(rainMm),
          is_rain: Number(isRain),
          temp_c: Number(tempC),
        };
        const r = await fetch("/predict_one", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const j = await r.json();
        rows.push({
          hour: `${String(h).padStart(2, "0")}:00`,
          rent: Math.max(0, j?.rent_pred ?? 0),
          ret: Math.max(0, j?.return_pred ?? 0),
        });
      }
      setSeries(rows);
    } finally {
      setChartLoading(false);
    }
  }

  function applyPreset(p) {
    setRainMm(p.rain_mm);
    setIsRain(p.is_rain);
    setTempC(p.temp);
  }

  const selectedStation = useMemo(
    () => stations.find((s) => String(s.station_id) === String(stationId)),
    [stations, stationId]
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-950 to-black text-slate-100">
      <header className="sticky top-0 z-10 backdrop-blur-md bg-black/40 border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-3">
          <motion.div initial={{ rotate: -10, scale: 0.9 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: "spring", stiffness: 180 }} className="p-2 rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-400/30">
            <Bike className="w-6 h-6 text-emerald-300" />
          </motion.div>
          <div>
            <h1 className="text-xl font-semibold tracking-wide">YouBike 需求預測</h1>
            <p className="text-xs text-slate-400">時間 + 天氣 → 借/還車量（Demo）</p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Controls */}
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="lg:col-span-1 space-y-6">
          {/* Station Card */}
          <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-5">
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="w-4 h-4 text-sky-300" />
              <h2 className="font-semibold">站點</h2>
            </div>
            <select
              className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2"
              value={stationId}
              onChange={(e) => setStationId(e.target.value)}
            >
              {stations.map((s) => (
                <option key={s.station_id} value={s.station_id}>
                  {s.station_name}（{s.district}｜柱:{s.docks_total}｜ID:{s.station_id}）
                </option>
              ))}
            </select>
            {selectedStation && (
              <p className="text-xs text-slate-400 mt-2">
                已選：{selectedStation.station_name}（{selectedStation.district}）；柱數 {selectedStation.docks_total}
              </p>
            )}
          </div>

          {/* Time Card */}
          <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Clock3 className="w-4 h-4 text-amber-300" />
              <h2 className="font-semibold">時間</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">日期</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">時間</label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2"
                />
              </div>
            </div>
          </div>

          {/* Weather Card */}
          <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-5">
            <div className="flex items-center gap-2 mb-3">
              <CloudRain className="w-4 h-4 text-cyan-300" />
              <h2 className="font-semibold">天氣</h2>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-3 grid grid-cols-3 gap-2">
                {presets.map((p) => (
                  <button
                    key={p.name}
                    onClick={() => applyPreset(p)}
                    className="text-xs rounded-xl px-3 py-2 bg-white/5 hover:bg-white/10 ring-1 ring-white/10"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
              <div className="col-span-3 h-px bg-white/10 my-1"></div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">降雨量 (mm)</label>
                <input type="number" step="0.1" value={rainMm} onChange={(e)=>setRainMm(e.target.value)} className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2" />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">是否下雨</label>
                <select value={isRain} onChange={(e)=>setIsRain(Number(e.target.value))} className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2">
                  <option value={0}>否</option>
                  <option value={1}>是</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">氣溫 (°C)</label>
                <div className="relative">
                  <Thermometer className="w-3.5 h-3.5 text-rose-300 absolute left-2 top-2.5" />
                  <input type="number" step="0.1" value={tempC} onChange={(e)=>setTempC(e.target.value)} className="w-full pl-8 bg-black/30 border border-white/10 rounded-xl px-3 py-2" />
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <motion.button whileTap={{ scale: 0.98 }} onClick={predictOnce} disabled={loading}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 bg-emerald-500 text-black font-semibold shadow-lg shadow-emerald-500/20 hover:bg-emerald-400">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              即時預測
            </motion.button>
            <motion.button whileTap={{ scale: 0.98 }} onClick={buildIntradaySeries} disabled={chartLoading}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 bg-sky-500 text-black font-semibold shadow-lg shadow-sky-500/20 hover:bg-sky-400">
              {chartLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock3 className="w-4 h-4" />}
              畫一天曲線
            </motion.button>
          </div>
        </motion.section>

        {/* Right: Visualization */}
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="lg:col-span-2 space-y-6">
          {/* KPI Cards */}
          <div className="grid sm:grid-cols-2 gap-4">
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl p-5 bg-gradient-to-br from-emerald-500/20 to-emerald-400/10 ring-1 ring-emerald-400/30">
              <div className="text-sm text-emerald-200/80">預測借車數</div>
              <div className="text-3xl font-bold mt-1">{point ? point.rent_pred?.toFixed?.(2) : "—"}</div>
              <div className="text-xs text-emerald-200/70 mt-2">基於所選時間與天氣</div>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl p-5 bg-gradient-to-br from-cyan-500/20 to-cyan-400/10 ring-1 ring-cyan-400/30">
              <div className="text-sm text-cyan-200/80">預測還車數</div>
              <div className="text-3xl font-bold mt-1">{point ? point.return_pred?.toFixed?.(2) : "—"}</div>
              <div className="text-xs text-cyan-200/70 mt-2">基於所選時間與天氣</div>
            </motion.div>
          </div>

          {/* Line Chart */}
          <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Bike className="w-4 h-4 text-emerald-300" />
                <h2 className="font-semibold">當日曲線</h2>
              </div>
              <div className="text-xs text-slate-400">{date}・相同天氣條件</div>
            </div>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="hour" stroke="rgba(255,255,255,0.5)" tick={{ fontSize: 12 }} />
                  <YAxis stroke="rgba(255,255,255,0.5)" tick={{ fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: "#0b1220", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }} />
                  <Legend wrapperStyle={{ color: "white" }} />
                  <Line type="monotone" dataKey="rent" name="借車" dot={false} strokeWidth={2} />
                  <Line type="monotone" dataKey="ret" name="還車" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {!series?.length && (
              <p className="text-xs text-slate-400 mt-2">點「畫一天曲線」產生 00:00–23:00 的預測線。</p>)
            }
          </div>

          {/* Context Card */}
          <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-5">
            <h3 className="font-semibold mb-2">目前條件</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="p-3 rounded-xl bg-white/5">
                <div className="text-slate-400 text-xs">站點</div>
                <div className="font-medium truncate">{selectedStation?.station_name ?? "—"}</div>
              </div>
              <div className="p-3 rounded-xl bg-white/5">
                <div className="text-slate-400 text-xs">時間</div>
                <div className="font-medium">{date} {time}</div>
              </div>
              <div className="p-3 rounded-xl bg-white/5">
                <div className="text-slate-400 text-xs">降雨量</div>
                <div className="font-medium">{rainMm} mm</div>
              </div>
              <div className="p-3 rounded-xl bg-white/5">
                <div className="text-slate-400 text-xs">氣溫</div>
                <div className="font-medium">{tempC} °C</div>
              </div>
            </div>
          </div>
        </motion.section>
      </main>

      <footer className="max-w-6xl mx-auto px-4 pb-10 text-xs text-slate-500">
        本頁面為展示介面：模型以 9/23 當日資料快速訓練，僅供流程驗證。補齊 9/1–9/22 天氣後可做回推模擬。
      </footer>
    </div>
  );
}