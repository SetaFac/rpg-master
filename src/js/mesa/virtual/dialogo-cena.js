/* Parte da Mesa virtual (renderVTT, em tela.js). As funções vtt*() recebem o contexto "ctx" criado em renderVTT. */

function vttSceneDialog(ctx) {
  const { S, redraw, fit, syncBar, activate, V, switchScene } = ctx;
  const sc = S.sc,
    upd = rebuild => {
      S.dirtyFog = true;
      Store.save();
      redraw();
      if (rebuild) setTimeout(rebuild, 0);
    };
  const num = (v, k, o, min, max, step, cb) =>
    h('input', {
      type: 'number',
      value: o[k],
      min,
      max,
      step: step || 1,
      onchange: e => {
        o[k] = Math.max(min, Math.min(max, parseFloat(e.target.value) || min));
        cb ? cb() : upd();
      },
    });
  const rng = (o, k, min, max, step) =>
    h('input', {
      type: 'range',
      min,
      max,
      step,
      value: o[k] ?? 0,
      oninput: e => {
        o[k] = +e.target.value;
        redraw();
      },
      onchange: () => upd(),
    });
  const gal = h('div.bg-gal');
  const selNow = () => (sc.bg.kind === 'preset' ? sc.bg.preset : sc.bg.kind === 'img' ? '__img' : '__color');
  const fillGal = () => {
    gal.replaceChildren(
      ...BG_ORDER.map(id => {
        const c = vThumb(id),
          cv = h('canvas', { width: 220, height: 140 });
        cv.getContext('2d').drawImage(c, 0, 0);
        return h(
          'button' + (selNow() === id ? '.on' : ''),
          {
            type: 'button',
            onclick: () => {
              sc.bg = { ...sc.bg, kind: 'preset', preset: id };
              if (sc.cell < 24) sc.cell = 64;
              upd(fillGal);
            },
          },
          cv,
          tr(BGS[id].n)
        );
      }),
      h(
        'button' + (selNow() === '__color' ? '.on' : ''),
        {
          type: 'button',
          onclick: () => {
            sc.bg = { ...sc.bg, kind: 'color', color: sc.bg.color || '#2b2f3a' };
            upd(fillGal);
          },
        },
        h(
          'div',
          {
            style: {
              height: '70px',
              background: sc.bg.color || '#2b2f3a',
              display: 'grid',
              placeItems: 'center',
              fontSize: '1.6em',
            },
          },
          '🎨'
        ),
        L3('Cor lisa', 'Solid color', 'Einfarbig')
      ),
      h(
        'button' + (selNow() === '__img' ? '.on' : ''),
        {
          type: 'button',
          onclick: async () => {
            const r = await vPickBg();
            if (!r) return;
            sc.bg = { ...sc.bg, kind: 'img', imgId: r.id, w: r.w, h: r.h };
            sc.fog.rev = {};
            fit();
            upd(() => {
              fillGal();
              body2();
            });
          },
        },
        h(
          'div',
          {
            style: {
              height: '70px',
              display: 'grid',
              placeItems: 'center',
              fontSize: '1.6em',
              background: 'var(--card2)',
            },
          },
          '🖼'
        ),
        L3('Meu fundo (imagem)', 'My background (image)', 'Eigener Hintergrund')
      )
    );
  };
  const sound = h('div'),
    ctl = h('div');
  const body2 = () => {
    ctl.replaceChildren(
      h(
        'div.row2',
        h(
          'label.f',
          L3('Nome da cena', 'Scene name', 'Szenenname'),
          h('input', {
            type: 'text',
            value: sc.name,
            onchange: e => {
              sc.name = e.target.value || sc.name;
              Store.save();
              syncBar();
            },
          })
        ),
        sc.bg.kind === 'color'
          ? h(
              'label.f',
              L3('Cor de fundo', 'Background color', 'Hintergrundfarbe'),
              h('input', {
                type: 'color',
                value: sc.bg.color || '#2b2f3a',
                oninput: e => {
                  sc.bg.color = e.target.value;
                  vCache.base = {};
                  vCache.comp = {};
                  redraw();
                },
                onchange: () => upd(),
              })
            )
          : h(
              'label.f',
              L3('Cor do ambiente (matiz)', 'Mood tint', 'Stimmungsfarbe'),
              h('input', {
                type: 'color',
                value: sc.bg.tint || '#4466aa',
                oninput: e => {
                  sc.bg.tint = e.target.value;
                  if (!sc.bg.tintA) sc.bg.tintA = 0.45;
                  redraw();
                },
                onchange: () => upd(),
              })
            )
      ),
      sc.bg.kind !== 'color'
        ? h(
            'div.row2',
            h(
              'label.f',
              L3('Intensidade da cor', 'Tint strength', 'Farbstärke'),
              rng(sc.bg, 'tintA', 0, 1, 0.05)
            ),
            h(
              'label.f',
              L3('Escuridão (iluminação)', 'Darkness (lighting)', 'Dunkelheit (Licht)'),
              rng(sc.bg, 'dark', 0, 0.85, 0.05)
            )
          )
        : h(
            'label.f',
            L3('Escuridão (iluminação)', 'Darkness (lighting)', 'Dunkelheit (Licht)'),
            rng(sc.bg, 'dark', 0, 0.85, 0.05)
          ),
      h('div.sec-t', { style: { margin: '10px 0 6px' } }, L3('Grade', 'Grid', 'Raster')),
      h(
        'div.row2',
        h(
          'label.f',
          h(
            'span',
            h('input', {
              type: 'checkbox',
              checked: sc.grid.on,
              onchange: e => {
                sc.grid.on = e.target.checked;
                upd();
              },
            }),
            ' ' + L3('Mostrar grade', 'Show grid', 'Raster zeigen')
          ),
          h(
            'span',
            h('input', {
              type: 'checkbox',
              checked: sc.grid.snap,
              onchange: e => {
                sc.grid.snap = e.target.checked;
                Store.save();
              },
            }),
            ' ' + L3('Tokens encaixam na grade', 'Tokens snap to grid', 'Token rasten ein')
          )
        ),
        h(
          'label.f',
          L3('Cor da grade', 'Grid color', 'Rasterfarbe'),
          h('input', {
            type: 'color',
            value: sc.grid.color,
            onchange: e => {
              sc.grid.color = e.target.value;
              upd();
            },
          })
        )
      ),
      h(
        'div.row2',
        h(
          'label.f',
          L3('Opacidade da grade', 'Grid opacity', 'Raster-Deckkraft'),
          rng(sc.grid, 'alpha', 0, 1, 0.02)
        ),
        h(
          'label.f',
          L3('Tamanho da casa (px)', 'Cell size (px)', 'Feldgröße (px)'),
          num(0, 'cell', sc, 24, 400, 1, () => {
            vCache.base = {};
            vCache.comp = {};
            sc.fog.rev = {};
            S.dirtyFog = true;
            Store.save();
            redraw();
          })
        )
      ),
      h('div.sec-t', { style: { margin: '12px 0 6px' } }, '🗺 ' + L3('Dimensões do mapa', 'Map dimensions', 'Kartengröße')),
      h(
        'div.row2',
        h(
          'label.f',
          L3('Tamanho', 'Size', 'Größe'),
          h(
            'select',
            {
              onchange: e => {
                const id = e.target.value;
                if (V_MAP_SIZES[id]) {
                  vResizeScene(sc, V_MAP_SIZES[id], V_MAP_SIZES[id]);
                  S.dirtyFog = true;
                  Store.save();
                  fit();
                  redraw();
                  body2();
                }
              },
            },
            h('option', { value: 'small', selected: sc.sizePreset === 'small' }, L3('Pequeno — 20 × 20', 'Small — 20 × 20', 'Klein — 20 × 20')),
            h('option', { value: 'medium', selected: sc.sizePreset === 'medium' }, L3('Médio — 40 × 40', 'Medium — 40 × 40', 'Mittel — 40 × 40')),
            h('option', { value: 'large', selected: sc.sizePreset === 'large' }, L3('Grande — 80 × 80', 'Large — 80 × 80', 'Groß — 80 × 80')),
            sc.sizePreset === 'custom' ? h('option', { value: 'custom', selected: true }, L3('Personalizado', 'Custom', 'Benutzerdefiniert')) : null
          )
        ),
        h(
          'div.muted',
          { style: { alignSelf: 'end', paddingBottom: '8px', fontSize: '.86em' } },
          L3('O fundo é ajustado à área da cena.', 'The background fits the scene area.', 'Der Hintergrund wird an die Szenenfläche angepasst.')
        )
      ),
      h(
        'div.row2',
        h(
          'label.f',
          L3('Colunas', 'Columns', 'Spalten'),
          num(0, 'cols', sc, 5, 160, 1, () => {
            vResizeScene(sc, sc.cols, sc.rows);
            S.dirtyFog = true;
            Store.save();
            fit();
            redraw();
            body2();
          })
        ),
        h(
          'label.f',
          L3('Linhas', 'Rows', 'Zeilen'),
          num(0, 'rows', sc, 5, 160, 1, () => {
            vResizeScene(sc, sc.cols, sc.rows);
            S.dirtyFog = true;
            Store.save();
            fit();
            redraw();
            body2();
          })
        )
      ),
      h(
        'div.row2',
        h(
          'label.f',
          L3('1 casa vale', '1 square =', '1 Feld ='),
          num(0, 'unit', sc.grid, 0.1, 1000, 0.1, () => Store.save())
        ),
        h(
          'label.f',
          L3('Unidade', 'Unit', 'Einheit'),
          h('input', {
            type: 'text',
            value: sc.grid.unitName,
            onchange: e => {
              sc.grid.unitName = e.target.value || 'm';
              Store.save();
            },
          })
        )
      )
    );
  };
  const snd = () => {
    sound.replaceChildren(
      h(
        'div.sec-t',
        { style: { margin: '10px 0 6px' } },
        '🔊 ' + L3('Som desta cena', 'Scene sound', 'Szenensound')
      ),
      h(
        'div.row2',
        h(
          'label.f',
          L3('Ambiente', 'Ambience', 'Ambiente'),
          h(
            'select',
            {
              onchange: e => {
                sc.amb = e.target.value;
                Store.save();
              },
            },
            h('option', { value: '' }, '—'),
            Object.keys(AMB).map(id =>
              h('option', { value: id, selected: sc.amb === id }, AMB[id].ic + ' ' + tr(AMB[id].n))
            )
          )
        ),
        h(
          'label.f',
          L3('Música (sua)', 'Music (yours)', 'Musik (deine)'),
          h(
            'select',
            {
              onchange: e => {
                sc.mus = e.target.value;
                Store.save();
              },
            },
            h('option', { value: '' }, '—'),
            Snd.lib
              .filter(r => r.kind === 'music')
              .map(r => h('option', { value: r.id, selected: sc.mus === r.id }, r.name))
          )
        )
      ),
      h(
        'label',
        { style: { display: 'flex', gap: '6px', alignItems: 'center', fontSize: '.88em' } },
        h('input', {
          type: 'checkbox',
          checked: sc.auto,
          onchange: e => {
            sc.auto = e.target.checked;
            Store.save();
          },
        }),
        L3(
          'Tocar automaticamente ao abrir a cena',
          'Play automatically when opening the scene',
          'Beim Öffnen der Szene automatisch abspielen'
        )
      ),
      h(
        'div',
        { style: { display: 'flex', gap: '6px', marginTop: '8px' } },
        h(
          'button.btn.sm',
          { type: 'button', onclick: () => activate() },
          '▶ ' + L3('Tocar agora', 'Play now', 'Jetzt abspielen')
        ),
        h(
          'button.btn.sm',
          { type: 'button', onclick: () => Snd.stopAll() },
          '■ ' + L3('Parar tudo', 'Stop all', 'Alles stoppen')
        )
      )
    );
  };
  fillGal();
  body2();
  snd();
  Snd.loadLib().then(snd);
  modal({
    title: '🎨 ' + L3('Cenário', 'Scene', 'Szenerie'),
    wide: true,
    body: h(
      'div',
      h(
        'div.sec-t',
        { style: { marginBottom: '8px' } },
        L3(
          'Ambiente (clique para trocar)',
          'Environment (click to change)',
          'Umgebung (zum Wechseln klicken)'
        )
      ),
      gal,
      ctl,
      sound,
      h(
        'div',
        { style: { display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '14px' } },
        h(
          'button.btn.sm',
          {
            type: 'button',
            onclick: () => {
              const c = clone(sc);
              c.id = uid();
              c.name += ' (' + t('copyOf') + ')';
              c.tokens.forEach(k => (k.id = uid()));
              c.props.forEach(k => (k.id = uid()));
              V.scenes.push(c);
              Store.save();
              switchScene(c.id);
              toast(L3('Cena duplicada.', 'Scene duplicated.', 'Szene dupliziert.'));
            },
          },
          '⧉ ' + t('dup')
        ),
        h(
          'button.btn.sm',
          { type: 'button', onclick: () => exportScene(sc) },
          '⬇ ' + L3('Exportar cena', 'Export scene', 'Szene exportieren')
        ),
        h(
          'button.btn.sm',
          {
            type: 'button',
            onclick: async () => {
              const f = await vPickFile('.json');
              if (f) {
                try {
                  const o = JSON.parse(await f.text());
                  if (o.kind === 'scene') importScene(o);
                  else toast(t('badFile'));
                } catch (e) {
                  toast(t('badFile'));
                }
              }
            },
          },
          '⬆ ' + L3('Importar cena', 'Import scene', 'Szene importieren')
        ),
        h(
          'button.btn.sm.danger',
          {
            type: 'button',
            onclick: async () => {
              if (V.scenes.length < 2) {
                toast(
                  L3(
                    'Mantenha ao menos uma cena.',
                    'Keep at least one scene.',
                    'Mindestens eine Szene behalten.'
                  )
                );
                return;
              }
              if (await ask(t('delQ', sc.name), t('del'))) {
                V.scenes = V.scenes.filter(x => x.id !== sc.id);
                Store.data.vtt.scenes = V.scenes;
                Store.save();
                renderVTT(V.scenes[0].id);
              }
            },
          },
          '🗑 ' + t('del')
        )
      )
    ),
    actions: [{ label: t('close'), primary: true }],
    onClose: () => {
      syncBar();
      Store.save();
      redraw();
    },
  });
}
