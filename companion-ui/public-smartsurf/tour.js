// SmartSurf guided tour — tiny, dependency-free step-pointer overlay.
// Highlights a real DOM element per step with a ring + a floating card
// (Next/Back/Skip). Gated by localStorage so it only auto-runs once per
// product; a "Replay guide" button can call SmartSurfTour.start() again.
(function () {
  function build() {
    var backdrop = document.createElement('div');
    backdrop.style.cssText = 'position:fixed;inset:0;z-index:9998;background:rgba(4,10,16,.5);opacity:0;transition:opacity .18s';
    var ring = document.createElement('div');
    ring.style.cssText = 'position:fixed;z-index:9999;border-radius:10px;border:2px solid #38bdf8;box-shadow:0 0 0 4000px rgba(4,10,16,.55),0 0 24px rgba(56,189,248,.5);pointer-events:none;transition:all .22s ease;opacity:0';
    var card = document.createElement('div');
    card.style.cssText = 'position:fixed;z-index:10000;max-width:300px;background:#0d1e2f;border:1px solid #1e3d59;border-radius:12px;padding:16px 17px;box-shadow:0 20px 50px rgba(0,0,0,.5);font-family:Barlow,system-ui,sans-serif;color:#e6f0f8;opacity:0;transition:opacity .18s;';
    document.body.appendChild(backdrop);
    document.body.appendChild(ring);
    document.body.appendChild(card);
    return { backdrop: backdrop, ring: ring, card: card };
  }

  function place(el, ring, card, placement) {
    var r = el.getBoundingClientRect();
    ring.style.left = (r.left - 6) + 'px';
    ring.style.top = (r.top - 6) + 'px';
    ring.style.width = (r.width + 12) + 'px';
    ring.style.height = (r.height + 12) + 'px';
    ring.style.opacity = '1';
    var cardW = 300, cardH = card.offsetHeight || 140, gap = 14;
    var top, left = Math.min(Math.max(8, r.left), window.innerWidth - cardW - 8);
    if (placement === 'bottom' || (!placement && r.top < window.innerHeight * 0.55)) {
      top = Math.min(r.bottom + gap, window.innerHeight - cardH - 8);
    } else {
      top = Math.max(8, r.top - cardH - gap);
    }
    card.style.left = left + 'px';
    card.style.top = top + 'px';
    card.style.opacity = '1';
  }

  function start(steps, key, opts) {
    opts = opts || {};
    var i = 0, ui = build();
    ui.backdrop.style.opacity = '1';

    function finish(skipped) {
      ui.backdrop.remove(); ui.ring.remove(); ui.card.remove();
      try { localStorage.setItem('ss-tour-' + key, '1'); } catch (e) {}
      if (opts.onDone) opts.onDone(skipped);
    }

    function render() {
      var step = steps[i];
      var el = document.querySelector(step.sel);
      if (!el) { i < steps.length - 1 ? (i++, render()) : finish(false); return; }
      el.scrollIntoView({ block: 'center', behavior: 'instant' });
      card.innerHTML && null;
      ui.card.innerHTML =
        '<div style="font-size:9.5px;letter-spacing:.13em;text-transform:uppercase;color:#8ba3b8;font-weight:600;margin-bottom:6px">Step ' + (i + 1) + ' of ' + steps.length + '</div>' +
        '<div style="font-size:15px;font-weight:700;margin-bottom:6px">' + step.title + '</div>' +
        '<div style="font-size:13px;line-height:1.5;color:#9db4c8;margin-bottom:14px">' + step.body + '</div>' +
        '<div style="display:flex;gap:8px;justify-content:flex-end">' +
        (i > 0 ? '<button data-act="back" style="background:none;border:1px solid #1e3d59;color:#9db4c8;padding:6px 12px;border-radius:7px;font-size:12.5px;font-weight:600;cursor:pointer">Back</button>' : '') +
        '<button data-act="skip" style="background:none;border:1px solid #1e3d59;color:#9db4c8;padding:6px 12px;border-radius:7px;font-size:12.5px;font-weight:600;cursor:pointer">Skip</button>' +
        '<button data-act="next" style="background:#38bdf8;border:1px solid transparent;color:#04121c;padding:6px 14px;border-radius:7px;font-size:12.5px;font-weight:700;cursor:pointer">' + (i === steps.length - 1 ? 'Done' : 'Next') + '</button>' +
        '</div>';
      setTimeout(function () { place(el, ui.ring, ui.card, step.placement); }, 10);
      ui.card.querySelector('[data-act="next"]').onclick = function () { i < steps.length - 1 ? (i++, render()) : finish(false); };
      ui.card.querySelector('[data-act="skip"]').onclick = function () { finish(true); };
      var backBtn = ui.card.querySelector('[data-act="back"]');
      if (backBtn) backBtn.onclick = function () { i--; render(); };
    }
    var card = ui.card;
    render();
    window.addEventListener('resize', function () {
      var el = document.querySelector(steps[i].sel);
      if (el) place(el, ui.ring, ui.card, steps[i].placement);
    });
  }

  window.SmartSurfTour = {
    start: start,
    seen: function (key) { try { return !!localStorage.getItem('ss-tour-' + key); } catch (e) { return false; } },
    reset: function (key) { try { localStorage.removeItem('ss-tour-' + key); } catch (e) {} },
  };
})();
