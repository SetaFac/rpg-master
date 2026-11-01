/* ===== RPG Master — terreno e obstáculos da Mesa virtual (desenhados por código) ===== */
const vH = (x, y, i) => {
  const s = Math.sin(x * 127.1 + y * 311.7 + i * 74.7) * 43758.5453;
  return s - Math.floor(s);
};
function vLiquid(g, px, py, u, tm, same, x, y, c) {
  g.fillStyle = c.base;
  g.fillRect(px - 0.5, py - 0.5, u + 1, u + 1);
  if (c.glow) {
    g.fillStyle = `rgba(255,150,50,${0.14 + 0.12 * Math.sin(tm * 2 + x + y)})`;
    g.fillRect(px, py, u, u);
  }
  g.lineWidth = Math.max(1.2, u * 0.03);
  for (let i = 0; i < 3; i++) {
    const yy = py + ((i * 0.34 + tm * 0.07 * (c.speed || 1) + vH(x, y, i)) % 1) * u;
    g.strokeStyle = c.hi;
    g.globalAlpha = 0.38;
    g.beginPath();
    for (let k = 0; k <= 6; k++) {
      const xx = px + (k * u) / 6,
        yv = yy + Math.sin(k * 1.05 + tm * 1.6 + i) * u * 0.045;
      k ? g.lineTo(xx, yv) : g.moveTo(xx, yv);
    }
    g.stroke();
  }
  g.globalAlpha = 1;
  if (c.bubbles)
    for (let i = 0; i < 3; i++) {
      const ph = (tm * 0.35 + vH(x, y, i + 5)) % 1;
      g.fillStyle = c.hi;
      g.globalAlpha = (1 - ph) * 0.7;
      g.beginPath();
      g.arc(px + vH(x, y, i + 9) * u, py + u - ph * u, u * (0.04 + 0.04 * vH(x, y, i + 3)), 0, 7);
      g.fill();
    }
  g.globalAlpha = 1;
  g.lineWidth = u * 0.07;
  g.lineCap = 'round';
  [
    [0, -1, px, py, px + u, py],
    [0, 1, px, py + u, px + u, py + u],
    [-1, 0, px, py, px, py + u],
    [1, 0, px + u, py, px + u, py + u],
  ].forEach(([dx, dy, a, b, c2, d]) => {
    if (!same(dx, dy)) {
      g.strokeStyle = c.lo;
      g.globalAlpha = 0.75;
      g.beginPath();
      g.moveTo(a, b);
      g.lineTo(c2, d);
      g.stroke();
      g.strokeStyle = c.hi;
      g.globalAlpha = 0.35;
      g.lineWidth = u * 0.025;
      g.beginPath();
      g.moveTo(a + dy * u * 0.06 + dx * -u * 0.06, b + dx * u * 0.06 + dy * -u * 0.06);
      g.lineTo(c2 + dy * u * 0.06 + dx * -u * 0.06, d + dx * u * 0.06 + dy * -u * 0.06);
      g.stroke();
      g.lineWidth = u * 0.07;
      g.globalAlpha = 1;
    }
  });
}
const TERR = {
  agua: {
    ic: '🌊',
    anim: 1,
    n: { pt: 'Água', en: 'Water', de: 'Wasser' },
    col: '#2f8fd0',
    f: (g, px, py, u, tm, same, x, y) =>
      vLiquid(g, px, py, u, tm, same, x, y, { base: '#2f8fd0', hi: '#d8f2ff', lo: '#1b5f93' }),
  },
  profunda: {
    ic: '🌀',
    anim: 1,
    n: { pt: 'Água funda', en: 'Deep water', de: 'Tiefes Wasser' },
    col: '#14507f',
    f: (g, px, py, u, tm, same, x, y) =>
      vLiquid(g, px, py, u, tm, same, x, y, { base: '#14507f', hi: '#7fc3ea', lo: '#082c47', speed: 0.7 }),
  },
  lava: {
    ic: '🌋',
    anim: 1,
    n: { pt: 'Lava', en: 'Lava', de: 'Lava' },
    col: '#d6420f',
    f: (g, px, py, u, tm, same, x, y) =>
      vLiquid(g, px, py, u, tm, same, x, y, {
        base: '#d6420f',
        hi: '#ffd27a',
        lo: '#4a1004',
        glow: 1,
        speed: 0.5,
      }),
  },
  acido: {
    ic: '☣',
    anim: 1,
    n: { pt: 'Ácido', en: 'Acid', de: 'Säure' },
    col: '#6bc92b',
    f: (g, px, py, u, tm, same, x, y) =>
      vLiquid(g, px, py, u, tm, same, x, y, {
        base: '#6bc92b',
        hi: '#e3ff9a',
        lo: '#2a5c0c',
        bubbles: 1,
        speed: 0.6,
      }),
  },
  lama: {
    ic: '🟤',
    n: { pt: 'Lama / pântano', en: 'Mud / swamp', de: 'Schlamm / Sumpf' },
    col: '#6b5233',
    f: (g, px, py, u, tm, same, x, y) => {
      g.fillStyle = '#6b5233';
      g.fillRect(px - 0.5, py - 0.5, u + 1, u + 1);
      for (let i = 0; i < 6; i++) {
        g.fillStyle = i % 2 ? '#523d24' : '#7d6240';
        g.globalAlpha = 0.6;
        g.beginPath();
        g.arc(px + vH(x, y, i) * u, py + vH(x, y, i + 20) * u, u * (0.08 + 0.12 * vH(x, y, i + 40)), 0, 7);
        g.fill();
      }
      g.globalAlpha = 1;
    },
  },
  gelo: {
    ic: '🧊',
    n: { pt: 'Gelo', en: 'Ice', de: 'Eis' },
    col: '#cfeaf6',
    f: (g, px, py, u, tm, same, x, y) => {
      g.fillStyle = '#cfeaf6';
      g.fillRect(px - 0.5, py - 0.5, u + 1, u + 1);
      g.strokeStyle = 'rgba(80,140,180,.55)';
      g.lineWidth = 1.4;
      g.beginPath();
      let cx = px + vH(x, y, 1) * u,
        cy = py + vH(x, y, 2) * u;
      g.moveTo(cx, cy);
      for (let i = 0; i < 4; i++) {
        cx += (vH(x, y, i + 3) - 0.5) * u * 0.8;
        cy += (vH(x, y, i + 8) - 0.5) * u * 0.8;
        g.lineTo(cx, cy);
      }
      g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.85)';
      g.lineWidth = u * 0.05;
      g.beginPath();
      g.moveTo(px + u * 0.15, py + u * 0.8);
      g.lineTo(px + u * 0.45, py + u * 0.5);
      g.stroke();
    },
  },
  abismo: {
    ic: '⬛',
    n: { pt: 'Abismo / buraco', en: 'Pit / chasm', de: 'Abgrund' },
    col: '#050509',
    f: (g, px, py, u, tm, same) => {
      const gr = g.createRadialGradient(px + u / 2, py + u / 2, u * 0.1, px + u / 2, py + u / 2, u * 0.8);
      gr.addColorStop(0, '#000');
      gr.addColorStop(1, '#14141c');
      g.fillStyle = gr;
      g.fillRect(px - 0.5, py - 0.5, u + 1, u + 1);
      g.fillStyle = 'rgba(0,0,0,.5)';
      [
        [0, -1, px, py, u, u * 0.14],
        [-1, 0, px, py, u * 0.14, u],
      ].forEach(([dx, dy, a, b, w, h2]) => {
        if (!same(dx, dy)) g.fillRect(a, b, w, h2);
      });
    },
  },
  fogo: {
    ic: '🔥',
    anim: 1,
    n: { pt: 'Fogo', en: 'Fire', de: 'Feuer' },
    col: '#ff7a1a',
    f: (g, px, py, u, tm, same, x, y) => {
      g.fillStyle = 'rgba(255,90,20,.35)';
      g.fillRect(px, py, u, u);
      for (let i = 0; i < 3; i++) {
        const fx = px + u * (0.22 + i * 0.28 + (vH(x, y, i) - 0.5) * 0.1),
          hh = u * (0.55 + 0.25 * Math.sin(tm * 7 + i * 2 + x * 3 + y)),
          bw = u * 0.17;
        [
          ['#ff5a14', 1],
          ['#ffb02e', 0.65],
          ['#fff1a6', 0.35],
        ].forEach(([c, k]) => {
          g.fillStyle = c;
          g.beginPath();
          g.moveTo(fx - bw * k, py + u * 0.92);
          g.quadraticCurveTo(fx - bw * k, py + u * 0.92 - hh * k * 0.6, fx, py + u * 0.92 - hh * k);
          g.quadraticCurveTo(fx + bw * k, py + u * 0.92 - hh * k * 0.6, fx + bw * k, py + u * 0.92);
          g.fill();
        });
      }
    },
  },
  areia: {
    ic: '🏖',
    n: { pt: 'Areia', en: 'Sand', de: 'Sand' },
    col: '#d9bf7e',
    f: (g, px, py, u, tm, same, x, y) => {
      g.fillStyle = '#d9bf7e';
      g.fillRect(px - 0.5, py - 0.5, u + 1, u + 1);
      for (let i = 0; i < 22; i++) {
        g.fillStyle = i % 3 ? '#c4a661' : '#efdca4';
        g.globalAlpha = 0.6;
        g.fillRect(px + vH(x, y, i) * u, py + vH(x, y, i + 30) * u, 2, 2);
      }
      g.globalAlpha = 1;
      g.strokeStyle = 'rgba(150,110,50,.25)';
      g.lineWidth = 1.5;
      g.beginPath();
      const yy = py + vH(x, y, 70) * u;
      g.moveTo(px, yy);
      g.quadraticCurveTo(px + u / 2, yy + u * 0.12, px + u, yy);
      g.stroke();
    },
  },
  grama: {
    ic: '🌱',
    n: { pt: 'Grama', en: 'Grass', de: 'Gras' },
    col: '#4c8a3e',
    f: (g, px, py, u, tm, same, x, y) => {
      g.fillStyle = '#4c8a3e';
      g.fillRect(px - 0.5, py - 0.5, u + 1, u + 1);
      g.strokeStyle = '#6fb55a';
      g.lineWidth = 1.6;
      for (let i = 0; i < 9; i++) {
        const gx = px + vH(x, y, i) * u,
          gy = py + u * (0.2 + 0.7 * vH(x, y, i + 9));
        g.beginPath();
        g.moveTo(gx, gy);
        g.lineTo(gx - 2, gy - u * 0.12);
        g.moveTo(gx, gy);
        g.lineTo(gx + 2, gy - u * 0.1);
        g.stroke();
      }
      g.fillStyle = 'rgba(20,60,15,.25)';
      g.beginPath();
      g.arc(px + vH(x, y, 40) * u, py + vH(x, y, 41) * u, u * 0.22, 0, 7);
      g.fill();
    },
  },
  madeira: {
    ic: '🪵',
    n: { pt: 'Piso de madeira', en: 'Wood floor', de: 'Holzboden' },
    col: '#8a5e33',
    f: (g, px, py, u, tm, same, x, y) => {
      g.fillStyle = '#8a5e33';
      g.fillRect(px - 0.5, py - 0.5, u + 1, u + 1);
      const ph = u / 3;
      for (let i = 0; i < 3; i++) {
        g.fillStyle = `rgba(${60 + vH(x, y, i) * 50},30,10,.22)`;
        g.fillRect(px, py + i * ph, u, ph);
        g.fillStyle = 'rgba(0,0,0,.45)';
        g.fillRect(px, py + i * ph, u, 1.6);
        g.fillRect(px + vH(x, y, i + 5) * u, py + i * ph, 1.6, ph);
      }
    },
  },
  ponte: {
    ic: '🌉',
    n: { pt: 'Ponte', en: 'Bridge', de: 'Brücke' },
    col: '#9a7140',
    f: (g, px, py, u, tm, same, x, y) => {
      g.fillStyle = '#9a7140';
      g.fillRect(px - 0.5, py - 0.5, u + 1, u + 1);
      const horiz = same(-1, 0) || same(1, 0) || !(same(0, -1) || same(0, 1));
      g.strokeStyle = 'rgba(0,0,0,.5)';
      g.lineWidth = 2;
      for (let i = 1; i < 5; i++) {
        g.beginPath();
        if (horiz) {
          g.moveTo(px + (i * u) / 5, py);
          g.lineTo(px + (i * u) / 5, py + u);
        } else {
          g.moveTo(px, py + (i * u) / 5);
          g.lineTo(px + u, py + (i * u) / 5);
        }
        g.stroke();
      }
      g.fillStyle = '#4e3418';
      if (horiz) {
        g.fillRect(px, py, u, u * 0.09);
        g.fillRect(px, py + u * 0.91, u, u * 0.09);
      } else {
        g.fillRect(px, py, u * 0.09, u);
        g.fillRect(px + u * 0.91, py, u * 0.09, u);
      }
    },
  },
  tapete: {
    ic: '🟥',
    n: { pt: 'Tapete', en: 'Carpet', de: 'Teppich' },
    col: '#9b2335',
    f: (g, px, py, u, tm, same, x, y) => {
      g.fillStyle = '#9b2335';
      g.fillRect(px - 0.5, py - 0.5, u + 1, u + 1);
      g.fillStyle = '#d9b44a';
      const b = u * 0.07;
      if (!same(0, -1)) g.fillRect(px, py, u, b);
      if (!same(0, 1)) g.fillRect(px, py + u - b, u, b);
      if (!same(-1, 0)) g.fillRect(px, py, b, u);
      if (!same(1, 0)) g.fillRect(px + u - b, py, b, u);
      g.strokeStyle = 'rgba(217,180,74,.35)';
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(px + u / 2, py + u * 0.2);
      g.lineTo(px + u * 0.8, py + u / 2);
      g.lineTo(px + u / 2, py + u * 0.8);
      g.lineTo(px + u * 0.2, py + u / 2);
      g.closePath();
      g.stroke();
    },
  },
  piso: {
    ic: '⬜',
    n: { pt: 'Piso de pedra', en: 'Stone floor', de: 'Steinboden' },
    col: '#8d8a84',
    f: (g, px, py, u, tm, same, x, y) => {
      g.fillStyle = '#8d8a84';
      g.fillRect(px - 0.5, py - 0.5, u + 1, u + 1);
      for (let i = 0; i < 4; i++) {
        g.fillStyle = `rgba(${vH(x, y, i) > 0.5 ? '255,255,255' : '0,0,0'},.08)`;
        g.fillRect(px + ((i % 2) * u) / 2, py + (Math.floor(i / 2) * u) / 2, u / 2, u / 2);
      }
      g.strokeStyle = 'rgba(0,0,0,.4)';
      g.lineWidth = 1.5;
      g.strokeRect(px + 1, py + 1, u - 2, u - 2);
      g.beginPath();
      g.moveTo(px + u / 2, py);
      g.lineTo(px + u / 2, py + u);
      g.moveTo(px, py + u / 2);
      g.lineTo(px + u, py + u / 2);
      g.stroke();
    },
  },
  gas: {
    ic: '☠',
    anim: 1,
    n: { pt: 'Gás venenoso', en: 'Poison gas', de: 'Giftgas' },
    col: '#8bc34a',
    f: (g, px, py, u, tm, same, x, y) => {
      for (let i = 0; i < 4; i++) {
        const cx = px + u * (0.2 + 0.6 * vH(x, y, i)) + Math.sin(tm * 0.8 + i * 2) * u * 0.1,
          cy = py + u * (0.2 + 0.6 * vH(x, y, i + 9)) + Math.cos(tm * 0.7 + i) * u * 0.08,
          r = u * (0.4 + 0.15 * vH(x, y, i + 3)),
          gr = g.createRadialGradient(cx, cy, 2, cx, cy, r);
        gr.addColorStop(0, 'rgba(150,215,70,.65)');
        gr.addColorStop(1, 'rgba(110,190,60,0)');
        g.fillStyle = gr;
        g.beginPath();
        g.arc(cx, cy, r, 0, 7);
        g.fill();
      }
    },
  },
  espinhos: {
    ic: '🌵',
    n: { pt: 'Espinhos', en: 'Spikes', de: 'Stacheln' },
    col: '#777',
    f: (g, px, py, u, tm, same, x, y) => {
      g.fillStyle = 'rgba(40,35,30,.7)';
      g.fillRect(px, py, u, u);
      g.fillStyle = '#c4c8cc';
      for (let i = 0; i < 4; i++)
        for (let j = 0; j < 4; j++) {
          const sx = px + ((i + 0.5) * u) / 4,
            sy = py + ((j + 0.5) * u) / 4,
            k = u / 16;
          g.beginPath();
          g.moveTo(sx - k, sy + k);
          g.lineTo(sx, sy - k * 1.4);
          g.lineTo(sx + k, sy + k);
          g.fill();
        }
    },
  },
  parede: {
    ic: '🧱',
    n: { pt: 'Parede', en: 'Wall', de: 'Wand' },
    col: '#5d5a56',
    f: (g, px, py, u, tm, same, x, y) => {
      g.fillStyle = '#55524e';
      g.fillRect(px - 0.5, py - 0.5, u + 1, u + 1);
      g.strokeStyle = 'rgba(0,0,0,.4)';
      g.lineWidth = 1.5;
      const rh = u / 3;
      for (let r = 0; r < 3; r++) {
        const yy = py + r * rh;
        g.beginPath();
        g.moveTo(px, yy);
        g.lineTo(px + u, yy);
        g.stroke();
        const off = (r + x + y) % 2 ? u * 0.5 : u * 0.25;
        for (let c = off; c < u; c += u * 0.5) {
          g.beginPath();
          g.moveTo(px + c, yy);
          g.lineTo(px + c, yy + rh);
          g.stroke();
        }
        if (vH(x, y, r) < 0.5) {
          g.fillStyle = 'rgba(255,255,255,.07)';
          g.fillRect(px + 2, yy + 2, u * 0.45, rh - 3);
        }
      }
      const b = u * 0.09;
      g.fillStyle = 'rgba(255,255,255,.28)';
      if (!same(0, -1)) g.fillRect(px, py, u, b);
      if (!same(-1, 0)) g.fillRect(px, py, b, u);
      g.fillStyle = 'rgba(0,0,0,.4)';
      if (!same(0, 1)) g.fillRect(px, py + u - b, u, b);
      if (!same(1, 0)) g.fillRect(px + u - b, py, b, u);
      if (!same(0, 1)) {
        const sh = g.createLinearGradient(0, py + u, 0, py + u * 1.3);
        sh.addColorStop(0, 'rgba(0,0,0,.4)');
        sh.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = sh;
        g.fillRect(px, py + u, u, u * 0.3);
      }
    },
  },
  nuvem: {
    ic: '☁',
    anim: 1,
    n: { pt: 'Nuvem / névoa', en: 'Cloud / mist', de: 'Wolke / Nebel' },
    col: '#f4f7fb',
    f: (g, px, py, u, tm, same, x, y) => {
      for (let i = 0; i < 5; i++) {
        const cx = px + u * (0.15 + 0.7 * vH(x, y, i)) + Math.sin(tm * 0.4 + i + x) * u * 0.05,
          cy = py + u * (0.15 + 0.7 * vH(x, y, i + 11)),
          r = u * (0.32 + 0.2 * vH(x, y, i + 22)),
          gr = g.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
        gr.addColorStop(0, 'rgba(255,255,255,.92)');
        gr.addColorStop(0.6, 'rgba(236,242,250,.75)');
        gr.addColorStop(1, 'rgba(225,235,246,0)');
        g.fillStyle = gr;
        g.beginPath();
        g.arc(cx, cy, r, 0, 7);
        g.fill();
      }
    },
  },
  arbusto: {
    ic: '🌿',
    n: { pt: 'Arbusto / mato', en: 'Bushes / brush', de: 'Gebüsch' },
    col: '#2f6b2c',
    f: (g, px, py, u, tm, same, x, y) => {
      g.fillStyle = 'rgba(20,50,18,.45)';
      g.fillRect(px, py, u, u);
      for (let i = 0; i < 6; i++) {
        const cx = px + u * (0.1 + 0.8 * vH(x, y, i)),
          cy = py + u * (0.1 + 0.8 * vH(x, y, i + 13)),
          r = u * (0.2 + 0.14 * vH(x, y, i + 26));
        g.fillStyle = 'rgba(0,0,0,.28)';
        g.beginPath();
        g.arc(cx + 2, cy + 3, r, 0, 7);
        g.fill();
        const gr = g.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
        gr.addColorStop(0, '#6fae52');
        gr.addColorStop(1, '#2a5e27');
        g.fillStyle = gr;
        g.beginPath();
        g.arc(cx, cy, r, 0, 7);
        g.fill();
      }
    },
  },
};
const TERR_ORDER = [
  'parede',
  'agua',
  'profunda',
  'lava',
  'acido',
  'fogo',
  'nuvem',
  'gas',
  'arbusto',
  'grama',
  'areia',
  'gelo',
  'lama',
  'abismo',
  'espinhos',
  'piso',
  'madeira',
  'ponte',
  'tapete',
];

