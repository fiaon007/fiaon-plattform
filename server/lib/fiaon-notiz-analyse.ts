// ═══════════════════════════════════════════════════════════════════════════
// DIE NOTIZ-ANALYSE DES STARTGESPRÄCHS (P1, Team-Feedback 28.08.2026)
//
// Florentine: „Ich führe das Gespräch, trage die Informationen in die Notiz
// ein und muss trotzdem jeden einzelnen Punkt noch einmal manuell als
// erledigt markieren. Die Notizleiste sollte die zentrale Grundlage sein —
// eine KI analysiert sie, erkennt die abgedeckten Punkte, und nur wenn etwas
// fehlt, macht das System darauf aufmerksam."
//
// ── WAS DIESER BAUSTEIN TUT ───────────────────────────────────────────────
// Er bekommt die frei getippte Gesprächsnotiz und die Agenda (shared/
// fiaon-onboarding-agenda.ts) und antwortet strukturiert:
//   erledigt          Schritte, die die Notiz WIRKLICH belegt
//   notizenJeSchritt  der Satz aus der Notiz, der zum Schritt gehört —
//                     er füllt das Pflichtnotiz-Feld des Schritts
//   fehlt             Schritte ohne Beleg, mit einem Hinweis-Satz
//                     („FEHLT NOCH: Laufende Kosten wurden nicht erwähnt.")
//   verbesserung      optional eine sauberere Fassung der Notiz —
//                     der Mitarbeiter ÜBERNIMMT sie oder lässt es
//
// ── DIE GRENZEN (nicht verhandelbar) ──────────────────────────────────────
// · Die KI HAKT NUR AB, was belegt ist — sie erfindet keine Inhalte. Der
//   Prompt verbietet das, und die Antwort wird gegen die Agenda validiert:
//   unbekannte Schlüssel fliegen raus.
// · Ohne Schlüssel/bei Fehler antwortet der Baustein ehrlich mit herkunft
//   'keine' — der manuelle Weg (Klicken) funktioniert dann wie bisher.
// · Es gehen NUR die Notiz und die Agenda-Texte ans Modell — keine
//   Kundendaten, keine Dokumente.
// ═══════════════════════════════════════════════════════════════════════════

import { AGENDA } from "../../shared/fiaon-onboarding-agenda";

export interface NotizAnalyse {
  ok: boolean;
  herkunft: "ki" | "keine";
  erledigt: string[];
  notizenJeSchritt: Record<string, string>;
  fehlt: { key: string; titel: string; hinweis: string }[];
  verbesserung: string | null;
  grund?: string;
}

const GUELTIGE_KEYS = new Set(AGENDA.map((a) => a.key));

function systemPrompt(): string {
  const schritte = AGENDA.map((a) =>
    `- key "${a.key}": ${a.titel} — ${a.zweck}${a.notizFrage ? ` (In die Notiz gehört: ${a.notizFrage})` : ""}`).join("\n");
  return `Du prüfst die Gesprächsnotiz eines Startgesprächs bei FIAON gegen die feste Agenda.

DIE AGENDA (Schritte mit key):
${schritte}

DEINE AUFGABE — antworte AUSSCHLIESSLICH mit einem JSON-Objekt:
{
  "erledigt": ["key", ...],
  "notizenJeSchritt": { "key": "der Satz/die Sätze aus der Notiz, die diesen Schritt belegen (wörtlich oder eng zusammengefasst, min. 10 Zeichen)" },
  "fehlt": [ { "key": "...", "hinweis": "FEHLT NOCH: <ein konkreter Satz, was im Gespräch noch zu klären oder zu dokumentieren ist>" } ],
  "verbesserung": "nur wenn die Notiz unklare Formulierungen oder sinnentstellende Fehler hat: die ganze Notiz sauber ausformuliert, sonst null"
}

REGELN:
- Ein Schritt gilt NUR als erledigt, wenn die Notiz ihn inhaltlich belegt. Nichts erfinden, nichts wohlwollend dazudichten.
- Jeder Agenda-key steht ENTWEDER in "erledigt" ODER in "fehlt" — nie in beiden, keiner fehlt.
- Für jeden erledigten Schritt MUSS "notizenJeSchritt" einen Beleg-Satz enthalten.
- "verbesserung" korrigiert nur Rechtschreibung und Klarheit — sie fügt KEINE neuen Inhalte hinzu. Kleinigkeiten ignorieren (dann null).
- Verbotene Wörter in allem, was du schreibst: Beratung, beraten, Empfehlung, Garantie, "wir verbessern Ihren Score".
- Deutsch, Kunden werden gesiezt.`;
}

