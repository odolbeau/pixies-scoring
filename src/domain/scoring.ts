/**
 * Règles de score de Pixies (jeu de base + extensions Flower Power et
 * Little Giants).
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
 * Le champ `uncoveredFacedownCards` n'existe qu'avec l'extension Flower
 * Power (ignoré sinon). Les spirales/croix bonus données par les cartes
 * spéciales de l'extension n'ont pas de champ dédié : elles se comptent à
 * la main et se saisissent directement dans `spirals`/`crosses`.
 */
export interface RoundScoreInput {
  /** Somme des chiffres des cartes validées (carte visible qui en recouvre une cachée). */
  validatedCardsSum: number;
  /** Nombre de spirales sur les cartes visibles, bonus des cartes spéciales inclus. */
  spirals: number;
  /** Nombre de croix sur les cartes visibles, bonus des cartes spéciales inclus. */
  crosses: number;
  /** Nombre de cartes dans la plus grande zone de couleur connexe. */
  colorZoneSize: number;
  /** Extension : nombre de cartes face cachée non recouvertes (rapportent 5 spirales chacune). */
  uncoveredFacedownCards?: number;
  /**
   * Extension Little Giants : spirales rapportées par les cartes Géant. Les croix
   * annulées par un Géant ne se saisissent pas : on ne les compte simplement pas dans `crosses`.
   */
  giantsSpirals?: number;
}

/** Extensions actives pour la partie. */
export interface ScoringOptions {
  flowerPower: boolean;
  littleGiants: boolean;
}

export const EMPTY_ROUND_SCORE_INPUT: RoundScoreInput = {
  validatedCardsSum: 0,
  spirals: 0,
  crosses: 0,
  colorZoneSize: 0,
  uncoveredFacedownCards: 0,
  giantsSpirals: 0,
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
  options: ScoringOptions,
): RoundScoreBreakdown {
  const validatedCardsPoints = input.validatedCardsSum;

  const extensionSpirals = options.flowerPower
    ? (input.uncoveredFacedownCards ?? 0) * POINTS_PER_UNCOVERED_FACEDOWN_CARD
    : 0;

  // Les spirales/croix bonus de l'extension sont déjà comptées par le joueur
  // dans input.spirals/input.crosses (pas de champ séparé, voir RoundScoreInput).
  const giantsSpirals = options.littleGiants ? (input.giantsSpirals ?? 0) : 0;
  const totalSpirals = input.spirals + extensionSpirals + giantsSpirals;
  const totalCrosses = input.crosses;
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
