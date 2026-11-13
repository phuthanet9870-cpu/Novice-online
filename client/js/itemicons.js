// Item icons from the sprite packs (client/assets/icons/items.png): every equipment base, potion, rune, jewel,
// food, scroll and monster material picks a fitting sprite (stable per item), drawn on a CinderUI rarity slot.
(function () {
  const IP = window.ICON_POOL; if (!IP || !window.ART) return;
  const D = NO_DATA;
  const atlas = new Image(); const frames = {};
  let ready = 0;
  const RAR = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'legendary'];
  const done = () => { if (++ready === 1 + RAR.length - 1 + 1) { cache.clear(); if (window.UI && UI.refreshIcons) UI.refreshIcons(); } };
  atlas.onload = done; atlas.src = 'client/assets/icons/items.png';
  for (const r of ['common', 'uncommon', 'rare', 'epic', 'legendary', 'empty']) { const im = new Image(); im.onload = done; im.src = 'client/assets/ui/cinder/slot_' + (r === 'empty' ? 'empty' : 'rarity_' + r) + '.png'; frames[r] = im; }
  const cache = new Map();
  const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const P = IP.pools;
  const LOOT = { fang: 'mat_fang', talon: 'mat_fang', stinger: 'mat_fang', pincer: 'mat_fang', feather: 'mat_feather', gel: 'mat_slime', ecto: 'mat_slime', bone: 'mat_bone', dust: 'mat_bone', scale: 'mat_scale', chitin: 'mat_scale', shell: 'mat_scale', plate: 'mat_scale', fur: 'mat_hide', cloth: 'mat_hide', horn: 'mat_horn', heart: 'gem', core: 'gem', orb: 'gem', pearl: 'gem', lens: 'gem', shard: 'gem', ember: 'gem', seal: 'relic', leaf: 'elixir', root: 'mat_hide', seed: 'bag', spore: 'bag', cap: 'mat_bowl', stone: 'rune', gland: 'mat_slime', coin: 'relic', relic: 'relic', box: 'bag', anvil: 'tool', food: 'elixir', oil: 'elixir', flask: 'elixir', scroll: 'scroll' };
  function poolOf(it, def) {
    if (it.type === 'equip') {
      if (it.slot === 'weapon') return P['w_' + it.wtype] || P.w_sword;
      const s = it.slot === 'ring1' || it.slot === 'ring2' ? 'ring' : it.slot;
      return P[s] || null;
    }
    if (!def) return null;
    switch (def.type) {
      case 'potion': return def.sp && !def.hp ? P.potion_sp : P.potion_hp;
      case 'cure': return P.elixir;
      case 'scroll': return P.scroll;
      case 'buffitem': return P[LOOT[def.ic] || 'elixir'];
      case 'rune': return P.rune;
      case 'jewel': return P.gem;
      case 'mat': return def.ic === 'shard' || def.ic === 'seal' ? P.gem : P.rune;
      case 'treasure': return P[def.ic === 'gem' ? 'gem' : 'relic'];
      case 'box': return P.bag;
      case 'currency': return P.relic;
      case 'anvil': return P.tool;
      case 'wing': return P.mat_feather;
      case 'mount': return P.tool;
      case 'loot': case 'junk': return P[LOOT[def.ic] || 'mat_bone'];
    }
    return null;
  }
  function draw(cell, rar, hue, glow) {
    const S = 72, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d');
    g.imageSmoothingEnabled = true;
    const fr = frames[rar === undefined ? 'empty' : RAR[rar]];
    if (fr && fr.naturalWidth) g.drawImage(fr, 0, 0, S, S); else { g.fillStyle = '#16121c'; g.fillRect(0, 0, S, S); }
    if (rar === 5) { g.strokeStyle = '#ff3a4a'; g.lineWidth = 3; g.strokeRect(4, 4, S - 8, S - 8); }
    if (glow) { const gr = g.createRadialGradient(S / 2, S / 2, 4, S / 2, S / 2, S / 2); gr.addColorStop(0, glow); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.globalAlpha = 0.35; g.fillStyle = gr; g.fillRect(0, 0, S, S); g.globalAlpha = 1; }
    g.imageSmoothingEnabled = false;
    if (hue) g.filter = `hue-rotate(${hue}deg)`;
    const sx = (cell % IP.cols) * 32, sy = Math.floor(cell / IP.cols) * 32;
    g.drawImage(atlas, sx, sy, 32, 32, 4, 4, 64, 64);
    g.filter = 'none';
    return c.toDataURL();
  }
  const RGLOW = [null, null, 'rgba(74,168,255,1)', 'rgba(192,108,255,1)', 'rgba(255,154,42,1)', 'rgba(255,58,74,1)'];
  const base = ART.itemIcon;
  ART.itemIcon = function (it) {
    if (!it) return '';
    if (!atlas.naturalWidth) return base(it);
    const def = it.id ? D.ITEMS[it.id] : null;
    if (def && def.img) return def.img;
    if (def && (def.type === 'card' || def.type === 'pet' || def.type === 'petfood' || def.type === 'zeny')) return base(it);
    const pool = poolOf(it, def); if (!pool || !pool.length) return base(it);
    // stable pick: the same base item always looks the same; different bases spread over the pool
    const seed = it.type === 'equip' ? (it.slot + ':' + (it.wtype || '') + ':' + (it.base || it.name || '')) : it.id;
    const h = hash(seed), cell = pool[h % pool.length];
    // small pools get a hue shift so neighbouring materials don't look identical
    const hue = pool.length < 12 && it.type !== 'equip' ? ((h >>> 8) % 9 - 4) * 24 : 0;
    const rar = it.type === 'equip' ? it.rarity : def && def.tier !== undefined ? Math.min(4, Math.floor(def.tier / 3)) : def && def.mat ? Math.min(4, def.mat) : undefined;
    const key = cell + '|' + rar + '|' + hue;
    let u = cache.get(key); if (!u) { u = draw(cell, rar, hue, it.type === 'equip' ? RGLOW[it.rarity] : null); cache.set(key, u); }
    return u;
  };
  ART.iconReady = () => !!atlas.naturalWidth;
  // CinderUI gold glyphs for menus: ART.glyph('bag') -> data URL
  const gl = new Image(); gl.src = 'client/assets/ui/cinder_icons.png'; const gcache = new Map();
  ART.glyph = function (name, size = 48) {
    const i = (window.CINDER_ICONS || []).indexOf(name); if (i < 0 || !gl.naturalWidth) return '';
    const k = name + size; let u = gcache.get(k); if (u) return u;
    const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'); g.drawImage(gl, (i % 12) * 64, Math.floor(i / 12) * 64, 64, 64, 0, 0, size, size);
    u = c.toDataURL(); gcache.set(k, u); return u;
  };
  gl.onload = () => { if (window.UI && UI.refreshIcons) UI.refreshIcons(); };
})();
