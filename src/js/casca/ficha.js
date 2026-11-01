/* ---------- ficha: HUD, abas ---------- */
function renderChar() {
  const v = $('#view');
  v.replaceChildren();
  App.hudBinds = [];
  const stick = h('div#stick');
  const hd = App.tpl.hud;
  if (hd) {
    const who = h('div.who', h('b'), h('span'));
    const av = h(
      'button.avatar',
      {
        type: 'button',
        title: L3(
          'Foto do personagem (clique para trocar)',
          'Character photo (click to change)',
          'Charakterfoto (zum Ändern klicken)'
        ),
        onclick: async () => {
          const d = await pickImage({ max: 256, square: true });
          if (d) {
            App.ch.portrait = d;
            saveSoon();
            renderChar();
          }
        },
        oncontextmenu: e => {
          e.preventDefault();
          if (App.ch.portrait) {
            delete App.ch.portrait;
            saveSoon();
            renderChar();
          }
        },
      },
      App.ch.portrait ? h('img', { src: App.ch.portrait, alt: '' }) : '📷'
    );
    App.hudBinds.push(() => {
      try {
        who.firstChild.textContent = String(App.rt.evalF(hd.title) || t('unnamed'));
        who.lastChild.textContent = String(App.rt.evalF(hd.sub) || '')
          .replace(/(\s*·\s*)+$/, '')
          .replace(/^\s*·\s*/, '')
          .replace(/\s*·\s*·\s*/g, ' · ')
          .replace(/^Nv /, LANG === 'pt' ? 'Nv ' : 'Lv ');
      } catch (e) {}
    });
    const bars = (hd.resources || []).map(id => {
      const src = App.rt.res[id];
      if (!src) return null;
      const lab = h('b', src.label || id),
        num = h('span');
      const bar = h('div.bar', h('i'));
      App.hudBinds.push(() => {
        const c = App.rt.get(id),
          m = App.rt.get(id + '_max');
        num.textContent = App.rt.fmt(c, 'num') + ' / ' + App.rt.fmt(m, 'num');
        const pct = m > 0 ? Math.max(0, Math.min(100, (c / m) * 100)) : 0;
        bar.firstChild.style.width = pct + '%';
        bar.style.setProperty(
          '--c',
          pct <= 25 && src.kind !== 'pp' ? 'var(--bad)' : src.kind === 'pp' ? 'var(--pp)' : 'var(--hp)'
        );
      });
      return h('div.hbar', h('div.row', lab, num), bar);
    });
    const chips = h(
      'div.chips',
      (hd.stats || []).map(s => {
        const val = h('b');
        App.hudBinds.push(() => {
          try {
            val.textContent = App.rt.fmt(App.rt.evalF(s.f), s.fmt || 'num');
          } catch (e) {}
        });
        return h('div.chip', h('small', tr(s.label)), val);
      })
    );
    stick.append(h('div#hud', av, who, bars, h('div.sp'), chips));
  }
  const tabs = h(
    'div#tabs',
    { role: 'tablist' },
    App.tpl.tabs.map(tb =>
      h(
        'button.tab',
        {
          role: 'tab',
          'aria-selected': String(tb.id === App.tab),
          onclick: () => {
            App.tab = tb.id;
            App.ch.tab = tb.id;
            saveSoon();
            renderChar();
          },
        },
        tr(tb.title)
      )
    )
  );
  if (App.edit) tabs.append(...tabEditButtons());
  stick.append(tabs);
  if (App.edit)
    stick.append(
      h(
        'div.ebar',
        h('b', '✎ ' + t('editLayout')),
        h(
          'span',
          LANG === 'pt'
            ? 'Passe o mouse sobre um bloco para editar, mover, redimensionar ou excluir. Arraste pelo cabeçalho para reordenar.'
            : 'Hover a block to edit, move, resize or delete. Drag its header to reorder.'
        ),
        h('div.sp'),
        h('button.btn', { onclick: toggleEdit }, '✓ ' + t('doneEdit'))
      )
    );
  v.append(stick, h('main#main'));
  renderTab();
  App.refresh();
  UI_saved(Store.ok);
}

/* ---------- rolador ---------- */
function buildDice() {
  const log = h('div#dlog');
  const inp = h('input', { type: 'text', placeholder: t('rollExpr'), style: { flex: 1 }, class: 'in' });
  const go = () => {
    const e = inp.value.trim();
    if (e) Roller.roll(e, e);
  };
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter') go();
  });
  const adv = h(
    'div.seg',
    [
      [0, t('normal')],
      [1, t('advantage')],
      [-1, t('disadv')],
    ].map(([v, l]) =>
      h(
        'button',
        {
          type: 'button',
          'aria-pressed': String(Roller.adv === v),
          onclick: e => {
            Roller.adv = v;
            [...e.currentTarget.parentElement.children].forEach(b => b.setAttribute('aria-pressed', 'false'));
            e.currentTarget.setAttribute('aria-pressed', 'true');
          },
        },
        l
      )
    )
  );
  const panel = $('#dice');
  panel.replaceChildren(
    h(
      'div.dh',
      h('span', { style: { flex: 1 } }, '🎲 ' + t('rolls')),
      h(
        'button.btn.ghost.sm.ibtn',
        {
          style: { color: 'inherit' },
          onclick: () => panel.classList.remove('open'),
          'aria-label': t('close'),
        },
        '✕'
      )
    ),
    h(
      'div.db',
      h(
        'div.dq',
        [4, 6, 8, 10, 12, 20, 100].map(f =>
          h('button.btn', { type: 'button', onclick: () => Roller.roll('d' + f, '1d' + f) }, 'd' + f)
        )
      ),
      adv,
      h(
        'div',
        { style: { display: 'flex', gap: '6px' } },
        inp,
        h('button.btn.primary', { onclick: go }, t('roll'))
      ),
      h('div.lbl.muted', t('history')),
      log
    )
  );
  renderDiceLog();
}
function renderDiceLog() {
  const log = $('#dlog');
  if (!log) return;
  log.replaceChildren(
    ...Roller.hist.map(e =>
      h(
        'div.lg' + (e.crit ? '.crit' : e.fail ? '.fail' : ''),
        h('b', e.total),
        h('div', e.title),
        h('small', e.detail)
      )
    )
  );
}
