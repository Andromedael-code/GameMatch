import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GameDeck } from "../components/deck/GameDeck";
import { EmptyState } from "../components/shared/EmptyState";
import { LoaderScreen } from "../components/shared/LoaderScreen";
import { useAppContext } from "../app/AppProvider";
import { usePageTitle } from "../hooks/usePageTitle";
import { useStableCallback } from "../hooks/useStableCallback";
import { castVote } from "../services/rooms";
import { fetchGames, fetchPreferredGameUrl, fetchTrailerUrl } from "../services/rawg";
import { pluralize } from "../utils/formatters";
import { resolveGameCover } from "../utils/gameMedia";
import { openExternal } from "../utils/openExternal";
import { shareGame } from "../utils/shareGame";

function filterLikedGames(items, likedIdSet, extraBlockedIds = []) {
  if (!Array.isArray(items) || !items.length) {
    return [];
  }

  const blockedIds = new Set(extraBlockedIds.map((item) => String(item)));
  return items.filter((item) => {
    const id = String(item?.id || "");
    return id && !likedIdSet.has(id) && !blockedIds.has(id);
  });
}

export function DiscoverPage() {
  usePageTitle("Descoberta");

  const {
    addLikedGame,
    deckRefreshToken,
    isLiked,
    likedGames,
    notify,
    preferences,
    room,
    roomInfo,
    roomMembers,
    updatePreferences,
    user,
  } = useAppContext();

  const [games, setGames] = useState([]);
  const [index, setIndex] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isDeckLocked, setIsDeckLocked] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [autoSwipeRequest, setAutoSwipeRequest] = useState(null);
  const gamesRef = useRef([]);
  const indexRef = useRef(0);
  const pageRef = useRef(1);
  const loadingMoreRef = useRef(false);
  const loadingMorePromiseRef = useRef(null);
  const deckExhaustedRef = useRef(false);
  const voteLockRef = useRef(false);
  const autoSwipeIdRef = useRef(0);
  const catalogBasePageRef = useRef(Math.floor(Math.random() * 18) + 1);
  const likedIdSetRef = useRef(new Set());
  const likedIdSet = useMemo(() => new Set(likedGames.map((item) => String(item.id))), [likedGames]);

  const currentGame = games[index];
  const currentGameId = currentGame?.id;
  const nextGame = games[index + 1];
  const nextGameCover = nextGame ? resolveGameCover(nextGame) : "";
  const timerTotal = Number(roomInfo?.timerSeconds || 0);
  const timerProgress = timerTotal > 0 ? countdown / timerTotal : 1;

  useEffect(() => {
    gamesRef.current = games;
  }, [games]);

  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  useEffect(() => {
    likedIdSetRef.current = likedIdSet;
  }, [likedIdSet]);

  useEffect(() => {
    if (!nextGameCover) {
      return;
    }

    const image = new window.Image();
    image.src = nextGameCover;
  }, [nextGameCover]);

  const notifyLoadError = useCallback(() => {
    notify({
      title: "Falha ao carregar jogos",
      description: "Não foi possível atualizar a lista agora.",
      tone: "danger",
    });
  }, [notify]);

  const collectDeckGames = useCallback(
    async ({ startPage, minCount, maxAttempts, blockedIds = [], likedIds = new Set() }) => {
      const collected = [];
      const knownIds = new Set(blockedIds.map((item) => String(item)));
      let pageCursor = startPage;

      for (let attempt = 0; attempt < maxAttempts && collected.length < minCount; attempt += 1) {
        const batch = await fetchGames({
          allowAdult: preferences.allowAdult,
          page: pageCursor,
          pageSize: 10,
          ordering: "-added",
          basePage: catalogBasePageRef.current,
        });

        const validItems = filterLikedGames(batch, likedIds, [...knownIds]);
        validItems.forEach((item) => {
          const id = String(item.id);
          if (knownIds.has(id)) {
            return;
          }

          knownIds.add(id);
          collected.push(item);
        });

        pageCursor += 1;
      }

      return {
        items: collected,
        lastPage: Math.max(startPage, pageCursor - 1),
      };
    },
    [preferences.allowAdult]
  );

  const loadMoreIfNeeded = useCallback(
    async (nextIndex, force = false) => {
      const currentGames = gamesRef.current;

      if (loadingMoreRef.current) {
        return loadingMorePromiseRef.current;
      }

      if (deckExhaustedRef.current) {
        return currentGames;
      }

      if (!force && nextIndex < currentGames.length - 6) {
        return currentGames;
      }

      loadingMoreRef.current = true;
      setIsLoadingMore(true);

      const loadingPromise = (async () => {
        try {
          const { items, lastPage } = await collectDeckGames({
            startPage: pageRef.current + 1,
            minCount: 6,
            maxAttempts: 3,
            blockedIds: currentGames.map((item) => item.id),
            likedIds: new Set(likedIdSetRef.current),
          });

          if (items.length) {
            deckExhaustedRef.current = false;

            const baseGames = gamesRef.current;
            const knownIds = new Set(baseGames.map((item) => String(item.id)));
            const appended = items.filter(
              (item) => !knownIds.has(String(item.id)) && !likedIdSetRef.current.has(String(item.id))
            );
            const merged = appended.length ? [...baseGames, ...appended] : baseGames;
            gamesRef.current = merged;
            setGames(merged);
          } else {
            deckExhaustedRef.current = true;
          }

          pageRef.current = lastPage;
          setPage(lastPage);
          return gamesRef.current;
        } catch {
          return gamesRef.current;
        } finally {
          loadingMoreRef.current = false;
          loadingMorePromiseRef.current = null;
          setIsLoadingMore(false);
        }
      })();

      loadingMorePromiseRef.current = loadingPromise;
      return loadingPromise;
    },
    [collectDeckGames]
  );

  useEffect(() => {
    let active = true;

    async function loadInitialDeck() {
      const hadGames = gamesRef.current.length > 0;
      setIsLoading(!hadGames);
      setIsLoadingMore(hadGames);
      setIsDeckLocked(true);
      voteLockRef.current = true;

      if (!hadGames) {
        setGames([]);
        setIndex(0);
        gamesRef.current = [];
        indexRef.current = 0;
      }

      setPage(1);
      pageRef.current = 1;
      loadingMoreRef.current = false;
      loadingMorePromiseRef.current = null;
      deckExhaustedRef.current = false;
      catalogBasePageRef.current = Math.floor(Math.random() * 18) + 1;

      try {
        const { items, lastPage } = await collectDeckGames({
          startPage: 1,
          minCount: 8,
          maxAttempts: 4,
          likedIds: new Set(likedIdSetRef.current),
        });

        if (active) {
          deckExhaustedRef.current = !items.length;
          setGames(items);
          gamesRef.current = items;
          setIndex(0);
          indexRef.current = 0;
          pageRef.current = lastPage;
          setPage(lastPage);
        }
      } catch {
        if (active) {
          if (!hadGames) {
            setGames([]);
          }
          notifyLoadError();
        }
      } finally {
        if (active) {
          setIsLoading(false);
          setIsLoadingMore(false);
          setIsDeckLocked(false);
          voteLockRef.current = false;
        }
      }
    }

    void loadInitialDeck();
    return () => {
      active = false;
    };
  }, [collectDeckGames, deckRefreshToken, notifyLoadError]);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    let nextIndex = indexRef.current;
    let shouldRefill = false;

    const currentGames = gamesRef.current;
    if (!currentGames.length) {
      shouldRefill = false;
    } else {
      const filtered = currentGames.filter((item) => !likedIdSet.has(String(item.id)));
      if (filtered.length !== currentGames.length) {
        const removedBeforeCurrent = currentGames
          .slice(0, nextIndex)
          .filter((item) => likedIdSet.has(String(item.id))).length;

        nextIndex = Math.max(0, nextIndex - removedBeforeCurrent);
        if (nextIndex >= filtered.length) {
          nextIndex = Math.max(0, filtered.length - 1);
        }

        gamesRef.current = filtered;
        setGames(filtered);
      }

      shouldRefill = filtered.length < 6;
    }

    if (nextIndex !== indexRef.current) {
      indexRef.current = nextIndex;
      setIndex(nextIndex);
    }

    if (shouldRefill && !deckExhaustedRef.current) {
      void loadMoreIfNeeded(nextIndex, true);
    }
  }, [likedIdSet, isLoading, loadMoreIfNeeded]);

  const persistVote = useStableCallback(async (game, direction) => {
    try {
      if (direction === "like" && !isLiked(game.id)) {
        await addLikedGame(game);
        notify({
          title: "Jogo curtido",
          description: `${game.name} foi salvo nos seus curtidos.`,
          tone: "success",
        });
      }

      if (room?.id) {
        await castVote({
          roomId: room.id,
          user,
          game,
          action: direction,
        });
      }
    } catch {
      notify({
        title: "Não foi possível registrar seu voto",
        description: "Tente novamente em alguns segundos.",
        tone: "danger",
      });
    }
  });

  const handleVote = useStableCallback(async (direction, options = {}) => {
    const force = Boolean(options.force);
    if ((!force && voteLockRef.current) || isLoading) {
      return;
    }

    voteLockRef.current = true;
    setIsDeckLocked(true);

    const currentIndex = indexRef.current;
    let currentGames = gamesRef.current;
    const game = currentGames[currentIndex];

    if (!game) {
      voteLockRef.current = false;
      setIsDeckLocked(false);
      return;
    }

    try {
      const nextIndex = currentIndex + 1;

      if (!currentGames[nextIndex]) {
        await loadMoreIfNeeded(currentIndex, true);
        currentGames = gamesRef.current;
      }

      if (!currentGames[nextIndex]) {
        void loadMoreIfNeeded(currentIndex, true);
        return;
      }

      indexRef.current = nextIndex;
      setIndex(nextIndex);
      void loadMoreIfNeeded(nextIndex);
      void persistVote(game, direction);
    } finally {
      voteLockRef.current = false;
      setIsDeckLocked(false);
    }
  });

  const requestAnimatedVote = useStableCallback((direction, options = {}) => {
    if (!gamesRef.current[indexRef.current] || isLoading) {
      return;
    }

    if (options.force) {
      voteLockRef.current = false;
      setIsDeckLocked(false);
    }

    autoSwipeIdRef.current += 1;
    setAutoSwipeRequest({
      direction,
      force: Boolean(options.force),
      id: autoSwipeIdRef.current,
    });
  });

  useEffect(() => {
    const timerSeconds = Number(roomInfo?.timerSeconds || 0);
    if (!timerSeconds || !currentGameId || isLoading) {
      setCountdown(0);
      return undefined;
    }

    const startedAt = Date.now();
    setCountdown(timerSeconds);

    const intervalId = window.setInterval(() => {
      const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
      setCountdown(Math.max(0, timerSeconds - elapsedSeconds));
    }, 1000);

    const timeoutId = window.setTimeout(() => {
      requestAnimatedVote("pass", { force: true });
    }, timerSeconds * 1000);

    return () => {
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
    };
  }, [currentGameId, isLoading, requestAnimatedVote, roomInfo?.timerSeconds]);

  async function openTrailer(game) {
    try {
      const trailerUrl = await fetchTrailerUrl(game.id, game.name);
      openExternal(trailerUrl);
    } catch {
      notify({
        title: "Trailer indisponível",
        description: "Vamos abrir a busca do YouTube.",
        tone: "warning",
      });
      openExternal(
        `https://www.youtube.com/results?search_query=${encodeURIComponent(`${game.name} trailer`)}`
      );
    }
  }

  async function openStore(game) {
    try {
      const url = await fetchPreferredGameUrl(game.id, game.name);
      openExternal(url);
    } catch {
      openExternal(`https://rawg.io/search?query=${encodeURIComponent(game.name)}`);
    }
  }

  async function handleShareGame(game) {
    await shareGame(game, notify);
  }

  if (isLoading) {
    return <LoaderScreen label="Carregando jogos..." />;
  }

  return (
    <div className="page-grid page-grid--discover">
      <section className="surface surface--hero">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Descoberta</p>
            <h3>Encontre um jogo para a próxima rodada.</h3>
          </div>
        </div>

        <label className="toggle-card toggle-card--inline">
          <div>
            <strong>Conteúdo adulto</strong>
            <p>{preferences.allowAdult ? "Mostrando o catálogo completo." : "Filtro seguro ativado."}</p>
          </div>
          <button
            aria-pressed={preferences.allowAdult}
            className={`toggle${preferences.allowAdult ? " is-active" : ""}`}
            onClick={() => updatePreferences({ allowAdult: !preferences.allowAdult })}
            type="button"
          >
            <span />
          </button>
        </label>
      </section>

      <section className="page-grid__main">
        {currentGame ? (
          <>
            {timerTotal ? (
              <div
                className={`round-timer${countdown <= 5 && countdown > 0 ? " round-timer--urgent" : ""}`}
                role="timer"
                aria-live="polite"
              >
                <div className="round-timer__bar" style={{ transform: `scaleX(${timerProgress})` }} />
                <span>Rodada rápida</span>
                <strong>{countdown || timerTotal}s</strong>
              </div>
            ) : null}

            <GameDeck
              autoSwipeRequest={autoSwipeRequest}
              currentGame={currentGame}
              isBusy={isDeckLocked || (isLoadingMore && !nextGame)}
              nextGame={nextGame}
              onLike={() => handleVote("like")}
              onOpenStore={() => openStore(currentGame)}
              onOpenTrailer={() => openTrailer(currentGame)}
              onPass={() => handleVote("pass")}
              onShare={() => handleShareGame(currentGame)}
            />
          </>
        ) : isLoadingMore ? (
          <LoaderScreen label="Buscando mais jogos..." />
        ) : (
          <EmptyState
            eyebrow="Deck vazio"
            title="Não encontramos jogos com esse filtro."
            description="Tente liberar mais catálogo ou atualizar o deck."
          />
        )}

        {isLoadingMore ? <p className="surface-note">Carregando mais jogos...</p> : null}
      </section>

      <aside className="page-grid__rail">
        <section className="surface">
          <p className="eyebrow">Resumo</p>
          <div className="stat-grid">
            <article className="stat-card">
              <strong>{likedGames.length}</strong>
              <span>Curtidos salvos</span>
            </article>
            <article className="stat-card">
              <strong>{roomMembers.length}</strong>
              <span>{pluralize(roomMembers.length, "membro na sala", "membros na sala")}</span>
            </article>
            <article className="stat-card">
              <strong>{roomInfo?.maxMembers || "-"}</strong>
              <span>Capacidade da sala</span>
            </article>
          </div>
        </section>

        <section className="surface">
          <p className="eyebrow">Próximo jogo</p>
          {nextGame ? (
            <div className="queue-card">
              {nextGameCover ? (
                <img
                  className="queue-card__thumb"
                  src={nextGameCover}
                  alt=""
                  aria-hidden="true"
                  decoding="async"
                  loading="lazy"
                />
              ) : null}
              <div>
                <strong>{nextGame.name}</strong>
                <p>{nextGame.shortDesc || "Sem resumo."}</p>
              </div>
            </div>
          ) : (
            <p className="muted">Sem prévia disponível no momento.</p>
          )}
        </section>
      </aside>
    </div>
  );
}
