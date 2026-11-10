<div align="center">

**繁體中文** | [English](README.en.md)

# YouBike Predictor

**台北市 YouBike 2.0 站點借還車量預測系統**

<img src="docs/screenshot-light.png" width="100%" alt="日間模式（北歐・拉普蘭主題）">

<img src="docs/screenshot-dark.png" width="100%" alt="夜間模式（暖炭・倫敦主題）">
</div>

---

## 專案簡介

騎 YouBike 最怕到了站卻「沒車可借」或「沒位可還」。本系統串接**台北市政府 YouBike 2.0 即時開放資料**，以 **RandomForest** 模型（站點、時段、星期、降雨、氣溫）預測全市約 1,600 個站點的**每小時借出量與歸還量**，再以**目前即時車數為起點逐小時推算剩餘車數**，讓使用者提前知道哪個時段可能缺車或滿站。

## 功能

- 即時可借車數、可停車格、總容量
- 今日、明日、後日逐小時預測
- 時間軸滑桿：天空面板隨時段變色，顯示該小時預測值
- 依車柱容量上下限推算剩餘車數
- 天氣情境模擬（晴天／陰天／霧天／雨天／大雨＋溫度、降雨滑桿）
- 缺車／滿車風險等級
- 相較機車、汽車的 CO₂ 減量估算
- 常用站點（存在瀏覽器）
- 日間（北歐・拉普蘭雪國）／夜間（暖炭・倫敦夜景）主題與動畫場景
- 主題化站點選單：搜尋、行政區篩選、常用置頂、鍵盤操作
- 站點地圖、周邊站點、一鍵 Google 地圖導航
- API 或模型不可用時，自動改用本地資料／經驗公式

## 系統架構

<img src="docs/architecture.png" width="100%" alt="系統架構">

### 預測流程

1. **模型流量**：以 RandomForest 預測每個整點的借出與歸還量，特徵為 `station_id, district, docks_total, hour, weekday, is_peak, rain_mm, is_rain, temp_C`。
2. **情境係數**：再乘上降雨、溫度舒適度（20–28 °C）、時段、週末係數。
3. **剩餘車數推算**：以即時車數為起點逐小時推進；借出不超過現有車數、歸還不超過空位，車數或空位低於容量 30% 時流量遞減。

## 快速開始（Windows）

只需要 **Python 3.10 以上**；打包好的網頁（`frontend/dist`）由後端直接提供，不必安裝 Node.js。

```bat
:: 1. 第一次安裝：建立 venv 並安裝套件
setup.bat

:: 2. 啟動，會自動開啟瀏覽器
start.bat

:: 3. 關閉所有服務
stop.bat
```

| 服務 | 網址 |
|---|---|
| 網頁 | http://127.0.0.1:8000 |
| 後端 API 文件（Swagger） | http://127.0.0.1:8000/docs |

**前端開發**：若有安裝 Node.js 18+，`setup.bat` 會一併安裝前端套件，`start.bat` 會改開 Vite 熱更新（http://localhost:5173）；修改前端後在 `frontend/` 執行 `npm run build` 更新 `dist/`。

若有安裝 [`cloudflared`](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)，`start.bat` 會另外開一個臨時外網網址，方便現場展示。

<details>
<summary>macOS / Linux（手動啟動）</summary>

```bash
python3 -m venv venv && source venv/bin/activate
pip install -r backend/requirements.txt
cd backend && uvicorn main:app --port 8000        # → http://127.0.0.1:8000
```
</details>

## API

| 方法 | 路徑 | 說明 |
|---|---|---|
| GET | `/health` | 健康檢查（模型是否載入） |
| GET | `/stations?source=api\|csv` | 站點清單 |
| GET | `/realtime/{station_id}` | 單站即時資料 |
| GET | `/stations/search?q=` | 站名／站號搜尋 |
| POST | `/predict_one` | 單一時間點預測 |
| POST | `/forecast_day` | 視窗預報＋剩餘車數 |

設定環境變數 `YOUBIKE_URL` 可改讀本機的即時資料快照（離線展示用）。

```bash
curl -X POST http://127.0.0.1:8000/forecast_day \
  -H "Content-Type: application/json" \
  -d '{"station_id": 500101001, "view": "next6", "rain_mm": 0, "temp_c": 26}'
```

## 專案結構

```
youbike-predictor/
├── backend/
│   ├── main.py              # FastAPI：即時資料、模型、預報邏輯
│   ├── fetch_realtime.py    # （選用）把即時資料存進 MySQL
│   └── requirements.txt
├── frontend/                # React 19 + Vite + Tailwind 4 + Recharts
│   ├── src/App.jsx          # 主畫面
│   └── dist/                # 打包好的網頁，由後端提供
├── data/
│   ├── stations.csv         # 站點清單（後備）
│   ├── youbike_hourly_sim.csv   # 逐時訓練資料（模擬）
│   ├── rain.csv / temp.csv  # 逐時天氣特徵
├── rf_rent_model_quick.pkl  # 借出量模型
├── rf_return_model_quick.pkl# 歸還量模型
├── setup.bat / start.bat / stop.bat
└── docs/                    # 截圖與架構圖
```

## 限制與未來改進

- 目前內附的訓練資料為**單日的模擬逐時資料**，可學到時段與站點差異，但無法反映長期季節性；可用 `fetch_realtime.py` 累積真實資料後重新訓練。
- 天氣目前由使用者輸入，尚未串接中央氣象署 API。
- 目前僅支援台北市站點（新北市使用不同的 API）。

## 作者

**劉禹寬**：國立聯合大學 電子工程學系
