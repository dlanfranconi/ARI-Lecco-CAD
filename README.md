# ARI Lecco CAD

Internal web-based computer aided dispatch app for race and event operations.

## What is included

- Race log with persistent SQLite storage, live on every open tab/device — no manual refresh needed for the race timer, dispatch log, or notice queue
- Editable race setup for users/operators and APRS stations
- User dropdown with tactical callsign/location, operator callsign, status, and free-text location
- Optional APRS station assignment per user
- Latest APRS position attached to log entries when available
- Notice request workflow for non-dispatch users
- Dispatch approval queue with pop-up alert for new notice requests
- Announcer display that updates live over WebSocket with polling fallback
- CSV log export, APRS waypoint CSV export, and GeoJSON waypoint export
- Clear race data after export
- Network device monitoring with live up/down status and alerts (Network page)
- iperf3 link-quality testing between the server and remote radio sites
- Phone/device speed test against the dispatch server, right from the Network page
- Server discovery on the LAN via mDNS (`ari-cad.local`) — no IP hunting
- Optional HTTPS with an auto-generated self-signed certificate
- Android app (see "Mobile App" below) with offline-safe server picker, persistent login, and a native back button that behaves like an app instead of a browser
- Build version shown in the page footer, so you can tell at a glance which build a device is actually running
- Docker and Portainer-friendly deployment

## Quick start with Docker Compose

```bash
cp .env.example .env
docker compose up --build
```

Open:

- Dispatch app: `http://SERVER-IP`
- Announcer view: `http://SERVER-IP/announcer`
- Notice submission: `http://SERVER-IP/submit-notification`

The app listens on port 80 by default, so no port number is needed in the URL. Set `PORT` in `.env` to change it (e.g. if something else on the host already uses 80).


## Prebuilt Docker Image

GitHub Actions builds and publishes an image on every push to `main` or `WIP`:

```text
ghcr.io/dlanfranconi/ari-lecco-cad:latest   # from main — the actual release
ghcr.io/dlanfranconi/ari-lecco-cad:wip      # from WIP — for testing before a release
```

Both tags also get a `:<git-sha>` build for pinning to an exact commit. Use `:wip` to test in-progress work on Portainer before merging `WIP` into `main` to cut a real release — `:latest` only ever moves when `main` does.

Portainer stack using the prebuilt image:

```yaml
services:
  cad:
    image: ghcr.io/dlanfranconi/ari-lecco-cad:latest
    container_name: ari-lecco-cad
    restart: unless-stopped
    # Host networking so mDNS (ari-cad.local) can reach the LAN. Linux Docker
    # host only; needs port 80 free on the host. See "Server Discovery (mDNS)" below.
    network_mode: host
    environment:
      CAD_ADMIN_USERNAME: dispatch
      CAD_ADMIN_PASSWORD: dispatch
      SESSION_SECRET: replace-with-a-long-random-string
      APRSFI_API_KEY: ""
      APRS_POLL_SECONDS: 60
      DRATS_INGEST_TOKEN: change-this-token
      TZ: Europe/Rome
      LANG: it_IT.UTF-8
      NTP_SERVER: pool.ntp.org
      DATABASE_PATH: /data/cad.sqlite3
      MDNS_HOSTNAME: ari-cad
      PORT: 80
    volumes:
      - ari-lecco-cad-data:/data

volumes:
  ari-lecco-cad-data:
    # Explicit, fixed name — without this, Docker prefixes the volume with
    # the stack/project name (e.g. a stack named "cad" gets
    # "cad_ari-lecco-cad-data"). Redeploy under a different stack name, or
    # `docker compose up` from a differently-named folder, and Compose
    # silently creates a brand-new empty volume instead of reusing the old
    # one — your data isn't destroyed, just orphaned under its old name, and
    # it looks exactly like everything got wiped. Pinning the name here
    # means the volume is the same regardless of how you deploy it.
    name: ari-lecco-cad-data
```

