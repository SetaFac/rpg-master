#!/usr/bin/env node
/* RPG Master — servidor da mesa online (sem dependências; precisa só do Node.js 16+)
   Uso:  node servidor.js [--porta 3000] [--chave ABC123] [--senha segredo] [--arquivo caminho/RPG-Master.html]            */
const http = require('http'),
  fs = require('fs'),
  path = require('path'),
  os = require('os'),
  crypto = require('crypto');
const args = process.argv.slice(2),
  arg = (n, d) => {
    const i = args.indexOf('--' + n);
    return i >= 0 && args[i + 1] ? args[i + 1] : d;
  };
const PORT = +arg('porta', process.env.PORT || 3000),
  KEY = arg('chave', crypto.randomBytes(3).toString('hex')),
  PASS = arg('senha', '');
/* Onde está o app? Ordem de prioridade:
   1) --arquivo caminho/RPG-Master.html
   2) variável de ambiente RPG_MASTER_HTML
   3) busca automática: a partir da pasta deste script e da pasta onde o comando foi executado, olha em "PASTA_APP/"
      e na própria pasta, subindo até NIVEIS_ACIMA pastas. A pasta mais próxima vence. */
const NOME_HTML = 'RPG-Master.html';
const PASTA_APP = 'src'; // nome da pasta onde fica o app (RPG-Master.html, css/, js/). Mudou o nome? Altere só aqui.
const NIVEIS_ACIMA = 4;
const ARQUIVO_INFORMADO = arg('arquivo', process.env.RPG_MASTER_HTML);
function acharHtml() {
  if (ARQUIVO_INFORMADO) return path.resolve(ARQUIVO_INFORMADO);
  for (const inicio of [__dirname, process.cwd()]) {
    let dir = path.resolve(inicio);
    for (let nivel = 0; nivel <= NIVEIS_ACIMA; nivel++) {
      for (const candidato of [path.join(dir, PASTA_APP, NOME_HTML), path.join(dir, NOME_HTML)]) {
        if (fs.existsSync(candidato)) return candidato;
      }
      const pai = path.dirname(dir);
      if (pai === dir) break;
      dir = pai;
    }
  }
  return null;
}
const HTML = acharHtml() || path.join(__dirname, '..', PASTA_APP, NOME_HTML); // sem achar nada, o aviso sai ao iniciar
const HTML_OK = fs.existsSync(HTML);
const PUBLIC_DIR = path.dirname(path.resolve(HTML)); // css/ e js/ são servidos a partir da pasta do HTML
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};
let snap = null;
const bgs = {},
  players = new Map(),
  gms = new Set();
const send = (res, o) => {
  try {
    res.write('data: ' + JSON.stringify(o) + '\n\n');
  } catch (e) {}
};
const names = () => [...players.values()].filter(p => p.res).map(p => p.name);
const toPlayers = o => players.forEach(p => p.res && send(p.res, o)),
  toGM = o => gms.forEach(r => send(r, o)),
  toAll = o => {
    toPlayers(o);
    toGM(o);
  };
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, x-key',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
const json = (res, code, o) => {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...CORS });
  res.end(JSON.stringify(o));
};
const body = req =>
  new Promise((ok, no) => {
    let n = 0;
    const ch = [];
    req.on('data', c => {
      n += c.length;
      if (n > 60e6) {
        no(new Error('grande'));
        req.destroy();
      } else ch.push(c);
    });
    req.on('end', () => {
      try {
        ok(JSON.parse(Buffer.concat(ch).toString() || '{}'));
      } catch (e) {
        ok({});
      }
    });
    req.on('error', no);
  });
const ips = () => {
  const o = [];
  Object.entries(os.networkInterfaces()).forEach(([n, l]) =>
    (l || []).forEach(a => {
      if (a.family === 'IPv4' && !a.internal) o.push({ nome: n, ip: a.address });
    })
  );
  return o;
};

