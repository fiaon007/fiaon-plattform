// ═══════════════════════════════════════════════════════════════════════════
// „NEU FÜR SIE" AUCH PER MAIL — DER LAUF (E-467, 30.10.2026)
//
// Justin: „Immer wenn wir was Neues für den Kunden haben, muss er eine E-Mail bekommen und das Popup in der App."
//
// Das Fenster „Neu für Sie" im Portal (E-456) bleibt, wie es ist. Dieser Lauf schickt dieselben Punkte zusätzlich per
// Mail — gebündelt, damit fünf Einträge in einer Minute EINE Mail ergeben. Die Regeln (rein, mit Prüfstand) stehen in
// shared/fiaon-global-neuigkeiten-mail.ts, die Punkte baut die eine Quelle des Fensters (globalNeuigkeitenBauen, gelesen
// über globalNeuigkeitenQuelleLesen).
//
// ── WARUM EIN TAKT UND KEIN NACHLAUF BEIM SCHREIBEN ────────────────────────
// Neuigkeiten entstehen an vielen Stellen (Station, Dokument, Post, Unterschrift, Antwort, „bitte neu", Kapital, Notiz).
// Ein Haken an jeder Stelle würde eine vergessen — der Takt liest dieselbe Quelle wie das Fenster und sieht deshalb
// jede. Und die Bündelung („10 Minuten Ruhe") braucht ohnehin einen späteren Blick: Ein Nachlauf mit setTimeout ginge
// bei jedem Deploy verloren, der Takt dagegen hält seinen Stand in der Akte (neuigkeiten_mail_am) und verliert bei einem
// Neustart nichts. Registriert in routes.ts über tageslauf() — CRONS=aus schaltet ihn ab wie jeden Lauf.
//
// ── NIE DOPPELT, NIE ALTES ────────────────────────────────────────────────
//   · neuigkeiten_mail_am = der Stand, bis zu dem gemailt ist. Gesetzt VOR dem Versand, atomar (nur wenn sich weder
//     dieser Stand noch neuigkeiten_gesehen_am seit dem Lesen geändert hat) — zwei Instanzen schicken nie zweimal.
//     Er wird nie zurückgenommen: Scheitert eine Mail, steht der Grund im Verlauf, das Fenster im Portal bleibt.
//   · global_neuigkeiten_mail_seit (fiaon_settings) = ab wann überhaupt gezählt wird. Beim ersten Lauf nach dem Deploy
//     und bei jedem Wiedereinschalten auf „jetzt" gesetzt — Bestandskunden bekommen nie die Neuigkeiten von gestern.
//
// ── NIE AN ────────────────────────────────────────────────────────────────
//   Test-Aufträge (ist_test_am), stornierte Aufträge, zusammengeführte Bestellungen, Aufträge ohne E-Mail-Adresse,
//   hart unzustellbare Adressen (Frequenzbremse), die Kundin eines Firmenangebots (E-301, Wand in globalMailSenden).
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { ensureGlobalBereich, lageLesen, bereichMail, verlaufSchreiben } from "./fiaon-global-bereich";
import { globalNeuigkeitenQuelleLesen } from "./fiaon-global-neuigkeiten";
import { globalNeuigkeitenBauen } from "@shared/fiaon-global-neuigkeiten";
import {
  GLOBAL_NEUIGKEITEN_EIGENE_MAILS, GLOBAL_NEUIGKEITEN_MAIL_SCHLUESSEL as K,
  globalNeuigkeitenMailEntscheid, globalNeuigkeitenMailGrenze, globalNeuigkeitenMailInhalt, globalNeuigkeitenMailQuelle,
  type GlobalEigeneMail, type GlobalNeuigkeitenMailGrund,
} from "@shared/fiaon-global-neuigkeiten-mail";

const iso = (v: unknown): string | null => (v ? new Date(v as any).toISOString() : null);
const WER = "System (FIAON Global, Neuigkeiten)";

// ── DER SCHALTER ─────────────────────────────────────────────────────────────
export interface NeuigkeitenMailEinstellung { an: boolean; seit: string }

/** Schalter (Vorgabe an) und Zählbeginn. Fehlt der Zählbeginn (erster Lauf nach dem Deploy), ist er ab jetzt gesetzt. */
export async function globalNeuigkeitenMailEinstellung(jetzt: Date = new Date()): Promise<NeuigkeitenMailEinstellung> {
  await sqlPool`INSERT INTO fiaon_settings (key, value, updated_at) VALUES (${K.seit}, ${jetzt.toISOString()}, NOW()) ON CONFLICT (key) DO NOTHING`;
  const zeilen = (await sqlPool`SELECT key, value FROM fiaon_settings WHERE key IN (${K.schalter}, ${K.seit})`) as any[];
  const m = new Map(zeilen.map((z) => [String(z.key), String(z.value ?? "")]));
  const seitMs = Date.parse(m.get(K.seit) ?? "");
  return { an: (m.get(K.schalter) ?? "an").trim().toLowerCase() !== "aus", seit: new Date(Number.isFinite(seitMs) ? seitMs : jetzt.getTime()).toISOString() };
}

