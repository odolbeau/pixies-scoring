"""Détecte les cartes sur toutes les photos de grilles (en parallèle) : ml/photos/detections/<n>.json + aperçus."""
import sys, os, json, time, glob
sys.path.insert(0, os.path.dirname(__file__))
from multiprocessing import Pool
from sift_match import *

OUT = os.environ.get('PX_OUT', 'ml/photos/detections'); os.makedirs(OUT, exist_ok=True)
REFS_ = None
def work(path):
    global REFS_
    if REFS_ is None: REFS_ = load_refs()
    name = os.path.basename(path)[:-4]
    t = time.time()
    ph = load_photo(path)
    d = detect(ph, REFS_)
    overlay(ph, d, f'{OUT}/{name}.jpg')
    json.dump(dict(size=[ph.shape[1], ph.shape[0]], dets=[dict(id=x['id'], inliers=x['inliers'], quad=x['quad'].round(1).tolist(), H=x['H'].tolist(), pts=x['pts'].round(0).tolist()) for x in d]), open(f'{OUT}/{name}.json', 'w'))
    return name, len(d), round(time.time() - t, 1)

if __name__ == '__main__':
    paths = sorted(glob.glob('ml/photos/games/0*.jpg'))
    with Pool(6) as p:
        for r in p.imap_unordered(work, paths): print(*r, flush=True)
