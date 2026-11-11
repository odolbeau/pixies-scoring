"""Associe chaque carte du catalogue à sa photo de référence : ml/photos/refs_final/<id>.png (+ planche de contrôle)."""
import json, os, shutil, cv2, numpy as np
R = 'ml/photos/refs'; OUT = 'ml/photos/refs_final'
os.makedirs(OUT, exist_ok=True)
cat = json.load(open('ml/photos/catalogue.json'))
RETAKE = {'base-7:r1c1': 'base-7-r1-retake:r1c1', 'base-7:r1c2': 'base-7-r1-retake:r1c2', 'base-7:r1c3': 'base-7-r1-retake:r1c3',
          'flower-2:r1c2': 'flower-2-r1c2-retake:r1c1', 'giants-1:r1c1': 'giants-1-r1c1-retake:r1c1'}
tiles = []
for c in cat:
    src = RETAKE.get(c['source'], c['source'])
    p = f'{R}/{src}.png'
    if not os.path.exists(p):
        raise SystemExit(f'manquant : {c["id"]} {src}')
    shutil.copy(p, f'{OUT}/{c["id"]}.png')
    t = cv2.resize(cv2.imread(p), (200, 280))
    label = f'{c["id"]} n{c.get("number","G")} {"".join(x[0] for x in c["colors"])}'
    cv2.putText(t, label, (4, 272), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 2)
    tiles.append(t)
for k in range(0, 98, 20):
    chunk = tiles[k:k+20]
    while len(chunk) < 20: chunk.append(np.zeros_like(tiles[0]))
    rows = [np.hstack(chunk[i:i+10]) for i in range(0, 20, 10)]
    cv2.imwrite(f'ml/photos/refs_check_{k//20}.jpg', cv2.resize(np.vstack(rows), None, fx=0.5, fy=0.5))
print('ok', len(os.listdir(OUT)))
