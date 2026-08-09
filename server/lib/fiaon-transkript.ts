// ═══════════════════════════════════════════════════════════════════════════
// TRANSKRIPT UND ANRUF-ZUSAMMENFASSUNG
//
// Diese Datei ist die EINZIGE Stelle, die weiß, wer Audio in Text verwandelt.
// Ein Anbieterwechsel — von OpenAI zu Deepgram, Whisper lokal, was auch immer
// — betrifft `transkribiere()` und sonst nichts. Der Rest des Hauses kennt nur
// „gib mir Text zu dieser Aufnahme".
//
// ── ASYNCHRON UND FEHLERTOLERANT ───────────────────────────────────────────
// Eine Transkription dauert Minuten und kann scheitern (Aufnahme noch nicht
// fertig, Datei zu groß, Anbieter unerreichbar). Der ANRUF-DATENSATZ bleibt
// davon unberührt: Er trägt dann `transkript_status = 'fehlgeschlagen'` mit
// Grund und lässt sich per Knopf nachholen. Ein verlorenes Transkript ist
// ärgerlich; ein verlorener Anruf wäre ein Dokumentationsloch.
//
// ── DIE ZUSAMMENFASSUNG BESCHREIBT, SIE RÄT NICHT ──────────────────────────
// „Der Kunde wirkte zahlungsunwillig, empfehle härteres Nachfassen" ist keine
// Zusammenfassung, sondern eine Unterstellung mit Handlungsanweisung. Der
// Systemprompt verbietet Bewertungen und Empfehlungen ausdrücklich; der
// Ausgabefilter aus fiaon-mail-ki.ts fängt zusätzlich die Compliance-Begriffe.
// ═══════════════════════════════════════════════════════════════════════════

import { sqlPool } from "./db-pool";
import { entschaerfen } from "./fiaon-mail-ki";

type Lauf = typeof sqlPool;

export function transkriptKonfiguriert(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

/**
 * Audio → Text.
 *
 * @param quelle URL der Aufnahme (Twilio liefert sie als MP3/WAV).
 */
export async function transkribiere(
  quelle: string,
): Promise<{ ok: boolean; text?: string; grund?: string }> {
  if (!transkriptKonfiguriert()) {
    return { ok: false, grund: "Für die Transkription fehlt der Schlüssel OPENAI_API_KEY." };
  }
  try {
    // Twilio-Aufnahmen liegen hinter Basic-Auth des Kontos.
    const kopf: Record<string, string> = {};
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      const b64 = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64");
      kopf.Authorization = `Basic ${b64}`;
    }
    const audio = await fetch(quelle, { headers: kopf, signal: AbortSignal.timeout(60_000) });
    if (!audio.ok) return { ok: false, grund: `Aufnahme nicht abrufbar (HTTP ${audio.status}).` };
    const bytes = Buffer.from(await audio.arrayBuffer());
    // 25 MB ist die Grenze der API. Bei 60 Minuten Höchstdauer und MP3 wird
    // sie nicht erreicht — die Prüfung steht trotzdem hier, weil eine
    // überschrittene Grenze sonst als unverständlicher Fehler ankäme.
    if (bytes.length > 25 * 1024 * 1024) {
      return { ok: false, grund: "Die Aufnahme ist größer als 25 MB und lässt sich nicht am Stück transkribieren." };
    }

    const form = new FormData();
    form.append("file", new Blob([bytes], { type: "audio/mpeg" }), "anruf.mp3");
    form.append("model", "whisper-1");
    form.append("language", "de");
    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: form,
      signal: AbortSignal.timeout(180_000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, grund: `Transkription abgelehnt (HTTP ${res.status})${text ? `: ${text.slice(0, 160)}` : ""}` };
    }
    const json = (await res.json()) as any;
    const text = String(json?.text ?? "").trim();
    if (!text) return { ok: false, grund: "Die Transkription war leer — vermutlich eine stumme Aufnahme." };
    return { ok: true, text };
  } catch (err) {
    return { ok: false, grund: `Transkription fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}` };
  }
}

const SYSTEM_ZUSAMMENFASSUNG = `Du fasst ein Telefongespräch zwischen einem FIAON-Mitarbeiter und einem Kunden zusammen.

DU BESCHREIBST NUR, WAS GESAGT WURDE. Keine Bewertung, keine Empfehlung, keine Vermutung über Absichten oder Zahlungsfähigkeit.

Struktur, 3 bis 5 Sätze in dieser Reihenfolge:
1. Worum ging es?
2. Welche Einwände oder Fragen kamen vom Kunden? (nur wenn welche kamen)
3. Welche Zusagen wurden gemacht — von wem, bis wann?
4. Was ist der ausdrücklich vereinbarte nächste Schritt?

VERBOTEN:
- Bewertungen ("wirkte unsicher", "scheint zahlungsunwillig")
- Empfehlungen ("sollte härter nachgefasst werden")
- Erfundene Details, die nicht im Transkript stehen
- Die Wörter Beratung, Berater, beraten
- Aussagen über Limits, Bewilligungen oder Kreditzusagen

Wenn das Transkript unverständlich oder zu kurz ist, schreibe genau: "Das Gespräch war zu kurz oder zu undeutlich für eine Zusammenfassung."

Antworte NUR mit der Zusammenfassung, ohne Vorrede.`;

