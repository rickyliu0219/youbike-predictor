# backend/main.py
"""
YouBike 站點租借／歸還預測 API（FastAPI）

整體流程：
  1. 從台北市 YouBike 2.0 即時 API 取得站點清單與目前車數
  2. 用 RandomForest 模型（依站點、時段、星期、天氣、溫度）預測每小時「借出量」與「歸還量」
  3. 以「目前可借車數」為起點，逐小時推算未來的剩餘車數（考慮車柱容量上下限）
  4. 若模型檔不存在且無法訓練，改用 heuristic（經驗公式）後備，確保 API 永遠有回應

主要路由：
  GET  /health                 健康檢查（模型是否載入）
  GET  /stations               站點清單（預設即時 API，?source=csv 改讀本地檔）
  GET  /realtime/{station_id}  單站即時車數
  GET  /stations/search?q=     站名／站號搜尋
  POST /predict_one            指定時間點的單次預測
  POST /forecast_day           6／12／24 小時預報（含剩餘車數推算）
"""
from __future__ import annotations

from typing import Optional, List, Dict, Tuple

import math
import time
from pathlib import Path
from datetime import datetime, timedelta

import pandas as pd
import joblib

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from zoneinfo import ZoneInfo

from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder
from sklearn.pipeline import Pipeline
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split

import httpx

# -----------------------------
# 常數與路徑
# -----------------------------
TAIPEI = ZoneInfo("Asia/Taipei")

BASE = Path(__file__).resolve().parent.parent  # 專案根（含 backend/ frontend/ data/）
DATA = BASE / "data"
FRONTEND = BASE / "frontend"
DIST = FRONTEND / "dist"

RENT_MODEL_PATH = BASE / "rf_rent_model_quick.pkl"
RETURN_MODEL_PATH = BASE / "rf_return_model_quick.pkl"
STATIONS_CSV = DATA / "stations.csv"

YOUBIKE_TPE_URL = "https://tcgbusfs.blob.core.windows.net/dotapp/youbike/v2/youbike_immediate.json"

# -----------------------------
# FastAPI
# -----------------------------
app = FastAPI(title="YouBike Predictor", version="0.2.0")

# 前端在本機（或經過 cloudflared）走 Vite 代理 /api → 這裡直接放行
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 若你要鎖更緊，可改成具體 domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# 前端一律呼叫 /api/xxx：
#   - 開發模式由 Vite 代理把 /api 拿掉再轉給後端
#   - 「免 Node.js 模式」由後端直接提供 frontend/dist，這裡同樣把 /api 前綴拿掉
# 兩種模式前端程式碼完全相同。
@app.middleware("http")
async def strip_api_prefix(request, call_next):
    path = request.scope["path"]
    if path == "/api" or path.startswith("/api/"):
        request.scope["path"] = path[4:] or "/"
    return await call_next(request)


# 若有打包好的前端（frontend/dist），後端直接提供網頁 → 只裝 Python 就能使用
if DIST.exists():
    app.mount("/assets", StaticFiles(directory=str(DIST / "assets")), name="assets")

    @app.get("/")
    def index():
        return FileResponse(str(DIST / "index.html"))

    @app.get("/vite.svg")
    def favicon():
        return FileResponse(str(DIST / "vite.svg"))
else:
    @app.get("/")
    def index_dev():
        return JSONResponse({
            "msg": "Frontend dev mode. Open http://localhost:5173 . "
                   "After `npm run build`, backend will serve /index here."
        })

# -----------------------------
# 即時 API 讀取與正規化
# -----------------------------
# 即時資料快取：官方 API 約每分鐘更新一次，一次預報請求內會多次讀取站點資訊，
# 快取 30 秒可避免重複下載整份 JSON（約 1,600 站），也降低被官方限流的機會。
_REALTIME_CACHE: Dict[str, object] = {"ts": 0.0, "rows": None}
_REALTIME_TTL_SEC = 30


