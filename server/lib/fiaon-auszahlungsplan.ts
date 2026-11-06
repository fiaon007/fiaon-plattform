// ═══════════════════════════════════════════════════════════════════════════
// AUSZAHLUNGSPLAN IM FIAON BANKING (E-484, 06.11.2026)
//
// Ein zugesagter Betrag wird in festen Teilbeträgen ausgezahlt — je Teilbetrag
// eine Auszahlung, ein Zahlungsauftrag, eine Freigabe mit TAN, eine
// SEPA-Überweisung durch die Buchhaltung. Zwischen zwei Auslösungen desselben
// Plans liegt eine feste Wartezeit, und die zählt der Server, nicht der Browser.
//
// Die Entscheidungen des Inhabers (06.11.2026), auf denen dieser Bau steht:
//   1. VERRECHNET: Der Anspruch schließt alle offenen Altposten des Empfängers
//      ein. Beim Anlegen (dieselbe TAN, EINE Transaktion) werden sie geschlossen
//      — nie gelöscht, immer mit Grund: offene Vormerkungen verworfen, bestätigte
//      Provisionen storniert, offene Auszahlungen abgelehnt (ihre Provisionen
//      storniert), offene Aufträge bei der Buchhaltung zurückgerufen (Link
//      ungültig, „Bitte NICHT ausführen“). Was danach neu entsteht, läuft normal.
//      Zweite Wahl im Formular: „zusätzlich“ — die Altposten bleiben unberührt.
//   2. JE PERSON: Jeder Empfänger bekommt einen eigenen Plan mit eigener Nummer
//      und eigenem Takt. Eine TAN legt alle gewählten Pläne an.
//   3. Die Bank-Referenz der Buchhaltung ist freiwillig (fiaon-buchhaltung.ts).
//
// Der Weg je Teilbetrag ist der aus E-347 (server/lib/fiaon-buchhaltung.ts):
//   teilAusloesen → Auftrag „eingereicht“, im Namen des Plan-Inhabers, über die
//   Buchhaltung → Freigabe mit TAN (Inhaber als Einzelzeichner oder die
//   Geschäftsführung als zweite Person) → Auftrag mit Link an die Buchhaltung →
//   deren Bestätigung → ausgebucht → Durchführungsbeleg.
//
// Warum es keine doppelte Zahlung geben kann:
//   · feste Teil-Zeilen (UNIQUE plan_id, nr) — die Summe kann den Anspruch nie
//     überschreiten; eine Zeile hat höchstens einen laufenden Versuch;
//   · Auslösen in EINER Transaktion mit Zeilensperre auf den Plan und der
//     Wartezeit in Datenbank-Zeit; als Netz darunter eine Takt-Tabelle, in der
//     sich zwei Sperrfenster desselben Plans nicht überlappen können (EXCLUDE);
//   · eine Ablehnung storniert die Provision (nie zurück auf „bestätigt“, sonst
//     nähme sie der nächste Sammellauf mit) und gibt den Teil frei, der Takt
//     bleibt verbraucht;
//   · die Seitenwege („Anweisen“, „Zur Freigabe“, „Alle …“) weisen
//     Plan-Teilbeträge ab (istPlanAuszahlung in fiaon-buchhaltung.ts).
//
// Repo ist öffentlich: Namen, Beträge und Konten stehen nur in der Datenbank —
// eingetippt vom Inhaber im Formular, bestätigt mit TAN.
// ═══════════════════════════════════════════════════════════════════════════

import { createHash } from "crypto";
import { sqlPool } from "./db-pool";
import {
  buchSchema, buchProtokoll, benachrichtigen, gmailSenden, nichtAusfuehrenMelden, inhaber, geschaeftsfuehrung, buchPerson,
  tanAnfordern, tanPruefen, freigabeMoeglich, naechsteNummer, auftrag, zuAuftrag, AUFTRAG_FELDER,
  ibanSauber, ibanGueltig, ibanMaskiert, ibanPruefwert, BUCHHALTUNG_AUSFUEHRUNG, KIND_AUSZAHLUNGSPLAN,
  type Auftrag, type BuchPerson, type BuchRolle,
} from "./fiaon-buchhaltung";
import { istTestkontoSql } from "./fiaon-mitarbeiter-sicht";
import type { MakeEventType } from "../make-webhook";

// Die Erkennung von Plan-Teilbeträgen steht im Banking-Kern; hier nur weitergereicht, damit Aufrufer einen Ort haben.
export { istPlanAuszahlung, planAuszahlungSql, KIND_AUSZAHLUNGSPLAN, PLAN_RIEGEL_GRUND } from "./fiaon-buchhaltung";

type Lauf = typeof sqlPool;

// ── Vorgaben und Grenzen ────────────────────────────────────────────────────
/** Vorgaben im Formular — der Inhaber kann jede ändern, bevor er die TAN anfordert. */
export const VORGABE_TEIL_CENTS = 5000;
export const VORGABE_ABSTAND_MIN = 90;
export const VORGABE_MAX_OFFEN = 10;
/** Grenzen, die auch die Datenbank prüft (CHECK). */
export const GRENZEN = {
  empfaenger: { min: 1, max: 5 },
  anspruchCents: { min: 100, max: 2_000_000 },
  teilCents: { min: 1000, max: 100_000 },
  abstandMin: { min: 15, max: 1440 },
  maxOffen: { min: 1, max: 50 },
  teile: { max: 1000 },
  grund: { min: 5, max: 300 },
} as const;

export type PlanStatus = "aktiv" | "pausiert" | "fertig" | "beendet";
export type AltpostenModus = "verrechnet" | "zusaetzlich";
/** Der Zustand der Takt-Platte — vom Server ausgerechnet, die Oberfläche zeigt ihn nur. */
export type PlanZustand = "bereit" | "wartet" | "stau" | "unterwegs" | "konto" | "pausiert" | "fertig" | "beendet";
export type TeilZurueckArt = "abgelehnt" | "zurueckgezogen" | "zurueckgerufen" | "beendet";

/** Ein Fehlschlag mit HTTP-Status und Kennung — die Route reicht beides durch. */
export interface PlanFehler { ok: false; status: number; code: string; grund: string; naechsteAb?: string }
const fehler = (status: number, code: string, grund: string, extra: { naechsteAb?: string } = {}): PlanFehler =>
  ({ ok: false, status, code, grund, ...extra });

/** Abbruch innerhalb einer Transaktion — rollt alles zurück und wird außen zur Antwort. */
class PlanAbbruch extends Error {
  constructor(public status: number, public code: string, public grund: string) {
    super(grund);
    Object.setPrototypeOf(this, PlanAbbruch.prototype);
  }
}

// ── Kleine Helfer ───────────────────────────────────────────────────────────
const SEITE = (process.env.PUBLIC_BASE_URL || "https://fiaon.com").replace(/\/+$/, "");
const REITER = `${SEITE}/buchhaltung?reiter=auszahlungsplan`;
const geld = (c: number) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(c / 100);
const euroZahl = (c: number) => new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(c / 100);
const iso = (v: unknown): string | null => (v ? new Date(v as string).toISOString() : null);
const uhr = (v: unknown) => new Date(v as string).toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" });
const zeitpunkt = (v: unknown) => (v
  ? new Date(v as string).toLocaleString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
  : "—");
const berlinTag = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
const nameVon = (email: string | null | undefined) => (email ? buchPerson(email)?.name ?? (email === "system" ? "System" : email) : "—");
const agentName = (r: any) => String(r?.name || `${r?.first_name || ""} ${r?.last_name || ""}`).trim() || `Mitarbeiter #${r?.id ?? "?"}`;
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const zahl = (v: unknown) => Number(v ?? 0) || 0;
const text = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/** In einer Transaktion arbeiten — im Pool als neue, in einer laufenden (Prüfstand) als Sicherungspunkt. */
async function inTransaktion<T>(lauf: Lauf, arbeit: (tx: any) => Promise<T>): Promise<T> {
  const l = lauf as any;
  if (typeof l.begin === "function") return (await l.begin((tx: any) => arbeit(tx))) as T;
  if (typeof l.savepoint === "function") return (await l.savepoint((tx: any) => arbeit(tx))) as T;
  return arbeit(lauf);
}

/** Werktage (Mo–Fr) strikt zwischen dem Tag `seit` und heute, in Berliner Zeit. Feiertage zählen mit. */
function bankarbeitstageDazwischen(seit: string, jetzt: Date): number {
  const heute = berlinTag(jetzt);
  let d = new Date(`${berlinTag(new Date(seit))}T12:00:00Z`);
  let n = 0;
  for (let i = 0; i < 90; i++) {
    d = new Date(d.getTime() + 86_400_000);
    if (d.toISOString().slice(0, 10) >= heute) break;
    const wt = d.getUTCDay();
    if (wt !== 0 && wt !== 6) n += 1;
  }
  return n;
}

// ═══════════════════════════════════════════════════════════════════════════
// SCHEMA
// ═══════════════════════════════════════════════════════════════════════════
let bereit: Promise<void> | null = null;

/**
 * Legt die Tabellen an (idempotent; die DDL-Wache in db-pool.ts greift). IMMER vor jedem sqlPool.begin aufrufen —
 * eine Tabellen-Anweisung auf dem globalen Pool wartet sonst auf die eigene offene Transaktion (AGENTS.md).
 */
