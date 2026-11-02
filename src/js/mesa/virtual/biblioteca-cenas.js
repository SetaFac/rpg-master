/* Parte da Mesa virtual (renderVTT, em tela.js). As funções vtt*() recebem o contexto "ctx" criado em renderVTT. */

async function pickScenes() {
  const f = await vPickFile('.json');
  if (!f) return;
  try {
    const o = JSON.parse(await f.text());
    if (o.kind === 'scene') importScene(o);
    else if (o.kind === 'scenes') importScenes(o);
    else toast(t('badFile'));
  } catch (e) {
    toast(t('badFile'));
  }
}

function vttLibraryDialog(ctx) {
  const { V, syncBar, switchScene, newScene, pickScenes } = ctx;
  const grid = h('div', {
    style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))', gap: '10px' },
  });
  const thumb = sc => {
    const cv = h('canvas', {
        width: 190,
        height: 120,
        style: { width: '100%', borderRadius: '6px', background: '#111' },
      }),
      g3 = cv.getContext('2d'),
      m = vMapSize(sc),
      base = vBgFinal(sc, () => fill());
    const k = Math.min(190 / m.w, 120 / m.h);
    g3.fillStyle = '#111';
    g3.fillRect(0, 0, 190, 120);
    g3.save();
    g3.translate((190 - m.w * k) / 2, (120 - m.h * k) / 2);
    g3.scale(k, k);
    if (base) g3.drawImage(base, 0, 0, m.w, m.h);
    const u = sc.cell || 64;
    Object.keys(sc.terr || {}).forEach(key => {
      const [x, y] = key.split(',').map(Number),
        d = TERR[sc.terr[key]];
      if (d) d.f(g3, x * u, y * u, u, 0, () => true, x, y);
    });
    (sc.props || []).forEach(pr => {
      if (!pr.hidden) vPropDraw(g3, pr, u, 0);
    });
    g3.restore();
    return cv;
  };
  const fill = () =>
    grid.replaceChildren(
      ...V.scenes.map(sc =>
        h(
          'div.cardi',
          { style: { padding: '8px', outline: sc.id === V.cur ? '2px solid var(--accent)' : 'none' } },
          thumb(sc),
          h('input', {
            type: 'text',
            value: sc.name,
            style: { width: '100%', margin: '6px 0', fontWeight: 700 },
            onchange: e => {
              sc.name = e.target.value || sc.name;
              Store.save();
              syncBar();
            },
          }),
          h(
            'div.muted',
            { style: { fontSize: '.78em', marginBottom: '6px' } },
            (sc.bg.kind === 'img'
              ? L3('imagem', 'image', 'Bild')
              : sc.bg.kind === 'color'
                ? L3('cor', 'color', 'Farbe')
                : tr((BGS[sc.bg.preset] || BGS.masmorra).n)) +
              ' · ' +
              sc.cols + '×' + sc.rows +
              ' · ' +
              Object.keys(sc.terr || {}).length +
              ' ' +
              L3('terreno', 'terrain', 'Gelände') +
              ' · ' +
              (sc.props || []).length +
              ' ' +
              L3('obj.', 'obj.', 'Obj.') +
              ' · ' +
              sc.tokens.length +
              ' tokens'
          ),
          h(
            'div',
            { style: { display: 'flex', gap: '4px', flexWrap: 'wrap' } },
            h(
              'button.btn.sm.primary',
              {
                type: 'button',
                onclick: () => {
                  dlgM.close();
                  switchScene(sc.id);
                },
              },
              L3('Abrir', 'Open', 'Öffnen')
            ),
            h(
              'button.btn.sm',
              {
                type: 'button',
                title: L3('Exportar este mapa (.json)', 'Export this map (.json)', 'Diese Karte exportieren'),
                onclick: () => exportScene(sc),
              },
              '⬇'
            ),
            h(
              'button.btn.sm',
              {
                type: 'button',
                title: t('dup'),
                onclick: () => {
                  const c = clone(sc);
                  c.id = uid();
                  c.name += ' (' + t('copyOf') + ')';
                  c.tokens.forEach(k => (k.id = uid()));
                  c.props.forEach(k => (k.id = uid()));
                  V.scenes.push(c);
                  Store.save();
                  fill();
                  syncBar();
                },
              },
              '⧉'
            ),
            h(
              'button.btn.sm.danger',
              {
                type: 'button',
                title: t('del'),
                onclick: async () => {
                  if (V.scenes.length < 2) {
                    toast(
                      L3(
                        'Mantenha ao menos um mapa.',
                        'Keep at least one map.',
                        'Mindestens eine Karte behalten.'
                      )
                    );
                    return;
                  }
                  if (await ask(t('delQ', sc.name), t('del'))) {
                    V.scenes = V.scenes.filter(x => x.id !== sc.id);
                    Store.data.vtt.scenes = V.scenes;
                    if (V.cur === sc.id) {
                      V.cur = V.scenes[0].id;
                      Store.save();
                      dlgM.close();
                      renderVTT(V.cur);
                      return;
                    }
                    Store.save();
                    fill();
                    syncBar();
                  }
                },
              },
              '🗑'
            )
          )
        )
      )
    );
  const dlgM = modal({
    title: '🗂 ' + L3('Meus mapas', 'My maps', 'Meine Karten'),
    wide: true,
    body: h(
      'div',
      h(
        'div',
        { style: { display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' } },
        h(
          'button.btn.sm.primary',
          {
            type: 'button',
            onclick: () => {
              dlgM.close();
              newScene();
            },
          },
          '＋ ' + L3('Novo mapa', 'New map', 'Neue Karte')
        ),
        h(
          'button.btn.sm',
          { type: 'button', onclick: pickScenes },
          '⬆ ' + L3('Importar mapa(s)', 'Import map(s)', 'Karte(n) importieren')
        ),
        h(
          'button.btn.sm',
          { type: 'button', onclick: () => exportAllScenes() },
          '⬇ ' + L3('Exportar todos', 'Export all', 'Alle exportieren')
        )
      ),
      grid
    ),
    actions: [{ label: t('close') }],
  });
  fill();
}
