import { useState } from "react";
import { maxPlayersFor, MIN_PLAYERS_BASE } from "../domain/game";
import { useGameStore } from "../store/useGameStore";

const DEFAULT_PLAYER_COUNT = 3;

export function SetupScreen() {
  const startGame = useGameStore((s) => s.startGame);
  const [extensionEnabled, setExtensionEnabled] = useState(false);
  const [names, setNames] = useState<string[]>(
    Array.from({ length: DEFAULT_PLAYER_COUNT }, () => ""),
  );
  const [error, setError] = useState<string | null>(null);

  const max = maxPlayersFor(extensionEnabled);

  function updateName(index: number, value: string) {
    setNames((prev) => prev.map((n, i) => (i === index ? value : n)));
  }

  function addPlayer() {
    if (names.length >= max) return;
    setNames((prev) => [...prev, ""]);
  }

  function removePlayer(index: number) {
    setNames((prev) => prev.filter((_, i) => i !== index));
  }

  function handleExtensionToggle(checked: boolean) {
    setExtensionEnabled(checked);
    const newMax = maxPlayersFor(checked);
    if (names.length > newMax) {
      setNames((prev) => prev.slice(0, newMax));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmed = names.map((n) => n.trim());
    if (trimmed.some((n) => n.length === 0)) {
      setError("Chaque joueur doit avoir un nom.");
      return;
    }
    if (new Set(trimmed).size !== trimmed.length) {
      setError("Les noms doivent être différents.");
      return;
    }
    if (trimmed.length < MIN_PLAYERS_BASE) {
      setError(`Il faut au moins ${MIN_PLAYERS_BASE} joueurs.`);
      return;
    }

    try {
      await startGame(trimmed, extensionEnabled);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <form className="setup-screen" onSubmit={handleSubmit}>
      <h1>Nouvelle partie de Pixies</h1>

      <label className="extension-toggle">
        <input
          type="checkbox"
          checked={extensionEnabled}
          onChange={(e) => handleExtensionToggle(e.target.checked)}
        />
        <span>Extension Flower Power activée</span>
      </label>

      <div className="players-list">
        {names.map((name, i) => (
          <div className="player-row" key={i}>
            <input
              type="text"
              placeholder={`Joueur ${i + 1}`}
              value={name}
              onChange={(e) => updateName(i, e.target.value)}
            />
            {names.length > MIN_PLAYERS_BASE && (
              <button
                type="button"
                className="icon-button"
                aria-label="Retirer ce joueur"
                onClick={() => removePlayer(i)}
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>

      {names.length < max && (
        <button type="button" className="secondary" onClick={addPlayer}>
          + Ajouter un joueur
        </button>
      )}

      <p className="hint">
        {names.length}/{max} joueurs {extensionEnabled ? "(avec extension)" : "(sans extension, max 4)"}
      </p>

      {error && <p className="error">{error}</p>}

      <button type="submit" className="primary">
        Commencer la partie
      </button>
    </form>
  );
}
