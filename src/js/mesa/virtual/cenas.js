/* ---- dados ---- */
const V_ROLE = { pj: '#3aa76d', npc: '#d9a93b', inimigo: '#d1473d' };
function vNewScene(name, preset) {
  return {
    id: uid(),
    name: name || L3('Nova cena', 'New scene', 'Neue Szene'),
    cols: 30,
    rows: 20,
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
  const sc = o.scene;
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
