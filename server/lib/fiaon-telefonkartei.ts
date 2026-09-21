// ═══════════════════════════════════════════════════════════════════════════
// TELEFONKARTEI — der Server hinter Justins Anrufseite (21.09.2026, E-201)
//
// Justin: „Ich habe heute selbst telefoniert und es lief hervorragend." Er
// wollte eine eigene, simple Seite: alle Kunden als Kartei, Anrufen mit
// Kontakt-Speichern am iPhone, und für jeden Kunden vier Wege — Rechnung
// (Mail mit PDF + WhatsApp), nicht erreicht (Mail + WhatsApp mit seinem
// Kalender), stornieren, später anrufen.
//
// WAS HIER STEHT, IST FAST NUR VERDRAHTUNG
// Jede Wirkung läuft über den Weg, den das Haus dafür schon hat — sonst sähen
// die Mitarbeiter etwas anderes als Justin:
//   · Stufe A/B/C        priority_tier (tier.ts); „Rate offen" = RATE_FAELLIG_SQL
//   · Reihung            EREIGNIS_SQL — dieselbe Frische wie die Arbeitsliste
//   · Nummer             waehlbareNummer (fiaon-telefon.ts)
//   · Preis              katalogpreisCents — Katalog vor amount_due (E-181)
//   · Ergebnis           ergebnisNachbereiten (fiaon-kontakt-ergebnis.ts); für
//                        Leads logLead + dieselbe Statuszuordnung wie die
//                        Lead-Route
//   · Rechnung           rechnungStellen (nurBuchen), dann freitextVersenden mit
//                        der Rechnung als PDF — Wand, Protokoll, Akte inklusive
//   · Storno             kuendigungSetzen (Hausregel E-092/E-159), Vertriebs-
//                        und Werbesperre, Lead-Stopp, Termin-Absage
//
// JUSTIN WIRD NIE BETREUER
// Einträge im Verlauf tragen agent_id NULL und seinen Namen. `betreuerVon` und
// die Provisionsregel zählen nur Einträge MIT agent_id — ein Anruf des Chefs
// nimmt keinem Mitarbeiter den Kunden oder die Provision (wie E-124).
//
// „ZAHLT GLEICH" HEISST: ZUSAGE MORGEN
// Das Haus-Ergebnis „erreicht — zahlt sofort" setzt die Zusage auf HEUTE; damit
// stünde der Kunde Minuten nach Justins Anruf ganz oben in der Liste seines
// Betreuers („Zusage fällig") und bekäme den zweiten Anruf. Deshalb hier
// „zahlt am" mit morgen: Kommt das Geld, ist er ohnehin raus.
// ═══════════════════════════════════════════════════════════════════════════

import { sqlPool } from "./db-pool";
import { waehlbareNummer } from "./fiaon-telefon";
import { katalogpreisCents } from "./fiaon-massgebliche-bestellung";
import { terminTokenErzeugen } from "./fiaon-termine";
import { produktkategorieSql } from "./fiaon-produktkategorie";
import { berlinPlusTage } from "./fiaon-time";
import { ABBRECHER_STATUS } from "./tier";
import { boniLateralSql, BONI_SPALTEN_SQL, boniEingangAusZeile } from "./fiaon-boni-ampel";
import { boniAmpel } from "@shared/fiaon-boni-ampel";
import { absoluteUrl } from "../fiaon-base-url";
import { signInvoiceUrl } from "../fiaon-invoice";
import { kurzFenster } from "@shared/fiaon-erreichbarkeit";
import { KUNDENSTATUS, ETIKETT_FRIST_ABGELAUFEN } from "@shared/fiaon-kundenstatus";
import { paket as katalogPaket } from "@shared/fiaon-pakete";
import { terminArtAusQuelle } from "@shared/fiaon-termin-art";
import { ERGEBNIS_TEXT, istErgebnis } from "@shared/fiaon-kontakt-ergebnis-liste";
import {
  KARTEI_SEITE, KARTEI_LAGE_TEXT, datumKurz, euro, euroGanz,
  mailRechnung, mailNichtErreicht, mailAntrag, hatRechnungsweg, hatAntragsweg,
  type KarteiGruppe, type KarteiKarte, type KarteiLage, type KarteiZahlung,
  type KarteiErgebnis, type KarteiRueckruf, type KarteiTermin,
} from "@shared/fiaon-telefonkartei";

/** Der Antrag für Leads — dieselbe Adresse wie im Wissen der KI (shared/fiaon-wissen.ts). */
export const ANTRAG_URL = () => absoluteUrl("/antrag");

/** Rechnungslinks in WhatsApp halten 30 Tage (die Vorgabe von 72 Stunden ist für Mails an Make). */
const RECHNUNG_LINK_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Doppelklick-Schutz: dieselbe Handlung am selben Menschen innerhalb dieser Minuten zählt einmal. */
const DOPPELT_MINUTEN = 10;

/** „Nicht erreicht"-Mails höchstens alle drei Tage je Mensch — das ist Service, keine Kampagne. */
const NICHT_ERREICHT_MAIL_ABSTAND_TAGE = 3;