http
  .createServer(async (req, res) => {
    const u = new URL(req.url, 'http://x'),
      p = u.pathname;
    if (req.method === 'OPTIONS') {
      res.writeHead(204, CORS);
      return res.end();
    }
    try {
      if (p === '/ping')
        return json(res, 200, {
          ok: true,
          app: 'rpg-master',
          needPass: !!PASS,
          players: names(),
          gm: gms.size > 0,
          addresses: ips().map(x => 'http://' + x.ip + ':' + PORT),
        });
      if (p === '/' || p === '/index.html') {
        if (!fs.existsSync(HTML)) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          return res.end(
            'Não achei o RPG-Master.html. Veja o aviso na janela do servidor ou inicie com --arquivo caminho/RPG-Master.html'
          );
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        return fs.createReadStream(HTML).pipe(res);
      }
      if (p.startsWith('/bg/')) {
        const b = bgs[p.slice(4)];
        if (!b) {
          res.writeHead(404, CORS);
          return res.end();
        }
        res.writeHead(200, { 'Content-Type': b.mime, 'Cache-Control': 'max-age=3600', ...CORS });
        return res.end(b.buf);
      }
      if (p === '/join' && req.method === 'POST') {
        const b = await body(req);
        if (PASS && b.pass !== PASS) return json(res, 403, { ok: false, erro: 'Senha incorreta.' });
        let name =
          String(b.name || 'Jogador')
            .trim()
            .slice(0, 24) || 'Jogador';
        const taken = new Set(names());
        let n = name,
          i = 2;
        while (taken.has(n)) n = name + ' ' + i++;
        name = n;
        const id = crypto.randomBytes(8).toString('hex');
        players.set(id, { name, res: null, t: Date.now() });
        setTimeout(() => {
          const q = players.get(id);
          if (q && !q.res) players.delete(id);
        }, 30000);
        return json(res, 200, { ok: true, id, name, players: names() });
      }
      if (p === '/events') {
        const role = u.searchParams.get('role');
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no',
          ...CORS,
        });
        res.write(':ok\n\n');
        const ka = setInterval(() => {
          try {
            res.write(':\n\n');
          } catch (e) {}
        }, 15000);
        if (role === 'gm') {
          if (u.searchParams.get('key') !== KEY) {
            send(res, { type: 'error', erro: 'Chave do mestre incorreta.' });
            return res.end();
          }
          gms.add(res);
          send(res, { type: 'hello', players: names(), role: 'gm' });
          toPlayers({ type: 'gm', on: true });
          req.on('close', () => {
            clearInterval(ka);
            gms.delete(res);
            toPlayers({ type: 'gm', on: gms.size > 0 });
          });
          return;
        }
        const q = players.get(u.searchParams.get('id'));
        if (!q) {
          send(res, { type: 'error', erro: 'Sessão expirada. Entre de novo.' });
          return res.end();
        }
        q.res = res;
        send(res, { type: 'hello', snap, players: names(), role: 'player', name: q.name, gm: gms.size > 0 });
        toAll({ type: 'players', list: names() });
        req.on('close', () => {
          clearInterval(ka);
          players.delete(u.searchParams.get('id'));
          toAll({ type: 'players', list: names() });
          return;
        });
        return;
      }
      if (p === '/gm' && req.method === 'POST') {
        if (req.headers['x-key'] !== KEY) return json(res, 403, { ok: false, erro: 'Chave incorreta.' });
        const b = await body(req);
        if (b.type === 'bg') {
          const m = /^data:([^;]+);base64,(.*)$/s.exec(b.data || '');
          if (m) bgs[b.id] = { mime: m[1], buf: Buffer.from(m[2], 'base64') };
          return json(res, 200, { ok: true });
        }
        if (b.type === 'snap') {
          snap = b.data;
          toPlayers({ type: 'snap', data: snap });
          return json(res, 200, { ok: true });
        }
        if (b.type === 'tok') {
          toPlayers(b);
          return json(res, 200, { ok: true });
        }
        if (b.type === 'snd') {
          toPlayers(b);
          return json(res, 200, { ok: true });
        }
        if (b.type === 'chat') {
          toAll({
            type: 'chat',
            from: b.from || 'Mestre',
            text: String(b.text || '').slice(0, 500),
            kind: b.kind || 'chat',
            gm: true,
            ts: Date.now(),
          });
          return json(res, 200, { ok: true });
        }
        return json(res, 400, { ok: false });
      }
      if (p === '/act' && req.method === 'POST') {
        const b = await body(req),
          q = players.get(b.id);
        if (!q || !q.res) return json(res, 403, { ok: false, erro: 'Sessão inválida.' });
        if (b.type === 'move') {
          toGM({ type: 'move', from: q.name, tokenId: b.tokenId, x: +b.x, y: +b.y });
          return json(res, 200, { ok: true });
        }
        if (b.type === 'chat') {
          toAll({
            type: 'chat',
            from: q.name,
            text: String(b.text || '').slice(0, 500),
            kind: b.kind === 'roll' ? 'roll' : 'chat',
            ts: Date.now(),
          });
          return json(res, 200, { ok: true });
        }
        return json(res, 400, { ok: false });
      }
      if (req.method === 'GET') {
        const file = path.join(PUBLIC_DIR, decodeURIComponent(p));
        const dentroDaPasta = file.startsWith(PUBLIC_DIR + path.sep); // impede sair da pasta (../)
        if (dentroDaPasta && fs.existsSync(file) && fs.statSync(file).isFile()) {
          const mime = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
          res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-store', ...CORS });
          return fs.createReadStream(file).pipe(res);
        }
      }
      res.writeHead(404, CORS);
      res.end();
    } catch (e) {
      try {
        json(res, 500, { ok: false });
      } catch (x) {}
    }
  })
  .listen(PORT, '0.0.0.0', () => {
    console.log('\n  ============  RPG Master — mesa online  ============\n');
    console.log('  Chave do mestre: ' + KEY + (PASS ? '   |   Senha dos jogadores: ' + PASS : ''));
    if (HTML_OK) console.log('  App servido: ' + HTML);
    else {
      console.log(
        '\n  ATENÇÃO: não achei o ' + (ARQUIVO_INFORMADO ? 'arquivo informado: ' + HTML : NOME_HTML + '.')
      );
      console.log(
        '  Os endereços abaixo NÃO vão abrir o app (quem usa o arquivo .html local ainda consegue entrar na mesa).'
      );
      if (!ARQUIVO_INFORMADO) {
        const inicios = [...new Set([__dirname, process.cwd()])];
        console.log(
          '  Procurei em "' +
            PASTA_APP +
            '/" e na própria pasta, subindo até ' +
            NIVEIS_ACIMA +
            ' pastas, a partir de:'
        );
        inicios.forEach(d => console.log('    ' + d));
      }
      console.log(
        '  Para corrigir, inicie com:  node servidor.js --arquivo "caminho/para/' +
          PASTA_APP +
          '/' +
          NOME_HTML +
          '"'
      );
    }
    console.log('\n  Endereços para passar aos jogadores (use o da sua rede VPN, ex.: Radmin 26.x.x.x):');
    const l = ips();
    if (!l.length) console.log('   (nenhuma rede encontrada)');
    l.forEach(x => console.log('   http://' + x.ip + ':' + PORT + '    (' + x.nome + ')'));
    console.log('   http://localhost:' + PORT + '    (neste computador)\n');
    console.log('  No app: Mesa virtual > 🌐 Online > cole o endereço e a chave.');
    console.log('  Para parar: Ctrl+C\n');
  });
