/* Direct human audio. No assistant, transcription, or recording is attached. */
(() => {
  'use strict';
  let active = null, sdkLoading = null;
  const sdkUrl = new URL('./vendor/livekit/livekit-client.umd.js', document.currentScript.src).href;
  function loadSdk() {
    if (window.LivekitClient) return Promise.resolve();
    if (sdkLoading) return sdkLoading;
    sdkLoading = new Promise((resolve, reject) => {
      const script = document.createElement('script'); script.src = sdkUrl; script.async = true;
      const timer = setTimeout(() => { script.remove(); sdkLoading = null; reject(new Error('Audio client timed out. Try again.')); }, 12000);
      script.onload = () => { clearTimeout(timer); window.LivekitClient ? resolve() : reject(new Error('Audio client unavailable.')); };
      script.onerror = () => { clearTimeout(timer); script.remove(); sdkLoading = null; reject(new Error('Audio client could not load. Refresh and try again.')); };
      document.body.append(script);
    });
    return sdkLoading;
  }
  const labels = { declined: 'Call declined', busy: 'Phone is in another call', missed: 'No answer',
    disconnected: 'Call disconnected', failed: 'Call could not connect', ended: 'Call ended' };
  const phoneIcon = '<svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2c0 9 7 16 16 16a2 2 0 0 0 2-2v-3l-5-2-2 2a13 13 0 0 1-6-6l2-2-2-5Z"/></svg>';

  class CompanionCall {
    constructor({ request, deviceId, name }) {
      this.request = (path, options = {}) => request(path, { ...options, signal: AbortSignal.timeout(10000) }); this.deviceId = deviceId; this.name = name || 'Companion app';
      this.id = null; this.room = null; this.closed = false; this.joining = false; this.muted = false;
      this.audioMuted = false; this.pollTimer = null; this.acceptedAt = null; this.lastSuccess = Date.now();
      this.dialog = document.createElement('dialog'); this.dialog.className = 'ss-call-dialog';
      this.dialog.setAttribute('aria-labelledby', 'ss-call-title');
      this.dialog.innerHTML = `<header><span>SmartSurf · Voice call</span><button class="ss-call-close" type="button" hidden>Close</button></header>
        <div class="ss-call-body"><div class="ss-call-avatar is-ringing">${phoneIcon}</div>
        <h2 id="ss-call-title"></h2><p class="ss-call-status" role="status" aria-live="polite">Preparing your microphone…</p>
        <p class="ss-call-time"></p><p class="ss-call-error" role="alert" hidden></p>
        <div class="ss-call-controls"><button type="button" class="ss-call-mic" aria-pressed="false" disabled>Mute mic</button>
        <button type="button" class="ss-call-output" aria-pressed="false" disabled>Mute sound</button></div>
        <button type="button" class="ss-call-end">Cancel call</button>
        <button type="button" class="ss-call-audio-start" hidden>Tap to enable sound</button>
        <details hidden><summary>Audio devices</summary><label>Microphone<select class="ss-call-input"></select></label><label class="ss-call-output-label">Speaker or headset<select class="ss-call-sink"></select></label></details>
        <p class="ss-call-note">Talk and listen at the same time.<br>The phone user chooses whether to answer.</p><div class="ss-call-audio" hidden></div></div>`;
      document.body.append(this.dialog);
      this.q('#ss-call-title').textContent = this.name;
      this.restoreFocus = document.activeElement;
      this.dialog.addEventListener('cancel', event => { event.preventDefault(); if (this.closed) this.dismiss(); });
      this.q('.ss-call-end').onclick = () => this.end();
      this.q('.ss-call-close').onclick = () => this.dismiss();
      this.q('.ss-call-mic').onclick = () => this.toggleMic();
      this.q('.ss-call-output').onclick = () => this.toggleOutput();
      this.q('.ss-call-audio-start').onclick = () => { void this.room?.startAudio().catch(() => this.error('Tap again to allow audio playback.')); };
      this.q('.ss-call-input').onchange = event => this.switchDevice('audioinput', event.target.value);
      this.q('.ss-call-sink').onchange = event => this.switchDevice('audiooutput', event.target.value);
      this.dialog.showModal();
      this.clock = setInterval(() => {
        this.renderTime();
        if (!this.closed && this.id && Date.now() - this.lastSuccess > 40000) void this.end('Call disconnected');
      }, 1000);
      this.onPageHide = () => { void this.end(); };
      window.addEventListener('pagehide', this.onPageHide);
    }
    q(selector) { return this.dialog.querySelector(selector); }
    status(text) { this.q('.ss-call-status').textContent = text; }
    error(text) { const node = this.q('.ss-call-error'); node.textContent = text; node.hidden = !text; }

    async start() {
      try {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error('Calling needs HTTPS and a browser with microphone support.');
        // Ask on the initiating click, before ringing a phone the caller cannot talk to.
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
        stream.getTracks().forEach(track => track.stop());
        await loadSdk();
        if (this.closed) return;
        const { call } = await this.request('/calls', { method: 'POST', body: { deviceId: this.deviceId } });
        this.id = call.id;
        if (this.closed) { await this.request(`/calls/${this.id}/end`, { method: 'POST', body: {} }); return; }
        this.lastSuccess = Date.now();
        this.status('Calling phone…');
        this.q('.ss-call-time').textContent = 'Waiting for an answer';
        this.poll();
      } catch (error) {
        if (this.closed) return;
        const text = error.name === 'NotAllowedError' ? 'Microphone access was denied. Allow it in your browser settings and try again.'
          : error.name === 'NotFoundError' ? 'No microphone found. Connect a microphone or headset and try again.'
          : error.status === 404 ? 'This phone is not linked for calls. In Companion, choose Link to SmartSurf account and link it to this account, then try again.'
          : error.message || 'Calling is unavailable.';
        await this.end('Call unavailable', text);
      }
    }

    async poll() {
      if (this.closed || !this.id) return;
      try {
        const { call } = await this.request(`/calls/${this.id}`, { cache: 'no-store' });
        if (this.closed) return;
        this.lastSuccess = Date.now();
        if (call.state === 'ended') { await this.end(labels[call.reason] || 'Call ended'); return; }
        if (call.state === 'active') {
          this.acceptedAt = call.acceptedAt;
          this.elapsedBase = Date.now() - Math.max(0, Number(call.elapsedSeconds) || 0) * 1000;
          if (!this.room && !this.joining) await this.join();
        }
        if (this.room?.state === 'connected') this.status(this.room.remoteParticipants.size ? 'Connected · two-way audio' : 'Phone is connecting…');
      } catch (error) {
        if (this.closed) return;
        if ([401, 403, 404].includes(error.status)) { await this.end('Call ended', 'Account or phone access is no longer available.'); return; }
        this.status('Connection interrupted. Reconnecting…');
        if (Date.now() - this.lastSuccess > 40000) { await this.end('Call disconnected'); return; }
      }
      if (!this.closed) this.pollTimer = setTimeout(() => this.poll(), 2000);
    }

    async join() {
      this.joining = true; this.status('Connecting audio…');
      let room;
      try {
        const { call } = await this.request(`/calls/${this.id}/session`, { method: 'POST', body: {} });
        if (this.closed) return;
        const LK = window.LivekitClient;
        room = new LK.Room({ adaptiveStream: false, dynacast: false,
          audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
        this.room = room;
        room.on(LK.RoomEvent.TrackSubscribed, track => {
          if (this.closed || track.kind !== LK.Track.Kind.Audio) return;
          const audio = track.attach(); audio.muted = this.audioMuted; this.q('.ss-call-audio').append(audio);
        });
        room.on(LK.RoomEvent.TrackUnsubscribed, track => track.detach().forEach(node => node.remove()));
        room.on(LK.RoomEvent.Reconnecting, () => { if (!this.closed) this.status('Reconnecting audio…'); });
        room.on(LK.RoomEvent.Reconnected, () => { if (!this.closed) this.status('Connected · two-way audio'); });
        room.on(LK.RoomEvent.Disconnected, () => { if (!this.closed) void this.end('Call disconnected'); });
        room.on(LK.RoomEvent.ParticipantDisconnected, () => { if (!this.closed) this.status('Phone is reconnecting…'); });
        room.on(LK.RoomEvent.ActiveSpeakersChanged, speakers => this.q('.ss-call-avatar').classList.toggle('is-speaking', speakers.some(p => p !== room.localParticipant)));
        room.on(LK.RoomEvent.AudioPlaybackStatusChanged, () => { this.q('.ss-call-audio-start').hidden = room.canPlaybackAudio; });
        await room.connect(call.media.url, call.media.token);
        if (this.closed) { await room.localParticipant.setMicrophoneEnabled(false).catch(() => {}); await room.disconnect(); return; }
        await room.localParticipant.setMicrophoneEnabled(true);
        if (this.closed) { await room.localParticipant.setMicrophoneEnabled(false).catch(() => {}); await room.disconnect(); return; }
        this.error(''); this.status('Connected · two-way audio');
        this.q('.ss-call-avatar').classList.remove('is-ringing');
        this.q('.ss-call-mic').disabled = false; this.q('.ss-call-output').disabled = false;
        this.q('.ss-call-end').textContent = 'End call';
        void this.devices();
      } catch (error) {
        if (!this.closed) await this.end('Audio unavailable', error.name === 'NotAllowedError' ? 'Allow microphone access to talk.' : 'Could not connect audio. Check your network and try again.');
      } finally { this.joining = false; }
    }

    async toggleMic() {
      const button = this.q('.ss-call-mic'); button.disabled = true;
      try {
        const muted = !this.muted;
        await this.room.localParticipant.setMicrophoneEnabled(!muted);
        this.muted = muted; button.textContent = muted ? 'Unmute mic' : 'Mute mic'; button.setAttribute('aria-pressed', String(muted));
      } catch { this.error('Could not change the microphone. Check your browser permissions.'); }
      finally { button.disabled = this.closed; }
    }
    toggleOutput() {
      this.audioMuted = !this.audioMuted;
      this.dialog.querySelectorAll('audio').forEach(audio => { audio.muted = this.audioMuted; });
      const button = this.q('.ss-call-output'); button.textContent = this.audioMuted ? 'Unmute sound' : 'Mute sound';
      button.setAttribute('aria-pressed', String(this.audioMuted));
    }
    async devices() {
      try {
        const LK = window.LivekitClient;
        for (const [kind, selector] of [['audioinput', '.ss-call-input'], ['audiooutput', '.ss-call-sink']]) {
          const devices = await LK.Room.getLocalDevices(kind);
          const select = this.q(selector); select.replaceChildren();
          devices.forEach((device, index) => {
            const option = document.createElement('option'); option.value = device.deviceId;
            option.textContent = device.label || `${kind === 'audioinput' ? 'Microphone' : 'Speaker'} ${index + 1}`;
            option.selected = device.deviceId === (this.room?.getActiveDevice(kind) || 'default'); select.append(option);
          });
        }
        this.q('.ss-call-output-label').hidden = !(HTMLMediaElement.prototype.setSinkId);
        this.q('details').hidden = false;
      } catch { /* Default OS audio route is usable even when enumeration is blocked. */ }
    }
    async switchDevice(kind, id) {
      try { await this.room?.switchActiveDevice(kind, id); this.error(''); }
      catch { this.error('Could not use that audio device. Choose another device.'); }
    }
    renderTime() {
      if (!this.acceptedAt || this.closed) return;
      const seconds = Math.max(0, Math.floor((Date.now() - this.elapsedBase) / 1000));
      this.q('.ss-call-time').textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    }
    async end(message = 'Call ended', error = '') {
      if (this.closed) return;
      this.closed = true; clearTimeout(this.pollTimer); clearInterval(this.clock);
      window.removeEventListener('pagehide', this.onPageHide);
      this.status(message); this.error(error);
      this.q('.ss-call-avatar').classList.remove('is-ringing', 'is-speaking');
      this.q('.ss-call-mic').disabled = true; this.q('.ss-call-output').disabled = true;
      this.q('.ss-call-end').hidden = true; this.q('.ss-call-close').hidden = false;
      this.q('.ss-call-close').focus();
      this.q('.ss-call-audio-start').hidden = true; this.q('details').hidden = true;
      const room = this.room; this.room = null;
      if (room) {
        // Stop capture synchronously; disconnect also releases remote audio.
        room.localParticipant.audioTrackPublications.forEach(pub => pub.track?.stop());
        await room.disconnect().catch(() => {});
      }
      this.q('.ss-call-audio').replaceChildren();
      if (this.id) await this.request(`/calls/${this.id}/end`, { method: 'POST', body: {}, keepalive: true }).catch(() => {});
    }
    dismiss() {
      if (!this.closed) return;
      this.dialog.close(); this.dialog.remove(); if (active === this) active = null;
      if (this.restoreFocus?.isConnected) this.restoreFocus.focus();
    }
  }
  window.SmartSurfCompanionCall = {
    start(options) {
      if (active && !active.closed) { active.dialog.focus(); return; }
      active?.dismiss(); active = new CompanionCall(options); void active.start();
    },
    async end() { if (active) { await active.end(); active.dismiss(); } },
  };
})();
