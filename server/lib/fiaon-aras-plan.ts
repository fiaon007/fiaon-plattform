// ═══════════════════════════════════════════════════════════════════════════
// ARAS — Einstellungen und die Warteschlange (E-408, Vertrag § 3 / § 4)
//
// Die Warteschlange (fiaon_aras_plan) füllt sich aus der Akte — kein Mensch
// tippt etwas: Termine bei Aras, Zuruf-JA (Einwilligung), Zahlung gemeldet
// (Stufe A), Rate fällig (Tag 0/−1 und Tag 3/10/20), Zusage nachfassen.
// Lead, Stufe B kalt und Rückholung sind AUS, bis Justin sie einschaltet
// (LEXR). Jede Werbe-Spielart braucht eine Einwilligungs-Zeile — ohne sie
// entsteht gar kein Eintrag.
//
// Alles hier ist Buchführung; die Wände (Fenster, Deckel, Sperre, Höchstzahlen)
// prüft der Wähler NOCH EINMAL beim Wählen (fiaon-aras-waehler.ts).
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { arasSchema, arasAusweisId } from "./fiaon-aras-schema";
import { echtePersonSql } from "./fiaon-bestand-filter";
import { globalKundeSql, globalKundeBereit } from "./fiaon-global-kunde";
import { abgeschicktSql } from "../../shared/fiaon-antrag-stand";
import { ERINNERBARE_BESTELLUNG_SQL, RATE_NACH_ENDE_SQL_FUER } from "./fiaon-raten-storno";
import { waehlbareNummer } from "./fiaon-telefon";
import { berlinToday } from "./fiaon-time";
import { telefonGesperrt, nummerKern } from "./fiaon-aras-sperre";
import { einwilligungGueltig, einwilligungMerken } from "./fiaon-telefon-einwilligung";
import { STUFE_A_GEMELDET_TAGE } from "../../shared/fiaon-wiedervorlage";
import {
  ARAS_SCHLUESSEL_LISTE, einstellungPruefen, einstellungenAnwenden, nummerLand, reihen, stundeFuer, fensterOffen, berlinTeile,
  PRIORITAET, RECHTSGRUND, SPIELARTEN, STUFE_B_FRISCH_STUNDEN, istSpielart, istWerbeSpielart, istVertragsFenster, stufenGrenzen, KEIN_VERTRAG_SATZ, KEIN_VERTRAG_MEHR_SATZ, istGesperrteSpielart, GESPERRT_TEXT,
  type ArasEinstellungen, type Spielart, type PlanStatus, type PlanZeile, type PlanLage, type Tagesplan, type Lernvorschlag, type Land,
} from "../../shared/fiaon-aras";

type Lauf = typeof sqlPool;

// ── Einstellungen ──────────────────────────────────────────────────────────
let zwischen: { wert: ArasEinstellungen; bis: number } | null = null;

export async function arasEinstellungenLesen(frisch = false, lauf: Lauf = sqlPool): Promise<ArasEinstellungen> {
  if (!frisch && zwischen && zwischen.bis > Date.now()) return zwischen.wert;
  const zeilen = (await lauf`SELECT key, value FROM fiaon_settings WHERE key LIKE 'aras_%'`.catch(() => [])) as any[];
  const roh: Record<string, string> = {};
  for (const z of zeilen) roh[String(z.key)] = String(z.value ?? "");
  const wert = einstellungenAnwenden(roh);
  zwischen = { wert, bis: Date.now() + 10_000 };
  return wert;
}
export function arasEinstellungenVergessen(): void { zwischen = null; }

/** Alle Rohwerte (für die Einstellungen-Seite: Wert neben Vorgabe). */
export async function arasEinstellungenRoh(lauf: Lauf = sqlPool): Promise<Record<string, string>> {
  const zeilen = (await lauf`SELECT key, value FROM fiaon_settings WHERE key LIKE 'aras_%'`.catch(() => [])) as any[];
  return Object.fromEntries(zeilen.map((z) => [String(z.key), String(z.value ?? "")]));
}

export async function einstellungSetzen(schluessel: string, wert: unknown, von: string, lauf: Lauf = sqlPool): Promise<string> {
  if (!ARAS_SCHLUESSEL_LISTE.includes(schluessel)) throw new Error(`Unbekannte Einstellung „${schluessel}“ — kein ARAS-Schlüssel.`);
  const w = einstellungPruefen(schluessel, wert);
  await lauf`INSERT INTO fiaon_settings (key, value, updated_at) VALUES (${schluessel}, ${w}, NOW())
             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`;
  zwischen = null;
  const { protokollieren } = await import("./fiaon-mara-termin");
  await protokollieren({ kanal: "telefon", art: "aras_werkzeug" as any, text: `Einstellung ${schluessel} = ${w.slice(0, 80)} (${von})`, daten: { schluessel, von } }, lauf);
  return w;
}

// ── Kosten heute (für den Tagesdeckel) ────────────────────────────────────
/**
 * Was ARAS heute gekostet hat: KI aller aras-*-Dienste (fiaon_ki_nutzung — dieselbe Quelle wie kiKostenJeDienst
 * im KI-Raum, E-409) + die laufenden Sitzungen (noch nicht abgerechnet) + Telefon der ARAS-Anrufe (Schätzung je Minute).
 */
export async function arasKostenHeute(lauf: Lauf = sqlPool): Promise<{ ki: number; telefon: number; euro: number }> {
  await arasSchema(lauf);
  const t = berlinTeile(new Date()).datum;
  const [k] = (await lauf`SELECT COALESCE(SUM(kosten_cents), 0)::float AS cents FROM fiaon_ki_nutzung
                           WHERE dienst LIKE 'aras-%' AND (created_at AT TIME ZONE 'Europe/Berlin')::date = ${t}::date`.catch(() => [{ cents: 0 }])) as any[];
  const [a] = (await lauf`SELECT COALESCE(SUM(kosten_telefon_cents), 0)::float AS telefon,
                                 COALESCE(SUM(kosten_ki_cents) FILTER (WHERE nachbereitet_am IS NULL), 0)::float AS laufend
                            FROM fiaon_aras_anruf WHERE (created_at AT TIME ZONE 'Europe/Berlin')::date = ${t}::date`) as any[];
  const ki = (Number(k?.cents ?? 0) + Number(a?.laufend ?? 0)) / 100, telefon = Number(a?.telefon ?? 0) / 100;
  return { ki: Math.round(ki * 100) / 100, telefon: Math.round(telefon * 100) / 100, euro: Math.round((ki + telefon) * 100) / 100 };
}

