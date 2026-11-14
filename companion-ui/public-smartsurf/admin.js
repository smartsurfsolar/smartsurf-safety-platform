(() => {
  'use strict';

  const API = new URL('./api/admin/v1', window.location.href).pathname.replace(/\/$/, '');
  const app = document.getElementById('app');
  const state = { session: null, view: 'dashboard', query: '' };

  async function request(path, options = {}) {
    const response = await fetch(`${API}${path}`, {
      credentials: 'same-origin',
      cache: 'no-store',
      ...options,
      headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.error?.message || data.error || `Request failed (${response.status}).`);
      error.status = response.status;
      error.code = data.error?.code;
      throw error;
    }
    return data;
  }

  function escape(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  }

  function notice(message, kind = 'error') {
    const el = document.getElementById('page-notice');
    if (!el) return;
    el.className = kind;
    el.textContent = message;
    el.hidden = !message;
  }

  function renderGate(title, description, form) {
    app.innerHTML = `<section class="gate"><p class="eyebrow">SMARTSURF CONTROL PLANE</p><h1>${escape(title)}</h1><p class="muted">${escape(description)}</p><div id="gate-message" hidden></div>${form}</section>`;
  }

  function showSignIn() {
    renderGate('Sign in required', 'Use your existing SmartSurf account. Admin access is granted separately and is never inferred from your Rider or Instructor profile.', '<a class="button primary" href="./rider.html">Open SmartSurf sign in</a>');
  }

  function showDenied() {
    renderGate('No SuperAdmin role assigned', 'This account has no platform-administration role. Ask an existing Super Admin to provision access; creating a Rider or Instructor account does not grant it.', '<a class="button" href="./rider.html">Back to SmartSurf</a>');
  }

  function showEnroll() {
    renderGate('Set up authenticator MFA', 'Administrative access requires TOTP MFA. Confirm your account password, add the displayed key to an authenticator app, then verify a current six-digit code.', `
      <form id="enroll-form"><div class="field"><label for="current-password">Current SmartSurf password</label><input id="current-password" type="password" autocomplete="current-password" required></div><button class="primary">Begin secure enrollment</button></form>
      <div id="secret-step" hidden><p class="notice">Save this key in your authenticator app. It is shown once for this enrollment attempt.</p><div class="field"><label>Manual setup key</label><div id="secret" class="code-box"></div></div><p class="muted">Alternatively, use this authenticator link:</p><a id="otp-link" class="button" rel="nofollow">Open authenticator</a><form id="confirm-form"><div class="field"><label for="enroll-code">Six-digit code</label><input id="enroll-code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" required></div><button class="primary">Verify and enable MFA</button></form></div>`);
    document.getElementById('enroll-form').addEventListener('submit', async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const button = form.querySelector('button');
      button.disabled = true;
      try {
        const result = await request('/mfa/enroll', { method: 'POST', body: JSON.stringify({ currentPassword: document.getElementById('current-password').value }) });
        document.getElementById('secret').textContent = result.secret;
        const link = document.getElementById('otp-link');
        link.href = result.otpauthUrl;
        link.title = result.otpauthUrl;
        document.getElementById('secret-step').hidden = false;
      } catch (error) { gateNotice(error.message); }
      finally { button.disabled = false; }
    });
    document.getElementById('confirm-form').addEventListener('submit', async event => {
      event.preventDefault();
      const button = event.currentTarget.querySelector('button');
      button.disabled = true;
      try {
        await request('/mfa/confirm', { method: 'POST', body: JSON.stringify({ code: document.getElementById('enroll-code').value }) });
        showStepUp();
      } catch (error) { gateNotice(error.message); }
      finally { button.disabled = false; }
    });
  }

  function gateNotice(message) {
    const el = document.getElementById('gate-message');
    if (!el) return;
    el.hidden = false;
    el.className = 'error';
    el.textContent = message;
  }

  function showStepUp() {
    renderGate('Verify this session', 'Enter a fresh code from your authenticator. The verification lasts 15 minutes for this browser session.', `
      <form id="step-form"><div class="field"><label for="step-code">Six-digit authenticator code</label><input id="step-code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" required></div><button class="primary">Continue securely</button></form>`);
    document.getElementById('step-form').addEventListener('submit', async event => {
      event.preventDefault();
      const button = event.currentTarget.querySelector('button');
      button.disabled = true;
      try {
        await request('/auth/step-up', { method: 'POST', body: JSON.stringify({ code: document.getElementById('step-code').value }) });
        await openPanel();
      } catch (error) { gateNotice(error.message); }
      finally { button.disabled = false; }
    });
  }

  const NAV = [
    ['Overview', 'dashboard.read', 'dashboard'],
    ['Users', 'users.read', 'users'],
    ['Roles & access', 'roles.read', 'roles'],
    ['Organizations', 'organizations.read', 'organizations'],
    ['Devices & tracking', 'devices.read', 'devices'],
    ['Safety Center', 'safety.read', 'safety'],
    ['Notifications', 'notifications.read', 'notifications'],
    ['Payments', 'billing.read', 'billing'],
    ['Pro checkout', 'billing.control', 'pro-checkout'],
    ['Subscriptions', 'subscriptions.read', 'subscriptions'],
    ['System health', 'system.read', 'system'],
    ['Design system', 'system.design.manage', 'design-system'],
    ['Audit log', 'audit.read', 'audit']
  ];

  async function openPanel() {
    state.session = await request('/session');
    if (!state.session.mfaEnrolled) return showEnroll();
    if (state.session.stepUpRequired) return showStepUp();
    renderShell();
    await loadView(state.view);
  }

  function renderShell() {
    const roleNames = state.session.roles.map(role => escape(role.label)).join(', ');
    const nav = NAV.filter(([, permission]) => state.session.permissions.includes(permission))
      .map(([label, , view]) => `<button data-view="${view}" class="${state.view === view ? 'active' : ''}">${escape(label)}</button>`).join('');
    app.innerHTML = `
      <header class="topbar"><div class="brand"><div class="brand-mark">SS</div><div><h1>SmartSurf SuperAdmin</h1><p>Protected operations console</p></div></div>
        <div class="top-actions"><span class="pill">${roleNames || 'Admin'}</span><a class="button" href="./rider.html">Rider app</a></div>
      </header>
      <div class="layout"><nav class="nav" aria-label="SuperAdmin sections">${nav}</nav><section class="content"><div id="page-notice" hidden></div><div id="view"></div></section></div>`;
    app.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => {
      state.view = button.dataset.view;
      renderShell();
      loadView(state.view).catch(showError);
    }));
  }

  function showError(error) {
    if (error.status === 401) return showSignIn();
    if (error.status === 428) return error.code === 'MFA_ENROLLMENT_REQUIRED' ? showEnroll() : showStepUp();
    notice(error.message || 'Unable to load this section.');
  }

  function setPage(title, subtitle, content = '') {
    document.getElementById('view').innerHTML = `<div class="page-head"><div><h2>${escape(title)}</h2><p class="muted">${escape(subtitle)}</p></div></div>${content}`;
  }

  function table(headers, rows) {
    if (!rows.length) return '<p class="muted">No records found.</p>';
    return `<div class="table-wrap"><table><thead><tr>${headers.map(head => `<th>${escape(head)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
  }

  function pill(value) {
    const safe = String(value || 'unknown');
    return `<span class="pill ${escape(safe)}">${escape(safe.replaceAll('_', ' '))}</span>`;
  }

  async function loadView(view) {
    notice('');
    if (view === 'dashboard') return loadDashboard();
    if (view === 'users') return loadUsers();
    if (view === 'roles') return loadRoles();
    if (view === 'organizations') return loadOrganizations();
    if (view === 'devices') return loadDevices();
    if (view === 'safety') return loadSafety();
    if (view === 'notifications') return loadNotifications();
    if (view === 'billing') return loadBilling();
    if (view === 'pro-checkout') return loadProCheckout();
    if (view === 'subscriptions') return loadSubscriptions();
    if (view === 'system') return loadSystem();
    if (view === 'design-system') return loadDesignSystem();
    if (view === 'audit') return loadAudit();
  }

  async function loadDashboard() {
    const d = await request('/dashboard');
    const metrics = [['Accounts', d.users], ['Active accounts', d.activeUsers], ['Devices', d.devices], ['Online (5 min)', d.onlineDevices], ['Active sessions', d.activeSessions], ['Open safety incidents', d.openIncidents], ['Pending tracker orders', d.pendingOrders], ['Active subscriptions', d.activeSubscriptions]];
    setPage('Operations overview', `Shared production Rider data · refreshed ${new Date(d.checkedAt).toLocaleTimeString()}`, `<div class="cards">${metrics.map(([name, value]) => `<article class="card metric">${escape(name)}<strong>${Number(value || 0).toLocaleString()}</strong></article>`).join('')}</div><div class="notice">Critical actions remain owned by their existing workflows. This panel does not directly control Traccar credentials, payment capture/refunds, or emergency-service dispatch.</div>`);
  }

  async function loadUsers() {
    const content = `<div class="toolbar"><div class="field"><label for="user-query">Search name or email</label><input id="user-query" value="${escape(state.query)}"></div><button id="user-search">Search</button></div><div id="users-table"></div>`;
    setPage('Users', 'Account identity is shared with the Rider app. Password hashes and authentication secrets are never returned.', content);
    document.getElementById('user-search').addEventListener('click', () => { state.query = document.getElementById('user-query').value.trim(); fetchUsers(); });
    await fetchUsers();
  }

  async function fetchUsers() {
    const data = await request(`/users?q=${encodeURIComponent(state.query)}&limit=50`);
    const canManage = state.session.permissions.includes('users.status.manage');
    const canEdit = state.session.permissions.includes('users.profile.manage');
    const rows = data.users.map(user => `<tr><td>${escape(user.name)}<small>#${user.id} · ${escape(user.email)}</small></td><td>${escape(user.rider_role || 'rider')}</td><td>${escape((user.admin_roles || '').replaceAll(',', ', ') || '—')}</td><td>${pill(user.status)}</td><td>${escape(user.created_at)}</td><td>${canEdit ? `<button class="small" data-edit-user="${user.id}" data-name="${escape(user.name)}" data-email="${escape(user.email)}" data-phone="${escape(user.phone)}">Edit</button> ` : ''}${canManage && user.status !== 'deleted' ? `<button class="small ${user.status === 'active' ? 'danger' : ''}" data-status-id="${user.id}" data-next-status="${user.status === 'active' ? 'suspended' : 'active'}">${user.status === 'active' ? 'Suspend' : 'Reactivate'}</button>` : ''}</td></tr>`);
    document.getElementById('users-table').innerHTML = table(['Account', 'Rider persona', 'Platform roles', 'Status', 'Created', 'Action'], rows);
    document.querySelectorAll('[data-status-id]').forEach(button => button.addEventListener('click', async () => {
      if (!window.confirm(`Set account #${button.dataset.statusId} to ${button.dataset.nextStatus}? Active sessions will be revoked when suspended.`)) return;
      try { await request(`/users/${button.dataset.statusId}/status`, { method: 'PATCH', body: JSON.stringify({ status: button.dataset.nextStatus }) }); await fetchUsers(); }
      catch (error) { notice(error.message); }
    }));
    document.querySelectorAll('[data-edit-user]').forEach(button => button.addEventListener('click', async () => {
      const name = window.prompt('Account name', button.dataset.name);
      if (name === null) return;
      const email = window.prompt('Account email', button.dataset.email);
      if (email === null) return;
      const phone = window.prompt('Phone', button.dataset.phone);
      if (phone === null) return;
      try { await request(`/users/${button.dataset.editUser}/profile`, { method: 'PATCH', body: JSON.stringify({ name, email, phone }) }); await fetchUsers(); }
      catch (error) { notice(error.message); }
    }));
  }

  async function loadRoles() {
    const d = await request('/roles');
    const roles = d.roles.map(role => `<tr><td>${escape(role.label)}<small>${escape(role.key)} · ${escape(role.scope)} scope</small></td><td>${escape(role.permissions.join(', ') || 'No platform permissions')}</td></tr>`);
    const assignments = d.assignments.map(row => `<tr><td>${escape(row.name)}<small>${escape(row.email)} · #${row.userId}</small></td><td>${escape(row.roleKey)}</td><td>${escape(row.organizationId || 'Global')}</td><td>${escape(row.assignedAt)}</td>${state.session.permissions.includes('roles.assign') ? `<td><button class="small danger" data-revoke-role="${row.id}">Revoke</button></td>` : ''}</tr>`);
    const addForm = state.session.permissions.includes('roles.assign') ? `<form id="role-form" class="inline-form"><div class="field"><label>User ID</label><input name="userId" type="number" min="1" required></div><div class="field"><label>Role</label><select name="roleKey">${d.roles.map(role => `<option value="${escape(role.key)}">${escape(role.label)}</option>`).join('')}</select></div><div class="field"><label>Organization ID (for scoped roles)</label><input name="organizationId" type="number" min="1"></div><button class="primary">Assign role</button></form>` : '';
    setPage('Roles & access', 'Roles are fixed in backend policy. Rider persona never grants administrator privileges.', `<div class="panel"><h3>Role catalog</h3>${table(['Role', 'Permissions'], roles)}</div><div class="panel"><h3>Active assignments</h3>${table(state.session.permissions.includes('roles.assign') ? ['Account', 'Role', 'Scope', 'Assigned', 'Action'] : ['Account', 'Role', 'Scope', 'Assigned'], assignments)}${addForm}</div>`);
    const form = document.getElementById('role-form');
    if (form) form.addEventListener('submit', async event => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(form));
      try { await request(`/users/${values.userId}/roles`, { method: 'POST', body: JSON.stringify({ roleKey: values.roleKey, organizationId: values.organizationId || undefined }) }); await loadRoles(); }
      catch (error) { notice(error.message); }
    });
    document.querySelectorAll('[data-revoke-role]').forEach(button => button.addEventListener('click', async () => {
      if (!window.confirm('Revoke this role assignment?')) return;
      try { await request(`/role-assignments/${button.dataset.revokeRole}`, { method: 'DELETE' }); await loadRoles(); }
      catch (error) { notice(error.message); }
    }));
  }

  async function loadOrganizations() {
    const d = await request('/organizations?limit=100');
    const rows = d.organizations.map(org => `<tr><td>${escape(org.name)}<small>#${org.id} · ${escape(org.type)}</small></td><td>${pill(org.status)}</td><td>${escape(org.memberCount)}</td><td>${escape(org.legacyOwnerName || '—')}</td><td>${state.session.permissions.includes('organizations.manage') ? `<button class="small" data-org-id="${org.id}" data-org-next="${org.status === 'active' ? 'suspended' : 'active'}">${org.status === 'active' ? 'Suspend' : 'Activate'}</button>` : '—'}</td></tr>`);
    const form = state.session.permissions.includes('organizations.manage') ? `<div class="panel"><h3>Add organization</h3><form id="org-form" class="inline-form"><div class="field"><label>Name</label><input name="name" required maxlength="120"></div><div class="field"><label>Type</label><select name="type"><option value="watersports_school">Watersports school</option><option value="partner">Partner</option></select></div><div class="field"><label>Existing owner user ID (optional)</label><input name="ownerUserId" type="number" min="1"></div><button class="primary">Create</button></form></div>` : '';
    setPage('Organizations & schools', 'Legacy school profiles are linked in place; existing school ownership data is not migrated or duplicated.', `${form}<div id="org-table">${table(['Organization', 'Status', 'Members', 'Legacy owner', 'Action'], rows)}</div>`);
    const orgForm = document.getElementById('org-form');
    if (orgForm) orgForm.addEventListener('submit', async event => {
      event.preventDefault(); const values = Object.fromEntries(new FormData(orgForm));
      try { await request('/organizations', { method: 'POST', body: JSON.stringify({ ...values, ownerUserId: values.ownerUserId || undefined }) }); await loadOrganizations(); }
      catch (error) { notice(error.message); }
    });
    document.querySelectorAll('[data-org-id]').forEach(button => button.addEventListener('click', async () => {
      try { await request(`/organizations/${button.dataset.orgId}/status`, { method: 'PATCH', body: JSON.stringify({ status: button.dataset.orgNext }) }); await loadOrganizations(); }
      catch (error) { notice(error.message); }
    }));
  }

  async function loadDevices() {
    const d = await request('/devices?limit=100');
    const rows = d.devices.map(device => `<tr><td>${escape(device.name || 'Tracker')}<small>#${device.id} · ${escape(device.type)}</small></td><td>${escape(device.ownerName)}<small>${escape(device.ownerEmail)}</small></td><td>${escape(device.serial || '—')}</td><td>${escape(device.traccarDeviceId || '—')}</td><td>${pill(device.status)}</td><td>${escape(device.lastSeenAt || '—')}<small>${device.lastFixAt ? `${escape(device.lat)}, ${escape(device.lng)}` : 'No recent session fix'}</small></td></tr>`);
    setPage('Devices & tracking', 'Uses SmartSurf device registrations and the existing Traccar service. This page never exposes Traccar credentials or writes directly to Traccar.', table(['Device', 'Owner', 'Serial / IMEI', 'Traccar ID', 'Status', 'Last seen / fix'], rows));
  }

  async function loadSafety() {
    const d = await request('/safety/incidents?limit=100');
    const rows = d.incidents.map(item => `<tr><td>#${item.id}<small>${escape(item.type)} · ${escape(item.spotName || 'Unknown spot')}</small></td><td>${escape(item.riderName)}<small>${escape(item.riderEmail)} · rider #${item.riderId}</small></td><td>${pill(item.riskLevel)}</td><td>${pill(item.status)}</td><td>${escape(item.lastUpdateAt)}</td><td>${item.lat == null ? '—' : `<span class="map-pin">${escape(item.lat)}, ${escape(item.lng)}</span>`}<small>${escape(item.distanceFromLaunchM ?? '—')} m from launch</small></td><td><form class="review-form" data-incident-id="${item.id}"><input name="note" placeholder="Append internal review note" maxlength="1000" required><button class="small">Add note</button></form><small>${escape(item.latestAdminReview || '')}</small></td></tr>`);
    setPage('Safety Center', 'Incident status remains controlled by the rider safety workflow. Admin review notes do not resolve, hide, or cancel SOS alerts.', table(['Incident', 'Rider', 'Risk', 'Status', 'Updated', 'Last location', 'Internal review'], rows));
    document.querySelectorAll('.review-form').forEach(form => form.addEventListener('submit', async event => {
      event.preventDefault(); const note = new FormData(form).get('note');
      try { await request(`/safety/incidents/${form.dataset.incidentId}/reviews`, { method: 'POST', body: JSON.stringify({ note }) }); await loadSafety(); }
      catch (error) { notice(error.message); }
    }));
  }

  async function loadNotifications() {
    const d = await request('/notifications?limit=100');
    const rows = d.notifications.map(item => `<tr><td>#${item.id}<small>${escape(item.eventType)} · ${escape(item.createdAt)}</small></td><td>${escape(item.recipientName)}<small>${escape(item.recipientEmail)}</small></td><td>${pill(item.severity || 'INFO')}</td><td>${escape(item.title)}<small>${escape(item.body)}</small></td><td>${escape(item.source)}<small>expires ${escape(item.expiresAt || '—')}</small></td></tr>`);
    const form = state.session.permissions.includes('notifications.send') ? `<div class="panel"><h3>Send in-app notice</h3><form id="notice-form" class="grid-two"><div class="field"><label>Recipient user ID</label><input type="number" min="1" name="userId" required></div><div class="field"><label>Severity</label><select name="severity"><option>INFO</option><option>WARNING</option><option>SAFETY</option><option>SOS</option></select></div><div class="field"><label>Title</label><input name="title" maxlength="120" required></div><div class="field"><label>Message</label><textarea name="body" maxlength="1000" required></textarea></div><button class="primary">Create inbox notification</button></form><p class="muted">Only the in-app inbox is implemented here. Email/SMS/push/WhatsApp/Telegram delivery is not implied.</p></div>` : '';
    setPage('Notifications', `Available channels: ${d.supportedChannels.join(', ')}. Not implemented: ${d.unavailableChannels.join(', ')}.`, `${form}${table(['Message', 'Recipient', 'Severity', 'Content', 'Delivery'], rows)}`);
    const noticeForm = document.getElementById('notice-form');
    if (noticeForm) noticeForm.addEventListener('submit', async event => {
      event.preventDefault(); const values = Object.fromEntries(new FormData(noticeForm));
      try { await request('/notifications', { method: 'POST', body: JSON.stringify(values) }); await loadNotifications(); }
      catch (error) { notice(error.message); }
    });
  }

  async function loadBilling() { return loadFinancialView('/billing', 'Payments & orders'); }
  async function loadSubscriptions() { return loadFinancialView('/subscriptions', 'Subscriptions'); }

  async function loadProCheckout() {
    const d = await request('/system/billing-control');
    const stateText = d.enabled ? 'ENABLED' : 'PAUSED';
    const sourceText = d.source === 'superadmin_override' ? 'SuperAdmin override' : 'deployment default';
    setPage('Pro checkout control', 'A production-wide gate for new Rider Pro subscription checkouts.', `
      <div class="notice">Enabling this permits new Pro checkout attempts to reach the configured payment provider. Real provider orders may be created. This does not switch the provider between sandbox and live mode, and it does not alter existing subscriptions or revoke access.</div>
      <div class="panel pro-control-panel">
        <div class="pro-control-status"><div><span class="eyebrow">Current state</span><strong id="pro-state" class="${d.enabled ? 'pro-enabled' : 'pro-paused'}">${stateText}</strong></div><span class="pill">${escape(sourceText)}</span></div>
        <p class="muted">Configured provider: <strong>${escape(d.configuredProvider || 'none')}</strong> · Deployment default: <strong>${d.deploymentDefaultEnabled ? 'enabled' : 'paused'}</strong>${d.updatedAt ? ` · Last changed ${escape(d.updatedAt)}` : ''}</p>
        <form id="pro-control-form">
          <label class="switch-row" for="pro-enabled"><span><strong>Allow new Pro checkout</strong><small>When off, all Pro checkout entry points remain blocked.</small></span><input id="pro-enabled" type="checkbox" role="switch" ${d.enabled ? 'checked' : ''}><span class="switch-track" aria-hidden="true"></span></label>
          <div id="pro-enable-confirm" class="field" ${d.enabled ? '' : 'hidden'}><label class="confirm-row"><input id="pro-confirm" type="checkbox"> I understand this can create real provider orders.</label></div>
          <div class="field"><label for="pro-reason">Reason for this change (recorded in the audit log)</label><textarea id="pro-reason" minlength="8" maxlength="300" required placeholder="Describe the approved operational reason"></textarea></div>
          <button id="pro-save" class="primary" type="submit">Save checkout setting</button>
        </form>
      </div>`);
    const enabled = document.getElementById('pro-enabled');
    const confirm = document.getElementById('pro-enable-confirm');
    enabled.addEventListener('change', () => {
      confirm.hidden = !enabled.checked;
      document.getElementById('pro-confirm').checked = false;
    });
    document.getElementById('pro-control-form').addEventListener('submit', async event => {
      event.preventDefault();
      const button = document.getElementById('pro-save');
      const reason = document.getElementById('pro-reason').value.trim();
      if (reason.length < 8) return notice('Give an audit reason with at least 8 characters.');
      if (enabled.checked && !document.getElementById('pro-confirm').checked) return notice('Confirm that enabling may create real provider orders.');
      button.disabled = true;
      try {
        await request('/system/billing-control', { method: 'PATCH', body: JSON.stringify({ enabled: enabled.checked, confirmEnable: document.getElementById('pro-confirm').checked, reason }) });
        notice('Pro checkout setting saved and audited.', 'success');
        await loadProCheckout();
      } catch (error) { notice(error.message); }
      finally { button.disabled = false; }
    });
  }

  async function loadFinancialView(endpoint, title) {
    const d = await request(endpoint);
    const accounts = d.accounts.map(item => `<tr><td>${escape(item.name)}<small>${escape(item.email)} · user #${item.userId}</small></td><td>${escape(item.plan)}</td><td>${pill(item.status)}</td><td>${escape(item.provider || '—')}</td><td>${item.amountCents == null ? '—' : `${(item.amountCents / 100).toFixed(2)} ${escape(item.currency || '')}`}<small>${escape(item.cycle || '')} · ${escape(item.currentPeriodEnd || '')}</small></td></tr>`);
    const orders = d.orders.map(item => `<tr><td>${escape(item.reference)}<small>order #${item.id} · ${escape(item.product)}</small></td><td>${escape(item.customerEmail || '—')}</td><td>${pill(item.status)}</td><td>${(item.amountCents / 100).toFixed(2)} ${escape(item.currency)}</td><td>${escape(item.provider || '—')}<small>${escape(item.createdAt)}</small></td></tr>`);
    setPage(title, 'Read-only view of existing billing provider and order records. Capture, refund, manual settlement, and subscription changes remain disabled pending audited billing workflows.', `<div class="notice">This screen is read-only. No provider secrets, payment tokens, or card data are exposed.</div><div class="panel"><h3>Billing accounts</h3>${table(['Account', 'Plan', 'Status', 'Provider', 'Amount / period'], accounts)}</div>${endpoint === '/billing' ? `<div class="panel"><h3>Recent tracker orders</h3>${table(['Reference', 'Customer', 'Status', 'Amount', 'Provider'], orders)}</div>` : ''}`);
  }

  async function loadSystem() {
    const d = await request('/system/health');
    const integrations = Object.entries(d.integrations).map(([name, available]) => `<tr><td>${escape(name)}</td><td>${pill(available ? 'configured' : 'not_configured')}</td></tr>`);
    setPage('System health', `Checked ${new Date(d.checkedAt).toLocaleString()}`, `<div class="cards"><article class="card metric">Application<strong>${escape(d.status)}</strong></article><article class="card metric">Database<strong>${escape(d.database.driver)} · ${escape(d.database.status)}</strong></article><article class="card metric">Node<strong>${escape(d.process.node)}</strong><small>${escape(d.process.uptimeSeconds)}s uptime</small></article></div>${table(['Integration', 'Configuration'], integrations)}<p class="muted">Health values are sanitized configuration/readiness only; no secrets or credentials are returned.</p>`);
  }

  async function loadDesignSystem() {
    const data = await request('/system/design-system');
    const settings = data.settings;
    const paletteCards = data.palettes.map(palette => {
      const selected = settings.palette === palette.id;
      return `<button type="button" class="theme-choice${selected ? ' selected' : ''}" data-palette="${escape(palette.id)}" aria-pressed="${selected}" aria-label="Use ${escape(palette.name)} template">
        <span class="theme-swatches" aria-hidden="true"><i style="--swatch:${escape(palette.dark['--bg'])}"></i><i style="--swatch:${escape(palette.dark['--acc'])}"></i><i style="--swatch:${escape(palette.light['--bg'])}"></i><i style="--swatch:${escape(palette.light['--acc'])}"></i></span>
        <strong>${escape(palette.name)}</strong><small>${escape(palette.description)}</small></button>`;
    }).join('');
    const savedAccent = settings.accentColor || '';
    setPage('Design system', 'Choose the shared colours and appearance for smartsurf.cloud, app.smartsurf.cloud, the Rider app and SuperAdmin.', `
      <section class="panel theme-editor" aria-labelledby="theme-templates-heading">
        <div class="theme-section-head"><div><p class="label">1 · Colour template</p><h3 id="theme-templates-heading">Choose a palette</h3><p class="muted">Each template includes coordinated dark and light colours.</p></div></div>
        <div class="theme-choices" role="group" aria-label="Colour templates">${paletteCards}</div>
        <div class="theme-controls">
          <fieldset class="theme-mode"><legend class="label">2 · Appearance</legend><div class="theme-mode-options" role="radiogroup" aria-label="Appearance">
            ${[['system','Use device setting'],['dark','Dark'],['light','Light']].map(([mode,label])=>`<button type="button" role="radio" aria-checked="${settings.mode===mode}" data-mode="${mode}" class="${settings.mode===mode?'selected':''}">${label}</button>`).join('')}
          </div><small class="muted">Device setting follows the rider’s light or dark preference.</small></fieldset>
          <div class="theme-accent"><label class="label" for="theme-accent">3 · Optional accent</label><div class="theme-accent-row"><input id="theme-custom-accent" type="checkbox" ${savedAccent?'checked':''}><input id="theme-accent" type="color" value="${escape(savedAccent || data.palettes.find(item=>item.id===settings.palette).dark['--acc'])}" ${savedAccent?'':'disabled'}><label for="theme-custom-accent">Use a custom accent</label></div><small class="muted">The accent is checked for contrast in both appearance modes.</small></div>
        </div>
        <div class="theme-review">
          <div><p class="label">Preview</p><div id="theme-preview" class="theme-preview"><div class="theme-preview-top"><span class="theme-preview-mark"></span><strong>SmartSurf</strong><span class="theme-preview-chip">RIGHT NOW</span></div><div class="theme-preview-content"><strong>Conditions around you</strong><p>Wind and water details stay clear in either appearance.</p><button type="button">View conditions</button></div></div></div>
          <form id="theme-form" class="theme-save"><div class="field"><label for="theme-reason">Reason for this global change</label><input id="theme-reason" name="reason" minlength="8" maxlength="300" required placeholder="For example: apply the updated summer brand palette"></div><button class="primary" type="submit">Apply design system</button><small class="muted">Changes are recorded in the SuperAdmin audit log and appear across both sites.</small></form>
        </div>
      </section>`);

    const paletteById = Object.fromEntries(data.palettes.map(item => [item.id, item]));
    const current = { ...settings };
    const preview = document.getElementById('theme-preview');
    const customToggle = document.getElementById('theme-custom-accent');
    const accentInput = document.getElementById('theme-accent');
    function contrast(hex, other) {
      const luminance = value => {
        const channels = value.slice(1).match(/.{2}/g).map(part => parseInt(part, 16) / 255).map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
        return .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2];
      };
      const values = [luminance(hex), luminance(other)].sort((a, b) => b - a);
      return (values[0] + .05) / (values[1] + .05);
    }
    function updatePreview() {
      const palette = paletteById[current.palette];
      const selectedMode = current.mode === 'system'
        ? (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
        : current.mode;
      const colors = palette[selectedMode];
      const accent = customToggle.checked ? accentInput.value : colors['--acc'];
      preview.style.setProperty('--preview-bg', colors['--bg']);
      preview.style.setProperty('--preview-panel', colors['--panel']);
      preview.style.setProperty('--preview-ink', colors['--ink']);
      preview.style.setProperty('--preview-muted', colors['--muted']);
      preview.style.setProperty('--preview-line', colors['--line']);
      preview.style.setProperty('--preview-accent', accent);
      preview.style.setProperty('--preview-button-ink', contrast(accent, '#ffffff') >= contrast(accent, '#07131f') ? '#ffffff' : '#07131f');
    }
    app.querySelectorAll('[data-palette]').forEach(button => button.addEventListener('click', () => {
      current.palette = button.dataset.palette;
      app.querySelectorAll('[data-palette]').forEach(choice => { const selected = choice === button; choice.classList.toggle('selected', selected); choice.setAttribute('aria-pressed', String(selected)); });
      if (!customToggle.checked) accentInput.value = paletteById[current.palette][current.mode === 'light' ? 'light' : 'dark']['--acc'];
      updatePreview();
    }));
    app.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => {
      current.mode = button.dataset.mode;
      app.querySelectorAll('[data-mode]').forEach(choice => { const selected = choice === button; choice.classList.toggle('selected', selected); choice.setAttribute('aria-checked', String(selected)); });
      if (!customToggle.checked) accentInput.value = paletteById[current.palette][current.mode === 'light' ? 'light' : 'dark']['--acc'];
      updatePreview();
    }));
    customToggle.addEventListener('change', () => { accentInput.disabled = !customToggle.checked; updatePreview(); });
    accentInput.addEventListener('input', updatePreview);
    updatePreview();

    document.getElementById('theme-form').addEventListener('submit', async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      try {
        const result = await request('/system/design-system', { method: 'PATCH', body: JSON.stringify({
          palette: current.palette,
          mode: current.mode,
          accentColor: customToggle.checked ? accentInput.value : null,
          reason: document.getElementById('theme-reason').value
        }) });
        const link = document.querySelector('link[data-shared-design-system]');
        if (link) link.href = `https://app.smartsurf.cloud/api/public/design-system.css?refresh=${Date.now()}`;
        notice(`Applied ${paletteById[result.settings.palette].name} in ${result.settings.mode} mode across the SmartSurf websites.`, 'success');
      } catch (error) { notice(error.message); }
      finally { button.disabled = false; }
    });
  }

  async function loadAudit() {
    const d = await request('/audit?limit=100');
    const rows = d.events.map(item => `<tr><td>#${item.id}<small>${escape(item.createdAt)} · req ${escape(item.requestId)}</small></td><td>${escape(item.actorName || `user ${item.actorUserId || 'system'}`)}<small>${escape(item.actorUserId || '')}</small></td><td>${escape(item.action)}</td><td>${escape(item.entityType)}<small>${escape(item.entityId)}</small></td><td><code>${escape(JSON.stringify(item.details))}</code></td></tr>`);
    setPage('Audit log', 'Append-only administrative events. Sensitive read access is logged; audit exports are not enabled in this Phase 1 panel.', table(['Time / request', 'Actor', 'Action', 'Entity', 'Safe details'], rows));
  }

  async function start() {
    try {
      state.session = await request('/session');
      if (!state.session.mfaEnrolled) return showEnroll();
      if (state.session.stepUpRequired) return showStepUp();
      await openPanel();
    } catch (error) {
      if (error.status === 401) return showSignIn();
      if (error.status === 403) return showDenied();
      renderGate('Admin unavailable', error.message || 'Could not initialize secure access.', '<a class="button" href="./rider.html">Back to SmartSurf</a>');
    }
  }

  start();
})();