/** Chefbüro › Global: an/aus. Einschalten setzt den Zählbeginn auf jetzt — was während „aus" neu wurde, geht nie nach. */
export async function globalNeuigkeitenMailSchalten(an: boolean, wer: string, jetzt: Date = new Date()): Promise<NeuigkeitenMailEinstellung & { meldung: string }> {
  const vorher = await globalNeuigkeitenMailEinstellung(jetzt);
  await sqlPool`
    INSERT INTO fiaon_settings (key, value, updated_at) VALUES (${K.schalter}, ${an ? "an" : "aus"}, NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`;
  if (an && !vorher.an) {
    await sqlPool`
      INSERT INTO fiaon_settings (key, value, updated_at) VALUES (${K.seit}, ${jetzt.toISOString()}, NOW())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`;
  }
  console.log(`[GLOBAL-NEUIGKEITEN-MAIL] Schalter ${an ? "an" : "aus"} (${wer})`);
  const jetztStand = await globalNeuigkeitenMailEinstellung(jetzt);
  return {
    ...jetztStand,
    meldung: an
      ? (vorher.an ? "Die Neuigkeiten-Mail ist an." : "Die Neuigkeiten-Mail ist an — gemailt wird nur, was ab jetzt neu ist.")
      : "Die Neuigkeiten-Mail ist aus. Das Fenster „Neu für Sie“ im Portal bleibt.",
  };
}

// ── WAS SCHON EINE EIGENE MAIL HATTE ─────────────────────────────────────────
/**
 * Je Ereignis (Etappe, Dokument, Antwort) die jüngste erfolgreich versandte Mail dieses Auftrags seit `seit`.
 * Das Mailprotokoll schreibt die Nutzlast als JSON-Text in jsonb (E-238/E-460) — deshalb beide Lesarten.
 */
async function eigeneMailsSeit(ref: string, seit: string): Promise<Partial<Record<GlobalEigeneMail, string>>> {
  const zeilen = (await sqlPool`
    SELECT event, MAX(created_at) AS am FROM fiaon_mail_log
     WHERE event = ANY(${[...GLOBAL_NEUIGKEITEN_EIGENE_MAILS] as string[]}) AND status = 'versandt' AND created_at > ${seit}::timestamptz - INTERVAL '1 minute'
       AND COALESCE(payload->>'antrag_id', CASE WHEN jsonb_typeof(payload) = 'string' THEN (payload #>> '{}')::jsonb ->> 'antrag_id' END) = ${ref}
     GROUP BY event`) as any[];
  return Object.fromEntries(zeilen.map((z) => [String(z.event), iso(z.am)!]));
}

// ── EIN AUFTRAG ──────────────────────────────────────────────────────────────
export type NeuigkeitenMailErgebnis =
  | { ref: string; was: "uebersprungen"; grund: "unbekannt" | "test" | "storniert" | "zusammengefuehrt" | GlobalNeuigkeitenMailGrund | "gleichzeitig" }
  | { ref: string; was: "gesendet"; punkte: string[] }
  | { ref: string; was: "nicht_gesendet"; grund: string; punkte: string[] };

/**
 * Prüft EINEN Auftrag und verschickt, wenn es soweit ist, die eine gebündelte Mail. `imFenster` = Sendefenster der
 * Kundenmails (der Lauf rechnet es aus; der Prüfstand setzt es).
 */
