# Anleitung für Claude Code: StudyForge einrichten

Dieses Dokument richtet sich **an dich, Claude Code** (bzw. jede andere
KI-Coding-Umgebung, die diese Datei liest) — nicht an den Menschen, der dich
benutzt. Es beschreibt, wie du StudyForge für einen **nicht-technischen
Nutzer** lokal startest oder in der Google Cloud bereitstellst, ohne dass er
selbst etwas im Terminal eintippen muss.

Lies dieses Dokument vollständig, **bevor** du etwas ausführst. Es enthält
neben den reinen Befehlen auch mehrere real aufgetretene Stolperfallen — wenn
du die ignorierst, wirst du sie wahrscheinlich wiederholen.

Die für Menschen geschriebene, nicht-technische Version dieser Anleitung
steht in [`README.md`](README.md). Beziehe dich dort hin, wenn der Nutzer
selbst nachlesen möchte — dupliziere den Inhalt nicht in deinen Chat-Antworten,
sondern fasse zusammen und verlinke.

## Grundregeln im Umgang mit dem Nutzer

- Geh davon aus, dass der Nutzer **keine Entwickler-Begriffe** kennt. Sag nicht
  „ich führe `npm install` aus", sondern z. B. „ich installiere jetzt die
  Bausteine, die die App braucht — das dauert ca. eine Minute."
