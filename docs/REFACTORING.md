# 리팩터링 요약 (라즈베리파이 → 클라우드 · PWA)

이 문서는 원본 대비 무엇을 왜 바꿨는지 정리한 것이다. 크게 세 축이다:
(1) 보안·정합성 수정, (2) 탈-라즈베리파이 클라우드 배포, (3) 모바일 PWA 전환.

## 1. 아키텍처 전환

| | 이전 | 이후 |
|---|---|---|
| 서버 호스팅 | 라즈베리파이(로컬 Flask) | 무료 클라우드 1개 서비스(Docker) |
| ESP32 연결 | 로컬 Pi | 공개 URL로 직접(WiFi) |
| 프론트 배포 | 별도 Vite 서버 | Flask 가 빌드 결과를 **같은 출처**에서 서빙 |
| 폰 접속 | 같은 집 WiFi 한정 | 어디서든 브라우저 + 설치형 PWA |

같은 출처 배포를 선택한 이유: 프론트/백엔드 도메인을 나누면 세션 쿠키가
서드파티 쿠키로 취급돼 모바일 사파리(ITP)에서 자주 차단된다. 한 도메인으로 묶으면
쿠키가 first-party 로 동작하고 CORS 도 사실상 불필요해진다.

## 2. 보안·정합성 수정 (검증 완료)

1. **기기 소유권 탈취 차단** — `pair_device` 가 device_id 만 알면 남의 기기를 가져가던
   문제 제거. 다른 계정 소유 기기는 `403`. (통합테스트로 확인)
2. **기기별 개별 토큰** — 전역 공유 토큰 대신 `Device.auth_token` 을 페어링 시 발급.
   측정/명령 API 는 해당 기기 토큰으로 검증(`secrets.compare_digest`). 잘못된 토큰 `401`.
3. **세션 종료 점수 단일화** — REST 종료와 Socket.IO 종료가 각각 다른 소스로 점수를
   계산하던 이중 경로를 `services/session_service.finalize_session` 하나로 통일.
   점수는 **항상 DB 원본 샘플** 기준(단일 진실 공급원).
4. **연결 해제 ≠ 세션 종료** — 새로고침/모바일 백그라운드로 소켓이 끊겨도 훈련이
   조기 종료되지 않음. 방치된 세션은 다음 세션 시작 시 정리.
5. **호흡 임계값 통일** — 서버 위상분류·사이클카운트·클라이언트가 모두
   `Config.PHASE_THRESHOLD_PA(=20)` 규약 사용. (이전엔 -10 / ±20 혼재)
6. **exhale_power 실측화** — 레이더 차트의 호기력이 흡기 평균을 복제하던 것을,
   세션별 최저 차압(가장 깊은 날숨) 크기로 계산하도록 수정.
7. **CORS/쿠키/시크릿 강화** — `origins="*"` + credentials 조합(스펙상 무효) 제거,
   출처는 환경변수 화이트리스트. 배포 시 `SECRET_KEY` 기본값이면 기동 거부.
   `config` 의 사용되지 않던 `eventlet` 오설정 정리(async_mode 환경변수화).
8. **백분위 정직화** — 더미 백분위에 `percentile_estimated: true` 플래그를 달아
   UI 에서 "추정" 표기가 가능하도록.

## 3. 배포 구성 추가

- `Dockerfile` — 멀티스테이지(노드로 React 빌드 → 파이썬으로 서빙).
- `wsgi.py` — `gunicorn -k eventlet -w 1 wsgi:application` 진입점(eventlet monkey_patch).
- `render.yaml` — Render 무료 웹서비스 Blueprint(1클릭 배포, SECRET_KEY 자동생성).
- `Procfile` — Railway/Heroku 계열 대안.
- `DATABASE_URL` 로 SQLite↔Postgres 전환(무료 Neon/Supabase 권장). `postgres://`→`postgresql://` 정규화.

## 4. PWA / 모바일

- `vite-plugin-pwa` 로 매니페스트·서비스워커·설치 지원. 아이콘(192/512/maskable/apple-touch) 포함.
- 서비스워커는 **정적 자산만 프리캐시**하고 `/api`·`/socket.io`·`/health` 는 캐시 제외(실시간·인증 보호).
- 모바일 뷰포트/상태바 메타, 홈 화면 설치 대응.
- 누락돼 있던 `src/vite-env.d.ts` 추가(원본은 `import.meta.env` 타입이 없어 `tsc` 빌드가 실패하던 상태).

## 남은 개선 여지 (후속)

- 로그인 rate limiting(flask-limiter), `is_admin` 활용 관리자 뷰.
- 고해상도 샘플(100Hz) 장기 보관 정책/파티셔닝.
- 실제 전체 유저 분포 기반 백분위 산출.
- `datetime.utcnow()` → timezone-aware 전환(스키마 함께 정리 필요해 이번엔 보류).
