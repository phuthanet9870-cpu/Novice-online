#!/usr/bin/env python3
"""Packs the item icon sheets (weapons, armour, accessories, potions, runes, food, materials ...) into one atlas:
client/assets/icons/items.png (32x32 cells) + client/js/iconpool.js (named pools of cell indexes).
Usage: python3 tools/build-icons.py <dir with icons/ (pack A)> <dir with armor_000..063.png (pack B, 16 px)>"""
import sys, json, colorsys
from PIL import Image
A, B = sys.argv[1], sys.argv[2]
OUT_PNG, OUT_JS = 'client/assets/icons/items.png', 'client/js/iconpool.js'

def runs(v):
    out = []; s = None
    for i, b in enumerate(list(v) + [False]):
        if b and s is None: s = i
        if not b and s is not None: out.append((s, i)); s = None
    return out
def auto(path):
    im = Image.open(path).convert('RGBA'); px = im.split()[3].load(); W, H = im.size
    cols = runs([any(px[x, y] > 20 for y in range(H)) for x in range(W)]); rows = runs([any(px[x, y] > 20 for x in range(W)) for y in range(H)])
    out = []
    for (y0, y1) in rows:
        for (x0, x1) in cols:
            cx, cy = (x0 + x1) // 2, (y0 + y1) // 2; t = im.crop((cx - 16, cy - 16, cx + 16, cy + 16))
            out.append(t if t.split()[3].getbbox() else None)
    return out
