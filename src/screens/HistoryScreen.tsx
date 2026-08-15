import { useState } from "react";
import { getStandings } from "../domain/game";
import { Scoreboard } from "../components/Scoreboard";
import { useGameStore } from "../store/useGameStore";

export function HistoryScreen() {
  const history = useGameStore((s) => s.history);
  const deleteFromHistory = useGameStore((s) => s.deleteFromHistory);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (history.length === 0) {
    return (
      <div className="history-screen">
        <h1>Historique</h1>
        <p className="hint">Aucune partie terminée pour le moment.</p>
      </div>
    );
  }

  return (
    <div className="history-screen">
      <h1>Historique</h1>
      <ul className="history-list">
        {history.map((game) => {
          const standings = getStandings(game);
          const winners = standings.filter((s) => s.isWinner);
          const isExpanded = expandedId === game.id;
          return (
            <li key={game.id} className="history-item">
              <button
                type="button"
                className="history-item-summary"
                onClick={() => setExpandedId(isExpanded ? null : game.id)}
              >
                <span className="history-date">
                  {new Date(game.createdAt).toLocaleDateString("fr-FR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })}
                </span>
                <span className="history-winner">
                  🏆 {winners.map((w) => w.player.name).join(" & ")}
                </span>
                <span className="history-meta">
                  {game.players.length} joueurs{game.extensionEnabled ? " · Extension" : ""}
                </span>
              </button>

              {isExpanded && (
                <div className="history-detail">
                  <Scoreboard game={game} />
                  <button
                    type="button"
                    className="text-button danger"
                    onClick={() => {
                      if (confirm("Supprimer cette partie de l'historique ?")) {
                        deleteFromHistory(game.id);
                      }
                    }}
                  >
                    Supprimer de l'historique
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