def _fetch_realtime_rows() -> List[Dict]:
    """
    讀取台北市 YouBike 即時 API 並正規化欄位。
    重要欄位：
      station_id (str), station_name, district, docks_total (int),
      available_rent_bikes (int), available_return_bikes (int),
      lat, lon, update_time
    """
    # 快取未過期 → 直接回傳
    cached = _REALTIME_CACHE["rows"]
    if cached is not None and time.time() - float(_REALTIME_CACHE["ts"]) < _REALTIME_TTL_SEC:
        return cached  # type: ignore[return-value]

    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.get(YOUBIKE_TPE_URL)
            resp.raise_for_status()
            raw = resp.json()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"讀取台北市即時 API 失敗：{type(e).__name__}: {e}")

    rows: List[Dict] = []
    for r in raw:
        # 官方欄位命名（英文鍵）
        sno = str(r.get("sno") or "").strip()
        if not sno:
            continue
        rent_n = int(r.get("available_rent_bikes") or 0)
        ret_n = int(r.get("available_return_bikes") or 0)
        # 車柱總數：官方欄位名稱改過好幾次（Quantity / quantity / total），全部相容；
        # 都沒有時用「可借 + 可還」估算
        docks = int(r.get("Quantity") or r.get("quantity") or r.get("total") or 0) or (rent_n + ret_n)
        rows.append({
            "station_id": sno,
            "station_name": r.get("sna") or "",
            "district": r.get("sarea") or "",
            "docks_total": docks,
            "available_rent_bikes": rent_n,
            "available_return_bikes": ret_n,
            "lat": float(r.get("latitude") or 0.0),
            "lon": float(r.get("longitude") or 0.0),
            "update_time": r.get("updateTime") or r.get("mday") or "",
        })

    # 寫入快取
    _REALTIME_CACHE["rows"] = rows
    _REALTIME_CACHE["ts"] = time.time()
    return rows

# -----------------------------
# 模型載入／訓練（沒有資料時有 Heuristic 後備）
# -----------------------------
def _generate_stations_from_youbike() -> pd.DataFrame:
    """
    從 data/youbike_hourly_sim.csv 產出 stations.csv（給前端下拉回退用）
    """
    yb_path = DATA / "youbike_hourly_sim.csv"
    if not yb_path.exists():
        raise FileNotFoundError(f"找不到 {yb_path}，請確認 data/ 檔案存在")
    yb = pd.read_csv(yb_path, parse_dates=["datetime"])
    cols = ["station_id", "station_name", "district", "docks_total"]
    for c in cols:
        if c not in yb.columns:
            raise ValueError(f"youbike_hourly_sim.csv 缺少欄位：{c}")
    stations = yb[cols].drop_duplicates().sort_values(["district", "station_name"])
    STATIONS_CSV.parent.mkdir(parents=True, exist_ok=True)
    stations.to_csv(STATIONS_CSV, index=False)
    return stations

def train_or_load_models():
    """
    優先載入快取；沒有的話用 data/ 內檔做快速訓練。
    若 data 不齊，回傳 (None, None) 交給 heuristic 後備。
    """
    if RENT_MODEL_PATH.exists() and RETURN_MODEL_PATH.exists():
        try:
            rent_model = joblib.load(RENT_MODEL_PATH)
            return_model = joblib.load(RETURN_MODEL_PATH)
            return rent_model, return_model
        except Exception:
            pass

    try:
        yb = pd.read_csv(DATA / "youbike_hourly_sim.csv", parse_dates=["datetime"])
        # 天氣可選
        rain_path = DATA / "rain.csv"
        temp_path = DATA / "temp.csv"
        if rain_path.exists() and temp_path.exists():
            rain = pd.read_csv(rain_path, parse_dates=["datetime"])
            temp = pd.read_csv(temp_path, parse_dates=["datetime"])
            weather = rain.merge(temp, on="datetime", how="outer")
            df = yb.merge(weather, on="datetime", how="left")
        else:
            df = yb.copy()

        # --- 特徵工程 ---
        # hour：0–23 時；dow：星期（0=週一）；is_peak：通勤尖峰（7–9、17–19 時）
        df["hour"] = df["datetime"].dt.hour
        df["dow"] = df["datetime"].dt.dayofweek
        df["is_peak"] = ((df["hour"].between(7, 9)) | (df["hour"].between(17, 19))).astype(int)

        # 填補天氣欄位
        if "rain_mm" not in df.columns: df["rain_mm"] = 0.0
        if "is_rain" not in df.columns: df["is_rain"] = (df["rain_mm"] > 0).astype(int)
        if "temp_C" not in df.columns: df["temp_C"] = 26.0
        for c in ["rain_mm", "is_rain", "temp_C"]:
            df[c] = pd.to_numeric(df[c], errors="coerce").interpolate().bfill().ffill()

        # 產生 stations.csv（回退用）
        if not STATIONS_CSV.exists():
            _generate_stations_from_youbike()

        features = ["station_id", "district", "docks_total", "hour", "dow", "is_peak", "rain_mm", "is_rain", "temp_C"]
        y_rent = pd.to_numeric(df.get("rent_cnt", 0), errors="coerce").fillna(0)
        y_return = pd.to_numeric(df.get("return_cnt", 0), errors="coerce").fillna(0)

        # 站號、行政區是類別 → One-Hot；其餘數值欄位直接送進模型
        numeric = ["docks_total", "hour", "dow", "is_peak", "rain_mm", "is_rain", "temp_C"]
        categorical = ["station_id", "district"]
        pre = ColumnTransformer([
            ("cat", OneHotEncoder(handle_unknown="ignore"), categorical),
            ("num", "passthrough", numeric),
        ])

        # 「quick」版：資料量大時只抽 20% 訓練，讓第一次啟動在數十秒內完成
        df_sample = df.sample(frac=0.2, random_state=42) if len(df) > 1500 else df.copy()
        Xs = df_sample[features].copy()

        # 借出、歸還各訓練一個 RandomForest 回歸模型；限制深度避免過擬合與模型檔過大
        rf_params = dict(n_estimators=80, random_state=42, n_jobs=-1, max_depth=12, min_samples_leaf=3)
        rent_model = Pipeline([("pre", pre), ("rf", RandomForestRegressor(**rf_params))])
        return_model = Pipeline([("pre", pre), ("rf", RandomForestRegressor(**rf_params))])

        Xtr, Xte, ytr, yte = train_test_split(Xs, y_rent.loc[df_sample.index], test_size=0.2, random_state=42)
        rent_model.fit(Xtr, ytr)
        Xtr2, Xte2, ytr2, yte2 = train_test_split(Xs, y_return.loc[df_sample.index], test_size=0.2, random_state=42)
        return_model.fit(Xtr2, ytr2)

        # 存成 .pkl，下次啟動直接載入、不用重新訓練
        joblib.dump(rent_model, RENT_MODEL_PATH)
        joblib.dump(return_model, RETURN_MODEL_PATH)
        return rent_model, return_model
    except Exception as e:
        print(f"[WARN] 快速訓練失敗，改用 heuristic 後備：{e}")
        return None, None

