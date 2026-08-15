import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { GameState } from "../domain/game";

interface PixiesDB extends DBSchema {
  /** Une seule entrée, clé fixe "current" : la partie en cours (ou absente). */
  currentGame: {
    key: string;
    value: GameState;
  };
  /** Historique des parties terminées, indexé par id. */
  history: {
    key: string;
    value: GameState;
    indexes: { byCreatedAt: string };
  };
}

const DB_NAME = "pixies-scores";
const DB_VERSION = 1;
const CURRENT_GAME_KEY = "current";

let dbPromise: Promise<IDBPDatabase<PixiesDB>> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<PixiesDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore("currentGame");
        const historyStore = db.createObjectStore("history", { keyPath: "id" });
        historyStore.createIndex("byCreatedAt", "createdAt");
      },
    });
  }
  return dbPromise;
}

export async function loadCurrentGame(): Promise<GameState | undefined> {
  const db = await getDb();
  return db.get("currentGame", CURRENT_GAME_KEY);
}

export async function saveCurrentGame(game: GameState): Promise<void> {
  const db = await getDb();
  await db.put("currentGame", game, CURRENT_GAME_KEY);
}

export async function clearCurrentGame(): Promise<void> {
  const db = await getDb();
  await db.delete("currentGame", CURRENT_GAME_KEY);
}

export async function saveToHistory(game: GameState): Promise<void> {
  const db = await getDb();
  await db.put("history", game);
}

export async function loadHistory(): Promise<GameState[]> {
  const db = await getDb();
  const all = await db.getAllFromIndex("history", "byCreatedAt");
  return all.reverse(); // plus récent d'abord
}

export async function deleteFromHistory(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("history", id);
}