// ── Versuche je Person (Mensch + ARAS zusammen) ────────────────────────────
export async function versucheHeute(personId: number, lauf: Lauf = sqlPool): Promise<{ heute: number; woche: number; fehlFolge: number; letzterVersuchAm: Date | null }> {
  const [z] = (await lauf`
    WITH v AS (
      SELECT c.beginn, c.ergebnis, c.status,
             -- Wählvorgänge binnen 5 Minuten sind EIN Versuch (Hausregel, fiaon-anrufversuche.ts)
             CASE WHEN LAG(c.beginn) OVER (ORDER BY c.beginn, c.id) > c.beginn - INTERVAL '5 minutes' THEN 0 ELSE 1 END AS neu
        FROM fiaon_calls c
       WHERE c.person_id = ${personId} AND c.richtung = 'raus'
         AND NOT (c.status = 'gewaehlt' AND c.twilio_sid IS NULL AND c.beginn < NOW() - INTERVAL '10 minutes')
         AND c.beginn > NOW() - INTERVAL '60 days'
    )
    SELECT COUNT(*) FILTER (WHERE neu = 1 AND (beginn AT TIME ZONE 'Europe/Berlin')::date = (NOW() AT TIME ZONE 'Europe/Berlin')::date)::int AS heute,
           COUNT(*) FILTER (WHERE neu = 1 AND beginn > NOW() - INTERVAL '7 days')::int AS woche,
           MAX(beginn) AS letzter
      FROM v`) as any[];
  const [f] = (await lauf`
    SELECT COUNT(*)::int AS fehl FROM fiaon_calls c
     WHERE c.person_id = ${personId} AND c.richtung = 'raus'
       AND c.beginn > COALESCE((SELECT MAX(beginn) FROM fiaon_calls WHERE person_id = ${personId} AND richtung = 'raus'
                                  AND (ergebnis LIKE 'erreicht%' OR ergebnis = 'rueckruf_termin' OR status = 'beendet' AND dauer_sek >= 30)), '1970-01-01')`) as any[];
  return { heute: Number(z?.heute ?? 0), woche: Number(z?.woche ?? 0), fehlFolge: Number(f?.fehl ?? 0), letzterVersuchAm: z?.letzter ? new Date(z.letzter) : null };
}

// ── Einreihen ──────────────────────────────────────────────────────────────
export interface EinreihenEin {
  personId: number | null; leadId?: number | null; ref?: string | null;
  nummer: string; spielart: Spielart; grund: string;
  erzeugtVon: "takt" | "mara" | "lead_motor" | "antrag" | "chef" | "kunde" | "probe" | "akte";
  fruehAb?: Date; spaetBis?: Date;
  terminId?: number | null; rateId?: number | null; erinnerungId?: number | null; einwilligungId?: number | null;
  betragCents?: number | null; anlassAm?: Date | null; fehlFolge?: number;
  /** Nur der Takt darf die Prüfung „gibt es heute schon einen Eintrag“ nutzen; der Chef reiht bewusst erneut ein. */
  einmalProTag?: boolean;
  /** Wer von Hand eingereiht hat (Betreuer-Name, „Chef #928“, „Mara“) — die Warteschlange zeigt es. */
  auftragVon?: string | null;
  /** Derselbe im Dativ („Herrn Krause“) — für Aras' Satz „ich rufe im Auftrag von …“. */
  auftragVonDat?: string | null;
  /** Der Mitarbeiter, der den Auftrag gegeben hat (Akte). */
  auftragAgentId?: number | null;
  /** Freitext-Auftrag aus der Akte („teile dem Kunden mit …“) — schon durch die Wortwand. */
  auftragText?: string | null;
  /** „Offenes an Aras abgeben“ / „Aras anrufen lassen“: die Punkte in Reihenfolge (art, label für die Akte, satz für Aras). */
  offenes?: { art: string; label: string; satz: string }[] | null;
  /** Der wievielte Versuch dieses Auftrags (Akte: nicht erreicht → am nächsten Tag noch einmal, höchstens AUFTRAG_VERSUCHE). */
  versuchNr?: number;
  /** Nach dem Anruf diesen Mitarbeiter benachrichtigen. */
  benachrichtigenAgentId?: number | null;
}

/** „Aras für diesen Kunden aus“ (fiaon_aras_person.aus_am) — gilt nur für Aras, das Team ruft weiter an. */
export async function arasAusFuerPerson(personId: number, lauf: Lauf = sqlPool): Promise<boolean> {
  await arasSchema(lauf);
  const [z] = (await lauf`SELECT aus_am FROM fiaon_aras_person WHERE person_id = ${personId}`) as any[];
  return !!z?.aus_am;
}

/** Hat die Person einen Vertrag (bezahlt, Zahlung gemeldet, nicht beendet)? Dann ist ein Auftrag aus der Akte Vertragssache. */
export async function vertragsKunde(personId: number, lauf: Lauf = sqlPool): Promise<boolean> {
  const [z] = (await lauf`
    SELECT 1 FROM fiaon_applications a
     WHERE a.person_id = ${personId} AND a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL AND a.archived_at IS NULL
       AND (a.payment_status IN ('paid', 'claimed_paid') OR a.claimed_paid_at IS NOT NULL)
       AND a.gekuendigt_am IS NULL AND a.abo_gestoppt_am IS NULL AND COALESCE(a.payment_status, '') NOT IN ('cancelled', 'refunded', 'superseded')
     LIMIT 1`.catch(() => [])) as any[];
  return !!z;
}

/**
 * Hat die Person einen Vertrag? (Justin 20.10.2026, 21:55: „Nein, nur Vertragskunden“.) „laeuft“ = unterschrieben (Vertragsannahme
 * oder consent_contract), bezahlt oder Zahlung gemeldet — und nicht beendet — ODER eine offene Rate (der Vertrag läuft bis zum
 * Ende). „ehemalig“ = hatte einen Vertrag, der beendet ist. „keiner“ = Interessent. Fehlt die Tabelle der Vertragsannahmen,
 * zählt nur consent_contract.
 */