export function planSchema(): Promise<void> {
  if (!bereit) {
    bereit = (async () => {
      await buchSchema();
      // fiaon_commissions und fiaon_payouts — beide beschreibt das Auslösen in seiner Transaktion.
      const { ensureAgentTables } = await import("../routes/fiaon-agent");
      await ensureAgentTables();
      await sqlPool`
        CREATE TABLE IF NOT EXISTS fiaon_auszahlungsplan (
          id BIGSERIAL PRIMARY KEY,
          nummer VARCHAR NOT NULL UNIQUE,
          agent_id INTEGER NOT NULL,
          anspruch_cents INTEGER NOT NULL CHECK (anspruch_cents BETWEEN 100 AND 2000000),
          teil_cents INTEGER NOT NULL CHECK (teil_cents BETWEEN 1000 AND 100000),
          anzahl_teile INTEGER NOT NULL CHECK (anzahl_teile BETWEEN 1 AND 1000),
          abstand_min INTEGER NOT NULL CHECK (abstand_min BETWEEN 15 AND 1440),
          max_offen INTEGER NOT NULL DEFAULT 10 CHECK (max_offen BETWEEN 1 AND 50),
          altposten VARCHAR NOT NULL DEFAULT 'verrechnet' CHECK (altposten IN ('verrechnet', 'zusaetzlich')),
          altposten_cents INTEGER NOT NULL DEFAULT 0,
          altposten_anzahl INTEGER NOT NULL DEFAULT 0,
          altposten_detail TEXT,
          hinweis_an_inhaber BOOLEAN NOT NULL DEFAULT TRUE,
          grund TEXT NOT NULL,
          iban_masked VARCHAR,
          iban_pruef TEXT NOT NULL,
          konto_bestaetigt_von TEXT,
          konto_bestaetigt_am TIMESTAMPTZ,
          konto_hinweis_am TIMESTAMPTZ,
          naechste_ab TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          letzte_ausloesung_am TIMESTAMPTZ,
          letzte_ausloesung_von TEXT,
          meilenstein INTEGER NOT NULL DEFAULT 0,
          angelegt_von TEXT NOT NULL,
          angelegt_am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          status VARCHAR NOT NULL DEFAULT 'aktiv' CHECK (status IN ('aktiv', 'pausiert', 'fertig', 'beendet')),
          status_von TEXT,
          status_am TIMESTAMPTZ,
          status_grund TEXT
        )`;
      // Je Empfänger höchstens ein laufender Plan — die Grenze steht in der Datenbank, nicht nur im Formular.
      await sqlPool`
        CREATE UNIQUE INDEX IF NOT EXISTS fiaon_auszahlungsplan_ein_offener
          ON fiaon_auszahlungsplan (agent_id) WHERE status IN ('aktiv', 'pausiert')`;
      await sqlPool`
        CREATE TABLE IF NOT EXISTS fiaon_auszahlungsplan_teil (
          id BIGSERIAL PRIMARY KEY,
          plan_id BIGINT NOT NULL REFERENCES fiaon_auszahlungsplan(id),
          nr INTEGER NOT NULL,
          betrag_cents INTEGER NOT NULL CHECK (betrag_cents > 0),
          payout_id INTEGER UNIQUE,
          auftrag_id BIGINT UNIQUE,
          ausgeloest_von TEXT,
          ausgeloest_am TIMESTAMPTZ,
          selbstfreigabe BOOLEAN NOT NULL DEFAULT FALSE,
          ausgefuehrt_am TIMESTAMPTZ,
          versuche SMALLINT NOT NULL DEFAULT 0,
          UNIQUE (plan_id, nr),
          CHECK ((payout_id IS NULL) = (auftrag_id IS NULL)),
          CHECK (ausgefuehrt_am IS NULL OR payout_id IS NOT NULL)
        )`;
      // Nur anhängen, nie ändern oder löschen: jede Auslösung mit ihrem Sperrfenster.
      await sqlPool`
        CREATE TABLE IF NOT EXISTS fiaon_auszahlungsplan_takt (
          id BIGSERIAL PRIMARY KEY,
          plan_id BIGINT NOT NULL,
          teil_id BIGINT NOT NULL,
          payout_id INTEGER,
          auftrag_id BIGINT,
          von TEXT NOT NULL,
          ausgeloest_am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          sperre_bis TIMESTAMPTZ NOT NULL,
          CHECK (sperre_bis > ausgeloest_am)
        )`;
      await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_auszahlungsplan_takt_plan_idx ON fiaon_auszahlungsplan_takt (plan_id, id DESC)`;
      await taktNetz();
    })().catch((e) => { bereit = null; throw e; });
  }
  return bereit;
}

/**
 * Das Netz unter der Zeilensperre: Zwei Sperrfenster desselben Plans dürfen sich nicht überlappen. Mit btree_gist
 * (in Produktion und Prüfstand vorhanden, gemessen am 06.11.2026) direkt über plan_id; ohne die Erweiterung als
 * Ein-Punkt-Bereich — dieselbe Wirkung mit Bordmitteln. Scheitert beides, bleibt die Zeilensperre (FOR UPDATE plus
 * Wartezeit in Datenbank-Zeit) als Schutz; das Banking startet trotzdem.
 */
async function taktNetz(): Promise<void> {
  try {
    const [da] = (await sqlPool`SELECT 1 AS da FROM pg_constraint WHERE conname = 'fiaon_auszahlungsplan_takt_kein_doppel' LIMIT 1`) as any[];
    if (da) return;
    const [ext] = (await sqlPool`SELECT 1 AS da FROM pg_extension WHERE extname = 'btree_gist' LIMIT 1`) as any[];
    const element = ext ? "plan_id WITH =" : "int8range(plan_id, plan_id, '[]') WITH =";
    await sqlPool.unsafe(`
      ALTER TABLE fiaon_auszahlungsplan_takt ADD CONSTRAINT fiaon_auszahlungsplan_takt_kein_doppel
        EXCLUDE USING gist (${element}, tstzrange(ausgeloest_am, sperre_bis, '[)') WITH &&)`);
  } catch (e) {
    console.error("[AUSZAHLUNGSPLAN] Takt-Netz (EXCLUDE) nicht angelegt — es schützt weiter die Zeilensperre:", String(e).slice(0, 200));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EMPFÄNGER UND KONTO
// ═══════════════════════════════════════════════════════════════════════════
const AGENT_SPALTEN = `a.id, a.name, a.first_name, a.last_name, a.email, a.active, a.zugang_gesperrt_am,
  a.bank_holder_enc, a.bank_iban_enc, a.bank_bic_enc, a.bank_iban_masked, ${istTestkontoSql("a")} AS ist_test`;

/** Dieselben Spalten mit Vorsilbe ag_ — für die Abfrage über Plan und Mitarbeiter zusammen. */
const AGENT_SPALTEN_AG = `a.id AS ag_id, a.name AS ag_name, a.first_name AS ag_first_name, a.last_name AS ag_last_name,
  a.email AS ag_email, a.active AS ag_active, a.zugang_gesperrt_am AS ag_zugang_gesperrt_am, a.bank_iban_enc AS ag_bank_iban_enc,
  a.bank_iban_masked AS ag_bank_iban_masked, ${istTestkontoSql("a")} AS ag_ist_test`;

async function agentLesen(agentId: number, lauf: Lauf): Promise<any | null> {
  const [r] = (await lauf.unsafe(`SELECT ${AGENT_SPALTEN} FROM fiaon_agents a WHERE a.id = $1`, [agentId])) as any[];
  return r ?? null;
}

export interface KontoLage {
  ok: boolean;
  art: "ok" | "fehlt" | "inaktiv" | "testkonto" | "gesperrt" | "ohne_iban" | "iban_unlesbar" | "geaendert";
  grund: string | null;
  ibanMasked: string | null;
  /** Nur intern: Prüfwert und Klartext der aktuellen IBAN. */
  pruef: string | null;
  iban: string | null;
}

/** Darf an diesen Empfänger jetzt ausgezahlt werden — und, mit Plan, auf das Konto von der Plananlage? */
function kontoLage(ag: any, planPruef: string | null, entschluesseln: (enc: string | null) => string | null): KontoLage {
  const nein = (art: KontoLage["art"], grund: string, mehr: Partial<KontoLage> = {}): KontoLage =>
    ({ ok: false, art, grund, ibanMasked: null, pruef: null, iban: null, ...mehr });
  if (!ag) return nein("fehlt", "Den Empfänger gibt es nicht mehr.");
  const name = agentName(ag);
  if (ag.ist_test) return nein("testkonto", `${name} ist ein Testkonto.`);
  if (ag.active !== true) return nein("inaktiv", `Das Konto von ${name} ist nicht aktiv.`);
  if (ag.zugang_gesperrt_am) return nein("gesperrt", `Der Zugang von ${name} ist gesperrt — Teilbeträge sind angehalten, bis der Inhaber entscheidet.`);
  if (!ag.bank_iban_enc) return nein("ohne_iban", `Für ${name} ist keine Bankverbindung hinterlegt.`);
  const iban = ibanSauber(entschluesseln(ag.bank_iban_enc) || "");
  if (!ibanGueltig(iban)) return nein("iban_unlesbar", `Die hinterlegte IBAN von ${name} ist nicht lesbar oder hat eine falsche Prüfziffer.`);
  const pruef = ibanPruefwert(iban);
  const masked = ibanMaskiert(iban);
  if (planPruef && pruef !== planPruef) {
    return nein("geaendert", `Die Bankverbindung von ${name} hat sich seit der Plananlage geändert (jetzt ${masked}). Der Inhaber bestätigt das neue Konto mit TAN.`,
      { ibanMasked: masked, pruef, iban });
  }
  return { ok: true, art: "ok", grund: null, ibanMasked: masked, pruef, iban };
}

async function entschluessler(): Promise<(enc: string | null) => string | null> {
  const { decryptSecret } = await import("../routes/fiaon-agent");
  return decryptSecret;
}

// ═══════════════════════════════════════════════════════════════════════════
// ALTPOSTEN — was beim Empfänger außerhalb eines Plans offen ist
// ═══════════════════════════════════════════════════════════════════════════
export interface AltpostenStand {
  agentId: number;
  /** Posten, die beim Verrechnen geschlossen würden (Vormerkungen + Provisionen + Auszahlungen). */
  anzahl: number;
  /** Ihre Summe — das, was im Anspruch des Plans aufgeht. */
  cents: number;
  vormerkungen: { anzahl: number; cents: number };
  provisionen: { anzahl: number; cents: number };
  auszahlungen: { id: number; cents: number; status: string }[];
  /**
   * Offene Zahlungsaufträge zu Auszahlungen des Empfängers — auch zu schon gebuchten. Ihr Betrag steckt in der
   * Auszahlung (oder ist schon gezahlt) und zählt deshalb nicht in `cents`; sie werden geschlossen, damit die
   * Buchhaltung nichts doppelt überweist.
   */
  auftraege: { id: number; nummer: string; status: string; cents: number; beiBuchhaltung: boolean; auszahlungId: number | null; auszahlungStatus: string | null }[];
  /** Nur zum Vergleich: stimmt der Stand beim Anlegen noch mit dem bei der TAN-Anforderung überein? */
  fingerabdruck: string;
}

interface AltpostenIntern extends AltpostenStand {
  ids: { vormerkungen: number[]; provisionen: number[]; auszahlungen: number[]; auftraege: number[] };
  auftragZeilen: { id: number; nummer: string; status: string; cents: number; empfaenger: string; extern: string | null; auszahlungStatus: string | null }[];
}

let vormerkTabelle: boolean | null = null;

/** Liest die Altposten. `sperren`: in der Anlage-Transaktion mit Zeilensperre, damit genau das Gelesene schließt. */
async function altpostenLesen(agentId: number, lauf: Lauf, sperren: boolean): Promise<AltpostenIntern> {
  const fu = sperren ? "FOR UPDATE" : "";
  if (vormerkTabelle !== true) {
    const [t] = (await lauf`SELECT to_regclass('public.fiaon_provision_vormerkung') IS NOT NULL AS da`) as any[];
    vormerkTabelle = t?.da === true;
  }
  const vorm = vormerkTabelle
    ? ((await lauf.unsafe(`
        SELECT id, amount_cents FROM fiaon_provision_vormerkung
         WHERE agent_id = $1 AND status = 'offen' ORDER BY id ${fu}`, [agentId])) as any[])
    : [];
  const prov = (await lauf.unsafe(`
    SELECT id, amount_cents FROM fiaon_commissions
     WHERE agent_id = $1 AND status IN ('bestaetigt', 'vorgemerkt') AND COALESCE(kind, '') <> '${KIND_AUSZAHLUNGSPLAN}'
     ORDER BY id ${fu}`, [agentId])) as any[];
  const ausz = (await lauf.unsafe(`
    SELECT p.id, p.amount_cents, p.status FROM fiaon_payouts p
     WHERE p.agent_id = $1 AND p.status IN ('angefordert', 'requested')
       AND NOT EXISTS (SELECT 1 FROM fiaon_commissions c WHERE c.payout_id = p.id AND c.kind = '${KIND_AUSZAHLUNGSPLAN}')
     ORDER BY p.id ${sperren ? "FOR UPDATE OF p" : ""}`, [agentId])) as any[];
  const auft = (await lauf.unsafe(`
    SELECT o.id, o.nummer, o.status, o.betrag_cents, o.empfaenger, o.ausfuehrung_extern, o.payout_id, p.status AS payout_status
      FROM fiaon_buch_auftrag o JOIN fiaon_payouts p ON p.id = o.payout_id
     WHERE p.agent_id = $1 AND o.plan_teil_id IS NULL
       AND o.status IN ('entwurf', 'eingereicht', 'freigegeben') AND o.extern_bestaetigt_am IS NULL
       AND NOT EXISTS (SELECT 1 FROM fiaon_commissions c WHERE c.payout_id = p.id AND c.kind = '${KIND_AUSZAHLUNGSPLAN}')
     ORDER BY o.id ${sperren ? "FOR UPDATE OF o" : ""}`, [agentId])) as any[];
  const summe = (z: any[], feld: string) => z.reduce((s, r) => s + zahl(r[feld]), 0);
  const vormerkungen = { anzahl: vorm.length, cents: summe(vorm, "amount_cents") };
  const provisionen = { anzahl: prov.length, cents: summe(prov, "amount_cents") };
  const auszahlungen = ausz.map((r) => ({ id: zahl(r.id), cents: zahl(r.amount_cents), status: String(r.status) }));
  const auftragZeilen = auft.map((r) => ({
    id: zahl(r.id), nummer: String(r.nummer || ""), status: String(r.status), cents: zahl(r.betrag_cents),
    empfaenger: String(r.empfaenger || ""), extern: r.ausfuehrung_extern ?? null, auszahlungStatus: r.payout_status ?? null,
  }));
  const auftraege = auftragZeilen.map((r) => ({
    id: r.id, nummer: r.nummer, status: r.status, cents: r.cents,
    beiBuchhaltung: !!r.extern && r.status === "freigegeben", auszahlungId: zahl(auft.find((x) => zahl(x.id) === r.id)?.payout_id) || null,
    auszahlungStatus: r.auszahlungStatus,
  }));
  const fingerabdruck = sha(JSON.stringify({
    v: vorm.map((r) => [zahl(r.id), zahl(r.amount_cents)]),
    c: prov.map((r) => [zahl(r.id), zahl(r.amount_cents)]),
    p: auszahlungen.map((r) => [r.id, r.cents, r.status]),
    o: auftragZeilen.map((r) => [r.id, r.status]),
  }));
  return {
    agentId, anzahl: vormerkungen.anzahl + provisionen.anzahl + auszahlungen.length,
    cents: vormerkungen.cents + provisionen.cents + auszahlungen.reduce((s, r) => s + r.cents, 0),
    vormerkungen, provisionen, auszahlungen, auftraege, fingerabdruck,
    ids: {
      vormerkungen: vorm.map((r) => zahl(r.id)), provisionen: prov.map((r) => zahl(r.id)),
      auszahlungen: auszahlungen.map((r) => r.id), auftraege: auftragZeilen.map((r) => r.id),
    },
    auftragZeilen,
  };
}

const altpostenAussen = (a: AltpostenIntern): AltpostenStand => {
  const { ids: _ids, auftragZeilen: _z, ...stand } = a;
  return stand;
};

/** Die offenen Altposten eines Empfängers — für das Formular („wird verrechnet“) und die Plan-Karte („außerhalb offen“). */
export async function planAltposten(agentId: number, lauf: Lauf = sqlPool): Promise<AltpostenStand> {
  await planSchema();
  return altpostenAussen(await altpostenLesen(agentId, lauf, false));
}

interface AltpostenGeschlossen {
  vormerkungen: number; provisionen: number; auszahlungen: number[]; auftraege: AltpostenIntern["auftragZeilen"];
}

/** Schließt GENAU die gesperrt gelesenen Altposten — in der Transaktion der Plananlage. */
async function altpostenSchliessen(alt: AltpostenIntern, planNummer: string, von: BuchPerson, tx: any): Promise<AltpostenGeschlossen> {
  const vermerk = ` · im Auszahlungsplan ${planNummer} verrechnet`;
  const grund = `Im Auszahlungsplan ${planNummer} verrechnet`;
  const leer = (l: number[]) => (l.length ? l : [0]);
  const pruefe = (art: string, soll: number, ist: number) => {
    if (soll !== ist) throw new PlanAbbruch(409, "ALTPOSTEN_GEAENDERT", `Bei den Altposten hat sich gerade etwas geändert (${art}). Bitte neu laden und eine neue TAN anfordern.`);
  };
  let vormerkungen = 0;
  if (alt.ids.vormerkungen.length) {
    const r = (await tx`
      UPDATE fiaon_provision_vormerkung
         SET status = 'verworfen', erledigt_am = NOW(), erledigt_von = ${von.email},
             note = TRIM(COALESCE(note, '') || ${vermerk})
       WHERE id = ANY(${leer(alt.ids.vormerkungen)}) AND status = 'offen'
      RETURNING id`) as any[];
    pruefe("Vormerkungen", alt.ids.vormerkungen.length, r.length);
    vormerkungen = r.length;
  }
  let provisionen = 0;
  if (alt.ids.provisionen.length) {
    const r = (await tx`
      UPDATE fiaon_commissions SET status = 'storniert', updated_at = NOW(), note = TRIM(COALESCE(note, '') || ${vermerk})
       WHERE id = ANY(${leer(alt.ids.provisionen)}) AND status IN ('bestaetigt', 'vorgemerkt')
      RETURNING id`) as any[];
    pruefe("Provisionen", alt.ids.provisionen.length, r.length);
    provisionen = r.length;
  }
  if (alt.ids.auftraege.length) {
    for (const o of alt.auftragZeilen) {
      const g = o.auszahlungStatus === "ausgezahlt"
        ? `Auszahlung bereits als überwiesen gebucht — Auftrag beim Anlegen von ${planNummer} geschlossen`
        : grund;
      const r = (await tx`
        UPDATE fiaon_buch_auftrag
           SET status = 'zurueckgezogen', extern_token_hash = NULL,
               zurueckgerufen_am = NOW(), zurueckgerufen_von = ${von.email}, rueckruf_grund = ${g}
         WHERE id = ${o.id} AND status IN ('entwurf', 'eingereicht', 'freigegeben') AND extern_bestaetigt_am IS NULL
        RETURNING id`) as any[];
      pruefe(`Auftrag ${o.nummer}`, 1, r.length);
    }
    await tx`
      UPDATE fiaon_buch_tan SET benutzt_am = NOW()
       WHERE zweck = ANY(${alt.ids.auftraege.map((id) => `freigabe:${id}`)}) AND benutzt_am IS NULL`;
  }
  if (alt.ids.auszahlungen.length) {
    const r = (await tx`
      UPDATE fiaon_payouts SET status = 'abgelehnt', reject_reason = ${grund}, processed_at = NOW()
       WHERE id = ANY(${leer(alt.ids.auszahlungen)}) AND status IN ('angefordert', 'requested')
      RETURNING id, agent_id, amount_cents`) as any[];
    pruefe("Auszahlungen", alt.ids.auszahlungen.length, r.length);
    await tx`
      UPDATE fiaon_commissions SET status = 'storniert', updated_at = NOW(), note = TRIM(COALESCE(note, '') || ${vermerk})
       WHERE payout_id = ANY(${leer(alt.ids.auszahlungen)}) AND status = 'in_auszahlung'`;
    for (const p of r) {
      await tx`
        INSERT INTO fiaon_agent_events (agent_id, type, meta)
        VALUES (${zahl(p.agent_id)}, 'payout_rejected', ${JSON.stringify({ payout_id: zahl(p.id), reason: grund, quelle: "auszahlungsplan", plan: planNummer, amount_cents: zahl(p.amount_cents) })})`;
    }
  }
  return { vormerkungen, provisionen, auszahlungen: alt.ids.auszahlungen, auftraege: alt.auftragZeilen };
}

// ═══════════════════════════════════════════════════════════════════════════
// FORMULAR: Empfänger, Eingabe, Vorschau, TAN
// ═══════════════════════════════════════════════════════════════════════════
export interface PlanKandidat {
  agentId: number;
  name: string;
  ibanMasked: string | null;
  auswaehlbar: boolean;
  /** Warum nicht wählbar (kein Konto, gesperrt, schon ein Plan …). */
  grund: string | null;
  offenerPlan: string | null;
  altposten: AltpostenStand | null;
}

/** Wer einen Plan bekommen kann: aktive, echte Mitarbeiter (keine Testkonten). Nur für den Inhaber. */
export async function planKandidaten(): Promise<PlanKandidat[]> {
  await planSchema();
  const entschl = await entschluessler();
  const leute = (await sqlPool.unsafe(`
    SELECT ${AGENT_SPALTEN},
           (SELECT nummer FROM fiaon_auszahlungsplan x WHERE x.agent_id = a.id AND x.status IN ('aktiv', 'pausiert') LIMIT 1) AS offener_plan
      FROM fiaon_agents a
     WHERE a.active = TRUE AND NOT ${istTestkontoSql("a")}
     ORDER BY a.name ASC NULLS LAST, a.id ASC`)) as any[];
  const aus: PlanKandidat[] = [];
  for (const r of leute) {
    const konto = kontoLage(r, null, entschl);
    const offenerPlan = r.offener_plan ? String(r.offener_plan) : null;
    const auswaehlbar = konto.ok && !offenerPlan;
    aus.push({
      agentId: zahl(r.id), name: agentName(r), ibanMasked: konto.ibanMasked ?? (r.bank_iban_masked || null),
      auswaehlbar, grund: offenerPlan ? `Für diese Person läuft schon der Auszahlungsplan ${offenerPlan}.` : konto.grund,
      offenerPlan,
      altposten: konto.ok ? altpostenAussen(await altpostenLesen(zahl(r.id), sqlPool, false)) : null,
    });
  }
  return aus;
}

export interface PlanEingabe {
  empfaenger: { agentId: number; anspruchCents: number }[];
  teilCents: number;
  abstandMin: number;
  maxOffen: number;
  altposten: AltpostenModus;
  hinweisAnInhaber: boolean;
  grund: string;
}

/** Euro-Text („1.250,00“, „75“) oder Cent-Zahl in Cent. */
function centsLesen(cents: unknown, euro: unknown): number {
  if (typeof cents === "number" && Number.isFinite(cents)) return Math.round(cents);
  if (typeof cents === "string" && /^\d+$/.test(cents.trim())) return Number(cents.trim());
  if (euro === undefined || euro === null || euro === "") return NaN;
  if (typeof euro === "number") return Math.round(euro * 100);
  const s = String(euro).trim().replace(/\s|€|EUR/gi, "");
  const norm = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  const n = Number(norm);
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}

/** Liest und prüft die Formular-Eingabe (Body der Route). Vorgaben greifen, wo nichts angegeben ist. */
export function planEingabeLesen(roh: unknown): { ok: true; ein: PlanEingabe } | PlanFehler {
  const b = (roh ?? {}) as any;
  const liste: any[] = Array.isArray(b.empfaenger) ? b.empfaenger : [];
  if (liste.length < GRENZEN.empfaenger.min || liste.length > GRENZEN.empfaenger.max) {
    return fehler(400, "EINGABE", "Bitte einen bis fünf Empfänger wählen.");
  }
  const empfaenger: PlanEingabe["empfaenger"] = [];
  const gesehen: number[] = [];
  for (const e of liste) {
    const agentId = Math.round(Number(e?.agentId));
    if (!Number.isInteger(agentId) || agentId <= 0) return fehler(400, "EINGABE", "Ein Empfänger ist nicht erkennbar. Bitte neu wählen.");
    if (gesehen.indexOf(agentId) >= 0) return fehler(400, "EINGABE", "Jeder Empfänger darf nur einmal vorkommen.");
    gesehen.push(agentId);
    const anspruchCents = centsLesen(e?.anspruchCents, e?.anspruch);
    if (!Number.isFinite(anspruchCents) || anspruchCents < GRENZEN.anspruchCents.min || anspruchCents > GRENZEN.anspruchCents.max) {
      return fehler(400, "EINGABE", "Der Anspruch je Empfänger liegt zwischen 1,00 € und 20.000,00 €.");
    }
    empfaenger.push({ agentId, anspruchCents });
  }
  const teilRoh = centsLesen(b.teilCents, b.teilbetrag);
  const teilCents = Number.isFinite(teilRoh) ? teilRoh : VORGABE_TEIL_CENTS;
  if (teilCents < GRENZEN.teilCents.min || teilCents > GRENZEN.teilCents.max) return fehler(400, "EINGABE", "Der Teilbetrag liegt zwischen 10,00 € und 1.000,00 €.");
  const abstandRoh = b.abstandMin === undefined || b.abstandMin === null || b.abstandMin === "" ? VORGABE_ABSTAND_MIN : Math.round(Number(b.abstandMin));
  if (!Number.isInteger(abstandRoh) || abstandRoh < GRENZEN.abstandMin.min || abstandRoh > GRENZEN.abstandMin.max) {
    return fehler(400, "EINGABE", "Der Abstand liegt zwischen 15 und 1.440 Minuten.");
  }
  const maxRoh = b.maxOffen === undefined || b.maxOffen === null || b.maxOffen === "" ? VORGABE_MAX_OFFEN : Math.round(Number(b.maxOffen));
  if (!Number.isInteger(maxRoh) || maxRoh < GRENZEN.maxOffen.min || maxRoh > GRENZEN.maxOffen.max) {
    return fehler(400, "EINGABE", "Höchstens unterwegs: zwischen 1 und 50 Teilbeträgen.");
  }
  for (const e of empfaenger) {
    if (Math.ceil(e.anspruchCents / teilCents) > GRENZEN.teile.max) return fehler(400, "EINGABE", "Ein Plan hat höchstens 1.000 Teilbeträge — bitte den Teilbetrag erhöhen.");
  }
  const altposten: AltpostenModus = b.altposten === "zusaetzlich" ? "zusaetzlich" : "verrechnet";
  if (b.altposten !== undefined && b.altposten !== null && b.altposten !== "" && b.altposten !== "verrechnet" && b.altposten !== "zusaetzlich") {
    return fehler(400, "EINGABE", "Altposten: bitte „verrechnet“ oder „zusätzlich“ wählen.");
  }
  const grund = text(b.grund, GRENZEN.grund.max + 1);
  if (grund.length < GRENZEN.grund.min || grund.length > GRENZEN.grund.max) {
    return fehler(400, "EINGABE", "Bitte einen Grund angeben (5 bis 300 Zeichen) — er steht im Protokoll und im Plan.");
  }
  return {
    ok: true,
    ein: { empfaenger, teilCents, abstandMin: abstandRoh, maxOffen: maxRoh, altposten, hinweisAnInhaber: b.hinweisAnInhaber !== false, grund },
  };
}

export interface PlanVorschauEmpfaenger {
  agentId: number;
  name: string;
  ibanMasked: string | null;
  anspruchCents: number;
  anzahlTeile: number;
  letzterTeilCents: number;
  /** Frühestens fertig nach so vielen Tagen, wenn jede Wartezeit sofort genutzt wird. */
  fruehestensTage: number;
  altposten: AltpostenStand | null;
  fehler: string | null;
}

export interface PlanVorschau {
  empfaenger: PlanVorschauEmpfaenger[];
  teilCents: number;
  abstandMin: number;
  maxOffen: number;
  altposten: AltpostenModus;
  hinweisAnInhaber: boolean;
  grund: string;
  summeCents: number;
  anzahlTeile: number;
  /** Nur bei „verrechnet“: was geschlossen wird. */
  altpostenCents: number;
  altpostenAnzahl: number;
  /** ZA-Nummern, die bei der Buchhaltung liegen und zurückgerufen würden. */
  zurueckgerufen: string[];
  fehler: string[];
  /** Der Text der TAN-Mail. */
  beschreibung: string;
  /** Die TAN-Bindung — ändert sich ein Wert (Betrag, Konto, Altposten), passt die TAN nicht mehr. */
  ziel: string;
}

const ZWECK_ANLEGEN = "plan-anlegen";

/** Der vordere Teil der TAN-Bindung (Eingabe und Konten) — ohne die Altposten. */
const zielKopf = (ziel: string) => ziel.split(":").slice(0, 2).join(":");

/** Was das Formular VOR der TAN zeigt — je Empfänger Teile, Konto und die Altposten, die verrechnet würden. */
export async function planVorschau(ein: PlanEingabe): Promise<PlanVorschau> {
  return (await vorschauIntern(ein)).vorschau;
}

/** Die Vorschau samt den Konto-Prüfwerten (bleiben im Server). */
async function vorschauIntern(ein: PlanEingabe): Promise<{ vorschau: PlanVorschau; pruefJe: Map<number, string | null> }> {
  await planSchema();
  const pruefJe = new Map<number, string | null>();
  const entschl = await entschluessler();
  const empfaenger: PlanVorschauEmpfaenger[] = [];
  const bindung: unknown[] = [];
  const altBindung: string[] = [];
  const fehlerListe: string[] = [];
  const zurueckgerufen: string[] = [];
  const sortiert = ein.empfaenger.slice().sort((x, y) => x.agentId - y.agentId);
  for (const e of sortiert) {
    const ag = await agentLesen(e.agentId, sqlPool);
    const konto = kontoLage(ag, null, entschl);
    const [offen] = (await sqlPool`
      SELECT nummer FROM fiaon_auszahlungsplan WHERE agent_id = ${e.agentId} AND status IN ('aktiv', 'pausiert') LIMIT 1`) as any[];
    const anzahlTeile = Math.ceil(e.anspruchCents / ein.teilCents);
    const letzterTeilCents = e.anspruchCents - ein.teilCents * (anzahlTeile - 1);
    let f: string | null = konto.ok ? null : konto.grund;
    if (!f && offen) f = `Für ${agentName(ag)} läuft schon der Auszahlungsplan ${offen.nummer}.`;
    const alt = konto.ok ? await altpostenLesen(e.agentId, sqlPool, false) : null;
    if (f) fehlerListe.push(f);
    if (alt && ein.altposten === "verrechnet") {
      for (const o of alt.auftragZeilen) if (o.extern && o.status === "freigegeben") zurueckgerufen.push(o.nummer);
    }
    empfaenger.push({
      agentId: e.agentId, name: ag ? agentName(ag) : `#${e.agentId}`, ibanMasked: konto.ibanMasked,
      anspruchCents: e.anspruchCents, anzahlTeile, letzterTeilCents,
      fruehestensTage: Math.max(1, Math.ceil(((anzahlTeile - 1) * ein.abstandMin) / 1440)),
      altposten: alt ? altpostenAussen(alt) : null, fehler: f,
    });
    bindung.push([e.agentId, e.anspruchCents, konto.pruef]);
    pruefJe.set(e.agentId, konto.pruef);
    altBindung.push(ein.altposten === "verrechnet" && alt ? alt.fingerabdruck : "-");
  }
  const verrechnet = ein.altposten === "verrechnet";
  const altpostenCents = verrechnet ? empfaenger.reduce((s, e) => s + (e.altposten?.cents ?? 0), 0) : 0;
  const altpostenAnzahl = verrechnet ? empfaenger.reduce((s, e) => s + (e.altposten?.anzahl ?? 0), 0) : 0;
  const kopf = sha(JSON.stringify({ e: bindung, t: ein.teilCents, a: ein.abstandMin, m: ein.maxOffen, p: ein.altposten, h: ein.hinweisAnInhaber, g: ein.grund }));
  const vorschau: PlanVorschau = {
    empfaenger, teilCents: ein.teilCents, abstandMin: ein.abstandMin, maxOffen: ein.maxOffen, altposten: ein.altposten,
    hinweisAnInhaber: ein.hinweisAnInhaber, grund: ein.grund,
    summeCents: empfaenger.reduce((s, e) => s + e.anspruchCents, 0),
    anzahlTeile: empfaenger.reduce((s, e) => s + e.anzahlTeile, 0),
    altpostenCents, altpostenAnzahl, zurueckgerufen, fehler: fehlerListe,
    beschreibung: "",
    ziel: `plan:${kopf}:${sha(altBindung.join("|"))}`,
  };
  vorschau.beschreibung = planBeschreibung(vorschau);
  return { vorschau, pruefJe };
}

