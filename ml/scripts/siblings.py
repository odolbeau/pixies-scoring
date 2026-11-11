"""Cartes à illustration identique (ne différant que par leurs symboles) : écrit ml/photos/siblings.json."""
import json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
import cv2, numpy as np
from sift_match import load_refs, flann

refs = [r for r in load_refs() if r['id'] != 'back']
grp = {}
for i, a in enumerate(refs):
    for b in refs[i + 1:]:
        m = flann.knnMatch(a['des'], b['des'], k=2)
        good = [(x.queryIdx, x.trainIdx) for x, y in (p for p in m if len(p) == 2) if x.distance < 0.8 * y.distance]
        if len(good) < 60: continue
        src = np.float32([a['kp'][q].pt for q, _ in good]).reshape(-1, 1, 2)
        dst = np.float32([b['kp'][t].pt for _, t in good]).reshape(-1, 1, 2)
        H, mask = cv2.findHomography(src, dst, cv2.RANSAC, 6.0)
        if H is not None and mask.sum() >= 80:
            grp.setdefault(a['id'], set()).add(b['id']); grp.setdefault(b['id'], set()).add(a['id'])
json.dump({k: sorted(v) for k, v in sorted(grp.items())}, open('ml/photos/siblings.json', 'w'), indent=1)
print(len(grp), 'cartes avec sœurs')
