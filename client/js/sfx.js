// Procedural sound effects + ambient music with WebAudio (no audio files).
(function () {
  const S = window.SFX = { ctx: null, vol: 0.6, music: 0.25, on: true };
  try { const st = JSON.parse(localStorage.getItem('no_settings') || '{}'); if (st.sfx !== undefined) S.vol = st.sfx; if (st.music !== undefined) S.music = st.music; } catch (e) {}
  let master, musicGain, noiseBuf;
  const last = {};
  function init() {
    if (S.ctx) return true;
    try {
      S.ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = S.ctx.createGain(); master.gain.value = S.vol; master.connect(S.ctx.destination);
      musicGain = S.ctx.createGain(); musicGain.gain.value = S.music * 0.35; musicGain.connect(S.ctx.destination);
      noiseBuf = S.ctx.createBuffer(1, S.ctx.sampleRate, S.ctx.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      return true;
    } catch (e) { return false; }
  }
  ['mousedown', 'keydown', 'touchstart'].forEach((ev) => window.addEventListener(ev, () => { if (init() && S.ctx.state === 'suspended') S.ctx.resume(); }, { passive: true }));
  S.setVol = (v) => { S.vol = v; if (master) master.gain.value = v; };
  S.setMusic = (v) => { S.music = v; if (musicGain) musicGain.gain.value = v * 0.35; };
  function throttle(k, ms) { const t = performance.now(); if (last[k] && t - last[k] < ms) return true; last[k] = t; return false; }
  function tone(freq, dur, type = 'sine', vol = 0.3, slide = 0, delay = 0) {
    if (!S.ctx || !S.vol) return;
    const t = S.ctx.currentTime + delay;
    const o = S.ctx.createOscillator(), g = S.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, vol = 0.3, freq = 1200, q = 1, type = 'bandpass', delay = 0) {
    if (!S.ctx || !S.vol) return;
    const t = S.ctx.currentTime + delay;
    const src = S.ctx.createBufferSource(); src.buffer = noiseBuf;
    const f = S.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = S.ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(master); src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
  }
  const EL = {
    fire: () => { noise(0.35, 0.25, 600, 0.7, 'lowpass'); tone(180, 0.3, 'sawtooth', 0.08, 0.5); },
    ice: () => { tone(1800, 0.25, 'triangle', 0.12, 1.3); tone(2400, 0.2, 'sine', 0.08, 1.2, 0.05); noise(0.15, 0.1, 5000, 2); },
    water: () => { tone(500, 0.25, 'sine', 0.15, 0.5); noise(0.25, 0.1, 900, 1); },
    lightning: () => { noise(0.25, 0.35, 3000, 0.5, 'highpass'); tone(90, 0.3, 'square', 0.12, 0.6); },
    wind: () => noise(0.4, 0.2, 1500, 3),
    earth: () => { tone(70, 0.4, 'sine', 0.35, 0.5); noise(0.3, 0.2, 300, 0.7, 'lowpass'); },
    holy: () => { tone(880, 0.5, 'sine', 0.12); tone(1320, 0.5, 'sine', 0.08, 1, 0.08); tone(1760, 0.4, 'sine', 0.05, 1, 0.16); },
    dark: () => { tone(110, 0.5, 'sawtooth', 0.1, 0.6); tone(165, 0.45, 'sine', 0.1, 0.7); },
    poison: () => { tone(300, 0.3, 'square', 0.06, 0.6); noise(0.2, 0.08, 700, 4); },
    blood: () => { noise(0.18, 0.25, 900, 1.5); tone(160, 0.15, 'sawtooth', 0.08, 0.6); },
    neutral: () => { noise(0.12, 0.25, 2200, 1.2); tone(240, 0.1, 'triangle', 0.08, 0.6); }
  };
  S.cast = (el, ult) => { if (!S.ctx || throttle('cast', 45)) return; (EL[el] || EL.neutral)(); if (ult) { tone(120, 1.2, 'sawtooth', 0.15, 0.4); tone(240, 1, 'square', 0.06, 2); noise(1, 0.25, 400, 0.5, 'lowpass'); } };
  S.hit = (crit, el, mine) => { if (!S.ctx || throttle('hit', 35)) return; noise(0.08, mine ? 0.22 : 0.1, crit ? 1800 : 1100, 1); tone(crit ? 220 : 150, 0.08, 'square', mine ? 0.08 : 0.04, 0.5); if (crit) tone(1200, 0.12, 'triangle', 0.08, 0.7); };
  S.hurt = () => { if (!S.ctx || throttle('hurt', 120)) return; tone(200, 0.15, 'sawtooth', 0.1, 0.5); };
  S.swing = () => { if (!S.ctx || throttle('swing', 70)) return; noise(0.07, 0.08, 3000, 2); };
  S.shoot = () => { if (!S.ctx || throttle('shoot', 70)) return; tone(700, 0.06, 'square', 0.05, 0.4); };
  S.react = () => { if (!S.ctx) return; tone(440, 0.15, 'square', 0.1, 2); tone(880, 0.25, 'triangle', 0.1, 1.5, 0.08); noise(0.3, 0.2, 2000, 0.6); };
  S.level = () => { if (!S.ctx) return; [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.35, 'triangle', 0.15, 1, i * 0.1)); };
  S.coin = () => { if (!S.ctx || throttle('coin', 80)) return; tone(1320, 0.08, 'square', 0.05); tone(1760, 0.12, 'square', 0.05, 1, 0.06); };
  S.loot = () => { if (!S.ctx || throttle('loot', 150)) return; tone(880, 0.1, 'triangle', 0.1); tone(1320, 0.15, 'triangle', 0.1, 1, 0.07); };
  S.rare = () => { if (!S.ctx) return; [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.4, 'sine', 0.12, 1, i * 0.07)); };
  S.die = () => { if (!S.ctx || throttle('die', 60)) return; tone(300, 0.3, 'sawtooth', 0.06, 0.3); };
  S.death = () => { if (!S.ctx) return; tone(220, 1.2, 'sawtooth', 0.15, 0.3); tone(110, 1.4, 'sine', 0.2, 0.5); };
  S.ui = () => { if (!S.ctx || throttle('ui', 40)) return; tone(900, 0.04, 'sine', 0.05); };
  S.err = () => { if (!S.ctx || throttle('err', 200)) return; tone(160, 0.15, 'square', 0.06); tone(120, 0.15, 'square', 0.06, 1, 0.08); };
  S.refine = (ok, broke) => { if (!S.ctx) return; noise(0.12, 0.3, 3000, 2); noise(0.12, 0.3, 3000, 2, 'bandpass', 0.2); if (ok) [660, 880, 1320].forEach((f, i) => tone(f, 0.4, 'triangle', 0.15, 1, 0.45 + i * 0.1)); else tone(broke ? 80 : 180, 0.6, 'sawtooth', 0.15, 0.4, 0.45); };
  S.notice = () => { if (!S.ctx || throttle('notice', 500)) return; tone(660, 0.2, 'sine', 0.08); tone(990, 0.3, 'sine', 0.08, 1, 0.12); };
  S.combo = (n) => { if (!S.ctx || throttle('combo', 60)) return; tone(400 + Math.min(n, 30) * 30, 0.08, 'triangle', 0.06); };
  S.boss = () => { if (!S.ctx) return; tone(55, 1.6, 'sawtooth', 0.2, 1); tone(82, 1.6, 'sawtooth', 0.12, 1); };

  // ---------------------------------------------------------------- ambient music: slow chord pads per biome
  const SCALES = { meadow: [0, 4, 7, 11], forest: [0, 3, 7, 10], swamp: [0, 3, 6, 10], beach: [0, 4, 7, 9], ruins: [0, 3, 7, 8], desert: [0, 1, 5, 7], snow: [0, 4, 7, 14], crystal: [0, 5, 7, 11], volcano: [0, 1, 6, 7], sky: [0, 4, 9, 14], abyss: [0, 1, 6, 10], town: [0, 4, 7, 12] };
  const ROOTS = [0, 5, 7, 3];
  let musicTimer = null, biome = 'town', step = 0;
  S.setBiome = (b) => { biome = b; };
  function playChord() {
    if (!S.ctx || !S.music) return;
    const sc = SCALES[biome] || SCALES.meadow;
    const root = 110 * Math.pow(2, ROOTS[step++ % ROOTS.length] / 12);
    const t = S.ctx.currentTime;
    for (const iv of sc) {
      const o = S.ctx.createOscillator(), g = S.ctx.createGain();
      o.type = 'sine'; o.frequency.value = root * Math.pow(2, iv / 12);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.05, t + 1.6); g.gain.linearRampToValueAtTime(0.0001, t + 6.5);
      o.connect(g); g.connect(musicGain); o.start(t); o.stop(t + 6.8);
    }
    // sparse melody
    for (let i = 0; i < 3; i++) if (Math.random() < 0.6) {
      const o = S.ctx.createOscillator(), g = S.ctx.createGain();
      o.type = 'triangle'; o.frequency.value = root * 4 * Math.pow(2, sc[(Math.random() * sc.length) | 0] / 12);
      const st = t + 0.8 + i * 1.6;
      g.gain.setValueAtTime(0.0001, st); g.gain.linearRampToValueAtTime(0.035, st + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, st + 1.4);
      o.connect(g); g.connect(musicGain); o.start(st); o.stop(st + 1.5);
    }
  }
  S.startMusic = () => { if (musicTimer) return; musicTimer = setInterval(playChord, 6000); setTimeout(playChord, 500); };
})();