export async function zusammenfassen(
  transkript: string,
): Promise<{ ok: boolean; text?: string; grund?: string }> {
  if (!transkriptKonfiguriert()) return { ok: false, grund: "OPENAI_API_KEY fehlt." };
  if (transkript.trim().length < 40) {
    return { ok: true, text: "Das Gespräch war zu kurz oder zu undeutlich für eine Zusammenfassung." };
  }
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0.2,
        max_tokens: 320,
        messages: [
          { role: "system", content: SYSTEM_ZUSAMMENFASSUNG },
          { role: "user", content: transkript.slice(0, 12_000) },
        ],
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) return { ok: false, grund: `Zusammenfassung abgelehnt (HTTP ${res.status}).` };
    const json = (await res.json()) as any;
    const roh = String(json?.choices?.[0]?.message?.content ?? "").trim();
    if (!roh) return { ok: false, grund: "Die Zusammenfassung war leer." };
    // Dieselbe Wand wie in der Mail-Zentrale — ein Prompt ist eine Bitte.
    return { ok: true, text: entschaerfen(roh).text };
  } catch (err) {
    return { ok: false, grund: `Zusammenfassung fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}` };
  }
}

/**
 * Der ganze Weg für einen Anruf: Aufnahme holen, transkribieren,
 * zusammenfassen, in die Akte schreiben.
 *
 * Wirft nie. Jeder Fehlerpfad hinterlässt einen nachvollziehbaren Zustand am
 * Anruf-Datensatz, aus dem sich der Vorgang wiederholen lässt.
 */
export async function anrufNachbereiten(callId: number, lauf: Lauf = sqlPool): Promise<{ ok: boolean; grund?: string }> {
  const [c] = (await lauf`
    SELECT id, person_id, ref, recording_url, transkript, agent_id FROM fiaon_calls WHERE id = ${callId}
  `) as any[];
  if (!c) return { ok: false, grund: "Anruf nicht gefunden." };
  if (!c.recording_url && !c.transkript) {
    await lauf`
      UPDATE fiaon_calls SET transkript_status = 'fehlgeschlagen',
        transkript_grund = 'Zu diesem Anruf liegt keine Aufnahme vor.', updated_at = NOW()
      WHERE id = ${callId}
    `;
    return { ok: false, grund: "Keine Aufnahme vorhanden." };
  }

  await lauf`UPDATE fiaon_calls SET transkript_status = 'laeuft', updated_at = NOW() WHERE id = ${callId}`;

  let text = c.transkript as string | null;
  if (!text) {
    const t = await transkribiere(String(c.recording_url));
    if (!t.ok) {
      await lauf`
        UPDATE fiaon_calls SET transkript_status = 'fehlgeschlagen', transkript_grund = ${t.grund ?? null},
          updated_at = NOW() WHERE id = ${callId}
      `;
      return { ok: false, grund: t.grund };
    }
    text = t.text!;
    await lauf`UPDATE fiaon_calls SET transkript = ${text}, updated_at = NOW() WHERE id = ${callId}`;
  }

  const z = await zusammenfassen(text);
  if (!z.ok) {
    // Das Transkript ist da — nur die Zusammenfassung fehlt. Der Zustand sagt
    // das genau, statt beides als gescheitert zu markieren.
    await lauf`
      UPDATE fiaon_calls SET transkript_status = 'fehlgeschlagen',
        transkript_grund = ${`Transkript liegt vor, Zusammenfassung fehlgeschlagen: ${z.grund}`},
        updated_at = NOW() WHERE id = ${callId}
    `;
    return { ok: false, grund: z.grund };
  }

  const fassung = z.text ?? "";
  await lauf`
    UPDATE fiaon_calls SET zusammenfassung = ${fassung}, transkript_status = 'fertig',
      transkript_grund = NULL, updated_at = NOW() WHERE id = ${callId}
  `;

  // In die Akte — dort, wo der nächste Kollege ohnehin nachliest.
  if (c.ref) {
    await lauf`
      INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note, created_at)
      VALUES (${c.ref}, ${c.agent_id}, 'System', 'system',
              ${`Anruf-Zusammenfassung, automatisch erstellt:\n${fassung}`}, NOW())
    `.catch(() => {});
  }
  return { ok: true };
}

/** Der Nachlauf: Anrufe, deren Transkript offen oder gescheitert ist. */
export async function transkriptLauf(grenze = 5, lauf: Lauf = sqlPool): Promise<number> {
  if (!transkriptKonfiguriert()) return 0;
  const offen = (await lauf`
    SELECT id FROM fiaon_calls
    WHERE transkript_status = 'offen' AND recording_url IS NOT NULL
      AND beginn > NOW() - INTERVAL '7 days'
    ORDER BY beginn ASC LIMIT ${grenze}
  `) as any[];
  let fertig = 0;
  for (const c of offen) {
    const r = await anrufNachbereiten(Number(c.id), lauf);
    if (r.ok) fertig++;
  }
  if (fertig) console.log(`[TRANSKRIPT] ${fertig} von ${offen.length} nachbereitet`);
  return fertig;
}
