# StudyForge 🧠

Lokale Lernwerkstatt: Studienmaterial einfügen → automatisch **Karteikarten** und
**Quizfragen** erzeugen → mit **Spaced Repetition** und mehreren Lernformaten üben.
Läuft komplett offline auf `localhost`, Daten liegen in einer lokalen SQLite-Datei.

## Schnellstart

```bash
npm install
npm run serve      # baut das Frontend und startet den Server
```

Dann im Browser öffnen: **http://localhost:8787**

Beim ersten Start werden zwei Beispiel-Fächer mit fertigen Karten & Fragen angelegt.

### Entwicklung (Hot Reload)

```bash
npm run dev        # Vite (5173) + API (8787) mit --watch
```

## Was es kann

| Bereich | Details |
|---|---|
| **Material → Lernmaterial** | Text einfügen; ein Hintergrund-Worker erkennt Definitionen, Schlüsselbegriffe und Fakten und baut daraus Karten (Frage/Antwort + Lückentext) und Fragen (Multiple Choice, Wahr/Falsch, Lückentext, Kurzantwort). Du wählst per Häkchen, was übernommen wird. |
| **Spaced Repetition** | SM-2-Variante mit Ease-Faktor, Lapses und „Problemkarten"-Erkennung. Vorschau der nächsten Intervalle direkt auf den Bewertungs-Buttons. |
| **Lernformate** | Karteikarten · Lückentext (eintippen) · Zuordnen (Paare) · Freies Abrufen (Selbstbewertung) · Quiz. |
| **Hintergrund-Jobs** | Materialverarbeitung als Queue, Wiederherstellung hängengebliebener Jobs, Problemkarten-Markierung, Tages-Rollover für Streak & Statistik, Schließen alter Sitzungen. |
| **Dashboard** | Streak, Tagesziel, Retention (30 T.), Aktivitätsverlauf, Lern-Heatmap, Fortschritt pro Fach. |
| **Einstellungen** | Tagesziel, neue Karten pro Tag. |

## Optional: bessere Generierung per KI

Ohne Konfiguration arbeitet StudyForge rein lokal (Heuristik). Für hochwertigere
Karten/Fragen eine `.env` anlegen (`cp .env.example .env`) und setzen:

```
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
```

Der Code fällt bei Fehlern automatisch auf die Heuristik zurück.

## Technik

- **Backend:** Node (nur `express` als Dependency), eingebautes `node:sqlite`, In-Process-Scheduler
- **Frontend:** React + Vite + TypeScript, Tailwind, Recharts, Framer Motion, Lucide
- **Daten:** `data/studyforge.db` (SQLite, WAL) — löschen = Reset

## Nützliche Umgebungsvariablen

| Variable | Default | Zweck |
|---|---|---|
| `PORT` | `8787` | Server-Port |
| `DB_PATH` | `data/studyforge.db` | Ort der Datenbank |
| `SF_NO_SEED` | – | `1` = keine Beispieldaten beim ersten Start |
