/* ---------- exportar / importar ---------- */
const strip = tp => {
  const c = clone(tp);
  delete c.builtin;
  delete c.imported;
  return c;
};
function exportChar() {
  const ch = clone(App.ch);
  const data = { app: 'forja', ver: 1, kind: 'char', char: ch, tpl: strip(App.tpl) };
  download(fileName(ch.name || 'ficha') + '.ficha.json', JSON.stringify(data));
}
function exportSystem() {
  download(
    fileName(tr(App.tpl.name)) + '.sistema.json',
    JSON.stringify({ app: 'forja', ver: 1, kind: 'system', tpl: strip(App.tpl) })
  );
}
async function exportBackup() {
  const imgs = {};
  for (const sc of (Store.data.vtt && Store.data.vtt.scenes) || [])
    if (sc.bg && sc.bg.imgId) {
      const r = await DB.get('img', sc.bg.imgId);
      if (r) imgs[sc.bg.imgId] = await blobToData(r.blob);
    }
  download(
    'forja-backup-' + new Date().toISOString().slice(0, 10) + '.json',
    JSON.stringify({ app: 'forja', ver: 1, kind: 'backup', data: Store.data, images: imgs })
  );
}
function exportBackupOld() {
  download(
    'forja-backup-' + new Date().toISOString().slice(0, 10) + '.json',
    JSON.stringify({ app: 'forja', ver: 1, kind: 'backup', data: Store.data })
  );
}
function registerTpl(tp) {
  const ex = getTpl(tp.id);
  if (!ex) {
    tp.builtin = false;
    tp.imported = true;
    Store.data.systems[tp.id] = tp;
    return tp.id;
  }
  if (hash(JSON.stringify(strip(ex))) === hash(JSON.stringify(strip(tp)))) return tp.id;
  const nid = tp.id + '~' + hash(JSON.stringify(strip(tp))).slice(0, 6);
  if (!getTpl(nid)) {
    tp.id = nid;
    tp.name =
      typeof tp.name === 'object'
        ? { pt: tp.name.pt + ' (importado)', en: (tp.name.en || tp.name.pt) + ' (imported)' }
        : tp.name + ' (importado)';
    tp.builtin = false;
    tp.imported = true;
    Store.data.systems[nid] = tp;
  }
  return nid;
}
function importObj(o, opt = {}) {
  if (!o || o.app !== 'forja') {
    toast(t('badFile'));
    return;
  }
  if (o.kind === 'char' && o.char && o.tpl) {
    const tid = registerTpl(o.tpl);
    const ch = o.char;
    const src = ch.srcId || ch.id;
    ch.srcId = src;
    const old = opt.update ? Object.values(Store.data.chars).find(c => c.srcId === src) : null;
    ch.id = old ? old.id : uid();
    if (old && old.gm) ch.gm = old.gm;
    ch.tplId = tid;
    ch.updated = Date.now();
    ch.v = ch.v || {};
    ch.g = ch.g || {};
    Store.data.chars[ch.id] = ch;
    Store.save();
    if (opt.quiet) return { id: ch.id, updated: !!old, name: ch.name };
    toast(t('imported', ch.name || t('unnamed')));
    openChar(ch.id);
  } else if (o.kind === 'encounter' && Array.isArray(o.npcs)) {
    Store.data.encounters = Store.data.encounters || [];
    Store.data.encounters.push({
      id: uid(),
      name: o.name || 'Encontro',
      npcs: o.npcs.map(n => ({ ...n, id: undefined })),
      sheets: (o.sheets || []).map(x => {
        const tid = registerTpl(x.tpl);
        return { char: { ...x.char, tplId: tid }, tpl: undefined };
      }),
    });
    Store.save();
    if (opt.quiet) return { enc: true, name: o.name };
    toast('Encontro importado: ' + (o.name || ''));
    renderMesa();
  } else if (o.kind === 'system' && o.tpl) {
    const id = registerTpl(o.tpl);
    Store.save();
    toast(t('importedTpl', tr(getTpl(id).name)));
    App.ch ? null : renderHome();
  } else if (o.kind === 'backup' && o.data) {
    Object.assign(Store.data.chars, o.data.chars || {});
    Object.assign(Store.data.systems, o.data.systems || {});
    const have = new Set(Store.data.vtt.scenes.map(x => x.id));
    ((o.data.vtt && o.data.vtt.scenes) || []).forEach(x => {
      if (!have.has(x.id)) Store.data.vtt.scenes.push(x);
    });
    Object.entries(o.images || {}).forEach(([id, d]) =>
      DB.put('img', { id, blob: dataToBlob(d), w: 0, h: 0 })
    );
    Store.save();
    toast(t('saved'));
    goHome();
  } else if (o.kind === 'scene' && o.scene) {
    importScene(o);
  } else if (o.kind === 'scenes' && o.list) {
    importScenes(o);
  } else toast(t('badFile'));
}
async function importFile(f) {
  const n = f.name.toLowerCase();
  if (n.endsWith('.xlsx') || n.endsWith('.xlsm')) return importXlsx(f);
  try {
    importObj(JSON.parse(await f.text()));
  } catch (e) {
    toast(t('badFile'));
  }
}
function pickImport() {
  const i = h('input', {
    type: 'file',
    accept: '.json,.xlsx,.xlsm',
    style: { display: 'none' },
    onchange: () => {
      if (i.files[0]) importFile(i.files[0]);
      i.remove();
    },
  });
  document.body.append(i);
  i.click();
}
function pickXlsx() {
  const i = h('input', {
    type: 'file',
    accept: '.xlsx,.xlsm',
    style: { display: 'none' },
    onchange: () => {
      if (i.files[0]) importXlsx(i.files[0]);
      i.remove();
    },
  });
  document.body.append(i);
  i.click();
}

/* ---------- impressão ---------- */
function printSheet() {
  let root = $('#printroot');
  root.replaceChildren();
  App.binds = [];
  const keep = App.edit;
  App.edit = false;
  App.tpl.tabs.forEach(tb =>
    root.append(
      h(
        'section.pg',
        h('h2', { style: { margin: '0 0 10px' } }, (App.ch.name || '') + ' — ' + tr(tb.title)),
        buildTab(tb, true)
      )
    )
  );
  App.refresh();
  App.edit = keep;
  const after = () => {
    root.replaceChildren();
    window.removeEventListener('afterprint', after);
    renderTab();
  };
  window.addEventListener('afterprint', after);
  setTimeout(() => window.print(), 50);
}

/* ---------- arrastar arquivo ---------- */
function setupDrop() {
  let n = 0;
  window.addEventListener('dragenter', e => {
    if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) {
      n++;
      document.body.classList.add('drag');
    }
  });
  window.addEventListener('dragleave', () => {
    n = Math.max(0, n - 1);
    if (!n) document.body.classList.remove('drag');
  });
  window.addEventListener('dragover', e => {
    if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) e.preventDefault();
  });
  window.addEventListener('drop', e => {
    if (e.dataTransfer && e.dataTransfer.files.length) {
      e.preventDefault();
      n = 0;
      document.body.classList.remove('drag');
      importFile(e.dataTransfer.files[0]);
    }
  });
}
