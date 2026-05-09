import { createAssessment, spotSeed, toArray } from './domain';

const fallbackFusion = {
  windKmh: 22,
  gustKmh: 34,
  windDirection: 105,
  temperatureC: 31,
  waveM: 0.6,
  waveDirection: 80,
  swellM: 0.5,
  swellDirection: 80,
  wavePeriodS: 5.8,
  swellPeriodS: 5.8,
  waterTemperatureC: null,
  currentDirection: 95,
  currentSpeed: 0.18,
  tideLevelM: null,
  terrainMeters: 5,
  activeSources: 0,
  sourceFreshness: '',
  confidence: 0.52,
  fallback: true,
  layers: {},
  extended: {},
  windSensors: [],
  buoys: [],
  tides: null,
  waterTemperature: [],
  airQualitySensors: [],
  weatherAlerts: [],
  health: [],
  satellite: null,
};

const getPayloadRoot = (payload = {}) => payload.sensors || payload.pwm || payload;

const toNumber = (value, fallback = null) => {
  if (value === null || value === undefined || value === '') return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const firstNumber = (...values) => {
  for (const value of values) {
    const number = toNumber(value);
    if (number !== null) return number;
  }
  return null;
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const getFusionCenter = (selectedPosition) => ({
  lat: selectedPosition?.latitude || spotSeed[0].lat,
  lon: selectedPosition?.longitude || spotSeed[0].lon,
  label: selectedPosition ? 'Live tracker' : `${spotSeed[0].name}, ${spotSeed[0].country}`,
});

export const normalizeSenlayPayload = (payload = {}) => {
  const root = getPayloadRoot(payload);
  const layers = root.layers || {};
  const atmosphere = layers.atmosphere?.current || {};
  const hydrosphere = layers.hydrosphere?.current || {};
  const terrain = layers.terrain || layers.lithosphere?.current || {};
  const airQuality = layers.air_quality?.current || {};
  const extended = payload.extended || root.extended || {};
  const windSensors = toArray(extended.wind_sensors);
  const buoys = toArray(extended.buoys);
  const waterTemperature = toArray(extended.water_temperature);
  const airQualitySensors = toArray(extended.air_quality_sensors);
  const weatherAlerts = toArray(extended.weather_alerts);
  const activeSources = Number(payload.active_sources || root.active_sources || 0);
  const nearestWindSensor = windSensors
    .filter((sensor) => toNumber(sensor.wind_speed_kmh) !== null || toNumber(sensor.wind_direction) !== null)
    .sort((a, b) => toNumber(a.distance_km, 9999) - toNumber(b.distance_km, 9999))[0] || null;
  const nearestBuoy = buoys
    .filter((buoy) => toNumber(buoy.wave_height_m) !== null || toNumber(buoy.water_temp_c) !== null || toNumber(buoy.wind_speed_mps) !== null)
    .sort((a, b) => toNumber(a.distance_km, 9999) - toNumber(b.distance_km, 9999))[0] || null;
  const nearestWaterTemperature = waterTemperature
    .sort((a, b) => toNumber(a.distance_km, 9999) - toNumber(b.distance_km, 9999))[0] || null;

  const windKmh = firstNumber(
    nearestWindSensor?.wind_speed_kmh,
    nearestBuoy?.wind_speed_mps != null ? nearestBuoy.wind_speed_mps * 3.6 : null,
    atmosphere.wind_speed_10m,
    fallbackFusion.windKmh,
  );
  const gustKmh = firstNumber(
    nearestWindSensor?.wind_gust_kmh,
    nearestBuoy?.wind_gust_mps != null ? nearestBuoy.wind_gust_mps * 3.6 : null,
    atmosphere.wind_gusts_10m,
    fallbackFusion.gustKmh,
  );
  const waveM = firstNumber(nearestBuoy?.wave_height_m, hydrosphere.wave_height, fallbackFusion.waveM);
  const wavePeriodS = firstNumber(nearestBuoy?.wave_period_s, hydrosphere.wave_period, fallbackFusion.wavePeriodS);
  const waterTemperatureC = firstNumber(
    nearestWaterTemperature?.water_temp_c,
    nearestWaterTemperature?.temp_c,
    nearestBuoy?.water_temp_c,
    hydrosphere.water_temperature_c,
  );
  const sourceFreshness = root.timestamp || atmosphere.time || nearestWindSensor?.updated || nearestWindSensor?.obs_time || new Date().toISOString();

  return {
    windKmh,
    gustKmh,
    windDirection: firstNumber(nearestWindSensor?.wind_direction, nearestBuoy?.wind_direction, atmosphere.wind_direction_10m, fallbackFusion.windDirection),
    temperatureC: firstNumber(nearestWindSensor?.temperature, nearestBuoy?.air_temp_c, atmosphere.temperature_2m, fallbackFusion.temperatureC),
    humidity: firstNumber(nearestWindSensor?.humidity, atmosphere.relative_humidity_2m),
    pressure: firstNumber(nearestWindSensor?.pressure_hpa, nearestBuoy?.pressure_hpa, atmosphere.pressure_msl),
    waveM,
    waveDirection: firstNumber(hydrosphere.wave_direction, hydrosphere.swell_wave_direction, fallbackFusion.waveDirection),
    wavePeriodS,
    swellM: firstNumber(hydrosphere.swell_wave_height, waveM, fallbackFusion.swellM),
    swellDirection: firstNumber(hydrosphere.swell_wave_direction, hydrosphere.wave_direction, fallbackFusion.swellDirection),
    swellPeriodS: firstNumber(hydrosphere.swell_wave_period, wavePeriodS, fallbackFusion.swellPeriodS),
    waterTemperatureC,
    currentDirection: firstNumber(extended.current_direction, hydrosphere.wave_direction, fallbackFusion.currentDirection),
    currentSpeed: firstNumber(extended.current_speed, Math.max(0.08, (waveM || 0.3) / 4), fallbackFusion.currentSpeed),
    tideLevelM: firstNumber(extended.tides?.current_level_m),
    terrainMeters: firstNumber(terrain.elevation_at_point, terrain.elevation, terrain.terrain_elevation, fallbackFusion.terrainMeters),
    activeSources,
    sourceFreshness,
    confidence: clamp((activeSources >= 8 ? 0.76 : activeSources >= 4 ? 0.66 : 0.54) + (nearestWindSensor ? 0.08 : 0), 0.42, 0.9),
    fallback: false,
    layers,
    extended,
    health: toArray(payload.health || root.health),
    windSensors,
    buoys,
    tides: extended.tides || null,
    waterTemperature,
    airQuality,
    airQualitySensors,
    weatherAlerts,
    nearestWindSensor,
    nearestBuoy,
    nearestWaterTemperature,
    raw: payload,
    satellite: payload.satellite || root.satellite || null,
  };
};

export const loadSenlayFusion = async ({ lat, lon }) => {
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lon),
    field: 'kitesurfing',
    activity: 'kitesurfing',
  });
  const response = await fetch(`/senlay-api/pwm?${params.toString()}`);
  if (!response.ok) throw new Error(`Senlay returned ${response.status}`);
  return normalizeSenlayPayload(await response.json());
};

