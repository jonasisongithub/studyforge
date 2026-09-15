export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "short" });

export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("de-DE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export const relTime = (iso: string) => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "gerade eben";
  if (s < 3600) return `vor ${Math.floor(s / 60)} Min`;
  if (s < 86400) return `vor ${Math.floor(s / 3600)} Std`;
  if (s < 604800) return `vor ${Math.floor(s / 86400)} Tg`;
  return fmtDate(iso);
};

export const greeting = () => {
  const h = new Date().getHours();
  if (h < 5) return "Noch wach";
  if (h < 11) return "Guten Morgen";
  if (h < 17) return "Guten Tag";
  if (h < 22) return "Guten Abend";
  return "Gute Nacht";
};

export const MODE_LABEL: Record<string, string> = {
  flashcards: "Karteikarten",
  cloze: "Lückentext",
  match: "Zuordnen",
  write: "Freies Abrufen",
  quiz: "Quiz",
};
