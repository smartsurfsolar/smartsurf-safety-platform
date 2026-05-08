# SmartSurf Architecture

## Principle

Traccar is the engine. SmartSurf is the product. Senlay is the intelligence layer.

Users should see one SmartSurf-branded application and one login.

## Traccar Responsibilities

- account login
- users
- devices
- live positions
- WebSocket position feed
- map and history
- events

## SmartSurf Responsibilities

- rider profile
- gear profile
- device semantic mapping
- watersports sessions
- risk engine
- incident/SOS lifecycle
- local spot safety network
- Senlay environmental context

## Senlay Responsibilities

- wind
- gusts
- waves
- tides/currents where available
- terrain/coastal context
- air quality
- source/freshness/confidence
- physical-world risk notes

## Current MVP Integration

The current UI stores SmartSurf data in Traccar user attributes:

- `smartsurf.riderProfile`
- `smartsurf.safetySettings`
- `smartsurf.gearProfile`
- `smartsurf.deviceMappings`
- `smartsurf.sessions`
- `smartsurf.incidents`

This is practical for a first one-login prototype.

The database already includes `smartsurf_` tables so a later backend can move this data out of attributes without changing product concepts.

## Next Backend Step

Add SmartSurf API endpoints inside a small backend layer or Traccar server extension:

- `GET /api/smartsurf/profile`
- `PUT /api/smartsurf/profile`
- `GET /api/smartsurf/gear`
- `PUT /api/smartsurf/gear`
- `GET /api/smartsurf/devices`
- `PUT /api/smartsurf/devices`
- `POST /api/smartsurf/sessions`
- `POST /api/smartsurf/incidents`
- `GET /api/smartsurf/senlay-context`

That backend should read Traccar user/device/position data and write `smartsurf_` tables.

## Risk Engine v1

The first SmartSurf safety model follows a watersports safety research synthesis.
The app treats risk as an interaction between rider profile, gear, spot geometry,
live environment, session telemetry, and official/local overrides.

Core hazard classes:

- land-phase power control
- lofting or dragging
- offshore drift
- equipment or board separation
- rip or current entrapment
- impact-zone hold-down
- bottom, reef, or shorebreak impact
- collision
- cold-water or fatigue risk
- convective weather intrusion
- low visibility or daylight overrun

Initial telemetry/risk categories:

- wind_too_light
- wind_too_strong
- gust_factor_high
- offshore_wind_risk
- drift_risk
- prolonged_stop
- no_recovery
- distance_from_launch_high
- current_risk
- swell_risk
- shorebreak_risk
- terrain_turbulence_risk
- low_battery_risk
- sunset_risk
- no_signal_risk

Output:

- `status` as Go, Caution, or No-Go
- `overall_risk_level`
- `risk_score`
- `confidence`
- `reasons[]`
- `hardStops[]`
- `cautions[]`
- `missingCriticalData[]`
- `topHazards[]`
- `uncertaintyNotes[]`
- `recommended_action`

Hard-stop examples:

- thunder, lightning, waterspout risk, or special marine warning
- red flag, beach closure, water closure, or local no-entry notice
- wind clearly above the rider skill, gear, or rescue configuration
- strong offshore or side-offshore exposure without local support
- manual SOS or unresolved incident state

## Incident Flow

1. trigger detected
2. rider check prompt
3. countdown
4. if no response, alert trusted contacts
5. if enabled, alert station/local helper network
6. update position until resolved

Use cautious wording:

- "possible incident"
- "automated alert"
- "risk detected"
- "last known location"

Avoid:

- "confirmed emergency" unless manually triggered
- "guaranteed rescue"
- public live identity exposure
