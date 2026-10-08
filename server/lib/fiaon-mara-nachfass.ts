// ═══════════════════════════════════════════════════════════════════════════
// MARA FASST NACH — EINMAL, IM OFFENEN 24-STUNDEN-FENSTER (07.10.2026, E-299)
//
// Justin nach der Zahlenrunde am 07.10.: „Ja baue“ — auf den Vorschlag, dass Mara
// von selbst nachfasst, wenn jemand „mache ich später“ schreibt. Gemessen: Viele
// Gespräche endeten mit „Ich versuche es so schnell wie möglich“, „Morgen“, „Okay“
// — danach kam nichts mehr, weder vom Kunden noch von uns. Nach 24 Stunden geht
// auf WhatsApp nur noch eine bezahlte Vorlage (Marketing, 11 ct, bei ROT gesperrt).
//
// WAS GILT
//   · Ein Gespräch, in dem MARA das letzte Wort hatte (kein Mensch, keine Vorlage
//     danach), dessen letzte Kundennachricht 4 bis 23 Stunden alt ist — das
//     Fenster ist also noch offen, und die Nachricht ist kostenlos.
//     Mara-Topsales 08.10.2026 (Justin): ab 4 statt ab 16 Stunden. Gemessen (Diagnose 08.10.): Mit dem schmalen
//     Fenster 16–23 h brachte der Nachfass rund EINEN am Tag — die 16–23 h nach einer Nachricht vom Tag fallen
//     großteils in die Nacht, außerhalb von 08:00–20:30. Mit 4 Stunden fasst Mara am selben Tag nach. Weiterhin
//     höchstens einmal in sieben Tagen, nur 08:00–20:30 Uhr, alle Ausschlüsse unverändert.
//   · Nur Antrag offen (B: erste Zahlung offen, C: Antrag angefangen, Lead ohne
//     Antrag). Nie bei Folgeraten (WhatsApp verbietet Inkasso), nie bei gemeldeter
//     Zahlung, Kunden, Kündigung, Global-Kunden.
//   · Nie nach STOPP oder Widerspruch, nie bei Werbe- oder Vertriebssperre, nie wenn
//     in den letzten drei Tagen etwas Heikles kam (Kündigung, Widerruf, Erstattung,
//     Anwalt, Betrug, Polizei, Löschung, Beschwerde), nie wenn Mara zuletzt an
//     einen Menschen übergeben hat, nie vor einem festgehaltenen Zahltag.
//   · Höchstens EIN Nachfassen je Nummer in sieben Tagen, höchstens
//     mara_wa_nachfass_tag (Vorgabe 40) am Tag, nur 08:00–20:30 Uhr (Berlin).
//   · Schalter: fiaon_settings.mara_wa_nachfass = „aus“ stoppt alles.
//   · Der Text ist fest (Justins Aktivierungssatz, sein Link) — keine KI, keine
//     Kosten. Er geht durch dieselben Wände wie jede Mara-Antwort (tonPruefung hier,
//     Wortwand/Inkasso/Du-Form und die Bremse in waSenden).
//   · Erkennbar an von = „<Mara> (Nachfass)“ — so zählt jede Auswertung ihn als
//     Mara und findet ihn wieder.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { AKTIVIERUNG_AUFRUF, NACH_DEM_EINGANG, mitAntragLuecke, tonPruefung, type LinkStufe } from "@shared/fiaon-mara-ton";
import { WA_STOPP_ZEILE_SQL, menschSperre, werbungVerboten } from "./fiaon-mail-frequenz";

export const NACHFASS_SCHALTER = "mara_wa_nachfass";
export const NACHFASS_TAG_SCHLUESSEL = "mara_wa_nachfass_tag";
export const NACHFASS_TAG_VORGABE = 40;
export const NACHFASS_MARKE = "(Nachfass)";
/** Ab wann und bis wann nach seiner letzten Nachricht (Stunden) — das Fenster schließt nach 24. Mara-Topsales 08.10.2026: 4 statt 16. */
export const NACHFASS_AB_STUNDEN = 4;
export const NACHFASS_BIS_STUNDEN = 23;