export const fallbackSenlayFusion = () => ({ ...fallbackFusion });

const toRad = (value) => (value * Math.PI) / 180;
const toDeg = (value) => (value * 180) / Math.PI;

export const destinationPoint = (lat, lon, distanceKm, bearingDeg) => {
  const radiusKm = 6371;
  const angularDistance = distanceKm / radiusKm;
  const bearing = toRad(bearingDeg);
  const lat1 = toRad(lat);
  const lon1 = toRad(lon);

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDistance)
      + Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearing),
  );
  const lon2 = lon1 + Math.atan2(
    Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat1),
    Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2),
  );

  return [toDeg(lon2), toDeg(lat2)];
};

const lineFeature = (id, kind, lat, lon, bearing, lengthKm, properties = {}) => {
  const half = lengthKm / 2;
  return {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: [
        destinationPoint(lat, lon, half, bearing + 180),
        destinationPoint(lat, lon, half, bearing),
      ],
    },
    properties: {
      id,
      kind,
      bearing,
      ...properties,
    },
  };
};

const pointFeature = (id, kind, lat, lon, properties = {}) => ({
  type: 'Feature',
  geometry: {
    type: 'Point',
    coordinates: [lon, lat],
  },
  properties: {
    id,
    kind,
    ...properties,
  },
});

