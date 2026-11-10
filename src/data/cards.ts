/**
 * Catalogue des cartes de Pixies (jeu de base, Flower Power, Little Giants),
 * transcrit à la main depuis les photos de `ml/photos/cards/`.
 *
 * `source` = "<photo>:r<ligne>c<colonne>" (grille 3×3 de la photo, une fois
 * celle-ci remise à l'endroit : les fichiers du dossier le sont déjà).
 *
 * `confidence` : "ok" = lu nettement ; "uncertain" = lisible mais à confirmer
 * (symbole flou ou interprétation) ; "unreadable" = photo floue, valeurs
 * provisoires à refaire. Voir `unverifiedCards()`.
 */

export type CardColor = "blue" | "green" | "yellow" | "red";
export type CardSet = "base" | "flowerPower" | "littleGiants";
export type Confidence = "ok" | "uncertain" | "unreadable";

/** Bonus imprimés en haut de la carte (symbole « x / y »). */
export type CardBonus =
  /** Base, « spirale / couleur » : spirales par carte visible de cette couleur (la carte porteuse compte, pas les cartes recouvertes). */
  | { kind: "spiralsPerColor"; color: CardColor; spirals: number }
  /** Flower Power, « croix / couleur » : croix par carte visible de cette couleur. */
  | { kind: "crossesPerColor"; color: CardColor; crosses: number }
  /** Flower Power, « spirales / carte face cachée ». */
  | { kind: "spiralsPerFacedown"; spirals: number };

interface CardBase {
  id: string;
  source: string;
  colors: CardColor[];
  confidence: Confidence;
  note?: string;
}

/** Carte posée dans la grille 3×3 (jeu de base et Flower Power). */
export interface GridCardDef extends CardBase {
  set: "base" | "flowerPower";
  number: number;
  /** Spirales imprimées (hors bonus). */
  spirals: number;
  /** Croix imprimées (hors bonus). */
  crosses: number;
  bonus?: CardBonus;
}

/** Effet d'un Géant (spirales gagnées, ou croix annulées). */
export type GiantEffect =
  /** Colonne : par carte validée. */
  | { kind: "perValidated"; spirals: number }
  /** Colonne : par carte visible sans aucune spirale. */
  | { kind: "perSpiralless"; spirals: number }
  /** Ligne : par carte visible de la couleur indiquée (le Géant compte pour lui-même). */
  | { kind: "perColor"; color: CardColor; spirals: number }
  /** Ligne ou colonne : par carte visible non validée. */
  | { kind: "perNotValidated"; spirals: number }
  /** Ligne : annule toutes les croix des cartes visibles. */
  | { kind: "cancelCrosses" };

/** Carte Géant (Little Giants), posée hors de la grille. */
export interface GiantCardDef extends CardBase {
  set: "littleGiants";
  /** Sens de la flèche : à gauche d'une ligne ou en haut d'une colonne. */
  direction: "row" | "column";
  effect: GiantEffect;
}

export type CardDef = GridCardDef | GiantCardDef;

const COLOR_CODES: Record<string, CardColor[]> = {
  B: ["blue"],
  G: ["green"],
  Y: ["yellow"],
  R: ["red"],
  // Carte multicolore du jeu de base : les 4 pastilles.
  M: ["green", "yellow", "red", "blue"],
};

const CODE_TO_COLOR: Record<string, CardColor> = {
  B: "blue",
  G: "green",
  Y: "yellow",
  R: "red",
};

function colorsOf(codes: string): CardColor[] {
  return COLOR_CODES[codes] ?? [...codes].map((c) => CODE_TO_COLOR[c]);
}

interface Extras {
  spirals?: number;
  crosses?: number;
  bonus?: CardBonus;
  confidence?: Confidence;
  note?: string;
}

type Draft<T> = Omit<T, "id">;

function gridCard(
  set: GridCardDef["set"],
  source: string,
  number: number,
  colors: string,
  extras: Extras = {},
): Draft<GridCardDef> {
  return {
    set,
    source,
    number,
    colors: colorsOf(colors),
    spirals: extras.spirals ?? 0,
    crosses: extras.crosses ?? 0,
    bonus: extras.bonus,
    confidence: extras.confidence ?? "ok",
    note: extras.note,
  };
}

const base = (source: string, number: number, colors: string, extras?: Extras) =>
  gridCard("base", source, number, colors, extras);
const flower = (source: string, number: number, colors: string, extras?: Extras) =>
  gridCard("flowerPower", source, number, colors, extras);

const perColor = (color: string): CardBonus => ({
  kind: "spiralsPerColor",
  color: CODE_TO_COLOR[color],
  spirals: 1,
});
const crossPerColor = (color: string): CardBonus => ({
  kind: "crossesPerColor",
  color: CODE_TO_COLOR[color],
  crosses: 1,
});
const perFacedown = (spirals: number): CardBonus => ({ kind: "spiralsPerFacedown", spirals });