/** Was in den letzten drei Tagen kam und ein Nachfassen ausschließt. */
export const NACHFASS_HEIKEL = /kündig|kuendig|widerruf|storn|erstatt|zurück\s*überweis|anwalt|betrug|betrüger|abzock|polizei|anzeige|lösch|loesch|beschwer|verbraucherzentrale|keine\s+nachrichten|nicht\s+mehr\s+(?:schreiben|kontaktieren|anschreiben)|kein(?:e|en)?\s+interesse/i;
/**
 * Ein klares Nein in den letzten drei Tagen („nein danke“, „mach ich nicht“, „kein Bedarf“) — Mara hat darauf schon
 * geantwortet; ungefragt noch einmal zu schreiben wäre Drängen (Probe 07.10.: „nein danke sowas kenne ich nicht mach ich nicht“).
 */
export const NACHFASS_NEIN = /\bnein\W{0,3}danke\b|\bmach(?:e)?\s+ich\s+nicht\b|\bkein(?:en)?\s+bedarf\b|\b(?:will|möchte|moechte)\s+(?:ich\s+)?(?:das\s+|es\s+)?(?:doch\s+)?nicht\b|\bnicht\s+interessiert\b|\bbrauche\s+ich\s+nicht\b/i;
/** Maras letzte Nachricht übergibt an einen Menschen oder nimmt etwas Heikles auf — dann fasst sie nicht nach. */
export const NACHFASS_UEBERGABE = /übernimmt|leitung|kündigung|widerruf|erstattung|löschwunsch|beschwerde|rückruf|ruft\s+sie\s+.*an|meldet\s+sich/i;

export type NachfassStufe = Extract<LinkStufe, "zahlung_offen" | "antrag_offen" | "lead">;

/**
 * Der Text des Nachfassens (WhatsApp, unter 500 Zeichen). Rein.
 * zahlung_offen: Justins Aktivierungssatz mit Betrag — fehlt im Antrag noch etwas, sagt mitAntragLuecke es so.
 */
export function nachfassText(l: { stufe: NachfassStufe; link: string; betrag?: string | null; luecke?: readonly string[] }): string {
  if (l.stufe === "zahlung_offen") {
    const nutzen = mitAntragLuecke(NACH_DEM_EINGANG, l.luecke ?? []);
    return `Kurz nachgefragt: Hat es mit der Überweisung für Ihre Visa-Kreditkarte geklappt? ${AKTIVIERUNG_AUFRUF}, Ihre erste Monatsrate${l.betrag ? ` über ${l.betrag}` : ""} — ${nutzen}! Betrag, Verwendungszweck und QR-Code stehen hier: ${l.link}`;
  }
  if (l.stufe === "antrag_offen") {
    return `Kurz nachgefragt: Ihre Angaben sind gespeichert, in etwa fünf Minuten ist Ihr Antrag für Ihre Visa-Kreditkarte fertig. Hier geht es genau dort weiter, wo Sie aufgehört haben: ${l.link} Machen Sie heute noch weiter?`;
  }
  return `Kurz nachgefragt: Ihr Antrag für Ihre eigene Visa-Kreditkarte dauert nur etwa fünf Minuten. Hier geht es los: ${l.link} Wollen wir starten?`;
}

/** Berliner Uhrzeit als Minuten seit Mitternacht. */
function berlinMinuten(jetzt: Date): number {
  const t = jetzt.toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit", hour12: false });
  const [h, m] = t.split(":").map((x) => parseInt(x, 10));
  return h * 60 + m;
}
export function nachfassZeitOk(jetzt: Date = new Date()): boolean {
  const m = berlinMinuten(jetzt);
  return m >= 8 * 60 && m <= 20 * 60 + 30;
}

/**
 * Die Kandidaten: letzte Kundennachricht 4–23 h alt (Mara-Topsales 08.10.2026; vorher 16–23 h), danach nur Mara (frei, kein Fehler), keine Vorlage und kein
 * Mensch, kein Nachfassen in sieben Tagen, nie gestoppt, Mara nicht abgeschaltet, keine vorbereitete Antwort.
 */
