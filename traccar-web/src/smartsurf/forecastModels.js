const WEATHER_MODELS = [
  {
    id: 'openmeteo_best',
    name: 'Open-Meteo Best Match',
    endpoint: 'https://api.open-meteo.com/v1/forecast',
    weight: 1,
  },
  {
    id: 'noaa_gfs_hrrr',
    name: 'NOAA GFS / HRRR',
    endpoint: 'https://api.open-meteo.com/v1/gfs',
    weight: 0.9,
  },
  {
    id: 'ecmwf_ifs',
    name: 'ECMWF IFS / AIFS',
    endpoint: 'https://api.open-meteo.com/v1/ecmwf',
    weight: 0.9,
  },
];

const MARINE_MODEL = {
  id: 'openmeteo_marine',
  name: 'Open-Meteo Marine',
  endpoint: 'https://marine-api.open-meteo.com/v1/marine',
  weight: 0.85,
};

const STATIC_TIDE_PROFILES = [
  {
    id: 'hoi_an',
    name: 'Hoi An / An Bang - Cua Dai',
    lat: 15.8801,
    lon: 108.338,
    tideType: 'local beachbreak profile',
    preferredSurfStages: ['incoming toward high', 'near high', 'mid tide'],
    avoidStages: ['very low water', 'fast outgoing tide near river mouth'],
    smallWaveGuidance:
      'For small short-period surf, favor incoming to mid/high tide so the wave has more water and less exposed inside section.',
    confidence: 0.38,
  },
  {
    id: 'mui_ne',
    name: 'Mui Ne',
    lat: 10.9333,
    lon: 108.2833,
    tideType: 'local beachbreak profile',
    preferredSurfStages: ['mid tide', 'incoming toward high'],
    avoidStages: ['very low water', 'strong afternoon wind texture'],
    smallWaveGuidance:
      'For marginal surf, use mid or incoming tide before the thermal wind adds texture.',
    confidence: 0.34,
  },
  {
    id: 'generic_beachbreak',
    name: 'Generic beachbreak',
    lat: null,
    lon: null,
    tideType: 'generic static surf heuristic',
    preferredSurfStages: ['incoming toward high', 'mid tide'],
    avoidStages: ['very low water over shallow bottom', 'strong outgoing current near inlets'],
    smallWaveGuidance:
      'On small short-period days, incoming to mid/high tide is usually the safer first check; exact break bathymetry can override this.',
    confidence: 0.26,
  },
];

const FORECAST_HOURS = 24;
const HISTORY_HOURS = 24;
const TIDE_PAST_DAYS = 1;
const TIDE_FORECAST_DAYS = 2;

