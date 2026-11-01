/* ===== Runtime: liga modelo + ficha + fórmulas ===== */
class RT {
  constructor(tpl, ch) {
    this.tpl = tpl;
    this.ch = ch;
    ch.v = ch.v || {};
    ch.g = ch.g || {};
    this.memo = new Map();
    this.errs = {};
    this.stack = [];
    this.cm = {};
    this.reindex();
  }
  invalidate() {
    this.memo.clear();
    this.errs = {};
  }

  /* ---------- índice do modelo ---------- */
  reindex() {
    this.fields = {};
    this.calcs = {};
    this.lists = {};
    this.res = {};
    this.grids = {};
    this.attrs = [];
    this.attrOpts = [];
    const regField = f => {
      if (f && f.id && !this.fields[f.id]) this.fields[f.id] = f;
      if (f && f.kind === 'calc' && f.id && !this.calcs[f.id])
        this.calcs[f.id] = { formula: f.formula, def: f };
    };
    for (const tab of this.tpl.tabs)
      for (const b of tab.blocks) {
        if (b.type === 'fields') (b.fields || []).forEach(regField);
        else if (b.type === 'attrs') {
          for (const a of b.attrs || []) {
            this.attrs.push(a);
            this.attrOpts.push({ v: a.id, l: a.abbr || a.label });
            this.fields[a.id] = this.fields[a.id] || { id: a.id, kind: 'number', def: b.def ?? 10 };
            const scope = { get: n => (n === 'v' ? this.stored(a.id) : undefined) };
            this.calcs[a.id + '_mod'] = { formula: b.mod || 'floor((v-10)/2)', scope, def: { kind: 'calc' } };
          }
        } else if (b.type === 'resource' && !b.ref) {
          this.res[b.id] = b;
          this.fields[b.id + '_temp'] = { id: b.id + '_temp', kind: 'number' };
          this.fields[b.id + '_maxman'] = { id: b.id + '_maxman', kind: 'number' };
          if (b.bonus && !this.fields[b.bonus]) this.fields[b.bonus] = { id: b.bonus, kind: 'number' };
          (b.extras || []).forEach(regField);
          this.calcs[b.id + '_max'] = { fn: () => this.maxOf(b) };
          this.calcs[b.id] = {
            fn: () => {
              const r = this.ch.v[b.id];
              return r === undefined || r === '' || r === null
                ? this.get(b.id + '_max')
                : Math.min(parseFloat(r) || 0, 99999);
            },
          };
        } else if (b.type === 'list') this.lists[b.id] = b;
        else if (b.type === 'grid') this.grids[b.sheet] = b;
      }
  }
  optionsOf(o) {
    if (o === '@attrs') return this.attrOpts.map(x => ({ v: x.v, l: tr(x.l) }));
    return (o || []).map(x =>
      typeof x === 'object' ? { v: x.v, l: tr(x.l ?? x.v) } : { v: x, l: String(x) }
    );
  }

  /* ---------- leitura ---------- */
  stored(id) {
    const f = this.fields[id];
    if (!f) return 0;
    let raw = this.ch.v[id];
    const k = f.kind;
    if (raw === undefined || raw === '' || raw === null) {
      if (f.def !== undefined) raw = f.def;
      else return k === 'number' ? 0 : k === 'check' ? false : '';
    }
    if (k === 'number') {
      const n = parseFloat(raw);
      return isNaN(n) ? 0 : n;
    }
    if (k === 'check') return !!raw;
    return raw;
  }
  err(key, msg) {
    this.errs[key] = msg;
  }
  get(name, scope) {
    if (scope) {
      const r = scope.get(name);
      if (r !== undefined) return r;
    }
    if (name.indexOf('.') > 0) return this.dotted(name);
    if (this.calcs[name]) return this.calc(name);
    if (this.fields[name]) return this.stored(name);
    return 0;
  }
  evalF(src, scope) {
    if (src === undefined || src === null || src === '') return '';
    const ast = Formula.parse(String(src), false);
    return Formula.evaluate(ast, {
      lenient: true,
      ident: n => this.get(n, scope),
      ref: () => null,
      range: () => [],
    });
  }
  calc(name) {
    if (this.memo.has(name)) return this.memo.get(name);
    if (this.stack.includes(name)) {
      this.err(name, 'Referência circular');
      return 0;
    }
    const c = this.calcs[name];
    let val = 0;
    this.stack.push(name);
    try {
      if (c.fn) val = c.fn();
      else {
        const ov = c.def && c.def.override ? this.ch.v[name + '__ov'] : undefined;
        if (ov !== undefined && ov !== '' && !isNaN(parseFloat(ov))) val = parseFloat(ov);
        else val = this.evalF(c.formula, c.scope);
      }
    } catch (e) {
      this.err(name, e.message || String(e));
      val = 0;
    }
    this.stack.pop();
    this.memo.set(name, val);
    return val;
  }
  maxOf(b) {
    const man = parseFloat(this.ch.v[b.id + '_maxman']);
    if (man > 0) return man;
    let base = 0;
    try {
      base = Formula.num(this.evalF(b.max), true);
    } catch (e) {
      this.err(b.id + '_max', e.message);
    }
    if (b.maxMin !== undefined) base = Math.max(b.maxMin, base);
    return base + (b.bonus ? this.stored(b.bonus) : 0);
  }

