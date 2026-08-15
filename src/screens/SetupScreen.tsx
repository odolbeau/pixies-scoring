import { useState } from "react";
import { maxPlayersFor, MIN_PLAYERS_BASE } from "../domain/game";
import { sortRosterByName } from "../domain/roster";
import { useGameStore } from "../store/useGameStore";

export function SetupScreen() {
  const startGame = useGameStore((s) => s.startGame);
  const roster = useGameStore((s) => s.roster);
  const addRosterPlayer = useGameStore((s) => s.addRosterPlayer);
  const removeRosterPlayer = useGameStore((s) => s.removeRosterPlayer);

  const [extensionEnabled, setExtensionEnabled] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const max = maxPlayersFor(extensionEnabled);

  function toggleSelect(id: string) {
    setError(null);
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= max) {
        setError(`Maximum ${max} joueurs${extensionEnabled ? "" : " sans l'extension"}.`);
        return prev;
      }
      return [...prev, id];
    });
  }

  async function handleAddNew() {
    setError(null);
    const trimmed = newName.trim();
    if (!trimmed) return;

    try {
      const player = await addRosterPlayer(trimmed);
      setNewName("");
      setSelectedIds((prev) => {
        if (prev.includes(player.id)) return prev;
        if (prev.length >= max) {
          setError(
            `${player.name} ajouté·e à la liste, mais ${max} joueurs sont déjà sélectionnés.`,
          );
          return prev;
        }
        return [...prev, player.id];
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleRemoveFromRoster(id: string, name: string) {
    if (!confirm(`Retirer ${name} de la liste des joueurs ?`)) return;
    await removeRosterPlayer(id);
    setSelectedIds((prev) => prev.filter((x) => x !== id));
  }

  function handleExtensionToggle(checked: boolean) {
    setExtensionEnabled(checked);
    const newMax = maxPlayersFor(checked);
    if (selectedIds.length > newMax) {
      setSelectedIds((prev) => prev.slice(0, newMax));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (selectedIds.length < MIN_PLAYERS_BASE) {
      setError(`Sélectionne au moins ${MIN_PLAYERS_BASE} joueurs.`);
      return;
    }

    const names = selectedIds
      .map((id) => roster.find((p) => p.id === id)?.name)
      .filter((n): n is string => Boolean(n));

    try {
      await startGame(names, extensionEnabled);
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

      <h2>Joueurs</h2>

      {roster.length === 0 ? (
        <p className="hint">Ajoute des joueurs ci-dessous pour commencer.</p>
      ) : (
        <div className="roster-grid">
          {sortRosterByName(roster).map((p) => {
            const selected = selectedIds.includes(p.id);
            return (
              <button
                type="button"
                key={p.id}
                className={selected ? "roster-chip selected" : "roster-chip"}
                onClick={() => toggleSelect(p.id)}
              >
                <span>{p.name}</span>
                <span
                  role="button"
                  tabIndex={0}
                  aria-label={`Retirer ${p.name} de la liste`}
                  className="roster-chip-remove"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveFromRoster(p.id, p.name);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.stopPropagation();
                      e.preventDefault();
                      handleRemoveFromRoster(p.id, p.name);
                    }
                  }}
                >
                  ✕
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="add-player-row">
        <input
          type="text"
          placeholder="Nom d'un nouveau joueur"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAddNew();
            }
          }}
        />
        <button type="button" className="secondary" onClick={handleAddNew}>
          + Ajouter
        </button>
      </div>

      <p className="hint">
        {selectedIds.length}/{max} joueurs sélectionnés{" "}
        {extensionEnabled ? "(avec extension)" : "(sans extension, max 4)"}
      </p>

      {error && <p className="error">{error}</p>}

      <button type="submit" className="primary">
        Commencer la partie
      </button>
    </form>
  );
}
