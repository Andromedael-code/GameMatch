import { useEffect, useRef } from "react";
import { useSwipeDeck } from "../../hooks/useSwipeDeck";
import { formatDate, formatRating } from "../../utils/formatters";
import { resolveGameCover } from "../../utils/gameMedia";
import { LinkIcon, PlayIcon, ShareIcon } from "../shared/Icons";

const CARD_ROTATION_LIMIT = 18;
const CARD_ROTATION_DIVISOR = 28;
const DRAG_INTENT_THRESHOLD = 20;

function resolvePlatformType(platform) {
  const normalized = String(platform || "").toLowerCase();

  if (normalized.includes("playstation")) {
    return "playstation";
  }

  if (normalized.includes("xbox")) {
    return "xbox";
  }

  if (normalized.includes("switch") || normalized.includes("nintendo")) {
    return "switch";
  }

  if (normalized.includes("ios") || normalized.includes("android") || normalized.includes("mobile")) {
    return "mobile";
  }

  return "pc";
}

function PlatformIcon({ type }) {
  if (type === "playstation") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8.2 5.2c0-.9.7-1.5 1.6-1.3l3.5.8c1.7.4 2.8 1.8 2.8 3.5v3.3c0 1.5-.9 2.4-2.2 2l-1.1-.3V7.7c0-.6-.3-1-.8-1.1l-.8-.2v12.8l-3-1V5.2Zm8.6 8.2c1.8.4 3 .9 3.7 1.6.5.5.6 1.2.2 1.8-.9 1.3-4.1 2.2-7.5 2.2v-2.1c1.8 0 3.4-.2 4.2-.7.5-.3.4-.6-.2-.8l-.4-.1v-1.9Zm-10.2.4 2.8-.9v2.1l-1.9.6c-.6.2-.7.5-.1.8.8.4 2.3.6 4 .6v2.1c-3.3 0-6.4-.8-7.3-2-.4-.6-.3-1.3.2-1.8.5-.6 1.3-1 2.3-1.5Z" />
      </svg>
    );
  }

  if (type === "xbox") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3a8.9 8.9 0 0 1 5.2 1.7c-1.8.1-3.6 1-5.2 2.4-1.6-1.4-3.4-2.3-5.2-2.4A8.9 8.9 0 0 1 12 3Zm-7 4.2c1.8-.7 3.8.1 5.7 1.9-2.3 2.5-4.1 5.8-4.8 9.1A9 9 0 0 1 5 7.2Zm13.9 11c-.7-3.3-2.5-6.6-4.8-9.1 1.9-1.8 3.9-2.6 5.7-1.9a9 9 0 0 1-.9 11ZM12 10.6c2 2.2 3.6 5.1 4.4 8.1a9 9 0 0 1-8.8 0c.8-3 2.4-5.9 4.4-8.1Z" />
      </svg>
    );
  }

  if (type === "switch") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 4h4v16H7a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4Zm2 3.5a1.2 1.2 0 1 0-2.4 0 1.2 1.2 0 0 0 2.4 0ZM13 4h4a4 4 0 0 1 4 4v8a4 4 0 0 1-4 4h-4V4Zm3 12.5a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2Z" />
      </svg>
    );
  }

  if (type === "mobile") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8 3h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm0 3v11h8V6H8Zm3 12.2a1 1 0 1 0 2 0 1 1 0 0 0-2 0Z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 5h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-6v2h3a1 1 0 1 1 0 2H7a1 1 0 1 1 0-2h3v-2H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm1 2v7h14V7H5Z" />
    </svg>
  );
}

function PlatformPill({ platform }) {
  const type = resolvePlatformType(platform);

  return (
    <span className="platform-pill" title={platform}>
      <span className="platform-pill__icon">
        <PlatformIcon type={type} />
      </span>
      <span>{platform}</span>
    </span>
  );
}

