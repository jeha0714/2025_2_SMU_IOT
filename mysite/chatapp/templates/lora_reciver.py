import serial
import time
import pyttsx3

# ---------------------------
# 1. LoRa 시리얼 설정
# ---------------------------
port = "COM3"      # ★ 네 환경에 맞게 변경 (예: COM4, COM5 등)
baud = 115200

ser = serial.Serial(port, baud, timeout=1)
print("🔵 LoRa 데이터 수신 시작...")

# ---------------------------
# 2. 음성 엔진 설정
# ---------------------------
engine = pyttsx3.init()

def speak(text):
    engine.say(text)
    engine.runAndWait()

# ---------------------------
# 3. 데이터 수신 루프
# ---------------------------
while True:
    try:
        if ser.in_waiting > 0:
            data = ser.readline().decode(errors="ignore").strip()
            if data:
                print("📥 받은 데이터:", data)

                # 음성 출력
                speak(data)

        time.sleep(0.1)

    except KeyboardInterrupt:
        print("⛔ 종료됨")
        break
    except Exception as e:
        print("⚠ 오류:", e)
