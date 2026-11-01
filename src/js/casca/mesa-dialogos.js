function npcDialog(done) {
  const f = (l, el) => h('label.f', l, el);
  const name = h('input', { type: 'text', placeholder: 'Ex.: Marinheiro, Goblin, Capanga' }),
    hp = h('input', { type: 'number', value: 20 }),
    def = h('input', { type: 'number', value: 12 }),
    bonus = h('input', { type: 'number', value: 0 }),
    qty = h('input', { type: 'number', value: 1, min: 1, max: 20 });
  const role = h(
    'select',
    h('option', { value: 'inimigo' }, 'Inimigo'),
    h('option', { value: 'npc' }, 'NPC (aliado ou neutro)')
  );
  const mode = h(
    'select',
    h('option', { value: 'quick' }, 'Rápida (nome, vida, CR e iniciativa)'),
    ...allTpls().map(tp => h('option', { value: tp.id }, 'Ficha completa — ' + tr(tp.name)))
  );
  const quickBox = h(
    'div',
    h('div.row2', f('PV máximo', hp), f('CR (defesa)', def)),
    f('Bônus de iniciativa', bonus)
  );
  mode.addEventListener('change', () => {
    quickBox.style.display = mode.value === 'quick' ? '' : 'none';
  });
  modal({
    title: '👹 Novo inimigo / NPC',
    body: h(
      'div',
      f('Nome', name),
      h('div.row2', f('Tipo', role), f('Quantidade (cria cópias numeradas)', qty)),
      f('Modelo de ficha', mode),
      quickBox
    ),
    actions: [
      { label: t('cancel') },
      {
        label: 'Criar',
        primary: true,
        onClick: () => {
          const nm = name.value.trim() || (role.value === 'npc' ? 'NPC' : 'Inimigo'),
            q = Math.max(1, Math.min(20, parseInt(qty.value) || 1)),
            mx = Math.max(1, parseInt(hp.value) || 1);
          for (let i = 1; i <= q; i++) {
            const nome = q > 1 ? nm + ' ' + i : nm;
            if (mode.value === 'quick')
              Store.data.npcs.push({
                id: uid(),
                name: nome,
                role: role.value,
                hp: mx,
                max: mx,
                def: parseFloat(def.value) || 10,
                bonus: parseFloat(bonus.value) || 0,
                init: null,
                conds: [],
                note: '',
              });
            else {
              const tp = getTpl(mode.value);
              const ch = {
                id: uid(),
                tplId: tp.id,
                name: nome,
                v: {},
                g: {},
                created: Date.now(),
                updated: Date.now(),
                gm: { role: role.value, init: null, conds: [], note: '' },
              };
              const tf = tp.hud && tp.hud.title;
              if (tf) ch.v[tf] = nome;
              Store.data.chars[ch.id] = ch;
            }
          }
          Store.save();
          done();
        },
      },
    ],
  });
}

function encountersDialog() {
  const encs = (Store.data.encounters = Store.data.encounters || []);
  const npcs = Store.data.npcs;
  const list = h('div', { style: { display: 'grid', gap: '8px', marginTop: '10px' } });
  const mkNpc = n => ({ ...n, id: uid(), hp: n.max, init: null, conds: [], note: n.note || '' });
  const draw = () => {
    list.replaceChildren();
    if (!encs.length)
      list.append(
        h('p.muted', 'Nenhum encontro salvo. Crie os inimigos na Mesa e use "Salvar os inimigos atuais".')
      );
    encs.forEach(e =>
      list.append(
        h(
          'div.cardi',
          {
            style: {
              padding: '8px 10px',
              display: 'flex',
              gap: '8px',
              alignItems: 'center',
              flexWrap: 'wrap',
            },
          },
          h('b', e.name),
          h(
            'span.muted',
            e.npcs.length +
              (e.sheets || []).length +
              ' criatura(s): ' +
              [...e.npcs.map(n => n.name), ...(e.sheets || []).map(x => x.char.name)].join(', ').slice(0, 80)
          ),
          h(
            'span',
            { style: { marginLeft: 'auto', display: 'flex', gap: '4px' } },
            h(
              'button.btn.sm.primary',
              {
                type: 'button',
                onclick: () => {
                  e.npcs.forEach(n => npcs.push(mkNpc(n)));
                  (e.sheets || []).forEach(x => {
                    const ch = clone(x.char);
                    ch.id = uid();
                    ch.srcId = undefined;
                    ch.gm = {
                      role: (x.char.gm && x.char.gm.role) || 'inimigo',
                      init: null,
                      conds: [],
                      note: (x.char.gm && x.char.gm.note) || '',
                    };
                    Store.data.chars[ch.id] = ch;
                    const tp = getTpl(ch.tplId);
                    if (tp) new RT(tp, ch).longRest();
                  });
                  Store.save();
                  m.close();
                  renderMesa();
                  toast('Encontro carregado.');
                },
              },
              'Carregar'
            ),
            h(
              'button.btn.sm',
              {
                type: 'button',
                onclick: () =>
                  download(
                    fileName(e.name) + '.encontro.json',
                    JSON.stringify({
                      app: 'forja',
                      ver: 1,
                      kind: 'encounter',
                      name: e.name,
                      npcs: e.npcs,
                      sheets: (e.sheets || []).map(x => ({ char: x.char, tpl: strip(getTpl(x.char.tplId)) })),
                    })
                  ),
              },
              '⬇'
            ),
            h(
              'button.btn.sm.ghost',
              {
                type: 'button',
                onclick: () => {
                  encs.splice(encs.indexOf(e), 1);
                  Store.save();
                  draw();
                },
              },
              '🗑'
            )
          )
        )
      )
    );
  };
  const nm = h('input', {
    type: 'text',
    placeholder: 'Nome do encontro (ex.: Emboscada na ponte)',
    style: { flex: 1 },
  });
  const save = h(
    'button.btn',
    {
      type: 'button',
      onclick: () => {
        const fs = Object.values(Store.data.chars).filter(c => c.gm && c.gm.role && c.gm.role !== 'pj');
        if (!npcs.length && !fs.length) {
          toast('Não há inimigos ou NPCs na mesa.');
          return;
        }
        encs.push({
          id: uid(),
          name: nm.value.trim() || 'Encontro ' + (encs.length + 1),
          npcs: npcs.map(n => ({
            name: n.name,
            role: n.role,
            max: n.max,
            hp: n.max,
            def: n.def,
            bonus: n.bonus,
            note: n.note,
          })),
          sheets: fs.map(c => ({ char: clone(c) })),
        });
        Store.save();
        nm.value = '';
        draw();
        toast('Encontro salvo.');
      },
    },
    'Salvar os inimigos atuais'
  );
  const clr = h(
    'button.btn.ghost',
    {
      type: 'button',
      onclick: async () => {
        if (
          !(await ask(
            'Remover da mesa todos os inimigos e NPCs (inclusive os de ficha completa)? Fichas de jogadores não são afetadas.',
            'Remover'
          ))
        )
          return;
        Store.data.npcs.length = 0;
        Object.values(Store.data.chars).forEach(c => {
          if (c.gm && c.gm.role && c.gm.role !== 'pj') delete Store.data.chars[c.id];
        });
        Store.save();
        m.close();
        renderMesa();
      },
    },
    'Remover inimigos/NPCs da mesa'
  );
  const m = modal({
    title: '📂 Encontros',
    wide: true,
    body: h(
      'div',
      h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } }, nm, save, clr),
      list
    ),
  });
  draw();
}
