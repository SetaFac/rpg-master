/* ===== RPG Master — Mesa virtual (grid, cenários, tokens, névoa) ===== */

/* ---- imagens ---- */
const blobToData = b =>
  new Promise(res => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => res(null);
    r.readAsDataURL(b);
  });
function dataToBlob(d) {
  const [m, b] = String(d).split(','),
    mime = (/data:([^;]+)/.exec(m) || [, 'image/jpeg'])[1],
    bin = atob(b),
    a = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
  return new Blob([a], { type: mime });
}
const vLoadImg = src =>
  new Promise(res => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => res(null);
    i.src = src;
  });
function vPickFile(accept) {
  return new Promise(res => {
    const i = h('input', { type: 'file', accept, style: { display: 'none' } });
    let done = false;
    i.onchange = () => {
      done = true;
      res(i.files[0] || null);
      i.remove();
    };
    window.addEventListener(
      'focus',
      () =>
        setTimeout(() => {
          if (!done && !i.files.length) {
            res(null);
            i.remove();
          }
        }, 600),
      { once: true }
    );
    document.body.append(i);
    i.click();
  });
}
/* reduz e (opcional) recorta em quadrado; devolve dataURL jpeg */
async function pickImage({ max = 256, square = false, quality = 0.85 } = {}) {
  const f = await vPickFile('image/*');
  if (!f) return null;
  const img = await vLoadImg(URL.createObjectURL(f));
  if (!img) {
    toast(t('badFile'));
    return null;
  }
  let sw = img.naturalWidth,
    sh = img.naturalHeight,
    sx = 0,
    sy = 0;
  if (square) {
    const s = Math.min(sw, sh);
    sx = (sw - s) / 2;
    sy = (sh - s) / 2;
    sw = sh = s;
  }
  const k = Math.min(1, max / Math.max(sw, sh)),
    c = document.createElement('canvas');
  c.width = Math.round(sw * k);
  c.height = Math.round(sh * k);
  c.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', quality);
}
async function vPickBg(max = 3200) {
  const f = await vPickFile('image/*');
  if (!f) return null;
  const img = await vLoadImg(URL.createObjectURL(f));
  if (!img) {
    toast(t('badFile'));
    return null;
  }
  const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight)),
    c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * k);
  c.height = Math.round(img.naturalHeight * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9));
  const rec = { id: uid(), blob, w: c.width, h: c.height };
  await DB.put('img', rec);
  return rec;
}
