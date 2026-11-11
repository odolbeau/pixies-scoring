"""Test « la carte recouvre-t-elle une autre carte ? » : cherche, juste à l'extérieur de chaque côté, la ligne blanche
du bord d'une carte cachée, parallèle au côté, sur presque toute sa longueur."""
import sys, os, json
sys.path.insert(0, os.path.dirname(__file__))
import numpy as np, cv2
from grid import *
from sift_match import load_photo
from residual import non_table_mask

RW, RH = 200, 280      # taille du redressement de la carte (px)
MARG = 0.45            # marge explorée autour de la carte (fraction)

def white_map(img):
    """Pixels « blanc de bord de carte » : peu saturés et clairs, ou nettement plus clairs que leur voisinage
    (photo sombre, ombre portée) — chapeau haut-de-forme sur la luminosité."""
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    s, v = hsv[..., 1].astype(np.float32), hsv[..., 2].astype(np.float32)
    absolute = (s < 60) & (v > 150)
    if os.environ.get('WM', 'abs') == 'abs': return absolute.astype(np.float32)
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (17, 17))
    th = cv2.morphologyEx(hsv[..., 2], cv2.MORPH_TOPHAT, k).astype(np.float32)
    rel = (s < 70) & (th > float(os.environ.get('TH', 28))) & (v > 90)
    return (absolute | rel).astype(np.float32)

def side_evidence(wm, ntm, quad, others_mask):
    """Renvoie, pour chaque côté (haut, droite, bas, gauche), (evidence, offset) dans le repère de la carte."""
    q = np.float32(quad)
    mx, my = int(RW * MARG), int(RH * MARG)
    dst = np.float32([[mx, my], [mx + RW, my], [mx + RW, my + RH], [mx, my + RH]])
    M = cv2.getPerspectiveTransform(q, dst)
    size = (RW + 2 * mx, RH + 2 * my)
    w = cv2.warpPerspective(wm, M, size, flags=cv2.INTER_LINEAR)
    nt = cv2.warpPerspective(ntm, M, size, flags=cv2.INTER_LINEAR)
    known = 1.0 - cv2.warpPerspective(others_mask.astype(np.float32), M, size, flags=cv2.INTER_NEAREST)
    inb = cv2.warpPerspective(np.ones_like(wm), M, size)   # dans l'image
    known = known * (inb > 0.99)
    def prof(a, k):  # a, k : [distance, le long du côté]
        n = a.shape[1]; lo, hi = int(n * 0.12), int(n * 0.88)
        sa, sk = a[:, lo:hi], k[:, lo:hi]
        kn = sk.sum(1)
        p = np.where(kn > 0.5 * sa.shape[1], (sa * sk).sum(1) / np.maximum(kn, 1), 0)
        return np.convolve(p, np.ones(3) / 3, 'same')
    def sides(m):
        return {'top': (m[:my][::-1], known[:my][::-1]), 'bottom': (m[my + RH:], known[my + RH:]),
                'left': (m[:, :mx][:, ::-1].T, known[:, :mx][:, ::-1].T), 'right': (m[:, mx + RW:].T, known[:, mx + RW:].T)}
    sw, sn = sides(w), sides(nt)
    return {k: (prof(*sw[k]), prof(*sn[k])) for k in sw}

def decide(prof, lo=0.03, T=0.6, ntT=0.6, near=0.0, sl=1.0, sw=0.1, thin=0.6):
    """prof : {côté: (profil blanc, profil non-table)}. Vrai si une ligne blanche fine, parallèle au côté,
    borde (jusqu'à la carte) une zone non-table : le bord d'une carte cachée qui dépasse."""
    for k, (pw, pn) in prof.items():
        L = RW if k in ('left', 'right') else RH
        for d in range(int(lo * L), len(pw)):
            if pw[d] < T: continue
            if pw[d] < pw[max(d - 1, 0)] or pw[d] < pw[min(d + 1, len(pw) - 1)]: continue
            beyond = pw[d + int(0.05 * L): d + int(0.10 * L) + 1]
            if len(beyond) and beyond.mean() > thin * pw[d]: continue    # plateau blanc (nappe, reflet) et non une ligne
            a, b = int(0.012 * L), int(d + 0.012 * L)
            if pn[a:b].mean() >= ntT: return True
    return False

def card_evidence(raw, n, img=None, wm=None, drop_giants=False):
    g = build(raw, raw['size'], drop_giants=drop_giants)
    if g is None: return None, None
    dets = g['dets']
    if img is None: img = load_photo(f'ml/photos/games/{n}.jpg')
    if isinstance(img, tuple): img = img[0]
    if wm is None: wm = white_map(img)
    ntm = non_table_mask(img, [d['quad'] for d in dets]).astype(np.float32) / 255.0
    ev = {}
    for r, c, i in g['cells']:
        d = dets[i]
        om = np.zeros(wm.shape, np.uint8)
        for j, dj in enumerate(dets):
            if j == i: continue
            qc = dj['quad'].mean(0)
            cv2.fillPoly(om, [((dj['quad'] - qc) * 1.06 + qc).astype(np.int32)], 1)
        ev[i] = side_evidence(wm, ntm, d['quad'], om > 0)
    return g, ev

if __name__ == '__main__':
    n = sys.argv[1]
    raw = json.load(open(f"{os.environ.get('PX_OUT','ml/photos/det_G')}/{n}.json"))
    g, ev = card_evidence(raw, n)
    for r, c, i in sorted(g['cells']):
        print(f"({r},{c}) {g['dets'][i]['id']:10s}", decide(ev[i]))
