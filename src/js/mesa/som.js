/* ===== RPG Master — som: efeitos e ambientes sintetizados + músicas importadas ===== */

/* ---- banco local (IndexedDB) para arquivos grandes: áudios e imagens de cenário ---- */
const DB = {
  mem: { audio: {}, img: {} },
  _p: null,
  open() {
    return (
      this._p ||
      (this._p = new Promise(res => {
        try {
          const r = indexedDB.open('rpgmaster', 1);
          r.onupgradeneeded = () => {
            const d = r.result;
            ['audio', 'img'].forEach(s => {
              if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: 'id' });
            });
          };
          r.onsuccess = () => res(r.result);
          r.onerror = () => res(null);
          r.onblocked = () => res(null);
        } catch (e) {
          res(null);
        }
      }))
    );
  },
  async run(store, mode, fn) {
    const db = await this.open();
    if (!db) return null;
    return new Promise(res => {
      try {
        const tx = db.transaction(store, mode),
          rq = fn(tx.objectStore(store));
        let out = null;
        if (rq)
          rq.onsuccess = () => {
            out = rq.result;
          };
        tx.oncomplete = () => res(out);
        tx.onerror = tx.onabort = () => res(null);
      } catch (e) {
        res(null);
      }
    });
  },
  async put(store, rec) {
    this.mem[store][rec.id] = rec;
    await this.run(store, 'readwrite', s => s.put(rec));
    return rec;
  },
  async get(store, id) {
    if (this.mem[store][id]) return this.mem[store][id];
    const r = await this.run(store, 'readonly', s => s.get(id));
    if (r) this.mem[store][r.id] = r;
    return r;
  },
  async all(store) {
    const r = await this.run(store, 'readonly', s => s.getAll());
    const list = r || Object.values(this.mem[store]);
    list.forEach(x => {
      this.mem[store][x.id] = x;
    });
    return list;
  },
  async del(store, id) {
    delete this.mem[store][id];
    await this.run(store, 'readwrite', s => s.delete(id));
  },
};

/* ---- notas ---- */
const mf = n => 440 * Math.pow(2, (n - 69) / 12);