export async function vertragsLage(personId: number, lauf: Lauf = sqlPool): Promise<"laeuft" | "ehemalig" | "keiner"> {
  const sql = (mitAnnahme: boolean) => {
    const unterschrieben = `(a.consent_contract IS TRUE${mitAnnahme ? " OR EXISTS (SELECT 1 FROM fiaon_vertragsannahmen v WHERE v.ref = a.ref AND COALESCE(v.weg, '') NOT LIKE '%pruefstand%')" : ""})`;
    return lauf.unsafe(`
      SELECT COALESCE(bool_or(
               ((${unterschrieben} OR COALESCE(a.payment_status, '') IN ('paid', 'claimed_paid') OR a.claimed_paid_at IS NOT NULL)
                 AND a.archived_at IS NULL AND a.gekuendigt_am IS NULL AND a.abo_gestoppt_am IS NULL
                 AND COALESCE(a.payment_status, '') NOT IN ('cancelled', 'refunded', 'superseded'))
               OR EXISTS (SELECT 1 FROM fiaon_abo_raten r WHERE r.ref = a.ref AND r.status = 'offen' AND r.storniert_am IS NULL AND r.bezahlt_am IS NULL)
             ), FALSE) AS laeuft,
             COALESCE(bool_or(${unterschrieben} OR COALESCE(a.payment_status, '') IN ('paid', 'completed', 'claimed_paid', 'refunded') OR a.claimed_paid_at IS NOT NULL), FALSE) AS war
        FROM fiaon_applications a
       WHERE a.person_id = ${Number(personId)} AND a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL`);
  };
  const [z] = ((await sql(true).catch(() => null)) ?? (await sql(false).catch(() => []))) as any[];
  return z?.laeuft ? "laeuft" : z?.war ? "ehemalig" : "keiner";
}

/**
 * Go-live (20.10.2026, Koordination): „Willkommen nach Antrag“ nur nach dem UNTERSCHRIEBENEN Antrag — eine Vertragsannahme
 * (/antrag-neu „Zahlungspflichtig annehmen“) oder consent_contract (/vertrag-bestaetigen). Nie für Leads, nie nach Kündigung.
 * Fehlt die Tabelle der Vertragsannahmen, gilt nur consent_contract.
 */
export async function willkommenBereit(personId: number, lauf: Lauf = sqlPool): Promise<boolean> {
  const sql = (mitAnnahme: boolean) => lauf.unsafe(`
    SELECT 1 FROM fiaon_applications a
     WHERE a.person_id = ${Number(personId)} AND a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL AND a.archived_at IS NULL
       AND a.gekuendigt_am IS NULL AND COALESCE(a.payment_status, '') NOT IN ('cancelled', 'refunded', 'superseded')
       AND (a.consent_contract IS TRUE${mitAnnahme ? " OR EXISTS (SELECT 1 FROM fiaon_vertragsannahmen v WHERE v.ref = a.ref)" : ""})
     LIMIT 1`);
  const z = ((await sql(true).catch(() => null)) ?? (await sql(false).catch(() => []))) as any[];
  return z.length > 0;
}

// ── Willkommen nach Antrag (Go-live 20.10.2026, Koordination) ──────────────────────────────────────────────────
/** 20 Minuten nach der Unterschrift, höchstens 24 h danach — später nie. */
export const WILLKOMMEN_AB_MINUTEN = 20, WILLKOMMEN_BIS_STUNDEN = 24;
/**
 * EINE Quelle für Planer und Wähler: jede Vertragsannahme mit den Gründen, warum ARAS NICHT anruft. Angerufen wird nur, wenn
 * alle false sind: unterschrieben (Vertragsannahme, kein Prüfstand), Aktivierung offen (nichts bezahlt, nichts gemeldet),
 * Vertrag nicht beendet, keine Werbe- oder Vertriebssperre, keine Testperson, kein FIAON Global, KEIN Anruf mit ihm in den
 * letzten 24 h (Mensch oder ARAS, rein oder raus), die Unterschrift 20 Minuten bis 24 h alt.
 */
function willkommenSql(): string {
  return `
    SELECT v.ref, v.angenommen_am, ${PERSON_NUMMER_SQL},
           (COALESCE(a.payment_status, '') IN ('paid', 'completed', 'claimed_paid') OR a.claimed_paid_at IS NOT NULL) AS bezahlt,
           (a.gekuendigt_am IS NOT NULL OR a.abo_gestoppt_am IS NOT NULL OR COALESCE(a.payment_status, '') IN ('cancelled', 'refunded', 'superseded')) AS beendet,
           (COALESCE(p.is_blocked, FALSE) OR p.werbung_gesperrt_am IS NOT NULL) AS gesperrt,
           NOT (${echtePersonSql("p")}) AS test,
           ${globalKundeSql("p.id")} AS global,
           EXISTS (SELECT 1 FROM fiaon_calls c WHERE c.person_id = p.id AND c.beginn > NOW() - INTERVAL '24 hours') AS anruf_24h,
           (v.angenommen_am < NOW() - make_interval(hours => ${WILLKOMMEN_BIS_STUNDEN})) AS zu_alt,
           (v.angenommen_am > NOW() - make_interval(mins => ${WILLKOMMEN_AB_MINUTEN})) AS zu_frisch,
           (COALESCE(v.weg, '') LIKE '%pruefstand%') AS pruefstand
      FROM fiaon_vertragsannahmen v
      JOIN fiaon_applications a ON a.ref = v.ref AND a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL AND a.archived_at IS NULL
      JOIN fiaon_persons p ON p.id = a.person_id`;
}
const WILLKOMMEN_NEIN: [string, string][] = [
  ["pruefstand", "Prüfstand-Annahme"], ["bezahlt", "Aktivierung schon da"], ["beendet", "Vertrag beendet"], ["gesperrt", "Werbe- oder Vertriebssperre"],
  ["test", "Testperson"], ["global", "FIAON Global"], ["anruf_24h", "Anruf in den letzten 24 h"], ["zu_alt", "Unterschrift älter als 24 h"],
  ["zu_frisch", "Unterschrift jünger als 20 Minuten"],
];
/** Darf ARAS zu diesem Vertrag JETZT „Willkommen“ anrufen? null = ja, sonst der Grund (für Warteschlange und Protokoll). */
export async function willkommenEntfaellt(ref: string | null | undefined, lauf: Lauf = sqlPool): Promise<string | null> {
  if (!ref) return "ohne Antrag";
  await globalKundeBereit();
  const [w] = (await lauf.unsafe(`${willkommenSql()} WHERE v.ref = $1 LIMIT 1`, [String(ref)]).catch(() => [])) as any[];
  if (!w) return "kein unterschriebener Antrag";
  for (const [k, text] of WILLKOMMEN_NEIN) if (w[k]) return text;
  return null;
}

/** Die wählbare Nummer einer Person (primary_phone, Land) — E.164 oder null. */
export async function personNummer(personId: number, lauf: Lauf = sqlPool): Promise<string | null> {
  const [p] = (await lauf`SELECT primary_phone, country FROM fiaon_persons WHERE id = ${personId}`.catch(() => [])) as any[];
  if (!p?.primary_phone) return null;
  return waehlbareNummer([{ nummer: p.primary_phone }], p.country).waehlbar ?? null;
}