/* objetos arrastáveis: s = tamanho padrão em casas */
const PROPS = {
  pedra: { ic: '🪨', s: 1, n: { pt: 'Pedra', en: 'Boulder', de: 'Felsen' } },
  arbusto: { ic: '🌳', s: 1, n: { pt: 'Arbusto', en: 'Bush', de: 'Busch' } },
  arvore: { ic: '🌲', s: 2, n: { pt: 'Árvore', en: 'Tree', de: 'Baum' } },
  caixa: { ic: '📦', s: 1, n: { pt: 'Caixote', en: 'Crate', de: 'Kiste' } },
  barril: { ic: '🛢', s: 1, n: { pt: 'Barril', en: 'Barrel', de: 'Fass' } },
  bau: { ic: '🧰', s: 1, n: { pt: 'Baú', en: 'Chest', de: 'Truhe' } },
  coluna: { ic: '🏛', s: 1, n: { pt: 'Coluna', en: 'Pillar', de: 'Säule' } },
  mesa: { ic: '🪑', s: 2, n: { pt: 'Mesa', en: 'Table', de: 'Tisch' } },
  porta: { ic: '🚪', s: 1, n: { pt: 'Porta', en: 'Door', de: 'Tür' } },
  tocha: { ic: '🔦', s: 1, anim: 1, n: { pt: 'Tocha', en: 'Torch', de: 'Fackel' } },
  tenda: { ic: '⛺', s: 2, n: { pt: 'Tenda', en: 'Tent', de: 'Zelt' } },
  cama: { ic: '🛏', s: 2, n: { pt: 'Cama', en: 'Bed', de: 'Bett' } },
  estante: { ic: '📚', s: 2, n: { pt: 'Estante', en: 'Bookshelf', de: 'Regal' } },
  poco: { ic: '⛲', s: 1, n: { pt: 'Poço', en: 'Well', de: 'Brunnen' } },
  cadeira: { ic: '💺', s: 1, n: { pt: 'Cadeira', en: 'Chair', de: 'Stuhl' } },
  cerca: { ic: '🚧', s: 2, n: { pt: 'Cerca', en: 'Fence', de: 'Zaun' } },
  ossos: { ic: '🦴', s: 1, n: { pt: 'Ossos', en: 'Bones', de: 'Knochen' } },
  vaso: { ic: '🏺', s: 1, n: { pt: 'Vaso', en: 'Vase', de: 'Vase' } },
  altar: { ic: '🕯', s: 2, n: { pt: 'Altar', en: 'Altar', de: 'Altar' } },
  bandeira: { ic: '🚩', s: 1, n: { pt: 'Bandeira', en: 'Flag', de: 'Flagge' } },
  escada: { ic: '🪜', s: 1, n: { pt: 'Escada', en: 'Stairs', de: 'Treppe' } },
  barco: { ic: '⛵', s: 3, n: { pt: 'Barco', en: 'Boat', de: 'Boot' } },
  cristal: { ic: '💎', s: 1, anim: 1, n: { pt: 'Cristal', en: 'Crystal', de: 'Kristall' } },
  tronco: { ic: '🪵', s: 2, n: { pt: 'Tronco', en: 'Log', de: 'Baumstamm' } },
  lapide: { ic: '🪦', s: 1, n: { pt: 'Lápide', en: 'Tombstone', de: 'Grabstein' } },
  portao: { ic: '⛓', s: 2, n: { pt: 'Portão / grade', en: 'Gate / grate', de: 'Tor / Gitter' } },
  cogumelo: { ic: '🍄', s: 1, n: { pt: 'Cogumelo', en: 'Mushroom', de: 'Pilz' } },
  fogueira: { ic: '🔥', s: 1, anim: 1, n: { pt: 'Fogueira', en: 'Campfire', de: 'Lagerfeuer' } },
  estatua: { ic: '🗿', s: 1, n: { pt: 'Estátua', en: 'Statue', de: 'Statue' } },
  armadilha: { ic: '⚠', s: 1, n: { pt: 'Armadilha', en: 'Trap', de: 'Falle' } },
};
const PROP_ORDER = Object.keys(PROPS);
function vPropDraw(g, p, u, tm) {
  const S = (p.s || 1) * u,
    cx = (p.x + (p.s || 1) / 2) * u,
    cy = (p.y + (p.s || 1) / 2) * u,
    r = S / 2;
  g.save();
  g.translate(cx, cy);
  g.rotate(((p.rot || 0) * Math.PI) / 2);
  const shadow = (rx, ry) => {
    g.fillStyle = 'rgba(0,0,0,.28)';
    g.beginPath();
    g.ellipse(r * 0.08, r * 0.14, rx, ry, 0, 0, 7);
    g.fill();
  };
  const rr = (x, y, w, h2, rad) => {
    g.beginPath();
    g.roundRect ? g.roundRect(x, y, w, h2, rad) : g.rect(x, y, w, h2);
  };
  const blob = (rad, seed, base, hi) => {
    g.beginPath();
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * 6.283,
        d = rad * (0.78 + 0.22 * vH(seed, i, 1));
      i ? g.lineTo(Math.cos(a) * d, Math.sin(a) * d) : g.moveTo(Math.cos(a) * d, Math.sin(a) * d);
    }
    g.closePath();
    const gr = g.createRadialGradient(-rad * 0.3, -rad * 0.35, rad * 0.1, 0, 0, rad);
    gr.addColorStop(0, hi);
    gr.addColorStop(1, base);
    g.fillStyle = gr;
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,.35)';
    g.lineWidth = 2;
    g.stroke();
  };
  switch (p.k) {
    case 'pedra':
      shadow(r * 0.8, r * 0.7);
      blob(r * 0.78, p.x * 3 + p.y, '#6e6b66', '#aaa7a0');
      break;
    case 'arbusto':
      shadow(r * 0.85, r * 0.6);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * 6.283 + 0.3,
          rd = r * 0.42,
          bx = Math.cos(a) * rd,
          by = Math.sin(a) * rd * 0.9,
          br = r * 0.46;
        const gr = g.createRadialGradient(bx - br * 0.3, by - br * 0.3, 2, bx, by, br);
        gr.addColorStop(0, '#6fae52');
        gr.addColorStop(1, '#2a5e27');
        g.fillStyle = gr;
        g.beginPath();
        g.arc(bx, by, br, 0, 7);
        g.fill();
      }
      g.fillStyle = '#4a8a3c';
      g.beginPath();
      g.arc(0, 0, r * 0.45, 0, 7);
      g.fill();
      break;
    case 'arvore': {
      shadow(r * 0.95, r * 0.85);
      const gr = g.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r * 0.95);
      gr.addColorStop(0, '#5fa04c');
      gr.addColorStop(1, '#1f4a1e');
      g.fillStyle = gr;
      g.beginPath();
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * 6.283,
          d = r * (0.82 + 0.15 * vH(p.x, p.y, i));
        g.lineTo(Math.cos(a) * d, Math.sin(a) * d);
      }
      g.closePath();
      g.fill();
      g.fillStyle = 'rgba(255,255,255,.08)';
      g.beginPath();
      g.arc(-r * 0.25, -r * 0.25, r * 0.4, 0, 7);
      g.fill();
      break;
    }
    case 'caixa':
      shadow(r * 0.75, r * 0.7);
      rr(-r * 0.7, -r * 0.7, r * 1.4, r * 1.4, 4);
      g.fillStyle = '#9a6f3c';
      g.fill();
      g.strokeStyle = '#4e351a';
      g.lineWidth = 3;
      g.stroke();
      g.beginPath();
      g.moveTo(-r * 0.7, -r * 0.7);
      g.lineTo(r * 0.7, r * 0.7);
      g.moveTo(r * 0.7, -r * 0.7);
      g.lineTo(-r * 0.7, r * 0.7);
      g.stroke();
      rr(-r * 0.45, -r * 0.45, r * 0.9, r * 0.9, 2);
      g.strokeStyle = 'rgba(255,255,255,.18)';
      g.lineWidth = 2;
      g.stroke();
      break;
    case 'barril': {
      shadow(r * 0.72, r * 0.72);
      const gr = g.createRadialGradient(-r * 0.2, -r * 0.2, 2, 0, 0, r * 0.72);
      gr.addColorStop(0, '#b5834a');
      gr.addColorStop(1, '#6d4721');
      g.fillStyle = gr;
      g.beginPath();
      g.arc(0, 0, r * 0.7, 0, 7);
      g.fill();
      g.strokeStyle = '#3a2410';
      g.lineWidth = 3;
      g.stroke();
      g.beginPath();
      g.arc(0, 0, r * 0.45, 0, 7);
      g.stroke();
      g.beginPath();
      g.arc(0, 0, r * 0.2, 0, 7);
      g.stroke();
      break;
    }
    case 'bau':
      shadow(r * 0.8, r * 0.62);
      rr(-r * 0.72, -r * 0.5, r * 1.44, r, 6);
      g.fillStyle = '#8a5a2b';
      g.fill();
      g.strokeStyle = '#3b2410';
      g.lineWidth = 3;
      g.stroke();
      g.fillStyle = 'rgba(0,0,0,.18)';
      g.fillRect(-r * 0.7, -r * 0.5, r * 1.4, r * 0.35);
      g.strokeStyle = '#d3a93a';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(-r * 0.72, -r * 0.15);
      g.lineTo(r * 0.72, -r * 0.15);
      g.stroke();
      g.fillStyle = '#e6c04a';
      rr(-r * 0.1, -r * 0.27, r * 0.2, r * 0.27, 2);
      g.fill();
      break;
    case 'coluna': {
      shadow(r * 0.62, r * 0.62);
      const gr = g.createRadialGradient(-r * 0.2, -r * 0.2, 2, 0, 0, r * 0.6);
      gr.addColorStop(0, '#e2e0da');
      gr.addColorStop(1, '#8d8a82');
      g.fillStyle = gr;
      g.beginPath();
      g.arc(0, 0, r * 0.6, 0, 7);
      g.fill();
      g.strokeStyle = '#4c4a45';
      g.lineWidth = 3;
      g.stroke();
      g.beginPath();
      g.arc(0, 0, r * 0.36, 0, 7);
      g.strokeStyle = 'rgba(0,0,0,.25)';
      g.lineWidth = 2;
      g.stroke();
      break;
    }
    case 'mesa':
      shadow(r * 0.95, r * 0.62);
      rr(-r * 0.9, -r * 0.55, r * 1.8, r * 1.1, 8);
      g.fillStyle = '#7b5530';
      g.fill();
      g.strokeStyle = '#3b2410';
      g.lineWidth = 3;
      g.stroke();
      g.strokeStyle = 'rgba(0,0,0,.25)';
      g.lineWidth = 1.5;
      for (let i = -2; i <= 2; i++) {
        g.beginPath();
        g.moveTo(-r * 0.85, i * r * 0.2);
        g.lineTo(r * 0.85, i * r * 0.2);
        g.stroke();
      }
      break;
    case 'porta':
      rr(-r * 0.95, -r * 0.2, r * 1.9, r * 0.4, 3);
      g.fillStyle = '#7a5230';
      g.fill();
      g.strokeStyle = '#32200e';
      g.lineWidth = 3;
      g.stroke();
      g.fillStyle = '#d8b04a';
      g.beginPath();
      g.arc(r * 0.6, 0, r * 0.07, 0, 7);
      g.fill();
      g.strokeStyle = 'rgba(0,0,0,.3)';
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(0, -r * 0.2);
      g.lineTo(0, r * 0.2);
      g.stroke();
      break;
    case 'fogueira': {
      g.fillStyle = 'rgba(255,140,40,.18)';
      g.beginPath();
      g.arc(0, 0, r * 1.2, 0, 7);
      g.fill();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * 6.283;
        g.fillStyle = i % 2 ? '#7c7a76' : '#5d5b57';
        g.beginPath();
        g.arc(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5, r * 0.17, 0, 7);
        g.fill();
      }
      g.strokeStyle = '#4b2f15';
      g.lineWidth = 5;
      g.beginPath();
      g.moveTo(-r * 0.35, -r * 0.2);
      g.lineTo(r * 0.35, r * 0.2);
      g.moveTo(r * 0.35, -r * 0.2);
      g.lineTo(-r * 0.35, r * 0.2);
      g.stroke();
      [
        ['#ff5a14', 1],
        ['#ffb02e', 0.65],
        ['#fff1a6', 0.35],
      ].forEach(([c, k], i) => {
        const hh = r * (0.85 + 0.2 * Math.sin(tm * 9 + i)) * k;
        g.fillStyle = c;
        g.beginPath();
        g.moveTo(-r * 0.22 * k, r * 0.1);
        g.quadraticCurveTo(-r * 0.22 * k, -hh * 0.4, 0, -hh);
        g.quadraticCurveTo(r * 0.22 * k, -hh * 0.4, r * 0.22 * k, r * 0.1);
        g.fill();
      });
      break;
    }
    case 'estatua': {
      shadow(r * 0.62, r * 0.62);
      const gr = g.createRadialGradient(-r * 0.2, -r * 0.2, 2, 0, 0, r * 0.62);
      gr.addColorStop(0, '#9aa0a4');
      gr.addColorStop(1, '#5a6064');
      g.fillStyle = gr;
      g.beginPath();
      g.arc(0, 0, r * 0.6, 0, 7);
      g.fill();
      g.strokeStyle = '#2f3336';
      g.lineWidth = 3;
      g.stroke();
      g.fillStyle = '#c3c8cb';
      g.beginPath();
      g.arc(0, -r * 0.1, r * 0.22, 0, 7);
      g.fill();
      g.beginPath();
      g.ellipse(0, r * 0.28, r * 0.34, r * 0.2, 0, 0, 7);
      g.fill();
      break;
    }
    case 'tocha': {
      const gl = r * (1.5 + 0.15 * Math.sin(tm * 11));
      const gr = g.createRadialGradient(0, 0, 2, 0, 0, gl);
      gr.addColorStop(0, 'rgba(255,190,80,.5)');
      gr.addColorStop(1, 'rgba(255,140,40,0)');
      g.fillStyle = gr;
      g.beginPath();
      g.arc(0, 0, gl, 0, 7);
      g.fill();
      g.fillStyle = '#5a3a1c';
      g.beginPath();
      g.arc(0, r * 0.1, r * 0.16, 0, 7);
      g.fill();
      [
        ['#ff5a14', 1],
        ['#ffb02e', 0.65],
        ['#fff1a6', 0.35],
      ].forEach(([c, k], i) => {
        const hh = r * (0.6 + 0.12 * Math.sin(tm * 12 + i)) * k;
        g.fillStyle = c;
        g.beginPath();
        g.moveTo(-r * 0.16 * k, 0);
        g.quadraticCurveTo(-r * 0.16 * k, -hh * 0.4, 0, -hh);
        g.quadraticCurveTo(r * 0.16 * k, -hh * 0.4, r * 0.16 * k, 0);
        g.fill();
      });
      break;
    }
    case 'tenda':
      shadow(r * 0.98, r * 0.88);
      g.fillStyle = '#b89a5a';
      g.beginPath();
      g.moveTo(-r * 0.9, r * 0.8);
      g.lineTo(0, -r * 0.85);
      g.lineTo(r * 0.9, r * 0.8);
      g.closePath();
      g.fill();
      g.strokeStyle = '#4b3a1c';
      g.lineWidth = 3;
      g.stroke();
      g.fillStyle = 'rgba(0,0,0,.28)';
      g.beginPath();
      g.moveTo(0, -r * 0.85);
      g.lineTo(r * 0.9, r * 0.8);
      g.lineTo(0, r * 0.8);
      g.closePath();
      g.fill();
      g.fillStyle = '#2b2012';
      g.beginPath();
      g.moveTo(-r * 0.22, r * 0.8);
      g.lineTo(0, -r * 0.1);
      g.lineTo(r * 0.22, r * 0.8);
      g.closePath();
      g.fill();
      break;
    case 'cama':
      shadow(r * 0.9, r * 0.65);
      rr(-r * 0.9, -r * 0.6, r * 1.8, r * 1.2, 6);
      g.fillStyle = '#6e4a2a';
      g.fill();
      g.strokeStyle = '#2f1f10';
      g.lineWidth = 3;
      g.stroke();
      rr(-r * 0.8, -r * 0.5, r * 1.6, r, 5);
      g.fillStyle = '#c9d3df';
      g.fill();
      rr(-r * 0.8, -r * 0.5, r * 0.5, r, 5);
      g.fillStyle = '#f2f2f2';
      g.fill();
      g.fillStyle = '#7b2d3a';
      g.fillRect(-r * 0.25, -r * 0.5, r * 1.05, r);
      break;
    case 'estante':
      shadow(r * 0.95, r * 0.4);
      rr(-r * 0.95, -r * 0.35, r * 1.9, r * 0.7, 3);
      g.fillStyle = '#5f3f22';
      g.fill();
      g.strokeStyle = '#25160a';
      g.lineWidth = 3;
      g.stroke();
      for (let i = 0; i < 9; i++) {
        g.fillStyle = ['#a33', '#36a', '#3a6', '#c93', '#639'][i % 5];
        g.fillRect(-r * 0.86 + i * r * 0.2, -r * 0.27, r * 0.15, r * 0.22);
        g.fillStyle = ['#c93', '#a33', '#36a', '#639', '#3a6'][i % 5];
        g.fillRect(-r * 0.86 + i * r * 0.2, r * 0.02, r * 0.15, r * 0.24);
      }
      break;
    case 'poco': {
      shadow(r * 0.75, r * 0.75);
      g.fillStyle = '#7a776f';
      g.beginPath();
      g.arc(0, 0, r * 0.72, 0, 7);
      g.fill();
      g.strokeStyle = '#38362f';
      g.lineWidth = 3;
      g.stroke();
      const gr = g.createRadialGradient(0, 0, 2, 0, 0, r * 0.5);
      gr.addColorStop(0, '#0a2a48');
      gr.addColorStop(1, '#1d5f95');
      g.fillStyle = gr;
      g.beginPath();
      g.arc(0, 0, r * 0.5, 0, 7);
      g.fill();
      g.strokeStyle = 'rgba(255,255,255,.35)';
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(0, 0, r * 0.3 + Math.sin(tm * 2) * 2, 0, 7);
      g.stroke();
      break;
    }
    case 'cadeira':
      shadow(r * 0.55, r * 0.55);
      rr(-r * 0.45, -r * 0.45, r * 0.9, r * 0.9, 4);
      g.fillStyle = '#8a5e33';
      g.fill();
      g.strokeStyle = '#3b2410';
      g.lineWidth = 2.5;
      g.stroke();
      rr(-r * 0.45, -r * 0.55, r * 0.9, r * 0.18, 3);
      g.fillStyle = '#5f3f22';
      g.fill();
      g.stroke();
      break;
    case 'cerca':
      for (let i = -2; i <= 2; i++) {
        g.fillStyle = '#7b5a35';
        g.fillRect(i * r * 0.42 - r * 0.07, -r * 0.22, r * 0.14, r * 0.44);
        g.strokeStyle = '#2e1e0d';
        g.lineWidth = 1.5;
        g.strokeRect(i * r * 0.42 - r * 0.07, -r * 0.22, r * 0.14, r * 0.44);
      }
      g.fillStyle = '#946b3e';
      g.fillRect(-r * 0.95, -r * 0.12, r * 1.9, r * 0.1);
      g.fillRect(-r * 0.95, r * 0.06, r * 1.9, r * 0.1);
      break;
    case 'ossos':
      g.strokeStyle = '#e8e2d0';
      g.lineWidth = r * 0.14;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(-r * 0.5, -r * 0.35);
      g.lineTo(r * 0.4, r * 0.4);
      g.moveTo(r * 0.5, -r * 0.3);
      g.lineTo(-r * 0.35, r * 0.45);
      g.stroke();
      g.fillStyle = '#efe9d8';
      g.beginPath();
      g.arc(r * 0.05, -r * 0.05, r * 0.3, 0, 7);
      g.fill();
      g.fillStyle = '#2b2820';
      g.beginPath();
      g.arc(-r * 0.06, -r * 0.08, r * 0.07, 0, 7);
      g.arc(r * 0.17, -r * 0.08, r * 0.07, 0, 7);
      g.fill();
      break;
    case 'vaso':
      shadow(r * 0.5, r * 0.5);
      g.fillStyle = '#b5683a';
      g.beginPath();
      g.ellipse(0, 0, r * 0.42, r * 0.5, 0, 0, 7);
      g.fill();
      g.strokeStyle = '#5b2f14';
      g.lineWidth = 2.5;
      g.stroke();
      g.fillStyle = '#2b1608';
      g.beginPath();
      g.ellipse(0, -r * 0.22, r * 0.26, r * 0.12, 0, 0, 7);
      g.fill();
      break;
    case 'altar':
      shadow(r * 0.9, r * 0.6);
      rr(-r * 0.85, -r * 0.5, r * 1.7, r, 5);
      g.fillStyle = '#8b8780';
      g.fill();
      g.strokeStyle = '#3c3a35';
      g.lineWidth = 3;
      g.stroke();
      g.fillStyle = '#6f1f2d';
      g.fillRect(-r * 0.6, -r * 0.38, r * 1.2, r * 0.76);
      [-0.35, 0.35].forEach(d => {
        g.fillStyle = '#f4ecd0';
        g.fillRect(d * r - r * 0.05, -r * 0.2, r * 0.1, r * 0.3);
        g.fillStyle = '#ffb02e';
        g.beginPath();
        g.arc(d * r, -r * 0.26 - Math.sin(tm * 10 + d) * 1.5, r * 0.07, 0, 7);
        g.fill();
      });
      break;
    case 'bandeira':
      g.strokeStyle = '#4b3a1c';
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(-r * 0.4, r * 0.75);
      g.lineTo(-r * 0.4, -r * 0.75);
      g.stroke();
      g.fillStyle = '#c0392b';
      g.beginPath();
      g.moveTo(-r * 0.4, -r * 0.7);
      g.quadraticCurveTo(0, -r * 0.5 + Math.sin(tm * 3) * 3, r * 0.6, -r * 0.65);
      g.lineTo(r * 0.55, -r * 0.1);
      g.quadraticCurveTo(0, -r * 0.1 + Math.sin(tm * 3 + 1) * 3, -r * 0.4, -r * 0.12);
      g.closePath();
      g.fill();
      break;
    case 'escada':
      rr(-r * 0.7, -r * 0.85, r * 1.4, r * 1.7, 2);
      g.fillStyle = '#8c8982';
      g.fill();
      g.strokeStyle = '#3c3a35';
      g.lineWidth = 3;
      g.stroke();
      for (let i = 0; i < 6; i++) {
        g.fillStyle = `rgba(0,0,0,${0.05 + i * 0.05})`;
        g.fillRect(-r * 0.7, -r * 0.85 + i * r * 0.283, r * 1.4, r * 0.283);
        g.fillStyle = 'rgba(255,255,255,.25)';
        g.fillRect(-r * 0.7, -r * 0.85 + i * r * 0.283, r * 1.4, 2);
      }
      break;
    case 'barco': {
      shadow(r * 0.98, r * 0.5);
      g.fillStyle = '#7b5230';
      g.beginPath();
      g.moveTo(-r * 0.95, -r * 0.3);
      g.quadraticCurveTo(-r * 0.2, -r * 0.62, r * 0.95, 0);
      g.quadraticCurveTo(-r * 0.2, r * 0.62, -r * 0.95, r * 0.3);
      g.closePath();
      g.fill();
      g.strokeStyle = '#2f1d0c';
      g.lineWidth = 3.5;
      g.stroke();
      g.fillStyle = '#9a6d3f';
      g.beginPath();
      g.moveTo(-r * 0.8, -r * 0.2);
      g.quadraticCurveTo(-r * 0.2, -r * 0.46, r * 0.75, 0);
      g.quadraticCurveTo(-r * 0.2, r * 0.46, -r * 0.8, r * 0.2);
      g.closePath();
      g.fill();
      g.strokeStyle = 'rgba(0,0,0,.3)';
      g.lineWidth = 1.5;
      for (let i = -3; i <= 3; i++) {
        g.beginPath();
        g.moveTo(i * r * 0.22, -r * 0.4);
        g.lineTo(i * r * 0.22, r * 0.4);
        g.stroke();
      }
      g.fillStyle = '#2f1d0c';
      g.beginPath();
      g.arc(-r * 0.1, 0, r * 0.07, 0, 7);
      g.fill();
      g.fillStyle = '#efe6cc';
      g.beginPath();
      g.moveTo(-r * 0.1, -r * 0.05);
      g.quadraticCurveTo(r * 0.25, -r * 0.38, r * 0.1, -r * 0.52);
      g.lineTo(-r * 0.12, -r * 0.5);
      g.fill();
      break;
    }
    case 'cristal': {
      const gl = r * (1.1 + 0.1 * Math.sin(tm * 3));
      const gr = g.createRadialGradient(0, 0, 2, 0, 0, gl);
      gr.addColorStop(0, 'rgba(120,230,255,.45)');
      gr.addColorStop(1, 'rgba(120,230,255,0)');
      g.fillStyle = gr;
      g.beginPath();
      g.arc(0, 0, gl, 0, 7);
      g.fill();
      [
        [-0.3, 0.3, 0.55],
        [0, 0.5, 0.85],
        [0.3, 0.25, 0.5],
      ].forEach(([dx, w, hh], i) => {
        g.fillStyle = ['#7fe3ff', '#a98bff', '#5bc8ff'][i];
        g.strokeStyle = '#1b4a66';
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(dx * r - w * r * 0.4, r * 0.5);
        g.lineTo(dx * r, r * 0.5 - hh * r * 1.5);
        g.lineTo(dx * r + w * r * 0.4, r * 0.5);
        g.closePath();
        g.fill();
        g.stroke();
      });
      break;
    }
    case 'tronco':
      shadow(r * 0.98, r * 0.4);
      rr(-r * 0.95, -r * 0.3, r * 1.9, r * 0.6, r * 0.3);
      g.fillStyle = '#6b4724';
      g.fill();
      g.strokeStyle = '#2a1a0a';
      g.lineWidth = 3;
      g.stroke();
      g.strokeStyle = 'rgba(0,0,0,.3)';
      g.lineWidth = 1.5;
      for (let i = -2; i <= 2; i++) {
        g.beginPath();
        g.moveTo(i * r * 0.35, -r * 0.25);
        g.lineTo(i * r * 0.35 + 4, r * 0.25);
        g.stroke();
      }
      g.fillStyle = '#b58a55';
      g.beginPath();
      g.ellipse(r * 0.88, 0, r * 0.12, r * 0.28, 0, 0, 7);
      g.fill();
      g.stroke();
      break;
    case 'lapide':
      shadow(r * 0.5, r * 0.3);
      g.fillStyle = '#8f9396';
      g.beginPath();
      g.moveTo(-r * 0.4, r * 0.55);
      g.lineTo(-r * 0.4, -r * 0.15);
      g.quadraticCurveTo(0, -r * 0.85, r * 0.4, -r * 0.15);
      g.lineTo(r * 0.4, r * 0.55);
      g.closePath();
      g.fill();
      g.strokeStyle = '#3d4144';
      g.lineWidth = 3;
      g.stroke();
      g.strokeStyle = '#4c5053';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(0, -r * 0.3);
      g.lineTo(0, r * 0.15);
      g.moveTo(-r * 0.15, -r * 0.12);
      g.lineTo(r * 0.15, -r * 0.12);
      g.stroke();
      break;
    case 'portao':
      g.fillStyle = 'rgba(0,0,0,.35)';
      g.fillRect(-r * 0.95, -r * 0.2, r * 1.9, r * 0.4);
      g.strokeStyle = '#5b5f63';
      g.lineWidth = 4;
      g.strokeRect(-r * 0.95, -r * 0.2, r * 1.9, r * 0.4);
      g.lineWidth = 3;
      for (let i = -4; i <= 4; i++) {
        g.beginPath();
        g.moveTo(i * r * 0.21, -r * 0.2);
        g.lineTo(i * r * 0.21, r * 0.2);
        g.stroke();
      }
      g.beginPath();
      g.moveTo(-r * 0.95, 0);
      g.lineTo(r * 0.95, 0);
      g.stroke();
      break;
    case 'cogumelo':
      shadow(r * 0.55, r * 0.5);
      g.fillStyle = '#efe6d2';
      g.fillRect(-r * 0.12, 0, r * 0.24, r * 0.4);
      g.fillStyle = '#c0392b';
      g.beginPath();
      g.ellipse(0, -r * 0.05, r * 0.5, r * 0.38, 0, Math.PI, 0);
      g.lineTo(r * 0.5, 0);
      g.lineTo(-r * 0.5, 0);
      g.fill();
      g.strokeStyle = '#4a1510';
      g.lineWidth = 2.5;
      g.stroke();
      g.fillStyle = '#fff';
      [
        [-0.25, -0.18],
        [0.1, -0.28],
        [0.28, -0.1],
      ].forEach(([a, b]) => {
        g.beginPath();
        g.arc(a * r * 1.6, b * r * 1.2, r * 0.07, 0, 7);
        g.fill();
      });
      break;
    case 'armadilha':
      rr(-r * 0.7, -r * 0.7, r * 1.4, r * 1.4, 3);
      g.fillStyle = 'rgba(70,60,50,.9)';
      g.fill();
      g.strokeStyle = '#2b2520';
      g.lineWidth = 3;
      g.stroke();
      g.fillStyle = '#b8bcc0';
      for (let i = -1; i <= 1; i++)
        for (let j = -1; j <= 1; j++) {
          g.beginPath();
          g.moveTo(i * r * 0.4 - r * 0.1, j * r * 0.4 + r * 0.1);
          g.lineTo(i * r * 0.4, j * r * 0.4 - r * 0.14);
          g.lineTo(i * r * 0.4 + r * 0.1, j * r * 0.4 + r * 0.1);
          g.fill();
        }
      break;
  }
  g.restore();
}
