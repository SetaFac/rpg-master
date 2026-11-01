/* ===== Renderização dos blocos ===== */
const App = {
  ch: null,
  tpl: null,
  rt: null,
  tab: null,
  edit: false,
  binds: [],
  collapsed: new Set(),
  hudBinds: [],
};

const Roller = {
  hist: [],
  adv: 0,
  push(e) {
    this.hist.unshift(e);
    if (this.hist.length > 60) this.hist.pop();
    renderDiceLog();
  },
  roll(title, expr, o = {}) {
    const p = parseDice(expr);
    if (!p) {
      toast(t('noDice'));
      return null;
    }
    const first = p.terms[0];
    const useAdv = o.d20 || (first && first.f === 20 && first.n === 1 && p.terms.length <= 3);
    const res = rollParsed(p, { adv: useAdv ? this.adv : 0 });
    if (o.d20 && App.tpl && App.tpl.rollMods) {
      for (const m of App.tpl.rollMods) {
        let v = 0;
        try {
          v = Formula.num(App.rt.evalF(m.f), true);
        } catch (e) {}
        if (v) {
          res.total += v;
          res.parts.push({ sign: v < 0 ? -1 : 1, c: Math.abs(v), label: tr(m.label) });
        }
      }
    }
    const detail =
      partsText(res.parts) +
      (res.parts.some(x => x.label)
        ? ' (' +
          res.parts
            .filter(x => x.label)
            .map(x => x.label)
            .join(', ') +
          ')'
        : '');
    const crit = res.d20 && res.nat === 20,
      fail = res.d20 && res.nat === 1;
    const entry = {
      title: title || p.expr,
      expr: p.expr,
      total: res.total,
      detail,
      crit,
      fail,
      adv: useAdv ? this.adv : 0,
    };
    this.hist.unshift(entry);
    if (this.hist.length > 60) this.hist.pop();
    toastRoll(entry);
    renderDiceLog();
    try {
      Net.roll(entry);
    } catch (e) {}
    try {
      if (Store.data.prefs.rollSnd) Snd.play(entry.crit ? 'critico' : entry.fail ? 'falha' : 'dado', 0.7);
    } catch (e) {}
    return entry;
  },
};

function changed() {
  App.rt.invalidate();
  App.refresh();
  saveSoon();
  App.ch.updated = Date.now();
  updateName();
}
App.refresh = () => {
  App.binds.forEach(f => {
    try {
      f();
    } catch (e) {
      console.warn(e);
    }
  });
  App.hudBinds.forEach(f => {
    try {
      f();
    } catch (e) {}
  });
};
App.rerender = () => {
  const sc = window.scrollY;
  renderTab();
  window.scrollTo(0, sc);
};

