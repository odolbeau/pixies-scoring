import { describe, expect, it } from "vitest";
import { EMPTY_ROUND_SCORE_INPUT } from "./scoring";
import {
  createGame,
  currentRoundNumber,
  getStandings,
  maxPlayersFor,
  submitRound,
} from "./game";

function names(n: number) {
  return Array.from({ length: n }, (_, i) => `Joueur ${i + 1}`);
}

describe("createGame", () => {
  it("refuse moins de 2 joueurs", () => {
    expect(() => createGame(names(1), false)).toThrow();
  });

  it("refuse plus de 4 joueurs sans extension", () => {
    expect(() => createGame(names(5), false)).toThrow();
  });

  it("autorise jusqu'à 6 joueurs avec l'extension", () => {
    expect(() => createGame(names(6), true)).not.toThrow();
    expect(() => createGame(names(7), true)).toThrow();
  });

  it("Little Giants seul autorise 6 joueurs", () => {
    expect(() => createGame(names(6), false, true)).not.toThrow();
    expect(() => createGame(names(7), false, true)).toThrow();
    expect(maxPlayersFor(false, true)).toBe(6);
  });

  it("maxPlayersFor reflète la règle de base/extension", () => {
    expect(maxPlayersFor(false)).toBe(4);
    expect(maxPlayersFor(true)).toBe(6);
  });
});

describe("submitRound / currentRoundNumber", () => {
  it("avance manche par manche puis termine la partie", () => {
    let game = createGame(names(2), false);
    expect(currentRoundNumber(game)).toBe(1);

    const scoresRound1 = Object.fromEntries(
      game.players.map((p) => [p.id, { ...EMPTY_ROUND_SCORE_INPUT, validatedCardsSum: 10 }]),
    );
    game = submitRound(game, scoresRound1);
    expect(game.status).toBe("in_progress");
    expect(currentRoundNumber(game)).toBe(2);

    const scoresRound2 = Object.fromEntries(
      game.players.map((p) => [p.id, { ...EMPTY_ROUND_SCORE_INPUT, validatedCardsSum: 5 }]),
    );
    game = submitRound(game, scoresRound2);
    expect(currentRoundNumber(game)).toBe(3);

    const scoresRound3 = Object.fromEntries(
      game.players.map((p) => [p.id, { ...EMPTY_ROUND_SCORE_INPUT, validatedCardsSum: 1 }]),
    );
    game = submitRound(game, scoresRound3);
    expect(currentRoundNumber(game)).toBeNull();
    expect(game.status).toBe("finished");
    expect(game.finishedAt).toBeDefined();
  });

  it("rejette une saisie avec un joueur manquant", () => {
    const game = createGame(names(2), false);
    const onlyOnePlayer = { [game.players[0].id]: EMPTY_ROUND_SCORE_INPUT };
    expect(() => submitRound(game, onlyOnePlayer)).toThrow();
  });

  it("rejette une soumission au delà de la 3e manche", () => {
    let game = createGame(names(2), false);
    for (let i = 0; i < 3; i++) {
      const scores = Object.fromEntries(
        game.players.map((p) => [p.id, EMPTY_ROUND_SCORE_INPUT]),
      );
      game = submitRound(game, scores);
    }
    const scores = Object.fromEntries(
      game.players.map((p) => [p.id, EMPTY_ROUND_SCORE_INPUT]),
    );
    expect(() => submitRound(game, scores)).toThrow();
  });
});

describe("getStandings", () => {
  it("classe les joueurs par score cumulé décroissant", () => {
    let game = createGame(["Alice", "Bob"], false);
    const [alice, bob] = game.players;

    game = submitRound(game, {
      [alice.id]: { ...EMPTY_ROUND_SCORE_INPUT, validatedCardsSum: 20 },
      [bob.id]: { ...EMPTY_ROUND_SCORE_INPUT, validatedCardsSum: 10 },
    });

    const standings = getStandings(game);
    expect(standings[0].player.name).toBe("Alice");
    expect(standings[0].rank).toBe(1);
    expect(standings[1].player.name).toBe("Bob");
    expect(standings[1].rank).toBe(2);
  });

  it("gère les ex-aequo (même rang, isWinner partagé en fin de partie)", () => {
    let game = createGame(["Alice", "Bob"], false);
    const [alice, bob] = game.players;

    for (let i = 0; i < 3; i++) {
      game = submitRound(game, {
        [alice.id]: { ...EMPTY_ROUND_SCORE_INPUT, validatedCardsSum: 10 },
        [bob.id]: { ...EMPTY_ROUND_SCORE_INPUT, validatedCardsSum: 10 },
      });
    }

    const standings = getStandings(game);
    expect(standings[0].rank).toBe(1);
    expect(standings[1].rank).toBe(1);
    expect(standings[0].isWinner).toBe(true);
    expect(standings[1].isWinner).toBe(true);
  });

  it("isWinner reste false tant que la partie n'est pas finie", () => {
    let game = createGame(["Alice", "Bob"], false);
    const [alice, bob] = game.players;
    game = submitRound(game, {
      [alice.id]: { ...EMPTY_ROUND_SCORE_INPUT, validatedCardsSum: 20 },
      [bob.id]: { ...EMPTY_ROUND_SCORE_INPUT, validatedCardsSum: 10 },
    });
    const standings = getStandings(game);
    expect(standings.every((s) => !s.isWinner)).toBe(true);
  });
});
