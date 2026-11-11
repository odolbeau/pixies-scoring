import { useMemo, useState } from "react";
import {
  BASE_CARDS,
  FLOWER_POWER_CARDS,
  GIANT_CARDS,
  type GiantCardDef,
  type GridCardDef,
} from "../data/cards";
import { COLOR_LABEL, COLORS, describeGiant, describeGridCard } from "../domain/cardLabels";
import {
  cardById,
  computeGridInput,
  EMPTY_GRID,
  GRID_SIZE,
  type PlayerGrid,
} from "../domain/gridScoring";
import type { RoundScoreInput, ScoringOptions } from "../domain/scoring";

/** Emplacement en cours d'édition : une case de la grille, ou un Géant (ligne à gauche, colonne en haut). */
type Target =
  | { kind: "slot"; index: number }
  | { kind: "giant"; direction: "row" | "column"; index: number };

interface GridEditorProps {
  options: ScoringOptions;
  grid: PlayerGrid;
  onChange: (grid: PlayerGrid) => void;
  /** Remplit les champs de saisie avec les sous-totaux déduits de la grille. */
  onApply: (input: RoundScoreInput) => void;
}

function slotLabel(grid: PlayerGrid, index: number): string {
  const slot = grid.slots[index];
  if (slot.kind === "facedown") return "Dos";
  if (slot.kind === "empty") return "+";
  const card = cardById(slot.cardId);
  return card && card.set !== "littleGiants" ? String(card.number) : "?";
}

function giantAt(grid: PlayerGrid, direction: "row" | "column", index: number) {
  return grid.giants.find((g) => {
    const def = cardById(g.cardId);
    return def?.set === "littleGiants" && def.direction === direction && g.index === index;
  });
}

