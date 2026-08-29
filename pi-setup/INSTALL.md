# Installing ARI Lecco CAD on a Raspberry Pi

Two ways to get from a blank SD card to a running CAD server.

## Option A -- flash the prebuilt appliance image (recommended, zero-touch)

Every [GitHub Release](https://github.com/dlanfranconi/ARI-Lecco-CAD/releases) includes `ari-lecco-cad-pi-vX.Y.Z.img.xz` -- a Raspberry Pi OS image that provisions itself completely on first boot via [cloud-init](https://cloudinit.readthedocs.io/). No SSH, no typing, no Raspberry Pi Imager customization dialog needed.

1. Download the `.img.xz` and flash it with [Raspberry Pi Imager](https://www.raspberrypi.com/software/) ("Use custom" -> pick the file) or `balenaEtcher`. Skip Imager's OS customization dialog entirely -- the image already has everything set, and running that dialog would just overwrite it.
2. Insert the card, connect the Pi to your network over **Ethernet** (the image has no Wi-Fi credentials preloaded), and power it on.
3. Wait 3-5 minutes for first boot -- installing Docker and pulling the CAD image takes most of that. Then open `http://cad-server.local` from any device on the same network.
4. Log in with `dispatch` / `dispatch` -- the app forces a password change immediately.

The Pi's own OS login (console or SSH, `ssh pi@cad-server.local`) defaults to `pi` / `arilecco` and also forces a password change on first login, independent of the app. Change it the first time you actually SSH in.

To use Wi-Fi instead of Ethernet, or change the default mDNS hostname before first boot: insert the freshly-flashed card into a PC and edit `user-data` / `network-config` on the small boot partition (plain text, cloud-init format) before powering on the Pi.

Built by `pi-setup/build-pi-image.py` in CI on every version tag -- see that script if you need to reproduce or modify the image yourself.

## Option B -- bootstrap script over SSH (existing install)

Use this if you already have Raspberry Pi OS installed and reachable over SSH -- e.g. you flashed and customized it yourself via Raspberry Pi Imager's own settings dialog (hostname, SSH, Wi-Fi).

1. Insert the SD card into the Pi and power it on. Give it a minute to boot.
2. SSH in (`ssh <user>@<hostname-or-ip>`), then run:
   ```bash
   curl -fsSL https://github.com/dlanfranconi/ARI-Lecco-CAD/releases/latest/download/bootstrap.sh | sudo sh
   ```
3. Wait for it to finish -- it installs Docker, then pulls and starts the CAD server. First run takes a few minutes depending on your connection.

## After it's running

- Open `http://cad-server.local` (or the Pi's IP address) from any device on the same network.
- Default login is `dispatch` / `dispatch` -- change the password from Configuration before using it for anything real.
- Everything (`docker-compose.yml`, `.env`, and the persistent data volume) lives under `/opt/ari-lecco-cad` on the Pi.

## Updating later

Re-running `bootstrap.sh` is safe -- it won't overwrite your existing `.env`/`docker-compose.yml` or touch your data. To pull a newer image version:

```bash
cd /opt/ari-lecco-cad
docker compose pull
docker compose up -d
```
