// ═══════════════════════════════════════════════════════════════════════════
// ARAS — Aufnahmen und Abschriften nach 90 Tagen löschen (E-408 Scheibe 3, Koordination 22.10.2026)
//
// Täglich (Takt aras_aufbewahrung). Für ARAS-Gespräche (fiaon_calls.gefuehrt_von = 'aras' — NIE ein Team-Gespräch), die älter
// sind als TRANSKRIPT_FRIST_TAGE (90):
//   1. die Aufnahme bei TWILIO löschen (recordings(sid).remove()) — eine vergessene URL ist keine Löschung;
//   2. erst DANACH recording_url und die Abschrift leeren (fiaon_calls.transkript, fiaon_aras_anruf.transkript) und
//      aufnahme_geloescht_am setzen. Die Zusammenfassung bleibt (das Arbeitsergebnis in der Akte), ebenso der Ja-Satz zur
//      Aufnahme (der Nachweis, dass sie erlaubt war).
// Ausnahme: Ist zur Person ein Streitfall oder eine Beschwerde OFFEN (streitOffenSql — dieselbe Definition wie bei den
// Erinnerungen), bleibt alles liegen — vermerkt im Protokoll (Kanal telefon), jeden Tag neu geprüft.
// Twilio-Fehler → die Zeile bleibt unverändert, der nächste Lauf versucht es erneut (nie die DB leeren, solange Twilio die
// Aufnahme noch hat). 404 bei Twilio zählt als gelöscht — die Aufnahme ist weg, egal wer sie entfernt hat.
// Die Team-Gespräche löscht weiter aufnahmenAufraeumen (fiaon-softphone.ts) — ARAS-Gespräche lässt sie seither aus, damit die
// Streitfall-Ausnahme hier gilt.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { arasSchema } from "./fiaon-aras-schema";
import { twilioClient } from "./fiaon-aras-twilio-client";
import { streitOffenSql } from "./fiaon-aras-erinnerung";
import { TRANSKRIPT_FRIST_TAGE } from "../../shared/fiaon-aras";

type Lauf = typeof sqlPool;

/** Die Frist in Tagen (Vertrag § 1: TRANSKRIPT_FRIST_TAGE). */
export const ARAS_AUFBEWAHRUNG_TAGE = TRANSKRIPT_FRIST_TAGE;
/** Höchstens so viele Gespräche je Lauf (der Rest kommt am nächsten Tag). */
export const ARAS_AUFBEWAHRUNG_JE_LAUF = 500;
export const GELOESCHT_GRUND = "Aufnahme und Abschrift nach 90 Tagen gelöscht (ARAS-Aufbewahrung).";

/** Die Twilio-Kennung der Aufnahme: recording_sid, sonst aus der URL (…/Recordings/RE…). Rein. */
export function aufnahmeKennung(sid: string | null | undefined, url: string | null | undefined): string | null {
  if (sid && /^RE[0-9a-f]{32}$/i.test(String(sid).trim())) return String(sid).trim();
  const m = /\/Recordings\/(RE[0-9a-f]{32})/i.exec(String(url ?? ""));
  return m ? m[1] : (sid ? String(sid).trim() || null : null);
}

/** Hat Twilio „gibt es nicht (mehr)“ geantwortet? Dann ist die Aufnahme weg. Rein. */
export function twilioNichtDa(e: unknown): boolean {
  const x = e as { status?: unknown; code?: unknown } | null;
  return Number(x?.status) === 404 || Number(x?.code) === 20404;
}

export interface AufbewahrungErgebnis { frist: number; faellig: number; geloescht: number; behalten: number; twilioFehler: number; behaltenAnrufe: number[]; hinweise: string[] }

/**
 * Der Lauf. `jetzt` und `grenze` nur für den Prüfstand. Wirft nur, wenn die Auswahl selbst scheitert (dann schreibt die
 * Lauf-Historie den Fehler); ein Fehler bei EINEM Gespräch hält die anderen nicht auf.
 */