const Snd = {
  ctx: null,
  bus: {},
  vol: { master: 0.8, music: 0.7, sfx: 0.9, amb: 0.6 },
  muted: false,
  amb: null,
  mus: null,
  lib: [],
  libLoaded: false,
  ls: [],
  _nb: {},
  shots: new Set(),
  on(fn) {
    this.ls.push(fn);
  },
  emit() {
    this.ls.forEach(f => {
      try {
        f();
      } catch (e) {}
    });
  },
  loadVol() {
    const v = Store.data && Store.data.prefs && Store.data.prefs.snd;
    if (v) Object.assign(this.vol, v);
  },
  saveVol() {
    Store.data.prefs.snd = { ...this.vol };
    Store.save();
  },
  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    }
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    const c = (this.ctx = new C()),
      m = c.createGain(),
      comp = c.createDynamicsCompressor();
    m.connect(comp);
    comp.connect(c.destination);
    this.master = m;
    ['music', 'sfx', 'amb'].forEach(k => {
      const g = c.createGain();
      g.connect(m);
      this.bus[k] = g;
    });
    this.applyVol();
    return c;
  },
  applyVol() {
    if (!this.ctx) return;
    const v = this.vol;
    this.master.gain.value = this.muted ? 0 : v.master * v.master;
    ['music', 'sfx', 'amb'].forEach(k => {
      this.bus[k].gain.value = v[k] * v[k];
    });
  },
  noise(kind) {
    if (this._nb[kind]) return this._nb[kind];
    const c = this.ctx,
      n = c.sampleRate * 4,
      b = c.createBuffer(1, n, c.sampleRate),
      d = b.getChannelData(0);
    let l = 0,
      b0 = 0,
      b1 = 0,
      b2 = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'white') d[i] = w * 0.6;
      else if (kind === 'brown') {
        l = (l + 0.02 * w) / 1.02;
        d[i] = l * 3.5;
      } else {
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852;
        d[i] = (b0 + b1 + b2 + w * 0.5362) * 0.22;
      }
    }
    return (this._nb[kind] = b);
  },
  /* oscilador com envelope */
  osc(type, f, t, dur, vol, f2, out, atk) {
    const c = this.ctx,
      o = c.createOscillator(),
      g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    atk = atk ?? Math.min(0.01, dur / 4);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(out);
    o.start(t);
    o.stop(t + dur + 0.05);
    return o;
  },
  /* ruído filtrado com envelope */
  nz(kind, t, dur, vol, ft, f0, f1, q, out, atk) {
    const c = this.ctx,
      s = c.createBufferSource(),
      f = c.createBiquadFilter(),
      g = c.createGain();
    s.buffer = this.noise(kind);
    s.loop = true;
    f.type = ft;
    f.frequency.setValueAtTime(f0, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    f.Q.value = q || 1;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + (atk ?? 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(out);
    s.start(t, Math.random() * 2);
    s.stop(t + dur + 0.05);
    return g;
  },
  /* camada contínua de ruído (ambientes) */
  layer(A, kind, ft, freq, q, gain) {
    const c = this.ctx,
      s = c.createBufferSource(),
      f = c.createBiquadFilter(),
      g = c.createGain();
    s.buffer = this.noise(kind);
    s.loop = true;
    s.loopStart = Math.random() * 2;
    f.type = ft;
    f.frequency.value = freq;
    f.Q.value = q;
    g.gain.value = gain;
    s.connect(f);
    f.connect(g);
    g.connect(A.out);
    s.start();
    A.nodes.push(s);
    return { g, f };
  },
  lfo(A, param, rate, depth) {
    const c = this.ctx,
      o = c.createOscillator(),
      g = c.createGain();
    o.frequency.value = rate;
    g.gain.value = depth;
    o.connect(g);
    g.connect(param);
    o.start();
    A.nodes.push(o);
    return o;
  },
  drone(A, type, f, vol, detune) {
    const c = this.ctx,
      o = c.createOscillator(),
      g = c.createGain();
    o.type = type;
    o.frequency.value = f;
    g.gain.value = vol;
    o.connect(g);
    g.connect(A.out);
    o.start();
    A.nodes.push(o);
    if (detune) this.lfo(A, o.detune, 0.05 + Math.random() * 0.08, detune);
    return o;
  },
  pad(out, notes, t, dur, vol) {
    const c = this.ctx;
    notes.forEach(n => {
      [-4, 4].forEach(dt => {
        const o = c.createOscillator(),
          g = c.createGain();
        o.type = 'triangle';
        o.frequency.value = mf(n);
        o.detune.value = dt;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.35);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur * 1.15);
        o.connect(g);
        g.connect(out);
        o.start(t);
        o.stop(t + dur * 1.2);
      });
    });
  },
  pluck(out, f, t, vol, len) {
    this.osc('triangle', f, t, len || 0.7, vol, null, out, 0.004);
    this.osc('sine', f * 2, t, (len || 0.7) * 0.5, vol * 0.35, null, out, 0.004);
  },
  /* ---- efeitos sonoros ---- */
  play(id, v = 1, out) {
    const d = SFX[id];
    if (!d) return;
    const c = this.init();
    if (!c) return;
    out = out || this.bus.sfx;
    d.f(this, c.currentTime + 0.01, out, v);
  },
  /* ---- ambientes (loops gerados) ---- */
  startAmb(id) {
    const d = AMB[id],
      c = this.init();
    if (!d || !c) return;
    this.stopAmb(1);
    const g = c.createGain();
    g.gain.setValueAtTime(0, c.currentTime);
    g.gain.linearRampToValueAtTime(1, c.currentTime + 2);
    g.connect(this.bus.amb);
    const A = {
      id,
      out: g,
      nodes: [],
      timers: [],
      alive: true,
      every(min, max, fn) {
        const go = () => {
          const tm = setTimeout(
            () => {
              if (!A.alive) return;
              try {
                fn();
              } catch (e) {}
              go();
            },
            (min + Math.random() * (max - min)) * 1000
          );
          A.timers.push(tm);
        };
        go();
      },
    };
    try {
      d.mk(this, A);
    } catch (e) {
      console.error(e);
    }
    this.amb = A;
    this.emit();
  },
  stopAmb(fade = 1.5) {
    const A = this.amb;
    if (!A) return;
    this.amb = null;
    A.alive = false;
    A.timers.forEach(clearTimeout);
    const c = this.ctx,
      t = c.currentTime;
    A.out.gain.cancelScheduledValues(t);
    A.out.gain.setValueAtTime(A.out.gain.value, t);
    A.out.gain.linearRampToValueAtTime(0, t + fade);
    setTimeout(
      () => {
        A.nodes.forEach(n => {
          try {
            n.stop();
          } catch (e) {}
        });
        try {
          A.out.disconnect();
        } catch (e) {}
      },
      fade * 1000 + 200
    );
    this.emit();
  },
  /* ---- biblioteca do usuário ---- */
  async loadLib() {
    if (this.libLoaded) return this.lib;
    this.lib = (await DB.all('audio')).sort((a, b) => (a.added || 0) - (b.added || 0));
    this.libLoaded = true;
    return this.lib;
  },
  async addFiles(files, kind) {
    let n = 0;
    for (const f of files) {
      if (!/^audio\//.test(f.type) && !/\.(mp3|ogg|wav|m4a|flac|opus|aac|webm)$/i.test(f.name)) continue;
      const rec = {
        id: uid(),
        name: f.name.replace(/\.[^.]+$/, ''),
        kind,
        blob: f,
        size: f.size,
        added: Date.now() + n,
      };
      await DB.put('audio', rec);
      this.lib.push(rec);
      n++;
    }
    this.emit();
    return n;
  },
  async removeLib(id) {
    if (this.mus && this.mus.id === id) this.stopMusic(0.3);
    await DB.del('audio', id);
    this.lib = this.lib.filter(r => r.id !== id);
    this.emit();
  },
  async renameLib(id, name) {
    const r = this.lib.find(x => x.id === id);
    if (r) {
      r.name = name;
      await DB.put('audio', r);
      this.emit();
    }
  },
  url(r) {
    return r._url || (r._url = URL.createObjectURL(r.blob));
  },
  mediaNode(r, bus, loop) {
    const c = this.init(),
      el = new Audio(this.url(r));
    el.loop = !!loop;
    el.preload = 'auto';
    const src = c.createMediaElementSource(el),
      g = c.createGain();
    g.gain.value = 0;
    src.connect(g);
    g.connect(bus);
    return { el, g, src };
  },
  async playMusic(id, fade = 2) {
    await this.loadLib();
    const r = this.lib.find(x => x.id === id);
    if (!r) return;
    const c = this.init();
    if (!c) return;
    if (this.mus && this.mus.id === id && !this.mus.el.paused) return;
    this.stopMusic(fade);
    const m = this.mediaNode(r, this.bus.music, true);
    m.id = id;
    m.name = r.name;
    this.mus = m;
    try {
      await m.el.play();
    } catch (e) {
      toast(
        L3(
          'O navegador bloqueou o som. Clique de novo.',
          'The browser blocked audio. Click again.',
          'Der Browser hat den Ton blockiert. Klicke erneut.'
        )
      );
      this.mus = null;
      return;
    }
    const t = c.currentTime;
    m.g.gain.setValueAtTime(0, t);
    m.g.gain.linearRampToValueAtTime(1, t + fade);
    this.emit();
  },
  stopMusic(fade = 1.5) {
    const m = this.mus;
    if (!m) return;
    this.mus = null;
    const c = this.ctx,
      t = c.currentTime;
    m.g.gain.cancelScheduledValues(t);
    m.g.gain.setValueAtTime(m.g.gain.value, t);
    m.g.gain.linearRampToValueAtTime(0, t + fade);
    setTimeout(
      () => {
        try {
          m.el.pause();
          m.src.disconnect();
          m.g.disconnect();
        } catch (e) {}
      },
      fade * 1000 + 100
    );
    this.emit();
  },
  toggleMusic() {
    const m = this.mus;
    if (!m) return;
    if (m.el.paused) m.el.play();
    else m.el.pause();
    this.emit();
  },
  async playFile(id) {
    await this.loadLib();
    const r = this.lib.find(x => x.id === id);
    if (!r) return;
    const c = this.init();
    if (!c) return;
    const m = this.mediaNode(r, this.bus.sfx, false);
    m.g.gain.value = 1;
    this.shots.add(m);
    m.el.onended = () => {
      this.shots.delete(m);
      try {
        m.src.disconnect();
        m.g.disconnect();
      } catch (e) {}
    };
    try {
      await m.el.play();
    } catch (e) {}
  },
  stopAll() {
    this.stopAmb(0.8);
    this.stopMusic(0.8);
    this.shots.forEach(m => {
      try {
        m.el.pause();
      } catch (e) {}
    });
    this.shots.clear();
  },
  setMuted(b) {
    this.muted = b;
    this.applyVol();
    this.emit();
  },
};

