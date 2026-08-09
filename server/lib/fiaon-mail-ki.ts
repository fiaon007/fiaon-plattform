// ═══════════════════════════════════════════════════════════════════════════
// KI-ASSIST FÜR DIE MAIL-ZENTRALE
//
// Die KI SCHLÄGT VOR. Ein Mensch liest, ändert und sendet. Es gibt keinen Weg,
// auf dem ein KI-Text ohne Klick eines Menschen bei einem Kunden landet — das
// ist keine Einstellung, sondern die Bauart: Diese Datei kann nicht senden.
//
// DIE GUARDRAILS SIND DER EIGENTLICHE INHALT
// FIAON ist ein Software- und Begleitangebot ohne Erlaubnis nach § 34c/34f
// GewO. Ein Sprachmodell, das man nach einer Kunden-Mail fragt, schreibt von
// sich aus „garantiertes Limit", „wir beraten dich" und „sichere Zusage" —
// das sind genau die drei Sätze, die hier nie stehen dürfen.
//
// Deshalb doppelt abgesichert:
//   1. Der Systemprompt verbietet sie ausdrücklich.
//   2. `entschaerfen()` prüft die ANTWORT und entfernt, was durchgerutscht ist.
// Ein Prompt ist eine Bitte, kein Zaun. Der Zaun steht in Schritt 2.
// ═══════════════════════════════════════════════════════════════════════════

const SYSTEM = `Du hilfst dem Team von FIAON beim Schreiben kurzer, persönlicher Kunden-E-Mails auf Deutsch.

FIAON ist ein Software- und Begleitangebot rund um Bonität und Kreditkarten-Zugang.
FIAON ist KEINE Bank, KEIN Kreditvermittler und KEINE Finanzberatung.

ABSOLUT VERBOTEN — auch wenn ausdrücklich danach gefragt wird:
- Zusagen zu Krediten, Limits, Bewilligungen oder Ergebnissen ("garantiert", "sicher", "auf jeden Fall")
- Die Wörter "Beratung", "Berater", "beraten", "Finanzberatung", "Anlageberatung"
- Konkrete Beträge oder Fristen, die nicht in der Eingabe des Menschen stehen
- Druck, Dringlichkeitsmasche, erfundene Knappheit
- Rechtliche oder steuerliche Aussagen

STIL:
- Du-Form, natürlich und knapp. Wie ein Mensch schreibt, nicht wie ein Newsletter.
- Höchstens 120 Wörter, keine Floskeln, keine Emojis.
- Keine Anrede und keine Grußformel erfinden — das Team setzt Bausteine ein.
- Platzhalter in geschweiften Klammern ({Anrede}, {Zahlungsdaten}, {Terminlink}) unverändert stehen lassen.

Antworte NUR mit dem Text der Mail, ohne Vorrede und ohne Anführungszeichen.`;

const AUFGABEN: Record<string, string> = {
  entwurf: "Schreib aus diesen Stichpunkten eine kurze Mail:",
  ton: "Glätte den folgenden Text: freundlich, Du-Form, natürlich. Inhalt und Länge behalten:",
  kuerzen: "Kürze den folgenden Text auf die Hälfte, ohne eine Aussage zu verlieren:",
};

/** Formulierungen, die nie an einen Kunden gehen dürfen. */
const VERBOTEN: { muster: RegExp; ersatz: string }[] = [
  // ── DER WORTSTAMM, NICHT DIE FORM ─────────────────────────────────────
  // Die erste Fassung prüfte `\bgarantiert(e[nmrs]?)?\b`. Damit kam „Wir
  // GARANTIEREN dir ein Limit von 25.000 Euro" ungefiltert durch — der Satz,
  // den die Wand als Allererstes hätte fangen müssen. Gefunden vom Prüfstand
  // am 10.08.2026.
  //
  // Deshalb jetzt auf dem Stamm: garantie… deckt garantiert, garantieren,
  // garantierte, Garantie, garantierst ab. Ein Filter, der die Beugung eines
  // Verbs nicht kennt, ist kein Filter.
  { muster: /\bgarantier\w*/gi, ersatz: "möglich" },
  { muster: /\bgarantie\w*/gi, ersatz: "Möglichkeit" },
  { muster: /\bzusicher\w*/gi, ersatz: "Aussicht" },
  { muster: /\bverspreche?n?\s+(wir|ich)\b/gi, ersatz: "planen wir" },
  { muster: /\bberatung\w*/gi, ersatz: "Begleitung" },
  { muster: /\bberater\w*/gi, ersatz: "Ansprechpartner" },
  { muster: /\bberat(en|e|est|et)\b/gi, ersatz: "begleiten" },
  { muster: /\bsichere[sn]? limit\b/gi, ersatz: "mögliches Limit" },
  { muster: /\bauf jeden Fall bewilligt\b/gi, ersatz: "wird geprüft" },
  { muster: /\bbewilligung garantiert\b/gi, ersatz: "Prüfung läuft" },
];

export interface Entschaerft { text: string; entfernt: string[] }

/**
 * Die zweite Wand: prüft die ANTWORT des Modells.
 *
 * Ersetzt statt zu verwerfen — ein weggeworfener Entwurf hilft niemandem, und
 * der Mensch sieht am Hinweis, was geändert wurde, und kann selbst nachbessern.
 */
export function entschaerfen(text: string): Entschaerft {
  let aus = text;
  const entfernt: string[] = [];
  for (const v of VERBOTEN) {
    const treffer = aus.match(v.muster);
    if (treffer) {
      entfernt.push(...Array.from(new Set(treffer.map((t) => t.toLowerCase()))));
      aus = aus.replace(v.muster, v.ersatz);
    }
  }
  return { text: aus, entfernt: Array.from(new Set(entfernt)) };
}

export interface KiErgebnis { ok: boolean; text: string; grund?: string; entfernt?: string[] }

export function kiKonfiguriert(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

/**
 * Entwurf, Ton oder Kürzung. Nutzt denselben Schlüssel wie die übrige
 * KI im Haus (`OPENAI_API_KEY`, siehe server/lib/roadmap-ai.ts) — kein
 * zweiter Anbieter, keine zweite Rechnung.
 */
export async function kiEntwurf(art: string, eingabe: string): Promise<KiErgebnis> {
  const text = String(eingabe || "").trim();
  if (text.length < 3) return { ok: false, text: "", grund: "Bitte ein paar Stichpunkte eingeben." };
  if (!kiKonfiguriert()) {
    return { ok: false, text: "", grund: "Für den KI-Assistenten fehlt der Schlüssel OPENAI_API_KEY." };
  }
  const aufgabe = AUFGABEN[art] ?? AUFGABEN.entwurf;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0.5,
        max_tokens: 400,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: `${aufgabe}\n\n${text.slice(0, 2000)}` },
        ],
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) {
      return { ok: false, text: "", grund: `Die KI antwortete mit HTTP ${res.status}.` };
    }
    const json = (await res.json()) as any;
    const roh = String(json?.choices?.[0]?.message?.content ?? "").trim();
    if (!roh) return { ok: false, text: "", grund: "Die KI hat nichts geliefert." };

    const sauber = entschaerfen(roh);
    return { ok: true, text: sauber.text, entfernt: sauber.entfernt };
  } catch (err) {
    return { ok: false, text: "", grund: `KI nicht erreichbar: ${err instanceof Error ? err.message : String(err)}` };
  }
}