# 伺服器啟動時就載入（或訓練）模型，之後每次請求共用
RENT_MODEL, RETURN_MODEL = train_or_load_models()

def _predict_counts_once(*, sid: int, district: str, docks_total: int,
                         dt: datetime, rain_mm: float, is_rain: int, temp_c: float) -> Dict[str, float]:
    """
    預測某站在某個整點的「借出量」與「歸還量」（單位：輛／小時）。
    有模型：走 RandomForest 預測
    無模型：走 heuristic（含時段/天氣/溫度）
    """
    hour = dt.hour
    dow = dt.weekday()
    is_peak = 1 if hour in (7, 8, 9, 17, 18, 19) else 0

    if RENT_MODEL is not None and RETURN_MODEL is not None:
        X = pd.DataFrame([{
            "station_id": int(sid),
            "district": district or "",
            "docks_total": int(docks_total or 0),
            "hour": hour,
            "dow": dow,
            "is_peak": is_peak,
            "rain_mm": float(rain_mm),
            "is_rain": int(is_rain),
            "temp_C": float(temp_c),
        }])
        rent_pred = float(RENT_MODEL.predict(X)[0])
        return_pred = float(RETURN_MODEL.predict(X)[0])
        return {"rent": max(0.0, rent_pred), "ret": max(0.0, return_pred)}

    # --- heuristic 後備 ---
    # 基線：容量比例 × 時段形狀
    cap = max(1, int(docks_total or 1))
    # 時段形狀：深夜低、通勤峰高
    if 23 <= hour or hour <= 5:
        shape = 0.05
    elif 7 <= hour <= 9 or 17 <= hour <= 19:
        shape = 0.35
    else:
        shape = 0.15
    base = cap * shape * 0.4  # 對齊尺度

    # 天氣：雨越大越少
    if is_rain and rain_mm > 0:
        rain_k = 0.85 if rain_mm < 2 else max(0.35, math.exp(-0.25 * (rain_mm - 2)))
    else:
        rain_k = 1.0

    # 溫度舒適度
    t = max(0.0, min(50.0, float(temp_c)))
    lo, hi = 20.0, 28.0
    d = (lo - t) if t < lo else (t - hi if t > hi else 0.0)
    temp_k = math.exp(-d / 3.0)
    if t <= 5 or t >= 40:
        temp_k *= 0.35
    temp_k = max(0.05, temp_k)

    # 週末略增
    weekend_k = 1.15 if dow in (5, 6) else 1.0

    rent = base * rain_k * temp_k * weekend_k
    ret = base * 0.9 * rain_k * temp_k * weekend_k
    # 白天給極小保底
    if not (23 <= hour or hour <= 5):
        rent = max(rent, 0.03)
        ret = max(ret, 0.03)
    return {"rent": rent, "ret": ret}

