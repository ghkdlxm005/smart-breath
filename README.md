# 🫁 스마트 호흡 훈련기 웹 시스템

COPD 환자 및 호흡근 훈련이 필요한 사용자를 위한 **개인 맞춤 스마트 호흡 훈련 시스템**입니다.

---

## 시스템 구조

```
ESP32 + SDP31 차압센서  ──►  Raspberry Pi 5 (Flask API)  ◄──►  React 웹 대시보드
  + 서보모터(저항조절)         + SQLite DB + Socket.IO          TypeScript + Tailwind
```

---

## 빠른 시작 (4단계)

### 1단계: 서버 설치

```bash
cd server

# 가상환경 생성 및 활성화
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# 의존성 설치
pip install -r requirements.txt

# 환경변수 설정
cp .env.example .env
# .env 파일에서 SECRET_KEY, DEVICE_TOKEN 등 수정
```

### 2단계: 서버 실행

```bash
# 서버 시작 (자동으로 DB 초기화 + 데모 계정 생성)
python app.py
```

서버 실행 후 `http://localhost:5000/health` 에서 정상 동작 확인.

> **데모 계정**: `demo@smartbreath.local` / `demo1234`

### 3단계: 프론트엔드 실행

```bash
cd ../client

# 의존성 설치
npm install

# 개발 서버 시작
npm run dev
```

브라우저에서 `http://localhost:5173` 접속.

### 4단계: ESP32 없이 테스트 (Mock 시뮬레이터)

```bash
# 서버가 실행된 상태에서 별도 터미널에서 실행
python server/scripts/mock_device.py \
  --host http://localhost:5000 \
  --device-id esp32_demo \
  --token esp32-device-token-dev \
  --level 3 \
  --duration 60
```

웹 대시보드의 `/training` 페이지에서 실시간 파형을 확인할 수 있습니다.

---

## 전체 시연 흐름

1. 브라우저에서 로그인 (`demo@smartbreath.local` / `demo1234`)
2. 대시보드에서 **훈련 시작** 클릭
3. 레벨 선택 후 훈련 시작
4. 별도 터미널에서 Mock 시뮬레이터 실행 → 실시간 파형 확인
5. 훈련 종료 → 점수·분석 리포트 확인
6. `/analytics` 에서 트렌드 차트 확인
7. `/recommendation` 에서 AI 강도 추천 확인

---

## 파일 구조

```
smart-breath/
├── server/                    # Raspberry Pi Flask 서버
│   ├── app.py                 # 앱 엔트리포인트
│   ├── config.py              # 환경 설정
│   ├── extensions.py          # Flask 확장 (db, socketio, login)
│   ├── requirements.txt
│   ├── models/                # SQLAlchemy ORM 모델
│   ├── routes/                # REST API 엔드포인트
│   ├── services/              # 점수 계산, AI 추천, Socket.IO
│   ├── scripts/
│   │   └── mock_device.py     # ESP32 Mock 시뮬레이터
│   └── systemd/               # 라즈베리파이 서비스 등록
│
└── client/                    # React 웹 앱
    ├── src/
    │   ├── api/               # fetch 래퍼
    │   ├── hooks/             # useAuth, useSocket
    │   ├── stores/            # Zustand 상태
    │   ├── components/        # Layout, KpiCard, Charts, UI
    │   ├── pages/             # 8개 페이지
    │   └── types/             # TypeScript 공용 타입
    └── package.json
```

---

## API 주요 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/auth/login` | 로그인 |
| POST | `/api/auth/signup` | 회원가입 |
| POST | `/api/sessions/start` | 훈련 세션 시작 |
| POST | `/api/sessions/:id/end` | 세션 종료 |
| GET  | `/api/analytics/summary?period=7d` | 기간별 분석 |
| GET  | `/api/recommendation/current` | AI 강도 추천 |
| POST | `/api/measurement` | ESP32 배치 업로드 |
| GET  | `/api/device/:id/command` | 서보 제어 명령 폴링 |

---

## 라즈베리파이 배포

```bash
# systemd 서비스 등록
sudo cp server/systemd/smart-breath.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable smart-breath
sudo systemctl start smart-breath
```

---

## 기술 스택

**백엔드**: Python 3.11 · Flask · Flask-SocketIO · SQLAlchemy · SQLite · bcrypt · numpy/pandas  
**프론트엔드**: React 18 · TypeScript · Vite · Tailwind CSS · Recharts · Zustand · React Query · socket.io-client · framer-motion  
**하드웨어**: ESP32 · Sensirion SDP31 차압센서 · SG90 서보모터 × 2
