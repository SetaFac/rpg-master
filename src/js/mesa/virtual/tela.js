/* ---- tela ---- */
function renderVTT(sceneId, opts) {
  /* Ponte para as funções vtt*() que ficam em outros arquivos (js/mesa/virtual/): cada getter lê a
     variável deste closure no momento do uso. */
  const ctx = {
    get S() {
      return S;
    },
    get redraw() {
      return redraw;
    },
    get fit() {
      return fit;
    },
    get syncBar() {
      return syncBar;
    },
    get activate() {
      return activate;
    },
    get V() {
      return V;
    },
    get switchScene() {
      return switchScene;
    },
    get newScene() {
      return newScene;
    },
    get pickScenes() {
      return pickScenes;
    },
    get R() {
      return R;
    },
    get bar() {
      return bar;
    },
    get present() {
      return present;
    },
    get setTool() {
      return setTool;
    },
    get libraryDialog() {
      return libraryDialog;
    },
    get sceneDialog() {
      return sceneDialog;
    },
    get addTokens() {
      return addTokens;
    },
    get save() {
      return save;
    },
    get revealAround() {
      return revealAround;
    },
    get M() {
      return M;
    },
    get exportPng() {
      return exportPng;
    },
    get paint() {
      return paint;
    },
    get side() {
      return side;
    },
    get renderSideRemote() {
      return renderSideRemote;
    },
    get renderSide() {
      return renderSide;
    },
    get removeProp() {
      return removeProp;
    },
    get removeTok() {
      return removeTok;
    },
    get nextTurn() {
      return nextTurn;
    },
  };

  const R = !!(opts && opts.remote);
  App.ch = null;
  App.tpl = null;
  App.rt = null;
  App.binds = [];
  App.hudBinds = [];
  Store.data.cur = null;
  buildTop();
  document.querySelectorAll('.pop, .ovl').forEach(p => p.remove());
  const V = R ? { scenes: [Net.scene], cur: Net.scene.id } : Store.data.vtt;
  if (!R && !V.scenes.length) {
    V.scenes.push(vNewScene(L3('Cena 1', 'Scene 1', 'Szene 1'), 'masmorra', 'medium'));
  }
  V.scenes.forEach(vNormalizeSceneSize);
  if (sceneId) V.cur = sceneId;
  if (!V.scenes.find(s => s.id === V.cur)) V.cur = V.scenes[0].id;
  if (!R) Store.save();
  const S = {
    sc: V.scenes.find(s => s.id === V.cur),
    tool: 'move',
    sel: null,
    brush: 1,
    measWidth: 1,
    view: { x: 0, y: 0, z: 1 },
    drag: null,
    meas: null,
    dirtyFog: true,
    W: 0,
    H: 0,
    dpr: 1,
    pulse: 0,
    space: false,
    terrSel: 'parede',
    propSel: 'pedra',
    selP: null,
  };
  V.scenes.forEach(x => {
    x.terr = x.terr || {};
    x.props = x.props || [];
  });
  if (!R) vRefreshHP();
  const view = $('#view');
  view.replaceChildren();
  const canvas = h('canvas', {
      tabindex: 0,
      'aria-label': L3('Mesa virtual', 'Virtual tabletop', 'Virtueller Tisch'),
    }),
    g = canvas.getContext('2d');
  const turnEl = h('div.vtt-turn'),
    side = h('aside.vtt-side'),
    bar = h('div.vtt-bar');
  const hint = h(
    'div.vtt-hint',
    R
      ? L3(
          'Arraste o fundo para mover · roda do mouse = zoom · arraste os seus personagens',
          'Drag background to pan · wheel = zoom · drag your own characters',
          'Hintergrund ziehen · Mausrad = Zoom · eigene Charaktere ziehen'
        )
      : L3(
          'Arraste o fundo para mover · roda do mouse = zoom · arraste tokens · Delete remove',
          'Drag background to pan · wheel = zoom · drag tokens · Delete removes',
          'Hintergrund ziehen = Verschieben · Mausrad = Zoom · Token ziehen · Entf löscht'
        )
  );
  const stage = h(
    'div.vtt-stage',
    canvas,
    turnEl,
    hint,
    h(
      'button.btn.vtt-exit',
      { type: 'button', onclick: () => present(false) },
      '✕ ' + L3('Sair da apresentação', 'Exit presentation', 'Präsentation beenden')
    )
  );
  const root = h('div.vtt' + (R ? '' : '.gm-root'), bar, h('div.vtt-main', stage, side));
  view.append(root);
  const isPresent = () => root.classList.contains('present');
  const M = () => vMapSize(S.sc);
  const save = () => {
    if (!R) Store.save();
  };
  let raf = 0;
  const redraw = () => {
    if (!raf)
      raf = requestAnimationFrame(() => {
        raf = 0;
        draw();
      });
  };
  const fit = () => {
    const m = M();
    const z = Math.min(S.W / m.w, S.H / m.h) * 0.96;
    S.view = { z, x: (m.w - S.W / z) / 2, y: (m.h - S.H / z) / 2 };
  };
  const resize = () => {
    const r = stage.getBoundingClientRect();
    S.dpr = Math.min(2, window.devicePixelRatio || 1);
    S.W = r.width;
    S.H = r.height;
    canvas.width = Math.max(1, Math.round(r.width * S.dpr));
    canvas.height = Math.max(1, Math.round(r.height * S.dpr));
    redraw();
  };
  const ro = new ResizeObserver(() => {
    if (!root.isConnected) {
      ro.disconnect();
      return;
    }
    resize();
  });
  ro.observe(stage);
  const toMap = (ex, ey) => {
    const r = canvas.getBoundingClientRect();
    return { x: (ex - r.left) / S.view.z + S.view.x, y: (ey - r.top) / S.view.z + S.view.y };
  };
  const entCur = () => {
    if (R) return S.sc.turn ? { k: 'tid', id: S.sc.turn } : null;
    const { ents } = mesaEnts();
    const e = ents[MESA.turn];
    return e ? (e.k === 'pc' ? { k: 'pc', id: e.o.id } : { k: 'npc', id: e.o.id }) : null;
  };
  const isCur = (tk, cur) =>
    cur && (cur.k === 'tid' ? tk.id === cur.id : tk.ref && tk.ref.k === cur.k && tk.ref.id === cur.id);
  const revealed = (cx, cy) => !S.sc.fog.on || S.sc.fog.rev[cx + ',' + cy];
  let fogC = null;
  const buildFog = () => {
    const m = M();
    fogC = fogC || document.createElement('canvas');
    fogC.width = m.cols;
    fogC.height = m.rows;
    const f = fogC.getContext('2d');
    f.clearRect(0, 0, m.cols, m.rows);
    f.fillStyle = '#05060c';
    f.fillRect(0, 0, m.cols, m.rows);
    Object.keys(S.sc.fog.rev).forEach(k => {
      const [x, y] = k.split(',').map(Number);
      f.clearRect(x, y, 1, 1);
    });
    S.dirtyFog = false;
  };

  function draw() {
    if (!root.isConnected) return;
    const v = S.view;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#0b0b10';
    g.fillRect(0, 0, canvas.width, canvas.height);
    g.setTransform(S.dpr * v.z, 0, 0, S.dpr * v.z, -v.x * v.z * S.dpr, -v.y * v.z * S.dpr);
    paint(g, R || isPresent(), null);
    if (R) {
      turnEl.style.display = S.sc.turn ? '' : 'none';
      if (S.sc.turn)
        turnEl.textContent =
          '⚔ ' +
          L3('Turno de ', 'Turn: ', 'Am Zug: ') +
          (S.sc.turnName || '?') +
          ' · ' +
          L3('Rodada ', 'Round ', 'Runde ') +
          (S.sc.round || 1);
      return;
    }
    const { ents } = mesaEnts();
    const e = ents[MESA.turn];
    turnEl.style.display = e && MESA.turn >= 0 ? '' : 'none';
    if (e)
      turnEl.textContent =
        '⚔ ' +
        L3('Turno de ', 'Turn: ', 'Am Zug: ') +
        (e.name || '?') +
        ' · ' +
        L3('Rodada ', 'Round ', 'Runde ') +
        MESA.round;
  }
  /* desenha o mapa em g (já com a transformação aplicada). X = opções de exportação ou null */
  function paint(g, pres, X) {
    const sc = S.sc,
      m = M(),
      u = sc.cell || 64,
      v = X ? { z: 1 } : S.view;
    const bgc = vBgFinal(sc, redraw);
    g.imageSmoothingEnabled = true;
    if (bgc) g.drawImage(bgc, 0, 0, m.w, m.h);
    else {
      g.fillStyle = '#222';
      g.fillRect(0, 0, m.w, m.h);
    }
    const tmS = performance.now() / 1000;
    {
      const T = sc.terr,
        ks = Object.keys(T);
      ks.forEach(k => {
        const [x, y] = k.split(',').map(Number),
          id = T[k],
          d = TERR[id];
        if (d) d.f(g, x * u, y * u, u, tmS, (dx, dy) => T[x + dx + ',' + (y + dy)] === id, x, y);
      });
    }
    if (X ? X.grid : sc.grid.on) {
      g.strokeStyle = sc.grid.color;
      g.globalAlpha = sc.grid.alpha;
      g.lineWidth = Math.max(1, 1.2 / v.z);
      g.beginPath();
      for (let x = 0; x <= m.cols * u; x += u) {
        g.moveTo(x, 0);
        g.lineTo(x, m.h);
      }
      for (let y = 0; y <= m.rows * u; y += u) {
        g.moveTo(0, y);
        g.lineTo(m.w, y);
      }
      g.stroke();
      g.globalAlpha = 1;
    }
    sc.props.forEach(pr => {
      if (pres && pr.hidden) return;
      g.save();
      if (pr.hidden) g.globalAlpha = 0.45;
      vPropDraw(g, pr, u, tmS);
      if (S.selP === pr.id && !pres && !X) {
        const s2 = (pr.s || 1) * u;
        g.setLineDash([8, 6]);
        g.strokeStyle = '#fff';
        g.lineWidth = 2.5;
        g.strokeRect(pr.x * u - 4, pr.y * u - 4, s2 + 8, s2 + 8);
        g.setLineDash([]);
      }
      g.restore();
    });
    const cur = X ? null : entCur();
    (X && !X.tokens ? [] : S.sc.tokens).forEach(tk => {
      const info = vTokInfo(tk);
      if (!info) return;
      const s = tk.s || 1,
        cx = (tk.x + s / 2) * u,
        cy = (tk.y + s / 2) * u,
        r = (s * u) / 2 - 3;
      if (pres && (tk.hidden || !revealed(Math.floor(tk.x + s / 2), Math.floor(tk.y + s / 2)))) return;
      g.save();
      if (tk.hidden) g.globalAlpha = 0.4;
      const col = tk.color || V_ROLE[info.role] || '#ccc';
      g.shadowColor = 'rgba(0,0,0,.6)';
      g.shadowBlur = 10;
      g.fillStyle = col;
      g.beginPath();
      g.arc(cx, cy, r, 0, 7);
      g.fill();
      g.shadowBlur = 0;
      const im = vImgEl(info.img, redraw);
      if (im) {
        g.save();
        g.beginPath();
        g.arc(cx, cy, r - 3, 0, 7);
        g.clip();
        const k = Math.max((2 * r) / im.naturalWidth, (2 * r) / im.naturalHeight),
          dw = im.naturalWidth * k,
          dh = im.naturalHeight * k;
        g.drawImage(im, cx - dw / 2, cy - dh / 2, dw, dh);
        g.restore();
      } else {
        g.fillStyle = 'rgba(0,0,0,.35)';
        g.beginPath();
        g.arc(cx, cy, r - 3, 0, 7);
        g.fill();
        g.fillStyle = '#fff';
        g.font = `700 ${r * 1.1}px system-ui, sans-serif`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText((info.name || '?').trim().charAt(0).toUpperCase(), cx, cy + 2);
      }
      g.lineWidth = 4;
      g.strokeStyle = col;
      g.beginPath();
      g.arc(cx, cy, r, 0, 7);
      g.stroke();
      if (R && (tk.owner === Net.name || tk.owner === '*')) {
        g.setLineDash([6, 5]);
        g.strokeStyle = '#fff';
        g.lineWidth = 2;
        g.beginPath();
        g.arc(cx, cy, r + 8, 0, 7);
        g.stroke();
        g.setLineDash([]);
      }
      if (info.hp && info.hp.cur <= 0) {
        g.strokeStyle = '#ff2a2a';
        g.lineWidth = 6;
        g.beginPath();
        g.moveTo(cx - r * 0.6, cy - r * 0.6);
        g.lineTo(cx + r * 0.6, cy + r * 0.6);
        g.moveTo(cx + r * 0.6, cy - r * 0.6);
        g.lineTo(cx - r * 0.6, cy + r * 0.6);
        g.stroke();
      }
      if (isCur(tk, cur)) {
        const p = (Math.sin(S.pulse / 5) + 1) / 2;
        g.strokeStyle = '#ffd34d';
        g.lineWidth = 4 + p * 3;
        g.globalAlpha = 0.55 + p * 0.45;
        g.beginPath();
        g.arc(cx, cy, r + 6 + p * 3, 0, 7);
        g.stroke();
        g.globalAlpha = tk.hidden ? 0.4 : 1;
      }
      if (S.sel === tk.id && !pres && !X) {
        g.setLineDash([8, 6]);
        g.strokeStyle = '#fff';
        g.lineWidth = 2.5;
        g.beginPath();
        g.arc(cx, cy, r + 9, 0, 7);
        g.stroke();
        g.setLineDash([]);
      }
      if (info.hp && info.hp.max > 0) {
        const bw = r * 1.7,
          bx = cx - bw / 2,
          by = cy + r - 5,
          pct = Math.max(0, Math.min(1, info.hp.cur / info.hp.max));
        g.fillStyle = 'rgba(0,0,0,.75)';
        g.fillRect(bx - 1, by - 1, bw + 2, 9);
        g.fillStyle = pct <= 0.25 ? '#e5483b' : pct <= 0.5 ? '#e0a634' : '#46b86b';
        g.fillRect(bx, by, bw * pct, 7);
      }
      if (info.conds.length) {
        g.font = `600 ${Math.max(10, u * 0.17)}px system-ui, sans-serif`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        info.conds.slice(0, 3).forEach((c, i) => {
          const tx = cx - r + i * (u * 0.5) + u * 0.25,
            ty = cy - r - 2,
            w2 = g.measureText(c.slice(0, 3)).width + 8;
          g.fillStyle = 'rgba(120,30,140,.92)';
          g.fillRect(tx - w2 / 2, ty - 8, w2, 16);
          g.fillStyle = '#fff';
          g.fillText(c.slice(0, 3), tx, ty);
        });
      }
      {
        const fs = Math.max(11, u * 0.21);
        g.font = `600 ${fs}px system-ui, sans-serif`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        const nm = info.name || '',
          tw = g.measureText(nm).width + 12,
          ty = cy + r + fs * 0.9 + 6;
        g.fillStyle = 'rgba(0,0,0,.72)';
        g.beginPath();
        g.roundRect
          ? g.roundRect(cx - tw / 2, ty - fs * 0.8, tw, fs * 1.6, 6)
          : g.rect(cx - tw / 2, ty - fs * 0.8, tw, fs * 1.6);
        g.fill();
        g.fillStyle = '#fff';
        g.fillText(nm, cx, ty + 1);
      }
      g.restore();
    });
    if (sc.fog.on && (!X || X.fog)) {
      if (S.dirtyFog || !fogC) buildFog();
      g.globalAlpha = pres ? 1 : 0.62;
      g.imageSmoothingEnabled = true;
      g.drawImage(fogC, 0, 0, m.w, m.h);
      g.globalAlpha = 1;
    }
    const me = X ? null : S.meas;
    if (me) {
      const fmt = n => (+n.toFixed(1)).toString(),
        unitDist = cells => fmt(cells * sc.grid.unit) + ' ' + sc.grid.unitName,
        drawLabel = (lab, x, y) => {
          const fs = 15 / v.z;
          g.font = `700 ${fs}px system-ui, sans-serif`;
          g.textAlign = 'center';
          const tw = g.measureText(lab).width + 14 / v.z;
          g.fillStyle = 'rgba(0,0,0,.8)';
          g.fillRect(x - tw / 2, y - fs * 2.4, tw, fs * 1.6);
          g.fillStyle = '#ffd34d';
          g.textBaseline = 'middle';
          g.fillText(lab, x, y - fs * 1.6);
        };
      g.lineWidth = 4 / v.z;
      g.strokeStyle = '#ffd34d';
      g.fillStyle = 'rgba(255,211,77,.18)';
      g.lineJoin = 'round';
      g.lineCap = 'round';

      if (me.kind === 'path') {
        const pts = me.points || [];
        if (pts.length > 1) {
          let lenPx = 0;
          for (let i = 1; i < pts.length; i++) lenPx += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
          const widthCells = me.width || 1,
            lenCells = lenPx / u;
          g.save();
          g.beginPath();
          g.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
          g.strokeStyle = 'rgba(255,211,77,.20)';
          g.lineWidth = widthCells * u;
          g.stroke();
          g.strokeStyle = '#ffd34d';
          g.lineWidth = 3 / v.z;
          g.stroke();
          g.restore();
          const last = pts[pts.length - 1];
          drawLabel(
            L3('largura ', 'width ', 'Breite ') +
              fmt(widthCells) +
              ' ' +
              L3('casas', 'sq', 'Felder') +
              ' · ' +
              L3('comprimento ', 'length ', 'Länge ') +
              fmt(lenCells) +
              ' · ' +
              unitDist(lenCells),
            last.x,
            last.y
          );
        }
      } else {
        const dx = me.x1 - me.x0,
          dy = me.y1 - me.y0,
          d = Math.hypot(dx, dy) / u;
        if (me.kind === 'circle') {
          g.beginPath();
          g.arc(me.x0, me.y0, Math.hypot(dx, dy), 0, Math.PI * 2);
          g.fill();
          g.stroke();
        } else if (me.kind === 'rect') {
          g.beginPath();
          g.rect(me.x0, me.y0, dx, dy);
          g.fill();
          g.stroke();
        } else if (me.kind === 'cone') {
          const len = Math.hypot(dx, dy),
            ux = len ? dx / len : 1,
            uy = len ? dy / len : 0,
            px = -uy,
            py = ux,
            half = len / 2,
            ax = me.x1 + px * half,
            ay = me.y1 + py * half,
            bx = me.x1 - px * half,
            by = me.y1 - py * half;
          g.beginPath();
          g.moveTo(me.x0, me.y0);
          g.lineTo(ax, ay);
          g.lineTo(bx, by);
          g.closePath();
          g.fill();
          g.stroke();
        }

        g.beginPath();
        g.moveTo(me.x0, me.y0);
        g.lineTo(me.x1, me.y1);
        g.stroke();
        g.fillStyle = '#ffd34d';
        g.beginPath();
        g.arc(me.x0, me.y0, 5 / v.z, 0, Math.PI * 2);
        g.fill();

        let lab;
        if (me.kind === 'circle') {
          lab = L3('raio ', 'radius ', 'Radius ') + fmt(d) + ' ' + L3('casas', 'sq', 'Felder') + ' · ' + unitDist(d);
        } else if (me.kind === 'rect') {
          const w = Math.abs(dx) / u,
            h = Math.abs(dy) / u;
          lab = fmt(w) + ' × ' + fmt(h) + ' ' + L3('casas', 'sq', 'Felder') + ' · ' + fmt(w * h) + ' ' + L3('de área', 'area', 'Fläche');
        } else if (me.kind === 'cone') {
          lab = L3('alcance ', 'range ', 'Reichweite ') + fmt(d) + ' ' + L3('casas', 'sq', 'Felder') + ' · ' + unitDist(d);
        } else {
          lab = fmt(d) + ' ' + L3('casas', 'sq', 'Felder') + ' · ' + unitDist(d);
        }
        drawLabel(lab, me.x1, me.y1);
      }
    }
  }
  const animScene = () =>
    Object.values(S.sc.terr).some(id => TERR[id] && TERR[id].anim) ||
    S.sc.props.some(p => PROPS[p.k] && PROPS[p.k].anim);
  const pulseT = setInterval(() => {
    if (!root.isConnected) {
      clearInterval(pulseT);
      clearInterval(hpT);
      return;
    }
    if (entCur() || animScene()) {
      S.pulse++;
      redraw();
    }
  }, 100);
  const hpT = setInterval(() => {
    if (root.isConnected && !S.drag && !R) {
      vRefreshHP();
      redraw();
    }
  }, 5000);

  /* --- interação --- */
  const hit = p => {
    const u = S.sc.cell || 64;
    for (let i = S.sc.tokens.length - 1; i >= 0; i--) {
      const tk = S.sc.tokens[i],
        s = tk.s || 1;
      if (isPresent() && tk.hidden) continue;
      if (Math.hypot(p.x - (tk.x + s / 2) * u, p.y - (tk.y + s / 2) * u) <= (s * u) / 2) return tk;
    }
    return null;
  };
  const hitProp = p => {
    const u = S.sc.cell || 64;
    for (let i = S.sc.props.length - 1; i >= 0; i--) {
      const pr = S.sc.props[i],
        s = pr.s || 1;
      if (isPresent() && pr.hidden) continue;
      if (p.x >= pr.x * u && p.x <= (pr.x + s) * u && p.y >= pr.y * u && p.y <= (pr.y + s) * u) return pr;
    }
    return null;
  };
  const paintTerr = p => {
    const u = S.sc.cell || 64,
      m = M(),
      r = S.brush - 1,
      cx = Math.floor(p.x / u),
      cy = Math.floor(p.y / u);
    for (let dx = -r; dx <= r; dx++)
      for (let dy = -r; dy <= r; dy++) {
        const x = cx + dx,
          y = cy + dy;
        if (x < 0 || y < 0 || x >= m.cols || y >= m.rows) continue;
        if (S.terrSel) S.sc.terr[x + ',' + y] = S.terrSel;
        else delete S.sc.terr[x + ',' + y];
      }
    redraw();
  };
  const paintFog = (p, add) => {
    const u = S.sc.cell || 64,
      m = M(),
      r = S.brush - 1,
      cx = Math.floor(p.x / u),
      cy = Math.floor(p.y / u);
    for (let dx = -r; dx <= r; dx++)
      for (let dy = -r; dy <= r; dy++) {
        const x = cx + dx,
          y = cy + dy;
        if (x < 0 || y < 0 || x >= m.cols || y >= m.rows) continue;
        if (add) S.sc.fog.rev[x + ',' + y] = 1;
        else delete S.sc.fog.rev[x + ',' + y];
      }
    S.dirtyFog = true;
    redraw();
  };
  canvas.addEventListener('pointerdown', e => {
    canvas.focus();
    const p = toMap(e.clientX, e.clientY);
    canvas.setPointerCapture(e.pointerId);
    if (e.button === 1 || e.button === 2 || S.space) {
      S.drag = { kind: 'pan', sx: e.clientX, sy: e.clientY, vx: S.view.x, vy: S.view.y };
      return;
    }
    if (R) {
      const tk = hit(p);
      if (tk && (tk.owner === Net.name || tk.owner === '*')) {
        S.sel = tk.id;
        S.drag = {
          kind: 'tok',
          tk,
          ox: p.x / (S.sc.cell || 64) - tk.x,
          oy: p.y / (S.sc.cell || 64) - tk.y,
          moved: false,
        };
        renderSide();
      } else S.drag = { kind: 'pan', sx: e.clientX, sy: e.clientY, vx: S.view.x, vy: S.view.y };
      redraw();
      return;
    }
    if (['ruler', 'circle', 'rect', 'cone', 'path'].includes(S.tool)) {
      if (S.tool === 'path') {
        S.meas = { kind: 'path', points: [{ x: p.x, y: p.y }], width: S.measWidth || 1 };
      } else {
        const kind = S.tool === 'ruler' ? 'line' : S.tool;
        S.meas = { kind, x0: p.x, y0: p.y, x1: p.x, y1: p.y };
      }
      S.drag = { kind: 'meas' };
      redraw();
      return;
    }
    if (S.tool === 'reveal' || S.tool === 'cover') {
      if (!S.sc.fog.on) {
        S.sc.fog.on = true;
        syncBar();
      }
      S.drag = { kind: 'fog', add: S.tool === 'reveal' };
      paintFog(p, S.tool === 'reveal');
      return;
    }
    if (S.tool === 'terrain') {
      S.drag = { kind: 'terr' };
      paintTerr(p);
      return;
    }
    if (S.tool === 'prop') {
      const ex = hitProp(p);
      if (ex) {
        S.selP = ex.id;
        S.sel = null;
        S.drag = {
          kind: 'prop',
          pr: ex,
          ox: p.x / (S.sc.cell || 64) - ex.x,
          oy: p.y / (S.sc.cell || 64) - ex.y,
          moved: false,
        };
        renderSide();
        redraw();
        return;
      }
      const k = S.propSel,
        sz = PROPS[k].s,
        m = M(),
        nx = Math.max(0, Math.min(m.cols - sz, Math.round(p.x / (S.sc.cell || 64) - sz / 2))),
        ny = Math.max(0, Math.min(m.rows - sz, Math.round(p.y / (S.sc.cell || 64) - sz / 2)));
      const pr = { id: uid(), k, x: nx, y: ny, s: sz, rot: 0, hidden: false };
      S.sc.props.push(pr);
      S.selP = pr.id;
      S.sel = null;
      save();
      renderSide();
      redraw();
      return;
    }
    const tk = isPresent() ? null : hit(p);
    if (tk) {
      S.sel = tk.id;
      S.selP = null;
      S.drag = {
        kind: 'tok',
        tk,
        ox: p.x / (S.sc.cell || 64) - tk.x,
        oy: p.y / (S.sc.cell || 64) - tk.y,
        moved: false,
      };
      renderSide();
      redraw();
    } else {
      const pr = isPresent() ? null : hitProp(p);
      if (pr) {
        S.selP = pr.id;
        S.sel = null;
        S.drag = {
          kind: 'prop',
          pr,
          ox: p.x / (S.sc.cell || 64) - pr.x,
          oy: p.y / (S.sc.cell || 64) - pr.y,
          moved: false,
        };
        renderSide();
        redraw();
        return;
      }
      if (S.sel || S.selP) {
        S.sel = null;
        S.selP = null;
        renderSide();
      }
      S.drag = { kind: 'pan', sx: e.clientX, sy: e.clientY, vx: S.view.x, vy: S.view.y };
      redraw();
    }
  });
  canvas.addEventListener('pointermove', e => {
    const d = S.drag;
    if (!d) return;
    const p = toMap(e.clientX, e.clientY);
    if (d.kind === 'pan') {
      S.view.x = d.vx - (e.clientX - d.sx) / S.view.z;
      S.view.y = d.vy - (e.clientY - d.sy) / S.view.z;
      redraw();
    } else if (d.kind === 'meas') {
      if (S.meas && S.meas.kind === 'path') {
        const pts = S.meas.points,
          last = pts[pts.length - 1],
          minStep = Math.max(4, (S.sc.cell || 64) / 10);
        if (!last || Math.hypot(p.x - last.x, p.y - last.y) >= minStep) pts.push({ x: p.x, y: p.y });
      } else if (S.meas) {
        S.meas.x1 = p.x;
        S.meas.y1 = p.y;
      }
      redraw();
    } else if (d.kind === 'fog') paintFog(p, d.add);
    else if (d.kind === 'terr') paintTerr(p);
    else if (d.kind === 'prop') {
      const u = S.sc.cell || 64;
      d.pr.x = p.x / u - d.ox;
      d.pr.y = p.y / u - d.oy;
      d.moved = true;
      redraw();
    } else if (d.kind === 'tok') {
      const u = S.sc.cell || 64;
      d.tk.x = p.x / u - d.ox;
      d.tk.y = p.y / u - d.oy;
      d.moved = true;
      redraw();
    }
  });
  const end = () => {
    const d = S.drag;
    S.drag = null;
    if (!d) return;
    if (d.kind === 'tok' && d.moved) {
      const m = M();
      if (S.sc.grid.snap) {
        d.tk.x = Math.round(d.tk.x);
        d.tk.y = Math.round(d.tk.y);
      }
      d.tk.x = Math.max(0, Math.min(m.cols - (d.tk.s || 1), d.tk.x));
      d.tk.y = Math.max(0, Math.min(m.rows - (d.tk.s || 1), d.tk.y));
      save();
      redraw();
      if (R) Net.post('/act', { id: Net.id, type: 'move', tokenId: d.tk.id, x: d.tk.x, y: d.tk.y });
    } else if (d.kind === 'prop' && d.moved) {
      const m = M(),
        s = d.pr.s || 1;
      d.pr.x = Math.max(0, Math.min(m.cols - s, Math.round(d.pr.x)));
      d.pr.y = Math.max(0, Math.min(m.rows - s, Math.round(d.pr.y)));
      save();
      redraw();
    } else if (d.kind === 'terr') {
      save();
    } else if (d.kind === 'pan' || d.kind === 'fog') {
      if (!R) {
        S.sc.view = { ...S.view };
        save();
      }
    }
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('dblclick', e => {
    const tk = hit(toMap(e.clientX, e.clientY));
    if (tk && tk.ref && tk.ref.k === 'pc') openChar(tk.ref.id);
  });
  canvas.addEventListener(
    'wheel',
    e => {
      e.preventDefault();
      const p = toMap(e.clientX, e.clientY),
        k = Math.exp(-e.deltaY * 0.0015),
        nz = Math.max(0.12, Math.min(4, S.view.z * k));
      const r = canvas.getBoundingClientRect();
      S.view.z = nz;
      S.view.x = p.x - (e.clientX - r.left) / nz;
      S.view.y = p.y - (e.clientY - r.top) / nz;
      redraw();
      clearTimeout(S._wt);
      S._wt = setTimeout(() => {
        if (!R) {
          S.sc.view = { ...S.view };
          save();
        }
      }, 400);
    },
    { passive: false }
  );
  const onKey = e => {
    if (!root.isConnected) {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('keyup', onUp);
      return;
    }
    const tg = e.target;
    if ((tg && /^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName)) || document.querySelector('.ovl')) return;
    if (R) {
      if (e.key === 'Escape' && isPresent()) present(false);
      else if (e.key.toLowerCase() === 'p') present(!isPresent());
      return;
    }
    if (e.key === ' ') {
      S.space = true;
      e.preventDefault();
      canvas.style.cursor = 'grab';
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && S.sel) {
      removeTok(S.sel);
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && S.selP) {
      removeProp(S.selP);
    } else if (e.key === 'Escape') {
      if (isPresent()) present(false);
      else {
        S.sel = null;
        S.meas = null;
        renderSide();
        redraw();
      }
    } else if (e.key.toLowerCase() === 'v') setTool('move');
    else if (e.key.toLowerCase() === 'r') setTool('ruler');
    else if (e.key.toLowerCase() === 'o') setTool('circle');
    else if (e.key.toLowerCase() === 'q') setTool('rect');
    else if (e.key.toLowerCase() === 'c') setTool('cone');
    else if (e.key.toLowerCase() === 'u') setTool('path');
    else if (e.key.toLowerCase() === 't') setTool('terrain');
    else if (e.key.toLowerCase() === 'b') setTool('prop');
    else if (e.key.toLowerCase() === 'p') present(!isPresent());
  };
  const onUp = e => {
    if (e.key === ' ') {
      S.space = false;
      canvas.style.cursor = '';
    }
  };
  document.addEventListener('keydown', onKey);
  document.addEventListener('keyup', onUp);

  /* --- ações --- */

  /* --- mapas: exportar imagem, salvar/importar arquivos, biblioteca --- */
  function exportPng() {
    return vttExportPng(ctx);
  }

  function libraryDialog() {
    return vttLibraryDialog(ctx);
  }
  function removeProp(id) {
    S.sc.props = S.sc.props.filter(p => p.id !== id);
    if (S.selP === id) S.selP = null;
    save();
    renderSide();
    redraw();
  }
  function setTool(tl) {
    S.tool = tl;
    renderSide();
    if (!['ruler', 'circle', 'rect', 'cone', 'path'].includes(tl)) S.meas = null;
    syncBar();
    canvas.style.cursor = tl === 'move' ? '' : 'crosshair';
    redraw();
  }
  function present(on) {
    root.classList.toggle('present', on);
    if (on) {
      S.sel = null;
      S.meas = null;
      try {
        document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
      } catch (e) {}
    } else {
      try {
        document.fullscreenElement && document.exitFullscreen();
      } catch (e) {}
    }
    setTimeout(() => {
      resize();
    }, 80);
  }
  document.addEventListener('fullscreenchange', function f() {
    if (!root.isConnected) {
      document.removeEventListener('fullscreenchange', f);
      return;
    }
    if (!document.fullscreenElement && isPresent()) present(false);
  });
  function removeTok(id) {
    S.sc.tokens = S.sc.tokens.filter(k => k.id !== id);
    if (S.sel === id) S.sel = null;
    save();
    renderSide();
    redraw();
  }
  function activate(auto) {
    const sc = S.sc;
    if (sc.amb && AMB[sc.amb]) Snd.startAmb(sc.amb);
    if (sc.mus) Snd.playMusic(sc.mus);
  }
  function switchScene(id) {
    V.cur = id;
    S.sc = V.scenes.find(s => s.id === id);
    S.sel = null;
    S.meas = null;
    S.dirtyFog = true;
    Store.save();
    S.view = S.sc.view ? { ...S.sc.view } : null;
    if (!S.view) fit();
    syncBar();
    renderSide();
    redraw();
    if (S.sc.auto) activate(true);
  }
  function nextTurn() {
    const { ents } = mesaEnts();
    if (!ents.length) {
      toast(
        L3(
          'Nenhuma ficha na Mesa do mestre.',
          'No sheets on the GM table.',
          'Keine Bögen am Spielleiter-Tisch.'
        )
      );
      return;
    }
    MESA.turn++;
    if (MESA.turn >= ents.length) {
      MESA.turn = 0;
      MESA.round++;
    }
    const e = ents[MESA.turn],
      tk = S.sc.tokens.find(k => k.ref && k.ref.k === (e.k === 'pc' ? 'pc' : 'npc') && k.ref.id === e.o.id);
    if (tk) {
      const m = M(),
        u = S.sc.cell || 64,
        s = tk.s || 1;
      S.view.x = (tk.x + s / 2) * u - S.W / S.view.z / 2;
      S.view.y = (tk.y + s / 2) * u - S.H / S.view.z / 2;
    }
    renderSide();
    redraw();
  }
  function addTokens() {
    return vttAddTokens(ctx);
  }
  function revealAround() {
    const u = S.sc.cell || 64,
      m = M();
    S.sc.fog.on = true;
    S.sc.tokens.forEach(tk => {
      const info = vTokInfo(tk);
      if (!info || info.role !== 'pj') return;
      const cx = Math.floor(tk.x + (tk.s || 1) / 2),
        cy = Math.floor(tk.y + (tk.s || 1) / 2);
      for (let dx = -4; dx <= 4; dx++)
        for (let dy = -4; dy <= 4; dy++)
          if (dx * dx + dy * dy <= 17 && cx + dx >= 0 && cy + dy >= 0 && cx + dx < m.cols && cy + dy < m.rows)
            S.sc.fog.rev[cx + dx + ',' + (cy + dy)] = 1;
    });
    S.dirtyFog = true;
    save();
    syncBar();
    redraw();
  }

  /* --- diálogo do cenário --- */
  function sceneDialog() {
    return vttSceneDialog(ctx);
  }

  /* --- barra e painel --- */
  function syncBar() {
    return vttSyncBar(ctx);
  }
  async function newScene() {
    const nm = h('input', {
      type: 'text',
      placeholder: L3('Ex.: Porto de Loguetown', 'E.g. Harbor town', 'z. B. Hafenstadt'),
    });
    let pre = 'masmorra',
      sizePreset = 'medium';
    const sel = h(
      'select',
      BG_ORDER.map(id => h('option', { value: id }, tr(BGS[id].n)))
    );
    sel.onchange = () => {
      pre = sel.value;
    };
    const sizeSel = h(
      'select',
      { onchange: e => (sizePreset = e.target.value) },
      h('option', { value: 'small' }, L3('Pequeno — 20 × 20', 'Small — 20 × 20', 'Klein — 20 × 20')),
      h('option', { value: 'medium', selected: true }, L3('Médio — 40 × 40', 'Medium — 40 × 40', 'Mittel — 40 × 40')),
      h('option', { value: 'large' }, L3('Grande — 80 × 80', 'Large — 80 × 80', 'Groß — 80 × 80'))
    );
    modal({
      title: L3('Nova cena', 'New scene', 'Neue Szene'),
      body: h(
        'div',
        h('label.f', L3('Nome', 'Name', 'Name'), nm),
        h('label.f', L3('Tamanho do mapa', 'Map size', 'Kartengröße'), sizeSel),
        h('label.f', L3('Ambiente inicial', 'Starting environment', 'Start-Umgebung'), sel)
      ),
      actions: [
        { label: t('cancel'), onClick: () => syncBar() },
        {
          label: t('add'),
          primary: true,
          onClick: () => {
            const s = vNewScene(nm.value.trim(), sel.value, sizePreset);
            V.scenes.push(s);
            Store.save();
            renderVTT(s.id);
          },
        },
      ],
      onClose: () => syncBar(),
    });
  }
  function renderSide() {
    return vttRenderSide(ctx);
  }
  function renderSideRemote() {
    return vttRenderSideRemote(ctx);
  }
  const chatLog = h('div.cl'),
    chatIn = h('input', {
      type: 'text',
      placeholder: L3('Mensagem…', 'Message…', 'Nachricht…'),
      onkeydown: e => {
        if (e.key === 'Enter' && e.target.value.trim()) {
          Net.say(e.target.value.trim(), 'chat');
          e.target.value = '';
        }
      },
    });
  const chatBox = h(
    'div.vtt-chat' + (Net.role ? '' : '.off'),
    h('div.ch', { onclick: () => chatBox.classList.toggle('min') }, '💬 Chat'),
    chatLog,
    chatIn
  );
  const drawChat = () => {
    chatLog.replaceChildren(
      ...Net.chat
        .slice(-40)
        .map(m =>
          m.kind === 'system'
            ? h('div.system', m.text)
            : h(
                'div.' + (m.kind === 'roll' ? 'roll' : 'msg') + (m.gm ? '.gm' : ''),
                h('b', m.from + ': '),
                m.text
              )
        )
    );
    chatLog.scrollTop = 1e9;
  };
  stage.append(chatBox);
  drawChat();
  Net.hooks = {
    chat: () => {
      if (root.isConnected) drawChat();
    },
    players: () => {
      if (root.isConnected) {
        renderSide();
        syncBar();
      }
    },
    redraw: () => {
      if (root.isConnected) redraw();
    },
    status: () => {
      if (root.isConnected) {
        chatBox.classList.toggle('off', !Net.role);
        syncBar();
      }
    },
    snap: sc => {
      if (!R || !root.isConnected) {
        if (R) renderVTT(null, { remote: true });
        return;
      }
      const keep =
          S.drag && S.drag.kind === 'tok' ? { id: S.drag.tk.id, x: S.drag.tk.x, y: S.drag.tk.y } : null,
        old = S.sc;
      S.sc = sc;
      V.scenes[0] = sc;
      V.cur = sc.id;
      if (keep) {
        const t2 = sc.tokens.find(k => k.id === keep.id);
        if (t2) {
          t2.x = keep.x;
          t2.y = keep.y;
          S.drag.tk = t2;
        }
      }
      if (old.id !== sc.id) {
        S.view = null;
        fit();
      }
      S.dirtyFog = true;
      syncBar();
      renderSide();
      redraw();
    },
    move: m => {
      if (R) return;
      const tk = S.sc.tokens.find(k => k.id === m.tokenId);
      if (!tk || !(tk.owner === m.from || tk.owner === '*')) return;
      const mm = M(),
        s = tk.s || 1;
      tk.x = Math.max(0, Math.min(mm.cols - s, Math.round(m.x)));
      tk.y = Math.max(0, Math.min(mm.rows - s, Math.round(m.y)));
      Store.save();
      Net.post('/gm', { type: 'tok', tokenId: tk.id, x: tk.x, y: tk.y });
      redraw();
    },
  };
  if (Net.role === 'gm')
    Net.hooks.players = () => {
      if (root.isConnected) {
        renderSide();
      }
    };
  if (R) {
    S.sc = Net.scene;
  }
  syncBar();
  renderSide();
  resize();
  S.view = !R && S.sc.view ? { ...S.sc.view } : null;
  if (!S.view) fit();
  redraw();
  if (S.sc.auto) activate(true);
  vRefreshHP();
}
