// HomeCare Web Audio & Notification Engine (CSP-compliant external script)
(function () {
  var _hcAudioCtx = null;

  function _getAudioContext() {
    if (!_hcAudioCtx) {
      var AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        _hcAudioCtx = new AudioCtx();
      }
    }
    if (_hcAudioCtx && _hcAudioCtx.state === 'suspended') {
      _hcAudioCtx.resume();
    }
    return _hcAudioCtx;
  }

  // Auto-unlock audio context on first user interaction
  ['click', 'touchstart', 'keydown'].forEach(function (evt) {
    window.addEventListener(
      evt,
      function () {
        _getAudioContext();
      },
      { once: false, passive: true }
    );
  });

  function _playTone(ctx, freq, type, start, duration, gainVal) {
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(gainVal || 0.4, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration);
  }

  window.playHomecareChime = function () {
    try {
      var ctx = _getAudioContext();
      if (!ctx) return;
      var now = ctx.currentTime;

      // Sequence 1: Ascending paging chime (D5 587Hz -> A5 880Hz -> D6 1174Hz)
      _playTone(ctx, 587.33, 'triangle', now, 0.22, 0.45);
      _playTone(ctx, 880.0, 'sine', now + 0.12, 0.32, 0.5);
      _playTone(ctx, 1174.66, 'sine', now + 0.24, 0.42, 0.55);

      // Sequence 2: Echo confirmation bell (A5 880Hz -> E6 1318Hz)
      _playTone(ctx, 880.0, 'triangle', now + 0.5, 0.22, 0.4);
      _playTone(ctx, 1318.51, 'sine', now + 0.62, 0.48, 0.52);
    } catch (e) {
      console.warn('Unable to play audio chime:', e);
    }
  };

  window.playHomecareSiren = function () {
    try {
      var ctx = _getAudioContext();
      if (!ctx) return;
      var now = ctx.currentTime;
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(900, now);
      osc.frequency.linearRampToValueAtTime(600, now + 0.25);
      osc.frequency.linearRampToValueAtTime(900, now + 0.5);
      osc.frequency.linearRampToValueAtTime(600, now + 0.75);
      gain.gain.setValueAtTime(0.55, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.0);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 1.0);
    } catch (e) {
      console.warn('Unable to play siren:', e);
    }
  };

  window.requestHomecareNotificationPermission = function () {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  };

  window.showHomecareWebNotification = function (title, body) {
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, {
          body: body,
          icon: 'favicon.png',
          tag: 'hc-dispatch-' + Date.now(),
        });
      }
    } catch (e) {
      console.warn('Web notification failed:', e);
    }
  };

  window.flutterConfiguration = {
    canvasKitBaseUrl: 'canvaskit/',
  };
})();