export async function globalNeuigkeitenMailPruefen(ref: string, o: { seit: string; imFenster: boolean; jetzt?: Date }): Promise<NeuigkeitenMailErgebnis> {
  const jetzt = o.jetzt ?? new Date();
  const stand = jetzt.toISOString();
  const [a] = (await sqlPool`
    SELECT g.created_at, g.ist_test_am, g.gesellschaft_plus, g.neuigkeiten_gesehen_am, g.neuigkeiten_mail_am, b.merged_into
      FROM fiaon_global_auftraege g LEFT JOIN fiaon_applications b ON b.ref = g.ref
     WHERE g.ref = ${ref} LIMIT 1`) as any[];
  if (!a) return { ref, was: "uebersprungen", grund: "unbekannt" };
  if (a.ist_test_am) return { ref, was: "uebersprungen", grund: "test" };
  if (a.merged_into) return { ref, was: "uebersprungen", grund: "zusammengefuehrt" };
  const l = await lageLesen(ref);
  if (!l) return { ref, was: "uebersprungen", grund: "unbekannt" };
  if (l.status === "storniert") return { ref, was: "uebersprungen", grund: "storniert" };

  const gesehenAm = iso(a.neuigkeiten_gesehen_am); const mailAm = iso(a.neuigkeiten_mail_am);
  const grenze = globalNeuigkeitenMailGrenze({ gesehenAm, mailAm, seit: o.seit, akteSeit: iso(a.created_at) });
  const [quelle, gedeckt] = await Promise.all([globalNeuigkeitenQuelleLesen(ref, grenze, a.gesellschaft_plus), eigeneMailsSeit(ref, grenze)]);
  const erg = globalNeuigkeitenBauen(globalNeuigkeitenMailQuelle(quelle, gedeckt), l.sprache);
  const entscheid = globalNeuigkeitenMailEntscheid({ liste: erg.liste, letzteMailAm: mailAm, jetzt: stand, imFenster: o.imFenster });
  if (!entscheid.senden) return { ref, was: "uebersprungen", grund: entscheid.grund };

  // Der Stand wird VOR dem Versand genommen — nur, wenn seit dem Lesen weder eine andere Instanz gemailt noch der Kunde
  // das Fenster geschlossen hat. Millisekunden reichen: beide Spalten schreibt das Haus mit ISO-Zeitpunkten.
  const [frei] = (await sqlPool`
    UPDATE fiaon_global_auftraege SET neuigkeiten_mail_am = ${stand}::timestamptz
     WHERE ref = ${ref}
       AND COALESCE(date_trunc('milliseconds', neuigkeiten_mail_am), '-infinity'::timestamptz) = COALESCE(${mailAm}::timestamptz, '-infinity'::timestamptz)
       AND COALESCE(date_trunc('milliseconds', neuigkeiten_gesehen_am), '-infinity'::timestamptz) = COALESCE(${gesehenAm}::timestamptz, '-infinity'::timestamptz)
     RETURNING ref`) as any[];
  if (!frei) return { ref, was: "uebersprungen", grund: "gleichzeitig" };

  const inhalt = globalNeuigkeitenMailInhalt(erg.liste, erg.weitere, l.sprache);
  const punkte = erg.liste.map((n) => n.titel);
  const nicht = async (grund: string): Promise<NeuigkeitenMailErgebnis> => {
    await verlaufSchreiben(ref, { art: "mail_neuigkeiten", sichtbar: false, text: `Neuigkeiten-Mail NICHT gesendet (${grund}). Der Kunde sieht die Neuigkeiten weiter im Portal unter „Neu für Sie“: ${punkte.join(" · ")}.` });
    return { ref, was: "nicht_gesendet", grund, punkte };
  };
  // Die Frequenzbremse wie beim Zahlungstakt: Global-Mails gehen am Make-Tor vorbei, die Frage steht deshalb hier.
  const { globalMailNutzlast } = await import("./fiaon-global-auftrag");
  const an = globalMailNutzlast(l.akte, l.b, { ansprechpartner: "" }).email;
  if (!an) return nicht("keine E-Mail-Adresse am Auftrag");
  const { darfAnEmpfaenger } = await import("./fiaon-mail-frequenz");
  const urteil = await darfAnEmpfaenger(an, "global_neuigkeiten").catch(() => ({ ok: true, grund: null as string | null }));
  if (!urteil.ok) return nicht(String(urteil.grund ?? "Frequenzbremse"));

  const mail = await bereichMail("global_neuigkeiten", l, {
    neuigkeit_titel: inhalt.titel, neuigkeiten_html: inhalt.html, weitere_satz: inhalt.weitereSatz,
  }, WER);
  if (!mail.ok) return nicht(mail.grund ?? "unbekannt");
  await verlaufSchreiben(ref, { art: "mail_neuigkeiten", sichtbar: false, text: `Neuigkeiten-Mail an den Kunden gesendet (${inhalt.anzahl} ${inhalt.anzahl === 1 ? "Punkt" : "Punkte"}): ${punkte.join(" · ")}.` });
  return { ref, was: "gesendet", punkte };
}

// ── DER LAUF ─────────────────────────────────────────────────────────────────
export interface NeuigkeitenMailLaufErgebnis { aus: boolean; kandidaten: number; gesendet: number; nichtGesendet: number; fehler: number }

