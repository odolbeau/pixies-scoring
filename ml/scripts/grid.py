"""Reconstruction de la grille à partir des détections, puis calcul du score (même règles que src/domain/scoring.ts)."""
import json, math, sys, os
import numpy as np
import cv2

CAT = {c['id']: c for c in json.load(open('ml/photos/catalogue.json'))}
MIN_INL = 8
STRIP_T = 0.75
COLOR_CODE = {'blue': 'b', 'green': 'g', 'yellow': 'y', 'red': 'r'}

def poly_area(p):
    return abs(cv2.contourArea(np.float32(p).reshape(-1, 1, 2)))

def inter_area(a, b):
    ret, poly = cv2.intersectConvexConvex(np.float32(a), np.float32(b))
    return ret if ret > 0 else 0.0

def inside(poly, pts):
    cnt = np.float32(poly).reshape(-1, 1, 2)
    return sum(1 for p in pts if cv2.pointPolygonTest(cnt, (float(p[0]), float(p[1])), False) >= 0)

def is_giant(d): return d['card'].get('set') == 'littleGiants'
def is_back(d): return d['id'] == 'back'

def prep(raw):
    dets = []
    Wd, Hd = raw['size']
    for r in raw['dets']:
        q = np.float32(r['quad'])
        if r['inliers'] < MIN_INL: continue
        box = np.array([[0, 0], [Wd, 0], [Wd, Hd], [0, Hd]], np.float32)
        ia = inter_area(q, box)
        if ia < 0.6 * poly_area(q): continue
        d = dict(id=r['id'], inliers=r['inliers'], quad=q, pts=np.float32(r['pts']), card=CAT.get(r['id'], {'id': 'back', 'set': 'back', 'colors': []}))
        d['center'] = q.mean(0)
        d['w'] = (np.linalg.norm(q[1] - q[0]) + np.linalg.norm(q[2] - q[3])) / 2
        d['h'] = (np.linalg.norm(q[3] - q[0]) + np.linalg.norm(q[2] - q[1])) / 2
        d['up'] = (q[0] - q[3]) + (q[1] - q[2])
        d['area'] = poly_area(q)
        dets.append(d)
    return dets

def stacking(dets):
    """covers[i] = ensemble des j recouverts par i (cartes de même case empilées)."""
    n = len(dets)
    covered_by = {i: set() for i in range(n)}
    for i in range(n):
        for j in range(i + 1, n):
            a, b = dets[i], dets[j]
            if is_giant(a) or is_giant(b): continue
            I = inter_area(a['quad'], b['quad'])
            if I < 0.25 * min(a['area'], b['area']): continue
            # la carte du dessus a ses points visibles dans la zone d'intersection
            ret, poly = cv2.intersectConvexConvex(a['quad'], b['quad'])
            poly = poly.reshape(-1, 2)
            ca, cb = inside(poly, a['pts']), inside(poly, b['pts'])
            top, bot = (i, j) if (ca, a['inliers']) >= (cb, b['inliers']) else (j, i)
            covered_by[bot].add(top)
    return covered_by

def select_grid(dets, covered_by, size):
    tops = [i for i in range(len(dets)) if not covered_by[i]]
    std = [i for i in tops if not is_giant(dets[i]) and not is_back(dets[i])]
    if not std: return [], None
    ups = np.array([dets[i]['up'] for i in std]); up = ups.mean(0); up /= np.linalg.norm(up)
    right = np.array([-up[1], up[0]]); down = -up
    W = np.median([dets[i]['w'] for i in std]); H = np.median([dets[i]['h'] for i in std])
    uv = {i: np.array([dets[i]['center'] @ right, dets[i]['center'] @ down]) for i in tops}
    # composante connexe des cartes du dessus (proximité)
    comp_of = {}
    def near(i, j):
        d = uv[i] - uv[j]
        return abs(d[0]) < 1.7 * W and abs(d[1]) < 1.7 * H
    comps = []
    seen = set()
    for i in tops:
        if i in seen: continue
        stack = [i]; comp = []; seen.add(i)
        while stack:
            k = stack.pop(); comp.append(k)
            for j in tops:
                if j not in seen and near(k, j):
                    seen.add(j); stack.append(j)
        comps.append(comp)
    # on garde la composante la plus riche en cartes standard
    best = max(comps, key=lambda c: (sum(1 for k in c if not is_giant(dets[k]) and not is_back(dets[k])), len(c)))
    return best, dict(right=right, down=down, W=W, H=H, uv=uv)

