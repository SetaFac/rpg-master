/* ---- dados ---- */
const V_ROLE = { pj: '#3aa76d', npc: '#d9a93b', inimigo: '#d1473d' };
const V_MAP_SIZES = { small: 20, medium: 40, large: 80 };
function vSceneSizePreset(cols, rows) {
  for (const [id, size] of Object.entries(V_MAP_SIZES)) if (cols === size && rows === size) return id;
  return 'custom';
}
function vNormalizeSceneSize(sc) {
  const cell = Math.max(24, +sc.cell || 64);
  if (!sc.sizePreset && +sc.cols === 30 && +sc.rows === 20) {
    sc.cols = 40;
    sc.rows = 40;
  }
  if (!Number.isFinite(+sc.cols) || +sc.cols < 5)
    sc.cols = sc.bg && sc.bg.kind === 'img' && sc.bg.w ? Math.max(5, Math.ceil(sc.bg.w / cell)) : 40;
  if (!Number.isFinite(+sc.rows) || +sc.rows < 5)
    sc.rows = sc.bg && sc.bg.kind === 'img' && sc.bg.h ? Math.max(5, Math.ceil(sc.bg.h / cell)) : 40;
  sc.cols = Math.round(+sc.cols);
  sc.rows = Math.round(+sc.rows);
  sc.sizePreset = vSceneSizePreset(sc.cols, sc.rows);
  return sc;
}
function vResizeScene(sc, cols, rows) {
  cols = Math.max(5, Math.min(160, Math.round(+cols || 40)));
  rows = Math.max(5, Math.min(160, Math.round(+rows || 40)));
  sc.cols = cols;
  sc.rows = rows;
  sc.sizePreset = vSceneSizePreset(cols, rows);
  sc.tokens = sc.tokens || [];
  sc.props = sc.props || [];
  sc.terr = sc.terr || {};
  sc.fog = sc.fog || { on: false, rev: {} };
  sc.fog.rev = sc.fog.rev || {};
  sc.tokens.forEach(tk => {
    const sz = tk.s || 1;
    tk.x = Math.max(0, Math.min(cols - sz, tk.x || 0));
    tk.y = Math.max(0, Math.min(rows - sz, tk.y || 0));
  });
  sc.props.forEach(pr => {
    const sz = pr.s || 1;
    pr.x = Math.max(0, Math.min(cols - sz, pr.x || 0));
    pr.y = Math.max(0, Math.min(rows - sz, pr.y || 0));
  });
  sc.terr = Object.fromEntries(
    Object.entries(sc.terr).filter(([key]) => {
      const [x, y] = key.split(',').map(Number);
      return x >= 0 && y >= 0 && x < cols && y < rows;
    })
  );
  sc.fog.rev = Object.fromEntries(
    Object.entries(sc.fog.rev).filter(([key]) => {
      const [x, y] = key.split(',').map(Number);
      return x >= 0 && y >= 0 && x < cols && y < rows;
    })
  );
  if (typeof vCache !== 'undefined') {
    vCache.base = {};
    vCache.comp = {};
  }
  return sc;
}
function vNewScene(name, preset, sizePreset) {
  const sp = V_MAP_SIZES[sizePreset] ? sizePreset : 'medium';
  const size = V_MAP_SIZES[sp];
  return {
    id: uid(),
    name: name || L3('Nova cena', 'New scene', 'Neue Szene'),
    cols: size,
    rows: size,
    sizePreset: sp,
    cell: 64,
    bg: { kind: 'preset', preset: preset || 'masmorra', tint: '#4466aa', tintA: 0, dark: 0 },
    grid: { on: true, color: '#ffffff', alpha: 0.22, snap: true, unit: 1.5, unitName: 'm' },
    tokens: [],
    terr: {},
    props: [],
    fog: { on: false, rev: {} },
    amb: '',
    mus: '',
    auto: false,
    view: null,
  };
}
function vScenes() {
  return Store.data.vtt.scenes;
}
async function exportScene(sc) {
  let bgData = null;
  if (sc.bg.kind === 'img') {
    const r = await DB.get('img', sc.bg.imgId);
    if (r) bgData = await blobToData(r.blob);
  }
  const s = clone(sc);
  s.tokens.forEach(k => {
    if (k.ref) {
      const info = vTokInfo(k);
      k.name = info.name;
      k.img = info.img || k.img;
      k.role = info.role;
      k.ref = null;
    }
  });
  download(
    'cena-' + slug(sc.name) + '.json',
    JSON.stringify({ app: 'forja', ver: 1, kind: 'scene', scene: s, bgData })
  );
}
async function importScene(o, then) {
  const sc = vNormalizeSceneSize(o.scene);
  sc.id = uid();
  sc.terr = sc.terr || {};
  sc.props = (sc.props || []).map(k => ({ ...k, id: uid() }));
  sc.tokens = (sc.tokens || []).map(k => ({ ...k, id: uid(), ref: null }));
  if (sc.bg && sc.bg.kind === 'img') {
    if (o.bgData) {
      const id = uid();
      const img = await vLoadImg(o.bgData);
      await DB.put('img', {
        id,
        blob: dataToBlob(o.bgData),
        w: img ? img.naturalWidth : sc.bg.w,
        h: img ? img.naturalHeight : sc.bg.h,
      });
      sc.bg.imgId = id;
    } else sc.bg = { kind: 'preset', preset: 'masmorra' };
  }
  Store.data.vtt.scenes.push(sc);
  Store.data.vtt.cur = sc.id;
  Store.save();
  if (then === true) return sc.id;
  toast(L3('Cena importada: ', 'Scene imported: ', 'Szene importiert: ') + sc.name);
  renderVTT(sc.id);
}
async function exportAllScenes() {
  const out = [];
  for (const sc of vScenes()) {
    let bgData = null;
    if (sc.bg.kind === 'img') {
      const r = await DB.get('img', sc.bg.imgId);
      if (r) bgData = await blobToData(r.blob);
    }
    const s = clone(sc);
    s.tokens.forEach(k => {
      if (k.ref) {
        const info = vTokInfo(k);
        if (info) {
          k.name = info.name;
          k.img = info.img || k.img;
          k.role = info.role;
        }
        k.ref = null;
      }
    });
    out.push({ scene: s, bgData });
  }
  download('mapas-rpg-master.json', JSON.stringify({ app: 'forja', ver: 1, kind: 'scenes', list: out }));
  toast(out.length + ' ' + L3('mapa(s) exportado(s)', 'map(s) exported', 'Karte(n) exportiert'));
}
async function importScenes(o) {
  let last = null;
  for (const it of o.list || []) {
    last = await importScene(it, true);
  }
  if (last) {
    Store.save();
    toast((o.list || []).length + ' ' + L3('mapa(s) importado(s)', 'map(s) imported', 'Karte(n) importiert'));
    renderVTT(last);
  }
}
function vTurn(sc) {
  const { ents } = mesaEnts(),
    e = ents[MESA.turn];
  if (!e || MESA.turn < 0) return {};
  const tk = sc.tokens.find(k => k.ref && k.ref.k === (e.k === 'pc' ? 'pc' : 'npc') && k.ref.id === e.o.id);
  return { id: tk && tk.id, name: e.name };
}
/* o que os jogadores recebem: só o visível (sem névoa e sem itens ocultos) */
function vSnapshot() {
  const sc = vScenes().find(x => x.id === Store.data.vtt.cur);
  if (!sc) return null;
  const rev = sc.fog.rev;
  const vis = tk => {
    const s = tk.s || 1;
    return !sc.fog.on || rev[Math.floor(tk.x + s / 2) + ',' + Math.floor(tk.y + s / 2)];
  };
  const tokens = sc.tokens
    .filter(tk => tk.owner || (!tk.hidden && vis(tk)))
    .map(tk => {
      const i = vTokInfo(tk);
      if (!i) return null;
      let hp = null;
      if (i.hp && i.hp.max > 0)
        hp =
          i.role === 'pj' || tk.owner
            ? { cur: Math.round(i.hp.cur), max: Math.round(i.hp.max) }
            : { cur: Math.round((i.hp.cur / i.hp.max) * 100), max: 100 };
      return {
        id: tk.id,
        x: tk.x,
        y: tk.y,
        s: tk.s || 1,
        name: i.name,
        img: i.img || null,
        role: i.role,
        color: tk.color || null,
        conds: i.conds.slice(),
        hp,
        owner: tk.owner || null,
      };
    })
    .filter(Boolean);
  const tt = vTurn(sc);
  return {
    id: sc.id,
    name: sc.name,
    cols: sc.cols,
    rows: sc.rows,
    cell: sc.cell,
    bg: { ...sc.bg },
    grid: sc.grid,
    terr: sc.terr,
    props: sc.props.filter(p => !p.hidden),
    fog: { on: sc.fog.on, rev: sc.fog.rev },
    tokens,
    turn: tt.id || null,
    turnName: tt.name || '',
    round: MESA.round,
  };
}
const V_HP = {};
function vRefreshHP() {
  Object.values(Store.data.chars).forEach(c => {
    try {
      const tp = getTpl(c.tplId);
      const id = tp && tp.hud && tp.hud.resources && tp.hud.resources[0];
      if (!id) return;
      const rt = new RT(tp, c),
        cur = rt.get(id),
        max = rt.get(id + '_max');
      if (isFinite(cur) && isFinite(max) && max > 0) V_HP[c.id] = { cur, max };
    } catch (e) {}
  });
}
function vTokInfo(tk) {
  if (tk.ref && tk.ref.k === 'pc') {
    const c = Store.data.chars[tk.ref.id];
    if (!c) return null;
    const g = c.gm || {};
    return {
      name: c.name || t('unnamed'),
      img: c.portrait,
      role: g.role || 'pj',
      conds: g.conds || (g.conds = []),
      hp: V_HP[c.id],
    };
  }
  if (tk.ref && tk.ref.k === 'npc') {
    const n = (Store.data.npcs || []).find(x => x.id === tk.ref.id);
    if (!n) return null;
    n.conds = n.conds || [];
    return {
      name: n.name,
      img: n.portrait,
      role: n.role || 'inimigo',
      conds: n.conds,
      hp: n.max > 0 ? { cur: n.hp, max: n.max } : null,
    };
  }
  tk.conds = tk.conds || [];
  return { name: tk.name, img: tk.img, role: tk.role || 'npc', conds: tk.conds, hp: tk.hp || null };
}
const V_IMG = {};
function vImgEl(src, redraw) {
  if (!src) return null;
  const e = V_IMG[src];
  if (e) return e === 'x' ? null : e;
  V_IMG[src] = 'x';
  vLoadImg(src).then(i => {
    V_IMG[src] = i || 'x';
    redraw();
  });
  return null;
}
