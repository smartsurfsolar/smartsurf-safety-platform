(() => {
  const $ = id => document.getElementById(id);
  const state = { me: null, catalog: null, promo: null, pendingAction: false };
  const money = (cents, currency = 'USD') => {
    const amount = Math.max(0, Number(cents) || 0) / 100;
    try { return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount); }
    catch { return `${currency} ${amount.toFixed(2)}`; }
  };
  const date = value => {
    const parsed = value ? new Date(value) : null;
    return parsed && Number.isFinite(parsed.getTime()) ? parsed.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : '—';
  };
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const notify = (message, isError = false) => {
    const node = $('notice');
    node.textContent = message;
    node.classList.toggle('error', isError);
    node.hidden = !message;
  };
  async function api(path, options = {}) {
    const response = await fetch(path, { credentials: 'same-origin', ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) } });
    if (response.status === 401) { location.href = `access.html?next=${encodeURIComponent('billing.html')}`; throw new Error('Please sign in again.'); }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error?.message || payload?.error || payload?.message || 'Something went wrong. Please try again.');
    return payload;
  }
  function operationKey(name) {
    const key = `ss-billing-${name}`;
    let value = sessionStorage.getItem(key);
    if (!value) {
      value = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `ss-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      sessionStorage.setItem(key, value);
    }
    return { key, value };
  }
  function statusClass(status) {
    if (['active', 'trialing', 'complimentary', 'lifetime'].includes(status)) return 'good';
    if (['grace_period', 'past_due', 'cancel_at_period_end'].includes(status)) return 'warn';
    if (['expired', 'cancelled', 'inactive'].includes(status)) return 'bad';
    return '';
  }
  function statusLabel(status) {
    return ({ active: 'ACTIVE', trialing: 'TRIAL', grace_period: 'PAYMENT ISSUE', past_due: 'PAYMENT ISSUE', cancel_at_period_end: 'ENDS AT PERIOD', cancelled: 'CANCELLED', expired: 'EXPIRED', complimentary: 'COMPLIMENTARY', lifetime: 'LIFETIME', inactive: 'BASIC' })[status] || String(status || 'BASIC').replaceAll('_', ' ').toUpperCase();
  }
  function render() {
    const { me, catalog } = state;
    if (!me || !catalog) return;
    const billing = me.billing || {};
    const sub = me.subscription;
    const pro = billing.plan === 'pro';
    const pill = $('status-pill');
    pill.textContent = statusLabel(billing.status);
    pill.className = `status-pill ${statusClass(billing.status)}`;
    $('plan-name').textContent = pro ? (catalog.plans.find(plan => plan.id === 'pro')?.name || 'SmartSurf Pro') : 'SmartSurf Basic';
    const source = billing.source;
    const sourceText = source?.type === 'organization' ? 'Provided by your organization.'
      : source?.type === 'admin' || source?.type === 'complimentary' ? 'Complimentary access is active.'
        : source?.type === 'trial' ? 'You are using the SmartSurf Pro trial.' : '';
    $('plan-detail').textContent = pro ? `${sourceText || 'Your SmartSurf Pro intelligence features are active.'} Safety and device access are separate.` : 'Basic account access with free spot guidance and baseline Tracker safety.';
    if (sub?.currentPeriodEnd) {
      $('renewal').innerHTML = sub.recurring && sub.autoRenew
        ? `Next charge: <strong>${escape(date(sub.currentPeriodEnd))}</strong>`
        : `Access through: <strong>${escape(date(sub.currentPeriodEnd))}</strong> <span class="fine">· no automatic renewal</span>`;
    } else if (billing.currentPeriodEnd) {
      $('renewal').innerHTML = `Access through: <strong>${escape(date(billing.currentPeriodEnd))}</strong> <span class="fine">· no automatic renewal</span>`;
    } else {
      $('renewal').innerHTML = pro ? '<strong>Access active</strong>' : 'No paid renewal is scheduled.';
    }
    const trialBox = $('trial-box');
    if (me.trial?.status === 'active') {
      const remaining = Math.max(0, Math.ceil((new Date(me.trial.endsAt).getTime() - Date.now()) / 86400000));
      trialBox.textContent = `SmartSurf Pro trial · ${remaining} day${remaining === 1 ? '' : 's'} remaining. It ends ${date(me.trial.endsAt)}; it does not start a paid renewal.`;
      trialBox.hidden = false;
    } else if (me.trial?.status === 'ended') {
      trialBox.textContent = 'Your Pro trial has ended. Your account and any Tracker access remain available.';
      trialBox.hidden = false;
    } else trialBox.hidden = true;
    const problem = $('payment-problem');
    if (['past_due', 'grace_period'].includes(billing.status)) {
      problem.textContent = 'There is a payment issue. Your access remains available through the grace/paid-through date shown above. Update the payment with the provider before that date.';
      problem.hidden = false;
    } else problem.hidden = true;

    const actions = $('plan-actions');
    actions.replaceChildren();
    if (pro && sub?.recurring && sub.cancelAtPeriodEnd) {
      const resume = document.createElement('button'); resume.className = 'button primary'; resume.textContent = 'Resume subscription'; resume.addEventListener('click', resumeRenewal); actions.append(resume);
    } else if (pro && sub?.recurring && sub.autoRenew) {
      const cancel = document.createElement('button'); cancel.className = 'button secondary'; cancel.textContent = 'Cancel renewal'; cancel.addEventListener('click', () => $('cancel-dialog').showModal()); actions.append(cancel);
    }
    if (billing.plan !== 'pro' && Number(billing.trialDays) > 0 && !me.trial) {
      const trial = document.createElement('button'); trial.className = 'button secondary'; trial.textContent = `Start ${billing.trialDays}-day Pro trial`; trial.addEventListener('click', startTrial); actions.append(trial);
    }
    if (!pro && !billing.checkoutReady) {
      const unavailable = document.createElement('span'); unavailable.className = 'fine'; unavailable.textContent = 'Checkout is temporarily unavailable. Your free access is unchanged.'; actions.append(unavailable);
    }

    const hardware = me.hardwareAccess || [];
    const uniqueSources = [...new Set(hardware.map(item => item.source?.id).filter(Boolean))];
    const units = hardware.reduce((max, item) => Math.max(max, Number(item.metadata?.units) || 0), 0);
    $('hardware-summary').textContent = uniqueSources.length
      ? `${uniqueSources.length} paid hardware order${uniqueSources.length === 1 ? '' : 's'} found${units ? ` · ${units} tracker unit${units === 1 ? '' : 's'} included` : ''}. Tracker access is independent from Pro.`
      : 'No paid hardware access is linked to this account yet. A subscription is never required for baseline safety access.';

    $('checkout-state').textContent = billing.checkoutReady ? `Checkout available via ${String(billing.provider || 'payment provider').toUpperCase()}` : 'Checkout is currently paused';
    renderPlans();
    renderPaymentSummary();
    renderPayments();
  }
  function renderPlans() {
    const { catalog, me } = state;
    const plans = catalog.plans.filter(plan => plan.available !== false);
    const pro = me.billing?.plan === 'pro';
    $('plans').innerHTML = plans.map(plan => {
      if (plan.id === 'basic') {
        return `<article class="plan-option"><p class="eyebrow">NO SUBSCRIPTION</p><h3>${escape(plan.name)}</h3><div class="price">Free</div><p>Core SmartSurf access and baseline safety.</p><ul><li>Personal profile and free spot guidance</li><li>Basic tracker management</li><li>SOS and critical safety remain available</li></ul><button class="button secondary" disabled>${pro ? 'Available on expiry' : 'Current plan'}</button></article>`;
      }
      const period = plan.billingPeriod === 'yearly' ? 'year' : 'month';
      const isCurrent = pro && (me.subscription?.billingPeriod === plan.billingPeriod || me.billing?.cycle === plan.billingPeriod);
      const features = (plan.features || []).map(feature => `<li>${escape(feature)}</li>`).join('');
      return `<article class="plan-option featured"><p class="eyebrow">SMARTSURF INTELLIGENCE</p><h3>${escape(plan.name)}</h3><div class="price">${escape(money(plan.priceCents, plan.currency))}<small> / ${period}</small></div><p>${plan.billingPeriod === 'yearly' ? '12-month access period, paid once.' : '30-day access period, paid once.'} No automatic renewal.</p><ul>${features}</ul><button class="button primary" data-cycle="${escape(plan.billingPeriod)}" ${!me.billing?.checkoutReady || isCurrent ? 'disabled' : ''}>${isCurrent ? 'Current access period' : 'Review upgrade'}</button></article>`;
    }).join('');
    $('plans').querySelectorAll('[data-cycle]').forEach(button => button.addEventListener('click', () => previewUpgrade(button.dataset.cycle)));
  }
  function renderPaymentSummary() {
    const billing = state.me.billing || {};
    const sub = state.me.subscription;
    const paymentMethod = state.me.paymentMethod;
    const renewal = sub?.recurring && sub?.autoRenew ? `Next charge ${date(sub.currentPeriodEnd)}` : 'No automatic charge';
    $('payment-summary').innerHTML = `
      <div><span>Payment provider</span><strong>${escape(sub?.provider || billing.provider || 'Not connected')}</strong></div>
      <div><span>Payment method</span><strong>${paymentMethod ? escape(`${paymentMethod.brand || 'Card'} ···· ${paymentMethod.last4 || ''}`) : 'Not stored on SmartSurf'}</strong></div>
      <div><span>Renewal</span><strong>${escape(renewal)}</strong></div>`;
  }
  function renderPayments() {
    const payments = state.me.payments || [];
    $('empty-payments').hidden = payments.length > 0;
    $('payments').innerHTML = payments.map(payment => {
      const status = String(payment.status || 'unknown').toLowerCase();
      const receiptUrl = payment.receiptUrl && /^https:\/\//i.test(payment.receiptUrl) ? payment.receiptUrl : '';
      return `<tr><td>${escape(date(payment.paidAt || payment.createdAt))}</td><td>${escape(payment.description || payment.orderReference || 'SmartSurf purchase')}</td><td class="amount">${escape(money(payment.amountCents, payment.currency))}</td><td><span class="table-status ${['paid','completed','deposit_paid'].includes(status) ? 'paid' : status === 'pending' ? 'pending' : 'failed'}">${escape(status.replaceAll('_',' '))}</span></td><td>${receiptUrl ? `<a href="${escape(receiptUrl)}" target="_blank" rel="noopener">Receipt ↗</a>` : '—'}</td></tr>`;
    }).join('');
  }
  async function previewUpgrade(cycle) {
    notify('');
    const panel = $('upgrade-preview'); panel.hidden = false; panel.textContent = 'Preparing your price…';
    try {
      const preview = await api('/api/v1/billing/upgrade/preview', { method: 'POST', body: JSON.stringify({ planId: 'pro', cycle }) });
      let due = preview.amountDueTodayCents;
      if (state.promo) {
        const offer = await api('/api/v1/billing/promo/validate', { method: 'POST', body: JSON.stringify({ code: state.promo.code, cycle }) });
        if (offer.valid) due = offer.totalCents;
      }
      panel.innerHTML = `<h3>Review your upgrade</h3><div class="preview-grid"><div>Plan<strong>SmartSurf Pro · ${cycle === 'yearly' ? '12 months' : '30 days'}</strong></div><div>Amount due today<strong>${escape(money(due, preview.target.currency))}</strong></div><div>Starts<strong>Immediately after successful payment</strong></div><div>Renewal<strong>No automatic renewal</strong></div></div><p class="fine">Tracker access, SOS and baseline safety are separate and remain available.</p><button id="continue-checkout" class="button primary" style="margin-top:13px">Continue to secure checkout</button>`;
      $('continue-checkout').addEventListener('click', () => {
        const params = new URLSearchParams({ type: 'subscription', cycle: cycle === 'yearly' ? 'yr' : 'mo' });
        if (state.promo?.code) params.set('promo', state.promo.code);
        location.href = `checkout.html?${params.toString()}`;
      });
    } catch (error) { panel.hidden = true; notify(error.message, true); }
  }
  async function validatePromo() {
    const code = $('promo-code').value.trim().toUpperCase();
    if (!code) { state.promo = null; $('promo-result').textContent = 'Enter a code to check eligibility.'; return; }
    $('promo-check').disabled = true; $('promo-result').textContent = 'Checking code…';
    try {
      const result = await api('/api/v1/billing/promo/validate', { method: 'POST', body: JSON.stringify({ code, cycle: 'monthly' }) });
      if (!result.valid) { state.promo = null; $('promo-result').textContent = result.reason || 'This code is not available.'; return; }
      state.promo = { code: result.code };
      $('promo-result').textContent = `Code applied to eligible Pro checkouts. Monthly total: ${money(result.totalCents, result.currency)}.`;
    } catch (error) { state.promo = null; $('promo-result').textContent = error.message; }
    finally { $('promo-check').disabled = false; }
  }
  async function startTrial() {
    try {
      $('plan-actions').querySelectorAll('button').forEach(button => { button.disabled = true; });
      const result = await api('/api/v1/billing/trial', { method: 'POST', body: '{}' });
      state.me = result.billing;
      render(); notify('Your SmartSurf Pro trial has started. It will end without starting a charge.');
    } catch (error) { notify(error.message, true); render(); }
  }
  async function cancelRenewal() {
    const { key, value } = operationKey('cancel');
    const button = $('cancel-confirm'); button.disabled = true;
    try {
      const result = await api('/api/v1/billing/cancel', { method: 'POST', headers: { 'Idempotency-Key': value }, body: '{}' });
      sessionStorage.removeItem(key);
      $('cancel-dialog').close();
      notify(result.supported ? `Renewal is cancelled. Pro access continues until ${date(result.currentPeriodEnd)}.` : result.message || 'No automatic renewal is active.');
      await load();
    } catch (error) { notify(error.message, true); }
    finally { button.disabled = false; }
  }
  async function resumeRenewal() {
    const { key, value } = operationKey('resume');
    try {
      const result = await api('/api/v1/billing/resume', { method: 'POST', headers: { 'Idempotency-Key': value }, body: '{}' });
      sessionStorage.removeItem(key);
      notify(result.supported ? 'Your subscription is set to renew again.' : result.message || 'Renewal could not be changed.');
      await load();
    } catch (error) { notify(error.message, true); }
  }
  $('cancel-confirm').addEventListener('click', event => { event.preventDefault(); cancelRenewal(); });
  $('promo-check').addEventListener('click', validatePromo);
  $('promo-code').addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); validatePromo(); } });
  $('retry').addEventListener('click', load);
  async function load() {
    $('loading').hidden = false; $('failure').hidden = true; $('content').hidden = true; notify('');
    try {
      const [me, catalog] = await Promise.all([api('/api/v1/billing/me'), api('/api/v1/billing/plans')]);
      state.me = me; state.catalog = catalog;
      $('loading').hidden = true; $('failure').hidden = true; $('content').hidden = false;
      render();
      const errorMessage = new URLSearchParams(location.search).get('checkout') === 'success' ? 'Payment return received. Refreshing verified account access.' : '';
      if (errorMessage) notify(errorMessage);
    } catch (error) {
      $('loading').hidden = true; $('content').hidden = true; $('failure').hidden = false; $('failure-text').textContent = error.message || 'Please try again.';
    }
  }
  load();
})();
