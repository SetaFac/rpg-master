/* ===== Leitor de .xlsx (sem bibliotecas) + importador para "grid" ===== */
async function inflateRaw(u8) {
  const ds = new DecompressionStream('deflate-raw');
  return new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(ds)).arrayBuffer());
}
async function readZip(buf) {
  const dv = new DataView(buf);
  let e = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 70000); i--)
    if (dv.getUint32(i, true) === 0x06054b50) {
      e = i;
      break;
    }
  if (e < 0) throw new Error('zip');
  const n = dv.getUint16(e + 10, true);
  let p = dv.getUint32(e + 16, true);
  const ent = {};
  const dec = new TextDecoder();
  for (let i = 0; i < n; i++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true),
      comp = dv.getUint32(p + 20, true),
      nl = dv.getUint16(p + 28, true),
      xl = dv.getUint16(p + 30, true),
      cl = dv.getUint16(p + 32, true),
      lo = dv.getUint32(p + 42, true);
    const name = dec.decode(new Uint8Array(buf, p + 46, nl));
    ent[name] = { method, comp, lo };
    p += 46 + nl + xl + cl;
  }
  return {
    has: n => !!ent[n],
    names: () => Object.keys(ent),
    async text(name) {
      const z = ent[name];
      if (!z) return null;
      const nl = dv.getUint16(z.lo + 26, true),
        xl = dv.getUint16(z.lo + 28, true);
      const s = z.lo + 30 + nl + xl;
      let u8 = new Uint8Array(buf, s, z.comp);
      if (z.method === 8) u8 = await inflateRaw(u8);
      else if (z.method !== 0) throw new Error('zip method');
      return dec.decode(u8);
    },
  };
}
const xml = s => new DOMParser().parseFromString(s, 'application/xml');
const kids = (el, tag) => [...el.getElementsByTagName(tag)];
const tx = el => (el ? el.textContent : '');

function themeColors(doc) {
  const out = [];
  if (!doc) return out;
  const cs = doc.getElementsByTagName('a:clrScheme')[0];
  if (!cs) return out;
  for (const k of [
    'dk1',
    'lt1',
    'dk2',
    'lt2',
    'accent1',
    'accent2',
    'accent3',
    'accent4',
    'accent5',
    'accent6',
  ]) {
    const el = cs.getElementsByTagName('a:' + k)[0];
    if (!el) {
      out.push('000000');
      continue;
    }
    const c = el.firstElementChild;
    out.push(c.getAttribute('lastClr') || c.getAttribute('val') || '000000');
  }
  return out;
}
const INDEXED = [
  '000000',
  'FFFFFF',
  'FF0000',
  '00FF00',
  '0000FF',
  'FFFF00',
  'FF00FF',
  '00FFFF',
  '000000',
  'FFFFFF',
  'FF0000',
  '00FF00',
  '0000FF',
  'FFFF00',
  'FF00FF',
  '00FFFF',
  '800000',
  '008000',
  '000080',
  '808000',
  '800080',
  '008080',
  'C0C0C0',
  '808080',
  '9999FF',
  '993366',
  'FFFFCC',
  'CCFFFF',
  '660066',
  'FF8080',
  '0066CC',
  'CCCCFF',
  '000080',
  'FF00FF',
  'FFFF00',
  '00FFFF',
  '800080',
  '800000',
  '008080',
  '0000FF',
  '00CCFF',
  'CCFFFF',
  'CCFFCC',
  'FFFF99',
  '99CCFF',
  'FF99CC',
  'CC99FF',
  'FFCC99',
  '3366FF',
  '33CCCC',
  '99CC00',
  'FFCC00',
  'FF9900',
  'FF6600',
  '666699',
  '969696',
  '003366',
  '339966',
  '003300',
  '333300',
  '993300',
  '993366',
  '333399',
  '333333',
];
function resolveColor(el, theme) {
  if (!el) return null;
  let hex = null;
  if (el.hasAttribute('rgb')) hex = el.getAttribute('rgb').slice(-6);
  else if (el.hasAttribute('theme'))
    hex = theme[[1, 0, 3, 2, 4, 5, 6, 7, 8, 9][parseInt(el.getAttribute('theme'))] ?? 0] || '000000';
  else if (el.hasAttribute('indexed')) hex = INDEXED[parseInt(el.getAttribute('indexed'))] || null;
  else if (el.getAttribute('auto')) return null;
  if (!hex) return null;
  const tint = parseFloat(el.getAttribute('tint') || '0');
  if (tint) {
    const n = parseInt(hex, 16);
    const ch = [n >> 16, (n >> 8) & 255, n & 255].map(c =>
      Math.round(tint > 0 ? c + (255 - c) * tint : c * (1 + tint))
    );
    hex = ch.map(c => c.toString(16).padStart(2, '0')).join('');
  }
  return '#' + hex.toLowerCase();
}
const lum = hex => {
  if (!hex) return 1;
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
};

