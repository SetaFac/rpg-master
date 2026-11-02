/* ===== RPG Master — mesa online (cliente). O servidor fica no PC do mestre: servidor/servidor.js ===== */
const Net = {
  role: null,
  base: '',
  key: '',
  name: '',
  id: '',
  es: null,
  players: [],
  scene: null,
  listen: false,
  chat: [],
  shareGM: false,
  relay: false,
  status: 'off',
  hooks: {},
  last: '',
  bgSent: {},
  gmOn: false,
  _lossNotified: false,
  clean(b) {
    b = String(b || '')
      .trim()
      .replace(/\/+$/, '');
    if (b && !/^https?:\/\//i.test(b)) b = 'http://' + b;
    return b;
  },
  async ping(base) {
    try {
      const r = await fetch(base + '/ping', { cache: 'no-store' });
      const j = await r.json();
      return j && j.app === 'rpg-master' ? j : null;
    } catch (e) {
      return null;
    }
  },
  async post(path, body, key) {
    try {
      const r = await fetch(this.base + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-key': key ?? this.key },
        body: JSON.stringify(body),
      });
      return await r.json().catch(() => ({}));
    } catch (e) {
      return null;
    }
  },
  stream(url, onHello) {
    this.close();
    const es = (this.es = new EventSource(this.base + url));
    this.status = 'connecting';
    es.onopen = () => {
      this.status = 'on';
      this._lossNotified = false;
      this.emit();
    };
    es.onerror = () => {
      const wasOn = this.status === 'on';
      this.status = es.readyState === 2 ? 'off' : 'reconnecting';
      if (this.role === 'player' && wasOn && !this._lossNotified) {
        this._lossNotified = true;
        this.systemMessage('connection-lost');
      }
      this.emit();
    };
    es.onmessage = ev => {
      let m;
      try {
        m = JSON.parse(ev.data);
      } catch (e) {
        return;
      }
      this.handle(m, onHello);
    };
  },
  close() {
    if (this.es) {
      this.es.close();
      this.es = null;
    }
  },
  emit() {
    try {
      this.hooks.status && this.hooks.status();
      document.querySelectorAll('.net-chip').forEach(c => c._upd && c._upd());
    } catch (e) {}
  },
  async startGM(base, key) {
    base = this.clean(base);
    const info = await this.ping(base);
    if (!info)
      return L3(
        'Não encontrei o servidor nesse endereço. Ele está ligado?',
        'Server not found at that address. Is it running?',
        'Server unter dieser Adresse nicht gefunden. Läuft er?'
      );
    this.base = base;
    this.key = key.trim();
    this.role = 'gm';
    this.bgSent = {};
    this.last = '';
    return new Promise(res => {
      let done = false;
      this.stream('/events?role=gm&key=' + encodeURIComponent(this.key));
      const t = setTimeout(() => {
        if (!done) {
          done = true;
          this.leave();
          res(L3('Sem resposta do servidor.', 'No response from server.', 'Keine Antwort vom Server.'));
        }
      }, 6000);
      this._ready = e => {
        if (done) return;
        done = true;
        clearTimeout(t);
        if (e) {
          this.leave();
          res(e);
        } else {
          this.push(true);
          res(null);
        }
      };
    });
  },
  async join(base, name, pass) {
    base = this.clean(base);
    const info = await this.ping(base);
    if (!info)
      return L3(
        'Não encontrei o servidor nesse endereço.',
        'Server not found at that address.',
        'Server nicht gefunden.'
      );
    this.base = base;
    const r = await this.post('/join', { name, pass: pass || '' }, '');
    if (!r || !r.ok)
      return (r && r.erro) || L3('Não consegui entrar.', 'Could not join.', 'Beitritt fehlgeschlagen.');
    this.role = 'player';
    this.id = r.id;
    this.name = r.name;
    this.players = r.players || [];
    this.scene = null;
    return new Promise(res => {
      let done = false;
      this.stream('/events?id=' + this.id);
      const t = setTimeout(() => {
        if (!done) {
          done = true;
          this.leave();
          res(L3('Sem resposta do servidor.', 'No response from server.', 'Keine Antwort vom Server.'));
        }
      }, 6000);
      this._ready = e => {
        if (done) return;
        done = true;
        clearTimeout(t);
        if (e) {
          this.leave();
          res(e);
        } else res(null);
      };
    });
  },
  leave() {
    this.close();
    const was = this.role;
    const playersHook = this.hooks.players;
    this.role = null;
    this.scene = null;
    this.status = 'off';
    this.players = [];
    this._lossNotified = false;

    // Atualiza a interface imediatamente com a sessão já zerada.
    // O hook de jogadores pertence à VTT aberta e precisa sobreviver ao
    // desconectar/reconectar; caso contrário a lista só volta a renderizar
    // quando outra ação (como trocar de mapa) força renderSide().
    try {
      playersHook && playersHook();
      this.emit();
    } catch (e) {}

    // Hooks ligados à sessão podem ser descartados, mas mantemos o listener
    // visual de jogadores enquanto a VTT continuar aberta. Isso cobre tanto
    // desconexão quanto uma nova conexão do mestre na mesma tela.
    this.hooks = {};
    if (typeof playersHook === 'function') this.hooks.players = playersHook;
    return was;
  },
  addChat(m) {
    this.chat.push(m);
    if (this.chat.length > 80) this.chat.shift();
    this.hooks.chat && this.hooks.chat(m);
  },
  systemMessage(event, name, ts) {
    const texts = {
      'player-joined': () =>
        L3(`${name} entrou na mesa.`, `${name} joined the table.`, `${name} ist dem Tisch beigetreten.`),
      'player-left': () =>
        L3(`${name} saiu da mesa.`, `${name} left the table.`, `${name} hat den Tisch verlassen.`),
      'gm-left': () =>
        L3(
          'O mestre encerrou a conexão com a mesa.',
          'The GM ended the connection to the table.',
          'Der Spielleiter hat die Verbindung zum Tisch beendet.'
        ),
      'connection-lost': () =>
        L3(
          'A conexão com o servidor da mesa foi perdida.',
          'The connection to the table server was lost.',
          'Die Verbindung zum Tischserver wurde unterbrochen.'
        ),
    };
    const make = texts[event];
    if (!make) return;
    this.addChat({ type: 'chat', kind: 'system', from: '', text: make(), ts: ts || Date.now() });
  },
  handle(m) {
    if (m.type === 'error') {
      this._ready && this._ready(m.erro || 'Erro');
      toast(m.erro || 'Erro');
      return;
    }
    if (m.type === 'hello') {
      this.players = m.players || [];
      this.gmOn = !!m.gm;
      this._ready && this._ready(null);
      if (this.role === 'player' && m.snap) this.onSnap(m.snap);
      this.hooks.players && this.hooks.players();
      this.emit();
      return;
    }
    if (m.type === 'players') {
      this.players = m.list || [];
      this.hooks.players && this.hooks.players();
      this.emit();
      return;
    }
    if (m.type === 'gm') {
      this.gmOn = m.on;
      this.hooks.players && this.hooks.players();
      return;
    }
    if (m.type === 'system') {
      this.systemMessage(m.event, m.name, m.ts);
      return;
    }
    if (m.type === 'snap') {
      this.onSnap(m.data);
      return;
    }
    if (m.type === 'tok') {
      const tk = this.scene && this.scene.tokens.find(k => k.id === m.tokenId);
      if (tk) {
        tk.x = m.x;
        tk.y = m.y;
        this.hooks.redraw && this.hooks.redraw();
      }
      return;
    }
    if (m.type === 'move') {
      this.hooks.move && this.hooks.move(m);
      return;
    }
    if (m.type === 'chat') {
      this.addChat(m);
      return;
    }
    if (m.type === 'snd' && this.role === 'player' && this.listen) {
      try {
        Net.relay = false;
        if (m.act === 'play') Snd.play(m.id);
        else if (m.act === 'startAmb') Snd.startAmb(m.id);
        else if (m.act === 'stopAmb') Snd.stopAmb();
        else if (m.act === 'stopAll') Snd.stopAll();
      } catch (e) {}
    }
  },
  onSnap(sc) {
    sc.terr = sc.terr || {};
    sc.props = sc.props || [];
    sc.tokens = sc.tokens || [];
    if (
      sc.bg &&
      sc.bg.kind === 'img' &&
      !(vCache.img[sc.bg.imgId] && vCache.img[sc.bg.imgId] !== 'x') &&
      !this._loading
    ) {
      const id = sc.bg.imgId;
      if (!vCache.img[id]) {
        vCache.img[id] = 'x';
        const im = new Image();
        im.crossOrigin = 'anonymous';
        im.onload = () => {
          vCache.img[id] = im;
          vCache.comp = {};
          this.hooks.redraw && this.hooks.redraw();
        };
        im.src = this.base + '/bg/' + id;
      }
    }
    this.scene = sc;
    if (this.hooks.snap) this.hooks.snap(sc);
    else if (this.role === 'player') renderVTT(null, { remote: true });
  },
  /* --- lado do mestre --- */
  dirty() {
    if (this.role !== 'gm') return;
    clearTimeout(this._dt);
    this._dt = setTimeout(() => this.push(), 140);
  },
  async push(force) {
    if (this.role !== 'gm' || !this.es) return;
    const snap = vSnapshot();
    if (!snap) return;
    const str = JSON.stringify(snap);
    if (!force && str === this.last) return;
    this.last = str;
    if (snap.bg.kind === 'img' && !this.bgSent[snap.bg.imgId]) {
      const r = await DB.get('img', snap.bg.imgId);
      if (r) {
        await this.post('/gm', { type: 'bg', id: snap.bg.imgId, data: await blobToData(r.blob) });
        this.bgSent[snap.bg.imgId] = 1;
      }
    }
    await this.post('/gm', { type: 'snap', data: snap });
  },
  say(text, kind) {
    if (this.role === 'gm')
      this.post('/gm', { type: 'chat', from: L3('Mestre', 'GM', 'Spielleiter'), text, kind });
    else if (this.role === 'player') this.post('/act', { id: this.id, type: 'chat', text, kind });
  },
  roll(e) {
    if (!this.role || (this.role === 'gm' && !this.shareGM)) return;
    this.say(
      e.title +
        ': ' +
        e.total +
        (e.detail ? '  (' + e.detail + ')' : '') +
        (e.crit ? ' ★' : e.fail ? ' ✖' : ''),
      'roll'
    );
  },
  relaySnd(act, id) {
    if (this.role === 'gm' && this.relay && this.es) this.post('/gm', { type: 'snd', act, id });
  },
};
/* mestre: o painel de som também toca nos jogadores (efeitos e ambientes, quando ligado) */
(function () {
  const S = Snd,
    o = { play: S.play, startAmb: S.startAmb, stopAmb: S.stopAmb, stopAll: S.stopAll };
  S.play = function (...a) {
    if (a.length === 1) Net.relaySnd('play', a[0]);
    return o.play.apply(S, a);
  };
  S.startAmb = function (id) {
    Net.relaySnd('startAmb', id);
    return o.startAmb.call(S, id);
  };
  S.stopAmb = function (...a) {
    if (!a.length) Net.relaySnd('stopAmb');
    return o.stopAmb.apply(S, a);
  };
  S.stopAll = function () {
    Net.relaySnd('stopAll');
    return o.stopAll.call(S);
  };
  const sv = Store.save;
  Store.save = function () {
    const r = sv.apply(Store, arguments);
    try {
      Net.dirty();
    } catch (e) {}
    return r;
  };
  setInterval(() => {
    if (Net.role === 'gm') Net.dirty();
  }, 4000);
})();