def cluster(vals, sizes, ratio, kmax=3):
    """Regroupe en au plus `kmax` lignes/colonnes : coupe aux plus grands écarts (relatifs à la taille locale
    des cartes, donc robuste à la perspective) qui dépassent `ratio`."""
    order = sorted(range(len(vals)), key=lambda i: vals[i])
    gaps = sorted(((vals[order[j + 1]] - vals[order[j]]) / ((sizes[order[j]] + sizes[order[j + 1]]) / 2), j)
                  for j in range(len(order) - 1))[::-1]
    cuts = sorted(j for g, j in gaps[:kmax - 1] if g > ratio)
    groups, start = [], 0
    for j in cuts:
        groups.append(order[start:j + 1]); start = j + 1
    groups.append(order[start:])
    return groups

def hidden_card(mask, d, others, step=0.05, span=0.46):
    """Cherche une carte cachée sous `d` : un rectangle de même taille, décalé, dont la partie visible est
    entièrement « hors table » et dont l'extérieur est de la table. Renvoie (score, dx, dy) ou None."""
    h, w = mask.shape
    q = d['quad'].astype(np.float32)
    ex = (q[1] - q[0] + q[2] - q[3]) / 2     # axe horizontal de la carte
    ey = (q[3] - q[0] + q[2] - q[1]) / 2     # axe vertical
    pad = int(0.7 * max(d['w'], d['h']))
    x0, y0 = np.floor(q.min(0)).astype(int) - pad; x1, y1 = np.ceil(q.max(0)).astype(int) + pad
    x0, y0 = max(0, x0), max(0, y0); x1, y1 = min(w, x1), min(h, y1)
    nt = mask[y0:y1, x0:x1] > 0
    oth = others[y0:y1, x0:x1]
    off = np.array([x0, y0], np.float32)
    A = np.zeros(nt.shape, np.uint8); cv2.fillPoly(A, [(q - off).astype(np.int32)], 255)
    A = cv2.dilate(A, np.ones((9, 9), np.uint8)) > 0
    area = d['area']; r = max(5, int(0.05 * d['w']))
    best = None
    for fy in np.arange(-span, span + 1e-6, step):
        for fx in np.arange(-span, span + 1e-6, step):
            if abs(fx) < 0.08 and abs(fy) < 0.08: continue
            S = np.zeros(nt.shape, np.uint8)
            cv2.fillPoly(S, [(q + fx * ex + fy * ey - off).astype(np.int32)], 255)
            Sb = S > 0
            vis = Sb & ~A & ~oth
            nvis = int(vis.sum())
            if nvis < 0.035 * area: continue
            cover = float(nt[vis].mean())
            if cover < 0.88: continue
            ring = (cv2.dilate(S, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))) > 0) & ~Sb & ~A & ~oth
            if ring.sum() < 40: continue
            table = 1.0 - float(nt[ring].mean())
            if table < 0.7: continue
            sc = cover + table + min(1.0, nvis / (0.15 * area))
            if best is None or sc > best[0]: best = (sc, float(fx), float(fy))
    return best

def build(raw, size, drop_giants=False, resid=None):
    """resid : masque « hors table » (pas le résidu)."""
    dets = prep(raw)
    covered_by = stacking(dets)
    comp, ax = select_grid(dets, covered_by, size)
    if ax is None: return None
    if drop_giants: comp = [i for i in comp if not is_giant(dets[i])]
    uv = ax['uv']; W, H = ax['W'], ax['H']
    gridc = [i for i in comp if not is_giant(dets[i])]
    giants = [i for i in comp if is_giant(dets[i])]
    if not gridc: return None
    rows = cluster([uv[i][1] for i in gridc], [dets[i]['h'] for i in gridc], 0.4)
    cols = cluster([uv[i][0] for i in gridc], [dets[i]['w'] for i in gridc], 0.4)
    cell = {}
    rowpos = [np.mean([uv[gridc[k]][1] for k in g]) for g in rows]
    colpos = [np.mean([uv[gridc[k]][0] for k in g]) for g in cols]
    for ri, g in enumerate(rows):
        for k in g: cell[gridc[k]] = [ri, None]
    for ci, g in enumerate(cols):
        for k in g: cell[gridc[k]][1] = ci
    nR, nC = len(rows), len(cols)
    placed = []  # (row, col, det index, kind)
    for i, (r, c) in cell.items(): placed.append((r, c, i))
    gpl = []
    for i in giants:
        u, v = uv[i]
        direction = dets[i]['card']['direction']
        if direction == 'column':
            c = int(np.argmin([abs(u - x) for x in colpos]))
            r = -1 if v < np.mean(rowpos) else nR
            gpl.append((r, c, i))
        else:
            r = int(np.argmin([abs(v - x) for x in rowpos]))
            c = -1 if u < np.mean(colpos) else nC
            gpl.append((r, c, i))
    extra = set()
    strip = {}
    if resid is not None:
        for i in range(len(dets)):
            if is_giant(dets[i]) or is_back(dets[i]) or i not in cell: continue
            others = np.zeros(resid.shape, bool)
            om = np.zeros(resid.shape, np.uint8)
            for j, dj in enumerate(dets):
                if j != i: cv2.fillPoly(om, [dj['quad'].astype(np.int32)], 255)
            others = om > 0
            hc = hidden_card(resid, dets[i], others)
            strip[i] = hc[0] if hc else 0.0
            if hc: extra.add(i)
    return dict(dets=dets, covered_by=covered_by, cells=placed, giants=gpl, nR=nR, nC=nC, extra_validated=extra, strip=strip)

