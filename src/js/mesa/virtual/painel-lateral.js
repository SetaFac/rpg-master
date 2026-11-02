/* Parte da Mesa virtual (renderVTT, em tela.js). As funções vtt*() recebem o contexto "ctx" criado em renderVTT. */

/* Lista vertical de participantes da mesa online.
   Cada participante ocupa uma linha inteira para evitar nomes agrupados/confusos. */
function vttParticipantList(options = {}) {
  const includeGM = options.includeGM !== false;
  const markSelf = options.markSelf !== false;
  const rows = [];

  if (includeGM) {
    rows.push(
      h(
        'div.vtt-participant' + (Net.gmOn ? '.online' : '.offline'),
        h('span.vtt-participant-icon', '🎭'),
        h(
          'span.vtt-participant-name',
          L3('Mestre', 'GM', 'Spielleiter') +
            (Net.gmOn ? '' : ' (' + L3('ausente', 'away', 'abwesend') + ')')
        ),
        h('span.vtt-participant-status', Net.gmOn ? '●' : '○')
      )
    );
  }

  Net.players.forEach(name => {
    const self = markSelf && Net.role === 'player' && name === Net.name;
    rows.push(
      h(
        'div.vtt-participant.online' + (self ? '.self' : ''),
        h('span.vtt-participant-icon', '👤'),
        h(
          'span.vtt-participant-name',
          name + (self ? ' (' + L3('você', 'you', 'du') + ')' : '')
        ),
        h('span.vtt-participant-status', '●')
      )
    );
  });

  return h(
    'div.vtt-participants',
    rows.length
      ? rows
      : h(
          'div.vtt-participant-empty',
          L3('Nenhum jogador conectado.', 'No players connected.', 'Keine Spieler verbunden.')
        )
  );
}

