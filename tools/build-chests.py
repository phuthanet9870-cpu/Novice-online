#!/usr/bin/env python3
"""Slices the treasure chest / key sheet (2 rows x 6 tiers) into client/assets/items/chest_N.png and key_N.png (64 px icons)
plus 96 px world sprites chest_wN.png. usage: python3 tools/build-chests.py <sheet.png>"""
import sys
from PIL import Image
im = Image.open(sys.argv[1]).convert('RGBA'); W, H = im.size
A = im.split()[3]
def runs(vals):
    out, s = [], None
    for i, v in enumerate(vals + [0]):
        if v and s is None: s = i
        if not v and s is not None: out.append((s, i)); s = None
    return out
px = A.load()
rows = runs([1 if any(px[x, y] > 20 for x in range(0, W, 2)) else 0 for y in range(H)])
rows = [r for r in rows if r[1] - r[0] > 40]
assert len(rows) == 2, rows
for name, (y0, y1) in zip(['chest', 'key'], rows):
    cols = runs([1 if any(px[x, y] > 20 for y in range(y0, y1, 2)) else 0 for x in range(W)])
    cols = [c for c in cols if c[1] - c[0] > 30]
    assert len(cols) == 6, (name, cols)
    for i, (x0, x1) in enumerate(cols):
        t = im.crop((x0, y0, x1, y1)); t = t.crop(t.getbbox())
        for size, suffix in [(64, ''), (96, '_w')]:
            k = size / max(t.size); s = t.resize((max(1, round(t.width * k)), max(1, round(t.height * k))), Image.LANCZOS)
            c = Image.new('RGBA', (size, size)); c.alpha_composite(s, ((size - s.width) // 2, (size - s.height) // 2 if name == 'key' else size - s.height))
            if name == 'key' and suffix: continue
            c.save(f'client/assets/items/{name}{suffix}_{i}.png', optimize=True)
print('ok')
