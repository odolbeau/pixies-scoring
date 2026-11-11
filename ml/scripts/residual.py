"""Pixels 'hors table' non expliqués par les cartes détectées : cartes cachées qui dépassent."""
import numpy as np, cv2

def non_table_mask(img, quads):
    h, w = img.shape[:2]
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB).astype(np.float32)
    lab = cv2.GaussianBlur(lab, (0, 0), 2)
    near = np.zeros((h, w), np.uint8)
    for q in quads:
        c = q.mean(0)
        cv2.fillPoly(near, [((q - c) * 1.25 + c).astype(np.int32)], 255)
    near = cv2.dilate(near, np.ones((15, 15), np.uint8))
    # le fond lointain des cartes sert d'échantillon ; on l'étend par convolution normalisée (éclairage non uniforme).
    # Estimation robuste : les cartes cachées non détectées polluent l'échantillon, on les écarte en 2 passes.
    wgt = (near == 0).astype(np.float32)
    sig = 0.10 * min(h, w)
    for _ in range(3):
        num = cv2.GaussianBlur(lab * wgt[..., None], (0, 0), sig)
        den = cv2.GaussianBlur(wgt, (0, 0), sig)[..., None]
        mu = num / np.maximum(den, 1e-3)
        diff = lab - mu
        dist = np.sqrt((diff ** 2).sum(-1))
        far = dist[wgt > 0]
        keep = (dist < np.median(far) * 2.5 + 4.0)
        wgt = wgt * keep.astype(np.float32)
    chroma = np.hypot(diff[..., 1], diff[..., 2])
    bright = diff[..., 0]
    sel = wgt > 0
    tc = chroma[sel]; tb = bright[sel]
    thr_c = max(8.0, np.median(tc) + 5 * np.median(np.abs(tc - np.median(tc))) + 1.5)
    thr_b = max(16.0, np.median(np.abs(tb)) * 2 + 5 * np.median(np.abs(tb - np.median(tb))) + 1.5)
    m = ((chroma > thr_c) | (bright > thr_b)).astype(np.uint8) * 255
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    return m

def residual(img, quads):
    m = non_table_mask(img, quads)
    covered = np.zeros_like(m)
    for q in quads:
        c = q.mean(0)
        cv2.fillPoly(covered, [((q - c) * 1.03 + c).astype(np.int32)], 255)
    covered = cv2.dilate(covered, np.ones((9, 9), np.uint8))
    return cv2.bitwise_and(m, cv2.bitwise_not(covered)), m
