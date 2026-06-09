import { describe, expect, it } from "vitest";
import { FALLBACK_GAME_COVERS, resolveGameCover } from "./gameMedia";

describe("gameMedia", () => {
  it("mantem a capa direta quando existe", () => {
    expect(resolveGameCover({ cover: "https://example.com/cover.jpg", name: "Hades" })).toBe(
      "https://example.com/cover.jpg"
    );
  });

  it("resolve capas fallback por id e por nome", () => {
    expect(resolveGameCover({ id: "fallback-hades" })).toBe(FALLBACK_GAME_COVERS["fallback-hades"]);
    expect(resolveGameCover({ gameName: "Stardew Valley" })).toBe(FALLBACK_GAME_COVERS["fallback-stardew"]);
  });
});
