import { describe, expect, it } from "vitest";
import { fallbackNickname, isValidEmail, normalizeRoomId } from "./validators";

describe("validators", () => {
  it("normaliza codigo de sala para letras e numeros em caixa alta", () => {
    expect(normalizeRoomId(" ab-12 cd!! ")).toBe("AB12CD");
  });

  it("remove espacos, hifens e caracteres especiais do codigo", () => {
    expect(normalizeRoomId(" a b-c_d@1#2 ")).toBe("ABCD12");
  });

  it("limita codigo de sala a oito caracteres", () => {
    expect(normalizeRoomId("abcdefghi123")).toBe("ABCDEFGH");
    expect(normalizeRoomId("12-34-56-78-90")).toBe("12345678");
  });

  it("valida emails comuns", () => {
    expect(isValidEmail("player@example.com")).toBe(true);
    expect(isValidEmail("player@")).toBe(false);
  });

  it("gera apelido a partir do prefixo do email", () => {
    expect(fallbackNickname("andre@example.com")).toBe("andre");
    expect(fallbackNickname("")).toBe("jogador");
  });
});
