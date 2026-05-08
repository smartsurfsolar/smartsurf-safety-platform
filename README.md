# SmartSurf Safety Platform

SmartSurf is a watersports safety and tracking platform built on top of Traccar and connected to Senlay for physical-world context.

This public repository contains the reproducible SmartSurf source, UI customization, database schema foundation, and deployment templates. It does not contain production secrets, databases, logs, certificates, live backups, or server-only runtime files.

## Product Summary

SmartSurf combines:

- one SmartSurf-branded login powered by Traccar authentication
- live GPS tracking and map history
- rider profile, gear profile, and safety profile
- semantic device mapping for rider, board, helmet, school fleet, or future SmartSurf tracker
- Senlay Fusion environmental context for wind, gusts, waves, currents, tides, terrain, source freshness, and confidence
- pre-session "Can I ride now?" assessment
- safety context model for hard stops, caution rules, and incident escalation
- Local Safety Network foundation for opted-in rider/station awareness

Traccar is the tracking engine. SmartSurf is the watersports product. Senlay is the physical-world intelligence layer.

Official upstream references used for this build:

- Traccar Docker: https://www.traccar.org/docker/
- Traccar build/web app: https://www.traccar.org/build/#build-web-app
- Traccar Web source: https://github.com/traccar/traccar-web

## What Traccar Provides

- authentication
- users
- devices
- live positions
- history
- maps
- events and notifications

## What SmartSurf Adds

- rider profile
- gear profile
- SmartSurf semantic device mapping
- Senlay conditions panel
- pre-session assessment
- session model foundation
- incident/SOS model foundation
- Local Safety Network foundation

Senlay remains separate and is integrated through API/proxy calls. The browser does not need a Senlay API key in this public MVP setup.

## What Is Not Public

The following files and folders are intentionally excluded from GitHub:

- `.env`
- generated `traccar.xml`
- MySQL data volume
- logs
- live backups
- certificates and private keys
- API keys and production credentials
- built frontend artifacts
- `node_modules`

## Current Build Decision

There was no Traccar deployment on this server before this setup. The selected path is:

1. Clone and customize `traccar-web`.
2. Build the branded React/MUI web app.
3. Create a custom Docker image from `traccar/traccar:6.13.3`.
4. Replace `/opt/traccar/web` with the SmartSurf-branded build.
5. Run Traccar with MySQL and separate `smartsurf_` tables.

This keeps Traccar tracking/auth stable while making the user-facing app feel like SmartSurf.

## Folder Structure

```text
/opt/smartsurf-traccar/
  docker-compose.yml
  Dockerfile
  traccar.xml.template
  traccar.xml                 # generated locally, not committed
  .env.example
  .env                        # generated locally, not committed
  traccar-web/                # SmartSurf-customized Traccar web source
  mysql-init/                 # SmartSurf schema foundation
  logs/
  data/
  mysql/
  backups/
  scripts/
  docs/
```

## SmartSurf UI Added

Inside one Traccar login:

- `/` Dashboard
- `/map` Live Map
- `/smartsurf/sessions`
- `/smartsurf/conditions`
- `/smartsurf/rider-profile`
- `/smartsurf/gear`
- `/smartsurf/devices`
- `/smartsurf/safety`
- `/smartsurf/incidents`
- `/smartsurf/local-safety-map`

The Traccar settings and reports are still available because they are useful system tools, but they are no longer the main product surface.

## Data Storage

MVP UI storage:

- SmartSurf profile data is stored in Traccar user attributes.
- This gives one login and avoids custom backend work before the product flow is validated.

Database foundation:

- `mysql-init/01-smartsurf-schema.sql` creates separate SmartSurf tables with `smartsurf_` prefix.
- These tables prepare the product for a proper backend service layer without modifying Traccar core tables.

Prepared tables:

- `smartsurf_rider_profiles`
- `smartsurf_emergency_contacts`
- `smartsurf_safety_settings`
- `smartsurf_gear_kites`
- `smartsurf_gear_boards`
- `smartsurf_gear_foils`
- `smartsurf_tracking_devices`
- `smartsurf_spots`
- `smartsurf_sessions`
- `smartsurf_incidents`

## Senlay Integration

The SmartSurf Conditions page calls:

```text
/senlay-api/pwm?lat=...&lng=...
```

The nginx example proxies that path to the main Senlay service:

```text
http://127.0.0.1:3001/api/pwm
```

This keeps the browser from needing a Senlay API key in the first MVP. Later, a backend SmartSurf service should call Senlay using server-side credentials and store snapshots with sessions/incidents.

## First Run

```bash
cd /opt/smartsurf-traccar
scripts/init-env.sh
scripts/render-config.sh
cd traccar-web
npm install
npm run build
cd ..
docker compose build
docker compose up -d
docker compose logs -f smartsurf-traccar
```

The Traccar web UI is bound to localhost:

```text
http://127.0.0.1:8082
```

The Traccar Client/OsmAnd GPS ingest port is exposed:

```text
5055/tcp
```

Additional tracker protocol ports can be exposed later only when needed.

## Public Domain

Product domain:

```text
smartsurf.global
```

Use `nginx-smartsurf-global.example.conf` after DNS points to this server.

DNS must point to this VPS:

```text
smartsurf.global     A     194.233.72.55
www.smartsurf.global A     194.233.72.55
app.smartsurf.global A     194.233.72.55
api.smartsurf.global A     194.233.72.55
```

Do not expose `traccar.smartsurf.global` for the normal product. The main public product should use `smartsurf.global`, with `app.smartsurf.global` and `api.smartsurf.global` available as support hostnames.

The container is intentionally bound to localhost on `127.0.0.1:8082`. Public access should go through nginx + HTTPS.

Then run:

```bash
nginx -t
systemctl reload nginx
certbot --nginx -d smartsurf.global -d www.smartsurf.global -d app.smartsurf.global -d api.smartsurf.global
```

## Mobile Tracker Setup

Install Traccar Client on the phone.

Use:

- Server URL: `https://smartsurf.global` after DNS/SSL
- Device identifier: any unique rider/device id
- Protocol/port: Traccar Client/OsmAnd default, normally port `5055`
- Accuracy: high for testing
- Frequency: aggressive for test, conservative later

Create the same device identifier in SmartSurf/Traccar before testing.

## Backup

```bash
cd /opt/smartsurf-traccar
backups/backup.sh
```

The backup script dumps MySQL and archives reproducible config files.

## Migration

To move to another server:

1. Copy `/opt/smartsurf-traccar`.
2. Restore `mysql/` volume or import a MySQL dump.
3. Run `scripts/render-config.sh`.
4. Run `docker compose build && docker compose up -d`.
5. Recreate nginx/certbot config.

## Known Limitations

- SmartSurf data is currently stored in Traccar user attributes in the UI.
- The `smartsurf_` database tables are ready but need a small backend API layer to become authoritative.
- Senlay Conditions uses `/senlay-api/pwm` and falls back to a safe mock if proxy is not connected.
- Direct browser refresh on nested React routes should be handled by the public reverse proxy. Open the app from `/` until the nginx domain config is active.
- Auto-SOS detection is represented as a model and UI foundation; live detection from Traccar position streams is the next backend task.
- Local Safety Network is opt-in model/UI foundation only, not public broadcast.
