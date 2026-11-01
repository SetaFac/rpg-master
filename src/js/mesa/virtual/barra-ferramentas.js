/* Parte da Mesa virtual (renderVTT, em tela.js). As funções vtt*() recebem o contexto "ctx" criado em renderVTT. */

function vttSyncBar(ctx) {
  const {
    R,
    bar,
    S,
    syncBar,
    fit,
    redraw,
    present,
    setTool,
    newScene,
    switchScene,
    V,
    libraryDialog,
    sceneDialog,
    addTokens,
    save,
    revealAround,
    M,
    exportPng,
    pickScenes,
  } = ctx;
  if (R) {
    bar.replaceChildren(
      h(
        'button.btn.sm',
        {
          type: 'button',
          onclick: () => {
            Net.leave();
            buildTop();
            goHome();
          },
        },
        '← ' + L3('Sair da mesa', 'Leave table', 'Tisch verlassen')
      ),
      h('b', { style: { padding: '0 8px' } }, S.sc.name),
      h(
        'span.muted',
        { style: { fontSize: '.85em' } },
        '🌐 ' + Net.name + ' · ' + Net.players.length + ' ' + L3('na mesa', 'at table', 'am Tisch')
      ),
      h('div', { style: { flex: 1 } }),
      h(
        'button.btn.sm' + (Net.listen ? '.primary' : ''),
        {
          type: 'button',
          title: L3(
            'Ouvir os efeitos e ambientes do mestre',
            'Hear the GM effects and ambience',
            'Effekte und Ambiente des Spielleiters hören'
          ),
          onclick: () => {
            Net.listen = !Net.listen;
            if (Net.listen) {
              Snd.init();
              Snd.applyVol();
            }
            syncBar();
          },
        },
        '🔊 ' +
          (Net.listen ? L3('Som ligado', 'Sound on', 'Ton an') : L3('Ouvir som', 'Hear sound', 'Ton hören'))
      ),
      h('button.btn.sm', { type: 'button', onclick: () => soundPanel(true) }, '🎚'),
      h(
        'button.btn.sm',
        {
          type: 'button',
          onclick: () => {
            fit();
            redraw();
          },
        },
        '⛶ ' + L3('Ajustar', 'Fit', 'Einpassen')
      ),
      h('button.btn.sm', { type: 'button', onclick: () => present(true) }, '📺')
    );
    return;
  }
  const tb = (id, ic, tip) =>
    h(
      'button.btn.sm' + (S.tool === id ? '.primary' : ''),
      { type: 'button', title: tip, onclick: () => setTool(id) },
      ic
    );
  bar.replaceChildren(
    ...[
      h(
        'button.btn.sm',
        { type: 'button', onclick: renderMesa },
        '← ' + L3('Mesa do mestre', 'GM table', 'Spielleiter-Tisch')
      ),
      h(
        'select',
        {
          'aria-label': t('scenes') || 'Cenas',
          onchange: e => (e.target.value === '__new' ? newScene() : switchScene(e.target.value)),
        },
        V.scenes.map(s => h('option', { value: s.id, selected: s.id === V.cur }, s.name)),
        h('option', { value: '__new' }, '＋ ' + L3('Nova cena…', 'New scene…', 'Neue Szene…'))
      ),
      h(
        'button.btn.sm' + (Net.role === 'gm' ? '.primary' : ''),
        {
          type: 'button',
          title: L3(
            'Jogar online: servidor no seu PC',
            'Play online: server on your PC',
            'Online spielen: Server auf deinem PC'
          ),
          onclick: onlineDialogGM,
        },
        '🌐 ' + L3('Online', 'Online', 'Online') + (Net.role === 'gm' ? ' (' + Net.players.length + ')' : '')
      ),
      h(
        'button.btn.sm',
        {
          type: 'button',
          onclick: libraryDialog,
          title: L3(
            'Salvar, abrir, importar e exportar mapas',
            'Save, open, import and export maps',
            'Karten speichern, öffnen, importieren, exportieren'
          ),
        },
        '🗂 ' + L3('Mapas', 'Maps', 'Karten')
      ),
      h(
        'button.btn.sm.primary',
        { type: 'button', onclick: sceneDialog },
        '🎨 ' + L3('Cenário', 'Scene', 'Szenerie')
      ),
      h('button.btn.sm', { type: 'button', onclick: addTokens }, '＋ ' + L3('Tokens', 'Tokens', 'Token')),
      h('div.sep'),
      tb('move', '✋', L3('Mover (V)', 'Move (V)', 'Bewegen (V)')),
      tb('ruler', '📏', L3('Régua (R)', 'Ruler (R)', 'Lineal (R)')),
      tb('circle', '⭕', L3('Área circular (O)', 'Circle area (O)', 'Kreisfläche (O)')),
      h('div.sep'),
      tb(
        'terrain',
        '🧱',
        L3(
          'Terreno: parede, água, lava, ácido, nuvem… (T)',
          'Terrain: wall, water, lava, acid, cloud… (T)',
          'Gelände: Wand, Wasser, Lava, Säure, Wolke… (T)'
        )
      ),
      tb(
        'prop',
        '🪨',
        L3(
          'Objetos: pedra, arbusto, caixa, porta… (B)',
          'Objects: boulder, bush, crate, door… (B)',
          'Objekte: Fels, Busch, Kiste, Tür… (B)'
        )
      ),
      h('div.sep'),
      h(
        'button.btn.sm' + (S.sc.fog.on ? '.primary' : ''),
        {
          type: 'button',
          title: L3('Liga/desliga a névoa de guerra', 'Toggle fog of war', 'Nebel des Krieges umschalten'),
          onclick: () => {
            S.sc.fog.on = !S.sc.fog.on;
            S.dirtyFog = true;
            save();
            syncBar();
            redraw();
          },
        },
        '🌫 ' + L3('Névoa', 'Fog', 'Nebel')
      ),
      S.tool === 'terrain'
        ? [
            h(
              'select',
              {
                title: L3('Tamanho do pincel', 'Brush size', 'Pinselgröße'),
                onchange: e => {
                  S.brush = +e.target.value;
                },
              },
              [1, 2, 3, 4, 5, 6].map(n => h('option', { value: n, selected: S.brush === n }, '⌀' + n))
            ),
          ]
        : null,
      S.sc.fog.on
        ? [
            tb('reveal', '👁', L3('Revelar casas (arraste)', 'Reveal cells (drag)', 'Felder aufdecken')),
            tb('cover', '⬛', L3('Cobrir casas (arraste)', 'Cover cells (drag)', 'Felder verdecken')),
            h(
              'select',
              {
                title: L3('Tamanho do pincel', 'Brush size', 'Pinselgröße'),
                onchange: e => {
                  S.brush = +e.target.value;
                },
              },
              [1, 2, 3, 4].map(n => h('option', { value: n, selected: S.brush === n }, '⌀' + n))
            ),
            h(
              'button.btn.sm',
              {
                type: 'button',
                title: L3(
                  'Revela ao redor dos jogadores',
                  'Reveal around players',
                  'Rund um Spieler aufdecken'
                ),
                onclick: revealAround,
              },
              '🔆'
            ),
            h(
              'button.btn.sm',
              {
                type: 'button',
                onclick: () => {
                  const m = M();
                  for (let x = 0; x < m.cols; x++)
                    for (let y = 0; y < m.rows; y++) S.sc.fog.rev[x + ',' + y] = 1;
                  S.dirtyFog = true;
                  save();
                  redraw();
                },
              },
              L3('Tudo', 'All', 'Alles')
            ),
            h(
              'button.btn.sm',
              {
                type: 'button',
                onclick: () => {
                  S.sc.fog.rev = {};
                  S.dirtyFog = true;
                  save();
                  redraw();
                },
              },
              L3('Nada', 'None', 'Nichts')
            ),
          ]
        : null,
      h('div.sp', { style: { flex: 1 } }),
      h(
        'button.btn.sm',
        {
          type: 'button',
          title: L3(
            'Exportar o mapa (arquivo ou imagem)',
            'Export the map (file or image)',
            'Karte exportieren (Datei oder Bild)'
          ),
          onclick: e =>
            pop(
              e.currentTarget,
              h(
                'div',
                item(
                  L3(
                    'Mapa em arquivo (.json) com fundo e tokens',
                    'Map file (.json) with background and tokens',
                    'Kartendatei (.json)'
                  ),
                  () => exportScene(S.sc),
                  '⬇'
                ),
                item(L3('Imagem do mapa (.png)', 'Map image (.png)', 'Kartenbild (.png)'), exportPng, '🖼'),
                item(
                  L3('Todos os mapas em um arquivo', 'All maps in one file', 'Alle Karten in einer Datei'),
                  () => exportAllScenes(),
                  '📦'
                )
              )
            ),
        },
        '⬇ ' + L3('Exportar', 'Export', 'Export')
      ),
      h('button.btn.sm', { type: 'button', onclick: pickScenes }, '⬆ ' + L3('Importar', 'Import', 'Import')),
      h(
        'button.btn.sm',
        {
          type: 'button',
          onclick: () => {
            fit();
            redraw();
          },
        },
        '⛶ ' + L3('Ajustar', 'Fit', 'Einpassen')
      ),
      h(
        'button.btn.sm',
        { type: 'button', onclick: () => soundPanel(true) },
        '🔊 ' + L3('Som', 'Sound', 'Sound')
      ),
      h(
        'button.btn.sm',
        {
          type: 'button',
          title: L3(
            'Tela cheia para compartilhar com os jogadores (P)',
            'Fullscreen to share with players (P)',
            'Vollbild zum Teilen (P)'
          ),
          onclick: () => present(true),
        },
        '📺 ' + L3('Apresentar', 'Present', 'Präsentieren')
      ),
    ]
      .flat()
      .filter(Boolean)
  );
}

