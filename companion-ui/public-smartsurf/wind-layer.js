(function () {
  'use strict';

  // Windy-style wind particles for MapLibre. The layer draws streaks that advect
  // through a quantised GFS wind field. It ignores MapLibre's projection matrix
  // and positions particles in CSS pixels with its own north-up mercator maths, so
  // there are no per-particle map.project()/getBounds() calls in the hot loop.

  const SPEED_STOPS = [
    [0, [59, 130, 246]],
    [3, [34, 211, 238]],
    [6, [34, 197, 94]],
    [10, [234, 179, 8]],
    [15, [249, 115, 22]],
    [22, [239, 68, 68]]
  ];

  function speedColor(speed) {
    const value = Number.isFinite(speed) ? speed : 0;
    let lo = SPEED_STOPS[0];
    let hi = SPEED_STOPS[SPEED_STOPS.length - 1];
    for (let i = 0; i < SPEED_STOPS.length - 1; i += 1) {
      if (value >= SPEED_STOPS[i][0] && value <= SPEED_STOPS[i + 1][0]) { lo = SPEED_STOPS[i]; hi = SPEED_STOPS[i + 1]; break; }
    }
    if (value <= SPEED_STOPS[0][0]) { lo = hi = SPEED_STOPS[0]; }
    if (value >= SPEED_STOPS[SPEED_STOPS.length - 1][0]) { lo = hi = SPEED_STOPS[SPEED_STOPS.length - 1]; }
    const span = hi[0] - lo[0] || 1;
    const t = Math.max(0, Math.min(1, (value - lo[0]) / span));
    return [
      (lo[1][0] + (hi[1][0] - lo[1][0]) * t) / 255,
      (lo[1][1] + (hi[1][1] - lo[1][1]) * t) / 255,
      (lo[1][2] + (hi[1][2] - lo[1][2]) * t) / 255
    ];
  }

  const VERT = `attribute vec2 a_screen; attribute vec4 a_color; uniform vec2 u_resolution;
    varying vec4 v_color;
    void main() {
      vec2 clip = (a_screen / u_resolution) * 2.0 - 1.0;
      gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
      v_color = a_color;
    }`;
  const FRAG = `precision mediump float; varying vec4 v_color;
    void main() { gl_FragColor = v_color; }`;

  function compile(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const error = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error('wind layer shader: ' + error);
    }
    return shader;
  }

  const clampLat = (lat) => Math.max(-85.051129, Math.min(85.051129, lat));
  const mercX = (lng) => (lng + 180) / 360;
  function mercY(lat) {
    const s = Math.sin(clampLat(lat) * Math.PI / 180);
    return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
  }
  const invMercY = (y) => Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180 / Math.PI;

  function mercator(lng, lat) {
    return { x: mercX(lng), y: mercY(lat) };
  }

  function createWindLayer(map) {
    let gl = null;
    let program = null;
    let buffer = null;
    let resolution = [1, 1];
    let enabled = false;
    let destroyed = false;

    // Particle state: geographic longitude/latitude and remaining lifetime.
    let particles = [];
    let count = 0;
    let vertices = null;

    // Wind field: two frames for time interpolation.
    let field = null; // { nlat, nlon, lat0, lon0, dlat, dlon, scale, uA, vA, uB, vB, t }
    let lastTime = 0;
    let lastZoom = null;
    let frameBounds = null;
    let speedScale = 1;

    // The animation drives its own frame loop. Relying on triggerRepaint() from
    // inside render() stalls once the map goes idle (for example right after a
    // zoom), which left a stale mid-gesture frame on screen.
    let rafId = 0;
    const rafCall = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (cb) => setTimeout(() => cb(performance.now()), 16);
    const rafCancel = typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame : (id) => clearTimeout(id);
    function tick() {
      if (destroyed || !enabled) { rafId = 0; return; }
      map.triggerRepaint();
      rafId = rafCall(tick);
    }
    function startLoop() { if (!rafId && !destroyed) rafId = rafCall(tick); }
    function stopLoop() { if (rafId) { rafCancel(rafId); rafId = 0; } }

    const targetCount = () => {
      const area = resolution[0] * resolution[1];
      return Math.max(1200, Math.min(9000, Math.round(area / 260)));
    };

    function boundsNow() {
      if (frameBounds) return frameBounds;
      return map.getBounds ? map.getBounds() : null;
    }

    function spawn(index, insideOnly) {
      const bounds = boundsNow();
      let lng = Math.random() * 360 - 180;
      let lat = Math.random() * 170 - 85;
      if (bounds) {
        const west = bounds.getWest(); const east = bounds.getEast();
        const south = bounds.getSouth(); const north = bounds.getNorth();
        // Expand slightly so particles drift in from the edges.
        const padX = (east - west) * 0.05;
        const padY = (north - south) * 0.05;
        lng = west - padX + Math.random() * (east - west + padX * 2);
        lat = south - padY + Math.random() * (north - south + padY * 2);
      } else if (insideOnly) {
        lng = 108 + Math.random() * 2;
        lat = 15 + Math.random() * 2;
      }
      particles[index] = { lng, lat, age: Math.random() * 60, max: 60 + Math.random() * 60 };
    }

    function ensureParticles() {
      const want = targetCount();
      if (want !== count) {
        const next = [];
        for (let i = 0; i < want; i += 1) next.push(particles[i] || null);
        particles = next;
        count = want;
        vertices = new Float32Array(count * 2 * 6);
        for (let i = 0; i < count; i += 1) if (!particles[i]) spawn(i);
      }
    }

    function sampleField(frame, lng, lat) {
      const { nlat, nlon, lat0, lon0, dlat, dlon } = field;
      let x = (lng - lon0) / dlon;
      x = ((x % nlon) + nlon) % nlon; // wrap longitude across the antimeridian
      let y = (lat - lat0) / dlat;
      x = Math.max(0, Math.min(nlon - 1.001, x));
      y = Math.max(0, Math.min(nlat - 1.001, y));
      const x0 = Math.floor(x); const y0 = Math.floor(y);
      const x1 = Math.min(nlon - 1, x0 + 1); const y1 = Math.min(nlat - 1, y0 + 1);
      const fx = x - x0; const fy = y - y0;
      const array = frame === 'A' ? field.uA : field.uB;
      const varray = frame === 'A' ? field.vA : field.vB;
      const idx = (row) => row * nlon;
      const u = (array[idx(y0) + x0] * (1 - fx) + array[idx(y0) + x1] * fx) * (1 - fy)
        + (array[idx(y1) + x0] * (1 - fx) + array[idx(y1) + x1] * fx) * fy;
      const v = (varray[idx(y0) + x0] * (1 - fx) + varray[idx(y0) + x1] * fx) * (1 - fy)
        + (varray[idx(y1) + x0] * (1 - fx) + varray[idx(y1) + x1] * fx) * fy;
      return { u, v };
    }

    function windAt(lng, lat) {
      if (!field) return { u: 0, v: 0 };
      const a = sampleField('A', lng, lat);
      if (!field.uB || field.t <= 0) return a;
      const b = sampleField('B', lng, lat);
      const t = Math.max(0, Math.min(1, field.t));
      return { u: a.u * (1 - t) + b.u * t, v: a.v * (1 - t) + b.v * t };
    }

    // North-up mercator <-> screen. Falls back to map.project()/unproject() if the
    // map does not expose a centre/zoom (or is rotated).
    function makeView(w, h) {
      if (!map.getCenter || !map.getZoom) return null;
      const centre = map.getCenter();
      const zoom = map.getZoom();
      if (map.getBearing && Math.abs(map.getBearing()) > 0.01) return null;
      return { cx: mercX(centre.lng), cy: mercY(centre.lat), world: 512 * Math.pow(2, zoom), w, h };
    }
    function project(lng, lat, view) {
      if (view) return { x: (mercX(lng) - view.cx) * view.world + view.w / 2, y: (mercY(lat) - view.cy) * view.world + view.h / 2 };
      return map.project([lng, lat]);
    }
    function unproject(x, y, view) {
      if (view) return { lng: (view.cx + (x - view.w / 2) / view.world) * 360 - 180, lat: invMercY(view.cy + (y - view.h / 2) / view.world) };
      return map.unproject([x, y]);
    }

    function update(dtSeconds) {
      const canvas = map.getCanvas();
      resolution = [canvas.clientWidth || canvas.width, canvas.clientHeight || canvas.height];
      ensureParticles();
      if (!vertices) return 0;
      const w = resolution[0]; const h = resolution[1];
      const frameScale = Math.max(0.25, Math.min(3, dtSeconds * 60));

      // A zoom step redistributes the field so a zoom-out fills the newly visible
      // area at once instead of waiting for particles to age out.
      const zoom = map.getZoom ? map.getZoom() : null;
      if (zoom != null && (lastZoom === null || Math.abs(zoom - lastZoom) >= 0.5)) {
        lastZoom = zoom;
        frameBounds = map.getBounds ? map.getBounds() : null;
        for (let i = 0; i < count; i += 1) spawn(i, true);
      }

      // One bounds read per frame, not per particle.
      frameBounds = map.getBounds ? map.getBounds() : null;
      const west = frameBounds ? frameBounds.getWest() : null;
      const east = frameBounds ? frameBounds.getEast() : null;
      const south = frameBounds ? frameBounds.getSouth() : null;
      const north = frameBounds ? frameBounds.getNorth() : null;

      const view = makeView(w, h);
      let lit = 0;
      for (let i = 0; i < count; i += 1) {
        let p = particles[i];
        if (!p) { spawn(i, true); p = particles[i]; }
        p.age += dtSeconds;
        const inBounds = frameBounds ? (p.lng >= west && p.lng <= east && p.lat >= south && p.lat <= north) : true;
        if (p.age > p.max || !inBounds) { spawn(i, true); p = particles[i]; }
        // Recompute after any respawn so a freshly placed particle is drawn on the
        // same frame instead of waiting for the next one.
        const wind = windAt(p.lng, p.lat);
        const speed = Math.hypot(wind.u, wind.v);
        const a = project(p.lng, p.lat, view);
        if (speed < 0.3) { writeVertex(i, a, a, speed); continue; }
        // Particle speed tracks the real wind speed: calm drifts, 20 m/s races.
        const step = Math.min(7, 0.15 + speed * 0.18) * frameScale * speedScale;
        const nx = a.x + (wind.u / speed) * step;
        const ny = a.y - (wind.v / speed) * step;
        if (nx < -60 || nx > w + 60 || ny < -60 || ny > h + 60) { spawn(i, true); continue; }
        const ll = unproject(nx, ny, view);
        p.lng = ll.lng; p.lat = ll.lat;
        // Draw a long streak so direction and speed read as a trail.
        const dirx = wind.u / speed;
        const diry = -wind.v / speed;
        const streak = Math.min(34, 5 + speed * 1.2);
        writeVertex(i, { x: nx - dirx * streak, y: ny - diry * streak }, { x: nx, y: ny }, speed);
        lit += 1;
      }
      return lit;
    }

    function writeVertex(index, a, b, speed) {
      const color = speedColor(speed);
      const alpha = Math.min(0.98, 0.55 + speed / 14);
      const base = index * 12;
      vertices[base] = a.x; vertices[base + 1] = a.y;
      vertices[base + 2] = color[0]; vertices[base + 3] = color[1]; vertices[base + 4] = color[2]; vertices[base + 5] = alpha * 0.04;
      vertices[base + 6] = b.x; vertices[base + 7] = b.y;
      vertices[base + 8] = color[0]; vertices[base + 9] = color[1]; vertices[base + 10] = color[2]; vertices[base + 11] = alpha;
    }

    function draw() {
      if (!gl || !program || !enabled || !field) return;
      const now = performance.now();
      const dt = lastTime ? Math.min(0.1, (now - lastTime) / 1000) : 0.016;
      lastTime = now;
      update(dt);
      gl.useProgram(program);
      gl.uniform2f(program.u_resolution, resolution[0], resolution[1]);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(program.a_screen);
      gl.vertexAttribPointer(program.a_screen, 2, gl.FLOAT, false, 24, 0);
      gl.enableVertexAttribArray(program.a_color);
      gl.vertexAttribPointer(program.a_color, 4, gl.FLOAT, false, 24, 8);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.drawArrays(gl.LINES, 0, count * 2);
      gl.disable(gl.BLEND);
    }

    return {
      id: 'wind-particles',
      type: 'custom',
      renderingMode: '2d',
      onAdd(_map, context) {
        gl = context;
        program = gl.createProgram();
        gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT));
        gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAG));
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('wind layer link: ' + gl.getProgramInfoLog(program));
        program.a_screen = gl.getAttribLocation(program, 'a_screen');
        program.a_color = gl.getAttribLocation(program, 'a_color');
        program.u_resolution = gl.getUniformLocation(program, 'u_resolution');
        buffer = gl.createBuffer();
      },
      render() { if (enabled && !destroyed) draw(); },
      setData(data) {
        field = data;
        lastTime = 0;
        if (!particles.length) { ensureParticles(); frameBounds = map.getBounds ? map.getBounds() : null; for (let i = 0; i < count; i += 1) spawn(i, true); frameBounds = null; }
      },
      setTime(t) { if (field) field.t = t; },
      setSpeedScale(value) { speedScale = Math.max(0.1, Math.min(4, Number(value) || 1)); },
      setEnabled(value) {
        const next = Boolean(value);
        if (next === enabled) { if (next) map.triggerRepaint(); return; }
        enabled = next;
        lastTime = 0;
        if (enabled) startLoop(); else stopLoop();
        map.triggerRepaint();
      },
      isEnabled() { return enabled; },
      destroy() {
        destroyed = true;
        stopLoop();
        if (gl && buffer) gl.deleteBuffer(buffer);
        if (gl && program) gl.deleteProgram(program);
      }
    };
  }

  window.SmartSurfWindLayer = { createWindLayer, speedColor, mercator };
}());
