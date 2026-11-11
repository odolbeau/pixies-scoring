import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EMPTY_GRID } from "../domain/gridScoring";
import { GridEditor } from "./GridEditor";

const noop = () => {};

describe("GridEditor", () => {
  it("affiche les 9 emplacements, et les Géants seulement avec l'extension", () => {
    const base = renderToStaticMarkup(
      <GridEditor options={{ flowerPower: false, littleGiants: false }} grid={EMPTY_GRID} onChange={noop} onApply={noop} />,
    );
    expect(base.match(/aria-label="Ligne \d, colonne \d"/g)).toHaveLength(9);
    expect(base).not.toContain("Géant de la");
    expect(base).not.toContain("Dos non recouverts");

    const full = renderToStaticMarkup(
      <GridEditor options={{ flowerPower: true, littleGiants: true }} grid={EMPTY_GRID} onChange={noop} onApply={noop} />,
    );
    expect(full.match(/aria-label="Géant de la (ligne|colonne) \d"/g)).toHaveLength(6);
    expect(full).toContain("Dos non recouverts");
    expect(full).toContain("Spirales des Géants");
  });
});
