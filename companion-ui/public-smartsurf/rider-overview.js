(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SmartSurfOverview = api;
})(typeof window === 'object' ? window : globalThis, function () {
  'use strict';
  const present = value => value != null && typeof value !== 'boolean' && String(value).trim() !== '' && Number.isFinite(Number(value));
  const coordinates = point => point && point.valid !== false && present(point.lat) && present(point.lng)
    && Math.abs(Number(point.lat)) <= 90 && Math.abs(Number(point.lng)) <= 180;
  const fixTime = point => Date.parse(point?.fixTime || point?.deviceTime || point?.timestamp || '');
  const recent = (point, now) => Number.isFinite(fixTime(point)) && fixTime(point) <= now + 300000 && now - fixTime(point) <= 300000;
  function freshDevice(device, remoteAvailable, now = Date.now()) {
    return remoteAvailable !== false && device.online === true && device.positionSource === 'live'
      && coordinates(device.position) && recent(device.position, now);
  }
  function chooseLocation({ browserPosition, devices = [], remoteAvailable, spots = [], profile = {}, now = Date.now() }) {
    const sport = profile.primary_sport || 'kitesurfing';
    if (coordinates(browserPosition) && recent(browserPosition, now)) return {
      ...browserPosition, lat: Number(browserPosition.lat), lng: Number(browserPosition.lng),
      kind: 'browser', fresh: true, name: Number(browserPosition.accuracyM) > 1000 ? 'Your approximate location' : 'Your current location', sport
    };
    // A board/asset position does not establish the rider's whereabouts.
    const riderDevices = devices.filter(device => (device.deviceType === 'phone_app' || device.role === 'rider') && coordinates(device.position))
      .sort((a, b) => (fixTime(b.position) || 0) - (fixTime(a.position) || 0));
    const live = riderDevices.find(device => freshDevice(device, remoteAvailable, now));
    const last = riderDevices.find(device => Number.isFinite(fixTime(device.position)) && fixTime(device.position) <= now + 300000);
    const device = live || last;
    if (device) return {
      lat: Number(device.position.lat), lng: Number(device.position.lng), fixTime: device.position.fixTime || device.position.deviceTime || device.position.timestamp,
      kind: live ? 'tracker' : 'last_known', fresh: Boolean(live), deviceId: device.id,
      name: live ? `Your location · ${device.name || 'Rider tracker'}` : `Last known location · ${device.name || 'Rider tracker'}`, sport
    };
    const validSpots = spots.filter(spot => spot.status !== 'deleted' && coordinates(spot));
    const spot = validSpots.find(spot => String(spot.name).toLowerCase() === String(profile.home_spot || '').toLowerCase()) || validSpots[0];
    return spot ? { lat: Number(spot.lat), lng: Number(spot.lng), kind: 'spot', fresh: false, name: spot.name, sport: spot.sport || sport, spotId: spot.id } : null;
  }
  function describe({ context, location, sportProfiles = [], devices = [], remoteAvailable, sessions = [], sosCount = 0, separationCount = 0, units = {}, rider = {}, now = Date.now() }) {
    const current = context?.current || {};
    const metrics = [];
    const windUnit = units.wind || 'kmh';
    const wind = value => {
      if (!present(value)) return '—';
      const n = Number(value);
      if (windUnit === 'ms') return `${(n / 3.6).toFixed(1)} m/s`;
      if (windUnit === 'kn') return `${(n / 1.852).toFixed(1)} kn`;
      if (windUnit === 'bft') return `${Math.round(Math.pow(n / 3.6 / 0.836, 2 / 3))} Bft`;
      return `${n.toFixed(1)} km/h`;
    };
    const wave = value => `${(Number(value) * (units.wave === 'ft' ? 3.28084 : 1)).toFixed(1)} ${units.wave === 'ft' ? 'ft' : 'm'}`;
    const temperature = value => `${(units.temp === 'f' ? Number(value) * 9 / 5 + 32 : Number(value)).toFixed(1)} °${units.temp === 'f' ? 'F' : 'C'}`;
    const add = (label, key, format) => { if (present(current[key])) metrics.push({ label, value: format(current[key]) }); };
    add('Wind', 'windKmh', wind); add('Gusts', 'gustKmh', wind);
    add('Direction', 'windDirectionDeg', v => `${['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(Number(v) / 45) % 8]} · ${Math.round(Number(v))}°`);
    add('Air', 'temperatureC', temperature); add('Feels like', 'apparentTemperatureC', temperature); add('Water', 'waterTempC', temperature);
    add('Waves', 'waveM', wave); add('Wave period', 'periodS', v => `${Number(v).toFixed(1)} s`);
    add('Swell', 'swellM', wave); add('Swell period', 'swellPeriodS', v => `${Number(v).toFixed(1)} s`);
    add('Rain', 'rainMm', v => `${Number(v).toFixed(1)} mm`);
    if (!present(current.rainMm)) add('Precipitation', 'precipitationMm', v => `${Number(v).toFixed(1)} mm`);
    add('Rain chance', 'precipitationProbabilityPct', v => `${Math.round(Number(v))}%`);
    add('Visibility', 'visibilityM', v => `${(Number(v) / 1000).toFixed(1)} km`);
    add('Humidity', 'humidityPct', v => `${Math.round(Number(v))}%`); add('Cloud', 'cloudCoverPct', v => `${Math.round(Number(v))}%`);
    add('Pressure', 'pressureHpa', v => `${Math.round(Number(v))} hPa`);
    add('UV', 'uvIndex', v => Number(v).toFixed(1)); add('Tide level', 'tideLevelM', wave);
    const weatherCode = present(current.weatherCode) ? Number(current.weatherCode) : null;
    const weatherLabel = code => ({
      0:'Clear',1:'Mostly clear',2:'Partly cloudy',3:'Overcast',45:'Fog',48:'Freezing fog',
      51:'Light drizzle',53:'Drizzle',55:'Dense drizzle',56:'Freezing drizzle',57:'Dense freezing drizzle',
      61:'Light rain',63:'Moderate rain',65:'Heavy rain',66:'Freezing rain',67:'Heavy freezing rain',
      71:'Light snow',73:'Snow',75:'Heavy snow',77:'Snow grains',80:'Light showers',81:'Rain showers',82:'Heavy showers',
      85:'Snow showers',86:'Heavy snow showers',95:'Thunderstorm',96:'Thunderstorm with hail',99:'Severe thunderstorm'
    })[code] || (code >= 51 && code <= 67 ? 'Rain' : code >= 80 && code <= 82 ? 'Rain showers' : null);
    const rainAmountMm = present(current.rainMm) ? Number(current.rainMm) : present(current.precipitationMm) ? Number(current.precipitationMm) : null;
    const weatherCodeRain = weatherCode != null && ((weatherCode >= 51 && weatherCode <= 67) || (weatherCode >= 80 && weatherCode <= 82));
    const rainReported = weatherCodeRain || rainAmountMm >= 2.5;
    const thunderstorms = weatherCode != null && [95, 96, 99].includes(weatherCode);
    const heavyRain = weatherCode != null && [65, 67, 82].includes(weatherCode) || rainAmountMm >= 7.5;
    const currentWeather = heavyRain ? 'Heavy rain' : weatherCode == null ? null : weatherLabel(weatherCode);
    const dark = present(current.isDay) && Number(current.isDay) === 0;
    const poorVisibility = present(current.visibilityM) && Number(current.visibilityM) < 2000;
    if (currentWeather && (weatherCodeRain || thunderstorms || heavyRain || weatherCode >= 45 && weatherCode <= 48 || weatherCode >= 71 && weatherCode <= 86)) {
      metrics.push({ label: 'Weather', value: currentWeather });
    } else if (!currentWeather && rainReported) metrics.push({ label: 'Weather', value: heavyRain ? 'Heavy rain' : 'Rain' });
    if (dark) metrics.push({ label: 'Daylight', value: 'Dark at this spot' });
    const source = context?.evidence?.atmosphereSource;
    const sourceLabel = context?.stale ? 'Older cached weather' : source === 'model-derived' ? 'Modeled weather' : 'Current weather';
    const profile = sportProfiles.find(p => p.sport === location?.sport && p.primary) || sportProfiles.find(p => p.sport === location?.sport);
    const conditions = profile?.conditions || {};
    const sentences = [];
    if (present(current.windKmh)) {
      const inRange = present(conditions.minWindKmh) && present(conditions.maxWindKmh)
        ? Number(current.windKmh) >= Number(conditions.minWindKmh) && Number(current.windKmh) <= Number(conditions.maxWindKmh) : null;
      sentences.push(`${sourceLabel} puts wind at ${wind(current.windKmh)}${present(current.gustKmh) ? `, gusting ${wind(current.gustKmh)}` : ''}${inRange == null ? '.' : inRange ? ', inside your profile’s wind range.' : ', outside your profile’s wind range.'}`);
    }
    if (present(current.gustKmh) && present(conditions.maxWindKmh) && Number(current.gustKmh) > Number(conditions.maxWindKmh)) sentences.push('Gusts exceed the top of your saved wind range.');
    if (present(current.waveM)) sentences.push(`Waves are ${wave(current.waveM)}${present(current.periodS) ? ` at ${Number(current.periodS).toFixed(1)} seconds` : ''}${present(current.swellM) ? `, with ${wave(current.swellM)} swell${present(current.swellPeriodS) ? ` at ${Number(current.swellPeriodS).toFixed(1)} seconds` : ''}` : ''}.`);
    if (present(current.waveM) && present(conditions.minWaveM) && present(conditions.maxWaveM)) sentences.push(Number(current.waveM) >= Number(conditions.minWaveM) && Number(current.waveM) <= Number(conditions.maxWaveM) ? 'Wave height is inside your saved range.' : 'Wave height is outside your saved range.');
    if (!present(current.waveM) && present(current.swellM)) sentences.push(`Swell is ${wave(current.swellM)}${present(current.swellPeriodS) ? ` at ${Number(current.swellPeriodS).toFixed(1)} seconds` : ''}.`);
    if (present(current.temperatureC)) sentences.push(`Air is ${temperature(current.temperatureC)}${present(current.apparentTemperatureC) ? `, feeling like ${temperature(current.apparentTemperatureC)}` : ''}${present(current.waterTempC) ? `; water is ${temperature(current.waterTempC)}` : ''}.`);
    if (present(current.precipitationProbabilityPct)) sentences.push(`Rain chance is ${Math.round(Number(current.precipitationProbabilityPct))}%.`);
    else if (present(current.rainMm) || present(current.precipitationMm)) sentences.push(`${sourceLabel} reports ${Number(current.rainMm ?? current.precipitationMm).toFixed(1)} mm precipitation.`);
    else if (present(current.weatherCode)) {
      const code = Number(current.weatherCode);
      if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) sentences.push('The weather feed indicates rain or drizzle.');
    }
    if (currentWeather) sentences.push(`${context?.stale ? 'The older weather read reports' : 'The weather feed reports'} ${currentWeather.toLowerCase()}.`);
    if (dark) sentences.push('It is dark at this location; wait for daylight before riding.');
    if (thunderstorms) sentences.push('Stay off the water while thunderstorms are nearby.');
    if (heavyRain) sentences.push('Wait for the heavy rain to ease before heading out.');
    else if (rainReported) sentences.push('Rain is reported; check sightlines at the launch before deciding.');
    const active = sessions.filter(s => s.status === 'active' && !s.ended_at && !s.endedAt).length;
    const fresh = devices.filter(d => freshDevice(d, remoteAvailable, now)).length;
    const missing = (Array.isArray(context?.unknowns) ? context.unknowns : []).map(item => typeof item === 'string' ? item : item?.detail || item?.message || item?.variable).filter(Boolean).slice(0, 2);
    const caveat = context?.outcome === 'NO_GO' ? 'The current assessment reports no-go conditions here. Do not treat this as a launch window.'
      : context?.stale ? 'Weather is cached and older; recheck local conditions before deciding.'
      : context?.outcome === 'CAUTION' ? 'The current assessment flags caution here. Review the local hazards before riding.'
      : context?.outcome === 'INSUFFICIENT_EVIDENCE' || !context?.outcome ? `Local launch conditions still need checking${missing.length ? `: ${missing.join('; ')}` : '.'}`
      : 'Check the launch and changing conditions on site before heading out.';
    const title = sosCount ? 'An SOS needs your attention' : separationCount ? 'Rider and board separation needs attention'
      : context?.outcome === 'NO_GO' ? 'Conditions call for staying off the water'
      : thunderstorms ? 'Thunderstorms need attention before riding' : active ? 'Your session is recording' : context ? location?.kind === 'last_known' ? 'Conditions at your last known location' : location?.kind === 'spot' ? 'Conditions at your saved spot' : 'Here is the situation around you' : location ? 'Checking conditions at this location' : 'Let’s find the conditions around you';
    const status = `${active ? `${active} open session${active === 1 ? '' : 's'}` : 'No session recording'} · ${fresh} of ${devices.length} trackers reporting fresh positions${sosCount || separationCount ? ` · ${sosCount + separationCount} safety alert${sosCount + separationCount === 1 ? '' : 's'}` : ''}`;
    const clean = value => String(value || '').replace(/senlay/gi, 'SmartSurf').replace(/[_]+/g, ' ').trim();
    const compass = value => ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'][Math.round(((Number(value) % 360) + 360) % 360 / 45) % 8];
    const comparisons = Array.isArray(context?.trust?.comparisons) ? context.trust.comparisons : [];
    const comparison = field => comparisons.find(c => c.field === field);
    const speedComparison = comparison('wind_speed');
    const directionComparison = comparison('wind_direction');
    const providers = context?.sources?.providers || [];
    const windProvider = providers.find(p => p.selected && p.kind === 'measured' && present(p.snapshot?.windKmh)
      && present(current.windKmh) && Math.abs(Number(p.snapshot.windKmh) - Number(current.windKmh)) < 0.2);
    const primary = speedComparison?.primary_source || context?.trust?.primarySensor;
    const primaryMatches = primary && present(speedComparison?.hardware_value) && present(current.windKmh)
      && Math.abs(Number(speedComparison.hardware_value) - Number(current.windKmh)) < 0.2;
    const station = primaryMatches ? primary : windProvider?.snapshot;
    const stationName = clean(station?.name || station?.stationName);
    const stationDistance = station?.distance_km ?? station?.distanceKm;
    const stationAt = station?.observed_at || station?.observedAt;
    const stationTime = typeof stationAt === 'string' ? Date.parse(/[zZ]|[+-]\d\d:\d\d$/.test(stationAt) ? stationAt : `${stationAt}Z`) : NaN;
    const stationAge = Number.isFinite(stationTime) ? Math.max(0, Math.round((now - stationTime) / 60000)) : null;
    const staleStation = station?.freshness?.state === 'stale' || (stationAge != null && present(station?.freshness?.max_age_minutes ?? station?.freshness?.maxAgeMinutes)
      && stationAge > Number(station.freshness.max_age_minutes ?? station.freshness.maxAgeMinutes));
    const windRangeKnown = present(conditions.minWindKmh) && present(conditions.maxWindKmh);
    const windFits = windRangeKnown && present(current.windKmh)
      ? Number(current.windKmh) >= Number(conditions.minWindKmh) && Number(current.windKmh) <= Number(conditions.maxWindKmh) : null;
    const waveRangeKnown = present(conditions.minWaveM) && present(conditions.maxWaveM);
    const waveFits = waveRangeKnown && present(current.waveM)
      ? Number(current.waveM) >= Number(conditions.minWaveM) && Number(current.waveM) <= Number(conditions.maxWaveM) : null;
    const gustOverLimit = present(current.gustKmh) && present(conditions.maxWindKmh) && Number(current.gustKmh) > Number(conditions.maxWindKmh);
    const periodFits = present(conditions.minPeriodS) ? present(current.periodS) ? Number(current.periodS) >= Number(conditions.minPeriodS) : null : true;
    const preferredDirections = Array.isArray(profile?.preferences?.directions) ? profile.preferences.directions : [];
    const direction = present(current.windDirectionDeg) ? ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'][Math.round(((Number(current.windDirectionDeg) % 360) + 360) % 360 / 22.5) % 16] : null;
    const directionOutside = direction && preferredDirections.length > 0 && !preferredDirections.includes(direction);
    const fits = ['surfing', 'bodyboarding'].includes(location?.sport)
      ? waveFits === false || periodFits === false ? false : waveFits === true && periodFits === true ? true : null : windFits;
    const majorDisagreement = present(speedComparison?.hardware_value) && present(speedComparison?.model_value) && Math.abs(Number(speedComparison.hardware_value) - Number(speedComparison.model_value)) >= 10;
    const weatherConcerns = [
      thunderstorms ? 'thunderstorms nearby' : null,
      dark ? 'darkness at this spot' : null,
      heavyRain ? 'heavy rain' : null,
      poorVisibility ? 'poor visibility' : null
    ].filter(Boolean);
    const verdict = !context ? '' : weatherConcerns.length ? `Wait — ${weatherConcerns.join(', ')}; stay ashore until conditions improve.`
      : rainReported ? source === 'model-derived' ? 'Rain appears in the forecast — verify intensity and visibility at the launch.' : 'Rain is reported — check visibility at the launch before deciding.'
      : context.outcome === 'NO_GO' ? 'No-go — stay off the water for now.'
      : context.stale || staleStation ? 'Pause — update the weather before deciding.'
      : fits === false || gustOverLimit ? 'Wait — these readings are outside your saved range.'
      : directionOutside ? 'Caution — wind direction is outside your saved preferences.'
      : context.outcome === 'CAUTION' ? 'Caution — take a closer look before launching.'
      : context.outcome === 'GO' && fits === true && location?.fresh === true ? 'Go — with local checks before launching.'
      : fits === true ? 'Conditions fit your range — recheck the launch.'
      : 'Here’s what the conditions mean for your ride.';
    const opening = [];
    if (present(current.windKmh)) {
      const attribution = stationName ? `${stationName}${present(stationDistance) ? ` (${Number(stationDistance).toFixed(1)} km away)` : ''}`
        : source === 'model-derived' ? 'Forecast' : 'Weather read';
      opening.push(`${attribution}: ${wind(current.windKmh)} wind${present(current.windDirectionDeg) ? ` from ${compass(current.windDirectionDeg)}` : ''}${present(current.gustKmh) ? `, gusts ${wind(current.gustKmh)}` : ''}.`);
    }
    if (!opening.length && metrics.length) opening.push(source === 'model-derived' ? 'Forecast conditions are available for this location.' : 'Current conditions are available for this location.');
    const fitNotes = [];
    if (windFits != null) fitNotes.push(windFits ? 'Wind is within your saved range.' : `Wind is outside your saved ${wind(conditions.minWindKmh)}–${wind(conditions.maxWindKmh)} range.`);
    if (gustOverLimit) fitNotes.push('Gusts exceed your saved maximum.');
    if (directionOutside) fitNotes.push(`${direction} is outside your preferred directions (${preferredDirections.map(clean).join(' · ')}).`);
    if (periodFits === false) fitNotes.push(`Wave period is below your ${Number(conditions.minPeriodS).toFixed(1)} s minimum.`);
    if (['surfing', 'bodyboarding'].includes(location?.sport) && present(current.waveM)) fitNotes.push(`Waves ${wave(current.waveM)}${present(current.periodS) ? ` at ${Number(current.periodS).toFixed(1)} s` : ''}${waveFits == null ? '' : waveFits ? ', within range.' : ', outside range.'}`);
    if (!fitNotes.length && present(current.windKmh)) fitNotes.push('Compare wind and gusts with your usual limits.');
    const conditionNote = weatherConcerns.length
      ? `Priority: ${weatherConcerns.join(', ')}. Wait until conditions improve.`
      : rainReported
        ? source === 'model-derived' ? 'Forecast indicates showers; rain intensity and visibility at the launch are unverified.' : 'Rain is reported; check visibility at the launch.'
        : '';
    const dataNotes = [];
    if (speedComparison && present(speedComparison.hardware_value) && present(speedComparison.model_value)) {
      const delta = Math.abs(Number(speedComparison.hardware_value) - Number(speedComparison.model_value));
      if (delta >= 10) dataNotes.push(`Station and forecast differ by ${windUnit === 'bft' ? `${delta.toFixed(1)} km/h` : wind(delta)} (${wind(speedComparison.hardware_value)} vs ${wind(speedComparison.model_value)}).`);
    }
    if (directionComparison && present(directionComparison.hardware_value) && present(directionComparison.model_value)) {
      const difference = Math.abs(Number(directionComparison.hardware_value) - Number(directionComparison.model_value)) % 360;
      const delta = Math.min(difference, 360 - difference);
      if (delta >= 45) dataNotes.push(`Station and forecast direction differ by ${Math.round(delta)}°.`);
    }
    if (context?.stale || staleStation) dataNotes.push(context?.stale ? 'Weather is cached and may be out of date.' : `Station reading is ${stationAge != null && stationAge < 1 ? 'under a minute' : `${stationAge ?? 'unknown'} min`} old${present(stationDistance) ? ` and ${Number(stationDistance).toFixed(1)} km away` : ''}.`);
    else if (source === 'model-derived' && !rainReported) dataNotes.push('Forecast conditions do not confirm what is happening at the launch.');
    if (location?.kind === 'last_known') dataNotes.push('Location is the last known position.');
    else if (location?.kind === 'spot') dataNotes.push('Conditions are for this saved spot.');
    const actions = sosCount ? 'Review the active SOS in Trackers first.'
      : separationCount ? 'Review the rider/board separation alert in Trackers first.'
      : context?.outcome === 'NO_GO' || weatherConcerns.length || thunderstorms ? 'Stay ashore until the hazard clears.'
      : rainReported ? 'Check actual rain and visibility at the launch before deciding.'
      : context?.stale || staleStation || majorDisagreement ? 'Refresh the reading and compare it with conditions at the launch.'
      : fits === false || gustOverLimit ? 'Wait for wind and gusts closer to your saved range.'
      : 'Recheck wind and the route back at the launch.';
    const sections = context && metrics.length ? [
      ...(conditionNote ? [{heading:'Conditions',text:conditionNote}] : []),
      ...(fitNotes.length ? [{heading:'Your fit',text:fitNotes.join(' ')}] : []),
      ...(dataNotes.length ? [{heading:'Data note',text:dataNotes.join(' ')}] : []),
      {heading:'Next step',text:actions}
    ] : [];
    const reporting = context?.sources?.activeCount ?? context?.evidence?.activeSources ?? context?.activeSources;
    const checks = [{label:'Checked',value:`${present(reporting) ? `${Number(reporting)} reporting sources · ` : ''}${metrics.length} available weather fields`}];
    if (context?.outcome) checks.push({label:'Assessment',value:({GO:'Go, with local checks',CAUTION:'Caution',NO_GO:'No-go',INSUFFICIENT_EVIDENCE:'Weather available; launch checks remain'})[context.outcome] || 'Launch checks remain'});
    if (stationName) checks.push({label:'Wind source',value:`${stationName}${present(stationDistance) ? ` · ${Number(stationDistance).toFixed(1)} km away` : ''}`});
    if (source === 'model-derived') checks.push({label:'Wind source',value:'Forecast model'});
    if (context?.evidence?.waterSource === 'model-derived') checks.push({label:'Marine source',value:'Forecast model'});
    const guide = {verdict,opening:opening.join(' '),sections,checks};
    return { title, body: sentences.join(' '), metrics, caveat: clean(caveat), status, sourceLabel, active, fresh, guide };
  }
  return { coordinates, chooseLocation, describe, freshDevice };
});
