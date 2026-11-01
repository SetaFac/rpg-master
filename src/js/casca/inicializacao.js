/* ---------- inicialização ---------- */
function boot() {
  Store.load();
  Snd.loadVol();
  applyPrefs();
  document.body.append(
    h('div#top'),
    h('div#view'),
    h('div#dice'),
    h(
      'button#dice-fab',
      { 'aria-label': 'Dados', title: 'Dados', onclick: () => $('#dice').classList.toggle('open') },
      '🎲'
    ),
    h('div#toasts'),
    h('div#printroot')
  );
  buildDice();
  setupDrop();
  const cur = Store.data.cur && Store.data.chars[Store.data.cur] ? Store.data.cur : null;
  if (window.__PREVIEW) {
    let keep = null;
    window.addEventListener('message', ev => {
      const d = ev.data;
      if (!d || !d.forjaPreview) return;
      const tp = d.forjaPreview;
      tp.id = 'preview';
      if (App.ch) keep = { v: App.ch.v, g: App.ch.g, name: App.ch.name };
      Store.data.chars = {};
      Store.data.systems = { preview: tp };
      const ch = {
        id: 'pv',
        tplId: 'preview',
        name: keep ? keep.name : '',
        v: keep ? keep.v : {},
        g: keep ? keep.g : {},
        created: 0,
        updated: 0,
      };
      Store.data.chars.pv = ch;
      document.documentElement.dataset.theme = tp.theme || 'carta';
      openChar('pv');
      const tb = $('#top');
      if (tb) tb.style.display = 'none';
    });
    try {
      parent.postMessage({ forjaPreviewReady: true }, '*');
    } catch (e) {}
    return;
  }
  if (cur) openChar(cur);
  else {
    buildTop();
    renderHome();
  }
  UI_saved(true);
  $('#saved') && ($('#saved').textContent = '');
}
window.addEventListener('DOMContentLoaded', boot);
