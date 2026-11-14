(() => {
  const toggle = document.querySelector('[data-menu-toggle]');
  const menu = document.getElementById('site-navigation');
  const close = () => { if (!toggle || !menu) return; toggle.setAttribute('aria-expanded', 'false'); menu.dataset.open = 'false'; };
  toggle?.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    menu.dataset.open = String(open);
  });
  menu?.addEventListener('click', event => { if (event.target.closest('a')) close(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && toggle?.getAttribute('aria-expanded') === 'true') { close(); toggle.focus(); } });
})();
