/* SmartSurf Rider web client. The UI is deliberately dependency-free so the
 * same build can run in the small production container and in a local preview. */
(function () {
  'use strict';

  const state = {
    user: null,
    profile: { rider: {}, gear: {}, safety: {} },
    spots: [],
    watches: [],
    events: [],
    sessions: [],
    feedback: [],
    billing: null,
    googleOAuth: { configured: false, connection: null },
    context: null,
    contextError: null,
    selectedSpot: null,
    screen: 'overview'
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const val = (value, fallback = '—') => value === null || value === undefined || value === '' ? fallback : value;
  const num = (value, digits = 1) => Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : '—';
  const label = value => String(value || '').replaceAll('_', ' ').replace(/\b\w/g, char => char.toUpperCase());
  const date = value => value ? new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Not yet';

  async function api(path, options = {}) {
    const config = { credentials: 'same-origin', ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) } };
    if (config.body && typeof config.body !== 'string') config.body = JSON.stringify(config.body);
    const response = await fetch(path, config);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error || `Request failed (${response.status})`);
      error.status = response.status;
      throw error;
    }
    return payload;
  }

  function toast(message, kind = 'info') {
    const node = $('#toast');
    if (!node) return;
    node.textContent = message;
    node.dataset.kind = kind;
    node.classList.add('visible');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => node.classList.remove('visible'), 4200);
  }

  function setVisible(id, visible) {
    const node = document.getElementById(id);
    if (node) node.classList.toggle('hidden', !visible);
  }

  function showAuth(tab = 'login') {
    setVisible('landingView', false);
    setVisible('guestView', false);
    setVisible('authView', true);
    switchAuth(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function showLanding() {
    setVisible('landingView', true);
    setVisible('guestView', false);
    setVisible('authView', false);
    setVisible('appView', false);
  }

  function switchAuth(tab) {
    $$('.auth-tab').forEach(button => button.classList.toggle('active', button.dataset.authTab === tab));
    setVisible('loginForm', tab === 'login');
    setVisible('registerForm', tab === 'register');
    setVisible('forgotForm', tab === 'forgot');
    setVisible('resetForm', tab === 'reset');
  }

  function formObject(form) {
    return Object.fromEntries(new FormData(form).entries());
  }

  function renderGuestResult(result, live) {
    const recommendation = result.recommendation || {};
    const metrics = recommendation.metrics || {};
    const evidence = recommendation.evidence || {};
    const node = $('#guestResult');
    node.innerHTML = `<h3>${esc(recommendation.verdictLabel || recommendation.verdict || 'Spot check')}</h3>
      <p>${esc(recommendation.summary || recommendation.contextString || 'No summary returned.')}</p>
      <div class="result-columns"><div><b>Wind</b><p>${num(metrics.windKt)} kt · gusts ${num(metrics.gustKt)} kt</p></div><div><b>Waves</b><p>${num(metrics.waveM, 2)} m · period ${num(metrics.periodS, 1)} s</p></div><div><b>Evidence</b><p>${esc(val(evidence.activeSources, 'unknown'))} active sources · ${live ? 'live Senlay' : 'demo fallback'}</p></div></div>
      ${(recommendation.warnings || []).length ? `<p class="danger-note">${esc(recommendation.warnings.join(' '))}</p>` : ''}
      <button class="small-button" data-action="create-from-guest">Save this spot</button>`;
    node.dataset.input = JSON.stringify(result.input || {});
    node.classList.remove('hidden');
  }

  function profileName() { return state.user?.name || 'Rider'; }

  async function hydrate(payload) {
    state.user = payload.user;
    state.profile = payload.profile || state.profile;
    state.watches = payload.watches || [];
    state.events = payload.watchEvents || [];
    state.sessions = payload.sessions || [];
    state.billing = payload.billing || null;
    state.googleOAuth = payload.googleOAuth || state.googleOAuth;
    const spots = await api('/api/spots');
    state.spots = spots.spots || [];
    setVisible('landingView', false);
    setVisible('authView', false);
    setVisible('guestView', false);
    setVisible('appView', true);
    renderScreen(state.screen);
  }

  async function refresh() {
    const payload = await api('/api/me');
    await hydrate(payload);
  }

  function contextSpot() {
    return state.selectedSpot || state.spots[0] || {
      name: 'An Bang', sport: 'kitesurfing', lat: 15.8801, lng: 108.3380
    };
  }

  async function loadContext(spot = contextSpot()) {
    state.selectedSpot = spot;
    state.contextError = null;
    try {
      const payload = await api(`/api/context?lat=${encodeURIComponent(spot.lat)}&lng=${encodeURIComponent(spot.lng)}&field=${encodeURIComponent(spot.sport || 'kitesurfing')}&spotName=${encodeURIComponent(spot.name || '')}`);
      state.context = payload.context;
      return state.context;
    } catch (error) {
      state.context = null;
      state.contextError = error.message;
      toast(error.message, 'error');
      return null;
    }
  }

  function trustBadge(context) {
    const trust = context?.trust;
    if (!trust) return '<span class="badge">FORECAST</span>';
    const stateName = trust.state || 'unknown';
    const klass = stateName === 'high' ? 'good' : stateName === 'low' ? 'warn' : '';
    return `<span class="badge ${klass}">${esc(stateName.toUpperCase())}</span>`;
  }

  function contextPanel(context, title = 'Live spot context') {
    if (!context) return `<div class="panel empty">${esc(state.contextError || 'Select a saved spot to load live evidence from Senlay.')}</div>`;
    const current = context.current || {};
    const evidence = context.evidence || {};
    const pattern = context.patterns?.status
      || context.patterns?.state
      || context.patterns?.wind?.status
      || context.patterns?.marine?.status
      || 'not enough history';
    const outcome = context.outcome || context.assessmentState || 'available';
    return `<section class="panel chart-panel"><div class="inline"><h3>${esc(title)}</h3>${trustBadge(context)}<span class="badge">${esc(label(outcome))}</span></div>
      <p class="muted">${esc(context.spot?.name || '')} · ${num(context.spot?.lat, 4)}, ${num(context.spot?.lng, 4)} · updated ${esc(date(evidence.timestamp))}</p>
      <div class="context-stats"><div><small>WIND</small><b>${num(current.windKt)} kt</b></div><div><small>GUSTS</small><b>${num(current.gustKt)} kt</b></div><div><small>WAVES</small><b>${num(current.waveM, 2)} m</b></div><div><small>SOURCES</small><b>${esc(val(evidence.activeSources))}</b></div></div>
      ${chartSvg(context, pattern)}
      <p class="muted">${esc(context.trust?.summary || 'Senlay reports the evidence available at this coordinate. Source disagreement and unknowns are kept visible.')}</p>
      ${context.conflicts?.length ? `<p class="danger-note">${context.conflicts.length} source conflict${context.conflicts.length === 1 ? '' : 's'} need checking.</p>` : ''}
      ${context.unknowns?.length ? `<p class="danger-note">${context.unknowns.length} unknown${context.unknowns.length === 1 ? '' : 's'} remain before a stronger decision.</p>` : ''}</section>`;
  }

  function chartSvg(context, pattern) {
    const forecast = (context.forecast || []).slice(0, 48).map(item => Number(item.windKmh)).filter(Number.isFinite);
    const history = (context.history || []).slice(-48).map(item => Number(item.windKmh)).filter(Number.isFinite);
    if (forecast.length < 2 && history.length < 2) return `<div class="live-chart chart-empty">No time series is available for this spot yet. ${esc(label(pattern))}</div>`;
    const values = [...forecast, ...history];
    const min = Math.min(...values);
    const max = Math.max(...values, min + 1);
    const points = series => series.map((value, index) => {
      const x = 4 + (index / Math.max(1, series.length - 1)) * 92;
      const y = 94 - ((value - min) / Math.max(1, max - min)) * 78;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    return `<div class="live-chart"><svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Live forecast and observed wind history">${forecast.length > 1 ? `<polyline class="chart-forecast" points="${points(forecast)}"/>` : ''}${history.length > 1 ? `<polyline class="chart-observed" points="${points(history)}"/>` : ''}</svg><span class="chart-label">${forecast.length > 1 ? 'forecast' : ''}${forecast.length > 1 && history.length > 1 ? ' · ' : ''}${history.length > 1 ? 'observed history' : ''} · ${esc(label(pattern))}</span></div>`;
  }

  function screenShell(title, subtitle, action = '') {
    return `<div class="dashboard-heading"><div><p class="eyebrow">SMARTSURF RIDER</p><h2>${esc(title)}</h2><p class="muted">${esc(subtitle)}</p></div>${action}</div>`;
  }

  function renderOverview() {
    const spot = contextSpot();
    const active = state.watches.filter(item => item.status === 'active').length;
    const latest = state.events[0];
    $('#dashboardContent').innerHTML = `<div class="screen active">${screenShell(`Good to see you, ${profileName()}.`, 'Your live watersports context, watches, and honest next actions in one place.', '<button class="primary-button" data-screen-jump="ask">Ask about a spot</button>')}
      <div class="dashboard-grid"><div class="panel metric-panel"><h3>${state.spots.length}</h3><small>saved spots</small></div><div class="panel metric-panel"><h3>${active}</h3><small>active watchdogs</small></div><div class="panel metric-panel"><h3>${state.events.length}</h3><small>recent evidence events</small></div></div>
      <div class="content-grid"><div>${contextPanel(state.context, `${esc(spot.name)} right now`)}</div><div class="panel"><h3>Latest watchdog signal</h3>${latest ? `<div class="list-item"><strong>${esc(latest.title || label(latest.event_type))}</strong><p>${esc(latest.summary || '')}</p><small>${esc(date(latest.created_at))}</small></div>` : '<div class="empty">No watchdog events yet. Save a spot and create your first watch.</div>'}<div class="inline" style="margin-top:14px"><button class="small-button" data-screen-jump="spots">Manage spots</button><button class="small-button" data-screen-jump="watches">Manage watches</button></div></div></div></div>`;
    if (state.spots.length && !state.context && !state.contextError) loadContext(spot).then(() => renderScreen('overview'));
  }

  function renderSpots() {
    const rows = state.spots.length ? state.spots.map(spot => `<div class="list-item spot-row"><div><strong>${esc(spot.name)}</strong><p>${esc(spot.locationLabel || `${num(spot.lat, 4)}, ${num(spot.lng, 4)}`)} · ${esc(label(spot.sport))}</p></div><div class="row-actions"><button class="small-button" data-action="select-spot" data-id="${esc(spot.id)}">View</button><button class="small-button danger" data-action="delete-spot" data-id="${esc(spot.id)}">Delete</button></div></div>`).join('') : '<div class="empty">No saved spots yet. Add the beach, break, or launch you actually ride.</div>';
    $('#dashboardContent').innerHTML = `<div class="screen active">${screenShell('My spots', 'Keep the places you ride close at hand. Each spot calls Senlay with its real watersport field.', '<button class="primary-button" data-screen-jump="ask">Ask SmartSurf</button>')}
      <div class="content-grid"><div class="panel"><h3>Saved spots</h3><div class="list">${rows}</div></div><form class="panel form-panel" id="spotForm"><h3>Add a spot</h3><div class="field"><label>Name<input name="name" placeholder="An Bang" required></label></div><div class="field"><label>Location label<input name="locationLabel" placeholder="Hoi An, Vietnam"></label></div><div class="field"><label>Sport<select name="sport"><option value="kitesurfing">Kitesurfing</option><option value="wingfoil">Wingfoil</option><option value="surfing">Surfing</option><option value="windsurfing">Windsurfing</option><option value="sup">SUP</option></select></label></div><div class="two-fields"><div class="field"><label>Latitude<input name="lat" type="number" step="0.0001" required></label></div><div class="field"><label>Longitude<input name="lng" type="number" step="0.0001" required></label></div></div><button class="primary-button" type="submit">Save spot</button></form></div></div>`;
  }

  function renderWatches() {
    const rows = state.watches.length ? state.watches.map(watch => `<div class="list-item watch-row"><div><strong>${esc(watch.spot_name)}</strong><p>${esc(label(watch.sport))} · ${esc(watch.status)} · ${watch.last_evaluated_at ? `checked ${esc(date(watch.last_evaluated_at))}` : 'not checked yet'}</p>${watch.last_error ? `<small class="danger-note">${esc(watch.last_error)}</small>` : ''}</div><div class="row-actions"><button class="small-button" data-action="evaluate-watch" data-id="${esc(watch.id)}">Check now</button><button class="small-button" data-action="toggle-watch" data-id="${esc(watch.id)}" data-status="${watch.status === 'active' ? 'paused' : 'active'}">${watch.status === 'active' ? 'Pause' : 'Resume'}</button><button class="small-button danger" data-action="delete-watch" data-id="${esc(watch.id)}">Delete</button></div></div>`).join('') : '<div class="empty">No watchdogs yet. A watchdog evaluates a saved spot in the background and records meaningful changes.</div>';
    const options = state.spots.map(spot => `<option value="${esc(spot.id)}">${esc(spot.name)} · ${esc(label(spot.sport))}</option>`).join('');
    $('#dashboardContent').innerHTML = `<div class="screen active">${screenShell('Watchdogs', 'Background monitoring stays honest: entering your range, leaving it, source disagreement, and insufficient evidence are separate events.', '')}
      <div class="content-grid"><div class="panel"><h3>Your watchdogs</h3><div class="list">${rows}</div></div><form class="panel form-panel" id="watchForm"><h3>Create a watchdog</h3>${options ? `<div class="field"><label>Saved spot<select name="spotId" required>${options}</select></label></div>` : '<p class="danger-note">Save a spot first.</p>'}<div class="field condition-field" data-condition-kind="wind"><label>Wind minimum / maximum (km/h)<div class="two-fields"><input name="min_wind_kmh" type="number" value="7" min="0"><input name="max_wind_kmh" type="number" value="25" min="1"></div></label></div><div class="field condition-field hidden" data-condition-kind="wave"><label>Wave minimum / maximum (m)<div class="two-fields"><input name="min_wave_m" type="number" step="0.1" value="0.3" min="0"><input name="max_wave_m" type="number" step="0.1" value="2" min="0.1"></div></label><label>Minimum period (seconds)<input name="min_period_s" type="number" step="0.5" min="0" placeholder="optional"></label></div><div class="field"><label>Minimum window (minutes)<input name="min_duration_minutes" type="number" min="30" value="60" required></label></div><button class="primary-button" type="submit" ${options ? '' : 'disabled'}>Start watchdog</button></form></div></div>`;
    const form = $('#watchForm');
    const select = form?.querySelector('[name="spotId"]');
    const sync = () => {
      const spot = state.spots.find(item => item.id === select?.value) || state.spots[0];
      const wave = ['surfing', 'sup'].includes(spot?.sport);
      $$('.condition-field', form).forEach(field => {
        const active = field.dataset.conditionKind === (wave ? 'wave' : 'wind');
        field.classList.toggle('hidden', !active);
        $$('input', field).forEach(input => { input.disabled = !active; input.required = active && !input.name.includes('period'); });
      });
    };
    select?.addEventListener('change', sync);
    sync();
  }

  function renderAsk() {
    const spotOptions = state.spots.map(spot => `<option value="${esc(spot.id)}">${esc(spot.name)} · ${esc(label(spot.sport))}</option>`).join('');
    $('#dashboardContent').innerHTML = `<div class="screen active">${screenShell('Ask SmartSurf', 'Ask a plain-language question. The answer is grounded in the live Senlay context for the selected watersports spot.', '')}
      <div class="content-grid"><form class="panel form-panel" id="askForm"><h3>What do you want to know?</h3>${spotOptions ? `<div class="field"><label>Spot<select name="spotId">${spotOptions}</select></label></div>` : '<p class="danger-note">You can use the demo coordinates below, or save a spot first.</p>'}<div class="two-fields"><div class="field"><label>Latitude<input name="lat" type="number" step="0.0001" value="${esc(contextSpot().lat)}" required></label></div><div class="field"><label>Longitude<input name="lng" type="number" step="0.0001" value="${esc(contextSpot().lng)}" required></label></div></div><div class="field"><label>Question<textarea name="question" rows="5" placeholder="Should I go now, and what should I recheck before entering?"></textarea></label></div><button class="primary-button" type="submit">Ask with live evidence</button></form><div id="askResult">${state.context ? contextPanel(state.context, 'Selected spot context') : '<div class="panel empty">Your answer and evidence will appear here.</div>'}</div></div></div>`;
    const select = $('#askForm select');
    if (select) select.addEventListener('change', () => { const spot = state.spots.find(item => item.id === select.value); if (spot) { $('#askForm [name="lat"]').value = spot.lat; $('#askForm [name="lng"]').value = spot.lng; loadContext(spot).then(renderAsk); } });
  }

  function renderSessions() {
    const rows = state.sessions.length ? state.sessions.map(session => `<div class="list-item"><strong>${esc(session.spot_name || 'Session')}</strong><p>${esc(label(session.activity))} · ${esc(session.status || 'recorded')} · ${esc(date(session.started_at))}</p><button class="small-button" data-action="feedback" data-id="${esc(session.id)}" data-spot="${esc(session.spot_name || '')}">Add session feedback</button></div>`).join('') : '<div class="empty">Sessions will appear when you start a ride from the connected rider workflow.</div>';
    $('#dashboardContent').innerHTML = `<div class="screen active">${screenShell('My sessions', 'Close the loop after a ride. Your feedback helps compare what the forecast said with what you actually found.', '')}<div class="panel"><div class="list">${rows}</div></div><div class="panel" style="margin-top:15px"><h3>Recent feedback</h3>${state.feedback.length ? `<div class="list">${state.feedback.map(item => `<div class="list-item"><strong>${esc(label(item.rating))}</strong><p>${esc(item.notes || 'No notes')}</p><small>${esc(date(item.created_at))}</small></div>`).join('')}</div>` : '<p class="muted">No feedback recorded yet.</p>'}</div></div>`;
  }

  function renderProfile() {
    const rider = state.profile.rider || {};
    const gear = state.profile.gear || {};
    $('#dashboardContent').innerHTML = `<div class="screen active">${screenShell('Rider profile', 'SmartSurf uses these preferences to make watersports recommendations more personal. You can edit them any time.', '')}<div class="content-grid"><form class="panel form-panel" id="riderForm"><h3>Rider</h3><div class="two-fields"><div class="field"><label>Skill<select name="skillLevel"><option ${rider.skill_level === 'beginner' ? 'selected' : ''}>beginner</option><option ${rider.skill_level === 'intermediate' ? 'selected' : ''}>intermediate</option><option ${rider.skill_level === 'advanced' ? 'selected' : ''}>advanced</option></select></label></div><div class="field"><label>Primary sport<select name="primarySport"><option value="kitesurfing" ${rider.primary_sport === 'kitesurfing' ? 'selected' : ''}>Kitesurfing</option><option value="wingfoil" ${rider.primary_sport === 'wingfoil' ? 'selected' : ''}>Wingfoil</option><option value="surfing" ${rider.primary_sport === 'surfing' ? 'selected' : ''}>Surfing</option><option value="windsurfing" ${rider.primary_sport === 'windsurfing' ? 'selected' : ''}>Windsurfing</option><option value="sup" ${rider.primary_sport === 'sup' ? 'selected' : ''}>SUP</option></select></label></div></div><div class="two-fields"><div class="field"><label>Weight (kg)<input name="weightKg" type="number" value="${esc(val(rider.weight_kg, ''))}"></label></div><div class="field"><label>Height (cm)<input name="heightCm" type="number" value="${esc(val(rider.height_cm, ''))}"></label></div></div><div class="field"><label>Home spot<input name="homeSpot" value="${esc(rider.home_spot || '')}"></label></div><button class="primary-button" type="submit">Save rider profile</button></form><form class="panel form-panel" id="gearForm"><h3>Gear</h3><div class="field"><label>Owned kite sizes<input name="ownedKiteSizes" value="${esc(gear.owned_kite_sizes || '')}" placeholder="7, 9, 12"></label></div><div class="field"><label>Board type<input name="boardType" value="${esc(gear.board_type || '')}" placeholder="twin-tip"></label></div><div class="field"><label>Equipment notes<textarea name="equipment" rows="5">${esc(gear.equipment || '')}</textarea></label></div><button class="primary-button" type="submit">Save gear</button></form></div></div>`;
    const connections = document.createElement('section');
    connections.className = 'panel account-connections';
    const googleConnection = state.googleOAuth?.connection;
    const googleAction = googleConnection
      ? `<span class="badge good">Connected · ${esc(googleConnection.email)}</span>`
      : state.googleOAuth?.configured
        ? `<button class="google-button" type="button" data-action="link-google"><svg class="google-icon" viewBox="0 0 18 18" aria-hidden="true" focusable="false"><path fill="#4285F4" d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.909c1.702-1.567 2.683-3.874 2.683-6.614Z"/><path fill="#34A853" d="M9 18c2.43 0 4.468-.806 5.957-2.181l-2.909-2.258c-.806.54-1.836.859-3.048.859-2.344 0-4.328-1.585-5.037-3.714H.956v2.333A9 9 0 0 0 9 18Z"/><path fill="#FBBC05" d="M3.963 10.706A5.41 5.41 0 0 1 3.681 9c0-.592.102-1.168.282-1.706V4.961H.956A9 9 0 0 0 0 9c0 1.452.347 2.827.956 4.039l3.007-2.333Z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.507.454 3.441 1.346l2.581-2.581C13.464.892 11.426 0 9 0A9 9 0 0 0 .956 4.961l3.007 2.333C4.672 5.165 6.656 3.58 9 3.58Z"/></svg><span>Connect Google account</span></button>`
        : '<span class="muted">Google sign-in is not configured yet.</span>';
    connections.innerHTML = `<div><h3>Connected accounts</h3><p class="muted">Link Google to sign in to this Rider account without another password. SmartSurf requests only your basic profile and email address.</p></div>${googleAction}`;
    $('#dashboardContent .screen')?.append(connections);
  }

  async function renderBilling() {
    if (!state.billing) { try { state.billing = (await api('/api/billing/status')).billing; } catch (error) { toast(error.message, 'error'); } }
    const billing = state.billing || {};
    const paymentAction = billing.plan === 'pro'
      ? '<p class="success-note">Your Pro access is active. Subscription management will appear here when the billing portal is enabled.</p>'
      : billing.configured
        ? '<button class="primary-button" data-action="checkout">Upgrade to Pro</button>'
        : '<p class="danger-note">Payments are not configured yet. The free plan is fully usable while credentials are added later.</p>';
    $('#dashboardContent').innerHTML = `<div class="screen active">${screenShell('Plan & billing', 'Start free, then unlock more monitored spots and email alerts when you are ready.', '')}<div class="panel"><div class="inline"><h3>${esc(label(billing.plan || 'free'))} plan</h3><span class="badge ${billing.plan === 'pro' ? 'good' : ''}">${esc(billing.status || 'inactive')}</span></div><p class="muted">${billing.limits?.watches || 1} watched spot${billing.limits?.watches === 1 ? '' : 's'} · email alerts ${billing.features?.emailAlerts ? 'enabled' : 'available on Pro'}</p>${paymentAction}</div></div>`;
  }

  function renderScreen(screen) {
    state.screen = screen;
    $$('.side-nav[data-screen]').forEach(button => button.classList.toggle('active', button.dataset.screen === screen));
    if (screen === 'overview') renderOverview();
    if (screen === 'spots') renderSpots();
    if (screen === 'watches') renderWatches();
    if (screen === 'ask') renderAsk();
    if (screen === 'sessions') { Promise.all([api('/api/sessions').then(data => { state.sessions = data.sessions || []; }), api('/api/feedback').then(data => { state.feedback = data.feedback || []; })]).finally(renderSessions); }
    if (screen === 'profile') renderProfile();
    if (screen === 'billing') renderBilling();
  }

  async function signOut() {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
    Object.assign(state, { user: null, spots: [], watches: [], events: [], context: null, contextError: null, selectedSpot: null });
    showLanding();
    toast('Signed out.');
  }

  async function handleSubmit(event) {
    const form = event.target;
    if (!form.matches('form')) return;
    event.preventDefault();
    const data = formObject(form);
    try {
      if (form.id === 'loginForm') { await hydrate(await api('/api/auth/login', { method: 'POST', body: data })); toast('Welcome back.'); }
      if (form.id === 'registerForm') { await hydrate(await api('/api/auth/register', { method: 'POST', body: data })); toast('Your Rider account is ready.'); }
      if (form.id === 'forgotForm') { await api('/api/auth/forgot-password', { method: 'POST', body: data }); switchAuth('login'); toast('If the account exists, a reset link has been sent.'); }
      if (form.id === 'resetForm') {
        if (data.password !== data.confirmPassword) throw new Error('The new passwords do not match.');
        delete data.confirmPassword;
        await hydrate(await api('/api/auth/reset-password', { method: 'POST', body: data }));
        history.replaceState({}, '', '/');
        toast('Password changed. You are signed in.');
      }
      if (form.id === 'guestForm') { const result = await api('/api/guest/assessment', { method: 'POST', body: data }); result.input = data; renderGuestResult(result, result.liveSenlay); }
      if (form.id === 'spotForm') { const result = await api('/api/spots', { method: 'POST', body: data }); state.spots.unshift(result.spot); toast('Spot saved.'); renderScreen('spots'); }
      if (form.id === 'watchForm') { const spot = state.spots.find(item => item.id === data.spotId); if (!spot) throw new Error('Save a spot first.'); const wave = ['surfing', 'sup'].includes(spot.sport); const conditions = wave ? { min_wave_m: data.min_wave_m, max_wave_m: data.max_wave_m, min_period_s: data.min_period_s, min_duration_minutes: data.min_duration_minutes } : { min_wind_kmh: data.min_wind_kmh, max_wind_kmh: data.max_wind_kmh, min_duration_minutes: data.min_duration_minutes }; const watch = await api('/api/watches', { method: 'POST', body: { spotId: spot.id, spotName: spot.name, sport: spot.sport, lat: spot.lat, lng: spot.lng, conditions, eventTypes: [] } }); state.watches.unshift(watch.watch); state.events = [{ ...(watch.evaluation?.events?.[0] || {}), created_at: new Date().toISOString() }, ...state.events].filter(item => item.title); toast('Watchdog created.'); renderScreen('watches'); }
      if (form.id === 'askForm') { const spot = state.spots.find(item => item.id === data.spotId) || contextSpot(); const answer = await api('/api/ask', { method: 'POST', body: { lat: data.lat, lng: data.lng, field: spot.sport || 'kitesurfing', sport: spot.sport || 'kitesurfing', spotName: spot.name, question: data.question } }); state.context = answer.answer.context; $('#askResult').innerHTML = `<div class="panel"><div class="inline"><h3>${esc(answer.answer.verdictLabel || 'Answer')}</h3>${trustBadge(answer.answer.context)}</div><p class="answer">${esc(answer.answer.answer || answer.answer.summary || '')}</p>${answer.answer.reasons?.length ? `<h4>Why</h4><ul class="answer-list">${answer.answer.reasons.map(item => `<li>${esc(item)}</li>`).join('')}</ul>` : ''}${answer.answer.warnings?.length ? `<p class="danger-note">${esc(answer.answer.warnings.join(' '))}</p>` : ''}</div>${contextPanel(answer.answer.context, 'Evidence behind this answer')}`; toast('Answer grounded in live Senlay context.'); }
      if (form.id === 'riderForm') { state.profile.rider = (await api('/api/profile/rider', { method: 'PUT', body: data })).rider; toast('Rider profile saved.'); }
      if (form.id === 'gearForm') { state.profile.gear = (await api('/api/profile/gear', { method: 'PUT', body: data })).gear; toast('Gear profile saved.'); }
      if (form.id === 'feedbackForm') { await api('/api/feedback', { method: 'POST', body: data }); toast('Session feedback saved.'); renderScreen('sessions'); }
    } catch (error) { toast(error.message, 'error'); }
  }

  async function handleAction(event) {
    const button = event.target.closest('[data-action], [data-screen-jump]');
    if (!button) return;
    if (button.dataset.screenJump) return renderScreen(button.dataset.screenJump);
    const action = button.dataset.action;
    try {
      if (action === 'select-spot') { const spot = state.spots.find(item => item.id === button.dataset.id); await loadContext(spot); renderScreen('overview'); }
      if (action === 'delete-spot' && confirm('Remove this saved spot?')) { await api(`/api/spots/${encodeURIComponent(button.dataset.id)}`, { method: 'DELETE' }); state.spots = state.spots.filter(item => item.id !== button.dataset.id); state.selectedSpot = null; renderScreen('spots'); toast('Spot removed.'); }
      if (action === 'evaluate-watch') { const result = await api(`/api/watches/${encodeURIComponent(button.dataset.id)}/evaluate`, { method: 'POST' }); state.watches = state.watches.map(item => item.id === result.watch.id ? result.watch : item); state.events = (await api('/api/watch-events')).events || state.events; renderScreen('watches'); toast('Watchdog checked.'); }
      if (action === 'toggle-watch') { const result = await api(`/api/watches/${encodeURIComponent(button.dataset.id)}`, { method: 'PATCH', body: { status: button.dataset.status } }); state.watches = state.watches.map(item => item.id === result.watch.id ? result.watch : item); renderScreen('watches'); }
      if (action === 'delete-watch') { await api(`/api/watches/${encodeURIComponent(button.dataset.id)}`, { method: 'DELETE' }); state.watches = state.watches.filter(item => item.id !== button.dataset.id); renderScreen('watches'); toast('Watchdog removed.'); }
      if (action === 'checkout') { const result = await api('/api/billing/checkout', { method: 'POST' }); if (result.checkoutUrl) window.location.href = result.checkoutUrl; }
      if (action === 'link-google') { const result = await api('/api/auth/google/link/start', { method: 'POST' }); if (result.authorizationUrl) window.location.assign(result.authorizationUrl); }
      if (action === 'feedback') { const panel = document.createElement('div'); panel.className = 'panel'; panel.innerHTML = `<form id="feedbackForm" class="form-panel"><h3>Feedback for ${esc(button.dataset.spot)}</h3><input type="hidden" name="sessionId" value="${esc(button.dataset.id)}"><div class="field"><label>How was it?<select name="rating"><option>great</option><option>good</option><option>marginal</option><option>bad</option><option>unsafe</option></select></label></div><div class="field"><label>Notes<textarea name="notes" rows="4" placeholder="What did you actually find?"></textarea></label></div><button class="primary-button" type="submit">Save feedback</button></form>`; $('#dashboardContent').prepend(panel); panel.scrollIntoView({ behavior: 'smooth' }); }
      if (action === 'create-from-guest') { showAuth('register'); }
    } catch (error) { toast(error.message, 'error'); }
  }

  document.addEventListener('click', event => {
    const authTab = event.target.closest('[data-auth-tab]');
    if (authTab) return switchAuth(authTab.dataset.authTab);
    if (event.target.closest('#topSignIn')) return showAuth('login');
    if (event.target.closest('#topCreate, #heroCreate, #pricingCreate')) return showAuth('register');
    if (event.target.closest('#backLanding')) return showLanding();
    if (event.target.closest('#forgotButton')) return switchAuth('forgot');
    if (event.target.closest('#backLogin')) return switchAuth('login');
    if (event.target.closest('#resetBackLogin')) return switchAuth('login');
    if (event.target.closest('#logoutButton, #mobileLogout')) return signOut();
    const screen = event.target.closest('[data-screen]');
    if (screen) return renderScreen(screen.dataset.screen);
    handleAction(event);
  });
  document.addEventListener('submit', handleSubmit);

  async function init() {
    $('#guestForm')?.closest('.guest-view')?.classList.add('hidden');
    api('/api/auth/google/status').then(result => {
      if (result.configured) $('#googleAuthArea')?.classList.remove('hidden');
    }).catch(() => {});
    try {
      await hydrate(await api('/api/me'));
      const params = new URLSearchParams(window.location.search);
      if (params.get('google') === 'linked') {
        params.delete('google');
        history.replaceState({}, '', `${window.location.pathname}${params.size ? `?${params}` : ''}${window.location.hash}`);
        toast('Google account connected.');
      }
    }
    catch (error) {
      if (error.status !== 401) toast(error.message, 'error');
      showLanding();
      const token = new URLSearchParams(window.location.search).get('reset_token');
      if (token) { showAuth('reset'); const input = $('#resetForm [name="token"]'); if (input) input.value = token; }
    }
  }
  init();
}());
