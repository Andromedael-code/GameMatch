const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export function formatDate(value) {
  if (!value) {
    return "Sem data";
  }

  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Sem data";
  }

  return dateFormatter.format(parsed);
}

export function formatRating(rating) {
  const value = Number(rating || 0);
  return value ? value.toFixed(1) : "N/A";
}

export function pluralize(count, singular, plural) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function buildRoomInviteUrl(roomId) {
  if (typeof window === "undefined") {
    return `/room/${roomId}`;
  }

  return new URL(`/room/${roomId}`, window.location.origin).toString();
}

export function groupHistoryByRoom(items) {
  const folders = {};

  items.forEach((item) => {
    const key = item.roomId || "sem-sala";
    if (!folders[key]) {
      folders[key] = {
        key,
        title: item.folderName || `Sala ${item.roomId || "Sem sala"}`,
        items: [],
      };
    }

    folders[key].items.push(item);
  });

  return Object.values(folders).sort((left, right) => {
    const leftStamp = left.items[0]?.createdAt?.seconds || 0;
    const rightStamp = right.items[0]?.createdAt?.seconds || 0;
    return rightStamp - leftStamp;
  });
}
