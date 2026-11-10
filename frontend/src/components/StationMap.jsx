// src/components/StationMap.jsx
// =============================================================
// 站點地圖卡片（Leaflet + Esri Canvas 灰階底圖，免 API 金鑰）
//
// - 選定站點以主題色大頭針標示；周邊 800 m 內其他站點以小圓點顯示，點一下即可切換站點
// - 底圖用 Esri「Light / Dark Gray Canvas」：只有道路、水域與街名，沒有商家和 POI 圖示，畫面乾淨
//   底圖與街名是兩層，依日／夜模式切換，再用 CSS 濾鏡微調成貼近主題的色調
// - 「一鍵導航」：開啟 Google 地圖步行路線（手機上會直接跳 Google Maps App）
// - 「放大」：全螢幕檢視，Esc 或點背景關閉
// =============================================================
import React, { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, CircleMarker, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Navigation, Maximize2, X, ExternalLink, Map as MapIcon } from "lucide-react";
import { shortName } from "../utils";

const NEARBY_M = 800;    // 周邊站點半徑（公尺）

// 兩點距離（公尺），Haversine 公式
function distM(a, b) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// 主題色大頭針（divIcon：純 HTML/SVG，不需圖片檔）
const pinIcon = (color) => L.divIcon({
  className: "yb-pin",
  iconSize: [34, 44],
  iconAnchor: [17, 42],
  html: `
    <svg viewBox="0 0 34 44" width="34" height="44">
      <path d="M17 43C17 43 3 27 3 16a14 14 0 1 1 28 0c0 11-14 27-14 27z" fill="${color}" stroke="#fff" stroke-width="2.5"/>
      <circle cx="17" cy="16" r="7.5" fill="none" stroke="#fff" stroke-width="2"/>
      <g stroke="#fff" stroke-width="1.2"><line x1="17" y1="9" x2="17" y2="23"/><line x1="10" y1="16" x2="24" y2="16"/></g>
    </svg>`,
});

