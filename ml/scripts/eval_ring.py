"""Évaluation de bout en bout : détection SIFT + cartes recouvertes par la ligne blanche → totaux de manche."""
import sys, os, json
sys.path.insert(0, os.path.dirname(__file__))
import ring
from grid import *
PAR = [float(x) for x in os.environ.get('PARAMS', '0.03,0.5,0.7,0,1.0,0.8').split(',')]
LAB = json.load(open('ml/photos/games/labels.json'))
OUT = os.environ.get('PX_OUT', 'ml/photos/det_G')
okT = 0; n_t = 0; stats = {}
for k in range(1, 16):
    n = f'{k:03d}'; lab = LAB[n + '.jpg']
    lg = 'flowerPowerAndLittleGiants' in lab['totals']
    raw = json.load(open(f'{OUT}/{n}.json'))
    g, ev = ring.card_evidence(raw, n, drop_giants=not lg)
    for i, e in ev.items():
        d = g['dets'][i]
        if not is_back(d) and not is_giant(d) and ring.decide(e, PAR[0], PAR[1], PAR[2], 0.0, 1.0, 0.1, PAR[5]): g['extra_validated'].add(i)
    r = evaluate(g, True, lg)
    sub = lab['subtotals']
    if 'validatedCardsSum' not in sub: sub = sub['flowerPowerAndLittleGiants' if lg else 'flowerPower']
    diffs = []
    for lk, rk in [('validatedCardsSum', 'validated'), ('spirals', 'spirals'), ('crosses', 'crosses'), ('colorZoneSize', 'zone'), ('uncoveredFacedownCards', 'backs'), ('giantsSpirals', 'giants')]:
        if lk in sub and (lg or rk != 'giants'):
            stats.setdefault(rk, [0, 0])[1] += 1
            if sub[lk] != r[rk]: diffs.append(f'{rk} {r[rk]}/{sub[lk]}')
            else: stats[rk][0] += 1
    tk = 'flowerPowerAndLittleGiants' if lg else 'flowerPower' if 'flowerPower' in lab['totals'] else 'base'
    exp = lab['totals'][tk] if tk in lab['totals'] else list(lab['totals'].values())[0]
    ok = r['totals'] == exp
    okT += ok; n_t += 1
    print(n, 'TOTAL OK' if ok else f"{r['totals']} vs {exp}", '|', ', '.join(diffs))
print('totaux exacts', okT, '/', n_t, {k: f'{a}/{b}' for k, (a, b) in stats.items()})
