(function () {
  'use strict';

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>'"]/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[character]));
  }

  function reportedNumber(value) {
    return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
  }

  function trackerIcon({ selected, online } = {}) {
    return L.divIcon({
      className: `ss-tracker-pin-wrap${selected ? ' selected' : ''}${online ? ' online' : ' offline'}`,
      html: '<span class="ss-tracker-pin"><i></i></span>',
      iconSize: [26, 26],
      iconAnchor: [13, 13]
    });
  }

  function sensorIcon() {
    return L.divIcon({
      className: 'ss-sensor-pin-wrap',
      html: '<span class="ss-sensor-pin"></span>',
      iconSize: [14, 14],
      iconAnchor: [7, 7]
    });
  }

  // Traccar's speed palette, ported from its MapRoutePath module: the same
  // polynomial approximation of the speed colour ramp, so a SmartSurf trace
  // reads exactly like the one in Traccar (slow -> fast across the route's own
  // speed range).
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

  function alarmIcon() {
    return L.divIcon({
      className: 'ss-alarm-pin-wrap',
      html: '<span class="ss-alarm-pin"></span>',
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    });
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

  function focusIcon() {
    return L.divIcon({
      className: 'ss-focus-pin-wrap',
      html: '<span class="ss-focus-pin"></span>',
      iconSize: [18, 18],
      iconAnchor: [9, 9]
    });
  }

  function focusPopup(focus) {
    const label = escapeHtml(focus.label || 'Alert location');
    const when = focus.when ? `<dt>Time</dt><dd>${escapeHtml(focus.when)}</dd>` : '';
    return `<div class="ss-tracker-popup"><strong>${label}</strong><span class="ss-popup-status">History</span><dl>${when}<dt>Position</dt><dd>${Number(focus.lat).toFixed(5)}, ${Number(focus.lng).toFixed(5)}</dd></dl></div>`;
  }

  function make(host) {
    // The safety map deliberately uses one renderer. The former MapLibre +
    // Leaflet stack could leave a transparent WebGL canvas beneath otherwise
    // healthy tracker controls, producing a blank map with no reliable failure
    // signal. A raster base keeps geography visible anywhere Leaflet works.
    const map = L.map(host, { zoomControl: true, attributionControl: true, preferCanvas: true });
    // Match the existing right-hand map control layout instead of placing zoom
    // beneath the fleet sidebar when the renderer falls back.
    map.zoomControl?.setPosition('topright');
    const rasterFallbackAttribution = 'Map tiles by <a href="https://www.openstreetmap.fr/" target="_blank" rel="noopener">OpenStreetMap France</a>, © OpenStreetMap contributors';
    const baseLayer = L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: rasterFallbackAttribution
    }).addTo(map);
    let baseTilesLoaded = 0;
    let baseErrors = 0;
    let alternativeBase = false;
    let tileNotice = null;
    baseLayer.on('tileload', () => {
      baseTilesLoaded++;
      tileNotice?.remove();
      tileNotice = null;
    });
    baseLayer.on('tileerror', () => {
      if (baseTilesLoaded || ++baseErrors < 3) return;
      if (!alternativeBase) {
        alternativeBase = true;
        baseErrors = 0;
        map.attributionControl.removeAttribution(rasterFallbackAttribution);
        baseLayer.options.attribution = '© OpenStreetMap contributors';
        map.attributionControl.addAttribution(baseLayer.options.attribution);
        baseLayer.setUrl('https://tile.openstreetmap.org/{z}/{x}/{y}.png');
        return;
      }
      if (tileNotice) return;
      tileNotice = document.createElement('div');
      tileNotice.setAttribute('role', 'status');
      tileNotice.textContent = 'Map tiles unavailable. Positions and routes remain visible.';
      tileNotice.style.cssText = 'position:absolute;left:12px;right:12px;bottom:38px;z-index:550;padding:10px 12px;border-radius:8px;background:#0b2225;color:#e8f8f7;font:13px/1.4 system-ui;pointer-events:none';
      host.appendChild(tileNotice);
    });
    const seamarkLayer = L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', {
      maxZoom: 19,
      opacity: 0.9,
      attribution: '<a href="https://www.openseamap.org/" target="_blank" rel="noopener">OpenSeaMap seamarks</a> · © OpenStreetMap contributors'
    }).addTo(map);
    let seamarksVisible = true;

    function setSeamarks(enabled) {
      const next = Boolean(enabled);
      if (next === seamarksVisible) return;
      seamarksVisible = next;
      if (next && map.addLayer) map.addLayer(seamarkLayer);
      if (!next && map.removeLayer) map.removeLayer(seamarkLayer);
    }
    const geofenceLayer = L.layerGroup().addTo(map);
    const routeLayer = L.layerGroup().addTo(map);
    const playbackLayer = L.layerGroup().addTo(map);
    const sensorLayer = L.layerGroup().addTo(map);
    const markers = new Map();
    const alarmMarkers = new Map();
    let didFit = false;
    let didFitRoute = false;
    let lastFitToken = '';
    let lastFleetKey = '';
    let lastAlarmKey = '';
    let focusMarker = null;
    let lastFocusKey = '';
    let geofenceKey = '';
    let pickMode = false;
    let onPick = null;
    let lastPickAt = 0;
    let pointerStart = null;

    function firePick(latlng) {
      if (!pickMode || typeof onPick !== 'function' || !latlng) return;
      const at = Date.now();
      if (at - lastPickAt < 400) return; // the click after a tap must not add a second point
      lastPickAt = at;
      onPick({ lat: Number(latlng.lat), lng: Number(latlng.lng) });
    }

    map.on('click', event => firePick(event && event.latlng));

    // Touch and pen taps do not always surface as a map click (and a pan looks
    // like a tap to the browser), so taps are taken from the container instead.
    const pickContainer = map.getContainer && map.getContainer();
    if (pickContainer && pickContainer.addEventListener) {
      pickContainer.addEventListener('pointerdown', event => {
        pointerStart = { x: event.clientX, y: event.clientY };
      });
      pickContainer.addEventListener('pointerup', event => {
        if (!pickMode) return;
        if (pointerStart) {
          const moved = Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y);
          if (moved > 12) return; // that was a pan, not a tap
        }
        const latlng = map.mouseEventToLatLng ? map.mouseEventToLatLng(event) : null;
        if (latlng) firePick(latlng);
      });
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
      const name = escapeHtml(device.name || 'Tracker');
      const speed = presentNumber(position.speedKmh, ' km/h', 1);
      return `<strong>${name}</strong><small>${speed}</small>`;
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

    function renderSensors(fusion) {
      sensorLayer.clearLayers();
      const windSensors = Array.isArray(fusion?.mapContext?.wind?.sensors) ? fusion.mapContext.wind.sensors : [];
      windSensors.slice(0, 12).forEach(sensor => {
        const lat = Number(sensor.lat ?? sensor.latitude);
        const lng = Number(sensor.lng ?? sensor.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        const name = escapeHtml(sensor.name || sensor.provider || 'Senlay evidence source');
        const source = escapeHtml(sensor.provider || 'Provider not named');
        const observed = escapeHtml(sensor.observedAt || sensor.timestamp || 'time not supplied');
        L.marker([lat, lng], { icon: sensorIcon(), keyboard: false })
          .bindPopup(`<strong>${name}</strong><br>${source}<br><small>Observed: ${observed}</small>`)
          .addTo(sensorLayer);
      });
    }

    // Speed-coloured trace, like Traccar: each segment takes the colour of its
    // end point's speed normalised across the visible route. Consecutive
    // segments of the same colour are merged into one polyline so a live trace
    // stays cheap on mobile. In playback the travelled part stays coloured while
    // the rest of the track is drawn faint until the cursor reaches it.
    let routeKey = '';

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

    // A full day can hold thousands of positions; the drawn line is sampled to
    // keep redraws during playback cheap on mobile. The cursor still moves on the
    // sampled line it is drawn on, so it never floats off the track.
    function sampleTrack(list, maxPoints = 1200) {
      if (list.length <= maxPoints) return list;
      const step = Math.ceil(list.length / maxPoints);
      return list.filter((point, index) => index % step === 0 || index === list.length - 1);
    }

    function drawTrack(list, traveledTime, paired = false) {
      if (list.length < 2) return;
      const traveledCount = traveledTime == null ? null : playbackIndex(list, traveledTime) + 1;
      const speeds = list.map(point => point.speed);
      const minSpeed = Math.min(...speeds);
      const maxSpeed = Math.max(...speeds);
      const graded = maxSpeed - minSpeed > 0.5;
      const colorAt = index => (paired ? '#f59e0b' : (graded ? speedColorAt((speeds[index] - minSpeed) / (maxSpeed - minSpeed)) : '#7dd3fc'));
      const lastColoured = traveledCount == null
        ? list.length - 1
        : Math.max(0, Math.min(traveledCount - 1, list.length - 1));
      if (lastColoured < list.length - 1) {
        const remaining = list.slice(lastColoured).map(point => [point.lat, point.lng]);
        if (remaining.length > 1) {
          L.polyline(remaining, { color: paired ? '#f59e0b' : '#94a3b8', weight: 2.5, opacity: 0.45, dashArray: '5 5' }).addTo(routeLayer);
        }
      }
      let runColor = null;
      let runPoints = [];
      const flush = () => {
        if (runPoints.length > 1) L.polyline(runPoints, { color: runColor, weight: 3.5, opacity: 0.9 }).addTo(routeLayer);
        runPoints = [];
      };
      for (let index = 0; index < lastColoured; index += 1) {
        const color = colorAt(index + 1);
        const start = [list[index].lat, list[index].lng];
        const end = [list[index + 1].lat, list[index + 1].lng];
        if (color !== runColor) {
          flush();
          runColor = color;
          runPoints = [start, end];
        } else {
          runPoints.push(end);
        }
      }
      flush();
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

    function playbackIcon(color) {
      return L.divIcon({
        className: 'ss-playback-pin-wrap',
        html: `<span class="ss-playback-pin" style="border-color:${color};box-shadow:0 0 0 6px ${color}33"></span>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9]
      });
    }

    // Geofences are circles: the area Traccar evaluates plus, while editing, the
    // draft the rider is placing on the map.
    function geofenceShape(item) {
      if (!item) return null;
      // A missing shape means a circle (the server's default), so older payloads
      // and hand-built drafts still render.
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

    function renderGeofences(list, draft) {
      const items = (Array.isArray(list) ? list : []).map(item => ({ item, shape: geofenceShape(item) })).filter(entry => entry.shape);
      const draftShape = draft ? geofenceShape(draft) : null;
      const key = `${items.map(entry => `${entry.item.id}:${JSON.stringify(entry.shape)}:${entry.item.name}`).join('|')}#${draftShape ? `${draftShape.type}:${JSON.stringify(draftShape)}` : ''}`;
      if (key === geofenceKey) return;
      geofenceKey = key;
      geofenceLayer.clearLayers();
      const style = { color: '#38bdf8', weight: 1.5, opacity: 0.75, fillColor: '#38bdf8', fillOpacity: 0.08, interactive: false };
      items.forEach(({ item, shape }) => {
        const layer = shape.type === 'circle'
          ? L.circle(shape.center, { ...style, radius: shape.radius })
          : L.polygon(shape.latlngs, style);
        layer.bindTooltip(`${escapeHtml(item.name || 'Geofence')} · ${geofenceLabel(item)}`, { direction: 'top', offset: [0, -6] }).addTo(geofenceLayer);
      });
      if (draftShape) {
        const draftStyle = { color: '#f59e0b', weight: 2, opacity: 0.95, dashArray: '6 4', fillColor: '#f59e0b', fillOpacity: 0.12, interactive: false };
        if (draftShape.type === 'circle') {
          L.circle(draftShape.center, { ...draftStyle, radius: draftShape.radius }).addTo(geofenceLayer);
          L.marker(draftShape.center, { icon: focusIcon(), zIndexOffset: 700, keyboard: false }).addTo(geofenceLayer);
        } else {
          L.polygon(draftShape.latlngs, draftStyle).addTo(geofenceLayer);
          draftShape.latlngs.forEach(point => {
            L.circleMarker(point, { radius: 5, color: '#fde68a', weight: 2, fillColor: '#f59e0b', fillOpacity: 0.9, interactive: false }).addTo(geofenceLayer);
          });
        }
      }
    }

    function sync({ devices, selectedDeviceId, route, tracks, playback, fitToken, fusion, alarms, focus, geofences, geofenceDraft, picking, onPickPoint, onSelect, seamarks } = {}) {
      if (typeof seamarks === 'boolean') setSeamarks(seamarks);
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
      const points = trackList.flatMap(track => track.list.map(point => [point.lat, point.lng]));
      const trackKey = trackList
        .map(track => `${track.deviceId || 'route'}:${track.paired ? 'p' : 's'}:${track.list.length}:${track.list[0].lat},${track.list[0].lng},${track.list[track.list.length - 1].lat},${track.list[track.list.length - 1].lng}`)
        .join('|');
      const key = `${trackKey}#${playbackActive ? `pb:${Math.round((playbackTime || 0) / 1000)}` : 'static'}`;
      if (key !== routeKey) {
        routeKey = key;
        routeLayer.clearLayers();
        playbackLayer.clearLayers();
        trackList.forEach(track => {
          const drawn = sampleTrack(track.list);
          drawTrack(drawn, playbackActive ? playbackTime : null, track.paired);
          if (playbackActive) {
            const index = playbackIndex(drawn, playbackTime);
            const point = drawn[Math.max(0, Math.min(index, drawn.length - 1))];
            L.marker([point.lat, point.lng], { icon: playbackIcon(track.paired ? '#f59e0b' : '#38bdf8'), zIndexOffset: 1000, keyboard: false })
              .bindTooltip(track.label || 'Playback', { direction: 'top', offset: [0, -14] })
              .addTo(playbackLayer);
          }
        });
      }
      const playbackIds = new Set(playbackActive ? trackList.map(track => track.deviceId).filter(Boolean) : []);
      const fleet = (Array.isArray(devices) ? devices : []).filter(device =>
        device?.position && Number.isFinite(Number(device.position.lat)) && Number.isFinite(Number(device.position.lng))
      );
      const activeIds = new Set(fleet.map(device => String(device.id)));
      markers.forEach((marker, id) => {
        if (!activeIds.has(id)) {
          marker.remove();
          markers.delete(id);
        }
      });
      const fleetPoints = [];
      fleet.forEach(device => {
        const id = String(device.id);
        const point = [Number(device.position.lat), Number(device.position.lng)];
        const selected = Number(device.id) === Number(selectedDeviceId);
        // During playback the live marker would contradict the cursor, so the
        // tracked devices are shown by the playback pins instead.
        if (playbackIds.has(id)) {
          const stale = markers.get(id);
          if (stale) {
            stale.remove();
            markers.delete(id);
          }
          return;
        }
        fleetPoints.push(point);
        let marker = markers.get(id);
        if (!marker) {
          marker = L.marker(point, { icon: trackerIcon({ selected, online: device.online }), keyboard: true }).addTo(map);
          markers.set(id, marker);
        } else {
          marker.setLatLng(point);
          marker.setIcon(trackerIcon({ selected, online: device.online }));
        }
        marker.unbindTooltip().bindTooltip(deviceLabel(device), {
          permanent: true,
          direction: 'top',
          offset: [0, -13],
          className: `ss-tracker-label${selected ? ' selected' : ''}`
        });
        marker.unbindPopup().bindPopup(devicePopup(device), { minWidth: 230 });
        marker.off('click');
        if (typeof onSelect === 'function') marker.on('click', () => onSelect(device.id));
      });
      renderGeofences(geofences, geofenceDraft);
      pickMode = Boolean(picking);
      onPick = typeof onPickPoint === 'function' ? onPickPoint : null;
      const container = map.getContainer && map.getContainer();
      if (container && container.style) container.style.cursor = pickMode ? 'crosshair' : '';
      renderSensors(fusion);

      // SOS alarms: the exact fix reported with attributes.alarm, drawn like the
      // Traccar alarm marker (pulsing pin + translucent radius) so an alert is
      // visible on the map, not only in the inbox.
      const alarmList = (Array.isArray(alarms) ? alarms : []).filter(alarm =>
        alarm
        && alarm.lat !== null && alarm.lat !== undefined && alarm.lat !== ''
        && alarm.lng !== null && alarm.lng !== undefined && alarm.lng !== ''
        && Number.isFinite(Number(alarm.lat)) && Number.isFinite(Number(alarm.lng))
      );
      const alarmIds = new Set(alarmList.map(alarm => String(alarm.deviceId)));
      alarmMarkers.forEach((entry, id) => {
        if (!alarmIds.has(id)) {
          entry.marker.remove();
          entry.circle.remove();
          alarmMarkers.delete(id);
        }
      });
      const alarmPoints = [];
      alarmList.forEach(alarm => {
        const id = String(alarm.deviceId);
        const point = [Number(alarm.lat), Number(alarm.lng)];
        alarmPoints.push(point);
        let entry = alarmMarkers.get(id);
        if (!entry) {
          const circle = L.circle(point, {
            radius: 60, color: '#ef4444', weight: 1.5, opacity: 0.85,
            fillColor: '#ef4444', fillOpacity: 0.18, interactive: false
          }).addTo(map);
          const marker = L.marker(point, { icon: alarmIcon(), zIndexOffset: 900, keyboard: false }).addTo(map);
          entry = { marker, circle };
          alarmMarkers.set(id, entry);
        } else {
          entry.marker.setLatLng(point);
          entry.circle.setLatLng(point);
        }
        entry.marker.unbindPopup().bindPopup(alarmPopup(alarm), { minWidth: 210 });
      });

      const fleetKey = fleet.map(device => String(device.id)).sort().join(',');
      const alarmKey = alarmList
        .map(alarm => `${alarm.deviceId}:${alarmTime(alarm) || `${alarm.lat},${alarm.lng}`}`)
        .sort()
        .join(',');
      if ((!didFit || fleetKey !== lastFleetKey || (!didFitRoute && points.length > 1)) && fleetPoints.length) {
        const bounds = L.latLngBounds(fleetPoints.concat(points, didFit ? [] : alarmPoints));
        if (fleetPoints.length === 1 && !points.length && !alarmPoints.length) map.setView(fleetPoints[0], 13, { animate: false });
        else map.fitBounds(bounds.pad(0.22), { maxZoom: 14, animate: false });
        didFit = true;
        if (points.length > 1) didFitRoute = true;
      } else if (alarmKey && alarmKey !== lastAlarmKey) {
        // A new SOS arrived while the map was open: bring the alarm into view
        // together with the device that raised it.
        const focus = alarmPoints.concat(
          fleet.filter(device => alarmIds.has(String(device.id)))
            .map(device => [Number(device.position.lat), Number(device.position.lng)])
        );
        if (focus.length) map.fitBounds(L.latLngBounds(focus).pad(0.4), { maxZoom: 14, animate: false });
      }
      lastFleetKey = fleetKey;
      lastAlarmKey = alarmKey;

      // A new history window (range or day change) refits the map so the whole
      // track is visible, even when the user had zoomed somewhere else.
      if (fitToken && fitToken !== lastFitToken && points.length > 1) {
        lastFitToken = fitToken;
        map.fitBounds(L.latLngBounds(points).pad(0.22), { maxZoom: 14, animate: false });
      }

      // A single history pin for a location opened from the Inbox — an alert
      // that is no longer active on the live SOS layer.
      const focusLat = focus ? Number(focus.lat) : NaN;
      const focusLng = focus ? Number(focus.lng) : NaN;
      if (Number.isFinite(focusLat) && Number.isFinite(focusLng)) {
        const key = String(focus.key || `${focusLat},${focusLng}`);
        if (key !== lastFocusKey) {
          const point = [focusLat, focusLng];
          if (focusMarker) focusMarker.setLatLng(point);
          else focusMarker = L.marker(point, { icon: focusIcon(), zIndexOffset: 850, keyboard: false }).addTo(map);
          focusMarker.unbindPopup().bindPopup(focusPopup(focus), { minWidth: 200 });
          map.setView(point, Math.max(map.getZoom(), 14), { animate: false });
          focusMarker.openPopup();
          lastFocusKey = key;
        }
      } else if (focusMarker) {
        focusMarker.remove();
        focusMarker = null;
        lastFocusKey = '';
      }
      setTimeout(() => {
        if (map.getContainer && map.getContainer()) map.invalidateSize();
      }, 0);
    }

    return {
      sync,
      resize: () => {
        map.invalidateSize();
      },
      destroy: () => {
        map.remove();
      }
    };
  }

  // Layout changes (fullscreen, side panels) must tell Leaflet to remeasure.
  function resize(host) {
    const instance = host && host.__smartSurfTrackerMap;
    if (instance && typeof instance.resize === 'function') instance.resize();
  }

  window.SmartSurfTrackerMap = {
    sync(host, data) {
      if (!host || !window.L) return null;
      if (!host.__smartSurfTrackerMap) host.__smartSurfTrackerMap = make(host);
      host.__smartSurfTrackerMap.sync(data);
      return host.__smartSurfTrackerMap;
    },
    resize,
    destroy(host) {
      if (host && host.__smartSurfTrackerMap) {
        host.__smartSurfTrackerMap.destroy();
        delete host.__smartSurfTrackerMap;
      }
    }
  };
}());