export async function planEinreihen(e: EinreihenEin, lauf: Lauf = sqlPool): Promise<{ ok: boolean; id?: number; grund?: string }> {
  await arasSchema(lauf);
  if (!istSpielart(e.spielart)) return { ok: false, grund: "Unbekannte Spielart." };
  // Justin 20.10.2026 („nur Vertragskunden“): Zuruf, Lead, Stufe B und Rückholung sind im Code gesperrt — auch von Hand.
  if (istGesperrteSpielart(e.spielart)) return { ok: false, grund: `${e.spielart}: ${GESPERRT_TEXT}.` };
  const einst = await arasEinstellungenLesen(false, lauf);
  if (!einst.spielarten[e.spielart] && e.spielart !== "probe") return { ok: false, grund: `Spielart „${e.spielart}“ ist ausgeschaltet.` };
  const nummer = e.spielart === "probe" ? e.nummer : (waehlbareNummer([{ nummer: e.nummer }]).waehlbar ?? null);
  if (!nummer) return { ok: false, grund: "Keine wählbare Nummer." };
  const land: Land = nummerLand(nummer) ?? "DE";
  const kern = nummerKern(nummer);
  if (e.spielart !== "probe" && await telefonGesperrt(kern, e.personId, lauf)) return { ok: false, grund: "Telefonsperre (nicht mehr anrufen)." };
  if (e.personId && e.spielart !== "probe" && await arasAusFuerPerson(e.personId, lauf)) return { ok: false, grund: "Aras ist für diesen Kunden aus." };
  let rechtsgrund = RECHTSGRUND[e.spielart];
  if (e.personId && e.spielart !== "probe") {
    await globalKundeBereit();
    const [g] = (await lauf.unsafe(`SELECT ${globalKundeSql("p.id")} AS global, p.ist_test_am IS NOT NULL AS test, p.werbung_gesperrt_am IS NOT NULL AS werbesperre FROM fiaon_persons p WHERE p.id = ${Number(e.personId)}`)) as any[];
    if (g?.global) return { ok: false, grund: "Firmenkunde (FIAON Global) — ARAS ruft nicht an." };
    if (g?.test) return { ok: false, grund: "Testperson." };
    if (g?.werbesperre && istWerbeSpielart(e.spielart)) return { ok: false, grund: "Werbesperre — keine Werbe-Spielart." };
    // Auftrag aus der Akte: NUR Kunden mit Vertrag (Justin 20.10.2026, 21:55: „Nein, nur Vertragskunden“) — Interessenten schreibt Mara.
    if (e.spielart === "auftrag") {
      const v = await vertragsLage(e.personId, lauf);
      if (v !== "laeuft") return { ok: false, grund: v === "ehemalig" ? KEIN_VERTRAG_MEHR_SATZ : KEIN_VERTRAG_SATZ };
      rechtsgrund = "vertrag";
    }
    if (e.spielart === "willkommen" && !(await willkommenBereit(e.personId, lauf))) return { ok: false, grund: "Willkommen nur nach dem unterschriebenen Antrag." };
  } else if (e.spielart === "auftrag") return { ok: false, grund: "Ein Auftrag braucht einen Kunden." };
  else if (e.spielart === "willkommen") return { ok: false, grund: "Willkommen braucht einen Kunden mit unterschriebenem Antrag." };
  let einwilligungId = e.einwilligungId ?? null;
  if (rechtsgrund === "einwilligung") {
    if (!einwilligungId) {
      const ew = await einwilligungGueltig(kern, e.personId, lauf);
      if (!ew) return { ok: false, grund: "Keine gültige Telefon-Einwilligung (§ 7a UWG) — Werbe-Spielart ohne Ja." };
      einwilligungId = ew.id;
    }
    if (land === "CH" && !einst.callerIdCh) return { ok: false, grund: "Schweiz: keine eingetragene CH-Nummer (UWG lit. v) — keine Werbe-Spielart." };
  }
  if (e.einmalProTag && e.personId) {
    const [d] = (await lauf`SELECT 1 FROM fiaon_aras_plan WHERE person_id = ${e.personId} AND spielart = ${e.spielart}
                             AND (created_at AT TIME ZONE 'Europe/Berlin')::date = (NOW() AT TIME ZONE 'Europe/Berlin')::date LIMIT 1`) as any[];
    if (d) return { ok: false, grund: "Heute schon eingereiht." };
  }
  const jetzt = new Date();
  const fruehAb = e.fruehAb ?? jetzt;
  const spaetBis = e.spaetBis ?? new Date(fruehAb.getTime() + 12 * 3600_000);
  const [z] = (await lauf`
    INSERT INTO fiaon_aras_plan (person_id, lead_id, ref, nummer, land, spielart, prioritaet, grund, rechtsgrund, einwilligung_id,
                                 termin_id, rate_id, erinnerung_id, frueh_ab, spaet_bis, erzeugt_von, betrag_cents, anlass_am, fehl_folge,
                                 auftrag_von, auftrag_text, auftrag_offenes, benachrichtigen_agent_id, versuch_nr, auftrag_von_dat, auftrag_agent_id)
    VALUES (${e.personId}, ${e.leadId ?? null}, ${e.ref ?? null}, ${nummer}, ${land}, ${e.spielart}, ${PRIORITAET[e.spielart]}, ${e.grund.slice(0, 200)},
            ${rechtsgrund}, ${einwilligungId}, ${e.terminId ?? null}, ${e.rateId ?? null}, ${e.erinnerungId ?? null},
            ${fruehAb}, ${spaetBis}, ${e.erzeugtVon}, ${e.betragCents ?? null}, ${e.anlassAm ?? null}, ${e.fehlFolge ?? 0},
            ${e.auftragVon ?? null}, ${e.auftragText ?? null}, ${e.offenes?.length ? lauf.json(e.offenes as any) : null}, ${e.benachrichtigenAgentId ?? null}, ${Math.max(1, Math.min(9, e.versuchNr ?? 1))},
            ${e.auftragVonDat ?? null}, ${e.auftragAgentId ?? null})
    ON CONFLICT (person_id, spielart) WHERE status = 'wartet' AND person_id IS NOT NULL DO NOTHING
    RETURNING id`) as any[];
  if (!z) return { ok: false, grund: "Wartet schon (ein offener Eintrag je Person und Spielart)." };
  return { ok: true, id: Number(z.id) };
}

