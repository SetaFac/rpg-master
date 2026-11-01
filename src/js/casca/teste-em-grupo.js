/* ---------- teste em grupo ---------- */
function groupRoll(chars) {
  const norm = x =>
    String(x || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  const opts = new Map(); // chave -> { label, group }
  const info = c => {
    const tp = getTpl(c.tplId);
    return tp ? { tp, rt: new RT(tp, c) } : null;
  };
  chars.forEach(c => {
    const it = info(c);
    if (!it) return;
    it.tp.tabs.forEach(tb =>
      tb.blocks.forEach(b => {
        if (b.type === 'attrs')
          (b.attrs || []).forEach(a => {
            const k = 'a:' + norm(tr(a.label));
            if (!opts.has(k)) opts.set(k, { label: tr(a.label), group: 'Atributos' });
          });
        if (
          b.type === 'list' &&
          b.rows &&
          (b.columns || []).some(col => col.kind === 'calc' && (col.roll || col.d20))
        )
          b.rows.forEach(r => {
            if (!r.label) return;
            const k = 'l:' + norm(tr(r.label));
            if (!opts.has(k)) opts.set(k, { label: tr(r.label), group: tr(b.title) });
          });
      })
    );
  });
  const modOf = (c, key) => {
    const it = info(c);
    if (!it) return null;
    const name = key.slice(2);
    for (const tb of it.tp.tabs)
      for (const b of tb.blocks) {
        if (key[0] === 'a' && b.type === 'attrs') {
          const a = (b.attrs || []).find(a => norm(tr(a.label)) === name);
          if (a) return Formula.num(it.rt.get(a.id + '_mod'), true);
        }
        if (key[0] === 'l' && b.type === 'list' && b.rows) {
          const tr0 = b.rows.find(r => norm(tr(r.label)) === name);
          if (!tr0) continue;
          const row = it.rt.rows(b.id).find(r => String(r.key) === String(tr0.key)) || tr0;
          const col =
            (b.columns || []).find(c2 => c2.id === 'total') ||
            [...(b.columns || [])].reverse().find(c2 => c2.kind === 'calc');
          if (col) return Formula.num(it.rt.colVal(b.id, row, col), true);
        }
      }
    return null;
  };
  const sel = h(
    'select',
    { style: { minWidth: '220px' } },
    [...new Set([...opts.values()].map(o => o.group))].map(g =>
      h(
        'optgroup',
        { label: g },
        [...opts].filter(([k, o]) => o.group === g).map(([k, o]) => h('option', { value: k }, o.label))
      )
    )
  );
  const cd = h('input', { type: 'number', placeholder: 'CD (opcional)', style: { width: '120px' } });
  const adv = h(
    'select',
    h('option', { value: '0' }, 'Normal'),
    h('option', { value: '1' }, 'Vantagem'),
    h('option', { value: '-1' }, 'Desvantagem')
  );
  const out = h('div', { style: { marginTop: '12px' } });
  const go = () => {
    const key = sel.value;
    if (!key) return;
    const dc = cd.value === '' ? null : parseFloat(cd.value),
      A = parseInt(adv.value);
    const rows = chars
      .map(c => {
        const m = modOf(c, key);
        if (m === null) return null;
        const r1 = rnd(20),
          r2 = rnd(20);
        const r = A === 1 ? Math.max(r1, r2) : A === -1 ? Math.min(r1, r2) : r1;
        return { name: c.name || t('unnamed'), r, r1, r2, m, tot: r + m, role: (c.gm && c.gm.role) || 'pj' };
      })
      .filter(Boolean)
      .sort((a, b) => b.tot - a.tot);
    const lbl = sel.options[sel.selectedIndex].textContent;
    [...rows].reverse().forEach(x =>
      Roller.push({
        title: x.name + ' — ' + lbl + (dc != null ? ' (CD ' + dc + ')' : ''),
        expr: '',
        total: x.tot,
        detail:
          'd20: ' +
          (A ? x.r1 + '/' + x.r2 + ' → ' : '') +
          x.r +
          (x.m ? (x.m > 0 ? ' + ' : ' − ') + Math.abs(x.m) : ''),
        crit: x.r === 20,
        fail: x.r === 1,
        adv: A,
      })
    );
    out.replaceChildren(
      rows.length
        ? h(
            'table',
            { style: { width: '100%', borderCollapse: 'collapse' } },
            h(
              'tr',
              ['Quem', 'Dado', 'Bônus', 'Total', dc != null ? 'Resultado' : ''].map(x =>
                h(
                  'th',
                  { style: { textAlign: 'left', padding: '4px 8px', fontSize: '.8em', opacity: 0.7 } },
                  x
                )
              )
            ),
            rows.map(x =>
              h(
                'tr',
                { style: { borderTop: '1px solid var(--line, #8884)' } },
                h('td', { style: { padding: '4px 8px' } }, x.name),
                h(
                  'td',
                  { style: { padding: '4px 8px' } },
                  (A ? x.r1 + ' / ' + x.r2 + ' → ' : '') + x.r + (x.r === 20 ? ' ★' : x.r === 1 ? ' ✕' : '')
                ),
                h('td', { style: { padding: '4px 8px' } }, (x.m >= 0 ? '+' : '') + x.m),
                h('td', { style: { padding: '4px 8px', fontWeight: 700 } }, x.tot),
                h(
                  'td',
                  {
                    style: {
                      padding: '4px 8px',
                      color: dc == null ? '' : x.tot >= dc ? 'var(--good, #2e7d32)' : 'var(--bad, #c0392b)',
                    },
                  },
                  dc == null ? '' : x.tot >= dc ? '✓ passou' : '✗ falhou'
                )
              )
            )
          )
        : h('p.muted', 'Nenhuma ficha tem esse teste.')
    );
  };
  if (!opts.size) {
    toast('Importe ou crie fichas primeiro.');
    return;
  }
  modal({
    title: '🎯 Teste em grupo',
    wide: true,
    body: h(
      'div',
      h(
        'div',
        { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' } },
        sel,
        adv,
        cd,
        h('button.btn.primary', { type: 'button', onclick: go }, '🎲 Rolar para todos')
      ),
      h(
        'p.muted',
        { style: { fontSize: '.85em' } },
        'Rola um d20 para cada ficha da mesa, somando o bônus da perícia ou atributo escolhido.'
      ),
      out
    ),
  });
}

function printMesa(ents) {
  const root = $('#printroot');
  if (!root) return;
  const rows = ents
    .map((e, i) => {
      if (e.k === 'npc') {
        const n = e.o;
        return [
          i + 1,
          n.name,
          ROLES[n.role || 'inimigo'][0],
          'Ficha rápida',
          'PV ' + n.hp + '/' + n.max,
          'CR ' + (n.def ?? '—'),
          n.init ?? '',
          (n.conds || []).join(', '),
          n.note || '',
        ];
      }
      const c = e.o,
        tp = getTpl(c.tplId);
      if (!tp) return null;
      const rt = new RT(tp, c),
        hd = tp.hud || {};
      const g = c.gm || {};
      const res = (hd.resources || [])
        .map(id => {
          const src = rt.res[id];
          return src
            ? (src.label || id) + ' ' + rt.fmt(rt.get(id), 'num') + '/' + rt.fmt(rt.get(id + '_max'), 'num')
            : '';
        })
        .filter(Boolean)
        .join('  ');
      const st = (hd.stats || [])
        .map(x => {
          let v = '—';
          try {
            v = rt.fmt(rt.evalF(x.f), x.fmt || 'num');
          } catch (er) {}
          return tr(x.label) + ' ' + v;
        })
        .join('  ');
      return [
        i + 1,
        c.name || t('unnamed'),
        ROLES[g.role || 'pj'][0],
        tr(tp.name),
        res,
        st,
        g.init ?? '',
        (g.conds || []).join(', '),
        g.note || '',
      ];
    })
    .filter(Boolean);
  const head = [
    '#',
    'Nome',
    'Papel',
    'Sistema',
    'Recursos',
    'Defesa / destaques',
    'Inic.',
    'Condições',
    'Notas',
  ];
  const cell = (x, th) =>
    h(
      th ? 'th' : 'td',
      {
        style: {
          border: '1px solid #444',
          padding: '4px 6px',
          textAlign: 'left',
          fontSize: '11px',
          verticalAlign: 'top',
        },
      },
      String(x)
    );
  root.replaceChildren(
    h(
      'section.pg',
      h('h2', { style: { margin: '0 0 8px' } }, 'Mesa do mestre — ' + new Date().toLocaleDateString('pt-BR')),
      h(
        'table',
        { style: { width: '100%', borderCollapse: 'collapse' } },
        h(
          'tr',
          head.map(x => cell(x, true))
        ),
        rows.map(r =>
          h(
            'tr',
            r.map(x => cell(x))
          )
        )
      )
    )
  );
  const after = () => {
    root.replaceChildren();
    window.removeEventListener('afterprint', after);
  };
  window.addEventListener('afterprint', after);
  setTimeout(() => window.print(), 50);
}
