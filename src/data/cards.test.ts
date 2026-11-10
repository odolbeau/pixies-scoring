import { describe, expect, it } from "vitest";
import {
  ALL_CARDS,
  BASE_CARDS,
  FLOWER_POWER_CARDS,
  GIANT_CARDS,
  unverifiedCards,
} from "./cards";

/** Nombre de cartes par chiffre, imprimé en bas à droite des cartes (« x5 », « x12 »…). */
const BASE_COUNT_BY_NUMBER: Record<number, number> = {
  1: 5,
  2: 6,
  3: 8,
  4: 10,
  5: 12,
  6: 10,
  7: 8,
  8: 6,
  9: 5,
};

describe("catalogue des cartes", () => {
  it("contient 70 + 14 + 14 cartes aux identifiants uniques", () => {
    expect(BASE_CARDS).toHaveLength(70);
    expect(FLOWER_POWER_CARDS).toHaveLength(14);
    expect(GIANT_CARDS).toHaveLength(14);
    expect(new Set(ALL_CARDS.map((c) => c.id)).size).toBe(98);
    expect(new Set(ALL_CARDS.map((c) => c.source)).size).toBe(98);
  });

  it("respecte la répartition des chiffres du jeu de base", () => {
    for (const [number, count] of Object.entries(BASE_COUNT_BY_NUMBER)) {
      expect(BASE_CARDS.filter((c) => c.number === Number(number))).toHaveLength(count);
    }
  });

  it("donne une ou plusieurs couleurs à chaque carte, deux aux cartes Flower Power", () => {
    for (const card of ALL_CARDS) expect(card.colors.length).toBeGreaterThan(0);
    for (const card of FLOWER_POWER_CARDS) expect(card.colors).toHaveLength(2);
  });

  it("n'a plus de carte à confirmer, et toute carte douteuse future porte une note", () => {
    expect(unverifiedCards().every((c) => c.note)).toBe(true);
  });
});
