export function LoaderScreen({ label = "Carregando..." }) {
  return (
    <div className="loader-screen" role="status" aria-label={label} aria-live="polite">
      <div className="loader-screen__panel">
        <span className="loader-screen__spinner" />
        <p className="loader-screen__label">{label}</p>
      </div>
    </div>
  );
}