function vttExportPng(ctx) {
  const { M, S, paint, redraw } = ctx;
  const m = M();
  const gridO = h('input', { type: 'checkbox', checked: S.sc.grid.on }),
    tokO = h('input', { type: 'checkbox', checked: true }),
    fogO = h('input', { type: 'checkbox', checked: false }),
    scaleO = h(
      'select',
      [
        [1, '100%'],
        [0.5, '50%'],
        [2, '200%'],
      ].map(([v2, l]) =>
        h('option', { value: v2 }, l + ' (' + Math.round(m.w * v2) + '×' + Math.round(m.h * v2) + ')')
      )
    );
  const row = (c, l) =>
    h('label', { style: { display: 'flex', gap: '8px', alignItems: 'center', margin: '6px 0' } }, c, l);
  modal({
    title: '🖼 ' + L3('Exportar imagem do mapa', 'Export map image', 'Kartenbild exportieren'),
    body: h(
      'div',
      h(
        'p.muted',
        { style: { marginTop: 0 } },
        L3(
          'Gera um PNG do mapa inteiro, ótimo para imprimir ou usar em outro programa.',
          'Creates a PNG of the whole map, great for printing or other programs.',
          'Erzeugt ein PNG der ganzen Karte, ideal zum Drucken.'
        )
      ),
      row(gridO, L3('Mostrar a grade', 'Show grid', 'Raster zeigen')),
      row(tokO, L3('Incluir tokens', 'Include tokens', 'Token einbeziehen')),
      row(
        fogO,
        L3(
          'Incluir a névoa e esconder itens ocultos (visão dos jogadores)',
          'Include fog and hide secret items (player view)',
          'Nebel einbeziehen und Geheimes verbergen (Spielersicht)'
        )
      ),
      h('label.f', L3('Tamanho', 'Size', 'Größe'), scaleO)
    ),
    actions: [
      { label: t('cancel') },
      {
        label: '⬇ PNG',
        primary: true,
        onClick: async () => {
          const k = +scaleO.value,
            c = document.createElement('canvas');
          c.width = Math.round(m.w * k);
          c.height = Math.round(m.h * k);
          if (c.width * c.height > 1.6e8) {
            toast(
              L3(
                'Imagem grande demais. Escolha 50%.',
                'Image too large. Choose 50%.',
                'Bild zu groß. Wähle 50%.'
              )
            );
            return false;
          }
          const g2 = c.getContext('2d'),
            X = { grid: gridO.checked, tokens: tokO.checked, fog: fogO.checked };
          S.dirtyFog = true;
          const go = () => {
            g2.setTransform(1, 0, 0, 1, 0, 0);
            g2.clearRect(0, 0, c.width, c.height);
            g2.setTransform(k, 0, 0, k, 0, 0);
            paint(g2, X.fog, X);
          };
          go();
          await new Promise(r => setTimeout(r, 300));
          go();
          c.toBlob(b => {
            const a = h('a', {
              href: URL.createObjectURL(b),
              download: 'mapa-' + slug(S.sc.name) + '.png',
            });
            document.body.append(a);
            a.click();
            a.remove();
          }, 'image/png');
          S.dirtyFog = true;
          redraw();
          toast(L3('Imagem exportada.', 'Image exported.', 'Bild exportiert.'));
        },
      },
    ],
  });
}
