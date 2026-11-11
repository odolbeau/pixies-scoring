"""Compare, photo par photo, chaque sous-total calculé avec le sous-total étiqueté."""
import json, sys, os
sys.path.insert(0, os.path.dirname(__file__))
import numpy as np
from grid import build, evaluate
from residual import non_table_mask
from sift_match import load_photo
DIR = os.environ.get('PX_OUT', 'ml/photos/detections')
stats = {}
labels = json.load(open('ml/photos/games/labels.json'))
for name in sorted(labels):
    n = name[:-4]; sub = labels[name]['subtotals']
    raw = json.load(open(f'{DIR}/{n}.json'))
    m = None
    keys = labels[name]['totals'].keys()
    lg = 'flowerPowerAndLittleGiants' in keys
    g = build(raw, raw['size'], drop_giants=not lg, resid=None)
    r = evaluate(g, True, lg)
    pairs = [('validatedCardsSum', 'validated'), ('spirals', 'spirals'), ('crosses', 'crosses'), ('colorZoneSize', 'zone'), ('uncoveredFacedownCards', 'backs'), ('giantsSpirals', 'giants')]
    diffs = []
    for lk, rk in pairs:
        if lk in sub and isinstance(sub[lk], (int, float)) and (lg or rk != 'giants'):
            stats.setdefault(rk, [0, 0])[1] += 1
            if sub[lk] != r[rk]: diffs.append(f'{rk}: {r[rk]} (attendu {sub[lk]})')
            else: stats[rk][0] += 1
    print(n, 'OK' if not diffs else ' | '.join(diffs))

print('RÉSUMÉ', {k: f'{a}/{b}' for k, (a, b) in stats.items()})
