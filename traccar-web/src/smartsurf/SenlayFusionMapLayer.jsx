import { useEffect, useMemo, useState } from 'react';
import maplibregl from 'maplibre-gl';
import {
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  FormControlLabel,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { Link } from 'react-router-dom';
import { makeStyles } from 'tss-react/mui';
import { map } from '../map/core/MapView';
import usePersistedState from '../common/util/usePersistedState';
import { useSmartSurfData } from './storage';
import SenlayContextFeed from './SenlayContextFeed';
import SenlayWaterChat from './SenlayWaterChat';
import {
  buildFusionFeatures,
  createFusionSuggestion,
  fallbackSenlayFusion,
  getFusionCenter,
  loadSenlayFusion,
  normalizeSenlayPayload,
} from './senlayFusion';

const SOURCE_ID = 'smartsurf-senlay-fusion';
const LAYERS = [
  'smartsurf-senlay-wind-heat',
  'smartsurf-senlay-terrain',
  'smartsurf-senlay-source-links',
  'smartsurf-senlay-source-link-arrows',
  'smartsurf-senlay-wind-particles-glow',
  'smartsurf-senlay-wind-particles',
  'smartsurf-senlay-wind',
  'smartsurf-senlay-wind-arrows',
  'smartsurf-senlay-sensor-wind',
  'smartsurf-senlay-sensor-wind-arrows',
  'smartsurf-senlay-swell',
  'smartsurf-senlay-swell-arrows',
  'smartsurf-senlay-current',
  'smartsurf-senlay-current-arrows',
  'smartsurf-senlay-tides',
  'smartsurf-senlay-temperature',
  'smartsurf-senlay-sensor-halos',
  'smartsurf-senlay-sensors',
  'smartsurf-senlay-gps',
  'smartsurf-senlay-labels',
];

const useStyles = makeStyles()((theme) => ({
  panel: {
    position: 'absolute',
    left: `calc(${theme.dimensions.drawerWidthDesktop} + ${theme.spacing(3)})`,
    right: theme.spacing(9),
    bottom: theme.spacing(2),
    zIndex: 8,
    width: 'auto',
    height: '32vh',
    minHeight: 260,
    maxHeight: 360,
    padding: theme.spacing(2),
    overflow: 'hidden',
    display: 'grid',
    gridTemplateColumns: 'minmax(280px, 360px) minmax(360px, 1fr) minmax(220px, 260px)',
    gap: theme.spacing(2),
    alignItems: 'stretch',
    borderRadius: 16,
    background: 'linear-gradient(135deg, rgba(16, 38, 61, .94), rgba(10, 44, 54, .9))',
    color: '#fff',
    border: '1px solid rgba(53, 208, 162, .32)',
    backdropFilter: 'blur(14px)',
    boxShadow: '0 20px 60px rgba(0,0,0,.32)',
    [theme.breakpoints.down('lg')]: {
      gridTemplateColumns: 'minmax(280px, 340px) minmax(360px, 1fr)',
    },
    [theme.breakpoints.down('md')]: {
      left: theme.spacing(1),
      right: theme.spacing(1),
      bottom: theme.spacing(1),
      height: '34vh',
      minHeight: 220,
      maxHeight: 310,
      padding: theme.spacing(1.1),
      overflowY: 'auto',
      gridTemplateColumns: '1fr',
      gap: theme.spacing(1),
      borderRadius: 14,
    },
  },
  summaryBlock: {
    minHeight: 0,
    overflowY: 'auto',
    paddingRight: theme.spacing(0.5),
  },
  feedBlock: {
    minHeight: 0,
  },
  controlsBlock: {
    minHeight: 0,
    overflowY: 'auto',
    paddingLeft: theme.spacing(1.5),
    borderLeft: '1px solid rgba(143, 211, 255, .14)',
    [theme.breakpoints.down('lg')]: {
      gridColumn: '1 / -1',
      paddingLeft: 0,
      borderLeft: 0,
      borderTop: '1px solid rgba(143, 211, 255, .14)',
      paddingTop: theme.spacing(1),
    },
    [theme.breakpoints.down('md')]: {
      gridColumn: 'auto',
      borderTop: 0,
      paddingTop: 0,
    },
  },
  layerGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: theme.spacing(0.25, 1),
    marginTop: theme.spacing(0.5),
    [theme.breakpoints.down('lg')]: {
      gridTemplateColumns: 'repeat(4, minmax(120px, 1fr))',
    },
    [theme.breakpoints.down('md')]: {
      gridTemplateColumns: 'repeat(4, max-content)',
      overflowX: 'auto',
      paddingBottom: theme.spacing(0.25),
    },
  },
  checkbox: {
    color: '#fff',
    '& .MuiFormControlLabel-label': {
      fontSize: 13,
      fontWeight: 700,
      whiteSpace: 'nowrap',
    },
    '& .MuiCheckbox-root': {
      color: '#8fd3ff',
    },
  },
  muted: {
    color: '#b9cee1',
  },
  miniFacts: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: theme.spacing(1),
    marginTop: theme.spacing(1.5),
    [theme.breakpoints.down('md')]: {
      gridTemplateColumns: 'repeat(4, minmax(108px, 1fr))',
      overflowX: 'auto',
    },
    [theme.breakpoints.down('sm')]: {
      gridTemplateColumns: '1fr 1fr',
    },
  },
  miniFact: {
    padding: theme.spacing(1),
    borderRadius: 12,
    background: 'rgba(7, 24, 39, .52)',
    border: '1px solid rgba(143, 211, 255, .14)',
    '& strong': {
      display: 'block',
      color: '#ffffff',
      fontSize: 14,
      lineHeight: 1.2,
    },
    '& span': {
      display: 'block',
      color: '#b9cee1',
      fontSize: 11,
      marginTop: 2,
    },
  },
}));

