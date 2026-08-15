import { create } from "zustand";
import { createGame, submitRound, type GameState } from "../domain/game";
import type { RoundScoreInput } from "../domain/scoring";
import {
  clearCurrentGame,
  loadCurrentGame,
  loadHistory,
  saveCurrentGame,
  saveToHistory,
  deleteFromHistory as deleteFromHistoryDb,
} from "../storage/db";

interface GameStore {
  /** undefined tant que le chargement initial depuis IndexedDB n'est pas fait. */
  hydrated: boolean;
  currentGame: GameState | null;
  history: GameState[];

  hydrate: () => Promise<void>;
  startGame: (playerNames: string[], extensionEnabled: boolean) => Promise<void>;
  submitRoundScores: (scores: Record<string, RoundScoreInput>) => Promise<void>;
  abandonGame: () => Promise<void>;
  startNewGameFromResult: () => Promise<void>;
  deleteFromHistory: (id: string) => Promise<void>;
}

export const useGameStore = create<GameStore>((set, get) => ({
  hydrated: false,
  currentGame: null,
  history: [],

  hydrate: async () => {
    const [currentGame, history] = await Promise.all([loadCurrentGame(), loadHistory()]);
    set({ currentGame: currentGame ?? null, history, hydrated: true });
  },

  startGame: async (playerNames, extensionEnabled) => {
    const game = createGame(playerNames, extensionEnabled);
    await saveCurrentGame(game);
    set({ currentGame: game });
  },

  submitRoundScores: async (scores) => {
    const game = get().currentGame;
    if (!game) throw new Error("Aucune partie en cours.");
    const updated = submitRound(game, scores);

    if (updated.status === "finished") {
      await saveToHistory(updated);
      await clearCurrentGame();
      set({ currentGame: updated, history: [updated, ...get().history] });
    } else {
      await saveCurrentGame(updated);
      set({ currentGame: updated });
    }
  },

  abandonGame: async () => {
    await clearCurrentGame();
    set({ currentGame: null });
  },

  startNewGameFromResult: async () => {
    await clearCurrentGame();
    set({ currentGame: null });
  },

  deleteFromHistory: async (id) => {
    await deleteFromHistoryDb(id);
    set({ history: get().history.filter((g) => g.id !== id) });
  },
}));