export function GameDeck({
  currentGame,
  nextGame,
  onPass,
  onLike,
  onOpenTrailer,
  onOpenStore,
  onShare,
  isBusy,
  autoSwipeRequest,
}) {
  const processedAutoSwipeIdRef = useRef(0);
  const {
    drag,
    likeStrength,
    passStrength,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    triggerSwipe,
  } = useSwipeDeck({
    onVote: (direction) => {
      if (direction === "like") {
        onLike();
        return;
      }

      onPass();
    },
    disabled: isBusy || !currentGame,
  });

  useEffect(() => {
    if (!autoSwipeRequest?.direction) {
      return;
    }

    if (processedAutoSwipeIdRef.current === autoSwipeRequest.id) {
      return;
    }

    processedAutoSwipeIdRef.current = autoSwipeRequest.id;
    triggerSwipe(autoSwipeRequest.direction, { force: autoSwipeRequest.force });
  }, [autoSwipeRequest, triggerSwipe]);

  useEffect(() => {
    function onKeyDown(event) {
      const target = event.target;
      if (target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) {
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        triggerSwipe("like");
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        triggerSwipe("pass");
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [triggerSwipe]);

  if (!currentGame) {
    return null;
  }

  const currentCover = resolveGameCover(currentGame);
  const nextCover = nextGame ? resolveGameCover(nextGame) : "";
  const activeDirection =
    drag.x > DRAG_INTENT_THRESHOLD ? "like" : drag.x < -DRAG_INTENT_THRESHOLD ? "pass" : "";
  const dragStrength = drag.phase === "exit" ? 1 : Math.min(1, Math.abs(drag.x) / 320);
  const rotation = Math.max(
    -CARD_ROTATION_LIMIT,
    Math.min(CARD_ROTATION_LIMIT, drag.x / CARD_ROTATION_DIVISOR)
  );
  const startRotation = Math.max(
    -CARD_ROTATION_LIMIT,
    Math.min(CARD_ROTATION_LIMIT, Number(drag.startX || 0) / CARD_ROTATION_DIVISOR)
  );
  const isDraggingLike = drag.phase === "dragging" && drag.x > DRAG_INTENT_THRESHOLD;
  const isDraggingPass = drag.phase === "dragging" && drag.x < -DRAG_INTENT_THRESHOLD;
  const cardClassName = [
    "game-card",
    drag.phase !== "idle" ? "is-swipe-active" : "",
    isDraggingLike ? "is-dragging-like" : "",
    isDraggingPass ? "is-dragging-pass" : "",
    drag.phase === "exit" && activeDirection ? `is-exiting-${activeDirection}` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const stageClassName = [
    "deck__stage",
    activeDirection ? `is-swipe-${activeDirection}` : "",
    drag.phase === "exit" ? "is-exiting" : "",
    drag.phase === "dragging" ? "deck__stage--dragging" : "",
    drag.phase === "exit" ? "deck__stage--exiting" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const transition =
    drag.phase === "dragging"
      ? "none"
      : drag.phase === "exit"
        ? "transform 260ms cubic-bezier(0.25, 1, 0.3, 1)"
        : drag.phase === "settling"
          ? "transform 420ms cubic-bezier(0.34, 1.56, 0.64, 1)"
          : "none";
  const transform = {
    "--swipe-start-x": `${Number(drag.startX || 0)}px`,
    "--swipe-start-y": `${Number(drag.startY || 0)}px`,
    "--swipe-start-rotation": `${startRotation}deg`,
    "--swipe-exit-x": `${drag.x}px`,
    "--swipe-exit-y": `${drag.y}px`,
    "--swipe-exit-rotation": `${rotation}deg`,
    "--swipe-mid-x": `${drag.x * 0.58}px`,
    "--swipe-mid-rotation": `${rotation * 0.72}deg`,
    filter: "none",
    opacity: 1,
    transform: `translate3d(${drag.x}px, ${drag.y}px, 0) rotate(${rotation}deg) scale(${
      drag.phase === "exit" ? 0.92 : 1 - dragStrength * 0.035
    })`,
    transition,
  };

  return (
    <section className="deck">
      <p className="sr-only">Use as setas do teclado para passar ou curtir o jogo atual.</p>
      <div className={stageClassName}>
        {nextGame ? (
          <article key={`ghost_${nextGame.id}`} className="game-card game-card--ghost" aria-hidden="true">
            <div className="game-card__media">
              {nextCover ? (
                <img alt="" decoding="async" src={nextCover} />
              ) : (
                <div className="game-card__placeholder" />
              )}
            </div>
          </article>
        ) : null}

        <article
          key={currentGame.id}
          className={cardClassName}
          data-swipe-direction={drag.direction || activeDirection || undefined}
          data-swipe-phase={drag.phase}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          role="article"
          aria-label={`${currentGame.name}. Use os botões abaixo ou as setas do teclado para curtir ou passar.`}
          style={{
            ...transform,
            animation: drag.phase !== "idle" ? "none" : undefined,
          }}
        >
          <div
            className="game-card__vote game-card__vote--like"
            style={{
              opacity: Math.min(1, likeStrength * 1.2),
              transform: `rotate(-15deg) scale(${0.7 + Math.min(0.35, likeStrength * 0.35)})`,
            }}
          >
            Curtir
          </div>
          <div
            className="game-card__vote game-card__vote--pass"
            style={{
              opacity: Math.min(1, passStrength * 1.2),
              transform: `rotate(15deg) scale(${0.7 + Math.min(0.35, passStrength * 0.35)})`,
            }}
          >
            Passar
          </div>

          <div className="game-card__media">
            {currentCover ? (
              <img
                alt={`Capa de ${currentGame.name}`}
                decoding="async"
                key={currentCover}
                src={currentCover}
              />
            ) : (
              <div className="game-card__placeholder">
                <span>Sem capa</span>
              </div>
            )}
            <div className="game-card__gloss" />
          </div>

          <div className="game-card__body">
            <div className="game-card__meta">
              <span className="tag">{currentGame.esrb || "Sem ESRB"}</span>
              <span className="tag tag--accent">Nota {formatRating(currentGame.rating)}</span>
              {currentGame.releaseDate ? (
                <span className="tag">{formatDate(currentGame.releaseDate)}</span>
              ) : null}
            </div>

            <div className="game-card__header">
              <div>
                <h3>{currentGame.name}</h3>
                <p>{currentGame.shortDesc || "Sem resumo disponível."}</p>
              </div>
            </div>

            <div className="game-card__footer">
              <dl className="game-card__facts">
                <div>
                  <dt>Gêneros</dt>
                  <dd>{currentGame.genres?.length ? currentGame.genres.join(", ") : "Não informado"}</dd>
                </div>
                <div>
                  <dt>Plataformas</dt>
                  <dd className="platform-list">
                    {currentGame.platforms?.length
                      ? currentGame.platforms.map((platform) => (
                          <PlatformPill key={platform} platform={platform} />
                        ))
                      : "Não informado"}
                  </dd>
                </div>
              </dl>

              <div className="game-card__actions-panel">
                <div className="game-card__links">
                  <button className="button button--ghost" type="button" onClick={onOpenStore}>
                    <LinkIcon />
                    <span>Página do jogo</span>
                  </button>
                  <button className="button button--ghost" type="button" onClick={onOpenTrailer}>
                    <PlayIcon />
                    <span>Ver trailer</span>
                  </button>
                  <button className="button button--ghost" type="button" onClick={onShare}>
                    <ShareIcon />
                    <span>Compartilhar</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="game-card__vote-actions game-card__vote-actions--wide">
              <button
                aria-label={`Passar ${currentGame.name}`}
                className="button button--secondary"
                disabled={isBusy}
                type="button"
                onClick={() => triggerSwipe("pass")}
              >
                Passar
              </button>
              <button
                aria-label={`Curtir ${currentGame.name}`}
                className="button button--primary"
                disabled={isBusy}
                type="button"
                onClick={() => triggerSwipe("like")}
              >
                Curtir
              </button>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