function giant(
  source: string,
  colors: string,
  direction: GiantCardDef["direction"],
  effect: GiantEffect,
  confidence: Confidence = "ok",
  note?: string,
): Draft<GiantCardDef> {
  return { set: "littleGiants", source, colors: colorsOf(colors), direction, effect, confidence, note };
}

function withIds<T extends { set: CardSet }>(prefix: string, drafts: Draft<T & { id: string }>[]): T[] {
  return drafts.map((d, i) => ({ ...d, id: `${prefix}-${String(i + 1).padStart(2, "0")}` }) as unknown as T);
}

/** 70 cartes du jeu de base. */
export const BASE_CARDS = withIds<GridCardDef>("base", [
  // base-1
  base("base-1:r1c1", 9, "B", { crosses: 6 }),
  base("base-1:r1c2", 8, "G", { crosses: 2 }),
  base("base-1:r1c3", 3, "B", { spirals: 1 }),
  base("base-1:r2c1", 9, "G", { crosses: 4 }),
  base("base-1:r2c2", 4, "B"),
  base("base-1:r2c3", 5, "Y", { bonus: perColor("Y") }),
  base("base-1:r3c1", 5, "B", { crosses: 2 }),
  base("base-1:r3c2", 8, "M", { crosses: 1 }),
  base("base-1:r3c3", 5, "B"),
  // base-2
  base("base-2:r1c1", 6, "M", { crosses: 1 }),
  base("base-2:r1c2", 1, "B", { spirals: 6 }),
  base("base-2:r1c3", 3, "R", { spirals: 4 }),
  base("base-2:r2c1", 2, "B", { spirals: 4 }),
  base("base-2:r2c2", 7, "B", { crosses: 3 }),
  base("base-2:r2c3", 8, "Y", { crosses: 1 }),
  base("base-2:r3c1", 6, "Y", { crosses: 3 }),
  base("base-2:r3c2", 7, "Y", { spirals: 1 }),
  base("base-2:r3c3", 7, "Y", { crosses: 5 }),
  // base-3
  base("base-3:r1c1", 9, "Y", { crosses: 2 }),
  base("base-3:r1c2", 5, "Y", { crosses: 2 }),
  base("base-3:r1c3", 3, "M"),
  base("base-3:r2c1", 4, "R"),
  base("base-3:r2c2", 6, "R"),
  base("base-3:r2c3", 2, "R", { spirals: 5 }),
  base("base-3:r3c1", 4, "Y", { spirals: 3 }),
  base("base-3:r3c2", 3, "Y", { spirals: 5 }),
  base("base-3:r3c3", 1, "Y", { spirals: 4 }),
  // base-4
  base("base-4:r1c1", 1, "R", { spirals: 3 }),
  base("base-4:r1c2", 8, "R"),
  base("base-4:r1c3", 2, "G", { spirals: 3 }),
  base("base-4:r2c1", 3, "Y"),
  base("base-4:r2c2", 4, "M"),
  base("base-4:r2c3", 4, "Y", { crosses: 1 }),
  base("base-4:r3c1", 8, "B", { crosses: 3 }),
  base("base-4:r3c2", 6, "Y"),
  base("base-4:r3c3", 2, "Y", { bonus: perColor("Y") }),
  // base-5
  base("base-5:r1c1", 7, "M", { crosses: 1 }),
  base("base-5:r1c2", 7, "R", { crosses: 1 }),
  base("base-5:r1c3", 7, "G"),
  base("base-5:r2c1", 7, "G", { crosses: 2 }),
  base("base-5:r2c2", 6, "G", { spirals: 1 }),
  base("base-5:r2c3", 4, "B", { bonus: perColor("B") }),
  base("base-5:r3c1", 1, "G", { spirals: 5 }),
  base("base-5:r3c2", 6, "G", { crosses: 4 }),
  base("base-5:r3c3", 5, "R", { crosses: 1 }),
  // base-6
  base("base-6:r1c1", 4, "G", { crosses: 1 }),
  base("base-6:r1c2", 6, "G", { crosses: 1 }),
  base("base-6:r1c3", 6, "B", { crosses: 1 }),
  base("base-6:r2c1", 3, "G", { bonus: perColor("G") }),
  base("base-6:r2c2", 7, "R", { crosses: 4 }),
  base("base-6:r2c3", 5, "G"),
  base("base-6:r3c1", 6, "B", { spirals: 1 }),
  base("base-6:r3c2", 2, "Y", { spirals: 2 }),
  base("base-6:r3c3", 3, "B", { spirals: 3 }),
  // base-7 (3 cartes floues en haut)
  base("base-7:r1c1", 9, "B", { crosses: 1 }),
  base("base-7:r1c2", 3, "G", { spirals: 2 }),
  base("base-7:r1c3", 5, "G", { bonus: perColor("G") }),
  base("base-7:r2c1", 2, "M"),
  base("base-7:r2c2", 5, "Y"),
  base("base-7:r2c3", 4, "G", { spirals: 4 }),
  base("base-7:r3c1", 4, "R", { spirals: 2 }),
  base("base-7:r3c2", 9, "R"),
  base("base-7:r3c3", 5, "R", { bonus: perColor("R") }),
  // base-8
  base("base-8:r1c1", 5, "R"),
  base("base-8:r1c2", 8, "R", { crosses: 5 }),
  base("base-8:r1c3", 5, "B", { bonus: perColor("B") }),
  base("base-8:r2c1", 6, "R", { crosses: 2 }),
  base("base-8:r2c2", 4, "B", { spirals: 1 }),
  base("base-8:r3c1", 5, "G", { crosses: 1 }),
  base("base-8:r3c2", 1, "R", { bonus: perColor("R") }),
]);

