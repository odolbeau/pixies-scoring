import sys, os, json
sys.path.insert(0, os.path.dirname(__file__))
import numpy as np
from grid import *
from residual import non_table_mask
from sift_match import load_photo
LAB = json.load(open('ml/photos/games/labels.json'))
def tgt(n, lg):
    s = LAB[n + '.jpg']['subtotals']
    if 'validatedCardsSum' not in s: s = s['flowerPowerAndLittleGiants' if lg else 'flowerPower']
    return s['validatedCardsSum']
ok = 0
for k in range(1, 16):
    n = f'{k:03d}'
    lg = 'flowerPowerAndLittleGiants' in LAB[n + '.jpg']['totals']
    raw = json.load(open(f'ml/photos/det_G/{n}.json'))
    img = load_photo(f'ml/photos/games/{n}.jpg')
    g0 = build(raw, raw['size'], drop_giants=not lg)
    m = non_table_mask(img, [d['quad'] for d in g0['dets']])
    g = build(raw, raw['size'], drop_giants=not lg, resid=m)
    r = evaluate(g, True, lg)
    t = tgt(n, lg)
    names = [f"{g['dets'][i]['card'].get('number')}" for i in sorted(g['extra_validated'])]
    print(n, 'OK' if r['validated'] == t else f"{r['validated']} vs {t}", 'extra', names)
    ok += r['validated'] == t
print(ok, '/ 15')