// ── Tabellen ────────────────────────────────────────────────────────────────
// Zwei kleine eigene Tabellen: die Storno-Liste (mit dem Vorher-Stand, damit
// „Zurückholen" genau das zurücknimmt, was der Storno getan hat) und Justins
// Rückrufe. KEINE neue Spalte an fiaon_persons — ALTER TABLE nimmt dort eine
// Sperre auf die meistgelesene Tabelle des Hauses (tier.ts, „30 Sekunden").
let tabellenBereit: Promise<void> | null = null;
export function karteiTabellen(): Promise<void> {
  if (!tabellenBereit) {
    tabellenBereit = (async () => {
      await sqlPool`
        CREATE TABLE IF NOT EXISTS fiaon_telefonkartei_storno (
          person_id INTEGER PRIMARY KEY,
          am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          grund TEXT,
          durch TEXT,
          durch_agent_id INTEGER,
          stand JSONB NOT NULL DEFAULT '{}'::jsonb,
          zurueck_am TIMESTAMPTZ,
          zurueck_durch TEXT
        )`;
      await sqlPool`
        CREATE TABLE IF NOT EXISTS fiaon_telefonkartei_rueckruf (
          id SERIAL PRIMARY KEY,
          person_id INTEGER NOT NULL,
          am TIMESTAMPTZ NOT NULL,
          notiz TEXT,
          angelegt_am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          angelegt_durch TEXT,
          erledigt_am TIMESTAMPTZ
        )`;
      await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_tk_rueckruf_offen_idx ON fiaon_telefonkartei_rueckruf (am) WHERE erledigt_am IS NULL`;
    })().catch((e) => { tabellenBereit = null; throw e; });
  }
  return tabellenBereit;
}

/** JSONB tolerant lesen — der erste Radar-Test lag doppelt verpackt (siehe fiaon-radar.ts). */
function ausJson<T>(v: unknown, vorgabe: T): T {
  if (v == null) return vorgabe;
  if (typeof v === "string") { try { return JSON.parse(v) as T; } catch { return vorgabe; } }
  return v as T;
}

const text = (v: unknown): string => String(v ?? "").trim();
const iso = (v: unknown): string | null => {
  if (v == null || v === "") return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return isNaN(d.getTime()) ? null : d.toISOString();
};
const tagText = (v: unknown): string | null => {
  if (v == null || v === "") return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const m = String(v).match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
};

/** Der Name, der im Verlauf und unter den Nachrichten steht. */
export async function akteurName(agentId: number | null | undefined): Promise<string> {
  if (agentId) {
    const [a] = (await sqlPool`SELECT name FROM fiaon_agents WHERE id = ${agentId}`.catch(() => [])) as any[];
    if (text(a?.name)) return text(a.name);
  }
  return "Justin Schwarzott";
}

// ── Die Abfrage ─────────────────────────────────────────────────────────────

const ABBRECHER_SQL = ABBRECHER_STATUS.map((s) => `'${s}'`).join(", ");
const KATEGORIE_A = produktkategorieSql("a");

interface Filter {
  gruppe: KarteiGruppe;
  suche?: string;
  gesperrte?: boolean;
  personId?: number;
}

async function vertriebSql(): Promise<{ RATE_FAELLIG_SQL: string; EREIGNIS_SQL: string }> {
  const m = await import("../routes/fiaon-office-vertrieb");
  return { RATE_FAELLIG_SQL: m.RATE_FAELLIG_SQL, EREIGNIS_SQL: m.EREIGNIS_SQL };
}

function suchBedingung(suche: string) {
  const s = suche.trim().slice(0, 80);
  if (!s) return sqlPool``;
  const muster = `%${s.replace(/[%_\\]/g, (z) => `\\${z}`)}%`;
  const ziffern = s.replace(/\D/g, "");
  // Die letzten acht Ziffern: „0171 1234567" und „+49 171 1234567" sind dieselbe Nummer.
  const tel = ziffern.length >= 6 ? `%${ziffern.slice(-8)}` : null;
  return sqlPool`AND (
      (COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')) ILIKE ${muster}
      OR COALESCE(p.contact_name, '') ILIKE ${muster}
      OR COALESCE(p.primary_email, '') ILIKE ${muster}
      ${tel ? sqlPool`OR regexp_replace(COALESCE(p.primary_phone, ''), '\\D', '', 'g') LIKE ${tel}` : sqlPool``}
      OR EXISTS (SELECT 1 FROM fiaon_applications sa WHERE sa.person_id = p.id AND sa.merged_into IS NULL AND (
           sa.ref ILIKE ${muster} OR COALESCE(sa.payment_reference, '') ILIKE ${muster}
           OR COALESCE(sa.email, '') ILIKE ${muster}
           OR (COALESCE(sa.first_name, '') || ' ' || COALESCE(sa.last_name, '')) ILIKE ${muster}
           ${tel ? sqlPool`OR regexp_replace(COALESCE(sa.phone, ''), '\\D', '', 'g') LIKE ${tel}` : sqlPool``}))
      OR EXISTS (SELECT 1 FROM fiaon_leads sl WHERE sl.person_id = p.id AND (
           COALESCE(sl.email, '') ILIKE ${muster}
           OR (COALESCE(sl.vorname, '') || ' ' || COALESCE(sl.nachname, '')) ILIKE ${muster}
           ${tel ? sqlPool`OR regexp_replace(COALESCE(sl.telefon, ''), '\\D', '', 'g') LIKE ${tel}` : sqlPool``}))
    )`;
}

function gruppenBedingung(gruppe: KarteiGruppe, RATE_FAELLIG_SQL: string) {
  switch (gruppe) {
    case "A": return sqlPool`AND s.person_id IS NULL AND p.priority_tier = 1`;
    case "B": return sqlPool`AND s.person_id IS NULL AND p.priority_tier = 2`;
    case "C": return sqlPool`AND s.person_id IS NULL AND p.priority_tier = 3 AND p.tier_reason = 'nur_lead'`;
    case "rate": return sqlPool`AND s.person_id IS NULL AND COALESCE(p.priority_tier, 0) = 0 AND ${sqlPool.unsafe(RATE_FAELLIG_SQL)}`;
    case "storniert": return sqlPool`AND s.person_id IS NOT NULL`;
    default: return sqlPool`AND s.person_id IS NULL`;
  }
}

async function zeilenLaden(f: Filter, grenze: number, versatz: number): Promise<any[]> {
  await karteiTabellen();
  const { RATE_FAELLIG_SQL, EREIGNIS_SQL } = await vertriebSql();
  // SUCHE FINDET JEDEN (21.09.2026, Justin: „Wenn ich ‚Justin Schwarzott' suche,
  // kommt nichts — mich muss man aber finden."). Seine Datensätze sind als
  // Testkonto markiert (Name eines Mitarbeiters), andere sind gesperrt oder
  // storniert. Die Reiter bleiben ohne sie; wer einen Namen sucht, will genau
  // diesen Menschen — die Karte trägt dann ihr Schild (Testkonto, Sperre, Storno).
  const sucht = !!String(f.suche ?? "").trim();
  const einzeln = f.personId ? sqlPool`AND p.id = ${f.personId}` : sqlPool``;
  const gruppe = f.personId || sucht ? sqlPool`` : gruppenBedingung(f.gruppe, RATE_FAELLIG_SQL);
  const test = f.personId || sucht ? sqlPool`` : sqlPool`AND p.ist_test_am IS NULL`;
  // Gesperrte blendet die Kartei aus, solange Justin sie nicht ausdrücklich will —
  // eine Vertriebssperre heißt meistens: Der Mensch hat Nein gesagt.
  const sperre = f.personId || sucht || f.gruppe === "storniert" || f.gesperrte ? sqlPool`` : sqlPool`AND NOT COALESCE(p.is_blocked, FALSE)`;
  const ordnung = f.gruppe === "storniert"
    ? sqlPool`ORDER BY b.storno_am DESC NULLS LAST, b.id DESC`
    : sqlPool`ORDER BY b.ereignis_am DESC NULLS LAST, b.id DESC`;
  return (await sqlPool`
    WITH basis AS (
      SELECT p.id, p.first_name, p.last_name, p.contact_name, p.anrede, p.primary_email, p.primary_phone,
             p.street, p.zip, p.city, p.country, p.priority_tier, p.tier_reason, p.is_blocked, p.werbung_gesperrt_am,
             p.unreachable_count, p.promised_payment_date, p.assigned_agent_id, p.created_at,
             (p.ist_test_am IS NOT NULL) AS testfall,
             ${sqlPool.unsafe(EREIGNIS_SQL)} AS ereignis_am,
             s.am AS storno_am, s.grund AS storno_grund, s.durch AS storno_durch
      FROM fiaon_persons p
      LEFT JOIN fiaon_telefonkartei_storno s ON s.person_id = p.id AND s.zurueck_am IS NULL
      WHERE p.merged_into_person_id IS NULL
        ${test} ${einzeln} ${gruppe} ${sperre} ${suchBedingung(f.suche ?? "")}
    ),
    -- ERST DIE SEITE, DANN DIE KARTEN (21.09.2026, E-202): Die Reihenfolge
    -- hängt nur an der Basis (Ereignis bzw. Storno-Datum). Vorher liefen alle
    -- Nachschlagungen unten für JEDEN Menschen der Liste (~5.000 unter „Alle“),
    -- und erst danach wurden 26 ausgewählt — mit den drei Verbindungen der
    -- Boni-Ampel 502 ms statt 278 ms. Jetzt werden nur die Karten der Seite
    -- nachgeschlagen. Jede Verbindung unten ist ein LEFT JOIN auf höchstens
    -- eine Zeile — die Menge und ihre Reihenfolge bleiben dieselben.
    seite AS (
      SELECT * FROM basis b ${ordnung} LIMIT ${grenze} OFFSET ${versatz}
    )
    SELECT b.*,
           o.ref AS o_ref, o.type AS o_type, o.pack_key AS o_pack, o.pack_name AS o_pack_name,
           o.payment_status AS o_status, o.payment_reference AS o_referenz, o.amount_due AS o_betrag,
           o.wanted_limit AS o_wunsch, o.claimed_paid_at AS o_gemeldet, o.created_at AS o_am,
           o.payment_due_date AS o_frist, o.phone AS o_phone, o.phone_country_code AS o_vorwahl,
           o.contact_phone AS o_contact_phone, o.email AS o_email, o.city AS o_city,
           o.erreichbarkeit AS o_erreichbarkeit, o.first_name AS o_vorname, o.last_name AS o_nachname,
           pa.ref AS pa_ref, pa.type AS pa_type, pa.pack_key AS pa_pack, pa.pack_name AS pa_pack_name,
           pa.wanted_limit AS pa_wunsch, pa.phone AS pa_phone, pa.phone_country_code AS pa_vorwahl,
           pa.contact_phone AS pa_contact_phone, pa.email AS pa_email, pa.city AS pa_city,
           pa.first_name AS pa_vorname, pa.last_name AS pa_nachname,
           r.rate_nr, r.betrag_cents AS r_betrag, r.faellig_am AS r_faellig, r.zahlungsreferenz AS r_referenz,
           r.ref AS r_ref, r.anzahl AS r_anzahl,
           x.ref AS x_ref,
           l.id AS l_id, l.vorname AS l_vorname, l.nachname AS l_nachname, l.email AS l_email,
           l.telefon AS l_telefon, l.quelle AS l_quelle, l.kampagne AS l_kampagne, l.erstellt_am AS l_am,
           ag.name AS betreuer,
           k.am AS k_am, k.von AS k_von, k.ergebnis AS k_ergebnis,
           t.beginn AS t_beginn, t.quelle AS t_quelle, tag.name AS t_bei,
           rr.am AS rr_am,
           ${sqlPool.unsafe(BONI_SPALTEN_SQL)}
    FROM seite b
    -- Die offene Bestellung: erst eine echte Rechnung, dann ein fertiger Antrag
    -- ohne Rechnung; ein Paket vor der Auskunft; nie ein Firmenauftrag (Global).
    LEFT JOIN LATERAL (
      SELECT a.* FROM fiaon_applications a
      WHERE a.person_id = b.id AND a.merged_into IS NULL AND a.archived_at IS NULL
        AND a.gdpr_deleted_at IS NULL AND a.cancelled_at IS NULL
        AND (a.payment_status IN ('pending_payment', 'claimed_paid', 'expired')
             OR (a.payment_status = 'pending' AND COALESCE(a.status, '') NOT IN (${sqlPool.unsafe(ABBRECHER_SQL)})))
        AND ${sqlPool.unsafe(KATEGORIE_A)} <> 'global'
      ORDER BY (${sqlPool.unsafe(KATEGORIE_A)} = 'auskunft') ASC,
               (a.payment_status IN ('pending_payment', 'claimed_paid', 'expired')) DESC,
               a.created_at DESC
      LIMIT 1) o ON TRUE
    LEFT JOIN LATERAL (
      SELECT a.* FROM fiaon_applications a
      WHERE a.person_id = b.id AND a.merged_into IS NULL AND a.archived_at IS NULL
        AND a.payment_status = 'paid' AND ${sqlPool.unsafe(KATEGORIE_A)} = 'konto'
      ORDER BY a.created_at DESC LIMIT 1) pa ON TRUE
    -- Die älteste fällige, offene Rate zuerst — sie ist zuerst zu zahlen.
    LEFT JOIN LATERAL (
      SELECT r.rate_nr, r.betrag_cents, r.faellig_am, r.zahlungsreferenz, r.ref,
             COUNT(*) OVER () AS anzahl
      FROM fiaon_abo_raten r JOIN fiaon_applications ar ON ar.ref = r.ref
      WHERE ar.person_id = b.id AND ar.merged_into IS NULL
        AND r.status = 'offen' AND r.storniert_am IS NULL
        AND r.faellig_am <= (NOW() AT TIME ZONE 'Europe/Berlin')::date
      ORDER BY r.faellig_am ASC, r.rate_nr ASC LIMIT 1) r ON TRUE
    LEFT JOIN LATERAL (
      SELECT a.ref FROM fiaon_applications a
      WHERE a.person_id = b.id AND a.merged_into IS NULL
      ORDER BY a.created_at DESC LIMIT 1) x ON TRUE
    LEFT JOIN LATERAL (
      SELECT l.* FROM fiaon_leads l WHERE l.person_id = b.id ORDER BY l.erstellt_am DESC LIMIT 1) l ON TRUE
    LEFT JOIN fiaon_agents ag ON ag.id = b.assigned_agent_id
    LEFT JOIN LATERAL (
      SELECT y.am, y.von, y.ergebnis FROM (
        SELECT cl.created_at AS am, cl.agent_name AS von, cl.outcome AS ergebnis
        FROM fiaon_contact_log cl JOIN fiaon_applications ca ON ca.ref = cl.ref
        WHERE ca.person_id = b.id AND cl.type = 'result' AND cl.voided_at IS NULL
        UNION ALL
        SELECT ll.created_at, ll.agent_name, ll.outcome
        FROM fiaon_lead_log ll JOIN fiaon_leads cl2 ON cl2.id = ll.lead_id
        WHERE cl2.person_id = b.id AND ll.type = 'result'
      ) y ORDER BY y.am DESC LIMIT 1) k ON TRUE
    LEFT JOIN LATERAL (
      SELECT t.beginn, t.quelle, t.agent_id FROM fiaon_termine t
      WHERE t.person_id = b.id AND t.status = 'gebucht' AND t.beginn > NOW()
      ORDER BY t.beginn LIMIT 1) t ON TRUE
    LEFT JOIN fiaon_agents tag ON tag.id = t.agent_id
    LEFT JOIN LATERAL (
      SELECT rr.am FROM fiaon_telefonkartei_rueckruf rr
      WHERE rr.person_id = b.id AND rr.erledigt_am IS NULL ORDER BY rr.am LIMIT 1) rr ON TRUE
    ${sqlPool.unsafe(boniLateralSql("b"))}
    ${ordnung}
  `) as any[];
}

// ── Aus einer Zeile wird eine Karte ────────────────────────────────────────

let packLimits: Record<string, number> | null = null;
async function rahmenFuer(packKey: unknown): Promise<number | null> {
  if (!packLimits) packLimits = (await import("../routes/fiaon-antrag")).PACK_LIMITS;
  const k = text(packKey).toLowerCase();
  return k && packLimits[k] != null ? Number(packLimits[k]) : null;
}

function lageVon(z: any): KarteiLage {
  if (z.storno_am) return "storniert";
  const tier = z.priority_tier == null ? null : Number(z.priority_tier);
  if (tier === 1) return "A";
  if (tier === 2) return "B";
  if (tier === 3) return text(z.tier_reason) === "nur_lead" ? "C" : "abbrecher";
  if (tier === 0) return z.r_referenz ? "rate" : "bezahlt";
  if (tier === -1) return "ausgeschlossen";
  return z.o_ref ? "B" : "C";
}

function standVon(lage: KarteiLage, z: any): string {
  switch (lage) {
    case "A": return `${KUNDENSTATUS.zahlung_gemeldet.text} (${KUNDENSTATUS.zahlung_gemeldet.zusatz})`;
    case "B": {
      if (text(z.o_status) === "pending") return "Antrag fertig — noch keine Rechnung gestellt";
      const frist = z.o_frist ? new Date(z.o_frist) : null;
      const vorbei = text(z.o_status) === "expired" || (!!frist && frist.getTime() < Date.now());
      return `${KUNDENSTATUS.rechnung_offen.text}${vorbei ? ` · ${ETIKETT_FRIST_ABGELAUFEN}` : ""}`;
    }
    case "C": return "Lead ohne Antrag";
    case "rate": {
      const n = Number(z.r_anzahl || 1);
      return `Rate ${z.rate_nr} über ${euro(Number(z.r_betrag))} offen · fällig seit ${datumKurz(tagText(z.r_faellig))}${n > 1 ? ` · ${n} Raten offen` : ""}`;
    }
    case "bezahlt": return KUNDENSTATUS.bezahlt.text;
    case "abbrecher": return "Antrag abgebrochen";
    case "ausgeschlossen": return "Ausgeschlossen — Bestellung storniert oder erstattet";
    case "storniert": return `Storniert am ${datumKurz(tagText(z.storno_am))}${z.storno_durch ? ` durch ${z.storno_durch}` : ""}`;
  }
}

function ergebnisText(outcome: unknown): string | null {
  const o = text(outcome);
  if (!o) return null;
  if (istErgebnis(o)) return ERGEBNIS_TEXT[o];
  const lead: Record<string, string> = {
    erreicht_interesse: "Erreicht — Interesse", erreicht_kein_interesse: "Erreicht — kein Interesse",
  };
  return lead[o] ?? o.replace(/_/g, " ");
}

async function karteBauen(z: any): Promise<KarteiKarte> {
  const lage = lageVon(z);
  const vorname = text(z.first_name) || text(z.o_vorname) || text(z.pa_vorname) || text(z.l_vorname);
  const nachname = text(z.last_name) || text(z.o_nachname) || text(z.pa_nachname) || text(z.l_nachname);
  const name = [vorname, nachname].filter(Boolean).join(" ") || text(z.contact_name) || `Unbekannt #${z.id}`;
  const tel = waehlbareNummer([
    { nummer: z.o_phone, vorwahl: z.o_vorwahl }, { nummer: z.o_contact_phone },
    { nummer: z.pa_phone, vorwahl: z.pa_vorwahl }, { nummer: z.pa_contact_phone },
    { nummer: z.primary_phone }, { nummer: z.l_telefon },
  ], z.country);

  // Welche Bestellung trägt das Paket? Offen vor bezahlt — außer bei „Rate offen".
  const offenZuerst = lage !== "rate" && lage !== "bezahlt" && !!z.o_ref;
  const pRef = offenZuerst ? z.o_ref : (z.pa_ref || z.o_ref);
  const pType = offenZuerst ? z.o_type : (z.pa_ref ? z.pa_type : z.o_type);
  const pKey = offenZuerst ? z.o_pack : (z.pa_ref ? z.pa_pack : z.o_pack);
  const kat = katalogPaket(pKey);
  const preis = pRef ? katalogpreisCents({ ref: pRef, type: pType, pack_key: pKey }) : null;
  const istAuskunft = text(pType) === "schufa" || text(pRef).startsWith("FIAON-SCHUFA-");
  const paketAnzeige = pRef && (kat || istAuskunft)
    ? { key: text(pKey), label: istAuskunft ? "Bonitätsauskunft" : kat!.label, preisCents: preis }
    : null;

  let zahlung: KarteiZahlung | null = null;
  if (lage === "rate" && z.r_referenz) {
    const referenz = text(z.r_referenz);
    zahlung = {
      art: "rate", referenz, betragCents: z.r_betrag != null ? Number(z.r_betrag) : null,
      rateNr: z.rate_nr != null ? Number(z.rate_nr) : null, faelligAm: tagText(z.r_faellig),
      zahlungsseite: absoluteUrl(`/zahlung/${encodeURIComponent(referenz)}`),
      rechnungLink: null, nochKeineRechnung: false,
    };
  } else if (lage !== "storniert" && z.o_ref && text(z.o_referenz)) {
    const referenz = text(z.o_referenz);
    const betrag = katalogpreisCents({ ref: z.o_ref, type: z.o_type, pack_key: z.o_pack })
      ?? (z.o_betrag != null && Number(z.o_betrag) > 0 ? Math.round(Number(z.o_betrag) * 100) : null);
    zahlung = {
      art: "bestellung", referenz, betragCents: betrag, rateNr: null, faelligAm: tagText(z.o_frist),
      zahlungsseite: absoluteUrl(`/zahlung/${encodeURIComponent(referenz)}`),
      rechnungLink: signInvoiceUrl(referenz, RECHNUNG_LINK_TTL_MS),
      nochKeineRechnung: text(z.o_status) === "pending",
    };
  }

  const wunsch = offenZuerst ? z.o_wunsch : (z.pa_wunsch ?? z.o_wunsch);
  const aktenRef = text(z.o_ref) || text(z.r_ref) || text(z.pa_ref) || text(z.x_ref) || null;
  return {
    personId: Number(z.id),
    vorname, nachname, name, lage,
    stand: standVon(lage, z),
    ereignisAm: iso(z.ereignis_am),
    telefonAnzeige: tel.anzeige, telefonWaehlbar: tel.waehlbar, telefonHinweis: tel.hinweis,
    email: text(z.primary_email) || text(z.o_email) || text(z.pa_email) || text(z.l_email) || null,
    ort: text(z.city) || text(z.o_city) || text(z.pa_city) || null,
    paket: paketAnzeige,
    wunschlimitEuro: wunsch != null && Number(wunsch) > 0 ? Number(wunsch) : null,
    rahmenEuro: await rahmenFuer(pKey),
    zahlung,
    ref: aktenRef,
    leadId: z.l_id != null ? Number(z.l_id) : null,
    lead: z.l_id != null ? { quelle: text(z.l_quelle) || null, kampagne: text(z.l_kampagne) || null, am: iso(z.l_am) } : null,
    betreuer: text(z.betreuer) || null,
    kontakt: {
      am: iso(z.k_am), von: text(z.k_von) || null, ergebnis: ergebnisText(z.k_ergebnis),
      nichtErreicht: Number(z.unreachable_count || 0),
    },
    termin: z.t_beginn ? { beginn: iso(z.t_beginn)!, art: terminArtAusQuelle(z.t_quelle).text, bei: text(z.t_bei) || null } : null,
    erreichbarkeit: kurzFenster(z.o_erreichbarkeit),
    zusage: tagText(z.promised_payment_date),
    gesperrt: !!z.is_blocked,
    werbungGesperrt: !!z.werbung_gesperrt_am,
    testfall: !!z.testfall,
    terminLink: absoluteUrl(`/justin?k=${terminTokenErzeugen(Number(z.id))}`),
    akteId: aktenRef ?? (z.l_id != null ? `lead-${Number(z.l_id)}` : null),
    akteLink: aktenRef
      ? `/chef/s/akte?id=${encodeURIComponent(aktenRef)}`
      : (z.l_id != null ? `/chef/s/akte?id=lead-${Number(z.l_id)}` : null),
    storno: z.storno_am ? { am: iso(z.storno_am)!, grund: text(z.storno_grund) || null, durch: text(z.storno_durch) || null } : null,
    rueckrufAm: iso(z.rr_am),
    // E-202: FIAONs eigene Einschätzung — dieselbe Rechnung wie in der Akte der Mitarbeiter.
    ampel: boniAmpel(boniEingangAusZeile(z, { strasse: z.street, plz: z.zip, ort: z.city, land: z.country })),
  };
}

// ── Liste, Zähler, eine Karte ───────────────────────────────────────────────

export async function karteiListe(f: Filter & { seite?: number }): Promise<{ karten: KarteiKarte[]; mehr: boolean }> {
  const seite = Math.max(0, Math.min(400, Math.floor(Number(f.seite) || 0)));
  const zeilen = await zeilenLaden(f, KARTEI_SEITE + 1, seite * KARTEI_SEITE);
  const karten: KarteiKarte[] = [];
  for (const z of zeilen.slice(0, KARTEI_SEITE)) karten.push(await karteBauen(z));
  return { karten, mehr: zeilen.length > KARTEI_SEITE };
}

export async function karteEinzeln(personId: number): Promise<KarteiKarte | null> {
  const [z] = await zeilenLaden({ gruppe: "alle", personId }, 1, 0);
  return z ? karteBauen(z) : null;
}

export async function karteiZaehler(gesperrte: boolean): Promise<Record<KarteiGruppe, number> & { gesperrt: number }> {
  await karteiTabellen();
  const { RATE_FAELLIG_SQL } = await vertriebSql();
  const offen = gesperrte ? sqlPool`TRUE` : sqlPool`NOT COALESCE(p.is_blocked, FALSE)`;
  const [z] = (await sqlPool`
    SELECT
      COUNT(*) FILTER (WHERE s.person_id IS NULL AND ${offen})::int AS alle,
      COUNT(*) FILTER (WHERE s.person_id IS NULL AND ${offen} AND p.priority_tier = 1)::int AS a,
      COUNT(*) FILTER (WHERE s.person_id IS NULL AND ${offen} AND p.priority_tier = 2)::int AS b,
      COUNT(*) FILTER (WHERE s.person_id IS NULL AND ${offen} AND p.priority_tier = 3 AND p.tier_reason = 'nur_lead')::int AS c,
      COUNT(*) FILTER (WHERE s.person_id IS NULL AND ${offen} AND COALESCE(p.priority_tier, 0) = 0
                         AND ${sqlPool.unsafe(RATE_FAELLIG_SQL)})::int AS rate,
      COUNT(*) FILTER (WHERE s.person_id IS NOT NULL)::int AS storniert,
      COUNT(*) FILTER (WHERE s.person_id IS NULL AND COALESCE(p.is_blocked, FALSE))::int AS gesperrt
    FROM fiaon_persons p
    LEFT JOIN fiaon_telefonkartei_storno s ON s.person_id = p.id AND s.zurueck_am IS NULL
    WHERE p.merged_into_person_id IS NULL AND p.ist_test_am IS NULL
  `) as any[];
  return {
    alle: Number(z?.alle || 0), A: Number(z?.a || 0), B: Number(z?.b || 0), C: Number(z?.c || 0),
    rate: Number(z?.rate || 0), storniert: Number(z?.storniert || 0), gesperrt: Number(z?.gesperrt || 0),
  };
}

// ── Die Kontaktkarte fürs iPhone ────────────────────────────────────────────
// vCard 3.0 — die Fassung, die iOS ohne Umweg als „Neuen Kontakt erstellen"
// zeigt. Der Zusatz „(FIAON)" steht im Namenssuffix: So zeigt das iPhone bei
// einem Rückruf „Max Mustermann (FIAON)" — Justin weiß sofort, wer anruft.
function vEsc(v: unknown): string {
  return String(v ?? "").replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

export function vcardText(k: KarteiKarte): string {
  const heute = new Date().toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric" });
  const notiz = [
    `FIAON · ${KARTEI_LAGE_TEXT[k.lage]}`,
    k.paket ? `Paket: ${k.paket.label}${k.paket.preisCents != null ? ` (${euro(k.paket.preisCents)})` : ""}` : null,
    k.wunschlimitEuro != null ? `Wunschlimit: ${euroGanz(k.wunschlimitEuro)}` : null,
    k.zahlung ? `Verwendungszweck: ${k.zahlung.referenz}` : (k.ref ? `Bestellung: ${k.ref}` : null),
    k.betreuer ? `Betreuer: ${k.betreuer}` : null,
    `Gespeichert am ${heute} aus der Telefonkartei`,
  ].filter(Boolean).join("\n");
  const vor = k.vorname || (!k.nachname ? k.name : "");
  const zeilen = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${vEsc(k.nachname)};${vEsc(vor)};;;(FIAON)`,
    `FN:${vEsc(k.name)} (FIAON)`,
    "ORG:FIAON Kunde",
    k.telefonWaehlbar ? `TEL;TYPE=CELL,VOICE:${k.telefonWaehlbar}` : null,
    k.email ? `EMAIL;TYPE=INTERNET:${vEsc(k.email)}` : null,
    k.ort ? `ADR;TYPE=HOME:;;;${vEsc(k.ort)};;;` : null,
    `NOTE:${vEsc(notiz)}`,
    k.akteLink ? `URL:${absoluteUrl(k.akteLink)}` : null,
    "CATEGORIES:FIAON",
    "END:VCARD",
  ];
  return zeilen.filter(Boolean).join("\r\n") + "\r\n";
}

export function vcardDateiname(k: KarteiKarte): string {
  const roh = `${k.name} FIAON`.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9 ._-]/g, "").trim();
  return `${roh.replace(/\s+/g, "-") || `Kontakt-${k.personId}`}.vcf`;
}

// ── Die vier Fälle ──────────────────────────────────────────────────────────

export interface ErgebnisAntwort {
  ok: boolean;
  meldung: string;
  mail: { ok: boolean; text: string } | null;
  doppelt?: boolean;
  rueckruf?: KarteiRueckruf | null;
}

// mailProtokoll schreibt die Nutzlast als JSON-TEXT in die jsonb-Spalte (jsonb_typeof =
// 'string', gemessen: alle 134 Freitext-Zeilen). Gelesen wird deshalb beides.
const NUTZLAST_SQL = `(CASE WHEN jsonb_typeof(payload) = 'string' THEN (payload #>> '{}')::jsonb ELSE payload END)`;

async function schonGetan(personId: number, kennung: string, akteur: string, minuten: number): Promise<boolean> {
  const [m] = (await sqlPool`
    SELECT 1 AS da FROM fiaon_mail_log
    WHERE person_id = ${personId} AND event = 'frei_text' AND ausgeloest_von = ${akteur}
      AND status = 'versandt'
      AND ${sqlPool.unsafe(NUTZLAST_SQL)}->>'kennung' = ${kennung}
      AND created_at > NOW() - make_interval(mins => ${minuten}::int)
    LIMIT 1`.catch(() => [])) as any[];
  return !!m;
}

type Ausgang = "nicht_erreicht" | "zahlt" | "interesse";

/**
 * Das Ergebnis über den Hausweg buchen. Für Bestellungen die eine Kette
 * (ergebnisNachbereiten), für reine Leads dieselbe Zuordnung wie die Lead-Route.
 *   zahlt       → „zahlt am" morgen (siehe Kopf: keine Zusage für heute)
 *   interesse   → „erreicht — sonstiges" (Wiedervorlage in drei Tagen)
 *   nicht_erreicht → Zähler +1, Wiedervorlage morgen, Nicht-erreicht-Automatik
 * Ein zweiter Klick binnen zehn Minuten zählt nicht noch einmal.
 */
async function ergebnisBuchen(k: KarteiKarte, ausgang: Ausgang, notiz: string, akteur: string): Promise<string> {
  const haus = ausgang === "nicht_erreicht" ? "nicht_erreicht" : ausgang === "zahlt" ? "erreicht_zahlt_am" : "erreicht_sonstiges";
  const lead = ausgang === "nicht_erreicht" ? "nicht_erreicht" : "erreicht_interesse";
  const [schon] = (await sqlPool`
    SELECT 1 AS da FROM fiaon_contact_log cl JOIN fiaon_applications a ON a.ref = cl.ref
    WHERE a.person_id = ${k.personId} AND cl.agent_id IS NULL AND cl.agent_name = ${akteur}
      AND cl.outcome = ${haus} AND cl.created_at > NOW() - make_interval(mins => ${DOPPELT_MINUTEN}::int)
    UNION ALL
    SELECT 1 FROM fiaon_lead_log ll JOIN fiaon_leads l ON l.id = ll.lead_id
    WHERE l.person_id = ${k.personId} AND ll.agent_id IS NULL AND ll.agent_name = ${akteur}
      AND ll.outcome = ${lead} AND ll.created_at > NOW() - make_interval(mins => ${DOPPELT_MINUTEN}::int)
    LIMIT 1`.catch(() => [])) as any[];
  if (schon) return "Schon festgehalten.";

  if (k.ref) {
    const { ergebnisNachbereiten } = await import("./fiaon-kontakt-ergebnis");
    const r = await ergebnisNachbereiten({
      ref: k.ref, personId: k.personId, ergebnis: haus, notiz,
      zusageDatum: haus === "erreicht_zahlt_am" ? berlinPlusTage(1) : null,
      akteur: { id: null, name: akteur }, herkunft: "telefon",
    });
    return r.meldung;
  }
  if (k.leadId) {
    // Dieselbe Zuordnung wie POST /agent/leads/:id/contact-result (LEAD_OUTCOMES):
    // beides → „kontaktiert"; nicht erreicht ist in vier Stunden wieder dran.
    const { logLead } = await import("../routes/fiaon-leads");
    await logLead(k.leadId, { id: null, name: akteur }, "result", { outcome: lead, note: notiz });
    await sqlPool`
      UPDATE fiaon_leads SET status = 'kontaktiert', letzter_kontakt_am = NOW(), opened_at = NULL,
             requeue_at = ${lead === "nicht_erreicht" ? sqlPool`NOW() + INTERVAL '4 hours'` : sqlPool`NULL`},
             updated_at = NOW()
      WHERE id = ${k.leadId} AND status NOT IN ('konvertiert')`;
    return lead === "nicht_erreicht" ? "Nicht erreicht — festgehalten." : "Erreicht — festgehalten.";
  }
  return "Kein Verlauf möglich — weder Bestellung noch Lead.";
}

async function rueckrufeErledigen(personId: number): Promise<void> {
  await sqlPool`UPDATE fiaon_telefonkartei_rueckruf SET erledigt_am = NOW() WHERE person_id = ${personId} AND erledigt_am IS NULL AND am <= NOW() + INTERVAL '30 minutes'`.catch(() => {});
}

/**
 * Ein Knopf der Karte. Die WhatsApp öffnet die SEITE (sie braucht den Klick
 * des Menschen); hier passiert alles, was ein Server tun muss.
 */
export async function ergebnisFesthalten(personId: number, art: KarteiErgebnis, akteur: string, opts: { am?: string | null; notiz?: string | null } = {}): Promise<ErgebnisAntwort> {
  await karteiTabellen();
  const k = await karteEinzeln(personId);
  if (!k) return { ok: false, meldung: "Kunde nicht gefunden.", mail: null };
  if (k.lage === "storniert") return { ok: false, meldung: "Storniert — erst zurückholen.", mail: null };
  const { freitextVersenden } = await import("../routes/fiaon-mail");

  if (art === "rueckruf") {
    const am = opts.am ? new Date(opts.am) : null;
    if (!am || isNaN(am.getTime())) return { ok: false, meldung: "Bitte eine Uhrzeit wählen.", mail: null };
    if (am.getTime() < Date.now() - 5 * 60_000) return { ok: false, meldung: "Die Zeit liegt in der Vergangenheit.", mail: null };
    if (am.getTime() > Date.now() + 60 * 86_400_000) return { ok: false, meldung: "Höchstens 60 Tage im Voraus.", mail: null };
    const notiz = text(opts.notiz).slice(0, 300) || null;
    const [r] = (await sqlPool`
      INSERT INTO fiaon_telefonkartei_rueckruf (person_id, am, notiz, angelegt_durch)
      VALUES (${personId}, ${am}, ${notiz}, ${akteur}) RETURNING id, am`) as any[];
    const wann = am.toLocaleString("de-DE", { timeZone: "Europe/Berlin", weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    // Ein Vermerk für den Betreuer — KEIN Haus-Ergebnis „Rückruf": das würde den
    // Kunden zur selben Minute in die Liste des Betreuers stellen (RUECKRUF_SQL),
    // und er bekäme zwei Anrufe.
    if (k.ref) {
      await sqlPool`
        INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note, created_at)
        VALUES (${k.ref}, ${personId}, NULL, ${akteur}, 'note',
                ${`${akteur} hat den Kunden erreicht — passt gerade nicht. ${akteur} ruft selbst zurück: ${wann} Uhr.${notiz ? ` ${notiz}` : ""}`}, NOW())`.catch(() => {});
    } else if (k.leadId) {
      const { logLead } = await import("../routes/fiaon-leads");
      await logLead(k.leadId, { id: null, name: akteur }, "note", { note: `${akteur} ruft selbst zurück: ${wann} Uhr.${notiz ? ` ${notiz}` : ""}` }).catch(() => {});
    }
    return {
      ok: true, meldung: `Rückruf ${wann} Uhr gespeichert.`, mail: null,
      rueckruf: { id: Number(r.id), personId, name: k.name, am: iso(r.am)!, notiz, telefonWaehlbar: k.telefonWaehlbar, telefonAnzeige: k.telefonAnzeige },
    };
  }

  if (art === "rechnung") {
    const z = k.zahlung;
    if (!z || !hatRechnungsweg(k)) return { ok: false, meldung: "Keine offene Zahlung — hier gibt es keine Rechnung.", mail: null };
    if (await schonGetan(personId, "tk_rechnung", akteur, DOPPELT_MINUTEN)) {
      return { ok: true, doppelt: true, meldung: "Die Rechnung ist schon unterwegs (vor weniger als zehn Minuten).", mail: null };
    }
    // Ein fertiger Antrag ohne Rechnung wird erst gebucht (Betrag, Frist, „Rechnung
    // offen") — ohne die Haus-Mail, denn gleich geht Justins Mail mit der Rechnung raus.
    if (z.art === "bestellung" && z.nochKeineRechnung && k.ref) {
      const { rechnungStellen } = await import("./fiaon-rechnung-stellen");
      const b = await rechnungStellen(k.ref, { akteur, agentId: null, nurBuchen: true, aufAnweisung: true });
      if (!b.ok) return { ok: false, meldung: `Rechnung konnte nicht gestellt werden: ${b.grund}`, mail: null };
    }
    let mail: ErgebnisAntwort["mail"] = null;
    const m = mailRechnung(k, akteur);
    if (m && k.email) {
      const v = await freitextVersenden({ personId, betreff: m.betreff, text: m.text, anhangReferenz: z.referenz, akteur, kennung: "tk_rechnung" });
      mail = v.ok ? { ok: true, text: `Mail mit Rechnung (PDF) an ${v.empfaenger ?? k.email}` } : { ok: false, text: `Mail nicht verschickt: ${v.error}` };
    } else {
      mail = { ok: false, text: "Keine E-Mail hinterlegt — nur WhatsApp." };
    }
    const meldung = await ergebnisBuchen(k, "zahlt",
      `${akteur} hat den Kunden erreicht — zahlt sofort (Zusage für morgen gesetzt). Zahlungsdaten per WhatsApp${mail.ok ? " und Rechnung per Mail" : ""} geschickt (Telefonkartei).`,
      akteur);
    await rueckrufeErledigen(personId);
    const { personTierAktualisieren } = await import("./tier");
    await personTierAktualisieren(sqlPool, { personId }).catch((e) => console.error("[TELEFONKARTEI] Stufe:", e));
    return { ok: true, meldung, mail };
  }

  if (art === "antrag") {
    if (!hatAntragsweg(k)) return { ok: false, meldung: "Hier gibt es schon eine Bestellung — nimm „Rechnung schicken\".", mail: null };
    if (await schonGetan(personId, "tk_antrag", akteur, DOPPELT_MINUTEN)) {
      return { ok: true, doppelt: true, meldung: "Der Antrags-Link ist schon unterwegs.", mail: null };
    }
    let mail: ErgebnisAntwort["mail"] = null;
    if (k.email) {
      const m = mailAntrag(k, akteur, ANTRAG_URL());
      const v = await freitextVersenden({ personId, betreff: m.betreff, text: m.text, akteur, kennung: "tk_antrag" });
      mail = v.ok ? { ok: true, text: `Mail mit Antrags-Link an ${v.empfaenger ?? k.email}` } : { ok: false, text: `Mail nicht verschickt: ${v.error}` };
    } else {
      mail = { ok: false, text: "Keine E-Mail hinterlegt — nur WhatsApp." };
    }
    const meldung = await ergebnisBuchen(k, "interesse",
      `${akteur} hat den Kunden erreicht — Interesse, Antrags-Link per WhatsApp${mail.ok ? " und Mail" : ""} geschickt (Telefonkartei).`,
      akteur);
    await rueckrufeErledigen(personId);
    return { ok: true, meldung, mail };
  }

  // art === "nicht_erreicht"
  let mail: ErgebnisAntwort["mail"] = null;
  const kurzZuvor = await schonGetan(personId, "tk_nicht_erreicht", akteur, NICHT_ERREICHT_MAIL_ABSTAND_TAGE * 24 * 60);
  if (kurzZuvor) {
    mail = { ok: false, text: `Keine zweite Mail — die letzte ist keine ${NICHT_ERREICHT_MAIL_ABSTAND_TAGE} Tage alt.` };
  } else if (!k.email) {
    mail = { ok: false, text: "Keine E-Mail hinterlegt — nur WhatsApp." };
  } else if (k.werbungGesperrt) {
    mail = { ok: false, text: "Werbesperre — keine Mail, nur WhatsApp." };
  } else {
    const m = mailNichtErreicht(k, akteur);
    const v = await freitextVersenden({ personId, betreff: m.betreff, text: m.text, akteur, kennung: "tk_nicht_erreicht" });
    mail = v.ok ? { ok: true, text: `Mail mit deinem Kalender an ${v.empfaenger ?? k.email}` } : { ok: false, text: `Mail nicht verschickt: ${v.error}` };
  }
  const meldung = await ergebnisBuchen(k, "nicht_erreicht",
    `${akteur} hat angerufen — nicht erreicht. WhatsApp${mail.ok ? " und Mail" : ""} mit seinem persönlichen Kalender geschickt (Telefonkartei).`,
    akteur);
  return { ok: true, meldung, mail };
}

// ── Stornieren und Zurückholen ──────────────────────────────────────────────

interface StornoStand {
  bestellungen: {
    ref: string; weg: string; ok: boolean;
    vorher: { payment_status: string | null; cancelled_at: string | null; mahnstopp_am: string | null };
    kulanzRaten?: number[];
  }[];
  leads: {
    id: number;
    vorher: { dismissed_at: string | null; dismissed_reason: string | null; dismissed_by: number | null; strecke_stopp: string | null; strecke_stopp_am: string | null; in_sequence: boolean | null };
  }[];
  person: { is_blocked: boolean; werbung_gesperrt_am: string | null; gesperrt: boolean };
  termine: number[];
  mails: string[];
}

export interface StornoAntwort {
  ok: boolean;
  meldung: string;
  punkte: string[];
  bereits?: boolean;
}

/**
 * Stornieren — mit Justins Worten: „storniert werden, auf eine eigene Liste
 * kommen und nirgendwo mehr erscheinen." Jede Wirkung über den Hausweg:
 *   · unbezahlte Bestellung → kuendigungSetzen (Weg 1: storniert, keine
 *     Forderung, Mahnstopp) — die Mitarbeiter sehen „Storniert"
 *   · bezahlter Vertrag → kuendigungSetzen nach Hausregel (die laufende Rate
 *     bleibt fällig; „Kulanz" beendet sofort) + Bestätigungsmail
 *   · Lead → aussortiert (Grund „sonstiges"), Lead-Strecke gestoppt
 *   · Person → Vertriebssperre (nicht bei zahlenden Kunden, Regel 06.09.),
 *     Werbesperre, keine Wiedervorlage; gebuchte Termine abgesagt
 * Der Vorher-Stand steht in der Storno-Zeile — „Zurückholen" nimmt genau das
 * zurück.
 */
export async function stornieren(personId: number, opts: { grund: string; kulanz: boolean; akteur: string; akteurId: number | null }): Promise<StornoAntwort> {
  await karteiTabellen();
  const [p] = (await sqlPool`
    SELECT id, is_blocked, werbung_gesperrt_am FROM fiaon_persons
    WHERE id = ${personId} AND merged_into_person_id IS NULL`) as any[];
  if (!p) return { ok: false, meldung: "Kunde nicht gefunden.", punkte: [] };
  const [schon] = (await sqlPool`SELECT 1 AS da FROM fiaon_telefonkartei_storno WHERE person_id = ${personId} AND zurueck_am IS NULL`) as any[];
  if (schon) return { ok: true, bereits: true, meldung: "War schon storniert.", punkte: [] };

  const grund = text(opts.grund).slice(0, 300) || "Kunde hat am Telefon storniert";
  const grundVoll = `${grund} (${opts.akteur}, Telefonkartei)`;
  const stand: StornoStand = {
    bestellungen: [], leads: [],
    person: { is_blocked: !!p.is_blocked, werbung_gesperrt_am: iso(p.werbung_gesperrt_am), gesperrt: false },
    termine: [], mails: [],
  };
  // Zuerst die Zeile — bricht unterwegs etwas ab, steht der Mensch trotzdem in
  // „Storniert" und lässt sich zurückholen.
  await sqlPool`
    INSERT INTO fiaon_telefonkartei_storno (person_id, am, grund, durch, durch_agent_id, stand, zurueck_am, zurueck_durch)
    VALUES (${personId}, NOW(), ${grund}, ${opts.akteur}, ${opts.akteurId}, ${sqlPool.json(stand as any)}, NULL, NULL)
    ON CONFLICT (person_id) DO UPDATE SET am = NOW(), grund = EXCLUDED.grund, durch = EXCLUDED.durch,
      durch_agent_id = EXCLUDED.durch_agent_id, stand = EXCLUDED.stand, zurueck_am = NULL, zurueck_durch = NULL`;

  const punkte: string[] = [];
  const { kuendigungSetzen } = await import("./fiaon-kuendigung");
  const { bestaetigungSenden } = await import("../routes/fiaon-kuendigung");

  // 1. Bestellungen — offene und laufende, nie ein Firmenauftrag (Global hat eigene Regeln).
  const bestellungen = (await sqlPool`
    SELECT a.ref, a.payment_status, a.cancelled_at, a.mahnstopp_am, a.pack_name
    FROM fiaon_applications a
    WHERE a.person_id = ${personId} AND a.merged_into IS NULL AND a.archived_at IS NULL AND a.gdpr_deleted_at IS NULL
      AND ${sqlPool.unsafe(KATEGORIE_A)} <> 'global'
      AND (a.payment_status IN ('pending', 'pending_payment', 'claimed_paid', 'expired')
           OR (a.payment_status = 'paid' AND (a.vertrag_ende_am IS NULL OR a.vertrag_ende_am > NOW())
               AND (a.gekuendigt_am IS NULL OR a.kuendigung_zurueckgenommen_am IS NOT NULL)))
    ORDER BY a.created_at`) as any[];
  for (const b of bestellungen) {
    const bezahlt = String(b.payment_status) === "paid";
    const kulanzRaten = bezahlt && opts.kulanz
      ? ((await sqlPool`SELECT id FROM fiaon_abo_raten WHERE ref = ${b.ref} AND status = 'offen'`) as any[]).map((r) => Number(r.id))
      : undefined;
    const erg = await kuendigungSetzen(String(b.ref), { quelle: "telefon", grund: grundVoll, sofort: bezahlt && opts.kulanz });
    stand.bestellungen.push({
      ref: String(b.ref), weg: erg.weg, ok: erg.ok,
      vorher: { payment_status: b.payment_status ?? null, cancelled_at: iso(b.cancelled_at), mahnstopp_am: iso(b.mahnstopp_am) },
      ...(kulanzRaten ? { kulanzRaten } : {}),
    });
    const paketName = text(b.pack_name).split("\n")[0] || String(b.ref);
    if (!erg.ok) punkte.push(`${paketName}: nicht storniert — ${erg.grund}`);
    else if (erg.weg === "storno_unbezahlt") punkte.push(`${paketName}: Bestellung storniert, keine Zahlungserinnerungen mehr`);
    else if (erg.weg === "letzte_rate") punkte.push(`${paketName}: gekündigt — Rate ${erg.letzteRateNr} bleibt fällig, ${erg.stornierteRaten} spätere entfallen`);
    else if (erg.weg === "kulanz_sofort") punkte.push(`${paketName}: sofort beendet (Kulanz), ${erg.stornierteRaten} offene Rate(n) entfallen`);
    else if (erg.weg === "sofort_beendet") punkte.push(`${paketName}: Vertrag beendet (alles bezahlt)`);
    if (erg.ok && bezahlt && erg.weg !== "bereits") {
      const gesendet = await bestaetigungSenden(String(b.ref)).catch(() => false);
      if (gesendet) stand.mails.push(String(b.ref));
    }
  }

  // 2. Leads — aus jeder Liste, die Lead-Mails hören auf.
  const leads = (await sqlPool`
    SELECT id, dismissed_at, dismissed_reason, dismissed_by, strecke_stopp, strecke_stopp_am, in_sequence
    FROM fiaon_leads WHERE person_id = ${personId} AND COALESCE(status, '') <> 'konvertiert'`) as any[];
  if (leads.length) {
    const { logLead } = await import("../routes/fiaon-leads");
    for (const l of leads) {
      stand.leads.push({
        id: Number(l.id),
        vorher: {
          dismissed_at: iso(l.dismissed_at), dismissed_reason: l.dismissed_reason ?? null, dismissed_by: l.dismissed_by ?? null,
          strecke_stopp: l.strecke_stopp ?? null, strecke_stopp_am: iso(l.strecke_stopp_am), in_sequence: l.in_sequence ?? null,
        },
      });
      await sqlPool`
        UPDATE fiaon_leads SET dismissed_at = COALESCE(dismissed_at, NOW()), dismissed_reason = COALESCE(dismissed_reason, 'sonstiges'),
               strecke_stopp = COALESCE(strecke_stopp, 'hand'), strecke_stopp_am = COALESCE(strecke_stopp_am, NOW()),
               in_sequence = FALSE, opened_at = NULL, updated_at = NOW()
        WHERE id = ${l.id}`;
      await logLead(Number(l.id), { id: null, name: opts.akteur }, "system", { note: `Storniert durch ${opts.akteur} (Telefonkartei): ${grund}. Rückholbar in der Telefonkartei unter „Storniert".` }).catch(() => {});
    }
    punkte.push(leads.length === 1 ? "Lead aus allen Listen genommen, Lead-Mails gestoppt" : `${leads.length} Leads aus allen Listen genommen, Lead-Mails gestoppt`);
  }

  // 3. Die Person — Sperre nur, wo das Haus sie zulässt.
  const { istZahlenderKunde } = await import("./fiaon-kunde-aktiv");
  const zahlend = await istZahlenderKunde(personId);
  stand.person.gesperrt = !zahlend;
  await sqlPool`
    UPDATE fiaon_persons SET
      is_blocked = ${zahlend ? sqlPool`is_blocked` : sqlPool`TRUE`},
      werbung_gesperrt_am = COALESCE(werbung_gesperrt_am, NOW()),
      follow_up_date = NULL, promised_payment_date = NULL, updated_at = NOW()
    WHERE id = ${personId}`;
  punkte.push(zahlend
    ? "Zahlender Kunde: keine Vertriebssperre (Hausregel) — die offene Rate läuft bis zum Vertragsende weiter"
    : "In keiner Anrufliste mehr, keine Werbung");

  // 4. Gebuchte Termine absagen — der Zuständige erfährt es (terminAbsagen meldet).
  const termine = (await sqlPool`
    SELECT id, storno_token FROM fiaon_termine WHERE person_id = ${personId} AND status = 'gebucht' AND beginn > NOW()`) as any[];
  if (termine.length) {
    const { terminAbsagen } = await import("./fiaon-termine");
    for (const t of termine) {
      const r = await terminAbsagen(String(t.storno_token), "kunde").catch(() => ({ ok: false }));
      if (r.ok) stand.termine.push(Number(t.id));
    }
    if (stand.termine.length) punkte.push(`${stand.termine.length} gebuchte${stand.termine.length === 1 ? "r Termin" : " Termine"} abgesagt`);
  }
  await sqlPool`UPDATE fiaon_telefonkartei_rueckruf SET erledigt_am = NOW() WHERE person_id = ${personId} AND erledigt_am IS NULL`.catch(() => {});

  // 5. Stufe neu rechnen — sonst stünde der Kunde bis zum Tageslauf in den Listen.
  const { personTierAktualisieren } = await import("./tier");
  await personTierAktualisieren(sqlPool, { personId }).catch((e) => console.error("[TELEFONKARTEI] Stufe:", e));

  await sqlPool`UPDATE fiaon_telefonkartei_storno SET stand = ${sqlPool.json(stand as any)} WHERE person_id = ${personId} AND zurueck_am IS NULL`;
  if (stand.mails.length) punkte.push("Kündigungsbestätigung per Mail verschickt");
  return { ok: true, meldung: "Storniert.", punkte };
}

export async function stornoZuruecknehmen(personId: number, akteur: string): Promise<StornoAntwort> {
  await karteiTabellen();
  const [s] = (await sqlPool`SELECT * FROM fiaon_telefonkartei_storno WHERE person_id = ${personId} AND zurueck_am IS NULL`) as any[];
  if (!s) return { ok: false, meldung: "Dieser Kunde ist nicht storniert.", punkte: [] };
  const stand = ausJson<StornoStand>(s.stand, { bestellungen: [], leads: [], person: { is_blocked: false, werbung_gesperrt_am: null, gesperrt: false }, termine: [], mails: [] });
  const grund = `Zurückgeholt durch ${akteur} (Telefonkartei)`;
  const punkte: string[] = [];
  const { kuendigungZuruecknehmen } = await import("./fiaon-kuendigung");

  for (const b of stand.bestellungen ?? []) {
    if (!b.ok || !["storno_unbezahlt", "letzte_rate", "sofort_beendet", "kulanz_sofort"].includes(b.weg)) continue;
    if (b.weg === "storno_unbezahlt") {
      await sqlPool`
        UPDATE fiaon_applications
           SET payment_status = ${b.vorher.payment_status || "pending_payment"}, cancelled_at = ${b.vorher.cancelled_at},
               mahnstopp_am = ${b.vorher.mahnstopp_am}, updated_at = NOW()
         WHERE ref = ${b.ref} AND payment_status = 'cancelled'`;
    }
    await kuendigungZuruecknehmen(b.ref, grund);
    if (b.weg === "kulanz_sofort" && b.kulanzRaten?.length) {
      await sqlPool`
        UPDATE fiaon_abo_raten SET status = 'offen', storniert_am = NULL, storno_grund = NULL, updated_at = NOW()
         WHERE id = ANY(${b.kulanzRaten}) AND status = 'storniert' AND storno_grund = 'kuendigung_kulanz'`;
    }
    if (b.weg !== "storno_unbezahlt") {
      await sqlPool`UPDATE fiaon_applications SET mahnstopp_am = ${b.vorher.mahnstopp_am}, kuendigung_bestaetigt_mail_am = NULL, updated_at = NOW() WHERE ref = ${b.ref}`;
    }
    punkte.push(`${b.ref}: wieder offen`);
  }

  if (stand.leads?.length) {
    const { logLead } = await import("../routes/fiaon-leads");
    for (const l of stand.leads) {
      await sqlPool`
        UPDATE fiaon_leads SET dismissed_at = ${l.vorher.dismissed_at}, dismissed_reason = ${l.vorher.dismissed_reason},
               dismissed_by = ${l.vorher.dismissed_by}, strecke_stopp = ${l.vorher.strecke_stopp},
               strecke_stopp_am = ${l.vorher.strecke_stopp_am}, in_sequence = ${l.vorher.in_sequence ?? false}, updated_at = NOW()
        WHERE id = ${l.id}`;
      await logLead(l.id, { id: null, name: akteur }, "system", { note: `${grund}.` }).catch(() => {});
    }
    punkte.push(stand.leads.length === 1 ? "Lead wieder in den Listen" : `${stand.leads.length} Leads wieder in den Listen`);
  }

  // Die Sperren nur zurücknehmen, wenn DER STORNO sie gesetzt hat.
  await sqlPool`
    UPDATE fiaon_persons SET
      is_blocked = ${stand.person.gesperrt && !stand.person.is_blocked ? sqlPool`FALSE` : sqlPool`is_blocked`},
      werbung_gesperrt_am = ${stand.person.werbung_gesperrt_am ? sqlPool`werbung_gesperrt_am` : sqlPool`NULL`},
      updated_at = NOW()
    WHERE id = ${personId}`;

  const { personTierAktualisieren } = await import("./tier");
  await personTierAktualisieren(sqlPool, { personId }).catch((e) => console.error("[TELEFONKARTEI] Stufe:", e));
  await sqlPool`UPDATE fiaon_telefonkartei_storno SET zurueck_am = NOW(), zurueck_durch = ${akteur} WHERE person_id = ${personId} AND zurueck_am IS NULL`;
  if (stand.termine?.length) punkte.push("Abgesagte Termine bleiben abgesagt — bei Bedarf neu buchen");
  return { ok: true, meldung: "Zurückgeholt.", punkte };
}

// ── Rückrufe und Termine ────────────────────────────────────────────────────

export async function rueckrufListe(): Promise<KarteiRueckruf[]> {
  await karteiTabellen();
  const zeilen = (await sqlPool`
    SELECT rr.id, rr.person_id, rr.am, rr.notiz, p.first_name, p.last_name, p.contact_name, p.primary_phone, p.country,
           (SELECT a.phone FROM fiaon_applications a WHERE a.person_id = p.id AND a.merged_into IS NULL ORDER BY a.created_at DESC LIMIT 1) AS a_phone,
           (SELECT a.phone_country_code FROM fiaon_applications a WHERE a.person_id = p.id AND a.merged_into IS NULL ORDER BY a.created_at DESC LIMIT 1) AS a_vorwahl,
           (SELECT l.telefon FROM fiaon_leads l WHERE l.person_id = p.id ORDER BY l.erstellt_am DESC LIMIT 1) AS l_telefon
    FROM fiaon_telefonkartei_rueckruf rr JOIN fiaon_persons p ON p.id = rr.person_id
    WHERE rr.erledigt_am IS NULL
    ORDER BY rr.am LIMIT 100`) as any[];
  return zeilen.map((z) => {
    const tel = waehlbareNummer([{ nummer: z.a_phone, vorwahl: z.a_vorwahl }, { nummer: z.primary_phone }, { nummer: z.l_telefon }], z.country);
    const name = [text(z.first_name), text(z.last_name)].filter(Boolean).join(" ") || text(z.contact_name) || `Unbekannt #${z.person_id}`;
    return { id: Number(z.id), personId: Number(z.person_id), name, am: iso(z.am)!, notiz: z.notiz ?? null, telefonWaehlbar: tel.waehlbar, telefonAnzeige: tel.anzeige };
  });
}

export async function rueckrufErledigt(id: number): Promise<boolean> {
  await karteiTabellen();
  const r = (await sqlPool`UPDATE fiaon_telefonkartei_rueckruf SET erledigt_am = NOW() WHERE id = ${id} AND erledigt_am IS NULL RETURNING id`) as any[];
  return r.length > 0;
}

/** Kalendereintrag für den Rückruf — das iPhone erinnert, auch wenn die Seite zu ist. */
export async function rueckrufIcs(id: number): Promise<{ name: string; ics: string } | null> {
  const [r] = (await rueckrufListe()).filter((x) => x.id === id);
  if (!r) return null;
  const stempel = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const beginn = new Date(r.am);
  const ende = new Date(beginn.getTime() + 15 * 60_000);
  const esc = (v: string) => v.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
  const seite = absoluteUrl("/chef/s/telefonkartei");
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//FIAON//Telefonkartei//DE", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:tk-rueckruf-${r.id}@fiaon.com`,
    `DTSTAMP:${stempel(new Date())}`,
    `DTSTART:${stempel(beginn)}`,
    `DTEND:${stempel(ende)}`,
    `SUMMARY:${esc(`Rückruf: ${r.name} (FIAON)`)}`,
    `DESCRIPTION:${esc([r.telefonAnzeige ? `Telefon: ${r.telefonAnzeige}` : null, r.notiz, `Telefonkartei: ${seite}`].filter(Boolean).join("\n"))}`,
    `URL:${seite}`,
    "BEGIN:VALARM", "TRIGGER:-PT5M", "ACTION:DISPLAY", `DESCRIPTION:${esc(`In 5 Minuten: ${r.name} anrufen`)}`, "END:VALARM",
    "BEGIN:VALARM", "TRIGGER:PT0M", "ACTION:DISPLAY", `DESCRIPTION:${esc(`Jetzt ${r.name} anrufen`)}`, "END:VALARM",
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n") + "\r\n";
  return { name: `Rueckruf-${r.id}.ics`, ics };
}

/**
 * Die Termine für den unteren Abschnitt. Justin (21.09.2026): „Ich will nur meine
 * sehen und erst weiter unten ALLE Termine — vorrangig die, die Leute bei mir
 * buchen." Deshalb zwei Mengen in einer Abfrage:
 *   · deine  = das Konto der Gründerseite (/justin), das eigene Chef-Konto oder
 *              ein Gründergespräch — heute (auch erledigte/verpasste) und die
 *              nächsten 60 Tage
 *   · andere = gebuchte Termine des Teams, ab zwei Stunden zurück, 21 Tage
 */
export async function termineListe(meineAgentIds: number[]): Promise<KarteiTermin[]> {
  const meine = Array.from(new Set(meineAgentIds.filter((n) => Number.isInteger(n) && n > 0)));
  const zeilen = (await sqlPool`
    WITH t0 AS (
      SELECT t.*, (t.quelle = 'gruender' OR t.agent_id = ANY(${meine})) AS meiner
      FROM fiaon_termine t
      WHERE t.status <> 'abgesagt'
        AND t.beginn >= date_trunc('day', NOW() AT TIME ZONE 'Europe/Berlin') AT TIME ZONE 'Europe/Berlin'
        AND t.beginn < NOW() + INTERVAL '60 days'
    )
    SELECT t.id, t.person_id, t.beginn, t.dauer_min, t.status, t.quelle, t.agent_id, t.notiz, t.meiner,
           ag.name AS bei, p.first_name, p.last_name, p.contact_name, p.primary_phone, p.country,
           (SELECT a.phone FROM fiaon_applications a WHERE a.person_id = p.id AND a.merged_into IS NULL ORDER BY a.created_at DESC LIMIT 1) AS a_phone,
           (SELECT a.phone_country_code FROM fiaon_applications a WHERE a.person_id = p.id AND a.merged_into IS NULL ORDER BY a.created_at DESC LIMIT 1) AS a_vorwahl
    FROM t0 t
    LEFT JOIN fiaon_persons p ON p.id = t.person_id
    LEFT JOIN fiaon_agents ag ON ag.id = t.agent_id
    WHERE t.meiner
       OR (COALESCE(p.ist_test_am IS NULL, TRUE) AND t.status = 'gebucht'
           AND t.beginn > NOW() - INTERVAL '2 hours' AND t.beginn < NOW() + INTERVAL '21 days')
    ORDER BY t.beginn LIMIT 300`) as any[];
  return zeilen.map((z) => {
    const tel = waehlbareNummer([{ nummer: z.a_phone, vorwahl: z.a_vorwahl }, { nummer: z.primary_phone }], z.country);
    const name = [text(z.first_name), text(z.last_name)].filter(Boolean).join(" ") || text(z.contact_name) || "Ohne Namen";
    return {
      id: Number(z.id), personId: z.person_id != null ? Number(z.person_id) : null, name,
      beginn: iso(z.beginn)!, dauerMin: z.dauer_min != null ? Number(z.dauer_min) : null,
      status: String(z.status), art: terminArtAusQuelle(z.quelle).text, bei: text(z.bei) || null,
      meiner: !!z.meiner,
      telefonWaehlbar: tel.waehlbar, telefonAnzeige: tel.anzeige,
      notiz: text(z.notiz).slice(0, 240) || null,
    };
  });
}