Default first login is `dispatch` / `dispatch` when the database has no users. This bootstrap account is created even if `CAD_ADMIN_PASSWORD` is still set to an old value. Change the password in Setup, and change `SESSION_SECRET` and `APRSFI_API_KEY` in Portainer before race use.

### Which build is actually running?

Every page footer shows a version string, e.g. `vmain@a1b2c3d` (branch + short commit) or `vdev` for a local `docker compose up --build` without CI. This is what to check before assuming something is broken — an old, un-updated deployment showing old behavior isn't a bug, and the footer tells you that at a glance instead of needing to SSH in and diff files by hand.

## Server Discovery (mDNS)

The server advertises itself on the LAN as `ari-cad.local` (via mDNS/Bonjour) so users can type a name instead of hunting for an IP each race — this is what the mobile app's "server name" field resolves. Configure with:

```bash
MDNS_HOSTNAME=ari-cad   # results in ari-cad.local
MDNS_ENABLED=true       # set to false to disable
```

Requires `network_mode: host` in Docker (set above) since mDNS multicast doesn't cross Docker's default bridge network — under bridge networking the app still starts normally, but nothing on the LAN will see the advertisement. If two CAD servers run on the same network, give them different `MDNS_HOSTNAME` values.

## Network Tools (Network page)

The **Network** page (in the top nav) is a dashboard for the health of the network the race actually runs on — separate from race data. Device status, events, and iperf3 targets are admin-managed, but any signed-in user/operator can view status and run tests, since the point is letting operators self-test from wherever they're standing, not just admins at a desk.

### Device monitoring

Add a device by name and IP address; the server pings it every `NETWORK_MONITOR_POLL_SECONDS` (default 30) and shows live up/down status with a timestamp of the last check. Status changes appear instantly on every open Network page (no reload) with a toast notification, and are logged to a running events history. Optionally assign a device to notify a specific user — that's a label for now (shown in the events feed), not yet a push notification to a phone.

```bash
NETWORK_MONITOR_ENABLED=true
NETWORK_MONITOR_POLL_SECONDS=30
```

### iperf3 link-quality testing

For testing actual throughput on the PTMP wireless links (not just reachability), add a target with the host/port of an `iperf3` server already running at that site:

```bash
# On the radio-side PC/Pi at each site you want to test:
iperf3 -s
```

Then click **Run Test** next to that target on the Network page — the CAD server runs `iperf3 -c <host>` and shows the result (Mbps) inline, with history. This needs an `iperf3` server actually running at the far end; the CAD server only acts as the client. `IPERF_TEST_SECONDS` (default 5) controls how long each test runs.

### Speed test

At the top of the Network page, **Run Test** under Speed Test measures download/upload throughput and latency between the current device (phone, laptop, whatever you're viewing the page on) and the dispatch server itself. This is a plain HTTP-based test (not iperf3 protocol) so it works from any browser or the mobile app with no extra software — a good quick "is my connection to dispatch actually OK" check from wherever an operator is standing.

## HTTPS (Optional)

Off by default. The server can also listen on a second port over HTTPS, using a self-signed certificate it generates itself on first start and reuses across restarts (stored under `CERT_DIR`, inside the persistent data volume by default):

```bash
HTTPS_ENABLED=false   # set to true to enable
HTTPS_PORT=443
CERT_DIR=/data/certs
```

Since it's self-signed (not from a public CA — there's no public domain to get one for on a private LAN), browsers and the app will show a one-time "not trusted" warning; proceed/trust it. There's no way around that without either a real public domain or manually installing the certificate as trusted on every device, so this is expected, not a bug.

**Known limitation:** HTTP and HTTPS currently run as two separate server processes (needed to work around an environment-specific bug — see the `62c8c12`/`7defca9` commit history if curious). This means live WebSocket updates (new notices, device status, race timer) only reach clients connected via whichever port/protocol they're actually using — an HTTP tab and an HTTPS tab won't see each other's live updates instantly, though both still get correct data on every page load/reload.

## Time Zone and NTP

