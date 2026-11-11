import sys, json, os
sys.path.insert(0, os.path.dirname(__file__))
import numpy as np
from grid import *
from residual import non_table_mask
from sift_match import load_photo
n = sys.argv[1]
raw = json.load(open(f'{os.environ.get('PX_OUT','ml/photos/detections')}/{n}.json'))
resid = None
g = build(raw, raw['size'], resid=resid)
dets = g['dets']
print('grille', g['nR'], 'x', g['nC'])
for r, c, i in sorted(g['cells'] + g['giants']):
    d = dets[i]
    print(f"({r},{c}) #{i} {d['id']} n{d['card'].get('number','G')} {''.join(x[0] for x in d['card']['colors'])} inl{d['inliers']} strip{round(g['strip'].get(i,-1),2)} extra={i in g['extra_validated']} covers_det={[j for j in g['covered_by'] if i in g['covered_by'][j]]}")
out = [i for i in range(len(dets)) if i not in [x[2] for x in g['cells'] + g['giants']]]
print('hors grille:', [(i, dets[i]['id'], dets[i]['center'].round(0).tolist(), 'couvert_par', sorted(g['covered_by'][i])) for i in out])
print(json.dumps(json.load(open('ml/photos/games/labels.json'))[n + '.jpg']['subtotals']))
print(evaluate(g, True, True))
