export function openExternal(url) {
  if (!url) {
    return;
  }

  window.open(url, "_blank", "noopener,noreferrer");
}
