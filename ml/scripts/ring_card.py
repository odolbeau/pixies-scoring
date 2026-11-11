import sys, os, json
sys.path.insert(0, os.path.dirname(__file__))
import numpy as np, ring
n = sys.argv[1]; PAR = [float(x) for x in os.environ.get('PARAMS', '0.05,0.5,0.6,0.07,1.0,0.1').split(',')]
raw = json.load(open(f'ml/photos/det_G/{n}.json'))
lg = len(sys.argv) > 2
g, ev = ring.card_evidence(raw, n, drop_giants=not lg)
f = lambda p, L: ' '.join(f'{int(round(x*9))}' for x in p[::max(1, int(0.03*L))][:14])
for r, c, i in sorted(g['cells']):
    d = g['dets'][i]
    if d['id'] == 'back': continue
    print((r, c), d['id'], d['card'].get('number'), ring.decide(ev[i], *PAR), 'stack' if any(i in v for v in g['covered_by'].values()) is False else '')
    for k, (pw, pn) in ev[i].items():
        L = ring.RW if k in ('left', 'right') else ring.RH
        print('   ', k[0], 'W', f(pw, L), '  NT', f(pn, L))
