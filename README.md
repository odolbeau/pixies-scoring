# Pixies Score

Calculatrice de score pour le jeu de société **Pixies** (Bombyx), avec support
de l'extension **Flower Power**.

L'application ne simule pas le placement des cartes : elle se joue en vrai à
table avec les cartes physiques. À la fin de chaque manche, les joueurs
lisent leurs sous-totaux sur leur grille et les saisissent ici — l'app se
charge des multiplicateurs, des totaux et du classement.

## Règles (résumé)

- Chaque joueur remplit une grille 3×3. Une carte visible qui en recouvre une
  cachée est **validée** et rapporte autant de points que son chiffre.
- Symboles : chaque **spirale** = +1 point, chaque **croix** = −1 point
  (cartes visibles uniquement, validées ou non).
- La **plus grande zone de couleur** (cartes de même couleur adjacentes,
  diagonales exclues) rapporte, par carte : 2 pts en manche 1, 3 en manche 2,
  4 en manche 3.
- 3 manches, on additionne les totaux. Meilleur score cumulé = victoire
  (égalité = victoire partagée).
- **Extension Flower Power** : jusqu'à 6 joueurs, cartes bicolores (comptent
  pour les deux couleurs), chaque carte **face cachée non recouverte**
  rapporte 5 spirales (+ bonus de certaines cartes), et un nouveau symbole
  ajoute des croix bonus par carte visible d'une couleur donnée. Dans
  l'appli, ces spirales/croix bonus n'ont pas de champ dédié : elles se
  comptent à la main et s'ajoutent directement dans les champs
  Spirales/Croix d'origine.
- **Extension Little Giants** : 14 cartes Géant placées en haut d'une colonne
  ou à gauche d'une ligne (hors de la grille 3×3, un par ligne/colonne). Elles
  rapportent des spirales (par carte validée, sans spirale, d'une couleur
  donnée ou non validée de leur ligne/colonne) ou annulent les croix de leur
  ligne. Dans l'appli, deux champs dédiés : « Spirales des Géants » et « Croix
  annulées par un Géant ». Cumulable avec Flower Power (jusqu'à 6 joueurs).

Sources : livret de règles officiel Pixies (Bombyx) et extension Flower
Power, et livret Little Giants (studiobombyx.com).

## Stack

- React + TypeScript + Vite, SPA 100% front-end, sans backend.
- État applicatif : Zustand.
- Persistance locale : IndexedDB (partie en cours, historique des parties
  terminées, liste des joueurs connus), via `idb`.
- Tests unitaires du moteur de score : Vitest (`src/domain`).

## Structure

```
src/
  domain/     # règles de score pures, testées indépendamment de l'UI
  storage/    # persistance IndexedDB
  store/      # état global (Zustand) reliant domaine + persistance
  components/ # composants UI réutilisables (formulaire de manche, scoreboard)
  screens/    # écrans (Setup, Play, Result, History)
```

## Développement

```bash
npm install
npm run dev       # serveur de dev
npm run test      # tests unitaires (moteur de score)
npm run build     # build de prod (dist/), inclut le type-check
npm run lint      # oxlint
```

Le build produit un site statique (`dist/`) déployable sur n'importe quel
hébergeur statique (Cloudflare Pages, Vercel, GitHub Pages…).
