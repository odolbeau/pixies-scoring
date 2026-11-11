import { describe, expect, it } from "vitest";
import { ALL_CARDS } from "../data/cards";
import { computeGridInput, EMPTY_GRID, type GridSlot, type PlayerGrid } from "./gridScoring";
import { computeRoundScore, ROUND_NUMBERS, type RoundScoreInput } from "./scoring";
import photoGrids from "./photoGrids.fixture.json";

interface PhotoGrid {
  photo: string;
  variant: "base" | "flowerPower" | "flowerPowerAndLittleGiants";
  slots: GridSlot[];
  giants: { cardId: string; index: number }[];
  expected: { subtotals: Partial<RoundScoreInput>; totals: number[] };
}

const OPTIONS = {
  base: { flowerPower: false, littleGiants: false },
  flowerPower: { flowerPower: true, littleGiants: false },
  flowerPowerAndLittleGiants: { flowerPower: true, littleGiants: true },
} as const;

describe("score d'une manche à partir de la grille", () => {
  it("rejoue les grilles photographiées : sous-totaux et totaux saisis par le joueur", () => {
    const grids = photoGrids as unknown as PhotoGrid[];
    expect(grids.length).toBeGreaterThan(0);
    for (const { photo, variant, slots, giants, expected } of grids) {
      const options = OPTIONS[variant];
      const input = computeGridInput({ slots, giants }, options);
      expect(input, `photo ${photo} (${variant})`).toMatchObject(expected.subtotals);
      const totals = ROUND_NUMBERS.map((r) => computeRoundScore(input, r, options).roundTotal);
      expect(totals, `photo ${photo} (${variant})`).toEqual(expected.totals);
    }
  });

  it("n'utilise que des cartes du catalogue", () => {
    const ids = new Set(ALL_CARDS.map((c) => c.id));
    for (const { slots, giants } of photoGrids as unknown as PhotoGrid[]) {
      for (const s of slots) if (s.kind === "card") expect(ids.has(s.cardId)).toBe(true);
      for (const g of giants) expect(ids.has(g.cardId)).toBe(true);
    }
  });

  it("vaut zéro pour une grille vide", () => {
    expect(computeGridInput(EMPTY_GRID, OPTIONS.flowerPowerAndLittleGiants)).toEqual({
      validatedCardsSum: 0,
      spirals: 0,
      crosses: 0,
      colorZoneSize: 0,
      uncoveredFacedownCards: 0,
      giantsSpirals: 0,
    });
  });

  it("compte 5 spirales par dos non recouvert avec Flower Power seulement", () => {
    const grid: PlayerGrid = {
      slots: EMPTY_GRID.slots.map((s, i) => (i < 2 ? { kind: "facedown" as const } : s)),
      giants: [],
    };
    expect(computeGridInput(grid, OPTIONS.flowerPower).uncoveredFacedownCards).toBe(2);
    expect(computeGridInput(grid, OPTIONS.base).uncoveredFacedownCards).toBe(0);
  });
});