export function GridEditor({ options, grid, onChange, onApply }: GridEditorProps) {
  const [target, setTarget] = useState<Target | null>(null);
  const [numberFilter, setNumberFilter] = useState<number | null>(null);
  const [colorFilter, setColorFilter] = useState<string | null>(null);

  const input = useMemo(() => computeGridInput(grid, options), [grid, options]);

  const gridCards: GridCardDef[] = useMemo(
    () => (options.flowerPower ? [...BASE_CARDS, ...FLOWER_POWER_CARDS] : BASE_CARDS),
    [options.flowerPower],
  );
  const filteredCards = gridCards.filter(
    (c) =>
      (numberFilter === null || c.number === numberFilter) &&
      (colorFilter === null || c.colors.some((color) => color === colorFilter)),
  );

  function select(next: Target | null) {
    setTarget(next);
    setNumberFilter(null);
    setColorFilter(null);
  }

  function setSlot(index: number, slot: PlayerGrid["slots"][number]) {
    onChange({ ...grid, slots: grid.slots.map((s, i) => (i === index ? slot : s)) });
  }

  function setGiant(direction: "row" | "column", index: number, cardId: string | null) {
    const others = grid.giants.filter((g) => {
      const def = cardById(g.cardId);
      return !(def?.set === "littleGiants" && def.direction === direction && g.index === index);
    });
    onChange({ ...grid, giants: cardId ? [...others, { cardId, index }] : others });
  }

  const selectedSlot = target?.kind === "slot" ? grid.slots[target.index] : null;

  return (
    <div className="grid-editor">
      <div className="grid-board" style={{ gridTemplateColumns: `auto repeat(${GRID_SIZE}, 1fr)` }}>
        <span />
        {Array.from({ length: GRID_SIZE }, (_, c) => (
          <span key={c}>
            {options.littleGiants && (
              <button
                type="button"
                className={`grid-slot giant${giantAt(grid, "column", c) ? " filled" : ""}`}
                aria-label={`Géant de la colonne ${c + 1}`}
                onClick={() => select({ kind: "giant", direction: "column", index: c })}
              >
                {giantAt(grid, "column", c) ? "G" : "G▾"}
              </button>
            )}
          </span>
        ))}
        {Array.from({ length: GRID_SIZE }, (_, r) => [
          <span key={`g${r}`}>
            {options.littleGiants && (
              <button
                type="button"
                className={`grid-slot giant${giantAt(grid, "row", r) ? " filled" : ""}`}
                aria-label={`Géant de la ligne ${r + 1}`}
                onClick={() => select({ kind: "giant", direction: "row", index: r })}
              >
                {giantAt(grid, "row", r) ? "G" : "G▸"}
              </button>
            )}
          </span>,
          ...Array.from({ length: GRID_SIZE }, (_, c) => {
            const index = r * GRID_SIZE + c;
            const slot = grid.slots[index];
            const active = target?.kind === "slot" && target.index === index;
            return (
              <button
                key={index}
                type="button"
                className={`grid-slot${slot.kind !== "empty" ? " filled" : ""}${active ? " active" : ""}`}
                aria-label={`Ligne ${r + 1}, colonne ${c + 1}`}
                onClick={() => select({ kind: "slot", index })}
              >
                {slotLabel(grid, index)}
                {slot.kind === "card" && slot.covers && <span className="covers-mark">⧉</span>}
              </button>
            );
          }),
        ])}
      </div>

      {target?.kind === "slot" && (
        <div className="card-picker">
          {selectedSlot?.kind === "card" && (
            <label className="covers-toggle">
              <input
                type="checkbox"
                checked={selectedSlot.covers}
                onChange={(e) => setSlot(target.index, { ...selectedSlot, covers: e.target.checked })}
              />
              Cette carte en recouvre une autre (carte validée)
            </label>
          )}
          <div className="picker-filters">
            {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                className={numberFilter === n ? "chip active" : "chip"}
                onClick={() => setNumberFilter(numberFilter === n ? null : n)}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="picker-filters">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={colorFilter === c ? `chip color-${c} active` : `chip color-${c}`}
                onClick={() => setColorFilter(colorFilter === c ? null : c)}
              >
                {COLOR_LABEL[c]}
              </button>
            ))}
          </div>
          <ul className="picker-list">
            {options.flowerPower && (
              <li>
                <button type="button" onClick={() => { setSlot(target.index, { kind: "facedown" }); select(null); }}>
                  Carte face cachée
                </button>
              </li>
            )}
            {filteredCards.map((card) => (
              <li key={card.id}>
                <button
                  type="button"
                  onClick={() => {
                    const keep = selectedSlot?.kind === "card" ? selectedSlot.covers : false;
                    setSlot(target.index, { kind: "card", cardId: card.id, covers: keep });
                    select(null);
                  }}
                >
                  {describeGridCard(card)}
                </button>
              </li>
            ))}
            {filteredCards.length === 0 && <li className="muted">Aucune carte ne correspond.</li>}
          </ul>
          <button type="button" className="text-button" onClick={() => { setSlot(target.index, { kind: "empty" }); select(null); }}>
            Vider cet emplacement
          </button>
        </div>
      )}

      {target?.kind === "giant" && (
        <div className="card-picker">
          <p className="muted">
            Géant {target.direction === "row" ? `à gauche de la ligne ${target.index + 1}` : `en haut de la colonne ${target.index + 1}`}
          </p>
          <ul className="picker-list">
            {GIANT_CARDS.filter((g: GiantCardDef) => g.direction === target.direction).map((g) => (
              <li key={g.id}>
                <button type="button" onClick={() => { setGiant(target.direction, target.index, g.id); select(null); }}>
                  {describeGiant(g)}
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="text-button" onClick={() => { setGiant(target.direction, target.index, null); select(null); }}>
            Retirer le Géant
          </button>
        </div>
      )}

      <dl className="grid-summary">
        <div><dt>Cartes validées</dt><dd>{input.validatedCardsSum}</dd></div>
        <div><dt>Spirales</dt><dd>{input.spirals}</dd></div>
        <div><dt>Croix</dt><dd>{input.crosses}</dd></div>
        <div><dt>Zone de couleur</dt><dd>{input.colorZoneSize}</dd></div>
        {options.flowerPower && <div><dt>Dos non recouverts</dt><dd>{input.uncoveredFacedownCards}</dd></div>}
        {options.littleGiants && <div><dt>Spirales des Géants</dt><dd>{input.giantsSpirals}</dd></div>}
      </dl>

      <div className="grid-actions">
        <button type="button" className="primary" onClick={() => onApply(input)}>
          Utiliser ces valeurs
        </button>
        <button type="button" className="text-button" onClick={() => onChange(EMPTY_GRID)}>
          Vider la grille
        </button>
      </div>
    </div>
  );
}