export async function planVerschieben(id: number, bis: Date, grund: string, von: string, lauf: Lauf = sqlPool): Promise<void> {
  await arasSchema(lauf);
  await lauf`UPDATE fiaon_aras_plan SET frueh_ab = ${bis}, spaet_bis = GREATEST(spaet_bis, ${bis} + INTERVAL '4 hours'), status = 'wartet',
             verschoben_grund = ${`${grund} (${von})`.slice(0, 200)}, updated_at = NOW() WHERE id = ${id} AND status IN ('wartet', 'verschoben', 'verfallen')`;
}
export async function planEntfernen(id: number, grund: string, von: string, lauf: Lauf = sqlPool): Promise<void> {
  await arasSchema(lauf);
  await lauf`UPDATE fiaon_aras_plan SET status = 'verfallen', verschoben_grund = ${`${grund} (${von})`.slice(0, 200)}, updated_at = NOW() WHERE id = ${id} AND status = 'wartet'`;
}

// ── Lage und Listen ────────────────────────────────────────────────────────
function zeile(z: any, maskiert: boolean): PlanZeile {
  const name = z.last_name ? String(z.last_name) : (z.company_name ? String(z.company_name) : "—");
  return {
    id: Number(z.id), personId: z.person_id != null ? Number(z.person_id) : null,
    name: maskiert && name !== "—" ? `${name.slice(0, 1)}…` : name,
    spielart: z.spielart, prioritaet: Number(z.prioritaet), grund: String(z.grund ?? ""),
    fruehAb: new Date(z.frueh_ab).toISOString(), spaetBis: new Date(z.spaet_bis).toISOString(),
    status: z.status, versuchNr: Number(z.versuch_nr ?? 1), rechtsgrund: z.rechtsgrund, land: String(z.land ?? "DE"),
  };
}

export async function planLage(lauf: Lauf = sqlPool, maskiert = false): Promise<PlanLage> {
  await arasSchema(lauf);
  const je = (await lauf`SELECT spielart, status, COUNT(*)::int AS n FROM fiaon_aras_plan
                          WHERE created_at > NOW() - INTERVAL '2 days' OR status = 'wartet' GROUP BY 1, 2`) as any[];
  const jeSpielart: Record<string, Record<string, number>> = {};
  for (const z of je) { (jeSpielart[z.spielart] ??= {})[z.status] = Number(z.n); }
  const naechste = (await lauf`
    SELECT pl.*, p.last_name, p.company_name FROM fiaon_aras_plan pl LEFT JOIN fiaon_persons p ON p.id = pl.person_id
     WHERE pl.status = 'wartet' ORDER BY pl.prioritaet, pl.frueh_ab LIMIT 20`) as any[];
  const [w] = (await lauf`SELECT COUNT(*) FILTER (WHERE status = 'wartet')::int AS wartet,
                                  COUNT(*) FILTER (WHERE status = 'fertig' AND (updated_at AT TIME ZONE 'Europe/Berlin')::date = (NOW() AT TIME ZONE 'Europe/Berlin')::date)::int AS fertig
                             FROM fiaon_aras_plan`) as any[];
  return { jeSpielart, naechste: naechste.map((z) => zeile(z, maskiert)), wartet: Number(w?.wartet ?? 0), heuteFertig: Number(w?.fertig ?? 0) };
}

export async function planListe(f: { status?: PlanStatus; spielart?: Spielart; seite?: number }, lauf: Lauf = sqlPool, maskiert = false): Promise<PlanZeile[]> {
  await arasSchema(lauf);
  const seite = Math.max(0, Number(f.seite ?? 0));
  const zeilen = (await lauf`
    SELECT pl.*, p.last_name, p.company_name FROM fiaon_aras_plan pl LEFT JOIN fiaon_persons p ON p.id = pl.person_id
     WHERE (${f.status ?? null}::text IS NULL OR pl.status = ${f.status ?? null})
       AND (${f.spielart ?? null}::text IS NULL OR pl.spielart = ${f.spielart ?? null})
     ORDER BY CASE pl.status WHEN 'wartet' THEN 0 WHEN 'laeuft' THEN 1 WHEN 'gewaehlt' THEN 1 ELSE 2 END, pl.prioritaet, pl.frueh_ab DESC
     LIMIT 50 OFFSET ${seite * 50}`) as any[];
  return zeilen.map((z) => zeile(z, maskiert));
}

// ── Der Füller: aus der Akte in die Warteschlange ──────────────────────────
function heuteUm(h: number, min = 0): Date {
  const b = berlinTeile(new Date());
  const [j, m, t] = b.datum.split("-").map(Number);
  // Berliner Wandzeit → Zeitpunkt: über die Differenz zwischen UTC-Interpretation und Berlin-Anzeige
  const utc = new Date(Date.UTC(j, m - 1, t, h, min, 0));
  const anzeige = berlinTeile(utc);
  const versatz = (Number(anzeige.hhmm.slice(0, 2)) * 60 + Number(anzeige.hhmm.slice(3))) - (h * 60 + min);
  return new Date(utc.getTime() - versatz * 60_000);
}
function fensterEnde(spielart: Spielart, einst: ArasEinstellungen): Date {
  const f = istVertragsFenster(spielart) ? einst.fenster.rate : einst.fenster.verkauf;
  const wt = berlinTeile(new Date()).wochentag;
  let bis = "19:00";
  for (const [tage, zeit] of Object.entries(f)) {
    const m = /^([1-7])(?:-([1-7]))?$/.exec(tage);
    if (m && wt >= Number(m[1]) && wt <= Number(m[2] ?? m[1])) bis = zeit[1];
  }
  return heuteUm(Number(bis.slice(0, 2)), Number(bis.slice(3)));
}
function abBesterStunde(spielart: Spielart): Date {
  const h = stundeFuer(spielart, null);
  const ab = heuteUm(h);
  return ab.getTime() > Date.now() ? ab : new Date();
}

const PERSON_NUMMER_SQL = `p.primary_phone AS nummer, p.country, p.id AS person_id, p.last_name`;

