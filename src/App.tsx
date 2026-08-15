import { useEffect, useState } from "react";
import { useGameStore } from "./store/useGameStore";
import { SetupScreen } from "./screens/SetupScreen";
import { PlayScreen } from "./screens/PlayScreen";
import { ResultScreen } from "./screens/ResultScreen";
import { HistoryScreen } from "./screens/HistoryScreen";

type View = "game" | "history";

function App() {
  const hydrated = useGameStore((s) => s.hydrated);
  const currentGame = useGameStore((s) => s.currentGame);
  const hydrate = useGameStore((s) => s.hydrate);
  const [view, setView] = useState<View>("game");

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (!hydrated) {
    return (
      <div className="app-loading">
        <p>Chargement…</p>
      </div>
    );
  }

  return (
    <div className="app">
      <nav className="app-nav">
        <span className="app-title">🧚 Pixies Score</span>
        <div className="app-nav-links">
          <button
            type="button"
            className={view === "game" ? "nav-link active" : "nav-link"}
            onClick={() => setView("game")}
          >
            Partie
          </button>
          <button
            type="button"
            className={view === "history" ? "nav-link active" : "nav-link"}
            onClick={() => setView("history")}
          >
            Historique
          </button>
        </div>
      </nav>

      <main className="app-main">
        {view === "history" ? (
          <HistoryScreen />
        ) : !currentGame ? (
          <SetupScreen />
        ) : currentGame.status === "finished" ? (
          <ResultScreen game={currentGame} />
        ) : (
          <PlayScreen game={currentGame} />
        )}
      </main>
    </div>
  );
}

export default App;
