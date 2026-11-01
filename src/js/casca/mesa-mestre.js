/* ---------- mesa do mestre ---------- */
const MESA = { turn: -1, round: 1, filter: '' };
const ROLES = {
  pj: ['Jogador', 'var(--good, #2e7d32)'],
  npc: ['NPC', 'var(--accent2, #c9a24b)'],
  inimigo: ['Inimigo', 'var(--bad, #b3322a)'],
};
const CONDS = [
  'Caído',
  'Agarrado',
  'Atordoado',
  'Amedrontado',
  'Cego',
  'Envenenado',
  'Enfurecido',
  'Imobilizado',
  'Incapacitado',
  'Inconsciente',
  'Sonolento',
  'Sangrando',
  'Queimando',
];
function mesaEnts() {
  const gmOf = c => (
    (c.gm = c.gm || { init: null, conds: [], note: '' }),
    (c.gm.role = c.gm.role || 'pj'),
    c.gm
  );
  const chars = Object.values(Store.data.chars).sort((a, b) => {
    const ia = gmOf(a).init,
      ib = gmOf(b).init;
    if (ia != null || ib != null)
      return (ib ?? -999) - (ia ?? -999) || (a.name || '').localeCompare(b.name || '');
    return (a.name || '').localeCompare(b.name || '');
  });
  const npcs = (Store.data.npcs = Store.data.npcs || []);
  const ents = [
    ...chars.map(c => ({ k: 'pc', o: c, init: gmOf(c).init, name: c.name || '' })),
    ...npcs.map(n => ({ k: 'npc', o: n, init: n.init ?? null, name: n.name || '' })),
  ];
  const roleOf = e => (e.k === 'pc' ? gmOf(e.o).role : e.o.role || 'inimigo');
  ents.sort((a, b) =>
    a.init != null || b.init != null
      ? (b.init ?? -999) - (a.init ?? -999) || a.name.localeCompare(b.name)
      : a.k === b.k
        ? a.name.localeCompare(b.name)
        : a.k === 'pc'
          ? -1
          : 1
  );
  return { gmOf, chars, npcs, ents, roleOf };
}
function renderMesa() {
  App.ch = null;
  App.tpl = null;
  App.rt = null;
  App.binds = [];
  App.hudBinds = [];
  Store.data.cur = null;
  Store.save();
  buildTop();
  const v = $('#view');
  v.replaceChildren();
  const { gmOf, chars, npcs, ents, roleOf } = mesaEnts();
  const shown = () => ents.filter(e => !MESA.filter || roleOf(e) === MESA.filter);
  const rollInit = () => {
    npcs.forEach(n => {
      n.init = rnd(20) + (n.bonus || 0);
    });
    chars.forEach(c => {
      const tp = getTpl(c.tplId);
      let b0 = 0;
      if (tp) {
        const rt = new RT(tp, c);
        for (const k of ['iniciativa', 'des_mod', 'agi_mod']) {
          try {
            const x = Formula.num(rt.get(k), true);
            if (isFinite(x) && rt.get(k) !== undefined) {
              b0 = x;
              break;
            }
          } catch (e) {}
        }
      }
      gmOf(c).init = rnd(20) + b0;
    });
    MESA.turn = 0;
    MESA.round = 1;
    Store.save();
    renderMesa();
  };
  const next = () => {
    if (!ents.length) return;
    MESA.turn++;
    if (MESA.turn >= ents.length) {
      MESA.turn = 0;
      MESA.round++;
    }
    renderMesa();
  };
  const pick = () => {
    const i = h('input', {
      type: 'file',
      accept: '.json',
      multiple: true,
      style: { display: 'none' },
      onchange: async () => {
        let n = 0,
          u = 0,
          e2 = 0;
        for (const f of i.files) {
          try {
            const r = importObj(JSON.parse(await f.text()), { update: true, quiet: true });
            if (r) {
              if (r.enc) e2++;
              else {
                n++;
                if (r.updated) u++;
              }
            }
          } catch (e) {}
        }
        i.remove();
        toast(
          n || e2
            ? (n ? n + ' ficha(s) importada(s)' + (u ? ' (' + u + ' atualizada(s))' : '') : '') +
                (e2 ? (n ? ' · ' : '') + e2 + ' encontro(s) importado(s)' : '')
            : t('badFile')
        );
        renderMesa();
      },
    });
    document.body.append(i);
    i.click();
  };
  const restAll = async () => {
    if (!(await ask('Aplicar descanso longo em todas as fichas?', 'Descansar'))) return;
    chars.forEach(c => {
      const tp = getTpl(c.tplId);
      if (tp) new RT(tp, c).longRest();
    });
    npcs.forEach(n => {
      n.hp = n.max;
    });
    Store.save();
    toast('Descanso aplicado.');
    renderMesa();
  };
  const npcCard = (n, idx) => {
    n.conds = n.conds || [];
    const pct = n.max > 0 ? Math.max(0, Math.min(100, (n.hp / n.max) * 100)) : 0;
    const bar = h('div.bar', h('i', { style: { width: pct + '%' } }));
    bar.style.setProperty('--c', pct <= 25 ? 'var(--bad)' : 'var(--hp)');
    const mv = d =>
      h(
        'button.btn.ghost.sm',
        {
          type: 'button',
          style: { padding: '1px 7px' },
          onclick: () => {
            n.hp = Math.max(0, Math.min(n.max, n.hp + d));
            Store.save();
            renderMesa();
          },
        },
        (d > 0 ? '+' : '−') + Math.abs(d)
      );
    const inp = (lab, key, w) =>
      h(
        'label',
        { style: { fontSize: '.8em', display: 'flex', alignItems: 'center', gap: '4px' } },
        lab,
        h('input', {
          type: 'number',
          value: n[key] ?? '',
          style: { width: w || '56px' },
          onchange: e => {
            n[key] = e.target.value === '' ? null : parseFloat(e.target.value);
            Store.save();
            renderMesa();
          },
        })
      );
    return h(
      'div.cardi',
      {
        style: {
          padding: '12px 14px',
          borderLeft: '4px solid ' + ROLES[n.role || 'inimigo'][1],
          outline: idx === MESA.turn ? '3px solid var(--accent, #c9a24b)' : 'none',
        },
      },
      h(
        'div',
        { style: { display: 'flex', gap: '6px', alignItems: 'center' } },
        n.portrait
          ? h('img', {
              src: n.portrait,
              alt: '',
              style: {
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                objectFit: 'cover',
                border: '2px solid var(--accent2)',
              },
            })
          : null,
        h('input', {
          type: 'text',
          value: n.name,
          style: { flex: 1, fontWeight: 700 },
          onchange: e => {
            n.name = e.target.value;
            Store.save();
            renderMesa();
          },
        }),
        h(
          'select',
          {
            style: { fontSize: '.8em' },
            onchange: e => {
              n.role = e.target.value;
              Store.save();
              renderMesa();
            },
          },
          [
            ['inimigo', 'Inimigo'],
            ['npc', 'NPC'],
          ].map(([k, l]) => h('option', { value: k, selected: (n.role || 'inimigo') === k }, l))
        )
      ),
      h(
        'div',
        { style: { margin: '8px 0 6px' } },
        h(
          'div',
          { style: { display: 'flex', justifyContent: 'space-between', fontSize: '.85em' } },
          h('b', 'PV'),
          h('span', n.hp + ' / ' + n.max)
        ),
        bar,
        h(
          'div',
          { style: { display: 'flex', gap: '2px', marginTop: '3px' } },
          mv(-10),
          mv(-5),
          mv(-1),
          mv(1),
          mv(5)
        )
      ),
      h(
        'div',
        { style: { display: 'flex', gap: '10px', flexWrap: 'wrap' } },
        inp('PV máx', 'max'),
        inp('CR', 'def'),
        inp('Inic.', 'init'),
        inp('Bônus', 'bonus')
      ),
      h(
        'div',
        { style: { display: 'flex', flexWrap: 'wrap', gap: '4px', margin: '6px 0' } },
        n.conds.map((k, i) =>
          h(
            'span.pill',
            {
              style: { cursor: 'pointer' },
              title: 'Remover',
              onclick: () => {
                n.conds.splice(i, 1);
                Store.save();
                renderMesa();
              },
            },
            k + ' ✕'
          )
        ),
        h(
          'select',
          {
            style: { fontSize: '.8em', maxWidth: '110px' },
            onchange: e => {
              const v = e.target.value;
              if (v) {
                n.conds.push(v);
                Store.save();
                renderMesa();
              }
            },
          },
          h('option', { value: '' }, '＋ condição'),
          CONDS.filter(k => !n.conds.includes(k)).map(k => h('option', { value: k }, k))
        )
      ),
      h(
        'textarea',
        {
          rows: 2,
          placeholder: 'Notas…',
          style: { width: '100%', fontSize: '.85em' },
          onchange: e => {
            n.note = e.target.value;
            Store.save();
          },
        },
        n.note || ''
      ),
      h(
        'div',
        { style: { marginTop: '8px' } },
        h(
          'button.btn.sm.ghost',
          {
            type: 'button',
            onclick: () => {
              Store.data.npcs = npcs.filter(x => x !== n);
              Store.save();
              renderMesa();
            },
          },
          '🗑'
        )
      )
    );
  };
  const card = c => {
    const tpl = getTpl(c.tplId);
    if (!tpl) return null;
    const rt = new RT(tpl, c),
      hd = tpl.hud || {};
    let sub = '';
    try {
      sub = String(rt.evalF(hd.sub) || '')
        .replace(/(\s*·\s*)+$/, '')
        .replace(/^\s*·\s*/, '');
    } catch (e) {}
    let title = c.name || '';
    try {
      title = String(rt.evalF(hd.title) || title);
    } catch (e) {}
    const g = gmOf(c);
    const idx = ents.findIndex(e => e.o === c);
    const body = h(
      'div.mesa-c',
      h(
        'div',
        { style: { display: 'flex', alignItems: 'baseline', gap: '8px' } },
        c.portrait
          ? h('img', {
              src: c.portrait,
              alt: '',
              style: {
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                objectFit: 'cover',
                border: '2px solid var(--accent2)',
                alignSelf: 'center',
              },
            })
          : null,
        h('b', { style: { fontFamily: 'var(--font-display)', fontSize: '1.15em' } }, title || t('unnamed')),
        h('span.pill', tr(tpl.name)),
        h(
          'select',
          {
            style: { marginLeft: 'auto', fontSize: '.8em' },
            onchange: e => {
              g.role = e.target.value;
              Store.save();
              renderMesa();
            },
          },
          Object.entries(ROLES).map(([k, [l]]) => h('option', { value: k, selected: g.role === k }, l))
        )
      ),
      h('div.muted', { style: { fontSize: '.85em', marginBottom: '6px' } }, sub),
      h(
        'div',
        { style: { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' } },
        h('label', { style: { fontSize: '.8em' } }, 'Iniciativa'),
        h('input', {
          type: 'number',
          value: g.init ?? '',
          style: { width: '64px' },
          onchange: e => {
            g.init = e.target.value === '' ? null : parseFloat(e.target.value);
            Store.save();
            renderMesa();
          },
        })
      )
    );
    const refresh = () => renderMesa();
    (hd.resources || []).forEach(id => {
      const src = rt.res[id];
      if (!src) return;
      const cur = rt.get(id),
        max = rt.get(id + '_max'),
        pct = max > 0 ? Math.max(0, Math.min(100, (cur / max) * 100)) : 0;
      const bar = h('div.bar', h('i', { style: { width: pct + '%' } }));
      bar.style.setProperty(
        '--c',
        pct <= 25 && src.kind !== 'pp' ? 'var(--bad)' : src.kind === 'pp' ? 'var(--pp)' : 'var(--hp)'
      );
      const mv = n =>
        h(
          'button.btn.ghost.sm',
          {
            type: 'button',
            style: { padding: '1px 7px' },
            onclick: () => {
              n < 0 ? rt.damage(id, n) : rt.heal(id, n);
              c.updated = Date.now();
              Store.save();
              refresh();
            },
          },
          (n > 0 ? '+' : '−') + Math.abs(n)
        );
      body.append(
        h(
          'div',
          { style: { marginBottom: '6px' } },
          h(
            'div',
            { style: { display: 'flex', justifyContent: 'space-between', fontSize: '.85em' } },
            h('b', src.label || id),
            h('span', rt.fmt(cur, 'num') + ' / ' + rt.fmt(max, 'num'))
          ),
          bar,
          h('div', { style: { display: 'flex', gap: '2px', marginTop: '3px' } }, mv(-5), mv(-1), mv(1), mv(5))
        )
      );
    });
    const chips = (hd.stats || []).map(st => {
      let val = '—';
      try {
        val = rt.fmt(rt.evalF(st.f), st.fmt || 'num');
      } catch (e) {}
      return h('div.chip', h('small', tr(st.label)), h('b', val));
    });
    if (chips.length) body.append(h('div.chips', { style: { margin: '6px 0' } }, chips));
    const cs = h(
      'div',
      { style: { display: 'flex', flexWrap: 'wrap', gap: '4px', margin: '6px 0' } },
      g.conds.map((k, i) =>
        h(
          'span.pill',
          {
            style: { cursor: 'pointer' },
            title: 'Remover',
            onclick: () => {
              g.conds.splice(i, 1);
              Store.save();
              renderMesa();
            },
          },
          k + ' ✕'
        )
      ),
      h(
        'select',
        {
          style: { fontSize: '.8em', maxWidth: '110px' },
          onchange: e => {
            let v = e.target.value;
            if (v === '__x') v = (prompt('Condição:') || '').trim();
            if (v) {
              g.conds.push(v);
              Store.save();
              renderMesa();
            }
          },
        },
        h('option', { value: '' }, '＋ condição'),
        CONDS.filter(k => !g.conds.includes(k)).map(k => h('option', { value: k }, k)),
        h('option', { value: '__x' }, 'Outra…')
      )
    );
    body.append(
      cs,
      h(
        'textarea',
        {
          rows: 2,
          placeholder: 'Notas do mestre…',
          style: { width: '100%', fontSize: '.85em' },
          onchange: e => {
            g.note = e.target.value;
            Store.save();
          },
        },
        g.note || ''
      )
    );
    body.append(
      h(
        'div',
        { style: { display: 'flex', gap: '6px', marginTop: '8px' } },
        h('button.btn.sm.primary', { type: 'button', onclick: () => openChar(c.id) }, 'Abrir'),
        h(
          'button.btn.sm.ghost',
          {
            type: 'button',
            onclick: async () => {
              if (await ask(t('delQ', c.name || t('unnamed')), t('del'))) {
                delete Store.data.chars[c.id];
                Store.save();
                renderMesa();
              }
            },
          },
          '🗑'
        )
      )
    );
    return h(
      'div.cardi',
      {
        style: {
          padding: '12px 14px',
          borderLeft: '4px solid ' + ROLES[g.role][1],
          outline: idx === MESA.turn ? '3px solid var(--accent, #c9a24b)' : 'none',
        },
      },
      body
    );
  };
  v.append(
    h(
      'div.home.gm-root',
      h(
        'div.hero',
        h('h1', '🎭 Mesa do mestre'),
        h(
          'p',
          'Importe os arquivos .json dos jogadores (vários de uma vez). Importar de novo o mesmo personagem atualiza a ficha em vez de duplicar.'
        )
      ),
      h(
        'div',
        { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', margin: '0 0 14px' } },
        h('button.btn.primary', { type: 'button', onclick: pick }, '⬆ Importar fichas'),
        h(
          'button.btn',
          { type: 'button', onclick: () => renderVTT() },
          '🗺 ' + L3('Mesa virtual', 'Virtual tabletop', 'Virtueller Tisch')
        ),
        h(
          'button.btn',
          { type: 'button', onclick: () => soundPanel(true) },
          '🔊 ' + L3('Som e música', 'Sound & music', 'Sound & Musik')
        ),
        h('button.btn', { type: 'button', onclick: () => npcDialog(renderMesa) }, '👹 Novo inimigo/NPC'),
        h('button.btn', { type: 'button', onclick: () => encountersDialog() }, '📂 Encontros'),
        h('button.btn', { type: 'button', onclick: rollInit }, '🎲 Rolar iniciativa'),
        h(
          'button.btn',
          { type: 'button', onclick: () => groupRoll(ents.filter(e => e.k === 'pc').map(e => e.o)) },
          '🎯 Teste em grupo'
        ),
        h(
          'button.btn',
          { type: 'button', onclick: next },
          '▶ Próximo turno' + (MESA.turn >= 0 ? ' · rodada ' + MESA.round : '')
        ),
        h(
          'button.btn.ghost',
          {
            type: 'button',
            onclick: () => {
              chars.forEach(c => {
                gmOf(c).init = null;
              });
              npcs.forEach(n => {
                n.init = null;
              });
              MESA.turn = -1;
              MESA.round = 1;
              Store.save();
              renderMesa();
            },
          },
          'Limpar iniciativa'
        ),
        h('button.btn', { type: 'button', onclick: () => printMesa(ents) }, '🖨 Resumo p/ imprimir'),
        h('button.btn', { type: 'button', onclick: restAll }, '☾ Descanso longo (todos)'),
        h('button.btn.ghost', { type: 'button', onclick: goHome }, '← Início')
      ),
      h(
        'div',
        { style: { display: 'flex', gap: '6px', margin: '0 0 12px', flexWrap: 'wrap' } },
        [
          ['', 'Todos'],
          ['pj', 'Jogadores'],
          ['npc', 'NPCs'],
          ['inimigo', 'Inimigos'],
        ].map(([k, l]) =>
          h(
            'button.btn.sm' + (MESA.filter === k ? '.primary' : ''),
            {
              type: 'button',
              onclick: () => {
                MESA.filter = k;
                renderMesa();
              },
            },
            l
          )
        )
      ),
      ents.length
        ? h(
            'div',
            {
              style: {
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill,minmax(270px,1fr))',
                gap: '12px',
              },
            },
            shown()
              .map(e => (e.k === 'pc' ? card(e.o) : npcCard(e.o, ents.indexOf(e))))
              .filter(Boolean)
          )
        : h('div.empty', 'Nenhuma ficha ainda. Importe os arquivos dos jogadores.')
    )
  );
}