def grid(path, cell):
    im = Image.open(path).convert('RGBA'); out = []
    for r in range(im.height // cell):
        for c in range(im.width // cell):
            t = im.crop((c * cell, r * cell, c * cell + cell, r * cell + cell))
            if cell != 32: t = t.resize((32, 32), Image.NEAREST)
            out.append(t if t.split()[3].getbbox() else None)
    return out
S = {
    'pw': grid(A + '/32x32_PixelWeapons_Free.png', 32), 'fw': grid(A + '/fantasy_weapons_pack1_noglow.png', 32), 'few': grid(A + '/fantasy_epicweapons_pack1_nobg.png', 32),
    'ss': grid(A + '/spritesheet_32x32.png', 32), 'i2': auto(A + '/icons-2.png'), 'i3': auto(A + '/icons-3.png'),
    'boots': grid(A + '/boots.png', 32), 'gloves': grid(A + '/gloves.png', 32), 'bracers': grid(A + '/bracers.png', 32), 'belts1': grid(A + '/belts-1.png', 32), 'belts2': grid(A + '/belts-2.png', 32),
    'ammies': grid(A + '/ammies.png', 32), 'potions': grid(A + '/potions.png', 32), 'rings': grid(A + '/Rings.png', 16), 'armor': [Image.open(B + '/armor_%03d.png' % i).convert('RGBA').resize((32, 32), Image.NEAREST) for i in range(64)]
}
def tint(im, hue):
    im = im.copy(); px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if not a: continue
            h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
            if s < 0.12: continue
            r2, g2, b2 = colorsys.hls_to_rgb((h + hue) % 1, l, min(1, s * 1.1))
            px[x, y] = (int(r2 * 255), int(g2 * 255), int(b2 * 255), a)
    return im
cols5 = lambda c: [c, c + 10, c + 20, c + 30, c + 40]
POOLS = {
    'w_sword': [('pw', i) for i in [0, 14, 28, 42, 56, 98, 112, 126, 168, 118]] + [('fw', i) for i in cols5(0)] + [('few', i) for i in cols5(0)],
    'w_katana': [('pw', i) for i in [70, 84, 140, 154, 48, 112]] + [('few', i) for i in [0, 30]],
    'w_spear': [('pw', i) for i in [1, 15, 29, 43, 57, 71, 85, 99, 113, 127, 141, 155, 169, 6, 62, 90, 188]],
    'w_axe': [('fw', i) for i in cols5(1)] + [('few', i) for i in cols5(1)] + [('pw', 174)],
    'w_dagger': [('fw', i) for i in cols5(3)] + [('few', i) for i in cols5(3)] + [('pw', 146), ('pw', 187)],
    'w_bow': [('pw', i) for i in [3, 17, 31, 45, 59, 73, 87, 101, 115, 129, 143, 157, 171, 185]] + [('fw', i) for i in cols5(4)] + [('few', i) for i in cols5(4)],
    'w_staff': [('pw', i) for i in [2, 16, 30, 44, 58, 72, 100, 114, 128, 182, 184]] + [('fw', i) for i in cols5(5) + cols5(7)] + [('few', i) for i in cols5(5) + cols5(7)] + [('i2', i) for i in [80, 81, 93, 94, 98, 99, 100, 101]],
    'w_mace': [('fw', i) for i in cols5(2)] + [('few', i) for i in cols5(2)] + [('pw', 20), ('pw', 132)],
    'w_knuckle': [('fw', i) for i in [8, 28, 38, 48]] + [('few', i) for i in [8, 28, 38, 48]],
    'w_claw': [('fw', 18), ('few', 18), ('few', 19)],
    'w_scythe': [('fw', i) for i in cols5(6)] + [('few', i) for i in cols5(6)] + [('pw', 160), ('pw', 183)],
    'w_gun': [('pw', 34), ('fw', 14), ('fw', 34), ('few', 14), ('few', 34)],
    'w_chakram': [('i2', 111), ('pw', 61), ('pw', 47)],
    'w_orb': [('i2', i) for i in [21, 77, 91, 92, 97]] + [('i3', i) for i in [91, 92, 93, 105]],
    'w_prism': [('pw', i) for i in [86, 142, 156, 170]] + [('i2', i) for i in [102, 103, 104]],
    'offhand': [('pw', i) for i in [18, 19, 32, 46, 47, 60, 61, 74, 75, 88, 89, 116, 117, 130, 144, 158, 172, 186]] + [('fw', i) for i in [9, 29, 49]] + [('few', i) for i in [9, 29, 49]] + [('i3', i) for i in [0, 1, 2, 3, 4, 14, 15]],
    'armor': [('armor', i) for i in range(8, 24)] + [('ss', i) for i in range(44)] + [('pw', 36), ('pw', 102)] + [('i3', i) for i in [10, 11, 12, 24, 25]],
    'boots': [('boots', i) for i in range(64)] + [('armor', i) for i in range(24, 32)] + [('pw', 38)],
    'gloves': [('gloves', i) for i in range(64)] + [('bracers', i) for i in range(64)] + [('armor', i) for i in range(32, 40)] + [('i3', i) for i in [13, 26, 27]],
    'belt': [('belts1', i) for i in range(64)] + [('belts2', i) for i in range(64)] + [('armor', i) for i in range(52, 56)],
    'necklace': [('ammies', i) for i in range(64)] + [('armor', i) for i in [40, 41, 42, 43, 48, 49, 50, 51]] + [('i3', i) for i in [106, 107, 108, 109, 110]] + [('i2', i) for i in [95, 96, 106, 110]],
    'ring': [('rings', i) for i in range(0, 49, 2)] + [('armor', i) for i in [60, 61, 62, 63]] + [('i2', i) for i in [82, 105, 107, 108, 109]],
    'earring': [('rings', i) for i in range(1, 49, 2)] + [('i3', i) for i in [61, 65, 68]],
    'potion_hp': [('potions', i) for i in range(64)] + [('i2', i) for i in [16, 19]],
    'potion_sp': [('i2', i) for i in [2, 3, 18, 0, 14]] + [('i3', 40)],
    'elixir': [('i2', i) for i in [1, 4, 5, 6, 15, 17, 20]] + [('i3', i) for i in [52, 53, 83]],
    'scroll': [('i2', i) for i in [74, 75, 76, 78, 79, 89, 90]] + [('i3', i) for i in [94, 95, 96]],
    'rune': [('i3', i) for i in [86, 87, 88, 89, 90, 99, 100, 101, 102, 103, 104]] + [('i2', i) for i in [12, 13, 27, 40, 41, 9, 10, 11, 22, 23, 24, 25, 26, 35, 36, 37, 38, 39]],
    'book': [('i2', i) for i in [70, 71, 72, 73, 84, 85, 86, 87, 88]] + [('i3', i) for i in [38, 39, 41]],
    'gem': [('i2', i) for i in [21, 77, 91, 92, 97]] + [('i3', i) for i in [91, 92, 93, 105, 51]] + [('armor', 59)],
    'mat_fang': [('i2', i) for i in [58, 59, 60, 61, 65]] + [('i3', i) for i in [61, 65, 68]], 'mat_feather': [('i2', i) for i in [62, 66, 67]],
    'mat_slime': [('i2', 63), ('i2', 64)], 'mat_bone': [('i2', 68), ('i2', 69)] + [('i3', i) for i in [44, 45, 46, 58]], 'mat_scale': [('i2', 56), ('i2', 57)],
    'mat_horn': [('i3', i) for i in [5, 6, 16, 17, 18, 62, 67, 69]], 'mat_hide': [('i3', i) for i in [59, 64, 66]], 'mat_bowl': [('i3', 60), ('i3', 63)],
    'relic': [('i3', i) for i in [28, 29, 30, 31, 32, 33, 36, 47, 49, 50, 34, 35, 37, 48, 42, 43, 56, 57, 111, 97, 54, 55]],
    'bag': [('i3', i) for i in [79, 80, 81, 84, 85, 98]], 'tool': [('i3', i) for i in [70, 71, 72, 73, 74, 78, 82]], 'banner': [('i3', i) for i in [7, 8, 9, 19, 20, 21, 22, 23]],
    'cloak': [('armor', i) for i in [44, 45, 46, 47]] + [('i3', i) for i in [59, 64, 66]],
    'head': [('armor', i) for i in range(0, 8)] + [('pw', 35)],
}
cells, idx, pools = [], {}, {}
def put(im, key):
    if key in idx: return idx[key]
    idx[key] = len(cells); cells.append(im); return idx[key]
for name, refs in POOLS.items():
    pools[name] = []
    for src, i in refs:
        arr = S[src]
        if i < len(arr) and arr[i] is not None: pools[name].append(put(arr[i], (src, i)))
# helmets and cloaks are rare in the packs: add hue-shifted variants so every tier looks different
for name, n in [('head', 10), ('cloak', 10)]:
    base = list(pools[name])
    for k in range(n):
        src = cells[base[k % len(base)]]
        pools[name].append(put(tint(src, (k + 1) / (n + 1)), (name, 't', k)))
COLS = 32
rows = (len(cells) + COLS - 1) // COLS
atlas = Image.new('RGBA', (COLS * 32, rows * 32), (0, 0, 0, 0))
for i, im in enumerate(cells): atlas.paste(im, ((i % COLS) * 32, (i // COLS) * 32))
import os
os.makedirs('client/assets/icons', exist_ok=True)
atlas.save(OUT_PNG, optimize=True)
with open(OUT_JS, 'w') as f:
    f.write('// AUTO-GENERATED by tools/build-icons.py: pools of 32x32 cells in client/assets/icons/items.png (32 per row)\n')
    f.write('window.ICON_POOL = ' + json.dumps({'cols': COLS, 'n': len(cells), 'pools': pools}) + ';\n')
if len(sys.argv) > 3:
    from PIL import ImageDraw
    rows_ = []
    for name, ids in pools.items():
        rows_.append((name, ids))
    W = 40 * 34 + 110; H = sum(((len(ids) + 33) // 34) * 40 for _, ids in rows_) + 4
    sheet = Image.new('RGBA', (W, H), (34, 30, 40, 255)); d = ImageDraw.Draw(sheet); y = 2
    for name, ids in rows_:
        d.text((4, y + 12), name, fill=(255, 230, 140, 255))
        for k, ci in enumerate(ids):
            x = 110 + (k % 34) * 40; yy = y + (k // 34) * 40
            sheet.paste(cells[ci].resize((32, 32)), (x, yy + 4), cells[ci].resize((32, 32)))
        y += ((len(ids) + 33) // 34) * 40
    sheet.save(sys.argv[3])
print('cells', len(cells), 'pools', {k: len(v) for k, v in pools.items()})
