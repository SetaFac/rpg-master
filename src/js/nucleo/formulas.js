/* ===== Motor de fórmulas (nativo e Excel) — sem eval ===== */
const Formula = (() => {
  class FErr extends Error {
    constructor(code, msg) {
      super(msg || code);
      this.code = code;
    }
  }
  const cache = new Map();
  const REFRE = /^\$?[A-Za-z]{1,3}\$?\d+$/;

  function tokenize(s, xl) {
    const t = [];
    let i = 0;
    const isIdStart = c => /[A-Za-z_À-ɏ$]/.test(c);
    const isId = c => /[\wÀ-ɏ.$]/.test(c);
    while (i < s.length) {
      const c = s[i];
      if (/\s/.test(c)) {
        i++;
        continue;
      }
      if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(s[i + 1] || ''))) {
        let j = i;
        while (j < s.length && /[0-9.]/.test(s[j])) j++;
        if (/[eE]/.test(s[j] || '') && /[0-9+-]/.test(s[j + 1] || '')) {
          j += 2;
          while (/[0-9]/.test(s[j] || '')) j++;
        }
        t.push({ t: 'num', v: parseFloat(s.slice(i, j)) });
        i = j;
        continue;
      }
      if (c === '"' || (!xl && c === "'")) {
        let j = i + 1,
          out = '';
        while (j < s.length) {
          if (s[j] === c) {
            if (s[j + 1] === c) {
              out += c;
              j += 2;
              continue;
            }
            break;
          }
          out += s[j++];
        }
        if (xl && s[j + 1] === '!') {
          /* nome de planilha entre aspas simples tratado abaixo */
        }
        t.push({ t: 'str', v: out });
        i = j + 1;
        continue;
      }
      if (xl && c === "'") {
        // 'Nome da planilha'!A1
        let j = i + 1,
          out = '';
        while (j < s.length && !(s[j] === "'" && s[j + 1] !== "'")) {
          if (s[j] === "'") j++;
          out += s[j++];
        }
        j++;
        if (s[j] === '!') {
          t.push({ t: 'sheet', v: out });
          i = j + 1;
          continue;
        }
        throw new FErr('#NAME?');
      }
      if (isIdStart(c)) {
        let j = i;
        while (j < s.length && isId(s[j])) j++;
        let w = s.slice(i, j);
        if (xl && s[j] === '!') {
          t.push({ t: 'sheet', v: w });
          i = j + 1;
          continue;
        }
        t.push({ t: 'id', v: w });
        i = j;
        continue;
      }
      const two = s.substr(i, 2);
      if (['<=', '>=', '<>', '!=', '==', '&&', '||'].includes(two)) {
        t.push({ t: 'op', v: two });
        i += 2;
        continue;
      }
      if ('+-*/^&=<>(),:%!'.includes(c)) {
        t.push({ t: 'op', v: c });
        i++;
        continue;
      }
      if (c === ';') {
        t.push({ t: 'op', v: ',' });
        i++;
        continue;
      }
      throw new FErr('#NAME?', 'Caractere inesperado: ' + c);
    }
    return t;
  }

  const PREC = {
    '||': 1,
    '&&': 2,
    '=': 3,
    '==': 3,
    '<>': 3,
    '!=': 3,
    '<': 3,
    '>': 3,
    '<=': 3,
    '>=': 3,
    '&': 4,
    '+': 5,
    '-': 5,
    '*': 6,
    '/': 6,
    '^': 7,
  };

  function parse(src, xl) {
    const key = (xl ? 'x:' : 'n:') + src;
    if (cache.has(key)) return cache.get(key);
    const tk = tokenize(src, xl);
    let p = 0;
    const peek = () => tk[p],
      next = () => tk[p++];
    const isOp = v => peek() && peek().t === 'op' && peek().v === v;
    function primary() {
      const k = next();
      if (!k) throw new FErr('#ERR', 'Fórmula incompleta');
      if (k.t === 'num') return { n: 'num', v: k.v };
      if (k.t === 'str') return { n: 'str', v: k.v };
      if (k.t === 'op') {
        if (k.v === '(') {
          const e = expr(0);
          if (!isOp(')')) throw new FErr('#ERR', 'Falta )');
          next();
          return e;
        }
        if (k.v === '-' || k.v === '+' || k.v === '!') return { n: 'un', op: k.v, x: expr(7.5) };
        throw new FErr('#ERR', 'Símbolo inesperado ' + k.v);
      }
      let sheet = null,
        id;
      if (k.t === 'sheet') {
        sheet = k.v;
        id = next();
        if (!id || id.t !== 'id') throw new FErr('#REF!');
      } else id = k;
      if (id.t !== 'id') throw new FErr('#ERR');
      const name = id.v;
      if (isOp('(') && !sheet) {
        next();
        const args = [];
        if (!isOp(')')) {
          for (;;) {
            args.push(isOp(',') ? { n: 'blank' } : expr(0));
            if (isOp(',')) {
              next();
              continue;
            }
            break;
          }
        }
        if (!isOp(')')) throw new FErr('#ERR', 'Falta )');
        next();
        return { n: 'call', name: name.toLowerCase(), args };
      }
      if (xl && REFRE.test(name)) {
        const a = name.replace(/\$/g, '').toUpperCase();
        if (isOp(':')) {
          next();
          let k2 = next();
          let sh2 = sheet;
          if (k2 && k2.t === 'sheet') {
            sh2 = k2.v;
            k2 = next();
          }
          if (!k2 || k2.t !== 'id' || !REFRE.test(k2.v)) throw new FErr('#REF!');
          return { n: 'range', sheet, a, b: k2.v.replace(/\$/g, '').toUpperCase() };
        }
        return { n: 'ref', sheet, a };
      }
      return { n: 'id', name };
    }
    function expr(minp) {
      let l = primary();
      for (;;) {
        const k = peek();
        if (xl && k && k.t === 'op' && k.v === '%') {
          next();
          l = { n: 'bin', op: '/', l, r: { n: 'num', v: 100 } };
          continue;
        }
        if (!k || k.t !== 'op' || !(k.v in PREC)) break;
        const pr = PREC[k.v];
        if (pr < minp) break;
        next();
        const r = expr(k.v === '^' ? pr : pr + 0.01);
        l = { n: 'bin', op: k.v, l, r };
      }
      return l;
    }
    const ast = expr(0);
    if (p < tk.length) throw new FErr('#ERR', 'Sobrou: ' + tk[p].v);
    cache.set(key, ast);
    return ast;
  }

  // ---- conversões
  const isArr = Array.isArray;
  function num(v, lenient) {
    if (isArr(v)) v = v[0];
    if (v === null || v === undefined || v === '') return 0;
    if (typeof v === 'boolean') return v ? 1 : 0;
    if (typeof v === 'number') return v;
    const n = parseFloat(String(v).replace(',', '.'));
    if (isNaN(n)) {
      if (lenient) return 0;
      throw new FErr('#VALUE!');
    }
    return n;
  }
  const str = v => {
    if (isArr(v)) v = v[0];
    return v === null || v === undefined ? '' : typeof v === 'boolean' ? (v ? 'TRUE' : 'FALSE') : String(v);
  };
  const bool = v => {
    if (isArr(v)) v = v[0];
    if (typeof v === 'string') return v !== '' && v.toLowerCase() !== 'false';
    return !!v;
  };
  const flat = args => {
    const o = [];
    for (const a of args) {
      if (isArr(a)) for (const x of a) o.push(x);
      else o.push(a);
    }
    return o;
  };
  const nums = args =>
    flat(args)
      .filter(
        x =>
          typeof x === 'number' ||
          typeof x === 'boolean' ||
          (typeof x === 'string' && x !== '' && !isNaN(parseFloat(x)))
      )
      .map(x => num(x));
  const roundTo = (x, d, mode) => {
    const f = Math.pow(10, d);
    const y = x * f;
    const r =
      mode === 'down'
        ? y < 0
          ? Math.ceil(y)
          : Math.floor(y)
        : mode === 'up'
          ? y < 0
            ? Math.floor(y)
            : Math.ceil(y)
          : y < 0
            ? -Math.round(-y)
            : Math.round(y);
    return r / f;
  };
  const cmp = (a, b) => {
    if (isArr(a)) a = a[0];
    if (isArr(b)) b = b[0];
    const na = a === null || a === undefined || a === '',
      nb = b === null || b === undefined || b === '';
    if (typeof a === 'string' && typeof b === 'string') {
      a = a.toLowerCase();
      b = b.toLowerCase();
      return a < b ? -1 : a > b ? 1 : 0;
    }
    if (typeof a === 'string' && !na && typeof b !== 'string') return 1;
    if (typeof b === 'string' && !nb && typeof a !== 'string') return -1;
    const x = num(a, true),
      y = num(b, true);
    return x < y ? -1 : x > y ? 1 : 0;
  };
  const crit = c => {
    // critério de COUNTIF/SUMIF
    if (typeof c === 'string') {
      const m = c.match(/^(<=|>=|<>|<|>|=)?(.*)$/);
      const op = m[1] || '=';
      const val = m[2];
      const n = parseFloat(val);
      return x => {
        const r = isNaN(n) || val === '' ? cmp(x, val) : cmp(x, n);
        return op === '='
          ? r === 0
          : op === '<>'
            ? r !== 0
            : op === '<'
              ? r < 0
              : op === '>'
                ? r > 0
                : op === '<='
                  ? r <= 0
                  : r >= 0;
      };
    }
    return x => cmp(x, c) === 0;
  };

  const FN = {
    sum: a => nums(a).reduce((x, y) => x + y, 0),
    count: a => nums(a).length,
    counta: a => flat(a).filter(x => x !== null && x !== '' && x !== undefined).length,
    average: a => {
      const n = nums(a);
      return n.length ? n.reduce((x, y) => x + y, 0) / n.length : 0;
    },
    max: a => {
      const n = nums(a);
      return n.length ? Math.max(...n) : 0;
    },
    min: a => {
      const n = nums(a);
      return n.length ? Math.min(...n) : 0;
    },
    abs: a => Math.abs(num(a[0])),
    int: a => Math.floor(num(a[0])),
    trunc: a => Math.trunc(num(a[0])),
    sign: a => Math.sign(num(a[0])),
    sqrt: a => Math.sqrt(num(a[0])),
    floor: a =>
      a[1] === undefined
        ? Math.floor(num(a[0]))
        : num(a[1])
          ? Math.floor(num(a[0]) / num(a[1])) * num(a[1])
          : 0,
    ceil: a =>
      a[1] === undefined
        ? Math.ceil(num(a[0]))
        : num(a[1])
          ? Math.ceil(num(a[0]) / num(a[1])) * num(a[1])
          : 0,
    round: a => roundTo(num(a[0]), num(a[1] || 0), 'n'),
    rounddown: a => roundTo(num(a[0]), num(a[1] || 0), 'down'),
    roundup: a => roundTo(num(a[0]), num(a[1] || 0), 'up'),
    mod: a => {
      const d = num(a[1]);
      if (!d) throw new FErr('#DIV/0!');
      const n = num(a[0]);
      return n - d * Math.floor(n / d);
    },
    power: a => Math.pow(num(a[0]), num(a[1])),
    pow: a => Math.pow(num(a[0]), num(a[1])),
    not: a => !bool(a[0]),
    len: a => str(a[0]).length,
    upper: a => str(a[0]).toUpperCase(),
    lower: a => str(a[0]).toLowerCase(),
    left: a => str(a[0]).slice(0, a[1] === undefined ? 1 : num(a[1])),
    right: a => {
      const s = str(a[0]),
        n = a[1] === undefined ? 1 : num(a[1]);
      return n ? s.slice(-n) : '';
    },
    mid: a => str(a[0]).substr(num(a[1]) - 1, num(a[2])),
    concat: a => flat(a).map(str).join(''),
    concatenate: a => flat(a).map(str).join(''),
    isblank: a => {
      const v = isArr(a[0]) ? a[0][0] : a[0];
      return v === null || v === undefined || v === '';
    },
    isnumber: a => typeof (isArr(a[0]) ? a[0][0] : a[0]) === 'number',
    num: a => num(a[0], true),
    text: a => str(a[0]),
    signed: a => {
      const n = num(a[0], true);
      return (n >= 0 ? '+' : '') + n;
    },
    pick: a => {
      const i = num(a[0]);
      return a[i] === undefined ? 0 : a[i];
    },
    countif: a => {
      const f = crit(a[1]);
      return flat([a[0]]).filter(f).length;
    },
    sumif: a => {
      const f = crit(a[1]);
      const r = flat([a[0]]);
      const s = a[2] !== undefined ? flat([a[2]]) : r;
      let t = 0;
      r.forEach((x, i) => {
        if (f(x)) t += num(s[i], true);
      });
      return t;
    },
    xor: a => flat(a).filter(bool).length % 2 === 1,
    exact: a => str(a[0]) === str(a[1]),
    rand: () => Math.random(),
    randbetween: a => Math.floor(num(a[0]) + Math.random() * (num(a[1]) - num(a[0]) + 1)),
    vlookup: a => {
      const key = a[0],
        tbl = a[1],
        idx = num(a[2]);
      /* intervalo achatado sem dimensões: não suportado */ throw new FErr('#N/A', 'PROCV não suportado');
    },
  };
  const LAZY = new Set(['if', 'iferror', 'ifs', 'and', 'or', 'switch']);

  function evaluate(n, ctx) {
    switch (n.n) {
      case 'num':
      case 'str':
        return n.v;
      case 'blank':
        return null;
      case 'id': {
        const l = n.name.toLowerCase();
        if (l === 'true') return true;
        if (l === 'false') return false;
        return ctx.ident(n.name);
      }
      case 'ref':
        return ctx.ref(n.sheet, n.a);
      case 'range':
        return ctx.range(n.sheet, n.a, n.b);
      case 'un': {
        const x = evaluate(n.x, ctx);
        if (n.op === '!') return !bool(x);
        return n.op === '-' ? -num(x, ctx.lenient) : num(x, ctx.lenient);
      }
      case 'bin': {
        const op = n.op;
        if (op === '&&') return bool(evaluate(n.l, ctx)) && bool(evaluate(n.r, ctx));
        if (op === '||') return bool(evaluate(n.l, ctx)) || bool(evaluate(n.r, ctx));
        const a = evaluate(n.l, ctx),
          b = evaluate(n.r, ctx);
        switch (op) {
          case '+':
            return num(a, ctx.lenient) + num(b, ctx.lenient);
          case '-':
            return num(a, ctx.lenient) - num(b, ctx.lenient);
          case '*':
            return num(a, ctx.lenient) * num(b, ctx.lenient);
          case '/': {
            const d = num(b, ctx.lenient);
            if (!d) {
              if (ctx.lenient) return 0;
              throw new FErr('#DIV/0!');
            }
            return num(a, ctx.lenient) / d;
          }
          case '^':
            return Math.pow(num(a, ctx.lenient), num(b, ctx.lenient));
          case '&':
            return str(a) + str(b);
          case '=':
          case '==':
            return cmp(a, b) === 0;
          case '<>':
          case '!=':
            return cmp(a, b) !== 0;
          case '<':
            return cmp(a, b) < 0;
          case '>':
            return cmp(a, b) > 0;
          case '<=':
            return cmp(a, b) <= 0;
          case '>=':
            return cmp(a, b) >= 0;
        }
        throw new FErr('#ERR');
      }
      case 'call': {
        const nm = n.name;
        if (LAZY.has(nm)) {
          const A = n.args;
          if (nm === 'if')
            return bool(evaluate(A[0], ctx))
              ? A[1]
                ? evaluate(A[1], ctx)
                : true
              : A[2]
                ? evaluate(A[2], ctx)
                : false;
          if (nm === 'iferror') {
            try {
              const r = evaluate(A[0], ctx);
              return r;
            } catch (e) {
              return A[1] ? evaluate(A[1], ctx) : '';
            }
          }
          if (nm === 'ifs') {
            for (let i = 0; i + 1 < A.length; i += 2)
              if (bool(evaluate(A[i], ctx))) return evaluate(A[i + 1], ctx);
            throw new FErr('#N/A');
          }
          if (nm === 'and') return A.every(x => flat([evaluate(x, ctx)]).every(bool));
          if (nm === 'or') return A.some(x => flat([evaluate(x, ctx)]).some(bool));
          if (nm === 'switch') {
            const v = evaluate(A[0], ctx);
            for (let i = 1; i + 1 < A.length; i += 2)
              if (cmp(v, evaluate(A[i], ctx)) === 0) return evaluate(A[i + 1], ctx);
            return A.length % 2 === 0 ? evaluate(A[A.length - 1], ctx) : null;
          }
        }
        let nm2 = nm === 'ceiling' ? 'ceil' : nm === 'avg' ? 'average' : nm;
        if (nm2 === 'val') {
          const r = ctx.ident(str(evaluate(n.args[0], ctx)));
          return r;
        }
        const f = FN[nm2];
        if (!f) throw new FErr('#NAME?', 'Função desconhecida: ' + nm);
        return f(n.args.map(x => evaluate(x, ctx)));
      }
    }
    throw new FErr('#ERR');
  }

  function idents(ast, out = new Set()) {
    if (!ast || typeof ast !== 'object') return out;
    if (ast.n === 'id') out.add(ast.name);
    if (ast.n === 'call') {
      if (ast.name === 'val') {
        /* dinâmico */
      }
      ast.args.forEach(a => idents(a, out));
    }
    if (ast.n === 'bin') {
      idents(ast.l, out);
      idents(ast.r, out);
    }
    if (ast.n === 'un') idents(ast.x, out);
    return out;
  }
  const unsupportedFns = (ast, out = new Set()) => {
    if (!ast || typeof ast !== 'object') return out;
    if (ast.n === 'call') {
      const nm = ast.name === 'ceiling' ? 'ceil' : ast.name === 'avg' ? 'average' : ast.name;
      if (!FN[nm] && !LAZY.has(nm) && nm !== 'val') out.add(ast.name.toUpperCase());
      ast.args.forEach(a => unsupportedFns(a, out));
    }
    if (ast.n === 'bin') {
      unsupportedFns(ast.l, out);
      unsupportedFns(ast.r, out);
    }
    if (ast.n === 'un') unsupportedFns(ast.x, out);
    return out;
  };

  // ---- utilidades de endereços A1
  const colToNum = s => {
    let n = 0;
    for (const c of s) n = n * 26 + (c.charCodeAt(0) - 64);
    return n;
  };
  const numToCol = n => {
    let s = '';
    while (n > 0) {
      const m = (n - 1) % 26;
      s = String.fromCharCode(65 + m) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  };
  const splitA1 = a => {
    const m = /^([A-Z]+)(\d+)$/.exec(a);
    return m ? { c: colToNum(m[1]), r: parseInt(m[2]) } : null;
  };
  const shiftFormula = (f, dr, dc) =>
    f.replace(/(\$?)([A-Z]{1,3})(\$?)(\d+)(?![\w(])/g, (m, d1, c, d2, r, off, whole) => {
      // não mexe dentro de strings (aproximação: conta aspas antes)
      const before = whole.slice(0, off);
      if ((before.match(/"/g) || []).length % 2) return m;
      const nc = d1 ? colToNum(c) : colToNum(c) + dc,
        nr = d2 ? +r : +r + dr;
      if (nc < 1 || nr < 1) return '#REF!';
      return d1 + numToCol(nc) + d2 + nr;
    });

  return {
    parse,
    evaluate,
    FErr,
    num,
    str,
    bool,
    idents,
    unsupportedFns,
    colToNum,
    numToCol,
    splitA1,
    shiftFormula,
    FN,
  };
})();
