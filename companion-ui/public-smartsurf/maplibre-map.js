(function () {
  'use strict';

  const HTML_ENTITIES = {
    '&': '\u0026amp;',
    '<': '\u0026lt;',
    '>': '\u0026gt;',
    "'": '\u0026#39;',
    '"': '\u0026quot;'
  };

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>'"]/g, character => HTML_ENTITIES[character]);
  }

  function reportedNumber(value) {
    return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
  }

  const SPEED_COLOR_R = [0.13572138, 4.6153926, -42.66032258, 132.13108234, -152.94239396, 59.28637943];
  const SPEED_COLOR_G = [0.09140261, 2.19418839, 4.84296658, -14.18503333, 4.27729857, 2.82956604];
  const SPEED_COLOR_B = [0.1066733, 12.64194608, -60.58204836, 110.36276771, -89.90310912, 27.34824973];

  function speedColorChannel(value, coefficients) {
    let result = 0;
    for (let index = 0; index < coefficients.length; index += 1) result += coefficients[index] * value ** index;
    return Math.max(0, Math.min(1, result));
  }

  function speedColorAt(ratio) {
    const value = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0.5));
    return `rgb(${Math.round(255 * speedColorChannel(value, SPEED_COLOR_R))}, ${Math.round(255 * speedColorChannel(value, SPEED_COLOR_G))}, ${Math.round(255 * speedColorChannel(value, SPEED_COLOR_B))})`;
  }

  function alarmTime(alarm) {
    return alarm?.eventTime || alarm?.fixTime || alarm?.deviceTime || alarm?.serverTime || null;
  }

  function alarmPopup(alarm) {
    const name = escapeHtml(alarm.deviceName || 'Tracker');
    const type = escapeHtml(String(alarm.alarm || 'sos').toUpperCase());
    const time = escapeHtml(alarmTime(alarm) || 'time not reported');
    const position = `${Number(alarm.lat).toFixed(5)}, ${Number(alarm.lng).toFixed(5)}`;
    return `<div class="ss-tracker-popup ss-alarm-popup"><strong>${name}</strong><span class="ss-popup-status alarm">SOS alarm</span><small>Reported as ${type}</small><dl><dt>Alarm time</dt><dd>${time}</dd><dt>Position</dt><dd>${position}</dd></dl></div>`;
  }

  function focusPopup(focus) {
    const label = escapeHtml(focus.label || 'Alert location');
    const when = focus.when ? `<dt>Time</dt><dd>${escapeHtml(focus.when)}</dd>` : '';
    return `<div class="ss-tracker-popup"><strong>${label}</strong><span class="ss-popup-status">History</span><dl>${when}<dt>Position</dt><dd>${Number(focus.lat).toFixed(5)}, ${Number(focus.lng).toFixed(5)}</dd></dl></div>`;
  }

  function presentNumber(value, suffix, digits = 0) {
    return reportedNumber(value) ? `${Number(value).toFixed(digits)}${suffix}` : 'Not reported';
  }

  function positionSource(device) {
    if (device.positionSource === 'last_known') return 'Saved last-known';
    if (device.connectionStatus === 'unknown' || device.online == null) return 'Connection status unavailable';
    return device.online ? 'Live device feed' : 'Latest device report';
  }

  function connectionLabel(device) {
    if (device.connectionStatus === 'unknown') return 'Status unavailable';
    if (device.connectionStatus === 'online' || device.online === true) return 'Online';
    if (device.connectionStatus === 'offline' || device.online === false) return 'Offline';
    return 'Status unavailable';
  }

  function batteryVisual(position) {
    const reported = reportedNumber(position.batteryPercent);
    const level = reported ? Math.max(0, Math.min(100, Number(position.batteryPercent))) : 0;
    const tone = !reported ? 'missing' : level <= 20 ? 'bad' : level <= 45 ? 'warn' : 'good';
    const chargeState = position.charging === true ? 'Charging' : position.charging === false ? 'Not charging' : 'Charging unknown';
    const charge = `<i class="ss-charge ${position.charging === true ? 'on' : 'off'}" title="${chargeState}">⚡</i>`;
    return `<div class="ss-viz"><span class="ss-viz-title">Battery</span><span class="ss-battery ${tone}"><i style="width:${level}%"></i></span><strong>${reported ? `${Math.round(level)}%` : 'N/R'}${charge}</strong></div>`;
  }

  function signalVisual(position) {
    const reported = reportedNumber(position.gsmSignal);
    const signal = reported ? Number(position.gsmSignal) : null;
    const activeBars = reported ? Math.max(1, Math.min(4, Math.ceil(signal / 10))) : 0;
    const bars = [1, 2, 3, 4].map(index => `<i class="${index <= activeBars ? 'on' : ''}"></i>`).join('');
    return `<div class="ss-viz"><span class="ss-viz-title">GSM</span><span class="ss-signal ${reported ? '' : 'missing'}">${bars}</span><strong>${reported ? `${signal} RSSI` : 'N/R'}</strong></div>`;
  }

  function gpsVisual(position) {
    const reported = reportedNumber(position.gpsSatellites);
    const satellites = reported ? Math.max(0, Math.round(Number(position.gpsSatellites))) : null;
    return `<div class="ss-viz"><span class="ss-viz-title">GPS sats</span><span class="ss-sat ${reported ? 'reported' : 'missing'}"><i></i><i></i><i></i><i></i><b>${reported ? satellites : '—'}</b></span><strong>${reported ? satellites : 'N/R'}</strong></div>`;
  }

  function accuracyVisual(position) {
    const reported = reportedNumber(position.accuracyM);
    const accuracy = reported ? Math.max(0, Number(position.accuracyM)) : null;
    const tone = !reported ? 'missing' : accuracy <= 10 ? 'good' : accuracy <= 30 ? 'warn' : 'bad';
    return `<div class="ss-viz"><span class="ss-viz-title">Accuracy</span><span class="ss-target ${tone}"><i></i></span><strong>${reported ? `${Math.round(accuracy)} m` : 'N/R'}</strong></div>`;
  }

  function telemetryVisuals(position) {
    return `<div class="ss-viz-grid">${batteryVisual(position)}${signalVisual(position)}${gpsVisual(position)}${accuracyVisual(position)}</div>`;
  }

  function deviceLabel(device) {
    const position = device.position || {};
    // MapLibre draws text literally, so a marker label is plain text rather than
    // the HTML a Leaflet divIcon would accept.
    const name = device.name || 'Tracker';
    const speed = presentNumber(position.speedKmh, ' km/h', 1);
    return `${name} · ${speed}`;
  }

  function devicePopup(device) {
    const position = device.position || {};
    const name = escapeHtml(device.name || 'Unnamed tracker');
    const role = escapeHtml(String(device.role || 'tracker').replace(/_/g, ' '));
    const status = connectionLabel(device);
    const statusClass = status === 'Online' ? 'online' : status === 'Offline' ? 'offline' : 'unknown';
    const source = positionSource(device);
    const speed = presentNumber(position.speedKmh, ' km/h', 1);
    const battery = presentNumber(position.batteryPercent, '%');
    const charging = position.charging === true ? ' · charging' : position.charging === false ? ' · not charging' : ' · charging state not reported';
    const gsm = presentNumber(position.gsmSignal, ' RSSI');
    const satellites = presentNumber(position.gpsSatellites, ' satellites');
    const accuracy = presentNumber(position.accuracyM, ' m');
    const time = escapeHtml(position.fixTime || position.serverTime || 'Not reported');
    return `<div class="ss-tracker-popup"><strong>${name}</strong><span class="ss-popup-status ${statusClass}">${status}</span><small>${role} · ${source}</small>${telemetryVisuals(position)}<dl><dt>Speed</dt><dd>${speed}</dd><dt>Battery</dt><dd>${battery}${charging}</dd><dt>GSM signal</dt><dd>${gsm}</dd><dt>GPS</dt><dd>${satellites}</dd><dt>Accuracy</dt><dd>${accuracy}</dd><dt>Fix time</dt><dd>${time}</dd></dl></div>`;
  }

  // Evidence sensors are drawn as a GeoJSON layer so a re-sync replaces them
  // instead of piling up new DOM markers.
  function sensorFeatures(fusion) {
    const windSensors = Array.isArray(fusion?.mapContext?.wind?.sensors) ? fusion.mapContext.wind.sensors : [];
    return windSensors.slice(0, 12).map(sensor => {
      const lat = Number(sensor.lat ?? sensor.latitude);
      const lng = Number(sensor.lng ?? sensor.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lng, lat] },
        properties: {
          name: sensor.name || sensor.provider || 'Senlay evidence source',
          provider: sensor.provider || 'Provider not named',
          observed: sensor.observedAt || sensor.timestamp || ''
        }
      };
    }).filter(Boolean);
  }

  function normaliseTrackPoints(points) {
    return (Array.isArray(points) ? points : [])
      .map(point => ({
        lat: Number(point.lat),
        lng: Number(point.lng),
        speed: Number.isFinite(Number(point.speedKmh)) ? Number(point.speedKmh) : 0,
        time: Date.parse(point.fixTime || point.deviceTime || point.serverTime || '') || null
      }))
      .filter(point => Number.isFinite(point.lat) && Number.isFinite(point.lng));
  }

  function sampleTrack(list, maxPoints = 1200) {
    if (list.length <= maxPoints) return list;
    const step = Math.ceil(list.length / maxPoints);
    return list.filter((point, index) => index % step === 0 || index === list.length - 1);
  }

  function playbackIndex(list, time) {
    if (!Number.isFinite(time)) return list.length - 1;
    let best = 0;
    for (let index = 0; index < list.length; index += 1) {
      if (list[index].time == null) continue;
      if (list[index].time <= time) best = index;
      else break;
    }
    return best;
  }

  function geofenceShape(item) {
    if (!item) return null;
    const shape = item.shape || (Number.isFinite(Number(item.lat)) ? 'circle' : 'polygon');
    if (shape === 'circle' && Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lng))) {
      return { type: 'circle', center: [Number(item.lat), Number(item.lng)], radius: Math.max(10, Number(item.radiusM) || 250) };
    }
    const points = Array.isArray(item.points) ? item.points : [];
    if (points.length >= 3) {
      return { type: 'polygon', latlngs: points.map(pair => [Number(pair[0]), Number(pair[1])]) };
    }
    return null;
  }

  function geofenceLabel(item) {
    const shape = item.shape || (Number.isFinite(Number(item.lat)) ? 'circle' : 'polygon');
    if (shape === 'circle') return `${Math.round(Number(item.radiusM) || 0)} m radius`;
    if (shape === 'rectangle') return `${Math.round(Number(item.widthM) || 0)} × ${Math.round(Number(item.heightM) || 0)} m`;
    return `${(item.points || []).length} points`;
  }

  function rectangleCorners(lat, lng, widthM, heightM) {
    const latDelta = (Number(heightM) / 2) / 111320;
    const lngDelta = (Number(widthM) / 2) / (111320 * Math.cos(Number(lat) * Math.PI / 180));
    return [
      [Number(lat) + latDelta, Number(lng) - lngDelta],
      [Number(lat) + latDelta, Number(lng) + lngDelta],
      [Number(lat) - latDelta, Number(lng) + lngDelta],
      [Number(lat) - latDelta, Number(lng) - lngDelta]
    ];
  }

  function make(host) {
    if (!window.maplibregl) {
      console.error('MapLibre GL JS not loaded');
      return { sync: () => {}, resize: () => {}, destroy: () => {} };
    }

    const map = new maplibregl.Map({
      container: host,
      style: {
        version: 8,
        glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
        sources: {
          openfreemap: {
            type: 'vector',
            url: 'https://tiles.openfreemap.org/planet',
            attribution: '\u0026copy; OpenFreeMap, \u0026copy; OpenMapTiles, \u0026copy; OpenStreetMap contributors'
          },
          openseamap: {
            type: 'raster',
            tiles: ['https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png'],
            tileSize: 256,
            minzoom: 0,
            maxzoom: 18,
            attribution: '\u0026copy; OpenSeaMap contributors'
          },
          gebco: {
            type: 'raster',
            tiles: ['https://wms.gebco.net/mapserv?SERVICE=WMS\u0026VERSION=1.3.0\u0026REQUEST=GetMap\u0026LAYERS=GEBCO_LATEST\u0026STYLES=\u0026FORMAT=image/png\u0026TRANSPARENT=TRUE\u0026CRS=EPSG:3857\u0026BBOX={bbox-epsg-3857}\u0026WIDTH=256\u0026HEIGHT=256'],
            tileSize: 256,
            minzoom: 0,
            maxzoom: 12,
            attribution: '\u0026copy; GEBCO'
          },
          satellite: {
            type: 'raster',
            tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
            tileSize: 256,
            minzoom: 0,
            maxzoom: 19,
            attribution: '\u0026copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community'
          },
          esriLabels: {
            type: 'raster',
            tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'],
            tileSize: 256,
            minzoom: 0,
            maxzoom: 19,
            attribution: '\u0026copy; Esri'
          }
        },
        layers: [
          {
            id: 'background',
            type: 'background',
            paint: { 'background-color': '#eef1f5' }
          },
          {
            id: 'satellite',
            type: 'raster',
            source: 'satellite',
            paint: { 'raster-opacity': 1, 'raster-brightness-max': 0.95 },
            layout: { visibility: 'none' }
          },
          {
            id: 'ofm-landcover',
            type: 'fill',
            source: 'openfreemap',
            'source-layer': 'landcover',
            paint: { 'fill-color': '#f5f7f5', 'fill-opacity': 0.95 },
            layout: { visibility: 'none' }
          },
          {
            id: 'ofm-landuse',
            type: 'fill',
            source: 'openfreemap',
            'source-layer': 'landuse',
            paint: { 'fill-color': '#eceff2', 'fill-opacity': 0.8 },
            layout: { visibility: 'none' }
          },
          {
            id: 'ofm-water',
            type: 'fill',
            source: 'openfreemap',
            'source-layer': 'water',
            paint: { 'fill-color': '#a9cfe8' },
            layout: { visibility: 'visible' }
          },
          {
            id: 'ofm-coastline',
            type: 'line',
            source: 'openfreemap',
            'source-layer': 'water',
            paint: { 'line-color': '#3f6b8f', 'line-width': 0.8, 'line-opacity': 0.9 },
            layout: { visibility: 'visible' }
          },
          {
            id: 'ofm-waterway',
            type: 'line',
            source: 'openfreemap',
            'source-layer': 'waterway',
            paint: { 'line-color': '#a9c6dd', 'line-width': 1.2 },
            layout: { visibility: 'visible' }
          },
          {
            id: 'ofm-road',
            type: 'line',
            source: 'openfreemap',
            'source-layer': 'transportation',
            minzoom: 9,
            paint: { 'line-color': '#c9ced6', 'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.5, 14, 1.8] },
            layout: { visibility: 'none' }
          },
          {
            id: 'ofm-boundary',
            type: 'line',
            source: 'openfreemap',
            'source-layer': 'boundary',
            paint: { 'line-color': '#aab3bf', 'line-width': 0.6, 'line-dasharray': [2, 2] },
            layout: { visibility: 'none' }
          },
          {
            id: 'ofm-place',
            type: 'symbol',
            source: 'openfreemap',
            'source-layer': 'place',
            minzoom: 7,
            layout: {
              'text-field': ['get', 'name'],
              'text-font': ['Noto Sans Regular'],
              'text-size': ['interpolate', ['linear'], ['zoom'], 7, 9, 12, 12],
              visibility: 'visible'
            },
            paint: { 'text-color': '#33414f', 'text-halo-color': '#ffffff', 'text-halo-width': 1.2 }
          },
          {
            id: 'esri-labels',
            type: 'raster',
            source: 'esriLabels',
            paint: { 'raster-opacity': 0.9 },
            layout: { visibility: 'none' }
          },
          {
            id: 'gebco-bathymetry',
            type: 'raster',
            source: 'gebco',
            // GEBCO is coarse, so it only shows at low zoom where it reads as a
            // smooth depth shading; closer in the clean chart takes over.
            maxzoom: 9,
            paint: { 'raster-opacity': 0.95, 'raster-saturation': -0.55, 'raster-brightness-min': 0.02, 'raster-brightness-max': 0.42, 'raster-contrast': 0.2 },
            layout: { visibility: 'visible' }
          },
          {
            id: 'openseamap',
            type: 'raster',
            source: 'openseamap',
            paint: { 'raster-opacity': 0.9 },
            layout: { visibility: 'visible' }
          }
        ]
      },
      center: [108.3, 15.9],
      zoom: 11,
      attributionControl: true,
      preserveDrawingBuffer: true,
      antialias: true,
      // North-up marine chart: disabling rotation/pitch keeps the wind layer's
      // analytic mercator projection valid and its hot loop free of matrix work.
      dragRotate: false,
      touchPitch: false,
      pitchWithRotate: false,
      maxPitch: 0
    });

    let baseReady = false;
    let destroyed = false;
    let failed = false;
    const fallback = () => {
      if (destroyed || failed) return;
      failed = true;
      clearTimeout(baseTimer);
      window.SmartSurfMaplibreUnsupported = true;
      queueMicrotask(() => window.dispatchEvent(new Event('smartsurf:map-failed')));
    };
    // A WebGL canvas alone is not evidence that a map has loaded. If its base
    // source cannot provide tiles, keep the tracker usable with the raster map.
    const baseTimer = setTimeout(() => { if (!baseReady) fallback(); }, 8000);
    map.on('sourcedata', event => {
      const baseSource = currentBase === 'satellite' ? 'satellite' : 'openfreemap';
      if (event.sourceId === baseSource && event.tile && event.sourceDataType === 'content') {
        baseReady = true;
        clearTimeout(baseTimer);
      }
    });
    map.on('error', event => {
      const baseSource = currentBase === 'satellite' ? 'satellite' : 'openfreemap';
      if (!baseReady && event.sourceId === baseSource) fallback();
    });
    map.on('webglcontextlost', fallback);

    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    // attributionControl:true in the options already adds one; a second control
    // duplicated every source's attribution in the bar.

    const geofenceSourceId = 'geofences';
    const routeSourceId = 'routes';
    const playbackSourceId = 'playback';
    const markerSourceId = 'markers';
    const alarmSourceId = 'alarms';
    const focusSourceId = 'focus';
    const sensorSourceId = 'sensors';

    let didFit = false;
    let didFitRoute = false;
    let lastFitToken = '';
    let lastFleetKey = '';
    let lastAlarmKey = '';
    let lastFocusKey = '';
    let geofenceKey = '';
    let routeKey = '';
    let pickMode = false;
    let onPick = null;
    let pointerStart = null;
    let lastPickAt = 0;
    let mapLoaded = false;
    let pendingSync = null;
    let lastDevices = [];
    let lastAlarms = [];
    let lastFocus = null;
    let currentBase = 'marine';
    let currentBathymetry = false;

    // Animated wind field (GFS, ingested server-side). Frames are fetched lazily
    // and the layer is drawn only while it is enabled.
    let windLayer = null;
    let windManifest = null;
    const windFrameCache = new Map();
    let windRequested = false;

    function apiUrl(path) {
      try {
        return new URL(path, window.document ? window.document.baseURI : window.location.href).toString();
      } catch {
        return path;
      }
    }

    async function loadWindManifest() {
      if (windManifest || windRequested) return windManifest;
      windRequested = true;
      try {
        const response = await fetch(apiUrl('api/weather/wind'));
        if (response.ok) windManifest = await response.json();
      } catch {
        windManifest = null;
      }
      return windManifest;
    }

    async function loadWindFrame(frame, run, n, scale) {
      const key = frame.file;
      if (windFrameCache.has(key)) return windFrameCache.get(key);
      const response = await fetch(apiUrl(`api/weather/wind/frame/${encodeURIComponent(run)}/${encodeURIComponent(frame.file)}`));
      if (!response.ok) throw new Error('wind frame ' + response.status);
      const buffer = await response.arrayBuffer();
      const int8 = new Int8Array(buffer);
      const u = new Float32Array(n);
      const v = new Float32Array(n);
      for (let i = 0; i < n; i += 1) { u[i] = int8[i] * scale; v[i] = int8[n + i] * scale; }
      const value = { u, v };
      windFrameCache.set(key, value);
      if (windFrameCache.size > 4) windFrameCache.delete(windFrameCache.keys().next().value);
      return value;
    }

    async function applyWind(spec = {}) {
      if (!windLayer) return;
      if (!spec.enabled) { windLayer.setEnabled(false); return; }
      const manifest = await loadWindManifest();
      if (!manifest || !Array.isArray(manifest.frames) || !manifest.frames.length) { windLayer.setEnabled(false); return; }
      const axis = manifest.axis || {};
      const n = (axis.nlat || 0) * (axis.nlon || 0);
      if (!n) { windLayer.setEnabled(false); return; }
      const frames = manifest.frames;
      const hour = Number.isFinite(Number(spec.hour)) ? Number(spec.hour) : frames[0].hour;
      let index = 0;
      for (let i = 0; i < frames.length; i += 1) if (frames[i].hour <= hour) index = i;
      const A = frames[index];
      const B = frames[Math.min(index + 1, frames.length - 1)];
      const span = (B.hour - A.hour) || 1;
      const t = Math.max(0, Math.min(1, (hour - A.hour) / span));
      try {
        const [fa, fb] = await Promise.all([
          loadWindFrame(A, manifest.run, n, manifest.scale),
          B === A ? Promise.resolve(null) : loadWindFrame(B, manifest.run, n, manifest.scale)
        ]);
        windLayer.setData({
          nlat: axis.nlat, nlon: axis.nlon, lat0: axis.lat0, lon0: axis.lon0, dlat: axis.dlat, dlon: axis.dlon,
          uA: fa.u, vA: fa.v, uB: fb ? fb.u : null, vB: fb ? fb.v : null, t
        });
        windLayer.setTime(t);
        windLayer.setSpeedScale(spec.speed);
        windLayer.setEnabled(true);
      } catch (error) {
        console.error('wind layer data failed', error);
        windLayer.setEnabled(false);
      }
    }

    function firePick(latlng) {
      if (!pickMode || typeof onPick !== 'function' || !latlng) return;
      const at = Date.now();
      if (at - lastPickAt < 400) return; // the click after a tap must not add a second point
      lastPickAt = at;
      onPick({ lat: Number(latlng.lat), lng: Number(latlng.lng) });
    }

    // SmartSurf is a watersports app, so the default base is a bathymetry-first
    // "marine" view: GEBCO depth shading for the water, land clutter removed, and
    // place labels only. Satellite, hybrid and the light vector map stay available.
    // SmartSurf is a watersports app, so the default base is a water-first marine
    // chart: water and coastline carry the detail, land is muted, roads and land
    // clutter are removed. Satellite, hybrid and a light vector map remain.
    const setVis = (id, value) => { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', value); };
    function applyBase(mode) {
      const vector = mode === 'vector';
      const marine = mode === 'marine';
      const showWater = vector || marine;
      setVis('ofm-landcover', vector ? 'visible' : 'none');
      setVis('ofm-landuse', vector ? 'visible' : 'none');
      setVis('ofm-road', vector ? 'visible' : 'none');
      setVis('ofm-boundary', vector ? 'visible' : 'none');
      setVis('ofm-water', showWater ? 'visible' : 'none');
      setVis('ofm-waterway', showWater ? 'visible' : 'none');
      setVis('ofm-coastline', marine ? 'visible' : 'none');
      setVis('ofm-place', showWater ? 'visible' : 'none');
      setVis('satellite', (mode === 'satellite' || mode === 'hybrid') ? 'visible' : 'none');
      setVis('esri-labels', mode === 'hybrid' ? 'visible' : 'none');
      setVis('gebco-bathymetry', (marine || currentBathymetry) ? 'visible' : 'none');
      // Marine and vector are both light so zooming in brightens the chart; the
      // dark depth view is the zoomed-out (GEBCO) layer.
      if (map.getLayer('background')) {
        map.setPaintProperty('background', 'background-color', showWater ? '#eef1f5' : '#04101c');
      }
      if (map.getLayer('ofm-water')) {
        map.setPaintProperty('ofm-water', 'fill-color', '#a9cfe8');
      }
      if (map.getLayer('ofm-waterway')) {
        map.setPaintProperty('ofm-waterway', 'line-color', '#7fb2d4');
      }
      if (map.getLayer('ofm-coastline')) {
        map.setPaintProperty('ofm-coastline', 'line-color', '#5f8fb3');
      }
      if (map.getLayer('ofm-place')) {
        map.setPaintProperty('ofm-place', 'text-color', '#33414f');
        map.setPaintProperty('ofm-place', 'text-halo-color', '#ffffff');
      }
    }

    map.on('load', () => {
      mapLoaded = true;
      map.addSource(geofenceSourceId, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addSource(routeSourceId, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addSource(playbackSourceId, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addSource(markerSourceId, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addSource(alarmSourceId, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addSource(focusSourceId, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addSource(sensorSourceId, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });

      map.addLayer({
        id: 'geofence-fill',
        type: 'fill',
        source: geofenceSourceId,
        paint: {
          'fill-color': ['case', ['get', 'draft'], '#f59e0b', '#38bdf8'],
          'fill-opacity': ['case', ['get', 'draft'], 0.16, 0.08]
        },
        filter: ['==', ['geometry-type'], 'Polygon']
      });
      map.addLayer({
        id: 'geofence-line',
        type: 'line',
        source: geofenceSourceId,
        paint: {
          'line-color': ['case', ['get', 'draft'], '#f59e0b', '#38bdf8'],
          'line-width': ['case', ['get', 'draft'], 2, 1.5],
          'line-opacity': 0.85
        },
        filter: ['!=', ['geometry-type'], 'Point']
      });
      map.addLayer({
        id: 'geofence-circle',
        type: 'circle',
        source: geofenceSourceId,
        paint: {
          'circle-radius': ['case', ['get', 'vertex'], 4, 8],
          'circle-color': ['case', ['get', 'draft'], '#f59e0b', '#38bdf8'],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#07131f'
        },
        filter: ['==', ['geometry-type'], 'Point']
      });

      map.addLayer({
        id: 'route-traveled',
        type: 'line',
        source: routeSourceId,
        paint: { 'line-width': 3.5, 'line-opacity': 0.9, 'line-color': ['coalesce', ['get', 'color'], '#7dd3fc'] },
        filter: ['==', ['get', 'traveled'], true]
      });
      map.addLayer({
        id: 'route-remaining',
        type: 'line',
        source: routeSourceId,
        paint: { 'line-color': ['case', ['get', 'paired'], '#f59e0b', '#94a3b8'], 'line-width': 2.5, 'line-opacity': 0.45, 'line-dasharray': [5, 5] },
        filter: ['==', ['get', 'traveled'], false]
      });

      map.addLayer({
        id: 'playback-marker',
        type: 'circle',
        source: playbackSourceId,
        paint: { 'circle-radius': 9, 'circle-stroke-width': 3, 'circle-stroke-color': '#ffffff' },
        filter: ['==', ['get', 'paired'], false]
      });
      map.addLayer({
        id: 'playback-marker-paired',
        type: 'circle',
        source: playbackSourceId,
        paint: { 'circle-radius': 9, 'circle-color': '#f59e0b', 'circle-stroke-width': 3, 'circle-stroke-color': '#ffffff' },
        filter: ['==', ['get', 'paired'], true]
      });

      map.addLayer({
        id: 'device-markers',
        type: 'symbol',
        source: markerSourceId,
        layout: {
          'icon-image': 'tracker-pin',
          'icon-size': 1,
          'icon-allow-overlap': true,
          'text-field': ['get', 'label'],
          'text-font': ['Noto Sans Bold'],
          'text-size': 10,
          'text-offset': [0, 1.5],
          'text-anchor': 'top',
          // Icons may overlap but labels must not: with two trackers at the same
          // point the labels stacked into unreadable text.
          'text-allow-overlap': false,
          'text-optional': true,
          'text-ignore-placement': false
        }
      });

      map.addLayer({
        id: 'alarm-circle',
        type: 'circle',
        source: alarmSourceId,
        paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 20, 14, 60], 'circle-color': '#ef4444', 'circle-opacity': 0.18, 'circle-stroke-width': 1.5, 'circle-stroke-color': '#ef4444', 'circle-stroke-opacity': 0.85 }
      });
      map.addLayer({
        id: 'alarm-marker',
        type: 'symbol',
        source: alarmSourceId,
        layout: { 'icon-image': 'alarm-pin', 'icon-size': 1, 'icon-allow-overlap': true }
      });

      map.addLayer({
        id: 'focus-marker',
        type: 'symbol',
        source: focusSourceId,
        layout: { 'icon-image': 'focus-pin', 'icon-size': 1, 'icon-allow-overlap': true }
      });

      map.addLayer({
        id: 'sensor-markers',
        type: 'symbol',
        source: sensorSourceId,
        layout: { 'icon-image': 'sensor-pin', 'icon-size': 0.7, 'icon-allow-overlap': true }
      });

      // Wind particles sit above the marine layers but below geofences, routes and
      // trackers, so the weather never hides the things a rider acts on.
      if (window.SmartSurfWindLayer) {
        windLayer = window.SmartSurfWindLayer.createWindLayer(map);
        map.addLayer(windLayer, 'geofence-fill');
      }

      const canvas = map.getCanvas();
      if (canvas) {
        canvas.addEventListener('pointerdown', event => {
          pointerStart = { x: event.clientX, y: event.clientY };
        });
        canvas.addEventListener('pointerup', event => {
          if (!pickMode) return;
          if (pointerStart) {
            const moved = Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y);
            if (moved > 12) return;
          }
          const point = map.unproject([event.clientX, event.clientY]);
          if (point) firePick({ lat: point.lat, lng: point.lng });
        });
      }

      map.on('click', event => {
        if (pickMode && event && event.lngLat) firePick({ lat: event.lngLat.lat, lng: event.lngLat.lng });
      });

      const openPopup = (feature, html) => {
        if (pickMode || !feature) return;
        new maplibregl.Popup({ offset: 12 }).setLngLat(feature.lngLat).setHTML(html).addTo(map);
      };
      map.on('click', 'device-markers', event => {
        const id = event.features && event.features[0] && event.features[0].properties.id;
        const device = lastDevices.find(item => String(item.id) === String(id));
        if (device) openPopup(event, devicePopup(device));
      });
      map.on('click', 'alarm-marker', event => {
        const id = event.features && event.features[0] && event.features[0].properties.deviceId;
        const alarm = lastAlarms.find(item => String(item.deviceId) === String(id));
        if (alarm) openPopup(event, alarmPopup(alarm));
      });
      map.on('click', 'focus-marker', event => {
        if (lastFocus) openPopup(event, focusPopup(lastFocus));
      });
      ['device-markers', 'alarm-marker', 'focus-marker'].forEach(id => {
        map.on('mouseenter', id, () => { if (!pickMode) map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', id, () => { map.getCanvas().style.cursor = pickMode ? 'crosshair' : ''; });
      });

      applyBase(currentBase);

      // A sync that arrives before the style is ready is held and applied here,
      // otherwise the first frame (markers, route, geofences) would be dropped.
      if (pendingSync) {
        const held = pendingSync;
        pendingSync = null;
        applySync(held);
      }
    });

    function drawTrack(list, traveledTime, paired = false) {
      if (list.length < 2) return [];
      const traveledCount = traveledTime == null ? null : playbackIndex(list, traveledTime) + 1;
      const speeds = list.map(point => point.speed);
      const minSpeed = Math.min(...speeds);
      const maxSpeed = Math.max(...speeds);
      const graded = maxSpeed - minSpeed > 0.5;
      const colorAt = index => (paired ? '#f59e0b' : (graded ? speedColorAt((speeds[index] - minSpeed) / (maxSpeed - minSpeed)) : '#7dd3fc'));
      const lastColoured = traveledCount == null ? list.length - 1 : Math.max(0, Math.min(traveledCount - 1, list.length - 1));

      const features = [];
      if (lastColoured < list.length - 1) {
        const remainingCoords = list.slice(lastColoured).map(p => [p.lng, p.lat]);
        if (remainingCoords.length > 1) {
          features.push({
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: remainingCoords },
            properties: { traveled: false, paired }
          });
        }
      }

      let runColor = null;
      let runCoords = [];
      const flush = () => {
        if (runCoords.length > 1) {
          features.push({
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: runCoords },
            properties: { traveled: true, color: runColor, paired }
          });
        }
        runCoords = [];
      };
      for (let index = 0; index < lastColoured; index += 1) {
        const color = colorAt(index + 1);
        const start = [list[index].lng, list[index].lat];
        const end = [list[index + 1].lng, list[index + 1].lat];
        if (color !== runColor) {
          flush();
          runColor = color;
          runCoords = [start, end];
        } else {
          runCoords.push(end);
        }
      }
      flush();

      return features;
    }

    function renderGeofences(list, draft) {
      const items = (Array.isArray(list) ? list : []).map(item => ({ item, shape: geofenceShape(item) })).filter(entry => entry.shape);
      const draftShape = draft ? geofenceShape(draft) : null;
      const key = `${items.map(entry => `${entry.item.id}:${JSON.stringify(entry.shape)}:${entry.item.name}`).join('|')}#${draftShape ? `${draftShape.type}:${JSON.stringify(draftShape)}` : ''}`;
      if (key === geofenceKey) return;
      geofenceKey = key;

      if (!mapLoaded || !map.getSource(geofenceSourceId)) return;

      const features = [];
      items.forEach(({ item, shape }) => {
        if (shape.type === 'circle') {
          const center = [shape.center[1], shape.center[0]];
          const radius = shape.radius;
          const circleCoords = [];
          for (let i = 0; i <= 64; i++) {
            const angle = (i / 64) * 2 * Math.PI;
            circleCoords.push([center[0] + radius * Math.cos(angle) / 111320 / Math.cos(center[1] * Math.PI / 180), center[1] + radius * Math.sin(angle) / 111320]);
          }
          features.push({
            type: 'Feature',
            geometry: { type: 'Polygon', coordinates: [circleCoords] },
            properties: { name: item.name, label: geofenceLabel(item) }
          });
          features.push({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: center },
            properties: { draft: false }
          });
        } else {
          const coords = shape.latlngs.map(p => [p[1], p[0]]);
          coords.push(coords[0]);
          features.push({
            type: 'Feature',
            geometry: { type: 'Polygon', coordinates: [coords] },
            properties: { name: item.name, label: geofenceLabel(item) }
          });
        }
      });

      if (draftShape) {
        if (draftShape.type === 'circle') {
          const center = [draftShape.center[1], draftShape.center[0]];
          const radius = draftShape.radius;
          const circleCoords = [];
          for (let i = 0; i <= 64; i++) {
            const angle = (i / 64) * 2 * Math.PI;
            circleCoords.push([center[0] + radius * Math.cos(angle) / 111320 / Math.cos(center[1] * Math.PI / 180), center[1] + radius * Math.sin(angle) / 111320]);
          }
          features.push({
            type: 'Feature',
            geometry: { type: 'Polygon', coordinates: [circleCoords] },
            properties: { draft: true }
          });
          features.push({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: center },
            properties: { draft: true, center: true }
          });
        } else {
          const coords = draftShape.latlngs.map(p => [p[1], p[0]]);
          coords.push(coords[0]);
          features.push({
            type: 'Feature',
            geometry: { type: 'Polygon', coordinates: [coords] },
            properties: { draft: true }
          });
          draftShape.latlngs.forEach(point => {
            features.push({
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [point[1], point[0]] },
              properties: { draft: true, vertex: true }
            });
          });
        }
      }

      map.getSource(geofenceSourceId).setData({ type: 'FeatureCollection', features });
    }

    function applySync({ devices, selectedDeviceId, route, tracks, playback, fitToken, fusion, alarms, focus, geofences, geofenceDraft, picking, onPickPoint, onSelect, seamarks, bathymetry, base, wind } = {}) {

      if (wind) applyWind(wind);
      if (typeof bathymetry === 'boolean') currentBathymetry = bathymetry;
      if (typeof base === 'string') currentBase = base;
      if (typeof base === 'string' || typeof bathymetry === 'boolean') applyBase(currentBase);
      if (typeof seamarks === 'boolean') {
        const visibility = seamarks ? 'visible' : 'none';
        if (map.getLayer('openseamap')) {
          map.setLayoutProperty('openseamap', 'visibility', visibility);
        }
      }

      const trackList = (Array.isArray(tracks) && tracks.length
        ? tracks.map(track => ({
            deviceId: track.deviceId != null ? String(track.deviceId) : null,
            paired: Boolean(track.paired),
            label: track.label || '',
            list: normaliseTrackPoints(track.points)
          }))
        : [{ deviceId: null, paired: false, label: '', list: normaliseTrackPoints(route) }]
      ).filter(track => track.list.length > 1);

      const playbackActive = Boolean(playback && playback.active);
      const playbackTime = playbackActive ? Number(playback.time) : null;

      const points = trackList.flatMap(track => track.list.map(point => [point.lng, point.lat]));
      const trackKey = trackList
        .map(track => `${track.deviceId || 'route'}:${track.paired ? 'p' : 's'}:${track.list.length}:${track.list[0].lng},${track.list[0].lat},${track.list[track.list.length - 1].lng},${track.list[track.list.length - 1].lat}`)
        .join('|');
      const key = `${trackKey}#${playbackActive ? `pb:${Math.round((playbackTime || 0) / 1000)}` : 'static'}`;

      if (key !== routeKey) {
        routeKey = key;
        const routeFeatures = trackList.flatMap(track => drawTrack(
          track.list,
          playbackActive ? playbackTime : null,
          track.paired
        ));
        if (mapLoaded && map.getSource(routeSourceId)) {
          map.getSource(routeSourceId).setData({ type: 'FeatureCollection', features: routeFeatures });
        }
        if (playbackActive) {
          const features = trackList.map(track => {
            const drawn = sampleTrack(track.list);
            const index = playbackIndex(drawn, playbackTime);
            const point = drawn[Math.max(0, Math.min(index, drawn.length - 1))];
            return {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [point.lng, point.lat] },
              properties: { label: track.label || 'Playback', paired: track.paired }
            };
          });
          map.getSource(playbackSourceId).setData({ type: 'FeatureCollection', features });
        } else {
          map.getSource(playbackSourceId).setData({ type: 'FeatureCollection', features: [] });
        }
      }

      const playbackIds = new Set(playbackActive ? trackList.map(track => track.deviceId).filter(Boolean) : []);
      const fleet = (Array.isArray(devices) ? devices : []).filter(device =>
        device?.position && Number.isFinite(Number(device.position.lat)) && Number.isFinite(Number(device.position.lng))
      );
      const activeIds = new Set(fleet.map(device => String(device.id)));

      const markerFeatures = [];
      fleet.forEach(device => {
        const id = String(device.id);
        const point = device.position;
        const selected = Number(device.id) === Number(selectedDeviceId);
        if (playbackIds.has(id)) return;
        markerFeatures.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [Number(point.lng), Number(point.lat)] },
          properties: { id, label: deviceLabel(device), selected, online: device.online }
        });
      });
      map.getSource(markerSourceId).setData({ type: 'FeatureCollection', features: markerFeatures });
      lastDevices = fleet;

      renderGeofences(geofences, geofenceDraft);

      pickMode = Boolean(picking);
      onPick = typeof onPickPoint === 'function' ? onPickPoint : null;
      const canvas = map.getCanvas();
      if (canvas) canvas.style.cursor = pickMode ? 'crosshair' : '';

      if (map.getSource(sensorSourceId)) {
        map.getSource(sensorSourceId).setData({ type: 'FeatureCollection', features: sensorFeatures(fusion) });
      }

      const alarmList = (Array.isArray(alarms) ? alarms : []).filter(alarm =>
        alarm
        && alarm.lat !== null && alarm.lat !== undefined && alarm.lat !== ''
        && alarm.lng !== null && alarm.lng !== undefined && alarm.lng !== ''
        && Number.isFinite(Number(alarm.lat)) && Number.isFinite(Number(alarm.lng))
      );
      const alarmIds = new Set(alarmList.map(alarm => String(alarm.deviceId)));
      const alarmFeatures = alarmList.map(alarm => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [Number(alarm.lng), Number(alarm.lat)] },
        properties: { deviceId: String(alarm.deviceId), deviceName: alarm.deviceName, alarm: alarm.alarm, eventTime: alarm.eventTime, fixTime: alarm.fixTime, deviceTime: alarm.deviceTime, serverTime: alarm.serverTime }
      }));
      map.getSource(alarmSourceId).setData({ type: 'FeatureCollection', features: alarmFeatures });
      lastAlarms = alarmList;

      const fleetPoints = fleet.map(device => [Number(device.position.lng), Number(device.position.lat)]);
      const fleetKey = fleet.map(device => String(device.id)).sort().join(',');
      const alarmKey = alarmList
        .map(alarm => `${alarm.deviceId}:${alarmTime(alarm) || `${alarm.lat},${alarm.lng}`}`)
        .sort()
        .join(',');

      if ((!didFit || fleetKey !== lastFleetKey || (!didFitRoute && points.length > 1)) && fleetPoints.length) {
        const bounds = new maplibregl.LngLatBounds();
        fleetPoints.forEach(p => bounds.extend(p));
        points.forEach(p => bounds.extend(p));
        alarmFeatures.forEach(f => bounds.extend(f.geometry.coordinates));
        if (fleetPoints.length === 1 && !points.length && alarmFeatures.length === 0) {
          map.jumpTo({ center: fleetPoints[0], zoom: 13 });
        } else {
          map.fitBounds(bounds, { padding: { top: 50, bottom: 50, left: 50, right: 50 }, maxZoom: 14 });
        }
        didFit = true;
        if (points.length > 1) didFitRoute = true;
      } else if (alarmKey && alarmKey !== lastAlarmKey) {
        const focusPoints = alarmFeatures
          .map(f => f.geometry.coordinates)
          .concat(
            fleet.filter(device => alarmIds.has(String(device.id)))
              .map(device => [Number(device.position.lng), Number(device.position.lat)])
          );
        if (focusPoints.length) {
          const bounds = new maplibregl.LngLatBounds();
          focusPoints.forEach(p => bounds.extend(p));
          map.fitBounds(bounds, { padding: { top: 80, bottom: 80, left: 80, right: 80 }, maxZoom: 14 });
        }
      }
      lastFleetKey = fleetKey;
      lastAlarmKey = alarmKey;

      if (fitToken && fitToken !== lastFitToken && points.length > 1) {
        lastFitToken = fitToken;
        const bounds = new maplibregl.LngLatBounds();
        points.forEach(p => bounds.extend(p));
        map.fitBounds(bounds, { padding: { top: 50, bottom: 50, left: 50, right: 50 }, maxZoom: 14 });
      }

      const focusLat = focus ? Number(focus.lat) : NaN;
      const focusLng = focus ? Number(focus.lng) : NaN;
      lastFocus = Number.isFinite(Number(focusLat)) && Number.isFinite(Number(focusLng)) ? { ...focus, lat: Number(focusLat), lng: Number(focusLng) } : null;
      if (Number.isFinite(focusLat) && Number.isFinite(focusLng)) {
        const key = String(focus.key || `${focusLat},${focusLng}`);
        if (key !== lastFocusKey) {
          const feature = {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [focusLng, focusLat] },
            properties: { label: focus.label || 'Alert location', when: focus.when }
          };
          map.getSource(focusSourceId).setData({ type: 'FeatureCollection', features: [feature] });
          map.jumpTo({ center: [focusLng, focusLat], zoom: Math.max(map.getZoom(), 14) });
          lastFocusKey = key;
        }
      } else {
        map.getSource(focusSourceId).setData({ type: 'FeatureCollection', features: [] });
        lastFocusKey = '';
      }
    }

    // MapLibre's addImage needs raster pixel data; a canvas is not accepted by
    // this build ("mismatched image size"), so each icon is rendered to a canvas
    // and handed over as ImageData.
    function iconImage(size, draw) {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      draw(ctx, size);
      return ctx.getImageData(0, 0, size, size);
    }

    function addCustomIcons() {
      if (map.hasImage('tracker-pin')) return;
      map.addImage('tracker-pin', iconImage(26, (ctx, size) => {
        ctx.translate(size / 2, size / 2);
        ctx.beginPath();
        ctx.moveTo(0, -size / 2);
        ctx.quadraticCurveTo(size / 4, -size / 8, size / 2, 0);
        ctx.quadraticCurveTo(size / 4, size / 8, 0, size / 2);
        ctx.quadraticCurveTo(-size / 4, size / 8, -size / 2, 0);
        ctx.quadraticCurveTo(-size / 4, -size / 8, 0, -size / 2);
        ctx.fillStyle = '#38bdf8';
        ctx.fill();
        ctx.strokeStyle = '#07131f';
        ctx.lineWidth = 2;
        ctx.stroke();
      }));
      map.addImage('alarm-pin', iconImage(30, (ctx, size) => {
        ctx.translate(size / 2, size / 2);
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, 2 * Math.PI);
        ctx.fillStyle = '#ef4444';
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('!', 0, 1);
      }));
      map.addImage('focus-pin', iconImage(18, (ctx, size) => {
        ctx.translate(size / 2, size / 2);
        ctx.beginPath();
        ctx.arc(0, 0, 7, 0, 2 * Math.PI);
        ctx.fillStyle = '#f59e0b';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }));
      map.addImage('sensor-pin', iconImage(14, (ctx, size) => {
        ctx.translate(size / 2, size / 2);
        ctx.beginPath();
        ctx.arc(0, 0, 5, 0, 2 * Math.PI);
        ctx.fillStyle = '#22c55e';
        ctx.fill();
      }));
    }

    map.on('load', addCustomIcons);
    if (map.loaded()) addCustomIcons();

    // sync() is safe to call at any time; before the style loads the payload is
    // buffered and applied by the load handler.
    function sync(data = {}) {
      if (!mapLoaded) { pendingSync = data; return; }
      applySync(data);
    }

    return {
      sync,
      resize: () => { if (map) map.resize(); },
      destroy: () => { destroyed = true; clearTimeout(baseTimer); map.remove(); },
      getMap: () => map
    };
  }

  function resize(host) {
    const instance = host && host.__smartSurfMaplibreMap;
    if (instance && typeof instance.resize === 'function') instance.resize();
  }

  window.SmartSurfMaplibreMap = {
    sync(host, data) {
      if (!host || !window.maplibregl) return null;
      if (!host.__smartSurfMaplibreMap) {
        try {
          host.__smartSurfMaplibreMap = make(host);
        } catch (error) {
          // e.g. no WebGL context: tell the rider so it can fall back to Leaflet.
          // A failed constructor can leave its canvas/control nodes behind even
          // though no removable Map instance was returned.
          host.replaceChildren();
          host.classList.remove('maplibregl-map');
          window.SmartSurfMaplibreUnsupported = true;
          console.error('MapLibre unavailable, falling back to Leaflet', error);
          queueMicrotask(() => window.dispatchEvent(new Event('smartsurf:map-failed')));
          return null;
        }
      }
      host.__smartSurfMaplibreMap.sync(data);
      return host.__smartSurfMaplibreMap;
    },
    resize,
    destroy(host) {
      if (host && host.__smartSurfMaplibreMap) {
        host.__smartSurfMaplibreMap.destroy();
        delete host.__smartSurfMaplibreMap;
      }
    }
  };
}());
