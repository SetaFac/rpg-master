/* ---------- barra superior ---------- */
function buildTop() {
  const top = $('#top');
  top.replaceChildren();
  const inChar = !!App.ch;
  top.append(h('button.brand', { onclick: goHome, 'aria-label': t('home') }, h('i', '🎲'), t('app')));
  if (inChar) top.append(h('button.btn', { onclick: goHome }, '← ' + t('home')));
  top.append(h('div.sp'), h('span#saved', ''));
  const ap = h(
    'button.btn',
    { type: 'button', onclick: e => appearancePop(e.currentTarget), title: t('appearance') },
    '🎨 ',
    t('appearance')
  );
  const lg = h(
    'button.btn',
    {
      type: 'button',
      onclick: () => {
        Store.data.prefs.lang = { pt: 'en', en: 'de', de: 'pt' }[LANG];
        Store.save();
        applyPrefs();
        buildTop();
        App.ch ? renderChar() : renderHome();
      },
      title: t('lang'),
    },
    '🌐 ' + LANG.toUpperCase()
  );
  const mn = h(
    'button.btn',
    { type: 'button', onclick: e => menuPop(e.currentTarget), 'aria-label': 'Menu' },
    '☰'
  );
  top.append(netChip(), soundChip(), ap, lg, mn);
}
UI_saved = ok => {
  const s = $('#saved');
  if (!s) return;
  s.textContent = ok ? '✓ ' + t('saved') : '⚠ ' + t('saveFail');
  s.style.color = ok ? '' : '#ffb4a8';
};
function menuPop(anchor) {
  const els = [];
  if (App.ch) {
    els.push(
      item(t('export'), exportChar, '⬇'),
      item(t('import'), pickImport, '⬆'),
      item(t('print'), printSheet, '🖨'),
      h('hr'),
      item(App.edit ? t('doneEdit') : t('editLayout'), toggleEdit, '✎')
    );
    if (App.tpl.rest)
      els.push(
        item(
          t('longRest'),
          () => {
            App.rt.longRest();
            changed();
            App.rerender();
            toast(t('restDone'));
          },
          '☾'
        )
      );
    els.push(
      h('hr'),
      item(t('exportSys'), exportSystem, '📦'),
      item(t('jsonSys'), editSystemJson, '{ }'),
      item(
        'Editar sistema em texto',
        () =>
          App.tpl.src
            ? textoDialog(App.tpl)
            : toast('Este sistema não foi criado com texto. Use "Criar com texto" na tela inicial.'),
        '✍'
      ),
      h('hr'),
      item(t('backup'), exportBackup, '💾'),
      item(t('del'), () => deleteChar(App.ch.id), '🗑')
    );
  } else els.push(item(t('import'), pickImport, '⬆'), item(t('backup'), exportBackup, '💾'));
  pop(anchor, h('div', els));
}
