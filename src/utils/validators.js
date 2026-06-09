export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function fallbackNickname(email) {
  const prefix = String(email || "").split("@")[0] || "jogador";
  return prefix.slice(0, 24);
}

export function normalizeRoomId(roomId) {
  return String(roomId || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);
}
