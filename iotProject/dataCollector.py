import serial
import serial.tools.list_ports
import requests
import random, time

ports = serial.tools.list_ports.comports()

print("=== Available COM Ports ===")
for port in ports:
    print(f"Port: {port.device}")
    print(f"Description: {port.description}")
    print(f"HWID: {port.hwid}")
    print("---------------------------")

flag = False
# config COM port
while(1):
    time.sleep(0.1)
    portName = input("Enter the port name:")
    if portName == "test":
        flag = True
        break
    try:
        # config COM port section
        ser = serial.Serial(
            port=portName,
            baudrate=115200,
            parity=serial.PARITY_NONE,
            stopbits=serial.STOPBITS_ONE,
            bytesize=serial.EIGHTBITS,
            timeout=0
        )
        break
    except:
        # Disconnected or port name Invaild
        print("Invaild Value")


NORMAL_INTERVAL = 1  # 정상 데이터 수신 시 60초 후 재시도
ERROR_INTERVAL = 1    # 에러/OnRxError 발생 시 1초 후 재시도

next_sleep = 1  # 최초 대기 (기존 로직 유지)

while True:
    time.sleep(next_sleep)
    # 기본적으로 정상 인터벌로 설정, 이후 상황에 따라 1초로 단축
    next_sleep = NORMAL_INTERVAL

    if flag:
        try:
            data = {'value': random.random()*100}
            resp = requests.post("http://localhost:8000/sensor/setTemp", data)
            print(resp.json())
        except Exception as e:
            print(f"Could not connect Web Server: {e}")
            next_sleep = ERROR_INTERVAL
        continue

    try:
        if not ser.readable():
            # 포트에서 읽을 수 없으면 재시도 간격은 기존 정상 간격 유지
            continue

        smo = ser.readline()
        raw_data = smo.decode(errors='ignore').strip()
        if not raw_data:
            continue

        print(f"📥 [RAW]: {raw_data}")

        # 에러 패턴 감지 (OnRxError 문자열 포함 시 에러 인터벌 적용)
        if 'OnRxError' in raw_data or 'OnRxTimeout' in raw_data:
            print("⚠️ OnRxError/Timeout detected -> fast retry (1s)")
            next_sleep = ERROR_INTERVAL
            continue

        # 새로운 포맷: "T:23 H:5 D:0 R:0 L:2124"
        # 최소한 하나의 센서 데이터가 있는지 확인 (콜론 포함)
        if ':' not in raw_data:
            print("⚠️ Unexpected format (no sensor data) -> fast retry")
            next_sleep = ERROR_INTERVAL
            continue

        # 전체 raw_data를 파싱 대상으로 사용
        data_part = raw_data.strip()
        print(f"📊 [DATA PART]: {data_part}")

        values = {}
        for item in data_part.split():
            if ':' in item:
                key, val = item.split(':', 1)
                try:
                    num_val = float(val)
                    if key in ('WDIR', 'BDIR'):
                        values[key] = int(num_val)
                    else:
                        values[key] = num_val
                except ValueError:
                    print(f"❌ Value conversion error for {item} -> fast retry")
                    next_sleep = ERROR_INTERVAL
                    values.clear()
                    break

        if not values:
            continue

        print(f"✅ [PARSED]: {values}")

        sensor_mapping = {
            'T': ('Temp', 'setTemp'),
            'H': ('Humi', 'setHumi'),
            'D': ('Dust', 'setDust'),
            'R': ('Rain', 'setRain'),
            'L': ('Light', 'setLight'),
            'DIR': ('WDir', 'setWDir'),
            'WDIR': ('WDir', 'setWDir'),
            'BDIR': ('BDir', 'setBDir'),
        }

        for key, value in values.items():
            if key in sensor_mapping:
                sensor_name, api_endpoint = sensor_mapping[key]
                data = {'value': value}
                try:
                    response = requests.post(f"http://localhost:8000/sensor/{api_endpoint}", data=data, timeout=5)
                    # if response.status_code != 200:
                    #     print(f"❌ [{sensor_name}] HTTP {response.status_code} -> fast retry")
                    #     next_sleep = ERROR_INTERVAL
                    # else:
                        # print(f"✅ [{sensor_name}] {value} -> {response.json()}")
                except Exception as e:
                    print(f"❌ [{sensor_name}] Server error: {e} -> fast retry")
                    next_sleep = ERROR_INTERVAL

        command_payload = 'ACK'
        try:
            cmd_resp = requests.get("http://localhost:8000/sensor/getNextCommand", timeout=5)
            payload = cmd_resp.json()
            command_payload = payload.get('command', 'ACK')
        except Exception as cmd_err:
            print(f"❌ [CMD] Fetch error: {cmd_err} -> default ACK")
            command_payload = 'ACK'

        if command_payload not in ('OPEN', 'CLOSE', 'UP', 'DOWN'):
            command_payload = 'ACK'

        try:
            message = (command_payload + "\n").encode('utf-8')
            if flag:
                print(f"🚧 [TEST MODE] Would send: {command_payload}")
            else:
                ser.write(message)
                ser.flush()
                print(f"📤 [CMD SENT] {command_payload}")
        except Exception as write_err:
            print(f"❌ [SERIAL WRITE] {write_err} -> fast retry")
            next_sleep = ERROR_INTERVAL

        # 여기까지 에러 없으면 next_sleep 이미 NORMAL_INTERVAL (60s)
        print(f"⏱ Next read in {next_sleep} seconds")

    except Exception as outer_e:
        print(f"❌ [LOOP ERROR] {outer_e} -> fast retry")
        next_sleep = ERROR_INTERVAL