/** 14 cartes de l'extension Flower Power (cartes bicolores). */
export const FLOWER_POWER_CARDS = withIds<GridCardDef>("fp", [
  flower("flower-1:r1c1", 2, "RB", { crosses: 1, bonus: perFacedown(3) }),
  flower("flower-1:r1c2", 7, "BR", { spirals: 2, bonus: crossPerColor("G") }),
  flower("flower-1:r1c3", 3, "RG", { spirals: 5, bonus: crossPerColor("B") }),
  flower("flower-1:r2c1", 5, "BY", { bonus: perFacedown(2) }),
  flower("flower-1:r2c2", 5, "RG", { crosses: 1, bonus: perFacedown(2) }),
  flower("flower-1:r2c3", 1, "GY", { bonus: perFacedown(3) }),
  flower("flower-1:r3c1", 9, "GY", { bonus: crossPerColor("B") }),
  flower("flower-1:r3c2", 4, "YR", { spirals: 4, bonus: crossPerColor("G") }),
  flower("flower-1:r3c3", 8, "YB", { spirals: 1, bonus: crossPerColor("R") }),
  flower("flower-2:r1c1", 6, "RG", { spirals: 3, bonus: crossPerColor("Y") }),
  flower("flower-2:r1c2", 1, "BY", { spirals: 7, bonus: crossPerColor("R") }),
  flower("flower-2:r2c1", 9, "YR", { crosses: 2, bonus: perFacedown(1) }),
  flower("flower-2:r2c2", 2, "GB", { spirals: 6, bonus: crossPerColor("Y") }),
  flower("flower-2:r3c1", 8, "GB", { crosses: 1, bonus: perFacedown(1) }),
]);

/** 14 cartes de l'extension Little Giants. */
export const GIANT_CARDS = withIds<GiantCardDef>("giant", [
  giant("giants-1:r1c1", "Y", "row", { kind: "perColor", color: "yellow", spirals: 2 }),
  giant("giants-1:r1c2", "M", "column", { kind: "perNotValidated", spirals: 3 }),
  giant("giants-1:r1c3", "B", "column", { kind: "perValidated", spirals: 3 }),
  giant("giants-1:r2c1", "M", "row", { kind: "perNotValidated", spirals: 2 }),
  giant("giants-1:r2c2", "G", "column", { kind: "perValidated", spirals: 3 }),
  giant("giants-1:r2c3", "R", "row", { kind: "perColor", color: "red", spirals: 2 }),
  giant("giants-1:r3c1", "R", "column", { kind: "perSpiralless", spirals: 4 }, "ok", "carte à l'envers sur la photo"),
  giant("giants-1:r3c2", "Y", "column", { kind: "perValidated", spirals: 3 }),
  giant("giants-1:r3c3", "R", "column", { kind: "perValidated", spirals: 3 }),
  giant("giants-2:r1c1", "G", "row", { kind: "perColor", color: "green", spirals: 2 }),
  giant("giants-2:r1c2", "G", "column", { kind: "perSpiralless", spirals: 4 }),
  giant("giants-2:r2c1", "B", "row", { kind: "perColor", color: "blue", spirals: 2 }),
  giant("giants-2:r2c2", "Y", "row", { kind: "cancelCrosses" }),
  giant("giants-2:r3c1", "B", "row", { kind: "cancelCrosses" }),
]);

export const ALL_CARDS: CardDef[] = [...BASE_CARDS, ...FLOWER_POWER_CARDS, ...GIANT_CARDS];

/** Cartes à relire ou à refaire en photo avant de s'en servir comme référence. */
export function unverifiedCards(): CardDef[] {
  return ALL_CARDS.filter((c) => c.confidence !== "ok");
}
