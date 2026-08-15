import { getStandings, type GameState } from "../domain/game";

interface ScoreboardProps {
  game: GameState;
}

export function Scoreboard({ game }: ScoreboardProps) {
  const standings = getStandings(game);
  const roundsPlayed = game.rounds.length;

  return (
    <div className="scoreboard">
      <table>
        <thead>
          <tr>
            <th>Rang</th>
            <th>Joueur</th>
            {Array.from({ length: roundsPlayed }, (_, i) => (
              <th key={i}>Manche {i + 1}</th>
            ))}
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((s) => (
            <tr key={s.player.id} className={s.isWinner ? "winner-row" : undefined}>
              <td>{s.rank}</td>
              <td>
                {s.player.name}
                {s.isWinner && " 🏆"}
              </td>
              {s.roundTotals.map((t, i) => (
                <td key={i}>{t}</td>
              ))}
              <td>
                <strong>{s.cumulativeTotal}</strong>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
