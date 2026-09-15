// Offline generation engine: turns raw study text into flashcards + quiz questions.
// Deterministic, language-aware (DE/EN), no network required.
// An optional AI path (Anthropic) is used only when LLM_PROVIDER + ANTHROPIC_API_KEY are set.

const DE_STOP = new Set("der die das und oder aber ein eine einen einem einer dem den des ist sind war waren wird werden hat haben nicht auch als wie von zu mit auf für im in an bei aus nach über unter durch man sich dass wenn dann noch nur schon sehr mehr diese dieser dieses zum zur beim vom".split(/\s+/));
const EN_STOP = new Set("the a an and or but is are was were be been being to of in on for with as at by from this that these those it its not also into than then only more very can may will would should could".split(/\s+/));

const ARTICLES = new Set(["der", "die", "das", "ein", "eine", "einen", "einem", "einer", "dem", "den", "the", "a", "an"]);

// Terms that look like definitions but carry no study value.
const JUNK_TERMS = new Set([
  "beispiel", "beispiele", "hinweis", "achtung", "merke", "kapitel", "abschnitt", "ubung", "aufgabe",
  "losung", "zusammenfassung", "einfuhrung", "einleitung", "definition", "frage", "antwort", "tipp",
  "anmerkung", "vorwort", "inhalt", "uberblick", "ziel", "ziele", "beispielsweise",
  "example", "note", "chapter", "section", "summary", "introduction", "exercise", "solution", "goal",
]);
const asciiFold = (s) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");

export function detectLang(text) {
  const words = text.toLowerCase().match(/[a-zäöüß]+/g) || [];
  if (words.length < 8) return "de";
  let de = 0, en = 0;
  for (const w of words) {
    if (DE_STOP.has(w)) de++;
    if (EN_STOP.has(w)) en++;
  }
  return de >= en ? "de" : "en";
}

function stripMd(text) {
  return text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+[.)]\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/(^|[^*])\*([^*]+)\*/g, "$1$2")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s*>\s?/gm, "");
}

