# SmartSurf public sites

`hardware.html` and `app.html` are the homepage content templates. Run
`node scripts/build-public-sites.mjs` after editing either template or the
commerce catalog. Both pages use one header, footer and pricing source. Output:
`pages/SmartSurf.dc.html` and `public-smartsurf/index.html`.

Shared appearance: `public-smartsurf/site.css`, `brand-identity.css`, `site.js`
and the existing shield/wave brand assets. The public pages are static HTML;
account and operational pages retain their existing runtime and API contracts.

`pages/` contains the separately hosted marketing pages imported from the live
site before the September 28 brand release. `sync-public-brand.mjs` applies the
mechanical logo/colour migration to those legacy pages. Photographs remain in
the existing landing asset directory and are not altered.

Deployment: back up the live landing directory, build the public homepages,
copy `pages/*` to `/var/www/smartsurf-landing/`, and copy the three shared files
and required brand assets there. Build/recreate the static UI container from
`Dockerfile.ui`. `/terms` and `/privacy` should redirect to their static `.html`
counterparts to keep legal-page branding on the same UI release.

Position SmartSurf around water-sports safety and situational awareness: track
the rider, give the board its own position, watch configured conditions, and
explain meaningful changes using available evidence. Lead with the SmartSurf
Tracker as the physical anchor and the Companion as the rider-side interface.
Use SmartSurf app, SmartSurf Tracker, Rider + Board Duo, Intelligence Pro and
Schools & instructors consistently. Keep Senlay as supporting attribution.

Voice: practical, clear, rider-first. Text-based SmartSurf answers and scheduled
condition Watchdogs are available. End-to-end spoken Companion alerts, wake-word
activation and conversational Voice Copilot are in development; do not present
them as released. Describe actions and available evidence, and state when data
is missing or stale.
Use cyan/aqua brand actions on both sites; amber/red retain status meanings.
All examples must say they are illustrative. Roadmap features are labelled as
in development. Never present static values as live measurements.
