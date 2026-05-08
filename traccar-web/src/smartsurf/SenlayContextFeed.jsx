import { Box, Chip, Stack, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { toArray } from './domain';

const useStyles = makeStyles()((theme) => ({
  feed: {
    height: '100%',
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    marginTop: 0,
    borderRadius: 14,
    background: 'rgba(7, 24, 39, .68)',
    border: '1px solid rgba(143, 211, 255, .16)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(1.2, 1.4),
    borderBottom: '1px solid rgba(143, 211, 255, .12)',
    color: '#35d0a2',
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: '.12em',
    textTransform: 'uppercase',
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    background: '#35d0a2',
    boxShadow: '0 0 18px rgba(53, 208, 162, .75)',
  },
  body: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    padding: theme.spacing(1.4),
  },
  section: {
    padding: theme.spacing(1.2, 0),
    borderBottom: '1px solid rgba(143, 211, 255, .1)',
    '&:last-of-type': {
      borderBottom: 0,
    },
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(1),
  },
  title: {
    fontSize: 13,
    fontWeight: 900,
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  badge: {
    height: 22,
    color: '#06131f',
    background: '#35d0a2',
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: '.04em',
  },
  modelBadge: {
    height: 22,
    color: '#8fd3ff',
    background: 'rgba(143, 211, 255, .14)',
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: '.04em',
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '92px 1fr',
    gap: theme.spacing(1),
    margin: theme.spacing(0.65, 0),
    fontSize: 13,
    lineHeight: 1.45,
  },
  label: {
    color: '#35d0a2',
    fontWeight: 800,
  },
  value: {
    color: '#ffffff',
  },
  muted: {
    color: '#b9cee1',
  },
  satellite: {
    width: '100%',
    maxHeight: 94,
    objectFit: 'cover',
    borderRadius: 10,
    border: '1px solid rgba(143, 211, 255, .16)',
  },
  footer: {
    padding: theme.spacing(0.9, 1.4),
    color: '#8fd3ff',
    background: 'rgba(16, 38, 61, .82)',
    borderTop: '1px solid rgba(143, 211, 255, .12)',
    fontSize: 11,
    textAlign: 'center',
  },
}));

const sourceBadge = (source) => source?.mode === 'hardware_with_model_fallback' ? 'HARDWARE-FIRST' : 'MODEL';

const sourceSummary = (sourceInfo) => {
  if (!sourceInfo || sourceInfo.mode === 'model_only') {
    return 'Model-derived current conditions';
  }
  const fieldSources = sourceInfo.field_sources || {};
  const firstKey = Object.keys(fieldSources)[0];
  const firstSource = firstKey ? fieldSources[firstKey] : null;
  const name = firstSource?.name || firstSource?.source || 'nearby hardware sensor';
  const distance = firstSource?.distance_km != null ? ` ${firstSource.distance_km}km away` : '';
  const fields = toArray(sourceInfo.overridden_fields)
    .map((field) => String(field).replace(/_/g, ' '))
    .join(', ');
  return `Hardware-first${fields ? ` for ${fields}` : ''} via ${name}${distance}`;
};

const fmt = (value, suffix = '') => (value === null || value === undefined || Number.isNaN(Number(value)) ? '--' : `${value}${suffix}`);
const fmtRound = (value, suffix = '') => (value === null || value === undefined || Number.isNaN(Number(value)) ? '--' : `${Math.round(Number(value) * 10) / 10}${suffix}`);

const Section = ({ title, badge, children }) => {
  const { classes, cx } = useStyles();
  return (
    <Box className={classes.section}>
      <Box className={classes.titleRow}>
        <Typography className={classes.title}>{title}</Typography>
        {badge && <Chip size="small" label={badge} className={cx(classes.modelBadge, badge.includes('HARDWARE') && classes.badge)} />}
      </Box>
      {children}
    </Box>
  );
};

const Row = ({ label, children }) => {
  const { classes } = useStyles();
  return (
    <Box className={classes.row}>
      <span className={classes.label}>{label}</span>
      <span className={classes.value}>{children}</span>
    </Box>
  );
};

const freshnessLabel = (value) => {
  if (!value) return 'Data fetched just now';
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return `Data timestamp ${value}`;
  const minutes = Math.max(0, Math.round((Date.now() - parsed) / 60000));
  if (minutes < 2) return 'Data fetched just now';
  if (minutes < 60) return `Data fetched ${minutes} min ago`;
  return `Data fetched ${Math.round(minutes / 60)}h ago`;
};

const SenlayContextFeed = ({ fusion }) => {
  const { classes } = useStyles();
  if (!fusion) return null;

  const atmosphere = fusion.layers?.atmosphere?.current || {};
  const atmosphereSource = fusion.layers?.atmosphere?.current_source;
  const hydrosphere = fusion.layers?.hydrosphere?.current || {};
  const hydrosphereSource = fusion.layers?.hydrosphere?.current_source;
  const terrain = fusion.layers?.terrain || {};
  const satellite = fusion.satellite || fusion.raw?.satellite;
  const windSensors = toArray(fusion.windSensors);
  const buoys = toArray(fusion.buoys);

  return (
    <Box className={classes.feed}>
      <Box className={classes.header}>
        <span className={classes.liveDot} />
        Physical Context Feed - Live
      </Box>
      <Box className={classes.body}>
        <Section title="Atmosphere" badge={sourceBadge(atmosphereSource)}>
          <Row label="Wind">{fmtRound(fusion.windKmh, ' km/h')} from {fmtRound(fusion.windDirection, ' deg')} (gusts {fmtRound(fusion.gustKmh)})</Row>
          <Row label="Temperature">{fmtRound(fusion.temperatureC, ' C')}{atmosphere.apparent_temperature != null ? ` (feels ${fmtRound(atmosphere.apparent_temperature, ' C')})` : ''}</Row>
          <Row label="Reading">Pressure {fmtRound(fusion.pressure, ' hPa')}</Row>
          <Row label="Detecting">Humidity {fmtRound(fusion.humidity, '%')} | Clouds {fmtRound(atmosphere.cloud_cover, '%')}</Row>
          <Row label="Source">{sourceSummary(atmosphereSource)}</Row>
        </Section>

        <Section title="Hydrosphere" badge={sourceBadge(hydrosphereSource)}>
          <Row label="Waves">{fmtRound(fusion.waveM, ' m')} ({fmtRound(fusion.wavePeriodS, 's')} period)</Row>
          <Row label="Swell">{fmtRound(fusion.swellM, ' m')} from {fmtRound(fusion.swellDirection, ' deg')}</Row>
          <Row label="Current">{fmtRound(fusion.currentSpeed)} signal toward {fmtRound(fusion.currentDirection, ' deg')}</Row>
          {fusion.waterTemperatureC != null && <Row label="Water">{fmtRound(fusion.waterTemperatureC, ' C')}</Row>}
          <Row label="Source">{sourceSummary(hydrosphereSource)}</Row>
        </Section>

        <Section title="Terrain" badge="MODEL">
          <Row label="Terrain">
            {terrain.is_ocean ? `Depth ${fmtRound(Math.abs(terrain.elevation_at_point), ' m')}` : `Elevation ${fmtRound(terrain.elevation_at_point ?? fusion.terrainMeters, ' m')}`}
          </Row>
          {toArray(terrain.depth_profile).length > 0 && (
            <Row label="Profile">{terrain.depth_profile.map((value) => fmtRound(value, 'm')).join(', ')}</Row>
          )}
        </Section>

        {(windSensors.length > 0 || buoys.length > 0 || fusion.tides || fusion.nearestWaterTemperature) && (
          <Section title="Nearest Sources" badge="HARDWARE">
            {windSensors.slice(0, 2).map((sensor) => (
              <Row key={`${sensor.source}-${sensor.station_id || sensor.name}`} label="Wind">
                {sensor.name || sensor.station_id} - {fmtRound(sensor.distance_km, ' km')} | {fmtRound(sensor.wind_speed_kmh, ' km/h')}
                {sensor.wind_direction != null ? ` from ${fmtRound(sensor.wind_direction, ' deg')}` : ''}
              </Row>
            ))}
            {buoys.slice(0, 2).map((buoy) => (
              <Row key={`${buoy.source}-${buoy.station_id || buoy.name}`} label="Marine">
                {buoy.name || buoy.station_id} - {fmtRound(buoy.distance_km, ' km')}
                {buoy.wave_height_m != null ? ` | waves ${fmtRound(buoy.wave_height_m, ' m')}` : ''}
              </Row>
            ))}
            {fusion.tides && (
              <Row label="Tide">{fusion.tides.name || fusion.tides.station_id} - level {fmtRound(fusion.tideLevelM, ' m')}</Row>
            )}
            {fusion.nearestWaterTemperature && (
              <Row label="Water">{fusion.nearestWaterTemperature.name || fusion.nearestWaterTemperature.station_id} - {fmtRound(fusion.waterTemperatureC, ' C')}</Row>
            )}
          </Section>
        )}

        <Section title="Satellite">
          {satellite?.google_satellite_url ? (
            <img className={classes.satellite} src={satellite.google_satellite_url} alt="Satellite view" />
          ) : (
            <Typography className={classes.muted} sx={{ fontSize: 13 }}>
              Satellite source checked. {satellite?.sentinel2?.reason || 'No image preview returned for this location.'}
            </Typography>
          )}
        </Section>
      </Box>
      <Box className={classes.footer}>{freshnessLabel(fusion.sourceFreshness)}</Box>
    </Box>
  );
};

export default SenlayContextFeed;
