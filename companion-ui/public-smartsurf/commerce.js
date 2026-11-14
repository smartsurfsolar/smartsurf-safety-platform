// SmartSurf commercial client helper: catalog access, money formatting and
// first-party funnel analytics. Loaded by commercial pages via <script src>.
(function () {
  let catalogPromise = null;

  function catalog() {
    if (!catalogPromise) {
      catalogPromise = fetch('/api/commerce/catalog', { credentials: 'same-origin' })
        .then(function (r) { return r.json(); })
        .catch(function () { return { products: {}, addons: {}, subscriptions: {}, currency: 'USD', founder: { limit: 0, sold: 0, remaining: 0 } }; });
    }
    return catalogPromise;
  }

  function money(cents, currency) {
    const value = (Math.max(0, Number(cents) || 0) / 100).toFixed(2);
    return value + ' ' + (currency || 'USD');
  }

  function track(event, props) {
    try {
      const body = JSON.stringify({ event: event, path: location.pathname, props: props || {} });
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/analytics/event', new Blob([body], { type: 'application/json' }));
      } else {
        fetch('/api/analytics/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true });
      }
    } catch (e) { /* analytics must never break the funnel */ }
  }

  function param(name, fallback) {
    const value = new URLSearchParams(location.search).get(name);
    return value === null || value === '' ? (fallback || '') : value;
  }

  async function post(path, body) {
    const res = await fetch(path, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    });
    let data = {};
    try { data = await res.json(); } catch (e) { data = {}; }
    if (!res.ok) throw new Error(data.error || ('Request failed (' + res.status + ')'));
    return data;
  }

  window.SSCommerce = { catalog: catalog, money: money, track: track, param: param, post: post };
})();
