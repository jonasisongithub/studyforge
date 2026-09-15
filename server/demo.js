import { db, uid, nowISO } from "./db.js";
import { generateHeuristic } from "./generate.js";

const SAMPLES = [
  {
    name: "Biologie: Zellbiologie",
    emoji: "🧬",
    color: "#22c55e",
    title: "Die Zelle – Grundlagen",
    content: `# Die Zelle

Die Zelle ist die kleinste lebensfähige Einheit aller Organismen. Man unterscheidet Prokaryoten und Eukaryoten.

Prokaryoten sind Zellen ohne echten Zellkern, zum Beispiel Bakterien. Eukaryoten sind Zellen mit einem membranumhüllten Zellkern.

Das Mitochondrium ist das Kraftwerk der Zelle und erzeugt ATP durch Zellatmung. Der Zellkern enthält die DNA und steuert die Genexpression.

Das endoplasmatische Retikulum ist ein Membransystem für die Proteinsynthese und den Stofftransport. Der Golgi-Apparat modifiziert und verpackt Proteine.

Ribosomen sind die Orte der Proteinbiosynthese. Die Zellmembran ist eine selektiv permeable Barriere aus einer Phospholipid-Doppelschicht.

Die Fotosynthese findet in den Chloroplasten statt und wandelt Lichtenergie in chemische Energie um. Pro Glucosemolekül werden 6 Moleküle Kohlendioxid gebunden.`,
  },
  {
    name: "Informatik: Netzwerke",
    emoji: "🌐",
    color: "#3366ff",
    title: "TCP/IP und das OSI-Modell",
    content: `# Netzwerkgrundlagen

Das OSI-Modell ist ein Referenzmodell mit sieben Schichten für die Kommunikation in Netzwerken.

TCP ist ein verbindungsorientiertes Protokoll, das eine zuverlässige Übertragung garantiert. UDP ist ein verbindungsloses Protokoll ohne Empfangsbestätigung.

Eine IP-Adresse identifiziert einen Host in einem Netzwerk eindeutig. Der Router verbindet unterschiedliche Netzwerke und leitet Pakete anhand der Ziel-IP weiter.

DNS ist ein System, das Domainnamen in IP-Adressen übersetzt. Ein Switch verbindet Geräte innerhalb desselben lokalen Netzwerks auf der Schicht 2.

Die Latenz ist die Verzögerung bei der Datenübertragung. Die Bandbreite beschreibt die maximale Datenrate einer Verbindung. Der TCP-Handshake besteht aus drei Schritten.`,
  },
];

export function seedDemo() {
  const now = nowISO();
  let subjects = 0, cards = 0, questions = 0;
  for (const s of SAMPLES) {
    const sid = uid();
    db.prepare("INSERT INTO subject(id,name,description,color,emoji,created_at) VALUES(?,?,?,?,?,?)")
      .run(sid, s.name, "Beispielmaterial zum Ausprobieren", s.color, s.emoji, now);
    subjects++;

    const mid = uid();
    const gen = generateHeuristic(s.content);
    db.prepare("INSERT INTO material(id,subject_id,title,content,status,lang,generated,created_at,processed_at) VALUES(?,?,?,?,'committed',?,?,?,?)")
      .run(mid, sid, s.title, s.content, gen.lang, JSON.stringify(gen), now, now);

    const insCard = db.prepare(
      "INSERT INTO card(id,subject_id,material_id,type,front,back,hint,origin,created_at,due_at) VALUES(?,?,?,?,?,?,?,?,?,?)"
    );
    for (const c of gen.cards) {
      insCard.run(uid(), sid, mid, c.type, c.front, c.back, c.hint || "", c.origin || "heuristic", now, now);
      cards++;
    }
    const insQ = db.prepare(
      "INSERT INTO question(id,subject_id,material_id,type,prompt,options,answer,explanation,origin,created_at,due_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)"
    );
    for (const q of gen.questions) {
      insQ.run(uid(), sid, mid, q.type, q.prompt, JSON.stringify(q.options || []), q.answer, q.explanation || "", q.origin || "heuristic", now, now);
      questions++;
    }
  }
  return { ok: true, subjects, cards, questions };
}
