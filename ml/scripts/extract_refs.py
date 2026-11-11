"""Découpe les cartes de référence des planches 3x3 : ml/photos/refs/<source>.png (400x560)."""
import sys, re, glob, os
sys.path.insert(0, os.path.dirname(__file__))
import cv2, numpy as np
from detect import find_quads, warp

SRC = 'ml/photos/cards'; OUT = 'ml/photos/refs'
os.makedirs(OUT, exist_ok=True)

def sheet_cards(path, scale=0.4):
    img = cv2.imread(path)
    small = cv2.resize(img, None, fx=scale, fy=scale)
    quads, _ = find_quads(small)
    good = []
    sizes = [sorted(r[1]) for r, _ in quads if 0.62 < min(r[1]) / max(r[1]) < 0.82]
    typ = np.median([hi for lo, hi in sizes]) if sizes else 0
    for rect, area in quads:
        (cx, cy), (rw, rh), ang = rect
        lo, hi = sorted((rw, rh))
        if hi == 0:
            continue
        # bloc trop long : plusieurs cartes collées -> on le coupe en parts égales
        if typ and hi > 1.6 * typ and 0.62 < lo / (hi / round(hi / typ)) < 0.82:
            n = round(hi / typ)
            rad = np.deg2rad(ang)
            vx, vy = (np.cos(rad), np.sin(rad)) if rw >= rh else (-np.sin(rad), np.cos(rad))
            for i in range(n):
                off = (i - (n - 1) / 2) * hi / n
                sub = ((cx + vx * off, cy + vy * off), (hi / n, lo) if rw >= rh else (lo, hi / n), ang)
                good.append(((sub[0][0] / scale, sub[0][1] / scale), (sub[1][0] / scale, sub[1][1] / scale), ang))
            continue
        if not (0.62 < lo / hi < 0.82):
            continue
        good.append(((cx / scale, cy / scale), (rw / scale, rh / scale), ang))
    # lignes : tri par cy puis regroupement
    good.sort(key=lambda r: r[0][1])
    rows = []
    for r in good:
        if rows and abs(r[0][1] - np.mean([x[0][1] for x in rows[-1]])) < 0.6 * max(r[1]) :
            rows[-1].append(r)
        else:
            rows.append([r])
    for row in rows:
        row.sort(key=lambda r: r[0][0])
    return img, rows

if __name__ == '__main__':
    for path in sorted(glob.glob(f'{SRC}/*.jpg')):
        name = os.path.basename(path)[:-4]
        if name == 'back': continue
        img, rows = sheet_cards(path)
        print(name, [len(r) for r in rows])
        for i, row in enumerate(rows, 1):
            for j, r in enumerate(row, 1):
                cv2.imwrite(f'{OUT}/{name}:r{i}c{j}.png', warp(img, r))
