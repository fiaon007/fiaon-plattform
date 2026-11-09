// ═══════════════════════════════════════════════════════════════════════════
// EMPFEHLUNGEN DES PARTNERS AN FIAON — DATENBANK UND WEGE (Register E-419, 22.10.2026)
// Regeln und Texte: shared/fiaon-koop-empfehlung.ts. Tabelle: db/migrations/117_koop_empfehlungen.sql (dieselbe DDL hier).
//
//   · Melden: Partner im Partnerbereich (quelle „partner“, Aufgabe an Justin) oder Leitung im Chefbüro (quelle „fiaon“).
//   · Verknüpfen: Die Leitung ordnet der Meldung die Person zu (person_id) — erst dann zählen Zahlungen.
//   · Rechnen: Zahlungen der Person aus UMSATZ_QUELLE_SQL ab der Meldung, KOOP_PROVISION_MONATE lang, ohne Durchlaufposten.
//   · Ausgezahlt: Betrag je Meldung von Hand (ausgezahlt_cents) — die Liste zeigt verdient / ausgezahlt / offen.
// Wirft nach außen nur Ergebnis-Objekte; die Partnersicht scheitert nie an dieser Liste.
//
// E-487 (09.11.2026) — Partner-Empfehlungen und Provision „perfekt“ (Befund: eine zahlende Kundin stand mit 0,00 € im
// Partnerbereich, weil die Empfehlung nie einer Person zugeordnet wurde; danach gab es keinen Weg zur Gutschrift):
//   · Fast-Track-Abzug nur, wenn der Kunde ihn wirklich gekauft hat — und nie bei „zählt mit“ (KOOP_FASTTRACK_ZAEHLT).
//   · Nachtrag: jede Gutschrift rechnet je Zahlung „Provision heute minus schon gutgeschrieben“ (Spalte art 'monat'|'nachtrag');
//     der Monatslauf nimmt Offenes mit, im Chefbüro „Nachtrag jetzt abrechnen“. Geld bewegt nie das System (Auftrag = Entwurf).
//   · Zuordnung Empfehlung → Person automatisch (Stundenlauf koop_empfehlung_zuordnen, NICHT im Lieferlauf).
//   · Die Empfehlung läuft wie ein Lead (globalAnfrageAnnehmen: Anfrage, Firmen-Lead, Daniels Anruf, Dossier an Justin; mit E-Mail
//     die Willkommens-Mail „Empfehlung“ aus dem Lauf lead_post). Altbestand ohne Anfrage: keine Mail, nur Zuordnung und — mit
//     Telefonnummer — einmal eine Aufgabe an die zuständige Person.
//   · Der Partner sieht je Empfehlung nur die Stufe mit Datum (shared: koopEmpfehlungStufe).
//
// E-487 Nachbesserung (Gutachten, 09.11.2026):
//   · Jede Zahlung zählt höchstens für EINE Empfehlung — die früheste, in deren Fenster sie fällt (KOOP_NUR_ERSTE_EMPFEHLUNG_SQL);
//     Zuordnen (Automatik und von Hand) einer Person, die schon an einer anderen Empfehlung hängt, geht nicht (Mangel 1).
//   · Der Partner setzt nie eine Personen-Nummer (Mangel 2). Automatisch zugeordnet wird nur über Anfrage, E-Mail oder Telefon;
//     ein Treffer nur über den Namen ist ein Vorschlag mit Aufgabe an Justin (Mangel 4). Der Lauf sucht im Provisionsfenster und
//     reihum (zuordnung_geprueft_am), Fragen an Justin bleiben liegen, Fehler kommen in die Lauf-Historie (Mangel 5, 13).
//   · Lead nur mit Einverständnis (gespeichert: einverstanden_am/_von/_text) und höchstens KOOP_EMPFEHLUNG_LEAD_MAX_TAG je Partner
//     in 24 Stunden (Mangel 6, 7). Entfernen beendet Lead-Mails und Anruf-Auftrag (Mangel 12).
//   · Jede Zahlung zählt mit dem Satz an ihrem Zahltag — eine Erhöhung zahlt nie rückwirkend nach (Verlauf, Mangel 8).
//   · Nachbereiten einer Gutschrift nur einmal zugleich (pg_try_advisory_xact_lock, Mangel 9).
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { CRONS_AN } from "./fiaon-crons";
import { UMSATZ_QUELLE_SQL } from "./fiaon-umsatz-quelle";
import {
  KOOP_DURCHLAUF_SCHLUESSEL, KOOP_PROVISION_MONATE, KOOP_EMPFEHLUNG_STAND_TEXT, KOOP_FASTTRACK_ZAEHLT_ENV, KOOP_ZUORDNUNG_TAGE_VORHER, KOOP_EMPFEHLUNG_IP,
  KOOP_EMPFEHLUNG_TEXTE, KOOP_OHNE_LEAD_TEXT,
  koopProvisionAus, koopProvisionCents, koopEmpfehlungAus, koopBerechnungAusgesetzt, koopMonatsbericht, koopDurchlaufAbzugSql, koopFastTrackZaehlt,
  koopEmpfehlungStufe, koopOffenePosten, koopBerlinMonat, koopBerlinTag, koopNameTeile, koopNamePasst, koopZuordnungUrteil, koopZuordnungWege,
  koopSatzAm, koopProvisionNeu, koopEmpfehlungDoppelt, koopEmpfehlungLeadEntscheid, koopZuordnungGruendeText,
  type KoopEmpfehlungStand, type KoopGsPosten, type KoopZahlung, type KoopZuordnungKandidat, type KoopProvision, type KoopBisherPosten,
} from "@shared/fiaon-koop-empfehlung";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
type Ergebnis<T extends object = {}> = ({ ok: true } & T) | { ok: false; error: string; status?: number };
const nein = (error: string, status = 400): { ok: false; error: string; status: number } => ({ ok: false, error, status });
const json = <T,>(v: unknown, f: T): T => { if (v == null) return f; if (typeof v === "string") { try { return JSON.parse(v) as T; } catch { return f; } } return v as T; };
const eur = (c: number) => `${(Math.round(c) / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const tag = (d: Date | string) => new Date(d).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric" });
/** Der Partner aus dem Kooperationsvertrag (kunde-JSON): Vor- und Nachname. */
const partnerNameAus = (kunde: unknown): string => { const p = json<Record<string, any>>(kunde, {}); return `${String(p.vorname ?? "").trim()} ${String(p.nachname ?? "").trim()}`.trim() || "ein Partner"; };
const CHEF_LINK = "/chef/s/global-auftraege?reiter=partner";

/**
 * E-487: der Fast-Track-Abzug (SQL über q) für diese Kooperation — „zählt mit“ steht in der Umgebungsvariable KOOP_FASTTRACK_ZAEHLT
 * (Komma-Liste der Angebots-Refs), nie im Code. Ohne Ref (Prüfstand ohne Kooperation): der normale Abzug.
 */
export function koopAbzugSqlFuer(ref: unknown): string {
  return koopDurchlaufAbzugSql(koopFastTrackZaehlt(ref, process.env[KOOP_FASTTRACK_ZAEHLT_ENV]));
}
async function refVon(angebotId: number, lauf: any = sqlPool): Promise<string | null> {
  const [r] = (await lauf`SELECT angebot_ref FROM fiaon_global_angebote WHERE id = ${angebotId}`) as any[];
  return r?.angebot_ref ? String(r.angebot_ref) : null;
}

let bereit: Promise<void> | null = null;
/**
 * Dieselbe DDL wie Migration 117 — additiv. E-487: Spalten für die Anfrage (anfrage_id) und die Zuordnung — nur wenn sie fehlen
 * (Blick in den Katalog, keine Sperre) und dann mit lock_timeout: lieber beim nächsten Aufruf neu versuchen als hinter einer
 * langen Lesung warten (E-254). Keine Migration von außen nötig.
 */
export function ensureEmpfehlungTabelle(): Promise<void> {
  if (!bereit) {
    bereit = (async () => {
      await sqlPool`
        CREATE TABLE IF NOT EXISTS fiaon_koop_empfehlungen (
          id BIGSERIAL PRIMARY KEY,
          angebot_id INTEGER NOT NULL,
          person_id INTEGER,
          name TEXT NOT NULL,
          telefon TEXT,
          email TEXT,
          notiz TEXT,
          quelle VARCHAR(20) NOT NULL DEFAULT 'fiaon',
          gemeldet_am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          ausgezahlt_cents INTEGER NOT NULL DEFAULT 0,
          entfernt_am TIMESTAMPTZ,
          eingetragen_von TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
      await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_koop_empfehlungen_angebot_idx ON fiaon_koop_empfehlungen (angebot_id) WHERE entfernt_am IS NULL`;
      // E-487 Nachbesserung: Einwilligung (wann, wer, welcher Wortlaut — Mangel 6/14), reihum prüfen (Mangel 5), Vorschlag (Mangel 4).
      const [n] = (await sqlPool`
        SELECT COUNT(*)::int AS n FROM information_schema.columns
         WHERE table_schema = current_schema() AND table_name = 'fiaon_koop_empfehlungen'
           AND column_name IN ('anfrage_id', 'zuordnung_am', 'zuordnung_weg', 'zuordnung_frage_am', 'anruf_aufgabe_am',
                               'einverstanden_am', 'einverstanden_von', 'einverstanden_text', 'zuordnung_geprueft_am', 'zuordnung_vorschlag')`) as any[];
      if (Number(n?.n) < 10) {
        await sqlPool.begin(async (tx: any) => {
          await tx`SET LOCAL lock_timeout = '3s'`;
          await tx`
            ALTER TABLE fiaon_koop_empfehlungen
              ADD COLUMN IF NOT EXISTS anfrage_id INTEGER,
              ADD COLUMN IF NOT EXISTS zuordnung_am TIMESTAMPTZ,
              ADD COLUMN IF NOT EXISTS zuordnung_weg TEXT,
              ADD COLUMN IF NOT EXISTS zuordnung_frage_am TIMESTAMPTZ,
              ADD COLUMN IF NOT EXISTS anruf_aufgabe_am TIMESTAMPTZ,
              ADD COLUMN IF NOT EXISTS einverstanden_am TIMESTAMPTZ,
              ADD COLUMN IF NOT EXISTS einverstanden_von TEXT,
              ADD COLUMN IF NOT EXISTS einverstanden_text TEXT,
              ADD COLUMN IF NOT EXISTS zuordnung_geprueft_am TIMESTAMPTZ,
              ADD COLUMN IF NOT EXISTS zuordnung_vorschlag JSONB`;
        });
      }
    })().catch((e) => { bereit = null; throw e; });
  }
  return bereit;
}

/**
 * E-487 Nachbesserung (Gutachten, Mangel 1): Jede Zahlung zählt höchstens für EINE Empfehlung — die früheste (gemeldet_am, dann id),
 * in deren Zeitfenster sie fällt. Hängt dieselbe Person an zwei Empfehlungen (Tippfehler im Namen, zwei Partner, von Hand), bekam
 * vorher jede die volle Provision auf dieselbe Zahlung (Probe: 2 × 300 € statt 300 €). SQL über e (Empfehlung) und q (Zahlung aus
 * UMSATZ_QUELLE_SQL); $2 = KOOP_PROVISION_MONATE — in BEIDEN Geld-Abfragen (Liste und Gutschrift).
 */
export const KOOP_NUR_ERSTE_EMPFEHLUNG_SQL = `NOT EXISTS (
         SELECT 1 FROM fiaon_koop_empfehlungen x
          WHERE x.person_id = e.person_id AND x.entfernt_am IS NULL AND x.id <> e.id
            AND (x.gemeldet_am < e.gemeldet_am OR (x.gemeldet_am = e.gemeldet_am AND x.id < e.id))
            AND q.am >= x.gemeldet_am AND q.am < x.gemeldet_am + make_interval(months => $2))`;

/** E-487 Nachbesserung (Mangel 1): Hängt die Person schon an einer anderen (nicht entfernten) Empfehlung? Dann welche. */
async function personSchonEmpfohlen(personId: number, ohneId: number | null): Promise<{ id: number; name: string; ref: string } | null> {
  const [r] = (await sqlPool`
    SELECT e.id, e.name, g.angebot_ref FROM fiaon_koop_empfehlungen e LEFT JOIN fiaon_global_angebote g ON g.id = e.angebot_id
     WHERE e.person_id = ${personId} AND e.entfernt_am IS NULL AND e.id <> ${ohneId ?? 0} ORDER BY e.gemeldet_am, e.id LIMIT 1`) as any[];
  return r ? { id: Number(r.id), name: String(r.name), ref: String(r.angebot_ref ?? "") } : null;
}

export interface KoopEmpfehlungZeile {
  id: number; name: string; telefon: string | null; email: string | null; notiz: string | null; quelle: string; personId: number | null;
  gemeldetAm: string; gemeldetText: string; bisText: string; stand: KoopEmpfehlungStand; standText: string;
  /** E-487: seit wann die Stufe gilt (nur Stufe und Datum — keine Inhalte, Ziffer 5 Abs. 1). */
  standAm: string | null; standAmText: string | null;
  umsatzCents: number; provisionCents: number; ausgezahltCents: number; offenCents: number;
  umsatz: string; provision: string; ausgezahlt: string; offen: string;
  /** E-487, nur Chefbüro (intern): die Anfrage der Empfehlung und wie die Person zugeordnet wurde. */
  anfrageId?: number | null; zuordnungText?: string | null;
  /** E-487 Nachbesserung, nur Chefbüro: der Vorschlag der Automatik (eine Person) — füllt das Feld vor, Justin drückt „Zuordnen“. */
  vorschlagPersonId?: number | null;
  /** E-487 Nachbesserung, nur Chefbüro: mit Einverständnis der Person eingetragen (wann, wer). */
  einverstandenText?: string | null;
}
/** E-487: was „Nachtrag jetzt abrechnen“ gutschreiben würde — Vorschau im Chefbüro. */
export interface KoopNachtragVorschau {
  bisMonat: string | null; bisText: string | null;
  posten: { name: string; amText: string; umsatz: string; faellig: string; schon: string; nachtrag: string; nachtragCents: number }[];
  summeCents: number; summe: string;
  /** Für Zahlungen dieses und früherer Monate gibt es schon einen Nachtrag — was jetzt offen ist, kommt mit der nächsten Monatsabrechnung. */
  schonDa: { nummer: string } | null;
  zuViel: { name: string; amText: string; faellig: string; schon: string }[];
  hinweis: string | null;
}
export interface KoopEmpfehlungSicht {
  prozent: number | null; berechnungAusgesetzt: boolean; monate: number;
  liste: KoopEmpfehlungZeile[];
  summe: { umsatz: string; provision: string; ausgezahlt: string; offen: string; provisionCents: number; offenCents: number };
  /** E-420: Monatsabrechnungen per Gutschrift und die (maskierte) Bankverbindung des Partners. E-487: art = monat | nachtrag. */
  gutschriften: { id: number; nummer: string; monatText: string; betrag: string; stand: string; art: string }[];
  bank: { inhaber: string; maske: string } | null;
  /** E-421: der zuletzt verschickte Monatsbericht. */
  letzterBericht: { monatText: string; am: string } | null;
  /** E-487, nur Chefbüro (intern): der offene Nachtrag. */
  nachtrag?: KoopNachtragVorschau | null;
}

/**
 * E-487: die Spuren je Empfehlung für die Stufe — das erste Mal Kontakt (Willkommens-Mail, Anruf/Mail im Cockpit, erledigter
 * Anruf-Auftrag), Gespräch (Lead-Gespräch, Global-Termin der Person), Angebot (Angebot oder Bestellung der Person) und „kein
 * Interesse“ (Anfrage, Lead-Mails, Firmen-Karte). Alles ab dem Meldetag minus 30 Tage. LEAST übergeht NULL.
 */
const STUFEN_SQL = `
  SELECT e.id,
    LEAST(
      (SELECT w.willkommen_am FROM fiaon_lead_weg w WHERE e.anfrage_id IS NOT NULL AND w.anfrage_id = e.anfrage_id),
      (SELECT MIN(l.created_at) FROM fiaon_firmen_log l JOIN fiaon_lead_weg w ON w.firma_id = l.firma_id
        WHERE e.anfrage_id IS NOT NULL AND w.anfrage_id = e.anfrage_id AND l.art IN ('anruf', 'mail') AND l.created_at >= e.gemeldet_am),
      (SELECT MIN(t.erledigt_am) FROM fiaon_betreiber_todos t
        WHERE t.status = 'erledigt' AND t.schluessel IN ('global-anfrage:' || COALESCE(e.anfrage_id, 0)::text, 'koop-empfehlung-anruf:' || e.id::text))
    ) AS kontakt_am,
    LEAST(
      (SELECT MIN(g.created_at) FROM fiaon_lead_gespraech g WHERE e.anfrage_id IS NOT NULL AND g.anfrage_id = e.anfrage_id),
      (SELECT MIN(t.created_at) FROM fiaon_termine t WHERE e.person_id IS NOT NULL AND t.person_id = e.person_id
        AND t.quelle IN ('global', 'gruender') AND t.created_at >= e.gemeldet_am - INTERVAL '30 days')
    ) AS gespraech_am,
    LEAST(
      (SELECT MIN(ga.created_at) FROM fiaon_global_angebote ga WHERE e.person_id IS NOT NULL AND ga.person_id = e.person_id
        AND ga.fassung NOT LIKE 'IA-KOOP-%' AND ga.created_at >= e.gemeldet_am - INTERVAL '30 days'),
      (SELECT MIN(a.created_at) FROM fiaon_applications a WHERE e.person_id IS NOT NULL AND a.person_id = e.person_id
        AND a.merged_into IS NULL AND a.created_at >= e.gemeldet_am - INTERVAL '30 days')
    ) AS angebot_am,
    COALESCE(
      (SELECT an.bearbeitet_am FROM fiaon_anfragen an WHERE e.anfrage_id IS NOT NULL AND an.id = e.anfrage_id AND an.status = 'kein_interesse'),
      (SELECT w.stopp_am FROM fiaon_lead_weg w WHERE e.anfrage_id IS NOT NULL AND w.anfrage_id = e.anfrage_id AND w.stopp_grund = 'kein_interesse'),
      (SELECT f.updated_at FROM fiaon_firmen_leads f JOIN fiaon_lead_weg w ON w.firma_id = f.id
        WHERE e.anfrage_id IS NOT NULL AND w.anfrage_id = e.anfrage_id AND f.status = 'kein_interesse')
    ) AS kein_am
  FROM fiaon_koop_empfehlungen e
  WHERE e.angebot_id = $1 AND e.entfernt_am IS NULL`;

/** E-487 Nachbesserung: der gespeicherte Vorschlag der Automatik (zuordnung_vorschlag) — eine Person oder mehrere. */
function vorschlagAus(x: any): { personId?: number; wege?: string[]; personen?: { personId: number; wege: string[] }[] } | null {
  const v = json<Record<string, any> | null>(x.zuordnung_vorschlag, null);
  return v && typeof v === "object" ? v : null;
}
function zuordnungText(x: any): string | null {
  const weg = String(x.zuordnung_weg ?? "");
  if (x.person_id == null) {
    if (weg === "hand_geloest") return "Zuordnung von Hand gelöst — die Automatik ordnet hier nichts mehr zu.";
    const v = vorschlagAus(x);
    if (v?.personId) return `Vorschlag der Automatik: Person ${v.personId} (über ${koopZuordnungWege(v.wege ?? [])}) — prüfen und „Zuordnen“ drücken.`;
    if (v?.personen?.length) return `Mehrere passende Personen: ${v.personen.map((p) => `${p.personId} (über ${koopZuordnungWege(p.wege ?? [])})`).join(", ")} — die richtige eintragen und „Zuordnen“.`;
    if (x.zuordnung_frage_am) return `Zuordnung unklar — Aufgabe an Justin seit ${tag(x.zuordnung_frage_am)}.`;
    return null;
  }
  if (!x.zuordnung_am || weg === "hand") return null;
  return `automatisch zugeordnet am ${tag(x.zuordnung_am)} (über ${koopZuordnungWege(weg.split(",").filter(Boolean))})`;
}

/**
 * Die Liste mit Umsatz und Provision je Meldung — für Partnerbereich und Chefbüro.
 * E-487: `intern` (nur Chefbüro) ergänzt Anfrage, Zuordnung und den offenen Nachtrag. Ohne `intern` bleibt alles, was der
 * Partnerbereich bekommt, frei von Interna (koopPartnerSicht nimmt zusätzlich Notiz, Telefon, E-Mail und Personennummer heraus).
 */
export async function koopEmpfehlungSicht(z: { [k: string]: any }, opt: { intern?: boolean } = {}): Promise<KoopEmpfehlungSicht> {
  await ensureEmpfehlungTabelle();
  const schalter = json<Record<string, unknown>>(z.schalter, {});
  const prov = koopProvisionAus(schalter);
  const zeilen = (await sqlPool`
    SELECT * FROM fiaon_koop_empfehlungen WHERE angebot_id = ${Number(z.id)} AND entfernt_am IS NULL ORDER BY gemeldet_am DESC LIMIT 300`) as any[];
  const personen = Array.from(new Set(zeilen.map((x) => x.person_id).filter((x) => x != null).map(Number)));
  const abzug = koopAbzugSqlFuer(z.angebot_ref);
  // E-487 Nachbesserung: je ZAHLUNG (nicht mehr die Summe je Empfehlung) — jede zählt nur für die früheste Empfehlung (Mangel 1) und
  // mit dem Satz an ihrem Zahltag (Mangel 8); gerundet wird je Zahlung wie in der Gutschrift.
  const zahlungen = personen.length ? ((await sqlPool.unsafe(`
    WITH q AS (${UMSATZ_QUELLE_SQL})
    SELECT e.id, q.am, (q.cents - ${abzug}) AS cents
      FROM fiaon_koop_empfehlungen e
      JOIN q ON q.person_id = e.person_id AND q.am >= e.gemeldet_am AND q.am < e.gemeldet_am + make_interval(months => $2)
       AND NOT EXISTS (SELECT 1 FROM fiaon_applications ax WHERE ax.ref = q.ref AND ax.pack_key = ANY($3::text[]))
     WHERE e.angebot_id = $1 AND e.entfernt_am IS NULL AND e.person_id IS NOT NULL
       AND ${KOOP_NUR_ERSTE_EMPFEHLUNG_SQL}`, [Number(z.id), KOOP_PROVISION_MONATE, [...KOOP_DURCHLAUF_SCHLUESSEL]])) as any[]) : [];
  const geld = new Map<number, { cents: number; provision: number; ersteAm: Date | null }>();
  for (const r of zahlungen) {
    const id = Number(r.id); const c = Number(r.cents) || 0; const am = new Date(r.am);
    const g = geld.get(id) ?? { cents: 0, provision: 0, ersteAm: null };
    g.cents += c;
    g.provision += prov ? koopProvisionCents(c, koopSatzAm(prov, am)) : 0;
    if (c > 0 && (!g.ersteAm || am < g.ersteAm)) g.ersteAm = am;
    geld.set(id, g);
  }
  // E-487: die Stufen (Kontakt, Gespräch, Angebot, kein Interesse) — scheitert das Lesen (eine Tabelle fehlt), gilt die alte
  // Regel: eine Bestellzeile der Person nach der Meldung (−30 Tage) ist „Angebot“.
  const stufen = new Map<number, any>();
  let stufenGelesen = false;
  try {
    for (const r of (await sqlPool.unsafe(STUFEN_SQL, [Number(z.id)])) as any[]) stufen.set(Number(r.id), r);
    stufenGelesen = true;
  } catch (e) { console.error("[KOOP] Stufen der Empfehlungen:", e instanceof Error ? e.message : e); }
  const bestellt = !stufenGelesen && personen.length ? ((await sqlPool`
    SELECT e.id, MIN(a.created_at) AS am FROM fiaon_koop_empfehlungen e JOIN fiaon_applications a ON a.person_id = e.person_id AND a.created_at >= e.gemeldet_am - interval '30 days'
     WHERE e.angebot_id = ${Number(z.id)} AND e.entfernt_am IS NULL GROUP BY e.id`) as any[]) : [];
  // E-420: Ausgezahlt = von Hand eingetragen + Posten aus Gutschriften, deren Banking-Auftrag ausgeführt ist.
  const gs = await koopGutschriftenListe(Number(z.id)).catch(() => []);
  const ausGs = new Map<number, number>();
  for (const g of gs) if (g.stand === "ausgezahlt") for (const p of g.posten) ausGs.set(p.empfehlungId, (ausGs.get(p.empfehlungId) ?? 0) + p.provisionCents);
  const liste: KoopEmpfehlungZeile[] = zeilen.map((x) => {
    const g = geld.get(Number(x.id));
    const umsatz = Number(g?.cents ?? 0);
    const provision = g?.provision ?? 0;
    const ausgezahlt = Number(x.ausgezahlt_cents ?? 0) + (ausGs.get(Number(x.id)) ?? 0);
    const sp = stufen.get(Number(x.id));
    const b = bestellt.find((y) => Number(y.id) === Number(x.id));
    const st = koopEmpfehlungStufe({
      gemeldetAm: x.gemeldet_am, kundeAm: umsatz > 0 ? (g?.ersteAm ?? x.gemeldet_am) : null,
      kontaktAm: sp?.kontakt_am, gespraechAm: sp?.gespraech_am, angebotAm: sp?.angebot_am ?? (x.person_id != null ? b?.am : null), keinInteresseAm: sp?.kein_am,
    });
    const bis = new Date(x.gemeldet_am); bis.setMonth(bis.getMonth() + KOOP_PROVISION_MONATE);
    return {
      id: Number(x.id), name: String(x.name), telefon: x.telefon ?? null, email: x.email ?? null, notiz: x.notiz ?? null, quelle: String(x.quelle),
      personId: x.person_id != null ? Number(x.person_id) : null,
      gemeldetAm: new Date(x.gemeldet_am).toISOString(), gemeldetText: tag(x.gemeldet_am), bisText: tag(bis), stand: st.stand, standText: KOOP_EMPFEHLUNG_STAND_TEXT[st.stand],
      standAm: st.am ? st.am.toISOString() : null, standAmText: st.am ? tag(st.am) : null,
      umsatzCents: umsatz, provisionCents: provision, ausgezahltCents: ausgezahlt, offenCents: Math.max(0, provision - ausgezahlt),
      umsatz: eur(umsatz), provision: eur(provision), ausgezahlt: eur(ausgezahlt), offen: eur(Math.max(0, provision - ausgezahlt)),
      ...(opt.intern ? {
        anfrageId: x.anfrage_id != null ? Number(x.anfrage_id) : null, zuordnungText: zuordnungText(x),
        vorschlagPersonId: x.person_id == null && vorschlagAus(x)?.personId ? Number(vorschlagAus(x)!.personId) : null,
        einverstandenText: x.einverstanden_am ? `einverstanden (bestätigt ${tag(x.einverstanden_am)}${x.einverstanden_von ? `, ${String(x.einverstanden_von)}` : ""})` : null,
      } : {}),
    };
  });
  const s = liste.reduce((a, x) => ({ u: a.u + x.umsatzCents, p: a.p + x.provisionCents, z: a.z + x.ausgezahltCents, o: a.o + x.offenCents }), { u: 0, p: 0, z: 0, o: 0 });
  return {
    prozent: prov?.prozent ?? null, berechnungAusgesetzt: koopBerechnungAusgesetzt(schalter), monate: KOOP_PROVISION_MONATE, liste,
    summe: { umsatz: eur(s.u), provision: eur(s.p), ausgezahlt: eur(s.z), offen: eur(s.o), provisionCents: s.p, offenCents: s.o },
    gutschriften: gs.map((g) => ({ id: g.id, nummer: g.nummer, monatText: g.monatText, betrag: g.betrag, stand: g.stand, art: g.art })),
    bank: koopBankMaske(schalter),
    letzterBericht: await koopLetzterBericht(Number(z.id)).catch(() => null),
    ...(opt.intern ? { nachtrag: await koopNachtragVorschau(z).catch((e) => { console.error("[KOOP] Nachtrag-Vorschau:", e instanceof Error ? e.message : e); return null; }) } : {}),
  };
}

/**
 * E-487: Die Empfehlung läuft wie ein Lead — derselbe Eingang wie fiaon.com/business und das Meta-Formular (globalAnfrageAnnehmen):
 * Anfrage, Firmen-Lead im Cockpit, Anruf-Auftrag an die zuständige Person (fällig heute), Lead-Dossier an Justin. Mit E-Mail schreibt
 * Justin nach der Ruhezeit die Willkommens-Mail „Empfehlung“ (Lauf lead_post erkennt die Anfrage an ip KOOP_EMPFEHLUNG_IP). Die
 * Antwort „Empfehlung von …“ hält die Anfrage im Global-Weg (nie die Privat-Weiche) und steht im Dossier. Wirft nie: null = kein Lead.
 */
async function empfehlungAlsLead(z: { [k: string]: any }, eid: number, e: { name: string; email: string | null; telefon: string | null; notiz: string | null }, partner: string, wer: string): Promise<number | null> {
  try {
    const { globalAnfrageAnnehmen } = await import("./fiaon-global-termin");
    const { nameTeilen } = await import("@shared/fiaon-global-lead-texte");
    const { firmaOffenPlatzhalter, firmaNameVerbindet } = await import("@shared/fiaon-global-lead");
    const name = e.name.replace(/["]/g, "").replace(/\s+/g, " ").trim();
    const t = nameTeilen(name);
    const ref = String(z.angebot_ref ?? "");
    const erg = await globalAnfrageAnnehmen({
      kontakt: {
        name, vorname: t.vorname, nachname: t.nachname,
        firma: (firmaNameVerbindet(name, "") ? name : firmaOffenPlatzhalter(name)).slice(0, 200),
        email: String(e.email ?? "").trim().toLowerCase(), telefon: String(e.telefon ?? "").replace(/[^\d\s+()/-]/g, "").replace(/\s+/g, " ").trim(),
        paket: null, paketText: null, land: null, sprache: "de",
      },
      wunschzeit: null,
      text: `Empfehlung von ${partner} (Kooperation ${ref})${e.notiz ? `: ${e.notiz}` : "."}`,
      ip: KOOP_EMPFEHLUNG_IP,
      // E-487 Nachbesserung (Gutachten, Mangel 3): Der Text ist die Notiz des Partners — nie ein Fall für die Beschwerde-Weiche.
      empfehlung: true,
      herkunft: { wo: `den Partnerbereich (Empfehlung von ${partner})`, quelle: "global", autor: "FIAON Partnerbereich" },
      lead: { kanal: "website", antworten: [{ schluessel: "empfehlung", frage: "Woher kommt der Kontakt?", antwort: `Empfehlung von ${partner}`, code: null }] },
    });
    await sqlPool`UPDATE fiaon_koop_empfehlungen SET anfrage_id = ${erg.anfrageId} WHERE id = ${eid}`;
    const { verlaufAngebot } = await import("./fiaon-global-angebot");
    await verlaufAngebot(Number(z.id), wer, `Empfehlung ${name} läuft als Lead: Anfrage #${erg.anfrageId}${erg.zustaendigName ? `, Anruf-Auftrag bei ${erg.zustaendigName}` : ""}${e.email ? ", Einladung per Mail nach der Ruhezeit" : ""}`).catch(() => {});
    return erg.anfrageId;
  } catch (err) {
    console.error(`[KOOP] Empfehlung ${eid} als Lead nicht angelegt:`, err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Eine Empfehlung festhalten. Partner (quelle „partner“): Telefon ODER E-Mail ist Pflicht (E-487).
 * E-487: Ohne Personen-Nummer und mit Kontaktweg läuft sie wie ein Lead (empfehlungAlsLead) — auch, wenn die Leitung sie einträgt.
 * Die Aufgabe an Justin („bitte kontaktieren und zuordnen“) gibt es nur noch, wenn der Lead nicht entstand.
 * E-487 Nachbesserung (Gutachten):
 *   · Mangel 2: Der Partner setzt nie eine Personen-Nummer — vorher hing `{ personId: 123 }` die Empfehlung sofort an einen fremden
 *     Kunden (Provision auf dessen Zahlungen, Umsatz und Stufe im Partnerbereich; die Nummern sind fortlaufend).
 *   · Mangel 1: Eine Personen-Nummer der Leitung, die schon an einer anderen Empfehlung hängt, geht nicht; doppelt beim selben
 *     Partner ist auch „Dr. Max Muster“ neben „Max Muster“ oder dieselbe E-Mail bzw. Telefonnummer.
 *   · Mangel 6 + 7: Lead nur mit Einverständnis (gespeichert mit Wortlaut) und höchstens KOOP_EMPFEHLUNG_LEAD_MAX_TAG
 *     Partner-Empfehlungen in 24 Stunden — darüber eine Aufgabe an Justin statt Anfrage, Dossier und Mail.
 */
export async function koopEmpfehlungEintragen(
  z: { [k: string]: any },
  roh: unknown, wer: string, quelle: "partner" | "fiaon", partnerName?: string,
): Promise<Ergebnis<{ id: number; lead: boolean; ohneLead: string | null }>> {
  const e = koopEmpfehlungAus(roh, { kontaktPflicht: quelle === "partner" });
  if (!e.ok) return nein(e.error);
  const personId = quelle === "partner" ? null : e.personId;
  const einverstanden = (roh as any)?.einverstanden === true;
  if (quelle === "partner" && !einverstanden) return nein("Bitte bestätigen Sie, dass die Person einverstanden ist, dass wir sie kontaktieren.");
  await ensureEmpfehlungTabelle();
  if (personId) {
    const [p] = (await sqlPool`SELECT id FROM fiaon_persons WHERE id = ${personId} LIMIT 1`) as any[];
    if (!p) return nein(`Person ${personId} gibt es nicht.`);
    const belegt = await personSchonEmpfohlen(personId, null);
    if (belegt) return nein(`Person ${personId} gehört schon zur Empfehlung „${belegt.name}“ (Kooperation ${belegt.ref}) — eine Zahlung zählt nur für eine Empfehlung. Bitte dort zuerst lösen.`, 409);
  }
  const vorhanden = (await sqlPool`SELECT name, email, telefon FROM fiaon_koop_empfehlungen WHERE angebot_id = ${Number(z.id)} AND entfernt_am IS NULL`) as any[];
  if (koopEmpfehlungDoppelt(e, vorhanden)) return nein("Diese Empfehlung steht schon in der Liste.", 409);
  const einverstandenText = einverstanden ? (quelle === "partner" ? KOOP_EMPFEHLUNG_TEXTE.einverstanden : KOOP_EMPFEHLUNG_TEXTE.einverstandenLeitung) : null;
  const [r] = (await sqlPool`
    INSERT INTO fiaon_koop_empfehlungen (angebot_id, person_id, name, telefon, email, notiz, quelle, eingetragen_von, einverstanden_am, einverstanden_von, einverstanden_text)
    VALUES (${Number(z.id)}, ${personId}, ${e.name}, ${e.telefon}, ${e.email}, ${e.notiz}, ${quelle}, ${wer},
            ${einverstanden ? new Date() : null}, ${einverstanden ? wer : null}, ${einverstandenText})
    RETURNING id`) as any[];
  const id = Number(r.id);
  const { verlaufAngebot } = await import("./fiaon-global-angebot");
  await verlaufAngebot(Number(z.id), wer, `Empfehlung an FIAON: ${e.name}${personId ? ` (Person ${personId})` : ""}${einverstanden ? " · mit Einverständnis der Person" : ""}`).catch(() => {});
  const partner = partnerName ?? partnerNameAus(z.kunde);
  // Mangel 7: Deckel je Kooperation — gezählt wird jede Partner-Meldung der letzten 24 Stunden (auch eine wieder entfernte).
  const [n24] = quelle === "partner" ? ((await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_koop_empfehlungen
     WHERE angebot_id = ${Number(z.id)} AND quelle = 'partner' AND id <> ${id} AND created_at > NOW() - INTERVAL '24 hours'`) as any[]) : [{ n: 0 }];
  const ent = koopEmpfehlungLeadEntscheid({ personId, email: e.email, telefon: e.telefon, einverstanden, quelle, letzte24h: Number(n24?.n) || 0 });
  const anfrageId = ent.lead ? await empfehlungAlsLead(z, id, e, partner, wer) : null;
  const ohneLead = ent.lead ? (anfrageId ? null : "Der Lead ließ sich nicht automatisch anlegen") : KOOP_OHNE_LEAD_TEXT[ent.grund];
  if (quelle === "partner" && !anfrageId) {
    const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
    const deckel = !ent.lead && ent.grund === "deckel";
    await auftragFuerKunden({
      personId: null, ref: null,
      titel: deckel ? `Viele Empfehlungen von ${partner} in 24 Stunden — bitte prüfen: ${e.name}` : `Neue Empfehlung von ${partner}: ${e.name}`,
      text: [`${partner} hat im Partnerbereich jemanden empfohlen (Kooperation ${String(z.angebot_ref ?? "")}).`,
        `Name: ${e.name}`, e.telefon ? `Telefon: ${e.telefon}` : "", e.email ? `E-Mail: ${e.email}` : "", e.notiz ? `Notiz: ${e.notiz}` : "",
        deckel
          ? `Dieser Partner hat in 24 Stunden schon ${Number(n24?.n) || 0} weitere Empfehlungen geschickt — diese läuft deshalb NICHT automatisch als Lead (keine Anfrage, keine Mail, kein Anruf-Auftrag; Schutz, falls der Link in fremde Hände kam). Passt sie, bitte selbst kontaktieren; die Person ordnet sich danach selbst zu.`
          : "Der Lead ließ sich nicht automatisch anlegen. Bitte kontaktieren; die Person ordnet sich danach selbst zu (sonst im Chefbüro unter Geschäftspartner › Empfehlungen)."].filter(Boolean).join("\n"),
      anBetreiber: true, dringend: true, schluessel: `koop-empfehlung:${id}`, bereich: "konten", quelle: "global", autorName: "FIAON Partnerbereich",
      link: CHEF_LINK,
    }).catch((err) => console.error(`[KOOP] Aufgabe zur Empfehlung ${id}:`, err));
  }
  return { ok: true, id, lead: !!anfrageId, ohneLead };
}

/**
 * E-487 Nachbesserung (Gutachten, Mangel 12): Eine entfernte Empfehlung, die als Lead lief, endet auch als Lead — keine Lead-Mails
 * mehr aus js@ (Stopp „von Hand“, Zeile im Cockpit), der Anruf-Auftrag und der Altbestand-Anruf sind erledigt. Wirft nie.
 */
async function empfehlungLeadBeenden(anfrageId: number | null, eid: number, wer: string): Promise<void> {
  if (anfrageId) {
    try {
      const { leadMailsBeenden } = await import("./fiaon-global-lead-post");
      await leadMailsBeenden(anfrageId, `Empfehlung entfernt (${wer})`);
    } catch (e) { console.error(`[KOOP] Lead-Mails zur Empfehlung ${eid} nicht gestoppt:`, e instanceof Error ? e.message : e); }
  }
  await sqlPool`
    UPDATE fiaon_betreiber_todos SET status = 'erledigt', erledigt_am = COALESCE(erledigt_am, NOW()),
           ergebnis = COALESCE(ergebnis, ${`Empfehlung entfernt (${wer}) — kein Anruf mehr nötig.`}), updated_at = NOW()
     WHERE schluessel IN (${`global-anfrage:${anfrageId ?? 0}`}, ${`koop-empfehlung-anruf:${eid}`}) AND status <> 'erledigt'`
    .catch((e) => console.error(`[KOOP] Anruf-Auftrag zur Empfehlung ${eid} nicht geschlossen:`, e instanceof Error ? e.message : e));
}

/**
 * Leitung: Person zuordnen, Auszahlung festhalten oder Meldung entfernen.
 * E-487: Eine Zuordnung von Hand merkt sich die Herkunft — „gelöst“ heißt, die Automatik ordnet diese Empfehlung nie wieder zu.
 * E-487 Nachbesserung: Eine Person, die schon an einer anderen Empfehlung hängt, lässt sich nicht noch einmal zuordnen (Mangel 1);
 * Entfernen beendet einen laufenden Lead mit (Mangel 12).
 */
export async function koopEmpfehlungAendern(z: { [k: string]: any }, eid: number, roh: any, wer: string): Promise<Ergebnis> {
  await ensureEmpfehlungTabelle();
  const [x] = (await sqlPool`SELECT * FROM fiaon_koop_empfehlungen WHERE id = ${eid} AND angebot_id = ${Number(z.id)} AND entfernt_am IS NULL`) as any[];
  if (!x) return nein("Diese Empfehlung gibt es nicht.", 404);
  const { verlaufAngebot } = await import("./fiaon-global-angebot");
  if (roh?.entfernen === true) {
    await sqlPool`UPDATE fiaon_koop_empfehlungen SET entfernt_am = NOW() WHERE id = ${eid}`;
    await empfehlungLeadBeenden(x.anfrage_id != null ? Number(x.anfrage_id) : null, eid, wer);
    await verlaufAngebot(Number(z.id), wer, `Empfehlung entfernt: ${x.name}${x.anfrage_id != null ? " — Lead-Mails gestoppt, Anruf-Auftrag erledigt" : ""}`).catch(() => {});
    return { ok: true };
  }
  if (roh?.personId !== undefined) {
    const pid = roh.personId === null || roh.personId === "" ? null : Number(roh.personId);
    if (pid !== null && !(Number.isInteger(pid) && pid > 0)) return nein("Bitte eine gültige Personen-Nummer.");
    if (pid !== null) {
      const [p] = (await sqlPool`SELECT id FROM fiaon_persons WHERE id = ${pid} LIMIT 1`) as any[];
      if (!p) return nein(`Person ${pid} gibt es nicht.`);
      const belegt = await personSchonEmpfohlen(pid, eid);
      if (belegt) return nein(`Person ${pid} gehört schon zur Empfehlung „${belegt.name}“ (Kooperation ${belegt.ref}) — eine Zahlung zählt nur für eine Empfehlung. Bitte dort zuerst die Personen-Nummer leeren.`, 409);
    }
    await sqlPool`UPDATE fiaon_koop_empfehlungen SET person_id = ${pid}, zuordnung_am = NOW(), zuordnung_weg = ${pid === null ? "hand_geloest" : "hand"} WHERE id = ${eid}`;
    await verlaufAngebot(Number(z.id), wer, `Empfehlung ${x.name}: Person ${pid ?? "— (gelöst)"}`).catch(() => {});
  }
  if (roh?.ausgezahltCents !== undefined) {
    const c = Math.round(Number(roh.ausgezahltCents));
    if (!Number.isFinite(c) || c < 0 || c > 10_000_000) return nein("Bitte einen gültigen Betrag für „ausgezahlt“.");
    await sqlPool`UPDATE fiaon_koop_empfehlungen SET ausgezahlt_cents = ${c} WHERE id = ${eid}`;
    await verlaufAngebot(Number(z.id), wer, `Empfehlung ${x.name}: ausgezahlt ${eur(c)}`).catch(() => {});
  }
  return { ok: true };
}

/**
 * Leitung: Provision in Prozent und „Berechnung ausgesetzt“ (Kontakte kosten 0 €, keine Monatsrechnung).
 * E-487 Nachbesserung (Gutachten, Mangel 8): Ein neuer Satz gilt ab heute (Berliner Tag) — der alte geht mit seinem Zeitraum in
 * provisionVerlauf (shared: koopProvisionNeu), und jede Zahlung zählt mit dem Satz an ihrem Zahltag. Vorher zahlte die nächste
 * Gutschrift eine Erhöhung rückwirkend auf alle schon abgerechneten Zahlungen nach. Derselbe Satz noch einmal ändert nichts.
 */
export async function koopProvisionSetzen(z: { [k: string]: any }, roh: any, wer: string): Promise<Ergebnis<{ meldung?: string }>> {
  const neu: Record<string, unknown> = {};
  const teile: string[] = [];
  let bleibt: string | null = null;
  if (roh?.prozent !== undefined) {
    const p = roh.prozent === null || roh.prozent === "" ? null : Number(String(roh.prozent).replace(",", "."));
    if (p !== null && !(Number.isFinite(p) && p > 0 && p <= 50)) return nein("Provision bitte zwischen 0 und 50 %.");
    const heute = koopBerlinTag(new Date());
    // Der Schalter frisch aus der Datenbank (das Skript koop-provision.ts übergibt nur die id) — sonst ginge der alte Satz verloren.
    const [jetzt] = (await sqlPool`SELECT schalter FROM fiaon_global_angebote WHERE id = ${Number(z.id)}`) as any[];
    const n = koopProvisionNeu(json<Record<string, unknown>>(jetzt?.schalter ?? z.schalter, {}), p, heute);
    if (n) {
      neu.provision = n.provision; neu.provisionVerlauf = n.provisionVerlauf;
      teile.push(p === null ? "Provision entfernt" : `Provision ${String(n.provision?.prozent ?? p).replace(".", ",")} % ab ${tag(new Date())} (frühere Zahlungen behalten ihren Satz)`);
    } else {
      bleibt = p === null ? "Es ist keine Provision gesetzt." : `Die Provision bleibt bei ${String(Math.round(p * 100) / 100).replace(".", ",")} %.`;
    }
  }
  if (roh?.berechnungAusgesetzt !== undefined) {
    neu.berechnungAusgesetzt = roh.berechnungAusgesetzt === true;
    teile.push(roh.berechnungAusgesetzt === true ? "Berechnung der Kontakte ausgesetzt (0 €, keine Monatsrechnung)" : "Berechnung der Kontakte wieder aktiv");
  }
  // E-487 (09.11.2026): wie der Partner auf der Kundenseite „Ihr Vorsorge-Überblick“ heißt („selbstständiger Vermögensberater“).
  // Was nur für EINEN Partner gilt, steht am Vertrag, nie im Code. Leer = die Vorgabe aus der Einwilligung („selbstständiger Berater“).
  if (roh?.rolle !== undefined) {
    const { vorsorgeRolleGueltig } = await import("@shared/fiaon-vorsorge");
    const r = String(roh.rolle ?? "").replace(/\s+/g, " ").trim();
    if (!vorsorgeRolleGueltig(r)) return nein("Die Bezeichnung bitte nur mit Buchstaben, höchstens 60 Zeichen (z. B. „selbstständiger Vermögensberater“).");
    neu.rolle = r || null;
    teile.push(r ? `Bezeichnung auf der Kundenseite: „${r}“` : "Bezeichnung auf der Kundenseite: Vorgabe");
  }
  if (!teile.length) return bleibt ? { ok: true, meldung: bleibt } : nein("Nichts zu ändern.");
  await sqlPool`UPDATE fiaon_global_angebote SET schalter = COALESCE(schalter, '{}'::jsonb) || ${sqlPool.json(neu as any)}, updated_at = NOW() WHERE id = ${Number(z.id)}`;
  const { verlaufAngebot } = await import("./fiaon-global-angebot");
  await verlaufAngebot(Number(z.id), wer, teile.join(" · ")).catch(() => {});
  return { ok: true, meldung: `Gespeichert: ${teile.join(" · ")}.` };
}

// ═══════════════════════════════════════════════════════════════════════════
// MONATSABRECHNUNG PER GUTSCHRIFT (E-420, 22.10.2026)
//
// Justin: „bau die automatische Monatsabrechnung mit Gutschrift“. Ablauf je Partner mit Provision, für jeden abgeschlossenen
// Monat (frühestens am 3. des Folgemonats — Puffer für Buchungen mit Eingangstag im Vormonat):
//   1. Posten = jede gebuchte Zahlung eines zugeordneten empfohlenen Kunden in diesem Monat (UMSATZ_QUELLE_SQL), innerhalb der
//      12 Monate ab Meldung, ohne Durchlaufposten; Provision je Zahlung = kaufmännisch gerundet.
//   2. Summe > 0 → Gutschrift mit fortlaufender Nummer FIAON-GS-JJJJ-NNNNN (fiaon_counters „gutschrift-JJJJ“), PDF, Mail an den Partner.
//   3. Bankverbindung im Partnerbereich hinterlegt → Zahlungsauftrag im FIAON Banking (Entwurf des Inhabers, Beleg = Gutschrift-PDF);
//      ausgezahlt ist die Gutschrift erst, wenn die Buchhaltung den Auftrag ausgeführt hat (E-347). Ohne Bankverbindung: Bitte in der
//      Mail und Aufgabe an Justin; der Auftrag entsteht im nächsten Lauf, sobald die IBAN da ist.
// Nie doppelt: UNIQUE(angebot_id, monat) unter Advisory-Lock. Bewegt nie selbst Geld.
//
// E-487 (09.11.2026): NACHTRAG. Posten = je zählender Zahlung bis zum Monatsende die Provision nach der Regel heute minus das, was
// für genau diese Zahlung schon gutgeschrieben ist (shared: koopOffenePosten) — Zahlungen aus früheren Monaten und Differenzen
// heißen „Nachtrag“. Spalte art: 'monat' (wie bisher, je Partner und Monat eine) | 'nachtrag' (Knopf „Nachtrag jetzt abrechnen“,
// je Partner und Monat höchstens einer; monat = der letzte schon abgerechnete Monat). UNIQUE(angebot_id, monat, art). Posten werden
// UNTER dem Advisory-Lock gerechnet — Monatslauf und Knopf zugleich schreiben nie dieselbe Zahlung zweimal gut.
// ═══════════════════════════════════════════════════════════════════════════
const GS_SPERRE = 4_200_420;
let gsBereit: Promise<void> | null = null;
/**
 * Dieselbe DDL wie Migration 118 — additiv. E-487: Spalte art und UNIQUE(angebot_id, monat, art) statt UNIQUE(angebot_id, monat) —
 * nur wenn es fehlt (Blick in den Katalog) und dann mit lock_timeout (keine Migration von außen).
 */
export function ensureGutschriftTabelle(): Promise<void> {
  if (!gsBereit) {
    gsBereit = (async () => {
      await sqlPool`
        CREATE TABLE IF NOT EXISTS fiaon_koop_gutschriften (
          id BIGSERIAL PRIMARY KEY,
          angebot_id INTEGER NOT NULL,
          monat VARCHAR(7) NOT NULL,
          art VARCHAR(10) NOT NULL DEFAULT 'monat',
          nummer TEXT NOT NULL UNIQUE,
          prozent NUMERIC(5,2) NOT NULL,
          betrag_cents INTEGER NOT NULL,
          posten JSONB NOT NULL DEFAULT '[]'::jsonb,
          erstellt_am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          mail_am TIMESTAMPTZ,
          mail_ergebnis TEXT,
          auftrag_id INTEGER,
          aufgabe_am TIMESTAMPTZ,
          CONSTRAINT fiaon_koop_gutschriften_monat_art_key UNIQUE (angebot_id, monat, art)
        )`;
      const [k] = (await sqlPool`
        SELECT
          EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'fiaon_koop_gutschriften' AND column_name = 'art') AS art,
          EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fiaon_koop_gutschriften_angebot_id_monat_key') AS alt,
          to_regclass('fiaon_koop_gutschriften_monat_art_key') IS NOT NULL AS neu`) as any[];
      if (!k?.art || k?.alt || !k?.neu) {
        await sqlPool.begin(async (tx: any) => {
          await tx`SET LOCAL lock_timeout = '3s'`;
          await tx`ALTER TABLE fiaon_koop_gutschriften ADD COLUMN IF NOT EXISTS art VARCHAR(10) NOT NULL DEFAULT 'monat'`;
          await tx`CREATE UNIQUE INDEX IF NOT EXISTS fiaon_koop_gutschriften_monat_art_key ON fiaon_koop_gutschriften (angebot_id, monat, art)`;
          await tx`ALTER TABLE fiaon_koop_gutschriften DROP CONSTRAINT IF EXISTS fiaon_koop_gutschriften_angebot_id_monat_key`;
        });
      }
    })().catch((e) => { gsBereit = null; throw e; });
  }
  return gsBereit;
}

const MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
export const gsMonatText = (m: string) => `${MONATE[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
const berlinMonat = (d: Date) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit" }).format(d).slice(0, 7);
const berlinTagNr = (d: Date) => Number(new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "numeric" }).format(d));
const vormonat = (m: string) => { const [j, mo] = m.split("-").map(Number); return mo === 1 ? `${j - 1}-12` : `${j}-${String(mo - 1).padStart(2, "0")}`; };

/** Ein Posten einer Gutschrift (E-487: mit Schlüssel und Nachtrag-Marke — shared/fiaon-koop-empfehlung.ts). */
export type GsPosten = KoopGsPosten;

/**
 * E-487: die zählenden Zahlungen eines Partners (nach dem Fast-Track-Abzug) — bis einschließlich `bisMonat` (Berlin), mit
 * `nurMonat` nur dieser Monat. `lauf` = sqlPool oder die Transaktion unter dem Advisory-Lock.
 */
async function koopZahlungenLesen(angebotId: number, bisMonat: string, abzug: string, lauf: any = sqlPool, nurMonat = false): Promise<KoopZahlung[]> {
  const roh = (await lauf.unsafe(`
    WITH q AS (${UMSATZ_QUELLE_SQL})
    SELECT e.id AS eid, e.name, q.ref, q.am, q.rate_nr, q.teil_vorher_cents, (q.cents - ${abzug}) AS cents
      FROM fiaon_koop_empfehlungen e
      JOIN q ON q.person_id = e.person_id AND q.am >= e.gemeldet_am AND q.am < e.gemeldet_am + make_interval(months => $2)
     WHERE e.angebot_id = $1 AND e.entfernt_am IS NULL AND e.person_id IS NOT NULL
       AND to_char(q.am AT TIME ZONE 'Europe/Berlin', 'YYYY-MM') ${nurMonat ? "=" : "<="} $3
       AND NOT EXISTS (SELECT 1 FROM fiaon_applications ax WHERE ax.ref = q.ref AND ax.pack_key = ANY($4::text[]))
       AND ${KOOP_NUR_ERSTE_EMPFEHLUNG_SQL}
     ORDER BY q.am, e.id`, [angebotId, KOOP_PROVISION_MONATE, bisMonat, [...KOOP_DURCHLAUF_SCHLUESSEL]])) as any[];
  return roh.map((r) => ({
    empfehlungId: Number(r.eid), name: String(r.name), ref: String(r.ref), am: new Date(r.am).toISOString(),
    rateNr: r.rate_nr != null ? Number(r.rate_nr) : null, teilVorherCents: Number(r.teil_vorher_cents ?? 0), umsatzCents: Number(r.cents),
  }));
}
/** E-487: alle Posten aller bisherigen Gutschriften eines Partners (für „schon gutgeschrieben“; mit Zahlbetrag für alte Posten). */
async function bisherigePosten(angebotId: number, lauf: any = sqlPool): Promise<KoopBisherPosten[]> {
  const rows = (await lauf`SELECT posten FROM fiaon_koop_gutschriften WHERE angebot_id = ${angebotId}`) as any[];
  return rows.flatMap((r) => { const p = json<unknown>(r.posten, []); return Array.isArray(p) ? (p as KoopBisherPosten[]) : []; });
}

/**
 * Die Posten eines Monats (Berliner Kalendermonat), volle Provision je Zahlung — rein lesend (Vorschau des Monatsberichts).
 * E-487 Nachbesserung (Mangel 8): je Zahlung der Satz an ihrem Zahltag.
 */
export async function koopGutschriftPosten(angebotId: number, monat: string, prov: KoopProvision | number): Promise<GsPosten[]> {
  await ensureEmpfehlungTabelle();
  const zahlungen = await koopZahlungenLesen(angebotId, monat, koopAbzugSqlFuer(await refVon(angebotId).catch(() => null)), sqlPool, true);
  return zahlungen.map((r) => {
    const prozent = typeof prov === "number" ? prov : koopSatzAm(prov, r.am);
    return { empfehlungId: r.empfehlungId, name: r.name, ref: r.ref, am: r.am, umsatzCents: r.umsatzCents, provisionCents: koopProvisionCents(r.umsatzCents, prozent), prozent };
  });
}

/**
 * E-487 Nachbesserung (Mangel 8): die Sätze einer Gutschrift — aus ihren Posten (ältere Posten ohne eigenen Satz: der Satz der
 * Gutschrift). Ein Satz → PDF, Mail und Aufgabe nennen ihn; mehrere → der Satz steht je Posten.
 */
function gsSaetze(g: any): number[] {
  const posten = json<GsPosten[]>(g.posten, []);
  const s = new Set(posten.map((p) => Number(p.prozent ?? g.prozent)).filter((x) => Number.isFinite(x)));
  if (!s.size) s.add(Number(g.prozent));
  return Array.from(s).sort((a, b) => a - b);
}
const pzText = (p: number) => String(Number(p)).replace(".", ",");

async function gutschriftNummer(jahr: number, tx: any): Promise<string> {
  const name = `gutschrift-${jahr}`;
  await tx`INSERT INTO fiaon_counters (name, value) VALUES (${name}, 0) ON CONFLICT (name) DO NOTHING`;
  const [r] = (await tx`UPDATE fiaon_counters SET value = value + 1 WHERE name = ${name} RETURNING value`) as any[];
  return `FIAON-GS-${jahr}-${String(r.value).padStart(5, "0")}`;
}

/**
 * Legt die Gutschrift eines Monats an (genau einmal je art). Rückgabe null = nichts zu tun (keine Provision, nichts offen oder schon da).
 * E-487: art „monat“ = alle offenen Posten bis Ende `monat` (ältere als Nachtrag markiert); art „nachtrag“ = alle offenen Posten bis
 * Ende `monat` (dem letzten schon abgerechneten Monat), jede als Nachtrag. Gerechnet wird unter dem Advisory-Lock.
 */
export async function koopGutschriftAnlegen(z: { [k: string]: any }, monat: string, art: "monat" | "nachtrag" = "monat"): Promise<{ id: number; nummer: string; betragCents: number } | null> {
  await ensureGutschriftTabelle(); await ensureEmpfehlungTabelle();
  const prov = koopProvisionAus(json<Record<string, unknown>>(z.schalter, {}));
  if (!prov) return null;
  const id = Number(z.id);
  const abzug = koopAbzugSqlFuer(z.angebot_ref ?? await refVon(id).catch(() => null));
  return sqlPool.begin(async (tx: any) => {
    await tx`SELECT pg_advisory_xact_lock(${GS_SPERRE}, ${id})`;
    const [da] = (await tx`SELECT id FROM fiaon_koop_gutschriften WHERE angebot_id = ${id} AND monat = ${monat} AND art = ${art}`) as any[];
    if (da) return null;
    // E-487 Nachbesserung (Mangel 8): jede Zahlung mit dem Satz an ihrem Zahltag (prov mit Verlauf), nie rückwirkend mit dem heutigen.
    const { posten } = koopOffenePosten(await koopZahlungenLesen(id, monat, abzug, tx), await bisherigePosten(id, tx), prov, art === "nachtrag" ? null : monat);
    const betrag = posten.reduce((s, p) => s + p.provisionCents, 0);
    if (betrag <= 0) return null;
    // Die Nummer trägt das Jahr des Monats (wie bisher); ein Nachtrag das Jahr, in dem er entsteht.
    const nummer = await gutschriftNummer(Number((art === "nachtrag" ? koopBerlinMonat(new Date()) : monat).slice(0, 4)), tx);
    // Spalte prozent: der eine Satz aller Posten — haben sie verschiedene, der heutige (der Satz steht dann je Posten).
    const saetze = Array.from(new Set(posten.map((p) => Number(p.prozent ?? prov.prozent))));
    const [r] = (await tx`
      INSERT INTO fiaon_koop_gutschriften (angebot_id, monat, art, nummer, prozent, betrag_cents, posten)
      VALUES (${id}, ${monat}, ${art}, ${nummer}, ${saetze.length === 1 ? saetze[0] : prov.prozent}, ${betrag}, ${tx.json(posten as any)}) RETURNING id`) as any[];
    return { id: Number(r.id), nummer, betragCents: betrag };
  });
}

/** E-487: Welcher Monat ist die Grenze eines Nachtrags? Der letzte Monat mit Monatsabrechnung — danach rechnet der Monatslauf selbst. */
async function nachtragBisMonat(angebotId: number, lauf: any = sqlPool): Promise<string | null> {
  const [r] = (await lauf`SELECT MAX(monat) AS m FROM fiaon_koop_gutschriften WHERE angebot_id = ${angebotId} AND art = 'monat'`) as any[];
  return r?.m ? String(r.m) : null;
}

/** E-487: Vorschau „Nachtrag jetzt abrechnen“ (nur lesen) — offene Posten bis zum letzten abgerechneten Monat. */
export async function koopNachtragVorschau(z: { [k: string]: any }): Promise<KoopNachtragVorschau | null> {
  await ensureGutschriftTabelle(); await ensureEmpfehlungTabelle();
  const prov = koopProvisionAus(json<Record<string, unknown>>(z.schalter, {}));
  if (!prov) return null;
  const id = Number(z.id);
  const bis = await nachtragBisMonat(id);
  const leer = (hinweis: string): KoopNachtragVorschau => ({ bisMonat: bis, bisText: bis ? gsMonatText(bis) : null, posten: [], summeCents: 0, summe: eur(0), schonDa: null, zuViel: [], hinweis });
  if (!bis) return leer("Noch keine Monatsabrechnung — offene Zahlungen rechnet der Monatslauf zum 3. des Folgemonats ab.");
  const { posten, zuViel } = koopOffenePosten(await koopZahlungenLesen(id, bis, koopAbzugSqlFuer(z.angebot_ref ?? await refVon(id))), await bisherigePosten(id), prov, null);
  const [da] = (await sqlPool`SELECT nummer FROM fiaon_koop_gutschriften WHERE angebot_id = ${id} AND monat = ${bis} AND art = 'nachtrag'`) as any[];
  const summe = posten.reduce((s, p) => s + p.provisionCents, 0);
  return {
    bisMonat: bis, bisText: gsMonatText(bis),
    posten: posten.map((p) => ({ name: p.name, amText: tag(p.am), umsatz: eur(p.umsatzCents), faellig: eur(p.faelligCents ?? p.provisionCents), schon: eur(p.schonCents ?? 0), nachtrag: eur(p.provisionCents), nachtragCents: p.provisionCents })),
    summeCents: summe, summe: eur(summe),
    schonDa: da ? { nummer: String(da.nummer) } : null,
    zuViel: zuViel.map((x) => ({ name: x.name, amText: tag(x.am), faellig: eur(x.faelligCents), schon: eur(x.schonCents) })),
    hinweis: !posten.length ? "Kein offener Nachtrag — jede zählende Zahlung ist voll gutgeschrieben." : da ? `Für Zahlungen bis ${gsMonatText(bis)} gibt es schon den Nachtrag ${da.nummer}. Was jetzt noch offen ist, kommt automatisch mit der nächsten Monatsabrechnung.` : null,
  };
}

/**
 * E-487: Knopf „Nachtrag jetzt abrechnen“ (Chefbüro). Legt die Nachtrags-Gutschrift an (PDF), schickt sie dem Partner, legt den
 * Zahlungsauftrag als ENTWURF im Banking an (nur mit Bankverbindung) und die Aufgabe „im Banking freigeben“ — derselbe Weg wie die
 * Monatsabrechnung. Bewegt nie Geld.
 */
export async function koopNachtragAbrechnen(z: { [k: string]: any }, wer: string): Promise<Ergebnis<{ nummer: string; betrag: string; auftrag: boolean; mail: boolean }>> {
  const prov = koopProvisionAus(json<Record<string, unknown>>(z.schalter, {}));
  if (!prov) return nein("Für diese Kooperation ist keine Provision gesetzt.");
  await ensureGutschriftTabelle();
  const id = Number(z.id);
  const bis = await nachtragBisMonat(id);
  if (!bis) return nein("Es gibt noch keine Monatsabrechnung — offene Zahlungen rechnet der Monatslauf zum 3. des Folgemonats ab.", 409);
  const g = await koopGutschriftAnlegen(z, bis, "nachtrag");
  if (!g) {
    const [da] = (await sqlPool`SELECT nummer FROM fiaon_koop_gutschriften WHERE angebot_id = ${id} AND monat = ${bis} AND art = 'nachtrag'`) as any[];
    return nein(da ? `Für Zahlungen bis ${gsMonatText(bis)} gibt es schon den Nachtrag ${da.nummer} — was jetzt noch offen ist, kommt mit der nächsten Monatsabrechnung.` : "Kein offener Nachtrag — jede zählende Zahlung ist voll gutgeschrieben.", 409);
  }
  const { verlaufAngebot } = await import("./fiaon-global-angebot");
  await verlaufAngebot(id, wer, `Nachtrags-Gutschrift ${g.nummer} über ${eur(g.betragCents)} (Zahlungen bis ${gsMonatText(bis)})`).catch(() => {});
  const [zeile] = (await sqlPool`SELECT * FROM fiaon_koop_gutschriften WHERE id = ${g.id}`) as any[];
  const n = zeile ? await gutschriftNachbereiten(zeile).catch((e) => { console.error(`[KOOP] Nachtrag ${g.nummer} nachbereiten:`, e); return { auftrag: false, mail: false }; }) : { auftrag: false, mail: false };
  return { ok: true, nummer: g.nummer, betrag: eur(g.betragCents), auftrag: n.auftrag, mail: n.mail };
}

/** Die Gutschrift als PDF (FIAON-Rahmen). E-487: Nachtrag-Posten tragen die Marke „Nachtrag“ (bei einer Differenz mit Rechnung). */
export async function koopGutschriftPdf(id: number): Promise<{ pdf: Buffer; dateiname: string } | null> {
  await ensureGutschriftTabelle();
  const [g] = (await sqlPool`SELECT * FROM fiaon_koop_gutschriften WHERE id = ${id}`) as any[];
  if (!g) return null;
  const { angebotLesen } = await import("./fiaon-global-angebot");
  const { koopDatenAus } = await import("./fiaon-global-angebot-koop");
  const { koopPartnerName } = await import("@shared/fiaon-global-angebot-koop");
  const z = await angebotLesen({ id: Number(g.angebot_id) });
  if (!z) return null;
  const d = koopDatenAus(z);
  const p = d.partner as any;
  const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const posten = json<GsPosten[]>(g.posten, []);
  const istNachtrag = String(g.art ?? "monat") === "nachtrag";
  // E-487 Nachbesserung (Mangel 8): ein Satz → im Satz oben; verschiedene Sätze (Zahlungen vor und nach einer Änderung) → je Posten.
  const saetze = gsSaetze(g);
  const prozentText = saetze.length === 1 ? pzText(saetze[0]) : null;
  const satzMarke = (x: GsPosten) => (prozentText ? "" : `Satz ${pzText(Number(x.prozent ?? g.prozent))} %`);
  const marke = (x: GsPosten) => {
    const teile = [x.nachtrag ? `Nachtrag${x.schonCents ? ` · Provision gesamt ${esc(eur(x.faelligCents ?? 0))}, bereits gutgeschrieben ${esc(eur(x.schonCents))}` : ""}` : "", satzMarke(x)].filter(Boolean);
    return teile.length ? `<br><span style="font-size:8pt;color:#475569">${teile.join(" · ")}</span>` : "";
  };
  const zeilen = posten.map((x, i) => `<tr><td>${i + 1}</td><td>${esc(tag(x.am))}</td><td>${esc(x.name)}${marke(x)}</td><td style="text-align:right">${esc(eur(x.umsatzCents))}</td><td style="text-align:right">${esc(eur(x.provisionCents))}</td></tr>`).join("");
  const satzKlammer = prozentText ? ` (${esc(prozentText)} %)` : "";
  const zeitraum = istNachtrag ? `Nachtrag zu Zahlungen bis ${gsMonatText(g.monat)}` : gsMonatText(g.monat);
  const body = `
    <table style="width:100%;font-size:9.5pt;margin-bottom:14px" cellpadding="3"><tr>
      <td style="vertical-align:top;width:55%"><b>Gutschriftsempfänger</b><br>${esc(koopPartnerName(p))}${p.firma ? `<br>${esc(p.firma)}` : ""}<br>${esc(p.strasse)}<br>${esc(p.plz)} ${esc(p.ort)}</td>
      <td style="vertical-align:top"><b>Gutschrift-Nr.</b> ${esc(g.nummer)}<br><b>Datum</b> ${esc(tag(g.erstellt_am))}<br><b>Zeitraum</b> ${esc(zeitraum)}<br><b>Vertrag</b> ${esc(d.ref)}</td>
    </tr></table>
    <p>${istNachtrag ? `Nachtrag zur Provision${satzKlammer} auf Zahlungen der von Ihnen empfohlenen Kunden, die in der bisherigen Abrechnung noch fehlten` : prozentText ? `Provision ${esc(prozentText)} % auf die Zahlungen der von Ihnen empfohlenen Kunden` : "Provision auf die Zahlungen der von Ihnen empfohlenen Kunden, je Zahlung mit dem Satz, der an ihrem Zahltag galt"} (Tippgeber-Vereinbarung zum Kooperationsvertrag ${esc(d.ref)}).</p>
    <table style="width:100%;border-collapse:collapse;font-size:9pt" border="0" cellpadding="4">
      <thead><tr style="border-bottom:1px solid #0f2044;text-align:left"><th>#</th><th>Zahlungseingang</th><th>Empfohlener Kunde</th><th style="text-align:right">Zahlung</th><th style="text-align:right">Provision</th></tr></thead>
      <tbody>${zeilen}</tbody>
      <tfoot><tr style="border-top:1px solid #0f2044"><td colspan="4"><strong>Gutschriftsbetrag</strong></td><td style="text-align:right"><strong>${esc(eur(Number(g.betrag_cents)))}</strong></td></tr></tfoot>
    </table>
    <p style="font-size:8.5pt;color:#475569;margin-top:14px">Gutschrift im Sinne des § 14 Abs. 2 Satz 2 UStG. Die Leistung wird an die FIAON LTD (Vereinigtes Königreich) erbracht; Leistungsort ist der Sitz des Leistungsempfängers — die Gutschrift weist deshalb keine Umsatzsteuer aus. Widerspricht der Empfänger dieser Gutschrift, verliert sie ihre Wirkung als Rechnung. Auszahlung binnen vierzehn Tagen auf das im Partnerbereich hinterlegte Konto.</p>`;
  const { wrapFiaonDocument, htmlZuPdfMitFusszeile } = await import("./fiaon-html-pdf");
  const titel = `Gutschrift ${g.nummer}`;
  const html = wrapFiaonDocument({ documentTitle: istNachtrag ? "Gutschrift (Nachtrag)" : "Gutschrift", subtitle: `Provision · ${istNachtrag ? `Nachtrag bis ${gsMonatText(g.monat)}` : gsMonatText(g.monat)}`, bodyHtml: body, markenzeile: "FIAON LTD · Company No. 17318250 · 128 City Road, London, EC1V 2NX, United Kingdom" });
  const pdf = await htmlZuPdfMitFusszeile({ html, titel, fusszeile: `FIAON LTD · ${g.nummer} · ${d.ref}`, rand: { oben: "18mm", unten: "20mm", links: "16mm", rechts: "16mm" } });
  return { pdf, dateiname: `${g.nummer}.pdf` };
}

/** Bankverbindung des Partners (selbst im Partnerbereich hinterlegt) — verschlüsselt im Schalter, angezeigt nur maskiert. */
export async function koopBankSetzen(z: { [k: string]: any }, roh: any, wer: string): Promise<Ergebnis<{ maske: string }>> {
  const { ibanSauber, ibanGueltig } = await import("./fiaon-buchhaltung");
  const inhaber = String(roh?.inhaber ?? "").replace(/[<>\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
  const iban = ibanSauber(String(roh?.iban ?? ""));
  if (inhaber.length < 3) return nein("Bitte den Kontoinhaber angeben.");
  if (!ibanGueltig(iban)) return nein("Diese IBAN ist nicht gültig — bitte noch einmal prüfen.");
  const { encryptSecret } = await import("../routes/fiaon-agent");
  const maske = `${iban.slice(0, 4)} •••• ${iban.slice(-4)}`;
  await sqlPool`UPDATE fiaon_global_angebote SET schalter = COALESCE(schalter, '{}'::jsonb) || ${sqlPool.json({ bank: { inhaber, ibanEnc: encryptSecret(iban), maske, am: new Date().toISOString() } } as any)}, updated_at = NOW() WHERE id = ${Number(z.id)}`;
  const { verlaufAngebot } = await import("./fiaon-global-angebot");
  await verlaufAngebot(Number(z.id), wer, `Bankverbindung für Provisionen hinterlegt (${maske})`).catch(() => {});
  return { ok: true, maske };
}
function bankAus(schalter: unknown): { inhaber: string; ibanEnc: string; maske: string } | null {
  const b = json<Record<string, any>>(schalter, {}).bank;
  return b && typeof b.ibanEnc === "string" && typeof b.inhaber === "string" ? { inhaber: b.inhaber, ibanEnc: b.ibanEnc, maske: String(b.maske ?? "") } : null;
}

/** Zahlungsauftrag im Banking (Entwurf des Inhabers, Beleg = PDF) — nur mit Bankverbindung, nur einmal je Gutschrift. */
async function gutschriftAuftrag(g: any, z: { [k: string]: any }): Promise<number | null> {
  if (g.auftrag_id) return Number(g.auftrag_id);
  const bank = bankAus(z.schalter);
  if (!bank) return null;
  const { decryptSecret } = await import("../routes/fiaon-agent");
  const iban = decryptSecret(bank.ibanEnc);
  if (!iban) return null;
  const pdf = await koopGutschriftPdf(Number(g.id));
  const B = await import("./fiaon-buchhaltung");
  const nachtrag = String(g.art ?? "monat") === "nachtrag";
  const a = await B.auftragAnlegen({
    empfaenger: bank.inhaber, iban, betragCents: Number(g.betrag_cents),
    zweck: `Gutschrift ${g.nummer} · Provision ${nachtrag ? `Nachtrag bis ${gsMonatText(g.monat)}` : gsMonatText(g.monat)}`, kategorie: "Provision Partner",
    belegName: pdf?.dateiname ?? null, belegBase64: pdf ? pdf.pdf.toString("base64") : null,
  }, B.inhaber());
  await sqlPool`UPDATE fiaon_koop_gutschriften SET auftrag_id = ${a.id} WHERE id = ${Number(g.id)} AND auftrag_id IS NULL`;
  return a.id;
}

/**
 * Versand, Banking-Auftrag (Entwurf) und Aufgabe zu EINER Gutschrift — was noch fehlt (auch, wenn die Bankverbindung erst später kam).
 * E-487: aus dem Stundenlauf herausgezogen, damit „Nachtrag jetzt abrechnen“ denselben Weg nimmt. Bewegt nie Geld.
 * E-487 Nachbesserung (Gutachten, Mangel 9): nur EINER zugleich je Gutschrift (pg_try_advisory_xact_lock) — drücken Leitung und
 * Stundenlauf gleichzeitig, bekäme der Partner sonst zwei Mails und das Banking zwei Auftrags-Entwürfe. Wer die Sperre nicht bekommt,
 * lässt es (der andere ist dran); wer sie hat, liest die Zeile frisch (was der vorige Lauf schon erledigte, bleibt erledigt).
 */
const GS_NACH_SPERRE = 4_200_421;
async function gutschriftNachbereiten(gRoh: any): Promise<{ auftrag: boolean; mail: boolean }> {
  return sqlPool.begin(async (tx: any) => {
    const [l] = (await tx`SELECT pg_try_advisory_xact_lock(${GS_NACH_SPERRE}, ${Number(gRoh.id)}) AS ok`) as any[];
    if (!l?.ok) return { auftrag: false, mail: false };
    // Frisch lesen — über den Pool, damit die Sperre-Transaktion keine Tabellen-Sperre über PDF und Mail hält.
    const [g] = (await sqlPool`SELECT * FROM fiaon_koop_gutschriften WHERE id = ${Number(gRoh.id)}`) as any[];
    return g ? gutschriftNachbereitenJetzt(g) : { auftrag: false, mail: false };
  });
}
async function gutschriftNachbereitenJetzt(g: any): Promise<{ auftrag: boolean; mail: boolean }> {
  const { koopDatenAus } = await import("./fiaon-global-angebot-koop");
  const { koopPartnerAnrede } = await import("@shared/fiaon-global-angebot-koop");
  const { angebotLesen } = await import("./fiaon-global-angebot");
  const z = await angebotLesen({ id: Number(g.angebot_id) });
  if (!z) return { auftrag: false, mail: false };
  const d = koopDatenAus(z);
  const nachtrag = String(g.art ?? "monat") === "nachtrag";
  const art = nachtrag ? " (Nachtrag)" : "";
  let auftrag = false; let mail = false;
  const auftragId = await gutschriftAuftrag(g, z).catch((e) => { console.error(`[KOOP] Auftrag zu ${g.nummer}:`, e); return null; });
  if (auftragId && !g.auftrag_id) {
    auftrag = true;
    // Die Aufgabe entstand vielleicht schon ohne Bankverbindung — Titel und Text nachziehen (der Schlüssel legt nie eine zweite an).
    if (g.aufgabe_am) await sqlPool`
      UPDATE fiaon_betreiber_todos SET titel = ${`Gutschrift ${g.nummer}: ${eur(Number(g.betrag_cents))} Provision${art} an ${d.partner.vorname} ${d.partner.nachname} — im Banking freigeben`},
             text = ${`Provision ${nachtrag ? `(Nachtrag zu Zahlungen bis ${gsMonatText(g.monat)})` : gsMonatText(g.monat)} aus dem Kooperationsvertrag ${d.ref}. Die Bankverbindung ist jetzt da: Im FIAON Banking › Aufträge liegt der Zahlungsauftrag als Entwurf (Beleg = Gutschrift) — einreichen bzw. „Zur Freigabe“ an Florentine. Das System bewegt kein Geld selbst.`},
             updated_at = NOW()
       WHERE schluessel = ${`koop-gutschrift:${g.id}`} AND status <> 'erledigt'`.catch(() => {});
  }
  if (!g.mail_am) {
    const pdf = await koopGutschriftPdf(Number(g.id));
    const { koopPartnerLink } = await import("./fiaon-koop-lieferung");
    const ohneBank = !bankAus(z.schalter);
    const { freitextSenden } = await import("../mail/motor");
    // E-487 Nachbesserung (Mangel 8): der Satz nur, wenn alle Posten denselben haben — sonst steht er je Posten in der Gutschrift.
    const saetze = gsSaetze(g);
    const pz = saetze.length === 1 ? `${pzText(saetze[0])} %` : "die vereinbarte Provision";
    const text = [
      nachtrag
        ? `Ihre Nachtrags-Gutschrift ${g.nummer} über ${eur(Number(g.betrag_cents))} liegt bei: ${pz} auf Zahlungen Ihrer empfohlenen Kunden, die in Ihrer bisherigen Abrechnung noch fehlten. Alle Posten stehen in der Gutschrift.`
        : `Ihre Provision für ${gsMonatText(g.monat)} ist abgerechnet: ${eur(Number(g.betrag_cents))} (${pz} auf die Zahlungen Ihrer empfohlenen Kunden). Die Gutschrift ${g.nummer} mit allen Posten liegt bei.`,
      ohneBank ? "Damit wir überweisen können, hinterlegen Sie bitte einmal Ihre Bankverbindung in Ihrem Partnerbereich (Abschnitt „Ihre Auszahlungen“)." : "Wir überweisen den Betrag in den nächsten Tagen auf Ihr hinterlegtes Konto.",
      `Ihr Partnerbereich: ${koopPartnerLink(z)}`,
    ].join("\n\n");
    const betreff = nachtrag ? `Ihre Gutschrift ${g.nummer} — Nachtrag zu Ihrer Provision` : `Ihre Gutschrift ${g.nummer} — Provision ${gsMonatText(g.monat)}`;
    const r = await freitextSenden({ an: d.partner.email, betreff, text, anrede: `${koopPartnerAnrede(d.partner)},`, absender: "accounting", anhaenge: pdf ? [{ name: pdf.dateiname, inhalt: pdf.pdf }] : [] });
    const { mailProtokoll } = await import("./fiaon-mail-log");
    await mailProtokoll({ event: "koop_gutschrift", personId: z.person_id != null ? Number(z.person_id) : null, empfaenger: d.partner.email, status: r.ok ? "versandt" : "fehlgeschlagen", grund: r.grund ?? null, payload: { betreff: g.nummer }, ausgeloestVon: "Kooperation (Automatik)", brevoMessageId: r.messageId }).catch(() => {});
    await sqlPool`UPDATE fiaon_koop_gutschriften SET mail_am = ${r.ok ? new Date() : null}, mail_ergebnis = ${r.ok ? "versandt" : String(r.grund ?? "fehlgeschlagen").slice(0, 300)} WHERE id = ${Number(g.id)}`;
    mail = !!r.ok;
  }
  if (!g.aufgabe_am) {
    const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
    await auftragFuerKunden({
      personId: null, ref: null,
      titel: `Gutschrift ${g.nummer}: ${eur(Number(g.betrag_cents))} Provision${art} an ${d.partner.vorname} ${d.partner.nachname} — ${auftragId ? "im Banking freigeben" : "Bankverbindung fehlt noch"}`,
      text: [`Provision ${nachtrag ? `(Nachtrag zu Zahlungen bis ${gsMonatText(g.monat)})` : gsMonatText(g.monat)} aus dem Kooperationsvertrag ${d.ref} (${gsSaetze(g).map(pzText).join(" / ")} %). Gutschrift-PDF ging automatisch an den Partner.`,
        auftragId ? "Im FIAON Banking › Aufträge liegt der Zahlungsauftrag als Entwurf (Beleg = Gutschrift) — einreichen bzw. „Zur Freigabe“ an Florentine." : "Der Partner hat noch keine Bankverbindung hinterlegt; der Zahlungsauftrag entsteht automatisch, sobald er sie im Partnerbereich einträgt.",
        "Das System bewegt kein Geld selbst."].join("\n"),
      anBetreiber: true, dringend: false, schluessel: `koop-gutschrift:${g.id}`, bereich: "konten", quelle: "global", autorName: "FIAON Kooperation", link: "/chef/s/global-auftraege?reiter=angebote",
    }).then(() => sqlPool`UPDATE fiaon_koop_gutschriften SET aufgabe_am = NOW() WHERE id = ${Number(g.id)}`).catch((e) => console.error(`[KOOP] Aufgabe zu ${g.nummer}:`, e));
  }
  return { auftrag, mail };
}

/** Stundenlauf (aus koopLieferLauf): Gutschriften für abgeschlossene Monate, Mail, Banking-Auftrag, Aufgabe. Wirft nie. */
export async function koopGutschriftenLauf(jetzt = new Date()): Promise<{ angelegt: number; mails: number; auftraege: number }> {
  let angelegt = 0; let mails = 0; let auftraege = 0;
  try {
    await ensureGutschriftTabelle(); await ensureEmpfehlungTabelle();
    const partner = (await sqlPool`
      SELECT * FROM fiaon_global_angebote WHERE fassung LIKE 'IA-KOOP-%' AND status = 'angenommen' AND (schalter->'provision'->>'prozent') IS NOT NULL`) as any[];
    const bis = berlinTagNr(jetzt) >= 3 ? vormonat(berlinMonat(jetzt)) : vormonat(vormonat(berlinMonat(jetzt)));
    for (const z of partner) {
      const [erste] = (await sqlPool`SELECT MIN(gemeldet_am) AS m FROM fiaon_koop_empfehlungen WHERE angebot_id = ${Number(z.id)} AND entfernt_am IS NULL AND person_id IS NOT NULL`) as any[];
      if (!erste?.m) continue;
      // E-487: Jede Monatsabrechnung nimmt offene Nachträge (spät zugeordnete Zahlungen, Differenzen) aus früheren Monaten mit.
      for (let m = berlinMonat(new Date(erste.m)); m <= bis; m = (() => { const [j, mo] = m.split("-").map(Number); return mo === 12 ? `${j + 1}-01` : `${j}-${String(mo + 1).padStart(2, "0")}`; })()) {
        if (await koopGutschriftAnlegen(z, m).catch((e) => { console.error(`[KOOP] Gutschrift ${z.angebot_ref} ${m}:`, e); return null; })) angelegt++;
      }
    }
    // E-421: Erst der Monatsbericht — er trägt die Gutschrift des Monats als Anhang (dann keine zweite Mail).
    {
      const { angebotLesen } = await import("./fiaon-global-angebot");
      for (const roh of partner) {
        const z = await angebotLesen({ id: Number(roh.id) }).catch(() => null);
        if (z) await koopMonatsberichtSenden(z, bis).catch((e) => console.error(`[KOOP] Monatsbericht ${roh.angebot_ref} ${bis}:`, e));
      }
    }
    // Versand, Banking-Auftrag und Aufgabe — auch für Gutschriften, deren Bankverbindung erst später kam.
    const offen = (await sqlPool`SELECT * FROM fiaon_koop_gutschriften WHERE mail_am IS NULL OR auftrag_id IS NULL OR aufgabe_am IS NULL ORDER BY id LIMIT 50`) as any[];
    for (const g of offen) {
      const n = await gutschriftNachbereiten(g).catch((e) => { console.error(`[KOOP] Gutschrift ${g.nummer} nachbereiten:`, e); return { auftrag: false, mail: false }; });
      if (n.auftrag) auftraege++;
      if (n.mail) mails++;
    }
  } catch (e) {
    console.error("[KOOP] Gutschriften-Lauf:", e instanceof Error ? e.message : e);
  }
  return { angelegt, mails, auftraege };
}

/** Gutschriften eines Partners für Partnerbereich und Chefbüro (Stand aus dem Banking: ausgeführt = ausgezahlt). E-487: mit art. */
export async function koopGutschriftenListe(angebotId: number): Promise<{ id: number; nummer: string; monatText: string; betrag: string; betragCents: number; stand: "abgerechnet" | "zur Auszahlung" | "ausgezahlt"; art: string; posten: GsPosten[] }[]> {
  await ensureGutschriftTabelle();
  const [t] = (await sqlPool`SELECT to_regclass('public.fiaon_buch_auftrag') AS t`) as any[];
  const rows = (t?.t
    ? await sqlPool`SELECT g.*, b.status AS auftrag_status FROM fiaon_koop_gutschriften g LEFT JOIN fiaon_buch_auftrag b ON b.id = g.auftrag_id WHERE g.angebot_id = ${angebotId} ORDER BY g.monat DESC, g.erstellt_am DESC`
    : await sqlPool`SELECT g.*, NULL AS auftrag_status FROM fiaon_koop_gutschriften g WHERE g.angebot_id = ${angebotId} ORDER BY g.monat DESC, g.erstellt_am DESC`) as any[];
  return rows.map((g) => ({
    id: Number(g.id), nummer: String(g.nummer), monatText: gsMonatText(String(g.monat)), betrag: eur(Number(g.betrag_cents)), betragCents: Number(g.betrag_cents),
    stand: g.auftrag_status === "ausgefuehrt" ? "ausgezahlt" : g.auftrag_id ? "zur Auszahlung" : "abgerechnet",
    art: String(g.art ?? "monat"),
    posten: json<GsPosten[]>(g.posten, []),
  }));
}
export function koopBankMaske(schalter: unknown): { inhaber: string; maske: string } | null {
  const b = bankAus(schalter);
  return b ? { inhaber: b.inhaber, maske: b.maske } : null;
}

// ═══════════════════════════════════════════════════════════════════════════
// MONATSBERICHT AN DEN PARTNER (E-421) — Texte: koopMonatsbericht in shared/fiaon-koop-empfehlung.ts.
// Einmal je Partner und Monat (Tabelle fiaon_koop_monatsberichte, Migration 119), ab dem 3. für den Vormonat, nur solange
// mindestens eine Empfehlung im Monat zählt. Höchstens drei Versuche; die Gutschrift des Monats hängt an.
// ═══════════════════════════════════════════════════════════════════════════
let mbBereit: Promise<void> | null = null;
export function ensureMonatsberichtTabelle(): Promise<void> {
  if (!mbBereit) {
    mbBereit = (async () => {
      await sqlPool`
        CREATE TABLE IF NOT EXISTS fiaon_koop_monatsberichte (
          id BIGSERIAL PRIMARY KEY,
          angebot_id INTEGER NOT NULL,
          monat VARCHAR(7) NOT NULL,
          versuche INTEGER NOT NULL DEFAULT 1,
          gesendet_am TIMESTAMPTZ,
          ergebnis TEXT,
          gutschrift_id BIGINT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (angebot_id, monat)
        )`;
    })().catch((e) => { mbBereit = null; throw e; });
  }
  return mbBereit;
}

async function koopLetzterBericht(angebotId: number): Promise<{ monatText: string; am: string } | null> {
  await ensureMonatsberichtTabelle();
  const [r] = (await sqlPool`SELECT monat, gesendet_am FROM fiaon_koop_monatsberichte WHERE angebot_id = ${angebotId} AND gesendet_am IS NOT NULL ORDER BY monat DESC LIMIT 1`) as any[];
  return r ? { monatText: gsMonatText(String(r.monat)), am: tag(r.gesendet_am) } : null;
}

/** Der Bericht eines Monats — für Versand und Vorschau im Chefbüro. null = in diesem Monat zählt keine Empfehlung. */
export async function koopMonatsberichtBauen(z: { [k: string]: any }, monat: string) {
  await ensureEmpfehlungTabelle(); await ensureGutschriftTabelle();
  const prov = koopProvisionAus(json<Record<string, unknown>>(z.schalter, {}));
  if (!prov) return null;
  const zaehlt = (await sqlPool`
    SELECT id, to_char(gemeldet_am AT TIME ZONE 'Europe/Berlin', 'YYYY-MM') AS m FROM fiaon_koop_empfehlungen
     WHERE angebot_id = ${Number(z.id)} AND entfernt_am IS NULL
       AND to_char(gemeldet_am AT TIME ZONE 'Europe/Berlin', 'YYYY-MM') <= ${monat}
       AND to_char((gemeldet_am + make_interval(months => ${KOOP_PROVISION_MONATE})) AT TIME ZONE 'Europe/Berlin', 'YYYY-MM') >= ${monat}`) as any[];
  if (!zaehlt.length) return null;
  const neuIds = new Set(zaehlt.filter((x) => x.m === monat).map((x) => Number(x.id)));
  const sicht = await koopEmpfehlungSicht(z);
  // E-487: nur die Monatsabrechnung des Monats hängt am Bericht (ein Nachtrag hat seine eigene Mail).
  const [g] = (await sqlPool`SELECT * FROM fiaon_koop_gutschriften WHERE angebot_id = ${Number(z.id)} AND monat = ${monat} AND art = 'monat'`) as any[];
  const posten = g ? [] : await koopGutschriftPosten(Number(z.id), monat, prov);
  const { koopDatenAus } = await import("./fiaon-global-angebot-koop");
  const { koopPartnerAnrede } = await import("@shared/fiaon-global-angebot-koop");
  const { koopPartnerLink } = await import("./fiaon-koop-lieferung");
  const d = koopDatenAus(z as any);
  const bericht = koopMonatsbericht({
    monatText: gsMonatText(monat), anrede: `${koopPartnerAnrede(d.partner)},`, prozent: prov.prozent, link: koopPartnerLink(z as any),
    liste: sicht.liste.map((x) => ({ name: x.name, standText: x.standText, provision: x.provision, neu: neuIds.has(x.id) })),
    zahlen: {
      gesamt: sicht.liste.length, kunden: sicht.liste.filter((x) => x.stand === "kunde").length, neu: neuIds.size,
      monatProvision: eur(posten.reduce((a, p) => a + p.provisionCents, 0)), verdient: sicht.summe.provision, ausgezahlt: sicht.summe.ausgezahlt, offen: sicht.summe.offen,
    },
    gutschrift: g ? { nummer: String(g.nummer), betrag: eur(Number(g.betrag_cents)) } : null,
    bank: sicht.bank ? { maske: sicht.bank.maske } : null,
  });
  return { bericht, gutschrift: g ?? null, an: String(d.partner.email ?? "") };
}

/** Der Baustein-Teil für den Mail-Motor (FIAON-Partner-Kopf, eigener Fuß). */
export function koopMonatsberichtBaustein(b: ReturnType<typeof koopMonatsbericht>, monatText: string) {
  return {
    absaetze: b.absaetze, daten: b.daten, knopf: b.knopf, knopf2: b.knopf2, fussnote: b.fussnote, anhang: b.anhang,
    preheader: `Ihr Überblick für ${monatText}: Empfehlungen, Stand und Provision.`, persoenlich: false,
    bereich: "business" as const, kopfSatz: "FIAON Partner", rechtsSatz: "Diese Übersicht gehört zu Ihrer Tippgeber-Vereinbarung mit FIAON.",
  };
}

/** Schickt den Bericht eines Monats genau einmal (höchstens drei Versuche). Wirft nicht nach außen über den Lauf hinaus. */
export async function koopMonatsberichtSenden(z: { [k: string]: any }, monat: string): Promise<boolean> {
  await ensureMonatsberichtTabelle();
  const [schon] = (await sqlPool`SELECT gesendet_am, versuche FROM fiaon_koop_monatsberichte WHERE angebot_id = ${Number(z.id)} AND monat = ${monat}`) as any[];
  if (schon && (schon.gesendet_am || Number(schon.versuche) >= 3)) return false;
  const bau = await koopMonatsberichtBauen(z, monat);
  if (!bau) return false;
  // Platz nehmen (atomar): neu anlegen oder einen offenen Versuch hochzählen — ein zweiter Lauf bekommt keine Zeile zurück.
  const [platz] = (await sqlPool`
    INSERT INTO fiaon_koop_monatsberichte (angebot_id, monat) VALUES (${Number(z.id)}, ${monat})
    ON CONFLICT (angebot_id, monat) DO UPDATE SET versuche = fiaon_koop_monatsberichte.versuche + 1
     WHERE fiaon_koop_monatsberichte.gesendet_am IS NULL AND fiaon_koop_monatsberichte.versuche < 3 AND fiaon_koop_monatsberichte.ergebnis IS NOT NULL
    RETURNING id`) as any[];
  if (!platz) return false;
  const g = bau.gutschrift;
  const pdf = g ? await koopGutschriftPdf(Number(g.id)) : null;
  const { freitextSenden } = await import("../mail/motor");
  const r = await freitextSenden({
    an: bau.an, betreff: bau.bericht.betreff, text: bau.bericht.text, absender: g ? "accounting" : "welcome",
    anhaenge: pdf ? [{ name: pdf.dateiname, inhalt: pdf.pdf }] : [], baustein: koopMonatsberichtBaustein(bau.bericht, gsMonatText(monat)),
  });
  const { mailProtokoll } = await import("./fiaon-mail-log");
  await mailProtokoll({ event: "koop_monatsbericht", personId: z.person_id != null ? Number(z.person_id) : null, empfaenger: bau.an, status: r.ok ? "versandt" : "fehlgeschlagen", grund: r.grund ?? null, payload: { betreff: bau.bericht.betreff }, ausgeloestVon: "Kooperation (Automatik)", brevoMessageId: r.messageId }).catch(() => {});
  await sqlPool`UPDATE fiaon_koop_monatsberichte SET gesendet_am = ${r.ok ? new Date() : null}, ergebnis = ${r.ok ? "versandt" : String(r.grund ?? "fehlgeschlagen").slice(0, 300)}, gutschrift_id = ${g ? Number(g.id) : null} WHERE id = ${Number(platz.id)}`;
  if (r.ok && g) await sqlPool`UPDATE fiaon_koop_gutschriften SET mail_am = NOW(), mail_ergebnis = 'im Monatsbericht' WHERE id = ${Number(g.id)} AND mail_am IS NULL`;
  if (r.ok) {
    const { verlaufAngebot } = await import("./fiaon-global-angebot");
    await verlaufAngebot(Number(z.id), "Kooperation (Automatik)", `Monatsbericht ${gsMonatText(monat)} an den Partner${g ? ` (mit Gutschrift ${g.nummer})` : ""}`).catch(() => {});
  }
  return r.ok;
}

// ═══════════════════════════════════════════════════════════════════════════
// E-487 (09.11.2026): WER HAT EMPFOHLEN? — für die Willkommens-Mail „Empfehlung“ (server/lib/fiaon-global-lead-post.ts)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Der Empfehlende zu einer Global-Anfrage (Partner des Kooperationsvertrags) — null = keine (nicht entfernte) Empfehlung.
 * E-487 Nachbesserung (Gutachten, Mangel 12): Taugt der Name des Partners nicht (leer), kommt trotzdem ein Empfehler zurück (name
 * „“) — die Willkommens-Mail nimmt dann „Ein Geschäftspartner von uns“ statt der Anfrage-Fassung. Scheitert das Lesen, WIRFT die
 * Funktion: Der Lauf lead_post wartet dann, statt die Willkommens-Mail wegen einer Störung für immer auszulassen.
 */
export async function koopEmpfehlerFuerAnfrage(anfrageId: number, lauf: any = sqlPool): Promise<{ name: string; nachname: string | null; anrede: "Herr" | "Frau" | null } | null> {
  const [r] = (await lauf`
    SELECT g.kunde FROM fiaon_koop_empfehlungen e JOIN fiaon_global_angebote g ON g.id = e.angebot_id
     WHERE e.anfrage_id = ${anfrageId} AND e.entfernt_am IS NULL ORDER BY e.id DESC LIMIT 1`) as any[];
  if (!r) return null;
  const p = json<Record<string, any>>(r.kunde, {});
  const vor = String(p.vorname ?? "").replace(/\s+/g, " ").trim();
  const nach = String(p.nachname ?? "").replace(/\s+/g, " ").trim();
  const name = `${vor} ${nach}`.trim();
  if (name.length < 2) return { name: "", nachname: null, anrede: null };
  return { name, nachname: nach || null, anrede: p.anrede === "Herr" || p.anrede === "Frau" ? p.anrede : null };
}

// ═══════════════════════════════════════════════════════════════════════════
// E-487 (09.11.2026): DER LAUF „koop_empfehlung_zuordnen“ (stündlich, server/routes.ts) — eigener Lauf, nicht im Lieferlauf.
//   1. Zuordnung: jede Empfehlung ohne Person (nicht von Hand gelöst) → Spuren suchen → shared koopZuordnungUrteil.
//      eindeutig → person_id setzen (nur wenn noch leer), Verlauf am Kooperationsvertrag, kurze Info an Justin (nur im Betrieb);
//      mehrdeutig/prüfen → EINE Aufgabe an Justin (Schlüssel koop-empfehlung-zuordnen:<id>, Marke zuordnung_frage_am).
//   2. Altbestand (Empfehlung ohne Anfrage, ohne Person, mit Telefon, keine Spur): EINE Aufgabe an die zuständige Person
//      (Schlüssel koop-empfehlung-anruf:<id>, Marke anruf_aufgabe_am) — nie eine Mail an die empfohlene Person.
// E-487 Nachbesserung (Gutachten):
//   · Mangel 1/4: „eindeutig“ nur über Anfrage, E-Mail oder Telefon und nur, wenn die Person an keiner anderen Empfehlung hängt
//     (auch im UPDATE geprüft); ein Treffer nur über den Namen oder eine schon vergebene Person → Aufgabe an Justin mit Vorschlag
//     (zuordnung_vorschlag füllt im Chefbüro das Feld vor). Spuren nur bis Meldetag + KOOP_PROVISION_MONATE.
//   · Mangel 5: gesucht wird nur im Provisionsfenster (+1 Monat Puffer), ohne offene Frage an Justin, reihum nach
//     zuordnung_geprueft_am — 200 alte offene Fälle blockieren nie mehr die neuen.
//   · Mangel 6: der Altbestand-Anruf nur mit Einverständnis (Partner-Meldung oder Haken der Leitung).
//   · Mangel 13: scheitert die Hauptabfrage oder eine Empfehlung, steht der Lauf in der Historie als Fehler (kein stiller Erfolg).
// ═══════════════════════════════════════════════════════════════════════════
const tel9Aus = (v: unknown) => { const d = String(v ?? "").replace(/\D/g, ""); return d.length >= 9 ? d.slice(-9) : ""; };

/**
 * Alle Spuren zu einer Empfehlung ohne Person (Treffer nur ab Meldetag minus 30 Tage; Testkonten und Dubletten nie).
 * E-487 Nachbesserung: und nur bis Meldetag + KOOP_PROVISION_MONATE (Mangel 4). Scheitert eine Abfrage, scheitert die ganze Suche —
 * nie ein „eindeutig“ aus einer halben Suche, in der der zweite Kandidat fehlt (Mangel 13).
 */
async function zuordnungKandidaten(e: any): Promise<KoopZuordnungKandidat[]> {
  const ab = new Date(new Date(e.gemeldet_am).getTime() - KOOP_ZUORDNUNG_TAGE_VORHER * 86_400_000);
  const bis = new Date(e.gemeldet_am); bis.setUTCMonth(bis.getUTCMonth() + KOOP_PROVISION_MONATE);
  const email = String(e.email ?? "").trim().toLowerCase();
  const tel9 = tel9Aus(e.telefon);
  const anfrageId = e.anfrage_id != null ? Number(e.anfrage_id) : null;
  const kand: KoopZuordnungKandidat[] = [];
  const lies = async (was: string, q: () => Promise<any>): Promise<any[]> => {
    try { return (await q()) as any[]; } catch (err) { throw new Error(`Spurensuche (${was}): ${err instanceof Error ? err.message : String(err)}`); }
  };
  const nimm = (rows: any[], weg: string) => { for (const r of rows) if (r.id != null) kand.push({ personId: Number(r.id), weg, seit: r.created_at ?? null }); };
  const echt = sqlPool`p.merged_into_person_id IS NULL AND p.ist_test_am IS NULL`;
  if (anfrageId) {
    nimm(await lies("Anfrage", () => sqlPool`SELECT p.id, p.created_at FROM fiaon_anfragen an JOIN fiaon_persons p ON p.id = an.person_id WHERE an.id = ${anfrageId} AND ${echt}`), "anfrage");
    nimm(await lies("Lead-Gespräch", () => sqlPool`SELECT p.id, p.created_at FROM fiaon_lead_gespraech g JOIN fiaon_persons p ON p.id = g.person_id WHERE g.anfrage_id = ${anfrageId} AND ${echt}`), "anfrage");
    nimm(await lies("Firmen-Karte", () => sqlPool`SELECT p.id, p.created_at FROM fiaon_lead_weg w JOIN fiaon_firmen_leads f ON f.id = w.firma_id JOIN fiaon_persons p ON p.id = f.person_id WHERE w.anfrage_id = ${anfrageId} AND ${echt}`), "anfrage");
  }
  if (email) {
    nimm(await lies("E-Mail", () => sqlPool`
      SELECT p.id, p.created_at FROM fiaon_persons p WHERE ${echt} AND p.created_at >= ${ab} AND p.created_at < ${bis} AND LOWER(COALESCE(p.primary_email, '')) = ${email}
      UNION SELECT p.id, p.created_at FROM fiaon_applications a JOIN fiaon_persons p ON p.id = a.person_id
       WHERE ${echt} AND a.merged_into IS NULL AND NOT COALESCE(a.ist_entwurf, FALSE) AND a.created_at >= ${ab} AND a.created_at < ${bis} AND LOWER(COALESCE(a.email, '')) = ${email}
      UNION SELECT p.id, p.created_at FROM fiaon_global_angebote ga JOIN fiaon_persons p ON p.id = ga.person_id
       WHERE ${echt} AND ga.fassung NOT LIKE 'IA-KOOP-%' AND ga.created_at >= ${ab} AND ga.created_at < ${bis} AND jsonb_typeof(ga.kunde) = 'object' AND LOWER(COALESCE(ga.kunde->>'email', '')) = ${email}`), "email");
  }
  if (tel9) {
    nimm(await lies("Telefon", () => sqlPool`
      SELECT p.id, p.created_at FROM fiaon_persons p WHERE ${echt} AND p.created_at >= ${ab} AND p.created_at < ${bis}
         AND (p.phone_key9 = ${tel9} OR RIGHT(REGEXP_REPLACE(COALESCE(p.primary_phone, ''), '\\D', '', 'g'), 9) = ${tel9})
      UNION SELECT p.id, p.created_at FROM fiaon_applications a JOIN fiaon_persons p ON p.id = a.person_id
       WHERE ${echt} AND a.merged_into IS NULL AND NOT COALESCE(a.ist_entwurf, FALSE) AND a.created_at >= ${ab} AND a.created_at < ${bis} AND RIGHT(REGEXP_REPLACE(COALESCE(a.phone, ''), '\\D', '', 'g'), 9) = ${tel9}
      UNION SELECT p.id, p.created_at FROM fiaon_global_angebote ga JOIN fiaon_persons p ON p.id = ga.person_id
       WHERE ${echt} AND ga.fassung NOT LIKE 'IA-KOOP-%' AND ga.created_at >= ${ab} AND ga.created_at < ${bis} AND jsonb_typeof(ga.kunde) = 'object'
         AND RIGHT(REGEXP_REPLACE(COALESCE(ga.kunde->>'telefon', ''), '\\D', '', 'g'), 9) = ${tel9}`), "telefon");
  }
  // Name: vorfiltern über den Nachnamen (klein, mit und ohne Akzente), vergleichen in koopNamePasst (alle Teile gleich).
  const roh = String(e.name ?? "").toLowerCase().replace(new RegExp("[^\\p{L} -]", "gu"), " ").split(/\s+/).filter((x) => x.length >= 2);
  const teile = Array.from(new Set([...roh, ...koopNameTeile(e.name)]));
  if (koopNameTeile(e.name).length >= 2) {
    const n = await lies("Name", () => sqlPool`
      SELECT p.id, p.created_at, p.first_name AS vor, p.last_name AS nach, 'name' AS weg FROM fiaon_persons p
       WHERE ${echt} AND p.created_at >= ${ab} AND p.created_at < ${bis} AND LOWER(COALESCE(p.last_name, '')) = ANY(${teile}::text[])
      UNION ALL
      SELECT p.id, p.created_at, COALESCE(ga.kunde->>'vorname', ga.kunde->'vertretung'->>'vorname'), COALESCE(ga.kunde->>'nachname', ga.kunde->'vertretung'->>'nachname'), 'angebot'
        FROM fiaon_global_angebote ga JOIN fiaon_persons p ON p.id = ga.person_id
       WHERE ${echt} AND ga.fassung NOT LIKE 'IA-KOOP-%' AND ga.created_at >= ${ab} AND ga.created_at < ${bis} AND jsonb_typeof(ga.kunde) = 'object'
         AND LOWER(COALESCE(ga.kunde->>'nachname', ga.kunde->'vertretung'->>'nachname', '')) = ANY(${teile}::text[])`);
    for (const r of n) if (koopNamePasst(e.name, `${r.vor ?? ""} ${r.nach ?? ""}`)) kand.push({ personId: Number(r.id), weg: String(r.weg), seit: r.created_at ?? null });
  }
  // Firma: nur ein Name mit Rechtsform (z. B. „Muster Logistik GmbH“) verbindet über den Firmennamen.
  const { firmaNameVerbindet } = await import("@shared/fiaon-global-lead");
  const firma = String(e.name ?? "").replace(/\s+/g, " ").trim().toLowerCase();
  if (firmaNameVerbindet(e.name, "")) {
    nimm(await lies("Firma", () => sqlPool`
      SELECT p.id, p.created_at FROM fiaon_persons p WHERE ${echt} AND p.created_at >= ${ab} AND p.created_at < ${bis} AND LOWER(TRIM(COALESCE(p.company_name, ''))) = ${firma}
      UNION SELECT p.id, p.created_at FROM fiaon_global_angebote ga JOIN fiaon_persons p ON p.id = ga.person_id
       WHERE ${echt} AND ga.fassung NOT LIKE 'IA-KOOP-%' AND ga.created_at >= ${ab} AND ga.created_at < ${bis} AND jsonb_typeof(ga.kunde) = 'object' AND LOWER(TRIM(COALESCE(ga.kunde->>'firma', ''))) = ${firma}`), "firma");
  }
  return kand;
}

/** Kurze Info an Justin nach einer automatischen Zuordnung — nur im Betrieb (CRONS_AN), nie aus einem Prüflauf. Wirft nie. */
async function zuordnungMelden(e: any, partner: string, personId: number, wege: string[]): Promise<void> {
  if (!CRONS_AN) return;
  try {
    const { eigeneMailSenden } = await import("./fiaon-brevo");
    const { AUFRUF_MELDUNG_AN } = await import("./fiaon-global-angebot-aufrufe");
    const { absoluteUrl } = await import("../fiaon-base-url");
    const v = await eigeneMailSenden({
      an: AUFRUF_MELDUNG_AN, name: "Justin", betreff: `Empfehlung zugeordnet: ${e.name} → Person ${personId}`,
      text: [
        `Hallo Justin,`,
        `die Empfehlung „${e.name}“ von ${partner} (Kooperation ${e.angebot_ref}, gemeldet ${tag(e.gemeldet_am)}) ist jetzt automatisch Person ${personId} zugeordnet — gefunden über ${koopZuordnungWege(wege)}. Ab jetzt zählen ihre Zahlungen für die Provision.`,
        "Passt das nicht, im Chefbüro unter Global-Aufträge › Geschäftspartner › Empfehlungen die Personen-Nummer ändern oder leeren.",
      ].join("\n\n"),
      knoepfe: [{ text: "Im Chefbüro ansehen", url: absoluteUrl(CHEF_LINK) }],
    });
    if (!v.ok) console.error(`[KOOP] Info zur Zuordnung ${e.id} nicht gesendet: ${v.grund}`);
  } catch (err) { console.error(`[KOOP] Info zur Zuordnung ${e.id}:`, err instanceof Error ? err.message : err); }
}

/** E-487 Nachbesserung (Mangel 1): welche dieser Personen hängen schon an einer anderen (nicht entfernten) Empfehlung? Person → Empfehlung. */
async function belegteDurch(personIds: number[], eid: number): Promise<Map<number, number>> {
  const ids = Array.from(new Set(personIds.filter((x) => Number.isInteger(x) && x > 0)));
  if (!ids.length) return new Map();
  const rows = (await sqlPool`
    SELECT person_id, MIN(id)::int AS eid FROM fiaon_koop_empfehlungen
     WHERE person_id = ANY(${ids}::int[]) AND entfernt_am IS NULL AND id <> ${eid} GROUP BY person_id`) as any[];
  return new Map(rows.map((r): [number, number] => [Number(r.person_id), Number(r.eid)]));
}

/**
 * Der Stundenlauf: Empfehlungen ohne Person zuordnen, Altbestand mit Telefon einmal an die zuständige Person.
 * E-487 Nachbesserung (Mangel 13): Wirft, wenn die Hauptabfrage oder eine Empfehlung scheitert — die Lauf-Historie (tageslauf)
 * zeigt dann „Fehler“ statt eines stillen Erfolgs; die übrigen Empfehlungen sind trotzdem geprüft.
 */
export async function koopEmpfehlungenZuordnen(jetzt = new Date()): Promise<{ geprueft: number; zugeordnet: number; fragen: number; anrufe: number; fehler: number }> {
  const erg = { geprueft: 0, zugeordnet: 0, fragen: 0, anrufe: 0, fehler: 0 };
  const [t] = (await sqlPool`SELECT to_regclass('public.fiaon_global_angebote') AS g, to_regclass('public.fiaon_koop_empfehlungen') AS e`) as any[];
  if (!t?.g || !t?.e) return erg;
  await ensureEmpfehlungTabelle();
  // Zehn Minuten Abstand zur Meldung: so lange legt das Eintragen die Anfrage an (sonst sähe der Lauf „Altbestand“).
  // E-487 Nachbesserung (Mangel 5): nur im Provisionsfenster (+1 Monat Puffer), ohne offene Frage an Justin, reihum.
  const offen = (await sqlPool`
    SELECT e.*, g.angebot_ref, g.kunde AS partner_roh
      FROM fiaon_koop_empfehlungen e JOIN fiaon_global_angebote g ON g.id = e.angebot_id
     WHERE e.entfernt_am IS NULL AND e.person_id IS NULL AND COALESCE(e.zuordnung_weg, '') <> 'hand_geloest'
       AND e.zuordnung_frage_am IS NULL
       AND g.fassung LIKE 'IA-KOOP-%' AND g.status = 'angenommen'
       AND e.gemeldet_am < ${jetzt}::timestamptz - INTERVAL '10 minutes'
       AND e.gemeldet_am > ${jetzt}::timestamptz - make_interval(months => ${KOOP_PROVISION_MONATE + 1})
     ORDER BY e.zuordnung_geprueft_am NULLS FIRST, e.id LIMIT 200`) as any[];
  if (!offen.length) return erg;
  const { verlaufAngebot } = await import("./fiaon-global-angebot");
  const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
  const fehlerText: string[] = [];
  for (const e of offen) {
    erg.geprueft++;
    try {
      const partner = partnerNameAus(e.partner_roh);
      const kandidaten = await zuordnungKandidaten(e);
      const belegt = await belegteDurch(kandidaten.map((k) => Number(k.personId)), Number(e.id));
      const urteil = koopZuordnungUrteil(kandidaten, e.gemeldet_am, { belegt });
      if (urteil.art === "eindeutig") {
        // Auch hier noch einmal: nie eine Person, die inzwischen an einer anderen Empfehlung hängt (Mangel 1).
        const [r] = (await sqlPool`
          UPDATE fiaon_koop_empfehlungen SET person_id = ${urteil.personId}, zuordnung_am = NOW(), zuordnung_weg = ${urteil.wege.join(",")},
                 zuordnung_vorschlag = NULL, zuordnung_geprueft_am = NOW()
           WHERE id = ${Number(e.id)} AND person_id IS NULL AND COALESCE(zuordnung_weg, '') <> 'hand_geloest'
             AND NOT EXISTS (SELECT 1 FROM fiaon_koop_empfehlungen x WHERE x.person_id = ${urteil.personId} AND x.entfernt_am IS NULL AND x.id <> ${Number(e.id)})
           RETURNING id`) as any[];
        if (r) {
          erg.zugeordnet++;
          await verlaufAngebot(Number(e.angebot_id), "Automatik (Empfehlung zuordnen)", `Empfehlung ${e.name}: Person ${urteil.personId} automatisch zugeordnet (über ${koopZuordnungWege(urteil.wege)})`).catch(() => {});
          await zuordnungMelden(e, partner, urteil.personId, urteil.wege);
        }
        continue;
      }
      if (urteil.art === "mehrdeutig" || urteil.art === "pruefen") {
        const zeilen = urteil.art === "mehrdeutig"
          ? [`Die Automatik hat mehrere passende Personen gefunden: ${urteil.personen.map((p) => `Person ${p.personId} (über ${koopZuordnungWege(p.wege)})`).join("; ")}.`]
          : [`Gefunden: Person ${urteil.personId} (über ${koopZuordnungWege(urteil.wege)}).`, ...koopZuordnungGruendeText(urteil, (d) => tag(d))];
        const vorschlag = urteil.art === "mehrdeutig" ? { personen: urteil.personen } : { personId: urteil.personId, wege: urteil.wege, gruende: urteil.gruende };
        await auftragFuerKunden({
          personId: null, ref: null,
          titel: `Empfehlung „${e.name}“ von ${partner}: Person bitte zuordnen`,
          text: [`${partner} hat „${e.name}“ empfohlen (Kooperation ${e.angebot_ref}, gemeldet ${tag(e.gemeldet_am)}).`, ...zeilen,
            urteil.art === "pruefen"
              ? `Im Chefbüro unter Global-Aufträge › Geschäftspartner › Empfehlungen steht Person ${urteil.personId} schon im Feld — passt sie, „Zuordnen“ drücken; erst dann zählt die Provision. Passt keine, das Feld leer speichern: dann ordnet die Automatik hier nichts mehr zu.`
              : "Im Chefbüro unter Global-Aufträge › Geschäftspartner › Empfehlungen die richtige Personen-Nummer eintragen und „Zuordnen“ — erst dann zählt die Provision. Passt keine, das Feld leer speichern: dann ordnet die Automatik hier nichts mehr zu."].join("\n"),
          anBetreiber: true, dringend: false, schluessel: `koop-empfehlung-zuordnen:${e.id}`, bereich: "konten", quelle: "global", autorName: "FIAON Kooperation", link: CHEF_LINK,
        });
        await sqlPool`UPDATE fiaon_koop_empfehlungen SET zuordnung_frage_am = NOW(), zuordnung_vorschlag = ${sqlPool.json(vorschlag as any)}, zuordnung_geprueft_am = NOW() WHERE id = ${Number(e.id)}`;
        erg.fragen++;
        continue;
      }
      // Altbestand: keine Anfrage, keine Spur, aber eine Telefonnummer → einmal anrufen lassen (nie eine automatische Mail).
      // E-487 Nachbesserung (Mangel 6): nur mit Einverständnis — eine Partner-Meldung hatte es immer (E-419), die Leitung per Haken.
      const einverstanden = !!e.einverstanden_am || String(e.quelle) === "partner";
      if (e.anfrage_id == null && !e.anruf_aufgabe_am && einverstanden && String(e.telefon ?? "").replace(/\D/g, "").length >= 6) {
        const { globalZustaendig } = await import("./fiaon-global-termin");
        const { berlinToday } = await import("./fiaon-time");
        const zust = await globalZustaendig().catch(() => null);
        await auftragFuerKunden({
          personId: null, ref: null,
          titel: `Empfehlung von ${partner} anrufen: ${e.name}`,
          text: [`${partner} hat ${e.name} empfohlen (Kooperation ${e.angebot_ref}, gemeldet ${tag(e.gemeldet_am)}). Die Person ist einverstanden, dass wir uns melden.`,
            `Telefon: ${e.telefon}`, e.email ? `E-Mail: ${e.email}` : "", e.notiz ? `Worum es geht (Notiz des Partners): ${e.notiz}` : "",
            "Bitte anrufen und das Gespräch mit Justin vereinbaren. Eine Mail bekommt die Person von uns nicht automatisch (Empfehlung von vor dem neuen Weg)."].filter(Boolean).join("\n"),
          faelligAm: berlinToday(), dringend: true, schluessel: `koop-empfehlung-anruf:${e.id}`, bereich: "sonstiges", quelle: "global", autorName: "FIAON Partnerbereich",
          agentId: zust?.id ?? null, ...(zust ? {} : { anBetreiber: true }),
        });
        await sqlPool`UPDATE fiaon_koop_empfehlungen SET anruf_aufgabe_am = NOW() WHERE id = ${Number(e.id)}`;
        erg.anrufe++;
      }
      await sqlPool`UPDATE fiaon_koop_empfehlungen SET zuordnung_geprueft_am = NOW() WHERE id = ${Number(e.id)}`;
    } catch (err) {
      erg.fehler++;
      const m = err instanceof Error ? err.message : String(err);
      fehlerText.push(`#${e.id}: ${m.slice(0, 160)}`);
      console.error(`[KOOP] Zuordnung der Empfehlung ${e.id}:`, m);
    }
  }
  if (erg.fehler) throw new Error(`${erg.fehler} von ${erg.geprueft} Empfehlungen ließen sich nicht prüfen (${fehlerText.slice(0, 3).join(" · ")}) — zugeordnet ${erg.zugeordnet}, Fragen ${erg.fragen}, Anrufe ${erg.anrufe}`);
  return erg;
}
