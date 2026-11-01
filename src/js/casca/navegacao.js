/* ---------- navegação ---------- */
function goHome() {
  if (App.edit) {
    App.edit = false;
    document.body.classList.remove('editing');
  }
  App.ch = null;
  App.tpl = null;
  App.rt = null;
  App.binds = [];
  App.hudBinds = [];
  Store.data.cur = null;
  Store.save();
  applyPrefs();
  buildTop();
  renderHome();
  window.scrollTo(0, 0);
}
function openChar(id) {
  const ch = Store.data.chars[id];
  if (!ch) return goHome();
  const tpl = getTpl(ch.tplId);
  if (!tpl) {
    toast(t('badFile'));
    return goHome();
  }
  App.ch = ch;
  App.tpl = tpl;
  App.rt = new RT(tpl, ch);
  App.tab = ch.tab && tpl.tabs.find(x => x.id === ch.tab) ? ch.tab : tpl.tabs[0] && tpl.tabs[0].id;
  App.edit = false;
  document.body.classList.remove('editing');
  App.collapsed = new Set();
  Store.data.cur = id;
  Store.save();
  applyPrefs();
  buildTop();
  renderChar();
  window.scrollTo(0, 0);
}
function newChar(tplId) {
  const tpl = getTpl(tplId);
  if (!tpl) return;
  const ch = { id: uid(), tplId, name: '', v: {}, g: {}, created: Date.now(), updated: Date.now() };
  Store.data.chars[ch.id] = ch;
  Store.save();
  openChar(ch.id);
}
async function deleteChar(id) {
  const ch = Store.data.chars[id];
  if (!ch) return;
  if (!(await ask(t('delQ', ch.name || t('unnamed')), t('del')))) return;
  delete Store.data.chars[id];
  Store.save();
  goHome();
}
function updateName() {
  const hd = App.tpl && App.tpl.hud;
  if (!hd || !hd.title) return;
  try {
    App.ch.name = String(App.rt.evalF(hd.title) || '');
  } catch (e) {}
}