const sourceLinkFeature = (id, center, coords, properties = {}) => ({
  type: 'Feature',
  geometry: {
    type: 'LineString',
    coordinates: [
      [center.lon, center.lat],
      [coords.lon, coords.lat],
    ],
  },
  properties: {
    id,
    kind: 'sourceLink',
    ...properties,
  },
});

const getLat = (item) => toNumber(item?.lat ?? item?.latitude);
const getLon = (item) => toNumber(item?.lng ?? item?.lon ?? item?.longitude);

const coordsOrOffset = (item, center, bearing, distanceKm = 1.2) => {
  const lat = getLat(item);
  const lon = getLon(item);
  if (lat !== null && lon !== null) return { lat, lon };
  const [offsetLon, offsetLat] = destinationPoint(center.lat, center.lon, distanceKm, bearing);
  return { lat: offsetLat, lon: offsetLon };
};

const shortName = (item, fallback) =>
  String(item?.name || item?.station_id || fallback || 'Sensor')
    .replace(/\s+/g, ' ')
    .slice(0, 42);

const terrainFeature = (center, fusion) => {
  const flowBearing = (fusion.windDirection + 180) % 360;
  const left = destinationPoint(center.lat, center.lon, 1.2, flowBearing - 75);
  const nose = destinationPoint(center.lat, center.lon, 3.4, flowBearing);
  const right = destinationPoint(center.lat, center.lon, 1.2, flowBearing + 75);
  const back = destinationPoint(center.lat, center.lon, 0.8, flowBearing + 180);
  return {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [[left, nose, right, back, left]],
    },
    properties: {
      id: 'terrain-modifier',
      kind: 'terrain',
      label: 'Terrain modifier',
      detail: 'Estimated local terrain influence on wind exposure and gustiness.',
      risk: fusion.gustKmh / Math.max(1, fusion.windKmh),
    },
  };
};

const addWindField = (features, center, fusion) => {
  const flowBearing = (fusion.windDirection + 180) % 360;
  const windLength = clamp(fusion.windKmh / 8, 0.9, 3.6);
  const heatOffsets = [-0.102, -0.078, -0.054, -0.03, -0.006, 0.018, 0.042, 0.066, 0.09];
  const offsets = [-0.066, -0.048, -0.03, -0.012, 0.006, 0.024, 0.042, 0.06];

  heatOffsets.forEach((latOffset, row) => {
    heatOffsets.forEach((lonOffset, col) => {
      const terrainModifier = Math.sin((row + 1) * 1.7) * Math.cos((col + 1) * 1.15);
      const coastalPulse = Math.sin((row - col) * 0.9);
      const localSpeed = clamp(
        fusion.windKmh + terrainModifier * 4 + coastalPulse * 2 + (fusion.gustKmh - fusion.windKmh) * 0.12,
        2,
        70,
      );
      features.push(pointFeature(`wind-heat-${row}-${col}`, 'windHeat', center.lat + latOffset, center.lon + lonOffset, {
        speed: localSpeed,
        gust: fusion.gustKmh,
        label: `${Math.round(localSpeed)} km/h wind field`,
        detail: 'Senlay fused wind field: nearby sensors, model data, terrain and coastal modifiers.',
      }));
    });
  });

  offsets.forEach((latOffset, row) => {
    offsets.forEach((lonOffset, col) => {
      const localBend = ((row * 7 + col * 5) % 11) - 5;
      const particleLength = clamp(windLength * 0.48 + ((row + col) % 3) * 0.08, 0.45, 1.7);
      features.push(lineFeature(
        `wind-particle-${row}-${col}`,
        'windParticle',
        center.lat + latOffset,
        center.lon + lonOffset,
        flowBearing + localBend,
        particleLength,
        {
          speed: fusion.windKmh + localBend * 0.35,
          gust: fusion.gustKmh,
          label: `${Math.round(fusion.windKmh)} km/h moving wind`,
          detail: `Animated Senlay wind stream. Gusts ${Math.round(fusion.gustKmh)} km/h.`,
        },
      ));
      features.push(lineFeature(
        `wind-${row}-${col}`,
        'wind',
        center.lat + latOffset,
        center.lon + lonOffset,
        flowBearing + localBend,
        windLength,
        {
          speed: fusion.windKmh,
          gust: fusion.gustKmh,
          label: `${Math.round(fusion.windKmh)} km/h`,
          detail: `Model and sensor-fused wind flow. Gusts ${Math.round(fusion.gustKmh)} km/h.`,
        },
      ));
    });
  });
};

