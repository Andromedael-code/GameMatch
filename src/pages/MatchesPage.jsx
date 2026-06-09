import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MatchCard } from "../components/matches/MatchCard";
import { EmptyState } from "../components/shared/EmptyState";
import { useAppContext } from "../app/AppProvider";
import { usePageTitle } from "../hooks/usePageTitle";
import { fetchPreferredGameUrl } from "../services/rawg";
import { deleteUserRoomMatchHistory, subscribeToUserMatchHistory } from "../services/rooms";
import { groupHistoryByRoom } from "../utils/formatters";
import { openExternal } from "../utils/openExternal";

export function MatchesPage() {
  usePageTitle("Matches");

  const { notify, room, roomMatches, roomMembers, user } = useAppContext();
  const [historyMatches, setHistoryMatches] = useState([]);
  const [expandedRooms, setExpandedRooms] = useState({});
  const [openingId, setOpeningId] = useState("");
  const [deletingRoomId, setDeletingRoomId] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState("");

  useEffect(
    () => subscribeToUserMatchHistory(user?.uid, setHistoryMatches, () => setHistoryMatches([])),
    [user?.uid]
  );

  const folders = groupHistoryByRoom(historyMatches);

  async function openGame(item) {
    const itemId = item.id || item.gameId;
    try {
      setOpeningId(itemId);
      const url = await fetchPreferredGameUrl(item.gameId, item.gameName);
      openExternal(url);
    } catch {
      notify({
        title: "Não foi possível abrir o jogo",
        description: "Vamos tentar novamente em alguns instantes.",
        tone: "warning",
      });
      openExternal(`https://rawg.io/search?query=${encodeURIComponent(item.gameName || "")}`);
    } finally {
      setOpeningId("");
    }
  }

  async function deleteRoomHistory(folder) {
    if (!user?.uid || deletingRoomId) {
      return;
    }

    try {
      setDeletingRoomId(folder.key);
      const deletedCount = await deleteUserRoomMatchHistory({
        userId: user.uid,
        roomId: folder.key,
      });

      setExpandedRooms((current) => {
        const next = { ...current };
        delete next[folder.key];
        return next;
      });
      setConfirmDeleteId("");

      notify({
        title: "Histórico excluído",
        description: `${deletedCount || folder.items.length} match(es) removidos de ${folder.title}.`,
        tone: "success",
      });
    } catch {
      notify({
        title: "Não foi possível excluir",
        description: "Tente novamente em alguns segundos.",
        tone: "danger",
      });
    } finally {
      setDeletingRoomId("");
    }
  }

  return (
    <div className="stack-page">
      <section className="surface surface--hero">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Matches</p>
            <h3>Os jogos que deram certo para a sala.</h3>
          </div>
        </div>

        <div className="stat-grid">
          <article className="stat-card">
            <strong>{roomMatches.length}</strong>
            <span>Matches na sala atual</span>
          </article>
          <article className="stat-card">
            <strong>{historyMatches.length}</strong>
            <span>Matches no histórico</span>
          </article>
          <article className="stat-card">
            <strong>{roomMembers.length}</strong>
            <span>Membros conectados agora</span>
          </article>
        </div>
      </section>

      <div className="content-split content-split--matches">
        <section className="surface">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Sala ativa</p>
              <h3>{room?.id ? `Sala ${room.id}` : "Nenhuma sala selecionada"}</h3>
            </div>
          </div>

          {roomMatches.length ? (
            <div className="match-list">
              {roomMatches.map((item) => (
                <MatchCard
                  item={item}
                  key={item.id}
                  isOpening={openingId === item.id}
                  onOpenGame={openGame}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              eyebrow="Sem match ainda"
              title="A sala ainda não encontrou um jogo em comum."
              description="Quando todos os membros ativos curtirem o mesmo jogo, ele aparece aqui."
              action={
                <Link className="button button--primary" to={room?.id ? "/discover" : "/rooms"}>
                  {room?.id ? "Voltar ao deck" : "Entrar em uma sala"}
                </Link>
              }
            />
          )}
        </section>

        <aside className="surface matches-history-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Histórico</p>
              <h3>{historyMatches.length} match(es) salvos.</h3>
            </div>
          </div>

          {folders.length ? (
            <div className="history-stack">
              {folders.map((folder) => {
                const expanded = Boolean(expandedRooms[folder.key]);
                return (
                  <article className="history-folder" key={folder.key}>
                    <div className="history-folder__header">
                      <button
                        className="history-folder__toggle"
                        onClick={() =>
                          setExpandedRooms((current) => ({
                            ...current,
                            [folder.key]: !current[folder.key],
                          }))
                        }
                        type="button"
                      >
                        <div>
                          <strong>{folder.title}</strong>
                          <p>{folder.items.length} match(es) guardados</p>
                        </div>
                      </button>

                      <div className="history-folder__actions">
                        {confirmDeleteId === folder.key ? (
                          <>
                            <button
                              className="button button--compact button--danger"
                              disabled={deletingRoomId === folder.key}
                              onClick={() => {
                                setConfirmDeleteId("");
                                deleteRoomHistory(folder);
                              }}
                              type="button"
                            >
                              {deletingRoomId === folder.key ? "Excluindo..." : "Confirmar"}
                            </button>
                            <button
                              className="button button--compact button--ghost"
                              disabled={deletingRoomId === folder.key}
                              onClick={() => setConfirmDeleteId("")}
                              type="button"
                            >
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              className="button button--compact button--ghost"
                              onClick={() =>
                                setExpandedRooms((current) => ({
                                  ...current,
                                  [folder.key]: !current[folder.key],
                                }))
                              }
                              type="button"
                            >
                              {expanded ? "Ocultar" : "Abrir"}
                            </button>
                            <button
                              className="button button--compact button--danger"
                              disabled={Boolean(deletingRoomId)}
                              onClick={() => setConfirmDeleteId(folder.key)}
                              type="button"
                            >
                              Excluir
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {expanded ? (
                      <div className="match-list">
                        {folder.items.map((item) => (
                          <MatchCard
                            item={item}
                            key={item.id}
                            isOpening={openingId === (item.id || item.gameId)}
                            onOpenGame={openGame}
                          />
                        ))}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyState
              eyebrow="Histórico vazio"
              title="Nenhum match salvo ainda."
              description="Os jogos em comum ficam guardados aqui automaticamente."
            />
          )}
        </aside>
      </div>
    </div>
  );
}
