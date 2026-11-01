/* ===== Editor livre de layout + criador de sistemas ===== */
const SPANS = [3, 4, 5, 6, 7, 8, 9, 12];
function reindexRT() {
  App.rt = new RT(App.tpl, App.ch);
}
function commitTpl(rerender = true) {
  if (!App.tpl.builtin) Store.data.systems[App.tpl.id] = App.tpl;
  Store.save();
  reindexRT();
  if (rerender) renderChar();
}
function forkTpl() {
  const c = clone(App.tpl);
  c.id = 'my-' + uid();
  c.builtin = false;
  delete c.imported;
  c.rev = 1;
  c.name =
    typeof c.name === 'object'
      ? {
          pt: tr({ pt: c.name.pt }) + ' (' + STR.pt.copyOf + ')',
          en: (c.name.en || c.name.pt) + ' (' + STR.en.copyOf + ')',
        }
      : c.name + ' (' + t('copyOf') + ')';
  Store.data.systems[c.id] = c;
  App.ch.tplId = c.id;
  App.tpl = c;
  reindexRT();
  Store.save();
}
async function ensureEditable() {
  if (!App.tpl.builtin) return true;
  if (!(await ask(t('forkQ', tr(App.tpl.name) + ' (' + t('copyOf') + ')')))) return false;
  forkTpl();
  return true;
}
async function toggleEdit() {
  if (!App.edit) {
    if (!(await ensureEditable())) return;
    App.edit = true;
  } else App.edit = false;
  document.body.classList.toggle('editing', App.edit);
  renderChar();
}

/* ---------- ferramentas por bloco ---------- */
function moveBlock(tab, i, j) {
  if (j < 0 || j >= tab.blocks.length || i === j) return;
  const [x] = tab.blocks.splice(i, 1);
  tab.blocks.splice(j, 0, x);
  commitTpl();
}
function addEditTools(w, b, i, tab) {
  const btn = (ic, title, fn) =>
    h(
      'button.btn',
      {
        type: 'button',
        title,
        'aria-label': title,
        onclick: e => {
          e.stopPropagation();
          fn();
        },
      },
      ic
    );
  const handle = h(
    'button.btn',
    {
      type: 'button',
      title: LANG === 'pt' ? 'Arrastar' : 'Drag',
      draggable: 'true',
      style: { cursor: 'grab' },
    },
    '⠿'
  );
  handle.addEventListener('dragstart', e => {
    App.dragIdx = i;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', 'blk');
    e.dataTransfer.setDragImage(w, 20, 10);
  });
  const grow = d => {
    const cur = b.span || 12;
    let ix = SPANS.findIndex(s => s >= cur);
    if (ix < 0) ix = SPANS.length - 1;
    ix = Math.max(0, Math.min(SPANS.length - 1, ix + d));
    b.span = SPANS[ix];
    commitTpl();
  };
  w.prepend(
    h(
      'div.etool',
      handle,
      btn('◀', t('moveL'), () => moveBlock(tab, i, i - 1)),
      btn('▶', t('moveR'), () => moveBlock(tab, i, i + 1)),
      btn('−', t('narrower'), () => grow(-1)),
      btn('+', t('wider'), () => grow(1)),
      btn('✎', t('edit'), () => editBlock(tab, i)),
      btn('⎘', t('dup'), () => {
        const c = clone(b);
        c.id = (b.id || 'b') + '_' + uid().slice(-3);
        renameIds(c);
        tab.blocks.splice(i + 1, 0, c);
        commitTpl();
      }),
      btn('🗑', t('del'), async () => {
        if (await ask(t('delBlkQ'), t('del'))) {
          tab.blocks.splice(i, 1);
          commitTpl();
        }
      })
    )
  );
}
function renameIds(b) {
  // evita colisão de ids ao duplicar
  const sfx = '_' + uid().slice(-3);
  if (b.type === 'fields')
    (b.fields || []).forEach(f => {
      f.id += sfx;
      if (f.formula) f.formula = f.formula;
    });
  if (b.type === 'attrs') (b.attrs || []).forEach(a => (a.id += sfx));
}
function enableDrag(grid, tab) {
  [...grid.children].forEach((blk, i) => {
    if (blk.dataset.i === undefined) return;
    blk.addEventListener('dragover', e => {
      if (App.dragIdx !== undefined) {
        e.preventDefault();
        blk.classList.add('dragover');
      }
    });
    blk.addEventListener('dragleave', () => blk.classList.remove('dragover'));
    blk.addEventListener('drop', e => {
      e.preventDefault();
      blk.classList.remove('dragover');
      const from = App.dragIdx;
      App.dragIdx = undefined;
      if (from !== undefined) moveBlock(tab, from, i);
    });
  });
}

