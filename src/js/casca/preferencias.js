/* ---------- preferências visuais ---------- */
function applyPrefs() {
  const p = Store.data.prefs,
    d = document.documentElement;
  LANG = p.lang === 'en' || p.lang === 'de' ? p.lang : 'pt';
  d.lang = { pt: 'pt-BR', en: 'en', de: 'de' }[LANG];
  let th = p.theme || (App.tpl && App.tpl.theme) || 'carta';
  if (!THEMES.find(x => x.id === th)) th = 'carta';
  d.dataset.theme = th;
  d.dataset.font = p.font || '';
  d.dataset.radius = p.radius || '';
  d.dataset.dens = p.dens || '';
  d.style.setProperty('--fs', (p.size || 15) + 'px');
  if (p.accent) {
    const c = p.accent,
      n = parseInt(c.slice(1), 16),
      L = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
    d.style.setProperty('--accent', c);
    d.style.setProperty('--accent-ink', L > 0.6 ? '#111' : '#fff');
    d.style.setProperty(
      '--seal-bg',
      `radial-gradient(circle at 35% 30%, color-mix(in srgb, ${c} 70%, white), ${c} 55%, color-mix(in srgb, ${c} 70%, black))`
    );
    d.style.setProperty('--seal-ink', L > 0.6 ? '#111' : '#fff');
  } else ['--accent', '--accent-ink', '--seal-bg', '--seal-ink'].forEach(k => d.style.removeProperty(k));
}
function appearancePop(anchor) {
  const p = Store.data.prefs;
  const cur = document.documentElement.dataset.theme;
  const upd = (k, v) => {
    if (v === '' || v === null) delete p[k];
    else p[k] = v;
    Store.save();
    applyPrefs();
  };
  const seg = (key, opts) =>
    h(
      'div.seg',
      { style: { gridTemplateColumns: `repeat(${opts.length},1fr)` } },
      opts.map(([v, l]) =>
        h(
          'button',
          {
            type: 'button',
            'aria-pressed': String((p[key] || '') === v),
            onclick: e => {
              upd(key, v);
              [...e.target.parentElement.children].forEach(b => b.setAttribute('aria-pressed', 'false'));
              e.target.setAttribute('aria-pressed', 'true');
            },
          },
          l
        )
      )
    );
  const el = h(
    'div',
    { style: { width: '320px', padding: '6px' } },
    h('div.lbl', t('theme')),
    h(
      'div',
      { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' } },
      THEMES.map(th =>
        h(
          'button.btn',
          {
            type: 'button',
            style: { justifyContent: 'flex-start', borderColor: th.id === cur ? 'var(--accent)' : '' },
            onclick: () => {
              upd('theme', th.id);
              anchor.click();
              anchor.click();
            },
          },
          h(
            'span',
            {
              style: {
                display: 'inline-flex',
                borderRadius: '50%',
                overflow: 'hidden',
                width: '22px',
                height: '22px',
                flex: 'none',
                boxShadow: '0 0 0 1px rgba(128,128,128,.5)',
              },
            },
            th.sw.map(c => h('i', { style: { flex: 1, background: c } }))
          ),
          tr(th)
        )
      )
    ),
    h('div.lbl', t('accent')),
    h(
      'div',
      { style: { display: 'flex', gap: '8px', alignItems: 'center', padding: '0 10px 4px' } },
      h('input', {
        type: 'color',
        value: p.accent || '#b3322a',
        oninput: e => upd('accent', e.target.value),
      }),
      h(
        'button.btn.sm',
        {
          onclick: () => {
            upd('accent', '');
            anchor.click();
            anchor.click();
          },
        },
        t('reset')
      )
    ),
    h('div.lbl', t('font')),
    h(
      'div',
      { style: { padding: '0 10px' } },
      seg('font', [
        ['', 'Auto'],
        ['sans', 'Sans'],
        ['serif', 'Serif'],
        ['mono', 'Mono'],
        ['hand', 'Hand'],
      ])
    ),
    h('div.lbl', t('radius')),
    h(
      'div',
      { style: { padding: '0 10px' } },
      seg('radius', [
        ['', 'Auto'],
        ['0', '▢'],
        ['1', '▢ˢ'],
        ['2', '◯'],
      ])
    ),
    h('div.lbl', t('density')),
    h(
      'div',
      { style: { padding: '0 10px' } },
      seg('dens', [
        ['compact', LANG === 'pt' ? 'Compacto' : 'Compact'],
        ['', 'Normal'],
        ['roomy', LANG === 'pt' ? 'Amplo' : 'Roomy'],
      ])
    ),
    h('div.lbl', t('size')),
    h(
      'div',
      { style: { padding: '0 10px 8px' } },
      h('input', {
        type: 'range',
        min: 12,
        max: 19,
        value: p.size || 15,
        style: { width: '100%' },
        oninput: e => upd('size', +e.target.value),
      })
    )
  );
  return pop(anchor, el);
}