# -----------------------------
# Schemas
# -----------------------------
class PredictIn(BaseModel):
    station_id: int
    dt: datetime
    rain_mm: float = 0.0
    is_rain: int = 0
    temp_c: float = 26.0

class ForecastIn(BaseModel):
    station_id: int
    date: Optional[str] = None          # YYYY-MM-DD（台灣時間）
    rain_mm: float = 0.0
    is_rain: int = 0
    temp_c: float = 26.0
    use_realtime_start: bool = True
    view: Optional[str] = "today"       # "next6" | "next12" | "today" | "tomorrow" | "dayafter"

# -----------------------------
# Routes：健康檢查、站點、即時、搜尋
# -----------------------------
@app.get("/health")
def health():
    return {
        "ok": True,
        "has_models": bool(RENT_MODEL is not None and RETURN_MODEL is not None),
        "data_dir": str(DATA),
        "time": datetime.now(TAIPEI).strftime("%Y-%m-%d %H:%M:%S"),
    }

@app.get("/stations")
def stations(source: Optional[str] = "api"):
    """
    預設用「即時 API」作為站點清單來源；若需要可加 source=csv 回退本地清單。
    """
    try:
        if source == "csv":
            if not STATIONS_CSV.exists():
                _generate_stations_from_youbike()
            df = pd.read_csv(STATIONS_CSV)
            return df.to_dict(orient="records")
        # 即時 API
        rows = _fetch_realtime_rows()
        # 精簡欄位給前端
        out = []
        for r in rows:
            out.append({
                "station_id": r["station_id"],
                "station_name": r["station_name"],
                "district": r["district"],
                "docks_total": r["docks_total"],
                "lat": r["lat"],
                "lon": r["lon"],
            })
        # 排序：行政區、站名
        out.sort(key=lambda x: (x["district"], x["station_name"]))
        return out
    except Exception as e:
        return JSONResponse({"error": f"讀 stations 失敗：{type(e).__name__}: {e}"}, status_code=500)

@app.get("/realtime/{station_id}")
def get_realtime(station_id: str):
    """回傳單一站點的即時資料（可借車數、可還空位、更新時間）。"""
    try:
        rows = _fetch_realtime_rows()
        sid = str(station_id).strip()
        for r in rows:
            if r["station_id"] == sid:
                return r
        sample = [r["station_id"] for r in rows[:6]]
        raise HTTPException(
            status_code=404,
            detail=f"站點 <{sid}> 不在台北市即時清單。請用 /stations 的 station_id，例如：{', '.join(sample)}"
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"realtime error: {type(e).__name__}: {e}")

@app.get("/stations/search")
def stations_search(q: str):
    """用站號或站名關鍵字搜尋（不分大小寫），一併回傳目前車數。"""
    rows = _fetch_realtime_rows()
    ql = (q or "").strip().lower()
    out = []
    for r in rows:
        if (ql in r["station_id"].lower()) or (ql in (r["station_name"] or "").lower()):
            out.append({
                "station_id": r["station_id"],
                "station_name": r["station_name"],
                "district": r["district"],
                "docks_total": r["docks_total"],
                "available_rent_bikes": r["available_rent_bikes"],
                "available_return_bikes": r["available_return_bikes"],
            })
    return out

# -----------------------------
# 單點預測（給除錯/即時計算用）
# -----------------------------
@app.post("/predict_one")
def predict_one(req: PredictIn):
    try:
        # 站點基本資訊（容量/行政區）
        district, cap, _, _ = _get_station_info_with_fallback(req.station_id)
        if cap <= 0:
            raise HTTPException(status_code=400, detail="該站點容量未知或為 0")
        dt_local = req.dt.astimezone(TAIPEI)
        pred = _predict_counts_once(
            sid=int(req.station_id),
            district=district,
            docks_total=cap,
            dt=dt_local,
            rain_mm=req.rain_mm,
            is_rain=req.is_rain,
            temp_c=req.temp_c,
        )
        return {"rent_pred": pred["rent"], "return_pred": pred["ret"]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"predict_one 例外：{type(e).__name__}: {e}")

