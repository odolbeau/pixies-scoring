import type { CardBonus, CardColor, GiantCardDef, GiantEffect, GridCardDef } from "../data/cards";

export const COLOR_LABEL: Record<CardColor, string> = {
  blue: "bleu",
  green: "vert",
  yellow: "jaune",
  red: "rouge",
};

export const COLORS: CardColor[] = ["blue", "green", "yellow", "red"];

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? "s" : ""}`;

export function describeColors(colors: CardColor[]): string {
  return colors.length === COLORS.length ? "multicolore" : colors.map((c) => COLOR_LABEL[c]).join(" + ");
}

function describeBonus(bonus: CardBonus): string {
  switch (bonus.kind) {
    case "spiralsPerColor":
      return `${plural(bonus.spirals, "spirale")} / carte ${COLOR_LABEL[bonus.color]}`;
    case "crossesPerColor":
      return `${plural(bonus.crosses, "croix")} / carte ${COLOR_LABEL[bonus.color]}`;
    case "spiralsPerFacedown":
      return `${plural(bonus.spirals, "spirale")} / dos`;
  }
}

/** Symboles imprimés d'une carte, pour départager les cartes de même chiffre et de même couleur. */
export function describeSymbols(card: GridCardDef): string {
  const parts: string[] = [];
  if (card.spirals > 0) parts.push(plural(card.spirals, "spirale"));
  if (card.crosses > 0) parts.push(plural(card.crosses, "croix"));
  if (card.bonus) parts.push(describeBonus(card.bonus));
  return parts.length > 0 ? parts.join(", ") : "sans symbole";
}

export function describeGridCard(card: GridCardDef): string {
  return `${card.number} · ${describeColors(card.colors)} · ${describeSymbols(card)}`;
}

function describeEffect(effect: GiantEffect): string {
  switch (effect.kind) {
    case "perValidated":
      return `${plural(effect.spirals, "spirale")} / carte validée`;
    case "perSpiralless":
      return `${plural(effect.spirals, "spirale")} / carte sans spirale`;
    case "perNotValidated":
      return `${plural(effect.spirals, "spirale")} / carte non validée`;
    case "perColor":
      return `${plural(effect.spirals, "spirale")} / carte ${COLOR_LABEL[effect.color]}`;
    case "cancelCrosses":
      return "annule les croix";
  }
}

export function describeGiant(card: GiantCardDef): string {
  return `${describeColors(card.colors)} · ${describeEffect(card.effect)}`;
}