/* ---------- campos ---------- */
function applySuggest(def, value) {
  const it = (def.suggest || []).find(s => String(s.value).toLowerCase() === String(value).toLowerCase());
  if (!it || !it.set || !Object.keys(it.set).length) return;
  for (const k in it.set) App.rt.setPath(k, it.set[k]);
  toast(t('applied', it.value));
  changed();
  App.rerender();
}
let _dl = 0;
function control(def, io) {
  const k = def.kind;
  let el;
  const raw = io.raw();
  const shown =
    raw !== undefined && raw !== null && raw !== '' ? raw : io.dflt() !== undefined ? io.dflt() : '';
  const ph = tr(def.placeholder);
  if (k === 'number') {
    el = h('input', {
      type: 'number',
      value: shown,
      placeholder: ph,
      step: def.step || 1,
      min: def.min,
      max: def.max,
      'aria-label': tr(def.label),
    });
    el.addEventListener('input', () => {
      io.set(el.value === '' ? undefined : parseFloat(el.value));
      changed();
    });
  } else if (k === 'area') {
    el = h('textarea', { rows: def.rows || 3, placeholder: ph, 'aria-label': tr(def.label) });
    el.value = shown;
    el.addEventListener('input', () => {
      io.set(el.value);
      changed();
    });
  } else if (k === 'check') {
    const inp = h('input', { type: 'checkbox', checked: !!io.val(), 'aria-label': tr(def.label) });
    inp.addEventListener('change', () => {
      io.set(inp.checked);
      changed();
    });
    el = h('label.chk', inp, h('i'));
  } else if (k === 'select') {
    const opts = App.rt.optionsOf(def.options);
    el = h(
      'select',
      { 'aria-label': tr(def.label) },
      def.blank || !opts.length ? h('option', { value: '' }, '—') : null,
      opts.map(o => h('option', { value: String(o.v) }, o.l))
    );
    const cur = io.val();
    el.value = cur === undefined || cur === null ? '' : String(cur);
    el.addEventListener('change', () => {
      const o = opts.find(o => String(o.v) === el.value);
      io.set(o ? o.v : '');
      changed();
    });
  } else {
    // text
    const inp = h('input', { type: 'text', value: shown, placeholder: ph, 'aria-label': tr(def.label) });
    inp.addEventListener('input', () => {
      io.set(inp.value);
      changed();
    });
    el = inp;
    if (def.suggest) {
      const id = 'dl' + ++_dl;
      inp.setAttribute('list', id);
      inp.addEventListener('change', () => applySuggest(def, inp.value));
      return h(
        'div',
        { style: { display: 'contents' } },
        inp,
        h(
          'datalist',
          { id },
          def.suggest.map(s => h('option', { value: s.value }))
        )
      );
    }
  }
  return el;
}
function ioGlobal(def) {
  const id = def.id;
  return {
    raw: () => App.ch.v[id],
    dflt: () => def.def,
    val: () => App.rt.stored(id),
    set: v => App.rt.setVal(id, v),
  };
}
function ioCol(L, row, col) {
  return {
    raw: () => App.rt.rawCell(L, row, col.id),
    dflt: () => (row.def && row.def[col.id] !== undefined ? row.def[col.id] : col.def),
    val: () => App.rt.colVal(L, row, col),
    set: v => App.rt.setCell(L, row, col.id, v),
  };
}
function calcEl(def, getVal, errKey, o = {}) {
  const f = def.fmt || (def.kind === 'calc' ? 'num' : 'num');
  const sp = h('span.calc' + (f === 'text' ? '.txt' : ''));
  if (def.roll) {
    sp.classList.add('roll');
    sp.title = '🎲';
    sp.addEventListener('click', () => {
      const v = Formula.num(getVal(), true);
      Roller.roll(
        tr(o.title || def.rollTitle || def.label),
        def.rollExpr ? String(App.rt.evalF(def.rollExpr, o.scope)) : '1d20' + (v >= 0 ? '+' : '') + v,
        { d20: def.d20 }
      );
    });
  }
  App.binds.push(() => {
    const v = getVal();
    sp.textContent = App.rt.fmt(v, f);
    const e = App.rt.errs[errKey];
    sp.classList.toggle('err', !!e);
    if (e) sp.title = e;
    else if (!def.roll) sp.removeAttribute('title');
  });
  return sp;
}

function fieldBlock(f, b) {
  const span = f.span || b.fspan || 4;
  const cls = 'fld' + (f.big ? ' big' : '') + (f.tile ? ' tile' : '');
  const w = h('div', { class: cls, style: { '--s': span } });
  if (f.label && f.kind !== 'check') w.append(h('label', tr(f.label)));
  if (f.kind === 'calc') {
    if (f.override) {
      const inp = h('input.ovr', {
        type: 'number',
        step: 'any',
        value: App.ch.v[f.id + '__ov'] ?? '',
        'aria-label': tr(f.label),
        title: tr(T('Automático — digite para substituir', 'Automatic — type to override')),
      });
      inp.addEventListener('input', () => {
        if (inp.value === '') delete App.ch.v[f.id + '__ov'];
        else App.ch.v[f.id + '__ov'] = parseFloat(inp.value);
        changed();
      });
      App.binds.push(() => {
        const ov = App.ch.v[f.id + '__ov'];
        const hasOv = ov !== undefined && ov !== '';
        inp.placeholder = '';
        const auto = App.rt.calcs[f.id] ? App.rt.fmt(hasOv ? computeAuto(f) : App.rt.calc(f.id), f.fmt) : '';
        inp.placeholder = auto;
        if (document.activeElement !== inp) inp.style.fontStyle = hasOv ? 'italic' : 'normal';
      });
      w.append(inp);
    } else w.append(calcEl(f, () => App.rt.get(f.id), f.id));
  } else if (f.kind === 'check') {
    w.style.flexDirection = 'row';
    w.style.alignItems = 'center';
    w.style.gap = '8px';
    w.append(control(f, ioGlobal(f)), h('label', tr(f.label)));
  } else w.append(control(f, ioGlobal(f)));
  if (f.hint) w.append(h('div.hint', tr(f.hint)));
  return w;
}
function computeAuto(f) {
  try {
    return App.rt.evalF(f.formula);
  } catch (e) {
    return 0;
  }
}

