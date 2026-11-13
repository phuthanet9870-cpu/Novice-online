#!/usr/bin/env python3
"""Packs the world art packs into game atlases.
  monsters  : Topdown Monsters Part 1 (11 sheets, 80px cells) -> client/assets/monsters/tmNN.png (rows idle/run/attack/hit/death)
  tiles     : Brimspire demo (32px) + roboden tileset (CC0) + Dungeon tileset (16px) -> client/assets/tiles/world.png
  manifest  : client/js/worldart.js  (window.WORLD_ART + monster entries merged into window.BOSS_ART)
usage: python3 tools/build-world-art.py <monsters dir> <brimspire png/32px dir> <roboden dir> <dungeon tileset png>"""
import sys, os, json, glob
from PIL import Image
MON, BRIM, ROBO, DUNG = sys.argv[1:5]
os.makedirs('client/assets/monsters', exist_ok=True); os.makedirs('client/assets/tiles', exist_ok=True)

# ---------------------------------------------------------------- monsters
ROWS = [('idle', 0), ('run', 1), ('attack', 5), ('hit', 6), ('death', 12)]
mons = {}
for i in range(11):
    sh = Image.open(f'{MON}/{i:02d}.png').convert('RGBA')
    counts = []
    for _, r in ROWS:
        counts.append(sum(1 for c in range(8) if sh.crop((c * 80, r * 80, c * 80 + 80, r * 80 + 80)).getbbox()))
    out = Image.new('RGBA', (8 * 80, len(ROWS) * 80))
    for k, (_, r) in enumerate(ROWS): out.paste(sh.crop((0, r * 80, 640, r * 80 + 80)), (0, k * 80))
    key = f'tm{i:02d}'
    out.save(f'client/assets/monsters/{key}.png', optimize=True)
    mons[key] = {'cw': 80, 'ch': 80, 'a': {n: [k, counts[k]] for k, (n, _) in enumerate(ROWS)}, 'src': f'client/assets/monsters/{key}.png', 'mon': 1}

# ---------------------------------------------------------------- tile / prop pieces
pieces = []  # (name, image)
def runs(img):
    px = img.split()[3].load(); W, H = img.size; cols = [any(px[x, y] > 10 for y in range(H)) for x in range(W)]
    out = []; s = None
    for x, b in enumerate(cols + [False]):
        if b and s is None: s = x
        if not b and s is not None: out.append((s, x)); s = None
    return out
