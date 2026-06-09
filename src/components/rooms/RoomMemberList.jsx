export function RoomMemberList({ members, hostId, currentUserId }) {
  if (!members.length) {
    return null;
  }

  return (
    <div className="member-list">
      {members.map((member) => {
        const name = member.nickname || String(member.email || "").split("@")[0] || "Jogador";
        const initials = name
          .split(" ")
          .slice(0, 2)
          .map((chunk) => chunk[0])
          .join("")
          .toUpperCase();

        return (
          <article className="member-card" key={member.id}>
            <div className="member-card__avatar">{initials || "--"}</div>
            <div className="member-card__body">
              <strong>{name}</strong>
              <p>{member.email || "Participante da sala"}</p>
            </div>
            <div className="member-card__meta">
              {member.id === hostId ? <span className="tag tag--accent">Anfitrião</span> : null}
              {member.id === currentUserId ? <span className="tag">Você</span> : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}
