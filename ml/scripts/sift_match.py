"""Identification des cartes d'une photo par correspondance de points SIFT + homographie (RANSAC), sans détection préalable."""
import json, sys, os, cv2, numpy as np
sys.path.insert(0, os.path.dirname(__file__))
from PIL import Image, ImageOps

REFS = 'ml/photos/refs_final'
sift_ref = cv2.SIFT_create(nfeatures=2500, contrastThreshold=0.02)
sift_ph = cv2.SIFT_create(nfeatures=int(os.environ.get('PX_NF', 9000)), contrastThreshold=0.015)
flann = cv2.FlannBasedMatcher(dict(algorithm=1, trees=4), dict(checks=48))

def load_refs():
    refs = []
    cat = json.load(open('ml/photos/catalogue.json'))
    items = [(c['id'], f'{REFS}/{c["id"]}.png', c) for c in cat]
    items.append(('back', 'ml/photos/refs/back.png', {'id': 'back', 'set': 'back', 'colors': []}))
    for id_, path, c in items:
        img = cv2.imread(path, cv2.IMREAD_GRAYSCALE)
        kp, des = sift_ref.detectAndCompute(img, None)
        refs.append(dict(id=id_, card=c, kp=kp, des=des, size=img.shape[::-1], img=img))
    return refs

def load_photo(path, width=int(os.environ.get('PX_WIDTH', 1600))):
    im = ImageOps.exif_transpose(Image.open(path)).convert('RGB')
    a = cv2.cvtColor(np.array(im), cv2.COLOR_RGB2BGR)
    h, w = a.shape[:2]
    s = min(1.0, width / max(h, w))
    return cv2.resize(a, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)

def instances(ref, matcher_idx, pts_p, min_inliers, max_inst=3):
    """Plusieurs instances d'une même carte : RANSAC répété en retirant les inliers."""
    out = []
    pool = list(matcher_idx)
    src_all = {i: ref['kp'][q].pt for i, (q, t) in enumerate(pool)}
    alive = np.ones(len(pool), bool)
    for _ in range(max_inst):
        idx = np.where(alive)[0]
        if len(idx) < min_inliers: break
        src = np.float32([ref['kp'][pool[i][0]].pt for i in idx]).reshape(-1, 1, 2)
        dst = np.float32([pts_p[pool[i][1]] for i in idx]).reshape(-1, 1, 2)
        H, mask = cv2.findHomography(src, dst, cv2.RANSAC, 6.0)
        if H is None: break
        inl = mask.ravel().astype(bool)
        if inl.sum() < min_inliers: break
        w, h = ref['size']
        quad = cv2.perspectiveTransform(np.float32([[0, 0], [w, 0], [w, h], [0, h]]).reshape(-1, 1, 2), H).reshape(4, 2)
        if cv2.isContourConvex(quad.reshape(-1, 1, 2).astype(np.float32)):
            out.append(dict(inliers=int(inl.sum()), quad=quad, pts=dst[inl].reshape(-1, 2), H=H))
        alive[idx[inl]] = False
    return out

def _iou(a, b):
    ret, _ = cv2.intersectConvexConvex(np.float32(a), np.float32(b))
    if ret <= 0: return 0.0
    aa, bb = abs(cv2.contourArea(np.float32(a))), abs(cv2.contourArea(np.float32(b)))
    return ret / (aa + bb - ret + 1e-6)

def _in_quad(quad, pts, shrink=0.92):
    c = quad.mean(0); q = ((quad - c) * shrink + c).astype(np.float32).reshape(-1, 1, 2)
    return np.array([cv2.pointPolygonTest(q, (float(x), float(y)), False) >= 0 for x, y in pts])

RATIO = float(os.environ.get('PX_RATIO', 0.82))

def detect(photo_bgr, refs, min_inliers=int(os.environ.get('PX_MINI', 12)), min_back=int(os.environ.get('PX_MINB', 8))):
    gray = cv2.cvtColor(photo_bgr, cv2.COLOR_BGR2GRAY)
    kp_p, des_p = sift_ph.detectAndCompute(gray, None)
    pts_p = np.float32([k.pt for k in kp_p])
    cands = []
    for r in refs:
        mi = min_back if r['id'] == 'back' else min_inliers
        m = flann.knnMatch(r['des'], des_p, k=2)
        good = [(a.queryIdx, a.trainIdx) for a, b in (x for x in m if len(x) == 2) if a.distance < RATIO * b.distance]
        if len(good) < mi: continue
        for inst in instances(r, good, pts_p, mi):
            cands.append(dict(id=r['id'], card=r['card'], **inst))
    cands.sort(key=lambda c: -c['inliers'])
    # taille de référence : médiane des détections solides
    strong = [c for c in cands if c['inliers'] >= 60]
    dims = [np.linalg.norm(c['quad'][3] - c['quad'][0]) for c in strong] or [np.linalg.norm(cands[0]['quad'][3] - cands[0]['quad'][0])]
    H0 = float(np.median(dims))
    keep = []
    for c in cands:
        hq = np.linalg.norm(c['quad'][3] - c['quad'][0]) + np.linalg.norm(c['quad'][2] - c['quad'][1])
        if not (0.55 * H0 < hq / 2 < 1.8 * H0): continue
        wq = (np.linalg.norm(c['quad'][1] - c['quad'][0]) + np.linalg.norm(c['quad'][2] - c['quad'][3])) / 2
        if not (0.4 < wq / (hq / 2) < 2.0): continue
        grp = [k for k in keep if _iou(c['quad'], k['quad']) > 0.85]
        if grp:
            g0 = grp[0]
            if c['id'] != 'back' and g0['id'] != 'back' and c['inliers'] >= 0.2 * g0['inliers']:
                g0.setdefault('alts', []).append(c)
            continue
        # carte partiellement cachée : ses points ne doivent pas être sous une carte déjà acceptée,
        # sauf si c'est elle qui est dessus (ses points sont dans l'autre quad, pas l'inverse)
        inside = np.zeros(len(c['pts']), bool)
        dup = False; over = False
        for k in keep:
            ic = _in_quad(k['quad'], c['pts'])
            inside |= ic
            if ic.mean() > 0.4:
                if _in_quad(c['quad'], k['pts']).mean() > 0.4: dup = True
                else: over = True
        if dup: continue
        if over and c['inliers'] < 25: continue
        if inside.mean() > 0.4 and not over: continue
        if c['inliers'] < 25 and not (c['id'] == 'back' or inside.mean() == 0): continue
        keep.append(c)
    refs_by_id = {r['id']: r for r in refs}
    for idx, k in enumerate(keep):
        alts = k.pop('alts', [])
        if alts:
            keep[idx] = pick_variant(gray, k, alts, refs_by_id)
    return keep