def has_spiral_symbol(card):
    if card.get('spirals', 0) > 0: return True
    b = card.get('bonus')
    return bool(b and b['kind'] in ('spiralsPerColor', 'spiralsPerFacedown'))

def evaluate(g, flower, giants_on):
    dets = g['dets']; covered_by = g['covered_by']
    covers = {i: [j for j in covered_by if i in covered_by[j]] for i in range(len(dets))}
    grid = {}
    for r, c, i in g['cells'] + g['giants']: grid[(r, c)] = i
    gridcells = [(r, c, i) for r, c, i in g['cells']]
    visible = [(r, c, i) for r, c, i in g['cells'] + g['giants'] if not is_back(dets[i])]
    def colors(i): return set(COLOR_CODE[x] for x in dets[i]['card'].get('colors', []))
    def validated(i): return i in g['extra_validated'] or len([j for j in covers[i] if not is_giant(dets[j])]) > 0
    uncovered_backs = [i for r, c, i in g['cells'] if is_back(dets[i])]
    validated_sum = sum(dets[i]['card']['number'] for r, c, i in gridcells if not is_back(dets[i]) and validated(i))
    colorcount = {k: 0 for k in 'bgyr'}
    for r, c, i in visible:
        for k in colors(i): colorcount[k] += 1
    spirals = 0; crosses = 0
    # croix annulées : par Géant de ligne « cancelCrosses »
    cancelled_rows = {r for r, c, i in g['giants'] if giants_on and dets[i]['card']['effect']['kind'] == 'cancelCrosses'}
    nback = len(uncovered_backs) if flower else 0
    for r, c, i in gridcells:
        d = dets[i]
        if is_back(d): continue
        card = d['card']
        spirals += card.get('spirals', 0)
        cr = card.get('crosses', 0)
        b = card.get('bonus')
        if b:
            if b['kind'] == 'spiralsPerColor': spirals += b['spirals'] * colorcount[COLOR_CODE[b['color']]]
            elif b['kind'] == 'spiralsPerFacedown': spirals += b['spirals'] * nback
            elif b['kind'] == 'crossesPerColor': cr += b['crosses'] * colorcount[COLOR_CODE[b['color']]]
        if r in cancelled_rows: cr = 0
        crosses += cr
    gsp = 0
    if giants_on:
        for gr, gc, gi in g['giants']:
            e = dets[gi]['card']['effect']; k = e['kind']
            if k == 'perColor':
                n = sum(1 for r, c, i in visible if r == gr and COLOR_CODE[e['color']] in colors(i))
                gsp += e['spirals'] * n
            elif k in ('perValidated', 'perSpiralless', 'perNotValidated'):
                if dets[gi]['card']['direction'] == 'column':
                    members = [i for r, c, i in gridcells if c == gc and not is_back(dets[i])]
                else:
                    members = [i for r, c, i in gridcells if r == gr and not is_back(dets[i])]
                if k == 'perValidated': n = sum(1 for i in members if validated(i))
                elif k == 'perSpiralless': n = sum(1 for i in members if not has_spiral_symbol(dets[i]['card']))
                else: n = sum(1 for i in members if not validated(i))
                gsp += e['spirals'] * n
    # zone : composantes connexes par couleur
    cellcol = {(r, c): colors(i) for r, c, i in visible}
    best = 0
    for k in 'bgyr':
        todo = {p for p, cs in cellcol.items() if k in cs}
        while todo:
            p = todo.pop(); comp = 1; stack = [p]
            while stack:
                a = stack.pop()
                for d in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    q = (a[0] + d[0], a[1] + d[1])
                    if q in todo: todo.remove(q); comp += 1; stack.append(q)
            best = max(best, comp)
    spirals_total = spirals + nback * 5 + gsp
    base = validated_sum + spirals_total - crosses
    return dict(validated=validated_sum, spirals=spirals, backs=nback, giants=gsp, crosses=crosses, zone=best,
                totals=[base + best * m for m in (2, 3, 4)])