async function parseXlsx(buf) {
  const z = await readZip(buf);
  const wb = xml(await z.text('xl/workbook.xml'));
  const rels = xml(await z.text('xl/_rels/workbook.xml.rels'));
  const relMap = {};
  kids(rels, 'Relationship').forEach(r => (relMap[r.getAttribute('Id')] = r.getAttribute('Target')));
  const sst = [];
  const ssx = await z.text('xl/sharedStrings.xml');
  if (ssx)
    kids(xml(ssx), 'si').forEach(si => {
      let s = '';
      [...si.children].forEach(ch => {
        if (ch.tagName === 't') s += ch.textContent;
        else if (ch.tagName === 'r') kids(ch, 't').forEach(t => (s += t.textContent));
      });
      sst.push(s);
    });
  const theme = themeColors(
    (await z.text('xl/theme/theme1.xml')) ? xml(await z.text('xl/theme/theme1.xml')) : null
  );
  // estilos
  const sx = await z.text('xl/styles.xml');
  const fonts = [],
    fills = [],
    borders = [],
    xfs = [];
  if (sx) {
    const sd = xml(sx);
    const fe = sd.getElementsByTagName('fonts')[0];
    if (fe)
      [...fe.children].forEach(f =>
        fonts.push({
          b: !!f.getElementsByTagName('b')[0],
          i: !!f.getElementsByTagName('i')[0],
          sz: parseFloat(f.getElementsByTagName('sz')[0]?.getAttribute('val') || 11),
          color: resolveColor(f.getElementsByTagName('color')[0], theme),
        })
      );
    const le = sd.getElementsByTagName('fills')[0];
    if (le)
      [...le.children].forEach(f => {
        const pf = f.getElementsByTagName('patternFill')[0];
        const t = pf && pf.getAttribute('patternType');
        fills.push(pf && t === 'solid' ? resolveColor(pf.getElementsByTagName('fgColor')[0], theme) : null);
      });
    const be = sd.getElementsByTagName('borders')[0];
    if (be)
      [...be.children].forEach(b => {
        const side = n => {
          const e = b.getElementsByTagName(n)[0];
          return !!(e && e.getAttribute('style'));
        };
        borders.push({ l: side('left'), r: side('right'), t: side('top'), b: side('bottom') });
      });
    const xe = sd.getElementsByTagName('cellXfs')[0];
    if (xe)
      [...xe.children].forEach(x => {
        const al = x.getElementsByTagName('alignment')[0];
        xfs.push({
          font: +x.getAttribute('fontId') || 0,
          fill: +x.getAttribute('fillId') || 0,
          border: +x.getAttribute('borderId') || 0,
          h: al && al.getAttribute('horizontal'),
          v: al && al.getAttribute('vertical'),
          wrap: al && al.getAttribute('wrapText') === '1',
        });
      });
  }
  const sheets = [];
  for (const s of kids(wb, 'sheet')) {
    const name = s.getAttribute('name');
    let tgt =
      relMap[s.getAttribute('r:id')] ||
      relMap[s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id')];
    if (!tgt) continue;
    tgt = tgt.replace(/^\//, '');
    const path = tgt.startsWith('xl/') ? tgt : 'xl/' + tgt;
    const sd = xml(await z.text(path));
    const cells = {};
    let maxR = 0,
      maxC = 0;
    const shared = {};
    const fmtEl = sd.getElementsByTagName('sheetFormatPr')[0];
    const defW = parseFloat(
        fmtEl?.getAttribute('defaultColWidth') || fmtEl?.getAttribute('baseColWidth') || 8.43
      ),
      defH = parseFloat(fmtEl?.getAttribute('defaultRowHeight') || 15);
    const colsW = [];
    kids(sd, 'col').forEach(c =>
      colsW.push({
        min: +c.getAttribute('min'),
        max: +c.getAttribute('max'),
        w: parseFloat(c.getAttribute('width')),
        hidden: c.getAttribute('hidden') === '1',
      })
    );
    const rowsH = {};
    const hiddenRows = new Set();
    kids(sd, 'row').forEach(r => {
      const rn = +r.getAttribute('r');
      if (r.getAttribute('ht')) rowsH[rn] = parseFloat(r.getAttribute('ht'));
      if (r.getAttribute('hidden') === '1') hiddenRows.add(rn);
    });
    kids(sd, 'c').forEach(c => {
      const a = c.getAttribute('r');
      const pos = Formula.splitA1(a);
      if (!pos) return;
      const t = c.getAttribute('t');
      const fEl = c.getElementsByTagName('f')[0];
      const vEl = c.getElementsByTagName('v')[0];
      let v = null,
        f = null;
      if (t === 'inlineStr')
        v = kids(c, 't')
          .map(x => x.textContent)
          .join('');
      else if (vEl) {
        const raw = vEl.textContent;
        v =
          t === 's' ? sst[+raw] : t === 'b' ? raw === '1' : t === 'str' || t === 'e' ? raw : parseFloat(raw);
      }
      if (fEl) {
        let ft = fEl.textContent;
        if (fEl.getAttribute('t') === 'shared') {
          const si = fEl.getAttribute('si');
          if (ft) shared[si] = { f: ft, c: pos.c, r: pos.r };
          else if (shared[si])
            ft = Formula.shiftFormula(shared[si].f, pos.r - shared[si].r, pos.c - shared[si].c);
        }
        f = ft ? ft.replace(/_xlfn\./g, '').replace(/_xlws\./g, '') : null;
      }
      const sIdx = +c.getAttribute('s') || 0;
      if (v === null && !f && !sIdx) return;
      cells[a] = { v, f, s: sIdx };
      maxR = Math.max(maxR, pos.r);
      maxC = Math.max(maxC, pos.c);
    });
    const merges = kids(sd, 'mergeCell')
      .map(m => m.getAttribute('ref').split(':').map(Formula.splitA1))
      .filter(x => x.length === 2 && x[0] && x[1])
      .map(([a, b]) => [a.r, a.c, b.r, b.c]);
    merges.forEach(m => {
      maxR = Math.max(maxR, m[2]);
      maxC = Math.max(maxC, m[3]);
    });
    const dvs = [];
    kids(sd, 'dataValidation').forEach(d => {
      if (d.getAttribute('type') !== 'list') return;
      const f1 = tx(d.getElementsByTagName('formula1')[0]);
      let list = null;
      const m = /^"(.*)"$/.exec(f1);
      if (m) list = m[1].split(',');
      dvs.push({ sq: d.getAttribute('sqref').split(/\s+/), list, ref: m ? null : f1 });
    });
    sheets.push({ name, cells, merges, colsW, rowsH, hiddenRows, defW, defH, maxR, maxC, dvs });
  }
  return { sheets, sst, styles: { fonts, fills, borders, xfs } };
}

/* ---------- planilha -> modelo "grid" ---------- */
function buildGridTemplate(px, include, name, orig) {
  const report = { cells: 0, formulas: 0, bad: 0, unsup: new Set() };
  const { fonts, fills, borders, xfs } = px.styles;
  const sheetNames = new Set(px.sheets.map(s => s.name));
  const tabs = [];
  for (const sh of px.sheets) {
    if (!include.includes(sh.name)) continue;
    const refd = new Set();
    for (const a in sh.cells) {
      const f = sh.cells[a].f;
      if (!f) continue;
      try {
        const walk = n => {
          if (!n || typeof n !== 'object') return;
          if (n.n === 'ref' && (!n.sheet || n.sheet === sh.name)) refd.add(n.a);
          if (n.n === 'range' && (!n.sheet || n.sheet === sh.name)) {
            const A = Formula.splitA1(n.a),
              B = Formula.splitA1(n.b);
            if (A && B)
              for (let r = A.r; r <= B.r && r - A.r < 200; r++)
                for (let c = A.c; c <= B.c && c - A.c < 200; c++) refd.add(Formula.numToCol(c) + r);
          }
          if (n.l) walk(n.l);
          if (n.r) walk(n.r);
          if (n.x) walk(n.x);
          (n.args || []).forEach(walk);
        };
        walk(Formula.parse(f, true));
      } catch (e) {}
    }
    // refs entre planilhas
    const mergeAt = {},
      covered = new Set();
    sh.merges.forEach(m => {
      mergeAt[Formula.numToCol(m[1]) + m[0]] = m;
      for (let r = m[0]; r <= m[2]; r++)
        for (let c = m[1]; c <= m[3]; c++)
          if (!(r === m[0] && c === m[1])) covered.add(Formula.numToCol(c) + r);
    });
    // validação de dados -> opções
    const dvOpt = {};
    sh.dvs.forEach(d => {
      let list = d.list;
      if (!list && d.ref) {
        const m = /^\$?([A-Z]+)\$?(\d+):\$?([A-Z]+)\$?(\d+)$/.exec(d.ref.replace(/^'?[^!]*'?!/, ''));
        if (m) {
          list = [];
          const c1 = Formula.colToNum(m[1]),
            c2 = Formula.colToNum(m[3]);
          for (let r = +m[2]; r <= +m[4]; r++)
            for (let c = c1; c <= c2; c++) {
              const x = sh.cells[Formula.numToCol(c) + r];
              if (x && x.v !== null && x.v !== '') list.push(String(x.v));
            }
        }
      }
      if (!list) return;
      d.sq.forEach(sq => {
        const [p, q] = sq.split(':');
        const A = Formula.splitA1(p),
          B = Formula.splitA1(q || p);
        if (!A || !B) return;
        for (let r = A.r; r <= B.r; r++)
          for (let c = A.c; c <= B.c; c++) dvOpt[Formula.numToCol(c) + r] = list;
      });
    });
    const styles = [],
      styMap = {};
    const out = {};
    const styleOf = a => {
      const cell = sh.cells[a];
      const x = xfs[cell ? cell.s : 0] || {};
      const f = fonts[x.font] || {};
      const fill = fills[x.fill] || null;
      const bd = borders[x.border] || {};
      return {
        b: f.b ? 1 : 0,
        i: f.i ? 1 : 0,
        sz: f.sz,
        fg: f.color,
        bg: fill,
        h: x.h,
        v: x.v,
        wrap: x.wrap ? 1 : 0,
        bd,
      };
    };
    const addr = (r, c) => Formula.numToCol(c) + r;
    const allAddrs = new Set([...Object.keys(sh.cells), ...Object.keys(mergeAt), ...refd]);
    for (const a of allAddrs) {
      if (covered.has(a)) continue;
      const pos = Formula.splitA1(a);
      const cell = sh.cells[a] || { v: null, f: null, s: 0 };
      const m = mergeAt[a];
      let st = styleOf(a);
      if (m) {
        // bordas do perímetro da mescla
        const tr_ = styleOf(addr(m[0], m[3])),
          bl = styleOf(addr(m[2], m[1]));
        st = { ...st, bd: { l: st.bd.l, t: st.bd.t, r: tr_.bd.r, b: bl.bd.b } };
      }
      const bgl = lum(st.bg),
        fgl = lum(st.fg);
      const whiteish = c => c && lum(c) > 0.93;
      const hidden =
        cell.v !== null &&
        !cell.f &&
        ((st.fg && st.bg && Math.abs(fgl - bgl) < 0.06) || ((!st.bg || whiteish(st.bg)) && whiteish(st.fg)));
      if (hidden) continue;
      let k = null,
        t = null,
        v = cell.v;
      if (cell.f) {
        k = 'ca';
        report.formulas++;
        try {
          const ast = Formula.parse(cell.f, true);
          Formula.unsupportedFns(ast).forEach(x => report.unsup.add(x));
        } catch (e) {
          report.bad++;
        }
      } else if (typeof v === 'boolean') {
        k = 'in';
        t = 'b';
      } else if (typeof v === 'number') {
        k = 'in';
        t = 'n';
      } else if (typeof v === 'string' && v.trim() !== '') {
        if (/^[-—–]$/.test(v.trim())) {
          k = 'in';
          t = 's';
          v = '';
        } else if (
          !st.b &&
          st.bg &&
          lum(st.bg) > 0.97 &&
          st.h !== 'center' &&
          (m || st.bd.l || st.bd.r || st.bd.t || st.bd.b)
        ) {
          k = 'in';
          t = 's';
        } else {
          k = 'lb';
        }
      } else {
        // vazio
        const bigEmpty = m && (m[2] - m[0] + 1) * (m[3] - m[1] + 1) >= 2 && (!st.bg || bgl > 0.55);
        if (refd.has(a)) {
          k = 'in';
          t = 'n';
          v = null;
        } else if (bigEmpty) {
          k = 'in';
          t = 's';
          v = null;
        } else if (dvOpt[a]) {
          k = 'in';
          t = 's';
          v = null;
        }
      }
      if (!k) {
        if ((st.bd && (st.bd.l || st.bd.r || st.bd.t || st.bd.b)) || st.bg) {
          k = 'lb';
          v = '';
        } else continue;
      }
      if (dvOpt[a] && k === 'in') t = 's';
      const sk = JSON.stringify([
        st.b,
        st.i,
        st.sz,
        st.fg,
        st.bg,
        st.h,
        st.v,
        st.wrap,
        st.bd.l,
        st.bd.r,
        st.bd.t,
        st.bd.b,
      ]);
      if (styMap[sk] === undefined) {
        styMap[sk] = styles.length;
        styles.push({
          b: st.b || undefined,
          i: st.i || undefined,
          z: st.sz && st.sz !== 11 ? st.sz : undefined,
          fg: st.fg || undefined,
          bg: st.bg || undefined,
          h: st.h || undefined,
          va: st.v || undefined,
          w: st.wrap || undefined,
          bd:
            (st.bd.t ? 't' : '') + (st.bd.r ? 'r' : '') + (st.bd.b ? 'b' : '') + (st.bd.l ? 'l' : '') ||
            undefined,
        });
      }
      const o = { k, s: styMap[sk] };
      if (t) o.t = t;
      if (v !== null && v !== undefined && v !== '') o.v = v;
      if (cell.f) {
        o.f = cell.f;
        if (cell.v !== null && cell.v !== undefined) o.c = cell.v;
      }
      if (m) o.m = [m[2] - m[0] + 1, m[3] - m[1] + 1];
      if (dvOpt[a] && k === 'in') o.o = dvOpt[a];
      out[a] = o;
      report.cells++;
    }
    // larguras e alturas
    const cols = [];
    for (let c = 1; c <= sh.maxC; c++) {
      let w = sh.defW;
      for (const d of sh.colsW) if (c >= d.min && c <= d.max) w = d.hidden ? 0 : d.w;
      cols.push(Math.max(0, Math.round(w * 7 + 5)));
    }
    const rows = [];
    for (let r = 1; r <= sh.maxR; r++)
      rows.push(sh.hiddenRows.has(r) ? 0 : Math.round((sh.rowsH[r] || sh.defH) * 1.333));
    tabs.push({
      id: slug(sh.name) + '_' + tabs.length,
      title: sh.name,
      blocks: [
        {
          type: 'grid',
          id: 'g' + tabs.length,
          sheet: sh.name,
          span: 12,
          orig: !!orig,
          cols,
          rows,
          styles,
          cells: out,
        },
      ],
    });
  }
  const tpl = { id: 'xl-' + uid(), rev: 1, builtin: false, name, desc: '', icon: '▦', theme: 'carta', tabs };
  return { tpl, report };
}

async function importXlsx(file) {
  const wait = modal({ title: t('xlsxTitle'), body: h('p', t('xlsxReading')), actions: [] });
  let px;
  try {
    px = await parseXlsx(await file.arrayBuffer());
  } catch (e) {
    console.error(e);
    wait.close();
    toast(t('xlsxErr'));
    return;
  }
  wait.close();
  const nm = h('input', { type: 'text', value: file.name.replace(/\.xlsx?m?$/i, '') });
  const checks = px.sheets.map(s =>
    h(
      'label',
      { style: { display: 'flex', gap: '8px', alignItems: 'center', margin: '4px 0' } },
      h('input', { type: 'checkbox', checked: true, style: { width: 'auto' }, 'data-n': s.name }),
      s.name,
      h('span.muted', Object.keys(s.cells).length + ' ' + (LANG === 'pt' ? 'células' : 'cells'))
    )
  );
  const orig = h('input', { type: 'checkbox', style: { width: 'auto' } });
  const body = h(
    'div',
    h('label.f', t('sysName'), nm),
    h('div.lab', t('xlsxSheets')),
    h('div', { style: { margin: '6px 0 12px' } }, checks),
    h('label', { style: { display: 'flex', gap: '8px', alignItems: 'center' } }, orig, t('xlsxOrig')),
    h('p.hint', t('xlsxHelp'))
  );
  modal({
    title: t('xlsxTitle'),
    body,
    actions: [
      { label: t('cancel') },
      {
        label: t('xlsxMake'),
        primary: true,
        onClick: () => {
          const inc = checks
            .map(c => c.firstChild)
            .filter(i => i.checked)
            .map(i => i.dataset.n);
          if (!inc.length) return false;
          const { tpl, report } = buildGridTemplate(px, inc, nm.value.trim() || file.name, orig.checked);
          Store.data.systems[tpl.id] = tpl;
          Store.save();
          const ch = {
            id: uid(),
            tplId: tpl.id,
            name: nm.value.trim(),
            v: {},
            g: {},
            created: Date.now(),
            updated: Date.now(),
          };
          Store.data.chars[ch.id] = ch;
          Store.save();
          openChar(ch.id);
          toast(
            t('xlsxReport', report.cells, report.formulas) +
              (report.unsup.size ? ' · ' + t('xlsxUnsup', [...report.unsup].join(', ')) : ''),
            6500
          );
          setTimeout(() => {
            App.edit = true;
            document.body.classList.add('editing');
            renderChar();
            toast(t('xlsxHelp'), 9000);
          }, 400);
        },
      },
    ],
  });
}

/* ---------- desenho do grid ---------- */
function fmtX(v) {
  if (v === null || v === undefined) return '';
  if (Array.isArray(v)) v = v[0];
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (typeof v === 'number') return String(Math.round(v * 1e6) / 1e6);
  return String(v);
}
function renderGrid(b) {
  const rt = App.rt;
  const sheet = b.sheet;
  const wrap = h('div.xcard' + (b.orig ? '.xorig' : ''));
  const g = h('div.xgrid', {
    style: {
      gridTemplateColumns: b.cols.map(w => w + 'px').join(' '),
      gridTemplateRows: b.rows.map(x => x + 'px').join(' '),
    },
  });
  for (const a in b.cells) {
    const c = b.cells[a];
    const pos = Formula.splitA1(a);
    if (!pos) continue;
    const st = b.styles[c.s] || {};
    const rs = c.m ? c.m[0] : 1,
      cs = c.m ? c.m[1] : 1;
    const cls = ['xc'];
    if (st.b) cls.push('b');
    if (st.h === 'center' || st.h === 'centerContinuous') cls.push('ctr');
    else if (st.h === 'right') cls.push('r');
    if (st.w) cls.push('wrap');
    if (st.va === 'top') cls.push('top');
    else if (st.va === 'bottom') cls.push('bot');
    if (st.bg) {
      const l = lum(st.bg);
      if (l < 0.35) cls.push('fill-d');
      else if (l < 0.85) cls.push('fill-m');
      else if (l < 0.98) cls.push('fill-l');
    }
    if (c.k === 'ca') cls.push('cal');
    if (c.k === 'in') cls.push('in');
    if (App.edit) cls.push('k-' + (c.k === 'in' ? 'in' : c.k === 'ca' ? 'ca' : 'lb'), 'sel-edit');
    const style = { gridArea: `${pos.r} / ${pos.c} / span ${rs} / span ${cs}` };
    if (st.z) style.fontSize = Math.round(st.z * 1.1) + 'px';
    if (st.bd) {
      style.borderWidth = ['t', 'r', 'b', 'l'].map(s => (st.bd.includes(s) ? '1px' : '0')).join(' ');
      style.borderStyle = 'solid';
      style.borderColor = 'var(--line)';
    }
    if (b.orig) {
      if (st.bg) style['--bgc'] = st.bg;
      if (st.fg) style['--fgc'] = st.fg;
    }
    if (st.i) style.fontStyle = 'italic';
    const el = h('div', { class: cls.join(' '), style, 'data-a': a });
    if (c.k === 'lb') {
      el.append(h('span', fmtX(c.v)));
    } else if (c.k === 'ca') {
      const sp = h('span');
      el.append(sp);
      App.binds.push(() => {
        const v = rt.cellVal(sheet, a);
        sp.textContent = fmtX(v);
        const e = rt.errs[sheet + '!' + a];
        el.classList.toggle('err', !!e || (typeof v === 'string' && /^#[A-Z/0!?]+$/.test(v)));
        el.title = e || '';
      });
    } else if (c.k === 'in' && !App.edit) {
      const cur = rt.cellVal(sheet, a);
      let inp;
      if (c.t === 'b') {
        inp = h('input', { type: 'checkbox', checked: !!cur });
        inp.addEventListener('change', () => {
          rt.setCellG(sheet, a, inp.checked);
          changed();
        });
        el.classList.add('ctr');
        inp = h('label.chk', inp, h('i'));
      } else if (c.o) {
        inp = h(
          'select',
          h('option', { value: '' }, '—'),
          c.o.map(o => h('option', { value: o }, o))
        );
        inp.value = cur === null || cur === undefined ? '' : String(cur);
        inp.addEventListener('change', () => {
          rt.setCellG(sheet, a, inp.value);
          changed();
        });
      } else if (c.t === 'n') {
        inp = h('input', {
          type: 'number',
          step: 'any',
          value: cur === null || cur === undefined ? '' : cur,
        });
        inp.addEventListener('input', () => {
          rt.setCellG(sheet, a, inp.value === '' ? null : parseFloat(inp.value));
          changed();
        });
        inp.style.textAlign = 'center';
      } else if (rs > 2 || cs > 6) {
        inp = h('textarea', { value: cur ?? '' });
        inp.value = cur ?? '';
        inp.addEventListener('input', () => {
          rt.setCellG(sheet, a, inp.value);
          changed();
        });
      } else {
        inp = h('input', { type: 'text', value: cur ?? '' });
        inp.addEventListener('input', () => {
          rt.setCellG(sheet, a, inp.value);
          changed();
        });
      }
      el.append(inp);
    } else if (c.k === 'in') {
      el.append(h('span', c.t === 'b' ? '☐' : fmtX(c.v) || '▭'));
    }
    if (App.edit && c.k !== 'ca')
      el.addEventListener('click', () => {
        if (c.k === 'in') {
          c.k = 'lb';
          delete c.t;
        } else {
          c.k = 'in';
          c.t = typeof c.v === 'boolean' ? 'b' : typeof c.v === 'number' ? 'n' : 's';
        }
        commitTpl(false);
        App.rerender();
      });
    g.append(el);
  }
  const bar = h(
    'div',
    { style: { display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' } },
    h(
      'button.btn.sm',
      {
        type: 'button',
        onclick: async () => {
          if (!(await ensureEditable())) return;
          const blk = App.tpl.tabs.flatMap(x => x.blocks).find(x => x.type === 'grid' && x.sheet === sheet);
          blk.orig = !blk.orig;
          commitTpl(false);
          App.rerender();
        },
      },
      '🎨 ' + t('origColors') + (b.orig ? ' ✓' : '')
    ),
    App.edit ? h('span.hint', { style: { margin: 0 } }, t('gridEditOn')) : null
  );
  wrap.append(bar, g);
  const fit = () => {
    g.style.zoom = 1;
    const w = wrap.clientWidth - 22,
      gw = g.scrollWidth;
    if (gw > w && w > 100) g.style.zoom = (w / gw).toFixed(3);
  };
  requestAnimationFrame(() => {
    fit();
    try {
      new ResizeObserver(() => fit()).observe(wrap);
    } catch (e) {}
  });
  return wrap;
}