/** Die TAN-Bindung einer Vorschau. */
export function planZiel(v: PlanVorschau): string {
  return v.ziel;
}

/** Der Klartext der TAN-Mail: alle Pläne, der Takt und die Summe der verrechneten Altposten. */
export function planBeschreibung(v: PlanVorschau): string {
  const zeilen = [
    v.empfaenger.length === 1 ? "Auszahlungsplan anlegen:" : `Auszahlungspläne anlegen (${v.empfaenger.length}, je Empfänger ein eigener Plan):`,
    ...v.empfaenger.map((e) => `  · ${e.name}: ${geld(e.anspruchCents)} = `
      + (e.letzterTeilCents !== v.teilCents
        ? `${e.anzahlTeile - 1} × ${geld(v.teilCents)} + 1 × ${geld(e.letzterTeilCents)}`
        : `${e.anzahlTeile} × ${geld(v.teilCents)}`)
      + ` · Konto ${e.ibanMasked ?? "—"}`),
    `  Je Plan alle ${v.abstandMin} Min. ein Teilbetrag, höchstens ${v.maxOffen} unterwegs.`,
    v.altposten === "verrechnet"
      ? `  Altposten verrechnet: ${geld(v.altpostenCents)} in ${v.altpostenAnzahl} Posten${v.zurueckgerufen.length ? ` · bei der Buchhaltung zurückgerufen: ${v.zurueckgerufen.join(", ")}` : ""}.`
      : "  Altposten bleiben bestehen (zusätzlich zum Plan).",
  ];
  return zeilen.join("\n    ");
}

async function offeneTanZiel(person: BuchPerson, zweck: string): Promise<string | null> {
  const [r] = (await sqlPool`
    SELECT ziel FROM fiaon_buch_tan
     WHERE person = ${person.email} AND zweck = ${zweck} AND benutzt_am IS NULL AND gueltig_bis > NOW()
     ORDER BY id DESC LIMIT 1`) as any[];
  return r?.ziel ? String(r.ziel) : null;
}

/** Inhaber: TAN für die Plananlage anfordern. Gibt die Vorschau mit — genau sie bindet die TAN. */
export async function planTanAnfordern(ein: PlanEingabe, von: BuchPerson): Promise<{ ok: true; an: string; vorschau: PlanVorschau } | PlanFehler> {
  if (von.rolle !== "inhaber") return fehler(403, "NUR_INHABER", "Einen Auszahlungsplan legt nur der Inhaber an.");
  const vorschau = await planVorschau(ein);
  if (vorschau.fehler.length) return fehler(400, "EMPFAENGER", vorschau.fehler.join(" "));
  const t = await tanAnfordern(von, ZWECK_ANLEGEN, vorschau.ziel, vorschau.beschreibung);
  if (!t.ok) return fehler(503, "TAN_VERSAND", t.grund);
  return { ok: true, an: von.email, vorschau };
}

export interface AngelegterPlan { id: number; nummer: string; agentId: number; name: string; anzahlTeile: number; altpostenCents: number; altpostenAnzahl: number }

/**
 * Inhaber: Pläne anlegen — mit der TAN aus planTanAnfordern. Alles in EINER Transaktion: je Empfänger Plan und
 * Teil-Zeilen, und bei „verrechnet“ das Schließen der Altposten. Fällt ein Schritt um, entsteht nichts.
 */