/**
 * Alle Aufträge mit einer neuen sichtbaren Sache seit ihrem Stand — die Vorauswahl ist grob (die feine Entscheidung
 * trifft globalNeuigkeitenMailPruefen mit der Quelle des Fensters), damit nicht jeder Takt jede Akte liest.
 */
export async function globalNeuigkeitenMailLauf(o: { jetzt?: Date; imFenster?: boolean } = {}): Promise<NeuigkeitenMailLaufErgebnis> {
  const jetzt = o.jetzt ?? new Date();
  const erg: NeuigkeitenMailLaufErgebnis = { aus: false, kandidaten: 0, gesendet: 0, nichtGesendet: 0, fehler: 0 };
  const [tabelle] = (await sqlPool`SELECT to_regclass('public.fiaon_global_auftraege') AS da`) as any[];
  if (!tabelle?.da) return erg;
  await ensureGlobalBereich();
  const { ensureGlobalMandat } = await import("./fiaon-global-mandat");
  await ensureGlobalMandat();
  const einst = await globalNeuigkeitenMailEinstellung(jetzt);
  if (!einst.an) { erg.aus = true; return erg; }
  const { imSendefenster } = await import("./fiaon-global-zahlungstakt");
  const imFenster = o.imFenster ?? imSendefenster(jetzt);
  if (!imFenster) return erg; // außerhalb des Fensters wird nichts entschieden — der nächste Takt im Fenster holt es nach
  const refs = (await sqlPool`
    SELECT g.ref FROM fiaon_global_auftraege g JOIN fiaon_applications a ON a.ref = g.ref
     WHERE g.ist_test_am IS NULL AND a.merged_into IS NULL AND a.archived_at IS NULL AND a.cancelled_at IS NULL
       AND COALESCE(a.payment_status, '') NOT IN ('cancelled', 'superseded') AND COALESCE(g.status, '') <> 'storniert'
       AND (
         EXISTS (SELECT 1 FROM fiaon_global_verlauf v WHERE v.ref = g.ref AND v.sichtbar = TRUE AND v.von <> 'kunde'
                    AND v.created_at > GREATEST(g.neuigkeiten_gesehen_am, g.neuigkeiten_mail_am, g.created_at, ${einst.seit}::timestamptz))
         OR EXISTS (SELECT 1 FROM fiaon_global_dokumente d WHERE d.ref = g.ref AND d.geloescht_am IS NULL
                    AND ((d.von = 'fiaon' AND d.sichtbar_fuer_kunde AND d.created_at > GREATEST(g.neuigkeiten_gesehen_am, g.neuigkeiten_mail_am, g.created_at, ${einst.seit}::timestamptz))
                      OR d.abgelehnt_am > GREATEST(g.neuigkeiten_gesehen_am, g.neuigkeiten_mail_am, g.created_at, ${einst.seit}::timestamptz)))
         OR EXISTS (SELECT 1 FROM fiaon_global_nachrichten n WHERE n.ref = g.ref AND n.von = 'fiaon'
                    AND n.created_at > GREATEST(g.neuigkeiten_gesehen_am, g.neuigkeiten_mail_am, g.created_at, ${einst.seit}::timestamptz))
       )
     ORDER BY g.ref
     LIMIT 200`) as any[];
  erg.kandidaten = refs.length;
  for (const r of refs) {
    try {
      const e = await globalNeuigkeitenMailPruefen(String(r.ref), { seit: einst.seit, imFenster, jetzt });
      if (e.was === "gesendet") erg.gesendet++;
      else if (e.was === "nicht_gesendet") erg.nichtGesendet++;
    } catch (e) {
      erg.fehler++;
      console.error(`[GLOBAL-NEUIGKEITEN-MAIL] ${r.ref}:`, e instanceof Error ? e.message : e);
    }
  }
  if (erg.fehler && !erg.gesendet && erg.fehler === erg.kandidaten) throw new Error(`Neuigkeiten-Mail: alle ${erg.fehler} Aufträge scheiterten (siehe Log).`);
  return erg;
}

/** Für den 5-Minuten-Takt (nurMitErgebnis): eine Historienzeile bei Versand oder Fehler — und einmal je Stunde als Lebenszeichen. */
let letzterPuls = 0;
export async function globalNeuigkeitenMailTakt(): Promise<boolean> {
  const r = await globalNeuigkeitenMailLauf();
  if (r.gesendet > 0 || r.nichtGesendet > 0 || r.fehler > 0) { letzterPuls = Date.now(); return true; }
  if (Date.now() - letzterPuls >= 60 * 60_000) { letzterPuls = Date.now(); return true; }
  return false;
}
