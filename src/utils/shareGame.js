import { formatRating } from "./formatters";

export async function shareGame(game, notify) {
  const text = `${game.name} — nota ${formatRating(game.rating)}\n${game.shortDesc || "Sem resumo."}`;
  const url = `https://rawg.io/games/${game.id}`;

  if (navigator.share) {
    try {
      await navigator.share({
        title: game.name,
        text,
        url,
      });
      return;
    } catch (error) {
      if (error?.name === "AbortError") {
        return;
      }
    }
  }

  const clipboardText = `${text}\n${url}`;
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(clipboardText);
  } else {
    window.prompt("Copie o link abaixo:", clipboardText);
  }

  notify?.({
    title: "Copiado!",
    description: `Link de ${game.name} copiado.`,
    tone: "success",
  });
}