export async function planFuellen(lauf: Lauf = sqlPool): Promise<{ eingereiht: Record<string, number>; uebersprungen: Record<string, number>; verfallen: number }> {
  await arasSchema(lauf);
  await globalKundeBereit();
  const einst = await arasEinstellungenLesen(true, lauf);
  const eingereiht: Record<string, number> = {}, uebersprungen: Record<string, number> = {};
  const zaehl = (s: Spielart, r: { ok: boolean; grund?: string }) => { if (r.ok) eingereiht[s] = (eingereiht[s] ?? 0) + 1; else uebersprungen[`${s}:${(r.grund ?? "").slice(0, 40)}`] = (uebersprungen[`${s}:${(r.grund ?? "").slice(0, 40)}`] ?? 0) + 1; };
  const nummerVon = (z: any) => waehlbareNummer([{ nummer: z.nummer }], z.country).waehlbar;
  const verfallenR = (await lauf`UPDATE fiaon_aras_plan SET status = 'verfallen', updated_at = NOW() WHERE status = 'wartet' AND spaet_bis < NOW() RETURNING id`) as any[];
  const heute = berlinToday();
  // Stufenplan (hart): Stufe 0 reiht keinen Kunden ein; darüber nur die Gesprächsarten der Stufe (und des Schalters).
  const grenzen = stufenGrenzen(einst);
  if (grenzen.stufe === 0) return { eingereiht, uebersprungen: { stufe_0: 1 }, verfallen: verfallenR.length };
  const an = (s: Spielart) => grenzen.spielartErlaubt(s);

  // 1. Termine bei Aras (Minute genau; die Buchung ist die Einwilligung)
  if (an("termin")) {
    const ausweis = await arasAusweisId(lauf);
    const zeilen = (await lauf`
      SELECT t.id AS termin_id, t.beginn, t.person_id, ${lauf.unsafe(PERSON_NUMMER_SQL)}
        FROM fiaon_termine t JOIN fiaon_persons p ON p.id = t.person_id
       WHERE t.agent_id = ${ausweis} AND t.status = 'gebucht' AND t.beginn BETWEEN NOW() - INTERVAL '15 minutes' AND NOW() + INTERVAL '36 hours'
         AND ${lauf.unsafe(echtePersonSql("p"))}
         AND NOT EXISTS (SELECT 1 FROM fiaon_aras_plan x WHERE x.termin_id = t.id AND x.status IN ('wartet', 'gewaehlt', 'laeuft', 'fertig'))`) as any[];
    for (const z of zeilen) {
      const nummer = nummerVon(z);
      if (!nummer) { zaehl("termin", { ok: false, grund: "keine Nummer" }); continue; }
      const ew = await einwilligungGueltig(nummerKern(nummer), Number(z.person_id), lauf)
        ?? await einwilligungMerken({ personId: Number(z.person_id), nummer, art: "rueckruf_buchung", wortlaut: "Kunde hat einen Anruf bei Aras gebucht (Terminbuchung).", quelleArt: "termin", quelleId: String(z.termin_id), erteiltAm: new Date() }, lauf);
      const beginn = new Date(z.beginn);
      zaehl("termin", await planEinreihen({
        personId: Number(z.person_id), nummer, spielart: "termin", grund: `Termin bei Aras ${beginn.toLocaleString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" })} Uhr`,
        erzeugtVon: "takt", fruehAb: new Date(beginn.getTime() - 60_000), spaetBis: new Date(beginn.getTime() + 30 * 60_000), terminId: Number(z.termin_id), einwilligungId: ew.id, anlassAm: beginn,
      }, lauf));
    }
  }

  // 1b. Willkommen nach Antrag (Go-live 20.10.2026): EINMAL je Vertrag, 20 Minuten nach der Unterschrift (im Fenster), sonst zum
  //     nächsten Fensterbeginn — höchstens 24 h danach, später nie (spaet_bis). Vertragsabwicklung: nur Onboarding, kein LEXR-Tor.
  if (an("willkommen")) {
    try {
      const zeilen = (await lauf.unsafe(`
        SELECT * FROM (${willkommenSql()}) w
         WHERE NOT (w.${WILLKOMMEN_NEIN.map(([k]) => k).join(" OR w.")})
           AND NOT EXISTS (SELECT 1 FROM fiaon_aras_plan x WHERE x.spielart = 'willkommen' AND x.ref = w.ref)
         ORDER BY w.angenommen_am LIMIT 100`)) as any[];
      for (const z of zeilen) {
        const nummer = nummerVon(z);
        if (!nummer) { zaehl("willkommen", { ok: false, grund: "keine Nummer" }); continue; }
        const am = new Date(z.angenommen_am);
        zaehl("willkommen", await planEinreihen({
          personId: Number(z.person_id), ref: z.ref, nummer, spielart: "willkommen", grund: "Antrag unterschrieben — Willkommen", erzeugtVon: "takt",
          fruehAb: new Date(Math.max(Date.now(), am.getTime() + WILLKOMMEN_AB_MINUTEN * 60_000)), spaetBis: new Date(am.getTime() + WILLKOMMEN_BIS_STUNDEN * 3600_000), anlassAm: am,
        }, lauf));
      }
    } catch (e) { zaehl("willkommen", { ok: false, grund: `Fehler: ${String((e as Error)?.message ?? e).slice(0, 30)}` }); }
  }

  // 2. Zuruf-JA / Antrag-Kästchen / Antrag-Knopf / Meta-Kästchen: frische Einwilligung + Antrag abgeschickt, unbezahlt
  if (an("zuruf")) {
    const zeilen = (await lauf`
      SELECT e.id AS einwilligung_id, e.art, e.erteilt_am, e.person_id, ${lauf.unsafe(PERSON_NUMMER_SQL)}, a.ref, a.created_at AS antrag_am
        FROM fiaon_telefon_einwilligung e
        JOIN fiaon_persons p ON p.id = e.person_id
        JOIN LATERAL (SELECT a.ref, a.created_at FROM fiaon_applications a WHERE a.person_id = p.id AND a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL
                        AND ${lauf.unsafe(abgeschicktSql("a"))} AND COALESCE(a.payment_status, '') IN ('pending_payment', 'pending', 'unpaid', '', 'expired') AND a.claimed_paid_at IS NULL
                      ORDER BY a.created_at DESC LIMIT 1) a ON TRUE
       WHERE e.widerrufen_am IS NULL AND e.art = ANY(${grenzen.regel.zurufNurNachricht ? ["zuruf_whatsapp", "zuruf_mail"] : ["zuruf_whatsapp", "zuruf_mail", "antrag_kaestchen", "antrag_knopf", "meta_kaestchen"]})
         AND e.erteilt_am > NOW() - INTERVAL '24 hours'
         AND ${lauf.unsafe(echtePersonSql("p"))} AND NOT ${lauf.unsafe(globalKundeSql("p.id"))} AND NOT COALESCE(p.is_blocked, FALSE)
         AND NOT EXISTS (SELECT 1 FROM fiaon_aras_plan x WHERE x.einwilligung_id = e.id)`) as any[];
    for (const z of zeilen) {
      const nummer = nummerVon(z);
      if (!nummer) { zaehl("zuruf", { ok: false, grund: "keine Nummer" }); continue; }
      const frisch = (Date.now() - new Date(z.antrag_am).getTime()) < STUFE_B_FRISCH_STUNDEN * 3600_000;
      const grund = z.art === "antrag_kaestchen" || z.art === "antrag_knopf" ? (frisch ? "antrag_frisch" : "Antrag mit Kästchen") : z.art === "meta_kaestchen" ? "Lead mit Kästchen" : "JA per Nachricht";
      zaehl("zuruf", await planEinreihen({
        personId: Number(z.person_id), ref: z.ref, nummer, spielart: "zuruf", grund, erzeugtVon: "takt",
        fruehAb: new Date(), spaetBis: new Date(Date.now() + 4 * 3600_000), einwilligungId: Number(z.einwilligung_id), anlassAm: new Date(z.erteilt_am),
      }, lauf));
    }
  }

  // 3. Stufe A — Zahlung gemeldet, nicht gebucht (frischeste zuerst, höchstens 14 Tage alt)
  if (an("stufe_a")) {
    const zeilen = (await lauf`
      SELECT a.ref, a.claimed_paid_at, ${lauf.unsafe(PERSON_NUMMER_SQL)}
        FROM fiaon_applications a JOIN fiaon_persons p ON p.id = a.person_id
       WHERE a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL AND a.archived_at IS NULL
         AND (a.payment_status = 'claimed_paid' OR (a.claimed_paid_at IS NOT NULL AND COALESCE(a.payment_status, '') NOT IN ('paid', 'completed', 'cancelled', 'refunded')))
         AND a.claimed_paid_at > NOW() - make_interval(days => ${STUFE_A_GEMELDET_TAGE})
         AND ${lauf.unsafe(echtePersonSql("p"))} AND NOT ${lauf.unsafe(globalKundeSql("p.id"))}
       ORDER BY a.claimed_paid_at DESC LIMIT 200`) as any[];
    for (const z of zeilen) {
      const nummer = nummerVon(z);
      if (!nummer) continue;
      zaehl("stufe_a", await planEinreihen({
        personId: Number(z.person_id), ref: z.ref, nummer, spielart: "stufe_a", grund: "Zahlung gemeldet, nicht gebucht", erzeugtVon: "takt",
        fruehAb: abBesterStunde("stufe_a"), spaetBis: fensterEnde("stufe_a", einst), anlassAm: new Date(z.claimed_paid_at), einmalProTag: true,
      }, lauf));
    }
  }

  // 4. Rate fällig — heute/morgen und Tag 3/10/20 nach Fälligkeit; nie nach Vertragsende, nie bei Abo-/Mahnstopp
  if (an("rate")) {
    // Stufe 1: nur Tag 1–3 nach Fälligkeit; sonst morgen/heute fällig und die Raten-Takte.
    const tage = grenzen.regel.rateTage ? [...grenzen.regel.rateTage] : [-1, 0, ...einst.ratenTakte.map(Number)];
    const zeilen = (await lauf.unsafe(`
      SELECT r.id AS rate_id, r.rate_nr, r.betrag_cents, r.faellig_am::date::text AS faellig, a.ref, ${PERSON_NUMMER_SQL},
             (CURRENT_DATE - r.faellig_am::date)::int AS tage
        FROM fiaon_abo_raten r
        JOIN fiaon_applications a ON a.ref = r.ref AND a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL
        JOIN fiaon_persons p ON p.id = a.person_id
       WHERE r.status = 'offen' AND r.storniert_am IS NULL AND r.bezahlt_am IS NULL
         AND ${ERINNERBARE_BESTELLUNG_SQL("a")} AND a.abo_gestoppt_am IS NULL AND a.mahnstopp_am IS NULL
         AND NOT ${RATE_NACH_ENDE_SQL_FUER("a", "r")}
         AND (CURRENT_DATE - r.faellig_am::date) IN (${tage.filter((x) => Number.isFinite(x)).join(",") || "3"})
         AND ${echtePersonSql("p")} AND NOT ${globalKundeSql("p.id")}
       ORDER BY r.betrag_cents DESC LIMIT 300`)) as any[];
    for (const z of zeilen) {
      const nummer = nummerVon(z);
      if (!nummer) continue;
      const tage = Number(z.tage);
      const grund = tage < 0 ? `Rate ${z.rate_nr} morgen fällig` : tage === 0 ? `Rate ${z.rate_nr} heute fällig` : `Rate ${z.rate_nr} seit ${tage} Tagen überfällig`;
      zaehl("rate", await planEinreihen({
        personId: Number(z.person_id), ref: z.ref, nummer, spielart: "rate", grund, erzeugtVon: "takt", rateId: Number(z.rate_id),
        betragCents: Number(z.betrag_cents ?? 0), fruehAb: abBesterStunde("rate"), spaetBis: fensterEnde("rate", einst), anlassAm: new Date(`${z.faellig}T09:00:00+02:00`), einmalProTag: true,
      }, lauf));
    }
  }

  // 5. Zusage nachfassen — Tag nach dem zugesagten Datum, nur ohne Buchung
  if (an("zusage")) {
    const zeilen = (await lauf`
      SELECT cl.promised_date, cl.ref, ${lauf.unsafe(PERSON_NUMMER_SQL)}
        FROM fiaon_contact_log cl
        JOIN fiaon_applications a ON a.ref = cl.ref AND a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL
        JOIN fiaon_persons p ON p.id = a.person_id
       WHERE cl.type = 'result' AND cl.outcome = 'erreicht_zahlt_am' AND cl.voided_at IS NULL
         AND (cl.promised_date AT TIME ZONE 'Europe/Berlin')::date = ${heute}::date - 1
         AND NOT EXISTS (SELECT 1 FROM fiaon_abo_raten r WHERE r.ref = a.ref AND r.bezahlt_am > cl.created_at)
         AND (COALESCE(a.payment_status, '') <> 'paid' OR EXISTS (SELECT 1 FROM fiaon_abo_raten r WHERE r.ref = a.ref AND r.status = 'offen' AND r.storniert_am IS NULL AND r.faellig_am <= CURRENT_DATE))
         AND ${lauf.unsafe(echtePersonSql("p"))} AND NOT ${lauf.unsafe(globalKundeSql("p.id"))}
       ORDER BY cl.created_at DESC LIMIT 200`) as any[];
    for (const z of zeilen) {
      const nummer = nummerVon(z);
      if (!nummer) continue;
      zaehl("zusage", await planEinreihen({
        personId: Number(z.person_id), ref: z.ref, nummer, spielart: "zusage", grund: "Zusage von gestern nachfassen", erzeugtVon: "takt",
        fruehAb: abBesterStunde("zusage"), spaetBis: fensterEnde("zusage", einst), anlassAm: new Date(z.promised_date), einmalProTag: true,
      }, lauf));
    }
  }

  // 6. Stufe B kalt, Lead frisch, Rückholung — nur eingeschaltet (LEXR) und nur mit gültiger Einwilligung (planEinreihen prüft)
  if (an("stufe_b")) {
    const zeilen = (await lauf`
      SELECT a.ref, a.created_at AS antrag_am, ${lauf.unsafe(PERSON_NUMMER_SQL)}
        FROM fiaon_applications a JOIN fiaon_persons p ON p.id = a.person_id
       WHERE a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL AND a.archived_at IS NULL AND COALESCE(a.ist_entwurf, FALSE) = FALSE
         AND ${lauf.unsafe(abgeschicktSql("a"))} AND COALESCE(a.payment_status, '') IN ('pending_payment', 'pending', 'unpaid', '', 'expired') AND a.claimed_paid_at IS NULL
         AND a.created_at > NOW() - INTERVAL '30 days' AND NOT COALESCE(p.is_blocked, FALSE) AND p.werbung_gesperrt_am IS NULL
         AND ${lauf.unsafe(echtePersonSql("p"))} AND NOT ${lauf.unsafe(globalKundeSql("p.id"))}
       ORDER BY a.created_at DESC LIMIT 200`) as any[];
    for (const z of zeilen) {
      const nummer = nummerVon(z);
      if (!nummer) continue;
      zaehl("stufe_b", await planEinreihen({
        personId: Number(z.person_id), ref: z.ref, nummer, spielart: "stufe_b", grund: "Antrag abgeschickt, unbezahlt", erzeugtVon: "takt",
        fruehAb: abBesterStunde("stufe_b"), spaetBis: fensterEnde("stufe_b", einst), anlassAm: new Date(z.antrag_am), einmalProTag: true,
      }, lauf));
    }
  }

  return { eingereiht, uebersprungen, verfallen: verfallenR.length };
}