/* ---- efeitos: id → { ic, n:{pt,en,de}, f(S, t, out, v) } ---- */
const SFX = {
  espada: {
    ic: '⚔',
    n: { pt: 'Espada', en: 'Sword', de: 'Schwert' },
    f(S, t, o, v) {
      S.nz('white', t, 0.35, 0.5 * v, 'bandpass', 2500, 7000, 1.2, o, 0.01);
      S.osc('triangle', 2400, t + 0.04, 0.5, 0.12 * v, 1800, o);
      S.osc('sine', 3600, t + 0.05, 0.4, 0.06 * v, null, o);
    },
  },
  soco: {
    ic: '👊',
    n: { pt: 'Soco', en: 'Punch', de: 'Schlag' },
    f(S, t, o, v) {
      S.osc('sine', 150, t, 0.22, 0.9 * v, 40, o);
      S.nz('brown', t, 0.18, 0.8 * v, 'lowpass', 900, 150, 1, o, 0.002);
    },
  },
  explosao: {
    ic: '💥',
    n: { pt: 'Explosão', en: 'Explosion', de: 'Explosion' },
    f(S, t, o, v) {
      S.osc('sine', 110, t, 1.4, 1 * v, 25, o);
      S.nz('brown', t, 1.8, 1 * v, 'lowpass', 2500, 80, 0.8, o, 0.005);
      S.nz('white', t, 0.5, 0.35 * v, 'highpass', 1500, 600, 0.7, o, 0.002);
    },
  },
  trovao: {
    ic: '⛈',
    n: { pt: 'Trovão', en: 'Thunder', de: 'Donner' },
    f(S, t, o, v) {
      S.nz('white', t, 0.25, 0.6 * v, 'bandpass', 3000, 800, 0.8, o, 0.002);
      for (let i = 0; i < 5; i++)
        S.nz(
          'brown',
          t + 0.15 + i * (0.3 + Math.random() * 0.5),
          1.4 + Math.random(),
          (0.9 - i * 0.12) * v,
          'lowpass',
          400,
          70,
          0.7,
          o,
          0.1 + Math.random() * 0.2
        );
    },
  },
  magia: {
    ic: '✨',
    n: { pt: 'Magia', en: 'Spell', de: 'Zauber' },
    f(S, t, o, v) {
      [0, 4, 7, 12, 16, 19, 24].forEach((n, i) =>
        S.osc('sine', mf(72 + n), t + i * 0.06, 0.7, 0.09 * v, null, o, 0.005)
      );
      S.nz('white', t, 1, 0.12 * v, 'highpass', 6000, 9000, 1, o, 0.3);
    },
  },
  cura: {
    ic: '💚',
    n: { pt: 'Cura', en: 'Heal', de: 'Heilung' },
    f(S, t, o, v) {
      [79, 83, 86, 91].forEach((n, i) => {
        S.osc('sine', mf(n), t + i * 0.11, 1.1, 0.16 * v, null, o, 0.01);
        S.osc('triangle', mf(n + 12), t + i * 0.11, 0.6, 0.04 * v, null, o, 0.01);
      });
    },
  },
  moeda: {
    ic: '🪙',
    n: { pt: 'Moedas', en: 'Coins', de: 'Münzen' },
    f(S, t, o, v) {
      S.osc('square', 1568, t, 0.09, 0.06 * v, null, o, 0.002);
      S.osc('square', 2093, t + 0.08, 0.5, 0.06 * v, null, o, 0.002);
      S.osc('sine', 4200, t + 0.09, 0.3, 0.05 * v, null, o, 0.002);
    },
  },
  porta: {
    ic: '🚪',
    n: { pt: 'Porta rangendo', en: 'Creaking door', de: 'Knarrende Tür' },
    f(S, t, o, v) {
      const x = S.osc('sawtooth', 90, t, 1.3, 0.12 * v, 210, o, 0.2);
      S.nz('white', t, 1.2, 0.1 * v, 'bandpass', 700, 1500, 8, o, 0.3);
      S.osc('sine', 80, t + 1.35, 0.25, 0.6 * v, 40, o);
    },
  },
  passos: {
    ic: '👣',
    n: { pt: 'Passos', en: 'Footsteps', de: 'Schritte' },
    f(S, t, o, v) {
      for (let i = 0; i < 6; i++)
        S.nz('brown', t + i * 0.42, 0.14, 0.8 * v, 'lowpass', 500 + Math.random() * 200, 120, 1, o, 0.003);
    },
  },
  flecha: {
    ic: '🏹',
    n: { pt: 'Flecha', en: 'Arrow', de: 'Pfeil' },
    f(S, t, o, v) {
      S.nz('white', t, 0.3, 0.3 * v, 'highpass', 2000, 6000, 1, o, 0.1);
      S.osc('sine', 200, t + 0.32, 0.12, 0.6 * v, 90, o);
      S.osc('triangle', 600, t + 0.32, 0.3, 0.1 * v, 580, o);
    },
  },
  canhao: {
    ic: '💣',
    n: { pt: 'Canhão', en: 'Cannon', de: 'Kanone' },
    f(S, t, o, v) {
      S.osc('sine', 95, t, 1, 1 * v, 28, o);
      S.nz('brown', t, 1.2, 0.9 * v, 'lowpass', 1800, 100, 0.7, o, 0.003);
      S.nz('white', t + 0.02, 0.25, 0.3 * v, 'bandpass', 2500, 900, 0.8, o, 0.002);
    },
  },
  sino: {
    ic: '🔔',
    n: { pt: 'Sino', en: 'Bell', de: 'Glocke' },
    f(S, t, o, v) {
      [1, 2.76, 5.4, 8.93].forEach((r, i) =>
        S.osc('sine', 392 * r, t, 3.5 / (i + 1), (0.22 * v) / (i + 1), null, o, 0.003)
      );
    },
  },
  tambor: {
    ic: '🥁',
    n: { pt: 'Tambores', en: 'Drums', de: 'Trommeln' },
    f(S, t, o, v) {
      [0, 0.45, 0.9, 1.2, 1.5].forEach((d, i) => {
        S.osc('sine', 140, t + d, 0.35, (i % 2 ? 0.6 : 0.95) * v, 45, o);
        S.nz('brown', t + d, 0.12, 0.4 * v, 'lowpass', 700, 200, 1, o, 0.002);
      });
    },
  },
  corneta: {
    ic: '📯',
    n: { pt: 'Corneta', en: 'Horn', de: 'Horn' },
    f(S, t, o, v) {
      [
        [0, 0, 1.0],
        [0.9, 7, 1.6],
      ].forEach(([d, n, l]) => {
        const x = S.osc('sawtooth', mf(55 + n), t + d, l, 0.1 * v, null, o, 0.12);
        S.osc('sawtooth', mf(55 + n) * 1.005, t + d, l, 0.08 * v, null, o, 0.12);
      });
    },
  },
  critico: {
    ic: '🌟',
    n: { pt: 'Crítico!', en: 'Critical!', de: 'Kritisch!' },
    f(S, t, o, v) {
      [60, 64, 67, 72, 76, 79, 84].forEach((n, i) => {
        S.osc('sawtooth', mf(n), t + i * 0.08, 0.9, 0.07 * v, null, o, 0.01);
        S.osc('square', mf(n + 12), t + i * 0.08, 0.5, 0.025 * v, null, o, 0.01);
      });
      S.nz('white', t, 1.2, 0.1 * v, 'highpass', 5000, 8000, 1, o, 0.4);
    },
  },
  falha: {
    ic: '💀',
    n: { pt: 'Falha', en: 'Fail', de: 'Fehlschlag' },
    f(S, t, o, v) {
      [
        [0, 62],
        [0.35, 60],
        [0.7, 57],
        [1.1, 53],
      ].forEach(([d, n], i) =>
        S.osc('sawtooth', mf(n), t + d, i === 3 ? 1.2 : 0.38, 0.13 * v, mf(n - 1), o, 0.03)
      );
    },
  },
  portal: {
    ic: '🌀',
    n: { pt: 'Portal', en: 'Portal', de: 'Portal' },
    f(S, t, o, v) {
      S.osc('sawtooth', 120, t, 2.2, 0.1 * v, 900, o, 0.6);
      S.osc('sine', 300, t, 2.2, 0.12 * v, 1800, o, 0.6);
      S.nz('white', t, 2.2, 0.18 * v, 'bandpass', 300, 5000, 3, o, 0.9);
    },
  },
  coracao: {
    ic: '❤',
    n: { pt: 'Coração', en: 'Heartbeat', de: 'Herzschlag' },
    f(S, t, o, v) {
      for (let i = 0; i < 4; i++) {
        S.osc('sine', 62, t + i * 0.9, 0.2, 0.95 * v, 38, o);
        S.osc('sine', 56, t + i * 0.9 + 0.22, 0.2, 0.7 * v, 34, o);
      }
    },
  },
  splash: {
    ic: '💦',
    n: { pt: 'Água', en: 'Splash', de: 'Wasser' },
    f(S, t, o, v) {
      S.nz('white', t, 0.9, 0.5 * v, 'bandpass', 1200, 400, 0.7, o, 0.04);
      S.nz('pink', t + 0.05, 1.1, 0.5 * v, 'lowpass', 2500, 500, 0.5, o, 0.08);
      for (let i = 0; i < 5; i++)
        S.osc('sine', 900 + Math.random() * 900, t + 0.2 + i * 0.09, 0.1, 0.05 * v, null, o);
    },
  },
  misterio: {
    ic: '🔮',
    n: { pt: 'Mistério', en: 'Mystery', de: 'Geheimnis' },
    f(S, t, o, v) {
      [57, 60, 63, 66].forEach(n => S.osc('sine', mf(n), t, 3, 0.1 * v, null, o, 0.8));
      S.osc('sine', mf(93), t + 1.1, 1.8, 0.05 * v, null, o, 0.02);
    },
  },
  grito: {
    ic: '😱',
    n: { pt: 'Susto', en: 'Jump scare', de: 'Schreck' },
    f(S, t, o, v) {
      S.osc('sawtooth', 400, t, 0.9, 0.22 * v, 1500, o, 0.01);
      S.osc('sawtooth', 427, t, 0.9, 0.22 * v, 1620, o, 0.01);
      S.nz('white', t, 0.6, 0.4 * v, 'bandpass', 3000, 2000, 1, o, 0.01);
      S.osc('sine', 70, t, 0.4, 0.8 * v, 30, o);
    },
  },
  dado: {
    ic: '🎲',
    n: { pt: 'Dados', en: 'Dice', de: 'Würfel' },
    f(S, t, o, v) {
      for (let i = 0; i < 6; i++) {
        const d = i * (0.05 + i * 0.018);
        S.osc('square', 900 + Math.random() * 700, t + d, 0.04, (0.07 - i * 0.008) * v, null, o, 0.001);
        S.nz('white', t + d, 0.05, 0.2 * v, 'bandpass', 2000 + Math.random() * 2000, null, 2, o, 0.001);
      }
    },
  },
};