/* ---------- abas ---------- */
function tabEditButtons() {
  const tabs = App.tpl.tabs;
  const ix = tabs.findIndex(x => x.id === App.tab);
  return [
    h(
      'button.tab.add',
      {
        type: 'button',
        title: t('tabNew'),
        onclick: async () => {
          const n = await promptDlg(t('tabNew'), t('tabName'), '');
          if (!n) return;
          const id = slug(n) + '_' + uid().slice(-3);
          tabs.push({ id, title: n, blocks: [] });
          App.tab = id;
          commitTpl();
        },
      },
      '＋'
    ),
    h(
      'button.tab.add',
      {
        type: 'button',
        title: t('tabRename'),
        onclick: async () => {
          const tb = tabs[ix];
          const n = await promptDlg(t('tabRename'), t('tabName'), tr(tb.title));
          if (n) {
            tb.title = n;
            commitTpl();
          }
        },
      },
      '✎'
    ),
    h(
      'button.tab.add',
      {
        type: 'button',
        title: t('moveL'),
        onclick: () => {
          if (ix > 0) {
            [tabs[ix - 1], tabs[ix]] = [tabs[ix], tabs[ix - 1]];
            commitTpl();
          }
        },
      },
      '◀'
    ),
    h(
      'button.tab.add',
      {
        type: 'button',
        title: t('moveR'),
        onclick: () => {
          if (ix < tabs.length - 1) {
            [tabs[ix + 1], tabs[ix]] = [tabs[ix], tabs[ix + 1]];
            commitTpl();
          }
        },
      },
      '▶'
    ),
    h(
      'button.tab.add',
      {
        type: 'button',
        title: t('tabDel'),
        onclick: async () => {
          if (tabs.length > 1 && (await ask(t('delTabQ', tr(tabs[ix].title)), t('del')))) {
            tabs.splice(ix, 1);
            App.tab = tabs[Math.max(0, ix - 1)].id;
            commitTpl();
          }
        },
      },
      '🗑'
    ),
  ];
}

/* ---------- novo bloco ---------- */
function addBlockDialog(tab) {
  const pt = LANG === 'pt';
  const defs = [
    [
      'fields',
      pt ? 'Campos' : 'Fields',
      pt
        ? 'Texto, número, caixa de marcar, lista de opções ou valor calculado.'
        : 'Text, number, checkbox, dropdown or computed value.',
      () => ({
        type: 'fields',
        id: 'b' + uid().slice(-4),
        span: 6,
        title: pt ? 'Novo bloco' : 'New block',
        fspan: 6,
        fields: [{ id: 'campo_' + uid().slice(-3), kind: 'text', label: pt ? 'Campo' : 'Field' }],
      }),
    ],
    [
      'attrs',
      pt ? 'Atributos' : 'Attributes',
      pt
        ? 'Valor com modificador calculado e rolagem ao clicar.'
        : 'Value with computed modifier and click-to-roll.',
      () => ({
        type: 'attrs',
        id: 'b' + uid().slice(-4),
        span: 6,
        title: pt ? 'Atributos' : 'Attributes',
        mod: 'floor((v-10)/2)',
        generator: true,
        attrs: [{ id: 'atr1_' + uid().slice(-3), label: 'Atributo 1', abbr: 'A1' }],
      }),
    ],
    [
      'resource',
      pt ? 'Recurso (barra)' : 'Resource (bar)',
      pt
        ? 'Vida, mana, sanidade… com atual/máximo e botões de dano e cura.'
        : 'HP, mana, sanity… with current/max and damage/heal buttons.',
      () => {
        const id = 'rec_' + uid().slice(-3);
        return {
          type: 'resource',
          id,
          span: 6,
          title: pt ? 'Recurso' : 'Resource',
          label: 'REC',
          kind: 'hp',
          max: '10',
          temp: false,
          manualMax: true,
        };
      },
    ],
    [
      'list',
      pt ? 'Tabela' : 'Table',
      pt
        ? 'Linhas que você adiciona e remove (itens, ataques, perícias).'
        : 'Rows you add and remove (items, attacks, skills).',
      () => ({
        type: 'list',
        id: 'lst_' + uid().slice(-3),
        span: 6,
        title: pt ? 'Nova tabela' : 'New table',
        addLabel: pt ? 'Adicionar' : 'Add',
        columns: [
          { id: 'nome', kind: 'text', label: pt ? 'Nome' : 'Name', w: '1.5fr' },
          { id: 'qtd', kind: 'number', label: 'Qtd', w: '60px' },
        ],
      }),
    ],
    [
      'cards',
      pt ? 'Cartões' : 'Cards',
      pt
        ? 'Um cartão por item, bom para técnicas, magias e habilidades.'
        : 'One card per item, good for techniques, spells and abilities.',
      () => ({
        type: 'list',
        id: 'crd_' + uid().slice(-3),
        display: 'cards',
        span: 12,
        cols: 3,
        title: pt ? 'Cartões' : 'Cards',
        titleField: 'nome',
        addLabel: pt ? 'Novo cartão' : 'New card',
        columns: [
          { id: 'nome', kind: 'text', label: pt ? 'Nome' : 'Name', span: 12 },
          { id: 'desc', kind: 'area', label: pt ? 'Descrição' : 'Description', span: 12, rows: 3 },
        ],
      }),
    ],
    [
      'note',
      pt ? 'Texto fixo' : 'Static text',
      pt ? 'Uma nota ou instrução que aparece na ficha.' : 'A note or instruction shown on the sheet.',
      () => ({ type: 'note', id: 'nt_' + uid().slice(-3), span: 12, title: pt ? 'Nota' : 'Note', text: '…' }),
    ],
  ];
  const body = h(
    'div.addmenu',
    defs.map(([k, ti, de, mk]) =>
      h(
        'button',
        {
          type: 'button',
          onclick: () => {
            m.close();
            const b = mk();
            tab.blocks.push(b);
            commitTpl();
            editBlock(tab, tab.blocks.length - 1);
          },
        },
        h('b', ti),
        h('span', de)
      )
    )
  );
  const m = modal({ title: t('newBlock'), body, actions: [{ label: t('cancel') }], wide: true });
}