function netChip() {
  const c = h('button.btn.net-chip', {
    type: 'button',
    onclick: () =>
      Net.role === 'gm' ? onlineDialogGM() : Net.role === 'player' ? renderVTT(null, { remote: true }) : null,
  });
  c._upd = () => {
    c.style.display = Net.role ? '' : 'none';
    c.textContent =
      '🌐 ' +
      (Net.role === 'gm' ? L3('Online', 'Online', 'Online') : Net.name) +
      ' · ' +
      (Net.status === 'on' ? '●' : '○') +
      ' ' +
      Net.players.length;
  };
  c._upd();
  return c;
}
function defaultBase() {
  return /^https?:$/.test(location.protocol) ? location.origin : 'http://localhost:3000';
}
function onlineDialogGM() {
  const previousPlayersHook = Net.hooks.players;
  let playersHook;
  const wrap = h('div'),
    base = h('input', { type: 'text', value: localStorage.getItem('rpgm.base') || defaultBase() }),
    key = h('input', {
      type: 'text',
      placeholder: 'ex.: a1b2c3',
      value: localStorage.getItem('rpgm.key') || '',
    });
  const m = modal({
    title:
      '🌐 ' +
      L3(
        'Mesa online (você é o mestre)',
        'Online table (you are the GM)',
        'Online-Tisch (du bist Spielleiter)'
      ),
    body: wrap,
    actions: [{ label: t('close') }],
    onClose: () => {
      if (Net.hooks.players === playersHook) Net.hooks.players = previousPlayersHook;
    },
  });
  const draw = () => {
    if (Net.role === 'gm' && Net.es) {
      const snd = h('input', {
          type: 'checkbox',
          checked: Net.relay,
          onchange: e => {
            Net.relay = e.target.checked;
          },
        }),
        roll = h('input', {
          type: 'checkbox',
          checked: Net.shareGM,
          onchange: e => {
            Net.shareGM = e.target.checked;
          },
        });
      wrap.replaceChildren(
        h(
          'p',
          h(
            'b',
            Net.status === 'on'
              ? '● ' + L3('Conectado', 'Connected', 'Verbunden')
              : '○ ' + L3('Reconectando…', 'Reconnecting…', 'Verbinde neu…')
          ),
          ' · ' + Net.base
        ),
        h(
          'div.sec-t',
          L3('Jogadores na mesa', 'Players at the table', 'Spieler am Tisch') +
            ' (' +
            Net.players.length +
            ')'
        ),
        Net.players.length
          ? vttParticipantList({ includeGM: false, markSelf: false })
          : h(
              'p.muted',
              L3(
                'Ninguém entrou ainda. Passe o endereço do servidor aos jogadores.',
                'Nobody yet. Give the server address to your players.',
                'Noch niemand. Gib den Spielern die Serveradresse.'
              )
            ),
        h(
          'label',
          { style: { display: 'flex', gap: '8px', alignItems: 'center', margin: '8px 0' } },
          snd,
          L3(
            'Tocar para os jogadores os efeitos e ambientes que eu disparar',
            'Play the effects and ambiences I trigger for the players too',
            'Meine Effekte und Ambiente auch bei den Spielern abspielen'
          )
        ),
        h(
          'label',
          { style: { display: 'flex', gap: '8px', alignItems: 'center', margin: '8px 0' } },
          roll,
          L3(
            'Mostrar minhas rolagens de dados no chat',
            'Show my dice rolls in the chat',
            'Meine Würfe im Chat zeigen'
          )
        ),
        h(
          'p.muted',
          { style: { fontSize: '.85em' } },
          L3(
            'Para os jogadores moverem os bonecos: clique no token e escolha “Controlado por”. Só o que está visível (sem névoa e sem ocultos) é enviado a eles.',
            'To let players move tokens: click a token and pick “Controlled by”. Only visible things (no fog, no hidden items) are sent to them.',
            'Damit Spieler Token bewegen: Token anklicken und „Gesteuert von“ wählen. Gesendet wird nur Sichtbares.'
          )
        ),
        h(
          'button.btn.danger',
          {
            type: 'button',
            onclick: () => {
              Net.leave();
              draw();
            },
          },
          L3('Desconectar', 'Disconnect', 'Trennen')
        )
      );
    } else {
      wrap.replaceChildren(
        h(
          'p.muted',
          { style: { marginTop: 0 } },
          L3(
            'Ligue o servidor no seu PC (arquivo Iniciar-Servidor), copie a chave que ele mostra e conecte aqui.',
            'Start the server on your PC (Iniciar-Servidor file), copy the key it shows and connect here.',
            'Starte den Server auf deinem PC (Datei Iniciar-Servidor), kopiere den Schlüssel und verbinde dich hier.'
          )
        ),
        h('label.f', L3('Endereço do servidor', 'Server address', 'Serveradresse'), base),
        h('label.f', L3('Chave do mestre', 'GM key', 'Spielleiter-Schlüssel'), key),
        h('p#neterr', { style: { color: 'var(--bad)', minHeight: '1.2em' } }),
        h(
          'button.btn.primary',
          {
            type: 'button',
            onclick: async e => {
              e.target.disabled = true;
              const r = await Net.startGM(base.value, key.value);
              e.target.disabled = false;
              if (r) {
                $('#neterr').textContent = r;
                return;
              }
              localStorage.setItem('rpgm.base', Net.base);
              localStorage.setItem('rpgm.key', Net.key);
              draw();
              buildTop();
            },
          },
          '🌐 ' + L3('Conectar', 'Connect', 'Verbinden')
        )
      );
    }
  };
  playersHook = () => {
    if (typeof previousPlayersHook === 'function') previousPlayersHook();
    if (document.body.contains(wrap)) draw();
  };
  Net.hooks.players = playersHook;
  draw();
}
function joinDialog() {
  const base = h('input', {
    type: 'text',
    value: localStorage.getItem('rpgm.pbase') || defaultBase(),
    placeholder: 'http://26.0.0.1:3000',
  });
  const first = Object.values(Store.data.chars)[0],
    name = h('input', {
      type: 'text',
      value: localStorage.getItem('rpgm.pname') || (first && first.name) || '',
    }),
    pass = h('input', {
      type: 'text',
      placeholder: L3('(se o mestre pediu)', '(if the GM asked)', '(falls verlangt)'),
    });
  modal({
    title: '🌐 ' + L3('Entrar na mesa online', 'Join online table', 'Online-Tisch beitreten'),
    body: h(
      'div',
      h(
        'p.muted',
        { style: { marginTop: 0 } },
        L3(
          'Peça ao mestre o endereço do servidor (ex.: http://26.1.2.3:3000) e digite seu nome.',
          'Ask the GM for the server address (e.g. http://26.1.2.3:3000) and type your name.',
          'Frag den Spielleiter nach der Serveradresse und gib deinen Namen ein.'
        )
      ),
      h('label.f', L3('Endereço do mestre', 'GM address', 'Adresse'), base),
      h('label.f', L3('Seu nome na mesa', 'Your table name', 'Dein Name'), name),
      h('label.f', L3('Senha da mesa', 'Table password', 'Passwort'), pass),
      h('p#neterr', { style: { color: 'var(--bad)', minHeight: '1.2em' } })
    ),
    actions: [
      { label: t('cancel') },
      {
        label: L3('Entrar', 'Join', 'Beitreten'),
        primary: true,
        onClick: async () => {
          const r = await Net.join(base.value, name.value, pass.value);
          if (r) {
            toast(r, 4000);
            return false;
          }
          localStorage.setItem('rpgm.pbase', Net.base);
          localStorage.setItem('rpgm.pname', Net.name);
          buildTop();
          if (Net.scene) renderVTT(null, { remote: true });
          else waitingView();
        },
      },
    ],
  });
}
function waitingView() {
  document.querySelectorAll('.ovl').forEach(o => o.remove());
  const v = $('#view');
  v.replaceChildren(
    h(
      'div.home',
      h(
        'div.hero',
        h('h1', '🌐 ' + L3('Conectado!', 'Connected!', 'Verbunden!')),
        h(
          'p',
          L3(
            'Aguardando o mestre abrir a Mesa virtual…',
            'Waiting for the GM to open the virtual tabletop…',
            'Warte darauf, dass der Spielleiter den virtuellen Tisch öffnet…'
          )
        )
      ),
      h(
        'button.btn',
        {
          onclick: () => {
            Net.leave();
            goHome();
          },
        },
        '← ' + L3('Sair da mesa', 'Leave table', 'Tisch verlassen')
      )
    )
  );
}
