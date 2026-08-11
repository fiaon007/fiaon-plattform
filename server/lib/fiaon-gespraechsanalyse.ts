// ═══════════════════════════════════════════════════════════════════════════
// GESPRÄCHSAUSWERTUNG — was ein Mensch am Telefon wirklich tut
//
// ── DER AUFTRAG ────────────────────────────────────────────────────────────
// Der Vorgesetzte: „Ich muss die Gespräche, die durch das Plattform-Telefon
// geführt wurden, beim Agenten zugewiesen haben, der sie geführt hat. Ich muss
// KI-Auswertungen machen können."
//
// ── WARUM NICHT „NOTE FÜR DEN AGENTEN" ─────────────────────────────────────
// Eine Zahl von eins bis zehn über einen Menschen ist verlockend und falsch.
// Sie lädt dazu ein, Leistung zu vergleichen, ohne zu wissen, welche Kunden
// jemand hatte — wer zwanzig Leads ohne Zahlungswillen bearbeitet, „schließt"
// weniger ab als jemand mit zwanzig Rückläufern.
//
// Diese Auswertung nennt deshalb BEOBACHTUNGEN, nicht Urteile: Was wurde
// gesagt, was fehlte, welcher Satz kam wie an. Das ist es, was ein
// Vorgesetzter im Gespräch mit seinem Mitarbeiter brauchen kann — eine Note
// beendet das Gespräch, eine Beobachtung eröffnet es.
//
// ── WAS DIE KI NICHT SIEHT ─────────────────────────────────────────────────
// Sie liest Transkripte. Ein Transkript hat keinen Tonfall, keine Pause, kein
// Zögern. Deshalb steht in jeder Auswertung, auf wie vielen Gesprächen sie
// beruht — und dass sie das Anhören nicht ersetzt.
// ═══════════════════════════════════════════════════════════════════════════

import { sqlPool } from "./db-pool";

type Lauf = typeof sqlPool;

const SYSTEM_AUSWERTUNG = `Du bist ein erfahrener Vertriebstrainer und liest Transkripte
echter Telefongespräche eines Vertriebsmitarbeiters mit Kunden einer
Finanzbildungs-Plattform.

Deine Aufgabe: BEOBACHTUNGEN, keine Bewertung. Keine Note, keine Punktzahl,
kein "gut" oder "schlecht" über den Menschen.

Antworte in genau diesen fünf Abschnitten, jeder mit der Überschrift in
Großbuchstaben und darunter 2 bis 4 kurze Sätze in normalem Deutsch:

WAS GUT LÄUFT
Konkrete Stellen, die funktionieren. Zitiere kurz, wenn ein Satz besonders
gelungen ist.

WO GESPRÄCHE ABBRECHEN
An welcher Stelle verlieren die Gespräche ihre Richtung? Nenne das Muster,
nicht den Einzelfall.

WAS UNGESAGT BLEIBT
Welche Information hätte der Kunde gebraucht und nicht bekommen?

RISIKO
Wurde etwas zugesagt, was nicht zugesagt werden darf? Erlass, Stundung,
Ratenänderung, Garantien, Renditeversprechen, Rechts- oder Steuerberatung.
Wenn nichts: schreibe "Keine unzulässigen Zusagen in diesen Gesprächen."

EIN SATZ FÜR DAS NÄCHSTE GESPRÄCH
Ein einziger, konkreter Satz, den dieser Mensch morgen anders sagen kann.

Schreibe sachlich und respektvoll. Der Mensch, über den du schreibst, wird das
lesen.`;

export interface Auswertung {
  ok: boolean;
  grund?: string;
  text?: string;
  /** Auf wie vielen Gesprächen beruht sie? */
  gespraeche?: number;
  /** Wieviele Minuten Gesprächszeit? */
  minuten?: number;
  /** Der Zeitraum, den sie abdeckt. */
  von?: string;
  bis?: string;
}

/**
 * Die Gespräche eines Menschen auswerten.
 *
 * ── OHNE TRANSKRIPTE GIBT ES NICHTS ZU LESEN ───────────────────────────────
 * Gemessen am 11.08.2026: Von drei Anrufen einer Vertriebsleiterin hatte
 * KEINER ein Transkript — es gab auch keine Aufnahmen. Die Auswertung sagt
 * das dann, statt eine Antwort zu erfinden: „Es liegen keine Transkripte vor."
 *
 * Eine KI, die aus nichts eine Beurteilung baut, ist schlimmer als keine.
 */
