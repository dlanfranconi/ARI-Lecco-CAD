# ARI Lecco CAD

Internal web-based computer aided dispatch app for race and event operations.

## What is included

- Race log with persistent SQLite storage
- Editable race setup for users/operators and APRS stations
- User dropdown with tactical callsign/location, operator callsign, status, and free-text location
- Optional APRS station assignment per user
- Latest APRS position attached to log entries when available
- Notice request workflow for non-dispatch users
- Dispatch approval queue with pop-up alert for new notice requests
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
- Notice submission: `http://SERVER-IP:8000/submit-notification`


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

D-RATS runs on the radio PC. The CAD app runs on the server. To move D-STAR GPS positions into CAD, the radio PC must POST each received position to the CAD server.

In Portainer, set a shared token:

```yaml
DRATS_INGEST_TOKEN: change-this-token
```

The CAD endpoint is:

```text
POST http://SERVER-IP:8000/api/dstar/positions
```

JSON payload:

```json
{
  "callsign": "IU2ABC",
  "lat": 45.85,
  "lon": 9.39,
  "source": "d-rats",
  "comment": "optional"
}
```

Manual test from the D-RATS PC:

```bash
python3 scripts/post_dstar_position.py \
  --cad-url http://SERVER-IP:8000 \
  --token change-this-token \
  --callsign IU2ABC \
  --lat 45.85 \
  --lon 9.39
```

Or with curl:

```bash
curl -X POST http://SERVER-IP:8000/api/dstar/positions \
  -H "Content-Type: application/json" \
  -H "X-D-RATS-Token: change-this-token" \
  -d '{"callsign":"IU2ABC","lat":45.85,"lon":9.39,"source":"d-rats"}'
```

In CAD Setup, assign the same D-STAR callsign to the user/operator. New log entries from that user will attach the latest available APRS or D-STAR position.

D-RATS itself does not currently expose a simple built-in HTTP push target for CAD. The bridge can be fed from whatever source is available on the D-RATS PC: a D-RATS export, a local script that reads D-RATS position data, or a D-PRS/D-STAR GPS utility that can call a command when a GPS frame arrives.


Continuous D-RATS feed watcher:

```bash
python3 scripts/watch_dstar_positions.py \
  --cad-url http://SERVER-IP:8000 \
  --token change-this-token \
  --file dstar_positions.csv
```

Append rows to `dstar_positions.csv` in this format:

```csv
IU2ABC,45.85,9.39,optional comment
```

Any D-RATS-side helper, D-PRS utility, or radio software that can write received GPS frames as CSV can feed that file.

## Runner CSV Import

Import runners from Setup using a CSV with these headers:

```csv
bib number,name,home town
101,Mario Rossi,Lecco
```

When submitting a notice, enter the bib number and select a checkpoint. CAD will populate a notice like:

```text
Runner Mario Rossi is arriving to CP1.
```

Italian mode uses the Italian arrival template.


## Archive Downloads

When starting a new race or using Clear All, enter an archive filename such as:

```text
race-name-final.json
```

The app archives active logs, notices, APRS positions, and D-STAR positions, clears the active race data, then redirects the browser to download the archive file to the local PC you are using.

Archived races also remain browsable from Setup.

## Athlete Management

Setup supports CSV import and manual add/edit/disable for athletes. CSV headers:

```csv
bib number,name,home town
101,Mario Rossi,Lecco
```