const toNumber = (value, fallback = null) => {
  if (value === null || value === undefined || value === '') return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const round = (value, precision = 1) => {
  const number = toNumber(value);
  if (number === null) return null;
  const multiplier = 10 ** precision;
  return Math.round(number * multiplier) / multiplier;
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const kmhFromKnots = (value) => {
  const number = toNumber(value);
  return number === null ? null : number * 1.852;
};

const kmBetween = (a, b) => {
  if (!a || !b) return 0;
  const lat1 = toNumber(a.latitude ?? a.lat);
  const lon1 = toNumber(a.longitude ?? a.lon ?? a.lng);
  const lat2 = toNumber(b.latitude ?? b.lat);
  const lon2 = toNumber(b.longitude ?? b.lon ?? b.lng);
  if ([lat1, lon1, lat2, lon2].some((value) => value === null)) return 0;
  const radiusKm = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const sLat1 = (lat1 * Math.PI) / 180;
  const sLat2 = (lat2 * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(sLat1) * Math.cos(sLat2) * Math.sin(dLon / 2) ** 2;
  return radiusKm * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

const nearestStaticTideProfile = (center) => {
  const lat = toNumber(center?.lat ?? center?.latitude);
  const lon = toNumber(center?.lon ?? center?.lng ?? center?.longitude);
  if (lat === null || lon === null) {
    return {
      ...STATIC_TIDE_PROFILES.find((profile) => profile.id === 'generic_beachbreak'),
      distanceKm: null,
      source: 'static_generic_profile',
    };
  }
  const positioned = STATIC_TIDE_PROFILES.filter(
    (profile) => profile.lat !== null && profile.lon !== null,
  )
    .map((profile) => ({
      ...profile,
      distanceKm: kmBetween(
        { latitude: lat, longitude: lon },
        { latitude: profile.lat, longitude: profile.lon },
      ),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm);
  const nearest = positioned[0];
  if (nearest && nearest.distanceKm <= 80) {
    return {
      ...nearest,
      confidence: round(nearest.confidence * (nearest.distanceKm <= 8 ? 1 : 0.75), 2),
      source: 'static_nearest_spot_profile',
    };
  }
  return {
    ...STATIC_TIDE_PROFILES.find((profile) => profile.id === 'generic_beachbreak'),
    distanceKm: null,
    source: 'static_generic_profile',
  };
};

const bearingDeg = (a, b) => {
  const lat1 = toNumber(a?.latitude ?? a?.lat);
  const lon1 = toNumber(a?.longitude ?? a?.lon ?? a?.lng);
  const lat2 = toNumber(b?.latitude ?? b?.lat);
  const lon2 = toNumber(b?.longitude ?? b?.lon ?? b?.lng);
  if ([lat1, lon1, lat2, lon2].some((value) => value === null)) return null;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const lambda = ((lon2 - lon1) * Math.PI) / 180;
  const y = Math.sin(lambda) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(lambda);
  return (Math.atan2(y, x) * 180) / Math.PI + 360;
};

const normalizeBearing = (value) => {
  const number = toNumber(value);
  if (number === null) return null;
  return ((number % 360) + 360) % 360;
};

const directionDifference = (a, b) => {
  const first = normalizeBearing(a);
  const second = normalizeBearing(b);
  if (first === null || second === null) return null;
  const diff = Math.abs(first - second) % 360;
  return diff > 180 ? 360 - diff : diff;
};

const weightedAverage = (items, key) => {
  const valid = items
    .map((item) => ({ value: toNumber(item[key]), weight: item.weight || 1 }))
    .filter((item) => item.value !== null);
  if (!valid.length) return null;
  const totalWeight = valid.reduce((sum, item) => sum + item.weight, 0);
  return valid.reduce((sum, item) => sum + item.value * item.weight, 0) / totalWeight;
};

const circularAverage = (items, key) => {
  const valid = items
    .map((item) => ({ value: normalizeBearing(item[key]), weight: item.weight || 1 }))
    .filter((item) => item.value !== null);
  if (!valid.length) return null;
  const vector = valid.reduce(
    (sum, item) => ({
      x: sum.x + Math.cos((item.value * Math.PI) / 180) * item.weight,
      y: sum.y + Math.sin((item.value * Math.PI) / 180) * item.weight,
    }),
    { x: 0, y: 0 },
  );
  return normalizeBearing((Math.atan2(vector.y, vector.x) * 180) / Math.PI);
};

const spread = (values) => {
  const valid = values.map((value) => toNumber(value)).filter((value) => value !== null);
  if (valid.length < 2) return 0;
  return Math.max(...valid) - Math.min(...valid);
};

const minMax = (values) => {
  const valid = values.map((value) => toNumber(value)).filter((value) => value !== null);
  if (!valid.length) return { min: null, max: null, range: null };
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  return { min, max, range: max - min };
};

const formatHour = (time) =>
  new Date(time).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

const tideLabel = (event) =>
  event ? `${event.type === 'high' ? 'high' : 'low'} ${formatHour(event.timestamp)}` : 'n/a';

const tideStage = ({ level, min, range, trend, next }) => {
  if (level === null || min === null || !range || range < 0.08) return 'unknown';
  const position = clamp((level - min) / range, 0, 1);
  const minutesToNext = next ? (next.timestamp - Date.now()) / 60000 : null;
  if (minutesToNext !== null && minutesToNext >= 0 && minutesToNext < 90) {
    return next.type === 'high' ? 'near high' : 'near low';
  }
  if (trend === 'rising') return position < 0.45 ? 'incoming from low' : 'incoming toward high';
  if (trend === 'falling') return position > 0.55 ? 'outgoing from high' : 'outgoing toward low';
  if (position > 0.72) return 'high water';
  if (position < 0.28) return 'low water';
  return 'mid tide';
};

const tideTrend = (current, previous) => {
  if (!current || !previous || current.tideLevelM === null || previous.tideLevelM === null) {
    return 'unknown';
  }
  const delta = current.tideLevelM - previous.tideLevelM;
  if (delta > 0.03) return 'rising';
  if (delta < -0.03) return 'falling';
  return 'steady';
};

const tideExtrema = (hours) => {
  const valid = hours
    .filter((hour) => hour.tideLevelM !== null)
    .sort((a, b) => a.timestamp - b.timestamp);
  const events = [];
  valid.forEach((hour, index) => {
    const previous = valid[index - 1];
    const next = valid[index + 1];
    if (!previous || !next) return;
    if (hour.tideLevelM >= previous.tideLevelM && hour.tideLevelM > next.tideLevelM) {
      events.push({
        type: 'high',
        timestamp: hour.timestamp,
        time: hour.time,
        levelM: hour.tideLevelM,
      });
    }
    if (hour.tideLevelM <= previous.tideLevelM && hour.tideLevelM < next.tideLevelM) {
      events.push({
        type: 'low',
        timestamp: hour.timestamp,
        time: hour.time,
        levelM: hour.tideLevelM,
      });
    }
  });
  return events;
};

const buildTidePrediction = ({ marine, fusion, center }) => {
  const staticProfile = nearestStaticTideProfile(center);
  const gauge = fusion?.tides;
  if (gauge && fusion?.tideLevelM != null) {
    return {
      source: 'senlay_tide_gauge',
      confidence: 0.86,
      currentLevelM: round(fusion.tideLevelM, 2),
      trend: 'observed',
      stage: 'observed tide gauge',
      nextHigh: gauge.next_high
        ? { type: 'high', time: gauge.next_high.time, levelM: round(gauge.next_high.level_m, 2) }
        : null,
      nextLow: gauge.next_low
        ? { type: 'low', time: gauge.next_low.time, levelM: round(gauge.next_low.level_m, 2) }
        : null,
      staticProfile,
      summary: `Live tide gauge level ${round(fusion.tideLevelM, 2)} m.`,
    };
  }

  const hours = marine?.hours?.filter((hour) => hour.tideLevelM !== null) || [];
  if (!hours.length) {
    return {
      source: staticProfile.source,
      confidence: staticProfile.confidence,
      currentLevelM: null,
      trend: 'unknown',
      stage: staticProfile.preferredSurfStages[0],
      nextHigh: null,
      nextLow: null,
      staticProfile,
      summary: `No tide gauge or sea-level model is available. Static ${staticProfile.name} profile: ${staticProfile.smallWaveGuidance}`,
    };
  }

  const now = Date.now();
  const current =
    nearestHour(hours, now, 95) || hours.find((hour) => hour.timestamp >= now) || hours[0];
  const previous = [...hours].reverse().find((hour) => hour.timestamp < current.timestamp) || null;
  const trend = tideTrend(current, previous);
  const extrema = tideExtrema(hours);
  const nextHigh = extrema.find((event) => event.timestamp > now && event.type === 'high') || null;
  const nextLow = extrema.find((event) => event.timestamp > now && event.type === 'low') || null;
  const nextEvent =
    [nextHigh, nextLow].filter(Boolean).sort((a, b) => a.timestamp - b.timestamp)[0] || null;
  const { min, max, range } = minMax(hours.map((hour) => hour.tideLevelM));
  const stage = tideStage({
    level: current.tideLevelM,
    min,
    range,
    trend,
    next: nextEvent,
  });

  return {
    source: 'openmeteo_sea_level_height_msl',
    confidence: range && range > 0.18 ? 0.62 : 0.46,
    currentLevelM: round(current.tideLevelM, 2),
    trend,
    stage,
    nextHigh: nextHigh
      ? { ...nextHigh, label: tideLabel(nextHigh), levelM: round(nextHigh.levelM, 2) }
      : null,
    nextLow: nextLow
      ? { ...nextLow, label: tideLabel(nextLow), levelM: round(nextLow.levelM, 2) }
      : null,
    rangeM: round(range, 2),
    minLevelM: round(min, 2),
    maxLevelM: round(max, 2),
    staticProfile,
    summary: `Tide proxy ${stage}, ${trend}, ${round(current.tideLevelM, 2)} m MSL. Next ${tideLabel(nextEvent)}. Static ${staticProfile.name} note: ${staticProfile.smallWaveGuidance}`,
  };
};

const tideForTimestamp = ({ marine, timestamp, tidePrediction }) => {
  const hour = marine.status === 'active' ? nearestHour(marine.hours, timestamp, 95) : null;
  if (!hour || hour.tideLevelM === null) {
    return {
      tideLevelM: null,
      tideStage: tidePrediction?.stage || 'unknown',
      tideTrend: tidePrediction?.trend || 'unknown',
    };
  }
  const tideHours = marine.hours.filter((item) => item.tideLevelM !== null);
  const previous = [...tideHours].reverse().find((item) => item.timestamp < hour.timestamp) || null;
  const { min, range } = minMax(tideHours.map((item) => item.tideLevelM));
  const trend = tideTrend(hour, previous);
  return {
    tideLevelM: round(hour.tideLevelM, 2),
    tideStage: tideStage({ level: hour.tideLevelM, min, range, trend }),
    tideTrend: trend,
  };
};

const providerFetch = async (url) => {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 5500);
  try {
    const response = await fetch(url, { signal: controller.signal });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.reason || payload.error || `Provider returned ${response.status}`);
    }
    return payload;
  } finally {
    window.clearTimeout(timeout);
  }
};

const weatherUrl = (center, model) => {
  const params = new URLSearchParams({
    latitude: String(center.lat),
    longitude: String(center.lon),
    hourly: [
      'temperature_2m',
      'wind_speed_10m',
      'wind_direction_10m',
      'wind_gusts_10m',
      'pressure_msl',
      'cloud_cover',
      'precipitation_probability',
    ].join(','),
    forecast_hours: String(FORECAST_HOURS),
    timezone: 'auto',
    wind_speed_unit: 'kmh',
  });
  return `${model.endpoint}?${params.toString()}`;
};

const marineUrl = (center) => {
  const params = new URLSearchParams({
    latitude: String(center.lat),
    longitude: String(center.lon),
    hourly: [
      'sea_level_height_msl',
      'wave_height',
      'wave_direction',
      'wave_period',
      'swell_wave_height',
      'swell_wave_direction',
      'swell_wave_period',
      'wind_wave_height',
      'wind_wave_period',
    ].join(','),
    past_days: String(TIDE_PAST_DAYS),
    forecast_days: String(TIDE_FORECAST_DAYS),
    timezone: 'auto',
  });
  return `${MARINE_MODEL.endpoint}?${params.toString()}`;
};

const normalizeWeatherModel = (model, payload) => {
  const hourly = payload.hourly || {};
  const times = hourly.time || [];
  const hours = times
    .map((time, index) => ({
      time,
      timestamp: Date.parse(time),
      windKmh: toNumber(hourly.wind_speed_10m?.[index]),
      gustKmh: toNumber(hourly.wind_gusts_10m?.[index]),
      windDirection: toNumber(hourly.wind_direction_10m?.[index]),
      temperatureC: toNumber(hourly.temperature_2m?.[index]),
      pressureHpa: toNumber(hourly.pressure_msl?.[index]),
      cloudCover: toNumber(hourly.cloud_cover?.[index]),
      precipitationProbability: toNumber(hourly.precipitation_probability?.[index]),
    }))
    .filter((item) => item.timestamp && item.windKmh !== null);
  return {
    ...model,
    status: 'active',
    hours,
    next: hours[0] || null,
  };
};

const normalizeMarineModel = (payload) => {
  const hourly = payload.hourly || {};
  const times = hourly.time || [];
  const hours = times
    .map((time, index) => ({
      time,
      timestamp: Date.parse(time),
      tideLevelM: toNumber(hourly.sea_level_height_msl?.[index]),
      waveM: toNumber(hourly.wave_height?.[index]),
      waveDirection: toNumber(hourly.wave_direction?.[index]),
      wavePeriodS: toNumber(hourly.wave_period?.[index]),
      swellM: toNumber(hourly.swell_wave_height?.[index]),
      swellDirection: toNumber(hourly.swell_wave_direction?.[index]),
      swellPeriodS: toNumber(hourly.swell_wave_period?.[index]),
      windWaveM: toNumber(hourly.wind_wave_height?.[index]),
      windWavePeriodS: toNumber(hourly.wind_wave_period?.[index]),
    }))
    .filter(
      (item) =>
        item.timestamp && (item.waveM !== null || item.swellM !== null || item.tideLevelM !== null),
    );
  return {
    ...MARINE_MODEL,
    status: 'active',
    hours,
    next: hours[0] || null,
  };
};

const failedModel = (model, error) => ({
  ...model,
  status: 'unavailable',
  hours: [],
  next: null,
  error: error?.message || 'Provider unavailable',
});

const nearestHour = (hours, timestamp, toleranceMinutes = 70) => {
  if (!hours?.length) return null;
  const tolerance = toleranceMinutes * 60000;
  let best = null;
  hours.forEach((hour) => {
    const distance = Math.abs(hour.timestamp - timestamp);
    if (distance <= tolerance && (!best || distance < best.distance)) {
      best = { hour, distance };
    }
  });
  return best?.hour || null;
};

const loadProviderModels = async (center) => {
  const weatherSettled = await Promise.allSettled(
    WEATHER_MODELS.map(async (model) =>
      normalizeWeatherModel(model, await providerFetch(weatherUrl(center, model))),
    ),
  );
  const models = weatherSettled.map((result, index) =>
    result.status === 'fulfilled'
      ? result.value
      : failedModel(WEATHER_MODELS[index], result.reason),
  );

  const marineSettled = await Promise.allSettled([
    providerFetch(marineUrl(center)).then(normalizeMarineModel),
  ]);
  const marine =
    marineSettled[0].status === 'fulfilled'
      ? marineSettled[0].value
      : failedModel(MARINE_MODEL, marineSettled[0].reason);

  return { models, marine };
};

const positionTimestamp = (position) =>
  Date.parse(position.fixTime || position.deviceTime || position.serverTime || position.validTime);

const summarizeTrackerHistory = (positions = []) => {
  const ordered = positions
    .filter(
      (position) => toNumber(position.latitude) !== null && toNumber(position.longitude) !== null,
    )
    .sort((a, b) => positionTimestamp(a) - positionTimestamp(b));
  if (ordered.length < 2) {
    return {
      status: 'unavailable',
      sampleCount: ordered.length,
      summary: ordered.length
        ? 'Only one recent tracker point is available.'
        : 'No recent tracker history.',
    };
  }

  let totalKm = 0;
  ordered.slice(1).forEach((position, index) => {
    totalKm += kmBetween(ordered[index], position);
  });

  const first = ordered[0];
  const last = ordered.at(-1);
  const durationH = Math.max(0.01, (positionTimestamp(last) - positionTimestamp(first)) / 3600000);
  const recent = ordered.slice(-Math.min(8, ordered.length));
  const recentFirst = recent[0];
  const recentDurationH = Math.max(
    0.01,
    (positionTimestamp(last) - positionTimestamp(recentFirst)) / 3600000,
  );
  const recentKm = kmBetween(recentFirst, last);
  const speedSamples = ordered.map((position) => kmhFromKnots(position.speed)).filter(Boolean);
  const maxSpeedKmh = speedSamples.length ? Math.max(...speedSamples) : totalKm / durationH;
  const averageSpeedKmh = totalKm / durationH;
  const recentSpeedKmh = recentKm / recentDurationH;
  const launchDistanceKm = kmBetween(first, last);
  const launchBearing = bearingDeg(first, last);
  const recentBearing = bearingDeg(recentFirst, last) ?? toNumber(last.course);
  const lastMoved = [...ordered].reverse().find((position) => kmBetween(position, last) > 0.03);
  const stoppedMinutes = lastMoved
    ? Math.max(0, (positionTimestamp(last) - positionTimestamp(lastMoved)) / 60000)
    : durationH * 60;

  return {
    status: 'active',
    sampleCount: ordered.length,
    from: first.fixTime || first.deviceTime || first.serverTime,
    to: last.fixTime || last.deviceTime || last.serverTime,
    durationH: round(durationH, 1),
    totalKm: round(totalKm, 2),
    launchDistanceKm: round(launchDistanceKm, 2),
    launchBearing: round(normalizeBearing(launchBearing), 0),
    recentBearing: round(normalizeBearing(recentBearing), 0),
    averageSpeedKmh: round(averageSpeedKmh, 1),
    recentSpeedKmh: round(recentSpeedKmh, 1),
    maxSpeedKmh: round(maxSpeedKmh, 1),
    stoppedMinutes: round(stoppedMinutes, 0),
    summary: `${ordered.length} points over ${round(durationH, 1)}h, ${round(totalKm, 1)} km tracked.`,
  };
};

const loadTrackerHistory = async (deviceId) => {
  if (!deviceId) {
    return { status: 'unavailable', sampleCount: 0, summary: 'No tracker is selected.' };
  }
  const to = new Date();
  const from = new Date(to.getTime() - HISTORY_HOURS * 3600000);
  const params = new URLSearchParams({
    deviceId: String(deviceId),
    from: from.toISOString(),
    to: to.toISOString(),
  });
  try {
    const response = await fetch(`/api/positions?${params.toString()}`, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`History returned ${response.status}`);
    return summarizeTrackerHistory(await response.json());
  } catch (error) {
    return {
      status: 'unavailable',
      sampleCount: 0,
      summary: error.message || 'Tracker history unavailable.',
    };
  }
};

const evaluateWindow = ({ windKmh, gustKmh, waveM, spreadKmh, modelCount, history, fusion }) => {
  let risk = 18;
  const reasons = [];
  const gustFactor = windKmh ? gustKmh / Math.max(1, windKmh) : 1;

  if (windKmh === null) {
    risk += 30;
    reasons.push('Wind forecast missing.');
  } else if (windKmh < 14) {
    risk += 18;
    reasons.push('Light wind window.');
  } else if (windKmh > 46) {
    risk += 36;
    reasons.push('Strong wind window.');
  } else if (windKmh >= 18 && windKmh <= 34) {
    risk -= 8;
    reasons.push('Wind in practical range.');
  }

  if (gustFactor > 1.75) {
    risk += 22;
    reasons.push('Gust factor forecast is high.');
  } else if (gustFactor > 1.45) {
    risk += 10;
    reasons.push('Gusts need monitoring.');
  }

  if (waveM > 2.2) {
    risk += 22;
    reasons.push('Wave height is elevated.');
  } else if (waveM > 1.2) {
    risk += 10;
    reasons.push('Waves add recovery load.');
  }

  if (spreadKmh > 14) {
    risk += 16;
    reasons.push('Models disagree on wind speed.');
  } else if (spreadKmh > 8) {
    risk += 8;
    reasons.push('Moderate model spread.');
  }

  if (history.status === 'active') {
    const movementWithFlow =
      directionDifference(history.recentBearing, fusion?.windDirection) !== null &&
      directionDifference(history.recentBearing, fusion?.windDirection) < 55;
    if (history.stoppedMinutes >= 12) {
      risk += 16;
      reasons.push('Recent tracker history shows a prolonged stop.');
    }
    if (history.launchDistanceKm > 1.5 && history.recentSpeedKmh < 4) {
      risk += 12;
      reasons.push('Tracker is away from launch with low recent movement.');
    }
    if (movementWithFlow && history.recentSpeedKmh < 8) {
      risk += 10;
      reasons.push('Recent motion aligns with wind/current drift.');
    }
  }

  if (modelCount < 2) {
    risk += 8;
    reasons.push('Only one provider model is available.');
  }

  const riskScore = clamp(Math.round(risk), 0, 100);
  const status = riskScore > 70 ? 'No-Go' : riskScore > 38 ? 'Caution' : 'Go';
  const confidence = clamp(0.52 + modelCount * 0.09 - spreadKmh / 80, 0.34, 0.9);

  return {
    status,
    riskScore,
    confidence: round(confidence, 2),
    reason: reasons[0] || 'Forecast window is inside the normal operating envelope.',
    reasons,
  };
};

const buildForecastWindows = ({ models, marine, history, fusion, tidePrediction }) => {
  const activeModels = models.filter((model) => model.status === 'active' && model.hours.length);
  const timestamps = [
    ...new Set(activeModels.flatMap((model) => model.hours.map((hour) => hour.timestamp))),
  ]
    .filter((timestamp) => timestamp >= Date.now() - 3600000)
    .sort((a, b) => a - b)
    .slice(0, FORECAST_HOURS);

  const windows = timestamps.map((timestamp) => {
    const readings = activeModels
      .map((model) => {
        const hour = nearestHour(model.hours, timestamp);
        return hour ? { ...hour, modelId: model.id, weight: model.weight } : null;
      })
      .filter(Boolean);
    const marineHour = marine.status === 'active' ? nearestHour(marine.hours, timestamp, 95) : null;
    const windKmh = weightedAverage(readings, 'windKmh');
    const gustKmh = weightedAverage(readings, 'gustKmh') ?? windKmh;
    const windDirection = circularAverage(readings, 'windDirection');
    const temperatureC = weightedAverage(readings, 'temperatureC');
    const spreadKmh = spread(readings.map((item) => item.windKmh));
    const tide = tideForTimestamp({ marine, timestamp, tidePrediction });
    const evaluation = evaluateWindow({
      windKmh,
      gustKmh,
      waveM: marineHour?.waveM ?? fusion?.waveM ?? 0,
      spreadKmh,
      modelCount: readings.length,
      history,
      fusion,
    });

    return {
      time: new Date(timestamp).toISOString(),
      label: formatHour(timestamp),
      modelCount: readings.length,
      windKmh: round(windKmh, 1),
      gustKmh: round(gustKmh, 1),
      windDirection: round(windDirection, 0),
      temperatureC: round(temperatureC, 1),
      waveM: round(marineHour?.waveM ?? fusion?.waveM, 1),
      wavePeriodS: round(marineHour?.wavePeriodS ?? fusion?.wavePeriodS, 1),
      swellM: round(marineHour?.swellM ?? fusion?.swellM, 1),
      ...tide,
      spreadKmh: round(spreadKmh, 1),
      ...evaluation,
    };
  });

  return windows;
};

const buildSummary = ({ bestWindow, nextWindow, activeModels, history, tidePrediction }) => {
  if (!nextWindow) return 'Forecast providers are unavailable; using live Senlay context only.';
  const modelText =
    activeModels.length > 1
      ? `${activeModels.length} provider models`
      : activeModels.length === 1
        ? activeModels[0].name
        : 'live context';
  const bestText = bestWindow
    ? `Best window ${bestWindow.label}: ${bestWindow.status}, ${bestWindow.windKmh} km/h wind.`
    : `Next window ${nextWindow.label}: ${nextWindow.status}.`;
  const historyText =
    history.status === 'active'
      ? ` History: ${history.totalKm} km tracked in ${history.durationH}h.`
      : '';
  const tideText = tidePrediction?.summary ? ` ${tidePrediction.summary}` : '';
  return `${bestText} Built from ${modelText}.${historyText}${tideText}`;
};

export const loadSmartSurfForecast = async ({ center, fusion, selectedDeviceId }) => {
  const [providers, history] = await Promise.all([
    loadProviderModels(center),
    loadTrackerHistory(selectedDeviceId),
  ]);
  const tidePrediction = buildTidePrediction({ marine: providers.marine, fusion, center });
  const windows = buildForecastWindows({ ...providers, history, fusion, tidePrediction });
  const activeModels = providers.models.filter((model) => model.status === 'active');
  const nextWindow = windows[0] || null;
  const bestWindow =
    windows
      .slice(0, 12)
      .filter((window) => window.windKmh !== null)
      .sort((a, b) => a.riskScore - b.riskScore)[0] || nextWindow;

  return {
    generatedAt: new Date().toISOString(),
    history,
    providerModels: providers.models,
    marineModel: providers.marine,
    tidePrediction,
    windows,
    nextWindow,
    bestWindow,
    summary: buildSummary({ bestWindow, nextWindow, activeModels, history, tidePrediction }),
    activeModelCount: activeModels.length + (providers.marine.status === 'active' ? 1 : 0),
    unavailableModelCount:
      providers.models.filter((model) => model.status !== 'active').length +
      (providers.marine.status !== 'active' ? 1 : 0),
  };
};

export const forecastModelLabels = (forecast) =>
  [...(forecast?.providerModels || []), forecast?.marineModel].filter(Boolean).map((model) => ({
    id: model.id,
    name: model.name,
    status: model.status,
    detail: model.status === 'active' ? `${model.hours.length}h` : model.error || 'Unavailable',
  }));