export async function planAnlegen(
  ein: PlanEingabe, von: BuchPerson, tan: string,
): Promise<{ ok: true; plaene: AngelegterPlan[]; zurueckgerufen: string[]; hinweise: string[] } | PlanFehler> {
  if (von.rolle !== "inhaber") return fehler(403, "NUR_INHABER", "Einen Auszahlungsplan legt nur der Inhaber an.");
  await planSchema();
  const { vorschau, pruefJe } = await vorschauIntern(ein);
  if (vorschau.fehler.length) return fehler(400, "EMPFAENGER", vorschau.fehler.join(" "));
  // Hat sich seit der TAN-Anforderung NUR bei den Altposten etwas getan (eine neue Vormerkung, ein bestätigter
  // Auftrag)? Dann klar sagen — „die TAN gehört zu einem anderen Vorgang“ schickte den Inhaber auf die falsche Suche.
  const offen = await offeneTanZiel(von, ZWECK_ANLEGEN);
  if (offen && offen !== vorschau.ziel && zielKopf(offen) === zielKopf(vorschau.ziel)) {
    return fehler(409, "ALTPOSTEN_GEAENDERT", "Seit der TAN-Anforderung hat sich bei den Altposten etwas geändert (z. B. eine neue Vormerkung). Bitte die Vorschau neu laden und eine neue TAN anfordern.");
  }
  const t = await tanPruefen(von, ZWECK_ANLEGEN, vorschau.ziel, tan);
  if (!t.ok) return fehler(400, "TAN", t.grund);
  const entschl = await entschluessler();
  const verrechnet = ein.altposten === "verrechnet";
  const anspruchJe = new Map<number, number>();
  ein.empfaenger.forEach((e) => anspruchJe.set(e.agentId, e.anspruchCents));

  let ergebnis: { plaene: AngelegterPlan[]; geschlossen: { nummer: string; g: AltpostenGeschlossen }[] };
  try {
    ergebnis = await sqlPool.begin(async (tx: any) => {
      await tx`SELECT pg_advisory_xact_lock(hashtext('fiaon-auszahlungsplan'))`;
      const jahr = berlinTag(new Date()).slice(0, 4);
      const [m] = (await tx`
        SELECT COALESCE(MAX(SUBSTRING(nummer FROM '[0-9]+$')::int), 0)::int AS n
          FROM fiaon_auszahlungsplan WHERE nummer LIKE ${`AP-${jahr}-%`}`) as any[];
      let n = zahl(m?.n);
      const plaene: AngelegterPlan[] = [];
      const geschlossen: { nummer: string; g: AltpostenGeschlossen }[] = [];
      for (const e of vorschau.empfaenger) {
        const ag = await agentLesen(e.agentId, tx);
        const konto = kontoLage(ag, null, entschl);
        if (!konto.ok) throw new PlanAbbruch(409, "KONTO", konto.grund || "Das Konto des Empfängers ist nicht verwendbar.");
        if (!konto.pruef || konto.pruef !== pruefJe.get(e.agentId)) {
          throw new PlanAbbruch(409, "KONTO_GEAENDERT", `Die Bankverbindung von ${e.name} hat sich gerade geändert. Bitte neu laden und eine neue TAN anfordern.`);
        }
        let alt: AltpostenIntern | null = null;
        if (verrechnet) {
          alt = await altpostenLesen(e.agentId, tx, true);
          if (!e.altposten || alt.fingerabdruck !== e.altposten.fingerabdruck) {
            throw new PlanAbbruch(409, "ALTPOSTEN_GEAENDERT", `Bei den Altposten von ${e.name} hat sich gerade etwas geändert. Bitte neu laden und eine neue TAN anfordern.`);
          }
        }
        n += 1;
        const nummer = `AP-${jahr}-${String(n).padStart(3, "0")}`;
        const detail = alt ? JSON.stringify({
          vormerkungen: alt.vormerkungen, provisionen: alt.provisionen, auszahlungen: alt.auszahlungen,
          auftraege: alt.auftraege.map((o) => ({ nummer: o.nummer, status: o.status, cents: o.cents, beiBuchhaltung: o.beiBuchhaltung, auszahlungStatus: o.auszahlungStatus })),
        }) : null;
        const [p] = (await tx`
          INSERT INTO fiaon_auszahlungsplan
            (nummer, agent_id, anspruch_cents, teil_cents, anzahl_teile, abstand_min, max_offen, altposten,
             altposten_cents, altposten_anzahl, altposten_detail, hinweis_an_inhaber, grund, iban_masked, iban_pruef,
             konto_bestaetigt_von, konto_bestaetigt_am, angelegt_von)
          VALUES (${nummer}, ${e.agentId}, ${e.anspruchCents}, ${ein.teilCents}, ${e.anzahlTeile}, ${ein.abstandMin}, ${ein.maxOffen},
                  ${ein.altposten}, ${alt ? alt.cents : 0}, ${alt ? alt.anzahl : 0}, ${detail}, ${ein.hinweisAnInhaber}, ${ein.grund},
                  ${konto.ibanMasked}, ${konto.pruef}, ${von.email}, NOW(), ${von.email})
          RETURNING id`) as any[];
        const planId = zahl(p.id);
        await tx`
          INSERT INTO fiaon_auszahlungsplan_teil (plan_id, nr, betrag_cents)
          SELECT ${planId}, g, CASE WHEN g < ${e.anzahlTeile}::int THEN ${ein.teilCents}::int ELSE ${e.letzterTeilCents}::int END
            FROM generate_series(1, ${e.anzahlTeile}::int) AS g`;
        const [summe] = (await tx`SELECT COALESCE(SUM(betrag_cents), 0)::bigint AS s, COUNT(*)::int AS n FROM fiaon_auszahlungsplan_teil WHERE plan_id = ${planId}`) as any[];
        // Die Obergrenze steckt in der Struktur — hier der Beweis, dass sie stimmt.
        if (zahl(summe.s) !== anspruchJe.get(e.agentId) || zahl(summe.n) !== e.anzahlTeile) {
          throw new PlanAbbruch(500, "TEILE", `Die Teilbeträge von ${nummer} ergeben nicht den Anspruch — nichts angelegt.`);
        }
        if (alt) geschlossen.push({ nummer, g: await altpostenSchliessen(alt, nummer, von, tx) });
        plaene.push({ id: planId, nummer, agentId: e.agentId, name: e.name, anzahlTeile: e.anzahlTeile, altpostenCents: alt ? alt.cents : 0, altpostenAnzahl: alt ? alt.anzahl : 0 });
      }
      return { plaene, geschlossen };
    });
  } catch (e: any) {
    if (e instanceof PlanAbbruch) return fehler(e.status, e.code, e.grund);
    if (e?.code === "23505" && /ein_offener/.test(String(e?.constraint_name || e?.message || ""))) {
      return fehler(409, "PLAN_LAEUFT", "Für einen der Empfänger läuft schon ein Auszahlungsplan.");
    }
    throw e;
  }

  // ── Nach dem Commit: Protokoll und Mails. Nichts davon kann die Anlage noch kippen. ──
  const hinweise: string[] = [];
  for (const p of ergebnis.plaene) {
    buchProtokoll(von.email, "Auszahlungsplan angelegt (mit TAN)", p.nummer,
      `${p.name}: ${geld(anspruchJe.get(p.agentId) ?? 0)} in ${p.anzahlTeile} Teilbeträgen à ${geld(ein.teilCents)}, alle ${ein.abstandMin} Min. · Altposten ${ein.altposten}${verrechnet ? ` (${geld(p.altpostenCents)} in ${p.altpostenAnzahl} Posten)` : ""}`);
  }
  const zurueck: { an: string; plan: string; nummer: string; betragCents: number; empfaenger: string }[] = [];
  for (const { nummer, g } of ergebnis.geschlossen) {
    const za = g.auftraege.map((o) => o.nummer);
    buchProtokoll(von.email, "Altposten im Auszahlungsplan verrechnet", nummer,
      `${g.vormerkungen} Vormerkungen verworfen · ${g.provisionen} Provisionen storniert · ${g.auszahlungen.length} Auszahlungen abgelehnt${za.length ? ` · Aufträge geschlossen: ${za.join(", ")}` : ""}`);
    for (const o of g.auftraege) {
      if (o.extern && o.status === "freigegeben") zurueck.push({ an: o.extern, plan: nummer, nummer: o.nummer, betragCents: o.cents, empfaenger: o.empfaenger });
    }
  }
  // „Bitte NICHT ausführen“ — eine Mail je Buchhaltungs-Adresse (heute genau eine).
  const adressen = Array.from(new Set(zurueck.map((z) => z.an)));
  for (const an of adressen) {
    const liste = zurueck.filter((z) => z.an === an);
    const plaene = Array.from(new Set(liste.map((z) => z.plan)));
    const m = await nichtAusfuehrenMelden(an, liste, `im Auszahlungsplan ${plaene.join(", ")} verrechnet`);
    if (!m.ok) hinweise.push(`Die Aufträge ${liste.map((z) => z.nummer).join(", ")} sind zurückgerufen und ihre Links ungültig — aber die Mail „Bitte NICHT ausführen“ an ${an} ging nicht raus (${m.grund}). Bitte die Buchhaltung direkt informieren.`);
  }
  const gf = geschaeftsfuehrung();
  const m = await gmailSenden(gf.email, ergebnis.plaene.length === 1
    ? `Auszahlungsplan ${ergebnis.plaene[0].nummer} angelegt`
    : `Auszahlungspläne ${ergebnis.plaene.map((p) => p.nummer).join(", ")} angelegt`, [
    "Guten Tag,",
    "",
    `${inhaber().name} hat im FIAON Banking ${ergebnis.plaene.length === 1 ? "einen Auszahlungsplan" : `${ergebnis.plaene.length} Auszahlungspläne`} angelegt (mit TAN):`,
    "",
    ...ergebnis.plaene.map((p) => `  ${p.nummer}  ${p.name}: ${p.anzahlTeile} Teilbeträge à ${geld(ein.teilCents)} (zusammen ${geld(anspruchJe.get(p.agentId) ?? 0)})`),
    "",
    `Je Plan ist alle ${ein.abstandMin} Minuten ein Teilbetrag möglich. So geht es:`,
    "  1. Im FIAON Banking anmelden und den Reiter „Auszahlungsplan“ öffnen.",
    "  2. Steht dort „Bereit“: „Teilbetrag auslösen“ drücken. Empfänger, Betrag und Konto stehen fest im Plan.",
    "  3. „Jetzt mit TAN freigeben“ — die TAN kommt per Mail und gilt 5 Minuten. Sie können die Freigabe auch dem Inhaber überlassen.",
    `  4. Mit der Freigabe geht der Auftrag automatisch an die Buchhaltung (${BUCHHALTUNG_AUSFUEHRUNG}).`,
    "  5. Erst deren Bestätigung bucht aus — dann steht „Ausgeführt“ da, und der Durchführungsbeleg kommt per Mail.",
    "  6. Wirkt etwas falsch: „Pausieren“ (mit Grund). Dann steht der Plan still, bis der Inhaber ihn fortsetzt.",
    ...(verrechnet ? ["", "Offene Altposten der Empfänger sind in den Plänen verrechnet; Aufträge, die dazu noch bei der Buchhaltung lagen, sind zurückgerufen."] : []),
    "",
    REITER,
    "",
    `${inhaber().name} · ${inhaber().titel}`,
    "FIAON Banking",
  ].join("\n"));
  if (!m.ok) hinweise.push(`Die Info-Mail an die Geschäftsführung ging nicht raus (${m.grund}).`);
  return { ok: true, plaene: ergebnis.plaene, zurueckgerufen: zurueck.map((z) => z.nummer), hinweise };
}

// ═══════════════════════════════════════════════════════════════════════════
// AUSLÖSEN — ein Teilbetrag, EINE Transaktion
// ═══════════════════════════════════════════════════════════════════════════
export type AusloesenErgebnis =
  | { ok: true; schon: boolean; auftrag: Auftrag; plan: { id: number; nummer: string }; teil: { nr: number; anzahl: number; betragCents: number }; naechsteAb: string }
  | PlanFehler;

/**
 * Inhaber oder Geschäftsführung: den nächsten Teilbetrag auslösen. Der Empfänger, der Betrag und das Konto stehen
 * fest; wer auslöst, wählt nichts. In einer Transaktion: Plan sperren (FOR UPDATE), Wartezeit in Datenbank-Zeit
 * prüfen, Stau-Grenze, Konto, nächste freie Teil-Zeile — dann Auszahlung, Provisionszeile, Zahlungsauftrag, Teil,
 * Takt und neue Wartezeit. Ein Doppelklick derselben Person (unter 60 s) bekommt denselben Auftrag zurück.
 */
