# SentinelPrint collector agent image.
# Build from the repo root:  docker build -f agent/Dockerfile -t sentinelprint-collector .
# Run inside the customer network:
#   docker run -d --network host \
#     -e SENTINEL_URL=https://app.example.com \
#     -e COLLECTOR_TOKEN=<id.secret> \
#     sentinelprint-collector
FROM node:22-slim

WORKDIR /app

# Only the deps the scanner + agent need (keeps the image small).
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund net-snmp@3.20.0 \
  && npm install --no-audit --no-fund tsx@4.19.2

# Scan engine + agent source.
COPY src/lib/scanner ./src/lib/scanner
COPY agent ./agent

ENV POLL_INTERVAL_MS=5000
CMD ["npx", "tsx", "agent/collector.ts"]
