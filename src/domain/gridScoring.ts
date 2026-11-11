/**
 * Score d'une manche à partir de la grille posée (cartes et recouvrements).
 *
 * Le joueur décrit sa grille ; ce module en déduit les sous-totaux de `RoundScoreInput`
 * (cartes validées, spirales, croix, zone de couleur, dos non recouverts, spirales des Géants),
 * que `computeRoundScore` transforme ensuite en points. Les règles de lecture suivent le livret :
 *
 * - une carte validée est une carte visible qui en recouvre une autre ; la carte recouverte ne compte pour rien ;
 * - les dos (Flower Power) ne comptent ni pour les couleurs ni pour les bonus, ils valent 5 spirales chacun ;
 * - un Géant compte comme une carte de sa couleur (bonus, zone), et sa zone touche la rangée ou la colonne
 *   qu'il désigne.
 */
import { ALL_CARDS, type CardColor, type CardDef, type GiantCardDef, type GridCardDef } from "../data/cards";
import type { RoundScoreInput, ScoringOptions } from "./scoring";

export const GRID_SIZE = 3;

export type GridSlot =
  | { kind: "empty" }
  /** Carte face cachée (Flower Power) non recouverte. */
  | { kind: "facedown" }
  /** Carte face visible ; `covers` : elle en recouvre une autre (carte validée). */
  | { kind: "card"; cardId: string; covers: boolean };

/** Géant posé à gauche de la ligne `index` ou en haut de la colonne `index`, selon son sens. */
export interface GridGiant {
  cardId: string;
  index: number;
}

export interface PlayerGrid {
  /** 9 emplacements, ligne par ligne. */
  slots: GridSlot[];
  giants: GridGiant[];
}

export const EMPTY_GRID: PlayerGrid = {
  slots: Array.from({ length: GRID_SIZE * GRID_SIZE }, () => ({ kind: "empty" as const })),
  giants: [],
};

const CARDS_BY_ID = new Map<string, CardDef>(ALL_CARDS.map((c) => [c.id, c]));

export function cardById(id: string): CardDef | undefined {
  return CARDS_BY_ID.get(id);
}

function gridCard(id: string): GridCardDef | undefined {
  const card = CARDS_BY_ID.get(id);
  return card && card.set !== "littleGiants" ? card : undefined;
}

function giantCard(id: string): GiantCardDef | undefined {
  const card = CARDS_BY_ID.get(id);
  return card && card.set === "littleGiants" ? card : undefined;
}

/** Une carte a-t-elle une spirale quelconque (imprimée, ou en bonus) ? */
function hasSpiralSymbol(card: GridCardDef): boolean {
  if (card.spirals > 0) return true;
  return card.bonus?.kind === "spiralsPerColor" || card.bonus?.kind === "spiralsPerFacedown";
}

interface PlacedCard {
  row: number;
  col: number;
  colors: CardColor[];
}

/** Taille de la plus grande zone de cartes connexes (côtés, pas diagonales) partageant une couleur. */
function largestColorZone(placed: PlacedCard[]): number {
  let best = 0;
  for (const color of ["blue", "green", "yellow", "red"] as const) {
    const todo = new Set(
      placed.filter((p) => p.colors.includes(color)).map((p) => `${p.row},${p.col}`),
    );
    while (todo.size > 0) {
      const first = todo.values().next().value as string;
      todo.delete(first);
      const stack = [first];
      let size = 1;
      while (stack.length > 0) {
        const [r, c] = (stack.pop() as string).split(",").map(Number);
        for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const key = `${r + dr},${c + dc}`;
          if (todo.delete(key)) {
            size++;
            stack.push(key);
          }
        }
      }
      best = Math.max(best, size);
    }
  }
  return best;
}

/** Déduit les sous-totaux de la manche à partir de la grille. */
export function computeGridInput(grid: PlayerGrid, options: ScoringOptions): RoundScoreInput {
  const cards: { row: number; col: number; def: GridCardDef; covers: boolean }[] = [];
  let facedown = 0;
  grid.slots.forEach((slot, i) => {
    const row = Math.floor(i / GRID_SIZE);
    const col = i % GRID_SIZE;
    if (slot.kind === "facedown") facedown++;
    if (slot.kind !== "card") return;
    const def = gridCard(slot.cardId);
    if (def) cards.push({ row, col, def, covers: slot.covers });
  });
  const uncoveredFacedown = options.flowerPower ? facedown : 0;

  const giants = options.littleGiants
    ? grid.giants.flatMap((g) => {
        const def = giantCard(g.cardId);
        return def ? [{ def, index: g.index }] : [];
      })
    : [];
  // Un Géant de ligne est à gauche de la grille (colonne -1), un Géant de colonne au-dessus (ligne -1).
  const giantPlaced = giants.map(({ def, index }) => ({
    def,
    row: def.direction === "row" ? index : -1,
    col: def.direction === "row" ? -1 : index,
  }));

  const placed: PlacedCard[] = [
    ...cards.map((c) => ({ row: c.row, col: c.col, colors: c.def.colors })),
    ...giantPlaced.map((g) => ({ row: g.row, col: g.col, colors: g.def.colors })),
  ];
  const countColor = (color: CardColor) => placed.filter((p) => p.colors.includes(color)).length;

  const cancelledRows = new Set(
    giantPlaced.filter((g) => g.def.effect.kind === "cancelCrosses").map((g) => g.row),
  );

  let spirals = 0;
  let crosses = 0;
  let validatedCardsSum = 0;
  for (const { row, def, covers } of cards) {
    if (covers) validatedCardsSum += def.number;
    spirals += def.spirals;
    let cardCrosses = def.crosses;
    const bonus = def.bonus;
    if (bonus?.kind === "spiralsPerColor") spirals += bonus.spirals * countColor(bonus.color);
    else if (bonus?.kind === "spiralsPerFacedown") spirals += bonus.spirals * uncoveredFacedown;
    else if (bonus?.kind === "crossesPerColor") cardCrosses += bonus.crosses * countColor(bonus.color);
    if (!cancelledRows.has(row)) crosses += cardCrosses;
  }

  let giantsSpirals = 0;
  for (const g of giantPlaced) {
    const effect = g.def.effect;
    if (effect.kind === "cancelCrosses") continue;
    if (effect.kind === "perColor") {
      const inRow = placed.filter((p) => p.row === g.row && p.colors.includes(effect.color)).length;
      giantsSpirals += effect.spirals * inRow;
      continue;
    }
    const members = cards.filter((c) => (g.def.direction === "column" ? c.col === g.col : c.row === g.row));
    const count =
      effect.kind === "perValidated"
        ? members.filter((c) => c.covers).length
        : effect.kind === "perSpiralless"
          ? members.filter((c) => !hasSpiralSymbol(c.def)).length
          : members.filter((c) => !c.covers).length;
    giantsSpirals += effect.spirals * count;
  }

  return {
    validatedCardsSum,
    spirals,
    crosses,
    colorZoneSize: largestColorZone(placed),
    uncoveredFacedownCards: uncoveredFacedown,
    giantsSpirals,
  };
}