const addWaterField = (features, center, fusion) => {
  [-0.028, -0.006, 0.018].forEach((offset, index) => {
    features.push(lineFeature(
      `current-${index}`,
      'current',
      center.lat - 0.03 + offset,
      center.lon + 0.02 + offset,
      fusion.currentDirection,
      clamp((fusion.currentSpeed || 0.15) * 5, 0.75, 2.8),
      {
        speed: fusion.currentSpeed,
        label: 'Current',
        detail: `Estimated current flow. Speed signal ${Number(fusion.currentSpeed || 0).toFixed(2)}.`,
      },
    ));
  });

  [-0.022, 0.008, 0.038].forEach((offset, index) => {
    features.push(lineFeature(
      `swell-${index}`,
      'swell',
      center.lat + 0.026 + offset,
      center.lon - 0.018 + offset,
      fusion.swellDirection,
      clamp((fusion.swellM || fusion.waveM || 0.4) + 0.9, 0.8, 2.8),
      {
        height: fusion.swellM || fusion.waveM,
        period: fusion.swellPeriodS || fusion.wavePeriodS,
        label: `${Number(fusion.swellM || fusion.waveM || 0).toFixed(1)} m swell`,
        detail: `Swell ${Number(fusion.swellM || fusion.waveM || 0).toFixed(1)} m, period ${Number(fusion.swellPeriodS || fusion.wavePeriodS || 0).toFixed(1)} s.`,
      },
    ));
  });
};

