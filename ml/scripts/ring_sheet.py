"""Planche des cartes redressées avec leur voisinage (x1.6), pour regarder les cartes recouvertes qui dépassent."""
import sys, os, json
sys.path.insert(0, os.path.dirname(__file__))
import numpy as np, cv2
from grid import *
from sift_match import load_photo
n = sys.argv[1]
raw = json.load(open(f"{os.environ.get('PX_OUT','ml/photos/det_G')}/{n}.json"))
g = build(raw, raw['size'])
img = load_photo(f'ml/photos/games/{n}.jpg')
if isinstance(img, tuple): img = img[0]
dets = g['dets']
S = 1.6; OW, OH = 220, 308
tiles = []
for r, c, i in sorted(g['cells']):
    d = dets[i]
    q = d['quad']; ctr = q.mean(0)
    qq = ((q - ctr) * S + ctr).astype(np.float32)
    dst = np.float32([[0, 0], [OW, 0], [OW, OH], [0, OH]])
    M = cv2.getPerspectiveTransform(qq, dst)
    t = cv2.warpPerspective(img, M, (OW, OH))
    inner = ((q - ctr) / 1 + ctr).astype(np.float32)
    ip = cv2.perspectiveTransform(inner.reshape(1, -1, 2), M).reshape(-1, 2).astype(np.int32)
    cv2.polylines(t, [ip], True, (0, 0, 255), 1)
    cv2.putText(t, f"({r},{c}) {d['id']}", (3, 12), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 255), 1)
    tiles.append(t)
while len(tiles) % 5: tiles.append(np.zeros_like(tiles[0]))
rows = [np.hstack(tiles[k:k + 5]) for k in range(0, len(tiles), 5)]
cv2.imwrite(f'ml/photos/ring_{n}.jpg', np.vstack(rows))