// ── Tagesplan und Lernvorschlag ────────────────────────────────────────────
export async function tagesplan(tag: string, lauf: Lauf = sqlPool): Promise<Tagesplan> {
  await arasSchema(lauf);
  const t = /^\d{4}-\d{2}-\d{2}$/.test(tag) ? tag : berlinToday();
  const geplant = (await lauf`
    SELECT spielart, EXTRACT(HOUR FROM frueh_ab AT TIME ZONE 'Europe/Berlin')::int AS h, COUNT(*)::int AS n
      FROM fiaon_aras_plan WHERE (frueh_ab AT TIME ZONE 'Europe/Berlin')::date = ${t}::date GROUP BY 1, 2`) as any[];
  const anrufe = (await lauf`
    SELECT spielart, EXTRACT(HOUR FROM created_at AT TIME ZONE 'Europe/Berlin')::int AS h,
           COUNT(*)::int AS gewaehlt, COUNT(*) FILTER (WHERE angenommen_am IS NOT NULL)::int AS erreicht,
           COUNT(*) FILTER (WHERE sekunden_sitzung >= 30)::int AS gespraeche
      FROM fiaon_aras_anruf WHERE (created_at AT TIME ZONE 'Europe/Berlin')::date = ${t}::date GROUP BY 1, 2`) as any[];
  const stunden: Tagesplan["stunden"] = [];
  for (let h = 8; h < 20; h++) {
    const je: Record<string, { geplant: number; gewaehlt: number; erreicht: number; gespraeche: number }> = {};
    for (const s of SPIELARTEN) {
      const g = geplant.find((x) => x.spielart === s && Number(x.h) === h);
      const a = anrufe.find((x) => x.spielart === s && Number(x.h) === h);
      if (g || a) je[s] = { geplant: Number(g?.n ?? 0), gewaehlt: Number(a?.gewaehlt ?? 0), erreicht: Number(a?.erreicht ?? 0), gespraeche: Number(a?.gespraeche ?? 0) };
    }
    stunden.push({ h, je });
  }
  const pool = (await lauf`SELECT spielart, COUNT(*) FILTER (WHERE status = 'wartet')::int AS pool,
                                   COUNT(*) FILTER (WHERE (created_at AT TIME ZONE 'Europe/Berlin')::date = ${t}::date)::int AS geplant
                              FROM fiaon_aras_plan GROUP BY 1`) as any[];
  const mengen: Tagesplan["mengen"] = {};
  for (const s of SPIELARTEN) { const z = pool.find((x) => x.spielart === s); mengen[s] = { pool: Number(z?.pool ?? 0), geplant: Number(z?.geplant ?? 0) }; }
  return { tag: t, stunden, mengen, lernvorschlag: await lernvorschlag(lauf) };
}