export async function teilAusloesen(planId: number, von: BuchPerson, lauf: Lauf = sqlPool): Promise<AusloesenErgebnis> {
  await planSchema();
  const entschl = await entschluessler();
  for (let versuch = 1; versuch <= 3; versuch++) {
    try {
      const r = await inTransaktion(lauf, async (tx: any): Promise<
        | { ok: true; schon: boolean; auftragId: number; planNummer: string; nr: number; anzahl: number; betragCents: number; naechsteAb: string; neu?: { agentId: number; payoutId: number; name: string; hinweis: boolean } }
        | PlanFehler
      > => {
        const [p] = (await tx`
          SELECT p.*, NOW() AS jetzt FROM fiaon_auszahlungsplan p WHERE p.id = ${planId} FOR UPDATE`) as any[];
        if (!p) return fehler(404, "NICHT_GEFUNDEN", "Diesen Auszahlungsplan gibt es nicht.");
        if (p.status !== "aktiv") return fehler(409, "NICHT_AKTIV", planStatusSatz(planBezugAusZeile(p)));
        const jetzt = new Date(p.jetzt).getTime();
        if (new Date(p.naechste_ab).getTime() > jetzt) {
          // Doppelklick oder zweites Fenster derselben Person: dieselbe Antwort statt „zu früh“.
          if (p.letzte_ausloesung_von === von.email && p.letzte_ausloesung_am && jetzt - new Date(p.letzte_ausloesung_am).getTime() < 60_000) {
            const [k] = (await tx`
              SELECT k.auftrag_id, t.nr, t.betrag_cents FROM fiaon_auszahlungsplan_takt k
                LEFT JOIN fiaon_auszahlungsplan_teil t ON t.id = k.teil_id
               WHERE k.plan_id = ${planId} ORDER BY k.id DESC LIMIT 1`) as any[];
            if (k?.auftrag_id) {
              return { ok: true, schon: true, auftragId: zahl(k.auftrag_id), planNummer: String(p.nummer), nr: zahl(k.nr), anzahl: zahl(p.anzahl_teile), betragCents: zahl(k.betrag_cents), naechsteAb: iso(p.naechste_ab)! };
            }
          }
          return fehler(409, "ZU_FRUEH", `Der nächste Teilbetrag geht ab ${uhr(p.naechste_ab)} Uhr.`, { naechsteAb: iso(p.naechste_ab)! });
        }
        const [stau] = (await tx`
          SELECT COUNT(*)::int AS n FROM fiaon_buch_auftrag o JOIN fiaon_auszahlungsplan_teil t ON t.id = o.plan_teil_id
           WHERE t.plan_id = ${planId} AND o.status IN ('eingereicht', 'freigegeben')`) as any[];
        if (zahl(stau?.n) >= zahl(p.max_offen)) {
          return fehler(409, "STAU", `${zahl(stau.n)} Teilbeträge sind unterwegs. Der nächste geht, sobald die Buchhaltung einen bestätigt (oder einer zurückkommt).`);
        }
        const ag = await agentLesen(zahl(p.agent_id), tx);
        const konto = kontoLage(ag, String(p.iban_pruef), entschl);
        if (!konto.ok) return fehler(409, "KONTO", konto.grund || "Das Konto des Empfängers ist nicht verwendbar.");
        const [teil] = (await tx`
          SELECT id, nr, betrag_cents FROM fiaon_auszahlungsplan_teil
           WHERE plan_id = ${planId} AND payout_id IS NULL AND ausgefuehrt_am IS NULL
           ORDER BY nr LIMIT 1 FOR UPDATE`) as any[];
        if (!teil) {
          const [rest] = (await tx`
            SELECT COUNT(*) FILTER (WHERE ausgefuehrt_am IS NULL)::int AS offen FROM fiaon_auszahlungsplan_teil WHERE plan_id = ${planId}`) as any[];
          if (zahl(rest?.offen) === 0) {
            await tx`
              UPDATE fiaon_auszahlungsplan SET status = 'fertig', status_am = NOW(), status_von = 'system', status_grund = 'Alle Teilbeträge ausgeführt'
               WHERE id = ${planId} AND status IN ('aktiv', 'pausiert')`;
            return fehler(409, "FERTIG", `Alle ${zahl(p.anzahl_teile)} Teilbeträge von ${p.nummer} sind ausgeführt.`);
          }
          return fehler(409, "UNTERWEGS", "Alle übrigen Teilbeträge sind unterwegs. Der nächste geht, sobald einer zurückkommt oder ausgeführt ist.");
        }
        const name = agentName(ag);
        const betrag = zahl(teil.betrag_cents);
        const nr = zahl(teil.nr);
        const anzahl = zahl(p.anzahl_teile);
        // Der Bank-Schnappschuss wie bei jeder Anforderung (fiaon-agent.ts, anforderungAnlegen).
        const [po] = (await tx`
          INSERT INTO fiaon_payouts (agent_id, amount_cents, bank_holder_enc, bank_iban_enc, bank_bic_enc, iban_masked)
          VALUES (${zahl(p.agent_id)}, ${betrag}, ${ag.bank_holder_enc}, ${ag.bank_iban_enc}, ${ag.bank_bic_enc}, ${konto.ibanMasked})
          RETURNING id`) as any[];
        const payoutId = zahl(po.id);
        const ref = `${p.nummer}-T${String(nr).padStart(3, "0")}`;
        await tx`
          INSERT INTO fiaon_commissions (agent_id, ref, pack_name, base_amount_cents, rate_bp, amount_cents, status, kind, payout_id, note)
          VALUES (${zahl(p.agent_id)}, ${ref}, 'Auszahlungsplan', ${betrag}, 0, ${betrag}, 'in_auszahlung', ${KIND_AUSZAHLUNGSPLAN}, ${payoutId},
                  ${`Auszahlungsplan ${p.nummer} · Teil ${nr} von ${anzahl}`})`;
        const nummer = await naechsteNummer(tx);
        const halter = String(entschl(ag.bank_holder_enc) || "").trim() || name;
        const bic = String(entschl(ag.bank_bic_enc) || "").trim().toUpperCase() || null;
        const zweck = `FIAON Auszahlung Nr. ${payoutId} · Provision · Auszahlungsplan ${p.nummer} · Teil ${nr}/${anzahl}`;
        const [o] = (await tx`
          INSERT INTO fiaon_buch_auftrag
            (nummer, empfaenger, iban, bic, betrag_cents, zweck, kategorie, status, erstellt_von, payout_id,
             eingereicht_am, ausfuehrung_extern, plan_teil_id)
          VALUES (${nummer}, ${halter}, ${konto.iban}, ${bic}, ${betrag}, ${zweck}, 'Provision', 'eingereicht', ${String(p.angelegt_von)},
                  ${payoutId}, NOW(), ${BUCHHALTUNG_AUSFUEHRUNG}, ${zahl(teil.id)})
          RETURNING id`) as any[];
        const auftragId = zahl(o.id);
        const belegt = (await tx`
          UPDATE fiaon_auszahlungsplan_teil
             SET payout_id = ${payoutId}, auftrag_id = ${auftragId}, ausgeloest_von = ${von.email}, ausgeloest_am = NOW(),
                 selbstfreigabe = FALSE, versuche = versuche + 1
           WHERE id = ${zahl(teil.id)} AND payout_id IS NULL AND ausgefuehrt_am IS NULL
          RETURNING id`) as any[];
        if (!belegt.length) throw new PlanAbbruch(409, "ZU_FRUEH", "Dieser Teilbetrag wurde gerade schon ausgelöst.");
        await tx`
          INSERT INTO fiaon_auszahlungsplan_takt (plan_id, teil_id, payout_id, auftrag_id, von, ausgeloest_am, sperre_bis)
          VALUES (${planId}, ${zahl(teil.id)}, ${payoutId}, ${auftragId}, ${von.email}, NOW(), NOW() + ${zahl(p.abstand_min)}::int * INTERVAL '1 minute')`;
        const [neu] = (await tx`
          UPDATE fiaon_auszahlungsplan
             SET naechste_ab = NOW() + abstand_min * INTERVAL '1 minute', letzte_ausloesung_am = NOW(), letzte_ausloesung_von = ${von.email}
           WHERE id = ${planId}
          RETURNING naechste_ab`) as any[];
        return {
          ok: true, schon: false, auftragId, planNummer: String(p.nummer), nr, anzahl, betragCents: betrag, naechsteAb: iso(neu.naechste_ab)!,
          neu: { agentId: zahl(p.agent_id), payoutId, name, hinweis: p.hinweis_an_inhaber === true && von.rolle !== "inhaber" },
        };
      });
      if (!r.ok) return r;
      const a = await auftrag(r.auftragId, lauf);
      if (!a) return fehler(500, "AUFTRAG_FEHLT", "Der Teilbetrag ist ausgelöst, aber sein Auftrag ist nicht lesbar. Bitte neu laden.");
      if (r.neu) {
        buchProtokoll(von.email, "Teilbetrag ausgelöst", a.nummer, `${r.planNummer} · Teil ${r.nr} von ${r.anzahl} · ${geld(r.betragCents)} an ${r.neu.name}`);
        const { logAgentEvent } = await import("../routes/fiaon-agent");
        await logAgentEvent(r.neu.agentId, "payout_requested", { payout_id: r.neu.payoutId, amount_cents: r.betragCents, quelle: "auszahlungsplan", plan: r.planNummer, teil: r.nr })
          .catch((e) => console.warn("[AUSZAHLUNGSPLAN] Ereignis payout_requested:", String(e).slice(0, 140)));
        if (r.neu.hinweis) {
          // Der Inhaber gibt frei — oder überlässt es der auslösenden Person. Der Link öffnet direkt den Auftrag.
          const m = await gmailSenden(inhaber().email, `Bitte freigeben: ${a.nummer} · ${geld(a.betragCents)} an ${r.neu.name} (${r.planNummer}, Teil ${r.nr}/${r.anzahl})`, [
            `${von.name} hat im Auszahlungsplan ${r.planNummer} den Teilbetrag ${r.nr} von ${r.anzahl} ausgelöst:`,
            "",
            `  ${a.nummer} · ${geld(a.betragCents)} an ${a.empfaenger} (${ibanMaskiert(a.iban)})`,
            "",
            `Freigeben: ${REITER}&auftrag=${a.id}`,
            `Du kannst die Freigabe auch ${von.name.split(" ")[0]} überlassen. Den Hinweis schaltest du im Plan ab.`,
            "",
            "FIAON Banking",
          ].join("\n"));
          if (!m.ok) console.warn(`[AUSZAHLUNGSPLAN] Hinweis an den Inhaber zu ${a.nummer} nicht versendet: ${m.grund}`);
        }
      }
      return { ok: true, schon: r.schon, auftrag: a, plan: { id: planId, nummer: r.planNummer }, teil: { nr: r.nr, anzahl: r.anzahl, betragCents: r.betragCents }, naechsteAb: r.naechsteAb };
    } catch (e: any) {
      if (e instanceof PlanAbbruch) return fehler(e.status, e.code, e.grund);
      // Das Netz unter der Zeilensperre: ein überlappendes Sperrfenster heißt „zu früh“.
      if (e?.code === "23P01") return fehler(409, "ZU_FRUEH", "Für diesen Plan läuft gerade die Wartezeit. Bitte neu laden.");
      // Zwei Aufträge zogen gleichzeitig dieselbe ZA-Nummer — die Transaktion ist zurückgerollt, also neu versuchen.
      if (e?.code === "23505" && /nummer/.test(String(e?.constraint_name || e?.message || "")) && versuch < 3) continue;
      throw e;
    }
  }
  return fehler(409, "NUMMER", "Die Auftragsnummer war gerade mehrfach vergeben. Bitte noch einmal auslösen.");
}

// ═══════════════════════════════════════════════════════════════════════════
// RÜCKWEG, FREIGABE, AUSFÜHRUNG — Haken aus fiaon-buchhaltung.ts
// ═══════════════════════════════════════════════════════════════════════════
const ART_TEXT: Record<TeilZurueckArt, string> = {
  abgelehnt: "abgelehnt",
  zurueckgezogen: "zurückgezogen",
  zurueckgerufen: "bei der Buchhaltung zurückgerufen",
  beendet: "zurückgezogen (Plan beendet)",
};

/**
 * Ein Teilbetrag geht zurück in den Plan — aufgerufen beim Ablehnen, Zurückziehen, Zurückrufen und Beenden, IMMER in
 * der Transaktion, die den Auftrag schließt (`tx`). Die Auszahlung wird abgelehnt, ihre Provision storniert (nie
 * zurück auf „bestätigt“), der Teil wieder frei. Die Takt-Zeile bleibt: Die Wartezeit ist verbraucht.
 */
export async function planTeilZurueck(auftragId: number, art: TeilZurueckArt, grund: string, wer: string, tx: any): Promise<{ planNummer: string; nr: number } | null> {
  const [t] = (await tx`
    SELECT t.id, t.nr, t.payout_id, p.nummer, p.agent_id
      FROM fiaon_auszahlungsplan_teil t JOIN fiaon_auszahlungsplan p ON p.id = t.plan_id
     WHERE t.auftrag_id = ${auftragId} AND t.ausgefuehrt_am IS NULL
     FOR UPDATE OF t`) as any[];
  if (!t) return null;
  const vermerk = `Auszahlungsplan ${t.nummer}: Teilbetrag ${t.nr} ${ART_TEXT[art]}${grund ? ` — ${text(grund, 200)}` : ""}`;
  const payoutId = zahl(t.payout_id);
  const [po] = (await tx`SELECT status, amount_cents FROM fiaon_payouts WHERE id = ${payoutId} FOR UPDATE`) as any[];
  if (po && po.status === "ausgezahlt") {
    // Die Auszahlung ist schon gebucht (auf einem Weg am Plan vorbei) — das Geld gilt als gezahlt. Der Teil wird
    // NICHT frei (sonst ginge er ein zweites Mal raus), sondern zählt als ausgeführt; die Spur steht im Protokoll.
    await tx`UPDATE fiaon_auszahlungsplan_teil SET ausgefuehrt_am = COALESCE(ausgefuehrt_am, NOW()) WHERE id = ${zahl(t.id)}`;
    console.error(`[AUSZAHLUNGSPLAN] ${t.nummer} Teil ${t.nr}: Auszahlung #${payoutId} stand schon auf „ausgezahlt“ — Teil als ausgeführt gezählt, nicht freigegeben.`);
    buchProtokoll(wer, "Teilbetrag bereits ausgezahlt", String(t.nummer), `Teil ${t.nr}: Auszahlung #${payoutId} war schon gebucht — zählt als ausgeführt.`);
    return { planNummer: String(t.nummer), nr: zahl(t.nr) };
  }
  if (po && po.status !== "abgelehnt") {
    await tx`
      UPDATE fiaon_payouts SET status = 'abgelehnt', reject_reason = ${vermerk}, processed_at = NOW()
       WHERE id = ${payoutId} AND status IN ('angefordert', 'requested')`;
  }
  await tx`
    UPDATE fiaon_commissions SET status = 'storniert', updated_at = NOW(), note = TRIM(COALESCE(note, '') || ${` · ${ART_TEXT[art]}`})
     WHERE payout_id = ${payoutId} AND status = 'in_auszahlung'`;
  await tx`
    UPDATE fiaon_auszahlungsplan_teil
       SET payout_id = NULL, auftrag_id = NULL, ausgeloest_von = NULL, ausgeloest_am = NULL, selbstfreigabe = FALSE
     WHERE id = ${zahl(t.id)} AND auftrag_id = ${auftragId} AND ausgefuehrt_am IS NULL`;
  await tx`
    INSERT INTO fiaon_agent_events (agent_id, type, meta)
    VALUES (${zahl(t.agent_id)}, 'payout_rejected', ${JSON.stringify({ payout_id: payoutId, reason: vermerk, quelle: "auszahlungsplan", plan: String(t.nummer), teil: zahl(t.nr), von: wer })})`;
  buchProtokoll(wer, "Teilbetrag zurück in den Plan", String(t.nummer), vermerk);
  return { planNummer: String(t.nummer), nr: zahl(t.nr) };
}

/** Nach der Freigabe: Hat die empfangende Person selbst freigegeben? Sichtbar im Plan, im Beleg und in der Sammelmeldung. */
export async function planTeilFreigegeben(a: Auftrag, von: BuchPerson, lauf: Lauf = sqlPool): Promise<{ selbst: boolean } | null> {
  if (!a.planTeilId) return null;
  try {
    const [r] = (await lauf`
      UPDATE fiaon_auszahlungsplan_teil t
         SET selbstfreigabe = (LOWER(COALESCE(ag.email, '')) = LOWER(${von.email}))
        FROM fiaon_auszahlungsplan p LEFT JOIN fiaon_agents ag ON ag.id = p.agent_id
       WHERE t.id = ${a.planTeilId} AND t.auftrag_id = ${a.id} AND p.id = t.plan_id
      RETURNING t.selbstfreigabe, t.nr, p.nummer`) as any[];
    if (!r) {
      console.error(`[AUSZAHLUNGSPLAN] ${a.nummer}: Teilbetrag zur Freigabe nicht gefunden.`);
      return null;
    }
    if (r.selbstfreigabe === true) {
      buchProtokoll(von.email, "Selbstfreigabe im Auszahlungsplan", a.nummer,
        `${r.nummer} Teil ${r.nr}: Freigabe durch die empfangende Person im Rahmen des vom Inhaber mit TAN angelegten Plans`);
    }
    return { selbst: r.selbstfreigabe === true };
  } catch (e) {
    console.error(`[AUSZAHLUNGSPLAN] ${a.nummer}: Selbstfreigabe nicht vermerkt:`, e);
    return null;
  }
}

/**
 * Nach der Bestätigung der Buchhaltung (ausfuehrenKern): Teil ausgeführt. Zählt jeden Teil höchstens einmal. Alle
 * zehn ausgeführten Teile (und zum Schluss) eine Sammelmeldung — an den Inhaber und an den Empfänger.
 */
