/* ===== Casca do app: início, ficha, HUD, menus, importar/exportar ===== */
const THEMES = [
  { id: 'carta', pt: 'Carta náutica', en: 'Nautical chart', sw: ['#cddcd8', '#12293a', '#b3322a'] },
  { id: 'oceano', pt: 'Alto-mar', en: 'High seas', sw: ['#061a26', '#0d2e42', '#f0b43c'] },
  { id: 'grimorio', pt: 'Grimório', en: 'Grimoire', sw: ['#110b13', '#1c1321', '#c9a24b'] },
  { id: 'neon', pt: 'Neon', en: 'Neon', sw: ['#04050b', '#0a0f1e', '#00e5ff'] },
  { id: 'escuro', pt: 'Escuro moderno', en: 'Modern dark', sw: ['#0e1014', '#161a21', '#8ab4ff'] },
  { id: 'claro', pt: 'Claro moderno', en: 'Modern light', sw: ['#eceff3', '#ffffff', '#2d5bd6'] },
  { id: 'caderno', pt: 'Caderno de campo', en: 'Field notebook', sw: ['#ece5cf', '#fcf9ee', '#b8372f'] },
];
const _bi = {};
function getBuiltin(id) {
  if (!_bi[id]) {
    const f = { corsa: buildCorsa, dnd5e: buildDnd, blank: buildBlank }[id];
    _bi[id] = f ? f() : null;
  }
  return _bi[id];
}
const BUILTIN_IDS = ['corsa', 'dnd5e'];
function getTpl(id) {
  return Store.data.systems[id] || getBuiltin(id);
}
function allTpls() {
  return [...BUILTIN_IDS.map(getBuiltin), ...Object.values(Store.data.systems)];
}

/* ---------- toasts ---------- */
function toast(msg, ms = 2600) {
  const el = h('div.toast', msg);
  $('#toasts').append(el);
  setTimeout(() => {
    el.style.transition = 'opacity .3s';
    el.style.opacity = 0;
    setTimeout(() => el.remove(), 300);
  }, ms);
}
function toastRoll(e) {
  const el = h(
    'div.toast.roll' + (e.crit ? '.crit' : e.fail ? '.fail' : ''),
    h('div.n', e.total),
    h(
      'div',
      h('b', e.title),
      h('small', e.detail + (e.adv ? (e.adv > 0 ? ' · ' + t('advantage') : ' · ' + t('disadv')) : '')),
      e.crit
        ? h('small', '✦ ' + (LANG === 'pt' ? 'Crítico!' : 'Critical!'))
        : e.fail
          ? h('small', LANG === 'pt' ? 'Falha crítica' : 'Critical fail')
          : null
    )
  );
  const box = $('#toasts');
  box.querySelectorAll('.toast.roll').forEach(x => x.remove());
  box.append(el);
  setTimeout(() => {
    el.style.transition = 'opacity .4s';
    el.style.opacity = 0;
    setTimeout(() => el.remove(), 400);
  }, 4800);
}

/* ---------- modal ---------- */
function modal({ title, body, actions = [{ label: t('close') }], wide, xl, onClose }) {
  const close = () => {
    ovl.remove();
    document.removeEventListener('keydown', esc);
    onClose && onClose();
  };
  const esc = e => {
    if (e.key === 'Escape' && !e.defaultPrevented) {
      e.stopPropagation();
      close();
    }
  };
  const dlg = h(
    'div.dlg' + (wide ? '.wide' : '') + (xl ? '.xl' : ''),
    { role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h(
      'h3',
      h('span', title),
      h(
        'button.btn.ghost.sm.ibtn',
        { onclick: close, 'aria-label': t('close'), style: { color: 'inherit' } },
        '✕'
      )
    ),
    h('div.db', body),
    actions.length
      ? h(
          'div.df',
          actions.map(a =>
            h(
              'button.btn' + (a.primary ? '.primary' : '') + (a.danger ? '.danger' : ''),
              {
                type: 'button',
                onclick: async () => {
                  if (a.onClick) {
                    const r = await a.onClick(close);
                    if (r === false) return;
                  }
                  close();
                },
              },
              a.label
            )
          )
        )
      : null
  );
  const ovl = h(
    'div.ovl',
    {
      onmousedown: e => {
        if (e.target === ovl) close();
      },
    },
    dlg
  );
  document.body.append(ovl);
  document.addEventListener('keydown', esc);
  const first = dlg.querySelector('input,select,textarea');
  if (first && !wide) first.focus();
  return { close, el: dlg };
}
function ask(msg, okLabel) {
  return new Promise(res => {
    let done = false;
    const m = modal({
      title: t('app'),
      body: h('p', { style: { margin: 0 } }, msg),
      actions: [
        {
          label: t('cancel'),
          onClick: () => {
            done = true;
            res(false);
          },
        },
        {
          label: okLabel || t('ok'),
          primary: true,
          onClick: () => {
            done = true;
            res(true);
          },
        },
      ],
      onClose: () => {
        if (!done) res(false);
      },
    });
  });
}
function promptDlg(title, label, value = '') {
  return new Promise(res => {
    let done = false;
    const inp = h('input', { type: 'text', value });
    const m = modal({
      title,
      body: h('label.f', label, inp),
      actions: [
        {
          label: t('cancel'),
          onClick: () => {
            done = true;
            res(null);
          },
        },
        {
          label: t('ok'),
          primary: true,
          onClick: () => {
            done = true;
            res(inp.value);
          },
        },
      ],
      onClose: () => {
        if (!done) res(null);
      },
    });
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        done = true;
        res(inp.value);
        m.close();
      }
    });
    inp.select();
  });
}
function pop(anchor, content) {
  document.querySelectorAll('.pop').forEach(p => p.remove());
  const p = h('div.pop', content);
  document.body.append(p);
  const r = anchor.getBoundingClientRect();
  p.style.top = r.bottom + window.scrollY + 6 + 'px';
  p.style.left = Math.max(8, Math.min(window.innerWidth - p.offsetWidth - 8, r.right - p.offsetWidth)) + 'px';
  const off = e => {
    if (!p.contains(e.target) && e.target !== anchor) {
      p.remove();
      document.removeEventListener('mousedown', off);
      document.removeEventListener('keydown', k);
    }
  };
  const k = e => {
    if (e.key === 'Escape') {
      p.remove();
      document.removeEventListener('mousedown', off);
      document.removeEventListener('keydown', k);
    }
  };
  setTimeout(() => {
    document.addEventListener('mousedown', off);
    document.addEventListener('keydown', k);
  }, 0);
  p.close = () => {
    p.remove();
    document.removeEventListener('mousedown', off);
    document.removeEventListener('keydown', k);
  };
  return p;
}
const item = (label, fn, ico) =>
  h(
    'button.it',
    {
      type: 'button',
      onclick: () => {
        document.querySelectorAll('.pop').forEach(p => p.remove());
        fn();
      },
    },
    h('span', { style: { width: '1.3em', textAlign: 'center' } }, ico || ''),
    label
  );
