# StudyForge 🧠

Eine private Lern-App: Du fügst Text ein oder lädst ein PDF hoch, StudyForge macht
automatisch **Karteikarten** und **Quizfragen** daraus, und du lernst sie mit
Spaced-Repetition (das System merkt sich, was du schon kannst, und zeigt es dir
genau dann wieder, wenn du es zu vergessen drohst).

Diese Anleitung ist **bewusst ausführlich und ohne Technik-Vorwissen geschrieben**.
Du musst kein Entwickler sein, um StudyForge zu benutzen. Wenn dir ein Begriff
unbekannt vorkommt, findest du ihn unten im Abschnitt [„Begriffe kurz erklärt"](#begriffe-kurz-erklärt).

> 🤖 **Der einfachste Weg für alles hier:** Öffne diesen Ordner mit **Claude Code**
> und sag in eigenen Worten, was du willst — z. B. „Starte StudyForge bei mir lokal"
> oder „Stelle StudyForge online, damit ich es vom Handy aus nutzen kann". Claude Code
> liest dafür automatisch die Datei [`CLAUDE_SETUP.md`](CLAUDE_SETUP.md) und führt dich
> Schritt für Schritt durch alles, was unten beschrieben ist — du musst nichts selbst
> in ein Terminal tippen, wenn du das nicht möchtest.

---

## Inhaltsverzeichnis

1. [Was ist StudyForge?](#was-ist-studyforge)
2. [Zwei Wege, StudyForge zu nutzen](#zwei-wege-studyforge-zu-nutzen)
3. [Begriffe kurz erklärt](#begriffe-kurz-erklärt)
4. [Weg A: Lokal auf dem eigenen Rechner](#weg-a-lokal-auf-dem-eigenen-rechner)
5. [Weg B: In der Cloud (von überall erreichbar)](#weg-b-in-der-cloud-von-überall-erreichbar)
6. [Funktionen im Überblick](#funktionen-im-überblick)
7. [Einstellungen in der App](#einstellungen-in-der-app)
8. [Optional: bessere Karten per KI](#optional-bessere-karten-per-ki)
9. [Deine Daten: wo, wie sicher, wie sicherst du sie](#deine-daten-wo-wie-sicher-wie-sicherst-du-sie)
10. [Fehlerbehebung](#fehlerbehebung)
11. [Häufige Fragen (FAQ)](#häufige-fragen-faq)
12. [Referenz: Umgebungsvariablen](#referenz-umgebungsvariablen)
13. [Technischer Hintergrund (für Interessierte)](#technischer-hintergrund-für-interessierte)

---

## Was ist StudyForge?

Stell dir vor, du hast eine Zusammenfassung, ein Skript oder ein PDF für eine
Prüfung. Normalerweise müsstest du dir von Hand Karteikarten schreiben oder dich
selbst abfragen. StudyForge nimmt dir das ab:

1. Du fügst einen Text ein **oder lädst eine PDF-Datei hoch**.
2. Im Hintergrund liest ein kleiner „Roboter" (kein externer Dienst, läuft direkt
   auf deinem Rechner bzw. Server) den Text, erkennt Definitionen, wichtige
   Begriffe und Fakten und baut daraus:
   - **Karteikarten** (Frage/Antwort, auch Lückentexte),
   - **Quizfragen** (Multiple Choice, Wahr/Falsch, Lückentext, Kurzantwort).
3. Du entscheidest per Häkchen, welche Karten/Fragen du wirklich übernehmen willst.
4. Du lernst sie — in verschiedenen Modi (Karteikarten, Lückentext, Zuordnen,
   Freies Abrufen, Quiz). Jede **richtig** beantwortete Karte gilt danach für ein
   paar Tage als „gelernt" und taucht automatisch wieder auf, sobald es Zeit für
   eine Wiederholung ist. Jede **falsch** beantwortete Karte ist sofort wieder
   „fällig" — noch am selben Tag.
5. Ein Dashboard zeigt dir deinen Lernfortschritt, deine Serie („Streak") und eine
   kleine Kalender-Übersicht, an welchen Tagen du wie viel gelernt hast.

Alles läuft **komplett ohne Internet und ohne externe Dienste**, außer du
aktivierst optional eine KI-Anbindung für bessere Kartenerstellung (siehe unten).
Deine Lerndaten bleiben auf dem Rechner bzw. Server, den du selbst kontrollierst —
es gibt keinen zentralen StudyForge-Anbieter, an den irgendetwas geschickt wird.

## Zwei Wege, StudyForge zu nutzen

| | **Weg A: Lokal** | **Weg B: Cloud** |
|---|---|---|
| Wer kann darauf zugreifen? | Nur du, nur auf diesem einen Rechner | Du (und wer die Adresse + das Passwort kennt), von jedem Gerät mit Internet |
| Kosten | Kostenlos | Ein paar Euro im Monat (siehe [Kosten](#kosten)) |
| Läuft, wenn der Rechner aus ist? | Nein | Ja, dauerhaft |
| Aufwand | Sehr gering, 5 Minuten | Etwas mehr, aber Claude Code kann es komplett für dich erledigen |
| Empfehlung | Zum Ausprobieren, für dich allein | Wenn du z. B. vom Handy unterwegs oder von mehreren Geräten lernen willst |

Du kannst auch mit Weg A anfangen und später zu Weg B wechseln — beide nutzen
denselben Code.

## Begriffe kurz erklärt

| Begriff | Was das bedeutet |
|---|---|
| **Terminal** | Ein Fenster, in das man statt zu klicken Textbefehle eintippt. Auf dem Mac heißt die App „Terminal" (unter Programme → Dienstprogramme), auf Windows „PowerShell" oder „Eingabeaufforderung". |
| **Befehl / Kommando** | Eine Zeile Text, die du im Terminal eintippst und mit „Enter" bestätigst. |
| **Node.js** | Ein Programm, das nötig ist, damit StudyForge überhaupt laufen kann — vergleichbar mit einem Motor, den die App braucht. Muss einmalig installiert werden. |
| **npm** | Wird automatisch mit Node.js installiert. Lädt die „Bauteile", die StudyForge braucht (siehe „Abhängigkeiten"). |
| **Abhängigkeiten (`node_modules`)** | Fertige Code-Bausteine anderer Entwickler, die StudyForge mitbenutzt, statt alles selbst neu zu schreiben. Werden mit `npm install` heruntergeladen. |
| **Repository („Repo")** | Der Ordner mit dem gesamten StudyForge-Programmcode, meist auf GitHub gespeichert. |
| **`localhost`** | Bedeutet „dieser Rechner selbst". `http://localhost:8787` heißt: die Webseite läuft auf demselben Computer, auf dem du sie im Browser öffnest. |
| **Port** | Eine Art „Zimmernummer" auf einem Computer, über die ein Programm erreichbar ist. StudyForge nutzt standardmäßig Port `8787`. |
| **Server** | Ein Programm (oder Rechner), das eine Webseite/App bereitstellt, die ein Browser dann anzeigen kann. |
| **Datenbank** | Eine Datei, in der StudyForge deine Fächer, Karten und deinen Lernfortschritt speichert (hier: eine einzelne Datei `data/studyforge.db`). |
| **Umgebungsvariable** | Eine Einstellung, die du beim Start von außen mitgibst, statt sie im Programmcode zu ändern (z. B. „auf welchem Port soll das laufen"). |
| **Cloud / VM** | Ein gemieteter Computer in einem Rechenzentrum (hier: von Google), der rund um die Uhr läuft, auch wenn dein eigener Rechner ausgeschaltet ist. „VM" = virtueller (gemieteter) Computer. |
| **Deployen / Deployment** | Den Programmcode auf einen (Cloud-)Server bringen und dort zum Laufen bringen. |

---

## Weg A: Lokal auf dem eigenen Rechner

### Was du brauchst

- Einen Mac, Windows- oder Linux-Rechner.
- Etwa 10 Minuten und ~300 MB freien Speicherplatz.
- Keine Programmierkenntnisse — nur Copy & Paste der Befehle unten.

### Schritt 1: Node.js installieren

Node.js ist die einzige Voraussetzung.

1. Öffne [nodejs.org](https://nodejs.org) in deinem Browser.
2. Lade die Version herunter, die als **„LTS"** markiert ist (das ist die stabile,
   empfohlene Version) — sie muss **mindestens Version 22.13** sein, besser ist die
   aktuelle LTS-Version (Stand jetzt: 24). Falls du unsicher bist: die größere Zahl
   ist die neuere Version, nimm die neueste LTS.
3. Installiere sie wie jede andere Anwendung (Doppelklick auf die heruntergeladene
   Datei, „Weiter" klicken).
4. Öffne ein **Terminal** und tippe:
   ```bash
   node --version
   ```
   Du solltest etwas wie `v24.x.x` sehen. Steht da eine Zahl unter `22`, aktualisiere
   Node.js noch einmal über die Webseite.

### Schritt 2: Den Programmcode herunterladen

Wenn du den Ordner mit StudyForge schon hast (z. B. weil Claude Code ihn für dich
erstellt hat), überspringe diesen Schritt.

Sonst, per Terminal:

```bash
git clone https://github.com/jonasisongithub/studyforge.git
cd studyforge
```

(Das Repository ist privat — Git fragt dabei nach einer Anmeldung bei GitHub.
Falls das nicht klappt: die ZIP-Alternative direkt unten nutzen, oder Claude
Code bitten, den Ordner für dich bereitzustellen.)

Alternativ, ganz ohne Terminal: Auf GitHub oben rechts auf **„Code" → „Download ZIP"**
klicken, die ZIP-Datei entpacken und diesen Ordner im Terminal öffnen (auf dem Mac:
Ordner im Finder suchen, Rechtsklick auf den Ordner → „Neues Terminal bei Ordner").

### Schritt 3: Alles installieren und starten

Im Terminal, im StudyForge-Ordner:

```bash
npm install
npm run serve
```

- `npm install` lädt einmalig alle „Bauteile" herunter, die StudyForge braucht
  (dauert je nach Internetverbindung ein bis zwei Minuten).
- `npm run serve` baut die App und startet sie. Du solltest am Ende etwas wie
  das hier sehen:

  ```
    StudyForge  ->  http://localhost:8787
  ```

### Schritt 4: Öffnen

Öffne in deinem Browser: **http://localhost:8787**

Beim allerersten Start sind zwei Beispiel-Fächer mit fertigen Karten & Fragen schon
angelegt, damit du sofort loslegen kannst.

### Beenden und wieder starten

- **Beenden:** Im Terminal-Fenster, in dem StudyForge läuft, `Strg + C` drücken
  (auf dem Mac auch `Cmd + C`).
- **Wieder starten:** einfach noch einmal `npm run serve` im selben Ordner ausführen.
  Deine Daten (Fächer, Karten, Fortschritt) bleiben erhalten.

### Wo liegen meine Daten?

Alles liegt in genau einer Datei: `data/studyforge.db` im StudyForge-Ordner.

- **Backup:** Diese eine Datei irgendwohin kopieren (USB-Stick, Cloud-Speicher).
- **Alles zurücksetzen:** Diese Datei löschen (StudyForge muss dafür gestoppt sein)
  und StudyForge neu starten — es legt automatisch eine frische Datenbank an.

---

## Weg B: In der Cloud (von überall erreichbar)

### Was das bedeutet

Statt StudyForge auf deinem eigenen Rechner laufen zu lassen, mietest du einen
winzigen, dauerhaft laufenden Computer bei Google Cloud und stellst StudyForge
dort auf. Danach ist die App über eine feste Internetadresse erreichbar — von
deinem Handy, Laptop, überall.

### Was du dafür brauchst

- Ein **Google-Cloud-Konto** mit aktivierter Abrechnung (Kreditkarte hinterlegt).
  Falls du noch keins hast: [cloud.google.com](https://cloud.google.com) → „Los geht's".
- Das ist der einzige „bürokratische" Schritt. Alles Technische danach kann
  **Claude Code komplett für dich übernehmen.**

### Der empfohlene Weg: Claude Code fragen

1. Öffne dieses Projekt mit Claude Code.
2. Schreib z. B.: *„Bitte stelle StudyForge in der Cloud bereit, ich habe schon
   ein Google-Cloud-Konto mit Abrechnung."*
3. Claude Code liest dafür die Datei [`CLAUDE_SETUP.md`](CLAUDE_SETUP.md) in diesem
   Ordner — dort steht die komplette technische Anleitung inklusive aller
   „Stolperfallen", auf die man beim Einrichten stoßen kann. Du musst nichts davon
   selbst verstehen; am Ende bekommst du:
   - eine Internetadresse (z. B. `http://12.34.56.78/`), unter der StudyForge
     erreichbar ist,
   - einen Benutzernamen und ein Passwort, mit dem du dich dort anmeldest
     (siehe [Zugriffsschutz](#zugriffsschutz)).

### Kosten

Der genutzte Servertyp (`e2-micro`, die kleinste sinnvolle Größe bei Google Cloud)
kostet ungefähr **6–8 € im Monat**, wenn er durchgehend läuft. Es gibt keine
versteckten Zusatzkosten, solange nur du (bzw. 1–2 Personen) die App nutzen.

**Um Kosten zu vermeiden, wenn du länger nicht lernst:**
- Server pausieren (kein Zugriff möglich, aber Daten bleiben erhalten und es
  entstehen kaum noch Kosten): *„Bitte pausiere/stoppe den Cloud-Server"* zu
  Claude Code sagen.
- Server komplett löschen (alle Cloud-Daten weg, keine weiteren Kosten mehr):
  *„Bitte lösche den Cloud-Server komplett"* zu Claude Code sagen. Deine
  Lerndaten sind dann nur noch vorhanden, wenn du sie vorher gesichert hast
  (siehe [Backup](#wo-liegen-meine-daten)) oder lokal (Weg A) weiterlernst.

### Zugriffsschutz

Die Cloud-Version ist über das offene Internet erreichbar, deshalb ist sie mit
einem **Benutzernamen + Passwort** (HTTP-Basic-Auth) abgesichert — dein Browser
fragt beim ersten Öffnen danach, danach merkt er sich das für diesen Rechner.
Ohne die richtigen Zugangsdaten kann niemand auf deine Lerndaten zugreifen oder
sie verändern.

> ⚠️ Die Verbindung läuft über einfaches `http://`, nicht über das verschlüsselte
> `https://`. Für eine private Lern-App mit 1–2 Nutzern ist das ein akzeptabler
> Kompromiss (kein Aufwand für ein eigenes Zertifikat), aber gib die Adresse
> nicht öffentlich weiter und nutze kein Passwort, das du auch woanders
> verwendest.

### App aktualisieren

Wenn später neue Funktionen hinzukommen (z. B. weil du Claude Code bittest,
etwas zu verbessern), muss die Cloud-Version neu „ausgeliefert" werden. Sag
einfach: *„Bitte spiele die neueste Version auf den Cloud-Server."* Deine
Lerndaten auf dem Server bleiben davon unberührt, außer du bittest ausdrücklich
um einen Reset.

---

## Funktionen im Überblick

| Bereich | Details |
|---|---|
| **Material → Lernmaterial** | Text einfügen **oder PDF hochladen** (Text wird automatisch extrahiert); ein Hintergrund-Worker erkennt Definitionen, Schlüsselbegriffe und Fakten und baut daraus Karten (Frage/Antwort + Lückentext) und Fragen (Multiple Choice, Wahr/Falsch, Lückentext, Kurzantwort). Du wählst per Häkchen, was übernommen wird. |
| **Lernrhythmus** | Richtig beantwortet → Karte gilt für eine feste, einstellbare Anzahl Tage (Standard: 3) als „gelernt" und ist danach automatisch wieder fällig. Falsch beantwortet → sofort wieder fällig, egal in welchem Modus. |
| **Lernformate** | Karteikarten · Lückentext (eintippen) · Zuordnen (Paare) · Freies Abrufen (Selbstbewertung) · Quiz (Multiple Choice / Wahr-Falsch / Lückentext / Kurzantwort). |
| **Hintergrund-Jobs** | Materialverarbeitung als Warteschlange, Wiederherstellung hängengebliebener Jobs, „Problemkarten"-Markierung bei wiederholten Fehlern, Tages-Rollover für Streak & Statistik. |
| **Dashboard** | Streak (Lernserie), Tagesziel, Retention der letzten 30 Tage, Aktivitätsverlauf, **Lern-Historie** (Kalender-Übersicht, eingefärbt nach Anzahl richtig gelernter Karten pro Tag) und Fortschritt pro Fach. |
| **Fächer verwalten** | Fächer anlegen und **vollständig löschen** — dabei werden alle zugehörigen Materialien, Karten, Fragen, Quizze und der Lernstand mitentfernt. |

## Einstellungen in der App

Unter **Einstellungen** kannst du festlegen:

- **Tagesziel (Wiederholungen):** Wie viele Wiederholungen dir das Dashboard als
  Tagesziel vorschlägt (rein informativ, keine harte Grenze).
- **Wiederhol-Intervall:** Nach wie vielen Tagen eine richtig beantwortete Karte
  wieder fällig wird (Standard: 3 Tage). Das Intervall ist fest — es wächst nicht
  automatisch mit weiteren richtigen Antworten, wie es klassische
  Karteikarten-Systeme sonst tun. Du kannst es jederzeit ändern.

## Optional: bessere Karten per KI

Ohne weitere Einrichtung erzeugt StudyForge Karten und Fragen **komplett lokal**
über eine eingebaute Text-Analyse (keine Internetverbindung nötig, keine Kosten).
Für noch treffsicherere Karten kannst du optional eine Anthropic-KI-Anbindung
aktivieren:

1. Datei `.env.example` kopieren und in `.env` umbenennen.
2. Darin eintragen:
   ```
   LLM_PROVIDER=anthropic
   ANTHROPIC_API_KEY=sk-ant-...
   ```
   (Einen solchen Schlüssel bekommst du unter [console.anthropic.com](https://console.anthropic.com).)
3. StudyForge neu starten.

Ist kein Schlüssel hinterlegt oder schlägt die Anfrage fehl, nutzt StudyForge
automatisch wieder die lokale Variante — nichts bricht ab.

## Deine Daten: wo, wie sicher, wie sicherst du sie

- **Lokal (Weg A):** Alles in `data/studyforge.db` auf deinem Rechner. Niemand
  sonst hat Zugriff. Backup = diese eine Datei kopieren.
- **Cloud (Weg B):** Dieselbe Datei liegt auf dem gemieteten Server, geschützt
  durch Benutzername/Passwort. Nur wer diese Zugangsdaten hat, kommt heran.
- StudyForge selbst schickt deine Lerninhalte an **niemanden** — außer du hast die
  optionale KI-Anbindung aktiviert; dann werden nur die Texte, aus denen gerade
  Karten erzeugt werden sollen, an Anthropic geschickt (nicht dein sonstiger
  Lernfortschritt).

## Fehlerbehebung

| Problem | Lösung |
|---|---|
| `command not found: node` oder `npm` | Node.js ist nicht installiert oder das Terminal muss neu gestartet werden. Node.js gemäß [Schritt 1](#schritt-1-nodejs-installieren) installieren, danach das Terminal-Fenster schließen und neu öffnen. |
| `Error: listen EADDRINUSE ... 8787` | Port 8787 ist schon belegt — meist weil StudyForge bereits in einem anderen Terminal-Fenster läuft. Das andere Fenster suchen und dort `Strg + C` drücken, oder StudyForge mit einem anderen Port starten: `PORT=8888 npm run serve` (dann `http://localhost:8888` öffnen). |
| Die Seite lädt nicht / „Diese Seite ist nicht erreichbar" | Prüfen, ob im Terminal noch `StudyForge -> http://localhost:8787` steht (also der Server noch läuft) und ob im Browser wirklich `http://localhost:8787` (nicht `https://`) eingetragen ist. |
| `npm install` bricht mit vielen roten Fehlermeldungen ab | Meist eine zu alte Node.js-Version. `node --version` prüfen (siehe Schritt 1) — muss mindestens 22.13 sein. |
| Ich habe meine Fächer/Karten „verloren" | Wahrscheinlich wurde StudyForge aus einem anderen Ordner gestartet (jeder Ordner hat seine eigene `data/studyforge.db`), oder die Datenbank-Datei wurde gelöscht/verschoben. Prüfen, ob im Ordner `data/studyforge.db` existiert. |
| Cloud-Version: „401 Authentifizierung erforderlich" | Normal — das ist der Login-Schutz. Benutzername + Passwort eingeben, die du beim Einrichten bekommen hast. Vergessen? Claude Code fragen: *„Wie lauten die Zugangsdaten für meine StudyForge-Cloud-Version?"* |
| Cloud-Version reagiert gar nicht mehr | Der Server könnte pausiert/gestoppt sein (z. B. weil du das bewusst gemacht hast, siehe [Kosten](#kosten)). Claude Code bitten, den Status zu prüfen und ihn ggf. wieder zu starten. |

## Häufige Fragen (FAQ)

**Brauche ich Programmierkenntnisse?**
Nein. Für Weg A reicht Copy & Paste von drei Befehlen. Für Weg B übernimmt Claude
Code die technischen Schritte, wenn du sie nicht selbst machen möchtest.

**Funktioniert StudyForge auf dem Handy?**
Ja, im Handy-Browser — allerdings nur, wenn StudyForge über Weg B (Cloud) läuft,
da „lokal" bedeutet: nur auf dem einen Rechner erreichbar, auf dem es gestartet
wurde.

**Kann ich mehrere Fächer gleichzeitig haben?**
Ja, beliebig viele. Jedes Fach hat eigene Materialien, Karten, Fragen und Statistiken.

**Was passiert mit meinen Daten, wenn ich StudyForge deinstalliere?**
Nichts von selbst — deine Daten bleiben in `data/studyforge.db`, solange du den
Ordner nicht löschst. Lösche den Ordner erst, nachdem du ggf. ein Backup gemacht hast.

**Ist die Cloud-Version für mehr als 1–2 Personen geeignet?**
Der aktuell genutzte Servertyp ist bewusst klein gehalten und für 1–2 gleichzeitige
Nutzer ausgelegt. Für mehr Personen müsste ein größerer (teurerer) Server gewählt
werden — sag das einfach Claude Code, falls sich das ändert.

## Referenz: Umgebungsvariablen

Diese Einstellungen sind nur für den technischen Betrieb relevant (z. B. wenn
Claude Code den Server einrichtet) — im normalen Alltag musst du dich damit
nicht beschäftigen.

| Variable | Standardwert | Zweck |
|---|---|---|
| `PORT` | `8787` (lokal) / `80` (Cloud) | Auf welchem „Port" der Server erreichbar ist. |
| `DB_PATH` | `data/studyforge.db` | Wo die Datenbank-Datei liegt. |
| `SF_NO_SEED` | – | Auf `1` setzen, um beim allerersten Start **keine** Beispiel-Fächer anzulegen. |
| `SF_BASIC_AUTH` | – | Format `benutzer:passwort` — aktiviert den Login-Schutz (nur für Weg B relevant/empfohlen). |
| `LLM_PROVIDER` | – | Auf `anthropic` setzen, um die optionale KI-Generierung zu aktivieren. |
| `ANTHROPIC_API_KEY` | – | Dein Anthropic-API-Schlüssel (nur nötig, wenn `LLM_PROVIDER=anthropic`). |
| `ANTHROPIC_MODEL` | `claude-sonnet-5` | Welches Claude-Modell für die Kartenerstellung genutzt wird. |

## Technischer Hintergrund (für Interessierte)

Dieser Abschnitt ist **nicht nötig**, um StudyForge zu benutzen — nur für alle,
die wissen wollen, was „unter der Haube" passiert:

- **Backend:** Node.js mit nur zwei externen Bausteinen (`express` für den
  Webserver, `unpdf` für die PDF-Textextraktion), dazu die in Node eingebaute
  SQLite-Datenbank (`node:sqlite`) und ein einfacher In-Prozess-Scheduler für
  Hintergrund-Jobs.
- **Frontend:** React + Vite + TypeScript, gestaltet mit Tailwind CSS,
  Diagramme mit Recharts, Icons von Lucide.
- **Karten-/Fragengenerierung:** Eine selbst geschriebene, rein lokale
  Text-Analyse (Spracherkennung, Definitionserkennung, Lückentext-Erzeugung,
  Distraktoren für Multiple Choice) — optional ersetzbar/ergänzbar durch die
  Anthropic-API.
- **Datenhaltung:** Eine einzelne SQLite-Datei (`data/studyforge.db`) im
  WAL-Modus, keine externe Datenbank nötig.

Weitere technische Details, inklusive der genauen Cloud-Einrichtung, stehen in
[`CLAUDE_SETUP.md`](CLAUDE_SETUP.md).