- **Bevor du kostenpflichtige Cloud-Ressourcen anlegst** (eine neue VM, o. Ä.):
  hol dir explizit ein „Ja" vom Nutzer und nenne vorher die ungefähren Kosten
  (siehe [Kosten](#kosten-transparent-kommunizieren)). Das gilt auch, wenn der
  Nutzer nur allgemein „mach das online verfügbar" gesagt hat — frag kurz nach,
  ob er weiß, dass das ein kleines, laufendes Cloud-Konto voraussetzt.
- **Bevor du irgendetwas öffentlich zugänglich machst** (Firewall-Regel,
  neues öffentliches GitHub-Repo o. Ä.): kurz ankündigen, was das bedeutet.
- Am Ende einer erfolgreichen Einrichtung: gib dem Nutzer **immer** eine klare,
  kopierbare Zusammenfassung — Adresse (URL), ggf. Zugangsdaten, und in einem
  Satz, was er jetzt tun kann („Öffne diesen Link in deinem Browser …").
- Wenn du eine bereits bestehende Cloud-Einrichtung vorfindest (siehe
  [„Existiert schon etwas?"](#existiert-schon-etwas-immer-zuerst-prüfen)),
  erstelle **keine zweite** — das würde doppelte Kosten verursachen.

---

## Teil 1: Lokal einrichten

Das ist der unkritische, kostenlose Fall. Führe diese Befehle für den Nutzer
im Terminal aus (du hast dazu ohnehin Werkzeuge) und fasse die Ergebnisse in
einfachen Worten zusammen.

```bash
node --version
```

Muss `v22.13` oder neuer sein (empfohlen: die aktuelle LTS-Version, z. B. v24).
Ist das nicht der Fall oder ist `node` gar nicht gefunden: Erkläre dem Nutzer,
dass er Node.js von [nodejs.org](https://nodejs.org) installieren muss (die
„LTS"-Version), oder installiere es selbst, falls du dazu die Berechtigung hast
(z. B. via Homebrew auf dem Mac: `brew install node`).

```bash
npm install
npm run serve
```

Erwartete Ausgabe am Ende (unter anderem):

```
  StudyForge  ->  http://localhost:8787
```

Prüfe, dass der Server wirklich antwortet:

```bash
curl -s http://localhost:8787/api/health
```

Erwartet: `{"ok":true, ...}`. Öffne danach `http://localhost:8787` im Browser
für den Nutzer (bzw. sag ihm, dass er das tun soll).

**Wichtig:** `npm run serve` blockiert das Terminal (der Server läuft, bis er
gestoppt wird). Wenn du selbst Befehle ausführst, starte ihn im Hintergrund
(`run_in_background`), damit du danach noch etwas testen kannst.

---

## Teil 2: Cloud-Deployment (Google Cloud)

### Existiert schon etwas? Immer zuerst prüfen

> **Bekannter Stand (Stand 2026-09-15):** Für dieses Projekt existiert bereits
> eine laufende Bereitstellung — GCP-Projekt `all-my-exs-band-app`, VM
> `studyforge-vm`, Zone `europe-west3-a`, erreichbar unter `http://34.40.123.97/`.
> Prüfe zuerst, ob sie noch existiert und läuft (Befehle unten), bevor du
> Schritte 1–9 unten ausführst — falls ja, brauchst du nur einen Redeploy
> (Schritte 6–7) oder gar nichts. Diese Angaben können veraltet sein (z. B.
> wenn die VM zwischenzeitlich gelöscht wurde) — verifiziere sie live, verlass
> dich nicht blind darauf.

Bevor du irgendetwas anlegst:

```bash
gcloud auth list
gcloud projects list
gcloud compute instances list --project=<PROJECT_ID>
```

Falls bereits eine Instanz existiert, die aussieht wie eine frühere
StudyForge-Bereitstellung (z. B. Name enthält „studyforge"), **nutze diese
weiter**, statt eine neue anzulegen. Hol dir ihre externe IP:

```bash
gcloud compute instances describe <VM_NAME> --zone=<ZONE> --project=<PROJECT_ID> \
  --format="value(networkInterfaces[0].accessConfigs[0].natIP)"
```

und teste sie (`curl -s -u <user>:<pass> http://<IP>/api/health`), bevor du
etwas Neues baust. Das aktuelle Zugangspasswort steht **nicht** in diesem
Repo (bewusst, siehe [Sicherheit](#sicherheits-hinweise)) — du findest es,
falls nötig, per SSH auf der laufenden VM:

```bash
gcloud compute ssh <VM_NAME> --zone=<ZONE> --project=<PROJECT_ID> \
  --command="sudo grep SF_BASIC_AUTH /etc/systemd/system/studyforge.service"
```

### Kosten transparent kommunizieren

Bevor du eine neue VM anlegst, sag dem Nutzer explizit:

> „Ich lege dafür einen kleinen, dauerhaft laufenden Cloud-Server bei Google
> an (Typ `e2-micro`, die kleinste sinnvolle Größe). Das kostet etwa 6–8 € im
> Monat, solange der Server läuft. Soll ich fortfahren?"

Erst nach einem klaren „Ja" weitermachen.

### Voraussetzungen

- `gcloud` CLI ist installiert und mit einem Google-Konto angemeldet, das
  Zugriff auf ein Projekt mit aktivierter Abrechnung hat (`gcloud auth list`,
  `gcloud config get-value project`).
- Compute Engine API ist aktiviert (sonst: `gcloud services enable compute.googleapis.com --project=<PROJECT_ID>`).

### Schritt-für-Schritt (exakt so für dieses Projekt verifiziert)

Diese Werte wurden bei der ursprünglichen Einrichtung tatsächlich verwendet
und funktionieren nachweislich — übernimm sie 1:1, wenn der Nutzer keine
anderen Vorgaben macht (nur `<PROJECT_ID>` und ggf. Passwort anpassen):

**1. VM anlegen** (Debian 12, kleinste sinnvolle Größe, Frankfurt für niedrige
Latenz aus Deutschland — Region anpassen, falls der Nutzer woanders sitzt):

```bash
gcloud compute instances create studyforge-vm \
  --project=<PROJECT_ID> \
  --zone=europe-west3-a \
  --machine-type=e2-micro \
  --image-family=debian-12 --image-project=debian-cloud \
  --boot-disk-size=10GB --boot-disk-type=pd-standard \
  --tags=studyforge-http \
  --labels=app=studyforge
```

**2. Firewall-Regel** (öffnet Port 80 nur für Instanzen mit diesem Tag):

```bash
gcloud compute firewall-rules create studyforge-allow-http \
  --project=<PROJECT_ID> --network=default --direction=INGRESS \
  --action=ALLOW --rules=tcp:80 --source-ranges=0.0.0.0/0 \
  --target-tags=studyforge-http
```

**3. Zeitzone auf der VM setzen** (wichtig — siehe [Gotcha „Zeitzone"](#gotchas-real-aufgetretene-fehler)):

```bash
gcloud compute ssh studyforge-vm --zone=europe-west3-a --project=<PROJECT_ID> \
  --command="sudo timedatectl set-timezone Europe/Berlin"
```

(Andere Zeitzone wählen, falls der Nutzer nicht in Deutschland sitzt — muss
zur Zeitzone des Nutzers passen, siehe Gotcha unten.)

**4. Node.js 24 auf der VM installieren** (via NodeSource — Debians
Bordmittel-Node ist zu alt für `node:sqlite`, siehe Gotchas):

```bash
gcloud compute ssh studyforge-vm --zone=europe-west3-a --project=<PROJECT_ID> --command='
  curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
  sudo apt-get install -y nodejs
  node --version
'
```

**5. Eigenen Dienst-Benutzer anlegen** (kein Login-Shell, aus Sicherheitsgründen
läuft der Server nicht als root):

```bash
gcloud compute ssh studyforge-vm --zone=europe-west3-a --project=<PROJECT_ID> --command='
  sudo useradd --system --home-dir /opt/studyforge --shell /usr/sbin/nologin studyforge || true
  sudo mkdir -p /opt/studyforge
'
```

**6. Code bauen und hochladen** — lokal, im Projektordner:

```bash
npm run build
mkdir -p /tmp/sf-deploy
cp -r server dist shared package.json package-lock.json /tmp/sf-deploy/
# WICHTIG: shared/ NICHT vergessen (siehe Gotchas) — server/index.js importiert
# ../shared/day.js, ohne diesen Ordner startet der Server auf der VM nicht.
tar -czf /tmp/studyforge.tgz -C /tmp/sf-deploy .
gcloud compute scp /tmp/studyforge.tgz studyforge-vm:~/ --zone=europe-west3-a --project=<PROJECT_ID>
```

**7. Auf der VM entpacken und Abhängigkeiten installieren:**

```bash
gcloud compute ssh studyforge-vm --zone=europe-west3-a --project=<PROJECT_ID> --command='
  sudo mkdir -p /opt/studyforge
  sudo tar -xzf ~/studyforge.tgz -C /opt/studyforge
  cd /opt/studyforge
  sudo npm ci --omit=dev --no-audit --no-fund
  sudo mkdir -p data
  sudo chown -R studyforge:studyforge /opt/studyforge
'
```

**8. Ein zufälliges, sicheres Passwort erzeugen** (nicht selbst ausdenken):

```bash
PASS=$(openssl rand -base64 18 | tr -dc 'a-zA-Z0-9' | head -c 20)
echo "Benutzername: studyforge   Passwort: $PASS"
```

Notiere dir `$PASS` für den nächsten Schritt und für die Nachricht an den Nutzer.

**9. systemd-Dienst einrichten** (startet den Server automatisch, auch nach
einem Neustart der VM; bindet Port 80 ohne Root-Rechte per
`AmbientCapabilities`). Ersetze `<PASS>` durch das erzeugte Passwort:

```bash
gcloud compute ssh studyforge-vm --zone=europe-west3-a --project=<PROJECT_ID> --command="
sudo tee /etc/systemd/system/studyforge.service > /dev/null <<'UNIT'
[Unit]
Description=StudyForge
After=network.target

[Service]
Type=simple
User=studyforge
WorkingDirectory=/opt/studyforge
Environment=NODE_ENV=production
Environment=PORT=80
Environment=SF_BASIC_AUTH=studyforge:<PASS>
ExecStart=/usr/bin/node server/index.js
AmbientCapabilities=CAP_NET_BIND_SERVICE
Restart=always
RestartSec=2
NoNewPrivileges=true
ProtectSystem=full
ProtectHome=true
ReadWritePaths=/opt/studyforge/data

[Install]
WantedBy=multi-user.target
UNIT
sudo systemctl daemon-reload
sudo systemctl enable --now studyforge
sudo systemctl is-active studyforge
"
```

**10. Von außen verifizieren** (von deinem eigenen Rechner aus, nicht per SSH):

```bash
IP=$(gcloud compute instances describe studyforge-vm --zone=europe-west3-a --project=<PROJECT_ID> \
  --format="value(networkInterfaces[0].accessConfigs[0].natIP)")
curl -s -o /dev/null -w "ohne Login: %{http_code}\n" "http://$IP/"          # erwartet: 401
curl -s -u "studyforge:$PASS" "http://$IP/api/health"; echo                  # erwartet: {"ok":true,...}
```

**11. Dem Nutzer mitteilen** (Vorlage):

> StudyForge läuft jetzt unter **http://`$IP`/**.
> Anmeldedaten: Benutzername `studyforge`, Passwort `$PASS`
> (dein Browser fragt danach einmalig und merkt es sich).

### Redeploy nach Code-Änderungen

Wiederhole nur Schritte 6, 7 und `sudo systemctl restart studyforge` — die
Schritte 1–5 und 9 (VM, Firewall, Zeitzone, Node, Dienst-Nutzer, systemd-Unit)
sind einmalig. **Lösche vor einem Redeploy nicht** die Datei
`data/studyforge.db` auf der VM, außer der Nutzer möchte ausdrücklich einen
Reset — sonst gehen sein Lernfortschritt und seine Fächer verloren.

### Server pausieren / löschen (Kosten stoppen)

```bash
# Pausieren (Daten bleiben, kaum noch Kosten, Server ist nicht erreichbar):
gcloud compute instances stop studyforge-vm --zone=europe-west3-a --project=<PROJECT_ID>
# Wieder starten:
gcloud compute instances start studyforge-vm --zone=europe-west3-a --project=<PROJECT_ID>
# Komplett löschen (alle Cloud-Daten weg, keine weiteren Kosten):
gcloud compute instances delete studyforge-vm --zone=europe-west3-a --project=<PROJECT_ID>
gcloud compute firewall-rules delete studyforge-allow-http --project=<PROJECT_ID>
```

Vor dem Löschen unbedingt fragen, ob der Nutzer vorher noch ein Backup der
Lerndaten möchte (`data/studyforge.db` per `gcloud compute scp` herunterladen).

---

## Gotchas (real aufgetretene Fehler)

Diese Probleme sind bei der Entwicklung tatsächlich aufgetreten. Lies sie,
damit du sie nicht wiederholst.

- **`node:sqlite` braucht ein aktuelles Node.js.** Erst ab Node 22.13 / 23.4
  ist das Modul ohne Experimental-Flag nutzbar. Debians Standard-Node-Paket
  ist meist viel älter — immer über NodeSource (`setup_24.x`) installieren,
  nicht `apt install nodejs` direkt.
- **PDF-Text-Extraktion: `pdf-parse` NICHT verwenden.** Es bündelt ein
  jahrealtes `pdf.js` (v1.10.100), das an modernen PDFs mit
  Cross-Reference-Streams (Standard seit PDF 1.5, z. B. viele Word-/Google-
  Docs-Exporte) mit „Invalid PDF structure" scheitert. Dieses Projekt nutzt
  stattdessen `unpdf` (`server/pdf.js`), eine aktuelle, gewartete pdf.js-
  Variante. **Wichtig dabei:** `unpdf`/`pdf.js` akzeptiert nur ein echtes
  `Uint8Array`, **kein** Node-`Buffer` (obwohl `Buffer` technisch eines ist) —
  vorher explizit umwandeln (siehe `extractPdfText()` in `server/pdf.js`).
- **Framer Motion wurde bewusst entfernt.** In automatisierten/headless
  Browser-Tests blieben `<motion.div>`-Animationen teils bei Opacity 0
  hängen (nie fertig gerendert) — nicht sichtbar für echte Nutzer im
  Normalbetrieb, aber ein Zeichen für Fragilität. Alle Animationen laufen
  jetzt über einfache CSS-Klassen (`animate-fade-in`, `animate-pop` in
  `src/index.css`). Führe Framer Motion nicht leichtfertig wieder ein.
- **Kalender-Tage: nur EINE Funktion verwenden.** `shared/day.js`
  (`dayKey(date)`) ist die einzige Stelle im ganzen Projekt, die aus einem
  Zeitstempel einen lokalen Kalendertag (`YYYY-MM-DD`) macht — server- *und*
  clientseitig importiert. Nie SQL `date(x,'localtime')` oder eine zweite,
  selbst gebaute Variante einführen — genau das hat früher zu einem Bug
  geführt (Lern-Historie zeigte falsche/keine Farben, weil Server und
  Client sich uneinig waren, welcher Kalendertag gerade ist).
- **Deploy-Bundle muss `shared/` enthalten.** `server/index.js` und
  `server/db.js` importieren `../shared/day.js`. Wird beim Packen für die
  Cloud nur `server/ dist/ package*.json` kopiert (ohne `shared/`), startet
  der Server auf der VM nicht.
- **VM-Zeitzone muss zur Zeitzone des Nutzers passen.** Die Lern-Historie
  gruppiert Antworten nach Kalendertag in der **lokalen Zeit des Servers**.
  Läuft die VM auf UTC (Google-Standard) und der Nutzer in Deutschland,
  können Antworten kurz vor/nach Mitternacht auf dem falschen Tag landen.
  Deshalb immer `timedatectl set-timezone` passend zum Nutzer setzen, **und
  danach den Dienst neu starten**, damit Node die neue Zeitzone übernimmt.
- **Tailwind-Klassen niemals dynamisch zusammensetzen** (z. B.
  `` `bg-brand-${level}00` ``). Tailwinds Build-Schritt durchsucht die
  Quelldateien nach vollständig ausgeschriebenen Klassennamen — eine
  zusammengesetzte Zeichenkette wird nicht gefunden und die Farbe fehlt im
  fertigen CSS. Siehe `src/lib/heatmap.ts` für das korrekte Muster (jede
  Stufe hat ihre Klasse vollständig ausgeschrieben in einer Konstante).
- **Beim Testen mit `curl`/`zsh`: URLs mit `?` in Anführungszeichen setzen**
  (z. B. `curl -s "http://host/api/x?y=1"`), sonst interpretiert die Shell
  das `?` als Datei-Glob-Muster und bricht mit „no matches found" ab.
- **Datumsgrenzen beim Heatmap-Raster:** Wenn ein Wochen-Raster gebaut wird
  (X Wochen zurück, auf Montag ausgerichtet), zuerst auf den Montag der
  **aktuellen** Woche verankern und dann wochenweise zurückgehen — nicht
  „heute minus N Tage" berechnen und *danach* auf Montag zurückschnappen.
  Letzteres verschiebt das End-Datum abhängig vom Wochentag bis zu 6 Tage
  vor „heute" und lässt die jüngsten Tage (inkl. „heute") im Raster
  verschwinden, ohne Fehlermeldung.

---

## Sicherheits-Hinweise

- Nie das tatsächliche `SF_BASIC_AUTH`-Passwort in eine Datei schreiben, die
  ins Git-Repository committet wird (auch nicht in Kommentare, Beispiel-
  Dateien oder README-Updates) — auch wenn das Repo privat ist.
- Die Cloud-Verbindung läuft über `http://`, nicht `https://` (kein
  TLS-Zertifikat eingerichtet). Für eine private 1–2-Personen-App ein
  akzeptierter Kompromiss, aber weise den Nutzer aktiv darauf hin, wenn er
  danach fragt oder die Adresse weitergeben möchte.
- Lege beim ersten Deployment immer ein neu erzeugtes, zufälliges Passwort
  an (Schritt 8) — nie ein vom Nutzer woanders wiederverwendetes Passwort
  vorschlagen oder selbst raten.
