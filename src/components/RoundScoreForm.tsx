import {
  computeRoundScore,
  EMPTY_ROUND_SCORE_INPUT,
  type RoundNumber,
  type RoundScoreInput,
} from "../domain/scoring";
import type { Player } from "../domain/game";

interface NumberFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
}

function NumberField({ label, value, onChange }: NumberFieldProps) {
  return (
    <label className="number-field">
      <span>{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        value={Number.isNaN(value) ? "" : value}
        onChange={(e) => {
          const parsed = parseInt(e.target.value, 10);
          onChange(Number.isNaN(parsed) ? 0 : parsed);
        }}
        onFocus={(e) => e.target.select()}
      />
    </label>
  );
}

interface RoundScoreFormProps {
  player: Player;
  round: RoundNumber;
  extensionEnabled: boolean;
  value: RoundScoreInput;
  onChange: (value: RoundScoreInput) => void;
}

export function RoundScoreForm({
  player,
  round,
  extensionEnabled,
  value,
  onChange,
}: RoundScoreFormProps) {
  const breakdown = computeRoundScore(value, round, extensionEnabled);
  const merged = { ...EMPTY_ROUND_SCORE_INPUT, ...value };

  function set<K extends keyof RoundScoreInput>(key: K, v: number) {
    onChange({ ...merged, [key]: v });
  }

  return (
    <fieldset className="round-score-form">
      <legend>{player.name}</legend>

      <div className="fields-grid">
        <NumberField
          label="Cartes validées (somme)"
          value={merged.validatedCardsSum}
          onChange={(v) => set("validatedCardsSum", v)}
        />
        <NumberField
          label={extensionEnabled ? "Spirales (bonus cartes spéciales inclus)" : "Spirales"}
          value={merged.spirals}
          onChange={(v) => set("spirals", v)}
        />
        <NumberField
          label={extensionEnabled ? "Croix (bonus cartes spéciales inclus)" : "Croix"}
          value={merged.crosses}
          onChange={(v) => set("crosses", v)}
        />
        <NumberField
          label="Plus grande zone de couleur (nb de cartes)"
          value={merged.colorZoneSize}
          onChange={(v) => set("colorZoneSize", v)}
        />

        {extensionEnabled && (
          <NumberField
            label="Cartes face cachée non recouvertes"
            value={merged.uncoveredFacedownCards ?? 0}
            onChange={(v) => set("uncoveredFacedownCards", v)}
          />
        )}
      </div>

      <p className="round-total">
        Total de la manche : <strong>{breakdown.roundTotal}</strong>
      </p>
    </fieldset>
  );
}
