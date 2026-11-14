// Map downloads must not hold DOMContentLoaded or account startup open.
(() => {
  'use strict';
  const scriptBase = new URL('.', document.currentScript.src);
  const notify = () => window.dispatchEvent(new Event('smartsurf:map-ready'));
  const load = (path, ready) => {
    if (ready()) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = new URL(path, scriptBase).href;
      script.async = true;
      script.onload = () => ready() ? resolve() : reject(new Error('Map library unavailable'));
      script.onerror = () => reject(new Error('Map library download failed'));
      document.head.appendChild(script);
    });
  };
  // Leaflet remains available while WebGL and its larger renderer download.
  const standard = load('vendor/leaflet/leaflet.js?v=20261020-v4', () => Boolean(window.L))
    .then(() => load('tracker-map.js?v=20261020-fallback-v5', () => Boolean(window.SmartSurfTrackerMap)))
    .then(notify);
  const enhanced = Promise.all([
    load('vendor/maplibre/maplibre-gl.js?v=20261020-v4', () => Boolean(window.maplibregl)),
    load('wind-layer.js?v=20260925-weather-v1', () => Boolean(window.SmartSurfWindLayer))
  ]).then(() => load('maplibre-map.js?v=20261020-v4', () => Boolean(window.SmartSurfMaplibreMap)))
    .then(notify);
  standard.catch(() => console.error('[SmartSurf] Standard map could not load.'));
  enhanced.catch(() => {
    window.SmartSurfMaplibreUnsupported = true;
    notify();
  });
})();
