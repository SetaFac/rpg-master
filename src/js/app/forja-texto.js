/* ===== Forja Texto: linguagem simples (em português) para montar fichas e sistemas =====
   Não é programação: cada linha descreve uma peça da ficha. O compilador transforma o texto
   no mesmo modelo (JSON) que o resto do app usa. */
const FT = (() => {
  const strip = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const KIND = {
    texto: 'text',
    numero: 'number',
    calculo: 'calc',
    marcar: 'check',
    check: 'check',
    area: 'area',
    escolha: 'select',
    rotulo: 'label',
    rolar: 'rollbtn',
  };
  const BLOCKS = new Set([
    'campos',
    'atributos',
    'recurso',
    'tabela',
    'cartoes',
    'notas',
    'aviso',
    'sorteio',
  ]);
  const TOP = new Set([
    'sistema',
    'descricao',
    'icone',
    'tema',
    'titulo',
    'subtitulo',
    'destaque',
    'barras',
    'descanso',
  ]);

  // fórmulas: modde(x) -> val(x&"_mod")
  const fx = f =>
    String(f)
      .replace(
        /nivelpor\(\s*([^,()]+?)\s*,\s*([^()]+?)\)/gi,
        (m0, v, list) =>
          '(1 + ' +
          list
            .split(/\s*,\s*/)
            .map(x => 'if(' + v + ' >= ' + x + ', 1, 0)')
            .join(' + ') +
          ')'
      )
      .replace(/modde\(\s*([^()]+?)\s*\)/gi, 'val($1&"_mod")')
      .replace(/\bvalor\(/gi, 'val(');

  // "1d20+{bonus}" -> '"1d20+" & (bonus)'
  const diceF = t0 => {
    const parts = String(t0).split(/\{([^}]+)\}/);
    return (
      parts
        .map((x, i) => (i % 2 ? '(' + fx(x) + ')' : x ? JSON.stringify(x) : ''))
        .filter(Boolean)
        .join(' & ') || '""'
    );
  };
  // separa "tudo antes do |" e as opções depois dele
  function split(rest, noFlags) {
    const i = rest.indexOf(' |');
    const main = (i < 0 ? rest : rest.slice(0, i)).trim();
    const opts = {};
    if (i >= 0) {
      const o = rest.slice(i + 2).trim();
      // key=value (valor pode ter espaços até a próxima key=) ou flag
      const re = /([\p{L}_]+)(?:=((?:(?!\s[\p{L}_]+=).)*))?/gu;
      let m;
      const words = o.split(/\s+/);
      let cur = null;
      words.forEach(w => {
        if (w === '|') {
          cur = null;
          return;
        }
        const kv = /^([\p{L}_]+)=(.*)$/u.exec(w);
        if (kv) {
          cur = strip(kv[1]);
          opts[cur] = kv[2];
        } else if (cur && opts[cur] !== true && /=/.test(o) && (noFlags || !isFlag(w, opts))) {
          opts[cur] += ' ' + w;
        } else if (cur && noFlags) {
          opts[cur] += ' ' + w;
        } else {
          opts[strip(w)] = true;
          cur = null;
        }
      });
    }
    return { main, opts };
  }
  const FLAGS = new Set([
    'grande',
    'sinal',
    'inteiro',
    'destaque',
    'rolar',
    'manual',
    'temp',
    'sem_gerador',
    'compacto',
    'fixa',
    'poder',
    'vida',
  ]);
  const isFlag = (w, opts) => FLAGS.has(strip(w));

  function compile(src) {
    const errors = [],
      warns = [];
    const err = (n, m) => errors.push({ line: n, msg: m });
    const tpl = {
      id: 'txt-' + uid(),
      rev: 1,
      builtin: false,
      name: 'Meu sistema',
      desc: '',
      icon: '✦',
      theme: 'carta',
      hud: { title: 'nome', sub: '""', resources: [], stats: [] },
      tabs: [],
    };
    const ids = new Set();
    const uniq = base => {
      let id = base || 'campo',
        n = 2;
      while (ids.has(id)) id = base + '_' + n++;
      ids.add(id);
      return id;
    };
    const fieldInfo = {};
    let tab = null,
      blk = null,
      tableKind = null;
    const checkF = (f, n) => {
      if (!f) return f;
      const g = fx(f);
      try {
        Formula.parse(g, false);
      } catch (e) {
        err(n, 'Fórmula inválida "' + f + '": ' + e.message);
      }
      return g;
    };
    const need = n => {
      if (!tab) {
        tab = { id: 'ficha', title: 'Ficha', blocks: [] };
        tpl.tabs.push(tab);
      }
    };
    const lines = String(src).replace(/\r/g, '').split('\n');
    let hudStats = [],
      hudBars = [],
      restore = null;
    const catalogs = {};
    let curCat = null;
    const catRefs = [];
    const num = (v, n, what) => {
      const x = parseFloat(String(v).replace(',', '.'));
      if (isNaN(x)) {
        err(n, what + ' precisa ser um número (recebi "' + v + '")');
        return undefined;
      }
      return x;
    };

    function fieldOf(kindWord, rest, n, inTable, scope) {
      const kind = KIND[strip(kindWord)];
      if (!kind) return null;
      const { main, opts } = split(rest);
      let label = main,
        def,
        formula,
        options;
      if (kind === 'calc') {
        const m = /^(.*?)\s*=\s*(.*)$/.exec(main);
        if (m) {
          label = m[1].trim();
          formula = m[2].trim();
        } else {
          err(n, 'cálculo precisa de "=" e uma fórmula. Ex.: calculo Total = a + b');
          formula = '0';
        }
      } else if (kind === 'select') {
        const m = /^(.*?)\s*:\s*(.*)$/.exec(main);
        if (m) {
          label = m[1].trim();
          options = m[2].trim();
        } else err(n, 'escolha precisa das opções depois de ":". Ex.: escolha Alinhamento: Bom, Neutro, Mau');
      } else {
        const m = /^(.*?)\s*=\s*(.*)$/.exec(main);
        if (m) {
          label = m[1].trim();
          def = m[2].trim();
        }
      }
      if (!label) {
        err(n, 'faltou o nome (rótulo) do campo');
        label = 'Campo';
      }
      const base = opts.id ? slug(opts.id) : slug(label);
      let fid = base;
      if (inTable) {
        let k = 2;
        while (scope.has(fid)) fid = base + '_' + k++;
        scope.add(fid);
      } else fid = uniq(base);
      const f = { id: fid, kind, label };
      if (inTable) {
        f.w = opts.px ? opts.px + 'px' : (opts.peso || '1') + 'fr';
        if (opts.compacto) f.compact = true;
      } else
        f.span = opts.largura
          ? Math.max(1, Math.min(12, parseInt(opts.largura) || 4))
          : kind === 'area'
            ? 12
            : 4;
      if (kind === 'number') {
        if (def !== undefined) {
          const d = num(def, n, 'o valor padrão');
          if (d !== undefined) f.def = d;
        }
        if (opts.min !== undefined) f.min = num(opts.min, n, 'min');
        if (opts.max !== undefined) f.max = num(opts.max, n, 'max');
      }
      if (kind === 'text' && def !== undefined) f.def = def;
      if (kind === 'check' && def) f.def = /^(sim|1|true)$/i.test(def);
      if (kind === 'area') f.rows = opts.linhas ? parseInt(opts.linhas) || 4 : 4;
      if (kind === 'select') {
        f.options = /^@atributos$/i.test(options || '')
          ? '@attrs'
          : (options || '').split(/\s*,\s*/).filter(Boolean);
        if (f.options !== '@attrs' && !f.options.length) err(n, 'escolha sem opções');
        f.blank = true;
      }
      if (kind === 'calc') {
        f.formula = checkF(formula, n);
        if (opts.manual) f.override = true;
        f.fmt = opts.sinal ? 'signed' : opts.inteiro ? 'int' : opts.texto ? 'text' : 'num';
        if (opts.destaque) f.tile = true;
        if (opts.rolar) {
          f.roll = true;
          f.d20 = true;
        }
      }
      if (kind === 'rollbtn') {
        f.expr = diceF(opts.rola || '1d20');
        f.title = label;
        f.icon = opts.icone || '🎲';
        f.w = '44px';
        if (/^\s*(1)?d20/i.test(opts.rola || '1d20')) f.d20 = true;
        try {
          Formula.parse(f.expr, false);
        } catch (e) {
          err(n, 'rola= inválido: ' + e.message);
        }
      }
      if (opts.grande) f.big = true;
      if (opts.dica) f.hint = opts.dica;
      if (!inTable) fieldInfo[f.id] = { label, fmt: f.fmt };
      return f;
    }

    lines.forEach((raw, i) => {
      const n = i + 1;
      let s = raw.replace(/\s+#.*$/, '').trim();
      if (!s || s.startsWith('#')) return;
      const m = /^([\p{L}_]+)(?:\s*:\s*|\s+)(.*)$/u.exec(s) || [s, s, ''];
      const kw = strip(m[1]),
        rest = (m[2] || '').trim();
      const hasColon = /^[\p{L}_]+\s*:/u.test(s);
      // ---- diretivas do sistema
      if (TOP.has(kw) && hasColon) {
        if (kw === 'sistema') tpl.name = rest || tpl.name;
        else if (kw === 'descricao') tpl.desc = rest;
        else if (kw === 'icone') tpl.icon = rest || tpl.icon;
        else if (kw === 'tema') {
          const th = THEMES.find(t => t.id === strip(rest) || strip(t.pt) === strip(rest));
          if (th) tpl.theme = th.id;
          else err(n, 'tema desconhecido "' + rest + '". Temas: ' + THEMES.map(t => t.id).join(', '));
        } else if (kw === 'titulo') tpl.hud.title = slug(rest);
        else if (kw === 'subtitulo') tpl.hud.sub = checkF(rest, n);
        else if (kw === 'destaque')
          hudStats = rest
            .split(/\s*,\s*/)
            .filter(Boolean)
            .map(slug);
        else if (kw === 'barras')
          hudBars = rest
            .split(/\s*,\s*/)
            .filter(Boolean)
            .map(slug);
        else if (kw === 'descanso')
          restore = rest
            .replace(/^restaurar\s*/i, '')
            .split(/\s*,\s*/)
            .filter(Boolean)
            .map(slug);
        return;
      }
      if (kw === 'catalogo' && hasColon) {
        curCat = rest.trim();
        if (!curCat) err(n, 'catalogo: precisa de um nome. Ex.: catalogo: Magias');
        else catalogs[curCat] = catalogs[curCat] || [];
        blk = null;
        return;
      }
      if (kw === 'entrada' && curCat !== null && !blk) {
        const { main, opts } = split(rest, true);
        if (!main) {
          err(n, 'entrada sem nome');
          return;
        }
        const d = {};
        Object.entries(opts).forEach(([k, v]) => {
          d[k] =
            v === true ? true : /^-?\d+([.,]\d+)?$/.test(v) ? parseFloat(String(v).replace(',', '.')) : v;
        });
        catalogs[curCat].push({ n: main, d });
        return;
      }
      if (kw === 'aba' && hasColon) {
        curCat = null;
        tab = { id: uniq('aba_' + slug(rest || 'aba')), title: rest || 'Aba', blocks: [] };
        tpl.tabs.push(tab);
        blk = null;
        return;
      }
      if (BLOCKS.has(kw) && hasColon) {
        need();
        curCat = null;
        const { main, opts } = split(rest);
        const title = main;
        const span = opts.largura ? Math.max(1, Math.min(12, parseInt(opts.largura) || 12)) : 12;
        if (kw === 'campos')
          blk = {
            type: 'fields',
            id: uniq(opts.id ? slug(opts.id) : slug(title || 'campos')),
            span,
            cols: 12,
            title: title || undefined,
            fields: [],
          };
        else if (kw === 'atributos')
          blk = {
            type: 'attrs',
            id: uniq(opts.id ? slug(opts.id) : 'atributos'),
            span: opts.largura ? span : 5,
            title: title || 'Atributos',
            attrs: [],
            mod: fx(opts.modificador || 'floor((v-10)/2)'),
            generator: !opts.sem_gerador,
            rollLabel: 'Teste de',
          };
        if (opts.padrao !== undefined) blk.def = parseFloat(opts.padrao) || 0;
        else if (kw === 'recurso') {
          const id = uniq(opts.id ? slug(opts.id) : slug(title || 'recurso'));
          blk = {
            type: 'resource',
            id,
            span: opts.largura ? span : 6,
            title: title || 'Recurso',
            label: opts.sigla || title || 'R',
            kind: opts.poder ? 'pp' : 'hp',
            max: checkF(opts.max || '10', n),
            temp: !!opts.temp,
            manualMax: true,
          };
          if (opts.max === undefined) warns.push({ line: n, msg: 'recurso sem max=. Usei 10.' });
        } else if (kw === 'tabela' || kw === 'cartoes') {
          tableKind = kw;
          blk = {
            type: 'list',
            id: uniq(opts.id ? slug(opts.id) : slug(title || 'lista')),
            span,
            title: title || 'Lista',
            columns: [],
            addLabel: opts.botao || 'Novo',
            _rows: [],
            _scope: new Set(),
          };
          if (kw === 'cartoes') {
            blk.display = 'cards';
            blk.cols = parseInt(opts.colunas) || 2;
          }
          if (opts.divisao) blk.split = parseInt(opts.divisao) || 1;
          if (opts.catalogo) {
            blk._cat = opts.catalogo.trim();
            catRefs.push([n, blk._cat]);
          }
          if (opts.soma) blk._soma = slug(opts.soma);
        } else if (kw === 'notas')
          blk = {
            type: 'fields',
            id: uniq(opts.id ? slug(opts.id) : slug(title || 'notas')),
            span,
            title: title || 'Notas',
            fields: [
              {
                id: uniq(slug(title || 'notas') + '_txt'),
                kind: 'area',
                label: '',
                span: 12,
                rows: parseInt(opts.linhas) || 8,
              },
            ],
          };
        else if (kw === 'sorteio')
          blk = {
            type: 'random',
            id: uniq(opts.id ? slug(opts.id) : slug(title || 'sorteio')),
            span: opts.largura ? span : 6,
            title: title || 'Sorteio',
            dice: opts.dado || '',
            button: opts.botao || undefined,
            entries: [],
          };
        else if (kw === 'aviso')
          blk = { type: 'note', id: uniq(slug(title || 'aviso')), span, title: title || undefined, text: '' };
        tab.blocks.push(blk);
        return;
      }
      if (!blk) {
        err(
          n,
          'linha fora de um bloco: "' + s + '". Comece com "aba:" e um bloco (ex.: "campos: Identidade").'
        );
        return;
      }
      // ---- itens do bloco corrente
      if (blk.type === 'fields') {
        if (blk.fields.length === 1 && blk.fields[0].label === '') {
          err(n, 'notas: não aceita campos. Use "campos:"');
          return;
        }
        const f = fieldOf(m[1], rest, n, false);
        if (!f) err(n, 'não entendi "' + m[1] + '". Tipos: texto, numero, calculo, marcar, area, escolha');
        else blk.fields.push(f);
      } else if (blk.type === 'attrs') {
        const w = s.split(/\s+/);
        const abbr = w[0];
        const label = w.slice(1).join(' ') || abbr;
        blk.attrs.push({ id: uniq(slug(abbr)), abbr, label });
      } else if (blk.type === 'random') {
        const mm = /^(\d+)(?:\s*-\s*(\d+))?\s*:\s*(.+)$/.exec(s);
        if (mm) {
          if (!blk.dice) {
            err(n, 'use dado=d6 (ou d20…) no cabeçalho do sorteio para usar faixas como "1-3: texto"');
            return;
          }
          blk.entries.push({ from: +mm[1], to: mm[2] ? +mm[2] : +mm[1], text: mm[3].trim() });
        } else blk.entries.push({ from: blk.entries.length + 1, to: blk.entries.length + 1, text: s });
      } else if (blk.type === 'note') {
        blk.text += (blk.text ? '\n' : '') + s;
      } else if (blk.type === 'resource') {
        err(n, 'recurso não tem itens; coloque tudo na mesma linha (ex.: recurso: Vida | sigla=PV max=10)');
      } else if (blk.type === 'list') {
        if (kw === 'coluna') {
          const m2 = /^([\p{L}_]+)\s+(.*)$/u.exec(rest);
          if (!m2) {
            err(n, 'coluna precisa de tipo e nome. Ex.: coluna texto Nome');
            return;
          }
          const c = fieldOf(m2[1], m2[2], n, true, blk._scope);
          if (!c) err(n, 'tipo de coluna desconhecido "' + m2[1] + '"');
          else {
            if (tableKind === 'cartoes') {
              c.span = c.span || 6;
              delete c.w;
            }
            blk.columns.push(c);
          }
        } else if (kw === 'linha') {
          const { main, opts } = split(rest);
          const row = { key: slug(main), label: main };
          Object.entries(opts).forEach(([k, v]) => {
            row[k] = v === true ? true : /^-?\d+(\.\d+)?$/.test(v) ? parseFloat(v) : v;
          });
          blk._rows.push(row);
        } else if (kw === 'acao') {
          if (tableKind !== 'cartoes') {
            err(n, '"acao:" só vale em cartoes. Em tabela use "coluna rolar Nome | rola=1d20+{bonus}"');
            return;
          }
          const { main: lab, opts: o } = split(rest, true);
          const a = { label: lab || 'Usar' };
          if (o.gasta) {
            const [res, cost] = String(o.gasta).split(':');
            if (!res || !cost) err(n, 'gasta= precisa de recurso:coluna. Ex.: gasta=energia:custo');
            else a.spend = { res: slug(res), cost: fx(cost.trim()) };
          }
          if (o.rola) {
            a.roll = diceF(o.rola);
            try {
              Formula.parse(a.roll, false);
            } catch (e) {
              err(n, 'rola= inválido: ' + e.message);
            }
            if (/^\s*(1)?d20/i.test(o.rola)) a.d20 = true;
          }
          if (o.titulo) a.title = slug(o.titulo);
          if (o.sobrecarga) {
            const [fld, amt, max] = String(o.sobrecarga).split(':');
            a.overload = { field: slug(fld), amount: fx(amt || '1'), max: parseInt(max) || 5 };
          }
          (blk.actions = blk.actions || []).push(a);
          blk._acts = true;
        } else if (kw === 'soma') {
          blk._soma = slug(rest);
        } else err(n, 'em tabela/cartões use "coluna ..." ou "linha ..."');
      }
    });
    // pós-processamento
    if (!tpl.tabs.length) err(1, 'a ficha está vazia. Comece com "aba: Ficha".');
    tpl.tabs.forEach(tb =>
      tb.blocks.forEach(b => {
        if (b.type === 'random') {
          if (!b.entries.length) err(0, 'o sorteio "' + b.title + '" está vazio');
          const f = parseInt(String(b.dice).replace(/\D/g, '')) || 0;
          if (f && b.entries.some(e => e.to > f))
            warns.push({ line: 0, msg: 'sorteio "' + b.title + '": há faixas acima de d' + f });
          if (f) {
            const cov = new Set();
            b.entries.forEach(e => {
              for (let k = e.from; k <= e.to; k++) cov.add(k);
            });
            const miss = [];
            for (let k = 1; k <= f; k++) if (!cov.has(k)) miss.push(k);
            if (miss.length)
              warns.push({
                line: 0,
                msg: 'sorteio "' + b.title + '": faltou cobrir ' + miss.slice(0, 6).join(', '),
              });
          }
        }
        if (b.type === 'attrs' && !b.attrs.length)
          err(0, 'bloco de atributos "' + b.title + '" sem atributos (use linhas como "FOR Força")');
        if (b.type === 'list') {
          if (!b.columns.length)
            err(0, 'a lista "' + b.title + '" não tem colunas (use "coluna texto Nome")');
          if (b._rows.length) {
            b.rows = b._rows.map(r => {
              const o = {};
              Object.entries(r).forEach(([k, v]) => {
                o[k] = v;
              });
              return o;
            });
            b.rows.forEach(r => {
              b.columns.forEach(c => {
                if (c.kind === 'label') r.label = r.label;
              });
            });
          }
          if (b._soma) b.totals = { [b._soma]: 'sum' };
          delete b._rows;
          delete b._soma;
          delete b._scope;
          if (b.display === 'cards') {
            const tf = b.columns.find(c => c.kind === 'text');
            b.titleField = tf ? tf.id : b.columns[0] && b.columns[0].id;
            b.min = 0;
          }
        }
      })
    );
    // catálogos
    Object.keys(catalogs).forEach(k => {
      if (!catalogs[k].length) warns.push({ line: 0, msg: 'o catálogo "' + k + '" está vazio' });
    });
    tpl.tabs.forEach(tb =>
      tb.blocks.forEach(b => {
        if (b._cat) {
          if (!catalogs[b._cat])
            err(
              0,
              'a lista "' +
                b.title +
                '" usa catalogo=' +
                b._cat +
                ', mas não existe "catalogo: ' +
                b._cat +
                '"'
            );
          else {
            b.catalogRef = b._cat;
            const cols = new Set((b.columns || []).map(c => c.id));
            catalogs[b._cat].forEach(e =>
              Object.keys(e.d).forEach(k => {
                const kk = slug(k);
                if (kk !== k) {
                  e.d[kk] = e.d[k];
                  delete e.d[k];
                }
                if (!cols.has(kk) && !warns.some(w => w.msg.includes('"' + kk + '" no catálogo ' + b._cat)))
                  warns.push({
                    line: 0,
                    msg: 'chave "' + kk + '" no catálogo ' + b._cat + ' não é coluna de "' + b.title + '"',
                  });
              })
            );
          }
          delete b._cat;
        }
        delete b._acts;
      })
    );
    if (Object.keys(catalogs).length) tpl.catalogs = catalogs;
    // HUD
    if (!Object.keys(fieldInfo).includes(tpl.hud.title)) {
      const first = Object.keys(fieldInfo)[0];
      warns.push({
        line: 0,
        msg: 'título: "' + tpl.hud.title + '" não existe; usei "' + (first || '') + '"',
      });
      tpl.hud.title = first || 'nome';
    }
    const resIds = [];
    tpl.tabs.forEach(tb =>
      tb.blocks.forEach(b => {
        if (b.type === 'resource') resIds.push(b.id);
      })
    );
    tpl.hud.resources = hudBars.length
      ? hudBars.filter(id => {
          if (!resIds.includes(id)) {
            warns.push({ line: 0, msg: 'barras: "' + id + '" não é um recurso' });
            return false;
          }
          return true;
        })
      : resIds;
    // atributos entram em fieldInfo? (para destaque de modificadores)
    tpl.hud.stats = hudStats
      .map(id => {
        const fi = fieldInfo[id];
        if (!fi) {
          warns.push({ line: 0, msg: 'destaque: "' + id + '" não existe' });
          return null;
        }
        return { label: fi.label, f: id, fmt: fi.fmt === 'signed' ? 'signed' : undefined };
      })
      .filter(Boolean);
    tpl.rest =
      restore && restore.length
        ? { long: { restore: restore.filter(id => resIds.includes(id)), set: {} } }
        : resIds.length
          ? { long: { restore: resIds, set: {} } }
          : undefined;
    if (!tpl.rest) delete tpl.rest;
    // subtítulo padrão
    if (tpl.hud.sub === '""') {
      /* mantém vazio */
    }
    tpl.src = String(src);
    return { tpl, errors, warns };
  }

  const EXEMPLO = `# FORJA TEXTO — exemplo: Piratas Espaciais
# Tudo depois de # é comentário. Cada linha descreve uma peça da ficha.

sistema: Piratas Espaciais
descrição: Atributos 1d6, perícias e um bônus de Sorte.
ícone: 🚀
tema: oceano
título: nome
subtítulo: "Nv " & nivel & " · " & classe
destaque: defesa, bonus
descanso: restaurar vida, energia

aba: Ficha
campos: Identidade | largura=12
  texto Nome | largura=4 grande
  texto Classe | largura=3
  numero Nível = 1 | largura=2 min=1 max=20
  calculo Bônus = 2 + floor((nivel-1)/4) | largura=3 sinal destaque
atributos: Atributos | modificador=floor((v-10)/2)
  FOR Força
  AGI Agilidade
  VIG Vigor
  MEN Mente
recurso: Vida | sigla=PV max=10 + vig_mod * nivel | temp largura=7
recurso: Energia | sigla=PE max=3 + men_mod + nivel | poder largura=7
campos: Combate | largura=7
  numero Armadura = 10 | largura=4
  calculo Defesa = armadura + agi_mod | largura=4 destaque
  escolha Postura: Ofensiva, Defensiva, Furtiva | largura=4

tabela: Perícias | divisao=2 largura=12
  coluna rotulo Perícia | peso=1.6
  coluna escolha Atr. : @atributos | px=70 compacto
  coluna marcar Treinada | px=60
  coluna calculo Total = modde(atr) + if(treinada, bonus, 0) | px=50 sinal rolar
  linha Atletismo | atr=for
  linha Furtividade | atr=agi
  linha Pilotagem | atr=agi
  linha Engenharia | atr=men
  linha Intimidação | atr=for
  linha Percepção | atr=men

aba: Equipamento
tabela: Armas | largura=12
  coluna texto Nome | peso=2
  coluna numero Bônus | px=70
  coluna texto Dano | px=110
  coluna texto Notas | peso=2
cartoes: Habilidades | colunas=2 botão=Nova habilidade
  coluna texto Nome | largura=8
  coluna numero Custo (PE) | largura=4
  coluna area Efeito | largura=12 linhas=3
tabela: Inventário | largura=6
  coluna texto Item | peso=2
  coluna numero Qtd | px=60
  coluna numero Peso | px=70
  soma: peso
notas: História | largura=12 linhas=8
`;

  const EXEMPLO2 = `# FORJA TEXTO — exemplo 2: RPG do zero, com catálogos e ações
# "Cinzas do Reino": 3 atributos, dados d6, magias que gastam Fé.

sistema: Cinzas do Reino
descrição: Fantasia sombria. 3 atributos, vigor, fé e catálogos próprios.
ícone: 🕯
tema: grimorio
título: nome
subtítulo: "Nv " & nivel & " · " & chamado
destaque: guarda, fe_maxima
descanso: restaurar vigor, fe

aba: Ficha
campos: Quem é você | largura=12
  texto Nome | largura=4 grande
  escolha Chamado: Cavaleiro, Eremita, Feiticeira, Ladino | largura=2
  numero XP = 0 | largura=2 min=0
  calculo Nível = nivelpor(xp, 100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500) | largura=2 inteiro destaque
  calculo Maestria = 1 + floor(nivel/3) | largura=2 sinal destaque
atributos: Atributos | modificador=v padrao=1 sem_gerador
  COR Corpo
  MEN Mente
  ESP Espírito
recurso: Vigor | sigla=VG max=8 + cor * 2 + nivel | temp largura=7
recurso: Fé | id=fe sigla=FÉ max=2 + esp + nivel | poder largura=7
campos: Defesa e sorte | largura=6
  numero Armadura = 0 | largura=4
  calculo Guarda = 6 + cor + armadura | largura=4 destaque
  calculo Fé máxima = 2 + esp + nivel | largura=4 destaque
tabela: Provações | divisao=2 largura=6
  coluna rotulo Provação | peso=1.6
  coluna escolha Atr. : @atributos | px=70 compacto
  coluna marcar Mestre | px=60
  coluna calculo Total = modde(atr) + if(mestre, maestria, 0) | px=50 sinal rolar
  linha Forçar portas | atr=cor
  linha Esgueirar | atr=cor
  linha Rezar | atr=esp
  linha Decifrar | atr=men
  linha Resistir | atr=esp
  linha Lembrar | atr=men

aba: Magias e Armas
catalogo: Rezas
  entrada Chama Sagrada | custo=2 efeito=Fogo branco atinge um inimigo à vista. dado=2d6
  entrada Mão de Cinza | custo=1 efeito=Cura 1d6 de Vigor em quem você tocar. dado=1d6
  entrada Véu da Noite | custo=3 efeito=Você e aliados próximos ficam invisíveis até o fim da cena. dado=
cartoes: Rezas conhecidas | colunas=2 catalogo=Rezas botão=Nova reza
  coluna texto Nome | largura=8
  coluna numero Custo | largura=4
  coluna texto Dado | largura=6
  coluna area Efeito | largura=12 linhas=3
  acao: Rezar | gasta=fe:custo rola=1d20+{maestria + esp} titulo=nome
  acao: Efeito | rola={dado} titulo=nome

catalogo: Armas
  entrada Espada Longa | dano=1d8 bonus=0 peso=3
  entrada Machado de Guerra | dano=1d10 bonus=0 peso=5
  entrada Adaga | dano=1d4 bonus=1 peso=1
  entrada Arco Curto | dano=1d6 bonus=0 peso=2
tabela: Armas | catalogo=Armas largura=12 botão=Nova arma
  coluna texto Nome | peso=2
  coluna numero Bônus | px=70
  coluna texto Dano | px=100
  coluna numero Peso | px=70
  coluna rolar Ataque | rola=1d20+{cor + bonus} icone=⚔
  coluna rolar Dano | rola={dano} icone=🎲
  soma: peso
sorteio: Encontros na estrada | dado=d6 largura=6 botão=Viajar
  1-2: Estrada vazia. Só o vento e as cinzas.
  3: Peregrinos feridos pedem ajuda.
  4: Salteadores armados bloqueiam a passagem.
  5: Uma capela abandonada com uma reza esquecida.
  6: Um cavaleiro de armadura enegrecida segue seus passos.
sorteio: Nome de taverna | largura=6
  O Corvo Cego
  A Última Vela
  O Cálice Rachado
  A Mão de Cinza
notas: Diário da jornada | largura=12 linhas=8
`;

  const AJUDA = [
    [
      'Como funciona',
      'Você escreve uma linha por peça. Linhas que começam com <b>aba:</b> criam abas; depois vêm <b>blocos</b> (campos, atributos, recurso, tabela, cartoes, notas, aviso) e, abaixo de cada bloco, os itens dele. Tudo depois de <code>#</code> é comentário.',
    ],
    [
      'Cabeçalho do sistema',
      '<code>sistema: Nome</code> · <code>descrição: texto</code> · <code>ícone: 🚀</code> · <code>tema: carta | oceano | grimorio | …</code><br><code>título: nome</code> (campo que aparece como nome no topo) · <code>subtítulo: "Nv " &amp; nivel</code><br><code>destaque: defesa, bonus</code> (números grandes no topo) · <code>barras: vida, energia</code> · <code>descanso: restaurar vida, energia</code>',
    ],
    [
      'campos: Título | largura=12',
      'Itens: <code>texto Nome</code>, <code>numero Nível = 1 | min=1 max=20</code>, <code>calculo Defesa = 10 + agi_mod | sinal destaque</code>, <code>marcar Inspiração</code>, <code>area Anotações | linhas=5</code>, <code>escolha Postura: Ofensiva, Defensiva</code>.<br>Opções depois de <code>|</code>: <code>largura=1…12</code> · <code>grande</code> · <code>sinal</code> (+3) · <code>inteiro</code> · <code>destaque</code> (cartão grande) · <code>rolar</code> (clique rola d20) · <code>manual</code> (permite digitar por cima) · <code>dica=texto</code> · <code>id=nome_interno</code>',
    ],
    [
      'atributos: Título | modificador=…',
      'Cada linha: <code>SIGLA Nome</code> (ex.: <code>FOR Força</code>). O app cria <code>for</code> (valor) e <code>for_mod</code> (modificador). Regra do modificador padrão: <code>floor((v-10)/2)</code>; use <code>modificador=v</code> se o próprio valor já é o bônus. <code>sem_gerador</code> remove o botão de sortear atributos. <code>padrao=1</code> define o valor inicial de cada atributo.',
    ],
    [
      'recurso: Título | …',
      'Barra com botões de dano/cura/gastar. Ex.: <code>recurso: Vida | sigla=PV max=10 + vig_mod | temp</code>. <code>poder</code> deixa a barra azul (mana, energia). <code>temp</code> habilita pontos temporários.',
    ],
    [
      'tabela: / cartoes:',
      '<code>coluna tipo Rótulo | px=60</code> (largura fixa) ou <code>peso=2</code> (proporcional). Tipos: texto, numero, calculo, marcar, area, escolha, rotulo.<br><code>linha Nome | atr=for</code> cria linhas fixas (ex.: lista de perícias); sem <code>linha</code>, o jogador adiciona as suas. <code>divisao=2</code> divide em 2 colunas. <code>soma: coluna</code> mostra o total. Em <code>cartoes</code>, cada item vira um cartão (use <code>largura=1…12</code> nas colunas).',
    ],
    [
      'Fórmulas',
      'Use o nome (em minúsculas, sem acento, com _) de qualquer campo: <code>vig_mod</code>, <code>nivel</code>, <code>armadura</code>. Em tabelas, as colunas da linha também valem. <code>modde(atr)</code> = modificador do atributo escolhido na coluna. Funções: <code>floor</code>, <code>max</code>, <code>min</code>, <code>if(teste, então, senão)</code>, <code>round</code>, <code>sum(tabela.coluna)</code>…',
    ],
    [
      'catalogo: (listas suas)',
      'Cadastre entradas prontas e deixe o jogador adicionar com um clique. Fora de qualquer aba, escreva:<br><code>catalogo: Magias</code><br><code>&nbsp;&nbsp;entrada Bola de Fogo | custo=3 dano=6d6 efeito=Explode na área.</code><br>As chaves (<code>custo</code>, <code>dano</code>…) precisam ser o nome das colunas da lista (minúsculas, sem acento). Para ligar: <code>tabela: Magias | catalogo=Magias</code> (ou <code>cartoes:</code>) e aparece o botão 📖.',
    ],
    [
      'Ações: gastar e rolar',
      'Em <b>cartoes</b>: <code>acao: Usar | gasta=energia:custo rola=1d20+{bonus} titulo=nome</code> — gasta o recurso (id do recurso : coluna do custo) e rola. Dentro de <code>{ }</code> vai uma fórmula (campos do sistema ou colunas do cartão). Sem <code>gasta=</code>, só rola; sem <code>rola=</code>, só gasta. Opcional: <code>sobrecarga=exaustao:1:5</code> permite usar sem recurso, somando ao campo.<br>Em <b>tabelas</b>: <code>coluna rolar Ataque | rola=1d20+{bonus} icone=⚔</code> cria um botão de rolagem em cada linha.',
    ],
    [
      'nivelpor(...) e sorteio:',
      '<b>Nível por XP:</b> <code>calculo Nível = nivelpor(xp, 100, 300, 600) | inteiro</code> — começa no 1 e sobe 1 nível a cada marco de XP atingido (aqui: 2 em 100, 3 em 300, 4 em 600).<br><b>Tabela de sorteio:</b> <code>sorteio: Encontros | dado=d6</code> e linhas <code>1-2: Nada acontece</code>, <code>3: Bandidos</code>… Sem <code>dado=</code>, cada linha é uma opção sorteada com chance igual. O app guarda os últimos resultados na ficha.',
    ],
    [
      'notas: / aviso:',
      '<code>notas: História | linhas=8</code> cria uma caixa de texto grande. <code>aviso: Regras da casa</code> e as linhas seguintes viram um texto fixo na ficha.',
    ],
  ];

  return { compile, EXEMPLO, EXEMPLO2, AJUDA };
})();

/* ---------- janela: criar / editar sistema em texto ---------- */
function textoDialog(existing) {
  const ta = h('textarea.code', {
    spellcheck: 'false',
    style: {
      width: '100%',
      minHeight: '62vh',
      fontFamily: 'var(--font-mono, monospace)',
      fontSize: '13px',
      lineHeight: '1.5',
      whiteSpace: 'pre',
      tabSize: 2,
    },
  });
  ta.value = existing ? existing.src : FT.EXEMPLO2;
  const exSel = existing
    ? null
    : h(
        'select',
        {
          style: { marginBottom: '8px' },
          onchange: e => {
            ta.value =
              e.target.value === '1'
                ? FT.EXEMPLO
                : e.target.value === '2'
                  ? FT.EXEMPLO2
                  : '# Seu sistema\nsistema: Meu RPG\n\naba: Ficha\ncampos: Identidade\n  texto Nome | largura=6 grande\n  numero Nível = 1\n';
            run();
            sendSoon();
          },
        },
        h('option', { value: '2' }, 'Exemplo: Cinzas do Reino (catálogos e ações)'),
        h('option', { value: '1' }, 'Exemplo: Piratas Espaciais'),
        h('option', { value: '0' }, 'Começar do zero')
      );
  const status = h('div', { style: { fontSize: '.88em', marginTop: '8px', minHeight: '3.2em' } });
  const help = h('div', {
    style: { fontSize: '.86em', lineHeight: 1.5, maxHeight: '64vh', overflow: 'auto', paddingRight: '6px' },
  });
  FT.AJUDA.forEach(([t1, d]) => {
    const dv = h(
      'details',
      { style: { marginBottom: '8px' } },
      h('summary', { style: { cursor: 'pointer', fontWeight: 600 } }, t1)
    );
    const p = h('div', { style: { marginTop: '4px' } });
    p.innerHTML = d;
    dv.append(p);
    help.append(dv);
  });
  help.querySelector('details').open = true;
  let last;
  const run = () => {
    const r = (last = FT.compile(ta.value));
    status.replaceChildren();
    if (r.errors.length)
      status.append(
        ...r.errors
          .slice(0, 6)
          .map(e =>
            h(
              'div',
              { style: { color: 'var(--bad, #c0392b)' } },
              '✕ ' + (e.line ? 'linha ' + e.line + ': ' : '') + e.msg
            )
          )
      );
    else {
      const blocks = r.tpl.tabs.reduce((a, t2) => a + t2.blocks.length, 0);
      status.append(
        h(
          'div',
          { style: { color: 'var(--good, #2e7d32)' } },
          '✓ ' + r.tpl.tabs.length + ' aba(s), ' + blocks + ' bloco(s). Pronto para criar.'
        )
      );
    }
    r.warns
      .slice(0, 4)
      .forEach(w =>
        status.append(
          h('div', { style: { opacity: 0.75 } }, '⚠ ' + (w.line ? 'linha ' + w.line + ': ' : '') + w.msg)
        )
      );
  };
  ta.addEventListener('input', debounce(run, 250));
  ta.addEventListener('keydown', e => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const s = ta.selectionStart;
      ta.setRangeText('  ', s, ta.selectionEnd, 'end');
    }
  });
  run();
  // prévia ao vivo: o próprio app dentro de um iframe, só em memória
  let ready = false,
    pend = null;
  const frame = h('iframe', {
    style: {
      width: '100%',
      height: '66vh',
      border: '1px solid var(--line, #8884)',
      borderRadius: '8px',
      background: '#fff',
    },
  });
  // a prévia carrega os mesmos arquivos .css/.js desta página (os marcados com data-app no HTML)
  const cssTags = [...document.querySelectorAll('link[data-app]')]
      .map(l => '<link rel="stylesheet" href="' + l.href + '">')
      .join(''),
    jsTags = [...document.querySelectorAll('script[data-app]')]
      .map(s => '<script src="' + s.src + '"><\/script>')
      .join('');
  frame.srcdoc =
    '<!doctype html><html lang="pt-BR" data-theme="carta"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    cssTags +
    '</head><body><script>window.__PREVIEW=1<\/script>' +
    jsTags +
    '</body></html>';
  const onMsg = ev => {
    if (ev.source === frame.contentWindow && ev.data && ev.data.forjaPreviewReady) {
      ready = true;
      if (pend) send(pend);
    }
  };
  window.addEventListener('message', onMsg);
  const send = tp => {
    pend = tp;
    if (ready)
      try {
        frame.contentWindow.postMessage({ forjaPreview: JSON.parse(JSON.stringify(tp)) }, '*');
      } catch (e) {}
  };
  const sendSoon = debounce(() => {
    if (last && !last.errors.length) send(last.tpl);
  }, 500);
  ta.addEventListener('input', sendSoon);
  const pane = h('div', frame),
    helpPane = h('div', { style: { display: 'none' } }, help);
  const tabBtn = (lbl, on) =>
    h(
      'button.btn.sm',
      {
        type: 'button',
        onclick: () => {
          pane.style.display = on === 'p' ? '' : 'none';
          helpPane.style.display = on === 'p' ? 'none' : '';
        },
      },
      lbl
    );
  const body = h(
    'div',
    { style: { display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: '16px' } },
    h('div', exSel, ta, status),
    h(
      'div',
      h(
        'div',
        { style: { display: 'flex', gap: '6px', marginBottom: '8px' } },
        tabBtn('👁 Prévia', 'p'),
        tabBtn('📘 Guia', 'g')
      ),
      pane,
      helpPane
    )
  );
  setTimeout(() => {
    if (last && !last.errors.length) send(last.tpl);
  }, 0);
  modal({
    title: existing ? 'Editar sistema em texto' : 'Criar com texto (Forja Texto)',
    xl: true,
    body,
    onClose: () => window.removeEventListener('message', onMsg),
    actions: [
      { label: t('cancel') },
      {
        label: existing ? 'Aplicar mudanças' : 'Criar sistema',
        primary: true,
        onClick: () => {
          run();
          if (last.errors.length) {
            toast('Corrija os erros antes de continuar.');
            return false;
          }
          const tp = last.tpl;
          if (existing) {
            tp.id = existing.id;
            tp.rev = (existing.rev || 1) + 1;
            App.tpl = tp;
            Store.data.systems[tp.id] = tp;
            commitTpl();
            toast('Sistema atualizado.');
          } else {
            Store.data.systems[tp.id] = tp;
            Store.save();
            newChar(tp.id);
          }
        },
      },
    ],
  });
}