def symbol_error(gray, ref, H):
    """Écart entre la carte redressée et la référence sur les bandes de symboles (haut et bas de la carte)."""
    w, h = ref['size']
    wp = cv2.warpPerspective(gray, np.linalg.inv(H), (w, h))
    bands = [(0, int(0.26 * h)), (int(0.86 * h), h)]
    err = 0.0
    for y0, y1 in bands:
        a = cv2.GaussianBlur(wp[y0:y1], (0, 0), 1.5).astype(np.float32).ravel()
        b = cv2.GaussianBlur(ref['img'][y0:y1], (0, 0), 1.5).astype(np.float32).ravel()
        a = (a - a.mean()) / (a.std() + 1e-3); b = (b - b.mean()) / (b.std() + 1e-3)
        err += float(np.mean((a - b) ** 2)) * (y1 - y0)
    return err

def overlay(photo, dets, path):
    vis = photo.copy()
    for x in dets:
        q = x['quad'].astype(int)
        cv2.polylines(vis, [q], True, (0, 0, 255), 3)
        c = x['card']
        lab = 'BACK' if x['id'] == 'back' else f"{x['id']} n{c.get('number', 'G')}{''.join(k[0] for k in c['colors'])}"
        cv2.putText(vis, f"{lab} ({x['inliers']})", tuple(q[0]), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 0, 255), 3)
    cv2.imwrite(path, cv2.resize(vis, None, fx=0.6, fy=0.6))

_K = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))

def _tophat(g, s=1.0):
    return cv2.morphologyEx(cv2.GaussianBlur(g, (0, 0), s), cv2.MORPH_TOPHAT, _K).astype(np.float32)

def _best_corr(tp, ta, mask, shift=3):
    best = -1.0
    ys, xs = np.where(mask)
    if len(ys) < 30: return 0.0
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    m = mask[y0:y1, x0:x1]
    a = tp[y0:y1, x0:x1][m]; a = a - a.mean()
    for dy in range(-shift, shift + 1):
        for dx in range(-shift, shift + 1):
            sh = np.roll(np.roll(ta, dy, 0), dx, 1)[y0:y1, x0:x1][m]
            b = sh - sh.mean()
            best = max(best, float((a * b).sum() / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-6)))
    return best

def pick_variant(gray, k, alts, refs_by_id):
    """Départage des cartes de même illustration en comparant les symboles qui diffèrent entre variantes."""
    cands = [k] + alts
    H_, W_ = gray.shape
    quad = np.mean([c['quad'] for c in cands], axis=0)
    x0, y0 = np.floor(quad.min(0)).astype(int) - 6; x1, y1 = np.ceil(quad.max(0)).astype(int) + 6
    x0, y0 = max(0, x0), max(0, y0); x1, y1 = min(W_, x1), min(H_, y1)
    if x1 - x0 < 40 or y1 - y0 < 40: return k
    inq = np.zeros((H_, W_), np.uint8); cv2.fillPoly(inq, [quad.astype(np.int32)], 255)
    inq = cv2.erode(inq, np.ones((9, 9), np.uint8))[y0:y1, x0:x1] > 0
    tp = _tophat(gray)[y0:y1, x0:x1]
    tops = []
    for c in cands:
        r = refs_by_id[c['id']]
        warped = cv2.warpPerspective(r['img'], c['H'], (W_, H_))[y0:y1, x0:x1]
        tops.append(_tophat(warped))
    stack = np.stack(tops)
    diff = (stack.max(0) - stack.min(0))
    rw, rh = refs_by_id[k['id']]['size']
    zone = np.zeros((rh, rw), np.uint8)
    for fx0, fx1, fy0, fy1 in ((0.03, 0.40, 0.02, 0.20), (0.03, 0.22, 0.02, 0.50), (0.70, 0.97, 0.02, 0.45), (0.04, 0.55, 0.87, 0.98)):
        zone[int(fy0 * rh):int(fy1 * rh), int(fx0 * rw):int(fx1 * rw)] = 255
    zmask = cv2.warpPerspective(zone, k['H'], (W_, H_))[y0:y1, x0:x1] > 0
    D = (diff > max(10.0, 0.5 * np.percentile(diff[inq], 99))) & inq & zmask
    D = cv2.dilate(D.astype(np.uint8), np.ones((5, 5), np.uint8)).astype(bool) & inq
    scores = [_best_corr(tp, t, D) for t in tops]
    return cands[int(np.argmax(scores))]
