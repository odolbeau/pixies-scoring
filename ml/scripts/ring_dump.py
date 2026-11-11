import sys, os, json
sys.path.insert(0, os.path.dirname(__file__))
import numpy as np, ring
n = sys.argv[1]
raw = json.load(open(f"ml/photos/det_G/{n}.json"))
g, ev = ring.card_evidence(raw, n)
for r, c, i in sorted(g['cells']):
    print(f"({r},{c}) {g['dets'][i]['id']}")
    for k, (pw, pn) in ev[i].items():
        L = ring.RW if k in ('left', 'right') else ring.RH
        f = lambda p: ' '.join(f'{int(round(x*9))}' for x in p[::max(1, int(0.03*L))][:16])
        print(f"   {k:6s} W {f(pw)}   NT {f(pn)}")
