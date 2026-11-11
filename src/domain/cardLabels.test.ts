import { describe, expect, it } from "vitest";
import { FLOWER_POWER_CARDS, GIANT_CARDS } from "../data/cards";
import { describeGiant, describeGridCard } from "./cardLabels";

describe("libellés des cartes", () => {
  it("décrit une carte Flower Power avec ses symboles et son bonus", () => {
    const card = FLOWER_POWER_CARDS.find((c) => c.id === "fp-02");
    expect(card && describeGridCard(card)).toBe("7 · bleu + rouge · 2 spirales, 1 croix / carte vert");
  });

  it("décrit chaque Géant", () => {
    expect(describeGiant(GIANT_CARDS[0])).toBe("jaune · 2 spirales / carte jaune");
    expect(GIANT_CARDS.every((g) => describeGiant(g).length > 0)).toBe(true);
  });
});
