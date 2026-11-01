/* ===== Utilidades, i18n, armazenamento, dados ===== */
function h(sel, attrs, ...kids) {
  if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) {
    kids.unshift(attrs);
    attrs = null;
  }
  const m = /^([a-z0-9]*)((?:[.#][\w-]+)*)$/i.exec(sel) || [, sel, ''];
  const el = document.createElement(m[1] || 'div');
  (m[2].match(/[.#][\w-]+/g) || []).forEach(x =>
    x[0] === '.' ? el.classList.add(x.slice(1)) : (el.id = x.slice(1))
  );
  if (attrs)
    for (const k in attrs) {
      const v = attrs[k];
      if (v === null || v === undefined || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'style' && typeof v === 'object') {
        for (const sk in v) {
          if (sk.startsWith('--')) el.style.setProperty(sk, v[sk]);
          else el.style[sk] = v[sk];
        }
      } else if (k === 'class')
        v.split(' ')
          .filter(Boolean)
          .forEach(c => el.classList.add(c));
      else if (
        k === 'value' ||
        k === 'checked' ||
        k === 'disabled' ||
        k === 'selected' ||
        k === 'indeterminate'
      )
        el[k] = v;
      else if (k === 'html') el.innerHTML = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  const add = k => {
    if (k === null || k === undefined || k === false) return;
    if (Array.isArray(k)) k.forEach(add);
    else el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  };
  kids.forEach(add);
  return el;
}
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const clone = o => JSON.parse(JSON.stringify(o));
const debounce = (f, ms) => {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => f(...a), ms);
  };
};
const slug = s =>
  String(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'campo';
const hash = s => {
  let x = 5381;
  for (let i = 0; i < s.length; i++) x = ((x << 5) + x + s.charCodeAt(i)) | 0;
  return (x >>> 0).toString(36);
};

/* ---- i18n ---- */
let LANG = 'pt';
const STR = {
  pt: {
    app: 'RPG Master',
    tag: 'Fichas de RPG que se calculam sozinhas. Funciona offline, cabe em um arquivo e roda em qualquer navegador.',
    myChars: 'Suas fichas',
    noChars: 'Nenhuma ficha ainda. Escolha um sistema abaixo para criar a primeira.',
    newChar: 'Novo personagem',
    sysBlank: 'Ficha em branco',
    sysBlankD: 'Comece do zero e monte os blocos que quiser.',
    sysCustom: 'Criar meu sistema',
    sysCustomD: 'Descreva atributos, perícias e recursos; o app monta a ficha.',
    sysXlsx: 'Importar planilha Excel',
    sysXlsxD: 'O app lê abas, valores e fórmulas e recria a ficha.',
    sysJson: 'Importar ficha (.json)',
    sysJsonD: 'Abra uma ficha enviada por um amigo ou pelo mestre.',
    yours: 'Seus sistemas',
    builtin: 'Sistemas prontos',
    other: 'Outras formas de começar',
    open: 'Abrir',
    del: 'Excluir',
    delQ: 'Excluir "{0}"? Isso não pode ser desfeito.',
    saved: 'Salvo',
    saving: 'Salvando…',
    saveFail: 'Sem espaço para salvar. Exporte a ficha.',
    export: 'Exportar ficha (.json)',
    import: 'Importar (.json / .xlsx)',
    print: 'Imprimir / PDF',
    editLayout: 'Editar layout da ficha',
    doneEdit: 'Concluir edição',
    longRest: 'Descanso longo',
    rolls: 'Dados',
    home: 'Fichas',
    appearance: 'Aparência',
    theme: 'Tema',
    accent: 'Cor de destaque',
    font: 'Fonte',
    radius: 'Cantos',
    density: 'Densidade',
    size: 'Tamanho do texto',
    reset: 'Restaurar',
    lang: 'Idioma',
    backup: 'Backup de tudo (.json)',
    exportSys: 'Exportar sistema (.json)',
    jsonSys: 'Editar JSON do sistema',
    advantage: 'Vantagem',
    disadv: 'Desvantagem',
    normal: 'Normal',
    rollExpr: 'Fórmula, ex.: 2d6+3',
    roll: 'Rolar',
    history: 'Histórico',
    add: 'Adicionar',
    remove: 'Remover',
    cancel: 'Cancelar',
    ok: 'OK',
    save: 'Salvar',
    close: 'Fechar',
    dmg: 'Dano',
    heal: 'Cura',
    amount: 'Valor',
    temp: 'Temp.',
    manual: 'manual',
    adjust: 'Ajustes',
    gen: 'Gerar atributos',
    gen4: 'Rolar 4d6 (descarta o menor)',
    genStd: 'Padrão: 15, 14, 13, 12, 10, 8',
    restDone: 'Descanso longo aplicado.',
    applied: 'Aplicado: {0}',
    overload: 'Sem PP suficiente. Usar com Sobrecarga? Você ganha {0} nível(is) de Exaustão.',
    overloadMax: 'Exaustão máxima: você desmaiaria antes de usar a técnica.',
    noDice: 'Não encontrei dados nessa expressão.',
    imported: 'Ficha importada: {0}',
    importedTpl: 'Sistema "{0}" adicionado.',
    badFile: 'Arquivo não reconhecido.',
    forkQ:
      'Este é um modelo pronto. Para editar o layout vou criar uma cópia só sua ("{0}"). Suas outras fichas não mudam. Continuar?',
    newBlock: 'Novo bloco',
    tabNew: 'Nova aba',
    tabName: 'Nome da aba',
    tabRename: 'Renomear aba',
    tabDel: 'Excluir aba',
    delTabQ: 'Excluir a aba "{0}" e todos os blocos dela?',
    delBlkQ: 'Excluir este bloco?',
    moveL: 'Mover antes',
    moveR: 'Mover depois',
    wider: 'Mais largo',
    narrower: 'Mais estreito',
    edit: 'Editar',
    dup: 'Duplicar',
    sysName: 'Nome do sistema',
    copyOf: 'cópia',
    created: 'Ficha criada.',
    charName: 'Nome do personagem',
    unnamed: 'Sem nome',
    updated: 'Atualizado',
    dropHint: 'Dica: você também pode arrastar um arquivo .json ou .xlsx para esta janela.',
    pvLabel: 'PV',
    level: 'Nível',
    cols: 'Colunas',
    rowsFixed: 'Linhas fixas (uma por linha: chave | rótulo)',
    fieldsT: 'Campos',
    attrsT: 'Atributos',
    formula: 'Fórmula',
    label: 'Rótulo',
    kind: 'Tipo',
    id: 'Identificador',
    span: 'Largura (1-12)',
    options: 'Opções (separadas por vírgula)',
    default: 'Padrão',
    adv: 'Avançado: JSON do bloco',
    invalid: 'Inválido',
    formulaOk: 'Fórmula válida',
    unknownVar: 'Variável desconhecida: {0}',
    wizTitle: 'Criar meu sistema',
    wizBuild: 'Criar sistema',
    xlsxTitle: 'Importar planilha',
    xlsxSheets: 'Abas a importar',
    xlsxOrig: 'Manter cores originais',
    xlsxReport: '{0} células, {1} fórmulas convertidas',
    xlsxUnsup: 'Funções sem suporte: {0}',
    xlsxHelp:
      'Verde = campo editável · Azul/dourado = calculado · cinza = texto fixo. Clique em uma célula para alternar entre campo e texto.',
    xlsxMake: 'Criar ficha',
    xlsxReading: 'Lendo planilha…',
    xlsxErr: 'Não consegui ler esse arquivo .xlsx.',
    gridEdit: 'Marcar campos',
    gridEditOn: 'Clique nas células para alternar campo/texto',
    origColors: 'Cores originais',
  },
  en: {
    app: 'RPG Master',
    tag: 'RPG character sheets that do the math. Works offline, fits in one file and runs in any browser.',
    myChars: 'Your characters',
    noChars: 'No characters yet. Pick a system below to create the first one.',
    newChar: 'New character',
    sysBlank: 'Blank sheet',
    sysBlankD: 'Start from scratch and build whatever blocks you like.',
    sysCustom: 'Create my own system',
    sysCustomD: 'Describe attributes, skills and resources; the app builds the sheet.',
    sysXlsx: 'Import Excel sheet',
    sysXlsxD: 'The app reads tabs, values and formulas and rebuilds the sheet.',
    sysJson: 'Import sheet (.json)',
    sysJsonD: 'Open a sheet sent by a friend or the GM.',
    yours: 'Your systems',
    builtin: 'Ready-made systems',
    other: 'Other ways to start',
    open: 'Open',
    del: 'Delete',
    delQ: 'Delete "{0}"? This cannot be undone.',
    saved: 'Saved',
    saving: 'Saving…',
    saveFail: 'No room to save. Export the sheet.',
    export: 'Export sheet (.json)',
    import: 'Import (.json / .xlsx)',
    print: 'Print / PDF',
    editLayout: 'Edit sheet layout',
    doneEdit: 'Finish editing',
    longRest: 'Long rest',
    rolls: 'Dice',
    home: 'Sheets',
    appearance: 'Appearance',
    theme: 'Theme',
    accent: 'Accent color',
    font: 'Font',
    radius: 'Corners',
    density: 'Density',
    size: 'Text size',
    reset: 'Reset',
    lang: 'Language',
    backup: 'Full backup (.json)',
    exportSys: 'Export system (.json)',
    jsonSys: 'Edit system JSON',
    advantage: 'Advantage',
    disadv: 'Disadvantage',
    normal: 'Normal',
    rollExpr: 'Formula, e.g. 2d6+3',
    roll: 'Roll',
    history: 'History',
    add: 'Add',
    remove: 'Remove',
    cancel: 'Cancel',
    ok: 'OK',
    save: 'Save',
    close: 'Close',
    dmg: 'Damage',
    heal: 'Heal',
    amount: 'Amount',
    temp: 'Temp.',
    manual: 'manual',
    adjust: 'Adjustments',
    gen: 'Generate attributes',
    gen4: 'Roll 4d6 (drop lowest)',
    genStd: 'Standard: 15, 14, 13, 12, 10, 8',
    restDone: 'Long rest applied.',
    applied: 'Applied: {0}',
    overload: 'Not enough PP. Use with Overload? You gain {0} level(s) of Exhaustion.',
    overloadMax: 'Max exhaustion: you would pass out before using the technique.',
    noDice: 'No dice found in that expression.',
    imported: 'Sheet imported: {0}',
    importedTpl: 'System "{0}" added.',
    badFile: 'Unrecognized file.',
    forkQ:
      'This is a ready-made template. To edit the layout I will make a copy just for you ("{0}"). Your other sheets are unchanged. Continue?',
    newBlock: 'New block',
    tabNew: 'New tab',
    tabName: 'Tab name',
    tabRename: 'Rename tab',
    tabDel: 'Delete tab',
    delTabQ: 'Delete the tab "{0}" and all its blocks?',
    delBlkQ: 'Delete this block?',
    moveL: 'Move earlier',
    moveR: 'Move later',
    wider: 'Wider',
    narrower: 'Narrower',
    edit: 'Edit',
    dup: 'Duplicate',
    sysName: 'System name',
    copyOf: 'copy',
    created: 'Sheet created.',
    charName: 'Character name',
    unnamed: 'Unnamed',
    updated: 'Updated',
    dropHint: 'Tip: you can also drag a .json or .xlsx file onto this window.',
    pvLabel: 'HP',
    level: 'Level',
    cols: 'Columns',
    rowsFixed: 'Fixed rows (one per line: key | label)',
    fieldsT: 'Fields',
    attrsT: 'Attributes',
    formula: 'Formula',
    label: 'Label',
    kind: 'Type',
    id: 'Identifier',
    span: 'Width (1-12)',
    options: 'Options (comma separated)',
    default: 'Default',
    adv: 'Advanced: block JSON',
    invalid: 'Invalid',
    formulaOk: 'Valid formula',
    unknownVar: 'Unknown variable: {0}',
    wizTitle: 'Create my system',
    wizBuild: 'Create system',
    xlsxTitle: 'Import spreadsheet',
    xlsxSheets: 'Tabs to import',
    xlsxOrig: 'Keep original colors',
    xlsxReport: '{0} cells, {1} formulas converted',
    xlsxUnsup: 'Unsupported functions: {0}',
    xlsxHelp:
      'Green = editable field · Blue/gold = computed · gray = fixed text. Click a cell to toggle field/text.',
    xlsxMake: 'Create sheet',
    xlsxReading: 'Reading spreadsheet…',
    xlsxErr: 'I could not read that .xlsx file.',
    gridEdit: 'Mark fields',
    gridEditOn: 'Click cells to toggle field/text',
    origColors: 'Original colors',
  },
};
const t = (k, ...a) => {
  let s = (STR[LANG] && STR[LANG][k]) || (LANG !== 'pt' && STR.en[k]) || STR.pt[k] || k;
  a.forEach((v, i) => (s = s.replace('{' + i + '}', v)));
  return s;
};
const tr = x =>
  x === null || x === undefined
    ? ''
    : typeof x === 'object'
      ? (x[LANG] ?? (LANG === 'de' ? x.en : undefined) ?? x.pt ?? Object.values(x)[0] ?? '')
      : String(x);

/* escolha por idioma: L3(pt, en, de) — de cai para en */
const L3 = (pt, en, de) => (LANG === 'pt' ? pt : LANG === 'de' ? (de ?? en ?? pt) : (en ?? pt));

/* ---- armazenamento ---- */
const Store = {
  data: null,
  ok: true,
  load() {
    let d = null;
    if (window.__PREVIEW) {
      this.data = {
        v: 1,
        prefs: { lang: 'pt' },
        chars: {},
        systems: {},
        cur: null,
        vtt: { scenes: [], cur: null },
      };
      return;
    }
    try {
      d = JSON.parse(localStorage.getItem('forja.v1') || 'null');
    } catch (e) {}
    this.data =
      d && d.v === 1
        ? d
        : { v: 1, prefs: { lang: 'pt' }, chars: {}, systems: {}, cur: null, vtt: { scenes: [], cur: null } };
    this.data.prefs = this.data.prefs || {};
    this.data.systems = this.data.systems || {};
    this.data.chars = this.data.chars || {};
    this.data.npcs = this.data.npcs || [];
    this.data.vtt = this.data.vtt || { scenes: [], cur: null };
    this.data.encounters = this.data.encounters || [];
  },
  save() {
    if (window.__PREVIEW) {
      UI_saved && UI_saved(true);
      return;
    }
    try {
      localStorage.setItem('forja.v1', JSON.stringify(this.data));
      this.ok = true;
    } catch (e) {
      this.ok = false;
    }
    UI_saved && UI_saved(this.ok);
  },
};
let UI_saved = null;
const saveSoon = debounce(() => Store.save(), 400);

function download(name, text, mime = 'application/json') {
  const a = h('a', { href: URL.createObjectURL(new Blob([text], { type: mime })), download: name });
  document.body.append(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 500);
}
const fileName = s =>
  (s || 'ficha')
    .replace(/[\\/:*?"<>|]+/g, '_')
    .trim()
    .slice(0, 60) || 'ficha';

/* ---- dados ---- */
const rnd = n => {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return Math.floor((a[0] / 4294967296) * n) + 1;
};
const DICE_FIND = /\d*d\d+/i;
function parseDice(src) {
  src = String(src ?? '');
  const m = DICE_FIND.exec(src);
  if (!m) return null;
  // retrocede para pegar sinal anterior e avança para pegar termos seguintes
  let start = m.index;
  const rest = src.slice(start);
  const chain = /^(?:\d*d\d+(?:k[hl]\d+)?)(?:\s*[+-]\s*(?:\d*d\d+(?:k[hl]\d+)?|\d+(?:[.,]\d+)?))*/i.exec(
    rest
  );
  if (!chain) return null;
  const expr = chain[0];
  const terms = [];
  const re = /([+-]?)\s*(?:(\d*)d(\d+)(?:k([hl])(\d+))?|(\d+(?:[.,]\d+)?))/gi;
  let x;
  while ((x = re.exec(expr))) {
    const sign = x[1] === '-' ? -1 : 1;
    if (x[3])
      terms.push({
        sign,
        n: Math.min(parseInt(x[2] || '1'), 100),
        f: Math.min(parseInt(x[3]), 1000),
        k: x[4],
        kn: x[5] ? parseInt(x[5]) : 0,
      });
    else terms.push({ sign, c: parseFloat(x[6].replace(',', '.')) });
  }
  return { expr: expr.replace(/\s+/g, ''), terms };
}
function rollParsed(p, { adv = 0 } = {}) {
  let total = 0;
  const parts = [];
  let nat = null,
    d20 = false;
  p.terms.forEach((tm, i) => {
    if (tm.c !== undefined) {
      total += tm.sign * tm.c;
      parts.push({ sign: tm.sign, c: tm.c });
      return;
    }
    let rolls = Array.from({ length: tm.n }, () => rnd(tm.f));
    let kept = rolls.slice();
    let alt = null;
    if (tm.f === 20 && tm.n === 1 && adv && i === 0) {
      alt = rnd(20);
      kept = [adv > 0 ? Math.max(rolls[0], alt) : Math.min(rolls[0], alt)];
      rolls = [rolls[0], alt];
    } else if (tm.k) {
      const s = rolls.slice().sort((a, b) => a - b);
      kept = tm.k === 'h' ? s.slice(-tm.kn) : s.slice(0, tm.kn);
    }
    const sum = kept.reduce((a, b) => a + b, 0);
    total += tm.sign * sum;
    if (tm.f === 20 && tm.n === 1 && i === 0) {
      nat = kept[0];
      d20 = true;
    }
    parts.push({ sign: tm.sign, n: tm.n, f: tm.f, rolls, kept, alt: alt !== null });
  });
  return { total, parts, nat, d20 };
}
function partsText(parts) {
  return parts
    .map((p, i) => {
      const sg = p.sign < 0 ? '−' : i ? '+' : '';
      if (p.c !== undefined) return sg + ' ' + p.c;
      return (
        sg +
        ' ' +
        p.n +
        'd' +
        p.f +
        '[' +
        (p.alt ? p.rolls.join('/') + '→' + p.kept[0] : p.rolls.join(',')) +
        ']'
      );
    })
    .join(' ')
    .trim();
}