export async function notizAnalysieren(notiz: string): Promise<NotizAnalyse> {
  const leer: NotizAnalyse = {
    ok: false, herkunft: "keine", erledigt: [], notizenJeSchritt: {}, fehlt: [], verbesserung: null,
  };
  const text = String(notiz || "").trim();
  if (text.length < 15) return { ...leer, grund: "Die Notiz ist noch zu kurz für eine Prüfung." };
  if (!process.env.OPENAI_API_KEY) return { ...leer, grund: "Kein KI-Schlüssel hinterlegt — bitte von Hand abhaken." };

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0.1,
        max_tokens: 900,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt() },
          { role: "user", content: `GESPRÄCHSNOTIZ:\n${text.slice(0, 6000)}` },
        ],
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return { ...leer, grund: `Die Prüfung ist gerade nicht erreichbar (HTTP ${res.status}).` };
    const json = (await res.json()) as any;
    const roh = JSON.parse(String(json?.choices?.[0]?.message?.content ?? "{}"));

    // ── VALIDIERUNG: Die Antwort wird an der Agenda gemessen ──────────────
    const erledigt = (Array.isArray(roh.erledigt) ? roh.erledigt : [])
      .map(String).filter((k: string) => GUELTIGE_KEYS.has(k));
    const notizen: Record<string, string> = {};
    if (roh.notizenJeSchritt && typeof roh.notizenJeSchritt === "object") {
      for (const [k, v] of Object.entries(roh.notizenJeSchritt)) {
        if (GUELTIGE_KEYS.has(k) && typeof v === "string" && v.trim().length >= 5) {
          notizen[k] = v.trim().slice(0, 600);
        }
      }
    }
    // Ein „erledigter" Schritt ohne Beleg-Satz ist nicht erledigt.
    const belegt = erledigt.filter((k: string) => (notizen[k] ?? "").length >= 5);
    const fehltRoh = (Array.isArray(roh.fehlt) ? roh.fehlt : [])
      .filter((f: any) => f && GUELTIGE_KEYS.has(String(f.key)))
      .map((f: any) => ({
        key: String(f.key),
        titel: AGENDA.find((a) => a.key === String(f.key))?.titel ?? String(f.key),
        hinweis: String(f.hinweis || "").slice(0, 300) || "FEHLT NOCH: Dieser Punkt ist in der Notiz nicht dokumentiert.",
      }));
    // Vollständigkeit erzwingen: Was weder belegt noch gemeldet ist, gilt als fehlend.
    for (const a of AGENDA) {
      if (!belegt.includes(a.key) && !fehltRoh.some((f: any) => f.key === a.key)) {
        fehltRoh.push({ key: a.key, titel: a.titel, hinweis: `FEHLT NOCH: „${a.titel}“ ist in der Notiz nicht dokumentiert.` });
      }
    }
    const verbesserung = typeof roh.verbesserung === "string" && roh.verbesserung.trim().length >= 20
      ? roh.verbesserung.trim().slice(0, 4000) : null;

    return {
      ok: true, herkunft: "ki",
      erledigt: belegt,
      notizenJeSchritt: notizen,
      fehlt: fehltRoh.filter((f: any) => !belegt.includes(f.key)),
      verbesserung,
    };
  } catch (err) {
    console.error("[NOTIZ-ANALYSE]", err instanceof Error ? err.message : err);
    return { ...leer, grund: "Die Prüfung ist gerade nicht erreichbar — bitte von Hand abhaken." };
  }
}
