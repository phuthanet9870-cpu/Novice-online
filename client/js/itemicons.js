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
  const LOOT = { fang: 'mat_fang', talon: 'mat_fang', stinger: 'mat_fang', pincer: 'mat_fang', feather: 'mat_feather', gel: 'mat_slime', ecto: 'mat_slime', bone: 'mat_bone', dust: 'mat_bone', scale: 'mat_scale', chitin: 'mat_scale', shell: 'mat_scale', plate: 'mat_scale', fur: 'mat_hide', cloth: 'mat_hide', horn: 'mat_horn', heart: 'relic', core: 'relic', orb: 'relic', pearl: 'relic', lens: 'relic', shard: 'relic', ember: 'relic', seal: 'relic', leaf: 'elixir', root: 'mat_hide', seed: 'bag', spore: 'bag', cap: 'mat_bowl', stone: 'relic', gland: 'mat_slime', coin: 'relic', relic: 'relic', box: 'bag', anvil: 'tool', food: 'elixir', oil: 'elixir', flask: 'elixir', scroll: 'scroll' };
  // upgrade materials each get their own look (they used to borrow the rune stones):
  // 'wa:' = a piece of the world atlas (roboden ore rocks / crystals), otherwise an icon pool name
  const MAT_ICON = {
    ore_rough: 'wa:r:iron_2', ore_refine: 'wa:r:iron_1', ore_enriched: 'wa:r:gold_1',
    crystal_shard: 'wa:r:gcry1', crystal_pure: 'wa:r:gcry0', divine_shard: 'wa:r:rcry1', crystal_divine: 'wa:r:rcry0',
    scroll_protect: 'scroll', scroll_bless: 'scroll', rune_drill: 'cell:953', reroll_stone: 'wa:r:magma_0',
    memory_crystal: 'tp:glacier:22', stat_reset: 'elixir', guild_emblem: 'banner', smith_charm: 'relic'
  };
  // monster materials by their kind (def.ic): each kind has its own set, never the rune stones, jewels or orb weapons.
  // 'tp:<sheet>:<cell>' = a Terrain Pack 4 scatter prop, 'wa:<piece>' = a roboden piece of the world atlas
  const IC_ICON = {
    stone: ['wa:r:iron_1', 'wa:r:iron_2', 'wa:r:iron_3', 'wa:r:sulfur_0', 'wa:r:sulfur_1', 'wa:r:gold_3', 'wa:r:snowy_1', 'wa:r:snowy_2', 'wa:r:magma_1', 'tp:storm_peaks:17', 'tp:storm_peaks:19', 'tp:petrified_forest:21', 'tp:petrified_forest:19'],
    heart: ['tp:obsidian_depths:19', 'tp:obsidian_depths:24', 'tp:ember_wastes:21', 'tp:obsidian_depths:23'],
    core: ['tp:obsidian_depths:24', 'tp:ember_wastes:18', 'tp:storm_peaks:23', 'tp:obsidian_depths:19'],
    orb: ['tp:obsidian_depths:22', 'tp:storm_peaks:22', 'tp:glacier:20'],
    pearl: ['tp:coral_reef:21', 'tp:coral_reef:23', 'tp:coral_reef:24'],
    lens: ['tp:glacier:21', 'tp:glacier:18', 'tp:glacier:19'],
    shard: ['wa:r:gcry0', 'wa:r:gcry2', 'wa:r:rcry0', 'wa:r:rcry1', 'tp:obsidian_depths:17', 'tp:obsidian_depths:18', 'tp:obsidian_depths:21', 'tp:ember_wastes:24', 'tp:glacier:17', 'tp:salt_flats:17'],
    ember: ['tp:ember_wastes:17', 'tp:ember_wastes:20', 'tp:ember_wastes:23']
  };
  // jewels: one cut-gem sprite recoloured to the jewel's own colour (ruby red, sapphire blue, emerald green …)
  const GEM_CELL = 892, GEM_HUE = { ruby: 160, sapphire: 25, emerald: -55, topaz: -150, amethyst: 80, diamond: 0 };
  const sheets = {};
  function sheet(name) { let im = sheets[name]; if (!im) { im = sheets[name] = new Image(); im.onload = () => { cache.clear(); if (window.UI && UI.refreshIcons) UI.refreshIcons(); }; im.src = 'client/assets/terrain/' + name + '.png'; } return im.naturalWidth ? im : null; }
  function drawTp(spec, rar) {
    const [, nm, n] = spec.split(':'); const im = sheet(nm); if (!im) return null;
    const S = 72, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d');
    const fr = frames[rar === undefined ? 'empty' : RAR[rar]]; if (fr && fr.naturalWidth) g.drawImage(fr, 0, 0, S, S);
    const k = +n - 1; g.imageSmoothingEnabled = true; g.drawImage(im, (k % 6) * 64, Math.floor(k / 6) * 64, 64, 64, 6, 6, 60, 60);
    return c.toDataURL();
  }
  function special(spec, rar) { return spec.startsWith('wa:') ? drawPiece(spec.slice(3), rar) : spec.startsWith('tp:') ? drawTp(spec, rar) : null; }
  const world = new Image(); if (window.WORLD_ART) { world.onload = () => { cache.clear(); if (window.UI && UI.refreshIcons) UI.refreshIcons(); }; world.src = WORLD_ART.src; }
  function drawPiece(name, rar) {
    const e = window.WORLD_ART && WORLD_ART.r[name]; if (!e || !world.naturalWidth) return null;
    const S = 72, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d');
    const fr = frames[rar === undefined ? 'empty' : RAR[rar]];
    if (fr && fr.naturalWidth) g.drawImage(fr, 0, 0, S, S);
    const k = Math.min(52 / e[2], 52 / e[3]), w = e[2] * k, h = e[3] * k;
    g.imageSmoothingEnabled = false; g.drawImage(world, e[0], e[1], e[2], e[3], Math.round((S - w) / 2), Math.round((S - h) / 2), Math.round(w), Math.round(h));
    return c.toDataURL();
  }
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
      case 'jewel': return [GEM_CELL];
      case 'mat': { const m = MAT_ICON[it.id]; return m && m.startsWith('cell:') ? [+m.slice(5)] : m && !m.startsWith('wa:') ? P[m] : P.tool; }
      case 'treasure': return def.ic === 'gem' ? [GEM_CELL] : P.relic;
      case 'box': return P.bag;
      case 'currency': return P.relic;
      case 'anvil': return P.tool;
      case 'wing': return P.mat_feather;
      case 'mount': return P.tool;
      case 'loot': case 'junk': return P[LOOT[def.ic] || 'mat_bone'];
    }
    return null;
  }
  function draw(cell, rar, hue, glow, filt) {
    const S = 72, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d');
    g.imageSmoothingEnabled = true;
    const fr = frames[rar === undefined ? 'empty' : RAR[rar]];
    if (fr && fr.naturalWidth) g.drawImage(fr, 0, 0, S, S); else { g.fillStyle = '#16121c'; g.fillRect(0, 0, S, S); }
    if (rar === 5) { g.strokeStyle = '#ff3a4a'; g.lineWidth = 3; g.strokeRect(4, 4, S - 8, S - 8); }
    if (glow) { const gr = g.createRadialGradient(S / 2, S / 2, 4, S / 2, S / 2, S / 2); gr.addColorStop(0, glow); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.globalAlpha = 0.35; g.fillStyle = gr; g.fillRect(0, 0, S, S); g.globalAlpha = 1; }
    g.imageSmoothingEnabled = false;
    if (filt) g.filter = filt; else if (hue) g.filter = `hue-rotate(${hue}deg)`;
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
    const rr0 = def && def.tier !== undefined ? Math.min(4, Math.floor(def.tier / 3)) : def && def.mat ? Math.min(4, def.mat) : undefined;
    let spec = it.id && MAT_ICON[it.id];
    if (!spec && def && (def.type === 'loot' || def.type === 'junk') && IC_ICON[def.ic]) { const L = IC_ICON[def.ic]; spec = L[hash(it.id) % L.length]; }
    if (ART.iconWhy && it.id && spec) ART.iconWhy[it.id] = 'spec:' + spec;
    if (spec && (spec.startsWith('wa:') || spec.startsWith('tp:'))) { const key = spec + '|' + rr0; let u = cache.get(key); if (!u) { u = special(spec, rr0); if (u) cache.set(key, u); } if (u) return u; }
    if (def && (def.type === 'jewel' || (def.type === 'treasure' && def.ic === 'gem'))) {
      if (ART.iconWhy) ART.iconWhy[it.id] = 'gem';
      const kind = def.kind || ['ruby', 'sapphire', 'emerald', 'topaz', 'amethyst', 'diamond'][hash(it.id) % 6];
      const key = 'gem|' + kind + '|' + rr0; let u = cache.get(key);
      if (!u) { u = draw(GEM_CELL, rr0, GEM_HUE[kind] || 0, null); if (kind === 'diamond') u = draw(GEM_CELL, rr0, 0, null, 'saturate(0.15) brightness(1.35)'); cache.set(key, u); }
      return u;
    }
    if (def && (def.type === 'card' || def.type === 'pet' || def.type === 'petfood' || def.type === 'zeny')) return base(it);
    const pool = poolOf(it, def); if (!pool || !pool.length) return base(it);
    if (ART.iconWhy && it.id) ART.iconWhy[it.id] = 'pool:' + (Object.keys(P).find((k) => P[k] === pool) || pool.join(','));
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
