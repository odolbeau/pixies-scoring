# ml/ — test de faisabilité : score à partir d'une photo de grille

Expérimentation hors application (rien de Python n'est déployé). Environnement : `ml/.venv`
(voir `requirements.txt`). Données locales ignorées par git : `ml/photos/` (cartes, grilles, références, détections).

## Chaîne
1. `export_catalogue.mts` : catalogue TS → `ml/photos/catalogue.json`.
2. `extract_refs.py` + `build_refs.py` : découpe des 98 cartes de référence + dos (`refs_final/`).
3. `sift_match.py` : identification par correspondance SIFT + homographie RANSAC, sans détection préalable
   (gère rotation, perspective, recouvrements partiels). Les cartes de même illustration mais de symboles
   différents (ex. les 12 « 5 bleu ») sont départagées en comparant les zones de symboles qui diffèrent entre variantes.
4. `run_all.py` : détections des 15 grilles (`ml/photos/detections/`), `grid.py` : lignes/colonnes/Géants/zone/score,
   `compare.py` / `eval_totals.py` : comparaison avec `ml/photos/games/labels.json`.

5. `ring.py` : détection des cartes **recouvrant** une autre (cartes validées). Masque « hors table » robuste
   (`residual.py`, modèle de la table estimé en plusieurs passes pour ne pas être pollué par les cartes cachées),
   puis, le long de chaque côté d'une carte, recherche d'une ligne blanche fine (bord de la carte cachée) bordant une
   zone hors table. `eval_ring.py` : évaluation de bout en bout ; `ring_tune.py` : réglage des seuils ;
   `ring_sheet.py`, `ring_card.py`, `ring_dump.py` : aides au diagnostic.

## Résultats (15 grilles ; configuration par défaut de `sift_match.py` + `ring.py`)
Totaux de manche exacts : **8/15 grilles** (0/19 avant `ring.py`). Sous-totaux exacts : validées 9/15, spirales 14/15,
croix 15/15, zone 14/15, dos non recouverts 13/15, Géants 6/7. Seuils réglés sur ces mêmes 15 grilles :
le chiffre est optimiste, à confirmer sur de nouvelles photos.

- Bien : identification des cartes visibles (reflets, photo à l'envers, variantes de symboles, perspective rasante).
- Cartes recouvertes : faux positifs sur les bords de table / reflets (004 : une carte du bas), faux négatifs sur
  photos sombres où le bord de la carte cachée n'est plus « blanc » (007, 008).
- Restent : cartes lointaines peu texturées (011), dos reflété/lointain raté (009, 015).
- Vitesse : 10–20 s par photo en Python/CPU (trop lent tel quel pour le navigateur).