export async function lernvorschlag(lauf: Lauf = sqlPool): Promise<Lernvorschlag | null> {
  await arasSchema(lauf);
  const einst = await arasEinstellungenLesen(false, lauf);
  if (!einst.lernenAn) return null;
  const zeilen = (await lauf`
    SELECT spielart, EXTRACT(HOUR FROM created_at AT TIME ZONE 'Europe/Berlin')::int AS h, COUNT(*)::int AS n,
           COUNT(*) FILTER (WHERE sekunden_sitzung >= 30)::int AS gespraeche
      FROM fiaon_aras_anruf WHERE created_at > NOW() - INTERVAL '28 days' GROUP BY 1, 2 HAVING COUNT(*) >= 5`) as any[];
  if (zeilen.length < 6) return null;
  const stunden: Record<string, number[]> = {};
  const texte: string[] = [];
  for (const s of SPIELARTEN) {
    const je = zeilen.filter((z) => z.spielart === s);
    if (je.length < 3) continue;
    const quote: Record<number, number> = {};
    for (const z of je) quote[Number(z.h)] = Number(z.gespraeche) / Math.max(1, Number(z.n));
    const beste = Object.entries(quote).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([h]) => Number(h)).sort((a, b) => a - b);
    stunden[s] = beste;
    texte.push(`${s}: beste Stunden ${beste.map((h) => `${h}–${h + 1}`).join(", ")} Uhr`);
  }
  if (!texte.length) return null;
  return { erzeugtAm: new Date().toISOString(), text: `Aus 28 Tagen: ${texte.join(" · ")}. Nur ein Vorschlag — die Fenster änderst du selbst.`, stunden };
}

/** Rechtsgrund und Fenster für einen Eintrag kurz prüfen (für Wähler und Oberfläche). */
export function eintragFensterOffen(spielart: Spielart, land: Land, einst: ArasEinstellungen, jetzt = new Date()) {
  return fensterOffen(spielart, land, jetzt, { fenster: einst.fenster });
}
export { reihen };
