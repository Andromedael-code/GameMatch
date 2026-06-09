export function ToastViewport({ toasts }) {
  return (
    <div className="toast-viewport" aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => (
        <article className={`toast toast--${toast.tone}${toast.exiting ? " is-exiting" : ""}`} key={toast.id}>
          <strong>{toast.title}</strong>
          {toast.description ? <p>{toast.description}</p> : null}
        </article>
      ))}
    </div>
  );
}
