/* ---- cenários prontos (desenhados por código, sem arquivos) ---- */
const vRng = seed => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const vShade = (hex, d) => {
  const n = parseInt(hex.slice(1), 16),
    f = x => Math.max(0, Math.min(255, x + d));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
};
function vPlanks(g, w, h, R, ph, base, vary, seam, len) {
  for (let y = 0; y < h; y += ph) {
    let x = -R() * len;
    while (x < w) {
      const l = len * (0.6 + R() * 0.8),
        d = (R() - 0.5) * vary;
      g.fillStyle = vShade(base, d);
      g.fillRect(x, y, l, ph);
      g.strokeStyle = vShade(base, d - 22);
      g.globalAlpha = 0.3;
      g.lineWidth = 1;
      for (let k = 0; k < 3; k++) {
        const yy = y + R() * ph;
        g.beginPath();
        g.moveTo(x, yy);
        g.lineTo(x + l, yy + (R() - 0.5) * 5);
        g.stroke();
      }
      g.globalAlpha = 1;
      g.fillStyle = seam;
      g.fillRect(x, y, 2, ph);
      x += l;
    }
    g.fillStyle = seam;
    g.fillRect(0, y, w, 2);
  }
}
function vBlots(g, w, h, R, n, cols, rmin, rmax, a) {
  for (let i = 0; i < n; i++) {
    g.globalAlpha = a * (0.4 + R() * 0.6);
    g.fillStyle = cols[(R() * cols.length) | 0];
    g.beginPath();
    g.arc(R() * w, R() * h, rmin + R() * (rmax - rmin), 0, 7);
    g.fill();
  }
  g.globalAlpha = 1;
}
function vSpeck(g, w, h, R, n, cols, s) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = cols[(R() * cols.length) | 0];
    g.globalAlpha = 0.25 + R() * 0.5;
    g.fillRect(R() * w, R() * h, s * (0.5 + R()), s * (0.5 + R()));
  }
  g.globalAlpha = 1;
}
const BGS = {
  masmorra: {
    n: { pt: 'Masmorra', en: 'Dungeon', de: 'Verlies' },
    draw(g, w, h, R, u) {
      g.fillStyle = '#34343c';
      g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += u)
        for (let x = 0; x < w; x += u) {
          g.fillStyle = vShade('#3a3a43', (R() - 0.5) * 26);
          g.fillRect(x + 1, y + 1, u - 2, u - 2);
        }
      g.strokeStyle = 'rgba(0,0,0,.45)';
      g.lineWidth = 2;
      for (let y = 0; y <= h; y += u) {
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(w, y);
        g.stroke();
      }
      for (let x = 0; x <= w; x += u) {
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x, h);
        g.stroke();
      }
      vSpeck(g, w, h, R, (w * h) / 900, ['#000', '#fff', '#556'], 2);
      g.strokeStyle = 'rgba(0,0,0,.5)';
      g.lineWidth = 1.5;
      for (let i = 0; i < (w * h) / 60000; i++) {
        let x = R() * w,
          y = R() * h;
        g.beginPath();
        g.moveTo(x, y);
        for (let k = 0; k < 6; k++) {
          x += (R() - 0.5) * 26;
          y += (R() - 0.3) * 22;
          g.lineTo(x, y);
        }
        g.stroke();
      }
    },
  },
  taverna: {
    n: { pt: 'Taverna', en: 'Tavern', de: 'Taverne' },
    draw(g, w, h, R, u) {
      vPlanks(g, w, h, R, u * 0.5, '#6e4b2b', 34, '#2b1b0e', u * 4);
      vSpeck(g, w, h, R, (w * h) / 3000, ['#2b1b0e', '#a47a4a'], 2);
    },
  },
  floresta: {
    n: { pt: 'Floresta', en: 'Forest', de: 'Wald' },
    draw(g, w, h, R, u) {
      g.fillStyle = '#41703a';
      g.fillRect(0, 0, w, h);
      vBlots(g, w, h, R, (w * h) / 4000, ['#3a6633', '#4c7d43', '#35602f', '#5a8c4c'], 10, 50, 0.35);
      vSpeck(g, w, h, R, (w * h) / 400, ['#2c5026', '#6b9a58', '#e8e27a'], 2);
      g.strokeStyle = 'rgba(150,120,80,.55)';
      g.lineWidth = u * 0.9;
      g.lineCap = 'round';
      g.beginPath();
      let y = h * (0.3 + R() * 0.4);
      g.moveTo(-20, y);
      for (let x = 0; x < w + 80; x += 80) {
        y += (R() - 0.5) * u * 1.6;
        y = Math.max(u, Math.min(h - u, y));
        g.lineTo(x, y);
      }
      g.stroke();
      const n = Math.round((w * h) / (u * u) / 22);
      for (let i = 0; i < n; i++) {
        const x = R() * w,
          y2 = R() * h,
          r = u * (0.6 + R() * 0.7);
        g.fillStyle = 'rgba(0,0,0,.25)';
        g.beginPath();
        g.arc(x + 8, y2 + 10, r, 0, 7);
        g.fill();
        const gr = g.createRadialGradient(x - r * 0.3, y2 - r * 0.3, r * 0.1, x, y2, r);
        gr.addColorStop(0, '#4f8a43');
        gr.addColorStop(1, '#244b22');
        g.fillStyle = gr;
        g.beginPath();
        g.arc(x, y2, r, 0, 7);
        g.fill();
      }
    },
  },
  deserto: {
    n: { pt: 'Deserto', en: 'Desert', de: 'Wüste' },
    draw(g, w, h, R, u) {
      g.fillStyle = '#d7b56d';
      g.fillRect(0, 0, w, h);
      vBlots(g, w, h, R, (w * h) / 8000, ['#e2c47f', '#c9a55b', '#dcbb74'], 20, 90, 0.3);
      g.lineWidth = 2;
      for (let i = 0; i < h / 14; i++) {
        const y = R() * h;
        g.strokeStyle = R() < 0.5 ? 'rgba(255,240,200,.28)' : 'rgba(120,80,20,.2)';
        g.beginPath();
        g.moveTo(0, y);
        for (let x = 0; x <= w; x += 40) g.lineTo(x, y + Math.sin(x / 70 + i) * 7);
        g.stroke();
      }
      vSpeck(g, w, h, R, (w * h) / 1000, ['#9d7a3a', '#f3e1ae'], 2);
      for (let i = 0; i < (w * h) / 120000; i++) {
        const x = R() * w,
          y = R() * h,
          r = 10 + R() * 18;
        g.fillStyle = 'rgba(0,0,0,.2)';
        g.beginPath();
        g.ellipse(x + 5, y + 7, r, r * 0.7, 0, 0, 7);
        g.fill();
        g.fillStyle = '#8a7a66';
        g.beginPath();
        g.ellipse(x, y, r, r * 0.7, 0, 0, 7);
        g.fill();
      }
    },
  },
  conves: {
    n: { pt: 'Convés de navio', en: 'Ship deck', de: 'Schiffsdeck' },
    draw(g, w, h, R, u) {
      vPlanks(g, w, h, R, u * 0.45, '#7b5a3a', 30, '#2a1a0c', u * 6);
      g.fillStyle = '#2a1a0c';
      for (let y = u * 0.22; y < h; y += u * 0.45)
        for (let x = u * 0.5; x < w; x += u * 3) {
          if (R() < 0.5) {
            g.beginPath();
            g.arc(x, y, 2.2, 0, 7);
            g.fill();
          }
        }
      for (let i = 0; i < (w * h) / 300000; i++) {
        const x = R() * w,
          y = R() * h;
        g.strokeStyle = '#c9b27a';
        g.lineWidth = 6;
        for (let k = 1; k < 4; k++) {
          g.beginPath();
          g.arc(x, y, k * 9, 0, 7);
          g.stroke();
        }
      }
    },
  },
  mar: {
    n: { pt: 'Mar aberto', en: 'Open sea', de: 'Offenes Meer' },
    draw(g, w, h, R, u) {
      const gr = g.createLinearGradient(0, 0, w, h);
      gr.addColorStop(0, '#0b4a78');
      gr.addColorStop(1, '#1a86b0');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
      vBlots(g, w, h, R, (w * h) / 9000, ['#0a3c66', '#2a9cc6'], 20, 80, 0.18);
      g.lineWidth = 2;
      for (let i = 0; i < (w * h) / 2500; i++) {
        const x = R() * w,
          y = R() * h,
          r = 8 + R() * 14;
        g.strokeStyle = `rgba(255,255,255,${0.12 + R() * 0.2})`;
        g.beginPath();
        g.arc(x, y, r, Math.PI * 1.15, Math.PI * 1.85);
        g.stroke();
      }
    },
  },
  neve: {
    n: { pt: 'Neve', en: 'Snow', de: 'Schnee' },
    draw(g, w, h, R, u) {
      g.fillStyle = '#e8f0f6';
      g.fillRect(0, 0, w, h);
      vBlots(g, w, h, R, (w * h) / 5000, ['#d3e3f0', '#ffffff', '#c3d8e8'], 14, 70, 0.5);
      vSpeck(g, w, h, R, (w * h) / 500, ['#ffffff', '#9fc0da'], 2);
      for (let i = 0; i < (w * h) / 150000; i++) {
        const x = R() * w,
          y = R() * h,
          r = 12 + R() * 16;
        g.fillStyle = 'rgba(0,0,0,.14)';
        g.beginPath();
        g.ellipse(x + 4, y + 6, r, r * 0.7, 0, 0, 7);
        g.fill();
        g.fillStyle = '#9aa7b3';
        g.beginPath();
        g.ellipse(x, y, r, r * 0.7, 0, 0, 7);
        g.fill();
        g.fillStyle = '#f4f8fb';
        g.beginPath();
        g.ellipse(x - 2, y - 4, r * 0.7, r * 0.35, 0, 0, 7);
        g.fill();
      }
    },
  },
  caverna: {
    n: { pt: 'Caverna', en: 'Cave', de: 'Höhle' },
    draw(g, w, h, R, u) {
      g.fillStyle = '#2a2622';
      g.fillRect(0, 0, w, h);
      vBlots(g, w, h, R, (w * h) / 3000, ['#1c1916', '#38322c', '#2f2a25'], 12, 70, 0.5);
      vSpeck(g, w, h, R, (w * h) / 600, ['#000', '#6b6258'], 2);
      for (let i = 0; i < (w * h) / 90000; i++) {
        const x = R() * w,
          y = R() * h,
          c = ['#4de1d0', '#a77cff', '#5ab0ff'][(R() * 3) | 0];
        g.shadowColor = c;
        g.shadowBlur = 24;
        g.fillStyle = c;
        for (let k = 0; k < 3; k++) {
          g.beginPath();
          const bx = x + k * 9,
            bh = 14 + R() * 20;
          g.moveTo(bx, y);
          g.lineTo(bx + 5, y - bh);
          g.lineTo(bx + 10, y);
          g.fill();
        }
        g.shadowBlur = 0;
      }
    },
  },
  cidade: {
    n: { pt: 'Rua de pedras', en: 'Cobblestone', de: 'Kopfsteinpflaster' },
    draw(g, w, h, R, u) {
      g.fillStyle = '#4a463f';
      g.fillRect(0, 0, w, h);
      const sh = u / 3.2;
      let row = 0;
      for (let y = 0; y < h; y += sh, row++) {
        let x = -(row % 2) * sh;
        while (x < w) {
          const sw = sh * (1.1 + R() * 0.7);
          g.fillStyle = vShade('#78726a', (R() - 0.5) * 34);
          g.beginPath();
          g.roundRect ? g.roundRect(x + 2, y + 2, sw - 4, sh - 4, 7) : g.rect(x + 2, y + 2, sw - 4, sh - 4);
          g.fill();
          x += sw;
        }
      }
      vSpeck(g, w, h, R, (w * h) / 1800, ['#2c2824', '#a29a8e'], 2);
    },
  },
  vulcao: {
    n: { pt: 'Vulcão', en: 'Volcano', de: 'Vulkan' },
    draw(g, w, h, R, u) {
      g.fillStyle = '#241513';
      g.fillRect(0, 0, w, h);
      vBlots(g, w, h, R, (w * h) / 3500, ['#1a0e0c', '#3a2420', '#2d1a17'], 12, 70, 0.6);
      for (let i = 0; i < (w * h) / 80000; i++) {
        let x = R() * w,
          y = R() * h;
        const pts = [[x, y]];
        for (let k = 0; k < 12; k++) {
          x += (R() - 0.5) * 70;
          y += (R() - 0.5) * 60;
          pts.push([x, y]);
        }
        [
          [10, '#ff3d00', 22, 0.7],
          [4, '#ff8a1f', 10, 1],
          [1.5, '#ffe08a', 0, 1],
        ].forEach(([lw, c, sb, a]) => {
          g.save();
          g.lineJoin = 'round';
          g.lineWidth = lw;
          g.strokeStyle = c;
          g.shadowColor = '#ff3d00';
          g.shadowBlur = sb;
          g.globalAlpha = a;
          g.beginPath();
          pts.forEach((p, j) => (j ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
          g.stroke();
          g.restore();
        });
      }
    },
  },
  espaco: {
    n: { pt: 'Espaço', en: 'Space', de: 'Weltraum' },
    draw(g, w, h, R, u) {
      const gr = g.createLinearGradient(0, 0, w, h);
      gr.addColorStop(0, '#04050d');
      gr.addColorStop(1, '#0d0a28');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
      ['#5a2d9c', '#1d4f9c', '#9c2d6a'].forEach(c => {
        for (let i = 0; i < 2; i++) {
          const x = R() * w,
            y = R() * h,
            r = Math.min(w, h) * (0.25 + R() * 0.3),
            rg = g.createRadialGradient(x, y, 0, x, y, r);
          rg.addColorStop(0, c + '55');
          rg.addColorStop(1, c + '00');
          g.fillStyle = rg;
          g.fillRect(0, 0, w, h);
        }
      });
      for (let i = 0; i < (w * h) / 700; i++) {
        g.fillStyle = `rgba(255,255,255,${0.2 + R() * 0.8})`;
        const s = R() < 0.96 ? 1.2 : 2.4;
        g.fillRect(R() * w, R() * h, s, s);
      }
      for (let i = 0; i < 14; i++) {
        const x = R() * w,
          y = R() * h;
        g.shadowColor = '#fff';
        g.shadowBlur = 14;
        g.fillStyle = '#fff';
        g.beginPath();
        g.arc(x, y, 1.8, 0, 7);
        g.fill();
        g.shadowBlur = 0;
      }
    },
  },
  pergaminho: {
    n: { pt: 'Pergaminho', en: 'Parchment', de: 'Pergament' },
    draw(g, w, h, R, u) {
      g.fillStyle = '#d9c08f';
      g.fillRect(0, 0, w, h);
      vBlots(g, w, h, R, (w * h) / 4500, ['#c9ac74', '#e4cf9f', '#bf9f66'], 20, 90, 0.3);
      vSpeck(g, w, h, R, (w * h) / 900, ['#8a6b3a', '#f2e2b8'], 1.5);
      const gr = g.createRadialGradient(
        w / 2,
        h / 2,
        Math.min(w, h) * 0.35,
        w / 2,
        h / 2,
        Math.max(w, h) * 0.75
      );
      gr.addColorStop(0, 'rgba(90,50,10,0)');
      gr.addColorStop(1, 'rgba(90,50,10,.5)');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
    },
  },
};
const BG_ORDER = [
  'masmorra',
  'taverna',
  'floresta',
  'deserto',
  'conves',
  'mar',
  'neve',
  'caverna',
  'cidade',
  'vulcao',
  'espaco',
  'pergaminho',
];
const vCache = { base: {}, comp: {}, img: {}, thumb: {} };
function vMapSize(sc) {
  vNormalizeSceneSize(sc);
  const u = sc.cell || 64;
  return { w: sc.cols * u, h: sc.rows * u, cols: sc.cols, rows: sc.rows };
}
function vBgBase(sc, onload) {
  const m = vMapSize(sc),
    bg = sc.bg;
  if (bg.kind === 'img') {
    const hit = vCache.img[bg.imgId];
    if (hit) return hit === 'x' ? null : hit;
    vCache.img[bg.imgId] = 'x';
    DB.get('img', bg.imgId)
      .then(r => (r ? vLoadImg(URL.createObjectURL(r.blob)) : null))
      .then(i => {
        vCache.img[bg.imgId] = i || 'x';
        onload && onload();
      });
    return null;
  }
  const key = [bg.kind, bg.preset, bg.color, m.w, m.h, sc.cell, sc.id].join('|');
  if (vCache.base[key]) return vCache.base[key];
  const c = document.createElement('canvas');
  c.width = m.w;
  c.height = m.h;
  const g = c.getContext('2d');
  if (bg.kind === 'color') {
    g.fillStyle = bg.color || '#2b2f3a';
    g.fillRect(0, 0, m.w, m.h);
  } else
    (BGS[bg.preset] || BGS.masmorra).draw(
      g,
      m.w,
      m.h,
      vRng(parseInt(hash(sc.id + bg.preset), 36) | 0),
      sc.cell || 64
    );
  return (vCache.base[key] = c);
}
function vBgFinal(sc, onload) {
  const base = vBgBase(sc, onload);
  if (!base) return null;
  const bg = sc.bg,
    m = vMapSize(sc);
  const key = [
    bg.kind,
    bg.preset,
    bg.color,
    bg.imgId,
    bg.tint,
    bg.tintA,
    bg.dark,
    m.w,
    m.h,
    sc.cell,
    sc.id,
  ].join('|');
  if (vCache.comp[key]) return vCache.comp[key];
  if (!(bg.tint && bg.tintA > 0) && !(bg.dark > 0)) {
    vCache.comp = { [key]: base };
    return base;
  }
  const c = document.createElement('canvas');
  c.width = m.w;
  c.height = m.h;
  const g = c.getContext('2d');
  g.drawImage(base, 0, 0, m.w, m.h);
  if (bg.tint && bg.tintA > 0) {
    g.globalCompositeOperation = 'color';
    g.globalAlpha = bg.tintA;
    g.fillStyle = bg.tint;
    g.fillRect(0, 0, m.w, m.h);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
  }
  if (bg.dark > 0) {
    g.fillStyle = `rgba(4,6,20,${bg.dark})`;
    g.fillRect(0, 0, m.w, m.h);
  }
  vCache.comp = { [key]: c };
  return c;
}
function vThumb(id) {
  if (vCache.thumb[id]) return vCache.thumb[id];
  const c = document.createElement('canvas');
  c.width = 220;
  c.height = 140;
  const g = c.getContext('2d'),
    B = document.createElement('canvas');
  B.width = 440;
  B.height = 280;
  BGS[id].draw(B.getContext('2d'), 440, 280, vRng(7), 48);
  g.drawImage(B, 0, 0, 220, 140);
  return (vCache.thumb[id] = c);
}