/* ---------- formulário genérico ---------- */
function i18nInput(val, set, ph) {
  if (val && typeof val === 'object') {
    const a = h('input', {
      type: 'text',
      value: val.pt ?? '',
      placeholder: 'PT',
      oninput: () => {
        val.pt = a.value;
        set(val);
      },
    });
    const b = h('input', {
      type: 'text',
      value: val.en ?? '',
      placeholder: 'EN',
      oninput: () => {
        val.en = b.value;
        set(val);
      },
    });
    return h('div', { style: { display: 'grid', gap: '2px' } }, a, b);
  }
  return h('input', {
    type: 'text',
    value: val ?? '',
    placeholder: ph || '',
    oninput: e => set(e.target.value),
  });
}
function optsToStr(o) {
  if (o === '@attrs') return '@attrs';
  if (!Array.isArray(o)) return '';
  return o.map(x => (typeof x === 'object' ? x.v + ':' + tr(x.l) : x)).join(', ');
}
function strToOpts(s) {
  s = s.trim();
  if (s === '@attrs') return '@attrs';
  if (!s) return undefined;
  return s
    .split(',')
    .map(x => x.trim())
    .filter(Boolean)
    .map(x => {
      const m = /^(.+?):(.+)$/.exec(x);
      if (m) {
        const n = parseFloat(m[1]);
        return { v: isNaN(n) || String(n) !== m[1].trim() ? m[1].trim() : n, l: m[2].trim() };
      }
      return x;
    });
}
function cellInput(col, row) {
  const v = row[col.k];
  const set = x => {
    if (x === '' || x === undefined) delete row[col.k];
    else row[col.k] = x;
  };
  switch (col.t) {
    case 'i18n':
      return i18nInput(v, x => {
        row[col.k] = x;
      });
    case 'num':
      return h('input', {
        type: 'number',
        value: v ?? '',
        oninput: e => set(e.target.value === '' ? undefined : parseFloat(e.target.value)),
      });
    case 'bool':
      return h('input', {
        type: 'checkbox',
        checked: !!v,
        onchange: e => {
          if (e.target.checked) row[col.k] = true;
          else delete row[col.k];
        },
      });
    case 'sel':
      return h(
        'select',
        { onchange: e => set(e.target.value) },
        col.opts.map(o => h('option', { value: o, selected: (v ?? col.opts[0]) === o }, o))
      );
    case 'opts':
      return h('input', {
        type: 'text',
        value: optsToStr(v),
        placeholder: 'a, b, c  |  1:um, 2:dois  |  @attrs',
        oninput: e => {
          const o = strToOpts(e.target.value);
          if (o === undefined) delete row[col.k];
          else row[col.k] = o;
        },
      });
    case 'extra': {
      const ex = { ...row };
      (col.skip || []).forEach(k => delete ex[k]);
      return h('input', {
        type: 'text',
        value: Object.keys(ex).length ? JSON.stringify(ex) : '',
        placeholder: '{"attr":"for"}',
        oninput: e => {
          Object.keys(row).forEach(k => {
            if (!(col.skip || []).includes(k)) delete row[k];
          });
          try {
            if (e.target.value.trim()) Object.assign(row, JSON.parse(e.target.value));
            e.target.style.borderColor = '';
          } catch (er) {
            e.target.style.borderColor = 'var(--bad)';
          }
        },
      });
    }
    case 'formula':
      return h('input', {
        type: 'text',
        value: v ?? '',
        class: 'mono',
        spellcheck: 'false',
        oninput: e => {
          set(e.target.value);
          try {
            if (e.target.value) Formula.parse(e.target.value, false);
            e.target.style.borderColor = '';
            e.target.title = '';
          } catch (er) {
            e.target.style.borderColor = 'var(--bad)';
            e.target.title = er.message;
          }
        },
      });
    default:
      return h('input', { type: 'text', value: v ?? '', oninput: e => set(e.target.value) });
  }
}
function rowsEditor(label, arr, cols, mk) {
  const wrap = h('div', { style: { marginBottom: '14px' } });
  const draw = () => {
    wrap.replaceChildren(
      h('div.lab', { style: { margin: '4px 0' } }, label),
      h(
        'div',
        { style: { overflowX: 'auto' } },
        h(
          'table.ed-table',
          h(
            'thead',
            h(
              'tr',
              cols.map(c => h('th', { style: c.w ? { width: c.w } : {} }, c.l)),
              h('th')
            )
          ),
          h(
            'tbody',
            arr.map((row, i) =>
              h(
                'tr',
                cols.map(c => h('td' + (c.t === 'formula' ? '.mono' : ''), cellInput(c, row))),
                h(
                  'td',
                  { style: { whiteSpace: 'nowrap' } },
                  h(
                    'button.btn.ghost.sm.ibtn',
                    {
                      type: 'button',
                      onclick: () => {
                        if (i > 0) {
                          [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
                          draw();
                        }
                      },
                    },
                    '↑'
                  ),
                  h(
                    'button.btn.ghost.sm.ibtn',
                    {
                      type: 'button',
                      onclick: () => {
                        if (i < arr.length - 1) {
                          [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]];
                          draw();
                        }
                      },
                    },
                    '↓'
                  ),
                  h(
                    'button.btn.ghost.sm.ibtn',
                    {
                      type: 'button',
                      onclick: () => {
                        arr.splice(i, 1);
                        draw();
                      },
                    },
                    '✕'
                  )
                )
              )
            )
          )
        )
      ),
      h(
        'button.btn.sm',
        {
          type: 'button',
          style: { marginTop: '6px' },
          onclick: () => {
            arr.push(mk());
            draw();
          },
        },
        '＋ ' + t('add')
      )
    );
  };
  draw();
  return wrap;
}
const KINDS = ['text', 'number', 'check', 'select', 'area', 'calc'];
function blockSchema(b) {
  const pt = LANG === 'pt';
  const common = [
    { k: 'title', t: 'i18n', l: pt ? 'Título' : 'Title' },
    { k: 'span', t: 'num', l: t('span'), min: 1, max: 12 },
  ];
  switch (b.type) {
    case 'fields':
      return {
        top: [
          ...common,
          { k: 'fspan', t: 'num', l: pt ? 'Largura padrão dos campos (1-12)' : 'Default field width (1-12)' },
          { k: 'plain', t: 'bool', l: pt ? 'Sem moldura' : 'No frame' },
        ],
        rows: [
          {
            key: 'fields',
            l: t('fieldsT'),
            mk: () => ({ id: 'campo_' + uid().slice(-3), kind: 'text', label: pt ? 'Campo' : 'Field' }),
            cols: [
              { k: 'id', l: t('id'), w: '110px' },
              { k: 'label', t: 'i18n', l: t('label') },
              { k: 'kind', t: 'sel', opts: KINDS, l: t('kind'), w: '90px' },
              { k: 'span', t: 'num', l: 'Larg.', w: '56px' },
              { k: 'formula', t: 'formula', l: t('formula') + ' (calc)' },
              { k: 'options', t: 'opts', l: t('options') + ' (select)' },
              { k: 'def', t: 'str', l: t('default'), w: '70px' },
            ],
          },
        ],
      };
    case 'attrs':
      return {
        top: [
          ...common,
          {
            k: 'mod',
            t: 'formula',
            l: pt ? 'Fórmula do modificador (v = valor)' : 'Modifier formula (v = value)',
          },
          { k: 'generator', t: 'bool', l: pt ? 'Botão de gerar atributos' : 'Generator button' },
        ],
        rows: [
          {
            key: 'attrs',
            l: t('attrsT'),
            mk: () => ({ id: 'atr_' + uid().slice(-3), label: 'Novo', abbr: 'NOV' }),
            cols: [
              { k: 'id', l: t('id'), w: '110px' },
              { k: 'label', t: 'i18n', l: t('label') },
              { k: 'abbr', t: 'i18n', l: pt ? 'Sigla' : 'Abbr.', w: '110px' },
            ],
          },
        ],
      };
    case 'resource':
      return {
        top: [
          ...common,
          { k: 'id', t: 'str', l: t('id') },
          { k: 'label', t: 'str', l: pt ? 'Sigla (ex.: PV)' : 'Short label' },
          {
            k: 'kind',
            t: 'sel',
            opts: ['hp', 'pp'],
            l: pt ? 'Cor da barra (hp = verde, pp = azul)' : 'Bar color',
          },
          { k: 'max', t: 'formula', l: pt ? 'Máximo (fórmula ou número)' : 'Maximum (formula or number)' },
          { k: 'temp', t: 'bool', l: pt ? 'Tem valor temporário' : 'Has temporary value' },
          { k: 'manualMax', t: 'bool', l: pt ? 'Permitir máximo manual' : 'Allow manual maximum' },
          { k: 'bonus', t: 'str', l: pt ? 'Campo de bônus (id opcional)' : 'Bonus field id (optional)' },
        ],
        rows: [],
      };
    case 'list':
      return {
        top: [
          ...common,
          { k: 'addLabel', t: 'i18n', l: pt ? 'Texto do botão adicionar' : 'Add button text' },
          { k: 'display', t: 'sel', opts: ['table', 'cards'], l: pt ? 'Exibição' : 'Display' },
          { k: 'split', t: 'num', l: pt ? 'Dividir em colunas (1 ou 2)' : 'Split columns (1 or 2)' },
          { k: 'seed', t: 'num', l: pt ? 'Linhas iniciais' : 'Initial rows' },
        ],
        rows: [
          {
            key: 'columns',
            l: t('cols'),
            mk: () => ({ id: 'col_' + uid().slice(-3), kind: 'text', label: 'Coluna' }),
            cols: [
              { k: 'id', l: t('id'), w: '100px' },
              { k: 'label', t: 'i18n', l: t('label') },
              {
                k: 'kind',
                t: 'sel',
                opts: ['text', 'number', 'check', 'select', 'area', 'calc', 'label', 'rollbtn'],
                l: t('kind'),
                w: '90px',
              },
              { k: 'w', t: 'str', l: 'Larg. (1fr, 80px)', w: '80px' },
              { k: 'span', t: 'num', l: 'Cartão (1-12)', w: '60px' },
              { k: 'formula', t: 'formula', l: t('formula') + ' (calc)' },
              { k: 'options', t: 'opts', l: t('options') },
            ],
          },
          {
            key: 'rows',
            l: t('rowsFixed'),
            optional: true,
            mk: () => ({ key: 'linha_' + uid().slice(-3), label: 'Linha' }),
            cols: [
              { k: 'key', l: pt ? 'Chave' : 'Key', w: '110px' },
              { k: 'label', t: 'i18n', l: t('label') },
              { k: 'x', t: 'extra', skip: ['key', 'label'], l: pt ? 'Extras (JSON)' : 'Extras (JSON)' },
            ],
          },
        ],
      };
    case 'note':
      return { top: [...common, { k: 'text', t: 'area', l: pt ? 'Texto' : 'Text' }], rows: [] };
    default:
      return { top: common, rows: [] };
  }
}
function editBlock(tab, i) {
  const b = tab.blocks[i];
  const draft = clone(b);
  const sc = blockSchema(draft);
  const pt = LANG === 'pt';
  const form = h('div');
  const grid = h('div.row2');
  sc.top.forEach(f => {
    const lab = h('label.f', f.l);
    let inp;
    if (f.t === 'i18n') inp = i18nInput(draft[f.k], x => (draft[f.k] = x));
    else if (f.t === 'num')
      inp = h('input', {
        type: 'number',
        value: draft[f.k] ?? '',
        min: f.min,
        max: f.max,
        oninput: e => {
          if (e.target.value === '') delete draft[f.k];
          else draft[f.k] = parseFloat(e.target.value);
        },
      });
    else if (f.t === 'bool') {
      inp = h('input', {
        type: 'checkbox',
        checked: !!draft[f.k],
        onchange: e => (draft[f.k] = e.target.checked),
        style: { width: 'auto' },
      });
      lab.style.flexDirection = 'row';
      lab.style.alignItems = 'center';
      lab.style.gap = '8px';
      lab.prepend(inp);
      grid.append(lab);
      return;
    } else if (f.t === 'sel')
      inp = h(
        'select',
        { onchange: e => (draft[f.k] = e.target.value) },
        f.opts.map(o => h('option', { value: o, selected: (draft[f.k] ?? f.opts[0]) === o }, o))
      );
    else if (f.t === 'area') {
      inp = h('textarea', { rows: 5, oninput: e => (draft[f.k] = e.target.value) });
      inp.value = typeof draft[f.k] === 'object' ? tr(draft[f.k]) : (draft[f.k] ?? '');
      lab.style.gridColumn = '1 / -1';
    } else if (f.t === 'formula')
      inp = h('input', {
        type: 'text',
        value: draft[f.k] ?? '',
        style: { fontFamily: 'var(--font-mono)' },
        oninput: e => {
          draft[f.k] = e.target.value;
          try {
            Formula.parse(e.target.value, false);
            e.target.style.borderColor = '';
          } catch (er) {
            e.target.style.borderColor = 'var(--bad)';
          }
        },
      });
    else
      inp = h('input', {
        type: 'text',
        value: draft[f.k] ?? '',
        oninput: e => (draft[f.k] = e.target.value),
      });
    lab.append(inp);
    grid.append(lab);
  });
  form.append(grid);
  for (const r of sc.rows) {
    if (!draft[r.key]) {
      if (r.optional) {
        form.append(
          h(
            'div',
            { style: { marginBottom: '10px' } },
            h(
              'button.btn.sm',
              {
                type: 'button',
                onclick: e => {
                  draft[r.key] = [];
                  e.target.parentElement.replaceWith(rowsEditor(r.l, draft[r.key], r.cols, r.mk));
                },
              },
              '＋ ' + r.l
            )
          )
        );
      }
      continue;
    }
    form.append(rowsEditor(r.l, draft[r.key], r.cols, r.mk));
  }
  // JSON avançado
  const ta = h('textarea.code', { spellcheck: 'false' });
  const det = h('details', h('summary', t('adv')), ta);
  det.addEventListener('toggle', () => {
    if (det.open) ta.value = JSON.stringify(draft, null, 2);
  });
  form.append(det);
  const save = () => {
    let out = draft;
    if (det.open && ta.value.trim()) {
      try {
        out = JSON.parse(ta.value);
      } catch (e) {
        toast(t('invalid') + ': ' + e.message);
        return false;
      }
    }
    ['fields', 'columns', 'attrs'].forEach(k => {
      if (out[k])
        out[k].forEach(x => {
          if (x.id) x.id = String(x.id).trim().replace(/\s+/g, '_');
          if (x.kind === 'select' && !x.options) x.options = ['A', 'B'];
          if (x.def === '') delete x.def;
        });
    });
    tab.blocks[i] = out;
    commitTpl();
  };
  modal({
    title: t('edit') + ' — ' + (tr(b.title) || b.type),
    body: form,
    wide: true,
    actions: [{ label: t('cancel') }, { label: t('save'), primary: true, onClick: save }],
  });
}
async function editSystemJson() {
  if (!(await ensureEditable())) return;
  const ta = h('textarea.code', { spellcheck: 'false', style: { minHeight: '60vh', width: '100%' } });
  ta.value = JSON.stringify(App.tpl, null, 2);
  modal({
    title: t('jsonSys'),
    body: ta,
    wide: true,
    actions: [
      { label: t('cancel') },
      {
        label: t('save'),
        primary: true,
        onClick: () => {
          try {
            const o = JSON.parse(ta.value);
            if (!Array.isArray(o.tabs)) throw new Error('tabs[]');
            o.id = App.tpl.id;
            o.builtin = false;
            App.tpl = o;
            commitTpl();
          } catch (e) {
            toast(t('invalid') + ': ' + e.message);
            return false;
          }
        },
      },
    ],
  });
}

