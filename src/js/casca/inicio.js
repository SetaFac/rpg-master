/* ---------- início ---------- */
function renderHome() {
  const v = $('#view');
  v.replaceChildren();
  const chars = Object.values(Store.data.chars).sort((a, b) => (b.updated || 0) - (a.updated || 0));
  const sysCard = (tpl, onclick) =>
    h(
      'button.tcard',
      { type: 'button', onclick },
      h('div.ic', tpl.icon || '✦'),
      h('b', tr(tpl.name)),
      h('span', tr(tpl.desc) || ''),
      tpl.builtin ? null : h('span.pill', LANG === 'pt' ? 'seu sistema' : 'your system')
    );
  const act = (ic, ti, de, fn) =>
    h('button.tcard', { type: 'button', onclick: fn }, h('div.ic', ic), h('b', ti), h('span', de));
  const home = h(
    'div.home',
    h('div.hero', h('h1', t('app')), h('p', t('tag'))),
    h('div.sec-t', t('myChars')),
    chars.length
      ? h(
          'div.cgrid',
          chars.map(c => {
            const tpl = getTpl(c.tplId);
            let sub = '';
            try {
              if (tpl && tpl.hud && tpl.hud.sub) sub = String(new RT(tpl, c).evalF(tpl.hud.sub));
            } catch (e) {}
            return h(
              'div.tcard',
              {
                tabindex: 0,
                role: 'button',
                onclick: () => openChar(c.id),
                onkeydown: e => {
                  if (e.key === 'Enter') openChar(c.id);
                },
              },
              c.portrait
                ? h('img.ic.por', { src: c.portrait, alt: '' })
                : h('div.ic', (tpl && tpl.icon) || '✦'),
              h('b', c.name || t('unnamed')),
              h(
                'span',
                sub
                  .replace(/^Nv /, LANG === 'pt' ? 'Nv ' : 'Lv ')
                  .replace(/(· )+$/, '')
                  .replace(/ ·\s+·/g, ' ·') || (tpl ? tr(tpl.name) : '—')
              ),
              h(
                'span.pill',
                (tpl ? tr(tpl.name) : '?') + ' · ' + new Date(c.updated || c.created).toLocaleDateString()
              ),
              h(
                'button.btn.ghost.sm.ibtn.x',
                {
                  type: 'button',
                  title: t('del'),
                  onclick: e => {
                    e.stopPropagation();
                    deleteChar(c.id);
                  },
                },
                '✕'
              )
            );
          })
        )
      : h('div.empty', t('noChars')),
    h('div.sec-t', t('builtin')),
    h(
      'div.cgrid',
      BUILTIN_IDS.map(id => {
        const tp = getBuiltin(id);
        return sysCard(tp, () => newChar(id));
      })
    ),
    Object.keys(Store.data.systems).length
      ? [
          h('div.sec-t', t('yours')),
          h(
            'div.cgrid',
            Object.values(Store.data.systems).map(tp => sysCard(tp, () => newChar(tp.id)))
          ),
        ]
      : null,
    h('div.sec-t', t('other')),
    h(
      'div.cgrid',
      act('▢', t('sysBlank'), t('sysBlankD'), () => newChar(blankSystemId())),
      act('✎', t('sysCustom'), t('sysCustomD'), systemWizard),
      act(
        '🗺',
        L3('Mesa virtual', 'Virtual tabletop', 'Virtueller Tisch'),
        L3(
          'Grid, cenários, fundos, tokens com foto, névoa e som para mestrar online',
          'Grid, scenes, backgrounds, photo tokens, fog and sound for running games online',
          'Raster, Szenen, Hintergründe, Foto-Token, Nebel und Sound'
        ),
        () => renderVTT()
      ),
      act(
        '🌐',
        L3('Entrar numa mesa online', 'Join an online table', 'Online-Tisch beitreten'),
        L3(
          'Conecte-se ao servidor do mestre para mover seu personagem e ver o mapa',
          'Connect to the GM server to move your token and see the map',
          'Mit dem Server des Spielleiters verbinden'
        ),
        joinDialog
      ),
      act(
        '🎭',
        'Mesa do mestre',
        'Importe várias fichas e acompanhe a vida e os recursos de todos',
        renderMesa
      ),
      act('✍', 'Criar com texto', 'Descreva a ficha em linguagem simples (Forja Texto)', () =>
        textoDialog()
      ),
      act('▦', t('sysXlsx'), t('sysXlsxD'), pickXlsx),
      act('⬆', t('sysJson'), t('sysJsonD'), pickImport)
    ),
    h('p.muted', { style: { marginTop: '26px' } }, t('dropHint'))
  );
  v.append(home);
}
function blankSystemId() {
  const tp = buildBlank();
  tp.id = 'blank-' + uid();
  tp.builtin = false;
  Store.data.systems[tp.id] = tp;
  Store.save();
  return tp.id;
}
