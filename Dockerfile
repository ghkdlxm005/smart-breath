# ─── Stage 1: React 프론트엔드 빌드 ───
FROM node:20-slim AS client-build
WORKDIR /client
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
# same-origin 배포: VITE_API_URL 은 비워둠(상대경로로 현재 출처 호출)
RUN npm run build

# ─── Stage 2: Flask 서버 + 정적 파일 서빙 ───
FROM python:3.11-slim AS server
ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    FLASK_ENV=production \
    SOCKETIO_ASYNC_MODE=eventlet \
    CLIENT_DIST_DIR=/app/client_dist

WORKDIR /app
COPY server/requirements.txt ./
RUN pip install -r requirements.txt

COPY server/ ./
# 빌드된 프론트엔드를 서버가 서빙할 위치로 복사
COPY --from=client-build /client/dist /app/client_dist

# 클라우드 플랫폼이 주입하는 $PORT 사용 (기본 5000)
ENV PORT=5000
EXPOSE 5000

CMD gunicorn -k eventlet -w 1 -b 0.0.0.0:${PORT} wsgi:application
