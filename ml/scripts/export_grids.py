"""Exporte, pour les tests TypeScript, les grilles photographiées dont la reconnaissance reproduit exactement
les sous-totaux et totaux saisis par l'utilisateur. Seuls des identifiants de cartes et des positions sont écrits."""
import sys, os, json
sys.path.insert(0, os.path.dirname(__file__))
import ring
from grid import *
LAB = json.load(open('ml/photos/games/labels.json'))
OUT = os.environ.get('PX_OUT', 'ml/photos/det_G')
PAR = [0.03, 0.5, 0.7, 0, 1.0, 0.1, 0.8]
KEYS = [('base', False, False), ('flowerPower', True, False), ('flowerPowerAndLittleGiants', True, True)]
PAIRS = [('validatedCardsSum', 'validated'), ('spirals', 'spirals'), ('crosses', 'crosses'), ('colorZoneSize', 'zone'),
         ('uncoveredFacedownCards', 'backs'), ('giantsSpirals', 'giants')]
out = []
for k in range(1, 16):
    n = f'{k:03d}'; lab = LAB[n + '.jpg']
    for key, flower, lg in KEYS:
        if key not in lab['totals']: continue
        sub = lab['subtotals'] if 'validatedCardsSum' in lab['subtotals'] else lab['subtotals'][key]
        raw = json.load(open(f'{OUT}/{n}.json'))
        g, ev = ring.card_evidence(raw, n, drop_giants=not lg)
        dets = g['dets']
        for i, e in ev.items():
            d = dets[i]
            if not is_back(d) and not is_giant(d) and ring.decide(e, PAR[0], PAR[1], PAR[2], 0.0, 1.0, 0.1, PAR[6]): g['extra_validated'].add(i)
        r = evaluate(g, flower, lg)
        good = all(sub[a] == r[b] for a, b in PAIRS if a in sub and (lg or b != 'giants')) and r['totals'] == lab['totals'][key]
        if not good or g['nR'] != 3 or g['nC'] != 3: print(n, key, 'ignorée'); continue
        covers = {i: any(i in g['covered_by'][j] and not is_giant(dets[j]) for j in g['covered_by']) or i in g['extra_validated'] for i in range(len(dets))}
        # remet la grille à l'endroit : Géants de ligne à gauche, Géants de colonne en haut
        far = [(r_, c_) for r_, c_, i in g['giants'] if (is_giant(dets[i]) and ((dets[i]['card']['direction'] == 'row' and c_ >= 3) or (dets[i]['card']['direction'] == 'column' and r_ >= 3)))]
        near = [1 for r_, c_, i in g['giants'] if (dets[i]['card']['direction'] == 'row' and c_ < 0) or (dets[i]['card']['direction'] == 'column' and r_ < 0)]
        if far and near: print(n, key, 'Géants des deux côtés'); continue
        flip = bool(far)
        slots = [{'kind': 'empty'} for _ in range(9)]
        for r_, c_, i in g['cells']:
            if flip: r_, c_ = 2 - r_, 2 - c_
            d = dets[i]
            slots[r_ * 3 + c_] = {'kind': 'facedown'} if is_back(d) else {'kind': 'card', 'cardId': d['id'], 'covers': bool(covers[i])}
        giants = []
        for r_, c_, i in g['giants']:
            d = dets[i]
            idx = (2 - r_ if flip else r_) if d['card']['direction'] == 'row' else (2 - c_ if flip else c_)
            giants.append({'cardId': d['id'], 'index': idx})
        out.append({'photo': n, 'variant': key, 'slots': slots, 'giants': giants,
                    'expected': {'subtotals': {a: sub[a] for a, _ in PAIRS if a in sub}, 'totals': lab['totals'][key]}})
json.dump(out, open('src/domain/photoGrids.fixture.json', 'w'), indent=1)
print(len(out), 'grilles exportées')