/* ---------- modelo em branco e assistente de sistema ---------- */
function buildBlank() {
  return {
    id: 'blank',
    rev: 1,
    builtin: true,
    name: T('Ficha em branco', 'Blank sheet'),
    desc: T('Comece do zero.', 'Start from scratch.'),
    icon: '▢',
    theme: 'claro',
    hud: { title: 'nome', sub: '""', resources: [], stats: [] },
    tabs: [
      {
        id: 'ficha',
        title: T('Ficha', 'Sheet'),
        blocks: [
          {
            type: 'fields',
            id: 'ident',
            span: 12,
            plain: true,
            fspan: 6,
            fields: [{ id: 'nome', kind: 'text', label: T('Nome', 'Name'), span: 12, big: true }],
          },
          {
            type: 'fields',
            id: 'notas',
            span: 12,
            title: T('Anotações', 'Notes'),
            fields: [{ id: 'notas_txt', kind: 'area', label: '', span: 12, rows: 8 }],
          },
        ],
      },
    ],
  };
}
function systemWizard() {
  const pt = LANG === 'pt';
  const f = (l, el) => h('label.f', l, el);
  const name = h('input', {
    type: 'text',
    placeholder: pt ? 'Ex.: Meu RPG de piratas espaciais' : 'e.g. My space pirate RPG',
  });
  const attrs = h('textarea', { rows: 6 });
  attrs.value = pt
    ? 'FOR Força\nDES Destreza\nCON Constituição\nINT Inteligência\nSAB Sabedoria\nCAR Carisma'
    : 'STR Strength\nDEX Dexterity\nCON Constitution\nINT Intelligence\nWIS Wisdom\nCHA Charisma';
  const mod = h(
    'select',
    h(
      'option',
      { value: 'dnd' },
      pt
        ? 'Estilo D&D: (valor − 10) ÷ 2, arredondado para baixo'
        : 'D&D style: (value − 10) ÷ 2, rounded down'
    ),
    h('option', { value: 'direct' }, pt ? 'O próprio valor é o modificador' : 'Value is the modifier'),
    h('option', { value: 'none' }, pt ? 'Sem modificador (só o valor)' : 'No modifier (value only)')
  );
  const prof = h(
    'select',
    h(
      'option',
      { value: 'dnd' },
      pt ? 'Bônus de proficiência por nível (+2 a +6, como D&D)' : 'Proficiency by level (+2 to +6, D&D)'
    ),
    h('option', { value: 'fixed' }, pt ? 'Bônus fixo que eu digito' : 'Fixed bonus I type'),
    h('option', { value: 'none' }, pt ? 'Sem proficiência' : 'No proficiency')
  );
  const skills = h('textarea', { rows: 6 });
  skills.value = pt
    ? 'Atletismo: FOR\nFurtividade: DES\nPercepção: SAB\nPersuasão: CAR'
    : 'Athletics: STR\nStealth: DEX\nPerception: WIS\nPersuasion: CHA';
  const res = h('textarea', { rows: 3 });
  res.value = pt ? 'PV 10\nPP 5' : 'HP 10\nMP 5';
  const opt = (id, l, on) =>
    h(
      'label',
      { style: { display: 'flex', gap: '6px', alignItems: 'center', marginRight: '14px' } },
      h('input', { type: 'checkbox', id, checked: on, style: { width: 'auto' } }),
      l
    );
  const body = h(
    'div',
    f(t('sysName'), name),
    h(
      'div.row2',
      f(pt ? 'Atributos (uma linha cada: SIGLA Nome)' : 'Attributes (one per line: ABBR Name)', attrs),
      h(
        'div',
        f(pt ? 'Como calcular o modificador' : 'Modifier rule', mod),
        f(pt ? 'Proficiência' : 'Proficiency', prof)
      )
    ),
    h(
      'div.row2',
      f(pt ? 'Perícias (Nome: SIGLA)' : 'Skills (Name: ABBR)', skills),
      f(pt ? 'Recursos (Nome valor-máximo)' : 'Resources (Name max-value)', res)
    ),
    h(
      'div',
      { style: { display: 'flex', flexWrap: 'wrap', gap: '4px' } },
      opt('w_atk', pt ? 'Ataques' : 'Attacks', true),
      opt('w_inv', pt ? 'Inventário' : 'Inventory', true),
      opt('w_hab', pt ? 'Habilidades / magias' : 'Abilities / spells', true),
      opt('w_hist', pt ? 'História e notas' : 'Backstory & notes', true)
    )
  );
  const build = () => {
    const nm = name.value.trim() || (pt ? 'Meu sistema' : 'My system');
    const W = id => body.querySelector('#' + id).checked;
    const at = attrs.value
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean)
      .map(s => {
        const [ab, ...r] = s.split(/\s+/);
        return { id: slug(ab), abbr: ab, label: r.join(' ') || ab };
      });
    const modF = { dnd: 'floor((v-10)/2)', direct: 'v', none: '0' }[mod.value];
    const sk = skills.value
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean)
      .map(s => {
        const [n, a] = s.split(':');
        return { key: slug(n), label: n.trim(), attr: slug((a || at[0].abbr).trim()) };
      });
    const rs = res.value
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean)
      .map(s => {
        const m = /^(.+?)\s+(\d+)$/.exec(s);
        return m ? { name: m[1], max: m[2] } : { name: s, max: '10' };
      });
    const idf = [
      { id: 'nome', kind: 'text', label: pt ? 'Nome' : 'Name', span: 6, big: true },
      { id: 'jogador', kind: 'text', label: pt ? 'Jogador' : 'Player', span: 3 },
    ];
    if (prof.value === 'dnd')
      idf.push(
        { id: 'nivel', kind: 'number', label: pt ? 'Nível' : 'Level', span: 1, def: 1, min: 1 },
        {
          id: 'prof',
          kind: 'calc',
          label: pt ? 'Proficiência' : 'Proficiency',
          span: 2,
          tile: true,
          fmt: 'signed',
          override: true,
          formula: '2+floor((nivel-1)/4)',
        }
      );
    else if (prof.value === 'fixed')
      idf.push({ id: 'prof', kind: 'number', label: pt ? 'Proficiência' : 'Proficiency', span: 3, def: 2 });
    else idf.push({ id: 'nivel', kind: 'number', label: pt ? 'Nível' : 'Level', span: 3, def: 1 });
    const blocks = [{ type: 'fields', id: 'ident', span: 12, plain: true, cols: 12, fields: idf }];
    blocks.push({
      type: 'attrs',
      id: 'atributos',
      span: 5,
      title: pt ? 'Atributos' : 'Attributes',
      attrs: at.map(a => ({ id: a.id, label: a.label, abbr: a.abbr })),
      mod: modF,
      generator: true,
      rollLabel: pt ? 'Teste de' : 'Check:',
    });
    rs.forEach((r, i) =>
      blocks.push({
        type: 'resource',
        id: slug(r.name),
        span: 7,
        title: r.name,
        label: r.name,
        kind: i === 0 ? 'hp' : 'pp',
        max: r.max,
        temp: i === 0,
        manualMax: true,
      })
    );
    if (sk.length) {
      const cols = [
        { id: 'label', kind: 'label', label: pt ? 'Perícia' : 'Skill', w: '1fr' },
        { id: 'attr', kind: 'select', options: '@attrs', label: pt ? 'Atr.' : 'Attr.', w: '62px' },
        { id: 'outros', kind: 'number', label: pt ? 'Outros' : 'Other', w: '52px' },
      ];
      if (prof.value !== 'none') cols.push({ id: 'pro', kind: 'check', label: 'Pro.', w: '34px' });
      cols.push({
        id: 'total',
        kind: 'calc',
        label: 'Total',
        w: '44px',
        fmt: 'signed',
        roll: true,
        d20: true,
        formula: 'val(attr&"_mod")' + (prof.value !== 'none' ? ' + if(pro,prof,0)' : '') + ' + outros',
      });
      blocks.push({
        type: 'list',
        id: 'pericias',
        span: 7,
        title: pt ? 'Perícias' : 'Skills',
        split: 2,
        columns: cols,
        rows: sk,
      });
    }
    const tabs = [{ id: 'ficha', title: pt ? 'Ficha' : 'Sheet', blocks }];
    const b2 = [];
    if (W('w_atk'))
      b2.push({
        type: 'list',
        id: 'ataques',
        span: 12,
        title: pt ? 'Ataques' : 'Attacks',
        addLabel: pt ? 'Novo ataque' : 'New attack',
        columns: [
          { id: 'nome', kind: 'text', label: pt ? 'Nome' : 'Name', w: '1.4fr' },
          { id: 'bonus', kind: 'number', label: pt ? 'Bônus' : 'Bonus', w: '64px' },
          { id: 'dano', kind: 'text', label: pt ? 'Dano' : 'Damage', w: '1fr', placeholder: '1d8+3' },
          { id: 'obs', kind: 'text', label: pt ? 'Notas' : 'Notes', w: '1.4fr' },
          {
            id: 'a',
            kind: 'rollbtn',
            w: '40px',
            icon: '⚔',
            d20: true,
            expr: '"1d20+"&bonus',
            title: pt ? 'Ataque' : 'Attack',
          },
          { id: 'd', kind: 'rollbtn', w: '40px', icon: '🎲', expr: 'dano', title: pt ? 'Dano' : 'Damage' },
        ],
      });
    if (W('w_inv'))
      b2.push({
        type: 'list',
        id: 'inventario',
        span: 6,
        title: pt ? 'Inventário' : 'Inventory',
        addLabel: pt ? 'Novo item' : 'New item',
        columns: [
          { id: 'nome', kind: 'text', label: 'Item', w: '1.6fr' },
          { id: 'qtd', kind: 'number', label: 'Qtd', w: '60px', def: 1 },
          { id: 'obs', kind: 'text', label: pt ? 'Notas' : 'Notes', w: '1.2fr' },
        ],
      });
    if (W('w_hab'))
      b2.push({
        type: 'list',
        id: 'habilidades',
        display: 'cards',
        cols: 2,
        span: 12,
        title: pt ? 'Habilidades e magias' : 'Abilities & spells',
        titleField: 'nome',
        addLabel: pt ? 'Nova habilidade' : 'New ability',
        columns: [
          { id: 'nome', kind: 'text', label: pt ? 'Nome' : 'Name', span: 8 },
          { id: 'custo', kind: 'text', label: pt ? 'Custo' : 'Cost', span: 4 },
          { id: 'desc', kind: 'area', label: pt ? 'Descrição' : 'Description', span: 12, rows: 3 },
        ],
      });
    if (W('w_hist'))
      b2.push({
        type: 'fields',
        id: 'historia',
        span: 12,
        title: pt ? 'História e notas' : 'Backstory & notes',
        fields: [{ id: 'historia_txt', kind: 'area', label: '', span: 12, rows: 10 }],
      });
    if (b2.length) tabs.push({ id: 'extra', title: pt ? 'Equipamento e notas' : 'Gear & notes', blocks: b2 });
    const tpl = {
      id: 'sys-' + uid(),
      rev: 1,
      builtin: false,
      name: nm,
      desc: at.map(a => a.abbr).join(' · '),
      icon: '✦',
      theme: 'carta',
      hud: {
        title: 'nome',
        sub: prof.value === 'none' ? '""' : '"Nv " & nivel',
        resources: rs.map(r => slug(r.name)),
        stats: prof.value === 'none' ? [] : [{ label: 'Prof.', f: 'prof', fmt: 'signed' }],
      },
      tabs,
    };
    Store.data.systems[tpl.id] = tpl;
    Store.save();
    newChar(tpl.id);
  };
  modal({
    title: t('wizTitle'),
    body,
    wide: true,
    actions: [
      { label: t('cancel') },
      {
        label: t('wizBuild'),
        primary: true,
        onClick: () => {
          build();
        },
      },
    ],
  });
}