// 站點改變時平滑移動鏡頭
function FlyTo({ center }) {
  const map = useMap();
  useEffect(() => { map.flyTo(center, map.getZoom(), { duration: 0.6 }); }, [center[0], center[1]]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function TheMap({ isDark, center, accent, nearby, onSelect, zoom = 16, interactive = true }) {
  const tone = isDark ? "Dark" : "Light";
  const esri = (layer) => `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_${tone}_Gray_${layer}/MapServer/tile/{z}/{y}/{x}`;
  // 主題 class 放在外層 div：MapContainer 掛載後不會再更新 className，切換日夜時才會生效
  return (
    <div className={`h-full w-full ${isDark ? "yb-map-dark" : "yb-map-light"}`}>
    <MapContainer
      center={center} zoom={zoom} scrollWheelZoom={interactive} zoomControl={interactive}
      attributionControl className="h-full w-full"
    >
      {/* key 隨日夜改變 → 切換主題時重新載入對應的圖磚 */}
      <TileLayer key={`base-${tone}`} url={esri("Base")} maxNativeZoom={16} maxZoom={19}
        attribution="Tiles &copy; Esri" />
      <TileLayer key={`ref-${tone}`} url={esri("Reference")} maxNativeZoom={16} maxZoom={19} />
      <FlyTo center={center} />
      {nearby.map((s) => (
        <CircleMarker key={s.station_id} center={[s.lat, s.lon]} radius={7}
          pathOptions={{ color: "#fff", weight: 2.5, fillColor: accent, fillOpacity: 0.9 }}
          eventHandlers={{ click: () => onSelect(String(s.station_id)) }}>
          <Tooltip direction="top" offset={[0, -6]}>{shortName(s.station_name)}・{Math.round(s.dist)} m</Tooltip>
        </CircleMarker>
      ))}
      <Marker position={center} icon={pinIcon(accent)} zIndexOffset={1000} />
    </MapContainer>
    </div>
  );
}

export default function StationMap({ isDark, station, stations, onSelect, accent }) {
  const [full, setFull] = useState(false);
  const t = isDark
    ? { card: "yd-card", soft: "yd-soft", sub: "yd-sub", accent: "yd-accent", border: "yd-border" }
    : { card: "yl-card", soft: "yl-soft", sub: "yl-sub", accent: "yl-accent", border: "yl-border" };

  const lat = Number(station?.lat), lon = Number(station?.lon);
  const hasPos = Number.isFinite(lat) && Number.isFinite(lon) && lat !== 0 && lon !== 0;
  const center = useMemo(() => [lat, lon], [lat, lon]);

  // 周邊站點（依距離排序）
  const nearby = useMemo(() => {
    if (!hasPos) return [];
    const me = { lat, lon };
    return stations
      .filter((s) => String(s.station_id) !== String(station.station_id) && Number(s.lat) && Number(s.lon))
      .map((s) => ({ ...s, dist: distM(me, { lat: Number(s.lat), lon: Number(s.lon) }) }))
      .filter((s) => s.dist <= NEARBY_M)
      .sort((a, b) => a.dist - b.dist);
  }, [hasPos, lat, lon, stations, station]);

  // Esc 關閉全螢幕
  useEffect(() => {
    if (!full) return;
    const k = (e) => e.key === "Escape" && setFull(false);
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [full]);

  const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=walking`;
  const viewUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
  const textOnAccent = isDark ? "#1a1714" : "#ffffff";

  return (
    <div className={`${t.card} border rounded-2xl p-5 shadow-xl`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <MapIcon className={`w-5 h-5 ${t.accent}`} />
          <h3 className="font-bold text-sm">站點位置</h3>
        </div>
        {hasPos && (
          <button type="button" onClick={() => setFull(true)} title="放大地圖"
            className={`neu-press w-8 h-8 rounded-lg border flex items-center justify-center ${t.soft} ${t.border}`}>
            <Maximize2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {hasPos ? (
        <>
          {/* 小地圖：點一下也會放大 */}
          <div className={`relative h-52 rounded-xl overflow-hidden border ${t.border}`}>
            <TheMap isDark={isDark} center={center} accent={accent} nearby={nearby} onSelect={onSelect} interactive={false} />
            <button type="button" onClick={() => setFull(true)} aria-label="放大地圖"
              className="absolute inset-0 z-[500] cursor-zoom-in" />
          </div>

          {station.address && <div className={`mt-3 text-xs ${t.sub}`}>{station.address}</div>}
          <div className={`mt-1 text-[11px] ${t.sub}`}>周邊 {NEARBY_M} m 內還有 {nearby.length} 個站點（放大後可點選切換）</div>

          {/* 一鍵導航 */}
          <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
            <a href={navUrl} target="_blank" rel="noopener noreferrer"
              className="neu-press flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold"
              style={{ background: accent, color: textOnAccent }}>
              <Navigation className="w-4 h-4" /> 一鍵導航
            </a>
            <a href={viewUrl} target="_blank" rel="noopener noreferrer" title="在 Google 地圖開啟"
              className={`neu-press flex items-center justify-center px-3 rounded-xl border ${t.soft} ${t.border}`}>
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </>
      ) : (
        <div className={`h-32 rounded-xl flex items-center justify-center text-xs ${t.soft} ${t.sub}`}>
          此站點沒有座標資料（即時 API 未連線）
        </div>
      )}

      {/* 全螢幕地圖 */}
      {full && hasPos && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 sm:p-10 bg-black/45 backdrop-blur-sm yb-fade"
             onClick={() => setFull(false)}>
          <div className={`yb-pop-panel relative w-full max-w-5xl h-[80vh] rounded-2xl overflow-hidden border shadow-2xl ${t.card}`}
               onClick={(e) => e.stopPropagation()}>
            <TheMap isDark={isDark} center={center} accent={accent} nearby={nearby} onSelect={onSelect} zoom={17} />
            {/* 浮動資訊列 */}
            <div className={`absolute left-4 right-4 bottom-4 z-[1000] flex flex-wrap items-center gap-3 p-3 rounded-2xl border shadow-xl ${t.card}`}>
              <div className="flex-1 min-w-[180px]">
                <div className="font-bold text-sm">{shortName(station.station_name)}</div>
                <div className={`text-xs ${t.sub}`}>{station.district}{station.address ? `・${station.address}` : ""}</div>
              </div>
              <a href={navUrl} target="_blank" rel="noopener noreferrer"
                className="neu-press flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold"
                style={{ background: accent, color: textOnAccent }}>
                <Navigation className="w-4 h-4" /> 一鍵導航
              </a>
            </div>
            <button type="button" onClick={() => setFull(false)} aria-label="關閉"
              className="neu-round absolute top-4 right-4 z-[1000] w-10 h-10 rounded-full flex items-center justify-center">
              <X className="w-5 h-5" style={{ color: "#6b7280" }} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
