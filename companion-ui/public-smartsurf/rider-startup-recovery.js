// Recover Rider when its embedded logic cannot be compiled by the page runtime.
(() => {
  const source = document.currentScript?.dataset.riderLogicSrc;
  if (!source) return;
  const url = new URL(source, document.baseURI);
  if (url.origin !== location.origin) return;
  // Prefer the normally parsed factory before the runtime boots. Keep the
  // embedded source as a download-failure fallback and as the editable source.
  const embedded = document.querySelector('script[data-dc-script]');
  const adapter = 'const Component = window.SmartSurfRiderRecovery(DCLogic, StreamableLogic, React);';
  if (embedded && typeof window.SmartSurfRiderRecovery === 'function') {
    embedded.textContent = adapter;
  }
  const status = document.getElementById('rider-startup-status');
  const message = document.getElementById('rider-startup-message');
  const reload = document.getElementById('rider-startup-reload');
  reload?.addEventListener('click', () => location.reload());
  const showFailure = () => {
    if (!status?.isConnected) return;
    if (message) message.textContent = 'SmartSurf could not finish loading. Please reload.';
    if (reload) reload.hidden = false;
  };
  let timer;
  const stop = () => clearInterval(timer);
  const inspect = () => {
    const entry = window.__dcRegistry?.rider;
    const root = document.querySelector('.sc-host[data-sc-name="rider"]');
    if (!entry || !root) return;
    const error = root.querySelector('.sc-logic-error')?.textContent || '';
    const failed = entry.logicError || /^rider: (?:expected expression|unexpected token|missing |unterminated)/i.test(error);
    if (!failed) {
      if (entry.Logic) { stop(); status?.remove(); }
      return;
    }
    stop();
    const script = document.createElement('script');
    script.src = url.href;
    script.onload = () => {
      if (typeof window.SmartSurfRiderRecovery !== 'function' || typeof window.__dcUpdate !== 'function') return;
      // The full component is parsed as a normal script. Only this adapter is
      // evaluated by the template runtime; no account data is used as code.
      window.__dcUpdate('rider', 'js',
        adapter, false);
      if (!window.__dcRegistry?.rider?.logicError) status?.remove();
    };
    script.onerror = () => { showFailure(); console.error('[SmartSurf] Rider startup recovery could not load.'); };
    document.head.appendChild(script);
  };
  timer = setInterval(inspect, 100);
  setTimeout(showFailure, 15000);
  setTimeout(stop, 60000);
  inspect();
})();
