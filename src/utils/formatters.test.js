import { describe, expect, it } from "vitest";
import { formatDate, formatRating, groupHistoryByRoom, pluralize } from "./formatters";

describe("formatters", () => {
  it("formata notas com uma casa decimal", () => {
    expect(formatRating(4.25)).toBe("4.3");
    expect(formatRating(0)).toBe("N/A");
    expect(formatRating(null)).toBe("N/A");
    expect(formatRating(3.76)).toBe("3.8");
  });

  it("formata datas de fontes validas e ignora entradas invalidas", () => {
    expect(formatDate("2024-01-15T12:00:00Z")).toContain("2024");
    expect(formatDate(new Date("2024-01-15T12:00:00Z"))).toContain("2024");
    expect(formatDate("data quebrada")).toBe("Sem data");
  });

  it("pluraliza usando o contador original", () => {
    expect(pluralize(1, "membro", "membros")).toBe("1 membro");
    expect(pluralize(3, "membro", "membros")).toBe("3 membros");
  });

  it("agrupa historico por sala e ordena pela data mais recente", () => {
    const folders = groupHistoryByRoom([
      {
        id: "old",
        roomId: "AAA111",
        folderName: "Sala AAA111",
        createdAt: { seconds: 10 },
      },
      {
        id: "new",
        roomId: "BBB222",
        folderName: "Sala BBB222",
        createdAt: { seconds: 20 },
      },
    ]);

    expect(folders.map((folder) => folder.key)).toEqual(["BBB222", "AAA111"]);
  });

  it("agrupa itens sem sala em uma pasta dedicada", () => {
    const folders = groupHistoryByRoom([
      {
        id: "loose",
        createdAt: { seconds: 10 },
      },
    ]);

    expect(folders[0]).toMatchObject({
      key: "sem-sala",
      title: "Sala Sem sala",
    });
  });
});
