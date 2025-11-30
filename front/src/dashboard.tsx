import { useState, useEffect, useMemo, useRef } from "react";
import axios from "axios";
import {
  Wind,
  Droplets,
  Sun,
  AlertTriangle,
  ThermometerSun,
  Activity,
  Mic,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import "./dashboard.css"; // CSS 파일 임포트

type RainDrop = {
  id: number;
  left: number;
  delay: number;
  duration: number;
  top: number;
  height: number;
};

type SensorRow = {
  id: number;
  value: number;
  reg_date: string;
};

type SensorData = {
  dust: number;
  rain: boolean;
  temperature: number;
  humidity: number;
  lightLevel: "상" | "중" | "하";
  timestamp: string;
};

type EffectKey = "highDust" | "highTemp" | "highHumidity" | "strongLight";
type EnvironmentEffects = Record<EffectKey, boolean>;
type VoiceStatus = "idle" | "listening" | "thinking" | "speaking" | "error";
type RecognitionResultAlternative = {
  transcript: string;
};

type RecognitionResultList = {
  [index: number]: RecognitionResultAlternative;
  length: number;
  item?: (index: number) => RecognitionResultAlternative;
};

type RecognitionResultEvent = {
  results: {
    [index: number]: RecognitionResultList;
    length: number;
    item?: (index: number) => RecognitionResultList;
  };
};

type RecognitionErrorEvent = {
  error?: string;
  message?: string;
};

type RecognitionLike = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort?: () => void;
  onresult: ((event: RecognitionResultEvent) => void) | null;
  onerror: ((event: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => RecognitionLike;

const pseudoRandom = (seed: number) => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

// const API_BASE = "http://127.0.0.1:8000/sensor";
const API_BASE = `http://172.17.100.187:8000/sensor`;

const SmartWindowDashboard = () => {
  const [windowOpen, setWindowOpen] = useState<boolean | null>(null);
  const [blindOpen, setBlindOpen] = useState<boolean | null>(null);
  const [weatherType, setWeatherType] = useState("sunny"); // sunny, cloudy, rainy
  const [environmentEffects, setEnvironmentEffects] =
    useState<EnvironmentEffects>({
      highDust: false,
      highTemp: false,
      highHumidity: false,
      strongLight: false,
    });

  const [sensorData, setSensorData] = useState<SensorData>({
    dust: 0,
    rain: false,
    temperature: 0,
    humidity: 0,
    lightLevel: "중",
    timestamp: new Date().toLocaleTimeString("ko-KR"),
  });

  type MinutePoint = {
    time: string;
    dust: number;
    temp: number;
    humidity: number;
  };
  type HourPoint = {
    time: string;
    dust: number;
    temp: number;
    humidity: number;
  };

  const [minuteHistory, setMinuteHistory] = useState<MinutePoint[]>([
    { time: "10:00", dust: 25, temp: 20, humidity: 50 },
    { time: "10:01", dust: 26, temp: 20, humidity: 50 },
    { time: "10:02", dust: 27, temp: 20, humidity: 51 },
    { time: "10:40", dust: 35, temp: 23, humidity: 55 },
    { time: "11:10", dust: 40, temp: 24, humidity: 53 },
    { time: "12:05", dust: 35, temp: 22, humidity: 55 },
  ]);
  const [rangeMode, setRangeMode] = useState<"minute" | "hour">("minute");
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>("idle");
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [voiceReply, setVoiceReply] = useState("");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const recognitionRef = useRef<RecognitionLike | null>(null);

  // 시간 단위 집계 (평균) 계산
  const hourlyHistory: HourPoint[] = useMemo(() => {
    const bucket: Record<
      string,
      { dust: number[]; temp: number[]; humidity: number[] }
    > = {};
    minuteHistory.forEach((p) => {
      const hour = p.time.split(":")[0];
      if (!bucket[hour]) bucket[hour] = { dust: [], temp: [], humidity: [] };
      bucket[hour].dust.push(p.dust);
      bucket[hour].temp.push(p.temp);
      bucket[hour].humidity.push(p.humidity);
    });
    return Object.entries(bucket)
      .map(([hour, vals]) => ({
        time: `${hour}시`,
        dust: Math.round(
          vals.dust.reduce((a, b) => a + b, 0) / vals.dust.length
        ),
        temp: Math.round(
          vals.temp.reduce((a, b) => a + b, 0) / vals.temp.length
        ),
        humidity: Math.round(
          vals.humidity.reduce((a, b) => a + b, 0) / vals.humidity.length
        ),
      }))
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [minuteHistory]);

  const rainDrops = useMemo<RainDrop[]>(() => {
    return Array.from({ length: 20 }, (_, idx) => ({
      id: idx,
      left: pseudoRandom(idx) * 100,
      delay: pseudoRandom(idx + 21) * 1.5,
      duration: 0.6 + pseudoRandom(idx + 42) * 0.9,
      top: -5 - pseudoRandom(idx + 63) * 35,
      height: 20 + pseudoRandom(idx + 84) * 25,
    }));
  }, []);

  // 파티클은 최초 한 번 생성 후 효과가 꺼지면 숨김만 처리
  const dustParticles = useMemo(() => {
    const particles = [] as {
      left: number;
      top: number;
      duration: number;
      delay: number;
    }[];
    for (let i = 0; i < 30; i++) {
      const seed = i + 1;
      const left = (((Math.sin(seed) * 10000) % 100) + 100) % 100;
      const top = (((Math.sin(seed * 1.3) * 10000) % 100) + 100) % 100;
      const duration = 2 + (((Math.sin(seed * 0.7) * 10000) % 100) / 100) * 2;
      const delay = (((Math.sin(seed * 0.9) * 10000) % 100) / 100) * 2;
      particles.push({ left, top, duration, delay });
    }
    return particles;
  }, []);

  const humidityParticles = useMemo(() => {
    const particles = [] as {
      left: number;
      top: number;
      duration: number;
      delay: number;
    }[];
    for (let i = 0; i < 20; i++) {
      const seed = i + 10;
      const left = (((Math.sin(seed * 1.1) * 10000) % 100) + 100) % 100;
      const top = (((Math.sin(seed * 1.5) * 10000) % 100) + 100) % 100;
      const duration = 2 + (((Math.sin(seed * 0.4) * 10000) % 100) / 100) * 3;
      const delay = (((Math.sin(seed * 0.8) * 10000) % 100) / 100) * 2;
      particles.push({ left, top, duration, delay });
    }
    return particles;
  }, []);

  // 백엔드에서 실시간 센서 데이터 폴링
  useEffect(() => {
    const fetchAll = async () => {
      try {
        // 최신 1개씩 요청 (결과는 리스트 형태)
        const [tempRes, humiRes, dustRes, lightRes, rainRes, wDirRes, bDirRes] =
          await Promise.all([
            axios.get(`${API_BASE}/getTemp/1`),
            axios.get(`${API_BASE}/getHumi/1`),
            axios.get(`${API_BASE}/getDust/1`),
            axios.get(`${API_BASE}/getLight/1`),
            axios.get(`${API_BASE}/getRain/1`),
            axios.get(`${API_BASE}/getWDir/1`),
            axios.get(`${API_BASE}/getBDir/1`),
          ]);

        const tempList = tempRes.data as SensorRow[];
        const humiList = humiRes.data as SensorRow[];
        const dustList = dustRes.data as SensorRow[];
        const lightList = lightRes.data as SensorRow[];
        const rainList = rainRes.data as SensorRow[];
        const wDirList = wDirRes.data as SensorRow[];
        const bDirList = bDirRes.data as SensorRow[];

        const latestTemp = tempList[0]?.value ?? 0;
        const latestHumi = humiList[0]?.value ?? 0;
        const latestDust = dustList[0]?.value ?? 0;
        const latestLightRaw = lightList[0]?.value ?? 0;
        const latestRain = rainList[0]?.value ?? 0;
        const latestWDir = wDirList[0]?.value ?? 1;
        const latestBDir = bDirList[0]?.value ?? 1;

        // 조도 수치 → 등급 매핑 (임시 기준값)
        const lightLevel: "상" | "중" | "하" =
          latestLightRaw > 70 ? "상" : latestLightRaw > 40 ? "중" : "하";

        const newData = {
          dust: latestDust,
          rain: latestRain > 0, // rain 값이 0보다 크면 비 감지
          temperature: latestTemp,
          humidity: latestHumi,
          lightLevel,
          timestamp: new Date().toLocaleTimeString("ko-KR"),
        };
        setSensorData(newData);

        setMinuteHistory((prev) => {
          const newHistory = [
            ...prev.slice(-96), // 분 데이터 최대 96개 (최대 1시간 36분)
            {
              time: new Date().toLocaleTimeString("ko-KR", {
                hour: "2-digit",
                minute: "2-digit",
              }),
              dust: newData.dust,
              temp: newData.temperature,
              humidity: newData.humidity,
            },
          ];
          return newHistory;
        });
        setWindowOpen(latestWDir === 0); // 0: 열림, 1: 닫힘
        setBlindOpen(latestBDir === 0); // 0: 블라인드 올라감
      } catch (err) {
        console.error("센서 데이터 요청 실패", err);
      }
    };

    // 최초 1회 즉시 실행 후 주기적 폴링
    fetchAll();
    const interval = setInterval(fetchAll, 1000); // 1초 주기
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort?.();
      recognitionRef.current = null;
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const toggleEnvironmentEffect = (effect: EffectKey) => {
    setEnvironmentEffects((prev) => ({
      ...prev,
      [effect]: !prev[effect],
    }));
  };

  const sendWindowCommand = async (desiredOpen: boolean) => {
    const command = desiredOpen ? "OPEN" : "CLOSE";
    try {
      await axios.post(`${API_BASE}/setWindowCommand`, { command });
    } catch (err) {
      console.error("창문 제어 명령 전송 실패", err);
    }
  };

  const sendBlindCommand = async (desiredOpen: boolean) => {
    const command = desiredOpen ? "UP" : "DOWN";
    try {
      await axios.post(`${API_BASE}/setWindowCommand`, { command });
    } catch (err) {
      console.error("블라인드 제어 명령 전송 실패", err);
    }
  };

  const getSpeechRecognitionConstructor =
    (): SpeechRecognitionConstructor | null => {
      if (typeof window === "undefined") {
        return null;
      }
      const globalWindow = window as Window &
        typeof globalThis & {
          webkitSpeechRecognition?: SpeechRecognitionConstructor;
          SpeechRecognition?: SpeechRecognitionConstructor;
        };
      return (
        globalWindow.SpeechRecognition ||
        globalWindow.webkitSpeechRecognition ||
        null
      );
    };

  const speakResponse = (message: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setVoiceError("이 브라우저는 음성 출력을 지원하지 않습니다.");
      setVoiceStatus("error");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = "ko-KR";
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.onend = () => setVoiceStatus("idle");
    utterance.onerror = () => {
      setVoiceError("응답을 재생하는 중 문제가 발생했습니다.");
      setVoiceStatus("error");
    };
    window.speechSynthesis.speak(utterance);
  };

  const sendVoiceQuery = async (message: string) => {
    setVoiceStatus("thinking");
    setVoiceError(null);
    try {
      const response = await axios.post(`${API_BASE}/voiceAssistant`, {
        message,
      });
      const replyText =
        response.data?.reply ??
        response.data?.response ??
        "응답을 받을 수 없었습니다.";
      setVoiceReply(replyText);
      setVoiceStatus("speaking");
      speakResponse(replyText);
    } catch (err) {
      console.error("음성 비서 통신 실패", err);
      setVoiceError("서버와 통신하는 중 오류가 발생했습니다.");
      setVoiceStatus("error");
    }
  };

  const handleMicButtonClick = () => {
    const Recognition = getSpeechRecognitionConstructor();
    if (voiceStatus === "listening" && recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }
    if (!Recognition) {
      setVoiceError("이 브라우저에서는 음성 인식을 사용할 수 없습니다.");
      setVoiceStatus("error");
      return;
    }
    const recognition = new Recognition();
    recognition.lang = "ko-KR";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: RecognitionResultEvent) => {
      const transcript =
        event.results?.[0]?.[0]?.transcript ??
        event.results?.item?.(0)?.item?.(0)?.transcript ??
        "";
      if (!transcript) {
        setVoiceError("음성을 인식하지 못했습니다. 다시 시도해주세요.");
        setVoiceStatus("error");
        return;
      }
      setVoiceTranscript(transcript);
      recognition.stop();
      sendVoiceQuery(transcript);
    };

    recognition.onerror = (event: RecognitionErrorEvent) => {
      const errMsg =
        event.error === "not-allowed"
          ? "마이크 사용 권한을 허용해주세요."
          : "음성 인식 중 문제가 발생했습니다.";
      setVoiceError(errMsg);
      setVoiceStatus("error");
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      setVoiceStatus((prev) => (prev === "listening" ? "idle" : prev));
    };

    recognitionRef.current = recognition;
    setVoiceTranscript("");
    setVoiceStatus("listening");
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    recognition.start();
  };

  const getDustLevel = (value: number) => {
    if (value <= 30)
      return { level: "좋음", color: "text-green-500", bg: "bg-green-50" };
    if (value <= 50)
      return { level: "보통", color: "text-yellow-500", bg: "bg-yellow-50" };
    return { level: "나쁨", color: "text-red-500", bg: "bg-red-50" };
  };

  const getLightColor = (level: "상" | "중" | "하") => {
    if (level === "상") return "text-yellow-400";
    if (level === "중") return "text-orange-400";
    return "text-gray-400";
  };

  const voiceStatusLabel: Record<VoiceStatus, string> = {
    idle: "음성 도우미",
    listening: "듣는 중...",
    thinking: "응답 생성 중",
    speaking: "읽어주는 중",
    error: "다시 시도",
  };

  const isVoiceActive = ["listening", "thinking", "speaking"].includes(
    voiceStatus
  );

  const dustInfo = getDustLevel(sensorData.dust);
  const hasWarning = sensorData.dust > 50 || sensorData.rain;
  const isWindowOpen = windowOpen === true;
  const isBlindOpen = blindOpen === true;

  const renderWeatherBackdrop = (
    options: {
      includeEnvironmentEffects?: boolean;
      extraClassName?: string;
    } = {}
  ) => {
    const { includeEnvironmentEffects = true, extraClassName = "" } = options;

    const baseBackgroundClass =
      weatherType === "sunny"
        ? "bg-gradient-to-b from-sky-400 to-sky-200"
        : weatherType === "cloudy"
        ? "bg-gradient-to-b from-gray-400 to-gray-300"
        : "bg-gradient-to-b from-gray-600 to-gray-500";

    return (
      <div
        className={`absolute inset-0 transition-all duration-1000 ${baseBackgroundClass} ${extraClassName}`}
      >
        {weatherType === "sunny" && (
          <>
            <div className="absolute top-8 left-12 w-20 h-10 bg-white rounded-full opacity-70"></div>
            <div className="absolute top-12 right-16 w-24 h-12 bg-white rounded-full opacity-60"></div>
            <div className="absolute top-20 left-24 w-16 h-8 bg-white rounded-full opacity-50"></div>
            <div className="absolute top-6 right-6 w-16 h-16 bg-yellow-300 rounded-full shadow-lg">
              <div className="absolute inset-0 animate-pulse bg-yellow-200 rounded-full opacity-50"></div>
            </div>
          </>
        )}

        {weatherType === "cloudy" && (
          <>
            <div className="absolute top-4 left-8 w-28 h-16 bg-gray-100 rounded-full opacity-90 shadow-md"></div>
            <div className="absolute top-12 right-12 w-32 h-18 bg-gray-100 rounded-full opacity-85 shadow-md"></div>
            <div className="absolute top-20 left-16 w-24 h-14 bg-gray-200 rounded-full opacity-80 shadow-md"></div>
            <div className="absolute bottom-16 right-8 w-28 h-16 bg-gray-100 rounded-full opacity-90 shadow-md"></div>
            <div className="absolute bottom-8 left-20 w-20 h-12 bg-gray-200 rounded-full opacity-75 shadow-md"></div>
          </>
        )}

        {weatherType === "rainy" && (
          <>
            <div className="absolute top-4 left-8 w-32 h-18 bg-gray-700 rounded-full opacity-80 shadow-lg"></div>
            <div className="absolute top-12 right-10 w-36 h-20 bg-gray-700 rounded-full opacity-85 shadow-lg"></div>
            <div className="absolute top-8 left-24 w-28 h-16 bg-gray-800 rounded-full opacity-75 shadow-lg"></div>

            {rainDrops.map((drop) => (
              <div
                key={`rain-${drop.id}`}
                className="absolute w-0.5 bg-blue-200 opacity-60 animate-rainfall"
                style={{
                  left: `${drop.left}%`,
                  top: `${drop.top}px`,
                  height: `${drop.height}px`,
                  animationDelay: `${drop.delay}s`,
                  animationDuration: `${drop.duration}s`,
                }}
              ></div>
            ))}
          </>
        )}

        {includeEnvironmentEffects && environmentEffects.highDust && (
          <div className="absolute inset-0 bg-yellow-900 opacity-30 mix-blend-multiply">
            {dustParticles.map((p, i) => (
              <div
                key={`dust-${i}`}
                className="absolute w-1 h-1 bg-yellow-600 rounded-full opacity-40 animate-float"
                style={{
                  left: `${p.left}%`,
                  top: `${p.top}%`,
                  animationDuration: `${p.duration}s`,
                  animationDelay: `${p.delay}s`,
                }}
              ></div>
            ))}
          </div>
        )}

        {includeEnvironmentEffects && environmentEffects.highTemp && (
          <div className="absolute inset-0">
            {[...Array(5)].map((_, i) => (
              <div
                key={`heat-${i}`}
                className="absolute bottom-0 w-full h-24 bg-gradient-to-t from-red-400 to-transparent opacity-20 animate-heatwave"
                style={{
                  animationDuration: `${2 + i * 0.5}s`,
                  animationDelay: `${i * 0.3}s`,
                }}
              ></div>
            ))}
          </div>
        )}

        {includeEnvironmentEffects && environmentEffects.highHumidity && (
          <div className="absolute inset-0 bg-blue-200 opacity-20">
            {humidityParticles.map((p, i) => (
              <div
                key={`humidity-${i}`}
                className="absolute w-2 h-2 bg-blue-400 rounded-full opacity-40 animate-drip"
                style={{
                  left: `${p.left}%`,
                  top: `${p.top}%`,
                  animationDuration: `${p.duration}s`,
                  animationDelay: `${p.delay}s`,
                }}
              ></div>
            ))}
          </div>
        )}

        {includeEnvironmentEffects && environmentEffects.strongLight && (
          <div className="absolute inset-0">
            <div className="absolute inset-0 bg-yellow-100 opacity-40 animate-pulse"></div>
            {[...Array(8)].map((_, i) => (
              <div
                key={`light-${i}`}
                className={`absolute top-1/2 left-1/2 w-2 h-32 bg-yellow-200 opacity-30 animate-spin light-ray-${i} light-ray-rotate`}
              ></div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            스마트 창문 제어
          </h1>
          <p className="text-gray-600">실시간 환경 모니터링 및 제어</p>
        </div>

        {/* 경고 알림 (우측 상단 모달) */}
        {hasWarning && (
          <div className="fixed top-6 right-6 z-50 animate-slide-in">
            <div className="bg-white rounded-xl shadow-2xl border-l-4 border-red-500 p-5 max-w-sm">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <AlertTriangle className="text-red-500" size={24} />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-red-800 mb-2 text-lg">
                    환경 경고
                  </h3>
                  <p className="text-red-700 text-sm leading-relaxed">
                    {sensorData.rain && "🌧️ 비가 감지되었습니다. "}
                    {sensorData.dust > 50 && "💨 미세먼지 농도가 높습니다. "}
                    창문을 닫는 것을 권장합니다.
                  </p>
                  <div className="mt-3 pt-3 border-t border-red-100">
                    <p className="text-xs text-gray-500">
                      {sensorData.timestamp}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 창문 & 블라인드 애니메이션 및 제어 */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
          {/* 애니메이션 영역 */}
          <div className="mb-8 grid gap-8 lg:grid-cols-2">
            <div className="flex justify-center">
              <div className="relative w-96 h-72 bg-gray-800 rounded-lg overflow-hidden border-8 border-gray-700 shadow-2xl">
                {/* 창문 프레임 배경 (날씨별 배경) */}
                {renderWeatherBackdrop()}

                {/* 창문 프레임 (고정) */}
                <div className="absolute inset-0 pointer-events-none z-20">
                  {/* 세로 중앙 프레임 */}
                  <div className="absolute inset-y-0 left-1/2 w-3 bg-gray-700 transform -translate-x-1/2 shadow-lg"></div>
                  {/* 가로 중앙 프레임 */}
                  <div className="absolute inset-x-0 top-1/2 h-3 bg-gray-700 transform -translate-y-1/2 shadow-lg"></div>
                </div>

                {/* 왼쪽 창문 */}
                <div
                  className={`absolute top-0 bottom-0 left-0 transition-all duration-1000 ease-in-out z-10 ${
                    isWindowOpen ? "window-open" : "window-closed"
                  }`}
                >
                  <div className="w-full h-full bg-white/20 backdrop-blur-sm border-r-2 border-gray-600 relative">
                    <div className="absolute right-2 top-1/2 w-3 h-10 bg-gray-700 rounded-full transform -translate-y-1/2 shadow-md"></div>
                  </div>
                </div>

                {/* 오른쪽 창문 */}
                <div
                  className={`absolute top-0 bottom-0 right-0 transition-all duration-1000 ease-in-out z-10 ${
                    isWindowOpen ? "window-open" : "window-closed"
                  }`}
                >
                  <div className="w-full h-full bg-white/20 backdrop-blur-sm border-l-2 border-gray-600 relative">
                    <div className="absolute left-2 top-1/2 w-3 h-10 bg-gray-700 rounded-full transform -translate-y-1/2 shadow-md"></div>
                  </div>
                </div>

                {/* 바람 효과 (창문 열렸을 때) */}
                {/* {windowOpen && (
                <div className="absolute inset-0 z-15">
                  <div className="absolute top-1/4 left-1/4 w-1 h-12 bg-blue-400 opacity-40 animate-bounce wind-line-0"></div>
                  <div className="absolute top-1/3 right-1/3 w-1 h-10 bg-blue-400 opacity-40 animate-bounce wind-line-1"></div>
                  <div className="absolute bottom-1/3 left-1/3 w-1 h-14 bg-blue-400 opacity-40 animate-bounce wind-line-2"></div>
                  <div className="absolute top-1/2 right-1/4 w-1 h-8 bg-blue-400 opacity-40 animate-bounce wind-line-3"></div>
                </div>
              )} */}
              </div>
            </div>
            <div className="flex justify-center">
              <div className="blind-scene">
                <div className="blind-view">
                  {renderWeatherBackdrop({ includeEnvironmentEffects: false })}
                  <div className="blind-cityline"></div>
                  <div
                    className={`blind-overlay ${
                      isBlindOpen ? "blind-overlay-open" : ""
                    }`}
                  ></div>
                </div>
                <div
                  className={`blind-panel ${
                    isBlindOpen ? "blind-panel-open" : "blind-panel-closed"
                  }`}
                ></div>
                <div
                  className={`blind-cord ${
                    isBlindOpen ? "blind-cord-open" : ""
                  }`}
                ></div>
                <div className="blind-status-chip">
                  {isBlindOpen ? "Blind Open" : "Blind Closed"}
                </div>
              </div>
            </div>
          </div>

          {/* 날씨 및 환경 효과 컨트롤 */}
          <div className="mb-6 bg-gray-50 rounded-xl p-6 border-2 border-gray-200">
            {/* 날씨 선택 (단일 선택) */}
            <div className="mb-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                날씨 선택
              </h3>
              <div className="flex gap-3">
                <button
                  onClick={() => setWeatherType("sunny")}
                  className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all ${
                    weatherType === "sunny"
                      ? "bg-yellow-400 text-black shadow-md"
                      : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-300"
                  }`}
                >
                  ☀️ 맑은 날
                </button>
                <button
                  onClick={() => setWeatherType("cloudy")}
                  className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all ${
                    weatherType === "cloudy"
                      ? "bg-gray-400 text-white shadow-md"
                      : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-300"
                  }`}
                >
                  ☁️ 구름 많음
                </button>
                <button
                  onClick={() => setWeatherType("rainy")}
                  className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all ${
                    weatherType === "rainy"
                      ? "bg-blue-500 text-white shadow-md"
                      : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-300"
                  }`}
                >
                  🌧️ 비오는 날
                </button>
              </div>
            </div>

            {/* 환경 효과 선택 (다중 선택) */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                환경 효과 (다중 선택 가능)
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <button
                  onClick={() => toggleEnvironmentEffect("highDust")}
                  className={`px-4 py-3 rounded-lg font-medium transition-all ${
                    environmentEffects.highDust
                      ? "bg-yellow-600 text-white shadow-md"
                      : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-300"
                  }`}
                >
                  💨 미세먼지
                </button>
                <button
                  onClick={() => toggleEnvironmentEffect("highTemp")}
                  className={`px-4 py-3 rounded-lg font-medium transition-all ${
                    environmentEffects.highTemp
                      ? "bg-red-500 text-white shadow-md"
                      : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-300"
                  }`}
                >
                  🌡️ 고온
                </button>
                <button
                  onClick={() => toggleEnvironmentEffect("highHumidity")}
                  className={`px-4 py-3 rounded-lg font-medium transition-all ${
                    environmentEffects.highHumidity
                      ? "bg-blue-600 text-white shadow-md"
                      : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-300"
                  }`}
                >
                  💧 고습도
                </button>
                <button
                  onClick={() => toggleEnvironmentEffect("strongLight")}
                  className={`px-4 py-3 rounded-lg font-medium transition-all ${
                    environmentEffects.strongLight
                      ? "bg-yellow-300 text-gray-800 shadow-md"
                      : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-300"
                  }`}
                >
                  ☀️ 강한 빛
                </button>
              </div>
            </div>
          </div>

          {/* 제어 버튼 */}
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                창문 상태
              </h2>
              <p className="text-gray-600">
                마지막 업데이트: {sensorData.timestamp}
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                onClick={() => sendWindowCommand(!(windowOpen ?? false))}
                disabled={windowOpen === null}
                className={`px-8 py-4 rounded-xl font-semibold text-lg transition-all transform ${
                  windowOpen === null
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "hover:scale-105"
                } ${
                  isWindowOpen
                    ? "bg-blue-500 hover:bg-blue-600 text-white"
                    : "bg-gray-200 hover:bg-gray-300 text-gray-700"
                }`}
              >
                {windowOpen === null
                  ? "창문 상태 수신중"
                  : isWindowOpen
                  ? "창문 닫기"
                  : "창문 열기"}
              </button>
              <button
                onClick={() => sendBlindCommand(!(blindOpen ?? false))}
                disabled={blindOpen === null}
                className={`px-8 py-4 rounded-xl font-semibold text-lg transition-all transform ${
                  blindOpen === null
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "hover:scale-105"
                } ${
                  isBlindOpen
                    ? "bg-indigo-500 hover:bg-indigo-600 text-white"
                    : "bg-gray-200 hover:bg-gray-300 text-gray-700"
                }`}
              >
                {blindOpen === null
                  ? "블라인드 상태 수신중"
                  : isBlindOpen
                  ? "블라인드 내리기"
                  : "블라인드 올리기"}
              </button>
              <button
                type="button"
                onClick={handleMicButtonClick}
                className={`px-8 py-4 rounded-xl font-semibold text-lg transition-all transform flex items-center justify-center gap-2 ${
                  voiceStatus === "error"
                    ? "bg-red-100 text-red-600 hover:bg-red-200"
                    : isVoiceActive
                    ? "bg-rose-500 text-white hover:bg-rose-600"
                    : "bg-white border border-gray-300 text-gray-800 hover:bg-gray-50"
                }`}
              >
                <Mic size={20} />
                <span>{voiceStatusLabel[voiceStatus]}</span>
              </button>
            </div>
          </div>
          <div className="mt-4">
            <div className="mb-4 bg-gray-50 border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  마지막 음성 명령: {voiceTranscript || "-"}
                </p>
                {voiceError && (
                  <span className="text-xs text-red-600 font-medium">
                    {voiceError}
                  </span>
                )}
              </div>
              {voiceReply && (
                <p className="mt-2 text-sm text-gray-800">
                  응답: <span className="font-semibold">{voiceReply}</span>
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-3">
              <div
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${
                  isWindowOpen
                    ? "bg-blue-100 text-blue-700"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                <Activity size={18} />
                <span className="font-medium">
                  {windowOpen === null
                    ? "창문 상태 수신중"
                    : isWindowOpen
                    ? "창문 열림"
                    : "창문 닫힘"}
                </span>
              </div>
              <div
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${
                  isBlindOpen
                    ? "bg-indigo-100 text-indigo-700"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                <Activity size={18} />
                <span className="font-medium">
                  {blindOpen === null
                    ? "블라인드 상태 수신중"
                    : isBlindOpen
                    ? "블라인드 열림"
                    : "블라인드 닫힘"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 센서 데이터 그리드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
          {/* 미세먼지 */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-purple-100 rounded-xl">
                  <Wind className="text-purple-600" size={24} />
                </div>
                <h3 className="font-semibold text-gray-900">미세먼지</h3>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${dustInfo.bg} ${dustInfo.color}`}
              >
                {dustInfo.level}
              </span>
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">
              {sensorData.dust}
            </div>
            <div className="text-sm text-gray-600">㍍/m³</div>
          </div>

          {/* 온도 */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-red-100 rounded-xl">
                <ThermometerSun className="text-red-600" size={24} />
              </div>
              <h3 className="font-semibold text-gray-900">온도</h3>
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">
              {sensorData.temperature}°C
            </div>
            <div className="text-sm text-gray-600">실내 온도</div>
          </div>

          {/* 습도 */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-blue-100 rounded-xl">
                <Droplets className="text-blue-600" size={24} />
              </div>
              <h3 className="font-semibold text-gray-900">습도</h3>
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">
              {sensorData.humidity}%
            </div>
            <div className="text-sm text-gray-600">상대 습도</div>
          </div>

          {/* 빛 강도 */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-yellow-100 rounded-xl">
                <Sun
                  className={getLightColor(sensorData.lightLevel)}
                  size={24}
                />
              </div>
              <h3 className="font-semibold text-gray-900">빛 강도</h3>
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">
              {sensorData.lightLevel}
            </div>
            <div className="text-sm text-gray-600">조도 수준</div>
          </div>

          {/* 강우 감지 */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <div
                className={`p-3 rounded-xl ${
                  sensorData.rain ? "bg-blue-100" : "bg-gray-100"
                }`}
              >
                <Droplets
                  className={
                    sensorData.rain ? "text-blue-600" : "text-gray-400"
                  }
                  size={24}
                />
              </div>
              <h3 className="font-semibold text-gray-900">강우 감지</h3>
            </div>
            <div
              className={`text-3xl font-bold mb-1 ${
                sensorData.rain ? "text-blue-600" : "text-gray-400"
              }`}
            >
              {sensorData.rain ? "감지됨" : "없음"}
            </div>
            <div className="text-sm text-gray-600">센서 상태</div>
          </div>
        </div>

        {/* 히스토리 그래프 */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-6">
            환경 데이터 추이
          </h3>

          {/* 차트 모드 선택 버튼 */}
          <div className="flex gap-3 mb-6">
            <button
              onClick={() => setRangeMode("minute")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                rangeMode === "minute"
                  ? "bg-blue-600 text-white shadow"
                  : "bg-white text-gray-600 border border-gray-300 hover:bg-gray-100"
              }`}
            >
              1분 단위
            </button>
            <button
              onClick={() => setRangeMode("hour")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                rangeMode === "hour"
                  ? "bg-blue-600 text-white shadow"
                  : "bg-white text-gray-600 border border-gray-300 hover:bg-gray-100"
              }`}
            >
              1시간 단위
            </button>
          </div>

          <div className="mb-8">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">
              미세먼지 농도 ({rangeMode === "minute" ? "1분" : "1시간"} 기준)
            </h4>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart
                data={rangeMode === "minute" ? minuteHistory : hourlyHistory}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="time" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="dust"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="mb-8">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">온도</h4>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart
                data={rangeMode === "minute" ? minuteHistory : hourlyHistory}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="time" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="temp"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3">습도</h4>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart
                data={rangeMode === "minute" ? minuteHistory : hourlyHistory}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="time" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="humidity"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SmartWindowDashboard;