function splitSentences(text) {
  const out = [];
  for (const line of stripMd(text).split(/\r?\n/)) {
    const l = line.trim();
    if (l.length < 4) continue;
    for (const p of l.split(/(?<=[.!?])\s+(?=[A-Z0-9ÄÖÜ"„»])/)) {
      const s = p.trim();
      if (s.length > 3) out.push(s);
    }
  }
  return out;
}

function termRe(term, flags = "giu") {
  return new RegExp(`(?<!\\p{L})${reEscape(term)}(?!\\p{L})`, flags);
}
function hasTerm(text, term) {
  return termRe(term, "iu").test(text);
}

function splitLines(text) {
  return text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
}

function headingTerms(text) {
  const terms = new Set();
  for (const line of splitLines(text)) {
    const md = line.match(/^#{1,6}\s+(.{2,80})$/);
    if (md) { terms.add(md[1].replace(/[:.]+$/, "").trim()); continue; }
    if (line.length <= 60 && !/[.!?]$/.test(line) && /^[A-ZÄÖÜ]/.test(line) && line.split(" ").length <= 6) {
      terms.add(line.replace(/[:.]+$/, "").trim());
    }
  }
  return terms;
}

const cleanTerm = (t) =>
  t.replace(/^\s*(der|die|das|ein|eine|einen|einem|einer|dem|den|the|a|an)\s+/i, "")
    .replace(/[)(",.;:]+$/g, "")
    .replace(/^[)(",.;:]+/g, "")
    .trim();

const norm = (s) =>
  s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9äöüß ]/gi, " ").replace(/\s+/g, " ").trim();

function extractDefinitions(sentences, lang) {
  const defs = [];
  const deVerb = /\s+(ist|sind|war|waren|bezeichnet|beschreibt|bedeutet|meint|definiert(?: man)?(?: als)?|versteht man unter|nennt man|handelt es sich (?:um|bei))\s+/i;
  const enVerb = /\s+(is|are|was|were|means|refers to|is defined as|describes|denotes|is known as)\s+/i;
  for (const s of sentences) {
    if (s.length < 14 || s.length > 320) continue;

    const colon = s.match(/^([A-ZÄÖÜ][\w .\-/äöüß]{1,60}?)\s*[:–—-]\s+(.{6,260})$/);
    if (colon && !/\d[:.]\d/.test(colon[1])) {
      defs.push({ term: cleanTerm(colon[1]), definition: colon[2].trim(), sentence: s });
      continue;
    }

    const verb = lang === "de" ? deVerb : enVerb;
    const m = s.match(verb);
    if (!m) continue;
    const idx = s.indexOf(m[0]);
    const lhs = s.slice(0, idx).trim();
    const rhs = s.slice(idx + m[0].length).trim().replace(/[.]$/, "");
    const words = lhs.split(/\s+/);
    if (words.length === 0 || words.length > 6) continue;
    if (!/^[A-ZÄÖÜ"„]/.test(lhs)) continue;
    if (rhs.length < 6 || rhs.length > 260) continue;
    defs.push({ term: cleanTerm(lhs), definition: rhs, sentence: s });
  }
  const seen = new Set();
  return defs.filter((d) => {
    const k = norm(d.term);
    if (!k || k.length < 2 || seen.has(k)) return false;
    if (JUNK_TERMS.has(asciiFold(d.term))) return false;
    if (!/[A-Za-zÄÖÜäöü]/.test(d.term)) return false;
    if (/^(es|sie|er|dies|das|man|it|they|he)$/i.test(d.term)) return false;
    if (d.definition.split(/\s+/).length < 2) return false;
    seen.add(k);
    return true;
  });
}

function scoreTerms(text, lang, headings, definedTerms) {
  const freq = new Map();
  const tokens = text.match(/[A-ZÄÖÜ][\wäöüß-]{2,}(?:\s+[A-ZÄÖÜ][\wäöüß-]{2,}){0,2}/g) || [];
  for (const raw of tokens) {
    const t = cleanTerm(raw);
    const k = norm(t);
    if (!k || k.length < 3) continue;
    if ((lang === "de" ? DE_STOP : EN_STOP).has(k)) continue;
    if (JUNK_TERMS.has(asciiFold(t))) continue;
    if (!freq.has(k)) freq.set(k, { term: t, n: 0 });
    freq.get(k).n++;
  }
  const headNorm = new Set([...headings].map(norm));
  const defNorm = new Set([...definedTerms].map(norm));
  const scored = [];
  for (const [k, v] of freq) {
    if (v.n < 2 && !headNorm.has(k) && !defNorm.has(k)) continue;
    let s = v.n;
    if (headNorm.has(k)) s += 4;
    if (defNorm.has(k)) s += 5;
    if (v.term.includes(" ")) s += 1.5;
    scored.push({ term: v.term, key: k, score: s });
  }
  return scored.sort((a, b) => b.score - a.score);
}

function reEscape(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function makeCloze(sentence, term) {
  if (!hasTerm(sentence, term)) return null;
  const gapped = sentence.replace(termRe(term), " ______ ").replace(/\s{2,}/g, " ").trim();
  if (gapped === sentence || !gapped.includes("______")) return null;
  return gapped;
}

function corrupt(sentence, lang) {
  const numMatch = sentence.match(/\b(\d{1,4})([.,]\d+)?\b/);
  if (numMatch) {
    const n = parseInt(numMatch[1], 10);
    const delta = n === 0 ? 7 : Math.max(1, Math.round(n * 0.35));
    const replacement = String(n + delta);
    return { text: sentence.replace(numMatch[0], replacement + (numMatch[2] || "")), changed: true };
  }
  const swaps = lang === "de"
    ? [[/\bimmer\b/i, "nie"], [/\bnie\b/i, "immer"], [/\balle\b/i, "keine"], [/\bkeine\b/i, "alle"], [/\bhoch\b/i, "niedrig"], [/\bgross\b/i, "klein"], [/\bvor\b/i, "nach"]]
    : [[/\balways\b/i, "never"], [/\bnever\b/i, "always"], [/\ball\b/i, "no"], [/\bhigh\b/i, "low"], [/\blarge\b/i, "small"], [/\bbefore\b/i, "after"]];
  for (const [re, rep] of swaps) {
    if (re.test(sentence)) return { text: sentence.replace(re, rep), changed: true };
  }
  return { text: sentence, changed: false };
}

function pick(arr, n) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

export function generateHeuristic(text, lang = detectLang(text)) {
  const sentences = splitSentences(text);
  const headings = headingTerms(text);
  const defs = extractDefinitions(sentences, lang);
  const definedTerms = new Set(defs.map((d) => d.term));
  const terms = scoreTerms(text, lang, headings, definedTerms);
  const termPool = [...new Set([...defs.map((d) => d.term), ...terms.map((t) => t.term)])];

  const cards = [];
  const seenFront = new Set();
  const addCard = (c) => {
    const k = norm(c.front) + "|" + c.type;
    if (seenFront.has(k) || !c.front || !c.back) return;
    seenFront.add(k);
    cards.push(c);
  };

  for (const d of defs) {
    const q = lang === "de" ? `Was versteht man unter „${d.term}“?` : `What is “${d.term}”?`;
    addCard({ type: "basic", front: q, back: d.definition.replace(/^\s*[a-zäöü]/, (c) => c.toUpperCase()), hint: d.term.slice(0, 1) + "…", origin: "heuristic" });
  }

  const usedSentences = new Set();
  for (const t of terms.slice(0, 40)) {
    const cand = sentences.find(
      (s) => !usedSentences.has(s) && s.length >= 40 && s.length <= 210 && hasTerm(s, t.term)
    );
    if (!cand) continue;
    const gapped = makeCloze(cand, t.term);
    if (!gapped) continue;
    usedSentences.add(cand);
    addCard({ type: "cloze", front: gapped, back: t.term, hint: `${t.term.length} Zeichen`, origin: "heuristic" });
    if (cards.filter((c) => c.type === "cloze").length >= 18) break;
  }

  for (const h of headings) {
    if (defs.some((d) => norm(d.term) === norm(h))) continue;
    const s = sentences.find(
      (x) => hasTerm(x, h) && x.length > 30 && x.length < 240 && !defs.some((d) => d.sentence === x)
    );
    if (s) {
      addCard({
        type: "basic",
        front: lang === "de" ? `Was ist über „${h}“ zu wissen?` : `What should you know about “${h}”?`,
        back: s,
        hint: "",
        origin: "heuristic",
      });
    }
  }

  const questions = [];
  const addQ = (q) => {
    if (!q.prompt || !q.answer) return;
    questions.push({ ord: questions.length, ...q });
  };

  for (const d of pick(defs, Math.min(defs.length, 12))) {
    const distract = pick(termPool.filter((t) => norm(t) !== norm(d.term)), 3);
    if (distract.length < 3) continue;
    const options = pick([d.term, ...distract], 4);
    addQ({
      type: "mc",
      prompt: (lang === "de" ? "Welcher Begriff passt zu dieser Beschreibung?\n\n" : "Which term matches this description?\n\n") + `„${d.definition}“`,
      options,
      answer: d.term,
      explanation: `${d.term}: ${d.definition}`,
    });
  }

  for (const d of pick(defs.filter((x) => !questions.some((q) => q.answer === x.term)), Math.min(defs.length, 6))) {
    const others = pick(defs.filter((x) => norm(x.term) !== norm(d.term)).map((x) => x.definition), 3);
    if (others.length < 3) continue;
    addQ({
      type: "mc",
      prompt: (lang === "de" ? `Welche Beschreibung trifft auf „${d.term}“ zu?` : `Which description fits “${d.term}”?`),
      options: pick([d.definition, ...others], 4),
      answer: d.definition,
      explanation: `${d.term}: ${d.definition}`,
    });
  }

  const T = lang === "de" ? "Wahr" : "True";
  const F = lang === "de" ? "Falsch" : "False";
  const factSents = pick(
    sentences.filter((s) => s.length > 40 && s.length < 200 && /\d|[A-ZÄÖÜ][a-zäöü]+/.test(s)),
    12
  );
  factSents.forEach((s, i) => {
    if (questions.filter((q) => q.type === "truefalse").length >= 6) return;
    const wantFalse = i % 2 === 0;
    let text = s, isFalse = false;
    if (wantFalse) {
      const c = corrupt(s, lang);
      if (c.changed) { text = c.text; isFalse = true; }
      else {
        // swap a domain term for a different one to make a plausible falsehood
        const inS = termPool.filter((t) => hasTerm(s, t));
        const repl = pick(termPool.filter((t) => !inS.some((x) => norm(x) === norm(t))), 1)[0];
        if (inS.length && repl) { text = s.replace(termRe(inS[0]), repl); isFalse = true; }
      }
    }
    addQ({
      type: "truefalse",
      prompt: text,
      options: [T, F],
      answer: isFalse ? F : T,
      explanation: isFalse ? `Original: ${s}` : (lang === "de" ? "Aussage entspricht dem Quelltext." : "Matches the source text."),
    });
  });

  for (const t of pick(terms.slice(0, 25), 6)) {
    const cand = sentences.find((s) => s.length >= 40 && s.length <= 200 && hasTerm(s, t.term));
    if (!cand) continue;
    const gapped = makeCloze(cand, t.term);
    if (!gapped) continue;
    addQ({ type: "cloze", prompt: gapped, options: [], answer: t.term, explanation: cand });
  }

  return {
    lang,
    stats: { sentences: sentences.length, definitions: defs.length, terms: terms.length },
    cards: cards.slice(0, 60),
    questions: pick(questions, questions.length).slice(0, 24),
  };
}

async function generateWithAnthropic(text, lang) {
  const key = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
  const prompt = `You build study aids. From the SOURCE below produce compact JSON:
{"cards":[{"type":"basic|cloze","front":"","back":"","hint":""}],
 "questions":[{"type":"mc|truefalse|cloze|short","prompt":"","options":[],"answer":"","explanation":""}]}
Rules: language = ${lang}. 8-20 cards, 6-15 questions. Cloze front uses "______" for the gap. mc has exactly 4 options, answer is one of them. Only output JSON.
SOURCE:
${text.slice(0, 12000)}`;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model, max_tokens: 4000, messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}`);
  const data = await res.json();
  const txt = (data.content || []).map((c) => c.text || "").join("");
  const json = JSON.parse(txt.slice(txt.indexOf("{"), txt.lastIndexOf("}") + 1));
  json.cards = (json.cards || []).map((c) => ({ hint: "", ...c, origin: "ai" }));
  json.questions = (json.questions || []).map((q, i) => ({ ord: i, options: [], explanation: "", ...q }));
  json.lang = lang;
  json.stats = { source: "ai" };
  return json;
}

export async function generate(text) {
  const lang = detectLang(text);
  if (process.env.LLM_PROVIDER === "anthropic" && process.env.ANTHROPIC_API_KEY) {
    try {
      const ai = await generateWithAnthropic(text, lang);
      if (ai.cards?.length) return ai;
    } catch (err) {
      console.warn("[generate] AI path failed, using heuristic:", err.message);
    }
  }
  return generateHeuristic(text, lang);
}

export function gradeText(expected, got) {
  const e = norm(expected).split(" ").filter((w) => !ARTICLES.has(w));
  const g = norm(got).split(" ").filter((w) => !ARTICLES.has(w));
  if (!g.length) return false;
  const es = e.join(" "), gs = g.join(" ");
  if (es === gs) return true;
  if (es.includes(gs) || gs.includes(es)) return e.length <= 4 || gs.length >= es.length * 0.7;
  const overlap = g.filter((w) => e.includes(w)).length / Math.max(e.length, 1);
  return overlap >= 0.6;
}