export async function arasAufbewahrung(lauf: Lauf = sqlPool, jetzt: Date = new Date(), opt: { grenze?: number } = {}): Promise<AufbewahrungErgebnis> {
  await arasSchema(lauf);
  const frist = ARAS_AUFBEWAHRUNG_TAGE;
  const stichtag = new Date(jetzt.getTime() - frist * 86_400_000);
  const zeilen = (await lauf.unsafe(`
    SELECT c.id AS call_id, c.person_id, c.recording_sid, c.recording_url, c.aufnahme_geloescht_am,
           ${streitOffenSql("c.person_id")} AS streit_offen
      FROM fiaon_calls c
     WHERE c.gefuehrt_von = 'aras' AND c.beginn < $1
       AND (c.recording_url IS NOT NULL
            OR (c.recording_sid IS NOT NULL AND c.aufnahme_geloescht_am IS NULL)
            OR c.transkript IS NOT NULL
            OR EXISTS (SELECT 1 FROM fiaon_aras_anruf aa WHERE aa.call_id = c.id AND aa.transkript IS NOT NULL))
     ORDER BY c.beginn LIMIT $2`, [stichtag, Math.max(1, Math.min(5000, opt.grenze ?? ARAS_AUFBEWAHRUNG_JE_LAUF))])) as any[];

  const erg: AufbewahrungErgebnis = { frist, faellig: zeilen.length, geloescht: 0, behalten: 0, twilioFehler: 0, behaltenAnrufe: [], hinweise: [] };
  for (const z of zeilen) {
    const callId = Number(z.call_id);
    if (z.streit_offen === true) { erg.behalten++; erg.behaltenAnrufe.push(callId); continue; }
    // 1. Erst bei Twilio löschen — solange die Aufnahme dort liegt, bleibt die Zeile, wie sie ist.
    if (!z.aufnahme_geloescht_am && (z.recording_sid || z.recording_url)) {
      const sid = aufnahmeKennung(z.recording_sid, z.recording_url);
      if (!sid) { erg.twilioFehler++; erg.hinweise.push(`Anruf ${callId}: Aufnahme ohne Twilio-Kennung — nicht gelöscht.`); continue; }
      try {
        await (await twilioClient()).recordings(sid).remove();
      } catch (e) {
        if (!twilioNichtDa(e)) {
          erg.twilioFehler++;
          erg.hinweise.push(`Anruf ${callId}: Twilio — ${String((e as Error)?.message ?? e).slice(0, 120)}`);
          continue;
        }
      }
    }
    // 2. Dann die Zeilen leeren — Aufnahme-Adresse und Abschrift; der Vermerk schließt das Gespräch für die nächsten Läufe aus.
    try {
      await lauf`UPDATE fiaon_calls SET recording_url = NULL, transkript = NULL,
                   transkript_grund = CASE WHEN transkript IS NOT NULL THEN ${GELOESCHT_GRUND} ELSE transkript_grund END,
                   aufnahme_geloescht_am = COALESCE(aufnahme_geloescht_am, NOW()), updated_at = NOW()
                  WHERE id = ${callId}`;
      await lauf`UPDATE fiaon_aras_anruf SET transkript = NULL,
                   transkript_grund = CASE WHEN transkript IS NOT NULL THEN 'geloescht_90_tage' ELSE transkript_grund END, updated_at = NOW()
                  WHERE call_id = ${callId} AND transkript IS NOT NULL`;
      erg.geloescht++;
    } catch (e) {
      erg.hinweise.push(`Anruf ${callId}: Datenbank — ${String((e as Error)?.message ?? e).slice(0, 120)}`);
    }
  }

  if (erg.geloescht || erg.behalten || erg.twilioFehler) {
    const satz = `ARAS-Aufbewahrung (${frist} Tage): ${erg.geloescht} Gespräch(e) gelöscht (Aufnahme + Abschrift)`
      + (erg.behalten ? `, ${erg.behalten} behalten — Streitfall oder Beschwerde offen (Anruf ${erg.behaltenAnrufe.slice(0, 20).join(", ")})` : "")
      + (erg.twilioFehler ? `, ${erg.twilioFehler} bei Twilio nicht gelöscht — morgen erneut` : "") + ".";
    try {
      const { protokollieren } = await import("./fiaon-mara-termin");
      await protokollieren({ kanal: "telefon", art: "aras_werkzeug" as any, ok: erg.twilioFehler === 0, text: satz,
        daten: { aufbewahrung: true, frist, geloescht: erg.geloescht, behalten: erg.behalten, behaltenAnrufe: erg.behaltenAnrufe.slice(0, 50), twilioFehler: erg.twilioFehler } }, lauf);
    } catch { /* das Protokoll ist Komfort — der Lauf zählt */ }
    console.log(`[ARAS] ${satz}`);
  }
  return erg;
}
