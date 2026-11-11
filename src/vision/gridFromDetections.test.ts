import { describe, expect, it } from "vitest";
import detections from "./photoDetections.fixture.json";
import { gridFromDetections, type Detection } from "./gridFromDetections";
import { computeGridInput } from "../domain/gridScoring";

type Raw = Record<string, { size: [number, number]; dets: Detection[] }>;

/**
 * Sous-totaux calculés par le prototype Python (ml/scripts/grid.py, sans la détection des cartes
 * entièrement recouvertes) sur les mêmes détections : le port TypeScript doit donner la même chose.
 */
const PYTHON_REFERENCE: Record<string, [validated: number, spirals: number, crosses: number, zone: number, backs: number, giants: number]> = {
  "001": [13, 12, 3, 4, 1, 0],
  "002": [11, 25, 5, 5, 1, 0],
  "003": [0, 10, 4, 7, 3, 4],
  "005": [14, 8, 5, 8, 1, 6],
  "010": [0, 9, 7, 4, 1, 0],
  "012": [0, 19, 3, 8, 2, 10],
  "013": [5, 19, 11, 6, 1, 6],
  "014": [5, 12, 6, 4, 2, 14],
};

describe("gridFromDetections", () => {
  it.each(Object.entries(PYTHON_REFERENCE))("photo %s : même résultat que le prototype Python", (photo, expected) => {
    const raw = (detections as unknown as Raw)[photo];
    const rec = gridFromDetections(raw.dets, raw.size);
    expect(rec).not.toBeNull();
    const input = computeGridInput(rec!.grid, { flowerPower: true, littleGiants: true });
    expect([
      input.validatedCardsSum,
      input.spirals,
      input.crosses,
      input.colorZoneSize,
      input.uncoveredFacedownCards,
      input.giantsSpirals,
    ]).toEqual(expected);
  });

  it("sans carte reconnue : pas de grille", () => {
    expect(gridFromDetections([], [100, 100])).toBeNull();
  });
});
