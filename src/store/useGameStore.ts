import { create } from "zustand";
import { createGame, submitRound, type GameState } from "../domain/game";
import type { RoundScoreInput } from "../domain/scoring";
import { findByName, normalizePlayerName, sortRosterByName, type RosterPlayer } from "../domain/roster";
import { generateId } from "../lib/id";
import {
  clearCurrentGame,
  loadCurrentGame,
  loadHistory,
  loadRoster,
  saveCurrentGame,
  saveToHistory,
  saveRosterPlayer,
  deleteRosterPlayer,
  deleteFromHistory as deleteFromHistoryDb,
} from "../storage/db";

interface GameStore {
  /** undefined tant que le chargement initial depuis IndexedDB n'est pas fait. */
  hydrated: boolean;
  currentGame: GameState | null;
  history: GameState[];
  roster: RosterPlayer[];

  hydrate: () => Promise<void>;
  startGame: (playerNames: string[], extensionEnabled: boolean) => Promise<void>;
  submitRoundScores: (scores: Record<string, RoundScoreInput>) => Promise<void>;
  abandonGame: () => Promise<void>;
  startNewGameFromResult: () => Promise<void>;
  deleteFromHistory: (id: string) => Promise<void>;
  /** Ajoute un joueur au roster (ou renvoie l'existant si le nom matche déjà). */
  addRosterPlayer: (name: string) => Promise<RosterPlayer>;
  removeRosterPlayer: (id: string) => Promise<void>;
}

export const useGameStore = create<GameStore>((set, get) => ({
  hydrated: false,
  currentGame: null,
  history: [],
  roster: [],

  hydrate: async () => {
    const [currentGame, history, roster] = await Promise.all([
      loadCurrentGame(),
      loadHistory(),
      loadRoster(),
    ]);
    set({
      currentGame: currentGame ?? null,
      history,
      roster: sortRosterByName(roster),
      hydrated: true,
    });
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

  addRosterPlayer: async (rawName) => {
    const name = normalizePlayerName(rawName);
    if (!name) throw new Error("Le nom ne peut pas être vide.");

    const existing = findByName(get().roster, name);
    if (existing) return existing;

    const player: RosterPlayer = { id: generateId(), name };
    await saveRosterPlayer(player);
    set({ roster: sortRosterByName([...get().roster, player]) });
    return player;
  },

  removeRosterPlayer: async (id) => {
    await deleteRosterPlayer(id);
    set({ roster: get().roster.filter((p) => p.id !== id) });
  },
}));