const addSensorFeatures = (features, center, fusion) => {
  fusion.windSensors.slice(0, 12).forEach((sensor, index) => {
    const coords = coordsOrOffset(sensor, center, 310 - index * 18, Math.min(4, 0.8 + index * 0.25));
    const speed = firstNumber(sensor.wind_speed_kmh);
    const gust = firstNumber(sensor.wind_gust_kmh);
    const direction = firstNumber(sensor.wind_direction);
    if (index < 3) {
      features.push(sourceLinkFeature(`wind-source-link-${index}`, center, coords, {
        sensorType: 'wind',
        label: 'Nearest wind source',
        detail: `Line from checked spot to ${shortName(sensor, 'wind sensor')}.`,
      }));
    }
    features.push(pointFeature(`wind-sensor-${index}`, 'sensor', coords.lat, coords.lon, {
      sensorType: 'wind',
      label: `${index === 0 ? 'Nearest ' : ''}${speed !== null ? `${Math.round(speed)} km/h` : shortName(sensor, 'Wind')}`,
      detail: `${shortName(sensor, 'Wind sensor')} - ${sensor.distance_km ?? '?'} km away. Wind ${speed !== null ? Math.round(speed) : '--'} km/h${direction !== null ? ` from ${Math.round(direction)} deg` : ''}${gust !== null ? `, gusts ${Math.round(gust)} km/h` : ''}.`,
      source: sensor.source || 'wind',
      distance: firstNumber(sensor.distance_km),
      speed,
      gust,
      direction,
      nearest: index === 0,
      updated: sensor.updated || sensor.obs_time || '',
    }));
    if (direction !== null) {
      features.push(lineFeature(
        `wind-sensor-flow-${index}`,
        'sensorWind',
        coords.lat,
        coords.lon,
        (direction + 180) % 360,
        clamp((speed || fusion.windKmh) / 10, 0.7, 2.4),
        {
          speed: speed || fusion.windKmh,
          label: `${Math.round(speed || fusion.windKmh)} km/h sensor wind`,
          detail: `${shortName(sensor, 'Wind sensor')} local wind direction.`,
        },
      ));
    }
  });

  fusion.buoys.slice(0, 8).forEach((buoy, index) => {
    const coords = coordsOrOffset(buoy, center, 110 + index * 20, Math.min(5, 1 + index * 0.35));
    const wave = firstNumber(buoy.wave_height_m);
    const water = firstNumber(buoy.water_temp_c);
    if (index < 2) {
      features.push(sourceLinkFeature(`marine-source-link-${index}`, center, coords, {
        sensorType: 'marine',
        label: 'Nearest marine source',
        detail: `Line from checked spot to ${shortName(buoy, 'marine buoy')}.`,
      }));
    }
    features.push(pointFeature(`marine-sensor-${index}`, 'sensor', coords.lat, coords.lon, {
      sensorType: 'marine',
      label: `${index === 0 ? 'Nearest ' : ''}${wave !== null ? `${wave.toFixed(1)} m waves` : 'Marine'}`,
      detail: `${shortName(buoy, 'Ocean buoy')} - ${buoy.distance_km ?? '?'} km away. ${wave !== null ? `Waves ${wave.toFixed(1)} m. ` : ''}${water !== null ? `Water ${water.toFixed(1)} C. ` : ''}`,
      source: buoy.source || 'buoy',
      distance: firstNumber(buoy.distance_km),
      wave,
      water,
      nearest: index === 0,
    }));
  });

  fusion.waterTemperature.slice(0, 6).forEach((station, index) => {
    const coords = coordsOrOffset(station, center, 230 + index * 18, Math.min(4, 0.8 + index * 0.3));
    const water = firstNumber(station.water_temp_c, station.temp_c);
    if (index < 2) {
      features.push(sourceLinkFeature(`water-temp-source-link-${index}`, center, coords, {
        sensorType: 'water',
        label: 'Water temperature source',
        detail: `Line from checked spot to ${shortName(station, 'water temperature station')}.`,
      }));
    }
    features.push(pointFeature(`water-temp-${index}`, 'temperature', coords.lat, coords.lon, {
      sensorType: 'water',
      label: `${water !== null ? `${water.toFixed(1)} C` : 'Water temp'}`,
      detail: `${shortName(station, 'Water temperature')} - ${station.distance_km ?? '?'} km away. Water ${water !== null ? `${water.toFixed(1)} C` : 'not available'}.`,
      temperature: water,
      source: station.source || 'water_temperature',
      distance: firstNumber(station.distance_km),
    }));
  });

  if (fusion.tides) {
    const coords = coordsOrOffset(fusion.tides, center, 165, Math.min(4, Math.max(1, firstNumber(fusion.tides.distance_km, 2) / 3)));
    features.push(sourceLinkFeature('tide-source-link', center, coords, {
      sensorType: 'tide',
      label: 'Tide gauge source',
      detail: `Line from checked spot to ${shortName(fusion.tides, 'tide gauge')}.`,
    }));
    features.push(pointFeature('tide-gauge', 'tide', coords.lat, coords.lon, {
      sensorType: 'tide',
      label: `${shortName(fusion.tides, 'Tide')} ${fusion.tideLevelM !== null ? `${fusion.tideLevelM.toFixed(2)} m` : ''}`,
      detail: `${shortName(fusion.tides, 'Tide gauge')} - ${fusion.tides.distance_km ?? '?'} km away. Level ${fusion.tideLevelM !== null ? `${fusion.tideLevelM.toFixed(2)} m` : 'n/a'}. Next high ${fusion.tides.next_high?.time || 'n/a'}, next low ${fusion.tides.next_low?.time || 'n/a'}.`,
      tideLevel: fusion.tideLevelM,
      source: fusion.tides.source || 'tide',
      distance: firstNumber(fusion.tides.distance_km),
    }));
  }

  fusion.airQualitySensors.slice(0, 5).forEach((sensor, index) => {
    const coords = coordsOrOffset(sensor, center, 30 + index * 24, Math.min(4, 1 + index * 0.3));
    features.push(pointFeature(`air-sensor-${index}`, 'sensor', coords.lat, coords.lon, {
      sensorType: 'air',
      label: shortName(sensor, 'Air quality'),
      detail: `${shortName(sensor, 'Air quality')} - ${sensor.distance_km ?? '?'} km away.`,
      source: sensor.source || 'air_quality',
      distance: firstNumber(sensor.distance_km),
    }));
  });
};

