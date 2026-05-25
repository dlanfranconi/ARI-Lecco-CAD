# ARI Lecco CAD

Internal web-based computer aided dispatch app for race and event operations.

## What is included

- Dispatch log with persistent SQLite storage
- Editable race setup for users/operators and APRS stations
- User dropdown with tactical callsign/location, operator callsign, status, and free-text location
- Optional APRS station assignment per user
- Latest APRS position attached to log entries when available
- Bulletin request workflow for non-dispatch users
- Dispatch approval queue with pop-up alert for new bulletin requests
- Announcer display that updates live over WebSocket with polling fallback
- CSV log export, APRS waypoint CSV export, and GeoJSON waypoint export
- Clear race data after export
- Docker and Portainer-friendly deployment

## Quick start with Docker Compose

```bash
cp .env.example .env
docker compose up --build
```

Open:

- Dispatch app: `http://SERVER-IP:8000`
- Announcer view: `http://SERVER-IP:8000/announcer`
- Bulletin submission: `http://SERVER-IP:8000/bulletin-submit`


## Prebuilt Docker Image

After changes are pushed to `main`, GitHub Actions publishes:

```text
ghcr.io/dlanfranconi/ari-lecco-cad:latest
```

Portainer stack using the prebuilt image:

```yaml
services:
  cad:
    image: ghcr.io/dlanfranconi/ari-lecco-cad:latest
    container_name: ari-lecco-cad
    restart: unless-stopped
    environment:
      CAD_ADMIN_USERNAME: dispatch
      CAD_ADMIN_PASSWORD: change-me
      SESSION_SECRET: replace-with-a-long-random-string
      APRSFI_API_KEY: ""
      APRS_POLL_SECONDS: 60
      DRATS_INGEST_TOKEN: change-this-token
      DATABASE_PATH: /data/cad.sqlite3
    ports:
      - "8000:8000"
    volumes:
      - ari-lecco-cad-data:/data

volumes:
  ari-lecco-cad-data:
```

Change `CAD_ADMIN_PASSWORD`, `SESSION_SECRET`, and `APRSFI_API_KEY` in Portainer before race use.

## Portainer

Create a new stack using `docker-compose.yml`.

Recommended persistent bind mount:

```text
./data:/data
```

Set environment variables in Portainer or copy `.env.example` to `.env`.

## APRS.fi

Set an APRS.fi API key:

```bash
APRSFI_API_KEY=your-key-here
```

You do not need the full station list at build time. Add stations in the setup page before each race, then assign a station to each user/operator as needed.

The app stores APRS positions locally while polling, so post-race exports can include waypoint history.

## Default Login

Configured in `.env`:

```bash
CAD_ADMIN_USERNAME=dispatch
CAD_ADMIN_PASSWORD=change-me
```

Change the password before real use, even on an internal network.


## D-RATS / D-STAR Position Ingest

The CAD app accepts D-STAR GPS positions from a D-RATS helper, D-PRS bridge, or other local script over HTTP:

```bash
curl -X POST http://SERVER-IP:8000/api/dstar/positions \
  -H "Content-Type: application/json" \
  -H "X-D-RATS-Token: change-this-token" \
  -d '{"callsign":"IU2ABC","lat":45.85,"lon":9.39,"source":"d-rats"}'
```

Set `DRATS_INGEST_TOKEN` in Portainer to require that token. Assign the same D-STAR callsign to a user in Setup, and new log entries from that user will attach the latest D-STAR or APRS position available.