Set `TZ` to the race location timezone, for example `Europe/Rome`. The app also exposes Time Zone, Locale, and NTP Server fields in Configuration. `NTP_SERVER` defaults to `pool.ntp.org`; on an isolated race network, set it to your local NTP server. The host or VM should still be configured to sync system time to that NTP source.

## Portainer

Create a new stack using `docker-compose.yml`.

Recommended persistent bind mount:

```text
./data:/data
```

Set environment variables in Portainer or copy `.env.example` to `.env`.

### Host networking (required for mDNS) — what to expect

`docker-compose.yml` uses `network_mode: host`, which is what makes `ari-cad.local` work on the LAN. It also changes how the container gets its port, in ways that trip people up if you don't know to expect them:

- **There is no "Published Ports" mapping.** With `network_mode: host` the container talks directly on the host's own network — Portainer will not show a ports field for it, and that's correct, not a bug. Don't add a `ports:` entry back in; it's ignored (and can mask real conflicts) under host networking.
- **Port 80 (or whatever `PORT` is set to) must be completely free on the host itself** before the container starts — not "free inside Docker," free on the actual machine. Anything already listening on that port (including an old copy of this same container that didn't fully stop, or another web service on the host) will make the new one fail immediately with:
  ```text
  ERROR: [Errno 98] error while attempting to bind on address ('0.0.0.0', 80): address already in use
  ```
  Port 80 is convenient (no port number in the URL) but it's also the most commonly-used web port on a machine — if the host already runs something else on 80 (a reverse proxy, Pi-hole's UI, another app), set `PORT` to something else, e.g. `8420`, in your environment.
- **Linux Docker hosts only.** Docker Desktop on Mac/Windows doesn't support real host networking. If you're deploying there, see "Don't want host networking?" below instead.
- Binding to port 80 needs root privileges; the container already runs as root internally, so this works out of the box — nothing extra to configure.

### Fixing "address already in use"

This almost always means something is already bound to the port you're deploying on — most commonly an older `ari-lecco-cad` container still running (right after switching a stack to `network_mode: host`, or after a Portainer update that didn't fully clean up the previous container), or another service that happens to already use port 80.

1. In Portainer, go to **Containers** and look for any container named `ari-lecco-cad`. If you see more than one, or one that's still `running` from before your update, select it and **Stop**, then **Remove** it.
2. Go back to **Stacks**, open this stack, and click **Update the stack** (or **Deploy**) again.
3. Still failing, or not sure which container it is? SSH into the Docker host and run (substitute your port if you changed `PORT`):
   ```bash
   docker ps --filter "publish=80"
   ```
   This finds the exact container still holding the *old* bridge-mode port mapping (its logs will show a `docker-proxy` process if you check with `sudo ss -tlnp | grep :80` — that process is Docker's own port-forwarder for a bridged container, confirming it's a leftover container and not some unrelated service). Stop and remove it:
   ```bash
   docker stop <name-or-id>
   docker rm <name-or-id>
   ```
   Then redeploy the stack. If `docker ps --filter "publish=80"` comes back empty, something *other* than Docker is on that port — stop that service, or set `PORT` to something else in your environment (e.g. `PORT=8420`) and redeploy.

### Don't want host networking?

If you're on Docker Desktop, don't need `ari-cad.local`, or just want the simpler/safer setup: delete the `network_mode: host` line from your stack and add back a normal port mapping instead:

```yaml
    # network_mode: host   <- remove this line
    ports:
      - "80:80"             <- add this instead
```

