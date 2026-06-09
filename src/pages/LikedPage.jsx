import { useDeferredValue, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState } from "../components/shared/EmptyState";
import { useAppContext } from "../app/AppProvider";
import { usePageTitle } from "../hooks/usePageTitle";
import { fetchPreferredGameUrl, fetchTrailerUrl } from "../services/rawg";
import { formatRating } from "../utils/formatters";
import { resolveGameCover } from "../utils/gameMedia";
import { openExternal } from "../utils/openExternal";
import { shareGame } from "../utils/shareGame";

function resolveSummary(game) {
  if (Array.isArray(game.genres) && game.genres.length) {
    return game.genres.join(" • ");
  }

  return game.shortDesc || "Sem resumo salvo.";
}

function resolveLikedAt(game) {
  if (typeof game.likedAt === "number") {
    return game.likedAt;
  }

  return Number(game.likedAt?.seconds || 0) * 1000;
}

function LikedSkeleton() {
  return (
    <section className="liked-grid">
      {Array.from({ length: 6 }).map((_, index) => (
        <article key={index} className="liked-card liked-card--skeleton" aria-hidden="true">
          <div className="liked-card__media skeleton-block" />
          <div className="liked-card__body">
            <div className="skeleton-line skeleton-line--wide" />
            <div className="skeleton-line skeleton-line--narrow" />
          </div>
        </article>
      ))}
    </section>
  );
}

export function LikedPage() {
  usePageTitle("Curtidos");

  const { isLikedGamesLoading, likedGames, notify, removeLikedGame } = useAppContext();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("likedAt");
  const [openingGameId, setOpeningGameId] = useState("");
  const [openingTrailerId, setOpeningTrailerId] = useState("");
  const [removingId, setRemovingId] = useState("");
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());

  const filteredGames = useMemo(() => {
    if (!deferredSearch) {
      return likedGames;
    }

    return likedGames.filter((game) => {
      const haystack = `${game.name} ${game.shortDesc} ${(game.genres || []).join(" ")}`.toLowerCase();
      return haystack.includes(deferredSearch);
    });
  }, [likedGames, deferredSearch]);

  const sortedGames = useMemo(() => {
    return [...filteredGames].sort((left, right) => {
      if (sortBy === "name") {
        return String(left.name || "").localeCompare(String(right.name || ""), "pt-BR");
      }

      if (sortBy === "rating") {
        return Number(right.rating || 0) - Number(left.rating || 0);
      }

      return resolveLikedAt(right) - resolveLikedAt(left);
    });
  }, [filteredGames, sortBy]);

  async function openTrailer(game) {
    const itemId = String(game.id);
    try {
      setOpeningTrailerId(itemId);
      const url = await fetchTrailerUrl(game.id, game.name);
      openExternal(url);
    } catch {
      notify({
        title: "Trailer não encontrado",
        description: "Vamos abrir a busca no YouTube.",
        tone: "warning",
      });
      openExternal(
        `https://www.youtube.com/results?search_query=${encodeURIComponent(`${game.name} trailer`)}`
      );
    } finally {
      setOpeningTrailerId("");
    }
  }

  async function openGame(game) {
    const itemId = String(game.id);
    try {
      setOpeningGameId(itemId);
      const url = await fetchPreferredGameUrl(game.id, game.name);
      openExternal(url);
    } catch {
      openExternal(`https://rawg.io/search?query=${encodeURIComponent(game.name)}`);
    } finally {
      setOpeningGameId("");
    }
  }

  async function handleRemove(game) {
    const itemId = String(game.id);
    try {
      setRemovingId(itemId);
      await removeLikedGame(game.id);
      notify({
        title: "Curtida removida",
        description: `${game.name} saiu da sua biblioteca.`,
        tone: "neutral",
      });
    } catch {
      notify({
        title: "Não foi possível remover",
        description: "Sua biblioteca foi restaurada. Tente novamente em alguns segundos.",
        tone: "danger",
      });
    } finally {
      setRemovingId("");
    }
  }

  async function handleShare(game) {
    await shareGame(game, notify);
  }

  return (
    <div className="stack-page">
      <section className="surface surface--hero">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Curtidos</p>
            <h3>Sua biblioteca pessoal de favoritos.</h3>
          </div>
        </div>

        <div className="discover-toolbar">
          <label className="field field--compact field--search">
            <span>Buscar na biblioteca</span>
            <input
              placeholder="Procure por nome, gênero ou resumo"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>

          <article className="stat-card stat-card--inline">
            <strong>{likedGames.length}</strong>
            <span>Jogos salvos</span>
          </article>

          <article className="stat-card stat-card--inline">
            <strong>{filteredGames.length}</strong>
            <span>Resultados atuais</span>
          </article>

          <label className="field field--compact">
            <span>Ordenar por</span>
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
              <option value="likedAt">Data da curtida</option>
              <option value="name">Nome A-Z</option>
              <option value="rating">Nota</option>
            </select>
          </label>
        </div>
      </section>

      {isLikedGamesLoading ? (
        <LikedSkeleton />
      ) : sortedGames.length ? (
        <section className="liked-grid">
          {sortedGames.map((game) => {
            const cover = resolveGameCover(game);
            const isRemoving = removingId === String(game.id);

            return (
              <article className={`liked-card${isRemoving ? " liked-card--removing" : ""}`} key={game.id}>
                <div className="liked-card__media">
                  {cover ? (
                    <img alt={`Capa de ${game.name}`} decoding="async" loading="lazy" src={cover} />
                  ) : (
                    <span aria-hidden="true" />
                  )}
                </div>

                <div className="liked-card__body">
                  <div className="liked-card__header">
                    <div className="liked-card__title-row">
                      <h4>{game.name}</h4>
                      <span className="liked-card__rating" aria-label={`Nota ${formatRating(game.rating)}`}>
                        {formatRating(game.rating)}
                      </span>
                    </div>
                    <p>{resolveSummary(game)}</p>
                  </div>

                  <div className="liked-card__actions">
                    <button
                      className="button button--ghost"
                      disabled={openingGameId === String(game.id)}
                      type="button"
                      onClick={() => openGame(game)}
                    >
                      {openingGameId === String(game.id) ? "Abrindo... " : ""}
                      Página do jogo
                    </button>
                    <button
                      className="button button--ghost"
                      disabled={openingTrailerId === String(game.id)}
                      type="button"
                      onClick={() => openTrailer(game)}
                    >
                      {openingTrailerId === String(game.id) ? "Buscando..." : "Trailer"}
                    </button>
                    <button className="button button--ghost" type="button" onClick={() => handleShare(game)}>
                      Compartilhar
                    </button>
                    <button
                      className="button button--secondary"
                      disabled={isRemoving}
                      type="button"
                      onClick={() => handleRemove(game)}
                    >
                      {isRemoving ? "Removendo..." : "Remover"}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <EmptyState
          eyebrow="Sem favoritos"
          title="Sua biblioteca ainda está vazia."
          description="Curta alguns jogos na descoberta para montar sua lista."
          action={
            <Link className="button button--primary" to="/discover">
              Ir para descoberta
            </Link>
          }
        />
      )}
    </div>
  );
}