const layerDefaults = {
  wind: true,
  swell: true,
  currents: true,
  terrain: true,
  sensors: true,
  tides: true,
  temperature: true,
  gps: true,
};

const popupHtml = (feature) => {
  const props = feature.properties || {};
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }[char]));
  return `
    <div style="font-family:Inter,system-ui,sans-serif;min-width:210px;color:#071827">
      <strong style="display:block;font-size:13px;margin-bottom:4px">${esc(props.label || 'Senlay source')}</strong>
      <div style="font-size:12px;line-height:1.45">${esc(props.detail || props.source || 'Physical-world context source')}</div>
      ${props.updated ? `<div style="font-size:11px;margin-top:6px;color:#587083">Updated: ${esc(props.updated)}</div>` : ''}
    </div>
  `;
};

const focusFusionMap = (featureCollection) => {
  const coords = [];
  const collect = (geometry) => {
    if (!geometry) return;
    if (geometry.type === 'Point') {
      coords.push(geometry.coordinates);
    } else if (geometry.type === 'LineString') {
      coords.push(...geometry.coordinates);
    } else if (geometry.type === 'Polygon') {
      geometry.coordinates.flat().forEach((coordinate) => coords.push(coordinate));
    }
  };

  featureCollection.features
    .filter((feature) => ['gps', 'sensor', 'tide', 'temperature', 'sourceLink'].includes(feature.properties?.kind))
    .forEach((feature) => collect(feature.geometry));

  if (!coords.length) return;
  const bounds = coords.reduce(
    (currentBounds, coordinate) => currentBounds.extend(coordinate),
    new maplibregl.LngLatBounds(coords[0], coords[0]),
  );
  const narrow = Math.abs(bounds.getEast() - bounds.getWest()) < 0.02 && Math.abs(bounds.getNorth() - bounds.getSouth()) < 0.02;
  if (narrow) {
    map.flyTo({ center: coords[0], zoom: Math.max(map.getZoom(), 11), duration: 900, essential: true });
  } else {
    const canvas = map.getCanvas();
    const desktop = canvas.width >= 900;
    map.fitBounds(bounds, {
      padding: {
        top: desktop ? 110 : 80,
        right: desktop ? Math.min(450, Math.round(canvas.width * 0.25)) : 32,
        bottom: desktop ? Math.min(390, Math.round(canvas.height * 0.42)) : 240,
        left: desktop ? Math.min(480, Math.round(canvas.width * 0.28)) : 32,
      },
      maxZoom: 11,
      duration: 900,
      essential: true,
    });
  }
};

const ensureLayer = ({ id, type, source = SOURCE_ID, filter, paint, layout }) => {
  if (!map.getLayer(id)) {
    map.addLayer({
      id,
      type,
      source,
      filter,
      paint,
      layout,
    });
  }
};

const setVisible = (id, visible) => {
  if (map.getLayer(id)) {
    map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
  }
};

