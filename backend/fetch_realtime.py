import requests
import mysql.connector
from datetime import datetime

URL = "https://tcgbusfs.blob.core.windows.net/dotapp/youbike/v2/youbike_immediate.json"

def save_realtime():
    r = requests.get(URL)
    data = r.json()

    conn = mysql.connector.connect(
        host="localhost", user="root", password="yourpassword", database="youbike"
    )
    cursor = conn.cursor()

    for row in data:
        cursor.execute("""
            INSERT IGNORE INTO youbike_realtime
            (sno, sarea, sna, quantity, available_rent_bikes,
             available_return_bikes, latitude, longitude, mday)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """, (
            row["sno"], row["sarea"], row["sna"], row["total"], 
            row["available_rent_bikes"], row["available_return_bikes"],
            row["latitude"], row["longitude"],
            datetime.strptime(row["mday"], "%Y%m%d%H%M%S")
        ))
    conn.commit()
    conn.close()

if __name__ == "__main__":
    save_realtime()
