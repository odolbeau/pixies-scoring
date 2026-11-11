"""Compare les totaux calculés automatiquement avec ceux du joueur (labels.json)."""
import json, sys, os
sys.path.insert(0, os.path.dirname(__file__))
import cv2, numpy as np
from grid import build, evaluate
from residual import non_table_mask
from sift_match import load_photo

labels = json.load(open('ml/photos/games/labels.json'))
KEYS = {'base': (False, False), 'flowerPower': (True, False), 'flowerPowerAndLittleGiants': (True, True)}
ok = tot = 0
for name in sorted(labels):
    n = name[:-4]
    raw = json.load(open(f'ml/photos/detections/{n}.json'))
    img = load_photo(f'ml/photos/games/{n}.jpg')
    resid = non_table_mask(img, [np.float32(d['quad']) for d in raw['dets']])
    for key, truth in labels[name]['totals'].items():
        flower, lg = KEYS[key]
        g = build(raw, raw['size'], drop_giants=not lg, resid=None)
        if g is None:
            print(n, key, 'AUCUNE GRILLE'); tot += 1; continue
        r = evaluate(g, flower, lg)
        good = r['totals'] == truth
        ok += good; tot += 1
        print(f"{n} {key:28s} {'OK ' if good else 'KO '} attendu {truth} calculé {r['totals']}  [valid {r['validated']} spir {r['spirals']} dos {r['backs']} géants {r['giants']} croix {r['crosses']} zone {r['zone']}]")
print(f'{ok}/{tot}')
