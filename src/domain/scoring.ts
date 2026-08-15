/**
 * Règles de score de Pixies (jeu de base + extension Flower Power).
 *
 * L'application ne simule pas le placement des cartes : les joueurs jouent
 * avec les cartes physiques, puis reportent ici les sous-totaux qu'ils lisent
 * sur leur grille. Ce module ne fait que les calculs (multiplicateurs,
 * totaux, classement) — voir README pour le détail des règles.
 */

export type RoundNumber = 1 | 2 | 3;

export const ROUND_NUMBERS: RoundNumber[] = [1, 2, 3];

/** Points par carte de la plus grande zone de couleur, selon la manche. */
export const COLOR_ZONE_MULTIPLIER: Record<RoundNumber, number> = {
  1: 2,
  2: 3,
  3: 4,
};

/**
 * Saisie d'un joueur pour une manche.
 *
 * Les champs `uncoveredFacedownCards`, `bonusSpirals` et `bonusCrosses`
 * n'existent qu'avec l'extension Flower Power (ignorés sinon).
 */
export interface RoundScoreInput {
  /** Somme des chiffres des cartes validées (carte visible qui en recouvre une cachée). */
  validatedCardsSum: number;
  /** Nombre de spirales sur les cartes visibles (y compris celles données par les cartes spéciales). */
  spirals: number;
  /** Nombre de croix sur les cartes visibles. */
  crosses: number;
  /** Nombre de cartes dans la plus grande zone de couleur connexe. */
  colorZoneSize: number;
  /** Extension : nombre de cartes face cachée non recouvertes (rapportent 5 spirales chacune). */
  uncoveredFacedownCards?: number;
  /** Extension : spirales additionnelles données par les cartes spéciales (1 à 3 par carte face cachée non recouverte). */
  bonusSpirals?: number;
  /** Extension : croix additionnelles données par les cartes spéciales "1 croix par carte visible d'une couleur". */
  bonusCrosses?: number;
}

export const EMPTY_ROUND_SCORE_INPUT: RoundScoreInput = {
  validatedCardsSum: 0,
  spirals: 0,
  crosses: 0,
  colorZoneSize: 0,
  uncoveredFacedownCards: 0,
  bonusSpirals: 0,
  bonusCrosses: 0,
};

export interface RoundScoreBreakdown {
  validatedCardsPoints: number;
  totalSpirals: number;
  totalCrosses: number;
  /** totalSpirals - totalCrosses */
  symbolsPoints: number;
  colorZonePoints: number;
  roundTotal: number;
}

const POINTS_PER_UNCOVERED_FACEDOWN_CARD = 5;

/** Calcule le détail du score d'un joueur pour une manche donnée. */
export function computeRoundScore(
  input: RoundScoreInput,
  round: RoundNumber,
  extensionEnabled: boolean,
): RoundScoreBreakdown {
  const validatedCardsPoints = input.validatedCardsSum;

  const extensionSpirals = extensionEnabled
    ? (input.uncoveredFacedownCards ?? 0) * POINTS_PER_UNCOVERED_FACEDOWN_CARD +
      (input.bonusSpirals ?? 0)
    : 0;
  const extensionCrosses = extensionEnabled ? (input.bonusCrosses ?? 0) : 0;

  const totalSpirals = input.spirals + extensionSpirals;
  const totalCrosses = input.crosses + extensionCrosses;
  const symbolsPoints = totalSpirals - totalCrosses;

  const colorZonePoints = input.colorZoneSize * COLOR_ZONE_MULTIPLIER[round];

  const roundTotal = validatedCardsPoints + symbolsPoints + colorZonePoints;

  return {
    validatedCardsPoints,
    totalSpirals,
    totalCrosses,
    symbolsPoints,
    colorZonePoints,
    roundTotal,
  };
}

/** Valide qu'une saisie ne contient que des entiers positifs ou nuls. */
export function validateRoundScoreInput(input: RoundScoreInput): string[] {
  const errors: string[] = [];
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    if (!Number.isInteger(value) || value < 0) {
      errors.push(`${key} doit être un entier positif ou nul.`);
    }
  }
  return errors;
}
