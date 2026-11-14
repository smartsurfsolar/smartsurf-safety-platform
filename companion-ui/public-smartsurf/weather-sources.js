(function (root) {
  'use strict';
  const providers = [
    { id: 'xweather', name: 'Xweather', kind: 'Weather service' },
    { id: 'visual_crossing', name: 'Visual Crossing', kind: 'Weather service' },
    { id: 'weatherxm', name: 'WeatherXM', kind: 'Nearby weather stations' },
    { id: 'stormglass_marine', name: 'Stormglass', kind: 'Marine model' },
    { id: 'windy_stations', name: 'Windy Stations', kind: 'Weather station sensors' }
  ];
  function number(value) {
    if (value == null || typeof value === 'boolean' || String(value).trim() === '') return null;
    const result = Number(value);
    return Number.isFinite(result) ? result : null;
  }
  function format(value, scale, unit) {
    const parsed = number(value);
    return parsed == null ? null : (parsed * scale).toFixed(1) + ' ' + unit;
  }
  function wind(value, unit = 'ms') {
    const [scale, label] = ({ ms: [1 / 3.6, 'm/s'], kn: [1 / 1.852, 'kt'], kmh: [1, 'km/h'], mph: [1 / 1.609344, 'mph'] })[unit] || [1 / 3.6, 'm/s'];
    return format(value, scale, label);
  }
  function wave(value, unit = 'm') {
    return format(value, unit === 'ft' ? 3.28084 : 1, unit === 'ft' ? 'ft' : 'm');
  }
  function rows(context, units = {}) {
    const sources = Array.isArray(context?.sources?.providers) ? context.sources.providers : [];
    return providers.map(meta => {
      const source = sources.find(item => item?.id === meta.id || item?.name === meta.name);
      const available = Boolean(source?.hasData);
      const reason = source?.availabilityReason || source?.status || 'unknown';
      const labels = {
        rate_limited: 'Rate limited', plan_limit: 'Account limit', access_rejected: 'Access unavailable', disabled: 'Disabled',
        not_configured: 'Not configured', timeout: 'Timed out', out_of_coverage: 'No coverage',
        not_applicable: 'Not applicable', no_data: 'No readings', error: 'Unavailable', unknown: 'No status yet'
      };
      const snapshot = available && source?.snapshot ? source.snapshot : {};
      const measured = meta.id === 'windy_stations' || meta.id === 'weatherxm';
      const timestamp = snapshot.observedAt && Number.isFinite(Date.parse(snapshot.observedAt)) ? snapshot.observedAt : null;
      const stale = measured && (snapshot.freshnessState === 'stale' || (timestamp && Date.now() - Date.parse(timestamp) > 2 * 60 * 60 * 1000));
      const label = available ? (stale ? 'Last known' : source?.selected ? 'Used now' : 'Available') : (labels[reason] || 'Unavailable');
      const stationName = measured && typeof snapshot.stationName === 'string' ? snapshot.stationName.slice(0, 160) : '';
      const stationDistance = measured && number(snapshot.distanceKm) != null && number(snapshot.distanceKm) >= 0 ? format(snapshot.distanceKm, 1, 'km away') : '';
      const stationLabel = [stationName, stationDistance].filter(Boolean).join(' · ');
      const attribution = measured && typeof snapshot.attribution === 'string' ? snapshot.attribution.slice(0, 200) : '';
      const readings = [];
      const add = (name, value) => { if (value != null) readings.push({ name, value }); };
      add('Wind', wind(snapshot.windKmh, units.wind));
      add('Gusts', wind(snapshot.gustKmh, units.wind));
      add('Waves', wave(snapshot.waveM, units.wave));
      add('Period', format(snapshot.periodS, 1, 's'));
      const temperature = number(snapshot.temperatureC);
      add('Air', temperature == null ? null : format(units.temp === 'f' ? temperature * 1.8 + 32 : temperature, 1, units.temp === 'f' ? '°F' : '°C'));
      const water = number(snapshot.waterTempC);
      add('Water', water == null ? null : format(units.temp === 'f' ? water * 1.8 + 32 : water, 1, units.temp === 'f' ? '°F' : '°C'));
      const detail = available ? (stale ? 'Older station observation; conditions may have changed.' : measured && !timestamp ? 'Observation time is unavailable.' : readings.length ? '' : 'No current readings supplied.')
        : reason === 'rate_limited' ? 'The provider is limiting requests. Readings will return when access is available.'
        : reason === 'plan_limit' ? 'Provider access is limited by its account plan or quota.'
        : reason === 'disabled' ? 'This source is currently turned off.'
        : reason === 'not_configured' ? 'This source is not connected.'
        : reason === 'out_of_coverage' || reason === 'no_data' ? 'No usable readings for this location.'
        : source ? 'Senlay could not retrieve usable data from this provider.' : 'Senlay has not reported this source yet.';
      return { ...meta, available, label, cls: available && !stale ? 'p-good' : stale || reason === 'rate_limited' || reason === 'plan_limit' ? 'p-warn' : 'p-unk',
        stationLabel, hasStation: Boolean(stationLabel), attribution, hasAttribution: Boolean(attribution), timeHeading: measured ? 'Observation time' : 'Provider time',
        readings, hasReadings: readings.length > 0, timestamp, detail, hasDetail: Boolean(detail) };
    });
  }
  const api = { rows, wind, wave };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SmartSurfWeatherSources = api;
}(typeof window === 'undefined' ? null : window));