function vttRenderSide(ctx) {
  const { S, side, R, renderSideRemote, renderSide, save, redraw, M, removeProp, removeTok, nextTurn } = ctx;
  const tk = S.sel && S.sc.tokens.find(k => k.id === S.sel);
  side.replaceChildren();
  if (R) {
    renderSideRemote();
    return;
  }
  if (Net.role === 'gm') {
    side.append(
      h(
        'div.vtt-online-roster',
        h(
          'div.sec-t',
          { style: { margin: '0 0 6px' } },
          '🌐 ' +
            L3('Jogadores conectados', 'Connected players', 'Verbundene Spieler') +
            ' (' +
            Net.players.length +
            ')'
        ),
        vttParticipantList({ includeGM: false, markSelf: false })
      )
    );
  }
  const pr = S.selP && S.sc.props.find(k => k.id === S.selP);
  if (S.tool === 'terrain' || S.tool === 'prop') {
    const isT = S.tool === 'terrain';
    side.append(
      h(
        'h4',
        isT ? '🧱 ' + L3('Terreno', 'Terrain', 'Gelände') : '🪨 ' + L3('Objetos', 'Objects', 'Objekte')
      ),
      h(
        'p.muted',
        { style: { fontSize: '.83em', margin: '0 0 8px' } },
        isT
          ? L3(
              'Escolha o material e arraste no mapa para pintar. Use o pincel da barra para áreas grandes.',
              'Pick a material and drag on the map to paint. Use the brush size for big areas.',
              'Material wählen und auf der Karte ziehen. Pinselgröße für große Flächen.'
            )
          : L3(
              'Escolha o objeto e clique no mapa para colocar. Arraste para mover.',
              'Pick an object and click the map to place it. Drag to move.',
              'Objekt wählen und auf die Karte klicken. Ziehen zum Bewegen.'
            )
      )
    );
    const items = isT
        ? TERR_ORDER.map(id => [id, TERR[id].ic, TERR[id].n, TERR[id].col])
        : PROP_ORDER.map(id => [id, PROPS[id].ic, PROPS[id].n, null]),
      sel = isT ? S.terrSel : S.propSel;
    side.append(
      h(
        'div.snd-pads',
        items.map(([id, ic, n, col]) =>
          h(
            'button.snd-pad' + (sel === id ? '.sel' : ''),
            {
              type: 'button',
              style:
                sel === id
                  ? {
                      borderColor: 'var(--accent)',
                      background: 'color-mix(in srgb, var(--accent) 20%, var(--card2))',
                    }
                  : {},
              onclick: () => {
                if (isT) S.terrSel = id;
                else S.propSel = id;
                renderSide();
              },
            },
            col
              ? h(
                  'span.ic',
                  {
                    style: { background: col, borderRadius: '6px', padding: '2px 6px', fontSize: '1.2em' },
                  },
                  ic
                )
              : h('span.ic', ic),
            h('span', tr(n))
          )
        )
      )
    );
    if (isT)
      side.append(
        h(
          'div',
          { style: { display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px' } },
          h(
            'button.btn.sm' + (S.terrSel === null ? '.primary' : ''),
            {
              type: 'button',
              onclick: () => {
                S.terrSel = S.terrSel === null ? 'parede' : null;
                renderSide();
              },
            },
            '🧽 ' + L3('Borracha', 'Eraser', 'Radierer')
          ),
          h(
            'button.btn.sm.danger',
            {
              type: 'button',
              onclick: async () => {
                if (
                  await ask(
                    L3(
                      'Apagar todo o terreno desta cena?',
                      'Clear all terrain in this scene?',
                      'Gesamtes Gelände dieser Szene löschen?'
                    ),
                    t('del')
                  )
                ) {
                  S.sc.terr = {};
                  save();
                  redraw();
                }
              },
            },
            '🗑 ' + L3('Limpar terreno', 'Clear terrain', 'Gelände löschen')
          )
        )
      );
    else {
      side.append(
        h(
          'div',
          { style: { marginTop: '10px', fontSize: '.85em' }, class: 'muted' },
          L3('Total na cena: ', 'On scene: ', 'In Szene: ') + S.sc.props.length
        )
      );
      if (S.sc.props.length)
        side.append(
          h(
            'button.btn.sm.danger',
            {
              type: 'button',
              style: { marginTop: '6px' },
              onclick: async () => {
                if (
                  await ask(
                    L3('Remover todos os objetos?', 'Remove all objects?', 'Alle Objekte entfernen?'),
                    t('del')
                  )
                ) {
                  S.sc.props = [];
                  S.selP = null;
                  save();
                  renderSide();
                  redraw();
                }
              },
            },
            '🗑 ' + L3('Limpar objetos', 'Clear objects', 'Objekte löschen')
          )
        );
    }
    if (!isT && pr) side.append(h('hr'));
    if (isT || !pr) return;
  }
  if (pr && !tk) {
    side.append(
      h('h4', PROPS[pr.k].ic + ' ' + tr(PROPS[pr.k].n)),
      h(
        'div.row2',
        h(
          'label.f',
          L3('Tamanho', 'Size', 'Größe'),
          h(
            'select',
            {
              onchange: e => {
                pr.s = +e.target.value;
                save();
                redraw();
              },
            },
            [1, 2, 3, 4, 5].map(n => h('option', { value: n, selected: (pr.s || 1) === n }, n + '×' + n))
          )
        ),
        h(
          'label.f',
          L3('Girar', 'Rotate', 'Drehen'),
          h(
            'button.btn.sm',
            {
              type: 'button',
              onclick: () => {
                pr.rot = ((pr.rot || 0) + 1) % 4;
                save();
                redraw();
              },
            },
            '⟳ 90°'
          )
        )
      ),
      h(
        'label',
        {
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '.88em',
            marginBottom: '10px',
          },
        },
        h('input', {
          type: 'checkbox',
          checked: !!pr.hidden,
          onchange: e => {
            pr.hidden = e.target.checked;
            save();
            redraw();
          },
        }),
        L3(
          'Oculto dos jogadores (ex.: armadilha)',
          'Hidden from players (e.g. trap)',
          'Vor Spielern versteckt (z. B. Falle)'
        )
      ),
      h(
        'div',
        { style: { display: 'flex', gap: '6px' } },
        h(
          'button.btn.sm',
          {
            type: 'button',
            onclick: () => {
              const c = { ...pr, id: uid(), x: Math.min(M().cols - (pr.s || 1), pr.x + 1) };
              S.sc.props.push(c);
              S.selP = c.id;
              save();
              renderSide();
              redraw();
            },
          },
          '⧉ ' + t('dup')
        ),
        h(
          'button.btn.sm.danger',
          { type: 'button', onclick: () => removeProp(pr.id) },
          '🗑 ' + L3('Remover', 'Remove', 'Entfernen')
        )
      )
    );
    return;
  }
  if (tk) {
    const info = vTokInfo(tk);
    if (!info) {
      S.sel = null;
      return renderSide();
    }
    const pc = tk.ref && tk.ref.k === 'pc' ? Store.data.chars[tk.ref.id] : null,
      np = tk.ref && tk.ref.k === 'npc' ? (Store.data.npcs || []).find(x => x.id === tk.ref.id) : null;
    side.append(
      h('h4', info.name || '?'),
      h('span.pill', { style: { background: V_ROLE[info.role], color: '#111' } }, ROLES[info.role][0])
    );
    if (info.hp) {
      const pct = Math.max(0, Math.min(100, (info.hp.cur / info.hp.max) * 100)),
        bar2 = h('div.bar', h('i', { style: { width: pct + '%' } }));
      bar2.style.setProperty('--c', pct <= 25 ? 'var(--bad)' : 'var(--hp)');
      const mv = d =>
        h(
          'button.btn.sm',
          {
            type: 'button',
            onclick: () => {
              if (pc) {
                const tp = getTpl(pc.tplId),
                  rt = new RT(tp, pc),
                  id = tp.hud.resources[0];
                d < 0 ? rt.damage(id, d) : rt.heal(id, d);
                pc.updated = Date.now();
              } else if (np) np.hp = Math.max(0, Math.min(np.max, np.hp + d));
              Store.save();
              vRefreshHP();
              renderSide();
              redraw();
            },
          },
          (d > 0 ? '+' : '−') + Math.abs(d)
        );
      side.append(
        h(
          'div',
          { style: { margin: '10px 0' } },
          h(
            'div',
            { style: { display: 'flex', justifyContent: 'space-between', fontSize: '.85em' } },
            h('b', t('pvLabel')),
            h('span', Math.round(info.hp.cur) + ' / ' + Math.round(info.hp.max))
          ),
          bar2,
          h(
            'div',
            { style: { display: 'flex', gap: '3px', marginTop: '5px' } },
            mv(-10),
            mv(-5),
            mv(-1),
            mv(1),
            mv(5),
            mv(10)
          )
        )
      );
    }
    if (!tk.ref)
      side.append(
        h(
          'label.f',
          L3('Nome', 'Name', 'Name'),
          h('input', {
            type: 'text',
            value: tk.name,
            onchange: e => {
              tk.name = e.target.value;
              save();
              renderSide();
              redraw();
            },
          })
        ),
        h(
          'label.f',
          L3('Tipo', 'Type', 'Typ'),
          h(
            'select',
            {
              onchange: e => {
                tk.role = e.target.value;
                save();
                renderSide();
                redraw();
              },
            },
            Object.keys(ROLES).map(k => h('option', { value: k, selected: info.role === k }, ROLES[k][0]))
          )
        )
      );
    side.append(
      h(
        'div.row2',
        h(
          'label.f',
          L3('Tamanho', 'Size', 'Größe'),
          h(
            'select',
            {
              onchange: e => {
                tk.s = +e.target.value;
                save();
                redraw();
              },
            },
            [1, 2, 3, 4, 5].map(n => h('option', { value: n, selected: (tk.s || 1) === n }, n + '×' + n))
          )
        ),
        h(
          'label.f',
          L3('Cor do anel', 'Ring color', 'Ringfarbe'),
          h('input', {
            type: 'color',
            value: tk.color || V_ROLE[info.role],
            onchange: e => {
              tk.color = e.target.value;
              save();
              redraw();
            },
          })
        )
      )
    );
    side.append(
      h(
        'div',
        { style: { display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' } },
        h(
          'button.btn.sm',
          {
            type: 'button',
            onclick: async () => {
              const d = await pickImage({ max: 256, square: true });
              if (!d) return;
              if (pc) pc.portrait = d;
              else if (np) np.portrait = d;
              else tk.img = d;
              save();
              renderSide();
              redraw();
            },
          },
          '📷 ' + L3('Foto', 'Photo', 'Foto')
        ),
        info.img
          ? h(
              'button.btn.sm.ghost',
              {
                type: 'button',
                onclick: () => {
                  if (pc) delete pc.portrait;
                  else if (np) delete np.portrait;
                  else tk.img = null;
                  save();
                  renderSide();
                  redraw();
                },
              },
              L3('Tirar foto', 'Remove photo', 'Foto entfernen')
            )
          : null,
        h(
          'label',
          { style: { display: 'flex', alignItems: 'center', gap: '4px', fontSize: '.85em' } },
          h('input', {
            type: 'checkbox',
            checked: !!tk.hidden,
            onchange: e => {
              tk.hidden = e.target.checked;
              save();
              redraw();
            },
          }),
          L3('Oculto dos jogadores', 'Hidden from players', 'Vor Spielern versteckt')
        )
      )
    );
    if (Net.role === 'gm')
      side.append(
        h(
          'label.f',
          L3('Controlado por (online)', 'Controlled by (online)', 'Gesteuert von (online)'),
          h(
            'select',
            {
              onchange: e => {
                tk.owner = e.target.value || null;
                save();
              },
            },
            h('option', { value: '' }, L3('— só o mestre —', '— GM only —', '— nur Spielleiter —')),
            h(
              'option',
              { value: '*', selected: tk.owner === '*' },
              L3('Qualquer jogador', 'Any player', 'Jeder Spieler')
            ),
            Net.players.map(n => h('option', { value: n, selected: tk.owner === n }, n))
          )
        )
      );
    const arr = info.conds;
    side.append(
      h('div.sec-t', { style: { margin: '8px 0 4px' } }, L3('Condições', 'Conditions', 'Zustände')),
      h(
        'div.vtt-chips',
        arr.map((k, i) =>
          h(
            'span.pill',
            {
              style: { cursor: 'pointer' },
              title: t('remove'),
              onclick: () => {
                arr.splice(i, 1);
                save();
                renderSide();
                redraw();
              },
            },
            k + ' ✕'
          )
        ),
        h(
          'select',
          {
            onchange: e => {
              if (e.target.value) {
                arr.push(e.target.value);
                save();
                renderSide();
                redraw();
              }
            },
          },
          h('option', { value: '' }, '＋'),
          CONDS.filter(k => !arr.includes(k)).map(k => h('option', { value: k }, k))
        )
      )
    );
    side.append(
      h(
        'div',
        { style: { display: 'flex', gap: '6px', marginTop: '12px', flexWrap: 'wrap' } },
        pc
          ? h(
              'button.btn.sm.primary',
              { type: 'button', onclick: () => openChar(pc.id) },
              L3('Abrir ficha', 'Open sheet', 'Bogen öffnen')
            )
          : null,
        h(
          'button.btn.sm.danger',
          { type: 'button', onclick: () => removeTok(tk.id) },
          '🗑 ' + L3('Tirar da cena', 'Remove from scene', 'Aus Szene entfernen')
        )
      )
    );
  } else {
    const { ents } = mesaEnts(),
      e = ents[MESA.turn];
    side.append(
      h('h4', S.sc.name),
      h(
        'div',
        {
          style: {
            display: 'flex',
            gap: '6px',
            alignItems: 'center',
            marginBottom: '10px',
            flexWrap: 'wrap',
          },
        },
        h(
          'button.btn.sm.primary',
          { type: 'button', onclick: nextTurn },
          '▶ ' + L3('Próximo turno', 'Next turn', 'Nächster Zug')
        ),
        h(
          'span.muted',
          { style: { fontSize: '.85em' } },
          e && MESA.turn >= 0
            ? e.name + ' · ' + L3('Rodada ', 'Round ', 'Runde ') + MESA.round
            : L3(
                'Role a iniciativa na Mesa do mestre',
                'Roll initiative on the GM table',
                'Initiative am Spielleiter-Tisch würfeln'
              )
        )
      ),
      h(
        'div.sec-t',
        { style: { margin: '6px 0' } },
        L3('Tokens na cena', 'Tokens on scene', 'Token in Szene') + ' (' + S.sc.tokens.length + ')'
      )
    );
    if (!S.sc.tokens.length)
      side.append(
        h(
          'p.muted',
          { style: { fontSize: '.88em' } },
          L3(
            'Use “＋ Tokens” para trazer jogadores, NPCs e inimigos da Mesa do mestre.',
            'Use “＋ Tokens” to bring players, NPCs and enemies from the GM table.',
            'Mit „＋ Token“ bringst du Spieler, NSCs und Gegner vom Spielleiter-Tisch.'
          )
        )
      );
    S.sc.tokens.forEach(tk2 => {
      const i2 = vTokInfo(tk2);
      if (!i2) return;
      side.append(
        h(
          'div.vtt-trow',
          {
            onclick: () => {
              S.sel = tk2.id;
              const u = S.sc.cell || 64,
                s = tk2.s || 1;
              S.view.x = (tk2.x + s / 2) * u - S.W / S.view.z / 2;
              S.view.y = (tk2.y + s / 2) * u - S.H / S.view.z / 2;
              renderSide();
              redraw();
            },
          },
          i2.img
            ? h('img', { src: i2.img, alt: '', style: { borderColor: tk2.color || V_ROLE[i2.role] } })
            : h('i', {
                style: {
                  background: tk2.color || V_ROLE[i2.role],
                  borderColor: tk2.color || V_ROLE[i2.role],
                },
              }),
          h('span', { style: { flex: 1 } }, i2.name),
          i2.hp ? h('small.muted', Math.round(i2.hp.cur) + '/' + Math.round(i2.hp.max)) : null,
          tk2.hidden ? h('span', { title: L3('oculto', 'hidden', 'versteckt') }, '🙈') : null
        )
      );
    });
  }
}

function vttRenderSideRemote(ctx) {
  const { S, side, renderSide, redraw } = ctx;
  const mine = S.sc.tokens.filter(k => k.owner === Net.name || k.owner === '*');
  side.append(
    h('h4', S.sc.name),
    h(
      'div.sec-t',
      { style: { margin: '6px 0' } },
      L3('Seus personagens', 'Your characters', 'Deine Charaktere')
    )
  );
  if (!mine.length)
    side.append(
      h(
        'p.muted',
        { style: { fontSize: '.88em' } },
        L3(
          'O mestre ainda não deu um personagem para você mover.',
          'The GM has not given you a token to move yet.',
          'Der Spielleiter hat dir noch keinen Token gegeben.'
        )
      )
    );
  mine.forEach(tk =>
    side.append(
      h(
        'div.vtt-trow' + (S.sel === tk.id ? '.sel' : ''),
        {
          onclick: () => {
            S.sel = tk.id;
            const u = S.sc.cell || 64,
              s = tk.s || 1;
            S.view.x = (tk.x + s / 2) * u - S.W / S.view.z / 2;
            S.view.y = (tk.y + s / 2) * u - S.H / S.view.z / 2;
            renderSide();
            redraw();
          },
        },
        tk.img
          ? h('img', { src: tk.img, alt: '', style: { borderColor: V_ROLE[tk.role] } })
          : h('i', { style: { background: V_ROLE[tk.role], borderColor: V_ROLE[tk.role] } }),
        h('span', { style: { flex: 1 } }, tk.name),
        tk.hp ? h('small', tk.hp.cur + '/' + tk.hp.max) : null
      )
    )
  );
  side.append(
    h('div.sec-t', { style: { margin: '14px 0 6px' } }, L3('Na mesa', 'At the table', 'Am Tisch')),
    vttParticipantList({ includeGM: true, markSelf: true }),
    h(
      'p.muted',
      { style: { fontSize: '.8em', marginTop: '12px' } },
      L3(
        'Arraste só os seus personagens. Suas rolagens de dados aparecem no chat para todos.',
        'Drag only your own characters. Your dice rolls show in the chat for everyone.',
        'Ziehe nur deine eigenen Charaktere. Deine Würfe erscheinen im Chat für alle.'
      )
    )
  );
}

function vttAddTokens(ctx) {
  const { S, M, save, renderSide, redraw } = ctx;
  const { ents } = mesaEnts(),
    onScene = new Set(S.sc.tokens.filter(k => k.ref).map(k => k.ref.k + ':' + k.ref.id)),
    picks = new Map();
  const rows = ents.map(e => {
    const id = e.o.id,
      key = (e.k === 'pc' ? 'pc' : 'npc') + ':' + id,
      role = e.k === 'pc' ? (e.o.gm && e.o.gm.role) || 'pj' : e.o.role || 'inimigo',
      cb = h('input', { type: 'checkbox', disabled: onScene.has(key) });
    cb.onchange = () => (cb.checked ? picks.set(key, e) : picks.delete(key));
    return h(
      'label',
      {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '5px 4px',
          borderBottom: '1px solid var(--line2, var(--line))',
          opacity: onScene.has(key) ? 0.5 : 1,
        },
      },
      cb,
      h('span.pill', { style: { background: V_ROLE[role], color: '#111' } }, ROLES[role][0]),
      h('b', { style: { flex: 1 } }, e.name || '?'),
      onScene.has(key) ? h('small.muted', L3('na cena', 'on scene', 'in Szene')) : null
    );
  });
  const nm = h('input', {
      type: 'text',
      placeholder: L3(
        'Ex.: Barril, Tesouro, Guarda',
        'E.g. Barrel, Treasure, Guard',
        'z. B. Fass, Schatz, Wache'
      ),
    }),
    sz = h(
      'select',
      [1, 2, 3, 4].map(n => h('option', { value: n }, n + '×' + n))
    ),
    rl = h(
      'select',
      Object.keys(ROLES).map(k => h('option', { value: k, selected: k === 'npc' }, ROLES[k][0]))
    );
  let cimg = null;
  const cbtn = h(
    'button.btn.sm',
    {
      type: 'button',
      onclick: async () => {
        const d = await pickImage({ max: 256, square: true });
        if (d) {
          cimg = d;
          cbtn.textContent = '✓ ' + L3('foto escolhida', 'photo chosen', 'Foto gewählt');
        }
      },
    },
    '📷 ' + L3('Foto (opcional)', 'Photo (optional)', 'Foto (optional)')
  );
  modal({
    title: '＋ ' + L3('Adicionar à cena', 'Add to scene', 'Zur Szene hinzufügen'),
    wide: false,
    body: h(
      'div',
      h('div.sec-t', L3('Da Mesa do mestre', 'From the GM table', 'Vom Spielleiter-Tisch')),
      rows.length
        ? h('div', { style: { maxHeight: '260px', overflow: 'auto', marginBottom: '14px' } }, rows)
        : h(
            'p.muted',
            L3(
              'Importe fichas ou crie inimigos na Mesa do mestre.',
              'Import sheets or create enemies on the GM table.',
              'Importiere Bögen oder erstelle Gegner am Spielleiter-Tisch.'
            )
          ),
      h('div.sec-t', L3('Token avulso', 'Free token', 'Freier Token')),
      h('label.f', L3('Nome', 'Name', 'Name'), nm),
      h(
        'div.row2',
        h('label.f', L3('Tamanho', 'Size', 'Größe'), sz),
        h('label.f', L3('Tipo', 'Type', 'Typ'), rl)
      ),
      cbtn
    ),
    actions: [
      { label: t('cancel') },
      {
        label: t('add'),
        primary: true,
        onClick: () => {
          const m = M(),
            u = S.sc.cell || 64;
          let n = 0;
          const place = () => {
            const cx = Math.floor((S.view.x + S.W / S.view.z / 2) / u) + (n % 6) - 2,
              cy = Math.floor((S.view.y + S.H / S.view.z / 2) / u) + Math.floor(n / 6);
            n++;
            return { x: Math.max(0, Math.min(m.cols - 1, cx)), y: Math.max(0, Math.min(m.rows - 1, cy)) };
          };
          picks.forEach(e => {
            const p = place();
            S.sc.tokens.push({
              id: uid(),
              x: p.x,
              y: p.y,
              s: 1,
              ref: { k: e.k === 'pc' ? 'pc' : 'npc', id: e.o.id },
              conds: [],
              hidden: false,
            });
          });
          if (nm.value.trim()) {
            const p = place();
            S.sc.tokens.push({
              id: uid(),
              x: p.x,
              y: p.y,
              s: +sz.value,
              ref: null,
              name: nm.value.trim(),
              img: cimg,
              role: rl.value,
              conds: [],
              hidden: false,
            });
          }
          save();
          vRefreshHP();
          renderSide();
          redraw();
        },
      },
    ],
  });
}
