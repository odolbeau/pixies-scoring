import { describe, expect, it } from "vitest";
import {
  computeRoundScore,
  EMPTY_ROUND_SCORE_INPUT,
  validateRoundScoreInput,
} from "./scoring";

const NONE = { flowerPower: false, littleGiants: false };
const FLOWER = { flowerPower: true, littleGiants: false };
const GIANTS = { flowerPower: false, littleGiants: true };

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
      NONE,
    );

    expect(breakdown.validatedCardsPoints).toBe(21);
    expect(breakdown.symbolsPoints).toBe(11);
    expect(breakdown.colorZonePoints).toBe(8);
    expect(breakdown.roundTotal).toBe(40);
  });

  it("applique le bon multiplicateur de zone de couleur selon la manche", () => {
    const input = { ...EMPTY_ROUND_SCORE_INPUT, colorZoneSize: 3 };
    expect(computeRoundScore(input, 1, NONE).colorZonePoints).toBe(6);
    expect(computeRoundScore(input, 2, NONE).colorZonePoints).toBe(9);
    expect(computeRoundScore(input, 3, NONE).colorZonePoints).toBe(12);
  });

  it("ignore uncoveredFacedownCards quand l'extension est désactivée", () => {
    const breakdown = computeRoundScore(
      { ...EMPTY_ROUND_SCORE_INPUT, uncoveredFacedownCards: 2 },
      1,
      NONE,
    );
    expect(breakdown.totalSpirals).toBe(0);
  });

  it("compte 5 spirales par carte face cachée non recouverte avec l'extension", () => {
    // Les spirales bonus des cartes spéciales n'ont pas de champ dédié :
    // le joueur les compte à la main et les inclut directement dans `spirals`.
    const breakdown = computeRoundScore(
      { ...EMPTY_ROUND_SCORE_INPUT, spirals: 3, uncoveredFacedownCards: 2 },
      1,
      FLOWER,
    );
    // 3 (déjà comptées, bonus inclus) + 2 * 5 = 13
    expect(breakdown.totalSpirals).toBe(13);
    expect(breakdown.symbolsPoints).toBe(13);
  });

  it("ne modifie pas le total de croix saisi (les bonus y sont déjà inclus)", () => {
    const breakdown = computeRoundScore(
      { ...EMPTY_ROUND_SCORE_INPUT, spirals: 2, crosses: 4 },
      1,
      FLOWER,
    );
    expect(breakdown.totalCrosses).toBe(4);
    expect(breakdown.symbolsPoints).toBe(-2);
  });

  it("ajoute les spirales des Géants avec Little Giants et les ignore sinon", () => {
    const input = { ...EMPTY_ROUND_SCORE_INPUT, spirals: 2, crosses: 4, giantsSpirals: 9 };
    const withGiants = computeRoundScore(input, 1, GIANTS);
    expect(withGiants.totalSpirals).toBe(11);
    expect(withGiants.symbolsPoints).toBe(7);
    expect(computeRoundScore(input, 1, NONE).totalSpirals).toBe(2);
  });

  it("combine Flower Power et Little Giants", () => {
    const input = { ...EMPTY_ROUND_SCORE_INPUT, uncoveredFacedownCards: 1, giantsSpirals: 4 };
    const both = { flowerPower: true, littleGiants: true };
    expect(computeRoundScore(input, 1, both).totalSpirals).toBe(9);
  });

  it("reproduit la grille photo 001 (jeu de base, puis avec un dos non recouvert)", () => {
    const input = {
      ...EMPTY_ROUND_SCORE_INPUT,
      validatedCardsSum: 17,
      spirals: 12,
      crosses: 5,
      colorZoneSize: 4,
      uncoveredFacedownCards: 1,
    };
    expect([1, 2, 3].map((r) => computeRoundScore(input, r as 1 | 2 | 3, NONE).roundTotal)).toEqual([32, 36, 40]);
    expect([1, 2, 3].map((r) => computeRoundScore(input, r as 1 | 2 | 3, FLOWER).roundTotal)).toEqual([37, 41, 45]);
  });

  it("reproduit la grille photo 002 (Flower Power)", () => {
    const input = {
      ...EMPTY_ROUND_SCORE_INPUT,
      validatedCardsSum: 26,
      spirals: 25,
      crosses: 8,
      colorZoneSize: 5,
      uncoveredFacedownCards: 1,
    };
    expect([1, 2, 3].map((r) => computeRoundScore(input, r as 1 | 2 | 3, FLOWER).roundTotal)).toEqual([58, 63, 68]);
  });

  it("reproduit la grille photo 003 (Flower Power + Little Giants)", () => {
    const input = {
      ...EMPTY_ROUND_SCORE_INPUT,
      validatedCardsSum: 14,
      spirals: 10,
      giantsSpirals: 5,
      crosses: 4,
      colorZoneSize: 7,
      uncoveredFacedownCards: 3,
    };
    const both = { flowerPower: true, littleGiants: true };
    expect([1, 2, 3].map((r) => computeRoundScore(input, r as 1 | 2 | 3, both).roundTotal)).toEqual([54, 61, 68]);
  });

  it("reproduit la grille photo 004, sans puis avec les Géants", () => {
    const rounds = [1, 2, 3] as const;
    const withoutGiants = {
      ...EMPTY_ROUND_SCORE_INPUT,
      validatedCardsSum: 20,
      spirals: 11,
      crosses: 10,
      colorZoneSize: 4,
      uncoveredFacedownCards: 1,
    };
    const withGiants = {
      ...withoutGiants,
      giantsSpirals: 7,
      crosses: 12,
      colorZoneSize: 5,
    };
    const both = { flowerPower: true, littleGiants: true };
    expect(rounds.map((r) => computeRoundScore(withoutGiants, r, FLOWER).roundTotal)).toEqual([34, 38, 42]);
    expect(rounds.map((r) => computeRoundScore(withGiants, r, both).roundTotal)).toEqual([41, 46, 51]);
  });

  it("reproduit la grille photo 005, sans puis avec les Géants", () => {
    const rounds = [1, 2, 3] as const;
    const withoutGiants = {
      ...EMPTY_ROUND_SCORE_INPUT,
      validatedCardsSum: 14,
      spirals: 8,
      crosses: 11,
      colorZoneSize: 7,
      uncoveredFacedownCards: 1,
    };
    // Le Géant bleu annule les 6 croix de la ligne 3 ; on ne les saisit donc pas.
    const withGiants = {
      ...withoutGiants,
      giantsSpirals: 6,
      crosses: 5,
      colorZoneSize: 8,
    };
    const both = { flowerPower: true, littleGiants: true };
    expect(rounds.map((r) => computeRoundScore(withoutGiants, r, FLOWER).roundTotal)).toEqual([30, 37, 44]);
    expect(rounds.map((r) => computeRoundScore(withGiants, r, both).roundTotal)).toEqual([44, 52, 60]);
  });

  it("reproduit la grille photo 006 (Flower Power, deux dos non recouverts)", () => {
    const input = {
      ...EMPTY_ROUND_SCORE_INPUT,
      validatedCardsSum: 32,
      spirals: 16,
      crosses: 7,
      colorZoneSize: 3,
      uncoveredFacedownCards: 2,
    };
    expect([1, 2, 3].map((r) => computeRoundScore(input, r as 1 | 2 | 3, FLOWER).roundTotal)).toEqual([57, 60, 63]);
  });

  it("reproduit la grille photo 007 (Flower Power, trois dos non recouverts)", () => {
    const input = {
      ...EMPTY_ROUND_SCORE_INPUT,
      validatedCardsSum: 31,
      spirals: 18,
      crosses: 7,
      colorZoneSize: 3,
      uncoveredFacedownCards: 3,
    };
    expect([1, 2, 3].map((r) => computeRoundScore(input, r as 1 | 2 | 3, FLOWER).roundTotal)).toEqual([63, 66, 69]);
  });

  it("reproduit la grille photo 008 (jeu de base, cinq cartes qui en recouvrent une autre)", () => {
    const input = {
      ...EMPTY_ROUND_SCORE_INPUT,
      validatedCardsSum: 25,
      spirals: 17,
      crosses: 6,
      colorZoneSize: 6,
    };
    expect([1, 2, 3].map((r) => computeRoundScore(input, r as 1 | 2 | 3, NONE).roundTotal)).toEqual([48, 54, 60]);
  });

  it("reproduit la grille photo 009, sans puis avec Flower Power (3 dos non recouverts)", () => {
    const input = {
      ...EMPTY_ROUND_SCORE_INPUT,
      validatedCardsSum: 22,
      spirals: 15,
      crosses: 1,
      colorZoneSize: 5,
      uncoveredFacedownCards: 3,
    };
    expect([1, 2, 3].map((r) => computeRoundScore(input, r as 1 | 2 | 3, NONE).roundTotal)).toEqual([46, 51, 56]);
    expect([1, 2, 3].map((r) => computeRoundScore(input, r as 1 | 2 | 3, FLOWER).roundTotal)).toEqual([61, 66, 71]);
  });

  it("reproduit la grille photo 010 (Flower Power, un dos non recouvert)", () => {
    const input = {
      ...EMPTY_ROUND_SCORE_INPUT,
      validatedCardsSum: 18,
      spirals: 14,
      crosses: 11,
      colorZoneSize: 4,
      uncoveredFacedownCards: 1,
    };
    expect([1, 2, 3].map((r) => computeRoundScore(input, r as 1 | 2 | 3, FLOWER).roundTotal)).toEqual([34, 38, 42]);
  });

  it("reproduit la grille photo 011 (Flower Power, bonus par carte face cachée)", () => {
    const input = {
      ...EMPTY_ROUND_SCORE_INPUT,
      validatedCardsSum: 25,
      spirals: 10,
      crosses: 1,
      colorZoneSize: 5,
      uncoveredFacedownCards: 1,
    };
    expect([1, 2, 3].map((r) => computeRoundScore(input, r as 1 | 2 | 3, FLOWER).roundTotal)).toEqual([49, 54, 59]);
  });

  it("reproduit la grille photo 012 (toutes extensions, Géant « sans spirale » face visible uniquement)", () => {
    // Le 2 multicolore compte comme carte verte pour la croix du 7 (le 6 et le 2 : 2 croix) et comme
    // carte jaune pour celle du 6 (1 croix) : 3 croix. Le Géant de colonne
    // ne vaut que pour le 2 (le 5 a une spirale dans son bonus, les dos ne comptent pas) : 4,
    // plus 6 pour le Géant de ligne rouge (1, 2 et lui-même) : 10 spirales de Géants.
    const input = {
      ...EMPTY_ROUND_SCORE_INPUT,
      validatedCardsSum: 13,
      spirals: 19,
      crosses: 3,
      colorZoneSize: 8,
      uncoveredFacedownCards: 2,
      giantsSpirals: 10,
    };
    const both = { flowerPower: true, littleGiants: true };
    expect([1, 2, 3].map((r) => computeRoundScore(input, r as 1 | 2 | 3, both).roundTotal)).toEqual([65, 73, 81]);
  });

  it("reproduit la grille photo 013 (toutes extensions, deux Géants de colonne « par carte validée »)", () => {
    // Grille de 8 cartes (une case vide). Croix : 3 (rouge) + 4 (jaune) + 3 (vert) + 1 imprimée = 11.
    // Géants rouge (colonne du 2 : 2 et 5 validés) et jaune (colonne du 3 : 3 et 6 validés) : 6 + 6.
    const input = {
      ...EMPTY_ROUND_SCORE_INPUT,
      validatedCardsSum: 16,
      spirals: 19,
      crosses: 11,
      colorZoneSize: 6,
      uncoveredFacedownCards: 1,
      giantsSpirals: 12,
    };
    const both = { flowerPower: true, littleGiants: true };
    expect([1, 2, 3].map((r) => computeRoundScore(input, r as 1 | 2 | 3, both).roundTotal)).toEqual([53, 59, 65]);
  });

  it("reproduit la grille photo 014 (toutes extensions, trois Géants, zone passant par deux Géants voisins)", () => {
    // Zone rouge de 5 : Géant col. 1, Géant col. 2 (voisins dans la rangée des Géants), 1, 4 et 7.
    // Géants : 3 × 3 (1, 4, 7 validés) + 4 (le 5 seul) + 4 (le 6 seul) = 17.
    // Croix : 2 (le 4) + 2 (le 7) pour les cartes vertes (le 8 et le Géant vert), 2 (le 6) + 1 (le 8).
    const input = {
      ...EMPTY_ROUND_SCORE_INPUT,
      validatedCardsSum: 12,
      spirals: 14,
      crosses: 7,
      colorZoneSize: 5,
      uncoveredFacedownCards: 2,
      giantsSpirals: 17,
    };
    const both = { flowerPower: true, littleGiants: true };
    expect([1, 2, 3].map((r) => computeRoundScore(input, r as 1 | 2 | 3, both).roundTotal)).toEqual([56, 61, 66]);
  });

  it("reproduit la grille photo 015 (toutes extensions, Géant « annule les croix » sans effet)", () => {
    // Le Géant jaune « annule les croix » est sur une ligne de dos : aucune croix à annuler.
    // Géants : 8 (rouge de ligne : 4 cartes rouges) + 6 (bleu de colonne : le 3 et le 6 validés).
    const input = {
      ...EMPTY_ROUND_SCORE_INPUT,
      validatedCardsSum: 15,
      spirals: 13,
      crosses: 3,
      colorZoneSize: 5,
      uncoveredFacedownCards: 3,
      giantsSpirals: 14,
    };
    const both = { flowerPower: true, littleGiants: true };
    expect([1, 2, 3].map((r) => computeRoundScore(input, r as 1 | 2 | 3, both).roundTotal)).toEqual([64, 69, 74]);
  });

  it("autorise un total de manche négatif (croix > spirales+cartes)", () => {
    const breakdown = computeRoundScore(
      { ...EMPTY_ROUND_SCORE_INPUT, crosses: 5 },
      1,
      NONE,
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
