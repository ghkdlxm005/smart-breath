# 🫁 스마트 호흡 훈련기 (웹앱 · PWA)

COPD 환자 및 호흡근 훈련이 필요한 사용자를 위한 **개인 맞춤 스마트 호흡 훈련 시스템**입니다.
클라우드에 한 번 배포하면 **PC·모바일 어디서든 브라우저로 접속해 실시간 측정**할 수 있고,
휴대폰에서는 **홈 화면에 설치되는 앱(PWA)** 형태로도 쓸 수 있습니다.

---

## 시스템 구조 (라즈베리파이 없이 클라우드)

```
ESP32 + SDP31 차압센서 ──WiFi/HTTP──▶  클라우드 (Flask + Socket.IO + DB)  ◀──WSS──▶  브라우저 / 폰 (PWA)
  + 서보모터(저항조절)  ◀──명령폴링──         프론트+API 단일 서비스                React + TS + Tailwind
```

기존에는 라즈베리파이가 로컬 서버 역할을 했지만, 서버가 하던 일은 "Flask 호스팅"뿐이라
이를 **무료 클라우드 한 서비스**로 옮겼습니다. ESP32 는 이제 로컬 Pi 대신 공개 URL로 직접
데이터를 보내고, 폰은 같은 URL로 접속합니다. **프론트엔드와 API 를 같은 출처(도메인)에서
서빙**하므로 세션 쿠키가 모바일 사파리에서도 안정적으로 동작하고 CORS 설정이 단순합니다.

---

## 로컬 개발 (2개 터미널)

### 1) 서버

```bash
cd server
python3 -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                                # 필요 시 값 수정
python app.py                                       # http://localhost:5000/health
```

> 데모 계정: `demo@smartbreath.local` / `demo1234`
> 데모 기기: `esp32_demo` (토큰은 `.env` 의 `DEVICE_TOKEN` 값)

### 2) 프론트엔드

```bash
cd client
npm install
npm run dev        # http://localhost:5173 (개발 프록시가 /api·/socket.io 를 5000 으로 전달)
```

### 3) ESP32 없이 테스트 (Mock 시뮬레이터)

```bash
python server/scripts/mock_device.py \
  --host http://localhost:5000 --device-id esp32_demo \
  --token esp32-device-token-dev --level 3 --duration 60
```

로그인 → `/training` 에서 레벨 선택 후 시작 → Mock 실행 → 실시간 파형 확인 → 종료 시 점수/분석.

---

## 배포 (무료, 단일 서비스)

프론트엔드 빌드와 Flask 서버를 **Docker 한 이미지**로 묶어 배포합니다.

### Render (권장, 무료 웹서비스)

1. 이 repo 를 GitHub 에 push.
2. Render → **New +** → **Blueprint** → repo 선택 (루트의 `render.yaml` 자동 인식).
3. 환경변수 `DEVICE_TOKEN` 만 입력하면 됨 (`SECRET_KEY` 는 자동 생성).
4. 배포 완료 후 `https://<앱>.onrender.com` 접속.

> 무료 플랜은 15분 유휴 시 슬립 → 첫 요청에 콜드스타트(수십 초)가 있습니다.

### 데이터 영속 (권장: 무료 Postgres)

SQLite 는 무료 플랜에서 재배포 시 초기화됩니다. 데이터를 유지하려면
[Neon](https://neon.tech) 또는 [Supabase](https://supabase.com) 에서 무료 Postgres 를 만들고
연결 문자열을 환경변수 `DATABASE_URL` 에 넣으세요. (`server/requirements.txt` 의
`psycopg2-binary` 주석을 해제하면 됩니다.)

### 로컬에서 배포본 그대로 실행 (Docker)

```bash
docker build -t smart-breath .
docker run -p 5000:5000 -e SECRET_KEY=$(openssl rand -hex 32) -e DEVICE_TOKEN=my-device-token smart-breath
# http://localhost:5000
```

### ESP32 펌웨어 설정 (하드웨어 연결 시)

1. 웹에서 로그인 → `/device` 에서 기기 페어링 → 응답의 **`auth_token` 을 1회 확인**(재노출 안 됨).
2. 펌웨어에 서버 URL(`https://<앱>.onrender.com`)과 이 토큰을 저장.
3. `POST /api/measurement` 로 배치 업로드, `GET /api/device/{id}/command` 로 서보 명령 폴링.

---

## API 주요 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/auth/login` · `/signup` | 로그인 / 회원가입 |
| POST | `/api/sessions/start` · `/{id}/end` | 훈련 세션 시작 / 종료(+점수) |
| GET  | `/api/sessions/{id}/samples` | 세션 파형(다운샘플링) |
| GET  | `/api/analytics/summary?period=7d` | 기간별 분석 |
| GET  | `/api/recommendation/current` | AI 강도 추천 |
| POST | `/api/devices/pair` | 기기 페어링(+토큰 발급) |
| POST | `/api/measurement` | ESP32 배치 업로드 (기기 토큰 필요) |
| GET  | `/api/device/{id}/command` | 서보 제어 명령 폴링 (기기 토큰 필요) |

---

## 기술 스택

**백엔드**: Python 3.11 · Flask · Flask-SocketIO · SQLAlchemy · SQLite/Postgres · bcrypt · numpy/pandas · gunicorn+eventlet
**프론트엔드**: React 18 · TypeScript · Vite · Tailwind · Recharts · Zustand · React Query · socket.io-client · **PWA(vite-plugin-pwa)**
**배포**: Docker(멀티스테이지) · Render/Fly.io/Railway · (선택) Neon/Supabase Postgres
**하드웨어**: ESP32 · Sensirion SDP31 차압센서 · SG90 서보모터 × 2

> 이번 리팩터링에서 바뀐 내용과 이유는 [`docs/REFACTORING.md`](docs/REFACTORING.md) 참고.
