/* ---------- catálogo de técnicas ---------- */
function techCatalog(b) {
  const rt = App.rt,
    L = b.id;
  const norm = x =>
    String(x || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  const names = [...new Set(TECH_DATA.map(x => x.e))];
  const cur = norm(rt.get('estilo'));
  let style = names.find(n => cur && norm(n) === cur) || names[0],
    kind = '',
    q = '';
  const sel = h(
    'select',
    {
      onchange: e => {
        style = e.target.value;
        draw();
      },
    },
    names.map(n => h('option', { value: n, selected: n === style }, n))
  );
  const ksel = h(
    'select',
    {
      onchange: e => {
        kind = e.target.value;
        draw();
      },
    },
    [
      ['', 'Todas'],
      ['Combate', 'Combate'],
      ['Auxiliar', 'Auxiliar'],
    ].map(([v, l]) => h('option', { value: v }, l))
  );
  const search = h('input', {
    type: 'search',
    placeholder: 'Buscar…',
    oninput: e => {
      q = norm(e.target.value);
      draw();
    },
  });
  const list = h('div', {
    style: { display: 'grid', gap: '8px', marginTop: '10px', maxHeight: '55vh', overflow: 'auto' },
  });
  const draw = () => {
    list.replaceChildren();
    TECH_DATA.filter(
      x => x.e === style && (!kind || x.t === kind) && (!q || norm(x.n + ' ' + x.d).includes(q))
    ).forEach(x => {
      const add = () => {
        rt.addRow(L, {
          nome: x.n,
          grau: x.g || 1,
          custo: x.c,
          tipo: x.t,
          duracao: x.du,
          alcance: x.al,
          requisito: x.rq,
          dano: x.da && !/^nenhum/i.test(x.da) ? x.da : '',
          desc: x.d,
        });
        changed();
        App.rerender();
        toast(x.n + ' adicionada');
      };
      list.append(
        h(
          'div.cardi',
          { style: { padding: '8px 10px' } },
          h(
            'div',
            { style: { display: 'flex', gap: '8px', alignItems: 'baseline' } },
            h('b', x.n),
            h(
              'span',
              { style: { opacity: 0.7, fontSize: '.85em' } },
              (x.g ? x.g + 'º grau · ' : '') + x.t + ' · ' + x.c + ' PP' + (x.da ? ' · ' + x.da : '')
            ),
            h('button.btn.sm.primary', { type: 'button', style: { marginLeft: 'auto' }, onclick: add }, '＋')
          ),
          h(
            'div',
            { style: { fontSize: '.85em', opacity: 0.85, marginTop: '4px' } },
            x.d.length > 260 ? x.d.slice(0, 260) + '…' : x.d
          )
        )
      );
    });
    if (!list.children.length) list.append(h('p', 'Nada encontrado.'));
  };
  draw();
  modal({
    title: '📖 Catálogo de técnicas',
    wide: true,
    body: h(
      'div',
      h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } }, sel, ksel, search),
      list
    ),
  });
}