export const buildFusionFeatures = ({ center, fusion, selectedPosition }) => {
  const features = [];

  addWindField(features, center, fusion);
  addWaterField(features, center, fusion);
  features.push(terrainFeature(center, fusion));
  addSensorFeatures(features, center, fusion);

  features.push(pointFeature('air-temperature', 'temperature', center.lat - 0.024, center.lon - 0.026, {
    label: `${Math.round(fusion.temperatureC)} C air`,
    detail: `Air temperature ${Math.round(fusion.temperatureC)} C. Water ${fusion.waterTemperatureC !== null ? `${fusion.waterTemperatureC.toFixed(1)} C` : 'not available'}.`,
    temperature: fusion.temperatureC,
    sensorType: 'temperature',
  }));

  features.push(pointFeature('gps-center', 'gps', selectedPosition?.latitude || center.lat, selectedPosition?.longitude || center.lon, {
    label: center.label,
    detail: 'Current rider tracker location or selected SmartSurf spot.',
  }));

  return {
    type: 'FeatureCollection',
    features,
  };
};

export const createFusionSuggestion = ({ rider, safety, gear, fusion }) => {
  const assessment = createAssessment({
    rider,
    safety,
    gear,
    conditions: fusion,
  });
  const gustFactor = fusion.windKmh ? fusion.gustKmh / fusion.windKmh : 1;
  const notes = [
    `Wind ${Math.round(fusion.windKmh)} km/h from ${Math.round(fusion.windDirection)} deg`,
    `Gust factor ${gustFactor.toFixed(1)}`,
    `Waves ${fusion.waveM.toFixed(1)} m / ${fusion.wavePeriodS.toFixed(1)} s`,
  ];
  if (fusion.swellM != null) notes.push(`Swell ${fusion.swellM.toFixed(1)} m from ${Math.round(fusion.swellDirection)} deg`);
  if (fusion.tideLevelM != null) notes.push(`Tide gauge level ${fusion.tideLevelM.toFixed(2)} m`);
  if (fusion.nearestWindSensor) notes.push(`Nearest wind sensor: ${shortName(fusion.nearestWindSensor)} (${fusion.nearestWindSensor.distance_km} km)`);
  if (gustFactor > 1.8) notes.push('Use smaller gear and avoid exposed launches.');
  if (fusion.activeSources < 4) notes.push('Low source density: confirm with local observation.');
  if (fusion.weatherAlerts.length) notes.push('Weather alert nearby: read details before launching.');

  return {
    ...assessment,
    notes,
    gustFactor,
  };
};
