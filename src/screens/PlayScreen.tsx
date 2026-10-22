import { useState } from "react";
import {
  currentRoundNumber,
  type GameState,
} from "../domain/game";
import {
  EMPTY_ROUND_SCORE_INPUT,
  validateRoundScoreInput,
  type RoundScoreInput,
} from "../domain/scoring";
import { RoundScoreForm } from "../components/RoundScoreForm";
import { Scoreboard } from "../components/Scoreboard";
import { useGameStore } from "../store/useGameStore";

interface PlayScreenProps {
  game: GameState;
}

export function PlayScreen({ game }: PlayScreenProps) {
  const submitRoundScores = useGameStore((s) => s.submitRoundScores);
  const abandonGame = useGameStore((s) => s.abandonGame);

  const round = currentRoundNumber(game);
  const [draft, setDraft] = useState<Record<string, RoundScoreInput>>(() =>
    Object.fromEntries(game.players.map((p) => [p.id, { ...EMPTY_ROUND_SCORE_INPUT }])),
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (round === null) {
    // Ne devrait pas arriver (App bascule vers ResultScreen quand la partie est finie).
    return null;
  }

  async function handleSubmit() {
    setError(null);
    for (const player of game.players) {
      const errors = validateRoundScoreInput(draft[player.id]);
      if (errors.length > 0) {
        setError(`${player.name} : ${errors.join(" ")}`);
        return;
      }
    }

    setSubmitting(true);
    try {
      await submitRoundScores(draft);
      setDraft(
        Object.fromEntries(game.players.map((p) => [p.id, { ...EMPTY_ROUND_SCORE_INPUT }])),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="play-screen">
      <header className="play-header">
        <h1>Manche {round} / 3</h1>
        <button
          type="button"
          className="text-button"
          onClick={() => {
            if (confirm("Abandonner cette partie ? Elle ne sera pas enregistrée dans l'historique.")) {
              abandonGame();
            }
          }}
        >
          Abandonner la partie
        </button>
      </header>

      {game.rounds.length > 0 && (
        <section className="scoreboard-section">
          <h2>Scores jusqu'à présent</h2>
          <Scoreboard game={game} />
        </section>
      )}

      <section className="round-entry-section">
        <h2>Saisir les scores de la manche {round}</h2>
        {game.players.map((player) => (
          <RoundScoreForm
            key={player.id}
            player={player}
            round={round}
            extensionEnabled={game.extensionEnabled}
            littleGiantsEnabled={game.littleGiantsEnabled ?? false}
            value={draft[player.id]}
            onChange={(value) => setDraft((prev) => ({ ...prev, [player.id]: value }))}
          />
        ))}

        {error && <p className="error">{error}</p>}

        <button type="button" className="primary" onClick={handleSubmit} disabled={submitting}>
          {round < 3 ? "Valider la manche" : "Valider et terminer la partie"}
        </button>
      </section>
    </div>
  );
}
