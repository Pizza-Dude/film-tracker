FROM python:3.11-slim

WORKDIR /app

COPY server.py .
COPY static/ static/
COPY server/ server/
COPY docker-entrypoint.sh /docker-entrypoint.sh

RUN mkdir -p server \
    && touch server/data.json \
    && chmod +x /docker-entrypoint.sh

ENV PORT=4519
EXPOSE 4519

ENTRYPOINT ["/docker-entrypoint.sh"]