Everything works the same except mDNS discovery — users will need to type the server's actual IP address into the app instead of `ari-cad.local`. Docker fully manages the port for you this way, so the "address already in use" failure mode above doesn't happen (Docker will just tell you clearly if the port is taken, rather than the container silently trying to bind the whole host's network).

## Raspberry Pi

The easiest way to run a dedicated CAD server is a Raspberry Pi (3B+ or newer, 64-bit) — cheap, low-power, and easy to carry to a race site. Two ways to set one up, from easiest to most flexible:

### Option A: Flash the prebuilt appliance image (recommended)

Every [GitHub Release](https://github.com/dlanfranconi/ARI-Lecco-CAD/releases) includes `ari-lecco-cad-pi-vX.Y.Z.img.xz` — a Raspberry Pi OS image that provisions itself completely on first boot. No SSH, no typing, no Raspberry Pi Imager customization dialog needed.

1. Download the `.img.xz` from the release and flash it to a microSD card with [Raspberry Pi Imager](https://www.raspberrypi.com/software/) ("Use custom" → pick the file) or `balenaEtcher` — don't use Imager's OS customization dialog, the image already has everything set.
2. Insert the card, connect the Pi to your network with an **Ethernet cable** (the image doesn't have Wi-Fi credentials preloaded), and power it on.
3. Wait 3–5 minutes for first boot (installing Docker and pulling the image takes most of that). Then open `http://ari-cad.local` from any device on the same network.
4. Log in with `dispatch` / `dispatch` — you'll be required to change the password immediately.

The Pi's own OS login (console or SSH, e.g. `ssh pi@ari-cad.local`) defaults to `pi` / `arilecco` and **also forces a password change on first login**, independent of the app's own login. Change it the first time you actually SSH in.

To add Wi-Fi instead of Ethernet, or to change the default mDNS hostname before first boot, insert the flashed card into a PC and edit `user-data` / `network-config` on the small boot partition (plain text, [cloud-init](https://cloudinit.readthedocs.io/) format) before powering on the Pi.

### Option B: Bootstrap script on an existing install

If you already have Raspberry Pi OS installed and reachable over SSH (e.g. flashed and configured yourself via Raspberry Pi Imager's own customization dialog), run:

```bash
curl -fsSL https://github.com/dlanfranconi/ARI-Lecco-CAD/releases/latest/download/bootstrap.sh | sudo sh
```

This installs Docker, generates a random session secret, and starts the CAD container the same way Option A's image does under the hood — see `pi-setup/INSTALL.md` for details and the full `pi-setup/` bundle attached to each release.

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
CAD_ADMIN_PASSWORD=dispatch
```

Change the password before real use, even on an internal network.

## Mobile App (Android)

The `mobile/` folder is a [Capacitor](https://capacitorjs.com) project that wraps this same web app in a native Android shell — it's not a separate app with its own UI, it's a thin WebView that connects to your actual dispatch server. There's no bundled offline UI beyond a one-time "enter server name" connect screen.

### Building the APK

Requires Node.js, a JDK (17 or 21; **not** the very latest JDK — Gradle doesn't support brand-new JDKs immediately after release), and the Android SDK command-line tools.

```bash
cd mobile
npm install
npx cap sync android
cd android
./gradlew assembleDebug
```

The debug APK is written to `mobile/android/app/build/outputs/apk/debug/app-debug.apk`. Sideload it (`adb install -r app-debug.apk`, or copy it to the phone and open it — you'll need to allow "install unknown apps" for whichever app you use to open it, since this isn't a Play Store build).

### How it connects

On first launch, the app asks for a server name or IP — type the mDNS name (`ari-cad.local`) or the server's IP address; no port needed if the server's on the default port 80. It checks reachability, then hands off into the live server's own pages, same as a browser would. Login persists for 30 days (a real session cookie, not stored credentials), so you generally only log in once per install.

### Behavior specific to the app

- **Back button**: goes to the dispatch home screen from anywhere else in the app (Announcer, Setup, Network, etc.) instead of leaving the app or walking backward through page history. From the home screen, back twice within 2 seconds exits the app.
- **No service worker**: the app doesn't use the same offline-caching mechanism the web version does (there's no benefit to it in an already-installed native app, and it caused real staleness bugs early on — see commit history if curious). If a page looks stale after a deploy, relaunching the app or reinstalling the APK covers it.
- **`target="_blank"` links** (like the Announcer link, which opens a second tab on desktop) are automatically rewritten to navigate in place instead — there's no tab UI in a WebView for a "new tab" to land on.
- **Logout** lives in the same dropdown menu as the rest of the nav (see below), not a separate native UI element.

### Responsive nav

On any narrow screen (web or app, under ~860px wide) the top navigation collapses into a hamburger menu — tap it to open, tap outside or a link to close. This isn't Android-specific; a phone browser gets the same treatment.

## D-RATS / D-STAR Position Ingest

D-RATS runs on the radio PC. The CAD app runs on the server. To move D-STAR GPS positions into CAD, the radio PC must POST each received position to the CAD server.

In Portainer, set a shared token:

```yaml
DRATS_INGEST_TOKEN: change-this-token
```

The CAD endpoint is:

```text
POST http://SERVER-IP/api/dstar/positions
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
  --cad-url http://SERVER-IP \
  --token change-this-token \
  --callsign IU2ABC \
  --lat 45.85 \
  --lon 9.39
```

Or with curl:

```bash
curl -X POST http://SERVER-IP/api/dstar/positions \
  -H "Content-Type: application/json" \
  -H "X-D-RATS-Token: change-this-token" \
  -d '{"callsign":"IU2ABC","lat":45.85,"lon":9.39,"source":"d-rats"}'
```

In CAD Setup, assign the same D-STAR callsign to the user/operator. New log entries from that user will attach the latest available APRS or D-STAR position.

D-RATS itself does not currently expose a simple built-in HTTP push target for CAD. The bridge can be fed from whatever source is available on the D-RATS PC: a D-RATS export, a local script that reads D-RATS position data, or a D-PRS/D-STAR GPS utility that can call a command when a GPS frame arrives.


Continuous D-RATS feed watcher:

```bash
python3 scripts/watch_dstar_positions.py \
  --cad-url http://SERVER-IP \
  --token change-this-token \
  --file dstar_positions.csv
```

Append rows to `dstar_positions.csv` in this format:

```csv
IU2ABC,45.85,9.39,optional comment
```

Any D-RATS-side helper, D-PRS utility, or radio software that can write received GPS frames as CSV can feed that file.

## Runner CSV Import

Import runners from Setup using a CSV file. The recommended template is:

```csv
bib_number,first_name,last_name,hometown
101,Mario,Rossi,Lecco
102,Giulia,Bianchi,Como
103,Luca,Verdi,
```

`hometown` is optional. If it is blank, the announcer page does not show a city/location column for that athlete.

The importer also accepts older/simple headers, including `bib number,name,home town`, `bib,name,hometown`, and common Italian headers such as `pettorale,nome,cognome,citta`. CSV files may use comma, semicolon, or tab delimiters. After import, Setup shows how many rows were imported and how many were skipped. Rows are skipped when CAD cannot find both a bib number and a usable name.

When submitting a notice, enter the bib number and select a checkpoint. CAD will populate a notice using the configured athlete name display setting. Italian mode uses the Italian arrival template.


## Archive Downloads

When starting a new race or using Clear All, enter an archive filename such as:

```text
race-name-final.json
```

The app archives active logs, notices, APRS positions, and D-STAR positions, clears the active race data, then redirects the browser to download the archive file to the local PC you are using.

Archived races also remain browsable from Setup.

## Athlete Management

Setup supports CSV import and manual add/edit/disable/delete for athletes. Importing a CSV replaces the athlete list: matching bib numbers are updated, new bib numbers are added, and athletes whose bib numbers are not present in the uploaded CSV are removed. Recommended CSV headers:

```csv
bib_number,first_name,last_name,hometown
101,Mario,Rossi,Lecco
```

The included template is `examples/athlete-list-template.csv`.


## Checkpoint Prepositions

Tactical callsigns/checkpoints can include a preposition in Setup, such as `to`, `a`, `al`, or `alla`. Runner notices use that value when auto-generating arrival messages.


## Tactical Callsigns

Tactical callsigns persist between races. Manage them in Setup: add, edit, disable, or remove them. Removing a tactical callsign unassigns it from users/operators but does not delete those users.