const removeFusionLayers = () => {
  LAYERS.forEach((id) => {
    if (map.getLayer(id)) map.removeLayer(id);
  });
  if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
};

const addFusionLayers = () => {
  if (!map.getSource(SOURCE_ID)) {
    map.addSource(SOURCE_ID, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
  }

  ensureLayer({
    id: 'smartsurf-senlay-wind-heat',
    type: 'heatmap',
    filter: ['==', ['get', 'kind'], 'windHeat'],
    paint: {
      'heatmap-weight': [
        'interpolate',
        ['linear'],
        ['get', 'speed'],
        4,
        0.18,
        18,
        0.42,
        32,
        0.7,
        55,
        1,
      ],
      'heatmap-intensity': [
        'interpolate',
        ['linear'],
        ['zoom'],
        6,
        0.95,
        11,
        1.7,
        14,
        2.15,
      ],
      'heatmap-radius': [
        'interpolate',
        ['linear'],
        ['zoom'],
        6,
        58,
        10,
        105,
        14,
        160,
      ],
      'heatmap-opacity': 0.82,
      'heatmap-color': [
        'interpolate',
        ['linear'],
        ['heatmap-density'],
        0,
        'rgba(18, 64, 115, 0)',
        0.12,
        'rgba(37, 106, 190, .72)',
        0.28,
        'rgba(35, 208, 162, .76)',
        0.46,
        'rgba(220, 232, 87, .78)',
        0.64,
        'rgba(255, 164, 64, .82)',
        0.82,
        'rgba(229, 71, 91, .86)',
        1,
        'rgba(131, 70, 190, .9)',
      ],
    },
  });

  ensureLayer({
    id: 'smartsurf-senlay-terrain',
    type: 'fill',
    filter: ['==', ['get', 'kind'], 'terrain'],
    paint: {
      'fill-color': [
        'interpolate',
        ['linear'],
        ['get', 'risk'],
        1.2,
        '#35d0a2',
        1.8,
        '#ffd166',
        2.4,
        '#ff6b6b',
      ],
      'fill-opacity': 0.22,
      'fill-outline-color': '#ffd166',
    },
  });

  ensureLayer({
    id: 'smartsurf-senlay-source-links',
    type: 'line',
    filter: ['==', ['get', 'kind'], 'sourceLink'],
    paint: {
      'line-color': [
        'match',
        ['get', 'sensorType'],
        'wind',
        '#ffe98a',
        'marine',
        '#7cb7ff',
        'water',
        '#35d0a2',
        'tide',
        '#b8dbff',
        '#8fd3ff',
      ],
      'line-width': 2,
      'line-opacity': 0.72,
      'line-dasharray': [1.2, 1.6],
    },
  });

  ensureLayer({
    id: 'smartsurf-senlay-source-link-arrows',
    type: 'symbol',
    filter: ['==', ['get', 'kind'], 'sourceLink'],
    layout: {
      'symbol-placement': 'line',
      'symbol-spacing': 92,
      'text-field': '>',
      'text-size': 12,
      'text-keep-upright': false,
      'text-allow-overlap': true,
    },
    paint: {
      'text-color': '#ffffff',
      'text-halo-color': '#06131f',
      'text-halo-width': 1,
    },
  });

  ensureLayer({
    id: 'smartsurf-senlay-wind-particles-glow',
    type: 'line',
    filter: ['==', ['get', 'kind'], 'windParticle'],
    paint: {
      'line-color': [
        'interpolate',
        ['linear'],
        ['get', 'speed'],
        8,
        '#7fd8ff',
        22,
        '#d8fff2',
        34,
        '#fff0a6',
        48,
        '#ff9a7c',
      ],
      'line-width': 7.4,
      'line-opacity': 0.24,
      'line-blur': 2.6,
    },
  });

  ensureLayer({
    id: 'smartsurf-senlay-wind-particles',
    type: 'line',
    filter: ['==', ['get', 'kind'], 'windParticle'],
    paint: {
      'line-color': [
        'interpolate',
        ['linear'],
        ['get', 'speed'],
        8,
        '#c9f8ff',
        22,
        '#effff8',
        34,
        '#ffe98a',
        48,
        '#ffb08d',
      ],
      'line-width': [
        'interpolate',
        ['linear'],
        ['get', 'speed'],
        8,
        1.55,
        32,
        2.35,
        52,
        3.15,
      ],
      'line-opacity': 0.9,
      'line-blur': 0.25,
      'line-dasharray': [0.12, 2.4],
    },
  });

  ensureLayer({
    id: 'smartsurf-senlay-wind',
    type: 'line',
    filter: ['==', ['get', 'kind'], 'wind'],
    paint: {
      'line-color': [
        'interpolate',
        ['linear'],
        ['get', 'speed'],
        8,
        '#6fd3ff',
        24,
        '#35d0a2',
        38,
        '#ffd166',
        55,
        '#ff6b6b',
      ],
      'line-width': 1.1,
      'line-opacity': 0.36,
      'line-blur': 0.9,
    },
  });

  ensureLayer({
    id: 'smartsurf-senlay-wind-arrows',
    type: 'symbol',
    filter: ['==', ['get', 'kind'], 'wind'],
    layout: {
      'symbol-placement': 'line',
      'symbol-spacing': 80,
      'text-field': '>',
      'text-size': 15,
      'text-keep-upright': false,
      'text-allow-overlap': true,
    },
    paint: {
      'text-color': '#eaffff',
      'text-halo-color': '#06131f',
      'text-halo-width': 1.2,
    },
  });

  ensureLayer({
    id: 'smartsurf-senlay-sensor-wind',
    type: 'line',
    filter: ['==', ['get', 'kind'], 'sensorWind'],
    paint: {
      'line-color': '#ffe98a',
      'line-width': 3.2,
      'line-opacity': 0.9,
      'line-blur': 0.2,
    },
  });

  ensureLayer({
    id: 'smartsurf-senlay-sensor-wind-arrows',
    type: 'symbol',
    filter: ['==', ['get', 'kind'], 'sensorWind'],
    layout: {
      'symbol-placement': 'line',
      'symbol-spacing': 54,
      'text-field': '>',
      'text-size': 15,
      'text-keep-upright': false,
      'text-allow-overlap': true,
    },
    paint: {
      'text-color': '#fff2a6',
      'text-halo-color': '#06131f',
      'text-halo-width': 1.1,
    },
  });

  ensureLayer({
    id: 'smartsurf-senlay-swell',
    type: 'line',
    filter: ['==', ['get', 'kind'], 'swell'],
    paint: {
      'line-color': '#9cd7ff',
      'line-width': 3.4,
      'line-opacity': 0.72,
      'line-dasharray': [2.2, 1.1],
    },
  });

  ensureLayer({
    id: 'smartsurf-senlay-swell-arrows',
    type: 'symbol',
    filter: ['==', ['get', 'kind'], 'swell'],
    layout: {
      'symbol-placement': 'line',
      'symbol-spacing': 64,
      'text-field': '>',
      'text-size': 13,
      'text-keep-upright': false,
      'text-allow-overlap': true,
    },
    paint: {
      'text-color': '#e2f4ff',
      'text-halo-color': '#06131f',
      'text-halo-width': 1,
    },
  });

  ensureLayer({
    id: 'smartsurf-senlay-current',
    type: 'line',
    filter: ['==', ['get', 'kind'], 'current'],
    paint: {
      'line-color': '#7cb7ff',
      'line-width': 3,
      'line-opacity': 0.72,
      'line-dasharray': [1, 1.6],
    },
  });

  ensureLayer({
    id: 'smartsurf-senlay-current-arrows',
    type: 'symbol',
    filter: ['==', ['get', 'kind'], 'current'],
    layout: {
      'symbol-placement': 'line',
      'symbol-spacing': 60,
      'text-field': '>',
      'text-size': 13,
      'text-keep-upright': false,
      'text-allow-overlap': true,
    },
    paint: {
      'text-color': '#b8dbff',
      'text-halo-color': '#06131f',
      'text-halo-width': 1,
    },
  });

  ensureLayer({
    id: 'smartsurf-senlay-tides',
    type: 'circle',
    filter: ['==', ['get', 'kind'], 'tide'],
    paint: {
      'circle-radius': 9,
      'circle-color': '#7cb7ff',
      'circle-opacity': 0.94,
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 2,
    },
  });

  ensureLayer({
    id: 'smartsurf-senlay-temperature',
    type: 'circle',
    filter: ['==', ['get', 'kind'], 'temperature'],
    paint: {
      'circle-radius': 20,
      'circle-color': [
        'interpolate',
        ['linear'],
        ['get', 'temperature'],
        18,
        '#6fd3ff',
        28,
        '#35d0a2',
        34,
        '#ffd166',
        40,
        '#ff6b6b',
      ],
      'circle-opacity': 0.42,
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 1,
      'circle-stroke-opacity': 0.6,
    },
  });

  ensureLayer({
    id: 'smartsurf-senlay-sensor-halos',
    type: 'circle',
    filter: ['==', ['get', 'kind'], 'sensor'],
    paint: {
      'circle-radius': [
        'case',
        ['==', ['get', 'nearest'], true],
        18,
        13,
      ],
      'circle-color': [
        'match',
        ['get', 'sensorType'],
        'wind',
        '#ffe98a',
        'marine',
        '#7cb7ff',
        'air',
        '#b7f7d1',
        '#35d0a2',
      ],
      'circle-opacity': [
        'case',
        ['==', ['get', 'nearest'], true],
        0.32,
        0.18,
      ],
      'circle-blur': 0.45,
    },
  });

  ensureLayer({
    id: 'smartsurf-senlay-sensors',
    type: 'circle',
    filter: ['==', ['get', 'kind'], 'sensor'],
    paint: {
      'circle-radius': [
        'match',
        ['get', 'sensorType'],
        'wind',
        8,
        'marine',
        9,
        'air',
        7,
        7,
      ],
      'circle-color': [
        'match',
        ['get', 'sensorType'],
        'wind',
        '#ffe98a',
        'marine',
        '#7cb7ff',
        'air',
        '#b7f7d1',
        '#35d0a2',
      ],
      'circle-opacity': 0.92,
      'circle-stroke-color': [
        'case',
        ['==', ['get', 'nearest'], true],
        '#ffffff',
        '#06131f',
      ],
      'circle-stroke-width': [
        'case',
        ['==', ['get', 'nearest'], true],
        3,
        2,
      ],
    },
  });

  ensureLayer({
    id: 'smartsurf-senlay-gps',
    type: 'circle',
    filter: ['==', ['get', 'kind'], 'gps'],
    paint: {
      'circle-radius': 10,
      'circle-color': '#ffffff',
      'circle-opacity': 0.95,
      'circle-stroke-color': '#35d0a2',
      'circle-stroke-width': 4,
    },
  });

  ensureLayer({
    id: 'smartsurf-senlay-labels',
    type: 'symbol',
    filter: ['in', ['get', 'kind'], ['literal', ['sensor', 'temperature', 'gps', 'tide']]],
    layout: {
      'text-field': ['get', 'label'],
      'text-size': [
        'case',
        ['==', ['get', 'nearest'], true],
        13,
        11,
      ],
      'text-offset': [0, 1.35],
      'text-anchor': 'top',
      'text-allow-overlap': false,
    },
    paint: {
      'text-color': '#ffffff',
      'text-halo-color': '#06131f',
      'text-halo-width': 1.4,
    },
  });
};

const SenlayFusionMapLayer = ({ selectedPosition }) => {
  const { classes } = useStyles();
  const { rider, safety, gear } = useSmartSurfData();
  const [enabled, setEnabled] = useState(true);
  const [layers, setLayers] = usePersistedState('smartsurfSenlayFusionLayers', layerDefaults);
  const [fusion, setFusion] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [focusRequest, setFocusRequest] = useState(0);
  const center = useMemo(() => getFusionCenter(selectedPosition), [selectedPosition]);

  const refresh = async () => {
    setLoading(true);
    setError('');
    try {
      const nextFusion = await loadSenlayFusion(center);
      setFusion(nextFusion);
      setFocusRequest(Date.now());
    } catch (event) {
      setError(event.message);
      const fallback = fallbackSenlayFusion();
      setFusion(fallback);
      setFocusRequest(Date.now());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [center.lat, center.lon]);

  useEffect(() => {
    if (!enabled) {
      removeFusionLayers();
      return () => {};
    }
    addFusionLayers();
    return removeFusionLayers;
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !fusion || !map.getSource(SOURCE_ID)) return;
    const featureCollection = buildFusionFeatures({ center, fusion, selectedPosition });
    map.getSource(SOURCE_ID).setData(featureCollection);
    if (focusRequest) {
      focusFusionMap(featureCollection);
    }
  }, [enabled, fusion, center, selectedPosition, focusRequest]);

  useEffect(() => {
    if (!enabled) return;
    setVisible('smartsurf-senlay-source-links', layers.sensors);
    setVisible('smartsurf-senlay-source-link-arrows', layers.sensors);
    setVisible('smartsurf-senlay-wind-heat', layers.wind);
    setVisible('smartsurf-senlay-wind-particles-glow', layers.wind);
    setVisible('smartsurf-senlay-wind-particles', layers.wind);
    setVisible('smartsurf-senlay-wind', layers.wind);
    setVisible('smartsurf-senlay-wind-arrows', layers.wind);
    setVisible('smartsurf-senlay-sensor-wind', layers.wind && layers.sensors);
    setVisible('smartsurf-senlay-sensor-wind-arrows', layers.wind && layers.sensors);
    setVisible('smartsurf-senlay-swell', layers.swell);
    setVisible('smartsurf-senlay-swell-arrows', layers.swell);
    setVisible('smartsurf-senlay-current', layers.currents);
    setVisible('smartsurf-senlay-current-arrows', layers.currents);
    setVisible('smartsurf-senlay-terrain', layers.terrain);
    setVisible('smartsurf-senlay-sensor-halos', layers.sensors);
    setVisible('smartsurf-senlay-sensors', layers.sensors);
    setVisible('smartsurf-senlay-tides', layers.tides);
    setVisible('smartsurf-senlay-temperature', layers.temperature);
    setVisible('smartsurf-senlay-gps', layers.gps);
    setVisible('smartsurf-senlay-labels', layers.sensors || layers.temperature || layers.gps || layers.tides);
  }, [enabled, layers, fusion]);

  useEffect(() => {
    if (!enabled) return () => {};
    let frame = 0;
    const steps = [
      [0.12, 2.4],
      [0.22, 2.15],
      [0.34, 1.9],
      [0.48, 1.65],
      [0.62, 1.38],
      [0.78, 1.12],
    ];
    const interval = window.setInterval(() => {
      frame = (frame + 1) % steps.length;
      if (map.getLayer('smartsurf-senlay-wind-particles')) {
        map.setPaintProperty('smartsurf-senlay-wind-particles', 'line-dasharray', steps[frame]);
      }
      if (map.getLayer('smartsurf-senlay-sensor-wind')) {
        map.setPaintProperty('smartsurf-senlay-sensor-wind', 'line-dasharray', steps[(frame + 2) % steps.length]);
      }
      if (map.getLayer('smartsurf-senlay-current')) {
        map.setPaintProperty('smartsurf-senlay-current', 'line-dasharray', steps[(frame + 3) % steps.length]);
      }
      if (map.getLayer('smartsurf-senlay-swell')) {
        map.setPaintProperty('smartsurf-senlay-swell', 'line-dasharray', [1.8 + frame * 0.12, 1.1]);
      }
    }, 420);
    return () => window.clearInterval(interval);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return () => {};
    const clickableLayers = [
      'smartsurf-senlay-sensors',
      'smartsurf-senlay-tides',
      'smartsurf-senlay-temperature',
      'smartsurf-senlay-gps',
    ];
    const popup = new maplibregl.Popup({ closeButton: true, closeOnClick: true, maxWidth: '320px' });
    const handleClick = (event) => {
      const feature = event.features?.[0];
      if (!feature) return;
      popup.setLngLat(event.lngLat).setHTML(popupHtml(feature)).addTo(map);
    };
    const enter = () => { map.getCanvas().style.cursor = 'pointer'; };
    const leave = () => { map.getCanvas().style.cursor = ''; };
    clickableLayers.forEach((id) => {
      if (map.getLayer(id)) {
        map.on('click', id, handleClick);
        map.on('mouseenter', id, enter);
        map.on('mouseleave', id, leave);
      }
    });
    return () => {
      clickableLayers.forEach((id) => {
        if (map.getLayer(id)) {
          map.off('click', id, handleClick);
          map.off('mouseenter', id, enter);
          map.off('mouseleave', id, leave);
        }
      });
      popup.remove();
    };
  }, [enabled, fusion]);

  const suggestion = fusion ? createFusionSuggestion({ rider, safety, gear, fusion }) : null;

  const setLayer = (key, value) => setLayers({ ...layerDefaults, ...layers, [key]: value });

  return (
    <Paper className={classes.panel}>
      <Box className={classes.summaryBlock}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
          <Box>
            <Typography variant="overline" color="secondary">Senlay Fusion</Typography>
            <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
              Physical-world layer
            </Typography>
          </Box>
          <Stack direction="row" gap={1} alignItems="center">
            {loading && <CircularProgress color="secondary" size={18} />}
            <Chip
              size="small"
              color={enabled ? 'secondary' : 'default'}
              label={enabled ? 'On' : 'Off'}
              onClick={() => setEnabled(!enabled)}
            />
          </Stack>
        </Stack>

        {suggestion && (
          <>
          <Stack direction="row" gap={1} sx={{ mt: 1.5, flexWrap: 'wrap' }}>
            <Chip size="small" label={suggestion.status} color={suggestion.status === 'Go' ? 'success' : 'warning'} />
            <Chip size="small" label={`Kite ${suggestion.recommendedKite}`} />
            <Chip size="small" label={`Confidence ${Math.round((fusion.confidence || suggestion.confidence) * 100)}%`} />
          </Stack>
          <Typography className={classes.muted} sx={{ mt: 1, display: { xs: 'none', sm: 'block' } }}>
            {suggestion.recommendedAction}
          </Typography>
          <Typography sx={{ mt: 1, fontWeight: 800 }}>
            {Math.round(fusion.windKmh)} km/h wind, gusts {Math.round(fusion.gustKmh)} km/h, waves {fusion.waveM.toFixed(1)} m
          </Typography>
          <Box className={classes.miniFacts}>
            <Box className={classes.miniFact}>
              <strong>{fusion.nearestWindSensor ? `${fusion.nearestWindSensor.distance_km} km` : 'Model'}</strong>
              <span>{fusion.nearestWindSensor ? 'nearest wind sensor' : 'wind source'}</span>
            </Box>
            <Box className={classes.miniFact}>
              <strong>{fusion.swellM != null ? `${fusion.swellM.toFixed(1)} m` : '--'}</strong>
              <span>swell from {Math.round(fusion.swellDirection)} deg</span>
            </Box>
            <Box className={classes.miniFact}>
              <strong>{fusion.tideLevelM != null ? `${fusion.tideLevelM.toFixed(2)} m` : 'No gauge'}</strong>
              <span>tide / level</span>
            </Box>
            <Box className={classes.miniFact}>
              <strong>{fusion.waterTemperatureC != null ? `${fusion.waterTemperatureC.toFixed(1)} C` : `${Math.round(fusion.temperatureC)} C`}</strong>
              <span>{fusion.waterTemperatureC != null ? 'water temp' : 'air temp'}</span>
            </Box>
          </Box>
          </>
        )}
      </Box>

      <Box className={classes.feedBlock} sx={{ display: { xs: 'none', md: 'block' } }}>
        {suggestion && <SenlayContextFeed fusion={fusion} />}
      </Box>

      <Box className={classes.controlsBlock}>
        <Typography variant="overline" color="secondary">Map Layers</Typography>
        <Box className={classes.layerGrid}>
          {Object.entries({
            wind: 'Wind flow',
            swell: 'Swell',
            currents: 'Currents',
            tides: 'Tides',
            terrain: 'Terrain modifier',
            sensors: 'Sources',
            temperature: 'Temperature',
            gps: 'GPS / spot',
          }).map(([key, label]) => (
            <FormControlLabel
              key={key}
              className={classes.checkbox}
              control={(
                <Checkbox
                  size="small"
                  checked={!!layers[key]}
                  onChange={(event) => setLayer(key, event.target.checked)}
                  color="secondary"
                />
              )}
              label={label}
            />
          ))}
        </Box>

        <Stack direction="row" gap={1} sx={{ mt: 1.5, flexWrap: 'wrap' }}>
          <Button size="small" color="secondary" variant="contained" onClick={refresh} disabled={loading}>
            Refresh
          </Button>
          <Button size="small" color="secondary" variant="outlined" onClick={() => setChatOpen(true)}>
            Ask AI
          </Button>
          <Button size="small" color="inherit" component={Link} to="/smartsurf/conditions">
            Details
          </Button>
          {error && <Chip size="small" color="warning" label="Fallback data" />}
        </Stack>
      </Box>
      <SenlayWaterChat
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        center={center}
        fusion={fusion}
        onSenlayPayload={(payload) => setFusion(normalizeSenlayPayload(payload))}
      />
    </Paper>
  );
};

export default SenlayFusionMapLayer;
