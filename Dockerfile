FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Baked in at build time so the running app can show which build it actually
# is — CI passes the real branch and commit; local `docker compose up
# --build` without them just shows "dev". This is what tells apart a stale
# deployment from an updated one without digging through SSH.
ARG GIT_SHA=dev
ARG GIT_REF=local
ENV APP_GIT_SHA=${GIT_SHA}
ENV APP_GIT_REF=${GIT_REF}

WORKDIR /app

COPY requirements.txt .
RUN apt-get update && apt-get install -y --no-install-recommends tzdata iputils-ping iperf3 && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

RUN mkdir -p /data
VOLUME ["/data"]

ENV PORT=80
EXPOSE 80 443

# exec form with an explicit `exec` inside the shell: still expands ${PORT}
# for runtime overrides, but uvicorn replaces the shell as PID 1 instead of
# running as its child, so it receives SIGTERM directly for a clean shutdown
# (including unregistering the mDNS advertisement) instead of the shell
# swallowing the signal until Docker's kill timeout.
CMD ["/bin/sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]