/* ---------- catálogo de singularidades / defeitos / traços de espécie ---------- */
function traitCatalog(b) {
  const rt = App.rt,
    L = b.id,
    k = b.catalog;
  const norm = x =>
    String(x || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  let data = TRAIT_DATA[k],
    q = '',
    sp = '';
  if (k === 'tr') sp = 'Gerais';
  if (k === 'sp') {
    const cur = norm(rt.get('especie')),
      names = [...new Set(data.map(x => x.s))];
    sp = names.find(n => cur && norm(n).startsWith(norm(cur).slice(0, 4))) || names[0];
  }
  const sel =
    k === 'sp' || k === 'tr'
      ? h(
          'select',
          {
            onchange: e => {
              sp = e.target.value;
              draw();
            },
          },
          [...new Set(data.map(x => x.s))].map(n => h('option', { value: n, selected: n === sp }, n))
        )
      : null;
  const search = h('input', {
    type: 'search',
    placeholder: 'Buscar…',
    oninput: e => {
      q = norm(e.target.value);
      draw();
    },
  });
  const list = h('div', {
    style: { display: 'grid', gap: '8px', marginTop: '10px', maxHeight: '55vh', overflow: 'auto' },
  });
  const draw = () => {
    list.replaceChildren();
    data
      .filter(x => (!sp || x.s === sp) && (!q || norm(x.n + ' ' + x.d).includes(q)))
      .forEach(x => {
        const add = () => {
          rt.addRow(
            L,
            k === 'tr' ? { nome: x.n, custo: x.pt, efeito: x.c + '. ' + x.d } : { nome: x.n, efeito: x.d }
          );
          changed();
          App.rerender();
          toast(x.n + ' adicionado');
        };
        list.append(
          h(
            'div.cardi',
            { style: { padding: '8px 10px' } },
            h(
              'div',
              { style: { display: 'flex', gap: '8px', alignItems: 'baseline' } },
              h('b', x.n),
              x.c ? h('span', { style: { opacity: 0.7, fontSize: '.85em' } }, x.c) : null,
              h(
                'button.btn.sm.primary',
                { type: 'button', style: { marginLeft: 'auto' }, onclick: add },
                '＋'
              )
            ),
            h(
              'div',
              { style: { fontSize: '.85em', opacity: 0.85, marginTop: '4px' } },
              x.d.length > 320 ? x.d.slice(0, 320) + '…' : x.d
            )
          )
        );
      });
    if (!list.children.length) list.append(h('p', 'Nada encontrado.'));
  };
  draw();
  modal({
    title: '📖 ' + tr(b.title),
    wide: true,
    body: h('div', h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } }, sel, search), list),
  });
}

/* ---------- catálogo do próprio sistema (Forja Texto) ---------- */
function customCatalog(b) {
  const rt = App.rt,
    L = b.id,
    data = (App.tpl.catalogs || {})[b.catalogRef] || [];
  const norm = x =>
    String(x || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  let q = '';
  const search = h('input', {
    type: 'search',
    placeholder: 'Buscar…',
    oninput: e => {
      q = norm(e.target.value);
      draw();
    },
  });
  const list = h('div', {
    style: { display: 'grid', gap: '8px', marginTop: '10px', maxHeight: '55vh', overflow: 'auto' },
  });
  const labelOf = id => {
    const c = (b.columns || []).find(c => c.id === id);
    return c ? tr(c.label) || id : id;
  };
  const draw = () => {
    list.replaceChildren();
    data
      .filter(e => !q || norm(e.n + ' ' + Object.values(e.d).join(' ')).includes(q))
      .forEach(e => {
        const nameCol =
          (b.columns || []).find(c => c.id === (b.titleField || 'nome')) ||
          (b.columns || []).find(c => c.kind === 'text');
        const long = Object.entries(e.d).filter(
          ([k, v]) => typeof v === 'string' && v.length > 40 && k !== (nameCol && nameCol.id)
        );
        const short = Object.entries(e.d).filter(([k, v]) => !long.some(l => l[0] === k));
        const add = () => {
          const init = { ...e.d };
          if (nameCol) init[nameCol.id] = e.n;
          rt.addRow(L, init);
          changed();
          App.rerender();
          toast(e.n + ' adicionado');
        };
        list.append(
          h(
            'div.cardi',
            { style: { padding: '8px 10px' } },
            h(
              'div',
              { style: { display: 'flex', gap: '8px', alignItems: 'baseline', flexWrap: 'wrap' } },
              h('b', e.n),
              h(
                'span',
                { style: { opacity: 0.7, fontSize: '.85em' } },
                short.map(([k, v]) => labelOf(k) + ': ' + v).join(' · ')
              ),
              h(
                'button.btn.sm.primary',
                { type: 'button', style: { marginLeft: 'auto' }, onclick: add },
                '＋'
              )
            ),
            long.map(([k, v]) =>
              h(
                'div',
                { style: { fontSize: '.85em', opacity: 0.85, marginTop: '4px' } },
                v.length > 280 ? v.slice(0, 280) + '…' : v
              )
            )
          )
        );
      });
    if (!list.children.length) list.append(h('p', 'Nada encontrado.'));
  };
  draw();
  modal({ title: '📖 ' + b.catalogRef, wide: true, body: h('div', search, list) });
}