export async function gespraecheAuswerten(
  agentId: number,
  opts: { tage?: number; max?: number } = {},
  lauf: Lauf = sqlPool,
): Promise<Auswertung> {
  if (!process.env.OPENAI_API_KEY) {
    return {
      ok: false,
      grund: "Für die Auswertung fehlt der Schlüssel OPENAI_API_KEY. "
        + "Ohne ihn kann kein Text gelesen werden.",
    };
  }

  const tage = Math.min(180, Math.max(1, opts.tage ?? 30));
  const zeilen = (await lauf`
    SELECT k.id, k.beginn, k.dauer_sek, k.ergebnis, k.transkript,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                    p.company_name, 'Kunde') AS kunde
    FROM fiaon_calls k
    LEFT JOIN fiaon_persons p ON p.id = k.person_id
    WHERE k.agent_id = ${agentId}
      AND k.transkript IS NOT NULL
      AND LENGTH(k.transkript) > 120
      AND k.beginn >= NOW() - (${tage} || ' days')::interval
    ORDER BY k.beginn DESC
    LIMIT ${Math.min(30, Math.max(1, opts.max ?? 12))}
  `) as any[];

  if (zeilen.length === 0) {
    // ── DIE EHRLICHE LEERMELDUNG ──────────────────────────────────────────
    // Sie nennt den Grund und den Weg. „Keine Daten" wäre eine Sackgasse.
    const [warum] = (await lauf`
      SELECT COUNT(*)::int AS anrufe,
             COUNT(*) FILTER (WHERE recording_url IS NOT NULL)::int AS aufnahmen,
             COUNT(*) FILTER (WHERE ohne_aufzeichnung_am IS NOT NULL)::int AS widersprochen,
             COUNT(*) FILTER (WHERE transkript_status = 'fehlgeschlagen')::int AS gescheitert
      FROM fiaon_calls
      WHERE agent_id = ${agentId} AND beginn >= NOW() - (${tage} || ' days')::interval
    `) as any[];
    return {
      ok: false,
      gespraeche: 0,
      grund: Number(warum.anrufe) === 0
        ? `In den letzten ${tage} Tagen wurde über die Plattform kein Gespräch geführt.`
        : Number(warum.aufnahmen) === 0
          ? `${warum.anrufe} Gespräche, aber keine Aufnahmen. Ohne Aufnahme gibt es kein `
            + "Transkript und damit nichts zu lesen. Prüfe unter Einstellungen → Telefon, "
            + "ob die Aufzeichnung eingerichtet ist."
          : Number(warum.gescheitert) > 0
            ? `${warum.anrufe} Gespräche, ${warum.aufnahmen} Aufnahmen — aber `
              + `${warum.gescheitert} Transkripte sind gescheitert. In der Kundenakte steht `
              + "je Anruf der Grund und ein Knopf zum Nachholen."
            : `${warum.anrufe} Gespräche, ${warum.aufnahmen} Aufnahmen, aber noch kein `
              + `Transkript. ${warum.widersprochen > 0 ? `${warum.widersprochen} Kunden haben der Aufzeichnung widersprochen. ` : ""}`
              + "Die Transkription läuft nach dem Gespräch — bei langen Aufnahmen dauert es.",
    };
  }

  // Die Transkripte mit Rahmen: Datum, Dauer, Ergebnis. Ohne diesen Rahmen
  // liest die KI Wortfolgen ohne zu wissen, wie das Gespräch ausging.
  const stoff = zeilen.map((z, i) => {
    const min = Math.round(Number(z.dauer_sek || 0) / 60);
    const tag = new Date(z.beginn).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" });
    return `--- Gespräch ${i + 1} (${tag}, ${min} Min, Ergebnis: ${z.ergebnis ?? "nicht festgehalten"}) ---\n`
      + String(z.transkript).slice(0, 6000);
  }).join("\n\n");

  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0.3,
        max_tokens: 900,
        messages: [
          { role: "system", content: SYSTEM_AUSWERTUNG },
          { role: "user", content: stoff.slice(0, 60_000) },
        ],
      }),
      signal: AbortSignal.timeout(90_000),
    });

    if (!r.ok) {
      const roh = await r.text().catch(() => "");
      // Der HTTP-Code gehört in die Meldung: „Auswertung fehlgeschlagen" sagt
      // nichts, „HTTP 401" sagt „der Schlüssel ist falsch".
      return {
        ok: false,
        grund: `OpenAI antwortete mit HTTP ${r.status}.`
          + (r.status === 401 ? " Der Schlüssel ist ungültig oder abgelaufen." : "")
          + (r.status === 429 ? " Das Kontingent ist erschöpft." : "")
          + (roh ? ` ${roh.slice(0, 200)}` : ""),
        gespraeche: zeilen.length,
      };
    }

    const j = await r.json() as any;
    const text = String(j?.choices?.[0]?.message?.content ?? "").trim();
    if (!text) {
      return { ok: false, grund: "OpenAI hat eine leere Antwort geschickt.", gespraeche: zeilen.length };
    }

    const sek = zeilen.reduce((s, z) => s + Number(z.dauer_sek || 0), 0);
    const daten = zeilen.map((z) => new Date(z.beginn).getTime());
    return {
      ok: true,
      text,
      gespraeche: zeilen.length,
      minuten: Math.round(sek / 60),
      von: new Date(Math.min(...daten)).toISOString().slice(0, 10),
      bis: new Date(Math.max(...daten)).toISOString().slice(0, 10),
    };
  } catch (e) {
    return {
      ok: false,
      grund: `Die Auswertung ist gescheitert: ${e instanceof Error ? e.message : String(e)}`,
      gespraeche: zeilen.length,
    };
  }
}
