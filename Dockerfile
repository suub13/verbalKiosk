# Stage 1: Node 빌드
FROM node:20-slim AS builder
WORKDIR /build
COPY shared/ ./shared/
COPY client/ ./client/
COPY tsconfig.base.json ./tsconfig.base.json
RUN cd shared && npm install
RUN cd client && npm install && npm run build

# Stage 2: Python 서버
FROM python:3.11-slim
WORKDIR /app
COPY python_server/requirements.txt .
RUN pip install -r requirements.txt
COPY python_server/ .
COPY --from=builder /build/client/dist ./client_dist
ENV CLIENT_DIST_PATH=/app/client_dist
ENV NODE_ENV=production
CMD ["python", "main.py"]