export const nachfassKandidatenSql = (abStunden: number = NACHFASS_AB_STUNDEN): string => `
  WITH r AS (
    SELECT DISTINCT ON (nummer) nummer, id, COALESCE(text, knopf, '') AS text, created_at AS am
      FROM fiaon_whatsapp
     WHERE richtung = 'rein' AND created_at > NOW() - INTERVAL '${NACHFASS_BIS_STUNDEN} hours'
     ORDER BY nummer, id DESC
  )
  SELECT r.nummer, r.id AS rein_id, r.text AS kunde, r.am,
         (SELECT o.text FROM fiaon_whatsapp o WHERE o.nummer = r.nummer AND o.richtung = 'raus' AND o.vorlage IS NULL
             AND o.status <> 'fehler' AND o.id > r.id ORDER BY o.id DESC LIMIT 1) AS mara,
         (SELECT w.person_id FROM fiaon_whatsapp w WHERE w.nummer = r.nummer AND w.person_id IS NOT NULL ORDER BY w.id DESC LIMIT 1) AS person_id,
         (SELECT w.lead_id FROM fiaon_whatsapp w WHERE w.nummer = r.nummer AND w.lead_id IS NOT NULL ORDER BY w.id DESC LIMIT 1) AS lead_id,
         (SELECT string_agg(COALESCE(h.text, h.knopf, ''), ' | ') FROM fiaon_whatsapp h
           WHERE h.nummer = r.nummer AND h.richtung = 'rein' AND h.created_at > NOW() - INTERVAL '3 days') AS kunde_3t
    FROM r
    LEFT JOIN fiaon_whatsapp_gespraech g ON g.nummer = r.nummer
   WHERE r.am < NOW() - INTERVAL '${Math.max(0, Math.min(NACHFASS_BIS_STUNDEN, Math.round(abStunden)))} hours'
     AND COALESCE(g.mara_an, TRUE) = TRUE
     AND g.antwort_text IS NULL
     AND EXISTS (SELECT 1 FROM fiaon_whatsapp o WHERE o.nummer = r.nummer AND o.richtung = 'raus' AND o.vorlage IS NULL
                   AND o.status <> 'fehler' AND o.id > r.id AND COALESCE(o.von, '') ILIKE 'Mara%')
     AND NOT EXISTS (SELECT 1 FROM fiaon_whatsapp o WHERE o.nummer = r.nummer AND o.richtung = 'raus' AND o.id > r.id
                   AND (o.vorlage IS NOT NULL OR COALESCE(o.von, '') NOT ILIKE 'Mara%'))
     AND NOT EXISTS (SELECT 1 FROM fiaon_whatsapp o WHERE o.nummer = r.nummer AND o.richtung = 'raus'
                   AND COALESCE(o.von, '') LIKE '%${NACHFASS_MARKE}' AND o.created_at > NOW() - INTERVAL '7 days')
     AND NOT EXISTS (SELECT 1 FROM fiaon_whatsapp s WHERE s.nummer = r.nummer AND ${WA_STOPP_ZEILE_SQL("s")})
   ORDER BY r.am
   LIMIT 60`;

export interface NachfassErgebnis { kandidaten: number; gesendet: number; uebersprungen: Record<string, number>; beispiele: string[] }

let laeuft = false;

