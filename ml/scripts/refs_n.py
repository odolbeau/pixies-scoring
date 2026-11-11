"""Effet d'une réduction du nombre de points SIFT par carte de référence sur l'identification (vs détections complètes)."""
import json, os, sys, time
sys.path.insert(0, os.path.dirname(__file__))
import numpy as np
from sift_match import load_refs, load_photo, detect

N = int(sys.argv[1])
refs = load_refs()
for r in refs:
    order = sorted(range(len(r['kp'])), key=lambda i: -r['kp'][i].response)[:N]
    r['kp'] = [r['kp'][i] for i in order]; r['des'] = r['des'][order]
ok = tot = fp = 0
for n in sorted(f[:-5] for f in os.listdir('ml/photos/detections') if f.endswith('.json')):
    truth = [d['id'] for d in json.load(open(f'ml/photos/detections/{n}.json'))['dets']]
    t = time.time()
    got = [d['id'] for d in detect(load_photo(f'ml/photos/games/{n}.jpg'), refs)]
    a, b = set(truth), set(got)
    ok += len(a & b); tot += len(a); fp += len(b - a)
    print(n, f'{len(a & b)}/{len(a)} +{len(b - a)} {time.time() - t:.0f}s', sorted(a - b), sorted(b - a), flush=True)
print('N', N, 'total', ok, '/', tot, 'en trop', fp)
