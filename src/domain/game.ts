import {
  computeRoundScore,
  EMPTY_ROUND_SCORE_INPUT,
  ROUND_NUMBERS,
  type RoundNumber,
  type RoundScoreInput,
  type ScoringOptions,
} from "./scoring";
import { generateId } from "../lib/id";

export const MIN_PLAYERS_BASE = 2;
export const MAX_PLAYERS_BASE = 4;
export const MAX_PLAYERS_EXTENSION = 6;

export interface Player {
  id: string;
  name: string;
}

export type GameStatus = "in_progress" | "finished";

export interface GameState {
  id: string;
  createdAt: string;
  finishedAt?: string;
  status: GameStatus;
  extensionEnabled: boolean;
  /** Extension Little Giants (absent des parties créées avant son ajout). */
  littleGiantsEnabled?: boolean;
  players: Player[];
  /** rounds[roundIndex][playerId] = saisie de ce joueur pour cette manche. */
  rounds: Record<string, RoundScoreInput>[];
}

export function maxPlayersFor(extensionEnabled: boolean, littleGiantsEnabled = false): number {
  return extensionEnabled || littleGiantsEnabled ? MAX_PLAYERS_EXTENSION : MAX_PLAYERS_BASE;
}

export function scoringOptionsFor(game: GameState): ScoringOptions {
  return { flowerPower: game.extensionEnabled, littleGiants: game.littleGiantsEnabled ?? false };
}

export function createGame(
  playerNames: string[],
  extensionEnabled: boolean,
  littleGiantsEnabled = false,
): GameState {
  if (playerNames.length < MIN_PLAYERS_BASE) {
    throw new Error(`Il faut au moins ${MIN_PLAYERS_BASE} joueurs.`);
  }
  const max = maxPlayersFor(extensionEnabled, littleGiantsEnabled);
  if (playerNames.length > max) {
    throw new Error(`Maximum ${max} joueurs${extensionEnabled || littleGiantsEnabled ? "" : " sans extension"}.`);
  }

  const players: Player[] = playerNames.map((name) => ({
    id: generateId(),
    name: name.trim(),
  }));

  return {
    id: generateId(),
    createdAt: new Date().toISOString(),
    status: "in_progress",
    extensionEnabled,
    littleGiantsEnabled,
    players,
    rounds: [],
  };
}

export function currentRoundNumber(game: GameState): RoundNumber | null {
  if (game.rounds.length >= ROUND_NUMBERS.length) return null;
  return ROUND_NUMBERS[game.rounds.length];
}

/**
 * Enregistre le score de la manche en cours (une entrée par joueur) et fait
 * passer la partie en statut "finished" si c'était la 3e manche.
 */
export function submitRound(
  game: GameState,
  scoresByPlayerId: Record<string, RoundScoreInput>,
): GameState {
  const round = currentRoundNumber(game);
  if (round === null) {
    throw new Error("La partie est déjà terminée (3 manches jouées).");
  }
  for (const player of game.players) {
    if (!scoresByPlayerId[player.id]) {
      throw new Error(`Score manquant pour ${player.name}.`);
    }
  }

  const rounds = [...game.rounds, scoresByPlayerId];
  const finished = rounds.length >= ROUND_NUMBERS.length;

  return {
    ...game,
    rounds,
    status: finished ? "finished" : "in_progress",
    finishedAt: finished ? new Date().toISOString() : undefined,
  };
}

export interface PlayerStanding {
  player: Player;
  roundTotals: number[];
  cumulativeTotal: number;
  /** 1 = premier, ex-aequo partagent le même rang. */
  rank: number;
  isWinner: boolean;
}

/** Calcule le classement courant (utilisable manche par manche ou en fin de partie). */
export function getStandings(game: GameState): PlayerStanding[] {
  const totalsByPlayer = new Map<string, number[]>(
    game.players.map((p) => [p.id, []]),
  );

  game.rounds.forEach((roundScores, roundIndex) => {
    const round = ROUND_NUMBERS[roundIndex];
    for (const player of game.players) {
      const input = roundScores[player.id] ?? EMPTY_ROUND_SCORE_INPUT;
      const { roundTotal } = computeRoundScore(input, round, scoringOptionsFor(game));
      totalsByPlayer.get(player.id)!.push(roundTotal);
    }
  });

  const unranked = game.players.map((player) => {
    const roundTotals = totalsByPlayer.get(player.id)!;
    const cumulativeTotal = roundTotals.reduce((sum, t) => sum + t, 0);
    return { player, roundTotals, cumulativeTotal };
  });

  const sorted = [...unranked].sort((a, b) => b.cumulativeTotal - a.cumulativeTotal);

  const isGameFinished = game.status === "finished";
  const bestTotal = sorted[0]?.cumulativeTotal;

  let rank = 0;
  let previousTotal: number | null = null;
  return sorted.map((entry, index) => {
    if (previousTotal === null || entry.cumulativeTotal !== previousTotal) {
      rank = index + 1;
      previousTotal = entry.cumulativeTotal;
    }
    return {
      ...entry,
      rank,
      isWinner: isGameFinished && entry.cumulativeTotal === bestTotal,
    };
  });
}