/** Der Takt (alle 10 Minuten). `trocken`: nichts senden, nur zählen und den Text zeigen (Prüfstand, Probe). */
export async function nachfassLauf(opt: { trocken?: boolean; jetzt?: Date; /** nur Probe (trocken): ab wie vielen Stunden */ abStunden?: number } = {}): Promise<NachfassErgebnis> {
  const erg: NachfassErgebnis = { kandidaten: 0, gesendet: 0, uebersprungen: {}, beispiele: [] };
  const weg = (grund: string) => { erg.uebersprungen[grund] = (erg.uebersprungen[grund] ?? 0) + 1; };
  if (laeuft) return erg;
  laeuft = true;
  try {
    const jetzt = opt.jetzt ?? new Date();
    const [schalter] = (await sqlPool`SELECT value FROM fiaon_settings WHERE key = ${NACHFASS_SCHALTER}`.catch(() => [])) as any[];
    if (/^(aus|0|nein|false)$/i.test(String(schalter?.value ?? "").trim())) { weg("schalter_aus"); return erg; }
    if (!opt.trocken && !nachfassZeitOk(jetzt)) { weg("uhrzeit"); return erg; }
    const [deckelZeile] = (await sqlPool`SELECT value FROM fiaon_settings WHERE key = ${NACHFASS_TAG_SCHLUESSEL}`.catch(() => [])) as any[];
    const deckel = Math.max(0, Math.min(500, Number(deckelZeile?.value) || NACHFASS_TAG_VORGABE));
    const [heute] = (await sqlPool`
      SELECT count(*)::int AS n FROM fiaon_whatsapp
       WHERE richtung = 'raus' AND COALESCE(von, '') LIKE ${"%" + NACHFASS_MARKE}
         AND (created_at AT TIME ZONE 'Europe/Berlin')::date = (NOW() AT TIME ZONE 'Europe/Berlin')::date`) as any[];
    let frei = deckel - Number(heute?.n ?? 0);
    if (frei <= 0) { weg("tagesdeckel"); return erg; }

    const kandidaten = (await sqlPool.unsafe(nachfassKandidatenSql(opt.trocken ? opt.abStunden : undefined))) as any[];
    erg.kandidaten = kandidaten.length;
    if (!kandidaten.length) return erg;
    const wa = await import("./fiaon-whatsapp-mara");
    const { waSenden } = await import("./fiaon-whatsapp");
    const { agentNamen } = await import("./fiaon-postmeister-agent");
    const namen = await agentNamen();

    for (const k of kandidaten) {
      if (frei <= 0) { weg("tagesdeckel"); break; }
      const personId = k.person_id != null ? Number(k.person_id) : null;
      const leadId = k.lead_id != null ? Number(k.lead_id) : null;
      if (!personId && !leadId) { weg("ohne_person"); continue; }
      if (NACHFASS_HEIKEL.test(String(k.kunde_3t ?? ""))) { weg("heikel"); continue; }
      if (NACHFASS_NEIN.test(String(k.kunde_3t ?? ""))) { weg("nein"); continue; }
      if (NACHFASS_UEBERGABE.test(String(k.mara ?? ""))) { weg("uebergabe"); continue; }
      if (personId) {
        // Lässt sich die Sperre nicht lesen, schreibt Mara nicht (lieber einmal zu wenig als an einen Gesperrten).
        let s: Awaited<ReturnType<typeof menschSperre>>;
        try { s = await menschSperre(personId); } catch { weg("sperre_unbekannt"); continue; }
        if (werbungVerboten(s ? { ...s, test: false } : null)) { weg("sperre"); continue; }
        if (await wa.globalKundeWa(personId).catch(() => true)) { weg("global"); continue; }
      }
      const lage = await wa.lageFuer(personId, leadId, null, String(k.kunde ?? "")).catch(() => null);
      if (!lage) { weg("lage_fehlt"); continue; }
      const stufe = lage.linkLage?.stufe;
      if (stufe !== "zahlung_offen" && stufe !== "antrag_offen" && stufe !== "lead") { weg(`stufe_${stufe ?? "?"}`); continue; }
      if (lage.werbesperre || lage.vertriebssperre) { weg("sperre"); continue; }
      if (!lage.link) { weg("ohne_link"); continue; }
      const heuteIso = jetzt.toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
      if (lage.zahltag && lage.zahltag >= heuteIso) { weg("zahltag"); continue; }
      let luecke: string[] = [];
      if (stufe === "zahlung_offen" && personId) {
        luecke = ((await import("./fiaon-konto-karte").then((m) => m.karteEinladungStand(personId)).catch(() => null))?.fehlendeAngaben ?? []) as string[];
      }
      const text = nachfassText({ stufe, link: lage.link, betrag: lage.zahlung?.betrag ?? lage.ersteRate ?? null, luecke });
      const hart = tonPruefung(text, { kanal: "whatsapp", land: lage.land ?? null, kunde: String(k.kunde ?? "") }).filter((f) => f.schwere === "hart");
      if (hart.length) { weg("wand"); console.warn(`[MARA-NACHFASS] ${String(k.nummer).slice(-4)}: Wand (${hart.map((h) => h.id).join(", ")}) — nicht gesendet.`); continue; }
      if (erg.beispiele.length < 5) erg.beispiele.push(`${stufe}: ${text}`);
      if (opt.trocken) { erg.gesendet++; frei--; continue; }
      const s = await waSenden(String(k.nummer), { text }, { personId, leadId, von: `${namen.voll} ${NACHFASS_MARKE}` });
      if (!s.ok) { weg(s.pausiert ? "bremse" : "senden"); if (s.pausiert) break; continue; }
      erg.gesendet++;
      frei--;
      if (personId) await wa.maraWaVermerk(personId, { kunde: "(keine Antwort seit einigen Stunden)", mara: text, handlung: "Mara hat einmal nachgefasst (E-299)." }).catch(() => {});
    }
    if (erg.gesendet || Object.keys(erg.uebersprungen).length) {
      console.log(`[MARA-NACHFASS] ${opt.trocken ? "Probe" : "Lauf"}: ${erg.kandidaten} Kandidaten, ${erg.gesendet} ${opt.trocken ? "würden gesendet" : "gesendet"}, übersprungen ${JSON.stringify(erg.uebersprungen)}`);
    }
  } catch (e) {
    console.error("[MARA-NACHFASS]", e);
  } finally {
    laeuft = false;
  }
  return erg;
}