/* ---- ambientes ---- */
const AMB = {
  mar: {
    ic: '🌊',
    n: { pt: 'Mar e gaivotas', en: 'Sea & gulls', de: 'Meer & Möwen' },
    mk(S, A) {
      const l = S.layer(A, 'brown', 'lowpass', 600, 0.7, 0.38);
      S.lfo(A, l.g.gain, 0.11, 0.26);
      const l2 = S.layer(A, 'pink', 'bandpass', 1800, 0.5, 0.09);
      S.lfo(A, l2.g.gain, 0.11, 0.06);
      A.every(7, 16, () => {
        const t = S.ctx.currentTime;
        S.osc('sine', 2300, t, 0.28, 0.05, 1600, A.out, 0.03);
        S.osc('sine', 1900, t + 0.32, 0.34, 0.05, 2500, A.out, 0.03);
        if (Math.random() < 0.5) S.osc('sine', 2200, t + 0.75, 0.25, 0.04, 1500, A.out, 0.03);
      });
    },
  },
  tempestade: {
    ic: '⛈',
    n: { pt: 'Tempestade', en: 'Storm', de: 'Gewitter' },
    mk(S, A) {
      S.layer(A, 'pink', 'highpass', 1100, 0.5, 0.42);
      const w = S.layer(A, 'white', 'highpass', 4500, 0.5, 0.07);
      S.lfo(A, w.g.gain, 0.2, 0.03);
      const r = S.layer(A, 'brown', 'lowpass', 160, 0.7, 0.35);
      S.lfo(A, r.g.gain, 0.08, 0.15);
      A.every(8, 20, () => S.play('trovao', 0.7, A.out));
    },
  },
  chuva: {
    ic: '🌧',
    n: { pt: 'Chuva calma', en: 'Soft rain', de: 'Sanfter Regen' },
    mk(S, A) {
      S.layer(A, 'pink', 'highpass', 1500, 0.4, 0.34);
      const w = S.layer(A, 'white', 'highpass', 5000, 0.5, 0.06);
      S.lfo(A, w.g.gain, 0.15, 0.02);
      S.layer(A, 'brown', 'lowpass', 250, 0.5, 0.12);
    },
  },
  floresta: {
    ic: '🌲',
    n: { pt: 'Floresta', en: 'Forest', de: 'Wald' },
    mk(S, A) {
      const w = S.layer(A, 'pink', 'bandpass', 500, 0.6, 0.16);
      S.lfo(A, w.g.gain, 0.07, 0.1);
      [
        [4300, 13],
        [4650, 17],
        [3900, 11],
      ].forEach(([f, r]) => {
        const c = S.ctx,
          o = c.createOscillator(),
          g = c.createGain();
        o.frequency.value = f;
        g.gain.value = 0.014;
        o.connect(g);
        g.connect(A.out);
        o.start();
        A.nodes.push(o);
        S.lfo(A, g.gain, r, 0.014);
      });
      A.every(3, 9, () => {
        const t = S.ctx.currentTime,
          f = 2400 + Math.random() * 2200;
        for (let i = 0; i < 2 + ((Math.random() * 3) | 0); i++)
          S.osc('sine', f, t + i * 0.13, 0.09, 0.045, f * (1.1 + Math.random() * 0.3), A.out, 0.01);
      });
    },
  },
  caverna: {
    ic: '🕳',
    n: { pt: 'Caverna', en: 'Cave', de: 'Höhle' },
    mk(S, A) {
      S.drone(A, 'sine', 55, 0.16, 12);
      S.drone(A, 'sine', 55.8, 0.14, 12);
      S.drone(A, 'sine', 82.4, 0.05, 10);
      const n = S.layer(A, 'brown', 'lowpass', 220, 0.7, 0.16);
      S.lfo(A, n.g.gain, 0.05, 0.06);
      const c = S.ctx,
        d = c.createDelay(1),
        fb = c.createGain();
      d.delayTime.value = 0.37;
      fb.gain.value = 0.5;
      d.connect(fb);
      fb.connect(d);
      d.connect(A.out);
      A.every(2.5, 7, () => {
        const t = c.currentTime,
          f = 1000 + Math.random() * 600;
        S.osc('sine', f, t, 0.09, 0.12, f * 0.62, d, 0.002);
      });
    },
  },
  taverna: {
    ic: '🍺',
    n: { pt: 'Taverna', en: 'Tavern', de: 'Taverne' },
    mk(S, A) {
      [
        [350, 0.14, 0.31],
        [720, 0.12, 0.47],
        [1150, 0.07, 0.63],
      ].forEach(([f, g, r]) => {
        const l = S.layer(A, 'pink', 'bandpass', f, 1.3, g);
        S.lfo(A, l.g.gain, r, g * 0.7);
        S.lfo(A, l.f.frequency, r * 0.6, f * 0.25);
      });
      A.every(4, 11, () => {
        const t = S.ctx.currentTime,
          f = 2400 + Math.random() * 600;
        S.osc('triangle', f, t, 0.16, 0.04, null, A.out, 0.002);
        S.osc('triangle', f * 1.5, t + 0.02, 0.2, 0.03, null, A.out, 0.002);
      });
      const sc = [293.66, 329.63, 349.23, 392, 440, 493.88, 523.25, 587.33];
      let k = 3;
      A.every(0.42, 0.42, () => {
        if (Math.random() < 0.55) {
          k = Math.max(0, Math.min(7, k + ((Math.random() * 5) | 0) - 2));
          S.pluck(A.out, sc[k], S.ctx.currentTime, 0.05, 0.6);
        }
      });
    },
  },
  fogueira: {
    ic: '🔥',
    n: { pt: 'Fogueira', en: 'Campfire', de: 'Lagerfeuer' },
    mk(S, A) {
      const b = S.layer(A, 'brown', 'lowpass', 420, 0.7, 0.3);
      S.lfo(A, b.g.gain, 0.3, 0.08);
      A.every(0.06, 0.4, () => {
        const t = S.ctx.currentTime;
        S.nz(
          'white',
          t,
          0.03 + Math.random() * 0.04,
          0.05 + Math.random() * 0.12,
          'highpass',
          1500 + Math.random() * 2500,
          null,
          1,
          A.out,
          0.001
        );
        if (Math.random() < 0.15) S.nz('brown', t, 0.08, 0.3, 'lowpass', 500, 150, 1, A.out, 0.002);
      });
    },
  },
  batalha: {
    ic: '⚔',
    n: { pt: 'Batalha', en: 'Battle', de: 'Schlacht' },
    mk(S, A) {
      let st = 0;
      S.layer(A, 'pink', 'bandpass', 900, 0.5, 0.05);
      A.every(0.3, 0.3, () => {
        const t = S.ctx.currentTime;
        if (st % 4 === 0) {
          S.osc('sine', 120, t, 0.32, 0.8, 40, A.out);
          S.nz('brown', t, 0.1, 0.5, 'lowpass', 600, 150, 1, A.out, 0.002);
        }
        if (st % 8 === 4) S.osc('sine', 90, t, 0.4, 0.7, 32, A.out);
        if (st % 2 === 1) S.osc('sine', 170, t, 0.15, 0.28, 90, A.out);
        if (st % 8 === 7) S.nz('white', t, 0.12, 0.25, 'bandpass', 1800, 900, 1, A.out, 0.002);
        st++;
      });
      A.every(5, 12, () => {
        const t = S.ctx.currentTime;
        S.nz('white', t, 0.35, 0.1, 'bandpass', 3800, 6000, 2, A.out, 0.005);
        S.osc('triangle', 820 + Math.random() * 300, t, 0.4, 0.03, null, A.out, 0.003);
      });
    },
  },
  tensao: {
    ic: '😨',
    n: { pt: 'Tensão', en: 'Suspense', de: 'Spannung' },
    mk(S, A) {
      [110, 116.54, 164.81, 233.08].forEach((f, i) => S.drone(A, 'sine', f, 0.06 - i * 0.01, 25));
      const n = S.layer(A, 'brown', 'lowpass', 180, 0.7, 0.14);
      S.lfo(A, n.g.gain, 0.04, 0.06);
      A.every(8, 18, () => {
        const t = S.ctx.currentTime,
          f = 500 + Math.random() * 300;
        S.osc('sine', f, t, 3.2, 0.028, f * 1.5, A.out, 1.2);
      });
    },
  },
  cidade: {
    ic: '🏘',
    n: { pt: 'Cidade / mercado', en: 'Town market', de: 'Marktplatz' },
    mk(S, A) {
      [
        [500, 0.18, 0.21],
        [950, 0.12, 0.33],
        [1500, 0.06, 0.44],
      ].forEach(([f, g, r]) => {
        const l = S.layer(A, 'pink', 'bandpass', f, 1.1, g);
        S.lfo(A, l.g.gain, r, g * 0.6);
      });
      A.every(3, 9, () => S.osc('sine', 170 + Math.random() * 40, S.ctx.currentTime, 0.06, 0.12, 100, A.out));
      A.every(14, 30, () => S.play('sino', 0.14, A.out));
    },
  },
  deserto: {
    ic: '🏜',
    n: { pt: 'Deserto', en: 'Desert wind', de: 'Wüstenwind' },
    mk(S, A) {
      const l = S.layer(A, 'pink', 'bandpass', 700, 0.8, 0.34);
      S.lfo(A, l.f.frequency, 0.06, 320);
      S.lfo(A, l.g.gain, 0.09, 0.14);
      S.drone(A, 'sine', 73.4, 0.04, 8);
    },
  },
  nave: {
    ic: '🚀',
    n: { pt: 'Nave espacial', en: 'Spaceship', de: 'Raumschiff' },
    mk(S, A) {
      const o = S.drone(A, 'sawtooth', 55, 0.045, 5);
      const f = S.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 220;
      o.disconnect();
      o.connect(f);
      const g = S.ctx.createGain();
      g.gain.value = 1;
      f.connect(g);
      g.connect(A.out);
      S.drone(A, 'sine', 110, 0.05, 6);
      const n = S.layer(A, 'white', 'bandpass', 3000, 2, 0.018);
      S.lfo(A, n.f.frequency, 0.1, 1200);
      A.every(3, 10, () => {
        const t = S.ctx.currentTime;
        S.osc('sine', 1400, t, 0.07, 0.05, null, A.out, 0.002);
        S.osc('sine', 1000, t + 0.12, 0.07, 0.05, null, A.out, 0.002);
      });
    },
  },
  misterio: {
    ic: '🔮',
    n: { pt: 'Mistério (música)', en: 'Mystery (music)', de: 'Mysterium (Musik)' },
    mk(S, A) {
      const ch = [
        [57, 60, 64],
        [53, 57, 60],
        [55, 59, 62],
        [52, 56, 59],
      ];
      let i = 0;
      const go = () => {
        S.pad(A.out, ch[i++ % 4], S.ctx.currentTime, 6, 0.03);
      };
      go();
      A.every(6, 6, go);
      A.every(3, 8, () => {
        const f = mf(81 + [0, 3, 7, 12][(Math.random() * 4) | 0]);
        S.osc('sine', f, S.ctx.currentTime, 2.4, 0.035, null, A.out, 0.005);
      });
    },
  },
  aventura: {
    ic: '🧭',
    n: { pt: 'Aventura (música)', en: 'Adventure (music)', de: 'Abenteuer (Musik)' },
    mk(S, A) {
      const ch = [
        [57, 60, 64],
        [60, 64, 67],
        [62, 65, 69],
        [55, 59, 62],
      ];
      let i = 0,
        cur = ch[0];
      const go = () => {
        cur = ch[i++ % 4];
        S.pad(
          A.out,
          cur.map(n => n - 12),
          S.ctx.currentTime,
          4.8,
          0.03
        );
      };
      go();
      A.every(4.8, 4.8, go);
      let st = 0;
      A.every(0.3, 0.3, () => {
        if (Math.random() < 0.72) {
          const n = cur[st++ % 3] + (Math.random() < 0.3 ? 12 : 0);
          S.pluck(A.out, mf(n + 12), S.ctx.currentTime, 0.05, 0.55);
        }
      });
    },
  },
  melancolia: {
    ic: '🌙',
    n: { pt: 'Melancolia (música)', en: 'Melancholy (music)', de: 'Melancholie (Musik)' },
    mk(S, A) {
      const ch = [
        [50, 53, 57],
        [46, 50, 53],
        [53, 57, 60],
        [48, 52, 55],
      ];
      let i = 0,
        cur = ch[0];
      const go = () => {
        cur = ch[i++ % 4];
        S.pad(A.out, cur, S.ctx.currentTime, 7, 0.035);
      };
      go();
      A.every(7, 7, go);
      A.every(1.2, 3, () => {
        const n = cur[(Math.random() * 3) | 0] + 24;
        S.pluck(A.out, mf(n), S.ctx.currentTime, 0.06, 1.6);
      });
    },
  },
};