export async function planTeilAusgefuehrt(a: Auftrag, lauf: Lauf = sqlPool): Promise<{ neu: boolean; fertig?: number; gesamt?: number; abgeschlossen?: boolean }> {
  if (!a.planTeilId) return { neu: false };
  await planSchema();
  const [t] = (await lauf`
    UPDATE fiaon_auszahlungsplan_teil SET ausgefuehrt_am = NOW()
     WHERE auftrag_id = ${a.id} AND ausgefuehrt_am IS NULL
    RETURNING id, plan_id, nr`) as any[];
  if (!t) return { neu: false };
  const planId = zahl(t.plan_id);
  const [s] = (await lauf`
    SELECT COUNT(*)::int AS gesamt, COUNT(*) FILTER (WHERE ausgefuehrt_am IS NOT NULL)::int AS fertig
      FROM fiaon_auszahlungsplan_teil WHERE plan_id = ${planId}`) as any[];
  const gesamt = zahl(s?.gesamt), fertig = zahl(s?.fertig);
  const abgeschlossen = gesamt > 0 && fertig >= gesamt;
  if (abgeschlossen) {
    await lauf`
      UPDATE fiaon_auszahlungsplan SET status = 'fertig', status_am = NOW(), status_von = 'system', status_grund = 'Alle Teilbeträge ausgeführt'
       WHERE id = ${planId} AND status IN ('aktiv', 'pausiert')`;
  }
  buchProtokoll(null, "Teilbetrag ausgeführt", a.nummer, `Teil ${t.nr} · ${fertig} von ${gesamt} ausgeführt`);
  const marke = abgeschlossen ? gesamt : Math.floor(fertig / 10) * 10;
  if (marke > 0) {
    // Genau eine Meldung je Marke, auch wenn zwei Bestätigungen gleichzeitig ankommen.
    const [m] = (await lauf`
      WITH alt AS (SELECT meilenstein FROM fiaon_auszahlungsplan WHERE id = ${planId} FOR UPDATE)
      UPDATE fiaon_auszahlungsplan p SET meilenstein = ${marke}
        FROM alt WHERE p.id = ${planId} AND alt.meilenstein < ${marke}
      RETURNING alt.meilenstein AS vorher`) as any[];
    if (m) {
      void meilensteinMelden(planId, zahl(m.vorher), marke, abgeschlossen)
        .catch((e) => console.error(`[AUSZAHLUNGSPLAN] Sammelmeldung zu Plan ${planId}:`, e));
    }
  }
  return { neu: true, fertig, gesamt, abgeschlossen };
}

/** Die Mailwerk-Vorlage der Sammelmitteilung an den Empfänger (Gruppe „team“, du). */
const VORLAGE_STAND: string = "agent_auszahlungsplan_stand";

async function meilensteinMelden(planId: number, vorher: number, marke: number, abgeschlossen: boolean): Promise<void> {
  const [p] = (await sqlPool`
    SELECT p.*, a.name, a.first_name, a.last_name, a.email AS ag_email
      FROM fiaon_auszahlungsplan p LEFT JOIN fiaon_agents a ON a.id = p.agent_id WHERE p.id = ${planId}`) as any[];
  if (!p) return;
  const name = agentName(p);
  const [s] = (await sqlPool`
    SELECT COUNT(*) FILTER (WHERE ausgefuehrt_am IS NOT NULL)::int AS fertig,
           COALESCE(SUM(betrag_cents) FILTER (WHERE ausgefuehrt_am IS NOT NULL), 0)::bigint AS fertig_cents,
           COUNT(*)::int AS gesamt
      FROM fiaon_auszahlungsplan_teil WHERE plan_id = ${planId}`) as any[];
  const fertig = zahl(s?.fertig), gesamt = zahl(s?.gesamt), fertigCents = zahl(s?.fertig_cents);
  const seit = Math.max(1, marke - vorher);
  // Wer hat im letzten Abschnitt freigegeben — und wie oft die empfangende Person selbst?
  const abschnitt = (await sqlPool`
    SELECT o.entschieden_von, t.selbstfreigabe FROM fiaon_auszahlungsplan_teil t JOIN fiaon_buch_auftrag o ON o.id = t.auftrag_id
     WHERE t.plan_id = ${planId} AND t.ausgefuehrt_am IS NOT NULL
     ORDER BY t.ausgefuehrt_am DESC, t.id DESC LIMIT ${seit}`) as any[];
  const jeFreigeber = new Map<string, number>();
  let selbst = 0;
  for (const z of abschnitt) {
    const k = nameVon(z.entschieden_von);
    jeFreigeber.set(k, (jeFreigeber.get(k) ?? 0) + 1);
    if (z.selbstfreigabe === true) selbst += 1;
  }
  const [offen] = (await sqlPool`
    SELECT COUNT(*)::int AS n, MIN(o.extern_gesendet_am) AS aeltester
      FROM fiaon_buch_auftrag o JOIN fiaon_auszahlungsplan_teil t ON t.id = o.plan_teil_id
     WHERE t.plan_id = ${planId} AND o.status = 'freigegeben' AND o.extern_bestaetigt_am IS NULL`) as any[];
  const freigeber = Array.from(jeFreigeber.entries()).map(([k, v]) => `${k} ${v}`).join(", ") || "—";
  const m = await gmailSenden(inhaber().email,
    abgeschlossen ? `${p.nummer} abgeschlossen: alle ${gesamt} Teilbeträge ausgeführt` : `${p.nummer}: ${fertig} von ${gesamt} Teilbeträgen ausgeführt`, [
      `${p.nummer} · ${name}: ${fertig} von ${gesamt} Teilbeträgen ausgeführt (${geld(fertigCents)} von ${geld(zahl(p.anspruch_cents))}).`,
      "",
      `Seit der letzten Meldung: ${seit}. Freigegeben von ${freigeber}${selbst ? `; davon ${selbst} durch die empfangende Person selbst` : ""}.`,
      `Bei der Buchhaltung offen: ${zahl(offen?.n)}${offen?.aeltester ? ` (ältester gesendet ${zeitpunkt(offen.aeltester)})` : ""}.`,
      ...(abgeschlossen ? ["", "Der Plan ist abgeschlossen."] : []),
      "",
      REITER,
      "",
      "FIAON Banking",
    ].join("\n"));
  if (!m.ok) console.warn(`[AUSZAHLUNGSPLAN] Sammelmeldung ${p.nummer} an den Inhaber nicht versendet: ${m.grund}`);

  // Die Sammelmitteilung an den Empfänger läuft über das Mailwerk. Die Vorlage legt der Mail-Teil an
  // (server/mail/vorlagen/team.ts); solange sie fehlt, geht nichts raus — und keine Abrechnung gilt als zugestellt.
  const { hatVorlage } = await import("../mail/motor");
  const { getEventDef } = await import("../make-events-registry");
  if (!hatVorlage(VORLAGE_STAND) || !getEventDef(VORLAGE_STAND)) {
    console.warn(`[AUSZAHLUNGSPLAN] Sammelmitteilung ${p.nummer} an den Empfänger nicht gesendet — Vorlage ${VORLAGE_STAND} fehlt noch.`);
    return;
  }
  let belege: any[] = [];
  try {
    belege = (await sqlPool`
      SELECT s.id, s.statement_no FROM fiaon_commission_statements s
        JOIN fiaon_auszahlungsplan_teil t ON t.payout_id = s.payout_id
       WHERE t.plan_id = ${planId} AND t.ausgefuehrt_am IS NOT NULL AND s.gesendet_am IS NULL
       ORDER BY s.id`) as any[];
  } catch (e) {
    console.warn(`[AUSZAHLUNGSPLAN] Abrechnungen zu ${p.nummer} nicht lesbar:`, String(e).slice(0, 140));
  }
  const { sendMakeWebhookMitGrund } = await import("../make-webhook");
  const erg = await sendMakeWebhookMitGrund(VORLAGE_STAND as MakeEventType, {
    email: String(p.ag_email || ""),
    vorname: String(p.first_name || name.split(" ")[0] || ""),
    plan_nummer: String(p.nummer),
    anzahl_neu: seit,
    teilbetrag: euroZahl(zahl(p.teil_cents)),
    stand_anzahl: fertig,
    gesamt_anzahl: gesamt,
    stand_betrag: euroZahl(fertigCents),
    anspruch: euroZahl(zahl(p.anspruch_cents)),
    abgeschlossen,
    abrechnungen: belege.map((b) => String(b.statement_no)).join(", "),
    abrechnungen_url: `${SEITE}/agent/wallet`,
  });
  if (!erg.ok) {
    console.warn(`[AUSZAHLUNGSPLAN] Sammelmitteilung ${p.nummer} an den Empfänger nicht gesendet: ${erg.grund}`);
    return;
  }
  if (belege.length) {
    await sqlPool`
      UPDATE fiaon_commission_statements
         SET gesendet_am = NOW(), gesendet_an = ${String(p.ag_email || "")}, sende_anzahl = COALESCE(sende_anzahl, 0) + 1,
             gesendet_von = 'Auszahlungsplan (Sammelmitteilung)'
       WHERE id = ANY(${belege.map((b) => zahl(b.id))}) AND gesendet_am IS NULL`
      .catch((e: unknown) => console.warn(`[AUSZAHLUNGSPLAN] Abrechnungen zu ${p.nummer} nicht als zugestellt vermerkt:`, String(e).slice(0, 140)));
  }
}

export interface PlanBezug {
  planId: number; nummer: string; status: PlanStatus; statusGrund: string | null; statusVon: string | null; statusAm: string | null;
  teilId: number | null; nr: number | null; anzahl: number; agentId: number;
  ausgeloestVon: string | null; ausgeloestAm: string | null; selbstfreigabe: boolean;
}

function planBezugAusZeile(r: any): PlanBezug {
  return {
    planId: zahl(r.plan_id ?? r.id), nummer: String(r.nummer), status: String(r.status) as PlanStatus,
    statusGrund: r.status_grund ?? null, statusVon: r.status_von ?? null, statusAm: iso(r.status_am),
    teilId: r.teil_id != null ? zahl(r.teil_id) : null, nr: r.nr != null ? zahl(r.nr) : null, anzahl: zahl(r.anzahl_teile), agentId: zahl(r.agent_id),
    ausgeloestVon: r.ausgeloest_von ?? null, ausgeloestAm: iso(r.ausgeloest_am), selbstfreigabe: r.selbstfreigabe === true,
  };
}

/** Plan und Teil hinter einem Auftrag — für Mailtexte, die Link-Seite der Buchhaltung und die Freigabeprüfung. */
export async function planZuAuftrag(a: Pick<Auftrag, "planTeilId">, lauf: Lauf = sqlPool): Promise<PlanBezug | null> {
  if (!a.planTeilId) return null;
  await planSchema();
  const [r] = (await lauf`
    SELECT t.id AS teil_id, t.nr, t.ausgeloest_von, t.ausgeloest_am, t.selbstfreigabe,
           p.id AS plan_id, p.nummer, p.status, p.status_grund, p.status_von, p.status_am, p.anzahl_teile, p.agent_id
      FROM fiaon_auszahlungsplan_teil t JOIN fiaon_auszahlungsplan p ON p.id = t.plan_id
     WHERE t.id = ${a.planTeilId}`) as any[];
  return r ? planBezugAusZeile(r) : null;
}