# -----------------------------
# 輔助：站點資訊（API 優先，容量回退 CSV）
# -----------------------------
def _get_station_info_with_fallback(station_id: int) -> Tuple[str, int, Optional[int], Optional[int]]:
    """
    回傳 (行政區, 車柱總數, 目前可借車數, 目前可還空位)。
    先查即時 API；查不到（或 API 掛掉）時，改從本地 stations.csv 取得行政區與容量，
    此時即時車數為 None，預報就只會給流量、不推算剩餘車數。
    """
    sid_s = str(station_id)
    district, cap, now_remain, now_empty = "", 0, None, None

    # API
    try:
        rows = _fetch_realtime_rows()
        hit = next((r for r in rows if r["station_id"] == sid_s), None)
        if hit:
            district = hit["district"] or ""
            cap = int(hit["docks_total"] or 0)
            now_remain = int(hit["available_rent_bikes"] or 0)
            now_empty = int(hit["available_return_bikes"] or 0)
    except Exception:
        pass

    # 回退 CSV
    if cap <= 0:
        try:
            if not STATIONS_CSV.exists():
                _generate_stations_from_youbike()
            df_s = pd.read_csv(
                STATIONS_CSV,
                dtype={"station_id": "Int64", "station_name": "string",
                       "district": "string", "docks_total": "Int64"},
            )
            df_s["station_id"] = pd.to_numeric(df_s["station_id"], errors="coerce").astype("Int64")
            row = df_s.loc[df_s["station_id"] == int(station_id)]
            if not row.empty:
                r0 = row.iloc[0]
                district = district or str(r0.get("district") or "")
                cap = int(pd.to_numeric(r0.get("docks_total"), errors="coerce") or 0)
        except Exception:
            pass

    return district, int(max(0, cap)), (None if now_remain is None else int(now_remain)), (None if now_empty is None else int(now_empty))

