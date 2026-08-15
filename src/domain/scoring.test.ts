import { describe, expect, it } from "vitest";
import {
  computeRoundScore,
  EMPTY_ROUND_SCORE_INPUT,
  validateRoundScoreInput,
} from "./scoring";

describe("computeRoundScore", () => {
  it("reproduit l'exemple de décompte du livret de règles (manche 1)", () => {
    // 1 + 5 + 7 + 8 = 21 (cartes validées)
    // 10 spirales + 5 (carte spéciale) - 4 croix = 11
    // 4 cartes bleues connectées x 2 pts (manche 1) = 8
    // total = 40
    const breakdown = computeRoundScore(
      {
        validatedCardsSum: 21,
        spirals: 15,
        crosses: 4,
        colorZoneSize: 4,
      },
      1,
      false,
    );

    expect(breakdown.validatedCardsPoints).toBe(21);
    expect(breakdown.symbolsPoints).toBe(11);
    expect(breakdown.colorZonePoints).toBe(8);
    expect(breakdown.roundTotal).toBe(40);
  });

  it("applique le bon multiplicateur de zone de couleur selon la manche", () => {
    const input = { ...EMPTY_ROUND_SCORE_INPUT, colorZoneSize: 3 };
    expect(computeRoundScore(input, 1, false).colorZonePoints).toBe(6);
    expect(computeRoundScore(input, 2, false).colorZonePoints).toBe(9);
    expect(computeRoundScore(input, 3, false).colorZonePoints).toBe(12);
  });

  it("ignore uncoveredFacedownCards quand l'extension est désactivée", () => {
    const breakdown = computeRoundScore(
      { ...EMPTY_ROUND_SCORE_INPUT, uncoveredFacedownCards: 2 },
      1,
      false,
    );
    expect(breakdown.totalSpirals).toBe(0);
  });

  it("compte 5 spirales par carte face cachée non recouverte avec l'extension", () => {
    // Les spirales bonus des cartes spéciales n'ont pas de champ dédié :
    // le joueur les compte à la main et les inclut directement dans `spirals`.
    const breakdown = computeRoundScore(
      { ...EMPTY_ROUND_SCORE_INPUT, spirals: 3, uncoveredFacedownCards: 2 },
      1,
      true,
    );
    // 3 (déjà comptées, bonus inclus) + 2 * 5 = 13
    expect(breakdown.totalSpirals).toBe(13);
    expect(breakdown.symbolsPoints).toBe(13);
  });

  it("ne modifie pas le total de croix saisi (les bonus y sont déjà inclus)", () => {
    const breakdown = computeRoundScore(
      { ...EMPTY_ROUND_SCORE_INPUT, spirals: 2, crosses: 4 },
      1,
      true,
    );
    expect(breakdown.totalCrosses).toBe(4);
    expect(breakdown.symbolsPoints).toBe(-2);
  });

  it("autorise un total de manche négatif (croix > spirales+cartes)", () => {
    const breakdown = computeRoundScore(
      { ...EMPTY_ROUND_SCORE_INPUT, crosses: 5 },
      1,
      false,
    );
    expect(breakdown.roundTotal).toBe(-5);
  });
});

describe("validateRoundScoreInput", () => {
  it("n'autorise pas les valeurs négatives", () => {
    const errors = validateRoundScoreInput({
      ...EMPTY_ROUND_SCORE_INPUT,
      validatedCardsSum: -1,
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it("n'autorise pas les valeurs non entières", () => {
    const errors = validateRoundScoreInput({
      ...EMPTY_ROUND_SCORE_INPUT,
      spirals: 1.5,
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it("accepte une saisie valide", () => {
    const errors = validateRoundScoreInput({
      ...EMPTY_ROUND_SCORE_INPUT,
      validatedCardsSum: 21,
      spirals: 10,
      crosses: 4,
      colorZoneSize: 4,
    });
    expect(errors).toEqual([]);
  });
});
