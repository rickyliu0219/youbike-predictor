// src/components/StationPicker.jsx
// =============================================================
// 站點選擇器（取代瀏覽器原生 <select>，讓下拉清單也能套用主題配色）
//
// - 觸發鈕：顯示目前站名與行政區，旁邊是 ★ 常用按鈕
// - 展開面板：搜尋框（自動聚焦）＋ 行政區晶片 ＋ 站點清單
//   * 常用站點置頂、站名去掉 "YouBike2.0_" 前綴比較好讀
//   * 鍵盤：↑↓ 移動、Enter 選擇、Esc 關閉；點面板外自動關閉
//   * 清單最多一次渲染 200 筆，輸入關鍵字即可縮小範圍
// =============================================================
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Search, Star, MapPin } from "lucide-react";

const MAX_ROWS = 200;
import { shortName } from "../utils";

export default function StationPicker({ isDark, stations, value, onChange, favorites, onToggleFav }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [district, setDistrict] = useState("全部");
  const [cursor, setCursor] = useState(0);
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const t = isDark
    ? { card: "yd-card", input: "yd-input", soft: "yd-soft", sub: "yd-sub", accent: "yd-accent", border: "yd-border" }
    : { card: "yl-card", input: "yl-input", soft: "yl-soft", sub: "yl-sub", accent: "yl-accent", border: "yl-border" };
  const accentVar = isDark ? "var(--d-accent)" : "var(--l-accent)";

  const favSet = useMemo(() => new Set(favorites.map(String)), [favorites]);
  const selected = stations.find((s) => String(s.station_id) === String(value));
  const isFav = selected && favSet.has(String(selected.station_id));

  const districts = useMemo(
    () => ["全部", ...Array.from(new Set(stations.map((s) => s.district).filter(Boolean))).sort()],
    [stations]
  );

  // 篩選 + 常用置頂
  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const hit = stations.filter((s) =>
      (district === "全部" || s.district === district) &&
      (!ql || shortName(s.station_name).toLowerCase().includes(ql) || String(s.station_id).includes(ql))
    );
    const fav = hit.filter((s) => favSet.has(String(s.station_id)));
    const rest = hit.filter((s) => !favSet.has(String(s.station_id)));
    return [...fav, ...rest];
  }, [stations, q, district, favSet]);
  const shown = rows.slice(0, MAX_ROWS);

  // 點外面關閉
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // 打開時聚焦搜尋框，游標移到目前選取的站
  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const idx = shown.findIndex((s) => String(s.station_id) === String(value));
    setCursor(idx >= 0 ? idx : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // 游標變動時捲動到可見範圍
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${cursor}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [cursor, open]);

  // ---- 行政區晶片列的捲動 ----
  // 桌機滑鼠滾輪只會垂直捲動，這裡把垂直滾動轉成水平；也支援按住拖曳與左右箭頭
  const chipsRef = useRef(null);
  const dragged = useRef(false);
  const [chipEdge, setChipEdge] = useState({ left: false, right: false });
  const fadeBg = isDark ? "var(--d-card)" : "var(--l-card)";
  const updateChipEdge = () => {
    const el = chipsRef.current; if (!el) return;
    setChipEdge({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  };
  useEffect(() => { if (open) requestAnimationFrame(updateChipEdge); }, [open, districts.length]);
  // React 的 onWheel 是被動監聽，無法 preventDefault，所以這裡另外綁原生事件
  useEffect(() => {
    const el = chipsRef.current; if (!el) return;
    const onWheel = (e) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;   // 觸控板本來就能橫向滑
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [open]);
  const scrollChips = (dir) => chipsRef.current?.scrollBy({ left: dir * 160, behavior: "smooth" });
  const onChipsDown = (e) => {
    if (e.pointerType !== "mouse") return;                    // 觸控本來就能滑
    const el = chipsRef.current, startX = e.clientX, startLeft = el.scrollLeft;
    dragged.current = false;
    const move = (ev) => {
      const dx = ev.clientX - startX;
      if (Math.abs(dx) > 4) dragged.current = true;
      el.scrollLeft = startLeft - dx;
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setTimeout(() => { dragged.current = false; }, 0);      // 拖曳結束後的那次 click 不算選取
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const pick = (s) => { onChange(String(s.station_id)); setOpen(false); setQ(""); };

  const onKey = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(shown.length - 1, c + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(0, c - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); if (shown[cursor]) pick(shown[cursor]); }
    else if (e.key === "Escape") { setOpen(false); }
  };

  return (
    <div ref={rootRef} className="relative">
      <div className="flex gap-2 items-stretch">
        {/* 觸發鈕 */}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
          className={`neu-press flex-1 min-w-0 flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left ${t.input}`}
        >
          <MapPin className={`w-4 h-4 shrink-0 ${t.accent}`} />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold truncate">{selected ? shortName(selected.station_name) : "載入站點中…"}</span>
            <span className={`block text-[11px] ${t.sub}`}>{selected?.district || "—"}</span>
          </span>
          <ChevronDown className={`w-4 h-4 shrink-0 transition-transform duration-300 ${open ? "rotate-180" : ""} ${t.sub}`} />
        </button>
        {/* ★ 常用 */}
        <button
          type="button"
          onClick={() => selected && onToggleFav(selected.station_id)}
          title={isFav ? "從常用移除" : "加入常用"}
          className={`neu-press shrink-0 w-11 rounded-xl border flex items-center justify-center ${t.soft} ${t.border}`}
        >
          <Star className="w-4 h-4 transition-transform duration-200" strokeWidth={2}
            style={{ color: isFav ? accentVar : undefined, fill: isFav ? accentVar : "none" }} />
        </button>
      </div>

      {/* 展開面板 */}
      {open && (
        <div
          className={`yb-pop-panel absolute left-0 right-0 mt-2 z-40 rounded-2xl border shadow-2xl overflow-hidden ${t.card}`}
          role="listbox"
          onKeyDown={onKey}
        >
          {/* 搜尋 */}
          <div className="p-3 pb-2">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${t.input}`}>
              <Search className={`w-4 h-4 ${t.sub}`} />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => { setQ(e.target.value); setCursor(0); }}
                placeholder="搜尋站名或站號"
                className="flex-1 bg-transparent outline-none text-sm placeholder:opacity-50"
              />
              <span className={`shrink-0 whitespace-nowrap text-[10px] ${t.sub}`}>{rows.length} 站</span>
            </div>
          </div>

          {/* 行政區晶片（橫向捲動）：滑鼠滾輪／拖曳／左右箭頭都能捲 */}
          <div className="relative">
          <button type="button" aria-label="往左捲動" onClick={() => scrollChips(-1)}
            className={`yb-chip-arrow left-0 ${chipEdge.left ? "opacity-100" : "opacity-0 pointer-events-none"}`}
            style={{ background: `linear-gradient(90deg, ${fadeBg} 55%, transparent)` }}>
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button type="button" aria-label="往右捲動" onClick={() => scrollChips(1)}
            className={`yb-chip-arrow right-0 justify-end ${chipEdge.right ? "opacity-100" : "opacity-0 pointer-events-none"}`}
            style={{ background: `linear-gradient(270deg, ${fadeBg} 55%, transparent)` }}>
            <ChevronRight className="w-4 h-4" />
          </button>
          <div ref={chipsRef} onScroll={updateChipEdge} onPointerDown={onChipsDown}
            className="yb-chips flex gap-1.5 px-3 pb-2 overflow-x-auto cursor-grab active:cursor-grabbing">
            {districts.map((d) => {
              const on = d === district;
              return (
                <button key={d} type="button" onClick={() => { if (dragged.current) return; setDistrict(d); setCursor(0); }}
                  className={`neu-press shrink-0 px-2.5 py-1 rounded-full text-[11px] border ${on ? "font-bold" : t.sub} ${t.border}`}
                  style={on ? { background: accentVar, color: isDark ? "#1a1714" : "#ffffff", borderColor: "transparent" } : undefined}>
                  {d}
                </button>
              );
            })}
          </div>
          </div>

          {/* 清單 */}
          <div ref={listRef} className={`yb-scroll max-h-72 overflow-y-auto border-t ${t.border}`}>
            {shown.length === 0 && <div className={`px-4 py-6 text-center text-xs ${t.sub}`}>找不到符合的站點</div>}
            {shown.map((s, i) => {
              const active = String(s.station_id) === String(value);
              const fav = favSet.has(String(s.station_id));
              return (
                <div
                  key={s.station_id}
                  data-idx={i}
                  role="option"
                  aria-selected={active}
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => pick(s)}
                  className={`yb-row flex items-center gap-2 px-4 py-2 cursor-pointer text-sm ${i === cursor ? t.soft : ""}`}
                  style={active ? { boxShadow: `inset 3px 0 0 ${accentVar}` } : undefined}
                >
                  <span className={`flex-1 truncate ${active ? "font-bold" : ""}`}>{shortName(s.station_name)}</span>
                  {fav && <Star className="w-3 h-3 shrink-0" style={{ color: accentVar, fill: accentVar }} />}
                  <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-md ${t.soft} ${t.sub}`}>{s.district}</span>
                </div>
              );
            })}
            {rows.length > MAX_ROWS && (
              <div className={`px-4 py-2 text-center text-[11px] ${t.sub}`}>還有 {rows.length - MAX_ROWS} 站，輸入關鍵字或選行政區縮小範圍</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
