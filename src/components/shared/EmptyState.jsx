export function EmptyState({ eyebrow, title, description, action }) {
  return (
    <div className="empty-state">
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <h3>{title}</h3>
      <p className="muted">{description}</p>
      {action ? <div className="empty-state__action">{action}</div> : null}
    </div>
  );
}