# -----------------------------
# 日內/未來預報：視窗切換 + 即時庫存當起點
# -----------------------------
@app.post("/forecast_day")
def forecast_day(req: ForecastIn):
    """
    view:
      - next6   : 從現在整點起算，往後 6 小時
      - next12  : 從現在整點起算，往後 12 小時
      - today   : 今日 00–23（當前小時之後用即時庫存當起點）
      - tomorrow: 明日 00–23（先橋接到明日 00:00 再開始）
      - dayafter: 後日 00–23（先橋接到後日 00:00 再開始）
    """
    try:
      tz = TAIPEI
      now = datetime.now(tz).replace(minute=0, second=0, microsecond=0)
      today_str = now.strftime("%Y-%m-%d")

      district, cap, now_remain, now_empty = _get_station_info_with_fallback(req.station_id)
      if cap <= 0:
          raise HTTPException(status_code=400, detail="該站點容量未知或為 0，請確認站點 ID")

      # --- 修正係數：在模型輸出上再乘上情境係數，讓曲線對天氣／時段更敏感 ---
      # rain_k：小雨（<2 mm）打 75–85 折；大雨依指數衰減，最低 0.35
      def rain_k(rmm, rflag):
          if not rflag or rmm <= 0: return 1.0
          if rmm < 2: return 0.85 - 0.10 * (rmm / 2)
          return max(0.35, math.exp(-0.25 * (rmm - 2)))
      # temp_k：20–28°C 為舒適區（係數 1），離越遠衰減越多；≤5°C 或 ≥40°C 再大幅打折
      def temp_k(tc):
          t = max(0.0, min(50.0, float(tc)))
          lo, hi = 20.0, 28.0
          d = (lo - t) if t < lo else (t - hi if t > hi else 0.0)
          f = math.exp(-d / 3.0)
          if t <= 5 or t >= 40: f *= 0.35
          return max(0.05, f)
      # tod_k（time of day）：深夜 23–5 時壓低、通勤尖峰拉高
      def tod_k(h):
          if h >= 23 or h <= 5: return 0.12
          if 7 <= h <= 9 or 17 <= h <= 19: return 1.15
          return 1.0
      def weekend_k(dt_local: datetime):
          return 1.15 if dt_local.weekday() in (5, 6) else 1.0

      rk, tk = rain_k(req.rain_mm, req.is_rain), temp_k(req.temp_c)

      view = (req.view or "today").lower()
      if view == "next6":
          start_dt = now
          horizon = 6
          bridge_from_now = True
      elif view == "next12":
          start_dt = now
          horizon = 12
          bridge_from_now = True
      elif view == "today":
          start_dt = datetime.fromisoformat(f"{today_str}T00:00:00").replace(tzinfo=tz)
          horizon = 24
          bridge_from_now = True
      elif view == "tomorrow":
          start_dt = now.replace(hour=0) + timedelta(days=1)
          horizon = 24
          bridge_from_now = True
      elif view == "dayafter":
          start_dt = now.replace(hour=0) + timedelta(days=2)
          horizon = 24
          bridge_from_now = True
      else:
          raise HTTPException(status_code=400, detail=f"未知 view: {view}")

      # 某個整點的「理論流量」= 模型預測 × 各情境係數（尚未考慮車柱容量限制）
      def model_flow_at(dt_local: datetime):
          pred = _predict_counts_once(
              sid=int(req.station_id), district=district, docks_total=cap,
              dt=dt_local, rain_mm=req.rain_mm, is_rain=req.is_rain, temp_c=req.temp_c
          )
          h = dt_local.hour
          k = tod_k(h) * weekend_k(dt_local) * rk * tk
          rent, ret = max(0.0, pred["rent"] * k), max(0.0, pred["ret"] * k)
          if not (h >= 23 or h <= 5):
              floor = 0.03 if req.rain_mm <= 10 else 0.015
              rent, ret = max(rent, floor), max(ret, floor)
          return rent, ret

      def step_inventory(remain: float, rent0: float, ret0: float):
          """
          以「目前剩餘車數」推進一小時，回傳 (實際借出, 實際歸還, 新剩餘車數)。

          物理限制：
            - 借出量不能超過站上現有車數（remain）
            - 歸還量不能超過空車柱數（cap - remain）
          飽和修正：
            - 車數低於容量 30% 時，借出量依比例遞減（車少、大家借不到）
            - 空柱低於容量 30% 時，歸還量依比例遞減（快滿、大家還不進去）
          """
          can_rent = remain
          can_ret = max(0, cap - remain)
          denom = max(1, int(0.30 * cap))
          sat_r = 1.0 if cap == 0 else remain / denom
          sat_f = 1.0 if cap == 0 else (cap - remain) / denom
          rent_adj = min(rent0 * min(1.0, sat_r), can_rent)
          ret_adj = min(ret0 * min(1.0, sat_f), can_ret)
          # 只要還有車／空位，就保留極小的流量，避免曲線卡死在 0 或滿站
          if can_rent > 0: rent_adj = max(rent_adj, min(0.02, can_rent))
          if can_ret > 0: ret_adj = max(ret_adj, min(0.02, can_ret))
          new_remain = max(0, min(cap, remain - rent_adj + ret_adj))
          return rent_adj, ret_adj, new_remain

      # 橋接：視窗起點若在未來（例如明天 00:00），先從「現在的即時車數」逐小時推算到起點
      remain_start = None
      if bridge_from_now and req.use_realtime_start and now_remain is not None:
          remain = max(0, min(cap, now_remain))
          dt_ptr = now
          while dt_ptr < start_dt:
              rent0, ret0 = model_flow_at(dt_ptr)
              _, _, remain = step_inventory(remain, rent0, ret0)
              dt_ptr = dt_ptr + timedelta(hours=1)
          remain_start = remain

      # 產生視窗內每小時的序列
      out_rows, remain_series = [], []
      dt = start_dt
      remain_known = remain_start is not None   # 拿不到即時車數時，只回傳流量、不推算剩餘車數
      remain = remain_start if remain_known else None

      for _ in range(horizon):
          rent0, ret0 = model_flow_at(dt)
          label = dt.strftime("%m/%d %H:00")

          if remain_known:
              rent_adj, ret_adj, remain = step_inventory(remain, rent0, ret0)
              remain_series.append(remain)
              out_rows.append({ "hour": label, "rent": rent_adj, "ret": ret_adj })
          else:
              remain_series.append(None)
              out_rows.append({ "hour": label, "rent": rent0, "ret": ret0 })

          dt = dt + timedelta(hours=1)

      return {
          "station_id": str(req.station_id),
          "district": district,
          "docks_total": cap,
          "view": view,
          "start": start_dt.strftime("%Y-%m-%d %H:%M:%S"),
          "horizon": horizon,
          "now_remain_bikes": (None if now_remain is None else int(now_remain)),
          "use_realtime_start": bool(req.use_realtime_start),
          "hours": out_rows,
          "remain_bikes": remain_series
      }
    except HTTPException:
      raise
    except Exception as e:
      raise HTTPException(status_code=500, detail=f"forecast_day 例外：{type(e).__name__}: {e}")
