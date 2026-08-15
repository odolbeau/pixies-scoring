import { getStandings, type GameState } from "../domain/game";
import { Scoreboard } from "../components/Scoreboard";
import { useGameStore } from "../store/useGameStore";

interface ResultScreenProps {
  game: GameState;
}

export function ResultScreen({ game }: ResultScreenProps) {
  const startNewGameFromResult = useGameStore((s) => s.startNewGameFromResult);
  const standings = getStandings(game);
  const winners = standings.filter((s) => s.isWinner);

  return (
    <div className="result-screen">
      <h1>Partie terminée !</h1>
      <p className="winner-announcement">
        {winners.length > 1
          ? `Égalité entre ${winners.map((w) => w.player.name).join(" et ")} 🏆`
          : `${winners[0]?.player.name} remporte la partie ! 🏆`}
      </p>

      <Scoreboard game={game} />

      <button type="button" className="primary" onClick={() => startNewGameFromResult()}>
        Nouvelle partie
      </button>
    </div>
  );
}
