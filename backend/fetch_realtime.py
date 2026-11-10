"""
（選用）把台北市 YouBike 即時資料存進 MySQL，用來累積歷史資料、之後重新訓練模型。

主程式 main.py 不依賴這支腳本；只有想自己收集資料時才需要。
可搭配 Windows 工作排程器或 cron 每 5–10 分鐘執行一次。

資料庫連線資訊從環境變數讀取（不要把密碼寫死在程式裡）：
  YB_DB_HOST（預設 localhost）、YB_DB_USER（預設 root）、YB_DB_PASSWORD、YB_DB_NAME（預設 youbike）

需要額外安裝：pip install requests mysql-connector-python
"""
import os
from datetime import datetime

import requests
import mysql.connector

# 台北市政府開放資料：YouBike 2.0 即時站點資料
URL = "https://tcgbusfs.blob.core.windows.net/dotapp/youbike/v2/youbike_immediate.json"


def parse_mday(s: str) -> datetime:
    """官方時間格式改過：新版 "2026-11-10 20:52:04"，舊版 "20261110205204"，兩種都支援。"""
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y%m%d%H%M%S"):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            pass
    raise ValueError(f"無法解析時間：{s}")


def save_realtime():
    # 1) 下載整份即時資料（約 1,600 個站點）
    r = requests.get(URL, timeout=15)
    r.raise_for_status()
    data = r.json()

    # 2) 連線 MySQL（帳密由環境變數提供）
    conn = mysql.connector.connect(
        host=os.getenv("YB_DB_HOST", "localhost"),
        user=os.getenv("YB_DB_USER", "root"),
        password=os.getenv("YB_DB_PASSWORD", ""),
        database=os.getenv("YB_DB_NAME", "youbike"),
    )
    cursor = conn.cursor()

    # 3) 逐筆寫入；INSERT IGNORE 搭配 (sno, mday) 唯一鍵可避免重複寫入同一時間點的資料
    for row in data:
        cursor.execute("""
            INSERT IGNORE INTO youbike_realtime
            (sno, sarea, sna, quantity, available_rent_bikes,
             available_return_bikes, latitude, longitude, mday)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """, (
            row["sno"], row["sarea"], row["sna"],
            # 官方欄位名稱曾改版（Quantity / quantity / total），全部相容
            row.get("Quantity", row.get("quantity", row.get("total"))),
            row["available_rent_bikes"], row["available_return_bikes"],
            row["latitude"], row["longitude"],
            parse_mday(row["mday"]),
        ))
    conn.commit()
    conn.close()
    print(f"[{datetime.now():%Y-%m-%d %H:%M:%S}] 已寫入 {len(data)} 筆")


if __name__ == "__main__":
    save_realtime()