/* ---------- blocos ---------- */
function shell(b, body, extraCls) {
  const card = h(
    'div',
    { class: 'card' + (b.plain ? ' plain' : '') + (extraCls ? ' ' + extraCls : '') },
    b.title && !b.plain ? h('h3', tr(b.title)) : null,
    h('div.body', body, b.hint ? h('div.hint', tr(b.hint)) : null)
  );
  return card;
}
function renderFields(b) {
  const g = h(
    'div.fgrid',
    (b.fields || []).filter(f => !f.hidden).map(f => fieldBlock(f, b))
  );
  return shell(b, g);
}
function renderAttrs(b) {
  const rt = App.rt;
  const wrap = h('div.attrs');
  for (const a of b.attrs) {
    const seal = h('button.seal', { type: 'button', title: tr(b.rollLabel) + ' ' + tr(a.label) });
    const inp = h('input', {
      type: 'number',
      value: App.ch.v[a.id] ?? b.def ?? 10,
      'aria-label': tr(a.label),
      min: 0,
    });
    inp.addEventListener('input', () => {
      rt.setVal(a.id, inp.value === '' ? undefined : parseFloat(inp.value));
      changed();
    });
    seal.addEventListener('click', () => {
      const m = rt.get(a.id + '_mod');
      Roller.roll(tr(b.rollLabel) + ' ' + tr(a.label), '1d20' + (m >= 0 ? '+' : '') + m, { d20: true });
    });
    App.binds.push(() => {
      seal.textContent = rt.fmt(rt.get(a.id + '_mod'), 'signed');
    });
    wrap.append(h('div.attr', h('div.nm', tr(a.label), h('small', tr(a.abbr))), seal, inp));
  }
  const body = [wrap];
  if (b.generator)
    body.push(
      h(
        'div.addrow',
        h('button.btn.sm', { type: 'button', onclick: () => attrGenerator(b) }, '🎲 ' + t('gen'))
      )
    );
  return shell(b, body);
}
function attrGenerator(b) {
  const ids = b.attrs.map(a => a.id);
  const apply = vals => {
    ids.forEach((id, i) => App.rt.setVal(id, vals[i]));
    changed();
    App.rerender();
  };
  const body = h(
    'div',
    h(
      'p.muted',
      LANG === 'pt'
        ? 'Os valores entram na ordem dos atributos. Depois você pode ajustar cada um e somar os bônus da espécie.'
        : 'Values fill the attributes in order. You can then tweak each one and add species bonuses.'
    )
  );
  const out = h('div', {
    style: { marginTop: '10px', fontFamily: 'var(--font-display)', fontSize: '1.2rem' },
  });
  let last = null;
  const roll4 = () => {
    last = ids.map(() => {
      const r = [rnd(6), rnd(6), rnd(6), rnd(6)].sort((a, b) => a - b);
      return r[1] + r[2] + r[3];
    });
    out.textContent = last.join('  ·  ');
  };
  body.append(
    h(
      'div',
      { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
      h('button.btn', { onclick: roll4 }, t('gen4')),
      h(
        'button.btn',
        {
          onclick: () => {
            last = [15, 14, 13, 12, 10, 8];
            out.textContent = last.join('  ·  ');
          },
        },
        t('genStd')
      )
    ),
    out
  );
  modal({
    title: t('gen'),
    body,
    actions: [
      { label: t('cancel') },
      {
        label: t('ok'),
        primary: true,
        onClick: () => {
          if (last) apply(last);
        },
      },
    ],
  });
}

function resEls(b, src) {
  const rt = App.rt,
    id = src.id;
  const cur = h('input', { type: 'number', value: rt.get(id), 'aria-label': 'cur' });
  cur.addEventListener('input', () => {
    rt.setVal(id, cur.value === '' ? 0 : parseFloat(cur.value));
    changed();
  });
  const maxS = h('small');
  const bar = h('div.bar', h('i'));
  const tmpBar = h('u');
  bar.append(tmpBar);
  bar.style.setProperty('--c', src.kind === 'pp' ? 'var(--pp)' : 'var(--hp)');
  App.binds.push(() => {
    const c = rt.get(id),
      m = rt.get(id + '_max');
    if (document.activeElement !== cur) cur.value = c;
    maxS.textContent = '/ ' + rt.fmt(m, 'num');
    const pct = m > 0 ? Math.max(0, Math.min(100, (c / m) * 100)) : 0;
    bar.firstChild.style.width = pct + '%';
    bar.style.setProperty(
      '--c',
      pct <= 25 && src.kind !== 'pp' ? 'var(--bad)' : src.kind === 'pp' ? 'var(--pp)' : 'var(--hp)'
    );
    const tmp = rt.stored(id + '_temp');
    tmpBar.style.left = pct + '%';
    tmpBar.style.width = m > 0 ? Math.min(100 - pct, (tmp / m) * 100) + '%' : '0';
  });
  return { cur, maxS, bar };
}
function renderResource(b) {
  const rt = App.rt;
  const src = b.ref ? rt.res[b.ref] : b;
  if (!src) return shell(b, h('div.warn', '?'));
  const id = src.id;
  const { cur, maxS, bar } = resEls(b, src);
  const isPP = src.kind === 'pp';
  const amt = h('input', { type: 'number', min: 0, placeholder: t('amount'), 'aria-label': t('amount') });
  const go = sign => {
    const n = parseFloat(amt.value);
    if (!n) return;
    if (sign < 0) rt.damage(id, n);
    else rt.heal(id, n);
    amt.value = '';
    changed();
  };
  const quick = d =>
    h(
      'button.btn.sm',
      {
        type: 'button',
        onclick: () => {
          if (d < 0) rt.damage(id, -d);
          else rt.heal(id, d);
          changed();
        },
      },
      (d > 0 ? '+' : '−') + Math.abs(d)
    );
  const head = h(
    'div.head',
    h('div.big', cur, maxS),
    src.temp
      ? h(
          'div.tmp',
          t('temp'),
          (() => {
            const i = h('input', { type: 'number', min: 0, value: App.ch.v[id + '_temp'] ?? '' });
            i.addEventListener('input', () => {
              rt.setVal(id + '_temp', i.value === '' ? 0 : parseFloat(i.value));
              changed();
            });
            return i;
          })()
        )
      : null
  );
  const manual = src.manualMax
    ? h(
        'span.mm',
        t('manual') + ' max',
        (() => {
          const i = h('input', {
            type: 'number',
            min: 0,
            value: App.ch.v[id + '_maxman'] ?? '',
            placeholder: 'auto',
          });
          i.addEventListener('input', () => {
            if (i.value === '') delete App.ch.v[id + '_maxman'];
            else rt.setVal(id + '_maxman', parseFloat(i.value));
            changed();
          });
          return i;
        })()
      )
    : null;
  if (manual) head.append(manual);
  const ctl = h(
    'div.ctl',
    quick(-5),
    quick(-1),
    quick(1),
    quick(5),
    amt,
    h(
      'button.btn.sm',
      { type: 'button', onclick: () => go(-1) },
      isPP ? (LANG === 'pt' ? 'Gastar' : 'Spend') : t('dmg')
    ),
    h(
      'button.btn.sm',
      { type: 'button', onclick: () => go(1) },
      isPP ? (LANG === 'pt' ? 'Recuperar' : 'Recover') : t('heal')
    )
  );
  amt.addEventListener('keydown', e => {
    if (e.key === 'Enter') go(-1);
  });
  const body = [h('div.res', head, bar, ctl)];
  if (src.extras && !b.ref) {
    const gr = h(
      'div.fgrid',
      src.extras.map(f => fieldBlock(f, src))
    );
    body[0].append(
      h('details', { open: true }, h('summary', t('adjust')), h('div', { style: { marginTop: '6px' } }, gr))
    );
  } else if (src.bonus && !b.ref) {
    body[0].append(
      h(
        'details',
        h('summary', t('adjust')),
        h(
          'div.fgrid',
          { style: { marginTop: '6px' } },
          fieldBlock({ id: src.bonus, kind: 'number', label: T('Bônus', 'Bonus'), span: 4 }, src)
        )
      )
    );
  }
  const bb = { ...b, hint: b.ref ? null : src.hint };
  return shell(bb, body);
}

/* ---- listas ---- */
function rowTitle(L, row) {
  const b = App.rt.lists[L];
  const col = b.columns.find(c => c.kind === 'label') || b.columns.find(c => c.kind === 'text');
  return col ? String(App.rt.colVal(L, row, col)) : '';
}
function cellEl(b, row, col) {
  const rt = App.rt,
    L = b.id;
  const lockedOnly = col.onlyIf && !(row.def && row.def[col.onlyIf]);
  if (lockedOnly) return h('div.c');
  switch (col.kind) {
    case 'label':
      return h('div.lblc' + (col.muted ? '.mut' : ''), String(rt.colVal(L, row, col)));
    case 'calc': {
      const key = L + '|' + row.key + '|' + col.id;
      const sp = calcEl({ ...col, fmt: col.fmt || 'num' }, () => rt.colVal(L, row, col), key, {
        title: rowTitle(L, row) + (col.title ? '' : ''),
        scope: rt.rowScope(L, row),
      });
      return h('div.c', sp);
    }
    case 'rollbtn': {
      const btn = h(
        'button.btn.sm.ibtn',
        {
          type: 'button',
          title: tr(col.title),
          onclick: () => {
            let ex = '';
            try {
              ex = String(rt.evalF(col.expr, rt.rowScope(L, row)));
            } catch (e) {}
            Roller.roll((rowTitle(L, row) || tr(col.title)) + (col.title ? ' — ' + tr(col.title) : ''), ex, {
              d20: col.d20,
            });
          },
        },
        col.icon || '🎲'
      );
      return h('div.c.ctr', btn);
    }
    case 'check':
      return h(
        'div.c.ctr',
        control({ ...col, label: tr(col.label) || rowTitle(L, row) }, ioCol(L, row, col))
      );
    default: {
      const el = control(col, ioCol(L, row, col));
      if (col.compact && col.kind === 'select') el.classList.add('num');
      if (col.kind === 'number') el.classList.add('num');
      return h('div.c', el);
    }
  }
}
function listColumns(b) {
  return b.columns.filter(c => !c.hidden);
}
function colTemplate(b, dyn) {
  return (
    listColumns(b)
      .map(c => c.w || '1fr')
      .join(' ') + (dyn ? ' 26px' : '')
  );
}
function tableChunk(b, rows, dyn) {
  const rt = App.rt,
    L = b.id,
    cols = listColumns(b);
  const tbl = h('div.tbl', { style: { '--cols': colTemplate(b, dyn) } });
  tbl.append(
    h(
      'div.tr.th',
      cols.map(c =>
        h(
          'div',
          {
            style:
              c.kind === 'check' || c.kind === 'calc' || c.kind === 'rollbtn' ? { textAlign: 'center' } : {},
          },
          c.kind === 'rollbtn' ? '' : tr(c.label)
        )
      ),
      dyn ? h('div') : null
    )
  );
  let lastG = null;
  for (const row of rows) {
    const g = row.def && row.def.group;
    if (g && g !== lastG) {
      tbl.append(h('div.tr.grp', g));
      lastG = g;
    }
    const tr_ = h(
      'div.tr',
      cols.map(c => cellEl(b, row, c))
    );
    if (dyn)
      tr_.append(
        h(
          'button.btn.ghost.sm.ibtn.rowdel',
          {
            type: 'button',
            title: t('remove'),
            onclick: () => {
              rt.delRow(L, row.ix);
              changed();
              App.rerender();
            },
          },
          '✕'
        )
      );
    if (b.lock)
      App.binds.push(() => {
        let v = false;
        try {
          v = Formula.bool(rt.evalF(b.lock, rt.rowScope(L, row)));
        } catch (e) {}
        tr_.classList.toggle('dim', v);
      });
    tbl.append(tr_);
  }
  if (b.totals && rows.length) {
    const ft = h(
      'div.tr.ft',
      cols.map(c => {
        const d = h('div.c' + (c.kind === 'calc' || c.kind === 'number' ? '.ctr' : ''));
        if (b.totals[c.id] === 'sum') {
          App.binds.push(() => {
            d.textContent = rt.fmt(
              rt.get(L + '.' + c.id).reduce((a, x) => a + (parseFloat(x) || 0), 0),
              'num'
            );
          });
        } else if (c === cols[0]) d.textContent = 'Total';
        return d;
      })
    );
    if (dyn) ft.append(h('div'));
    tbl.append(ft);
  }
  return tbl;
}
function renderList(b) {
  const rt = App.rt,
    L = b.id;
  const dyn = !b.rows;
  const rows = rt.rows(L);
  if (b.display === 'cards') return renderCards(b);
  const body = [];
  if (b.split === 2 && rows.length > 3) {
    const half = Math.ceil(rows.length / 2);
    body.push(
      h('div.split2', tableChunk(b, rows.slice(0, half), false), tableChunk(b, rows.slice(half), false))
    );
  } else body.push(tableChunk(b, rows, dyn));
  if (dyn)
    body.push(
      h(
        'div.addrow',
        h(
          'button.btn.sm',
          {
            type: 'button',
            onclick: () => {
              rt.addRow(L);
              changed();
              App.rerender();
            },
          },
          '＋ ' + (tr(b.addLabel) || t('add'))
        ),
        b.catalog || b.catalogRef
          ? h(
              'button.btn.sm',
              { type: 'button', onclick: () => (b.catalogRef ? customCatalog(b) : traitCatalog(b)) },
              '📖 ' + (LANG === 'en' ? 'Catalog' : 'Catálogo')
            )
          : null
      )
    );
  if (b.footer) {
    const f = h('div.hint');
    App.binds.push(() => {
      try {
        f.textContent = String(rt.evalF(b.footer.f));
      } catch (e) {}
    });
    body.push(f);
  }
  return shell(b, body);
}
async function runAction(b, row, a) {
  const rt = App.rt,
    L = b.id,
    sc = rt.rowScope(L, row);
  const ev = s => rt.evalF(s, sc);
  let title = a.title ? String(ev(a.title)) : '';
  title = title || rowTitle(L, row) || tr(a.label);
  if (a.spend) {
    const cost = Formula.num(ev(a.spend.cost), true),
      res = a.spend.res;
    if (cost > 0) {
      if (rt.resCur(res) < cost) {
        if (a.overload) {
          const amt = Formula.num(ev(a.overload.amount), true) || 1;
          const ex = rt.stored(a.overload.field);
          if (ex + amt > (a.overload.max ?? 5)) {
            toast(t('overloadMax'));
            return;
          }
          if (!(await ask(t('overload', amt)))) return;
          rt.setVal(a.overload.field, ex + amt);
        } else {
          toast(String(res).toUpperCase() + ' < ' + cost);
          return;
        }
      } else rt.spend(res, cost);
    }
  }
  changed();
  App.refresh();
  if (a.roll)
    Roller.roll((a.spend ? '' : '') + title + ' — ' + tr(a.label), String(ev(a.roll)), { d20: a.d20 });
}
function renderCards(b) {
  const rt = App.rt,
    L = b.id;
  const rows = rt.rows(L);
  const wrap = h('div.cards', { style: { '--cc': b.cols || 3 } });
  rows.forEach((row, i) => {
    const key = L + ':' + i;
    const col = App.collapsed.has(key);
    const ttl = h('b');
    const tcol = b.columns.find(c => c.id === (b.titleField || 'nome'));
    App.binds.push(() => {
      const v = tcol ? rt.colVal(L, row, tcol) : '';
      ttl.textContent = v ? String(v) : '#' + (i + 1);
    });
    const card = h('div.cardi' + (col ? '.col' : ''));
    card.append(
      h(
        'div.ch',
        h(
          'button.btn.ghost.sm.ibtn',
          {
            type: 'button',
            onclick: () => {
              col ? App.collapsed.delete(key) : App.collapsed.add(key);
              App.rerender();
            },
          },
          col ? '▸' : '▾'
        ),
        ttl,
        h(
          'button.btn.ghost.sm.ibtn',
          {
            type: 'button',
            title: t('moveL'),
            onclick: () => {
              rt.moveRow(L, i, -1);
              changed();
              App.rerender();
            },
          },
          '↑'
        ),
        h(
          'button.btn.ghost.sm.ibtn',
          {
            type: 'button',
            title: t('moveR'),
            onclick: () => {
              rt.moveRow(L, i, 1);
              changed();
              App.rerender();
            },
          },
          '↓'
        ),
        h(
          'button.btn.ghost.sm.ibtn',
          {
            type: 'button',
            title: t('remove'),
            onclick: () => {
              rt.delRow(L, i);
              changed();
              App.rerender();
            },
          },
          '✕'
        )
      )
    );
    const g = h('div.fgrid');
    for (const c of b.columns.filter(c => !c.hidden)) {
      const w = h('div', { class: 'fld', style: { '--s': c.span || 6 } });
      if (c.label && c.kind !== 'check') w.append(h('label', tr(c.label)));
      if (c.kind === 'calc')
        w.append(
          calcEl(c, () => rt.colVal(L, row, c), L + '|' + row.key + '|' + c.id, {
            scope: rt.rowScope(L, row),
          })
        );
      else if (c.kind === 'check') {
        w.style.flexDirection = 'row';
        w.append(control(c, ioCol(L, row, c)), h('label', tr(c.label)));
      } else w.append(control(c, ioCol(L, row, c)));
      g.append(w);
    }
    card.append(g);
    if (b.actions)
      card.append(
        h(
          'div.acts',
          b.actions.map(a =>
            h(
              'button.btn.sm' + (a === b.actions[0] ? '.primary' : ''),
              { type: 'button', onclick: () => runAction(b, row, a) },
              tr(a.label)
            )
          )
        )
      );
    wrap.append(card);
  });
  const body = [
    wrap,
    h(
      'div.addrow',
      h(
        'button.btn.sm',
        {
          type: 'button',
          onclick: () => {
            rt.addRow(L);
            changed();
            App.rerender();
          },
        },
        '＋ ' + (tr(b.addLabel) || t('add'))
      ),
      b.catalog || b.catalogRef
        ? h(
            'button.btn.sm',
            {
              type: 'button',
              onclick: () =>
                b.catalogRef ? customCatalog(b) : b.catalog === true ? techCatalog(b) : traitCatalog(b),
            },
            '📖 ' + (LANG === 'en' ? 'Catalog' : 'Catálogo')
          )
        : null
    ),
  ];
  return shell(b, body);
}
function renderRandom(b) {
  const key = 'rnd_' + b.id;
  const hist = () => (Array.isArray(App.ch.v[key]) ? App.ch.v[key] : []);
  const out = h('div', { style: { marginTop: '10px', display: 'grid', gap: '4px' } });
  const draw = () => {
    out.replaceChildren(
      ...hist().map((x, i) => h('div', { style: { opacity: i ? 0.6 : 1, fontWeight: i ? 400 : 600 } }, x))
    );
  };
  const faces = b.dice ? parseInt(String(b.dice).replace(/\D/g, '')) || 0 : 0;
  const roll = () => {
    const es = b.entries || [];
    if (!es.length) return;
    let txt;
    if (faces) {
      const r = rnd(faces);
      const e = es.find(e => r >= e.from && r <= (e.to ?? e.from));
      txt = '🎲 ' + r + ' → ' + (e ? e.text : '—');
    } else {
      const i = rnd(es.length) - 1;
      txt = '🎲 ' + es[i].text;
    }
    App.ch.v[key] = [txt, ...hist()].slice(0, 6);
    changed();
    draw();
    toast(txt.replace('🎲 ', ''), 4200);
  };
  draw();
  return shell(b, [
    h(
      'div',
      h(
        'button.btn.primary.sm',
        { type: 'button', onclick: roll },
        '🎲 ' + (b.button || 'Sortear'),
        faces ? h('span', { style: { opacity: 0.7, marginLeft: '6px' } }, 'd' + faces) : null
      ),
      h(
        'button.btn.ghost.sm',
        {
          type: 'button',
          style: { marginLeft: '8px' },
          onclick: () => {
            App.ch.v[key] = [];
            changed();
            draw();
          },
        },
        'Limpar'
      )
    ),
    out,
  ]);
}
function renderNote(b) {
  return shell(
    b,
    h(
      'div.note',
      tr(b.text)
        .split('\n')
        .map(p => h('p', p))
    )
  );
}

/* ---------- bloco -> elemento ---------- */
function renderBlockBody(b) {
  switch (b.type) {
    case 'fields':
      return renderFields(b);
    case 'attrs':
      return renderAttrs(b);
    case 'resource':
      return renderResource(b);
    case 'list':
      return renderList(b);
    case 'note':
      return renderNote(b);
    case 'grid':
      return renderGrid(b);
    case 'random':
      return renderRandom(b);
    default:
      return shell(b, h('div.warn', 'Bloco desconhecido: ' + b.type));
  }
}
function renderBlock(b, idx, tab) {
  const w = h('div.blk', { style: { '--span': Math.max(1, Math.min(12, b.span || 12)) }, 'data-i': idx });
  let body;
  try {
    body = renderBlockBody(b);
  } catch (e) {
    console.error(e);
    body = shell(b, h('div.warn', 'Erro ao desenhar este bloco: ' + e.message));
  }
  w.append(body);
  if (App.edit) addEditTools(w, b, idx, tab);
  return w;
}

/* ---------- aba ---------- */
let _ro = null;
function masonry(grid) {
  if (_ro) _ro.disconnect();
  _ro = new ResizeObserver(entries => {
    for (const en of entries) {
      const blk = en.target.parentElement;
      const hgt = en.target.getBoundingClientRect().height;
      blk.style.gridRowEnd =
        'span ' +
        Math.ceil(
          (hgt + parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gap') || 14) + 1) /
            4
        );
    }
  });
  [...grid.children].forEach(c => {
    const k = c.querySelector(':scope > .card, :scope > .xcard') || c.querySelector(':scope > button');
    if (k) _ro.observe(k);
  });
}
function buildTab(tab, forPrint) {
  const grid = h('div.tabgrid');
  tab.blocks.forEach((b, i) => grid.append(renderBlock(b, i, tab)));
  if (App.edit && !forPrint)
    grid.append(
      h(
        'div.blk',
        { style: { '--span': 12 } },
        h('button.btn.primary', { type: 'button', onclick: () => addBlockDialog(tab) }, '＋ ' + t('newBlock'))
      )
    );
  return grid;
}
function renderTab() {
  const host = $('#main');
  if (!host) return;
  App.binds = [];
  const tab = App.tpl.tabs.find(x => x.id === App.tab) || App.tpl.tabs[0];
  App.tab = tab && tab.id;
  host.replaceChildren();
  if (!tab) {
    host.append(h('div.empty', 'Sem abas. Use "+" para criar.'));
    return;
  }
  const grid = buildTab(tab);
  host.append(grid);
  App.refresh();
  masonry(grid);
  if (App.edit) enableDrag(grid, tab);
}
