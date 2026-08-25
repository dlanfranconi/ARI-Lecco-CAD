# Installing ARI Lecco CAD on a Raspberry Pi

Two ways to get from a blank SD card to a running CAD server. Both start the same way:

1. Download [Raspberry Pi Imager](https://www.raspberrypi.com/software/) and flash **Raspberry Pi OS Lite (64-bit)** to the SD card.
2. Before writing, open the gear icon / "Edit Settings" (Ctrl+Shift+X) in Imager and set: a hostname, enable SSH (with a password or your public key), and Wi-Fi if the Pi isn't on Ethernet. This is all built into Imager -- no extra tools needed.

Then pick one of the two paths below.

## Path A -- one command over SSH (simplest)

1. Insert the SD card into the Pi and power it on. Give it a minute to boot.
2. SSH in (`ssh <user>@<hostname-or-ip>`), then run:
   ```bash
   curl -fsSL https://github.com/dlanfranconi/ARI-Lecco-CAD/releases/latest/download/bootstrap.sh | sudo sh
   ```
3. Wait for it to finish -- it installs Docker, then pulls and starts the CAD server. First run takes a few minutes depending on your connection.

## Path B -- zero manual SSH (drop the script on the boot partition)

If you'd rather not SSH in at all:

1. After flashing (before ejecting), the SD card's boot partition is mounted on your computer. Copy `bootstrap.sh` from this release onto that boot partition.
2. Also drop this onto the boot partition as `firstrun-append.sh` isn't automatic on stock images -- the reliable way is to append a line to the Imager-generated `firstrun.sh` on that same partition so it runs our script too:
   ```bash
   echo 'sh /boot/firmware/bootstrap.sh' >> /boot/firmware/firstrun.sh
   ```
   (path is `/boot/firmware/` on Bookworm-based images; older images use `/boot/`)
3. Eject the SD card, insert it into the Pi, and power it on. No further steps -- it provisions itself on first boot.

## After it's running

- Open `http://ari-cad.local` (or the Pi's IP address) from any device on the same network.
- Default login is `dispatch` / `dispatch` -- change the password from Configuration before using it for anything real.
- Everything (`docker-compose.yml`, `.env`, and the persistent data volume) lives under `/opt/ari-lecco-cad` on the Pi.

## Updating later

Re-running `bootstrap.sh` is safe -- it won't overwrite your existing `.env`/`docker-compose.yml` or touch your data. To pull a newer image version:

```bash
cd /opt/ari-lecco-cad
docker compose pull
docker compose up -d
```