/** Der Satz zum Zustand eines Plans, der nicht läuft. */
export function planStatusSatz(b: Pick<PlanBezug, "nummer" | "status" | "statusGrund" | "statusVon" | "statusAm">): string {
  if (b.status === "pausiert") {
    return `Der Auszahlungsplan ${b.nummer} ist pausiert${b.statusVon ? ` (seit ${zeitpunkt(b.statusAm)} von ${nameVon(b.statusVon)}` : " ("}${b.statusGrund ? `: ${b.statusGrund}` : ""}) — es geht erst weiter, wenn der Inhaber ihn fortsetzt.`;
  }
  if (b.status === "beendet") return `Der Auszahlungsplan ${b.nummer} ist beendet${b.statusGrund ? ` (${b.statusGrund})` : ""}.`;
  if (b.status === "fertig") return `Der Auszahlungsplan ${b.nummer} ist abgeschlossen — alle Teilbeträge sind ausgeführt.`;
  return `Der Auszahlungsplan ${b.nummer} läuft.`;
}

// ═══════════════════════════════════════════════════════════════════════════
// STEUERUNG: pausieren, fortsetzen, beenden, Konto, Hinweis
// ═══════════════════════════════════════════════════════════════════════════
type Einfach = { ok: true } | PlanFehler;

/** Beide Rollen dürfen pausieren — Pausieren schützt nur. Der Grund ist Pflicht. */
export async function planPausieren(id: number, von: BuchPerson, grund: string, lauf: Lauf = sqlPool): Promise<Einfach> {
  await planSchema();
  const g = text(grund, 300);
  if (g.length < 3) return fehler(400, "GRUND", "Bitte kurz sagen, warum pausiert wird — der Grund steht im Plan und im Protokoll.");
  const [r] = (await lauf`
    UPDATE fiaon_auszahlungsplan SET status = 'pausiert', status_von = ${von.email}, status_am = NOW(), status_grund = ${g}
     WHERE id = ${id} AND status = 'aktiv'
    RETURNING nummer`) as any[];
  if (!r) return planNichtAenderbar(id, "pausieren", lauf);
  buchProtokoll(von.email, "Auszahlungsplan pausiert", String(r.nummer), g);
  if (von.rolle !== "inhaber") {
    benachrichtigen(inhaber().email, `Auszahlungsplan pausiert: ${r.nummer}`, [
      `${von.name} hat den Auszahlungsplan ${r.nummer} pausiert:`,
      "",
      `  Grund: ${g}`,
      "",
      `Bis du ihn fortsetzt, wird nichts ausgelöst und nichts freigegeben. ${REITER}`,
    ]);
  }
  return { ok: true };
}

/** Nur der Inhaber setzt fort — Fortsetzen ist eine bewusste Entscheidung. */
export async function planFortsetzen(id: number, von: BuchPerson, lauf: Lauf = sqlPool): Promise<Einfach> {
  if (von.rolle !== "inhaber") return fehler(403, "NUR_INHABER", "Fortsetzen darf nur der Inhaber.");
  await planSchema();
  const [r] = (await lauf`
    UPDATE fiaon_auszahlungsplan SET status = 'aktiv', status_von = ${von.email}, status_am = NOW(), status_grund = NULL
     WHERE id = ${id} AND status = 'pausiert'
    RETURNING nummer`) as any[];
  if (!r) return planNichtAenderbar(id, "fortsetzen", lauf);
  buchProtokoll(von.email, "Auszahlungsplan fortgesetzt", String(r.nummer), null);
  return { ok: true };
}

async function planNichtAenderbar(id: number, was: string, lauf: Lauf): Promise<PlanFehler> {
  const [p] = (await lauf`SELECT nummer, status, status_grund, status_von, status_am FROM fiaon_auszahlungsplan WHERE id = ${id}`) as any[];
  if (!p) return fehler(404, "NICHT_GEFUNDEN", "Diesen Auszahlungsplan gibt es nicht.");
  return fehler(409, "ZUSTAND", `${was[0].toUpperCase()}${was.slice(1)} geht gerade nicht: ${planStatusSatz(planBezugAusZeile(p))}`);
}

/** Inhaber: TAN zum Beenden anfordern. */
export async function planEndeTanAnfordern(id: number, von: BuchPerson): Promise<{ ok: true; an: string; beschreibung: string } | PlanFehler> {
  if (von.rolle !== "inhaber") return fehler(403, "NUR_INHABER", "Beenden darf nur der Inhaber.");
  await planSchema();
  const [p] = (await sqlPool`SELECT p.nummer, p.status, a.name, a.first_name, a.last_name, a.id FROM fiaon_auszahlungsplan p LEFT JOIN fiaon_agents a ON a.id = p.agent_id WHERE p.id = ${id}`) as any[];
  if (!p) return fehler(404, "NICHT_GEFUNDEN", "Diesen Auszahlungsplan gibt es nicht.");
  if (!["aktiv", "pausiert"].includes(String(p.status))) return fehler(409, "ZUSTAND", planStatusSatz(planBezugAusZeile(p)));
  const beschreibung = `Auszahlungsplan ${p.nummer} (${agentName(p)}) beenden — eingereichte Teilbeträge werden zurückgezogen, Aufträge bei der Buchhaltung bleiben bis zum Rückruf.`;
  const t = await tanAnfordern(von, "plan-ende", `plan-ende:${id}`, beschreibung);
  if (!t.ok) return fehler(503, "TAN_VERSAND", t.grund);
  return { ok: true, an: von.email, beschreibung };
}

/**
 * Inhaber: Plan beenden (mit TAN). Eingereichte Teilbeträge werden zurückgezogen; freigegebene, die schon bei der
 * Buchhaltung liegen, bleiben stehen und kommen als Liste zurück — der Rückruf geht einzeln und bewusst.
 */
export async function planBeenden(
  id: number, von: BuchPerson, grund: string, tan: string,
): Promise<{ ok: true; zurueckgezogen: string[]; beiBuchhaltung: { id: number; nummer: string; betragCents: number }[] } | PlanFehler> {
  if (von.rolle !== "inhaber") return fehler(403, "NUR_INHABER", "Beenden darf nur der Inhaber.");
  const g = text(grund, 300);
  if (g.length < 3) return fehler(400, "GRUND", "Bitte einen Grund angeben.");
  await planSchema();
  const t = await tanPruefen(von, "plan-ende", `plan-ende:${id}`, tan);
  if (!t.ok) return fehler(400, "TAN", t.grund);
  try {
    const erg = await sqlPool.begin(async (tx: any) => {
      const [p] = (await tx`SELECT id, nummer, status, status_grund, status_von, status_am FROM fiaon_auszahlungsplan WHERE id = ${id} FOR UPDATE`) as any[];
      if (!p) throw new PlanAbbruch(404, "NICHT_GEFUNDEN", "Diesen Auszahlungsplan gibt es nicht.");
      if (!["aktiv", "pausiert"].includes(String(p.status))) throw new PlanAbbruch(409, "ZUSTAND", planStatusSatz(planBezugAusZeile(p)));
      await tx`UPDATE fiaon_auszahlungsplan SET status = 'beendet', status_von = ${von.email}, status_am = NOW(), status_grund = ${g} WHERE id = ${id}`;
      const eingereicht = (await tx`
        SELECT o.id, o.nummer FROM fiaon_buch_auftrag o JOIN fiaon_auszahlungsplan_teil t ON t.id = o.plan_teil_id
         WHERE t.plan_id = ${id} AND o.status IN ('entwurf', 'eingereicht') ORDER BY o.id FOR UPDATE OF o`) as any[];
      const zurueckgezogen: string[] = [];
      for (const o of eingereicht) {
        const r = (await tx`UPDATE fiaon_buch_auftrag SET status = 'zurueckgezogen' WHERE id = ${zahl(o.id)} AND status IN ('entwurf', 'eingereicht') RETURNING id`) as any[];
        if (!r.length) continue;
        await planTeilZurueck(zahl(o.id), "beendet", g, von.email, tx);
        await tx`UPDATE fiaon_buch_tan SET benutzt_am = NOW() WHERE zweck = ${`freigabe:${zahl(o.id)}`} AND benutzt_am IS NULL`;
        zurueckgezogen.push(String(o.nummer));
      }
      const frei = (await tx`
        SELECT o.id, o.nummer, o.betrag_cents FROM fiaon_buch_auftrag o JOIN fiaon_auszahlungsplan_teil t ON t.id = o.plan_teil_id
         WHERE t.plan_id = ${id} AND o.status = 'freigegeben' AND o.extern_bestaetigt_am IS NULL ORDER BY o.id`) as any[];
      return { nummer: String(p.nummer), zurueckgezogen, beiBuchhaltung: frei.map((o) => ({ id: zahl(o.id), nummer: String(o.nummer), betragCents: zahl(o.betrag_cents) })) };
    });
    buchProtokoll(von.email, "Auszahlungsplan beendet (mit TAN)", erg.nummer,
      `${g}${erg.zurueckgezogen.length ? ` · zurückgezogen: ${erg.zurueckgezogen.join(", ")}` : ""}${erg.beiBuchhaltung.length ? ` · noch bei der Buchhaltung: ${erg.beiBuchhaltung.map((x) => x.nummer).join(", ")}` : ""}`);
    return { ok: true, zurueckgezogen: erg.zurueckgezogen, beiBuchhaltung: erg.beiBuchhaltung };
  } catch (e) {
    if (e instanceof PlanAbbruch) return fehler(e.status, e.code, e.grund);
    throw e;
  }
}

/** Inhaber: TAN anfordern, um nach einer Kontoänderung das neue Konto des Empfängers zu übernehmen. */
export async function planKontoTanAnfordern(id: number, von: BuchPerson): Promise<{ ok: true; an: string; beschreibung: string } | PlanFehler> {
  if (von.rolle !== "inhaber") return fehler(403, "NUR_INHABER", "Ein neues Konto bestätigt nur der Inhaber.");
  await planSchema();
  const [p] = (await sqlPool`SELECT * FROM fiaon_auszahlungsplan WHERE id = ${id}`) as any[];
  if (!p) return fehler(404, "NICHT_GEFUNDEN", "Diesen Auszahlungsplan gibt es nicht.");
  if (!["aktiv", "pausiert"].includes(String(p.status))) return fehler(409, "ZUSTAND", planStatusSatz(planBezugAusZeile(p)));
  const konto = kontoLage(await agentLesen(zahl(p.agent_id), sqlPool), String(p.iban_pruef), await entschluessler());
  if (konto.art !== "geaendert" || !konto.pruef) {
    return fehler(409, "KONTO_UNVERAENDERT", konto.ok ? "Das Konto ist unverändert — es gibt nichts zu bestätigen." : (konto.grund || "Das Konto ist nicht verwendbar."));
  }
  const beschreibung = `Neues Konto für ${p.nummer}: ${konto.ibanMasked} (bisher ${p.iban_masked || "—"}) — künftige Teilbeträge gehen auf dieses Konto.`;
  const t = await tanAnfordern(von, "plan-konto", `plan-konto:${id}:${konto.pruef}`, beschreibung);
  if (!t.ok) return fehler(503, "TAN_VERSAND", t.grund);
  return { ok: true, an: von.email, beschreibung };
}

/** Inhaber: das neue Konto mit TAN übernehmen. Teilbeträge, die schon unterwegs sind, behalten ihr Konto. */
export async function planKontoBestaetigen(id: number, von: BuchPerson, tan: string, lauf: Lauf = sqlPool): Promise<{ ok: true; ibanMasked: string; unterwegs: number } | PlanFehler> {
  if (von.rolle !== "inhaber") return fehler(403, "NUR_INHABER", "Ein neues Konto bestätigt nur der Inhaber.");
  await planSchema();
  const [p] = (await lauf`SELECT * FROM fiaon_auszahlungsplan WHERE id = ${id}`) as any[];
  if (!p) return fehler(404, "NICHT_GEFUNDEN", "Diesen Auszahlungsplan gibt es nicht.");
  const konto = kontoLage(await agentLesen(zahl(p.agent_id), lauf), String(p.iban_pruef), await entschluessler());
  if (konto.art !== "geaendert" || !konto.pruef) return fehler(409, "KONTO_UNVERAENDERT", konto.ok ? "Das Konto ist unverändert." : (konto.grund || "Das Konto ist nicht verwendbar."));
  // Die TAN ist an den Prüfwert des NEUEN Kontos gebunden — hat es sich seit der Anforderung noch einmal geändert, passt sie nicht.
  const t = await tanPruefen(von, "plan-konto", `plan-konto:${id}:${konto.pruef}`, tan);
  if (!t.ok) return fehler(400, "TAN", t.grund);
  const [r] = (await lauf`
    UPDATE fiaon_auszahlungsplan
       SET iban_pruef = ${konto.pruef}, iban_masked = ${konto.ibanMasked}, konto_bestaetigt_von = ${von.email}, konto_bestaetigt_am = NOW(),
           konto_hinweis_am = NULL
     WHERE id = ${id} AND iban_pruef = ${String(p.iban_pruef)} AND status IN ('aktiv', 'pausiert')
    RETURNING nummer`) as any[];
  if (!r) return fehler(409, "ZUSTAND", "Der Plan hat sich inzwischen verändert. Bitte neu laden.");
  const [u] = (await lauf`
    SELECT COUNT(*)::int AS n FROM fiaon_buch_auftrag o JOIN fiaon_auszahlungsplan_teil t ON t.id = o.plan_teil_id
     WHERE t.plan_id = ${id} AND o.status IN ('eingereicht', 'freigegeben')`) as any[];
  buchProtokoll(von.email, "Auszahlungsplan: neues Konto bestätigt (mit TAN)", String(r.nummer), `${p.iban_masked || "—"} → ${konto.ibanMasked}`);
  return { ok: true, ibanMasked: konto.ibanMasked!, unterwegs: zahl(u?.n) };
}

/** Inhaber: die Hinweis-Mail („Bitte freigeben“) nach jeder Auslösung durch die Geschäftsführung an- oder abschalten. */
export async function planHinweisSetzen(id: number, von: BuchPerson, an: boolean, lauf: Lauf = sqlPool): Promise<Einfach> {
  if (von.rolle !== "inhaber") return fehler(403, "NUR_INHABER", "Das darf nur der Inhaber.");
  await planSchema();
  const [r] = (await lauf`UPDATE fiaon_auszahlungsplan SET hinweis_an_inhaber = ${an} WHERE id = ${id} RETURNING nummer`) as any[];
  if (!r) return fehler(404, "NICHT_GEFUNDEN", "Diesen Auszahlungsplan gibt es nicht.");
  buchProtokoll(von.email, an ? "Auszahlungsplan: Hinweis-Mail an" : "Auszahlungsplan: Hinweis-Mail aus", String(r.nummer), null);
  return { ok: true };
}

// ═══════════════════════════════════════════════════════════════════════════
// LAGE — alles für den Reiter „Auszahlungsplan“
// ═══════════════════════════════════════════════════════════════════════════
export interface PlanAuftrag extends Auftrag {
  planId: number;
  planNummer: string;
  teilNr: number;
  anzahlTeile: number;
  agentId: number;
  empfaengerName: string;
  ausgeloestVon: string | null;
  ausgeloestVonName: string | null;
  ausgeloestAm: string | null;
  selbstfreigabe: boolean;
  darfFreigeben: boolean;
  /** Warum (noch) nicht — damit kein Knopf ohne Grund grau ist. */
  freigabeGrund: string | null;
  darfAblehnen: boolean;
  darfZurueckrufen: boolean;
  darfErneutSenden: boolean;
  /** Bei der Buchhaltung seit (ISO), und ob schon mehr als zwei Bankarbeitstage vergangen sind. */
  beiBuchhaltungSeit: string | null;
  ueberfaellig: boolean;
}

export interface PlanZeile {
  id: number;
  nummer: string;
  status: PlanStatus;
  zustand: PlanZustand;
  darfAusloesen: boolean;
  /** Warum nicht ausgelöst werden kann (Klartext), sonst null. */
  sperrGrund: string | null;
  agentId: number;
  empfaengerName: string;
  /** Die angemeldete Person ist selbst Empfänger dieses Plans. */
  ichBinEmpfaenger: boolean;
  anspruchCents: number;
  teilCents: number;
  anzahlTeile: number;
  abstandMin: number;
  maxOffen: number;
  altposten: AltpostenModus;
  altpostenCents: number;
  altpostenAnzahl: number;
  /** Was beim Anlegen verrechnet wurde (Aufstellung). */
  altpostenDetail: unknown;
  hinweisAnInhaber: boolean;
  grund: string;
  ibanMasked: string | null;
  kontoArt: KontoLage["art"];
  kontoAktuellMasked: string | null;
  kontoBestaetigtAm: string | null;
  kontoBestaetigtVonName: string | null;
  angelegtVonName: string;
  angelegtAm: string;
  statusVonName: string | null;
  statusAm: string | null;
  statusGrund: string | null;
  naechsteAb: string;
  letzteAusloesungAm: string | null;
  letzteAusloesungVonName: string | null;
  naechsterTeil: { nr: number; betragCents: number } | null;
  ausgefuehrt: { anzahl: number; cents: number };
  zurFreigabe: { anzahl: number; cents: number };
  beiBuchhaltung: { anzahl: number; cents: number };
  offen: { anzahl: number; cents: number };
  selbstfreigaben: number;
  /** Was beim Empfänger außerhalb des Plans offen ist — neue Provisionen laufen normal (bei „verrechnet“ seit der Anlage). */
  ausserhalb: AltpostenStand | null;
  darfPausieren: boolean;
  darfFortsetzen: boolean;
  darfBeenden: boolean;
  darfKontoBestaetigen: boolean;
  darfHinweisSchalten: boolean;
}

export interface TaktZeile {
  id: number;
  planId: number;
  planNummer: string;
  teilNr: number | null;
  vonName: string;
  am: string;
  sperreBis: string;
  auftragId: number | null;
  auftragNummer: string | null;
  ergebnis: "zur_freigabe" | "bei_buchhaltung" | "ausgefuehrt" | "abgelehnt" | "zurueckgezogen" | "zurueckgerufen" | "unbekannt";
  ergebnisText: string;
}

export interface PlanLage {
  /** Datenbank-Zeit — die Oberfläche zählt mit dem Versatz zu ihrer Uhr herunter und löst nie selbst aus. */
  jetzt: string;
  ich: { email: string; name: string; rolle: BuchRolle };
  istInhaber: boolean;
  buchhaltung: string;
  plaene: PlanZeile[];
  zurFreigabe: PlanAuftrag[];
  beiBuchhaltung: PlanAuftrag[];
  ausgefuehrt: { zeilen: PlanAuftrag[]; gesamt: number; seite: number; proSeite: number };
  verlauf: TaktZeile[];
  /** Für den Menüpunkt: bereite Pläne plus Teilbeträge, die die angemeldete Person freigeben kann. */
  badge: number;
}

const PRO_SEITE = 20;

/** Alles für den Reiter. Knopf-Zustände kommen nur von hier (AGENTS.md, Neubau-Checkliste Nr. 3). */
export async function planLage(ich: BuchPerson, opts: { seite?: number } = {}): Promise<PlanLage> {
  await planSchema();
  const entschl = await entschluessler();
  const istInhaber = ich.rolle === "inhaber";
  const [{ jetzt: jetztRoh }] = (await sqlPool`SELECT NOW() AS jetzt`) as any[];
  const jetzt = new Date(jetztRoh);
  const seite = Math.max(0, Math.floor(Number(opts.seite) || 0));

  const zeilen = (await sqlPool.unsafe(`
    SELECT p.*, ${AGENT_SPALTEN_AG}
      FROM fiaon_auszahlungsplan p LEFT JOIN fiaon_agents a ON a.id = p.agent_id
     ORDER BY CASE WHEN p.status IN ('aktiv', 'pausiert') THEN 0 ELSE 1 END, p.id DESC
     LIMIT 40`)) as any[];
  const ids = zeilen.map((z) => zahl(z.id));
  const idListe = ids.length ? ids : [0];

  // Selbstheilung: Ein Auftrag ist ausgeführt, sein Teil aber nicht vermerkt (ausfuehrenKern brach nach der Buchung ab).
  const verwaist = (await sqlPool`
    SELECT o.id FROM fiaon_buch_auftrag o JOIN fiaon_auszahlungsplan_teil t ON t.auftrag_id = o.id
      JOIN fiaon_payouts po ON po.id = o.payout_id
     WHERE t.plan_id = ANY(${idListe}) AND o.status = 'ausgefuehrt' AND t.ausgefuehrt_am IS NULL AND po.status = 'ausgezahlt'`) as any[];
  for (const v of verwaist) {
    const a = await auftrag(zahl(v.id));
    if (a) await planTeilAusgefuehrt(a).catch((e) => console.error(`[AUSZAHLUNGSPLAN] Selbstheilung ${a.nummer}:`, e));
  }

  const stand = (await sqlPool`
    SELECT plan_id,
           COUNT(*) FILTER (WHERE ausgefuehrt_am IS NOT NULL)::int AS fertig,
           COALESCE(SUM(betrag_cents) FILTER (WHERE ausgefuehrt_am IS NOT NULL), 0)::bigint AS fertig_cents,
           COUNT(*) FILTER (WHERE payout_id IS NULL AND ausgefuehrt_am IS NULL)::int AS offen,
           COALESCE(SUM(betrag_cents) FILTER (WHERE payout_id IS NULL AND ausgefuehrt_am IS NULL), 0)::bigint AS offen_cents,
           COUNT(*) FILTER (WHERE selbstfreigabe AND ausgefuehrt_am IS NOT NULL)::int AS selbst
      FROM fiaon_auszahlungsplan_teil WHERE plan_id = ANY(${idListe}) GROUP BY plan_id`) as any[];
  const standJe = new Map<number, any>();
  stand.forEach((s) => standJe.set(zahl(s.plan_id), s));
  const naechste = (await sqlPool`
    SELECT DISTINCT ON (plan_id) plan_id, nr, betrag_cents FROM fiaon_auszahlungsplan_teil
     WHERE plan_id = ANY(${idListe}) AND payout_id IS NULL AND ausgefuehrt_am IS NULL
     ORDER BY plan_id, nr`) as any[];
  const naechsteJe = new Map<number, any>();
  naechste.forEach((s) => naechsteJe.set(zahl(s.plan_id), s));

  // Laufende Plan-Aufträge (zur Freigabe und bei der Buchhaltung).
  const laufend = ((await sqlPool.unsafe(`
    SELECT ${AUFTRAG_FELDER} FROM fiaon_buch_auftrag
     WHERE plan_teil_id IS NOT NULL AND status IN ('eingereicht', 'freigegeben')
     ORDER BY id ASC`)) as any[]).map(zuAuftrag);
  const ausgefuehrtIds = (await sqlPool`
    SELECT t.auftrag_id FROM fiaon_auszahlungsplan_teil t
     WHERE t.plan_id = ANY(${idListe}) AND t.ausgefuehrt_am IS NOT NULL
     ORDER BY t.ausgefuehrt_am DESC, t.id DESC
     LIMIT ${PRO_SEITE} OFFSET ${seite * PRO_SEITE}`) as any[];
  const [gesamtAus] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_auszahlungsplan_teil WHERE plan_id = ANY(${idListe}) AND ausgefuehrt_am IS NOT NULL`) as any[];
  const ausIds = ausgefuehrtIds.map((r) => zahl(r.auftrag_id)).filter((x) => x > 0);
  const ausgefuehrtAuftraege = ausIds.length
    ? ((await sqlPool.unsafe(`SELECT ${AUFTRAG_FELDER} FROM fiaon_buch_auftrag WHERE id = ANY($1::bigint[])`, [ausIds])) as any[]).map(zuAuftrag)
    : [];
  const teilIds = laufend.concat(ausgefuehrtAuftraege).map((a) => a.planTeilId!).filter((x) => !!x);
  const teile = teilIds.length
    ? ((await sqlPool`
        SELECT t.id, t.plan_id, t.nr, t.ausgeloest_von, t.ausgeloest_am, t.selbstfreigabe
          FROM fiaon_auszahlungsplan_teil t WHERE t.id = ANY(${teilIds})`) as any[])
    : [];
  const teilJe = new Map<number, any>();
  teile.forEach((t) => teilJe.set(zahl(t.id), t));
  const planJe = new Map<number, any>();
  zeilen.forEach((z) => planJe.set(zahl(z.id), z));

  const planAuftrag = (a: Auftrag): PlanAuftrag | null => {
    const t = teilJe.get(a.planTeilId ?? -1);
    const p = t ? planJe.get(zahl(t.plan_id)) : null;
    if (!t || !p) return null;
    const darf = freigabeMoeglich(a, ich);
    const planLaeuft = p.status === "aktiv";
    const darfFreigeben = a.status === "eingereicht" && darf.ok && planLaeuft;
    const extern = !!a.ausfuehrungExtern && a.status === "freigegeben" && !a.externBestaetigtAm;
    const seit = extern ? a.externGesendetAm : null;
    return {
      ...a,
      planId: zahl(p.id), planNummer: String(p.nummer), teilNr: zahl(t.nr), anzahlTeile: zahl(p.anzahl_teile),
      agentId: zahl(p.agent_id), empfaengerName: agentName({ id: p.agent_id, name: p.ag_name, first_name: p.ag_first_name, last_name: p.ag_last_name }),
      ausgeloestVon: t.ausgeloest_von ?? null, ausgeloestVonName: t.ausgeloest_von ? nameVon(t.ausgeloest_von) : null,
      ausgeloestAm: iso(t.ausgeloest_am), selbstfreigabe: t.selbstfreigabe === true,
      darfFreigeben,
      freigabeGrund: a.status !== "eingereicht" ? null : !planLaeuft ? planStatusSatz(planBezugAusZeile(p)) : darf.ok ? null : darf.grund,
      darfAblehnen: a.status === "eingereicht" && (istInhaber || (!!a.ausfuehrungExtern && ich.rolle === "buchhaltung" && a.erstelltVon !== ich.email)),
      darfZurueckrufen: istInhaber && extern,
      darfErneutSenden: extern,
      beiBuchhaltungSeit: seit,
      ueberfaellig: !!seit && bankarbeitstageDazwischen(seit, jetzt) >= 2,
    };
  };
  const zurFreigabe = laufend.filter((a) => a.status === "eingereicht").map(planAuftrag).filter((x): x is PlanAuftrag => !!x);
  const beiBuchhaltung = laufend.filter((a) => a.status === "freigegeben").map(planAuftrag).filter((x): x is PlanAuftrag => !!x);
  const ausReihenfolge = new Map<number, number>();
  ausIds.forEach((id, i) => ausReihenfolge.set(id, i));
  const ausgefuehrt = ausgefuehrtAuftraege
    .map(planAuftrag).filter((x): x is PlanAuftrag => !!x)
    .sort((x, y) => (ausReihenfolge.get(x.id) ?? 0) - (ausReihenfolge.get(y.id) ?? 0));

  const plaene: PlanZeile[] = [];
  for (const p of zeilen) {
    const id = zahl(p.id);
    const s = standJe.get(id);
    const nt = naechsteJe.get(id);
    const ag = {
      id: p.agent_id, name: p.ag_name, first_name: p.ag_first_name, last_name: p.ag_last_name, email: p.ag_email, active: p.ag_active,
      zugang_gesperrt_am: p.ag_zugang_gesperrt_am, bank_iban_enc: p.ag_bank_iban_enc, bank_iban_masked: p.ag_bank_iban_masked, ist_test: p.ag_ist_test,
    };
    const laeuft = p.status === "aktiv" || p.status === "pausiert";
    const konto = laeuft ? kontoLage(p.ag_id ? ag : null, String(p.iban_pruef), entschl) : { ok: true, art: "ok" as const, grund: null, ibanMasked: null, pruef: null, iban: null };
    const zf = zurFreigabe.filter((a) => a.planId === id);
    const bb = beiBuchhaltung.filter((a) => a.planId === id);
    const unterwegsAnzahl = zf.length + bb.length;
    let zustand: PlanZustand;
    let sperrGrund: string | null = null;
    if (p.status === "beendet") { zustand = "beendet"; sperrGrund = planStatusSatz(planBezugAusZeile(p)); }
    else if (p.status === "fertig") { zustand = "fertig"; sperrGrund = planStatusSatz(planBezugAusZeile(p)); }
    else if (p.status === "pausiert") { zustand = "pausiert"; sperrGrund = planStatusSatz(planBezugAusZeile(p)); }
    else if (!konto.ok) { zustand = "konto"; sperrGrund = konto.grund; }
    else if (!nt) { zustand = zahl(s?.offen) === 0 && unterwegsAnzahl === 0 ? "fertig" : "unterwegs"; sperrGrund = zustand === "fertig" ? "Alle Teilbeträge sind ausgeführt." : "Alle übrigen Teilbeträge sind unterwegs."; }
    else if (unterwegsAnzahl >= zahl(p.max_offen)) { zustand = "stau"; sperrGrund = `${unterwegsAnzahl} Teilbeträge sind unterwegs. Der nächste geht, sobald die Buchhaltung einen bestätigt.`; }
    else if (new Date(p.naechste_ab).getTime() > jetzt.getTime()) { zustand = "wartet"; sperrGrund = `Der nächste Teilbetrag geht ab ${uhr(p.naechste_ab)} Uhr.`; }
    else zustand = "bereit";
    // Einmal je Kontoänderung (oder Sperre) ein Hinweis an den Inhaber — nicht bei jedem Öffnen.
    if (zustand === "konto" && !p.konto_hinweis_am) {
      const [neu] = (await sqlPool`UPDATE fiaon_auszahlungsplan SET konto_hinweis_am = NOW() WHERE id = ${id} AND konto_hinweis_am IS NULL RETURNING id`) as any[];
      if (neu) benachrichtigen(inhaber().email, `Auszahlungsplan angehalten: ${p.nummer}`, [`${p.nummer}: ${konto.grund}`, "", REITER]);
    }
    let ausserhalb: AltpostenStand | null = null;
    if (laeuft && p.ag_id) ausserhalb = altpostenAussen(await altpostenLesen(zahl(p.agent_id), sqlPool, false));
    let detail: unknown = null;
    try { detail = p.altposten_detail ? JSON.parse(String(p.altposten_detail)) : null; } catch { detail = null; }
    plaene.push({
      id, nummer: String(p.nummer), status: String(p.status) as PlanStatus, zustand, darfAusloesen: zustand === "bereit", sperrGrund,
      agentId: zahl(p.agent_id), empfaengerName: agentName(ag),
      ichBinEmpfaenger: !!p.ag_email && String(p.ag_email).toLowerCase() === ich.email.toLowerCase(),
      anspruchCents: zahl(p.anspruch_cents), teilCents: zahl(p.teil_cents), anzahlTeile: zahl(p.anzahl_teile),
      abstandMin: zahl(p.abstand_min), maxOffen: zahl(p.max_offen),
      altposten: String(p.altposten) as AltpostenModus, altpostenCents: zahl(p.altposten_cents), altpostenAnzahl: zahl(p.altposten_anzahl), altpostenDetail: detail,
      hinweisAnInhaber: p.hinweis_an_inhaber === true, grund: String(p.grund || ""),
      ibanMasked: p.iban_masked ?? null, kontoArt: konto.art, kontoAktuellMasked: konto.ibanMasked,
      kontoBestaetigtAm: iso(p.konto_bestaetigt_am), kontoBestaetigtVonName: p.konto_bestaetigt_von ? nameVon(p.konto_bestaetigt_von) : null,
      angelegtVonName: nameVon(p.angelegt_von), angelegtAm: iso(p.angelegt_am)!,
      statusVonName: p.status_von ? nameVon(p.status_von) : null, statusAm: iso(p.status_am), statusGrund: p.status_grund ?? null,
      naechsteAb: iso(p.naechste_ab)!, letzteAusloesungAm: iso(p.letzte_ausloesung_am),
      letzteAusloesungVonName: p.letzte_ausloesung_von ? nameVon(p.letzte_ausloesung_von) : null,
      naechsterTeil: nt ? { nr: zahl(nt.nr), betragCents: zahl(nt.betrag_cents) } : null,
      ausgefuehrt: { anzahl: zahl(s?.fertig), cents: zahl(s?.fertig_cents) },
      zurFreigabe: { anzahl: zf.length, cents: zf.reduce((x, a) => x + a.betragCents, 0) },
      beiBuchhaltung: { anzahl: bb.length, cents: bb.reduce((x, a) => x + a.betragCents, 0) },
      offen: { anzahl: zahl(s?.offen), cents: zahl(s?.offen_cents) },
      selbstfreigaben: zahl(s?.selbst),
      ausserhalb,
      darfPausieren: p.status === "aktiv",
      darfFortsetzen: istInhaber && p.status === "pausiert",
      darfBeenden: istInhaber && laeuft,
      darfKontoBestaetigen: istInhaber && laeuft && konto.art === "geaendert",
      darfHinweisSchalten: istInhaber && laeuft,
    });
  }

  const verlaufRoh = (await sqlPool`
    SELECT k.id, k.plan_id, k.teil_id, k.auftrag_id, k.von, k.ausgeloest_am, k.sperre_bis,
           t.nr, pl.nummer AS plan_nummer, o.nummer AS auftrag_nummer, o.status AS auftrag_status, o.zurueckgerufen_am
      FROM fiaon_auszahlungsplan_takt k
      LEFT JOIN fiaon_auszahlungsplan_teil t ON t.id = k.teil_id
      LEFT JOIN fiaon_auszahlungsplan pl ON pl.id = k.plan_id
      LEFT JOIN fiaon_buch_auftrag o ON o.id = k.auftrag_id
     WHERE k.plan_id = ANY(${idListe})
     ORDER BY k.id DESC LIMIT 30`) as any[];
  const verlauf: TaktZeile[] = verlaufRoh.map((k) => {
    const st = String(k.auftrag_status || "");
    const ergebnis: TaktZeile["ergebnis"] = st === "eingereicht" ? "zur_freigabe" : st === "freigegeben" ? "bei_buchhaltung"
      : st === "ausgefuehrt" ? "ausgefuehrt" : st === "abgelehnt" ? "abgelehnt"
        : st === "zurueckgezogen" ? (k.zurueckgerufen_am ? "zurueckgerufen" : "zurueckgezogen") : "unbekannt";
    const ergebnisText = {
      zur_freigabe: "wartet auf Freigabe", bei_buchhaltung: "bei der Buchhaltung", ausgefuehrt: "ausgeführt", abgelehnt: "abgelehnt",
      zurueckgezogen: "zurückgezogen", zurueckgerufen: "zurückgerufen", unbekannt: "—",
    }[ergebnis];
    return {
      id: zahl(k.id), planId: zahl(k.plan_id), planNummer: String(k.plan_nummer || ""), teilNr: k.nr != null ? zahl(k.nr) : null,
      vonName: nameVon(k.von), am: iso(k.ausgeloest_am)!, sperreBis: iso(k.sperre_bis)!,
      auftragId: k.auftrag_id != null ? zahl(k.auftrag_id) : null, auftragNummer: k.auftrag_nummer ?? null, ergebnis, ergebnisText,
    };
  });

  return {
    jetzt: jetzt.toISOString(),
    ich: { email: ich.email, name: ich.name, rolle: ich.rolle },
    istInhaber,
    buchhaltung: BUCHHALTUNG_AUSFUEHRUNG,
    plaene,
    zurFreigabe,
    beiBuchhaltung,
    ausgefuehrt: { zeilen: ausgefuehrt, gesamt: zahl(gesamtAus?.n), seite, proSeite: PRO_SEITE },
    verlauf,
    badge: plaene.filter((p) => p.darfAusloesen).length + zurFreigabe.filter((a) => a.darfFreigeben).length,
  };
}
