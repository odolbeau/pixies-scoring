# OpenCV.js avec SIFT (reconnaissance dans le navigateur)

Le build officiel d'OpenCV.js n'a ni SIFT ni `FlannBasedMatcher`. `public/vision/opencv.js` et
`public/vision/opencv_js.wasm` sont donc compilés à part (OpenCV 4.10.0, Emscripten 3.1.64, SIMD, modules
`core imgproc calib3d features2d flann`).

## Recette

```sh
git clone --depth 1 --branch 4.10.0 https://github.com/opencv/opencv.git cvsrc
cd cvsrc
# platforms/js/opencv_js.config.py, dictionnaire `features2d` : ajouter
#   'SIFT': ['create', 'getDefaultName'],
#   'FlannBasedMatcher': ['isMaskSupported', 'create'],
docker run --rm -v $PWD:/src -u $(id -u):$(id -g) emscripten/emsdk:3.1.64 \
  emcmake python3 ./platforms/js/build_js.py build_wasm --build_wasm --simd --disable_single_file \
  --cmake_option="-DBUILD_LIST=core,imgproc,calib3d,features2d,flann,js"
cp build_wasm/bin/opencv.js build_wasm/bin/opencv_js.wasm ../public/vision/
```

## Points de référence

`public/vision/refs.bin` : points SIFT des 98 cartes et du dos (500 par carte) + miniatures des cartes dont
l'illustration est partagée avec une autre. Régénération (nécessite `ml/photos/refs_final`, hors dépôt) :

```sh
ml/.venv/bin/python ml/scripts/siblings.py        # cartes à illustration identique -> ml/photos/siblings.json
ml/.venv/bin/python ml/scripts/export_refs.py 500 public/vision/refs.bin
```

Le code TypeScript (`src/vision/`) est un port de `ml/scripts/sift_match.py` et `ml/scripts/grid.py`, sans la
détection des cartes entièrement recouvertes : le joueur coche lui-même « recouvre une autre carte ».
