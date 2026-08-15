import { describe, expect, it } from "vitest";
import { generateId } from "./id";

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("generateId", () => {
  it("génère un UUID v4 valide via crypto.randomUUID quand disponible", () => {
    expect(generateId()).toMatch(UUID_V4_RE);
  });

  it("génère des id uniques", () => {
    const ids = new Set(Array.from({ length: 1000 }, () => generateId()));
    expect(ids.size).toBe(1000);
  });

  it("retombe sur crypto.getRandomValues si randomUUID est absent (contexte non sécurisé, ex. HTTP)", () => {
    const original = crypto.randomUUID;
    // @ts-expect-error simule un navigateur/contexte sans randomUUID
    delete crypto.randomUUID;

    try {
      expect(generateId()).toMatch(UUID_V4_RE);
    } finally {
      crypto.randomUUID = original;
    }
  });
});