def strip(path, name, cell=None):
    im = Image.open(path).convert('RGBA')
    if cell:
        for i in range(im.width // cell):
            t = im.crop((i * cell, 0, (i + 1) * cell, im.height))
            if t.getbbox(): pieces.append((f'{name}{i}', t.crop(t.getbbox())))
    else:
        for i, (a, b) in enumerate(runs(im)):
            t = im.crop((a, 0, b, im.height)); pieces.append((f'{name}{i}', t.crop(t.getbbox())))
# Brimspire: ground (keep full 32x32 cells) + every prop, named by its file
for f in sorted(glob.glob(f'{BRIM}/**/*.png', recursive=True)):
    rel = f.split('/32px/')[1][:-4]; im = Image.open(f).convert('RGBA')
    nm = 'b:' + rel.split('/')[-1]
    if rel.startswith('ground/') or rel.startswith('walls/'): pieces.append((nm, im))
    else: pieces.append((nm, im.crop(im.getbbox()) if im.getbbox() else im))
# roboden (CC0)
strip(f'{ROBO}/forest/trees.png', 'r:ftree', 32); strip(f'{ROBO}/tundra/trees.png', 'r:ttree', 32)
for k in range(1, 6): strip(f'{ROBO}/tundra/snowpile{"" if k == 1 else k}.png', f'r:snow{k}_', 96)
strip(f'{ROBO}/misc/green_crystals.png', 'r:gcry', 16); strip(f'{ROBO}/misc/red_crystal.png', 'r:rcry', 16)
for n in ['iron_source', 'red_essence_source', 'sulfur_source', 'gold_source', 'organic_source', 'magma_rock_source', 'snowy_iron_source']: strip(f'{ROBO}/misc/{n}.png', 'r:' + n.split('_')[0] + '_')
for b in ['moon', 'tundra']: strip(f'{ROBO}/{b}/landcrack.png', f'r:{b}crack')
for b in ['forest', 'tundra', 'inferno', 'moon']:
    for m in ['big', 'medium', 'small', 'tall', 'wide']:
        im = Image.open(f'{ROBO}/{b}/mountain_{m}.png').convert('RGBA'); pieces.append((f'r:{b}mt_{m}', im.crop(im.getbbox())))
pieces.append(('r:geyser', Image.open(f'{ROBO}/inferno/geyser.png').convert('RGBA')))
# Dungeon tileset (16 px grid): floors, wall faces/tops and props
dg = Image.open(DUNG).convert('RGBA')
cell = lambda c, r, w=1, h=1: dg.crop((c * 16, r * 16, (c + w) * 16, (r + h) * 16))
for i, (c, r) in enumerate([(0, 9), (1, 9), (2, 9), (0, 10), (1, 10), (2, 10), (3, 10), (0, 11), (1, 11), (2, 11), (9, 8), (10, 8), (11, 8), (12, 8), (9, 9), (10, 9), (11, 9), (12, 9), (10, 10), (11, 10), (12, 10), (13, 10)]): pieces.append((f'd:floor{i}', cell(c, r)))
for i, (c, r) in enumerate([(0, 4), (1, 4), (2, 4), (3, 4), (4, 4), (5, 4), (6, 4), (7, 4), (8, 4), (9, 4)]): pieces.append((f'd:wall{i}', cell(c, r)))
for i, (c, r) in enumerate([(0, 3), (1, 3), (2, 3), (3, 3), (4, 3), (5, 3)]): pieces.append((f'd:walltop{i}', cell(c, r)))
for i, (c, r) in enumerate([(0, 1), (1, 1), (0, 2), (1, 2), (3, 1), (4, 1)]): pieces.append((f'd:wallin{i}', cell(c, r)))
def prop(name, box):
    t = dg.crop(box); bb = t.getbbox()
    if bb: pieces.append((name, t.crop(bb)))
for i, c in enumerate([20, 21, 22]): prop(f'd:pillar{i}', (c * 16, 0, c * 16 + 16, 48))
prop('d:fence', (368, 16, 384, 48)); prop('d:barrel0', (112, 80, 128, 112)); prop('d:barrel1', (128, 80, 144, 112)); prop('d:pot', (144, 80, 160, 112)); prop('d:jar', (160, 80, 176, 112))
prop('d:torch', (176, 80, 192, 112)); prop('d:barrels', (192, 80, 224, 120)); prop('d:bones', (240, 64, 256, 80)); prop('d:rubble', (176, 56, 224, 80)); prop('d:spikes', (192, 32, 256, 48))
prop('d:banner0', (176, 0, 192, 32)); prop('d:banner1', (192, 0, 208, 32)); prop('d:arch', (208, 0, 224, 32))

# ---------------------------------------------------------------- shelf-pack
pieces.sort(key=lambda p: -p[1].height)
W = 1024; x = y = rh = 0; rects = {}
for nm, im in pieces:
    if x + im.width > W: x = 0; y += rh + 1; rh = 0
    rects[nm] = [x, y, im.width, im.height]; x += im.width + 1; rh = max(rh, im.height)
atlas = Image.new('RGBA', (W, y + rh))
for nm, im in pieces: atlas.paste(im, tuple(rects[nm][:2]))
atlas.save('client/assets/tiles/world.png', optimize=True)
with open('client/js/worldart.js', 'w') as f:
    f.write('// AUTO-GENERATED by tools/build-world-art.py: world atlas rects + animated monster sheets\n')
    f.write('window.WORLD_ART = ' + json.dumps({'src': 'client/assets/tiles/world.png', 'r': rects}) + ';\n')
    f.write('window.BOSS_ART = Object.assign(window.BOSS_ART || {}, ' + json.dumps(mons) + ');\n')
print('pieces', len(pieces), 'atlas', atlas.size, 'monsters', len(mons))
