import { resolveGameCover } from "../../utils/gameMedia";

export function MatchCard({ item, onOpenGame, isOpening = false }) {
  const gameCover = resolveGameCover({
    cover: item.gameCover,
    gameId: item.gameId,
    gameName: item.gameName,
  });
  const likedCount = Array.isArray(item.likedBy) ? item.likedBy.length : item.likedByNames?.length || 0;
  const totalMembers = Number(item.totalMembers || 0);

  return (
    <article className="match-card">
      <div className="match-card__cover">
        {gameCover ? (
          <img alt={`Capa de ${item.gameName}`} decoding="async" loading="lazy" src={gameCover} />
        ) : (
          <span>Sem capa</span>
        )}
      </div>

      <div className="match-card__body">
        <div className="match-card__title-row">
          <h4>{item.gameName || "Jogo"}</h4>
          {totalMembers ? (
            <span className="match-card__member-badge">
              {likedCount}/{totalMembers} membros
            </span>
          ) : null}
        </div>
        <p>
          {Array.isArray(item.likedByNames) && item.likedByNames.length
            ? item.likedByNames.join(", ")
            : "Match salvo"}
        </p>
      </div>

      <button
        className="button button--ghost"
        type="button"
        disabled={isOpening}
        onClick={() => onOpenGame(item)}
      >
        {isOpening ? "Abrindo..." : "Página do jogo"}
      </button>
    </article>
  );
}
