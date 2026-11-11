import sys, os, json, itertools
sys.path.insert(0, os.path.dirname(__file__))
import numpy as np
import ring
from grid import *
LAB = json.load(open('ml/photos/games/labels.json'))
OUT = os.environ.get('PX_OUT', 'ml/photos/det_G')
# profils conservés pour pouvoir régler les seuils sans tout recalculer
data = {}
for n in [f'{k:03d}' for k in range(1, 16)]:
    raw = json.load(open(f'{OUT}/{n}.json'))
    lg = 'flowerPowerAndLittleGiants' in LAB[n + '.jpg']['totals']
    g, ev = ring.card_evidence(raw, n, drop_giants=not lg)
    if g is None: continue
    data[n] = (g, ev, lg)
def predict(n, lo, T, ntT=0.6, near=0.0, sl=1.0, sw=0.1):
    g, ev, lg = data[n]
    dets = g['dets']
    g2 = dict(g); extra = set(g['extra_validated'])
    for i, e in ev.items():
        d = dets[i]
        if is_back(d) or is_giant(d): continue
        if ring.decide(e, lo, T, ntT, 0.0, 1.0, 0.1, sw): extra.add(i)
    g2['extra_validated'] = extra
    return evaluate(g2, True, lg)
def target(n):
    s = LAB[n + '.jpg']['subtotals']
    if 'validatedCardsSum' not in s: s = s['flowerPowerAndLittleGiants' if data[n][2] else 'flowerPower']
    return s['validatedCardsSum']
best = []
for lo in (0.03, 0.05):
  for T in (0.4, 0.5, 0.6, 0.7):
    for ntT in (0.5, 0.6, 0.7, 0.8):
      for thin in (0.4, 0.6, 0.8, 1.01):
        P = {n: predict(n, lo, T, ntT, 0, 1.0, thin)['validated'] for n in data}
        ok = sum(P[n] == target(n) for n in data)
        err = sum(abs(P[n] - target(n)) for n in data)
        best.append((ok, -err, lo, T, ntT, thin))
best.sort(reverse=True)
for b in best[:8]: print(b)
print('---')
lo, T, ntT, near, sl, sw = [float(x) for x in os.environ.get('PARAMS', '0.05,0.5,0.6,0,1.0,0.6').split(',')]
for n in data:
    p = predict(n, lo, T, ntT, near, sl, sw)['validated']; t = target(n)
    print(n, 'OK' if p == t else f'{p} vs {t}')