/* ---- painel de som (gaveta lateral, persiste entre telas) ---- */
const SP = { open: false, tab: 'fx' };
function soundChip() {
  const chip = h('button.btn.snd-chip', {
    type: 'button',
    onclick: () => soundPanel(true),
    title: L3('Painel de som', 'Sound panel', 'Soundpanel'),
  });
  const upd = () => {
    const parts = [];
    if (Snd.amb) parts.push(AMB[Snd.amb.id].ic + ' ' + tr(AMB[Snd.amb.id].n));
    if (Snd.mus) parts.push('🎵 ' + Snd.mus.name);
    chip.style.display = parts.length ? '' : 'none';
    chip.textContent = '🔊 ' + parts.join(' · ');
  };
  upd();
  chip._upd = upd;
  return chip;
}
function soundPanel(open) {
  let dock = $('#snddock');
  if (open === false) {
    if (dock) dock.remove();
    SP.open = false;
    return;
  }
  if (!dock) {
    dock = h('aside#snddock', {
      role: 'complementary',
      'aria-label': L3('Painel de som', 'Sound panel', 'Soundpanel'),
    });
    document.body.append(dock);
  }
  SP.open = true;
  Snd.loadVol();
  Snd.loadLib().then(() => draw());
  const sl = (key, label) =>
    h(
      'label.snd-sl',
      h('span', label),
      h('input', {
        type: 'range',
        min: 0,
        max: 1,
        step: 0.01,
        value: Snd.vol[key],
        oninput: e => {
          Snd.vol[key] = +e.target.value;
          Snd.init();
          Snd.applyVol();
        },
        onchange: () => Snd.saveVol(),
      })
    );
  function draw() {
    if (!$('#snddock')) return;
    const pt = L3;
    const tabs = [
      ['fx', L3('Efeitos', 'Effects', 'Effekte')],
      ['amb', L3('Ambientes', 'Ambience', 'Ambiente')],
      ['mus', L3('Minhas músicas', 'My music', 'Meine Musik')],
    ];
    const body = h('div.snd-body');
    if (SP.tab === 'fx') {
      body.append(
        h(
          'p.muted',
          { style: { margin: '0 0 8px', fontSize: '.85em' } },
          L3(
            'Clique para tocar. Teclas 1 a 9 também funcionam na Mesa e na Mesa virtual.',
            'Click to play. Keys 1–9 also work on the GM table and the virtual tabletop.',
            'Klicken zum Abspielen. Tasten 1–9 funktionieren auch am Spielleiter-Tisch und am virtuellen Tisch.'
          )
        ),
        h(
          'div.snd-pads',
          Object.keys(SFX).map((id, i) =>
            h(
              'button.snd-pad',
              { type: 'button', onclick: () => Snd.play(id) },
              i < 9 ? h('kbd', String(i + 1)) : null,
              h('span.ic', SFX[id].ic),
              h('span', tr(SFX[id].n))
            )
          )
        )
      );
      const mine = Snd.lib.filter(r => r.kind === 'sfx');
      body.append(
        h(
          'div.sec-t',
          { style: { margin: '14px 0 6px' } },
          L3('Meus efeitos', 'My effects', 'Meine Effekte')
        ),
        mine.length
          ? h(
              'div.snd-pads',
              mine.map(r =>
                h(
                  'button.snd-pad.mine',
                  { type: 'button', title: r.name, onclick: () => Snd.playFile(r.id) },
                  h('span.ic', '🎧'),
                  h('span', r.name)
                )
              )
            )
          : h(
              'p.muted',
              { style: { fontSize: '.85em' } },
              L3(
                'Nenhum ainda. Importe arquivos na aba “Minhas músicas”.',
                'None yet. Import files in the “My music” tab.',
                'Noch keine. Importiere Dateien im Tab „Meine Musik“.'
              )
            )
      );
    } else if (SP.tab === 'amb') {
      body.append(
        h(
          'p.muted',
          { style: { margin: '0 0 8px', fontSize: '.85em' } },
          L3(
            'Sons de fundo gerados na hora, sem arquivos. Dá para tocar junto com uma música sua.',
            'Background sounds generated live, no files. Can play together with your own music.',
            'Live erzeugte Hintergrundgeräusche ohne Dateien. Kann mit eigener Musik zusammen laufen.'
          )
        ),
        h(
          'div.snd-list',
          Object.keys(AMB).map(id =>
            h(
              'button.snd-row' + (Snd.amb && Snd.amb.id === id ? '.on' : ''),
              {
                type: 'button',
                onclick: () => {
                  if (Snd.amb && Snd.amb.id === id) Snd.stopAmb();
                  else Snd.startAmb(id);
                  draw();
                },
              },
              h('span.ic', AMB[id].ic),
              h('b', tr(AMB[id].n)),
              h('span.st', Snd.amb && Snd.amb.id === id ? '■ ' + L3('Parar', 'Stop', 'Stopp') : '▶')
            )
          )
        )
      );
    } else {
      const inp = kind => {
        const i = h('input', {
          type: 'file',
          accept: 'audio/*,.mp3,.ogg,.wav,.m4a,.flac,.opus',
          multiple: true,
          style: { display: 'none' },
          onchange: async () => {
            const n = await Snd.addFiles([...i.files], kind);
            i.remove();
            toast(
              n
                ? n + ' ' + L3('arquivo(s) adicionado(s)', 'file(s) added', 'Datei(en) hinzugefügt')
                : L3('Nenhum áudio reconhecido.', 'No audio recognized.', 'Kein Audio erkannt.')
            );
            draw();
          },
        });
        document.body.append(i);
        i.click();
      };
      body.append(
        h(
          'div',
          { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } },
          h(
            'button.btn.primary.sm',
            { type: 'button', onclick: () => inp('music') },
            '＋ ' + L3('Música (em loop)', 'Music (loops)', 'Musik (Schleife)')
          ),
          h(
            'button.btn.sm',
            { type: 'button', onclick: () => inp('sfx') },
            '＋ ' + L3('Efeito (toca uma vez)', 'Effect (plays once)', 'Effekt (einmalig)')
          )
        ),
        h(
          'p.muted',
          { style: { fontSize: '.8em', margin: '8px 0' } },
          L3(
            'Os arquivos ficam guardados neste navegador (não vão no backup nem nas fichas). Use mp3, ogg, wav ou m4a.',
            'Files are stored in this browser only (not in backups or sheets). Use mp3, ogg, wav or m4a.',
            'Dateien bleiben nur in diesem Browser (nicht im Backup oder in Bögen). mp3, ogg, wav oder m4a.'
          )
        )
      );
      const music = Snd.lib.filter(r => r.kind === 'music'),
        sfx = Snd.lib.filter(r => r.kind === 'sfx');
      const row = r =>
        h(
          'div.snd-row.lib' + (Snd.mus && Snd.mus.id === r.id ? '.on' : ''),
          h(
            'button.go',
            {
              type: 'button',
              title: L3('Tocar', 'Play', 'Abspielen'),
              onclick: () => {
                if (r.kind === 'music') {
                  if (Snd.mus && Snd.mus.id === r.id) Snd.toggleMusic();
                  else Snd.playMusic(r.id);
                } else Snd.playFile(r.id);
                setTimeout(draw, 60);
              },
            },
            r.kind === 'music' ? (Snd.mus && Snd.mus.id === r.id && !Snd.mus.el.paused ? '⏸' : '▶') : '▶'
          ),
          h('input', {
            type: 'text',
            value: r.name,
            'aria-label': L3('Nome', 'Name', 'Name'),
            onchange: e => Snd.renameLib(r.id, e.target.value),
          }),
          h(
            'button.btn.ghost.sm',
            {
              type: 'button',
              title: L3('Remover', 'Remove', 'Entfernen'),
              onclick: async () => {
                if (
                  await ask(
                    L3(
                      'Remover “' + r.name + '”?',
                      'Remove “' + r.name + '”?',
                      '„' + r.name + '“ entfernen?'
                    ),
                    t('del')
                  )
                ) {
                  await Snd.removeLib(r.id);
                  draw();
                }
              },
            },
            '🗑'
          )
        );
      body.append(
        ...[
          h('div.sec-t', { style: { margin: '10px 0 6px' } }, '🎵 ' + L3('Músicas', 'Music', 'Musik')),
          music.length
            ? music.map(row)
            : h(
                'p.muted',
                { style: { fontSize: '.85em' } },
                L3('Nenhuma música ainda.', 'No music yet.', 'Noch keine Musik.')
              ),
          h('div.sec-t', { style: { margin: '14px 0 6px' } }, '🎧 ' + L3('Efeitos', 'Effects', 'Effekte')),
          sfx.length
            ? sfx.map(row)
            : h(
                'p.muted',
                { style: { fontSize: '.85em' } },
                L3('Nenhum efeito ainda.', 'No effects yet.', 'Noch keine Effekte.')
              ),
        ].flat()
      );
    }
    dock.replaceChildren(
      h(
        'div.snd-h',
        h('b', '🔊 ' + L3('Som da mesa', 'Table sound', 'Tischsound')),
        h('div.sp'),
        h(
          'button.btn.ghost.sm',
          {
            type: 'button',
            onclick: () => {
              Snd.init();
              Snd.setMuted(!Snd.muted);
              draw();
            },
            title: 'Mute',
          },
          Snd.muted ? '🔇' : '🔈'
        ),
        h(
          'button.btn.ghost.sm',
          { type: 'button', onclick: () => soundPanel(false), 'aria-label': t('close') },
          '✕'
        )
      ),
      h(
        'div.snd-np',
        Snd.amb || Snd.mus
          ? [
              Snd.amb ? h('span', AMB[Snd.amb.id].ic + ' ' + tr(AMB[Snd.amb.id].n)) : null,
              Snd.mus ? h('span', '🎵 ' + Snd.mus.name) : null,
              h(
                'button.btn.sm',
                {
                  type: 'button',
                  onclick: () => {
                    Snd.stopAll();
                    draw();
                  },
                },
                '■ ' + L3('Parar tudo', 'Stop all', 'Alles stoppen')
              ),
            ]
          : h('span.muted', L3('Nada tocando', 'Nothing playing', 'Nichts spielt'))
      ),
      h(
        'div.snd-mix',
        sl('master', L3('Geral', 'Master', 'Gesamt')),
        sl('music', L3('Música', 'Music', 'Musik')),
        sl('amb', L3('Ambiente', 'Ambience', 'Ambiente')),
        sl('sfx', L3('Efeitos', 'Effects', 'Effekte'))
      ),
      h(
        'label.snd-sl',
        {
          style: {
            padding: '6px 12px',
            flexDirection: 'row',
            gap: '8px',
            alignItems: 'center',
            fontSize: '.85em',
            color: 'var(--ink)',
          },
        },
        h('input', {
          type: 'checkbox',
          style: { width: 'auto' },
          checked: !!Store.data.prefs.rollSnd,
          onchange: e => {
            Store.data.prefs.rollSnd = e.target.checked;
            Store.save();
          },
        }),
        L3('Som ao rolar dados', 'Sound when rolling dice', 'Ton beim Würfeln')
      ),
      h(
        'div.snd-tabs',
        tabs.map(([k, l]) =>
          h(
            'button' + (SP.tab === k ? '.on' : ''),
            {
              type: 'button',
              onclick: () => {
                SP.tab = k;
                draw();
              },
            },
            l
          )
        )
      ),
      body
    );
  }
  draw();
  SP.redraw = draw;
}
Snd.on(() => {
  document.querySelectorAll('.snd-chip').forEach(c => c._upd && c._upd());
  if (SP.open && SP.redraw && $('#snddock') && !document.activeElement?.closest?.('#snddock input'))
    SP.redraw();
});

/* teclas 1–9 tocam os nove primeiros efeitos quando a Mesa ou a Mesa virtual estão abertas */
document.addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey || !/^[1-9]$/.test(e.key)) return;
  const tg = e.target;
  if ((tg && /^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName)) || (tg && tg.isContentEditable)) return;
  if (!document.querySelector('.gm-root') || document.querySelector('.ovl')) return;
  const id = Object.keys(SFX)[+e.key - 1];
  if (id) Snd.play(id);
});