  /* ---------- listas ---------- */
  listArr(L) {
    let a = this.ch.v[L];
    if (!Array.isArray(a)) {
      a = [];
      const b = this.lists[L];
      for (let i = 0; i < ((b && b.seed) || 0); i++) a.push({});
      this.ch.v[L] = a;
    }
    return a;
  }
  rows(L) {
    const b = this.lists[L];
    if (!b) return [];
    if (b.rows) return b.rows.map(def => ({ key: def.key, def }));
    return this.listArr(L).map((o, i) => ({ key: i, ix: i, def: null }));
  }
  rawCell(L, row, colId) {
    const b = this.lists[L];
    let d;
    if (b.rows) {
      const m = this.ch.v[L];
      d = m && !Array.isArray(m) ? m[row.key] : undefined;
    } else d = this.listArr(L)[row.ix];
    return d ? d[colId] : undefined;
  }
  setCell(L, row, colId, v) {
    const b = this.lists[L];
    if (b.rows) {
      let m = this.ch.v[L];
      if (!m || Array.isArray(m)) m = this.ch.v[L] = {};
      (m[row.key] = m[row.key] || {})[colId] = v;
    } else {
      const a = this.listArr(L);
      (a[row.ix] = a[row.ix] || {})[colId] = v;
    }
    this.invalidate();
  }
  addRow(L, init) {
    this.listArr(L).push(init || {});
    this.invalidate();
  }
  delRow(L, ix) {
    this.listArr(L).splice(ix, 1);
    this.invalidate();
  }
  moveRow(L, ix, d) {
    const a = this.listArr(L);
    const j = ix + d;
    if (j < 0 || j >= a.length) return;
    [a[ix], a[j]] = [a[j], a[ix]];
    this.invalidate();
  }
  colMap(L) {
    return this.cm[L] || (this.cm[L] = Object.fromEntries(this.lists[L].columns.map(c => [c.id, c])));
  }
  rowScope(L, row) {
    const cm = this.colMap(L);
    return {
      get: n => {
        const c = cm[n];
        if (c) return this.colVal(L, row, c);
        if (row.def && n in row.def && n !== 'key') {
          const x = row.def[n];
          return x !== null && typeof x === 'object' ? tr(x) : x;
        }
        if (n === 'index') return row.ix === undefined ? 0 : row.ix + 1;
        return undefined;
      },
    };
  }
  colVal(L, row, col) {
    const k = col.kind;
    if (k === 'calc') {
      const key = L + '|' + row.key + '|' + col.id;
      if (this.memo.has(key)) return this.memo.get(key);
      if (this.stack.includes(key)) {
        this.err(key, 'Referência circular');
        return 0;
      }
      this.stack.push(key);
      let val = 0;
      try {
        val = this.evalF(col.formula, this.rowScope(L, row));
      } catch (e) {
        this.err(key, e.message || String(e));
      }
      this.stack.pop();
      this.memo.set(key, val);
      return val;
    }
    if (k === 'label') {
      const src = col.src || 'label';
      const x = row.def ? row.def[src] : undefined;
      return x === undefined ? '' : tr(x);
    }
    let raw = this.rawCell(L, row, col.id);
    if (raw === undefined || raw === '' || raw === null) {
      const d = row.def && row.def[col.id] !== undefined ? row.def[col.id] : col.def;
      if (d !== undefined) raw = d;
      else return k === 'number' ? 0 : k === 'check' ? false : '';
    }
    if (k === 'number') {
      const n = parseFloat(raw);
      return isNaN(n) ? 0 : n;
    }
    if (k === 'check') return !!raw;
    return raw;
  }
  dotted(name) {
    const p = name.split('.');
    const b = this.lists[p[0]];
    if (!b) return 0;
    const cm = this.colMap(p[0]);
    if (p.length === 2) {
      const c = cm[p[1]];
      if (!c) return [];
      return this.rows(p[0]).map(r => this.colVal(p[0], r, c));
    }
    if (p.length === 3) {
      const r = this.rows(p[0]).find(r => String(r.key) === p[1]);
      const c = cm[p[2]];
      return r && c ? this.colVal(p[0], r, c) : 0;
    }
    return 0;
  }

