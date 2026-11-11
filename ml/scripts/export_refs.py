"""Exporte les points SIFT de référence (les N plus marqués par carte) pour la reconnaissance dans le navigateur.

Format de public/vision/refs.bin (little-endian) :
  u32 nombre de cartes, puis pour chaque carte : id (u8 longueur + ASCII), u16 largeur, u16 hauteur, u16 nb points,
  nb × (f32 x, f32 y) puis nb × 128 octets de descripteurs (SIFT, valeurs entières 0..255),
  puis u16 largeur et u16 hauteur d'une miniature en niveaux de gris (0, 0 si absente) et ses octets.
Les miniatures ne servent qu'aux cartes à illustration identique à une autre (ml/photos/siblings.json : calculé par
le script ml/scripts/siblings.py) : on y départage les variantes par leurs symboles.
"""
import json, os, struct, sys
sys.path.insert(0, os.path.dirname(__file__))
import cv2, numpy as np
from sift_match import load_refs

N = int(sys.argv[1]) if len(sys.argv) > 1 else 400
out = sys.argv[2] if len(sys.argv) > 2 else 'public/vision/refs.bin'
refs = load_refs()
SIB = json.load(open('ml/photos/siblings.json'))
THUMB_W = 200
os.makedirs(os.path.dirname(out), exist_ok=True)
with open(out, 'wb') as f:
    f.write(struct.pack('<I', len(refs)))
    for r in refs:
        order = sorted(range(len(r['kp'])), key=lambda i: -r['kp'][i].response)[:N]
        pts = np.float32([r['kp'][i].pt for i in order])
        des = np.clip(np.rint(r['des'][order]), 0, 255).astype(np.uint8)
        idb = r['id'].encode()
        w, h = r['size']
        f.write(struct.pack('<B', len(idb)) + idb + struct.pack('<HHH', w, h, len(order)))
        f.write(pts.tobytes()); f.write(des.tobytes())
        if r['id'] in SIB:
            th = round(THUMB_W * h / w)
            f.write(struct.pack('<HH', THUMB_W, th)); f.write(cv2.resize(r['img'], (THUMB_W, th), interpolation=cv2.INTER_AREA).tobytes())
        else:
            f.write(struct.pack('<HH', 0, 0))
print(len(refs), 'cartes,', os.path.getsize(out) // 1024, 'Ko')
