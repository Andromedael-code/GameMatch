const fallbackCoverEntries = [
  ["fallback-hades", "https://cdn.akamai.steamstatic.com/steam/apps/1145360/header.jpg"],
  ["fallback-persona", "https://cdn.akamai.steamstatic.com/steam/apps/1687950/header.jpg"],
  ["fallback-stardew", "https://cdn.akamai.steamstatic.com/steam/apps/413150/header.jpg"],
  ["fallback-hollow", "https://cdn.akamai.steamstatic.com/steam/apps/367520/header.jpg"],
  ["fallback-forza", "https://cdn.akamai.steamstatic.com/steam/apps/1551360/header.jpg"],
];

const fallbackCoverNames = {
  "forza horizon 5": "fallback-forza",
  hades: "fallback-hades",
  "hollow knight": "fallback-hollow",
  "persona 5 royal": "fallback-persona",
  "stardew valley": "fallback-stardew",
};

export const FALLBACK_GAME_COVERS = Object.fromEntries(fallbackCoverEntries);

function normalizeName(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export function resolveGameCover(game) {
  const directCover = String(game?.cover || game?.gameCover || "").trim();
  if (directCover) {
    return directCover;
  }

  const fallbackId = String(game?.id || game?.gameId || "").trim();
  if (FALLBACK_GAME_COVERS[fallbackId]) {
    return FALLBACK_GAME_COVERS[fallbackId];
  }

  const nameFallbackId = fallbackCoverNames[normalizeName(game?.name || game?.gameName)];
  return nameFallbackId ? FALLBACK_GAME_COVERS[nameFallbackId] : "";
}