  /* ---------- escrita ---------- */
  setVal(id, v) {
    this.ch.v[id] = v;
    this.invalidate();
  }
  setPath(path, v) {
    const p = path.split('.');
    if (p.length === 3 && this.lists[p[0]]) {
      const r = this.rows(p[0]).find(r => String(r.key) === p[1]);
      if (r) this.setCell(p[0], r, p[2], v);
      return;
    }
    this.setVal(path, v);
  }

  /* ---------- recursos ---------- */
  resCur(id) {
    return this.get(id);
  }
  resMax(id) {
    return this.get(id + '_max');
  }
  damage(id, n) {
    n = Math.abs(n);
    let temp = this.stored(id + '_temp');
    const absorbed = Math.min(temp, n);
    this.setVal(id + '_temp', temp - absorbed);
    n -= absorbed;
    this.setVal(id, Math.max(0, this.resCur(id) - n));
  }
  heal(id, n) {
    this.setVal(id, Math.min(this.resMax(id), this.resCur(id) + Math.abs(n)));
  }
  spend(id, n) {
    this.setVal(id, Math.max(0, this.resCur(id) - n));
  }
  longRest() {
    const r = this.tpl.rest && this.tpl.rest.long;
    if (!r) return;
    for (const id of r.restore || []) {
      delete this.ch.v[id];
      this.ch.v[id + '_temp'] = 0;
    }
    this.invalidate();
    for (const k in r.set || {}) {
      try {
        this.ch.v[k] = Formula.num(this.evalF(r.set[k]), true);
      } catch (e) {}
      this.invalidate();
    }
  }

  /* ---------- formatação ---------- */
  fmt(v, f) {
    if (Array.isArray(v)) v = v[0];
    if (f === 'text') return v === null || v === undefined ? '' : String(v);
    if (typeof v === 'boolean') return v ? '✔' : '';
    if (typeof v === 'number') {
      if (!isFinite(v)) return '—';
      const r = Math.round(v * 100) / 100;
      return f === 'signed' ? (r >= 0 ? '+' : '−') + Math.abs(r) : String(r).replace('-', '−');
    }
    if (v === null || v === undefined) return '';
    return String(v);
  }

  /* ---------- planilhas importadas (grid) ---------- */
  cellKey(sheet, a) {
    return sheet + '!' + a;
  }
  cellVal(sheet, a) {
    const key = this.cellKey(sheet, a);
    if (this.memo.has(key)) return this.memo.get(key);
    const g = this.grids[sheet];
    const c = g && g.cells[a];
    let val = null;
    if (c) {
      if (c.k === 'ca' && c.f) {
        if (this.stack.includes(key)) {
          this.err(key, '#CIRC');
          return '#CIRC';
        }
        this.stack.push(key);
        try {
          const ast = Formula.parse(c.f, true);
          val = Formula.evaluate(ast, this.xctx(sheet));
          if (Array.isArray(val)) val = val[0];
          if (val === undefined) val = null;
        } catch (e) {
          this.err(key, e.message);
          val = e.code || '#ERR';
        }
        this.stack.pop();
      } else if (c.k === 'in') {
        const o = this.ch.g[key];
        val = o !== undefined ? o : c.v !== undefined ? c.v : null;
      } else val = c.v !== undefined ? c.v : null;
    }
    this.memo.set(key, val);
    return val;
  }
  xctx(sheet) {
    return {
      lenient: false,
      ident: n => {
        const l = n.toLowerCase();
        if (l === 'true') return true;
        if (l === 'false') return false;
        throw new Formula.FErr('#NAME?', n);
      },
      ref: (sh, a) => this.cellVal(sh || sheet, a),
      range: (sh, a, b) => {
        const A = Formula.splitA1(a),
          B = Formula.splitA1(b);
        if (!A || !B) return [];
        const out = [];
        const r1 = Math.min(A.r, B.r),
          r2 = Math.max(A.r, B.r),
          c1 = Math.min(A.c, B.c),
          c2 = Math.max(A.c, B.c);
        const g = this.grids[sh || sheet];
        if (!g) return out;
        for (let r = r1; r <= r2; r++)
          for (let c = c1; c <= c2; c++) {
            const ad = Formula.numToCol(c) + r;
            if (g.cells[ad]) out.push(this.cellVal(sh || sheet, ad));
          }
        return out;
      },
    };
  }
  setCellG(sheet, a, v) {
    this.ch.g[this.cellKey(sheet, a)] = v;
    this.invalidate();
  }
}
